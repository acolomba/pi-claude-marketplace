---
phase: 08-background-autoupdate
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/pi-commands.ts
  - features/lib/result-rows.ts
  - features/marketplace/background-update.feature
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/world.ts
  - test/e2e/_rpc.ts
  - test/orchestrators/marketplace/background-gate.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/background-update.test.ts
  - test/index.test.ts
  - test/edge/register.test.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-27
**Depth:** standard (diff against `1f9e4435`)
**Files Reviewed:** 23
**Status:** issues_found

## Summary

I reviewed the gate, the pass, the scheduler, the new `background-update` raw kind in each exhaustive notification consumer, the command wrap in `edge/register.ts`, the `index.ts` wiring, and the cucumber scenario with its driver. I also read the callees the pass depends on: `marketplace/update.ts` (where the refresh lock is taken and where the cascade runs), `plugin/update-flow.ts::beginPluginUpdateRun`, `auth-host.ts`, `config-merge.ts`, `state-io.ts`, and Pi's `agent-session.js` / `runner.js` (input dispatch and the reload shutdown sequence).

**What holds up under tracing:**

- **Gate.** The in-process gate is sound. A command increments `runningCommands` before it waits on `stepSettled`. `beginStep` loops on that count. In the yield, `endStep()` and the synchronous part of `beginStep()` run in the same tick. So no step can begin while a command body runs, and no command body can start while a step is in flight. No wakeup is lost: idle waiters are pushed only while the count is positive and woken when it reaches 0, and step waiters are pushed only while a step is in flight and woken by `endStep`. A command never waits on a step that is itself waiting, so there is no deadlock. The real `updateMarketplace` takes the refresh lock only inside `snapshotAfterRefresh`, and it runs the cascade after that lock is released (MU-4). So yielding at the first plugin never hands the lock to a waiting command.
- **Shutdown.** `stopped` is set before `stepSettled()` is awaited, and every step re-checks `isStopped()` right after `beginStep()`. So after a non-quit shutdown returns, the old runtime's pass takes no state lock. The steps that are woken return early, and the pre-step reads (`loadState` with `persistMigration: false`, `loadMergedScopeConfig`) do not write.
- **NFR-2.** The input handler is synchronous and wrapped in try/catch. A rejection from the pass is caught in the timer callback, and the shutdown handler cannot throw past its try. The notice runs only after a synchronous `isStopped()` check, and a stale-context throw rejects into the debug log.
- **Credentials.** `resolveBackgroundUpdate` redacts all four string fields. The load origin makes `buildAuthForHost` use stored credentials only. `InvalidGitHubBaseUrlError`'s message carries no URL value.

The defects are in what the behavioral scenario can prove, in one lost notice, and in a race that the yield design adds.

## Critical Issues

### CR-01: The scenario cannot tell one notice per pass from one notice per plugin or per marketplace

**File:** `features/marketplace/background-update.feature:8-39` (with `features/lib/pi-commands.ts:196-219`)
**Issue:** The feature description promises Pi "names what moved in one notice" (AUP-03 / D-PL8-10). The scenario has one marketplace, one plugin, and one scope. Three plausible wrong implementations would each emit exactly the same single payload, `plugins: [demo]`, and pass every row of the outline:

1. Notifying inside `yieldingPluginUpdate` after each `updated` outcome.
2. Notifying at the end of each `updateOneMarketplace`.
3. Notifying at the end of each scope iteration.

Adding rows would not be enough on its own. `sendMessage` returns as soon as the first `claude-plugin` payload appears (line 209), so a later notice is never read: a second plugin update over git takes well over the 100 ms poll. This is the cucumber skill's BLOCKER class: "a scenario a plausible wrong implementation still passes". The unit test "reports the plugins the pass updated across both scopes in one load entry" covers the logic, but under AGENTS.md "Behavioral tests" a unit test does not replace the scenario.
**Fix:** Make the scenario move two plugins, preferably across two marketplaces or both scopes, and expect them as rows of one result:

```gherkin
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | extra | 1.0.0   |
    ...
    Then the result lists these plugins:
      | name  | marketplace | scope   | from version | to version |
      | demo  | tools       | project | 1.0.0        | 1.10.0     |
      | extra | tools       | project | 1.0.0        | 2.0.0      |
```

Then a notice per plugin or per marketplace fails the row step, because the first payload lists only one plugin. Combine this with WR-01, so that a duplicate trailing notice also fails `lastResult()`'s exactly-one check.

## Warnings

### WR-01: `sendMessage` drops every payload after the first poll that finds one, which breaks DRV-01

**File:** `features/lib/pi-commands.ts:205-210`
**Issue:** `runCommandPayloads` promises that "none is dropped ... so an extra or a missing payload reaches the step" (DRV-01). `sendMessage` returns the payloads seen at the first poll that finds any. A pass that emits a second payload after that poll (a duplicate notice, a leaked cascade row, or an MCP config notice) is never compared. `lastResult()`'s "exactly one" guarantee then depends on poll timing. The pass's last action is the notice, so "the first payload appeared" does not mean "the pass finished".
**Fix:** After the first payload appears, keep polling until the entry count stays the same for a quiet window, for example 1 s (or about 10 polls), and only then return the whole slice. Keep the window under the step timeout:

```ts
let seen = -1;
let stableSince = Date.now();
for (;;) {
  const payloads = claudePluginPayloads((await readCustomEntries(pi)).slice(before));
  if (payloads.length !== seen) { seen = payloads.length; stableSince = Date.now(); }
  else if (seen > 0 && Date.now() - stableSince >= BACKGROUND_QUIET_MS) { return payloads; }
  if (Date.now() >= deadline) { assert.fail(/* ... */); }
  await delay(BACKGROUND_RESULT_POLL_MS);
}
```

### WR-02: Nothing proves the update runs in the background rather than inside the input handler

**File:** `features/lib/pi-commands.ts:200-204`, `features/marketplace/background-update.feature:8`
**Issue:** The scenario title says "in the background". Suppose an implementation awaited the pass inside `onInput`, or ran it synchronously from the handler. Then the user's prompt would block until every refresh and update finished, and the scenario would still pass: the notice would simply already be there on the first poll. The `exchange` of the prompt request is checked only for quietness and refusal, never for the absence of the notice.
**Fix:** Assert that no `claude-plugin` payload was streamed during the prompt exchange itself. Pi refuses the prompt right after the input handlers return, and a correct pass then still has to do file and git I/O before it can append its notice:

```ts
assert.deepStrictEqual(
  claudePluginPayloads(exchange.entries),
  [],
  "the background update ran before Pi answered the message",
);
```

### WR-03: An `InvalidGitHubBaseUrlError` after an earlier update drops the notice for plugins that already moved

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts:129`, `:200-216`
**Issue:** `updateOneMarketplace` rethrows the error, and the pass rejects out of the scope loop. `notifyBackgroundUpdate` (line 216) is never reached, even when `updated` already holds rows from a marketplace processed earlier. Take a path-source marketplace whose plugin moved, followed by a GitHub-source marketplace whose refresh throws. The first plugin is changed on disk, yet the user is never told to `/reload`, which contradicts AUP-03 ("When the run moved at least one plugin, the user gets one passive notice"). D-PL8-06 says the error "ends the pass silently". Ending the pass early does not require hiding changes that were already made.
**Fix:** Report what moved before the rethrow, for example with a `finally` around the scope loop:

```ts
try {
  for (const scope of SCOPES) { /* ... */ }
} finally {
  if (updated.length > 0 && !isStopped()) {
    notifyBackgroundUpdate(ctx, openNotificationRun(deps.pi, { kind: "load" }), updated);
  }
}
```

The early `return` on a stop would also pass through this `finally`, and the `isStopped()` check keeps that path silent. Add a pass test in which the first marketplace's plugin is `updated` and the second marketplace throws `InvalidGitHubBaseUrlError`.

### WR-04: The yield lets a `marketplace noautoupdate` command run mid-cascade, and the pass then keeps updating that marketplace's plugins

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts:151-166` (callee `orchestrators/marketplace/update.ts:531`, `:572-580`)
**Issue:** `cascadeAutoupdates` reads `snapshot.autoupdate` and `snapshot.plugins` once, before the cascade starts. The D-PL8-04 yield means a `/claude:plugin marketplace noautoupdate tools` command can now run between two plugin updates. The command completes and reports success, but when the pass resumes it goes on updating every remaining plugin of `tools`, the marketplace the user has just opted out of. Before this phase, no in-process step could interleave with a cascade it did not start, so the stale snapshot was harmless. The yield turns it into a user-visible violation of the opt-in rule that D-PL8-01 relies on ("touches only marketplaces whose autoupdate is on (the user's opt-in)").
**Fix:** After `await gate.beginStep()` in `yieldingPluginUpdate`, re-read the merged config for `(marketplace, scope)`. If `autoupdate` is no longer `true`, return the same not-run failed outcome, or a skipped one, instead of calling `updatePlugin`. Use the same `loadMergedScopeConfig` read as `autoupdateMarketplaces`, with the step's `cwd`. Add a pass test in which a command run during the yield flips the config to off.

## Info

### IN-01: The new resolver was inserted between `resolveMcpMigration`'s JSDoc and its function

**File:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts:966-979`
**Issue:** The `/** AMIG-01 / AMIG-03 / AMIG-04: resolves the one migration notice per reload ... */` block now sits directly above `resolveBackgroundUpdate`. Editors and TSDoc attach it to the wrong function, and `resolveMcpMigration` loses its documentation.
**Fix:** Move `resolveBackgroundUpdate` and its `// PMOD-04` comment above the AMIG JSDoc block, or below `resolveMcpMigration`.

### IN-02: After a shutdown, the pass still reads the next scope's state and config

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts:200-202`
**Issue:** If the runtime stops during the project scope's last marketplace, `updateOneMarketplace` returns `true` and the loop still calls `autoupdateMarketplaces("user", cwd)`. It writes nothing, but it is I/O that a stopped runtime does not need (D-PL8-15: "every later step check[s] it").
**Fix:** Add `if (isStopped()) { return; }` at the top of the scope loop body.

### IN-03: Comments say Pi reads the delay variable "once, at start"

**File:** `features/step_definitions/marketplace/background-update.steps.ts:10`, `features/support/world.ts:377`
**Issue:** The extension reads `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` when the pass arms (`background-update.ts`, `maxDelay(deps.env)` inside `onInput`), not at start. The scenario needs its own Pi because the child's environment is fixed when the process is spawned. A future reader could take the comment literally and look for a start-time read.
**Fix:** Reword: "A Pi's environment is fixed when it starts, so the scenario gets a Pi of its own."

### IN-04: A stalled background fetch also hangs `/reload`, new, resume, and fork

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts:125`
**Issue:** The CONTEXT "Known limit" names only a waiting `/claude:plugin` command. But `onShutdown` awaits `stepSettled()` with no timeout, and `platform/git.ts` sets none either. So a stalled fetch also blocks Pi's `reload()` (it awaits `emitSessionShutdownEvent`) and the new, resume, and fork transitions indefinitely, until the user kills Pi. This follows from D-PL8-03 and is not a deviation, but the docs and the Known limit do not mention it.
**Fix:** Record the reload/new/resume/fork exposure next to the Known limit (and in `docs/`). Alternatively, give the shutdown wait a bound.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
