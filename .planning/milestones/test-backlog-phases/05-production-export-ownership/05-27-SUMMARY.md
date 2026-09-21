---
phase: 05-production-export-ownership
plan: "27"
subsystem: testing
tags: [typescript, node-test, fallow, hooks, payload-translators, dispatch]

# Dependency graph
requires:
  - phase: 05-production-export-ownership
    provides: "05-24's per-event translator export-name table, extended by 05-25 and 05-26 and completed here"
  - phase: 05-production-export-ownership
    provides: "05-05 hook dispatch/registry seam work this plan's two consumers sit on"
provides:
  - "translateStop and translateStopFailure as the two settle-path payload modules' own public export names"
  - "Both dispatch modes importing those names directly instead of aliasing a shared `translate` at each call site"
  - "A translator gate whose per-event export table now pins all ten event-specific names, proved to fire on a rename in either direction"
  - "Measured production census delta: the translate duplicate-export group disappears entirely; total_issues 13 -> 12"
affects: [05-28, wave-8-reconciliation]

# Actuals (#2632)
actuals:
  tasks: 2
  # MEASURED: `git rev-list --count 026401b7..HEAD` read 2 immediately after the
  # two task commits, before this summary's own metadata commit. That is the
  # task-commit count, the same convention 05-24 through 05-26 used; the
  # metadata commit that carries this file is listed under `## Task Commits`,
  # so a later `rev-list` legitimately reads higher.
  commits: 2
  plan_head_before: 026401b7d2ac1f76c3f89b2264413771cb4f535a
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
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/bridges/hooks/payloads/stop.test.ts
    - tests/bridges/hooks/payloads/stop-failure.test.ts
    - tests/architecture/hooks-translators.test.ts

key-decisions:
  - "Rename the export rather than add a duplicate-export exemption. Both production consumers already aliased `translate` to the event-specific name at import, so the name was already the real contract and only the declaration lagged."
  - "Update the gate's per-event export-name entry inside the same task commit as the rename that invalidates it. Each of the two commits therefore leaves the translator gate green, and no commit in the sequence ships a red suite."
  - "Observe a real RED before each rename's consumers were updated. Renaming the production export alone was run against the owner test, both dispatch suites and the translator gate; both times 4 of 5 files failed and the gate reported that event's entry as `exportType: 'undefined'`."
  - "Report the planted-offender controls as 1 pass / 1 fail rather than borrowing 05-24's 0 pass / 2 fail. The gate's second test exercises only the three tool translators, so a rename of a non-tool event cannot reach it; claiming two failures would overstate the control."
  - "Update the `stop-failure.ts` module header, which named its own export `translate` in prose. The header is inside the plan's declared owner file and would otherwise name a symbol the module no longer publishes."
  - "Leave the shared census pin in tests/architecture/gate-targets.ts untouched. The plan assigns the single pin edit to the parent wave reconciliation, so the two pin-equality gates stay red by design until the parent reconciles."

patterns-established:
  - "Take a planted-offender measurement in both directions and then restore by SHA-256 comparison, so a control cannot leave residue in the committed tree"
  - "Difference the whole projected identity set before and after, rather than comparing finding counts, so a group that disappears entirely is distinguished from a group that merely shrinks"

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "The Stop payload module publishes translateStop, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop.test.ts#emits the complete active Stop envelope"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop.test.ts#emits the complete inactive Stop envelope"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop.test.ts#preserves accepted empty Stop text and transcript path"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/stop.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (79/79)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The StopFailure payload module publishes translateStopFailure, and both dispatch modes invoke it with unchanged arguments, payload bytes and error outcomes"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop-failure.test.ts#emits the complete StopFailure envelope with error details"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop-failure.test.ts#omits error_details from the complete envelope when the event omits it"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop-failure.test.ts#preserves an empty transcript path in the complete envelope"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/stop-failure.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (110/110)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The translator architecture gate pins an event-specific export name for all ten dispatchable events and fires on a rename in either direction"
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
    description: "Each changed production module keeps exact direct-owner coverage, and the translate duplicate-export group leaves the census entirely with zero additions"
    requirement: EXPORT-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- <each of the four changed production paths> -- all four passed with hit == found on branches, functions and lines"
        status: pass
      - kind: other
        ref: "fallow dead-code --production --no-cache --format json --fail-on-issues -- total_issues 13 before, 12 after; exactly one identity removed, zero added; duplicate_exports array is now []"
        status: pass
    human_judgment: false

# Metrics
duration: 26 min
completed: 2026-09-15
status: complete
---

# Phase 05 Plan 27: Stop Translator Export Ownership Summary

**The Stop and StopFailure payload modules now publish `translateStop` and `translateStopFailure` -- the names both dispatch modes already aliased at import -- and with them the `translate` duplicate-export group leaves the production census entirely, taking the live total from 13 to 12.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-15T00:25:00Z
- **Completed:** 2026-09-15T00:51:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Renamed the public `translate` in both settle-path payload modules to its event-specific name, so the export declares the identity its consumers already used. No payload module in the repository publishes a bare `translate` any more.
- Updated both dispatch modes -- `dispatch-exec.ts` (synchronous) and `async-rewake/registry.ts` (async rewake) -- to import the names directly. Their event-keyed translator maps (`Stop:`, `StopFailure:`) are untouched, so both modes still reach the same event translator. The Stop path's `agent_settled` fire-point and the deliberately-inert `asyncRewake` behaviour on Stop are unchanged; this plan renames an export and changes nothing semantic.
- Completed the per-event export-name table in `tests/architecture/hooks-translators.test.ts`: all ten entries now pin an event-specific name, none the bare `translate`. Each entry landed inside the same commit as the rename that invalidated it, and both directions were proved with planted offenders.
- Measured the production census delta on the finished tree: exactly one identity removed, zero added, and the `duplicate_exports` array is now empty rather than holding a shrunken group.

## Task Commits

1. **Task 1 (tracer): Wire translateStop through both dispatch modes** - `5283b2e6` (refactor)
2. **Task 2: Wire translateStopFailure through both dispatch modes** - `c26352b7` (refactor)

**Plan metadata:** the commit carrying this summary, `.planning/STATE.md` and `.planning/ROADMAP.md`.

Measured, not narrated. `git rev-list --count 026401b7d2ac1f76c3f89b2264413771cb4f535a..HEAD` read **2** immediately after the two task commits, and rises by one for the metadata commit that follows. `git diff --name-only 026401b7..HEAD` lists exactly the seven files in `key-files.modified`, 21 insertions and 18 deletions; `tests/architecture/gate-targets.ts` and `.fallowrc.json` are untouched by both commits.

## Census Identity Delta

The parent reconciles the shared pin in `tests/architecture/gate-targets.ts`; this plan did not edit it. Measured with `fallow dead-code --production --no-cache --format json --fail-on-issues`, projected through the same `findingIdentities` shape the census gate uses (`tests/architecture/fallow-report.ts`), and differenced over the whole identity set rather than compared by count.

**Total:** 13 before, 12 after.

**Removed by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
```

**Added by this plan (0):** nothing. `comm -13` over the two sorted identity sets is empty.

### The group disappeared entirely; it did not shrink

This is the structural difference from 05-25 and 05-26, and it is confirmed rather than assumed. Those plans each removed one identity and added a smaller one, because members remained. Here the group held exactly two members and both were renamed, and a duplicate needs at least two locations to exist. The measured report's `duplicate_exports` array is now **`[]`** -- not a one-member group, not a group with a different location list:

```
$ node -e "const r=require('census-after.json'); console.log(JSON.stringify(r.findings.duplicate_exports));"
[]
```

`grep -c '^duplicate_exports' ids-after.txt` reads **0**. No one-member group persisted. The whole `duplicate_exports` category is now empty for the first time in this phase.

The twelve surviving identities (`unused_class_members|...|RingBuffer|read|class_method`, the ten `unused_exports` rows, and `unused_files|scripts/check-phase-06-hub-ledger.mjs`) are byte-identical before and after.

**Zero additions.** The two renamed modules leave the duplicate group and do **not** reappear under `unused_exports`: each new name has two live production consumers (`dispatch-exec.ts` and `async-rewake/registry.ts`). No `unused_exports`, `unused_types`, `unused_files` or `unused_class_members` identity changed, and the rename exposed no transitive finding -- `StopStdin`, `StopEvent`, `StopFailureStdin` and `StopFailureEvent` all keep live consumers (their module's own translator signature plus `settle.ts`'s type imports of `StopEvent` / `StopFailureEvent` and `dispatch-exec.test.ts`'s), traced before editing.

### What the parent must reconcile for this plan

One edit: remove the single `duplicate_exports` entry from `tests/architecture/gate-targets.ts` outright, leaving `duplicate_exports: []`. Do not shorten its `locations` array -- there is no surviving member. Zero additions.

The sibling Wave 8 plan 05-17 contributes one `unused_exports` removal
(`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts|createReinstallPlugin`),
which is the one identity the committed pin is already stale by. With both edits
applied the pin reads 12 against a live census of 12.

## Assertion Ledger

Every change in the four test-tier and two production files is identifier-token-only, with one prose exception noted below. No expected-payload literal, no `satisfies` annotation, no `Object.hasOwn` absence check and no no-mutation check was touched.

### Task 1 -- `tests/bridges/hooks/payloads/stop.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(stopPayload, expectedPayload)` in `emits the complete active Stop envelope` | unchanged | Preserved; only the call token `translate(` became `translateStop(` |
| `assert.deepStrictEqual(stopPayload, expectedPayload)` in `emits the complete inactive Stop envelope` | unchanged | Preserved; only the call token changed |
| `assert.strictEqual(Object.hasOwn(stopPayload, "background_tasks"), false)` x2 | unchanged | Preserved -- the omitted-field contract is intact |
| `assert.strictEqual(Object.hasOwn(stopPayload, "session_crons"), false)` x2 | unchanged | Preserved -- the omitted-field contract is intact |
| `assert.deepStrictEqual(event, expectedEvent)` x2 and `assert.deepStrictEqual(context, expectedContext)` x2 | unchanged | Preserved -- the no-mutation checks are intact |
| `assert.deepStrictEqual(stopPayload, expectedPayload)` in `preserves accepted empty Stop text and transcript path` | unchanged | Preserved; only the call token changed |

**Removed assertions: zero.** Three tests, eleven assertions, all byte-identical. The three type-only `satisfies` blocks -- including the `@ts-expect-error` proving `stop_hook_active` is boolean -- are unchanged; the diff for this file is four lines, one import specifier and three call tokens.

### Task 2 -- `tests/bridges/hooks/payloads/stop-failure.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(stopFailurePayload, expectedPayload)` x3 (details present / details omitted / empty transcript path) | unchanged | Preserved; only the call token `translate(` became `translateStopFailure(` |
| `assert.strictEqual(Object.hasOwn(stopFailurePayload, "error_details"), true)` | unchanged | Preserved -- the present-optional-field contract is intact |
| `assert.strictEqual(Object.hasOwn(stopFailurePayload, "error_details"), false)` x2 | unchanged | Preserved -- the absent-optional-field contract is intact |
| The 31 `classifyStopFailure` tests (62 assertions: vocabulary membership, the ordered substring table, the `length -> max_output_tokens` map, the `unknown` fallback, and the word-boundary status-code cases) | unchanged, not reached by this plan | Preserved; `classifyStopFailure` is a separate export of the same module and was not renamed |

**Removed assertions: zero.** 34 tests, 68 assertions, all byte-identical. The diff for this file is four lines, one import specifier and three call tokens. The four type-only `satisfies` blocks, including the two `@ts-expect-error` proofs for the closed error vocabulary and the `error_details` text type, are unchanged.

### `tests/architecture/hooks-translators.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(translatorExports, expectedExports)` | unchanged, byte-identical | Preserved. Only the `EVENT_TO_TRANSLATOR_EXPORT` values for `Stop` and `StopFailure` changed. |
| `assert.deepStrictEqual(BUCKET_A_EVENTS, expectedAdmission)` | unchanged, byte-identical | Preserved |
| `assert.deepStrictEqual(mappings, expectedMappings)` | unchanged, byte-identical | Preserved. This test drives only the three tool translators, which this plan does not touch. |

**Removed assertions: zero.** The table's doc comment is unchanged -- it already says the published name differs per event, which stays true and is now true of every entry.

### Production prose change

`extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`'s module header described the module by naming its own export: "`translate` consumes the synthetic StopFailure event the settle handler builds and emits the Claude `StopFailure` stdin envelope." That sentence now names `translateStopFailure` and re-wraps across the same two lines. The behavioural claim is unchanged, and the SFAIL-02 / SFAIL-03 / D-88-02 anchors are retained. `stop.ts`'s header never named the export, so it is untouched.

## Non-vacuity Evidence

### Real RED before each GREEN

Each rename was applied to the production module alone and measured before its consumers or owner test were updated:

| Task | Command | Result |
| --- | --- | --- |
| 1 | `node --test tests/bridges/hooks/payloads/stop.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts tests/architecture/hooks-translators.test.ts` | tests 5, pass 1, fail 4; the gate's census test reported `{ event: 'Stop', exportType: 'undefined' }` |
| 2 | same shape with `stop-failure.test.ts` | tests 5, pass 1, fail 4; gate reported `{ event: 'StopFailure', exportType: 'undefined' }` |

This is the natural offender for the rename direction: a silent `undefined` read is exactly what the gate exists to catch, and it caught both.

### Planted offenders, both directions

Run after both task commits, against the finished tree.

- **Control A -- the table names an export the module does not publish.** `EVENT_TO_TRANSLATOR_EXPORT.StopFailure` was set back to `"translate"`: **1 pass / 1 fail**. The census test reported `{ event: 'StopFailure', exportType: 'undefined' }`.
- **Control B -- a published export renamed without updating the table.** `stop.ts` was made to publish `translateStopRenamed` while the table still said `translateStop`: **1 pass / 1 fail**, `{ event: 'Stop', exportType: 'undefined' }`.

Both controls report 1 pass / 1 fail rather than 05-24's 0 pass / 2 fail, and that difference is measured rather than a weaker control. The gate's second test (`keeps shared built-in and custom tool-name mapping`) iterates `TOOL_EVENTS` only, so a rename of a non-tool event cannot reach it. Stop and StopFailure are both non-tool events, so 1 pass / 1 fail is the correct ceiling here -- the same measurement 05-25 and 05-26 recorded, and it was not copied from them. The one test that can see these two events did fail, in both directions, for the intended reason.

- **Restoration proof.** Both files were restored from backup and re-verified with `sha256sum -c` against hashes taken before the controls: `tests/architecture/hooks-translators.test.ts: OK`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts: OK`. `git status --short -- extensions tests` shows no modification to any source or test file, and the gate re-runs 2 pass / 0 fail.

## Verification Commands and Results

Every run below was executed in the **foreground** and printed its own `ℹ tests / pass / fail` block; no claim here is sourced from a backgrounded or piped-into-a-file compound command. A run that could not produce a count was treated as a failure.

| Command | Result |
| --- | --- |
| `node --test` over the five affected suites, before any edit (baseline) | tests 115, pass 115, fail 0 |
| Task 1 RED (production renamed only) | tests 5, pass 1, fail 4; gate entry `Stop: undefined` |
| Task 1 `<verify>`: `node --test tests/bridges/hooks/payloads/stop.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | tests 79, pass 79, fail 0 |
| Tracer feedback gate: same command re-run after the Task 1 commit | tests 79, pass 79, fail 0 |
| Task 2 RED (production renamed only) | tests 5, pass 1, fail 4; gate entry `StopFailure: undefined` |
| Task 2 `<verify>`: same three-file form with `stop-failure.test.ts` | tests 110, pass 110, fail 0 |
| `node --test tests/architecture/hooks-translators.test.ts` (after each task, and after control restoration) | tests 2, pass 2, fail 0 |
| `npm run typecheck` | clean, run after each task |
| `npm run test:coverage:direct -- <path>` x4 | all passed. stop branches 2/2, functions 1/1, lines 42/42; stop-failure 13/13, 3/3, 137/137; dispatch-exec 53/53, 17/17, 461/461; registry 104/104, 28/28, 674/674 |
| `SKIP=trufflehog pre-commit run --files ...` before each of the two commits | all hooks Passed, including `prettier`, `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and `npm direct coverage (changed pairs)` |
| `npm test` (full unit suite) | tests 6262, pass 6260, fail 2, exit 1 -- the two failures are the known census pin-equality gates the parent reconciles |
| `npm run test:integration` | tests 32, pass 32, fail 0, exit 0 |
| `fallow dead-code --production --no-cache --format json` | total_issues 13 before, 12 after; exit 1 both times |

The baseline of 115 and the per-task 79 / 110 are consistent: each task command covers three of the five suites. Task 1 omits the gate (2) and the stop-failure suite (34): 115 - 2 - 34 = 79. Task 2 omits the gate (2) and the stop suite (3): 115 - 2 - 3 = 110.

The full unit run matches the stated wave baseline of 6262 / 6260 pass / 2 fail exactly, with the same two named failures:

- `D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin`
- `The complete production finding census equals its committed identities`

Both live in `tests/architecture/unowned-exports-census.test.ts` and are the parent's single reconciliation edit. No new failure was introduced. Integration matches its 32/32 baseline.

A repository-wide grep confirms no residue: no `.ts`, `.mjs` or `.md` file under `extensions`, `tests`, `scripts` or `docs` names a bare `translate` in connection with either stop module, and `grep -rn '^export function translate(' extensions/pi-claude-marketplace/bridges/hooks/payloads/` returns nothing.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts` - public translator renamed to `translateStop`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts` - public translator renamed to `translateStopFailure`; the signature re-wrapped to three lines because the longer name crossed the 100-column print width, and the module header now names the new identifier. `classifyStopFailure` and `CLASSIFIER_TABLE` are untouched
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - two aliased imports become direct imports; the event-keyed translator map is unchanged
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - same two import changes for the async rewake path; the Stop / StopFailure entries and their "never take the async-rewake path" comment are unchanged
- `tests/bridges/hooks/payloads/stop.test.ts` - import and three call tokens
- `tests/bridges/hooks/payloads/stop-failure.test.ts` - import and three call tokens
- `tests/architecture/hooks-translators.test.ts` - two per-event expected export names; the three assertions are byte-identical

## Decisions Made

See `key-decisions` in the frontmatter. In short: rename rather than exempt, because both consumers already aliased to the target name; carry the gate's per-event pin in the same commit as the rename so no commit ships red; observe a real RED before each GREEN; report the controls honestly at 1 pass / 1 fail; update the one production comment that named its own export; leave the shared census pin to the parent.

## Deviations from Plan

**One file outside the plan's declared `files_modified` was edited: `tests/architecture/hooks-translators.test.ts`.**

- **Rule:** 3 (blocking) -- the same disposition 05-24, 05-25 and 05-26 recorded for the same file.
- **Found during:** Task 1, at the RED measurement, before any consumer was updated.
- **Issue:** the gate resolves each payload module's translator by the exact name pinned in `EVENT_TO_TRANSLATOR_EXPORT`. Both of this plan's events were still pinned to `translate`, so each rename turned that event's entry into `undefined` and failed the gate's census test.
- **Fix:** updated the two entries to the new names, one per task commit.
- **Verification:** 2/2 pass after each task; two planted offenders (Controls A and B above) each produce 1 pass / 1 fail, and both files were restored and re-hashed afterwards.
- **Committed in:** `5283b2e6`, `c26352b7` (one entry per task commit).

**Why this is Rule 3 and in scope:** the failure is caused directly by this plan's declared rename, is not pre-existing, and leaving it would mean returning a red suite. The repair stays inside the test tier and adds no production surface. Scope was held to the single file the rename broke; no other test or production file outside `files_modified` was touched.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** none on scope. No assertion was weakened, no production surface was added, and the gate is measurably stronger in that all ten entries now pin a distinct event-specific name.

## Issues Encountered

None beyond the deviation above. The two failing tests remaining in the full unit run (`tests/architecture/unowned-exports-census.test.ts`) are the known, expected Wave 8 pin-equality gates. They are the parent's reconciliation edit and are not a defect in this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema was introduced; every change is an identifier rename, a comment naming that identifier, or a test-tier name table.

- **T-05-27-01 (Tampering)** is satisfied by the preserved byte and envelope assertions -- seventy-nine assertions across the two owner tests are byte-identical, including every `Object.hasOwn` omitted-field check and every no-mutation check -- and by the full-tree caller trace taken before editing.
- **T-05-27-02 (Repudiation)** is satisfied by the exact measured identity strings above, differenced over the whole identity set rather than by count, with the empty `duplicate_exports` array quoted verbatim and both planted-offender controls recorded.
- **T-05-27-03 (Information disclosure)** is satisfied by the controls, which used only in-repo files with backup-and-restore and fixed argv, and touched no credential or external service. The analyzer was run with fixed argv into a scratch directory outside the repository.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 8 source writing is complete -- 05-17 and 05-27 have both landed, and no source writer is active, so the tree is frozen for the reconciliation. The parent can now:

1. Apply the combined Wave 8 pin edits to `tests/architecture/gate-targets.ts` in one pass (13 pinned -> 12 live). This plan's contribution is a single edit: delete the one `duplicate_exports` entry outright, leaving `duplicate_exports: []`. 05-17 contributes the `createReinstallPlugin` `unused_exports` removal and its matching `UNOWNED_EXPORT_CENSUS` key.
2. Re-run the census and control gates; both `unowned-exports-census.test.ts` tests should go green with no other change.
3. Measure aggregate production unit coverage on the stable wave snapshot. All four of this plan's direct owners are at hit == found, so no regression originates here.

Two items for the parent's attention, outside this plan's owner set:

- `tests/architecture/gate-targets.ts` is now the only file in the repository that names the two stop payload paths in a duplicate-group entry, and that entry has no live basis. Nothing else -- comment, doc or test -- refers to the retired `translate` name for these two modules, so this plan adds no entry to `deferred-items.md`.
- `.fallowrc.json`'s `production` setting and the `RingBuffer.read` adjacency exception remain untouched, as plan 05-28 owns that atomic flip. `async-rewake/registry.ts`, which this plan edits, holds `RingBuffer.read`'s real production readers; that relationship is unchanged by these two import lines.

No blockers.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-15*

## Self-Check: PASSED

All seven modified source/test files exist on disk, the SUMMARY exists at its declared path, and both task commits (`5283b2e6`, `c26352b7`) resolve in `git log --oneline --all`. `tests/architecture/gate-targets.ts` and `.fallowrc.json` are untouched by every commit in this plan: `git diff --name-only 026401b7..HEAD` lists exactly the seven files above.
