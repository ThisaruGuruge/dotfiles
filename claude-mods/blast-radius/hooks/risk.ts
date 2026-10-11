export type RiskKind =
  | 'rm'
  | 'git-reset-hard'
  | 'git-push-force'
  | 'git-push-delete'
  | 'git-clean'
  | 'sql'
  | 'adopt'
  | 'chmod-r'
  | 'dd'
  | 'mkfs'
  | 'find-delete'
  | 'rsync-delete'

export type Risk = {
  kind: RiskKind
  segment: string
  args: string[]
  /**
   * Where the command runs, from a leading `cd X &&` and `git -C X`: absolute,
   * `~`-relative or relative to the session's directory. `?` when a `cd`
   * target could not be resolved (a variable, a substitution). Absent: the
   * session's own directory.
   */
  cwd?: string
  /** `--git-dir`/`--work-tree` given to git, passed on to the preview's git calls. */
  gitArgs?: string[]
}

export const LABELS: Record<RiskKind, string> = {
  rm: 'recursive delete (rm -r)',
  'git-reset-hard': 'git reset --hard',
  'git-push-force': 'forced git push',
  'git-push-delete': 'git push that deletes remote refs (--delete, :ref, --mirror, --prune)',
  'git-clean': 'git clean (deletes untracked files)',
  sql: 'destructive SQL or migration',
  adopt: 'stow/bestow --adopt (overwrites repo files)',
  'chmod-r': 'recursive chmod',
  dd: 'dd (raw block write)',
  mkfs: 'mkfs (formats a device)',
  'find-delete': 'find -delete',
  'rsync-delete': 'rsync --delete (removes files at the destination)',
}

// Commands that run another command. Each lists its short options that take a
// value (`sudo -u root git ...`) and its long ones (`--user root`), so the
// value is not mistaken for the program.
const WRAPPERS: Record<string, { short: string; long: string[] }> = {
  sudo: {
    short: 'ugChprtUDTR',
    long: ['--user', '--group', '--close-from', '--host', '--prompt', '--role', '--type', '--other-user', '--chdir', '--command-timeout', '--chroot'],
  },
  doas: { short: 'uC', long: [] },
  env: { short: 'uCSP', long: ['--unset', '--chdir', '--split-string'] },
  command: { short: '', long: [] },
  builtin: { short: '', long: [] },
  exec: { short: 'a', long: [] },
  nohup: { short: '', long: [] },
  time: { short: 'of', long: ['--output', '--format'] },
  nice: { short: 'n', long: ['--adjustment'] },
  xargs: {
    short: 'IJLnPRSsEda',
    long: ['--max-args', '--max-procs', '--max-lines', '--max-chars', '--delimiter', '--arg-file'],
  },
  timeout: { short: 'sk', long: ['--signal', '--kill-after'] },
  gtimeout: { short: 'sk', long: ['--signal', '--kill-after'] },
}

// Wrappers whose first positional argument is theirs, not the program (`timeout 5 git push -f`).
const WRAPPER_POSITIONAL = new Set(['timeout', 'gtimeout'])

// Shell words that can lead a segment without being the program.
const KEYWORDS = new Set(['{', '}', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until'])

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'])

// git options that come before the subcommand and take the next word as their value.
const GIT_VALUE_OPTS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--list-cmds'])

const SQL_DESTRUCTIVE =
  /\b(drop\s+(table|database|schema|index|view)|truncate\s+(table\s+)?[A-Za-z_"`]|delete\s+from\s+[A-Za-z_"`.]+\s*(;|"|'|$))/i
const MIGRATE =
  /\b(db:migrate|migrate:(fresh|refresh|reset|rollback)|prisma\s+migrate\s+(reset|deploy|dev)|manage\.py\s+migrate|alembic\s+(upgrade|downgrade)|flyway\s+(migrate|clean)|goose\s+(up|down|reset)|dbmate\s+(up|down|drop)|sqlx\s+migrate|knex\s+migrate|sequelize\S*\s+db:migrate)\b/i
const RM_FALLBACK = /(^|[\s(`;&|])rm\s+(-[A-Za-z]*[rR][A-Za-z]*|--recursive)\b/

/** How deep `bash -c`, `eval` and `$(...)` payloads are followed. */
const MAX_DEPTH = 2

type Piece = { text: string; sep: string }

/**
 * Splits on unquoted ; & | and newlines, keeping each separator. Quotes and
 * backslash escapes are tracked as the shell reads them (no escapes inside
 * single quotes); $( ) is not.
 */
function splitWithSeps(command: string): Piece[] {
  const out: Piece[] = []
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i)
    if (c === '\\' && quote !== "'" && i + 1 < command.length) {
      cur += c + command.charAt(++i)
      continue
    }
    if (quote) {
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === ';' || c === '&' || c === '|' || c === '\n') {
      out.push({ text: cur, sep: c })
      cur = ''
      continue
    }
    cur += c
  }
  out.push({ text: cur, sep: '' })
  return out
}

/** Splits on unquoted ; & | and newlines. Quotes are tracked, $( ) is not. */
export function splitSegments(command: string): string[] {
  return splitWithSeps(command)
    .map(p => p.text.trim())
    .filter(Boolean)
}

/**
 * Whitespace split that keeps quoted strings together and strips the quotes.
 * An unquoted `)` or backtick ends a word and is dropped, so `(cd x && git push -f)`
 * and `` `git push -f` `` read as plain words.
 */
export function tokenize(segment: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let has = false
  const end = () => {
    if (has || cur) out.push(cur)
    cur = ''
    has = false
  }
  for (let i = 0; i < segment.length; i++) {
    const c = segment.charAt(i)
    if (quote === '"' && c === '\\' && /["\\$`]/.test(segment.charAt(i + 1))) {
      cur += segment.charAt(++i)
      continue
    }
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
    if (/\s/.test(c) || c === ')' || c === '`') {
      end()
      continue
    }
    cur += c
    has = true
  }
  end()
  return out
}

/**
 * The commands inside `$(...)`, backticks and `<(...)`/`>(...)` at the top
 * level of `command` (not inside single quotes). Nested ones stay inside
 * their parent's text, for the next level to find.
 */
export function substitutions(command: string): string[] {
  const out: string[] = []
  let dq = false
  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i)
    if (c === '\\') {
      i++
      continue
    }
    if (c === "'" && !dq) {
      const j = command.indexOf("'", i + 1)
      if (j < 0) break
      i = j
      continue
    }
    if (c === '"') {
      dq = !dq
      continue
    }
    const opensParen = command.charAt(i + 1) === '(' && (c === '$' || (!dq && (c === '<' || c === '>')))
    if (opensParen) {
      let depth = 1
      let q: string | null = null
      let j = i + 2
      for (; j < command.length; j++) {
        const d = command.charAt(j)
        if (d === '\\') {
          j++
          continue
        }
        if (q) {
          if (d === q) q = null
          continue
        }
        if (d === '"' || d === "'") q = d
        else if (d === '(') depth++
        else if (d === ')' && --depth === 0) break
      }
      out.push(command.slice(i + 2, j))
      i = j
      continue
    }
    if (c === '`') {
      let j = i + 1
      while (j < command.length && command.charAt(j) !== '`') j += command.charAt(j) === '\\' ? 2 : 1
      out.push(command.slice(i + 1, j))
      i = j
    }
  }
  return out
}

const stripOpen = (t: string) => t.replace(/^(\$\(|<\(|>\(|\(|`)+/, '')
const base = (t: string) => stripOpen(t).split('/').pop() ?? t

/** How many words a wrapper's option at `tokens[i]` uses: itself, plus its value when separate. */
function optionWidth(spec: { short: string; long: string[] }, t: string): number {
  if (t.startsWith('--')) return spec.long.includes(t) ? 2 : 1
  // A cluster (`-iu root`): the first value-taking letter takes the rest of the word, or the next word.
  for (let k = 1; k < t.length; k++) {
    if (spec.short.includes(t.charAt(k))) return k === t.length - 1 ? 2 : 1
  }
  return 1
}

type Program = { idx: number; payloads: string[]; chdir?: string }

// Wrapper options that change the directory the program runs in.
const CHDIR: Record<string, { short: string; long: string }> = {
  env: { short: '-C', long: '--chdir' },
  sudo: { short: '-D', long: '--chdir' },
}

function chdirOf(name: string, a: string, next: string | undefined): string | undefined {
  const c = CHDIR[name]
  if (!c) return undefined
  if (a === c.short || a === c.long) return next
  if (a.startsWith(`${c.long}=`)) return a.slice(c.long.length + 1)
  if (a.startsWith(c.short) && a.length > 2) return a.slice(2)
  return undefined
}

/**
 * Index of the program word, skipping shell keywords, wrappers, VAR=x
 * assignments and wrapper options with their values. `env -S '...'` hands
 * back its string as a payload to classify on its own.
 */
function findProgram(tokens: string[]): Program {
  const payloads: string[] = []
  let chdir: string | undefined
  let i = 0
  while (i < tokens.length) {
    const t = stripOpen(tokens[i] ?? '')
    if (t === '' || KEYWORDS.has(t) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
      i++
      continue
    }
    const name = base(t)
    const spec = WRAPPERS[name]
    if (!spec) break
    i++
    let positional = WRAPPER_POSITIONAL.has(name)
    while (i < tokens.length) {
      const a = tokens[i] ?? ''
      if (a === '--') {
        i++
        break
      }
      if (a.startsWith('-') && a.length > 1) {
        const w = optionWidth(spec, a)
        const dir = chdirOf(name, a, tokens[i + 1])
        if (dir !== undefined) chdir = dir
        if (name === 'env' && (a === '-S' || a === '--split-string') && tokens[i + 1] !== undefined) {
          payloads.push(tokens[i + 1] ?? '')
        } else if (name === 'env' && (a.startsWith('-S') || a.startsWith('--split-string=')) && a.length > 2) {
          payloads.push(a.startsWith('-S') ? a.slice(2) : a.slice('--split-string='.length))
        }
        i += w
        continue
      }
      if (name === 'env' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(a)) {
        i++
        continue
      }
      if (positional) {
        positional = false
        i++
        continue
      }
      break
    }
  }
  return { idx: i, payloads, ...(chdir !== undefined ? { chdir } : {}) }
}

const hasShortFlag = (args: string[], chars: string) =>
  args.some(a => /^-[A-Za-z]+$/.test(a) && [...chars].some(ch => a.includes(ch)))

type GitCall = { sub: string | undefined; subArgs: string[]; dirs: string[]; gitArgs: string[] }

/** Splits `git <globals> <sub> <args>`, collecting -C dirs and --git-dir/--work-tree. */
export function parseGit(args: string[]): GitCall {
  const dirs: string[] = []
  const gitArgs: string[] = []
  let i = 0
  while (i < args.length) {
    const a = args[i] ?? ''
    if (!a.startsWith('-')) break
    if (GIT_VALUE_OPTS.has(a)) {
      const v = args[i + 1] ?? ''
      if (a === '-C') dirs.push(v)
      else if (a === '--git-dir' || a === '--work-tree') gitArgs.push(a, v)
      i += 2
      continue
    }
    if (a.startsWith('--git-dir=') || a.startsWith('--work-tree=')) gitArgs.push(a)
    i++
  }
  return { sub: args[i], subArgs: args.slice(i + 1), dirs, gitArgs }
}

/** `base` joined with `dir`, without resolving `..` (the shell does that). */
export function joinPath(baseDir: string | undefined, dir: string): string {
  if (baseDir === '?' || /[$`*?[\]{}]/.test(dir)) return '?'
  if (baseDir === undefined || dir.startsWith('/') || dir === '~' || dir.startsWith('~/')) return dir
  return `${baseDir.replace(/\/+$/, '')}/${dir}`
}

function classifySegment(segment: string, segCwd: string | undefined, depth: number): Risk[] {
  const tokens = tokenize(segment)
  const { idx, payloads, chdir } = findProgram(tokens)
  const cwd = chdir !== undefined ? joinPath(segCwd, chdir) : segCwd
  const out: Risk[] = []
  for (const p of payloads) out.push(...classifyAt(p, depth + 1, cwd))
  if (idx >= tokens.length) return out
  const prog = base(tokens[idx] ?? '')
  const args = tokens.slice(idx + 1)
  const push = (kind: RiskKind, a: string[] = args, extra: Partial<Risk> = {}) =>
    out.push({ kind, segment, args: a, ...(cwd !== undefined ? { cwd } : {}), ...extra })

  if (prog === 'rm') {
    if (hasShortFlag(args, 'rR') || args.includes('--recursive')) push('rm')
  } else if (prog === 'git') {
    const g = parseGit(args)
    let dir = cwd
    for (const d of g.dirs) dir = joinPath(dir, d)
    const extra: Partial<Risk> = {
      ...(dir !== undefined ? { cwd: dir } : {}),
      ...(g.gitArgs.length ? { gitArgs: g.gitArgs } : {}),
    }
    const sa = g.subArgs
    if (g.sub === 'reset' && sa.includes('--hard')) push('git-reset-hard', sa, extra)
    else if (g.sub === 'push') {
      if (
        // --force-with-lease refuses to clobber remote commits you have not seen, so it is not flagged.
        sa.includes('--force') ||
        sa.some(a => /^-[A-Za-z]*f[A-Za-z]*$/.test(a)) ||
        sa.some(a => a.startsWith('+') && a.length > 1)
      )
        push('git-push-force', sa, extra)
      if (
        sa.includes('--delete') ||
        sa.includes('--mirror') ||
        sa.includes('--prune') ||
        sa.some(a => /^-[A-Za-z]*d[A-Za-z]*$/.test(a)) ||
        sa.some(a => a.startsWith(':') && a.length > 1)
      )
        push('git-push-delete', sa, extra)
    } else if (g.sub === 'clean' && (hasShortFlag(sa, 'f') || sa.includes('--force')) && !hasShortFlag(sa, 'n') && !sa.includes('--dry-run'))
      push('git-clean', sa, extra)
  } else if (prog === 'stow' || prog === 'bestow') {
    if (args.includes('--adopt')) push('adopt')
  } else if (prog === 'chmod' || prog === 'chown') {
    if (hasShortFlag(args, 'R') || args.includes('--recursive')) push('chmod-r')
  } else if (prog === 'dd') {
    push('dd')
  } else if (prog === 'mkfs' || prog.startsWith('mkfs.')) {
    push('mkfs')
  } else if (prog === 'find') {
    if (args.includes('-delete')) push('find-delete')
  } else if (prog === 'rsync') {
    if (args.some(a => a === '--del' || a.startsWith('--delete'))) push('rsync-delete')
  } else if (SHELLS.has(prog)) {
    // bash -c 'payload' (also -lc, -ec): the payload is the first word after the flag that is not an option
    const at = args.findIndex(a => /^-[A-Za-z]*c[A-Za-z]*$/.test(a))
    const payload = at >= 0 ? args.slice(at + 1).find(a => !a.startsWith('-') && !a.startsWith('+')) : undefined
    if (payload !== undefined) out.push(...classifyAt(payload, depth + 1, cwd))
  } else if (prog === 'eval') {
    out.push(...classifyAt(args.join(' '), depth + 1, cwd))
  }
  return out
}

/** Is this segment `git ... commit|tag ...`? */
function isGitMessageSegment(segment: string): boolean {
  const tokens = tokenize(segment)
  const { idx } = findProgram(tokens)
  if (base(tokens[idx] ?? '') !== 'git') return false
  const sub = parseGit(tokens.slice(idx + 1)).sub
  return sub === 'commit' || sub === 'tag'
}

const HEREDOC = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/
// The message comes from that heredoc: -m "$(cat <<'EOF'  or  -F - <<EOF
const MSG_FROM_CAT = /(?:^|\s)(?:-[A-Za-z]*m|--message)(?:=|\s*)["']?\$\(cat\s+<<-?\s*(['"]?)[A-Za-z_][A-Za-z0-9_]*\1\s*$/
const MSG_FROM_STDIN = /(?:^|\s)(?:-[A-Za-z]*F|--file)(?:=|\s*)-(?:\s|$)/

/**
 * Drops the body of a heredoc that is a git commit or tag message, so the
 * message text is not read as commands. Only when the heredoc is the last
 * thing on that line's last segment, and that segment is the git command
 * itself. An unquoted delimiter expands `$(...)` in the body, so those
 * substitutions are kept.
 */
export function stripMessageHeredocs(command: string): string {
  const lines = command.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    out.push(line)
    const m = HEREDOC.exec(line)
    if (!m) continue
    const segs = splitSegments(line)
    const last = segs[segs.length - 1] ?? ''
    if (!HEREDOC.test(last) || !isGitMessageSegment(last)) continue
    if (!MSG_FROM_CAT.test(last) && !(MSG_FROM_STDIN.test(last) && /<<-?\s*(['"]?)[A-Za-z_][A-Za-z0-9_]*\1\s*$/.test(last)))
      continue
    const isTabbed = m[1] === '-'
    const isQuoted = m[2] !== ''
    const delim = m[3] ?? ''
    let j = i + 1
    const body: string[] = []
    while (j < lines.length && (isTabbed ? (lines[j] ?? '').replace(/^\t+/, '') : lines[j]) !== delim) {
      body.push(lines[j] ?? '')
      j++
    }
    if (!isQuoted) {
      for (const s of substitutions(body.join('\n'))) out.push(`$(${s})`)
    }
    if (j < lines.length) out.push(lines[j] ?? '')
    i = j
  }
  return out.join('\n')
}

const MSG_OPT =
  /(^|\s)(-[A-Za-z]*[mF]|--message|--file)(=|\s+|(?=["']))("(?:[^"\\]|\\[\s\S])*"|'[^']*'|[^\s"']+)/g

/**
 * The command with git commit/tag message values emptied, for the rm and SQL
 * text checks: `git commit -m "never rm -rf the cache"` is not a delete.
 * Substitutions in a message still run, so they are kept.
 */
export function scrubMessages(command: string): string {
  return splitWithSeps(command)
    .map(p => {
      if (!isGitMessageSegment(p.text)) return p.text + p.sep
      const text = p.text.replace(MSG_OPT, (_w, pre: string, opt: string, eq: string, value: string) => {
        const subs = value.startsWith("'") ? [] : substitutions(value)
        return `${pre}${opt}${eq}''${subs.map(s => ` $(${s})`).join('')}`
      })
      return text + p.sep
    })
    .join('')
}

const keyOf = (r: Risk) => `${r.kind}\0${r.args.join('\0')}\0${r.cwd ?? ''}`

function classifyAt(command: string, depth: number, baseCwd: string | undefined): Risk[] {
  if (depth > MAX_DEPTH) return []
  const text = stripMessageHeredocs(command)
  const risks: Risk[] = []
  let cwd = baseCwd
  // A `(` subshell keeps its `cd` to itself: the directory comes back at its `)`
  const saved: (string | undefined)[] = []
  for (const seg of splitSegments(text)) {
    for (let k = /^\(+/.exec(seg)?.[0].length ?? 0; k > 0; k--) saved.push(cwd)
    const tokens = tokenize(seg)
    const { idx } = findProgram(tokens)
    const prog = base(tokens[idx] ?? '')
    if (prog === 'cd' || prog === 'pushd') {
      const rest = tokens.slice(idx + 1)
      const dir = rest.find(a => !a.startsWith('-'))
      cwd = rest.includes('-') ? '?' : dir === undefined ? '~' : joinPath(cwd, dir)
    } else {
      risks.push(...classifySegment(seg, cwd, depth))
    }
    const closes = /\)+\s*$/.exec(seg)?.[0].replace(/\s/g, '').length ?? 0
    for (let k = closes; k > 0 && saved.length > 0; k--) cwd = saved.pop()
  }
  for (const inner of substitutions(text)) risks.push(...classifyAt(inner, depth + 1, cwd))

  const plain = scrubMessages(text)
  if (SQL_DESTRUCTIVE.test(plain) || MIGRATE.test(plain)) {
    risks.push({ kind: 'sql', segment: command, args: [] })
  }

  // Fallback for forms the tokenizer misses (rm inside quotes, heredocs)
  if (!risks.some(r => r.kind === 'rm') && RM_FALLBACK.test(plain)) {
    risks.push({ kind: 'rm', segment: command, args: [] })
  }

  const seen = new Set<string>()
  return risks.filter(r => {
    const k = keyOf(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function classify(command: string): Risk[] {
  const risks = classifyAt(command, 0, undefined)
  // One sql entry is enough, whichever level found it
  const sql = risks.findIndex(r => r.kind === 'sql')
  return risks.filter((r, i) => r.kind !== 'sql' || i === sql)
}

/**
 * `git clean -n` with the flags that change what goes: -d, -x, -X, -e and the
 * pathspecs. -f, -i and -q are dropped; -n is added.
 */
export function cleanDryRun(args: string[]): string[] {
  const out = ['clean', '-n']
  const letters = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a === '--') {
      out.push('--', ...args.slice(i + 1))
      break
    }
    if (a === '-e' || a === '--exclude') {
      out.push('-e', args[i + 1] ?? '')
      i++
    } else if (a.startsWith('--exclude=')) out.push(a)
    else if (/^-[A-Za-z]+$/.test(a)) {
      for (const ch of a.slice(1)) if ('dxX'.includes(ch)) letters.add(ch)
    } else if (!a.startsWith('-')) out.push(a)
  }
  if (letters.size) out.splice(2, 0, `-${[...letters].join('')}`)
  return out
}

export const isGlob =(p: string) => /[*?[\]{}]/.test(p)
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
