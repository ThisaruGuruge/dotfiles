import type { On } from 'claude-code'

export type Held = Record<string, { value: unknown; version: number }>

// The test's `$` has no state noun: tests answer `$.state` from memory and read
// what the plugin wrote from the returned record, keyed `plugin.key`.
export function memoryState(on: On): Held {
  const held: Held = {}
  on('state.get', async (_$, e) => ({
    value: held[`${e.plugin}.${e.key}`] ?? { value: undefined, version: 0 },
  }))
  on('state.set', async (_$, e) => {
    const name = `${e.plugin}.${e.key}`
    const version = held[name]?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) {
      return { value: { isSet: false as const, version } }
    }
    held[name] = { value: e.value, version: version + 1 }

    return { value: { isSet: true as const, version: version + 1 } }
  })

  return held
}

export function files(on: On, held: Record<string, string>): void {
  on('fs.stat', async (_$, e, next) =>
    e.path in held
      ? {
          value: {
            kind: 'file' as const,
            size: held[e.path]?.length ?? 0,
            mtimeMs: 0,
            isLink: false,
          },
        }
      : next(e),
  )
  on('fs.read', async (_$, e, next) => (e.path in held ? { value: held[e.path] ?? '' } : next(e)))
}

export function core(on: On): void {
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('classic.Stop', async () => ({}))
}
