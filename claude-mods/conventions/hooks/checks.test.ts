import { describe, expect, test } from 'claude-code/testing'

import { allowsTabs, isFixture, language, lineList, lintChecks, parseConfig, tabLines, trimOutput } from './checks'
import { findTokens } from './tokens'

// Fixtures are assembled at runtime so no token-shaped literal sits in the source.
const part = (...p: string[]) => p.join('')
const rnd = (n: number) => 'a1B2c3D4e5'.repeat(Math.ceil(n / 10)).slice(0, n)

describe('tabLines', () => {
  test('finds tabs in the indentation only', () => {
    expect(tabLines('a\n\tb\n  \tc\n    d\ne\tf\n')).toEqual([2, 3])
    expect(tabLines('printf "%s\\t%s"\nx="a\tb"\n')).toEqual([])
  })
})

describe('tabLines context', () => {
  test('skips fenced Markdown code and here-document bodies', () => {
    expect(tabLines('a\n```go\n\tx\n```\n\ty\n', { markdown: true })).toEqual([5])
    expect(tabLines('cat <<-EOF\n\tbody\n\tEOF\n\tafter\n', { shell: true })).toEqual([4])
    expect(tabLines("cat <<'X'\n\tbody\nX\n", { shell: true })).toEqual([])
    expect(tabLines('x=$((1 << 3))\n\ty\n', { shell: true })).toEqual([2])
    expect(tabLines('cat <<< hi\n\ty\n', { shell: true })).toEqual([2])
  })
})

describe('lintChecks', () => {
  test('the paths bin/lint --file covers', () => {
    expect(lintChecks('bin/lint')).toEqual(['shfmt', 'zsh'])
    expect(lintChecks('bin/README.md')).toEqual([])
    expect(lintChecks('bin/sub/x')).toEqual([])
    expect(lintChecks('zsh/.zshrc')).toEqual(['zsh'])
    expect(lintChecks('zsh/.zshrc.d/01-plugins.zsh')).toEqual(['zsh'])
    expect(lintChecks('init.sh')).toEqual(['shfmt', 'zsh'])
    expect(lintChecks('nvim/.config/nvim/init.lua')).toEqual(['stylua'])
    expect(lintChecks('docs/a.md')).toEqual([])
  })
})

describe('allowsTabs', () => {
  test('Makefiles, Go and tab-separated data', () => {
    for (const p of ['Makefile', 'sub/GNUmakefile', 'x.mk', 'main.go', 'go.mod', 'data.tsv', '.gitmodules', 'a.patch', '.gitconfig', 'git/config', 'Makefile.am', 'a.mak']) {
      expect(allowsTabs(p)).toBe(true)
    }
    for (const p of ['init.sh', 'zsh/.zshrc', 'lua/plugins/x.lua', 'README.md', 'Makefile.md']) {
      expect(allowsTabs(p)).toBe(false)
    }
  })
})

describe('isFixture', () => {
  test('test files and fixture folders', () => {
    for (const p of [
      'tests/claude/check.sh',
      'claude-mods/redact/hooks/redact.test.ts',
      'src/__tests__/a.js',
      'pkg/testdata/x.json',
      'fixtures/a.json',
      'a/b.spec.tsx',
      'pkg/x_test.go',
      'test_api.py',
      'test/x.txt',
      'spec/a.rb',
    ]) {
      expect(isFixture(p)).toBe(true)
    }
    for (const p of ['src/app.ts', 'latest/notes.md', 'contest.ts', 'bin/test-zsh-config', 'attest/x.ts']) {
      expect(isFixture(p)).toBe(false)
    }
  })
})

describe('language', () => {
  test('by name, then by shebang', () => {
    expect(language('a/run.sh', '')).toBe('bash')
    expect(language('bin/x', '#!/usr/bin/env bash\necho')).toBe('bash')
    expect(language('bin/x', '#!/bin/sh\n')).toBe('bash')
    expect(language('bin/x', '#!/usr/bin/env zsh\n')).toBe('zsh')
    expect(language('a/b.zsh', '')).toBe('zsh')
    expect(language('.zshrc', '')).toBe('zsh')
    expect(language('init.lua', '')).toBe('lua')
    expect(language('bin/x', '#!/usr/bin/env python3\n')).toBeUndefined()
    expect(language('README.md', '# sh\n')).toBeUndefined()
  })
})

describe('parseConfig', () => {
  test('on in the dotfiles repo and off elsewhere by default, with every check', () => {
    expect(parseConfig(undefined, true)).toEqual({ enabled: true, checks: ['tabs', 'shfmt', 'zsh', 'stylua', 'fixtures'] })
    expect(parseConfig(undefined, false).enabled).toBe(false)
    expect(parseConfig('not json', false).enabled).toBe(false)
    expect(parseConfig('[]', true).enabled).toBe(true)
  })

  test('the repo file turns it on or off and names the checks', () => {
    expect(parseConfig('{"enabled":true}', false).enabled).toBe(true)
    expect(parseConfig('{"enabled":false}', true).enabled).toBe(false)
    expect(parseConfig('{"enabled":true,"checks":["tabs","bogus","zsh"]}', false).checks).toEqual(['tabs', 'zsh'])
    expect(parseConfig('{"checks":"tabs"}', true).checks.length).toBe(5)
  })
})

describe('output', () => {
  test('lineList stops after five', () => {
    expect(lineList([1, 2, 3])).toBe('1, 2, 3')
    expect(lineList([1, 2, 3, 4, 5, 6, 7])).toBe('1, 2, 3, 4, 5 (+2 more)')
  })

  test('trimOutput keeps 12 lines, cuts long ones, keeps fix lines and drops blanks', () => {
    const body = Array.from({ length: 20 }, (_, i) => `l${i}`)
    const out = trimOutput([...body, '', 'x'.repeat(300), 'fix: do it'].join('\n'))
    const lines = out.split('\n')
    expect(lines.length).toBe(14)
    expect(lines[11]).toBe('  l11')
    expect(lines[12]).toBe('  … (9 more lines)')
    expect(lines[13]).toBe('  fix: do it')
    expect(trimOutput('x'.repeat(300)).length).toBe(202)
  })
})

describe('findTokens', () => {
  test('finds each distinctive token shape, with its line', () => {
    const cases: [string, string][] = [
      [part('AK', 'IA', 'ABCDEFGH', 'IJKLMNOP'), 'aws-access-key'],
      [part('gh', 'p_') + 'a1B2'.repeat(9), 'github-token'],
      [part('git', 'hub_pat_') + 'a1B2_'.repeat(9), 'github-token'],
      [part('gl', 'pat-') + rnd(20), 'gitlab-token'],
      [part('np', 'm_') + rnd(36), 'npm-token'],
      [part('h', 'f_') + rnd(34), 'huggingface-token'],
      [part('sk', '_li', 've_') + rnd(24), 'stripe-key'],
      [part('sk-', 'ant-') + 'abcDEF123_-'.repeat(3), 'anthropic-key'],
      [part('sk-', 'proj-') + rnd(40), 'api-key'],
      [part('xo', 'xb-', '1234567890', '-abcdefghij'), 'slack-token'],
      [part('AI', 'za') + rnd(35), 'google-api-key'],
      [part('ey', 'JhbGciOiJI', '.', 'ey', 'JzdWIiOiIx', '.', 'c2ln', 'bmF0dXJl'), 'jwt'],
      [part('-----BEGIN RSA PRIVATE', ' KEY-----'), 'private-key'],
      [part('AGE-', 'SECRET-', 'KEY-1') + 'Q'.repeat(58), 'age-key'],
    ]
    for (const [token, kind] of cases) {
      expect(findTokens(`first line\nconst t = "${token}"\n`)).toEqual([{ kind, line: 2 }])
    }
  })

  test('leaves code that builds a token, and look-alikes, alone', () => {
    const samples = [
      "const t = part('gh', 'p_') + 'a1B2'.repeat(9)",
      'the sk-learn package',
      'commit 3f786850e387550fdab836ed7e6dc881de23001b',
      'GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}',
      're: /\\bghp_[A-Za-z0-9]{30,}\\b/',
    ]
    for (const s of samples) expect(findTokens(s)).toEqual([])
  })

  test('stays fast on a large file', () => {
    const big = 'a-'.repeat(128 * 1024)
    const t = Date.now()
    findTokens(big)
    expect(Date.now() - t).toBeLessThan(200)
  })
})
