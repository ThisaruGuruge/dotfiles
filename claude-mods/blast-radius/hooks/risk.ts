export type RiskKind =
  | 'rm'
  | 'git-reset-hard'
  | 'git-push-force'
  | 'git-push-delete'
  | 'git-clean'
  | 'git-discard'
  | 'git-stash-clear'
  | 'git-worktree-force'
  | 'sql'
  | 'adopt'
  | 'chmod-r'
  | 'dd'
  | 'mkfs'
  | 'find-delete'
  | 'rsync-delete'
  | 'shred'
  | 'truncate'
  | 'nested'

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
  /** The host an `ssh host '...'` runs it on; nothing local can preview it. */
  remote?: string
  /** `rm` run by `xargs` or `fd -x`: its targets come from the input or the matches, not the command line. */
  fromXargs?: true
  /** Run by `find -exec sh -c '...'` on each match: find's own words, to preview what it matches. */
  findArgs?: string[]
}

export const LABELS: Record<RiskKind, string> = {
  rm: 'recursive delete (rm -r)',
  'git-reset-hard': 'git reset --hard',
  'git-push-force': 'forced git push',
  'git-push-delete': 'git push that deletes remote refs (--delete, :ref, --mirror, --prune)',
  'git-clean': 'git clean (deletes untracked files)',
  'git-discard': 'git checkout/restore/switch that discards uncommitted changes',
  'git-stash-clear': 'git stash clear (drops every stash)',
  'git-worktree-force': 'git worktree remove --force (deletes its uncommitted and untracked files)',
  sql: 'destructive SQL or migration',
  adopt: 'stow/bestow --adopt (overwrites repo files)',
  'chmod-r': 'recursive chmod',
  dd: 'dd (raw block write)',
  mkfs: 'mkfs, newfs or diskutil erase (formats a device)',
  'find-delete': 'find that deletes (-delete, -exec rm)',
  'rsync-delete': 'rsync --delete (removes files at the destination)',
  shred: 'shred (overwrites file contents beyond recovery)',
  truncate: 'truncate (cuts files to a size, losing what is past it)',
  nested: 'destructive command nested too deeply to check',
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
  caffeinate: { short: 'tw', long: [] },
  stdbuf: { short: 'ioe', long: ['--input', '--output', '--error'] },
  chronic: { short: '', long: [] },
  setsid: { short: '', long: [] },
  coproc: { short: '', long: [] },
  unbuffer: { short: '', long: [] },
  ionice: { short: 'cnpP', long: ['--class', '--classdata', '--pid', '--pgid', '--uid'] },
  // watch joins the rest of its words and hands them to sh -c
  watch: { short: 'nq', long: ['--interval', '--equexit'] },
  // macOS: arch picks the architecture (its options are words, see SINGLE_DASH), xcrun runs a developer tool
  arch: { short: '', long: [] },
  xcrun: { short: '', long: ['--sdk', '--toolchain'] },
}

// Wrappers whose options are whole single-dash words (`arch -arm64`, `arch -arch x86_64`), not
// clusters of letters: the ones listed take the next word as their value, any other takes none.
const SINGLE_DASH: Record<string, string[]> = {
  arch: ['-arch', '-d', '-e'],
  xcrun: ['-sdk', '-toolchain'],
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
// The lookahead finds the r once; `-[A-Za-z]*[rR][A-Za-z]*\b` backtracked quadratically on a long cluster
const RM_FALLBACK = /(^|[\s(`;&|])rm\s+(-(?=[A-Za-z]*[rR])[A-Za-z]+|--recursive)\b/
// A heredoc read by one of these is SQL, and its body is checked as such
const SQL_CLIENT =
  /\b(psql|mysql|mariadb|sqlite3?|sqlcmd|clickhouse(-client)?|cockroach|duckdb|snowsql|sqlplus|isql|usql|mongosh?)\b/

/** How deep `bash -c`, `eval` and `$(...)` payloads are followed. */
const MAX_DEPTH = 2

/** `a` is the long option `name`, or an abbreviation of it (git and getopt_long accept unambiguous prefixes). */
export const isLong = (a: string, name: string) => a.length >= 3 && a.startsWith('--') && name.startsWith(a)

const ANSI_ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' }

type Piece = { text: string; sep: string }

/**
 * Splits on unquoted ; & | and newlines, keeping each separator. Quotes and
 * backslash escapes are tracked as the shell reads them (no escapes inside
 * single quotes, escapes inside $'...'); $( ) is not. The & of a redirection
 * (`2>&1`, `>&2`, `&>file`) is not a separator.
 */
function splitWithSeps(command: string): Piece[] {
  const out: Piece[] = []
  let cur = ''
  let quote: '"' | "'" | '$' | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i)
    if (quote === "'") {
      cur += c
      if (c === "'") quote = null
      continue
    }
    if (c === '\\' && i + 1 < command.length) {
      cur += c + command.charAt(++i)
      continue
    }
    if (quote) {
      cur += c
      if (c === (quote === '$' ? "'" : quote)) quote = null
      continue
    }
    if (c === '$' && command.charAt(i + 1) === "'") {
      quote = '$'
      cur += "$'"
      i++
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === '&' && (command.charAt(i + 1) === '>' || /[<>]$/.test(cur))) {
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

const REDIRECT = /^(?:<<<|<<-?|<>|<&|>&|>>|>\||&>>|&>|<|>)/

export type Lexed = { words: string[]; hereStrings: string[] }

/**
 * Whitespace split that keeps quoted strings together and strips the quotes
 * ($'...' escapes decoded). Redirections are dropped with their target
 * (`2>/dev/null`, `> out`, `2>&1`, `<<EOF`), except a here-string's
 * (`<<< 'text'`), which is kept apart. An unquoted `)` or backtick ends a word
 * and is dropped, so `(cd x && git push -f)` and `` `git push -f` `` read as
 * plain words.
 */
export function lex(segment: string): Lexed {
  const words: string[] = []
  const hereStrings: string[] = []
  let cur = ''
  let quote: '"' | "'" | '$' | null = null
  let has = false
  let quoted = false
  let target: 'drop' | 'here' | null = null
  const end = () => {
    if (has || cur) {
      if (target === 'here') hereStrings.push(cur)
      else if (target === null) words.push(cur)
      target = null
    }
    cur = ''
    has = false
    quoted = false
  }
  for (let i = 0; i < segment.length; i++) {
    const c = segment.charAt(i)
    const next = segment.charAt(i + 1)
    if (quote === '"') {
      if (c === '\\' && /["\\$`]/.test(next)) {
        cur += next
        i++
      } else if (c === '"') quote = null
      else cur += c
      continue
    }
    if (quote === "'") {
      if (c === "'") quote = null
      else cur += c
      continue
    }
    if (quote === '$') {
      if (c === '\\' && i + 1 < segment.length) {
        cur += ANSI_ESCAPES[next] ?? next
        i++
      } else if (c === "'") quote = null
      else cur += c
      continue
    }
    if (c === '$' && next === "'") {
      quote = '$'
      has = true
      quoted = true
      i++
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      has = true
      quoted = true
      continue
    }
    if (c === '\\' && i + 1 < segment.length) {
      cur += next
      i++
      has = true
      quoted = true
      continue
    }
    if ((c === '<' || c === '>') && next === '(') {
      // process substitution, a word of its own
      cur += c
      has = true
      continue
    }
    const op = c === '<' || c === '>' || (c === '&' && next === '>') ? REDIRECT.exec(segment.slice(i, i + 4))?.[0] : undefined
    if (op) {
      // `2>x`, `{fd}>x`: the number or name is the redirection's, not a word
      if (!quoted && (/^\d+$/.test(cur) || /^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(cur))) {
        cur = ''
        has = false
      }
      end()
      target = op === '<<<' ? 'here' : 'drop'
      i += op.length - 1
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
  return { words, hereStrings }
}

export const tokenize = (segment: string): string[] => lex(segment).words

/**
 * The commands inside `$(...)`, backticks and `<(...)`/`>(...)` at the top
 * level of `command` (not inside single quotes). Nested ones stay inside
 * their parent's text, for the next level to find. `literal`: quotes mean
 * nothing at the top level, as in a heredoc body.
 */
export function substitutions(command: string, literal = false): string[] {
  const out: string[] = []
  let dq = false
  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i)
    if (c === '\\') {
      i++
      continue
    }
    if (!literal && !dq && c === '$' && command.charAt(i + 1) === "'") {
      let j = i + 2
      while (j < command.length && command.charAt(j) !== "'") j += command.charAt(j) === '\\' ? 2 : 1
      i = j
      continue
    }
    if (!literal && c === "'" && !dq) {
      const j = command.indexOf("'", i + 1)
      if (j < 0) break
      i = j
      continue
    }
    if (!literal && c === '"') {
      dq = !dq
      continue
    }
    const opensParen = command.charAt(i + 1) === '(' && (c === '$' || (!dq && !literal && (c === '<' || c === '>')))
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

/** Does this shell (its words after the name) read its commands from stdin: no -c, no script file? */
function shellReadsStdin(args: string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a === '--') return i + 1 >= args.length
    if (cluster(a, 'c')) return false
    if (cluster(a, 's')) return true
    if (a === '-o' || a === '+o' || a === '-O' || a === '+O' || a === '--rcfile' || a === '--init-file') {
      i++
      continue
    }
    if (!a.startsWith('-') && !a.startsWith('+')) return false
  }
  return true
}

type Heredoc = { tabs: boolean; quoted: boolean; delim: string; cmdStart: number; opAt: number; opEnd: number }
type Ctx = { t: 'code'; kind: 'top' | 'subst' | 'bt'; depth: number; cmdStart: number; arith: boolean } | { t: 'dq'; at: number }

export type Sanitized = {
  /** The command with comments and heredoc bodies taken out. */
  code: string
  /** Heredoc bodies that are data, for the SQL text check only. */
  texts: string[]
}

/**
 * Body of the heredoc whose lines start at `from`: its text and where it
 * ends, or null when the delimiter never comes. `missing` remembers where a
 * delimiter was last looked for in vain, so many unterminated heredocs stay linear.
 */
function heredocBody(s: string, from: number, h: Heredoc, missing: Map<string, number>): { body: string; after: number } | null {
  const key = `${h.tabs ? '-' : ''}${h.delim}`
  if ((missing.get(key) ?? Number.POSITIVE_INFINITY) <= from) return null
  let p = from
  while (p <= s.length) {
    const nl = s.indexOf('\n', p)
    const line = s.slice(p, nl < 0 ? s.length : nl)
    if ((h.tabs ? line.replace(/^\t+/, '') : line) === h.delim) {
      return { body: s.slice(from, p), after: nl < 0 ? s.length : nl + 1 }
    }
    if (nl < 0) break
    p = nl + 1
  }
  missing.set(key, from)
  return null
}

const HEREDOC_OP = /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([A-Za-z_][A-Za-z0-9_]*))/

/**
 * One pass over `s`. Comments (an unquoted `#` that starts a word) go up to
 * the end of their line. A heredoc's body is replaced by what matters in it:
 * the commands, when a shell reads it (`bash <<EOF`, `cat <<EOF | sh`); the
 * `$(...)` it expands, when its delimiter is unquoted; nothing otherwise
 * (the text, when SQL reads it, goes to `texts`). A heredoc whose delimiter
 * never comes is left as code. `open` is where quotes that never close
 * started.
 */
function scan(s: string, neutral: Set<number>): Sanitized & { open: number[] | null } {
  let out = ''
  const texts: string[] = []
  const stack: Ctx[] = [{ t: 'code', kind: 'top', depth: 0, cmdStart: 0, arith: false }]
  let pending: Heredoc[] = []
  const missing = new Map<string, number>()
  // How many $(( )) are open: no heredocs inside arithmetic (`$((x<<y))`)
  let arith = 0
  let i = 0
  const n = s.length
  const openSubst = () => {
    const isArith = s.charAt(i + 2) === '('
    if (isArith) arith++
    stack.push({ t: 'code', kind: 'subst', depth: 0, cmdStart: out.length + 2, arith: isArith })
    out += '$('
    i += 2
  }
  while (i < n) {
    const c = s.charAt(i)
    const next = s.charAt(i + 1)
    const top = stack[stack.length - 1] as Ctx
    if (top.t === 'dq') {
      if (c === '\\') {
        out += c + next
        i += 2
      } else if (c === '"' && !neutral.has(i)) {
        stack.pop()
        out += c
        i++
      } else if (c === '$' && next === '(') {
        openSubst()
      } else if (c === '`') {
        stack.push({ t: 'code', kind: 'bt', depth: 0, cmdStart: out.length + 1, arith: false })
        out += c
        i++
      } else {
        out += c
        i++
      }
      continue
    }
    if (c === '\\') {
      out += c + next
      i += 2
      continue
    }
    if (neutral.has(i)) {
      // A quote that never closes is read as a literal character
      out += `\\${c}`
      i++
      continue
    }
    if (c === "'") {
      const j = s.indexOf("'", i + 1)
      if (j < 0) return { code: out, texts, open: [i] }
      out += s.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (c === '$' && next === "'" && !neutral.has(i + 1)) {
      let j = i + 2
      while (j < n && s.charAt(j) !== "'") j += s.charAt(j) === '\\' ? 2 : 1
      if (j >= n) return { code: out, texts, open: [i + 1] }
      out += s.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (c === '"') {
      stack.push({ t: 'dq', at: i })
      out += c
      i++
      continue
    }
    if (c === '`') {
      if (top.kind === 'bt') stack.pop()
      else stack.push({ t: 'code', kind: 'bt', depth: 0, cmdStart: out.length + 1, arith: false })
      out += c
      i++
      continue
    }
    if (c === '$' && next === '(') {
      openSubst()
      continue
    }
    if (c === '(') {
      top.depth++
      out += c
      i++
      continue
    }
    if (c === ')') {
      if (top.kind === 'subst' && top.depth === 0) {
        stack.pop()
        if (top.arith) arith--
      } else top.depth = Math.max(0, top.depth - 1)
      out += c
      i++
      continue
    }
    if (c === '#' && (i === 0 || /[\s;&|()]/.test(s.charAt(i - 1)))) {
      const nl = s.indexOf('\n', i)
      i = nl < 0 ? n : nl
      continue
    }
    if (c === '<' && next === '<' && s.charAt(i + 2) !== '<' && arith === 0) {
      const m = HEREDOC_OP.exec(s.slice(i, i + 256))
      if (m) {
        pending.push({
          tabs: m[1] === '-',
          quoted: m[4] === undefined,
          delim: m[2] ?? m[3] ?? m[4] ?? '',
          cmdStart: top.cmdStart,
          opAt: out.length,
          opEnd: out.length + m[0].length,
        })
        out += m[0]
        i += m[0].length
        continue
      }
    }
    if (c === '\n') {
      out += c
      i++
      const lineStart = out.lastIndexOf('\n', out.length - 2) + 1
      for (const h of pending) {
        const found = heredocBody(s, i, h, missing)
        if (!found) continue
        const consumer = lex(out.slice(Math.max(h.cmdStart, lineStart), h.opAt)).words
        const prog = findProgram(consumer)
        const name = base(consumer[prog.idx] ?? '')
        const rest = out.slice(h.opEnd, out.length - 1)
        const shell =
          (SHELLS.has(name) && shellReadsStdin(consumer.slice(prog.idx + 1))) ||
          /\|\s*(?:sudo\s+)?(?:\/\S*\/)?(?:ba|z|da|k)?sh\b(?!\s+-[A-Za-z]*c)/.test(rest)
        if (shell) {
          out += `${sanitize(found.body).code}\n`
        } else {
          if (!h.quoted) for (const sub of substitutions(found.body, true)) out += `$(${sub})\n`
          if (SQL_CLIENT.test(out.slice(h.cmdStart, out.length)) || rest.includes('|')) texts.push(found.body)
        }
        i = found.after
      }
      pending = []
      top.cmdStart = out.length
      continue
    }
    if (c === ';' || c === '&' || c === '|') top.cmdStart = out.length + 1
    out += c
    i++
  }
  const open = stack.flatMap(x => (x.t === 'dq' ? [x.at] : []))
  return { code: out, texts, open: open.length ? open : null }
}

/**
 * The command with comments and heredoc bodies taken out (see scan). A quote
 * that never closes would hide everything after it, so it is read as a
 * literal character and the command scanned again. Past 32 tries the
 * command is returned whole, nothing taken out.
 */
export function sanitize(command: string): Sanitized {
  const neutral = new Set<number>()
  for (let tries = 0; tries < 32; tries++) {
    const r = scan(command, neutral)
    if (r.open === null) return { code: r.code, texts: r.texts }
    for (const at of r.open) neutral.add(at)
  }
  return { code: command, texts: [] }
}

/** How many words a wrapper's option at `tokens[i]` uses: itself, plus its value when separate. */
function optionWidth(spec: { short: string; long: string[] }, t: string): number {
  if (t.startsWith('--')) return spec.long.includes(t) ? 2 : 1
  // A cluster (`-iu root`): the first value-taking letter takes the rest of the word, or the next word.
  for (let k = 1; k < t.length; k++) {
    if (spec.short.includes(t.charAt(k))) return k === t.length - 1 ? 2 : 1
  }
  return 1
}

type Program = { idx: number; payloads: string[]; chdir?: string; via: string[] }

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
 * assignments and wrapper options with their values. `env -S '...'` and
 * `watch ...` hand back their command as a payload to classify on its own.
 */
function findProgram(tokens: string[]): Program {
  const payloads: string[] = []
  const via: string[] = []
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
    via.push(name)
    i++
    let positional = WRAPPER_POSITIONAL.has(name)
    while (i < tokens.length) {
      const a = tokens[i] ?? ''
      if (a === '--') {
        i++
        break
      }
      if (a.startsWith('-') && a.length > 1) {
        const single = SINGLE_DASH[name]
        const w = single && !a.startsWith('--') ? (single.includes(a) ? 2 : 1) : optionWidth(spec, a)
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
    if (name === 'watch') {
      payloads.push(tokens.slice(i).join(' '))
      i = tokens.length
    }
  }
  return { idx: i, payloads, via, ...(chdir !== undefined ? { chdir } : {}) }
}

/** Is `a` a cluster of short options (`-uf`) that holds `ch`? */
export const cluster = (a: string, ch: string) => /^-[A-Za-z]+$/.test(a) && a.includes(ch)

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

export type CleanOpts = { force: number; dry: boolean; letters: string[]; excludes: string[]; paths: string[] }

/** `git clean`'s options as git reads them: clusters, `-e` taking a value (attached or next), long prefixes. */
export function parseClean(args: string[]): CleanOpts {
  let force = 0
  let dry = false
  const letters: string[] = []
  const excludes: string[] = []
  const paths: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a === '--') {
      paths.push(...args.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq < 0 ? a : a.slice(0, eq)
      if (isLong(name, '--force')) force++
      else if (isLong(name, '--dry-run')) dry = true
      else if (isLong(name, '--exclude')) excludes.push(eq < 0 ? (args[++i] ?? '') : a.slice(eq + 1))
      continue
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let k = 1; k < a.length; k++) {
        const ch = a.charAt(k)
        if (ch === 'e') {
          excludes.push(k + 1 < a.length ? a.slice(k + 1) : (args[++i] ?? ''))
          break
        }
        if (ch === 'f') force++
        else if (ch === 'n') dry = true
        else if ('dxX'.includes(ch) && !letters.includes(ch)) letters.push(ch)
      }
      continue
    }
    paths.push(a)
  }
  return { force, dry, letters, excludes, paths }
}

// Pathspecs that cover the whole working tree
const WHOLE_TREE = new Set(['.', './', ':/', ':/.', ':(top)', '*', './*', ':/*'])

/**
 * Does this `git checkout|restore|switch` throw away uncommitted work: -f, or
 * (checkout, restore without --staged alone) a pathspec covering the whole tree?
 */
function discards(sub: string, sa: string[]): boolean {
  // short options that take a value, per subcommand
  const valued = sub === 'restore' ? 's' : sub === 'switch' ? 'cC' : 'bB'
  let force = false
  let staged = false
  let worktree = false
  const pos: string[] = []
  for (let i = 0; i < sa.length; i++) {
    const a = sa[i] ?? ''
    if (a === '--') {
      pos.push(...sa.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const name = a.split('=')[0] ?? a
      if (isLong(name, '--force') || (sub === 'switch' && isLong(name, '--discard-changes'))) force = true
      else if (isLong(name, '--staged')) staged = true
      else if (isLong(name, '--worktree')) worktree = true
      else if (!a.includes('=') && ['--source', '--orphan', '--create', '--force-create'].includes(name)) i++
      continue
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let k = 1; k < a.length; k++) {
        const ch = a.charAt(k)
        if (valued.includes(ch)) {
          if (k + 1 === a.length) i++
          break
        }
        if (ch === 'f') force = true
        else if (ch === 'S') staged = true
        else if (ch === 'W') worktree = true
      }
      continue
    }
    pos.push(a)
  }
  if (sub === 'switch') return force
  if (sub === 'checkout' && force) return true
  const whole = pos.some(p => WHOLE_TREE.has(p))
  return sub === 'restore' ? whole && (worktree || !staged) : whole
}

/** ssh's remote host and command: options with values skipped, the rest after the host joined as ssh does. */
function sshCommand(args: string[]): { host: string; command: string } | null {
  const valued = 'BbcDEeFIiJLlmOoPpQRSWw'
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a === '--') {
      const host = args[i + 1]
      return host === undefined ? null : { host, command: args.slice(i + 2).join(' ') }
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let k = 1; k < a.length; k++) {
        if (valued.includes(a.charAt(k))) {
          if (k + 1 === a.length) i++
          break
        }
      }
      continue
    }
    return { host: a, command: args.slice(i + 1).join(' ') }
  }
  return null
}

/** `baseDir` joined with `dir`, without resolving `..` (the shell does that). */
export function joinPath(baseDir: string | undefined, dir: string): string {
  if (baseDir === '?' || /[$`*?[\]{}]/.test(dir)) return '?'
  if (baseDir === undefined || dir.startsWith('/') || dir === '~' || dir.startsWith('~/')) return dir
  return `${baseDir.replace(/\/+$/, '')}/${dir}`
}

const RM_LIKE = new Set(['rm', 'unlink', 'shred', 'srm', 'trash'])

/**
 * find's words with -delete and any `-exec rm ... ;|+` taken out, or null when
 * another action would run. `shells`: `-exec sh -c '...' ... ;|+` is taken out too.
 */
export function findPreviewArgs(args: string[], shells = false): string[] | null {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a === '-delete') continue
    if (/^-(exec|execdir|ok|okdir)$/.test(a)) {
      const prog = base(args[i + 1] ?? '')
      if (!RM_LIKE.has(prog) && !(shells && SHELLS.has(prog))) return null
      while (i < args.length && args[i] !== ';' && args[i] !== '+') i++
      continue
    }
    if (/^-(fprint|fprint0|fprintf|fls)$/.test(a)) return null
    out.push(a)
  }
  return out
}

const findDeletes = (args: string[]) =>
  args.some((a, i) => a === '-delete' || (/^-(exec|execdir|ok|okdir)$/.test(a) && RM_LIKE.has(base(args[i + 1] ?? ''))))

/** The command a shell runs with -c: the first word after the -c cluster that is not an option. */
function shellPayload(args: string[]): string | undefined {
  const at = args.findIndex(a => cluster(a, 'c'))
  return at >= 0 ? args.slice(at + 1).find(a => !a.startsWith('-') && !a.startsWith('+')) : undefined
}

/** The payloads of find's `-exec sh -c '...' ... ;|+` (and -execdir, -ok, -okdir). */
function findShellPayloads(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (!/^-(exec|execdir|ok|okdir)$/.test(args[i] ?? '') || !SHELLS.has(base(args[i + 1] ?? ''))) continue
    let end = i + 2
    while (end < args.length && args[end] !== ';' && args[end] !== '+') end++
    const payload = shellPayload(args.slice(i + 2, end))
    if (payload !== undefined) out.push(payload)
    i = end
  }
  return out
}

/** A command's words that are not options or their values (`shred -n 3 a b`: a, b). */
export function operands(args: string[], spec: { short: string; long: string[] }): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a === '--') {
      out.push(...args.slice(i + 1))
      break
    }
    if (a.startsWith('-') && a.length > 1) {
      i += optionWidth(spec, a) - 1
      continue
    }
    out.push(a)
  }
  return out
}

export const SHRED_OPTS = { short: 'ns', long: ['--iterations', '--size', '--random-source'] }
export const TRUNCATE_OPTS = { short: 'sr', long: ['--size', '--reference'] }

// diskutil verbs that erase or repartition (diskutil reads verbs case-insensitively)
const DISKUTIL_ERASE = /^(erase|zeroDisk|randomDisk|secureErase|partitionDisk|reformat)/i
// ... and `diskutil apfs eraseVolume|deleteContainer|deleteVolume`
const DISKUTIL_APFS_ERASE = /^(erase|delete)/i

/** Strips a function definition's head (`f()`, `function f`), so its body reads as commands. */
const stripFunction = (seg: string) =>
  seg.replace(/^function\s+[^\s(){}]+(?:\s*\(\s*\))?\s*/, '').replace(/^[A-Za-z_][A-Za-z0-9_.:-]*\s*\(\s*\)\s*/, '')

/** How many `)` in `seg` close a `(` opened before it (quotes skipped). */
function closesIn(seg: string): number {
  let depth = 0
  let closes = 0
  let q: string | null = null
  for (let i = 0; i < seg.length; i++) {
    const c = seg.charAt(i)
    if (c === '\\') i++
    else if (q) {
      if (c === q) q = null
    } else if (c === '"' || c === "'") q = c
    else if (c === '(') depth++
    else if (c === ')') {
      if (depth > 0) depth--
      else closes++
    }
  }
  return closes
}

function classifySegment(segment: string, segCwd: string | undefined, depth: number): Risk[] {
  const { words: tokens, hereStrings } = lex(segment)
  const { idx, payloads, chdir, via } = findProgram(tokens)
  const cwd = chdir !== undefined ? joinPath(segCwd, chdir) : segCwd
  const out: Risk[] = []
  for (const p of payloads) out.push(...classifyAt(p, depth + 1, cwd))
  if (idx >= tokens.length) return out
  const prog = base(tokens[idx] ?? '')
  const args = tokens.slice(idx + 1)
  const push = (kind: RiskKind, a: string[] = args, extra: Partial<Risk> = {}) =>
    out.push({ kind, segment, args: a, ...(cwd !== undefined ? { cwd } : {}), ...extra })

  if (prog === 'rm') {
    // xargs rm deletes every path it is fed, recursive or not
    if (via.includes('xargs')) push('rm', args, { fromXargs: true })
    else if (hasShortFlag(args, 'rR') || args.includes('--recursive')) push('rm')
  } else if (prog === 'git') {
    const g = parseGit(args)
    let dir = cwd
    for (const d of g.dirs) dir = joinPath(dir, d)
    const extra: Partial<Risk> = {
      ...(dir !== undefined ? { cwd: dir } : {}),
      ...(g.gitArgs.length ? { gitArgs: g.gitArgs } : {}),
    }
    const sa = g.subArgs
    if (g.sub === 'reset' && sa.some(a => isLong(a, '--hard'))) push('git-reset-hard', sa, extra)
    else if (g.sub === 'push') {
      if (
        // --force-with-lease and --force-if-includes refuse to clobber remote commits you have not seen, so they are not flagged.
        sa.some(a => isLong(a, '--force')) ||
        sa.some(a => cluster(a, 'f')) ||
        sa.some(a => a.startsWith('+') && a.length > 1)
      )
        push('git-push-force', sa, extra)
      if (
        sa.some(a => isLong(a, '--delete') || isLong(a, '--mirror') || isLong(a, '--prune')) ||
        sa.some(a => cluster(a, 'd')) ||
        sa.some(a => a.startsWith(':') && a.length > 1)
      )
        push('git-push-delete', sa, extra)
    } else if (g.sub === 'clean') {
      // Not just with -f: `-c clean.requireForce=false` (or that setting in a config) deletes
      // without it. -i is no exemption either: a pipe can answer its menu.
      if (!parseClean(sa).dry) push('git-clean', sa, extra)
    } else if ((g.sub === 'checkout' || g.sub === 'restore' || g.sub === 'switch') && discards(g.sub, sa)) {
      push('git-discard', sa, extra)
    } else if (g.sub === 'stash' && sa[0] === 'clear') push('git-stash-clear', sa, extra)
    else if (g.sub === 'worktree' && sa[0] === 'remove' && sa.slice(1).some(a => isLong(a, '--force') || cluster(a, 'f'))) {
      push('git-worktree-force', sa, extra)
    }
  } else if (prog === 'stow' || prog === 'bestow') {
    if (args.includes('--adopt')) push('adopt')
  } else if (prog === 'chmod' || prog === 'chown') {
    if (hasShortFlag(args, 'R') || args.includes('--recursive')) push('chmod-r')
  } else if (prog === 'dd') {
    push('dd')
  } else if (prog === 'mkfs' || prog.startsWith('mkfs.') || prog === 'newfs' || prog.startsWith('newfs_')) {
    push('mkfs')
  } else if (prog === 'diskutil') {
    const verb = args[0] ?? ''
    if (DISKUTIL_ERASE.test(verb) || (/^(apfs|ap)$/i.test(verb) && DISKUTIL_APFS_ERASE.test(args[1] ?? ''))) push('mkfs')
  } else if (prog === 'shred' || prog === 'gshred') {
    push('shred')
  } else if (prog === 'truncate' || prog === 'gtruncate') {
    push('truncate')
  } else if (prog === 'fd' || prog === 'fdfind') {
    // fd -x/-X rm deletes every match, like xargs rm
    const at = args.findIndex(a => a === '-x' || a === '-X' || a === '--exec' || a === '--exec-batch')
    if (at >= 0 && base(args[at + 1] ?? '') === 'rm') push('rm', args.slice(at + 2), { fromXargs: true })
  } else if (prog === 'find') {
    if (findDeletes(args)) push('find-delete')
    // find -exec sh -c 'rm -rf "$1"' _ {} \;: the payload runs on each match, where find runs
    for (const payload of findShellPayloads(args)) {
      for (const r of classifyAt(payload, depth + 1, cwd)) {
        if (r.kind === 'nested' || r.kind === 'sql' || r.remote !== undefined) {
          out.push(r)
          continue
        }
        const { cwd: _cwd, gitArgs: _g, ...rest } = r
        out.push({ ...rest, findArgs: args, ...(cwd !== undefined ? { cwd } : {}) })
      }
    }
  } else if (prog === 'rsync') {
    if (args.some(a => a === '--del' || a.startsWith('--delete'))) push('rsync-delete')
  } else if (SHELLS.has(prog)) {
    // bash -c 'payload' (also -lc, -ec): the payload is the first word after the flag that is not an option
    const payload = shellPayload(args)
    if (payload !== undefined) out.push(...classifyAt(payload, depth + 1, cwd))
    // bash <<< 'payload', sh -s <<< 'payload'
    if (shellReadsStdin(args)) for (const h of hereStrings) out.push(...classifyAt(h, depth + 1, cwd))
  } else if (prog === 'eval') {
    out.push(...classifyAt(args.join(' '), depth + 1, cwd))
  } else if (prog === 'ssh') {
    const remote = sshCommand(args)
    if (remote?.command) {
      for (const r of classifyAt(remote.command, depth + 1, undefined)) {
        const { cwd: _cwd, gitArgs: _g, ...rest } = r
        out.push({ ...rest, remote: remote.host })
      }
    }
  }
  return out
}

/** What `echo ...` or `printf ...` prints, roughly, for a pipe into a shell. */
function printed(segment: string): string | undefined {
  const tokens = tokenize(segment)
  const { idx } = findProgram(tokens)
  const prog = base(tokens[idx] ?? '')
  if (prog !== 'echo' && prog !== 'printf') return undefined
  let args = tokens.slice(idx + 1)
  if (prog === 'echo') while (args[0] !== undefined && /^-[neE]+$/.test(args[0])) args = args.slice(1)
  return args.join(' ')
}

/** Is this segment a shell reading its commands from stdin? */
function isStdinShell(segment: string): boolean {
  const tokens = tokenize(segment)
  const { idx } = findProgram(tokens)
  return SHELLS.has(base(tokens[idx] ?? '')) && shellReadsStdin(tokens.slice(idx + 1))
}

/** Is this segment `git ... commit|tag|merge ...`? */
function isGitMessageSegment(segment: string): boolean {
  const tokens = tokenize(segment)
  const { idx } = findProgram(tokens)
  if (base(tokens[idx] ?? '') !== 'git') return false
  const sub = parseGit(tokens.slice(idx + 1)).sub
  return sub === 'commit' || sub === 'tag' || sub === 'merge'
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

/**
 * Past MAX_DEPTH nothing is parsed, but a destructive-looking word still
 * asks: cheap tests, each linear, so a deep payload cannot slip through.
 */
function looksDestructive(text: string): boolean {
  return (
    /\brm\s+(?:-[A-Za-z]*[rR]|--recursive)/.test(text) ||
    (/\bgit\b/.test(text) && /\b(?:push|reset|clean|checkout|restore|switch|stash|worktree)\b/.test(text)) ||
    (/\bfind\b/.test(text) && /-(?:delete|exec)\b/.test(text)) ||
    /\bfd(?:find)?\b[^\n]{0,200}\s(?:-[xX]|--exec(?:-batch)?)\s+(?:\S*\/)?rm\b/.test(text) ||
    /\brsync\b[^\n]{0,200}--del/.test(text) ||
    /\b(?:dd|mkfs(?:\.\w+)?|newfs(?:_\w+)?|g?shred)\b/.test(text) ||
    /\bg?truncate\s+-/.test(text) ||
    /\bdiskutil\s+(?:ap(?:fs)?\s+)?(?:erase|zeroDisk|randomDisk|secureErase|partitionDisk|reformat|delete)/i.test(text) ||
    /\bch(?:mod|own)\s+-[A-Za-z]*R/.test(text) ||
    /--adopt\b/.test(text) ||
    SQL_DESTRUCTIVE.test(text) ||
    MIGRATE.test(text)
  )
}

const keyOf = (r: Risk) => `${r.kind}\0${r.args.join('\0')}\0${r.cwd ?? ''}\0${r.remote ?? ''}`

function classifyAt(command: string, depth: number, baseCwd: string | undefined): Risk[] {
  if (depth > MAX_DEPTH) {
    return looksDestructive(command) ? [{ kind: 'nested', segment: command, args: [] }] : []
  }
  const { code: text, texts } = sanitize(command)
  const risks: Risk[] = []
  let cwd = baseCwd
  // A `(` subshell keeps its `cd` to itself: the directory comes back at its `)`
  const saved: (string | undefined)[] = []
  const pieces = splitWithSeps(text)
  let inCase = 0
  for (let p = 0; p < pieces.length; p++) {
    const piece = pieces[p] as Piece
    let seg = piece.text.trim()
    // case x in  pattern) cmd ;;  esac: the labels are not commands
    if (/^case\s/.test(seg)) {
      inCase++
      seg = seg.replace(/^case\s+\S+\s+in\b\s*/, '')
    }
    if (inCase > 0) {
      if (/^esac\b/.test(seg)) {
        inCase--
        seg = seg.replace(/^esac\b\s*/, '')
      }
      seg = seg.replace(/^\(?[^\s()'"`;|&<>]+\)\s*/, '')
    }
    seg = stripFunction(seg)
    if (!seg) continue
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
    // echo '...' | bash: what is printed is run
    const nextPiece = pieces[p + 1]
    if (piece.sep === '|' && nextPiece && isStdinShell(nextPiece.text.trim())) {
      const payload = printed(seg)
      if (payload !== undefined) risks.push(...classifyAt(payload, depth + 1, cwd))
    }
    for (let k = closesIn(seg); k > 0 && saved.length > 0; k--) cwd = saved.pop()
  }
  for (const inner of substitutions(text)) risks.push(...classifyAt(inner, depth + 1, cwd))

  const plain = scrubMessages(text)
  const data = texts.join('\n')
  if (SQL_DESTRUCTIVE.test(plain) || MIGRATE.test(plain) || SQL_DESTRUCTIVE.test(data) || MIGRATE.test(data)) {
    risks.push({ kind: 'sql', segment: command, args: [] })
  }

  // Fallback for forms the tokenizer misses (rm inside quotes); find -exec rm is already find-delete
  if (!risks.some(r => r.kind === 'rm' || r.kind === 'find-delete') && RM_FALLBACK.test(plain)) {
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
  // One sql entry, and one nested one, is enough, whichever level found it
  const sql = risks.findIndex(r => r.kind === 'sql')
  const nested = risks.findIndex(r => r.kind === 'nested')
  return risks.filter((r, i) => (r.kind !== 'sql' || i === sql) && (r.kind !== 'nested' || i === nested))
}

/**
 * `git clean -n` with what changes what goes: -d, -x, -X, a second -f
 * (nested repositories), -e and the pathspecs. -i and -q are dropped.
 */
export function cleanDryRun(args: string[]): string[] {
  const c = parseClean(args)
  const out = ['clean', '-n']
  const cluster = `${c.force >= 2 ? 'ff' : ''}${c.letters.join('')}`
  if (cluster) out.push(`-${cluster}`)
  for (const e of c.excludes) out.push('-e', e)
  if (c.paths.length) out.push('--', ...c.paths)
  return out
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
