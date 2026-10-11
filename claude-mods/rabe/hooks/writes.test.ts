import { expect, test } from 'claude-code/testing'

import { changed, shellWrites } from './writes'

const HOME = '/home/u'
const paths = (command: string, cwd?: string) =>
  shellWrites(command, cwd, HOME).map(one => (one.isDeleted ? `-${one.path}` : one.path))

test('a here-doc into a file under the home folder, as in issue 9', () => {
  const command = [
    'mkdir -p ~/.agents/skills/demo/references',
    "cat > ~/.agents/skills/demo/SKILL.md <<'EOF'",
    '---',
    'name: demo',
    '---',
    'Use > and >> freely here; echo x > not-a-file.md',
    'EOF',
    'cat > ~/.agents/skills/demo/references/notes.md << "END"',
    'body',
    'END',
  ].join('\n')
  expect(paths(command)).toEqual([
    '/home/u/.agents/skills/demo/SKILL.md',
    '/home/u/.agents/skills/demo/references/notes.md',
  ])
})

test('here-doc delimiters lose their quotes as in bash', () => {
  expect(paths('cat <<E"OF" > /tmp/a\nE"OF"\ntouch /tmp/body\nEOF\ntouch /tmp/after')).toEqual([
    '/tmp/a',
    '/tmp/after',
  ])
  expect(paths("cat <<'E'OF > /tmp/a\nbody > x\nEOF")).toEqual(['/tmp/a'])
  expect(paths('cat <<\\EOF > /tmp/a\nbody > x\nEOF')).toEqual(['/tmp/a'])
  expect(paths('cat <<-EOF > /tmp/t\n\tbody > x\n\tEOF\necho done > /tmp/u')).toEqual([
    '/tmp/t',
    '/tmp/u',
  ])
  expect(paths('cat <<A <<B > /tmp/two\na\nA\nb\nB\ntouch /tmp/next')).toEqual([
    '/tmp/two',
    '/tmp/next',
  ])
})

test('an unterminated here-doc records nothing from its start on', () => {
  expect(paths('touch /tmp/before\ncat <<EOF > /tmp/x\ntouch /tmp/body')).toEqual(['/tmp/before'])
})

test('redirections to files count; reads, dups and /dev targets do not', () => {
  expect(paths('echo x > a.txt; echo y >> /tmp/b.txt')).toEqual(['a.txt', '/tmp/b.txt'])
  expect(paths('make 2> err.log >&2 2>&1')).toEqual(['err.log'])
  expect(paths('make 2>>/tmp/e.log')).toEqual(['/tmp/e.log'])
  expect(paths('bun test &> /dev/null; ls > /dev/stderr')).toEqual([])
  expect(paths('bun test &> /tmp/all.log; bun x &>> /tmp/all2.log')).toEqual([
    '/tmp/all.log',
    '/tmp/all2.log',
  ])
  expect(paths('echo x 1>/tmp/one >|/tmp/two')).toEqual(['/tmp/one', '/tmp/two'])
  expect(paths('cat <<<"a > b" < in.txt')).toEqual([])
  expect(paths('cat < /tmp/in 0</tmp/in2 <> /tmp/rw')).toEqual([])
})

test('quotes, escapes and comments', () => {
  expect(paths(`echo "a > b" > '/tmp/my file.md'`)).toEqual(['/tmp/my file.md'])
  expect(paths('echo a\\ b > /tmp/x\\ y')).toEqual(['/tmp/x y'])
  expect(paths("echo hi > $'/tmp/ansi'")).toEqual(['/tmp/ansi'])
  expect(paths('echo hi # > /tmp/no')).toEqual([])
  expect(paths('echo x > "$OUT/f"; echo y > `pwd`/g; echo z > $(mktemp)')).toEqual([])
})

test('nothing inside a command substitution is a write of the outer command', () => {
  expect(paths('printf "%s\\n" "$(echo "x > /tmp/secret")"')).toEqual([])
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion, not a template
  expect(paths('echo $(touch /tmp/inner) `rm /tmp/inner2` ${x:-"> /tmp/no"}')).toEqual([])
  expect(paths('echo "$(echo ")" > /tmp/q)" > /tmp/out')).toEqual(['/tmp/out'])
  expect(paths('x=$(cat <<EOF\n)\nEOF\n) > /tmp/no')).toEqual([])
  expect(paths('diff <(sort a) >(tee /tmp/p) > /tmp/d')).toEqual(['/tmp/d'])
})

test('OR branches propose candidates for the disk to check', () => {
  expect(paths('false || echo x > f.txt', '/repo')).toEqual(['/repo/f.txt'])
  expect(paths('true || touch /tmp/never')).toEqual(['/tmp/never'])
  expect(paths('touch /tmp/sure || touch /tmp/never')).toEqual(['/tmp/sure', '/tmp/never'])
})

test('test syntax and background lists record nothing', () => {
  expect(paths('if false; then touch /tmp/never; fi')).toEqual([])
  expect(paths('touch /tmp/a; while read l; do echo > /tmp/w; done; touch /tmp/b')).toEqual([
    '/tmp/a',
  ])
  expect(paths('case x in a) touch /tmp/c;; esac')).toEqual([])
  expect(paths('for f in a b; do echo x > /tmp/$f; done')).toEqual([])
  expect(paths('[[ z > a ]] && touch /tmp/t')).toEqual([])
  expect(paths('test -f x && touch /tmp/t; [ a ] && touch /tmp/u')).toEqual([])
  expect(paths('sleep 60 > /tmp/background.log &')).toEqual([])
  expect(paths('touch /tmp/a && sleep 1 > /tmp/b & touch /tmp/c')).toEqual([])
  expect(paths('touch /tmp/a; touch /tmp/b || x & wait')).toEqual(['/tmp/a'])
  expect(paths('(cd /tmp && touch in) && touch out')).toEqual([])
  expect(paths('touch /tmp/a && { touch /tmp/b; }')).toEqual(['/tmp/a'])
  expect(paths('f() { touch /tmp/f; }; f')).toEqual([])
  expect(paths('touch /tmp/a; exit 0; touch /tmp/b')).toEqual(['/tmp/a'])
  expect(paths('$CMD > /tmp/r; touch /tmp/after')).toEqual(['/tmp/r'])
})

test('lists and continuations after an OR branch keep their candidates', () => {
  expect(
    paths(
      "ss -ltn | grep -q ':8765 ' && echo busy || echo free\ncat > /tmp/a/config.json <<EOF\n{}\nEOF\n",
    ),
  ).toEqual(['/tmp/a/config.json'])
  expect(
    paths('touch /tmp/before || touch /tmp/skip && touch /tmp/also-skip; touch /tmp/after'),
  ).toEqual(['/tmp/before', '/tmp/skip', '/tmp/also-skip', '/tmp/after'])
  expect(paths('true || cat > /tmp/skip <<EOF\ntouch /tmp/body\nEOF\ntouch /tmp/after')).toEqual([
    '/tmp/skip',
    '/tmp/after',
  ])
  expect(paths('true ||\n touch /tmp/skip\ntouch /tmp/after')).toEqual(['/tmp/skip', '/tmp/after'])
  expect(paths('true || cd /elsewhere; touch relative /tmp/absolute', '/repo')).toEqual([
    '/tmp/absolute',
  ])
  expect(paths('true || pushd /x; touch rel', '/repo')).toEqual([])
  expect(paths('true || popd; touch rel', '/repo')).toEqual([])
  expect(paths('true || exit 0\ntouch /tmp/after')).toEqual([])
  expect(paths('true || if false; then touch /tmp/skip; fi\ntouch /tmp/after')).toEqual([])
  expect(paths('touch /tmp/before || echo fallback &\ntouch /tmp/after')).toEqual([])
})

test('an OR fallback can mask a failed directory change on its left', () => {
  expect(paths('false || cd /elsewhere && touch relative /tmp/absolute', '/repo')).toEqual([
    '/tmp/absolute',
  ])
  expect(paths('cd /elsewhere && echo ok || touch relative /tmp/absolute', '/repo')).toEqual([
    '/tmp/absolute',
  ])
  expect(
    paths('cd /elsewhere && echo ok || echo failed; touch relative /tmp/absolute', '/repo'),
  ).toEqual(['/tmp/absolute'])
  expect(
    paths('cd /elsewhere && cd /repo && echo ok || echo failed; touch relative', '/repo'),
  ).toEqual([])
  expect(paths('echo ok || echo failed; touch relative', '/repo')).toEqual(['/repo/relative'])
  expect(
    paths('cd /elsewhere && echo ok || echo failed; cd /known && touch relative', '/repo'),
  ).toEqual(['/known/relative'])
})

test('tee, sed -i, touch', () => {
  expect(paths('ls | tee -a /tmp/a /tmp/b | tee - >/dev/null')).toEqual(['/tmp/a', '/tmp/b'])
  expect(paths("sed -i 's/a/b/' /tmp/x /tmp/y")).toEqual(['/tmp/x', '/tmp/y'])
  expect(paths("sed -i.bak -e 's/a/b/' -e 's/c/d/' /tmp/x")).toEqual(['/tmp/x'])
  expect(paths("sed -i '' 's/a/b/' /tmp/mac")).toEqual(['/tmp/mac'])
  expect(paths('sed -i --expression=s/a/b/ /tmp/file')).toEqual(['/tmp/file'])
  expect(paths('sed --in-place=.bak --expression s/a/b/ /tmp/f2')).toEqual(['/tmp/f2'])
  expect(paths('sed -i "s/$a/b/" /tmp/var')).toEqual(['/tmp/var'])
  expect(paths("sed -n 's/a/b/p' /tmp/x")).toEqual([])
  expect(paths('cat f | sed -i s/a/b/ /tmp/piped')).toEqual([])
  expect(paths('touch -d yesterday /tmp/t1 /tmp/t2')).toEqual(['/tmp/t1', '/tmp/t2'])
  expect(paths('touch --reference /tmp/ref /tmp/new')).toEqual(['/tmp/new'])
  expect(paths('touch --reference=/tmp/ref -r /tmp/r2 /tmp/new2')).toEqual(['/tmp/new2'])
})

test('cp, mv, install and ln write their destination, or a file in it; mv and rm delete', () => {
  expect(paths('cp -r src/a.md /tmp/b.md')).toEqual(['/tmp/b.md', '/tmp/b.md/a.md'])
  expect(paths('cp a.md b.md /tmp/out')).toEqual(['/tmp/out/a.md', '/tmp/out/b.md'])
  expect(paths('cp /x/a.md /tmp/out/')).toEqual(['/tmp/out/a.md'])
  expect(paths('cp -t /tmp/out /x/a.md')).toEqual(['/tmp/out/a.md'])
  expect(paths('cp --target-directory /tmp/out /tmp/src')).toEqual(['/tmp/out/src'])
  expect(paths('cp --target-directory=/tmp/out -- /tmp/s2')).toEqual(['/tmp/out/s2'])
  expect(paths('cp -T /x/dir /tmp/copy')).toEqual(['/tmp/copy'])
  expect(paths('mv /tmp/old.md /tmp/new.md')).toEqual([
    '/tmp/new.md',
    '-/tmp/old.md',
    '/tmp/new.md/old.md',
  ])
  expect(paths('mv -t /tmp/d /tmp/a')).toEqual(['-/tmp/a', '/tmp/d/a'])
  expect(paths('install -m 644 bin/rabe /usr/local/bin/rabe')).toEqual([
    '/usr/local/bin/rabe',
    '/usr/local/bin/rabe/rabe',
  ])
  expect(paths('install -d /tmp/dir')).toEqual([])
  expect(paths('ln -sf /opt/tool /tmp/link')).toEqual(['/tmp/link', '/tmp/link/tool'])
  expect(paths('rm -f /tmp/gone.txt')).toEqual(['-/tmp/gone.txt'])
  expect(paths('/bin/rm -rf /tmp/d2')).toEqual(['-/tmp/d2'])
})

test('an option the table does not know skips the command', () => {
  expect(paths('cp --parents a/b.md /tmp/out')).toEqual([])
  expect(paths('cp -i a /tmp/b; rm -I /tmp/c; mv --frobnicate a b')).toEqual([])
  expect(paths('touch --tar /tmp/x')).toEqual([])
  expect(paths('rm $FLAGS /tmp/x; rm "$F" /tmp/y')).toEqual([])
  expect(paths('cp a "$DEST"; cp "$SRC" /tmp/dst; mv $A /tmp/m')).toEqual([])
})

test('globs, brace expansions, unknown tildes and process substitutions are skipped', () => {
  expect(paths('rm -f /tmp/*.tmp /tmp/keep')).toEqual(['-/tmp/keep'])
  expect(paths('touch x{1,2} y{1..3} /tmp/a?b /tmp/[ab] /tmp/plain')).toEqual(['/tmp/plain'])
  expect(paths('touch ~other/x "~/quoted" ~')).toEqual(['~/quoted'])
  expect(paths('cp a b /tmp/dir/*')).toEqual([])
  expect(shellWrites('touch ~/x /tmp/y').map(one => one.path)).toEqual(['/tmp/y'])
})

test('candidates the disk decides on: masked failures, no-op modes, multi-file sed', () => {
  expect(paths('false && touch /tmp/never || true')).toEqual(['/tmp/never'])
  expect(paths('cp /tmp/missing /tmp/out; true')).toEqual(['/tmp/out', '/tmp/out/missing'])
  expect(paths('touch -c /tmp/absent; rm -f /tmp/gone')).toEqual(['/tmp/absent', '-/tmp/gone'])
  expect(paths("sed -i 'q' /tmp/a /tmp/b")).toEqual(['/tmp/a', '/tmp/b'])
})

test('a tilde after HOME changes is skipped', () => {
  expect(paths('export HOME=/tmp; touch ~/file /tmp/plain')).toEqual(['/tmp/plain'])
  expect(paths('HOME=/x touch ~/f')).toEqual([])
})

test('known prefixes unwrap before the lookup', () => {
  expect(paths('rtk proxy touch /tmp/f; rtk proxy sed -i s/a/b/ /tmp/g')).toEqual([
    '/tmp/f',
    '/tmp/g',
  ])
  expect(paths('rtk git status > /tmp/st; rtk ls /tmp/nope')).toEqual(['/tmp/st'])
  expect(
    paths('FOO=1 env -i A=b command nice -n 5 nohup time -p sudo -E tee /etc/x < /dev/null'),
  ).toEqual(['/etc/x'])
  expect(paths('builtin command -p touch /tmp/b')).toEqual(['/tmp/b'])
  expect(paths('sudo -u root touch /tmp/s; env -C /x touch y; command -v touch /tmp/v')).toEqual([])
})

test('cd moves the cwd only when the next command needs it to succeed', () => {
  expect(paths('cd /tmp/w && echo x > a && cd sub && touch ../b ./c', '/repo')).toEqual([
    '/tmp/w/a',
    '/tmp/w/b',
    '/tmp/w/sub/c',
  ])
  expect(paths('cd /tmp/w; touch rel /tmp/abs', '/repo')).toEqual(['/tmp/abs'])
  expect(paths('cd "$D" && touch rel; pushd /x && touch r2', '/repo')).toEqual([])
  expect(paths('echo x > out/a.md', '/repo')).toEqual(['/repo/out/a.md'])
})

test('without a cwd relative paths stay relative', () => {
  expect(paths('cd sub && echo x > a.md')).toEqual(['sub/a.md'])
})

test('reads, plain commands and broken input write nothing', () => {
  const corpus = [
    'cat a.md | grep x',
    'git status',
    'bun test',
    'ls -la /tmp',
    'grep -rn "a > b" src',
    'awk \'{ print $1 > "/tmp/x" }\' f',
    'find . -name "*.ts" -newer x',
    'echo "> /tmp/x"',
    "echo '>> /tmp/y'",
    'printf "%s > %s\\n" a b',
    'head -n 5 /tmp/a | sort | uniq -c',
    'wc -l < /tmp/in',
    'jq ".a > 1" data.json',
    'node -e "fs.writeFileSync(\'/tmp/x\', 1)"',
    "python3 -c \"open('/tmp/x', 'w')\"",
    'git log --oneline -5',
    'diff a b',
    'curl -s https://example.com',
    'test 2 -gt 1',
    '[ -d /tmp ]',
    'true',
    ':',
    'echo $((1 > 0))',
    'echo hi 2>&1',
    'ls >&2',
    'make 1>&2 2>/dev/null',
    'sed s/a/b/ f',
    'sed -e s/a/b/ -n f',
    'mkdir -p /tmp/new',
    'chmod +x a.sh',
    'git diff --stat main',
    'rtk gain',
    'tee < /dev/null',
    'cp onlyone',
    'echo `date` $(whoami)',
    'export A=1 B=2',
    "echo 'unterminated > x",
    'echo "unterminated > x',
    'echo $(unterminated > x',
    'echo >',
    'echo x | > /tmp/z)',
  ]
  for (const command of corpus) expect([command, paths(command)]).toEqual([command, []])
})

test('a path written twice is listed once, the last change winning', () => {
  expect(paths('touch /tmp/a; echo x >> /tmp/a; rm /tmp/a')).toEqual(['-/tmp/a'])
})

test('hostile input never throws and stays fast', () => {
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const alphabet = ' \t\n\'"\\$`(){}[]<>|&;#*?~=-ab/0123456789EOF'
  const started = Date.now()
  for (let n = 0; n < 2000; n++) {
    let text = ''
    const size = Math.floor(rand() * 80)
    for (let k = 0; k < size; k++) text += alphabet[Math.floor(rand() * alphabet.length)]
    expect(Array.isArray(shellWrites(text, '/repo', HOME))).toBe(true)
  }
  const huge = [
    '$('.repeat(50_000),
    '"$('.repeat(20_000),
    '`'.repeat(100_001),
    '${'.repeat(50_000),
    `cat > /tmp/h <<EOF\n${'x > y\n'.repeat(100_000)}EOF`,
    'touch /tmp/a; '.repeat(50_000),
    `echo '${'a'.repeat(1_000_000)}`,
    '<<A '.repeat(20_000),
    '\\'.repeat(100_001),
  ]
  for (const text of huge) expect(Array.isArray(shellWrites(text, '/repo', HOME))).toBe(true)
  expect(Date.now() - started).toBeLessThan(5000)
})

test('a file counts as written when it is new or its mtime or size changed', () => {
  const at = (size: number, mtimeMs: number) => ({ kind: 'file' as const, size, mtimeMs })
  expect(changed('none', at(1, 1))).toBe('write')
  expect(changed(at(1, 1), at(1, 2))).toBe('write')
  expect(changed(at(1, 1), at(2, 1))).toBe('write')
  expect(changed(at(1, 1), at(1, 1))).toBeUndefined()
  expect(changed(at(1, 1), 'none')).toBe('delete')
  expect(changed('none', 'none')).toBeUndefined()
  expect(changed('none', { kind: 'dir', size: 0, mtimeMs: 2 })).toBeUndefined()
  expect(changed(undefined, at(1, 1))).toBeUndefined()
  expect(changed(at(1, 1), undefined)).toBeUndefined()
})
