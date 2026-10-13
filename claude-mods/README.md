# Claude Code mods

Mods are small TypeScript plugins that hook into Claude Code itself. Each folder here is one mod
(`.claude-plugin/plugin.json` + `hooks/`). They are **not** a stow package: both accounts load them
straight from this repo through `CLAUDE_CODE_PLUGIN_DIRS` in `claude/.claude-*/settings.json`
(`~` is allowed, folders are separated by `:`), so there is nothing to symlink or install.

| Mod | What it does |
| --- | --- |
| `statusbar` | Band above the prompt: stacked context bar with a compact marker, per-category legend, `~N turns left`, 5h/7d limits, last-turn stats and prompt-cache countdown, threshold toasts. `/statusbar` hides it, `/context-bar` toggles the legend. |
| `blast-radius` | Previews and asks before risky Bash commands (`rm -rf`, force push, `git reset --hard`, `--adopt`, ...). Fails closed. |
| `redact` | Replaces API keys, tokens and private keys with `[REDACTED:<kind>]` in prompts and tool output. |
| `agents` | Subagent pane (`/agents-pane`, opens when the first one starts) and, as a fallback, one row per running agent above the prompt. Option `rows` (`/config`, or `pluginConfigs.agents.options.rows`): `auto` (default) draws the rows only while the pane is not showing (closed, or the terminal is too narrow to seat it), `off` never, `always` also while the pane is open (use it if the engine's diff panel takes the pane's seat, which a mod cannot detect). Per agent: a crab costume per agent type, model, effort, context bar, output tokens, requests, tool calls, latest tool call, elapsed time. No tools registered, no network. |
| `rabe` | [Vendored](rabe/VENDORED.md), unmodified. Band and `/rabe` pane for background shells, monitors, cron jobs, workflows and Codex jobs, with cost and a files-touched view. |
| `session-wrapped` | `/wrapped`: session summary (duration, cost, top tools, busiest turn). |
| `conventions` | Advisory checks after each Edit/Write: tab indentation, token-shaped literals in tests, and `bin/lint --file`. Tells Claude what is wrong and the fix command, never blocks. On in this repo, opt-in elsewhere; `/conventions` toggles it for the session. |

The status bar under the prompt keeps the always-on essentials: account, Remote Control, vim mode,
directory, git, model, session cost and token count. Both accounts' `claude/.claude-*/statusline-command.sh`
exec the shared `bin/claude-statusline` (see [Outside the mods](#outside-the-mods)).

## Developing

```bash
claude plugin validate claude-mods/<mod>
claude plugin test claude-mods/<mod>
```

The engine writes `.claude-plugin/types/` and a `tsconfig.json` into each mod when it loads; both are
git-ignored. Mods load at session start, so restart a session after editing one.

## What the guards catch

`blast-radius` asks before `rm -r` (and any `xargs rm`), `git reset --hard`, forced pushes (not
`--force-with-lease`), pushes that delete remote refs (`--delete`, `:branch`, `--mirror`, `--prune`),
`git clean` (anything but a dry run), `git worktree remove --force`, `git checkout -f`, `git checkout .`/`git restore .`, `git stash clear`, `stow/bestow --adopt`,
`chmod/chown -R`, `dd`, `mkfs`/`newfs`/`diskutil erase*`, `shred`, `truncate`, `find -delete`/`-exec rm` (also `-exec sh -c '...'`), `fd -x rm`, `rsync --delete` and destructive SQL or
migrations, in `Bash` and `Monitor` commands. It sees through git's global and abbreviated options
(`git -C dir`, `-c k=v`, `--ha`), wrapper options (`sudo -u root`, `env -C dir`, `nice -n 10`,
`xargs -n 1`, `arch -arm64`, `xcrun`, `timeout 5`, `caffeinate -i`, `watch`), subshells, `bash -c`, `eval`, `$(...)`, here-strings
and pipes into a shell, `ssh host '...'`, comments, redirections and heredocs, and ignores commit, tag and
merge messages and quoted heredocs written to files. Two levels of nesting are parsed; deeper ones ask
when they mention a destructive command. The preview runs where the command would (a leading `cd`,
`git -C`), with git's fsmonitor off; a preview that fails says so and still asks. Anything nobody answers
is denied.

`redact` hides distinctive tokens (AWS, GitHub, GitLab, npm, Hugging Face, Stripe, Anthropic/OpenAI,
Slack, Google, JWTs, private and age keys), Bearer tokens and `Authorization` headers, URL passwords, and
the values of credential-named settings (`*_TOKEN=`, `*PAT=`, `password:`, `passphrase:`, `secret_key=`,
`apiKey:`, `ENCRYPTION_KEY`/`SIGNING_KEY`/`MASTER_KEY`/`SESSION_KEY`, `DB_PASS=`, `MYSQL_PWD=`), hex
values included, and inside escaped JSON (`{\"token\":\"...\"}`). A quoted value is taken whole, symbols
and all (a quoted password holding `&` and `()`, up to 200 characters with no space). Names stay narrow: other
`*_KEY` settings (`CACHE_KEY=v2-abc123`) are left alone. It also leaves code that only names a secret
(`config.apiKey`, `process.env.API_KEY2`), a hash after `commit`, and demo credentials
(`postgres:postgres@`, `guest:guest@`, `localhost` URLs, `YOUR_TOKEN_HERE`) alone so edits still match and
files round-trip. It scans prompts, tool results, attachments, hook context and command output (which
includes `!` bash mode); a row it cannot scan (the scan throws or runs out of time) is stored with its
text replaced by `[redact: scan failed, content withheld]` rather than unscanned.

## What the conventions check catches

After an Edit or Write succeeds, `conventions` checks that one file and, only if something is
wrong, adds a short note Claude reads after the tool result (the channel a `PostToolUse` hook's
`additionalContext` uses), naming the problem and the command that fixes it:

- **Tab indentation** in any file but Makefiles, Go, `.tsv`, git config, `.gitmodules` and patches (a tab
  inside a line, as in `printf '%s\t'`, is data and left alone, and so are tabs in Markdown code fences
  and shell here-document bodies). In this repo tabs `bin/lint --file` also reports (with its shfmt or
  stylua fix) are one note, not two. The fix names `shfmt -i 4 -ci -w` for shell and
  `stylua` for Lua.
- **Token-shaped literals in test files** (`tests/`, `fixtures/`, `testdata/`, `*.test.*`, `*.spec.*`,
  `*_test.*`, `test_*.py`): the distinctive shapes `redact` hides (GitHub, AWS, Slack, Stripe, JWTs,
  private keys, ...). Secret scanners flag them even when fake, so build them at runtime from pieces.
  `hooks/tokens.ts` copies those rules from `redact/hooks/patterns.ts` (a mod cannot import from outside
  its folder): keep the two in step.
- **`bin/lint --file <path>`** in this repo (spawned only for paths it covers and checks the repo has on;
  edits through a symlink, such as a stowed `~/bin/lint`, are checked at the real path): shellcheck and `shfmt -i 4 -ci -d` for the bash scripts it
  lists, `zsh -n` for its zsh files, `stylua --check` for Neovim Lua, and a new `bin/` script missing from
  its lists. The lists stay in `bin/lint`; the mod relays its output (cut to 12 lines, `fix:` lines kept).

It never blocks or fails an edit: each external check is killed after 3 s, a missing tool or a file over
256 KiB is skipped without a word, and an unchanged note is not repeated for the same file. It is on by
default in this repo (a git root holding `bin/lint` and this mod's manifest (`name` is `conventions`)).
The repo's own `bin/lint` only runs in the checkout this mod is loaded from (its
`CLAUDE_CODE_PLUGIN_DIRS` entry, `~` expanded and links resolved) and that checkout's linked worktrees
(a `.git` file whose `gitdir:` is under its `.git/worktrees/` and links back): a fork or copy with the
same layout gets the generic checks below instead, as does every checkout when that variable is unset.
Any other repo opts in with `.claude/conventions.json`, where `shfmt -i 4 -ci -d`,
`zsh -n` and `stylua --check` are picked by extension or shebang:

```json
{ "enabled": true, "checks": ["tabs", "shfmt", "zsh", "stylua", "fixtures"] }
```

`checks` is optional (all of them); `{"enabled": false}` turns it off in this repo too. `/conventions off`
and `/conventions on` (plain `/conventions` toggles) switch it for the current session.

## Outside the mods

- `bin/claude-statusline` draws the status line under the prompt for both accounts, with one `jq` and one
  `git status` per refresh. The RC segment shows `◉ RC` while the session has a Remote Control bridge and
  `○ RC off` otherwise. Claude Code does not report the bridge to status lines, so this reads
  `CLAUDE_CODE_BRIDGE_SESSION_ID` and then `bridgeSessionId` in `~/.claude-*/sessions/<pid>.json`:
  undocumented internals that may change in a later Claude Code. It means "a bridge handle exists" (it
  cannot tell waiting from attached from reconnecting, and an outbound-only mirror session shows `RC` too).
  The status line refreshes every 5 s (`statusLine.refreshInterval`) so a `/remote-control` toggle shows.
- `bin/claude-tmux-state` is called by hooks in both accounts and sets the tmux window option
  `@claude_state` to `working` (prompt sent, or a tool ran after Claude Code waited for you), `waiting`
  (Claude Code wants attention), `done` (turn ended, also on an API error), or clears it (session ended).
  It is silent and a no-op outside tmux, and a `claude` started inside another session (`claude -p` from
  the Bash tool) leaves the outer session's window alone.
- `ccp`, `ccpr` and `ccpc` load `~/.claude-personal/projects.d/<repo>.json` with `--settings` when the
  current git repo has one: the place for a project's own autoMode rules, which must not live in this
  public repo (Claude Code ignores autoMode in a project's `.claude/settings*.json`). `<repo>` is the
  main checkout's directory name, so linked worktrees use their repo's file; two repos with the same
  name share one.
- `tests/claude/check.sh` (run by `test-zsh`) checks all three, plus a golden-output test for the
  status line.
