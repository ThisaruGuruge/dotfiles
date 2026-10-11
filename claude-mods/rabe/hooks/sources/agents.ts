import type {
  AgentInfo,
  AgentStatus,
  EngineInterface,
  On,
  TurnCompleteReason,
  TurnStepResult,
  TurnUsage,
} from 'claude-code'

import type { RabeCodexCall, RabeEdit, RabeToolUse, RabeTurn } from '../../types'
import { companionCall, companionOutput } from '../forwarders'
import {
  clip,
  type EndStatus,
  itemId,
  type RabeItem,
  type RabeItemOf,
  type RabeItemStatus,
  type RabeTokens,
} from '../model'
import { claudeUsd, type Prices, parsePrices, withOverride } from '../prices'
import { addItem, type Change, commit, endItem, pastEnd, prune, updateItem } from '../registry'
import { changed, type Seen, shellWrites } from '../writes'

type Turns = Record<string, RabeTurn[]>
type AgentItem = RabeItemOf<'agent'>

const POLL_MS = 3000
const MAX_TURNS = 30
const MAX_ANSWER = 16000
const MAX_EDITS = 100
const MAX_CALLS = 10
const MAX_CHECKS = 20
const LOOK_MS = 1000
const MAX_PROMPT = 600
const MAX_SUMMARY = 80
const SUMMARY_FIELDS = ['file_path', 'command', 'pattern', 'path', 'url', 'query', 'description']
const META_FIELDS = ['cwd', 'worktreePath', 'worktreeBranch', 'workflowPhase'] as const

const LISTED: Record<AgentStatus, RabeItemStatus> = {
  pending: 'running',
  running: 'running',
  waiting: 'running',
  idle: 'running',
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
}

const ENDED: Record<TurnCompleteReason, EndStatus> = {
  answer: 'done',
  aborted: 'stopped',
  refusal: 'failed',
  error: 'failed',
}

export function toolSummary(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const fields = input as Record<string, unknown>
  const name = SUMMARY_FIELDS.find(one => typeof fields[one] === 'string')
  if (!name) return undefined
  const line = String(fields[name]).split('\n')[0] ?? ''

  // Effects tells files apart by the whole path.
  return name === 'file_path' ? line : clip(line, MAX_SUMMARY)
}

export function metaPatch(text: string): Partial<AgentItem['detail']> | undefined {
  try {
    const meta = JSON.parse(text) as Record<string, unknown>

    return Object.fromEntries(
      META_FIELDS.filter(name => typeof meta[name] === 'string').map(name => [name, meta[name]]),
    )
  } catch {
    return undefined
  }
}

export function metaPath(item: AgentItem, items: RabeItem[]): string | undefined {
  const parent = items.find(one => one.id === item.parentId)
  if (parent?.kind === 'workflow') {
    const folder =
      parent.detail.transcriptDir ??
      parent.detail.scriptPath?.replace(
        /\/workflows\/scripts\/[^/]+$/,
        `/subagents/workflows/${parent.detail.runId}`,
      )
    if (folder && folder !== parent.detail.scriptPath)
      return `${folder}/agent-${item.detail.agentId}.meta.json`
  }

  return item.detail.transcriptPath?.replace(/\.jsonl$/, '.meta.json')
}

export function agentTranscript(path: string, agentId: string): string | undefined {
  if (path.endsWith(`/agent-${agentId}.jsonl`)) return path
  if (!path.endsWith('.jsonl')) return undefined

  return `${path.slice(0, -'.jsonl'.length)}/subagents/agent-${agentId}.jsonl`
}

function workflowTranscript(
  path: string | undefined,
  agentId: string,
  runId: string,
): string | undefined {
  const generic = `/subagents/agent-${agentId}.jsonl`
  return path?.endsWith(generic)
    ? `${path.slice(0, -generic.length)}/subagents/workflows/${runId}/agent-${agentId}.jsonl`
    : path
}

// The file an Edit or Write changed: the engine ran it (a result, no error) and
// did not only stage it for review. The path comes from the result when it has one.
export function changedFile(
  answer: { result?: unknown; isError?: boolean },
  input: string,
): string | undefined {
  if (answer.isError || !answer.result || typeof answer.result !== 'object') return undefined
  const result = answer.result as { filePath?: unknown; staged?: unknown }
  if (result.staged === true) return undefined

  return typeof result.filePath === 'string' ? result.filePath : input
}

// A Bash call that ran to its end: a result, no error, not interrupted and not
// moved to the background.
export function ranBash(answer: { result?: unknown; isError?: boolean }): boolean {
  if (answer.isError || !answer.result || typeof answer.result !== 'object') return false
  const result = answer.result as { interrupted?: unknown; backgroundTaskId?: unknown }

  return result.interrupted !== true && result.backgroundTaskId === undefined
}

// Changes to files of an agent; its newest MAX_EDITS are kept.
function edited(items: RabeItem[], id: string, changes: RabeEdit[]): RabeItem[] {
  const agent = asAgent(items, id)
  if (!agent) return items
  const edits = [...(agent.detail.edits ?? []), ...changes].slice(-MAX_EDITS)

  return updateItem(items, id, { detail: { edits } })
}

// The companion calls of an agent: a new one, or what its answer told.
function called(
  items: RabeItem[],
  id: string,
  at: number,
  patch: Partial<RabeCodexCall>,
): RabeItem[] {
  const agent = asAgent(items, id)
  if (!agent) return items
  const calls = agent.detail.codexCalls ?? []
  const codexCalls = calls.some(one => one.at === at)
    ? calls.map(one => (one.at === at ? { ...one, ...patch } : one))
    : [...calls, { at, ...patch } as RabeCodexCall].slice(-MAX_CALLS)

  return updateItem(items, id, { detail: { codexCalls } })
}

// A call that went to the background still runs: it keeps no end. A failed
// run still printed its thread.
function answered(answer: { result?: unknown }, now: number): Partial<RabeCodexCall> {
  const result = (answer.result ?? {}) as Record<string, unknown>
  if (result.backgroundTaskId) return {}

  return { endedAt: now, ...companionOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`) }
}

export function addTurn(turns: Turns, id: string, turn: RabeTurn): Turns {
  return { ...turns, [id]: [...(turns[id] ?? []), turn].slice(-MAX_TURNS) }
}

function addUsage(tokens: RabeTokens | undefined, usage: TurnUsage): RabeTokens {
  return {
    input:
      (tokens?.input ?? 0) +
      usage.input_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens,
    output: (tokens?.output ?? 0) + usage.output_tokens,
    cached: (tokens?.cached ?? 0) + usage.cache_read_input_tokens,
  }
}

// Each step adds its own price, so a long-context step bills at its own tier. The
// sum is known only while every step since the start was: an agent Rabe did not
// see start, or one step without a price, stays n/a.
function addCost(item: AgentItem, usd: number | undefined): number | undefined {
  if (usd === undefined || item.startedAt === undefined) return undefined
  if (!item.tokens) return usd

  return item.costUsd === undefined ? undefined : item.costUsd + usd
}

function asAgent(items: RabeItem[], id: string): AgentItem | undefined {
  const item = items.find(one => one.id === id)

  return item?.kind === 'agent' ? item : undefined
}

// Statuses of a turn in flight: an ended agent in one was resumed. `idle` is
// not one: a teammate is idle after each turn, which already ended its item.
const RESUMED: AgentStatus[] = ['pending', 'running', 'waiting']

// An ended agent Rabe holds no item for takes `end` (see `pastEnd`), and none
// is added when `end` is undefined, so a poll never gives one a new recency.
function listed(
  items: RabeItem[],
  info: AgentInfo,
  now: number,
  end: number | undefined,
): RabeItem[] {
  const id = itemId('agent', info.id)
  const status = LISTED[info.status] ?? 'running'
  const held = asAgent(items, id)
  if (!held) {
    if (status !== 'running' && end === undefined) return items
    return addItem(
      items,
      {
        id,
        kind: 'agent',
        title: info.name || info.description || info.type,
        status,
        ...(status !== 'running' && { endedAt: end }),
        parentId: info.parentId ? itemId('agent', info.parentId) : undefined,
        detail: {
          agentId: info.id,
          ...(info.name && { name: info.name }),
          type: info.type,
          description: info.description,
        },
      },
      now,
    )
  }
  const named = info.name
    ? updateItem(items, id, { title: info.name, detail: { name: info.name } })
    : items
  if (held.status !== 'running' && RESUMED.includes(info.status)) {
    return updateItem(named, id, { status: 'running', endedAt: undefined })
  }

  return status === 'running' ? named : endItem(named, id, status, now)
}

function stepped(
  items: RabeItem[],
  id: string,
  result: TurnStepResult,
  tools: RabeToolUse[],
  now: number,
  usd: number | undefined,
): RabeItem[] {
  const item = asAgent(items, id)
  if (!item) return items
  const last = tools.at(-1)

  return updateItem(items, id, {
    status: 'running',
    endedAt: undefined,
    tokens: result.usage ? addUsage(item.tokens, result.usage) : item.tokens,
    costUsd: result.usage ? addCost(item, usd) : item.costUsd,
    detail: {
      model: result.usage?.model ?? item.detail.model,
      toolCount: (item.detail.toolCount ?? 0) + tools.length,
      lastTool: last?.name ?? item.detail.lastTool,
      lastToolAt: last ? now : item.detail.lastToolAt,
    },
  })
}

async function write($: Pick<EngineInterface, 'state'>, change: Change): Promise<void> {
  for (;;) {
    const { value, version } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const next = commit(value, change)
    if (next === undefined) return
    const { isSet } = await $.state.set({ plugin: 'rabe', key: 'items' }, next.items, {
      ifVersion: version,
    })
    if (isSet) return forget($, next.dropped)
  }
}

// Drops the lines and turns of the items a write dropped.
async function forget($: Pick<EngineInterface, 'state'>, dropped: string[]): Promise<void> {
  if (dropped.length === 0) return
  for (;;) {
    const { value = {}, version } = await $.state.get({ plugin: 'rabe', key: 'lines' })
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const next = prune(value, dropped, items)
    if (next === value) break
    const lines = await $.state.set({ plugin: 'rabe', key: 'lines' }, next, { ifVersion: version })
    if (lines.isSet) break
  }
  for (;;) {
    const { value = {}, version } = await $.state.get({ plugin: 'rabe', key: 'turns' })
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const next = prune(value, dropped, items)
    if (next === value) return
    const turns = await $.state.set({ plugin: 'rabe', key: 'turns' }, next, { ifVersion: version })
    if (turns.isSet) return
  }
}

async function writeTurns(
  $: Pick<EngineInterface, 'state'>,
  change: (turns: Turns) => Turns,
): Promise<void> {
  for (;;) {
    const { value = {}, version } = await $.state.get({ plugin: 'rabe', key: 'turns' })
    const { isSet } = await $.state.set({ plugin: 'rabe', key: 'turns' }, change(value), {
      ifVersion: version,
    })
    if (isSet) return
  }
}

// The main session's changes go to `rabe.edits`, an agent's to its item.
async function record(
  $: EngineInterface,
  agentId: string | undefined,
  changes: RabeEdit[],
): Promise<void> {
  if (changes.length === 0) return
  if (agentId) {
    const id = itemId('agent', agentId)
    return write($, items => edited(items, id, changes))
  }
  for (;;) {
    const { value = [], version } = await $.state.get({ plugin: 'rabe', key: 'edits' })
    const next = [...value, ...changes].slice(-MAX_EDITS)
    const { isSet } = await $.state.set({ plugin: 'rabe', key: 'edits' }, next, {
      ifVersion: version,
    })
    if (isSet) return
  }
}

type Listings = Map<string, Promise<Set<string> | undefined>>

// A path whose stat failed is missing only when its folder lists without it,
// or that folder is missing itself; error text is never read.
function hasName(names: Set<string>, name: string): boolean {
  if (names.has(name)) return true
  const fold = (one: string) => one.normalize('NFC').toLowerCase()
  const wanted = fold(name)
  for (const one of names) if (fold(one) === wanted) return true

  return false
}

async function isMissing($: EngineInterface, path: string, lists: Listings): Promise<boolean> {
  const cut = path.lastIndexOf('/')
  if (cut < 0 || path === '/') return false
  const folder = path.slice(0, cut) || '/'
  let names = lists.get(folder)
  if (!names) {
    names = $.fs.list(folder).then(
      entries => new Set(entries.map(entry => entry.name)),
      () => undefined,
    )
    lists.set(folder, names)
  }
  const listed = await names
  // A name the folder lists in another case or Unicode form may be this file (macOS, Windows).
  if (listed) return !hasName(listed, path.slice(cut + 1))

  return folder !== '/' && isMissing($, folder, lists)
}

// What is on disk at each path, or undefined when the looks outlast LOOK_MS.
async function look($: EngineInterface, paths: string[]): Promise<Seen[] | undefined> {
  const stop = new AbortController()
  const late = $.clock.sleep(LOOK_MS, { signal: stop.signal }).then(
    () => undefined,
    () => undefined,
  )
  const lists: Listings = new Map()
  const seen = Promise.all(
    paths.map(path =>
      $.fs.stat(path).then(
        (stat): Seen => stat,
        async (): Promise<Seen> => ((await isMissing($, path, lists)) ? 'none' : undefined),
      ),
    ),
  )
  try {
    return await Promise.race([seen, late])
  } finally {
    stop.abort()
  }
}

type Looked = { paths: string[]; seen: Seen[] }

async function beforeBash(
  $: EngineInterface,
  command: string,
  agentId: string | undefined,
): Promise<Looked | undefined> {
  const home = await $.env.get('HOME')
  let candidates = shellWrites(command, undefined, home)
  if (candidates.some(one => !one.path.startsWith('/'))) {
    let cwd: string | undefined
    if (agentId) {
      const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
      cwd = asAgent(items, itemId('agent', agentId))?.detail.cwd
    } else {
      cwd = await $.session.cwd().catch(() => undefined)
    }
    candidates = shellWrites(command, cwd, home)
  }
  const paths = candidates.map(one => one.path).filter(path => path.startsWith('/'))
  if (paths.length === 0 || paths.length > MAX_CHECKS) return undefined
  const seen = await look($, paths)

  return seen && { paths, seen }
}

async function afterBash($: EngineInterface, agentId: string | undefined, before: Looked) {
  const after = await look($, before.paths)
  if (!after) return
  const at = await $.clock.now()
  const changes = before.paths.flatMap((path, n): RabeEdit[] => {
    const change = changed(before.seen[n], after[n])
    if (!change) return []
    return [{ path, at, via: 'shell', ...(change === 'delete' && { change }) }]
  })
  await record($, agentId, changes)
}

async function readMeta($: EngineInterface, id: string): Promise<void> {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  const item = asAgent(items, id)
  const path = item && metaPath(item, items)
  if (!path) return
  const text = await $.fs.read(path).catch(() => undefined)
  const patch = typeof text === 'string' ? metaPatch(text) : undefined
  if (patch) await write($, list => updateItem(list, id, { detail: patch }))
}

async function refresh($: EngineInterface): Promise<void> {
  const agents = await $.agent.list().catch(() => [])
  const now = await $.clock.now()
  await write($, items => {
    const end = pastEnd(items, now)

    return agents.reduce((list, info) => listed(list, info, now, end), items)
  })
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  for (const item of items) {
    if (item.kind !== 'agent') continue
    const workflow = items.find(parent => parent.id === item.parentId && parent.kind === 'workflow')
    if (
      item.status === 'running' ||
      (workflow?.kind === 'workflow' &&
        workflow.detail.phases?.length &&
        item.detail.workflowPhase === undefined)
    )
      await readMeta($, item.id)
  }
}

// The built-in table, or with the user's file (`pricesFile`) its rows first. A
// file that is set but cannot be read gives no prices: costs show n/a.
async function prices($: EngineInterface, file: string): Promise<Prices> {
  const read = (path: string) => $.fs.read(path).then(text => parsePrices(String(text)))
  const built = await read(`${$.plugin.root}/data/prices.csv`).catch(() => [])
  if (!file) return built
  const home = file.startsWith('~/') && (await $.env.get('HOME').catch(() => undefined))
  const own = await read(home ? `${home}${file.slice(1)}` : file).catch(() => undefined)

  return own ? withOverride(built, own) : []
}

async function recordStep(
  $: EngineInterface,
  agentId: string,
  result: TurnStepResult,
  file: string,
) {
  const id = itemId('agent', agentId)
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  if (!asAgent(items, id)) return
  const now = await $.clock.now()
  const tools = result.toolUses.map(use => ({ name: use.name, summary: toolSummary(use.input) }))
  const usage = result.usage
  const usd = usage ? claudeUsd(await prices($, file), usage, usage.model) : undefined
  await write($, list => stepped(list, id, result, tools, now, usd))
  if (!result.answer && tools.length === 0) return
  await writeTurns($, turns => {
    const index = (turns[id]?.at(-1)?.index ?? 0) + 1
    const turn = { index, at: now, text: clip(result.answer, MAX_ANSWER), tools }

    return addTurn(turns, id, turn)
  })
}

export function agents(on: On, file: string): void {
  on('session.start', { cwd: /^/ }, async ($, e, next) => {
    $.clock.every(POLL_MS, () => refresh($))
    await refresh($)

    return next(e)
  })

  on('agent.spawn', { subagentType: /^/ }, async ($, e, next) => {
    const result = await next(e)
    const agentId = result.agentId
    if (!agentId) return result
    const now = await $.clock.now()
    const runId = e.workflow?.runId
    const parent = e.parentAgentId ? itemId('agent', e.parentAgentId) : undefined
    const id = itemId('agent', agentId)
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const transcriptPath = runId
      ? workflowTranscript(asAgent(items, id)?.detail.transcriptPath, agentId, runId)
      : undefined
    await write($, items =>
      addItem(
        items,
        {
          id: itemId('agent', agentId),
          kind: 'agent',
          title: e.description || e.subagentType,
          status: 'running',
          startedAt: now,
          parentId: runId ? itemId('workflow', runId) : parent,
          detail: {
            agentId,
            ...(transcriptPath && { transcriptPath }),
            type: e.subagentType,
            model: result.model,
            description: e.description,
            prompt: clip(e.prompt, MAX_PROMPT),
            workflowIndex: e.workflow?.agentIndex,
          },
        },
        now,
      ),
    )

    return result
  }).catch((_$, e, next) => next(e))

  on('classic.SubagentStart', { agent_id: /^/ }, async ($, e, next) => {
    const transcriptPath = agentTranscript(e.transcript_path, e.agent_id)
    const detail = {
      agentId: e.agent_id,
      ...(transcriptPath && { transcriptPath }),
      ...(e.cwd && { cwd: e.cwd }),
    }
    const id = itemId('agent', e.agent_id)
    const now = await $.clock.now()
    await write($, items =>
      items.some(item => item.id === id)
        ? updateItem(items, id, { detail })
        : addItem(
            items,
            { id, kind: 'agent', title: e.agent_type, status: 'running', startedAt: now, detail },
            now,
          ),
    )

    return next(e)
  }).catch((_$, e, next) => next(e))

  on('turn.step', { agentId: /^/ }, async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId) await recordStep($, e.agentId, result, file)

    return result
  })

  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const answer = await next(e)
    try {
      const path = (e.tool === 'Edit' || e.tool === 'Write') && changedFile(answer, e.file_path)
      if (path) {
        const via = e.tool === 'Edit' ? 'edit' : 'write'
        await record($, e.agentId, [{ path, at: await $.clock.now(), via }])
      }
    } catch {}

    return answer
  })

  // The command line proposes files; a look on disk before and after decides.
  // A call of the Codex companion is kept on its agent, so the Codex source can
  // link the job it starts (see forwarders.ts).
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const before =
      e.tool === 'Bash'
        ? await beforeBash($, e.command, e.agentId).catch(() => undefined)
        : undefined
    const call = e.tool === 'Bash' && e.agentId ? companionCall(e.command) : undefined
    const id = itemId('agent', e.agentId ?? '')
    const at = call && (await $.clock.now().catch(() => undefined))
    if (call && at !== undefined) {
      await write($, items => called(items, id, at, call)).catch(() => undefined)
    }
    const answer = await next(e)
    try {
      if (at !== undefined) {
        const patch = answered(answer, await $.clock.now())
        await write($, items => called(items, id, at, patch))
      }
    } catch {}
    try {
      if (before && ranBash(answer)) await afterBash($, e.agentId, before)
    } catch {}

    return answer
  })

  on('turn.complete', { agentId: /^/ }, async ($, e, next) => {
    const result = await next(e)
    const agentId = e.agentId
    if (!agentId) return result
    const now = await $.clock.now()
    await write($, items => endItem(items, itemId('agent', agentId), ENDED[e.reason], now))
    await readMeta($, itemId('agent', agentId))

    return result
  })
}
