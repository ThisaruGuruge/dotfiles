import { isInside, type RabeItem } from '../../model'
import { nextRuns } from '../../schedule'
import { type Span, wrap } from '../cells/grid'
import { C, type Style } from '../cells/palette'
import { ago, clockTime, duration, tokens, usd } from '../format'
import {
  byStart,
  children,
  forwarderOf,
  kept,
  phases,
  share,
  stable,
  timeLabel,
  tokenSum,
  withForwarder,
} from '../lists'
import {
  type Action,
  canStop,
  type Drawn,
  isWorkflowAgent,
  type Line,
  type Model,
  NONE,
  type Selection,
  type View,
  type ViewButton,
  type ViewInput,
} from '../view'
import { fitLine, headLines, itemLine, text } from './lines'

const dim = { fg: C.dim }
const BRIEF_ROWS = 3

const label = (value: string): Line => ({ spans: [[`▸ ${value}`, { fg: C.blue }]] })
const width = (list: Span[]) => list.reduce((n, [one]) => n + [...one].length, 0)

// A paragraph whose first line starts with `first`; the rest indent under it.
function lead(first: Span[], value: string, columns: number, style: Style = {}): Line[] {
  const indent = width(first)

  return wrap(value || ' ', Math.max(1, columns - indent)).map((one, i) => ({
    spans: i === 0 ? [...first, [one, style]] : [[`${' '.repeat(indent)}${one}`, style]],
  }))
}

const raise = (lines: Line[]): Line[] => lines.map(line => ({ ...line, bg: C.raised }))

function turnPath(summary: string, cwd: string | undefined, width: number): string {
  const base = cwd?.replace(/[\\/]+$/, '')
  const path = base && isInside(summary, base) ? summary.slice(base.length + 1) : summary
  const chars = [...path]
  if (chars.length <= width) return path
  const left = Math.ceil((width - 1) / 2)
  const right = Math.floor((width - 1) / 2)
  return `${chars.slice(0, left).join('')}…${right ? chars.slice(-right).join('') : ''}`
}

// Spend and activity on a panel: agents and Codex jobs their own, a workflow its agents'.
// A Codex job counts the agent that only forwarded it.
function costBox(model: Model, own: RabeItem): Line[] {
  if (own.kind !== 'agent' && own.kind !== 'codex' && own.kind !== 'workflow') return []
  const item = withForwarder(own, model.items)
  const list = item.kind === 'workflow' ? children(model.items, item.id) : [item]
  const known = list.filter(one => one.tokens)
  const sum = (key: 'input' | 'output' | 'cached') =>
    known.reduce((n, one) => n + (one.tokens?.[key] ?? 0), 0)
  // one worker without a dollar amount makes the sum unknown
  const cost: Span =
    list.length && list.every(one => one.costUsd !== undefined)
      ? [`≈ ${usd(list.reduce((n, one) => n + (one.costUsd ?? 0), 0))}`, { fg: C.bright }]
      : ['cost n/a', dim]
  const cached = sum('cached')
  const tok: Span[] = known.length
    ? [
        ['   in ', dim],
        [tokens(sum('input'))],
        ['  out ', dim],
        [tokens(sum('output'))],
        ...(cached ? ([['  cached ', dim], [tokens(cached)]] as Span[]) : []),
      ]
    : [['   tokens n/a', dim]]
  const of: Span[] = [[share(model.items, item)], [' of session', dim]]
  const second: Span[] =
    item.kind === 'workflow'
      ? [[String(list.length)], [' agents', dim]]
      : item.kind === 'codex'
        ? [
            ...((item.detail.commandCount === undefined
              ? [['commands n/a  ', dim]]
              : [[String(item.detail.commandCount)], [' commands  ', dim]]) as Span[]),
            ...of,
          ]
        : of
  const at =
    item.kind === 'agent'
      ? item.detail.lastToolAt
      : item.kind === 'codex'
        ? item.detail.sessionUpdatedAt
        : undefined
  const right: Span[] =
    item.kind === 'workflow' || item.status !== 'running'
      ? []
      : at === undefined
        ? [['active n/a ', dim]]
        : [
            ['active', { fg: C.green }],
            [` ${ago(model.now - at)} `, dim],
          ]

  return [
    { spans: [[' '], cost, ...tok], bg: C.panel },
    { spans: [[' '], ...second], right, bg: C.panel },
    { spans: [] },
  ]
}

function brief(name: string, value: string | undefined, columns: number): Line[] {
  if (!value) return []
  const lines = text(value, columns, {}, '  ')
  if (lines.length > BRIEF_ROWS) {
    const last = lines[BRIEF_ROWS - 1]
    if (last) last.spans = [[`${last.spans[0]?.[0] ?? ''} …`]]
  }

  return [label(name), ...lines.slice(0, BRIEF_ROWS), { spans: [] }]
}

// What stays on top while the body scrolls: the cost panel, the brief or
// prompt, and the label of the body.
function topLines(model: Model, item: RabeItem, columns: number): Line[] {
  const box = costBox(model, item)
  switch (item.kind) {
    case 'agent':
      return [...box, ...brief('brief', item.detail.prompt || item.detail.description, columns)]
    case 'codex':
      return [...box, ...brief('prompt', item.detail.prompt, columns)]
    case 'workflow':
      return box
    case 'shell': {
      const seen = model.lines[item.id]?.seen
      return [
        label(`output · newest last${seen ? ` · ${seen} ${seen === 1 ? 'line' : 'lines'}` : ''}`),
      ]
    }
    case 'monitor':
      return [label('lines received · newest last')]
    case 'cron':
      return item.status === 'running'
        ? [label(item.detail.scheduledFor === undefined ? 'next runs' : 'fires')]
        : []
  }
}

function agentLines(model: Model, item: RabeItem, columns: number, rows = Infinity) {
  const turns = model.turns[item.id] ?? []
  if (turns.length === 0) {
    return {
      lines: [{ spans: [['Turns n/a: none seen since Rabe loaded.', dim]] } as Line],
      hidden: false,
    }
  }

  const out: Line[] = []
  let hidden = false
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]
    if (!turn) continue
    const room = rows - out.length
    if (room <= 0) {
      hidden = true
      break
    }
    const tools = turn.tools.slice(Math.max(0, turn.tools.length - room))
    const textRows = room - tools.length
    const limit = textRows * Math.max(1, columns - 5)
    const value = textRows > 0 ? turn.text : ''
    const cut = value.length > limit
    const lines = [
      ...(textRows > 0 && value
        ? lead(
            cut
              ? [['     ', dim]]
              : [
                  [String(turn.index).padEnd(3), dim],
                  ['● ', { fg: C.orange }],
                ],
            cut ? value.slice(-limit) : value,
            columns,
          )
        : []),
      ...tools.map(tool => ({
        spans: [
          [
            `     ⎿ ${tool.name} ${tool.summary ? turnPath(tool.summary, model.cwd, Math.max(8, columns - tool.name.length - 8)) : ''}`.trimEnd(),
            dim,
          ],
        ] as Span[],
      })),
    ]
    hidden ||= cut || textRows === 0 || tools.length < turn.tools.length || lines.length > room
    const shown = lines.slice(-room)
    out.unshift(...(item.status === 'running' && i === turns.length - 1 ? raise(shown) : shown))
    if (hidden) break
  }

  return { lines: out, hidden }
}

function commandLine(step: {
  text: string
  exitCode?: number
  lines?: number
  isRunning?: boolean
}): Line {
  const lines =
    step.lines === undefined ? '' : ` · ${step.lines} ${step.lines === 1 ? 'line' : 'lines'}`
  const right: Span = step.isRunning
    ? ['◐ running ', { fg: C.yellow }]
    : step.exitCode === 0
      ? [`✓ exit 0${lines} `, { fg: C.green }]
      : [`✗ exit ${step.exitCode ?? 'n/a'}${lines} `, { fg: C.red }]
  const line: Line = { spans: [['  $ ', dim], [step.text]], right: [right] }

  return step.isRunning ? { ...line, bg: C.raised } : line
}

function codexLines(item: RabeItem, columns: number): Line[] {
  if (item.kind !== 'codex') return []
  const steps = item.detail.steps ?? []
  if (steps.length === 0) {
    return [{ spans: [['Session file n/a: steps, model and commands are not known.', dim]] }]
  }

  return steps.flatMap(step =>
    step.kind === 'command'
      ? [commandLine(step)]
      : step.kind === 'reasoning'
        ? text(`thinking: ${step.text}`, columns, dim, '  ')
        : lead([['● ', { fg: C.cyan }]], step.text, columns),
  )
}

function workflowLines(model: Model, item: RabeItem, columns: number, sel?: Selection): Line[] {
  const list = phases(model.items, item)
  const mark = { done: '✓', running: '◐', failed: '✗', waiting: '·' } as const
  const out: Line[] = text(
    list.map(p => `${mark[p.state]} ${p.name}`).join(' → ') || 'phases n/a',
    columns,
  )
  for (const p of list) {
    const note = (['done', 'failed', 'running'] as const)
      .map(s => [p.agents.filter(a => a.status === s).length, s] as const)
      .filter(([n]) => n > 0)
      .map(([n, s]) => `${n} ${s}`)
      .join(' · ')
    out.push({
      spans: [
        [p.name.toUpperCase(), { fg: C.green }],
        [` ${note || 'not started'}`, dim],
      ],
    })
    for (const agent of stable(kept(p.agents, model.removed), sel?.order?.timeline, byStart)) {
      const tok = tokenSum(agent)
      out.push({
        ...itemLine(agent, model.now, agent.id === sel?.selected),
        right: [[`${tok < 0 ? 'n/a' : tokens(tok)} · ${timeLabel(agent, model.now)} `, dim]],
      })
    }
  }

  return out
}

function outputLines(model: Model, item: RabeItem): Line[] {
  const held = model.lines[item.id]?.lines ?? []
  const out: Line[] =
    held.length === 0
      ? [{ spans: [['No output yet', dim]] }]
      : held.map(line => ({
          spans:
            item.kind === 'monitor'
              ? [[`${clockTime(line.at)} `, dim], [line.text]]
              : [[line.text]],
        }))
  if (item.kind === 'shell' && item.detail.exitCode !== undefined) {
    const code = item.detail.exitCode
    out.push({
      spans: [[code === 0 ? '✓ exit 0' : `✗ exit ${code}`, { fg: code ? C.red : C.green }]],
    })
  }

  return out
}

function cronLines(model: Model, item: RabeItem): Line[] {
  if (item.kind !== 'cron' || item.status !== 'running') return []
  const { schedule, scheduledFor } = item.detail
  const runs =
    scheduledFor !== undefined ? [scheduledFor] : schedule ? nextRuns(schedule, model.now, 5) : []
  if (runs.length === 0) return [{ spans: [['Next runs n/a: the schedule is not known.', dim]] }]

  return runs.map(at => ({
    spans: [[`  ${clockTime(at).slice(0, 5)}`], [`  in ${duration(at - model.now)}`, dim]],
  }))
}

// The body of one item's detail, newest last.
export function bodyLines(model: Model, item: RabeItem, columns: number, sel?: Selection): Line[] {
  switch (item.kind) {
    case 'agent':
      return agentLines(model, item, columns).lines
    case 'codex':
      return codexLines(item, columns)
    case 'workflow':
      return workflowLines(model, item, columns, sel)
    case 'cron':
      return cronLines(model, item)
    default:
      return outputLines(model, item)
  }
}

// The split preview keeps the tail and says how many older lines it hides.
export function detailLines(
  model: Model,
  item: RabeItem,
  rows: number,
  columns: number,
  sel?: Selection,
): Line[] {
  const top = [...headLines(model, item, columns), ...topLines(model, item, columns)]
  const room = Math.max(0, rows - top.length)
  const preview = item.kind === 'agent' ? agentLines(model, item, columns, room + 1) : undefined
  const body = preview?.lines ?? bodyLines(model, item, columns, sel)
  const hasHidden = preview?.hidden || body.length > room
  const shown = Math.max(0, room - (hasHidden ? 1 : 0))
  const note = hasHidden
    ? [
        {
          spans: [
            [
              `${preview ? 'Older text hidden' : `${body.length - shown} older lines hidden`} · enter opens full detail`,
              dim,
            ],
          ] as Span[],
        },
      ]
    : []

  return [...top, ...note, ...(shown > 0 ? body.slice(-shown) : [])]
}

// A control that copies the command resuming `id`; its key names the id.
export function resumeButton(command: string, id: string): ViewButton {
  return {
    key: `resume:${id}`,
    label: 'c: copy resume',
    hotkey: 'c',
    action: { type: 'copy', text: command },
  }
}

function detailButtons(
  item: RabeItem,
  hasInput: boolean,
  items: readonly RabeItem[],
): ViewButton[] {
  const buttons: ViewButton[] = [
    {
      key: 'back',
      label: 'b: back',
      hotkey: 'b',
      autoFocus: true,
      action: { type: 'open', id: '' },
    },
  ]
  const d = item.detail as Record<string, unknown>
  const copy =
    typeof d.command === 'string'
      ? d.command
      : item.kind === 'cron'
        ? item.detail.prompt
        : undefined
  if (copy !== undefined) {
    const label = item.kind === 'cron' ? 'c: copy prompt' : 'c: copy command'
    buttons.push({
      key: `copy:${item.id}`,
      label,
      hotkey: 'c',
      action: { type: 'copy', text: copy, ...(item.kind === 'cron' && { what: 'prompt' }) },
    })
  }
  if (item.kind === 'agent') {
    buttons.push({
      key: `copy:${item.id}`,
      label: 'c: copy id',
      hotkey: 'c',
      action: { type: 'copy', text: item.detail.agentId },
    })
  }
  // The key names the thread it resumes; without a thread there is no key.
  if (item.kind === 'codex' && item.detail.threadId) {
    buttons.push(resumeButton(`codex resume ${item.detail.threadId}`, item.detail.threadId))
  }
  // The agent folded into this job has no row; its detail opens from here.
  const forwarder = forwarderOf(item, items)
  if (forwarder) {
    buttons.push({
      key: `forwarder:${forwarder.id}`,
      label: 'f: open forwarder',
      hotkey: 'f',
      action: { type: 'open', id: forwarder.id },
    })
  }
  // Ended controls keep their dim slots; the pane binds their hotkeys to NONE.
  // Each key names the item it acts on (see `listButtons` in items.ts).
  const slot = (key: string, label: string, action: Action | undefined): ViewButton =>
    action
      ? { key, label, hotkey: label.slice(0, 1), action }
      : { key, label, action: NONE, dim: true }
  if (item.kind === 'cron' && item.detail.scheduledFor === undefined) {
    buttons.push(
      slot(
        `delete:${item.id}`,
        'd: delete job',
        item.status === 'running' ? { type: 'delete', id: item.id } : undefined,
      ),
    )
  }
  if (item.kind === 'agent' && hasInput && !isWorkflowAgent(item)) {
    const isOn = item.status === 'running'
    buttons.push(
      slot(
        `message-agent:${item.id}`,
        'm: message',
        isOn ? { type: 'focus', key: `message:${item.id}` } : undefined,
      ),
    )
  }
  const run = isWorkflowAgent(item)
    ? items.find(one => one.id === item.parentId && one.kind === 'workflow')
    : item.kind === 'workflow'
      ? item
      : undefined
  if (run) {
    buttons.push(
      slot(
        `stop-run:${run.id}`,
        'g: stop run',
        canStop(run) ? { type: 'stop', ids: [run.id] } : undefined,
      ),
    )
  } else if (item.kind !== 'cron' && !isWorkflowAgent(item)) {
    buttons.push(
      slot(
        `stop:${item.id}`,
        'x: stop',
        canStop(item) ? { type: 'stop', ids: [item.id] } : undefined,
      ),
    )
  }

  return buttons
}

// One item in full, in place of the list.
export const detailView: View = (model, size, sel): Drawn => {
  const item = model.items.find(one => one.id === sel.open)
  if (!item) return { nodes: [], buttons: [] }
  const shown = [
    ...headLines(model, item, size.columns),
    ...topLines(model, item, size.columns),
    ...bodyLines(model, item, size.columns, sel),
  ]
  const inputs: ViewInput[] =
    item.kind === 'agent' && item.status === 'running' && size.hasInput && !isWorkflowAgent(item)
      ? [
          {
            key: `message:${item.id}`,
            label: 'message',
            placeholder: 'text for the agent',
            submitLabel: 'send',
            action: value => ({ type: 'message', id: item.id, text: value }),
          },
        ]
      : []

  return {
    nodes: shown.map(line => fitLine(line, size.columns)),
    buttons: detailButtons(item, size.hasInput, model.items),
    inputs,
  }
}
