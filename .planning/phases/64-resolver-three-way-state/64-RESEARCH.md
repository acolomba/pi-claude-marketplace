# Phase 64: Resolver Three-Way State - Research

**Researched:** 2026-06-26
**Domain:** TypeScript discriminated-union refactor of `domain/resolver.ts` (TypeBox 1.x literal-tagged union, NFR-7 compile enforcement)
**Confidence:** HIGH (every claim grounded in repo source at cited line numbers; no external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-64-01 (RSTATE-01):** Use a string-literal discriminant `state: "installable" | "unsupported" | "unavailable"`; drop the `installable: true | false` boolean. Supersedes **D-05** (boolean form). Consumers narrow via `switch (r.state)` / `if (r.state === …)`. TypeBox 1.x `Type.Union([...])` still takes NO `discriminator` option — the literal-tagged `state` field IS the discriminator.
- **D-64-02 (RSTATE-05):** Derive per-kind unsupported markers at RENDER time from the `unsupported` / component lists via a shared helper consumed by both `list` and `info`. Keep structural reasons in the existing reasons array. Do NOT introduce a structured `{kind, reason}[]` type on the resolver output.
- **D-64-03 (RSTATE-04):** Hard-migrate every `if (r.installable)` call site — no back-compat `isInstallable()` shim. Let the compiler surface all sites.
- **D-64-04 (RSTATE-04):** Two narrowing gates: `requireInstallable` narrows to `installable` only (default path; preserve current throw behavior — `kind: "not-installable"` / `"no-longer-installable"`), and a NEW `requireForceInstallable` narrows to `installable | unsupported` (rejects `unavailable`).
- **D-64-05 (RSTATE-03):** `unavailable` is MINIMAL: `state`, `name`, structural reasons (`notes`), and `notes` only. Never carries `pluginRoot` (NFR-7, compile-enforced); drops `orphanRewake` / `hooksConfigPath` / the component lists.
- **D-64-06 (RSTATE-03):** `unsupported` carries `pluginRoot` PLUS the supported and unsupported component lists (and the symmetric markers it can populate). The force-degradable arm.
- **D-64-07 (RSTATE-02):** Structural precedence: a plugin BOTH structurally broken AND with unsupported component kinds resolves `unavailable` — the structural defect wins.

### Claude's Discretion
- Exact internal helper names, the shape of the shared render helper (D-64-02), and whether `installable()` / `notInstallable()` factory helpers are renamed/split into three — provided the public union and gates match the decisions.
- `info.ts` keeps its own lenient path-source component re-derivation (quick task `260618-qkz`); it re-resolves independently and does NOT read the minimal `unavailable` arm, so D-64-05 does not regress it.

### Deferred Ideas (OUT OF SCOPE)
- `--force` install/update behavior — Phase 65.
- Derived force-installed / force-upgradable states, glyphs, will-force preview tokens, `info` detail — Phase 66.
- List filters, completion sets, reinstall-as-repair — Phase 67.
- Load-time backfill of previously-skipped components — Phase 68.
- Force-path notification severities — Phase 69.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSTATE-01 | Three-way discriminated state replacing binary `installable: true\|false` | Schema split + factory split documented in Architecture Patterns; discriminant narrowing verified against existing literal-tagged-union pattern (resolver.ts:102-110) |
| RSTATE-02 | Structural defect → `unavailable`, precedence over unsupported kinds | "Two-accumulator" decision logic in Pattern 2; structural vs unsupported source map (Dirty-Source Classification table) |
| RSTATE-03 | `unsupported` carries `pluginRoot`+lists; `unavailable` exposes `pluginRoot` to nobody (compile-enforced) | Field-set table (Pattern 1); NFR-7 test extension (Validation Architecture) |
| RSTATE-04 | Two gates: `requireInstallable` (→`installable`) and `requireForceInstallable` (→`installable\|unsupported`) | Gate signatures in Pattern 3; call-site inventory (no force consumers in this phase) |
| RSTATE-05 | Per-kind unsupported reasons derived from component list, identical across `list`/`info`/force states | Shared render-helper analysis (Pattern 4); current 3-way duplication of `narrowResolverNotes` documented |
</phase_requirements>

## Summary

Phase 64 is a self-contained, compiler-driven type refactor of one file (`domain/resolver.ts`) plus a small, fully enumerable set of consumer edits. The resolver today returns a two-arm TypeBox union discriminated by a boolean literal `installable: true | false` (resolver.ts:58-110). The work replaces that with a three-arm union discriminated by a string literal `state: "installable" | "unsupported" | "unavailable"`, splits the `installable()` / `notInstallable()` factories to cover three states, adds a second narrowing gate `requireForceInstallable` beside `requireInstallable` (resolver.ts:1007), and re-points every consumer that reads `r.installable` to `r.state`.

The single most important architectural insight: **the resolver's decision today is a single accumulated `dirty` boolean** (`resolveStrict` line 949 / `resolveLoose` line 995: `return dirty ? notInstallable(...) : installable(...)`). The three-way split requires splitting `dirty` into two signals — a **structural-defect** signal and an **unsupported-component** signal — and applying D-64-07 precedence (structural wins). The mapping is almost mechanical: exactly one helper, `addUnsupportedKindNotes` (resolver.ts:880), contributes the *unsupported-component* signal (it pushes to `partial.unsupported`); every other `dirty` contributor and every `preflightStages` short-circuit is a *structural* defect → `unavailable`.

The second critical insight: there are **two unrelated `installable` concepts in this codebase**, and only one is in scope. The resolver-union discriminant (`ResolvedPlugin.installable`) is what changes. The **persisted** `state.json` field `compatibility.installable: boolean` (state-io.ts:58) is a different thing — read by reconcile/enable-disable/update via `record.compatibility.installable && !record.enabled` (plan.ts:270, enable-disable.ts:184, update.ts:968) — and is OUT OF SCOPE for Phase 64 (no state migration; that is Phase 66/68). The planner must not touch persisted-state branches.

**Primary recommendation:** Make `unsupported` shape-identical to `installable` (same fields including `pluginRoot` + `componentPaths` + `mcpServers` + `hooksConfigPath` + `orphanRewake`, differing only by the `state` tag), make `unavailable` a minimal three-field arm (`state`, `name`, `notes`), split the `dirty` boolean into `structuralDirty` + `unsupported.length > 0`, and let `tsc --noEmit` (the `typecheck` script) enumerate the consumer-migration surface. Add `requireForceInstallable` with no production call sites this phase (Phase 65 wires it); cover it by tests only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Three-way state classification | Domain (`domain/resolver.ts`) | — | The resolver is the sole producer of `ResolvedPlugin`; classification is pure domain logic over disk probes |
| Compile-time `pluginRoot` non-readability (NFR-7) | TypeScript type system | Domain (schema authoring) | Enforced by the discriminated union shape + `tests/domain/resolver.types.test.ts` `@ts-expect-error` |
| Narrowing gates (`requireInstallable` / `requireForceInstallable`) | Domain (`resolver.ts`) | Orchestrators (callers) | Gates are assertion functions co-located with the union; orchestrators consume the narrowed type |
| Per-kind unsupported markers | Presentation / render (`shared/probe-classifiers.ts` + `list.ts` + `info.ts`) | Domain (supplies `unsupported[]` + `notes[]`) | D-64-02: markers derived at RENDER time, not a resolver field |
| Persisted `compatibility.installable` boolean | Persistence (`state.json` schema) | — | OUT OF SCOPE — derived elsewhere, no migration this phase |

## Standard Stack

No new dependencies. This is a refactor of existing TypeScript using the already-installed toolchain.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `1.2.14` installed (range `^1.1.38`) | Runtime schema + `Type.Static` for the discriminated union | Already the resolver's union mechanism (resolver.ts:30, 103); literal-tagged variants narrow with NO `discriminator` option `[VERIFIED: node_modules/typebox/package.json]` |
| TypeScript | `^5.9.x` | `tsc --noEmit` is the load-bearing NFR-7 check and the migration-surface enumerator | `npm run typecheck` is part of `npm run check` `[VERIFIED: package.json scripts]` |
| `node:test` | bundled (Node ≥20.19.0) | Resolver unit tests + `.types.test.ts` smoke + `@ts-expect-error` host | Existing test framework `[VERIFIED: package.json test script]` |

**Installation:** None. `git status` clean; no `npm install` required for this phase.

## Package Legitimacy Audit

Not applicable — Phase 64 installs no external packages (pure in-repo TypeScript refactor). No registry interaction.

## Architecture Patterns

### System Architecture: where the state is produced and consumed

```
                      PluginEntry (from marketplace manifest)
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   preflightStages()      │  source-kind / escape / dir-missing /
                    │   (resolver.ts:415)      │  malformed plugin.json
                    └────────────┬─────────────┘
                       short-circuit │  ok ┌────────────────────────────────┐
                       (STRUCTURAL)  │     │ resolveStrict / resolveLoose    │
                                     │     │ steps 7-10 accumulate `dirty`:  │
                                     │     │  • component-path validation    │ STRUCTURAL
                                     │     │  • mcp parse / conflict         │ STRUCTURAL
                                     │     │  • hooks parse (applyHooksConfig)│ STRUCTURAL (D-64-07)
                                     │     │  • addUnsupportedKindNotes ─────┼─ UNSUPPORTED
                                     │     └──────────────┬──────────────────┘
                                     ▼                    ▼
                          ┌─────────────────── THREE-WAY DECISION ───────────────────┐
                          │ structuralDirty            → unavailable (minimal arm)    │
                          │ else unsupported.length>0  → unsupported (pluginRoot+lists)│
                          │ else                       → installable                  │
                          └──────────────────────────┬────────────────────────────────┘
                                                     │  ResolvedPlugin
            ┌──────────────────┬─────────────────────┼───────────────────┬──────────────────┐
            ▼                  ▼                     ▼                   ▼                  ▼
      requireInstallable  requireForceInstallable  list.ts:350      info.ts:720/801   edge-deps.ts:152
      (install/update/    (ADDED; NO callers       (render row)     (render row)      (completion cache)
       reinstall)          this phase — Phase 65)
```

### Pattern 1: Three-arm schema with shape-identical `installable`/`unsupported` and minimal `unavailable`

**What:** Replace the two `Type.Object` schemas (resolver.ts:58-100) and their union (103-106) with three.

**Field-set table** (the precise migration of every field):

| Field | `installable` | `unsupported` | `unavailable` |
|-------|:-:|:-:|:-:|
| `state` literal | `"installable"` | `"unsupported"` | `"unavailable"` |
| `name` | ✓ | ✓ | ✓ |
| `pluginRoot` | ✓ (NFR-7) | ✓ (D-64-06) | ✗ (NFR-7, compile-enforced) |
| `supported: string[]` | ✓ | ✓ (D-64-06) | ✗ (D-64-05) |
| `unsupported: string[]` | ✓ | ✓ (D-64-06) | ✗ (D-64-05) |
| `notes: string[]` | ✓ | ✓ | ✓ (structural reasons) |
| `componentPaths` | ✓ | ✓ (needed by Phase 65 + info) | ✗ (D-64-05) |
| `mcpServers` | ✓ | ✓ (needed by Phase 65 + info) | ✗ (D-64-05) |
| `hooksConfigPath?` | ✓ | ✓ | ✗ (D-64-05) |
| `orphanRewake?` | ✓ | ✓ | ✗ (D-64-05) |

**Strong recommendation:** make `unsupported` carry the *full* installable payload (not just the supported/unsupported lists D-64-06 names explicitly). D-64-06 names the lists because they distinguish it from the minimal arm, but Phase 65's force-install path must materialize the supported components and therefore needs `componentPaths` + `mcpServers` + `hooksConfigPath` on this arm, and `info.ts`'s installed-but-now-`unsupported` row enumerates components from the same fields (info.ts:649-687, `buildNotInstallablePathRowFields` reads `componentPaths`/`mcpServers`/`hooksConfigPath`). Treating D-64-06's list as a floor, not a ceiling, keeps both consumers working and makes `unsupported` literally "installable with a different tag." `[CITED: CONTEXT D-64-06]` `[VERIFIED: info.ts:649-687, 450-503]`

**Example (current → target shape):**
```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:58-106 (current)
const ResolvedPluginInstallableSchema = Type.Object({
  installable: Type.Literal(true),   // → state: Type.Literal("installable")
  name: Type.String(),
  pluginRoot: Type.String(),
  // … supported, unsupported, notes, componentPaths, mcpServers,
  //    hooksConfigPath?, orphanRewake?
});
// ResolvedPluginNotInstallableSchema: same minus pluginRoot
export const ResolvedPluginSchema = Type.Union([ /* two arms */ ]);  // NO discriminator opt
```
Target: three `Type.Object` schemas, each with `state: Type.Literal("installable"|"unsupported"|"unavailable")`, unioned the same way (still NO `discriminator` option — the literal `state` field drives TS narrowing exactly as the boolean literal does today). Export `ResolvedPluginUnsupported` / `ResolvedPluginUnavailable` types and update `domain/index.ts:29-40` re-exports.

### Pattern 2: Two-accumulator decision (RSTATE-02 / D-64-07 structural precedence)

**What:** Split the single `dirty` boolean (resolveStrict:912/949, resolveLoose:966/995) into structural vs unsupported.

**Dirty-Source Classification** — every contributor to today's `dirty`, mapped:

| Contributor | Location | New bucket |
|-------------|----------|-----------|
| `preflightStages` short-circuit (bad source kind, escape, dir missing, malformed plugin.json) | resolver.ts:415-471 | **structural → unavailable** |
| `collectStrictComponentKind` / `collectLooseComponentKind` path-validation failure | 590-616 / 820-852 | **structural → unavailable** |
| `applyStrictMcp` / `applyLooseMcp` malformed-or-conflict | 801-818 / 854-878 | **structural → unavailable** |
| `applyHooksConfig` parse failure (`malformed hooks.json:`) | 750-779 | **structural → unavailable** (D-64-07 names malformed hooks.json) |
| `addUnsupportedKindNotes` (pushes to `partial.unsupported`) | 880-895 | **unsupported → unsupported** |

**Decision logic (replaces line 949 / 995):**
```
if (structuralDirty) return unavailable(name, structuralNotes);   // precedence: structural wins
if (partial.unsupported.length > 0) return unsupported(name, pluginRoot, partial);
return installable(name, pluginRoot, partial);
```
Because `addUnsupportedKindNotes` is the *only* unsupported-signal source and runs at step 9 (after all structural steps), the planner can either (a) thread a separate `structuralDirty` boolean through every helper except `addUnsupportedKindNotes`, or (b) keep the existing per-helper `dirty` returns but XOR out the `addUnsupportedKindNotes` contribution and test `partial.unsupported.length` directly. Option (b) is lower-churn: keep `dirty` for the structural helpers, drop `addUnsupportedKindNotes` out of the `dirty` chain, and branch on `dirty` (structural) then `partial.unsupported.length`.

**Anti-pattern to avoid:** deriving `unavailable` vs `unsupported` from `notes` string prefixes. The notes are free-form; the authoritative signal is *which helper fired*. Use the structural accumulator, not string matching.

### Pattern 3: Two narrowing gates (D-64-04 / RSTATE-04)

**What:** Keep `requireInstallable` narrowing to `installable` only; add `requireForceInstallable` narrowing to `installable | unsupported`.

```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:1007-1020 (current shape)
export function requireInstallable(
  r: ResolvedPlugin, op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable {
  if (r.state === "installable") return;        // was: if (r.installable) return;
  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name, reasons: r.notes,
  });
}

// NEW (D-64-04): force path. Admits unsupported; still rejects unavailable.
export function requireForceInstallable(
  r: ResolvedPlugin, op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable | ResolvedPluginUnsupported {
  if (r.state === "installable" || r.state === "unsupported") return;
  throw new PluginShapeError({ kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name, reasons: r.notes });
}
```
**Important:** `requireForceInstallable` has **zero production call sites in Phase 64** (the `--force` flag plumbing is Phase 65). It must exist, be exported (`domain/index.ts`), and be covered by tests only this phase. The throw shape mirrors `requireInstallable`; `r.notes` exists on all three arms so the `reasons` access compiles for both gates.

### Pattern 4: Shared render-time per-kind markers (D-64-02 / RSTATE-05)

**What:** Today, three near-duplicate note-narrowing implementations derive per-kind unsupported markers from the `notes` array:
1. `shared/probe-classifiers.ts::narrowResolverNotes` (probe-classifiers.ts:87) — used by `list.ts:362` (aliased `sharedNarrowResolverNotes`) and `info.ts:664,803`.
2. `install.ts` local copy (install.ts:1693-1707) — same `startsWith("unsupported hooks:")` / `lsp` logic for the install error surface.

D-64-02 directs deriving markers from the `unsupported` / component *lists* (not a new resolver field) via a shared helper consumed by `list` and `info`, guaranteeing identical render across `list`, `info`, and (future) force states.

**Recommendation:** introduce one shared helper (in `shared/probe-classifiers.ts`, the sanctioned cross-orchestrator import surface per its header at probe-classifiers.ts:9) that maps the `unsupported: string[]` kind list (e.g. `"lspServers"` → `lsp`) and the hooks marker to the closed REASON set, and call it from `list`, `info`, and the `install` error path so the third duplicate (install.ts:1693) collapses too. **Caveat:** today's `unsupported hooks` marker is NOT derived from `unsupported[]` — a hooks parse failure pushes a `note` and (under the new model) routes to **`unavailable`**, so its structural reason stays in `notes`. The planner must reconcile: per-kind markers (lsp, future component kinds) come from `unsupported[]` on the `unsupported` arm; the hooks-structural reason stays a `notes`/structural reason on the `unavailable` arm. This is consistent with D-64-02 ("keep structural reasons in the existing reasons array") but means RSTATE-05's "including … unsupported hooks identical across surfaces" is satisfied via the structural-reason path, not the per-kind-marker path. Flag for the planner to confirm the marker family scope. `[VERIFIED: probe-classifiers.ts:87-123, install.ts:1693-1707, resolver.ts:700-701]`

### Anti-Patterns to Avoid
- **Back-compat `isInstallable()` shim** — explicitly forbidden by D-64-03; reintroduces a boolean back-door that re-admits reading `pluginRoot`.
- **Touching `compatibility.installable` (persisted boolean)** — out of scope; `record.compatibility.installable && !record.enabled` (plan.ts:270, enable-disable.ts:184, update.ts:968) reads `state.json`, not the resolver union.
- **String-matching `notes` to decide the arm** — use the structural accumulator (Pattern 2).
- **GSD phase/plan refs in comments/test titles** — `.claude/rules/typescript-comments.md`: use `D-64-NN`, `RSTATE-NN`, `NFR-7`. Update the resolver header comment (resolver.ts:11-24) that currently cites D-05/`installable: true|false` to reference D-64-01; the PRD §6.4 rewrite is Phase 70 (DOC-01), NOT this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discriminated-union narrowing | Manual type guards / `as` casts | TypeBox literal-tagged `state` union + TS control-flow narrowing | Already the resolver's mechanism; `switch (r.state)` narrows automatically (no `discriminator` option) |
| NFR-7 enforcement | Runtime guards on `pluginRoot` | The type system + `tests/domain/resolver.types.test.ts` `@ts-expect-error` | Compile-time is stronger and free; the existing test is the template |
| Migration-surface discovery | Manual grep audit | `tsc --noEmit` (`npm run typecheck`) | D-64-03's whole point — the compiler enumerates every stale `r.installable` site |
| Per-kind reason narrowing | A 3rd/4th copy of the marker logic | One shared helper in `shared/probe-classifiers.ts` | Three copies already drift-prone; D-64-02 mandates one shared render helper |

**Key insight:** the compiler is the migration tool. After changing the union, `npm run typecheck` fails at exactly the consumer sites listed below — there is no need to find them by hand, and a green typecheck is proof the surface is fully migrated.

## Runtime State Inventory

> This is a type-level/code-only refactor. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry the renamed discriminant — `ResolvedPlugin` is an in-memory value produced fresh on every resolve and never serialized.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** The resolver union is never persisted. The persisted `state.json` field `compatibility.installable: boolean` (state-io.ts:58) is a SEPARATE schema, unchanged this phase. | None — verified by grep: no serialization of `ResolvedPlugin`; install/update/reinstall write `compatibility` from `installable.{notes,supported,unsupported}` which still exist on the `installable` arm |
| Live service config | None — pure in-process domain logic. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None. | None |
| Build artifacts | None — no codegen, no `.d.ts` emit (`tsc --noEmit`). | None — verified by `typecheck` script |

**The canonical question — what runtime systems still hold the old shape after all files update?** Nothing. The union is constructed and consumed within a single resolve call. The only cross-boundary value is the *persisted* `compatibility` record, which is a distinct boolean schema the planner must leave alone.

## Migration Surface (the RSTATE-04 consumer inventory)

**Resolver-union consumers** (`r: ResolvedPlugin` reading `.installable` — these MUST migrate to `r.state`):

| # | File:line | What it does | Gate needed |
|---|-----------|--------------|-------------|
| 1 | `domain/resolver.ts:1011` (inside `requireInstallable`) | `if (r.installable)` → `if (r.state === "installable")` | n/a (gate body) |
| 2 | `domain/resolver.ts:949,995` (resolveStrict/Loose return) | `dirty ? notInstallable : installable` → three-way decision (Pattern 2) | n/a (producer) |
| 3 | `orchestrators/plugin/install.ts:474` | `requireInstallable(resolved, "install")` — call unchanged; stays default (non-force) path this phase | `requireInstallable` |
| 4 | `orchestrators/plugin/update.ts:710` | `requireInstallable(resolved, "update")` — unchanged | `requireInstallable` |
| 5 | `orchestrators/plugin/reinstall.ts:1270` | `requireInstallable(resolved, "install")` — unchanged | `requireInstallable` |
| 6 | `orchestrators/plugin/list.ts:350` | `if (resolved.installable)` → `(available)` vs `(unavailable)` row; must now distinguish `unsupported`/`unavailable` (still both render `(unavailable)` this phase) | branch on `r.state` |
| 7 | `orchestrators/plugin/info.ts:720` | `if (resolved.installable)` (installed-row path) | branch on `r.state` |
| 8 | `orchestrators/plugin/info.ts:801` | `if (!resolved.installable)` (not-installed-row path) | branch on `r.state` |
| 9 | `orchestrators/edge-deps.ts:152` | `installable = resolved.installable;` (completion cache `available`/`unavailable`) | `r.state === "installable"` |

**Type-only importers of `ResolvedPluginInstallable`** (unaffected — the `installable` arm keeps its shape; these compile unchanged): `bridges/agents/types.ts:18,72`, `bridges/commands/discover.ts:27,69`, `bridges/commands/types.ts:19,39`, `bridges/skills/types.ts:13,33`, `bridges/skills/discover.ts:25,91`, `orchestrators/plugin/{install,reinstall,update,shared,discover-names}.ts` (typed params). No change required unless they should accept `unsupported` (they should NOT this phase — Phase 65).

**`info.ts` lenient re-derivation (discretion note / quick task `260618-qkz`):** `buildNotInstallablePathRowFields` (info.ts:649-687) reads `componentPaths`/`mcpServers`/`hooksConfigPath` off the not-installable resolved value. Under the split it is called for both the new `unsupported` arm (HAS those fields — works as-is) and the new `unavailable` arm (MINIMAL — lacks them). The planner must branch info.ts on `r.state`: for `unsupported`, reuse `buildNotInstallablePathRowFields`; for `unavailable` (structural), info must re-derive components independently from disk (it already re-computes `pluginRoot` via `derivePluginRootForInfo`, info.ts:665, so it never needed `pluginRoot` from the arm) or render `components: not resolved`. See Open Questions #1.

**Out-of-scope (persisted `compatibility.installable`) — DO NOT MIGRATE:** `reconcile/plan.ts:270`, `orchestrators/plugin/enable-disable.ts:184`, `orchestrators/plugin/update.ts:968`, `orchestrators/plugin/reinstall.ts:1747`, `persistence/state-io.ts:58`, `persistence/migrate-config.ts`, `persistence/migrate.ts`. These read/write the `state.json` boolean.

## Common Pitfalls

### Pitfall 1: Conflating the resolver discriminant with the persisted boolean
**What goes wrong:** Migrating `record.compatibility.installable` to `.state` breaks state.json schema and reconcile logic.
**Why:** Both are spelled `installable`; only the `ResolvedPlugin` one is in scope.
**How to avoid:** Confirm the variable's type. `r: ResolvedPlugin` → migrate. `record.compatibility` (a `PluginInstallRecord`) → leave alone.
**Warning sign:** A diff touching `persistence/` or `reconcile/`.

### Pitfall 2: Losing D-64-07 precedence by checking `unsupported.length` before structural
**What goes wrong:** A plugin with both a malformed manifest AND `lspServers` resolves `unsupported`, leaking `pluginRoot` for a structurally broken plugin.
**Why:** Wrong branch order.
**How to avoid:** Structural check FIRST (Pattern 2 decision order). `preflightStages` already short-circuits before unsupported-kind collection runs, so only the steps-7-10 path needs explicit ordering.
**Warning sign:** A test where a broken-manifest + unsupported-kind fixture returns `state === "unsupported"`.

### Pitfall 3: `@ts-expect-error` directives going stale or silently passing
**What goes wrong:** After the rename, `tests/domain/resolver.types.test.ts` either fails to compile (good signal handled wrong) or an `@ts-expect-error` becomes unused (TS reports "Unused @ts-expect-error directive" → typecheck fails).
**Why:** The test narrows on `r.installable` (lines 36,53) which no longer exists; the negative assertion targets `notInst.pluginRoot` (line 49) which becomes `unavailable.pluginRoot`.
**How to avoid:** Rewrite the file for three arms: positive `pluginRoot` reads on both `installable` and `unsupported` after `r.state ===`-narrowing; negative `@ts-expect-error` reads on `unavailable`; add a gate test that `requireForceInstallable` cannot admit `unavailable`.
**Warning sign:** `npm run typecheck` error "Unused @ts-expect-error directive."

### Pitfall 4: `requireForceInstallable` flagged as dead code by lint
**What goes wrong:** No production caller this phase → `no-unused-exports`-style lint or coverage gaps.
**Why:** Phase 65 wires it; Phase 64 only defines it.
**How to avoid:** Export it from `domain/index.ts` and exercise it in resolver tests (admits `installable`+`unsupported`, throws on `unavailable`). Exported symbol + test references satisfy lint.

## Code Examples

### Discriminated narrowing under `switch` (target consumer pattern)
```typescript
// Target shape for list.ts:350 / info.ts:720 / edge-deps.ts:152
switch (resolved.state) {
  case "installable":
    // pluginRoot + componentPaths readable
    break;
  case "unsupported":
    // pluginRoot + lists readable (force-degradable); renders (unavailable) this phase
    break;
  case "unavailable":
    // minimal: name + notes only; pluginRoot is a COMPILE ERROR here (NFR-7)
    break;
}
```

### NFR-7 test extension (three-arm)
```typescript
// Source: tests/domain/resolver.types.test.ts (rewrite)
declare const r: ResolvedPlugin;
if (r.state === "installable" || r.state === "unsupported") {
  void r.pluginRoot;                 // OK — both expose pluginRoot
}
if (r.state === "unavailable") {
  // @ts-expect-error — NFR-7: unavailable never exposes pluginRoot
  void r.pluginRoot;
}
// gate: requireForceInstallable rejects unavailable
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary `installable: true \| false` (D-05, PRD §6.4 PR-1) | Three-way `state: "installable"\|"unsupported"\|"unavailable"` (D-64-01) | Phase 64 | D-05 superseded; PRD §6.4 rewrite deferred to Phase 70 (DOC-01) |
| Single `dirty` boolean decides installable-or-not | Two signals (structural vs unsupported-component) with structural precedence | Phase 64 | Enables "force degrades components, never hard failures" type-enforcement |

**Deprecated/outdated:** The resolver header comment (resolver.ts:11-24) citing D-05 and `if (r.installable)` narrowing is now historically inaccurate — update to D-64-01 (`switch (r.state)`), preserving the accurate "NO `discriminator` option" note.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `unsupported` should carry the FULL installable payload (componentPaths/mcpServers/hooksConfigPath), not only the supported/unsupported lists D-64-06 names | Pattern 1 | If unsupported is truly list-only, Phase 65 force-install and info's `unsupported`-row component enumeration would lack the fields they read — this is a recommendation the planner should confirm against Phase 65's needs |
| A2 | A hooks supportability/parse failure (`malformed hooks.json:`) routes to `unavailable` (structural), per D-64-07's explicit "malformed hooks.json" listing | Pattern 4, Dirty-Source table | If a *supportability trip* (unmapped event) should instead be force-degradable (`unsupported`), the hooks branch needs to split parse-failure (structural) from supportability-trip (unsupported) — a finer classification than today's single `applyHooksConfig` returns. Affects RSTATE-05 marker family scope |
| A3 | `requireForceInstallable` has no production callers this phase | Pattern 3, Migration Surface | If a consumer is expected to adopt it now, the phase scope expands toward Phase 65 |

## Open Questions (RESOLVED)

1. **`info.ts` `unavailable`-arm component rendering.**
   - What we know: `buildNotInstallablePathRowFields` (info.ts:649) reads `componentPaths`/`mcpServers`/`hooksConfigPath`; the minimal `unavailable` arm lacks them. `info.ts` already re-derives `pluginRoot` itself (info.ts:665), so it does not depend on the arm for that.
   - What's unclear: for a path-source plugin that resolves `unavailable` (e.g. malformed manifest), should `info` (a) re-walk disk to list components leniently (the `260618-qkz` re-derivation), or (b) render `components: not resolved` with the structural reason? The current code enumerates from the arm's fields; the minimal arm forces a choice.
   - RESOLVED: branch info on `r.state` — `unsupported` reuses `buildNotInstallablePathRowFields`; `unavailable` renders the structural reason with `componentsResolved: false` (a structurally broken plugin's component enumeration is unreliable, matching D-64-05's rationale). Confirm against the byte contract in `docs/output-catalog.md` before locking.

2. **Marker family scope for RSTATE-05 (see A2).** Whether `unsupported hooks` is a per-kind marker (from `unsupported[]`) or a structural reason (from `notes` on `unavailable`). RESOLVED: structural reason path, since malformed hooks.json is structural per D-64-07; verify the catalog rows for `list`/`info` still emit the same byte form.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TypeScript (`tsc`) | `npm run typecheck` (NFR-7 + migration enumeration) | ✓ | `^5.9.x` (devDep) | — |
| `node:test` | resolver unit + `.types` tests | ✓ | bundled (Node ≥20.19.0) | — |
| `typebox` | union schema | ✓ | 1.2.14 installed | — |

No missing dependencies; no external services. Pure in-repo refactor.

## Validation Architecture

> `nyquist_validation` not disabled in config — section included. This is a type-safety-critical refactor; the type system is itself a load-bearing test.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (bundled) + `tsc --noEmit` |
| Config file | none (Node native test runner; `tsconfig.json` for typecheck) |
| Quick run command | `npm run typecheck` (NFR-7 gate) then `node --test "tests/domain/resolver-*.test.ts" "tests/domain/resolver.types.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format + test + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSTATE-01 | resolve returns one of three `state` values | unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ✅ (migrate every `assert.equal(r.installable, …)` to `assert.equal(r.state, …)`) |
| RSTATE-02 | structural defect + unsupported kind → `unavailable` (precedence) | unit | `node --test tests/domain/resolver-strict.test.ts` | ❌ Wave 0 — add a both-defects fixture |
| RSTATE-03 | `unavailable.pluginRoot` is a compile error; `unsupported.pluginRoot` readable | type | `npm run typecheck` (`tests/domain/resolver.types.test.ts`) | ✅ (rewrite for three arms) |
| RSTATE-04 | `requireInstallable` throws on `unsupported`+`unavailable`; `requireForceInstallable` admits `unsupported`, throws on `unavailable` | unit + type | `node --test tests/domain/resolver-strict.test.ts` + typecheck | ✅ requireInstallable tests exist (strict:593-628); ❌ Wave 0 — add requireForceInstallable tests |
| RSTATE-05 | per-kind markers identical across `list`/`info` | unit | `node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/info.test.ts` | ✅ (existing surfaces) — assert parity post-refactor |

**Test-assertion migration map (the false-assertion split):** existing `assert.equal(r.installable, false)` tests must each become `assert.equal(r.state, "unavailable")` or `"unsupported"`:

| Existing test (file:line) | New `state` |
|---------------------------|-------------|
| resolver-strict PR-2(1) source kind github/url (79,92) | `unavailable` |
| resolver-strict PR-2(2) path escape (99) | `unavailable` |
| resolver-strict PR-2(3) dir missing (109) | `unavailable` |
| resolver-strict PR-2(4) malformed plugin.json (122) | `unavailable` |
| resolver-strict D-57-04 hooks parse-fail / shape mismatch (182,201) | `unavailable` |
| resolver-strict PR-2(6) malformed mcpServers (466) | `unavailable` |
| resolver-strict PR-2(7,8,9) component-path failures (476,486,500,510) | `unavailable` |
| resolver-strict PR-4 unsupported default locations (439) | **`unsupported`** |
| resolver-strict PR-3 experimental themes/monitors (458) | **`unsupported`** |
| resolver-strict PR-3 multiple unsupported components (527) | **`unsupported`** |
| resolver-loose MM-6 manifest conflict (94) | `unavailable` |
| resolver-loose MM-7 mcp conflict / standalone .mcp.json (131,145) | `unavailable` |
| resolver-loose D-57-04 hooks parse-fail (209) | `unavailable` |
| resolver-loose PR-3 entry unsupported component (173) | **`unsupported`** |
| resolver-loose PR-4 unsupported default locations (253) | **`unsupported`** |

All `assert.equal(r.installable, true)` (strict ×12, loose ×8, comp01 ×4) → `assert.equal(r.state, "installable")`; all `if (r.installable)` guards (strict ×11, loose ×7, comp01 ×4) → `if (r.state === "installable")`.

### Sampling Rate
- **Per task commit:** `npm run typecheck` (NFR-7 must stay green) + `node --test tests/domain/resolver-*.test.ts tests/domain/resolver.types.test.ts`
- **Per wave merge:** `npm test` (full unit suite — consumer surfaces in list/info/edge-deps)
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/domain/resolver.types.test.ts` — rewrite for three arms (positive `pluginRoot` on `installable`+`unsupported`; negative on `unavailable`; `requireForceInstallable` rejects `unavailable`) — covers RSTATE-03, RSTATE-04
- [ ] `tests/domain/resolver-strict.test.ts` — add RSTATE-02 both-defects (malformed manifest + unsupported kind → `unavailable`) precedence fixture; add `requireForceInstallable` narrow/throw tests
- [ ] `tests/domain/resolver-loose.test.ts` — same `requireForceInstallable` + precedence additions for loose mode
- [ ] Framework install: none — existing infrastructure covers all phase requirements

## Security Domain

> `security_enforcement` not disabled — included. This phase's security relevance is entirely NFR-7 (type-level containment), not network/auth/crypto.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface touched) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (indirect) | TypeBox validators (`PLUGIN_MANIFEST_VALIDATOR`, `MCP_SERVERS_VALIDATOR`) already gate manifest/mcp shape; unchanged this phase |
| V6 Cryptography | no | — |

### Known Threat Patterns for this refactor
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reading `pluginRoot` (a filesystem path) off a structurally-broken plugin and acting on it | Tampering / EoP | NFR-7 compile enforcement — `unavailable` never exposes `pluginRoot`; `requireForceInstallable` cannot admit `unavailable` (D-64-07). The three-way state *strengthens* this vs the binary form |
| Path/containment escape (NFR-10) | EoP | Already enforced in `preflightStages` (`sourceEscapeReason`, resolver.ts:362) and `validateComponentPath` (543); both route to `unavailable` (structural) — force can never bypass them (FORCE-05 forward-looking) |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — full read: union schemas (58-110), factories (244-279), decision points (949,995), `requireInstallable` (1007), helper classification (415-895)
- `tests/domain/resolver.types.test.ts` — NFR-7 `@ts-expect-error` pattern (full read)
- `tests/domain/resolver-strict.test.ts` / `resolver-loose.test.ts` — assertion inventory + false/true categorization (grep + header read)
- `shared/probe-classifiers.ts` — `narrowResolverNotes` (87-123) marker derivation (full read)
- `orchestrators/plugin/info.ts` (440-503, 630-840), `list.ts` (300-391), `edge-deps.ts` (120-180), `install.ts` (460-499, 1693-1707) — consumer call sites
- `persistence/state-io.ts:54-73` — persisted `compatibility.installable` boolean (distinct schema)
- `.planning/phases/64-resolver-three-way-state/64-CONTEXT.md` — locked D-64-01..07
- `.planning/REQUIREMENTS.md` / `.planning/ROADMAP.md` — RSTATE-01..05, success criteria
- `docs/prd/pi-claude-marketplace-prd.md` §6.4 (PR-1, PR-6), NFR-7 — current contract (Phase 70 will rewrite)
- `.claude/rules/typescript-comments.md` — comment/test-title ID policy
- `package.json` / `node_modules/typebox/package.json` — toolchain + typebox 1.2.14 `[VERIFIED]`

### Secondary (MEDIUM confidence)
- TypeBox 1.x literal-tagged-union narrowing behavior — corroborated by the existing working pattern in resolver.ts (the codebase is itself the proof) + global CLAUDE.md verification notes

### Tertiary (LOW confidence)
- None — all claims grounded in repo source.

## Metadata

**Confidence breakdown:**
- Three-way schema + factory split: HIGH — direct read of current schemas/factories; mechanical mapping
- Two-accumulator decision / structural precedence: HIGH — every `dirty` contributor traced to source; only `addUnsupportedKindNotes` carries the unsupported signal
- Consumer migration surface: HIGH — `tsc` will enumerate; manual grep cross-checked and the persisted-vs-resolver `installable` split is verified
- `unsupported`-arm field set (A1) and hooks routing (A2): MEDIUM — recommendations consistent with D-64-05/06/07 but cross-cut Phase 65 needs; flagged for planner confirmation
- Render-marker shared helper (D-64-02): MEDIUM — three current duplicates identified; the `unsupported hooks`-is-structural nuance needs catalog confirmation

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable; single-file refactor, no fast-moving external deps)
