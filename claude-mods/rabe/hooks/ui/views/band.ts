import { grid, type Span, spans } from '../cells/grid'
import { C, CHIP } from '../cells/palette'
import { type BandRow, bandRows, costLine, kept } from '../lists'
import type { View } from '../view'

// The one-line band names each count: [one, more].
const COUNT: Record<BandRow['kind'], [string, string]> = {
  agent: ['claude', 'claude'],
  codex: ['codex', 'codex'],
  workflow: ['workflow', 'workflows'],
  shell: ['shell', 'shells'],
  monitor: ['monitor', 'monitors'],
  cron: ['cron', 'cron'],
}

const SHORT: Record<BandRow['kind'], [string, string]> = {
  agent: ['agent', 'agent'],
  codex: ['codex', 'codex'],
  workflow: ['flow', 'flow'],
  shell: ['shell', 'shell'],
  monitor: ['mon', 'mon'],
  cron: ['cron', 'cron'],
}

const cost = (parts: string[], leading = ''): Span[] => [
  [`${leading}${parts[0] ?? ''}`, { fg: C.bright }],
  [parts.length > 1 ? ` · ${parts.slice(1).join(' · ')}` : '', { fg: C.dim }],
]

// The band above the prompt: one line of count chips with the cost, under one
// empty row when `maxRows` leaves room for it.
export const bandView: View = (model, size) => {
  const rows = bandRows(kept(model.items, model.removed), model.now)
  const money = costLine(model.items, model.usd)?.split(' · ')
  const top = size.rows >= 2 ? 1 : 0
  const g = grid(size.columns, top + 1)
  const chips = (names: typeof COUNT) =>
    rows.flatMap((row): Span[] => {
      const n = row.count
      const label = names[row.kind][n === 1 ? 0 : 1]
      return [
        [` ${row.glyph} ${n} ${row.failed ? `${label} failed` : label} `, CHIP[row.kind]],
        [' '],
      ]
    })
  const full = [...chips(COUNT), ...(money ? cost(money.slice(0, 2)) : [])]
  const short = [...chips(SHORT), ...(money ? cost(money.slice(0, 2)) : [])]
  const width = (parts: Span[]) => parts.reduce((n, [text]) => n + [...text].length, 0)
  const layout =
    width(full) <= size.columns
      ? full
      : width(short) <= size.columns
        ? short
        : [...(money ? cost(money.slice(0, 1), ' ') : []), ...chips(SHORT)]
  spans(g, 0, top, layout)

  return { nodes: [{ chart: g }], buttons: [] }
}
