import { expect, test } from 'claude-code/testing'

import {
  appendLines,
  endStatus,
  guessPort,
  outputPathOf,
  parseNotifications,
  parseOutput,
  siblingOutput,
  taskOutput,
} from './tasks'

const DIR = '/tmp/claude-1004/-home-me-app/5f1c/tasks'

test('a line still being written is updated once it is complete', () => {
  const first = appendLines(undefined, ['hel'], 10)
  expect(appendLines(first, ['hello'], 20)).toEqual({ seen: 1, lines: [{ at: 10, text: 'hello' }] })
  expect(appendLines(first, ['hello', 'world'], 20)).toEqual({
    seen: 2,
    lines: [
      { at: 10, text: 'hello' },
      { at: 20, text: 'world' },
    ],
  })
})

test('a notification gives task id, status, output file and exit code', () => {
  const text = `<task-notification>
<task-id>bi7ug3at2</task-id>
<tool-use-id>toolu_01</tool-use-id>
<output-file>${DIR}/bi7ug3at2.output</output-file>
<status>failed</status>
<summary>Background command "Run lint" failed with exit code 3</summary>
</task-notification>`
  expect(parseNotifications(text)).toEqual([
    {
      taskId: 'bi7ug3at2',
      status: 'failed',
      outputFile: `${DIR}/bi7ug3at2.output`,
      exitCode: 3,
    },
  ])
})

test('several notifications in one text, events without a status kept apart', () => {
  const text = `<task-notification>
<task-id>m1</task-id>
<summary>Monitor event: "ticks"</summary>
<event>tick 1</event>
</task-notification>
<task-notification>
<task-id>m1</task-id>
<status>completed</status>
<summary>Monitor "ticks" stream ended</summary>
</task-notification>`
  expect(parseNotifications(text)).toEqual([
    { taskId: 'm1' },
    { taskId: 'm1', status: 'completed' },
  ])
})

test('text without a notification gives none', () => {
  expect(parseNotifications('hello <task-id>x</task-id>')).toEqual([])
})

test('end status from the notification word and the exit code', () => {
  expect(endStatus('completed')).toBe('done')
  expect(endStatus('completed', 1)).toBe('failed')
  expect(endStatus('failed')).toBe('failed')
  expect(endStatus('killed')).toBe('stopped')
  expect(endStatus('something new')).toBe('done')
})

test('the output path comes from the Bash result text', () => {
  const text = `Command running in background with ID: b1. Output is being written to: ${DIR}/b1.output. If it exits while you are still working you will be notified.`
  expect(outputPathOf(text)).toBe(`${DIR}/b1.output`)
  expect(outputPathOf('done')).toBeUndefined()
})

test('a sibling output path swaps the task id', () => {
  expect(siblingOutput(`${DIR}/b1.output`, 'm9')).toBe(`${DIR}/m9.output`)
  expect(siblingOutput('/elsewhere/file.txt', 'm9')).toBeUndefined()
})

test('a task output path is built beside one Rabe already knows', () => {
  const shell = {
    id: 'shell:b1',
    kind: 'shell' as const,
    title: 'x',
    status: 'done' as const,
    seenAt: 1,
    detail: { command: 'x', outputPath: `${DIR}/b1.output` },
  }
  expect(taskOutput([shell], 'm9')).toBe(`${DIR}/m9.output`)
  expect(taskOutput([], 'm9')).toBeUndefined()
})

test('output splits into lines and reads the exit line', () => {
  expect(parseOutput('hello\nworld\n\n[exited with code 3]\n')).toEqual({
    lines: ['hello', 'world'],
    exitCode: 3,
    ended: 'failed',
  })
  expect(parseOutput('a\n\n[exited with code 0]\n')).toEqual({
    lines: ['a'],
    exitCode: 0,
    ended: 'done',
  })
  expect(parseOutput('\n[killed]\n')).toEqual({ lines: [], ended: 'stopped' })
  expect(parseOutput('still going\npartial')).toEqual({ lines: ['still going', 'partial'] })
  expect(parseOutput('')).toEqual({ lines: [] })
})

test('a port is guessed from a local address in the output', () => {
  expect(guessPort('  VITE ready\n  ➜  Local:   http://localhost:5173/\n')).toBe(5173)
  expect(guessPort('listening on 127.0.0.1:8080')).toBe(8080)
  expect(guessPort('Server at http://0.0.0.0:3000')).toBe(3000)
  expect(guessPort('Listening on port 4000')).toBe(4000)
  expect(guessPort('took 12:30 minutes')).toBeUndefined()
  expect(guessPort('localhost:99999')).toBeUndefined()
})

test('new output lines get the time they were received, oldest dropped past the cap', () => {
  const first = appendLines(undefined, ['a', 'b'], 10)
  expect(first).toEqual({
    seen: 2,
    lines: [
      { at: 10, text: 'a' },
      { at: 10, text: 'b' },
    ],
  })
  expect(appendLines(first, ['a', 'b'], 20)).toBeUndefined()
  expect(appendLines(first, ['a', 'b', 'c'], 20, 2)).toEqual({
    seen: 3,
    lines: [
      { at: 10, text: 'b' },
      { at: 20, text: 'c' },
    ],
  })
})
