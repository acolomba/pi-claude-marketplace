---
phase: 08-enablement-parity-for-dependencies
verified: 2026-09-24T17:02:30Z
status: passed
score: 13/13 must-haves verified
covered_files:
  - .planning/BACKLOG.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-01-PLAN.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-01-SUMMARY.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-02-PLAN.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-02-SUMMARY.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-03-PLAN.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-03-SUMMARY.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-CONTEXT.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-PATTERNS.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-RESEARCH.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW-FIX.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
  - .planning/phases/08-enablement-parity-for-dependencies/08-VALIDATION.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-disable.ts
  - tests/architecture/catalog-uat/fixtures/plugin-enable.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/shared/notification-types.test.ts
covered_digest: "v1:sha256:c83157810b10aa7795e7e4932a6108f63d54a45a33192ef42b6843823ebeddb3"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Enablement parity for dependencies Verification Report

**Phase Goal:** `enable` and `disable` understand dependencies the way `install` and `uninstall` now do: enabling a plugin enables what it declares, disabling a plugin that an enabled dependent still needs is refused with a plain-English instruction naming the dependents in order (D-08-01: `disable` takes one target, so no chained form exists), and a cascade turns a disabled dependency back on rather than leaving the dependent broken.

**Verified:** 2026-09-22T02:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Note on tree state vs. SUMMARYs

This phase went through 4 code-review iterations after the three plans' SUMMARYs were written (`08-REVIEW.md` iteration 4, `08-REVIEW-FIX.md`). The install cascade's re-enable mechanism was restructured between iterations 2 and 4 (commit `e9c12cd4`, "CR-08/WR-12 one walk owns the install cascade's re-enable closure"): `partitionAlreadyInstalled` no longer exists — it was replaced by `liveInstalledKeys` (strips disabled records from the closure walk's `installedKeys` so the OUTER `resolveDependencyClosure` walks through a disabled dependency transitively) and `resolveMemberConstraints`/`disabledRecordOf` (partitions the single resulting closure into `install` vs `re-enable` phase kinds). This verification checked the CURRENT tree (HEAD `c2596178`) directly rather than trusting the 08-01/08-02/08-03 SUMMARYs' descriptions of the mechanism, per the task's required-reading note. The observable behavior the SUMMARYs describe (transitive re-enable, full-closure reporting, config invisibility, rollback-to-disabled) is unchanged and independently confirmed against the current code and a live test run. One further superseded claim: the `enable-disable.messaging.ts` "not installed" cascade-member row's severity was corrected from `error` (the 08-01-PLAN's original text) to `warning` by review fix WR-04 ("carried out but short" vs. "not carried out" — the project's severity tri-state model), which is what `docs/output-catalog.md`'s `enable-cascade` state and the current test suite both show.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `enable <plugin>` enables the plugin's declared dependencies transitively, same scope, one row per member (EDEP-01) | ✓ VERIFIED | `resolveEnableCascade`/`classifyEnableCascadeMember`/`composeEnableCascadeRows` in `enable-disable.ts`/`.messaging.ts`; `enable-cascade`/depth-2/diamond tests pass live (`node --test tests/orchestrators/plugin/enable-disable.test.ts` — 138/138 incl. messaging) |
| 2 | `disable <plugin>` refused while an installed, ENABLED plugin in the scope declares it; nothing written | ✓ VERIFIED | `readEnabledDependents` (enable-disable.ts:1392) throws `EnableRefusedError("dependents remain", ...)` before `dispatchBranch`; tests assert `tx.save`/`cascadeUnstagePlugin` spies called zero times — passing live |
| 3 | Refusal names dependents and disable order as plain English, not a chained command (D-08-01) | ✓ VERIFIED | `composeDisableRefusalCause` — `` `Disable ${renderDependentKeys(dependents)} first, then ${target}.` `` (enable-disable.messaging.ts:198); no `&&`/multi-target syntax anywhere; adversarial-name test confirms no forgeable interpolation |
| 4 | A disabled installed declarer does NOT block disable (D-05-04) | ✓ VERIFIED | `readEnabledDependents` filters `enabledDeclarers` by `!isRecordedButDisabled`; test "a DISABLED declarer does not block the disable" passes |
| 5 | Only the target scope's declarers are consulted (D-05-05) | ✓ VERIFIED | `buildScopeDeclarationIndex({state, locations, exclude: key})` is scope-bound; "a declarer in the OTHER scope does not block the disable" test passes |
| 6 | Unreadable declarations fail-close with `{unreadable}` on both enable and disable (D-05-07) | ✓ VERIFIED | Both `enableCascadeLookup` and `readEnabledDependents` throw `EnableRefusedError("unreadable", ...)` on `ok:false`; both direction's tests pass with no absolute path leaked |
| 7 | Installing/enabling a plugin whose already-installed dependency is DISABLED re-materializes it through its own record, reports `{already installed, dependency enabled}` / `{dependency enabled}`, config never gains a key (D-04-02, EDEP-03) | ✓ VERIFIED | `buildEnableCascadeMemberPhase` / `buildReEnableMemberPhase` both call `seam.runInstallLedger(..., pinVersionOverride, allowExistingRecord: true)`; `writeEnabledFlagBack`/config-write seams asserted zero-called for cascade members in both suites |
| 8 | Re-materialized member keeps `provenance: "dependency"`; only by-name install promotes (A2) | ✓ VERIFIED | `runInstallLedger` keeps an existing record's own `provenance` (only `promoteDependencyRecord`'s by-name guard flips it); "a re-enabled dependency keeps its provenance at dependency" test passes |
| 9 | Cascade failure unwinds and puts the member BACK to disabled (never deletes) (D-03-07/NFR-3) | ✓ VERIFIED | `buildReEnableMemberPhase.undo` / `buildEnableCascadeMemberPhase.undo` call `cascadeUnstagePlugin` + `toDisabledRecord`, rethrowing an unfinished unstage after folding; multiple fault-injection tests (CR-03, CR-05, EDEP-03 fault cases) pass live |
| 10 | `{already installed, dependency disabled}` retired; `REASONS` holds 60 members (ROADMAP SC3) | ✓ VERIFIED | `grep` over `notification-types.ts` shows no `"dependency disabled"`; `notify-closed-set-locks.test.ts` asserts "the closed 60-entry reason set" — passes |
| 11 | `docs/plugin-enablement.md`'s divergence subsection rewritten, not appended (ROADMAP SC3) | ✓ VERIFIED | Heading "A plugin required by another active plugin is not enabled on its behalf" absent; replaced by top-level "## A dependency's own enablement"; "Divergences" list no longer carries this subsection |
| 12 | BACKLOG `ENBL-DEP-01` closed with the plans that closed it; `DEPS-STATUS-01` explicitly stays open (ROADMAP SC4) | ✓ VERIFIED | `.planning/BACKLOG.md:3097` — struck-through heading `-- CLOSED`, closure walks the "Scope when picked up" list item by item, and states "`DEPS-STATUS-01` stays open. It is a different report... Nothing in this closure pulls it in." |
| 13 | Installing/enabling a plugin with no dependencies (or all-enabled dependencies) is byte-identical to today (empty edge) | ✓ VERIFIED | `enable-fresh` catalog state pinned unchanged; "a plugin that declares nothing composes the single-row block" / RESV-05 left-alone tests pass byte-for-byte |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | Enable cascade + disable guard | ✓ VERIFIED | `resolveEnableCascade`, `runEnableCascadeMembers`, `buildEnableCascadeMemberPhase`, `readEnabledDependents`, `EnableRefusedError` all present and wired into `setPluginEnabledWithTransaction` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` | Row composers | ✓ VERIFIED | `composeEnableCascadeRows`, `composeDisableRefusalCause`, `renderDependentKeys` present, exported, used by `.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | Install-side re-enable arm | ✓ VERIFIED | `liveInstalledKeys`, `disabledRecordOf`, `resolveMemberConstraints`, `buildReEnableMemberPhase` present and wired into `runInstallCascade`; `reEnabledFromRecord` required field on `CascadeMemberOutcome` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` | Two-token installed row | ✓ VERIFIED | `CascadeInstalledRow.reEnabledFromRecord` present; `composeCascadeMemberRows` two-loop split confirmed by passing messaging tests |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` | 60-member closed reason set | ✓ VERIFIED | `dependency enabled` and `dependents remain` present; `dependency disabled` absent; 60 `|` members counted directly |
| `docs/output-catalog.md` | `enable-cascade`, `disable-refused-dependents`, `install-cascade-dependency-enabled` states | ✓ VERIFIED | All three anchors present (1 each); old `dependency-cascade-disabled-skip`/`install-cascade-skip-disabled` absent; 220 states confirmed by `catalog-contract.test.ts` |
| `tests/architecture/catalog-uat/fixtures/plugin-{enable,disable,install}.ts` | Independent fixtures | ✓ VERIFIED | All three new fixture entries present, matched byte-for-byte by `catalog-contract.test.ts`/`catalog-parser.test.ts` (220/220 tuples) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `enable-disable.ts::resolveEnableCascade` | `domain/dependency-closure.ts::resolveDependencyClosure` | post-order walk, `installedKeys: new Set()` | ✓ WIRED | `grep -n 'installedKeys' enable-disable.ts` shows the empty-set call with the truncation-avoidance comment (line 682-686) |
| `enable-disable.ts` | `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationDetail` / `buildScopeDeclarationIndex` | offline declaration reads | ✓ WIRED | Both the enable cascade (`enableCascadeLookup`) and the disable guard (`readEnabledDependents`) call into `dependency-index.ts` |
| `enable-disable.ts` / `install-cascade.ts` | `transaction.runInstallLedger(..., pinVersionOverride, allowExistingRecord: true)` | per-member re-materialization | ✓ WIRED | `buildEnableCascadeMemberPhase` and `buildReEnableMemberPhase` both call it; `install-cascade.ts` never calls `installPlugin` (would self-deadlock the per-scope lock) |
| `enable-disable.messaging.ts::composeDisableRefusalCause` | `domain/dependencies.ts::isRenderablePluginKey` | untrusted-name defense (T-08-06) | ✓ WIRED | `renderDependentKeys` gates on `dependents.every(isRenderablePluginKey)` before joining; adversarial-name test passes |
| `tests/architecture/dependency-doc-agreement.test.ts` | `docs/dependency-resolution.md`'s already-installed section | reason-name agreement gate | ✓ WIRED | 7/7 tests pass, including both the re-enabled-member and left-alone-member cases driving the real composer |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (no dynamic frontend). The data flow this phase adds is: closure walk (`resolveDependencyClosure`) → live-state classification (`state.marketplaces[...].plugins[...]` exact-key lookup) → `runInstallLedger` materialization write → row composition from the SAME `run.members`/`materialized` list every phase populates. No static/hardcoded fallback found; every row traced to a real state read or ledger result.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Enable/disable cascade unit + messaging suite | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/enable-disable.messaging.test.ts` | 138/138 pass | ✓ PASS |
| Install cascade unit + messaging + install-flow suite | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-cascade.messaging.test.ts tests/orchestrators/plugin/install-flow.test.ts` | 271/271 pass | ✓ PASS |
| Edge handler multi-row survival | `node --test tests/edge/handlers/plugin/enable-disable.test.ts` | 19/19 pass | ✓ PASS |
| Closed-set / catalog / doc-agreement gates | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/dependency-doc-agreement.test.ts tests/shared/notification-types.test.ts` | 94/94 pass (60-entry reason set, 220-state catalog, doc-agreement 7/7) | ✓ PASS |
| Network-free / unused-type-member gates | `node --test tests/architecture/no-orchestrator-network.test.ts tests/architecture/unused-type-member-gate.test.ts` | 16/16 pass | ✓ PASS |
| Whole-tree typecheck | `npm run typecheck` | exit 0, no output | ✓ PASS |

### Probe Execution

SKIPPED — no probe scripts declared or discovered for this phase (`find scripts -path '*/tests/probe-*.sh'` empty; no probe references in PLAN/SUMMARY files).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| EDEP-01 | 08-01 | `enable <plugin>` also enables declared dependencies transitively, same scope, lists each | ✓ SATISFIED | `resolveEnableCascade` + full-closure reporting; live test run passes |
| EDEP-02 | 08-02 | `disable <plugin>` refused while an enabled installed plugin declares it, plain-English refusal | ✓ SATISFIED | `readEnabledDependents` + `composeDisableRefusalCause`; live test run passes |
| EDEP-03 | 08-01 (enable arm), 08-03 (install arm) | Install/enable turns on an already-installed disabled dependency through its record, config invisible, old skip retired | ✓ SATISFIED | `buildEnableCascadeMemberPhase` / `buildReEnableMemberPhase`; `dependency disabled` retired, `REASONS` at 60; live test run passes |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s EDEP-01/02/03 map exactly to the three plans' declared `requirements:` frontmatter fields, with no additional Phase-8-mapped IDs left unclaimed.

### Anti-Patterns Found

None. Grepped every file this phase touched (`enable-disable.ts`, `enable-disable.messaging.ts`, `install-cascade.ts`, `install-cascade.messaging.ts`, all six touched test files, `notification-types.ts`, `notify-reasons.ts`, `BACKLOG.md`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and placeholder-language patterns — zero hits. The code review process (4 iterations, `08-REVIEW.md`) independently found and the fix report (`08-REVIEW-FIX.md`) closed 0 Critical / 1 Warning (WR-16, a stale comment naming a deleted symbol, fixed in `a175df17`); the 10 remaining Info findings (IN-01..IN-10) are explicitly out of scope by the orchestrator's own fix-scope ruling (style/naming cleanups, no behavioral defect) and are recorded here for the record, not as gaps:

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `enable-disable.ts:485,936,987` | `EnableCascadeMember.record` optional where disposition already decides it | Info (out of scope) | Style only — no incorrect behavior |
| `enable-disable.ts:451,1392` | `EnableRefusedError`/`readEnabledDependents` names understate scope (carries disable refusals too; throws rather than "reads") | Info (out of scope) | Naming clarity only |
| `enable-disable.ts:743` | `unstageBackToDisabled` defends an arm a sibling branch narrows away | Info (out of scope) | Dead-branch style note |
| `enable-disable.ts:503` | `isDeclarerAbsentFromManifest` discriminates on an error-message suffix | Info (out of scope) | Brittleness note, not a failure |
| `enable-disable.ts:1632` vs `install-flow.ts:357` | `hydrateReEnabledMemberHooks`/`hydrateInstalledHooks` duplicate except log prefix | Info (out of scope) | DRY note only |
| `install-flow.ts:867-901,1005-1029,1391-1415` | D-04-07 promotion re-materializes a disabled dependency-provenance root without running the new cascade | Info (out of scope) | Predates this phase; no user-visible harm proven in the review |

## Human Verification Required

None. The phase's automated coverage is extensive and directly executed during this verification (not merely read from SUMMARYs): 138 enable/disable cases, 271 install-cascade cases, 19 edge-handler cases, 94 architecture/catalog/doc-agreement cases, 16 network-free/type-member gate cases, all passing live; typecheck clean; a 4-iteration code review converged to 0 Critical findings. Every truth in this phase is either a structural/wiring fact (grep-verifiable) or a state-transition/rollback fact directly exercised by a passing fault-injection test (e.g., "a member ledger failure unwinds every member this command already turned on", "a re-materialization fault unwinds the whole cascade and leaves the record disabled") — none required inference from symbol presence alone.

## Gaps Summary

None. All 13 observable truths derived from ROADMAP Phase 8's four success criteria plus the three plans' `must_haves.truths` are verified against the current tree, with the install cascade's re-enable mechanism verified in its POST-review-fix form (the `liveInstalledKeys`/`resolveMemberConstraints` restructure), not the pre-fix form the 08-03-SUMMARY originally described.

---

_Verified: 2026-09-22T02:30:00Z_
_Verifier: Claude (gsd-verifier)_

## Current-tree re-verification (2026-09-24)

The enable/disable and install cascade tests still pass, including rollback and config isolation. The retired `dependency disabled` token remains absent. Later phases expanded the closed reason set from the historical 60 members to 62; the current closed-set tests pass.

The current milestone run passed 7,760 unit tests and all 15 integration files. `npm run typecheck`, `npm run lint:type-members`, and the network, notification, and planner architecture tests also passed. The historical truth table and line numbers above record the original verification run. The full `npm run check` still stops on formatting in the operator-owned `.planning/config.json`. No implementation change was needed for this re-verification.
