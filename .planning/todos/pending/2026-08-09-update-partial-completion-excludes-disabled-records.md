---
created: 2026-08-09
resolves_phase: 98
source: 97-REVIEW.md WR-04
---

# `update --partial` completion excludes the records it is the only remedy for

`classifyPluginState` (`orchestrators/plugin/plugin-state-classifier.ts`)
collapses every disabled record to `installed`, which by design keeps it out of
the `update --partial` candidate set (pinned by
`tests/orchestrators/edge-deps.test.ts`).

But `update`'s disabled-record short-circuit is only reachable WITH `--partial`
when the candidate resolves `partially-available` — the ENBL-09 suite header in
`tests/orchestrators/plugin/update.test.ts` states this and pins it. So
refreshing a disabled partial's pin requires typing a command the completion
provider will never offer. Per WR-02 (carried separately) that same command is
the prerequisite for a successful `enable` of such a record.

## Why deferred

The fix is a design choice about the classifier's contract, not a local repair:
either the classifier grows a distinct `disabled` classification consumed only
by the completion path, or the disabled short-circuit becomes reachable without
`--partial`. The first changes a closed-set classification the completion
buckets and their byte-pinned tests read; the second changes which commands
mutate a disabled record. Phase 97 deliberately collapsed the disabled-state
predicate rather than widening the classifier's vocabulary.

## Where it lands

Decide between:

1. Surface disabled records in the `--partial` completion bucket via a distinct
   classification consumed only by the completion path; or
2. Make the disabled short-circuit reachable without `--partial` — it stages
   nothing, so the strict-gate rationale does not apply to it.

Document the choice at the short-circuit in
`orchestrators/plugin/update.ts` and update the bucket pins in
`tests/orchestrators/edge-deps.test.ts` plus the ENBL-09 suite header.
