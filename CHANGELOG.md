# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- tmux: stopped marking background windows with yellow underlined text (`monitor-activity` off); nvim and Claude windows redraw constantly, so it fired on tabs that were only open. Claude state glyphs and the bell colour are unchanged
- `.bestowignore`: `claude-*` also hid `bin/claude-notify`, `claude-statusline`, `claude-tmux-state` from `~/bin`; it now ignores only `claude-mods`

## [2.9.0] - 2026-10-12

### Security

- Changed Neovim to stop writing undo files for files that hold secrets (`.env` and `.env.*`, `*.env`, keys and certificates, `credentials*`, `.netrc`, `.npmrc`, `.pypirc`, `.git-credentials`, `gradle.properties`, `*.tfvars`, Ballerina `Config.toml`): `undofile` saved their text, unencrypted, under `~/.local/state/nvim/undo`, which had collected API keys and tokens from edited project files

### Added

- Added `bin/claude-notify`, wired into both Claude Code accounts' hooks, which shows a macOS notification (via `osascript`, title `Claude · <repo> (Personal|Work)`) when a session finishes (`Stop`) or needs you (`Notification`: permission prompt or idle, and `PreToolUse` on `AskUserQuestion`); subagent completion (`SubagentStop`) is opt-in with `CLAUDE_NOTIFY_SUBAGENTS=1`. It stays quiet while the terminal is frontmost and, in tmux, this pane's window is showing; repeats within 2 s send one notification; `CLAUDE_NOTIFY=0`, `CLAUDE_NOTIFY_ALWAYS=1` and `CLAUDE_NOTIFY_SOUND` adjust it. Title, body and sound are passed to AppleScript as argv, and `tests/claude/check.sh` covers it with a fake `osascript`. One-time setup: allow banners and sounds for Script Editor in System Settings > Notifications
- Added `uv` (fast Python package and project manager) to the core `Brewfile`; it appears in `show_tools` / `list_dotfiles_tools`, which read the Brewfile, and `test-zsh` checks it
- Added `bin/rebuild-env`, which rebuilds `~/.env` after sops reports `MAC mismatch` (the encrypted file was edited by hand): it keeps, replaces or removes each variable with hidden prompts, adds new ones, verifies the round trip and keeps the broken file as `~/.env.broken-mac.<time>`; `edit_secrets` now points to it when decryption fails with that error, and `test-shell-helpers` covers both
- Added the `writing-ballerina-beps` Claude skill (`SKILL.md` and `bep-template.md`) under `claude/.claude-personal/skills/`, linked into `~/.claude-personal/skills/` by `bestow stow claude`

### Changed

- Removed the `tmux-sensible` plugin: the settings the config relied on are now explicit (`status-keys emacs` for the `prefix :` prompt, which would otherwise follow `$EDITOR` into vi mode; `bind a` for the previous window; `status-interval` set before the plugins instead of after), and the unused extras it added (`prefix + R`, `prefix + C-p` / `C-n`, `aggressive-resize`) are gone. tmux starts faster because one less plugin script runs on every server start and reload
- Changed the repo-root `.bestowignore` to ignore the repo's documentation files by name (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `KEYBINDINGS.md`) instead of every `*.md`, so `SKILL.md` files in the `claude` package are linked
- Tidied the Neovim Python tooling after the move to ruff: dropped the empty `init_options` block from the `ruff` language server setup and made the comments in `formatting.lua` and `lsp.lua` say that ruff is the only Python formatter, import sorter and linter. An audit found no `black`, `isort`, `autopep8`, `yapf`, `flake8` or `pylint` left in the config, Mason or the docs; `pyright` (type checking, navigation) and `debugpy` (debugging) stay because ruff provides neither
- Refreshed the documentation to match the repo: `README.md` now covers the Claude Code accounts (`ccp`/`ccpr`/`ccpc`, `cce`/`ccer`/`ccec`, the `~/.claude` to `~/.claude-personal` symlink, `projects.d/<repo>.json`, the mods), the tmux project session layout, the Home/End binding behind `Cmd+Left/Right`, `bin/lint` and the `dev` branch flow, and drops the dead `CLAUDE.md` link, Cursor, the non-existent `.sh` suffix alias and the extra `tmux` zshrc module
- Updated `SECURITY.md` (supported versions now "latest release", the env cache in the secrets description, last-updated date), `CONTRIBUTING.md` (PRs and rebases target `dev`, `bin/lint` and `bin/lint --file`, `LINT_VENDORED`, the behavioural suites `test-zsh` runs), `bin/README.md` (script index now lists `dotdoctor`, `claude-statusline`, `claude-tmux-state`, `test-shell-helpers`, `tmux-status-claude`), `docs/TMUX_KEYBINDINGS.md` (removed "until the change is merged" caveats), `docs/CONFIG_MANAGEMENT.md` (per-file links, `dotdoctor`, the `bin` exception), `docs/PROMPT_GUIDE.md` (Atuin filter modes), `docs/SEARCH_CHEATSHEET.md` (ripgrep config defaults), `docs/README.md` (index) and the Neovim keybinding docs (undo files are not written for secrets)

### Removed

- Removed the `flutter` stow package (its only file was Flutter's generated `tool_state`) and dropped it from the package list in `init.sh`; the `flutter` cask in `packages/development.brewfile` and the `$HOME/Setup/flutter/bin` PATH entry stay. On an existing machine remove the dangling link with `rm ~/.config/flutter/tool_state`
- Removed `cleanup.sh` (a second, unreferenced copy of `bin/reset-dotfiles` that ran a bare `bestow unstow`) and `VERSION` (stuck at `1.0.0`; releases are versioned by git tags), along with their entries in `.bestowignore` and `bin/lint`

## [2.8.1] - 2026-10-12

### Fixed

- Fixed `Cmd+Left` / `Cmd+Right` typing a stray `~` instead of moving to the start or end of the line: Ghostty sends them as Home / End, tmux hands the pane `ESC [ 1 ~` / `ESC [ 4 ~`, and zsh's emacs keymap bound neither, so `03-keybindings.zsh` now binds Home and End in every form (`ESC [ H`, `ESC O H`, `ESC [ 1 ~`, `ESC [ 7 ~` and the End equivalents, plus the terminfo `khome` / `kend`)

## [2.8.0] - 2026-10-12

### Security

- Hardened the CI workflows: release and auto-tag no longer interpolate `${{ }}` expressions into shell scripts (values pass through `env:` and are quoted), release tags are validated as `X.Y.Z`, and the changelog section is matched literally. Actions are pinned to commit SHAs with a Dependabot `github-actions` weekly update, workflows start from `permissions: {}` with per-job grants (the auto-tag `check` job is read-only), `validate.yml` is `contents: read`, checkouts that push nothing no longer persist credentials, and shfmt is built with `go install` at v3.7.0 instead of a downloaded binary.
- Changed how the shell loads `~/.env`: one loader (`_dotfiles_load_env` in `.functions.d/06-dotfiles.zsh`) serves cache hits and misses, and parses `[export ]NAME=value` lines instead of `source`/`eval`, so nothing in the file runs while it loads. Single-quoted values are taken literally; double-quoted values expand only `$NAME`/`${NAME}` and the usual `\` escapes; unquoted values expand `$NAME`/`${NAME}`, and `~`/`~/...` at the start or after a `:` (as in `KUBECONFIG=~/.kube/config`). Lines with `$(...)`, backticks or other shell syntax, and a fixed list of names zsh turns into code or needs intact (prompts including `PROMPT_EOL_MARK`, `PROMPT_COMMAND`, hook arrays, `PATH`/`FPATH`/`ZDOTDIR`, `LD_*`/`DYLD_*`, `IFS`, `HOME`, `UID`, `TMOUT`, `PERIOD`, ...), are skipped and reported by name only, once per change to `~/.env` instead of in every new shell. `LANG`, `LC_*` and `TERM` load normally
- Changed the decrypted `~/.env` cache to `~/.cache/zsh/env_cache.v2`: written under `umask 077` into a `0700` `~/.cache/zsh` and renamed into place, used only while it is a `0600` file you own and its header names the `sops_mac` of the current `~/.env` (so an edit, a key rotation or a restored backup always decrypts again, and a stale cache written during an edit is never picked up). The old `env_cache` is deleted on sight: older loaders could leave a world-readable copy of the ciphertext there, which kept `ENC[...]` values and `sops_*` variables in every shell. The IDE fast path in `.zshrc` uses the same loader instead of `source ~/.env` (which ran the encrypted file as shell code)
- Changed `edit_secrets` to keep the plaintext in a private `mktemp -d` directory that is removed on exit or interrupt, run vim/nvim without swap, undo, backup or shada files, and replace `~/.env` only after the new file decrypts back to the edits. Only encrypted backups are kept (`~/.env.backup.<timestamp>`, newest 3). It now refuses to start when `~/.sops.yaml` doesn't list this machine's key, encrypts to this machine's own key (`age-keygen -y`) when `~/.sops.yaml` is missing or a dangling symlink, and edits the target of a symlinked `~/.env` instead of replacing the link (which left the plaintext target behind). When a save fails (the editor exits non-zero, e.g. `:cq`; a bare name, a multi-line value or CRLF line endings, reported by line number; an encryption error, with the offending line's contents hidden) it offers to reopen the editor, keep the plaintext copy at a printed path, or discard, instead of silently dropping the edits. A missing editor is reported as an error, not "No changes made"
- Changed `init.sh` to encrypt a plaintext `~/.env` without leaving a plaintext `~/.env.backup`: the safety copy lives in a private temp directory, the ciphertext is checked with a `sops -d` round trip before and after it replaces the file, and the copy is deleted. A symlinked `~/.env` has its target encrypted (replacing the link left the plaintext target behind), and Ctrl-C in an editor that doesn't take over the terminal no longer aborts the whole install during the `edit_secrets` step
- Changed the Touch ID setup to load `pam_reattach.so` from a root-owned copy in `/opt/pam` (`root:wheel`, mode 444) instead of the user-writable Homebrew prefix, which let any process running as you get root on the next `sudo`. `init.sh` offers to migrate an existing `sudo_local` (whatever the line's control flag, checking the result afterwards) and to refresh the copy after `brew upgrade pam-reattach`; `init.sh` and `test-zsh` check that the module and every directory above it are root-owned and not writable by group or others. The README documents how to recover if sudo stops working (`osascript ... with administrator privileges`)
- Changed `~/.sops.yaml` to a per-machine file: `bash/.sops.yaml` is no longer tracked or stowed (new machines and forks encrypted to the repo owner's age key). `init.sh` writes `~/.sops.yaml` from `bash/.sops.yaml.example` with the local key and checks that `~/.env` decrypts with this machine's key. It removes a `~/.sops.yaml` symlink that dangles or points at the repo's old file, keeps one that points at your own file listing this key, and asks before replacing any other
- Removed the `dotenv`, `layout_node`, `layout_python` and `layout_go` overrides and the `use_pyenv`, `use_rbenv`, `use_java`, `use_docker_compose`, `use_kubectl_context` and `layout_java` helpers from `direnv/.direnvrc`. The `dotenv` override sourced project `.env` files as shell code on `cd`; `use_project_env` now uses the stdlib `dotenv_if_exists` and `layout node`/`layout python3`, and `use_nvm` also finds Homebrew's nvm
- Added `.gitignore` entries for the secrets the `.bestowignore` files keep out of `$HOME` (`.env.*`, `gh` `hosts.yml`, atuin `key`/`session`/history, `*.token`, `*.key`, `*.pem`, `credentials*`), and `bin/adopt-config` now lists only file names when it finds sensitive-looking content and warns about git-ignored files it moved into the repo
- Added `test-zsh` checks for a plaintext `~/.env`, a `zsh/.env` in the repo, plaintext `~/.env.backup*` files, the env cache's permissions, a leftover pre-v2 env cache and a `~/.sops.yaml` that dangles or lacks this machine's key
- Changed the key rotation steps in `SECURITY.md` to `sops rotate -i --add-age NEW --rm-age OLD ~/.env`, which re-encrypts in place with a fresh data key. The old steps redirected `sops -e` into `~/.env` (truncating it before sops ran, with no creation rule matching the temp file) and left the plaintext in `/tmp`

### Added

- Added `bin/lint`, a single lint entry point (also run by CI): `shellcheck` and `shfmt -i 4 -ci -d` on an explicit list of bash scripts, `zsh -n` on the zsh modules and zsh scripts, `stylua --check nvim/.config/nvim`, and `claude plugin test` for every mod in `claude-mods/` with hooks (local only; skipped when `claude` is not installed, as in CI). It fails when a script in `bin/` is missing from its file lists, and also covers the Claude `statusline-command.sh` scripts. `validate.yml` now calls it
- Added a script index to `bin/README.md` covering every script in `bin/` with its language
- `test-zsh` now runs `brew bundle check --no-upgrade` against the `Brewfile` and warns about missing entries
- Added `persistence.nvim` sessions to Neovim: one session per working directory and git branch, saved on exit and never restored automatically. `<leader>qs` restores the session for the current directory, `<leader>ql` the last one, `<leader>qd` stops saving the current one, and the dashboard has an `s` button. New `<leader>q` which-key group. Sessions use `sessionoptions` without `terminal`/`blank`, so toggleterm shells and empty buffers are not saved, and a session needs two real buffers: opening a single file never overwrites the project's saved session
- Added `diffview.nvim` to Neovim: `<leader>gv` reviews the branch against the default branch (`origin/HEAD`, falling back to `origin/main`, then `origin/master`) as a merge-base diff, `<leader>gh` shows the current file's history and `<leader>gH` the repo's. `q` closes the Diffview file and history panels
- Added `neotest-python` (pytest) and `neotest-vitest` to neotest, so the existing `<leader>T…` keys run and debug Python and Vitest tests as well as Go. `<leader>Td` on a Python test debugs through the same debugpy adapter as `<leader>dc`; `thisarug/dap/python.lua` now also registers it as `python`, the adapter name neotest-python launches with
- Added `<leader>oy` to resume the last yazi session, and a `<leader>o` which-key group for the yazi mappings
- Added `<C-p>` in yazi to paste and overwrite existing files, and `=` to diff the two selected files
- Added a standard tmux session layout, shared by `prefix + f` (sessionizer) and `prefix + S` (session creator) through the new `tmux-session-layout` helper. New sessions get three windows in this order: `Long Runs` (plain shell), `CLAUDE` (starts `claude` through direnv, so the directory's `.envrc` picks the account; a blocked or failing `.envrc` still starts `claude` with the default account and direnv's message) and `NVim` (nvim on top at about 80%, a shell below at about 20%), and open on `NVim`. New sessions are created at the size of the open terminal so the 80/20 split holds when you attach. Window names are pinned (automatic rename off). Existing sessions are untouched, and `SESSIONIZER_LAYOUT=bare` (environment, or `tmux set-environment -g SESSIONIZER_LAYOUT bare` on a running server) keeps a single shell window. The sessionizer also gives two projects with the same folder name parent-qualified session names (`api`, `personal/api`), reuses a same-named session when any of its panes is already in the project, and turns `$` in folder names into `_`. The new `tmux-session-layout` and `tmux-claude-next` scripts need `bestow stow tmux` on an existing install; until then the sessionizer and session creator warn and open a bare session, and `prefix + A` says the helper is missing
- Added Claude Code state to the tmux status bar, driven by the per-window `@claude_state` option that `bin/claude-tmux-state` sets from Claude Code hooks: windows waiting on you get a red tab with `󰂞`, finished windows a green tab with `✔` (cleared when you visit them), busy ones a blue `⋯`. The right side of the status bar shows `󰂞 N waiting: sessA, sessB` through the new `bin/tmux-status-claude`, `prefix + A` jumps to the next waiting window in any session, and the `prefix + s` switcher marks sessions that have one. The status bar segment shows at most two session names, each cut to 12 characters. Terminal bell and activity got their own styles (peach tab with `!`, yellow underline) so they stay distinct from Claude state. Requires `bin/claude-tmux-state` and the Claude Code hooks that call it (the `fix/claude-mods-hardening` change); until those are merged no window ever gets a state
- Added a `☕` to the tmux status bar while the `awake` function is holding the Mac awake (its pidfile `${TMPDIR:-/tmp}/dotfiles-awake.pid` points at a live process). Requires the `awake` function (the `fix/shell-core` change); until it is merged nothing writes that pidfile
- Added a "Ghostty" section to the tmux command palette listing the Cmd shortcuts, a comment block in the Ghostty config about their dependence on the `Ctrl+a` prefix, and a `test-zsh` check that fails if the tmux prefix is no longer `C-a` (the palette-parse check also removes its throwaway tmux socket)
- Added `test-zsh` checks for tmux: every prefix binding in `tmux.conf` has a palette row (warning), every palette command parses, and the tmux helper scripts are executable
- Added `bin/dotdoctor`, a health check that never stows, fixes or deletes anything and prints one ✔/⚠/✘ line per check, exiting non-zero when anything is ✘. It reports repo files with no symlink or whose destination is blocked (`bestow stow -n` run per package so one unplannable package does not hide the rest, `bin` against `~/bin`), dangling symlinks into the repo (the checked repo, its main checkout or `~/dotfiles`), `~/.config/bestow/config.yaml` drift from the repo copy, the `~/.claude` → `~/.claude-personal` and `settings.local.json` links, a missing age key, plaintext `~/.env` or `~/.env.backup*`, a missing ControlEscape.spoon or tmux plugin manager, a `gws` on `PATH` that is not the `bin/gws` guard, and `CLAUDE_CODE_PLUGIN_DIRS` in both account `settings.json` files out of sync with `claude-mods/*/` or pointing outside the repo. A plaintext `zsh/.env` in the repo is a failure even when git-ignored. `dotdoctor --full` also runs `brew bundle check` with Homebrew auto-update and analytics off, and `claude plugin validate` on every mod with a throwaway `CLAUDE_CONFIG_DIR`. Run from a linked worktree it warns that links are compared against the worktree. `update_dotfiles` points at it after an update, and `test-zsh` checks it is present, executable and parses
- Added `prs`: fzf over `gh pr list` (extra flags pass through; needs gh, fzf and jq) with a `gh pr view` preview; `enter` checks the PR out, `ctrl-o` opens it in the browser, `ctrl-d` shows the diff through delta. Control characters in PR titles and branch names are replaced with spaces before display
- Added `prw [pr]`: `gh pr checks --watch`, then a terminal bell and a macOS notification with the result (passed, failed, cancelled, still pending, or no result when gh reports no checks or cannot be reached); the exit status mirrors `gh pr checks`
- Added `envrc work|personal|status|off`: writes a `.envrc` that pins `CLAUDE_CONFIG_DIR` and `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` (with the gws `file` keyring backend) for the directory, creates the account's gws directory with mode 700, inherits parent pins via `source_up_if_exists`, adds the file to the repo's local exclude (`info/exclude`, also from linked worktrees, confirmed with `git check-ignore`), runs `direnv allow` and applies the pin to the current shell immediately. It asks before replacing an existing `.envrc` that `envrc` did not write or that was edited since, keeps a `.envrc.bak`, and refuses a symlinked `.envrc`. `cce`/`ccer`/`ccec` set `CLAUDE_CONFIG_DIR` inline and blank `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` for the `claude` they start, `gwsp`/`gwse` set the gws account, and a bare `gws` works only inside a pinned tree; `envrc status` shows the pin in effect, where it comes from and these rules
- Added `bin/test-shell-helpers`: behavioural tests for `dotdoctor`, `envrc`, `git_ignore_local`, `prs`/`prw` and the direnv hook in a scratch `HOME` with fake `gh`/`fzf`/`claude`/`brew`; `test-zsh` runs it
- Added the `awake` function (`zsh/.functions.d/05-system.zsh`) and its `_awake` completion. `awake` holds the Mac awake in the background with `caffeinate -i` (idle sleep blocked; the display may still sleep or lock; works on AC and battery). `awake screen` also keeps the display on, `awake ac` uses `caffeinate -s` and drops on unplug, `awake for <2h|30m|90s|pid>` is timed (`-t`) or tied to a process (`-w`), and `awake stop` / `awake status` release the hold or show the mode, start time, battery percentage and floor. Starting is idempotent; starting with different settings validates them and starts the new hold before releasing the old one, so a refused or failed start leaves the current hold in place, and concurrent starts and stops from several shells are serialised by a lock. A watcher, run as its own `zsh -f` process, polls `pmset -g batt` every 60 seconds and, on battery at or below the floor (default 20, `AWAKE_BATTERY_FLOOR` or `--floor N`), releases the hold and posts a macOS notification so the Mac sleeps normally. Closing the lid still sleeps the Mac unless it is on AC with an external display. The hold's PID (and nothing else) is in `${TMPDIR:-/tmp}/dotfiles-awake.pid`; a shell with a different `TMPDIR` sees a separate hold
- Added `_extract`, `_kill_by_port` and `_awake` completions, and put `~/completions` (the stowed `zsh/completions`) on `fpath` before `compinit`; `zsh/completions/README.md` no longer claims a `.zshrc` entry that did not exist. bestow links per file, so run `bestow stow zsh` to link the new completion files into `~/completions`, then `rm ~/.zcompdump*` once so they are picked up
- Added Ctrl-T and Alt-C previews to fzf (`bat` for files, `eza --tree` for directories; Ctrl-/ toggles the preview), without touching the global fzf layout
- Added a self-contained "Shell core" section to `bin/test-zsh-config` covering the cp/mv functions, `confirm`, `kill_by_port`, `compress`/`extract`, `awake` (with stubbed `pmset`/`caffeinate`), the init cache, login PATH order and the removed names, plus a `whence` check that every alias or function named in the docs exists
- Added a Remote Control segment to the Claude Code status line, right after the account: `◉ RC` in green while the session has a Remote Control bridge, `○ RC off` in grey otherwise. Claude Code puts nothing about the bridge in the status line's JSON, so it reads `CLAUDE_CODE_BRIDGE_SESSION_ID` and, failing that, `bridgeSessionId` in the session's pid file under `~/.claude-*/sessions/`: undocumented internals that a future Claude Code version could change. It means "a bridge handle exists" and cannot tell waiting from attached from reconnecting; an outbound-only mirror session shows `RC` too. Both accounts now re-run the status line every 5 seconds (`statusLine.refreshInterval`), since toggling `/remote-control` raises none of the events that normally refresh it
- Added `bin/claude-tmux-state` and Claude Code hooks in both accounts that mark the tmux window a session runs in: the window option `@claude_state` becomes `working` on each prompt (and again after a tool runs once Claude Code stopped waiting for you), `waiting` when Claude Code asks for attention, `done` when a turn ends or fails on an API error, and is cleared when the session ends. It is silent and always exits 0, does nothing outside tmux, and leaves the window alone for a `claude` started inside another session (a nested `claude -p` inherits `TMUX_PANE`); drawing the marker is left to the tmux config
- Added per-project Claude Code settings for the personal account: `ccp`, `ccpr` and `ccpc` now also load `~/.claude-personal/projects.d/<repo>.json` (named after the main checkout's directory, so a linked worktree uses its repo's file) through `--settings` when it exists. A project's own autoMode rules go there instead of this public repo; Claude Code reads autoMode only from user, `--settings` and managed settings. Without the file they run plain `claude` as before
- Added `tests/claude/check.sh`, run by `test-zsh`: golden output for the status line (12 cases, both accounts, expected lines taken from the previous scripts), the RC segment from the environment and from the pid file, the tmux state hook against a private tmux server, the hooks and refresh interval in both settings files, `ccp`'s project file lookup (subdirectory, worktree, none), and a guard that fails when tracked Claude settings name a private project: a path under a home directory outside dot-directories and `~/dotfiles`, or a match for a pattern in the optional untracked `~/.config/dotfiles/private-patterns` (one extended regex per line, `#` lines skipped; an invalid pattern fails the check rather than passing it)
- Added a `blast-radius` register test (`register.test.ts`): asks before running, denies when cancelled or unanswered, still asks when a preview fails or times out, and previews in the directory the command runs in
- Added the `conventions` Claude Code mod, loaded by both accounts: after each Edit or Write it checks the file and, only when something is wrong, adds a short note for Claude naming the problem and the fix command. It flags tab indentation (Makefiles, Go, git config and `.tsv` files excepted, as are Markdown code fences and shell here-documents), token-shaped literals in test files and fixtures (the distinctive token shapes the `redact` mod hides; build them at runtime instead), and whatever `bin/lint --file <path>` reports for that file. It is advisory: it never blocks an edit, each check is killed after 3 s, files over 256 KiB and missing tools are skipped silently, and a note is not repeated while it is unchanged for that file. On by default in the dotfiles repo (any checkout or worktree); another repo opts in with `.claude/conventions.json` (`{"enabled": true, "checks": ["tabs", "shfmt", "zsh", "stylua", "fixtures"]}`), where it runs `shfmt -i 4 -ci -d`, `zsh -n` or `stylua --check` by file type. `/conventions [on|off]` toggles it for the session
- Added `bin/lint --file <path>`: lints one file with the checks the full run would apply to it (shellcheck and shfmt for the listed bash scripts, `zsh -n` for the listed zsh files, stylua for Neovim Lua, and a new script in `bin/` missing from the lists), printing only problems, each with a `fix:` line, and exiting 1 on any

### Changed

- Changed the tmux status and hook plumbing to spawn fewer processes: the `window-layout-changed` and `pane-exited` hooks use `if-shell -F` with a `#{>:#{window_panes},1}` format (no `/bin/sh` per layout event, e.g. while dragging the window edge), tmux-resurrect saves with the `pgrep` command strategy (about half the CPU of the default `ps` one per pane)
- Changed the ripgrep config to exclude `.git`, `node_modules`, `.cache` and `.npm` at any depth (`--glob=!**/.git/**` and so on); the old `!.git/*` style globs were anchored to the search root, so `rg` run from a parent of many repos still searched every nested repo's `.git` internals and `node_modules`. A file listing of `~/Projects` drops from about 188k to about 137k files. A directory named `.cache` or `.npm` is now skipped at any depth too (use `rg --no-config` or `-g '.cache/**'` to search one)
- Changed zsh-autosuggestions to set `ZSH_AUTOSUGGEST_MANUAL_REBIND=1`, so it no longer re-wraps about 200 widgets before every prompt (about 10 ms per prompt), and to start from its turbo `atload` so suggestions work from the first prompt instead of after the first command. Widgets added later (the `sudo` snippet, direnv) are not wrapped, so a suggestion may linger until the next keystroke after them
- Changed `.zshrc` to run the tmux auto-start before the p10k instant prompt, so a new terminal window no longer flashes a prompt that tmux immediately covers
- Changed the `claude-tmux-state` hooks (UserPromptSubmit and PostToolUse) in both Claude accounts to `async: true`, so they no longer block each prompt and tool call (Notification, Stop, StopFailure and SessionEnd stay synchronous so a late `waiting` cannot land after `done`). `bin/claude-tmux-state` now finds nested `claude` processes by walking the parent chain with `ps -p` instead of listing every process, and sets the window option and refreshes the client in one `tmux` call
- Changed the Claude Code status line to refresh every 15 s instead of 5 s (`refreshInterval` in both accounts; the interval only exists so a `/remote-control` toggle shows up, normal events still refresh immediately), and trimmed forks in `bin/claude-statusline`: jq now also emits the escape, tab and separator characters, `basename` and the `cut` pipeline are plain parameter expansion, git pipes straight into awk, and the RC check greps the session file instead of running a second jq. Output is byte-identical
- Documented the `dev` branch workflow in `CONTRIBUTING.md`: PRs squash into `dev` (no release), then one rebase-merge of `dev` into `main` cuts a single release whose version bump is read from the individual commit types
- Changed the lazy direnv hook to load when the current directory or any parent has a `.envrc` (checked on every `cd` and once at the first prompt), so pins apply in subdirectories and in new shells or tmux panes opened inside a pinned tree; directories with no `.envrc` above them still never load direnv
- Changed `list_dotfiles_tools` to build the inventory from `Brewfile` and `packages/*.brewfile`, with each entry's comment as its description
- Formatted `bin/adopt-config`, `bin/profile-startup`, `bin/reset-dotfiles` and `bin/sync-brewfile` with `shfmt -i 4 -ci`
- Changed the LSP navigation keys in Neovim to the built-in `grr` (references), `gri` (implementations) and a new `grt` (type definitions), each opening a Telescope picker. The custom `gr` and `gi` are gone: a bare `gr` made every `grr`/`gri`/`grn`/`gra` wait for `timeoutlen`, and `gi` shadowed the built-in "insert at last insert position". `grn`, `gra` and `gO` stay as shipped
- Changed the yazi diff plugin from `<C-d>` to `=`, so `<C-d>` is the built-in half-page-down again (`<C-u>` / `<C-d>` now both scroll, as the docs said)
- Rewrote the Neovim keybinding docs (`KEYBINDINGS.md`, `docs/nvim/keybindings_cheat_sheet.md`, `docs/nvim/ADDING_KEYBINDINGS.md`, `docs/YAZI_KEYBINDINGS.md`) to match the config: source columns cite files instead of drifted line numbers, the `<leader>en`, `<leader>ep`, `<leader>vg`, `<leader>fg` multi-grep syntax and F-key rows are listed, and `ADDING_KEYBINDINGS.md` gained a "check for clashes" checklist
- Changed the `agents` mod so the per-agent rows above the prompt no longer repeat the agents pane. The new option `rows` (set it in `/config` or under `pluginConfigs.agents.options.rows`) is `auto` by default and draws the rows only while the pane is not showing (closed with the mark or `/agents-pane`, still waiting below its width floor, or a tab behind another pane). `off` never draws them; `always` keeps the old behaviour, which you need if the engine's diff panel covers the pane, since a mod cannot see that. `rabe` is unchanged: its band is a single line of counts and has no agent-count option
- Changed the latest-tool column of the `agents` mod to show a Bash call's own description (`Bash Read tmux sessionizer`) when the agent wrote one, falling back to the raw command, and to trim the text to the available width instead of a fixed 40 characters
- Changed `prefix + s` documentation and the command palette to describe the fzf session switcher; both still described the old tree view
- Changed tmux-sessionist's join-pane key from `t` to `J` (`t` is the floating terminal) and documented that our `S` replaces its "last session" key (`Tab` does that)
- Changed the tmux status bar to refresh every 15 seconds (set after the plugins load; tmux-sensible would otherwise lower it to 5), the sysinfo segment to one `sysctl` call, and the battery segment to turn red below 20% while discharging
- Changed Ghostty `Cmd+Delete` to send `Alt+k` (bound to `kill-line` in zsh) because tmux's root `Ctrl+k` pane navigation swallowed the old `Ctrl+k`; tmux turns `Alt+k` back into `Ctrl+k` in every pane except nvim and fzf, so Claude Code and other programs still get their own kill-to-end-of-line (nvim in insert mode treats it as `Esc k`), and Ghostty `Option+Left/Right` to send `Alt+b` / `Alt+f` explicitly. Corrected the stale comments in `03-keybindings.zsh`
- Changed `cp` and `mv` from aliases (`cp -riv`, `mv -iv`) to functions that add `-iv` only when running in an interactive shell on a terminal. zsh expanded the aliases inside every function body and in shells with no terminal (scripts, agents), where the prompt could not be answered, and `cp -R` failed with "-R and -r options may not be specified together". `-r` is no longer forced: use `cp -R` for directories. Functions run from an interactive terminal still get the prompting versions unless they call `command cp` / `command mv`, and `sudo cp` / `sudo mv` run the plain commands without `-i`
- Changed `kill_by_port` to act on listeners only (`lsof -nP -iTCP:PORT -sTCP:LISTEN`) instead of every process with a connection to the port, which could kill a browser or other client. It now sends SIGTERM, waits about a second and SIGKILLs only the survivors. It looks at TCP only (its help says so), never signals the calling shell or its parent, and refuses more than one port
- Changed `compress` and `extract` to print usage and return non-zero on bad input, strip a trailing slash (`compress dir/` makes `dir.tar.gz`), accept several arguments, refuse to overwrite an existing archive, add `.tar.xz`, `.txz`, `.tar.zst` and `.xz`, and prefer `unar` for rar, 7z and zip when it is installed
- Changed `confirm` so answering `q` returns status 2 instead of running `exit 0`, which closed the terminal when called from `update_dotfiles` or `edit_dotfiles`; with no input available it also returns 2 rather than looping
- Changed `edit_dotfiles` to use zsh's `read "var?prompt"` syntax (the bash-only `read -p` form failed under zsh), to open the real files for the git config (`git/.config/git/config`) and Neovim (`nvim/.config/nvim/init.lua`) menu entries, and to keep its backups in a private temp directory instead of next to the dotfile
- Changed `brew-sync` and `bin/sync-brewfile` into read-only drift reports (installed but in no Brewfile; declared but not installed) across `Brewfile` and `packages/*.brewfile` instead of rewriting the core `Brewfile` from everything installed
- Changed `lg` into a function that forwards its arguments to `lazygit`
- Changed the shell integration cache (`fzf`, `zoxide`, `atuin`) to be written to a temp file and published only when the init command succeeded with output, and keyed on the binary's resolved path, so a failed init no longer leaves an empty cache and a Homebrew upgrade refreshes it
- Changed `XDG_*` exports from `.zprofile` to `.zshenv` so non-login shells see them too (values unchanged)
- Changed the global gitignore: the Gradle and Maven wrapper jars are re-included after `*.jar`, `Cargo.lock` and `vendor/` are no longer ignored, `*.com` (which matched directories such as `vendor/github.com`) is gone, and duplicated entries are removed
- Changed Atuin: Ctrl-R opens on `global` history and cycles global, workspace, directory, host, session; full style with the search bar on top (`invert`) and tabs shown. Up-arrow behaviour and `enter_accept` are unchanged
- Changed the docs and in-shell help to the real alias names: `fdg`/`fdh`/`fda`/`rgh` in `docs/SEARCH_CHEATSHEET.md`, `gca` for amend, no `cat`/`less` aliases, and Ctrl+R in place of a non-existent Option+H
- Changed both accounts' status lines to one shared script, `bin/claude-statusline`, that the two `statusline-command.sh` files exec with their label, colour and cost mode. It makes one `jq` call and one `git status --porcelain=v2 --branch --no-ahead-behind` per refresh (a detached HEAD adds one `git rev-parse --short`), where each script made six `jq` calls, up to three `git` calls and three `awk` passes. The output is unchanged apart from the RC segment
- Changed the personal account's settings to carry a generic `autoMode` environment, modelled on the enterprise one, that names no project
- Changed the `blast-radius` mod to see through git's global options (`git -C /repo reset --hard`, `git -c k=v push -f`, `--git-dir`, `--work-tree`), git's abbreviated long options (`git reset --ha`, `git push --mirro`), the option values of `sudo`, `doas`, `env`, `nice`, `xargs`, `time`, `timeout`, `caffeinate`, `stdbuf`, `ionice` and `watch` (plus `chronic`, `setsid`, `coproc`, `unbuffer`), subshells, `bash`/`sh`/`zsh -c` payloads, `eval`, `env -S`, here-strings and pipes into a shell (`bash <<< '...'`, `echo '...' | sh`), heredocs a shell reads, `ssh host '...'` (shown as remote, not previewed), `case` branches, function bodies, and `$(...)`/backtick substitutions (two levels deep; anything nested deeper that mentions a destructive command still asks). It reads quotes, `$'...'`, backslashes, comments, redirections (`2>&1`, `2>/dev/null`, a leading `>out`) and heredocs as the shell does, so `echo 'a\'; git push -f` and `# don't\ngit push -f` are caught, and a quote that never closes cannot hide the lines after it. It also asks before pushes that delete remote refs (`--delete`, `-d`, `:branch`, `--mirror`, `--prune`), `find -delete` and `find -exec rm`, `xargs rm`, `rsync --delete`, `git checkout -f`, `git checkout .`/`git restore .` (the whole tree), `git switch --discard-changes` and `git stash clear`; and it guards `Monitor` commands as well as `Bash`
- Changed the `blast-radius` previews to run where the command runs (a leading `cd`, `git -C`, `env -C`), to pass `--git-dir`/`--work-tree` on, to dry-run `git clean` with the same `-d`/`-x`/`-X`, `-ff`, `-e` and paths, and to list what `find -delete`/`-exec rm` would match (never running a `find` with another `-exec` or `-ok`; a `find` that fails says "unavailable"). Preview `git` calls run with `core.fsmonitor` and the untracked cache off and `GIT_OPTIONAL_LOCKS=0`, since they run in a directory the command names before anyone agreed to it. A preview that fails or times out now says "unavailable" and still asks instead of denying without a prompt; an unanswered question still denies
- Changed the `redact` mod to also hide `GITHUB_TOKEN=`/`packagePAT=`/`githubToken:`-style values, Bearer tokens, `Authorization` headers, passwords in URLs (`scheme://user:password@host`; demo values such as `postgres:postgres@`, `guest:guest@`, passwords on `localhost`/`127.*` and `Bearer YOUR_TOKEN_HERE` are left alone so compose files and READMEs can be read and written back), Stripe `sk_`/`rk_` live and test keys, and GitLab `glpat-`, npm `npm_` and Hugging Face `hf_` tokens
- Changed the `statusbar` mod's compact marker, `~N turns left`, legend `compact` figure and "compaction is close" toast to follow the compaction threshold Claude Code reports in its context breakdown. The breakdown already measures against the personal account's `autoCompactWindow` of 500k; when the threshold is missing, the window less its compaction reserve is used, then the `autocompactPercent` option, which is now only that fallback. There is no marker when auto-compaction is off
- Changed the `blast-radius` `rm` and `chmod -R` previews to count entries with `find "$1" | wc -l` (the path is a positional argument, never part of the script) instead of reading every path into the hook, and to run each target's count and `du` together and the targets side by side, so the question appears sooner on a big tree
- Changed `bin/lint` to skip `claude plugin test` for the vendored `claude-mods/rabe` (about 25 of its 31 seconds) unless it differs from the merge base with `origin/dev`/`origin/main` or `LINT_VENDORED=1` is set; the other mods are always tested, and a skip line says why
- Changed `test-zsh`'s `brew bundle check` to run with `HOMEBREW_NO_AUTO_UPDATE`, `HOMEBREW_NO_ANALYTICS`, `HOMEBREW_NO_ENV_HINTS` and `HOMEBREW_NO_INSTALL_CLEANUP` set, as `dotdoctor` does, so it no longer auto-updates Homebrew (network, writes to its repo) as a side effect
- Changed `init.sh` and `bin/reset-dotfiles` to read the installed formulae and casks once (`brew list -1 --formula` / `--cask`) instead of starting a `brew list` process per package
- Changed Neovim to skip expensive per-buffer work on big files (over 1.5 MB or 50k lines, thresholds in `lua/thisarug/bigfile.lua`): treesitter highlighting and expr folds stay off (a one-time notice says so; `:set foldmethod=expr` re-enables folds), format-on-save is skipped (`<leader>lf` still formats), and the statusline word count and JSON path return nothing. On a 7 MB JSON, opening dropped from about 1.9 s to about 0.12 s and saving from 3.4 s (ending in a formatter timeout) to about 0.08 s. Normal files are unchanged
- Changed lualine's `refresh_time` from the default 16 ms to 100 ms to cut steady idle redraw work per Neovim instance (statusline, tabline and winbar already refresh every 1000 ms by default); event-driven updates may lag by up to ~100 ms
- Changed Python formatting in conform from `isort` + `black` (pyenv shims) to `ruff_organize_imports` + `ruff_format` (the Mason-installed ruff already used as the LSP): a save drops from about a second to tens of milliseconds. Ruff reads only `[tool.ruff]` / `ruff.toml`, so any `[tool.black]` / `[tool.isort]` config in a project is ignored (default line length 88). Output is black-compatible but not byte-identical, and imports are ordered by ruff's `I` rules rather than isort's defaults, so a project formatted with black/isort may see small diffs on first save

### Removed

- Removed the dead Python tooling that read the long-gone `packages.json`: `bin/generate-brewfile`, `bin/manage-packages` and the `manage_packages` function; removed the stale `packages.json` mentions from `SECURITY.md` and `CONTRIBUTING.md`
- Removed `bin/reload-nvim-config`
- Removed `nvim/.config/nvim/lua/plugins/telescope/multigrep.lua`, a dead duplicate of the multi-grep picker defined inline in `telescope.lua` (its `setup` was never called). Run `bestow stow nvim` and delete the dangling `~/.config/nvim/lua/plugins/telescope/multigrep.lua` symlink
- Removed `nvim/.config/nvim/lua/plugins/telescope/multigrep.lua`, a dead duplicate of the multi-grep picker defined inline in `telescope.lua` (its `setup` was never called). Run `bestow stow nvim` (it links per file, so it is also needed for the new `persistence.lua`) and delete the dangling `~/.config/nvim/lua/plugins/telescope/multigrep.lua` symlink
- Removed the `Alt+Arrow` pane-switching binds from tmux (Alt+Left/Right now do word navigation in the shell), and the dead `y` copy-mode line that tmux-yank overrode
- Removed `setup_environment` from `init.sh`, which copied `.env.example` to `zsh/.env` inside the repo, where nothing read it and a filled-in copy was one `git add -f` from being published
- Removed the empty `noto` package (it held only a `.bestowignore`)
- Removed the `dont_sleep` alias and the `stay_awake`, `stay_awake_stop` and `stay_awake_for` functions; `awake` replaces them (`awake`, `awake stop`, `awake for <pid>`, `awake screen`)
- Removed the `brew-sync-optional` and `brew-check-optional` aliases (they pointed at a `Brewfile.optional` that does not exist), the `remove_dotfiles_tool` function (it reported success without changing anything), the `adopt-config` shell function (it shadowed `bin/adopt-config`, used GNU stow and wrote to a shared `config/` package), and the `.` alias for `pwd` (it broke `. .venv/bin/activate`)
- Removed `autocompact_percentage_override` from the personal account's settings: Claude Code never read that key, so it had no effect

### Fixed

- Fixed new tmux panes losing the p10k instant prompt and compinit caches: tmux started `/bin/zsh` while the login shell and `reload` use Homebrew's zsh, and each binary deletes the caches stamped by the other (new panes showed the prompt about 230 ms late instead of about 30 ms). `tmux/.tmux.conf` now sets `default-shell` and `default-command` to `/opt/homebrew/bin/zsh`, then `/usr/local/bin/zsh`, then `/bin/zsh`, whichever exists first (restart the tmux server to apply it)
- Fixed `.zcompdump` staying stale forever: `compinit -i` leaves an unchanged dump's mtime alone, so after 20 hours every shell took the full `compinit -i` path (about 25 ms slower) and re-ran `zcompile` in the background. The dump is now touched after the full init, and the `.zwc` is rebuilt only when missing or older than the dump, written under a temp name and renamed into place
- Fixed the `blast-radius` previews under-counting big trees: the engine cuts process output at 4 MiB, so an `rm -rf` of a 100k-file tree reported about a third of its files. Counts now come from `wc -l`, and a `find -delete` preview that hit the cap says `Would delete N+ entries`
- Fixed the session creator (`prefix + S`): names such as `-n` were swallowed, a failing layout helper still printed "Created session", and `/` in a name was replaced with `_` (it now stays, matching the sessionizer's `work/api` names; `$` becomes `_`)
- Fixed the command palette's section headers showing trailing dashes, and documented that `prefix + J` (join pane) needs a second key (`h`, `v`, `%`, `"`, `|`, `-`, `f` or `@`)
- Fixed the tmux command palette (`prefix + ?`): most entries failed because the selected command was word-split into `tmux $cmd`, so quoted arguments, `;` and `~` broke (reload, rename, popups). Commands now run through `tmux source-file` after the palette popup closes, the `prefix + |` row displays correctly, and the reload row chains its commands with a plain `;`
- Fixed the `alias_help tmux` text, which listed `Ctrl+f` as the sessionizer key (it is `prefix + f`)
- Fixed `git_ignore_local` in linked worktrees and submodules (it resolves `info/exclude` with `git rev-parse --git-path`), when the exclude file lacks a trailing newline, and for entries that are already present (it now says so instead of appending a duplicate)
- Fixed release notes being empty: the changelog extraction for a release now returns the full section for that version.
- Fixed `bin/reset-dotfiles` using an undefined `PURPLE` colour and removed an unused variable from `bin/sync-brewfile`
- Fixed `<C-\>` in Neovim opening a terminal instead of jumping to the previous tmux pane: removed toggleterm's `open_mapping`, which shadowed vim-tmux-navigator. The terminal stays on `<leader>tt`
- Fixed the yazi resume key: `<C-Up>` is taken by macOS Mission Control and never reached the terminal, so it moved to `<leader>oy`
- Fixed the Neovim dashboard `g` button, which called a `live_grep_args` Telescope extension that was never installed
- Fixed which-key labelling `<leader>u` and `<leader>a` for keys that are really `<leader>tu` (undotree) and `<leader>ta` (outline), and added the missing `<leader>th` label
- Fixed the Neovim and yazi docs listing keys that don't exist (`<leader>cw`, `<leader>xs`, `<S-CR>`, a duplicated `<leader>xt`, `{`/`}` for aerial)
- Fixed the `agents` mod's `/agents` command never registering: `/agents` is Claude Code's own command, so the registration was refused and threw, which aborted the rest of the `session.start` hook and left the 1-second clock unstarted, so a running agent's elapsed time never ticked. The toggle is now `/agents-pane`, the clock starts first, and a refused registration is caught instead of aborting the hook
- Fixed the `agents` pane hiding agents behind a "+N older" line: it now lists every agent (the last 100) and scrolls with the mouse wheel instead of capping at a row count. The band above the prompt keeps its cap of 6 and points at `/agents-pane` for the rest
- Fixed encrypted `~/.env` detection: sops encrypts dotenv files value by value, so the old "first line starts with `#ENC[`" test failed for files that don't start with a comment. The shell, `edit_secrets` and `init.sh` now look for the `sops_mac=` line. In `init.sh` this made the secrets step restore the plaintext and abort the whole install
- Fixed `init.sh` exiting silently under `set -e` when `test_installation` counted its first error (`((errors++))` from 0); the secrets step and the final test now report problems and let the installer finish
- Fixed `edit_secrets` reporting "saved" when the save didn't happen: it calls `command cp`/`command mv` (the `cp`/`mv` aliases prompted inside the function) and checks the move before printing success
- Fixed every `git commit` failing on a fresh machine: `git/.gitconfig.local.example` now sets `signingkey = ~/.ssh/id_ed25519_signing.pub`, and `init.sh` warns when the configured signing key is missing and offers to create it
- Fixed tmux on a fresh machine failing on its `run tpm` line: `init.sh` installs TPM at `v3.1.0` (checked against the tag's commit) and the plugins
- Fixed the SDKMAN installer pipe running on an HTTP error page (`curl -fsSL`)
- Fixed Intel Macs: `.zprofile` detects the Homebrew prefix (`/opt/homebrew` or `/usr/local`) and the nvm stubs, `profile-zsh-startup` and `test-zsh` use `$HOMEBREW_PREFIX`
- Fixed `init.sh` skipping the `colima` package when stowing
- Fixed `init.sh` treating a `sudo_local` whose `pam_tid` line is commented out (a copy of macOS's template) as "Touch ID already configured", and inserting the `pam_reattach` line before commented-out `pam_tid` lines; a fresh setup now backs up an existing `sudo_local` and keeps its lines instead of overwriting it
- Fixed non-interactive login shells (`zsh -l -c ...`) exiting 1 when `~/.local/bin/env` is missing: it is now sourced only if present, and the duplicate source in `.bash_profile` is gone
- Fixed login shells running Homebrew's node instead of the nvm default: `.zprofile` puts the nvm default's `bin` back in front after `path_helper` and the Homebrew PATH, and the version lookup in `.zshenv` is anchored so `22.2` no longer matches `v22.22.2`. `.zshenv` also resolves `lts/*` through nvm's alias files, and a default that is not a version (`node`, `system`) or an unresolvable alias now leaves PATH alone instead of printing `no matches found` in every zsh
- Fixed the `blast-radius` mod prompting on commit, tag and merge messages that mention a delete (`git commit -m "never rm -rf the cache"`, `-m "drop table support"`, heredoc messages), and on quoted heredocs written to files or PR bodies (`cat > notes.md <<'EOF'`, `gh pr create --body "$(cat <<'EOF' ...)"`); a `$(...)` inside a message or an unquoted heredoc is still checked
- Fixed the `redact` mod replacing code that names a secret (`config.apiKey`, `process.env.API_KEY2`, `secretKey`, `db_password`) with a placeholder, which broke `Edit` calls on those lines and wrote the placeholder into files rewritten with `Write`. `SECRET_KEY=` and `secret_key:` values are now caught (the name rule stopped at `secret`)

### Upgrade notes

- `~/.sops.yaml` was a symlink to the repo's `bash/.sops.yaml`, which this release removes, so after pulling it dangles. `edit_secrets` keeps working (it encrypts to this machine's key), and `./init.sh` replaces the link. To fix it by hand, remove the link first (writing through a dangling link would recreate the file in the repo): `rm ~/.sops.yaml && sed "s/AGE_PUBLIC_KEY/$(age-keygen -y ~/.config/sops/age/keys.txt)/g" ~/dotfiles/bash/.sops.yaml.example > ~/.sops.yaml`
- `~/.env` entries the new loader skips are named on stderr the first time a shell loads them (unsupported syntax such as `$(...)`, or a reserved name such as `PS1`/`PATH`); set those in your shell config instead. Unquoted `~` and `$NAME` in values still expand, as they did when the file was sourced
- `direnv/.direnvrc` no longer overrides direnv's standard library, so existing `.envrc` files change behaviour:
  - `use pyenv`, `use java`, `use docker_compose`, `use kubectl_context` and `layout java` now fail with "command not found". For Python versions use direnv's `layout pyenv 3.12` (it creates the virtualenv too); run `sdk use java ...`, `kubectl config use-context ...` or define aliases yourself
  - `use rbenv <version>` now runs direnv's own `use_rbenv`, which only does `rbenv init` and ignores the version; pin it in `.ruby-version`
  - `layout python <version>` now takes a Python executable (`layout python python3.12`), and creates the virtualenv in `.direnv/python-<version>` instead of `.venv`
  - `layout go` now puts `GOPATH`/`GOBIN` under `.direnv/go` instead of setting `GOPATH` to the project directory
  - `use project_env` no longer switches Node versions (`layout node` only puts `node_modules/.bin` on `PATH`; add `use nvm <version>`), no longer sets up Go, Java or Docker Compose projects, and its Python virtualenv moves from `.venv` to `.direnv/python-<version>`
  - `dotenv` parses `.env` instead of running it as shell code, so lines that relied on command substitution or other shell syntax stop working

## [2.7.0] - 2026-10-11

### Added

- Added the `agents` mod (`claude-mods/agents`): a `/agents` pane that opens when the first subagent of a batch starts, and one row per running subagent above the prompt, which stays visible when the engine's diff panel takes the pane's seat. Each subagent gets a crab costume by type (Explore, Plan, review, security, test, guide, design, fork, general) and shows its model, effort, a context-fill bar, output tokens, model requests, tool calls, the latest tool call and elapsed time. It registers no tools and makes no network or process calls
- Added `rabe` as a vendored, unmodified mod (`claude-mods/rabe`, pinned commit in `VENDORED.md`) for background shells, monitors, cron jobs, workflows and Codex jobs

### Changed

- Changed the `statusbar` band to draw alongside other mods that use the area above the prompt instead of replacing them
- Changed the status bar under the prompt (`statusline-command.sh`, both accounts) to start two no-break spaces in from the left edge and spread its segments across the terminal width instead of clustering them on the left: the gap between segments is whatever width is left over, kept between 3 and 8 columns (5 when the terminal width can't be read). Segments are now measured and joined before printing, with the colours held as real escape bytes
- Changed the 5h and 7d limit bars in the `statusbar` mod to grow with the terminal width (6 to 40 cells, from a fixed 10) so they line up with the context bar above them

### Removed

- Removed the `mission-control` mod; `agents` replaces it. It recorded only an agent's type, label and running or done, and none of the model, effort or token data

## [2.6.1] - 2026-10-06

### Changed

- Changed the `blast-radius` mod to stop prompting on `git push --force-with-lease`, which refuses to overwrite remote commits you haven't seen. Plain `--force`, `-f` and `+refspec` pushes still ask, and unanswered prompts still deny.

## [2.6.0] - 2026-10-06

### Fixed

- Fixed `brew_update` never actually updating Claude Code — swapped `Brewfile`'s `cask "claude-code"` for `cask "claude-code@latest"`. The plain cask lags homebrew-cask's bump cadence (observed 32 versions behind npm's latest), and Claude Code's own auto-updater is a permanent no-op once it detects a Homebrew install (`claude update` reports "managed by Homebrew" and stops), so there was no path to current versions at all. The `@latest` cask tracks releases far more tightly and `claude update` now checks against the "latest" channel instead of "stable"
- Fixed nvim-treesitter unable to compile any parser it doesn't already ship a prebuilt binary for — `:TSInstall` shells out to the `tree-sitter` CLI, which was never a tracked dependency (`Brewfile`). Every parser installed before now had either come bundled with nvim-treesitter or been compiled on a machine that happened to have it from some other project; a language added fresh (e.g. Groovy) failed silently with `ENOENT: no such file or directory (cmd): 'tree-sitter'` and fell back to no syntax highlighting at all. Added `tree-sitter-cli`

### Added

- Added `googleworkspace-cli` (`gws`) with two isolated accounts: `gwsp` (personal) and `gwse` (enterprise), each with its own config dir, OAuth client and credentials under `~/.config/gws-<name>/`. They are scripts in `bin/` rather than aliases so agents and non-interactive shells get them. `bin/gws` shadows the real binary and refuses to run without an account context, and `bin/gws-account` is the shared helper that pins the file keyring backend. `test-zsh` checks both wrappers and that bare `gws` stays blocked
- Added Groovy/Gradle scripting support to Neovim: `nvim-treesitter` parser (`nvim/.config/nvim/lua/plugins/editor.lua`), and `groovyls` on the `groovy` filetype (which Neovim already maps `.gradle`, `.groovy`, and `Jenkinsfile` to), mason-installed with root markers covering both Gradle DSLs (`nvim/.config/nvim/lua/plugins/lsp.lua`). vscode-gradle's `gradle_ls`, which would have added Gradle-aware task/dependency completion, was tried and dropped — its language server only speaks over a named pipe that VS Code's own extension code creates and hands it the name of; it has no stdio mode, so Neovim's spawn-and-talk-over-stdio LSP client can't drive it (confirmed by decompiling its `main()` — it wraps `args[0]` straight into a `NamedPipeStream` with no fallback). `npm-groovy-lint` (CodeNarc) was tried for diagnostics and full-ruleset formatting but dropped from both — its rulesets assume application code, not a build DSL, so every `build.gradle` lit up with irrelevant style warnings and there's no CodeNarc "Gradle" ruleset to swap in instead. It's still wired into conform (`nvim/.config/nvim/lua/plugins/formatting.lua`) as a formatter, but scoped via `-r` to just the `Indentation`/`IndentationClosingBraces`/`IndentationComments` CodeNarc rules — the only part of its default ruleset that's universally correct for a build script. Trailing-whitespace trimming comes from the existing filetype-agnostic `trim_whitespace` formatter instead of CodeNarc's own `TrailingWhitespace` rule

## [2.5.0] - 2026-10-06

### Added

- Added `claude-mods/` — five Claude Code mods loaded straight from the repo by both accounts via `CLAUDE_CODE_PLUGIN_DIRS`: `statusbar` (stacked context bar with compact marker and legend, `~N turns left`, 5h/7d limits, last-turn stats, prompt-cache countdown, threshold toasts), `blast-radius` (preview-and-confirm for risky Bash commands), `redact` (strips secrets from prompts and tool output), `mission-control` (`/mission-control` pane) and `session-wrapped` (`/wrapped` summary)

### Changed

- Slimmed the Claude Code status line scripts to account, vim mode, directory, git, model, session cost and token count — the context bar and rate limits now live in the `statusbar` mod. `WORK` is now peach instead of mauve so it is clearly distinct from the blue `PERSONAL`
- Raised `autoCompactWindow` in the personal account from 300k to 500k tokens, a leftover from a smaller plan

## [2.4.0] - 2026-09-10

## [2.3.0] - 2026-08-13

### Fixed

- Fixed `.github/workflows/auto-tag.yml` reporting success after pushing a tag whose release never got published — dispatching `release.yml` is fire-and-forget, so when that run failed the tag job still went green and nothing signalled the gap. This is how `2.1.0` was tagged but never released. A new step now polls `gh release view` for up to 5 minutes after the dispatch and fails the job with the re-publish command if no release appears
- Bumped `softprops/action-gh-release` from `v1` to `v2` in `.github/workflows/release.yml` — actionlint reports the v1 runner as too old to run on GitHub Actions, which would have failed the next release outright
- Fixed duplicate `PATH` entries (`zsh/.zshenv`) — `.paths.sh` runs its own `path_dedupe()`, but that fires once and only covers entries added before it. pyenv prepends its shims in `.zshrc.d/06-environment.zsh` unconditionally on every source, so re-sourcing `.zshrc` added `~/.pyenv/shims` again and `test-zsh` reported a duplicate. Setting zsh's `typeset -U path PATH` (and `fpath`) keeps the arrays unique on every assignment instead, covering anything added later too. It lives in `.zshenv` rather than `.paths.sh` because that file is also sourced by bash, which has no `typeset -U`
- Fixed the global `<CR>` treesitter-selection mapping (`nvim/.config/nvim/lua/plugins/editor.lua`) claiming the key in special buffers. It shadowed the built-in "jump to the entry under the cursor" in quickfix and location lists — so `<leader>lq` populated a list you then could not open with `<CR>` — and leaked into the nvim-dap-ui panes that do not bind `<CR>` themselves. It now feeds `<CR>` straight back whenever `buftype` is not empty, and starts a selection only in ordinary file buffers
- Fixed `harper-ls` reporting zero spell/grammar diagnostics in long documents (`nvim/.config/nvim/lua/plugins/lsp.lua`) — harper-ls silently skips any file larger than its `maxFileLength` setting (default 120000 bytes) instead of reporting a limit, so a large spec or design doc looked clean while every typo in it went unflagged. Raised to 1000000

### Added

- Added Go debugging support to Neovim (`nvim/.config/nvim/lua/plugins/dap-go.lua`) via `leoluz/nvim-dap-go` and delve. Covers debugging the test under the cursor (`<leader>dt`, treesitter-located), launching the program with CLI arguments (the prompt is pre-filled with the previous run's arguments, so `<leader>dl` replays without prompting), and attaching to a remote `dlv --headless` server (`<leader>da`). `delve` is installed by Mason and resolved from `$MASON/bin/dlv`, falling back to any `dlv` on `PATH`
- Added a remote-attach adapter for Go (`go_remote`) that dials an address instead of spawning `dlv dap`. `dlv dap` refuses multiple clients and directs you to `dlv <command> --headless` with an attach+remote config; this is that config. It is the only way to debug a program that reads stdin, runs in a container, or runs on another machine — delve ignores the `console: "integratedTerminal"` launch attribute, which belongs to the VS Code Go extension rather than to delve itself
- Added `theHamsta/nvim-dap-virtual-text` — shows variable values inline at end-of-line while stepping
- Added `olexsmir/gopher.nvim` (`nvim/.config/nvim/lua/plugins/go.lua`) for Go code generation, under a new buffer-local `<leader>G` prefix: `<leader>Ge` writes an `if err != nil` guard that reads the enclosing function's return types (so a `(*Config, error)` gets `return nil, err`), struct tags for json, yaml, and toml — the letter names the format and the capital removes what the lowercase adds, so `<leader>Gj`/`<leader>GJ`, `<leader>Gy`/`<leader>GY`, `<leader>Gt`/`<leader>GT`; gomodifytags appends rather than replaces, so running two of them leaves a field carrying `json:"..." yaml:"..."`, and any other tag name (`db`, `mapstructure`) goes through `:GoTagAdd <name>` directly — plus interface stubs (`<leader>Gi`), doc comments (`<leader>Gc`), test generation (`<leader>Ga`/`<leader>GA`), JSON→struct (`<leader>Gs`), and `go mod tidy` (`<leader>Gm`). Its five binaries — `iferr`, `gomodifytags`, `impl`, `gotests`, `json-to-struct` — are installed by Mason on first use rather than by gopher's own `:GoInstallDeps`, which shells out to `go install`; Mason prepends its bin directory to Neovim's PATH, so no path configuration is needed
- Added `nvim-neotest/neotest` with `fredrikaverpil/neotest-golang` (`nvim/.config/nvim/lua/plugins/neotest.lua`) under a new `<leader>T` prefix — run the nearest test, the file, or the project; watch mode; a summary tree; and an output panel. Tests run with `-count=1` so Go's result cache can't report a stale pass. `<leader>Td` debugs a test through the same nvim-dap-go adapter as `<leader>dt`, so there is one delve configuration rather than two
- Enabled gopls inlay hints — parameter names, assigned and range variable types, composite literal fields and types, constant values, and function type parameters — on by default for every server that supports them, with `<leader>lh` to toggle per buffer
- Enabled gopls codelenses (run test, generate, tidy, upgrade dependency, govulncheck, vendor) with `<leader>lc` to run the one under the cursor. They are computed on request, so `vim.lsp.codelens.enable(true, { bufnr = bufnr })` keeps them refreshed as the buffer changes — no manual autocmd needed on top of it. `gc_details` is left off — it annotates every escape and inlining decision, which is noise unless you are chasing allocations
- Tuned the debug UI for reading values: Scopes moved to the top of a 50-column sidebar with half its height (was a quarter of 40 columns, at the bottom), the REPL undocked into an on-demand layout that `<leader>dr` toggles, and the bottom pane left to program output alone. Variable types are no longer rendered (`render.max_type_length = 0`) — Go reports them as fully-qualified import paths that push the value off-screen, and delve repeats the short type inside the value
- Go launch configurations resolve the module's `main` package (walk up to `go.mod`, then `go list`) instead of using the current file's directory, prompting only when a module has several `cmd/*` binaries. Debugging a CLI means breaking somewhere in `internal/`, and pointing delve at a library package makes it build an archive rather than a binary — the launch then fails with `not an executable file`
- Added debug keybindings for the commands the config was missing: conditional breakpoint (`<leader>dB`), log point (`<leader>dp`), run to cursor (`<leader>dC`), terminate (`<leader>dq`), restart (`<leader>dR`), and evaluate-expression (`<leader>de`, normal and visual). Added `F5`/`F10`/`F11`/`S-F11`/`F6` as twins for continue/step-over/step-into/step-out/terminate, matching the VS Code and IntelliJ layout
- Added `<leader>dw` (normal and visual) — pins the expression under the cursor, or the visual selection, into the Watches pane so it re-evaluates at every stop. `<leader>de` only opens a one-shot float, and nvim-dap-ui's own `w` action works only from inside its panes
- Added a `<leader>d` "Debug" which-key group (`nvim/.config/nvim/lua/plugins/editor.lua`) — the existing debug keymaps had never been registered, so they were invisible in the popup
- Added DAP gutter signs (breakpoint, conditional breakpoint, log point, rejected breakpoint) and a highlighted current-execution line
- Added a `## Debugging (nvim-dap)` section to `nvim/.config/nvim/KEYBINDINGS.md` and `docs/nvim/keybindings_cheat_sheet.md`, including the launch-with-arguments and remote-attach walkthroughs, and an "Adding a Debugger" section to `CLAUDE.md` documenting the three ways a language plugs in
- Added `mfussenegger/nvim-lint` (`nvim/.config/nvim/lua/plugins/lint.lua`) with `markdownlint-cli2` for Markdown — structure and style diagnostics (heading increment, blanks around headings/lists, bare URLs, list-marker consistency) that no existing tool covered: `harper-ls` handles prose, `marksman` handles links, `prettier` only formats. Lints on `FileType`, `BufWritePost`, and `InsertLeave`, with `<leader>ll` to lint on demand
- Added `brew "markdownlint-cli2"` to `Brewfile` — the linter binary behind the above
- Added `nvim/.config/nvim/markdownlint.yaml` — fallback rule set used when a file has no project-level markdownlint config in any parent directory. Disables `line-length`, `no-inline-html`, and `first-line-heading`; a project's own `.markdownlint*` config takes precedence
- Added `stay_awake()`, `stay_awake_stop()`, and `stay_awake_for(pid)` functions (`zsh/.functions.d/05-system.zsh`) — keep the system from idle-sleeping while long-running background agents work, without keeping the display on. Uses `caffeinate -s`, which only holds its assertion on AC power, so the machine still sleeps normally on battery. `stay_awake`/`stay_awake_stop` are a manual toggle (agent runs can span days, so there's no single command to wrap); `stay_awake_for` attaches the same assertion to an already-running process by PID and releases automatically when it exits
- Added `brew "colima"` to `packages/containers.brewfile` — lightweight `lima`-VM-based container runtime, replacing Rancher Desktop as the default local Docker engine
- Added `colima-start`/`colima-stop`/`colima-restart`/`colima-status`/`colima-list`/`colima-ssh` aliases (`zsh/.aliases.sh`) — not named `docker start`/`docker stop` since those are real docker subcommands (start/stop an existing container by name), and shadowing them would be confusing
- Added `chrisgrieser/nvim-spider` (`nvim/.config/nvim/lua/plugins/spider.lua`), remapping `w`/`e`/`b`/`ge` to stop at subword boundaries (camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE) instead of jumping over the whole identifier
- Added `brew "docker-credential-helper"` to `packages/containers.brewfile` — installs `docker-credential-osxkeychain`, which stores registry credentials in the macOS Keychain instead of plaintext in `~/.docker/config.json`. Docker only picks it up once `credsStore: "osxkeychain"` is set in that file, which is not written automatically (documented in `README.md` alongside the existing `docker-compose` plugin-dir note)
- Added `<leader>th` (`nvim/.config/nvim/lua/plugins/lsp.lua`) to toggle `harper-ls` diagnostics for the current buffer — silences grammar/spell suggestions without detaching the server, so toggling back re-displays what it already knows. Push and pull diagnostic namespaces are both matched (push uses one namespace per client, pull one per request id) and flipped together. The spell/typo jump list (`<leader>zn`/`<leader>zp`) now skips whatever namespace this silences, so what is hidden is not still a jump target
- Added `bestow/.bestowignore` — a global ignore list (`.git`, `.gitignore`, `README.md`, `LICENSE`) applied to every stow package
- Added `[[plugin.prepend_fetchers]]` no-op rules to `yazi/.config/yazi/yazi.toml` that skip MIME-type fetching under `.git/`, `node_modules/`, `build/`, and `target/` — `mime-ext` has no gitignore awareness, so walking those directories for MIME types was pure waste. `.git` also gets excluded from the `git` plugin fetcher, since it is never something `.gitignore` describes

### Changed

- Split `nvim/.config/nvim/lua/plugins/dap.lua` into a language-agnostic core plus per-language files, so adding a debugger no longer means editing shared config. Core keeps nvim-dap, dap-ui, virtual text, signs, and all keymaps; languages plug in at one of three tiers — a self-registering plugin (Ballerina, nothing to add), a dap extension plugin in `lua/plugins/dap-<lang>.lua` (Go), or a hand-written `lua/thisarug/dap/<lang>.lua` module exporting `setup(dap)`, which core discovers automatically (Python, Java, moved out of `dap.lua` unchanged)
- Added `delve` to `mason-nvim-dap`'s `ensure_installed`. Its `handlers = {}` is deliberately left empty and now says so in a comment: mason-nvim-dap ships its own adapters and configurations, and enabling the default handlers would list them alongside the ones the per-language files register — a Go launch would offer twelve near-identical entries instead of six
- Aerial's outline no longer opens automatically with every file (`open_automatic = false` in `nvim/.config/nvim/lua/plugins/aerial.lua`) — open it when you want it with `<leader>ta`
- Moved aerial's symbol jumps from `{`/`}` to `[[`/`]]` (`nvim/.config/nvim/lua/plugins/aerial.lua`) — the old bindings shadowed Vim's paragraph motions globally, in every buffer, whether or not the outline was open. `[[`/`]]` are Vim's "previous/next section" motions, which is the same idea, and they don't collide with the `[c`/`[d`/`[l`/`[q`/`[t` pairs
- Replaced `folke/neodev.nvim` with `folke/lazydev.nvim` (`nvim/.config/nvim/lua/plugins/lsp.lua`) — neodev is EOL upstream (last commit 2024-07-06) and its README directs Neovim >= 0.10 users to lazydev, which loads Neovim API and plugin type definitions on demand instead of eagerly. Registered lazydev as a `blink.cmp` source so Lua completion picks it up
- Added `nvim/.config/nvim/.stylua.toml` (`indent_type = "Spaces"`, `indent_width = 2`, `column_width = 120`) and reformatted every Lua file under `nvim/` to match — stylua's built-in default is tabs, so format-on-save had been silently converting files to tab indentation against the "never use tabs" convention in CLAUDE.md. Neovim core and the plugins that ship a stylua config (aerial, conform, gitsigns) all use 2 spaces
- Swapped `cask "docker"` (Docker Desktop app) for `brew "docker"` + `brew "docker-compose"` (CLI-only) in `packages/containers.brewfile` — colima supplies the daemon/VM itself, so the Docker Desktop app is redundant and would otherwise compete with colima for the docker context/socket
- Moved aerial's toggle from `<leader>a` to `<leader>ta`, and undotree's toggle from `<leader>u` to `<leader>tu` (`nvim/.config/nvim/lua/plugins/aerial.lua`, `nvim/.config/nvim/lua/plugins/undotree.lua`) — both were standalone top-level bindings; grouping them under the existing `<leader>t` "Toggle..." prefix keeps toggles discoverable in one which-key menu, alongside `<leader>th`
- Yazi now shows hidden files by default (`show_hidden = true` in `yazi/.config/yazi/yazi.toml`)
- `brew_update` (`zsh/.aliases.sh`) now runs `ya pkg upgrade` after `brew upgrade`, when `ya` is installed — yazi's plugins pin to a git revision in `yazi/.config/yazi/package.toml`, independent of the `yazi` binary itself, and upgrading the binary without also upgrading the plugins is how they drifted out of sync with the plugin API previously
- Bumped every `yazi/.config/yazi/package.toml` plugin dependency to their latest pinned revision via `ya pkg upgrade`
- Reduced colima's default VM memory allocation from 8 GiB to 6 GiB (`colima/.config/colima/default/colima.yaml`)

### Removed

- Removed the `<leader>xs` Trouble symbols binding (`nvim/.config/nvim/lua/plugins/trouble.lua`) — it showed the current file's outline, which the always-open aerial sidebar already provides. Trouble stays installed for diagnostics, LSP references, quickfix, and location list
- Removed `ThePrimeagen/git-worktree.nvim` and its `<leader>gw`/`<leader>gW` keybindings (`nvim/.config/nvim/lua/plugins/git.lua`) — upstream's last commit is 2023-11-07
- Removed `cask "rancher-desktop"` from `packages/containers.brewfile` — superseded by colima, which covers the same "lightweight container runtime without Docker Desktop" need with a smaller footprint
- Removed the `noto` stow package (`noto/.config/noto/.notorc`), `brew "snelusha/noto/noto"` from `packages/productivity.brewfile`, and `noto` from the bestow package list in `init.sh`
- Removed `cask "antigravity"` from `Brewfile` and `cask "cursor"` from `packages/editors.brewfile`
- Removed the `todo` alias (`zsh/.aliases.sh`) — it pointed at `todo.sh`, which is not installed by any Brewfile in this repo, so the alias only ever produced "command not found"
- Removed the `dlv` stow package (`dlv/.config/dlv/config.yml`) and dropped `dlv` from the bestow package list in `init.sh`. That file only configures delve's interactive terminal client (source-list colours, prompt, aliases); `dlv dap` never reads it, and with delve now installed by Mason for Neovim's use there is no terminal `dlv` on `PATH` to configure. Delve's own `~/.config/dlv/.dbg_history` is untouched

## [2.2.0] - 2026-08-05

### Fixed

- Fixed Undotree's diff pane appearing frozen on the current state while browsing history (`nvim/.config/nvim/lua/plugins/undotree.lua`) — the plugin only refreshes the diff panel when you actually step to a state, not when the cursor merely moves over a tree line (which can also land on branch/connector art rather than a real entry, leaving it unclear which entry was even selected). Aliased lowercase `j`/`k` to Undotree's own `J`/`K` (step to previous/next state via `earlier`/`later`), which lets the plugin position the cursor on the correct entry itself and refresh the diff panel on every step
- Fixed `.github/workflows/release.yml` referencing a `packages.json` file removed months ago (commit `629fe27`) — its `Generate release artifacts` step failed on `cp: cannot stat 'packages.json'` for every release, including `2.1.0`, which is why that release's GitHub Release/artifacts had to be published manually
- Fixed `.github/workflows/auto-tag.yml` tagging a release but never triggering `release.yml` — a tag pushed with the default `GITHUB_TOKEN` doesn't fire other workflows' `push: tags:` listeners (GitHub's anti-recursion safeguard for bot-authored events), so `auto-tag.yml` now explicitly dispatches `release.yml` via `gh workflow run` right after tagging

### Added

- Added `hammerspoon` stow package (`hammerspoon/.hammerspoon/init.lua`) and `cask "hammerspoon"` to `Brewfile` — loads `ControlEscape.spoon` so Caps Lock taps send Escape and holds act as Control. The Spoon itself is installed manually (`git clone` into `~/.hammerspoon/Spoons/`), not by `init.sh` — it's third-party code with its own git history.
- Added `overrideGpg: true` to `lazygit/.config/lazygit/config.yml` — with `commit.gpgsign = true` and a passphrase agent (gpg-agent) caching the passphrase, lazygit otherwise blocks commit/amend actions with "Feature not available for users using GPG" since it can't tell whether a signing action will need an interactive terminal prompt
- Added `<leader>tw` (`:set wrap!`) to toggle soft line wrap
- Added `<leader>gt` for `gitsigns.toggle_deleted()` — toggles an inline, in-buffer view of removed lines directly at the hunk (virtual text, strikethrough-style), as an alternative to the floating-window `<leader>gp` preview. Pair with the existing `<leader>gr`/`<leader>gR` (reset hunk/buffer) to discard the change once you've seen what's missing
- Documented built-in `]l`/`[l` (and `]L`/`[L`) location-list navigation, with which-key labels in `plugins/editor.lua` — clarifies that `gO` (LSP document symbols) opens a location list, not the quickfix list, so `]q`/`[q` don't apply to it
- Added `<leader>fS` for project-wide symbol search (`Telescope lsp_dynamic_workspace_symbols`) — look up a struct/function/class by name across the whole workspace and jump straight to its definition
- Set `gopls` `symbolScope = "workspace"` — restricts `<leader>fS` in Go projects to the current module's own packages, excluding dependencies and the stdlib
- Added `render-markdown.nvim` (`plugins/markdown.lua`) for in-buffer markdown rendering (headings, code blocks, tables, bullets) — replaces the terminal-only markdown viewing lost when the `v` alias moved off `bat`/`mdcat`; toggle with `<leader>tm`
- Overrode `RenderMarkdownCode`/`RenderMarkdownCodeInline`/`RenderMarkdownCodeInfo` highlights in `plugins/markdown.lua` to use rose-pine's `overlay`/`highlight_med`/`iris` palette colors — the plugin's default link (`ColorColumn`) sits too close to rose-pine's background in dark mode, making code blocks hard to spot
- Added `neovim`, `git`, `shellcheck`, `shfmt`, `stylua`, `prettier` to `Brewfile` — these were already required (nvim config, conform.nvim format-on-save, `CONTRIBUTING.md` validation steps) but were never declared as dependencies
- Added `cask "claude-code"` to `Brewfile` — the `claude/` package configures it, but the CLI itself wasn't tracked
- Added `cask "font-noto-sans-sinhala"` to `Brewfile` — fallback font referenced in `ghostty/.config/ghostty/config`, previously installed manually with no package tracking
- Added `cask "flutter"` to `packages/development.brewfile` — the `flutter/` stow package and `init.sh` already expected it
- Added `dif()` function (`zsh/.functions.d/05-system.zsh`) — compares two arbitrary files through delta's rendering (side-by-side, line numbers, syntax highlighting), for when you just need `diff` instead of `git diff`. Deliberately not aliased to `diff` itself: Claude Code's Bash tool sources shell aliases, so overriding `diff` would silently swap plain, parseable output for delta's colorized formatting in any tool that shells out to it
- Added `brew "dust"` to `Brewfile` — the `d='dust'` alias in `zsh/.aliases.sh` and `list_dotfiles_tools()` already referenced it, but it was never actually installed or tracked as a dependency
- Added `dust/.config/dust/config.toml` (new stow package) with `reverse = true` — biggest entries print at the top of the tree instead of the bottom
- Added `da()` function (`zsh/.functions.d/05-system.zsh`) — `d`/`dust` truncates its tree to the terminal height with no built-in pager, so `da` raises `-n`/`--number-of-lines` and pipes through `less -R` for a full scrollable view. Output is captured before being handed to `less` rather than streamed directly: dust doesn't reset `SIGPIPE` to its default disposition, so `less` exiting early (e.g. `-F` auto-quitting on output that fits one screen) makes dust panic with "Broken pipe" instead of exiting quietly

### Changed

- Repointed the `v` alias from the `bat`/`mdcat` wrapper function to `nvim` — the wrapper saw little use; `bat` remains available directly under its own name
- Renamed `cask "google-cloud-sdk"` to `cask "gcloud-cli"` in `packages/cloud.brewfile` — Homebrew renamed the cask; the old token still resolved but pointed at a deprecated alias
- Migrated symlink management from GNU Stow to [`bestow`](https://github.com/redpierrot/bestow) (`go install github.com/redpierrot/bestow@latest`) across `init.sh`, `cleanup.sh`, `bin/reset-dotfiles`, `bin/adopt-config`, and all docs — `init.sh`'s `bestow_packages()` step dropped the old per-file interactive backup/keep/diff conflict loop in favor of bestow's native `--backup`/`--force` flags (asked once per install run, not per file), since that loop existed only to work around GNU stow's clunky conflict reporting. `.stow-local-ignore` files were ported to `.bestowignore` (glob syntax, not regex — note bestow requires the per-package ignore file at the package root, not nested inside `.config/<tool>/`, and has no directory-only match: `**/cache/` needed rewriting to `**/cache/**`). Also fixed two live bugs found during the migration: `~/.config/bestow/config.yaml`'s destination pointed at a stale test path instead of `$HOME`, and the top-level `.bestowignore`'s `claude*` glob accidentally matched the `claude` package directory itself (narrowed to `claude-*`)
- Corrected several stale-symlink and stale-doc references left over from the earlier `config/` → per-tool-package restructuring (`~/.config/typos/_typos.toml` pointed at the removed `config/` package; README/CLAUDE.md/docs still described that layout)

### Removed

- Removed `packages/databases.brewfile` (PostgreSQL, Redis) — dropped from the optional-category set
- Removed GNU Stow (`brew "stow"`, `.stow-local-ignore` files) — fully replaced by bestow (see Changed)
- Removed the deprecated 4-char git alias shims (`gits`, `gitd`, `gitm`, `gitcan`, `gr_soft`, `gr_hard`, `git_clean_all`) kept in `zsh/.aliases.sh` for the migration to the `g*` short aliases — each had a matching replacement (`gs`, `gd`, `gm`, `gca`, `grs`, `grh`, `gcla`) in place since that migration; doc lookups in `zsh/.functions.d/07-docs.zsh` referencing `gits` were updated to `gs`

### Fixed

- Fixed `.github/workflows/auto-tag.yml` pushing the CHANGELOG release commit directly to `main`, which a repository ruleset now rejects (`refs/heads/main` requires changes via PR) — the workflow now opens a PR for that commit and merges it itself before tagging. Also added a `workflow_dispatch` trigger so a release can be run manually if the automatic PR-triggered run fails

## [2.0.0] - 2026-07-14

### Added

- Added **Powerlevel10k** as the shell prompt (replaces Starship); loaded as the first zinit plugin for correct instant-prompt initialization
- Added `zsh/.p10k.zsh` — full Catppuccin Mocha themed prompt config with Catppuccin Mocha palette matching the tmux status bar
- Added Go version segment (`go_version`) to the prompt — only appears inside Go projects
- Added custom Ballerina segment (`p10k_ballerina`) — reads version from `~/.ballerina/ballerina-version` using zsh builtins only (zero subprocesses), shows only when `Ballerina.toml` is present in `$PWD`
- Added **transient prompt** (`POWERLEVEL9K_TRANSIENT_PROMPT=always`): previous prompts collapse to a single `❯` in scrollback, keeping the terminal history clean
- Added `bin/tmux-status-sysinfo` — lightweight tmux helper that reports 1-minute load average and RAM usage (`used/total`) using `sysctl` + `vm_stat`
- Added `bin/tmux-status-battery` — smart battery script with per-level Nerd Font icons and charging indicator, using a single `pmset` call
- Added `mini.ai` for enhanced text objects: smarter `a`/`i` with identifiers for function calls (`f`), arguments (`a`), any bracket (`b`), any quote (`q`), HTML tags (`t`), and interactive pairs (`?`)
- Added `nvim-neoclip.lua` for clipboard/yank history: browse and paste from history via Telescope (`<leader>fy`)
- Replaced `nvim-cmp` with `blink.cmp` for completions: faster Rust-based fuzzy matching, built-in signature help (auto-shows parameter info when typing inside function args), and auto-show documentation popup alongside completions
- Added `trouble.nvim` diagnostics panel (`<leader>xx` for workspace diagnostics, `<leader>xs` for symbols, `<leader>xr` for LSP references)
- Added aerial.nvim breadcrumb component to lualine statusline (shows current function/symbol path)
- Added `todo-comments.nvim` for highlighted TODO/FIXME/HACK/NOTE comments with Telescope search (`<leader>ft`) and Trouble integration (`<leader>xt`), plus `]t`/`[t` navigation
- Added `flash.nvim` for lightning-fast jump/motion navigation (`s` to jump, `S` for treesitter select, enhances `/` search and `f`/`t` motions with labels)
- Added `alpha-nvim` dashboard as Neovim start screen with quick-action buttons (Find File, Recent Files, Grep, Explorer, Lazy)
- Added `aerial.nvim` code outline sidebar (`<leader>a` to toggle, `{`/`}` to navigate symbols)
- Added Ballerina language support: tree-sitter syntax highlighting (`tree-sitter-ballerina`) and LSP via `bal start-language-server`
- Improved Neovim lualine: relative file path, git diff stats, LSP diagnostics, LSP server name, search count, encoding/format, macro recording indicator, indent style, word count (markdown/text), file size, Lazy update count
- Added tmux quality-of-life settings: `detach-on-destroy off`, OSC 52 clipboard, 50k scrollback, faster status refresh
- Added tmux keybindings: quick window/session toggle, pane swapping, break-pane, lazygit popup
- Added tmux plugins: `tmux-open` (open files/URLs from copy mode), `tmux-sessionist` (session management), `tmux-fzf` (fuzzy finder)
- Added `undotree` Neovim plugin for visual undo history navigation (`<leader>u`)
- Added Touch ID for sudo authentication via `/etc/pam.d/sudo_local` (persists across macOS updates)
- Added `pam-reattach` to Brewfile for Touch ID support inside tmux sessions
- Added Touch ID validation checks to `test-zsh-config`
- Added `yazi` terminal file manager with full configuration (`yazi.toml`, `keymap.toml`, `theme.toml`, `init.lua`)
- Added `yazi.nvim` as the Neovim file explorer (replaces Neo-tree)
- Added `y()` shell wrapper for yazi with cd-on-exit support
- Added yazi plugins: smart-enter, smart-filter, smart-paste, full-border, git, chmod, diff, jump-to-char, mactag, mime-ext
- Added yazi preview dependencies to Brewfile (ffmpegthumbnailer, poppler, imagemagick, unar)
- Added yazi file-type open rules for common extensions (md, json, yaml, sh, lua, bal, java, py, js, ts, etc.)
- Added `reveal` opener for Reveal in Finder (macOS)
- Added rose-pine flavor for yazi (matches Neovim theme)
- Added tmux `allow-passthrough` for yazi image preview support
- Added `docs/YAZI_KEYBINDINGS.md` with full keybinding reference
- Added `glow` for terminal markdown rendering (Brewfile, suffix aliases, test suite) — later replaced by mdcat, see Changed
- New suffix aliases for `.markdown` and `.mdx` extensions
- `md` alias for quick markdown viewing
- `readme` function to view README in current directory
- `mdp` function for fzf-powered markdown file browsing with live preview
- Added **treesitter-based code folding**: `za` toggle, `zc`/`zo` close/open, `zM`/`zR` collapse/expand all — works across every treesitter language (JSON objects/arrays, functions, classes, blocks, etc.). Folds start open (`foldlevel = 99`)
- Added **JSON path display in statusline**: when editing a JSON file, the lualine center section now shows the treesitter-computed path to the element under the cursor (e.g. `root.packages[4].name`), including array indices — implemented as a custom treesitter tree-walker in `lua/thisarug/json_path.lua`
- Added **chafa** — image-to-text/sixel renderer used by yazi as a fallback image preview backend for terminals that don't support the Kitty or iTerm2 inline image protocols. Native protocols (Kitty in WezTerm, iTerm2 in iTerm2) are preferred and work through tmux via the existing `allow-passthrough on` tmux config
- Added **harper-ls** — grammar and spell checker for prose in code comments and Markdown files (offline, Rust-based, via Mason)
- Added **typos-lsp** — low-false-positive typo detection in identifiers, strings, and comments across all languages (e.g. `getRepsone` → `getResponse`); shown as hints to avoid drowning real errors
- Added `<leader>z` spell/grammar keybinding group: `<leader>zn` (next), `<leader>zp` (previous), `<leader>zf` (fix menu), `<leader>zu` (add to user/global dictionary), `<leader>zw` (add to workspace/project dictionary)
- Added `config/.config/typos/_typos.toml` — global user-level typos config (stow-managed, project `_typos.toml` overrides); wired into typos-lsp via `init_options.config`
- Added **GNG (`gw`)** — Gradle run-anywhere wrapper (`gdubw/gng`): finds `gradlew` anywhere up the directory tree, eliminating the need to `cd` to project root before running Gradle tasks
  - Removed the old `gw='./gradlew --max-workers=6'` alias that shadowed the binary
  - Updated `gwb`, `gwc`, `gwt`, `gwcb` aliases to use `gw` so they work from any subdirectory
- Added **tmux floating popups** for quick access without leaving context:
  - `prefix + t` — floating terminal in current directory
  - `prefix + N` — floating scratchpad (`~/.scratch.md`)
  - `prefix + S` — new session creator (name + directory prompt)
  - `prefix + ?` — command palette: fuzzy search and execute any tmux keybinding (fzf-powered)
  - `Ctrl+f` — upgraded project sessionizer to use popup instead of new window
- Added `tmux/.local/bin/tmux-session-creator` — interactive script for creating named tmux sessions from a popup
- Added `tmux/.local/bin/tmux-palette` + `tmux-palette-entries` — fzf-powered command palette for tmux keybindings (fuzzy search, categorized entries with comments, execute on select)
- Added popup border styling (blue, rounded) matching Catppuccin Mocha theme
- Added **[marks.nvim](https://github.com/chentoast/marks.nvim)** — sign-column indicators and extra navigation for Vim's built-in marks: `m,` set next available mark, `m;` toggle mark, `m]`/`m[` next/previous mark, `m:` preview mark, `dm-`/`dm<space>` delete marks on line/buffer

### Changed

- **Redesigned tmux status bar** for harmony with the new prompt:
  - Removed git branch from status-right (it lives in the prompt — no duplication, no polling subprocess)
  - Replaced ad-hoc battery logic with `bin/tmux-status-battery` (single `pmset` call, smart icons)
  - Replaced ad-hoc sysinfo with `bin/tmux-status-sysinfo` (load avg + RAM, zsh+awk, no Python)
  - Changed date format to `%a %d %b` (e.g. `Thu 13 Mar`) — more human-readable than `%Y-%m-%d`
  - Reduced `status-right-length` from 250 to 120
- **Prompt information architecture**: prompt shows command context (dir, git, language, duration); tmux shows session context (session name, pane count, sysinfo, battery, time) — no duplication between layers
- VCS segment always uses blue background regardless of dirty/clean state — dirty state is shown via icons (`!+?`) rather than a jarring colour change
- Replaced Neo-tree with yazi.nvim for file exploration in Neovim (`<leader>e`, `<leader>o`, `<leader>-`, `<leader>cw`)
- Replaced the legacy Oh My Posh prompt with the current Starship configuration, including new docs and tooling updates
- **Tmux session switcher (`prefix + s`)**: moved the inline fzf one-liner into `tmux/.local/bin/tmux-session-switcher` (replaces the built-in `choose-tree`, which was showing a corrupted/empty popup on resurrected sessions). Sessions are now listed oldest-first by creation time (previously alphabetical), and each of the first 9 sessions gets a number shortcut — pressing `1`-`9` jumps straight to that session, mirroring the bracketed shortcut keys `choose-tree` used to show
- Replaced **glow** with **mdcat** as the terminal markdown renderer: suffix aliases (`.md`, `.markdown`, `.mdx`), `md` alias, `readme()`, and `mdp()` now use `mdcat`/`mdless`; removed the `glow` stow package
- **Migrated Ballerina support to the [ballerina.nvim](https://github.com/redpierrot/ballerina.nvim) plugin**, replacing the ad hoc `vim-ballerina` + custom `lua/thisarug/ballerina.lua` + `after/ftplugin/ballerina.lua` setup (same package-aware `bal format` and brace/paren `indentexpr` logic, now maintained upstream). Also gains `:BallerinaRun`/`:BallerinaTest`/`:BallerinaBuild` with quickfix-integrated diagnostics, automatic nvim-dap debug configs, and `:checkhealth ballerina`. Added buffer-local keymaps `<leader>br`/`bb`/`bt`/`bf`/`bF` for Run/Build/Test/Format/Format-toggle

### Performance

- **Migrated shell prompt from Starship to Powerlevel10k**: eliminates the ~200-280ms per-render cost of spawning a binary process on every prompt draw. p10k is pure Zsh with no subprocess overhead per render
- **Enabled p10k instant prompt**: cached prompt renders immediately on shell startup while the rest of `.zshrc` loads in the background — visually instant shell open
- **Fixed atuin 1-2 second delay on up-arrow**: disabled `update_check` in atuin config to stop the network round-trip that occurred on every atuin invocation
- **Enabled `git core.fsmonitor` and `core.untrackedCache` globally**: reduced `git status` from ~268ms to ~37ms (7× speedup) via macOS FSEvents daemon

### Fixed

- Fixed `<C-f>` clash: tmux project sessionizer moved from `bind-key -n C-f` to `bind-key f` (`prefix + f`) to unblock Neovim's blink.cmp `<C-f>` doc-scroll binding

### Removed

- Removed **tmux auto-project sessions** (`07-tmux-sessions.zsh`) — the `chpwd` hook that prompted on every `cd` into a git repo is replaced by the intentional `prefix + S` session creator popup
- Removed `node_version` from prompt (Node.js is not a primary language in this stack)
- Removed time/clock from the prompt (it lives in the tmux status bar — no duplication)
- Removed the old `config/ohmyposh/zen.json` theme files in favor of `.config/starship.toml`

### Documentation

- Updated `README.md`: replaced Starship prompt section with Powerlevel10k, updated tool stack, troubleshooting commands, and stow package references
- Updated `bin/test-zsh-config`: replaced Starship validation with Powerlevel10k checks
- Rewrote `README.md` to describe the Starship prompt, SOPS workflow, and package manager updates
- Updated helper scripts and contribution guidelines to point to the Starship config instead of the removed Oh My Posh theme

## [1.0.0] - 2025-10-03

### Major Features

#### Secret Management

- **SOPS + age encryption** for environment variables with seamless editing
- `edit_secrets` command for safe secret editing with automatic encryption/decryption
- Age key generation and SOPS configuration in init script
- Environment variable templates (.env.example) instead of committing secrets
- Automatic detection of encrypted vs plaintext .env files
- Timestamped backups before encryption changes

#### Validation & Testing

- **Comprehensive validation suite** via `test-zsh` command
- Tests all tools, runtimes, environment variables, and PATH configuration
- Beautiful colored output with pass/fail/warning states
- Performance testing with 3-sample averages (~0.6s startup time)
- Dynamic testing based on Brewfile configuration
- GitHub Actions CI/CD with shellcheck, shfmt, JSON validation, and security scanning

#### Package Management System

- **Brewfile-based package management** with optional category files
- Category-based organization in `packages/` (cloud, containers, databases, etc.)
- Core packages in main Brewfile, optional packages in category files
- Modular installation: install only what you need

#### Performance Optimizations

- **Fast shell startup** (~0.6s) with lazy loading strategies
- NVM lazy loading - PATH added immediately, full NVM loads on demand
- Zinit turbo mode for non-essential plugins
- PATH deduplication to prevent slow lookups
- Performance profiling tool (bin/profile-startup)

#### Starship Prompt

- **Context-aware prompt** with language runtime indicators
- Java, Node.js, Python, Ballerina version display
- Git status with file changes, staged files, stash count
- Path truncation with git-aware display
- Multi-language project support
- Upstream tracking (ahead/behind/diverged indicators)

### Tools & Integrations

#### Modern CLI Tools

- **Enhanced file operations**: eza (ls), bat (cat), ripgrep (grep), fd (find)
- **Git workflow**: lazygit (TUI), git-delta (diff viewer), gh (GitHub CLI)
- **Productivity**: fzf (fuzzy finder), zoxide (smart cd), atuin (shell history sync)
- **System tools**: tmux (multiplexer), htop (monitor), direnv (env management)
- **Search & navigation**: tree, ripgrep, fd with aliases and integrations

#### Development Environment Support

- **Java ecosystem**: SDKMAN for Java, Gradle, Maven, Kotlin management
- **Node.js**: NVM with lazy loading and global package support
- **Python**: pyenv for Python version management
- **Ruby**: rbenv for Ruby version management
- **Ballerina**: Cloud-native programming language support
- **Docker**: Container management and development tools

#### GNU Stow Package Structure

- **Organized packages**: zsh, vim, git, tmux, direnv, config
- Clean symlink management with automatic backup
- Easy package installation/removal (stow/unstow commands)
- Modular configuration with clear separation of concerns

### Documentation

#### Comprehensive README

- **1089 lines** of detailed documentation
- Prerequisites and installation instructions (automated, manual, Brewfile)
- Quick start guide with essential commands
- Package management system documentation
- Secret management guide with examples
- Prompt customization and understanding
- Troubleshooting section with common issues
- Performance metrics and optimization tips
- Verification checklist for setup validation

#### Inline Documentation

- **150+ documented aliases** with examples
- `help` command system for discovering aliases by category
- `docs` interactive menu for browsing all aliases
- `alias_search` for finding specific aliases
- `show_tools` for discovering modern CLI tools
- Extensive function documentation with usage examples

### Security

#### Secret Protection

- SOPS + age encryption for all environment variables
- No secrets in git history (verified clean)
- Proper .gitignore excluding .env, credentials, and sensitive files
- CI secret scanning for passwords, tokens, and keys
- Hardcoded path detection in CI to prevent leaks

#### Secure Practices

- Environment variable templates instead of actual secrets
- Automatic encryption of plaintext .env files during init
- Safe editing workflow with edit_secrets command
- Key isolation (encryption keys stored separately from data)
- GitHub Personal Access Token (PAT) setup guidance

### Configuration Files

#### Shell Configuration

- `.zshrc` - Main shell configuration with plugin management
- `.aliases.sh` - 150+ aliases organized by category
- `.functions.sh` - Custom shell functions (take, kill_by_port, etc.)
- `.paths.sh` - PATH configuration for all tools and runtimes
- `.env` - Encrypted environment variables (SOPS + age)

#### Application Configs

- `config/ohmyposh/zen.json` - Custom Oh My Posh theme
- `git/.gitconfig` - Modern Git configuration with delta integration
- `tmux/.tmux.conf` - Terminal multiplexer configuration
- `vim/.vimrc` - Vim editor configuration
- `direnv/.direnvrc` - Project environment management

### GitHub Actions CI/CD

#### Validation Workflow

- **Multi-platform testing**: Ubuntu (validate job) + macOS (macos-test job)
- Shellcheck validation for all shell scripts
- shfmt formatting checks for code consistency
- JSON syntax validation (packages.json, zen.json)
- Security scanning for secrets and hardcoded paths
- Zsh syntax testing with zsh -n
- Installation script safety checks

#### Quality Gates

- Runs on push to main/develop branches
- Runs on all pull requests
- Prevents merging with validation failures
- Comprehensive error reporting with actionable messages

### Custom Functions

#### Universal Archive/Repo Handler (`take`)

- Create and enter directories with one command
- Clone git repos (https, ssh, git@ formats) and enter
- Download and extract archives (.tar.gz, .tgz, .tar.bz2, .zip)
- Proper error handling and user feedback
- Multi-format git URL support

#### Process Management (`kill_by_port`)

- Kill processes by port number
- Port validation (1-65535 range)
- Dry-run mode to preview before killing
- Help flag for usage information
- Graceful error handling

#### Other Utilities

- `extract` - Universal archive extractor
- `compress` - Create tar.gz archives
- `checkPort` - See what's running on a port
- `git_ignore_local` - Add files to local git ignore
- `confirm` - Interactive yes/no/quit prompts
- `show_tools` - Discover available modern CLI tools

### Automation

#### Installation Script (init.sh)

- **Interactive installation** with user confirmations
- macOS compatibility checks
- Xcode Command Line Tools installation
- Homebrew installation and setup
- GNU Stow installation for dotfile management
- Tool installation with category-based prompts
- SDKMAN setup for Java ecosystem
- Ballerina installation
- Zinit plugin manager setup
- Environment file encryption with SOPS + age
- Git personal configuration setup
- Automatic backup of existing dotfiles
- Symlink creation via Stow
- Installation validation with test-zsh
- Next steps and usage instructions

#### Package Management

- `manage_packages` - Interactive package configuration CLI
- `generate-brewfile` - Auto-generate Brewfile from packages.json
- Category enable/disable commands
- Individual package enable/disable
- List packages and categories
- Perfect sync between packages.json and Brewfile

### Aliases & Shortcuts

#### Navigation

- `..`, `...`, `....` - Quick directory traversal
- `c` - Clear terminal
- `cls` - Clear and list files
- `z` - Zoxide smart directory jumping

#### File Operations

- `ls`, `ll`, `la`, `lt` - Enhanced file listing with eza
- `cat` - Syntax-highlighted file viewing with bat
- `grep` - Fast search with ripgrep
- `find` - File search with fd

#### Git Workflow

- `gits`, `ga`, `gaa`, `gco`, `gb`, `gp`, `gl` - Common git operations
- `lg` - Open lazygit TUI
- `glog` - Beautiful git log with graph
- `gunstage`, `gundo`, `gcleanup` - Git utilities

#### Development

- `p3` - Python 3
- `v` - Vim
- `gwb` - Gradle build
- `use_java_17`, `use_java_21` - Java version switching

#### Tmux

- `t` - Start new tmux session
- `ta` - Attach to last session
- `tat` - Attach to named session
- `tl` - List all sessions

### Added Files

- `packages.json` - Centralized package configuration
- `Brewfile` - Homebrew package list (generated from packages.json)
- `bin/test-zsh-config` - Validation suite
- `bin/manage-packages` - Package management CLI
- `bin/generate-brewfile` - Brewfile generator
- `bin/profile-startup` - Performance profiling tool
- `lib/package-helpers.sh` - Shared package functions
- `config/ohmyposh/zen.json` - Custom Oh My Posh theme
- `.github/workflows/validate.yml` - CI/CD validation pipeline
- `zsh/.env.example` - Environment variable template
- `CLAUDE.md` - Repository analysis and status

### Changed Files

- `README.md` - Complete rewrite with comprehensive documentation
- `init.sh` - Major improvements with interactive installation
- `zsh/.zshrc` - Performance optimizations and lazy loading
- `zsh/.aliases.sh` - Expanded to 150+ aliases with documentation
- `zsh/.functions.sh` - Enhanced with better error handling
- `zsh/.paths.sh` - Improved portability with $HOME variables

### Performance Metrics

- **Shell startup**: ~0.6s (target: <1.0s) - Excellent
- **Validation suite**: Comprehensive coverage of all tools and configs
- **PATH optimization**: Deduplication prevents slowdowns
- **Plugin loading**: Turbo mode for non-essential plugins

### Breaking Changes

None - This is the initial stable release (v1.0.0)

---

## Roadmap

Potential future enhancements:

- Cross-platform support (Linux, WSL)
- Automated testing for custom functions
- IDE integration (VSCode, Cursor settings sync)
- Additional language support (Rust, Go, Deno)

---

[2.0.0]: https://github.com/ThisaruGuruge/dotfiles/releases/tag/v2.0.0
[1.0.0]: https://github.com/ThisaruGuruge/dotfiles/releases/tag/v1.0.0
