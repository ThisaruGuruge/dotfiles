import { expect, test } from 'claude-code/testing'

import { costumeOf, fillBar, fmt, fmtTime, modelName, targetOf, windowOf } from './format'

test('picks a costume by agent type, with or without a plugin prefix', () => {
  expect(costumeOf('Explore')).toBe('🧭')
  expect(costumeOf('Plan')).toBe('📐')
  expect(costumeOf('engineering:code-review')).toBe('🔬')
  expect(costumeOf('something-else')).toBe('🦀')
})

test('formats model ids, tokens and time', () => {
  expect(modelName('claude-sonnet-5-5')).toBe('Sonnet 5.5')
  expect(modelName('claude-haiku-5')).toBe('Haiku 5')
  expect(modelName('mystery')).toBe('mystery')
  expect(fmt(950)).toBe('950')
  expect(fmt(34_200)).toBe('34k')
  expect(fmtTime(65_000)).toBe('1:05')
  expect(windowOf('claude-opus-5-5', 1_000_000)).toBe(1_000_000)
  expect(windowOf('claude-haiku-5', 1_000_000)).toBe(200_000)
  expect(windowOf('claude-opus-5-5')).toBe(200_000)
})

test('draws a fill bar and shortens targets', () => {
  expect(fillBar(50, 100, 4)).toBe('▰▰▱▱')
  expect(fillBar(500, 100, 4)).toBe('▰▰▰▰')
  expect(targetOf({ file_path: '/a/b/c.ts' })).toBe('b/c.ts')
  expect(targetOf({ command: 'echo   hi' })).toBe('echo hi')
})
