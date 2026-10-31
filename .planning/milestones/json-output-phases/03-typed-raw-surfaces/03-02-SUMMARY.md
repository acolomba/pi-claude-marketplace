---
phase: 03-typed-raw-surfaces
plan: "02"
subsystem: notifications
tags: [notification-dispatch, text-strategy, raw-surfaces, hooks, typescript]

requires:
  - phase: 03-typed-raw-surfaces
    provides: "03-01: RawSurface, resolveRawSurface, formatRawSurface, the private deliver sink, emitRawSurface, the D-15 arity table"
provides:
  - "DiagnosticSurface {header, lines}: a raw kind in no fixed-origin group (RAWS-02, D-05, D-14)"
  - "AsyncRewakeSummarySurface {summary}, StopOverrideCapSurface {pluginId, cap}, and their HookSurface group (RAWS-05, D-07, D-08, D-14)"
  - "formatRawSurface returns NotifyArguments | undefined; undefined only for a zero-length diagnostic line list or rewake summary (D-15 no-op seam)"
  - "deliver accepts undefined and makes no call; private emitHookSurface entry beside emitLoadSurface"
  - "notifyStopHookOverrideCap(ctx, pluginId, cap) and the exported STOP_OVERRIDE_CAP in bridges/hooks/runtime.ts"
affects: [03-03, 03-04, 05-mode-sink, 06-origin]

actuals:
  tokens: 6231
  tasks: 2
  commits: 2
plan_head_before: f2da7c776c23d5dcb481ef362062f4210be0394c
plan_head_after: 5cd51312367e92dd60e71c64c54e509705a2cbdd

tech-stack:
  added: []
  patterns:
    - "A raw kind whose text can be empty returns undefined from the text strategy; the sink skips it, so the helper holds no empty check"
    - "Fixed-origin groups (LoadSurface, HookSurface) each have one private emit entry in the dispatch module"
    - "A number the warning states comes from the bridge constant the trip logic compares against, passed as data"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - tests/shared/notification-types.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/hooks-cap-notify.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "The new edge rows join the existing formatRawSurface edge loop, whose expected type widens to NotifyArguments | undefined, instead of a third copy of the loop body (one test() per row, no new clone)"
  - "settle.ts moves its runtime import from the type block into the sibling value block as the inline mixed import, as import-x/order requires for a value import"

patterns-established:
  - "deliver(ctx, args) with args === undefined is the only no-emission path for raw surfaces"

requirements-completed: [RAWS-02, RAWS-05, TEXT-01]

coverage:
  - id: D1
    description: "Diagnostics are the diagnostic kind; the text strategy owns the header and line joins and the zero-length no-op, and the three producers are unchanged"
    requirement: RAWS-02
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface renders diagnostic with its explicit severity"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface emits nothing for a diagnostic with zero lines"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface keeps duplicate and empty diagnostic lines in caller order"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#diagnostic dispatch preserves empty and ordered warning captures"
        status: pass
      - kind: other
        ref: "git diff --exit-code 4e6c568a -- the three diagnostic producers"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rewake summaries and the Stop cap warning are HookSurface kinds; the cap number comes from STOP_OVERRIDE_CAP in the hooks runtime and the shared layer holds no cap literal"
    requirement: RAWS-05
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface states the stop-override cap it is given"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface returns a whitespace-padded async-rewake summary verbatim"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-cap-notify.test.ts#STOP-07 / D-88-01: cap-trip output is byte-equal to the docs/output-catalog.md `stop-override-cap` block"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts (cap byte assertion, unchanged)"
        status: pass
      - kind: other
        ref: "! git grep -n -e 'blocked 8 times' -e 'STOP_OVERRIDE_CAP = ' -- extensions/pi-claude-marketplace/shared"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bytes and argument counts are unchanged: the corpus has no missing entry and exactly the two 03-01 extras, and the catalog diff is empty"
    requirement: TEXT-01
    verification:
      - kind: other
        ref: "03-01 corpus wrapper over node scripts/notify-corpus.mjs check (3133 present, 2 approved extras)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 4e6c568a -- docs/output-catalog.md tests/index.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 1h 15m
completed: 2026-10-02
status: complete
---

# Phase 3 Plan 02: Typed Diagnostic and Hook Surfaces Summary

**Diagnostics, async-rewake summaries, and the Stop-hook override-cap warning are now typed raw kinds. The text strategy owns their joins and the two empty no-ops, the sink skips `undefined`, and the cap number reaches the warning as data from `STOP_OVERRIDE_CAP` in the hooks runtime. Bytes, argument counts, and every caller outside settle are unchanged.**

## Performance

- **Duration:** 1h 15m (most of it the two full-scope pre-commit runs)
- **Started:** 2026-10-02T21:53:12Z
- **Completed:** 2026-10-02T23:08:11Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- `diagnostic {header, lines}` kind (RAWS-02, D-05). `formatRawSurface` returns `undefined` for a zero-length line list and otherwise the header, one blank line, and the lines joined by `\n`, at warning. `notifyDiagnostic` keeps its signature (D-03) and makes one `emitRawSurface(ctx, {` call. The three producers and their `redactAbsolutePaths` calls are untouched.
- `deliver(ctx, args: NotifyArguments | undefined)` returns early on `undefined` (D-15). The two notify spellings are unchanged.
- `AsyncRewakeSummarySurface`, `StopOverrideCapSurface`, and `HookSurface` (D-14), with the private `emitHookSurface` entry beside `emitLoadSurface`. The rewake arm keeps whitespace-only summaries and emits nothing only for a zero-length one (D-08). The cap arm interpolates `${surface.cap}` (D-07).
- `export const STOP_OVERRIDE_CAP = 8;` in `bridges/hooks/runtime.ts`. `settle.ts` calls `notifyStopHookOverrideCap(ctx, pluginId, STOP_OVERRIDE_CAP)`. `hooks-cap-notify` passes the same constant, so the catalog block pins the production number.

## Task Commits

1. **Task 1: Diagnostics become a diagnostic kind with the empty no-op in the text strategy** - `1543abd2` (feat)
2. **Task 2: Hook summaries and the Stop cap warning become hook kinds carrying the bridge's cap** - `5cd51312` (feat)

## Verification Evidence

Both tasks: `focused task verification passed; full phase/PR verification pending`. Each task's pre-commit also had full scope, as described below.

- **Task 1 verify:** typecheck exit 0. `node --test` on types, grammar, dispatch, import execute, plugin shared, and reconcile apply: 623 pass, 0 fail. Direct coverage 100% function, line, and branch for types, grammar, and dispatch (dispatch 53/53 branches, including the `undefined` branch of `deliver`). `lint:type-members` exit 0 after the re-pin. The producer diff against `4e6c568a` is empty. The dispatch test file has no diff in Task 1. `notifyDiagnostic` shows a single `emitRawSurface(ctx, {` call.
- **Task 2 verify:** typecheck exit 0. `node --test` on types, grammar, dispatch, hooks-cap-notify, hooks-async-rewake, settle, runtime, and the async-rewake registry: 463 pass, 0 fail. ESLint exit 0 on the ten files. Direct coverage 100% for types, grammar, dispatch, runtime, and settle. The negative grep over `shared/` prints nothing. Both acceptance greps print one line each (`settle.ts:378`, `runtime.ts:12`). The diff of `async-rewake/registry.ts`, `tests/bridges/hooks/settle.test.ts`, and `docs/output-catalog.md` against `4e6c568a` is empty. `lint:type-members` exit 0 after the re-pin.
- **Corpus wrapper output (both task trees):** `Corpus: 3133 present, exactly the two approved extras`. These are the two 03-01 extras in `tests/shared/notification-dispatch.test.ts`: `"reconcile aborted: boom"` (argc 2, error) and `"plugin PATH not refreshed for project scope (install state unreadable): schema unsupported"` (argc 2, warning). There is no `missing in` line. `baseline.jsonl` and `meta.json` are untouched.
- **Full check:** reused under the `skills/local-verification` rule, not re-run. For each task, `npm run check:changed -- --list` reported `"scope": "full"` with the commands `npm run check` and `npm run test:coverage:direct:all`. `npm run check:changed -- --base f2da7c77 --list` reports the same commands for the whole plan. Task 2's pre-commit ran those commands on exactly the committed tree `5cd51312`, on Node v26.10.0, and logged `PRECOMMIT_EXIT=0`. The working tree was clean after the commit. Logs are in the session scratchpad as `pc-0302-t1.log` and `pc-0302-t2.log`.
- **Catalog:** `git diff --exit-code 4e6c568a -- docs/output-catalog.md tests/index.test.ts` is empty. `tests/architecture/catalog-uat/catalog-contract.test.ts` passes 4 of 4.
- **D-03:** the 03-01 Task 2 caller diff (`edge`, the three producers, and `async-rewake/registry.ts` against `4e6c568a`) prints nothing.
- **fallow audit:** verdict `warn` with no `fail` for both tasks. Dead code 0, complexity 0. The 6 introduced clone groups are the branch-base attributions 03-01 recorded, in files this plan did not touch. Task 2 adds one inherited group: the pre-existing `routing-state.ts`/`runtime.ts` interface clone, which counts because `runtime.ts` is now touched.

## Contract Re-pins (line only, columns unchanged)

| Entry | Field(s) | Old | New |
| --- | --- | --- | --- |
| `dispatchInfoMessage.message` | id `:43`, filter `:12` | `notification-dispatch.ts:233` | `:236` (Task 1), then `:234` (Task 2) |

The `notification-grammar.ts:914` and `notification-types.ts:647` pins did not move, because all type and grammar additions land after them.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts`: `DiagnosticSurface`, `AsyncRewakeSummarySurface`, `StopOverrideCapSurface`, `HookSurface`, and the widened `RawSurface`.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`: the diagnostic, rewake, and cap arms of `formatRawSurface` and its `NotifyArguments | undefined` return.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`: `deliver` skips `undefined`; the private `emitHookSurface`; the three helpers rebuilt as kind constructors, with present-tense JSDoc and no duplicated-cap rationale.
- `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts`: `STOP_OVERRIDE_CAP` exported with a STOP-07 JSDoc. The value stays 8.
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`: the inline mixed import and the cap argument. Nothing else changed.
- `tests/shared/notification-grammar.test.ts`: three D-15 rows and seven edge rows (zero, single, and duplicate/empty diagnostic lines; empty and whitespace-padded summaries; cap 3; a backtick in the plugin id).
- `tests/shared/notification-types.test.ts`: positives for the three kinds and `HookSurface`. Negatives: lines as a pre-joined string, a hook surface as a `LoadSurface`, and a text cap.
- `tests/shared/notification-dispatch.test.ts`: the stop-override case passes `8`. The expected bytes are unchanged.
- `tests/architecture/hooks-cap-notify.test.ts`: imports `STOP_OVERRIDE_CAP` and passes it in all three cases.
- `scripts/check-unused-type-members.contracts.json`: the line re-pin above.

## Decisions Made

- The new edge rows extend the existing `formatRawSurface` edge loop. Its expected type widens to `NotifyArguments | undefined`. Each row is still its own `test()`, and no third copy of the loop body is added for the duplication gate to report.
- `settle.ts` moves the runtime import into the sibling value group, because a value import cannot stay in the type block under `import-x/order`.

## Deviations from Plan

None - plan executed exactly as written. The two choices above are within the plan's latitude.

## TDD Gate Compliance

`workflow.tdd_mode` is `false`, so the RED/GREEN commit gate is advisory. Each task is one `feat(03-02)` commit that contains its owner tests, as in 03-01. The project's pre-commit hook ran the full check on each commit, so a commit with failing tests could not pass it. RED was observed before each implementation:

- **Task 1:** three target grammar cases failed on their assertions (the D-15 `diagnostic` row, the single-line row, and the duplicate/empty row), exit 1. The zero-lines row passed vacuously, because a switch with no `diagnostic` arm already returned `undefined`.
- **Task 2:** five target grammar cases failed on their assertions (both D-15 rows, the whitespace summary, cap 3, and the backtick id). `hooks-cap-notify.test.ts` failed to load because `STOP_OVERRIDE_CAP` was not exported yet. The empty-summary row passed vacuously for the same reason as above.

## Issues Encountered

- Prettier split the Task 1 `@ts-expect-error` negative across lines, which moved the error off the directive's line. The directive now sits on the `lines` property, as the file's other multi-line negatives do.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Every raw surface except the device-flow prompt is a typed kind. 03-03 can add `device-flow-prompt`, retarget AUTH-09, and delete `makeRawNotifyFn`. Its two corpus entries and the two notify spellings at the end of `notification-dispatch.ts` are still in place.
- The empty no-op seam lives in the text strategy. Phase 5's JSON strategy needs the same rule (03-RESEARCH open question 2).

## Self-Check: PASSED

- Files: `03-02-SUMMARY.md` and every modified source file exist.
- Commits: `1543abd2` and `5cd51312` are in `git log --all`.
- Measured commits: `git rev-list --count f2da7c77..5cd51312` = 2 code commits.
