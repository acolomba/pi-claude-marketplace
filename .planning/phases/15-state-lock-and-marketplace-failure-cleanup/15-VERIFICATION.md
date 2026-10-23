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
covered_digest: "v3:sha256:8b25f525e10c08cafc0ab4dd7b211faec048ec6edd5719cc26b6c81a0cec3320"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A plugin `import` that cascades installs while another process holds the scope's state lock fails with the lock-held reason"
    addressed_in: "Phase 13 (Plugin Import) or a follow-up; recorded in 15-CONTEXT.md Deferred Ideas, no BACKLOG entry yet"
    evidence: "15-CONTEXT.md Deferred: 'import that cascades installs under a held lock is Phase 13's surface'. Phase 13's success criteria do not name the lock, so the orchestrator must add a BACKLOG entry as the carrier."
  - truth: "prune's lock-held cause chain names the absolute lock path like every other command"
    addressed_in: "Follow-up (D-06); recorded in 15-CONTEXT.md Deferred Ideas, no BACKLOG entry yet"
    evidence: "15-CONTEXT.md D-06 and Deferred Ideas; the two prune scenarios pin the observed `(.state-lock)` text"
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
**Re-verification:** No. This is the initial verification, at HEAD ec3c3c85.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each plugin command that changes a scope, run while another process holds that scope's state lock, fails with the lock-held reason, and the scope's records, configs, and offered skills are unchanged (FLR-01) | VERIFIED | `features/plugin/state-lock.feature` has 14 scenarios: install, uninstall, enable, disable, update (an update is due), reinstall, and prune, each in the project and the user scope. Each one asserts `status failed`, `reasons lock held`, and the full cause chain. Each also checks the installation record (install checks that the scope has no installed plugins), the `claude-plugins.json` plugin declarations, and the staged skills. The product arms all narrow the raw caught value with `instanceof StateLockHeldError`: `install.messaging.ts::runtimeFailureReasons`, `enable-disable.ts::standaloneTransactionThrowReasons`, `update-flow.ts::typedDirectFailReason` (the first arm), and `reinstall-record.ts::isRenderedCause`, which adds the cause. Uninstall and prune already had the reference shape. `import` is a recorded deferral (see Deferred Items). |
| 2 | `marketplace add`, `remove`, and `update`, run while another process holds the state lock, fail with the lock-held reason and change nothing (FLR-02) | VERIFIED | `features/marketplace/state-lock.feature` has 12 scenarios. Remove and update run in both scopes and assert kind `cascade`, severity `error`, the failed marketplace row, and the `lock held` child row with its cause chain. They also check that the marketplace and plugin declarations, the record, and the staged skills are unchanged. The add Outline has 8 rows: dir, file, url, and github sources, each in both scopes. Each row asserts the row named and id'd by the typed source (D-04 amended), that `claude-plugins.json` does not exist, that the scope holds no marketplace checkout, and that it holds no git clones. Code: `add.ts::handleAddFailure` tests `err instanceof StateLockHeldError` on the raw error before `classifyAddError` and then calls `surfaceLockHeldAdd`, which uses `marketplaceFailureRows` with `marketplaceSubject: true`. `remove.ts::surfaceRemoveStop` has a `StateLockHeldError` arm that calls `surfaceMarketplaceFailure`. The update autoupdate cascade (`update-flow.ts::reasonsFromTypedError` and the `cause` spread, WR-02) also reports `lock held`. |
| 3 | A `marketplace add` that fails with 404, an invalid manifest, or a dropped connection leaves no clone directory and no record, and the same add succeeds once the cause is gone (FLR-03) | VERIFIED | `features/marketplace/failed-add.feature` has three url-source scenarios, one each for a 404 (`source missing`), a dropped connection (`network unreachable`), and invalid JSON (`invalid manifest`). In each, the add is the `When`. Each asserts the failed row and its reason and the git host request log. Each then checks that the scope holds no checkout in `sources/` or `sources-staging/` (`checkout.steps.ts`), holds no git clones, and has no `claude-plugins.json`. Three retry scenarios cover a url add after a 404, a url add after a dropped connection, and a dir add after an invalid manifest. A leftover record would make the retried add fail. The url invalid-JSON add has no direct record check and no retry (see For the orchestrator). |
| 4 | `marketplace remove` deletes the `plugin-clones/` entries of the git-source plugins it uninstalls, and keeps an entry that another installation still uses (FLR-04) | VERIFIED | `features/marketplace/remove.feature` has two new scenarios. In the first, `gits` offers a github plugin and a pinned git-subdir plugin. After the remove, the scope holds no git clones and the git host receives no request. In the second, `gits` and `others` offer git-subdir plugins of `mono`, pinned to one commit. After `gits` is removed, the scope still holds the `plugin` clone of `acme/mono.git` at `{mono revision 1}`, and the git host receives no request. The product already behaved this way, so this was test-only work (D-11). |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | VERIFIED | The four feature files gave `83 scenarios (83 passed)`, `944 steps (944 passed)`, exit 0. The verifier ran them at ec3c3c85, and the coordinator's run at HEAD matched. The coordinator ran `npm run check:features` at HEAD: exit 0. The fixer ran `npm run check` at 4468fe5f: exit 0, with 493 cucumber scenarios. `git diff 4468fe5f..HEAD --stat` changes only `15-REVIEW-FIX.md`, so that result covers HEAD. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | `import` cascading installs under a held lock reports `unexpected-failure`, not `lock held` | Phase 13 or a follow-up (needs a BACKLOG entry) | 15-CONTEXT.md Deferred Ideas. A grep of `orchestrators/import/execute.ts` finds no `StateLockHeldError`. `dispatchFailedOutcome` folds the outcome to `unexpected-failure`. |
| 2 | prune's lock-held cause names `(.state-lock)` instead of the absolute lock path | Follow-up (D-06; needs a BACKLOG entry) | 15-CONTEXT.md D-06. The two prune scenarios pin the observed text. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/state-lock.feature` | FLR-01 scenarios | VERIFIED | 14 scenarios, all passing |
| `features/marketplace/state-lock.feature` | FLR-02 scenarios (new) | VERIFIED | 4 scenarios plus an 8-row Outline, all passing |
| `features/marketplace/failed-add.feature` | FLR-03 scenarios | VERIFIED | 2 seed retries plus 4 new scenarios |
| `features/marketplace/remove.feature` | FLR-04 scenarios | VERIFIED | 2 new clone scenarios |
| `features/step_definitions/marketplace/checkout.steps.ts` | `the {word} scope holds no marketplace checkout` (D-10) | VERIFIED | Reads `sources/` and `sources-staging/` and treats a missing directory as empty. The 15-04 planted check showed that it catches a leaked staging dir that the git-clone step misses. The step moved here from `failed-add.steps.ts` (WR-05). |
| `orchestrators/plugin/install.messaging.ts` | Install lock reason | VERIFIED | `runtimeFailureReasons` |
| `orchestrators/plugin/enable-disable.ts` | Enable and disable lock reason | VERIFIED | `standaloneTransactionThrowReasons` |
| `orchestrators/plugin/update-flow.ts` | Update lock reason, direct path and cascade | VERIFIED | `typedDirectFailReason`, `reasonsFromTypedError`, and the cause spread |
| `orchestrators/plugin/reinstall-record.ts` | Reinstall lock cause (D-05) | VERIFIED | `isRenderedCause` |
| `orchestrators/marketplace/add.ts` | Add lock row (D-04 amended) | VERIFIED | `surfaceLockHeldAdd` |
| `orchestrators/marketplace/remove.ts` | Remove lock row (D-04) | VERIFIED | `surfaceRemoveStop` lock arm |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `withExistingScopeLock` ELOCKED | install row reasons | `composeInstallFailureMessage` -> `runtimeFailureReasons` | WIRED | The scenarios show `lock held` in both scopes |
| state guard throw | enable/disable standalone row | `runSetEnabledOutcome` catch -> `standaloneTransactionThrowReasons` | WIRED | 4 scenarios |
| state guard throw | update direct row | `narrowDirectFailReason` -> `typedDirectFailReason` | WIRED | 2 scenarios plus a unit case |
| state guard throw (cascade) | autoupdate cascade outcome | `updateSinglePluginWith` catch -> `reasonsFromTypedError` plus the cause spread | WIRED | Unit case `FLR-02: updateSinglePlugin under a held state lock...` |
| add guard throw | add row | `handleAddFailure` raw `instanceof` -> `surfaceLockHeldAdd` -> `marketplaceFailureRows` | WIRED | 8 Outline rows plus 3 unit cases |
| remove guard throw | remove row | `runRemoveOutcome` catch -> `surfaceRemoveStop` -> `surfaceMarketplaceFailure` | WIRED | 2 scenarios, 2 unit cases, and 1 integration case |

### Data-Flow Trace (Level 4)

Not applicable. The phase adds failure-row classification and behavioral tests. Each lock-held value comes from a real `proper-lockfile` lock that a child process holds (`features/lib/state-lock-holder.ts`), so no row comes from a mock.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js features/plugin/state-lock.feature features/marketplace/state-lock.feature features/marketplace/failed-add.feature features/marketplace/remove.feature` | 83 scenarios / 944 steps passed, exit 0 | PASS |
| FLR unit cases | `node --test --test-name-pattern FLR` on the six touched test modules | 10 FLR cases passed, none failed | PASS |
| Feature hygiene | `npm run check:features` (coordinator, HEAD) | exit 0 | PASS |
| Full gate | `npm run check` (fixer, 4468fe5f, code-identical to HEAD) | exit 0 | PASS |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FLR-01 | 15-01, 15-02 | A plugin command under a held lock fails `lock held` and changes nothing | SATISFIED | Truth 1. The `import` row is deferred. |
| FLR-02 | 15-03 | Marketplace add, remove, and update under a held lock fail `lock held` and change nothing | SATISFIED | Truth 2 |
| FLR-03 | 15-04 | A failed add leaves no clone and no record, and a retry succeeds | SATISFIED | Truth 3 |
| FLR-04 | 15-04 | Marketplace remove deletes the clones it alone used and keeps a shared clone | SATISFIED | Truth 4 |

No requirement is orphaned. REQUIREMENTS.md still shows FLR-01..04 as `[ ]` / `Pending`, and ROADMAP still shows Phase 15 as `0/TBD Not started`. The orchestrator updates both at phase completion.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by the shipped artifacts (13/13). D-04 is honored in its amended form: the row is named by the typed source, with the bare source as its id. D-05 is done, not deferred. D-06 is deferred as recorded.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| features/plugin/state-lock.feature | FLR-01 | 14 | 0 | no | Behavioral (full row plus record, config, and stage) | OK |
| features/marketplace/state-lock.feature | FLR-02 | 12 | 0 | no | Behavioral | OK |
| features/marketplace/failed-add.feature | FLR-03 | 6 | 0 | no | Behavioral (failed row, request log, leftovers) | OK. The url invalid-JSON add has no record check. |
| features/marketplace/remove.feature (new) | FLR-04 | 2 | 0 | no | Behavioral (clone table, no network) | OK |
| 6 unit modules plus 1 integration module | FLR-01/02 | 10 FLR cases | 0 | no | Value (the whole notification or outcome, plus unchanged `state.json` bytes) | OK |

Disabled tests on requirements: 0. Circular patterns: 0. Insufficient assertions: 0.

### Anti-Patterns Found

None. The added lines of the phase diff (`extensions`, `test`, `features`) have no TBD, FIXME, XXX, TODO, HACK, or placeholder markers. No `.skip`, `.todo`, or `@skip`/`@wip` tags were found. One Info item, IN-04: the add exotic-throw unit case pins the number of prototype reads, so any new `instanceof` arm breaks it. This is test brittleness and does not stop the goal.

### Human Verification Required

None. Every user-visible row the phase changes is asserted cell by cell by the cucumber scenarios, which run the real command surface against a real held lock.

### Gaps Summary

There are no gaps. The phase goal is achieved for every command the phase scoped (D-07, D-08). Two items are explicitly deferred and recorded in 15-CONTEXT.md: the `import` lock-held row and the prune lock-path redaction. Neither has a BACKLOG entry yet, so the orchestrator must add the carriers.

## For the orchestrator

- D-06 is deferred: prune's lock-held cause redacts the lock path to `(.state-lock)`, while every other command prints the absolute path. Two scenarios pin the redacted text.
- An `import` that cascades installs under a held lock reports `unexpected-failure`, because `dispatchFailedOutcome` (`orchestrators/import/execute.ts`) has no `StateLockHeldError` arm. This product bug is left to Phase 13 or a follow-up. The CONTEXT premise that the install fix covers import is wrong: an orchestrated install returns from `classifyInstallFailure`.
- IN-01 is open: the lock-holding test helpers are duplicated (`whileLockHeld` and `lockHeldCause` in `add.test.ts` and `remove.test.ts`, inline `lockfile.lock` blocks in `update-flow.test.ts` and `enable-disable.test.ts`, and `holdStateLock` in `mcp-migration.test.ts`).
- IN-04 was skipped: the add exotic-throw unit case pins the `instanceof` prototype read count (now 6). A count-free double needs a design choice.
- D-04 was amended: the lock-held `marketplace add` row is named by the typed source, and its child row's JSON id is the bare typed source (ADD-10), not `<source>@<source>`.
- Reconcile and orchestrated behavior changed. An orchestrated lock-held add now returns the reason `lock held` instead of `unparseable` (reconcile's `mp-add-failed` row). An orchestrated lock-held remove now returns a failed outcome (`lock held`) instead of throwing.
- The orchestrator needs to add the BACKLOG entries for the deferred items: the import lock-held row, the prune `(.state-lock)` redaction, and, if wanted, IN-01 and IN-04.
- The CHANGELOG entry for the user-visible lock-held rows belongs in the milestone PR. CHANGELOG.md is not edited.
- After WR-03, the url invalid-JSON failed add has no direct record check and no retry. The retry scenarios cover the 404 and the dropped connection, and the dir-source invalid-manifest retry covers the invalid manifest for a dir source.
- At phase completion, mark FLR-01..04 complete in REQUIREMENTS.md and update the Phase 15 plan count and status in ROADMAP.md.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
