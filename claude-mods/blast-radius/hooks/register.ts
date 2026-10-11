import type { Register } from 'claude-code'

import { LABELS, classify, cleanDryRun, clip, human, isGlob, rmTargets } from './risk'
import type { Risk } from './risk'

const RUN = 'Run it'
const CANCEL = 'Cancel'
const TIMEOUT_MS = 8000

// The part of `$` the previews use. `$` must stay named `$` and stay in this file.
type Sh = {
  process: {
    run: (
      argv: readonly string[],
      init?: { cwd?: string; timeoutMs?: number },
    ) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  }
  fs: { stat: (path: string) => Promise<{ kind: string; size: number }> }
  env: { get: (name: string) => Promise<string | undefined> }
}

/** Where a preview runs: the risk's directory with `~` expanded, or the session's. */
type Where = { cwd?: string; home?: string }

const why = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200)

const expandHome = (p: string, home: string | undefined) =>
  p === '~' ? (home ?? p) : p.startsWith('~/') && home ? home + p.slice(1) : p

async function where($: Sh, risk: Risk): Promise<Where> {
  const home = await $.env.get('HOME')
  if (risk.cwd === undefined) return { home }
  if (risk.cwd === '?') throw new Error('the command changes to a directory that cannot be resolved here')
  return { cwd: expandHome(risk.cwd, home), home }
}

const run = ($: Sh, w: Where, argv: string[]) =>
  $.process.run(argv, { ...(w.cwd !== undefined ? { cwd: w.cwd } : {}), timeoutMs: TIMEOUT_MS })

async function git($: Sh, w: Where, risk: Risk, args: string[]): Promise<string> {
  const r = await run($, w, ['git', ...(risk.gitArgs ?? []), ...args])
  if (r.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${r.stderr.trim().slice(0, 200)}`)
  }
  return r.stdout.trimEnd()
}

/** A target path as the command will see it: `~` expanded, relative ones under the command's directory. */
const resolve = (raw: string, w: Where) => {
  const p = expandHome(raw, w.home)
  return p.startsWith('/') || w.cwd === undefined ? p : `${w.cwd.replace(/\/+$/, '')}/${p}`
}

async function previewRm($: Sh, w: Where, risk: Risk): Promise<string[]> {
  const targets = rmTargets(risk.args)
  if (targets.length === 0) {
    return [`Could not parse targets from: ${risk.segment.slice(0, 200)}`]
  }
  const lines: string[] = []
  for (const raw of targets.slice(0, 8)) {
    if (/[$`]/.test(raw)) {
      lines.push(`? ${raw}  (contains a variable or substitution, cannot resolve)`)
      continue
    }
    if (isGlob(raw)) {
      lines.push(`? ${raw}  (glob, the shell expands it at run time)`)
      continue
    }
    const path = resolve(raw, w)
    try {
      const kind = await run($, w, ['stat', '-f', '%HT', path]).then(r => (r.exitCode === 0 ? r.stdout.trim() : null))
      if (kind === null) {
        lines.push(`- ${raw}  (does not exist)`)
        continue
      }
      const stat = await $.fs.stat(path)
      if (stat.kind === 'dir') {
        const danger = path === '/' || path === w.home || `${path}/` === w.home
        // Counting can time out on a big tree; the size is then unknown, not a reason to skip the question
        const count = await run($, w, ['find', path, '-type', 'f'])
          .then(r => String(r.stdout.split('\n').filter(Boolean).length))
          .catch(() => '?')
        const kb = await run($, w, ['du', '-sk', path])
          .then(r => Number.parseInt(r.stdout.split('\t')[0] ?? '', 10))
          .catch(() => Number.NaN)
        lines.push(`- ${raw}/  directory: ${count} files, ${Number.isNaN(kb) ? '?' : human(kb * 1024)}`)
        if (danger) lines.push('  !! this is the filesystem root or your home directory')
      } else {
        lines.push(`- ${raw}  ${kind}, ${human(stat.size)}`)
      }
    } catch (err) {
      lines.push(`? ${raw}  (preview unavailable: ${why(err)})`)
    }
  }
  if (targets.length > 8) {
    lines.push(`... and ${targets.length - 8} more targets`)
  }
  return lines
}

async function previewChmod($: Sh, w: Where, risk: Risk): Promise<string[]> {
  const lines: string[] = []
  for (const t of rmTargets(risk.args).slice(1, 6)) {
    if (isGlob(t) || /[$`]/.test(t)) {
      lines.push(`? ${t}  (cannot resolve)`)
      continue
    }
    const n = await run($, w, ['find', resolve(t, w)])
      .then(r => String(r.stdout.split('\n').filter(Boolean).length))
      .catch(() => '?')
    lines.push(`- ${t}  ${n} entries affected`)
  }
  return lines.length ? lines : ['Could not parse targets']
}

async function previewFor($: Sh, risk: Risk): Promise<string[]> {
  const w = await where($, risk)
  switch (risk.kind) {
    case 'rm':
      return previewRm($, w, risk)
    case 'git-reset-hard': {
      const status = await git($, w, risk, ['status', '--short'])
      const out = [
        'Uncommitted changes that would be discarded:',
        ...(status ? clip(status.split('\n')) : ['(working tree is clean)']),
      ]
      const ahead = await git($, w, risk, ['log', '--oneline', '@{u}..']).catch(() => '')
      if (ahead) {
        out.push('Local commits not on upstream (reset may orphan them):', ...clip(ahead.split('\n'), 6))
      }
      return out
    }
    case 'git-push-force': {
      const branch = await git($, w, risk, ['rev-parse', '--abbrev-ref', 'HEAD'])
      const ahead = await git($, w, risk, ['log', '--oneline', '@{u}..']).catch(() => '')
      const behind = await git($, w, risk, ['log', '--oneline', '..@{u}']).catch(() => '')
      const out = [`Branch: ${branch}`]
      out.push(ahead ? 'Commits to be pushed:' : 'No unpushed commits found (or no upstream)')
      if (ahead) out.push(...clip(ahead.split('\n'), 6))
      if (behind) {
        out.push('Remote-only commits that would be OVERWRITTEN:', ...clip(behind.split('\n'), 6))
      }
      return out
    }
    case 'git-push-delete': {
      const pos = risk.args.filter(a => !a.startsWith('-'))
      const isDelete = risk.args.includes('--delete') || risk.args.some(a => /^-[A-Za-z]*d[A-Za-z]*$/.test(a))
      const refs = isDelete ? pos.slice(1) : pos.filter(a => a.startsWith(':')).map(a => a.slice(1))
      const out: string[] = []
      if (refs.length) out.push(`Remote refs that would be deleted on ${pos[0] ?? 'the remote'}:`, ...clip(refs, 8))
      if (risk.args.includes('--mirror')) out.push('--mirror deletes every remote ref that does not exist locally.')
      if (risk.args.includes('--prune')) out.push('--prune deletes remote refs that have no local counterpart.')
      out.push('Deleted remote branches and tags cannot be restored from here.')
      return out
    }
    case 'git-clean': {
      const dry = await git($, w, risk, cleanDryRun(risk.args))
      return dry ? ['Would remove:', ...clip(dry.split('\n'))] : ['Nothing to remove right now']
    }
    case 'adopt': {
      const status = await git($, w, risk, ['status', '--short'])
      return [
        'Live files get pulled INTO the repo, overwriting curated configs.',
        'Run `git diff` right after. Current changes:',
        ...(status ? clip(status.split('\n'), 8) : ['(working tree is clean)']),
      ]
    }
    case 'chmod-r':
      return previewChmod($, w, risk)
    case 'dd': {
      const of = risk.args.find(a => a.startsWith('of='))
      const inp = risk.args.find(a => a.startsWith('if='))
      return [`Raw write: ${inp ?? 'if=?'} -> ${of ?? 'of=?'}`, 'Cannot be previewed or undone.']
    }
    case 'mkfs':
      return [
        `Formats: ${risk.args.filter(a => !a.startsWith('-')).join(' ') || '(device unknown)'}`,
        'All data on it is lost.',
      ]
    case 'find-delete': {
      // Never run a find that would act on its own (-exec, -ok, -fprint...); -delete itself is dropped
      if (risk.args.some(a => /^-(exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/.test(a))) {
        return ['find with -exec/-ok and -delete: not previewed, it would run them.']
      }
      const argv = ['find', ...risk.args.filter(a => a !== '-delete')]
      const r = await run($, w, argv)
      const hits = r.stdout.split('\n').filter(Boolean)
      return hits.length ? [`Would delete ${hits.length} entries:`, ...clip(hits)] : ['Nothing matches right now']
    }
    case 'rsync-delete': {
      const pos = risk.args.filter(a => !a.startsWith('-'))
      return [
        `Destination: ${pos[pos.length - 1] ?? '?'}`,
        'Files there that are not in the source are removed. Add --dry-run first to see the list.',
      ]
    }
    case 'sql':
      return [
        'Destructive SQL or migration detected. It cannot be previewed here.',
        `Command: ${risk.segment.slice(0, 300)}`,
      ]
  }
}

/** Every risk's preview; one that fails says so and the rest still show. */
async function buildPreview($: Sh, risks: Risk[]): Promise<string> {
  const parts: string[] = []
  for (const r of risks) {
    const at = r.cwd !== undefined ? `  (in ${r.cwd === '?' ? 'an unresolved directory' : r.cwd})` : ''
    let lines: string[]
    try {
      lines = await previewFor($, r)
    } catch (err) {
      lines = [`Preview unavailable: ${why(err)}`]
    }
    parts.push(`[${LABELS[r.kind]}]${at}`, ...lines)
  }
  return parts.join('\n')
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const risks = classify(e.command)
    if (risks.length === 0) {
      return next(e)
    }

    // A preview that fails still asks. Anything else that fails, or a question
    // nobody answers, denies the call.
    const preview = await buildPreview($, risks)

    let answer: string
    try {
      const question = `Risky command: ${e.command.slice(0, 300)}\n\n${preview.slice(0, 1500)}\n\nRun it?`
      answer = await $.ui.ask(question, { options: [RUN, CANCEL], header: 'Blast radius' })
    } catch {
      return {
        deny: `blast-radius: "${e.command.slice(0, 120)}" needs your confirmation and nobody answered. Not run.\n${preview.slice(0, 800)}`,
      }
    }

    if (answer !== RUN) {
      return { deny: `blast-radius: you cancelled "${e.command.slice(0, 120)}".` }
    }
    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'blast-radius: its guard failed, so the command was not run.' },
  )
}
