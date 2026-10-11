import type { EngineInterface, On } from 'claude-code'

import type { RabeWorktree } from '../../types'
import { isAbsolute } from '../model'

const POLL_MS = 10_000
const TIMEOUT_MS = 5000
const MAX = 100

// `git worktree list --porcelain`: one block per worktree, the main one
// first. A path git had to quote, a relative one and a bare entry are left
// out: Rabe never guesses where a file lives. Git for Windows prints drive
// (`C:/repo`) and UNC (`//host/share`) paths.
export function parseWorktrees(text: string): RabeWorktree[] {
  const out: RabeWorktree[] = []
  for (const [i, block] of text.split(/\n\s*\n/).entries()) {
    const lines = block.split('\n').map(line => line.trimEnd())
    const path = lines.find(line => line.startsWith('worktree '))?.slice('worktree '.length)
    if (!path || !isAbsolute(path) || lines.includes('bare')) continue
    const branch = lines.find(line => line.startsWith('branch '))?.slice('branch '.length)
    out.push({
      path: /^([A-Za-z]:)?\/$/.test(path) ? path : path.replace(/\/+$/, ''),
      ...(branch && { branch: branch.replace(/^refs\/heads\//, '') }),
      ...(lines.includes('detached') && { isDetached: true }),
      ...(i === 0 && { isMain: true }),
    })
  }

  return out.slice(0, MAX)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// A failed, cut or empty answer keeps what Rabe knew; only a change is written.
async function poll($: EngineInterface): Promise<void> {
  const run = await $.process.run(['git', 'worktree', 'list', '--porcelain'], {
    timeoutMs: TIMEOUT_MS,
  })
  if (run.exitCode !== 0 || run.isStdoutTruncated) return
  const list = parseWorktrees(run.stdout)
  if (list.length === 0) return
  const { value, version } = await $.state.get({ plugin: 'rabe', key: 'worktrees' })
  if (same(value, list)) return
  await $.state.set({ plugin: 'rabe', key: 'worktrees' }, list, { ifVersion: version })
}

// The repository's worktrees, so the Effects tab can place each changed file
// in the worktree that holds it. Without git nothing is written.
export function worktrees(on: On): void {
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    const started = await next(e)
    let isPolling = false
    const tick = () => {
      if (isPolling) return
      isPolling = true
      poll($)
        .catch(() => undefined)
        .finally(() => {
          isPolling = false
        })
    }
    tick()
    $.clock.every(POLL_MS, tick)

    return started
  })
}
