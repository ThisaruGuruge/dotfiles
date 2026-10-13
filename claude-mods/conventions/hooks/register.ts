import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsStat, Register } from 'claude-code'

import type { Sent } from '../types'
import {
  SIZE_CAP,
  TIMEOUT_MS,
  allowsTabs,
  compose,
  fixtureProblem,
  isFixture,
  language,
  lintChecks,
  parseConfig,
  tabLines,
  tabProblem,
  toolProblem,
} from './checks'
import type { Check } from './checks'
import { findTokens } from './tokens'

type $ = EngineInterface

const isPaused = atom({ plugin: 'conventions', key: 'isPaused' } as const, false)
const sent = atom({ plugin: 'conventions', key: 'sent' } as const, {} as Sent)

// Directory -> repo root, repo root -> "has the dotfiles layout", and (owner
// checkout, repo root) -> "is that checkout or one of its worktrees". Module
// variables: a reload only costs the walk again.
const roots = new Map<string, string>()
const dotfiles = new Map<string, boolean>()
const trusted = new Map<string, boolean>()

const MOD_DIR = '/claude-mods/conventions'

/** `.claude/conventions.json` larger than this is ignored. */
const CONFIG_CAP = 64 * 1024
/** Files remembered in `sent` before the oldest are dropped. */
const SENT_CAP = 200

async function stat($: $, path: string, resolve = false): Promise<FsStat | undefined> {
  try {
    return await $.fs.stat(path, resolve ? { resolve } : undefined)
  } catch {
    return undefined
  }
}

async function readText($: $, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(path)
  } catch {
    return undefined
  }
}

const dirname = (p: string) => p.slice(0, Math.max(p.lastIndexOf('/'), 0))

/** The nearest directory above `file` holding `.git` (a dir, or a worktree's file). */
async function findRoot($: $, file: string): Promise<string | undefined> {
  const start = dirname(file)
  const cached = roots.get(start)
  if (cached !== undefined) return cached
  let dir = start
  for (let i = 0; i < 64 && dir !== ''; i++) {
    const git = await stat($, `${dir}/.git`)
    if (git !== undefined && git.kind !== 'other') {
      roots.set(start, dir)
      return dir
    }
    dir = dirname(dir)
  }
  return undefined
}

/**
 * The dotfiles layout, in any checkout, worktree or copy: it has bin/lint and
 * this mod's manifest. It turns the checks on by default; it does not make the
 * repo's bin/lint safe to run (see isTrusted).
 */
async function isDotfiles($: $, root: string): Promise<boolean> {
  const known = dotfiles.get(root)
  if (known !== undefined) return known
  const [lint, manifest] = await Promise.all([
    stat($, `${root}/bin/lint`),
    readText($, `${root}/claude-mods/conventions/.claude-plugin/plugin.json`),
  ])
  let name: unknown
  try {
    name = (JSON.parse(manifest ?? '') as { name?: unknown } | null)?.name
  } catch {
    name = undefined
  }
  const is = lint?.kind === 'file' && name === 'conventions'
  dotfiles.set(root, is)
  return is
}

/** Where a path lands, links and `..` resolved; undefined when it leads nowhere. */
async function real($: $, path: string): Promise<string | undefined> {
  const st = await stat($, path, true)
  return st?.realPath
}

/**
 * The owner's dotfiles checkout: the folder this mod is loaded from, by its
 * entry in CLAUDE_CODE_PLUGIN_DIRS (`~` expanded, links resolved), less
 * `/claude-mods/conventions`. Undefined without such an entry, or when the
 * environment cannot be read.
 */
async function ownerRepo($: $): Promise<string | undefined> {
  let dirs: string | undefined
  let home: string | undefined
  try {
    dirs = await $.env.get('CLAUDE_CODE_PLUGIN_DIRS')
    home = await $.env.get('HOME')
  } catch {
    return undefined
  }
  if (dirs === undefined || dirs === '') return undefined
  for (const raw of dirs.split(':')) {
    let dir = raw.trim().replace(/\/+$/, '')
    if (dir === '~' || dir.startsWith('~/')) {
      if (home === undefined || !home.startsWith('/')) continue
      dir = home.replace(/\/+$/, '') + dir.slice(1)
    }
    if (!dir.startsWith('/') || !dir.endsWith(MOD_DIR)) continue
    const resolved = await real($, dir)
    if (resolved?.endsWith(MOD_DIR) && resolved.length > MOD_DIR.length) return resolved.slice(0, -MOD_DIR.length)
  }
  return undefined
}

/**
 * Whether the repo's own bin/lint may run: the root is the owner's checkout,
 * or a linked worktree of it (`.git` a file whose `gitdir:` is under the
 * checkout's `.git/worktrees/`, and whose admin folder points back at this
 * `.git`, as git itself checks). A fork or a copy with the same layout is not.
 */
async function isTrusted($: $, root: string): Promise<boolean> {
  const repo = await ownerRepo($)
  const key = `${repo ?? ''}\u0000${root}`
  const known = trusted.get(key)
  if (known !== undefined) return known
  let is = false
  if (repo !== undefined) {
    const at = await real($, root)
    if (at === repo) {
      is = true
    } else if (at !== undefined) {
      const git = await stat($, `${at}/.git`)
      const text = git?.kind === 'file' && git.size <= 4096 ? await readText($, `${at}/.git`) : undefined
      const gitdir = /^gitdir: *(.+?)\s*$/m.exec(text ?? '')?.[1]
      if (gitdir !== undefined) {
        // Both links may be relative (worktree.useRelativePaths); real() settles `..`
        const admin = await real($, gitdir.startsWith('/') ? gitdir : `${at}/${gitdir}`)
        const worktrees = `${(await real($, `${repo}/.git`)) ?? `${repo}/.git`}/worktrees/`
        if (admin !== undefined && admin.startsWith(worktrees) && !admin.slice(worktrees.length).includes('/')) {
          const back = (await readText($, `${admin}/gitdir`))?.trim()
          if (back !== undefined && back !== '') {
            is = (await real($, back.startsWith('/') ? back : `${admin}/${back}`)) === `${at}/.git`
          }
        }
      }
    }
  }
  trusted.set(key, is)
  return is
}

/**
 * Runs one check; its output when it failed. Silent (undefined) when it
 * passed, timed out, could not start (the tool is not installed), failed
 * without a word, or exited with one of `quietCodes`.
 */
async function run($: $, argv: string[], cwd: string, quietCodes: number[] = []): Promise<string | undefined> {
  try {
    const r = await $.process.run(argv, { cwd, timeoutMs: TIMEOUT_MS })
    if (r.exitCode === 0 || quietCodes.includes(r.exitCode)) return undefined
    // No output means no finding to relay
    const out = `${r.stdout}\n${r.stderr}`.trim()
    return out === '' ? undefined : out
  } catch {
    return undefined
  }
}

/** The message for an edited file, or undefined when it is clean or out of scope. */
export async function review($: $, edited: string): Promise<string | undefined> {
  if (!edited.startsWith('/')) return undefined
  const st = await stat($, edited, true)
  if (st === undefined || st.kind !== 'file' || st.size > SIZE_CAP) return undefined
  // An edit through a symlink (a stowed ~/.zshrc, ~/bin/lint) is checked where it lands
  const file = st.realPath ?? edited
  const root = await findRoot($, file)
  if (root === undefined) return undefined
  const isDot = await isDotfiles($, root)
  // Only the owner's checkout and its worktrees run their own bin/lint; a copy with
  // the same layout gets the generic checks instead
  const isOwn = isDot && (await isTrusted($, root))
  const cfg = `${root}/.claude/conventions.json`
  const cfgStat = await stat($, cfg)
  const cfgText = cfgStat !== undefined && cfgStat.size <= CONFIG_CAP ? await readText($, cfg) : undefined
  const config = parseConfig(cfgText, isDot)
  if (!config.enabled || config.checks.length === 0) return undefined
  const text = await readText($, file)
  if (text === undefined || text.includes('\u0000')) return undefined

  const rel = file.slice(root.length + 1)
  const lang = language(rel, text)
  const has = (c: Check) => config.checks.includes(c)
  const problems: string[] = []

  let tabNote: string | undefined
  if (has('tabs') && !allowsTabs(rel)) {
    const lines = tabLines(text, { markdown: /\.(?:md|markdown)$/i.test(rel), shell: lang === 'bash' || lang === 'zsh' })
    if (lines.length > 0) tabNote = tabProblem(rel, lines, lang)
  }
  if (has('fixtures') && isFixture(rel)) {
    const hits = findTokens(text)
    if (hits.length > 0) problems.push(fixtureProblem(hits))
  }

  const tools: Promise<string | undefined>[] = []
  if (isOwn) {
    // bin/lint knows which files are bash, zsh or nvim Lua; it says nothing about the rest,
    // so it is only spawned for a path it covers and a check the repo has on
    if (lintChecks(rel).some(has)) {
      tools.push(
        run($, [`${root}/bin/lint`, '--file', file], root, [2]).then(
          o => o && toolProblem(`bin/lint --file ${rel}`, o),
        ),
      )
    }
  } else {
    if (lang === 'bash' && has('shfmt')) {
      tools.push(
        run($, ['shfmt', '-i', '4', '-ci', '-d', file], root).then(
          o => o && toolProblem('shfmt -i 4 -ci -d', `${o}\nfix: shfmt -i 4 -ci -w ${rel}`),
        ),
      )
    }
    if (lang === 'zsh' && has('zsh')) {
      tools.push(run($, ['zsh', '-n', file], root).then(o => o && toolProblem('zsh -n', o)))
    }
    if (lang === 'lua' && has('stylua')) {
      tools.push(
        run($, ['stylua', '--check', file], root).then(
          o => o && toolProblem('stylua --check', `${o}\nfix: stylua ${rel}`),
        ),
      )
    }
  }
  const found = (await Promise.all(tools)).filter((p): p is string => p !== undefined)
  // shfmt and stylua already report tab indentation, with the same fix: one note, not two.
  // Only when bin/lint ran one of them: a new bin/ script it does not list still gets the note.
  const tabsInTool = isOwn && lang !== 'zsh' && found.some(o => /fix: (?:shfmt|stylua) /.test(o))
  if (tabNote !== undefined && !tabsInTool) problems.unshift(tabNote)
  problems.push(...found)

  return problems.length > 0 ? compose(rel, problems) : undefined
}

const TOOLS = /^(?:Edit|Write|MultiEdit)$/

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'conventions',
      description: 'Turn the post-edit convention checks off or on for this session',
      argumentHint: '[on|off]',
    })
    return next(e)
  })

  on('command.run', { command: 'conventions' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: 'Usage: /conventions [on|off]' }
    const paused = await read($, isPaused)
    const next = arg === 'on' ? false : arg === 'off' ? true : !paused
    await update($, isPaused, () => next)
    return { text: next ? 'Convention checks off for this session.' : 'Convention checks on.' }
  })

  // The edit tools today are Edit and Write; MultiEdit is matched in case it returns.
  // Advisory: the edit has already run; a problem only adds a note the model
  // reads after the result. Never denies, and any failure returns the result as is.
  on('tool.call', { tool: TOOLS }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined || result.isError === true) return result
    try {
      const file = (e as { file_path?: unknown }).file_path
      if (typeof file !== 'string' || (await read($, isPaused))) return result
      const message = await review($, file)
      const last: Sent = await read($, sent)
      if (message === undefined) {
        if (file in last) {
          await update($, sent, s => Object.fromEntries(Object.entries(s ?? {}).filter(([k]) => k !== file)))
        }
        return result
      }
      if (last[file] === message) return result
      await update($, sent, s => {
        const { [file]: _old, ...rest } = s ?? {}
        // Newest last; the oldest go once the map is long
        return Object.fromEntries([...Object.entries(rest), [file, message]].slice(-SENT_CAP))
      })
      return { ...result, context: [...(result.context ?? []), message] }
    } catch {
      return result
    }
  }).catch(($, e, next) => next(e))
}
