import { expect, test } from 'claude-code/testing'

import { itemId, mergeItem, type RabeItem } from './model'

test('an item id joins kind and native id', () => {
  expect(itemId('codex', 'task-1')).toBe('codex:task-1')
})

test('merge overwrites fields and merges detail', () => {
  const shell: RabeItem = {
    id: 'shell:bg_1',
    kind: 'shell',
    title: 'bun run lint',
    status: 'running',
    seenAt: 1,
    detail: { command: 'bun run lint', taskId: 'bg_1' },
  }
  expect(mergeItem(shell, { status: 'failed', detail: { exitCode: 2 } })).toEqual({
    ...shell,
    status: 'failed',
    detail: { command: 'bun run lint', taskId: 'bg_1', exitCode: 2 },
  })
})
