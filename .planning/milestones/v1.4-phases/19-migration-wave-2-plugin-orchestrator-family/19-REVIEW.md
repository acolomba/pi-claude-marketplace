---
phase: 19-migration-wave-2-plugin-orchestrator-family
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - eslint.config.js
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/register.test.ts
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 19 Wave 2 migrates the plugin orchestrator family (uninstall, install, list,
reinstall, update) from the V1 severity-named `notify{Success,Warning,Error}` wrappers
plus presentation/* composers onto the V2 structural-payload `notify(ctx, pi, message)`
chokepoint. The migration is generally clean: every per-orchestration arm now emits
exactly one V2 notification with closed-set `Reason` narrowing at producer sites, and
the per-D-19-01 standalone-mode "post-state-commit warning" surfaces are uniformly
dropped while the underlying side-effects (cache invalidation, rm-rf, mkdir) still run
inside try/catch.

One **BLOCKER** stands out: in `update.ts`, the phase-3a aggregate-failure path inside
`runThreePhaseUpdate` fires `notifyDirectFailure` and **then returns the outcome to
`updatePlugins`**, which proceeds to push the outcome onto `outcomes[]` and call
`renderUpdateCascadeAndNotify` -- producing **two** notifications for a single
phase-3a aggregate failure. The inline code comment at update.ts:844-846 asserts that
"the cascade is NOT re-rendered here -- aborting before the cascade walk means there's
exactly one row to surface," but there is no `return` from `updatePlugins` after this
path. The existing PUP-6 phase-3 test (update.test.ts:734-790) joins all notifications
before regex-matching, so it does not catch the duplicate emission.

Five WARNINGs cover: (a) the byMp grouping in `renderUpdateCascadeAndNotify` uses a
nullish-coalesce + presence-check pattern that is correct but obscures the intent
and is easy to break in a future refactor; (b) the orphan-fold rule in `list.ts`
re-enumerates `available`/`unavailable` rows from the project-scope cloned record under
the user-scope block, which can produce duplicate `(available)` rows for plugins that
are not installed in either scope but appear in the shared manifest; (c) the list.ts
orchestrator-level catch path synthesizes a marketplace named `"(list)"` and a plugin
named `"list"` for `narrowProbeError`-classified failures whose closed-set Reason is
inappropriate for non-resolver errors (e.g. state.json load failure); (d) the
`composeInstallFailureMessage` function declares `marketplace: string` in its args
type but never reads it; and (e) the update.ts:196-201 enumerate-targets failure
arm defaults `scope` to `"project"` and uses `targetMarketplaceName(target)` which
returns the literal string `"(targets)"` for the bare form -- both stand-ins surface
to the user when state.json corrupts the bare-form enumeration.

Six INFO items cover dead `void` statements, dead conditional spreads on
always-non-empty version strings, an unused destructured marketplace identifier, and
non-exhaustive switch over `PluginShapeError.shape.kind` in update.ts's
`narrowDirectFailReason` (missing the `assertNever` precedent set elsewhere).

The ESLint scope-in for plugin orchestrator family (Wave 3) is correct: the MSG-Block 1
and 1b ignores now cover both `orchestrators/marketplace/**` and
`orchestrators/plugin/**`, while `orchestrators/import/**` (still V1) remains scoped in.

## Critical Issues

### CR-01: Phase-3a aggregate update failure emits two notifications

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:851-893`
**Issue:** When `runThreePhaseUpdate` aggregates a phase-3a (physical-replace) failure,
it calls `notifyDirectFailure(...)` inline at line 851-866 and then returns
`{ partition: "failed", ..., phaseFailures: ... }` to the caller. The caller
(`updatePlugins`, line 274-293) pushes this returned outcome onto `outcomes[]`
unconditionally and then invokes `renderUpdateCascadeAndNotify(ctx, pi, outcomes)`
at line 316, which fires a SECOND notification rendering the cascade body for the
same failure. The user sees the failure surface twice. The block-comment claim at
update.ts:844-846 -- "The cascade is NOT re-rendered here -- aborting before the
cascade walk means there's exactly one row to surface" -- is contradicted by the code;
no `return` from `updatePlugins` follows the phase-3a path. The PUP-6 phase-3 test
at update.test.ts:734-790 masks this by joining `notifications.map(n => n.message)`
into one string before regex-matching, so it neither counts notifications nor
asserts they are unique.

**Fix:** Choose one of the two emission sites and drop the other. The minimal,
contract-preserving fix is to return early from `updatePlugins` immediately after
`runThreePhaseUpdate` returns a `partition === "failed"` outcome whose phase-3a
aggregate path was responsible for `notifyDirectFailure`. The cleanest fix is to
delete the inline `notifyDirectFailure` block at update.ts:851-866 and let the
final `renderUpdateCascadeAndNotify(ctx, pi, outcomes)` emit the cascade once. This
also restores the symmetry with `outcomeToCascadePluginMessage` which already maps
the phase-3a-failed outcome to the `failed-with-rollback-partial` catalog form at
line 1009-1054 (including the structural `rollbackPartial[]` children). After the
fix, add an explicit `assert.equal(notifications.length, 1)` to the PUP-6 phase-3
test so a regression cannot reintroduce the duplicate.

```ts
// Delete update.ts:851-866 entirely. The cascade rendering at line 316
// already produces the user-visible failure surface via
// outcomeToCascadePluginMessage's "failed" arm (lines 1009-1054), which
// already populates rollbackPartial[] structurally from outcome.phaseFailures.

// If the inline emission is intentionally kept (e.g., because the cascade
// renderer cannot produce the exact catalog byte form), abort the batch
// the same way the phase-2-or-earlier catch arm does at line 310:
} else {
  // phase-3a aggregate already notified inline; abort.
  return;
}
```

## Warnings

### WR-01: `renderUpdateCascadeAndNotify` byMp grouping is correct but fragile

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1100-1112`
**Issue:** The grouping loop uses
```ts
const group = byMp.get(key) ?? { name: ..., scope: ..., plugins: [] };
group.plugins.push(...);
if (!byMp.has(key)) {
  byMp.set(key, group);
}
```
which is correct (the first iteration writes the new group into the map, subsequent
iterations get the same reference and mutate it via `push`), but the read-then-check
pattern is non-obvious. A future refactor that converts the conditional `byMp.set` into
an unconditional set (or rearranges to set-after-push) will silently break the in-place
mutation invariant on the second iteration only when the `??` fallback hit on the
first iteration -- a hard-to-test path. The reinstall.ts:597-610 group-builder uses a
clearer get-existing-or-construct-new shape that does not rely on the map-read
returning the same object across iterations.

**Fix:** Restructure to mirror the reinstall.ts pattern:
```ts
for (const { target, outcome } of outcomes) {
  const key = `${target.scope}:${target.marketplace}`;
  const existing = byMp.get(key);
  if (existing === undefined) {
    byMp.set(key, {
      name: target.marketplace,
      scope: target.scope,
      plugins: [outcomeToCascadePluginMessage(target, outcome)],
    });
  } else {
    existing.plugins.push(outcomeToCascadePluginMessage(target, outcome));
  }
}
```

### WR-02: `list.ts` orphan-fold duplicates available/unavailable rows from cloned project record

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:635-660`
**Issue:** When a project-scope marketplace record is a clone of a user-scope
record (same `marketplaceRoot`), `loadPluginListPayload` folds the project-scope
plugin rows under the user-scope block. The fold calls
`enumerateMarketplacePlugins(opts, projectMp, "project", "user", manifest)` which
returns **all four bucket variants** (installed, upgradable, available, unavailable)
from the project side. The subsequent `foldedNames` set at line 646-650 only
captures `installed`/`upgradable` rows for exclusion from the user-side's available
bucket -- `available` and `unavailable` rows from the project-side enumeration are
appended verbatim to the user-scope block via `extraPlugins`. Because both scopes
read the SAME manifest (cloned `marketplaceRoot`), every manifest-listed plugin that
is not installed in either scope produces two `(available)` rows under the user-scope
header (one from the project-side enumeration, one from the user-side's own
enumeration). The same duplication exists for `(unavailable)`.

**Fix:** Filter `folded` to keep only the rows that actually reflect orphan installs:
```ts
folded = (await enumerateMarketplacePlugins(opts, projectMp, "project", "user", manifest))
  .filter((r) => r.status === "installed" || r.status === "upgradable");
foldedNames = new Set(folded.map((r) => r.name));
```
This preserves the documented "fold installed records from the other scope" semantic
and eliminates the duplicate available/unavailable enumeration. Add an integration
test under `tests/integration/fold-adoption.test.ts` (which the comment at
list.test.ts:16-17 already cites) that seeds a clone with an installed plugin AND
an additional manifest-only plugin, then asserts the merged block contains exactly
one row for each manifest entry.

### WR-03: `list.ts` aggregate-failure catch synthesises a misleading marketplace+plugin identity

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:782-805`
**Issue:** The orchestrator-level catch path constructs a `PluginFailedMessage` with
`name: "list"` under a `MarketplaceNotificationMessage` with `name: "(list)"`. The
synthesized marketplace name `"(list)"` would render in the catalog grammar as
`● (list) [user]` (or `[project]`), which is operator-confusing -- it looks like a
real marketplace called "(list)" with parens. The Reason chosen via
`narrowProbeError(err)` is also inappropriate for orchestrator-level failures:
`narrowProbeError` falls through to `"unreadable"` for any non-ENOENT/EACCES/SyntaxError,
which would surface a `loadState` permission error or a state.json schema validation
error as `{unreadable}` -- a Reason that semantically describes a resolver probe
failure, not a list orchestration failure. The catch path has no test coverage
(no test in list.test.ts drives `loadPluginListPayload` into throwing).

**Fix:** Either (a) extract a dedicated `narrowListFailReason(err): Reason` mirroring
update.ts's `narrowDirectFailReason` precedent (errno-first, then message
substring), or (b) document the catalog choice and add an exact-byte test asserting
the produced shape (so a future change cannot drift unnoticed). Prefer (a) plus a
test. Also rename the synthetic marketplace to something less ambiguous (e.g.
emit `marketplaces: []` and let the renderer's `(no marketplaces)` sentinel carry
the failure trailer via a separate channel -- though the current
`MarketplaceNotificationMessage` shape does not support that, so the cleanest near-term
fix is the dedicated narrower + test).

### WR-04: `composeInstallFailureMessage` declares but does not consume `marketplace`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:976-1061`
**Issue:** The function signature declares `marketplace: string` in its `args` shape
at line 980, but the destructuring at line 986 omits it and the function body never
references `args.marketplace`. The caller at line 727-736 passes a real marketplace
name, but it is silently dropped. This is dead data flow: a future change that
expects the marketplace name to participate in the failure message (e.g., to
disambiguate a same-named plugin across marketplaces in a cause-chain trailer) will
add a reference and silently use stale data -- there is no compile-time gate.

**Fix:** Remove `marketplace: string` from the args type:
```ts
function composeInstallFailureMessage(args: {
  err: unknown;
  plugin: string;
  // marketplace removed -- never read
  scope: Scope;
  version: string | undefined;
  rolledBackPartial: boolean;
  rollbackPartials: readonly RollbackPartial[];
  entityErrorRow: EntityErrorRow | undefined;
}): PluginNotificationMessage {
```
And update the call site at line 727-736 to stop passing `marketplace`. If the
intent was to thread the marketplace into a future cause-chain composition, leave
a TODO + an `// eslint-disable-next-line @typescript-eslint/no-unused-vars` instead
of silently dropping it.

### WR-05: `updatePlugins` enumerate-failure arm defaults scope+pluginName to wrong stand-ins

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:182-201`
**Issue:** When `enumerateTargets` throws, the catch arm fires `notifyDirectFailure`
with `scope: explicitScope ?? "project"` and `pluginName: targetMarketplaceName(target)`.
The comment at line 193-198 claims the bare form's enumeration cannot throw, but
that is false in practice: `enumerateTargets` for the bare form (lines 1404-1415)
calls `loadState` for both scopes inside a for-loop and propagates any I/O error or
state.json schema validation throw. When the bare form throws, `target.kind === "all"`
and `targetMarketplaceName` returns the literal string `"(targets)"`, which would
render as the user-visible identity of both the marketplace header and the failed
plugin row. Additionally, hardcoding `scope: "project"` as the default may not match
the scope whose state.json actually failed to load.

**Fix:** Either guard the bare form with its own try/catch and surface a marketplace-
level failure (no per-plugin row), or use `marketplaces: []` (the `(no marketplaces)`
sentinel) when `target.kind === "all"` to avoid the misleading `(targets)` identity.
The current behavior is non-blocking for the typical mis-scoped case (the test at
update.test.ts:866-905 covers the marketplace-not-found path which uses a real name)
but degrades the operator-readable surface for the rarer bare-form-with-IO-error
case.

## Info

### IN-01: Dead `void` statements in reinstall.ts

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:233-234`
**Issue:** The lines `void locked.bridgeWarnings;` and `void maintenanceWarnings;`
are intentional no-ops that document the V1->V2 warning-surface drop per D-19-01.
The pattern is correct but adds two lines of executable code where a comment
would suffice. The variables `locked.bridgeWarnings` (already read at line 220 in
the `render === "none"` orchestrated-mode arm) and `maintenanceWarnings` (already
awaited at line 218 for side effects) do not need to be referenced again.

**Fix:** Replace with an inline comment:
```ts
// D-19-01: bridgeWarnings + maintenanceWarnings are intentionally NOT
// surfaced in V2 standalone mode; orchestrated mode collects them via
// the notes field at the render === "none" arm above.
```

### IN-02: Dead conditional spreads on always-non-empty version

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:914`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:251`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:301`
**Issue:** The pattern `...(version !== "" && { version })` is defensive against
empty-string versions, but `resolvePluginVersion` (orchestrators/plugin/shared.ts:167)
always returns a non-empty string (either `entry.version` of length > 0 or the
12-hex hash via `computeHashVersion`). State records persisted by previous
install/update paths also carry non-empty versions by construction. The conditional
spread is therefore always true.

**Fix:** Drop the guard:
```ts
const installedRow: PluginInstalledMessage = {
  status: "installed",
  name: plugin,
  dependencies,
  version: installCtx.version,
  scope,
};
```
If the defensive guard is intentional (e.g., to protect against a future legacy
state.json that records an empty version), add a binding test that constructs such
a record and asserts the row omits the `v<version>` token.

### IN-03: Non-exhaustive switch in `narrowDirectFailReason`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1244-1252`
**Issue:** The `switch (err.shape.kind)` enumerates 4 cases but lacks a `default`
arm with `assertNever(err.shape)`. install.ts:1119-1156 and reinstall.ts:864-880
both use the same `PluginShapeError.shape.kind` discriminator but install.ts uses
`assertNever(err.shape)` for compile-time exhaustiveness. A future 5th kind added
to `PluginShapeError` would silently fall through to the errno-substring branch
here and surface as a generic `unreadable manifest` Reason, masking a class of
errors that should have a precise mapping.

**Fix:** Add the `assertNever` default arm to mirror install.ts:1155:
```ts
switch (err.shape.kind) {
  case "no-longer-installable":
  case "not-installable":
    return "no longer installable";
  case "not-in-manifest":
  case "already-installed":
    return "not in manifest";
  default:
    return assertNever(err.shape);
}
```
But note that `narrowDirectFailReason` returns `Reason` (a closed string union),
so `assertNever` would need to wrap a `throw` rather than return -- adjust the
return type or restructure. The simpler fix is to rely on `PluginShapeError`'s
existing exhaustive shape and add the `default: assertNever(...)` after the switch.

### IN-04: `installedRow.scope` always set when same as marketplace scope

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915`
**Issue:** Line 915 sets `scope` on every `installedRow`, even when the per-row
scope matches the marketplace block's scope (always true for the single-plugin
install surface). The renderer's `renderScopeBracket` (shared/notify.ts:719)
correctly suppresses the bracket when `pluginScope === mpScope`, so the byte output
is identical to setting `scope: undefined`. This is correct behavior, but it diverges
stylistically from uninstall.ts:298-302 (which omits `scope` on the uninstalledRow)
and reinstall.ts:247-252 (which omits `scope` on the reinstalledRow via
`rowScope === undefined`). Pick one convention across the family to reduce future
divergence.

**Fix:** Either remove `scope` from `installedRow` (since the orphan-fold rule
guarantees suppression on the single-plugin install surface) or add `scope` to
the uninstalledRow / reinstalledRow for symmetry. The former is the canonical
"only emit fields that affect the byte output" form.

### IN-05: `uninstall.ts:174-178` marketplace-absent branch may be unreachable in practice

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:172-178`
**Issue:** Inside `withStateGuard`, the closure checks `if (mp === undefined)` for
the case where the marketplace record itself is absent. But by construction, the
prior `resolveInstalledPluginTarget` call at line 152-160 already verified the
marketplace's existence (when no `explicitScope` is set, it returns `undefined`
on missing record; when `explicitScope` IS set, it skips state lookup entirely).
When explicit scope is set and state is empty, the closure's `loadState` returns
empty state and `mp === undefined` IS reachable -- exercised by PU-5 marketplace-
absent at uninstall.test.ts:489. So the branch is reachable, but only via the
explicit-scope path.

**Fix:** Add a comment clarifying the reachability:
```ts
// Reached only via explicit-scope path: resolveInstalledPluginTarget
// short-circuits to `{ scope: opts.scope, locations: ... }` without
// reading state, so the closure's loadState may find an empty record.
if (mp === undefined) {
  alreadyGone = true;
  return;
}
```

### IN-06: ESLint plugin-orchestrator ignore widens the MSG-Block 1 dead-zone

**File:** `eslint.config.js:159-196`
**Issue:** MSG-Block 1 (`msg-sr-1..6`) and MSG-Block 1b (`msg-gr-3-per-scope`)
both have `ignores: [orchestrators/marketplace/**, orchestrators/plugin/**]`.
This is correct for the V2-migrated subtrees (the V1 routing rules check for
notifyError/Warning/Success usage which is GONE post-migration), but the ignore
is over-broad: it also exempts the per-scope iteration rule (MSG-GR-3), which
still applies even when the V1 wrappers are gone. A future contributor adding
a new helper to `orchestrators/plugin/shared.ts` would not get a lint warning for
constructing `["user", "project"]` instead of the canonical project-before-user
order, even though the rule's intent (project-first iteration discipline) is
language-independent of the V1 wrappers.

**Fix:** Split the two blocks: keep `orchestrators/plugin/**` ignored for MSG-Block 1
(the routing rules) but re-enable MSG-Block 1b for the migrated subtree. The block
already separates the file globs (lines 184-191) -- drop
`orchestrators/plugin/**` from the MSG-Block 1b `ignores` array.

```js
{
  // MSG-Block 1b (MSG-GR-3): per-scope rendering rule -- still applies to
  // V2-migrated subtrees because the project-first iteration discipline is
  // independent of the notify() wrapper migration.
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  ignores: [
    "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
    // plugin/** intentionally NOT ignored; MSG-GR-3 still applies post-migration
  ],
  plugins: { msg: msgPlugin },
  rules: { "msg/msg-gr-3-per-scope": "error" },
},
```

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
