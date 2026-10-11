import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { RabeItem } from '../model'
import { stripTasks, turnDuration } from './builtin'
import { dev, explore, NOW } from './fixtures'

test('stripTasks removes only the background work part and its manage hint', () => {
  expect(stripTasks('PR #5 · 2 shells, 1 monitor · esc to interrupt · ↓ to manage')).toBe(
    'PR #5 · esc to interrupt',
  )
  expect(stripTasks('PR #5 · 2 shells · ↓ to manage')).toBe('PR #5')
  expect(stripTasks('3 shells, 2 monitors, 1 background agent')).toBe('')
  expect(stripTasks('(shift+tab to cycle) · PR #5 · esc to interrupt')).toBe(
    '(shift+tab to cycle) · PR #5 · esc to interrupt',
  )
  expect(stripTasks('? for shortcuts')).toBe('? for shortcuts')
  expect(stripTasks('2 files changed · esc to interrupt')).toBe(
    '2 files changed · esc to interrupt',
  )
})

test('turnDuration formats like the engine line', () => {
  expect(turnDuration(5137)).toBe('5s')
  expect(turnDuration(64_000)).toBe('1m 4s')
  expect(turnDuration(3_725_000)).toBe('1h 2m 5s')
})

const HINT = {
  plugin: 'rabe',
  component: 'PromptHint',
  requestId: 'hint',
  props: {
    isDraft: false,
    isWorking: true,
    hint: 'PR #5 · 2 shells, 1 monitor · esc to interrupt · ↓ to manage',
  },
} as const

const TURN = {
  plugin: 'rabe',
  component: 'TurnDuration',
  requestId: 'turn',
  props: { word: 'Brewed', durationMs: 5137 },
} as const

function engine(on: On, items: RabeItem[]) {
  mock.clock(on, { now: NOW })
  on('state.get', async (_$, e, next) =>
    e.plugin === 'rabe' && e.key === 'items' ? { value: { value: items, version: 1 } } : next(e),
  )
  const seen: string[] = []
  on('ui.render', { component: 'PromptHint' }, async (_$, e) => {
    seen.push(e.props.hint)
    return { type: 'Box', props: { key: 'engine-hint' } }
  })
  on('ui.render', { component: 'TurnDuration' }, async () => ({
    type: 'Box',
    props: { key: 'engine-turn' },
  }))

  return seen
}

test('the prompt hint loses the task part and keeps the rest', async ($, on) => {
  const seen = engine(on, [dev])
  const ui = await $.ui.mount({ surface: 'terminal', ...HINT } as never)
  expect(seen.at(-1)).toBe('PR #5 · esc to interrupt')
  await ui.unmount()
})

test(
  'with hideBuiltinTasks off the prompt hint stays whole',
  { options: { hideBuiltinTasks: false } },
  async ($, on) => {
    const seen = engine(on, [dev])
    const ui = await $.ui.mount({ surface: 'terminal', ...HINT } as never)
    expect(seen.at(-1)).toBe(HINT.props.hint)
    await ui.unmount()
  },
)

test('the turn line drops "still running" while Rabe shows running shells', async ($, on) => {
  engine(on, [dev])
  const ui = await $.ui.mount({ surface: 'terminal', ...TURN } as never)
  expect(await ui.find({ key: 'engine-turn' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Brewed for 5s' })).toBeDefined()
  await ui.unmount()
})

test('the turn line stays the engine own while an agent runs', async ($, on) => {
  engine(on, [dev, explore])
  const ui = await $.ui.mount({ surface: 'terminal', ...TURN } as never)
  expect(await ui.find({ key: 'engine-turn' })).toBeDefined()
  await ui.unmount()
})

test('the turn line stays the engine own while no shell or monitor runs', async ($, on) => {
  engine(on, [])
  const ui = await $.ui.mount({ surface: 'terminal', ...TURN } as never)
  expect(await ui.find({ key: 'engine-turn' })).toBeDefined()
  await ui.unmount()
})
