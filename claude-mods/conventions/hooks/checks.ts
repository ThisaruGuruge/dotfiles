/** The checks a repo can name in `.claude/conventions.json`. */
export const CHECKS = ['tabs', 'shfmt', 'zsh', 'stylua', 'fixtures'] as const
export type Check = (typeof CHECKS)[number]

/** Files larger than this are not checked. */
export const SIZE_CAP = 256 * 1024
/** Each external check is killed after this long, and then says nothing. */
export const TIMEOUT_MS = 3000
/** Lines of a tool's output kept in a message (its `fix:` lines are always kept). */
export const MAX_LINES = 12

export type Config = { enabled: boolean; checks: Check[] }

/**
 * `.claude/conventions.json`: `{ "enabled": true, "checks": ["tabs", ...] }`.
 * Absent or unreadable, the mod is on in the dotfiles repo and off elsewhere,
 * with every check; an absent `checks` means all of them.
 */
export function parseConfig(text: string | undefined, isDotfiles: boolean): Config {
  let raw: unknown
  if (text !== undefined) {
    try {
      raw = JSON.parse(text)
    } catch {
      raw = undefined
    }
  }
  const o = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : isDotfiles
  const named = o.checks
  const checks = Array.isArray(named) ? CHECKS.filter(c => named.includes(c)) : [...CHECKS]
  return { enabled, checks }
}

const base = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1)

/** Files whose format needs tabs. */
export function allowsTabs(rel: string): boolean {
  const b = base(rel)
  return /^(?:GNUmakefile|[Mm]akefile|\.gitmodules|go\.mod|go\.sum)$/.test(b) || /\.(?:mk|go|tsv|patch|diff)$/.test(b)
}

/** Lines (1-based) whose indentation holds a tab. A tab after the indent is data and left alone. */
export function tabLines(text: string): number[] {
  const out: number[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \t]*\t/.test(lines[i] ?? '')) out.push(i + 1)
  }
  return out
}

/** Test code and fixtures: where a token-shaped literal must be built at runtime instead. */
export function isFixture(rel: string): boolean {
  const b = base(rel)
  return (
    /(?:^|\/)(?:tests?|__tests__|fixtures?|testdata|spec)\//.test(rel) ||
    /\.(?:test|spec)\.[^./]+$/.test(b) ||
    /_test\.[^./]+$/.test(b) ||
    /^test_.*\.py$/.test(b)
  )
}

export type Lang = 'bash' | 'zsh' | 'lua' | undefined

/** The language of a file outside the dotfiles repo, by its name or shebang. */
export function language(rel: string, text: string): Lang {
  const b = base(rel)
  const nl = text.indexOf('\n')
  const shebang = text.startsWith('#!') ? text.slice(0, nl < 0 ? undefined : nl) : ''
  if (/\.zsh$/.test(b) || /^\.(?:zshrc|zshenv|zprofile|zlogin|zlogout)$/.test(b) || /\bzsh\b/.test(shebang)) return 'zsh'
  if (/\.(?:sh|bash)$/.test(b) || /\b(?:bash|sh)\b/.test(shebang)) return 'bash'
  if (/\.lua$/.test(b)) return 'lua'
  return undefined
}

/** "3, 7, 9" or "3, 7, 9, 12, 15 (+4 more)". */
export function lineList(nums: number[], max = 5): string {
  const shown = nums.slice(0, max).join(', ')
  return nums.length > max ? `${shown} (+${nums.length - max} more)` : shown
}

/** A tool's output cut to MAX_LINES lines of 200 characters, its `fix:` lines kept, indented. */
export function trimOutput(out: string): string {
  const lines = out.split('\n').filter(l => l.trim() !== '')
  const fixes = lines.filter(l => l.startsWith('fix: '))
  const body = lines.filter(l => !l.startsWith('fix: '))
  const kept = body.slice(0, MAX_LINES).map(l => (l.length > 200 ? `${l.slice(0, 199)}…` : l))
  if (body.length > MAX_LINES) kept.push(`… (${body.length - MAX_LINES} more lines)`)
  return [...kept, ...fixes].map(l => `  ${l}`).join('\n')
}

export function tabProblem(rel: string, lines: number[], lang: Lang): string {
  const fix =
    lang === 'bash'
      ? `shfmt -i 4 -ci -w ${rel}`
      : lang === 'lua'
        ? `stylua ${rel}`
        : 're-indent those lines with spaces (4 for shell, 2 for Lua, else the file’s own width)'
  return `- tab indentation on line ${lineList(lines)}; this repo indents with spaces only. Fix: ${fix}`
}

export function fixtureProblem(hits: { kind: string; line: number }[]): string {
  const kinds = [...new Set(hits.map(h => h.kind))].join(', ')
  return (
    `- token-shaped literal (${kinds}) on line ${lineList(hits.map(h => h.line))} of a test file; secret scanners flag it ` +
    `even when fake. Fix: build it at runtime from pieces, e.g. ['gh', 'p_', 'a1B2'.repeat(9)].join('')`
  )
}

export function toolProblem(label: string, out: string): string {
  return `- ${label}:\n${trimOutput(out)}`
}

export function compose(rel: string, problems: string[]): string {
  return [`conventions (advisory, the edit was applied): ${rel}`, ...problems].join('\n')
}
