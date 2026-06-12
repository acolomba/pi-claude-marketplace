---
phase: 55-load-time-reconcile-apply-notification-wiring
fixed_at: 2026-06-11T00:45:00Z
review_path: .planning/phases/55-load-time-reconcile-apply-notification-wiring/55-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 55: Code Review Fix Report

**Fixed at:** 2026-06-11T00:45:00Z
**Source review:** .planning/phases/55-load-time-reconcile-apply-notification-wiring/55-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 10 (1 Critical + 9 Warning; `fix_scope: critical_warning` -- the 5 Info findings were not in scope)
- Fixed: 10
- Skipped: 0

`npm run check` is fully green after all fixes: typecheck + lint + format +
1709 unit tests (1703 baseline + 6 new regression tests) + 10 integration
tests. Trufflehog was run separately from the main repo (`pre-commit run
trufflehog --all-files`) and passed; per-commit hooks used `SKIP=trufflehog`
per the documented worktree limitation.

## Fixed Issues

### CR-01: Config-key / manifest-name mismatch causes perpetual destructive remove+add churn

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** b6c0452
**Applied fix:** Chose the convergence option (the review's "cleaner long-term"
alternative) over refuse-and-report, because refuse-and-report still re-clones
on every load (violating the no-network-per-load constraint).
`diffMarketplaces` now claims a recorded marketplace for a declared key whose
name matched nothing when `samePlannedSource` matches (new
`findRecordedBySource` helper); claimed records are excluded from the removal
loop, so back-to-back reconciles converge with zero network and the removal
cascade can never fire as collateral. Claimed records stay OUT of the
uninstall bucket, so plugins are never uninstalled as collateral either. The
`(added)` cascade row now carries `result.name` (the manifest-derived name the
record was actually created under). Preview/apply agreement holds because both
consume the same planner. Pinned by a regression test: config key `my-mp` vs
manifest name `valid-marketplace`; first apply records the manifest name with
one clone; second apply asserts zero clones, zero notify, record intact.

### WR-01: `applyReconcile` has no per-scope failure isolation

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** 88fcfac
**Applied fix:** Wrapped `readPassForScope` in try/catch inside the scope
loop. A throw is coerced into the documented `invalid-block` state-load arm
(`state.json` subject) via a new `classifyReadPassThrow` helper:
`StateLockHeldError` renders `{lock held}`, a corrupt state.json renders
`{unparseable}` (loadState wraps the SyntaxError one level deep in
`Error.cause`, so the classifier unwraps before delegating to
`narrowProbeError`). The sibling scope still reconciles and accumulated
outcomes still notify. Regression test: corrupt project state.json + healthy
user scope asserts ONE notify carrying both the `{unparseable}` row and the
user-scope `(removed)` row, and that the corrupt file is not rewritten.

### WR-02: Apply projection drops the `unstaged` plugin rows on marketplace removal

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** fbba855
**Applied fix:** `applyMarketplaceRemoves` now folds `result.unstaged` into
the outcome stream as `plugin-uninstalled` rows before the `mp-removed`
outcome, restoring the D-22-02 per-plugin `(uninstalled)` contract on the
reconcile surface. The RECON-02 fixture gained a recorded plugin and the test
asserts its `(uninstalled)` child row. (The partial-failure arm's per-plugin
attribution noted in the review body would require widening
`RemoveMarketplaceOutcome`'s failed arm; the review's prescribed fix covers
the success arm, which is what was applied.)

### WR-03: Network clone failure renders `{unparseable}` instead of the documented `{network unreachable}`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** e83fe40
**Applied fix:** Added the errno ladder (ENETUNREACH / ECONNREFUSED /
ENOTFOUND / ETIMEDOUT / ECONNRESET / EAI_AGAIN -> `"network unreachable"`) to
`classifyAddError`, corrected the false "the clone-catch already classifies
those" comment in `handleAddFailure`, and updated the
`AddMarketplaceOutcome` docstring. Tightened the RECON-03 apply test to assert
`{network unreachable}` appears (and, post-CR-01, that the sibling success row
renders on the recorded manifest name). No catalog change needed -- the
catalog already documents the token; production can now emit it.

### WR-04: Orchestrated `setPluginEnabled` labels every transaction throw `"lock held"`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
**Commits:** 62edf7c, f4d5456
**Applied fix:** The orchestrated catch now narrows on
`instanceof StateLockHeldError` for `{lock held}` and routes all other throws
through the standalone disable arm's errno ladder (`narrowDisableFailure`:
permission denied / source missing / unreadable). Follow-up commit f4d5456
extracted the narrowing into a named `classifyTransactionThrow` helper after
the inline ternary pushed `setPluginEnabled` past the sonarjs
cognitive-complexity budget (behavior unchanged).

### WR-05: Every Pi startup writes config + state into every project directory

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/edge/index-handler.test.ts`
**Commit:** e78796f
**Applied fix:** Two changes to `readPassForScope`: (1) pristine-scope gate --
no state.json AND no config file (base or local) returns a no-op before the
lock (no mkdir, no lock file, no generated config; consistent with the Phase
52 MIG-01 contract "generate from EXISTING state.json", since an absent
state.json means nothing to migrate); (2) switched from `withStateGuard`
(unconditional save on closure return) to `withLockedStateTransaction` with NO
`tx.save()` -- the read pass mutates nothing on state, so a no-op load leaves
state.json bytes and mtime untouched. Pinned by new RECON-05 state-byte/mtime
assertions and by zero-file-creation assertions (cwd AND user scope) in the
index-handler clean-reconcile test. The two-process race integration suite
(Pitfall 52-2 / 52-4 scenarios) passes unchanged.

### WR-06: Uninstall silent-converge reported as `(uninstalled)` by the apply cascade

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/plugin/uninstall.test.ts`
**Commit:** ea7a96e
**Applied fix:** Added an explicit `{ status: "converged"; name }` arm to
`UninstallPluginOutcome` (absent `version` was not a reliable discriminator);
the PU-5 alreadyGone branch returns it in orchestrated mode and
`applyPluginUninstalls` drops it (`continue`), restoring PU-5 literal silence
(PRD 5.2.2) on the reconcile surface. New orchestrated converge test asserts
`status: "converged"` with zero notify. `UninstallPluginOutcome` has no other
consumers, so no further call sites needed updating.

### WR-07: Import records a failed marketplace add as `(added)` and double-notifies

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `tests/orchestrators/import/execute.test.ts`
**Commit:** 1faae9d
**Applied fix:** `executeScopedPlan` now calls `addMarketplace` with
`notifications: { mode: "orchestrated" }` and dispatches on the typed
outcome: `status === "added"` pushes the success row; anything else (typed
failure, contract-violating `undefined`, or an unexpected throw via the
retained defensive catch) routes through a new module-level
`recordMarketplaceAddFailure` helper that blocks dependent plugin installs
and attributes `outcome.cause` on both the marketplace failure row and each
dependent plugin warning. This also removes the standalone failure notify,
restoring import's one-cascade-per-command discipline. The 17 test stubs that
returned `undefined` (old void-success semantics) were updated to return
typed `added` outcomes; a new regression test drives a typed
`duplicate name` failure and asserts no `(added)` row, blocked dependents,
attributed cause, and exactly ONE notification.

### WR-08: The "NFR-2 boundary preservation" handler test is vacuous

**Files modified:** `tests/edge/index-handler.test.ts`
**Commit:** 97d2bbc
**Applied fix:** The test now seeds an invalid project config so
`applyReconcile` genuinely calls `ctx.ui.notify`; a throw-once stub makes the
first (cascade) call throw, propagating a REAL error into index.ts's catch
arm, and asserts (a) the handler still resolves a `ResourcesDiscoverResult`
and (b) the last-ditch notify fired exactly once with a message starting
`reconcile aborted:` at `"error"` severity. A second case keeps the
always-throwing ctx (also seeded with the invalid config so the path is
actually exercised) to pin the inner catch, asserting both notify attempts
occurred. Note: the review's suggested corrupt-state.json driver no longer
throws past `applyReconcile` after the WR-01 fix, so the throwing-notify
driver was used instead -- it is the only injection-free real propagation
path left, which is itself evidence WR-01 closed the accidental ones.

### WR-09: Reconcile-driven enable/disable writes the `enabled` flag into the BASE config

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** b37e2d6
**Applied fix:** The `fresh`-arm config write-back (`writeConfigEntry` +
`saveConfig`) is now skipped when the call is orchestrated -- the
reconcile-driven declaration already exists by construction (possibly only in
`claude-plugins.local.json`), and the config is the reconcile's INPUT, never
its write target. `tx.save()` still persists the state mutation. Regression
test: base `enabled: true` + local `enabled: false` + materialised record;
`applyReconcile` applies the `(disabled)` row, both config files are asserted
byte-unchanged, and a second reconcile converges silently.

## Out-of-Scope Notes

- IN-04 (StateLockHeldError classifying as `{unreadable}`) was incidentally
  improved for the READ pass by WR-01's `classifyReadPassThrow` (`{lock
  held}`); the apply-loop `classifyOrchestratorThrow` path the Info finding
  cites was left as-is (Info findings out of scope).
- IN-05's permissive RECON-03 disjunction was incidentally replaced with the
  strong conjunctive assertion while tightening that test for WR-03/CR-01.

---

_Fixed: 2026-06-11T00:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
