import { expect, test } from 'claude-code/testing'

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

test('draws one row per running agent above the prompt', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('ui.render', { component: 'AbovePrompt' }, async () => ({ type: 'Box', props: { key: 'engine' } }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)

  await $.agent.spawn({ prompt: 'x', description: 'Bug hunt', subagentType: 'general-purpose' })

  const band = await $.ui.mount({
    plugin: 'agents',
    surface: 'terminal',
    component: 'AbovePrompt',
    requestId: 'band',
    props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  } as never)

  expect(await band.find({ type: 'Text', text: 'general-purpose' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
})
