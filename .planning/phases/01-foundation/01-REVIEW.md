---
phase: 01-foundation
reviewed: 2026-11-08T06:02:05Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - features/hook/async.feature
  - features/hook/compaction.feature
  - features/hook/stop-failure.feature
  - features/lib/earlier-version-state.ts
  - features/lib/github-device-flow/extension.ts
  - features/lib/github-device-flow/routing.ts
  - features/lib/github-device-flow/server.ts
  - features/lib/hook-files.ts
  - features/lib/hook-recorder.ts
  - features/lib/https-git-host/server.ts
  - features/lib/mcp-configuration.ts
  - features/lib/pi-commands.ts
  - features/lib/pi-json-mode.ts
  - features/lib/pi-process.ts
  - features/lib/pi-tui.ts
  - features/lib/plugin-picker.ts
  - features/lib/scripted-model/extension.ts
  - features/lib/scripted-model/script.ts
  - features/lib/state-lock-holder.ts
  - features/lib/upstream/index.ts
  - features/lib/upstream/pi.ts
  - features/marketplace/device-flow.feature
  - features/marketplace/state-lock.feature
  - features/mcp-server/legacy-move.feature
  - features/plugin/bootstrap.feature
  - features/plugin/browse.feature
  - features/plugin/config-migration.feature
  - features/plugin/model-tools.feature
  - features/plugin/state-migration.feature
  - features/plugin/subagent-child.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/companion.steps.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/hook/messages.steps.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/step_definitions/hook/runs.steps.ts
  - features/step_definitions/hook/session.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/picker.steps.ts
  - features/step_definitions/scope-state.steps.ts
  - features/support/world.ts
  - test/architecture/github-device-flow-redirect.test.ts
  - test/architecture/hermetic-git-environment.test.ts
  - test/architecture/pi-tui-screen.test.ts
  - test/e2e/_rpc.ts
findings:
  critical: 3
  warning: 11
  info: 7
  total: 21
  necessity: 2
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-08T06:02:05Z
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

Scope: `git diff cf48b0df..HEAD`, limited to the 47 harness files the caller listed. No product code under `extensions/` changed. The review checked the files against the cucumber skill rules (`SKILL.md`, `rules/steps.md`, `rules/world-and-stand-ins.md`), the decisions D-BG-01 to D-BG-16, and the deviations each plan SUMMARY and `DUBIOUS-CHOICES.md` record. A finding that repeats an already-recorded dubious choice is still listed when the code does more harm than the record says.

Main concerns:

- **Process lifetime.** After `PiProcess.crash()`, no release ever kills the crashed Pi's process group (CR-01). The one-shot json-mode Pi is not registered with the world and its group is not killed after a clean exit (WR-03).
- **Vacuous or racy scenarios.** The release marker of a waiting hook is never removed. In the rewake-to-model scenario, the next prompt therefore starts a second `wake` run that exits 2 at once and races the behavior under test (CR-02). The cancel scenario of the picker cancels on the first screen, where nothing could be installed, so its `Then` steps cannot fail (CR-03). Several waits and comparisons read whole logs instead of the step's window, or compare part of a turn and then mark the whole turn compared (WR-07, WR-08, WR-09). The picker and terminal drivers drop text without a sign (WR-04, WR-06) and can return before the action they wait for has finished (WR-05).
- **Network containment.** The redirect's routing rule is correct and fails closed for what it patches. But the "every request stays on this machine" claim covers only `http`/`https` `request`/`get` and the global `fetch`, and the world's guard accepts any extension as "the redirect" (WR-01, WR-02).

**Stray `~/.pi/agent/pi-claude-marketplace/cache/plugins/valid-marketplace.json` (P1-DC-53).** No reviewed file can write it:

- Every child process that the changed drivers start gets `rpcChildEnvironment()`, so its `HOME` and `PI_CODING_AGENT_DIR` point at the sandbox. This covers the json-mode Pi, the TUI Pi, the profile Pi with the redirect, and the restart-after-crash Pi.
- The three changed architecture tests run no product orchestration. They import only `routing.ts`, `pi-tui.ts`, and `_rpc.ts`.
- The cache holds the unit-test fixture `valid-marketplace` with plugin `hello`, which only `test/orchestrators/...` and `test/architecture/config-state-consistency.test.ts` use. `test/architecture/config-state-consistency.test.ts` and `test/orchestrators/marketplace/add.test.ts` use the user scope and contain no `withHermeticHome`/`PI_CODING_AGENT_DIR`. They are the likely writers. Both are outside this phase's diff.

## Critical Issues

### CR-01: A crashed profile Pi's process group is never killed by any release

**File:** `features/lib/pi-process.ts:266-277` (with `features/support/world.ts:699-706`, `features/support/world.ts:1071-1074`)
**Issue:** `crash()` sets `this.stopped = true` and kills only Pi's own pid. The profile Pi's release, registered at `world.ts:1071`, calls `pi.stop()`, and `stop()` returns at once when `stopped` is set, so it never reaches `killProcessGroup(this.child)`. The async hook processes stay in the dead Pi's process group, and no step or release in the harness kills them. The scenario's only protection is the product's reap on the next start, which is the behavior under test. When the reap fails, the hooks run on: a product regression, the project-scope gap recorded in P1-DC-40, or a scenario that fails between the crash and the restart. `assertStandInsStopped` then fails the scenario, but the processes outlive it for up to 60 s (`RELEASE_TENTHS`). The next scenario's `Before()` empties and refills the same sandbox. Each leftover script then writes its EXIT-trap `end` line into the next scenario's `hook-lifecycle.jsonl`, and it may see a release marker that a later scenario writes. This is "a resource no release frees" (SKILL.md, BLOCKER), and it makes the next scenario fail or pass depending on order (`order: random`).
**Fix:** Keep "crashed" separate from "stopped", so that the release still kills the group once:
```ts
private crashed = false;

async crash(): Promise<void> {
  if (this.stopped || this.crashed) {
    return;
  }

  this.crashed = true;
  if (!this.exited) {
    const exit = once(this.child, "exit");
    this.child.kill("SIGKILL");
    await exit;
  }
}

async stop(): Promise<void> {
  if (this.stopped) {
    return;
  }

  this.stopped = true;
  if (!this.exited) { /* existing graceful stop */ }
  killProcessGroup(this.child); // also frees what a crash left
}
```
Alternatively, have `crashPi()` register its own `onRelease(() => killProcessGroup(...))` right after the crash.

### CR-02: The release marker is never removed, so a later run of the same hook skips its wait and races the rewake under test

**File:** `features/lib/hook-files.ts:377-386`, `features/step_definitions/hook/session.steps.ts:187-196`, `features/hook/async.feature:57-81`
**Issue:** `releaseHook()` creates `$HOME/hook-releases/<name>`, and nothing ever deletes it. Every later run of a `waits` hook with that name finds the marker and goes straight on to `exit <code>`. In "An async rewake hook that exits 2 puts its message into the model's next call", the hook `wake` matches `UserPromptSubmit *`. So `When the user prompts "next"` starts a second `wake` run, which exits 2 within a few hundred milliseconds with the same `rewake message` and `stderr`. Two things follow:
1. The expected row `2 | user | The hook woke the model.\n\nwoke up` can be produced by either run. A product that loses the rewake of a hook that exited while Pi was idle, which is the behavior in the title, can still pass whenever the second run's message lands in call 2.
2. When the second run's rewake arrives after the turn settles, it can start an unscripted call 3. That call overflows the script, but no check sees it, because `callsPastScript` only reads the turn's window and the world's end-of-scenario check (`unusedScriptSteps`) ignores overflow calls.

The suite therefore reports a result that depends on timing.
**Fix:** Consume the marker in the script, so that each release frees exactly one run, and assert that it was consumed:
```sh
while [ ! -e "$release" ] && [ "$waited" -lt 600 ]; do sleep 0.1; waited=$((waited + 1)); done
rm -f "$release"
```
In addition, make `releaseHook()` wait until the marker is gone. In this scenario, either use a matcher that the second prompt does not hit, or state the second run's lifecycle and rewake in the `Then`. Also fail a scenario in `After()` when `model-calls.jsonl` holds any `overflow: true` line.

### CR-03: "Cancelling the terminal picker installs nothing" cancels on a screen where nothing can be installed

**File:** `features/plugin/browse.feature:68-82` (driver `features/lib/plugin-picker.ts:173-185`)
**Issue:** The scenario opens the picker and cancels at once on the first screen, the marketplace list. No plugin, action, or scope has been chosen there, so no implementation of browse could install anything. `Then the user scope has no installed plugins` and `Then the project scope has no installed plugins` hold for every implementation, a correct one and a broken one alike. The cancel path where an install is possible is Escape on the action or scope screen of a chosen plugin. A plausible regression on that path, such as Escape on the scope screen falling through to a default-scope install, passes this scenario. The `Then` steps check nothing (SKILL.md: "a scenario a plausible wrong implementation still passes" is a BLOCKER).
**Fix:** Cancel where the cancel decides something:
```gherkin
When the user opens the plugin picker with "/claude:plugin browse" in pi's terminal
When the user chooses "tools [user]" in the plugin picker
When the user chooses "[available] app" in the plugin picker
When the user chooses "Install" in the plugin picker
When the user cancels the plugin picker
Then the user scope has no installed plugins
Then the project scope has no installed plugins
```

## Warnings

### WR-01: The guard against reaching the real github.com accepts any extension

**File:** `features/support/world.ts:973-983`
**Issue:** `keepTerminalSessionLocal()` refuses `withoutGitHubBaseOverride` only when `extraExtensions` is empty. A profile with `withoutGitHubBaseOverride: true` and any unrelated extension, such as `pi-launch-environment.ts` or the registry probe, passes the guard. Its RPC Pi and its terminal Pi then send GitHub requests to the real `github.com`. The doc comment (`world.ts:150-157`) and rules line 56 present this as the guard that keeps the Pi local.
**Fix:** Require the redirect itself:
```ts
if (!extensions.includes(GITHUB_REDIRECT_EXTENSION)) {
  throw new Error("a profile Pi without the GitHub base override must load the GitHub redirect");
}
```

### WR-02: The redirect "fails closed" only for the three APIs it patches

**File:** `features/lib/github-device-flow/extension.ts:1-23`, `features/lib/github-device-flow/extension.ts:235-245`
**Issue:** The header and rules line 141 say that every request of such a Pi stays on this machine and that "every other request is refused". The module only replaces `request`/`get` on the CommonJS `node:http`/`node:https` objects and `globalThis.fetch`. These paths get through:
- `net.connect`, `tls.connect`, and `http2.connect`.
- A module that bound `request` through an ESM named import (`import { request } from "node:https"`). Node does not update such bindings without `module.syncBuiltinESMExports()`.
- Any client that captured `fetch` earlier.
- Any request made before the redirect loads. Per world-and-stand-ins line 51 it loads last, after the real extension, the scripted model, the probe, and the companions.

Today's product calls `fetch` and `simple-get` at call time, so the seeds are contained. But the claim is wider than the mechanism, and P1-DC-45 shows the containment was only proven under `unshare -rn`.
**Fix:** Call `syncBuiltinESMExports()` after the `Object.assign`. Narrow the doc and the rule to the APIs that are patched. For a real fail-closed guarantee, run these scenarios under a network namespace, as the red proof did, or set `NODE_OPTIONS=--import <redirect>` so the patch is in place before any other module loads.

### WR-03: The one-shot json-mode Pi is not owned by the world and its group is not killed after a clean exit

**File:** `features/lib/pi-json-mode.ts:86-120`, `features/step_definitions/command.steps.ts:126-135`
**Issue:** The json-mode Pi is spawned `detached`, in its own group, and `killProcessGroup` runs only on the timeout path. After exit 0 the driver returns, and any process that Pi started and left in its group keeps running. Examples are a SessionStart or async hook of an installed plugin, or an MCP server under the builtin profile. The step also registers no `this.onRelease()`. This breaks the rule "the step or hook that creates a thing registers its release with `this.onRelease()`" (world-and-stand-ins line 18), and a cucumber-level abort leaves the child unowned.
**Fix:** Call `killProcessGroup(child)` in a `finally` after `close`. Have the step pass `this.onRelease` into the driver, or register `() => killProcessGroup(child)` from the step before it awaits.

### WR-04: The picker row parser drops text after the second run of two spaces

**File:** `features/lib/plugin-picker.ts:55-59`, `features/lib/plugin-picker.ts:140`
**Issue:** `line.slice(2).split(/ {2,}/u)` splits at every run, and the destructuring keeps only the first two parts. A description that holds a second aligned run loses its tail without a sign, so `the plugin picker shows the screen ... with these rows:` compares only part of the row. P1-DC-50 says the split happens "at the first run", but the code splits at every run. Separately, in `choosePickerRow` an absent selection makes `findIndex` return `-1`, so the driver presses down `target + 1` times and then times out with a misleading message.
**Fix:**
```ts
const body = line.slice(SELECTED_PREFIX.length);
const match = / {2,}/u.exec(body);
const label = match === null ? body : body.slice(0, match.index);
const description = match === null ? "" : body.slice(match.index + match[0].length);
```
In `choosePickerRow`, fail when no row is selected.

### WR-05: The action-notice wait matches any row that holds the plugin name

**File:** `features/lib/plugin-picker.ts:158-170`
**Issue:** After the picker closes, `waitForActionNotice` waits only until some screen row contains the plugin name as a whitespace-separated word. That word can already be on the screen: from an earlier command's output, from a row the redraw has not cleared yet, or from any notice that names the plugin. The wait can then return at once, and the following disk-reading `Then` (`the installation record ... holds these plugins:`) races the install that is still running. Only the 500 ms quiet window stands between them.
**Fix:** Mark the output before Enter and wait for the plugin's notice row after the mark, through `waitForTextAfter` or a screen check limited to rows that changed after the mark. Anchor it on the row grammar (`<glyph> <name> [<scope>]`), not on a bare word.

### WR-06: The terminal command steps can return early and compare a cut notice

**File:** `features/step_definitions/command.steps.ts:44-67`, `features/step_definitions/command.steps.ts:138-147`, `features/step_definitions/command.steps.ts:206-221`
**Issue:**
1. `When the user runs {string} in pi's terminal` returns after one quiet second, which can pass before Pi has even begun the command. A loopback clone that takes longer than 1 s without a redraw is another case. The rules do not stop a later disk-reading `Then` from running before the command finishes.
2. `terminalNotice` stops at the first blank row. A notice whose blocks are separated by a blank row, such as a cascade with a summary or a reload trailer, is cut there, and `strictEqual` passes on the first block alone.

Both are recorded in P1-DC-49, but the second makes a field comparison partial without a sign.
**Fix:** Have the `Then` read from the anchor down to Pi's editor frame, the next all-`─` row, and require that the rows between the block and the frame are blank. For the `When`, wait for the editor to redraw after the mark rather than for silence alone, or document in `steps.md` that a disk `Then` must follow the terminal-result `Then`.

### WR-07: The hook lifecycle waits read the whole log, not the step's window

**File:** `features/lib/hook-recorder.ts:158-174`; callers `features/step_definitions/hook/prompt-and-stop.steps.ts:128-147`, `features/step_definitions/hook/session.steps.ts:187-196`, `features/step_definitions/hook/session.steps.ts:282-290`
**Issue:** `waitForHookLifecycle()` returns as soon as the log holds any line for `hook`/`phase` since the scenario began. Some steps run the same hook more than once in a scenario: a second background prompt, a release after an earlier release, or a terminal start after the profile Pi already ran a SessionStart hook. For those steps, the earlier line satisfies the wait at once. `the user has started pi in the terminal and the hook {string} goes on in the background` then passes on the other Pi's run. Its `assertHookProcessesRunning` checks every pid file, so it does not prove that the terminal Pi started anything. No Phase 1 seed reuses a name this way yet, but these are shared steps that Phase 2 will reuse.
**Fix:** Take a start length from `readLogLengths()` at the start of the step, and have `waitForHookLifecycle` consider only the lines after it, as `readLogLinesSince` does for turns. In the terminal step, also check that the new pid file belongs to a process that the terminal session started, or that the start line is new.

### WR-08: Steps that compare part of a turn mark the whole turn compared

**File:** `features/step_definitions/hook/runs.steps.ts:168-192`, `features/step_definitions/hook/messages.steps.ts:101-118`
**Issue:** `no hook process is running` compares nothing of the turn: it polls OS processes. Yet it calls `this.markTurnCompared()`. `the hook processes record these lifecycle events:` and `the hooks show the user these rewake summaries:` compare one log or one payload kind and also mark the turn compared. The rule (steps.md line 66, world-and-stand-ins line 125) reserves `markTurnCompared()` for "a comparison of the whole of what a turn reports". In "A hook process that a dead Pi left stops when Pi starts again", the restart turn's `hook-runs.jsonl` and `hook-lifecycle.jsonl` lines are never stated. An extra or wrong hook run caused by the restart, such as a re-fired SessionStart or a re-run of `wake`, passes.
**Fix:** Remove `markTurnCompared()` from `no hook process is running`. Have the scenarios state the restart and release turns' hook runs with `the hooks record these runs:` or `the hooks record no runs`, or make the lifecycle step compare both logs.

### WR-09: The new request-log steps read the whole log, not the last `When`'s window

**File:** `features/step_definitions/git-host.steps.ts:274-308`, `features/marketplace/device-flow.feature:51-65`
**Issue:** steps.md line 68 requires a request-log step to compare "only the requests of the last `When` step". `github's sign-in receives these requests:`, `github's sign-in receives no request`, and `pi routes these github requests:` read the whole `github-device-flow.jsonl`/`github-redirect.jsonl`. In the terminal scenario, the first two routed rows come from `Given the user has run "/claude:plugin marketplace add acme/tools --scope user"`, which is setup, not the `When`. A step text that names no window misleads the reader, and a change that moves requests between a `Given` and the `When` goes unseen.
**Fix:** Record the log lengths in the existing `BeforeStep` window at each `When` and read only the lines after them, or rename the steps to say "since the scenario began" and update `steps.md`.

### WR-10: The argument-validation projector matches more than Pi's refusal and can rewrite the extension's own text

**File:** `features/lib/upstream/pi.ts:34-58`, `features/lib/upstream/index.ts:23-31`
**Issue:** The projector takes any failed tool result whose first line contains `"<tool>"` and ends with `:` as Pi's refusal. It then reduces the result to `invalid arguments: <paths>` from lines of the form `  - x:`. Pi 1.5.0's exact prefix is `Validation failed for tool "<name>":` (`node_modules/@earendil-works/pi-ai/dist/utils/validation.js:59`). The projector runs for every tool before the per-tool projectors, so a failure text that this extension writes, for example one that quotes its tool's name and lists items, would be reduced too. This breaks "a text this extension writes itself stays exact" (world-and-stand-ins line 119).
**Fix:** Anchor on the upstream prefix and keep the tolerant path parse:
```ts
const PREFIX = (tool: string): string => `Validation failed for tool "${tool}":`;
if (first.trimEnd() !== PREFIX(tool)) { return undefined; }
```

### WR-11: Impossible-state guard: `"::1"` in the loopback set

**File:** `features/lib/github-device-flow/routing.ts:9`
**Category:** necessity
**Issue:** `routeRequest` takes a WHATWG `URL`, whose `hostname` for IPv6 always keeps the brackets (`new URL("https://[::1]/").hostname === "[::1]"`). Both callers build a `URL`: `extension.ts:184` through `requestUrl()`, which brackets a raw IPv6 host, and `extension.ts:218`. So the bare `"::1"` member can never match. The unit test covers only `[::1]` (`github-device-flow-redirect.test.ts:51`).
**Fix:** Remove `"::1"` from `LOOPBACK_HOSTS`.

## Info

### IN-01: A failure in the scripted model's event forwarder becomes an unhandled rejection

**File:** `features/lib/scripted-model/extension.ts:205-221`
**Issue:** `void forwardEvents(inner, outer)` discards the promise. If iterating the faux stream or `inner.result()` ever rejects, Node reports an unhandled rejection, which can crash the Pi process by default, and `outer` never ends, so the turn hangs until the step deadline instead of failing with the cause.
**Fix:** `forwardEvents(inner, outer).catch((error: unknown) => { outer.push({ type: "error", ... }); outer.end(...); })`, or end `outer` with an error message that carries the cause.

### IN-02: The screen model treats `ESC[3J` as clearing the visible screen

**File:** `features/lib/pi-tui.ts:223-232`
**Issue:** `eraseDisplay` clears the grid for every mode `>= 2`. On xterm, `CSI 3 J` erases only the scrollback. pi-tui today sends `ESC[2J ESC[H ESC[3J` (`tui-main-screen.js:248`), so the result is the same. But a lone `3J` from a future pi-tui would blank the model's screen and not the terminal's. C1 controls (U+0080 to U+009F) are also printed as cells.
**Fix:** Handle `3` as a no-op on the visible grid. Drop code points in U+0080 to U+009F in `terminalScreen`. Pin both in `pi-tui-screen.test.ts`.

### IN-03: Two seeds pin known product defects as the behavior their titles describe

**File:** `features/plugin/config-migration.feature:27-42`, `features/plugin/browse.feature:35-51`
**Issue:** "writes it without a disabled plugin's enabled state" and the `0 plugin(s)` description state today's wrong output as intended behavior (P1-DC-34, P1-DC-48). They are tracked to Phases 8 and 12, but a reader of the feature file sees the defect as a requirement.
**Fix:** Add a `#` comment above each scenario that names the defect and the phase that owns the fix, or word the title as the gap ("... loses a disabled plugin's enabled state").

### IN-04: The `fetch` wrapper cannot route a `Request` with a body

**File:** `features/lib/github-device-flow/extension.ts:229`
**Issue:** `new Request(route.url, input)` passes a `Request` as the init dictionary. For a `Request` with a stream body, undici requires `duplex: "half"` and throws `TypeError`. The product passes a string URL today, so the seeds do not reach this path.
**Fix:** `new Request(route.url, { method: input.method, headers: input.headers, body: input.body, duplex: "half", redirect: input.redirect, signal: input.signal })`, or `input.clone()` together with a URL rewrite.

### IN-05: Impossible-state guard (judgment): `ownProcess: false` in the routed-Pi `Given`

**File:** `features/step_definitions/git-host.steps.ts:256-261`
**Category:** necessity
**Issue:** The step asserts that the `loaded` line's pid is not the cucumber worker's pid. The worker imports `extension.ts` only for `GITHUB_REDIRECT_EXTENSION` and never calls its default export, so the redirect cannot log a `loaded` line from the worker. The assertion can only fail if a future step calls the factory in-process. P1-DC-47 notes that the pid cannot be compared.
**Fix:** Drop `ownProcess` and assert `[{ configured: true }]`, or compare the pid with the profile Pi's child pid if `PiProcess` exposes it.

### IN-06: The TUI Pi gets no `TMPDIR`, so the redirect compiles into the real `/tmp`

**File:** `features/support/world.ts:843-851`, `features/lib/pi-tui.ts:388-392`
**Issue:** A terminal session started with `startTuiSession("none")` gets `rpcChildEnvironment(sandbox, git)` with no profile environment, so its jiti cache is the host `os.tmpdir()`. This phase now loads `github-device-flow/extension.ts` into such a session (`tuiExtensions`), which extends the out-of-sandbox writes to `/tmp/jiti`. The pattern itself predates this phase.
**Fix:** Give every TUI session `TMPDIR: <home>/tmp` through `prepareTemporaryDirectory()`, as `oneShotPiLaunch()` does.

### IN-07: A doc comment line exceeds the 100-column print width

**File:** `test/architecture/hermetic-git-environment.test.ts:5`
**Issue:** Prettier does not rewrap comments. The line `shell's (GHB-01), and none when the run's environment has none (D-BG-01). The background update variables also stay in the shell:` is about 130 columns.
**Fix:** Rewrap the comment.

---

_Reviewed: 2026-11-08T06:02:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
