---
name: writing-ballerina-beps
description: Use when writing, reviewing, splitting, or restructuring a Ballerina Enhancement Proposal (BEP) in the ballerina-spec repo, or a package proposal in a module-ballerina-* repo's docs/proposals/. Covers file naming and issue numbering, the exact header and trailer format, the section outline, prose and cross-reference conventions, how big a BEP should be and when to split one, how to present an undecided design, and what must never go in a BEP. Triggers on "BEP", "Ballerina Enhancement Proposal", "beps/", "ballerina-spec", "write a proposal for the X package", "split this BEP".
---

# Writing Ballerina Enhancement Proposals

Everything under "Process facts" is verified against the `ballerina-spec` repo and its BEP process
document. Everything under "Judgment" is guidance learned from applying it — weigh it, don't obey it.

## Process facts

### Where BEPs live, and how they are numbered

BEPs live in `ballerina-spec/beps/<category>/`. Categories observed: `lib-*` for standard library modules
(`lib-log`, `lib-sql`, `lib-graphql`, `lib-kafka`), `con-*` for connectors (`con-jms`), `bal-*` for tooling
(`bal-persist`). `AAA-bep-resources/` holds the process doc and template.

**The number in the filename is the GitHub issue number, not a BEP sequence number.** Open an issue in
`ballerina-platform/ballerina-spec` first; its number becomes the prefix. There is no registry, counter, or
reservation step.

Filename form: `<issue-number>_<snake_case_slug>.md` — e.g. `1460_graphql_client_subscription_support.md`.

Before the issue exists, use `NNNN_<slug>.md` and an `NNNN` placeholder in the Issue field, then rename.
The repo's history shows files being renamed once the issue number is known, and kebab-case being corrected
to snake_case — so snake_case is the enforced form.

### A BEP is a single file

The process document states this explicitly. There is **no parent/child BEP mechanism**, no numbering scheme
for sub-proposals, and no supersession header field. The only formal hook for relating BEPs is the
`## Dependencies` section ("What other BEPs or external components does this depend on?").

If you need a coordinating document across several BEPs, it is a GitHub issue, not a BEP. Release strategy
and sequencing discussions belong in `ballerina-platform/ballerina-library`, not `ballerina-spec` —
`ballerina-spec` is for specification, `ballerina-library` for implementation and release concerns.

### Header block

Nested-list form, two-space sub-indent. Six fields, in this order. Do not use the inline `Field: value`
form — one BEP in the repo does, and it is the outlier.

```markdown
# Your Short, Descriptive Title

- Authors
  - Full Name
- Reviewed by
  - _TBD_
- Created date
  - 2026-08-14
- Updated date
  - 2026-08-14
- Issue
  - [1460](https://github.com/ballerina-platform/ballerina-spec/issues/1460)
- State
  - Submitted
```

Dates are `YYYY-MM-DD`. Multiple reviewers may be separate list items or comma-separated on one line; both
appear in the repo. `Updated date` is optional in practice but include it.

The title carries no "BEP" prefix and no number.

### Trailer

The last two lines of the file:

```markdown
[]: # (end)
[]: # Please add any comments to issue [#NNNN]()
```

### Section outline

From the template, in this order:

`## Summary`, `## Motivation`, `## Goals`, `## Non-Goals`, `## Design`, `## Alternatives`, `## Testing`,
`## Risks and Assumptions`, `## Dependencies`, `## Future Work`, `## References`.

Notes drawn from real BEPs:

- **Omitting sections is normal.** Small BEPs in the repo carry only Summary, Goals, Motivation,
  Description, Testing. Do not pad a section to fill the outline.
- Some BEPs use `## Description` instead of `## Design`. Both are accepted; `Design` matches the template.
- Some invert Goals and Motivation. The template order is Motivation then Goals.
- `## Current State Analysis`, inserted between Non-Goals and Design, is a useful non-template addition for
  a proposal that changes existing behaviour. Record present-day behaviour with the exact package version
  it was verified against, so a reviewer can check it.
- Use `### Risks` and `### Assumptions` sub-headings under `## Risks and Assumptions`.

### Lifecycle states

`Submitted`, `Accepted`, `Implemented`, `Deferred`, `Rejected`. New BEPs are `Submitted`. Note that in
practice every BEP in the repo has stayed at `Submitted` — do not read that as meaning the state field is
unused, but do not expect a curated lifecycle either.

### Prose conventions

- **Paragraph per line.** One paragraph is one physical line, however long. No hard wrapping at a column,
  and no semantic line breaks. This is the dominant convention across the repo; only one BEP hard-wraps.
- Bullet marker `-`. Blank line after every heading.
- Backtick every type, method, annotation, field, and diagnostic code name.
- Fences: ` ```ballerina `, ` ```graphql `, ` ```toml `, ` ```json `, ` ```shell `, ` ```mermaid `.
- Present API surfaces as commented Ballerina declarations using `#` doc comments.
- Impersonal voice: "This proposal…", not "we".

### Cross-references

- **To another BEP: link the GitHub issue, not the file.** Form:
  `[BEP 1460 — GraphQL Client Subscription Support](https://github.com/ballerina-platform/ballerina-spec/issues/1460)`.
  Even for a BEP sitting in the same directory, the repo links the issue.
- **Within a document:** markdown anchors — `[Section 2.1](#21-slug)`.
- **To a BEP that does not exist yet:** prose only, no link — "a dedicated custom scalar BEP".
- **To the process doc:** relative path — `../AAA-bep-resources/0000_bep_process.md`.
- **Never use `§`.** Write "Section 2.1". The section sign is not a convention of this repo.

## What must never go in a BEP

A BEP is a public document in a public repo. It may reference public URLs only.

- No links to internal documents: implementation plans, Google Docs, Drive, Confluence, Jira, Notion,
  SharePoint, slide decks, local file paths.
- **No references to earlier revisions or drafts of the proposal itself.** Readers were not there. "An
  earlier draft of this proposal rejected X" means nothing to them. State the current design and its
  reasoning. If a reversal needs explaining, explain the reasoning, not the history.
- No commentary about the document's own virtue — "stated explicitly rather than left implicit", "recorded
  here rather than silently dropped". State the thing.
- **No references to companies — customers, partners, or competitors.** Do not name a customer or a
  deployment as motivation ("team X needs this"), do not name partner organisations, and do not frame a
  design against a competitor commercially. Motivate with the technical problem and with what users of the
  package hit, not with who is asking.

  Comparing against other implementations is fine and is existing practice in this repo — the GraphQL BEPs
  compare resolver models across Apollo Server, HotChocolate, Spring for GraphQL, gqlgen and Strawberry.
  The distinction is that those name **software and specifications**, as technical precedent, in a
  neutral comparison. Reference the library, the specification, or the published behaviour. Never the
  commercial relationship. The same applies to your own employer's commercial products: a BEP in a public
  language repo argues from the language and the package, not from a product that depends on it.

## Judgment

### How long should it be

Real BEPs in `ballerina-spec` run 62–462 lines. Package proposals in `module-ballerina-*/docs/proposals/`
have a median around 105 lines and are strictly single-feature.

A BEP over roughly 500 lines is worth questioning. One over 1,000 is almost certainly several BEPs.

### When to split

Split by **feature area**, never by a property of the change.

"Breaking versus non-breaking" is a property, not a topic. It cuts badly: an API redesign that is partly
breaking and partly additive lands in two documents, and any area with its own undecided
breaking/non-breaking fork cannot be filed on either side until that decision is made. The same trap
applies to "foundational and non-breaking" — also a property.

Signals that a document should be split:

- More than one open decision. In one document they block each other; a reviewer cannot accept the parts
  they agree with.
- Sections that do not need each other's decisions to be made.
- A companion document that has to be duplicated per option, then hand-synced.
- The document already hands work off to other proposals. If it does that once, ask where to stop, not
  whether to split.

What splitting costs, and how to keep it: reviewers lose the single-read view of the whole release, and
cross-cutting accounting gets distributed. Put the release-level map, the dependency structure, the
consolidated compatibility accounting, and any shared documentation sweep in a coordinating **issue**, not
a parent BEP. Each BEP then carries its own slice of current-state analysis so it can be reviewed alone.

Note the precedent: when interceptor support in the GraphQL package outgrew one shippable increment, it
became two proposals (`interceptors.md`, `field-interceptors.md`) sharing one tracking issue, rather than
one bundled document.

### Presenting a decision you are not making

It is legitimate for a BEP to design two approaches in full and leave the choice to reviewers. When you do:

- Give both approaches equal depth and equally plain language. Editing must not tilt them.
- Put the comparison in a table with one row per dimension. Keep both columns balanced in length.
- Say plainly in Non-Goals that the proposal does not make this decision.
- If the author has a lean, state it once, at the end, as a lean. Do not let it colour the rest.
- Do not let a later editing pass quietly resolve it.

### Numbers that are not final

Diagnostic codes, error codes, and similar allocations proposed ahead of implementation should say so:
"proposed, not frozen — confirmed during implementation against whatever else has landed by then."

### Unverified design

If you carry design forward from work that was never reviewed, say so in the Summary and again where it
appears, and name exactly what must be re-verified. Writing something up as a BEP does not verify it.

## Implementation plans

There is **no precedent for implementation-plan documents in either `ballerina-spec` or
`module-ballerina-*`**. A BEP is the whole design artifact; proposals and their implementation land
together.

If you write one anyway, it is an internal working document:

- Keep it outside `beps/`.
- The BEP must not link to it.
- It may reference internal things freely.
- One plan per BEP. If a plan has to fork per option, that is a signal the fork belongs in one document as
  a branch per phase, not in two near-duplicate files.

Useful shape: a `## 0. Pre-work` table (`| # | Item | Owner | Output |`), numbered phases each ending in an
acceptance gate, file-path/change blocks in plain fences, a `## Sequencing` section, and a
`## Risk register` table (`| Risk | Impact | Mitigation |`).

## Package proposals are a different convention

`module-ballerina-*/docs/proposals/` follows its own rules, and they are not the BEP rules:

- Filename: `lowercase-kebab-case.md`, named after the feature, no number.
- Title: `# Proposal: <Title Case Feature Name>`.
- Header uses `_Owners_`, `_Reviewers_`, `_Created_`, `_Updated_`, `_Issue_` with `YYYY/MM/DD` dates and
  bare `@handle` names, each line ending in a markdown hard break.
- Outline: Summary, Goals, Non-Goals (optional), Motivation, Description, Alternatives (optional).
- There is no State field: presence in the directory means accepted.
- Proposals do not link each other. They link the package spec by anchor. The spec is the hub.
- The directory is a historical record. Do not edit a shipped proposal to correct it later.

## Checklist before submitting

- [ ] Filename is `<issue-number>_<snake_case_slug>.md`, or `NNNN_` with the issue not yet open.
- [ ] Header has all six fields, in order, nested-list form, `YYYY-MM-DD` dates.
- [ ] Trailer present as the last two lines.
- [ ] Every section in template order; empty sections omitted rather than padded.
- [ ] Paragraph-per-line; no hard wrapping.
- [ ] No `§` anywhere.
- [ ] Every external link is a public URL. No internal documents, no local paths.
- [ ] No references to earlier drafts or revisions of this proposal.
- [ ] No customers, partners, or competitors named; no commercial framing.
- [ ] Other BEPs referenced by issue URL, not by file path.
- [ ] In-document anchors resolve.
- [ ] Current-state claims name the package version they were verified against.
- [ ] Any open decision is stated as open, with both options balanced.
- [ ] Proposed-but-unfrozen numbers are labelled as such.
- [ ] Length is in the 60–460 line range, or the extra length is justified.

A fill-in template is in `bep-template.md` next to this file.
