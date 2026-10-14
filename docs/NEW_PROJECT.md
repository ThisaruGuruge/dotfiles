# Starting a New Project

The skills are global plugins, so there is nothing to install per project:

```bash
mkdir my-app && cd my-app && git init     # git is needed for worktrees and the tracker
gh repo create my-app --private --source . --remote origin   # only for GitHub issues
ccp                                        # personal Claude Code account
```

Then, inside the session, run `/mattpocock-skills:setup-matt-pocock-skills` once. Pick the tech
stack after the spec is final, not before.

## Plugins (enabled once, globally)

| Plugin | Source | What you get |
| ------ | ------ | ------------ |
| `mattpocock-skills` | [mattpocock/skills](https://github.com/mattpocock/skills) via `claude-plugins-official` | 27 skills: grilling, domain modelling, spec and ticket flow, TDD, bug diagnosis, code review, PR bodies, handoff |
| `frontend-design` | `claude-plugins-official` | Design guidance for building or reshaping UI |

Both are listed under `enabledPlugins` in `claude/.claude-personal/settings.json` and update
themselves. They are enabled for the personal account only. Skills marked manual-only
(`disable-model-invocation`) are not in the session context at all; you call them by name. Plugin
skills are namespaced: `/mattpocock-skills:tdd`. Typing `/tdd` also works when no other skill has
that name.

`code-review` exists twice: the built-in one (finds bugs in a diff, `--comment`, `--fix`) and Matt's
(checks the diff against your documented standards and against the originating spec, as two separate
reports). They answer different questions; call Matt's as `/mattpocock-skills:code-review`.

## Setup skill (once per project)

`/mattpocock-skills:setup-matt-pocock-skills` explores the repo and asks three things:

1. **Issue tracker**: GitHub (`gh`, needs the `origin` remote), local markdown under `.scratch/`
   (no remote needed), or something else.
2. **Triage labels**: keep the five defaults (`needs-triage`, `needs-info`, `ready-for-agent`,
   `ready-for-human`, `wontfix`) or map your own.
3. **Domain docs**: one `GLOSSARY.md` plus `docs/adr/` at the root (the default).

It writes `docs/agents/*.md`, adds an `## Agent skills` block to the project's `CLAUDE.md` (it asks
which file to create when neither `CLAUDE.md` nor `AGENTS.md` exists), and creates missing GitHub
labels. Run it only in repos you own: it adds files to the repo.

## The workflow

| Step | Skill | Result |
| ---- | ----- | ------ |
| Align | `grill-with-docs` | Questions one at a time; `GLOSSARY.md` and ADRs grow as decisions settle |
| Spec | `to-spec` | A spec issue (problem, user stories, decisions, testing) labelled `ready-for-agent` |
| Slice | `to-tickets` | Vertical-slice tickets with blocking edges, approved by you |
| Build | `implement-spec` (or `implement` for one ticket) | Parallel subagents in worktrees, TDD, merged onto an integration branch, code review, draft PR |
| Ship | `pr` | PR body: summary, evidence, merge danger |

Around it:

- `diagnosing-bugs`: something is broken or slow; builds a failing loop before theorising.
- `tdd`: red-green with test seams agreed first.
- `prototype`: throwaway code that answers a design question.
- `research`: a background agent writes cited findings from primary sources.
- `wayfinder`: work too big for one session; a map of decision tickets.
- `triage`: move inbound issues and PRs through the label states.
- `improve-codebase-architecture`: every few batches of work.
- `retro`: after a session, turn stumbles into environment fixes.
- `handoff`: write a briefing so a fresh session can continue.
- `wait-what`: the last message did not land; re-explain it.
- `wizard`: generate a script that walks you through steps only a human can do.
- `ask-matt`: ask which skill fits.

## Not for every repo

`finance-manager` keeps its own pipeline (`docs/plan/T0NN.md`, `orchestrate-tasks`, `handle-task`,
`land-open-prs`). Do not run the setup skill there. Do not run it in repos you do not own.
