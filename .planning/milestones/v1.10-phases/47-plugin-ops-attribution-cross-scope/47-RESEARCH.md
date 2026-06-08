# Phase 47: Plugin-Ops Attribution & Cross-Scope - Research

**Researched:** 2026-06-07
**Domain:** TypeScript discriminated-union message attribution; orchestrator error-routing; cross-scope state resolution
**Confidence:** HIGH (this is an internal-correctness refactor; every claim verified against live code, the Phase 46 type model, and the byte catalog)

## Summary

Phase 47 makes the four plugin ops (`install`, `uninstall`, `reinstall`, `update`) converge on the `info` model for the **marketplace-existence / scope** precondition. The Phase 46 foundation already shipped the load-bearing primitive: the top-level `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`, fields `name` + optional `scope`), its renderer `renderMarketplaceNotAdded`, and routing through the single `isInfoKind` guard with `error` severity / no reload-hint / no summary line. `info` already emits it as a **standalone top-level message** (`notify(ctx, pi, message)` where `message` IS the variant -- NOT wrapped in `{ marketplaces: [...] }`). Phase 47 reuses that exact variant at every plugin-op marketplace-absent / scope-mismatch site, splits "marketplace absent" from "plugin absent from a present manifest" (the latter stays `{not in manifest}`), replaces the lying cascade/cleanup fallbacks, routes raw throws through `notify`, and teaches the shared scope-resolution chokepoint to consult the other scope.

The single biggest design decision (target #4 -- cascade emission model) resolves cleanly in favor of **standalone top-level `MarketplaceNotAddedMessage` emission, matching `info` exactly**. The marketplace-absent / wrong-scope precondition is checked BEFORE any per-plugin cascade work begins (it is a property of the marketplace, not of any plugin row), so there is no cascade to embed it into. The Phase 46 variant is structurally a top-level `NotificationMessage` arm that is NOT a member of the cascade's `plugins[]` array (which only accepts `PluginNotificationMessage`), so embedding it as a row is not even type-representable without re-cutting the type model -- which the milestone forbids. `info`'s precedent is the model and the milestone theme is "converge on info."

**Primary recommendation:** At each plugin-op entrypoint, hoist the marketplace-existence/scope check to a preflight that -- on miss -- emits one standalone `notify(ctx, pi, { kind: "marketplace-not-added", name: marketplace, ...(explicitScope && { scope }) })` and returns. Reserve `{not in manifest}` strictly for plugin-absent-from-a-present-manifest. Replace `narrowCascadeFailure`/`narrowReason` `not-in-manifest` defaults with truthful existing-reason mappings. Make `shared.ts` cross-scope-aware so a target present only in the other scope is reported.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Canonical reason:** reuse the existing `not added` REASONS member (no new `marketplace not added` member). `not added` is the structural marker reachable ONLY via `MarketplaceNotAddedMessage` (it is NOT a `ContentReason`).
- The `(failed) {not added}` marketplace-subject form is the canonical target `info` already models (Phase 46 made it the only representable shape for the condition).
- **Atomic-supersession:** any catalog/UAT/type/fixture changes that change shape land together with the behavior change in one GREEN commit (no intermediate RED); `npm run check` exits 0.

### Claude's Discretion (planner MUST resolve these three explicitly)
1. **Cascade emission model** (the Phase 46-flagged open question) -- standalone TOP-LEVEL message vs. embedded cascade row. (This research recommends **standalone**; see Decision D-47-A below.)
2. **Reason vocabulary for cascade/cleanup failures** (ATTR-09) -- reuse existing `REASONS` members; no new members unless strictly required. (This research maps every blocker to an existing member; **no new member required**; see Decision D-47-B.)
3. **Cross-scope resolution shape** (SCOPE-01) at `orchestrators/plugin/shared.ts` -- how the chokepoint consults the other scope and renders "present in other scope," preserving the CMP-3 project→user install fallback. (See Decision D-47-C.)

### Deferred Ideas (OUT OF SCOPE -- Phase 48 / 49)
- Marketplace-op attribution (`autoupdate`/`noautoupdate`/`remove`/`add` raw throws; path-source manifest failure lying `{network unreachable}`) -- **Phase 48**.
- Cross-op convergence proof + GREEN-gate close -- **Phase 49**.
- Audit B-4/B-5/B-6/B-8 (med/lo type foot-guns) -- out of scope for v1.10.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATTR-01 | `install <plugin>@<mp>` missing marketplace → `{not added}` on the marketplace subject, not `{not in manifest}` on the plugin row | Site M1 (install.ts:339-341) -- split the `source === undefined` branch from the `entryRaw === undefined` branch (Site M2). Standalone `MarketplaceNotAddedMessage` emission. |
| ATTR-02 | `update` (`<plugin>@<mp>` and `@<mp>`) missing marketplace → structured `(failed) {not added}`; no `{not found}` misattrib, no raw throw past the orchestrator | Sites M9, M10, M11 -- `enumerateMarketplaceTarget` raw `Error` throw (update.ts:1754-1756); `resolveInstalledMarketplaceTarget` raw `MarketplaceNotFoundError` (shared.ts:164); `preflightUpdate` mp-absent → `{not in manifest}` skip (update.ts:555-570). |
| ATTR-03 | `reinstall` missing marketplace → `{not added}` consistently across explicit-scope and bare forms (not `{not installed}`/`{not found}` by form) | Sites M6, M7, M8 -- `runLockedReinstall` mp-undefined → `(skipped) {not installed}` (reinstall.ts:876-881); `enumerateMarketplaceReinstallTargets` explicit-scope synthesizes a target / bare throws raw (reinstall.ts:480-490). |
| ATTR-04 | `uninstall` of a never-added marketplace reports `{not added}`, distinct from the silent converge for an already-gone plugin record | Sites M3, M4 -- `resolveInstalledPluginTarget` returns `undefined` → silent (uninstall.ts:151-153); guard `mp === undefined` → `alreadyGone` silent (uninstall.ts:171-186). |
| ATTR-08 | `install` distinguishes "marketplace absent" (`{not added}`) from "plugin absent from present manifest" (`{not in manifest}`) | Sites M1 vs M2 -- two different branches in install.ts already exist (339 vs 369); only M1 needs re-attribution; M2 stays. |
| ATTR-09 | cleanup/cascade failures (foreign content, IO) during uninstall/reinstall surface a truthful reason instead of degrading to `{not in manifest}` | Sites M5, M12 -- `narrowCascadeFailure` `AgentsUnstageFailureError` + default → `not in manifest` (uninstall.ts:96-117); `narrowReason` fallback → `not in manifest` (reinstall.ts:768-807). |
| SCOPE-01 | target absent in requested explicit scope but present in the other scope → report it exists in the other scope (install/uninstall/reinstall/update) | Site M13 -- `shared.ts` resolvers short-circuit on `explicitScope` WITHOUT consulting the other scope (lines 104-109, 132-137). CMP-3 fallback (resolveInstallMarketplaceSource:70-77) must be preserved. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Marketplace-existence precondition check | Orchestrator (plugin/*.ts entrypoint) | shared.ts (cross-scope resolution) | The precondition is a property of state, not of a bridge; it must fail before any bridge/cascade work. |
| Scope resolution (explicit vs. fallback) | shared.ts chokepoint | persistence/state-io (loadState) | SCOPE-01 lands here; CMP-3/CMP-5 already live here. |
| Marketplace-not-added rendering | shared/notify.ts (`renderMarketplaceNotAdded`) | -- | Single renderer; Phase 46 deliverable; byte-locked. |
| Cascade/cleanup reason classification | Orchestrator narrowing helpers (`narrowCascadeFailure`/`narrowReason`/`reasonsFromTypedError`) | shared/notify.ts REASONS (closed set) | The truthful-reason mapping is per-op; the vocabulary is shared & closed. |
| Notify chokepoint (severity/reload/summary) | shared/notify.ts (`notify` + `dispatchInfoMessage`) | -- | All user-visible output flows here (IL-2). |

## Standard Stack

No new packages. This phase edits existing TypeScript source only. The relevant in-repo "stack" is the Phase 46 type model plus the existing orchestrator helpers.

### Core (existing, reused verbatim)
| Symbol | Location | Purpose | Why Standard |
|--------|----------|---------|--------------|
| `MarketplaceNotAddedMessage` | shared/notify.ts:869-873 | The canonical marketplace-absent / scope-mismatch variant | Phase 46 deliverable; the only representable shape for the condition (TYPE-01). `{ kind: "marketplace-not-added"; name: string; scope?: Scope }`. |
| `renderMarketplaceNotAdded` | shared/notify.ts:2103-2115 | Renders `⊘ <name> [scope?] (failed) {not added}` | Hard-codes the `["not added"]` brace; byte-identical to the retired carve-out (D-46-01a). |
| `isInfoKind` / `StandaloneKind` | shared/notify.ts:903-921 | Routes the variant to standalone dispatch (error severity, no reload, no summary) | Single-source guard; `marketplace-not-added` is already a member. |
| `notify(ctx, pi, message)` | shared/notify.ts:2253+ | The single IL-2 chokepoint | Accepts the top-level variant directly: `notify(ctx, pi, { kind: "marketplace-not-added", ... })`. |
| `ContentReason` | shared/notify.ts:114 | `Exclude<Reason, "not added">` -- the row-reasons type | Makes `not added` on a plugin row a compile error; cascade/cleanup reasons are `ContentReason`. |

### Supporting (existing helpers Phase 47 modifies)
| Symbol | Location | Purpose | Phase 47 action |
|--------|----------|---------|-----------------|
| `resolveInstallMarketplaceSource` | plugin/shared.ts:59-78 | CMP-2..4 install source resolution (project→user fallback) | PRESERVE the fallback; the install marketplace-absent path returns `undefined` here. |
| `resolveInstalledPluginTarget` | plugin/shared.ts:98-124 | CMP-5 unqualified lifecycle target | SCOPE-01: distinguish "absent in explicit scope but present in other" from "absent everywhere". |
| `resolveInstalledMarketplaceTarget` | plugin/shared.ts:127-165 | CMP-5 `@mp` update target; throws `MarketplaceNotFoundError` at 164 | Stop the raw throw escaping; return a discriminated "not found / found in other scope" result. |
| `resolveScopeFromState` | marketplace/shared.ts:467-485 | MR-1 cross-scope funnel (used by reinstall.ts:464) | Reference pattern for cross-scope reads; throws `MarketplaceNotFoundError`. |
| `narrowCascadeFailure` | plugin/uninstall.ts:96-117 | Maps cascade Error → `ContentReason` | ATTR-09: replace the two `return "not in manifest"` defaults. |
| `narrowReason` | plugin/reinstall.ts:768-807 | Maps note string → `ContentReason` | ATTR-09: replace the `return "not in manifest"` fallback. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Standalone top-level `MarketplaceNotAddedMessage` | Embed a marketplace-not-added row in a cascade `plugins[]` | NOT type-representable (cascade rows are `PluginNotificationMessage`); diverges from `info`; would need a type re-cut the milestone forbids. REJECTED. |
| Reuse existing `not added` member | New `marketplace not added` REASONS member | Locked OUT by REQUIREMENTS.md Out-of-Scope + 47-CONTEXT decisions. REJECTED. |
| A new `present in other scope` reason | Reuse `not added` with the `scope` bracket carrying the requested scope | SCOPE-01 acceptance only requires the failure to indicate the other-scope location; the `[scope]` bracket on `{not added}` already communicates "the marketplace you asked for in THIS scope is not added." See Open Question #1 for whether a richer hint is warranted. |

**Installation:** None. `npm run check` is the only gate.

**Version verification:** N/A -- no external packages added.

## Package Legitimacy Audit

Not applicable -- this phase installs no external packages. All work is edits to existing first-party TypeScript under `extensions/pi-claude-marketplace/`. No `npm install`, no registry interaction.

## Exhaustive Misattribution-Site Map

> **13 distinct misattribution sites** verified against LIVE code (line numbers current post-Phase-46). Cell legend: "current" = exact behavior today; "target" = Phase 47 behavior; "REQ" = requirement(s) closed.

### install.ts

**M1 -- Marketplace absent (CMP source resolution miss).** install.ts:339-341.
- Current: `if (source === undefined) throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace })`. The catch classifies via `classifyEntityShapeError` → `(failed) {not in manifest}` on the **plugin** row. Live test asserts `⊘ anything (failed) {not in manifest}` + `cause: Plugin "anything" not found in marketplace "ghost-mp"` (install.test.ts:388-391).
- Target: marketplace-absent → standalone `notify(ctx, pi, { kind: "marketplace-not-added", name: marketplace, ...(explicit scope) })`. The orchestrator must distinguish this from M2. NOTE: `resolveInstallMarketplaceSource` returns `undefined` BOTH when the marketplace is absent in the target scope AND (for user-target) when it cannot fall back -- this IS the marketplace-absent signal. Preserve the CMP-3 project→user fallback: only emit not-added when the fallback ALSO misses.
- REQ: **ATTR-01, ATTR-08** (the split), **SCOPE-01** (user-target asking for a project-only mp).

**M2 -- Plugin absent from a present manifest.** install.ts:369-371.
- Current: `if (entryRaw === undefined) throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace })` → `(failed) {not in manifest}`. CORRECT.
- Target: UNCHANGED. This is the legitimate `{not in manifest}` -- keep it. The split (M1 vs M2) is the entirety of ATTR-08.
- REQ: ATTR-08 (stays distinct).

### uninstall.ts

**M3 -- Marketplace absent (no explicit scope).** uninstall.ts:151-153 via `resolveInstalledPluginTarget` returning `undefined`.
- Current: `if (resolved === undefined) return;` -- **silent, no output**. Hides a typo'd marketplace name.
- Target: distinguish "marketplace absent in requested scope(s)" → `{not added}` from "plugin record merely already gone" → silent converge (M4b). `resolveInstalledPluginTarget` currently collapses both into `undefined`; it must return a richer result (see Site M13 / Decision D-47-C).
- REQ: **ATTR-04, SCOPE-01**.

**M4 -- Marketplace absent (explicit scope), guard path.** uninstall.ts:171-186.
- Current: inside the guard, `if (mp === undefined) { alreadyGone = true; return; }` → silent converge. Reached only via the explicit-scope path (the IN-05 reachability note at uninstall.ts:174-183 documents this). Test: uninstall.test.ts:495 "marketplace record itself absent → NO notification".
- Target: marketplace-absent (explicit scope) → `{not added}` with the `[scope]` bracket. Keep the silent converge ONLY for **M4b** -- `installed === undefined` at uninstall.ts:188-195 (plugin record gone but marketplace present), which is the legitimate PU-5 silent path.
- REQ: **ATTR-04** (the never-added-marketplace case becomes loud; the already-gone-plugin case stays silent).

**M5 -- Cascade/cleanup failure degrades to `{not in manifest}`.** uninstall.ts `narrowCascadeFailure` 96-117.
- Current: `AgentsUnstageFailureError` → `return "not in manifest"` (line 102, the foreign-content blocker LIES that the plugin is absent from the manifest); the final `return "not in manifest"` (line 116) for any unclassified Error. Errno branches (EACCES/EPERM → `permission denied`; ENOENT → `source missing`) are already correct.
- Target: ATTR-09 truthful reasons. Map `AgentsUnstageFailureError` (foreign content owned by another process) to an existing member; map the unclassified default to a truthful member. See Decision D-47-B for the exact mapping.
- REQ: **ATTR-09**.

### reinstall.ts

**M6 -- Marketplace absent / plugin not installed (locked path).** reinstall.ts:876-881 `runLockedReinstall`.
- Current: `if (mp === undefined || oldRecord === undefined) return { partition: "skipped", ..., notes: ["not installed"] }` → `(skipped) {not installed}`. Collapses "marketplace never added" with "plugin not installed".
- Target: split -- `mp === undefined` → `{not added}` (marketplace subject); `oldRecord === undefined` (mp present, plugin not installed) → keep `(skipped) {not installed}` OR `{not in manifest}` per the form. The `runLockedReinstall` path is reached AFTER `enumerateReinstallTargets` resolves a scope, so by the time it runs the marketplace may have been synthesized for the explicit-scope path (M7).
- REQ: **ATTR-03** (consistency).

**M7 -- Explicit-scope synthesizes a target for an absent marketplace.** reinstall.ts:480-486 `enumerateMarketplaceReinstallTargets`.
- Current: `if (mp === undefined) { if (explicitScope !== undefined) { if (target.kind === "plugin") return [{ plugin, marketplace, scope: explicitScope }]; throw new MarketplaceNotFoundError(marketplace, [explicitScope]); } throw new Error(...) }`. For an explicit-scope plugin reinstall against an absent marketplace, it SYNTHESIZES a target that then flows to M6 → `(skipped) {not installed}`. For the marketplace-form it throws raw `MarketplaceNotFoundError` (escapes via reinstallPlugins catch → `narrowReasons` → `{not found}`). For the bare/no-scope form it throws raw `Error` → caught by reinstallPlugins:316-346 → `{not found}` substring.
- Target: marketplace-absent → `{not added}` consistently across all three forms.
- REQ: **ATTR-03** (the "self-inconsistent across forms" finding A-4).

**M8 -- Enumeration-failure catch narrows to `{not found}`.** reinstall.ts:316-346 (`reinstallPlugins` catch) + reinstall.ts:850-852 (`reasonsFromTypedError`: `MarketplaceNotFoundError` → `["not found"]`).
- Current: the raw throw from M7 is caught and the synthetic `(reinstall)` failed row renders `{not found}`.
- Target: route marketplace-absent through the standalone `MarketplaceNotAddedMessage` BEFORE it becomes a thrown `MarketplaceNotFoundError`. The `MarketplaceNotFoundError → ["not found"]` mapping at reinstall.ts:850-852 becomes unreachable for the marketplace-existence case (it may stay for genuine other uses, but verify none remain).
- REQ: **ATTR-03**.

### update.ts

**M9 -- `preflightUpdate` marketplace absent → `{not in manifest}` skip.** update.ts:555-570.
- Current: `if (mp === undefined) return { partition: "skipped", notes: ['marketplace "..." not found in ... scope'], reasons: ["not in manifest"] }` → `(skipped) {not in manifest}` plugin/synthetic row. Wrong subject + wrong reason.
- Target: marketplace-absent → `{not added}` (marketplace subject). NOTE: `preflightUpdate` is shared by both the direct path (`updatePlugins`) AND the cascade path (`updateSinglePlugin`, which must NEVER throw and returns outcomes). The cascade path is the marketplace-autoupdate driver -- for it the marketplace existence was already established by the autoupdate enumerator, so a `mp === undefined` here is a concurrent-removal edge. Design the split so the DIRECT path emits the standalone not-added while the cascade path keeps a non-throwing outcome (see Open Question #2).
- REQ: **ATTR-02**.

**M10 -- `enumerateMarketplaceTarget` raw `Error` throw.** update.ts:1754-1756.
- Current: `if (mp === undefined) throw new Error('Marketplace "..." not found in ... scope.')`. Caught by `updatePlugins` catch (update.ts:176-219) → `notifyDirectFailure` → `narrowDirectFailReason` → message substring `"not found"` → `{not found}` (update.ts:1539-1540). Wrong reason.
- Target: marketplace-absent → standalone `{not added}`. The `enumerateMarketplaceTarget` resolver should signal marketplace-absent structurally (not via a raw `Error`) so the entrypoint can emit the variant.
- REQ: **ATTR-02**.

**M11 -- `resolveInstalledMarketplaceTarget` raw `MarketplaceNotFoundError`.** plugin/shared.ts:164 (called by update.ts:1743, 1747).
- Current: throws `MarketplaceNotFoundError(marketplace, ["project","user"])` when absent from both scopes (the `@mp` bare-scope form). Escapes to `enumerateMarketplaceTarget` → `enumerateTargets` → `updatePlugins` catch → `{not found}`. Also note `syncCloneOnce` (update.ts:247-249) throws a raw `Error` for `mp === undefined` → `notifyDirectFailure` `{not found}`.
- Target: structural not-found result; entrypoint emits `{not added}`.
- REQ: **ATTR-02**.

**M12 -- (reinstall) `narrowReason` fallback lies `{not in manifest}`.** reinstall.ts:803-806.
- Current: unrecognized notes → `return "not in manifest"` (the "we couldn't reconcile this row" permissive default). For genuine cascade/IO/permission failures whose typed dispatch missed, this lies.
- Target: ATTR-09 -- but NOTE reinstall's primary classifier is `reasonsFromTypedError` (815-866) which already maps EACCES/EPERM/ENOENT/typed errors correctly; `narrowReason` is the legacy substring fallback. Tighten the fallback to a truthful member and rely on `reasonsFromTypedError` for the real classification. The `findManualRecoveryError` walk (reinstall.ts:1280-1295) already exists specifically to stop `{rollback partial}` degrading to `{not in manifest}` -- that machinery is the model.
- REQ: **ATTR-09**.

### shared.ts (the chokepoint)

**M13 -- Explicit-scope resolution never consults the other scope.** plugin/shared.ts:104-109 (`resolveInstalledPluginTarget`) and 132-137 (`resolveInstalledMarketplaceTarget`).
- Current: `if (opts.explicitScope !== undefined) return { scope: opts.explicitScope, locations: locationsFor(opts.explicitScope, opts.cwd) }` -- short-circuits WITHOUT reading the other scope's state. "You asked for `project` but it's in `user`" is then reported downstream as not-in-manifest / not-installed / silent. CMP-3 install fallback is a SEPARATE function (`resolveInstallMarketplaceSource`:70-77) and must be preserved untouched.
- Target: SCOPE-01 -- when explicit scope misses, read the other scope; if the target exists there, surface "present in other scope" (carry the requested scope on the `MarketplaceNotAddedMessage`, whose `[scope]` bracket already communicates the requested-scope miss). See Decision D-47-C.
- REQ: **SCOPE-01** (install / uninstall / reinstall / update).

## Decision: Cascade Emission Model (target #4, Discretion #1) -- RECOMMENDED

**D-47-A: Emit `MarketplaceNotAddedMessage` as a STANDALONE top-level message, matching `info` exactly.**

Evidence:
1. **`info` precedent (canonical model).** `getPluginInfo` (plugin/info.ts:539-553) and `getMarketplaceInfo` (marketplace/info.ts:147-150) both emit `notify(ctx, pi, message)` where `message` is the bare `MarketplaceNotAddedMessage` -- NOT wrapped in `{ marketplaces: [...] }`. The milestone theme is "converge on info's model."
2. **The precondition fails before any cascade.** Marketplace-absent / wrong-scope is a property of the marketplace, established at the orchestrator entrypoint preflight, before any plugin row exists. There is no cascade to embed it into. (For the bulk forms -- `update @mp`, `reinstall @mp`, `update`/`reinstall` bare -- a missing `@mp` aborts the whole batch for that marketplace; for the bare-all forms the marketplace existence is established by enumeration, so this site is not reached for a missing name.)
3. **Type model forbids embedding.** A cascade row is a `PluginNotificationMessage` (notify.ts:562). `MarketplaceNotAddedMessage` is a top-level `NotificationMessage` arm (notify.ts:888) and is NOT a `PluginNotificationMessage`. Embedding it as a row is not type-representable without re-cutting the union -- which D-46 and the milestone atomic-supersession lock forbid.
4. **Severity/dispatch already wired.** `isInfoKind` routes the variant to `dispatchInfoMessage` with `error` severity, no reload-hint, no summary line. Standalone emission gets correct routing for free; an embedded form would need new cascade-severity plumbing.

Consequence for the planner: each op's marketplace-absent / scope-mismatch site does `notify(ctx, pi, { kind: "marketplace-not-added", name: marketplace, ...(explicitScope !== undefined && { scope: explicitScope }) }); return;` -- one standalone emission, then return without entering the cascade. Multi-marketplace bulk ops where only ONE `@mp` argument can be missing emit exactly one standalone message (the batch is aborted for that marketplace).

## Decision: Cascade/Cleanup Truthful Reasons (target #3, Discretion #2) -- RECOMMENDED

**D-47-B: Reuse existing `REASONS` members; NO new member required.**

The closed `REASONS` set (notify.ts:71-99) already contains truthful members for every cascade/cleanup blocker. Map each lying `not in manifest` default to:

| Blocker (current lying reason) | Site | Truthful existing `ContentReason` | Rationale |
|--------------------------------|------|-----------------------------------|-----------|
| `AgentsUnstageFailureError` (foreign content owned by another process) -- currently `not in manifest` | uninstall.ts:102 | `source mismatch` (or `permission denied` if the underlying failure is access) | Foreign content the cascade refuses to delete is a content/ownership mismatch, not a manifest-absence. `source mismatch` is the closest existing member (already used for "source classification changed"). Confirm against the catalog byte form preferred by the planner. |
| Unclassified cascade Error default -- currently `not in manifest` | uninstall.ts:116 | `unreadable` | The default is genuinely "we couldn't classify the on-disk failure"; `unreadable` is truthful (the cascade could not read/remove on-disk state) where `not in manifest` is a false claim about the manifest. |
| Unrecognized reinstall note default -- currently `not in manifest` | reinstall.ts:806 | `rollback partial` is already produced by `reasonsFromTypedError`/`findManualRecoveryError` for the real cases; tighten the substring fallback to `unreadable` | The typed path already handles permission/IO/manual-recovery; the substring fallback is the last resort and should not assert manifest-absence. |

Already-correct errno branches (EACCES/EPERM → `permission denied`; ENOENT → `source missing`) at uninstall.ts:104-114 and reinstall.ts:854-863 stay unchanged -- the audit confirms permission/source/version are already correct.

NOTE: the exact member for the `AgentsUnstageFailureError` case is a planner judgment call between `source mismatch` and `permission denied` -- both exist in REASONS; neither is a new member. The catalog/UAT fixture will pin the byte form. Tag: the choice of which existing member best describes foreign-content failure is `[ASSUMED]` (see Assumptions Log A1) -- the audit says "map to a non-lying reason" but does not prescribe which existing member; verify against the catalog and any operator-facing semantics during planning.

## Decision: Cross-Scope Resolution Shape (target #2, Discretion #3) -- RECOMMENDED

**D-47-C: Make the explicit-scope chokepoint consult the other scope; render via `{not added}` carrying the requested scope.**

Current short-circuit (plugin/shared.ts:104-109, 132-137) returns a target without checking the other scope. Recommended shape:

1. Change `resolveInstalledPluginTarget` / `resolveInstalledMarketplaceTarget` to return a **discriminated result** instead of `undefined` / raw throw, e.g.:
   ```
   type ScopeResolution =
     | { kind: "resolved"; scope: Scope; locations: ScopedLocations }
     | { kind: "marketplace-absent"; requestedScope?: Scope }   // absent in requested + other
     | { kind: "other-scope"; presentIn: Scope; requestedScope: Scope }  // SCOPE-01 hint
   ```
   (Exact names at executor discretion; the discriminated-union shape is the load-bearing contract -- mirrors the NFR-7 `installable: true | false` precedent.)
2. On explicit-scope miss, read the OTHER scope's state (one extra `loadState`, NFR-5-safe -- no network). If present there → `other-scope`; if absent everywhere → `marketplace-absent`.
3. The entrypoint maps `other-scope` AND `marketplace-absent` to a standalone `MarketplaceNotAddedMessage` carrying the **requested** scope (so the `[scope]` bracket reads `⊘ <mp> [project] (failed) {not added}` -- communicating "you asked for project; it's not added there"). This is byte-identical to `info`'s `scope-mismatch-not-added` state (catalog:898-905).

**CRITICAL -- preserve CMP-3.** The project→user **install** fallback lives in `resolveInstallMarketplaceSource` (shared.ts:59-78), a SEPARATE function from the lifecycle resolvers. It intentionally returns the user record for a project-target install when no project record exists (lines 70-77). Do NOT route install's source resolution through the cross-scope "report other scope" logic -- install's correct behavior for a project-target / user-only marketplace is to FALL BACK and install (CMP-3), not to report "present in other scope." Only when BOTH the target-scope record AND the user fallback miss does install emit `{not added}` (Site M1). The cross-scope reporting (SCOPE-01) applies to uninstall / reinstall / update lifecycle resolution where there is no by-design fallback.

See Open Question #1 on whether SCOPE-01's "says so" requires a richer hint than the `[scope]` bracket on `{not added}`.

## install's not-in-manifest vs not-added split (target #5)

The two branches already exist as distinct sites:
- **install.ts:339-341** (`source === undefined`) -- marketplace absent (after CMP-3 fallback). → re-attribute to standalone `{not added}` (Site M1).
- **install.ts:369-371** (`entryRaw === undefined`) -- marketplace present, plugin not in its manifest. → KEEP `{not in manifest}` (Site M2).

The split is mechanical: the planner moves the marketplace-absent emission out of the throw→`classifyEntityShapeError` path and into a preflight that emits the standalone variant and returns the `{ status: "failed", error, cause }` outcome (for orchestrated-mode callers like `import/execute.ts`). Verify the orchestrated-mode return contract: `installPlugin` returns `InstallPluginOutcome`; the import cascade (`import/execute.ts`) consumes `outcome.status === "failed"` + `outcome.cause`. A marketplace-absent install in orchestrated mode must still return a `failed` outcome with a sensible `cause` string (the import path renders its own cascade rows; it does NOT call `notify` for the not-added -- so the standalone emission must be gated to standalone mode only). This is the one subtlety: **standalone mode emits the variant; orchestrated mode returns the failed outcome without emitting** (mirrors install's existing `opts.notifications?.mode === "orchestrated"` gate at install.ts:738-744).

## update/reinstall form consistency (target #6)

- **update `<plugin>@<mp>` vs `@<mp>`:** both flow through `enumerateTargets` → `enumerateMarketplaceTarget` (update.ts:1729-1775). The `<plugin>@<mp>` form first tries `resolveInstalledPluginTarget` then falls back to `resolveInstalledMarketplaceTarget` (update.ts:1737-1746); the `@<mp>` form goes straight to `resolveInstalledMarketplaceTarget` (1747-1751). BOTH converge on the `mp === undefined` raw throw at 1754-1756 (M10) and the `resolveInstalledMarketplaceTarget` raw `MarketplaceNotFoundError` (M11). Make BOTH emit the standalone `{not added}` by giving the resolvers a structural not-found result.
- **reinstall explicit-scope vs bare:** `enumerateMarketplaceReinstallTargets` (reinstall.ts:471-496) branches on `explicitScope !== undefined` -- explicit-scope-plugin synthesizes a phantom target (→ M6 `{not installed}`), explicit-scope-marketplace throws `MarketplaceNotFoundError` (→ M8 `{not found}`), no-scope throws raw `Error` (→ M8 `{not found}`). Unify all three to the standalone `{not added}`.
- **Raw `MarketplaceNotFoundError` escapes:** confirmed the edge handlers (edge/handlers/plugin/{update,reinstall}.ts) wrap ONLY `parseArgs` in try/catch, then call the orchestrator with NO surrounding catch. Any throw past the orchestrator boundary propagates raw to the Pi command runner (audit Theme 2). The fix is at the orchestrator (route through `notify`), NOT the edge.

## uninstall silent path (target #7)

Two `undefined`/silent sites must be split (Sites M3, M4):
- **Marketplace never added** (`resolveInstalledPluginTarget` → `undefined` at shared.ts:123; OR guard `mp === undefined` at uninstall.ts:171) → make LOUD: standalone `{not added}`.
- **Plugin record merely already gone** (`installed === undefined` at uninstall.ts:189) → KEEP the PU-5 silent converge (PRD §5.2.2 verbatim, test uninstall.test.ts:455-492). This is the legitimate concurrent-uninstall idempotent path.

The distinction is exactly: "marketplace container absent" (loud, `{not added}`) vs "marketplace present, plugin row absent" (silent). The current `resolveInstalledPluginTarget` collapses both into `undefined` -- that collapse is the bug. D-47-C's discriminated result resolves it: `marketplace-absent` → loud; the guard's `installed === undefined` → silent.

## Catalog/Fixture Impact (success criterion #6)

This phase **CHANGES bytes** (unlike Phase 46). The catalog `docs/output-catalog.md` WILL be edited and `catalog-uat.test.ts` fixtures added/amended.

### New catalog states (one `<!-- catalog-state: STATE -->` + fixture per byte form)

For EACH of install / uninstall / reinstall / update, add the marketplace-absent state(s):

| Op section in catalog | New state | Byte form | Fixture `message` shape |
|-----------------------|-----------|-----------|-------------------------|
| `/claude:plugin install <plugin>@<marketplace>` | `missing-marketplace-not-added` | `⊘ <mp> [scope] (failed) {not added}` | `{ kind: "marketplace-not-added", name, scope }` |
| `/claude:plugin uninstall ...` | `missing-marketplace-not-added` | `⊘ <mp> [scope] (failed) {not added}` | same |
| `/claude:plugin reinstall ...` | `missing-marketplace-not-added` | `⊘ <mp> [scope] (failed) {not added}` | same |
| `/claude:plugin update ...` | `missing-marketplace-not-added` | `⊘ <mp> [scope] (failed) {not added}` | same |

The `scope`-omitted variant (`⊘ <mp> (failed) {not added}`, absent-from-both) applies where a no-`--scope` invocation can miss in both scopes (uninstall/reinstall/update bare lifecycle forms). install always has an explicit-or-default scope, so its not-added typically carries a bracket -- verify per op which forms can reach scope-omitted vs scope-present. The existing `info` fixtures (catalog-uat.test.ts:1351-1380, 1560-1588) are the exact template: `expectedSeverity: "error"`, `pi: piWithBothLoaded()`, `message: { kind: "marketplace-not-added", name, [scope] } satisfies NotificationMessage`.

### Cross-scope states

If D-47-C's hint is just the `[scope]`-bracketed `{not added}` (recommended), the cross-scope case reuses the `missing-marketplace-not-added` (scope-mismatch) byte form -- no separate catalog state needed beyond the bracket variant. If the planner adopts a richer hint (Open Question #1), a NEW byte form + catalog state + possibly a renderer change is required -- escalate before adopting.

### Amended (intentionally changed) existing states/tests

| Existing test/fixture | Current assertion | Phase 47 amendment |
|-----------------------|-------------------|--------------------|
| install.test.ts:380-393 (marketplace-absent) | `● ghost-mp [project]\n  ⊘ anything (failed) {not in manifest}` + cause | → standalone `⊘ ghost-mp [project] (failed) {not added}`, severity error, no cause-chain (the variant carries no cause). |
| install.test.ts:~1297 (regex) | `⊘ hello (failed) {not in manifest}` + cause for marketplace-absent | Re-attribute IF it is the marketplace-absent case (verify it's not the legitimate plugin-not-in-manifest M2 case). |
| uninstall.test.ts:455-492, :495 | marketplace-absent → NO notification (silent) | → emit `{not added}`; the silent-converge assertion moves to the plugin-record-gone case only. |
| uninstall.test.ts:985-1097 (`narrowCascadeFailure` unknown/plain-Error → `not in manifest`) | asserts `{not in manifest}` | → assert the truthful reason from D-47-B (`unreadable` / `source mismatch`). |
| reinstall tests for explicit-scope-absent / bare-absent | `{not installed}` / `{not found}` | → `{not added}`. |
| update tests for `@mp` absent / `<pl>@<mp>` absent | `{not in manifest}` / `{not found}` | → `{not added}`. |

The `catalog-uat.test.ts` runner (tests/architecture/catalog-uat.test.ts) pairs each `<!-- catalog-state: STATE -->` with the next fenced block and byte-compares `notify(mockCtx, mockPi, fixture.message)` output. Every new catalog state needs a matching FIXTURES entry under the op's H2 section key, or the parser-coverage assertion fails.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no on-disk state SHAPE change; REQUIREMENTS.md Out-of-Scope explicitly excludes "State migration of already-installed records." The `not added` condition is computed at runtime from `state.marketplaces[mp] === undefined`, never persisted. | None |
| Live service config | None -- no external services; this is a TS-only correctness change. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None. | None |
| Build artifacts | None -- no `package.json`/build changes; pure source edits under `extensions/pi-claude-marketplace/`. | None |

**Nothing found in any category -- verified:** this is a behavior/attribution + catalog/fixture change with zero persistence, zero network (NFR-5 preserved -- all new reads are `loadState`, no git), zero new dependencies, zero state-shape changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marketplace-not-added rendering | A new `(failed) {not added}` row composer | `renderMarketplaceNotAdded` + the `MarketplaceNotAddedMessage` variant | Phase 46 deliverable; byte-locked; routed through `isInfoKind`. Re-cutting = atomic-supersession violation. |
| Severity / reload-hint / summary for the variant | Manual `ctx.ui.notify(body, "error")` | `notify(ctx, pi, message)` | `isInfoKind` → `dispatchInfoMessage` already computes error severity, suppresses reload-hint and summary line. Bypassing `notify` violates IL-2. |
| Cross-scope state read | A bespoke dual-scope loader in each op | The `loadState(locationsFor(otherScope, cwd))` pattern + a shared discriminated resolver in `plugin/shared.ts` (mirror `resolveScopeFromState` at marketplace/shared.ts:467) | One chokepoint = SCOPE-01 closed once for all four ops; avoids per-op drift (the v1.4.1/v1.5 convergence lesson). |
| Reason classification | New reason strings | Existing `REASONS` members (D-47-B mapping) | Locked: no new member. The closed set already has truthful members for every blocker. |
| Distinguishing marketplace-absent from plugin-absent | substring-matching error messages | The structural `PluginShapeError.shape.kind` discriminator (errors.ts:349-363) + the discriminated scope-resolution result | The codebase already prefers typed dispatch over substring matching (reasonsFromTypedError, classifyEntityShapeError); follow that. |

**Key insight:** Phase 46 already built every primitive. Phase 47 is wiring + re-attribution, not new mechanism. The temptation to add a "cross-scope reason" or a new emission shape is the trap -- the milestone explicitly locks against it.

## Architecture Patterns

### Emission Flow (marketplace-absent precondition)

```
edge handler (parse only; NO catch around orchestrator)
  → orchestrator entrypoint (install/uninstall/reinstall/update)
      → PREFLIGHT: resolve marketplace existence + scope (plugin/shared.ts)
          ├─ resolved          → proceed to cascade / 3-phase / ledger
          ├─ marketplace-absent → notify(ctx, pi, { kind:"marketplace-not-added", name, scope? }); return
          └─ other-scope (SCOPE-01) → notify(ctx, pi, { kind:"marketplace-not-added", name, scope:requested }); return
      → (plugin-absent-from-present-manifest path) → {not in manifest} on the plugin row (UNCHANGED)
      → (cascade/cleanup failure) → narrow* → truthful ContentReason (D-47-B)
  → notify() → isInfoKind? → dispatchInfoMessage (error, no reload, no summary)   [standalone]
            → else cascade body                                                    [plugin rows]
```

### Pattern 1: Standalone not-added emission (copy from info)
```typescript
// Source: orchestrators/plugin/info.ts:547-553 (verified live)
const message: NotificationMessage = {
  kind: "marketplace-not-added",
  name: opts.marketplace,
  ...(opts.scope !== undefined && { scope: opts.scope }),
};
notify(opts.ctx, opts.pi, message);
return;
```

### Pattern 2: Discriminated scope resolution (mirror resolveScopeFromState)
```typescript
// Source pattern: orchestrators/marketplace/shared.ts:467-485 (resolveScopeFromState)
// Extend to a discriminated result so callers can distinguish
// "absent everywhere" vs "present in other scope" vs "resolved".
```

### Anti-Patterns to Avoid
- **Embedding not-added as a cascade `plugins[]` row** -- not type-representable; diverges from info. (D-47-A.)
- **Routing install's source resolution through the cross-scope "report other scope" path** -- breaks CMP-3. (D-47-C critical note.)
- **Substring-matching `"not found"` to classify marketplace-absence** -- the current update/reinstall lying path; use structural results.
- **Adding a new REASONS member** -- locked OUT.
- **Emitting the variant in orchestrated (import-cascade) mode** -- gate to standalone mode; orchestrated mode returns the failed outcome (mirror install.ts:738).

## Common Pitfalls

### Pitfall 1: Breaking CMP-3 while closing SCOPE-01
**What goes wrong:** Making install report "present in other scope" instead of falling back project→user.
**Why:** SCOPE-01 and CMP-3 both touch scope resolution but live in different functions; conflating them breaks the by-design install fallback.
**How to avoid:** Leave `resolveInstallMarketplaceSource` (shared.ts:59-78) untouched; SCOPE-01 applies to the LIFECYCLE resolvers (`resolveInstalledPluginTarget`/`resolveInstalledMarketplaceTarget`) only.
**Warning signs:** A project-target install of a user-only marketplace emits `{not added}` instead of installing. (Verify with the CMP-3 test path.)

### Pitfall 2: Re-attributing the legitimate `{not in manifest}` (M2)
**What goes wrong:** Both install branches (339 and 369) throw `PluginShapeError{kind:"not-in-manifest"}`; a blanket re-attribution would wrongly convert the plugin-absent case to `{not added}`.
**How to avoid:** Only re-attribute the `source === undefined` branch (M1). The `entryRaw === undefined` branch (M2) stays. This is the heart of ATTR-08.
**Warning signs:** `plugin info ghost-plugin@present-mp` and `install ghost-plugin@present-mp` no longer agree on `{not in manifest}`.

### Pitfall 3: The cascade path (updateSinglePlugin) must never throw
**What goes wrong:** Adding a `notify`/throw in `preflightUpdate` (shared by direct + cascade) breaks the cascade-safe contract (updateSinglePlugin NEVER throws; update.ts:397-437).
**How to avoid:** Split direct vs cascade -- direct emits the standalone variant; cascade keeps a non-throwing `partition: "failed"`/`"skipped"` outcome. See Open Question #2.
**Warning signs:** marketplace-autoupdate cascade aborts a whole batch on one concurrently-removed marketplace.

### Pitfall 4: Silent-converge regression in uninstall
**What goes wrong:** Making marketplace-absent loud also makes the legitimate already-gone-plugin case loud, breaking PU-5.
**How to avoid:** Distinguish "marketplace container absent" (loud) from "marketplace present, plugin row absent" (silent) -- D-47-C's discriminated result + the guard's `installed === undefined` branch.
**Warning signs:** Concurrent double-uninstall emits a spurious notification (PU-5 test uninstall.test.ts:455 fails).

### Pitfall 5: Catalog parser-coverage failure
**What goes wrong:** Adding a `<!-- catalog-state -->` without a matching FIXTURES entry (or vice versa) fails the catalog-uat coverage assertion.
**How to avoid:** Every new catalog state gets a fixture under the same op H2 key; amend bytes and fixtures in the SAME commit (atomic-supersession).
**Warning signs:** `npm test` reports an unpaired catalog state or an orphan fixture.

## Code Examples

### Standalone not-added (the one canonical pattern, used at every M-site)
```typescript
// Source: orchestrators/marketplace/info.ts:93-101, plugin/info.ts:547-553 (verified live)
function notifyMarketplaceNotAdded(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  marketplace: string,
  scope: Scope | undefined,
): void {
  notify(ctx, pi, {
    kind: "marketplace-not-added",
    name: marketplace,
    ...(scope !== undefined && { scope }),
  });
}
```

### Truthful cascade reason (D-47-B applied to uninstall)
```typescript
// Source: orchestrators/plugin/uninstall.ts:96-117 (current), amended
function narrowCascadeFailure(cause: Error): ContentReason {
  if (cause instanceof AgentsUnstageFailureError) {
    return "source mismatch";   // was "not in manifest" (LIE) -- D-47-B
  }
  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM": return "permission denied";  // already correct
      case "ENOENT": return "source missing";    // already correct
      default: break;
    }
  }
  return "unreadable";          // was "not in manifest" (LIE) -- D-47-B
}
```

## State of the Art

| Old Approach (pre-Phase-47) | Current Approach (Phase 47 target) | When Changed | Impact |
|-----------------------------|------------------------------------|--------------|--------|
| Marketplace-absent → `{not in manifest}` on plugin row (install) | standalone `{not added}` on marketplace subject | Phase 47 | Correct attribution; matches info. |
| Marketplace-absent → silent (uninstall) | `{not added}` (loud), silent reserved for already-gone plugin | Phase 47 | No more hidden typos. |
| Marketplace-absent → `{not installed}`/`{not found}` by form (reinstall/update) | `{not added}` consistently | Phase 47 | Form-independent. |
| Raw `MarketplaceNotFoundError`/`Error` past orchestrator | routed through `notify` | Phase 47 | No unstyled raw throws. |
| Cascade/IO failure → `{not in manifest}` (lie) | truthful existing reason | Phase 47 | Honest blockers. |
| Explicit-scope short-circuit (no other-scope read) | cross-scope-aware resolution | Phase 47 | "wrong scope" ≠ "doesn't exist." |

**Deprecated/outdated by Phase 46 (already done, do not re-do):**
- The `renderPluginInfo` `{not added}` carve-out -- DELETED; use the variant.
- Placeholder `marketplaceScope`/`marketplaceDetails` smuggling -- gone (TYPE-01).
- `["not added", ...]` on a row reasons field -- now a compile error (ContentReason).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The best existing `REASONS` member for `AgentsUnstageFailureError` (foreign-content) is `source mismatch` (alt: `permission denied`); for the unclassified default it is `unreadable` | D-47-B / Code Examples | Wrong member → catalog byte form is misleading to operators (still truthful, not a lie). Verify against catalog semantics + operator mental model during planning. Low risk: any existing non-`not added`, non-`not in manifest` member satisfies ATTR-09's "truthful, not degrading to not-in-manifest." |
| A2 | SCOPE-01's "reports that it exists in the other scope" is satisfied by the `[requestedScope]`-bracketed `{not added}` (byte-identical to info's scope-mismatch state) | D-47-C / Open Question #1 | If the milestone wants an explicit "present in <other> scope" phrase, a renderer/catalog change is needed (escalate). The REQUIREMENTS.md acceptance text says "reports that it exists in the other scope" -- the bracket communicates the requested-scope miss but does NOT name the other scope. See Open Question #1. |
| A3 | The cascade path (`updateSinglePlugin`) reaching `mp === undefined` in `preflightUpdate` is a concurrent-removal edge that should remain a non-throwing outcome (not a standalone emission) | Pitfall 3 / Open Question #2 | If wrong, the autoupdate cascade could mis-report. Verify the cascade enumerator guarantees marketplace existence before calling. |

## Open Questions

1. **Does SCOPE-01 require naming the OTHER scope, or is the `[requestedScope]` bracket on `{not added}` sufficient?**
   - What we know: REQUIREMENTS.md SCOPE-01 says "the failure reports that it exists in the other scope." `info`'s scope-mismatch state renders `⊘ my-mp [user] (failed) {not added}` -- the `[user]` is the REQUESTED scope, communicating "not added HERE," but it does NOT say "...but it IS in project."
   - What's unclear: whether "reports that it exists in the other scope" is satisfied by the requested-scope bracket (operator infers "try the other scope") or demands an explicit other-scope hint (which would need a new renderer affordance / catalog byte form / possibly a type-model touch).
   - Recommendation: adopt the `[requestedScope]` bracket `{not added}` (no new mechanism, matches info, satisfies the literal "not added in the scope you asked for"). Flag for the planner/discuss to confirm the milestone intent; if a richer hint is wanted, scope it explicitly as it expands the byte surface and may touch the type model (against the milestone's lean).

2. **How should `preflightUpdate` (shared by direct + cascade) split the marketplace-absent emission?**
   - What we know: `preflightUpdate` (update.ts:549-676) serves both `updatePlugins` (direct, may emit) and `updateSinglePlugin` (cascade, NEVER throws/emits). The `mp === undefined` branch (555-570) currently returns a `skipped {not in manifest}` outcome for both.
   - What's unclear: whether the direct path should preflight marketplace-existence BEFORE `runThreePhaseUpdate` (so the standalone emission happens at the entrypoint, not inside the shared preflight), leaving the cascade path's outcome untouched.
   - Recommendation: hoist the marketplace-existence check to `enumerateTargets`/the entrypoint for the direct path (where M10/M11 already live), and emit the standalone variant there. Leave `preflightUpdate`'s internal `mp === undefined` as the cascade-safe concurrent-removal guard (returning an outcome). This keeps the cascade-never-throws contract intact and puts the emission at the right layer.

3. **Which install forms can reach scope-omitted `{not added}` vs scope-present?**
   - What we know: install always has a resolved `scope` (the edge defaults it). uninstall/reinstall/update bare lifecycle forms can search both scopes (no `--scope`).
   - Recommendation: enumerate per op during planning; install's not-added always carries a bracket; bare lifecycle forms that miss in both scopes carry no bracket (absent-from-both byte form). Both byte forms already exist in the catalog (info states) as templates.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | runtime + `node --test` | ✓ | (project floor >=20.19.0; CI) | -- |
| TypeScript (`tsc --noEmit`) | typecheck gate | ✓ | ^5.9.x (per CLAUDE.md) | -- |
| ESLint / Prettier | lint + format gate | ✓ | eslint ^10.x | -- |
| `node:test` | test runner (`npm test`) | ✓ | built-in | -- |

No external services, no network (NFR-5), no new tools. `npm run check` (typecheck → lint → format:check → test) is the single gate; all four sub-gates run on existing tooling.

## Validation Architecture

> nyquist_validation: true (config.json) -- section REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict` |
| Config file | none (CLI invocation in package.json) |
| Quick run command | `node --test "tests/orchestrators/plugin/install.test.ts"` (per-op; substitute file) |
| Full suite command | `npm run check` (typecheck + lint + format:check + `npm test`) |
| Byte-contract runner | `node --test "tests/architecture/catalog-uat.test.ts"` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTR-01 | install missing mp → standalone `{not added}` (not `{not in manifest}` on plugin row) | unit (orchestrator) + byte (catalog) | `node --test tests/orchestrators/plugin/install.test.ts` ; `node --test tests/architecture/catalog-uat.test.ts` | ✅ (amend install.test.ts:380-393; add catalog fixture) |
| ATTR-08 | install distinguishes mp-absent (`{not added}`) from plugin-absent (`{not in manifest}`) | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (M2 path test exists; add M1-vs-M2 contrast test) |
| ATTR-02 | update `<pl>@<mp>` and `@<mp>` missing mp → `{not added}`, no raw throw | unit + byte | `node --test tests/orchestrators/plugin/update.test.ts` ; catalog-uat | ✅ (amend update tests; add catalog state) |
| ATTR-03 | reinstall missing mp → `{not added}` across explicit + bare forms | unit + byte | `node --test tests/orchestrators/plugin/reinstall.test.ts` ; catalog-uat | ✅ (amend reinstall tests; add catalog state) |
| ATTR-04 | uninstall never-added mp → `{not added}`; already-gone plugin → silent | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ (split uninstall.test.ts:455-495) |
| ATTR-09 | cascade/cleanup failure → truthful reason (not `{not in manifest}`) | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` ; `...reinstall.test.ts` | ✅ (amend narrowCascadeFailure tests uninstall.test.ts:985-1097) |
| SCOPE-01 | target in other scope → reports it (not not-installed/not-in-manifest) | unit | `node --test tests/orchestrators/plugin/{install,uninstall,reinstall,update,shared}.test.ts` | ⚠️ shared.test.ts exists; ADD cross-scope resolution tests (new behavior) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + the touched op's `node --test tests/orchestrators/plugin/<op>.test.ts` + `node --test tests/architecture/catalog-uat.test.ts` (byte gate after any catalog edit).
- **Per wave merge:** `npm run check` (the wave is serialized through shared.ts/notify.ts; one merge gate).
- **Phase gate:** Full `npm run check` GREEN before `/gsd-verify-work`; `git diff --stat docs/output-catalog.md` is NON-empty this phase (bytes change) and every change has a paired fixture.

### Wave 0 Gaps
- [ ] Cross-scope resolution tests in `tests/orchestrators/plugin/shared.test.ts` -- covers SCOPE-01 (new discriminated resolver behavior; no existing coverage for "present in other scope").
- [ ] New catalog states + FIXTURES entries for each op's `missing-marketplace-not-added` (and scope-mismatch) -- covers ATTR-01/02/03/04 byte contract.
- [ ] No framework install needed; no new conftest/fixtures harness (the catalog-uat runner + per-op test scaffolds already exist).

*(Existing test infrastructure covers all reason-classification + byte-equality needs; the only genuinely-new surface is cross-scope resolution.)*

## Security Domain

> security_enforcement not set to false in config.json → section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface; this is local CLI attribution. |
| V3 Session Management | no | N/A. |
| V4 Access Control | no | Scope is a namespace, not a security boundary; cross-scope reads are read-only `loadState`. |
| V5 Input Validation | yes (existing) | Plugin/marketplace names already validated at the edge (`parseRequiredPluginMarketplaceRef`); no new untrusted input. |
| V6 Cryptography | no | None. |
| V12 File Resources | yes (existing, NFR-10) | Path containment (`assertPathInside`) unchanged; the new other-scope reads use `locationsFor` (containment-safe) and `loadState` (read-only). No new write paths. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Network access on a no-network op | Tampering / NFR-5 | The new cross-scope read is `loadState` only (no git, no `platform/git`); the `no-orchestrator-network.test.ts` architectural grep still gates install.ts/list.ts. Confirm no `platform/git` import is introduced. |
| Path traversal via marketplace name in not-added rendering | Tampering | `MarketplaceNotAddedMessage.name` is rendered as text only (no path join); the name is already edge-validated. |
| Information disclosure via cross-scope hint | Information Disclosure | Reporting "present in other scope" reveals only the existence of a same-named marketplace in the user's own other scope -- no cross-user/cross-tenant boundary (single-user CLI). Acceptable. |

No new security-relevant surface beyond one extra read-only `loadState` per explicit-scope lifecycle miss. NFR-5 preserved (no network); NFR-10 containment unchanged.

## Sources

### Primary (HIGH confidence -- live codebase, verified this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- REASONS (71-99), ContentReason (114), MarketplaceNotAddedMessage (869-873), NotificationMessage union (882-888), StandaloneKind/isInfoKind (903-921), renderMarketplaceNotAdded (2103-2115), dispatchInfoMessage (2208+), notify (2253+).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- M1 (339-341), M2 (369-371), classifyEntityShapeError (1108-1157), orchestrated-mode gate (738-744).
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- M3 (151-153), M4 (171-186), M4b (188-195), narrowCascadeFailure (96-117).
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- M6 (876-881), M7 (471-496), M8 (316-346, 850-852), narrowReason (768-807), reasonsFromTypedError (815-866), findManualRecoveryError (1280-1295).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- M9 preflightUpdate (549-676), M10 enumerateMarketplaceTarget (1729-1775), syncCloneOnce (233-257), notifyDirectFailure (1441-1474), narrowDirectFailReason (1503-1564).
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- resolveInstallMarketplaceSource CMP-3 (59-78), resolveInstalledPluginTarget (98-124), resolveInstalledMarketplaceTarget + M11 throw (127-165).
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- canonical standalone emission (539-553).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` -- buildNotAddedMessage (93-101), getMarketplaceInfo emission (147-150).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- resolveScopeFromState (467-485), AgentsUnstageFailureError (54-61).
- `extensions/pi-claude-marketplace/shared/errors.ts` -- MarketplaceNotFoundError (155-166), PluginShapeErrorShape (349-363).
- `docs/output-catalog.md` -- install failure states (300-360), plugin-info not-in-manifest / not-added (1003-1040), marketplace-info not-added (888-905).
- `tests/architecture/catalog-uat.test.ts` -- CatalogFixture shape (180-186), marketplace-not-added fixtures (1351-1380, 1560-1588).
- `tests/orchestrators/plugin/install.test.ts` (380-393, 1297), `uninstall.test.ts` (455-495, 985-1097) -- current asserted bytes.
- `.planning/phases/46-type-model-foundations/46-01-SUMMARY.md` -- Phase 46 deliverables + ContentReason ripple into outcome vocabulary.
- `.planning/research/v1.10-attribution-audit.md` -- findings A-1/A-3/A-4/A-5/A-7/A-9/A-10, Theme 1-4.

### Secondary (MEDIUM)
- `docs/messaging-style-guide.md` -- closed-set grammar, severity ladder, `not added` as structural marker.
- `.planning/REQUIREMENTS.md` -- ATTR/SCOPE acceptance criteria + Out-of-Scope locks.

### Tertiary (LOW)
- None -- no WebSearch needed; this is an internal refactor verified end-to-end against source.

## Metadata

**Confidence breakdown:**
- Misattribution-site map: HIGH -- all 13 sites verified against live code with current line numbers; current bytes confirmed against tests.
- Cascade emission model (D-47-A): HIGH -- backed by type model (cascade rows ≠ NotificationMessage), info precedent, and Phase 46 wiring.
- Reason vocabulary (D-47-B): MEDIUM -- the mapping is sound and uses existing members; the EXACT member for foreign-content is a planner judgment (A1).
- Cross-scope shape (D-47-C): HIGH on the mechanism (discriminated resolver, CMP-3 preservation); MEDIUM on whether the bracket alone satisfies SCOPE-01's "reports the other scope" (Open Question #1 / A2).
- Catalog/fixture impact: HIGH -- the runner mechanism + fixture template are verified.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable internal codebase; re-verify line numbers only if other v1.10 phases land first).
