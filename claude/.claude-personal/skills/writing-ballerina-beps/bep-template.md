# Your Short, Descriptive Title

- Authors
  - Full Name
- Reviewed by
  - _TBD_
- Created date
  - YYYY-MM-DD
- Updated date
  - YYYY-MM-DD
- Issue
  - [NNNN](https://github.com/ballerina-platform/ballerina-spec/issues/NNNN)
- State
  - Submitted

## Summary

What this proposal changes, in a few short sentences. State the current behaviour, the problem, and what the proposal does about it. A reader who stops here should know whether the rest concerns them.

## Motivation

Why this should be done. Who is asking for it. What it costs to leave it alone. Where relevant, how comparable libraries in other ecosystems handle the same problem — a table works well for that.

Keep this about the problem. The solution goes in Design.

## Goals

- One bullet per outcome this proposal commits to.
- Phrase as outcomes, not as tasks.

## Non-Goals

- What this proposal explicitly does not do, and where that work lives instead if it lives anywhere.
- Anything a reader might reasonably expect to find here and will not.
- If the proposal deliberately leaves a decision open, say so here.

## Current State Analysis

Optional, but valuable whenever the proposal changes existing behaviour. Record present-day behaviour, sourced from a named package version, e.g. "verified against `ballerina/x` v1.18.0, distribution `2201.13.3`". Keep it factual. This is the baseline the Design section changes, and a reviewer must be able to check it.

## Design

The main section. Detailed enough that a reviewer can evaluate it and an implementer can build from it.

Number sub-sections (`### 1. Thing`) when there is more than one distinct design item and you need to cross-reference between them.

Show the API surface as commented Ballerina declarations:

```ballerina
# Describes what this does.
#
# + field - what this field is for
public type SomeConfig record {|
    string name;
|};
```

Show before and after where a change is easier to see than to describe:

```ballerina
// Before
string token = check context.get("token").ensureType();

// After
string token = check context.getWithType("token");
```

If the proposal designs two approaches and does not choose between them, give each its own sub-section at equal depth, then a comparison table with one row per dimension and one column per approach. Keep the columns balanced.

## Alternatives

What else was considered and why it was not chosen. One `###` sub-heading per alternative, each ending in a plain verdict.

Include a "Doing nothing" entry: what happens if this is not done.

Keep rejected options here even when the rejection seems obvious — a BEP is a decision record, and the next person to have the same idea should find out why it was dropped.

## Testing

The categories of coverage this needs. Positive and negative cases, compile-time and runtime, regression baselines that must be captured before a change lands.

Fixture-level detail belongs to implementation, not here.

## Risks and Assumptions

### Risks

- **Short bold lead-in.** Then the risk, and how it is mitigated or why it is accepted.

### Assumptions

- **Short bold lead-in.** Then the assumption, and whether it is confirmed or still to be verified. Say "not yet verified" when that is the truth.

## Dependencies

- **[BEP NNNN — Title](https://github.com/ballerina-platform/ballerina-spec/issues/NNNN).** What it supplies and why this proposal needs it.
- External components, tools, or specifications this depends on.
- Forward dependencies this proposal creates rather than depends on — say which is which.

## Future Work

- What this proposal makes possible or necessary but does not do.
- Anything deferred out of Non-Goals that should be picked up later.

## References

Group under `###` sub-headings when the list is long — Specifications, Comparable libraries, Ballerina.

- [Public URL](https://example.com) — one line on why it is relevant
- [BEP process](../AAA-bep-resources/0000_bep_process.md)

[]: # (end)
[]: # Please add any comments to issue [#NNNN]()
