---
phase: 01-suite-foundation
fixed_at: 2026-10-23T00:00:00Z
review_path: .planning/phases/01-suite-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-23
**Source review:** .planning/phases/01-suite-foundation/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (CR-01, WR-01..WR-08)
- Fixed: 8
- Skipped: 1 (WR-06)

**Where the work and verification ran:** in the main checkout of the phase worktree
(`claude/plugin-lifecycle-coverage-b1d431`), not in a nested review-fix worktree. The caller
pinned this checkout and branch, and a nested worktree would have no `node_modules` for the
cucumber run. Final gates on the tip `aa946760`: `npm run check:features` exit 0;
`npm run test:cucumber` exit 0 (463 scenarios, 4402 steps passed). Each commit also passed the
pre-commit hook (including `npm run check:commit` for the `.ts` build inputs).

## Fixed Issues

### CR-01: The install-rollback scenario passes when rollback does nothing

**Files modified:** `features/plugin/install-rollback.feature`
**Commit:** fd078ab2
**Applied fix:** Added the scenario "An install that fails in its mcp phase leaves no installed
plugin". Its `When` is the failing install. It states the whole failed row, including the cause
chain `EISDIR: illegal operation on a directory, read '{project dir}/.pi/mcp-adapter.json'`
(only the mcp phase reads that file, after the skills phase has committed). It then states
`the "claude-plugins.json" file of the project scope declares no plugins` and
`the project scope has no installed plugins`. The retry scenario stays as a separate behavior.
Mutation check: I made the skills phase `undo` a no-op in `install-outcome.ts`. The new scenario
then failed with `skills: ['demo-skill']`. I restored the product file with `git checkout`, so it
is not part of any commit. The current product behavior is correct: rollback removes the skill.

### WR-01: A new session's payloads that have no row array are never checked

**Files modified:** `features/support/world.ts`, `features/step_definitions/command.steps.ts`,
`features/step_definitions/session.steps.ts`, `.agents/skills/cucumber/rules/steps.md`,
`.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** 26ab9f73
**Applied fix:** The world now tracks `uncomparedSessionResults` (the kinds of a new session's
payloads). `recordResults` sets it for a session and asserts that the previous session's results
were compared. `After` fails a passing scenario that still has uncompared session results. A new
`markResultsCompared()` clears it. Three steps call it: `the result has these fields:` (it states
the one result, so it states every result), `the session reports these results:`, and
`the command reports these results:`. I updated the skill rules to match: `steps.md` now lists
three `Then` side-effect exceptions, and `world-and-stand-ins.md` describes the session guard.
Deviation from the suggestion: I did not add a step `the session reports no results`. A session
that emits nothing leaves nothing to compare, so the guard already covers that case. An extra step
used only to fill the usage gate would add nothing. All 463 scenarios still pass, so no existing
session had an unstated payload. Mutation check: when I removed `markResultsCompared()` from
`the session reports these results:`, the configuration feature failed with "no step compared the
fields of these results of the last session".

### WR-02: The state-lock scenarios do not prove that "nothing changes"

**Files modified:** `features/plugin/state-lock.feature`,
`features/step_definitions/plugin/installation.steps.ts`
**Commit:** 439b233b
**Applied fix:** Both scenarios now also state
`the "claude-plugins.json" file of the <scope> scope declares these plugins:` (`demo@fixtures`) and
a new step, `the <scope> scope stages these skills and prompts:`. It lists `resources/skills` and
`resources/prompts` as one whole `| kind | name |` table, sorted by name. Both scenarios use the
step, so it passes the usage gate. The current behavior is correct: the declaration and
`demo-skill` stay in place after the refused uninstall.

### WR-03: The bootstrap scenario does not show that the official marketplace was left as it is

**Files modified:** `features/plugin/bootstrap.feature`
**Commit:** 24254620
**Applied fix:** Added `the "claude-plugins.json" file of the user scope declares these
marketplaces:` with `claude-plugins-official | anthropics/claude-plugins-official | true`. I read
the source cell from the product output. No step reads a marketplace's state record, so the
config declaration is the check.

### WR-04: The import scenarios do not check the configs that import writes

**Files modified:** `features/plugin/import.feature`
**Commit:** 8a058340
**Applied fix:** Both scenarios now state the target scope's marketplace declaration
(`fixtures | {home}/marketplaces/fixtures`) and its plugin declaration (`demo@fixtures`).
Deviation from the suggestion: the plugin table has no `enabled` column. Import writes
`"demo@fixtures": {}`, which is what a plain install writes (`install.feature` states `| id |`
only). The config reads an absent `enabled` as enabled: reconcile acts on `enabled !== false`, see
`orchestrators/reconcile/types.ts`. So the current behavior is correct, and reconcile does not
undo the install. A missing declaration now fails the scenario.

### WR-05: Stopping a stopped Pi sends SIGKILL to a process-group id again

**Files modified:** `features/lib/pi-process.ts`
**Commit:** 99182aa9
**Applied fix:** `PiProcess.stop()` is now idempotent, through a private `stopped` flag. A second
call returns before `killProcessGroup`, so the release in `startSessionInAnotherProject` no longer
kills a group id that may have been reused. The comment in `world.ts` ("Stopping a stopped Pi does
nothing") is now true, so it stays unchanged.

### WR-07: Two new feature descriptions are four lines long

**Files modified:** `features/marketplace/failed-add.feature`, `features/plugin/bootstrap.feature`
**Commit:** 1327f0ef
**Applied fix:** Cut both descriptions to three lines. Note: `features/plugin/cross-scope-install.feature`
also has a four-line description. It is outside this phase's diff and this finding, so I left it
as it is.

### WR-08: Duplicate rows in a layer-config table quietly collapse into one

**Files modified:** `features/lib/layer-config.ts`
**Commit:** aa946760
**Applied fix:** A new private helper, `requireDistinct`, throws
`the table declares a <plugin|marketplace> twice: [...]` when keys repeat. `readLayerPlugins` and
`readLayerMarketplaces` call it after they parse the rows. I checked it directly with a table that
repeats `demo@f`, and it threw. The cucumber suite is unchanged: no current table repeats a key.

## Skipped Issues

### WR-06: Nothing fails closed when Pi reaches beyond 127.0.0.1

**File:** `features/support/pi-process.ts:87-93` (and `test/e2e/_rpc.ts` `rpcChildEnvironment`)
**Reason:** skipped: a reliable loopback-only guard needs large harness changes, and the caller
said to skip in that case rather than ship a fragile guard. The work it would need:

1. Pi's environment is a fixed allowlist, built in the shared e2e harness
   (`test/e2e/_rpc.ts` `rpcChildEnvironment` and `RpcGitEnvironment`). Adding `NODE_OPTIONS` there
   changes the contract of a harness that the e2e suite also uses.
2. The preload would have to wrap every `net.Socket.prototype.connect` overload (port/host,
   options, IPC path) and `dns.lookup`, and it would have to allow Pi's own local sockets.
3. A guard that only throws does not fail closed. The reviewer's case is a code path that
   degrades quietly, and that path would swallow the thrown error. So the violation would need its
   own channel, for example a stderr marker. A per-scenario window over the stderr of the shared,
   long-lived Pi would read that channel, and an `After` check would fail the scenario. That is new
   module-level run state in `support/pi-process.ts`.
4. The guard does not cover non-node children, such as `git credential`.

These parts together are a design change to the run harness, not a narrow fix. Current
mitigations: Pi runs with `--offline` and `PI_OFFLINE=1`, and `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`
points GitHub at the loopback host. The NFR-5 BLOCK F ESLint rule also limits which product
modules can reach git.
**Original issue:** The github plugin source records real `https://github.com/...` origins, and
only the base-URL override sends them to the loopback host. A code path that bypasses the override
could reach the public network, and a scenario would still pass.

## Product bugs found

None. Each stronger check states the current behavior, and that behavior is correct: rollback
removes the staged skill (CR-01), a locked uninstall changes nothing (WR-02), a second bootstrap
keeps the declaration (WR-03), and import writes both declarations (WR-04).

---

_Fixed: 2026-10-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
