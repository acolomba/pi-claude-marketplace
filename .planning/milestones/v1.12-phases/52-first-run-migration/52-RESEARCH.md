# Phase 52: First-Run Migration - Research

**Researched:** 2026-06-10
**Domain:** Pi-extension persistence-layer one-shot migrator that derives a `claude-plugins.json` losslessly from an existing `state.json` on the first load after the v1.12 upgrade.
**Confidence:** HIGH

## Summary

Phase 52 is a **one-way-door safety rail** for users upgrading into v1.12 with a populated `state.json`. Without it, Phase 55's reconcile would, on first load, see "no config -> empty desired state" and prune every installed marketplace and plugin. The migration must run before any reconcile pass and must be lossless (every installed entry shows up in the generated config, including soft-degraded `compatibility.installable === false` ones), atomic (tmp+rename through the SPLIT-02 `saveConfig` seam), and ENOENT-driven idempotent (no half-set flag; if the file exists, skip; if the file does not, generate).

The Phase 51 foundation already ships every primitive needed: `loadConfig` returns a discriminated `ConfigLoadResult` so `absent` is the unambiguous trigger; `saveConfig` is the SOLE SPLIT-02-sanctioned config-file writer; the D-13 ORDERING RAIL in `migrate.ts`/`state-io.ts` preserves the legacy `autoupdate` field through one extra load so Phase 52 can capture it. Phase 52's job is to add ONE new pure projection function (state-record + legacy-autoupdate -> `ScopeConfig`) plus ONE thin caller that wires the ENOENT detection -> projection -> `saveConfig` sequence, and to add itself to the `ALLOWED_CONFIG_JSON_WRITERS` allow-list.

**Primary recommendation:** Create `persistence/migrate-config.ts` exporting a pure `buildConfigFromState(state, options)` projection and a thin `migrateFirstRunConfig(loc, state)` orchestrator. The orchestrator's caller sequence is: (1) `loadConfig(loc.configJsonPath)` to detect ENOENT (`status === "absent"`); (2) build the projection from the in-memory `ExtensionState`; (3) `saveConfig(loc.configJsonPath, projection, loc.scopeRoot)` — the same tmp+rename atomic write seam that already satisfies NFR-1/NFR-10. Defer the LOAD WIRING (who calls `migrateFirstRunConfig` and in what order relative to reconcile) to Phase 55 per the phase boundary; Phase 52 produces a seam that Phase 55 will consume. Satisfy Success Criterion 4 (migrate-then-reconcile no-op) at the **data level**: assert that `mergeScopeConfigs({}, buildConfigFromState(state)).marketplaces` and `state.marketplaces` have exactly the same key sets and that each generated `MarketplaceConfigEntry.source` equals the `source.raw` recovered from the state record. The actual `planReconcile` no-op exit-gate test lands in Phase 53 when the planner exists.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Relevant inherited constraints from Phase 51 (the frozen foundation this phase builds on):
- `persistence/config-io.ts` owns `CONFIG_SCHEMA`, `loadConfig` (discriminated absent/invalid/valid `ConfigLoadResult`), and `saveConfig` (validate → assertPathInside → atomicWriteJson). Migration writes MUST go through `saveConfig`.
- The SPLIT-02 architecture test (`tests/architecture/config-state-write-seams.test.ts`) allow-lists config writers; the migration module must be added to `ALLOWED_CONFIG_JSON_WRITERS` explicitly (the "exactly N" assertion will trip otherwise — that is by design).
- The D-13 ordering rail in `persistence/migrate.ts`/`state-io.ts`: the legacy `autoupdate` scrub in state is gated on `existsSync(configJsonPath)` so the legacy field survives until this phase's migration captures it into the config. Migration must read the legacy `autoupdate` value BEFORE the scrub can destroy it (i.e., capture it from the pre-scrub state record or from the gate-closed state).
- `loadConfig` returning `invalid` is an abort signal (CFG-03) — migration must NOT run when the config file exists but is invalid; ENOENT (`absent`) is the only migration trigger.

### Claude's Discretion
All implementation choices outside the inherited constraints listed above.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-01 | First load without a config file generates `claude-plugins.json` losslessly from existing state.json (all installed entries, including soft-degraded ones); nothing is uninstalled. | Pattern 1 (ENOENT-gated projection); Pattern 2 (lossless source-raw recovery + autoupdate capture from gate-closed state); Code Example 1 (buildConfigFromState); Pitfall 52-1 (soft-degraded entries MUST appear). |
| MIG-02 | Migration is atomic and idempotent; reconcile immediately after migration is a strict no-op. | Pattern 3 (saveConfig tmp+rename = atomic; ENOENT = idempotent without flags); Pattern 4 (convergence-gate data-level proof in Phase 52, planner-level proof deferred to Phase 53); Pitfall 52-2 (concurrent first-loads same scope). |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ENOENT detection (`loadConfig` -> `absent`) | persistence | — | Reuses Phase 51 trichotomy; no new I/O surface |
| State -> config projection (pure function) | persistence | — | Lives next to `migrate.ts`'s sibling legacy-shape normalizer; same architectural role |
| `source.raw` recovery from `ParsedSource` | persistence | domain | `ParsedSource.raw` is the verbatim user input preserved by SP-7; projection reads it |
| Legacy `autoupdate` capture | persistence | — | Reads from `ExtensionState['marketplaces'][mp]` via the SPLIT-01 cast pattern (D-13 keeps it in-memory pre-scrub) |
| Atomic write (tmp+rename + fsync) | persistence | shared | Routes through `saveConfig` -> `atomicWriteJson` -> `write-file-atomic` |
| NFR-10 containment | persistence | shared | `saveConfig` enforces via `assertPathInside` BEFORE the write (Pitfall 51-5) |
| Load-time call site / migrate-before-reconcile ORDERING | edge / orchestrators | — | Deferred to Phase 55 per the phase boundary; Phase 52 produces a seam, not a load wiring |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typebox | `^1.1.38` | Schema validation for the generated config (already used inside `saveConfig`) | Carried forward from V1; Phase 51 ships `CONFIG_VALIDATOR` JIT-compiled validator. Migration does NOT need a new schema — it builds a `ScopeConfig` and lets `saveConfig` revalidate. [VERIFIED: `extensions/pi-claude-marketplace/persistence/config-io.ts:83`] |
| write-file-atomic | `^7` (via `shared/atomic-json.ts`) | tmp+fsync+rename atomic write inside `saveConfig` | Already shipped; the `atomicWriteJson` wrapper is the single sanctioned JSON-write seam per NFR-1. [VERIFIED: `extensions/pi-claude-marketplace/shared/atomic-json.ts:24`] |
| node:fs/promises (built-in) | bundled | Optional — only needed if the planner chooses to add a fixture-loader helper for tests | Phase 52 deliberately uses NO direct `fs` reads in production: ENOENT detection comes through `loadConfig`, never through a bare `existsSync` or `stat`. The D-13 gate already uses `existsSync` inside `loadState`; Phase 52 does NOT add a second probe. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:assert/strict | bundled | Test assertions | Carried forward across the test tree |
| node:test | bundled | Test runner | Phase 52 adds unit tests for the pure projection + integration tests for the seam |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ENOENT-driven idempotency (`loadConfig` returns `absent`) | Half-set flag in `state.json` (e.g., `migratedToV1_12: true`) | A flag adds a STATE_SCHEMA bump (D-12 forbids), creates a half-state on interrupted writes (the very failure mode MIG-02 forbids), and gives nothing the file's presence does not already give. **Reject.** |
| Pure projection function | A method on a `MigrationContext` class | Phase 51 ships every other persistence helper as a free function (`loadConfig`, `saveConfig`, `mergeScopeConfigs`, `migrateLegacyMarketplaceRecords`). Class-wrapping breaks the pattern. **Reject.** |
| Calling `saveConfig` directly | Hand-rolling a tmp+rename | Defeats SPLIT-02 (the architecture test fails) and duplicates NFR-1/NFR-10 enforcement. **Reject.** |
| Writing through `saveConfig` from `migrate-config.ts` | Routing the write back through `migrate.ts::persistMigratedState` | `persistMigratedState` is the IL-3 best-effort persist for STATE.JSON only. Reusing it for the config write conflates two semantically different writes and creates a second IL-3 console.warn callsite (lint disallows). **Reject.** |
| Capturing legacy `autoupdate` from the pre-scrub state record | Calling `loadState` twice or reading raw `state.json` JSON ourselves | `loadState` is idempotent and already preserves `autoupdate` when the D-13 gate is closed. We read the SPLIT-01-cast field on the in-memory `ExtensionState['marketplaces'][mp]` value, same pattern used by 11 production sites. **Accept.** |

**Installation:**
No new packages. Migration sits on the Phase 51 seam (`config-io.ts`, `config-merge.ts`, `migrate.ts`, `locations.ts`) and shared/atomic-json.ts. All dependencies already verified [VERIFIED: `package.json`].

**Version verification:** No new packages — no version probe required.

## Package Legitimacy Audit

Not applicable — Phase 52 installs no external packages. All dependencies (`typebox`, `write-file-atomic`, `node:*` built-ins) were vetted at v1.0 and Phase 51 and remain pinned in `package.json` / `package-lock.json`.

## Architecture Patterns

### System Architecture Diagram

```
                FIRST-RUN MIGRATION (Phase 52)

  loadState(extensionRoot)                            saveConfig(filePath, config, scopeRoot)
        │                                                       ▲
        │ returns ExtensionState                                 │ writes losslessly
        │ with: marketplaces[mp].source: ParsedSource,           │ via tmp+rename
        │       marketplaces[mp].autoupdate?: boolean (D-13      │
        │       gate-closed preserved this from the legacy       │
        │       state.json on first load)                        │
        ▼                                                       │
  ┌─────────────────────────────────────────────────────────┐  │
  │  migrateFirstRunConfig(loc, state)  [thin orchestrator] │  │
  │                                                          │  │
  │   1. result = await loadConfig(loc.configJsonPath)       │  │
  │   2. if (result.status !== "absent") return notMigrated  │  │
  │   3. cfg = buildConfigFromState(state)                   │──┘
  │   4. await saveConfig(loc.configJsonPath, cfg,           │
  │                       loc.scopeRoot)                     │
  │   5. return { migrated: true, entryCount }               │
  └─────────────────────────────────────────────────────────┘
                       │ (status === "invalid"
                       │  is NOT migration's concern -- it
                       │  returns notMigrated and the
                       │  reconcile-planner aborts per CFG-03)
                       ▼
              migrateFirstRunResult
                       │
                       │ consumed by the load-wiring caller in Phase 55
                       ▼
                  [Phase 55 reconcile pass]
                       │ MUST run migrate-then-reconcile in that order;
                       │ Phase 52 produces the seam, Phase 55 owns the order


   PURE PROJECTION  (called from step 3 above)
   ┌─────────────────────────────────────────────────┐
   │ buildConfigFromState(state)                      │
   │   for each mp in state.marketplaces:             │
   │     cfg.marketplaces[mp.name] = {                │
   │       source: mp.source.raw,        ← SP-7       │
   │       autoupdate: mp.autoupdate     ← D-13       │
   │         (SPLIT-01 cast; omit if undefined)       │
   │     }                                            │
   │     for each plugin in mp.plugins:               │
   │       cfg.plugins[`${plugin}@${mp.name}`] = {}   │
   │       // D-04: enabled defaults at consume time; │
   │       // omit so absence === enabled             │
   │ return { schemaVersion: 1, marketplaces, plugins}│
   └─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
extensions/pi-claude-marketplace/
├── persistence/
│   ├── migrate-config.ts        # NEW: buildConfigFromState + migrateFirstRunConfig
│   ├── config-io.ts             # UNCHANGED (consumed)
│   ├── config-merge.ts          # UNCHANGED (consumed by the data-level convergence test)
│   ├── state-io.ts              # UNCHANGED
│   ├── migrate.ts               # UNCHANGED
│   └── locations.ts             # UNCHANGED
└── (no orchestrator changes — load wiring is Phase 55)

tests/
├── persistence/
│   ├── migrate-config.test.ts                            # NEW: projection + seam tests
│   └── fixtures/legacy/state-with-autoupdate-and-plugins.json  # NEW (or extend existing)
└── architecture/
    └── config-state-write-seams.test.ts                  # MODIFIED: add migrate-config.ts to ALLOWED_CONFIG_JSON_WRITERS
```

### Pattern 1: ENOENT-driven idempotency via `loadConfig` trichotomy

**What:** Use `loadConfig(loc.configJsonPath)`'s `status === "absent"` arm as the SOLE migration trigger. No half-set flag, no separate `existsSync` probe, no out-of-band marker file.

**Why this satisfies MIG-02 idempotency:**
- A successful `saveConfig` either completes (file exists at end -> next load reads `valid`, migration short-circuits) or fails before the rename (file does NOT exist -> next load reads `absent`, migration re-runs cleanly). No half-state is observable because `write-file-atomic` writes to a tmp file and renames atomically.
- An interrupted second migration after the first succeeded is impossible: the first call's `saveConfig` already made the file present, the second call's `loadConfig` returns `valid` or `invalid` (NOT `absent`), and the migration short-circuits.
- `invalid` (file exists, is JSON-valid-but-schema-invalid or 0-byte) is NOT a migration trigger. The user-authored file is the user's; we do NOT overwrite it. The reconcile planner in Phase 53/55 aborts on invalid (CFG-03) and surfaces an error — the correct behavior; migration MUST stay out of the way.

**When to use:** Always, for any "first time we see this" migration in a system that already has an atomic-write seam.

**Example:**
```typescript
// extensions/pi-claude-marketplace/persistence/migrate-config.ts
import { loadConfig, saveConfig, type ScopeConfig } from "./config-io.ts";
import type { ExtensionState } from "./state-io.ts";
import type { ScopedLocations } from "./locations.ts";

export interface MigrateFirstRunResult {
  readonly migrated: boolean;
  readonly entryCount: number;  // marketplaces + plugins; 0 when not migrated
  readonly filePath: string;     // for caller-side logging (Phase 55)
}

export async function migrateFirstRunConfig(
  loc: ScopedLocations,
  state: ExtensionState,
): Promise<MigrateFirstRunResult> {
  const result = await loadConfig(loc.configJsonPath);
  if (result.status !== "absent") {
    return { migrated: false, entryCount: 0, filePath: loc.configJsonPath };
  }

  const config = buildConfigFromState(state);
  await saveConfig(loc.configJsonPath, config, loc.scopeRoot);

  const entryCount =
    Object.keys(config.marketplaces ?? {}).length + Object.keys(config.plugins ?? {}).length;
  return { migrated: true, entryCount, filePath: loc.configJsonPath };
}
```

### Pattern 2: Lossless projection from `ExtensionState` to `ScopeConfig`

**What:** A pure function that walks `state.marketplaces` and produces a `ScopeConfig` containing:
- **Every marketplace** keyed by name, with `source: mp.source.raw` (SP-7 verbatim user input is preserved on every `ParsedSource` variant) and `autoupdate: mp.autoupdate` (SPLIT-01 cast read; omit if undefined per D-04 "undefined === false").
- **Every plugin**, including soft-degraded ones with `compatibility.installable === false`, flat-keyed as `${plugin}@${mp.name}` per Phase 51's D-01 flat layout. Empty object body — `enabled` defaults to true at consume time (D-04), so omitting it is the right "declared, default-enabled" shape.

**Why "lossless" matters for MIG-01:** A user with N installed entries who upgrades into v1.12 must see N declared entries in the generated config. Any plugin we silently drop is one the next reconcile would uninstall. Soft-degraded plugins (`installable: false`) are still RECORDED in state and counted as installed; they MUST appear in the generated config — losing them would cause reconcile to mark them as undeclared-but-recorded and uninstall them on the next pass.

**When to use:** Always — this is the migration's core projection. Pure function, no I/O.

**Example:**
```typescript
// extensions/pi-claude-marketplace/persistence/migrate-config.ts (continued)
import type { ParsedSource } from "../domain/source.ts";

export function buildConfigFromState(state: ExtensionState): ScopeConfig {
  const marketplaces: NonNullable<ScopeConfig["marketplaces"]> = {};
  const plugins: NonNullable<ScopeConfig["plugins"]> = {};

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    const sourceRaw = (mp.source as ParsedSource).raw;
    // SPLIT-01 cast: D-13 gate-closed loadState preserves the legacy `autoupdate`
    // field on the marketplace record. Read via the standard cast pattern;
    // omit from the config entry when undefined (D-04 undefined === false).
    const legacyAutoupdate = (mp as unknown as Record<string, unknown>).autoupdate;

    const entry: { source: string; autoupdate?: boolean } = { source: sourceRaw };
    if (legacyAutoupdate === true) {
      entry.autoupdate = true;
    } else if (legacyAutoupdate === false) {
      // D-04 anti-pattern guard: explicit `false` is meaningful (user opted out);
      // emit it to preserve user intent. `undefined` is omitted.
      entry.autoupdate = false;
    }
    marketplaces[mpName] = entry;

    for (const pluginName of Object.keys(mp.plugins)) {
      // D-01 flat-key shape (matches CFG-01 + Phase 51 CONFIG_SCHEMA);
      // soft-degraded plugins (compatibility.installable === false) ARE included --
      // their state record exists, so the declared config must show them.
      plugins[`${pluginName}@${mpName}`] = {};
    }
  }

  return { schemaVersion: 1, marketplaces, plugins };
}
```

### Pattern 3: Atomicity via the SPLIT-02 `saveConfig` seam

**What:** The atomic-write guarantee comes "for free" from `saveConfig` -> `atomicWriteJson` -> `write-file-atomic`. The library writes to a sibling tmp file in the same directory, fsyncs the tmp file AND the parent directory, then atomically renames. Power loss between truncate-and-write is impossible because the destination is never truncated.

**Why MIG-02 demands this specifically:** "the config file is written via tmp+rename before any bookkeeping is touched." There is NO bookkeeping outside the file itself: ENOENT detection is the bookkeeping. Either the file exists (migrated) or it does not (next load re-tries). The success criterion's "before any bookkeeping" clause is therefore vacuously satisfied — by construction, this migration touches no other state.

**Architecture-test consequence:** `tests/architecture/config-state-write-seams.test.ts::ALLOWED_CONFIG_JSON_WRITERS` is currently a 1-element `ReadonlySet`. Adding `persistence/migrate-config.ts` means BOTH that set AND the "exactly one file may write claude-plugins.json files" sibling assertion (line 163-167) must update to two entries in the same commit. The architecture test will trip otherwise — by design.

Wait — re-read. `migrate-config.ts` does NOT call `atomicWriteJson` directly; it calls `saveConfig`. Does that put it on the allow-list?

**Answer:** No. The architecture test scans for `atomicWriteJson(...configJsonPath, ...)` callsites. `migrate-config.ts` calls `saveConfig(loc.configJsonPath, ...)` — that does NOT match the forbidden pattern (`atomicWriteJson(\s*(?:\w+\.)?configJsonPath\b`). The migration module therefore does NOT need to be on `ALLOWED_CONFIG_JSON_WRITERS`. The current 1-element allow-list (`config-io.ts`) is correct and stays.

This inverts the constraint stated in `52-CONTEXT.md`: "the migration module must be added to `ALLOWED_CONFIG_JSON_WRITERS` explicitly." That instruction is overly defensive — it would be correct ONLY if migration bypassed `saveConfig` and called `atomicWriteJson` directly. Routing through `saveConfig` (which is the only sane path because `saveConfig` is also where NFR-10 + schema-revalidation are enforced) keeps the allow-list at 1. **Verify this against the architecture test before writing the plan and either update or stand by this finding.** [VERIFIED: `tests/architecture/config-state-write-seams.test.ts:75-82,102-104,163-167` — the regex matches `atomicWriteJson` only, not `saveConfig`.]

**When to use:** Always — `saveConfig` is the SOLE permitted config-file writer (SPLIT-02), and the migration writes a config file.

### Pattern 4: Migrate-then-reconcile convergence proven at the data level

**What:** Success Criterion 4 ("running a reconcile immediately after a fresh migration is a strict no-op") references a `planReconcile` that does not exist until Phase 53. Phase 52 must satisfy it WITHOUT the planner, OR explicitly defer the planner-level proof to Phase 53.

**Recommended:** Both. Phase 52 lands a **data-level** convergence test:

```typescript
test("MIG-02 data-level convergence: generated config exactly mirrors state entries", async () => {
  const state: ExtensionState = makeStateFixture({
    marketplaces: {
      "mp-a": withSource("acme/tools", { plugins: ["code-reviewer", "soft-degraded"] }),
    },
  });
  const cfg = buildConfigFromState(state);
  // Same marketplace key set.
  assert.deepEqual(Object.keys(cfg.marketplaces ?? {}).sort(), Object.keys(state.marketplaces).sort());
  // Same plugin key set (flat-keyed as plugin@marketplace).
  const expectedPluginKeys = Object.entries(state.marketplaces)
    .flatMap(([mp, rec]) => Object.keys(rec.plugins).map(p => `${p}@${mp}`))
    .sort();
  assert.deepEqual(Object.keys(cfg.plugins ?? {}).sort(), expectedPluginKeys);
  // Source recovered byte-stably from the parsed source.
  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    assert.equal(cfg.marketplaces?.[mpName]?.source, (mp.source as ParsedSource).raw);
  }
});
```

Phase 53 lands the **planner-level** proof:

```typescript
// Phase 53 — owned there, not here
test("MIG-02 planner convergence: planReconcile(merge(cfg), state) returns empty plan", () => {
  const state = loadStateFixture("populated-with-autoupdate");
  const cfg = buildConfigFromState(state);
  const merged = mergeScopeConfigs(cfg, {});
  const plan = planReconcile(merged, state);
  assert.deepEqual(plan, { adds: [], installs: [], removes: [], uninstalls: [], transitions: [] });
});
```

This split is consistent with the phase boundary: Phase 52 owns the projection's correctness; Phase 53 owns the planner's correctness; the convergence-gate test that joins them lives where the planner lives. The Phase 52 plan SHOULD note this deferral explicitly (cross-phase traceability).

**When to use:** Whenever a phase's success criterion refers to a downstream phase's primitive — split the proof: data-level proof here, behavior-level proof there.

### Anti-Patterns to Avoid

- **Half-set flag in state.json (`migratedToV1_12: true`).** Breaks D-12 (no STATE_SCHEMA bump), reintroduces the very half-state failure mode MIG-02 forbids, and reads worse than ENOENT detection.
- **Writing `claude-plugins.json` directly via `atomicWriteJson`.** Bypasses SPLIT-02, NFR-10 (`assertPathInside`), and schema revalidation. Forces the architecture test to be widened, exposing the seam. **Always go through `saveConfig`.**
- **Calling `saveState` to scrub legacy `autoupdate` from in-memory state after the migration writes the config.** The D-13 gate's NEXT load handles the scrub naturally: once `claude-plugins.json` exists, `existsSync(configJsonPath)` returns true and `loadState`'s next-load run scrubs in-place. Phase 52 forcing a state-save after the migration risks an extra disk write and a TOCTOU race against the reconcile pass. **Let D-13 do its job.**
- **Filtering out soft-degraded entries from the projection.** A plugin with `compatibility.installable === false` is INSTALLED (its state record exists) and must therefore be DECLARED in the generated config. Dropping it would cause reconcile to mark it as undeclared-but-recorded and uninstall it.
- **Performing the migration AFTER the reconcile pass.** Violates the MIG-01 ordering rail: reconcile sees "no config -> empty desired state" and prunes everything before the migration runs.
- **Notifying the user from `migrate-config.ts`.** Phase 51 D-19 routes all messaging through `shared/notify.ts` from the load-wiring layer. Phase 52 returns a structured `MigrateFirstRunResult`; Phase 55's load wiring decides whether/how to surface it.
- **Reading raw `state.json` JSON ourselves to capture `autoupdate`.** `loadState` already does this correctly; double-reading breaks the D-13 invariant and duplicates the SPLIT-01 cast logic.
- **Adding `migrate-config.ts` to `ALLOWED_CONFIG_JSON_WRITERS` "to be safe".** Unnecessary if the module calls `saveConfig` (as it must). Adding it would dilute the SPLIT-02 signal — the allow-list is meant to be a tight, audited set, not a participation roster.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ENOENT detection | Bare `existsSync` or `try { stat } catch` | `loadConfig(loc.configJsonPath)` → check `status === "absent"` | Phase 51's trichotomy already encodes ENOENT vs invalid vs valid; reusing it inherits the Pitfall 51-1 0-byte-not-valid-empty contract and keeps the seam single. |
| Atomic config write | tmp + fsync + rename loop | `saveConfig(filePath, config, scopeRoot)` | SPLIT-02 ownership; revalidates schema; asserts NFR-10 containment; routes through `write-file-atomic`. Hand-rolling reproduces the bug surface NFR-1 closed. |
| Schema validation on the generated config | Manual property checks | `saveConfig`'s `CONFIG_VALIDATOR.Check(config)` | The validator is JIT-compiled (Phase 51 D-07); `saveConfig` runs it BEFORE the write. A projection that fails validation surfaces a `saveConfig refused: ...` Error — the right failure mode. |
| Recovering the user-typed source string | Pattern-matching on each `ParsedSource` `kind` | `(mp.source as ParsedSource).raw` | SP-7 preserves the verbatim user input on every variant. The `raw` field is the SAME string the user typed at `marketplace add` time; round-tripping it through the config is exactly what MIG-01 "lossless" means. |
| Legacy `autoupdate` capture | A second `loadState` call or raw JSON read | The SPLIT-01 cast pattern: `(mp as unknown as Record<string, unknown>).autoupdate` | D-13 keeps the field in-memory on the first load; 11 production sites already use the cast pattern; the rewire to MergedConfig is a Phase 54-56 follow-up, not Phase 52's concern. |
| State-level idempotency | Explicit "have I migrated?" flag | The file's presence (ENOENT vs valid) is the flag. | Atomic write + ENOENT detection are sufficient. A flag would require a STATE_SCHEMA bump (D-12 forbids) and creates a new half-state window. |

**Key insight:** Phase 52 is almost entirely a glue layer over Phase 51's primitives. The only genuinely-new code is the pure projection. Every other concern (atomicity, containment, schema, ENOENT semantics) is delegated to a seam that already exists, has tests, and is enforced by an architecture test.

## Runtime State Inventory

> Phase 52 is greenfield — no existing runtime state is being renamed or refactored. This section answers the GSD canonical question "What runtime systems still have the old string cached, stored, or registered after the migration runs?" for the post-v1.12-upgrade window.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (1) `state.json` per-scope, post-migration: legacy `autoupdate: true/false` fields on marketplace records survive in-memory for the duration of the load that triggers migration, then are scrubbed by the D-13 gate on the NEXT load (when `claude-plugins.json` exists). (2) Newly-created `claude-plugins.json` per-scope: lossless mirror of state entries. | No additional action — D-13 gate handles state-record scrub naturally on the next load. Phase 52 MUST NOT force a state-save after migration (anti-pattern above). |
| Live service config | None — Pi extension has no live service config in the Phase 52 surface. The Pi runtime is restarted via `/reload`; there are no daemons or external service registrations to update. | None. |
| OS-registered state | None — no Task Scheduler, systemd, launchd, or pm2 registrations touch this surface. | None. |
| Secrets/env vars | None — no env vars are renamed, removed, or added. `PI_CODING_AGENT_DIR` (user-scope root) is unaffected. | None. |
| Build artifacts | None — no compiled binaries, no egg-info, no Docker image tags. The TypeScript source ships as-is and is strip-loaded by Node 22.18+. | None. |

**The post-Phase-52 invariant (per scope):** if a `state.json` ever existed before v1.12, then after the first load on v1.12 a `claude-plugins.json` MUST exist alongside it. The reverse direction — does a `claude-plugins.json` imply a corresponding `state.json`? — is NOT a v1.12 invariant; a fresh install on v1.12 may create the config first via `marketplace add` write-back (Phase 56) and the state second.

## Common Pitfalls

### Pitfall 52-1: Soft-degraded entries silently filtered out of the migration

**What goes wrong:** The projection loops `state.marketplaces[mp].plugins` and skips entries with `compatibility.installable === false` on the assumption that "they're not really installed." On the next reconcile, those plugins appear as recorded-but-undeclared and get uninstalled.

**Why it happens:** A naive read of "first-run migration should declare installed plugins" treats `installable: false` as "not installed." The state machine treats it differently — the plugin IS installed (its record exists, its version is pinned, its compatibility was evaluated). Soft-degradation is an availability annotation, not an existence flag.

**How to avoid:** The projection visits EVERY entry in `mp.plugins` unconditionally. The test fixture MUST include at least one plugin with `compatibility.installable === false` and assert it appears in the generated config.

**Warning signs:** A test that uses only `installable: true` fixtures and so cannot catch the regression. Make the fixture mixed by default.

### Pitfall 52-2: Concurrent first-loads in the same scope racing the migration

**What goes wrong:** Two Pi processes start near-simultaneously against the same scope; both call `loadConfig` and both see `absent`; both build their projections; both call `saveConfig`. `write-file-atomic`'s internal queue serializes the writes — but the last writer wins, and the in-memory states the two processes used might differ slightly (e.g., one had just-loaded state with newer `state.json` mtime).

**Why it happens:** Phase 52 by itself runs OUTSIDE any scope lock. The existing `withStateGuard` lock guards `loadState`+`saveState`, not arbitrary config writes.

**How to avoid:** Phase 55 owns the load-wiring AND the lock-acquisition order. Phase 52 produces a seam that Phase 55 calls INSIDE `withStateGuard` (or analogous). The Phase 52 plan should call this out as a HAZARD CARRIED INTO PHASE 55: "migrateFirstRunConfig MUST be invoked while holding the scope's state lock so that concurrent first-loads serialize correctly."

The hazard does NOT affect data integrity in practice because (a) both projections are derived from a `loadState` that runs inside the scope lock, so the underlying `state.json` is consistent; (b) `write-file-atomic` is atomic; (c) the second writer's `loadConfig` (on the second load) sees `valid` and short-circuits. But the window is real and worth documenting.

**Warning signs:** No Phase 52 test asserts lock semantics — and shouldn't. The integration test for lock-coverage belongs in Phase 55, when the load wiring exists.

### Pitfall 52-3: Reading `state.source` instead of `state.source.raw` and writing a `ParsedSource` object into `claude-plugins.json`

**What goes wrong:** The projection naively writes `cfg.marketplaces[name].source = mp.source`, putting `{ kind: "github", raw: "acme/tools" }` into the config file. `CONFIG_SCHEMA` declares `source: Type.String()` (D-02), so `saveConfig`'s `CONFIG_VALIDATOR.Check` rejects the config with a schema-validation error.

**Why it happens:** `state-io.ts::ST-6` normalizes the stored source string through `parsePluginSource` into a `ParsedSource` object before `loadState` returns. So `state.marketplaces[mp].source` is an OBJECT in memory, not a string. CONFIG_SCHEMA expects a STRING (the verbatim user input).

**How to avoid:** Always project via `mp.source.raw`. Add a test that round-trips: write a state fixture whose `source` is a GitHub string, run the migration, `loadConfig` the result, assert `result.config.marketplaces[mp].source === "acme/tools"` (the original verbatim string).

**Warning signs:** The `saveConfig refused: ...` Error message contains `/source: Expected string/`. If a test catches this, the projection is reading the wrong field.

### Pitfall 52-4: D-13 gate races between `loadState` mutate-and-save and `migrateFirstRunConfig`'s `saveConfig`

**What goes wrong:** `loadState` mutates the in-memory state (including capturing or NOT capturing `autoupdate` based on `existsSync(configJsonPath)`) and then `void persistMigratedState(...)` fires a best-effort async write. If Phase 52's `migrateFirstRunConfig` runs immediately after `loadState` returns AND the fire-and-forget persist beats the migration to actually flush state.json — irrelevant, because the persist writes the SCRUB-DECISION-AT-LOAD-TIME state and Phase 52 has its already-loaded in-memory state. If the persist FAILS (IL-3 console.warn), Phase 52 still has its in-memory state and writes a correct `claude-plugins.json`.

**But:** If migration succeeds and then the IL-3 persist completes (which depending on order is async), the next `loadState` call sees `existsSync(configJsonPath)` true AND a state.json that still has `autoupdate` (because the persist of THAT call's normalized state used `scrubAutoupdate: false` from before migration ran). The D-13 gate scrubs on THAT next load.

**Why it happens:** Two concurrent best-effort writes (state.json persist + config.json migration) with no enforced ordering. In practice, neither order causes data loss because: (a) the in-memory state Phase 52 used is correct; (b) the next-load scrub IS what D-13 promises. The risk surface is purely about "did the legacy autoupdate field get into the generated config?" — and yes, it did, because we read it from the in-memory state BEFORE `loadState` returned (the SPLIT-01 cast read).

**How to avoid:** The Phase 52 seam takes `ExtensionState` by value (already loaded, autoupdate already captured in-memory). The caller (Phase 55) sequences `state = await loadState(...)` -> `await migrateFirstRunConfig(loc, state)`. Phase 52 does not re-load state.

**Warning signs:** A Phase 52 implementation that calls `loadState` internally. Don't.

### Pitfall 52-5: `loadConfig` returns `invalid` (not `absent`) on a 0-byte `claude-plugins.json` — migration MUST NOT regenerate

**What goes wrong:** A user touch-creates an empty `claude-plugins.json`, perhaps as part of a half-finished hand-edit. `loadConfig` returns `{ status: "invalid", error: "JSON parse failed: ..." }` (Pitfall 51-1 anchor). A naive migration treats "not valid" as "should migrate" and overwrites the user's empty file with a generated one.

**Why it happens:** Conflating "absent" with "not usable." They are distinct trichotomy arms by design (Phase 51 D-15).

**How to avoid:** Check `status === "absent"` EXACTLY. Any other status (`invalid` or `valid`) returns `notMigrated`. The reconcile planner downstream (Phase 53/55) handles the `invalid` arm per CFG-03 (abort, surface to user) — migration MUST stay out of that path. Add a test for the 0-byte case asserting `migrated === false` AND the file is unchanged on disk.

**Warning signs:** A test that uses a missing-file fixture only and so cannot distinguish the `absent` vs `invalid` arms.

### Pitfall 52-6: Plugin key collisions across marketplaces

**What goes wrong:** Two marketplaces install a plugin named `code-reviewer`. The flat plugin key shape is `${plugin}@${marketplace}` — collision-free by construction. But if the projection accidentally keys by plugin name alone (`plugins[pluginName] = {}`), the second iteration overwrites the first and one plugin is silently lost.

**Why it happens:** Phase 51's `CONFIG_SCHEMA.plugins` is `Record<string, PluginConfigEntry>` — flat string keys. The natural "plugin name" key is wrong; the right key encodes the marketplace too.

**How to avoid:** Always key plugins as `${pluginName}@${mpName}`. Test fixture: include two marketplaces each with a same-named plugin; assert both keys appear in the generated config.

**Warning signs:** The projection's plugin loop has `plugins[pluginName] = ...` instead of `plugins[\`${pluginName}@${mpName}\`] = ...`.

## Code Examples

Verified patterns derived from `extensions/pi-claude-marketplace/persistence/` and `domain/source.ts`.

### Example 1: The complete migration seam

```typescript
// extensions/pi-claude-marketplace/persistence/migrate-config.ts
//
// MIG-01 / MIG-02 / D-13 — first-run lossless migration from state.json
// into claude-plugins.json. Pure projection + thin ENOENT-gated orchestrator;
// atomicity inherited from saveConfig.
//
// The projection captures the legacy `autoupdate` field via the SPLIT-01 cast
// pattern (D-13 gate-closed loadState preserves it in-memory). The plugin
// shape is flat-keyed as `${plugin}@${marketplace}` per Phase 51 D-01.
// Soft-degraded plugins (compatibility.installable === false) ARE included --
// they are installed per state, so MUST be declared per migration (MIG-01).

import {
  loadConfig,
  saveConfig,
  type ScopeConfig,
} from "./config-io.ts";
import type { ExtensionState } from "./state-io.ts";
import type { ScopedLocations } from "./locations.ts";
import type { ParsedSource } from "../domain/source.ts";

export interface MigrateFirstRunResult {
  readonly migrated: boolean;
  readonly entryCount: number;
  readonly filePath: string;
}

/**
 * MIG-01 lossless projection. Pure -- no I/O. Caller controls when (or
 * whether) to write the result.
 *
 * Captures:
 *   - every marketplace by name, with source = mp.source.raw (SP-7 verbatim)
 *   - legacy autoupdate from D-13-gate-closed state (SPLIT-01 cast)
 *   - every plugin (including soft-degraded), flat-keyed as plugin@marketplace
 *
 * Omits:
 *   - enabled (D-04: defaults to true at consume time; absence === enabled)
 *   - autoupdate when undefined (D-04: undefined === false; we emit only
 *     explicit true/false to preserve user intent)
 */
export function buildConfigFromState(state: ExtensionState): ScopeConfig {
  const marketplaces: NonNullable<ScopeConfig["marketplaces"]> = {};
  const plugins: NonNullable<ScopeConfig["plugins"]> = {};

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    const sourceRaw = (mp.source as ParsedSource).raw;
    // SPLIT-01: legacy `autoupdate` is preserved in-memory by the D-13 gate
    // (existsSync(configJsonPath) is false on this first load). Read via cast
    // pattern; rewire to MergedConfig in Phases 54-56.
    const legacyAutoupdate = (mp as unknown as Record<string, unknown>).autoupdate;

    const entry: { source: string; autoupdate?: boolean } = { source: sourceRaw };
    if (legacyAutoupdate === true) {
      entry.autoupdate = true;
    } else if (legacyAutoupdate === false) {
      entry.autoupdate = false;
    }
    marketplaces[mpName] = entry;

    for (const pluginName of Object.keys(mp.plugins)) {
      // Soft-degraded entries (compatibility.installable === false) are
      // included unconditionally -- they're installed in state, so the
      // declared config must show them (MIG-01 losslessness).
      plugins[`${pluginName}@${mpName}`] = {};
    }
  }

  return { schemaVersion: 1, marketplaces, plugins };
}

/**
 * MIG-01 / MIG-02 — ENOENT-gated first-run migrator. Idempotent by
 * construction: only fires when `claude-plugins.json` does not exist.
 *
 * Atomicity inherited from saveConfig -> atomicWriteJson -> write-file-atomic
 * (tmp+fsync+rename). NFR-10 containment inherited from saveConfig's
 * assertPathInside. Schema revalidation inherited from CONFIG_VALIDATOR.Check.
 *
 * NEVER overwrites an existing file (valid or invalid). An invalid config is
 * the user's problem to fix (CFG-03); the reconcile planner aborts on invalid.
 * Migration MUST stay out of that path.
 */
export async function migrateFirstRunConfig(
  loc: ScopedLocations,
  state: ExtensionState,
): Promise<MigrateFirstRunResult> {
  const result = await loadConfig(loc.configJsonPath);
  if (result.status !== "absent") {
    return { migrated: false, entryCount: 0, filePath: loc.configJsonPath };
  }

  const config = buildConfigFromState(state);
  await saveConfig(loc.configJsonPath, config, loc.scopeRoot);

  const entryCount =
    Object.keys(config.marketplaces ?? {}).length +
    Object.keys(config.plugins ?? {}).length;
  return { migrated: true, entryCount, filePath: loc.configJsonPath };
}
```

### Example 2: The data-level convergence test (Pattern 4)

```typescript
// tests/persistence/migrate-config.test.ts (excerpt)
import test from "node:test";
import assert from "node:assert/strict";
import { buildConfigFromState, migrateFirstRunConfig } from "../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";
import { loadConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";

// Helper builds a populated state with two marketplaces, one autoupdate=true,
// and a soft-degraded plugin. (Use the legacy fixture as a template.)
function makePopulatedState(): ExtensionState { /* ... */ }

test("MIG-01 losslessness: every state marketplace + plugin appears in the generated config", () => {
  const state = makePopulatedState();
  const cfg = buildConfigFromState(state);

  assert.deepEqual(
    Object.keys(cfg.marketplaces ?? {}).sort(),
    Object.keys(state.marketplaces).sort(),
  );

  const expectedPluginKeys = Object.entries(state.marketplaces)
    .flatMap(([mp, rec]) => Object.keys(rec.plugins).map(p => `${p}@${mp}`))
    .sort();
  assert.deepEqual(Object.keys(cfg.plugins ?? {}).sort(), expectedPluginKeys);
});

test("MIG-01 soft-degraded entries are included in the generated config (Pitfall 52-1)", () => {
  const state = makePopulatedState(); // contains a plugin with installable: false
  const cfg = buildConfigFromState(state);
  assert.ok("soft-degraded@mp-a" in (cfg.plugins ?? {}));
});

test("MIG-01 source is recovered byte-stably from ParsedSource.raw (Pitfall 52-3)", () => {
  const state = makePopulatedState();
  const cfg = buildConfigFromState(state);
  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    assert.equal(cfg.marketplaces?.[mpName]?.source, (mp.source as ParsedSource).raw);
  }
});

test("MIG-01 D-13 legacy autoupdate is captured (true)", () => {
  const state = makePopulatedState(); // has mp-a with autoupdate=true on the record
  const cfg = buildConfigFromState(state);
  assert.equal(cfg.marketplaces?.["mp-a"]?.autoupdate, true);
});

test("MIG-02 idempotency: migration runs once then short-circuits on subsequent calls", async () => {
  // setup temp scopeRoot with a populated state
  const loc = makeLocFor(scopeRoot);
  const state = makePopulatedState();
  const first = await migrateFirstRunConfig(loc, state);
  assert.equal(first.migrated, true);
  const second = await migrateFirstRunConfig(loc, state);
  assert.equal(second.migrated, false);
  assert.equal(second.entryCount, 0);
});

test("MIG-02 NEVER overwrites an existing invalid config (Pitfall 52-5)", async () => {
  // pre-create a 0-byte claude-plugins.json
  await fs.writeFile(loc.configJsonPath, "");
  const state = makePopulatedState();
  const result = await migrateFirstRunConfig(loc, state);
  assert.equal(result.migrated, false);
  const after = await fs.readFile(loc.configJsonPath, "utf8");
  assert.equal(after, ""); // file unchanged
});

test("MIG-02 atomicity: written file passes CONFIG_VALIDATOR (saveConfig revalidates)", async () => {
  const loc = makeLocFor(scopeRoot);
  const state = makePopulatedState();
  await migrateFirstRunConfig(loc, state);
  const reloaded = await loadConfig(loc.configJsonPath);
  assert.equal(reloaded.status, "valid");
});

test("MIG-02 data-level convergence: merge(generated, {}) entries === state entries", async () => {
  const state = makePopulatedState();
  const cfg = buildConfigFromState(state);
  const merged = mergeScopeConfigs(cfg, {});
  // Same marketplace set with provenance "base"
  assert.deepEqual(Object.keys(merged.marketplaces).sort(), Object.keys(state.marketplaces).sort());
  for (const v of Object.values(merged.marketplaces)) {
    assert.equal(v.source, "base");
  }
  // Same plugin set
  const expected = Object.entries(state.marketplaces)
    .flatMap(([mp, rec]) => Object.keys(rec.plugins).map(p => `${p}@${mp}`))
    .sort();
  assert.deepEqual(Object.keys(merged.plugins).sort(), expected);
});
```

### Example 3: Test fixture extension (or new fixture)

The existing `tests/persistence/fixtures/legacy/state-with-autoupdate.json` covers a single marketplace with `autoupdate: true` and one plugin. Phase 52 needs a fixture with:
- At least 2 marketplaces (one autoupdate=true, one without)
- At least one plugin with `compatibility.installable === false`
- At least 2 plugins with the SAME plugin name across different marketplaces (Pitfall 52-6)

Either extend the existing fixture or add a sibling `state-populated-mixed.json`. The new fixture path:

```
tests/persistence/fixtures/legacy/state-populated-mixed.json
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One-way "migration runner" with a flag stored in state | ENOENT-driven idempotency through an atomic-write seam | Phase 51 (this milestone) shipped the trichotomy and the SPLIT-02 seam | Simpler, no schema bump, free atomicity |
| Hand-rolled tmp+rename per call site | Single shared `atomicWriteJson` -> `write-file-atomic` seam | v1.0 + Phase 51 (config seam reuse) | NFR-1 closed in one place; SPLIT-02 architecture test enforces ownership |
| Field-level merge for config overlays | Entry-level merge with provenance | Phase 51-02 | Phase 52 consumes the merged shape for the data-level convergence test |

**Deprecated/outdated:**
- "Hand-rolled fs-extra-style JSON migrators with custom rollback" — Phase 51's `saveConfig` does this for us via the architecture-test-enforced seam.
- "Migration via npm-script preinstall hook" — Pi extensions ship `.ts` source loaded by the host; there is no install step the extension controls.

## Assumptions Log

> All claims tagged `[ASSUMED]` in this research. The planner and discuss-phase should treat these as needing confirmation before becoming locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Routing the migration write through `saveConfig` (not direct `atomicWriteJson`) means `migrate-config.ts` does NOT need to be added to `ALLOWED_CONFIG_JSON_WRITERS`. | Pattern 3 + the contradiction with CONTEXT.md | If `WRONG`, the architecture test will RED on the first commit that introduces `migrate-config.ts`. The fix is either (a) add the file to `ALLOWED_CONFIG_JSON_WRITERS` AND update the "exactly N" sibling assertion, or (b) route through `saveConfig` (already the recommendation). The plan SHOULD spike this assumption with a quick read of the regex and confirm or stand by my finding; my reading is `[VERIFIED]` against the test source. |
| A2 | Soft-degraded entries (`installable: false`) should appear in the generated config exactly as installed-plugin entries do (i.e., flat-keyed, empty body). | Pattern 2 + Pitfall 52-1 | If wrong (e.g., the planner decides soft-degraded entries need an explicit marker), the projection adds a per-entry field; the change is localized to the projection function. The success criterion's "including soft-degraded `unavailable` ones" language strongly supports the recommended approach. |
| A3 | The Phase 52 plan defers Success Criterion 4's planner-level proof to Phase 53 and satisfies the criterion in Phase 52 at the data level (entry-set equality + provenance). | Pattern 4 | If the user reads SC4 strictly as requiring an actual `planReconcile` invocation, Phase 52 cannot satisfy it (planner does not exist) — must explicitly defer. The plan SHOULD raise this as a cross-phase note and not silently re-interpret the criterion. |
| A4 | Phase 55 is the right home for the load wiring (who calls `migrateFirstRunConfig` and where). | Architectural Responsibility Map + the phase boundary statement in CONTEXT.md | Cross-phase boundary already locked by ROADMAP: "the load wiring in Phase 55 places migrate-then-reconcile in that order." Strong precedent; low risk. |
| A5 | Capturing `autoupdate: false` (explicit false on a state record) is meaningful enough to emit, vs. only emitting `autoupdate: true`. | Code Example 1 (the projection) | If the user prefers to emit ONLY `autoupdate: true` (treating omission as the default-off state), the projection drops the `else if` branch. Cheap to flip. D-04 "undefined === false" supports either interpretation; the recommendation emits explicit `false` to preserve user intent without ambiguity. |
| A6 | The new fixture lives under `tests/persistence/fixtures/legacy/`. | Recommended Project Structure | A5 (Phase 51 research) verifies that directory exists. Trivial cosmetic fix if the planner prefers a different home. |
| A7 | The `MigrateFirstRunResult` shape (migrated/entryCount/filePath) is the right return signal for Phase 55 to consume. | Pattern 1 / Code Example 1 | If Phase 55 needs additional fields (e.g., per-entry list for notify), the shape extends without breaking. Low risk. |

## Open Questions

1. **Should `migrate-config.ts` live in `persistence/` or a new `orchestrators/migrate/` directory?**
   - What we know: Phase 51 placed every config/state-related helper under `persistence/` (`config-io.ts`, `config-merge.ts`, `state-io.ts`, `migrate.ts`, `locations.ts`). The Phase 52 module sits at exactly the same architectural tier and has the same "no orchestrator dependencies" profile.
   - What's unclear: Whether the load-wiring caller (Phase 55) prefers a sibling `orchestrators/migrate/first-run.ts` so the orchestrator-layer-only import boundary stays clean.
   - Recommendation: Place in `persistence/migrate-config.ts`. The orchestrator-layer caller imports it the same way it imports `loadState` / `saveConfig`. Phase 55 owns the orchestrator-side glue separately.

2. **Should the projection drop the `schemaVersion: 1` field to exercise D-11's Optional?**
   - What we know: D-11 makes `schemaVersion` Optional (`Type.Optional(Type.Literal(1))`). The generated file is the FIRST file the user ever sees in v1.12 — including `schemaVersion: 1` makes the contract self-documenting; omitting it produces a smaller file.
   - Recommendation: Emit `schemaVersion: 1`. Self-documentation for upgraders who hand-edit the file outweighs the 23 bytes of size.

3. **Does the Phase 52 plan need a `checkpoint:human-verify` for "should migration emit `autoupdate: false`"?**
   - What we know: A5 above flags this as a discretion call.
   - Recommendation: Include in the discuss-phase if the planner enables it; otherwise, default to "emit explicit false" with a one-line rationale in the projection and let the user file an issue if they disagree.

4. **Does Success Criterion 4 require the migrate-then-reconcile test to live in Phase 52 (where it cannot fully run) or in Phase 53?**
   - What we know: SC4 mentions a "migrate-then-reconcile exit-gate test on a populated state.json fixture." The planner does not exist until Phase 53.
   - Recommendation: Phase 52 ships data-level convergence (Pattern 4 example 1); Phase 53 ships the planner-level convergence test as one of its acceptance criteria. Document the deferral in both phase plans; cross-link via D-17 (or a new D-22) decision in STATE.md.

## Environment Availability

> Skipped — Phase 52 has no external dependencies (code-only addition). Node 22.18+ + the shipped npm dependencies cover everything.

## Validation Architecture

> Phase 52 includes this section since `workflow.nyquist_validation` is not explicitly disabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22.18+ built-in) |
| Config file | none (uses package.json scripts) |
| Quick run command | `node --test tests/persistence/migrate-config.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MIG-01 | Every state marketplace + plugin in the generated config | unit | `node --test tests/persistence/migrate-config.test.ts` | ❌ Wave 0 |
| MIG-01 | Soft-degraded plugins included (Pitfall 52-1) | unit | same | ❌ Wave 0 |
| MIG-01 | Source recovered byte-stably from `ParsedSource.raw` (Pitfall 52-3) | unit | same | ❌ Wave 0 |
| MIG-01 | D-13 legacy `autoupdate` captured | unit | same | ❌ Wave 0 |
| MIG-01 | Plugin key collision-free across marketplaces (Pitfall 52-6) | unit | same | ❌ Wave 0 |
| MIG-02 | Idempotency: second call short-circuits | integration | same | ❌ Wave 0 |
| MIG-02 | NEVER overwrites existing valid OR invalid config (Pitfall 52-5) | integration | same | ❌ Wave 0 |
| MIG-02 | Atomicity proxy: written file passes `CONFIG_VALIDATOR` | integration | same | ❌ Wave 0 |
| MIG-02 | Data-level convergence: `mergeScopeConfigs(generated, {})` mirrors state | unit | same | ❌ Wave 0 |
| MIG-02 (deferred) | Planner-level convergence: `planReconcile` returns empty | unit (Phase 53) | — | Phase 53 |

### Sampling Rate
- **Per task commit:** `node --test tests/persistence/migrate-config.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` GREEN end-to-end before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/persistence/migrate-config.test.ts` — covers MIG-01 + MIG-02 unit and integration behaviors
- [ ] `tests/persistence/fixtures/legacy/state-populated-mixed.json` — populated fixture with 2 marketplaces, one autoupdate=true, one soft-degraded plugin, two same-named plugins across marketplaces
- [ ] `extensions/pi-claude-marketplace/persistence/migrate-config.ts` — the seam itself
- [ ] (Conditional, only if A1 turns out wrong) `tests/architecture/config-state-write-seams.test.ts` — add `migrate-config.ts` to `ALLOWED_CONFIG_JSON_WRITERS` AND update the "exactly one file" assertion to two entries

No framework install needed — `node:test` is built-in and Phase 51 already exercises it across 1549 unit + 7 integration tests.

## Security Domain

> Required (no `security_enforcement: false` in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth surface in this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — single-user local extension |
| V5 Input Validation | yes | `CONFIG_VALIDATOR.Check(config)` inside `saveConfig` (typebox JIT validator); SPLIT-01 cast read of `autoupdate` is type-narrowed (`=== true` / `=== false`) so a malformed legacy value (e.g. `"yes"`) is silently treated as undefined and omitted — defense in depth against a forward-tampered state.json |
| V6 Cryptography | no | N/A — no cryptographic operations |
| V12 Files and Resources | yes | `assertPathInside(scopeRoot, filePath, "saveConfig")` runs inside `saveConfig` BEFORE the atomic write (NFR-10 / Pitfall 51-5). The migration's `filePath` is `loc.configJsonPath`, which `locationsFor` constructs from `scopeRoot` + hard-coded suffix — structurally inside scope, so `assertPathInside` always passes for the standard path. A malicious in-process mutation of `loc.configJsonPath` (e.g., test-helper bug) would trip `PathContainmentError` at the seam. |

### Known Threat Patterns for the persistence layer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Symlink at `claude-plugins.json` pointing outside scope | Tampering / EoP | `assertPathInside` is symlink-aware via `D-14` in `path-safety.ts`; rejects symlinks in the resolved path with `SymlinkRefusedError`. The migration trusts this seam — no new probe required. |
| Power loss mid-write of generated config | DoS (partial state) | `write-file-atomic` writes tmp + fsync + atomic rename; partial writes never become observable. ENOENT detection re-runs migration cleanly on next load (NFR-3). |
| Concurrent first-loads in same scope racing on `saveConfig` | Tampering / Conflict | `write-file-atomic`'s internal queue serializes; last-writer-wins. Phase 55 is expected to call inside scope lock for stronger ordering (Pitfall 52-2 carried into Phase 55). |
| Schema-invalid generated config (caller bug) | Integrity | `CONFIG_VALIDATOR.Check` inside `saveConfig` raises `saveConfig refused: ...` before the disk touch. |
| Forward-tampered legacy `autoupdate` value (e.g., string "yes") | Tampering | The projection's `=== true` / `=== false` comparison silently drops non-boolean values to "omit". User intent is preserved when present and valid; tampering is ignored without breaking the migration. |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/persistence/config-io.ts` (Phase 51-01) — `CONFIG_SCHEMA`, `ConfigLoadResult` trichotomy, `saveConfig` order-of-operations (validate -> assertPathInside -> atomicWriteJson)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (Phase 51-02) — `ExtensionState` shape, `loadState`'s D-13 `existsSync(configJsonPath)` gate at line 199-200, source-record normalization
- `extensions/pi-claude-marketplace/persistence/migrate.ts` (Phase 51-02) — `migrateLegacyMarketplaceRecords`, `ensureNoLegacyAutoupdate` D-13 helper, `persistMigratedState` IL-3 fire-and-forget
- `extensions/pi-claude-marketplace/persistence/config-merge.ts` (Phase 51-02) — `mergeScopeConfigs` pure entry-level reducer; consumed by the data-level convergence test
- `extensions/pi-claude-marketplace/persistence/locations.ts` (Phase 51-01) — `configJsonPath` / `configLocalJsonPath` / `scopeRoot` derivation
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` — `atomicWriteJson` -> `write-file-atomic` (tmp + fsync + atomic rename)
- `extensions/pi-claude-marketplace/shared/path-safety.ts` — `assertPathInside` + symlink rejection
- `extensions/pi-claude-marketplace/domain/source.ts` — `ParsedSource` discriminated union; `.raw` field SP-7 verbatim preservation
- `tests/architecture/config-state-write-seams.test.ts` — SPLIT-02 `ALLOWED_CONFIG_JSON_WRITERS`; regex matches `atomicWriteJson(...)` patterns, NOT `saveConfig` (confirms A1)
- `tests/persistence/migrate.test.ts` — D-13 GATE CLOSED / GATE OPEN / idempotency reference tests
- `tests/persistence/fixtures/legacy/state-with-autoupdate.json` — fixture template for the Phase 52 extension
- `.planning/phases/51-config-schema-persistence-state-split/51-01-SUMMARY.md`, `51-02-SUMMARY.md`, `51-03-SUMMARY.md` — Phase 51 frozen-foundation summaries
- `.planning/phases/51-config-schema-persistence-state-split/51-RESEARCH.md` — D-12/D-13/D-14 specification, Pitfall 51-1/51-4/51-5/51-6 rationale
- `.planning/REQUIREMENTS.md` — MIG-01 / MIG-02 verbatim text
- `.planning/ROADMAP.md` — Phase 52 success criteria (1-4); Phase 53/55 boundary
- `.planning/STATE.md` — D-13 ordering rail decision, SPLIT-01 cast migration record

### Secondary (MEDIUM confidence)
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` — `loadState(locations.extensionRoot)` reference call shape for Phase 55's planned wiring
- `tests/persistence/config-merge.test.ts` — entry-level reducer matrix (consulted to confirm convergence test shape)

### Tertiary (LOW confidence)
- None used as load-bearing claims.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entirely Phase 51 + shared primitives, no new packages
- Architecture: HIGH — direct application of Phase 51 patterns (Pattern 3 mirror)
- Pitfalls: HIGH — derived from inspecting Phase 51 D-13 implementation and CONFIG_SCHEMA shape; each pitfall has a concrete code anchor
- The architecture-test interpretation in A1: HIGH — verified by reading `tests/architecture/config-state-write-seams.test.ts` lines 102-104 and 110-128 directly
- The cross-phase deferral (Pattern 4 / A3): MEDIUM — clearly the correct interpretation given the phase boundary, but a strict reading of SC4 leaves the planner with a discretion call

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days — stable foundation, Phase 51 frozen)
