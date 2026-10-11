import type { RabeTab } from '../../../types'
import { C } from '../cells/palette'
import { kept, shown } from '../lists'
import {
  controlRows,
  type Drawn,
  isPress,
  LIST_KEYS,
  type Line,
  type Model,
  NONE,
  type Node,
  type Press,
  type Selection,
  type Size,
  type View,
  type ViewButton,
} from '../view'
import { costView } from './cost'
import { detailView } from './detail'
import { effectsView } from './effects'
import { isSplit, itemsView, listOrder, selectedItem } from './items'
import { fitLine } from './lines'
import { timelineView } from './timeline'

// Each tab's view. A new tab adds its view here and its name to RabeTab.
export const TABS: { tab: RabeTab; label: string; hotkey: string; view: View }[] = [
  { tab: 'items', label: 'Items', hotkey: '1', view: itemsView },
  { tab: 'cost', label: 'Cost', hotkey: '2', view: costView },
  { tab: 'effects', label: 'Effects', hotkey: '3', view: effectsView },
  { tab: 'timeline', label: 'Timeline', hotkey: '4', view: timelineView },
]

const HINT = 1

const hasRows = (nodes: Node[]) =>
  nodes.some(
    node => 'spans' in node && node.spans.some(p => isPress(p) && p.key.startsWith('row:')),
  )

// The hint names the keys the tab binds: the arrows and Enter over its rows,
// and x and g of its controls while they act.
function hint(sel: Selection, isOpen: boolean, inner: Drawn, rows: number): string {
  if (!sel.isFocused) return 'tab to select · esc close'
  if (isOpen) {
    const move = hasRows(inner.nodes)
      ? ['↑↓ move']
      : rowsOf(inner.nodes) > rows
        ? ['↑↓ scroll']
        : []
    return [...move, 'b back', 'esc close'].join(' · ')
  }
  const move = hasRows(inner.nodes) ? ['↑↓ move', 'enter open'] : []
  const keys = inner.buttons.flatMap(one =>
    !one.dim && ['x', 'g', 'r', 'a'].includes(one.hotkey ?? '')
      ? [one.label.replace(': ', ' ')]
      : [],
  )

  return [...move, ...keys, 'esc close'].join(' · ')
}

const rowsOf = (nodes: Node[]) =>
  nodes.reduce((n, node) => n + ('chart' in node ? node.chart.rows : 1), 0)

// A plain Button with a hotkey is drawn `1: label`.
const PREFIX = 3

// The tab row: every tab a plain Button, never cut. Where the full labels do
// not fit, the other tabs keep their first letter; where those do not fit
// either, the tabs wrap. Under the row a rule marks the active tab, on one
// row only (the active tab is also drawn full, the others dim).
function tabLines(model: Model, size: Size, sel: Selection): Line[] {
  const press = (one: (typeof TABS)[number], isShort: boolean): Press => ({
    key: `tab-${one.tab}`,
    label:
      one.tab === sel.tab || !isShort
        ? one.tab === 'items'
          ? `${one.label} ${kept(shown(model.items), model.removed).length}`
          : one.label
        : one.label.slice(0, 1),
    hotkey: one.hotkey,
    action: { type: 'tab', tab: one.tab },
    ...(one.tab !== sel.tab && { dim: true }),
  })
  const span = (one: Press) => one.label.length + PREFIX
  const tries = [
    { gap: isSplit(size) ? 4 : 2, isShort: false },
    { gap: 1, isShort: false },
    { gap: 1, isShort: true },
  ]
  const fits = (list: Press[], gap: number) =>
    list.reduce((n, one) => n + span(one), 1 + gap * (list.length - 1)) <= size.columns
  const pick =
    tries.find(one =>
      fits(
        TABS.map(tab => press(tab, one.isShort)),
        one.gap,
      ),
    ) ?? (tries.at(-1) as (typeof tries)[number])
  const tabs = TABS.map(one => press(one, pick.isShort))
  const rows: Press[][] = []
  for (const one of tabs) {
    const last = rows.at(-1)
    if (last && fits([...last, one], pick.gap)) last.push(one)
    else rows.push([one])
  }
  const keys = '1-4 switch'
  const lines: Line[] = rows.map(row => {
    const width = row.reduce((n, one) => n + span(one), 1 + pick.gap * (row.length - 1))
    return fitLine(
      {
        spans: row.flatMap((one, i) => (i ? [[' '.repeat(pick.gap)], one] : [[' '], one])),
        ...(rows.length === 1 &&
          pick.gap > 2 &&
          width + keys.length < size.columns && { right: [[keys, { fg: C.dim }]] }),
      },
      size.columns,
    )
  })
  const at = tabs.findIndex(one => one.key === `tab-${sel.tab}`)
  const from =
    rows.length === 1 ? tabs.slice(0, at).reduce((n, one) => n + span(one) + pick.gap, 1) : 0
  const under = rows.length === 1 && at >= 0 ? span(tabs[at] as Press) : 0
  const rule: Line = {
    spans: [
      ['─'.repeat(from), { fg: C.rule }],
      ['━'.repeat(under), { fg: C.orange }],
      ['─'.repeat(Math.max(0, size.columns - from - under)), { fg: C.rule }],
    ],
  }

  return [...lines, fitLine(rule, size.columns)]
}

// The whole pane: the tab row and its rule, the toolbar (the tab's controls
// and Inputs), the tab's view (or the open item's detail), and the hint at the
// bottom. The toolbar comes before the body, so rows found later go at the end
// of the focus order (see `hold` in render.tsx). The view gets the rows the
// rest leaves; a list longer than that makes the pane scroll, and the focus
// carries the window along.
// What the drawing could not show as the person left it: the open item, or
// the selected row of the Items list, gone (pruned, filtered or folded away).
// The view then falls back to the list, or to its first row.
export function fallbackOf(model: Model, sel: Selection): string {
  if (sel.tab !== 'items') return ''
  const isOpenGone = sel.open !== '' && !model.items.some(item => item.id === sel.open)
  if (sel.open && !isOpenGone) return ''
  const isSelectedGone = sel.selected !== '' && !isLiveRow(model, sel, `row:${sel.selected}`)

  return [isOpenGone && `open:${sel.open}`, isSelectedGone && `selected:${sel.selected}`]
    .filter(Boolean)
    .join(' ')
}

// Whether the view seats rows found later where it draws them, also above a
// held row (`hold`): the Items list, which puts a new item in its group, and
// the Effects tab, which puts a new file or port in its section.
export const seatsRows = (sel: Selection): boolean =>
  (sel.tab === 'items' && sel.open === '') || sel.tab === 'effects'

// Whether `key` is a row the Items list draws, not a gone slot of one.
export const isLiveRow = (model: Model, sel: Selection, key: string): boolean =>
  key.startsWith('row:') && listOrder(model, sel).some(item => `row:${item.id}` === key)

// Whether a press on the row of item `id` selects it instead of opening it:
// a live row of the Items list that is neither the selected one nor the one
// that holds the focus ring (`ring`, its key). Enter presses the ring's row
// and opens it; only a pointer presses a row away from the ring.
export function selectsOnPress(model: Model, sel: Selection, id: string, ring?: string): boolean {
  if (sel.tab !== 'items' || model.items.some(item => item.id === sel.open)) return false
  if (ring === `row:${id}`) return false
  const order = listOrder(model, sel)

  return order.some(item => item.id === id) && selectedItem(order, sel)?.id !== id
}

// Stop, delete and remove stay bound while disarmed, with no action.
const disarmed = (one: ViewButton): ViewButton => {
  if (!['stop', 'delete', 'remove', 'clear'].includes(one.action.type)) return one
  return { ...one, action: NONE, dim: true }
}

// Dim controls keep only the hotkeys their view owns.
function bind(drawn: Drawn): Drawn {
  const hotkeys = ['x', 'g', 'r', 'a', 'd', 'm', 's', 'c', 'b', 'f', 'w']
  const buttons = drawn.buttons.map(one =>
    one.dim && one.action.type === 'none' && hotkeys.includes(one.label.slice(0, 1))
      ? { ...one, hotkey: one.label.slice(0, 1) }
      : one,
  )
  return { ...drawn, buttons }
}

export const paneView: View = (model, size, sel): Drawn => {
  const isOpen = sel.tab === 'items' && model.items.some(item => item.id === sel.open)
  const body = isOpen ? detailView : (TABS.find(one => one.tab === sel.tab)?.view ?? itemsView)
  const head = tabLines(model, size, sel)
  const room = (rows: number, above: number): Size => ({
    ...size,
    rows: Math.max(1, rows),
    ...(size.window && { window: { ...size.window, top: size.window.top - above } }),
  })
  const first = bind(body(model, room(size.rows - head.length - HINT, head.length), sel))
  const tools = controlRows(first, size)
  const rows = size.rows - head.length - tools - HINT
  const drawn = bind(body(model, room(rows, head.length + tools), sel))
  const isInert = (one: ViewButton) =>
    !sel.isArmed || (!sel.isListArmed && LIST_KEYS.includes(one.key))
  const inner = {
    ...drawn,
    buttons: drawn.buttons.map(one => (isInert(one) ? disarmed(one) : one)),
  }
  const pad = Math.max(0, rows - rowsOf(inner.nodes))
  const nodes: Node[] = [
    ...head,
    ...inner.nodes,
    ...Array.from({ length: pad }, (): Line => ({ spans: [] })),
    fitLine({ spans: [[` ${hint(sel, isOpen, inner, rows)}`, { fg: C.dim }]] }, size.columns),
  ]

  return { nodes, buttons: inner.buttons, inputs: inner.inputs, toolbar: head.length }
}
