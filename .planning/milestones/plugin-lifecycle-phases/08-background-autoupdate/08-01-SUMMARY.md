---
phase: 08-background-autoupdate
plan: 01
subsystem: marketplace
tags: [autoupdate, background, gate, scheduler, env-policy, timers]

requires: []
provides:
  - "orchestrators/marketplace/background-gate.ts: createBackgroundGate() and BackgroundGate { runForeground, beginStep, endStep, stepSettled }"
  - "orchestrators/marketplace/background-pass.ts: createBackgroundPass(deps), BackgroundPass, BackgroundPassRun, BackgroundPassDeps, BackgroundContext"
  - "orchestrators/marketplace/background-update.ts: createBackgroundUpdate(deps), BackgroundUpdate { onInput, onShutdown }, BackgroundUpdateDeps"
  - "registerClaudePluginCommand options bag: optional runForeground runner"
  - "index.ts: one backgroundGate per runtime; pi.on('input') and pi.on('session_shutdown') for the background update"
affects: [08-03 background-update notice (widens BackgroundPassDeps.pi, collects updated outcomes), 08-04 behavioral scenario]

actuals:
  tokens: 17500
  tasks: 2
  commits: 2
plan_head_before: 5335d6ed4bc3186b32248747ccbba953c7715554
plan_head_after: d7922c7d127dc2b5f0fd2b01b004f8d5c22a41a7

tech-stack:
  added: []
  patterns:
    - "Gate members and Pi listeners declared as readonly function properties, so index.ts passes them by reference and gains no function or branch"
    - "Background work reports through a print-mode context that forwards text to hookDebugLog and a load-origin run whose entry sink drops entries"
    - "A yielding PluginUpdateFn wrapper: endStep, beginStep, isStopped check, then the real update"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
    - test/orchestrators/marketplace/background-gate.test.ts
    - test/orchestrators/marketplace/background-pass.test.ts
    - test/orchestrators/marketplace/background-update.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/index.ts
    - test/edge/register.test.ts
    - test/index.test.ts

key-decisions:
  - "The not-run outcome of a plugin update skipped after shutdown carries the note 'the session ended before this update ran' and an empty reason list (D-PL8-15)"
  - "onShutdown sets stopped and clears the timer before its try block; only the reason read and the step wait sit inside it (style rule: a try covers only what can throw)"
  - "The env type is inlined on BackgroundUpdateDeps (helpers read BackgroundUpdateDeps['env']) because fallow reports a private type alias in an exported signature"

patterns-established:
  - "Index-test captures for a listener registered under an event name the hooks bridge also uses are declared in index.ts's registration order; the header names their ordinal"

requirements-completed: [AUP-01, AUP-02]

coverage:
  - id: D1
    description: "Every /claude:plugin command runs through the background gate; a command waits for at most one background step and no step begins while a command runs (D-PL8-04)"
    requirement: AUP-01
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/background-gate.test.ts (7 cases)"
        status: pass
      - kind: unit
        ref: "test/edge/register.test.ts#runs the routed command inside the supplied foreground runner"
        status: pass
      - kind: unit
        ref: "test/edge/register.test.ts#refuses an unsupported mode before it enters the foreground runner"
        status: pass
    human_judgment: false
  - id: D2
    description: "One background pass updates each autoupdate marketplace, project first, through a silent load run, yielding to commands between steps and stopping on shutdown (D-PL8-05, D-PL8-06, D-PL8-07, D-PL8-12, D-PL8-15)"
    requirement: AUP-01
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/background-pass.test.ts (10 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "First-input scheduler with the tui/rpc mode gate, random delay, unref'd timer, Claude Code opt-outs, the delay knob, and shutdown handling (D-PL8-02, D-PL8-03, D-PL8-08, D-PL8-09, D-PL8-13, D-PL8-14)"
    requirement: AUP-02
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/background-update.test.ts (66 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "index.ts registers the background update on input and session_shutdown; a tui message arms one unref'd timer that quitting cancels; print and json arm nothing"
    requirement: AUP-01
    verification:
      - kind: unit
        ref: "test/index.test.ts#AUP-01: the first plain message in a tui session arms one unref'd background update that quitting cancels"
        status: pass
      - kind: unit
        ref: "test/index.test.ts#AUP-01: a plain message in print|json arms no background update"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-10-27
status: complete
---

# Phase 8 Plan 01: Background Autoupdate Pass Summary

**The first message of a tui or rpc runtime now arms one delayed, unref'd pass that runs `marketplace update`'s refresh and cascade for each autoupdate marketplace, silently and one gate step at a time, while every `/claude:plugin` command waits for at most one background step.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-27T03:25:22Z
- **Completed:** 2026-10-27T04:00:24Z
- **Tasks:** 2
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- `background-gate.ts`: a counting gate. `runForeground` waits for the step in flight and blocks new steps; `beginStep` loops until no command runs; commands still run together. No timeout (CONTEXT known limit).
- `edge/register.ts`: the command handler returns `runForeground(() => runCommand(...))`; the mode check and route selection stay outside, so the unsupported-mode throw stays synchronous.
- `background-pass.ts`: reads each scope's records and merged config (project first), calls the injected `updateMarketplace` with a print-mode silent context and a load-origin run, wraps the plugin update runner to yield before each plugin, ends the pass on `InvalidGitHubBaseUrlError`, and debug-logs any other throw under the `autoupdate` tag.
- `background-update.ts`: arms on the first `input` in `tui`/`rpc`, reads Claude Code's four variables at arm time, applies the delay knob (digits only, at most 2147483647), schedules on Node's global `setTimeout` and unrefs it; `onShutdown` stops, cancels, and waits for the step in flight unless the reason is `quit`. Every handler catches and debug-logs (NFR-2).
- `index.ts`: wires the gate into the command and registers `pi.on("input", backgroundUpdate.onInput)` and `pi.on("session_shutdown", backgroundUpdate.onShutdown)` by reference, after `registerHooksBridge`; `resources_discover` is unchanged.

## Task Commits

1. **Task 1: Every /claude:plugin command runs through the background gate** - `62d51d28` (feat)
2. **Task 2: The first message arms one background pass over the autoupdate marketplaces** - `d7922c7d` (feat)

Both commits passed the pre-commit hook (`npm run check:commit`: typecheck, ESLint, fallow, Prettier, pairing, feature check, unpaired tests, direct coverage of the staged pairs), Node v26.12.1, without `--no-verify`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts` - the in-process foreground priority gate
- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts` - one silent pass over `updateMarketplace`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts` - env policy, first-input scheduler, shutdown handling
- `extensions/pi-claude-marketplace/edge/register.ts` - optional `runForeground` option wrapping the routed command
- `extensions/pi-claude-marketplace/index.ts` - gate, background update construction, and the two listeners
- `test/orchestrators/marketplace/background-{gate,pass,update}.test.ts` - owner suites (7, 10, and 66 cases)
- `test/edge/register.test.ts` - `runForeground` probe plus two cases
- `test/index.test.ts` - two new captures on `LoadedExtension` plus three cases

## Files touched outside the Files line

- `extensions/pi-claude-marketplace/edge/register.ts` - the gate's command wrap: the command handler is the only place a `/claude:plugin` command can be run through the gate.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts` and `background-update.ts` - the two background modules beyond the gate: the plan splits the pass (reuse of `updateMarketplace`) from the scheduler (env policy, timer, shutdown) so each has its own paired test.
- `test/orchestrators/marketplace/background-gate.test.ts`, `background-pass.test.ts`, `background-update.test.ts` - the required paired owner tests (100% direct coverage).
- `test/edge/register.test.ts` - paired test of `register.ts`; proves the command runs inside the runner and the mode check stays outside it.
- `test/index.test.ts` - paired test of `index.ts`; the strict Pi mock must state the two new registrations, and the new cases prove the wiring.

## Decisions Made

- The not-run plugin outcome's note text is `the session ended before this update ran` (plan left the wording open).
- `onShutdown` sets `stopped` and clears the timer outside its `try`, so a throwing event still stops the runtime.
- The env record type is inlined on `BackgroundUpdateDeps`; a module-private alias tripped fallow's private-type-leak check.

## Uncertain choices (for review)

1. Scheduler case 8 ("each opt-out above paired with `FORCE_AUTOUPDATE_PLUGINS` set to `1`, ` TRUE `, or `yes`"): read as the cross product of the six single-variable opt-outs with the three spellings (18 rows). The seventh opt-out row already carries `FORCE_AUTOUPDATE_PLUGINS=0`, so it was not paired again.
2. Scheduler case 16 (NFR-2) is split into three tests, one per handler (input, shutdown, timer callback), so each failure names its handler.
3. The index arming case deletes all four Claude Code variables, `FORCE_AUTOUPDATE_PLUGINS` included, so the developer's shell cannot change the outcome.
4. Pass case 6 also asserts the exact `skipped the project scope` debug line, which the plan did not require.
5. Pass case 10 observes the moment the pass waits through a wrapper around the real gate's `beginStep`. Without it, the case could not tell "stopped while waiting" apart from "stopped before reading the scopes".
6. Gate cases 1 and 7 ("runs at once") prove the command ran before a `setImmediate` drain. A gate that wrongly waits forever fails them because the event loop runs out of work, not because an assertion fails.

## Deviations from Plan

None - plan executed exactly as written. The fixes below were to code this plan wrote, caught by the commit hook before any commit landed.

## Issues Encountered

- Task 1 first commit attempt: ESLint `@stylistic/padding-line-between-statements` in the gate test's `deferred()` helper. Fixed and recommitted.
- Task 2: fallow `private-type-leak` on a module-private `Environment` alias (fixed by inlining); a TS2322 in the new index cases (`mode: string` passed where `ExtensionMode` is required; fixed with `ExtensionContext["mode"]` and an `as const` row list); a gitlint title of 73 characters (shortened to 71).
- A mutation check confirmed the index arming case fails (`The following calls were unexpected`) when `onShutdown` does not cancel the timer.

## Known Stubs

None. The pass collects no outcomes and raises no notice yet. This is intentional: 08-03 adds the collection and the `background-update` notice (AUP-03).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-03 can widen `BackgroundPassDeps.pi` to carry the entry sink, collect `updated` outcomes in the yielding wrapper, and raise the notice after the pass, checking `isStopped()` first (D-PL8-15).
- The pass is silent today; only `PI_CLAUDE_MARKETPLACE_DEBUG=1` shows its rows under `[autoupdate]`.
- Combined-tree `npm run check` was not run here; the wave/phase gate owns it.

---
*Phase: 08-background-autoupdate*
*Completed: 2026-10-27*

## Self-Check: PASSED
