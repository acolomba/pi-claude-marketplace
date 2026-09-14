---
phase: 01-reliable-negative-controls
verified: 2026-09-14T14:41:23Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/BACKLOG.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/01-reliable-negative-controls/01-01-PLAN.md
  - .planning/phases/01-reliable-negative-controls/01-01-SUMMARY.md
  - .planning/phases/01-reliable-negative-controls/01-02-PLAN.md
  - .planning/phases/01-reliable-negative-controls/01-02-SUMMARY.md
  - .planning/phases/01-reliable-negative-controls/01-BASELINE.md
  - .planning/phases/01-reliable-negative-controls/01-CONTEXT.md
  - .planning/phases/01-reliable-negative-controls/01-REVIEW.md
  - .planning/phases/01-reliable-negative-controls/01-VALIDATION.md
  - scripts/test-coverage-direct.mjs
  - scripts/test-coverage-direct.negative.mjs
covered_digest: "v1:sha256:a9af775037e2cd4728eb2f6906774e1607af924093154e6291514bd66c506f9f"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Reliable Negative Controls Verification Report

**Phase Goal:** The CLI negative control observes the intended failure and rejects launch errors or missing diagnostics.
**Verified:** 2026-09-14T14:41:23Z
**Status:** passed
**Re-verification:** No. This is the initial verification.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                  | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The CLI negative control observes each intended mapping refusal and rejects a launch error or a missing diagnostic.                    | VERIFIED | `observeChild()` records `error`, `signal`, `status`, `stdout`, and `stderr` independently. `assertChildResult()` rejects a launch error before it compares the exact status and both streams. The live negative-control run passed the real outside-project and unmappable-path refusals, the launch-failure control, and the missing-diagnostic control.                   |
| 2   | The Node 26 child-observation failure is repaired without weakening the refusal contract, and the similar Git fixture path is checked. | VERIFIED | The baseline records the Node v26.8.2 sandbox pipe failure. The current observer uses file descriptors under the temporary fixture root, then reads each stream separately. `fixtureGit()` rejects launch errors, signals, and nonzero statuses. The live run exercised fixture Git setup and a shallow-parent Git refusal.                                                  |
| 3   | A supported benign invocation succeeds through the same observation path.                                                              | VERIFIED | The harness runs a Node child through `observeChild()` and requires status 0, exact stdout `benign child completed\n`, and empty stderr before any negative case runs. `npm run test:coverage:direct:negative` passed.                                                                                                                                                       |
| 4   | The stale import report is closed from current behavior.                                                                               | VERIFIED | `env -u PI_CODING_AGENT_DIR node tests/e2e/import-command.test.ts` passed all three named import cases. The E2E test invokes the registered command and asserts its observable results.                                                                                                                                                                                      |
| 5   | Completed backlog history remains traceable, while FLOW-09 keeps its open production-mode work distinct.                               | VERIFIED | `.planning/BACKLOG.md` links FLOW-07 to archived `GGAT-03` and Phase 7's passed 7/7 verification, labels E2EIMP-01 stale after the current three-case result, marks COV-01 superseded by RCOV-01, and separates FLOW-09's closed explicit seams from its Phase 5 production-mode work. The archived requirement file contains the matching GGAT-03 and RCOV-04 dispositions. |

**Score:** 5/5 truths verified (0 present, behavior-unverified).

### Required Artifacts

| Artifact                                    | Expected                                                      | Status   | Details                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/test-coverage-direct.negative.mjs` | Faithful child-result observation and discriminating controls | VERIFIED | Substantive file-backed observer, exact-result assertion, real CLI subprocesses, benign and failing controls, and unconditional temporary-root cleanup.                                                        |
| `scripts/test-coverage-direct.mjs`          | Direct-coverage CLI that emits the exercised mapping refusals | VERIFIED | The CLI rejects out-of-project and unmappable paths with the exact diagnostics asserted by the negative harness. `gitLines()` keeps launch-error and nonzero-status refusal paths while ignoring unused stdin. |
| `.planning/BACKLOG.md`                      | Current and historical dispositions                           | VERIFIED | Contains concrete archive paths, requirement IDs, current E2E result, and an explicit split between completed and open FLOW-09 work.                                                                           |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- |
| `scripts/test-coverage-direct.negative.mjs` | `scripts/test-coverage-direct.mjs` | Real CLI subprocess | VERIFIED | `gatePath` resolves the direct-coverage script and `observeChild(process.execPath, [gatePath, ...])` invokes it for both real refusals. The harness also imports its exported helpers for fixture controls. |
| `.planning/BACKLOG.md` | `.planning/milestones/refine-unit-tests-REQUIREMENTS.md` | Completed requirement evidence | VERIFIED | FLOW-07 cites `GGAT-03`; COV-01 cites `RCOV-01` and `RCOV-04`. The archived requirements file records those matching completed and evidence-only statuses. |

### Data-Flow Trace

| Artifact                                    | Data variable                                           | Source                                                                     | Produces real data                                                                 | Status  |
| ------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| `scripts/test-coverage-direct.negative.mjs` | `observed.stdout`, `observed.stderr`, `observed.status` | Separate file descriptors written by the actual Node or Git child process  | Yes. The values are read from per-child files and compared byte-for-byte.          | FLOWING |
| `.planning/BACKLOG.md`                      | Historical dispositions                                 | Current E2E command plus named archived requirement and verification files | Yes. The links and requirement clauses resolve to records that state their status. | FLOWING |

### Behavioral Spot-Checks

| Behavior                                                       | Command                                                              | Result                                                                                                                                                                                          | Status |
| -------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Negative controls discriminate valid and invalid child results | `npm run test:coverage:direct:negative`                              | Exit 0. The harness reports its full negative-control ledger after running the benign child, failed child, missing executable, signal, wrong status, missing diagnostic, and real CLI refusals. | PASS   |
| Import behavior resolves the stale E2E report                  | `env -u PI_CODING_AGENT_DIR node tests/e2e/import-command.test.ts`   | Exit 0, 3 pass, 0 fail, 0 skipped.                                                                                                                                                              | PASS   |
| Changed scripts remain syntactically and style-valid           | `node --check` for both scripts; ESLint and Prettier on both scripts | All commands exited 0.                                                                                                                                                                          | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                                  | Status    | Evidence                                                                                                                                        |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| NEG-01      | 01-01       | Repair Node 26 direct-coverage CLI negative controls without weakening exit or diagnostic assertions.                        | SATISFIED | Truths 1 and 3. Exact status, stdout, and stderr checks are exercised by the live negative-control command.                                     |
| NEG-02      | 01-01       | Determine the child-observation cause and check analogous subprocess assertions while retaining launch-error discrimination. | SATISFIED | Truth 2. The baseline records the observed pipe failure; current code uses separate output descriptors and checks Git fixture process failures. |
| HIST-01     | 01-02       | Reconfirm E2EIMP-01 and reconcile TESTQ-01, FLOW-07, and COV-01 without duplicate implementation.                            | SATISFIED | Truths 4 and 5. The live import E2E command passed, and current backlog entries point to matching archived evidence.                            |

No orphaned requirements: NEG-01, NEG-02, and HIST-01 are the three Phase 1 requirements in `.planning/REQUIREMENTS.md`, and each appears in a Phase 1 plan.

### Anti-Patterns Found

None. The changed scripts contain no untracked `TBD`, `FIXME`, or `XXX` markers, no skipped controls, and no static result that reaches the asserted child output. Descriptor cleanup is nested around the child launch, and the top-level `finally` removes the fixture root.

## Human Verification Required

N/A. This is an internal CLI and historical-record phase. Each outcome is reproducible through the commands above, and no behavior-dependent truth remains unexercised.

## Baseline Scope Note

The initial baseline recorded 63,345/63,349 production lines and 9,112/9,113 branches, with four lines and one branch uncovered in `bridges/agents/convert.ts`. This report verifies Phase 1, not aggregate coverage. The separate Phase 3 correction and exact 100% measurement are recorded in `../03-reachable-agent-collision-contract/03-01-SUMMARY.md`.

## Gaps Summary

No gaps found. The phase goal is achieved by live process-level controls that distinguish launch, signal, exit status, stdout, and stderr, plus live E2E and archived-history evidence for HIST-01.

---

_Verified: 2026-09-14T14:41:23Z_
_Verifier: the agent (gsd-verifier)_
