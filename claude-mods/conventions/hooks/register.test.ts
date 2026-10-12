import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Ran = { argv: readonly string[]; cwd?: string; timeoutMs?: number }
type Proc = (argv: readonly string[]) => { exitCode: number; stdout?: string; stderr?: string } | 'timeout' | 'missing'

const DOT = '/r/dot'
const OTHER = '/r/other'

// The dotfiles repo is recognised by bin/lint plus this mod's manifest; the other
// repo is any git repo; /r/none has no .git anywhere above it.
const REPOS: Record<string, string> = {
  [`${DOT}/bin/lint`]: '#!/bin/bash\n',
  [`${DOT}/claude-mods/conventions/.claude-plugin/plugin.json`]: '{"name":"conventions"}\n',
}
const DIRS = [`${DOT}/.git`, `${OTHER}/.git`]

// Fixtures are assembled at runtime so no token-shaped literal sits in the source.
const part = (...p: string[]) => p.join('')
const ghToken = part('gh', 'p_') + 'a1B2'.repeat(9)

/**
 * Stands in for the engine beneath the plugin: an in-memory file system, a
 * process runner that records each call, and Edit/Write tools that succeed.
 */
function engine(
  on: On,
  files: Record<string, string>,
  proc: Proc = () => ({ exitCode: 0 }),
  opts: { links?: Record<string, string>; toolResult?: Record<string, unknown> } = {},
) {
  const lookup = (path: string) => files[path] ?? REPOS[path]
  const ran: Ran[] = []
  on('fs.stat', (_$, e) => {
    const text = lookup(e.path)
    const real = opts.links?.[e.path]
    const target = real ?? e.path
    const t = real !== undefined ? lookup(real) : text
    if (t !== undefined) {
      return { value: { kind: 'file', size: t.length, mtimeMs: 0, isLink: real !== undefined, ...(e.resolve ? { realPath: target } : {}) } } as never
    }
    if (DIRS.includes(e.path)) return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } } as never
    return { deny: 'ENOENT: no such file' } as never
  })
  on('fs.read', (_$, e) => {
    const text = lookup(opts.links?.[e.path] ?? e.path)
    return (text !== undefined ? { value: text } : { deny: 'ENOENT: no such file' }) as never
  })
  on('process.run', (_$, e) => {
    ran.push({
      argv: e.argv,
      ...(e.init?.cwd !== undefined ? { cwd: e.init.cwd } : {}),
      ...(e.init?.timeoutMs !== undefined ? { timeoutMs: e.init.timeoutMs } : {}),
    })
    const r = proc(e.argv)
    if (r === 'timeout') return { deny: 'timed out after 3000 ms' } as never
    if (r === 'missing') return { deny: 'spawn ENOENT' } as never
    return { value: { stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...r } } as never
  })
  on('tool.call', { tool: ['Edit', 'Write', 'Read'] }, () => ({ result: 'ok', ref: 1, text: 'ok', ...opts.toolResult }) as never)
  return { ran }
}

const edit = (file_path: string) => ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as never
const write = (file_path: string) => ({ tool: 'Write', file_path, content: '' }) as never
const notes = (r: { context?: readonly string[] }) => (r.context ?? []).join('\n')

describe('in the dotfiles repo (on by default)', () => {
  test('says nothing about a clean file, after asking bin/lint about it', async ($, on) => {
    const file = `${DOT}/bin/clean-script`
    const eng = engine(on, { [file]: '#!/bin/bash\nif true; then\n    echo ok\nfi\n' })
    const r = await $.tool.call(edit(file))
    expect(r.context).toBeUndefined()
    expect(eng.ran).toEqual([{ argv: [`${DOT}/bin/lint`, '--file', file], cwd: DOT, timeoutMs: 3000 }])
  })

  test('flags tab indentation with the line and the fix', async ($, on) => {
    const file = `${DOT}/init.sh`
    engine(on, { [file]: '#!/bin/bash\nif true; then\n\techo hi\nfi\n' })
    const r = await $.tool.call(edit(file))
    expect(notes(r)).toContain('conventions (advisory, the edit was applied): init.sh')
    expect(notes(r)).toContain('tab indentation on line 3')
    expect(notes(r)).toContain('Fix: shfmt -i 4 -ci -w init.sh')
  })

  test('leaves a tab inside a line alone, and files whose format needs tabs', async ($, on) => {
    const data = `${DOT}/tmux/switcher`
    const make = `${DOT}/Makefile`
    engine(on, { [data]: 'printf "%s\\t%s\\n" a b\nx="a\tb"\n', [make]: 'all:\n\techo hi\n' })
    expect((await $.tool.call(edit(data))).context).toBeUndefined()
    expect((await $.tool.call(edit(make))).context).toBeUndefined()
  })

  test("relays bin/lint's findings, cut short but keeping the fix lines", async ($, on) => {
    const file = `${DOT}/zsh/.zshrc.d/09-x.zsh`
    const noise = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')
    engine(on, { [file]: 'if true; then\n' }, () => ({
      exitCode: 1,
      stdout: `${noise}\nfix: fix the zsh syntax error in zsh/.zshrc.d/09-x.zsh`,
    }))
    const text = notes(await $.tool.call(edit(file)))
    expect(text).toContain('- bin/lint --file zsh/.zshrc.d/09-x.zsh:')
    expect(text).toContain('line 11')
    expect(text).not.toContain('line 12')
    expect(text).toContain('(18 more lines)')
    expect(text).toContain('fix: fix the zsh syntax error in zsh/.zshrc.d/09-x.zsh')
  })

  test('flags a token-shaped literal in a test file, not one built at runtime', async ($, on) => {
    const bad = `${DOT}/claude-mods/x/hooks/x.test.ts`
    const good = `${DOT}/claude-mods/x/hooks/y.test.ts`
    const fixture = `${DOT}/tests/claude/fixture.json`
    engine(on, {
      [bad]: `const t = '${ghToken}'\n`,
      [good]: "const t = ['gh', 'p_'].join('') + 'a1B2'.repeat(9)\n",
      [fixture]: `{\n  "token": "${ghToken}"\n}\n`,
    })
    const text = notes(await $.tool.call(edit(bad)))
    expect(text).toContain('token-shaped literal (github-token) on line 1 of a test file')
    expect(text).toContain('build it at runtime')
    expect((await $.tool.call(edit(good))).context).toBeUndefined()
    expect(notes(await $.tool.call(write(fixture)))).toContain('on line 2 of a test file')
  })

  test('leaves token-shaped text outside tests to the redact mod', async ($, on) => {
    const file = `${DOT}/docs/notes.md`
    engine(on, { [file]: `example ${ghToken}\n` })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
  })

  test('a linked worktree of the repo counts (its .git is a file)', async ($, on) => {
    const wt = '/r/dot-wt'
    const file = `${wt}/init.sh`
    const eng = engine(on, {
      [`${wt}/.git`]: 'gitdir: /r/dot/.git/worktrees/x\n',
      [`${wt}/bin/lint`]: '#!/bin/bash\n',
      [`${wt}/claude-mods/conventions/.claude-plugin/plugin.json`]: '{"name":"conventions"}\n',
      [file]: '\techo hi\n',
    })
    expect(notes(await $.tool.call(edit(file)))).toContain('conventions (advisory, the edit was applied): init.sh')
    expect(eng.ran[0]?.argv).toEqual([`${wt}/bin/lint`, '--file', file])
  })

  test('can be switched off by the repo', async ($, on) => {
    const file = `${DOT}/init.sh`
    const eng = engine(on, { [file]: '\techo hi\n', [`${DOT}/.claude/conventions.json`]: '{"enabled":false}' })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('skips files over the size cap', async ($, on) => {
    const file = `${DOT}/big.sh`
    const eng = engine(on, { [file]: '\t'.repeat(300 * 1024) })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })
})

describe('never in the way', () => {
  test('a check that times out says nothing', async ($, on) => {
    const file = `${DOT}/zsh/.zshrc`
    engine(on, { [file]: 'echo ok\n' }, () => 'timeout')
    const r = await $.tool.call(edit(file))
    expect(r.context).toBeUndefined()
    expect(r.text).toBe('ok')
  })

  test('a missing tool says nothing', async ($, on) => {
    const file = `${OTHER}/run.sh`
    engine(on, { [file]: '#!/bin/bash\necho ok\n', [`${OTHER}/.claude/conventions.json`]: '{"enabled":true}' }, () => 'missing')
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
  })

  test('the edit result goes through untouched when the file cannot be read', async ($, on) => {
    engine(on, {})
    const r = await $.tool.call(edit(`${DOT}/gone.sh`))
    expect(r.text).toBe('ok')
    expect(r.context).toBeUndefined()
    expect(r.deny).toBeUndefined()
  })

  test('only Edit, Write and MultiEdit are checked', async ($, on) => {
    const file = `${DOT}/init.sh`
    const eng = engine(on, { [file]: '\techo hi\n' })
    const r = await $.tool.call({ tool: 'Read', file_path: file } as never)
    expect(r.context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('the same message is not repeated for a file until it changes or clears', async ($, on) => {
    const file = `${DOT}/init.sh`
    engine(on, { [file]: '\techo hi\n' })
    expect(notes(await $.tool.call(edit(file)))).toContain('tab indentation on line 1')
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
  })

  test('the message comes back after the file was clean in between', async ($, on) => {
    const file = `${DOT}/a.sh`
    const files: Record<string, string> = { [file]: '\techo hi\n' }
    engine(on, files)
    expect(notes(await $.tool.call(edit(file)))).toContain('tab indentation')
    files[file] = 'echo hi\n'
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    files[file] = '\techo hi\n'
    expect(notes(await $.tool.call(edit(file)))).toContain('tab indentation')
  })

  test('/conventions turns the checks off and on for the session', async ($, on) => {
    const file = `${DOT}/init.sh`
    const eng = engine(on, { [file]: '\techo hi\n' })
    const off = await $.command.run({ command: 'conventions', args: 'off' } as never)
    expect(JSON.stringify(off)).toContain('off for this session')
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
    await $.command.run({ command: 'conventions', args: 'on' } as never)
    expect(notes(await $.tool.call(edit(file)))).toContain('tab indentation')
  })
})

describe('more edges', () => {
  test('a failed edit is passed through without a note', async ($, on) => {
    const file = `${DOT}/init.sh`
    const eng = engine(on, { [file]: '\techo hi\n' }, undefined, { toolResult: { isError: true } })
    const r = await $.tool.call(edit(file))
    expect(r.context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('context already on the result is kept, the note comes after it', async ($, on) => {
    const file = `${DOT}/init.sh`
    engine(on, { [file]: '\techo hi\n' }, undefined, { toolResult: { context: ['x'] } })
    const r = await $.tool.call(edit(file))
    expect(r.context?.[0]).toBe('x')
    expect(r.context?.length).toBe(2)
    expect(r.context?.[1]).toContain('tab indentation')
  })

  test('a relative path and a binary file are skipped', async ($, on) => {
    const bin = `${DOT}/bin/blob`
    const eng = engine(on, { [bin]: '\u0000\tabc\n', [`${DOT}/rel.sh`]: '\techo\n' })
    expect((await $.tool.call(edit('rel.sh'))).context).toBeUndefined()
    expect((await $.tool.call(edit(bin))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('an edit through a symlink is checked where it lands', async ($, on) => {
    const link = '/home/u/bin/lint-me'
    const file = `${DOT}/bin/lint-me`
    const eng = engine(on, { [file]: '#!/bin/bash\necho ok\n' }, undefined, { links: { [link]: file } })
    await $.tool.call(edit(link))
    expect(eng.ran[0]?.argv).toEqual([`${DOT}/bin/lint`, '--file', file])
  })

  test('bin/lint is not spawned for files it does not cover', async ($, on) => {
    const md = `${DOT}/docs/a.md`
    const ts = `${DOT}/claude-mods/x/hooks/a.ts`
    const lua = `${DOT}/nvim/.config/nvim/lua/a.lua`
    const eng = engine(on, { [md]: 'hi\n', [ts]: 'x\n', [lua]: 'x\n' })
    await $.tool.call(edit(md))
    await $.tool.call(edit(ts))
    expect(eng.ran).toEqual([])
    await $.tool.call(edit(lua))
    expect(eng.ran.length).toBe(1)
  })

  test('tab and bin/lint findings for one file are one note, not two', async ($, on) => {
    const file = `${DOT}/init.sh`
    engine(on, { [file]: '#!/bin/bash\nif true; then\n\techo hi\nfi\n' }, () => ({
      exitCode: 1,
      stdout: 'shfmt diff\nfix: shfmt -i 4 -ci -w init.sh',
    }))
    const text = notes(await $.tool.call(edit(file)))
    expect(text).toContain('fix: shfmt -i 4 -ci -w init.sh')
    expect(text).not.toContain('tab indentation')
  })

  test('a tool that fails silently or says the file is missing is not reported', async ($, on) => {
    const file = `${DOT}/init.sh`
    engine(on, { [file]: 'echo ok\n' }, () => ({ exitCode: 1 }))
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
  })

  test('bin/lint exiting 2 (usage, no such file) is not reported', async ($, on) => {
    const other = `${DOT}/bin/other`
    engine(on, { [other]: 'echo ok\n' }, () => ({ exitCode: 2, stderr: 'lint: no such file' }))
    expect((await $.tool.call(edit(other))).context).toBeUndefined()
  })

  test('a repo that only has the same file layout is not the dotfiles repo', async ($, on) => {
    const file = `${OTHER}/init.sh`
    const eng = engine(on, {
      [file]: '\techo hi\n',
      [`${OTHER}/bin/lint`]: '#!/bin/bash\n',
      [`${OTHER}/claude-mods/conventions/.claude-plugin/plugin.json`]: '{"name":"other"}',
    })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('an unknown /conventions argument does not toggle', async ($, on) => {
    const file = `${DOT}/init.sh`
    engine(on, { [file]: '\techo hi\n' })
    const r = await $.command.run({ command: 'conventions', args: 'banana' } as never)
    expect(JSON.stringify(r)).toContain('Usage')
    expect(notes(await $.tool.call(edit(file)))).toContain('tab indentation')
  })

  test('an oversized conventions.json is ignored', async ($, on) => {
    const file = `${OTHER}/run.sh`
    engine(on, { [file]: '\techo hi\n', [`${OTHER}/.claude/conventions.json`]: `{"enabled":true,"x":"${'a'.repeat(70 * 1024)}"}` })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
  })
})

describe('outside the dotfiles repo (opt-in)', () => {
  test('does nothing without .claude/conventions.json', async ($, on) => {
    const file = `${OTHER}/run.sh`
    const eng = engine(on, { [file]: '\techo hi\n' })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('does nothing outside a git repo', async ($, on) => {
    const file = '/r/none/run.sh'
    const eng = engine(on, { [file]: '\techo hi\n' })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
    expect(eng.ran).toEqual([])
  })

  test('runs only the checks the repo names', async ($, on) => {
    const file = `${OTHER}/run.sh`
    const eng = engine(on, { [file]: '\techo hi\n', [`${OTHER}/.claude/conventions.json`]: '{"enabled":true,"checks":["tabs"]}' })
    expect(notes(await $.tool.call(edit(file)))).toContain('conventions (advisory, the edit was applied): run.sh')
    expect(eng.ran).toEqual([])
  })

  test('picks the tool by file type and reports its findings with a fix', async ($, on) => {
    const cfg = { [`${OTHER}/.claude/conventions.json`]: '{"enabled":true}' }
    const sh = `${OTHER}/scripts/deploy`
    const zsh = `${OTHER}/prompt.zsh`
    const lua = `${OTHER}/init.lua`
    const md = `${OTHER}/README.md`
    const eng = engine(
      on,
      { ...cfg, [sh]: '#!/usr/bin/env bash\necho hi\n', [zsh]: 'if true; then\n', [lua]: 'local x  =  1\n', [md]: '# hi\n' },
      argv => ({ exitCode: 1, stdout: `${argv[0]} says no` }),
    )
    expect(notes(await $.tool.call(edit(sh)))).toContain('fix: shfmt -i 4 -ci -w scripts/deploy')
    expect(notes(await $.tool.call(edit(zsh)))).toContain('zsh says no')
    expect(notes(await $.tool.call(edit(lua)))).toContain('fix: stylua init.lua')
    expect((await $.tool.call(edit(md))).context).toBeUndefined()
    expect(eng.ran.map(r => r.argv)).toEqual([
      ['shfmt', '-i', '4', '-ci', '-d', sh],
      ['zsh', '-n', zsh],
      ['stylua', '--check', lua],
    ])
    expect(eng.ran.every(r => r.cwd === OTHER && r.timeoutMs === 3000)).toBe(true)
  })

  test('says nothing when every check passes', async ($, on) => {
    const file = `${OTHER}/ok.sh`
    engine(on, { [file]: '#!/bin/bash\necho ok\n', [`${OTHER}/.claude/conventions.json`]: '{"enabled":true}' })
    expect((await $.tool.call(edit(file))).context).toBeUndefined()
  })
})
