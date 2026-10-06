import type { Register } from 'claude-code'

import { LABELS, classify, clip, human, isGlob, rmTargets } from './risk'
import type { Risk } from './risk'

const RUN = 'Run it'
const CANCEL = 'Cancel'
const T = { timeoutMs: 8000 }

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

async function git($: Sh, args: string[]): Promise<string> {
  const r = await $.process.run(['git', ...args], T)
  if (r.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${r.stderr.trim().slice(0, 200)}`)
  }
  return r.stdout.trimEnd()
}

async function previewRm($: Sh, risk: Risk): Promise<string[]> {
  const targets = rmTargets(risk.args)
  if (targets.length === 0) {
    return [`Could not parse targets from: ${risk.segment.slice(0, 200)}`]
  }
  const home = await $.env.get('HOME')
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
    const path = raw === '~' ? (home ?? raw) : raw.startsWith('~/') && home ? home + raw.slice(1) : raw
    const kind = await $.process
      .run(['stat', '-f', '%HT', path], T)
      .then(r => (r.exitCode === 0 ? r.stdout.trim() : null))
    if (kind === null) {
      lines.push(`- ${raw}  (does not exist)`)
      continue
    }
    const stat = await $.fs.stat(path)
    if (stat.kind === 'dir') {
      const files = await $.process.run(['find', path, '-type', 'f'], T)
      const count = files.stdout.split('\n').filter(Boolean).length
      const du = await $.process.run(['du', '-sk', path], T)
      const kb = Number.parseInt(du.stdout.split('\t')[0] ?? '', 10)
      lines.push(`- ${raw}/  directory: ${count} files, ${Number.isNaN(kb) ? '?' : human(kb * 1024)}`)
      if (path === '/' || path === home) {
        lines.push('  !! this is the filesystem root or your home directory')
      }
    } else {
      lines.push(`- ${raw}  ${kind}, ${human(stat.size)}`)
    }
  }
  if (targets.length > 8) {
    lines.push(`... and ${targets.length - 8} more targets`)
  }
  return lines
}

async function previewChmod($: Sh, risk: Risk): Promise<string[]> {
  const lines: string[] = []
  for (const t of rmTargets(risk.args).slice(1, 6)) {
    if (isGlob(t) || /[$`]/.test(t)) {
      lines.push(`? ${t}  (cannot resolve)`)
      continue
    }
    const files = await $.process.run(['find', t], T)
    lines.push(`- ${t}  ${files.stdout.split('\n').filter(Boolean).length} entries affected`)
  }
  return lines.length ? lines : ['Could not parse targets']
}

async function previewFor($: Sh, risk: Risk): Promise<string[]> {
  switch (risk.kind) {
    case 'rm':
      return previewRm($, risk)
    case 'git-reset-hard': {
      const status = await git($, ['status', '--short'])
      const out = [
        'Uncommitted changes that would be discarded:',
        ...(status ? clip(status.split('\n')) : ['(working tree is clean)']),
      ]
      const ahead = await git($, ['log', '--oneline', '@{u}..']).catch(() => '')
      if (ahead) {
        out.push('Local commits not on upstream (reset may orphan them):', ...clip(ahead.split('\n'), 6))
      }
      return out
    }
    case 'git-push-force': {
      const branch = await git($, ['rev-parse', '--abbrev-ref', 'HEAD'])
      const ahead = await git($, ['log', '--oneline', '@{u}..']).catch(() => '')
      const behind = await git($, ['log', '--oneline', '..@{u}']).catch(() => '')
      const out = [`Branch: ${branch}`]
      out.push(ahead ? 'Commits to be pushed:' : 'No unpushed commits found (or no upstream)')
      if (ahead) out.push(...clip(ahead.split('\n'), 6))
      if (behind) {
        out.push('Remote-only commits that would be OVERWRITTEN:', ...clip(behind.split('\n'), 6))
      }
      return out
    }
    case 'git-clean': {
      const dry = await git($, ['clean', '-nd'])
      return dry ? ['Would remove:', ...clip(dry.split('\n'))] : ['Nothing to remove right now']
    }
    case 'adopt': {
      const status = await git($, ['status', '--short'])
      return [
        'Live files get pulled INTO the repo, overwriting curated configs.',
        'Run `git diff` right after. Current changes:',
        ...(status ? clip(status.split('\n'), 8) : ['(working tree is clean)']),
      ]
    }
    case 'chmod-r':
      return previewChmod($, risk)
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
    case 'sql':
      return [
        'Destructive SQL or migration detected. It cannot be previewed here.',
        `Command: ${risk.segment.slice(0, 300)}`,
      ]
  }
}

async function buildPreview($: Sh, risks: Risk[]): Promise<string> {
  const parts: string[] = []
  for (const r of risks) {
    parts.push(`[${LABELS[r.kind]}]`, ...(await previewFor($, r)))
  }
  return parts.join('\n')
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const risks = classify(e.command)
    if (risks.length === 0) {
      return next(e)
    }

    // Anything below that fails, or is not answered by a person, denies the call.
    let preview: string
    try {
      preview = await buildPreview($, risks)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      return { deny: `blast-radius: could not preview "${e.command.slice(0, 120)}" (${why}). Not run.` }
    }

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
