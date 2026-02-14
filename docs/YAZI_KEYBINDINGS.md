# Yazi Keybindings Reference

## Opening Yazi

### From Neovim (yazi.nvim)

| Key | Action |
|-----|--------|
| `<Space>e` | Open yazi in working directory |
| `<Space>o` | Open yazi at current file |
| `<Space>-` | Open yazi at current file |
| `<Space>cw` | Open yazi in working directory |
| `<C-Up>` | Resume last yazi session |

Inside the yazi.nvim floating window:

| Key | Action |
|-----|--------|
| `<C-v>` | Open file in vertical split |
| `<C-x>` | Open file in horizontal split |
| `<C-t>` | Open file in new tab |
| `<C-q>` | Send to quickfix list |
| `<C-s>` | Search directory (Telescope) |
| `<C-y>` | Copy relative file paths |
| `<Tab>` | Navigate between open buffers |

### From Shell

| Command | Action |
|---------|--------|
| `y` | Open yazi with cd-on-exit (quit with `q` to change directory) |
| `y <path>` | Open yazi at a specific path |
| `yazi` | Open yazi without cd-on-exit |

---

## Navigation

| Key | Action |
|-----|--------|
| `h` | Go to parent directory |
| `l` / `<Enter>` | Enter directory or open file (smart-enter plugin) |
| `j` / `k` | Move cursor down / up |
| `J` / `K` | Move cursor 5 lines down / up |
| `f` | Jump to character (jump-to-char plugin) |
| `gg` | Go to first item |
| `G` | Go to last item |
| `~` | Go to home directory |
| `<C-d>` / `<C-u>` | Scroll half page down / up |

## Bookmarks (custom)

| Key | Action |
|-----|--------|
| `gd` | Go to `~/Downloads` |
| `gc` | Go to `~/.config` |
| `gD` | Go to `~/dotfiles` |

## Jump / Search / Filter

| Key | Action |
|-----|--------|
| `/` | Search by filename (uses fd) |
| `?` | Search by file content (uses rg) |
| `F` | Smart filter (stays active, auto-enters single matches) |
| `z` | Jump with zoxide |
| `Z` | Jump with fzf |

---

## File Operations

| Key | Action |
|-----|--------|
| `o` | Open file |
| `O` | Open interactively (choose opener) |
| `<Enter>` | Open / enter directory (smart-enter) |
| `a` | Create file or directory (trailing `/` for directory) |
| `r` | Rename |
| `y` | Yank (copy) |
| `x` | Yank (cut) |
| `p` | Paste |
| `P` | Paste into hovered directory (smart-paste plugin) |
| `d` | Move to trash |
| `D` | Permanent delete |
| `.` | Toggle hidden files |

## Selection

| Key | Action |
|-----|--------|
| `<Space>` | Toggle selection on current item |
| `V` | Enter visual select mode |
| `<C-a>` | Select all |
| `<C-r>` | Inverse selection |
| `<Esc>` | Cancel selection |

---

## Plugin Commands (custom keybindings)

| Key | Action | Plugin |
|-----|--------|--------|
| `l` / `<Enter>` | Enter or open intelligently | smart-enter |
| `f` | Jump to character in file list | jump-to-char |
| `F` | Smart filter with auto-enter | smart-filter |
| `P` | Paste into hovered directory | smart-paste |
| `<C-d>` | Diff two selected files | diff |
| `cm` | chmod selected files | chmod |
| `ct` | Toggle macOS Finder tag | mactag |

---

## Tabs

| Key | Action |
|-----|--------|
| `t` | New tab in current directory |
| `1` - `9` | Switch to tab N |
| `[` / `]` | Switch to previous / next tab |
| `{` / `}` | Swap tab order left / right |

---

## View / Display

| Key | Action |
|-----|--------|
| `,` | Cycle linemode (size, mtime, permissions, none) |
| `;` | Cycle sort by (name, size, modified, extension) |
| `w` | Open task manager (view progress of copy/move operations) |
| `<C-z>` | Suspend yazi (return to shell, `fg` to resume) |

---

## Quitting

| Key | Action |
|-----|--------|
| `q` | Quit (cd to current directory when using `y` wrapper) |
| `Q` | Quit without changing directory |

---

## Installed Plugins

| Plugin | Keybinding | Purpose |
|--------|------------|---------|
| smart-enter | `l` / `<Enter>` | Opens files or enters directories intelligently |
| smart-filter | `F` | Filter that stays active and auto-enters single-match dirs |
| smart-paste | `P` | Paste into the hovered directory instead of current dir |
| full-border | — | Adds a complete border around the UI |
| git | — | Shows git status (modified, staged, untracked) in the file list |
| mime-ext | — | Faster MIME detection via extension (skips `file` command) |
| chmod | `cm` | Interactively change file permissions |
| diff | `<C-d>` | Diff two selected files |
| jump-to-char | `f` | Vim-like f motion to jump to a character |
| mactag | `ct` | Toggle macOS Finder color tags |

Install/update all plugins: `ya pkg install`

---

## Preview Dependencies

These are installed via Brewfile and enable richer previews:

| Package | Purpose |
|---------|---------|
| ffmpegthumbnailer | Video thumbnail previews |
| poppler | PDF text preview |
| imagemagick | SVG and font preview |
| unar | Archive content preview |

Image preview works natively in WezTerm, iTerm2, and Kitty. For tmux, `allow-passthrough` is enabled in `.tmux.conf`.
