import { redactText, summary, total } from './patterns'
import type { Counts } from './patterns'

/**
 * The deny guard: a tool call whose input holds a secret literal is refused before it runs,
 * because the call itself cannot be rewritten (the engine stores the assistant's `tool_use` block
 * as sent, and a rewritten command would run something else). It reuses the masking rules, so
 * what they leave alone (placeholders, `$VAR`, code that names a secret, demo and local
 * credentials) passes here too, and adds three narrowings of its own so test work is not in the way:
 *
 * - a credential-named value needs 16+ characters (masking hides from 6 or 8);
 * - a value that is plainly fake passes (FAKE_VALUE);
 * - a call may carry `redact-allow: <kind>[, <kind>]` naming the kinds it inlines on purpose.
 */

export type Mode = 'deny' | 'warn' | 'off'

/** The mode from the mod's `denyInlineSecrets` option; anything unknown is `deny`. */
export const modeOf = (v: unknown): Mode => (v === 'warn' || v === 'off' ? v : 'deny')

/** Tools that only read or search the local machine: a pattern or path in them is not a leak. */
export const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LSP', 'ToolSearch'])

/** Keys of a `tool.call` event that are not the tool's own arguments. */
const ENVELOPE = new Set(['tool', 'tool_use_id', 'agentId', 'requestMeta', 'consent'])

/** Most characters of one string scanned, and of all of a call's strings together. */
export const MAX_STRING = 512 * 1024
export const MAX_TOTAL = 2 * 1024 * 1024

/** Words a made-up value carries, and runs no random token has. */
const FAKE_WORD = /example|fake|dummy|sample|placeholder|changeme|change[_-]?me|redacted|notreal|not[_-]real|mock|demo|foobar|your[_-]|x{5,}|\*{4,}|\.{4,}|0123456789|abcdefghij|123456789/i

/** Few distinct characters (`aaaa...`, `abab...`, `1212...`): not a random credential. */
const fewDistinct = (v: string) => new Set(v.toLowerCase().replace(/[^a-z0-9]/g, '')).size <= 5

const isFake = (v: string) => FAKE_WORD.test(v) || fewDistinct(v)

/** `redact-allow: github-token, jwt`: the kinds this call inlines on purpose. */
const MARKER = /\bredact-allow:[ \t]*([a-z0-9-]+(?:[ \t]*,[ \t]*[a-z0-9-]+)*)/g

export function allowedKinds(strings: string[]): Set<string> {
  const kinds = new Set<string>()
  for (const s of strings) {
    for (const m of s.matchAll(MARKER)) for (const k of m[1]!.split(',')) kinds.add(k.trim())
  }
  return kinds
}

/** What the masking rules find, minus the guard's narrowings. `allowed` kinds are skipped. */
export function accepts(allowed: ReadonlySet<string>) {
  return (kind: string, value: string): boolean => {
    if (allowed.has(kind) || isFake(value)) return false
    // Credential-named settings and headers need a long value; the distinctive shapes are long already.
    if (kind === 'cookie') return /=\s*"?[^;\s]{16,}/.test(value)
    return value.length >= 16
  }
}

/**
 * Every string in a tool call's own arguments, nested ones included. Throws past 40 levels of
 * nesting, which the caller treats as a scan that could not run.
 */
export function inputStrings(e: Record<string, unknown>): string[] {
  const out: string[] = []
  let budget = MAX_TOTAL
  const walk = (v: unknown, depth: number) => {
    if (depth > 40) throw new Error('redact: tool input nested too deeply')
    if (typeof v === 'string') {
      const s = v.length > MAX_STRING ? v.slice(0, MAX_STRING) : v
      if (budget > 0) out.push(s.length > budget ? s.slice(0, budget) : s)
      budget -= s.length
    } else if (Array.isArray(v)) v.forEach(x => walk(x, depth + 1))
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(x => walk(x, depth + 1))
  }
  for (const [k, v] of Object.entries(e)) if (!ENVELOPE.has(k)) walk(v, 0)
  return out
}

/** The kinds of secret literal a call's input holds, with counts, or none. */
export function findInlineSecrets(e: Record<string, unknown>): Counts {
  const strings = inputStrings(e)
  const counts: Counts = {}
  const accept = accepts(allowedKinds(strings))
  for (const s of strings) redactText(s, counts, accept)
  return counts
}

/** The reason the model reads. Names the kinds and never the value. */
export function denyMessage(tool: string, counts: Counts): string {
  const kinds = Object.keys(counts).join(', ')
  return (
    `redact: this ${tool} call was not run because it contains ${total(counts)} secret literal(s) (${summary(counts)}); ` +
    'the value is not shown. Do not put a secret in a command or file. Read it when the command runs instead: ' +
    'an environment variable ($NAME), a file ($(cat path)), or the secrets tooling. ' +
    'If it is a fake test value, build it at run time (concatenate fragments, printf, a generator), ' +
    'make it obviously fake (a word such as fake or example in it), ' +
    `or, to inline it on purpose, add the line "redact-allow: ${kinds}" to the same call ` +
    '(a comment in a command, a comment in a file) and retry. Never use that for a real secret.'
  )
}
