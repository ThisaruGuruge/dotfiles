# Changelog

All notable changes to Rabe. The format follows [Keep a Changelog](https://keepachangelog.com/), and Rabe uses [semantic versioning](https://semver.org/). How a release is made: [RELEASING.md](RELEASING.md).

## [Unreleased]

### Added

- The user guide covers options, troubleshooting and common questions ([#91](https://github.com/lorenzh/rabe/pull/91), fixes [#78](https://github.com/lorenzh/rabe/issues/78))
- Security guidelines for developing Rabe in `docs/security.md`, with a security item in the pull request template. Toasts now filter control characters in item titles and refusal reasons, and `tail` and `grep` take file paths after `--`. Copies replace control and format characters other than tabs and line breaks with `?`, notes to Claude and the `/rabe-stop` answer carry only item kinds and ids, cron prompts stay out of toasts, Codex job ids that would leave the jobs folder are skipped, and poll commands stop after 5 seconds. Dependabot keeps dev dependencies and actions up to date. ([#97](https://github.com/lorenzh/rabe/pull/97), fixes [#81](https://github.com/lorenzh/rabe/issues/81))
- Add `SECURITY.md` with private vulnerability reporting instructions and document what Rabe reads, stores, and includes in bug reports. ([#101](https://github.com/lorenzh/rabe/pull/101), fixes [#80](https://github.com/lorenzh/rabe/issues/80))
- A testing guide, `docs/testing.md`, for unit, UI and live checks, and `scripts/live-check.sh`, which drives Rabe in a fresh Claude Code session through tmux. ([#102](https://github.com/lorenzh/rabe/pull/102), fixes [#79](https://github.com/lorenzh/rabe/issues/79))
- Add contributor setup, workflow, testing and security guidance in `CONTRIBUTING.md` ([#103](https://github.com/lorenzh/rabe/pull/103), fixes [#76](https://github.com/lorenzh/rabe/issues/76))

### Changed

- Split the architecture and feasibility references into smaller documents with a documentation index. ([#90](https://github.com/lorenzh/rabe/pull/90), fixes [#77](https://github.com/lorenzh/rabe/issues/77))

### Fixed

- The next prompt tells Claude which items Rabe successfully stopped or deleted, and when Rabe sent an agent a message. Notes contain only item kinds and ids. ([#85](https://github.com/lorenzh/rabe/pull/85), fixes [#38](https://github.com/lorenzh/rabe/issues/38))
- The Cost tab gives worker names more room and hides totals for sources that are absent; the band shortens chip labels only when needed to keep the cost visible. ([#86](https://github.com/lorenzh/rabe/pull/86), part of #42)
- The group-stop button shows its target count, agent turns with only tools show only their tool lines, and cron detail uses the pane's duration format. ([#87](https://github.com/lorenzh/rabe/pull/87), part of #43)
- Agent rows use Claude Code's name when available; shell labels show a description and task id. The band labels session cost, background tokens and failure kinds. Long paths keep both ends, and empty output says `No output yet`. ([#88](https://github.com/lorenzh/rabe/pull/88), fixes [#41](https://github.com/lorenzh/rabe/issues/41))

## [0.4.4] - 2026-10-10

### Added

- README shows a demo GIF per tab. ([#68](https://github.com/lorenzh/rabe/pull/68))

### Fixed

- After a message to an agent is sent, the keys go back to the pane: the focus moves from the message field to `m: message`, so `b`, `c` and the other keys act again. ([#64](https://github.com/lorenzh/rabe/pull/64), fixes [#62](https://github.com/lorenzh/rabe/issues/62))
- Workflow agents show under their declared phase, also when they finish before the next poll. ([#65](https://github.com/lorenzh/rabe/pull/65), fixes [#61](https://github.com/lorenzh/rabe/issues/61))
- Serialize row arrows with view-changing presses in scrolling panes; pending stop, delete and message calls do not hold focus moves. The all-fit arrow case remains open. ([#66](https://github.com/lorenzh/rabe/pull/66), [#37](https://github.com/lorenzh/rabe/issues/37), partial fix)
- A press or search edit whose handler disappears during a redraw is dropped without losing the pane's keys. ([#67](https://github.com/lorenzh/rabe/pull/67), fixes [#60](https://github.com/lorenzh/rabe/issues/60))

## [0.4.3] - 2026-10-10

### Fixed

- A short Timeline window shows its start time when no round clock label fits. ([#56](https://github.com/lorenzh/rabe/pull/56), fixes [#53](https://github.com/lorenzh/rabe/issues/53))
- Copy toasts flatten whitespace and replace only Unicode control and format characters with `?`. Wide characters, emoji and combining marks stay. Failure toasts show the reason and offer text that the filter leaves unchanged. The clipboard keeps the original text. ([#57](https://github.com/lorenzh/rabe/pull/57), fixes [#54](https://github.com/lorenzh/rabe/issues/54))
- The Effects tab shows changed shell files after `||` and at relative paths in known session or agent folders. Unknown folders and unchanged files show nothing. ([#58](https://github.com/lorenzh/rabe/pull/58), fixes [#55](https://github.com/lorenzh/rabe/issues/55))

## [0.4.2] - 2026-10-10

### Fixed

- Partly fixed #25: dim controls keep their visible labels and catch their hotkeys without acting. Blank inert buttons are removed because Tab and arrows stop on them. Letters without a control in the current view still reach the prompt. The mod API has no key hook. ([#51](https://github.com/lorenzh/rabe/pull/51), refs [#25](https://github.com/lorenzh/rabe/issues/25))
- Search shows its active query after Enter and reopening, capped with `…` in the toolbar at every width. Enter returns the keys to the marked filtered row. An empty search clears the filter. ([#51](https://github.com/lorenzh/rabe/pull/51), fixes [#26](https://github.com/lorenzh/rabe/issues/26))
- The Timeline legend says "scheduled run" for cron ticks. Ticks come from the schedule, without actual firing times or idle delays. ([#49](https://github.com/lorenzh/rabe/pull/49), fixes [#34](https://github.com/lorenzh/rabe/issues/34))
- The Cost tab says "sorted by tokens when opened" while it holds the opening order. New workers follow the held rows. ([#49](https://github.com/lorenzh/rabe/pull/49), fixes [#33](https://github.com/lorenzh/rabe/issues/33))
- Deleted cron jobs say `deleted`, hide future runs and keep delete dim. Delete errors show plain text. The previous-session summary counts only crons still running at session end. ([#49](https://github.com/lorenzh/rabe/pull/49), fixes [#28](https://github.com/lorenzh/rabe/issues/28))
- The Effects tab finds shell writes on independent lists after `||`, including later lines with here-docs. Conditional writes stay hidden. ([#49](https://github.com/lorenzh/rabe/pull/49), fixes [#27](https://github.com/lorenzh/rabe/issues/27))
- Long Bash and other tool summaries end with `…` instead of stopping mid-word without a mark. ([#50](https://github.com/lorenzh/rabe/pull/50), fixes [#35](https://github.com/lorenzh/rabe/issues/35))
- Opened monitors and shells keep every stored output line for scrolling. Split previews say how many older lines they hide. ([#50](https://github.com/lorenzh/rabe/pull/50), fixes [#32](https://github.com/lorenzh/rabe/issues/32))
- Agent reports keep up to 16,000 characters instead of stopping at 300. Longer reports end with `…`. Split previews wrap only recent agent text and mark hidden text. Wrapped bullet and numbered list markers stay beside the start of long paths. ([#50](https://github.com/lorenzh/rabe/pull/50), fixes [#30](https://github.com/lorenzh/rabe/issues/30))
- Opened agents and Codex jobs keep all recorded turns and steps. The detail scrolls beyond the pane's height. The scroll hint shows only when the opened detail needs scrolling. ([#50](https://github.com/lorenzh/rabe/pull/50), fixes [#29](https://github.com/lorenzh/rabe/issues/29))
- When one line can show text unchanged, copy failure toasts offer the exact text. Other failures say the clipboard cannot be reached. Success toasts keep their flattened preview. The clipboard keeps the original text. ([#51](https://github.com/lorenzh/rabe/pull/51), [#52](https://github.com/lorenzh/rabe/pull/52), fixes [#36](https://github.com/lorenzh/rabe/issues/36))
- Tab switches focus the marked row after a safe move through the tab label. Enter opens that row at once. ([#51](https://github.com/lorenzh/rabe/pull/51), fixes [#31](https://github.com/lorenzh/rabe/issues/31))

## [0.4.1] - 2026-10-10

### Fixed

- The previous-session summary on the Timeline tab names the scope of each figure: `session ≈ $0.01 · 1m44s` for the whole session's cost and duration, `background 0 tok` for the tokens of the background items. It read as if background work cost $0.01 with no tokens. ([#47](https://github.com/lorenzh/rabe/pull/47), fixes [#46](https://github.com/lorenzh/rabe/issues/46))

## [0.4.0] - 2026-10-10

### Added

- Remove finished and failed items from the list: `r` removes the selected row once it is done, failed or stopped, and `a` removes every such row the search shows. Running items stay. Removed rows stay off the list, the Cost and Timeline tabs, a workflow's agent rows and the band's chips for the session; workflow phases, token counts, the cost totals and the Effects tab still count them. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#13](https://github.com/lorenzh/rabe/issues/13))
- The Cost tab, the detail and the band show an estimate in dollars (`≈ $0.16`) per Claude agent and per Codex job: the tokens of each model request times the list price of its model in `data/prices.csv`, with cache reads and writes, long-context rates and Codex cached input. A model Rabe does not know, an agent that started before Rabe loaded, or a Codex session file over 4 MiB, gone or unreadable shows `n/a`, and so does a total with any worker that has no estimate, also one without token data. The option `pricesFile` names your own price table in the same format, whose rows come first; a row for a model also prices that model's aliases in Rabe's table, except a name another of your rows names itself. A Codex job you stop keeps its estimate only while its session file is the one Rabe priced. A Codex job that resumes a thread counts only its own requests, tokens and file changes, not those of the jobs before or after it on that thread. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#15](https://github.com/lorenzh/rabe/issues/15))
- The pane shows the ids you need to pick work up again, and `c` copies the command: this session's id on the Cost tab and the previous session's id on the Timeline tab (`claude --resume <id>`), a Codex job's thread (`codex resume <thread id>`), and an agent's id and transcript. When the clipboard cannot be reached, a message shows the text to select. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#23](https://github.com/lorenzh/rabe/issues/23))

### Changed

- While the pane is open, an item that starts goes straight into the group of its kind in the Items list (AGENTS, SHELLS, MONITORS or CRON; a shell or monitor under the agent that started it) instead of a NEW group at the end; on the Effects tab, a new file or port goes into FILES or PORTS instead of a NEW section. When it comes above the focused row, Rabe moves the focus back onto that row, and Enter does nothing until it has. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#24](https://github.com/lorenzh/rabe/issues/24))
- A Codex job started through the Codex plugin's forwarding agent (`codex:codex-rescue`) shows as one row: the agent that only passed the request on has no row of its own, and its tokens and cost count toward the job; when the job or the agent has no estimate or no token count, the job shows `n/a` for it, not the part that is known. The one-line summary under a list below 90 columns counts them the same way and shows `cost n/a` when the sum is unknown. A job started by an agent that also did other work shows indented under that agent, also when it starts while the pane is open. Rabe links them only when the evidence fits one job: the agent's command names the job, or the job started while the command ran and has its prompt or its thread. A link the prompt made moves when the command returns another job or thread, and goes while two jobs fit. In the job's detail, `f` opens the agent with its turns, id and transcript. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#14](https://github.com/lorenzh/rabe/issues/14))
- The Timeline tab shows the last 4 hours. Items that ended before fold into one line, and a bar that started earlier is cut at the left edge with `◂`, so a long session stays readable. `w` widens the window for the open pane (4 h, 12 h, the whole session). The new option `timelineHours` sets the hours; `0` shows the whole session as before. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#20](https://github.com/lorenzh/rabe/issues/20))
- Rabe is built and tested with Claude Code 2.1.296 (was 2.1.295). ([#45](https://github.com/lorenzh/rabe/pull/45))

### Fixed

- The Effects tab lists every git worktree files changed in, with its branch and who changed files there, the main session included, and shows each file relative to its worktree. Before, it knew only the worktrees of isolated agents, so a worktree the main session or a plain agent edited by its full path was missing and its files showed with their full path. An agent started in a subfolder shows in the worktree that holds the folder, not as a worktree of its own, and its tree reads `n/a` when Rabe cannot tell it. The WORKTREES count now matches its rows. Windows drive and UNC paths match their worktree whatever their slashes and letter case. The conflict warning names a tree only when Git or the agent's worktree shows that it holds the file. Rabe reads the worktrees with `git worktree list`; without Git it works as before. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#19](https://github.com/lorenzh/rabe/issues/19))

### Removed

- Code nobody reached: the Effects tab's ` · cwd n/a` mark (every file path Rabe records is absolute) and the names the band built for each kind but no longer draws. Nothing changes on screen. ([#44](https://github.com/lorenzh/rabe/pull/44), fixes [#22](https://github.com/lorenzh/rabe/issues/22))

## [0.3.0] - 2026-10-09

### Added

- The Effects tab shows the files Codex jobs changed (added, updated or deleted) and the files the main session changed, with who changed each file and how. ([#16](https://github.com/lorenzh/rabe/pull/16))
- A price table of Claude and OpenAI models in `data/prices.csv`, for a later cost estimate per agent. No code reads it yet. ([#18](https://github.com/lorenzh/rabe/pull/18))

### Changed

- On the Effects tab, Enter or a click on a file opens the agent that changed it last; when the main session changed it last, it copies the file path instead. ([#16](https://github.com/lorenzh/rabe/pull/16))
- The band above the prompt is always one line of counts and the cost, with an empty row above it so the status line does not touch it; the empty row goes when the band has only one row. ([#17](https://github.com/lorenzh/rabe/pull/17))

### Fixed

- The Effects tab shows files that agents write through shell commands (`cat > file <<'EOF'`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `touch`), marked `via shell`. Rabe takes the files named on the command line and checks each on disk: it lists a file only when it appeared, went away, or changed size or modification time while the command ran, so `touch -c`, `rm -f` of a missing file and failed copies show nothing, and `cp src dir` shows `dir/src`. Before, it showed only `Edit` and `Write` calls, so a subagent that wrote its files through Bash left it empty. ([#16](https://github.com/lorenzh/rabe/pull/16), fixes [#9](https://github.com/lorenzh/rabe/issues/9))

## [0.2.0] - 2026-10-09

### Added

- The arrow keys and the mouse work in the pane. ↑ and ↓ move from row to row and Enter opens a row. Click another row to select it; click the selected or focused row to open it. A click does not move the focus, so Enter still opens the row that has the focus. Rows, tabs and controls are buttons. The mouse needs Claude Code's fullscreen layout (`/tui fullscreen`). ([#11](https://github.com/lorenzh/rabe/pull/11))
- The detail beside the list follows the focus, without Enter. ([#11](https://github.com/lorenzh/rabe/pull/11))
- Shells and monitors an agent started show under that agent in the Items tab and in the band. ([#11](https://github.com/lorenzh/rabe/pull/11))
- In a workflow run's detail you can move through its agents and open one. On the Effects tab, Enter or a click on a file opens the agent that edited it last, and on an `ssh -L` line copies the line. ([#11](https://github.com/lorenzh/rabe/pull/11))

### Changed

- Colors come from the xterm 256-color palette and go to the terminal as exact palette entries, so the band, the panel and the selected row keep distinct colors under tmux, which reduced the old hex colors to the same grey. ([#11](https://github.com/lorenzh/rabe/pull/11))
- A cron job's next run shows as its clock time (`next 15:00`) instead of a countdown that read like one; a wakeup that waits for the session shows `due`. ([#11](https://github.com/lorenzh/rabe/pull/11))
- While the pane is open, rows keep their places: items that start later go to a NEW group at the end, and a row that is gone stays as a dim `gone` slot. `/rabe` sorts the lists again. ([#11](https://github.com/lorenzh/rabe/pull/11))
- In the Items list, a workflow run is stopped with `g` (stop run) instead of `x`; with one of its agents selected, `g` also stops that run. ([#11](https://github.com/lorenzh/rabe/pull/11))
- `g` (stop group) stops only the rows the search shows, not hidden rows of the same kind. ([#11](https://github.com/lorenzh/rabe/pull/11))
- Stop and delete stay dim until Rabe knows where the focus is. On the list, `x` and `g` work only after you move onto a row yourself, with an arrow, Tab or a click. ([#11](https://github.com/lorenzh/rabe/pull/11))

### Fixed

- Shells and monitors a subagent started end when their output file says so. ([#11](https://github.com/lorenzh/rabe/pull/11))
- After you change the tab, the search, a fold or the open item, the focus moves to a safe place, so Enter never presses a button that moved into the old place. ([#11](https://github.com/lorenzh/rabe/pull/11))
- The Timeline axis names each clock time once. ([#11](https://github.com/lorenzh/rabe/pull/11))

### Removed

- `j` and `k` in the pane; use ↑ and ↓. ([#11](https://github.com/lorenzh/rabe/pull/11))

## [0.1.0] - 2026-10-09

The first public version.

### Added

- A band above the prompt with the running background work: Claude subagents and workflows, Codex plugin jobs, background shells, monitors, cron jobs and loops, and the session cost. ([#5](https://github.com/lorenzh/rabe/pull/5))
- `/rabe`, a pane with the tabs Items, Cost, Effects and Timeline, a detail view for each kind, and turn views for Claude agents and Codex jobs. ([#5](https://github.com/lorenzh/rabe/pull/5))
- Stopping shells, agents, workflow runs and Codex jobs from the pane, and `/rabe-stop` for Codex jobs. ([#5](https://github.com/lorenzh/rabe/pull/5))
- The option `hideBuiltinTasks` (on by default), which hides Claude Code's own background-task hints while Rabe shows the same work. ([#5](https://github.com/lorenzh/rabe/pull/5))
- `/rabe:report-bug` and `/rabe:feedback`, which draft an issue for this repository and ask before they send it, and issue templates. ([#6](https://github.com/lorenzh/rabe/pull/6))

### Fixed

- Workflow agents no longer offer stop and message, which Claude Code does not support for a single workflow agent; their detail offers stopping the run. ([#8](https://github.com/lorenzh/rabe/pull/8))

[Unreleased]: https://github.com/lorenzh/rabe/compare/v0.4.4...HEAD
[0.4.4]: https://github.com/lorenzh/rabe/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/lorenzh/rabe/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/lorenzh/rabe/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/lorenzh/rabe/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/lorenzh/rabe/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/lorenzh/rabe/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lorenzh/rabe/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lorenzh/rabe/releases/tag/v0.1.0
