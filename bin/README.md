# Dotfiles Management Scripts

Helper scripts to manage your dotfiles setup.

## Script index

Every script in this directory is bash, POSIX sh or zsh (no Python). Convention: use bash (`#!/bin/bash`, linted by shellcheck + `shfmt -i 4 -ci`; the two Claude Code helpers that run on every hook or refresh use `#!/bin/sh` for startup speed) unless the script sources zsh-only features or runs inside the zsh config (`#!/usr/bin/env zsh`, checked with `zsh -n`). `bin/lint` runs all of these checks.

| Script | Language | Purpose |
| ------ | -------- | ------- |
| `adopt-config` | bash | Move an existing `~/.config/<app>` into a new bestow package |
| `audit-configs` | bash | List which `~/.config` entries are managed by dotfiles |
| `claude-notify` | bash | macOS notification from Claude Code hooks when a session finishes or needs you |
| `claude-statusline` | sh | Status line under the Claude Code prompt (both accounts call it) |
| `claude-tmux-state` | sh | Sets the tmux window option `@claude_state` from Claude Code hooks |
| `dotdoctor` | bash | Read-only health check of the whole setup (`--full` adds brew + plugin validation) |
| `gws` | bash | Guard: refuses bare `gws`; requires an account-scoped invocation |
| `gws-account` | bash | Shared helper behind `gwsp`/`gwse` (per-account config dir + keyring) |
| `gwsp` / `gwse` | bash | Google Workspace CLI, personal / enterprise account |
| `lint` | bash | Single lint entry point: shellcheck, shfmt, `zsh -n`, stylua, mod tests (also run by CI). `lint --file <path>` lints one file and prints only problems, each with a `fix:` line (used by the `conventions` mod) |
| `profile-startup` | bash | Quick shell startup timing |
| `profile-zsh-startup` | zsh | Detailed zsh startup profiler (per-component timing) |
| `rebuild-env` | bash | Rebuild `~/.env` after sops reports `MAC mismatch` (the encrypted file was edited by hand): keep, replace or remove each variable, add new ones, re-encrypt |
| `reset-dotfiles` | bash | Remove every bestow-managed symlink, then optionally the `~/.dotfiles_backup*` directories and the `packages/*.brewfile` packages (every prompt defaults to no) |
| `sync-brewfile` | bash | Compare/sync `Brewfile` with installed Homebrew packages |
| `test-shell-helpers` | zsh | Behavioural tests for `dotdoctor`, `envrc`, `prs`/`prw` and the direnv hook (run by `test-zsh`) |
| `test-zsh-config` | zsh | Validation suite (run via `test-zsh`) |
| `tmux-status-battery` | zsh | tmux status bar: battery level and charging state |
| `tmux-status-claude` | bash | tmux status bar: sessions with a window waiting on Claude Code |
| `tmux-status-sysinfo` | zsh | tmux status bar: load average and RAM, plus `☕` while `awake` holds |

## Scripts

`adopt-config`, `rebuild-env`, `reset-dotfiles` and `sync-brewfile` print their usage and exit with `-h` / `--help`, before doing anything. `reset-dotfiles --help` in particular does not start the removal.

### `audit-configs`
Audit your `~/.config` directory to see what's managed by dotfiles vs what's not.

**Usage:**
```bash
./bin/audit-configs
```

**Output:**
- Lists all symlinked configs (managed by dotfiles)
- Lists all real directories (not managed)
- Highlights likely user configs
- Provides recommendations

### `adopt-config <app-name>`
Migrate an existing config from `~/.config/<app>` into your dotfiles repo.

**Usage:**
```bash
./bin/adopt-config fish
```

**What it does:**
1. Checks that the config exists and is not already managed: it refuses when `<app>/.config/<app>` already exists in the repo or when files under `~/.config/<app>` are symlinks into the repo (bestow links per file, never whole directories)
2. Shows size and lists files that may hold sensitive data (names only)
3. Moves config to `~/dotfiles/<app>/.config/<app>` (a new top-level bestow package)
4. Creates `.bestowignore` for sensitive files
5. Stows the package to create the symlink back
6. Prompts you to review and commit

**Example:**
```bash
# Adopt fish shell config
./bin/adopt-config fish

# Review the ignore file
vim ~/dotfiles/fish/.bestowignore

# Commit
git add fish/.config/fish fish/.bestowignore
git commit -m "Adopt fish shell configuration"
```

### `gws` / `gws-account` / `gwsp` / `gwse`
Run the Google Workspace CLI (`googleworkspace-cli`) against two isolated accounts in parallel, like `ccp`/`cce` do for Claude Code.

- `gwsp ...` — personal account, config dir `~/.config/gws-personal`
- `gwse ...` — enterprise account, config dir `~/.config/gws-enterprise`
- `gws ...` — **blocked**: `bin/gws` shadows the real binary (`~/bin` precedes Homebrew on `PATH`) and refuses to run unless `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` is set. It is a script, not an alias, so it also guards non-interactive shells such as agents.
- `gws-account <name>` — shared helper: creates `~/.config/gws-<name>` (mode 700), sets `GOOGLE_WORKSPACE_CLI_CONFIG_DIR`, pins `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file` (each dir keeps its own encryption key; mixing backends makes gws silently drop `credentials.enc`), then runs the real binary. Add a third account with a two-line wrapper like `gwsp`.

**Per-account setup (once per machine):**
```bash
cp /path/to/oauth-client.json ~/.config/gws-personal/client_secret.json    # or: gwsp auth setup (needs gcloud)
gwsp auth login
gwse auth login
gwsp auth status && gwse auth status
```
Credentials live only in those directories, never in this repo. Make sure each `client_secret.json` has a `project_id`, otherwise gws can fall back to gcloud's ADC quota project and leak across accounts.

### `dotdoctor [--full]`
Health check for the whole setup. Prints one line per check (`✔` ok, `⚠` worth a look, `✘` broken) and exits non-zero when anything is `✘`. It never stows, fixes, edits or deletes anything and makes no network calls of its own; each problem comes with the command that fixes it.

**Usage:**
```bash
dotdoctor           # fast checks (a second or two)
dotdoctor --full    # also: brew bundle check (auto-update/analytics off) + claude plugin validate
                    # on every mod, run with a throwaway CLAUDE_CONFIG_DIR
```

**Checks:**
- Every non-ignored file of every bestow package is linked (`bestow stow -n`, run once per package so one package bestow cannot plan does not hide the others; `.bestowignore` rules and bestow's per-file linking are honoured; `bin` is checked against `~/bin`). Missing links and destinations blocked by another file or link are `✘` (the config is not active either way); a package bestow cannot plan is `✘` by name
- Dangling symlinks into the repo (in `~`, `~/bin`, `~/.config`, `~/.claude-*`, `~/.hammerspoon`, `~/.local/bin`). "Into the repo" means under the checked repo, its main checkout, or `~/dotfiles`/`~/.dotfiles`; links into other projects are ignored
- `~/.config/bestow/config.yaml` matches the repo copy
- `~/.claude` is a symlink to `~/.claude-personal`, and `~/.claude-personal/settings.local.json` links to the repo's `.claude/settings.local.json`
- `CLAUDE_CODE_PLUGIN_DIRS` in both account `settings.json` files lists every `claude-mods/*/` plugin, every listed directory exists and lives inside the repo (a same-named plugin from elsewhere does not count) (`✘` on mismatch)
- age key present, `~/.env` sops-encrypted, no plaintext `zsh/.env` in the repo (`✘` even when git-ignored: it still sits on disk next to the code; a sops-encrypted copy is only a `⚠`), no plaintext `~/.env.backup*`
- `ControlEscape.spoon` cloned, tmux plugin manager and declared tmux plugins installed
- Bare `gws` is blocked: `gws` on `PATH` must be the `bin/gws` guard, and the guard exits 64 without an account (the real binary is never run)

It is a script in `bin/`, so it works from any shell. It checks the repo the script lives in (symlinks are followed, so the installed `~/bin/dotdoctor` checks the live repo) against the links in `$HOME`; `DOTFILES=<dir>` points it at a different checkout. Run from a linked git worktree it warns up front, because links that point at the main checkout then look unlinked.

`bin/test-shell-helpers` exercises it (exit codes, hard errors, worktrees, `--full`) together with `envrc`, `prs`/`prw` and the direnv hook, using a scratch `HOME` and fake `gh`/`fzf`/`claude`/`brew`; `test-zsh` runs it.

### `claude-statusline` / `claude-tmux-state`
Claude Code helpers, called from `claude/.claude-*/` by their repo path (`~/dotfiles/bin/...`): the root
`.bestowignore` skips `claude-*`, so they are not linked into `~/bin`.

- `claude-statusline --label NAME --color 'R;G;B' [--cost nonzero|always]` draws the status line both
  accounts' `statusline-command.sh` exec: account, Remote Control (`◉ RC` / `○ RC off`), vim mode,
  directory and git, model, cost, tokens. One `jq` and one `git status --porcelain=v2 --branch` per refresh.
  The RC segment reads undocumented Claude Code internals; see the script's header for its limits.
- `claude-tmux-state working|waiting|done|clear|resume` sets (or clears) the tmux window option
  `@claude_state` on the window of `$TMUX_PANE`, from the UserPromptSubmit, Notification, Stop,
  StopFailure, PostToolUse (`resume`: back to `working` only when it was `waiting`) and SessionEnd hooks.
  Silent, always exits 0, a no-op outside tmux, and a no-op when two `claude` processes are above it (a
  nested `claude -p` inherits `TMUX_PANE`, but the window is the outer session's).

Both are checked by `tests/claude/check.sh`, which `test-zsh` runs.

### `claude-notify`
`claude-notify attention|done|subagent` reads a hook's JSON on stdin and shows a macOS notification
(`osascript`, title `Claude · <repo> (Personal|Work)`). Wired async into both accounts' `settings.json`:
`Notification` and `PreToolUse` with matcher `AskUserQuestion` -> `attention` (body: the hook's message or
the question), `Stop` -> `done` (`Finished`), `SubagentStop` -> `subagent` (off unless
`CLAUDE_NOTIFY_SUBAGENTS=1`). Title, body and sound reach AppleScript as argv, never in its source, and the
event's file contents, tool input and assistant text are never shown.

- Quiet when you are looking: the terminal is the frontmost app (`lsappinfo`, no Accessibility permission)
  and, inside tmux, this pane's window is the current window of an attached session.
- Two events of one kind from one pane within 2 s send one notification.
- `CLAUDE_NOTIFY=0` off, `CLAUDE_NOTIFY_ALWAYS=1` never suppress, `CLAUDE_NOTIFY_SOUND=Name` (or empty for
  none; defaults `Ping` for attention, `Glass` for done), `CLAUDE_NOTIFY_TERMINALS=<regex>` app names that
  count as "looking", `CLAUDE_NOTIFY_DEBOUNCE=<seconds>`.
- Always exits 0 and prints nothing. Checked by `tests/claude/check.sh` with fake `osascript`,
  `lsappinfo` and `tmux`.

One-time macOS setup: System Settings > Notifications > **Script Editor** (`osascript` notifications are
attributed to it) must allow banners or alerts and sounds. A Focus mode silences them like any other app.

### `rebuild-env`
Recover `~/.env` when sops reports `MAC mismatch`. That happens when the encrypted file was edited by hand (for example deleting lines in a normal editor), which breaks its checksum. The script refuses to run on a healthy file, reads the values with `--ignore-mac`, asks per variable whether to keep, replace (hidden input) or remove it, lets you add new ones, then encrypts, verifies the round trip and swaps the file in. The broken file is kept as `~/.env.broken-mac.<time>` (still encrypted). Values are never printed. If `~/.env` is a symlink, the file it points to is rebuilt (new and broken-copy files are written beside the target) and the link stays a link; a dangling link is refused.

**Usage:**
```bash
rebuild-env
```

### `reset-dotfiles`
Undo what `init.sh` set up: it previews the links `bestow unstow` would remove (the main package set and the `bin` package in `~/bin`), prints how many, and asks before removing them. If bestow fails during the preview the script stops and shows bestow's error rather than an empty list. It then walks every `~/.dotfiles_backup*` directory (init.sh writes `~/.dotfiles_backup_<timestamp>`), lists it and offers removal, defaulting to no; if you keep one it prints the `cp -a <dir>/. ~/` command that restores it. The optional package uninstall only touches `packages/*.brewfile` entries; the core `Brewfile` packages stay installed. Uninstalling Homebrew itself is a separate, doubly-confirmed prompt.

**Usage:**
```bash
reset-dotfiles
```

### `sync-brewfile`
Report drift between what Homebrew has installed and what the Brewfiles declare. Also available as the `brew-sync` alias.

**Usage:**
```bash
./bin/sync-brewfile
```

**What it does (read-only):**
1. Lists formulae and casks that are installed but appear in no Brewfile (`Brewfile` or `packages/*.brewfile`)
2. Lists packages a Brewfile declares that are not installed
3. Changes nothing: it never rewrites a Brewfile or installs/removes anything

**Use this when:**
- You installed a package with `brew install` and want to know whether it is tracked
- You want to spot packages you declared but never installed

Adopt a package by adding a line to `Brewfile` (core) or the right `packages/<category>.brewfile` yourself.

## Workflow Examples

### Adding a new tool to your setup

```bash
# 1. Install the tool
brew install bat

# 2. Configure it
mkdir -p ~/dotfiles/bat/.config/bat
echo "--theme=TwoDark" > ~/dotfiles/bat/.config/bat/config

# 3. Stow it
cd ~/dotfiles && bestow stow bat

# 4. Add it to Brewfile by hand (./bin/sync-brewfile shows what is untracked)
./bin/sync-brewfile

# 5. Commit everything
git add bat/.config/bat Brewfile
git commit -m "Add bat with custom config"
git push
```

### Adopting existing configs

```bash
# 1. Audit what's not managed yet
./bin/audit-configs

# 2. Adopt configs you want to manage
./bin/adopt-config fish
./bin/adopt-config sops

# 3. Review and commit
git add fish/.config/fish sops/.config/sops
git commit -m "Adopt fish and sops configurations"
git push
```

### Fresh machine setup

On a new machine, everything just works:
```bash
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
cd ~/dotfiles
./init.sh
# All configs are symlinked automatically!
```

The checkout can be anywhere: `init.sh` locates the repo from its own path and, when it is not at `~/dotfiles`, creates a `~/dotfiles` symlink to it (the hooks, status line, aliases and tmux config all use that path). `./init.sh --dry-run` is a preflight that changes nothing, and `./init.sh --help` lists the steps.

## Tips

- Run `dotdoctor` after pulling or adding files to catch unlinked configs and drift
- Run `./bin/audit-configs` periodically to catch new configs
- Use `./bin/sync-brewfile` after installing new tools to see what is not yet in a Brewfile
- Always review `.bestowignore` files before committing
- Test your init.sh on a fresh VM/container periodically
