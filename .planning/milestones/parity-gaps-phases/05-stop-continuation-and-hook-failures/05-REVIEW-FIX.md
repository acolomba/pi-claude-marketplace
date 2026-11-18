---
phase: 05-stop-continuation-and-hook-failures
fixed_at: 2026-11-14T18:34:14Z
review_path: .planning/phases/05-stop-continuation-and-hook-failures/05-REVIEW.md
iteration: 3
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

## Iteration 1

**Fixed at:** 2026-11-14T16:46:10Z
**Source review:** .planning/phases/05-stop-continuation-and-hook-failures/05-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (WR-01, IN-01 to IN-07; the orchestrator named the scope)
- Fixed: 7 (WR-01, IN-02 to IN-07)
- Skipped: 1 (IN-01, tracked as BACKLOG HOOKTIMEDOUTEXIT2-01)

The run was autonomous. Every decision below is **pending maintainer review**.

### Where verification ran

Every check ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-gaps` on `features/gaps`, with no worktree, so the results can be reproduced from that tree. Node v26.13.1. Each unit test ran under `test/platform/isolated-pi-home.ts`, each saved-output case in an `mkdtemp` root, and each scenario in the cucumber sandbox. No check read or wrote the real `~/.pi/agent`. The checks were: `tsc --noEmit`, ESLint on every changed `.ts` file, `npm run fallow` (IN-06), `npm run check:features`, direct coverage at 100% for each touched source-test pair, the owner tests of each fix and of its callers (`test/bridges/hooks/**` and `test/index.test.ts`, 1,797 tests, all pass at the end), the owner scenarios under the `adapter` profile, and the commit hook's `npm run check:commit` on each commit. The IN-02 commit staged `test/e2e/_rpc.ts`, so its hook ran direct coverage for every pair. The new scenario carries no MCP tag, so the `builtin` profile runs no scenario of it. The full `npm run check` was not run, as instructed.

Every fix has a negative control: the changed source was reverted or broken on purpose, the new case or scenario failed, and the change was restored.

## Fixed Issues

### WR-01: A plain `async` hook runs with no time limit, but its output is collected with no size limit

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/stream-text.test.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`, `docs/hooks-compatibility.md`
**Commits:** eb725733, then 5fece2c0 (the large-output row of the compatibility page)
**Status:** fixed: requires human verification (a new bridge limit)
**Applied fix:**

- `collectStreamText` takes an optional `bound: { limit, onLimit }`. With a bound, the text keeps its first `limit` characters. Later chunks are read, so `end` still fires, and dropped. `onLimit` runs once, at the first dropped character. The decoder tail on `end` passes the same bound. With no bound, the collector keeps every byte as before (EXEC-02).
- `spawnAndRegister` passes a bound only on the plain lane, for stdout and for stderr: `PLAIN_ASYNC_STREAM_LIMIT`, 8,388,608 characters, with one debug line `async-hook: <stream> past 8388608 characters dropped (<plugin>/<event>)`. The asyncRewake lane and the blocking lane keep their unbounded collectors.
- The plain lane does not read its stderr. Its stderr gets the same bound, not zero, so the two streams behave alike.
- Owner cases: four `stream-text` cases (drops later chunks and calls `onLimit` once, a stream that ends at the bound drops nothing, no decoder tail once full, a tail that passes the bound is cut). Two registry cases: a plain answer on the first line, followed by 8 MiB of noise, still reaches the model, with exactly one dropped line. An asyncRewake hook's stderr past the bound reaches the model whole. Negative control: with the bound off, the plain case fails.
- The compatibility page names the bound in the `async` row and in the large-output row, and says that upstream documents no such limit.

### IN-02: A `Stop` hook's `continue: false` shows "stopped continuation" when another extension already continued the run

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `test/bridges/hooks/settle.test.ts`, `features/hook/messages.feature`, `features/lib/boundary-continuer.ts` (new), `features/step_definitions/hook/prompt-and-stop.steps.ts`, `features/support/world.ts`, `test/e2e/_rpc.ts`, `docs/hooks-compatibility.md`, `docs/output-catalog.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`, `.agents/skills/cucumber/rules/layout.md`
**Commit:** 29d46363
**Status:** fixed: requires human verification (user-visible behavior)
**Applied fix:**

- The option chosen is to skip the line. D-PG5-13 shows a `stopReason` only "where the bridge honors the stop", and it leaves `PostToolUse` out because a notice there "would claim a stop that did not happen". Claude Code has no second handler that continues a run, so no upstream wording covers the case. A line that stays silent when the run goes on follows D-PG5-13's own rule. Rewording the line would add text that upstream never shows.
- The boundary handler passes `{ last, runContinues: event.continue }` to the Stop bucket. When `runContinues` is true, the stop arm writes the debug line `settle: an earlier boundary handler continued the run; stopReason not shown` and shows nothing. It still records the non-reentry. A handler that Pi runs after the bridge's can still continue a run that the bridge showed as stopped. The compatibility page states that case.
- Unit case in `settle.test.ts`: a boundary event with `continue: true` and a stopping hook shows no notice, resolves to `undefined`, and writes the two debug lines.
- Scenario "A stop hook's stop reason is not shown when another extension already continued the run" in `features/hook/messages.feature`. The new harness extension `features/lib/boundary-continuer.ts` continues the first run end once with a hidden `go on` message. The profile Pi loads it before the real extension, so Pi runs its handler first. The scenario expects two Stop runs, one notice (at the second end), and the model calls with `go on`. Red with the old `settle.ts`: the notice showed twice. Green after.
- **Harness change:** a scenario could not load an extension before the real one, because `piArguments` put the real extension first. `PiProfile.leadingExtensions` (world), `RpcProfile.leadingExtensions`, and `PiArgumentOptions.leadingExtensions` (`test/e2e/_rpc.ts`) now carry such extensions ahead of it. The cucumber skill's load-order bullet and the hooks step-module paragraph name the option and the new step.

### IN-03: The "agent settlements" column of the counts step cannot read anything but 1

**Files modified:** `features/step_definitions/hook/prompt-and-stop.steps.ts`, `features/hook/prompt-and-stop.feature`
**Commit:** 052dfd31
**Applied fix:** The column was dropped. A quiet period after the settle would still not prove that no later settle comes. The counts step now states `run starts` and `model calls`. The `strictEqual(..., 1)` in "ten stop blocks separated by tool calls continue" was removed too. The step module's header says why: the turn ends at its first `agent_settled`, so a run that settled after each model call would end the turn after one call, and the model-call count proves the one settlement (D-PG5-01). The two feature tables were updated. All seven `prompt-and-stop` scenarios pass under the `adapter` profile.

### IN-04: A start-failure notice is claimed before it is shown

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `test/bridges/hooks/runtime.test.ts`, `test/bridges/hooks/dispatch.test.ts`, `test/bridges/hooks/settle.test.ts`
**Commit:** da55855a
**Status:** fixed: requires human verification (a logic change)
**Applied fix:**

- The runtime's `claimStartFailureNotice` became two members: `startFailureNoticeShown(key)` and `recordStartFailureNotice(key)`.
- `failureNotices` now returns `HookNotice { text, startFailureKey? }`. Only a `spawn` or `run` failure carries the key. It no longer records anything, so it lost its `runtime` parameter, and so did `hookNotices`.
- The new `showHookNotice(runtime, notice, show)` skips a notice whose key was already shown, calls `show`, and records the key only after `show` returns. `showHookNotices` and the Stop handler's `showStopNotices` both show through it. With `pi === undefined`, nothing is shown and nothing is recorded. Two hooks of one event with the same command still show one notice, because the first records the key before the second is checked.
- Owner cases: the runtime cases cover the check, the record, the reset at a bridge load, and two runtimes. In `dispatch.test.ts` and `settle.test.ts`, a notice whose first append throws shows at the next event, once over three events. Negative control: with the record before `show`, both cases fail.
- No scenario was added. The changed path runs only when a notice fails to show, which no public surface can cause.

### IN-05: `saveHookOutput` has no owner case for a link at the file itself

**Files modified:** `test/bridges/hooks/hook-output-files.test.ts`
**Commit:** f8ad1c6d
**Applied fix:** New case "NFR-10: refuses a saved file name that links to a file outside the data root". It plants `hook-<id>-additionalContext.txt` as a link to a file outside the root in an `mkdtemp` root, then expects `SymlinkRefusedError` and an unchanged target. Negative control: without the `assertPathInside` call, the write goes through the link and the case fails.

### IN-06: The compatibility page does not state the limits of the sweep, and the sweep stops at the first file error

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts`, `test/bridges/hooks/hook-output-files.test.ts`, `docs/hooks-compatibility.md`
**Commit:** 3246c404 (the first attempt failed the hook on a fallow `private-type-leak`; it was fixed and committed again, with no amend)
**Status:** fixed: requires human verification (a logic change)
**Applied fix:**

- Each saved file now goes through `sweepFile`, which catches its own `lstat` or `unlink` error, writes `hook-output: sweep skipped <name>: <error>`, and lets the sweep go on. As the orchestrator asked, an `ENOENT` writes the line too. The folder-level arm is unchanged: a missing folder stays silent, and any other folder failure writes `sweep failed`.
- `sweepHookOutput` takes a defaulted third parameter, `ops = { lstat, unlink }`, so a test can fail one file. The parameter's type is `typeof DEFAULT_SWEEP_FILE_OPS`, so the exported signature names no private type.
- Owner cases: a table of two. The first `lstat` rejects with `ENOENT`, or the first `unlink` rejects with `EPERM`. In both, the other two old files are removed, and exactly one debug line names the failed file. Negative control: with `sweepFile` rethrowing, both cases fail.
- The compatibility page lists the sweep's limits: only regular files named `hook-<id>-<source>.txt`, links, sub-folders, and other files kept, no link followed, an untrusted project skipped, and a failed file that does not stop the sweep.

### IN-07: The generation check after the save in `sendAsyncAnswer`, and its comment

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
**Commit:** 4d495ed6
**Applied fix:** The check stays. The doc comment now says: in production, a reload during a save makes the old `pi` stale, so its `sendMessage` throws and the answer is dropped. The generation check after the save covers a runtime that is registered twice. A file that the save wrote stays until the 30-day sweep.

## Skipped Issues

### IN-01: Only the missing-file case of HOOKTIMEDOUTEXIT2-01 moved toward upstream

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:303-309`
**Reason:** Skipped as the orchestrator instructed. The divergence is older than this phase and is tracked as BACKLOG HOOKTIMEDOUTEXIT2-01. The reviewer's suggested rewording of that item (map any parsed result except an `onFailure` block to a noop when `ladder.fired()`) still needs the upstream check with `claude-code-compat-research`.
**Original issue:** `withoutTimeoutFailure` strips only a noop's failure, so a hook that traps SIGTERM at its timeout and exits 2 with other stderr still blocks, and on `Stop` it continues the run.

### Decisions pending maintainer review

1. WR-01: the plain lane keeps 8,388,608 characters of each stream. Upstream documents no limit.
2. WR-01: the plain lane's unread stderr gets the same bound, not zero.
3. IN-02: the line is skipped, not reworded, when an earlier handler already continued the run.
4. IN-02: the harness gained `leadingExtensions`, a world change. The cucumber rules say that a phase adds its extension through `extraExtensions`. That option cannot put a handler ahead of the real extension's.
5. IN-03: the settlements column was dropped, not made meaningful.
6. IN-06: a per-file `ENOENT` writes a debug line, as the orchestrator asked. The reviewer suggested a silent skip.

### Parent lines

- **D-PG5-13 (CONTEXT, PROJECT.md row when it lands):** add "The `Stop` line is left out when another extension's handler, which Pi ran first at the same boundary, already continued the run."
- **D-PG5-17:** add "A plain `async` hook keeps the first 8,388,608 characters of its stdout and stderr."
- **D-PG5-20 item 1:** the one-settlement proof is the model-call and run-start counts, not a settlements column.
- **BACKLOG HOOKOUTLEAFLINK-01 and HOOKOUTSWEEPDOC-01:** both can close (IN-05, IN-06).

---

_Fixed: 2026-11-14T16:46:10Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2

**Fixed at:** 2026-11-14T17:54:25Z
**Source review:** .planning/phases/05-stop-continuation-and-hook-failures/05-REVIEW.md (iteration 2, committed in f319b4e4)
**Iteration:** 2

**Summary:**

- Findings in scope: 8 (WR2-01, WR2-02, WR2-03, IN2-01 to IN2-05; the orchestrator named the scope, so the necessity finding WR2-03 is in it)
- Fixed: 8
- Skipped: 0

The run was autonomous. Every decision below is **pending maintainer review**.

### Where verification ran

Every check ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-gaps` on `features/gaps`, with no worktree, so the results can be reproduced from that tree. Node v26.13.1. Each unit test ran under `test/platform/isolated-pi-home.ts`, each saved-output case in an `mkdtemp` root, and each scenario in the cucumber sandbox. No check read or wrote the real `~/.pi/agent`. The checks were: `tsc --noEmit`, `npx fallow dead-code` (IN2-04), direct coverage at 100% for each touched source-test pair (`settle`, `runtime`, `stream-text`, `dispatch-exec`, `async-rewake/registry`, `hook-output-files`, `event-router`), the owner tests of each fix and of its callers (`test/bridges/hooks/**` and `test/index.test.ts`, 1,809 tests, all pass at the end), every scenario under `features/hook` under the `adapter` profile (252 pass) and the `builtin` profile (13 pass), and the commit hook's `npm run check:commit` on each commit. The IN2-05 commit staged `test/e2e/_rpc.ts`, so its hook ran direct coverage for every pair. The full `npm run check` was not run, as instructed.

Every fix has a negative control. For code, the changed source was reverted or broken on purpose, the new case or scenario failed, and the change was restored. The controls for IN2-01, IN2-04, and IN2-05 are described with each fix.

### Fixed Issues

#### WR2-01: The Stop line was decided from `event.continue`, which is not the outcome of the boundary

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts`, `test/bridges/hooks/settle.test.ts`, `test/bridges/hooks/runtime.test.ts`, `features/hook/messages.feature`, `features/step_definitions/hook/prompt-and-stop.steps.ts`, `features/lib/boundary-refuser.ts` (new), `docs/hooks-compatibility.md`, `docs/output-catalog.md`, `.agents/skills/cucumber/rules/layout.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** 28a0ceba
**Status:** fixed: requires human verification (user-visible behavior and a logic change)
**Applied fix:**

- The runtime gained `holdStopReason(reason)` and `takeHeldStopReason()`. A bridge load drops a held reason.
- At the boundary, the first stopping Stop hook's non-empty `stopReason` is held, and nothing is shown. The `runContinues` input and `StopBoundaryEnding` are gone.
- `agent_settled`, which Pi raises only after the run loop ends, shows the held reason as `Stop hook stopped continuation: <reason>` through a new hook notification run, before the StopFailure arm.
- `agent_end` drops a held reason with the debug line `settle: the run went on after a Stop hook stopped it; stopReason not shown`. The reviewer suggested a clear at the next `agent_before_settle` or `agent_start`. `agent_end` was chosen because Pi emits it after every `agent.continue()`, also for a failed or aborted continuation (`pi-agent-core` `agent.js:383`, `agent-loop.js`), and before the next boundary or `agent_settled`. So it needs no new `pi.on` registration. This covers the queued-input and wake cases as well, because they continue through `agent.continue()`.
- An Escape during the Stop hook, a later handler's `continue: false`, and invalid boundary entries now all show the line, because the run stops.
- Unit cases: the stop-line table now runs the boundary and then the settle. A new case gives the boundary `continue: true` and a stopping hook: nothing shows at the boundary, and the line shows once over two settles. Another case holds a reason, then an `agent_end`, then a settle: no notice, and the debug line. Two runtime cases cover take-once, last-write, and the reset at a bridge load. The runtime isolation case covers the new state.
- Scenario "A stop hook's stop reason is shown when a later extension ends the run that an earlier one continued". It loads `boundary-continuer.ts` first and the new harness extension `features/lib/boundary-refuser.ts` last. The refuser returns `continue: false` at every boundary, so Pi stops the run that the continuer continued. Expected: one Stop run, one notice, one model call. The existing scenario "...not shown when another extension already continued the run" still passes.
- Negative control: with `settle.ts` and `runtime.ts` from HEAD, the new scenario failed (no notice), and so did both new settle cases.
- The page's sentence at the old line 431, the difference bullet at line 154, the `continue: false` row, and the output catalog say that the line shows once the run stops, and not when Pi continues it anyway.

#### WR2-02: The `RangeError` path stayed open on the `asyncRewake` and blocking lanes

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`, `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/stream-text.test.ts`, `docs/hooks-compatibility.md`
**Commit:** cf461825
**Status:** fixed: requires human verification (a new bridge limit)
**Applied fix:**

- `collectStreamText` now requires its `bound`, so the compiler rejects a collector with no ceiling. The new `ceilingBound(stream, hook)` gives a limit of `2 ** 28` UTF-16 code units and one debug line: `hook output: <stream> past 268435456 UTF-16 code units dropped (<hook>)`.
- `dispatch-exec.ts` passes `ceilingBound` for both streams, and `streamBoundFor` returns it on the `asyncRewake` lane. The plain lane keeps its lower bound. The ceiling lives in `stream-text.ts`, so no caller holds a closure that only 256 MB of output could cover.
- The reviewer asked for a case "with a small injected ceiling and no bound". With the bound required, that case does not exist. The small-bound cases prove the cut. Two new cases cover the ceiling: its limit plus a 1 MiB chunk stays below `buffer.constants.MAX_STRING_LENGTH`, and its `onLimit` writes the debug line.
- The comment "the other lanes have a timer, so they keep every byte" is replaced: the `asyncRewake` lane keeps each stream whole up to the ceiling, because its declared `timeout` can let it print for days. The `dispatch-exec.ts` header no longer says that no size limit applies.
- Negative control: with the ceiling set to `Infinity`, both new cases failed.
- The page's large-output row names the safety limit.

#### WR2-03: A plain `async` hook kept up to 8,388,608 characters of stderr that no code reads

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`, `docs/hooks-compatibility.md`
**Commit:** f68a9828
**Status:** fixed: requires human verification (a necessity finding; it removes kept data)
**Applied fix:**

- On the plain lane, the stderr bound is `{ limit: 0 }`. The collector still reads the pipe to its end, so the hook never blocks on a full pipe, and it keeps nothing. Its debug line reads `async-hook: stderr not kept; a plain async hook's stderr is unread (<plugin>/<event>)`.
- New registry case: a plain hook writes two stderr chunks and its answer on stdout. Both streams end, the answer reaches the model, and exactly one stderr debug line is written. Negative control: with the stderr branch off, the case failed.
- The page's `async` row and large-output row say that a plain hook's stderr is read to the end and not kept.
- This commit also rewraps a comment line in `spawnAndRegister` that the WR2-02 commit left over 100 characters.

#### IN2-01: `streamBoundFor` sat between `ladderFor`'s doc comment and `ladderFor`

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
**Commit:** 3fc6cccb
**Applied fix:** `streamBoundFor` and its comment now sit above the `/**` block, so the timer text documents `ladderFor`. Negative control: a TypeScript compiler API probe (`ts.getJSDocCommentsAndTags`) on HEAD attached "Chooses the timer..." to `streamBoundFor` and nothing to `ladderFor`. After the move it attaches the block to `ladderFor` only. The probe was a scratch script and is not committed.

#### IN2-02: The bound counted UTF-16 code units and could split a surrogate pair

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/stream-text.test.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`, `docs/hooks-compatibility.md`
**Commit:** 57854c9f
**Applied fix:**

- Both options were taken. A cut keeps one unit fewer when the last kept unit would be a high surrogate (`0xD800` to `0xDBFF`), so `"ab😀c"` with `limit: 3` is `"ab"`. The page and the debug lines say "UTF-16 code units", and the page notes that an emoji counts as two.
- The `stream-text.ts` header now says that it collects up to a bound, names every lane, including the plain `async` lane and its bound, and explains the unit count.
- New cases: a cut that would split the pair keeps `"ab"` and calls `onLimit` once, and a pair that ends at the bound is kept whole. Negative control: with the back-off removed, the first case failed.

#### IN2-03: The bound kept only the head of stdout, which dropped a last-line answer

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/stream-text.test.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`, `docs/hooks-compatibility.md`
**Commit:** 877e6802
**Status:** fixed: requires human verification (a logic change)
**Applied fix:**

- Chosen: keep a small tail with the head. It was simple and bounded. `StreamTextBound` gained an optional `tail`. Past the cut, the collector keeps the last `tail` units of the stream and joins them to the head with `"\n"`, so a last-line answer still parses as one line. The tail starts one unit later when it would start on a low surrogate. A bound with no tail behaves as before, and later chunks are not even decoded.
- The plain lane's stdout keeps a tail of 65,536 units (`PLAIN_ASYNC_STREAM_TAIL`). Its debug line reads `async-hook: stdout past 8388608 UTF-16 code units dropped; the last 65536 kept (<plugin>/<event>)`. The ceiling bound and the plain stderr bound keep no tail.
- New cases: head and tail across chunks (`"abc\nhij"`), a stream past the cut by less than its tail, and a tail that would start inside a pair. A registry case: 8 MiB of progress lines, then the answer on the last line, reaches the model. Negative control: with the tail set to 0, three stream-text cases failed, and the registry case timed out at 15 s because no answer arrived.
- A joined text is not the hook's exact stdout: it holds one `"\n"` that the hook did not print, and a whole-stdout JSON answer longer than the head still does not parse. Upstream reads the answer at any size.
- The page's `async` row and large-output row name the kept tail.

#### IN2-04: `sweepHookOutput` defaulted a parameter to the live file system

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts`, `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `test/bridges/hooks/hook-output-files.test.ts`
**Commit:** 1b15cb5d
**Applied fix:**

- `SweepFileOps` is exported, `FILE_SYSTEM_SWEEP_OPS` (`{ lstat, unlink }`) is the exported real adapter, and `ops: SweepFileOps` is a required parameter. The two `event-router.ts` callers, the hooks bridge's composition point, pass `FILE_SYSTEM_SWEEP_OPS`. The real-file-system sweep cases pass it too, and the fault cases pass their own ops. This follows `pairing-and-design.md` ("Do not default a parameter to a live boundary").
- fallow is green with no marker: `npx fallow dead-code` passes.
- Negative controls: without the argument at the callers, `tsc` fails with TS2554. With `SweepFileOps` unexported again, fallow reports two `private-type-leak` findings.

#### IN2-05: Harness documents were stale after `leadingExtensions` and the new harness extension

**Files modified:** `features/support/world.ts`, `test/e2e/_rpc.ts`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`
**Commit:** fad6faf6
**Applied fix:**

- The `usePiWithProfile` comment names `profile.leadingExtensions` first in the load order, and its 134-character line is rewrapped. The `piArguments` comment's 128-character line is rewrapped.
- Chosen: refuse, not carry. `keepTerminalSessionLocal` now throws "a profile Pi without the GitHub base override cannot load leading extensions". The TUI session loads its extensions after the real one, so carrying them would mean a change to `features/lib/pi-tui.ts` that no scenario needs. The `withoutGitHubBaseOverride` comment and the cucumber rule say so. Negative control: a step temporarily set both options, and the scenario failed with that error. The step was then restored.
- CONVENTIONS now counts 52 `fallow-ignore` markers (`rg -n "fallow-ignore" extensions features test scripts`: 6 `unused-file`, 27 `code-duplication`, 5 `private-type-leak`, 13 `unused-export`, 1 `unused-type`). It counts thirteen `unused-export` markers, twelve on loader defaults: `index.ts` and eleven harness extensions, `boundary-continuer` and `boundary-refuser` included.
- Stale exemptions: CONVENTIONS' `fetch-chokepoint` named only `domain/github-auth.ts`. The rule pack also exempts `platform/hosted-manifest-fetch.ts`, which is now listed (D-PL5-07). The bullet also left out `child-process-chokepoint`, which is now listed with its five exemptions. CONCERNS listed `bridges/agents/stage.ts` as a `write-file-atomic` caller. The rule pack exempts only `bridges/mcp/stage.ts` and `orchestrators/plugin/prune-rollback.ts`, beside the chokepoint, so the entry now says two.
- Not changed: `.planning/codebase/STACK.md` still says the rule pack has 11 rules and leaves out `child-process-chokepoint`. It has 12.

### Decisions pending maintainer review

1. WR2-01: the Stop line shows at `agent_settled`, after the boundary's other notices, and `agent_end` drops it. The reviewer named `agent_before_settle` or `agent_start` as the clear points.
2. WR2-01: the line also shows after an Escape during the Stop hook, because the run stops.
3. WR2-01: the harness gained `features/lib/boundary-refuser.ts`, loaded through `extraExtensions`.
4. WR2-02: the ceiling is `2 ** 28` UTF-16 code units for the blocking and `asyncRewake` lanes, and `bound` is required, not optional.
5. WR2-03: the plain lane keeps none of its stderr, which replaces iteration 1's decision 2.
6. IN2-02: the cut backs off a unit, and the docs also say UTF-16 code units.
7. IN2-03: head plus a 65,536-unit tail, joined with a line break, on the plain lane's stdout only. This replaces iteration 1's decision 1 for that lane.
8. IN2-05: a profile without the GitHub base override refuses `leadingExtensions` instead of carrying them.

### Parent lines

- **D-PG5-13:** replace the iteration-1 line with: "The `Stop` line shows once the run stops, at `agent_settled`. When Pi continues the run anyway, the line is not shown."
- **D-PG5-17:** "A plain `async` hook keeps the first 8,388,608 and the last 65,536 UTF-16 code units of its stdout and none of its stderr."
- **NFR-2 / EXEC-02:** "Every hook output collector keeps at most 2^28 UTF-16 code units of one stream."

---

_Fixed: 2026-11-14T17:54:25Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

## Iteration 3

**Fixed at:** 2026-11-14T18:34:14Z
**Source review:** .planning/phases/05-stop-continuation-and-hook-failures/05-REVIEW.md (iteration 3, committed in 69858bdd)
**Iteration:** 3

**Summary:**

- Findings in scope: 5 (WR3-01, IN3-01 to IN3-04; the orchestrator named the scope)
- Fixed: 5
- Skipped: 0

This is the last fix pass: the review cap is reached. The run was autonomous. Every decision below is **pending maintainer review**.

### Where verification ran

Every check ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-gaps` on `features/gaps`, with no worktree, as the orchestrator instructed, so the results can be reproduced from that tree. Node v26.13.1. Each unit test ran under `test/platform/isolated-pi-home.ts`, and each scenario in the cucumber sandbox. No check read or wrote the real `~/.pi/agent`. The checks were: `tsc --noEmit`, ESLint on every changed `.ts` file, direct coverage at 100% for the `stream-text` pair, the owner tests of each fix and of its callers (`test/bridges/hooks/**` and `test/index.test.ts`, 1,815 tests, all pass at the end), the scenarios of `features/hook/tool-use.feature` and `features/hook/messages.feature` under the `adapter` profile (76 pass), `npm run check:features`, and the commit hook's `npm run check:commit` on each commit. The changed scenario carries no MCP tag, so the `builtin` profile was not run for it. The full `npm run check` was not run, as instructed.

Every fix to code or to a scenario has a negative control: the changed source was reverted or broken on purpose, the new cases or the scenario failed, and the change was restored.

### Fixed Issues

#### WR3-01: The plain lane's head-and-tail join added a line break that the hook never printed

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `test/bridges/hooks/stream-text.test.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`, `docs/hooks-compatibility.md`
**Commit:** 6dfe148f
**Status:** fixed: requires human verification (a logic change)
**Applied fix:**

- The collector tracks `dropped`, which is set the first time `lastUnits` really discards units. `onLimit` runs at that moment, not at the cut, so the plain lane's debug line no longer says that units were dropped when the tail held them all. A bound with no tail drops at the cut, as before.
- While nothing is dropped, `text()` returns `head + tail`, which is the exact stream. Once units are dropped, it discards the tail up to and including its first `"\n"`, then joins the rest to the head with `"\n"`. A tail with no line break gives the head alone.
- `lastUnits` lost its low-surrogate step. A tail start that splits a pair always lies in the tail's first line, which the text now never keeps, so the step could not change any text. Its case ("starts its kept end after a character that the tail would split in half") could no longer fail and is replaced.
- Unit cases: the case at the old line 135 now expects `"abcdef"` and no `onLimit` call. New cases: the probe's straddling answer line (`limit: 19, tail: 1000`) comes back exactly; a tail that starts at the `{` of `x {"a":1}` loses that fragment and keeps `{"ok":1}`; a tail with no line break keeps nothing; and the head-and-tail case across chunks now has line breaks and expects `"abc\nij"`.
- Registry cases: an answer line that the 8,388,608-unit cut splits, inside the tail window, reaches the model. A tail that starts at the `{` of a `note {"systemMessage":"wrong"}` line sends the real last-line answer, not `wrong`. The case "drops the rest" now writes past the limit plus the tail, so it still drops. The last-line progress case now passes the limit plus the tail.
- Negative control: with `stream-text.ts` from HEAD, all five changed or new stream-text cases failed, and both new registry cases were cancelled at a 10 s test timeout, because the expected messages never arrived.
- The page's `async` row says that the first line of the kept end is dropped once anything is dropped.

#### IN3-01: The `2 ** 28` ceiling was above V8's longest string on 32-bit hosts

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `test/bridges/hooks/stream-text.test.ts`
**Commit:** d21182cc
**Applied fix:**

- `ceilingBound(stream, hook, maxStringLength = constants.MAX_STRING_LENGTH)` keeps `Math.min(2 ** 28, maxStringLength - 2 ** 20)` units. On a 64-bit host this is still `2 ** 28`, so the debug line and the page keep their number. On a 32-bit host it is 1 MiB below V8's longest string, which leaves room for the next chunk. The reviewer suggested half of `MAX_STRING_LENGTH`. That gives `2 ** 28 - 12` on 64-bit hosts. The 1 MiB headroom keeps the 64-bit value and matches what the existing case checks.
- `buffer.constants` is read-only, so a case cannot fake a 32-bit host. The runtime's limit is a defaulted last parameter, as with the hooks bridge's `tools` view, not a test-only export, which fallow would report as unused in production.
- New cases: with `2 ** 29 - 24` the limit is `2 ** 28`, and with `2 ** 28 - 16` it is `2 ** 28 - 16 - 2 ** 20`. Negative control: with the literal ceiling put back, the 32-bit case failed.

#### IN3-02: The ceiling bounded one string's length, not the heap

**Files modified:** `docs/hooks-compatibility.md`
**Commit:** 7b6c7ed9
**Applied fix:** the large-output row now says the limit counts code units, not bytes: up to 512 MiB per stream once a string holds a character outside Latin-1, up to 1 GiB per hook with stdout and stderr, and that much for each hook of an event, because they run at the same time. It also says that the limit is a little lower on a 32-bit host, and that a plain `async` hook's stdout holds at most about 16 MiB. No code change, as instructed.

#### IN3-03: Comment upkeep in the new bound code

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts`, `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
**Commit:** 902506d3
**Applied fix:** the `streamBoundFor` comment is rewrapped. The `stream-text.ts` header names `PLAIN_ASYNC_STREAM_LIMIT` and `PLAIN_ASYNC_STREAM_TAIL` and says that the registry sets them, instead of writing their values. Comment only, so there is no negative control.

#### IN3-04: The scenario "...not shown when another extension already continued the run" checked that the line is shown

**Files modified:** `features/hook/messages.feature`, `features/lib/hook-files.ts`, `features/lib/hook-recorder.ts`
**Commit:** a61c7628
**Applied fix:**

- Distinct texts were chosen, as preferred. The halt hook prints `done for today` by default and `finished for today` when the last assistant message is `Finished.`, which is the second run end. The scenario expects only `Stop hook stopped continuation: finished for today`. It is renamed "A stop hook's stop reason is not shown for a run end that another extension continued".
- **Harness change:** no column could vary a Stop hook's output between runs, because `when old string` reads only `tool_input.old_string`. The hooks table gains `when last message`, which picks `matched output` by the stdin's `last_assistant_message`. The recorder prints `matched output` when every condition the row sets holds. The `hook-files.ts` header now documents both conditional columns. The `when old string` scenarios of `tool-use.feature` still pass.
- Negative control: with a hold that keeps the first reason (`heldStopReason ??= reason`) and no drop at `agent_end`, the scenario failed and showed `done for today`. With the old identical texts, that wrong implementation passed.

### Decisions pending maintainer review

1. WR3-01: once units are dropped, the tail's first line is always discarded, even when the dropped units end at a line break, so that line was whole. This is the rule the orchestrator named. Telling the two cases apart would mean checking the unit before the tail's start.
2. WR3-01: `lastUnits` no longer steps past a low surrogate, because the line it would protect is always discarded.
3. IN3-01: 1 MiB of headroom below `MAX_STRING_LENGTH`, not half of it.
4. IN3-04: the new `when last message` harness column.

### Parent lines

- **D-PG5-17:** "A plain `async` hook keeps its stdout exactly while the first 8,388,608 and the last 65,536 UTF-16 code units hold it. Past that, it keeps the head and the whole lines of the last 65,536 units, and none of its stderr."
- **NFR-2 / EXEC-02:** "Every hook output collector keeps at most 2^28 UTF-16 code units of one stream, or 2^20 fewer than the runtime's longest string when that is lower."

---

_Fixed: 2026-11-14T18:34:14Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
