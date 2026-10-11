import { expect, test } from 'claude-code/testing'

import { claudeUsd, codexUsd, findPrice, parsePrices, withOverride } from './prices'

const HEAD =
  'provider,model,aliases,input,output,cache_read,cache_write_5m,cache_write_1h,cache_write,cache_write_minutes,long_context_tokens,long_scope,long_input,long_output,long_cache_read,long_cache_write_5m,long_cache_write_1h,long_cache_write'
const CSV = [
  '# USD per million tokens',
  '# a comment, with commas',
  HEAD,
  'claude,claude-opus-5-5,,4,20,0.2,5,8,,,,,,,,,,',
  'claude,claude-opus-4-5-20251101,claude-opus-4-5,5,25,0.5,6.25,10,,,,,,,,,,',
  'claude,claude-haiku-5-5,,0.1,0.5,0.01,0.125,0.2,,,100000,request,0.5,2.5,0.05,0.625,1,',
  'claude,claude-no-cache,,1,5,,,,,,,,,,,,,',
  'openai,gpt-6.1-sol,,2,10,0.1,,,2.5,30,272000,request,4,15,0.2,,,5',
  'openai,gpt-5.4,,2.5,15,0.25,,,,,272000,session,5,22.5,0.5,,,',
  'openai,gpt-5.5-pro,,30,180,,,,,,272000,session,60,270,,,,',
  'openai,gpt-5.3-codex,,1.75,14,0.175,,,,,,,,,,,,',
  'openai,broken,,x,1,,,,,,,,,,,,,',
  'openai,no-output,,1,,,,,,,,,,,,,,',
  '',
].join('\n')

const prices = parsePrices(CSV)
// Rounds away the float noise of a sum of products.
const r = (n?: number) => (n === undefined ? n : Math.round(n * 1e9) / 1e9)
const claude = (input: number, read: number, write: number, output: number) => ({
  input_tokens: input,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write,
  output_tokens: output,
})
const M = 1_000_000

test('the comment lines are skipped and the next line is the header', () => {
  expect(prices.map(one => one.model)).toEqual([
    'claude-opus-5-5',
    'claude-opus-4-5-20251101',
    'claude-haiku-5-5',
    'claude-no-cache',
    'gpt-6.1-sol',
    'gpt-5.4',
    'gpt-5.5-pro',
    'gpt-5.3-codex',
  ])
})

test('a row with a cell that is not a number, or without input or output, is left out', () => {
  expect(findPrice(prices, 'openai', 'broken')).toBeUndefined()
  expect(findPrice(prices, 'openai', 'no-output')).toBeUndefined()
})

test('a file without a header row gives no prices', () => {
  expect(parsePrices('# only comments\n')).toEqual([])
  expect(parsePrices('a,b,c\n1,2,3\n')).toEqual([])
})

test('a model is found by its id or an alias, within its provider only', () => {
  expect(findPrice(prices, 'claude', 'claude-opus-4-5')?.model).toBe('claude-opus-4-5-20251101')
  expect(findPrice(prices, 'claude', 'claude-opus-4-5-20251101')?.model).toBe(
    'claude-opus-4-5-20251101',
  )
  expect(findPrice(prices, 'openai', 'claude-opus-5-5')).toBeUndefined()
  expect(findPrice(prices, 'claude', 'claude-unknown-9')).toBeUndefined()
  expect(findPrice(prices, 'claude', undefined)).toBeUndefined()
})

test('the header decides the columns, so an override may order them its own way', () => {
  const own = parsePrices('model,provider,output,input\nmy-model,claude,10,2\n')
  expect(claudeUsd(own, claude(M, 0, 0, M), 'my-model')).toBe(12)
})

test('override rows come first, also over an alias of a built-in row', () => {
  const over = parsePrices(`${HEAD}\nclaude,claude-opus-4-5,,1,1,,,,,,,,,,,,,\n`)
  const both = withOverride(prices, over)
  expect(claudeUsd(both, claude(M, 0, 0, M), 'claude-opus-4-5')).toBe(2)
  expect(claudeUsd(both, claude(M, 0, 0, 0), 'claude-opus-5-5')).toBe(4)
})

test('an override of a model also prices the built-in aliases of that model', () => {
  const byId = parsePrices(`${HEAD}\nclaude,claude-opus-4-5-20251101,,1,1,,,,,,,,,,,,,\n`)
  const both = withOverride(prices, byId)
  expect(claudeUsd(both, claude(M, 0, 0, 0), 'claude-opus-4-5')).toBe(1)
  expect(claudeUsd(both, claude(M, 0, 0, 0), 'claude-opus-4-5-20251101')).toBe(1)
  // an override by the alias also prices the built-in model ID
  const byAlias = withOverride(prices, parsePrices(`${HEAD}\nclaude,claude-opus-4-5,,1,1\n`))
  expect(claudeUsd(byAlias, claude(M, 0, 0, 0), 'claude-opus-4-5-20251101')).toBe(1)
  // a name another override row names itself keeps that row's price
  const two = parsePrices(
    `${HEAD}\nclaude,claude-opus-4-5-20251101,,1,1\nclaude,claude-opus-4-5,,2,2\n`,
  )
  const each = withOverride(prices, two)
  expect(claudeUsd(each, claude(M, 0, 0, 0), 'claude-opus-4-5')).toBe(2)
  expect(claudeUsd(each, claude(M, 0, 0, 0), 'claude-opus-4-5-20251101')).toBe(1)
  // within its provider only
  const other = withOverride(prices, parsePrices(`${HEAD}\nopenai,claude-opus-4-5,,1,1\n`))
  expect(claudeUsd(other, claude(M, 0, 0, 0), 'claude-opus-4-5-20251101')).toBe(5)
})

test('a Claude request bills uncached input, cache reads, cache writes at 5m and output', () => {
  // 1M uncached at 4, 2M read at 0.2, 1M written at 5, 1M out at 20
  expect(r(claudeUsd(prices, claude(M, 2 * M, M, M), 'claude-opus-5-5'))).toBe(r(29.4))
})

test('an empty cache column bills those tokens at the input price', () => {
  expect(claudeUsd(prices, claude(0, M, M, 0), 'claude-no-cache')).toBe(2)
})

test('an unknown model has no price', () => {
  expect(claudeUsd(prices, claude(10, 0, 0, 10), 'claude-unknown-9')).toBeUndefined()
})

test('Haiku 5.5 bills the whole request at the long rates above 100k of prompt', () => {
  // 100k prompt: base rates
  expect(r(claudeUsd(prices, claude(100_000, 0, 0, 0), 'claude-haiku-5-5'))).toBe(r(0.01))
  // 100,001 counted over uncached, reads and writes: every token at the long rates
  const usage = claude(1, 60_000, 40_000, 1000)
  const long = (1 * 0.5 + 60_000 * 0.05 + 40_000 * 0.625 + 1000 * 2.5) / M
  expect(r(claudeUsd(prices, usage, 'claude-haiku-5-5'))).toBe(r(long))
})

const codex = (input: number, cached: number, output: number, write = 0) => ({
  input,
  cached,
  write,
  output,
})

test('a Codex request bills input less cached at input, cached at the cached price', () => {
  // gpt-5.3-codex: 1M in, 0.6M of it cached, 1M out
  const usd = codexUsd(prices, [{ model: 'gpt-5.3-codex', ...codex(M, 600_000, M) }])
  expect(r(usd)).toBe(r(0.4 * 1.75 + 0.6 * 0.175 + 14))
})

test('Codex cache writes are part of the input and bill at the cache write price', () => {
  const usd = codexUsd(prices, [{ model: 'gpt-6.1-sol', ...codex(100_000, 20_000, 0, 30_000) }])
  expect(r(usd)).toBe(r((50_000 * 2 + 20_000 * 0.1 + 30_000 * 2.5) / M))
})

test('a Codex model without a cached price bills cached input at the input price', () => {
  expect(codexUsd(prices, [{ model: 'gpt-5.5-pro', ...codex(100_000, 100_000, 0) }])).toBe(3)
})

test('a Codex job sums its requests, each at its own model and tier', () => {
  const usd = codexUsd(prices, [
    { model: 'gpt-6.1-sol', ...codex(100_000, 0, 0) },
    { model: 'gpt-6.1-sol', ...codex(300_000, 100_000, 0) },
    { model: 'gpt-5.3-codex', ...codex(M, 0, 0) },
  ])
  expect(r(usd)).toBe(r(0.1 * 2 + (0.2 * 4 + 0.1 * 0.2) + 1.75))
})

test('a Codex job is n/a when any request has no price', () => {
  expect(codexUsd(prices, [])).toBeUndefined()
  const usage = codex(10, 0, 10)
  expect(codexUsd(prices, [{ model: 'gpt-5.3-codex', ...usage }, { ...usage }])).toBeUndefined()
  expect(
    codexUsd(prices, [
      { model: 'gpt-5.3-codex', ...usage },
      { model: 'codex-auto-review', ...usage },
    ]),
  ).toBeUndefined()
  // more cached than input: the counts do not add up
  expect(codexUsd(prices, [{ model: 'gpt-5.3-codex', ...codex(10, 20, 0) }])).toBeUndefined()
})

test('a request over the long tier of a model billed per session is n/a', () => {
  const small = { model: 'gpt-5.4', ...codex(272_000, 0, 0) }
  expect(r(codexUsd(prices, [small]))).toBe(r(0.272 * 2.5))
  expect(codexUsd(prices, [small, { model: 'gpt-5.4', ...codex(272_001, 0, 0) }])).toBeUndefined()
})

test('a long tier without a long rate is n/a, not a guess', () => {
  const own = parsePrices(`${HEAD}\nclaude,half,,1,1,,,,,,10,request,,,,,,\n`)
  expect(r(claudeUsd(own, claude(5, 0, 0, 0), 'half'))).toBe(r(5 / M))
  expect(claudeUsd(own, claude(11, 0, 0, 0), 'half')).toBeUndefined()
})
