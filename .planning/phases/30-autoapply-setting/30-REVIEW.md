---
phase: 30-autoapply-setting
round: 2
reviewed: 2026-10-25T11:29:54Z
depth: standard
diff_range: ee3132a8..69b4b848
files_reviewed: 10
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - features/plugin/autoapply.feature
  - test/orchestrators/auth-host.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/integration/mcp-migration.test.ts
  - README.md
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 30: Code Review Report (round 2)

**Reviewed:** 2026-10-25T11:29:54Z
**Depth:** standard
**Files Reviewed:** 10 (`git diff ee3132a8 69b4b848`, against the round-1 findings and `30-REVIEW-FIX.md`)
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Round-1 dispositions, checked against the code:

| ID | Verdict | Notes |
| --- | --- | --- |
| CR-01 | Fixed | `buildAuthForHost` returns `buildStoredCredentialAuth` when `run.origin.kind !== "command"`. The fix affects no caller other than the autoapply load. In production, `openNotificationRun` is called with a non-command origin in only three places: `index.ts:120` (`load`) and `bridges/hooks/settle.ts:156` and `bridges/hooks/async-rewake/registry.ts:443` (`hook`). Neither hook site reaches a clone or auth builder; they only notify. The autoupdate cascade never calls `buildAuthForHost` (it calls `buildStoredCredentialAuth` directly, D-3-04), so it is unaffected. Every command path (`add`, `update`, `install`, `fetch`, `info --fetch`, the update preflight, `marketplace/shared.ts:377`) gets a command run and keeps the Device Flow. The unit test proves the bundle shape and that nothing is notified or filled. The missing scenario is justified: the cucumber git host reaches GitHub through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, which never uses the Device Flow, and the loopback host is not a provider-registry host. |
| WR-01 | Fixed | The non-boolean scenario now sets a project base `true` beside the invalid local file, and its expected rows are unchanged, so an implementation that skips invalid files fails it. The new scenario (user base `false`, project local `true`, installed) fails "off if any file says false" and also fails "the least specific file wins". |
| WR-02 | Partly fixed (see WR-01 below) | `load.ts` now catches the apply throw, reports `reconcile-aborted` once, and runs the read-only pass. The catch does not rethrow, so `index.ts`'s boundary does not report the same error a second time. If the read-only pass then throws, the boundary reports that second, different error, which is correct. Apply's locks are released by the guard's `finally` before the catch runs, so the read pass does not deadlock. The read-only pass also rebuilds the routing tables (`closeScopePass`), so the routing state after a partial apply matches the state on disk. The round-1 headline is still open: what the partial apply committed is still not reported (WR-01 below). |
| IN-01 | Fixed | Comments in the `apply.ts` header and snapshot note, and the `types.ts` `run` doc, are updated. |
| IN-02 | Fixed | The `load.ts` header says the apply report replaces the pending block and describes the AAP-03 catch. |
| IN-03 | Fixed | The load-origin runs in `apply.test.ts` and `auth-host.test.ts` drop `commandState`. The `mcp-migration.test.ts` helper now opens a command run, which is correct because it calls the apply step directly and expects the command's empty advisory. |
| IN-04 | Fixed | The README explains that the project local config, not a user config, turns off a project's `autoapply`, and that a load never asks the user to sign in. |

## Warnings

### WR-01: An aborted autoapply load still drops what the apply already committed, including the one-time MCP migration notice

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:89-101`
**Issue:** The new catch reports the abort and then runs the read-only pass. But the rows that `applyReconcileWithReader` collected before the throw are still thrown away, together with its `accumulators.migration`. So two things go unreported:

1. **Committed changes.** Installs, uninstalls and enables that committed before the GHB-03 throw are never reported, and no `/reload` trailer is shown. The read-only pass cannot list them because they are no longer pending, so the pending block it prints does not mention them. MCP servers and agents installed this way need a reload (D-07), and the user is not told.
2. **The MCP migration notice (AMIG-03).** `openScopePass` runs the MCP move right after the read pass and before `applyPlan`, and GHB-03 throws inside `applyPlan` (`addMarketplace`). So the project scope's move can commit and then lose its notice. The read-only pass then runs the move again, but the move has no stored flag: the marked legacy entries are its only trigger, and "with no marked entry the step takes no lock and writes nothing" (`mcp-migration.ts` header). The second run therefore finds nothing and sends no notice. The notice carries the cost line (sign in again to OAuth servers, approve project servers again). Without autoapply, the read-only load always sent it. With autoapply, one GHB-03 abort loses it for good.

`30-REVIEW-FIX.md` marks WR-02 "fixed", but its first point (rows for committed changes) is not addressed. The new unit test uses an apply stub that throws before doing anything, so it cannot show this.
**Fix:** Send what the apply collected before it rethrows. In `applyReconcileWithReader`, wrap the per-scope loop:

```ts
try {
  for (const scope of scopes) { /* unchanged */ }
} catch (err) {
  notifyScopePasses(opts.ctx, opts.run, accumulators); // migration notice + committed rows
  throw err;
}
```

`load.ts`'s catch then reports the abort and runs the read-only pass as it does now. The `apply` command also benefits, because it loses the same rows on GHB-03. Add a test where one change and an MCP move commit before the throw, for example a real apply step with a GHB-03 marketplace after a path-source install, and assert that the migration notice and the installed row are sent before `reconcile aborted`.

## Info

### IN-01: The notify call inside the new catch has no guard of its own, unlike `index.ts`'s boundary

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:100`
**Issue:** `index.ts` wraps `notifyReconcileAborted` in its own try/catch and logs to `hookDebugLog`, because the notify itself can throw. One example is an RPC `appendEntry` failure, since a load run has no command-delivery recovery. In `load.ts` the call is bare. If it throws, the read-only pass that this fix exists to run is skipped, along with its routing rebuild and pending block. The throw then reaches `index.ts`, which calls `notifyReconcileAborted` again with the transport error. The NFR-2 boundary still holds, so nothing escapes the load, but the routing rebuild is lost in exactly the case the fix targets.
**Fix:** Wrap the call as `index.ts` does, so the read-only pass always runs:

```ts
} catch (err) {
  try {
    notifyReconcileAborted(opts.ctx, opts.run, err);
  } catch (notifyErr) {
    hookDebugLog(`reconcile-abort notify failed: ${errorMessage(notifyErr)}`, "env");
  }
}
```

---

_Reviewed: 2026-10-25T11:29:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
