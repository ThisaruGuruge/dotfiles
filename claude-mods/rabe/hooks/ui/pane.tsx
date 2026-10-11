import type { EngineInterface, On, RenderSurface } from 'claude-code'

import type { RabeItem, RabePrevious } from '../../types'
import { KIND_LABEL, kept, matches, orderOf, previousOf, rowOf } from './lists'
import { type At, type Held, hold, isRowKey, render, shifts } from './render'
import { reserve, sequence } from './sequence'
import {
  type Action,
  type ArmEvent,
  type Arming,
  arm,
  bounded,
  DISARMED,
  landing,
  landingOf,
  layout,
  type Model,
  messageLanding,
  rowKeys,
  type Selection,
  stepRow,
  targetsOf,
  taskIdOf,
} from './view'
import { fallbackOf, isLiveRow, paneView, seatsRows, selectsOnPress } from './views/pane'
import { widen, windowOf } from './views/timeline'

const PANE = 'rabe'
const MAX_ACTIONS = 20

// The option `timelineHours`, set by `pane(on, hours)`: the Timeline's window
// when the pane opens.
let baseHours = 4

function toastText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[\p{Cc}\p{Cf}]/gu, '?')
}

// Titles and reasons come from files and tools.
function toast($: EngineInterface, text: string): void {
  $.ui.toast(toastText(text))
}

// Tabs and line breaks stay; an escape could end a bracketed paste.
function clipText(text: string): string {
  return text.replace(/(?![\t\n\r])[\p{Cc}\p{Cf}]/gu, '?')
}

// A cron job's title is its prompt.
function nameOf(item: RabeItem): string {
  return item.kind === 'cron' ? item.detail.jobId : item.title
}

// Esc may have closed the pane before the delayed focus call.
async function refocus($: EngineInterface): Promise<void> {
  const pane = (await $.ui.panes()).find(one => one.id === PANE)
  if (!pane || pane.isFocused) return
  await $.ui.open({ id: PANE, title: 'Rabe', focus: true, closeOnEscape: true })
}

async function tick($: EngineInterface): Promise<void> {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  if (items.some(item => item.status === 'running')) $.ui.invalidate('ui.render')
}

// The store is the plugin's own JSON; an older Rabe may have written another
// shape, and a summary before 0.4 has no session id.
function asPrevious(value: unknown): RabePrevious | undefined {
  const prev = value as RabePrevious | undefined
  if (typeof prev?.endedAt !== 'number' || !Array.isArray(prev.failed) || !prev.counts) {
    return undefined
  }
  const { sessionId, ...rest } = prev

  return typeof sessionId === 'string' && sessionId ? { ...rest, sessionId } : rest
}

async function previous($: EngineInterface): Promise<RabePrevious | undefined> {
  return asPrevious(await $.store.get(`previous:${await $.session.cwd()}`))
}

// Keeps this session's summary for the next one in this project; a session
// with no background work leaves the last summary in place.
async function remember($: EngineInterface, sessionId?: string): Promise<void> {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  if (items.length === 0) return
  const usage = await $.session.usage()
  const summary = previousOf(
    items,
    await $.clock.now(),
    { startedAt: usage.startedAt, usd: usage.cost?.usd },
    sessionId,
  )
  await $.store.set(`previous:${await $.session.cwd()}`, summary)
}

async function stop($: EngineInterface, ids: string[]): Promise<void> {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  const targets = items.filter(item => ids.includes(item.id))
  const one = targets.length === 1 ? targets[0] : undefined
  if (one) toast($, `Stopping ${KIND_LABEL[one.kind]} ${nameOf(one)}…`)
  let stopped = 0
  const stoppedItems: RabeItem[] = []
  let ended = 0
  let refused: string | undefined
  for (const item of targets) {
    if (item.kind === 'codex' && item.status === 'running') {
      const { text = 'n/a' } = await $.command
        .run({ command: 'rabe-stop', args: item.id })
        .catch((error: unknown) => ({ text: `Stop refused: ${String(error)}` }))
      if (text.startsWith('Stopped')) {
        stopped += 1
        stoppedItems.push(item)
      } else refused = text.replace(/^Stop refused: /, '')
      continue
    }
    const task = taskIdOf(item)
    if (item.status !== 'running' || !task) {
      ended += 1
      continue
    }
    try {
      const result = await $.tool.call({ tool: 'TaskStop', task_id: task })
      if (result.deny) refused = result.deny
      else if (result.isError) refused = result.text ?? 'n/a'
      else {
        stopped += 1
        stoppedItems.push(item)
      }
    } catch (error) {
      refused = error instanceof Error ? error.message : String(error)
    }
  }
  for (const item of stoppedItems) {
    await queueAction($, `Rabe: user stopped ${item.kind} ${item.id}`)
  }
  if (one && refused) toast($, `Stop refused: ${refused}`)
  else if (one) toast($, ended ? `${nameOf(one)} had already finished` : `Stopped ${nameOf(one)}`)
  else {
    const done = ended ? `; ${ended} had already finished` : ''
    const no = refused ? `; refused: ${refused}` : ''
    toast($, `Stopped ${stopped} of ${targets.length}${done}${no}`)
  }
}

async function queueAction($: EngineInterface, note: string): Promise<void> {
  for (;;) {
    const { value = [], version } = await $.state.get({ plugin: 'rabe', key: 'actions' })
    const { isSet } = await $.state.set(
      { plugin: 'rabe', key: 'actions' },
      [...value, note].slice(-MAX_ACTIONS),
      { ifVersion: version },
    )
    if (isSet) return
  }
}

async function clearActions($: EngineInterface, delivered: string[]): Promise<void> {
  for (;;) {
    const { value = [], version } = await $.state.get({ plugin: 'rabe', key: 'actions' })
    if (!delivered.every((note, index) => value[index] === note)) return
    const { isSet } = await $.state.set(
      { plugin: 'rabe', key: 'actions' },
      value.slice(delivered.length),
      { ifVersion: version },
    )
    if (isSet) return
  }
}

// Whether stop and delete act: the ring is known to sit on a safe element.
// A module value, so a reload, which also drops the hold, starts disarmed.
let arming: Arming = DISARMED

// Where the last `ui.focus` on the pane landed, as the pane's focus hook read it.
let landedOn: string | undefined

// The element that holds the focus ring, as far as the pane's focus hook saw
// it land; unknown after a reset, whose view puts another element at its index.
let ringOn: string | undefined

// The element the ring belongs on after rows came above it in the Items list
// (the ring kept its index), until the pane's focus hook sees the ring land.
// `isAsked`: a move back is under way; `tries`: moves asked since the pane
// last took the keys.
type Shift = { key: string; isAsked: boolean; tries: number }
let shifted: Shift | undefined

function feed($: EngineInterface, event: ArmEvent): void {
  const was = arming
  arming = arm(arming, event)
  if (event.type === 'reset') {
    ringOn = undefined
    shifted = undefined
  }
  if (arming.isArmed !== was.isArmed || arming.isListArmed !== was.isListArmed) {
    $.ui.invalidate('ui.render')
  }
}

// Moves the ring onto one of the pane's safe elements. Refused while the pane
// does not hold the keys (Enter then goes to the prompt) or when another hook
// says no: either way the ring may sit anywhere, so the pane disarms.
async function focusOn($: EngineInterface, key: string): Promise<boolean> {
  landedOn = undefined
  const result = await $.ui.focus({ requestId: PANE, key }).catch(() => ({ deny: 'threw' }))
  const isMoved = !('deny' in result && result.deny) && landedOn === key
  feed($, { type: 'landed', isMoved })

  return isMoved
}

// Puts the ring back on the element rows came above, a moment after the
// drawing: a move asked while the hook draws resolves against the tree
// before the one it returns, where the element still stands at its old
// index. From a timer the move reaches no hook (see docs/feasibility/ui.md), so the
// engine's answer is the evidence: a move it refuses or abandons counts as a
// refused landing, and the next drawing asks again, at most three times. A
// landing the focus hook saw since (the person's arrow) makes the move moot.
const REGAIN_MS = 100

async function regain($: EngineInterface, want: Shift): Promise<void> {
  if (shifted !== want) return
  const result = await $.ui
    .focus({ requestId: PANE, key: want.key })
    .catch(() => ({ deny: 'threw' }))
  if (!('deny' in result && result.deny)) {
    if (shifted === want) shifted = undefined
    return
  }
  want.isAsked = false
  feed($, { type: 'landed', isMoved: false })
}

// A row press while the ring is off its element: Enter would press the row
// that took its index. A click while the pane does not hold the keys is the
// person's own.
const isHeldBack = (at: At): boolean =>
  shifted !== undefined && seats.get(at.surface)?.isFocused === true && isRowKey(at.element)

// A new view starts its hold anew, but the ring keeps its index, where the new
// view may draw a stop; so the pane disarms and the ring moves (`landing`).
async function land($: EngineInterface, keys: string[]): Promise<void> {
  for (const key of keys) if (!(await focusOn($, key))) return
}

async function landView($: EngineInterface, action: Action, surface: RenderSurface): Promise<void> {
  const { model, selection } = await look($, true)
  const drawn = paneView(model, { columns: 80, rows: 24, surface, hasInput: true }, selection)
  return land($, landing(action, selection.open, drawn))
}

// A press on a live row of the Items list away from the ring selects it: a
// click moves no ring, so the press is the person's choice of that row. The
// ring's row and the selected row open.
async function choose($: EngineInterface, id: string): Promise<boolean> {
  const { model, selection } = await look($, true)
  if (!selectsOnPress(model, selection, id, ringOn)) return false
  await $.state.set({ plugin: 'rabe', key: 'selected' }, id)
  feed($, { type: 'press' })

  return true
}

// Hides ended items for the session: they stay in `rabe.items`, which polls
// fill again, and only the list leaves them out (`kept`). An id stays even when
// the cap drops its item, which a poll may find again.
async function remove($: EngineInterface, action: Action & { type: 'remove' | 'clear' }) {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  const { value: query = '' } = await $.state.get({ plugin: 'rabe', key: 'query' })
  let gone: RabeItem[] = []
  for (;;) {
    const { value: removed = [], version } = await $.state.get({ plugin: 'rabe', key: 'removed' })
    gone = kept(items, removed).filter(
      item =>
        item.status !== 'running' &&
        (action.type === 'remove' ? action.ids.includes(item.id) : matches(item, query)),
    )
    if (gone.length === 0) return
    const next = [...removed, ...gone.map(item => item.id)]
    const { isSet } = await $.state.set({ plugin: 'rabe', key: 'removed' }, next, {
      ifVersion: version,
    })
    if (isSet) break
  }
  const [one] = gone
  toast(
    $,
    gone.length === 1 && one
      ? `Removed ${KIND_LABEL[one.kind]} ${nameOf(one)}`
      : `Removed ${gone.length} ended items`,
  )
}

async function act($: EngineInterface, action: Action, surface: RenderSurface): Promise<void> {
  if (action.type === 'open' && (await choose($, action.id))) return
  if (action.type !== 'message' && landing(action, '').length > 0) feed($, { type: 'reset' })
  switch (action.type) {
    case 'tab':
      await $.state.set({ plugin: 'rabe', key: 'tab' }, action.tab)
      return landView($, action, surface)
    case 'fold': {
      const { value: folded = [] } = await $.state.get({ plugin: 'rabe', key: 'folded' })
      const next = folded.includes(action.group)
        ? folded.filter(group => group !== action.group)
        : [...folded, action.group]
      await $.state.set({ plugin: 'rabe', key: 'folded' }, next)
      return land($, landing(action, ''))
    }
    case 'open': {
      // Back selects the item that was open: the focus may have moved onto a
      // row inside its detail (a workflow's agents). A folded forwarder has no
      // row, so back selects its job.
      const { value: open = '' } = await $.state.get({ plugin: 'rabe', key: 'open' })
      const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
      const was = rowOf(open, items)
      const id = action.id || was
      if (id) {
        await $.state.set({ plugin: 'rabe', key: 'selected' }, id)
        await $.state.set({ plugin: 'rabe', key: 'tab' }, 'items')
      }
      await $.state.set({ plugin: 'rabe', key: 'open' }, action.id)
      return land($, landing(action, was))
    }
    case 'query':
      await $.state.set({ plugin: 'rabe', key: 'query' }, action.text)
      return action.isSubmit ? landView($, action, surface) : land($, landing(action, ''))
    case 'window': {
      const now = await $.clock.now()
      const { value = windowOf(baseHours, now) } = await $.state.get({
        plugin: 'rabe',
        key: 'window',
      })
      await $.state.set({ plugin: 'rabe', key: 'window' }, widen(value, now))
      return land($, landing(action, ''))
    }
    case 'focus':
      await focusOn($, action.key)
      return
    case 'stop':
      await stop($, action.ids)
      return
    case 'remove':
    case 'clear':
      await remove($, action)
      return
    case 'delete': {
      const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
      const item = items.find(one => one.id === action.id)
      if (
        item?.kind !== 'cron' ||
        item.status !== 'running' ||
        item.detail.scheduledFor !== undefined
      )
        return
      const result = await $.tool.call({ tool: 'CronDelete', id: item.detail.jobId })
      const reason = result.deny ?? (result.isError ? (result.text ?? 'n/a') : undefined)
      toast(
        $,
        reason
          ? `Delete refused: ${reason.replace(/<\/?tool_use_error>/g, '').trim()}`
          : `Deleted cron ${nameOf(item)}`,
      )
      if (!reason) await queueAction($, `Rabe: user deleted cron ${item.id}`)
      return
    }
    case 'copy': {
      // Over SSH the clipboard needs the terminal's OSC 52.
      const text = clipText(action.text)
      const result = await $.ui
        .copy({ text, surface })
        .catch((error: unknown) => ({ isCopied: false as const, reason: String(error) }))
      const preview = toastText(text)
      // only text the filters left alone is offered for selection
      const selectable = !action.what && preview === action.text
      const copied = action.what ? `Copied ${action.what}` : `Copied: ${preview}`
      toast(
        $,
        result.isCopied
          ? copied
          : `Copy failed: ${result.reason}.${selectable ? ` Select it: ${text}` : ''}`,
      )
      return
    }
    case 'none':
      return
    case 'message': {
      const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
      const item = items.find(one => one.id === action.id)
      if (item?.kind !== 'agent' || !action.text.trim()) return
      const sent = await $.session.send({ to: { agentId: item.detail.agentId }, text: action.text })
      toast(
        $,
        sent.isDelivered
          ? `Message sent to claude ${item.detail.name || item.title}`
          : `Message not sent: ${sent.reason}`,
      )
      if (sent.isDelivered) await queueAction($, `Rabe: user sent a message to agent ${item.id}`)
      return sequence(async () => {
        const { selection } = await look($, true)
        const target = messageLanding(action, selection, ringOn)
        if (target) await land($, target)
      })
    }
  }
}

// What the pane draws from: the sources' values and the person's place.
async function look(
  $: EngineInterface,
  isFocused: boolean,
): Promise<{ model: Model; selection: Selection }> {
  const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
  const { value: removed = [] } = await $.state.get({ plugin: 'rabe', key: 'removed' })
  const { value: turns = {} } = await $.state.get({ plugin: 'rabe', key: 'turns' })
  const { value: lines = {} } = await $.state.get({ plugin: 'rabe', key: 'lines' })
  const { value: edits = [] } = await $.state.get({ plugin: 'rabe', key: 'edits' })
  const { value: tab = 'items' } = await $.state.get({ plugin: 'rabe', key: 'tab' })
  const { value: query = '' } = await $.state.get({ plugin: 'rabe', key: 'query' })
  const { value: folded = [] } = await $.state.get({ plugin: 'rabe', key: 'folded' })
  const { value: selected = '' } = await $.state.get({ plugin: 'rabe', key: 'selected' })
  const { value: open = '' } = await $.state.get({ plugin: 'rabe', key: 'open' })
  const { value: order } = await $.state.get({ plugin: 'rabe', key: 'order' })
  const { value: worktrees } = await $.state.get({ plugin: 'rabe', key: 'worktrees' })
  const { value: window } = await $.state.get({ plugin: 'rabe', key: 'window' })
  const now = await $.clock.now()
  const usage = await $.session.usage().catch(() => undefined)
  const model = {
    items,
    removed,
    turns,
    lines,
    now,
    usd: usage?.cost?.usd,
    previous: await previous($).catch(() => undefined),
    edits,
    cwd: await $.session.cwd().catch(() => undefined),
    sessionId: await $.session.id().catch(() => undefined),
    ...(worktrees && { worktrees }),
  }

  const selection = {
    tab,
    query,
    folded,
    selected,
    open,
    isFocused,
    isArmed: arming.isArmed,
    isListArmed: arming.isListArmed,
    window: window ?? windowOf(baseHours, now),
    ...(order && { order }),
  }

  return { model, selection }
}

// The view the person chose. A change of it is theirs, so its hold starts anew.
const scopeOf = (sel: Selection) =>
  JSON.stringify([sel.tab, sel.open, sel.query, sel.folded, sel.window?.hours])

// Per surface, the focusable keys the pane drew since it opened, for one view
// (`scope`). A render hook may not write `$.state` (drawing is pure), so this
// is a module value: a reload starts the hold anew, as a new drawing would.
const holds = new Map<string, { scope: string; keys: Held[] }>()

// Per surface, where the pane sat and whether it held the keys at the last
// drawing. A move between dock and inline takes the keys from the pane.
const seats = new Map<string, { placement: string; isFocused: boolean }>()

// The presses and Input events under way, per surface and element, oldest
// first. Each event's hook adds its own slot before `next(e)`; the closure
// beneath, which the engine runs with the event, fills the oldest empty slot of
// its element, so an event carries out only an action of its own element.
// ponytail: two events on one element in flight at once may swap their
// actions; both are that element's, and each runs exactly once.
type Slot = { press?: { action: Action; surface: RenderSurface } }
const waiting = new Map<string, Slot[]>()

const slotOf = (at: At) => `${at.surface} ${at.element}`

function leave(action: Action, at: At): void {
  const slot = waiting.get(slotOf(at))?.find(one => !one.press)
  if (slot) slot.press = { action, surface: at.surface }
}

// Runs a press or an Input event beneath the hook, then carries out the action
// its closure left in this event's own slot with the hook's `$`.
async function carry<R>($: EngineInterface, at: At, run: () => Promise<R>): Promise<R> {
  const key = slotOf(at)
  const mine: Slot = {}
  const focusTurn = reserve()
  waiting.set(key, [...(waiting.get(key) ?? []), mine])
  let result: R
  try {
    result = await run()
  } catch (error) {
    await focusTurn(async () => undefined)
    throw error
  } finally {
    const rest = (waiting.get(key) ?? []).filter(one => one !== mine)
    if (rest.length > 0) waiting.set(key, rest)
    else waiting.delete(key)
  }
  const press = mine.press
  if (press && !isHeldBack(at)) {
    const action = press.action
    if (
      action.type === 'tab' ||
      action.type === 'fold' ||
      action.type === 'open' ||
      action.type === 'query' ||
      action.type === 'window' ||
      action.type === 'focus'
    ) {
      await focusTurn(() => act($, action, press.surface))
    } else {
      await focusTurn(async () => undefined)
      await act($, action, press.surface)
    }
  } else {
    await focusTurn(async () => undefined)
  }

  return result
}

const heldOf = (surface: RenderSurface, sel: Selection): Held[] | undefined => {
  const mine = holds.get(surface)
  return mine?.scope === scopeOf(sel) ? mine.keys : undefined
}

// An arrow key in a pane taller than its body scrolls it a row; Rabe moves
// the focus to the next or previous row instead, and the pane follows the
// focus. Past either end the scroll goes on, to show what is above or below.
async function arrow($: EngineInterface, by: number, bodyRows: number): Promise<number | false> {
  const { model, selection } = await look($, true)
  const size = { columns: 80, rows: bodyRows, surface: 'terminal', hasInput: true } as const
  const drawn = layout(paneView(model, size, selection))
  const keys = rowKeys(hold(drawn, heldOf('terminal', selection), seatsRows(selection)).list)
  const key = stepRow(keys, selection.selected, by)
  if (!key) return false
  const from = keys.indexOf(`row:${selection.selected}`)
  const to = keys.indexOf(key)
  const moved = from < 0 ? to + 1 : to - from
  feed($, { type: 'step', key })
  await focusOn($, key)

  return by - moved
}

export function pane(on: On, hours = baseHours): void {
  baseHours = hours
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rabe',
      description:
        'Show background work: agents, Codex jobs, shells, monitors, cron jobs and workflows',
    })
    $.clock.every(1000, () => void tick($))

    return next(e)
  })

  // Each open sorts the lists once; then they hold their order (see `stable`).
  on('command.run', { command: 'rabe' }, async $ => {
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const { value: edits = [] } = await $.state.get({ plugin: 'rabe', key: 'edits' })
    await $.state.set({ plugin: 'rabe', key: 'order' }, orderOf(items, edits))
    await $.state.set({ plugin: 'rabe', key: 'window' }, windowOf(baseHours, await $.clock.now()))
    holds.clear()
    feed($, { type: 'reset' })
    await $.ui.open({ id: PANE, title: 'Rabe', closeOnEscape: true })
    $.clock.after(1500, () => void refocus($).catch(() => undefined))

    return { text: 'Rabe opened.' }
  })

  on('session.end', { reason: /^/ }, async ($, e, next) => {
    await remember($, e.resume?.id ?? e.sessionId)

    return next(e)
  }).catch((_$, e, next) => next(e))

  on('prompt.submit', { origin: { kind: /^/ } }, async ($, e, next) => {
    const { value: actions = [] } = await $.state.get({ plugin: 'rabe', key: 'actions' })
    if (actions.length === 0) return next(e)
    const result = await next({ ...e, context: [...(e.context ?? []), ...actions] })
    if (!result.drop) await clearActions($, actions)
    return result
  }).catch((_$, e, next) => next(e))

  // The ring lands where the engine's link received the move (`landingOf`),
  // maybe not `e.element`; the selection follows it. A move that never
  // reached the engine left the ring where it was, so the pane disarms.
  on('ui.focus', { requestId: PANE }, ($, e, next) => {
    const focus = async () => {
      const { value: before = '' } = await $.state.get({ plugin: 'rabe', key: 'selected' })
      const asked = e.element?.startsWith('row:') ? e.element.slice(4) : before
      if (asked !== before) await $.state.set({ plugin: 'rabe', key: 'selected' }, asked)
      const result = await next(e)
      const landing = landingOf(next.trace, 'deny' in result && !!result.deny)
      const landed = landing?.element
      const selected = landed?.startsWith('row:') ? landed.slice(4) : before
      if (selected !== asked) await $.state.set({ plugin: 'rabe', key: 'selected' }, selected)
      landedOn = landed
      if (landing) {
        ringOn = landed
        shifted = undefined
      }
      if (!landing) feed($, { type: 'landed', isMoved: false })
      else if (landed) {
        const { model, selection } = await look($, true)
        feed($, {
          type: 'focus',
          byPerson: e.origin.kind === 'person',
          key: landed,
          requested: e.element,
          isLiveRow: isLiveRow(model, selection, landed),
          selected: selection.selected,
        })
      }

      return result
    }
    return e.origin.kind === 'person' && ringOn && e.element !== ringOn ? sequence(focus) : focus()
  }).catch((_$, e, next) => next(e))

  // Rabe's own `$.ui.focus` from a Button's or Input's closure reaches no
  // hook of Rabe's, so its landings would never count; calls from these do.
  on('ui.press', { requestId: PANE }, ($, e, next) => carry($, e, () => next(e))).catch(
    (_$, e, next) =>
      next.called && next.error.message?.includes('no handler is held under handle')
        ? { element: e.element }
        : next(e),
  )
  on('ui.input', { requestId: PANE }, ($, e, next) => carry($, e, () => next(e))).catch(
    (_$, e, next) =>
      next.called && next.error.message?.includes('no handler is held under handle')
        ? { element: e.element, value: e.value }
        : next(e),
  )

  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    if (e.pointer || e.by === 0 || Math.abs(e.by) >= e.bodyRows) return next(e)
    const remaining = await sequence(() => arrow($, e.by, e.bodyRows)).catch(() => false)
    if (remaining === 0) return {}
    if (typeof remaining === 'number')
      return next(
        e.offset > 0 && e.offset < e.contentRows - e.bodyRows
          ? { ...e, offset: e.offset - e.by + remaining }
          : e,
      )

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const seat = seats.get(e.surface)
    seats.set(e.surface, { placement: e.props.placement, isFocused: e.props.isFocused })
    if (seat?.isFocused && seat.placement !== e.props.placement) {
      $.clock.after(500, () => void refocus($).catch(() => undefined))
    }
    const { model, selection: seen } = await look($, e.props.isFocused)
    const size = bounded({
      columns: e.props.bodyColumns,
      rows: e.props.scroll?.bodyRows || 24,
      surface: e.surface,
      hasInput: 'Input' in ui,
      ...(e.props.scroll && {
        window: { top: e.props.scroll.offset, rows: e.props.scroll.bodyRows },
      }),
    })

    // What x and g would act on decides whether they may.
    const armed = paneView(model, size, { ...seen, isArmed: true, isListArmed: true })
    const { selected } = seen
    feed($, {
      type: 'drawn',
      fallback: fallbackOf(model, seen),
      targets: targetsOf(armed),
      selected,
    })
    const selection = { ...seen, isArmed: arming.isArmed, isListArmed: arming.isListArmed }
    const drawn = arming.isArmed && arming.isListArmed ? armed : paneView(model, size, selection)
    const before = heldOf(e.surface, selection)
    const out = hold(layout(drawn), before, seatsRows(selection))
    holds.set(e.surface, { scope: scopeOf(selection), keys: out.held })
    if (before && ringOn && shifts(before, out.held, ringOn)) {
      shifted = { key: ringOn, isAsked: false, tries: 0 }
    }
    if (shifted && seat && !seat.isFocused && e.props.isFocused) shifted.tries = 0
    if (shifted && !shifted.isAsked && shifted.tries < 3 && e.props.isFocused) {
      shifted.isAsked = true
      shifted.tries += 1
      const want = shifted
      $.clock.after(REGAIN_MS, () => void regain($, want).catch(() => undefined))
    }

    return render(ui, e.surface, out.list, leave)
  })
}
