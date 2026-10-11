import { describe, expect, test } from 'claude-code/testing'

import {
  classify,
  cleanDryRun,
  findPreviewArgs,
  joinPath,
  lex,
  parseClean,
  sanitize,
  scrubMessages,
  splitSegments,
  substitutions,
  tokenize,
} from './risk'

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

  test('redirections do not hide or change a command', () => {
    expect(kinds('git clean -fdx 2>/dev/null')).toEqual(['git-clean'])
    expect(classify('git clean -fdx 2>/dev/null')[0]?.args).toEqual(['-fdx'])
    expect(kinds("find . -name '*.pyc' -delete 2>/dev/null")).toEqual(['find-delete'])
    expect(kinds('2>&1 git push -f')).toEqual(['git-push-force'])
    expect(kinds('>out git push -f')).toEqual(['git-push-force'])
    expect(kinds('git push origin main -f 2>&1 | tail')).toEqual(['git-push-force'])
    expect(classify('cd repo 2>&1 && git reset --hard')[0]?.cwd).toBe('repo')
  })

  test('comments, heredoc bodies and stray quotes do not hide what runs', () => {
    expect(kinds("# don't do this\ngit push -f")).toEqual(['git-push-force'])
    expect(kinds("echo hi # it's fine\ngit reset --hard")).toEqual(['git-reset-hard'])
    expect(kinds("cat > n.txt <<'EOF'\nit's done\nEOF\ngit push -f origin main")).toEqual(['git-push-force'])
    expect(kinds("cat > n.txt <<EOF\nit's done\nEOF\ngit reset --hard")).toEqual(['git-reset-hard'])
    expect(kinds("cat <<-EOF\n\tit's\n\tEOF\ngit push -f")).toEqual(['git-push-force'])
    expect(kinds('echo "unterminated\ngit push -f')).toEqual(['git-push-force'])
    expect(kinds("echo ${x:-'}\ngit push -f")).toEqual(['git-push-force'])
    expect(kinds("echo $'a\\'b'; git push -f")).toEqual(['git-push-force'])
    expect(kinds('x=$((1<<2))\ngit push -f')).toEqual(['git-push-force'])
    // A heredoc a shell reads is commands
    expect(only("bash <<'EOF'\nrm -rf /tmp/x\nEOF")).toEqual(['rm'])
    expect(only("cat <<'EOF' | sh\ngit push -f\nEOF")).toEqual(['git-push-force'])
    expect(only("cat <<'EOF' | psql\nDROP TABLE users;\nEOF")).toEqual(['sql'])
  })

  test('text in quoted heredocs and comments is not a command', () => {
    const safe = [
      "gh pr create --title x --body \"$(cat <<'EOF'\n## Summary\n- Detects `git push -f` and `rm -rf /`\n- don't break\nEOF\n)\"",
      "cat > notes.md <<'EOF'\nRun `git push -f` carefully\nEOF",
      "cat > notes.md <<'EOF'\ngit push -f\nrm -rf build\nEOF",
      "git commit -m \"$(cat <<'EOF'\ndon't use rm -rf\nEOF\n)\"",
      'git push origin main # not -f',
      'git merge -m "drop table" x',
    ]
    for (const c of safe) expect(kinds(c)).toEqual([])
  })

  test('sees through more wrappers, here-strings, pipes into a shell, case and functions', () => {
    for (const c of [
      'caffeinate -i git push -f',
      'caffeinate -t 60 git push -f',
      'stdbuf -o0 git push -f',
      'chronic git push -f',
      'setsid git push -f',
      'watch -n 5 git push -f',
      "watch 'git push -f'",
      'coproc git push -f',
      "bash <<< 'git push -f'",
      "sh -s <<< 'git push -f'",
      "echo 'git push -f' | bash",
      "printf 'git push -f\\n' | sh",
      'case x in x) git push -f;; esac',
      'case $1 in\n  a|b) ls ;;\n  *) git push -f ;;\nesac',
      'f() { git push -f; }; f',
      'function f { git push -f; }; f',
      "git $'push' -f",
    ])
      expect(only(c)).toEqual(['git-push-force'])
    expect(kinds("echo 'git push -f' | bash script.sh")).toEqual([])
  })

  test('ssh payloads are flagged as remote', () => {
    const [r] = classify("ssh -p 22 host 'cd /srv && rm -rf app'")
    expect(r?.kind).toBe('rm')
    expect(r?.remote).toBe('host')
    expect(r?.cwd).toBeUndefined()
    expect(kinds('ssh host ls')).toEqual([])
  })

  test('git accepts abbreviated long options', () => {
    expect(kinds('git reset --ha')).toEqual(['git-reset-hard'])
    expect(kinds('git reset --h')).toEqual(['git-reset-hard'])
    expect(kinds('git push --forc')).toEqual(['git-push-force'])
    expect(kinds('git push --delet origin x')).toEqual(['git-push-delete'])
    expect(kinds('git push --mirro')).toEqual(['git-push-delete'])
    expect(kinds('git push --prun origin')).toEqual(['git-push-delete'])
    expect(kinds('git clean --forc -d')).toEqual(['git-clean'])
    expect(kinds('git clean -f --dry')).toEqual([])
    expect(kinds('git push --force-with-lease --force-if-includes')).toEqual([])
    expect(kinds('git push --force-w origin main')).toEqual([])
  })

  test('git clean options are read as git reads them', () => {
    // -n here is -e's value, not a dry run
    expect(kinds('git clean -fdx -e -n')).toEqual(['git-clean'])
    expect(kinds('git clean -fn')).toEqual([])
  })

  test('flags other ways to lose work', () => {
    expect(kinds('git checkout -f main')).toEqual(['git-discard'])
    expect(kinds('git checkout -- .')).toEqual(['git-discard'])
    expect(kinds('git checkout .')).toEqual(['git-discard'])
    expect(kinds('git restore .')).toEqual(['git-discard'])
    expect(kinds('git restore --worktree :/')).toEqual(['git-discard'])
    expect(kinds('git restore -SW .')).toEqual(['git-discard'])
    expect(kinds('git switch --discard-changes main')).toEqual(['git-discard'])
    expect(kinds('git stash clear')).toEqual(['git-stash-clear'])
    expect(kinds("find . -name '*.o' -exec rm {} +")).toEqual(['find-delete'])
    expect(kinds('find . -exec rm -rf {} \\;')).toEqual(['find-delete'])
    expect(kinds('git ls-files -z | xargs -0 rm')).toEqual(['rm'])
    expect(classify('git ls-files | xargs rm')[0]?.fromXargs).toBe(true)
    const safe = [
      'git checkout main',
      'git checkout -b feature',
      'git checkout -- src/app.ts',
      'git restore --staged .',
      'git restore src/app.ts',
      'git switch -c feature',
      'git stash drop',
      'git branch -D old',
      'find . -exec grep -l x {} +',
      'xargs echo',
    ]
    for (const c of safe) expect(kinds(c)).toEqual([])
  })

  test('nesting past the parsed depth still asks when it looks destructive', () => {
    expect(kinds('bash -c "bash -c \'bash -c \\"git push -f\\"\'"')).toEqual(['nested'])
    expect(kinds('eval "$(echo "$(echo "$(git push -f)")")"')).toEqual(['nested'])
    expect(kinds('bash -c "bash -c \'bash -c \\"echo hi\\"\'"')).toEqual([])
  })

  test('stays fast on long adversarial input', () => {
    const N = 80000
    const inputs = [
      `rm -${'r'.repeat(N)}_`,
      Array.from({ length: N / 30 }, () => `git commit -m "$(cat <<'EOF'`).join('\n'),
      Array.from({ length: N / 22 }, () => 'git commit -F - <<EOF').join('\n'),
      '"'.repeat(N),
      "'".repeat(N),
      '$('.repeat(N / 2),
      `cat > big.ts <<'EOF'\n${"const x = \"it's\"; // don't $(rm -rf x)\n".repeat(N / 40)}EOF`,
    ]
    for (const c of inputs) {
      const t = Date.now()
      classify(c)
      expect(Date.now() - t).toBeLessThan(2000)
    }
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
    expect(classify('(cd x; make) 2>&1; rm -rf build')[0]?.cwd).toBeUndefined()
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

  test('takes out comments and heredoc bodies', () => {
    expect(sanitize("git commit -F - <<'EOF'\nbody\nEOF\nls").code).toBe("git commit -F - <<'EOF'\nls")
    expect(sanitize("cat <<'EOF'\nit's $(x)\nEOF").code).toBe("cat <<'EOF'\n")
    // An unquoted delimiter expands what is in the body
    expect(sanitize('cat <<EOF\nit\'s $(date)\nEOF').code).toBe('cat <<EOF\n$(date)\n')
    // A shell reads the body as commands
    expect(sanitize("bash <<'EOF'\nls # it's\nEOF").code).toBe("bash <<'EOF'\nls \n\n")
    // SQL reads it as data, for the SQL check only
    expect(sanitize("psql <<'EOF'\nDROP TABLE t;\nEOF").texts).toEqual(['DROP TABLE t;\n'])
    expect(sanitize('ls # a comment\necho a#b').code).toBe('ls \necho a#b')
    // A heredoc that never ends is left as code; arithmetic is not a heredoc
    expect(sanitize("cat <<'EOF'\ngit push -f").code).toBe("cat <<'EOF'\ngit push -f")
    expect(sanitize('x=$((a<<b))\nls').code).toBe('x=$((a<<b))\nls')
    // A quote that never closes is read as a literal
    expect(sanitize('echo "abc\nls').code).toBe('echo \\"abc\nls')
  })

  test('drops redirections and keeps here-strings apart', () => {
    expect(lex('git clean -fdx 2>/dev/null').words).toEqual(['git', 'clean', '-fdx'])
    expect(lex('2>&1 git push -f >out').words).toEqual(['git', 'push', '-f'])
    expect(lex('find . -delete > /tmp/log 2>&1').words).toEqual(['find', '.', '-delete'])
    expect(lex('cmd &>/dev/null {fd}>x a>b').words).toEqual(['cmd', 'a'])
    expect(lex("bash <<< 'git push -f'")).toEqual({ words: ['bash'], hereStrings: ['git push -f'] })
    expect(lex("cat <<'EOF' >x").words).toEqual(['cat'])
    expect(lex('diff <(ls a) b').words).toEqual(['diff', '<(ls', 'a', 'b'])
    expect(lex("echo $'a\\'b' \"2>x\"").words).toEqual(['echo', "a'b", '2>x'])
    expect(splitSegments('a 2>&1 && b &>/dev/null & c >&2')).toEqual(['a 2>&1', 'b &>/dev/null', 'c >&2'])
  })

  test('parses git clean as git does', () => {
    expect(parseClean(['-fdx', '-e', '-n'])).toEqual({ force: 1, dry: false, letters: ['d', 'x'], excludes: ['-n'], paths: [] })
    expect(parseClean(['-fexyz']).excludes).toEqual(['xyz'])
    expect(parseClean(['--forc', '--dry']).dry).toBe(true)
    expect(cleanDryRun(['-ffdx'])).toEqual(['clean', '-n', '-ffdx'])
    expect(cleanDryRun(['-fexyz'])).toEqual(['clean', '-n', '-e', 'xyz'])
    expect(cleanDryRun(['-f', '--exclude=a', '--', '-x'])).toEqual(['clean', '-n', '-e', 'a', '--', '-x'])
  })

  test('previews find without its delete actions', () => {
    expect(findPreviewArgs(['.', '-name', '*.o', '-exec', 'rm', '{}', '+'])).toEqual(['.', '-name', '*.o'])
    expect(findPreviewArgs(['.', '-execdir', '/bin/rm', '-f', '{}', ';', '-print'])).toEqual(['.', '-print'])
    expect(findPreviewArgs(['.', '-exec', 'touch', '{}', ';', '-delete'])).toBeNull()
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
