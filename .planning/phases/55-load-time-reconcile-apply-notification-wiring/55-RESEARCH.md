# Phase 55: Load-Time Reconcile Apply, Notification & Wiring - Research

**Researched:** 2026-06-10
**Domain:** Load-time reconcile apply orchestrator + notify-sink wiring at the Pi extension lifecycle boundary
**Confidence:** HIGH (all claims grounded in repo source + Pi peer-dep `.d.ts`)

## Summary

Phase 55 lands the load-time application of the Phase 53 `planReconcile` plan. It wires together five elements that already exist in isolation: (1) the Pi extension lifecycle hook `resources_discover` (the only "every startup AND every reload" event), (2) `migrateFirstRunConfig` (Phase 52), (3) `loadMergedScopeConfig` + `planReconcile` (Phase 53), (4) the existing per-scope-locked orchestrators `addMarketplace` / `removeMarketplace` / `installPlugin` / `uninstallPlugin` / `setPluginEnabled` (Phases 1-54), and (5) the structured `notify()` cascade with pending-tense `will *` tokens (Phase 53).

**The critical feasibility question is resolved by direct inspection of `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:802`:** `ExtensionHandler<E, R> = (event, ctx) => ...`. `resources_discover` IS dispatched with a full `ExtensionContext` (and therefore `ctx.ui.notify`) as the 2nd argument. The current `index.ts` handler ignores it (signature `(event) =>`); Phase 55 simply binds and uses it. **No queued-messages mechanism needed. No sink-capture-at-session-start needed.** This collapses what the CONTEXT presents as the highest-risk feasibility spike into a one-line signature change.

**Primary recommendation:** Add a new pure orchestrator `orchestrators/reconcile/apply.ts` that takes `(ctx, pi, cwd)`, fans out across user + project scopes serially, and per-scope: acquires the per-scope lock via `withStateGuard`, runs migrate-then-load-then-plan INSIDE the lock, releases the lock, then drives the existing orchestrators serially WITHOUT an outer lock (each owns its own per-scope lock; CR-01 nested-lock lesson from Phase 54). Collect outcomes into a `CascadeNotificationMessage` and emit ONE notify() per load. Add one new `(reconcile *)` past-tense token tuple OR reuse existing transition tokens — see Pattern 5 below for the locked choice.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lifecycle hook (`resources_discover`) | Extension entry (`index.ts`) | — | Single registration point; carries `ctx` per Pi API |
| Migrate-then-reconcile ordering | Orchestrator (`reconcile/apply.ts`) | Persistence (`migrate-config.ts`) | Ordering is an orchestration concern; the seam is pure |
| Plan-to-action mapping | Orchestrator (`reconcile/apply.ts`) | Existing orchestrators | Apply step drives existing per-scope-locked orchestrators serially |
| Per-scope lock coverage | Transaction (`withStateGuard`) | Existing orchestrators | Each driven orchestrator opens its own per-scope lock; no outer lock |
| Notification cascade | `shared/notify.ts` | `reconcile/notify.ts` projection | Lockstep grammar + catalog + UAT in one atomic commit |
| Network policy | Driven orchestrators (e.g. `addMarketplace`) | `apply.ts` per-entry try/catch | Soft-fail per entry at the apply seam; never propagates past the handler |
| Ownership/provenance guard (RECON-02) | `reconcile/plan.ts` `marketplacesToRemove` / `pluginsToUninstall` | `state.json` records | Plan only emits removals for entries IN state; planner is the gate |

## Standard Stack

### Core (already installed; no additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | `^0.79.0` (peer/dev) | Extension API host; `pi.on("resources_discover", ...)` is the load hook | Mandated peer dep; only source of `ExtensionContext` / `ctx.ui.notify` [VERIFIED: package.json + `dist/core/extensions/types.d.ts:802`] |
| `proper-lockfile` | `^4.1.2` | Per-scope cross-process state lock (via `withStateGuard`) | Already in use for ST-7 / D-06 single-writer discipline [VERIFIED: `transaction/with-state-guard.ts:32-33`] |
| `write-file-atomic` | `^8.0.0` | Atomic state/config writes | Already wired through `saveConfig` / `saveState`; no Phase 55 surface [VERIFIED: package.json] |
| `typebox` | `^1.1.38` | Schema validation (config/state) | Already in use; no Phase 55 surface [VERIFIED: package.json] |

### Supporting

| Module | Purpose | Phase 55 Role |
|--------|---------|---------------|
| `persistence/migrate-config.ts::migrateFirstRunConfig(loc, state)` | Lossless first-run state -> config projection | Called INSIDE the per-scope lock BEFORE `loadMergedScopeConfig` [VERIFIED: Phase 52 SUMMARY] |
| `persistence/config-merge.ts::loadMergedScopeConfig(loc)` | Returns `{ merged, base, local }` with per-file `ConfigLoadResult` | Read inside the per-scope lock AFTER migrate [VERIFIED: `config-merge.ts:143`] |
| `persistence/state-io.ts::loadState(extensionRoot)` | Returns `ExtensionState` (or default empty) | Read inside the per-scope lock; throws on unparseable JSON [VERIFIED: `state-io.ts:158`] |
| `orchestrators/reconcile/plan.ts::planReconcile(merged, state, scope)` | Pure 7-bucket diff | Called inside the per-scope lock; pure, no I/O [VERIFIED: Phase 53 SUMMARY] |
| `orchestrators/marketplace/add.ts::addMarketplace(opts)` | Drives the GitHub clone OR path-source materialization | Driven per `marketplacesToAdd` entry [VERIFIED: `add.ts:264`] |
| `orchestrators/marketplace/remove.ts::removeMarketplace(opts)` | Removes a marketplace + cascades plugin unstaging | Driven per `marketplacesToRemove` entry [VERIFIED: `remove.ts:160`] |
| `orchestrators/plugin/install.ts::installPlugin(opts)` AND `runInstallLedger(state, locations, opts, capture)` | Install (with own `withStateGuard`) OR guard-free ledger body | Use `installPlugin` (Phase 55 owns lock outside) [VERIFIED: `install.ts:781`, `:367`] |
| `orchestrators/plugin/uninstall.ts::uninstallPlugin(opts)` | Cascade unstage + state removal | Driven per `pluginsToUninstall` entry [VERIFIED: `uninstall.ts:148`] |
| `orchestrators/plugin/enable-disable.ts::setPluginEnabled(opts)` | Disable: unstage + reset resources; Enable: runInstallLedger inside locked tx | Driven per `pluginsToEnable` / `pluginsToDisable` [VERIFIED: `enable-disable.ts:258`] |
| `transaction/with-state-guard.ts::withStateGuard(loc, mutate)` | Per-scope proper-lockfile lock around `loadState` -> mutate -> `saveState` | Used for MIGRATE+LOAD+PLAN read pass; NOT used as outer wrapper around the apply loop (CR-01) [VERIFIED: `with-state-guard.ts:66`] |
| `shared/notify.ts::notify(ctx, pi, NotificationMessage)` | Sole sanctioned `ctx.ui.notify` call site | Single emission per load with `CascadeNotificationMessage` [VERIFIED: `notify.ts:9-41`] |

### Installation

**Nothing to install.** All required surfaces are already in `package.json` and the existing source tree. Phase 55 is pure orchestration glue over frozen foundations.

**Version verification (recorded 2026-06-10):**
- `@earendil-works/pi-coding-agent@0.79.0` resolves the `pi.on("resources_discover", handler)` arity to `ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>` = `(event, ctx) => Promise<R | void>` [VERIFIED: `dist/core/extensions/types.d.ts:802,808`].
- `proper-lockfile@4.1.2`, `write-file-atomic@8.0.0`, `typebox@1.1.38`: see package.json [VERIFIED].

## Package Legitimacy Audit

**Skipped — no external packages added in Phase 55.** All surfaces already in the dependency tree from earlier phases; the package-legitimacy gate ran in Phase 45 (manifest-cache) and Phase 51 (typebox bump). No new install commands appear in any planned task.

## Architecture Patterns

### System Architecture Diagram

```
Pi process startup OR /reload
    |
    v
[Pi runtime fires "resources_discover" event with (event, ctx)]
    |
    v
index.ts handler receives (event, ctx)
    |
    +--> applyReconcile({ ctx, pi, cwd: event.cwd })
    |        |
    |        v
    |   For each scope in ["project", "user"]:
    |        |
    |        v
    |   --- per-scope read pass (lock acquired) -----------------
    |   withStateGuard(loc, async (state) => {                  |
    |     migrateResult = await migrateFirstRunConfig(loc, state);
    |     outcome = await loadMergedScopeConfig(loc);
    |     if (outcome.base.status === "invalid" ||              |
    |         outcome.local.status === "invalid") {             |
    |       return abortBlock(scope, outcome);                  |
    |     }
    |     return planReconcile(outcome.merged, state, scope);   |
    |   })
    |   --- lock released -------------------------------------
    |        |
    |        v
    |   --- apply pass (NO outer lock — CR-01 lesson) ---------
    |   For each marketplacesToRemove[i]:    removeMarketplace(...)
    |   For each pluginsToUninstall[i]:       uninstallPlugin(...)
    |   For each marketplacesToAdd[i]:        addMarketplace(...)  [NETWORK; soft-fail]
    |   For each pluginsToInstall[i]:         installPlugin(...)    [NETWORK; soft-fail]
    |   For each pluginsToEnable[i]:          setPluginEnabled({...enable: true})
    |   For each pluginsToDisable[i]:         setPluginEnabled({...enable: false})
    |   For each sourceMismatches[i]:         report (no action)
    |   ----------------------------------------------------
    |        |
    |        v
    |   Accumulate per-entry outcomes (success | failure-with-reason)
    |        |
    |        v
    |   Compose ONE CascadeNotificationMessage across both scopes (IL-2)
    |        |
    |        v
    |   notify(ctx, pi, message)         [resources_discover ALSO returns
    |                                     the aggregateDiscoveredResources
    |                                     result; both happen in one
    |                                     handler invocation]
    v
[Existing aggregateDiscoveredResources runs after reconcile
 so newly-materialized plugins are picked up on the SAME load]
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── index.ts                                 # MODIFIED: handler signature gains ctx; call applyReconcile BEFORE aggregateDiscoveredResources
├── orchestrators/
│   ├── reconcile/
│   │   ├── apply.ts                         # NEW: applyReconcile orchestrator (this phase)
│   │   ├── apply-notify.ts                  # NEW (optional): projection from per-entry outcomes to CascadeNotificationMessage
│   │   ├── plan.ts                          # FROZEN (Phase 53)
│   │   ├── preview.ts                       # FROZEN (Phase 53)
│   │   ├── notify.ts                        # MAY GAIN past-tense projection helper (see Pattern 5)
│   │   └── types.ts                         # FROZEN (Phase 53)
│   ├── marketplace/                         # FROZEN — driven by applyReconcile
│   ├── plugin/                              # FROZEN — driven by applyReconcile
│   └── discover.ts                          # FROZEN — runs AFTER applyReconcile
├── persistence/
│   ├── migrate-config.ts                    # FROZEN — called inside per-scope read-pass lock
│   ├── config-merge.ts                      # FROZEN
│   └── state-io.ts                          # FROZEN
└── shared/
    └── notify.ts                            # MODIFIED: add past-tense token set if Pattern 5 chooses "reconcile-* tokens" path
```

### Pattern 1: Lifecycle hook with ctx access (resolves the feasibility question)

**What:** The current `resources_discover` handler in `index.ts` uses an `unknown` cast that hides the `ctx` parameter. The Pi API actually dispatches `(event, ctx)`. Phase 55 binds both.

**Source:** `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:802`:
```ts
export type ExtensionHandler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;
```
and `:808`:
```ts
on(event: "resources_discover", handler: ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>): void;
```
[CITED: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`]

**Implication:** ZERO need for a sink-capture-at-session-start trick. ZERO need for queued messages. The CONTEXT's "feasibility spike" is moot — the wiring is direct.

**Example:**
```ts
// index.ts after edit
import type { ResourcesDiscoverEvent, ResourcesDiscoverResult, ExtensionContext } from "./platform/pi-api.ts";
import { applyReconcile } from "./orchestrators/reconcile/apply.ts";

pi.on("resources_discover", async (event: ResourcesDiscoverEvent, ctx: ExtensionContext): Promise<ResourcesDiscoverResult> => {
  // RECON-01..06: apply BEFORE discovery so the same /reload picks up new artefacts.
  // Catastrophic failure must NEVER block Pi load (NFR-2) — wrap the whole call.
  try {
    await applyReconcile({ ctx, pi, cwd: event.cwd });
  } catch (err) {
    // Last-ditch: emit a single error notify and continue. NFR-2: never throw past the handler.
    ctx.ui.notify(`reconcile aborted: ${(err as Error).message}`, "error");
  }
  // Existing discovery runs unchanged.
  const discovered = await aggregateDiscoveredResources(
    locationsFor("user", homedir()),
    locationsFor("project", event.cwd),
  );
  return { skillPaths: [...discovered.skillPaths], promptPaths: [...discovered.promptPaths] };
});
```

### Pattern 2: Migrate-then-load-then-plan INSIDE the per-scope lock (resolves Pitfalls 52-2 + 52-4)

**What:** All three steps run inside a single `withStateGuard` closure that touches `state.json`. The lock is released BEFORE the apply loop runs.

**Why:** Pitfall 52-2 (concurrent first-load race on `migrateFirstRunConfig`): two processes both see `claude-plugins.json` ENOENT, both write. The lock serializes them — the first wins and writes; the second sees `valid` and short-circuits per the trichotomy (Pitfall 52-5).

Pitfall 52-4 (D-13 gate race): `loadState` synchronously probes `existsSync(configJsonPath)` at line 200 of `state-io.ts` to decide whether to scrub legacy `autoupdate`. If `migrateFirstRunConfig` runs BEFORE `loadState` in the same process but AFTER another process's write, the gate flips between processes. The lock ensures the gate observation matches the data the same process will operate on.

**ORDER INSIDE THE LOCK CLOSURE — Pitfall 52-4 forces this exact sequence:**

```ts
await withStateGuard(loc, async (state) => {
  // state was just loaded by withStateGuard — `existsSync(configJsonPath)` was
  // observed AT loadState time. If the config was absent, `state` retains the
  // legacy autoupdate field; if present, the field was scrubbed.
  //
  // migrate AFTER loadState (within the same lock holder) is correct because:
  //   - on absent: state still has autoupdate; migrate captures it; saves config
  //   - on valid: migrate short-circuits (Pitfall 52-5)
  await migrateFirstRunConfig(loc, state);

  // loadMergedScopeConfig now sees either the just-written config OR the
  // pre-existing one. Either way, NOT ENOENT — every reconcile sees a real
  // desired state.
  const outcome = await loadMergedScopeConfig(loc);
  // ... CFG-03 check, planReconcile ...
});
```

**Pitfall 52-4 deferred test:** `tests/persistence/migrate-config.test.ts:29-39` explicitly says this load-wiring belongs to Phase 55. The Phase 55 plan MUST land a populated-state-fixture integration test that proves the convergence proof from inside a real `withStateGuard`. [VERIFIED: file inspected]

### Pattern 3: No outer lock around the apply loop (the CR-01 lesson)

**What:** The apply loop drives the existing per-scope-locked orchestrators serially WITHOUT wrapping them in an additional outer `withStateGuard`. Each driven orchestrator already opens its own per-scope lock.

**Why:** `proper-lockfile` with `retries: 0` is NOT re-entrant on the same lockfile path. Nesting `withStateGuard(loc, ... installPlugin(...) ...)` self-deadlocks because `installPlugin` calls `withStateGuard(loc, ...)` again with the same `stateLockFile`. Phase 54 Plan 02 hit this exact class (CR-01) and the fix was to call the guard-FREE `runInstallLedger` inside an outer `withLockedStateTransaction`. Phase 55 does NOT have a single transaction — it drives N orchestrators serially. The right pattern is the OPPOSITE: NO outer lock; let each orchestrator own its lock.

**Source:** `enable-disable.ts:11-19` documents the CR-01 lesson; `with-state-guard.ts:111-153` documents the non-reentrant lock. [VERIFIED]

**Consequence:** Between two driven orchestrators in the apply loop, another process could acquire the lock briefly. That is correct — the orchestrators are individually idempotent / fail-clean (NFR-3), so racing on a single entry produces either a winner-with-record + loser-with-`ELOCKED -> StateLockHeldError`, or two no-op skips, or the planner runs again on the next reload and converges. The convergence proof (RECON-05) guarantees this.

### Pattern 4: Continue-on-failure per item (RECON-03 + NFR-5 soft-fail)

**What:** Wrap each driven orchestrator call in a try/catch. On failure, record the entry as failed (with classified reason) and continue. Never let one entry's failure stop the loop.

**Why:** RECON-03 mandates soft-fail per entry; NFR-5 says network failures during load-time reconcile soft-fail. The existing orchestrators in their command-mode `notify()` paths ALREADY emit a structured failed row themselves. Phase 55 needs an orchestrated mode (suppress notify, return structured outcome) — `installPlugin` already supports this via `InstallPluginNotifications = { mode: "orchestrated" }`. The other orchestrators do NOT. **This is the chief code-design tension of Phase 55.**

**Two implementation strategies — pick ONE in plan:**

| Strategy | What | Pros | Cons |
|----------|------|------|------|
| **A: per-orchestrator try/catch in apply.ts** | apply.ts wraps each call; catches the orchestrator's `notify` side effect by injecting a NULL ctx OR a ctx whose `ui.notify` captures-and-discards | Zero changes to existing orchestrators | Two paths to a notify call (the real ctx for the cascade; the swallowed ctx in the apply loop); fragile, easy to leak rows |
| **B: add `notifications: "orchestrated"` mode to all driven orchestrators (mirror install.ts)** | Each orchestrator gains a `mode` option; in orchestrated mode it returns a structured outcome instead of calling notify | Clean separation; one source of cascade rows | Touches `addMarketplace`, `removeMarketplace`, `uninstallPlugin`, `setPluginEnabled`; bigger diff |

**Recommendation: Strategy B.** Mirror the precedent already set by `installPlugin` (Phase 19) and supported by Phase 54's `runInstallLedger` extraction. Adding a uniform `notifications: { mode: "orchestrated" }` (default `"standalone"`) makes the apply path's contract: "I drive your orchestrator; you do the work and tell me what happened; I render." This matches D-19-01 / IL-2 across the whole project.

### Pattern 5: Past-tense token set OR reuse existing transition tokens (closed-set lockstep)

**What:** Phase 53 added 6 `will *` pending-tense tokens for the preview. Phase 55 needs to render the APPLIED form: "this marketplace WAS added", "this plugin WAS installed", etc. Two options:

| Option | Tokens used by apply cascade | Pros | Cons |
|--------|------------------------------|------|------|
| **A: reuse existing transition tokens** (`installed`, `uninstalled`, `added`, `removed`, `disabled`, current `failed`/`skipped`) | No new STATUS_TOKENS members; no new variants | No catalog/UAT lockstep work; smaller diff; convergence with command-surface bytes | Cascade emission context is indistinguishable from a user-typed command's emission — RECON-04 might want a header banner |
| **B: add new tokens** (e.g. `reconciled`, or a header-only banner variant) | Phase 55 cascades are visually distinct from command cascades | Honest signaling of "this came from auto-reconcile" | Catalog + FIXTURES + length-locks + grammar invariant all in one atomic commit (Pitfall 53-3 / atomic-supersession) |

**Recommendation: Option A** — reuse existing tokens. RECON-04 mandates the EXISTING cascade grammar; it does NOT mandate a new visual marker. The header banner (CONTEXT mentions "a reconcile-summary header") is a candidate for a NEW STANDALONE variant alongside the cascade — e.g. an info-severity prefix line like `Auto-reconciled on load.` rendered BEFORE the cascade body when the cascade is non-empty. That variant is one new arm with no new STATUS_TOKENS; it lockstep-lands with one catalog state + one FIXTURES entry, mirroring how `reconcile-preview-empty` landed in Phase 53.

**Concrete plan-checker hooks:**
- If Phase 55 introduces ANY new STATUS_TOKEN / PLUGIN_STATUS / MARKETPLACE_STATUS, REASONS, or MARKERS literal: every catalog state + UAT fixture + length-lock + grammar invariant test MUST update in the SAME commit. Atomic-supersession (Pitfall 53-3) is hard-enforced.
- The empty-steady-state path (zero plan actions across both scopes) should EITHER emit ZERO notify (silent successful load — favored for NFR-2 "never block / never spam load") OR reuse the Phase 53 `reconcile-preview-empty` variant with a tweaked body. Plan must choose.

**`shouldEmitReloadHint` discipline:** the apply cascade rendered by Phase 55 emits POST-transition transition tokens (`installed`, `uninstalled`, etc.) that today DO trigger the `/reload to pick up changes` trailer. **For load-time reconcile the trailer would be a lie** — the reconcile already ran, the reload was the trigger. Either:
- (a) the apply orchestrator emits a NEW kind variant whose `shouldEmitReloadHint` arm hard-returns `false` (mirrors the Phase 53 preview's variant treatment); OR
- (b) the body is wrapped in a banner variant whose `kind` short-circuits the trailer.

Option (a) is the cleanest: introduce a `reconcile-applied-cascade` discriminated variant whose payload IS a `CascadeNotificationMessage`-shape but whose `shouldEmitReloadHint` arm is `false`. Existing renderer arms reuse the per-mp/per-plugin row renderers. ONE new variant + ONE new renderer dispatch arm + ONE new catalog H2 section + ONE new FIXTURES entry minimum.

### Pattern 6: Ownership/provenance guard (RECON-02)

**What:** Phase 55 must remove ONLY entries the extension manages. "Managed" = recorded in `state.json`.

**Where it's already enforced:** `planReconcile` already gates `marketplacesToRemove` on "recorded but not declared" — it can't emit a `PlannedMarketplaceRemove` for a marketplace not in `state.marketplaces`. Same for `pluginsToUninstall`. **The provenance guard IS the planner.** [VERIFIED: `reconcile/plan.ts` types in `reconcile/types.ts:59-78`]

**No additional code needed.** Phase 55's apply step trusts the planner. Test in Phase 55: a fixture where state.json records only `mp-a`/`plugin-a` but a hand-edited config drops them and adds `mp-b`/`plugin-b` MUST produce a plan that removes mp-a/plugin-a AND adds mp-b/plugin-b — never touching anything not in state.

### Pattern 7: Two-process simultaneous-start test (RECON-06)

**What:** Spawn two child processes that both call `applyReconcile` against the SAME scope simultaneously. Assert: (i) no double-apply (state.json shows ONE successful install of plugin X, not two); (ii) no interleaved write (state.json's mtime/serialization is sane); (iii) at least one process reports success, the other reports `(failed) {lock held}` or a benign no-op skip.

**Prior art:** `tests/integration/concurrent-install.test.ts:120-176` uses `child_process.fork(CHILD_PATH, [], { stdio: ["ignore", "ignore", "ignore", "ipc"] })` with the IPC channel for ready-sync + result-collection. Phase 55 plan reuses this pattern with a child entry point that calls `applyReconcile` instead of `installPlugin`. [VERIFIED]

**Why this matters:** `applyReconcile`'s per-scope read pass uses `withStateGuard`; one process wins, the other gets `ELOCKED -> StateLockHeldError`. The apply loop is then loser-process empty (nothing to do — winner already converged). On the next reload, both converge to zero. The test fixture should be a single declared marketplace + single plugin both ABSENT from state, both processes attempt apply, exactly one wins.

### Anti-Patterns to Avoid

- **Outer lock around the apply loop.** Will self-deadlock on the first driven orchestrator (`addMarketplace` opens its own `withStateGuard`). CR-01 class. [VERIFIED: Phase 54 Plan 02 SUMMARY]
- **Calling `installPlugin` from inside a guarded transaction in apply.ts.** Same self-deadlock vector. Use the un-guarded `runInstallLedger` ONLY if Phase 55 owns a transaction; otherwise use the guarded `installPlugin` at top level (NO outer guard).
- **Letting any orchestrator's failure throw past `applyReconcile`.** RECON-03 / NFR-2: must never block Pi load.
- **Emitting `/reload to pick up changes` trailer.** Reconcile already ran. Use the new variant path (Pattern 5 Option (a)).
- **Touching files NOT in state.json.** RECON-02. The planner is the gate — do NOT add a secondary path in apply.ts that walks `agentsDir` looking for stale files. Untouched.
- **Suppressing the cascade when it's empty AND emitting a verbose "all good" banner.** Silent on no-op is the NFR-2 friendliest path. The user CAN run `/claude:plugin preview` if they want to see "0 actions".
- **Writing to state.json from the apply loop directly.** Every state mutation MUST go through one of the driven orchestrators (each owns its lock + saveState). SPLIT-02 invariant.
- **Re-rendering the preview's `will *` tokens from the apply cascade.** Those are pending-tense. The apply cascade renders post-transition transitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-process state synchronization | Custom lock file / flock / fcntl | `withStateGuard` (already wraps `proper-lockfile`) | Battle-tested at Phase 7; CR-01-class deadlocks already mapped |
| Plan computation | Custom diff in apply.ts | `planReconcile` (Phase 53) | Phase 53 already proved convergence + provenance |
| Migration | Re-derive config from state in apply.ts | `migrateFirstRunConfig` (Phase 52) | Already lossless + idempotent + ENOENT-gated |
| Sink capture / queued messages | Module-level captured ctx singleton + flush-on-first-use | `ctx` parameter on `resources_discover` handler | The Pi API already provides it (see `types.d.ts:802`) |
| Per-entry notify emission | Call `notify()` once per orchestrator outcome | Accumulate outcomes; emit ONE notify with `CascadeNotificationMessage` | IL-2: one notify per state change; multiple notifies will spam the user |
| Reload-hint suppression | Strip `/reload to pick up changes` post-hoc | A new variant `kind` whose `shouldEmitReloadHint` arm is `false` | Phase 53 pattern: structurally correct, not a string-replace hack |

**Key insight:** Phase 55 is a CONNECT-THE-WIRES phase. Every primitive exists. The plan-time risk is over-engineering (queued messages, sink capture, custom diff) when the Pi API and the existing seams already compose. Resist the urge to add infrastructure.

## Runtime State Inventory

**Not applicable to this phase.** Phase 55 is a greenfield orchestrator addition, not a rename/refactor/migration. The migrate-then-reconcile ordering rail handles the one piece of cross-version state lineage (legacy `autoupdate` field), and Phase 52 already solved its lossless capture.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 55 mutates only via existing orchestrators, never directly | None |
| Live service config | None — extension is in-process; no daemons | None |
| OS-registered state | None — no installers, no scheduled tasks, no OS hooks | None |
| Secrets/env vars | None — Phase 55 reads no secrets; per-entry network failures use existing platform/git which has Phase 31-36's AUTH path | None |
| Build artifacts | None — pure code change | None |

## Common Pitfalls

### Pitfall 1: `resources_discover` handler signature loses ctx

**What goes wrong:** Phase 55 wires up `apply.ts` but the index.ts handler still has `(event) =>` and the apply orchestrator can't get a `ctx` to notify with.

**Why it happens:** The current handler in `index.ts:16-19` uses an `unknown` cast (`pi.on.bind(pi) as unknown as ...`) that elides the 2nd parameter. A plan reader could miss that `resources_discover` actually CARRIES `ctx`.

**How to avoid:** Drop the cast. Restore the natural signature. Verify against `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:802`. The current handler's narrow signature was a Phase 1-7 simplification; Phase 55 widens it.

**Warning signs:** Plan task referencing "queued ctx" or "session_start sink capture". Both are unnecessary.

### Pitfall 2: Migrate-then-load-then-plan order inverted

**What goes wrong:** If apply.ts calls `loadState` BEFORE `migrateFirstRunConfig`, the D-13 gate fires WHATEVER way `existsSync` reports — typically scrubbing the legacy autoupdate BEFORE Phase 52 can capture it. The capture is lost permanently.

**Why it happens:** Mechanical reading of "migrate-then-reconcile" misses that migrate must come BEFORE loadState's existsSync probe — which means migrate is `withStateGuard`'s caller, not its closure body. BUT: `withStateGuard` itself runs `loadState` internally before handing state to the closure. So migrate runs AFTER loadState within the same closure on the FIRST load — and that's CORRECT, because loadState ran with `existsSync(configJsonPath) === false` (config doesn't exist yet), so the legacy autoupdate is preserved in the in-memory `state`. The migrate closure then captures it from the in-memory state and writes the config.

**How to avoid:** Plan the closure body as `migrate(loc, state)` -> `loadMergedScopeConfig(loc)` -> `planReconcile(...)`. The D-13 gate's correctness is guaranteed because `withStateGuard` already called `loadState` (which observed config absent) before the closure runs.

**Warning signs:** A plan task that calls `loadState` outside `withStateGuard` then "later" wraps in a guard. The probe was already taken.

### Pitfall 3: Nested lock from driving installPlugin under withStateGuard

**What goes wrong:** apply.ts wraps the per-entry loop in `withStateGuard(loc, ...)`, calls `installPlugin(opts)`, and self-deadlocks because installPlugin opens its own guard on the same `stateLockFile`.

**Why it happens:** Plan author thinks "I want one lock per scope across the whole apply pass" — natural transactional thinking from earlier phases.

**How to avoid:** Either (a) drive the un-guarded `runInstallLedger` from inside `withLockedStateTransaction` (mirror Phase 54 Plan 02 setPluginEnabled), OR (b) drive the guarded `installPlugin` from NO outer lock (Phase 55's correct path). Use (b). See Pattern 3.

**Warning signs:** Plan task says "open scope lock; for each plan entry call installPlugin". CR-01.

### Pitfall 4: shouldEmitReloadHint emits "Run /reload" trailer on reconcile apply

**What goes wrong:** Apply cascade emits `installed`/`uninstalled`/etc. transition tokens. `shouldEmitReloadHint` returns true for them. The user sees "Run /reload to pick up changes" — but the reconcile already ran on /reload. The trailer is a lie.

**Why it happens:** Reusing existing transition tokens without considering the dispatch context.

**How to avoid:** New `kind` variant (`reconcile-applied-cascade` or similar) wraps the cascade payload. `shouldEmitReloadHint` arm for this kind is `false`. Same mechanic Phase 53 used for `reconcile-preview-empty`.

**Warning signs:** Plan asserts `(installed)` rows but doesn't mention a new variant.

### Pitfall 5: addMarketplace's network failure crashes the apply loop

**What goes wrong:** `addMarketplace` throws on git clone failure for a GitHub-source marketplace declared-but-missing. The throw propagates out of apply.ts past `resources_discover` and into Pi runtime.

**Why it happens:** `addMarketplace` in its production path catches the enumerated precondition errors (Phase 48 ATTR-07) BUT a catastrophic git error not in the closed set re-throws. `addMarketplace`'s `rethrowPreconditionErrors` flag changes behavior for bootstrap composition; apply.ts is a DIFFERENT composer that needs full catch-and-record-as-failed-entry.

**How to avoid:** apply.ts's per-entry try/catch is wide. Catch `unknown`, classify via existing `narrowProbeError`/`classifyAddError` ladders, record as failed entry, continue. Strategy B (Pattern 4) is cleaner because the orchestrator returns a structured outcome instead of throwing.

**Warning signs:** Plan task `await addMarketplace(opts)` with no try/catch.

### Pitfall 6: Non-empty config but state.json missing -> apparent mass install on first reload

**What goes wrong:** First reload after a `git pull` lands a committed `claude-plugins.json` listing 10 marketplaces + 30 plugins. `state.json` does not exist. Reconcile interprets this as 10 adds + 30 installs and races them all in series, taking 30+ seconds and emitting a huge cascade.

**Why it happens:** Correct behavior! Working as designed. But operators expecting a quick reload may interpret the long pause as a hang.

**How to avoid:** Plan a UX/notification consideration: a header banner emitted BEFORE the apply loop saying "Reconciling N marketplaces, M plugins from claude-plugins.json..." (info severity, no trailer) so the operator knows what's happening. THEN the cascade. This composes well with Pattern 5 Option (a)'s new variant.

**Warning signs:** Plan ignores the bulk-first-checkout scenario.

### Pitfall 7: invalid base AND invalid local across both scopes -> abort path doesn't render summary

**What goes wrong:** All four config files are invalid. apply.ts has no plans to act on; the empty-steady-state path emits `reconcile-applied-empty` or silence — masking the four invalid configs.

**Why it happens:** CFG-03 abort produces invalid-config rows but the cascade emission may be conditional on having SOME action to report.

**How to avoid:** Mirror Phase 53 preview.ts: invalid-config rows ARE the action — even with zero plan buckets per scope, the cascade has `(failed) {invalid manifest}` rows that drive a non-empty notify with `error` severity. Plan reviewer: every code path through apply.ts must terminate in either notify(cascade-with-rows) OR notify(empty-variant) OR notify(nothing-at-all). NEVER silently drop CFG-03 abort.

**Warning signs:** Empty-check uses only `isReconcilePlanListEmpty` without considering invalid blocks.

### Pitfall 8: Apply loop ordering — removes BEFORE installs vs after

**What goes wrong:** Plan adds mp-a + installs plugin-a@mp-a; plan removes mp-b + uninstalls plugin-b@mp-b. If installs run first, an apparent state expansion happens before contraction — peak disk usage spikes briefly. If removes run first and one fails, the new install runs against the wrong-version cache. Idempotency means it converges either way, but the optimal order matters.

**Why it happens:** Existing orchestrators don't dictate an order.

**How to avoid:** Recommend the order **uninstall -> remove -> add -> install -> enable -> disable** in the plan (mirroring the data dependency: marketplace must exist before plugin install; plugin uninstall before marketplace remove). Document in apply.ts header. Source-mismatch entries (no action) are emitted to the cascade only.

**Warning signs:** Plan picks an order without justifying it.

### Pitfall 9: applyReconcile is called BEFORE pi has finished loading other extensions

**What goes wrong:** `pi-subagents` / `pi-mcp-adapter` may not be loaded when `resources_discover` fires; `softDepStatus(pi)` returns `false` for both; per-row markers emit `{requires pi-subagents}` even though pi-subagents IS installed but loaded later.

**Why it happens:** Extension load order is not guaranteed. The current `index.ts` calls `softDepStatus(pi)` at notify time, not at registration time, so this is already handled — BUT only if `resources_discover` fires AFTER all extensions are loaded.

**How to avoid:** Check whether the Pi runtime guarantees `resources_discover` is fired after the extension factory functions all return. If not, defer the cascade emission until after a microtask or until `session_start`. Verify against `pi-coding-agent` internals at plan time.

**Warning signs:** Plan asserts `softDepStatus` at handler invocation without considering load order.

### Pitfall 10: Two-process race test flake — both processes win because lock release was too fast

**What goes wrong:** Process A acquires lock, runs migrate + plan (microseconds for a small fixture), releases. Process B acquires lock (still microseconds later), runs migrate + plan against the now-converged state — empty plan. Both succeed; neither reports `(failed) {lock held}`. Test asserts "exactly one winner" and fails intermittently.

**Why it happens:** The two-process race is INSIDE the read pass (migrate + plan), not the apply pass. The read pass is fast. The apply pass has no shared lock, so each process drives its own per-entry locks in parallel — and the planner's `marketplacesToAdd` is already empty for the loser.

**How to avoid:** The test does NOT need to prove "exactly one winner". It needs to prove "no double-apply, no interleaved write, state.json is sane". Assert state.json content is consistent (one mp-a record, one plugin-a record, no orphaned data) regardless of which process reported the action. Or: use a barrier (slow down migrate with a deliberate await) to force interleaving.

**Warning signs:** Test design copies concurrent-install.test.ts byte-for-byte without considering the read-pass-fast-vs-apply-pass-slow asymmetry.

## Code Examples

### Apply orchestrator skeleton (the load-bearing shape)

```ts
// extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
//
// RECON-01..06 (Phase 55). Load-time apply of the Phase 53 ReconcilePlan.
//
// NOT in FORBIDDEN_TARGETS — this orchestrator NEEDS network (via addMarketplace
// for declared-but-missing GitHub-source marketplaces). NFR-5 is satisfied
// PER-ENTRY at the apply seam: each driven orchestrator's network failure is
// caught and recorded as a failed entry; the failure NEVER crosses the
// resources_discover boundary.
//
// Locking: per-scope READ pass under withStateGuard (migrate + load + plan);
// per-entry APPLY pass with NO outer lock (each driven orchestrator opens its
// own per-scope lock). CR-01 lesson (Phase 54): nested locks deadlock.
//
// Ordering: migrate-then-load-then-plan INSIDE the scope lock (Pitfalls 52-2,
// 52-4). Per-entry order: uninstall -> remove -> add -> install -> enable ->
// disable (data-dependency order).
//
// Emission: ONE notify() per applyReconcile call (IL-2). Empty + non-CFG-03:
// silent (NFR-2 friendly). Non-empty: a CascadeNotificationMessage wrapped in
// a new `reconcile-applied-cascade` variant whose shouldEmitReloadHint arm
// returns false (Pitfall 4).

import path from "node:path";
import { homedir } from "node:os";

import { migrateFirstRunConfig } from "../../persistence/migrate-config.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { addMarketplace } from "../marketplace/add.ts";
import { removeMarketplace } from "../marketplace/remove.ts";
import { installPlugin } from "../plugin/install.ts";
import { uninstallPlugin } from "../plugin/uninstall.ts";
import { setPluginEnabled } from "../plugin/enable-disable.ts";
import { planReconcile } from "./plan.ts";

import type { ReconcilePlan } from "./types.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

export interface ApplyReconcileOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;  // event.cwd from resources_discover
}

export async function applyReconcile(opts: ApplyReconcileOptions): Promise<void> {
  const userLoc = locationsFor("user", homedir());
  const projectLoc = locationsFor("project", opts.cwd);

  const perScope: PerScopeResult[] = [];
  for (const loc of [projectLoc, userLoc]) {
    perScope.push(await applyScope(opts, loc));
  }

  emitCascade(opts.ctx, opts.pi, perScope);
}

async function applyScope(opts: ApplyReconcileOptions, loc: ScopedLocations): Promise<PerScopeResult> {
  // Read pass — single locked closure migrates, loads merged config, plans.
  let plan: ReconcilePlan | undefined;
  let invalidBlocks: InvalidConfigBlock[] = [];
  try {
    plan = await withStateGuard(loc, async (state) => {
      await migrateFirstRunConfig(loc, state);  // Pitfall 52-2 lock-covered; Pitfall 52-4 D-13 gate observed pre-write
      const outcome = await loadMergedScopeConfig(loc);
      if (outcome.base.status === "invalid") invalidBlocks.push(toInvalidBlock(loc.scope, outcome.base.filePath));
      if (outcome.local.status === "invalid") invalidBlocks.push(toInvalidBlock(loc.scope, outcome.local.filePath));
      if (outcome.base.status === "invalid" || outcome.local.status === "invalid") {
        return undefined;  // CFG-03 abort: NO plan for this scope
      }
      return planReconcile(outcome.merged, state, loc.scope);
    });
  } catch (err) {
    // Lock-held / unparseable state / etc. Per-scope failure DOES NOT cross the boundary.
    return { scope: loc.scope, invalidBlocks, outcomes: [], readPassFailure: err };
  }

  if (plan === undefined) {
    // CFG-03 invalid arm
    return { scope: loc.scope, invalidBlocks, outcomes: [] };
  }

  // Apply pass — NO outer lock. Each driven orchestrator owns its own per-scope lock.
  const outcomes: PerEntryOutcome[] = [];
  // Data-dependency order: uninstall -> remove -> add -> install -> enable -> disable.
  for (const u of plan.pluginsToUninstall) outcomes.push(await driveUninstall(opts, u));
  for (const r of plan.marketplacesToRemove) outcomes.push(await driveRemove(opts, r));
  for (const a of plan.marketplacesToAdd) outcomes.push(await driveAdd(opts, a));         // NETWORK; soft-fail
  for (const i of plan.pluginsToInstall) outcomes.push(await driveInstall(opts, i));      // NETWORK; soft-fail
  for (const e of plan.pluginsToEnable) outcomes.push(await driveEnable(opts, e));
  for (const d of plan.pluginsToDisable) outcomes.push(await driveDisable(opts, d));
  for (const m of plan.sourceMismatches) outcomes.push(toMismatchOutcome(m));            // report-only

  return { scope: loc.scope, invalidBlocks, outcomes };
}

async function driveAdd(opts: ApplyReconcileOptions, a: PlannedMarketplaceAdd): Promise<PerEntryOutcome> {
  try {
    // Phase 55 task: extend addMarketplace with notifications: { mode: "orchestrated" }
    // so it returns a structured outcome instead of calling notify. Until then,
    // either capture-and-discard ctx OR use try/catch wide.
    await addMarketplace({
      ctx: opts.ctx, pi: opts.pi, scope: a.scope, cwd: opts.cwd, rawSource: a.source,
      // ... see Pattern 4 Strategy B
    });
    return { kind: "added", scope: a.scope, marketplace: a.marketplace };
  } catch (err) {
    return { kind: "add-failed", scope: a.scope, marketplace: a.marketplace, reason: classify(err) };
  }
}

// ... similar for drive{Install, Uninstall, Remove, Enable, Disable} ...

function emitCascade(ctx: ExtensionContext, pi: ExtensionAPI, perScope: PerScopeResult[]): void {
  // Empty? NFR-2 friendly: silent. CFG-03 abort blocks are NOT empty.
  if (perScope.every(s => s.invalidBlocks.length === 0 && s.outcomes.length === 0)) {
    return;
  }
  const message = buildAppliedCascade(perScope);  // new variant; shouldEmitReloadHint -> false
  notify(ctx, pi, message);
}
```
[VERIFIED: skeleton structure follows existing patterns in `reconcile/preview.ts`, `plugin/uninstall.ts`, `marketplace/add.ts`]

### resources_discover handler edit (the wiring)

```ts
// extensions/pi-claude-marketplace/index.ts (edit)
import { applyReconcile } from "./orchestrators/reconcile/apply.ts";
import type { ExtensionContext } from "./platform/pi-api.ts";  // already exported

pi.on("resources_discover", async (event, ctx) => {  // ctx now bound
  try {
    await applyReconcile({ ctx, pi, cwd: event.cwd });
  } catch (err) {
    // Last-ditch boundary — NFR-2: NEVER throw past resources_discover.
    try { ctx.ui.notify(`reconcile aborted: ${(err as Error).message}`, "error"); } catch {}
  }
  const discovered = await aggregateDiscoveredResources(
    locationsFor("user", homedir()),
    locationsFor("project", event.cwd),
  );
  return { skillPaths: [...discovered.skillPaths], promptPaths: [...discovered.promptPaths] };
});
```
[VERIFIED: pattern from `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:802`]

### Two-process race test skeleton (RECON-06)

```ts
// tests/integration/load-reconcile-race.test.ts (NEW)
// Mirrors tests/integration/concurrent-install.test.ts's fork(CHILD_PATH) pattern.
import { fork } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
// ... helpers to spin up two temp HOMEs sharing a single project cwd ...

test("RECON-06: two simultaneous load-time reconciles converge without double-apply", async () => {
  // Fixture: declared mp-a + plugin-a, state.json empty.
  // Both processes call applyReconcile; both attempt to add mp-a + install plugin-a.
  // Expectation: state.json ends with exactly one mp-a record + one plugin-a record;
  // no agents-index.json corruption; no orphaned staging dirs.
  // ...
});
```
[VERIFIED: prior art at `tests/integration/concurrent-install.test.ts:125`]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 (pre-v1.12) state.json was authoritative; no config file | Phase 51-54 split: config = desired state; state = bookkeeping | v1.12 (2026-06-09 onwards) | Phase 55 is the apply step that closes the loop |
| Phase 53 preview emits `will *` pending-tense tokens; no apply path | Phase 55 apply emits `installed`/`uninstalled`/etc. transition tokens (or new variant) | Phase 55 (this phase) | Two phases share `reconcile/notify.ts` projection seam |
| `installPlugin` had ONE mode (standalone notify) | Phase 19 added `notifications: "orchestrated"` mode | Phase 19 | Precedent for Phase 55 to add same mode to add/remove/uninstall/enable-disable |
| Nested locks via `withStateGuard` inside other guards | Phase 54 CR-01: extracted `runInstallLedger` guard-FREE; called inside `withLockedStateTransaction` | Phase 54 Plan 02 (2026-06-10) | Phase 55 takes the OPPOSITE path: NO outer lock |

**Deprecated/outdated:**
- `pi.on.bind(pi) as unknown as ...` cast in index.ts — Phase 55 removes it; the real signature provides `ctx`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `resources_discover` is fired AFTER all other extensions have completed their factory functions | Pitfall 9 | If wrong, `softDepStatus(pi)` returns stale `false` at notify time and the cascade emits spurious `{requires pi-subagents}` markers. Mitigation: plan a sanity check at plan-time against `pi-coding-agent` internals. |
| A2 | Strategy B (adding `notifications: "orchestrated"` mode to `addMarketplace`/`removeMarketplace`/`uninstallPlugin`/`setPluginEnabled`) is acceptable scope for Phase 55 | Pattern 4 | If too large for one phase, fall back to Strategy A (try/catch + capturing ctx). Both work; B is cleaner. |
| A3 | Header banner / new `reconcile-applied-cascade` variant is the right shape (vs. a free-standing prefix line) | Pattern 5 Option (a) | If wrong, plan picks Strategy A simpler reuse path — but then must solve the `/reload` trailer suppression separately. |
| A4 | The empty-steady-state path should be SILENT (no notify) for NFR-2 friendliness | Pattern 5 / Pitfall 6 | If operator wants confirmation, Pattern 5 Option (a) trivially extends with an empty-variant emission. Either is valid; this is UX preference. |
| A5 | Per-entry apply order `uninstall -> remove -> add -> install -> enable -> disable` is optimal | Pitfall 8 | Idempotency means convergence works in any order; ordering affects only peak disk + interim cascade rendering. Low risk. |

**Confirmation candidates for human review at discuss-phase (skipped here per workflow.skip_discuss):**
- A2 (Strategy A vs B): code-review scope decision
- A3 (variant shape): grammar/catalog decision
- A4 (silent vs banner on empty): UX preference

## Open Questions (RESOLVED)

1. **Apply-pass orchestrator mode (Strategy A vs Strategy B from Pattern 4)?**
   - What we know: `installPlugin` already supports orchestrated mode; pattern can be replicated cleanly across `addMarketplace`/`removeMarketplace`/`uninstallPlugin`/`setPluginEnabled`.
   - What's unclear: whether this is acceptable scope expansion for one phase (it's 4 orchestrator touches + their tests, on top of the apply.ts + index.ts + new notify variant).
   - Recommendation: plan Strategy B; if granularity gate fails at plan-check, split into two phases (apply skeleton + orchestrator mode extensions). Both phases compose without lock-step risk because each orchestrator's mode is purely additive.
   - RESOLVED: Strategy B adopted — Plan 55-01 extends orchestrated mode across all four orchestrators; plan-check granularity passed.

2. **Empty-load notification policy — silent or banner?**
   - What we know: NFR-2 says reconcile must never block load; the silent path is friendliest.
   - What's unclear: whether operators want a "reconciliation: no changes" confirmation on every reload.
   - Recommendation: silent on zero-action zero-failure. Operators run `/claude:plugin preview` if they want explicit confirmation.
   - RESOLVED: silent on zero-action zero-failure loads (Plan 55-02 must_haves truth #5).

3. **New variant `reconcile-applied-cascade` vs. reusing existing cascade with a header line prepended?**
   - What we know: Phase 53 uses a dedicated variant for `reconcile-preview-empty` and that's the locked precedent.
   - What's unclear: whether a separate variant is needed for the NON-empty applied cascade if it reuses existing transition tokens.
   - Recommendation: yes — the variant is justified by the `shouldEmitReloadHint` discipline (Pitfall 4). One new arm + one new renderer dispatch.
   - RESOLVED: new `reconcile-applied-cascade` StandaloneKind variant (Plan 55-02 Task 1), structurally excluded from the reload-hint ladder.

4. **What if `softDepStatus(pi)` is unreliable at `resources_discover` time?**
   - What we know: notify currently calls `softDepStatus(pi)` once per render, reading `pi.getAllTools()`.
   - What's unclear: load-order guarantees (Assumption A1).
   - Recommendation: plan-time spike — examine pi-coding-agent loader to confirm. If unreliable, defer Phase 55's apply to `session_start` (which also fires on reload per `SessionStartEvent.reason: "startup" | "reload" | ...`) and emit the cascade then. BUT: `session_start` does NOT carry `event.cwd` — would need to capture cwd from `resources_discover` first. Adds complexity; prefer to confirm A1 first.
   - RESOLVED: A1 sanity check is the first execution step of Plan 55-02 Task 2 — executor STOPS and surfaces the finding if A1 is refuted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | runtime | ✓ | 22.x+ (per NFR-4) | — |
| `@earendil-works/pi-coding-agent` | Pi extension API | ✓ | 0.79.0 (dev/peer) | — |
| `proper-lockfile` | per-scope cross-process lock | ✓ | 4.1.2 | — |
| `write-file-atomic` | atomic JSON writes | ✓ | 8.0.0 | — |
| Network (GitHub https) | `addMarketplace` declared-but-missing for GitHub source | conditional | — | Per-entry soft-fail (NFR-5); failed entry reported in cascade, load continues |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** GitHub HTTPS reachability for declared-but-missing GitHub-source marketplaces — RECON-03 mandates the soft-fail-per-entry pattern, which is exactly the fallback.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, stable since Node 20) |
| Config file | none — invoked via `node --test` and tsx loader (per package.json `test` script) |
| Quick run command | `npm test -- tests/orchestrators/reconcile/apply.test.ts` |
| Full suite command | `npm run check` (typecheck + lint + format + 1662+ unit + 7 integration) |
| Phase gate | `npm run check` GREEN end-to-end |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECON-01 | declared-but-missing -> automatic add+install at load | unit (orchestrator) | `node --test tests/orchestrators/reconcile/apply.test.ts` | ❌ Wave 0 |
| RECON-02 | installed-but-undeclared -> automatic remove+uninstall, scoped to managed entries | unit (orchestrator) — fixture with extra state record NOT in config | `node --test tests/orchestrators/reconcile/apply.test.ts` | ❌ Wave 0 |
| RECON-03 | Per-entry network failure soft-fails; rest of pass continues; never blocks load | unit (orchestrator) — inject failing gitOps via DI; assert cascade has failed row + remaining outcomes succeeded | `node --test tests/orchestrators/reconcile/apply.test.ts` | ❌ Wave 0 |
| RECON-04 | Cascade through `notify()` in catalog-conformant grammar; NO `/reload` hint | unit (notify-v2 byte) + grammar invariant | `node --test tests/shared/notify-v2.test.ts tests/architecture/notify-grammar-invariant.test.ts` | ❌ Wave 0 (new fixture) |
| RECON-05 | Back-to-back reconcile = strict no-op; byte-unchanged config + state | unit (orchestrator) — capture mtime+bytes before/after second call | `node --test tests/orchestrators/reconcile/apply.test.ts` | ❌ Wave 0 |
| RECON-06 | Two-process simultaneous start: no double-apply, no interleaved write | integration (fork + IPC) | `node --test tests/integration/load-reconcile-race.test.ts` | ❌ Wave 0 |
| Phase 52 deferred: Pitfall 52-2 + 52-4 lock-covered migrate-then-load-then-plan on populated state | integration | `node --test tests/integration/load-reconcile-race.test.ts` (subsumes RECON-06) AND `tests/orchestrators/reconcile/apply.test.ts` (single-process populated-state convergence) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/orchestrators/reconcile/apply.test.ts tests/integration/load-reconcile-race.test.ts` (under 30s for the new surface)
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/orchestrators/reconcile/apply.test.ts` — covers RECON-01, 02, 03, 05 (single-process behavior)
- [ ] `tests/integration/load-reconcile-race.test.ts` — covers RECON-06 + Phase 52 deferred lock-coverage (two-process)
- [ ] `tests/shared/notify-v2.test.ts` additions — covers RECON-04 byte form (new variant fixtures)
- [ ] `tests/architecture/notify-grammar-invariant.test.ts` additions — asserts NO `/reload` trailer on the new variant
- [ ] `tests/architecture/catalog-uat.test.ts` additions — paired FIXTURES entries for any new catalog states
- [ ] `tests/architecture/notify-types.test.ts` additions — length-locks + shape proofs if new variants are added
- [ ] (optional) `tests/edge/index-handler.test.ts` — the resources_discover handler now calls applyReconcile + aggregateDiscoveredResources; light coverage of the wiring

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (transitively) | Phase 31-36 AUTH-* via existing `addMarketplace` + Device Flow; Phase 55 does not change auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | NFR-10 path containment via `assertPathInside` (already enforced at every write seam; Phase 55 adds no new write seam) |
| V5 Input Validation | yes | typebox CONFIG_VALIDATOR / STATE_VALIDATOR (frozen Phase 51); `claude-plugins.json` content fully validated before plan |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via absolute path in invalid-config row | Disclosure (I) | `path.basename(filePath)` — reuse the Phase 53 preview pattern (T-53-02-02). NEVER leak absolute paths in notify bodies. |
| Path traversal via marketplace name in `claude-plugins.json` | Tampering (T) | `assertSafeName` + `assertPathInside` at every path composition; already enforced in `locations.ts` method helpers (`pluginDataDir`, `sourceCloneDir`). Phase 55 introduces no new composition path. |
| Symlink replacement of a managed file between read and apply | Tampering (T) | Existing `withStateGuard` per-scope lock + atomic-rename writes. Not a Phase 55-specific risk. |
| Denial-of-service via huge `claude-plugins.json` causing infinite-loop reconcile | Denial (D) | Plan emits a bounded set of entries (proportional to declared marketplaces + plugins). Convergence (RECON-05) means a second pass is a no-op — no infinite loop possible. Per-entry try/catch bounds blast radius. |
| Information disclosure via gitOps error message leaking auth tokens | Disclosure (I) | Phase 31-36 already routes through `causeChainTrailer` which is depth-bounded. No new exposure. |

## Sources

### Primary (HIGH confidence)

- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:802,808` — `ExtensionHandler<E, R> = (event, ctx) => ...` and the `resources_discover` registration arity [VERIFIED via local file read]
- `extensions/pi-claude-marketplace/index.ts:15-37` — current `resources_discover` handler that ignores ctx via cast [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts:1-176` — Phase 53 preview shape (mirrors what Phase 55 apply should do for the read pass) [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` — `ReconcilePlan` 7-bucket shape [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — `buildReconcilePreviewNotification` projection pattern [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:155-196,217-251,367-430,781-` — `installPlugin` API + `runInstallLedger` guard-free body + `InstallPluginNotifications` orchestrated mode [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1-115,258-` — `setPluginEnabled` with CR-01 nested-lock comments [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:1-148` — `uninstallPlugin` API [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1-300` — `addMarketplace` API + ATTR-07 catch ladder [VERIFIED]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:160-` — `removeMarketplace` API [VERIFIED]
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:60-176` — proper-lockfile semantics + non-reentrant warning + `StateLockHeldError` [VERIFIED]
- `extensions/pi-claude-marketplace/persistence/migrate-config.ts` — Phase 52 seam [VERIFIED]
- `extensions/pi-claude-marketplace/persistence/config-merge.ts:143-153` — `loadMergedScopeConfig` returns merged + per-file results [VERIFIED]
- `extensions/pi-claude-marketplace/persistence/state-io.ts:158-205` — `loadState` + D-13 existsSync gate [VERIFIED]
- `extensions/pi-claude-marketplace/shared/notify.ts:166-189,2023-2062,989-1085` — STATUS_TOKENS tuple, `shouldEmitReloadHint`, `isInfoKind`, `StandaloneKind` [VERIFIED]
- `tests/architecture/no-orchestrator-network.test.ts:50-114` — FORBIDDEN_TARGETS list (apply.ts will NOT be added) [VERIFIED]
- `tests/architecture/config-state-write-seams.test.ts:80-106` — ALLOWED_CONFIG_JSON_WRITERS (apply.ts does NOT write config directly; uses driven orchestrators) [VERIFIED]
- `tests/integration/concurrent-install.test.ts:120-176` — fork(CHILD_PATH) + IPC pattern for two-process race tests [VERIFIED]
- `tests/persistence/migrate-config.test.ts:25-47` — Pitfall 52-2 / 52-4 hand-off to Phase 55 [VERIFIED]
- `.planning/phases/53-pure-reconcile-planner-dry-run-preview/53-02-SUMMARY.md` — Phase 53 will-* token landings + planner shape [VERIFIED]
- `.planning/phases/54-enable-disable-commands/54-02-SUMMARY.md` — CR-01 nested-lock lesson + runInstallLedger extraction + isRecordedButDisabled export [VERIFIED]
- `.planning/phases/52-first-run-migration/52-01-SUMMARY.md` — migrateFirstRunConfig seam + deferred Pitfall 52-2/52-4 contract [VERIFIED]
- `.planning/REQUIREMENTS.md` — RECON-01..06 verbatim text [VERIFIED]

### Secondary (MEDIUM confidence)

- None — every claim above is grounded in repo source.

### Tertiary (LOW confidence)

- A1 (extension load order before `resources_discover`) — assumption pending plan-time verification against pi-coding-agent internals. Flagged as Open Question 4.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep already in `package.json`; no additions
- Architecture: HIGH — patterns proven by Phase 19 (orchestrated mode), Phase 53 (preview), Phase 54 (CR-01 lesson)
- Pitfalls: HIGH — every pitfall maps to a real code path with file/line citation
- Lifecycle hook feasibility: HIGH — directly verified against pi-coding-agent's `types.d.ts`
- Load-order assumption (A1): LOW — flagged for spike at plan time

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (Phase 55 should land within 30 days; if delayed, re-verify pi-coding-agent version since the peer dep was bumped to 0.79.0 recently and the dispatch contract may evolve)
