import type { RabeWindow } from '../../../types'
import type { RabeItem } from '../../model'
import { nextRun } from '../../schedule'
import { fit } from '../cells/grid'
import { C, CHIP, type Style, tone } from '../cells/palette'
import { clockTime, day, duration, tokens, usd } from '../format'
import {
  bar,
  byStart,
  forwarderOf,
  glyph,
  KIND_LABEL,
  kept,
  nameSpans,
  shown,
  stable,
  tree,
} from '../lists'
import type { Drawn, Line, Model, View, ViewButton } from '../view'
import { resumeButton } from './detail'
import { beside, fitLine, focusOn, text } from './lines'

const dim = { fg: C.dim }
const BOX = 40
const SIDE_COLUMNS = 90

const LEGEND: [string, Style][] = [
  ['shell', CHIP.shell],
  ['claude', CHIP.agent],
  ['codex', CHIP.codex],
  ['monitor', CHIP.monitor],
  ['scheduled run', CHIP.cron],
  ['done', CHIP.done],
  ['failed', CHIP.failed],
]

const COUNTS: [RabeItem['kind'], string, string][] = [
  ['agent', 'agent', 'agents'],
  ['codex', 'codex', 'codex'],
  ['workflow', 'workflow', 'workflows'],
  ['shell', 'shell', 'shells'],
  ['monitor', 'monitor', 'monitors'],
]

function color(item: RabeItem): number {
  if (item.status === 'failed') return C.red
  if (item.status === 'done') return C.green
  if (item.status === 'stopped') return C.dim

  return CHIP[item.kind].fg
}

// One cell per slice of the window: a bar over the run, or for a cron job a
// tick at each scheduled run since Rabe saw it (jitter not counted).
// What began before the window starts with `◂` at the left edge.
function track(item: RabeItem, start: number, now: number, width: number): string {
  const out = cells(item, start, now, width)

  return (item.startedAt ?? item.seenAt) < start ? `◂${out.slice(1)}` : out
}

function cells(item: RabeItem, start: number, now: number, width: number): string {
  if (item.kind !== 'cron') {
    return bar(item.startedAt ?? item.seenAt, item.endedAt ?? now, start, now, width)
  }
  const cells = Array<string>(width).fill(' ')
  const schedule = item.detail.schedule
  const span = Math.max(1, now - start)
  const end = Math.min(now, item.endedAt ?? now)
  let at = schedule ? nextRun(schedule, Math.max(start, item.startedAt ?? item.seenAt)) : undefined
  for (let n = 0; at !== undefined && at <= end && n < width; n++) {
    cells[Math.min(width - 1, Math.floor(((at - start) / span) * width))] = '█'
    at = nextRun(schedule as string, at)
  }

  return cells.join('')
}

function treeLines(items: RabeItem[]): Line[] {
  return [
    {
      spans: [
        ['WHO STARTED WHAT?', { fg: C.bright }],
        ['  agents and their children', dim],
      ],
    },
    { spans: [['main session']] },
    ...tree(items).map(
      (line): Line => ({
        spans: [
          [line.prefix, dim],
          [`${glyph(line.item)} `, { fg: tone(line.item) }],
          [line.item.title],
          [line.item.kind === 'agent' ? '' : ` (${KIND_LABEL[line.item.kind]})`, dim],
        ],
      }),
    ),
  ]
}

function previousLines(model: Model, width: number): Line[] {
  const prev = model.previous
  const head: Line = { spans: [[' PREVIOUS SESSION', { fg: C.bright }]] }
  if (!prev) {
    return [
      head,
      ...text('No earlier session with background work in this project.', width, dim, ' '),
    ]
  }
  const counts = COUNTS.flatMap(([kind, one, many]) => {
    const n = prev.counts[kind] ?? 0
    return n ? [`${n} ${n === 1 ? one : many}`] : []
  })
  const crons = prev.counts.cron ?? 0
  const took = prev.startedAt === undefined ? '' : ` · ${duration(prev.endedAt - prev.startedAt)}`
  const failed = prev.failed
    .slice(0, 2)
    .map((title): Line => ({ spans: [[' ✗ failed', { fg: C.red }], [` ${title}`]] }))
  const more = prev.failed.length - failed.length

  const out: Line[] = [
    head,
    { spans: [[` this project · ended ${day(prev.endedAt, model.now)}`, dim]] },
    { spans: [[' ✓', { fg: C.green }], [` ${counts.join(' · ') || 'no items'}`]] },
    {
      spans: [
        [' session ', dim],
        [prev.usd === undefined ? 'cost n/a' : `≈ ${usd(prev.usd)}`, { fg: C.bright }],
        [took, dim],
      ],
    },
    { spans: [[` background ${tokens(prev.tokens)} tok`, dim]] },
    ...failed,
    ...(more ? [{ spans: [[` +${more} more failed`, dim]] } as Line] : []),
    ...(crons
      ? [
          {
            spans: [
              [' ⟳', { fg: C.purple }],
              [` ${crons} cron job${crons === 1 ? '' : 's'} ended with the session`, dim],
            ],
          } as Line,
        ]
      : []),
    { spans: [[` id ${prev.sessionId ?? 'n/a'}`, dim]] },
  ]

  return out.map(line => ({ ...line, bg: C.raised }))
}

const MIN = 60_000
const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440].map(one => one * MIN)

// The time axis: round clock times, at most four, spaced for the window, then
// `now`. A label that would repeat the one before it, run into it or into
// `now` is left out.
function axis(start: number, span: number, labelWidth: number, columns: number): string {
  const barWidth = columns - labelWidth
  const cells = Array<string>(columns).fill(' ')
  const put = (x: number, value: string) => {
    ;[...value].forEach((ch, i) => {
      if (x + i >= 0 && x + i < columns) cells[x + i] = ch
    })
  }
  const step = STEPS.find(one => span / one <= 4) ?? (STEPS.at(-1) as number)
  // Round in local time: the zone's offset from UTC at the start.
  const offset = new Date(start).getTimezoneOffset() * MIN
  let last = ''
  let end = labelWidth
  for (let at = Math.ceil((start - offset) / step) * step + offset; at < start + span; at += step) {
    const label = clockTime(at).slice(0, 5)
    const x = labelWidth + Math.round((barWidth * (at - start)) / span) - 2
    if (label === last || x < end || x + label.length > columns - 4) continue
    put(x, label)
    last = label
    end = x + label.length + 1
  }
  if (!last && labelWidth + 5 <= columns - 4) put(labelWidth, clockTime(start).slice(0, 5))
  put(columns - 3, 'now')

  return cells.join('')
}

const HOUR = 3_600_000
const DEFAULT_HOURS = 4
const WIDE_HOURS = 12

// The option `timelineHours`: hours, 0 for no limit; anything else the default.
export function hoursOf(value: unknown): number {
  const hours = typeof value === 'string' && value.trim() ? Number(value) : value
  return typeof hours === 'number' && Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_HOURS
}

// The window `/rabe` opens with: the last `base` hours, or the whole session.
export const windowOf = (base: number, now: number): RabeWindow => ({
  base,
  hours: base,
  since: base > 0 ? now - base * HOUR : 0,
})

const steps = (base: number) => [base, ...(base < WIDE_HOURS ? [WIDE_HOURS] : []), 0]

const next = (w: RabeWindow) => {
  const list = steps(w.base)
  return list[(list.indexOf(w.hours) + 1) % list.length] ?? 0
}

// The next window `w` steps to: base hours, 12 hours, the whole session, then
// base again. A wider one never starts later than the one before.
export function widen(w: RabeWindow, now: number): RabeWindow {
  const hours = next(w)
  if (hours === 0) return { ...w, hours, since: 0 }
  const since = now - hours * HOUR

  return { ...w, hours, since: w.hours === 0 || hours < w.hours ? since : Math.min(w.since, since) }
}

const spanText = (ms: number) => (ms < 2 * HOUR ? `${Math.round(ms / 60_000)} min` : duration(ms))

// The Timeline tab: a bar per item over the window with a legend and a time
// axis, then the tree of who started what beside (or above) the previous
// session in this project. The rows keep the order the pane opened with.
// Items that ended before the window (`sel.window`) fold into one line of
// plain text, so the rows' focus order stays; `w` widens the window.
export const timelineView: View = (model, size, sel): Drawn => {
  const since = sel.window?.since ?? 0
  const all = stable(kept(shown(model.items), model.removed), sel.order?.timeline, byStart)
  const list = all.filter(item => item.status === 'running' || (item.endedAt ?? since) >= since)
  const folded = all.length - list.length
  const selected = list.find(item => item.id === sel.selected) ?? list[0]
  const start = Math.max(
    since,
    Math.min(model.now - 60_000, ...list.map(item => item.startedAt ?? item.seenAt)),
  )
  const span = model.now - start
  const labelWidth = Math.min(24, Math.floor(size.columns / 3))
  const barWidth = size.columns - labelWidth
  const isSide = size.columns >= SIDE_COLUMNS
  const bars: Line[] = list.length
    ? list.map(item => {
        const name = fit(
          nameSpans(item)
            .map(([one]) => one)
            .join(''),
          labelWidth - 2,
        ).trimEnd()
        return {
          spans: [
            [item === selected ? '▌' : ' ', { fg: C.orange }],
            {
              key: `row:${item.id}`,
              label: name,
              action: { type: 'open', id: item.id },
              ...(item !== selected && { dim: true }),
            },
            [' '.repeat(labelWidth - 2 - [...name].length + 1)],
            [track(item, start, model.now, barWidth), { fg: color(item) }],
          ],
          ...(item === selected && { bg: C.selected }),
        }
      })
    : folded
      ? []
      : [{ spans: [[' Nothing ran yet.', dim]] }]
  const fold: Line[] = folded
    ? [
        {
          spans: [
            [
              ` +${folded} older item${folded === 1 ? '' : 's'}, ended before ${day(since, model.now).replace(/^today /, '')}`,
              dim,
            ],
          ],
        },
      ]
    : []
  // a forwarder has no row, but stays in the tree above its job
  const who = treeLines(
    model.items.filter(
      item => list.includes(item) || list.some(one => forwarderOf(one, model.items) === item),
    ),
  )
  const prev = previousLines(model, isSide ? BOX : size.columns)
  const below = isSide
    ? beside(who, size.columns - BOX - 2, [['  ']], prev, BOX)
    : [...who, { spans: [] }, ...prev].map(line => fitLine(line, size.columns))
  const lines: Line[] = [
    {
      spans: [
        ['WHEN DID THINGS RUN?', { fg: C.bright }],
        [`  this session, last ${spanText(span)}`, dim],
      ],
    },
    { spans: LEGEND.flatMap(([label, chip]) => [[` ${label} `, chip], [' ']]) },
    { spans: [] },
    { spans: [[axis(start, span, labelWidth, size.columns), dim]] },
    ...fold,
    ...focusOn(bars, selected?.id ?? ''),
    { spans: [] },
  ]
  const w = sel.window
  const buttons: ViewButton[] =
    w && w.base > 0
      ? [
          {
            key: 'window',
            label: `w: show ${next(w) ? `${next(w)} h` : 'all'}`,
            hotkey: 'w',
            action: { type: 'window' },
          },
        ]
      : []

  const id = model.previous?.sessionId
  if (id) buttons.push(resumeButton(`claude --resume ${id}`, id))

  return { nodes: [...lines.map(line => fitLine(line, size.columns)), ...below], buttons }
}
