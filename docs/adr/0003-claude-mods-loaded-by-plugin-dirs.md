# Load Claude Code mods from the repo via CLAUDE_CODE_PLUGIN_DIRS

The mods in `claude-mods/` (statusbar, blast-radius, redact, agents, conventions, rabe, session-wrapped) are not a stow package and are not installed. Both accounts' `settings.json` list them in `env.CLAUDE_CODE_PLUGIN_DIRS`, so Claude Code loads them straight from the checkout. Decided 2026-10-06 (`a5a78cb`).

## Consequences

- Editing a mod in the repo is live after a session restart: no stow, no install step.
- The two `settings.json` lists must match `claude-mods/*/`; `dotdoctor` checks this and flags entries pointing outside the repo.
- The checkout must be reachable at `~/dotfiles` (`init.sh` creates a symlink when it lives elsewhere), because the paths are written that way.
- The `conventions` mod runs the repo's `bin/lint` only from the checkout the mod was loaded from, so a copy cannot execute code outside the permission system.
- Mods are validated with `claude plugin validate` / `claude plugin test`, not `test-zsh`.

TODO(owner): why a plugin-dirs env var rather than a marketplace or `~/.claude-*/plugins` install? (Not recorded in git history.)
