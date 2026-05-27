---
phase: 20-migration-wave-3-edge-handlers-usageerror
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/index.ts
  - tests/edge/handlers/import.test.ts
  - tests/orchestrators/import/execute.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 20 is a mechanical V1 -> V2 notify migration. The sweep is well-executed:
the 30 `notifyUsageError` callsites switched cleanly to the V2 1-arg structured
form (`{ message, usage }`); the import orchestrator's cascade is now built
inline via `buildImportNotificationMarketplaces` and emitted through a single
`notify(opts.ctx, opts.pi, { marketplaces })` call; and the two outer
try/catch wrappers in `bootstrap.ts` and `import.ts` were dropped per D-20-03.
The ESLint MSG-Block 1 ignore-list narrowing correctly removes
`orchestrators/import/**` from the V1-routing-rules glob while keeping
MSG-Block 1b's project-first iteration enforcement (MSG-GR-3) live across
both surfaces, including the new V2 inline composer.

No critical defects found. Three warning-level findings concern (a) a
misleading inline comment in `edge/handlers/plugin/import.ts` that
overstates the safety guarantee provided by `executeScopedPlan` after the
outer catch-all was dropped, (b) a cross-iteration partial-result-loss risk
introduced by that same drop when `installPlugin` throws an unexpected
exception mid-loop, and (c) a stale line-number reference in the same
comment. Info-level findings flag a documentation drift, an unused export,
and two minor code-quality observations on the inline cascade builder.

## Structural Findings (fallow)

No structural-findings substrate was provided for this phase. Skipping
this section.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Misleading "per-scope try/catch via executeScopedPlan" claim in dropped-catch comment

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:52-55`
**Issue:** The justifying comment for the dropped outer catch reads:
> "the inner `importClaudeSettings` after Plan 20-02 owns its own per-scope
> try/catch via `executeScopedPlan` (execute.ts:745-755); catastrophic
> uncaught throws bubble to Pi runtime per D-20-03."

This overstates the safety guarantee. Inspecting
`orchestrators/import/execute.ts`:

- `loadState` IS wrapped (lines 518-528) -- on failure, the per-scope plan
  records a `settings-read-error` diagnostic and returns early.
- `addMarketplace` IS wrapped (lines 577-608) -- on failure, the
  marketplace lands in `result.marketplaceFailures` and dependent plugin
  warnings are emitted.
- `installPlugin` is **NOT** wrapped (lines 638-646). The orchestrator's
  collapsed `{status: "installed"} | {status: "failed", error, cause}`
  discriminated return covers expected failures, but an unexpected throw
  (programming bug, unhandled host-side exception, etc.) propagates out of
  `executeScopedPlan` and aborts the outer `for (const scopePlan of
  plan.scopes)` loop in `importClaudeSettings` (lines 769-771), which in
  turn skips the final `notify(opts.ctx, opts.pi, { marketplaces })` call
  at line 787.

The net effect: a single unexpected throw from `installPlugin` on scope A
will (a) prevent scope B from running at all and (b) suppress the V2
cascade for the work that DID complete on scope A. Per D-20-03 this is
acceptable behavior for "truly catastrophic" throws, but the comment
should not claim a per-scope try/catch boundary that does not exist in
the code. The referenced "execute.ts:745-755" location is also incorrect
(see WR-03).

**Fix:** Rewrite the comment to accurately describe what's covered and
what bubbles:

```ts
// No try/catch: `importClaudeSettings` wraps `loadState` and
// `addMarketplace` per-scope (execute.ts:518-528, 577-608) and routes
// expected `installPlugin` failures through the discriminated
// `{status: "failed"}` return. Unexpected throws from `installPlugin` or
// from the inline cascade build will abort the per-scope loop and skip
// the final notify() emission; per D-20-03 this is intentional --
// catastrophic uncaught throws bubble to Pi runtime where a stack trace
// is more useful than a polished message that masks the bug.
```

### WR-02: Unexpected `installPlugin` throw silently discards completed-scope cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:638-646, 769-771, 786-787`
**Issue:** Related to WR-01 but tracked separately because the underlying
risk is independent of the comment wording. Before Phase 20, the outer
try/catch in the edge handler converted any uncaught throw from
`importClaudeSettings` into a single user-visible `notifyError` message.
After Phase 20 the throw bubbles to Pi runtime. That is the design intent
per D-20-03 -- a stack trace is more useful than a masked bug. The
specific concern is that `executeScopedPlan` accumulates results into a
shared `MutableImportResult` across scopes, and the final V2 cascade
emission happens after the for-loop completes:

```ts
for (const scopePlan of plan.scopes) {
  await executeScopedPlan(opts, result, scopePlan);  // throw here ...
}

const marketplaces = buildImportNotificationMarketplaces(result);
notify(opts.ctx, opts.pi, { marketplaces });          // ... skips this
```

If a throw occurs mid-loop, both the completed-scope cascade AND the
in-progress-scope partial cascade are discarded silently from the
user-facing surface. The in-memory `result` is also lost because the
throw propagates out of `importClaudeSettings` itself. This breaks the
PRD NFR-3 "fail-clean" expectation for the partial-success path: the
user sees a Pi-runtime stack trace but no record of what DID install
on the prior scope.

**Fix:** Two reasonable options; pick one explicitly:

Option A (cheaper, preserves D-20-03 intent for catastrophic-bug
debugging): wrap the `installPlugin` call in `executeScopedPlan` in
try/catch and route unexpected throws into the existing
`result.unexpectedPluginFailures` bucket -- the same bucket
`dispatchFailedOutcome` already uses for non-`PluginShapeError`
failures. This converts an unexpected throw from `installPlugin` into
the same V2 `PluginFailedMessage {not in manifest}` surface the
discriminated-failure path already emits.

```ts
let outcome;
try {
  outcome = await installPlugin({ /* ... */ });
} catch (err) {
  result.unexpectedPluginFailures.push({
    kind: "plugin-failure",
    scope: plugin.scope,
    plugin: plugin.ref.plugin,
    marketplace: plugin.ref.marketplace,
    ref: refLabel(plugin),
    reason: "unexpected-failure",
    cause: errorMessage(err),
  });
  continue;
}
```

Option B (preserves the bubble-to-Pi-runtime contract verbatim):
explicitly document on `importClaudeSettings` that partial-result-loss
is the contract for unexpected throws, and add a test asserting the
loop aborts. The current code documents nothing about this trade-off.

### WR-03: Stale line-number reference in dropped-catch justification

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:53`
**Issue:** The comment cites `execute.ts:745-755` as the "per-scope
try/catch" location. Actual line 745-755 in the current
`execute.ts` is inside the `dispatchFailedOutcome` function body
(lines 737-746: pushing an `unexpectedPluginFailures` row) and the start
of the `importClaudeSettings` function signature (lines 748-750). No
try/catch exists in that range. The only per-scope try/catch in
`executeScopedPlan` is the `loadState` wrap at lines 518-528.
**Fix:** Update the line range to `execute.ts:518-528` (loadState wrap)
and `577-608` (addMarketplace wrap), or remove the line reference
entirely and describe the wraps by name. Pair this with the WR-01 fix.

## Info

### IN-01: ESLint config block comment references retired V1 wrappers without noting Phase 20 implications

**File:** `eslint.config.js:155-158, 188-194`
**Issue:** The MSG-Block 1 comment (lines 155-158) describes
`orchestrators/marketplace/**` and `orchestrators/plugin/**` as already
exempted because of the Wave 2 V1 wrapper retirement, then adds
`orchestrators/import/**` to that list. The IN-06 explanatory note in
MSG-Block 1b (lines 188-194) elaborates on the orchestrators/plugin/**
ignore distinction for MSG-GR-3 but does not yet mention the parallel
Phase 20 distinction for `orchestrators/import/**`: MSG-Block 1 ignores
it (because the V1 routing wrappers no longer exist there), but
MSG-Block 1b does NOT ignore it (because project-first iteration
discipline is independent of the V1 wrapper migration). Both behaviors
are correct, but a maintainer scanning these blocks would benefit from
an explicit note that `orchestrators/import/**` follows the same pattern
as `orchestrators/plugin/**`.
**Fix:** Add a brief note in the MSG-Block 1b IN-06 paragraph (line
188-194):

```js
// IN-06: `orchestrators/plugin/**` is NOT ignored here even though the
// Wave 2 V1->V2 migration retired the severity-named notify wrappers
// that MSG-Block 1 (routing rules) check for. The Phase 20 migration
// extended the same treatment to `orchestrators/import/**` (Plan 20-02
// inlined the V2 cascade construction) -- MSG-Block 1 ignores it but
// MSG-Block 1b does not, since the project-first iteration discipline
// remains in force everywhere outside `orchestrators/marketplace/**`.
```

### IN-02: `dependenciesFromInstalled` returns a `Object.freeze`d array typed as `readonly Dependency[]`

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:344-355`
**Issue:** Minor: `Object.freeze` returns its argument typed as
`Readonly<T>`; for arrays, the return type still includes the mutating
methods at the type level even though they would throw at runtime.
TypeScript's `readonly Dependency[]` already enforces immutability at
the type level for consumers, so the runtime freeze is defense-in-depth
but adds work the type system doesn't reward. The sibling
`buildImportNotificationMarketplaces` at line 499 also freezes the
per-block `plugins` array. Both are non-load-bearing.
**Fix:** Either accept the freeze as defense-in-depth and leave a brief
comment that it's intentional, or drop the `Object.freeze` calls --
the consumer-visible types (`readonly Dependency[]`,
`readonly PluginNotificationMessage[]`) already prevent the obvious
mutation paths.

### IN-03: `MarketplaceBlock.plugins` field is `PluginNotificationMessage[]` (mutable) inside an otherwise-readonly type

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:302-309`
**Issue:** The `MarketplaceBlock` interface declares `key: string` as
readonly but `name`, `scope`, `status?`, `reasons?`, and `plugins` as
mutable. The mutation pattern is intentional (the builder mutates a
single instance across multiple result loops via
`ensureMarketplaceBlock`). The asymmetry between `readonly key` and the
mutable rest is inconsistent: `name` and `scope` are set once at block
creation (line 322-327) and never reassigned; only `status`, `reasons`,
and `plugins` actually require mutation. Marking `name` and `scope` as
`readonly` would more accurately reflect the builder's intent.
**Fix:**

```ts
interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: MarketplaceStatus;
  reasons?: readonly Reason[];
  plugins: PluginNotificationMessage[];
}
```

### IN-04: `eslint-disable sonarjs/cognitive-complexity` on `executeScopedPlan` accumulates without scrutiny

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:507`
**Issue:** Pre-existing, not introduced by Phase 20. The function is
~175 lines and has six distinct phases (load state, ensure marketplaces
with three branches, surface skipped plugins, install loop with
discriminated dispatch). The Phase 20 sweep did not enlarge the
function meaningfully, but it also did not extract any of the
phase-20-touched logic (the V2 cascade construction was instead put in
the sibling `buildImportNotificationMarketplaces`). If a future plan
wants to retire the eslint-disable, the marketplaces-ensure block (lines
530-609) is the natural extraction candidate -- it has three orthogonal
branches (`existing && unknown-stored`, `existing && match`,
`existing && mismatch`, plus the `add new` else-branch) and is the
largest contributor to the cognitive-complexity score.
**Fix:** No change required for Phase 20. Filed for future extraction.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
