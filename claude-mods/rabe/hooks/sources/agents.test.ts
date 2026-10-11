import type { AgentSpawnInput, AgentStatus, FsStat, On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import type { RabeEdit } from '../../types'
import type { RabeItem, RabeItemOf, RabeTurn } from '../model'
import { MAX_ENDED } from '../registry'
import { core, memoryState } from '../testing'
import { addTurn, agentTranscript, metaPatch, metaPath, toolSummary } from './agents'

const SPAWN: AgentSpawnInput = {
  tool_use_id: 'toolu_1',
  prompt: 'Verify the pool',
  description: 'verify:db.ts',
  subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: true,
  fork: false,
  workflow: { runId: 'wf_1', agentIndex: 5 },
}

const agent: RabeItem = {
  id: 'agent:a1',
  kind: 'agent',
  title: 'verify:db.ts',
  status: 'running',
  seenAt: 5000,
  startedAt: 5000,
  detail: { agentId: 'a1' },
}

const turn = (index: number): RabeTurn => ({ index, at: index, text: `t${index}`, tools: [] })

type Held = { items?: RabeItem[]; turns?: Record<string, RabeTurn[]>; edits?: RabeEdit[] }

function watch(on: On): Held {
  const held: Held = {}
  on('state.set', async (_$, e, next) => {
    if (e.plugin === 'rabe' && e.key === 'items') held.items = e.value as RabeItem[]
    if (e.plugin === 'rabe' && e.key === 'turns') held.turns = e.value as Held['turns']
    if (e.plugin === 'rabe' && e.key === 'edits') held.edits = e.value as RabeEdit[]

    return next(e)
  })

  return held
}

function engine(on: On, agentId: string): Held {
  mock.clock(on, { now: 5000 })
  on('agent.spawn', async () => ({ model: 'claude-opus-5-5', agentId }))
  on('classic.SubagentStart', async () => ({}))
  on('turn.complete', async () => ({ text: '' }))

  return watch(on)
}

test('the tool summary is the first useful argument on one short line', () => {
  expect(toolSummary({ file_path: 'src/db.ts' })).toBe('src/db.ts')
  expect(toolSummary({ command: 'bun test\necho done' })).toBe('bun test')
  expect(toolSummary({ pattern: 'release\\(', path: 'src/' })).toBe('release\\(')
  expect(toolSummary({ command: 'x'.repeat(200) })).toHaveLength(80)
  expect(toolSummary({ command: 'x'.repeat(200) })).toBe(`${'x'.repeat(79)}…`)
  expect(toolSummary({ command: 'x'.repeat(80) })).toBe('x'.repeat(80))
  const long = `/home/me/app/${'deep/'.repeat(20)}a.ts`
  expect(toolSummary({ file_path: long })).toBe(long)
  expect(toolSummary({ other: 1 })).toBeUndefined()
  expect(toolSummary(null)).toBeUndefined()
})

test('the meta file gives worktree, branch and phase, and bad text gives nothing', () => {
  const text = JSON.stringify({
    worktreePath: '/wt/a1',
    worktreeBranch: 'agent-a1',
    workflowPhase: 'Verify',
    agentType: 'workflow-subagent',
    cwd: '/wt/a1',
  })
  expect(metaPatch(text)).toEqual({
    cwd: '/wt/a1',
    worktreePath: '/wt/a1',
    worktreeBranch: 'agent-a1',
    workflowPhase: 'Verify',
  })
  expect(metaPatch('{"spawnDepth":1}')).toEqual({})
  expect(metaPatch('not json')).toBeUndefined()
})

test('the meta path comes from the transcript or the parent workflow folder', () => {
  const withTranscript = {
    ...agent,
    detail: { agentId: 'a1', transcriptPath: '/s/agent-a1.jsonl' },
  }
  expect(metaPath(withTranscript, [])).toBe('/s/agent-a1.meta.json')

  const run: RabeItem = {
    id: 'workflow:wf_1',
    kind: 'workflow',
    title: 'review',
    status: 'running',
    seenAt: 1,
    detail: {
      runId: 'wf_1',
      transcriptDir: '/s/subagents/workflows/wf_1',
      scriptPath: '/s/workflows/scripts/review.js',
    },
  }
  const child = { ...agent, parentId: 'workflow:wf_1' }
  expect(metaPath(child, [run])).toBe('/s/subagents/workflows/wf_1/agent-a1.meta.json')
  const workflowChild = {
    ...child,
    detail: { agentId: 'a1', transcriptPath: '/s/agent-a1.jsonl' },
  }
  expect(metaPath(workflowChild, [run])).toBe('/s/subagents/workflows/wf_1/agent-a1.meta.json')
  const unknownDirectory = { ...run, detail: { runId: 'wf_1' } }
  expect(metaPath(workflowChild, [unknownDirectory])).toBe('/s/agent-a1.meta.json')
  const withoutTranscriptDir = {
    ...run,
    detail: { runId: 'wf_1', scriptPath: '/s/workflows/scripts/review.js' },
  }
  expect(metaPath(child, [withoutTranscriptDir])).toBe(
    '/s/subagents/workflows/wf_1/agent-a1.meta.json',
  )
  expect(metaPath(agent, [run])).toBeUndefined()
})

test('the agent transcript sits in the session folder unless the hook names it', () => {
  expect(agentTranscript('/p/s1.jsonl', 'a1')).toBe('/p/s1/subagents/agent-a1.jsonl')
  expect(agentTranscript('/p/s1/subagents/agent-a1.jsonl', 'a1')).toBe(
    '/p/s1/subagents/agent-a1.jsonl',
  )
  expect(agentTranscript('', 'a1')).toBeUndefined()
})

test('turns keep the newest per item', () => {
  let turns: Record<string, RabeTurn[]> = { 'agent:a2': [turn(1)] }
  for (let index = 1; index <= 32; index++) turns = addTurn(turns, 'agent:a1', turn(index))
  expect(Object.keys(turns)).toEqual(['agent:a2', 'agent:a1'])
  expect(turns['agent:a1']).toHaveLength(30)
  expect(turns['agent:a1']?.[0]?.index).toBe(3)
})

test('a spawn adds a running agent under its workflow', async ($, on) => {
  const held = engine(on, 'a1')
  await $.agent.spawn(SPAWN)
  expect(held.items).toEqual([
    {
      ...agent,
      parentId: 'workflow:wf_1',
      detail: {
        agentId: 'a1',
        type: 'general-purpose',
        model: 'claude-opus-5-5',
        description: 'verify:db.ts',
        prompt: 'Verify the pool',
        workflowIndex: 5,
      },
    },
  ])
})

test('agent answers keep up to 16000 characters and mark a cut', async ($, on) => {
  const held = engine(on, 'a1')
  // biome-ignore lint/correctness/useYield: the engine's stand-in answers without chunks
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'x'.repeat([500, 16000, 16001, 50000][e.index] ?? 0),
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        model: 'claude-opus-5-5',
      },
    }
  })
  await $.agent.spawn(SPAWN)
  for (const index of [0, 1, 2, 3]) {
    const stream = $.turn.step({ turnId: 't1', index, model: 'm', messageCount: 1, agentId: 'a1' })
    for await (const _ of stream);
  }
  expect(held.turns?.['agent:a1']?.map(turn => turn.text)).toEqual([
    'x'.repeat(500),
    'x'.repeat(16000),
    `${'x'.repeat(15999)}…`,
    `${'x'.repeat(15999)}…`,
  ])
})

test('a spawn from another agent names that agent as parent', async ($, on) => {
  const held = engine(on, 'a2')
  await $.agent.spawn({ ...SPAWN, workflow: undefined, parentAgentId: 'a1' })
  expect(held.items?.[0]?.parentId).toBe('agent:a1')
})

test('a refused spawn adds nothing', async ($, on) => {
  const held = watch(on)
  on('agent.spawn', async () => ({ deny: 'no' }))
  await $.agent.spawn(SPAWN).catch(() => undefined)
  expect(held.items).toBeUndefined()
})

// Another cwd may be a worktree or a plain subfolder; only the meta file or
// git tells, so the start event gives the cwd alone.
test('subagent start sets the transcript and the cwd, never a worktree', async ($, on) => {
  const held = engine(on, 'a1')
  on('session.cwd', async () => ({ value: '/repo' }))
  await $.agent.spawn(SPAWN)
  for (const cwd of ['/repo/.claude/worktrees/a1', '/repo/packages/api']) {
    await $.classic.SubagentStart({
      agent_id: 'a1',
      agent_type: 'general-purpose',
      cwd,
      transcript_path: '/p/s1.jsonl',
    })
    expect(held.items?.[0]?.detail).toMatchObject({
      transcriptPath: '/p/s1/subagents/agent-a1.jsonl',
      cwd,
    })
    expect(held.items?.[0]?.detail).not.toHaveProperty('worktreePath')
  }
})

test('SubagentStart during the spawn keeps the transcript once the spawn adds the item', async ($, on) => {
  const held = watch(on)
  mock.clock(on, { now: 5000 })
  on('session.cwd', async () => ({ value: '/repo' }))
  on('classic.SubagentStart', async () => ({}))
  on('agent.spawn', async () => {
    await $.classic.SubagentStart({
      agent_id: 'a1',
      agent_type: 'general-purpose',
      cwd: '/repo',
      transcript_path: '/p/s1.jsonl',
    })

    return { model: 'claude-opus-5-5', agentId: 'a1' }
  })
  await $.agent.spawn({ ...SPAWN, workflow: undefined })
  expect(held.items).toHaveLength(1)
  expect(held.items?.[0]).toMatchObject({
    title: 'verify:db.ts',
    detail: { agentId: 'a1', transcriptPath: '/p/s1/subagents/agent-a1.jsonl', cwd: '/repo' },
  })
})

test('a workflow spawn moves its transcript into the run directory', async ($, on) => {
  const held = watch(on)
  mock.clock(on, { now: 5000 })
  on('classic.SubagentStart', async () => ({}))
  on('agent.spawn', async () => {
    await $.classic.SubagentStart({
      agent_id: 'a1',
      agent_type: 'workflow-subagent',
      transcript_path: '/p/s1.jsonl',
    })

    return { model: 'claude-opus-5-5', agentId: 'a1' }
  })
  await $.agent.spawn(SPAWN)

  expect(held.items?.[0]).toMatchObject({
    parentId: 'workflow:wf_1',
    detail: { transcriptPath: '/p/s1/subagents/workflows/wf_1/agent-a1.jsonl' },
  })
})

test('a step adds tokens, tools and a turn; the end of the run ends the agent', async ($, on) => {
  const held = engine(on, 'a1')
  // biome-ignore lint/correctness/useYield: the engine's stand-in answers without chunks
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'Reading the pool.',
      toolUses: [{ name: 'Read', input: { file_path: 'src/db.ts' } }],
      stopReason: 'tool_use' as const,
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 10,
        model: 'claude-opus-5-5',
      },
    }
  })
  await $.agent.spawn(SPAWN)
  for (let step = 0; step < 2; step++) {
    const stream = $.turn.step({
      turnId: 't1',
      index: step,
      model: 'm',
      messageCount: 1,
      agentId: 'a1',
    })
    for await (const _ of stream);
  }
  await $.turn.complete({
    answer: 'done',
    durationMs: 10,
    isAborted: false,
    turnId: 't1',
    agentId: 'a1',
    reason: 'answer',
  })

  const [item] = held.items ?? []
  expect(item).toMatchObject({
    status: 'done',
    endedAt: 5000,
    tokens: { input: 320, output: 40, cached: 100 },
    detail: { toolCount: 2, lastTool: 'Read', lastToolAt: 5000 },
  })
  expect(held.turns?.['agent:a1']).toEqual([
    {
      index: 1,
      at: 5000,
      text: 'Reading the pool.',
      tools: [{ name: 'Read', summary: 'src/db.ts' }],
    },
    {
      index: 2,
      at: 5000,
      text: 'Reading the pool.',
      tools: [{ name: 'Read', summary: 'src/db.ts' }],
    },
  ])
})

test('an edit the engine ran is kept on its agent; a refused or failed one is not', async ($, on) => {
  const held = engine(on, 'a1')
  on('tool.call', { tool: ['Edit', 'Write'] }, async (_$, e) => {
    if (e.tool === 'Edit' && e.file_path.endsWith('denied.ts')) return { deny: 'no' }
    if (e.tool === 'Write' && e.file_path.endsWith('failed.ts')) {
      return { result: { error: 'x' } as never, isError: true }
    }

    return { result: {} as never }
  })
  await $.agent.spawn(SPAWN)
  const edit = (file_path: string, agentId?: string) =>
    $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b', agentId } as never)
  await edit('/repo/db.ts', 'a1')
  await edit('/repo/denied.ts', 'a1')
  await edit('/repo/main.ts')
  await $.tool.call({
    tool: 'Write',
    file_path: '/repo/failed.ts',
    content: '',
    agentId: 'a1',
  } as never)
  await $.tool.call({
    tool: 'Write',
    file_path: '/repo/new.ts',
    content: '',
    agentId: 'a1',
  } as never)
  const item = held.items?.[0] as RabeItemOf<'agent'>
  expect(item.detail.edits).toEqual([
    { path: '/repo/db.ts', at: 5000, via: 'edit' },
    { path: '/repo/new.ts', at: 5000, via: 'write' },
  ])
  expect(held.edits).toEqual([{ path: '/repo/main.ts', at: 5000, via: 'edit' }])
})

type Disk = Map<string, FsStat>
type Effect = (disk: Disk) => void

const file = (size: number, mtimeMs = 1): FsStat => ({ kind: 'file', size, mtimeMs, isLink: false })
const dir: FsStat = { kind: 'dir', size: 0, mtimeMs: 1, isLink: false }
// A file whose folder the command made unreadable: its stat fails with EACCES.
const LOCKED = file(-1)
// A file a hook hides: its stat is denied with a message that ends in ENOENT.
const SPOOFED = file(-2)
// a file stat may not look at (a folder without x) while the folder still lists it
const UNREAD = file(-3)
const hidden = (stat: FsStat | undefined) => stat === LOCKED || stat === SPOOFED

// A fake shell on a fake disk: each command changes the disk as `effects` says.
// A Bash call the engine ran has a result, no error and is not in the background.
function shell(on: On, effects: Record<string, Effect> = {}): { disk: Disk; stats: string[] } {
  mock.env(on, { HOME: '/home/u' })
  const disk: Disk = new Map([
    ['/tmp', dir],
    ['/home/u', dir],
  ])
  const stats: string[] = []
  on('fs.stat', async (_$, e) => {
    stats.push(e.path)
    const found = disk.get(e.path)
    if (found === SPOOFED) return { deny: `rabe: $.fs.stat: access denied: /work/ENOENT` }
    if (found === UNREAD) return { deny: 'EACCES' }
    if (e.path.includes('locked') || found === LOCKED) return { deny: 'EACCES' }
    if (e.path.includes('hang')) return new Promise<never>(() => {})
    return found ? { value: found } : { deny: 'ENOENT' }
  })
  // a folder exists when it or a path below it is on the disk
  on('fs.list', async (_$, e) => {
    const prefix = e.path === '/' ? '/' : `${e.path}/`
    const below = [...disk].filter(([path]) => path.startsWith(prefix))
    const inside = (path: string) => !path.slice(prefix.length).includes('/')
    if (e.path.includes('locked') || below.some(([path, stat]) => inside(path) && hidden(stat))) {
      return { deny: 'EACCES' }
    }
    if (disk.get(e.path)?.kind === 'file') return { deny: 'ENOTDIR' }
    if (e.path !== '/' && !disk.has(e.path) && below.length === 0) return { deny: 'ENOENT' }
    const names = new Set(below.map(([path]) => path.slice(prefix.length).split('/')[0] as string))
    return {
      value: [...names].map(name => ({
        name,
        kind: 'file' as const,
        size: 0,
        mtimeMs: 0,
        isLink: false,
      })),
    }
  })
  // the runtime answers false for a path it may not look at
  on('fs.exists', async (_$, e) => ({ value: disk.has(e.path) && !hidden(disk.get(e.path)) }))
  on('tool.call', { tool: 'Bash' }, async (_$, e) => {
    const command = e.tool === 'Bash' ? e.command : ''
    effects[command]?.(disk)
    if (command.includes('fail'))
      return { result: { stdout: '', stderr: 'x' } as never, isError: true }
    if (command.includes('deny')) return { deny: 'no' }
    if (command.includes('serve')) {
      return { result: { stdout: '', stderr: '', backgroundTaskId: 'b1' } as never }
    }

    return { result: { stdout: '', stderr: '', interrupted: false } as never }
  })

  return { disk, stats }
}

const HEREDOC = "cat > ~/.agents/skills/demo/SKILL.md <<'EOF'\n# demo > x\nEOF\nrm /tmp/old.md"

test('OR writes count only when the candidate changed on disk', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  on('session.cwd', async () => ({ value: '/repo' }))
  const { disk } = shell(on, {
    'false || echo x > /tmp/f.txt': one => one.set('/tmp/f.txt', file(2)),
  })
  disk.set('/tmp/kept.txt', file(2))
  await $.tool.call({ tool: 'Bash', command: 'false || echo x > /tmp/f.txt' } as never)
  await $.tool.call({ tool: 'Bash', command: 'true || echo x > /tmp/kept.txt' } as never)
  expect(held.edits).toEqual([{ path: '/tmp/f.txt', at: 5000, via: 'shell' }])
})

test('shell calls read the current folder only for relative candidates', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  let reads = 0
  on('session.cwd', async () => {
    reads++
    return { value: '/repo' }
  })
  shell(on, {
    'touch /tmp/f.txt': one => one.set('/tmp/f.txt', file(2)),
    'cd /known && touch f.txt': one => one.set('/known/f.txt', file(2)),
  })
  for (const command of [
    'true',
    'touch /tmp/f.txt',
    'cd /known && touch f.txt',
    'true || pushd /x; touch rel',
    'true || popd; touch rel',
  ]) {
    await $.tool.call({ tool: 'Bash', command } as never)
  }
  expect(reads).toBe(0)
  expect(held.edits).toEqual([
    { path: '/tmp/f.txt', at: 5000, via: 'shell' },
    { path: '/known/f.txt', at: 5000, via: 'shell' },
  ])
})

test('relative shell writes use the main session current folder', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  let cwd = '/repo'
  on('session.cwd', async () => ({ value: cwd }))
  const { disk } = shell(on, {
    'echo x > f.txt': one => one.set('/repo/f.txt', file(2)),
    'false || echo x > f.txt': one => one.set('/other/f.txt', file(2)),
    'cd "$UNKNOWN"; echo x > skipped.txt': one => one.set('/other/skipped.txt', file(2)),
  })
  disk.set('/repo', dir)
  disk.set('/other', dir)
  await $.tool.call({ tool: 'Bash', command: 'echo x > f.txt' } as never)
  cwd = '/other'
  await $.tool.call({ tool: 'Bash', command: 'false || echo x > f.txt' } as never)
  await $.tool.call({ tool: 'Bash', command: 'true || echo x > f.txt' } as never)
  await $.tool.call({ tool: 'Bash', command: 'cd "$UNKNOWN"; echo x > skipped.txt' } as never)
  expect(held.edits).toEqual([
    { path: '/repo/f.txt', at: 5000, via: 'shell' },
    { path: '/other/f.txt', at: 5000, via: 'shell' },
  ])
})

test('relative shell writes use the agent cwd and never the main folder as a fallback', async ($, on) => {
  const held = engine(on, 'a1')
  on('session.cwd', async () => ({ value: '/repo' }))
  const { disk } = shell(on, {
    'echo x > f.txt': one => one.set('/repo/f.txt', file(2)),
    'echo x > plain.txt': one => one.set('/wt/a1/plain.txt', file(2)),
    'false || echo x > f.txt': one => one.set('/wt/a1/f.txt', file(2)),
  })
  disk.set('/repo', dir)
  disk.set('/wt/a1', dir)
  await $.agent.spawn(SPAWN)
  await $.tool.call({ tool: 'Bash', command: 'echo x > f.txt', agentId: 'a1' } as never)
  expect((held.items?.[0] as RabeItemOf<'agent'>).detail.edits).toBeUndefined()
  await $.classic.SubagentStart({
    agent_id: 'a1',
    agent_type: 'general-purpose',
    cwd: '/wt/a1',
    transcript_path: '/p/s1.jsonl',
  })
  await $.tool.call({ tool: 'Bash', command: 'echo x > plain.txt', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'false || echo x > f.txt', agentId: 'a1' } as never)
  expect((held.items?.[0] as RabeItemOf<'agent'>).detail.edits).toEqual([
    { path: '/wt/a1/plain.txt', at: 5000, via: 'shell' },
    { path: '/wt/a1/f.txt', at: 5000, via: 'shell' },
  ])
  expect(held.edits).toBeUndefined()
})

test('an unknown main folder skips relative paths but still checks absolute paths', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  on('session.cwd', async () => ({ deny: 'unknown folder' }))
  const { stats } = shell(on, {
    'echo x > f.txt': one => one.set('/repo/f.txt', file(2)),
    'echo x > /tmp/f.txt': one => one.set('/tmp/f.txt', file(2)),
  })
  await $.tool.call({ tool: 'Bash', command: 'echo x > f.txt' } as never)
  expect(stats).toEqual([])
  await $.tool.call({ tool: 'Bash', command: 'echo x > /tmp/f.txt' } as never)
  expect(held.edits).toEqual([{ path: '/tmp/f.txt', at: 5000, via: 'shell' }])
})

test('a background teammate writing files through Bash shows them as shell edits', async ($, on) => {
  const held = engine(on, 'a1')
  const { disk } = shell(on, {
    [HEREDOC]: one => {
      one.set('/home/u/.agents/skills/demo/SKILL.md', file(9))
      one.delete('/tmp/old.md')
    },
    'echo x > /tmp/failed.md && fail': one => one.set('/tmp/failed.md', file(2)),
    'echo x > /tmp/denied.md # deny': one => one.set('/tmp/denied.md', file(2)),
    'echo x > /tmp/serve.log; serve': one => one.set('/tmp/serve.log', file(2)),
  })
  disk.set('/tmp/old.md', file(3))
  await $.agent.spawn({ ...SPAWN, workflow: undefined })
  const run = (command: string) => $.tool.call({ tool: 'Bash', command, agentId: 'a1' } as never)
  await run(HEREDOC)
  await run('echo x > /tmp/failed.md && fail')
  await run('echo x > /tmp/denied.md # deny')
  await run('echo x > /tmp/serve.log; serve')
  await run('git status')
  const item = held.items?.[0] as RabeItemOf<'agent'>
  expect(item.detail.edits).toEqual([
    { path: '/home/u/.agents/skills/demo/SKILL.md', at: 5000, via: 'shell' },
    { path: '/tmp/old.md', at: 5000, via: 'shell', change: 'delete' },
  ])
})

test('the disk decides: masked failures, no-op modes, a folder target, multi-file sed', async ($, on) => {
  const held = engine(on, 'a1')
  const { disk } = shell(on, {
    'cp /tmp/src.txt /tmp/out': one => one.set('/tmp/out/src.txt', file(4)),
    "sed -i 'q' /tmp/a /tmp/b": one => one.set('/tmp/a', file(5, 2)),
    'export HOME=/tmp; touch ~/file': one => one.set('/tmp/file', file(0)),
  })
  disk.set('/tmp/src.txt', file(4))
  disk.set('/tmp/out', dir)
  disk.set('/tmp/a', file(5))
  disk.set('/tmp/b', file(5))
  await $.agent.spawn({ ...SPAWN, workflow: undefined })
  const run = (command: string) => $.tool.call({ tool: 'Bash', command, agentId: 'a1' } as never)
  await run('false && touch /tmp/never || true')
  await run('cp /tmp/missing /tmp/copy; true')
  await run('touch -c /tmp/absent')
  await run('rm -f /tmp/absent')
  await run('cp /tmp/src.txt /tmp/out')
  await run("sed -i 'q' /tmp/a /tmp/b")
  await run('export HOME=/tmp; touch ~/file')
  const item = held.items?.[0] as RabeItemOf<'agent'>
  expect(item.detail.edits).toEqual([
    { path: '/tmp/out/src.txt', at: 5000, via: 'shell' },
    { path: '/tmp/a', at: 5000, via: 'shell' },
  ])
})

test('too many candidates, stat errors and slow stats record nothing for those files', async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const held = watch(on)
  const many = Array.from({ length: 21 }, (_, n) => `/tmp/f${n}`).join(' ')
  const { disk, stats } = shell(on, {
    [`touch ${many}`]: one => {
      for (let n = 0; n < 21; n++) one.set(`/tmp/f${n}`, file(0))
    },
    'touch /tmp/locked /tmp/ok': one => one.set('/tmp/ok', file(0)),
    'touch /tmp/hang /tmp/slow': one => one.set('/tmp/slow', file(0)),
    'touch /tmp/private/f; chmod 000 /tmp/private': one => one.set('/tmp/private/f', LOCKED),
  })
  disk.set('/tmp/private/f', file(3))
  await $.tool.call({ tool: 'Bash', command: `touch ${many}` } as never)
  expect(stats).toEqual([])
  await $.tool.call({ tool: 'Bash', command: 'touch /tmp/locked /tmp/ok' } as never)
  const slow = $.tool.call({ tool: 'Bash', command: 'touch /tmp/hang /tmp/slow' } as never)
  await clock.advance(1000)
  await slow
  await $.tool.call({
    tool: 'Bash',
    command: 'touch /tmp/private/f; chmod 000 /tmp/private',
  } as never)
  expect(held.edits).toEqual([{ path: '/tmp/ok', at: 5000, via: 'shell' }])
})

test('a path is missing only when its folder lists without it', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  const { disk } = shell(on, {
    'rm /tmp/hidden/a': one => one.set('/tmp/hidden/a', SPOOFED),
    'rm /tmp/plain; mkdir /tmp/plain; touch /tmp/plain/f': one => {
      one.delete('/tmp/plain')
      one.set('/tmp/plain/f', file(0))
    },
    'touch /tmp/gone': one => one.set('/tmp/gone', file(0)),
    'mkdir -p /tmp/new/deep; touch /tmp/new/deep/f': one => one.set('/tmp/new/deep/f', file(0)),
  })
  disk.set('/tmp/hidden/a', file(3))
  disk.set('/tmp/plain', file(1))
  const run = (command: string) => $.tool.call({ tool: 'Bash', command } as never)
  await run('rm /tmp/hidden/a')
  await run('rm /tmp/plain; mkdir /tmp/plain; touch /tmp/plain/f')
  await run('touch /tmp/gone')
  await run('mkdir -p /tmp/new/deep; touch /tmp/new/deep/f')
  expect(held.edits).toEqual([
    { path: '/tmp/gone', at: 5000, via: 'shell' },
    { path: '/tmp/new/deep/f', at: 5000, via: 'shell' },
  ])
})

test('a name the folder lists in another case is unknown, not missing', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  const { disk } = shell(on, {
    // a case-insensitive disk: report.txt is Report.txt, and stat may no longer look at it
    'chmod 600 /tmp/box; rm /tmp/box/report.txt': one => {
      one.delete('/tmp/box/report.txt')
      one.set('/tmp/box/Report.txt', UNREAD)
    },
  })
  disk.set('/tmp/box/report.txt', file(3))
  await $.tool.call({
    tool: 'Bash',
    command: 'chmod 600 /tmp/box; rm /tmp/box/report.txt',
  } as never)
  expect(held.edits ?? []).toEqual([])
})

test('a name the folder lists in another Unicode form is unknown, not missing', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const held = watch(on)
  const composed = '/tmp/box/caf\u00e9.txt'
  const decomposed = '/tmp/box/cafe\u0301.txt'
  const { disk } = shell(on, {
    // the disk keeps the decomposed name; stat may no longer look at it
    [`chmod 600 /tmp/box; rm ${composed}`]: one => {
      one.delete(composed)
      one.set(decomposed, UNREAD)
    },
  })
  disk.set(composed, file(3))
  await $.tool.call({ tool: 'Bash', command: `chmod 600 /tmp/box; rm ${composed}` } as never)
  expect(held.edits ?? []).toEqual([])
})

test('main session writes and shell writes are kept apart from agents', async ($, on) => {
  const held = engine(on, 'a1')
  shell(on, {
    'echo x >> notes.txt': one => one.set('notes.txt', file(2)),
    'echo x > /tmp/main.md': one => one.set('/tmp/main.md', file(2)),
  })
  on('tool.call', { tool: 'Write' }, async () => ({
    result: { filePath: '/repo/plan.md' } as never,
  }))
  await $.tool.call({ tool: 'Write', file_path: '/repo/plan.md', content: '' } as never)
  await $.tool.call({ tool: 'Bash', command: 'echo x >> notes.txt' } as never)
  await $.tool.call({ tool: 'Bash', command: 'echo x > /tmp/main.md' } as never)
  expect(held.edits).toEqual([
    { path: '/repo/plan.md', at: 5000, via: 'write' },
    { path: '/tmp/main.md', at: 5000, via: 'shell' },
  ])
  expect(held.items ?? []).toEqual([])
})

test('a staged edit or write leaves the file unchanged and is not kept', async ($, on) => {
  const held = engine(on, 'a1')
  on('tool.call', { tool: ['Edit', 'Write'] }, async (_$, e) => {
    const filePath = e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : ''

    return { result: { filePath, staged: filePath.includes('staged') } as never }
  })
  await $.agent.spawn(SPAWN)
  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/staged.ts',
    old_string: 'a',
    new_string: 'b',
    agentId: 'a1',
  } as never)
  await $.tool.call({
    tool: 'Write',
    file_path: '/repo/staged-new.ts',
    content: '',
    agentId: 'a1',
  } as never)
  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/db.ts',
    old_string: 'a',
    new_string: 'b',
    agentId: 'a1',
  } as never)
  const item = held.items?.[0] as RabeItemOf<'agent'>
  expect(item.detail.edits).toEqual([{ path: '/repo/db.ts', at: 5000, via: 'edit' }])
})

test('a step of a loop Rabe does not know writes nothing', async ($, on) => {
  const held = watch(on)
  // biome-ignore lint/correctness/useYield: the engine's stand-in answers without chunks
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'x',
      toolUses: [],
      stopReason: null,
      usage: null,
    }
  })
  for await (const _ of $.turn.step({
    turnId: 't',
    index: 0,
    model: 'm',
    messageCount: 1,
    agentId: 'fork',
  }));
  expect(held.items).toBeUndefined()
})

test('the poll adds listed agents and reads the meta file of running ones', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const held = watch(on)
  on('session.start', async () => ({ cwd: '/p' }))
  on('command.register', async () => ({ value: { command: 'rabe' } }))
  on('classic.SubagentStart', async () => ({}))
  on('agent.list', async () => ({
    value: [
      {
        id: 'a1',
        name: 'impl-logger',
        description: 'migrate logger',
        type: 'Explore',
        status: 'running' as const,
      },
      { id: 'a2', description: 'plan', type: 'Plan', status: 'completed' as const, parentId: 'a1' },
    ],
  }))
  on('fs.read', async (_$, e) =>
    e.path === '/p/s1/subagents/agent-a1.meta.json'
      ? { value: '{"worktreePath":"/wt/a1","worktreeBranch":"wt-a1"}' }
      : { deny: 'missing' },
  )
  on('session.cwd', async () => ({ value: '/p' }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.classic.SubagentStart({
    agent_id: 'a1',
    agent_type: 'Explore',
    transcript_path: '/p/s1.jsonl',
  })
  await clock.advance(3000)

  const list = held.items ?? []
  expect(list.map(one => [one.id, one.status, one.parentId])).toEqual([
    ['agent:a1', 'running', undefined],
    ['agent:a2', 'done', 'agent:a1'],
  ])
  expect(list[0]?.detail).toMatchObject({ worktreePath: '/wt/a1', worktreeBranch: 'wt-a1' })
  expect(list[0]).toMatchObject({ title: 'impl-logger', detail: { name: 'impl-logger' } })
})

test('the poll reads phase metadata for workflow agents that already ended', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  const workflow: RabeItem = {
    id: 'workflow:wf_1',
    kind: 'workflow',
    title: 'review',
    status: 'done',
    seenAt: 900,
    endedAt: 900,
    detail: { runId: 'wf_1', scriptPath: '/p/workflows/scripts/wf_1.js', phases: ['Draft'] },
  }
  const endedAgent: RabeItem = {
    ...agent,
    status: 'done',
    endedAt: 900,
    parentId: workflow.id,
  }
  state['rabe.items'] = { value: [workflow, endedAgent], version: 1 }
  core(on)
  on('agent.list', async () => ({
    value: [{ id: 'a1', description: 'draft', type: 'workflow-subagent', status: 'completed' }],
  }))
  on('fs.read', async (_$, e) =>
    e.path === '/p/subagents/workflows/wf_1/agent-a1.meta.json'
      ? { value: '{"workflowPhase":"Draft"}' }
      : { deny: 'missing' },
  )

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  expect(state['rabe.items']?.value).toEqual([
    workflow,
    { ...endedAgent, detail: { ...endedAgent.detail, workflowPhase: 'Draft' } },
  ])
  const written = state['rabe.items']
  await clock.advance(3000)
  expect(state['rabe.items']).toBe(written)
})

test('the poll stops retrying ended workflow agents when the workflow has no phases', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  const workflow: RabeItem = {
    id: 'workflow:wf_1',
    kind: 'workflow',
    title: 'review',
    status: 'done',
    seenAt: 900,
    detail: { runId: 'wf_1', scriptPath: '/p/workflows/scripts/wf_1.js', phases: [] },
  }
  state['rabe.items'] = {
    value: [workflow, { ...agent, status: 'done', endedAt: 900, parentId: workflow.id }],
    version: 1,
  }
  core(on)
  on('agent.list', async () => ({ value: [] }))
  const reads: string[] = []
  on('fs.read', async (_$, e) => {
    reads.push(e.path)
    return { deny: 'missing' }
  })

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(3000)

  expect(reads).toEqual([])
})

function completed(count: number) {
  return Array.from({ length: count }, (_, n) => ({
    id: `a${n}`,
    description: `a${n}`,
    type: 'Explore',
    status: 'completed' as const,
  }))
}

function ended(count: number, from = 0): RabeItem[] {
  return Array.from({ length: count }, (_, n) => ({
    id: `agent:w${n + from}`,
    kind: 'agent',
    title: `w${n + from}`,
    status: 'done',
    seenAt: 10 + n,
    endedAt: 10 + n,
    detail: { agentId: `w${n + from}` },
  }))
}

for (const count of [MAX_ENDED + 1, 1201, 5000]) {
  test(`an unchanged poll of ${count} completed agents writes nothing after the first`, async ($, on) => {
    const clock = mock.clock(on, { now: 1000 })
    const state = memoryState(on)
    core(on)
    on('agent.list', async () => ({ value: completed(count) }))
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
    const first = state['rabe.items']
    expect(first?.version).toBe(1)
    expect(first?.value).toHaveLength(MAX_ENDED)

    await clock.advance(3000)
    await clock.advance(3000)
    expect(state['rabe.items']).toBe(first)
  })
}

test('listed agents Rabe did not watch never push out the history it watched', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  state['rabe.items'] = { value: ended(MAX_ENDED - 50), version: 1 }
  core(on)
  on('agent.list', async () => ({ value: completed(1201) }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const items = state['rabe.items']?.value as RabeItem[]
  expect(items.slice(0, MAX_ENDED - 50)).toEqual(ended(MAX_ENDED - 50))
  expect(items.slice(MAX_ENDED - 50).map(item => item.id)).toEqual(
    completed(50).map(one => `agent:${one.id}`),
  )
  const first = state['rabe.items']
  await clock.advance(3000)
  expect(state['rabe.items']).toBe(first)
})

test('a poll that ends an agent drops the turns and lines of what the cap pushes out', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  const running: RabeItem = { ...agent, id: 'agent:r', detail: { agentId: 'r' } }
  state['rabe.items'] = { value: [...ended(MAX_ENDED), running], version: 1 }
  const lines = { seen: 1, lines: [{ at: 1, text: 'ready' }] }
  state['rabe.lines'] = { value: { 'agent:w0': lines, 'agent:w1': lines }, version: 1 }
  state['rabe.turns'] = { value: { 'agent:w0': [turn(1)], 'agent:w1': [turn(1)] }, version: 1 }
  core(on)
  let listed: { id: string; description: string; type: string; status: AgentStatus }[] = []
  on('agent.list', async () => ({ value: listed }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  // The timer's poll ends agent r: the oldest ended agent, w0, leaves with its state.
  listed = [{ id: 'r', description: 'r', type: 'Explore', status: 'completed' }]
  await clock.advance(3000)
  const items = state['rabe.items']?.value as RabeItem[]
  expect(items.some(item => item.id === 'agent:w0')).toBe(false)
  expect(state['rabe.turns']?.value).toEqual({ 'agent:w1': [turn(1)] })
  expect(state['rabe.lines']?.value).toEqual({ 'agent:w1': lines })
})

test('a poll that lists an ended agent as running again puts it back to running', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  const done: RabeItem = { ...agent, status: 'done', endedAt: 900 }
  state['rabe.items'] = { value: [done], version: 1 }
  core(on)
  let status: AgentStatus = 'idle'
  on('agent.list', async () => ({
    value: [{ id: 'a1', description: 'verify:db.ts', type: 'Explore', status }],
  }))
  // A teammate is idle after each turn, which already ended its item.
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(state['rabe.items']?.value).toEqual([done])

  status = 'running'
  await clock.advance(3000)
  expect(state['rabe.items']?.value).toEqual([{ ...agent, status: 'running' }])
})

test('an agent the cap dropped comes back when the list shows it running', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  core(on)
  let listed: { id: string; description: string; type: string; status: AgentStatus }[] =
    completed(5000)
  on('agent.list', async () => ({ value: listed }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect((state['rabe.items']?.value as RabeItem[]).some(item => item.id === 'agent:a4000')).toBe(
    false,
  )

  listed = listed.map(one => (one.id === 'a4000' ? { ...one, status: 'running' } : one))
  await clock.advance(3000)
  const items = state['rabe.items']?.value as RabeItem[]
  expect(items.find(item => item.id === 'agent:a4000')?.status).toBe('running')
  expect(items).toHaveLength(MAX_ENDED + 1)
})

const PRICES = [
  '# test prices',
  'provider,model,aliases,input,output,cache_read,cache_write_5m',
  'claude,claude-opus-5-5,,4,20,0.2,5',
].join('\n')

// The plugin's own table and the user's files, as fs.read answers them.
function priceFiles(on: On, own: Record<string, string> = {}): string[] {
  const asked: string[] = []
  on('fs.read', async (_$, e, next) => {
    asked.push(e.path)
    if (e.path.endsWith('/data/prices.csv')) return { value: PRICES }
    if (e.path in own) return { value: own[e.path] ?? '' }
    return next(e)
  })

  return asked
}

// The engine's stand-in for a step per model, registered before the test's first call on `$`.
function stepper(on: On, models: string[]) {
  // biome-ignore lint/correctness/useYield: the engine's stand-in answers without chunks
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 10,
        model: models[e.index] ?? '',
      },
    }
  })

  return async ($: Engine) => {
    for (let index = 0; index < models.length; index++) {
      const stream = $.turn.step({
        turnId: 't1',
        index,
        model: 'm',
        messageCount: 1,
        agentId: 'a1',
      })
      for await (const _ of stream);
    }
  }
}

// 100 in at 4, 50 read at 0.2, 10 written at 5, 20 out at 20, per million
const STEP_USD = (100 * 4 + 50 * 0.2 + 10 * 5 + 20 * 20) / 1e6

test('each step adds its price to the agent cost', async ($, on) => {
  const held = engine(on, 'a1')
  const asked = priceFiles(on)
  const run = stepper(on, ['claude-opus-5-5', 'claude-opus-5-5'])
  await $.agent.spawn(SPAWN)
  await run($)
  expect(held.items?.[0]?.costUsd).toBe(2 * STEP_USD)
  expect(asked.every(path => path.endsWith('/data/prices.csv'))).toBe(true)
})

test('a step of a model without a price leaves the agent cost n/a for good', async ($, on) => {
  const held = engine(on, 'a1')
  priceFiles(on)
  const run = stepper(on, ['claude-opus-5-5', 'claude-new-9', 'claude-opus-5-5'])
  await $.agent.spawn(SPAWN)
  await run($)
  expect(held.items?.[0]?.tokens).toMatchObject({ output: 60 })
  expect(held.items?.[0]?.costUsd).toBeUndefined()
})

test('an agent Rabe did not see start has no cost', async ($, on) => {
  const state = memoryState(on)
  mock.clock(on, { now: 5000 })
  priceFiles(on)
  const run = stepper(on, ['claude-opus-5-5'])
  state['rabe.items'] = { value: [{ ...agent, startedAt: undefined }], version: 1 }
  await run($)
  const [item] = state['rabe.items'].value as RabeItem[]
  expect(item?.tokens).toMatchObject({ output: 20 })
  expect(item?.costUsd).toBeUndefined()
})

test(
  "the user's price file comes first",
  { options: { pricesFile: '~/prices.csv' } },
  async ($, on) => {
    const held = engine(on, 'a1')
    mock.env(on, { HOME: '/home/u' })
    priceFiles(on, {
      '/home/u/prices.csv': 'provider,model,input,output\nclaude,claude-opus-5-5,1,1\n',
    })
    const run = stepper(on, ['claude-opus-5-5'])
    await $.agent.spawn(SPAWN)
    await run($)
    expect(held.items?.[0]?.costUsd).toBe(180 / 1e6)
  },
)

test(
  'a price file that cannot be read makes the cost n/a',
  { options: { pricesFile: '/gone.csv' } },
  async ($, on) => {
    const held = engine(on, 'a1')
    priceFiles(on)
    const run = stepper(on, ['claude-opus-5-5'])
    await $.agent.spawn(SPAWN)
    await run($)
    expect(held.items?.[0]?.tokens).toBeDefined()
    expect(held.items?.[0]?.costUsd).toBeUndefined()
  },
)
const COMPANION = 'node "/p/codex/1.0.6/scripts/codex-companion.mjs" task --write'

test("an agent's companion calls keep their start, end and the job or thread they named", async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const state = memoryState(on)
  mock.env(on, { HOME: '/home/u' })
  on('agent.spawn', async () => ({ model: 'claude-sonnet-5-5', agentId: 'f1' }))
  on('tool.call', { tool: 'Bash' }, async (_$, e) => {
    const command = e.tool === 'Bash' ? e.command : ''
    await clock.advance(700)
    if (command.includes('"bg"')) {
      const stdout = 'Codex Task started in the background as task-mg1-ab. Check /codex:status.\n'
      return { result: { stdout, stderr: '', interrupted: false } as never }
    }
    if (command.includes('"long"')) {
      return { result: { stdout: '', stderr: '', backgroundTaskId: 'b7' } as never }
    }
    if (command.includes('"deny"')) return { deny: 'no' }
    if (command.includes('"oops"')) {
      const stderr = '[codex] Thread ready (th-8).\nTurn failed.'
      return { result: { stdout: '', stderr } as never, isError: true }
    }
    const stderr = '[codex] Starting Codex task thread.\n[codex] Thread ready (th-9).\n'
    return { result: { stdout: 'Fixed.', stderr, interrupted: false } as never }
  })
  await $.agent.spawn({ ...SPAWN, workflow: undefined })
  const run = (command: string, agentId?: string) =>
    $.tool.call({ tool: 'Bash', command, ...(agentId && { agentId }) } as never)
  await run(`${COMPANION} "fg"`, 'f1')
  await run(`${COMPANION} "bg"`, 'f1')
  await run(`${COMPANION} "long"`, 'f1')
  await run(`${COMPANION} "deny"`, 'f1')
  await run(`${COMPANION} "oops"`, 'f1')
  await run(`${COMPANION} "main"`)
  await run('git status', 'f1')
  const [item] = state['rabe.items']?.value as RabeItemOf<'agent'>[]
  expect(item?.detail.codexCalls).toEqual([
    { at: 5000, command: 'task', text: `${COMPANION} "fg"`, endedAt: 5700, threadId: 'th-9' },
    { at: 5700, command: 'task', text: `${COMPANION} "bg"`, endedAt: 6400, jobId: 'task-mg1-ab' },
    { at: 6400, command: 'task', text: `${COMPANION} "long"` },
    { at: 7100, command: 'task', text: `${COMPANION} "deny"`, endedAt: 7800 },
    { at: 7800, command: 'task', text: `${COMPANION} "oops"`, endedAt: 8500, threadId: 'th-8' },
  ])
})
