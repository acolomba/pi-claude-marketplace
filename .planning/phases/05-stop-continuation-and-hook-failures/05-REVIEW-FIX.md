---
phase: 05-stop-continuation-and-hook-failures
fixed_at: 2026-11-14T16:46:10Z
review_path: .planning/phases/05-stop-continuation-and-hook-failures/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
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
