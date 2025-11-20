# Neovim Keybindings Reference

Leader key: `<Space>`

## General

| Key | Action | Source |
|-----|--------|--------|
| `<Space>` | Leader key | config/lazy.lua:21 |

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
| `<C-p>` | Find git files | plugins/telescope.lua:15 |

## File Explorer (Neo-tree)

| Key | Action | Source |
|-----|--------|--------|
| `<leader>e` | Toggle file explorer | plugins/file-explorer.lua:12 |
| `<leader>o` | Focus file explorer | plugins/file-explorer.lua:13 |

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

## Terminal

| Key | Action | Source |
|-----|--------|--------|
| `<leader>tt` | Toggle terminal | plugins/editor.lua:169 |
| `<C-\>` | Toggle terminal (alt) | plugins/editor.lua:174 |

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

## Treesitter Text Objects

| Key | Action | Source |
|-----|--------|--------|
| `<CR>` | Init/Increment selection | plugins/editor.lua:28-29 |
| `<S-CR>` | Scope increment | plugins/editor.lua:30 |
| `<BS>` | Node decrement | plugins/editor.lua:31 |

## Which-Key Groups

| Prefix | Group | Source |
|--------|-------|--------|
| `<leader>f` | Find (Telescope) | plugins/editor.lua:69 |
| `<leader>g` | Git | plugins/editor.lua:70 |
| `<leader>t` | Toggle | plugins/editor.lua:71 |
| `<leader>l` | LSP | plugins/editor.lua:72 |

---

**Tip**: Press `<leader>fk` to search keymaps interactively with Telescope!
