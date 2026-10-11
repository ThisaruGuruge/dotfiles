# TMux Keybindings Reference

Prefix key: `Ctrl+a`

`prefix + ?` opens the command palette: a fuzzy list of every binding below (plus the Ghostty shortcuts) that runs the one you pick.

## Session Management

| Key | Action |
|-----|--------|
| `prefix + f` | Project sessionizer (fuzzy find a project, open its session) |
| `prefix + S` | New session creator (prompts for name + directory) |
| `prefix + s` | Session switcher (fzf popup: `Enter` switch, `1-9` jump, `Ctrl+x` kill) |
| `prefix + Tab` | Switch to the last session |
| `prefix + $` | Rename session |
| `prefix + d` | Detach from session |
| `prefix + ?` | Command palette (fuzzy search & execute any keybinding) |

`prefix + s` only switches. Sessions that have a window where Claude Code is waiting for you are marked with a red `󰂞`.

## Claude Code State

Claude Code reports its state to tmux through hooks (`bin/claude-tmux-state`), stored per window in the `@claude_state` option:

| State | Window tab | Meaning |
|-------|------------|---------|
| `waiting` | red tab with `󰂞` | Claude needs you (permission prompt, question) |
| `done` | green tab with `✔` | Claude finished its turn. Cleared when you visit the window |
| `working` | blue `⋯` | Claude is busy |

- The status bar's right side shows `󰂞 N waiting: sessA, sessB` whenever any window is waiting (it is empty otherwise).
- `prefix + A` jumps to the next waiting window in any session (wraps around). With none waiting it just says so.
- The current tab keeps its blue background and only gains the glyph; the red/green tab colours show on the windows you are not looking at.
- Terminal bell and activity use different styles so they never look like Claude state: a bell turns the tab peach and adds `!`, activity underlines the tab text in yellow.

## Window Management

| Key | Action |
|-----|--------|
| `prefix + c` | Create new window (in current path) |
| `prefix + ,` | Rename window |
| `prefix + &` | Close window |
| `prefix + n` | Next window |
| `prefix + p` | Previous window |
| `prefix + Space` | Toggle last window |
| `prefix + 1-9` | Switch to window by number |

## Pane Management

| Key | Action |
|-----|--------|
| `prefix + \|` | Split horizontally |
| `prefix + -` | Split vertically |
| `prefix + x` | Close pane |
| `prefix + z` | Toggle pane zoom |
| `prefix + Enter` | Break pane into its own window |
| `prefix + >` / `prefix + <` | Swap pane down / up |
| `prefix + m` then `prefix + J` | Mark a pane, then join it to the current window (tmux-sessionist) |

## Pane Navigation

### Smart Navigation (works with NeoVim)
| Key | Action |
|-----|--------|
| `Ctrl+h` | Navigate left (TMux pane or NeoVim split) |
| `Ctrl+j` | Navigate down (TMux pane or NeoVim split) |
| `Ctrl+k` | Navigate up (TMux pane or NeoVim split) |
| `Ctrl+l` | Navigate right (TMux pane or NeoVim split) |
| `Ctrl+\` | Navigate to previous pane |

These keys are handled by tmux in every pane except nvim, vim and fzf, which get the key themselves. That is why Ghostty sends `Cmd+Delete` as `Alt+k` (see below): a plain `Ctrl+k` would never reach zsh inside tmux.

### Alternative Navigation
| Key | Action |
|-----|--------|
| `prefix + h/j/k/l` | Vim-style pane switching |

`Alt+Arrow` is not bound in tmux. Ghostty sends `Option+Left/Right` as `Alt+b` / `Alt+f` so zsh jumps by word the same way inside and outside tmux.

## Pane Resizing

| Key | Action |
|-----|--------|
| `prefix + Left/Right/Up/Down` | Resize pane (repeatable) |

## Copy Mode (Vi-style)

| Key | Action |
|-----|--------|
| `prefix + [` | Enter copy mode |
| `v` | Begin selection |
| `Ctrl+v` | Toggle rectangle selection |
| `y` | Copy selection to the system clipboard (tmux-yank) |
| `o` | Open selection with the default app (tmux-open) |
| `q` | Exit copy mode |
| `prefix + y` / `prefix + Y` | Copy the current command line / directory (tmux-yank) |

## Floating Popups

All popups float above the current pane (including NeoVim) and close back to exactly where you were.

| Key | Action |
|-----|--------|
| `prefix + t` | Floating terminal (current directory) |
| `prefix + N` | Floating scratchpad (`~/.scratch.md` in nvim) |
| `prefix + S` | New session creator (prompts for name + directory) |
| `prefix + G` | Floating lazygit (current directory) |
| `prefix + f` | Project sessionizer (fuzzy find and switch projects) |

## Utility

| Key | Action |
|-----|--------|
| `prefix + r` | Reload config |
| `prefix + b` | Toggle status bar |
| `prefix + C-l` | Clear screen |
| `prefix + C-a` | Send the prefix through (nested tmux) |
| `prefix + I` | Install plugins (TPM) |
| `prefix + U` | Update plugins (TPM) |

## Plugin Keys

| Key | Plugin | Action |
|-----|--------|--------|
| `prefix + g` | tmux-sessionist | Go to a session by name |
| `prefix + C` | tmux-sessionist | New session by name |
| `prefix + X` | tmux-sessionist | Kill the current session and switch to another |
| `prefix + @` | tmux-sessionist | Promote the pane to its own session |
| `prefix + J` | tmux-sessionist | Join the marked pane (moved from `t`, which is the floating terminal) |
| `prefix + F` | tmux-fzf | Menu for sessions, windows, panes and the clipboard |
| `prefix + Ctrl+s` / `Ctrl+r` | tmux-resurrect | Save / restore sessions |

`prefix + S` runs our new-session popup instead of tmux-sessionist's "last session" key; `prefix + Tab` does that job.

## Ghostty Shortcuts

Ghostty sends these Cmd shortcuts to tmux as `Ctrl+a` plus a key, so they only make sense inside tmux. The prefix is hard-coded in `ghostty/.config/ghostty/config` and `bin/test-zsh-config` fails if the tmux prefix stops being `Ctrl+a`. They are also listed in the command palette under "Ghostty".

| Key | Action |
|-----|--------|
| `Cmd+[` / `Cmd+]` | Previous / next window |
| `Cmd+t` | New window |
| `Cmd+1-9` | Switch to window by number |
| `Cmd+h` / `Cmd+j` | Pane left / down |
| `Cmd+Shift+k` / `Cmd+Shift+l` | Pane up / right |

These Ghostty keys work everywhere, with or without tmux:

| Key | Sends | Action |
|-----|-------|--------|
| `Cmd+Left/Right` | Home / End | Start / end of line |
| `Option+Left/Right` | `Alt+b` / `Alt+f` | Back / forward one word |
| `Cmd+Backspace` | `Ctrl+u` | Delete to start of line |
| `Cmd+Delete` | `Alt+k` | Delete to end of line (zsh `kill-line`) |

## Auto-Start Behavior

TMux automatically starts when you open a terminal, except in:
- VS Code integrated terminal
- JetBrains IDE terminals
- SSH sessions
- Non-interactive shells
- When already inside TMux

## Project Sessionizer

Press `prefix + f` anywhere in TMux to:
1. Fuzzy search through your projects (`~/Projects/**/` and `~/dotfiles`)
2. Create or switch to a named TMux session for that project
3. Start in the project directory

Each project gets its own persistent session that survives terminal restarts.

### Session layout

A session created by `prefix + f` or `prefix + S` starts with three windows, in this order:

| # | Window | Contents |
|---|--------|----------|
| 1 | `Long Runs` | A plain shell for servers, builds, anything you leave running |
| 2 | `CLAUDE` | Runs `claude`. The account (personal or enterprise) comes from the directory's direnv environment |
| 3 | `NVim` | `nvim` in the top pane (about 80%), a plain shell below (about 20%). The session opens on this window |

- The layout is applied only when a session is created. Existing sessions are never touched, and the window names stay fixed (automatic rename is off for them).
- `SESSIONIZER_LAYOUT=bare` gives a single shell window instead. Export it before tmux starts, or switch it on a running server with `tmux set-environment -g SESSIONIZER_LAYOUT bare` (`tmux set-environment -gu SESSIONIZER_LAYOUT` turns it off again).
- Two projects with the same folder name get parent-qualified session names: `api` for the first, `personal/api` for the second.
- `prefix + s` only switches between sessions; it does not create anything.

## Awake indicator

While the `awake` shell function is holding the Mac awake (its pidfile `${TMPDIR:-/tmp}/dotfiles-awake.pid` points at a live process), the status bar shows a `☕` in front of the load average.

## Plugins

- **tmux-resurrect**: Save/restore sessions (automatic)
- **tmux-continuum**: Auto-save every 15 minutes, auto-restore on start
- **tmux-yank**: System clipboard integration
- **tmux-open**: Open the copy-mode selection
- **tmux-sessionist**: Session helpers (`g`, `C`, `X`, `@`, `J`)
- **tmux-fzf**: Fuzzy menus (`prefix + F`)

---

**Tip**: Use `prefix + t` for a quick terminal, `prefix + f` to fuzzy-find projects, `prefix + A` to jump to the Claude window that needs you, or `prefix + S` to create a new named session!
