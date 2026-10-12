import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { GIT_SAFE } from './register'
import { cleanDryRun } from './risk'

type Call = { argv: readonly string[]; cwd?: string; env?: Record<string, string> }
type Answer = 'Run it' | 'Cancel' | 'dismiss'

/**
 * Stands in for the engine beneath the plugin: records every process the
 * preview starts, answers the question, and records whether Bash ran.
 */
function engine(
  on: On,
  answer: Answer,
  proc: (
    argv: readonly string[],
  ) => { exitCode: number; stdout: string; stderr?: string; isStdoutTruncated?: boolean } | 'throw' = () => ({
    exitCode: 0,
    stdout: '',
  }),
) {
  const calls: Call[] = []
  const asked: string[] = []
  const state = { ran: false }
  on('env.get', () => ({ value: '/Users/me' }) as never)
  on('fs.stat', () => ({ value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }) as never)
  on('process.run', ($, e) => {
    calls.push({
      argv: e.argv,
      ...(e.init?.cwd !== undefined ? { cwd: e.init.cwd } : {}),
      ...(e.init?.env !== undefined ? { env: e.init.env } : {}),
    })
    const r = proc(e.argv)
    if (r === 'throw') return { deny: 'timed out' } as never
    return { value: { stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...r } } as never
  })
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0]?.question ?? ''
    asked.push(q)
    if (answer === 'dismiss') return { deny: 'dismissed' }
    return { result: { questions: (e as never as { questions: unknown }).questions, answers: { [q]: answer } } } as never
  })
  on('tool.call', { tool: 'Bash' }, () => {
    state.ran = true
    return { result: { stdout: 'ok', stderr: '', interrupted: false } } as never
  })
  return { calls, asked, state }
}

const bash = (command: string) => ({ tool: 'Bash', command }) as never

describe('asks before running', () => {
  test('runs the command once the person says so', async ($, on) => {
    const eng = engine(on, 'Run it')
    const r = await $.tool.call(bash('rm -rf build'))
    expect(eng.asked.length).toBe(1)
    expect(eng.asked[0]).toContain('rm -rf build')
    expect(eng.state.ran).toBe(true)
    expect(r.isError).not.toBe(true)
  })

  test('does not run it when cancelled', async ($, on) => {
    const eng = engine(on, 'Cancel')
    const r = await $.tool.call(bash('git push --force'))
    expect(eng.state.ran).toBe(false)
    expect(JSON.stringify(r)).toContain('you cancelled')
  })

  test('denies when nobody answers', async ($, on) => {
    const eng = engine(on, 'dismiss')
    const r = await $.tool.call(bash('git reset --hard'))
    expect(eng.state.ran).toBe(false)
    expect(JSON.stringify(r)).toContain('nobody answered')
  })

  test('a failed preview still asks, and still needs a yes', async ($, on) => {
    // Outside a repo every git call fails
    const eng = engine(on, 'Cancel', argv =>
      argv[0] === 'git' ? { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' } : { exitCode: 0, stdout: '' },
    )
    const r = await $.tool.call(bash('bestow stow --adopt zsh'))
    expect(eng.asked.length).toBe(1)
    expect(eng.asked[0]).toContain('Preview unavailable')
    expect(eng.state.ran).toBe(false)
    expect(JSON.stringify(r)).toContain('you cancelled')
  })

  test('a preview that times out still asks', async ($, on) => {
    const eng = engine(on, 'Run it', argv =>
      argv[0] === 'sh' || argv[0] === 'du' ? 'throw' : { exitCode: 0, stdout: 'Directory' },
    )
    await $.tool.call(bash('rm -rf ~/Library/Caches'))
    expect(eng.asked.length).toBe(1)
    expect(eng.asked[0]).toContain('directory: ? files, ?')
    expect(eng.state.ran).toBe(true)
  })

  test('an unresolvable cd is said, and still asked', async ($, on) => {
    const eng = engine(on, 'Cancel')
    await $.tool.call(bash('cd $WORK && rm -rf build'))
    expect(eng.asked[0]).toContain('Preview unavailable')
    expect(eng.calls.length).toBe(0)
    expect(eng.state.ran).toBe(false)
  })
})

describe('previews where the command runs', () => {
  test('a leading cd moves the preview', async ($, on) => {
    const eng = engine(on, 'Cancel', () => ({ exitCode: 0, stdout: 'Directory' }))
    await $.tool.call(bash('cd sub && rm -rf build'))
    const stat = eng.calls.find(c => c.argv[0] === 'stat')
    expect(stat?.cwd).toBe('sub')
    expect(stat?.argv).toEqual(['stat', '-f', '%HT', 'sub/build'])
  })

  test('git -C moves the git preview and ~ expands', async ($, on) => {
    const eng = engine(on, 'Cancel')
    await $.tool.call(bash('git -C ~/repo reset --hard'))
    const status = eng.calls.find(c => c.argv.includes('status'))
    expect(status?.cwd).toBe('/Users/me/repo')
  })

  test('--git-dir is passed on to the preview', async ($, on) => {
    const eng = engine(on, 'Cancel')
    await $.tool.call(bash('git --git-dir=/r/.git reset --hard'))
    const status = eng.calls.find(c => c.argv.includes('status'))
    expect(status?.argv).toEqual(['git', ...GIT_SAFE, '--git-dir=/r/.git', 'status', '--short'])
  })

  test('preview git runs without fsmonitor or optional locks', async ($, on) => {
    const eng = engine(on, 'Cancel')
    await $.tool.call(bash('git -C ~/repo reset --hard'))
    const status = eng.calls.find(c => c.argv.includes('status'))
    expect(status?.argv.slice(0, 5)).toEqual(['git', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false'])
    expect(status?.env).toEqual({ GIT_OPTIONAL_LOCKS: '0' })
  })

  test('git clean previews with the same -x', async ($, on) => {
    const eng = engine(on, 'Cancel', argv =>
      argv.includes('clean') ? { exitCode: 0, stdout: 'Would remove .env' } : { exitCode: 0, stdout: '' },
    )
    await $.tool.call(bash('git clean -fdx 2>/dev/null'))
    const clean = eng.calls.find(c => c.argv.includes('clean'))
    expect(clean?.argv).toEqual(['git', ...GIT_SAFE, 'clean', '-n', '-dx'])
    expect(eng.asked[0]).toContain('Would remove .env')
  })

  test('find -delete previews without -delete or its redirections', async ($, on) => {
    const eng = engine(on, 'Cancel', () => ({ exitCode: 0, stdout: './a.log\n./b.log\n' }))
    await $.tool.call(bash('find . -name "*.log" -delete 2>/dev/null'))
    expect(eng.calls[0]?.argv).toEqual(['find', '.', '-name', '*.log'])
    expect(eng.asked[0]).toContain('Would delete 2 entries')
  })

  test('find -exec rm previews without the -exec', async ($, on) => {
    const eng = engine(on, 'Cancel', () => ({ exitCode: 0, stdout: './a.o\n' }))
    await $.tool.call(bash("find . -name '*.o' -exec rm {} +"))
    expect(eng.calls[0]?.argv).toEqual(['find', '.', '-name', '*.o'])
    expect(eng.asked[0]).toContain('Would delete 1 entries')
  })

  test('a find preview that fails says unavailable, not "nothing matches"', async ($, on) => {
    const eng = engine(on, 'Cancel', () => ({ exitCode: 1, stdout: '', stderr: 'find: bad expression' }))
    await $.tool.call(bash('find . -nme x -delete'))
    expect(eng.asked[0]).toContain('Preview unavailable: find exited 1')
    expect(eng.asked[0]).not.toContain('Nothing matches')
  })

  test('a find -delete preview cut at the output cap says the count is a floor', async ($, on) => {
    const eng = engine(on, 'Cancel', () => ({
      exitCode: 0,
      stdout: './a.log\n./b.log\n./c.l',
      isStdoutTruncated: true,
    }))
    await $.tool.call(bash('find . -name "*.log" -delete'))
    expect(eng.asked[0]).toContain('Would delete 2+ entries')
    expect(eng.asked[0]).not.toContain('./c.l')
  })

  test('an untruncated find -delete preview keeps its exact count', async ($, on) => {
    const eng = engine(on, 'Cancel', () => ({ exitCode: 0, stdout: './a.log\n./b.log\n' }))
    await $.tool.call(bash('find . -name "*.log" -delete'))
    expect(eng.asked[0]).toContain('Would delete 2 entries')
  })

  test('rm counts with find | wc, the path as an argument and never in the script', async ($, on) => {
    const odd = '/tmp/my dir/a;b & c'
    const eng = engine(on, 'Cancel', argv =>
      argv[0] === 'sh' ? { exitCode: 0, stdout: '   123456\n' } : argv[0] === 'du' ? { exitCode: 0, stdout: '2048\t/x' } : { exitCode: 0, stdout: 'Directory' },
    )
    await $.tool.call(bash(`rm -rf '${odd}'`))
    const count = eng.calls.find(c => c.argv[0] === 'sh')
    expect(count?.argv.slice(0, 2)).toEqual(['sh', '-c'])
    expect(count?.argv[2]).toBe('find -- "$1" -type f | wc -l')
    expect(count?.argv[4]).toBe(odd)
    expect(eng.asked[0]).toContain('directory: 123456 files, 2.0')
  })

  test('a non-numeric wc output counts as ?', async ($, on) => {
    const eng = engine(on, 'Cancel', argv =>
      argv[0] === 'sh' ? { exitCode: 0, stdout: 'find: oops\n' } : argv[0] === 'du' ? { exitCode: 0, stdout: '2048\t/x' } : { exitCode: 0, stdout: 'Directory' },
    )
    await $.tool.call(bash('rm -rf /tmp/a'))
    expect(eng.asked[0]).toContain('directory: ? files')
  })

  test('rm previews every target, in order, and counts a big tree in full', async ($, on) => {
    const eng = engine(on, 'Cancel', argv =>
      argv[0] === 'sh' ? { exitCode: 0, stdout: `${argv[4]?.endsWith('b') ? 100000 : 7}\n` } : { exitCode: 0, stdout: 'Directory' },
    )
    await $.tool.call(bash('rm -rf /tmp/a /tmp/b'))
    const q = eng.asked[0] ?? ''
    expect(q.indexOf('/tmp/a/')).toBeLessThan(q.indexOf('/tmp/b/'))
    expect(q).toContain('directory: 7 files')
    expect(q).toContain('directory: 100000 files')
  })

  test('an ssh payload is not previewed locally', async ($, on) => {
    const eng = engine(on, 'Cancel')
    await $.tool.call(bash("ssh host 'rm -rf /srv/app'"))
    expect(eng.calls.length).toBe(0)
    expect(eng.asked[0]).toContain('Runs on host')
  })

  test('find -delete with -exec is never run for a preview', async ($, on) => {
    const eng = engine(on, 'Cancel')
    await $.tool.call(bash('find . -exec touch {} \\; -delete'))
    expect(eng.asked.length).toBe(1)
    expect(eng.calls.length).toBe(0)
  })
})

describe('Monitor', () => {
  test('a risky Monitor command asks too', async ($, on) => {
    const eng = engine(on, 'Cancel')
    let ran = false
    on('tool.call', { tool: 'Monitor' }, () => {
      ran = true
      return { result: {} } as never
    })
    const r = await $.tool.call({ tool: 'Monitor', description: 'x', timeout_ms: 1000, command: 'git push -f' } as never)
    expect(eng.asked.length).toBe(1)
    expect(ran).toBe(false)
    expect(JSON.stringify(r)).toContain('you cancelled')
  })

  test('a websocket Monitor passes through', async ($, on) => {
    const eng = engine(on, 'Cancel')
    let ran = false
    on('tool.call', { tool: 'Monitor' }, () => {
      ran = true
      return { result: {} } as never
    })
    await $.tool.call({ tool: 'Monitor', description: 'x', timeout_ms: 1000, ws: { url: 'ws://x' } } as never)
    expect(eng.asked.length).toBe(0)
    expect(ran).toBe(true)
  })
})

test('cleanDryRun keeps what changes the result', () => {
  expect(cleanDryRun(['-fd'])).toEqual(['clean', '-n', '-d'])
  expect(cleanDryRun(['-f'])).toEqual(['clean', '-n'])
  expect(cleanDryRun(['-ffdX', '-e', '*.keep', 'build/'])).toEqual(['clean', '-n', '-ffdX', '-e', '*.keep', '--', 'build/'])
  expect(cleanDryRun(['--force', '-x', '--', 'a'])).toEqual(['clean', '-n', '-x', '--', 'a'])
})
