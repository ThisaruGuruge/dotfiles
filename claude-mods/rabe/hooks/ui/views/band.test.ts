import { expect, test } from 'claude-code/testing'

import type { RabeItem } from '../../model'
import { cell, lines } from '../cells/grid'
import { C, CHIP } from '../cells/palette'
import { ci, dev, explore, flow, gridOf, NOW, PRICED, verify } from '../fixtures'
import { NO_SELECTION, type Size } from '../view'
import { bandView } from './band'

const SIZE: Size = { columns: 100, rows: 10, surface: 'terminal', hasInput: false }
const model = (items = PRICED) => ({ items, turns: {}, lines: {}, now: NOW, usd: 0.31 })

// The column where `text` starts in row `y`: every cell holds one character.
const at = (shown: string[], y: number, text: string) => shown[y]?.indexOf(text) ?? -1

test('the band is one line of count chips under an empty row, failed first', () => {
  const { grid } = gridOf(bandView(model(), { ...SIZE, columns: 180 }, NO_SELECTION))
  const shown = lines(grid)
  expect(grid.rows).toBe(2)
  expect(shown[0]?.trim()).toBe('')
  expect(shown[1]).toMatch(/^ ✗ 1 shell failed/)
  expect(shown[1]).toContain('session ≈ $0.31')
  expect(shown[1]).toContain('◐ 2 claude')
  expect(shown[1]).toContain('bg 91k tok, 20% cached')
  expect(cell(grid, at(shown, 1, '▶'), 1).slice(1)).toEqual([CHIP.shell.fg, CHIP.shell.bg])
  expect(cell(grid, at(shown, 1, '≈'), 1)[1]).toBe(C.bright)
  expect(cell(grid, at(shown, 1, '91k'), 1)[1]).toBe(C.dim)
})

test('the band drops the empty row when maxRows leaves room for one row only', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const [rows, drawn] of [
      [1, 1],
      [2, 2],
      [3, 2],
    ] as const) {
      const { grid } = gridOf(
        bandView(model(), { ...SIZE, columns: 120, rows, surface }, NO_SELECTION),
      )
      const shown = lines(grid)
      expect(grid.rows).toBe(drawn)
      expect(shown.at(-1)).toContain('◐ 2 agent')
      expect(shown.at(-1)).toContain('session ≈ $0.31')
    }
  }
})

test('the band shows the session cost when Rabe knows it', () => {
  const shown = lines(
    gridOf(bandView({ ...model(), usd: 0.41 }, { ...SIZE, columns: 120 }, NO_SELECTION)).grid,
  )
  expect(shown[1]).toContain('session ≈ $0.41')
})

test('the band keeps the cached share after the two scope labels', () => {
  const item = { ...explore, tokens: { input: 457_000, output: 59_000, cached: 417_000 } }
  const shown = lines(gridOf(bandView(model([item]), { ...SIZE, columns: 120 }, NO_SELECTION)).grid)
  expect(shown[1]).toContain('session ≈ $0.31 · bg 516k tok, 81% cached')
})

test('the band keeps full labels and token cost when they fit at 60 columns', () => {
  const shown = lines(
    gridOf(
      bandView({ ...model([explore, dev]), usd: 0.41 }, { ...SIZE, columns: 60 }, NO_SELECTION),
    ).grid,
  )
  expect(shown[1]).toContain('◐ 1 claude')
  expect(shown[1]).toContain('▶ 1 shell')
  expect(shown[1]).toContain('session ≈ $0.41 · bg 41k tok')
  expect(shown[1]).not.toContain(' cl ')
})

test('the band shortens readable labels before dropping token cost when space is tight', () => {
  const shown = lines(
    gridOf(bandView({ ...model(), usd: 0.41 }, { ...SIZE, columns: 60 }, NO_SELECTION)).grid,
  )
  expect(shown[1]).toContain('≈ $0.41')
  expect(shown[1]).not.toContain('tok')
  expect(shown[1]).toContain('1 shell failed')
  expect(shown[1]).toContain('2 agent')
  expect(shown[1]).not.toContain(' f ')
})

test('the band shortens labels at 100 columns to keep token cost when full labels do not fit', () => {
  const shown = lines(
    gridOf(bandView({ ...model(), usd: 0.41 }, { ...SIZE, columns: 100 }, NO_SELECTION)).grid,
  )
  expect(shown[1]).toContain('◐ 2 agent')
  expect(shown[1]).toContain('◉ 1 mon')
  expect(shown[1]).toContain('session ≈ $0.41')
  expect(shown[1]).not.toContain('monitors')
})

test('shells and monitors an agent started count with the others', () => {
  const mine = {
    ...dev,
    id: 'shell:m',
    title: 'bun test',
    parentId: explore.id,
    detail: { command: 'bun test' },
  } as RabeItem
  const theirs = { ...ci, id: 'monitor:w', title: 'tail build.log', parentId: verify.id }
  const items = [mine, dev, theirs, ci, explore, verify, flow]
  const shown = lines(gridOf(bandView(model(items), SIZE, NO_SELECTION)).grid)
  expect(shown[1]).toContain('▶ 2 shells')
  expect(shown[1]).toContain('◉ 2 monitors')
})
