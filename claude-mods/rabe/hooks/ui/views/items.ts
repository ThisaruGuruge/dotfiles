import type { RabeItem } from '../../model'
import type { Span } from '../cells/grid'
import { C, type Style, tone } from '../cells/palette'
import { facts } from '../facts'
import { tokens, usd } from '../format'
import {
  byParent,
  FAMILIES,
  type Family,
  type Group,
  glyph,
  grouped,
  groupNote,
  kept,
  matches,
  shown,
  withForwarder,
} from '../lists'
import {
  canStop,
  type Drawn,
  isPress,
  isWorkflowAgent,
  type Line,
  type Model,
  NONE,
  type Selection,
  type Size,
  type View,
  type ViewButton,
  type ViewInput,
} from '../view'
import { detailLines } from './detail'
import { beside, cut, fitLine, focusOn, itemLine, plain } from './lines'

const GROUP_COLOR: Record<Group, number> = {
  failed: C.red,
  agents: C.orange,
  shells: C.yellow,
  monitors: C.blue,
  cron: C.purple,
}

// The split needs room for both columns; below this the detail opens in place.
export const SPLIT_COLUMNS = 90

export function isSplit(size: Size): boolean {
  return size.columns >= SPLIT_COLUMNS
}

// A header for an agent's shells or monitors: its glyph and name, not a row.
function familyHead(family: Family): Line {
  const { parent } = family

  return {
    spans: [
      [' '],
      [parent ? glyph(parent) : '◐', { fg: parent ? tone(parent) : C.dim }],
      [' '],
      [family.title, { fg: C.dim }],
    ],
  }
}

const indent = (line: Line): Line => ({
  ...line,
  spans: [...line.spans.slice(0, 1), ['  '], ...line.spans.slice(1)],
})

const same = (line: Line) => line

// In AGENTS, a Codex job right under the agent that started it, or under that
// agent's job before it.
function isUnder(item: RabeItem, before: RabeItem[]): boolean {
  const last = before.at(-1)

  return (
    item.kind === 'codex' &&
    item.parentId !== undefined &&
    (last?.id === item.parentId || (last?.kind === 'codex' && last.parentId === item.parentId))
  )
}

// The first row the pane shows once it has followed the focus onto row `at`:
// the engine scrolls no further than it must, and does not say where it went.
function shownFrom(size: Size, at: number): number {
  if (!size.window || at < 0) return 0
  const { top, rows } = size.window

  return Math.max(0, at - rows + 1, Math.min(top, at))
}

// The items in list order, groups folded or not, with the lines the list
// shows: a header per group (a Button that folds it), a row per item, and in
// SHELLS and MONITORS the rows of each agent indented under its name.
// Gaps between groups only where the whole list fits in `rows`.
function groupsOf(model: Model, sel: Selection) {
  const visible = kept(shown(model.items), model.removed).filter(item => matches(item, sel.query))

  return grouped(visible, sel.order).map(group => ({
    ...group,
    families: FAMILIES.includes(group.id)
      ? byParent(group.items, model.items)
      : [{ id: '', title: '', items: group.items }],
  }))
}

const orderIn = (groups: ReturnType<typeof groupsOf>, sel: Selection) =>
  groups.flatMap(group =>
    sel.folded.includes(group.id) ? [] : group.families.flatMap(family => family.items),
  )

// The rows of the Items list in order, as the list draws them.
export const listOrder = (model: Model, sel: Selection): RabeItem[] =>
  orderIn(groupsOf(model, sel), sel)

function listLines(
  model: Model,
  sel: Selection,
  rows: number,
): { lines: Line[]; order: RabeItem[]; shown: RabeItem[][] } {
  const groups = groupsOf(model, sel)
  const order = orderIn(groups, sel)
  const selected = selectedItem(order, sel)
  const row = (item: RabeItem) => itemLine(item, model.now, item === selected)
  const blocks = groups.map((group): Line[] => {
    const isFolded = sel.folded.includes(group.id)
    const head: Line = {
      spans: [
        [`${isFolded ? '▸' : '▾'} `, { fg: GROUP_COLOR[group.id] }],
        {
          key: `group-${group.id}`,
          label: group.label.toUpperCase(),
          action: { type: 'fold', group: group.id },
        },
        [` ${groupNote(group.id, group.items) || group.items.length}`, { fg: C.dim }],
      ],
    }
    if (isFolded) return [head]
    return [
      head,
      ...group.families.flatMap(family =>
        family.id === ''
          ? family.items.map((item, i) =>
              (group.id === 'agents' && isUnder(item, family.items.slice(0, i)) ? indent : same)(
                row(item),
              ),
            )
          : [familyHead(family), ...family.items.map(item => indent(row(item)))],
      ),
    ]
  })
  const spaced = blocks.flatMap((block, i) => (i > 0 ? [{ spans: [] }, ...block] : block))
  const lines = spaced.length <= rows ? spaced : blocks.flat()

  return {
    lines: focusOn(lines, selected?.id ?? ''),
    order,
    shown: groups.map(group => group.items),
  }
}

export function selectedItem(order: RabeItem[], sel: Selection): RabeItem | undefined {
  return order.find(item => item.id === sel.selected) ?? order[0]
}

export const summary = detailLines

// The selected item in one line under a list too narrow for the split. A
// folded job's spend is its forwarder's too, and n/a as in the detail.
function summaryLine(model: Model, item: RabeItem): Line {
  const d = item.detail as Record<string, unknown>
  const spend = withForwarder(item, model.items)
  const dim = { fg: C.dim }
  const parts: Span[] = []
  const add = (text: string, style: Style = dim) => parts.push([' · ', dim], [text, style])
  if (d.port !== undefined) add(`:${d.port}`, { fg: C.blue })
  if (typeof d.model === 'string') add(d.model)
  if (spend.costUsd !== undefined) add(`≈ ${usd(spend.costUsd)}`, { fg: C.bright })
  else if (item.kind === 'agent' || item.kind === 'codex') add('cost n/a')
  if (spend.tokens) add(`${tokens(spend.tokens.input)} in`)
  add(facts(item, model.now, model.items).status.slice(2), { fg: tone(item) })

  return {
    spans: [[glyph(item), { fg: tone(item) }], [' '], [item.title, { fg: C.bright }], ...parts],
    bg: C.panel,
  }
}

// List keys in the toolbar; the rows themselves take the arrows and Enter.
// g stops the run of a workflow or its agent, else the rows of the group the
// selected row is shown in (`shown`). r removes the selected row once it
// ended, a every ended row shown. Below the split, s keeps only its letter.
// x, g, r and a keep their slots while they cannot act: dim, their hotkey bound to nothing.
// x, g and r each keep one key (`stop`, `stop-group`, `remove`) and act on the
// selection, so the person walks the list without leaving slots; a target that
// changes without the person disarms them (see arming in docs/architecture/focus-order.md).
function listButtons(
  model: Model,
  size: Size,
  selected: RabeItem | undefined,
  shown: RabeItem[][],
  query: string,
) {
  const run =
    selected?.kind === 'workflow'
      ? selected
      : selected && isWorkflowAgent(selected)
        ? model.items.find(one => one.id === selected.parentId && one.kind === 'workflow')
        : undefined
  const group = (shown.find(list => selected && list.includes(selected)) ?? [])
    .filter(canStop)
    .map(one => one.id)
  const slot = (
    key: string,
    label: string,
    ids: string[] | undefined,
    type: 'stop' | 'remove' = 'stop',
  ): ViewButton =>
    ids
      ? { key, label, hotkey: label.slice(0, 1), action: { type, ids } }
      : { key, label, action: NONE, dim: true }
  // Search first: a ring the engine left at the index after the tabs (the
  // first row or b of another view) never lands on a stop.
  const buttons: ViewButton[] = size.hasInput
    ? [
        {
          key: 'find',
          label: query
            ? `s: search "${cut(query, Math.min(16, Math.max(1, size.columns - 17)))}"`
            : isSplit(size)
              ? 's: search'
              : 's',
          hotkey: 's',
          action: { type: 'focus', key: 'search' },
        },
      ]
    : []
  const isEnded = (item: RabeItem) => item.status !== 'running'
  buttons.push(
    slot(
      'stop',
      'x: stop',
      selected && selected !== run && canStop(selected) ? [selected.id] : undefined,
    ),
    run
      ? slot('stop-group', 'g: stop run', canStop(run) ? [run.id] : undefined)
      : slot(
          'stop-group',
          group.length > 1 ? `g: stop ${group.length}` : 'g: stop group',
          group.length > 1 ? group : undefined,
        ),
    slot(
      'remove',
      'r: remove',
      selected && isEnded(selected) ? [selected.id] : undefined,
      'remove',
    ),
    shown.flat().some(isEnded)
      ? { key: 'clear', label: 'a: remove ended', hotkey: 'a', action: { type: 'clear' } }
      : { key: 'clear', label: 'a: remove ended', action: NONE, dim: true },
  )

  return buttons
}

const search = (sel: Selection): ViewInput => ({
  key: 'search',
  label: 'search',
  placeholder: 'title, kind or command',
  submitLabel: 'filter',
  value: sel.query,
  isLive: true,
  action: (text, kind) => ({ type: 'query', text, ...(kind === 'submit' && { isSubmit: true }) }),
})

// The Items tab: the grouped list, and beside it (split) or under it (one
// line) the selected item. Enter on a row opens the full detail in place.
// The split detail starts at the first row the pane shows, so it stays in
// view while the focus walks a list longer than the pane.
export const itemsView: View = (model, size, sel): Drawn => {
  const inputs = size.hasInput ? [search(sel)] : []
  const note = (value: string, buttons: ViewButton[]): Drawn => ({
    nodes: [fitLine({ spans: [[value, { fg: C.dim }]] }, size.columns)],
    buttons,
    inputs,
  })
  if (kept(model.items, model.removed).length === 0) {
    return note(
      ' Nothing runs in the background.',
      listButtons(model, size, undefined, [], sel.query),
    )
  }
  const split = isSplit(size)
  const { lines, order, shown } = listLines(model, sel, split ? size.rows : size.rows - 2)
  const selected = selectedItem(order, sel)
  const buttons = listButtons(model, size, selected, shown, sel.query)
  if (lines.length === 0) return note(` No item matches "${sel.query}".`, buttons)
  if (selected && split) {
    const listWidth = Math.min(48, Math.floor(size.columns * 0.42))
    const right = size.columns - listWidth - 2
    const at = lines.findIndex(line => line.spans.some(part => isPress(part) && part.autoFocus))
    const detail = [
      ...Array.from({ length: shownFrom(size, at) }, () => ({ spans: [] })),
      ...summary(model, selected, size.rows, right, sel).map(plain),
    ]
    const rule: Span[] = [['│', { fg: C.rule }], [' ']]
    const rows = Math.max(lines.length, detail.length, size.rows)
    const left = [...lines, ...Array.from({ length: rows - lines.length }, () => ({ spans: [] }))]

    return { nodes: beside(left, listWidth, rule, detail, right), buttons, inputs }
  }
  const nodes = lines.map(line => fitLine(line, size.columns))
  if (selected) {
    const pad = Math.max(0, size.rows - 1 - nodes.length)
    nodes.push(...Array.from({ length: pad }, () => ({ spans: [] })))
    nodes.push(fitLine(summaryLine(model, selected), size.columns))
  }

  return { nodes, buttons, inputs }
}
