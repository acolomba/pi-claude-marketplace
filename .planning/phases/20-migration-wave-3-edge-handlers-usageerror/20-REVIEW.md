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
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 20: Code Review Report (Post-Gap-Closure)

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This is the post-gap-closure review for Phase 20 (migration-wave-3-edge-handlers-
usageerror). The prior review's three Warnings and four Info items were addressed
by Plan 20-05; IN-04 (sonarjs/cognitive-complexity disable on `executeScopedPlan`)
was explicitly deferred. The behavioral hardening from WR-02 -- a `try/catch`
around `installPlugin` inside `executeScopedPlan` that routes unexpected throws
to `result.unexpectedPluginFailures` -- is correctly implemented and round-trips
through `buildImportNotificationMarketplaces` into a V2 `PluginFailedMessage
{ reasons: ["not in manifest"] }` cascade row. The 30 V2 `notifyUsageError`
callsites across all 13 edge handlers (`add`, `autoupdate`, `list`,
`remove`, `update` under `marketplace/`; `bootstrap`, `install`, `uninstall`,
`reinstall`, `update`, `list`, `import` under `plugin/`; plus `router.ts` and
`shared.ts`) all use the structured `{ message, usage }` form consistently.
The `readonly` modifiers on `MarketplaceBlock.name` and `.scope` are correctly
applied and zero callers reassign those fields. `npm run check` is GREEN per
the gap-closure summary, and a local `tsc --noEmit` + `eslint` pass on the
two most-mutated files (`orchestrators/import/execute.ts` and
`edge/handlers/plugin/import.ts`) both exit 0.

Two warning-level findings concern (a) **stale line-number citations
re-introduced by Plan 20-05 itself**: Task 1 (WR-02) added 12 lines of
try/catch + comments inside `executeScopedPlan` BEFORE the Task 2 rewrite
of `edge/handlers/plugin/import.ts:52-63`, and Task 2 wrote line-number
citations that match the file's pre-Task-1 state, not its current state.
The same drift affects two comments in `tests/orchestrators/import/execute.
test.ts` (lines 435, 494) and one in `orchestrators/import/execute.ts:644`
that cite `importClaudeSettings:787` for the final `notify()` -- it is now
at line 808. And (b) **the new WR-02 lock-test does not cover the
cross-scope guarantee**: it exercises in-scope per-plugin loop continuation
on a single scope only, leaving the original cross-scope partial-cascade-
loss concern from the prior review's WR-02 narrative without an
explicit regression test. Three info-level items are observations on the
deferred IN-04 disable, a dead-code switch-arm pair in `importWarningReason`,
and a pattern observation (line-anchored comments keep drifting; named-
anchor comments would be more stable).

## Structural Findings (fallow)

No structural-findings substrate was provided for this phase. Skipping
this section.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Stale line-number citations re-introduced by Plan 20-05

**File:**
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:52-53`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:644`
- `tests/orchestrators/import/execute.test.ts:435, 494`

**Issue:** The prior 20-REVIEW.md flagged stale line refs as WR-03 ("Stale
line-number reference in dropped-catch justification"). Plan 20-05 Task 2
("WR-01/WR-03 -- Correct error-boundary comment") rewrote the
`import.ts:52-63` comment block with what were, at the time of writing,
the correct line numbers. However, Plan 20-05 Task 1 (committed earlier as
`2ae0aab`) had already added 12 source lines inside `executeScopedPlan`
(the new `installPlugin` try/catch + its 6-line `WR-02 (gap closure, Plan
20-05)` block comment + the `let outcome: InstallPluginOutcome;` hoist).
Those 12 lines sit BELOW `loadState` (lines 521-531) and BELOW
`addMarketplace` (lines 580-611), but ABOVE the dispatchFailedOutcome
function and the final `notify()` call.

The result is that the line citations written in Task 2 -- intended to
describe the file post-Task-1 -- match the file's PRE-Task-1 state.
Concretely:

| Citation in comment / test                                   | Actual location now           | Off-by |
| ------------------------------------------------------------ | ----------------------------- | ------ |
| `import.ts:52` -- "loadState (execute.ts:518-528)"           | `execute.ts:521-531`           | -3     |
| `import.ts:53` -- "addMarketplace (execute.ts:577-608)"      | `execute.ts:580-611`           | -3     |
| `execute.ts:644` -- "notify() at importClaudeSettings:787"   | `execute.ts:808`               | -21    |
| `execute.test.ts:435` -- "importClaudeSettings:787"          | `execute.ts:808`               | -21    |
| `execute.test.ts:494` -- "importClaudeSettings:787"          | `execute.ts:808`               | -21    |

The previous review's gap-closure self-check did not catch this because
its grep verification asserted the literal string `execute.ts:518-528`
APPEARS in `import.ts` (it does) and that `execute.ts:745-755` does NOT
appear (correct), but it never verified that the cited range still POINTS
AT the loadState try/catch. The 12-line Task 1 insert silently shifted
the target.

This is the **same class of bug** the previous review's WR-03 closed.
Closing it the same way (hand-counted line numbers in comments) sets up
the next regression.

**Fix:** Two options; pick one explicitly:

**Option A (low-effort, immediate)** -- update the citations to the
current line numbers:

```ts
// edge/handlers/plugin/import.ts:52-53
// No try/catch: importClaudeSettings wraps loadState (execute.ts:521-531),
// addMarketplace (execute.ts:580-611), and installPlugin (Plan 20-05
```

```ts
// orchestrators/import/execute.ts:644
// notify() at importClaudeSettings (execute.ts:808) still fires.
```

```ts
// tests/orchestrators/import/execute.test.ts:435 + :494
// importClaudeSettings (execute.ts:808) to fire exactly once with the cascade row.
// (3) final notify() at importClaudeSettings (execute.ts:808) fired exactly once;
```

**Option B (durable, recommended)** -- replace line-anchored citations
with function-anchored citations. The three sites being described all
have unique stable function or block names that will not drift on minor
edits:

```ts
// edge/handlers/plugin/import.ts:52-53
// No try/catch: importClaudeSettings wraps loadState (in executeScopedPlan's
// state-load try block), addMarketplace (in executeScopedPlan's
// marketplacesToEnsure loop), and installPlugin (Plan 20-05 WR-02 gap
// closure; in executeScopedPlan's pluginsToInstall loop) per-scope...
```

```ts
// orchestrators/import/execute.ts:644
// notify() at the end of importClaudeSettings still fires.
```

Option B prevents this WR from re-occurring on the next edit that touches
`execute.ts`. Pair with a one-line check in any future gap-closure
self-check that verifies cited ranges actually contain the cited construct
(`grep -c "try {" <file>` near the cited range, or similar).

### WR-02: WR-02 lock-test covers in-scope continuation but not cross-scope continuation

**File:** `tests/orchestrators/import/execute.test.ts:429-507`
**Issue:** The new lock-test `importClaudeSettings catches unexpected
installPlugin throws and surfaces a partial cascade row (WR-02)` exercises
exactly one `selectedScopes: ["project"]` invocation with three plugins
(`before`, `boom`, `after`) -- one of which throws. This locks the
per-plugin loop-continuation behavior INSIDE a single
`executeScopedPlan` invocation.

The original WR-02 narrative in the prior 20-REVIEW.md described a
different (broader) concern:

> "If a throw occurs mid-loop, both the completed-scope cascade AND the
> in-progress-scope partial cascade are discarded silently from the
> user-facing surface."

That sentence is about the OUTER `for (const scopePlan of plan.scopes)`
loop in `importClaudeSettings` (lines 790-792). The new try/catch fix
addresses the in-progress-scope concern, but the cross-scope guarantee
(scope A throws unexpectedly -> scope B still runs to completion -> single
`notify()` emits the merged cascade for BOTH scopes) is not regression-
guarded by any test. There is one existing test asserting cross-scope
independence (`keeps user and project operations independent` at line
907-940), but it has no failing/throwing path.

The behavior IS now correct (the try/catch routes throws into the result
bucket and `continue`s the per-plugin loop, so `executeScopedPlan` returns
normally and the outer per-scope for-loop iterates to scope B). But
without a test asserting that, a future refactor that hoists the
try/catch upward to wrap the entire pluginsToInstall loop, or that adds
a re-throw branch, could regress the cross-scope guarantee silently.

**Fix:** Add a sibling test that locks the cross-scope guarantee. Suggested
minimal scaffold (adapt to existing test mock conventions):

```ts
test("importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)", async () => {
  const { ctx, pi, notifications } = makeCtx();
  const attempted: string[] = [];

  await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["project", "user"],
    deps: {
      loadSettings: async (scope) => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { [`p-${scope}@mp`]: true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        attempted.push(`${opts.scope}:${opts.plugin}`);
        if (opts.scope === "project") {
          throw new Error("scope-A host crash");
        }
        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  // Both scopes attempted -- outer loop did not abort on scope-A throw.
  assert.deepEqual(attempted, ["project:p-project", "user:p-user"]);
  // Single notify() fires with merged cascade.
  assert.equal(notifications.length, 1);
  const message = notifications[0]?.message ?? "";
  assert.match(message, /p-project \(failed\) \{not in manifest\}/);
  assert.match(message, /p-user \(installed\)/);
});
```

## Info

### IN-01: IN-04 deferral now harder to retire after WR-02 commit

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:510-511`
**Issue:** The previous review filed IN-04 (`eslint-disable-next-line
sonarjs/cognitive-complexity`) as a deferred item. Plan 20-05 explicitly
chose to defer it, which is fine. However, the WR-02 try/catch added in
Task 1 introduces one additional branch in `executeScopedPlan` (the new
catch arm that pushes to `unexpectedPluginFailures` and `continue`s),
raising the cognitive-complexity score by approximately one. The
`eslint-disable` line therefore now covers a quantitatively HIGHER score
than it did pre-Phase-20. Nothing immediately breaks (the threshold of 15
is presumably already exceeded, hence the disable), but the gap between
the function's actual complexity and the policy threshold widened
without acknowledgment.
**Fix:** No code change required. If/when a future plan extracts the
marketplaces-ensure block (lines 535-612) as the previous IN-04
suggested, recount the score afterwards to verify retiring the disable
is still possible. Optionally update the previous review's IN-04 line
range (cited "lines 530-609") to the post-Phase-20 range (`lines 535-612`)
in whatever planning artifact tracks the deferral.

### IN-02: `importWarningReason` has dead switch arms after caller-side pre-filter

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:332-342, 468-474`
**Issue:** `importWarningReason` is a pure helper that maps an
`ImportWarningOutcome["reason"]` to a `Reason`. It has four arms:
`"unavailable"`, `"uninstallable"`, `"marketplace-failed"`,
`"unmappable-marketplace-source"`. Its single caller --
`buildImportNotificationMarketplaces` at lines 468-483 -- filters out
the last two reasons via an early `continue` (the "A1 DROP" branch)
BEFORE invoking the helper:

```ts
for (const o of result.warnings) {
  if (o.reason === "marketplace-failed" || o.reason === "unmappable-marketplace-source") {
    continue;
  }
  // ...
  const row: PluginUnavailableMessage = {
    status: "unavailable",
    name: o.plugin,
    reasons: [importWarningReason(o.reason)],
  };
}
```

So only `"unavailable"` and `"uninstallable"` reach `importWarningReason`.
The other two arms are unreachable at the current callsite. This is not
a bug -- the helper is broader than its current consumer, defensively
mapping every possible warning reason -- but a reader scanning the
helper in isolation would conclude `marketplace-failed` renders as
"not found" and `unmappable-marketplace-source` renders as
"unsupported source" on the user surface, which is contradicted by the
caller's A1-DROP filter.
**Fix:** Either (a) document the unreachability at the helper:

```ts
function importWarningReason(reason: ImportWarningOutcome["reason"]): Reason {
  // Only "unavailable" / "uninstallable" reach this helper at the
  // current callsite (buildImportNotificationMarketplaces filters
  // marketplace-failed and unmappable-marketplace-source via A1 DROP
  // before invocation). The other arms are defensive; if a future
  // caller drops the pre-filter, this mapping defines the V2 reason.
  switch (reason) {
    ...
  }
}
```

Or (b) narrow the parameter type to a 2-member literal union (matching
the actual reachable subset) and add an `assertNever` at the caller for
the dropped pair. (a) is the cheaper option.

### IN-03: Line-anchored citations across comments and tests are an ongoing maintenance pitfall

**File:**
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:52-63`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:644`
- `tests/orchestrators/import/execute.test.ts:435, 494, 500`
**Issue:** This phase's prior REVIEW.md WR-03 closed a stale-line-number
issue. Plan 20-05 reintroduced the same class of stale-line-number issue
(see WR-01 above) within the same plan run. The root cause is
non-architectural -- comments and test assertions cite line numbers in
sibling files, which any insert/delete above the citation breaks
silently. This is recurring across phases: WR-03 in 20-REVIEW v1 and
WR-01 in 20-REVIEW v2 are the same bug class.
**Fix:** No change required for this phase. Filed as a pattern
observation. A durable mitigation candidate: prefer function-anchored
citations (e.g. "in `executeScopedPlan`'s state-load try block") over
line-anchored citations (e.g. "execute.ts:518-528"); function names do
not drift on edits below the citation point. Optionally adopt a
lint-time check that asserts cited line numbers in comments resolve to
expected constructs (one-line awk verifier in `npm run check`). Not in
scope for Phase 20 closure.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
