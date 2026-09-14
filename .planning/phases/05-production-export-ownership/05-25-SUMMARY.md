---
phase: 05-production-export-ownership
plan: "25"
subsystem: testing
tags: [typescript, node-test, fallow, hooks, payload-translators, dispatch]

# Dependency graph
requires:
  - phase: 05-production-export-ownership
    provides: "05-24's per-event translator export-name table, which this plan extends to its three events"
  - phase: 05-production-export-ownership
    provides: "05-05 hook dispatch/registry seam work this plan's two consumers sit on"
provides:
  - "translateSessionStart, translateSessionEnd and translateUserPromptSubmit as the three session/prompt payload modules' own public export names"
  - "Both dispatch modes importing those names directly instead of aliasing a shared `translate` at each call site"
  - "A translator gate whose per-event export table now pins six event-specific names, proved to fire on a rename in either direction"
  - "Measured production census delta: the translate duplicate-export group shrinks from seven members to four; total_issues stays 16"
affects: [05-28, wave-6-reconciliation]

# Actuals (#2632)
actuals:
  tasks: 3
  commits: 3
  plan_head_before: a19b8280dce1fbb86f9b2a8cc6945ccd640c5593
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
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/bridges/hooks/payloads/session-start.test.ts
    - tests/bridges/hooks/payloads/session-end.test.ts
    - tests/bridges/hooks/payloads/user-prompt-submit.test.ts
    - tests/architecture/hooks-translators.test.ts

key-decisions:
  - "Rename the export rather than add a duplicate-export exemption. Both production consumers already aliased `translate` to the event-specific name at import, so the name was already the real contract and only the declaration lagged."
  - "Update the gate's per-event export-name entry inside the same task commit as the rename that invalidates it, rather than as a trailing repair. Each of the three commits therefore leaves the translator gate green, and no commit in the sequence ships a red suite."
  - "Observe a real RED before each rename's consumers were updated. Renaming the production export alone was run against the owner test, both dispatch suites and the translator gate; all four failed, with the gate reporting that event's entry as `exportType: 'undefined'`."
  - "Report the planted-offender controls as 1 pass / 1 fail rather than borrowing 05-24's 0 pass / 2 fail. The gate's second test exercises only the three tool translators, so a rename of a non-tool event cannot fail it; claiming two failures would overstate the control."
  - "Leave the shared census pin in tests/architecture/gate-targets.ts untouched. The plan assigns the single pin edit to the parent wave reconciliation, so the two pin-equality gates stay red by design until the parent reconciles."

patterns-established:
  - "Take a planted-offender measurement in both directions and then restore by SHA-256 comparison, so a control cannot leave residue in the committed tree"
  - "Differencing the whole projected identity set before and after, rather than comparing finding counts, so a membership change inside a duplicate group with an unchanged count is still visible"

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "The SessionStart payload module publishes translateSessionStart, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/session-start.test.ts#emits the complete SessionStart envelope with the startup source"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/session-start.test.ts#propagates the resume source in the complete SessionStart envelope"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/session-start.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (82/82)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The SessionEnd payload module publishes translateSessionEnd, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/session-end.test.ts#emits the complete SessionEnd envelope with the quit reason"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/session-end.test.ts#propagates the new reason without emitting the target session file"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/session-end.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (82/82)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The UserPromptSubmit payload module publishes translateUserPromptSubmit, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/user-prompt-submit.test.ts#emits the complete UserPromptSubmit envelope with the prompt text"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/user-prompt-submit.test.ts#preserves a multi-byte prompt in the complete UserPromptSubmit envelope"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/user-prompt-submit.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (80/80)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The translator architecture gate pins the expected export name for all three renamed events and fires on a rename in either direction"
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
  - id: D5
    description: "Each changed production module keeps exact direct-owner coverage, and the wave census total is unchanged at 16 with only the translate duplicate group's membership changing"
    requirement: EXPORT-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- <each of the five changed production paths> -- all five passed with hit == found on branches, functions and lines"
        status: pass
      - kind: other
        ref: "fallow dead-code --production --no-cache --format json --fail-on-issues -- total_issues 16 before and after, delta exactly one duplicate-group removal and one addition"
        status: pass
    human_judgment: false

# Metrics
duration: 29 min
completed: 2026-09-15
status: complete
---

# Phase 05 Plan 25: Session and Prompt Translator Export Ownership Summary

**The SessionStart, SessionEnd and UserPromptSubmit payload modules now publish `translateSessionStart`, `translateSessionEnd` and `translateUserPromptSubmit` -- the names both dispatch modes already aliased at import -- shrinking the `translate` duplicate-export group from seven members to four with the census total unchanged at 16.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-09-15T00:23:00Z
- **Completed:** 2026-09-15T00:52:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Renamed the public `translate` in all three session/prompt payload modules to its event-specific name, so the export declares the identity its consumers already used.
- Updated both dispatch modes -- `dispatch-exec.ts` (synchronous) and `async-rewake/registry.ts` (async rewake) -- to import the names directly. Their event-keyed translator maps (`SessionStart:`, `UserPromptSubmit:`, `SessionEnd:`) are untouched, so both modes still reach the same event translator.
- Extended the per-event export-name table in `tests/architecture/hooks-translators.test.ts` to all three events, inside the same commit as each rename, and proved it fires in both directions.
- Measured the production census delta on the finished tree: exactly one identity removed and one added, both the `translate` duplicate-export group.

## Task Commits

1. **Task 1 (tracer): Wire translateSessionStart through both dispatch modes** - `fbce2dfc` (refactor)
2. **Task 2: Wire translateSessionEnd through both dispatch modes** - `6823c071` (refactor)
3. **Task 3: Wire translateUserPromptSubmit through both dispatch modes** - `fefd6fe9` (refactor)

Measured, not narrated: `git rev-list --count a19b8280dce1fbb86f9b2a8cc6945ccd640c5593..HEAD` reports **3** at the time the three task commits were complete.

## Census Identity Delta

The parent reconciles the shared pin in `tests/architecture/gate-targets.ts`; this plan did not edit it. Measured with `fallow dead-code --production --no-cache --format json --fail-on-issues`, projected through the same `findingIdentities` shape the census gate uses, and differenced over the whole 16-identity set rather than compared by count.

**Total:** 16 before, 16 after. This plan changes membership, not count.

**Removed by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
```

**Added by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
```

The group goes from seven members to four: `post-compact.ts`, `pre-compact.ts`, `stop-failure.ts` and `stop.ts` remain. No other identity changed in either direction -- the remaining fifteen (`unused_class_members|...|RingBuffer|read|class_method`, the thirteen `unused_exports` rows, and `unused_files|scripts/check-phase-06-hub-ledger.mjs`) are byte-identical before and after.

**Zero additions.** The three renamed modules leave the duplicate group and do **not** reappear under `unused_exports`: each new name has two live production consumers (`dispatch-exec.ts` and `async-rewake/registry.ts`). No `unused_exports`, `unused_types`, `unused_files` or `unused_class_members` identity changed, and the rename exposed no transitive finding -- the three `*Stdin` interfaces each keep their in-module return-type consumer, and `UserPromptSubmitStdin` additionally keeps its owner-test type import.

### What the parent must reconcile for this plan

One edit: drop the `session-end.ts`, `session-start.ts` and `user-prompt-submit.ts` locations from the single `duplicate_exports` `translate` entry's `locations` array, leaving the four listed above. Zero additions. Sibling Wave 6 plans (05-15, 05-19, 05-23) contribute their own removals; the live whole-tree census reads 16 against a pin still at 32.

## Assertion Ledger

Every change in the six payload files is identifier-token-only. The three production modules changed one function name each (with the signature re-wrapped by Prettier where the longer name crossed the 100-column print width); the three owner tests changed one import specifier and their call tokens. No expected-payload literal, no `satisfies` annotation, no key-order assertion and no no-mutation check was touched.

### Task 1 -- `tests/bridges/hooks/payloads/session-start.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(payload, { ...startup... })` | unchanged | Preserved; only the call token `translate(` became `translateSessionStart(` |
| `assert.strictEqual(payload.session_id, context.sessionId)` | unchanged | Preserved |
| `assert.strictEqual(payload.transcript_path, context.transcriptPath)` | unchanged | Preserved |
| `assert.strictEqual(payload.cwd, context.cwd)` | unchanged | Preserved |
| The five remaining `deepStrictEqual` envelope checks (resume, reload, new, fork, empty-context) | unchanged | Preserved; only the call token changed |

**Removed assertions: zero.** Six tests, nine assertions, all byte-identical.

### Task 2 -- `tests/bridges/hooks/payloads/session-end.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(payload, { ...quit... })` | unchanged | Preserved; only the call token `translate(` became `translateSessionEnd(` |
| `assert.strictEqual(payload.session_id / .transcript_path / .cwd, ...)` x3 | unchanged | Preserved |
| The five remaining `deepStrictEqual` envelope checks (reload, new, resume, fork, empty-context), including the three that prove `targetSessionFile` is not emitted | unchanged | Preserved; only the call token changed |

**Removed assertions: zero.** Six tests, nine assertions, all byte-identical.

### Task 3 -- `tests/bridges/hooks/payloads/user-prompt-submit.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(promptPayload, expectedPayload)` x4 | unchanged | Preserved; only the call token `translate(` became `translateUserPromptSubmit(` |
| `assert.deepStrictEqual(Object.keys(promptPayload), expectedKeys)` x4 | unchanged | Preserved -- the key-order contract is intact |
| `assert.deepStrictEqual(event, expectedEvent)` x4 and `assert.deepStrictEqual(context, expectedContext)` x4 | unchanged | Preserved -- the no-mutation checks are intact |

**Removed assertions: zero.** Four tests, sixteen assertions, all byte-identical.

### `tests/architecture/hooks-translators.test.ts`

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(translatorExports, expectedExports)` | unchanged, byte-identical | Preserved. Only the `EVENT_TO_TRANSLATOR_EXPORT` values for `SessionStart`, `SessionEnd` and `UserPromptSubmit` changed. |
| `assert.deepStrictEqual(BUCKET_A_EVENTS, expectedAdmission)` | unchanged, byte-identical | Preserved |
| `assert.deepStrictEqual(mappings, expectedMappings)` | unchanged, byte-identical | Preserved. This test drives only the three tool translators, which this plan does not touch. |

**Removed assertions: zero.** The table's doc comment was reworded from "the tool translators carry event-specific names" to "the published name differs per event", because six of the ten entries now carry event-specific names; it makes no claim about the code's former shape.

## Non-vacuity Evidence

### Real RED before each GREEN

Each rename was applied to the production module alone and measured before its consumers or owner test were updated:

| Task | Command | Result |
| --- | --- | --- |
| 1 | `node --test <owner> <dispatch-exec> <registry> <gate>` | 4 files failed; the gate's census test reported `{ event: 'SessionStart', exportType: 'undefined' }` |
| 2 | same shape for `session-end` | tests 5, pass 1, fail 4; gate reported `{ event: 'SessionEnd', exportType: 'undefined' }` |
| 3 | same shape for `user-prompt-submit` | tests 5, pass 1, fail 4 |

This is the natural offender for the rename direction: a silent `undefined` read is exactly what the gate exists to catch, and it caught all three.

### Planted offenders, both directions

Run after all three task commits, against the finished tree.

- **Control A -- the table names an export the module does not publish.** `EVENT_TO_TRANSLATOR_EXPORT.SessionEnd` was set back to `"translate"`: **1 pass / 1 fail**. The census test reported `{ event: 'SessionEnd', exportType: 'undefined' }`.
- **Control B -- a published export renamed without updating the table.** `session-start.ts` was made to publish `translateSessionStartRenamed` while the table still said `translateSessionStart`: **1 pass / 1 fail**, `{ event: 'SessionStart', exportType: 'undefined' }`.

Both controls report 1 pass / 1 fail rather than 05-24's 0 pass / 2 fail, and that difference is correct rather than a weaker control. The gate's second test (`keeps shared built-in and custom tool-name mapping`) iterates `TOOL_EVENTS` only, so a rename of a non-tool event cannot reach it. The one test that can see these three events did fail, in both directions, for the intended reason.

- **Restoration proof.** Both files were restored from backup and re-verified with `sha256sum -c` against hashes taken before the controls: `tests/architecture/hooks-translators.test.ts: OK`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts: OK`. `git status --short` shows no modification to any source or test file, and the gate re-runs 2 pass / 0 fail.

## Verification Commands and Results

Every run below printed its individual test names, so no run reported file-level success without executing.

| Command | Result |
| --- | --- |
| `node --test` over the six affected suites, before any edit (baseline) | tests 94, pass 94, fail 0 |
| Task 1 RED (production renamed only) | 4 of 4 files failed, gate entry `undefined` |
| Task 1 `<verify>`: `node --test tests/bridges/hooks/payloads/session-start.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | tests 82, pass 82, fail 0 |
| Tracer feedback gate: same command re-run after the Task 1 commit | tests 82, pass 82, fail 0 |
| Task 2 RED (production renamed only) | tests 5, pass 1, fail 4 |
| Task 2 `<verify>`: same three-file form with `session-end.test.ts` | tests 82, pass 82, fail 0 |
| Task 3 RED (production renamed only) | tests 5, pass 1, fail 4 |
| Task 3 `<verify>`: same three-file form with `user-prompt-submit.test.ts` | tests 80, pass 80, fail 0 |
| `node --test tests/architecture/hooks-translators.test.ts` (after each task) | tests 2, pass 2, fail 0 |
| `npm run typecheck` | clean, run after each task |
| `npx prettier --check` / `npx eslint` on the changed files | clean, run after each task |
| `SKIP=trufflehog pre-commit run --files ...` before each of the three commits | all hooks Passed, including `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and `npm direct coverage (changed pairs)` |
| `npm run test:coverage:direct -- <path>` x5 | all passed. session-start branches 2/2, functions 1/1, lines 36/36; session-end 2/2, 1/1, 35/35; user-prompt-submit 2/2, 1/1, 32/32; dispatch-exec 53/53, 17/17, 461/461; registry 104/104, 28/28, 674/674 |
| `npm test` (full unit suite) | tests 6256, pass 6254, fail 2, exit 1 -- the two failures are the known census pin-equality gates the parent reconciles |
| `npm run test:integration` | tests 32, pass 32, fail 0, exit 0 |
| `fallow dead-code --production --no-cache --format json --fail-on-issues` | total_issues 16 both before and after, summary total 16, identity count 16 |

The baseline of 94 and the per-task 82 / 82 / 80 are consistent: each task command covers three of the six suites. Omitting the gate (2), and the two payload suites not under test, accounts for the difference in each case -- session-start's task omits session-end (6) and user-prompt-submit (4), leaving 94 - 2 - 6 - 4 = 82; session-end's omits session-start (6) and user-prompt-submit (4), also 82; user-prompt-submit's omits session-start (6) and session-end (6), leaving 80.

The full unit run is compared against the stated wave baseline of 6256 / 6254 pass / 2 fail: identical, with the same two named failures (`D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin` and `The complete production finding census equals its committed identities`). No new failure was introduced. Integration matches its 32/32 baseline.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts` - public translator renamed to `translateSessionStart`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts` - public translator renamed to `translateSessionEnd`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts` - public translator renamed to `translateUserPromptSubmit`
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - three aliased imports become direct imports; the event-keyed translator map is unchanged
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - same three import changes for the async rewake path
- `tests/bridges/hooks/payloads/session-start.test.ts` - import and six call tokens
- `tests/bridges/hooks/payloads/session-end.test.ts` - import and six call tokens
- `tests/bridges/hooks/payloads/user-prompt-submit.test.ts` - import and four call tokens
- `tests/architecture/hooks-translators.test.ts` - three per-event expected export names and the table's doc comment; the three assertions are byte-identical

## Decisions Made

See `key-decisions` in the frontmatter. In short: rename rather than exempt, because both consumers already aliased to the target name; carry the gate's per-event pin in the same commit as the rename so no commit ships red; observe a real RED before each GREEN; report the controls honestly at 1 pass / 1 fail; leave the shared census pin to the parent.

## Deviations from Plan

**One file outside the plan's declared `files_modified` was edited: `tests/architecture/hooks-translators.test.ts`.**

- **Rule:** 3 (blocking) -- the same disposition 05-24 recorded for the same file.
- **Found during:** Task 1, at the RED measurement, before any consumer was updated.
- **Issue:** the gate resolves each payload module's translator by the exact name pinned in `EVENT_TO_TRANSLATOR_EXPORT`. All three of this plan's events were still pinned to `translate`, so each rename turned that event's entry into `undefined` and failed the gate's census test.
- **Fix:** updated the three entries to the new names, one per task commit, and reworded the table's doc comment so it stays true with six event-specific names.
- **Verification:** 2/2 pass after each task; two planted offenders (Controls A and B above) each produce 1 pass / 1 fail, and both files were restored and re-hashed afterwards.
- **Committed in:** `fbce2dfc`, `6823c071`, `fefd6fe9` (one entry per task commit).

**Why this is Rule 3 and in scope:** the failure is caused directly by this plan's declared rename, is not pre-existing, and leaving it would mean returning a red suite. The repair stays inside the test tier and adds no production surface. Scope was held to the single file the rename broke; no other test or production file outside `files_modified` was touched.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** none on scope. No assertion was weakened, no production surface was added, and the gate is measurably stronger in that it now pins six distinct names instead of four.

## Issues Encountered

None beyond the deviation above. The two failing tests remaining in the full unit run (`tests/architecture/unowned-exports-census.test.ts`) are the known, expected Wave 6 pin-equality gates. They are the parent's single reconciliation edit and are not a defect in this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema was introduced; every change is an identifier rename or a test-tier name table.

- **T-05-25-01 (Tampering)** is satisfied by the preserved byte and envelope assertions -- thirty-four assertions across the three owner tests are byte-identical -- and by the full-tree caller trace (CodeGraph plus a repository-wide grep for importers) taken before editing.
- **T-05-25-02 (Repudiation)** is satisfied by the exact measured identity strings above, differenced over the whole 16-identity set rather than by count, with both planted-offender controls recorded.
- **T-05-25-03 (Information disclosure)** is satisfied by the controls, which used only in-repo files with backup-and-restore, fixed argv and no shell, and touched no credential or external service. The analyzer was run with fixed argv into a scratch directory outside the repository.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 6 source writing is complete -- 05-15, 05-19, 05-23 and 05-25 have all landed. The parent can now stop-the-world and reconcile:

1. Apply the combined Wave 6 pin edits to `tests/architecture/gate-targets.ts` in one pass (32 pinned -> 16 live). This plan's contribution is a single edit: drop the three session/prompt payload paths from the `duplicate_exports` `translate` entry's `locations` array, leaving `post-compact.ts`, `pre-compact.ts`, `stop-failure.ts` and `stop.ts`.
2. Re-run the census and control gates; both `unowned-exports-census.test.ts` tests should go green with no other change.
3. Measure aggregate production unit coverage on the stable wave snapshot. All five of this plan's direct owners are at hit == found, so no regression originates here.

One item for the parent's attention, outside this plan's owner set: `tests/architecture/gate-targets.ts` is now the only file in the repository that still names the three payload paths, and it names them only inside that duplicate-group entry. Nothing else -- comment, doc or test -- refers to the retired `translate` name for these three modules, so this plan adds no entry to `deferred-items.md`.

No blockers.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-15*
