import { describe, expect, test } from 'claude-code/testing'

import { redactBlocks, redactText } from './patterns'
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
    ]
    for (const s of samples) expect(run(s).out).toBe(s)
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
