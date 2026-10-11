# Vendored: rabe

Unmodified copy of [lorenzh/rabe](https://github.com/lorenzh/rabe) (MIT), commit
`7a97ac5533ecd15052c5f4e0b9166086f62693df` (2026-10-11), minus `docs/`, `scripts/`, the
marketplace manifest and the engine-written `types/claude-code.d.ts`.

Reviewed before vendoring: no network calls; reads files via `$.fs` (transcripts, price table,
`installed_plugins.json`) and runs `git worktree list` and `tail` via `$.process`. It also strips
Claude Code's own "N shells running" hint so its band can show the count.

To update: re-clone, diff against this folder, re-review the `$.fs` / `$.process` uses, then replace.
