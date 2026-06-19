---
phase: 60-hook-execution-payload-translators-env-vars
plan: 02
subsystem: bridges
tags: [hooks, exec, spawn, wire-protocol, env-vars, claude-code, esm, node-test]

requires:
  - phase: 60-hook-execution-payload-translators-env-vars
    provides: 8 payload translators + mapPiToClaudeToolName + TranslationContext (Plan 60-01)
  - phase: 59-bridge-dispatch-core-debug-seam
    provides: registerHooksBridge + composite handler + dispatchHookExec no-op stub + hookDebugLog seam + RoutingEntry shape
provides:
  - HookExecResult discriminated-union outcome type (4 arms; assertNever NFR-7 gate)
  - parseHookStdout wire-protocol parser (exit 2 -> block; exit 0 + JSON -> outcome per claude-hook-config-syntax section 4; permissive default for non-zero / signal-kill)
  - installTimerLadder SIGTERM -> 5s -> SIGKILL escalation helper with TOCTOU defense
  - dispatchHookExec body-filled returning Promise<HookExecResult> (EXEC-01..04 + PAYL-01 wiring + HOOK-05 env vars)
  - registerHooksBridge gates a per-scope _shared data-dir mkdir-p on at least one SessionStart entry being present (D-60-06)
  - tests/architecture/hooks-exec.test.ts Wave 0 architecture pin (Blocks A-F across 20 tests)
  - Architecture whitelist widened from 1 to 2 sanctioned node:child_process import sites
affects:
  - 60-03 (reducer + per-event adapter -- consumes HookExecResult to compose outcomes across composite-handler buckets)
  - 60-04 (lifecycle hardening WR-01 + WR-03)

tech-stack:
  added: []
  patterns:
    - "Discriminated outcome union (D-60-01 / NFR-7) -- four kind-tagged arms with assertNever exhaustiveness gate"
    - "Test seam mirroring dispatch.ts's _setExecutorForTest -- _setSpawnForTest / _resetSpawnForTest substitutes the spawn impl for the duration of a unit test (bridge-internal, NOT re-exported)"
    - "Structural ChildLike interface in exec-timer.ts so the helper stays outside the node:child_process import whitelist"
    - "Wave 0 architecture pin -- per-block layout (Blocks A-F) keyed by REQ-ID + decision IDs, with EXEC-04 / HOOK-05 driven by table fixtures sweeping all 4 form combinations and 8 bucket-A events"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
    - tests/bridges/hooks/wire-protocol.test.ts
    - tests/bridges/hooks/exec-timer.test.ts
    - tests/architecture/hooks-exec.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts (body filled; signature Promise<void> -> Promise<HookExecResult>; _setSpawnForTest seam added)
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (RoutingEntry gains claudeEvent: BucketAEvent populated during flatten; registerHooksBridge gains gated _shared mkdir-p helper)
    - tests/architecture/no-shell-out.test.ts (ALLOWED_CHILD_PROCESS_FILES widened from 1 to 2 entries; sibling assertion renamed "exactly two files")
    - tests/architecture/hooks-dispatch.test.ts (makeEntry helper updated for new claudeEvent field; _setExecutorForTest stubs return {kind:"noop"} for the evolved signature)
    - tests/bridges/hooks/event-router.test.ts (same makeEntry + stub updates)
    - tests/bridges/hooks/dispatch-exec.test.ts (extended from 3-test stub to 15 fixtures covering EXEC-01..04 + HOOK-05 + D-60-06 + PAYL-01 wiring + wire-protocol integration + never-throws baseline)

key-decisions:
  - "Wire-protocol exit 1 / signal-kill -> noop + hookDebugLog (D-60-01 v1.13 permissive default per Research Open Q2; security-default revisit is v1.14+ scope)"
  - "_truncated: true marker placed at the top level of the stdin JSON (Research Discretion + Pitfall 5 -- top-level placement so hook authors can detect truncation without knowing per-event nesting)"
  - "Buffer overflow on stdout/stderr -> kill + hookDebugLog + noop (consistent with the non-zero exit default; NOT a defensive block)"
  - "HookExecResult sibling file at bridges/hooks/exec-result.ts (Research Open Q3 recommendation) so the reducer + adapter in the next plan can both import"
  - "Timer ladder in a dedicated exec-timer.ts module with structural ChildLike type -- keeps the helper outside the node:child_process import whitelist and unit-testable via t.mock.timers in isolation"
  - "_shared mkdir-p gated on at least one SessionStart entry existing in the rebuilt routing table for the scope -- an unconditional mkdir on a pristine scope would create <scopeRoot>/pi-claude-marketplace/data/_shared/ and violate WR-05 (the no-files-on-clean-reconcile invariant pinned by tests/edge/index-handler.test.ts). Plan-text deviation documented under Deviations -> Rule 1 Bug fix"
  - "RoutingEntry gains a claudeEvent: BucketAEvent field populated during the flatten walk so dispatch-exec can pick the right translator and decide CLAUDE_ENV_FILE applicability without re-deriving the bucket from the outer routingTable Map key (plan-text said `entry.claudeEvent` but Phase 59's RoutingEntry shape did not have this field; added as the cleanest way to honor the planned reference)"

patterns-established:
  - "Per-event translator dispatch via a Record<BucketAEvent, (event:never,ctx:TranslationContext)=>unknown> table inside dispatch-exec.ts; the dispatcher casts the runtime `event: unknown` to `never` at the call site and lets the typed entry.claudeEvent narrow the bucket selection at compile time"
  - "Manual stdout/stderr buffer accumulation with named caps (STDOUT_MAX_BYTES = 1 MB, STDERR_MAX_BYTES = 64 KB, STDIN_TRUNCATION_BYTES = 256 KB) -- maxBuffer does NOT apply to spawn, so accumulate-and-cap is the canonical primitive"
  - "TOCTOU defense: every timer callback that fires kill(signal) MUST first check !child.killed; the structural ChildLike.killed getter exposes the property without importing node:child_process"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03, EXEC-04, HOOK-05]

duration: ~45min
completed: 2026-06-15
---

# Phase 60 Plan 02: Hook Execution Body, Wire Protocol, Env Vars Summary

**`dispatchHookExec` body filled with the real spawn body + per-event payload translation + HOOK-05 env vars + EXEC-02 timer escalation + EXEC-03 stderr sole-sink; ships `HookExecResult` + `parseHookStdout` + `installTimerLadder` as siblings; architecture whitelist widened to 2 entries.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-15T02:35:15Z
- **Completed:** 2026-06-15T03:19:42Z
- **Tasks:** 3
- **Files modified:** 12 (6 created + 6 modified)
- **Test impact:** +49 tests added (15 wire-protocol fixtures + 4 timer-ladder fixtures + 15 dispatch-exec fixtures + 20 architecture-pin tests, minus existing-test reshape)
- **`npm run check`:** GREEN -- 2046 unit tests + 10 integration tests

## Accomplishments

- **`HookExecResult` discriminated union** (4 arms: `noop` / `block` / `mutate` / `stop`) + `assertNever` exhaustiveness gate at `bridges/hooks/exec-result.ts`. Pure leaf -- zero imports. Drives NFR-7 across every downstream consumer (the reducer + per-event adapter in Plan 60-03 import this type as the seam contract).
- **`parseHookStdout` wire-protocol parser** at `bridges/hooks/wire-protocol.ts` -- the sole site that knows Claude's stdout JSON contract. Branches:
  - exit 2 -> `block` (stderr trimmed as reason)
  - non-zero / signal-kill -> `noop` + `hookDebugLog` (permissive default)
  - exit 0 + empty stdout -> `noop`
  - exit 0 + JSON.parse failure -> `noop` + `hookDebugLog`
  - exit 0 + JSON normalized per `docs/research/claude-hook-config-syntax.md § 4`:
    - top-level `continue: false` -> `stop`
    - top-level `decision: "block"` -> `block`
    - `hookSpecificOutput.permissionDecision: "deny"` -> `block`
    - `hookSpecificOutput.updatedInput` / `updatedToolOutput` / `additionalContext` / `permissionDecision: "allow" \| "ask"` -> `mutate`
    - top-level `suppressOutput: true` -> `noop { suppressOutput: true }`
- **`installTimerLadder`** at `bridges/hooks/exec-timer.ts` -- EXEC-02 SIGTERM -> 5s grace -> SIGKILL escalation. Two `setTimeout` handles, both `.unref()`'d so a leaked timer never holds the loop open. Both callbacks guard on `!child.killed` (TOCTOU defense). The structural `ChildLike` interface lets the helper stay outside the `node:child_process` import whitelist.
- **`dispatchHookExec` body filled** with:
  - per-event translator dispatch keyed by `entry.claudeEvent` -- a `Record<BucketAEvent, ...>` table imports all 8 Plan 60-01 translators by name;
  - serialize-with-truncation: when raw stringified payload > 256 KB, inject top-level `_truncated: true` marker via shallow object spread + re-serialize;
  - HOOK-05 env: `process.env` + `CLAUDE_PROJECT_DIR = ctx.cwd` + `CLAUDE_PLUGIN_ROOT = <extensionRoot>/plugins/<pluginId>` + `CLAUDE_PLUGIN_DATA = <dataRoot>/<pluginId>`, all containment-guarded via `assertPathInside` (NFR-10); SessionStart additionally sets `CLAUDE_ENV_FILE = <dataRoot>/_shared/claude-env-<sessionId>.env` (D-60-06); `CLAUDE_CODE_REMOTE` intentionally unset (documented in source);
  - EXEC-04 plan: `entry.handlerDecl.args !== undefined` -> exec-form `spawn(command, args, { shell: false })`; otherwise -> shell-form `spawn(command, [], { shell: entry.handlerDecl.shell ?? true })`. `args: []` is exec-form per the "defined" discriminator (not "non-empty");
  - EXEC-02 ladder via `installTimerLadder` + `ladder.cancel()` on `close` AND `error` events to close the TOCTOU window;
  - manual stdout 1 MB / stderr 64 KB caps (maxBuffer doesn't apply to spawn); overflow kills + falls back to `noop`;
  - EPIPE defense: `child.stdin.on("error", hookDebugLog)` attached BEFORE `child.stdin.end(payload)`;
  - EXEC-03: stderr sole-sink through `hookDebugLog`; ZERO `ctx.ui.notify`;
  - never-throws: outer try/catch resolves every error path to `{ kind: "noop" }`.
- **`_setSpawnForTest` / `_resetSpawnForTest` test seam** mirrors `_setExecutorForTest` in `dispatch.ts`. Bridge-internal -- not re-exported.
- **`RoutingEntry` gains `claudeEvent: BucketAEvent`** populated during the flatten walk so dispatch-exec can pick the right translator and decide CLAUDE_ENV_FILE applicability without re-deriving the bucket from the outer routingTable Map key.
- **Architecture whitelist widened** -- `ALLOWED_CHILD_PROCESS_FILES` goes from 1 to 2 entries; sibling assertion renamed `whitelist: exactly two files may import node:child_process`; docstring records the second sanctioned site (`bridges/hooks/dispatch-exec.ts`) with the EXEC-01..04 / D-60-01 justification.
- **`_shared` data-dir mkdir-p** at `registerHooksBridge` factory time per scope, gated on at least one SessionStart entry actually being present in the rebuilt routing table (see Deviations for the WR-05 trade-off).
- **Wave 0 architecture pin** at `tests/architecture/hooks-exec.test.ts` (Blocks A-F across 20 tests) -- pins every load-bearing EXEC / HOOK / D-60 invariant against single-line regression.
- **`npm run check` GREEN**: 2046 unit tests + 10 integration tests.

## Task Commits

1. **Task 1: Ship HookExecResult discriminated union, wire-protocol parser, and timer ladder helper** -- `3bbd4b3` (feat)
2. **Task 2: Fill dispatch-exec.ts body, evolve signature to Promise<HookExecResult>, and widen architecture whitelist** -- `6e09a97` (feat)
3. **Task 3: mkdir-p _shared at registerHooksBridge factory time + Wave 0 architecture pin for EXEC-01..04 / HOOK-05 / D-60-06** -- `ce1b169` (test)

## Files Created/Modified

### Created

- `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts` -- `HookExecResult` 4-arm discriminated union + `assertNever` (D-60-01 / NFR-7).
- `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts` -- `parseHookStdout` pure function (D-60-01 wire-protocol-to-outcome mapping); never throws.
- `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` -- `installTimerLadder` + `TimerLadder` + structural `ChildLike` interface (EXEC-02; TOCTOU defense via `!child.killed` guard).
- `tests/bridges/hooks/wire-protocol.test.ts` -- 15 unit fixtures (11 branches of `parseHookStdout`).
- `tests/bridges/hooks/exec-timer.test.ts` -- 4 unit fixtures (SIGTERM timing; SIGKILL escalation; cancel; TOCTOU).
- `tests/architecture/hooks-exec.test.ts` -- Wave 0 architecture pin (Blocks A-F; 20 tests).

### Modified

- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` -- body fill; signature evolved `Promise<void>` -> `Promise<HookExecResult>`; `_setSpawnForTest` test seam added.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` -- `RoutingEntry` gains `claudeEvent: BucketAEvent` populated during the flatten walk; new `ensureSharedDataDir(loc)` helper imported from `node:fs/promises` `mkdir`; `registerHooksBridge` calls it once per scope after `rebuildRoutingTables`, gated on `(routingTable.get("SessionStart") ?? []).length > 0`.
- `tests/architecture/no-shell-out.test.ts` -- `ALLOWED_CHILD_PROCESS_FILES` widened 1 -> 2 entries; sibling assertion renamed; docstring records the second sanctioned site with justification.
- `tests/architecture/hooks-dispatch.test.ts` -- `makeEntry` test helper extended with optional `claudeEvent`; `_setExecutorForTest` stubs return `{ kind: "noop" as const }` to match the evolved `Promise<HookExecResult>` signature.
- `tests/bridges/hooks/event-router.test.ts` -- same `makeEntry` + stub updates.
- `tests/bridges/hooks/dispatch-exec.test.ts` -- extended from the 3-test no-op stub to 15 fixtures covering: never-throws baseline (spawn error -> noop; arbitrary event shapes; EXEC-01 spawn.cwd; EXEC-01 + HOOK-05 env-var merge); D-60-06 CLAUDE_ENV_FILE SessionStart-only + path-scheme; EXEC-04 four discrimination cases (args undefined; args:[]; shell:"/bin/bash"; shell binary set); EXEC-02 stdin truncation; EXEC-03 stderr-debug-log routing; wire-protocol integration (exit 2 -> block, continue:false -> stop); PAYL-01 stdin payload shape (PreToolUse hook_event_name + capitalized tool_name).

## Pi-side / Claude-side dispatch traceability

| EXEC step | What the body does | Anchor |
| --- | --- | --- |
| 1. translate | `TRANSLATORS[entry.claudeEvent](event, transCtx)` -- selects the per-event Plan 60-01 translator | PAYL-01 + D-60-04 |
| 2. serialize | `JSON.stringify(payload)`; if > 256 KB, spread `{ _truncated: true, ...payload }` and re-serialize | EXEC-02 |
| 3. env | `process.env` + 3 always-set CLAUDE_* vars + (SessionStart only) `CLAUDE_ENV_FILE`; `CLAUDE_CODE_REMOTE` unset; containment via `assertPathInside` | HOOK-05 + D-60-06 + NFR-10 |
| 4. plan spawn | `entry.handlerDecl.args !== undefined` -> exec-form `{ shell: false }`; otherwise shell-form `{ shell: handlerDecl.shell ?? true }` | EXEC-04 |
| 5. spawn + ladder | `activeSpawn(command, args, opts)` + `installTimerLadder(child, timeoutMs)`; `ladder.cancel()` wired on `close` AND `error` events | EXEC-01 + EXEC-02 + TOCTOU |
| 6. accumulate | manual stdout cap 1 MB, stderr cap 64 KB; overflow kills + sets `overflowed = true` | EXEC-02 |
| 7. stdin | `child.stdin.on("error", hookDebugLog)` BEFORE `child.stdin.end(json)` (EPIPE defense) | EXEC-02 + EPIPE |
| 8. parse | on `close`, route stderr through `hookDebugLog`, return `parseHookStdout(code, stdout, stderr)`; on overflow return `{ kind: "noop" }` | EXEC-03 + D-60-01 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WR-05 violation: unconditional `_shared` mkdir-p in `registerHooksBridge`**

- **Found during:** Task 3 verification (`npm run check`).
- **Issue:** The plan's prose for D-60-06 calls for `_shared` to be mkdir-p'd "once per `registerHooksBridge` factory call" unconditionally. The existing WR-05 invariant pinned by `tests/edge/index-handler.test.ts:115` requires that "a clean reconcile against an empty scope" creates no files in either `<cwd>/.pi/` or `<home>/.pi/`. An unconditional mkdir on a pristine scope creates `<scopeRoot>/pi-claude-marketplace/data/_shared/` (which in turn creates the entire `<scopeRoot>/pi-claude-marketplace/` tree above it), and the RECON-04 wiring test red-failed with "WR-05: a clean reconcile must not create user-scope files either".
- **Fix:** Gated `ensureSharedDataDir(loc)` on `(routingTable.get("SessionStart") ?? []).length > 0`. When no plugin declares SessionStart hooks, the env-file path will never be set, so the dir's absence is harmless; when at least one SessionStart plugin is present, the mkdir runs (containment-guarded via `assertPathInside`, failure routes through `hookDebugLog`). The architecture-pin Block F tests were updated in lockstep: Test 1 seeds a SessionStart-bearing `state.json` + `hooks.json` fixture under both scopes' extensionRoots so the gate fires; a new sibling test asserts the WR-05 inverse (a clean scope creates neither the extensionRoot nor `<cwd>/.pi`).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` + `tests/architecture/hooks-exec.test.ts` (Block F).
- **Verification:** `npm run check` GREEN end-to-end after the gate.
- **Committed in:** `ce1b169` (Task 3 commit -- the fix landed atomically with the Block F architecture pin).

**2. [Rule 1 - Bug] `RoutingEntry` shape did not carry the `claudeEvent` field the plan referenced as `entry.claudeEvent`**

- **Found during:** Task 2 typecheck (after writing dispatch-exec.ts body).
- **Issue:** Plan 60-02's prose consistently references `entry.claudeEvent` (used to select the translator, decide CLAUDE_ENV_FILE applicability). Phase 59's `RoutingEntry` did not carry this field -- the bucket key was the only source of truth for which Claude event the entry was flattened into.
- **Fix:** Added `claudeEvent: BucketAEvent` as a required field on `RoutingEntry`; populated it during the flatten walk in `flattenPluginIntoBuckets`. The Phase 59 architecture-pin tests (`tests/architecture/hooks-dispatch.test.ts`) and the unit-test suite for event-router (`tests/bridges/hooks/event-router.test.ts`) had their `makeEntry` helpers extended with an optional `claudeEvent` defaulting to `"PreToolUse"` so existing call sites stay unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` + the two test files above.
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean; existing dispatch tests stay GREEN; the architecture-pin Block A test asserts the field flows into the spawn-spy fixtures.
- **Committed in:** `6e09a97` (Task 2 commit -- the addition landed atomically with the body fill).

**3. [Rule 1 - Bug] Phase 59 `_setExecutorForTest` injectee signature returns `Promise<void>` but seam contract evolved to `Promise<HookExecResult>`**

- **Found during:** Task 2 typecheck (after evolving `dispatchHookExec` signature).
- **Issue:** Existing tests in `tests/architecture/hooks-dispatch.test.ts` and `tests/bridges/hooks/event-router.test.ts` injected `_setExecutorForTest((entry) => { ...; return Promise.resolve(); })`. The widened return type rejected `void` as not assignable to `HookExecResult`.
- **Fix:** Sed-replaced `return Promise.resolve();` -> `return Promise.resolve({ kind: "noop" as const });` across both files. Behavior preserved -- the existing tests only assert on the dispatch side-effects (fired pluginIds, fire ordering), never on the returned outcome.
- **Files modified:** `tests/architecture/hooks-dispatch.test.ts` + `tests/bridges/hooks/event-router.test.ts`.
- **Verification:** Both test files stay GREEN against the evolved seam.
- **Committed in:** `6e09a97` (Task 2 commit).

**4. [Rule 1 - Bug] Cognitive complexity error in `normalizeClaudeStdout`**

- **Found during:** Task 1 pre-commit (`npm lint`).
- **Issue:** SonarJS reported cognitive complexity 35 vs allowed 15 on the initial draft of `normalizeClaudeStdout`.
- **Fix:** Decomposed into `matchTopLevelStopOrBlock`, `matchHookSpecificOutput`, and `buildMutateFromHso` helpers. Each is single-purpose; the top-level function now early-returns on each branch. Behavior byte-identical (all 15 wire-protocol fixtures stayed GREEN before/after).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts`.
- **Verification:** Pre-commit GREEN; tests GREEN.
- **Committed in:** `3bbd4b3` (Task 1 commit).

**5. [Rule 1 - Bug] ESLint flat-config violations on Task 2 test fixtures**

- **Found during:** Task 2 pre-commit.
- **Issue:** `@typescript-eslint/non-nullable-type-assertion-style`, `@typescript-eslint/no-unnecessary-type-assertion`, `@typescript-eslint/no-empty-function`, and `@typescript-eslint/no-non-null-asserted-optional-chain` on the spawn-spy mock + the `(event as unknown as ToolCallEvent)` casts that `eslint --fix` had auto-converted.
- **Fix:** (a) ran `npx eslint --fix` to clean the auto-fixable subset; (b) manually replaced empty `read() {}` Readable callbacks with a named `noopRead = (): void => undefined` constant + JSDoc; (c) replaced `spy.calls[0]?.options.env!` with `(spy.calls[0]?.options.env ?? {})`; (d) dropped the unused `InputEvent`/`SessionStartEvent`/`ToolCallEvent` type imports (the casts were auto-removed by `--fix`).
- **Files modified:** `tests/bridges/hooks/dispatch-exec.test.ts` + `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (Sonar-flagged `String(string)` redundancy + `child.stdin !== null` redundant condition cleaned up to satisfy the linter).
- **Verification:** Pre-commit GREEN.
- **Committed in:** `6e09a97` (Task 2 commit).

---

**Total deviations:** 5 auto-fixed (1 real-bug fix, 1 plan-text-vs-existing-shape gap, 1 mechanical seam-signature ripple, 1 cognitive-complexity refactor, 1 mechanical lint fix-up).
**Impact on plan:** Scope unchanged; deliverables all present; architecture-pin Block F gained a sibling WR-05 inverse test as a bonus invariant.

## Issues Encountered

None significant. The plan-execution flow tracked the Plan 60-01 patterns (architecture-test scaffolding, ESLint flat-config conventions, per-block layout). The cognitive-complexity refactor in Task 1 and the WR-05 gate in Task 3 were the only places where the initial draft needed structural rework.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts` exists -- FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts` exists -- FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` exists -- FOUND
- `tests/bridges/hooks/wire-protocol.test.ts` exists -- FOUND
- `tests/bridges/hooks/exec-timer.test.ts` exists -- FOUND
- `tests/architecture/hooks-exec.test.ts` exists -- FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` modified (body filled) -- FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` modified (RoutingEntry + ensureSharedDataDir) -- FOUND
- `tests/architecture/no-shell-out.test.ts` whitelist widened -- FOUND (`ALLOWED_CHILD_PROCESS_FILES` contains 2 entries; "exactly two files" assertion in place)
- Task 1 commit `3bbd4b3` -- FOUND in `git log`
- Task 2 commit `6e09a97` -- FOUND in `git log`
- Task 3 commit `ce1b169` -- FOUND in `git log`
- `npm run check` -- 2046 unit + 10 integration GREEN
- `npx tsc --noEmit -p tsconfig.json` -- exit 0
- Comment policy gate (`Phase N` / `Plan N` / `Pitfall N` / `Pattern N` ban) -- no offenders in any new/modified source file (verified by `grep -nE`)

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Plan 60-03 (the dispatch reducer + per-event adapter -- D-60-02 + D-60-03) can now:

1. Import `HookExecResult` + `assertNever` from `bridges/hooks/exec-result.ts` to type the composite-handler reducer's accumulator + per-event adapter return shapes.
2. Replace Phase 59's `await activeExecutor(entry, event, ctx);` in `dispatch.ts` with a reducer over the returned `HookExecResult`:
   - `kind: "block"` -> short-circuit the bucket and route to the per-Pi-event adapter (which returns `{ block: true, reason }` for the tool/result/input events; debug-log + drop for the observation-only events);
   - `kind: "stop"` -> terminate the chain;
   - `kind: "mutate"` -> apply the mutation to the in-place `event` so entry N+1 sees the post-mutation state (Pitfall 1 + D-60-02 left-to-right composition);
   - `kind: "noop"` -> continue.
3. Lift the per-event adapter table (D-60-03) into `bridges/hooks/event-adapters.ts` (or inline in `dispatch.ts` -- planner's choice).

`dispatch.ts` is unchanged in this plan -- Plan 60-03 owns the reducer migration. No blockers. The exec-layer contract is frozen for the rest of Phase 60.

---
*Phase: 60-hook-execution-payload-translators-env-vars*
*Completed: 2026-06-15*
