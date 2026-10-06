import { expect, test } from 'claude-code/testing'

import { targetOf } from './register'

const PANE = {
  plugin: 'mission-control',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'mission-control',
  props: {
    title: 'Mission control',
    isFocused: false,
    bodyColumns: 80,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('lists an Edit call and the file it touched', async ($, on) => {
  on('tool.call', () => ({ result: 'ok', ref: 1, text: '' }) as never)

  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/src/app.ts',
    old_string: 'a',
    new_string: 'b',
  } as never)

  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /✓ Edit src\/app\.ts/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'src/app.ts' })).toBeDefined()
})

test('marks a denied call as failed', async ($, on) => {
  on('tool.call', () => ({ deny: 'no' }))

  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' } as never)

  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /✗ Bash rm -rf/ })).toBeDefined()
})

test('shortens targets', () => {
  expect(targetOf({ file_path: '/a/b/c/d.ts' })).toBe('c/d.ts')
  expect(targetOf({ command: 'echo   hi' })).toBe('echo hi')
  expect(targetOf({})).toBe('')
})
