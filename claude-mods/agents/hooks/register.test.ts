import { expect, test } from 'claude-code/testing'

import { pickAgent, rowsModeOf } from './register'

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

// Transcript view

const spawnExplore = async ($: any, on: any, agents: unknown[], calls: string[] = []) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'abc12345' }) as never)
  on('agent.list', () => {
    calls.push('list')
    return { value: agents } as never
  })
  await $.agent.spawn({ prompt: 'find auth', description: 'Find auth flow', subagentType: 'Explore' })
}
const live = [{ id: 'abc12345', description: 'x', type: 'Explore', status: 'running' }]

test('pressing an agent row opens its transcript', async ($, on) => {
  const asked: unknown[] = []
  on('ui.view', (_$, e) => {
    asked.push(e)
    return { value: {} } as never
  })
  await spawnExplore($, on, live)

  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'view-abc12345' })

  expect(asked).toEqual([{ agentId: 'abc12345' }])
})

test('the pane shows how to open a transcript and marks the agent in view', async ($, on) => {
  await spawnExplore($, on, live)

  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, view: { agentId: 'abc12345' } } } as never)

  expect(await pane.find({ type: 'Text', text: /Ctrl\+X then Tab: focus pane/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /viewing/ })).toBeDefined()
  expect(await pane.find({ type: 'Button', key: 'view-back' } as never)).toBeDefined()
})

test('/agents-pane view 1 opens the newest agent; back returns to the main view', async ($, on) => {
  const asked: unknown[] = []
  on('ui.view', (_$, e) => {
    asked.push(e)
    return { value: {} } as never
  })
  await spawnExplore($, on, live)

  const opened = await $.command.run({ command: 'agents-pane', args: 'view 1' } as never)
  const back = await $.command.run({ command: 'agents-pane', args: 'back' } as never)

  expect(asked).toEqual([{ agentId: 'abc12345' }, {}])
  expect(JSON.stringify(opened)).toMatch(/Viewing Explore/)
  expect(JSON.stringify(back)).toMatch(/Back to the main/)
})

test('an agent the engine no longer tracks fails with a sentence, not a throw', async ($, on) => {
  on('ui.view', () => ({ value: { deny: 'that agent has ended' } }) as never)
  await spawnExplore($, on, [])

  const out = await $.command.run({ command: 'agents-pane', args: 'view 1' } as never)

  expect(JSON.stringify(out)).toMatch(/unavailable/)
})

test('a press calls $.ui.view first, with nothing awaited before it, and returns the promise', async ($, on) => {
  // Claude Code denies "not person-initiated" once the press handler has returned or after another call was awaited
  // first; the harness cannot end a press early, so this pins the order of host calls and the toast after it.
  const calls: string[] = []
  on('ui.view', () => {
    calls.push('view')
    return { value: {} } as never
  })
  await spawnExplore($, on, live, calls)
  calls.length = 0

  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'view-abc12345' })

  expect(calls).toEqual(['view'])
})

test('a press denied as not person-initiated tells the person instead of failing', async ($, on) => {
  const toasts: string[] = []
  on('ui.view', () => ({ value: { deny: 'not person-initiated' } }) as never)
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  await spawnExplore($, on, live)

  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'view-abc12345' })

  expect(toasts.join()).toMatch(/key press or a command/)
})

test('a refused view says why; an unknown number is reported', async ($, on) => {
  on('ui.view', () => ({ value: { deny: 'the view moved meanwhile' } }) as never)
  await spawnExplore($, on, live)

  expect(JSON.stringify(await $.command.run({ command: 'agents-pane', args: 'view 1' } as never))).toMatch(/view moved/)
  expect(JSON.stringify(await $.command.run({ command: 'agents-pane', args: 'view 7' } as never))).toMatch(/No such agent/)
})

test('pickAgent counts from the newest and matches an id prefix', () => {
  const mk = (id: string) => ({ id, agentId: id }) as never
  const all = [mk('aaa111'), mk('bbb222')]
  expect(pickAgent(all, '1')).toMatchObject({ id: 'bbb222' })
  expect(pickAgent(all, '2')).toMatchObject({ id: 'aaa111' })
  expect(pickAgent(all, 'aaa')).toMatchObject({ id: 'aaa111' })
  expect(pickAgent(all, 'a')).toBeUndefined()
})
