import { describe, expect, test } from 'claude-code/testing'

import { WITHHELD, looksLikeCode, redactBlocks, redactDeep, redactText, withhold } from './patterns'
import { total } from './patterns'
import { allowedKinds, denyMessage, findInlineSecrets, inputStrings, modeOf } from './guard'
import type { Counts } from './patterns'

const run = (s: string) => {
  const counts: Counts = {}
  return { out: redactText(s, counts), counts }
}

// Fixtures are assembled at runtime so no token-shaped literal sits in the source
// (secret scanners flag them even when they are fake).
const part = (...p: string[]) => p.join('')
const awsKey = part('AK', 'IA', 'ABCDEFGH', 'IJKLMNOP')
const jwt = part('ey', 'JhbGciOiJI', '.', 'ey', 'JzdWIiOiIx', '.', 'c2ln', 'bmF0dXJl')
const slack = part('xo', 'xb-', '1234567890', '-abcdefghij')
const pem = part('-----BEGIN RSA PRIVATE', ' KEY-----', '\n', 'MIIabc', '\n', '-----END RSA PRIVATE', ' KEY-----')
const pwd = part('Hunter', '2xyz', 'Abc9')
// A random-looking value: letters and digits mixed, as real tokens are
const rnd = (n: number) => 'a1B2c3D4e5'.repeat(Math.ceil(n / 10)).slice(0, n)

describe('redactText', () => {
  test('hides distinctive tokens', () => {
    const cases: [string, string][] = [
      [`key ${awsKey} here`, 'aws-access-key'],
      [`token ${part('gh', 'p_')}${'a1B2'.repeat(9)}`, 'github-token'],
      [`${part('AGE-', 'SECRET-', 'KEY-1')}${'Q'.repeat(58)}`, 'age-key'],
      [`${part('sk-', 'ant-')}${'abcDEF123_-'.repeat(3)}`, 'anthropic-key'],
      [slack, 'slack-token'],
      [jwt, 'jwt'],
      [pem, 'private-key'],
      [`use ${part('gl', 'pat-')}${rnd(20)}`, 'gitlab-token'],
      [`registry ${part('np', 'm_')}${rnd(36)}`, 'npm-token'],
      [`hub ${part('h', 'f_')}${rnd(34)}`, 'huggingface-token'],
      [`stripe ${part('sk', '_li', 've_')}${rnd(24)}`, 'stripe-key'],
      [`stripe ${part('rk', '_te', 'st_')}${rnd(24)}`, 'stripe-key'],
    ]
    for (const [input, kind] of cases) {
      const { out, counts } = run(input)
      expect(out).toContain(`[REDACTED:${kind}]`)
      expect(counts[kind]).toBe(1)
    }
  })

  test('hides a private key, whole or cut off before its END line', () => {
    // Obviously fake base64: a repeated filler, not key material
    const begin = part('-----BEGIN OPENSSH PRIVATE', ' KEY-----')
    const end = part('-----END OPENSSH PRIVATE', ' KEY-----')
    const body = ['QUFBQUFB'.repeat(8), 'QkJCQkJC'.repeat(8), 'Q0NDQw==']
    const whole = run(`key:\n${begin}\n${body.join('\n')}\n${end}\ndone`)
    expect(whole.out).toBe('key:\n[REDACTED:private-key]\ndone')
    expect(whole.counts['private-key']).toBe(1)

    // head -3: no END line, the text just stops
    expect(run(`${begin}\n${body[0]}\n${body[1]}`).out).toBe('[REDACTED:private-key]')
    // cut off mid-line, then more output after a blank line or a non-base64 line
    expect(run(`${begin}\n${body[0]}\nQUFB\n\nnext: ok`).out).toBe('[REDACTED:private-key]\n\nnext: ok')
    expect(run(`${begin}\n${body[0]}\n(truncated)`).out).toBe('[REDACTED:private-key]\n(truncated)')
    // a traditional encrypted key's headers and the blank line after them
    const rsa = part('-----BEGIN RSA PRIVATE', ' KEY-----')
    const enc = `${rsa}\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,00FF\n\n${body[0]}\n${body[1]}`
    expect(run(enc).out).toBe('[REDACTED:private-key]')
    // JSON-escaped line breaks
    expect(run(`{"k":"${begin}\\n${body[0]}\\n${body[1]}"}`).out).toBe('{"k":"[REDACTED:private-key]"}')
    // line-numbered: cat -n, a Read result's arrow, grep -n; the number before BEGIN stays
    for (const sep of ['\t', '→']) {
      const lines = [begin, body[0], body[1]].map((l, i) => `     ${i + 1}${sep}${l}`).join('\n')
      expect(run(lines).out).toBe(`     1${sep}[REDACTED:private-key]`)
    }
    expect(run(`1:${begin}\n2:${body[0]}\n3:${body[1]}`).out).toBe('1:[REDACTED:private-key]')
    const encN = `     1\t${rsa}\n     2\tProc-Type: 4,ENCRYPTED\n     3\tDEK-Info: AES-128-CBC,00FF\n     4\t\n     5\t${body[0]}`
    expect(run(encN).out).toBe('     1\t[REDACTED:private-key]')
    // a following `word: value` line is not swallowed
    expect(run(`key: |\n  ${begin}\n  ${body[0]}\n  ${body[1]}\nnext: 1`).out).toBe(
      'key: |\n  [REDACTED:private-key]\nnext: 1',
    )
  })

  test('a truncated private key with adversarial input stays fast', () => {
    const begin = part('-----BEGIN OPENSSH PRIVATE', ' KEY-----')
    for (const s of [`${begin}\n${'A'.repeat(400_000)}!`, `${begin}${'\n 1:a'.repeat(80_000)}`, `${begin}\n${'1'.repeat(400_000)} x`]) {
      const t = performance.now()
      redactText(s, {})
      expect(performance.now() - t).toBeLessThan(500)
    }
  })

  test('keeps the name of a password assignment, hides the value', () => {
    const { out } = run(`DB_PASSWORD=${pwd} and password: "${pwd}"`)
    expect(out).toBe('DB_PASSWORD=[REDACTED:password] and password: "[REDACTED:password]"')
  })

  test('hides the values of credential-named variables', () => {
    const v = rnd(24)
    const cases: [string, string][] = [
      [`GITHUB_TOKEN=${v}`, 'GITHUB_TOKEN=[REDACTED:credential]'],
      [`export packagePAT=${v}`, 'export packagePAT=[REDACTED:credential]'],
      [`NPM_AUTH_TOKEN: "${v}"`, 'NPM_AUTH_TOKEN: "[REDACTED:password]"'],
      [`"githubToken": "${v}"`, '"githubToken": "[REDACTED:credential]"'],
      [`SECRET_KEY=django-insecure-${v}`, 'SECRET_KEY=[REDACTED:password]'],
      [`secret_key = "${v}"`, 'secret_key = "[REDACTED:password]"'],
      [`clientSecret: ${v}`, 'clientSecret: [REDACTED:password]'],
      [`MYAPP_API_KEY=${v}`, 'MYAPP_API_KEY=[REDACTED:password]'],
    ]
    for (const [input, want] of cases) expect(run(input).out).toBe(want)
  })

  test('hides hex secrets after a credential name, not a hash after `commit`', () => {
    const hex40 = 'a7c2'.repeat(10)
    const hex64 = 'a7c2'.repeat(16)
    expect(run(`SESSION_SECRET=${hex64}`).out).toBe('SESSION_SECRET=[REDACTED:password]')
    expect(run(`WEBHOOK_SECRET=${hex40}`).out).toBe('WEBHOOK_SECRET=[REDACTED:password]')
    expect(run(`password=${hex40}`).out).toBe('password=[REDACTED:password]')
    for (const s of [`commit ${hex40}`, `sha256 ${hex64}`, `git show ${hex40}`]) expect(run(s).out).toBe(s)
  })

  test('hides the values of the narrower key and password names', () => {
    const v = rnd(24)
    const cases: [string, string][] = [
      [`ENCRYPTION_KEY=${v}`, 'ENCRYPTION_KEY=[REDACTED:password]'],
      [`SIGNING_KEY: ${v}`, 'SIGNING_KEY: [REDACTED:password]'],
      [`MASTER_KEY=${v}`, 'MASTER_KEY=[REDACTED:password]'],
      [`APP_SESSION_KEY=${v}`, 'APP_SESSION_KEY=[REDACTED:password]'],
      [`PRIVATE_KEY=${v}`, 'PRIVATE_KEY=[REDACTED:credential]'],
      [`DB_PASS=${v}`, 'DB_PASS=[REDACTED:password]'],
      [`MYSQL_PWD=${v}`, 'MYSQL_PWD=[REDACTED:password]'],
      [`GPG_PASSPHRASE=${v}`, 'GPG_PASSPHRASE=[REDACTED:password]'],
      [`passphrase: ${v}`, 'passphrase: [REDACTED:password]'],
    ]
    for (const [input, want] of cases) expect(run(input).out).toBe(want)
  })

  test('leaves other *_KEY names, paths and ordinary assignments alone', () => {
    const samples = [
      'CACHE_KEY=v2-abc123',
      'CACHE_KEY=v2-abc123-def456',
      'PRIMARY_KEY=user_id2024',
      'SORT_KEY: created_at2',
      'OLD_PWD=/home/user/src2',
      'PROJECT_PWD="~/work/repo2"',
      'bypass=abc12345xyz',
      'const first_pass = compute(x1)',
      '"password": "Enter your password (min 8 chars)"',
      'password: "changeme"',
    ]
    for (const s of samples) expect(run(s).out).toBe(s)
  })

  test('hides values inside escaped JSON', () => {
    const v = rnd(24)
    // A JSON string holding JSON: {\"token\":\"...\"}
    expect(run(`{\\"token\\":\\"${v}\\"}`).out).toBe('{\\"token\\":\\"[REDACTED:credential]\\"}')
    // An AWS SecretString: "SecretString": "{\"password\":\"...\"}", itself escaped once more
    const once = `"SecretString": "{\\"password\\":\\"${v}\\",\\"user\\":\\"app\\"}"`
    expect(run(once).out).toBe('"SecretString": "{\\"password\\":\\"[REDACTED:password]\\",\\"user\\":\\"app\\"}"')
    const twice = `\\"SecretString\\": \\"{\\\\\\"password\\\\\\":\\\\\\"${v}\\\\\\"}\\"`
    expect(run(twice).out).not.toContain(v)
    expect(run(twice).out).toContain('[REDACTED:password]')
  })

  test('takes a quoted value whole, symbols and all', () => {
    const pw = part('Tr0ub', '4dor&3', '(x)')
    expect(run(`PASSWORD="${pw}"`).out).toBe('PASSWORD="[REDACTED:password]"')
    expect(run(`api_key: '${pw}|z'`).out).toBe("api_key: '[REDACTED:password]'")
    expect(run(`"githubToken": "${pw};x,y"`).out).toBe('"githubToken": "[REDACTED:credential]"')
    // Past 200 characters it is judged as an unquoted value, which a `(` rules out
    const long = `PASSWORD="${'a1('.repeat(80)}"`
    expect(run(long).out).toBe(long)
  })

  test('hides bearer tokens, auth headers and URL passwords', () => {
    const v = rnd(32)
    expect(run(`curl -H "Authorization: Bearer ${v}" x`).out).toBe(
      'curl -H "Authorization: Bearer [REDACTED:auth-header]" x',
    )
    expect(run(`-H 'Authorization: Basic ${rnd(16)}='`).out).toBe("-H 'Authorization: Basic [REDACTED:auth-header]'")
    expect(run(`token type bearer ${v}`).out).toBe('token type bearer [REDACTED:bearer]')
    const pw = part('s3', 'cr', 'et')
    expect(run(`postgres://app:${pw}@db.local:5432/x`).out).toBe('postgres://app:[REDACTED:url-password]@db.local:5432/x')
    expect(run(`redis://:${pwd}@cache.example.com:6379`).out).toBe('redis://:[REDACTED:url-password]@cache.example.com:6379')
    expect(run(`Authorization: Bearer ${part('abc123', 'def456', 'ghi789')}`).out).toBe(
      'Authorization: Bearer [REDACTED:auth-header]',
    )
  })

  test('leaves demo credentials alone, so compose files and READMEs round-trip', () => {
    const samples = [
      'DATABASE_URL=postgres://postgres:postgres@db:5432/app',
      'amqp://guest:guest@rabbit:5672/',
      'https://user:changeme@example.com',
      `postgres://app:${pwd}@localhost:5432/app`,
      `mysql://root:${pwd}@127.0.0.1/db`,
      'Authorization: Bearer YOUR_TOKEN_HERE',
      'Authorization: Basic CHANGE_ME_PLEASE',
    ]
    for (const s of samples) expect(run(s).out).toBe(s)
  })

  test('stays linear on long adversarial runs', () => {
    // Each of these took seconds with unanchored repetition; 80 KB must stay well under 200 ms
    const units = ['a-', 'a_', 'a+', 'a.', 'x9-', 'a://b:', 'Bearer ', 'TOKEN', 'password="', '\\"token\\":\\"', 'a_pass=', 'x\\\\\\']
    const inputs = [...units.map(u => u.repeat(Math.ceil(80000 / u.length))), `password="${'a1'.repeat(40000)}`]
    for (const s of inputs) {
      const t = Date.now()
      run(s)
      expect(Date.now() - t).toBeLessThan(200)
    }
  })

  test('leaves ordinary text and placeholders alone', () => {
    const samples = [
      'password = getpass()',
      'password: ${DB_PASSWORD}',
      'api_key=<your-key-here>',
      'token = process.env.TOKEN',
      'secret: ENC[AES256_GCM,data:abc123]',
      'commit 3f786850e387550fdab836ed7e6dc881de23001b',
      'the sk-learn package and ask-me-anything',
      'password=xxxxxxxx',
      'PATH=/usr/local/bin2:/usr/bin',
      'max_tokens: 4096',
      'input_tokens=12345678',
      'Authorization: Bearer ${TOKEN}',
      'the bearer of bad news arrived',
      'git@github.com:owner/repo.git',
      'https://example.com/path?x=1',
      'postgres://user:${DB_PASS}@host/db',
      'basic configuration2024 here',
    ]
    for (const s of samples) expect(run(s).out).toBe(s)
  })

  test('leaves code that names a secret alone, so edits still match', () => {
    const samples = [
      'const secret = config.secretKey2;',
      'apiKey: options.apiKey1,',
      'password: user.password2',
      'access_key = settings.AWS_ACCESS_KEY1',
      'const token = process.env.API_TOKEN2',
      'secret_key = secret_key_v2',
      'GITHUB_TOKEN: ctx.githubToken',
      'apiKey = readApiKey2',
    ]
    for (const s of samples) expect(run(s).out).toBe(s)
  })

  test('looksLikeCode', () => {
    expect(looksLikeCode('process.env.API_KEY2')).toBe(true)
    expect(looksLikeCode('secretKey')).toBe(true)
    expect(looksLikeCode('db_password1')).toBe(true)
    expect(looksLikeCode(pwd)).toBe(false)
    expect(looksLikeCode('hunter22')).toBe(false)
    expect(looksLikeCode(rnd(20))).toBe(false)
    expect(looksLikeCode(`a.${rnd(20)}`)).toBe(false)
  })

  test('walks tool_result blocks, string and nested', () => {
    const counts: Counts = {}
    const out = redactBlocks(
      [
        { type: 'tool_result', tool_use_id: 't1', content: `k ${awsKey}` },
        {
          type: 'tool_result',
          tool_use_id: 't2',
          content: [{ type: 'text', text: `k ${awsKey}` }],
        },
        { type: 'image', source: {} },
      ],
      counts,
    )
    expect(JSON.stringify(out)).not.toContain('AKIA')
    expect(out[0]?.tool_use_id).toBe('t1')
    expect(counts['aws-access-key']).toBe(2)
  })
})

test('prompt.submit rewrites the text and reports nothing else', ($, on) => {
  on('prompt.submit', ($$, e) => ({ text: e.text }))
  return $.prompt
    .submit({ text: `use ${awsKey}`, wait: false, origin: { kind: 'user' } } as never)
    .then(r => expect(r.text).toBe('use [REDACTED:aws-access-key]'))
})

test('a tool result is redacted before it is stored', async ($, on) => {
  const stored: string[] = []
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.append', ($$, e, next) => {
    stored.push(JSON.stringify(e.message))
    return next(e)
  })
  await $.session
    .append({
      door: 'tool-result',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: `GITHUB_TOKEN=${rnd(24)}` }] },
    } as never)
    .catch(() => undefined)
  expect(stored.join('')).toContain('[REDACTED:credential]')
  expect(stored.join('')).not.toContain(rnd(24))
})

test('`!` bash-mode output (the command door) is redacted before it is stored', async ($, on) => {
  const stored: string[] = []
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.append', ($$, e, next) => {
    stored.push(JSON.stringify(e.message))
    return next(e)
  })
  const v = rnd(24)
  await $.session
    .append({
      door: 'command',
      message: { type: 'user', role: 'user', content: [{ type: 'text', text: `<bash-stdout>GITHUB_TOKEN=${v}</bash-stdout>` }] },
    } as never)
    .catch(() => undefined)
  expect(stored.join('')).toContain('<bash-stdout>GITHUB_TOKEN=[REDACTED:credential]</bash-stdout>')
  expect(stored.join('')).not.toContain(v)
})

test('a row whose scan fails is withheld, its tool_use_id kept', async ($, on) => {
  const stored: unknown[] = []
  on('session.append', ($$, e, next) => {
    stored.push(e.message)
    return next(e)
  })
  const v = rnd(24)
  // A null block makes the scan throw
  await $.session
    .append({
      door: 'tool-result',
      message: {
        type: 'user',
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 't9', content: [{ type: 'text', text: `GITHUB_TOKEN=${v}` }, null] }],
      },
    } as never)
    .catch(() => undefined)
  const row = JSON.stringify(stored)
  expect(row).toContain('[redact: scan failed, content withheld]')
  expect(row).toContain('t9')
  expect(row).not.toContain(v)
})

describe('cookies', () => {
  const sid = part('Zx9', 'Qw8Er7', 'Ty6Ui5', 'Op4As3Df')
  test('hides credential values in Cookie and Set-Cookie headers, keeping names and attributes', () => {
    expect(run(`Cookie: theme=dark; session=${sid}; _ga=GA1.2.${rnd(12)}`).out).toBe(
      'Cookie: theme=dark; session=[REDACTED:cookie]; _ga=[REDACTED:cookie]',
    )
    const set = run(`set-cookie: id=${sid}; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; SameSite=Lax`)
    expect(set.out).toBe('set-cookie: id=[REDACTED:cookie]; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; SameSite=Lax')
    expect(set.counts['cookie']).toBe(1)
    // a curl header, a JSON header and one with escaped quotes
    expect(run(`curl -H 'Cookie: a=${sid}' https://x.test`).out).toBe("curl -H 'Cookie: a=[REDACTED:cookie]' https://x.test")
    expect(run(`{"cookie": "a=${sid}"}`).out).toBe('{"cookie": "a=[REDACTED:cookie]"}')
    expect(run(`{\\"Set-Cookie\\":\\"a=${sid}\\"}`).out).toContain('a=[REDACTED:cookie]')
  })

  test('hides session cookie values written outside a header', () => {
    for (const name of ['PHPSESSID', 'JSESSIONID', 'connect.sid', 'sessionid', 'session_id', 'laravel_session', '__Secure-next-auth.session-token']) {
      const { out, counts } = run(`-b '${name}=${sid}'`)
      expect(out).toBe(`-b '${name}=[REDACTED:cookie]'`)
      expect(counts['cookie']).toBe(1)
    }
  })

  test('leaves demo values, code, placeholders and unrelated names alone', () => {
    const same = [
      'Cookie: theme=dark; lang=en-GB',
      'Cookie: session=changeme',
      'Cookie: session=${SESSION}',
      'Cookie: session=config.sessionId',
      'Set-Cookie: a=[REDACTED:cookie]; Path=/',
      'Cookie: yes',
      'PHPSESSID=short1',
      'PHPSESSID=${PHPSESSID}',
      `my_sessionid=${sid}`,
      `subsessionid=${sid}`,
    ]
    for (const t of same) expect(run(t).out).toBe(t)
  })

  test('a long run of cookie-like text stays fast', () => {
    const t0 = Date.now()
    run(`Cookie: ${'a=;'.repeat(20000)}`)
    run('Set-Cookie'.repeat(5000))
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})

describe('redactDeep', () => {
  test('redacts every string in a record, keeping its shape', () => {
    const counts: Counts = {}
    const out = redactDeep({ stdout: `GITHUB_TOKEN=${rnd(24)}`, code: 0, n: [null, `k ${awsKey}`], f: { content: 'ok' } }, counts)
    expect(out).toEqual({ stdout: 'GITHUB_TOKEN=[REDACTED:credential]', code: 0, n: [null, 'k [REDACTED:aws-access-key]'], f: { content: 'ok' } })
    expect(total(counts)).toBe(2)
  })
  test('throws on a too-deep record, so the caller can withhold', () => {
    let v: unknown = 'x'
    for (let i = 0; i < 60; i++) v = { v }
    expect(() => redactDeep(v, {})).toThrow()
  })
})

test('a tool.call result record (toolUseResult) is redacted, the command left as run', { options: { denyInlineSecrets: 'off' } }, async ($, on) => {
  on('ui.toast', () => ({ value: undefined }) as never)
  const v = rnd(24)
  let ran = ''
  on('tool.call', ($$, e) => {
    ran = JSON.stringify(e)
    return { result: { stdout: `GITHUB_TOKEN=${v}`, stderr: '', interrupted: false } } as never
  })
  const r = await $.tool.call({ tool: 'Bash', command: `echo GITHUB_TOKEN=${v}` } as never)
  expect(JSON.stringify(r.result)).toContain('GITHUB_TOKEN=[REDACTED:credential]')
  expect(JSON.stringify(r.result)).not.toContain(v)
  // what executes is untouched
  expect(ran).toContain(v)
})

test('a clean tool.call result passes through unchanged', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'hello', stderr: '', interrupted: false } }) as never)
  const r = await $.tool.call({ tool: 'Bash', command: 'echo hello' } as never)
  expect(r.result).toEqual({ stdout: 'hello', stderr: '', interrupted: false })
})

test('a tool.call result that cannot be scanned is withheld', async ($, on) => {
  let deep: unknown = `GITHUB_TOKEN=${rnd(24)}`
  for (let i = 0; i < 60; i++) deep = { deep }
  on('tool.call', () => ({ result: deep }) as never)
  const r = await $.tool.call({ tool: 'Bash', command: 'true' } as never)
  expect(JSON.stringify(r)).not.toContain(rnd(24))
  expect(r.text ?? JSON.stringify(r)).toContain('withheld')
})

describe('withhold', () => {
  test('keeps the shape: ids, error flags and media, text replaced', () => {
    const out = withhold([
      { type: 'text', text: 'x' },
      { type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'y' },
      { type: 'image', source: {} },
      null,
    ])
    expect(out).toEqual([
      { type: 'text', text: WITHHELD },
      { type: 'tool_result', tool_use_id: 't1', is_error: true, content: [{ type: 'text', text: WITHHELD }] },
      { type: 'image', source: {} },
    ])
    expect(withhold('not blocks')).toEqual([{ type: 'text', text: WITHHELD }])
    expect(withhold([])).toEqual([{ type: 'text', text: WITHHELD }])
  })
})

describe('deny guard: findInlineSecrets', () => {
  const found = (e: Record<string, unknown>) => Object.keys(findInlineSecrets(e)).sort()
  const gh = part('gh', 'p_') + 'a1B2c3D4'.repeat(5)
  const aws = part('AK', 'IA', 'Q7ZK3M9X', 'WB4RT2HN')

  test('real-shaped credentials in a Bash command, Write or Edit content, and nested fields are found', () => {
    expect(found({ tool: 'Bash', command: `curl -H "Authorization: Bearer ${rnd(30)}" x` })).toEqual(['auth-header'])
    expect(found({ tool: 'Bash', command: `export GITHUB_TOKEN=${gh}` })).toEqual(['github-token'])
    expect(found({ tool: 'Write', file_path: 'a', content: `key=${aws}` })).toEqual(['aws-access-key'])
    expect(found({ tool: 'Edit', old_string: 'x', new_string: `API_KEY="${rnd(24)}"` })).toEqual(['password'])
    expect(found({ tool: 'NotebookEdit', new_source: `t = "${part('xo', 'xb-', '8401729563', '-Kq7ZmW3xRt')}"` })).toEqual(['slack-token'])
    expect(found({ tool: 'mcp__x__y', args: { deep: [{ pem }] } })).toEqual(['private-key'])
    expect(found({ tool: 'Bash', command: `psql postgres://app:${rnd(20)}@db.example.com/x` })).toEqual(['url-password'])
  })

  test('values built at run time never put the whole literal in the text', () => {
    const cmds = [
      `export GITHUB_TOKEN="$(printf '%s%s' ghp_ "$(head -c 27 /dev/urandom | base64)")"`,
      `TOKEN="gh""p_$(openssl rand -hex 18)"; curl -H "Authorization: Bearer $TOKEN" x`,
      'export API_KEY=$(cat ~/.secrets/key)',
      'curl -H "Authorization: Bearer ${MY_TOKEN}" https://x',
      `node -e 'const t = "gh" + "p_" + "a".repeat(36); run(t)'`,
      'gh auth token && echo $GITHUB_TOKEN',
    ]
    for (const command of cmds) expect(found({ tool: 'Bash', command })).toEqual([])
  })

  test('obvious fakes, placeholders, demo and local values pass', () => {
    const same = [
      `token = ${part('gh', 'p_')}${'a'.repeat(36)}`,
      `token = ${part('gh', 'p_')}${'x'.repeat(36)}`,
      `key ${part('AK', 'IAIOSFODNN7', 'EXAMPLE')}`,
      `GITHUB_TOKEN=${part('fake', '-token-', 'value-1234567890')}`,
      'API_KEY=your-api-key-here-1234',
      'PASSWORD=changeme-123456789012',
      'API_KEY=YOUR_TOKEN_HERE',
      'postgres://postgres:postgres@localhost/db',
      `postgres://app:${rnd(20)}@localhost:5432/db`,
      'const k = process.env.API_KEY2',
      `PASSWORD=${rnd(12)}`,
      `commit ${'0123abcd'.repeat(5)}`,
      `Cookie: theme=dark; a=${rnd(10)}`,
    ]
    for (const command of same) expect(found({ tool: 'Bash', command })).toEqual([])
  })

  test('the marker must name the kind, and exempts only that kind', () => {
    const cmd = `export GITHUB_TOKEN=${gh} AWS=${aws}`
    expect(found({ tool: 'Bash', command: cmd })).toEqual(['aws-access-key', 'github-token'])
    expect(found({ tool: 'Bash', command: `${cmd} # redact-allow: github-token` })).toEqual(['aws-access-key'])
    expect(found({ tool: 'Bash', command: `${cmd} # redact-allow: github-token, aws-access-key` })).toEqual([])
    // a bare or wrong-kind marker, or one in prose, does nothing
    expect(found({ tool: 'Bash', command: `${cmd} # redact-allow` })).toHaveLength(2)
    expect(found({ tool: 'Bash', command: `${cmd} # redact-allow: jwt` })).toHaveLength(2)
    expect(found({ tool: 'Bash', command: `${cmd} # redact-allow: all` })).toHaveLength(2)
    expect([...allowedKinds(['a redact-allow: jwt,  npm-token\nx'])].sort()).toEqual(['jwt', 'npm-token'])
  })

  test('the tool envelope is not scanned, and a call without strings is clean', () => {
    expect(found({ tool: 'Bash', tool_use_id: gh, agentId: gh, requestMeta: { a: gh }, command: 'ls' })).toEqual([])
    expect(found({ tool: 'TodoWrite', n: 3, flag: true, list: [null, 4] })).toEqual([])
  })

  test('the deny message names the kinds and never the value', () => {
    const counts = findInlineSecrets({ tool: 'Bash', command: `export GITHUB_TOKEN=${gh}` })
    const m = denyMessage('Bash', counts)
    expect(m).toContain('github-token')
    expect(m).toContain('redact-allow: github-token')
    expect(m).not.toContain(gh)
  })

  test('a too-deep input throws (the hook turns that into pass-through); big input is capped and fast', () => {
    let v: unknown = 'x'
    for (let i = 0; i < 60; i++) v = { v }
    expect(() => inputStrings({ tool: 'Bash', v })).toThrow()
    const t0 = Date.now()
    const big = 'a-'.repeat(2_000_000)
    expect(inputStrings({ command: big }).join('').length).toBeLessThanOrEqual(512 * 1024)
    findInlineSecrets({ tool: 'Bash', command: big })
    findInlineSecrets({ tool: 'Bash', command: `x ${'password:'.repeat(20000)} ${gh}` })
    expect(Date.now() - t0).toBeLessThan(4000)
  })

  test('modeOf defaults to deny', () => {
    expect([modeOf(undefined), modeOf('warn'), modeOf('off'), modeOf('deny'), modeOf('nope')]).toEqual(['deny', 'warn', 'off', 'deny', 'deny'])
  })
})

describe('deny guard: tool.call hook', () => {
  const gh = part('gh', 'p_') + 'a1B2c3D4'.repeat(5)

  test('denies a call that inlines a secret, before the tool runs', async ($, on) => {
    on('ui.toast', () => ({ value: undefined }) as never)
    let ran = false
    on('tool.call', () => {
      ran = true
      return { result: { stdout: '', stderr: '', interrupted: false } } as never
    })
    const r = await $.tool.call({ tool: 'Bash', command: `export GITHUB_TOKEN=${gh}` } as never)
    expect(ran).toBe(false)
    expect(r.deny).toContain('github-token')
    expect(r.deny).not.toContain(gh)
  })

  test('runs a call that builds the token at run time or carries the marker', async ($, on) => {
    on('ui.toast', () => ({ value: undefined }) as never)
    on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)
    const a = await $.tool.call({ tool: 'Bash', command: 'export GITHUB_TOKEN="gh""p_$(openssl rand -hex 18)"' } as never)
    const b = await $.tool.call({ tool: 'Bash', command: `export GITHUB_TOKEN=${gh} # redact-allow: github-token` } as never)
    expect(a.deny).toBeUndefined()
    expect(b.deny).toBeUndefined()
    expect(JSON.stringify(b.result)).toContain('ok')
  })

  test('a read-only search tool is not scanned', async ($, on) => {
    on('tool.call', () => ({ result: { filenames: [], numFiles: 0 } }) as never)
    const r = await $.tool.call({ tool: 'Grep', pattern: gh } as never)
    expect(r.deny).toBeUndefined()
  })

  test('warn mode runs the call and says so', { options: { denyInlineSecrets: 'warn' } }, async ($, on) => {
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(JSON.stringify(e))
      return { value: undefined } as never
    })
    on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)
    const r = await $.tool.call({ tool: 'Bash', command: `export GITHUB_TOKEN=${gh}` } as never)
    expect(r.deny).toBeUndefined()
    expect(toasts.join('')).toContain('github-token')
    expect(toasts.join('')).not.toContain(gh)
  })

  test('off mode does nothing', { options: { denyInlineSecrets: 'off' } }, async ($, on) => {
    on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)
    const r = await $.tool.call({ tool: 'Bash', command: `export GITHUB_TOKEN=${gh}` } as never)
    expect(r.deny).toBeUndefined()
  })

  test('an input the scanner cannot walk passes through', async ($, on) => {
    on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)
    let v: unknown = 'x'
    for (let i = 0; i < 60; i++) v = { v }
    const r = await $.tool.call({ tool: 'mcp__x__y', v } as never)
    expect(r.deny).toBeUndefined()
  })
})
