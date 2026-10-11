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
| `agents` | Subagent pane (`/agents`, opens when the first one starts) and one row per running agent above the prompt (it stays visible when the engine's diff panel takes the pane's seat): a crab costume per agent type, model, effort, context bar, output tokens, requests, tool calls, latest tool call, elapsed time. No tools registered, no network. |
| `rabe` | [Vendored](rabe/VENDORED.md), unmodified. Band and `/rabe` pane for background shells, monitors, cron jobs, workflows and Codex jobs, with cost and a files-touched view. |
| `session-wrapped` | `/wrapped`: session summary (duration, cost, top tools, busiest turn). |

The status bar under the prompt (`claude/.claude-*/statusline-command.sh`) keeps the always-on essentials:
account, vim mode, directory, git, model, session cost and token count.

## Developing

```bash
claude plugin validate claude-mods/<mod>
claude plugin test claude-mods/<mod>
```

The engine writes `.claude-plugin/types/` and a `tsconfig.json` into each mod when it loads; both are
git-ignored. Mods load at session start, so restart a session after editing one.
