import type { RabeItem } from '../../model'
import { bar, fit } from '../cells/grid'
import { C, CHIP, type Style, tone } from '../cells/palette'
import { duration, short, tokens, usd } from '../format'
import {
  byTokens,
  cost,
  glyph,
  kept,
  shown,
  stable,
  tokenSum,
  totals,
  withForwarder,
} from '../lists'
import type { Drawn, Line, Model, View } from '../view'
import { resumeButton } from './detail'
import { fitLine, focusOn } from './lines'

const dim = { fg: C.dim }
const LONG_TOOL = 2 * 60_000
const STUCK = 5 * 60_000
// TOKENS, COST and TIME, right-aligned.
const RIGHT = 8 + 9 + 7

function barStyle(item: RabeItem): Style {
  if (item.status === 'failed') return { fg: C.red }
  if (item.status === 'done') return { fg: C.green }
  if (item.status === 'stopped') return dim

  return { fg: CHIP[item.kind].fg }
}

function workerLine(
  item: RabeItem,
  max: number,
  now: number,
  nameWidth: number,
  barWidth: number,
  isSelected: boolean,
): Line {
  const tok = tokenSum(item)
  const time = item.startedAt === undefined ? 'n/a' : short((item.endedAt ?? now) - item.startedAt)
  const blocks = tok < 0 ? '▏'.padEnd(barWidth) : bar(tok, max, barWidth)
  const name = fit(item.title, nameWidth - 3).trimEnd()

  return {
    spans: [
      [isSelected ? '▌' : ' ', { fg: C.orange }],
      [glyph(item), { fg: tone(item) }],
      [' '],
      {
        key: `row:${item.id}`,
        label: name,
        action: { type: 'open', id: item.id },
        ...(!isSelected && { dim: true }),
      },
      [' '.repeat(nameWidth - 3 - [...name].length)],
      [barWidth ? ` ${blocks}` : '', tok < 0 ? dim : barStyle(item)],
      [(tok < 0 ? 'n/a' : tokens(tok)).padStart(8), tok < 0 ? dim : {}],
      [cost(item.costUsd).padStart(9), item.costUsd === undefined ? dim : {}],
      [time.padStart(7)],
    ],
    ...(isSelected && { bg: C.selected }),
  }
}

const note = (label: string, chip: Style, title: string, why: string): Line => ({
  spans: [[` ${label} `, chip], [` ${title}`], [` · ${why}`, dim]],
})

// Running agents that look slow: a tool call open for a while, or no step at all.
function loadLines(model: Model): Line[] {
  const out: Line[] = []
  for (const item of model.items) {
    if (item.kind !== 'agent' || item.status !== 'running') continue
    const last = model.turns[item.id]?.at(-1)
    const since = last?.at ?? item.startedAt
    if (since === undefined) continue
    const idle = model.now - since
    const tool = last?.tools.at(-1)
    if (tool && idle >= LONG_TOOL) {
      out.push(note('◷ long tool', CHIP.cost, item.title, `in ${tool.name} for ${duration(idle)}`))
    } else if (!tool && idle >= STUCK) {
      out.push(note('⚠ stuck', CHIP.shell, item.title, `no step for ${short(idle)}`))
    }
  }

  return out.length ? out : [{ spans: [[' Nothing looks stuck.', dim]] }]
}

// The Cost tab: the session's cost and totals, the workers by tokens with a
// bar each, and the agents that look slow. While the pane is open the order
// is held (`stable`), so a row does not move as its tokens grow.
export const costView: View = (model, size, sel): Drawn => {
  const sum = totals(model.items)
  const running = model.items.filter(item => item.status === 'running').length
  // An agent that only forwarded to Codex counts in its job's row.
  const workers = kept(shown(model.items), model.removed)
    .filter(item => item.kind === 'agent' || item.kind === 'codex')
    .map(item => withForwarder(item, model.items))
  const list = stable(workers, sel.order?.cost, byTokens)
  const selected = list.find(item => item.id === sel.selected) ?? list[0]
  const nameWidth = Math.max(12, Math.min(36, size.columns - RIGHT - 12))
  const room = size.columns - nameWidth - RIGHT - 1
  const barWidth = room >= 4 ? room : 0
  const max = Math.max(1, ...list.map(tokenSum))
  const session = model.usd === undefined ? 'session cost n/a' : `≈ ${usd(model.usd)} session`
  const sortLabel = sel.order?.cost ? 'tokens when opened' : 'tokens'
  const totalsHead: Line['spans'] = [[` ${session} `, { fg: C.bright }]]
  if (model.items.some(item => item.kind === 'agent')) {
    totalsHead.push([' claude ', dim], [cost(sum.claude), { fg: C.orange }])
  }
  if (model.items.some(item => item.kind === 'codex')) {
    totalsHead.push(['  codex ', dim], [cost(sum.codex), { fg: C.cyan }])
  }
  const head: Line[] = [
    {
      bg: C.panel,
      spans: [
        ...totalsHead,
        ['  tokens ', dim],
        [tokens(sum.tokens), { fg: C.bright }],
        ['  running ', dim],
        [String(running), { fg: C.yellow }],
        [sum.unknown ? `  ${sum.unknown} n/a` : '', dim],
      ],
    },
    { spans: [[` session ${model.sessionId ?? 'n/a'}`, dim]] },
    { spans: [[`by worker · sorted by ${sortLabel}`, dim]] },
    {
      spans: [
        [
          `${fit('  NAME', nameWidth)}${' '.repeat(barWidth ? barWidth + 1 : 0)}${'TOKENS'.padStart(8)}${'COST'.padStart(9)}${'TIME'.padStart(7)}`,
          dim,
        ],
      ],
    },
  ]
  const free = model.items.some(
    item => item.kind === 'shell' || item.kind === 'monitor' || item.kind === 'cron',
  )
  const after: Line[] = [
    ...(free ? [{ spans: [[' shells, monitors and cron jobs use no tokens', dim]] } as Line] : []),
    { spans: [] },
    { spans: [['LOAD', { fg: C.bright }]] },
    ...loadLines(model),
  ]
  const rows: Line[] = list.length
    ? list.map(item => workerLine(item, max, model.now, nameWidth, barWidth, item === selected))
    : [{ spans: [[' No agent or Codex job yet.', dim]] }]
  const isGone = model.items.some(item => item.kind === 'codex' && item.detail.isSessionMissing)
  const foot = ['session cost as /cost totals it', isGone && 'n/a: a Codex session file is gone']
  const lines = [
    ...head,
    ...focusOn(rows, selected?.id ?? ''),
    ...after,
    { spans: [] },
    { spans: [[foot.filter(Boolean).join(' · '), dim]] } as Line,
  ]

  const id = model.sessionId
  const buttons = id ? [resumeButton(`claude --resume ${id}`, id)] : []

  return { nodes: lines.map(line => fitLine(line, size.columns)), buttons }
}
