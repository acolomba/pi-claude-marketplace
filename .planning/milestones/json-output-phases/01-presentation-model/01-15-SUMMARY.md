---
phase: 01-presentation-model
plan: 15
subsystem: notify
status: complete
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, test-boundary, strong-mock]

requires:
  - phase: 01-presentation-model
    provides: "01-14 no edge handler factory or orchestrator takes pi; every /claude:plugin surface and the load pass render from the command run"
provides:
  - "createNotificationBoundary(emissions, cwd?) returning { ctx, notifications, verifyBoundary }: no probe parameter and no Pi mock"
  - "tests/index.test.ts loadExtension(emissions, rootReads, cwd?) builds its own strict Pi mock, states its registrations and root reads on it, and verifies it beside the boundary"
  - "The boundary header states the per-command probe model (D-05, D-07)"
affects: [01-16 notify-family narrowing and the phase gate]

actuals:
  tokens: 49694
  tasks: 2
  commits: 2
plan_head_before: 837b25a1e120df28d62db76b6753837cc0c20c3f
plan_head_after: e3268151f06b36b889bcd9e60229fc3bf6c16bff

tech-stack:
  added: []
  patterns:
    - "A root suite that owns a soft-dependency snapshot builds its own strict Pi mock and states the snapshot reads there; the shared notification boundary sizes only emissions and cwd"

key-files:
  created: []
  modified:
    - tests/edge/notification-boundary.ts
    - tests/index.test.ts
    - tests/edge/router.test.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/shared.test.ts
    - tests/edge/handlers/plugin/shared.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/fetch.test.ts
    - tests/edge/handlers/plugin/import.test.ts
    - tests/edge/handlers/plugin/info.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - tests/edge/handlers/plugin/pending.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/edge/handlers/marketplace/shared.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/autoupdate.test.ts
    - tests/edge/handlers/marketplace/info.test.ts
    - tests/edge/handlers/marketplace/list.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/update-cascade.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/pending.test.ts

key-decisions:
  - "createNotificationBoundary takes (emissions, cwd?) and holds no Pi mock; the probe count belongs to the two root suites, tests/edge/register.test.ts and tests/index.test.ts, which build their own strict Pi mocks (D-05, D-07)"
  - "loadExtension names its count rootReads: three getAllTools() reads per resources_discover pass that reaches the reconcile and per registered-command run, none otherwise; a count of 0 states no expectation, never times(0)"
  - "loadExtension's returned verifyBoundary verifies the notification boundary and then its own Pi mock, so no case body changed"

patterns-established:
  - "The shared notification boundary sizes emissions and cwd only; a probe count appears only in the suite of the root that takes the snapshot"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "createNotificationBoundary takes (emissions, cwd?); all 336 caller sites that stated a probe count of 0 lose that argument by one mechanical substitution, with every emission count, cwd statement, and assertion unchanged"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "node --test over the 31 caller suites (1203/1203 pass, before and after the Task 1 commit)"
        status: pass
      - kind: other
        ref: "test -z \"$(rg -n 'toolProbes' tests)\" (empty)"
        status: pass
      - kind: other
        ref: "normalized diff per suite: HEAD with the same substitution applied, then Prettier, then comment lines stripped, equals the new file (no difference in any of the 30 substituted suites)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The load-pass loader in tests/index.test.ts states its own root reads on a strict Pi mock it builds, and verifies that mock beside the boundary"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/index.test.ts (node --test with register, router, and handlers/shared: 257/257)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The boundary hands out no Pi mock, and its header states the per-command probe model and the zero-count rule"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "test -z \"$(rg -n 'readonly pi|const pi =|verify\\(pi\\)' tests/edge/notification-boundary.ts)\" (empty)"
        status: pass
      - kind: other
        ref: "npm run check (CHECK_EXIT=0; unit 7359/7359, integration 36/36); node scripts/notify-corpus.mjs check (2622 baseline entries present, 10 extra); git diff --exit-code 2f173031 -- docs/output-catalog.md (empty)"
        status: pass
    human_judgment: false

duration: 50 min
completed: 2026-09-30
---

# Phase 01 Plan 15: Probe-Free Notification Boundary Summary

**`createNotificationBoundary(emissions, cwd?)` sizes only emissions and `cwd` and holds no Pi mock; the load-pass suite states its own `getAllTools()` root reads on a strict Pi mock it builds, so every soft-dependency probe count now sits with the root that takes the snapshot (D-05, D-07).**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-30T15:52:22Z
- **Completed:** 2026-09-30T16:42:41Z
- **Tasks:** 2
- **Files modified:** 32

## Accomplishments

- The helper drops its probe parameter and the `getAllTools()` expectation it installed. One `perl -0pi` substitution rewrote all 336 caller sites: 262 `(E, 0)` calls became `(E)`, and 74 `(E, 0, cwd)` calls became `(E, cwd)`. Before the change, a parser over every call found no caller except `loadExtension` that stated a non-zero count.
- `loadExtension(emissions, rootReads, cwd?)` in `tests/index.test.ts` builds `mock<ExtensionAPI>` itself. It states the factory's registrations and `when(() => pi.getAllTools()).thenReturn([]).times(rootReads)` on that mock when `rootReads > 0`. Its returned `verifyBoundary` verifies the boundary and then `verify(pi)`.
- `NotificationBoundary` is `{ ctx, notifications, verifyBoundary }`. The header states the per-command model: the registered command and the load pass each take one snapshot, handlers and orchestrators receive the run and never probe, and a probe count belongs to `tests/edge/register.test.ts` and `tests/index.test.ts`. It keeps the rule that a count of 0 states no expectation rather than `times(0)`, and the `cwd` rule.

## Task Commits

1. **Task 1: Probe counts leave the notification boundary** - `bc19ebd6` (test)
2. **Task 2: The boundary hands out no Pi mock and states the per-command model** - `e3268151` (test)

## Files Created/Modified

- `tests/edge/notification-boundary.ts` - `(emissions, cwd?)`, no Pi mock, the header restated for the per-command model
- `tests/index.test.ts` - `loadExtension` owns a strict Pi mock and a `rootReads` count, with its doc
- 30 caller suites - the `0` probe argument removed. The file headers that sized the boundary "at zero probes" now describe what each case still states.

## What each probe-count assertion became

- **The 336 boundary calls that stated 0.** A count of 0 installed no expectation, so the boundary's `pi` mock had no `getAllTools()` member stated. That mock was never handed to a handler or an orchestrator, because after 01-14 none takes `pi`. The argument therefore constrained nothing, and removing it removes no proof. A handler or orchestrator that started probing again would need `pi` in its signature, and every root that holds one states its reads on its own strict mock.
- **The `tests/index.test.ts` counts.** `loadExtension(0, 0)` (registration and `session_start` cases), `loadExtension(0, TOOL_READS_PER_DISCOVER)` and `loadExtension(n, TOOL_READS_PER_DISCOVER, ...)` (one discover pass), `loadExtension(0, 2 * TOOL_READS_PER_DISCOVER)` (two passes), and `loadExtension(1, 3, ...)` (one registered-command run in the owner-graph case) keep their numbers. The same `times(n)` is now installed on the loader's own Pi mock, and 0 still installs nothing.
- **`tests/edge/register.test.ts`.** Its own `{ runs, probingEmissions }` pin on the strict Pi mock that `registerCommandWithCache` builds is unchanged. Its four boundary calls lost only the `0`.
- **Emission counts, `cwd` statements, and assertion bodies.** For each of the 30 substituted suites, the HEAD version with the same substitution applied, formatted by Prettier, with comment lines removed, is identical to the new file with comment lines removed. So every emission count, every `cwd` statement, and every ordering, call-count, and fault-injection assertion is intact.

## Decisions Made

- `loadExtension` composes its `verifyBoundary` from the boundary's and its own `verify(pi)`, so the 20 case bodies that call it did not change. The plan's "verifies it beside `verifyBoundary`" holds, and no case can forget the second verify.
- `rootReads` covers both roots the suite drives. The owner-graph case reads three times for one registered-command run, not for a discover pass. The doc says so instead of claiming only discover passes read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Suite headers described the removed probe count**

- **Found during:** Task 1
- **Issue:** 23 suite headers and one in-case comment said a case "sizes the boundary at ... zero probes", "states zero tool probes", or that "the boundary's strict `pi` mock fails on any `getAllTools()` read". After the change the boundary has no probe count and no Pi mock, so those sentences described code that does not exist. `tests/edge/handlers/plugin/update.test.ts` also still claimed a delegating case read `pi.getAllTools()` SIX times, which was already stale after 01-13.
- **Fix:** Dropped the probe-count clauses. Kept or restated the D-05 reason, which is that the handler or orchestrator renders from the run and holds no tool inventory, as a present-tense fact. The `cwd` and emission prose is unchanged.
- **Files modified:** 23 suites in the Task 1 commit (the edge handler suites, `router`, `import/execute`, `reconcile/apply`, `reconcile/pending`)
- **Verification:** `rg -n -i "zero (tool )?probes|tool probes" tests` now matches only `catalog-uat/mock-pi.ts` and `orchestrators/plugin/info.test.ts`. Neither uses the boundary. The normalized code diff above is empty.
- **Committed in:** `bc19ebd6`

---

**Total deviations:** 1 auto-fixed (comment accuracy).
**Impact on plan:** No scope change. Comments only; no code or bytes moved.

## Issues Encountered

- The first substitution attempt did nothing, because zsh does not word-split `$FILES`. It was re-run through `xargs`. The call parser confirmed 336 converted sites and no leftover `0` second argument.
- `fallow audit` returned `warn` before each commit. The 16 clone groups are the accepted `dup:c77b3abb6f87acd9` family plus the inherited `dup:3a760d12` in `enable-disable.ts`/`install-flow.ts`. None is in this plan's files, and there were no dead-code or complexity findings.
- Out of scope, noted for 01-16: `tests/edge/register.test.ts`'s `CommandProbes.probingEmissions` is 0 at every call site. It describes surfaces that "still probe the Pi handle once per emission", and after 01-14 none does. It belongs to that suite's own Pi mock, not the boundary, so this plan left it. It can go when 01-16 removes the notify family's `ToolInventory` branch.

## Verification

- Task 1: the 31 boundary suites passed 1203/1203 before the commit and again after it (tracer gate). `rg -n 'toolProbes' tests` prints nothing. The corpus check passed.
- Task 2: `node --test tests/index.test.ts tests/edge/register.test.ts tests/edge/router.test.ts tests/edge/handlers/shared.test.ts` passed 257/257. The `readonly pi|const pi =|verify\(pi\)` gate over the boundary prints nothing. A multiline `rg -U` finds no caller destructuring `pi` from the boundary.
- `npm run lint:type-members` passed with the 4 recorded exceptions, and no pin moved (no production file changed).
- Pre-commit on each task's files (`SKIP=trufflehog`) passed every hook, with no file rewritten.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 10 extra`. No line starts with `missing in ` or says `refused:`.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7359/7359, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-28 is mitigated as planned. No handler factory or orchestrator holds a Pi inventory to probe with. The root reads stay pinned on strict mocks in `tests/edge/register.test.ts` (including the SC-3 case) and in `tests/index.test.ts`, and 01-16 removes the notify family's inventory branch. T-01-SC: no package was installed.

## Next Phase Readiness

- Ready for 01-16. The boundary carries no probe state, so narrowing the notify family to `NotificationRun` touches no boundary caller.
- 01-16 still owns the `ToolInventory` branch, `workflows-marker-coverage.test.ts`'s `renderThroughNotify`, `register.test.ts`'s always-zero `probingEmissions`, and the phase gate.

## Self-Check: PASSED

- Commits `bc19ebd6` and `e3268151` exist on `features/json`.
- All 32 modified files listed above are in `git diff --name-only 837b25a1..e3268151`.
