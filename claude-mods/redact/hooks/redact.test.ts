import { describe, expect, test } from 'claude-code/testing'

import { looksLikeCode, redactBlocks, redactText } from './patterns'
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
    const inputs = ['a-', 'a_', 'a+', 'a.', 'x9-', 'a://b:', 'Bearer ', 'TOKEN'].map(u => u.repeat(Math.ceil(80000 / u.length)))
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
