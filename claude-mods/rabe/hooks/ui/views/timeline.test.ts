import { expect, test } from 'claude-code/testing'

import type { RabePrevious } from '../../../types'
import type { RabeItem } from '../../model'
import { cell, lines } from '../cells/grid'
import { C, CHIP } from '../cells/palette'
import { ALL, babysit, dev, gridOf, lint, NOW, plan, review } from '../fixtures'
import { isPress, type Model, NO_SELECTION, rowKeys, type Size } from '../view'
import { hoursOf, timelineView, widen, windowOf } from './timeline'

const SIZE: Size = { columns: 100, rows: 40, surface: 'terminal', hasInput: false }
const MODEL: Model = { items: ALL, turns: {}, lines: {}, now: NOW }

const yesterday = new Date(2026, 9, 7, 17, 40).getTime()
const PREVIOUS: RabePrevious = {
  endedAt: yesterday,
  startedAt: yesterday - 72 * 60_000,
  counts: { agent: 6, codex: 2, shell: 4, cron: 1 },
  tokens: 800_000,
  usd: 0.32,
  failed: ['migrate.ts agent'],
}

const find = (shown: string[], text: string) => shown.findIndex(line => line.includes(text))

test('the timeline heads with the window, a color legend and a time axis', () => {
  const { grid } = gridOf(timelineView(MODEL, SIZE, NO_SELECTION))
  const shown = lines(grid)
  expect(shown[0]).toBe('WHEN DID THINGS RUN?  this session, last 40 min')
  expect(shown[1]).toBe(' shell   claude   codex   monitor   scheduled run   done   failed')
  expect(cell(grid, 1, 1)).toEqual(['s'.codePointAt(0), CHIP.shell.fg, CHIP.shell.bg])
  expect(cell(grid, 9, 1)).toEqual(['c'.codePointAt(0), CHIP.agent.fg, CHIP.agent.bg])
  expect(shown[3]).toMatch(/^ +10:20 +10:30 +10:40 +now$/)
  expect(shown[3]?.length).toBe(100)
})

// A short window drew the same minute twice (`14:44  14:44`): the labels
// sit on round times spaced for the window, each one once.
test('the time axis names each clock time once, in order, before now', () => {
  for (const seconds of [61, 75, 90, 130, 200, 299, 600, 2400, 7300, 30_000]) {
    for (const columns of [40, 60, 100, 160]) {
      for (const at of [0, 5_000, 35_000]) {
        const now = NOW + at
        const items = [{ ...dev, startedAt: now - seconds * 1000 }]
        const model = { ...MODEL, items, now }
        const axis = lines(gridOf(timelineView(model, { ...SIZE, columns }, NO_SELECTION)).grid)[3]
        const labels = axis?.match(/\d\d:\d\d/g) ?? []
        const shown = [seconds, columns, at, axis]
        expect([...shown, new Set(labels).size]).toEqual([...shown, labels.length])
        expect([...shown, [...labels].sort()]).toEqual([...shown, labels])
        expect([...shown, axis?.trimEnd().endsWith(' now')]).toEqual([...shown, true])
      }
    }
  }
})

test('a short timeline shows its start even when no round clock label fits', () => {
  const now = new Date(2026, 9, 10, 6, 40).getTime()
  for (const columns of [40, 60, 100, 160]) {
    for (const items of [[], [{ ...dev, startedAt: undefined, seenAt: now }]]) {
      for (const window of [undefined, windowOf(4, now)]) {
        const model = { ...MODEL, items, now }
        const size = { ...SIZE, columns }
        const sel = { ...NO_SELECTION, window }
        const axis = lines(gridOf(timelineView(model, size, sel)).grid)[3]
        expect(axis?.trim()).toMatch(/^06:39 +now$/)
        expect(axis?.length).toBe(columns)
      }
    }
  }
})

test('each item gets a bar over its run, colored by kind while it runs, then by its end', () => {
  const { grid } = gridOf(timelineView(MODEL, SIZE, NO_SELECTION))
  const shown = lines(grid)
  const first = find(shown, 'bun run dev')
  expect(first).toBe(4)
  expect(shown[first]).toMatch(/^▌bun run dev :5173 +█+$/)
  expect(cell(grid, 0, first)[2]).toBe(C.selected)
  expect(cell(grid, 99, first)[1]).toBe(CHIP.shell.fg)
  const failed = find(shown, 'bun run lint')
  expect(cell(grid, 99, failed)[1]).toBe(C.red)
  expect(cell(grid, 99, failed)[0]).toBe(' '.codePointAt(0))
  const done = find(shown, ' Plan auth split')
  const x = shown[done]?.indexOf('█') ?? -1
  expect(cell(grid, x, done)[1]).toBe(C.green)
})

test('a long name is cut and keeps a space before its bar', () => {
  const long = { ...dev, title: 'python3 -u -m http.server 4173', startedAt: NOW - 39 * 60_000 }
  const shown = lines(gridOf(timelineView({ ...MODEL, items: [long] }, SIZE, NO_SELECTION)).grid)
  expect(shown[4]).toMatch(/^▌python3 -u -m http\.se… █+$/)
})

test('a cron job draws schedule ticks even without observed runs', () => {
  const { grid } = gridOf(timelineView(MODEL, SIZE, NO_SELECTION))
  const shown = lines(grid)
  const at = find(shown, babysit.title)
  const ticks = (shown[at]?.match(/█/g) ?? []).length
  expect(ticks).toBe(6)
  expect(cell(grid, shown[at]?.indexOf('█') ?? 0, at)[1]).toBe(CHIP.cron.fg)
})

test('a deleted cron job draws no ticks after it ended', () => {
  const stopped = { ...babysit, status: 'stopped' as const, endedAt: NOW - 16 * 60_000 }
  const model = { ...MODEL, items: ALL.map(item => (item === babysit ? stopped : item)) }
  const shown = lines(gridOf(timelineView(model, SIZE, NO_SELECTION)).grid)
  const at = find(shown, babysit.title)
  expect((shown[at]?.match(/█/g) ?? []).length).toBe(3)
})

test('each bar row is a Button that opens it, in the order the pane opened with', () => {
  const sel = { ...NO_SELECTION, tab: 'timeline' as const, selected: babysit.id }
  const drawn = gridOf(timelineView(MODEL, SIZE, sel))
  expect(drawn.buttons).toEqual([])
  const rows = drawn.nodes.flatMap(node => ('spans' in node ? node.spans.filter(isPress) : []))
  const own = rows.find(one => one.key === `row:${babysit.id}`)
  expect(own).toMatchObject({ label: babysit.title, autoFocus: true })
  expect(own?.action).toEqual({ type: 'open', id: babysit.id })
  const held = timelineView(MODEL, SIZE, { ...sel, order: { timeline: [plan.id] } })
  expect(rowKeys(held)[0]).toBe(`row:${plan.id}`)
})

test('who started what sits beside the previous session on a wide pane', () => {
  const { grid } = gridOf(timelineView({ ...MODEL, previous: PREVIOUS }, SIZE, NO_SELECTION))
  const shown = lines(grid)
  const head = find(shown, 'WHO STARTED WHAT?')
  expect(shown[head]).toMatch(/^WHO STARTED WHAT\? {2}agents and their children +PREVIOUS SESSION$/)
  expect(shown[head + 1]).toMatch(/^main session +this project · ended yesterday 17:40$/)
  expect(shown[head + 2]).toMatch(/├─ ◐ Explore verifyToken +✓ 6 agents · 2 codex · 4 shells$/)
  expect(shown[head + 3]).toMatch(/├─ ✓ Plan auth split +session ≈ \$0\.32 · 1h12m$/)
  expect(shown[head + 4]).toMatch(/├─ ◐ review auth\.ts \(codex\) +background 800k tok$/)
  expect(shown[head + 5]).toMatch(/├─ ▶ bun run dev \(shell\) +✗ failed migrate\.ts agent$/)
  expect(shown.some(line => / {2}⟳ 1 cron job ended with the session$/.test(line))).toBe(true)
  expect(shown.some(line => /^└─ ⧉ review-changes \(workflow\)$/.test(line))).toBe(true)
  expect(shown.some(line => /^ {3}└─ ✓ review:bugs$/.test(line))).toBe(true)
  expect(cell(grid, 60, head)[2]).toBe(C.raised)
})

test('on a narrow pane the previous session follows the tree; without one it says so', () => {
  const size = { ...SIZE, columns: 60, rows: 60 }
  const { grid } = gridOf(timelineView(MODEL, size, NO_SELECTION))
  const shown = lines(grid)
  expect(grid.columns).toBe(60)
  const prev = find(shown, 'PREVIOUS SESSION')
  expect(prev).toBeGreaterThan(find(shown, 'review:bugs'))
  expect(shown[prev + 1]).toBe(' No earlier session with background work in this project.')
})

// The cost and duration are the whole session's, the tokens only the
// background items': each line names its scope (#46).
test('the previous session names the scope of its cost and its tokens', () => {
  const size = { ...SIZE, columns: 60, rows: 60 }
  const unknown = { ...PREVIOUS, usd: undefined, startedAt: undefined }
  const shown = lines(
    gridOf(timelineView({ ...MODEL, previous: unknown }, size, NO_SELECTION)).grid,
  )
  const prev = find(shown, 'PREVIOUS SESSION')
  expect(shown[prev + 3]).toBe(' session cost n/a')
  expect(shown[prev + 4]).toBe(' background 800k tok')
})

test('the timeline draws every bar; the pane scrolls what is below its body', () => {
  const sel = { ...NO_SELECTION, selected: lint.id }
  const { grid } = gridOf(timelineView(MODEL, { ...SIZE, columns: 72, rows: 14 }, sel))
  expect(lines(grid).some(line => line.startsWith('▌bun run lint'))).toBe(true)
  expect(lines(grid)).toContain('WHO STARTED WHAT?  agents and their children')
})

test('the previous session names its id, and c copies the command that resumes it', () => {
  const sessionId = '5f1c0d2e-7a7b-4c1d-9e2f-0123456789ab'
  const drawn = timelineView({ ...MODEL, previous: { ...PREVIOUS, sessionId } }, SIZE, NO_SELECTION)
  const shown = lines(gridOf(drawn).grid)
  expect(shown[find(shown, ' id ')]).toMatch(new RegExp(` id ${sessionId}$`))
  expect(drawn.buttons).toEqual([
    {
      key: `resume:${sessionId}`,
      label: 'c: copy resume',
      hotkey: 'c',
      action: { type: 'copy', text: `claude --resume ${sessionId}` },
    },
  ])
  const old = timelineView({ ...MODEL, previous: PREVIOUS }, SIZE, NO_SELECTION)
  const before = lines(gridOf(old).grid)
  expect(before[find(before, ' id ')]).toMatch(/ id n\/a$/)
  expect(old.buttons).toEqual([])
})

const H = 3_600_000
const WINDOW = { base: 4, hours: 4, since: NOW - 4 * H }
const old = {
  ...plan,
  id: 'agent:old',
  title: 'old plan',
  seenAt: NOW - 6 * H,
  startedAt: NOW - 6 * H,
  endedAt: NOW - 5 * H,
} as RabeItem
const older = { ...old, id: 'agent:older', title: 'older plan' } as RabeItem
const long = { ...dev, id: 'shell:long', title: 'long serve', seenAt: NOW - 6 * H } as RabeItem

test('a short session inside the window draws as before', () => {
  const shown = lines(gridOf(timelineView(MODEL, SIZE, { ...NO_SELECTION, window: WINDOW })).grid)
  expect(shown[0]).toBe('WHEN DID THINGS RUN?  this session, last 40 min')
  expect(shown[4]).toMatch(/^▌bun run dev :5173 +█+$/)
})

test('items that ended before the window fold into one line; a long bar is cut with a marker', () => {
  const model = { ...MODEL, items: [old, older, long, dev] }
  const drawn = gridOf(timelineView(model, SIZE, { ...NO_SELECTION, window: WINDOW }))
  const shown = lines(drawn.grid)
  expect(shown[0]).toBe('WHEN DID THINGS RUN?  this session, last 4h00m')
  expect(shown[4]).toBe(' +2 older items, ended before 06:52')
  expect(rowKeys(drawn)).toEqual([`row:${long.id}`, `row:${dev.id}`])
  expect(shown[5]).toMatch(/^▌long serve :5173 +◂█+$/)
  expect(shown.some(line => line.includes('old plan') || line.includes('older plan'))).toBe(false)
  const one = lines(
    gridOf(timelineView({ ...model, items: [old] }, SIZE, { ...NO_SELECTION, window: WINDOW }))
      .grid,
  )
  expect(one[4]).toBe(' +1 older item, ended before 06:52')
  expect(one.some(line => line.includes('Nothing ran yet.'))).toBe(false)
  const all = lines(gridOf(timelineView(model, SIZE, NO_SELECTION)).grid)
  expect(all.some(line => line.includes('old plan'))).toBe(true)
})

test('w widens the window for the open pane: 4 h, 12 h, the whole session, and back', () => {
  const at = (window?: typeof WINDOW) =>
    timelineView(MODEL, SIZE, { ...NO_SELECTION, window }).buttons
  expect(at(WINDOW)).toEqual([
    { key: 'window', label: 'w: show 12 h', hotkey: 'w', action: { type: 'window' } },
  ])
  const wide = widen(WINDOW, NOW + 60_000)
  expect(wide).toEqual({ base: 4, hours: 12, since: NOW + 60_000 - 12 * H })
  const all = widen(wide, NOW)
  expect(all).toEqual({ base: 4, hours: 0, since: 0 })
  expect(at(all)[0]?.label).toBe('w: show 4 h')
  expect(widen(all, NOW)).toEqual(windowOf(4, NOW))
  expect(widen({ base: 12, hours: 12, since: 5 }, NOW)).toEqual({ base: 12, hours: 0, since: 0 })
  expect(at(windowOf(0, NOW))).toEqual([])
  expect(at()).toEqual([])
})

test('widening never starts the window later than it started', () => {
  expect(widen(windowOf(4, NOW - 10 * H), NOW).since).toBe(NOW - 14 * H)
})

test('the option is a number of hours, 0 for no limit; anything else is 4', () => {
  expect([4, 12, 0, 1.5, '6'].map(hoursOf)).toEqual([4, 12, 0, 1.5, 6])
  expect([-1, 'x', true, undefined, Number.NaN].map(hoursOf)).toEqual([4, 4, 4, 4, 4])
})

// Issue #13: a removed item has no row on the timeline.
test('a removed item has no row on the timeline', () => {
  const drawn = gridOf(timelineView({ ...MODEL, removed: [plan.id] }, SIZE, NO_SELECTION))
  expect(rowKeys(drawn)).not.toContain(`row:${plan.id}`)
  expect(rowKeys(drawn)).toContain(`row:${dev.id}`)
  expect(lines(drawn.grid).some(line => line.includes(plan.title))).toBe(false)
})

// The rows fold a forwarder into its Codex job, but who started what keeps
// it, with its job under it.
test('who started what keeps a forwarder above its Codex job', () => {
  const call = { at: NOW - 60_000, command: 'task' as const, text: 'codex-companion.mjs task' }
  const forwarder = {
    ...plan,
    id: 'agent:f1',
    title: 'Codex rescue',
    detail: { agentId: 'f1', toolCount: 1, codexCalls: [call] },
  } as RabeItem
  const job = { ...review, parentId: forwarder.id } as RabeItem
  const drawn = gridOf(timelineView({ ...MODEL, items: [forwarder, job] }, SIZE, NO_SELECTION))
  expect(rowKeys(drawn)).toEqual([`row:${job.id}`])
  const shown = lines(drawn.grid)
  const at = find(shown, '└─ ✓ Codex rescue')
  expect(at).toBeGreaterThan(0)
  expect(shown[at + 1]).toMatch(/^ {3}└─ ◐ review auth\.ts \(codex\)/)
})
