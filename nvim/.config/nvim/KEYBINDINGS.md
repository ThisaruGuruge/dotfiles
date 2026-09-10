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

| Key | Action                         | Source                |
| --- | ------------------------------ | --------------------- |
| `f` | Find File (from dashboard)     | plugins/dashboard.lua |
| `r` | Recent Files (from dashboard)  | plugins/dashboard.lua |
| `g` | Live Grep (from dashboard)     | plugins/dashboard.lua |
| `e` | File Explorer (from dashboard) | plugins/dashboard.lua |
| `l` | Open Lazy (from dashboard)     | plugins/dashboard.lua |
| `q` | Quit (from dashboard)          | plugins/dashboard.lua |

> Dashboard buttons are only active on the start screen (when Neovim opens without arguments).

## General

| Key                | Action                            | Source               |
| ------------------ | --------------------------------- | -------------------- |
| `<Space>`          | Leader key                        | config/lazy.lua:21   |
| `<leader>?`        | Show all keybindings (searchable) | thisarug/init.lua:39 |
| `<leader><leader>` | Show all leader commands          | thisarug/init.lua:41 |

## File Navigation & Search (Telescope)

| Key          | Action                     | Source                   |
| ------------ | -------------------------- | ------------------------ |
| `<leader>ff` | Find files                 | plugins/telescope.lua:8  |
| `<leader>fg` | Live grep                  | plugins/telescope.lua:9  |
| `<leader>fb` | Find buffers               | plugins/telescope.lua:10 |
| `<leader>fh` | Find help                  | plugins/telescope.lua:11 |
| `<leader>fr` | Recent files               | plugins/telescope.lua:12 |
| `<leader>fw` | Find word under cursor     | plugins/telescope.lua:13 |
| `<leader>fk` | Find keymaps               | plugins/telescope.lua:14 |
| `<leader>fs` | Search string (prompt)     | plugins/telescope.lua:17 |
| `<leader>fS` | Search symbols (workspace) | plugins/editor.lua:266   |
| `<leader>fy` | Clipboard history          | plugins/clipboard.lua    |
| `<C-p>`      | Find git files             | plugins/telescope.lua:15 |

## File Explorer (yazi.nvim)

| Key          | Action                              | Source             |
| ------------ | ----------------------------------- | ------------------ |
| `<leader>or` | Open yazi in working root directory | plugins/editor.lua |
| `<leader>oc` | Open yazi at current file           | plugins/editor.lua |
| `<C-Up>`     | Resume last yazi session            | plugins/yazi.lua   |

Inside yazi.nvim floating window:

| Key     | Action                   |
| ------- | ------------------------ |
| `<C-v>` | Open in vertical split   |
| `<C-x>` | Open in horizontal split |
| `<C-t>` | Open in new tab          |

## LSP

| Key          | Action                                                             | Source                    |
| ------------ | ------------------------------------------------------------------ | ------------------------- |
| `gd`         | Go to definition                                                   | plugins/lsp.lua:64        |
| `gD`         | Go to declaration                                                  | plugins/lsp.lua:66        |
| `gr`         | Find references                                                    | plugins/lsp.lua:68        |
| `gi`         | Go to implementation                                               | plugins/lsp.lua:70        |
| `K`          | Hover documentation                                                | plugins/lsp.lua:72        |
| `<leader>lr` | Rename symbol                                                      | plugins/lsp.lua:74        |
| `<leader>la` | Code action                                                        | plugins/lsp.lua:76        |
| `<leader>lf` | Format buffer                                                      | plugins/formatting.lua:29 |
| `<leader>ld` | Show diagnostics                                                   | plugins/lsp.lua:80        |
| `<leader>lq` | Buffer diagnostics to quickfix (spell excluded, jumps to first)    | plugins/lsp.lua           |
| `<leader>lW` | Workspace diagnostics to quickfix (spell excluded, jumps to first) | plugins/lsp.lua           |
| `<leader>ll` | Lint buffer (markdownlint on Markdown)                             | plugins/lint.lua          |
| `<leader>lh` | Toggle inlay hints (parameter names, inferred types)               | plugins/lsp.lua           |
| `<leader>lc` | Run codelens under the cursor                                      | plugins/lsp.lua           |
| `[d`         | Previous diagnostic                                                | plugins/lsp.lua:86        |
| `]d`         | Next diagnostic                                                    | plugins/lsp.lua:84        |

### Spell & Grammar Checking

Dedicated keybindings that navigate only spell/grammar diagnostics (from `harper-ls` and `typos-lsp`), ignoring code errors and warnings.

| Key          | Action                                     | Source          |
| ------------ | ------------------------------------------ | --------------- |
| `<leader>zn` | Next spell/typo issue                      | plugins/lsp.lua |
| `<leader>zp` | Previous spell/typo issue                  | plugins/lsp.lua |
| `<leader>zf` | Fix spell/typo (code action menu)          | plugins/lsp.lua |
| `<leader>zu` | Add word to user dictionary (global)       | plugins/lsp.lua |
| `<leader>zw` | Add word to workspace dictionary (project) | plugins/lsp.lua |
| `<leader>zi` | Ignore this Harper lint (persisted)        | plugins/lsp.lua |
| `<leader>th` | Toggle Harper diagnostics (buffer)         | plugins/lsp.lua |

> `harper-ls` — grammar + spell in comments and Markdown (shown as warnings).
> `typos-lsp` — identifier/string/comment typos like `getRepsone` → `getResponse` (shown as hints).
>
> `<leader>zu` maps to harper's "user dictionary" and typos' "configuration file" — both global/user-level.
> `<leader>zw` maps to harper's "workspace dictionary" and typos' "in the project" — both per-repo.
> `<leader>zi` triggers harper's "Ignore Harper error." code action — saves the suppression to the
> `ignored_lints` file so that specific diagnostic never reappears (even after restarting Neovim).
> All three auto-apply without a menu when only one matching action exists at the cursor.

## Quickfix & Location List (built-in)

Built-in Neovim navigation for the quickfix list (global) and location list (per-window, e.g. populated by `gO` for LSP document symbols).

| Key  | Action                      | Source                 |
| ---- | --------------------------- | ---------------------- |
| `]q` | Next quickfix item          | built-in               |
| `[q` | Previous quickfix item      | built-in               |
| `]Q` | Last quickfix item          | built-in               |
| `[Q` | First quickfix item         | built-in               |
| `]l` | Next location-list item     | plugins/editor.lua:346 |
| `[l` | Previous location-list item | plugins/editor.lua:345 |
| `]L` | Last location-list item     | built-in               |
| `[L` | First location-list item    | built-in               |

> `gO` (LSP document symbols) opens a **location list**, not the quickfix list — its window shows `qf` as the filetype (loclist and quickfix share it), but only `]l`/`[l` navigate it, not `]q`/`[q`.

## Git (Gitsigns)

| Key          | Action                        | Source              |
| ------------ | ----------------------------- | ------------------- |
| `]c`         | Next git hunk                 | plugins/git.lua:34  |
| `[c`         | Previous git hunk             | plugins/git.lua:44  |
| `<leader>gs` | Stage hunk                    | plugins/git.lua:55  |
| `<leader>gr` | Reset hunk                    | plugins/git.lua:56  |
| `<leader>gS` | Stage buffer                  | plugins/git.lua:63  |
| `<leader>gu` | Undo stage hunk               | plugins/git.lua:64  |
| `<leader>gR` | Reset buffer                  | plugins/git.lua:65  |
| `<leader>gp` | Preview hunk                  | plugins/git.lua:66  |
| `<leader>gt` | Toggle deleted lines (inline) | plugins/git.lua:67  |
| `<leader>gb` | Blame line                    | plugins/git.lua:68  |
| `<leader>gd` | Diff this                     | plugins/git.lua:71  |
| `<leader>gD` | Diff this ~                   | plugins/git.lua:72  |
| `<leader>gg` | LazyGit                       | plugins/git.lua:108 |

## Code Outline (aerial.nvim)

| Key         | Action                 | Source             |
| ----------- | ---------------------- | ------------------ |
| `<leader>ta` | Toggle outline sidebar | plugins/aerial.lua |
| `[[`        | Previous symbol        | plugins/aerial.lua |
| `]]`        | Next symbol            | plugins/aerial.lua |

## Clipboard History (neoclip.nvim)

Open with `<leader>fy` to browse yank history in a Telescope picker.

| Key (in picker) | Mode            | Action                                   |
| --------------- | --------------- | ---------------------------------------- |
| `<CR>`          | insert / normal | Select (put in register, ready to paste) |
| `<C-p>`         | insert          | Paste after cursor                       |
| `<C-k>`         | insert          | Paste before cursor                      |
| `<C-d>`         | insert          | Delete entry from history                |
| `p`             | normal          | Paste after cursor                       |
| `P`             | normal          | Paste before cursor                      |
| `dd`            | normal          | Delete entry from history                |

## Undo History

| Key         | Action          | Source               |
| ----------- | --------------- | -------------------- |
| `<leader>tu` | Toggle Undotree | plugins/undotree.lua |

## Markdown Rendering (render-markdown.nvim)

| Key          | Action                    | Source               |
| ------------ | ------------------------- | -------------------- |
| `<leader>tm` | Toggle markdown rendering | plugins/markdown.lua |

## Terminal

| Key          | Action                | Source                 |
| ------------ | --------------------- | ---------------------- |
| `<leader>tt` | Toggle terminal       | plugins/editor.lua:169 |
| `<C-\>`      | Toggle terminal (alt) | plugins/editor.lua:174 |

## Line Wrap

| Key          | Action      | Source                 |
| ------------ | ----------- | ---------------------- |
| `<leader>tw` | Toggle wrap | plugins/editor.lua:319 |

## TMux Integration (vim-tmux-navigator)

Seamless navigation between NeoVim splits and TMux panes.

| Key     | Action                       | Source              |
| ------- | ---------------------------- | ------------------- |
| `<C-h>` | Navigate left (NeoVim/TMux)  | plugins/tmux.lua:14 |
| `<C-j>` | Navigate down (NeoVim/TMux)  | plugins/tmux.lua:15 |
| `<C-k>` | Navigate up (NeoVim/TMux)    | plugins/tmux.lua:16 |
| `<C-l>` | Navigate right (NeoVim/TMux) | plugins/tmux.lua:17 |
| `<C-\>` | Navigate to previous pane    | plugins/tmux.lua:18 |

## Completion (nvim-cmp)

| Key         | Action                            | Source                 |
| ----------- | --------------------------------- | ---------------------- |
| `<C-b>`     | Scroll docs up                    | plugins/editor.lua:101 |
| `<C-f>`     | Scroll docs down                  | plugins/editor.lua:102 |
| `<C-Space>` | Complete                          | plugins/editor.lua:103 |
| `<C-e>`     | Abort completion                  | plugins/editor.lua:104 |
| `<CR>`      | Confirm completion                | plugins/editor.lua:105 |
| `<Tab>`     | Next item / Jump snippet          | plugins/editor.lua:106 |
| `<S-Tab>`   | Previous item / Jump snippet back | plugins/editor.lua:115 |

## Line Movement (Visual Mode)

| Key | Action                   | Source             |
| --- | ------------------------ | ------------------ |
| `J` | Move selected lines down | plugins/editor.lua |
| `K` | Move selected lines up   | plugins/editor.lua |

## Treesitter Text Objects

| Key      | Action                   | Source                   |
| -------- | ------------------------ | ------------------------ |
| `<CR>`   | Init/Increment selection | plugins/editor.lua:28-29 |
| `<S-CR>` | Scope increment          | plugins/editor.lua:30    |
| `<BS>`   | Node decrement           | plugins/editor.lua:31    |

## Folding (treesitter-based)

Works for any language treesitter understands: JSON objects/arrays, functions, classes, blocks, etc.

| Key  | Action                       |
| ---- | ---------------------------- |
| `za` | Toggle fold under cursor     |
| `zo` | Open fold under cursor       |
| `zc` | Close fold under cursor      |
| `zO` | Open all folds recursively   |
| `zC` | Close all folds recursively  |
| `zR` | Open every fold in the file  |
| `zM` | Close every fold in the file |
| `zj` | Jump to next fold            |
| `zk` | Jump to previous fold        |

## Trouble (Diagnostics Panel)

| Key          | Action                       | Source                    |
| ------------ | ---------------------------- | ------------------------- |
| `<leader>xx` | Toggle workspace diagnostics | plugins/trouble.lua       |
| `<leader>xX` | Toggle buffer diagnostics    | plugins/trouble.lua       |
| `<leader>xr` | Toggle LSP references        | plugins/trouble.lua       |
| `<leader>xl` | Toggle location list         | plugins/trouble.lua       |
| `<leader>xq` | Toggle quickfix list         | plugins/trouble.lua       |
| `<leader>xt` | Toggle TODO list             | plugins/todo-comments.lua |

## TODO Comments (todo-comments.nvim)

| Key          | Action                 | Source                    |
| ------------ | ---------------------- | ------------------------- |
| `]t`         | Next TODO comment      | plugins/todo-comments.lua |
| `[t`         | Previous TODO comment  | plugins/todo-comments.lua |
| `<leader>ft` | Find TODOs (Telescope) | plugins/todo-comments.lua |
| `<leader>xt` | TODOs in Trouble panel | plugins/todo-comments.lua |

> Highlights `TODO`, `FIXME`, `HACK`, `NOTE`, `WARN`, `PERF`, `TEST` comments with distinct colors and icons.

## Text Objects (mini.ai)

mini.ai extends Vim's built-in `a` (around) and `i` (inside) text object prefixes with smarter, more powerful identifiers.

**Syntax**: `{operator}{a|i}{identifier}` — e.g. `daf`, `ciq`, `via`

| Identifier        | Meaning                        | Example                               |
| ----------------- | ------------------------------ | ------------------------------------- |
| `f`               | Function call                  | `daf` = delete around function call   |
| `a`               | Argument/parameter             | `dia` = delete inside argument        |
| `b`               | Any bracket (`()`, `[]`, `{}`) | `dib` = delete inside nearest bracket |
| `q`               | Any quote (`"`, `'`, `` ` ``)  | `ciq` = change inside nearest quote   |
| `t`               | HTML/XML tag                   | `dit` = delete inside tag             |
| `(`, `)`          | Parentheses                    | `vi(` = select inside parens          |
| `[`, `]`          | Square brackets                | `ca]` = change around brackets        |
| `{`, `}`          | Curly braces                   | `yi{` = yank inside braces            |
| `"`, `'`, `` ` `` | Specific quote type            | `ci"` = change inside double quotes   |
| `?`               | Interactive (prompted)         | Type any pair to use as text object   |

> Works with any operator: `d` (delete), `c` (change), `y` (yank), `v` (visual), `=` (format), etc.
> Also works with counts: `2daf` deletes around the 2nd enclosing function call.

## Flash (Jump/Motion)

| Key | Mode          | Action                          | Source            |
| --- | ------------- | ------------------------------- | ----------------- |
| `s` | `n`, `x`, `o` | Flash Jump (type chars to jump) | plugins/flash.lua |
| `S` | `n`, `x`, `o` | Flash Treesitter (select node)  | plugins/flash.lua |
| `r` | `o`           | Remote Flash                    | plugins/flash.lua |
| `R` | `o`, `x`      | Treesitter Search               | plugins/flash.lua |

> Flash also enhances `/` and `?` search with jump labels, and `f`/`t`/`F`/`T` character motions.

## Subword Motion (nvim-spider)

Replaces the built-in `w`/`e`/`b`/`ge` word motions so they stop at each subword boundary (camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE) instead of jumping over the whole identifier.

| Key  | Mode          | Action                       | Source             |
| ---- | ------------- | ----------------------------- | ------------------ |
| `w`  | `n`, `o`, `x` | Next subword start             | plugins/spider.lua |
| `e`  | `n`, `o`, `x` | End of subword                 | plugins/spider.lua |
| `b`  | `n`, `o`, `x` | Previous subword start         | plugins/spider.lua |
| `ge` | `n`, `o`, `x` | End of previous subword        | plugins/spider.lua |

## Marks (marks.nvim)

Adds sign-column indicators and extra navigation on top of Vim's built-in marks (`ma` still sets mark `a`, `` `a `` / `'a` still jump to it).

| Key         | Action                            | Source            |
| ----------- | --------------------------------- | ----------------- |
| `m,`        | Set next available lowercase mark | plugins/marks.lua |
| `m;`        | Toggle mark on current line       | plugins/marks.lua |
| `dm-`       | Delete all marks on current line  | plugins/marks.lua |
| `dm<space>` | Delete all marks in buffer        | plugins/marks.lua |
| `m]`        | Jump to next mark                 | plugins/marks.lua |
| `m[`        | Jump to previous mark             | plugins/marks.lua |
| `m:`        | Preview mark                      | plugins/marks.lua |

> Set/delete a specific mark the vanilla way: `ma` sets mark `a`, `dma` deletes it.

## Debugging (nvim-dap)

Language-agnostic. Every binding below works for any configured debugger
(Go, Python, Java, Ballerina).

| Key          | Action                     | Source          |
| ------------ | -------------------------- | --------------- |
| `<leader>db` | Toggle breakpoint          | plugins/dap.lua |
| `<leader>dB` | Conditional breakpoint     | plugins/dap.lua |
| `<leader>dp` | Log point                  | plugins/dap.lua |
| `<leader>dc` | Continue / start session   | plugins/dap.lua |
| `<leader>do` | Step over                  | plugins/dap.lua |
| `<leader>di` | Step into                  | plugins/dap.lua |
| `<leader>dO` | Step out                   | plugins/dap.lua |
| `<leader>dC` | Run to cursor              | plugins/dap.lua |
| `<leader>dq` | Terminate session          | plugins/dap.lua |
| `<leader>dR` | Restart session            | plugins/dap.lua |
| `<leader>dl` | Run last configuration     | plugins/dap.lua |
| `<leader>dr` | Toggle REPL                | plugins/dap.lua |
| `<leader>du` | Toggle DAP UI              | plugins/dap.lua |
| `<leader>de` | Evaluate expression (n, v) | plugins/dap.lua |
| `<leader>dw` | Watch expression (n, v)    | plugins/dap.lua |

F-key equivalents for the stepping commands, for use mid-session:

| Key     | Action                   |
| ------- | ------------------------ |
| `F5`    | Continue / start session |
| `F10`   | Step over                |
| `F11`   | Step into                |
| `S-F11` | Step out                 |
| `F6`    | Terminate session        |

### The debug UI

A session opens a 50-column sidebar and a bottom output pane:

```text
┌──────────────┬─────────────────────────────┐
│  Scopes      │                             │
│  (half the   │      source buffer          │
│   sidebar)   │                             │
├──────────────┤                             │
│  Watches     │                             │
├──────────────┤                             │
│  Stacks      ├─────────────────────────────┤
├──────────────┤   Console (program output)  │
│  Breakpoints │   + control icons           │
└──────────────┴─────────────────────────────┘
```

| Pane            | What it holds                                                   |
| --------------- | --------------------------------------------------------------- |
| **Scopes**      | Variables in the selected frame. `e` edits a value live         |
| **Watches**     | Expressions re-evaluated at every stop; type at the `>` prompt  |
| **Stacks**      | Threads and call stack. `o` on a frame moves Scopes to it       |
| **Breakpoints** | Breakpoints and their source line. `o` jumps, `t` toggles       |
| **Console**     | The debuggee's stdout/stderr, routed over DAP by `outputMode`   |

Each pane only binds the actions that make sense in it, so the same key does
different work — or nothing — depending on where you are:

| Key    | Scopes / Watches       | Stacks               | Breakpoints          |
| ------ | ---------------------- | -------------------- | -------------------- |
| `<CR>` | Expand / collapse      | -                    | -                    |
| `o`    | -                      | Jump to frame        | Jump to breakpoint   |
| `d`    | Remove (Watches)       | -                    | Delete breakpoint    |
| `e`    | Edit the value live    | -                    | -                    |
| `r`    | Send to REPL (Watches) | -                    | -                    |
| `t`    | -                      | Toggle subtle frames | Enable / disable     |

Pressing a key a pane does not bind prints `No <name> action for current line`.
Moving the cursor onto a line too long to fit pops the full value into a hover
window.

The REPL is **not** docked — `<leader>dr` slides it in and out of the bottom.
It is a prompt buffer taking Go expressions and dot-commands (`.frames`,
`.scopes`, `.threads`, `.help`), so it is only worth opening for something the
Scopes and Watches panes cannot show; stepping and evaluation already have
keymaps.

**Evaluating an expression.** `<leader>de` opens a one-shot float;
`<leader>dw` pins the same expression in Watches, where it re-evaluates at every
stop. Both take the expression from `<cexpr>` in normal mode — in `e.source`,
the cursor on the dot or on `source` gives you `e.source`, but on `e` it gives
just `e`. For anything `<cexpr>` cannot reach (`candidates[0].source`,
`len(errs)`, a call), select it in visual mode: the selection is used verbatim.
Evaluation happens in the **selected** frame, so `o` on a caller in Stacks first
lets you inspect that frame's variables.

Value **types** are hidden (`render.max_type_length = 0` in `plugins/dap.lua`).
Go reports them as fully-qualified import paths, which push the value itself
off-screen, and delve repeats the short type inside the value anyway. Set it to
`-1` to bring the column back.

### Go (nvim-dap-go)

Buffer-local, only active in `.go` files.

| Key          | Action                              | Source             |
| ------------ | ----------------------------------- | ------------------ |
| `<leader>dt` | Debug nearest test (treesitter)     | plugins/dap-go.lua |
| `<leader>dT` | Debug last test                     | plugins/dap-go.lua |
| `<leader>da` | Attach to a remote `dlv --headless` | plugins/dap-go.lua |

Configurations offered by `<leader>dc`:

| Configuration                  | What it runs                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| Debug program                  | The module's `main` package, wherever the current file lives |
| Debug program (arguments)      | Same, prompting for CLI args (pre-filled with the last ones) |
| Debug current file             | Just the current file (single-file `main` programs)          |
| Debug test (current file)      | Tests in the current file                                    |
| Debug test (package)           | Tests in the current package                                 |
| Attach remote (dlv --headless) | Connects to an already-running delve                         |

**Debugging a CLI with arguments** — set a breakpoint anywhere, including deep
in an `internal/` package, then `<leader>dc`, pick _Debug program (arguments)_
and type the args (e.g. `stow zsh -s ~/dotfiles -d ~`). `<leader>dl` replays
the same run.

The program launched is the module's `main` package, found by walking up to
`go.mod` and asking `go list`. You do **not** have to have a `main` file open —
that matters because the breakpoint you care about is usually in a library
package. Modules with several binaries under `cmd/` prompt you to choose, with
the previous pick listed first.

> Debugging the current file's _directory_ is deliberately not offered. On a
> library package `go build -o` writes a compiled archive rather than a binary,
> and the launch fails with `not an executable file`.

**Debugging a program that reads stdin**, runs in a container, or lives on
another machine — launching from nvim can't give it a terminal, so start delve
yourself and attach:

```sh
dlv debug --headless --listen=127.0.0.1:38697 --accept-multiclient -- <program args>
```

then `<leader>da` in nvim and accept the default address. Breakpoints sync
across, `<leader>dc` starts execution, and the program keeps a real TTY in the
terminal where you started delve.

> Delve ignores the `console: "integratedTerminal"` launch attribute — that
> belongs to the VS Code Go extension, not to delve — which is why remote
> attach is the route for interactive programs rather than a launch option.
>
> **Troubleshooting**: delve refuses to run against a Go release it doesn't
> recognise. After a Go upgrade, `:MasonUpdate` then reinstall `delve`.

## Go (gopher.nvim)

Code generation, buffer-local to `.go` files. The five binaries behind these
(`iferr`, `gomodifytags`, `impl`, `gotests`, `json-to-struct`) are installed by
Mason the first time you open a Go file — no `go install` needed.

| Key          | Action                                     | Command         |
| ------------ | ------------------------------------------ | --------------- |
| `<leader>Ge` | Insert an `if err != nil` guard            | `:GoIfErr`      |
| `<leader>Gj` | Add `json` struct tags                     | `:GoTagAdd`     |
| `<leader>GJ` | Remove `json` struct tags                  | `:GoTagRm`      |
| `<leader>Gy` | Add `yaml` struct tags                     | `:GoTagAdd`     |
| `<leader>GY` | Remove `yaml` struct tags                  | `:GoTagRm`      |
| `<leader>Gt` | Add `toml` struct tags                     | `:GoTagAdd`     |
| `<leader>GT` | Remove `toml` struct tags                  | `:GoTagRm`      |
| `<leader>Gi` | Generate interface method stubs            | `:GoImpl`       |
| `<leader>Gc` | Generate a doc comment for the symbol      | `:GoCmt`        |
| `<leader>Ga` | Generate a test for the function at cursor | `:GoTestAdd`    |
| `<leader>GA` | Generate tests for everything in the file  | `:GoTestsAll`   |
| `<leader>Gs` | Turn JSON into a struct definition         | `:GoJson`       |
| `<leader>Gm` | `go mod tidy`                              | `:GoMod tidy`   |

`<leader>Ge` reads the enclosing function's signature to pick the return values,
so in a `func(...) (*Config, error)` it writes `return nil, err` rather than a
bare `return`. Put the cursor on the line that produced the `err`.

The tag keys follow one rule: the letter names the format (`j`son, `y`aml,
`t`oml) and the capital removes what the lowercase adds. gomodifytags appends
rather than replaces, so `<leader>Gj` then `<leader>Gy` leaves both
`json:"..."` and `yaml:"..."` on every field. For any other tag name, call
`:GoTagAdd <name>` / `:GoTagRm <name>` directly (`db`, `mapstructure`, ...).


Other commands without keymaps: `:GoGet`,
`:GoWork`, `:GoGenerate`, `:GoTestsExp` (exported functions only).

## Testing (neotest)

| Key          | Action                             |
| ------------ | ---------------------------------- |
| `<leader>Tr` | Run the nearest test               |
| `<leader>Tf` | Run every test in the file         |
| `<leader>TA` | Run every test in the project      |
| `<leader>Td` | Debug the nearest test             |
| `<leader>TS` | Stop the running test              |
| `<leader>Ts` | Toggle the summary tree            |
| `<leader>To` | Show output for the nearest test   |
| `<leader>TO` | Toggle the output panel            |
| `<leader>Tw` | Toggle watch mode for the file     |

Tests run with `-v -race -count=1`. The `-count=1` matters: it defeats Go's test
result cache, so a green result always reflects the code as it is now.

> `<leader>Td` and `<leader>dt` both debug a test, and both end up in the same
> delve session — neotest-golang's `dap_mode` defaults to `"dap-go"`, so it
> hands over to the adapter `plugins/dap-go.lua` configures. Use `<leader>dt`
> when you are already debugging, `<leader>Td` when you are looking at a failure
> in the summary tree.

## Ballerina (ballerina.nvim)

Buffer-local, only active in `.bal` files.

| Key          | Action                                           | Source                       |
| ------------ | ------------------------------------------------ | ---------------------------- |
| `<leader>br` | Run (`:BallerinaRun`)                            | after/ftplugin/ballerina.lua |
| `<leader>bb` | Build (`:BallerinaBuild`)                        | after/ftplugin/ballerina.lua |
| `<leader>bt` | Test (`:BallerinaTest`)                          | after/ftplugin/ballerina.lua |
| `<leader>bf` | Format (`:BallerinaFormat`)                      | after/ftplugin/ballerina.lua |
| `<leader>bF` | Toggle format-on-save (`:BallerinaFormatToggle`) | after/ftplugin/ballerina.lua |

> Standard LSP mappings (`gd`, `K`, `<leader>lr`, etc.) also work in `.bal` buffers. Run/Test/Build accept CLI args passed after the command; a literal `--` separates plugin options from program arguments.

## Copy File Info

| Key          | Action                            | Source             |
| ------------ | --------------------------------- | ------------------ |
| `<leader>cy` | Copy relative path (to clipboard) | plugins/editor.lua |
| `<leader>cY` | Copy absolute path (to clipboard) | plugins/editor.lua |
| `<leader>cn` | Copy filename only (to clipboard) | plugins/editor.lua |

## Which-Key Groups

| Prefix      | Group               | Source                |
| ----------- | ------------------- | --------------------- |
| `<leader>c` | Copy                | plugins/editor.lua    |
| `<leader>d` | Debug (nvim-dap)    | plugins/editor.lua    |
| `<leader>f` | Find (Telescope)    | plugins/editor.lua:69 |
| `<leader>g` | Git                 | plugins/editor.lua:70 |
| `<leader>G` | Go (gopher.nvim)    | plugins/editor.lua    |
| `<leader>l` | LSP                 | plugins/editor.lua:72 |
| `<leader>z` | Spell/Grammar       | plugins/editor.lua    |
| `<leader>T` | Test (neotest)      | plugins/editor.lua    |
| `<leader>t` | Toggle              | plugins/editor.lua:71 |
| `<leader>x` | Trouble/Diagnostics | plugins/editor.lua    |

---

> [!TIP]: Press `<leader>fk` to search keymaps interactively with Telescope!
