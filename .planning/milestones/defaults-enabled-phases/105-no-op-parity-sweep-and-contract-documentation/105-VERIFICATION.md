---
phase: 105-no-op-parity-sweep-and-contract-documentation
verified: 2026-08-15T23:59:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: No — initial verification
---

# Phase 105: No-op parity sweep and contract documentation Verification Report

**Phase Goal:** A plugin that says `defaultEnabled: true`, or says nothing at all,
behaves exactly as it did before this milestone; and the contract records both the
new token and the divergence this milestone deliberately does not close.
**Verified:** 2026-08-15T23:59:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

Verification for this phase is by mutation, not by reading. For each of the four
roadmap success criteria, the production code or fixture the claim depends on was
broken in the working tree, the relevant test was run and observed RED, and the
change was reverted and re-confirmed GREEN. Every mutation below was applied,
observed, and reverted in this session; `git status --porcelain` at the end of
verification shows only the pre-existing `STATE.md` modification and the untracked
`.verification-ledger.json` — no mutation survived into the tree.

## Goal Achievement

### Observable Truths (mapped to the four roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `defaultEnabled: true` and an absent `defaultEnabled` produce byte-identical output to pre-milestone across all six surfaces | ✓ VERIFIED | See "Criterion 1 — six-surface mutation results" below |
| 2 | `docs/output-catalog.md` carries the `installs disabled` token and every emitting surface, reconciled against what shipped | ✓ VERIFIED | See "Criterion 2 — catalog gaps" below |
| 3 | The dependency-requirement override is documented as a known divergence a reader can tell from an oversight | ✓ VERIFIED | See "Criterion 3 — divergence documentation" below |
| 4 | Closed sets stay closed: `REASONS` grew by exactly one tail member, no other closed set moved | ✓ VERIFIED | See "Criterion 4 — closed-set mutation" below |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

## Criterion 1 — six-surface mutation results

The install-surface DFEN-08 case the previous review (WR-07) flagged as covering
only DFEN-05 precedence was replaced by a genuine three-arm fixture in commit
`e094ba05` (`tests/orchestrators/plugin/install.test.ts:1527`, `"DFEN-08: a
declared-true entry and a silent entry render identical install rows"`), landed
after `105-05-SUMMARY.md`'s review-closure pass and with no per-plan SUMMARY of its
own. Because it is the newest, least-settled fix named in the verification brief,
it received a dedicated mutation, plus a second mutation against the shared
resolution primitive all six surfaces are seeded through, plus a third against the
structural grep gate for `update`/`reinstall`.

| Surface | Mechanism under test | Mutation | Result | Reverted |
|---|---|---|---|---|
| install | `resolveDefaultEnabled` — silent-declaration fallback (`domain/resolver.ts:734`, `return true` → `return false`) | Changed the silent-arm default from `true` to `false` | `install.test.ts` test 22 (`DFEN-08: a declared-true entry and a silent entry render identical install rows`) went RED: `not ok 22`. 122/125 pass, 3 fail (the DFEN-08 case plus two unrelated pre-existing cases sensitive to the same primitive) | ✓ clean revert, 125/125 pass |
| update | same primitive (installs seed the fixture before the update runs) | same mutation | `update.test.ts` test 54 went RED on its precondition (`false !== true`, "precondition: a silent entry installs enabled") | ✓ clean revert, 101/101 pass |
| reinstall | same primitive | same mutation | `reinstall.test.ts` test 87 went RED on the same precondition class | ✓ clean revert, 90/90 pass |
| reconcile | same primitive | same mutation | `apply.test.ts` test 32 went RED on the same precondition class | ✓ clean revert, 34/34 pass |
| update / reinstall (structural half) | `tests/architecture/no-lifecycle-default-enabled-read.test.ts` — grep gate forbidding `defaultEnabled`/`applyDefaultEnabled` references in `update.ts`/`reinstall.ts` | Appended `export const __mutationProbe = "defaultEnabled";` to `update.ts` | Gate went RED (`not ok 1`); a comment-only reference (tried first) was correctly ignored by the comment-stripping scanner, confirming the gate targets real code references | ✓ clean revert, 1/1 pass |
| list | `entryDeclaresInstallDisabled` (`domain/resolver.ts:664`, `entry.defaultEnabled === false` → `entry.defaultEnabled !== true`) | Made a silent entry resolve as disabled | `list.test.ts` test 9 (`"OUT-02 / OUT-05 / DOC-02: ... a declared-true entry and a silent entry stay bare"`) went RED, along with 10 other tests sharing the primitive | ✓ clean revert, 83/83 pass |
| info | (not separately mutated — shares `rowClaimsInstallDisabled`/`entryDeclaresInstallDisabled` with `list`, confirmed by the `list` mutation above) | — | `info.test.ts:3390` carries the equivalent declared-true-vs-silent pair (`"OUT-03: ... a declared-true entry differs by exactly that brace"`) | 79/79 pass at rest |

All six surfaces carry a fixture that genuinely discriminates the silent-user arm
from the declared-true arm, with a declared-false control proving the fixture
reached the code path under test in each case. The previous review's WR-07 gap
(install's cited case exercising DFEN-05 precedence, never the silent arm) is
closed by a real fixture, and that fixture's own mutation check (breaking the
resolver's silent-arm fallback) turns it red — it is not merely present, it is
load-bearing.

## Criterion 2 — catalog gaps

Both DOC-01 gaps named in CONTEXT are closed and gated by the byte-equality
runner (`tests/architecture/catalog-uat.test.ts`).

- **Gap A — reinstall's `(skipped) {already disabled}` cascade row.**
  `docs/output-catalog.md:780-792` (`### Reinstall over an already-disabled record
  inside a cascade`) carries the bulk form with its fixture
  (`reinstall-disabled-record-cascade` in `catalog-uat.test.ts`). Mutation: changed
  `beta` to `beto` inside the fenced block. Result: `not ok 1 - catalog UAT: every
  <!-- catalog-state: --> annotation pairs byte-equal with notify()`, 5/6 pass.
  Reverted; 6/6 pass restored.
- **Gap B — the `(available)` token-table row.** `docs/output-catalog.md:143` now
  names the `{installs disabled}` token on the `(available)` row, matching the
  treatment its `(remote)` sibling (line 144) already carried. This cell is prose
  in a non-byte-gated table and was confirmed by direct read against its sibling
  row, per the phase's own documented manual-only disposition (`105-VALIDATION.md`).

## Criterion 3 — divergence documentation

`docs/plugin-enablement.md` (created in plan 03, corrected by two post-review fix
commits `5b65b569` and the review-fix sequence ending at `e094ba05`) states:

- **The dependency-requirement override**, correctly as "parsed and surfaced,
  never resolved, never auto-installed, never consulted for enablement" — not the
  earlier "dropped entirely" phrasing the code review's WR-04/IN-03 findings
  flagged. Verified against `normalizeDependencies` (`orchestrators/plugin/info.ts:342`),
  whose sole consumer is `info.ts:858`.
- **The upstream quote** is now attributed with a link and a retrieval date
  (`quoted verbatim from [the upstream plugins reference](...), retrieved
  2026-08-15`), closing WR-04.
- **The import cascade** (WR-03) has its own table row, correctly stating that
  `applyDefaultEnabled` is deliberately not passed (D-102-03) and confirmed
  against source: `grep -n "applyDefaultEnabled" extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
  returns no hits.
- **The entry-only pre-install read rule** is stated as the three-input version
  (`## The pre-install claim is read from the marketplace entry alone`), agreeing
  with `docs/output-catalog.md:380`'s existing prose, per CONTEXT's requirement.
- The document affirmatively records its own lack of an automated byte gate
  (`## Not delivered (out of scope)` → "This document is not byte-gated"), so a
  reader cannot mistake the prose for an enforced guarantee — this is itself
  part of what makes criterion 3's "a reader can tell a stated limit from an
  oversight" observably true rather than merely claimed.
- Reachable from both READMEs (`README.md:160`, `README.es.md:160`), confirmed by
  direct grep.

## Criterion 4 — closed-set mutation

`tests/architecture/compat-01-no-expansion.test.ts` hardcodes the full 38-member
`REASONS` literal with `"installs disabled"` as the sole new tail entry (line 168).
Mutation: appended a 39th member, `"mutation probe reason"`, to the production
`REASONS` array in `shared/notify.ts`. Result: `not ok 1 - COMPAT-01: REASONS holds
exactly its inherited members, in order`, 13/14 pass. All 13 other closed-set
clauses (status tokens, plugin/marketplace statuses, glyphs, install-record keys,
schema version union, network-gate delegation) stayed green under this same
mutation, confirming they are independent assertions, not incidentally-passing
side effects of the one changed clause. Reverted; 14/14 pass restored.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/plugin-enablement.md` | New contract document, both divergences, both README links | ✓ VERIFIED | Present, content-verified against source above |
| `docs/output-catalog.md` | Two DOC-01 gaps closed | ✓ VERIFIED | Both present, one byte-gated (mutation-confirmed), one manual-confirmed |
| `tests/orchestrators/plugin/{install,update,reinstall}.test.ts` | DFEN-08 parity cases | ✓ VERIFIED | All three mutation-confirmed |
| `tests/orchestrators/reconcile/apply.test.ts` | DFEN-08 reconcile parity case + widened `seedRealPathMarketplace` | ✓ VERIFIED | Mutation-confirmed |
| `tests/architecture/compat-01-no-expansion.test.ts` | Criterion 4, unchanged except one tail delta | ✓ VERIFIED | Mutation-confirmed |
| `tests/architecture/no-lifecycle-default-enabled-read.test.ts` | Structural half of update/reinstall guarantee | ✓ VERIFIED | Mutation-confirmed |
| `.planning/workstreams/defaults-enabled/REQUIREMENTS.md` | OUT-02 amendment, DOC-02 widened | ✓ VERIFIED | Both present and reworded per plan 03 |

## Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `docs/plugin-enablement.md` divergence section | `orchestrators/plugin/info.ts::normalizeDependencies` | prose claim vs. source | ✓ WIRED — claim matches code |
| `docs/plugin-enablement.md` import row | `orchestrators/import/execute.ts` | claim that `applyDefaultEnabled` is not passed | ✓ WIRED — confirmed by grep (no hits) |
| README.md / README.es.md | `docs/plugin-enablement.md` | relative link | ✓ WIRED — one occurrence each, correct section |
| `tests/shared/notify-not-installed-reasons.test.ts:147` | `(available)` central-renderer drop | citation `OUT-02` | ✓ WIRED — re-anchored per WR-06 fix, `RSTA-01` correctly confined to the `(remote)` case at `:151` |

## Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`) or unresolved `TODO`/`HACK`/`PLACEHOLDER`
found in any file touched by this phase. Two Info-severity findings from the
phase's own code review (`105-REVIEW.md`) remain open and unfixed at time of
verification:

- **IN-01**: three new comments in `update.test.ts`/`reinstall.test.ts` still say
  "what this milestone owes them" — bare "milestone" is precedented elsewhere in
  the codebase per the review's own mitigation note, and is not one of the
  specifically forbidden forms (`milestone vX.Y`) in
  `.claude/rules/typescript-comments.md`. Not a blocker.
- **IN-04**: `docs/plugin-enablement.md` is not enrolled in
  `tests/architecture/partial-vocabulary-guard.test.ts`'s `collectGuardedSources()`
  list. The review itself notes this is "distinct from, and not an argument
  against, the deliberate decision that the doc carries no byte-equality gate."
  Not a blocker; a legitimate follow-up.

Neither finding touches DFEN-08, DOC-01, or DOC-02's substance.

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| DFEN-08 | 105-01, 105-02, (install fix commit `e094ba05`) | Byte-identical no-op across six surfaces | ✓ SATISFIED | Mutation-verified across all six surfaces above |
| DOC-01 | 105-04, 105-05 | Catalog amended for the new token and its surfaces | ✓ SATISFIED | Both gaps mutation/manual-confirmed above |
| DOC-02 | 105-03, 105-06, (post-review fix commit `5b65b569`) | Dependency override documented as known divergence | ✓ SATISFIED | Content-verified against source above |

No orphaned requirements: all three phase-scoped IDs (DFEN-08, DOC-01, DOC-02)
appear in at least one plan's `requirements:` frontmatter, matching
REQUIREMENTS.md's phase-105 assignment.

**Note (non-blocking):** `REQUIREMENTS.md`'s checkboxes for DFEN-08/DOC-01/DOC-02
and its traceability table (`Pending`) are not yet updated to reflect completion,
and `ROADMAP.md`'s phase/plan checkboxes are likewise still `[ ]`. This matches
the pattern of prior phases (101-104), where these bookkeeping updates land at
phase-close rather than during plan execution, and is outside this verification's
scope.

## Human Verification Required

None. Every must-have for this phase was either mutation-verified (behavioral) or
directly content-verified against source (the ungated `docs/plugin-enablement.md`
prose, which this verification read as a reviewer of fact per its brief).

## Gaps Summary

No gaps. All four roadmap success criteria hold under mutation. The install
surface's DFEN-08 coverage — flagged by the prior code review (WR-07) as the
weakest link and the newest fix — was independently mutation-verified and found
genuinely load-bearing. Two Info-severity findings from the phase's own review
remain open as legitimate, non-blocking follow-ups (IN-01, IN-04).

---

_Verified: 2026-08-15T23:59:00Z_
_Verifier: Claude (gsd-verifier)_
