---
phase: 05-production-export-ownership
plan: "26"
subsystem: testing
tags: [typescript, node-test, fallow, hooks, payload-translators, dispatch]

# Dependency graph
requires:
  - phase: 05-production-export-ownership
    provides: "05-24's per-event translator export-name table, extended by 05-25 and by this plan to its two events"
  - phase: 05-production-export-ownership
    provides: "05-05 hook dispatch/registry seam work this plan's two consumers sit on"
provides:
  - "translatePreCompact and translatePostCompact as the two compaction payload modules' own public export names"
  - "Both dispatch modes importing those names directly instead of aliasing a shared `translate` at each call site"
  - "A translator gate whose per-event export table now pins eight event-specific names, proved to fire on a rename in either direction"
  - "Measured production census delta: the translate duplicate-export group shrinks from four members to two; total_issues stays 14"
affects: [05-27, 05-28, wave-7-reconciliation]

# Actuals (#2632)
actuals:
  tasks: 2
  # MEASURED: `git rev-list --count 507240f7..HEAD` read 2 immediately after the
  # two task commits, before this summary's own metadata commit. That is the
  # task-commit count, the same convention 05-24 and 05-25 used; the metadata
  # commit that carries this file is listed under `## Task Commits`, so a later
  # `rev-list` legitimately reads higher.
  commits: 2
  plan_head_before: 507240f7747e53d547ffd7bdf30f502aea4737b4
  # tokens: deliberately omitted. Actual token telemetry is unavailable in this
  # environment and the user decision on record forbids reporting diff
  # characters divided by four as an actual. See 05-CONTEXT.md / handoff.

tech-stack:
  added: []
  patterns:
    - "An export whose every consumer already aliases it to the same name takes that name itself, so the identity lives in the module instead of being re-supplied at each import"
    - "The per-event export-name pin travels with the rename in the same commit, so every commit in the sequence leaves the translator gate green rather than deferring the repair to a trailing fix"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/bridges/hooks/payloads/pre-compact.test.ts
    - tests/bridges/hooks/payloads/post-compact.test.ts
    - tests/architecture/hooks-translators.test.ts

key-decisions:
  - "Rename the export rather than add a duplicate-export exemption. Both production consumers already aliased `translate` to the event-specific name at import, so the name was already the real contract and only the declaration lagged."
  - "Update the gate's per-event export-name entry inside the same task commit as the rename that invalidates it. Each of the two commits therefore leaves the translator gate green, and no commit in the sequence ships a red suite."
  - "Observe a real RED before each rename's consumers were updated. Renaming the production export alone was run against the owner test, both dispatch suites and the translator gate; both times 4 of 5 files failed and the gate reported that event's entry as `exportType: 'undefined'`."
  - "Report the planted-offender controls as 1 pass / 1 fail rather than borrowing 05-24's 0 pass / 2 fail. The gate's second test exercises only the three tool translators, so a rename of a non-tool event cannot reach it; claiming two failures would overstate the control."
  - "Leave the shared census pin in tests/architecture/gate-targets.ts untouched. The plan assigns the single pin edit to the parent wave reconciliation, so the two pin-equality gates stay red by design until the parent reconciles."

patterns-established:
  - "Take a planted-offender measurement in both directions and then restore by SHA-256 comparison, so a control cannot leave residue in the committed tree"
  - "Difference the whole projected identity set before and after, rather than comparing finding counts, so a membership change inside a duplicate group with an unchanged count is still visible"

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "The PreCompact payload module publishes translatePreCompact, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/pre-compact.test.ts#maps the manual reason to the manual PreCompact trigger"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/pre-compact.test.ts#preserves empty context strings in the complete PreCompact envelope"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/pre-compact.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (80/80)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The PostCompact payload module publishes translatePostCompact, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-compact.test.ts#maps the threshold reason to the auto PostCompact trigger"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-compact.test.ts#preserves empty context strings in the complete PostCompact envelope"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/post-compact.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (80/80)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The translator architecture gate pins the expected export name for both renamed events and fires on a rename in either direction"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts#keeps one translator module for every dispatchable event"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts#keeps shared built-in and custom tool-name mapping across all tool translators"
        status: pass
      - kind: other
        ref: "planted offender A (table names an unpublished export) and B (published export renamed, table not updated) -- each 1 pass / 1 fail, both files restored and SHA-256 verified"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each changed production module keeps exact direct-owner coverage, and the wave census total is unchanged at 14 with only the translate duplicate group's membership changing"
    requirement: EXPORT-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- <each of the four changed production paths> -- all four passed with hit == found on branches, functions and lines"
        status: pass
      - kind: other
        ref: "fallow dead-code --production --no-cache --format json --fail-on-issues -- total_issues 14 before and after, delta exactly one duplicate-group removal and one addition"
        status: pass
    human_judgment: false

# Metrics
duration: 19 min
completed: 2026-09-14
status: complete
---

# Phase 05 Plan 26: Compaction Translator Export Ownership Summary

**The PreCompact and PostCompact payload modules now publish `translatePreCompact` and `translatePostCompact` -- the names both dispatch modes already aliased at import -- shrinking the `translate` duplicate-export group from four members to two with the census total unchanged at 14.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-14T23:31:46Z
- **Completed:** 2026-09-14T23:50:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Renamed the public `translate` in both compaction payload modules to its event-specific name, so the export declares the identity its consumers already used.
- Updated both dispatch modes -- `dispatch-exec.ts` (synchronous) and `async-rewake/registry.ts` (async rewake) -- to import the names directly. Their event-keyed translator maps (`PreCompact:`, `PostCompact:`) are untouched, so both modes still reach the same event translator.
- Extended the per-event export-name table in `tests/architecture/hooks-translators.test.ts` to both events, inside the same commit as each rename, and proved it fires in both directions. Eight of its ten entries now pin an event-specific name; `Stop` and `StopFailure` remain on `translate` and belong to plan 05-27.
- Measured the production census delta on the finished tree: exactly one identity removed and one added, both the `translate` duplicate-export group, differenced over the whole 14-identity set.

## Task Commits

1. **Task 1 (tracer): Wire translatePreCompact through both dispatch modes** - `42477b85` (refactor)
2. **Task 2: Wire translatePostCompact through both dispatch modes** - `94b46e37` (refactor)

**Plan metadata:** the commit carrying this summary, `.planning/STATE.md` and `.planning/ROADMAP.md`.

Measured, not narrated. `git rev-list --count 507240f7747e53d547ffd7bdf30f502aea4737b4..HEAD` read **2** immediately after the two task commits, and rises by one for the metadata commit that follows. `git diff --name-only 507240f7..HEAD` lists exactly the seven files in `key-files.modified`, 19 insertions and 16 deletions; `tests/architecture/gate-targets.ts` and `.fallowrc.json` are untouched by both commits.

## Census Identity Delta

The parent reconciles the shared pin in `tests/architecture/gate-targets.ts`; this plan did not edit it. Measured with `fallow dead-code --production --no-cache --format json --fail-on-issues`, projected through the same `findingIdentities` shape the census gate uses (`tests/architecture/fallow-report.ts`), and differenced over the whole 14-identity set rather than compared by count.

**Total:** 14 before, 14 after. This plan changes membership, not count.

**Removed by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
```

**Added by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
```

The group goes from four members to two: `stop-failure.ts` and `stop.ts` remain. No other identity changed in either direction -- the remaining thirteen (`unused_class_members|...|RingBuffer|read|class_method`, the eleven `unused_exports` rows, and `unused_files|scripts/check-phase-06-hub-ledger.mjs`) are byte-identical before and after. The count-only view would have shown 14 -> 14 and one duplicate group before and after, which is exactly why the comparison is a set difference.

**Zero additions.** The two renamed modules leave the duplicate group and do **not** reappear under `unused_exports`: each new name has two live production consumers (`dispatch-exec.ts` and `async-rewake/registry.ts`). No `unused_exports`, `unused_types`, `unused_files` or `unused_class_members` identity changed, and the rename exposed no transitive finding -- `PreCompactStdin` and `PostCompactStdin` each keep two in-module consumers (their module's `compactTrigger` return type and its `translate*` return type), traced with CodeGraph before editing.

### What the parent must reconcile for this plan

One edit: drop the `pre-compact.ts` and `post-compact.ts` locations from the single `duplicate_exports` `translate` entry's `locations` array, leaving `stop-failure.ts` and `stop.ts`. Zero additions. The sibling Wave 7 plan 05-16 contributes two `unused_exports` removals (`createSetPluginEnabled`, `createUninstallPlugin`) with the matching `UNOWNED_EXPORT_CENSUS` keys; the live whole-tree census reads 14 against a pin still at 16.

## Assertion Ledger

Every change in the six payload files is identifier-token-only. The two production modules changed one function name each (`post-compact.ts`'s signature re-wrapped to three lines because the longer name crossed the 100-column print width; `pre-compact.ts` was already wrapped); the two owner tests changed one import specifier and their call tokens. No expected-payload literal, no `satisfies` annotation and no trigger-case table was touched.

### Task 1 -- `tests/bridges/hooks/payloads/pre-compact.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(firstPayload, expectedPayload)` x3 (one per `manual` / `threshold` / `overflow` trigger case) | unchanged | Preserved; only the call token `translate(` became `translatePreCompact(` |
| `assert.deepStrictEqual(repeatedPayload, expectedPayload)` x3 -- the repeat-call determinism check | unchanged | Preserved; only the call token changed |
| `assert.deepStrictEqual(payload, expectedPayload)` in `preserves empty context strings in the complete PreCompact envelope` | unchanged | Preserved; only the call token changed |

**Removed assertions: zero.** Four tests, seven assertions, all byte-identical.

### Task 2 -- `tests/bridges/hooks/payloads/post-compact.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(firstPayload, expectedPayload)` x3 (one per `manual` / `threshold` / `overflow` trigger case) | unchanged | Preserved; only the call token `translate(` became `translatePostCompact(` |
| `assert.deepStrictEqual(repeatedPayload, expectedPayload)` x3 -- the repeat-call determinism check | unchanged | Preserved; only the call token changed |
| `assert.deepStrictEqual(payload, expectedPayload)` in `preserves empty context strings in the complete PostCompact envelope` | unchanged | Preserved; only the call token changed |

**Removed assertions: zero.** Four tests, seven assertions, all byte-identical.

### `tests/architecture/hooks-translators.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(translatorExports, expectedExports)` | unchanged, byte-identical | Preserved. Only the `EVENT_TO_TRANSLATOR_EXPORT` values for `PreCompact` and `PostCompact` changed. |
| `assert.deepStrictEqual(BUCKET_A_EVENTS, expectedAdmission)` | unchanged, byte-identical | Preserved |
| `assert.deepStrictEqual(mappings, expectedMappings)` | unchanged, byte-identical | Preserved. This test drives only the three tool translators, which this plan does not touch. |

**Removed assertions: zero.** The table's doc comment is unchanged -- it already says the published name differs per event, which stays true.

## Non-vacuity Evidence

### Real RED before each GREEN

Each rename was applied to the production module alone and measured before its consumers or owner test were updated:

| Task | Command | Result |
| --- | --- | --- |
| 1 | `node --test tests/bridges/hooks/payloads/pre-compact.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts tests/architecture/hooks-translators.test.ts` | tests 5, pass 1, fail 4; the gate's census test reported `{ event: 'PreCompact', exportType: 'undefined' }` |
| 2 | same shape with `post-compact.test.ts` | tests 5, pass 1, fail 4; gate reported `{ event: 'PostCompact', exportType: 'undefined' }` |

This is the natural offender for the rename direction: a silent `undefined` read is exactly what the gate exists to catch, and it caught both.

### Planted offenders, both directions

Run after both task commits, against the finished tree.

- **Control A -- the table names an export the module does not publish.** `EVENT_TO_TRANSLATOR_EXPORT.PostCompact` was set back to `"translate"`: **1 pass / 1 fail**. The census test reported `{ event: 'PostCompact', exportType: 'undefined' }`.
- **Control B -- a published export renamed without updating the table.** `pre-compact.ts` was made to publish `translatePreCompactRenamed` while the table still said `translatePreCompact`: **1 pass / 1 fail**, `{ event: 'PreCompact', exportType: 'undefined' }`.

Both controls report 1 pass / 1 fail rather than 05-24's 0 pass / 2 fail, and that difference is measured rather than a weaker control. The gate's second test (`keeps shared built-in and custom tool-name mapping`) iterates `TOOL_EVENTS` only, so a rename of a non-tool event cannot reach it. The one test that can see these two events did fail, in both directions, for the intended reason. This matches 05-25's measurement for the same reason.

- **Restoration proof.** Both files were restored from backup and re-verified with `sha256sum -c` against hashes taken before the controls: `tests/architecture/hooks-translators.test.ts: OK`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts: OK`. `git status --short -- extensions tests` shows no modification to any source or test file, and the gate re-runs 2 pass / 0 fail.

## Verification Commands and Results

Every run below printed its individual test names and its `ℹ tests / pass / fail` block, so no run reported file-level success without executing. Every gate was run in the foreground; no claim here is sourced from a backgrounded command.

| Command | Result |
| --- | --- |
| `node --test` over the five affected suites, before any edit (baseline) | tests 86, pass 86, fail 0 |
| Task 1 RED (production renamed only) | tests 5, pass 1, fail 4; gate entry `PreCompact: undefined` |
| Task 1 `<verify>`: `node --test tests/bridges/hooks/payloads/pre-compact.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | tests 80, pass 80, fail 0 |
| Tracer feedback gate: same command re-run after the Task 1 commit | tests 80, pass 80, fail 0 |
| Task 2 RED (production renamed only) | tests 5, pass 1, fail 4; gate entry `PostCompact: undefined` |
| Task 2 `<verify>`: same three-file form with `post-compact.test.ts` | tests 80, pass 80, fail 0 |
| `node --test tests/architecture/hooks-translators.test.ts` (after each task, and after control restoration) | tests 2, pass 2, fail 0 |
| `npm run typecheck` | clean, run after each task |
| `npm run test:coverage:direct -- <path>` x4 | all passed. pre-compact branches 5/5, functions 2/2, lines 37/37; post-compact 5/5, 2/2, 37/37; dispatch-exec 53/53, 17/17, 461/461; registry 104/104, 28/28, 674/674 |
| `SKIP=trufflehog pre-commit run --files ...` before each of the two commits | all hooks Passed, including `prettier`, `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and `npm direct coverage (changed pairs)` |
| `npm test` (full unit suite) | tests 6260, pass 6258, fail 2, exit 1 -- the two failures are the known census pin-equality gates the parent reconciles |
| `npm run test:integration` | tests 32, pass 32, fail 0, exit 0 |
| `fallow dead-code --production --no-cache --format json --fail-on-issues` | total_issues 14 both before and after, identity count 14, exit 1 both times |

The baseline of 86 and the per-task 80 are consistent: each task command covers three of the five suites. Omitting the gate (2) and the other payload suite (4) accounts for the difference in each case -- 86 - 2 - 4 = 80.

The full unit run is compared against the stated wave baseline of 6260 / 6258 pass / 2 fail: identical, with the same two named failures (`D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin` and `The complete production finding census equals its committed identities`). No new failure was introduced. Integration matches its 32/32 baseline.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts` - public translator renamed to `translatePreCompact`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts` - public translator renamed to `translatePostCompact`
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - two aliased imports become direct imports; the event-keyed translator map is unchanged
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - same two import changes for the async rewake path
- `tests/bridges/hooks/payloads/pre-compact.test.ts` - import and three call tokens
- `tests/bridges/hooks/payloads/post-compact.test.ts` - import and three call tokens
- `tests/architecture/hooks-translators.test.ts` - two per-event expected export names; the three assertions are byte-identical

## Decisions Made

See `key-decisions` in the frontmatter. In short: rename rather than exempt, because both consumers already aliased to the target name; carry the gate's per-event pin in the same commit as the rename so no commit ships red; observe a real RED before each GREEN; report the controls honestly at 1 pass / 1 fail; leave the shared census pin to the parent.

## Deviations from Plan

**One file outside the plan's declared `files_modified` was edited: `tests/architecture/hooks-translators.test.ts`.**

- **Rule:** 3 (blocking) -- the same disposition 05-24 and 05-25 recorded for the same file.
- **Found during:** Task 1, at the RED measurement, before any consumer was updated.
- **Issue:** the gate resolves each payload module's translator by the exact name pinned in `EVENT_TO_TRANSLATOR_EXPORT`. Both of this plan's events were still pinned to `translate`, so each rename turned that event's entry into `undefined` and failed the gate's census test.
- **Fix:** updated the two entries to the new names, one per task commit.
- **Verification:** 2/2 pass after each task; two planted offenders (Controls A and B above) each produce 1 pass / 1 fail, and both files were restored and re-hashed afterwards.
- **Committed in:** `42477b85`, `94b46e37` (one entry per task commit).

**Why this is Rule 3 and in scope:** the failure is caused directly by this plan's declared rename, is not pre-existing, and leaving it would mean returning a red suite. The repair stays inside the test tier and adds no production surface. Scope was held to the single file the rename broke; no other test or production file outside `files_modified` was touched.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** none on scope. No assertion was weakened, no production surface was added, and the gate is measurably stronger in that it now pins eight distinct names instead of six.

## Issues Encountered

None beyond the deviation above. The two failing tests remaining in the full unit run (`tests/architecture/unowned-exports-census.test.ts`) are the known, expected Wave 7 pin-equality gates. They are the parent's single reconciliation edit and are not a defect in this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema was introduced; every change is an identifier rename or a test-tier name table.

- **T-05-26-01 (Tampering)** is satisfied by the preserved byte and envelope assertions -- fourteen assertions across the two owner tests are byte-identical -- and by the full-tree caller trace (CodeGraph plus a repository-wide grep for importers) taken before editing.
- **T-05-26-02 (Repudiation)** is satisfied by the exact measured identity strings above, differenced over the whole 14-identity set rather than by count, with both planted-offender controls recorded.
- **T-05-26-03 (Information disclosure)** is satisfied by the controls, which used only in-repo files with backup-and-restore and fixed argv, and touched no credential or external service. The analyzer was run with fixed argv into a scratch directory outside the repository.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 7 source writing is complete -- 05-16 and 05-26 have both landed, and no source writer is active, so the tree is frozen for the reconciliation. The parent can now:

1. Apply the combined Wave 7 pin edits to `tests/architecture/gate-targets.ts` in one pass (16 pinned -> 14 live). This plan's contribution is a single edit: drop `pre-compact.ts` and `post-compact.ts` from the `duplicate_exports` `translate` entry's `locations` array, leaving `stop-failure.ts` and `stop.ts`. 05-16 contributes the two `unused_exports` removals and their `UNOWNED_EXPORT_CENSUS` keys.
2. Re-run the census and control gates; both `unowned-exports-census.test.ts` tests should go green with no other change.
3. Measure aggregate production unit coverage on the stable wave snapshot. All four of this plan's direct owners are at hit == found, so no regression originates here.

One item for the parent's attention, outside this plan's owner set: `tests/architecture/gate-targets.ts` is now the only file in the repository that still names the two compaction payload paths in that duplicate-group entry. A repository-wide grep over `extensions`, `tests`, `scripts` and `docs` found no comment, doc or test still referring to the retired `translate` name for these two modules, so this plan adds no entry to `deferred-items.md`.

No blockers.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*

## Self-Check: PASSED

All seven modified source/test files exist on disk, the SUMMARY exists at its declared path, and both task commits (`42477b85`, `94b46e37`) resolve in `git log --oneline --all`. `tests/architecture/gate-targets.ts` and `.fallowrc.json` are untouched by every commit in this plan: `git diff --name-only 507240f7..HEAD` lists exactly the seven files above.
