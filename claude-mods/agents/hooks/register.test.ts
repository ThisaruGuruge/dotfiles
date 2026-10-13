import { expect, test } from 'claude-code/testing'

import { rowsModeOf } from './register'

const PANE = {
  plugin: 'agents',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'agents',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 100,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('lists a spawned subagent with its type, model and label', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }) as never)

  await $.agent.spawn({ prompt: 'find auth', description: 'Find auth flow', subagentType: 'Explore' })

  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /Agents \(1 running, 1 total\)/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Explore/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Sonnet 5\.5/ })).toBeDefined()
})

test('shows an empty pane before any subagent', async ($) => {
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: 'No subagents yet.' })).toBeDefined()
})

const BAND = {
  plugin: 'agents',
  surface: 'terminal',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as never

const pane = (over: Record<string, boolean> = {}) => ({
  id: 'agents',
  title: 'Agents',
  isShown: true,
  isFocused: false,
  isPlaced: true,
  ...over,
})

// Spawns one running agent; `panes` is what the engine reports as the plugin's open panes.
const spawnWith = async ($: any, on: any, panes: unknown[]) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('ui.render', { component: 'AbovePrompt' }, async () => ({ type: 'Box', props: { key: 'engine' } }))
  on('ui.panes', () => ({ value: panes }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
  await $.agent.spawn({ prompt: 'x', description: 'Bug hunt', subagentType: 'general-purpose' })
}

test('auto: draws one row per running agent above the prompt while the pane is closed', async ($, on) => {
  await spawnWith($, on, [])

  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
})

test('auto: draws no rows while the pane is open and showing', async ($, on) => {
  await spawnWith($, on, [pane()])

  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeUndefined()
})

test('auto: falls back to rows while the pane waits undrawn on a narrow terminal', async ($, on) => {
  await spawnWith($, on, [pane({ isPlaced: false })])

  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeDefined()
})

test('auto: falls back to rows while the pane is a tab behind another', async ($, on) => {
  await spawnWith($, on, [pane({ isShown: false })])

  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeDefined()
})

test('rows off: never draws rows, even with the pane closed', { options: { rows: 'off' } }, async ($, on) => {
  await spawnWith($, on, [])

  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeUndefined()
})

test('rows always: draws rows even while the pane is open', { options: { rows: 'always' } }, async ($, on) => {
  await spawnWith($, on, [pane()])

  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeDefined()
})

test('auto: rows reappear when the pane closes (ui.close redraws the band)', async ($, on) => {
  let panes: unknown[] = [pane()]
  on('clock.now', () => ({ value: 1_000 }))
  on('ui.render', { component: 'AbovePrompt' }, async () => ({ type: 'Box', props: { key: 'engine' } }))
  on('ui.panes', () => ({ value: panes }))
  on('session.start', async () => ({ cwd: '/p' }) as never)
  on('command.register', async () => ({ value: { command: 'agents-pane' } }) as never)
  on('ui.close', () => {
    panes = []
    return { value: undefined } as never
  })
  on('clock.every', () => ({ value: 1 }) as never)
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
  await $.agent.spawn({ prompt: 'x', description: 'Bug hunt', subagentType: 'general-purpose' })

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeUndefined()

  await $.command.run({ command: 'agents-pane', args: '' } as never)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeDefined()
})

test('rowsModeOf falls back to auto for bad input', () => {
  expect(rowsModeOf(undefined)).toBe('auto')
  expect(rowsModeOf(3)).toBe('auto')
  expect(rowsModeOf('bogus')).toBe('auto')
  expect(rowsModeOf('off')).toBe('off')
  expect(rowsModeOf('always')).toBe('always')
})

const finished = { answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', agentId: 'a1', reason: 'answer' } as never

test('a finished agent continued in the same session runs again', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)

  await $.agent.spawn({ prompt: 'find auth', description: 'Find auth flow', subagentType: 'Explore' })
  await $.turn.complete(finished)

  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /Agents \(0 running, 1 total\)/ })).toBeDefined()

  await $.tool.call({ tool: 'Bash', input: { command: 'ls' }, agentId: 'a1' } as never)

  expect(await pane.find({ type: 'Text', text: /Agents \(1 running, 1 total\)/ })).toBeDefined()
})

test('a finished agent sending a request again runs again', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  // biome-ignore lint/correctness/useYield: the engine's stand-in answers without chunks
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn' } as never
  })

  await $.agent.spawn({ prompt: 'find auth', description: 'Find auth flow', subagentType: 'Explore' })
  await $.turn.complete(finished)
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: 'm', messageCount: 1, agentId: 'a1' } as never));

  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /Agents \(1 running, 1 total\)/ })).toBeDefined()
})

test('a finished agent stays finished until it starts work again', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)

  await $.agent.spawn({ prompt: 'find auth', description: 'Find auth flow', subagentType: 'Explore' })
  await $.turn.complete(finished)
  await $.turn.complete(finished)

  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /Agents \(0 running, 1 total\)/ })).toBeDefined()
})

test('adopts a resumed agent that never fired agent.spawn', async ($, on) => {
  on('clock.now', () => ({ value: 2_000 }))
  on('tool.call', () => ({ result: 'ok' }) as never)

  await $.tool.call({ tool: 'Bash', input: { command: 'ls' }, agentId: 'resumed-1' } as never)

  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /Agents \(1 running, 1 total\)/ })).toBeDefined()
})
