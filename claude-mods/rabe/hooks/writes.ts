import type { FsStat } from 'claude-code'

// The files a shell command line may write or delete, read from its words: file
// redirections and a fixed table of commands. Candidates only: the caller
// checks each on disk.

export type ShellWrite = { path: string; isDeleted?: true }

// text: the value after quote removal. known: no expansion. single: one word
// after expansion. split: an unquoted expansion whose fields can be anything.
// lead: the first character when it is literal and cannot expand ('' if not).
type Word = {
  text: string
  raw: string
  known: boolean
  single: boolean
  split: boolean
  lead: string
}
type Op = { op: string }
type Tok = Word | Op

const OPS = [
  ';;&',
  '<<<',
  '<<-',
  '&>>',
  '&&',
  '||',
  ';;',
  ';&',
  '|&',
  '>>',
  '>|',
  '>&',
  '<&',
].concat(['<>', '<<', '&>', '|', '&', ';', '(', ')', '<', '>'])
const META = ' \t\n|&;()<>'
const REDIRECTS = new Set(['<', '>', '>>', '>|', '&>', '&>>', '>&', '<&', '<>', '<<', '<<-', '<<<'])
const WRITES = new Set(['>', '>>', '>|', '&>', '&>>'])
const STOPS = new Set(
  ['if', 'then', 'else', 'elif', 'fi', 'while', 'until', 'for', 'do', 'done', 'case', 'esac']
    .concat(['select', 'function', 'coproc', '{', '}', '[[', ']]', '!', '[', 'test', 'exit'])
    .concat(['return', 'exec', 'eval', 'source', '.', 'break', 'continue']),
)
const ASSIGN = /^[A-Za-z_]\w*\+?=/
const PARAM = /[A-Za-z0-9_@*#?$!-]/
const MAX_DEPTH = 64

// Index after the `$(…)`, `${…}`, `` `…` ``, `<(…)` or `>(…)` that starts at i; -1 if it does not end.
function skipExpansion(src: string, i: number, depth: number): number {
  if (depth > MAX_DEPTH) return -1
  if (src[i] === '`') {
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') j++
      else if (src[j] === '`') return j + 1
    }
    return -1
  }
  const [open, close] = src[i + 1] === '{' ? ['{', '}'] : ['(', ')']
  let level = 1
  for (let j = i + 2; j < src.length; ) {
    const c = src[j]
    if (c === '\\') j += 2
    else if (c === "'") {
      j = src.indexOf("'", j + 1) + 1
      if (j === 0) return -1
    } else if (c === '$' && src[j + 1] === "'") {
      j = skipAnsi(src, j + 2)
      if (j < 0) return -1
    } else if (c === '"') {
      j = skipDouble(src, j + 1, depth + 1)
      if (j < 0) return -1
    } else if (c === '`' || (c === '$' && (src[j + 1] === '(' || src[j + 1] === '{'))) {
      j = skipExpansion(src, j, depth + 1)
      if (j < 0) return -1
    } else if (c === '#' && close === ')' && ' \t\n;(|&'.includes(src[j - 1] as string)) {
      j = src.indexOf('\n', j)
      if (j < 0) return -1
    } else {
      if (c === open) level++
      else if (c === close && --level === 0) return j + 1
      j++
    }
  }
  return -1
}

function skipDouble(src: string, j: number, depth: number): number {
  if (depth > MAX_DEPTH) return -1
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') j += 2
    else if (c === '"') return j + 1
    else if (c === '`' || (c === '$' && (src[j + 1] === '(' || src[j + 1] === '{'))) {
      j = skipExpansion(src, j, depth + 1)
      if (j < 0) return -1
    } else j++
  }
  return -1
}

function skipAnsi(src: string, j: number): number {
  for (; j < src.length; j++) {
    if (src[j] === '\\') j++
    else if (src[j] === "'") return j + 1
  }
  return -1
}

// A top-level expansion; one that holds a here-doc or a case may end at the wrong `)`.
function expansion(src: string, i: number): number {
  const end = skipExpansion(src, i, 0)
  return end < 0 || /<<|\bcase\b/.test(src.slice(i, end)) ? -1 : end
}

// One word from i with bash quote removal; undefined when a quote or expansion does not end.
function readWord(
  src: string,
  start: number,
  home?: string,
): { word: Word; end: number } | undefined {
  let text = ''
  let known = true
  let single = true
  let split = false
  let lead: string | undefined
  const lit = (value: string) => {
    if (lead === undefined && value) lead = value[0]
    text += value
  }
  const dyn = (raw: string, kind: 'one' | 'many' | 'split') => {
    lead ??= ''
    known = false
    if (kind !== 'one') single = false
    if (kind === 'split') split = true
    text += raw
  }
  const param = (j: number) => {
    let end = j + 2
    if (/[A-Za-z_]/.test(src[j + 1] as string)) while (/\w/.test(src[end] ?? '')) end++
    return end
  }
  let i = start
  while (i < src.length && !META.includes(src[i] as string)) {
    const c = src[i] as string
    const next = src[i + 1] ?? ''
    if (c === '\\') {
      if (next !== '\n') lit(next)
      i += 2
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1)
      if (end < 0) return
      lit(src.slice(i + 1, end))
      i = end + 1
    } else if (c === '$' && next === "'") {
      const end = skipAnsi(src, i + 2)
      if (end < 0) return
      const body = src.slice(i + 2, end - 1)
      if (body.includes('\\')) dyn(body, 'one')
      else lit(body)
      i = end
    } else if (c === '$' && next === '"') {
      dyn('', 'one')
      i++
    } else if (c === '"') {
      i++
      for (;;) {
        const d = src[i]
        if (d === undefined) return
        if (d === '"') break
        if (d === '\\' && '$`"\\\n'.includes(src[i + 1] ?? 'x')) {
          if (src[i + 1] !== '\n') lit(src[i + 1] as string)
          i += 2
        } else if (d === '`' || (d === '$' && (src[i + 1] === '(' || src[i + 1] === '{'))) {
          const end = expansion(src, i)
          if (end < 0) return
          dyn(src.slice(i, end), src.slice(i, end).includes('[@]') ? 'split' : 'one')
          i = end
        } else if (d === '$' && PARAM.test(src[i + 1] ?? '')) {
          const end = param(i)
          dyn(src.slice(i, end), src[i + 1] === '@' ? 'split' : 'one')
          i = end
        } else {
          lit(d)
          i++
        }
      }
      i++
    } else if (c === '`' || (c === '$' && (next === '(' || next === '{'))) {
      const end = expansion(src, i)
      if (end < 0) return
      dyn(src.slice(i, end), 'split')
      i = end
    } else if (c === '$' && PARAM.test(next)) {
      const end = param(i)
      dyn(src.slice(i, end), 'split')
      i = end
    } else if (c === '~' && i === start && home && next === '/') {
      lit(home)
      i++
    } else if (c === '~' && i === start) {
      lit('~')
      known = false
      i++
    } else if ('*?[{}'.includes(c)) {
      dyn(c, 'many')
      i++
    } else {
      lit(c)
      i++
    }
  }
  const word = { text, raw: src.slice(start, i), known, single, split, lead: lead ?? '' }
  return { word, end: i }
}

// Words and operators; here-doc bodies and comments dropped. An unterminated
// here-doc cuts the list at its start and ends it with a `stop`.
function lex(src: string, home?: string): Tok[] | undefined {
  const toks: Tok[] = []
  const docs: { delim: string; strip: boolean; at: number }[] = []
  const cut = (at: number) => {
    toks.length = at
    toks.push({ op: 'stop' })
    return toks
  }
  let i = 0
  while (i < src.length) {
    const c = src[i] as string
    if (c === ' ' || c === '\t') i++
    else if (c === '\\' && src[i + 1] === '\n') i += 2
    else if (c === '#') i = src.includes('\n', i) ? src.indexOf('\n', i) : src.length
    else if (c === '\n') {
      toks.push({ op: '\n' })
      i++
      for (const doc of docs.splice(0)) {
        let found = false
        while (i < src.length && !found) {
          const nl = src.indexOf('\n', i)
          const line = src.slice(i, nl < 0 ? src.length : nl)
          i = nl < 0 ? src.length : nl + 1
          found = (doc.strip ? line.replace(/^\t+/, '') : line) === doc.delim
        }
        if (!found) return cut(doc.at)
      }
    } else if ((c === '<' || c === '>') && src[i + 1] === '(') {
      let end = expansion(src, i)
      if (end < 0) return
      const rest = META.includes(src[end] ?? ' ') ? undefined : readWord(src, end, home)
      end = rest ? rest.end : end
      const raw = src.slice(i, end)
      toks.push({ text: raw, raw, known: false, single: true, split: false, lead: '' })
      i = end
    } else if (META.includes(c)) {
      const op = OPS.find(one => src.startsWith(one, i)) as string
      toks.push({ op })
      i += op.length
      if (op === '<<' || op === '<<-') {
        while (src[i] === ' ' || src[i] === '\t') i++
        const delim = META.includes(src[i] ?? ' ') ? undefined : readWord(src, i)
        if (!delim?.word.known || !delim.word.text) return
        docs.push({ delim: delim.word.text, strip: op === '<<-', at: toks.length - 1 })
        i = delim.end
      }
    } else {
      const read = readWord(src, i, home)
      if (!read) return
      i = read.end
      // A number right before `<` or `>` names a file descriptor, not an argument.
      if (!/^\d+$/.test(read.word.raw) || !'<>'.includes(src[i] ?? ' ')) toks.push(read.word)
    }
  }

  return docs[0] ? cut(docs[0].at) : toks
}

function normalize(path: string): string {
  const isAbsolute = path.startsWith('/')
  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..' && parts.length && parts.at(-1) !== '..') parts.pop()
    else if (seg !== '..' || !isAbsolute) parts.push(seg)
  }

  return (isAbsolute ? '/' : '') + (parts.join('/') || (isAbsolute ? '' : '.'))
}

const basename = (path: string) => path.replace(/\/+$/, '').split('/').at(-1) ?? path
const literal = (text: string): Word => ({
  text,
  raw: text,
  known: true,
  single: true,
  split: false,
  lead: text[0] ?? '',
})

// Short options in `flags` take no value, in `values` one, in `optional` an
// attached one only. Long options map to a key, with `=` for a value and `?`
// for an attached one only.
type Spec = { flags: string; values?: string; optional?: string; long?: Record<string, string> }

const SPECS: Record<string, Spec> = {
  rm: {
    flags: 'frRvd',
    long: { force: '-', recursive: '-', verbose: '-', dir: '-', 'one-file-system': '-' },
  },
  touch: {
    flags: 'acmhf',
    values: 'dtr',
    long: { date: '-=', reference: '-=', time: '-=', 'no-create': '-', 'no-dereference': '-' },
  },
  tee: { flags: 'aip', long: { append: '-', 'ignore-interrupts': '-', 'output-error': '-?' } },
  sed: {
    flags: 'nErsuz',
    values: 'efl',
    optional: 'i',
    long: {
      expression: 'e=',
      file: 'f=',
      'in-place': 'i?',
      quiet: '-',
      silent: '-',
      'regexp-extended': '-',
      separate: '-',
      unbuffered: '-',
      'null-data': '-',
      'line-length': '-=',
      posix: '-',
      'follow-symlinks': '-',
    },
  },
  cp: {
    flags: 'adfHlLPprRsTvxb',
    values: 'tS',
    long: {
      archive: '-',
      force: '-',
      link: '-',
      dereference: '-',
      'no-dereference': '-',
      preserve: '-?',
      'no-preserve': '-=',
      recursive: '-',
      'remove-destination': '-',
      'symbolic-link': '-',
      'target-directory': 't=',
      'no-target-directory': 'T',
      verbose: '-',
      'one-file-system': '-',
      suffix: '-=',
      backup: '-?',
      sparse: '-=',
      reflink: '-?',
      'strip-trailing-slashes': '-',
    },
  },
  mv: {
    flags: 'fvbT',
    values: 'tS',
    long: {
      force: '-',
      verbose: '-',
      'target-directory': 't=',
      'no-target-directory': 'T',
      suffix: '-=',
      backup: '-?',
      'strip-trailing-slashes': '-',
    },
  },
  install: {
    flags: 'bcCDpsvTd',
    values: 'mogtS',
    long: {
      mode: '-=',
      owner: '-=',
      group: '-=',
      'target-directory': 't=',
      'no-target-directory': 'T',
      directory: 'd',
      compare: '-',
      'preserve-timestamps': '-',
      strip: '-',
      verbose: '-',
      suffix: '-=',
      backup: '-?',
    },
  },
  ln: {
    flags: 'sfnvbrTLP',
    values: 'tS',
    long: {
      symbolic: '-',
      force: '-',
      'no-dereference': '-',
      verbose: '-',
      relative: '-',
      logical: '-',
      physical: '-',
      'target-directory': 't=',
      'no-target-directory': 'T',
      suffix: '-=',
      backup: '-?',
    },
  },
}

// Options and operands; undefined when an option is unknown or a word could
// turn into one.
function options(args: Word[], spec: Spec) {
  const opts = new Map<string, Word | true>()
  const files: Word[] = []
  for (let k = 0; k < args.length; k++) {
    const arg = args[k] as Word
    if (arg.split) return
    if (arg.text === '--' && arg.known) {
      const rest = args.slice(k + 1)
      if (rest.some(one => one.split)) return
      files.push(...rest)
      break
    }
    if (arg.lead !== '-' || arg.text === '-') {
      if (arg.lead === '' && !(arg.known && arg.text === '')) return
      files.push(arg)
      continue
    }
    if (!arg.known) return
    if (arg.text.startsWith('--')) {
      const eq = arg.text.indexOf('=')
      const name = arg.text.slice(2, eq < 0 ? undefined : eq)
      const [key = '', kind = ''] = spec.long?.[name] ?? ''
      if (!key) return
      if (kind === '=') {
        const value = eq < 0 ? args[++k] : literal(arg.text.slice(eq + 1))
        if (!value?.single) return
        opts.set(key, value)
      } else if (kind === '?' || eq < 0) opts.set(key, true)
      else return
      continue
    }
    for (let n = 1; n < arg.text.length; n++) {
      const flag = arg.text[n] as string
      if (spec.optional?.includes(flag)) {
        opts.set(flag, true)
        break
      }
      if (spec.values?.includes(flag)) {
        const rest = arg.text.slice(n + 1)
        const value = rest ? literal(rest) : args[++k]
        if (!value?.single) return
        opts.set(flag, value)
        break
      }
      if (!spec.flags.includes(flag)) return
      opts.set(flag, true)
    }
  }

  return { opts, files }
}

type Target = [word: Word | undefined, isDeleted?: boolean]

// The files a command from the table writes, or none when its words leave doubt.
function targets(name: string, args: Word[]): Target[] {
  const spec = SPECS[name]
  if (!spec) return []
  const empty = args.findIndex(one => one.raw === '-i')
  const bsd = name === 'sed' && empty >= 0 && args[empty + 1]?.known && args[empty + 1]?.text === ''
  const parsed = options(bsd ? args.filter((_, n) => n !== empty + 1) : args, spec)
  if (!parsed) return []
  const { opts, files } = parsed
  if (name === 'rm') return files.map(one => [one, true])
  if (name === 'touch' || name === 'tee') return files.map(one => [one])
  if (name === 'sed') {
    if (!opts.has('i') || files.some(one => !one.single)) return []
    return (opts.has('e') || opts.has('f') ? files : files.slice(1)).map(one => [one])
  }
  if (files.some(one => !one.single) || (name === 'install' && opts.has('d'))) return []
  const dir = opts.get('t')
  const dest = dir === true ? undefined : (dir ?? files.at(-1))
  const sources = dir ? files : files.slice(0, -1)
  const whole = opts.has('T')
  if (!dest || !sources.length || (whole && (dir || sources.length > 1))) return []
  const into = !whole && (dir || sources.length > 1 || dest.text.endsWith('/'))
  // `cp a b` writes `b`, or `b/a` when `b` is a folder: both are candidates.
  const out: Target[] = into ? [] : [[dest]]
  for (const source of sources) {
    if (name === 'mv') out.push([source, true])
    const base = basename(source.text)
    if (whole || !source.known || !dest.known || /^\.{0,2}$/.test(base)) continue
    out.push([literal(`${dest.text.replace(/\/+$/, '')}/${base}`)])
  }

  return out
}

// A simple command after the redirections are taken out and the known
// prefixes unwrapped; 'stop' for a construct that can change what runs.
type Simple = { writes: Word[]; name?: string; args: Word[]; isLast?: true }

function simple(segment: Tok[]): Simple | 'stop' {
  const writes: Word[] = []
  const words: Word[] = []
  for (let k = 0; k < segment.length; k++) {
    const tok = segment[k] as Tok
    if (!('op' in tok)) words.push(tok)
    else if (tok.op !== '<<' && tok.op !== '<<-') {
      const target = segment[++k]
      if (!target || 'op' in target) return 'stop'
      if (WRITES.has(tok.op)) writes.push(target)
    }
  }
  let k = 0
  while (ASSIGN.test(words[k]?.raw ?? '')) k++
  for (;;) {
    const word = words[k]
    if (!word) return { writes, args: [] }
    if (STOPS.has(word.raw)) return 'stop'
    if (!word.known) return { writes, args: [], isLast: true }
    const raw = (n: number) => words[k + n]?.raw ?? ''
    const name = word.text
    k++
    if (name === 'builtin' || name === 'nohup') continue
    if (name === 'command' || name === 'time') {
      if (raw(0) === '-p') k++
    } else if (name === 'nice') {
      if (raw(0) === '-n') k += 2
      else if (/^(-n?\d+|--adjustment=\d+)$/.test(raw(0))) k++
    } else if (name === 'env') {
      while (/^(-i|-|--ignore-environment)$/.test(raw(0)) || ASSIGN.test(raw(0))) k++
    } else if (name === 'sudo') {
      while (raw(0).startsWith('-')) {
        if (!/^(-[EHnSkP]+|--)$/.test(raw(0))) return { writes, args: [] }
        k++
        if (raw(-1) === '--') break
      }
    } else if (name === 'rtk' && raw(0) === 'proxy') k++
    else {
      const command = /^(\/usr)?\/bin\/[^/]+$/.test(name) ? basename(name) : name
      return { writes, name: command, args: words.slice(k) }
    }
  }
}

type Run = { dir?: string; isLost: boolean; hasCd: boolean; home?: string; pending: ShellWrite[] }

function place(run: Run, text: string): string | undefined {
  if (text.startsWith('/')) return normalize(text)
  if (run.isLost) return
  return normalize(run.dir ? `${run.dir}/${text}` : text)
}

function put(run: Run, word: Word | undefined, isDeleted?: boolean) {
  if (!word?.known || word.text === '' || word.text === '-') return
  const path = place(run, word.text)
  if (!path || path === '/dev' || path.startsWith('/dev/')) return
  run.pending.push({ path, ...(isDeleted && { isDeleted: true as const }) })
}

// One pipeline; false when the rest of the line may not run as written.
function pipeline(run: Run, segments: Tok[][], isSure: boolean, isOrBranch: boolean): boolean {
  const commands = segments.map(simple)
  if (commands.some(one => one === 'stop')) return false
  const isPiped = commands.length > 1
  for (const command of commands as Simple[]) {
    for (const word of command.writes) put(run, word)
    const { name, args } = command
    if (name === 'cd' && !isPiped) {
      run.hasCd = true
      const target = args.length ? args[0] : run.home ? literal(run.home) : undefined
      const dir =
        args.length < 2 && target?.known && !target.text.startsWith('-') && place(run, target.text)
      run.dir = dir || run.dir
      run.isLost = !dir || !isSure || isOrBranch
    } else if (name === 'pushd' || name === 'popd') {
      if (!isPiped) run.isLost = true
    } else if (name && (!isPiped || name === 'tee')) {
      for (const [word, isDeleted] of targets(name, args)) put(run, word, isDeleted)
    }
  }

  return !commands.some(one => (one as Simple).isLast)
}

export function shellWrites(command: string, cwd?: string, home?: string): ShellWrite[] {
  try {
    // ponytail: a HOME assignment anywhere drops every `~`, not only the later ones
    return parse(command, cwd, /\bHOME=/.test(command) ? undefined : home)
  } catch {
    return []
  }
}

function parse(command: string, cwd?: string, home?: string): ShellWrite[] {
  const out = new Map<string, ShellWrite>()
  const toks = lex(command, home)
  if (!toks) return []
  const run: Run = { dir: cwd, isLost: false, hasCd: false, home, pending: [] }
  const commit = () => {
    for (const write of run.pending.splice(0)) {
      out.delete(write.path)
      out.set(write.path, write)
    }
  }
  let segments: Tok[][] = [[]]
  let isOrBranch = false
  let needsCommand = false
  for (let k = 0; k <= toks.length; k++) {
    const tok = toks[k] ?? { op: '\n' }
    const op = 'op' in tok ? tok.op : undefined
    if (op === undefined || REDIRECTS.has(op)) {
      segments.at(-1)?.push(tok)
      needsCommand = false
      continue
    }
    if (op === '\n' && needsCommand) continue
    if (op === '|' || op === '|&') {
      segments.push([])
      needsCommand = true
      continue
    }
    const isList = op === '&&' || op === ';' || op === '\n'
    const goes = (isList || op === '||') && pipeline(run, segments, op === '&&', isOrBranch)
    segments = [[]]
    if (goes && (isList || op === '||')) {
      needsCommand = op === '&&' || op === '||'
      if (op === '||') {
        isOrBranch = true
        if (run.hasCd) run.isLost = true
      } else if (op !== '&&') {
        commit()
        isOrBranch = false
        run.hasCd = false
      }
      continue
    }
    // A later `&` may put this whole list in the background.
    if (op !== '&' && !toks.slice(k + 1).some(one => 'op' in one && one.op === '&')) commit()
    break
  }

  return [...out.values()]
}

// What a path held: its stat, 'none' when it is not there, undefined when unknown.
export type Seen = Pick<FsStat, 'kind' | 'size' | 'mtimeMs'> | 'none' | undefined

// How a path changed between two looks: a file that is new or has another
// mtime or size is written; a path that is gone is deleted.
export function changed(before: Seen, after: Seen): 'write' | 'delete' | undefined {
  if (!before || !after) return
  if (after === 'none') return before === 'none' ? undefined : 'delete'
  if (after.kind !== 'file') return
  if (before === 'none' || before.mtimeMs !== after.mtimeMs || before.size !== after.size) {
    return 'write'
  }
}
