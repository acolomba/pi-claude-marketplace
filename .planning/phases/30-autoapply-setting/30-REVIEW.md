---
phase: 30-autoapply-setting
reviewed: 2026-10-25T11:18:42Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/index.ts
  - test/persistence/config-io.test.ts
  - test/persistence/config-merge.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/index.test.ts
  - test/integration/workflow-kind-inversion.test.ts
  - features/plugin/autoapply.feature
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-10-25T11:18:42Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the diff since `45b1b8de`: the `autoapply` schema field, `loadAutoapply`/`resolveAutoapply`, the autoapply branch in `load.ts`, the load-origin silence in `apply.ts`, the `index.ts` wiring, and the tests and scenario. The core logic is correct. The precedence order (project local, project base, user local, user base) matches D-04. Any invalid file turns autoapply off (D-03). `loadConfig` never throws, so `loadAutoapply` adds no new way for the load to throw. Options are forwarded correctly: `scope` and `gitOps` stay out, and `migrateMcpEntries` is passed only when set. The unit test checks the exact key set. The empty-advisory check on `run.origin.kind` is right: with a load origin, `commandStateFor` returns `undefined`, so no command-only run state is touched. The `index.ts` NFR-2 boundary still catches everything.

The main problem is what the load now reaches through `apply`. Before this phase, only a command the user typed could start an interactive GitHub Device Flow. Now a session start or `/reload` can start one, and it waits for up to the device code's lifetime inside `resources_discover`. No locked decision covers this, and the codebase's own rule for network work the user did not start (D-3-04, the autoupdate cascade) says the opposite. The scenarios also leave two decided behaviors without a test that a plausible wrong implementation would fail.

## Critical Issues

### CR-01: An autoapply load can block `resources_discover` on an interactive GitHub Device Flow

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:84-92` (path: `orchestrators/reconcile/apply.ts:266-268`, `:461-463` -> `orchestrators/auth-host.ts:194-206` -> `domain/github-auth.ts:339-342`)
**Issue:** The autoapply branch passes the load's `ctx` and `run` to `applyReconcile`. `apply` then passes them to `addMarketplace` (apply.ts:266-268) and `installPlugin` (apply.ts:461-463). Both build their clone auth with `buildGitHubAuth` / `buildCloneAuth`, which call `buildAuthForHost`. For github.com, that returns a `device-flow` bundle. Its `onAuthRequired` refuses only in `print` mode (auth-host.ts:194). In `tui`, `json` and `rpc` it calls `initiateDeviceFlow`, which shows a user code and polls until `expires_in` runs out (github-auth.ts:340-342; GitHub's default is 900 s).

So the first `/reload` or session start after a project declares a private GitHub marketplace or plugin, with no stored credential, waits for up to 15 minutes inside `prepareResources`. Resource discovery cannot finish until it returns. The user started no command and may not see the code. In RPC mode the code reaches the front end only if that front end renders `device-flow-prompt` entries. A second load in the same session (Pi's `new_session` binds the extension twice, per D-12) can prompt again: no `authMemo` crosses loads, and the reconcile apply pass passes no `authMemo` at all.

The codebase already decided how network work the user did not start should authenticate. The autoupdate cascade "has no notification context to render a Device Flow user code in", so it uses `buildStoredCredentialAuth` (auth-host.ts header and `buildCloneAuth` doc, D-3-04). Upstream, Claude Code's start-time install of user-settings plugins is a background pass and does not block. The phase's decisions (AAP-D1, D-05, D-09) accept network use and clones at load, but none of them accepts an interactive auth prompt that blocks the load.
**Fix:** Make auth at load use stored credentials only. Add an option to `ApplyReconcileOptions`, or derive it from `run.origin.kind === "load"` at the auth seam, and pass it to `addMarketplace` and the install, dependency-install and converge operations so they build `buildStoredCredentialAuth(host, credentialOps)` and not `buildAuthForHost`:

```ts
// auth-host.ts, buildAuthForHost (sketch)
if (provider === undefined || run.origin.kind !== "command") {
  return buildStoredCredentialAuth(host, credentialOps);
}
```

A helper miss then becomes the existing `NO_STORED_CREDENTIAL_CAUSE` failed row (D-09: it stays pending, and `/claude:plugin apply` can run the Device Flow on demand). Add a scenario: autoapply on, a private git source, no stored credential. The load reports a failed row and returns, and no `device-flow-prompt` is sent. If the user wants the prompt at load, record that as a decision with the blocking cost written down.

## Warnings

### WR-01: The scenarios do not test D-03's cross-file fail-closed rule or the direction of D-04's override

**File:** `features/plugin/autoapply.feature:173-196` and `:90-146`
**Issue:** (a) The non-boolean scenario writes `{ "autoapply": "yes" }` to the project local config, but no other file sets `autoapply: true`. An implementation that skips invalid files and resolves from the valid ones also lands on "off" and passes. That breaks D-03's safety rule ("when any of the four config files is invalid, the load does not autoapply at all"), and no scenario would catch it. (b) Every precedence scenario has a more specific `false` beating a less specific `true`. The rule "off if any file says false, else on if any says true" passes all nine scenarios, and it breaks D-04 (a project `true` must override a user `false`). Both are covered only by unit tests (`config-merge.test.ts` cases, `load.test.ts` "AAP-01 / D-03"). AGENTS.md requires a cucumber scenario for each change to `/claude:plugin` behavior that a user can see. D-03 is the safety part of the feature.
**Fix:** In the invalid scenario, also write `{ "autoapply": true }` to the project base (or user base) config, so off can only come from the fail-closed rule. Add a precedence scenario where a more specific `true` overrides a less specific `false`, for example user base `{ "autoapply": false }` and project base `{ "autoapply": true }`, with the session installing the plugin.

### WR-02: A throw from the load-time apply loses the rows for changes it already made and skips everything else in the load

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:13-14`, `:84-93`
**Issue:** `apply` collects all of its rows and sends them at the end. A throw that escapes it (GHB-03 `InvalidGitHubBaseUrlError`, which the apply.ts header says "ends the pass") throws those rows away. The load then reports only `reconcile aborted: ...`. Any install, uninstall or enable that committed earlier in the pass goes unreported, with no `/reload` trailer, even though MCP servers and agents installed this way need one (D-07). The throw also skips the rest of the read-only load: the other scope's read pass, its MCP move (AMIG-01), its per-session warnings, and its routing rebuild (DISP-02). The read-only load would have run all of these. The comment "reports it as `reconcile-aborted`, as for this pass" suggests nothing changed, but the read-only pass reaches no auth seam and cannot throw GHB-03. With `autoapply` on, one bad `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` value turns every load into a whole-load abort. D-09 keeps the abort row and `load.ts` adds no catch. That decision accepts the row, not the lost rows.
**Fix:** Keep D-09's abort row, but do not lose committed facts. One option: `applyReconcileWithReader` catches `InvalidGitHubBaseUrlError` around the per-scope loop, sends the accumulated cascade (`notifyScopePasses`), and then rethrows so the caller still reports the abort. At least correct the `load.ts` comment, and add a test (index.test) where one change commits before the throw and assert what the user sees.

## Info

### IN-01: Header and option comments in `apply.ts` / `types.ts` still say a load never runs apply

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:3-5`, `:72-74`; `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:335-338`
**Issue:** The header still says "A load runs none of it (APL-03 / D-02)". An autoapply load now runs all of it. The D-05 / D-07 note (lines 72-74) and the `ApplyReconcileOptions.run` doc both say the run is "the run the `apply` command opens before the pass". At load it is the load's run, opened in `index.ts::prepareResources`. The phase updated only the silence note at lines 67-70.
**Fix:** Change these to "the `apply` command or an autoapply load (AAP-02)", and describe the run as "the run its caller opened: the `apply` command's, or the load's".

### IN-02: "nothing below is skipped" in `load.ts` is not accurate

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:11-13`
**Issue:** The autoapply branch returns before `composePendingReport` and `notifyPendingReport`. So the pending block (D-05 / D-06, described at lines 26-33) is skipped, and invalid-config and layer-gap rows go to `apply`'s cascade, not to `configOutcomes`. That is intended (D-07 replaces the block with apply's report), but the comment says the opposite.
**Fix:** "...runs the same read pass, MCP move, warnings and routing rebuild; its report replaces the pending block (D-07)."

### IN-03: The load-origin apply test uses a run shape that production never builds

**File:** `test/orchestrators/reconcile/apply.test.ts:825`
**Issue:** `{ ...runWithNothingLoaded(), origin: { kind: "load" } }` keeps the seed's `commandState` and its command-only `entrySink`. `openNotificationRun` never puts a `commandState` on a load run. The test passes only because `commandStateFor` reads `origin` first. If the dispatcher one day read `run.commandState` directly, this test would keep passing while production load runs (which have no `commandState`) behaved differently.
**Fix:** Add a `loadRunWithNothingLoaded()` seed in `test/shared/notification-run-seeds.ts` that builds `{ origin: { kind: "load" }, softDeps, entrySink }` with no `commandState`, and use it here.

### IN-04: Under D-04, a user-level `false` cannot veto a committed project `true` (security note on a locked decision)

**File:** `extensions/pi-claude-marketplace/persistence/config-merge.ts:206-231`
**Issue:** The order puts project base ahead of user local and user base, so a user cannot turn autoapply off for every project. A cloned repo's committed `.pi/claude-plugins.json` with `"autoapply": true` overrides even `~/.pi/agent/claude-plugins.local.json` `{ "autoapply": false }`. The only defense is a per-project local file written before the first `pi` start, which is impossible for a fresh clone. This follows D-01 / D-04 (AAP-D1 accepts the risk), so it is not a defect. But the README risk text should say that the user config cannot block a project from turning autoapply on.
**Fix:** No code change under the locked decisions. Say this in the README "Configuration files" risk paragraph. If the user wants a global opt-out, that needs a new decision.

---

_Reviewed: 2026-10-25T11:18:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
