---
phase: 02-row-policies
fixed_at: 2026-10-02T09:42:43Z
review_path: .planning/phases/02-row-policies/02-REVIEW.md
iteration: 2
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-02T09:42:43Z
**Source review:** `.planning/phases/02-row-policies/02-REVIEW.md`
**Iteration:** 2 (iteration 1: CR-01, WR-01; iteration 2: WR-02, WR-03, WR-04, IN-01)

**Summary:**

- Findings in scope: 6 (2 in iteration 1, 4 in iteration 2)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### WR-01: The surviving formatter accepts unresolved partial-install rows

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts`, `tests/shared/notification-grammar.test.ts`
**Commit:** 6abaddf9
**Applied fix:** `composePluginLines` is now generic over `R extends ResolvedRow`.
Its row parameter is `R & ("dependencies" extends keyof R ? never : unknown)`, so a
producer row that still declares `dependencies` is refused at the call site.

The review suggested `ResolvedRow & { readonly dependencies?: never }`. That
shape compiles, but the unused-type-member gate reports the new member as unread
(`composePluginLines.p.dependencies`). The full corpus run caught this through
`tests/architecture/unused-type-member-gate.test.ts`. The only precedent for such a
marker is a recorded exception, and the milestone does not allow new exceptions.
The conditional declares no member, and the gate passes with its three existing
exceptions.

The grammar test restores the negative check as a call-site `@ts-expect-error`.
`Parameters<typeof composePluginLines>[0]` instantiates `R` at its constraint, so
a type-level `Assignable` check cannot observe the refusal.

**Evidence:** typecheck passes. Removing the conditional fails the test file with
TS2578 (unused `@ts-expect-error`). Direct coverage is 100% (165/165 branches,
39/39 functions, 1,098/1,098 lines). Lint and Prettier pass. The type-member gate
passes with 3 recorded exceptions. Pre-commit passed, including
`npm changed checks`.

### CR-01: Marketplace-miss test suppresses the reasons it must verify

**Files modified:** `tests/orchestrators/plugin/shared.test.ts`, `.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl`, `02-CORPUS-CHANGES.json`, `02-CONTEXT.md` (D-07), `02-DISCUSSION-LOG.md`, `02-VALIDATION.md`, `.planning/ROADMAP.md`
**Commit:** 0a05d28d
**Applied fix:** the owner case enables `contentReasons` for `skipped` and expects
`  ⊘ hello (skipped) {not installed, marketplace in user scope}` in the exact
notification. Severity, cardinality, name, scope, and tally assertions are unchanged.

This moves one corpus occurrence, approved by the user as the 29th replacement.
The ledger records it at immutable-blob line 1907: 29 replacements, 2,632
unchanged, 2,661 total in blob `25f4e3c0`. The merge from main re-baselined the
corpus to 3,133 entries (`e514ea67`) before this fix. The occurrence is at line
2,284 there, and it is the only line that differs from that baseline. `meta.json`
is unchanged.

**Evidence:** replacing `reasons: absentTargetReasons(err.notInstalledAt)` with
`reasons: []` in `orchestrators/plugin/shared.ts` fails the case (0 pass,
1 fail). 214 owner tests pass. Direct coverage of `orchestrators/plugin/shared.ts`
is 100% (189/189 branches, 48/48 functions, 1,630/1,630 lines). The ledger check
reports 29/2,632/2,661, every after-record present, and no before-record
remaining. Pre-commit passed.

## Corpus Check Note

The full `notify-corpus.mjs check` ran 8,737 tests with 0 failures and 1 existing
optional pi-subagents skip. It exits 1 on eight missing/extra pairs, all in
`tests/orchestrators/plugin/prune.test.ts`. Those messages embed a random
`prune-backup-XXXXXX` directory name, which the `e514ea67` re-baseline captured
verbatim. After normalizing that suffix, all 37 prune entries match the baseline
exactly. No other file has a missing or extra entry. This nondeterminism arrived
with main's prune tests (#198) and is independent of both fixes. It needs a
corpus normalization fix before the corpus gate can report a clean exit.

## Iteration 2 Fixes

The iteration-2 review (source revision `6e222b1f`) confirmed CR-01 and WR-01
resolved and raised four new findings.

### WR-02: The `dependencies` refusal does not apply to union-typed arguments

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts`, `tests/shared/notification-grammar.test.ts`
**Commit:** c9c4f16b
**Applied fix:** the refusal now distributes over the members of `R`:
`R & ([R extends unknown ? ("dependencies" extends keyof R ? R : never) : never] extends [never] ? unknown : never)`.
The reviewer's named helper type `UnresolvedRowMembers<R>` failed fallow with a
private-type leak from the exported signature, so the conditional is inline. The
grammar test adds a union negative,
`PluginPartiallyInstalledMessage | ResolvedRow<PluginInstalledMessage>`.

**Evidence:** typecheck passes. The non-distributive form fails the union negative
with TS2578, and removing the refusal fails both negatives. fallow dead-code and
health pass, the type-member gate passes with 3 recorded exceptions, and
pre-commit passed.

### WR-03, WR-04, IN-01: Stale names of deleted render helpers

**Files modified:** comments in `shared/notification-grammar.ts`,
`shared/notification-types.ts`, `shared/notification-resolve.ts`,
`orchestrators/reconcile/{pending,notify,apply}.ts`,
`orchestrators/marketplace/{update,remove}.ts`, `orchestrators/import/execute.ts`
and `orchestrators/plugin/uninstall.ts`. Test titles and keys in
`tests/shared/notification-grammar.test.ts`,
`tests/orchestrators/import/execute.messaging.test.ts`,
`tests/orchestrators/reconcile/reconcile.messaging.test.ts` and
`tests/architecture/soft-dep-marker-policy.test.ts`.
`scripts/check-unused-type-members.contracts.json` changes because one pin moved.
**Commit:** 50566a24
**Applied fix:** comments now describe row policies, `resolveRows` and
`composePluginLines`. No `renderPluginRow`, `dispatchRow`, `render*Row` or "render
map" reference remains in `extensions/`, apart from the unrelated local
`renderPluginRow` in `edge/handlers/tools.ts` and the frozen `no render arm for`
output bytes. The shorter D-11 comment moved the pinned
`isDescriptionBearingRow` declaration from line 927 to 925, and the pin moved with
it. IN-01's JSDoc and test-comment wording was rewritten as part of the WR-02 commit.

**Evidence:** 164 owner tests pass across the four touched test files. The
type-member gate passes, and pre-commit passed with `npm changed checks`.

_Iteration 2 fixed: 2026-10-02T11:29:14Z_

---

_Fixed: 2026-10-02T09:42:43Z_
_Fixer: Claude (orchestrator, inline)_
_Iteration: 2_
