import type { ModelUsage } from 'claude-code'

// One row of data/prices.csv: USD per million tokens. An absent rate is an
// empty cell.
export type Price = {
  provider: string
  model: string
  aliases: string[]
  scope?: 'request' | 'session'
  rates: Partial<Record<Rate, number>>
}

export type Prices = Price[]

// One Codex request (`last_token_usage`): `input` holds `cached` and `write`.
export type CodexRequest = {
  model?: string
  input: number
  cached: number
  write: number
  output: number
}

const RATES = [
  'input',
  'output',
  'cache_read',
  'cache_write_5m',
  'cache_write',
  'long_context_tokens',
  'long_input',
  'long_output',
  'long_cache_read',
  'long_cache_write_5m',
  'long_cache_write',
] as const

type Rate = (typeof RATES)[number]

// Comment lines start with `#`; the first other line is the header. Cells hold
// no quotes or commas. A row with a bad cell, or without input or output, is
// left out, so its model shows n/a.
export function parsePrices(text: string): Prices {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
  const head = (lines[0] ?? '').split(',').map(cell => cell.trim())
  if (!head.includes('provider') || !head.includes('model')) return []
  const out: Prices = []
  for (const line of lines.slice(1)) {
    const cells = line.split(',')
    const cell = (name: string) => cells[head.indexOf(name)]?.trim() ?? ''
    const provider = cell('provider')
    const model = cell('model')
    const scope = cell('long_scope')
    if (!provider || !model || !['', 'request', 'session'].includes(scope)) continue
    const rates: Price['rates'] = {}
    const isBad = RATES.some(name => {
      const value = cell(name)
      if (value === '') return false
      const n = Number(value)
      rates[name] = n

      return !Number.isFinite(n) || n < 0
    })
    if (isBad || rates.input === undefined || rates.output === undefined) continue
    out.push({
      provider,
      model,
      aliases: cell('aliases')
        .split(';')
        .map(one => one.trim())
        .filter(Boolean),
      ...(scope && { scope: scope as Price['scope'] }),
      rates,
    })
  }

  return out
}

const names = (one: Price) => [one.model, ...one.aliases]
const isSame = (a: Price, b: Price) =>
  a.provider === b.provider && names(a).some(name => names(b).includes(name))

// A user's row replaces each built-in row it names by ID or alias, and takes
// that row's other names, so an override of a model also prices its aliases;
// a name another user row of the provider names itself stays with that row.
export function withOverride(base: Prices, over: Prices): Prices {
  const isOwn = (name: string, one: Price) =>
    over.some(row => row !== one && row.provider === one.provider && names(row).includes(name))

  return [
    ...over.map(one => ({
      ...one,
      aliases: [
        ...one.aliases,
        ...base
          .filter(row => isSame(one, row))
          .flatMap(names)
          .filter(name => !isOwn(name, one)),
      ],
    })),
    ...base.filter(row => !over.some(one => isSame(one, row))),
  ]
}

export function findPrice(prices: Prices, provider: string, model?: string): Price | undefined {
  if (!model) return undefined

  return prices.find(
    one => one.provider === provider && (one.model === model || one.aliases.includes(model)),
  )
}

type Request = { uncached: number; read: number; write: number; output: number }

// Above `long_context_tokens` of prompt (uncached, reads and writes) the long
// rates bill every token of the request. A tier billed per session, or a long
// rate that is missing, gives undefined: Rabe does not guess.
function requestUsd(price: Price, r: Request): number | undefined {
  const limit = price.rates.long_context_tokens
  const isLong = limit !== undefined && r.uncached + r.read + r.write > limit
  if (isLong && price.scope !== 'request') return undefined
  const rate = (name: 'input' | 'output' | 'cache_read' | 'cache_write_5m' | 'cache_write') =>
    price.rates[isLong ? (`long_${name}` as const) : name]
  const input = rate('input')
  const output = rate('output')
  if (input === undefined || output === undefined) return undefined
  // Claude rows fill cache_write_5m, OpenAI rows cache_write; empty bills at input.
  const write = rate('cache_write_5m') ?? rate('cache_write') ?? input

  return (
    (r.uncached * input +
      r.read * (rate('cache_read') ?? input) +
      r.write * write +
      r.output * output) /
    1e6
  )
}

// One Claude response. Its usage has no 5m or 1h split, so writes bill at 5m.
export function claudeUsd(prices: Prices, usage: ModelUsage, model: string): number | undefined {
  const price = findPrice(prices, 'claude', model)

  return price
    ? requestUsd(price, {
        uncached: usage.input_tokens,
        read: usage.cache_read_input_tokens,
        write: usage.cache_creation_input_tokens,
        output: usage.output_tokens,
      })
    : undefined
}

// A Codex job: the sum of its requests, or undefined when one has no price.
export function codexUsd(prices: Prices, requests: CodexRequest[]): number | undefined {
  if (requests.length === 0) return undefined
  let sum = 0
  for (const one of requests) {
    const price = findPrice(prices, 'openai', one.model)
    const uncached = one.input - one.cached - one.write
    const usd =
      price && uncached >= 0
        ? requestUsd(price, { uncached, read: one.cached, write: one.write, output: one.output })
        : undefined
    if (usd === undefined) return undefined
    sum += usd
  }

  return sum
}
