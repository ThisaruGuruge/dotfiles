import { expect, test } from 'claude-code/testing'

import { C, CHIP, DEFAULT, paint, xterm } from './palette'

const distinct = (list: number[]) => new Set(list).size === list.length

test('xterm finds the index of cube and grey entries and nothing else', () => {
  expect(xterm(0x000000)).toBe(16)
  expect(xterm(0xd7875f)).toBe(173)
  expect(xterm(0xffffff)).toBe(231)
  expect(xterm(0x8a8a8a)).toBe(245)
  expect(xterm(0xeeeeee)).toBe(255)
  expect(xterm(0x203020)).toBeUndefined()
  expect(xterm(DEFAULT)).toBeUndefined()
})

test('every palette color is an xterm-256 entry, so tmux keeps it', () => {
  const colors = [
    ...Object.values(C).filter(one => one !== DEFAULT),
    ...Object.values(CHIP).flatMap(chip => [chip.fg, chip.bg]),
  ]
  for (const one of colors) expect(xterm(one)).toBeGreaterThanOrEqual(16)
})

test('the colors drawn side by side stay apart', () => {
  const { dim, bright, orange, yellow, green, red, blue, purple, cyan } = C
  expect(distinct([dim, bright, orange, yellow, green, red, blue, purple, cyan])).toBe(true)
  expect(distinct([C.selected, C.panel, C.raised, C.rule])).toBe(true)
  const chips = [CHIP.agent, CHIP.codex, CHIP.workflow, CHIP.shell, CHIP.monitor, CHIP.cron]
  expect(distinct([...chips, CHIP.failed, CHIP.cost].map(chip => chip.bg))).toBe(true)
  expect(distinct([...chips, CHIP.failed, CHIP.cost].map(chip => chip.fg))).toBe(true)
})

test('paint names a 256 color on the terminal and hex elsewhere', () => {
  expect(paint(C.orange, 'terminal')).toBe('ansi256(173)')
  expect(paint(C.orange, 'desktop')).toBe('#d7875f')
  expect(paint(CHIP.monitor.bg, 'desktop')).toBe('#00005f')
  expect(paint(DEFAULT, 'terminal')).toBeUndefined()
  expect(paint(undefined, 'desktop')).toBeUndefined()
})
