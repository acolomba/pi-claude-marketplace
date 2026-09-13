---
phase: 07-gate-integrity
plan: 10
subsystem: orchestrators/plugin
tags: [reinstall, dependency-injection, test-only-surface, GGAT-04]
status: complete

requires:
  - "07-01 (phase tracer slice)"
provides:
  - "ReinstallTransaction.replaceOperations — production-owned bridge-operations collaborator"
  - "replaceReinstalledPlugin(input, operations) — required second parameter, no default"
  - "Zero `__operations` members under extensions/ and tests/, so 07-13's `__`-prefix gate can ship green"
affects:
  - "07-12 (removes the two `__deps` members in the same reinstall-flow.ts)"
  - "07-13 (the no-test-only-production-surface gate that fires on `__`-prefixed members)"
  - "07-15 (unowned-export census — see the export delta recorded below)"

tech-stack:
  added: []
  patterns:
    - "Named-`typeof` collaborator record enrolled in the flow's existing production transaction (the reinstall-flow.ts ReinstallFlowOwners idiom)"
    - "Required, never-defaulted collaborator parameter (D-05-01)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - tests/orchestrators/plugin/reinstall-replace.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts

key-decisions:
  - "REAL_REINSTALL_REPLACE_OPERATIONS stays module-private; every consumer reaches it through REAL_REINSTALL_TRANSACTION.replaceOperations, so no new export enlarges the 07-15 census."
  - "REAL_REINSTALL_TRANSACTION moved below REAL_REINSTALL_REPLACE_OPERATIONS: a const referencing a const in the same module scope is a temporal-dead-zone error the previous function-only composition did not have."
  - "Tasks 1 and 2 landed in one commit. Six executors share this working tree and a broken intermediate typecheck would fail every sibling's whole-repo pre-commit hook."

requirements-completed: [GGAT-04]

coverage:
  - deliverable: "ReinstallTransaction owns the physical bridge operations as replaceOperations"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall-replace.test.ts#exports the atomic reinstall replacement owner"
        status: pass
      - kind: command
        ref: "npm run typecheck"
        status: pass
  - deliverable: "replaceReinstalledPlugin takes its operations as a required second parameter with no default"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx tsc --noEmit with the argument temporarily removed at reinstall-flow.ts:730 — error TS2554"
        status: pass
      - kind: command
        ref: "git grep -n '__operations' -- . ':!.planning' → no matches"
        status: pass
  - deliverable: "Reinstall behaviour, ordering, compensation, and notifications unchanged"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall-replace.test.ts#replaces, rolls back, and finalizes every bridge in atomic order"
        status: pass
      - kind: command
        ref: "npm run check"
        status: pass
      - kind: command
        ref: "npm run test:integration (32 cases, 0 fail)"
        status: pass
  - deliverable: "Both owner modules keep complete direct-pair coverage"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm run test:coverage:direct -- .../reinstall-replace.ts (branches 46/46, functions 16/16, lines 490/490)"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../reinstall-flow.ts (branches 100/100, functions 18/18, lines 902/902)"
        status: pass

metrics:
  duration: "48 min"
  completed: 2026-09-10

actuals:
  tokens: 90971
  tasks: 3
  commits: 1
  plan_head_before: f25c8b5fc6bb5e186a687645200feb2aea99b2d2
---

# Phase 07 Plan 10: Remove `__operations` Summary

The physical bridge-operations record is now a required, production-owned collaborator on
`ReinstallTransaction`, so the reinstall replacement schedule and its compensation reach the same
owner and no input shape can swap which bridges run.

## Accomplishments

- **`ReinstallTransaction` gained `replaceOperations: ReinstallReplaceOperations`**, bound in
  `REAL_REINSTALL_TRANSACTION` to the module-private `REAL_REINSTALL_REPLACE_OPERATIONS`. The
  transaction was already the production seam `reinstall-flow.ts` takes as an explicit parameter;
  the 22-member bridge record was the one member of the schedule never enrolled in it.
- **`replaceReinstalledPlugin(input, operations)`** now takes the operations as a required second
  parameter with no default. `ReplaceReinstalledPluginInput.__operations` and the
  `input.__operations ?? REAL_REINSTALL_REPLACE_OPERATIONS` read are gone.
- **`ReinstallReplacement.operations` survives** as the compensation ledger's own field —
  `rollbackReinstalledPlugin` and `finalizeReinstalledPlugin` read it — and lost only its
  `@internal` tag.
- **Both owner tests reach the real operations through the transaction.**
  `reinstall-replace.test.ts` passes its double as the second argument;
  `reinstall-flow.test.ts`'s `reinstallTransactionWith` collapsed from a
  `replaceReinstalledPlugin` wrapper to a spread of the real transaction with `replaceOperations`
  substituted.

## Observed Compile Error for the Omitted Argument

Removing `transaction.replaceOperations` from the production call site and running
`npx tsc --noEmit` produced, verbatim:

```
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts(730,41): error TS2554: Expected 2 arguments, but got 1.
```

The argument was restored immediately; the committed tree carries it at `reinstall-flow.ts:741`
(the line moved because the call was reformatted across two arguments).

## `@internal` Count Change

| | Before | After |
|---|---|---|
| `grep -c "@internal" .../reinstall-replace.ts` | 2 | **0** |

Both tags were test-facing and both go: one lived on the deleted `__operations` member, the other
on `ReinstallReplacement.operations`, whose tag the plan's action instruction explicitly directs
to drop. The plan's acceptance criterion says the count should fall by exactly one; that arithmetic
assumed only one removal and is inconsistent with the same task's action text. The action text was
followed. **No deviation from intent — an arithmetic slip in the criterion, recorded here so a
later reader does not treat `0` as an over-removal.**

## Assertion Counts, Before and After

Measured with identical commands over `git show HEAD:<file>` (before) and the working tree (after).
Neither count decreased anywhere.

### `tests/orchestrators/plugin/reinstall-replace.test.ts`

| Metric | Command | Before | After |
|---|---|---|---|
| Cases | `grep -c '^test('` | 10 | 10 |
| Ordering assertions | `grep -cE 'assert\.(deepStrictEqual\|ok)\((calls\|schedule)'` | 7 | 7 |
| Invocation-count assertions | `grep -cE 'assert\.[a-zA-Z]+\([^)]*\.length'` | 0 | 0 |
| Fault-injection sites | `grep -cE 'assert\.rejects\|Promise\.reject\|throw new Error'` | 9 | 9 |
| Module-scope operations fixture | `grep -c '^const .*Operations'` | 0 | 0 |

### `tests/orchestrators/plugin/reinstall-flow.test.ts`

| Metric | Command | Before | After |
|---|---|---|---|
| Cases | `grep -c '^test('` | 112 | 112 |
| Ordering assertions | `grep -cE 'assert\.deepStrictEqual\((firstSchedule\|secondSchedule)'` | 26 | 26 |
| Invocation-count assertions | `grep -cE 'assert\.[a-zA-Z]+\([^)]*\.length'` | 38 | 38 |
| Fault-injection sites | `grep -cE 'assert\.rejects\|Promise\.reject\|throw new Error'` | 19 | 19 |
| `createRetryReinstall` sites | `grep -c 'createRetryReinstall('` | 13 | 13 |
| `observeReinstallOperations` sites | `grep -c 'observeReinstallOperations('` | 4 | 4 |
| Total `assert.*` calls | `grep -c 'assert\.'` | 636 | 636 |

The 17-entry atomic-order pin, the four abort-in-reverse-order slices, and the 26 retry-proof
schedule pins all survive the move verbatim. Nothing became an end-state assertion.

One test title changed: `"normalizes a default bridge preparation failure"` →
`"normalizes a real bridge preparation failure"`. That case previously reached the real record by
*omitting* `__operations`; it now passes `REAL_REINSTALL_TRANSACTION.replaceOperations`
explicitly, and "default" no longer describes anything in the code.

## Runtime-State Confirmation

No persisted record, service configuration, npm script, CI job, or pre-commit hook names the
removed member.

| Surface | Check | Result |
|---|---|---|
| Repository source | `git grep -n "__operations" -- . ':!.planning'` | no matches |
| npm scripts | `grep -c "__operations" package.json` | 0 |
| CI workflows | `grep -rn "__operations" .github` | none |
| Pre-commit hooks | `grep -rn "__operations" .pre-commit-config.yaml` | none |
| Serialization | `ReinstallReplaceOperations` is an in-memory record of 22 functions held on `ReinstallTransaction` and `ReinstallReplacement`; no `JSON.stringify` / atomic-write path reaches it | never serialized |

The remaining `__operations` hits in the tree are all inside `.planning/` — the plan, research,
patterns, context, and roadmap documents that specify this removal. They are not source.

## Export Census Delta (for 07-15)

**No export was added and none was removed.** `reinstall-replace.ts` carries the same 12 exported
symbols before and after. `replaceOperations` is a new *member* of the already-exported
`ReinstallTransaction` interface, not a new export, and `REAL_REINSTALL_REPLACE_OPERATIONS` stayed
module-private (research proposed exporting it; the plan overrode that, and this SUMMARY records
the override so 07-15 does not look for the export).

Line numbers moved, because `REAL_REINSTALL_TRANSACTION` had to relocate below
`REAL_REINSTALL_REPLACE_OPERATIONS` to avoid a temporal-dead-zone reference. The four
production-unowned exports the research census pinned in this file shifted as follows:

| Export | Census line | Current line |
|---|---|---|
| `replaceReinstalledPlugin` | 189 | 193 |
| `rollbackReinstalledPlugin` | 216 | 220 |
| `finalizeReinstalledPlugin` | 223 | 227 |
| `runPostSuccessMaintenance` | 230 | 234 |

Full current export map: `RemoveDataDirFn`:55, `ReinstallPreparedHandles`:61,
`ReinstallReplacement`:82, `ReplaceReinstalledPluginInput`:94, `ReinstallReplaceOperations`:106,
`ReinstallMaintenanceInput`:132, `ReinstallTransaction`:140, `REAL_REINSTALL_TRANSACTION`:179,
`replaceReinstalledPlugin`:193, `rollbackReinstalledPlugin`:220, `finalizeReinstalledPlugin`:227,
`runPostSuccessMaintenance`:234.

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `node --test` both owner suites | 125 tests, 0 fail |
| `npx eslint` on both production files and `tests/orchestrators/plugin` `--max-warnings=0` | exit 0 |
| `npx fallow health --fail-on-issues --format human` | exit 0, 0 above threshold |
| `npm run test:coverage:direct -- .../reinstall-replace.ts` | pass — branches 46/46, functions 16/16, lines 490/490 |
| `npm run test:coverage:direct -- .../reinstall-flow.ts` | pass — branches 100/100, functions 18/18, lines 902/902 |
| `node --test tests/architecture/{hooks-lifecycle,no-orchestrator-network}.test.ts` | 11 tests, 0 fail |
| `npm test` | 5903 tests, 0 fail |
| `npm run test:integration` | 32 tests, 0 fail |
| `npm run check` | exit 0 |

Integration case count is 32 before and after. This plan touched zero files under
`tests/integration/` (`git diff --name-only 73209a94~1 73209a94 -- tests/integration` → 0 files),
so the count is unchanged by construction as well as by measurement.

## Deviations from Plan

### 1. [Rule 3 - Blocker] Tasks 1 and 2 committed together

- **Found during:** Task 1
- **Issue:** Task 1 changes `replaceReinstalledPlugin`'s arity; Task 2 migrates the two test files
  that call it. Committing Task 1 alone leaves six `error TS2554` failures in `tests/`. Six
  executors share this one working tree, and their pre-commit `npm-typecheck` hook is
  `pass_filenames: false` — a broken intermediate commit would fail every sibling's commit and
  they could not fix it, because the offending file is not theirs. Task 1's own `<verify>` block
  also runs both owner suites, which cannot pass until Task 2's migration lands, so the plan
  already implies the two tasks are one atomic change.
- **Fix:** Both tasks landed in commit `73209a94`. Task 3 produced no code change and therefore no
  commit of its own.
- **Files modified:** all four declared files
- **Verification:** `npm run check` exit 0
- **Commit:** `73209a94`

### 2. [Rule 3 - Blocker] `REAL_REINSTALL_TRANSACTION` relocated below `REAL_REINSTALL_REPLACE_OPERATIONS`

- **Found during:** Task 1
- **Issue:** `REAL_REINSTALL_TRANSACTION` was declared at `:151` and
  `REAL_REINSTALL_REPLACE_OPERATIONS` at `:158`. The transaction previously referenced only
  hoisted function declarations, so the order was harmless; adding
  `replaceOperations: REAL_REINSTALL_REPLACE_OPERATIONS` makes it a `const`-before-`const`
  reference and a temporal-dead-zone `ReferenceError` at module evaluation.
- **Fix:** Moved the `REAL_REINSTALL_TRANSACTION` declaration (and its doc comment) below the
  operations record. No content change to either declaration beyond the added member.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts`
- **Verification:** `npm test` (5903 pass) — the module is imported at load by every reinstall
  test, so a TDZ error would surface immediately.
- **Commit:** `73209a94`

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues). **Impact:** none on behaviour.
Both are structural consequences of the required change; no production operation order, rollback
sequence, state byte, or notification changed.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The change removes a substitution point (`T-07-27`) and introduces no new network endpoint,
auth path, file-access pattern, or schema at a trust boundary.

## Sibling Noise Encountered

`npm test` and `npm run check` each failed once against
`tests/bridges/hooks/dispatch.test.ts` (`error TS2352`, and an `ERR_ASSERTION` at `:2242`) while a
concurrent executor was mid-edit on that file. Neither failure named a file this plan owns. Both
cleared on re-run without any edit from this executor; the final `npm run check` exits 0.

## Issues Encountered

None.

## Next Phase Readiness

`__operations` is gone from source, so `07-13`'s `__`-prefix gate has one fewer offender to trip
on. `07-12` still owns the two `__deps` members in `reinstall-flow.ts:138,151` — this plan
deliberately changed nothing else in that file, so `07-12`'s behaviour regressions stay
attributable. Ready for `07-11`.

## Self-Check: PASSED

All five declared files exist on disk. Both commits (`73209a94`, `7ead6d6f`) resolve in
`git log --all`. `.planning/STATE.md` and `.planning/ROADMAP.md` carry no commit from this plan.
