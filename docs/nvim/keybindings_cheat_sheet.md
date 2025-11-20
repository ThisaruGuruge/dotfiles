# Neovim Keybindings Cheat Sheet

**Leader**: `<Space>` | **Modes**: `n` = Normal, `i` = Insert, `v` = Visual

---

## 🔍 Search & Find (Telescope)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>ff` | `n` | Find files in project |
| `<Space>fg` | `n` | Live grep (search text) |
| `<Space>fb` | `n` | Find buffers (open files) |
| `<Space>fh` | `n` | Find help tags |
| `<Space>fr` | `n` | Recent files |
| `<Space>fw` | `n` | Find word under cursor |

---

## 📁 File Navigation

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>e` | `n` | Toggle Neo-tree |
| `<Space>o` | `n` | Focus Neo-tree |

**Inside Neo-tree:**
- `<Enter>` - Open file/folder
- `a` - Add new file/folder
- `d` - Delete
- `r` - Rename
- `y` - Copy
- `x` - Cut
- `p` - Paste
- `q` - Close

---

## 🔀 Git Operations

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

## 💡 LSP (Code Intelligence)

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

## ✨ Completion (Insert Mode)

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

## 🎯 Treesitter (Selection)

| Key | Mode | Action |
|:----|:-----|:-------|
| `<CR>` | `n`, `v` | Init/Increment selection |
| `<S-CR>` | `v` | Scope increment |
| `<BS>` | `v` | Decrement selection |

---

## 💻 Terminal

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>tt` | `n` | Toggle terminal |
| `<C-\>` | `n`, `t` | Quick toggle |

---

## 🎮 Practice

| Key | Mode | Action |
|:----|:-----|:-------|
| `<Space>vg` | `n` | VimBeGood (practice) |

---

## 🚀 Essential Vim Motions

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

## 💾 File Operations

| Key | Mode | Action |
|:----|:-----|:-------|
| `:w` | `n` | Save file |
| `:q` | `n` | Quit |
| `:wq` | `n` | Save and quit |
| `:q!` | `n` | Quit without saving |
| `:e <file>` | `n` | Edit file |

---

## 🔥 Pro Tips

1. **Which-Key**: Press `<Space>` and wait → shows all available commands
2. **Telescope**: Start typing immediately after keybinding
3. **LSP**: Use `K` on any function/variable to see docs
4. **Git**: `<Space>gg` opens full Git UI (like Magit)
5. **Completion**: Just start typing, `<Tab>` to navigate
