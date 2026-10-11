import { expect, test } from 'claude-code/testing'

import {
  bar,
  cell,
  clamp,
  decode,
  encode,
  fit,
  grid,
  lines,
  paste,
  safe,
  spans,
  wrap,
  write,
} from './grid'
import { DEFAULT } from './palette'

test('a new grid holds spaces in the terminal default colors', () => {
  const g = grid(3, 2)
  expect(lines(g)).toEqual(['', ''])
  expect(cell(g, 2, 1)).toEqual([32, DEFAULT, DEFAULT])
})

test('write puts text at a position, clips at the edge and returns the next column', () => {
  const g = grid(6, 2)
  expect(write(g, 1, 0, 'abc', { fg: 0xff0000 })).toBe(4)
  expect(write(g, 4, 1, 'xyz')).toBe(7)
  expect(write(g, 0, 5, 'gone')).toBe(4)
  expect(lines(g)).toEqual([' abc', '    xy'])
  expect(cell(g, 1, 0)).toEqual([97, 0xff0000, DEFAULT])
})

test('write keeps the background a style leaves out', () => {
  const g = grid(2, 1, { bg: 0x112233 })
  write(g, 0, 0, 'a', { fg: 0x445566 })
  expect(cell(g, 0, 0)).toEqual([97, 0x445566, 0x112233])
})

test('safe keeps width-1 BMP characters and replaces the rest', () => {
  expect(safe('ok ◐ ▶ ✗ ◉ ⟳ ─│█')).toBe('ok ◐ ▶ ✗ ◉ ⟳ ─│█')
  expect(safe('a\tb\nc')).toBe('a b c')
  expect(safe('🚀 done')).toBe('? done')
  expect(safe('日本')).toBe('??')
  expect(safe('é')).toBe('e?')
  expect(safe('✅ ok')).toBe('? ok')
  expect(safe('नमस्ते')).toBe('??????')
  expect(safe('a\u200db')).toBe('a?b')
  expect(safe('\u1160\u11a8\ud7b0')).toBe('???')
})

test('safe keeps an allow list of width-1 characters; anything else is a stand-in', () => {
  expect(safe('☰ menu')).toBe('? menu')
  expect(safe('⚙★♥☺')).toBe('????')
  expect(safe('Grüße, Ωmega, Жук, Łódź, ő € → ░▒ ¿')).toBe('Grüße, Ωmega, Жук, Łódź, ő € → ░▒ ¿')
  expect(safe('· … ≈ ≥ ⎇ ⎿ ■ ▶ ▸ ▾ ◉ ● ◐ ◷ ⚠ ✓ ✗ ✻ ⟳ ⧉')).toBe(
    '· … ≈ ≥ ⎇ ⎿ ■ ▶ ▸ ▾ ◉ ● ◐ ◷ ⚠ ✓ ✗ ✻ ⟳ ⧉',
  )
  expect(safe('\u0378\u00ad\u2060x')).toBe('???x')
})

test('fit pads short text and cuts long text with an ellipsis', () => {
  expect(fit('abc', 5)).toBe('abc  ')
  expect(fit('abcdef', 4)).toBe('abc…')
  expect(fit('abc', 0)).toBe('')
  expect(fit('🚀ab', 3)).toBe('?ab')
})

test('bar fills a width in eighths of a block', () => {
  expect(bar(1, 1, 4)).toBe('████')
  expect(bar(0, 1, 4)).toBe('    ')
  expect(bar(1, 2, 4)).toBe('██  ')
  expect(bar(1, 16, 2)).toBe('▏ ')
  expect(bar(5, 0, 3)).toBe('   ')
})

test('clamp cuts a grid to the 512 columns and 256 rows a Raster takes', () => {
  const small = grid(3, 2)
  expect(clamp(small)).toBe(small)
  const big = grid(600, 300)
  write(big, 0, 0, 'a')
  const cut = clamp(big)
  expect([cut.columns, cut.rows]).toEqual([512, 256])
  expect(cell(cut, 0, 0)[0]).toBe(97)
})

test('paste copies one grid into another and clips it', () => {
  const g = grid(4, 2)
  const small = grid(3, 1)
  write(small, 0, 0, 'xyz', { fg: 0x0000ff })
  paste(g, small, 2, 1)
  expect(lines(g)).toEqual(['', '  xy'])
  expect(cell(g, 2, 1)).toEqual([120, 0x0000ff, DEFAULT])
})

test('encode gives little-endian u32 triplets in padded base64', () => {
  const g = grid(1, 1)
  write(g, 0, 0, '█', { fg: 0xff8800 })
  expect(encode(g)).toBe('iCUAAACI/wAAAAAB')
  const two = grid(2, 1)
  write(two, 0, 0, 'A', { fg: 1, bg: 2 })
  write(two, 1, 0, 'B', { fg: 3, bg: 4 })
  expect(encode(two)).toBe('QQAAAAEAAAACAAAAQgAAAAMAAAAEAAAA')
  expect(decode(2, 1, encode(two))).toEqual(two)
})

test('spans write runs of styled text and cut the last with an ellipsis', () => {
  const g = grid(8, 1)
  expect(
    spans(g, 0, 0, [
      ['ab', { fg: 1 }],
      [' cdefgh', { fg: 2 }],
    ]),
  ).toBe(8)
  expect(lines(g)).toEqual(['ab cdef…'])
  expect(cell(g, 0, 0)[1]).toBe(1)
  expect(cell(g, 3, 0)[1]).toBe(2)
  expect(spans(grid(4, 1), 0, 0, [['ab']], 10)).toBe(2)
})

test('wrap splits at spaces, breaks long words and keeps line breaks', () => {
  expect(wrap('the quick brown fox', 9)).toEqual(['the quick', 'brown fox'])
  expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  expect(wrap('one\ntwo', 10)).toEqual(['one', 'two'])
  expect(wrap('x', 0)).toEqual([])
})

test('wrap keeps a list marker with the start of a long file path', () => {
  for (const marker of ['-', '*', '+', '1.', '12.']) {
    expect(wrap(`${marker} /abs/path/to/file.ts`, 12)).toEqual([
      `${marker} /abs/path/to/file.ts`.slice(0, 12),
      `${marker} /abs/path/to/file.ts`.slice(12),
    ])
  }
})
