import type { RabeEdit, RabeOrder, RabePrevious, RabeWorktree } from '../../types'
import { isAbsolute, isInside, pathKey, type RabeItem, type RabeItemKind } from '../model'
import { nextRuns } from '../schedule'
import type { Span } from './cells/grid'
import { C, type Style } from './cells/palette'
import { ago, clockTime, duration, short, tokens, usd } from './format'

export type Group = 'failed' | 'agents' | 'shells' | 'monitors' | 'cron'

export const GROUPS: { id: Group; label: string }[] = [
  { id: 'failed', label: 'Failed' },
  { id: 'agents', label: 'Agents' },
  { id: 'shells', label: 'Shells' },
  { id: 'monitors', label: 'Monitors' },
  { id: 'cron', label: 'Cron' },
]

export const KIND_LABEL: Record<RabeItemKind, string> = {
  agent: 'claude',
  codex: 'codex',
  workflow: 'workflow',
  shell: 'shell',
  monitor: 'monitor',
  cron: 'cron',
}

const RUNNING_GLYPH: Record<RabeItemKind, string> = {
  agent: '◐',
  codex: '◐',
  workflow: '⧉',
  shell: '▶',
  monitor: '◉',
  cron: '⟳',
}

export function glyph(item: RabeItem): string {
  if (item.status === 'failed') return '✗'
  if (item.status === 'done') return '✓'
  if (item.status === 'stopped') return '■'

  return RUNNING_GLYPH[item.kind]
}

export function statusLabel(item: RabeItem): string {
  return item.kind === 'cron' && item.detail.isDeleted ? 'deleted' : item.status
}

export function nextRun(item: RabeItem, now: number): number | undefined {
  if (item.kind !== 'cron') return undefined
  if (item.detail.scheduledFor !== undefined) return item.detail.scheduledFor

  return item.detail.schedule ? nextRuns(item.detail.schedule, now, 1)[0] : undefined
}

// The next run as its clock time: a countdown in m:ss (`15:44`) reads like
// one. A wakeup past its time waits for the session to go idle: `due`.
export function nextAt(item: RabeItem, now: number): string {
  const next = nextRun(item, now)
  if (next === undefined) return 'n/a'

  return next > now ? clockTime(next).slice(0, 5) : 'due'
}

// A shell's port (blue) and a failed shell's exit code (red) follow its title.
export function nameSpans(item: RabeItem, style: Style = {}): Span[] {
  const out: Span[] = [[item.title, style]]
  if (item.kind !== 'shell') return out
  if (item.detail.port !== undefined) out.push([` :${item.detail.port}`, { fg: C.blue }])
  if (item.status === 'failed' && item.detail.exitCode !== undefined) {
    out.push([` exit ${item.detail.exitCode}`, { fg: C.red }])
  }

  return out
}

export function timeLabel(item: RabeItem, now: number): string {
  if (item.status !== 'running') return item.endedAt === undefined ? 'n/a' : ago(now - item.endedAt)
  if (item.kind === 'cron') {
    const at = nextAt(item, now)
    return at === 'n/a' || at === 'due' ? at : `next ${at}`
  }
  if (item.startedAt === undefined) return `≥ ${short(now - item.seenAt)}`

  return duration(now - item.startedAt)
}

export function groupOf(item: RabeItem): Group {
  return item.status === 'failed' ? 'failed' : kindGroupOf(item)
}

// The group of an item's kind, whatever its status.
function kindGroupOf(item: RabeItem): Group {
  if (item.kind === 'shell') return 'shells'
  if (item.kind === 'monitor') return 'monitors'
  if (item.kind === 'cron') return 'cron'

  return 'agents'
}

// The items the list and the band's chips show: the person removed the others
// this session (`rabe.removed`). An item that runs again shows, since nothing
// running is ever hidden.
export const kept = (items: RabeItem[], removed: readonly string[] = []): RabeItem[] =>
  removed.length === 0
    ? items
    : items.filter(item => item.status === 'running' || !removed.includes(item.id))

export function matches(item: RabeItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const d = item.detail as Record<string, unknown>
  const words = [item.title, KIND_LABEL[item.kind], d.command, d.prompt, d.description, d.type]

  return words.some(word => typeof word === 'string' && word.toLowerCase().includes(q))
}

// A Claude agent that only forwarded work to the Codex companion: each tool
// call it made ran the companion, and Rabe linked a job to it. Its row folds
// into the job; an agent that did more, or whose tool count is not known, stays.
export function isForwarder(item: RabeItem, items: readonly RabeItem[]): boolean {
  if (item.kind !== 'agent') return false
  const calls = item.detail.codexCalls?.length ?? 0

  return (
    calls > 0 &&
    item.detail.toolCount === calls &&
    items.some(one => one.kind === 'codex' && one.parentId === item.id)
  )
}

// The items lists show: forwarders fold into their Codex jobs.
export const shown = (items: RabeItem[]): RabeItem[] =>
  items.filter(item => !isForwarder(item, items))

// The forwarder folded into a Codex job: only its first job counts it.
export function forwarderOf(job: RabeItem, items: readonly RabeItem[]): RabeItem | undefined {
  if (job.kind !== 'codex' || !job.parentId) return undefined
  const parent = items.find(one => one.id === job.parentId)
  const first = items.find(one => one.kind === 'codex' && one.parentId === job.parentId)

  return parent && first === job && isForwarder(parent, items) ? parent : undefined
}

// The row that stands for item `id`: a folded forwarder's is its job's.
export const rowOf = (id: string, items: readonly RabeItem[]): string =>
  items.find(one => forwarderOf(one, items)?.id === id)?.id ?? id

const both = (a?: number, b?: number) => (a === undefined || b === undefined ? undefined : a + b)

// A Codex job's spend with its forwarder's: one piece of work, one cost line.
// What one of them lacks makes the sum unknown, never the other's part.
export function withForwarder(item: RabeItem, items: readonly RabeItem[]): RabeItem {
  const by = forwarderOf(item, items)
  if (!by) return item
  const [a, b] = [item.tokens, by.tokens]
  const cached = both(a?.cached, b?.cached)
  const tokens =
    a && b
      ? {
          input: a.input + b.input,
          output: a.output + b.output,
          ...(cached !== undefined && { cached }),
        }
      : undefined

  return { ...item, tokens, costUsd: both(item.costUsd, by.costUsd) } as RabeItem
}

// Codex jobs follow the agent that started them, after its other jobs. A job
// in `held` (the order the pane opened with) keeps its place.
export function nest(list: RabeItem[], held: readonly string[] = []): RabeItem[] {
  const isChild = (item: RabeItem) =>
    item.kind === 'codex' &&
    !held.includes(item.id) &&
    list.some(one => one.kind === 'agent' && one.id === item.parentId)
  const rest = list.filter(item => !isChild(item))
  const owner = (item?: RabeItem) => (item?.kind === 'codex' && item.parentId) || item?.id
  const placed = new Set<string | undefined>()

  return rest.flatMap((item, i) => {
    const id = owner(item)
    if (owner(rest[i + 1]) === id || placed.has(id)) return [item]
    placed.add(id)
    return [item, ...list.filter(one => isChild(one) && one.parentId === id)]
  })
}

const recency = (item: RabeItem) => item.endedAt ?? item.startedAt ?? item.seenAt

export function sortItems(items: RabeItem[]): RabeItem[] {
  return items.toSorted(
    (a, b) =>
      Number(b.status === 'running') - Number(a.status === 'running') || recency(b) - recency(a),
  )
}

// A list that does not reorder under the focus. Without `held` (nobody has
// seen the list yet) it is `sort(list)`; with it, the held ids come first in
// held order, then the others in the order of `list`, which is the order Rabe
// saw them: new items append, and a status change moves nothing.
export function stable<T extends { id: string }>(
  list: T[],
  held: readonly string[] | undefined,
  sort: (list: T[]) => T[],
): T[] {
  if (!held) return sort(list)
  const at = new Map(held.map((id, i) => [id, i]))

  return list.toSorted((a, b) => (at.get(a.id) ?? held.length) - (at.get(b.id) ?? held.length))
}

// The Items tab's groups, failed first. Without `order` each group sorts
// running first, then the newest; with it, a held item stays in the group and
// place `orderOf` gave it, and an item Rabe saw since goes to the group of its
// kind (failed or not, so it never changes group), after the held rows, in
// the order Rabe saw it. The pane moves the focus ring back onto its row when
// such a row comes above it (see `hold` in render.tsx).
export function grouped(
  items: RabeItem[],
  order?: RabeOrder,
): { id: Group; label: string; items: RabeItem[] }[] {
  const of = (item: RabeItem): Group =>
    order
      ? (GROUPS.find(group => order[group.id]?.includes(item.id))?.id ?? kindGroupOf(item))
      : groupOf(item)

  return GROUPS.map(group => {
    const held = order && (order[group.id] ?? [])
    const list = stable(
      items.filter(item => of(item) === group.id),
      held,
      sortItems,
    )
    return { ...group, items: group.id === 'agents' ? nest(list, held) : list }
  }).filter(group => group.items.length > 0)
}

const start = (item: RabeItem) => item.startedAt ?? item.seenAt

export function byStart(items: RabeItem[]): RabeItem[] {
  return items.toSorted((a, b) => start(a) - start(b))
}

// Who changed files: an agent, a Codex job or the main session (no item).
export type Editor = { id: string; title: string; tree?: string; root?: string; item?: RabeItem }

export type Touched = {
  id: string
  path: string
  rel: string
  by: Editor[]
  last: Editor
  edits: number
  at: number
  first: number
  hows: string[]
  isDeleted: boolean
  isConflict: boolean
  // The git worktree that holds the file; absent without git or outside them.
  tree?: RabeWorktree
}

// The worktree whose path is the longest prefix of `path`.
export function treeOf(path: string, trees: RabeWorktree[]): RabeWorktree | undefined {
  return trees
    .filter(tree => isInside(path, tree.path))
    .reduce<RabeWorktree | undefined>(
      (best, tree) => (best && best.path.length >= tree.path.length ? best : tree),
      undefined,
    )
}

function relative(path: string, root?: string): string {
  const base = root?.replace(/[\\/]+$/, '')
  return base && isInside(path, base) && pathKey(path) !== pathKey(base)
    ? path.slice(base.length + 1)
    : path
}

function howOf(edit: RabeEdit): string {
  if (edit.via === 'shell') return 'via shell'
  if (edit.via === 'codex') return `codex ${edit.change ?? 'update'}`

  return edit.via ?? 'edit'
}

type Edits = { editor: Editor; edits: RabeEdit[] }

function editorsOf(items: RabeItem[], main: RabeEdit[], cwd?: string): Edits[] {
  const own = items.flatMap((item): Edits[] => {
    if (item.kind === 'agent') {
      const { worktreePath, cwd: root } = item.detail
      const editor = {
        id: item.id,
        title: item.title,
        tree: worktreePath,
        root: worktreePath ?? root,
        item,
      }
      return [{ editor, edits: item.detail.edits ?? [] }]
    }
    if (item.kind === 'codex') {
      const editor = { id: item.id, title: item.title, root: item.detail.workspaceRoot, item }
      return [{ editor, edits: item.detail.edits ?? [] }]
    }
    return []
  })

  return [...own, { editor: { id: 'main', title: 'main session', root: cwd }, edits: main }]
}

// The files changed by agents (Edit and Write calls the engine ran, not the
// calls a turn asks for), Codex jobs (file changes) and the main session, and
// the files shell commands of each wrote (a guess), in the order they were
// first changed. `by` lists the editors in the order they first changed it,
// `last` the latest one, `hows` how, `first` and `at` the first and the latest
// change times. Two editors of one absolute path are a conflict; a relative
// path is none. With git's worktrees (`trees`) each file is shown relative to
// the worktree that holds it; else relative to its first editor's folder.
export function touched(
  items: RabeItem[],
  main: RabeEdit[] = [],
  cwd?: string,
  trees?: RabeWorktree[],
): Touched[] {
  const edits = editorsOf(items, main, cwd)
    .flatMap(({ editor, edits: list }) => list.map(edit => ({ editor, edit })))
    .toSorted((a, b) => a.edit.at - b.edit.at)
  const files = new Map<string, Touched>()
  for (const { editor, edit } of edits) {
    const { path, at } = edit
    const tree = trees && treeOf(path, trees)
    const key = pathKey(path)
    const file = files.get(key) ?? {
      id: `file:${path}`,
      path,
      rel: relative(path, tree ? tree.path : editor.root),
      ...(tree && { tree }),
      by: [],
      last: editor,
      edits: 0,
      at,
      first: at,
      hows: [],
      isDeleted: false,
      isConflict: false,
    }
    if (!file.by.includes(editor)) file.by.push(editor)
    const how = howOf(edit)
    if (!file.hows.includes(how)) file.hows.push(how)
    file.last = editor
    file.edits += 1
    file.at = at
    file.isDeleted = edit.change === 'delete'
    file.isConflict = file.by.length > 1 && isAbsolute(path)
    files.set(key, file)
  }

  return [...files.values()]
}

// Conflicts (two editors) first, then the latest edit first.
export function byConflict(files: Touched[]): Touched[] {
  return files.toSorted((a, b) => Number(b.isConflict) - Number(a.isConflict) || b.at - a.at)
}

// Shells and monitors an agent started sit under that agent (see `byParent`).
export const FAMILIES: Group[] = ['shells', 'monitors']

// The order the pane shows when it opens: each group sorted (shells and
// monitors in their families), the Cost tab by tokens, the Timeline by start,
// the Effects files by `byConflict` and its ports (the shells that run with
// one). Held in `rabe.order` until the next open.
export function orderOf(all: RabeItem[], edits: RabeEdit[] = []): RabeOrder {
  const ids = (list: RabeItem[]) => list.map(item => item.id)
  const items = shown(all)

  return {
    ports: ids(
      items.filter(
        item =>
          item.kind === 'shell' && item.detail.port !== undefined && item.status === 'running',
      ),
    ),
    ...Object.fromEntries(
      grouped(items).map(group => [
        group.id,
        ids(
          FAMILIES.includes(group.id)
            ? byParent(group.items, items).flatMap(family => family.items)
            : group.items,
        ),
      ]),
    ),
    cost: ids(byTokens(items.map(item => withForwarder(item, all)))),
    timeline: ids(byStart(items)),
    files: byConflict(touched(all, edits)).map(file => file.id),
  }
}

export type Family = { id: string; parent?: RabeItem; title: string; items: RabeItem[] }

// Shells and monitors by who started them: the main session's first (title
// ''), then one block per agent in the order of `list`. A workflow agent reads
// "run › agent"; an agent Rabe no longer holds "agent n/a".
export function byParent(list: RabeItem[], items: RabeItem[]): Family[] {
  const blocks: Family[] = [{ id: '', title: '', items: [] }]
  for (const item of list) {
    const id = item.parentId ?? ''
    let block = blocks.find(one => one.id === id)
    if (!block) {
      const parent = items.find(one => one.id === id)
      const run = parent && items.find(one => one.id === parent.parentId && one.kind === 'workflow')
      const title = !parent ? 'agent n/a' : run ? `${run.title} › ${parent.title}` : parent.title
      block = { id, ...(parent && { parent }), title, items: [] }
      blocks.push(block)
    }
    block.items.push(item)
  }

  return blocks.filter(block => block.items.length > 0)
}

export function groupNote(id: Group, items: RabeItem[]): string {
  if (id === 'failed') return ''
  const running = items.filter(item => item.status === 'running').length
  const ended = items.length - running
  const state = [running && `${running} running`, ended && `${ended} ended`]
    .filter(Boolean)
    .join(' · ')
  if (id === 'agents') {
    const kinds = (['agent', 'codex', 'workflow'] as const)
      .map(kind => [items.filter(item => item.kind === kind).length, KIND_LABEL[kind]] as const)
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}`)
      .join(' · ')
    return [state, kinds].filter(Boolean).join(' · ')
  }
  return state
}

export function children(items: RabeItem[], id: string): RabeItem[] {
  return items.filter(item => item.parentId === id)
}

export type PhaseState = 'done' | 'running' | 'failed' | 'waiting'

export function phases(
  items: RabeItem[],
  flow: RabeItem,
): { name: string; state: PhaseState; agents: RabeItem[] }[] {
  if (flow.kind !== 'workflow') return []
  const agents = children(items, flow.id)
  const names = flow.detail.phases ?? []
  const seen = agents.map(a => (a.kind === 'agent' ? a.detail.workflowPhase : undefined) ?? 'n/a')
  const all = [
    ...names,
    ...seen.filter((one, i) => !names.includes(one) && seen.indexOf(one) === i),
  ]

  return all.map(phase => {
    const list = agents.filter((_, i) => seen[i] === phase)
    const state: PhaseState =
      list.length === 0
        ? 'waiting'
        : list.some(a => a.status === 'running')
          ? 'running'
          : list.every(a => a.status === 'done')
            ? 'done'
            : 'failed'
    return { name: phase, state, agents: list }
  })
}

export function phaseProgress(items: RabeItem[], flow: RabeItem): string {
  const list = phases(items, flow)
  const at = list.findLastIndex(phase => phase.state !== 'waiting')
  if (at === -1) return list.length ? `0/${list.length}` : 'n/a'

  return `${list[at]?.name} ${at + 1}/${list.length}`
}

export type Totals = {
  usd?: number
  tokens: number
  unknown: number
  claude?: number
  codex?: number
}

const plus = (sum: number | undefined, value: number | undefined) =>
  value === undefined ? sum : (sum ?? 0) + value

export function totals(items: RabeItem[]): Totals {
  const out: Totals = { tokens: 0, unknown: 0 }
  const unpriced = new Set<'claude' | 'codex'>()
  for (const item of items) {
    if (item.kind !== 'agent' && item.kind !== 'codex') continue
    const side = item.kind === 'agent' ? 'claude' : 'codex'
    if (!item.tokens) out.unknown += 1
    out.tokens += item.tokens ? item.tokens.input + item.tokens.output : 0
    if (item.costUsd === undefined) {
      unpriced.add(side)
      continue
    }
    out.usd = plus(out.usd, item.costUsd)
    out[side] = plus(out[side], item.costUsd)
  }
  // a worker without a dollar amount makes its sum unknown, not smaller
  for (const side of unpriced) delete out[side]
  if (unpriced.size) delete out.usd

  return out
}

export const cost = (n: number | undefined) => (n === undefined ? 'n/a' : `≈ ${usd(n)}`)

export const tokenSum = (item: RabeItem) =>
  item.tokens ? item.tokens.input + item.tokens.output : -1

export function byTokens(items: RabeItem[]): RabeItem[] {
  return items
    .filter(item => item.kind === 'agent' || item.kind === 'codex')
    .toSorted((a, b) => tokenSum(b) - tokenSum(a))
}

export function share(items: RabeItem[], item: RabeItem): string {
  const all = totals(items).tokens
  const own = tokenSum(item)

  return all > 0 && own >= 0 ? `${Math.round((own / all) * 100)}%` : 'n/a'
}

// `session` is the session's cost as `/cost` totals it; it wins over the sum
// of the items, which misses every worker without a dollar amount.
export function costLine(items: RabeItem[], session?: number): string | undefined {
  const sum = totals(items)
  if (sum.tokens === 0) return undefined
  const dollars = session === undefined ? 'n/a' : `≈ ${usd(session)}`
  const cached = items.reduce((n, item) => n + (item.tokens?.cached ?? 0), 0)
  const cacheText =
    sum.tokens > 0 && cached > 0 ? `, ${Math.round((cached / sum.tokens) * 100)}% cached` : ''

  return `session ${dollars} · bg ${tokens(sum.tokens)} tok${cacheText}`
}

export type BandRow = { glyph: string; kind: RabeItemKind; count: number; failed?: boolean }

// What the band counts per kind, failed (in the last 10 minutes) first.
export function bandRows(items: RabeItem[], now: number): BandRow[] {
  const running = (kind: RabeItemKind) =>
    shown(items).filter(item => item.kind === kind && item.status === 'running').length
  const failed = (['agent', 'codex', 'workflow', 'shell', 'monitor', 'cron'] as const).flatMap(
    kind => {
      const count = items.filter(
        item =>
          item.kind === kind &&
          item.status === 'failed' &&
          now - (item.endedAt ?? item.seenAt) < 10 * 60_000,
      ).length
      return count ? [{ glyph: '✗', kind, count, failed: true }] : []
    },
  )
  const rows: BandRow[] = [
    ...failed,
    ...(['agent', 'codex', 'workflow', 'shell', 'monitor', 'cron'] as const).map(kind => ({
      glyph: RUNNING_GLYPH[kind],
      kind,
      count: running(kind),
    })),
  ]

  return rows.filter(row => row.failed || row.count > 0)
}

export type TreeLine = { prefix: string; item: RabeItem }

export function tree(items: RabeItem[]): TreeLine[] {
  const ids = new Set(items.map(item => item.id))
  const out: TreeLine[] = []
  const walk = (list: RabeItem[], indent: string) => {
    for (const [i, item] of list.entries()) {
      const isLast = i === list.length - 1
      out.push({ prefix: `${indent}${isLast ? '└─ ' : '├─ '}`, item })
      walk(children(items, item.id), `${indent}${isLast ? '   ' : '│  '}`)
    }
  }
  walk(
    items.filter(item => !item.parentId || !ids.has(item.parentId)),
    '',
  )

  return out
}

export function bar(from: number, to: number, start: number, end: number, width: number): string {
  const span = Math.max(1, end - start)
  const a = Math.min(width - 1, Math.max(0, Math.floor(((from - start) / span) * width)))
  const b = Math.max(a + 1, Math.min(width, Math.ceil(((to - start) / span) * width)))

  return `${' '.repeat(a)}${'█'.repeat(b - a)}${' '.repeat(width - b)}`
}

export type TreeRow = { name: string; branch?: string; who: string[] }

const treeName = (path: string) =>
  path.includes('/.claude/')
    ? path.slice(path.indexOf('.claude/'))
    : (path.split(/[\\/]/).filter(Boolean).at(-1) ?? path)

// The WORKTREES section: one row per worktree in use, each with who works
// there. With git (`trees`) a worktree is in use when a file in it changed
// (its editors, the main session included) or an agent runs in it (its
// `worktreePath`, else its `cwd` when it changed no file in a worktree); an
// agent's worktree git does not list keeps its row from the agent's metadata.
// Without git, rows come from agent metadata alone: each agent worktree, then
// the main tree for agents whose `cwd` is the session's (`cwd`). `unknown`
// counts agents whose tree Rabe cannot tell.
export function worktreeRows(
  items: RabeItem[],
  files: Touched[],
  trees?: RabeWorktree[],
  cwd?: string,
): { rows: TreeRow[]; unknown: number } {
  const known = trees?.length ? trees : undefined
  const rows = new Map<string, TreeRow>()
  const add = (key: string, row: Omit<TreeRow, 'who'>, title: string) => {
    const one = rows.get(key) ?? { ...row, who: [] }
    if (!one.who.includes(title)) one.who.push(title)
    rows.set(key, one)
  }
  const gitRow = (tree: RabeWorktree) => ({
    name: tree.isMain ? 'main tree' : treeName(tree.path),
    branch: tree.branch ?? (tree.isDetached ? 'detached' : 'n/a'),
  })
  for (const file of known ? files : []) {
    if (!file.tree) continue
    for (const editor of file.by) add(file.tree.path, gitRow(file.tree), editor.title)
  }
  let unknown = 0
  const agents = items.flatMap(item => (item.kind === 'agent' ? [item] : []))
  for (const agent of agents) {
    const { worktreePath, worktreeBranch, cwd: at } = agent.detail
    const own = worktreePath
      ? known?.find(tree => pathKey(tree.path) === pathKey(worktreePath))
      : undefined
    if (own) add(own.path, gitRow(own), agent.title)
    else if (worktreePath) {
      const row = { name: treeName(worktreePath), branch: worktreeBranch ?? 'n/a' }
      add(`agent ${worktreePath}`, row, agent.title)
    } else if (known && files.some(file => file.tree && file.by.some(one => one.id === agent.id))) {
    } else if (!at) unknown += 1
    else if (!known) {
      if (cwd && pathKey(at) === pathKey(cwd)) add('main', { name: 'main tree' }, agent.title)
      else unknown += 1
    } else {
      const tree = treeOf(at, known)
      if (tree) add(tree.path, gitRow(tree), agent.title)
      else unknown += 1
    }
  }
  const order = [...(known ?? []).map(tree => tree.path)]
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length)
  const keys = [...rows.keys()]
  const sorted = keys.toSorted(
    (a, b) =>
      Number(a === 'main') - Number(b === 'main') ||
      rank(a) - rank(b) ||
      keys.indexOf(a) - keys.indexOf(b),
  )

  return { rows: sorted.map(key => rows.get(key) as TreeRow), unknown }
}

// What the next session in this project shows of this one.
export function previousOf(
  items: RabeItem[],
  endedAt: number,
  usage: { startedAt?: number; usd?: number },
  sessionId?: string,
): RabePrevious {
  const counts: RabePrevious['counts'] = {}
  for (const item of items) {
    if (item.kind === 'cron' && item.status !== 'running') continue
    counts[item.kind] = (counts[item.kind] ?? 0) + 1
  }

  return {
    ...(sessionId && { sessionId }),
    endedAt,
    startedAt: usage.startedAt,
    counts,
    tokens: totals(items).tokens,
    usd: usage.usd,
    failed: items.filter(item => item.status === 'failed').map(item => item.title),
  }
}
