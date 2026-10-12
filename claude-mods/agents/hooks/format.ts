// Pure helpers for the agents mod: no engine calls, so they test without a session.

export const CRAB = '🦀'

// One costume per agent type; the crab underneath stays the same.
const COSTUMES: [RegExp, string][] = [
  [/explore/i, '🧭'],
  [/plan/i, '📐'],
  [/review|critic/i, '🔬'],
  [/secur|guard|audit/i, '🔒'],
  [/test|verif|qa/i, '🧪'],
  [/guide|doc/i, '📖'],
  [/statusline|design|ui/i, '🎨'],
  [/fork/i, '🍴'],
  [/general|build|implement|dev|code/i, '🔧'],
]

export const costumeOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  for (const [re, costume] of COSTUMES) if (re.test(bare)) return costume
  return '🦀'
}

export const clip = (text: string, max: number): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export const fmt = (n: number): string => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(Math.round(n))
}

export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// `claude-sonnet-4-6` -> `Sonnet 4.6`; anything unrecognised is shown as given.
export const modelName = (id = ''): string => {
  const m = /(fable|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? `.${minor}` : ''}`
}

// A subagent's window is not reported: Haiku is 200k, anything else gets the session's own window.
export const windowOf = (model: string, session = 200_000): number => (/haiku/i.test(model) ? 200_000 : session)

export const fillBar = (used: number, max: number, cells: number): string => {
  const filled = Math.max(0, Math.min(cells, Math.round((used / max) * cells)))
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}

// A short, human target for a tool call: the file, the command, the pattern. A Bash call prefers the
// description the agent wrote ("Read tmux sessionizer") over the raw command. Cut at 120; the layout trims it to fit.
export const targetOf = (input: Record<string, unknown>, tool?: string): string => {
  const pick = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)
  const path = pick('file_path') ?? pick('notebook_path')
  if (path) return path.split('/').slice(-2).join('/')
  const text =
    tool === 'Bash'
      ? (pick('description') ?? pick('command'))
      : (pick('command') ?? pick('pattern') ?? pick('url') ?? pick('query') ?? pick('description') ?? pick('path'))
  return text ? clip(text, 120) : ''
}
