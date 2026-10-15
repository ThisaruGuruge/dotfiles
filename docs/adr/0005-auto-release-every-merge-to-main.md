# Release automatically on every merge to main

Every pull request merged to `main` is tagged and released by `auto-tag.yml` then `release.yml` (added 2026-07-14, `d530267`), unless every changed file is under `.github/` or is `*.md`. The version bump comes from conventional commit types (`feat` minor, `!` / `BREAKING CHANGE` major, else patch); the `## [Unreleased]` section of `CHANGELOG.md` becomes the release notes. Tags have no `v` prefix.

## Considered options

- **Manual tags and version-bump PRs** — rejected: they were forgotten and the `VERSION` file sat at `1.0.0` until it was deleted.
- **Auto-release per PR** — chosen. To avoid one release per small fix, finished work is squashed into the `dev` branch and rebase-merged to `main` once (see CONTRIBUTING.md).

## Consequences

- Commit types must be accurate, because they pick the version.
- Never create tags or bump versions by hand.
- Docs-only and CI-only PRs are invisible to the release flow.
- History stays linear: squash or rebase merges only, no merge commits.

TODO(owner): confirm the manual-tag reason above; it is inferred from the removed `VERSION` file.
