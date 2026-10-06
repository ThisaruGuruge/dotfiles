export type RiskKind =
  | 'rm'
  | 'git-reset-hard'
  | 'git-push-force'
  | 'git-clean'
  | 'sql'
  | 'adopt'
  | 'chmod-r'
  | 'dd'
  | 'mkfs'

export type Risk = {
  kind: RiskKind
  segment: string
  args: string[]
}

export const LABELS: Record<RiskKind, string> = {
  rm: 'recursive delete (rm -r)',
  'git-reset-hard': 'git reset --hard',
  'git-push-force': 'forced git push',
  'git-clean': 'git clean (deletes untracked files)',
  sql: 'destructive SQL or migration',
  adopt: 'stow/bestow --adopt (overwrites repo files)',
  'chmod-r': 'recursive chmod',
  dd: 'dd (raw block write)',
  mkfs: 'mkfs (formats a device)',
}

const WRAPPERS = new Set([
  'sudo',
  'doas',
  'env',
  'command',
  'time',
  'nohup',
  'exec',
  'xargs',
  'nice',
  'builtin',
])

const SQL_DESTRUCTIVE =
  /\b(drop\s+(table|database|schema|index|view)|truncate\s+(table\s+)?[A-Za-z_"`]|delete\s+from\s+[A-Za-z_"`.]+\s*(;|"|'|$))/i
const MIGRATE =
  /\b(db:migrate|migrate:(fresh|refresh|reset|rollback)|prisma\s+migrate\s+(reset|deploy|dev)|manage\.py\s+migrate|alembic\s+(upgrade|downgrade)|flyway\s+(migrate|clean)|goose\s+(up|down|reset)|dbmate\s+(up|down|drop)|sqlx\s+migrate|knex\s+migrate|sequelize\S*\s+db:migrate)\b/i

/** Splits on unquoted ; & | and newlines. Quotes and $( ) are not parsed deeply. */
export function splitSegments(command: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i)
    if (quote) {
      cur += c
      if (c === quote && command.charAt(i - 1) !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === ';' || c === '&' || c === '|' || c === '\n') {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Whitespace split that keeps quoted strings together and strips the quotes. */
export function tokenize(segment: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let has = false
  for (let i = 0; i < segment.length; i++) {
    const c = segment.charAt(i)
    if (quote) {
      if (c === quote) quote = null
      else cur += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      has = true
      continue
    }
    if (c === '\\' && i + 1 < segment.length) {
      cur += segment.charAt(++i)
      has = true
      continue
    }
    if (/\s/.test(c)) {
      if (has || cur) out.push(cur)
      cur = ''
      has = false
      continue
    }
    cur += c
    has = true
  }
  if (has || cur) out.push(cur)
  return out
}

const stripOpen = (t: string) => t.replace(/^(\$\(|\(|`)+/, '')
const base = (t: string) => stripOpen(t).split('/').pop() ?? t

/** Index of the program word, skipping wrappers, VAR=x assignments and options of wrappers. */
function programIndex(tokens: string[]): number {
  let i = 0
  while (i < tokens.length) {
    const t = stripOpen(tokens[i] ?? '')
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) i++
    else if (WRAPPERS.has(base(t))) {
      i++
      while (i < tokens.length && (tokens[i] ?? '').startsWith('-')) i++
    } else break
  }
  return i
}

const hasShortFlag = (args: string[], chars: string) =>
  args.some(a => /^-[A-Za-z]+$/.test(a) && [...chars].some(ch => a.includes(ch)))

function classifySegment(segment: string): Risk[] {
  const tokens = tokenize(segment)
  const idx = programIndex(tokens)
  if (idx >= tokens.length) return []
  const prog = base(tokens[idx] ?? '')
  const args = tokens.slice(idx + 1)
  const out: Risk[] = []
  const push = (kind: RiskKind, a: string[] = args) => out.push({ kind, segment, args: a })

  if (prog === 'rm') {
    if (hasShortFlag(args, 'rR') || args.includes('--recursive')) push('rm')
  } else if (prog === 'git') {
    const sub = args.find(a => !a.startsWith('-'))
    if (sub === 'reset' && args.includes('--hard')) push('git-reset-hard')
    else if (
      sub === 'push' &&
      (args.some(a => a === '--force' || a.startsWith('--force-with-lease') || a === '-f') ||
        args.some(a => /^-[A-Za-z]*f[A-Za-z]*$/.test(a)) ||
        args.some(a => a.startsWith('+') && a.length > 1))
    )
      push('git-push-force')
    else if (sub === 'clean' && (hasShortFlag(args, 'f') || args.includes('--force')) && !hasShortFlag(args, 'n'))
      push('git-clean')
  } else if (prog === 'stow' || prog === 'bestow') {
    if (args.includes('--adopt')) push('adopt')
  } else if (prog === 'chmod' || prog === 'chown') {
    if (hasShortFlag(args, 'R') || args.includes('--recursive')) push('chmod-r')
  } else if (prog === 'dd') {
    push('dd')
  } else if (prog === 'mkfs' || prog.startsWith('mkfs.')) {
    push('mkfs')
  }
  return out
}

export function classify(command: string): Risk[] {
  const risks: Risk[] = []
  for (const seg of splitSegments(command)) risks.push(...classifySegment(seg))

  if (SQL_DESTRUCTIVE.test(command) || MIGRATE.test(command)) {
    risks.push({ kind: 'sql', segment: command, args: [] })
  }

  // Fallback for forms the tokenizer misses (rm inside $(...), bash -c '...', heredocs)
  if (
    !risks.some(r => r.kind === 'rm') &&
    /(^|[\s(`;&|])rm\s+(-[A-Za-z]*[rR][A-Za-z]*|--recursive)\b/.test(command)
  ) {
    risks.push({ kind: 'rm', segment: command, args: [] })
  }
  return risks
}

export const isGlob = (p: string) => /[*?[\]{}]/.test(p)
export const rmTargets = (args: string[]): string[] => {
  const out: string[] = []
  let afterDashes = false
  for (const a of args) {
    if (!afterDashes && a === '--') afterDashes = true
    else if (afterDashes || !a.startsWith('-')) out.push(a)
  }
  return out
}

export const human = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`

export const clip = (lines: string[], max = 12) =>
  lines.length > max ? [...lines.slice(0, max), `... and ${lines.length - max} more`] : lines
