# TMux Keybindings Reference

Prefix key: `Ctrl+a`

## Session Management

| Key | Action |
|-----|--------|
| `Ctrl+f` | Project sessionizer (fuzzy find and switch projects) |
| `prefix + s` | Choose session from tree |
| `prefix + $` | Rename session |
| `prefix + d` | Detach from session |

## Window Management

| Key | Action |
|-----|--------|
| `prefix + c` | Create new window (in current path) |
| `prefix + ,` | Rename window |
| `prefix + &` | Close window |
| `prefix + n` | Next window |
| `prefix + p` | Previous window |
| `prefix + 1-9` | Switch to window by number |

## Pane Management

| Key | Action |
|-----|--------|
| `prefix + \|` | Split horizontally |
| `prefix + -` | Split vertically |
| `prefix + x` | Close pane |
| `prefix + z` | Toggle pane zoom |

## Pane Navigation

### Smart Navigation (works with NeoVim)
| Key | Action |
|-----|--------|
| `Ctrl+h` | Navigate left (TMux pane or NeoVim split) |
| `Ctrl+j` | Navigate down (TMux pane or NeoVim split) |
| `Ctrl+k` | Navigate up (TMux pane or NeoVim split) |
| `Ctrl+l` | Navigate right (TMux pane or NeoVim split) |
| `Ctrl+\` | Navigate to previous pane |

### Alternative Navigation
| Key | Action |
|-----|--------|
| `Alt+Arrow` | Switch panes (without prefix) |
| `prefix + h/j/k/l` | Vim-style pane switching |

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
| `y` | Copy selection |
| `q` | Exit copy mode |

## Utility

| Key | Action |
|-----|--------|
| `prefix + r` | Reload config |
| `prefix + b` | Toggle status bar |
| `prefix + C-l` | Clear screen |
| `prefix + I` | Install plugins (TPM) |
| `prefix + U` | Update plugins (TPM) |

## Auto-Start Behavior

TMux automatically starts when you open a terminal, except in:
- VS Code integrated terminal
- JetBrains IDE terminals
- SSH sessions
- Non-interactive shells
- When already inside TMux

## Auto Project Sessions

When you `cd` into certain directories, TMux automatically creates or switches to a project-specific session.

**Triggers:**
- Any **git repository root** (directory containing `.git`)
- Directories listed in **`~/.tmux-directories`**

**Session naming:** Uses the folder name (e.g., `cd ~/projects/my-app` → session named `my-app`)

**Config file example (`~/.tmux-directories`):**
```
# One path per line, comments start with #
~/Documents/notes
~/work/important-project
/opt/my-tools
```

**Workflow:**
```
Terminal opens     → "main" session
cd ~/projects/foo  → switches to "foo" session (created if needed)
cd ~/projects/bar  → switches to "bar" session (foo stays alive)
Ctrl+a, d          → detach (all sessions persist)
tmux ls            → shows: main, foo, bar
```

## Project Sessionizer

Press `Ctrl+f` anywhere in TMux to:
1. Fuzzy search through your projects (`~/Projects/**/` and `~/dotfiles`)
2. Create or switch to a named TMux session for that project
3. Start in the project directory

Each project gets its own persistent session that survives terminal restarts.

## Plugins

- **tmux-resurrect**: Save/restore sessions (automatic)
- **tmux-continuum**: Auto-save every 15 minutes, auto-restore on start
- **tmux-yank**: System clipboard integration

---

**Tip**: Use `prefix + s` to see all sessions, or `Ctrl+f` to fuzzy-find projects!
