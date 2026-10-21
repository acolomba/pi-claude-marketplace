---
phase: 02-github-clone-base-override
plan: 03
subsystem: orchestrators
tags: [github, env-override, typed-errors, cause-chain, reconcile]

requires:
  - phase: 02-01
    provides: "InvalidGitHubBaseUrlError, gitHubWireUrl seam, setGitHubBaseUrl test helper"
  - phase: 02-02
    provides: "buildGitHubAuth / buildCloneAuth, which read the variable and throw the typed error"
provides:
  - "shared/errors.ts: rethrowInvalidGitHubBaseUrl(err), which walks the cause chain and rethrows the typed error"
  - "marketplace add (orchestrated), marketplace update (refresh and autoupdate cascade), install, the missing-dependency install, import, and enable fail as a whole on an invalid base"
  - "the edge enable handler rethrows the typed error instead of rendering an {unreadable} row"
affects: [02-04 literal gate, 02-05 docs and phase gate]

actuals:
  tokens: 11810
  tasks: 3
  commits: 3
plan_head_before: 4b0f7bea4d2aef9ad28c33b40a968a7f57f6e79b
plan_head_after: 82538ae3c707ee2e67dd949a21bd3b2c68f3c09e

tech-stack:
  added: []
  patterns:
    - "Every per-target catch on a GitHub network path calls rethrowInvalidGitHubBaseUrl first, so a configuration error fails the command instead of becoming one target's row"
    - "Rethrow cases compare the rejection to a fresh InvalidGitHubBaseUrlError with deepStrictEqual (prototype, name, message, fields) and assert that nothing was notified"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/shared/errors.test.ts
    - tests/shared/notification-command-error.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts

key-decisions:
  - "add.ts calls rethrowInvalidGitHubBaseUrl inside handleAddFailure's unclassified branch, not as its first statement: a pre-existing case counts the exact prototype reads of an exotic thrown value, and an earlier instanceof walk would consume two of them. An InvalidGitHubBaseUrlError never classifies, so both modes still rethrow it"
  - "enable reaches the variable through runInstallLedger -> probeInstallClone -> buildCloneAuth even on a warm cache, so a GitHub-source enable fixture needs no clone seam; writeUserState gained an optional pluginSource so the ENBL-03 seed can name a GitHub source"
  - "The apply.ts module header's defense-in-depth sentence also names the exception, because this plan made its 'always answer with a typed outcome' claim false"

patterns-established:
  - "A configuration error that applies to the whole command is rethrown past per-target catches through one cause-chain helper; no new reason token"

requirements-completed: [GHB-03]

coverage:
  - id: D1
    description: "rethrowInvalidGitHubBaseUrl returns for an unrelated error and a non-Error value, and rethrows the typed error itself, also from under a MarketplaceUpdateError"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts#rethrowInvalidGitHubBaseUrl"
        status: pass
    human_judgment: false
  - id: D2
    description: "json and rpc command-failure output keeps the slash-free message unredacted"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/shared/notification-command-error.test.ts#GHB-03: a command failing on an invalid base reports the variable unredacted"
        status: pass
    human_judgment: false
  - id: D3
    description: "marketplace add (standalone and orchestrated) and marketplace update (refresh and autoupdate cascade) reject with the typed error and render no row"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#GHB-03: a standalone GitHub add fails the command on an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#GHB-03: an orchestrated GitHub add rethrows an invalid base instead of returning unparseable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GHB-03: updating a GitHub marketplace on an invalid base fails the command instead of rendering a row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GHB-03: an autoupdate cascade plugin failing on an invalid base fails the command"
        status: pass
    human_judgment: false
  - id: D4
    description: "install (standalone, orchestrated), the missing-dependency install, and import (installer and marketplace adder) reject with the typed error, notify nothing, and run no later item"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#GHB-03: installing a GitHub-source plugin on an invalid base fails the command and renders no row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#GHB-03: an orchestrated install rethrows an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#GHB-03: the missing-dependency install rethrows an invalid base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#GHB-03: an installer failing on an invalid base fails the whole import"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#GHB-03: a marketplace add failing on an invalid base fails the whole import"
        status: pass
    human_judgment: false
  - id: D5
    description: "enable (standalone, orchestrated, and through the edge handler) rejects with the typed error and notifies nothing; the reconcile NFR-2 cases still pass"
    requirement: GHB-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#GHB-03: enabling a GitHub-source plugin on an invalid base fails the command"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#GHB-03: an orchestrated enable rethrows an invalid base"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/enable-disable.test.ts#rethrows an invalid base escaping the workflow instead of rendering a row (GHB-03)"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts and tests/orchestrators/reconcile/apply.test.ts (unchanged NFR-2 and reconcile cases)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 03: Invalid GitHub Base Fails the Whole Command Summary

**`rethrowInvalidGitHubBaseUrl` walks a caught error's cause chain and rethrows `InvalidGitHubBaseUrlError` itself. Every per-target catch on a GitHub network path in `marketplace add`, `marketplace update`, `install`, the missing-dependency install, `import`, and `enable` now calls it, so an invalid `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` fails the whole command with the variable named, and no `{network unreachable}`, `{unparseable}`, or failed row appears.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-16T00:50:32Z
- **Completed:** 2026-10-16T01:08:30Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- `shared/errors.ts` exports `rethrowInvalidGitHubBaseUrl(err)`. It uses the shared `causeChain` walk, so `CAUSE_CHAIN_MAX_DEPTH` and the self-reference guard apply.
- `marketplace update` rethrows from `refreshOneMarketplace` (the typed error arrives wrapped in `MarketplaceUpdateError`) and from `cascadeAutoupdates`. Orchestrated `marketplace add` rethrows instead of returning `unparseable`.
- `installPluginWithTransaction` rethrows before the cascade-subject branch, so a dependency member's typed error is caught too. `installMissingDependencyWithTransaction` rethrows the same way. Both "never re-throws" docs name the exception.
- `import` rethrows from `installOnePlannedPlugin` and `addOnePlannedMarketplace`, so no later item runs.
- `enable` rethrows at the two places an `enable-failed` outcome becomes a result: the `enable-failed` arm of `outcomeToTypedResult` and `enableFailedRow`. The edge handler's IL-2 catch rethrows too.
- The three RECON-03 notes in `reconcile/apply.ts`, and its header sentence, say that the typed error ends the reconcile pass and that `resources_discover` reports it as reconcile-aborted (NFR-2). Only comments changed in that file.

## Task Commits

1. **Task 1: Fail marketplace add and update as a whole on an invalid base** - `3f5dcd26` (fix). Commit hook `npm run check:commit` passed on the first attempt.
2. **Task 2: Fail install, the missing-dependency install, and import as a whole on an invalid base** - `8646800d` (fix). Commit hook `npm run check:commit` passed on the second commit attempt. The first attempt never reached the hook: under zsh, `$FILES` did not split into words, so `git add` failed with a pathspec error and nothing was committed.
3. **Task 3: Fail enable as a whole on an invalid base, and correct the reconcile notes** - `82538ae3` (fix). Commit hook `npm run check:commit` passed on the first attempt.

**Plan metadata:** the docs commit that records this summary.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors.ts` - `rethrowInvalidGitHubBaseUrl`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - rethrow in `handleAddFailure`'s unclassified branch; JSDoc names the exception.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - rethrow in `refreshOneMarketplace` and `cascadeAutoupdates`; header bullet.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` - rethrow in both install catches; both "never re-throws" docs updated.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` - rethrow in both per-item catches; the defensive-arm comments rewritten.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - rethrow in `outcomeToTypedResult` (`enable-failed`) and `enableFailedRow`; the `setPluginEnabled` JSDoc and the C1 comment updated.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` - rethrow in the IL-2 catch; C1 comment updated.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - comment-only: three RECON-03 notes and the header sentence.
- Tests: 4 helper cases, 1 notification-command-error case, 2 add, 2 update, 3 install-flow, 2 import, 2 enable-disable orchestrator, 1 edge handler. `writeUserState` in the enable-disable owner test gained an optional `pluginSource`.

## Verification

- `node --test tests/shared/errors.test.ts tests/shared/notification-command-error.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts`: 818 pass, 0 fail.
- `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/import/execute.test.ts`: 326 pass, 0 fail.
- `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/edge/handlers/plugin/enable-disable.test.ts tests/index.test.ts tests/orchestrators/reconcile/apply.test.ts`: 333 pass, 0 fail. The NFR-2 index cases pass unchanged.
- `npm run test:coverage:direct -- <source>` exit 0 (100%) for `shared/errors.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `orchestrators/plugin/install-flow.ts`, `orchestrators/import/execute.ts`, `orchestrators/plugin/enable-disable.ts`, and `edge/handlers/plugin/enable-disable.ts`.
- Acceptance greps: helper export 1; `rethrowInvalidGitHubBaseUrl(` in add.ts 1, update.ts 2, install-flow.ts 2, execute.ts 2, enable-disable.ts 2, edge handler 1; `InvalidGitHubBaseUrlError` in apply.ts 4; apply.ts diff is comment lines only.
- `npx fallow dupes` exit 0 before each commit. `npx fallow audit --base 4b0f7bea`: verdict `pass`, 0 introduced findings (2 inherited clone groups in install-flow.ts).

### TDD evidence

- Task 1 RED: `errors.test.ts` failed to load before the helper existed (a load failure, not an assertion failure). `GHB-03: an orchestrated GitHub add rethrows ...` failed with `Missing expected rejection` (the add returned `unparseable`). The standalone add case passed before the change by design: standalone already rethrew an unclassified error, and the case pins that. The notification-command-error case also passed before the change by design: it pins the json/rpc payload for the message 02-01 shipped.
- Task 2 RED: the standalone install case failed because the install tried to render a row (the strict boundary threw `UnsupportedModeError`). The orchestrated and missing-dependency cases failed with `Missing expected rejection`. Both import cases failed because the import continued and tried to render its cascade.
- Task 3 RED: both enable cases failed with `Missing expected rejection`. The edge case failed because the handler rendered the `{unreadable}` row.
- GREEN: each task's tests and code were committed together, as the plan requires.

### Hand-planted controls (not committed)

- Replaced every `rethrowInvalidGitHubBaseUrl(err);` in `marketplace/add.ts` and `marketplace/update.ts` with `void err;`, then ran the add and update GHB-03 cases: 1 pass (standalone add, by design), 3 fail (`actual: undefined`). Restored from a scratch copy.
- Removed only the `enableFailedRow` rethrow: the standalone enable case failed and the orchestrated case passed. Removed only the `outcomeToTypedResult` rethrow: the orchestrated case failed and the standalone case passed. Restored from a scratch copy each time; `git diff --stat` confirmed the file was back to the intended change.

## Decisions Made

- In `add.ts`, the rethrow is the first statement of the unclassified branch, not of `handleAddFailure`. See Deviations.
- The enable fixture reuses `writeUserState` with a new optional `pluginSource`. A GitHub-source enable reaches `buildCloneAuth` through `probeInstallClone` with no clone seam, so the variable alone drives the case.
- Each rethrow case compares the rejection to `new InvalidGitHubBaseUrlError(..., "scheme")` with `assert.deepStrictEqual`. Strict mode compares the prototype, `name`, `message`, and the own fields, so the class and all fields are checked in one comparison. Cases that inject the error check identity with `assert.strictEqual`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] add.ts rethrow position**
- **Found during:** Task 1
- **Issue:** With the rethrow as the first statement of `handleAddFailure`, the pre-existing case `normalizes a structurally classified exotic throw in orchestrated mode` failed. That case's Proxy answers `getPrototypeOf` as `MarketplaceDuplicateNameError` only for its first two reads and asserts exactly five reads. The helper's `instanceof` walk used two of them, so the classification read `unparseable`.
- **Fix:** The call moved to the first statement of the `reason === undefined` branch. `classifyAddError` never classifies an `InvalidGitHubBaseUrlError`, bare or wrapped, so both modes still rethrow it. The acceptance grep (count 1) and both GHB-03 add cases are unchanged.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
- **Verification:** all 818 Task 1 owner cases pass, including the exotic-throw case.
- **Committed in:** 3f5dcd26

**2. [Rule 2 - Missing critical] apply.ts header sentence**
- **Found during:** Task 3
- **Issue:** The module header says the add, install, and toggle entrypoints "always answer with a typed outcome". This plan made that false.
- **Fix:** The sentence now names the exception, an InvalidGitHubBaseUrlError that ends the pass (GHB-03). Comment only.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
- **Committed in:** 82538ae3

---

**Total deviations:** 2 auto-fixed (1 bug, 1 stale doc). **Impact:** no scope change.

## Issues Encountered

- Under zsh, `$FILES` did not split into words, so the `SKIP=npm-check pre-commit run --files $FILES` fixer pass before the Task 1 commit received one bogus path and checked nothing. The commit hook then ran the full pre-commit pipeline on the staged files and passed, so Task 1 is unaffected. Tasks 2 and 3 used a shell array.
- Pre-existing, not fixed: the `reconcile/apply.ts` header also says that every loop wraps its call in a try/catch. The add, install, and toggle loops have no per-entry catch, and their own RECON-03 notes say so. That sentence predates this plan, which left it alone.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-09 and T-02-11 are mitigated as planned: each listed catch rethrows first, one case per command asserts the typed error and no row, and the notification-command-error case pins the unredacted json/rpc cause. T-02-10 is accepted as planned: the existing index.ts NFR-2 cases pass unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-04 (literal gate) and 02-05 (docs and the phase gate, `npm run check`).
- Assumptions A-07 and A-08 hold. Backfill still isolates each plugin. A rethrown install or enable shows no MCP config notices.

---
*Phase: 02-github-clone-base-override*
*Completed: 2026-10-16*

## Self-Check: PASSED

- FOUND: every file listed in key-files.modified
- FOUND: 3f5dcd26, 8646800d, 82538ae3 (ancestors of HEAD)
