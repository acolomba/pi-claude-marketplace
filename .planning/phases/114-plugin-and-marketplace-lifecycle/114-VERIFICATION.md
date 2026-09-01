---
phase: 114-plugin-and-marketplace-lifecycle
verified: 2026-09-01T15:56:37Z
status: gaps_found
score: 71/75 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "State-changing install, reinstall, and uninstall cases prove safe retry from every material partial or cleanup state through a second exported invocation."
    status: failed
    reason: "The plans require a second invocation from the exact partial state, but the three direct owners stop after asserting the first failure or residue. AST inspection found no failure case with two calls to the paired exported workflow."
    artifacts:
      - path: "tests/orchestrators/plugin/install.test.ts"
        issue: "Failure, compensation, partial, and cleanup cases assert the first result only. Its multi-call cases cover comparison, successful deduplication, or authentication memoization, not failure-to-retry convergence."
      - path: "tests/orchestrators/plugin/reinstall.test.ts"
        issue: "Material prepare, replacement, rollback, persistence, and cleanup faults have no second exported invocation from the resulting state. The only dual exported-call case checks standalone/orchestrated warning parity."
      - path: "tests/orchestrators/plugin/uninstall.test.ts"
        issue: "Partial-cascade tests preserve state 'so a retry' is possible, but do not perform the retry. The only dual exported-call case removes two successful shared-clone referencers."
    missing:
      - "For P114-10, invoke installPlugin again after each materially distinct exported partial or cleanup state and assert convergence or documented safe idempotence from the real bytes/tree."
      - "For P114-12, invoke reinstallPlugin or reinstallPlugins again after each material fault and assert the exact recovery schedule, outcome, bytes, backups, staging, and residue."
      - "For P114-13, invoke uninstallPlugin again at the required cascade, persistence, cleanup, and containment boundaries and assert the documented forward-only convergence without fictional rollback."
---

# Phase 114: Plugin and Marketplace Lifecycle Verification Report

**Phase Goal:** Users keep the same plugin and marketplace lifecycle results while each state-changing workflow gains direct, hermetic proof.
**Verified:** 2026-09-01T15:56:37Z
**Status:** gaps_found
**Re-verification:** No, initial verification

## Verdict

Phase 114 does not yet meet its proof contract. The implementation and almost all test gates are green, but three state-changing direct owners do not exercise the required second invocation from a real failed or partial state. This is a goal-level gap because direct safe-retry proof is an explicit roadmap success criterion and an explicit P114-10, P114-12, and P114-13 acceptance condition.

## Goal Achievement

### Roadmap Observable Truths

| #   | Truth                                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Each of the 14 owner tests passes alone with 100 percent direct function, line, and branch coverage of its paired source.                        | ✓ VERIFIED | All 14 exact direct commands passed. Aggregate totals were 2,096/2,096 branches, 394/394 functions, and 17,061/17,061 lines. The Unix-socket marketplace/add owner passed outside the restricted sandbox.                                          |
| 2   | Lifecycle operations keep their public outcomes and exact notifications.                                                                         | ✓ VERIFIED | All 886 owner tests passed with no skip/todo. Owners assert typed outcomes and byte-exact notifications through exported workflows. No exported signature change or new test seam was found; typecheck passed.                                     |
| 3   | Update preload behavior, staging warnings, rollback, cache behavior, and accepted product corrections are observable through exported workflows. | ✓ VERIFIED | Direct and cascade update tests pass. `update.ts` forwards staged skill generated names as `knownSkills`; two exported-flow tests verify the generated-agent preload. Rollback, warning, partial, and cache partitions pass under direct coverage. |
| 4   | Offline cases stay offline, and network-capable cases use only fake or loopback boundaries without developer credentials.                        | ✓ VERIFIED | The nine architecture carriers passed, including `no-orchestrator-network` and `no-credential-leak`. Owner tests use memory fakes or loopback fixtures. Path, warm, and filesystem-only cases assert empty external call logs.                     |
| 5   | State-changing cases prove atomicity and safe retries with case-owned state and temporary trees.                                                 | ✗ FAILED   | Cases use hermetic roots and prove real partial state, but install, reinstall, and uninstall do not perform the plan-required second exported invocation from their material failure states.                                                       |

### Merged PLAN Must-Haves

The 14 plans add 70 truths to the five roadmap truths. Sixty-seven plan truths are verified. These three are failed:

| Plan    | Failed truth                                                                                                              | Evidence                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| P114-10 | Every install partial, cleanup, and retry partition has exact exported evidence.                                          | `114-10-PLAN.md:94` requires "a second invocation from that exact partial." No install failure case invokes `installPlugin` twice.                  |
| P114-12 | Reinstall prepare, replacement, rollback, finalize, persistence, cleanup, and retry partitions have exact exported proof. | `114-12-PLAN.md:91` requires a second invocation for every material fault. No reinstall failure case invokes the exported reinstall workflow twice. |
| P114-13 | Uninstall failure and cleanup partitions assert actual partial state and retry, with second-pass convergence.             | `114-13-PLAN.md:100` and `:105` require retry at each named boundary. The owner only comments that retained state permits retry.                    |

**Score:** 71/75 merged truths verified

## Required Artifacts

| Artifact set                                                      | Expected                                                       | Status     | Details                                                                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14 paired source files                                            | Substantive exported lifecycle workflows                       | ✓ VERIFIED | All exist, are imported by their owner, and execute under exact-source direct coverage.                                                              |
| 14 owner test files                                               | Direct, hermetic proof for one paired source each              | ⚠ PARTIAL  | All exist and pass, with 100 percent direct coverage. Install, reinstall, and uninstall lack their required failure-to-retry invocation.             |
| `tests/integration/marketplace-add-seed-mirrors.test.ts`          | Six genuine cross-owner integration cases                      | ✓ VERIFIED | Six cases passed outside direct coverage.                                                                                                            |
| `tests/integration/transaction-lifecycle-cascade.test.ts`         | One install/update/reinstall/uninstall integration chain       | ✓ VERIFIED | One case passed outside direct coverage.                                                                                                             |
| Seven former supplemental paths                                   | Removed after single-owner cases move or integrations relocate | ✓ VERIFIED | All seven old paths are absent. Artifact-query "missing" results for these paths are the planned deletion, not missing implementation.               |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | OR-12 generated-skill preload correction                       | ✓ VERIFIED | `knownSkills` is populated from staged skill `generatedName` values at line 1350. Direct and cascade exported tests verify the generated agent body. |

## Source-to-Owner Wiring and Direct Coverage

The direct runner maps one exact source path to its mirrored owner, runs only that owner, extracts that source's LCOV record, and fails unless all found functions, lines, and branches are hit. Every record passed.

| Pair                   | Owner result | Branches | Functions |       Lines | Status                                      |
| ---------------------- | -----------: | -------: | --------: | ----------: | ------------------------------------------- |
| marketplace/add        |     53 tests |  129/129 |     13/13 |     854/854 | ✓                                           |
| marketplace/autoupdate |     21 tests |    83/83 |     13/13 |     603/603 | ✓                                           |
| marketplace/info       |     16 tests |    31/31 |       4/4 |     196/196 | ✓                                           |
| marketplace/list       |      9 tests |    15/15 |       1/1 |     105/105 | ✓                                           |
| marketplace/remove     |     17 tests |    97/97 |     21/21 |     764/764 | ✓                                           |
| marketplace/update     |     54 tests |  120/120 |     17/17 |     866/866 | ✓                                           |
| plugin/enable-disable  |     60 tests |  137/137 |     23/23 | 1,259/1,259 | ✓                                           |
| plugin/fetch           |     24 tests |    77/77 |     14/14 |     553/553 | ✓                                           |
| plugin/info            |    129 tests |  310/310 |     62/62 | 2,372/2,372 | ✓                                           |
| plugin/install         |    123 tests |  236/236 |     51/51 | 2,453/2,453 | ⚠ coverage complete; retry proof incomplete |
| plugin/list            |     89 tests |  180/180 |     37/37 | 1,575/1,575 | ✓                                           |
| plugin/reinstall       |     63 tests |  227/227 |     46/46 | 1,609/1,609 | ⚠ coverage complete; retry proof incomplete |
| plugin/uninstall       |     47 tests |    71/71 |     11/11 |     718/718 | ⚠ coverage complete; retry proof incomplete |
| plugin/update          |    181 tests |  383/383 |     81/81 | 3,134/3,134 | ✓                                           |

The per-file counts above are direct-run TAP counts. The combined owner aggregate executed 886 tests because table-driven execution and runner aggregation differ from source-level case counts recorded in individual coverage output. Both forms passed with zero skip or todo.

## Key Link Verification

| From                                               | To                                      | Via                                                            | Status      | Details                                                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14 owner tests                                     | 14 paired source modules                | Direct imports and exported workflow calls                     | ✓ WIRED     | Every current source-owner link is present.                                                                                                                                          |
| Six transferred supplemental groups                | Their direct owners                     | Stable title prefixes                                          | ✓ WIRED     | Exact prefix gate passed 75/75: 5 marketplace-update transport, 40 plugin-info manifest-absent, 8 install-auth, 17 plugin-list manifest-absent, 2 update-auth, and 3 reinstall-auth. |
| Former add/seed/mirror supplement                  | Retained integration                    | Relocated six-case file                                        | ✓ WIRED     | Six integration cases passed.                                                                                                                                                        |
| Former lifecycle cascade supplement                | Retained integration                    | Relocated four-owner chain                                     | ✓ WIRED     | One integration case passed.                                                                                                                                                         |
| Staged skill records                               | Generated-agent staging                 | `knownSkills: ...recorded.map(record => record.generatedName)` | ✓ WIRED     | Direct and cascade tests assert the generated preload and mapping text.                                                                                                              |
| Failed/partial install, reinstall, uninstall state | Same exported workflow on a second pass | Required retry invocation                                      | ✗ NOT WIRED | No failure case performs the second call required by the plans.                                                                                                                      |

The plan query verified all 23 links to current artifacts. A deleted supplemental link was reported as pending by the generic query; the exact 75-case transfer gate and path-absence checks provide the intended deletion evidence.

## Data-Flow Trace

This phase has no rendered UI or database data flow. Its relevant data flow is exported workflow input through state/config/tree mutation to typed outcomes and notifications.

| Flow                                | Real source                                           | Observed result                                        | Status         |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | -------------- |
| Lifecycle request to public result  | Exported owner call with case-local state/config/tree | Exact typed outcome and notification records           | ✓ FLOWING      |
| Mutation ledger to persistent state | Real temporary roots and persistence functions        | Exact state/config/manifest bytes and tree inventories | ✓ FLOWING      |
| Staged skills to generated agents   | Recorded staged skill names                           | Generated agent frontmatter and mapping body           | ✓ FLOWING      |
| Failure residue to retry result     | First exported failure/partial result                 | No second exported invocation in three owners          | ✗ DISCONNECTED |

## Behavioral Evidence

| Gate                                                               | Result                                                             | Status |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------ |
| All 14 owner files together                                        | 886 tests, 886 pass, 0 fail, 0 skipped, 0 todo                     | ✓ PASS |
| Fourteen exact direct-coverage commands                            | 100 percent functions, lines, and branches for every paired source | ✓ PASS |
| Six stable transfer prefixes                                       | 75 tests, 75 pass                                                  | ✓ PASS |
| Two retained integrations                                          | 7 tests, 7 pass                                                    | ✓ PASS |
| Nine architecture carriers                                         | 9 tests, 9 pass                                                    | ✓ PASS |
| Typecheck, targeted ESLint, targeted Prettier, relevant diff check | Exit 0                                                             | ✓ PASS |
| P114-10/P114-12/P114-13 failure-to-retry AST audit                 | No failure test contains two calls to its paired exported workflow | ✗ FAIL |

### Retry Disconfirmation

The absence is observable, not an inference from naming:

- Install multi-call cases compare `--partial`/`--force`, degraded/clean outcomes, successful clone/source deduplication, or same-host authentication memoization. None retries a failed or partial install.
- Reinstall has one case with direct and aggregate calls for standalone/orchestrated warning parity. None retries a failed or partial reinstall.
- Uninstall has one case with two successful calls for two plugins sharing a clone. Partial cascade comments at lines 1022 and 1210 say the state is retained "so a retry" can use it, but no retry is invoked.

Passing direct coverage cannot replace this evidence. Coverage proves every branch ran at least once, not that a later invocation consumed the exact state left by the first one.

## Test Quality Audit

| Scope                 |      Executed | Skipped/todo | Circular or source-oracle evidence | Assertion level                                                      | Verdict                                |
| --------------------- | ------------: | -----------: | ---------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| 14 direct owners      | 886 aggregate |            0 | None found                         | Exported outcomes, notifications, bytes, trees, schedules            | ⚠ Incomplete for three retry contracts |
| Retained integrations |             7 |            0 | None found                         | Cross-owner lifecycle behavior                                       | ✓ PASS                                 |
| Architecture carriers |             9 |            0 | None found                         | Network, credential, notification, state, and convergence invariants | ✓ PASS                                 |

The owners contain no `only`, `skip`, `todo`, coverage-ignore pragma, impossible cast, `anyTimes()`, source-reading oracle, or test-only export. Test fixtures create real case-local state and trees; they do not generate expected values from production source.

## Lowercase AAA and Ordering Rules

- Static inspection found no uppercase `// Arrange`, `// Act`, or `// Assert` markers.
- Owners use lowercase `// arrange`, `// act`, and `// assert`; combined act/assert usage is not used to hide multi-step behavior.
- Presentation inventories are alphabetized where order is non-behavioral.
- Mutation, rollback, cleanup, notification, scope, and collaborator order remain explicit sequence assertions. No production ordering was alphabetized for appearance.

## Offline and Network Boundaries

- Filesystem-only, path-source, and pinned-warm cases assert no Git, credential, Device Flow, HTTP, or subprocess work.
- Network-capable cases use injected memory fakes or fresh loopback fixtures with allowlisted schedules.
- No developer credential or live network dependency was found.
- Marketplace/add requires a Unix-domain socket fixture. It failed only in the restricted sandbox and passed when rerun with the approved unsandboxed test permission; production was not changed for the sandbox limitation.

## Public Behavior and Production Boundaries

- Exact public outcome and notification assertions pass across all owners.
- Direct/cascade and standalone/orchestrated differences are named and exercised where part of the contract.
- The Phase 114 source diff does not add public exports, test modes, coverage exceptions, or dependency seams.
- Production changes are private invariant cleanup plus the accepted OR-12 update correction and stale type prose. The update correction is exercised through both exported update entry points.

## Requirements Coverage

| Requirement | Source plans            | Description                             | Status    | Evidence                                                                                                                                                                               |
| ----------- | ----------------------- | --------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOD-07      | P114-01 through P114-14 | All 14 pairs complete the pair contract | ✗ BLOCKED | All source-owner, direct-coverage, hermeticity, transfer, integration, and aggregate gates pass, but P114-10, P114-12, and P114-13 do not complete their explicit retry-proof clauses. |

No additional Phase 114 requirement is orphaned from the plans.

## Decision Coverage

The canonical text-matching decision-coverage query reports a soft warning: 3 of 22 CONTEXT decisions are recognized by exact/fuzzy plan wording, while D-03 through D-21 are not recognized. This heuristic has no status effect. Direct plan, source, and test inspection verifies the major lowercase AAA, ordering, ownership, public-contract, offline, integration, and mutation-unit decisions. The retry decisions remain a real gap for the three owners above, independent of the heuristic warning.

## Probe Execution

No Phase 114 plan or summary declares a probe, and no conventional Phase 114 probe exists. Probe execution is not applicable.

## Anti-Patterns Found

| File               | Pattern                                                | Severity | Impact                                                                                  |
| ------------------ | ------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `plugin/update.ts` | `SYNTHETIC_UPDATE_PLACEHOLDER_NAME` identifier/comment | ℹ Info   | This is a named production sentinel with exercised behavior, not a stub or debt marker. |

No unreferenced `TBD`, `FIXME`, or `XXX` marker was found in the 14 paired sources, 14 owners, or two retained integrations. No blocker anti-pattern was found.

## Human Verification Required

None. This is an internal lifecycle test-refactor phase. The remaining gap requires deterministic automated exported-flow tests, not visual or subjective review.

## Deferred Items

None. Phases 115 through 117 do not explicitly defer or own the missing Phase 114 retry proof.

## Gaps Summary

One grouped blocker remains. Add deterministic failure-then-retry cases to the install, reinstall, and uninstall direct owners. Each case must start the second exported invocation from the actual bytes and tree left by the first call and assert the documented outcome, schedule, persistent state, residue, and safe convergence. Do not add production seams or change public behavior to close this test-proof gap.

---

_Verified: 2026-09-01T15:56:37Z_
_Verifier: gsd-verifier_
