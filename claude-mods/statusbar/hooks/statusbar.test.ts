import { expect, test } from 'claude-code/testing'

import { barCells, cacheState, eta, fmt, hitColor, leftColor, tier, turnsLeft, legendItems, limitBar, paint } from './register'

const rows = [
  { name: 'System prompt', tokens: 3400, color: 'x', kind: 'used' as const },
  { name: 'Messages', tokens: 118000, color: 'x', kind: 'used' as const },
  { name: 'Skills', tokens: 6400, color: 'x', kind: 'used' as const },
  { name: 'Tiny', tokens: 100, color: 'x', kind: 'used' as const },
  { name: 'Free space', tokens: 800000, color: 'x', kind: 'free' as const },
  { name: 'Autocompact buffer', tokens: 33000, color: 'x', kind: 'buffer' as const },
]

test('fmt abbreviates token counts', async () => {
  expect(fmt(950)).toBe('950')
  expect(fmt(3400)).toBe('3.4k')
  expect(fmt(212000)).toBe('212k')
  expect(fmt(1000000)).toBe('1.0M')
})

test('eta is compact', async () => {
  const at = Date.parse('2026-01-01T00:00:00Z')
  expect(eta('2026-01-01T02:13:00Z', at)).toBe('2h13m')
  expect(eta('2026-01-06T05:00:00Z', at)).toBe('5d5h')
  expect(eta('2025-12-31T00:00:00Z', at)).toBe('now')
})

test('categories get distinct colors', async () => {
  const colors = rows.filter(r => r.kind === 'used').map(r => paint(r).color)
  expect(new Set(colors).size).toBe(colors.length - 1 + 1)
  expect(paint(rows[4]).color).toBe('#45475a')
})

test('barCells fills the width and marks the compact point', async () => {
  const cells = barCells(rows, 40, 30)
  expect(cells.length).toBe(40)
  expect(cells[30].ch).toBe('┃')
  expect(cells[0].ch).toBe('█')
})

test('legend folds tiny categories and keeps counts only', async () => {
  const items = legendItems(rows, 1000000, false).map(i => i.text)
  expect(items).toContain('messages 118k')
  expect(items.some(t => t.startsWith('other'))).toBe(true)
  expect(items.some(t => t.startsWith('free'))).toBe(true)
  expect(legendItems(rows, 1000000, true).map(i => i.text)).toContain('msg 118k')
})

test('limit bar fills with what is left and colors follow one ladder', async () => {
  expect(limitBar(90, 10)).toBe('▰▰▰▰▰▰▰▰▰▱')
  expect(limitBar(0, 6)).toBe('▱▱▱▱▱▱')
  expect(leftColor(60)).toBe('text')
  expect(leftColor(30)).toBe('#c98500')
  expect(leftColor(10)).toBe('#e66767')
  expect(hitColor(95)).toBe('text')
  expect(hitColor(20)).toBe('#e66767')
})

test('cache states: warm, expiring, cold', async () => {
  expect(cacheState(null)).toBeNull()
  expect(cacheState(252)).toEqual({ glyph: '●', color: '#199e70', text: '4:12' })
  expect(cacheState(48)?.glyph).toBe('◐')
  expect(cacheState(0)).toEqual({ glyph: '○', color: '#e66767', text: 'cold' })
})

test('turnsLeft estimates from recent growth', async () => {
  expect(turnsLeft([1000, 2000], 10000)).toBeNull()
  expect(turnsLeft([1000, 2000, 3000], 10000)).toBe(7)
  expect(turnsLeft([3000, 3000, 3000], 10000)).toBeNull()
  expect(turnsLeft([3000, 3001, 3002], 10000)).toBeNull()
  expect(turnsLeft([1000, 1300, 1600], 100000)).toBeNull()
  expect(turnsLeft([8000, 9000, 11000], 10000)).toBe(0)
})

test('width tiers', async () => {
  expect(tier(190)).toBe('wide')
  expect(tier(140)).toBe('mid')
  expect(tier(100)).toBe('narrow')
})
