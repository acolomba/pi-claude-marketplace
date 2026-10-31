---
phase: 07-git-errors-and-lock-discipline
plan: 03
subsystem: plugin-update-swap
tags: [update, reinstall, converge, st-9, concurrency, intent-mark]
status: complete
requirements-completed: [GLK-06]

requires: []
provides:
  - "nextUpdateStamp(previous): module-private strictly increasing updatedAt stamp in update-swap.ts (D-PL7-08)"
  - "markUpdateInProgress and finalizeUpdateRecord both write nextUpdateStamp(sRecord.updatedAt), so two marks of one millisecond differ and ST-9 refuses the rival"
affects: [update-flow, reinstall-flow, materialize-latest, dependency-move, operations]

actuals:
  tokens: 3800
  tasks: 2
  commits: 3
plan_head_before: 4f755a65920a741236acb73bdfbfc3e3429a5c4a
plan_head_after: 3d27db0299df95f46017e0d8a0e91fd2f4e5df1b

tech-stack:
  added: []
  patterns:
    - "Strictly increasing ISO stamp: max(now, Date.parse(previous) + 1), now when previous does not parse"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/dependency-move.test.ts
    - test/orchestrators/plugin/operations.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts

decisions:
  - "The unparseable-stamp case landed with Task 1: the commit hook needs 100% branch coverage of update-swap.ts, and the Number.isNaN branch exists from Task 1 on."
  - "The 07-02 prune lock-count regression in operations.test.ts was fixed in its own commit, because the hook runs that staged test; the same regression in register.test.ts (unlisted) is deferred."

metrics:
  duration: "~35 min"
  completed: 2026-10-27
---

# Phase 07 Plan 03: Strictly Increasing Update Stamp Summary

The update intent mark and the finalize now write `updatedAt` as `max(now, previous + 1 ms)` (now when `previous` does not parse). So two runs in the same millisecond never share a stamp, and ST-9 refuses the rival with `PluginUpdateConcurrencyError { kind: plugin-updated, lifecycle: intent }` (GLK-06, D-PL7-08).

## What changed

- `update-swap.ts`: new module-private `nextUpdateStamp(previous)`. `markUpdateInProgress` and `finalizeUpdateRecord` both write `sRecord.updatedAt = nextUpdateStamp(sRecord.updatedAt)` under their `withStateGuard`. The JSDoc for both says the stamp is strictly later. There is no schema field and no migration, and nothing displays `updatedAt`.
- `update-swap.test.ts`: three GLK-06 cases.
  - Same-millisecond overlap: Date is frozen at the seeded instant `2026-01-01T00:00:00.000Z`. The first same-revision swap marks, writing `.001Z`, and its finalize save is refused. The second swap, prepared before that mark, rejects with the class and fields `{ kind: "plugin-updated", plugin: "hello", marketplace: "mp", lifecycle: "intent" }`. state.json stays byte-equal to the marked state.
  - Unparseable stamp: the seed is `"not a date"`, Date is frozen at `2026-01-03T00:00:00.000Z`, and the mark writes `2026-01-03T00:00:00.000Z`.
  - Finalize after mark: Date is frozen at `2026-01-02T00:00:00.000Z` over a `2026-01-01` seed. A successful swap leaves `2026-01-02T00:00:00.001Z`.
  - The new helpers `SAME_REVISION_POLICY`, `refuseFinalizeSave()`, and `seedSameRevisionUpdate()` are shared with the existing ST-9 overlap test, which used to inline the same policy and save double.
- Stamp literals the rule moves. The mark adds one millisecond and the finalize one more when the record is seeded at the frozen instant.
  - `update-swap.test.ts`: `assertAgentsMigrated` and D-18-15 now pin `2026-01-02T00:00:00.001Z`.
  - `materialize-latest.test.ts`: both cases now pin `.001Z`.
  - `dependency-move.test.ts`: now pins `.001Z`.
  - `operations.test.ts` reinstall case: now pins `2026-01-01T00:00:00.002Z`. The converge case pins no stamp, so it needed no change.
  - `reinstall-flow.test.ts` AGENT-01 same-version reinstall (out-of-line): the first reinstall now pins `.002Z` and the repeat pins `.004Z`, through a local `migratedState(updatedAt)`.

## Commits

| Commit | Message |
|--------|---------|
| 192dedb0 | fix(update): stamp the intent mark strictly later than its read |
| 6071a677 | test(prune): count the clone cleanup's scope lock |
| 3d27db02 | fix(update): stamp the finalize strictly later than the intent mark |

## Verification

| Check | Result |
|-------|--------|
| `node --test --test-name-pattern 'GLK-06' test/orchestrators/plugin/update-swap.test.ts` | exit 0, 2 tests pass (after Task 1; 3 with Task 2) |
| `node --test test/orchestrators/plugin/update-swap.test.ts` | exit 0 |
| `node --test` update-swap, materialize-latest, dependency-move, operations, reinstall-flow, update-flow | 733 tests. Before 6071a677: 731 pass, and the 2 composed prune cases fail at HEAD. After it, `operations.test.ts` passes 18/18 |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` | exit 0 (100% lines, functions, branches) |
| `npm run test:modules` | exit 1. Only the 2 deferred prune cases in `test/edge/register.test.ts` fail (and their parent `registerClaudePluginCommand` suite). Both are 07-02 lock-count pins (see Deferred Issues) |
| `npm run fallow` | exit 0 |
| `npm run typecheck` | exit 0 |
| commit hook `npm run check:commit` | passed on all three commits. The first attempt of each task commit failed: Task 1 on update-swap.ts branches 154/155, Task 2 on the prune cases in operations.test.ts. Both were fixed and committed again, with no amend |

Fails-without checks, run locally and then restored:

- With the mark line set back to `new Date().toISOString()`, the same-millisecond case fails. The stamp assertion reads `actual '2026-01-01T00:00:00.000Z'` against `expected '...001Z'`. With that assertion disabled, the rejection assertion fails on its own with `Missing expected rejection`.
- With the finalize line set back to the wall clock, the finalize-after-mark case fails with `actual '2026-01-02T00:00:00.000Z'` against `expected '...001Z'`.

Acceptance greps: `function nextUpdateStamp` 1, `updatedAt = nextUpdateStamp(` 2, `new Date().toISOString()` 0.

No cucumber scenario was added. A one-millisecond race is not deterministic in cucumber (07-CONTEXT "Tests"), and nothing user-visible changes.

## Deviations

- **[Rule 3 - Blocking] The unparseable-stamp case moved to Task 1.** Task 1's commit hook rejected update-swap.ts at 154/155 branches, because the `Number.isNaN` arm exists as soon as `nextUpdateStamp` does. I added case (b) to the Task 1 commit. It needs only the mark change.
- **[Rule 3 - Blocking] Prune lock count in operations.test.ts (commit 6071a677).** Since 07-02, the composed prune operation takes `lockfile.lock` twice: the state guard, then `collectPluginClonesLocked` -> `withExistingScopeLock`. Its two cases still pinned 1 and failed at HEAD. The hook runs a staged test file, so Task 2's commit could not land. I restored the file to HEAD, changed both pins to 2 with a comment naming both locks, and committed that alone. Then I reapplied the stamp pin. My change did not cause this failure.
- **Shared test helpers.** The existing ST-9 overlap test now uses `SAME_REVISION_POLICY` and `refuseFinalizeSave()`. Its assertions are unchanged.

## Out-of-line edits

- `test/orchestrators/plugin/reinstall-flow.test.ts`: the AGENT-01 same-version reinstall case pins the record's `updatedAt` through the whole state. It failed only on the moved stamp, so the plan's rule for an unlisted stamp pin applies. The `>` comparison near line 8290 needed no edit.

## Deferred Issues

- `test/edge/register.test.ts` near line 1851: "registered prune removes one orphan only from user scope" and "registered prune --scope project removes one orphan only from project scope" pin one `lockfile.lock` call, and the locked clone cleanup from 07-02 makes it two. `npm run test:modules`, and so the wave gate's `npm run check`, fails here until the pins read 2. This plan does not list the file, so I left it. It is in `deferred-items.md` and in WINDOWS.md (kind `deviation`).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts (`function nextUpdateStamp`, two call sites)
- FOUND: 192dedb0, 6071a677, 3d27db02 (ancestors of HEAD)
