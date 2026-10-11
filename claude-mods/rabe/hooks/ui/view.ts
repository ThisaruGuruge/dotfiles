import type { RenderSurface } from 'claude-code'

import type {
  RabeEdit,
  RabeLines,
  RabeOrder,
  RabePrevious,
  RabeTab,
  RabeTurn,
  RabeWindow,
  RabeWorktree,
} from '../../types'
import type { RabeItem } from '../model'
import { type Grid, MAX_COLUMNS, MAX_ROWS, type Span } from './cells/grid'

// What every view reads: the sources' session values, never files. `usd` is
// the session's cost as /cost totals it; `previous` is the last session in
// this project that had background work, from `$.store`. `edits` are the
// files the main session changed, `cwd` the session's folder, `worktrees`
// git's worktrees of it (absent without git), `sessionId` what
// `claude --resume` takes to come back to this session. `removed` are
// the ids the person removed (`rabe.removed`): only the list and the band's
// chips leave them out (`kept`); summaries and the other tabs count them.
export type Model = {
  items: RabeItem[]
  removed?: string[]
  turns: Record<string, RabeTurn[]>
  lines: Record<string, RabeLines>
  now: number
  usd?: number
  previous?: RabePrevious
  edits?: RabeEdit[]
  cwd?: string
  sessionId?: string
  worktrees?: RabeWorktree[]
}

// The cells a view may fill: `columns` from `bodyColumns`, `rows` from
// `scroll.bodyRows` (pane) or `maxRows` (band). A view draws this size, or
// more rows where a list does not fit: then the pane scrolls. `window` is the
// part of the view's rows the pane shows: from `top` (below 0 while the rows
// above the view show), `rows` high; the pane's `scroll`, where it has one.
export type Size = {
  columns: number
  rows: number
  surface: RenderSurface
  hasInput: boolean
  window?: { top: number; rows: number }
}

// The size a view lays out for: on the terminal no larger than one Raster, so
// what the view keeps in view (the selected row) is never cut off afterwards.
export function bounded(size: Size): Size {
  if (size.surface !== 'terminal') return size

  return {
    ...size,
    columns: Math.min(size.columns, MAX_COLUMNS),
    rows: Math.min(size.rows, MAX_ROWS),
  }
}

// The person's place in the pane, kept in `$.state` (rabe.tab, rabe.selected,
// ...). `selected` is the item whose row holds the focus; `order` the list
// order taken when the pane opened (see `stable` in lists.ts).
export type Selection = {
  tab: RabeTab
  query: string
  folded: string[]
  selected: string
  open: string
  order?: RabeOrder
  isFocused: boolean
  // Stop and delete act only while this holds (`arm`).
  isArmed: boolean
  // The list's x and g act only while this holds too (`arm`).
  isListArmed: boolean
  // The Timeline's window; absent: the whole session, no key to widen it.
  window?: RabeWindow
}

export type Action =
  | { type: 'tab'; tab: RabeTab }
  | { type: 'open'; id: string }
  | { type: 'fold'; group: string }
  | { type: 'query'; text: string; isSubmit?: true }
  // Widen the Timeline's window (`widen` in views/timeline.ts).
  | { type: 'window' }
  | { type: 'focus'; key: string }
  | { type: 'stop'; ids: string[] }
  | { type: 'delete'; id: string }
  // Hide these ended items for the session.
  | { type: 'remove'; ids: string[] }
  // Hide every ended item the search shows, as the list holds them when pressed.
  | { type: 'clear' }
  // `what` names the copy in its toast instead of the text (a prompt).
  | { type: 'copy'; text: string; what?: string }
  | { type: 'message'; id: string; text: string }
  | { type: 'none' }

// What a control that is not available now does: nothing. It keeps its slot.
export const NONE: Action = { type: 'none' }

// A toolbar control, drawn `[ label ]`. The label carries the key
// ("x: stop"): the engine does not draw hotkeys. Hotkeys are one digit or one
// lowercase letter. A control that is not available now is `dim` with the
// action `NONE`; the pane keeps its hotkey bound and its place.
export type ViewButton = {
  key: string
  label: string
  action: Action
  hotkey?: string
  autoFocus?: true
  dim?: true
}

// An Input under the Buttons; left out where `size.hasInput` is false.
export type ViewInput = {
  key: string
  label: string
  placeholder: string
  submitLabel: string
  value?: string
  // Also sent on each change, not only on Enter.
  isLive?: boolean
  action: (text: string, kind?: 'change' | 'submit') => Action
}

// A plain Button inside a line: the one pressable thing of a selectable row
// (its name) or a tab. `key` is stable (`row:<item id>`, `group-<id>`,
// `tab-<tab>`), so focus and the arrow keys find it again after a redraw.
// A Button takes no color: `dim` draws it dim at rest and full under the
// focus or the pointer, and `bg` is the background of the Box around it.
export type Press = {
  key: string
  label: string
  action: Action
  hotkey?: string
  autoFocus?: true
  dim?: true
  bg?: number
}

export type Part = Span | Press

export const isPress = (part: Part): part is Press => !Array.isArray(part)

// One row of the body: Text parts and at most one Press per row (a tab bar
// holds one per tab), then a part aligned to the right end. `bg` fills the row.
export type Line = { spans: Part[]; right?: Span[]; bg?: number }

// What a body holds: lines, and charts nobody presses (a Raster on the
// terminal, text elsewhere).
export type Node = Line | { chart: Grid }

// A view's whole output: the body, the controls and the Inputs. These are
// drawn before the node at `toolbar` (the pane's toolbar), else at the end.
export type Drawn = {
  nodes: Node[]
  buttons: ViewButton[]
  inputs?: ViewInput[]
  toolbar?: number
}

// A drawing in document order, which is the order of the focus ring.
export type Piece = Node | { button: ViewButton } | { input: ViewInput }

export function layout(drawn: Drawn): Piece[] {
  const at = drawn.toolbar ?? drawn.nodes.length
  const tools: Piece[] = [
    ...drawn.buttons.map(button => ({ button })),
    ...(drawn.inputs ?? []).map(input => ({ input })),
  ]

  return [...drawn.nodes.slice(0, at), ...tools, ...drawn.nodes.slice(at)]
}

export type View = (model: Model, size: Size, selection: Selection) => Drawn

export const NO_SELECTION: Selection = {
  tab: 'items',
  query: '',
  folded: [],
  selected: '',
  open: '',
  isFocused: false,
  isArmed: false,
  isListArmed: false,
}

// The item rows of a drawing in document order: what the arrow keys walk.
// A row kept only for its place (action NONE) is no stop.
export function rowKeys(drawn: Drawn | Piece[]): string[] {
  const list = Array.isArray(drawn) ? drawn : drawn.nodes

  return list.flatMap(node =>
    'spans' in node
      ? node.spans.flatMap(part =>
          isPress(part) && part.key.startsWith('row:') && part.action.type !== 'none'
            ? [part.key]
            : [],
        )
      : [],
  )
}

// The row an arrow key moves the focus to from the row of item `selected`:
// the first row when the focus is on none; undefined past either end.
export function stepRow(keys: string[], selected: string, by: number): string | undefined {
  const at = keys.indexOf(`row:${selected}`)
  if (at === -1) return by > 0 ? keys[Math.min(keys.length - 1, by - 1)] : undefined

  const target = at + by
  if (target >= 0 && target < keys.length) return keys[target]
  if (Math.abs(by) > 1) return keys[Math.max(0, Math.min(keys.length - 1, target))]
  return undefined
}

// Where the focus ring goes, key by key, after `action` changed the view
// (the item `open` was open): the active tab's Button, then the element the
// change leads to. Search edits keep its Input focused; Enter returns to rows.
// A sent message returns the keys to the agent's `m: message`.
export function landing(action: Action, open: string, drawn?: Drawn): string[] {
  const target =
    drawn?.buttons.find(one => one.autoFocus)?.key ??
    drawn?.nodes
      .flatMap(node => ('spans' in node ? node.spans.filter(isPress) : []))
      .find(one => one.autoFocus)?.key
  switch (action.type) {
    case 'tab':
      return [`tab-${action.tab}`, ...(target ? [target] : [])]
    case 'open': {
      const next = action.id ? 'back' : open && `row:${open}`
      return ['tab-items', ...(next ? [next] : [])]
    }
    case 'fold':
      return ['tab-items', `group-${action.group}`]
    case 'query':
      return action.isSubmit ? ['tab-items', target ?? 'find'] : ['search']
    case 'window':
      return ['tab-timeline', 'window']
    case 'message':
      return [`message-agent:${action.id}`]
    default:
      return []
  }
}

export function messageLanding(
  action: Action,
  selection: Pick<Selection, 'tab' | 'open'>,
  ringOn: string | undefined,
): string[] | undefined {
  if (
    action.type !== 'message' ||
    selection.tab !== 'items' ||
    selection.open !== action.id ||
    ringOn !== `message:${action.id}`
  )
    return undefined
  return landing(action, '')
}

// Whether the focus ring is known to sit on a safe element, so that stop and
// delete may act. The engine keeps the ring on an index the pane cannot read;
// `shown` is what the last drawing showed (`undefined`: take the next one as
// it is). See arming in docs/architecture/focus-order.md.
export type Shown = {
  // The open item or selected row the drawing could not show, or ''.
  fallback: string
  // What the list's `stop` and `stop-group` act on (`targetsOf`).
  targets: string[]
  // The stored selection: only the person changes it.
  selected: string
}

// `isListArmed`: the list's x and g act on the selection, so they also need
// the person's focus on a live row since the last reset.
// `step`: the row a person's arrow asked Rabe's `$.ui.focus` to move onto.
export type Arming = { isArmed: boolean; isListArmed: boolean; shown?: Shown; step?: string }

export const DISARMED: Arming = { isArmed: false, isListArmed: false }

export type ArmEvent =
  // The pane opened, or the person changed the view (tab, open, back, fold, search).
  | { type: 'reset' }
  // The arrow hook carries out the person's arrow with a `$.ui.focus` onto `key`.
  | { type: 'step'; key: string }
  // Rabe's own `$.ui.focus` moved the ring, or was refused or threw.
  | { type: 'landed'; isMoved: boolean }
  // A `ui.focus` on the pane that no hook refused: by the person, or by Rabe
  // (a landing, `autoFocus`), asking for element `requested`; the ring landed
  // on `key`, which a hook beneath may have rewritten. `isLiveRow`: `key` is a
  // row the list draws, not a gone slot (`isLiveRow` in views/pane.ts);
  // `selected`: the stored selection after the move.
  | {
      type: 'focus'
      byPerson: boolean
      key: string
      requested: string | undefined
      isLiveRow: boolean
      selected: string
    }
  // The person's press on a live row of the Items list selected it. Only a
  // surface raises `ui.press` (a plugin's `$` has no press).
  | { type: 'press' }
  // A drawing.
  | ({ type: 'drawn' } & Shown)

const DESTRUCTIVE = /^(stop|stop-group|stop-run|delete|remove|clear)(:|$)/

export const isDestructive = (key: string): boolean => DESTRUCTIVE.test(key)

export function arm(state: Arming, event: ArmEvent): Arming {
  switch (event.type) {
    case 'reset':
      return DISARMED
    case 'step':
      return { ...state, step: event.key }
    case 'landed': {
      const { step: _, ...rest } = state
      return event.isMoved ? { ...rest, isArmed: true } : { ...rest, ...DISARMED }
    }
    case 'focus': {
      const { step, ...rest } = state
      if (event.key !== event.requested) {
        return { ...rest, isArmed: !isDestructive(event.key), isListArmed: false }
      }
      const byPerson = event.byPerson || event.key === step
      const isArmed = state.isArmed || byPerson || !isDestructive(event.key)
      const isRow = byPerson && event.key.startsWith('row:')
      const isChosen = event.isLiveRow && event.key === `row:${event.selected}`
      return { ...rest, isArmed, isListArmed: isRow ? isChosen : state.isListArmed }
    }
    case 'press':
      return { ...state, isListArmed: true }
    case 'drawn': {
      const { fallback, targets, selected } = event
      const was = state.shown
      const isAuto =
        was !== undefined &&
        ((fallback !== '' && fallback !== was.fallback) ||
          (selected === was.selected && targets.some(one => !was.targets.includes(one))))
      return {
        isArmed: state.isArmed && !isAuto,
        isListArmed: state.isListArmed && !isAuto && !fallback.includes('selected:'),
        shown: { fallback, targets, selected },
        ...(state.step !== undefined && { step: state.step }),
      }
    }
  }
}

// The tiers no person or administrator installs into: the engine's own link
// and the plugins bundled in the binary, where the test kit's own hooks stand
// in for the engine.
const isEngine = (tier: string): boolean => tier === 'core' || tier === 'builtin'

// One link of a `ui.focus` trace, as `next.trace` lists it.
type Link = { tier: string; outcome: string; received: { element?: string } }

// Where a `ui.focus` landed, from its `next.trace`: the element the engine's
// link received (absent: one of the engine's own stops). Undefined when the
// move was refused or a link above the engine answered without `next`, which
// keeps the ring where it was.
export function landingOf(
  trace: readonly Link[],
  isDenied: boolean,
): { element?: string } | undefined {
  const last = trace.at(-1)
  if (isDenied || !last || !isEngine(last.tier) || last.outcome !== 'returned') return undefined

  return last.received.element === undefined ? {} : { element: last.received.element }
}

// The list's x, g and r keep one key each and act on the selection.
export const LIST_KEYS = ['stop', 'stop-group', 'remove']

// What the list's x and g act on in a drawing: one entry per control and item.
// Fewer entries (a row of the group ended, g can no longer act) stop less
// than the person saw; a new entry is a target they did not choose.
export const targetsOf = (drawn: Drawn): string[] =>
  drawn.buttons
    .filter(one => LIST_KEYS.includes(one.key))
    .flatMap(({ key, label, action }) =>
      action.type === 'stop' || action.type === 'remove'
        ? action.ids.map(id => JSON.stringify([key, label, id]))
        : [],
    )

// Rows the toolbar takes: wrapped Buttons ("[ label ]" and a
// gap) and one row per Input.
export function controlRows(drawn: Omit<Drawn, 'nodes'>, size: Size): number {
  let rows = 0
  let used = Infinity
  for (const button of drawn.buttons) {
    const width = button.label.length + 5
    if (used + width > size.columns) {
      rows += 1
      used = 0
    }
    used += width
  }

  return rows + (size.hasInput ? (drawn.inputs?.length ?? 0) : 0)
}

// An agent a workflow script started. Claude Code can stop only the whole run, and cannot message it.
export function isWorkflowAgent(item: RabeItem): boolean {
  if (item.kind !== 'agent') return false

  return (
    item.parentId?.startsWith('workflow:') === true ||
    item.detail.workflowIndex !== undefined ||
    item.detail.workflowPhase !== undefined
  )
}

export function canStop(item: RabeItem): boolean {
  if (item.status !== 'running') return false
  if (item.kind === 'agent') return !isWorkflowAgent(item)
  if (item.kind === 'codex') return true
  if (item.kind === 'shell' || item.kind === 'monitor' || item.kind === 'workflow') {
    return item.detail.taskId !== undefined
  }

  return false
}

export function taskIdOf(item: RabeItem): string | undefined {
  if (item.kind === 'agent') return item.detail.agentId
  if (item.kind === 'shell' || item.kind === 'monitor' || item.kind === 'workflow') {
    return item.detail.taskId
  }

  return undefined
}
