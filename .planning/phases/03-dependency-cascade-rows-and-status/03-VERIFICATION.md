---
phase: 03-dependency-cascade-rows-and-status
verified: 2026-10-27T07:05:00Z
status: human_needed
score: 12/12 must-haves verified
covered_files:
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-01-PLAN.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-01-SUMMARY.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-02-PLAN.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-02-SUMMARY.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-03-PLAN.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-03-SUMMARY.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-04-PLAN.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-04-SUMMARY.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-05-PLAN.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-05-SUMMARY.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-06-PLAN.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-06-SUMMARY.md"
  - "docs/dependency-resolution.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/domain/dependency-closure.ts"
  - "extensions/pi-claude-marketplace/domain/dependency-range.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts"
  - "extensions/pi-claude-marketplace/shared/notification-mcp.ts"
  - "features/plugin/install-dependencies.feature"
  - "features/plugin/install.feature"
  - "features/plugin/update-dependencies.feature"
  - "features/plugin/update.feature"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/architecture/catalog-uat/catalog-parser.test.ts"
  - "test/architecture/catalog-uat/catalog-wire.test.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-install.ts"
  - "test/domain/dependency-closure.test.ts"
  - "test/domain/dependency-range.test.ts"
  - "test/integration/reserved-record-keys.test.ts"
  - "test/orchestrators/plugin/constraint-fold.test.ts"
  - "test/orchestrators/plugin/dependency-move.test.ts"
  - "test/orchestrators/plugin/dependency-plan.test.ts"
  - "test/orchestrators/plugin/install-cascade.messaging.test.ts"
  - "test/orchestrators/plugin/install-cascade.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/install-outcome.test.ts"
  - "test/shared/notification-mcp.test.ts"
covered_digest: "v4:sha256:c885d24fa0d30f0c8713f0ff0c1ff2fee5e78a6b954c5f849f14dc43f739270f"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Accept or reverse D-PL3-15 (scope of the CAS-01 rows), and give its known gaps a carrier"
    expected: "Either the operator accepts that three routes keep one failed row (the root's own ledger failure, UPD-DEP-D1 plan-step failures, a catalog lookup that throws mid-walk) and the gaps get a carrier in ROADMAP Phase 4 / Phase 11 success criteria or a BACKLOG entry, or the operator asks for rows on those routes now"
    why_human: "CAS-01 reads 'each member that resolved but did not install'. On the root-ledger route (install-flow.ts:1112-1126, the subject is only set when cascade.key !== rootKey) the rolled-back dependencies get no row. D-PL3-15 records this as Uncertain, for user review. No ROADMAP success criterion and no BACKLOG entry carries it, so Phase 11's CLN-04 backlog sweep would not see it."
  - test: "Accept or reverse D-PL3-06 (no propagation of a dependency's partial availability to its dependents)"
    expected: "Operator confirms upstream parity (Claude Code has no partial state, E3) over the operator statement recorded in the DEPS-STATUS-01 backlog entry, or asks for a {dependency partial}-style reason"
    why_human: "CAS-03 allows the decision-not-to, and it is recorded (docs/dependency-resolution.md:279), but CONTEXT marks it Uncertain and the backlog records an operator request for the opposite. Only the operator can settle it."
  - test: "Accept or reverse D-PL3-07 (git-source list rows keep upgradable)"
    expected: "Operator confirms the PL-5/RSTA/FTCH-licensed divergence (Claude Code's list shows no upgrade state for any source, E7), or asks to drop it"
    why_human: "AGENTS.md upstream-parity rule: a divergence needs a recorded decision ID or a Pi capability gap. D-PL3-07 cites PL-5, but CONTEXT marks the choice Uncertain and for user review."
  - test: "Accept or reverse D-PL3-10 (non-directory refusals keep the 200-per-range bound with '... (+N chars)')"
    expected: "Operator accepts the divergence or schedules alignment to upstream (64 per range, 200 for the joined list, U+2026)"
    why_human: "This is a divergence from Claude Code (E4) that the phase minted its own ID for and marked Uncertain. Under AGENTS.md's parity rule the operator must confirm it."
  - test: "Accept or reverse D-PL3-13 (installed plugins outside the closure are not named on a non-root member's directory-pin refusal)"
    expected: "Operator confirms D-03-10 licenses the divergence (upstream names them), or asks to fold their ranges in"
    why_human: "Upstream divergence, marked Uncertain in CONTEXT; needs operator sign-off."
---

# Phase 3: Dependency Cascade Rows and Status Verification Report

**Phase Goal:** Cascade rows and refusals name every member and declarer the way Claude Code does, and a plugin degraded by its dependency says so.
**Verified:** 2026-10-27T07:05:00Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

The code at HEAD (81d2494d) delivers every CAS requirement and every roadmap success criterion. The cucumber scenarios that pin the user-visible changes pass, and they compare rows exactly (`features/step_definitions/command.steps.ts:92-97`, `assert.deepStrictEqual` over the whole table). So a missing `lib` or `mid` row would fail them. Status is `human_needed`, not `passed`, for one reason. Several of the decisions that define the scope are marked Uncertain and "for user review" in `03-CONTEXT.md`. No operator acceptance is recorded for them, and two of them (D-PL3-10, D-PL3-13) are divergences from Claude Code that AGENTS.md routes to the user. One known gap (D-PL3-15) also has no carrier in a later phase.

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | SC1: the two `install-dependencies.feature` failure scenarios show a row for `lib` and `mid` (CAS-01) | VERIFIED | `features/plugin/install-dependencies.feature:89` (`lib@tools ... dependency failed`), `:144` (`mid@tools ... dependency failed`). Producer: `install-cascade.ts` `unmaterialized()` (filters root, failing key, read-through keys), wired on the closure arm (`resolveCascade`, closure-failed) and the constraint arm; renderer `install-cascade.messaging.ts` `unmaterializedRows`. Targeted cucumber run: 111/111 passed |
| 2  | SC2: `install _x@mp` reports the resolver's real cause; the pinned integration case changes with it (CAS-02) | VERIFIED | `domain/dependency-closure.ts` `refuseUnsplittableRoot` looks the root up first under `installPolicy`, absent -> single-member closure (caller reports `{not in manifest}`), listed -> `invalid-root-id` with `invalidPart`. Messaging: `install-cascade.messaging.ts` `INVALID_ID_HALVES` and the `invalid-root-id` arm (upstream text, `printable`-escaped key). Integration pin: `test/integration/reserved-record-keys.test.ts:394-396`. Scenarios: `features/plugin/install.feature:72` (listed `_x`), `:88` (zero-width name escaped in row and cause), `:102` (unlisted `_x` -> `Plugin "_x" not found in marketplace "fixtures".`) |
| 3  | SC3: a plugin depending on a partially available plugin shows the decided status, or the decision not to is recorded (CAS-03) | VERIFIED (decision recorded) | D-PL3-06 recorded in `docs/dependency-resolution.md:279`; no code change, `info.ts` untouched (not in the diff). Marked Uncertain in CONTEXT: see Human Verification |
| 4  | SC4: git-source `list` rows, `required by` lists, and truncation match Claude Code or carry a recorded ID (CAS-04, CAS-05) | VERIFIED | Git `list`: D-PL3-07 cited at `orchestrators/plugin/list-flow.ts:44-47` and `docs/dependency-resolution.md:104`; behavior pinned by the existing `features/plugin/fetch.feature:60`. Requirers: `install-cascade.ts` `rangeRequirers` names every range-declaring cascade member (`requestersOf` over the recorded `declared` edges). Truncation: `domain/dependency-range.ts` `truncateForRefusal` + `MAX_DIRECTORY_PIN_FIELD_CHARS = 120`, applied to joined ranges (`install-cascade.ts` `resolveOneMember`) and to name, version, each requirer (`install-outcome.ts` `assertDirectoryPinSatisfied`). Other refusals keep 200 (D-PL3-10) |
| 5  | SC5: the offline git-move refusal names a next step, and no hold cause carries an unbounded `version` string (CAS-06, CAS-07) | VERIFIED | Hint: `install-cascade.messaging.ts` `installedUnsatisfiedCause` (only when `declaredBy` includes the root key, set by `dependency-plan.ts` `unmovable`). Offline scenario `install-dependencies.feature:343`. Hold cause: `constraint-fold.ts:189-192` cuts `line.version` to 64; every `{dependents constrain}` producer (`update-preflight.ts:932,1087`, `reconcile/convergence.ts:493-514`) gets its cause from `describeConstraint`. Scenario `features/plugin/update.feature:409` |
| 6  | CAS-01: a failed install closure gives a row to each member that resolved but did not install | VERIFIED (scoped by D-PL3-15) | Walk, constraint, and non-root member-ledger routes covered (`failedCascade` builds `unmaterialized` from `phaseKeys`; `install-flow.ts` `unwrapCascade` forwards it; `handleCascadeThrow` passes `moved`). Scenarios: `:89`, `:144`, `:494` (rolled-back `mid`), `:1164` (moved dependency listed once). Root-ledger, plan-step, and mid-walk lookup throw routes keep one row by D-PL3-15: see Human Verification |
| 7  | CAS-02: `install` of a root name outside the token alphabet gets a verdict naming the real cause | VERIFIED | See truth 2. Enable walk (no `installPolicy`) keeps `unusable-declaration` (`refuseUnsplittableRoot`, `options.installPolicy === undefined`). `apply`/load/`import` show `{dependency failed}` + the new cause (D-PL3-17, recorded known limit) |
| 8  | CAS-03: partial availability shown on list/info/install, or the choice not to is recorded with an ID | VERIFIED | D-PL3-06, see truth 3 |
| 9  | CAS-04: `list` shows upgrade state for git-source plugins as Claude Code does, or carries a recorded ID | VERIFIED | D-PL3-07 (licensed by PL-5 + RSTA/FTCH), see truth 4 |
| 10 | CAS-05: a non-root member's refusal names every declarer; names and ranges truncated as Claude Code does | VERIFIED | Scope per PARITYGV-01 b2/b3 (`.planning/BACKLOG.md:4285-4290`: "these refusal messages" = the plugin directory pin refusal). Scenarios: `install-dependencies.feature:523` (`required by "app", "mid"`, ranges `^2.0.0, >=2.0.0`), `:552` (120-cut version with `…`). Unit cases: `install-outcome.test.ts` (name past 120), `install-cascade.test.ts` (joined ranges cut once at 120), `dependency-range.test.ts` (surrogate handling) |
| 11 | CAS-06: the offline refusal of an install that would move a git dependency names the next step | VERIFIED | See truth 5; also `update-dependencies.feature:119-127` (update settle refusal shows the hint) and catalog `docs/output-catalog.md:985` |
| 12 | CAS-07: a hold row's cause never interpolates an unbounded catalog `version` string | VERIFIED | See truth 5. D-PL3-16 also cuts `dependency-move.ts:152-153,185-186`, and review WR-01 cut `recordedVersion` in `installedUnsatisfiedCause` (`install-cascade.messaging.ts:411-412`), pinned by the scenario at `install-dependencies.feature:206` |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/dependency-range.ts` | `truncateForRefusal`, `MAX_REFUSAL_VERSION_CHARS = 64`, `MAX_DIRECTORY_PIN_FIELD_CHARS = 120` | VERIFIED | Lines 294-320; imported by constraint-fold, dependency-move, install-cascade, install-cascade.messaging, install-outcome |
| `domain/dependency-closure.ts` | `invalid-root-id` arm, lookup-first under `installPolicy` | VERIFIED | `refuseUnsplittableRoot`, `invalidIdPart`; called from `resolveDependencyClosure` |
| `orchestrators/plugin/install-cascade.ts` | `Unmaterialized`, `recordingLookup`, every-declarer `rangeRequirers`, `declaredBy` | VERIFIED | `Unmaterialized` is REQUIRED on every failure arm (compile-enforced) |
| `orchestrators/plugin/install-cascade.messaging.ts` | member rows, invalid-id cause, hint, escaped root row | VERIFIED | `unmaterializedRows`, `rootRowName`, `installedUnsatisfiedCause` |
| `orchestrators/plugin/install-flow.ts` | forwards the member list and moved keys | VERIFIED | `unwrapCascade` (`unmaterialized: cascade.unmaterialized`), `handleCascadeThrow` (`moved`) |
| `orchestrators/plugin/install-outcome.ts` | pre-cut directory pin fields | VERIFIED | `assertDirectoryPinSatisfied` |
| `orchestrators/plugin/list-flow.ts` | PL-5 comment cites D-PL3-07 | VERIFIED | `:44-47` |
| `docs/dependency-resolution.md` | D-PL3-06 and D-PL3-07 records, behavior text | VERIFIED | `:104`, `:279`, reason table, failure-list paragraph |
| `docs/output-catalog.md` | `dependency-invalid-root-id` state; failure attribution; hint | VERIFIED | `:1133-1140`, `:900`, `:985-989`; catalog contract green per the check log |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `install-cascade.ts::resolveCascade` | `install-flow.ts::unwrapCascade` | `failure.unmaterialized` on closure and constraint arms; copied onto member subject | WIRED |
| `install-flow.ts::handleCascadeThrow` | `composeCascadeFailureMessage` | `moved` argument excludes keys a moved row reports | WIRED |
| `dependency-plan.ts::unmovable` | `installedUnsatisfiedCause` | `declaredBy` checked against `rootKey` | WIRED |
| `resolveCascade` | `rangeRequirers` | `MemberConstraintOptions.declared` from `recordingLookup` | WIRED |
| `resolveOneMember` | `assertDirectoryPinSatisfied` | `directoryPin.declared` (cut) + `requiredBy` | WIRED |
| `constraint-fold.ts::describeConstraint` | `truncateForRefusal` | `line.version` cut to 64 | WIRED |
| `closureFailureFacts` / `rootRowName` | `shared/notification-mcp.ts::printable` | exported `printable` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase cucumber scenarios (CAS-01/02/05/06/07) and the git-list pin (CAS-04) | `npx cucumber-js features/plugin/install-dependencies.feature features/plugin/install.feature features/plugin/update.feature features/plugin/update-dependencies.feature features/plugin/fetch.feature` (hermetic sandbox, `features/support/pi-process.ts`) | 111 scenarios, 111 passed, exit 0 | PASS |
| Paired unit tests | `node --test` over dependency-range, dependency-closure, constraint-fold, dependency-move, install-cascade, install-cascade.messaging, install-outcome, dependency-plan, notification-mcp tests | 429 tests, 0 failed | PASS |
| Phase gate | `npm run check` (not re-run; caller-supplied log `check-fix.log`, written 02:48 after HEAD 02:45) | 911 scenarios passed, all static checks passed | PASS (reused) |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| CAS-01 | 03-03 | SATISFIED (scoped by D-PL3-15) | Truths 1, 6 |
| CAS-02 | 03-02 | SATISFIED | Truths 2, 7 |
| CAS-03 | 03-06 | SATISFIED (decision-not-to, D-PL3-06) | Truths 3, 8 |
| CAS-04 | 03-06 | SATISFIED (recorded divergence, D-PL3-07) | Truths 4, 9 |
| CAS-05 | 03-04 | SATISFIED | Truths 4, 10 |
| CAS-06 | 03-05 | SATISFIED | Truths 5, 11 |
| CAS-07 | 03-01 | SATISFIED | Truths 5, 12 |

No orphaned requirements: REQUIREMENTS.md maps exactly CAS-01..07 to Phase 3, and every plan claims at least one.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (added lines across the phase diff) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `orchestrators/plugin/update-preflight.ts` | 917 | raw `toVersion`/`expectVersion` in a plan-step failure note (review IN-04) | Warning | A failed row, not a hold cause, so CAS-07 holds. Assigned to Phase 4 by D-PL3-15, but Phase 4's success criteria do not name it and no BACKLOG entry carries it |
| `orchestrators/plugin/install-cascade.messaging.ts` | 9 | imports `printable` from the MCP notice module (review IN-03, skipped) | Info | Coupling only; no behavior impact |
| `orchestrators/plugin/install-cascade.messaging.ts` | `memberCause` | T-03-48 path redaction added outside the plan's must-haves | Info | Recorded deviation in 03-03-SUMMARY; it hardens output and is covered by the `leaks` column |

### Human Verification Required

### 1. D-PL3-15 scope of the CAS-01 rows, and a carrier for its gaps

**Test:** Decide whether the root's own ledger failure, UPD-DEP-D1 plan-step failures, and a mid-walk lookup throw may keep a single failed row.
**Expected:** Accept, and add the gaps to ROADMAP Phase 4 / Phase 11 success criteria or BACKLOG. Or ask for rows on those routes now.
**Why human:** On the root-ledger route, `install-flow.ts:1112-1126` sets no subject when `cascade.key === rootKey`, so the dependencies the cascade rolled back get no row, although CAS-01's wording covers them. CONTEXT marks the choice Uncertain. Nothing downstream carries it.

### 2. D-PL3-06: no propagation of partial availability

**Test:** Confirm the parity choice against the DEPS-STATUS-01 operator statement.
**Expected:** Keep it (Claude Code has no partial state) or ask for a propagated reason.
**Why human:** This is a product decision the operator asked about in the backlog. CONTEXT marks it Uncertain.

### 3. D-PL3-07: git-source `list` keeps `upgradable`

**Test:** Confirm the PL-5-licensed divergence.
**Expected:** Keep it, or drop it for git sources or for all sources.
**Why human:** This is an upstream divergence marked Uncertain.

### 4. D-PL3-10 and D-PL3-13: remaining upstream divergences

**Test:** Confirm that the non-directory refusals keep the 200-per-range bound, and that installed declarers outside the closure stay unnamed.
**Expected:** Accept both, or schedule alignment.
**Why human:** Under AGENTS.md, a divergence needs a recorded ID that the operator owns. The phase minted these IDs itself and marked them Uncertain.

### Gaps Summary

There are no blocking gaps. Every CAS requirement and every roadmap success criterion is delivered in source. The user-visible changes (CAS-01, 02, 05, 06, 07) each have an exact-match cucumber scenario that passes. CAS-03 and CAS-04 are decision records. CAS-04's kept behavior is pinned by the existing `fetch.feature:60`. CAS-03's no-propagation behavior has no dedicated scenario, which is acceptable because the phase changed no behavior there. The phase stops at `human_needed` for two reasons. First, the decisions that bound CAS-01, 03, 04, and 05 are marked Uncertain with no recorded operator acceptance. Second, the D-PL3-15 known gaps and review IN-04 have no carrier in a later phase's success criteria or in BACKLOG.md.

---

_Verified: 2026-10-27T07:05:00Z_
_Verifier: Claude (gsd-verifier)_
