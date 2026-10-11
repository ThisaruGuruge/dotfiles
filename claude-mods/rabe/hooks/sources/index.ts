import type { On } from 'claude-code'

import { agents } from './agents'
import { codex } from './codex'
import { crons } from './crons'
import { monitors } from './monitors'
import { shells } from './shells'
import { workflows } from './workflows'
import { worktrees } from './worktrees'

export type Source = (on: On) => void

// `file`: the user's price table (option `pricesFile`), '' for none.
export function sources(on: On, file: string): void {
  agents(on, file)
  workflows(on)
  codex(on, file)
  shells(on)
  monitors(on)
  crons(on)
  worktrees(on)
}
