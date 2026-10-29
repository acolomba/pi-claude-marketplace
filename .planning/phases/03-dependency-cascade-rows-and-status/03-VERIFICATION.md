---
phase: 03-dependency-cascade-rows-and-status
verified: 2026-10-29T12:48:40Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - ".planning/BACKLOG.md"
  - ".planning/PROJECT.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
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
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-CONTEXT.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-PATTERNS.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-RESEARCH.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-REVIEW-FIX.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-REVIEW.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-SECURITY.md"
  - ".planning/phases/03-dependency-cascade-rows-and-status/03-VALIDATION.md"
  - ".planning/phases/10-lifecycle-test-and-harness-gaps/10-03-PLAN.md"
  - "AGENTS.md"
  - "docs/dependency-resolution.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/domain/dependency-closure.ts"
  - "extensions/pi-claude-marketplace/domain/dependency-range.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
  - "extensions/pi-claude-marketplace/shared/notification-mcp.ts"
  - "features/plugin/fetch.feature"
  - "features/plugin/install-dependencies.feature"
  - "features/plugin/install.feature"
  - "features/plugin/list.feature"
  - "features/plugin/staging-warnings.feature"
  - "features/plugin/update-dependencies.feature"
  - "features/plugin/update.feature"
  - "features/step_definitions/command.steps.ts"
  - "features/step_definitions/plugin/publishing.steps.ts"
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
  - "test/orchestrators/plugin/dependency-settle.test.ts"
  - "test/orchestrators/plugin/install-cascade.messaging.test.ts"
  - "test/orchestrators/plugin/install-cascade.test.ts"
  - "test/orchestrators/plugin/install-flow-cascade-context.test.ts"
  - "test/orchestrators/plugin/install-flow-fixture.ts"
  - "test/orchestrators/plugin/install-flow-ledger.test.ts"
  - "test/orchestrators/plugin/install-flow-planning.test.ts"
  - "test/orchestrators/plugin/install-flow-results.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/install-outcome.test.ts"
  - "test/orchestrators/plugin/materialize-latest.test.ts"
  - "test/orchestrators/plugin/plugin-state-classifier.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/reconcile/apply-outcomes.test.ts"
  - "test/orchestrators/reconcile/apply.test.ts"
  - "test/orchestrators/reconcile/notify.test.ts"
covered_digest: "v4:sha256:08d3b1c7eee86ea6babc831ace26a539743fdbecf967fab38b2a074583274a7e"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 8/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 3: Dependency Cascade Rows and Status Verification Report

**Phase Goal:** Cascade rows and refusals name every member and declarer the way Claude Code does, and a plugin degraded by its dependency says so.
**Verified:** 2026-10-29T12:48:40Z
**Status:** passed
**Re-verification:** Yes — final integrated-tree refresh at `af6c4f95`.

## Goal Achievement

The five roadmap success criteria and CAS-01..07 reduce to eight distinct observable truths. The verdict below comes from current source, wiring, and executable behavior, not SUMMARY claims.

The final Phase 10 diagnostic carrier remains compatible with these truths. `update-flow.ts` renders `dependencyStagingDiagnostics` through the cascade/both-halves renderer before root discovery-only and MCP diagnostics on both the normal and abort paths. The D-PL10-12 owner tests passed, so later diagnostic transport does not merge, suppress, or reassign Phase 3 cascade rows.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Failed closures name every resolved member that did not install, including walk, constraint, root-ledger, plan-step, mid-walk, rollback, and never-reached routes (SC1, CAS-01). | ✓ VERIFIED | `install-cascade.ts` records unmaterialized keys; `install-flow-cascade-context.ts`, `install-flow-planning.ts`, and `install-flow-dependency-ledger.ts` preserve them; `composeUnmaterializedRows` deduplicates subject/root/moved keys and emits one cause-less error row. The named CAS-01 owner test passed; the final 15-scenario CAS gate covers all routes. |
| 2 | Installing a listed invalid root ID states the invalid-ID cause; an unlisted invalid root states not in manifest (SC2, CAS-02). | ✓ VERIFIED | `resolveDependencyClosure` looks up an unsplittable root under install policy before refusal. `closureFailureFacts` gives `invalid-root-id` its own printable-escaped cause. The exact acceptance scenario passed on this merged tree; the reserved-record-key integration case is in the full gate. |
| 3 | A partial dependency gets its own partial row and does not demote its requester on install, list, or info (SC3, CAS-03, D-PL3-06). | ✓ VERIFIED | `recordMaterializedMember` derives `unsupported` from that member's ledger summary; `composeCascadeMemberRow` changes only that row to `partially-installed`; list/info read persisted compatibility independently. The named owner test and the 13-step install/list/info scenario both passed. |
| 4 | A degraded dependency warns for malformed skill or command frontmatter while its requester remains installed. | ✓ VERIFIED | `ledgerDegradationSignals` projects distinct malformed kinds from the member summary; `malformedReasonsForKinds` and `composeCascadeMemberRow` add member-owned warning reasons. The final Nyquist gate includes the malformed-frontmatter acceptance scenario and real-ledger assertions. |
| 5 | Git-source list rows retain upgrade state under recorded divergence D-PL3-07 (SC4, CAS-04). | ✓ VERIFIED | `composeInstalledListRow` calls `resolveListCandidate` and then `classifyInstalledRecord`; the candidate decides `upgradable`/`partially-upgradable`. The exact git-fetch/list acceptance scenario passed. `PROJECT.md`, `BACKLOG.md`, `list-flow.ts`, and user docs record the divergence. |
| 6 | A non-root directory-pin refusal names every in-closure range declarer and bounds each field (SC4, CAS-05). | ✓ VERIFIED | `rangeRequirers` selects range-bearing requesters and orders them by reversed closure post-order. `resolveOneMember` carries the bounded joined ranges; `assertDirectoryPinSatisfied` bounds plugin, version, and each stripped requester name. The named declarer owner test passed; exact 120-character and two-declarer scenarios passed in the final gate. |
| 7 | A refused offline git dependency move names the update command when the requested root declared that dependency (SC5, CAS-06). | ✓ VERIFIED | `dependency-plan.ts` carries `declaredBy`; `installedUnsatisfiedCause` adds the fixed update hint only when the root is included and update is not blocked. The named owner test and the exact offline acceptance scenario passed. |
| 8 | Hold and related refusal causes bound catalog versions to 64 UTF-16 units, preserve surrogate pairs, and bound aggregate range rendering (SC5, CAS-07). | ✓ VERIFIED | `constraint-fold.ts`, `dependency-move.ts`, and `install-cascade.messaging.ts` use `truncateForRefusal`; its named high-surrogate test passed. `renderDeclaredRanges` preserves the 200-character aggregate bound under the superseding D-PL3-10 decision. Long-version acceptance scenarios are included in the final gate. |

**Score:** 8/8 truths verified (0 present but behavior-unverified).

### Advisory (New Scope, Unevidenced)

None. No new-scope concern without deterministic evidence was found.

### Required Artifacts

| Artifact group | Expected | Status | Details |
| --- | --- | --- | --- |
| Closure and cascade owners | Complete-member resolution, materialization facts, and failure projection | ✓ VERIFIED | Current source is substantive and wired through the install flow. The plan checker reports one stale literal in 03-03 (`install-flow.ts`), but the field now travels through `install-flow-cascade-context.ts:753`, `install-flow-results.ts:745`, `install-flow-planning.ts:273`, and `install-flow-dependency-ledger.ts:715`; this is a modularization, not a missing artifact. |
| Refusal rendering | Invalid IDs, bounded versions/ranges, directory-pin declarers, and move hint | ✓ VERIFIED | `dependency-range.ts`, `constraint-fold.ts`, `dependency-move.ts`, `install-cascade.ts`, `install-outcome.ts`, and messaging contain the live implementations and pass owner/acceptance tests. |
| Status rendering | Member-owned partial/degraded state and git list upgrade state | ✓ VERIFIED | Ledger summary facts reach cascade rows; persisted compatibility reaches list/info; candidate resolution reaches list classification. |
| Behavioral and catalog evidence | User-visible scenarios and catalog contract | ✓ VERIFIED | Five feature files, catalog UAT, owner tests, integration tests, and docs are covered by the broad v4 fingerprint and exact full gate. |

The mechanical artifact query passed 22/23 declared artifacts. Its single miss is the superseded `install-flow.ts` literal described above; current source and executable evidence verify the relocated path. Symbol-decorated key-link entries in older plan YAML are not valid path inputs to the mechanical link checker, so their wiring was traced directly below.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Closure/plan/ledger failures | Complete failed rows | `unmaterialized` and `composeUnmaterializedRows` | ✓ WIRED | Current flow modules preserve and exclude the correct keys; named CAS-01 test passed. |
| Member ledger summary | Dependency status/warning row | `recordMaterializedMember` → `composeCascadeMemberRow` | ✓ WIRED | Compatibility and degradation belong to the member, not requester; owner and acceptance tests passed. |
| Directory range declarations | Pin refusal | `rangeRequirers` → `DirectoryPinRange` → `assertDirectoryPinSatisfied` | ✓ WIRED | Declarers and bounded fields reach the thrown refusal; named owner test passed. |
| Move planning | Version-in-range hint | `declaredBy` → `installedUnsatisfiedCause` | ✓ WIRED | Root declaration and update-block condition gate the hint; owner and acceptance tests passed. |
| Candidate lookup | Git list row | `resolveListCandidate` → `classifyInstalledRecord` | ✓ WIRED | Exact fetch/list scenario passed. |
| Dependency diagnostics | Update warning transport | `dependencyStagingDiagnostics` → cascade/both-halves renderer | ✓ WIRED | D-PL10-12 update and materialization owner checks passed; diagnostics remain separate from cascade rows and causes. |

### Data-Flow Trace (Level 4)

| Artifact | Dynamic value | Real source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| `install-cascade.messaging.ts` | Failed member names, partial/degraded reasons, refusal causes | Closure walk, plan results, and install-ledger summaries | Yes | ✓ FLOWING |
| `install-outcome.ts` | Manifest version and pin-refusal declarers | Contained plugin manifest and cascade declaration map | Yes | ✓ FLOWING |
| `list-installed-row.ts` | Recorded status and available candidate | Persisted install record plus marketplace candidate resolution | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| CAS-01..07 owner behaviors | Focused `node --test --test-name-pattern` across nine owner modules | 9 files passed; 0 failed | ✓ PASS |
| Public cascade/refusal/list behaviors | Exact focused Cucumber expression | 8 scenarios, 99 steps, 2 hooks passed | ✓ PASS |
| D-PL10-12 carrier compatibility | Named update-flow and materialize-latest owner tests | 2 invocations passed; 0 failed | ✓ PASS |
| Final integrated gate | Exact reusable `npm run check` result on unchanged build inputs | 1,145 scenarios, 11,777 steps, 309 direct-coverage records; exit 0 | ✓ PASS, reused |

The first local Cucumber attempt was sandbox-denied at the loopback listener (`EPERM`, zero scenarios). The identical scenario was rerun with local-listener permission and passed; this was an environment restriction, not a product failure.

### Probe Execution

No Phase 3 plan or success criterion declares a standalone probe. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| CAS-01 | 03-03 | ✓ SATISFIED | Truth 1; later CAS-08 routes are included in the current flow and final gate. |
| CAS-02 | 03-02 | ✓ SATISFIED | Truth 2. |
| CAS-03 | 03-06 | ✓ SATISFIED | Truths 3 and 4; D-PL3-06 recorded and tested. |
| CAS-04 | 03-06 | ✓ SATISFIED | Truth 5; D-PL3-07 recorded and tested. |
| CAS-05 | 03-04 | ✓ SATISFIED | Truth 6; D-PL3-13 scope and superseding D-PL3-10 rendering are recorded. |
| CAS-06 | 03-05 | ✓ SATISFIED | Truth 7. |
| CAS-07 | 03-01 | ✓ SATISFIED | Truth 8. |

REQUIREMENTS.md maps exactly CAS-01..07 to Phase 3, every ID is claimed by a plan, and all are marked Complete. No orphaned Phase 3 requirement exists. Decision coverage reports 17/17 trackable CONTEXT decisions honored.

### Gate Evidence

| Gate | Final merged-tree result |
| --- | --- |
| Nyquist | COMPLIANT at `98c25440`; CAS-01..07 all mapped with direct behavioral evidence. |
| Security | SECURED at `af6c4f95`: 15/15 threats disposed and `threats_open: 0`. |
| Code review | CLEAN at `068006e5` across the complete 48-file integrated scope: 0 Critical, 0 Warning, 0 Info. |
| Full project | Exact reusable `npm run check` on unchanged build inputs from `be0de0c3`: 1,145 scenarios, 11,777 steps, 309 LCOV records. `git diff --quiet be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` returned 0. |

### Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` marker exists in the 48-file integrated review scope. No committed `.only`, unconditional skip/todo, placeholder implementation, circular expected-value generation, or weak-only Phase 3 oracle was found.

### Human Verification Required

None. Every runtime, state-transition, ordering, and formatting truth has deterministic owner or acceptance coverage. No plan contains a deferred `<human-check>` or unresolved prohibition.

### Gaps Summary

No gap remains. Phase 3 achieves its goal on the final integrated tree: cascade failures account for every member, directory-pin refusals account for every in-scope declarer, member degradation remains member-owned, and all bounded refusal/list behaviors match the current recorded decisions. D-PL3-06 and D-PL3-07 are formal parity divergences; D-PL3-10 records the later user reversal to Claude-compatible refusal rendering. The Phase 10 D-PL10-12 diagnostic carrier preserves those decisions without changing row ownership.

---

_Verified: 2026-10-29T12:48:40Z_
_Verifier: gsd-verifier_
