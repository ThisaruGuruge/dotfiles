import type { RabeLines } from '../types'
import type { EndStatus, RabeItem } from './model'

export const MAX_LINES = 200

export type Notification = {
  taskId: string
  status?: string
  outputFile?: string
  exitCode?: number
}

export type Output = { lines: string[]; exitCode?: number; ended?: EndStatus }

function tag(block: string, name: string): string | undefined {
  return block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() || undefined
}

function exitCodeOf(text: string | undefined): number | undefined {
  const code = text?.match(/exit code (\d+)/)?.[1]

  return code === undefined ? undefined : Number(code)
}

export function parseNotifications(text: string): Notification[] {
  return [...text.matchAll(/<task-notification>([\s\S]*?)<\/task-notification>/g)].flatMap(
    ([, block = '']) => {
      const taskId = tag(block, 'task-id')
      if (!taskId) return []
      const status = tag(block, 'status')
      const outputFile = tag(block, 'output-file')
      const exitCode = exitCodeOf(tag(block, 'summary'))

      return [
        {
          taskId,
          ...(status && { status }),
          ...(outputFile && { outputFile }),
          ...(exitCode !== undefined && { exitCode }),
        },
      ]
    },
  )
}

export function endStatus(status: string | undefined, exitCode?: number): EndStatus {
  if (status === 'failed' || (exitCode !== undefined && exitCode !== 0)) return 'failed'
  if (status === 'killed' || status === 'stopped') return 'stopped'

  return 'done'
}

export function outputPathOf(text: string | undefined): string | undefined {
  return text?.match(/Output is being written to: (\S+?\.output)\b/)?.[1]
}

export function siblingOutput(path: string, taskId: string): string | undefined {
  return /\/tasks\/[^/]+\.output$/.test(path)
    ? path.replace(/[^/]+\.output$/, `${taskId}.output`)
    : undefined
}

export function taskOutput(items: RabeItem[], taskId: string): string | undefined {
  for (const item of items) {
    const path = 'outputPath' in item.detail ? item.detail.outputPath : undefined
    const sibling = path && siblingOutput(path, taskId)
    if (sibling) return sibling
  }

  return undefined
}

export function parseOutput(text: string): Output {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const last = lines.at(-1)
  const code = last?.match(/^\[exited with code (\d+)\]$/)?.[1]
  const isKilled = last === '[killed]'
  if (code === undefined && !isKilled) return { lines }
  lines.pop()
  if (lines.at(-1) === '') lines.pop()
  if (isKilled) return { lines, ended: 'stopped' }
  const exitCode = Number(code)

  return { lines, exitCode, ended: endStatus('completed', exitCode) }
}

export function guessPort(text: string): number | undefined {
  const match =
    text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})\b/) ??
    text.match(/\bport (\d{2,5})\b/i)
  const port = Number(match?.[1])

  return port > 0 && port < 65536 ? port : undefined
}

export function appendLines(
  held: RabeLines | undefined,
  lines: string[],
  now: number,
  max = MAX_LINES,
): RabeLines | undefined {
  const seen = held?.seen ?? 0
  const kept = held?.lines ?? []
  // The last line read may have been cut mid-write; it keeps its time.
  const last = kept.at(-1)
  const grown = last && seen > 0 && lines[seen - 1] !== undefined && lines[seen - 1] !== last.text
  if (lines.length <= seen && !grown) return undefined
  const head = grown
    ? [...kept.slice(0, -1), { at: last.at, text: lines[seen - 1] as string }]
    : kept
  const fresh = lines.slice(seen).map(text => ({ at: now, text }))

  return { seen: lines.length, lines: [...head, ...fresh].slice(-max) }
}
