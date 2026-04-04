# Neovim Keybindings Cheat Sheet

**Leader**: `<Space>` | **Modes**: `n` = Normal, `i` = Insert, `v` = Visual

## Keybinding Conventions

This configuration follows standard Vim/Neovim conventions:

| Pattern | Purpose | Examples |
|:--------|:--------|:---------|
| `g*` | Navigation (go to...) | `gd` (definition), `gr` (references), `gi` (implementation) |
| `<Space>g*` | Git operations | `<Space>gs` (stage), `<Space>gp` (preview), `<Space>gg` (LazyGit) |
| `<Space>l*` | LSP actions | `<Space>lr` (rename), `<Space>la` (actions), `<Space>lf` (format) |
| `<Space>f*` | Find/Search | `<Space>ff` (files), `<Space>fg` (grep), `<Space>fb` (buffers), `<Space>fy` (clipboard history) |
| `[` / `]` | Previous/Next | `[d` (prev diagnostic), `]c` (next git hunk) |

---

## Dashboard (Start Screen)

The dashboard appears when opening Neovim without arguments. Press the shortcut key to jump to an action:

| Key | Action |
|:----|:-------|
| `f` | Find File |
| `r` | Recent Files |
| `g` | Live Grep |
| `e` | File Explorer |
| `l` | Open Lazy (plugin manager) |
| `q` | Quit |

---

## Quick Help

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>?` | `n` | **Show ALL keybindings** (fuzzy search) |
| `<Space><Space>` | `n` | **Show leader commands** (which-key popup) |

**Tip**: Press `<Space>` and wait 1 second - which-key will automatically show all available commands!

---

## Search & Find (Telescope)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>ff` | `n` | Find files in project |
| `<Space>fg` | `n` | Live grep (search text) |
| `<Space>fb` | `n` | Find buffers (open files) |
| `<Space>fh` | `n` | Find help tags |
| `<Space>fr` | `n` | Recent files |
| `<Space>fw` | `n` | Find word under cursor |

---

## File Navigation (Yazi)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>e` | `n` | Open yazi in working directory |
| `<Space>o` | `n` | Open yazi at current file |
| `<Space>-` | `n` | Open yazi at current file |
| `<Space>cw` | `n` | Open yazi in working directory |
| `<C-Up>` | `n` | Resume last yazi session |

Yazi opens as a floating terminal file manager. Inside the floating window:
- `<C-v>` - Open in vertical split
- `<C-x>` - Open in horizontal split
- `<C-t>` - Open in new tab
- `<C-q>` - Send to quickfix list
- `<C-s>` - Search directory (Telescope)
- `<C-y>` - Copy relative file paths

See `docs/YAZI_KEYBINDINGS.md` for the full yazi keybinding reference.

---

## Git Operations

### LazyGit (Git UI)
| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>gg` | `n` | Open LazyGit |

**Inside LazyGit:**
- `q` - Quit LazyGit
- `Space` - Stage/unstage
- `c` - Commit
- `P` - Push
- `p` - Pull
- `Enter` - View details
- `?` - Show all keybindings

### Gitsigns (Hunks)
| Key | Mode | Action |
|:----|:-----|:-------|
| `]c` | `n` | Next hunk |
| `[c` | `n` | Previous hunk |
| `<Space>gs` | `n`, `v` | Stage hunk |
| `<Space>gr` | `n`, `v` | Reset hunk |
| `<Space>gS` | `n` | Stage buffer |
| `<Space>gu` | `n` | Undo stage hunk |
| `<Space>gR` | `n` | Reset buffer |
| `<Space>gp` | `n` | Preview hunk |
| `<Space>gb` | `n` | Blame line |
| `<Space>gd` | `n` | Diff this |
| `<Space>gD` | `n` | Diff this ~ |

---

## LSP (Code Intelligence)

### Navigation
| Key | Mode | Action |
|:----|:-----|:-------|
| `gd` | `n` | Go to definition |
| `gD` | `n` | Go to declaration |
| `gr` | `n` | Find references |
| `gi` | `n` | Go to implementation |
| `K` | `n` | Hover documentation |

### Actions
| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>lr` | `n` | Rename symbol |
| `<Space>la` | `n` | Code actions |
| `<Space>lf` | `n` | Format buffer |
| `<Space>ld` | `n` | Show diagnostics |
| `[d` | `n` | Previous diagnostic |
| `]d` | `n` | Next diagnostic |

---

## Completion (Insert Mode)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<C-Space>` | `i` | Trigger completion |
| `<Tab>` | `i` | Next item / Expand snippet |
| `<S-Tab>` | `i` | Previous item |
| `<CR>` | `i` | Confirm selection |
| `<C-e>` | `i` | Abort completion |
| `<C-b>` | `i` | Scroll docs up |
| `<C-f>` | `i` | Scroll docs down |

---

## Code Outline (aerial.nvim)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>a` | `n` | Toggle outline sidebar |
| `{` | `n` | Jump to previous symbol |
| `}` | `n` | Jump to next symbol |

---

## Line Movement

| Key | Mode | Action |
|:----|:-----|:-------|
| `J` | `v` | Move selected lines down |
| `K` | `v` | Move selected lines up |

---

## Treesitter (Selection)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<CR>` | `n`, `v` | Init/Increment selection |
| `<S-CR>` | `v` | Scope increment |
| `<BS>` | `v` | Decrement selection |

---

## Undo History

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>u` | `n` | Toggle Undotree (visual undo history) |

## Terminal

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>tt` | `n` | Toggle terminal |
| `<C-\>` | `n`, `t` | Quick toggle |

---

## Practice

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>vg` | `n` | VimBeGood (practice) |

---

## Trouble (Diagnostics Panel)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>xx` | `n` | Toggle workspace diagnostics |
| `<Space>xX` | `n` | Toggle buffer diagnostics |
| `<Space>xs` | `n` | Toggle symbols |
| `<Space>xr` | `n` | Toggle LSP references |
| `<Space>xl` | `n` | Toggle location list |
| `<Space>xq` | `n` | Toggle quickfix list |
| `<Space>xt` | `n` | Toggle TODO list |

## TODO Comments

| Key | Mode | Action |
|:----|:-----|:-------|
| `]t` | `n` | Next TODO comment |
| `[t` | `n` | Previous TODO comment |
| `<Space>ft` | `n` | Find TODOs (Telescope picker) |
| `<Space>xt` | `n` | TODOs in Trouble panel |

Highlighted keywords: `TODO`, `FIXME`, `HACK`, `NOTE`, `WARN`, `PERF`, `TEST`

---

## Text Objects (mini.ai)

mini.ai extends `a` (around) and `i` (inside) with smarter text object identifiers.

**Syntax**: `{operator}{a|i}{id}` — works with `d`, `c`, `y`, `v`, `=`, etc.

| Identifier | Targets | Common usage |
|:-----------|:--------|:-------------|
| `f` | Function call | `daf` delete around fn, `cif` change inside fn |
| `a` | Argument | `dia` delete arg, `via` select arg |
| `b` | Any bracket `()[]{}` | `dib` delete inside, `cab` change around |
| `q` | Any quote `"'`` ` `` | `ciq` change inside, `yaq` yank around |
| `t` | HTML/XML tag | `dit` delete inside tag |
| `(`, `[`, `{` | Specific bracket | `ci(` change inside parens |
| `"`, `'`, `` ` `` | Specific quote | `ci"` change inside double quotes |
| `?` | Interactive pair | Prompted — type any pair |

**Tip**: Add a count to target outer scopes — `2daf` deletes the 2nd enclosing function.

---

## Flash (Jump/Motion)

| Key | Mode | Action |
|:----|:-----|:-------|
| `s` + type chars | `n`, `x`, `o` | Flash Jump — type 2+ chars, pick a label to jump |
| `S` | `n`, `x`, `o` | Flash Treesitter — select treesitter node |
| `r` | `o` | Remote Flash (operator-pending) |
| `R` | `o`, `x` | Treesitter Search |

Flash also enhances:
- `/` and `?` search — jump labels appear on matches
- `f`, `t`, `F`, `T` — character motions get labels when multiple matches exist

**Common combos:**
- `s` + `gr` + label → jump to the word "green"
- `d` + `s` + `gr` + label → delete from cursor to the word "green"
- Jump first with `s`, then `diw` to delete the word under cursor

---

## Essential Vim Motions

### Movement (Normal Mode)
| Key | Action |
|:----|:-------|
| `h/j/k/l` | Left/Down/Up/Right |
| `w` | Next word |
| `b` | Previous word |
| `e` | End of word |
| `0` | Start of line |
| `^` | First non-blank |
| `$` | End of line |
| `gg` | Top of file |
| `G` | Bottom of file |
| `{` / `}` | Previous/Next paragraph |
| `<C-d>` | Half page down |
| `<C-u>` | Half page up |
| `<C-o>` | Jump back |
| `<C-i>` | Jump forward |

### Editing
| Key | Mode | Action |
|:----|:-----|:-------|
| `i` | `n` | Insert before cursor |
| `a` | `n` | Insert after cursor |
| `I` | `n` | Insert at line start |
| `A` | `n` | Insert at line end |
| `o` | `n` | New line below |
| `O` | `n` | New line above |
| `dd` | `n` | Delete line |
| `yy` | `n` | Yank (copy) line |
| `p` | `n` | Paste after |
| `P` | `n` | Paste before |
| `u` | `n` | Undo |
| `<C-r>` | `n` | Redo |
| `v` | `n` | Visual mode |
| `V` | `n` | Visual line mode |
| `<C-v>` | `n` | Visual block mode |

---

## File Operations

| Key | Mode | Action |
|:----|:-----|:-------|
| `:w` | `n` | Save file |
| `:q` | `n` | Quit |
| `:wq` | `n` | Save and quit |
| `:q!` | `n` | Quit without saving |
| `:e <file>` | `n` | Edit file |

---

## Pro Tips

1. **Discover Keybindings**: Press `<Space>?` for searchable list or `<Space><Space>` for visual menu
2. **Which-Key Auto-popup**: Press `<Space>` and wait 1 second → shows all available commands
3. **LSP Documentation**: Use `K` on any function/variable to see docs instantly
4. **Git UI**: `<Space>gg` opens full LazyGit interface (like Magit for Emacs)
5. **Navigation**: `gd` (definition), `gr` (references), `gi` (implementation) - all searchable with Telescope
6. **Completion**: Just start typing in insert mode, `<Tab>` to navigate suggestions
