import { expect, test } from 'claude-code/testing'
import type { RabeItem, RabeItemOf } from '../../model'
import { cell, lines } from '../cells/grid'
import { C, DEFAULT } from '../cells/palette'
import {
  ALL,
  babysit,
  ci,
  dev,
  explore,
  flow,
  gridOf,
  lint,
  NOW,
  plan,
  review,
  verify,
} from '../fixtures'
import { grouped, orderOf } from '../lists'
import {
  controlRows,
  type Drawn,
  isPress,
  landing,
  NO_SELECTION,
  NONE,
  rowKeys,
  type Size,
} from '../view'
import { itemsView } from './items'
import { fallbackOf, isLiveRow, paneView } from './pane'

const WIDE: Size = { columns: 100, rows: 24, surface: 'terminal', hasInput: true }
const NARROW: Size = { ...WIDE, columns: 80, rows: 12 }
const DESKTOP: Size = { ...WIDE, surface: 'desktop' }
const model = { items: ALL, turns: {}, lines: {}, now: NOW }

const at = (shown: string[], y: number, text: string) => shown[y]?.indexOf(text) ?? -1
const keys = (buttons: { key: string; label: string }[]) => buttons.map(one => one.label)

test('Enter in search returns to the filtered row while changes keep the field focused', () => {
  const sel = { ...NO_SELECTION, query: 'verify', selected: explore.id, isFocused: true }
  for (const size of [NARROW, WIDE, DESKTOP]) {
    const drawn = paneView(model, size, sel)
    const input = drawn.inputs?.[0]
    expect(input).toBeDefined()
    const change = input?.action('verify', 'change')
    const submit = input?.action('verify', 'submit')
    expect(change).toEqual({ type: 'query', text: 'verify' })
    expect(submit).toEqual({ type: 'query', text: 'verify', isSubmit: true })
    if (!change || !submit) return
    expect(landing(change, '', drawn)).toEqual(['search'])
    expect(landing(submit, '', drawn)).toEqual(['tab-items', `row:${explore.id}`])
    expect(landing(submit, '', paneView(model, size, { ...sel, selected: '' }))).toEqual([
      'tab-items',
      `row:${verify.id}`,
    ])
    expect(drawn.buttons.find(one => one.key === 'find')?.label).toBe('s: search "verify"')
    const empty = paneView(model, size, { ...sel, query: 'no such item' })
    expect(landing({ type: 'query', text: 'no such item', isSubmit: true }, '', empty)).toEqual([
      'tab-items',
      'find',
    ])
  }
})

test('at 90 columns and more the list and the selected item sit side by side', () => {
  const { grid } = gridOf(itemsView(model, WIDE, NO_SELECTION))
  const shown = lines(grid)
  expect(grid.columns).toBe(100)
  expect(shown[0]).toMatch(/^▾ FAILED 1 +│ ✗ shell · bun run lint/)
  expect(shown[0]?.[42]).toBe('│')
  expect(shown[1]).toMatch(/^▌✗ bun run lint exit 2 +failed 2m ago │ command bun run lint$/)
  expect(shown[2]?.slice(0, 42).trim()).toBe('')
  expect(shown[3]?.startsWith('▾ AGENTS 4 running · 2 ended')).toBe(true)
  expect(cell(grid, 0, 3)[1]).toBe(C.orange)
  expect(cell(grid, at(shown, 3, '4 running'), 3)[1]).toBe(C.dim)
})

test('the selected row has a marker and a background; the other names are dim', () => {
  const { grid } = gridOf(itemsView(model, WIDE, { ...NO_SELECTION, selected: dev.id }))
  const shown = lines(grid)
  const y = shown.findIndex(line => line.startsWith('▌▶ bun run dev :5173'))
  expect(cell(grid, 0, y)).toEqual(['▌'.codePointAt(0), C.orange, C.selected])
  expect(cell(grid, 3, y).slice(1)).toEqual([DEFAULT, C.selected])
  expect(cell(grid, at(shown, y, ':5173'), y)[1]).toBe(C.blue)
  expect(cell(grid, at(shown, y, '≥ 40m'), y)[1]).toBe(DEFAULT)
  const other = shown.findIndex(line => line.startsWith(' ◐ verify:db.ts'))
  expect(cell(grid, 3, other).slice(1)).toEqual([C.dim, DEFAULT])
  expect(cell(grid, at(shown, other, '40s'), other)[1]).toBe(C.dim)
})

const presses = (drawn: Drawn) =>
  drawn.nodes.flatMap(node => ('spans' in node ? node.spans.filter(isPress) : []))

test('each row is a plain Button keyed by its item that opens it; the selected one takes the focus', () => {
  const drawn = itemsView(model, WIDE, { ...NO_SELECTION, selected: explore.id })
  const rows = presses(drawn).filter(one => one.key.startsWith('row:'))
  expect(rows.map(one => one.key)).toContain(`row:${dev.id}`)
  const own = rows.find(one => one.key === `row:${explore.id}`)
  expect(own).toMatchObject({ label: 'Explore verifyToken', autoFocus: true })
  expect(own?.action).toEqual({ type: 'open', id: explore.id })
  expect(own?.dim).toBeUndefined()
  expect(rows.filter(one => one.autoFocus)).toHaveLength(1)
  expect(rows.find(one => one.key === `row:${dev.id}`)?.dim).toBe(true)
  expect(keys(drawn.buttons)).toEqual([
    's: search',
    'x: stop',
    'g: stop 3',
    'r: remove',
    'a: remove ended',
  ])
  expect(drawn.buttons.map(one => one.hotkey)).toEqual(['s', 'x', 'g', undefined, 'a'])
})

test('a group header is a Button that folds it; with nothing selected the first row has the focus', () => {
  const drawn = itemsView(model, WIDE, NO_SELECTION)
  const list = presses(drawn)
  expect(list[0]).toMatchObject({ key: 'group-failed', label: 'FAILED' })
  expect(list[0]?.action).toEqual({ type: 'fold', group: 'failed' })
  expect(list.find(one => one.autoFocus)?.key).toBe(`row:${lint.id}`)
})

test('the detail beside the list has no Buttons, so the arrows walk the list alone', () => {
  const drawn = itemsView(model, WIDE, { ...NO_SELECTION, selected: flow.id })
  expect(rowKeys(drawn)).toEqual(
    grouped(ALL).flatMap(group => group.items.map(item => `row:${item.id}`)),
  )
})

test('below 90 columns the list fills the width, drops the gaps and ends with one summary line', () => {
  const { grid, buttons } = gridOf(
    itemsView(model, NARROW, { ...NO_SELECTION, selected: explore.id }),
  )
  const shown = lines(grid)
  const end = shown.length - 1
  expect(shown.every(line => !line.includes('│'))).toBe(true)
  expect(shown.slice(0, end).some(line => line === '')).toBe(false)
  expect(shown[end]).toBe('◐ Explore verifyToken · opus-5-5 · ≈ $0.16 · 36k in · running')
  expect(cell(grid, 0, end).slice(1)).toEqual([C.yellow, C.panel])
  expect(cell(grid, 79, end)[2]).toBe(C.panel)
  expect(cell(grid, at(shown, end, '≈'), end)[1]).toBe(C.bright)
  expect(keys(buttons)).toEqual(['s', 'x: stop', 'g: stop 3', 'r: remove', 'a: remove ended'])
})

test('below 90 columns a list that fits keeps the gaps between groups', () => {
  const { grid } = gridOf(itemsView(model, { ...NARROW, rows: 30 }, NO_SELECTION))
  expect(lines(grid)[2]).toBe('')
})

test('the list is never cut: a pane taller than its body scrolls, and the desktop draws the same', () => {
  const short = lines(gridOf(itemsView(model, { ...NARROW, rows: 4 }, NO_SELECTION)).grid)
  expect(short.some(line => line.includes('⟳ /babysit-prs'))).toBe(true)
  const desk = lines(gridOf(itemsView(model, DESKTOP, NO_SELECTION)).grid)
  expect(desk).toEqual(lines(gridOf(itemsView(model, WIDE, NO_SELECTION)).grid))
})

test('a folded group shows its header only', () => {
  const { grid } = gridOf(itemsView(model, NARROW, { ...NO_SELECTION, folded: ['failed'] }))
  expect(lines(grid).slice(0, 2)).toEqual([
    '▸ FAILED 1',
    '▾ AGENTS 4 running · 2 ended · 4 claude · 1 codex · 1 workflow',
  ])
})

test('a workflow agent stays out of a group stop', () => {
  const other = {
    ...verify,
    id: 'agent:w2',
    title: 'verify:api.ts',
    detail: { agentId: 'w2', workflowPhase: 'Verify' },
  } as RabeItem
  const m = { items: [flow, verify, other, explore], turns: {}, lines: {}, now: NOW }
  const { buttons } = gridOf(itemsView(m, WIDE, { ...NO_SELECTION, selected: explore.id }))
  const group = buttons.find(b => b.hotkey === 'g')?.action
  expect(group).toMatchObject({ type: 'stop' })
  expect(group?.type === 'stop' ? group.ids : []).not.toContain(verify.id)
  expect(group?.type === 'stop' ? group.ids : []).not.toContain(other.id)
})

const mine: RabeItem = {
  ...(dev as RabeItemOf<'shell'>),
  id: 'shell:m',
  title: 'bun test',
  parentId: explore.id,
  detail: { command: 'bun test', taskId: 'm' },
}
const theirs: RabeItem = { ...ci, id: 'monitor:w', title: 'tail build.log', parentId: verify.id }
const lost: RabeItem = {
  ...(dev as RabeItemOf<'shell'>),
  id: 'shell:l',
  title: 'make',
  parentId: 'agent:gone',
  detail: { command: 'make', taskId: 'l' },
}
const families = { ...model, items: [mine, dev, theirs, lost, ci, explore, flow, verify] }

test('shells and monitors of an agent sit indented under a header with its glyph and name', () => {
  const drawn = itemsView(families, { ...NARROW, rows: 40 }, { ...NO_SELECTION, selected: mine.id })
  const { grid } = gridOf(drawn)
  const shown = lines(grid)
  const from = shown.findIndex(line => line.startsWith('▾ SHELLS'))
  expect(shown.slice(from, from + 6).map(line => line.slice(0, 40).trimEnd())).toEqual([
    '▾ SHELLS 3 running',
    ' ▶ bun run dev :5173',
    ' ◐ Explore verifyToken',
    '▌  ▶ bun test',
    ' ◐ agent n/a',
    '   ▶ make',
  ])
  const head = from + 2
  expect(cell(grid, 1, head)[1]).toBe(C.yellow)
  expect(cell(grid, 3, head)[1]).toBe(C.dim)
  expect(shown).toContain(' ◐ review-changes › verify:db.ts')
  expect(rowKeys(drawn).slice(3)).toEqual([
    `row:${dev.id}`,
    `row:${mine.id}`,
    `row:${lost.id}`,
    `row:${ci.id}`,
    `row:${theirs.id}`,
  ])
  expect(presses(drawn).find(one => one.autoFocus)?.key).toBe(`row:${mine.id}`)
})

test('with nothing selected the first row drawn has the focus, also when agents regroup a list', () => {
  const m = { ...model, items: [mine, dev, explore] }
  const drawn = itemsView(m, NARROW, NO_SELECTION)
  expect(presses(drawn).find(one => one.autoFocus)?.key).toBe(rowKeys(drawn)[0])
  const shells = itemsView({ ...model, items: [mine, dev] }, NARROW, NO_SELECTION)
  expect(rowKeys(shells)).toEqual([`row:${dev.id}`, `row:${mine.id}`])
  expect(presses(shells).find(one => one.autoFocus)?.key).toBe(`row:${dev.id}`)
})

test('a workflow agent or a run offers g: stop run on the list', () => {
  for (const selected of [verify.id, flow.id]) {
    const { buttons } = itemsView(model, WIDE, { ...NO_SELECTION, selected })
    const run = buttons.find(one => one.hotkey === 'g')
    expect(run).toMatchObject({ key: 'stop-group', label: 'g: stop run' })
    expect(run?.action).toEqual({ type: 'stop', ids: [flow.id] })
    expect(buttons.find(one => one.hotkey === 'x')).toBeUndefined()
  }
})

const stopIds = (drawn: Drawn) => {
  const action = drawn.buttons.find(one => one.key === 'stop-group')?.action
  return action?.type === 'stop' ? action.ids : undefined
}

test('g stops the group the row is shown in, not the group its status names now', () => {
  const failed = (item: RabeItem): RabeItem => ({ ...item, status: 'failed', endedAt: NOW })
  const other: RabeItem = { ...explore, id: 'agent:a9', title: 'Explore other' }
  const back: RabeItem = { ...review, id: 'codex:task-2', title: 'review cli.ts' }
  const order = orderOf([failed(explore), failed(back), other])
  const m = { ...model, items: [explore, back, other] }
  const drawn = itemsView(m, WIDE, { ...NO_SELECTION, selected: explore.id, order })
  expect(stopIds(drawn)).toEqual([explore.id, back.id])
  const one = itemsView({ ...m, items: [explore, other] }, WIDE, {
    ...NO_SELECTION,
    selected: explore.id,
    order: orderOf([failed(explore), other]),
  })
  expect(stopIds(one)).toBeUndefined()
})

test('g stops only the rows the search shows', () => {
  const other: RabeItem = { ...explore, id: 'agent:a9', title: 'Explore other' }
  const m = { ...model, items: [explore, other, review] }
  const drawn = itemsView(m, WIDE, { ...NO_SELECTION, selected: explore.id, query: 'explore' })
  expect(stopIds(drawn)).toEqual([explore.id, other.id])
})

const shellOf = (id: string, parentId?: string): RabeItem => ({
  ...(dev as RabeItemOf<'shell'>),
  id: `shell:${id}`,
  title: id,
  seenAt: NOW - 60_000,
  ...(parentId && { parentId }),
  detail: { command: id, taskId: id },
})

test('a held list puts new items in the group of their kind, after its held rows', () => {
  const s1 = shellOf('s1')
  const s2 = shellOf('s2')
  const before = [explore, s1, s2]
  const sel = { ...NO_SELECTION, selected: s2.id, order: orderOf(before) }
  const agent: RabeItem = { ...plan, status: 'running', endedAt: undefined }
  const a2 = shellOf('a2', explore.id)
  const watch = { ...ci, id: 'monitor:new' }
  const drawn = itemsView({ ...model, items: [...before, agent, a2, watch] }, NARROW, sel)
  expect(rowKeys(drawn)).toEqual(
    [explore.id, agent.id, s1.id, s2.id, a2.id, watch.id].map(id => `row:${id}`),
  )
  const shown = lines(gridOf(drawn).grid).map(line => line.trimEnd())
  expect(shown.some(line => line.includes('NEW'))).toBe(false)
  expect(shown.filter(line => line.startsWith('▾ '))).toEqual([
    '▾ AGENTS 2 running · 2 claude',
    '▾ SHELLS 3 running',
    '▾ MONITORS 1 running',
  ])
})

test('the first shell after the open opens a SHELLS group above the monitors', () => {
  const sel = { ...NO_SELECTION, selected: ci.id, order: orderOf([explore, ci]) }
  const keys = rowKeys(itemsView({ ...model, items: [explore, ci, shellOf('late')] }, NARROW, sel))
  expect(keys).toEqual([`row:${explore.id}`, 'row:shell:late', `row:${ci.id}`])
})

test('a held order keeps the families as the list showed them when it opened', () => {
  const sel = { ...NO_SELECTION, order: orderOf(families.items) }
  expect(rowKeys(itemsView(families, NARROW, sel))).toEqual(
    rowKeys(itemsView(families, NARROW, NO_SELECTION)),
  )
})

const many = Array.from({ length: 30 }, (_, i) => shellOf(`s${String(i).padStart(2, '0')}`))
const crowd = { ...model, items: many }
const detailAt = (drawn: Drawn, title: string) =>
  lines(gridOf(drawn).grid).findIndex(line => line.slice(44).startsWith(`▶ shell · ${title}`))
const rowAt = (drawn: Drawn, id: string) =>
  drawn.nodes.findIndex(
    node => 'spans' in node && node.spans.some(p => isPress(p) && p.key === `row:${id}`),
  )

test('the split detail sits in the rows the pane shows, where the focus took them', () => {
  const last = many.at(-1) as RabeItem
  const sel = { ...NO_SELECTION, selected: last.id }
  const tall = paneView(crowd, { ...WIDE, rows: 12, window: { top: 0, rows: 12 } }, sel)
  const y = rowAt(tall, last.id)
  expect(y).toBeGreaterThan(12)
  expect(detailAt(tall, last.title)).toBe(y - 11)
  const first = many[2] as RabeItem
  const up = paneView(
    crowd,
    { ...WIDE, rows: 12, window: { top: 20, rows: 12 } },
    {
      ...sel,
      selected: first.id,
    },
  )
  expect(detailAt(up, first.title)).toBe(rowAt(up, first.id))
  const still = paneView(
    crowd,
    { ...WIDE, rows: 12, window: { top: 5, rows: 12 } },
    {
      ...sel,
      selected: (many[8] as RabeItem).id,
    },
  )
  expect(detailAt(still, 's08') + controlRows(still, WIDE)).toBe(5)
})

// The list's x and g keep one key each and act on the selected row, so
// walking the list leaves no slots (see arming in docs/architecture/focus-order.md).
test('x and g keep their keys and act on the selected row', () => {
  const sel = { ...NO_SELECTION, selected: explore.id }
  const [, x, g] = itemsView(model, WIDE, sel).buttons
  expect(x).toMatchObject({ key: 'stop', action: { type: 'stop', ids: [explore.id] } })
  expect(g?.key).toBe('stop-group')
  expect(g?.label).toBe('g: stop 3')
  const fewer = itemsView(
    { ...model, items: model.items.filter(item => item !== review) },
    WIDE,
    sel,
  )
  expect(fewer.buttons.find(button => button.key === 'stop-group')).toMatchObject({
    key: 'stop-group',
    label: 'g: stop 2',
  })
  const [, other] = itemsView(model, WIDE, { ...sel, selected: review.id }).buttons
  expect(other).toMatchObject({ key: 'stop', action: { type: 'stop', ids: [review.id] } })
  const ended = itemsView(model, WIDE, { ...sel, selected: lint.id }).buttons
  expect(ended[1]).toMatchObject({ key: 'stop', action: { type: 'none' }, dim: true })
})

// Until the ring is known to sit on a safe element, stop and delete are drawn
// but do nothing (see arming in docs/architecture/focus-order.md).
test('a disarmed pane keeps stop and delete hotkeys bound without an action', () => {
  const sel = { ...NO_SELECTION, selected: explore.id, isFocused: true }
  const armed = paneView(model, WIDE, { ...sel, isArmed: true, isListArmed: true })
  const disarmed = paneView(model, WIDE, sel)
  expect(disarmed.buttons.map(one => one.key)).toEqual(armed.buttons.map(one => one.key))
  expect(disarmed.buttons.slice(1)).toEqual(
    armed.buttons.slice(1).map(one => ({ ...one, action: NONE, dim: true })),
  )
  expect(disarmed.buttons[0]).toEqual(armed.buttons[0])
  const cron = paneView(model, WIDE, { ...sel, open: babysit.id })
  expect(cron.buttons.find(one => one.key.startsWith('delete:'))?.action).toEqual(NONE)
  expect(cron.buttons.find(one => one.key.startsWith('copy:'))?.action.type).toBe('copy')
  const hint = (drawn: Drawn) => lines(gridOf(drawn).grid).at(-1)?.trim()
  expect(hint(armed)).toBe('↑↓ move · enter open · x stop · g stop 3 · a remove ended · esc close')
  expect(hint(disarmed)).toBe('↑↓ move · enter open · esc close')
  // a acts on every ended row, not on the selection: the ring alone arms it.
  const list = paneView(model, WIDE, { ...sel, isArmed: true })
  const notClear = (drawn: Drawn) => drawn.buttons.filter(one => one.key !== 'clear')
  expect(notClear(list)).toEqual(notClear(disarmed))
  expect(list.buttons.find(one => one.key === 'clear')?.action).toEqual({ type: 'clear' })
  const detail = paneView(model, WIDE, { ...sel, open: babysit.id, isArmed: true })
  expect(detail.buttons.find(one => one.key.startsWith('delete:'))?.action.type).toBe('delete')
})

test('a view falls back when its open item or its selected row is gone', () => {
  const sel = { ...NO_SELECTION, selected: explore.id }
  expect(fallbackOf(model, sel)).toBe('')
  expect(fallbackOf(model, { ...sel, open: dev.id })).toBe('')
  expect(fallbackOf(model, { ...sel, open: 'shell:gone' })).toBe('open:shell:gone')
  expect(fallbackOf(model, { ...sel, open: 'shell:gone', tab: 'cost' })).toBe('')
  expect(fallbackOf(model, { ...sel, selected: 'agent:gone' })).toBe('selected:agent:gone')
  expect(fallbackOf(model, { ...sel, query: 'zz' })).toBe(`selected:${explore.id}`)
  expect(fallbackOf(model, { ...sel, tab: 'cost', selected: 'agent:gone' })).toBe('')
  expect(fallbackOf(model, NO_SELECTION)).toBe('')
  const both = { ...sel, open: 'shell:gone', selected: 'shell:gone' }
  expect(fallbackOf(model, both)).toBe('open:shell:gone selected:shell:gone')
})

test('a row is live where the list draws it, not as a gone slot, a header or a control', () => {
  const sel = { ...NO_SELECTION, selected: explore.id }
  expect(isLiveRow(model, sel, `row:${explore.id}`)).toBe(true)
  expect(isLiveRow(model, sel, 'row:agent:gone')).toBe(false)
  expect(isLiveRow(model, { ...sel, query: 'zz' }, `row:${explore.id}`)).toBe(false)
  for (const key of ['group-shells', 'tab-items', 'stop', explore.id]) {
    expect([key, isLiveRow(model, sel, key)]).toEqual([key, false])
  }
})

// Issue #13: r removes the selected row once it ended, a every ended row the
// search shows; running items stay. Both keep their slots while they cannot act.
test('r removes the selected ended row and a every ended row; neither touches a running one', () => {
  const sel = { ...NO_SELECTION, selected: lint.id }
  const buttons = itemsView(model, WIDE, sel).buttons
  expect(buttons.map(one => one.label)).toEqual([
    's: search',
    'x: stop',
    'g: stop group',
    'r: remove',
    'a: remove ended',
  ])
  expect(buttons[3]).toMatchObject({
    key: 'remove',
    hotkey: 'r',
    action: { type: 'remove', ids: [lint.id] },
  })
  expect(buttons[4]).toMatchObject({ key: 'clear', hotkey: 'a', action: { type: 'clear' } })
  const running = itemsView(model, WIDE, { ...sel, selected: explore.id }).buttons
  expect(running[3]).toMatchObject({ key: 'remove', action: NONE, dim: true })
  const live = ALL.map(item => ({ ...item, status: 'running' as const, endedAt: undefined }))
  const none = itemsView({ ...model, items: live }, WIDE, sel).buttons
  expect(none[4]).toMatchObject({ key: 'clear', action: NONE, dim: true })
  const narrow = itemsView(model, NARROW, sel).buttons
  expect(controlRows({ buttons: narrow }, NARROW)).toBe(1)
})

const call = { at: NOW - 60_000, command: 'task' as const, text: 'codex-companion.mjs task' }
const forwarder = {
  ...explore,
  id: 'agent:f1',
  title: 'Codex rescue',
  detail: { agentId: 'f1', toolCount: 1, codexCalls: [call] },
} as RabeItem
const busy = {
  ...forwarder,
  title: 'Port the parser',
  detail: { agentId: 'f1', toolCount: 4, codexCalls: [call] },
} as RabeItem
const child = { ...review, parentId: forwarder.id, startedAt: NOW - 1000 } as RabeItem

test('an agent that only forwarded to Codex has no row: its job stands for both', () => {
  const drawn = itemsView({ ...model, items: [plan, forwarder, child] }, NARROW, NO_SELECTION)
  expect(rowKeys(drawn)).toEqual([`row:${child.id}`, `row:${plan.id}`])
  expect(lines(gridOf(drawn).grid)[0]).toBe('▾ AGENTS 1 running · 1 ended · 1 claude · 1 codex')
})

test('a Codex job sits indented under the agent that started it and did other work', () => {
  const drawn = itemsView({ ...model, items: [plan, busy, child] }, NARROW, NO_SELECTION)
  expect(rowKeys(drawn)).toEqual([`row:${busy.id}`, `row:${child.id}`, `row:${plan.id}`])
  const shown = lines(gridOf(drawn).grid).map(line => line.slice(0, 24).trimEnd())
  expect(shown.slice(1, 4)).toEqual([
    '▌◐ Port the parser',
    '   ◐ review auth.ts',
    ' ✓ Plan auth split',
  ])
})

test('below 90 columns the summary of a folded job counts its forwarder, and only what both know', () => {
  const end = (items: RabeItem[]) => {
    const shown = lines(
      gridOf(itemsView({ ...model, items }, NARROW, { ...NO_SELECTION, selected: child.id })).grid,
    )
    return shown[shown.length - 1]
  }
  const job = { ...child, costUsd: 2 } as RabeItem
  const cheap = { ...forwarder, costUsd: 0.01 } as RabeItem
  expect(end([plan, cheap, job])).toBe(
    '◐ review auth.ts · gpt-6.1-sol · ≈ $2.01 · 61k in · running',
  )
  const blind = { ...forwarder, costUsd: undefined, tokens: undefined } as RabeItem
  expect(end([plan, blind, job])).toBe('◐ review auth.ts · gpt-6.1-sol · cost n/a · running')
})

test('a long search query is capped with an ellipsis at wide and narrow widths', () => {
  const query = 'verify'.repeat(100)
  for (const size of [WIDE, NARROW, DESKTOP, { ...NARROW, columns: 24 }]) {
    const drawn = itemsView(model, size, { ...NO_SELECTION, query })
    const label = drawn.buttons.find(one => one.key === 'find')?.label ?? ''
    expect(label).toMatch(/^s: search "verify.*…"$/)
    expect(label.length + 5).toBeLessThanOrEqual(size.columns)
    expect(label.length).toBeLessThanOrEqual(32)
    expect(drawn.inputs?.[0]?.value).toBe(query)
  }
})
