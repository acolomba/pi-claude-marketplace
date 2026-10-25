---
phase: 15-state-lock-and-marketplace-failure-cleanup
verified: 2026-10-23T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-01-PLAN.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-01-SUMMARY.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-02-PLAN.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-02-SUMMARY.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-03-PLAN.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-03-SUMMARY.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-04-PLAN.md
  - .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-04-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - features/marketplace/failed-add.feature
  - features/marketplace/remove.feature
  - features/marketplace/state-lock.feature
  - features/plugin/state-lock.feature
  - features/step_definitions/marketplace/checkout.steps.ts
  - test/integration/marketplace-layer-remove.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/remove.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
covered_digest: "v3:sha256:6dc1dcd1333bc89be77f2537d3089fed99365b4f0839691654324c2330d76eec"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "A plugin `import` that cascades installs while another process holds the scope's state lock fails with the lock-held reason"
    addressed_in: "No carrier. Recorded only in 15-CONTEXT.md Deferred Ideas; Phase 13's success criteria do not name the lock and BACKLOG.md has no entry."
    evidence: "15-CONTEXT.md Deferred: 'import that cascades installs under a held lock is Phase 13's surface'. Still true on the combined tree: `orchestrators/import/execute.ts::dispatchFailedOutcome` has no `StateLockHeldError` arm and ends in `pushUnexpectedFailure(..., 'unexpected-failure', ...)`; `features/plugin/import.feature` has no lock scenario."
  - truth: "prune's lock-held cause chain names the absolute lock path like every other command"
    addressed_in: "Follow-up (D-06); recorded in 15-CONTEXT.md Deferred Ideas, no BACKLOG entry"
    evidence: "15-CONTEXT.md D-06 and Deferred Ideas; the two prune scenarios pin the observed `(.state-lock)` text."
decision_coverage:
  honored: 13
  total: 13
  not_honored: []
human_verification: []
---

# Phase 15: State Lock and Marketplace Failure Cleanup Verification Report

**Phase Goal:** A command run while another process holds the state lock changes nothing, a failed `marketplace add` leaves nothing behind, and `marketplace remove` cleans up the clones of the plugins it uninstalls.
**Verified:** 2026-10-23
**Status:** passed
**Re-verification:** Yes. The first verification (at ec3c3c85) went stale when the phase branch merged into the combined milestone tree (merge 3c5c2aa1, HEAD 7a9b6107). The merge conflicted in `update-flow.ts`, `install.messaging.ts` and `enable-disable.ts`. This pass re-checked every lock-held path against the merged code.

## Goal Achievement

### Merge-resolution check

The merge kept the git-host and errno reasons from the other phases next to this phase's `lock held` reason. A diff of the three conflicted files against the phase side (`0d6b61ca`) shows no changed line that carries a lock arm. The only differences near a lock arm are two comment rewordings in `install.messaging.ts` and one in `enable-disable.ts`. The lock arm comes first in every ladder, so a lock error cannot reach an errno or git-host arm first:

| Path | Code (current tree) | Lock arm position |
| --- | --- | --- |
| install runtime-throw row | `install.messaging.ts::runtimeFailureReasons`: `StateLockHeldError` returns `["lock held"]` before the `gitReason` fallback. `classifyGitHostFailure(err)` is computed separately and cannot override it. | first |
| enable/disable standalone row | `enable-disable.ts::standaloneTransactionThrowReasons`: `EnableRefusedError`, then `StateLockHeldError` | first two arms, no errno ladder |
| enable/disable orchestrated | `classifyTransactionThrow`: `StateLockHeldError` wins before `primaryDisableFailureReason` (the errno ladder) | first |
| update direct row | `update-flow.ts::narrowDirectFailReason` calls `typedDirectFailReason` first (its first arm is `StateLockHeldError`), then `classifyGitTransportFailure`, then `narrowErrnoFailReason` | first |
| update autoupdate cascade | `reasonsFromTypedError`: `StateLockHeldError` is the first test, plus the `cause: err` spread at line 684 | first |
| reinstall | `reinstall-record.ts`: `StateLockHeldError` arm before the layer-refusal arms, and `isRenderedCause` keeps the cause | early |
| marketplace add | `add.ts::handleAddFailure` tests the raw error with `instanceof StateLockHeldError` before `classifyAddError` | first |
| marketplace remove | `remove.ts::surfaceRemoveStop` `StateLockHeldError` arm | present |
| marketplace update / autoupdate | `update.ts` line 735, `autoupdate.ts` line 224 | present |
| uninstall, prune | `uninstall.ts` line 591, `prune.ts` line 110 | present |

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each plugin command that changes a scope, run while another process holds that scope's state lock, fails with the lock-held reason, and the scope's records, configs, and offered skills are unchanged (FLR-01) | VERIFIED for the commands the phase scoped (D-07). `import` is deferred, see Warning below. | `features/plugin/state-lock.feature` has 14 scenarios (install, uninstall, enable, disable, update, reinstall, prune, each in the project and the user scope). They pass on the combined tree. Each asserts `status failed`, `reasons lock held`, the cause chain, and that the record, the config declarations, and the staged skills are unchanged. The code table above shows the merge kept every lock arm. |
| 2 | `marketplace add`, `remove`, and `update`, run while another process holds the state lock, fail with the lock-held reason and change nothing (FLR-02) | VERIFIED | `features/marketplace/state-lock.feature` runs 5 scenario entries (the add Outline expands to 8 rows). They pass. Code: `add.ts::handleAddFailure`/`surfaceLockHeldAdd`, `remove.ts` stop arm, `update.ts` and the autoupdate cascade. |
| 3 | A `marketplace add` that fails with 404, an invalid manifest, or a dropped connection leaves no clone directory and no record, and the same add succeeds once the cause is gone (FLR-03) | VERIFIED | `features/marketplace/failed-add.feature` has 6 scenarios, all passing. They assert the failed row, the git host request log, no `sources/` or `sources-staging/` entry (`checkout.steps.ts`), no git clones, and no `claude-plugins.json`. Retries cover a 404, a dropped connection, and a dir-source invalid manifest. |
| 4 | `marketplace remove` deletes the `plugin-clones/` entries of the git-source plugins it uninstalls, and keeps an entry that another installation still uses (FLR-04) | VERIFIED | Two scenarios in `features/marketplace/remove.feature` (one deletes both clones with no git host request, one keeps the shared `mono` clone). Both pass on the combined tree. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | VERIFIED | The four feature files: `83 scenarios (83 passed)`, `944 steps (944 passed)`, run by this verifier on the combined tree. `npm run check:features`: exit 0, run by this verifier. The orchestrator reports `npm run check` green on this exact tree (static, unpaired, integration, 702/702 cucumber scenarios, direct coverage). The verifier did not re-run it. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Warning: criterion 1 reads wider than D-07 (import)

The ROADMAP wording "each plugin command that changes a scope" literally includes `/claude:plugin import`. The phase scoped the scenarios to the commands D-07 lists, and the CONTEXT file defers `import` as a recorded decision. On the combined tree an `import` whose install cascade meets a held lock still reports `unexpected-failure`, not `lock held`. It fails, so the state stays unchanged, but the reason is wrong. I kept the phase at `passed` because the scoping is a recorded decision (D-07 and Deferred Ideas) and the earlier verification accepted it. The deferral has no carrier, though: Phase 13's criteria do not name the lock and BACKLOG.md has no entry. Step 9b says to defer only on clear evidence in a later phase, so the orchestrator must either add the carrier or decide that criterion 1 needs an `import` scenario and fix. See the first "For the orchestrator" item.

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | `import` cascading installs under a held lock reports `unexpected-failure`, not `lock held` | No carrier yet (needs a BACKLOG entry or a Phase 13 criterion) | `dispatchFailedOutcome` in `orchestrators/import/execute.ts` has no lock arm. Re-confirmed on the combined tree. |
| 2 | prune's lock-held cause names `(.state-lock)` instead of the absolute lock path | Follow-up (D-06; needs a BACKLOG entry) | 15-CONTEXT.md D-06. The two prune scenarios pin the observed text. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/state-lock.feature` | FLR-01 scenarios | VERIFIED | 14 scenarios, passing |
| `features/marketplace/state-lock.feature` | FLR-02 scenarios | VERIFIED | 4 scenarios plus an 8-row Outline, passing |
| `features/marketplace/failed-add.feature` | FLR-03 scenarios | VERIFIED | 6 scenarios, passing |
| `features/marketplace/remove.feature` | FLR-04 scenarios | VERIFIED | Includes the 2 clone scenarios, passing |
| `features/step_definitions/marketplace/checkout.steps.ts` | `the {word} scope holds no marketplace checkout` | VERIFIED | Present, used by `failed-add.feature` |
| `features/lib/state-lock-holder.ts` | Child process that holds a real `proper-lockfile` lock | VERIFIED | Present, used by both lock features |
| `orchestrators/plugin/install.messaging.ts` | Install lock reason | VERIFIED | `runtimeFailureReasons` |
| `orchestrators/plugin/enable-disable.ts` | Enable and disable lock reason | VERIFIED | `standaloneTransactionThrowReasons`, `classifyTransactionThrow` |
| `orchestrators/plugin/update-flow.ts` | Update lock reason, direct and cascade | VERIFIED | `typedDirectFailReason`, `reasonsFromTypedError`, cause spread |
| `orchestrators/plugin/reinstall-record.ts` | Reinstall lock cause (D-05) | VERIFIED | `isRenderedCause` |
| `orchestrators/marketplace/add.ts` | Add lock row | VERIFIED | `surfaceLockHeldAdd` |
| `orchestrators/marketplace/remove.ts` | Remove lock row | VERIFIED | `surfaceRemoveStop` lock arm |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `withExistingScopeLock` ELOCKED | install row reasons | `composeInstallFailureMessage` -> `runtimeFailureReasons` | WIRED | Both scopes pass |
| state guard throw | enable/disable standalone row | `standaloneTransactionThrowReasons` | WIRED | 4 scenarios |
| state guard throw | update direct row | `narrowDirectFailReason` -> `typedDirectFailReason` | WIRED | 2 scenarios plus unit cases |
| state guard throw (cascade) | autoupdate cascade outcome | `reasonsFromTypedError` plus cause spread | WIRED | Unit case passes |
| add guard throw | add row | `handleAddFailure` raw `instanceof` -> `surfaceLockHeldAdd` | WIRED | 8 Outline rows plus 3 unit cases |
| remove guard throw | remove row | `surfaceRemoveStop` -> `surfaceMarketplaceFailure` | WIRED | 2 scenarios, 2 unit cases, 1 integration case |

### Data-Flow Trace (Level 4)

Not applicable. Each lock-held value comes from a real `proper-lockfile` lock that a child process holds (`features/lib/state-lock-holder.ts`), so no row comes from a mock.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js --parallel 2 features/plugin/state-lock.feature features/marketplace/state-lock.feature features/marketplace/failed-add.feature features/marketplace/remove.feature` | 83 scenarios / 944 steps passed | PASS |
| FLR unit cases | `node --test --test-name-pattern FLR` on the six touched unit modules | 10 passed (add 3, remove 2, enable-disable 1, install.messaging 1, reinstall-record 1, update-flow 2), 0 failed | PASS |
| FLR integration case | same pattern on `test/integration/marketplace-layer-remove.test.ts` | 1 passed | PASS |
| Feature hygiene | `npm run check:features` | exit 0 | PASS |
| Full gate | `npm run check` (orchestrator, this tree) | green, not re-run | PASS (reported) |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FLR-01 | 15-01, 15-02 | A plugin command under a held lock fails `lock held` and changes nothing | SATISFIED for the scoped commands | Truth 1. The `import` row is deferred. |
| FLR-02 | 15-03 | Marketplace add, remove, and update under a held lock fail `lock held` and change nothing | SATISFIED | Truth 2 |
| FLR-03 | 15-04 | A failed add leaves no clone and no record, and a retry succeeds | SATISFIED | Truth 3 |
| FLR-04 | 15-04 | Marketplace remove deletes the clones it alone used and keeps a shared clone | SATISFIED | Truth 4 |

No requirement is orphaned. REQUIREMENTS.md still shows FLR-01..04 as `[ ]` / `Pending`, and ROADMAP still shows Phase 15 as `0/TBD Not started`.

### Decision Coverage

All trackable CONTEXT.md decisions are honored (13/13). D-04 is honored in its amended form. D-05 is done. D-06 is deferred as recorded.

### Anti-Patterns Found

None. The phase diff (`extensions`, `test`, `features`, 19 files) adds no TBD, FIXME, XXX, TODO, HACK, `.skip`, `@skip`, or `@wip` marker. One Info item (IN-04): the add exotic-throw unit case pins the number of prototype reads, so a new `instanceof` arm breaks it. This is test brittleness and does not stop the goal.

### Human Verification Required

None.

### Gaps Summary

No gaps. The phase goal holds on the combined tree for every command the phase scoped. The merge resolution kept every lock-held arm, and each one sits ahead of the git-host and errno arms from the other phases. One warning stands (the `import` deferral has no carrier).

## For the orchestrator

- Open, now with a stronger claim on you: an `import` that cascades installs under a held lock reports `unexpected-failure`, because `dispatchFailedOutcome` (`orchestrators/import/execute.ts`) has no `StateLockHeldError` arm. Phase 13 has now landed on the combined tree and its `import.feature` has no lock scenario, so the "Phase 13's surface" premise did not resolve this. The ROADMAP wording of criterion 1 ("each plugin command") is wider than D-07. Add the carrier (a BACKLOG entry, or a line in the ROADMAP phase criteria) or decide to fix it. This is the only item that could change the verdict.
- D-06 is deferred: prune's lock-held cause redacts the lock path to `(.state-lock)`, while every other command prints the absolute path. Two scenarios pin the redacted text. Needs a BACKLOG entry.
- IN-01 is open: the lock-holding test helpers are duplicated (`whileLockHeld` and `lockHeldCause` in `add.test.ts` and `remove.test.ts`, inline `lockfile.lock` blocks in `update-flow.test.ts` and `enable-disable.test.ts`, and `holdStateLock` in `mcp-migration.test.ts`).
- IN-04 was skipped: the add exotic-throw unit case pins the `instanceof` prototype read count. A count-free double needs a design choice.
- D-04 was amended: the lock-held `marketplace add` row is named by the typed source, and its child row's JSON id is the bare typed source (ADD-10), not `<source>@<source>`.
- Reconcile and orchestrated behavior changed. An orchestrated lock-held add now returns the reason `lock held` instead of `unparseable` (reconcile's `mp-add-failed` row). An orchestrated lock-held remove now returns a failed outcome (`lock held`) instead of throwing.
- Resolved by this pass: the stale VERIFICATION.md after the merge conflict. The merged `update-flow.ts`, `install.messaging.ts` and `enable-disable.ts` keep the lock arm first, and the scenarios and unit cases pass.
- The CHANGELOG entry for the user-visible lock-held rows belongs in the milestone PR. CHANGELOG.md is not edited.
- After WR-03, the url invalid-JSON failed add has no direct record check and no retry. The retry scenarios cover the 404 and the dropped connection, and the dir-source invalid-manifest retry covers the invalid manifest for a dir source.
- At phase completion, mark FLR-01..04 complete in REQUIREMENTS.md and update the Phase 15 plan count and status in ROADMAP.md.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
