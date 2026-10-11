import { expect, test } from 'claude-code/testing'

import { ago, clockTime, day, duration, short, tokens, usd } from './format'

test('duration reads seconds, minutes and hours', () => {
  expect(duration(52_000)).toBe('52s')
  expect(duration(72_000)).toBe('1m12s')
  expect(duration(242_000)).toBe('4m02s')
  expect(duration(3_720_000)).toBe('1h02m')
  expect(duration(-5)).toBe('0s')
})

test('short drops the seconds past a minute', () => {
  expect(short(48_000)).toBe('48s')
  expect(short(242_000)).toBe('4m')
  expect(short(3_720_000)).toBe('1h02m')
})

test('ago says how long since', () => {
  expect(ago(3_000)).toBe('just now')
  expect(ago(120_000)).toBe('2m ago')
  expect(ago(7_200_000)).toBe('2h ago')
})

test('tokens and dollars read short', () => {
  expect(tokens(820)).toBe('820')
  expect(tokens(41_200)).toBe('41k')
  expect(tokens(1_210_000)).toBe('1.2M')
  expect(usd(0.16)).toBe('$0.16')
  expect(usd(4.8)).toBe('$4.80')
})

test('clock time pads hours, minutes and seconds', () => {
  expect(clockTime(new Date(2026, 9, 8, 9, 5, 7).getTime())).toBe('09:05:07')
})

test('day names today, yesterday or the date, with the time', () => {
  const now = new Date(2026, 9, 8, 10, 0).getTime()
  expect(day(new Date(2026, 9, 8, 9, 5).getTime(), now)).toBe('today 09:05')
  expect(day(new Date(2026, 9, 7, 17, 40).getTime(), now)).toBe('yesterday 17:40')
  expect(day(new Date(2026, 9, 1, 8, 0).getTime(), now)).toBe('2026-10-01 08:00')
})
