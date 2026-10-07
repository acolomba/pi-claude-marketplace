---
phase: 05-mode-selected-json-sink
reviewed: 2026-10-07T15:07:48Z
depth: standard
files_reviewed: 145
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - tests/architecture/catalog-uat/catalog-wire.test.ts
  - tests/architecture/catalog-uat/mock-pi.ts
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/hooks-lifecycle.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-producer-wire-coverage.test.ts
  - tests/architecture/notify-will-reload-agreement.test.ts
  - tests/architecture/presentation-sink.test.ts
  - tests/architecture/workflows-marker-coverage.test.ts
  - tests/bridges/hooks/async-rewake/registry.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/hooks/if-field/index.test.ts
  - tests/bridges/hooks/settle.test.ts
  - tests/e2e/_helpers.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/help.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/prune.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/edge/json-capture.ts
  - tests/edge/notification-boundary.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/index.test.ts
  - tests/integration/auth-e2e.test.ts
  - tests/integration/fold-adoption.test.ts
  - tests/integration/hooks-additionalcontext-end-to-end.test.ts
  - tests/integration/hooks-cross-scope-reconcile.test.ts
  - tests/integration/hooks-dispatch-end-to-end.test.ts
  - tests/integration/hooks-spawn-end-to-end.test.ts
  - tests/integration/ipc-child.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/integration/path-source-tag-install.test.ts
  - tests/integration/transaction-lifecycle-cascade.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/dependency-tag-probe.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-clone-probe.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-constraint-gate.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/platform/pi-api.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-run-seeds.ts
  - tests/shared/notification-run.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notify-context.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-07T15:07:48Z

**Depth:** standard

**Files Reviewed:** 145

**Status:** issues_found

## Summary

The mode-selected sink and its migrated callers were reviewed against the explicit
145-file scope, using `26cb00566d960e2757f1ec5ed92eba0c8436293a` as the phase
base. The review traced context/run ownership, live mode reads, authentication
projection, lifecycle failure boundaries, hook cleanup, and transport assertions.
Mechanical fixture changes were distinguished from changed behavior.

One blocker remains: fresh hook dispatch can bypass the unsupported-mode guard.
The failure is reproducible through the real bridge registration. Phase 6 error
wrapping and Phase 7 mode-specific browse/authentication behavior and real-Pi e2e
remain intentional deferrals and are not findings.

## Structural Findings (fallow)

The supplied normalized structural report is preserved below. These are
structural observations, not independently established actionable defects in this
phase; they are not included in the narrative severity counts.

| Type | Location | Related file | Instances |
| --- | --- | --- | --- |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:980` | `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | 2 |
| duplicate_block | `scripts/check-corresponding-tests.mjs:205` | `scripts/check-workflow-install-scripts.mjs` | 3 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:293` | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:961` | `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:187` | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:311` | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1638` | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts:52` | `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts:37` | `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` | 2 |
| duplicate_block | `tests/architecture/catalog-uat/fixtures/plugin-list.ts:121` | `tests/architecture/catalog-uat/fixtures/plugin-list.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:317` | `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` | 2 |
| duplicate_block | `tests/integration/concurrent-install-child.ts:34` | `tests/integration/load-reconcile-race-child.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2077` | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:800` | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts:30` | `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:153` | `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts` | 2 |
| duplicate_block | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:360` | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` | 2 |

The normalized totals are 17 duplicate groups, zero unused exports, zero unused
files, and zero circular dependencies. The raw report's exit 1 is a valid audit
verdict, not an execution failure. Its baseline is the merge base with
`origin/main` (`000be227d8bb606ba9c7958eb263e527d0d5b77c`), with 405 changed
files at `d87a5a99`; it is broader than this phase's scope. The raw attribution
labels 13 duplicate groups inherited and four introduced relative to that
broader baseline. Those labels do not establish introduction by Phase 5. No
additional behavioral defect was established from these duplicate groups.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Fresh hook callbacks bypass unsupported-mode rejection

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:946-952`

**Related locations:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:926-944`;
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:340-354`;
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:377-392`;
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:170-195`.

**Issue:** The new guarded `session_start` callback rejects unsupported modes,
but `tool_call` and `tool_result` register their composite handlers directly.
Their dispatch functions check the generation and routing bucket, then call the
executor without reading `ctx.mode`. The same registration pattern is used for
`input`, `session_before_compact`, `session_compact`, and the fresh
`SessionEnd` hook dispatch during `session_shutdown`.

Existing routing entries remain available after a rejected startup, and a
supported startup can also be followed by a callback carrying an unsupported or
throwing mode getter. These callbacks can therefore start plugin commands despite
the rejected mode. The production executor prepares the hook environment and
spawns a command; its async branch can also register a child and persist its PID.
This violates MODE-02's membership check before state changes and D-05-02's
explicit prohibition on continuing mutations in an unsupported mode. Preserving
read-only discovery or completing existing-child cleanup does not authorize
starting fresh plugin work.

**Reproduction:** Registered the actual bridge with an in-memory executor,
populated a `PreToolUse` Bash routing entry, invoked its `session_start`
callback with `get mode() { modeReads++; return "unsupported"; }`, then invoked
the registered `tool_call` callback using that same context. The read-only state
seam returned no usable state; no plugin command or filesystem mutation was
performed by the reproduction. Node 26.10.0 returned:

```json
{
  "afterStart": { "executions": 0, "modeReads": 1 },
  "afterToolCall": { "executions": 1, "modeReads": 1 }
}
```

Thus startup rejected the mode, but the later callback executed fresh work and
did not even read the mode. A direct `compositeHandlerFor` reproduction likewise
returned one execution and zero mode reads.

**Fix:** Validate the live callback context before each fresh hook dispatch,
including the composite and tool-result paths. Catch only the mode-validation
failure at the lifecycle boundary, log it with the existing debug logger, and
return without executing the hook. Preserve existing generation checks,
independent shutdown cleanup, and terminal-child cleanup; avoid wrapping the
whole executor in a new catch that changes its error contract. A boundary can
use the existing pattern:

```typescript
try {
  requireNotificationMode(ctx.mode);
} catch (error) {
  hookDebugLog(`hook dispatch skipped: ${errorMessage(error)}`);
  return;
}
return handler(event, ctx);
```

Add registered-callback tests with populated routing buckets for unknown modes
and throwing mode getters. Assert zero executor calls for each fresh dispatch
event, including after a previously supported callback, and retain successful
dispatch assertions for the four supported modes.

## Validation Evidence and Limits

The supplied full `npm run check` passed at
`5ba904966f9d76e0f83651edc6c98b7967b88e22` on Node 26.10.0 with 264
source/test pairs. The supplied strict corpus check reports 3149 baseline entries
and zero extras. Subsequent changes before this review were planning artifacts,
so the existing build-input validation was reused. Those checks do not exercise
the unsupported-mode callback sequence reproduced above.

Review-specific execution used the real hook registration and dispatch code with
an injected executor, without installing dependencies or changing source files.
Only this review artifact was created. A05-01/A05-02 and P05-01/P05-02 remain
independent verifier judgments.

---

_Reviewed: 2026-10-07T15:07:48Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
