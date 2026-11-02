# Link packages with bestow, not GNU Stow

Symlinks are managed by `bestow`, the owner's own Go tool (`github.com/redpierrot/bestow`), instead of GNU Stow. The repo moved over on 2026-07-18: `init.sh`, `reset-dotfiles`, `adopt-config`, the docs and every `.stow-local-ignore` (now `.bestowignore`) were converted, and `brew "stow"` was dropped.

## Considered options

- **GNU Stow** — works, but needed `--no-folding` to avoid linking whole directories, and its conflict reporting forced `init.sh` to carry a per-file backup/keep/diff loop. bestow has native `--backup` / `--force` flags, so that loop was deleted.
- **bestow** — never folds directories (only files are linked), is idempotent, and handles pre-existing absolute symlinks safely.

## Consequences

- `bestow` is a `go install` build, not a Homebrew package, so a fresh machine needs Go first. `init.sh` handles it.
- `.bestowignore` uses globs, not regexes, and must sit at the package root. The root file's patterns are also matched against package directory names (a `claude*` glob once hid the `claude` package).
- bestow needs its config before it can link anything, so on a fresh machine `init.sh` bootstraps `~/.config/bestow/config.yaml` with `bestow init`. Afterwards the file may be replaced by a link to the repo copy (as on the owner's machine); `dotdoctor` checks that the live file matches the repo copy either way.
- Never run a bare `bestow stow`; it stows every package, including ones that need a custom destination.
