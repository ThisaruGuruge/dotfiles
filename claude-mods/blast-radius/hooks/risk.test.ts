import { describe, expect, test } from 'claude-code/testing'

import { classify, joinPath, scrubMessages, splitSegments, stripMessageHeredocs, substitutions, tokenize } from './risk'

const kinds = (c: string) => classify(c).map(r => r.kind)
const only = (c: string) => [...new Set(kinds(c))]

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
    expect(kinds('git push --force-with-lease --force')).toEqual(['git-push-force'])
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

  test('sees through git global options', () => {
    expect(kinds('git -C /repo reset --hard')).toEqual(['git-reset-hard'])
    expect(kinds('git -C ../x reset --hard')).toEqual(['git-reset-hard'])
    expect(kinds('git -C . push --force')).toEqual(['git-push-force'])
    expect(kinds('git -C /repo push --force')).toEqual(['git-push-force'])
    expect(kinds('git -c x=y push -f')).toEqual(['git-push-force'])
    expect(kinds('git -c user.name=x -C sub clean -fdx')).toEqual(['git-clean'])
    expect(kinds('git --git-dir /r/.git --work-tree /r reset --hard')).toEqual(['git-reset-hard'])
    expect(kinds('git --git-dir=/r/.git reset --hard')).toEqual(['git-reset-hard'])
    expect(kinds('git --no-pager --namespace ns push -f')).toEqual(['git-push-force'])
  })

  test('sees through wrappers and the values of their options', () => {
    expect(kinds('sudo -u root git reset --hard')).toEqual(['git-reset-hard'])
    expect(kinds('sudo -iu root rm -rf /srv/x')).toEqual(['rm'])
    expect(kinds('sudo --user root git push -f')).toEqual(['git-push-force'])
    expect(kinds('sudo -- rm -rf x')).toEqual(['rm'])
    expect(kinds('doas -u admin rm -rf x')).toEqual(['rm'])
    expect(kinds('env -C /tmp git reset --hard')).toEqual(['git-reset-hard'])
    expect(kinds('env -u HOME FOO=1 git push -f')).toEqual(['git-push-force'])
    expect(kinds("env -S 'git push --force'")).toEqual(['git-push-force'])
    expect(kinds('nice -n 10 git push -f')).toEqual(['git-push-force'])
    expect(kinds('find . -print0 | xargs -0 -n 1 -P 4 rm -rf')).toEqual(['rm'])
    expect(kinds('xargs -I {} rm -rf {}')).toEqual(['rm'])
    expect(kinds('time -o /tmp/t git push -f')).toEqual(['git-push-force'])
    expect(kinds('timeout 5 git push -f')).toEqual(['git-push-force'])
    expect(kinds('timeout -s KILL 5 git push -f')).toEqual(['git-push-force'])
    expect(kinds('command git push -f')).toEqual(['git-push-force'])
    expect(kinds('if true; then git push -f; fi')).toEqual(['git-push-force'])
    expect(kinds('{ git push -f; }')).toEqual(['git-push-force'])
  })

  test('follows subshells, shell -c payloads, eval and substitutions', () => {
    expect(kinds('(cd repo && git push -f)')).toEqual(['git-push-force'])
    expect(kinds('bash -c "git reset --hard"')).toEqual(['git-reset-hard'])
    expect(kinds("sh -c 'git push --force'")).toEqual(['git-push-force'])
    expect(kinds("zsh -lc 'git push --force'")).toEqual(['git-push-force'])
    expect(kinds('eval "git push -f"')).toEqual(['git-push-force'])
    expect(only('echo $(git push -f)')).toEqual(['git-push-force'])
    expect(only('echo `git reset --hard`')).toEqual(['git-reset-hard'])
    expect(only('x="$(git push -f origin main)"')).toEqual(['git-push-force'])
    expect(only("bash -c 'sh -c \"git push -f\"'")).toEqual(['git-push-force'])
  })

  test('flags pushes that delete remote refs', () => {
    expect(kinds('git push origin :main')).toEqual(['git-push-delete'])
    expect(kinds('git push --delete origin main')).toEqual(['git-push-delete'])
    expect(kinds('git push origin -d feature')).toEqual(['git-push-delete'])
    expect(kinds('git push --mirror')).toEqual(['git-push-delete'])
    expect(kinds('git push --prune origin refs/heads/*:refs/heads/*')).toEqual(['git-push-delete'])
    expect(kinds('git push -f --prune origin main')).toEqual(['git-push-force', 'git-push-delete'])
  })

  test('reads quotes and escapes as the shell does', () => {
    // No escapes inside single quotes: the quote ends at the second ', so the push runs
    expect(kinds("echo 'a\\'; git push -f")).toEqual(['git-push-force'])
    expect(kinds('echo "a\\"; git push -f"')).toEqual([])
    expect(kinds('find . -exec touch {} \\; -delete')).toEqual(['find-delete'])
  })

  test('flags find -delete and rsync --delete', () => {
    expect(kinds('find . -name "*.log" -delete')).toEqual(['find-delete'])
    expect(kinds('rsync -a --delete src/ dst/')).toEqual(['rsync-delete'])
    expect(kinds('rsync -a --delete-after src/ dst/')).toEqual(['rsync-delete'])
    expect(kinds('rsync -a --del src/ dst/')).toEqual(['rsync-delete'])
  })

  test('leaves safe commands alone', () => {
    const safe = [
      'ls -la',
      'rm file.txt',
      'rm -i notes.txt',
      'git status',
      'git push origin main',
      'git push --force-with-lease',
      'git push --force-with-lease=main:abc123 origin main',
      'git push -u origin feature',
      'git reset --soft HEAD~1',
      'git clean -nd',
      'git clean -fd --dry-run',
      'git -C /repo status',
      'git -c core.pager=cat log',
      'sudo -u root ls',
      'chmod +x script.sh',
      'bestow stow zsh',
      'git commit -m "migrate the docs"',
      'grep -r foo .',
      'find . -name "*.log"',
      'rsync -a src/ dst/',
      'bash script.sh',
      'echo $(git status)',
    ]
    for (const c of safe) expect(kinds(c)).toEqual([])
  })

  test('commit and tag messages are not read as commands', () => {
    const messages = [
      'git commit -m "docs: never rm -rf the cache"',
      'git commit -m "drop table support"',
      "git commit -am 'truncate table names in the log'",
      'git commit --message="delete from users; is gone"',
      'git commit -m"rm -rf is dangerous"',
      'git tag -a v1 -m "drop table legacy"',
      'git -C repo commit -m "rm -rf build is no longer needed"',
      "git commit -m \"$(cat <<'EOF'\nfix: never rm -rf the cache\n\ndrop table support too\nEOF\n)\"",
      "git commit -F - <<'EOF'\nrm -rf old\nEOF",
      'git commit -F- <<EOF\ndrop table things\nEOF',
    ]
    for (const c of messages) expect(kinds(c)).toEqual([])
  })

  test('a message never hides a command that runs', () => {
    expect(only('git commit -m "x" && rm -rf build')).toEqual(['rm'])
    expect(only('git commit -m "$(rm -rf ~/x)"')).toEqual(['rm'])
    expect(only('git commit -m "$(git push -f)"')).toEqual(['git-push-force'])
    expect(only("git commit -F - <<'EOF'\nmsg\nEOF\nrm -rf build")).toEqual(['rm'])
    // An unquoted heredoc expands $(...) in its body
    expect(only('git commit -F - <<EOF\n$(git push -f)\nEOF')).toEqual(['git-push-force'])
    // The heredoc is only skipped when git is what reads it
    expect(only('git commit -m x; bash <<EOF\nrm -rf /tmp/y\nEOF')).toEqual(['rm'])
    expect(only('psql <<EOF\nDROP TABLE users;\nEOF')).toEqual(['sql'])
  })

  test('records where the command runs', () => {
    expect(classify('cd sub && rm -rf build')[0]?.cwd).toBe('sub')
    expect(classify('cd /srv && cd app && git clean -fd')[0]?.cwd).toBe('/srv/app')
    expect(classify('git -C /repo reset --hard')[0]?.cwd).toBe('/repo')
    expect(classify('cd /a && git -C b push -f')[0]?.cwd).toBe('/a/b')
    expect(classify('env -C /tmp git reset --hard')[0]?.cwd).toBe('/tmp')
    expect(classify('cd $DIR && rm -rf build')[0]?.cwd).toBe('?')
    expect(classify('cd && rm -rf build')[0]?.cwd).toBe('~')
    expect(classify('cd - && rm -rf build')[0]?.cwd).toBe('?')
    expect(classify('rm -rf build')[0]?.cwd).toBeUndefined()
    // A subshell's cd ends with it
    expect(classify('(cd x && make); rm -rf build')[0]?.cwd).toBeUndefined()
    expect(classify('git --git-dir=/r/.git reset --hard')[0]?.gitArgs).toEqual(['--git-dir=/r/.git'])
  })
})

describe('parsing', () => {
  test('splits and tokenizes', () => {
    expect(splitSegments('a && b; c | d')).toEqual(['a', 'b', 'c', 'd'])
    expect(splitSegments('echo "a;b" ; ls')).toEqual(['echo "a;b"', 'ls'])
    expect(tokenize('rm -rf "my dir" b')).toEqual(['rm', '-rf', 'my dir', 'b'])
    expect(tokenize('git push -f)')).toEqual(['git', 'push', '-f'])
    expect(tokenize('echo "a)b"')).toEqual(['echo', 'a)b'])
    expect(tokenize('echo "a\\"b" \'c\\\'')).toEqual(['echo', 'a"b', 'c\\'])
  })

  test('finds substitutions outside single quotes', () => {
    expect(substitutions('a $(b) `c` "$(d)" \'$(e)\' <(f)')).toEqual(['b', 'c', 'd', 'f'])
    expect(substitutions('x $(a $(b) c) y')).toEqual(['a $(b) c'])
  })

  test('scrubs message values but keeps their substitutions', () => {
    expect(scrubMessages('git commit -m "rm -rf x" && ls')).toBe("git commit -m '' && ls")
    expect(scrubMessages('git commit -m "a $(b) c"')).toBe("git commit -m '' $(b)")
    expect(scrubMessages('echo -m "rm -rf x"')).toBe('echo -m "rm -rf x"')
  })

  test('drops only git message heredocs', () => {
    expect(stripMessageHeredocs("git commit -F - <<'EOF'\nbody\nEOF\nls")).toBe("git commit -F - <<'EOF'\nEOF\nls")
    expect(stripMessageHeredocs("cat <<'EOF'\nbody\nEOF")).toBe("cat <<'EOF'\nbody\nEOF")
  })

  test('joins directories', () => {
    expect(joinPath(undefined, 'a')).toBe('a')
    expect(joinPath('/a/', 'b')).toBe('/a/b')
    expect(joinPath('/a', '/b')).toBe('/b')
    expect(joinPath('/a', '~/b')).toBe('~/b')
    expect(joinPath('/a', '$X')).toBe('?')
    expect(joinPath('?', 'b')).toBe('?')
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
