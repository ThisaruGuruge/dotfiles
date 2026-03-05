# Neovim Keybindings Reference

Leader key: `<Space>`

## Keybinding Conventions

This configuration follows standard Vim/Neovim conventions:

- **`g*`** - Navigation commands (go to definition, references, etc.) - Standard Vim pattern
- **`<leader>g*`** - Git operations (stage, commit, diff, etc.)
- **`<leader>l*`** - LSP actions (rename, code actions, format, diagnostics)
- **`<leader>f*`** - Find/Search operations (Telescope)
- **`[` / `]`** - Jump to previous/next (diagnostics, git hunks, etc.)

## Dashboard (alpha-nvim)

| Key | Action | Source |
|-----|--------|--------|
| `f` | Find File (from dashboard) | plugins/dashboard.lua |
| `r` | Recent Files (from dashboard) | plugins/dashboard.lua |
| `g` | Live Grep (from dashboard) | plugins/dashboard.lua |
| `e` | File Explorer (from dashboard) | plugins/dashboard.lua |
| `l` | Open Lazy (from dashboard) | plugins/dashboard.lua |
| `q` | Quit (from dashboard) | plugins/dashboard.lua |

> Dashboard buttons are only active on the start screen (when Neovim opens without arguments).

## General

| Key | Action | Source |
|-----|--------|--------|
| `<Space>` | Leader key | config/lazy.lua:21 |
| `<leader>?` | Show all keybindings (searchable) | thisarug/init.lua:39 |
| `<leader><leader>` | Show all leader commands | thisarug/init.lua:41 |

## File Navigation & Search (Telescope)

| Key | Action | Source |
|-----|--------|--------|
| `<leader>ff` | Find files | plugins/telescope.lua:8 |
| `<leader>fg` | Live grep | plugins/telescope.lua:9 |
| `<leader>fb` | Find buffers | plugins/telescope.lua:10 |
| `<leader>fh` | Find help | plugins/telescope.lua:11 |
| `<leader>fr` | Recent files | plugins/telescope.lua:12 |
| `<leader>fw` | Find word under cursor | plugins/telescope.lua:13 |
| `<leader>fk` | Find keymaps | plugins/telescope.lua:14 |
| `<leader>fs` | Search string (prompt) | plugins/telescope.lua:17 |
| `<leader>fy` | Clipboard history | plugins/clipboard.lua |
| `<C-p>` | Find git files | plugins/telescope.lua:15 |

## File Explorer (yazi.nvim)

| Key | Action | Source |
|-----|--------|--------|
| `<leader>e` | Open yazi in working directory | plugins/editor.lua |
| `<leader>o` | Open yazi at current file | plugins/editor.lua |
| `<leader>-` | Open yazi at current file | plugins/yazi.lua |
| `<leader>cw` | Open yazi in working directory | plugins/yazi.lua |
| `<C-Up>` | Resume last yazi session | plugins/yazi.lua |

Inside yazi.nvim floating window:

| Key | Action |
|-----|--------|
| `<C-v>` | Open in vertical split |
| `<C-x>` | Open in horizontal split |
| `<C-t>` | Open in new tab |

## LSP

| Key | Action | Source |
|-----|--------|--------|
| `gd` | Go to definition | plugins/lsp.lua:64 |
| `gD` | Go to declaration | plugins/lsp.lua:66 |
| `gr` | Find references | plugins/lsp.lua:68 |
| `gi` | Go to implementation | plugins/lsp.lua:70 |
| `K` | Hover documentation | plugins/lsp.lua:72 |
| `<leader>lr` | Rename symbol | plugins/lsp.lua:74 |
| `<leader>la` | Code action | plugins/lsp.lua:76 |
| `<leader>lf` | Format buffer | plugins/formatting.lua:29 |
| `<leader>ld` | Show diagnostics | plugins/lsp.lua:80 |
| `[d` | Previous diagnostic | plugins/lsp.lua:82 |
| `]d` | Next diagnostic | plugins/lsp.lua:84 |

## Git (Gitsigns)

| Key | Action | Source |
|-----|--------|--------|
| `]c` | Next git hunk | plugins/git.lua:34 |
| `[c` | Previous git hunk | plugins/git.lua:44 |
| `<leader>gs` | Stage hunk | plugins/git.lua:55 |
| `<leader>gr` | Reset hunk | plugins/git.lua:56 |
| `<leader>gS` | Stage buffer | plugins/git.lua:63 |
| `<leader>gu` | Undo stage hunk | plugins/git.lua:64 |
| `<leader>gR` | Reset buffer | plugins/git.lua:65 |
| `<leader>gp` | Preview hunk | plugins/git.lua:66 |
| `<leader>gb` | Blame line | plugins/git.lua:67 |
| `<leader>gd` | Diff this | plugins/git.lua:70 |
| `<leader>gD` | Diff this ~ | plugins/git.lua:71 |
| `<leader>gg` | LazyGit | plugins/git.lua:93 |
| `<leader>gw` | Switch Git Worktree | plugins/git.lua:106 |
| `<leader>gW` | Create Git Worktree | plugins/git.lua:112 |

## Code Outline (aerial.nvim)

| Key | Action | Source |
|-----|--------|--------|
| `<leader>a` | Toggle outline sidebar | plugins/aerial.lua |
| `{` | Previous symbol | plugins/aerial.lua |
| `}` | Next symbol | plugins/aerial.lua |

## Clipboard History (neoclip.nvim)

Open with `<leader>fy` to browse yank history in a Telescope picker.

| Key (in picker) | Mode | Action |
|-----------------|------|--------|
| `<CR>` | insert / normal | Select (put in register, ready to paste) |
| `<C-p>` | insert | Paste after cursor |
| `<C-k>` | insert | Paste before cursor |
| `<C-d>` | insert | Delete entry from history |
| `p` | normal | Paste after cursor |
| `P` | normal | Paste before cursor |
| `dd` | normal | Delete entry from history |

## Undo History

| Key | Action | Source |
|-----|--------|--------|
| `<leader>u` | Toggle Undotree | plugins/undotree.lua |

## Terminal

| Key | Action | Source |
|-----|--------|--------|
| `<leader>tt` | Toggle terminal | plugins/editor.lua:169 |
| `<C-\>` | Toggle terminal (alt) | plugins/editor.lua:174 |

## TMux Integration (vim-tmux-navigator)

Seamless navigation between NeoVim splits and TMux panes.

| Key | Action | Source |
|-----|--------|--------|
| `<C-h>` | Navigate left (NeoVim/TMux) | plugins/tmux.lua:14 |
| `<C-j>` | Navigate down (NeoVim/TMux) | plugins/tmux.lua:15 |
| `<C-k>` | Navigate up (NeoVim/TMux) | plugins/tmux.lua:16 |
| `<C-l>` | Navigate right (NeoVim/TMux) | plugins/tmux.lua:17 |
| `<C-\>` | Navigate to previous pane | plugins/tmux.lua:18 |

## Completion (nvim-cmp)

| Key | Action | Source |
|-----|--------|--------|
| `<C-b>` | Scroll docs up | plugins/editor.lua:101 |
| `<C-f>` | Scroll docs down | plugins/editor.lua:102 |
| `<C-Space>` | Complete | plugins/editor.lua:103 |
| `<C-e>` | Abort completion | plugins/editor.lua:104 |
| `<CR>` | Confirm completion | plugins/editor.lua:105 |
| `<Tab>` | Next item / Jump snippet | plugins/editor.lua:106 |
| `<S-Tab>` | Previous item / Jump snippet back | plugins/editor.lua:115 |

## Line Movement (Visual Mode)

| Key | Action | Source |
|-----|--------|--------|
| `J` | Move selected lines down | plugins/editor.lua |
| `K` | Move selected lines up | plugins/editor.lua |

## Treesitter Text Objects

| Key | Action | Source |
|-----|--------|--------|
| `<CR>` | Init/Increment selection | plugins/editor.lua:28-29 |
| `<S-CR>` | Scope increment | plugins/editor.lua:30 |
| `<BS>` | Node decrement | plugins/editor.lua:31 |

## Trouble (Diagnostics Panel)

| Key | Action | Source |
|-----|--------|--------|
| `<leader>xx` | Toggle workspace diagnostics | plugins/trouble.lua |
| `<leader>xX` | Toggle buffer diagnostics | plugins/trouble.lua |
| `<leader>xs` | Toggle symbols | plugins/trouble.lua |
| `<leader>xr` | Toggle LSP references | plugins/trouble.lua |
| `<leader>xl` | Toggle location list | plugins/trouble.lua |
| `<leader>xq` | Toggle quickfix list | plugins/trouble.lua |

## Text Objects (mini.ai)

mini.ai extends Vim's built-in `a` (around) and `i` (inside) text object prefixes with smarter, more powerful identifiers.

**Syntax**: `{operator}{a|i}{identifier}` — e.g. `daf`, `ciq`, `via`

| Identifier | Meaning | Example |
|------------|---------|---------|
| `f` | Function call | `daf` = delete around function call |
| `a` | Argument/parameter | `dia` = delete inside argument |
| `b` | Any bracket (`()`, `[]`, `{}`) | `dib` = delete inside nearest bracket |
| `q` | Any quote (`"`, `'`, `` ` ``) | `ciq` = change inside nearest quote |
| `t` | HTML/XML tag | `dit` = delete inside tag |
| `(`, `)` | Parentheses | `vi(` = select inside parens |
| `[`, `]` | Square brackets | `ca]` = change around brackets |
| `{`, `}` | Curly braces | `yi{` = yank inside braces |
| `"`, `'`, `` ` `` | Specific quote type | `ci"` = change inside double quotes |
| `?` | Interactive (prompted) | Type any pair to use as text object |

> Works with any operator: `d` (delete), `c` (change), `y` (yank), `v` (visual), `=` (format), etc.
> Also works with counts: `2daf` deletes around the 2nd enclosing function call.

## Flash (Jump/Motion)

| Key | Mode | Action | Source |
|-----|------|--------|--------|
| `s` | `n`, `x`, `o` | Flash Jump (type chars to jump) | plugins/flash.lua |
| `S` | `n`, `x`, `o` | Flash Treesitter (select node) | plugins/flash.lua |
| `r` | `o` | Remote Flash | plugins/flash.lua |
| `R` | `o`, `x` | Treesitter Search | plugins/flash.lua |

> Flash also enhances `/` and `?` search with jump labels, and `f`/`t`/`F`/`T` character motions.

## Which-Key Groups

| Prefix | Group | Source |
|--------|-------|--------|
| `<leader>f` | Find (Telescope) | plugins/editor.lua:69 |
| `<leader>g` | Git | plugins/editor.lua:70 |
| `<leader>t` | Toggle | plugins/editor.lua:71 |
| `<leader>l` | LSP | plugins/editor.lua:72 |
| `<leader>x` | Trouble/Diagnostics | plugins/editor.lua |

---

**Tip**: Press `<leader>fk` to search keymaps interactively with Telescope!
