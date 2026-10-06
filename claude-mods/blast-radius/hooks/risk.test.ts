import { describe, expect, test } from 'claude-code/testing'

import { classify, splitSegments, tokenize } from './risk'

const kinds = (c: string) => classify(c).map(r => r.kind)

describe('classify', () => {
  test('flags the risky forms', () => {
    expect(kinds('rm -rf node_modules')).toEqual(['rm'])
    expect(kinds('sudo rm -fr /tmp/x')).toEqual(['rm'])
    expect(kinds('rm -r -f a b')).toEqual(['rm'])
    expect(kinds('echo hi && rm --recursive build')).toEqual(['rm'])
    expect(kinds('git reset --hard HEAD~1')).toEqual(['git-reset-hard'])
    expect(kinds('git push --force origin main')).toEqual(['git-push-force'])
    expect(kinds('git push -f')).toEqual(['git-push-force'])
    expect(kinds('git push origin +main')).toEqual(['git-push-force'])
    expect(kinds('git clean -fd')).toEqual(['git-clean'])
    expect(kinds('bestow stow --adopt zsh')).toEqual(['adopt'])
    expect(kinds('stow --adopt nvim')).toEqual(['adopt'])
    expect(kinds('chmod -R 777 .')).toEqual(['chmod-r'])
    expect(kinds('dd if=/dev/zero of=/dev/disk2')).toEqual(['dd'])
    expect(kinds('mkfs.ext4 /dev/sdb1')).toEqual(['mkfs'])
    expect(kinds('psql -c "DROP TABLE users;"')).toEqual(['sql'])
    expect(kinds('rails db:migrate')).toEqual(['sql'])
    expect(kinds('bash -c "cd x; rm -rf build"')).toEqual(['rm'])
  })

  test('leaves safe commands alone', () => {
    const safe = [
      'ls -la',
      'rm file.txt',
      'rm -i notes.txt',
      'git status',
      'git push origin main',
      'git reset --soft HEAD~1',
      'git clean -nd',
      'chmod +x script.sh',
      'bestow stow zsh',
      'git commit -m "migrate the docs"',
      'grep -r foo .',
    ]
    for (const c of safe) expect(kinds(c)).toEqual([])
  })
})

describe('parsing', () => {
  test('splits and tokenizes', () => {
    expect(splitSegments('a && b; c | d')).toEqual(['a', 'b', 'c', 'd'])
    expect(splitSegments('echo "a;b" ; ls')).toEqual(['echo "a;b"', 'ls'])
    expect(tokenize('rm -rf "my dir" b')).toEqual(['rm', '-rf', 'my dir', 'b'])
  })
})

describe('hook', () => {
  test('a safe command passes straight through', async ($, on) => {
    on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ok' } }) as never)
    const r = await $.tool.call({ tool: 'Bash', command: 'ls -la' } as never)
    expect(r.isError).not.toBe(true)
  })

  test('a risky command is denied when nothing can preview or answer', async ($, on) => {
    let ran = false
    on('tool.call', { tool: 'Bash' }, () => {
      ran = true
      return { result: { stdout: '' } } as never
    })
    const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf /tmp/blast-radius-test' } as never)
    expect(ran).toBe(false)
    expect(JSON.stringify(r)).toContain('blast-radius')
  })
})
