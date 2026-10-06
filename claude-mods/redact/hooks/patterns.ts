export type Counts = Record<string, number>

type Rule = { kind: string; re: RegExp; group?: number }

// Conservative: each rule needs a distinctive prefix or shape.
const RULES: Rule[] = [
  {
    kind: 'private-key',
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/g,
  },
  { kind: 'age-key', re: /AGE-SECRET-KEY-1[A-Z0-9]{50,}/g },
  { kind: 'aws-access-key', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { kind: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g },
  { kind: 'github-token', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { kind: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'api-key', re: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{32,}/g },
  { kind: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  {
    kind: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
  {
    // name = value: only the value is replaced, and only when it looks random
    kind: 'password',
    re: /(?<![A-Za-z0-9])(?:password|passwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["']?([^\s"'`,;]{8,})/gi,
    group: 1,
  },
]

const PLACEHOLDER = /^(\$|\{|<|%|\[REDACTED|ENC\[|\*+$|x+$|\.+$)/i
const LOOKS_RANDOM = /^[A-Za-z0-9!@#$%^&*_+\-=/.~]+$/

function isSecretLike(v: string): boolean {
  return (
    !PLACEHOLDER.test(v) &&
    LOOKS_RANDOM.test(v) &&
    /[0-9]/.test(v) &&
    /[A-Za-z]/.test(v) &&
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(v) // commit and file hashes
  )
}

export function redactText(text: string, counts: Counts): string {
  let out = text
  for (const rule of RULES) {
    out = out.replace(rule.re, (...m: unknown[]) => {
      const whole = m[0] as string
      if (rule.group === undefined) {
        counts[rule.kind] = (counts[rule.kind] ?? 0) + 1
        return `[REDACTED:${rule.kind}]`
      }
      const value = m[rule.group] as string
      if (!isSecretLike(value)) return whole
      counts[rule.kind] = (counts[rule.kind] ?? 0) + 1
      return whole.replace(value, `[REDACTED:${rule.kind}]`)
    })
  }
  return out
}

type Block = { type: string; [k: string]: unknown }

/** Redacts text blocks and tool_result content (string or nested blocks). */
export function redactBlocks(blocks: Block[], counts: Counts): Block[] {
  return blocks.map(b => {
    if (b.type === 'text' && typeof b.text === 'string') {
      return { ...b, text: redactText(b.text, counts) }
    }
    if (b.type === 'tool_result') {
      const c = b.content
      if (typeof c === 'string') return { ...b, content: redactText(c, counts) }
      if (Array.isArray(c)) return { ...b, content: redactBlocks(c as Block[], counts) }
    }
    return b
  })
}

export const total = (c: Counts) => Object.values(c).reduce((a, n) => a + n, 0)
export const summary = (c: Counts) =>
  Object.entries(c)
    .map(([k, n]) => (n > 1 ? `${k} x${n}` : k))
    .join(', ')
