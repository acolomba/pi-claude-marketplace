---
phase: 07-mode-refusals-real-pi-verification-and-docs
plan: "02"
subsystem: auth
tags: [authentication, print, isomorphic-git, cleanup]
requires:
  - phase: 06-command-run-contract
    provides: Live notification context and command-scoped output contracts
provides:
  - Typed device-flow refusal preserved through real Git clone and fetch
  - Lazy print admission after stored-credential and memo reuse
  - Real marketplace-add staging cleanup and unchanged-state evidence
affects: [json-output-docs, mode-refusals, corpus-closeout]
tech-stack:
  added: []
  patterns: [Narrow typed rethrow at the authentication callback boundary]
key-files:
  created:
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-02-01-RED.json
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-02-02-RED.json
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - tests/shared/errors.test.ts
    - tests/platform/git-auth-callbacks.test.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/platform/git.test.ts
    - tests/integration/auth-e2e.test.ts
key-decisions:
  - Preserve the actual marketplace cleanup Error.cause contract without changing its orchestrator.
  - Commit passing implementation and regression tests together as the plan explicitly requires.
patterns-established:
  - A typed refusal crosses the Git callback while unrelated exceptions still cancel.
requirements-completed: [MODE-04]
actuals:
  tokens: 10844
  tasks: 2
  commits: 2
plan_head_before: 763dc5b9a92c908c73bf2e9ce887160625e00907
plan_head_after: 68a73eb353229fc6d420c3d61052608213d44167
coverage:
  - id: D1
    description: Exact typed print refusal survives authentication callbacks and real Git operations.
    requirement: MODE-04
    verification:
      - kind: unit
        ref: tests/shared/errors.test.ts#names the print refusal and its exact remedy
        status: pass
      - kind: unit
        ref: tests/platform/git.test.ts#preserves a typed auth refusal from the real fetch operation
        status: pass
      - kind: integration
        ref: tests/integration/auth-e2e.test.ts#real Git clone preserves a device-flow refusal from its auth callback
        status: pass
    human_judgment: false
  - id: D2
    description: Print refuses only a new device flow, using live mode after memo lookup.
    requirement: MODE-04
    verification:
      - kind: unit
        ref: node --test tests/orchestrators/auth-host.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Marketplace add preserves the remedy, removes staging, and leaves prior state unchanged.
    requirement: MODE-04
    verification:
      - kind: integration
        ref: tests/integration/auth-e2e.test.ts#print marketplace add rejects with its remedy after removing the real staged clone
        status: pass
      - kind: integration
        ref: tests/integration/auth-e2e.test.ts#a staging cleanup failure retains the print refusal as the primary cause
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 2: Lazy Print Authentication Refusal Summary

**Print refuses new device-flow authentication before requesting a code, while stored credentials, memo reuse, and typed cleanup causes remain intact.**

## Performance

- Started: 2026-10-10T02:07:35Z
- Completed: 2026-10-10T02:24:03Z
- Tasks: 2
- Files changed before this summary: 10, including two RED evidence records
- Runtime: Node v26.11.1
- Actual token estimate: ceiling of 43,375 realized diff characters divided by four
- Commit count: measured from the persisted plan ledger before this metadata commit

## Accomplishments

- Added `DeviceFlowUnavailableError` with exactly: "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi."
- Preserved the identical error through the real authentication callback and isomorphic-git clone/fetch operations. Generic callback errors still cancel; bound-host and HTTPS checks remain covered.
- Added the live print check after memo lookup and before `initiateDeviceFlow`. Tests cover construction in print/json/rpc/tui, stored credentials on registered and unregistered hosts, memoized success and failure, and unchanged JSON/RPC/TUI flow behavior.
- Exercised production `addMarketplace`, production auth composition, production Git clone, and real temporary files. Only credential/device HTTP and transport boundaries are replaced. Standalone rejection and orchestrated failure retain the remedy. Successful cleanup removes the observed staging clone. Both paths preserve prior state bytes, create no config or final clone, emit no notification, and make zero device-code requests or token polls.
- Injected one staging-removal failure at the filesystem boundary. The resulting error retains the typed refusal as its cause and names the cleanup failure; the prior state remains unchanged. Fixture teardown removes the retained staging tree.
- Proved a public Git clone completes without consulting its supplied authentication bundle.

## Task Commits

1. Typed carrier and real-Git tracer: `eb475065` — `fix(auth): preserve typed device-flow refusals through Git`
2. Lazy admission and operation cleanup: `68a73eb3` — `fix(auth): refuse new device flow lazily in print mode`

## Verification

All commands below exited 0 on task head `68a73eb353229fc6d420c3d61052608213d44167`, Node v26.11.1:

```sh
node --test tests/shared/errors.test.ts tests/platform/git-auth-callbacks.test.ts tests/integration/auth-e2e.test.ts
node --test tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/platform/git.test.ts tests/integration/auth-e2e.test.ts
node --test tests/edge/register.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/enable-disable.test.ts
node --test --test-isolation=none tests/shared/errors.test.ts tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/platform/git.test.ts tests/integration/auth-e2e.test.ts
```

The last command exposes individual case counts: **252 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo** across 51 suites. The tracer verification also passed again after its task commit, before task 2 began.

Each task passed `fallow audit --base HEAD`, explicit-file `SKIP=npm-check pre-commit run --files ...`, and the normal foreground commit hook. The hook ran `npm run check:commit`, including static checks, unpaired tests, and 100% direct coverage for staged pairs. Task 1 checked the shared-errors and auth-callback owners; task 2 checked the auth-host and Git owners. Hooks were never bypassed.

The parent owns the combined-tree `npm run check` gate and final corpus capture. This executor did not substitute staged checks for those gates. No corpus baseline, metadata, catalog, STATE.md, state.json, ROADMAP.md, config.json, or requirements tracking file was changed in the checkout.

## RED Evidence

- `07-02-01-RED.json`: callback owner fails with "Missing expected rejection." The real clone regression independently observed `UserCanceledError` instead of the identical typed refusal. Node's TAP serialization of the Error-object identity diagnostic was rejected by the GSD parser. The provisional rethrow was removed, the owner RED was rerun, and `check tdd-red-evidence` returned `RED_EVIDENCE_OK` before the final rethrow was applied.
- `07-02-02-RED.json`: all four live-print cases fail before the guard. The callback attempts device HTTP and returns an initialization failure instead of throwing the typed refusal. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the construction-in-json case.
- Both records retain the actual command, exit 1, unchanged TAP report, expected/observed behavior, and semantic assessment. The plan has `type: execute`, global TDD mode is false, and its explicit task instruction requires passing commits; no failing RED commit was created.

## Decisions Made

Kept the existing cleanup owner unchanged. Marketplace staging cleanup uses `appendLeakToError` and `Error.cause`; it does not construct `CleanupContextError`. The integration regression verifies that actual contract. The existing structured cleanup type and its `primary`/`cause` behavior remain unchanged.

## Deviations from Plan

No production-scope deviation. Tests account for the extra live-mode read without changing existing prompt values or dropping old cases. Commit titles follow the project requirement to omit planning identifiers.

## Issues Encountered

- Fallow's temporary comparison worktree required sandbox escalation for shared Git metadata. The approved rerun passed.
- The first task hook found an array where the transport response required an async iterator. The fixture was corrected and the normal hook passed on retry.
- The second task hook found import ordering and two blank-line errors. These were corrected; the normal hook passed on retry.
- The default test runner reports file-level results in this environment. An additional run with `--test-isolation=none` supplied the individual passing case counts above.

## Known Stubs

None. No skipped tests, unfinished assertions, or unrun task verification commands remain.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-03 through T-07-06 are covered by host isolation, bounded local challenges, zero device HTTP calls, exact remedy/output assertions, and staging/state checks. No packages were acquired.

## User Setup Required

None.

## Next Phase Readiness

Ready for parent merge and combined-wave verification. Documentation can describe the exact refusal and lazy admission behavior. The parent retains corpus closeout and shared tracking ownership.

## Self-Check: PASSED

The summary and both RED records exist. Both task commits are ancestors of HEAD. All verification commands pass, no tracked files were deleted, and the protected tracking/corpus/catalog paths have no diff from the pinned base.
