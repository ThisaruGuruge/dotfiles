export type RabeItemKind = 'agent' | 'workflow' | 'codex' | 'shell' | 'monitor' | 'cron'

export type RabeItemStatus = 'running' | 'done' | 'failed' | 'stopped'

export type RabeTokens = { input: number; output: number; cached?: number }

// How a file changed: an Edit or Write call, a write guessed from a shell
// command line, or a Codex file change. Absent: an Edit or Write.
export type RabeEditVia = 'edit' | 'write' | 'shell' | 'codex'

export type RabeEdit = {
  path: string
  at: number
  via?: RabeEditVia
  change?: 'add' | 'update' | 'delete'
}

// A Bash call of an agent that ran the Codex plugin's companion script
// (`task`, `review`, `adversarial-review`): when it started and returned, its
// command line (cut), and the job or thread its output named.
export type RabeCodexCall = {
  at: number
  command: 'task' | 'review' | 'adversarial-review'
  text: string
  endedAt?: number
  jobId?: string
  threadId?: string
}

export type RabeAgentDetail = {
  agentId: string
  name?: string
  type?: string
  model?: string
  description?: string
  prompt?: string
  transcriptPath?: string
  cwd?: string
  worktreePath?: string
  worktreeBranch?: string
  workflowPhase?: string
  workflowIndex?: number
  toolCount?: number
  lastTool?: string
  lastToolAt?: number
  edits?: RabeEdit[]
  codexCalls?: RabeCodexCall[]
}

export type RabeWorkflowDetail = {
  runId: string
  taskId?: string
  scriptPath?: string
  transcriptDir?: string
  phases?: string[]
}

export type RabeCodexStep = {
  kind: 'message' | 'reasoning' | 'command'
  text: string
  exitCode?: number
  lines?: number
  isRunning?: boolean
}

export type RabeCodexDetail = {
  jobId: string
  jobKind?: string
  threadId?: string
  model?: string
  effort?: string
  sandbox?: string
  prompt?: string
  workspaceRoot?: string
  logPath?: string
  sessionPath?: string
  sessionUpdatedAt?: number
  isSessionMissing?: boolean
  isSessionPartial?: boolean
  commandCount?: number
  steps?: RabeCodexStep[]
  edits?: RabeEdit[]
}

export type RabeShellDetail = {
  command: string
  taskId?: string
  outputPath?: string
  exitCode?: number
  port?: number
  // When Rabe found the port; orders the Effects tab's ports found since the open.
  portAt?: number
}

export type RabeMonitorDetail = {
  command: string
  description?: string
  taskId?: string
  outputPath?: string
  timeoutMs?: number
  isPersistent?: boolean
}

export type RabeCronDetail = {
  jobId: string
  prompt: string
  schedule?: string
  humanSchedule?: string
  scheduledFor?: number
  isDeleted?: boolean
}

export type RabeItemDetails = {
  agent: RabeAgentDetail
  workflow: RabeWorkflowDetail
  codex: RabeCodexDetail
  shell: RabeShellDetail
  monitor: RabeMonitorDetail
  cron: RabeCronDetail
}

export type RabeItemOf<K extends RabeItemKind> = {
  id: string
  kind: K
  title: string
  status: RabeItemStatus
  seenAt: number
  startedAt?: number
  endedAt?: number
  parentId?: string
  tokens?: RabeTokens
  costUsd?: number
  detail: RabeItemDetails[K]
}

export type RabeItem = { [K in RabeItemKind]: RabeItemOf<K> }[RabeItemKind]

export type RabeToolUse = { name: string; summary?: string }

export type RabeTurn = { index: number; at: number; text: string; tools: RabeToolUse[] }

export type RabeTab = 'items' | 'cost' | 'effects' | 'timeline'

export type RabeLine = { at: number; text: string }

export type RabeLines = { seen: number; lines: RabeLine[] }

// Item ids per list (a group of the Items tab, `cost`, `timeline`) in the
// order the pane showed them when it opened.
export type RabeOrder = Record<string, string[]>

export type RabePrevious = {
  // What `claude --resume` takes; absent in summaries before Rabe 0.4.
  sessionId?: string
  endedAt: number
  startedAt?: number
  counts: Partial<Record<RabeItemKind, number>>
  tokens: number
  usd?: number
  failed: string[]
}

// A git worktree from `git worktree list --porcelain`: the first one listed
// is the main worktree (`isMain`); bare entries are left out.
export type RabeWorktree = {
  path: string
  branch?: string
  isDetached?: boolean
  isMain?: boolean
}

// The Timeline tab's window for the open pane: `base` hours from the option
// `timelineHours`, `hours` the step shown now (0: the whole session) and
// `since` its start in ms (0: none). `since` stays put while the pane is
// open, so no row folds away under the focus.
export type RabeWindow = { base: number; hours: number; since: number }

declare module 'claude-code' {
  interface PluginState {
    rabe: {
      items: RabeItem[]
      tab: RabeTab
      turns: Record<string, RabeTurn[]>
      lines: Record<string, RabeLines>
      query: string
      folded: string[]
      selected: string
      open: string
      order: RabeOrder
      // The files the main session changed (no agent), newest last.
      edits: RabeEdit[]
      // The ids of ended items the person removed from the views this session.
      removed: string[]
      // The repository's git worktrees; absent without git.
      worktrees: RabeWorktree[]
      window: RabeWindow
      // Successful actions from the pane, for the next main-session prompt.
      actions: string[]
    }
  }
}
