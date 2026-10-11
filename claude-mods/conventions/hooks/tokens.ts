/**
 * Token-shaped literals: the distinctive, prefix-anchored rules of the redact
 * mod (claude-mods/redact/hooks/patterns.ts), copied because a mod cannot
 * import from outside its own folder. Keep the two lists in step. The
 * contextual rules there (`password=`, `Bearer`, URL passwords) are left out:
 * a fixture may name a demo credential, but a value shaped like a real token
 * trips secret scanners even when it is fake.
 */
const RULES: { kind: string; re: RegExp }[] = [
  { kind: 'private-key', re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/ },
  { kind: 'age-key', re: /AGE-SECRET-KEY-1[A-Z0-9]{50,}/ },
  { kind: 'aws-access-key', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { kind: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/ },
  { kind: 'github-token', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { kind: 'gitlab-token', re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { kind: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36,}\b/ },
  { kind: 'huggingface-token', re: /\bhf_[A-Za-z0-9]{30,}\b/ },
  { kind: 'stripe-key', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { kind: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: 'api-key', re: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{32,}/ },
  { kind: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { kind: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
]

export type TokenHit = { kind: string; line: number }

/** Every line holding a token-shaped literal, with the first kind it matched. */
export function findTokens(text: string): TokenHit[] {
  const hits: TokenHit[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const rule = RULES.find(r => r.re.test(line))
    if (rule) hits.push({ kind: rule.kind, line: i + 1 })
  }
  return hits
}
