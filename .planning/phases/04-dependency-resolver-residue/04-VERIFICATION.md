---
phase: 04-dependency-resolver-residue
verified: 2026-10-28T17:56:28Z
status: passed
score: 4/4 roadmap success criteria verified
covered_files:
  - ".planning/phases/04-dependency-resolver-residue/04-01-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-01-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-02-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-02-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-03-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-03-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-04-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-04-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-05-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-05-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-06-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-06-SUMMARY.md"
  - "extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/target-check.ts"
  - "extensions/pi-claude-marketplace/domain/release-tag.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "features/plugin/install-dependencies.feature"
  - "features/plugin/update-dependencies.feature"
  - "features/step_definitions/plugin/installation.steps.ts"
  - "test/bridges/agents/target-check.test.ts"
  - "test/domain/release-tag.test.ts"
  - "test/orchestrators/plugin/dependency-plan.test.ts"
  - "test/orchestrators/plugin/dependency-tag-probe.test.ts"
  - "test/orchestrators/plugin/install-cascade.test.ts"
  - "test/orchestrators/plugin/install-flow-cascade-context.test.ts"
  - "test/orchestrators/plugin/install-flow-ledger.test.ts"
  - "test/orchestrators/plugin/install-flow-planning.test.ts"
  - "test/orchestrators/plugin/install-outcome.test.ts"
  - "test/orchestrators/plugin/update-swap.test.ts"
covered_digest: "v4:sha256:40b6d9d9de026b32166afbdbb4952c71bf89287d43916271c637a222025d842f"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions: []
decision_coverage:
  honored: 7
  total: 7
  not_honored: []
---

# Phase 4: Dependency Resolver Residue Verification Report

**Phase Goal:** The dependency resolver installs the commit it previewed, refuses before any move lands, and its completeness and `apply` behavior are decided against Claude Code.
**Verified:** 2026-10-28
**Status:** passed
**Re-verification:** Yes -- stale fingerprint refresh after later integration, install-flow splitting, and a completed review/fix loop.

The starting hypothesis was that later integration preserved the files but broke one of the handoffs. The current source and tests falsify that hypothesis. The Phase 11 split moved two Plan 04 artifact patterns out of `install-flow.ts`, so the old path-based artifact probe reports them missing there. Their current owners are substantive and wired: `install-flow-dependency-ledger.ts`, `install-flow-cascade-context.ts`, `install-flow-ledger.ts`, and `install-flow-planning.ts` carry the same contracts through the public install flow.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                              | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A fresh unpinned git dependency resolves once and installs the commit the plan previewed (RSV-01). | VERIFIED | `previewInstall` returns `preflight.resolvedSha`; `previewFresh` maps it by member key; `schedule` attaches `previewedCommit` to materialize/final members and `rootCommit` to the install root. `memberLedgerPin` maps that value to `sourcePin` without inventing `resolvedVersion`; `buildInstallLedgerOptions` maps it to `sourcePinOverride`. The focused planning test passed and asserted one mirror resolve, the expected pin, recorded SHA, and final versions. The public scenario asserts exactly one `info/refs` plus one `git-upload-pack` request. |
| 2   | RSV-02 and RSV-03 have recorded decisions, and the code and tests match them.                      | VERIFIED | D-PL4-02 remains in `dependency-plan.ts` and `install-flow-ledger.ts`: every fresh member is previewed before `schedule`, including a move-only dependency under `deferMoveDependencies`. D-PL4-03 remains the explicit first-involved-pick/permanent-rule-out search. Focused tests passed for the deferred preview refusal and the deliberately incomplete four-walk search.                                                                                                                                                                                   |
| 3   | An update whose agent target is occupied refuses before any earlier move lands (RSV-04).           | VERIFIED | `judgeDependencyMove` calls `assertUpdateNamesFree` before returning a candidate. `previewInstall` applies the same target rule to fresh members. Preview and staging now both call `assertAgentNamesUnclaimed` against foreign index rows before target-file checks or writes, including a missing target. The focused parity test passed. Install/update Cucumber regressions assert unchanged versions/config/record bytes, retained index rows, no target files, and unchanged staged skill bytes after a second dependency refuses.                         |
| 4   | The `no-matching-tag` range and `rollbackPartials` declaration are settled (RSV-05).               | VERIFIED | `SelectedReleaseTag` and `DependencyTagProbeResult` use the range-free `{ kind: "no-matching-tag" }` arm. `toMemberConstraintOutcome` derives the failure range from the member's declared range. `InstallMissingDependencyOutcome` declares `rollbackPartials` in the split dependency-ledger owner, and the catch projects the captured partials. Focused no-match and REC-06 tests passed with complete value assertions.                                                                                                                                     |

**Score:** 4/4 truths verified (0 present but behavior-unverified).

### Decision Conformance

| Decision | Status   | Evidence                                                                                                                                             |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-PL4-01 | VERIFIED | Preview SHA flows by member key through `previewedCommit`/`rootCommit`, both ledger builders, and `sourcePinOverride`; focused pinning tests passed. |
| D-PL4-02 | VERIFIED | The plan previews move-only fresh dependencies before scheduling even when the caller defers their installation; the refusal test passed.            |
| D-PL4-03 | VERIFIED | The source documents and implements permanent first-pick rule-outs; the untried-pair test asserts the exact walks and verdict order.                 |
| D-PL4-04 | VERIFIED | PI-6 and agent-target/foreign-index checks run in the write-free judge/preview paths; the update swap remains names-only for forced reinstall.       |
| D-PL4-05 | VERIFIED | Probe no-match arms carry no range; the cascade uses the independently declared range.                                                               |
| D-PL4-06 | VERIFIED | The failed missing-dependency outcome declares and propagates rollback partials.                                                                     |
| D-PL4-07 | VERIFIED | `unmovable` applies `redactAbsolutePaths`; the focused test asserts basename-only output.                                                            |

### Required Artifacts

| Artifact                                                          | Expected                                                                     | Status           | Details                                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bridges/agents/{target-check,index-mutation,stage}.ts`           | One preview/stage ownership rule and write-free occupied-target check        | VERIFIED         | Present, substantive, and shared through `assertAgentNamesUnclaimed`; both callers use the same foreign partition and typed error.                                             |
| `dependency-plan.ts`                                              | Greedy decision, preview pin map, early refusal, redaction                   | VERIFIED         | Present and wired from install/update planning; four focused decision tests passed.                                                                                            |
| `release-tag.ts`, `dependency-tag-probe.ts`, `install-cascade.ts` | Range-free no-match result and declared-range failure                        | VERIFIED         | Types and decoder agree; focused probe/cascade tests passed.                                                                                                                   |
| `install-flow-*.ts` split owners                                  | Ledger pin, deferred apply contract, root commit, rollback partial type/flow | VERIFIED (moved) | Phase 11 moved the old `install-flow.ts` members into dedicated modules. Current call paths are present and exercised; the old literal artifact patterns are stale, not stubs. |
| `install-outcome.ts`, `install-clone-probe.ts`                    | Preview SHA and pinned materialization path                                  | VERIFIED         | Preview returns the resolved SHA; ledger pin becomes source SHA; clone probe takes the pinned arm.                                                                             |
| Phase 4 unit and Cucumber tests                                   | Behavior-level proof of network count, ordering, preservation, and failures  | VERIFIED         | Active tests use whole-value/state assertions; no linked test is skipped, todo, or only.                                                                                       |

### Key Link Verification

| From                         | To                    | Via                                                                                | Status | Details                                                                         |
| ---------------------------- | --------------------- | ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `previewInstall`             | `planDependencyGraph` | `prepareInstallDependencyPlan.preview` and `previewInstallDependencyPlanRoot`      | WIRED  | Fresh members and the root return the preflight SHA into the plan.              |
| `planDependencyGraph`        | install ledger        | `previewedCommit`/`rootCommit` -> `memberLedgerPin` -> `buildInstallLedgerOptions` | WIRED  | Both cascade and final-closure builders use the same helper.                    |
| ledger pin                   | clone cache           | `sourcePinOverride` -> pinned `probeInstallClone` path                             | WIRED  | Focused tests count one resolve and assert the installed pin/SHA.               |
| move judge / install preview | agents bridge         | `assertUpdateNamesFree` / `assertAgentTargetsFree`                                 | WIRED  | Refusal occurs during planning, before plan execution.                          |
| preview agent check          | staging agent check   | shared `assertAgentNamesUnclaimed`                                                 | WIRED  | Missing-file foreign claim produces the same typed refusal in both paths.       |
| tag probe                    | constraint failure    | `toMemberConstraintOutcome(member, declared, probed)`                              | WIRED  | No-match answer carries no range; the declared range becomes the failure range. |
| missing-dependency ledger    | user-visible failure  | `capture.rollbackPartials` -> `handleCaughtInstallFailure` -> failed outcome       | WIRED  | REC-06 focused test asserts phase, message, cause, and absent install record.   |

### Data-Flow Trace (Level 4)

No UI component renders dynamic data in this phase. The operational data flows are covered by the key links above and terminate in real state, filesystem, git-request, and failure-outcome assertions rather than static return values or mocks used as expected-value generators.

### Behavioral Spot-Checks

| Behavior                                                                         | Command                                                                                                                        | Result                                                | Status |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------ |
| Foreign missing-file claim refuses identically in preview/staging with no writes | `node --test --test-name-pattern 'refuses a foreign index claim with no target file' test/bridges/agents/target-check.test.ts` | 1/1 passed                                            | PASS   |
| Preview pin, deferred refusal, greedy limit, and path redaction                  | named Phase 4 cases in `test/orchestrators/plugin/dependency-plan.test.ts`                                                     | 4/4 passed                                            | PASS   |
| Fresh git dependency installs previewed commit with one resolve                  | named D-PL4-01 case in `test/orchestrators/plugin/install-flow-planning.test.ts`                                               | 1/1 passed                                            | PASS   |
| Failed undo reaches missing-dependency outcome                                   | named REC-06 case in `test/orchestrators/plugin/install-flow-ledger.test.ts`                                                   | 1/1 passed                                            | PASS   |
| Probe returns a range-free no-match and cascade uses declared range              | named cases in dependency-tag-probe and install-cascade tests                                                                  | 2/2 passed                                            | PASS   |
| Combined tree                                                                    | `npm run check` at build-input commit `c9dbf878` (planning-only commits followed)                                              | exit 0; 1126 scenarios, 11509 steps, 309 LCOV records | PASS   |

The combined-tree evidence is reusable: `git diff c9dbf878 -- . ':(exclude,glob).planning/**/*.md'` is empty and there are no untracked build inputs. Node was `v26.12.1`.

### Probe Execution

N/A -- no Phase 4 plan declares a standalone probe script. The named unit and public Cucumber tests are the executable behavior evidence.

### Requirements Coverage

| Requirement | Source Plans               | Status    | Evidence                                                           |
| ----------- | -------------------------- | --------- | ------------------------------------------------------------------ |
| RSV-01      | 04-04, 04-05, 04-06        | SATISFIED | Truth 1; one-resolve unit and public git-request assertions.       |
| RSV-02      | 04-03, 04-05               | SATISFIED | D-PL4-02 code/docs and focused deferred-preview refusal.           |
| RSV-03      | 04-03                      | SATISFIED | D-PL4-03 code/docs and exact incomplete-search trace.              |
| RSV-04      | 04-01, 04-03, 04-05, 04-06 | SATISFIED | Truth 3; bridge parity plus install/update preservation scenarios. |
| RSV-05      | 04-02                      | SATISFIED | Truth 4; range-free types/decoder and rollback propagation.        |

No orphaned requirement exists: REQUIREMENTS.md maps exactly RSV-01 through RSV-05 to Phase 4, and every ID is claimed by at least one plan.

### Test Quality Audit

| Test group                            | Linked requirements    | Active evidence                                                                          | Skipped | Circular | Strongest assertion                | Verdict |
| ------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- | ------- | -------- | ---------------------------------- | ------- |
| dependency plan / install planning    | RSV-01, RSV-02, RSV-03 | Exact plans, calls, pins, SHA, versions, and network-resolve counts                      | 0       | No       | Behavioral / whole value           | PASS    |
| agent target bridge / update planning | RSV-04                 | Typed errors plus full index/file/state preservation                                     | 0       | No       | Behavioral / bytes and whole state | PASS    |
| release/tag/cascade                   | RSV-05                 | Exact discriminated unions and declared range                                            | 0       | No       | Whole value                        | PASS    |
| missing-dependency ledger             | RSV-05                 | Exact rollback-partial object and absent saved record                                    | 0       | No       | Behavioral / whole value           | PASS    |
| Cucumber install/update scenarios     | RSV-01, RSV-04         | Complete result tables, request log, record bytes, versions, files, index, staged skills | 0       | No       | Public behavioral                  | PASS    |

Disabled requirement tests: 0. Circular expected-value generation: 0. Insufficient assertions: 0.

### Anti-Patterns Found

No unresolved `TBD`, `FIXME`, or `XXX` marker was found in the covered production files. The fresh code review is clean (0 Critical, 0 Warning, 0 Info), the security audit closed 17/17 threats with `threats_open: 0`, and the combined static/Fallow gate passed. No blocker or new-scope advisory was found.

### Advisory (New Scope, Unevidenced)

None.

### Decision Coverage

All 7 trackable CONTEXT.md decisions are honored by shipped artifacts.

### Human Verification Required

None. Every user-visible behavior in the phase has a public Cucumber scenario, and every state-transition/order invariant has an active unit or behavioral test.

### Gaps Summary

None. All roadmap success criteria, requirements, decisions, artifacts, and current key links are verified. The Phase 11 file split changes artifact locations but not the Phase 4 contracts.

---

_Verified: 2026-10-28T17:56:28Z_
_Verifier: gsd-verifier_
