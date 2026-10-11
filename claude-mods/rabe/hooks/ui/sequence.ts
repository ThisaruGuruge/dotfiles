let tail = Promise.resolve()

export function reserve(): <T>(run: () => Promise<T>) => Promise<T> {
  const previous = tail
  let release!: () => void
  const turn = new Promise<void>(resolve => {
    release = resolve
  })
  tail = previous.then(
    () => turn,
    () => turn,
  )

  return async run => {
    try {
      await previous
      return await run()
    } finally {
      release()
    }
  }
}

export function sequence<T>(run: () => Promise<T>): Promise<T> {
  const result = tail.then(run, run)
  tail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
