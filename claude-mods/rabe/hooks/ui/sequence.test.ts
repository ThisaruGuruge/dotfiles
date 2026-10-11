import { expect, test } from 'claude-code/testing'

import { reserve, sequence } from './sequence'

test('queued focus work runs in order and continues after a failure', async () => {
  const seen: number[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const first = sequence(async () => {
    await gate
    seen.push(1)
    throw new Error('focus failed')
  })
  const second = sequence(async () => {
    seen.push(2)
  })
  release()
  await expect(first).rejects.toThrow('focus failed')
  await second
  expect(seen).toEqual([1, 2])
})

test('a reserved focus turn keeps later arrows behind the press that entered first', async () => {
  const seen: string[] = []
  const apply = reserve()
  const arrow = sequence(async () => {
    seen.push('arrow')
  })
  await apply(async () => {
    seen.push('press focus')
  })
  await arrow
  expect(seen).toEqual(['press focus', 'arrow'])
})

test('releasing a reserved focus turn lets arrows run while side effects wait', async () => {
  const seen: string[] = []
  const apply = reserve()
  await apply(async () => {
    seen.push('focus')
  })
  let finish!: () => void
  const sideEffect = new Promise<void>(resolve => {
    finish = resolve
  })
  const arrow = sequence(async () => {
    seen.push('arrow')
  })
  await arrow
  finish()
  await sideEffect
  expect(seen).toEqual(['focus', 'arrow'])
})
