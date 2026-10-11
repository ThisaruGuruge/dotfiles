import type { EngineInterface, On } from 'claude-code'

import { itemId, type RabeItem } from '../model'
import { addItem, type Change, commit, endItem, prune, updateItem } from '../registry'
import {
  appendLines,
  endStatus,
  guessPort,
  outputPathOf,
  parseNotifications,
  parseOutput,
  taskOutput,
} from '../tasks'

const POLL_MS = 2000
const MAX_READ = 4 * 1024 * 1024
const TAIL_BYTES = '1048576'
const RUN_MS = 5000

// Each event takes one hook without a matcher per plugin; these match every event.
const ANY_START = { isInteractive: [true, false] }
const ANY_STOP = { stop_hook_active: [true, false] }

type BackgroundTask = { id: string; type: string; description?: string; command?: string }

const shellTitle = (description: string | undefined, command: string, id: string) =>
  `${(description || command).replace(/\s+/g, ' ').trim()} · ${id}`

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

async function readOutput($: EngineInterface, path: string): Promise<string | undefined> {
  return (await readWhole($, path)).text
}

// `isWhole` is false when only the file's tail was read.
async function readWhole(
  $: EngineInterface,
  path: string,
): Promise<{ text?: string; isWhole: boolean }> {
  try {
    const { size } = await $.fs.stat(path)
    if (size <= MAX_READ) return { text: String(await $.fs.read(path)), isWhole: true }
    const { stdout } = await $.process.run(['tail', '-c', TAIL_BYTES, '--', path], {
      timeoutMs: RUN_MS,
    })

    return { text: stdout, isWhole: false }
  } catch {
    return { isWhole: false }
  }
}

// ponytail: lines are counted from the file's start, so a shell whose output
// passed 4 MiB keeps the lines it had; the pane shows those.
async function keepLines($: EngineInterface, id: string, lines: string[]): Promise<void> {
  const now = await $.clock.now()
  for (;;) {
    const { value = {}, version } = await $.state.get({ plugin: 'rabe', key: 'lines' })
    const next = appendLines(value[id], lines, now)
    if (!next) return
    const { isSet } = await $.state.set(
      { plugin: 'rabe', key: 'lines' },
      { ...value, [id]: next },
      { ifVersion: version },
    )
    if (isSet) return
  }
}

function runningShells(items: RabeItem[]) {
  return items.flatMap(item => (item.kind === 'shell' && item.status === 'running' ? [item] : []))
}

async function poll($: EngineInterface): Promise<void> {
  try {
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    for (const item of runningShells(items)) {
      const { text, isWhole } = item.detail.outputPath
        ? await readWhole($, item.detail.outputPath)
        : { isWhole: false }
      if (!text) continue
      const { exitCode, ended, lines } = parseOutput(text)
      if (isWhole) await keepLines($, item.id, lines)
      const port = item.detail.port ?? guessPort(text)
      const now = await $.clock.now()
      const portAt = item.detail.portAt ?? (port ? now : undefined)
      await write($, held => {
        const next = updateItem(held, item.id, {
          detail: {
            ...(port && { port, portAt }),
            ...(exitCode !== undefined && { exitCode }),
          },
        })

        return ended ? endItem(next, item.id, ended, now) : next
      })
    }
  } catch {}
}

async function onNotifications($: EngineInterface, text: string): Promise<void> {
  const notes = parseNotifications(text).filter(one => one.status)
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  for (const one of notes) {
    const id = itemId('shell', one.taskId)
    const item = items.find(held => held.id === id)
    const path = one.outputFile ?? (item?.kind === 'shell' ? item.detail.outputPath : undefined)
    const read = item && path ? await readWhole($, path) : undefined
    if (read?.text && read.isWhole) await keepLines($, id, parseOutput(read.text).lines)
  }
  const now = await $.clock.now()
  await write($, held =>
    notes.reduce((items, one) => {
      const id = itemId('shell', one.taskId)
      const next = updateItem(items, id, {
        detail: {
          ...(one.exitCode !== undefined && { exitCode: one.exitCode }),
          ...(one.outputFile && { outputPath: one.outputFile }),
        },
      })

      return endItem(next, id, endStatus(one.status, one.exitCode), now)
    }, held),
  )
}

async function correct($: EngineInterface, tasks: readonly BackgroundTask[]): Promise<void> {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  const inFlight = new Set(tasks.map(task => task.id))
  const now = await $.clock.now()
  for (const item of runningShells(items)) {
    if (!item.detail.taskId || inFlight.has(item.detail.taskId)) continue
    // A subagent's task may be missing from the main session's list; the poll
    // ends it from the exit line of its output file.
    if (item.parentId?.startsWith('agent:')) continue
    const text = item.detail.outputPath && (await readOutput($, item.detail.outputPath))
    const { exitCode, ended = 'stopped' } = parseOutput(text || '')
    await write($, held =>
      endItem(
        updateItem(held, item.id, { detail: exitCode === undefined ? {} : { exitCode } }),
        item.id,
        ended,
        now,
      ),
    )
  }
  await write($, held =>
    tasks.reduce((next, task) => {
      const id = itemId('shell', task.id)
      // Claude Code lists a Monitor tool task as type 'shell' too.
      const known = [id, itemId('monitor', task.id)]
      if (task.type !== 'shell' || !task.command || next.some(item => known.includes(item.id))) {
        return next
      }
      const outputPath = taskOutput(items, task.id)

      return addItem(
        next,
        {
          id,
          kind: 'shell',
          title: shellTitle(task.description, task.command, task.id),
          status: 'running',
          detail: { command: task.command, taskId: task.id, ...(outputPath && { outputPath }) },
        },
        now,
      )
    }, held),
  )
}

export function shells(on: On): void {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const answer = await next(e)
    try {
      const result = answer.result as { backgroundTaskId?: string } | undefined
      const taskId = result?.backgroundTaskId
      if (e.tool === 'Bash' && taskId) {
        const now = await $.clock.now()
        const outputPath = outputPathOf(answer.text)
        await write($, held =>
          addItem(
            held,
            {
              id: itemId('shell', taskId),
              kind: 'shell',
              title: shellTitle(e.description, e.command, taskId),
              status: 'running',
              startedAt: now,
              ...(e.agentId && { parentId: itemId('agent', e.agentId) }),
              detail: { command: e.command, taskId, ...(outputPath && { outputPath }) },
            },
            now,
          ),
        )
      }
    } catch {}

    return answer
  })

  on('prompt.submit', { origin: { kind: 'task-notification' } }, async ($, e, next) => {
    try {
      await onNotifications($, e.text)
    } catch {}

    return next(e)
  })

  on('classic.Stop', ANY_STOP, async ($, e, next) => {
    try {
      if (e.background_tasks) await correct($, e.background_tasks)
    } catch {}

    return next(e)
  })

  on('session.start', ANY_START, async ($, e, next) => {
    $.clock.every(POLL_MS, () => void poll($))

    return next(e)
  })
}
