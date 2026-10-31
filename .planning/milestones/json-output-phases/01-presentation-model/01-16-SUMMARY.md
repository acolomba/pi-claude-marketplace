---
phase: 01-presentation-model
plan: 16
subsystem: notify
status: complete
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, phase-gate, catalog-contract]

requires:
  - phase: 01-presentation-model
    provides: "01-15 probe-free notification boundary; 01-06..01-14 every production caller passes a NotificationRun"
provides:
  - "Run-only notify family: notify(ctx, run, message), emitContextCascade / emitUpdateNoOpCascade / emitReconcileAppliedContextCascade(ctx, run, ...), notifyWithContext / notifyUpdateWithContext / notifyUpdateNoOpWithContext / notifyReconcileAppliedWithContext(ctx, run, ...)"
  - "CatalogFixture.emit?: (ctx, run) => void; the catalog driver opens one run per fixture with openNotificationRun(fixture.pi)"
  - "Removed: snapshotOf and the dispatcher's softDepStatus import"
  - "ESLint IL-2 messages and extension comments describe notify(ctx, run, NotificationMessage) and the run's snapshot"
  - "Phase-end gate evidence for SC-1..SC-5 on HEAD 94ed9ffc"
affects: [02-row-policies, 04-wire-schema, 05-mode, 06-invocation-id, 07-docs]

actuals:
  tokens: 51260
  tasks: 2
  commits: 2
plan_head_before: 6ccdcddadc5bca0cef7cbcf69b8b22600a4b2542
plan_head_after: 94ed9ffc66cd7c6572222ceba2da3504088ad903

tech-stack:
  added: []
  patterns:
    - "A suite that calls the notify family directly passes a run seed (runWithAllLoaded / runWithNothingLoaded / runWithSoftDeps) whose snapshot matches the inventory answer it used"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/edge/args-schema.ts
    - eslint.config.js
    - scripts/check-unused-type-members.contracts.json
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notify-context.test.ts
    - tests/shared/notification-summary.test.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/fixture-types.ts
    - tests/architecture/catalog-uat/mock-pi.ts
    - tests/architecture/catalog-uat/fixtures/plugin-update.ts
    - tests/architecture/catalog-uat/fixtures/plugin-list.ts
    - tests/architecture/cross-surface-reason-parity.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/architecture/notify-producer-wire-coverage.test.ts
    - tests/architecture/notify-will-reload-agreement.test.ts
    - tests/architecture/workflows-marker-coverage.test.ts
    - tests/architecture/no-probe-in-workflows-bridge.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "The notify family takes run: NotificationRun only; the dispatcher reads run.softDeps and imports no probe (SC-2, D-05, D-06)"
  - "The catalog driver opens one run per fixture from the fixture's inventory, so mock-pi's three getAllTools() reads per fixture pin the run constructor, not the dispatcher"
  - "Direct-call suites pass run seeds from tests/shared/notification-run-seeds.ts; the two run-literal D-05 dispatch cases duplicated converted cases and were deleted (corpus extras 10 -> 8, no baseline entry lost)"

patterns-established:
  - "No notify-family signature accepts a tool inventory; openNotificationRun( appears only in edge/register.ts and index.ts, and softDepStatus( is called only inside shared/notification-run.ts"

requirements-completed: [PMOD-01, PMOD-03]

coverage:
  - id: D1
    description: "The notify family and the four notify-context functions take only run: NotificationRun; the dispatcher neither imports nor calls softDepStatus, and snapshotOf is gone"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "! rg -n 'softDepStatus|snapshotOf|ToolInventory' extensions/pi-claude-marketplace/shared/notification-dispatch.ts extensions/pi-claude-marketplace/shared/notify-context.ts (no match)"
        status: pass
      - kind: unit
        ref: "node --test over the nine plan suites (295/295) plus tests/orchestrators/plugin/enable-disable.test.ts (377/377 with it)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct:commit: notification-dispatch.ts 44/44 branches, notify-context.ts 19/19, notification-summary.ts 101/101, enable-disable.ts 169/169"
        status: pass
    human_judgment: false
  - id: D2
    description: "The catalog driver opens one run per fixture and emit fixtures take the run; 205 states and 26_619 bytes still match docs/output-catalog.md"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts (4/4; EXPECTED_STATE_COUNT = 205, EXPECTED_UTF8_BYTES = 26_619)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2f173031 -- docs/output-catalog.md (empty)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Extension comments and the ESLint IL-2 messages describe notify(ctx, run, NotificationMessage) and the run's snapshot"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "test -z \"$(rg -n 'softDepStatus\\(pi\\)|notify\\(ctx, pi' extensions -g '!notification-run.ts')\" and rg -n 'notify\\(ctx, pi, NotificationMessage\\)' eslint.config.js (both empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase-end gate: the text wire corpus, the catalog, and the full check are green on the final code tree"
    requirement: PMOD-03
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check (2622 baseline entries present, 8 extra; no 'missing in' or 'refused:' line)"
        status: pass
      - kind: other
        ref: "npm run check on HEAD 94ed9ffc (CHECK_EXIT=0; unit 7357/7357, integration 36/36)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The e2e job (npm run test:e2e, pinned upstream ref) is green in CI"
    requirement: PMOD-03
    verification: []
    human_judgment: true
    rationale: "The e2e suite needs the pinned upstream ref and runs in CI only; the verifier confirms it on the PR run"

duration: 78 min
completed: 2026-09-30
---

# Phase 01 Plan 16: Run-Only Notify Family and Phase Gate Summary

**The notify family now takes only `run: NotificationRun`: the dispatcher reads `run.softDeps` and never probes, the catalog driver opens one run per fixture, and the phase-end gate is green on HEAD `94ed9ffc` with the corpus and the catalog byte-identical to the baseline.**

## Performance

- **Duration:** 78 min
- **Started:** 2026-09-30T16:46:35Z
- **Completed:** 2026-09-30T18:04:08Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments

- `notify`, `emitContextCascade`, `emitUpdateNoOpCascade`, `emitReconcileAppliedContextCascade`, and the four `notify-context.ts` functions take `run: NotificationRun`. `snapshotOf` and the `softDepStatus` import left the dispatcher. The module header, `notify`'s doc, and `makeRawNotifyFn`'s doc name `notify(ctx, run, NotificationMessage)`.
- Every direct family call in tests passes a run. `notification-dispatch.test.ts` lost its four `piWith*()` helpers. It uses `runWithAllLoaded` / `runWithNothingLoaded`, and `runWithSoftDeps` for the two partial answers. `notify-context.test.ts` and `notify-producer-wire-coverage.test.ts` lost their strict `getAllTools().times(3)` pins. `notification-summary.test.ts` uses `notificationRun()`, which keeps subagents and MCP loaded.
- The catalog driver calls `openNotificationRun(fixture.pi)` once per fixture, which makes exactly the three reads `mock-pi.ts` pins, so `verifyPi` still holds. `fixture-types.ts` declares `emit?: (ctx, run) => void`.
- `workflows-marker-coverage.test.ts`'s `renderThroughNotify` renders from `runFor(engineLoaded)`. The decoy-tool helpers it no longer needs are gone, and its header now points the WDEP-01 decoy proof to the `softDepStatus` owner suite.
- Task 2 restated every stale probe claim the scan listed. That covers `pi-api.ts`, `notify-reasons.ts`, `concerns/soft-dep.ts`, `orchestrators/types.ts`, `update.messaging.ts`, `args-schema.ts`, and `notification-grammar.ts`, plus the two ESLint IL-2 messages and the workflows-bridge gate's exemption prose. That prose named the deleted `orchestrators/plugin/install.ts`.

## Task Commits

1. **Task 1: The notify family takes only the run** - `439ebda9` (refactor)
2. **Task 2: Restate stale claims and run the phase gate** - `94ed9ffc` (docs)

## Files Created/Modified

- `shared/notification-dispatch.ts`, `shared/notify-context.ts` - run-only signatures. Removed `snapshotOf` and the probe import. Restated the header and docs.
- `scripts/check-unused-type-members.contracts.json` - four pins shifted by line only: `notification-dispatch.ts` 228 to 225, and `notify-context.ts` 75/286/362 to 73/284/360.
- `tests/shared/{notification-dispatch,notify-context,notification-summary}.test.ts` - run seeds.
- `tests/architecture/catalog-uat/{catalog-contract.test.ts,fixture-types.ts,mock-pi.ts,fixtures/plugin-update.ts,fixtures/plugin-list.ts}` - one run per fixture. The emit arrow parameter is renamed, and the `verifyPi` doc is restated.
- `tests/architecture/{cross-surface-reason-parity,notify-grammar-invariant,notify-producer-wire-coverage,notify-will-reload-agreement,workflows-marker-coverage}.test.ts` - run seeds with the same snapshot answer.
- `tests/orchestrators/plugin/enable-disable.test.ts` - its one direct `notify` call passes `runWithNothingLoaded()`. The `makePi` / `toolInfo` helpers are gone.
- `eslint.config.js`, `platform/pi-api.ts`, `shared/notify-reasons.ts`, `shared/concerns/soft-dep.ts`, `shared/notification-grammar.ts`, `orchestrators/types.ts`, `orchestrators/marketplace/update.messaging.ts`, `edge/args-schema.ts`, `tests/architecture/no-probe-in-workflows-bridge.test.ts` - prose only.

## Phase-End Gate Evidence (D-03)

All results below are from the final code tree, HEAD `94ed9ffc66cd7c6572222ceba2da3504088ad903`. Only `.planning` docs change after it.

| Check | Result |
| --- | --- |
| `npm run check` (unpiped, logged) | `CHECK_EXIT=0`. Unit 7357/7357 (7359 minus the two deleted duplicates), integration 36/36, type-member gate and its 7 negative controls pass |
| `node scripts/notify-corpus.mjs check` | `Notify corpus check passed: 2622 baseline entries present, 8 extra.` No `missing in` or `refused:` line |
| `git diff --exit-code 2f173031 -- docs/output-catalog.md` | exit 0, empty |
| catalog-contract | 4/4. `EXPECTED_STATE_COUNT = 205`, `EXPECTED_UTF8_BYTES = 26_619` unchanged |
| SC-2 dispatcher scan: `rg -n "softDepStatus\|snapshotOf\|ToolInventory"` over dispatch and notify-context | no match |
| SC-2 grammar scan: `rg -n "SoftDepStatus\|softDepMarkers" shared/notification-grammar.ts` | no match |
| Stale-claim scan: `rg -n 'softDepStatus\(pi\)\|notify\(ctx, pi' extensions -g '!notification-run.ts'` | empty |
| Root-construction scan: `rg -l 'openNotificationRun\('` | `edge/register.ts`, `index.ts`, `shared/notification-run.ts` |
| Probe scan: `rg -l 'softDepStatus\('` | `platform/pi-api.ts` (definition), `shared/notification-run.ts` |
| 01-15 boundary scan: `rg -n 'toolProbes' tests` | empty |
| ESLint messages: `rg -n "notify\(ctx, pi, NotificationMessage\)" eslint.config.js` | empty |
| `fallow audit --base 6ccdcdda` | verdict `pass` |
| e2e | runs in CI only (`npm run test:e2e` needs the pinned upstream ref). The verifier must confirm it on the PR run |

### SC-1..SC-5 together

- **SC-1 (corpus and catalog unchanged):** the corpus check and the catalog diff above.
- **SC-2 (dispatcher and renderer take no probe):** the dispatcher and grammar scans above. `notify` reads `run.softDeps`, and the text renderer receives resolved rows only (D-13).
- **SC-3 (one probe per command drives severity and markers):** the probe and root-construction scans above. The two-answer SC-3 case in `tests/edge/register.test.ts` is in the green `npm run check`.
- **SC-4 (failure detail serialized in resolve):** unchanged by this plan. The corpus check keeps cause-chain bytes identical.
- **SC-5 (marker table and derivation site gated):** `workflows-marker-coverage.test.ts` still owns the single `softDepMarkers` call site in `notification-resolve.ts` and now renders from a run.

### Requirement evidence (not checked off here; phase verification closes them)

- **PMOD-01.** Resolve computes every decision, and one snapshot per command feeds both `companionSeverity` and the markers. No notify-family signature accepts an inventory. The ordering edge (content reasons, then markers in agents, mcp, workflows order, never sorted or de-duplicated) is pinned by the corpus and by the resolve owner test in the green check. No `{requires ...}` marker is withheld and no severity is lowered: 2622/2622 baseline entries are present with their multiplicity.
- **PMOD-03.** Cause chains, ` (truncated)`, `(rollback failed)` rows, and `leaked:` paths are byte-identical to the baseline, per the corpus check.

## Decisions Made

- The `probe` local in `notify` and the `probe` parameter of `dispatchInfoMessage` are now `run.softDeps` / `softDeps`, so the dispatcher's own names do not describe a probe it no longer takes.
- The partial-answer seeds (`subagents only`, `mcp only`, `no workflow engine`) use `runWithSoftDeps({...})` inline rather than new seed-module exports. Each shape has one to three uses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] One more direct notify caller outside the plan's file list**
- **Found during:** Task 1
- **Issue:** `tests/orchestrators/plugin/enable-disable.test.ts` passed `makePi()`, a `ToolInventory`, to `notify` in its "widened trailer gate is inert" case. Once the family narrowed, it no longer compiled.
- **Fix:** It now passes `runWithNothingLoaded()`, the snapshot an empty tool list produces. The helpers `makePi`, `toolInfo`, and their types are now unused and were removed.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** The suite passes, and direct coverage for `enable-disable.ts` is 169/169 branches.
- **Committed in:** `439ebda9`

**2. [Rule 1 - Comment accuracy] Two more stale claims beyond the plan's named list**
- **Found during:** Task 2
- **Issue:** The read_first scan also listed `edge/args-schema.ts` (`notify(ctx, pi, NotificationMessage)`), `shared/notification-grammar.ts` (the "legacy `notify(ctx, pi, message)`" arm, with "NO LONGER" narration), and `orchestrators/marketplace/update.messaging.ts` (`softDepStatus(pi)` snapshot). `notify-context.ts`'s header also described the "legacy `notify(ctx, source, message)`" and a "later plan".
- **Fix:** Restated each one as a present-tense fact about the run. The plan's "any other site" clause covers them.
- **Committed in:** `439ebda9` (notify-context header), `94ed9ffc` (the rest)

**3. [Rule 3 - Blocking] Type-member pins shifted mid-task**
- **Found during:** Task 1
- **Issue:** The first corpus check went red. The type-member gate exited 2 with empty stdout because `notification-dispatch.ts:228:43` no longer named a declaration, and `unused-type-member-gate.test.ts` then failed on `JSON.parse`.
- **Fix:** Shifted the four pins by line only, after Prettier, and re-ran the gate and then the corpus check. Both are green.
- **Committed in:** `439ebda9`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 comment accuracy).
**Impact on plan:** No scope change. No production behavior or emitted byte moved.

## Issues Encountered

- `git diff 2f173031 -- tests/architecture/catalog-uat/fixtures` also shows two comment rewordings in `plugin-update.ts` (`composeTally` changed to "the resolved tally"). Those come from an earlier plan in this phase, not this one. This plan's fixture diff against `6ccdcdda` holds only the `emit` arrow-parameter renames and their argument lines. No message literal moved.
- `docs/output-catalog.md` still says `notify(ctx, pi, NotificationMessage)` at lines 3229 and 3268. It also says `composeReasons` appends the markers. The catalog is byte-locked for this phase (D-03), so these lines stay for the Phase 7 docs pass.

## Follow-ups

- `tests/edge/register.test.ts`: `CommandProbes.probingEmissions` is 0 at every call site. Its doc still speaks of "surfaces that still probe the Pi handle once per emission", and none exists now that the family is run-only. That file is outside this plan's scope, so remove the field and restate the doc in a later change.
- At milestone close, delete the corpus tool and its baseline (D-01).
- Phase 7 docs: fix `docs/output-catalog.md` prose that says `composeReasons` appends the markers, and its `notify(ctx, pi, ...)` spelling.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-25 is mitigated. The dispatcher and notify-context carry no `softDepStatus`, `snapshotOf`, or `ToolInventory`, and runs are built only at the two roots. T-01-26 is mitigated: the stale-claim scan prints nothing. T-01-27 is mitigated: the fixtures change only the emit arrow parameter. T-01-SC: no package was installed.

## Next Phase Readiness

- Phase 1's plans are all executed. Code review, phase verification, and `phase.complete` are next. The orchestrator runs them.
- The verifier must still confirm the e2e job on CI.

## Self-Check: PASSED

- Commits `439ebda9` and `94ed9ffc` exist on `features/json`.
- `git rev-list --count 6ccdcdda..94ed9ffc` is 2, and all 26 modified files are in `git diff --name-only 6ccdcdda..94ed9ffc`.
