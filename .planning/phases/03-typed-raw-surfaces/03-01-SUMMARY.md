---
phase: 03-typed-raw-surfaces
plan: "01"
subsystem: notifications
tags: [notification-dispatch, text-strategy, raw-surfaces, typescript]

requires:
  - phase: 01-presentation-model
    provides: resolve step, ResolvedEnvelope, notify corpus baseline
  - phase: 02-row-policies
    provides: row policies and the D-17 corpus ledger format
provides:
  - "Load-group raw kinds (reconcile-aborted, plugin-path-skipped) and usage kinds (usage-error, usage-info) outside NotificationMessage"
  - "RawSurface union, resolveRawSurface (the single cause-serialization site), ResolvedRawSurface"
  - "NotifyArguments, formatEnvelopeArguments (replaces formatNotificationText), formatRawSurface"
  - "Private deliver sink shared by the structured path and the raw-surface path; emitRawSurface and emitLoadSurface group entry"
  - "notifyReconcileAborted and notifyPluginPathSkipped, wired into index.ts inside the NFR-2 try/catch blocks"
affects: [03-02, 03-03, 03-04, 04-wire-schema, 06-origin]

actuals:
  tokens: 9155
  tasks: 2
  commits: 2
plan_head_before: 46c96bf94c0a977fe033b4375f81442dca6a5bd3
plan_head_after: d0d3e5e9f1368e49937272f9835a058fa6450d11

tech-stack:
  added: []
  patterns:
    - "Raw surface pipeline: helper builds a kind -> resolveRawSurface -> formatRawSurface -> deliver"
    - "Text strategy returns the exact notify argument tuple; the sink spreads it (D-15)"
    - "D-15 arity table typed by a mapped type over ResolvedRawSurface['kind'], so a kind without a row fails typecheck"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/index.ts
    - tests/shared/notification-types.test.ts
    - tests/shared/notification-resolve.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-dispatch.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "RawSurface was spelled as an explicit union in the tracer commit, because sonarjs/redundant-type-aliases rejects `RawSurface = LoadSurface`; Task 2 widened it to `UsageErrorSurface | UsageInfoSurface | LoadSurface`"
  - "Each task landed as one feat commit with its owner tests: the project pre-commit hook runs the full check, so a failing RED commit cannot pass it; RED was observed locally before each implementation"

patterns-established:
  - "deliver(ctx, args) is the only notify call shape in the dispatch module: ctx.ui.notify(args[0]) and ctx.ui.notify(args[0], args[1])"
  - "Raw kinds stay outside NotificationMessage and carry no run (D-01, D-04)"

requirements-completed: [RAWS-04, RAWS-01, TEXT-01]

coverage:
  - id: D1
    description: "Both load-time warnings in index.ts are typed kinds (reconcile-aborted, plugin-path-skipped) delivered through one sink inside the unchanged NFR-2 try/catch blocks"
    requirement: RAWS-04
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#notifyReconcileAborted emits the serialized cause at error severity"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#notifyPluginPathSkipped emits the skipped scope and reason at warning severity"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#resolveRawSurface"
        status: pass
      - kind: integration
        ref: "tests/index.test.ts#reports an aborted reconcile as one raw error line and still answers (NFR-2)"
        status: pass
      - kind: integration
        ref: "tests/index.test.ts#still answers when the plugin PATH warning notification is refused (NFR-2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Usage errors and help text are typed usage-error and usage-info kinds; the text strategy owns the SNM-13 separator and every caller is unchanged"
    requirement: RAWS-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface renders usage-error with its explicit severity"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface emits only the separator for an empty message and usage"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#notifyUsageError emits ${msg.message}\\n\\n${msg.usage} with 'error' severity (SNM-13)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 4e6c568a -- extensions/pi-claude-marketplace/edge (and the other raw-helper callers)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every byte and argument count is unchanged: the corpus has no missing entry and exactly the two approved dispatch-test extras, and the catalog diff is empty"
    requirement: TEXT-01
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check (plan wrapper: 3133 present, 2 approved extras)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 4e6c568a -- docs/output-catalog.md tests/index.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatEnvelopeArguments prepends the summary over the folded body"
        status: pass
    human_judgment: false

duration: 1h 17m
completed: 2026-10-02
status: complete
---

# Phase 3 Plan 01: Typed Load-Time and Usage Surfaces Summary

**The two load-time warnings and every usage error and help text are now typed raw kinds. They pass through resolveRawSurface and formatRawSurface into one private deliver sink, which the structured envelope path also uses, and the notify bytes and argument counts are unchanged.**

## Performance

- **Duration:** 1h 17m (most of it the two full-scope pre-commit runs)
- **Started:** 2026-10-02T19:37:04Z
- **Completed:** 2026-10-02T20:54:53Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- `reconcile-aborted {cause: unknown}` and `plugin-path-skipped {scope, reason}` kinds (D-13, D-14). `resolveRawSurface` is the single site where a thrown cause becomes text (`errorMessage`), and PMOD-04 redaction will land there.
- `formatEnvelopeArguments` replaces `formatNotificationText` and returns the notify argument tuple: info is one element, warning or error is two. `formatRawSurface` gives every raw kind an explicit severity, so it always returns two elements (D-15).
- A private `deliver` sink holds the only two notify spellings for both paths (D-02). `emitWithSummary` is now one `deliver` call.
- `index.ts` calls `notifyReconcileAborted(ctx, err)` and `notifyPluginPathSkipped(ctx, skip.scope, skip.reason)` inside the unchanged NFR-2 inner try/catch blocks. `tests/index.test.ts` passes without edits.
- `usage-error` and `usage-info` kinds (D-06). `notifyUsageError` and `notifyUsageInfo` build the kinds. Their signatures and all 45 call sites stay the same (D-03).

## Task Commits

1. **Task 1: Tracer: one sink carries the load-time warnings and every structured emission** - `27ed6c29` (feat)
2. **Task 2: Usage errors and help become usage-error and usage-info kinds** - `d0d3e5e9` (feat)

## Verification Evidence

Both tasks: `focused task verification passed; full phase/PR verification pending`. Each task's pre-commit run also had full scope, as described below.

- **Task 1 verify:** typecheck exit 0. `node --test` on index, types, resolve, grammar, and dispatch: 456 pass, 0 fail. Direct coverage is 100% function, line, and branch for all five pairs. `lint:type-members` exit 0 after the re-pin. Corpus wrapper exit 0. After the commit, the tracer feedback gate re-ran typecheck and the owner tests on the committed tree: 456 pass.
- **Task 2 verify:** typecheck exit 0. The `node --test` set, including help, router, and edge shared: 472 pass, 0 fail. Direct coverage is 100% for types, grammar, and dispatch. The D-03 caller diff against `4e6c568a` is empty. `lint:type-members` exit 0.
- **Corpus wrapper output (both task trees):** `Corpus: 3133 present, exactly the two approved extras`. The two extras, both in `tests/shared/notification-dispatch.test.ts`, are:
  - `"reconcile aborted: boom" (argc 2, severity error) x1`
  - `"plugin PATH not refreshed for project scope (install state unreadable): schema unsupported" (argc 2, severity warning) x1`

  There is no `missing in` line. `baseline.jsonl` and `meta.json` are untouched.
- **Full check:** reused under the `skills/local-verification` rule, not re-run. For each task, `npm run check:changed -- --list` reported `"scope": "full"`, with the commands `npm run check` and `npm run test:coverage:direct:all`. Task 2's pre-commit ran those commands on exactly the committed tree `d0d3e5e9`, on Node v26.10.0, and logged `PRECOMMIT_EXIT=0`. Nothing changed after that commit. Logs are in the session scratchpad as `precommit1.log` and `precommit2.log`.
- **Catalog:** `git diff --exit-code 4e6c568a -- docs/output-catalog.md` is empty. `tests/architecture/catalog-uat/catalog-contract.test.ts` passes 4 of 4.
- **fallow audit:** verdict `warn` with no `fail`. The six clone groups attributed as introduced are in scripts and edge handlers that this plan did not touch. Branch-base attribution assigns them to this run. Dead code: 0.

## Contract Re-pins (line only, columns unchanged)

| Entry | Field(s) | Old | New |
| --- | --- | --- | --- |
| `dispatchInfoMessage.message` | id `:43`, filter `:12` | `notification-dispatch.ts:204` | `:229` (Task 1), then `:233` (Task 2) |
| `isDescriptionBearingRow` | id `:32`, filter `:9` | `notification-grammar.ts:912` | `:914` (Task 1) |
| `ResourcesDiscoverResult.skillPaths` | origin `:11` | `index.ts:184` | `:177` (Task 1) |
| `ResourcesDiscoverResult.skillPaths` / `.promptPaths` | boundary `:9` | `index.ts:183` | `:176` (Task 1) |
| `ResourcesDiscoverResult.promptPaths` | origin `:11` | `index.ts:185` | `:178` (Task 1) |

The `index.ts:92:5` pins and the `notification-types.ts:647` pins did not move.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts`: the load-group and usage raw kinds, `LoadSurface`, and `RawSurface`, appended after `NotificationMessage`.
- `extensions/pi-claude-marketplace/shared/notification-resolve.ts`: `ResolvedReconcileAborted`, `ResolvedRawSurface`, and `resolveRawSurface`.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`: `NotifyArguments`, `formatEnvelopeArguments`, and `formatRawSurface` (four arms).
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`: the `deliver` sink, `emitRawSurface`, `emitLoadSurface`, the two load helpers, the usage helpers rebuilt as kind constructors, and a rewritten module header.
- `extensions/pi-claude-marketplace/index.ts`: the two load-time notifies now go through the new helpers. The `makeRawNotifyFn` import is gone.
- `tests/shared/*.test.ts`: the owner tests, covering the migrated envelope rows, the D-15 table, the usage edge cases, the resolve cases, the type positives and negatives, and the two dispatch cases.
- `scripts/check-unused-type-members.contracts.json`: the line re-pins listed above.

## Decisions Made

- `RawSurface` is a spelled-out union in the tracer commit (see Deviations). Task 2 turned it into the planned `UsageErrorSurface | UsageInfoSurface | LoadSurface`.
- `notifyUsageError` copies `message.message` and `message.usage` explicitly instead of spreading them, as the plan specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `RawSurface = LoadSurface` failed `sonarjs/redundant-type-aliases`**
- **Found during:** Task 1 (lint before commit)
- **Issue:** The plan's interim `RawSurface` equal to `LoadSurface` is a single-reference alias, which the production Sonar rule rejects.
- **Fix:** In the tracer commit, `RawSurface` was spelled `ReconcileAbortedSurface | PluginPathSkippedSurface`. Task 2 replaced it with the planned `UsageErrorSurface | UsageInfoSurface | LoadSurface`, so the final tree matches the plan.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-types.ts`
- **Verification:** ESLint exit 0 on the file. Typecheck and owner tests pass.
- **Committed in:** `27ed6c29`, and superseded in `d0d3e5e9`.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** No change to the final shape. The interim spelling existed only between the two task commits.

## TDD Gate Compliance

`workflow.tdd_mode` is `false`, so the RED/GREEN commit gate is advisory. Each task is one `feat(03-01)` commit that contains its owner tests. The project's mandatory pre-commit hook ran the full check for both commits, so a commit with failing tests could not pass it. The plan also requires each module's tests in the same commit. RED was observed before each implementation:

- **Task 1:** the three target test files failed to load on the missing new exports (`notifyPluginPathSkipped`, `formatEnvelopeArguments`, `resolveRawSurface`), exit 1. These functions did not exist yet, so a load failure was the only RED available.
- **Task 2:** the seven target `formatRawSurface` cases failed on their assertions (`usage-error` and `usage-info` rows and the five edge rows), and typecheck rejected the new row keys.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 03-02 can add the diagnostic and hook kinds. It needs a `formatRawSurface` arm per kind, a D-15 row per kind (the mapped type forces this), and the `undefined` no-op return together with the diagnostic kind.
- `makeRawNotifyFn` and its two corpus entries are still in place. `auth-host.ts` still uses it until 03-03.

## Self-Check: PASSED

- Files: `03-01-SUMMARY.md` and every modified source file exist.
- Commits: `27ed6c29`, `d0d3e5e9`, and `d7009faa` are in `git log --all`.
- Measured commits: `git rev-list --count 46c96bf9..d0d3e5e9` = 2 code commits.
