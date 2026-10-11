import { expect, test } from 'claude-code/testing'

import type { NewItem } from './model'
import {
  addItem,
  capEnded,
  commit,
  endItem,
  MAX_ENDED,
  pastEnd,
  prune,
  updateItem,
} from './registry'

const shell: NewItem = {
  id: 'shell:bg_1',
  kind: 'shell',
  title: 'bun test --watch',
  status: 'running',
  startedAt: 100,
  detail: { command: 'bun test --watch', taskId: 'bg_1' },
}

test('add appends a new item with the time Rabe saw it', () => {
  expect(addItem([], shell, 500)).toEqual([{ ...shell, seenAt: 500 }])
})

test('add merges into an existing item and keeps seenAt', () => {
  const items = addItem([{ ...shell, seenAt: 500 }], { ...shell, title: 'tests' }, 900)
  expect(items).toEqual([{ ...shell, title: 'tests', seenAt: 500 }])
})

test('add returns the same list when nothing changed', () => {
  const items = [{ ...shell, seenAt: 500 }]
  expect(addItem(items, shell, 900)).toBe(items)
})

test('update merges fields and detail', () => {
  const items = updateItem([{ ...shell, seenAt: 500 }], shell.id, {
    tokens: { input: 1, output: 2 },
    detail: { exitCode: 2 },
  })
  expect(items[0]).toEqual({
    ...shell,
    seenAt: 500,
    tokens: { input: 1, output: 2 },
    detail: { command: 'bun test --watch', taskId: 'bg_1', exitCode: 2 },
  })
})

test('update returns the same list for an unknown id or no change', () => {
  const items = [{ ...shell, seenAt: 500 }]
  expect(updateItem(items, 'shell:nope', { title: 'x' })).toBe(items)
  expect(updateItem(items, shell.id, { title: shell.title })).toBe(items)
})

test('end sets status and end time once', () => {
  const ended = endItem([{ ...shell, seenAt: 500 }], shell.id, 'failed', 800)
  expect(ended[0]?.status).toBe('failed')
  expect(ended[0]?.endedAt).toBe(800)
  expect(endItem(ended, shell.id, 'done', 900)).toBe(ended)
})

test('cap drops the oldest ended items and keeps every running one', () => {
  const items = [1, 2, 3, 4].map(n => ({
    ...shell,
    id: `shell:${n}`,
    seenAt: n,
    ...(n === 2 ? {} : { status: 'done' as const, endedAt: n }),
  }))
  expect(capEnded(items, 1).map(item => item.id)).toEqual(['shell:2', 'shell:4'])
  expect(capEnded(items, 3)).toBe(items)
})

test('commit answers undefined when nothing changed, else the capped list and the ids it drops', () => {
  const items = [{ ...shell, seenAt: 500 }]
  expect(commit(items, held => updateItem(held, shell.id, { title: shell.title }))).toBeUndefined()
  expect(commit(undefined, held => addItem(held, shell, 500))).toEqual({ items, dropped: [] })
  const many = Array.from({ length: MAX_ENDED + 1 }, (_, n) => ({
    ...shell,
    id: `shell:${n}`,
    seenAt: n,
    status: 'done' as const,
  }))
  const next = commit(many, held => held.slice())
  expect(next?.items).toHaveLength(MAX_ENDED)
  expect(next?.dropped).toEqual(['shell:0'])
})

test('commit names an item the change added and the cap dropped at once', () => {
  const ended = Array.from({ length: MAX_ENDED }, (_, n) => ({
    ...shell,
    id: `shell:${n}`,
    seenAt: 10 + n,
    endedAt: 10 + n,
    status: 'done' as const,
  }))
  const old: NewItem = { ...shell, id: 'shell:old', status: 'done', endedAt: 1 }
  const running = [...ended, { ...shell, id: 'shell:x', seenAt: 5 }]
  const ending = commit(running, held => addItem(endItem(held, 'shell:x', 'done', 3000), old, 3000))
  expect(ending?.dropped).toEqual(['shell:0', 'shell:old'])
})

test('cap drops, of two items that ended at once, the one Rabe saw later', () => {
  const items = [1, 2, 3].map(n => ({
    ...shell,
    id: `shell:${n}`,
    seenAt: n,
    status: 'done' as const,
    endedAt: 7,
  }))
  expect(capEnded(items, 2).map(item => item.id)).toEqual(['shell:1', 'shell:2'])
})

test('an ended item Rabe did not watch takes the oldest end held, none once the cap is full', () => {
  const ended = (n: number) => ({ ...shell, id: `shell:${n}`, seenAt: n, status: 'done' as const })
  expect(pastEnd([], 900)).toBe(900)
  expect(pastEnd([{ ...shell, seenAt: 1 }], 900)).toBe(900)
  expect(pastEnd([ended(40), { ...ended(30), endedAt: 50 }], 900)).toBe(40)
  expect(pastEnd([ended(40), ended(30)], 900, 2)).toBeUndefined()
})

test('prune drops only the entries of the ids a write dropped, not one a later write added', () => {
  const record = { 'shell:old': 1, 'shell:new': 2 }
  // The list read before pruning may not hold `shell:new` yet; it stays all the same.
  expect(prune(record, ['shell:old'], [])).toEqual({ 'shell:new': 2 })
  expect(prune(record, ['shell:gone'], [])).toBe(record)
})

test('prune keeps the entry of a dropped id that is back in the list', () => {
  const record = { 'shell:old': 1 }
  expect(prune(record, ['shell:old'], [{ ...shell, id: 'shell:old', seenAt: 1 }])).toBe(record)
})

test('commit answers undefined when the cap drops what the change added', () => {
  const ended = Array.from({ length: MAX_ENDED }, (_, n) => ({
    ...shell,
    id: `shell:${n}`,
    seenAt: 1000 + n,
    endedAt: 1000 + n,
    status: 'done' as const,
  }))
  const old: NewItem = { ...shell, id: 'shell:old', status: 'done', endedAt: 1 }
  expect(commit(ended, held => addItem(held, old, 2000))).toBeUndefined()
})

test('add keeps seenAt when a full item comes back', () => {
  const items = addItem(
    [{ ...shell, seenAt: 1 }],
    { ...shell, title: 'tests', seenAt: 99 } as NewItem,
    900,
  )
  expect(items[0]?.seenAt).toBe(1)
})

test('update treats objects with the same values in another key order as no change', () => {
  const items = [{ ...shell, seenAt: 500, tokens: { input: 10, output: 20 } }]
  expect(updateItem(items, shell.id, { tokens: { output: 20, input: 10 } })).toBe(items)
})
