---
phase: 01-foundation
fixed_at: 2026-11-08T07:06:31Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 21
fixed: 18
skipped: 2
no_change_needed: 1
status: partial
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-08T07:06:31Z
**Source review:** `.planning/phases/01-foundation/01-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 21 (CR-01..03, WR-01..11, IN-01..07)
- Fixed: 18
- Skipped: 2 (IN-05 by judgment, IN-06 after a measurement)
- No change needed: 1 (IN-03, already tracked)

Where verification ran: in the main checkout of the `features/behavioral-gaps` worktree
(`/home/acolomba/src/pi-claude-marketplace-behavioral-gaps`), not in a nested review-fix
worktree, because the caller requires this tree and the nested worktree has no `node_modules`.
Every commit ran the pre-commit hook's `npm run check:commit` (typecheck, ESLint, fallow,
Prettier, `check:features`, unpaired tests, direct coverage of staged pairs), which passed each
time. The full `npm run check` was not run here.

| ID | Outcome | Commit | Verify run |
| --- | --- | --- | --- |
| CR-01 | fixed | 60cdb14f | `features/hook/async.feature` (adapter, 5/5, crash scenario included) |
| CR-02 | fixed: requires human verification | 05b188f6 | `features/hook/async.feature` (adapter, 5/5); red proof: without the marker `rm`, scenario `:57` fails ("no run of the hook took its release marker") |
| CR-03 | fixed | 3073046c | `features/plugin/browse.feature` (adapter, 6/6); red proofs: cancel replaced by choose "User (global)" fails the user-scope `Then`, by choose "Project" fails the project-scope `Then` |
| WR-01 | fixed | e7ecb52a | `features/marketplace/device-flow.feature` (adapter, 2/2) |
| WR-02 | fixed | 57542b07 | `device-flow.feature` (adapter, 2/2); `node --test test/architecture/github-device-flow-redirect.test.ts` (12/12); scratch smoke: ESM named `request` import is refused after the patch |
| WR-03 | fixed | 315e7a68 | `features/plugin/bootstrap.feature` (adapter, 14/14) |
| WR-04 | fixed | 0fe9ed9c | `browse.feature` (adapter, 6/6) |
| WR-05 | fixed: requires human verification | 0fe9ed9c | `browse.feature` (adapter, 6/6); red check: an unmatchable notice row makes the choose scenario time out "the notice about app" |
| WR-06 | fixed | bf01b686 | `bootstrap.feature:44` (adapter, 1/1) |
| WR-07 | fixed: requires human verification | 05b188f6 | `async.feature` (adapter, 5/5) |
| WR-08 | fixed | f22c07c3 | `async.feature` (adapter, 5/5) |
| WR-09 | fixed | 734e5a38 | `device-flow.feature` (adapter, 2/2); the terminal scenario passes with the two setup rows removed; `npm run check:features` |
| WR-10 | fixed | 1b45400e | `features/plugin/model-tools.feature` (adapter, 2/2) |
| WR-11 | fixed | 6344bac0 | `node --test test/architecture/github-device-flow-redirect.test.ts` (12/12) |
| IN-01 | fixed | 548a5c4d | `features/hook/compaction.feature`, `features/hook/stop-failure.feature` (adapter, 2/2) |
| IN-02 | fixed | 49789c27 | `node --test test/architecture/pi-tui-screen.test.ts` (13/13, two new cases); `browse.feature` + `bootstrap.feature` (adapter, 20/20) |
| IN-03 | no_change_needed | -- | Tracked: the two seeds carry to Phase 8 CFGMIG-01 and Phase 12 BROWSE-01 in ROADMAP.md |
| IN-04 | fixed | 57542b07 | scratch smoke: `fetch(new Request(url, { body: stream, duplex: "half" }))` routes to the sign-in stand-in and fails only on the connection |
| IN-05 | skipped | -- | Kept by judgment (see below) |
| IN-06 | skipped | -- | Tried and reverted after a measurement (see below) |
| IN-07 | fixed | a5de4fab | `node --test test/architecture/hermetic-git-environment.test.ts` (7/7) |

After all fixes: the 72 feature files that start a profile Pi, under the adapter profile:
582 scenarios, 7347 steps, all passed (3m 42s). No `fallow-ignore` marker was added or removed. No touched feature file carries `@mcp`, so no builtin-profile
run was needed for them. `pgrep -f "[/]hooks/wake.sh"` was empty after every hook run.

## Fixed Issues

### CR-01: A crashed profile Pi's process group is never killed by any release

**Files modified:** `features/lib/pi-process.ts`
**Commit:** 60cdb14f
**Applied fix:** `crash()` sets its own `crashed` flag instead of `stopped`, so the release's
`stop()` still reaches `killProcessGroup` once.

### CR-02: The release marker is never removed

**Files modified:** `features/lib/hook-files.ts`, `features/lib/hook-recorder.ts`,
`features/step_definitions/hook/session.steps.ts`, `features/step_definitions/hook/prompt-and-stop.steps.ts`,
`features/hook/async.feature`, `features/support/world.ts`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** 05b188f6
**Applied fix:** the waiting script removes its marker after the wait; the release steps create
the marker with `wx` and wait until a run takes it. The rewake scenario's `When` is now
`the user prompts "next" and the hook "wake" goes on in the background`, which proves the second
run waits and has not ended, so only the first run's rewake can reach call 2. The world's
`After()` fails a scenario whose call log holds a call past the script (`callsPastScript()`).

### CR-03: The cancel scenario cancels where nothing can be installed

**Files modified:** `features/plugin/browse.feature`
**Commit:** 3073046c
**Applied fix:** the scenario chooses `tools [user]`, `[available] app`, and `Install`, then
cancels at the scope screen. Title: "Cancelling the terminal picker at the install scope
installs nothing". The `extras` project-scope marketplace stays, because without a project
record the project-scope `Then` fails on a missing `state.json`.

### WR-01: The github.com guard accepts any extension

**Files modified:** `features/support/world.ts`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** e7ecb52a
**Applied fix:** `keepTerminalSessionLocal()` requires `GITHUB_REDIRECT_EXTENSION` among
`extraExtensions`.

### WR-02: The redirect fails closed only for what it patches

**Files modified:** `features/lib/github-device-flow/extension.ts`, rules doc
**Commit:** 57542b07
**Applied fix:** `syncBuiltinESMExports()` after the patch. The doc and the rule now name what
the redirect does not see (`net`, `tls`, `http2`, a `fetch` captured earlier, a request before
it loads). No network namespace or `NODE_OPTIONS=--import` was added.

### WR-03: The json-mode Pi's group is not killed after a clean exit

**Files modified:** `features/lib/pi-json-mode.ts`, `features/step_definitions/command.steps.ts`, rules doc
**Commit:** 315e7a68
**Applied fix:** the driver takes an `onRelease` callback, registers an idempotent group kill
before it waits, and runs it in a `finally`.

### WR-04 / WR-05: Picker row parser and action-notice wait

**Files modified:** `features/lib/plugin-picker.ts`, `features/lib/pi-tui.ts`, rules doc
**Commit:** 0fe9ed9c
**Applied fix:** a row splits at its first run of two spaces only. `choosePickerRow` fails when no
row is selected. The output is marked before Enter. The notice wait then needs a screen row of the
form `<glyph> <plugin> ... (<status>)` whose text Pi wrote after the mark
(`PiTuiSession.textAfter()`).

### WR-06: Terminal command steps

**Files modified:** `features/step_definitions/command.steps.ts`, `steps.md`, `world-and-stand-ins.md`
**Commit:** bf01b686
**Applied fix:** `terminalNotice` reads from the anchor down to Pi's editor border row and drops
only trailing blank rows. For the early return of the `When`, the docs route was taken: `steps.md`
now requires the terminal result `Then` before any disk or log `Then`.

### WR-07: Lifecycle waits read the whole log

**Commit:** 05b188f6 (grouped with CR-02: same functions)
**Applied fix:** `waitForHookLifecycle(harness, hook, phase, lengths, timeoutMs)` reads only lines
after `lengths` and returns the matched line. The terminal step checks that the pid of its own
new start line runs.

### WR-08: Partial comparisons mark the whole turn compared

**Files modified:** `features/step_definitions/hook/runs.steps.ts`, `features/hook/async.feature`, rules doc
**Commit:** f22c07c3
**Applied fix:** `no hook process is running` no longer calls `markTurnCompared()`. The release
scenario and the crash-restart scenario now state `Then the hooks record no runs`. The lifecycle
step and the rewake-summary step keep their marker. They compare one log or payload kind of the
turn whole, the same convention as `the hooks record these runs:` and
`the hooks show the user no messages`.

### WR-09: Request-log steps read the whole log

**Files modified:** new `features/support/github-device-flow.ts`, `features/support/world.ts`,
`features/lib/github-device-flow/{extension,server}.ts`, `features/step_definitions/git-host.steps.ts`,
`features/marketplace/device-flow.feature`, `steps.md`, `world-and-stand-ins.md`
**Commit:** 734e5a38
**Applied fix:** a `BeforeStep` records the profile harness log lengths at each `When`
(`world.harnessLogWindow`). With no profile Pi yet, the window is an empty map. The three steps
slice their logs by it. The terminal scenario drops the two setup rows.

### WR-10: Argument-validation projector matches too much

**Files modified:** `features/lib/upstream/pi.ts`, rules doc
**Commit:** 1b45400e
**Applied fix:** the first line must equal `Validation failed for tool "<tool>":` (Pi 1.5.0).

### WR-11: `"::1"` in the loopback set (necessity)

**Files modified:** `features/lib/github-device-flow/routing.ts`
**Commit:** 6344bac0
**Applied fix:** removed. Agreed: both callers pass a WHATWG `URL`, whose IPv6 hostname keeps its
brackets.

### IN-01, IN-02, IN-04, IN-07

- IN-01 (548a5c4d): the forwarder's rejection pushes an `error` event with a faux error message
  that names the cause, and ends the stream.
- IN-02 (49789c27): `3J` leaves the grid as it is; C1 controls are dropped; two new cases in
  `pi-tui-screen.test.ts`.
- IN-04 (57542b07): a routed `Request` is rebuilt with its method, headers, redirect, signal, and
  its body read whole (`arrayBuffer()`). TypeScript's `RequestInit` has no `duplex`, so the
  reviewer's `duplex: "half"` form does not type-check.
- IN-07 (a5de4fab): comment rewrapped.

## Skipped Issues

### IN-05: `ownProcess: false` in the routed-Pi `Given` (necessity)

**File:** `features/step_definitions/git-host.steps.ts:256-261`
**Reason:** kept by judgment. The check is not an impossible state. If a future step called the
redirect's factory inside the cucumber worker and the profile Pi failed to load the redirect, the
log would still hold exactly one `configured: true` line. Only the pid tells the two apart. The
check costs one field.
**Original issue:** the worker never calls the default export, so the assertion can fail only if a
future step calls it in-process.

### IN-06: The TUI Pi gets no `TMPDIR`

**File:** `features/support/world.ts:843-851`
**Reason:** tried, measured, and reverted, because it is not cheap. Giving every TUI
`TMPDIR={home}/tmp` points its jiti cache at the per-worker `<run root>/jiti-cache`, which is cold
for a worker's first TUI. `features/plugin/browse.feature` went from 14 s wall (41.8 s executing)
to 24 s wall (71.8 s executing). That is roughly 10 s more per cold TUI start, against the 15 s
`DEFAULT_READY_MS` TUI ready deadline. On a loaded CI runner that would risk flaky timeouts. A fix
needs a longer ready deadline for a cold first TUI, or a shared warm cache, which is a design
choice for the user.
**Original issue:** the redirect compiles into the host `/tmp/jiti` when a TUI session loads it.

### IN-03: Two seeds pin known product defects

**Outcome:** no_change_needed. The defects are tracked to Phase 8 CFGMIG-01 and Phase 12 BROWSE-01
in ROADMAP.md.

## Hermetic-home question (optional)

Refuted for both named files, by reading only. Neither was run against the real home.

- `test/architecture/config-state-consistency.test.ts`: all 8 tests call
  `createHermeticEnvironment(t, ...)` first (`test/platform/hermetic-environment.ts`). It sets
  `HOME` and `PI_CODING_AGENT_DIR` to a fresh temporary root and restores them in `t.after`. Its
  `addMarketplace` calls of `valid-marketplace` are project scope. The one user-scope write
  (`saveState` of marketplace `mp`) runs inside that environment.
- `test/orchestrators/marketplace/add.test.ts`: the only user-scope add of `valid-marketplace`
  (CMP-1, line 2763) and the other user-scope writes (line 3722) run under
  `createHermeticEnvironment`. Its other user-scope references only render notices or name types.
  The non-hermetic tests use `withTmpScope`, which is project scope, and `add.ts` never computes
  user-scope locations for a project-scope add.
- Pi's `getAgentDir()` reads `PI_CODING_AGENT_DIR` when it is called, not when it is imported, and
  tests inside one file run in sequence, so the override covers every write in those tests.

The reviewer searched for `withHermeticHome` and `PI_CODING_AGENT_DIR`, but these files use
`createHermeticEnvironment`. This review did not find who wrote
`~/.pi/agent/pi-claude-marketplace/cache/plugins/valid-marketplace.json`. The other readers of the
fixture (`test/orchestrators/marketplace/update.test.ts`,
`test/orchestrators/plugin/update-flow.test.ts`) were only counted, not read: both create a
hermetic environment in about as many places as they have tests. The real file was left in place.

---

_Fixed: 2026-11-08T07:06:31Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
