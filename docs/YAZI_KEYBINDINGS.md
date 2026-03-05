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

## Search, Find & Filter

Yazi has multiple layers of search — from quick inline find to recursive deep search.

### Find (inline, current directory only)

Incremental filename matching within the current directory. As you type, the
cursor jumps to the first match. Does **not** recurse into subdirectories.

| Key | Action |
|-----|--------|
| `/` | Find forward (smart case) |
| `?` | Find backward (smart case) |
| `n` | Jump to next find match |
| `N` | Jump to previous find match |

> **Smart case**: case-insensitive unless your query contains an uppercase letter.

### Filter (current directory only)

Filter **hides** non-matching files from the listing in real time (unlike find,
which only moves the cursor). Clearing the filter restores all files.

| Key | Action |
|-----|--------|
| `F` | Smart filter — stays active while navigating, auto-enters single-match dirs (smart-filter plugin) |

> The built-in `filter` default (`f`) is remapped to `jump-to-char` in this config.

### Search (recursive, uses external tools)

Recursive search from the current working directory using `fd` or `rg`. Results
replace the file listing with a flat view of all matches across subdirectories.

| Key | Action | Tool |
|-----|--------|------|
| `s` | Search by **filename** (recursive) | `fd` |
| `S` | Search by **file content** (recursive) | `rg` (ripgrep) |
| `Ctrl+s` | Cancel ongoing search | — |

After results appear, navigate them like a normal file list — press `l`/`Enter`
to open, `Esc` to return to the regular directory view.

**Tips**:
- `s` is great for finding deeply nested files by name (e.g., type `*.toml` to find all TOML files)
- `S` is like a recursive grep — search for a string inside files, then open the match
- Both support regex patterns
- `fd` and `rg` respect `.gitignore` by default

### Fuzzy Jump (recursive)

| Key | Action | Tool |
|-----|--------|------|
| `z` | Fuzzy-find files/dirs in current subtree | `fzf` |
| `Z` | Jump to a frequently visited directory | `zoxide` + `fzf` |

- **`z` (fzf)**: Searches all files and directories under the current working
  directory. If the result is a file, Yazi reveals it in its parent directory.
  If it's a directory, Yazi navigates into it.
- **`Z` (zoxide)**: Opens an interactive fuzzy search over your zoxide history
  (directories you've visited before across all shells). Great for jumping to
  project roots or frequently used paths.

### Sorting

Change how files are sorted in the current directory. Lowercase = ascending,
uppercase = descending.

| Key | Sort by | Linemode |
|-----|---------|----------|
| `,n` / `,N` | Natural (1 < 2 < 10) | — |
| `,a` / `,A` | Alphabetical (1 < 10 < 2) | — |
| `,s` / `,S` | Size | size |
| `,m` / `,M` | Modified time | mtime |
| `,b` / `,B` | Created time | btime |
| `,e` / `,E` | Extension | — |
| `,r` | Random | — |

Default sort: `natural`, directories first (configured in `yazi.toml`).

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
| `.` | Toggle hidden files |
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
