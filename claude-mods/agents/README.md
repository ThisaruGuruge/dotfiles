# agents (Claude Code mod)

<!-- TODO before publishing: final name, one-line pitch, screenshot of the pane (docs/pane.png). -->

A docked "Agents" pane for Claude Code: one block per subagent, newest first (last 100, scrollable).

Per agent: status mark (running, done, failed), a crab costume per agent type, type name, label, model and effort, a context bar, output tokens, requests, tool calls, elapsed time, and the latest tool call while it runs. When the pane is not showing, one row per running agent appears above the prompt instead.

It opens by itself when the first subagent starts. `/agents-pane` toggles it.

## View a subagent's transcript

The pane uses Claude Code's `$.ui.view` mod API (Claude Code 2.1.300 or later), which shows an agent's transcript in the main view.

- Give the pane the keyboard (Ctrl+X then Tab, or click it). The pane shows the keys in two dim lines: Tab moves, Esc leaves. Press `1` to `9` to open the transcript of the agent on that row (1 is the top, newest row), or Tab to a row and press Enter. Rows beyond nine open with Tab and Enter.
- `/agents-pane view <n>` does the same from the prompt (`n` counts from the top of the pane), and `/agents-pane view <id-prefix>` matches an agent id (three characters or more).
- While an agent is in view, the pane marks it `◀ viewing` and shows a back row. Press `0` in the pane, or run `/agents-pane back`.

Limits: Claude Code only lets a mod switch the view while it answers your own input (a key press, a click or a command), so nothing switches on its own. The engine forgets a finished agent a short while after it ends, and then its transcript cannot be opened; the mod says so in a message and changes nothing. An agent continued from a resumed session is listed once it does work, and opens like any other while the engine tracks it.

## Option

`rows` (`/config`, or `pluginConfigs.agents.options.rows`): `auto` (default) draws the rows above the prompt only while the pane is not showing, `off` never, `always` also while the pane is open.

## Install

TODO: confirm how this is published (own marketplace, directory, or a plain checkout). Until then, load it from a checkout:

```sh
claude --plugin-dir /path/to/agents
```

## Privacy and security

A mod runs inside the Claude Code process with your permissions and no sandbox. This one:

- reads subagent events (type, label, model, token counts, tool names and a short target such as a file name or a command description) and keeps them in memory for the session;
- makes no network calls, registers no tools, spawns no processes, reads and writes no files;
- registers one slash command, `/agents-pane`, and calls `$.ui.view` only from a key press or that command.

Read `hooks/register.tsx` before you install it.

## Develop

```sh
claude plugin validate . --strict
claude plugin test .
```

## License

TODO: choose a license and add a LICENSE file.
