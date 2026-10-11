---
phase: 05-mode-selected-json-sink
reviewed: 2026-10-07T16:01:16Z
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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-07T16:01:16Z

**Depth:** standard

**Files Reviewed:** 145

**Status:** clean

## Summary

The mode-selected sink and its migrated callers were reviewed against the explicit
145-file scope, using `26cb00566d960e2757f1ec5ed92eba0c8436293a` as the phase
base. The review traced context/run ownership, live mode reads, authentication
projection, lifecycle failure boundaries, hook cleanup, and transport assertions.
Mechanical fixture changes were distinguished from changed behavior.

The original blocker, CR-01, is resolved by
`cd569d2aeb02f2691a636e325fc3c7976c4952c1`. Independent re-review covered the
two-file fix and its registration, generation, executor, and cleanup boundaries.
The subsequent verifier found a bookkeeping gap missed by that review. Its
four-file correction at `191f75e83dfa3fc26a43edaee315ce72da831ac2` has now
also been independently reviewed. No open code-review findings remain.
Phase 6 error wrapping
and Phase 7 mode-specific browse/authentication behavior and real-Pi e2e remain
intentional deferrals and are not findings.

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

### Current Findings

No open critical, warning, or informational findings remain.

### Resolution History: CR-01 — Fresh hook callbacks bypass unsupported-mode rejection

**Status:** resolved; independently verified at
`cd569d2aeb02f2691a636e325fc3c7976c4952c1`.

**Original classification:** BLOCKER. Excluded from current finding counts.

**Verified resolution:** `bindDispatch` at
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:831-849`
validates the live mode for all six affected registrations at lines 947-981.
The outer generation check still runs before any context access. The catch
contains only mode reading and membership validation; callback execution remains
outside it, preserving executor rejection behavior. Factory-time child shutdown
and orphan reaping remain outside the new guard, and terminal-child removal and
PID-table persistence still precede notification mode handling.

All 70 new regression cases use the actual bridge registrations and populated
routing buckets. They cover seven hook outcomes, including both tool-result
branches, with unsupported strings and throwing getters after rejected startup
or after successful dispatch in each of tui, print, json, and rpc. The live-mode
cases assert exactly one dispatch across the supported and rejected calls.

The original registered-callback reproduction was independently repeated after
the fix and returned:

```json
{
  "afterStart": { "executions": 0, "modeReads": 1 },
  "afterToolCall": { "executions": 0, "modeReads": 2 },
  "staleGeneration": "no context read"
}
```

An additional stale-generation probe supplied a throwing mode getter and
returned without accessing it. The independent logic review and executable
regressions resolve the fixer's generic human-verification caveat; no concrete
human-only check remains for CR-01.

The original finding and pre-fix line references are retained below as history.

**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:946-952`

**Related locations:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:926-944`;
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:340-354`;
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:377-392`;
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:170-195`.

**Original issue:** The new guarded `session_start` callback rejects unsupported modes,
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

**Original reproduction:** Registered the actual bridge with an in-memory executor,
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

**Original fix recommendation (implemented):** Validate the live callback context before each fresh hook dispatch,
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

### Subsequent Verification Gap: A-05-01 / MODE-02 — resolved in code

**Original classification:** BLOCKER, reported by the independent verifier after
the first review fix. Excluded from current finding counts.

**Original issue:** The earlier review closed CR-01's fresh-dispatch gap but
missed state-only callbacks. `before_agent_start` drained pending context,
`agent_end` replaced assistant state, and the second `input` subscription reset
the Stop count and cap latch without mode validation. Settle consumed its cached
assistant before its branch-local validation. These changes were not independent
cleanup and violated MODE-02. The verifier's finding superseded the earlier
broad claim that the root audit was complete.

**Fix and independent resolution:** Commit
`191f75e83dfa3fc26a43edaee315ce72da831ac2` changes
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:831-849,987-1009`
to reuse the narrow wrapper, now named `bindWithMode`, for bookkeeping. It moves
settle's mode check to
`extensions/pi-claude-marketplace/bridges/hooks/settle.ts:138-149`, before
`takeLastAssistant()`. All 11 real registrations were traced:

| Registration | First callback state change/work | Mode guard |
| --- | --- | --- |
| session_start | Hydration and routing rebuild, shared directories, dispatch | Existing startup boundary |
| session_shutdown | Fresh SessionEnd dispatch | bindWithMode |
| session_before_compact | Fresh PreCompact dispatch | bindWithMode |
| session_compact | Fresh PostCompact dispatch | bindWithMode |
| input, first subscription | Fresh UserPromptSubmit dispatch | bindWithMode |
| tool_call | Fresh PreToolUse dispatch | bindWithMode |
| tool_result | Fresh PostToolUse or PostToolUseFailure dispatch | bindWithMode |
| before_agent_start | Pending-context drain | bindWithMode |
| agent_end | Assistant cache replacement | bindWithMode |
| agent_settled | Assistant cache consumption | settleHandlerFor, before takeLastAssistant |
| input, second subscription | Stop-active state, count, and notification latch reset | bindWithMode |

The outer registration generation check precedes context access. Settle also
retains its own generation check before reading mode. New catches cover only the
live mode getter and membership validation; callback/executor calls remain
outside them. Registration reset, in-memory child shutdown, orphan reaping, and
async terminal-child removal/PID persistence remain independent of these guards.

Moving `openNotificationRun(pi)` outside the former Stop-branch catch does not
expose an uncontained host access. In `platform/pi-api.ts:161-209`, all three
inventory probes catch property access, invocation, and result traversal
failures. `notification-run.ts:37-38` stores the host reference without reading
`appendEntry`. An independent executable probe ran the actual settle handler
with a throwing `getAllTools` getter and a throwing `appendEntry` getter:
settle completed, the inventory getter was read three times, and the sink getter
was never read. Opening a run over a revoked host proxy also completed with all
three soft-dependency flags false. Later sink access remains inside the existing
Stop-cap notification catch.

The 54 new regression cases were read and traced to real registrations and
runtime state: 40 registered bookkeeping cases cover all four supported modes
followed by unknown/throwing modes, including seven-entry and already-notified
eight-entry Stop states; 14 settle cases preserve the exact cached assistant
across all seven stop reasons and both rejection forms. State assertions would
fail if the new guards were removed. The fixer's recorded RED run confirms all
54 failed before the production change. No additional code correction or
human-only code check is needed. The verifier owns formal A-05-01 disposition
and the separate P-05-01/P-05-02 judgments.

### Check History

The original supplied full `npm run check` passed at
`5ba904966f9d76e0f83651edc6c98b7967b88e22` on Node 26.10.0 with 264
source/test pairs. The supplied strict corpus check reports 3149 baseline entries
and zero extras. Those results supported the initial review; they are not reused
as a combined-tree gate for the subsequent source fix.

At `cd569d2a`, independent execution of
`node --test --test-reporter=dot tests/bridges/hooks/event-router.test.ts tests/architecture/hooks-lifecycle.test.ts`
exited 0 on Node 26.10.0. This includes the owner tests, the existing
rejecting-executor assertion, and the architecture test that invokes every stale
registration with arguments that throw on property access. The fixer separately
reported 108 owner tests passing and 100% direct pair coverage in the mandatory
commit hook.

At `191f75e8`, independent execution of
`node --test --test-reporter=dot tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/settle.test.ts tests/architecture/hooks-lifecycle.test.ts`
exited 0 on Node 26.10.0. This covers both changed owner suites and the
all-registrations stale-generation test. The fixer's report records 205 owner
tests passing and 100% line/function/branch coverage for both changed pairs in
the mandatory commit hook. The parent is running the full combined-tree
`npm run check` and strict corpus check for this source revision; those gates
remain separate from this clean code-review verdict.

Review-specific execution used the real hook registration and dispatch code with
an injected executor, without installing dependencies or changing source files.
Only this review artifact was changed by the reviewer. A05-01/A05-02 and P05-01/P05-02 remain
independent verifier judgments.

---

_Reviewed: 2026-10-07T16:01:16Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
