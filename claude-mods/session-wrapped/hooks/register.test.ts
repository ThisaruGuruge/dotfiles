import { expect, test } from 'claude-code/testing'

import { bar, formatDuration } from './register'

const PANE = {
  plugin: 'session-wrapped',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'session-wrapped',
  props: {
    title: 'Session wrapped',
    isFocused: false,
    bodyColumns: 80,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('counts tool calls and edited files in the summary', async ($, on) => {
  on('tool.call', () => ({ result: 'ok', ref: 1, text: '' }) as never)
  on('clock.now', () => ({ value: 65_000 }))
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { window: 1_000_000 },
    rateLimits: [],
    cost: { usd: 1.5 },
  } }))

  await $.tool.call({ tool: 'Edit', file_path: '/r/a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/r/a.ts', old_string: 'b', new_string: 'c' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)

  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: 'Time 1m 5s' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Cost $1.50' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Files edited 1' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Top tools \(3 calls\)/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^Edit\s+█+ 2/ })).toBeDefined()
})

test('a denied or failed edit is not counted as a file edited', async ($, on) => {
  on('tool.call', ($, e) => {
    const path = (e as unknown as { file_path?: string }).file_path
    if (path === '/r/denied.ts') return { deny: 'blocked by a hook' } as never
    if (path === '/r/failed.ts') return { result: 'old_string not found', isError: true } as never
    return { result: 'ok', ref: 1, text: '' } as never
  })
  on('clock.now', () => ({ value: 1_000 }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))

  await $.tool.call({ tool: 'Write', file_path: '/r/denied.ts', content: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/r/failed.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/r/ok.ts', old_string: 'a', new_string: 'b' } as never)

  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: 'Files edited 1' })).toBeDefined()
  // every call still counts as a tool call
  expect(await pane.find({ type: 'Text', text: /Top tools \(3 calls\)/ })).toBeDefined()
})

test('formats durations and bars', () => {
  expect(formatDuration(45_000)).toBe('45s')
  expect(formatDuration(125_000)).toBe('2m 5s')
  expect(formatDuration(3_900_000)).toBe('1h 5m')
  expect(bar(5, 10, 10)).toBe('█████')
  expect(bar(0, 0)).toBe('')
})
