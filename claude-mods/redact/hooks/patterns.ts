export type Counts = Record<string, number>

/**
 * A rule hides its whole match, or, with `prefix`, only what follows the
 * text group 1 matched (group 2), and only when `check` says it looks like a
 * secret (isSecretLike by default). `check` also sees group 1 and the text
 * right after the match.
 */
type Rule = { kind: string; re: RegExp; prefix?: true; check?: (v: string, head: string, after: string) => boolean }

const PLACEHOLDER = /^(\$|\{|<|%|\[REDACTED|ENC\[|\*+$|x+$|\.+$)/i
const LOOKS_RANDOM = /^[A-Za-z0-9!@#$%^&*_+\-=/.~]+$/

// A code word: letters and underscores, with up to 3 trailing digits (apiKey, SECRET_KEY, password2).
const WORDY = /^[A-Za-z_][A-Za-z_]*\d{0,3}$/

/**
 * Code that names a value rather than holding it: member access whose every
 * part is a code word (`process.env.API_KEY2`, `config.apiKey`), or one
 * camelCase or snake_case code word (`secretKey`, `db_password`).
 */
export function looksLikeCode(v: string): boolean {
  const parts = v.split('.')
  if (parts.length > 1) return parts.every(p => WORDY.test(p))
  return WORDY.test(v) && (/[a-z][A-Z]/.test(v) || /[A-Za-z]_[A-Za-z]/.test(v))
}

export function isSecretLike(v: string): boolean {
  return (
    !PLACEHOLDER.test(v) &&
    LOOKS_RANDOM.test(v) &&
    /[0-9]/.test(v) &&
    /[A-Za-z]/.test(v) &&
    !looksLikeCode(v) &&
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(v) // commit and file hashes
  )
}

/**
 * A value in a URL or an Authorization header that could be a real
 * credential: not a placeholder, not a capitalised word like YOUR_TOKEN_HERE,
 * and either letters with digits (6+), letters with symbols (8+), or long
 * (16+). Demo passwords like `guest`, `postgres` or `changeme` pass through,
 * so files that hold them can still be read and written back.
 */
export function isCredentialValue(v: string): boolean {
  if (PLACEHOLDER.test(v) || /^[A-Z_-]+$/.test(v) || v.length < 6) return false
  const letters = /[A-Za-z]/.test(v)
  return v.length >= 16 || (letters && /[0-9]/.test(v)) || (letters && v.length >= 8 && /[^A-Za-z0-9]/.test(v))
}

const LOCAL_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(?:[:/?#]|$)/i

/** A URL password worth hiding: a credential, not the user name again, not on this machine. */
function isUrlPassword(v: string, head: string, after: string): boolean {
  const user = /\/\/([^:]*):$/.exec(head)?.[1]
  return isCredentialValue(v) && v !== user && !LOCAL_HOST.test(after.replace(/^@/, ''))
}

// What follows a credential's name: an optional closing quote, `:` or `=`, an optional opening quote
const ASSIGN = `["']?\\s*[:=]\\s*["']?`
const VALUE = "([^\\s\"'`,;]{8,})"

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
  { kind: 'gitlab-token', re: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { kind: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36,}\b/g },
  { kind: 'huggingface-token', re: /\bhf_[A-Za-z0-9]{30,}\b/g },
  { kind: 'stripe-key', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'api-key', re: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{32,}/g },
  { kind: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  {
    kind: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
  {
    // Authorization: Basic|Bearer|Token|Digest <value>
    kind: 'auth-header',
    re: /(\bAuthorization["']?\s*:\s*["']?(?:Basic|Bearer|Token|Digest)\s+)([^\s"'`,;]{8,})/gi,
    prefix: true,
    check: isCredentialValue,
  },
  {
    kind: 'bearer',
    re: /(\bBearer\s+)([A-Za-z0-9._~+/-]{16,}=*)/gi,
    prefix: true,
    check: v => !PLACEHOLDER.test(v) && /[0-9]/.test(v) && /[A-Za-z]/.test(v),
  },
  {
    // scheme://user:password@host (user may be empty): only the password.
    // The lookbehind and the bounded scheme keep a long run like `a.a.a.a...` linear.
    kind: 'url-password',
    re: /((?<![A-Za-z0-9+.-])[A-Za-z][A-Za-z0-9+.-]{0,31}:\/\/[^\s:@/]*:)([^\s@/]+)(?=@)/g,
    prefix: true,
    check: isUrlPassword,
  },
  {
    // name = value: only the value is replaced, and only when it looks random
    kind: 'password',
    re: new RegExp(
      `((?<![A-Za-z0-9])(?:password|passwd|secret(?:[_-]?key)?|api[_-]?key|access[_-]?key|auth[_-]?token|client[_-]?secret)${ASSIGN})${VALUE}`,
      'gi',
    ),
    prefix: true,
  },
  {
    // GITHUB_TOKEN=, NPM_AUTH_TOKEN:, packagePAT=, githubToken:, "private_key": ...
    // Starting only at the head of a name, with a bounded prefix, keeps `a-a-a-...` linear.
    kind: 'credential',
    re: new RegExp(
      `((?<![A-Za-z0-9_-])(?:[A-Za-z0-9]+[_-]){0,10}(?:token|pat|private[_-]?key|credentials?)${ASSIGN})${VALUE}`,
      'gi',
    ),
    prefix: true,
  },
  {
    kind: 'credential',
    re: new RegExp(
      `((?<![A-Za-z0-9_])[A-Za-z0-9_]*(?:PAT|TOKEN|SECRET|PASSWORD|PASSWD|APIKEY|API_KEY|Token|Secret|Password|ApiKey|Pat)${ASSIGN})${VALUE}`,
      'g',
    ),
    prefix: true,
  },
]

export function redactText(text: string, counts: Counts): string {
  let out = text
  for (const rule of RULES) {
    out = out.replace(rule.re, (...m: unknown[]) => {
      const whole = m[0] as string
      if (!rule.prefix) {
        counts[rule.kind] = (counts[rule.kind] ?? 0) + 1
        return `[REDACTED:${rule.kind}]`
      }
      const head = m[1] as string
      const value = m[2] as string
      // replace() passes the offset and the whole input last (no named groups here)
      const end = (m[m.length - 2] as number) + whole.length
      const after = (m[m.length - 1] as string).slice(end, end + 64)
      if (!(rule.check ?? isSecretLike)(value, head, after)) return whole
      counts[rule.kind] = (counts[rule.kind] ?? 0) + 1
      return `${head}[REDACTED:${rule.kind}]${whole.slice(head.length + value.length)}`
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
