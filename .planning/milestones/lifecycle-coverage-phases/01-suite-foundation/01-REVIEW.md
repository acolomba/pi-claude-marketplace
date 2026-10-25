---
phase: 01-suite-foundation
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 50
files_reviewed_list:
  - features/lib/git-clones.ts
  - features/lib/git-plugin.ts
  - features/lib/hermetic-git.ts
  - features/lib/https-git-host/server.ts
  - features/lib/layer-config.ts
  - features/lib/path-marketplace.ts
  - features/lib/pi-commands.ts
  - features/lib/published-marketplace.ts
  - features/lib/result-rows.ts
  - features/lib/run-tokens.ts
  - features/lib/state-lock-holder.ts
  - features/step_definitions/claude-code-settings.steps.ts
  - features/step_definitions/command.steps.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/step_definitions/marketplace/update.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/step_definitions/scope-state.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/git-repository.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - features/marketplace/failed-add.feature
  - features/marketplace/remove.feature
  - features/marketplace/update.feature
  - features/plugin/bootstrap.feature
  - features/plugin/configuration.feature
  - features/plugin/enable.feature
  - features/plugin/fetch.feature
  - features/plugin/git-source-update.feature
  - features/plugin/git-source.feature
  - features/plugin/import.feature
  - features/plugin/info.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/install-rollback.feature
  - features/plugin/install.feature
  - features/plugin/partial-install.feature
  - features/plugin/pending.feature
  - features/plugin/prune.feature
  - features/plugin/reconcile.feature
  - features/plugin/reinstall.feature
  - features/plugin/state-lock.feature
  - features/plugin/uninstall.feature
  - features/plugin/update.feature
  - .agents/skills/cucumber/rules/features.md
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/steps.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
findings:
  critical: 1
  warning: 8
  info: 6
  total: 15
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 50
**Status:** issues_found

## Summary

I reviewed the phase diff `537454bd..HEAD` over `features/` and `.agents/skills/cucumber/`: the new driver pieces (state-lock holder, git plugin repositories, git clones reader, the second Pi, session results, revision and directory tokens), the shared step modules, and the seed and edited scenarios. I checked them against the cucumber skill rules. Findings that `npm run check` already enforces are left out.

The harness is mostly sound. Releases are registered next to what they create. The lock holder fails closed and the release checks that the lock is gone. Arms are disarmed by a release. Token expansion and projection are symmetric, and the three sandbox directories do not nest. The main problems are scenarios that do not prove what their titles or feature descriptions claim:

- The install-rollback scenario passes even if rollback does nothing (BLOCKER).
- The state-lock scenarios check too little to prove "changes nothing".
- The bootstrap scenario checks too little to prove "leaves it as it is".
- The import scenarios do not check the files import writes.
- The uncompared-results guard does not cover a new session's payloads that have no row array.

## Critical Issues

### CR-01: The install-rollback scenario passes when rollback does nothing

**File:** `features/plugin/install-rollback.feature:9-27` (with `features/step_definitions/mcp-configuration.steps.ts:38-61`)

**Issue:** The feature claims "An install that fails partway removes what it already wrote, so a retry starts clean." The scenario never checks the state after the failed attempt. It only shows that the retry succeeds. That does not prove rollback, for two reasons:

1. `commitPreparedSkills` (`extensions/pi-claude-marketplace/bridges/skills/stage.ts:468-489`) deletes any directory already at a skill's target path before it renames the new one into place. The comment there says a pre-existing directory "is an orphan safe to discard". Suppose the skills phase's `undo` were a no-op and left `resources/skills/demo-skill` behind. The retry would quietly replace it and still report `installed`, and the session would still offer `/skill:demo-skill`.
2. `the user has run "...", which failed` only requires every payload to be `error`. If the first install fails for an unrelated reason before any phase commits (a precheck, or a resolver error), the rollback path never runs and the scenario still passes. The comment at `mcp-configuration.steps.ts:38-40`, "fails an install in its mcp phase, after the skills phase has committed", is never checked.

A plausible wrong implementation therefore passes: an empty `skillsPhase.undo`, or an mcp-phase precheck that fails before skills are staged.

**Fix:** Add a scenario whose `When` is the failing install. It should state the failure's cause and show that nothing is left. Keep the retry scenario as a separate behavior:

```gherkin
  Scenario: An install that fails in its mcp phase leaves no installed plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | cause chain | ... |
      | fixtures         | project           | demo@fixtures | demo | failed | ...     | project | <EISDIR on {project dir}/.pi/mcp-adapter.json> | ... |
    Then the project scope has no installed plugins
```

`the project scope has no installed plugins` already lists `resources/skills` and `resources/prompts`, so it catches a skill that was left behind. The `cause chain` cell pins the failure to the mcp phase.

## Warnings

### WR-01: A new session's payloads that have no row array are never checked

**File:** `features/support/world.ts:130-147`, `features/step_definitions/session.steps.ts:41-43`

**Issue:** `When the user starts a new pi session` now records the session's payloads as the last results. The only guard against an unchecked result is `uncomparedRows` / `uncomparedNotices`, and `rowArrays()` (`result-rows.ts:78-84`) flags only non-empty `marketplaces` or `blocks` arrays. 49 feature lines start a session, and only 6 state `the session reports these results:`. In the other 43, the session can emit any of these without failing the scenario:

- a `reconcile-aborted` error, which has no row array,
- an error `reconcile-applied-cascade` with `marketplaces: []`,
- any other payload that has no rows.

Such a scenario checks only `the session offers these skills:`. Commands do not have this gap in practice, because every `When the user runs` is followed by a field step that reads `lastResult()`. Sessions have no such convention, and no step can state "this session reported nothing".

**Fix:** Track uncompared session results as a whole, not only their rows. In `recordResults`, when `source === "session"`, set `uncomparedResults = results.length`. Clear it in `the session reports these results:` and in the field steps when they run after a session. Add a step `the session reports no results` that asserts `resultsOf("session")` is `[]` and clears the marker. Then a session that emits an unexpected payload fails in `After`, the same way unread rows do today.

### WR-02: The state-lock scenarios do not prove that "nothing changes"

**File:** `features/plugin/state-lock.feature:7-26, 28-47`; `features/step_definitions/plugin/installation.steps.ts:189-198`

**Issue:** The feature says a command "fails and changes nothing" while the lock is held. The only after-state check is `the installation record of the <scope> scope holds these plugins:`, which projects each record to `id`, `version`, and `enabled`. Suppose an uninstall wrongly unstaged skills, or removed the `claude-plugins.json` declaration, before it took the lock. It would leave `state.json` alone and still pass. The demo plugin's staged skill (`resources/skills/demo-skill`) and the config declaration are never checked after the refused command.

**Fix:** Add `Then the "claude-plugins.json" file of the project scope declares these plugins:` (with `demo@fixtures`). Also add a check that the staged skill is still there. Either add a step such as `the <scope> scope stages these skills:` that lists `resources/skills`, or split out a scenario whose second `When` starts a new session and states `/skill:demo-skill`.

### WR-03: The bootstrap scenario does not show that the official marketplace was left as it is

**File:** `features/plugin/bootstrap.feature:8-19`

**Issue:** The title promises that a second bootstrap "leaves the official marketplace as it is". The scenario checks the result row (`skipped`, `already autoupdate`) and that the git host received no request. It never reads the user scope's `claude-plugins.json` or record. A second bootstrap that rewrites the declaration, flips or drops `autoupdate`, or adds a duplicate entry, while still reporting `skipped`, passes.

**Fix:** Add:

```gherkin
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name                    | source                            | autoupdate |
      | claude-plugins-official | anthropics/claude-plugins-official | true       |
```

Adjust the `source` cell to match what the product writes.

### WR-04: The import scenarios do not check the configs that import writes

**File:** `features/plugin/import.feature:13-41, 43-69`

**Issue:** The titles say import "adds their marketplace and installs their enabled plugin". The scenarios check the result rows and the next session's skills. They never read `claude-plugins.json` of the target scope. Import is supposed to record the marketplace and an explicit `enabled: true` plugin declaration (the import-vs-reconcile user-intent rule). Suppose an implementation installs without writing either declaration, or writes the plugin with no `enabled` field. It passes, and a later reconcile could undo the install.

**Fix:** Add both config checks to each scenario:

```gherkin
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | true    |
```

### WR-05: Stopping a stopped Pi sends SIGKILL to a process-group id again

**File:** `features/support/world.ts:299-304` (with `features/lib/pi-process.ts:145-158`)

**Issue:** The comment says "Stopping a stopped Pi does nothing". That is false. `PiProcess.stop()` skips the wait when `exited` is set, but it always calls `killProcessGroup(this.child)`, which runs `process.kill(-pid, "SIGKILL")`. `startSessionInAnotherProject` stops the second Pi and then registers a release that stops it again at `After`, possibly seconds later. If the old process-group id has been reused by then, the release SIGKILLs an unrelated group. Under `parallel: 8`, that could be another worker's Pi, a CGI child, or a git fixture process. The odds are low with a large `pid_max`, but the failure would be a non-reproducible flake in an unrelated scenario.

**Fix:** Make `stop()` idempotent:

```ts
private stopped = false;
async stop(): Promise<void> {
  if (this.stopped) {
    return;
  }
  this.stopped = true;
  // ...existing body
}
```

Alternatively, drop the explicit `await pi.stop()` at line 303 and let the release alone stop the Pi.

### WR-06: Nothing fails closed when Pi reaches beyond 127.0.0.1

**File:** `features/support/pi-process.ts:430-435`, `features/step_definitions/git-host.steps.ts:138-140`, `features/plugin/git-source-update.feature:34-37`

**Issue:** The new github plugin source records its clone origin as `https://github.com/acme/ghp.git` (git-source-update.feature:37). So the product stores real github.com URLs in the sandbox, and only `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` sends them to the loopback host. `the git host receives no request` (bootstrap, pinned install) only proves that the stand-in saw nothing. Suppose a code path fetched from a stored origin or a raw github.com URL, bypassing the override. With network access, that path succeeds or degrades quietly, and the scenario passes while reaching the public network. Nothing in the run environment (the allowlist env in `test/e2e/_rpc.ts`) refuses non-loopback connections.

**Fix:** Give every Pi of the run a preload, via `NODE_OPTIONS=--import <features/lib/loopback-only.ts>` in `piEnvironment`. The preload should wrap `net.Socket.prototype.connect` and `dns.lookup` and throw on any host other than `127.0.0.1` or `localhost`. A bypass then fails the scenario.

### WR-07: Two new feature descriptions are four lines long

**File:** `features/marketplace/failed-add.feature:3-6`, `features/plugin/bootstrap.feature:3-6`

**Issue:** `.agents/skills/cucumber/rules/features.md` requires "a description of two or three lines under the title". Both new features have four. `check:features` does not catch this.

**Fix:** Cut each description to three lines. For example, in failed-add: "A failed marketplace add leaves nothing behind, so the same add succeeds once its cause is gone. Local marketplaces and a loopback https git host stand in for published ones."

### WR-08: Duplicate rows in a layer-config table quietly collapse into one

**File:** `features/lib/layer-config.ts:54-76, 112-137`; `features/step_definitions/config.steps.ts:276-318`

**Issue:** `readLayerPlugins` and `readLayerMarketplaces` return arrays. `writeLayerPlugins` and `writeLayerMarketplaces` then build the map with `Object.fromEntries`, so a repeated `plugin@marketplace` key or marketplace name keeps only the last row. `assertDeclared` builds its expected value with `Object.fromEntries` too, so the read-back check agrees with the collapsed write. A copy-paste duplicate in a feature table, possibly with a different `enabled` cell, disappears without an error. The rules require parsers that throw on bad tables.

**Fix:** In both readers, throw on a repeated key:

```ts
const keys = plugins.map((plugin) => plugin.key);
if (new Set(keys).size !== keys.length) {
  throw new Error(`the table declares a plugin twice: ${JSON.stringify(keys)}`);
}
```

## Info

### IN-01: The blocking-directory comment describes an update scenario that does not exist

**File:** `features/step_definitions/mcp-configuration.steps.ts:38-41`
**Issue:** "it fails an update before the update swaps versions" describes no scenario in this phase. No update feature uses the step. The comment is speculative and will go stale.
**Fix:** Delete that clause, or add the update scenario it describes.

### IN-02: The official-marketplace release is registered before the absence check

**File:** `features/step_definitions/marketplace/publishing.steps.ts:158-172`
**Issue:** The `rm(marketplacesRoot/<name>)` release is registered before `publishOfficialMarketplace` checks that the root is absent. If the root already belonged to another publication in the same scenario, the failed step's release deletes it. The `published as a {source kind} source` step does this in the safe order (`requireFreeRoot` first).
**Fix:** Call `requireAbsent`, or a `requireFreeRoot`-style check, before `onRelease`, or register the release after `publishOfficialMarketplace` returns.

### IN-03: `holds no git clones` does not see staging leftovers

**File:** `features/lib/git-clones.ts:84-100`
**Issue:** The reader lists `plugin-clones/*` and the `sources/*` entries that hold `.git`. It ignores `sources-staging/` and any `sources/<name>` without `.git`. A clone left half-promoted in staging after an uninstall or a failed add still reads as "no git clones".
**Fix:** Also assert that `sources-staging/` is absent or empty. Fail on a `sources/` subdirectory that has no `.git` unless a path-source marketplace legitimately owns it.

### IN-04: The data-directory listing ignores empty directories and symlinks

**File:** `features/step_definitions/plugin/installation.steps.ts:200-222`
**Issue:** `holds these files` keeps only entries where `entry.isFile()` is true. An extra empty subdirectory, or a symlink the product left behind, does not show up.
**Fix:** List every entry, and fail on any that is neither a regular file nor a directory with listed contents.

### IN-05: Unknown run tokens pass through unexpanded

**File:** `features/lib/run-tokens.ts:235-246`
**Issue:** `expandTokens` leaves an unknown or misspelled token literal, for example `{ghp revison 1}`, or `{ghp revision 3}` before the third push. The typo then goes to Pi as part of a command or config source, and the scenario fails later with a confusing message instead of in the `Given` or `When` that typed it.
**Fix:** After expansion, throw if `/\{[a-z][a-z0-9 -]*\}/u` still matches. `{scenario time}` is never expanded, so that check needs no exception for it.

### IN-06: The skill text on lifting an arm conflicts with the step-order rule

**File:** `.agents/skills/cucumber/rules/world-and-stand-ins.md:13`
**Issue:** It says `the git host serves the <repository> again` "lifts an arm in the middle of a scenario". The step is a `Given`, and `features.md` forbids a `Given` after a `When`. Both uses (failed-add.feature:29, fetch.feature:19) correctly come before the first `When`.
**Fix:** Change the sentence to "lifts an arm before the scenario's `When`, after a failed setup attempt".

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
