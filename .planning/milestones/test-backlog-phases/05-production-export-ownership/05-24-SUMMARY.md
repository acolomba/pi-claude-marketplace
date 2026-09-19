---
phase: 05-production-export-ownership
plan: "24"
subsystem: testing
tags: [typescript, node-test, fallow, hooks, payload-translators, dispatch]

# Dependency graph
requires:
  - phase: 05-production-export-ownership
    provides: "05-05 hook dispatch/registry seam work this plan's two consumers sit on"
  - phase: 05-production-export-ownership
    provides: "05-11 private MARKER_ENV registry source the prepared registry baseline was rebased onto"
provides:
  - "translatePreToolUse, translatePostToolUse and translatePostToolUseFailure as the three payload modules' own public export names"
  - "Both dispatch modes importing those names directly instead of aliasing a shared `translate` at each call site"
  - "A translator gate that pins the expected export name per event and is proved to fire on a rename in either direction"
  - "Measured production census delta: the translate duplicate-export group shrinks from ten members to seven; total_issues stays 32"
affects: [05-28, wave-5-reconciliation]

# Actuals (#2632)
actuals:
  tasks: 3
  commits: 4
  plan_head_before: 0a59810c686077405259f8bf3368c2437c1726ea
  # tokens: deliberately omitted. Actual token telemetry is unavailable in this
  # environment and the user decision on record forbids reporting diff
  # characters divided by four as an actual. See 05-CONTEXT.md / handoff.

tech-stack:
  added: []
  patterns:
    - "An export whose every consumer already aliases it to the same name takes that name itself, so the identity lives in the module instead of being re-supplied at each import"
    - "A reflective architecture gate pins the expected export name per subject in its own table and resolves that exact name, so a rename fails the gate instead of silently resolving to undefined"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/bridges/hooks/payloads/pre-tool-use.test.ts
    - tests/bridges/hooks/payloads/post-tool-use.test.ts
    - tests/bridges/hooks/payloads/post-tool-use-failure.test.ts
    - tests/architecture/hooks-translators.test.ts

key-decisions:
  - "Rename the export rather than add a duplicate-export exemption. Both production consumers already aliased `translate` to the event-specific name at import, so the name was already the real contract and only the declaration lagged."
  - "Repair tests/architecture/hooks-translators.test.ts rather than leave the suite red or weaken the gate. It resolved a hardcoded `translate` member off each dynamically imported payload module; the repair pins the expected name per event in its own table and keeps all three original assertions byte-identical."
  - "Prove the repaired gate with two planted offenders instead of accepting a green run. A table naming an unpublished export, and a published export renamed without updating the table, each turn that event's entry to `undefined` and fail both tests."
  - "Leave the shared census pin in tests/architecture/gate-targets.ts untouched. The plan assigns the single pin edit to the parent wave reconciliation, so the two pin-equality gates stay red by design until the parent reconciles."

patterns-established:
  - "Verify a prepared bundle by hash before applying and by byte equality after applying, so the applied tree is provably the reviewed artifact and not a re-derivation"
  - "Restore-and-rehash after every planted offender, so a control cannot leave residue in the committed tree"

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "The PreToolUse payload module publishes translatePreToolUse, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/pre-tool-use.test.ts#maps a built-in tool to the complete PreToolUse envelope"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/pre-tool-use.test.ts#preserves a custom tool name and input without mutation"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/pre-tool-use.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (78/78)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The PostToolUse payload module publishes translatePostToolUse, and both dispatch modes invoke it with unchanged arguments, payload bytes and callback semantics"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-tool-use.test.ts#maps a successful built-in tool to the complete PostToolUse envelope"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-tool-use.test.ts#preserves a successful custom tool name and nested values without mutation"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/post-tool-use.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (78/78)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The PostToolUseFailure payload module publishes translatePostToolUseFailure, and both dispatch modes invoke it with unchanged arguments, payload bytes and error outcomes"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-tool-use-failure.test.ts#maps a failed built-in tool to the complete PostToolUseFailure envelope"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-tool-use-failure.test.ts#preserves a failed custom tool name and nested values without mutation"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/payloads/post-tool-use-failure.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts (78/78)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The translator architecture gate pins the expected export name per event and fires on a rename in either direction"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts#keeps one translator module for every dispatchable event"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts#keeps shared built-in and custom tool-name mapping across all tool translators"
        status: pass
      - kind: other
        ref: "planted offender A (table names an unpublished export) and B (published export renamed, table not updated) -- each 0 pass / 2 fail, both files restored byte-exactly"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each changed production module keeps exact direct-owner coverage, and the wave census total is unchanged at 32 with only the translate duplicate group's membership changing"
    requirement: EXPORT-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- <each of the five changed production paths> -- all five passed with hit == found on branches, functions and lines"
        status: pass
      - kind: other
        ref: "fallow dead-code --production --no-cache --format json --fail-on-issues -- total_issues 32, identities 32, delta exactly one duplicate-group removal and one addition"
        status: pass
    human_judgment: false

# Metrics
duration: 33 min
completed: 2026-09-14
status: complete
---

# Phase 05 Plan 24: Payload Translator Export Ownership Summary

**The three tool-event payload modules now publish `translatePreToolUse`, `translatePostToolUse` and `translatePostToolUseFailure` -- the names both dispatch modes already aliased at import -- shrinking the `translate` duplicate-export group from ten members to seven with the census total unchanged at 32.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-14T18:26:00Z
- **Completed:** 2026-09-14T18:58:42Z
- **Tasks:** 3 (plus one auto-fixed blocking deviation)
- **Files modified:** 9

## Accomplishments

- Renamed the public `translate` in all three tool-event payload modules to its event-specific name, so the export declares the identity its consumers already used.
- Updated both dispatch modes -- `dispatch-exec.ts` (synchronous) and `async-rewake/registry.ts` (async rewake) -- to import the names directly. Their event-keyed translator maps (`PreToolUse:`, `PostToolUse:`, `PostToolUseFailure:`) are untouched, so both modes still reach the same event translator.
- Repaired `tests/architecture/hooks-translators.test.ts`, which resolved a hardcoded `translate` member off each dynamically imported payload module, and proved the repair with two planted offenders.
- Measured the production census delta on the finished tree: exactly one identity removed and one added, both the `translate` duplicate-export group.

## Task Commits

1. **Task 1 (tracer): Wire translatePreToolUse through both dispatch modes** - `a8c1dd60` (refactor)
2. **Task 2: Wire translatePostToolUse through both dispatch modes** - `4832bda3` (refactor)
3. **Task 3: Wire translatePostToolUseFailure through both dispatch modes** - `19a1d92e` (refactor)
4. **Deviation: repair the translator architecture gate** - `0afdd4f4` (fix)

## Census Identity Delta

The parent reconciles the shared pin in `tests/architecture/gate-targets.ts`; this plan did not edit it. Measured with `fallow dead-code --production --no-cache --format json --fail-on-issues`, projected through `findingIdentities` exactly as the census gate does.

**Total:** 32 before, 32 after. This plan changes membership, not count.

**Removed by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
```

**Added by this plan (1):**

```
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
```

The three renamed modules leave the duplicate group and do **not** reappear under `unused_exports`: each new name has two live production consumers. No `unused_exports`, `unused_types`, `unused_files` or `unused_class_members` identity changed.

The delta was computed against the pin minus the ten identities the two earlier Wave 5 plans removed, and the reconstructed pre-plan set matched the measured post-plan set on all 31 other identities. That cross-check independently confirms the ten-identity list the parent needs.

### What the parent must reconcile in one pin edit

Thirteen edits to `PRODUCTION_FINDING_CENSUS` / `UNOWNED_EXPORT_CENSUS` (42 pinned -> 32 live):

Remove (from 05-07):

```
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/stage.ts|createWriteHookConfig
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/stage.ts|hookConfigPathFor
unused_exports|extensions/pi-claude-marketplace/bridges/skills/unstage.ts|createUnstagePluginSkills
```

Remove (from 05-12):

```
unused_exports|extensions/pi-claude-marketplace/persistence/config-io.ts|CONFIG_VALIDATOR
unused_exports|extensions/pi-claude-marketplace/persistence/state-io.ts|PLUGIN_INSTALL_RECORD_SCHEMA
unused_exports|extensions/pi-claude-marketplace/persistence/state-io.ts|STATE_SCHEMA
unused_exports|extensions/pi-claude-marketplace/persistence/state-io.ts|STATE_VALIDATOR
unused_exports|extensions/pi-claude-marketplace/shared/completion-cache.ts|MARKETPLACE_NAMES_CACHE_SCHEMA
unused_exports|extensions/pi-claude-marketplace/shared/completion-cache.ts|PLUGIN_INDEX_CACHE_SCHEMA
unused_types|extensions/pi-claude-marketplace/persistence/state-io.ts|EnabledPluginRecord
```

From this plan: drop the three tool-event payload paths from the single `duplicate_exports` `translate` entry's `locations` array, leaving the seven listed above. Zero additions, and the `unused_class_members` `RingBuffer.read` row stays pinned as the interim census requires.

## Assertion Ledger

### Tasks 1-3: the three payload owner tests

Every change in the six payload files is identifier-token-only. Verified two ways: each file's pre-apply SHA-256 matched the prepared bundle's `before_sha256` against the current HEAD, and after applying, all eight files were byte-equal to the reviewed bundle content.

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `pre-tool-use.test.ts` -- `assert.deepStrictEqual(payload, expectedPayload)` x2 | unchanged | Preserved; only the call token `translate(` became `translatePreToolUse(` |
| `pre-tool-use.test.ts` -- `assert.strictEqual(payload.tool_input, toolInput)` x2 | unchanged | Preserved |
| `pre-tool-use.test.ts` -- the two no-mutation `deepStrictEqual` checks on `toolInput` and `context` | unchanged | Preserved |
| `post-tool-use.test.ts` -- `deepStrictEqual(payload, expectedPayload)` x2, `strictEqual(payload.tool_input, toolInput)` x2, the no-mutation checks | unchanged | Preserved; only the call token changed |
| `post-tool-use-failure.test.ts` -- same set | unchanged | Preserved; only the call token changed |

**Removed assertions: zero.** No assertion was migrated, weakened or retired in tasks 1-3; the expected payload literals, the identity check on `tool_input`, and the no-mutation checks are byte-identical.

### Deviation: the translator architecture gate

| Original assertion | Replacement | Disposition |
| --- | --- | --- |
| `assert.deepStrictEqual(translatorExports, expectedExports)` | unchanged, byte-identical | Preserved. What changed is how `exportType` is produced: `typeof translator.translate` became `typeof translator`, where `translator` is the module's own pinned export resolved by name. |
| `assert.deepStrictEqual(BUCKET_A_EVENTS, expectedAdmission)` | unchanged, byte-identical | Preserved |
| `assert.deepStrictEqual(mappings, expectedMappings)` | unchanged, byte-identical | Preserved. The call site went from `translator.translate(...)` to the resolved `translate(...)`. |

**Removed assertions: zero.** The `TranslatorModule` interface was replaced by a `Translator` function type plus the `EVENT_TO_TRANSLATOR_EXPORT` table; the interface carried no assertion.

**Non-vacuity evidence (both directions):**

- Control A -- the table names `translate` for `PreToolUse`, an export the module no longer publishes: 0 pass / 2 fail. The `PreToolUse` entry reads `exportType: 'undefined'` and the mapping test throws `TypeError: translate is not a function`.
- Control B -- `post-tool-use.ts` publishes `translatePostToolUseRenamed` while the table still says `translatePostToolUse`: 0 pass / 2 fail, `PostToolUse` entry `undefined`, same `TypeError`.
- Both files were restored from backup and re-hashed: the gate file matched its pre-control SHA-256, and the production file matched the prepared bundle content byte-for-byte.

## Verification Commands and Results

| Command | Result |
| --- | --- |
| `node --test` over the five affected suites, before any edit (baseline) | tests 82, pass 82, fail 0 |
| Task 1 `<verify>`: `node --test tests/bridges/hooks/payloads/pre-tool-use.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | tests 78, pass 78, fail 0 |
| Tracer feedback gate: same command re-run after the Task 1 commit | tests 78, pass 78, fail 0 |
| Task 2 `<verify>`: same three-file form with `post-tool-use.test.ts` | tests 78, pass 78, fail 0 |
| Task 3 `<verify>`: same three-file form with `post-tool-use-failure.test.ts` | tests 78, pass 78, fail 0 |
| `node --test tests/architecture/hooks-translators.test.ts` (after repair) | tests 2, pass 2, fail 0 |
| `npm run typecheck` | clean, run after each task |
| `npx prettier --check` / `npx eslint` on the changed files | clean |
| `SKIP=trufflehog pre-commit run --files ...` before each of the four commits | all hooks Passed, including `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and `npm direct coverage (changed pairs)` |
| `npm run test:coverage:direct -- <path>` x5 | all passed. pre-tool-use branches 2/2, functions 1/1, lines 40/40; post-tool-use 2/2, 1/1, 45/45; post-tool-use-failure 2/2, 1/1, 41/41; dispatch-exec 53/53, 17/17, 461/461; registry 104/104, 28/28, 674/674 |
| `npm test` (full unit suite) | tests 6244, pass 6242, fail 2 -- the two failures are the known census pin-equality gates the parent reconciles |
| `npm run test:integration` | tests 32, pass 32, fail 0, exit 0 |

The baseline of 82 and the per-task 78 are consistent: each task command covers three of the five suites, omitting the two payload suites not under test (4 tests). Every run printed its individual test names, so no run reported file-level success without executing.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts` - public translator renamed to `translatePreToolUse`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts` - public translator renamed to `translatePostToolUse`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts` - public translator renamed to `translatePostToolUseFailure`
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - three aliased imports become direct imports; the event-keyed translator map is unchanged
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - same three import changes for the async rewake path
- `tests/bridges/hooks/payloads/pre-tool-use.test.ts` - import and two call tokens
- `tests/bridges/hooks/payloads/post-tool-use.test.ts` - import and two call tokens
- `tests/bridges/hooks/payloads/post-tool-use-failure.test.ts` - import and two call tokens
- `tests/architecture/hooks-translators.test.ts` - per-event expected export name table; the three assertions are byte-identical

## Decisions Made

See `key-decisions` in the frontmatter. In short: rename rather than exempt, because both consumers already aliased to the target name; repair the gate rather than weaken it, and prove the repair with planted offenders in both directions; leave the shared census pin to the parent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The translator architecture gate hardcoded the old export name**

- **Found during:** plan-level verification, after Task 3
- **Issue:** `tests/architecture/hooks-translators.test.ts` dynamically imports each payload module by kebab path and read a `translate` member off the namespace through a `TranslatorModule` interface. Renaming the three tool translators turned that member into `undefined`, failing both of the file's tests: the export census test reported `exportType: 'undefined'` for the three events, and the tool-name mapping test threw `TypeError: translator.translate is not a function`. The prepared bundle covered eight files and did not include this gate.
- **Fix:** added `EVENT_TO_TRANSLATOR_EXPORT`, a per-event table of the exact export name each payload module publishes, alongside the existing `EVENT_TO_KEBAB` path table. `loadTranslator` now resolves that exact name from the imported namespace and returns the function itself. All three assertions are byte-identical.
- **Files modified:** `tests/architecture/hooks-translators.test.ts`
- **Verification:** 2/2 pass; two planted offenders (unpublished name in the table; published export renamed without updating the table) each produce 0 pass / 2 fail, and both files were restored and re-hashed afterwards. `npm run typecheck`, `npx eslint` and the full pre-commit set pass.
- **Committed in:** `0afdd4f4`

**Why this is Rule 3 and not out of scope:** the failure is caused directly by this plan's declared rename, is not pre-existing, and leaving it would mean returning a red suite. The repair stays inside the test tier and adds no production surface. Scope was held to the single file the rename broke.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** none on scope. The repair strengthens the gate slightly -- it now pins the expected export name per event rather than assuming one shared name -- and is proved non-vacuous in both directions. No assertion was weakened; no production surface was added.

## Issues Encountered

None beyond the deviation above. The two failing tests remaining in the full unit run (`tests/architecture/unowned-exports-census.test.ts`) are the known, expected Wave 5 pin-equality gates. They are the parent's single reconciliation edit and are not a defect in this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema was introduced; every change is an identifier rename or a test-tier name table. The threat register's mitigations hold: T-05-24-01 is satisfied by the preserved byte/error assertions and the full-tree caller trace before editing; T-05-24-02 by the exact measured identity strings above; T-05-24-03 by the controls, which used only in-repo files with backup-and-restore and touched no credential or external service.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 5 source writing is complete. The parent can now stop-the-world and reconcile:

1. Apply the thirteen pin edits listed above to `tests/architecture/gate-targets.ts` in one pass (42 -> 32).
2. Re-run the census and control gates; both `unowned-exports-census.test.ts` tests should go green with no other change.
3. Measure aggregate production unit coverage on the stable wave snapshot. All five of this plan's direct owners are at hit == found, so no regression originates here.

No blockers. Wave 6 (05-15, 05-19, 05-23, 05-25) is unblocked once the pin is reconciled.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*

## Self-Check: PASSED

All six modified source/test files exist on disk, the SUMMARY exists at its declared path, and all four task commits resolve in `git log --oneline --all`.
