---
phase: 06-load-time-dependency-check-and-allowed-uninstall
verified: 2026-09-19T10:45:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".planning/BACKLOG.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-01-PLAN.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-01-SUMMARY.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-02-PLAN.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-02-SUMMARY.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-03-PLAN.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-03-SUMMARY.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-04-PLAN.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-04-SUMMARY.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-REVIEW-FIX.md"
  - ".planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-REVIEW.md"
  - "docs/dependency-resolution.md"
  - "docs/output-catalog.md"
  - "docs/plugin-enablement.md"
  - "extensions/pi-claude-marketplace/domain/dependencies.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/README.md"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts"
  - "extensions/pi-claude-marketplace/persistence/state-io.ts"
  - "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "extensions/pi-claude-marketplace/shared/notify-reasons.ts"
  - "tests/architecture/catalog-uat/catalog-contract.test.ts"
  - "tests/architecture/catalog-uat/catalog-parser.test.ts"
  - "tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts"
  - "tests/architecture/catalog-uat/fixtures/reconcile-applied.ts"
  - "tests/architecture/compat-01-no-expansion.test.ts"
  - "tests/architecture/gate-targets.ts"
  - "tests/architecture/notify-closed-set-locks.test.ts"
  - "tests/architecture/notify-grammar-invariant.test.ts"
  - "tests/architecture/notify-stamp-coverage.test.ts"
  - "tests/architecture/reconcile-planner-purity.test.ts"
  - "tests/domain/dependencies.test.ts"
  - "tests/edge/handlers/plugin/uninstall.test.ts"
  - "tests/orchestrators/plugin/dependency-index.test.ts"
  - "tests/orchestrators/plugin/install-outcome.test.ts"
  - "tests/orchestrators/plugin/reinstall-record.test.ts"
  - "tests/orchestrators/plugin/uninstall.messaging.test.ts"
  - "tests/orchestrators/plugin/uninstall.test.ts"
  - "tests/orchestrators/reconcile/apply-outcomes.test.ts"
  - "tests/orchestrators/reconcile/apply.test.ts"
  - "tests/orchestrators/reconcile/dependency-verdict.test.ts"
  - "tests/orchestrators/reconcile/notify.test.ts"
  - "tests/orchestrators/reconcile/plan.test.ts"
  - "tests/orchestrators/reconcile/types.test.ts"
  - "tests/persistence/state-io.test.ts"
  - "tests/shared/notification-grammar.test.ts"
  - "tests/shared/notification-types.test.ts"
covered_digest: "v1:sha256:31a5282728222af38937d0fdebfcadbe4fe7c4c98a436c53835e03d4b050e0e3"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Decide whether WR-03 (`orchestrators/plugin/dependency-index.ts:192-195,255-271` / `orchestrators/reconcile/apply.ts:999-1026`) needs a BACKLOG.md carrier before this phase is considered fully closed."
    expected: "Either a new BACKLOG item is filed recording that one unreadable/absent declarer in a scope aborts the WHOLE scope's LOAD-01 check (fail-closed, D-05-07) and emits an `{unreadable}` error row on every reload until repaired, or the operator explicitly accepts the current behavior as final with no carrier needed."
    why_human: "This is a deliberate fail-closed design decision (re-declined twice across both review iterations on D-05-07 grounds), not a mechanical defect — the reviewer itself flagged the missing carrier as the one loose end before phase close (\"06-REVIEW-FIX.md\" follow-up #2). It requires a human policy call, not code inspection."
  - test: "Confirm the two new fallback wordings WR-12 introduced are acceptable: `the declared dependency` / `this plugin` when a remedy party's key fails the token-renderability check, and `required by N other plugins` when dependent keys on an uninstall's cause line fail the same check."
    expected: "Operator either accepts the wording as-is or requests a rewording; the mechanism (validate every interpolated key, degrade to a key-less/counted form on failure) is already correct and tested either way."
    why_human: "New user-visible output vocabulary on a catalogued surface — the fix report explicitly calls this out as \"wants an operator nod,\" a wording preference, not a correctness question."
gaps: []
deferred:
  - truth: "`/claude:plugin pending` previews `(will enable)` for a plugin the next reload would actually hold down (WR-01)."
    addressed_in: "Tracked by existing backlog item PENDING-VERDICT-01 / D-06-25 (not a later roadmap phase, but an explicit backlog carrier already filed for this exact gap)."
    evidence: ".planning/BACKLOG.md `PENDING-VERDICT-01` entry, cross-referenced from 06-REVIEW.md and 06-REVIEW-FIX.md as the tracking carrier for this declined fix."
---

# Phase 6: Load-Time Dependency Check and Allowed Uninstall Verification Report

**Phase Goal:** An installed plugin whose declared dependency is missing, disabled or out of range no longer loads as if nothing were wrong: reconcile disables it, says why, and names the remedy. With that check in place `uninstall` can stop refusing a still-needed plugin and report the consequence instead, the way upstream does.
**Verified:** 2026-09-19T06:52:07Z
**Status:** human_needed
**Re-verification:** No — initial verification (this is the first `06-VERIFICATION.md` for this phase)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | On `/reload`, an installed plugin whose declared dependency is missing, disabled, or out of range is disabled and reported with the upstream remedy shape, via new closed-set tokens on every pin surface. (LOAD-01) | ✓ VERIFIED | `dependency-verdict.ts::unsatisfiedEntries`/`propagateUnsatisfied` computes all three arms (`missing`/`disabled`/`out-of-range`); `apply-outcomes.ts::dependencyRemedy` renders the exact three upstream sentences; `notify-reasons.ts` carries the closed tokens `dependency unsatisfied` / `dependency version unsatisfied` / `dependents unsatisfied`; `REASONS.length === 58` pinned and passing (`notify-closed-set-locks.test.ts`); catalog rows byte-pinned in `docs/output-catalog.md:2723-2765` and `catalog-parser`/`catalog-contract` architecture tests pass (19/19). |
| 2 | The disable is a consequence, not a user choice: reconcile neither re-enables the dependent while unsatisfied nor oscillates, and lifts the disable once satisfied, without config edits. (LOAD-02) | ✓ VERIFIED | `plan.ts::isHeldByUnsatisfiedDependency` blocks the enable bucket for a held record; `isAlreadyDependencyDisabled` prevents re-planning the disable bucket for a record already down; the live verdict (never the persisted marker) decides the hold, which is what makes the lift possible. Named tests run and pass: `LOAD-02: lifts a marked record once the live verdict no longer names it`, `LOAD-02: plans neither bucket for a marked record whose dependency is still unsatisfied`, `LOAD-02: never lifts a disable the user asked for`, `LOAD-02: an unmarked disabled record is enabled by the ordinary path, not by the check` (4/4 pass, `tests/orchestrators/reconcile/plan.test.ts`). |
| 3 | `uninstall <plugin>` proceeds while other installed plugins still declare it; the row names the dependents, each is reported unsatisfied at the next load; the reload-path refusal is retired; `--prune` semantics unchanged. (LOAD-03) | ✓ VERIFIED | `uninstall.ts::readDeclarers` no longer throws on a non-empty dependent set (only on an unreadable declarer, D-05-07 preserved); `uninstall.messaging.ts::composeUninstalledRow`/`renderDependents` name dependents on the info-severity success row; the reconcile (orchestrated) arm deliberately omits the dependents brace (`uninstall.ts:1228-1239`) to avoid double-reporting. 9/9 named `LOAD-03:*` tests pass, including the `--prune` adjacency edge (`a declarer the same --prune run sweeps is not named as a surviving dependent`) and sorted-order case. Retired token `dependents remain` / `assertNoDependents` confirmed absent repo-wide (`grep` returned nothing). |
| 4 | PRUNE-05's refusal, its `dependents remain` row and the "documents this for `disable`; this extension applies it to `uninstall`" docs sentence are retired, with a decision record superseding D-05-14, and BACKLOG `PRUNE-GUARD-MR-01` re-triaged. | ✓ VERIFIED | Retired vocabulary confirmed absent from `extensions/`, `tests/`, `docs/`. `docs/dependency-resolution.md`'s "Removing a plugin other plugins need" and new "The load-time check" section describe the new behavior; the old contrast sentence is gone. Supersession record for D-05-14/-15/-16 exists in `06-03-SUMMARY.md` and `06-04-SUMMARY.md` (D-06-06/D-06-07), cited from `REQUIREMENTS.md`'s PRUNE-05 entry. `BACKLOG.md`'s `PRUNE-GUARD-MR-01` entry carries a "Re-triaged in Phase 6" paragraph restating the gap as a reporting question, not a guard question — a re-triage, not a false resolution. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts` | Pure, network-free three-arm satisfaction verdict + fixpoint propagation | ✓ VERIFIED | Present, substantive (309 lines, no stubs), wired into `plan.ts` via `DeclaredPluginInputs.verdict` and into `apply.ts` via `readPassForScope`; confirmed network-free by `no-orchestrator-network.test.ts` and pure by `reconcile-planner-purity.test.ts` (both passing). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | Dependents no longer refuse; unreadable-declarer refusal survives | ✓ VERIFIED | `readDeclarers` narrowed to the one surviving refusal class (D-06-06/D-05-07); `UninstallRefusedError` still thrown only on `!result.ok`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` | Dependents named on the success row via a validated remedy | ✓ VERIFIED | `composeUninstalledRow`/`renderDependents`/`isRenderablePluginKey` guard against name-forgery (WR-12 fix), tested with 7 discriminating cases in `tests/domain/dependencies.test.ts` plus 2 uninstall-specific cases. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `apply.ts::readPassForScope` | `dependency-verdict.ts::buildScopeSatisfactionVerdict` | Computed inside the existing locked-transaction closure, passed as precomputed data | ✓ WIRED | No second lock acquired; verdict flows into `planReconcile` as the 4th argument. |
| `plan.ts::planReconcile` | `apply.ts::applyDependencyDisables` | `pluginsToDependencyDisable` bucket | ✓ WIRED | `apply.ts:802` reads `pluginDiff.dependencyDisable`; `applyDependencyDisables` iterates it, calling `setPluginEnabled(..., enable:false)`. |
| `apply.ts::applyDependencyDisables` | `outcomes` array / `stampDependencyDisabled` | Row emission before the marker stamp (CR-01) | ✓ WIRED | Confirmed by source read (`outcomes.push` inside the loop, stamp call strictly after) and by the passing named regression test `CR-01: a throwing marker stamp keeps the dependency-disable row on the cascade`. |
| `uninstall.ts::readDeclarers` | `uninstall.messaging.ts::composeUninstalledRow` | `dependents` hoisted out of the locked closure | ✓ WIRED | `dependents` variable assigned inside the transaction, read afterward at the success-row composition site; `survivingDependents` filters out members swept by the same `--prune` run. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| CR-01 regression (dependency-disable row survives a throwing stamp) | `node --test --test-name-pattern="CR-01" tests/orchestrators/reconcile/apply.test.ts` | 1/1 pass | ✓ PASS |
| LOAD-02 no-oscillation / lift | `node --test --test-name-pattern="LOAD-02" tests/orchestrators/reconcile/plan.test.ts` | 4/4 pass | ✓ PASS |
| LOAD-03 allowed uninstall + prune adjacency | `node --test --test-name-pattern="LOAD-03" tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/uninstall.messaging.test.ts` | 9/9 pass | ✓ PASS |
| D-06-06 orchestrated uninstall names no dependents | `node --test --test-name-pattern="D-06-06" tests/orchestrators/plugin/uninstall.test.ts` | 1/1 pass | ✓ PASS |
| WR-12 name-injection guard | `node --test --test-name-pattern="WR-12" tests/domain/dependencies.test.ts tests/orchestrators/reconcile/apply-outcomes.test.ts tests/orchestrators/plugin/uninstall.messaging.test.ts` | 3/3 suites pass | ✓ PASS |
| Architecture gates (network-free, closed-set, purity, catalog) | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/reconcile-planner-purity.test.ts tests/architecture/notify-stamp-coverage.test.ts tests/architecture/catalog-uat/*.test.ts` | 28/28 pass | ✓ PASS |

Full-suite runs (`npm test`, `npm run test:integration`) were not re-run here; `06-REVIEW-FIX.md` records them green (6653/6653, 32/32) after the review-fix commits, and named-test spot-checks above independently confirm the load-bearing behaviors on the current tree.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LOAD-01 | 06-01, 06-02 | Load-time three-way dependency check with upstream remedy | ✓ SATISFIED | See Truth #1. |
| LOAD-02 | 06-02 | Consequence-disable does not oscillate; lifts cleanly | ✓ SATISFIED | See Truth #2. |
| LOAD-03 | 06-03 | Allowed uninstall with dependents reported | ✓ SATISFIED | See Truth #3. |
| PRUNE-05 | 06-03, 06-04 (supersedes Phase 5) | Refusal retired, superseded by LOAD-03 | ✓ SATISFIED | REQUIREMENTS.md carries the supersession note; see Truth #4. |

No orphaned requirements found: `.planning/REQUIREMENTS.md`'s LOAD block maps exactly to the three IDs claimed across the four plans' `requirements:` frontmatter fields.

### Anti-Patterns Found

None found. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of this phase's 45 `files_modified` entries across the four plans.

### Human Verification Required

Both items below were resolved by the operator on 2026-09-19; neither blocked the phase goal.

#### 1. WR-03 backlog carrier decision — RESOLVED

**Test:** Decide whether the WR-03 finding (one unreadable/absent declarer aborting the whole scope's LOAD-01 check, emitting an `{unreadable}` error row on every reload) needs a BACKLOG.md entry before this phase is considered closed.
**Resolution:** Operator chose to file a carrier. Added `STALE-DECLARER-01` to `.planning/BACKLOG.md` (commit `756baec6`), mirroring `PENDING-VERDICT-01`'s format.
**Why human:** This is a twice-reconfirmed, deliberate fail-closed design decision (D-05-07), not a mechanical gap — but the code reviewer itself flagged the missing tracking carrier as the one remaining loose end before phase close, and closing that loop required an operator judgment call, not a code change.

#### 2. WR-12 wording confirmation — RESOLVED

**Test:** Review the two new fallback sentences the WR-12 fix introduced (`the declared dependency` / `this plugin`, and `required by N other plugins`) for wording acceptability.
**Resolution:** Operator approved the wording as shipped; no change requested.
**Why human:** New user-visible catalogued vocabulary — a judgment call on phrasing, explicitly flagged by the fixer as wanting an operator's nod.

### Gaps Summary

No gaps found against the four roadmap success criteria — LOAD-01, LOAD-02, and LOAD-03 are all implemented, wired, tested with passing named regression tests (including the CR-01 blocker fix and its pinning regression test, and the WR-12 name-injection fix), and documented. The two open items (WR-01, tracked by existing backlog item `PENDING-VERDICT-01`; WR-03, needing a new carrier) are deliberate, twice-reconfirmed design deferrals surfaced by the review process itself, not mechanical defects discovered by this verification. They are routed to human verification rather than treated as blockers because closing them requires an operator policy decision (file a backlog item, or accept the current fail-closed/preview behavior as final), not further code changes.

---

_Verified: 2026-09-19T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
