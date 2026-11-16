# Load Claude Code mods from the repo via CLAUDE_CODE_PLUGIN_DIRS

The mods in `claude-mods/` (statusbar, blast-radius, redact, agents, conventions) are not a stow package and are not installed. `zsh/.zshenv` exports `CLAUDE_CODE_PLUGIN_DIRS` (built from `$DOTFILES/claude-mods/*/`) for both accounts, so Claude Code loads them straight from the checkout. (Originally the list sat in each `settings.json`; Claude Code does not expand variables there, so it moved to the shell once the checkout location stopped being fixed.) Decided 2026-10-06 (`a5a78cb`). The reason on record (`claude-mods/README.md`) is that nothing needs symlinking or installing.

This was chosen by Claude during a session, not weighed by the owner against a marketplace or a per-account `plugins/` install; no comparison of those alternatives was recorded. Treat it as the working default, and revisit it if loading from the checkout becomes a problem.

## Consequences

- Editing a mod in the repo is live after a session restart: no stow, no install step.
- The exported list must match `claude-mods/*/`, and `settings.json` must not set it; `dotdoctor` checks both and flags entries pointing outside the repo.
- The shell must have read `~/.zshenv` before Claude Code starts; a launch from the Dock or another GUI app has no `CLAUDE_CODE_PLUGIN_DIRS` and loads no mods. The checkout can be anywhere, because `$DOTFILES` is derived from where `~/.zshenv` links to.
- The `conventions` mod runs the repo's `scripts/bin/lint` only from the checkout the mod was loaded from, so a copy cannot execute code outside the permission system.
- Mods are validated with `claude plugin validate` / `claude plugin test`, not `test-zsh`.
