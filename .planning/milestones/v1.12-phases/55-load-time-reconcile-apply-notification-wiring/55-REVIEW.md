---
phase: 55-load-time-reconcile-apply-notification-wiring
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/edge/index-handler.test.ts
  - tests/integration/load-reconcile-race-child.ts
  - tests/integration/load-reconcile-race.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 55: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 55 wires `applyReconcile` into the `resources_discover` handler with a
per-scope locked read pass (migrate -> load -> plan), an unlocked serial apply
pass, four orchestrators gaining `notifications: { mode: "orchestrated" }`,
and a single `reconcile-applied-cascade` notify per invocation. The
orchestrated-mode plumbing is clean (zero-notify suppression verified by
tests, standalone byte-identity guarded by regression tests), the reload-hint
exclusion and severity routing in `shared/notify.ts` are structurally sound,
and the two-process race harness is real (fork + IPC barrier).

However, the apply path has one critical convergence defect (config-key vs.
manifest-derived-name mismatch causes a destructive remove/re-add churn on
every reload, including a network clone per load), and several
contract-vs-implementation mismatches: documented outcome fields the apply
projection silently drops, a documented `{network unreachable}` catalog state
the production classifier can never produce, a hard-coded `"lock held"`
reason that mislabels arbitrary failures, missing per-scope failure isolation
in `applyReconcile`, and unsolicited file creation in every project directory
Pi is started in.

## Critical Issues

### CR-01: Config-key / manifest-name mismatch causes perpetual destructive remove+add churn (and a network clone) on every reload

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:224-257`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:123-168`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:522,617`
**Issue:** The planner diffs marketplaces by NAME: the `claude-plugins.json`
key vs. the `state.json` record key (`diffMarketplaces`, plan.ts:123-168).
But `addMarketplace` records the marketplace under the **manifest-derived**
name (`(parsed as { name: string }).name`, add.ts:522 github / 617 path) —
which the user cannot know in advance and which the config key does not have
to match. When a user hand-writes `"my-mp": { source: "acme/repo" }` and the
cloned manifest declares `name: "acme-marketplace"`, the system never
converges:

- Reload 1: plan adds `my-mp` -> `addMarketplace` clones and records
  `acme-marketplace`. The cascade reports `● my-mp [scope] (added)` (apply.ts
  uses `op.marketplace`, ignoring `result.name`) — a row for a record that
  does not exist.
- Reload 2+: `my-mp` is still declared-but-unrecorded (plan: add again,
  another network clone — NFR-5 violation amortized over every load), and
  `acme-marketplace` is recorded-but-undeclared (plan: REMOVE — tearing down
  the marketplace and uninstalling all its plugins via the cascade), then the
  add re-records it. Every single reload performs uninstall-all + remove +
  clone + add + reinstall, with a fresh notification each time.

This directly violates the phase invariants "back-to-back reconcile is a
byte-unchanged no-op with zero notify" and "only state-recorded entries
removed safely", and turns a benign config-key choice into destructive churn
of installed plugin artefacts plus unbounded network traffic at load. The
race test and apply tests never hit this because their fixtures always use a
config key equal to the manifest name (the RECON-03 test even comments on the
mismatch — "addMarketplace records it under the MANIFEST's name" — and then
papers over it with a permissive `||` assertion, see IN-05).
**Fix:** Detect and refuse the mismatch instead of looping. `addMarketplace`
already returns the derived name in orchestrated mode; in
`applyMarketplaceAdds` compare it to the declared key and surface a failure
(plus roll the add back or record under the declared key) so the next plan is
stable:

```ts
if (result.status === "added") {
  if (result.name !== op.marketplace) {
    // Declared key does not match the manifest's name: refusing prevents the
    // remove/re-add oscillation on the next reload.
    await removeMarketplace({ ...opts.base, name: result.name, scope: op.scope,
      notifications: { mode: "orchestrated" } });
    outcomes.push({
      kind: "mp-add-failed", scope: op.scope, marketplace: op.marketplace,
      reason: "source mismatch",
    });
  } else {
    outcomes.push({ kind: "mp-added", scope: op.scope, marketplace: result.name });
  }
}
```

Alternatively (cleaner long-term): make the planner key declared
marketplaces by their resolved/derived name, or validate at config-load time
that the key equals the manifest name for path sources. Add a regression test
where the config key differs from the manifest `name` and assert the second
`applyReconcile` is a no-op.

## Warnings

### WR-01: `applyReconcile` has no per-scope failure isolation — a read-pass throw discards already-applied outcomes and skips the other scope

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:515-536`
**Issue:** `readPassForScope` is not wrapped in try/catch inside the scope
loop. A throw from `withStateGuard` (corrupt/unparseable `state.json`,
`StateLockHeldError` from a concurrent process, an EACCES on the lock file)
propagates out of `applyReconcile` entirely. Consequences: (1) if the
project scope already applied state mutations and accumulated outcomes, the
user-scope read-pass throw discards them — state changed with ZERO
notification, violating the single-notify contract; (2) the sibling scope is
never reconciled even though scope locks are independent; (3) the failure
surfaces only as the raw `reconcile aborted: <message>` last-ditch string in
`index.ts` instead of a structured `(failed)` row. The
`InvalidBlockOutcome` docstring (apply-outcomes.ts:146) even documents an
`"unparseable"` state-json arm, and `ScopeReadResult.invalidOutcomes` is
documented as carrying "CFG-03 + state-load failure rows" — but no code path
ever constructs a state-load failure outcome; the documented arm is dead.
**Fix:** Wrap the per-scope read pass:

```ts
let readResult: ScopeReadResult;
try {
  readResult = await readPassForScope(scope, opts.cwd);
} catch (err) {
  outcomes.push({
    kind: "invalid-block",
    scope,
    marketplace: "state.json",
    reason: narrowProbeError(err), // "unparseable" for corrupt JSON, etc.
  });
  continue; // other scope still reconciles; accumulated outcomes still notify
}
```

(Consider whether `StateLockHeldError` should instead be a silent skip — the
sibling process is reconciling the same scope — but it must not abort the
other scope or eat accumulated outcomes.)

### WR-02: Apply projection drops the `unstaged` plugin rows on marketplace removal — plugins disappear silently

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:198-199`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:78-92`
**Issue:** `RemoveMarketplaceOutcome`'s docstring states: "The success arm
carries the names of the plugin rows the cascade successfully unstaged so
the apply renderer can compose the per-row `(uninstalled)` plugin lines."
`applyMarketplaceRemoves` ignores `result.unstaged` entirely and pushes a
bare `{ kind: "mp-removed" }`. Because the planner deliberately excludes
plugins under a to-be-removed marketplace from `pluginsToUninstall`
(plan.ts `buildUninstallBucket`, "double-bill" comment), those plugins are
unstaged by the remove cascade and reported NOWHERE: the user sees
`● mp (removed)` with no `(uninstalled)` children. This breaks the D-22-02
user contract ("one indented `(uninstalled)` row per unstaged plugin") that
the catalog's `marketplace remove` states lock, and the catalog's
reconcile-applied section claims "the rendered bytes match each token's
standalone-command counterpart." Pi-visible resources are removed without
any per-plugin notification. The partial-failure arm similarly collapses
`successfullyUnstaged` + per-plugin failures into one marketplace-level
reason (remove.ts:256-265), losing the per-plugin attribution standalone
mode renders.
**Fix:** In `applyMarketplaceRemoves`, fold `result.unstaged` into the
outcome stream:

```ts
if (result.status === "removed") {
  for (const plugin of result.unstaged) {
    outcomes.push({ kind: "plugin-uninstalled", scope: op.scope,
      marketplace: op.marketplace, plugin });
  }
  outcomes.push({ kind: "mp-removed", scope: op.scope, marketplace: op.marketplace });
}
```

(`applyOutcomeToBlock` already renders `plugin-uninstalled` children under a
`removed` header correctly.)

### WR-03: Network clone failure renders `{unparseable}`; the catalog documents `{network unreachable}` for exactly this state

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:336-360`, `docs/output-catalog.md:1308-1321`, `tests/architecture/catalog-uat.test.ts:2445-2455`
**Issue:** The catalog's `soft-fail-mixed` state — the flagship NFR-5
per-entry network soft-fail — documents
`⊘ flaky-mp [user] (failed) {network unreachable}`. Production cannot emit
that reason from the apply path: a clone network error (ENETUNREACH,
ECONNREFUSED, DNS failure) is not an enumerated precondition, so
`classifyAddError` returns `undefined` and `handleAddFailure`'s orchestrated
arm hard-codes `reason: "unparseable"`. The justifying comment — "an
unrecognised throw is by construction an opaque source-tree shape, NOT a
network reachability problem (the github guard's clone-catch already
classifies those)" — is false: the clone-catch (add.ts:508-513) only does
`cleanupStaging` + `appendLeakToError` and rethrows unclassified. The
catalog UAT does not catch this because its fixture hand-constructs
`reasons: ["network unreachable"]`, and `apply.test.ts`'s RECON-03 test
injects an ENETUNREACH error but only asserts `(failed)` is present, never
the reason token. Net effect: the documented user contract for the load-time
network soft-fail is unreachable, and the user sees `{unparseable}` — which
falsely implies a corrupted manifest — when their network is down.
**Fix:** Classify network errno codes before falling back:

```ts
// in classifyAddError, after the ENOENT/ENOTDIR branch:
if (code === "ENETUNREACH" || code === "ECONNREFUSED" || code === "ENOTFOUND"
    || code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EAI_AGAIN") {
  return "network unreachable";
}
```

Then tighten the RECON-03 apply test to assert
`emitted.includes("{network unreachable}")`.

### WR-04: Orchestrated `setPluginEnabled` labels every transaction throw `"lock held"`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:393-402`
**Issue:** The catch around `withLockedStateTransaction` returns
`{ status: "failed", reason: "lock held", ... }` for ANY throw in orchestrated
mode. The transaction body also runs `loadConfig`, `writeConfigEntry` /
`saveConfig`, and `tx.save()` — an EACCES on the config write, a disk-full
on state save, or any unexpected error is reported to the reconcile cascade
as `⊘ <plugin> (failed) {lock held}`, telling the user to wait out a lock
that was never held. The standalone arm of the same catch correctly renders
empty reasons + the cause-chain trailer; only the orchestrated arm lies.
**Fix:** Narrow on the actual error type:

```ts
const reason: Reason = cause instanceof StateLockHeldError
  ? "lock held"
  : narrowDisableFailure(cause)[0] ?? "unreadable";
return { status: "failed", reason, error: cause, cause: errorMessage(cause) };
```

### WR-05: Every Pi startup now writes `.pi/claude-plugins.json` + `.pi/pi-claude-marketplace/state.json` into every project directory

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:99-146`, `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:66-76,112`, `extensions/pi-claude-marketplace/persistence/migrate-config.ts:142-165`
**Issue:** `readPassForScope` runs unconditionally for the project scope on
every `resources_discover` (i.e., every Pi startup/reload in any directory).
`withStateGuard` does `mkdir(extensionRoot, { recursive: true })`, takes a
lock, and unconditionally calls `saveState` on closure return; and
`migrateFirstRunConfig` writes a fresh `claude-plugins.json` whenever the
config is absent — with no entry-count gate, so even an empty state produces
a generated config file. Net effect for a user who has never used the
extension in a repo: starting Pi there creates
`<cwd>/.pi/pi-claude-marketplace/state.json` and `<cwd>/.pi/claude-plugins.json`
in that repo (dirtying `git status` in every project they open), and for
configured scopes `state.json` is needlessly rewritten on EVERY load (the
read pass mutates nothing in the no-op case), which both amplifies writes
and widens the cross-process lock window that forces the race-loser error
notification. Pre-Phase-55 the handler was read-only. The
index-handler "clean reconcile" test asserts zero notify but never asserts
zero file creation, so nothing pins this down.
**Fix:** Gate the read pass on prior usage before taking the lock:

```ts
// in readPassForScope, before withStateGuard:
const stateExists = await pathExists(loc.stateJsonPath);
const configExists = await pathExists(loc.configJsonPath)
  || await pathExists(loc.configLocalJsonPath);
if (!stateExists && !configExists) {
  return { scope, plan: undefined, invalidOutcomes: [] }; // pristine scope: no-op
}
```

Additionally consider switching the read pass to
`withLockedStateTransaction` and saving only when `migrateFirstRunConfig`
actually migrated, so a no-op load leaves `state.json` bytes AND mtime
untouched (matching the spirit of the RECON-05 invariant the tests assert
for the config file).

### WR-06: Uninstall silent-converge is reported as `(uninstalled)` by the apply cascade — contradicting the documented contract

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:400-413`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:280-287`
**Issue:** uninstall.ts's comment states: "In orchestrated mode the silent
converge surfaces as an `uninstalled` outcome with no version -- apply (Plan
02) treats both the standalone-silence path and the converge path
identically (no row to emit)." The implementation does the opposite:
`applyPluginUninstalls` pushes a `plugin-uninstalled` outcome for ANY
`status: "uninstalled"` result, and the converge arm is indistinguishable
from a real uninstall (absent `version` is not a reliable discriminator).
A reconcile racing another process therefore renders `○ <plugin>
(uninstalled)` for work it did not perform — the PU-5 "literal silence"
contract (PRD §5.2.2) is violated on the reconcile surface, and two
simultaneously starting Pi processes can BOTH notify the same uninstall.
**Fix:** Make the converge explicit in the outcome union so apply can drop
it:

```ts
// uninstall.ts
if (alreadyGone) {
  if (orchestrated) return { status: "converged", name: plugin };
  return undefined;
}
// apply.ts
if (result.status === "converged") continue;
```

### WR-07: Import records a failed marketplace add as `(added)` and double-notifies

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:548-562`
**Issue:** `executeScopedPlan` calls `addMarketplace` WITHOUT
`notifications: { mode: "orchestrated" }` and ignores the (now-typed) return
value. In standalone mode a classified precondition failure (duplicate name,
stale clone, invalid manifest, unsupported source, source missing) does NOT
throw — `handleAddFailure` fires its own standalone `(failed)` notify and
returns `undefined`. The import loop's catch never sees it, so it
unconditionally pushes `result.addedMarketplaces` — the final import cascade
renders `● <mp> (added)` for a marketplace that was never recorded, dependent
plugin installs are not blocked (`blockedMarketplaces` never gains the
entry) and each then fails with a misleading reason, AND the standalone
failure notify breaks import's one-cascade-per-command discipline (two
`ctx.ui.notify` calls). Phase 55 widened the dep signature to
`Promise<AddMarketplaceOutcome | undefined>` (commit 34b505d) without
consuming the outcome, leaving the defect in place with the fix one line
away.
**Fix:** Run the import's adds in orchestrated mode and dispatch:

```ts
const outcome = await addMarketplace({ ...opts, notifications: { mode: "orchestrated" } });
if (outcome?.status === "added") {
  result.addedMarketplaces.push({ ... marketplace: outcome.name ... });
} else {
  blockedMarketplaces.add(marketplace.marketplace);
  result.marketplaceFailures.push({ ..., cause: outcome?.cause ?? "unknown" });
  for (const plugin of pluginsForMarketplace(...)) {
    pushPluginWarning(result, plugin, "marketplace-failed", outcome?.cause);
  }
}
```

### WR-08: The "NFR-2 boundary preservation" handler test is vacuous — the catch path it names is never executed

**File:** `tests/edge/index-handler.test.ts:138-169`
**Issue:** The test claims to prove "catastrophic applyReconcile throw is
caught and the handler still returns a ResourcesDiscoverResult," but it
drives a CLEAN reconcile against an empty scope: `applyReconcile` is silent
(zero notify calls), so the throwing `ui.notify` stub is never invoked,
`applyReconcile` never throws, and neither the outer catch nor the
last-ditch notify in `index.ts:33-47` executes. The long comment
acknowledges the indirection but the result is that the NFR-2 catch arm —
the single most important safety property of this phase's `index.ts` change
— has zero test coverage. A regression that removes the try/catch would pass
this suite.
**Fix:** Drive a real throw — e.g., seed an unreadable/corrupt
`state.json` (mode 000 dir or invalid JSON that makes `loadState` throw) so
`applyReconcile` propagates, then assert (a) the handler still resolves with
a `ResourcesDiscoverResult` and (b) `ctx.ui.notify` was called once with a
message starting `reconcile aborted:` at `"error"` severity (use a
non-throwing ctx for that half; keep the throwing-ctx variant as a second
case).

### WR-09: Reconcile-driven enable/disable writes the `enabled` flag back into the BASE config — clobbering it when the desired state came from the local override file

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:355-455`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:343-344,381-391`
**Issue:** The planner derives `pluginsToEnable` / `pluginsToDisable` from
the MERGED config (`claude-plugins.json` + `claude-plugins.local.json`).
`applyPluginEnables`/`applyPluginDisables` drive `setPluginEnabled` without
`local`, so `targetConfigPath` is always the base `claude-plugins.json`, and
the `fresh` arm unconditionally calls `writeConfigEntry` + `saveConfig`
against it. When the disable declaration lives only in the LOCAL file (the
per-machine override that is the whole point of Pitfall 54-5), the load-time
reconcile copies `enabled: false` into the shared base file; worse, if the
base explicitly declares `enabled: true` and local overrides it to `false`,
the reconcile OVERWRITES the user's authored base declaration. The config is
the reconcile's INPUT — the apply pass should not rewrite the declaration it
just read. (The RECON-05 byte-stability test only covers an empty plan, so
this mutation is untested.)
**Fix:** Skip the config write-back when the call is orchestrated (the
declaration already exists by construction):

```ts
if (outcome.kind === "fresh" && !orchestrated) {
  await writeConfigEntry(current, targetConfigPath, locations.scopeRoot,
    plugin, marketplace, enable);
}
await tx.save();
```

Add a test: base `enabled: true`, local `enabled: false`, run
`applyReconcile`, assert the base file bytes are unchanged.

## Info

### IN-01: Last-ditch handler message renders `undefined` for non-Error throws

**File:** `extensions/pi-claude-marketplace/index.ts:42`
**Issue:** `(err as Error).message` yields `undefined` when a non-Error value
is thrown, producing `reconcile aborted: undefined`.
**Fix:** Use the existing `errorMessage(err)` helper from `shared/errors.ts`.

### IN-02: `pi.on.bind(pi) as unknown as (...)` double cast defeats type checking of the handler signature

**File:** `extensions/pi-claude-marketplace/index.ts:18-24`
**Issue:** The `as unknown as` cast means a drift in pi-coding-agent's
`resources_discover` handler signature (event shape, ctx param, return type)
compiles silently. The test asserting `handler.length === 2` partially
covers arity but not types.
**Fix:** If the upstream `on` overloads cannot express this event yet, narrow
the cast to the single parameter that needs it and add a comment referencing
the upstream type to watch; revisit when the NFR-11 peer floor is pinned.

### IN-03: Enable/disable `skipped` outcomes — including the actionable `"not installed"` — are silently dropped by the apply loops

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:392-394,436-444`
**Issue:** The comment justifies dropping idempotent skips, but the
`{ status: "skipped", reason: "not installed" }` arm (plugin record vanished
between plan and apply) is also dropped — asymmetric with the uninstall
converge which IS reported (WR-06). Race-only, but the asymmetry should be a
deliberate, documented choice in one direction.
**Fix:** Either drop both converge surfaces (preferred, matches PU-5) or
report both; document the choice at both sites.

### IN-04: `StateLockHeldError` from driven orchestrators classifies as `{unreadable}` though `REASONS` has `"lock held"`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:148-151`, `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:37-66`
**Issue:** `classifyOrchestratorThrow` delegates to `narrowProbeError`, which
has no lock-held arm; a concurrent-process lock conflict during the unlocked
apply loop renders `{unreadable}`.
**Fix:** Check `err instanceof StateLockHeldError` before delegating and
return `"lock held"`.

### IN-05: RECON-03 sibling-success assertion is a disjunction that cannot meaningfully fail

**File:** `tests/orchestrators/reconcile/apply.test.ts:256-261`
**Issue:** `emitted.includes("(added)") || emitted.includes("ok-mp") ||
emitted.includes("valid-marketplace")` passes even if the sibling add failed
(the failed `ok-mp` row alone satisfies the second arm). The
loop-continuation property is only really proven by the `cloneCalls >= 2`
check above it.
**Fix:** Assert the strong form: `emitted.includes("● ok-mp [project] (added)")`
(and fix the name semantics per CR-01 first).

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
