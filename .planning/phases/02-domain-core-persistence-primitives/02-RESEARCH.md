# Phase 2: Domain Core & Persistence Primitives - Research

**Researched:** 2026-05-09
**Domain:** Pure-logic domain core (TypeBox manifest schemas, source parser, plugin compatibility resolver, name/version helpers) plus I/O-light persistence primitives (state.json schema + load/save, ScopedLocations brand, withStateGuard, Phase ledger)
**Confidence:** HIGH for all V1-carry-forward findings (V1 source on `features/initial` was inspected directly), HIGH for TypeBox 1.x findings (verified against installed `typebox@1.1.38` `.d.mts` files), MEDIUM for one specific TypeBox claim that this research had to **correct** vs. CONTEXT.md (see Pitfall 1 below).

## Summary

Phase 2 is a foundation phase: every deliverable is either a TypeScript type, a TypeBox schema, a pure function, or an in-memory primitive that **wraps** Phase 1's I/O. No new disk-write paths are introduced; `withStateGuard` and `runPhases` will be wired to `atomicWriteJson` (Phase 1 D-03) at install time in Phase 3+. The bulk of the work is a careful translation of V1's hand-rolled validators (`features/initial:extensions/claude-marketplace/state/io.ts`, `sources.ts`, `plugin/resolve.ts`, `validation.ts`) into the new 9-folder layout, with three substantive deltas: TypeBox schemas replace V1's hand-rolled `validateState` / `validatePluginManifest` (D-05/D-07), `runPhases` replaces V1's nested try/catch rollback chain in `plugin/install.ts` (D-01), and the Gap-1/4/7 resolutions (D-09/D-10/D-11) lock previously-ambiguous behavior.

V1 already implements the entire surface area of this phase in working code; the V1 modules are not "the model" (architecture and import-direction are different) but they are the **decisive reference** for edge-case behavior -- every V1 line-of-code that throws a particular error or routes a particular input is the answer to "what should Phase 2 do here?"

**Primary recommendation:** Mirror V1's behavior verbatim for source parser, validation primitives (`assertSafeName`, etc.), `withStateGuard`, and `state.json` migration; introduce TypeBox JIT validators only at the `marketplace.json` / `plugin.json` schema boundary (where V1 hand-rolled `validatePluginManifest` is the most error-prone module); introduce `runPhases` as a **net-new** primitive that replaces V1's manually-unrolled rollback chain in `plugin/install.ts`. **Critical correction:** the CONTEXT.md `Type.Union([...], { discriminator: 'kind' })` syntax is **not the TypeBox 1.x surface** -- discriminated unions are achieved via `Type.Union` of `Type.Object`s with `Type.Literal('...')` tags; no `discriminator` option exists on `TUnion`. See Pitfall 1.

## Architectural Responsibility Map

Phase 2 introduces no new tier -- every capability is internal to the extension process. The map below uses the 9-folder layout from Phase 1 D-10 as the "tier" axis.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source-string parsing (`pathSource`, `githubSource`, `parsePluginSource`) | `domain/source.ts` | -- | Pure logic, no I/O; per D-06, hand-written character-level parser, not TypeBox |
| Manifest schemas + JIT validators (`MARKETPLACE_VALIDATOR`, `PLUGIN_MANIFEST_VALIDATOR`) | `domain/manifest.ts` (top-level), `domain/manifest/components/*.ts` (split per D-05) | -- | TypeBox lives only in the manifest seam; no TypeBox in source or state code |
| Plugin compatibility resolver (`resolveStrict`, `resolveLoose`, `requireInstallable`) | `domain/resolver.ts` | `domain/manifest.ts`, `shared/path-safety.ts` | Reads manifest entries + plugin.json + filesystem (single `dirExists` call permitted; rest is pure) |
| Generated-name helpers (`generatedSkillName`, `generatedCommandName`, `generatedAgentName`, `assertSafeName`) | `domain/name.ts` | `shared/` (re-export `assertSafeName`) | Pure; called by both bridges (Phase 3) and resolver/install (Phase 5) |
| Hash-version computation (`computeHashVersion`, `HASH_WALK_SKIP`) | `domain/version.ts` | `node:crypto`, `node:fs/promises` | I/O-light: walks plugin tree once, no writes; deterministic SHA-256 |
| `Scope` type | `shared/types.ts` (Phase 2 adds; per Phase 1 SUMMARY handoff item #1) | -- | Both `domain/` and `edge/` need it; D-11 layering forbids `edge/ → domain/` |
| `ScopedLocations` brand + `locationsAt`/`locationsFor` | `persistence/locations.ts` | `shared/path-safety.ts` (every name-derived path uses `assertPathInside`) | SC-3: brand symbol is the only way to mint a valid bundle |
| `state.json` schema (TypeBox), I/O, legacy migration | `persistence/state-io.ts` | `shared/atomic-json.ts` (saves), `persistence/migrate.ts` (legacy normalizer), `domain/source.ts` (validation funnels through `pathSource`/`githubSource` per ST-6) | Single sanctioned `console.warn` (IL-3) lives here |
| `withStateGuard` (concurrency sentinel) | `transaction/with-state-guard.ts` | `persistence/state-io.ts` (load + save) | ST-7/8/9 enforced at save boundary |
| `runPhases<C>` ledger primitive | `transaction/phase-ledger.ts` | `transaction/rollback.ts` (formats `(rollback partial: …)` per D-03/AS-4), `shared/markers.ts` (`ROLLBACK_PARTIAL` import) | Pure async; D-01 explicitly forbids stateful coordinator class |
| `(rollback partial: …)` formatter | `transaction/rollback.ts` | `shared/markers.ts`, `shared/errors.ts` (`appendLeaks` for AS-5) | Single chokepoint for the user-contract marker |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` (verified [VERIFIED: `npm view typebox version` = 1.1.38]) | Runtime schema validation + JSON Schema generation + `Static<>` type inference for manifest + state schemas | Already a peerDep on `features/initial-gsd` (`package.json`); ESM-only; JIT compiler `Compile()` competitive with Ajv. Stay on 1.x stable [CITED: github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0.md]. |
| `node:crypto` (built-in) | bundled with Node ≥22 | `createHash('sha256')` for `hash-<12hex>` PI-7 contract | Standard library; no dep needed |
| `node:fs/promises` (built-in) | bundled with Node ≥22 | `readdir({withFileTypes:true})`, `readFile` for hash walk + state.json read | Standard library |
| `node:path` (built-in) | bundled with Node ≥22 | Path joins for `ScopedLocations`; `path.relative` for containment | Standard library; reused from `shared/path-safety.ts` |
| `node:os` (built-in) | bundled with Node ≥22 | `homedir()` for `expandTildePath` (called at access time, never at parse time per SP-7) | Standard library |
| `write-file-atomic` | `^8.0.0` (already installed as runtime dep) | All `state.json` saves go through `shared/atomic-json.ts` (ST-1 / NFR-1 / D-03) | No direct dep in Phase 2; consumed via Phase 1's `atomicWriteJson` wrapper |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` (built-in) | bundled with Node ≥22.18 (native TS strip) | Test framework -- `node --test "tests/**/*.test.ts"` | Already wired by Phase 1 D-02 (no `tsx`); Phase 2 adds new test files under `tests/{domain,persistence,transaction}/` |
| `node:assert/strict` (built-in) | bundled | `assert.equal`, `assert.deepEqual`, `assert.throws`, `assert.match` | Existing pattern in `tests/shared/atomic-json.test.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeBox `Type.Union` of literal-tagged objects | Hand-written discriminated union (V1's pattern; pure TS interfaces + manual validators) | Rejected by D-04/D-07: TypeBox at the schema boundary is the entire reason it's a peerDep; eliminates V1's hand-rolled `validatePluginManifest` (~40 lines of error-prone branching) |
| Hand-written `parsePluginSource` (D-06 LOCKED) | TypeBox-driven source parsing | Rejected by D-06; V1's `sources.ts` has 80 lines of character-level work (slash count, hash split, trailing-slash strip, browser-paste reject) that TypeBox cannot express -- see V1 `extensions/claude-marketplace/sources.ts` lines 1-200 |
| `runPhases` pure async function (D-01 LOCKED) | Coordinator class with `add()` / `run()` | Rejected by D-01: implicit phase ordering is Architecture-research's #1 pitfall for transaction coordinators; literal-array call sites at every orchestrator are the strongest mitigation |
| `Type.Cyclic` (TypeBox 1.x) for self-referential manifest types | `Type.Module` with named `Type.Ref('Plugin')` | Both are valid in 1.x; `Type.Cyclic` is the direct replacement for the now-removed `Type.Recursive` [CITED: github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0-migration.md]. Use whichever reads cleaner; neither breaks JIT compilation |
| `JSON.parse` on `state.json` followed by TypeBox `Compile().Check()` | `Validator.Parse(value)` (throws on invalid) | The latter combines parse-or-throw with type narrowing; matches V1's `validateState` semantics |

**Installation:** No new packages needed. Phase 2 consumes only:
- `typebox@^1.1.38` (already peerDep + devDep)
- Node built-ins (`crypto`, `fs/promises`, `path`, `os`)
- Phase 1's `shared/{atomic-json,errors,markers,notify,path-safety}.ts`

**Version verification:** `npm view typebox version` → `1.1.38`; `npm view write-file-atomic version` → `8.0.0`, engines `^22.22.2 || ^24.15.0 || >=26.0.0` (Phase 1 D-01 locked Node 24, well above floor).

## Architecture Patterns

### System Architecture Diagram (Phase 2 deliverables only)

```text
┌─────────────────────────────────────────────────────────────────┐
│             PHASE 5 ORCHESTRATORS (consumers, not built here)   │
│                  installPlugin / updatePlugin / etc.            │
└────────┬───────────────────────────────────┬────────────────────┘
         │ withStateGuard(scope, fn)         │ runPhases(phases, ctx)
         ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ transaction/                                                    │
│  ┌──────────────────────┐    ┌────────────────────────────┐     │
│  │ with-state-guard.ts  │    │ phase-ledger.ts            │     │
│  │  - load fresh        │    │  - runPhases<C>(phases,ctx)│     │
│  │  - mutate            │    │  - Phase<C> = {do,undo?}   │     │
│  │  - save-or-throw     │    │  - reverse-undo on throw   │     │
│  │  - ST-8/ST-9 commit  │◄───┤  - returns                 │     │
│  │    boundary checks   │    │    RunPhasesResult         │     │
│  └─────────┬────────────┘    └────────────┬───────────────┘     │
│            │                              │                     │
│            │  loadState/saveState         │  formatRollback(...)│
│            ▼                              ▼                     │
│                                ┌─────────────────────────────┐  │
│                                │ rollback.ts                 │  │
│                                │ formatRollbackError(result) │  │
│                                │ → "(rollback partial: ...)" │  │
│                                │   from shared/markers       │  │
│                                └─────────────────────────────┘  │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ persistence/                                                    │
│  ┌──────────────┐  ┌───────────────────┐  ┌─────────────────┐   │
│  │ state-io.ts  │  │ migrate.ts        │  │ locations.ts    │   │
│  │ loadState/   │  │ migrateLegacy*    │  │ ScopedLocations │   │
│  │ saveState    │  │ (IL-3 console.warn│  │ brand symbol +  │   │
│  │ STATE schema │  │  per D-05/handoff)│  │ locationsAt(...)│   │
│  │ (TypeBox)    │  │                   │  │ + per-method    │   │
│  └──────┬───────┘  └────────┬──────────┘  │   path checks   │   │
│         │                   │             └─────────────────┘   │
│         │ via shared/atomic-json.ts (Phase 1)                   │
│         ▼                                                       │
│              [filesystem: <extensionRoot>/state.json]           │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ domain/                                                         │
│  ┌─────────────────┐  ┌───────────────────┐  ┌──────────────┐   │
│  │ source.ts       │  │ manifest.ts       │  │ resolver.ts  │   │
│  │ ParsedSource =  │  │ MARKETPLACE_      │  │ resolveStrict│   │
│  │  | path-source  │  │   VALIDATOR       │  │ resolveLoose │   │
│  │  | github-source│  │ PLUGIN_MANIFEST_  │  │ ResolvedPlug │   │
│  │  | unknown-     │  │   VALIDATOR       │  │ = installable│   │
│  │    source       │  │ (TypeBox JIT      │  │ | not-       │   │
│  │ pathSource/     │  │  compiled         │  │   installable│   │
│  │ githubSource    │  │  at module load)  │  │ requireInstal│   │
│  │ factories       │  │                   │  │   lable      │   │
│  └────────┬────────┘  └─────────┬─────────┘  └──────┬───────┘   │
│           │ ST-6 funnels        │                   │           │
│           │ state-load through  │ uses              │ uses      │
│           │ the SAME factories  ▼                   ▼           │
│  ┌─────────────────┐  ┌───────────────────┐                     │
│  │ name.ts         │  │ version.ts        │                     │
│  │ generatedSkill/ │  │ computeHashVersion│                     │
│  │ Command/Agent   │  │  (SHA-256, normalize CRLF→LF + BOM,    │
│  │ assertSafeName  │  │   walk skip [.git/, node_modules/,     │
│  │                 │  │   .DS_Store])  D-11/D-12 LOCKED        │
│  └─────────────────┘  └───────────────────┘                     │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ shared/ (PHASE 1 OUTPUTS -- consumed, not modified)              │
│   markers.ts | errors.ts | notify.ts | atomic-json.ts |         │
│   path-safety.ts | (NEW Phase 2: types.ts for Scope)            │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

The 9-folder skeleton already exists (Phase 1 D-12). Phase 2 fills **`domain/`, `persistence/`, `transaction/`** and adds **`shared/types.ts`** (Phase 1 SUMMARY handoff item #1):

```text
extensions/claude-marketplace/
├── shared/
│   ├── types.ts                  # NEW Phase 2: Scope + cross-tier types
│   ├── markers.ts                # Phase 1 (consume)
│   ├── errors.ts                 # Phase 1 (consume + extend)
│   ├── notify.ts                 # Phase 1 (consume)
│   ├── atomic-json.ts            # Phase 1 (consume)
│   └── path-safety.ts            # Phase 1 (consume)
│
├── domain/
│   ├── source.ts                 # Phase 2: parsePluginSource + ParsedSource union + factories
│   ├── manifest.ts               # Phase 2: MARKETPLACE schema (top-level)
│   ├── components/               # Phase 2: split per D-03 (one Type.Cyclic boundary)
│   │   ├── plugin.ts             # Phase 2: PLUGIN_MANIFEST schema
│   │   ├── skill.ts              # Phase 2 reserved (or roll into plugin.ts if not needed)
│   │   ├── command.ts            # Phase 2 reserved
│   │   ├── agent.ts              # Phase 2 reserved
│   │   └── mcp.ts                # Phase 2: MCP schema (consumed by Phase 3 bridge)
│   ├── resolver.ts               # Phase 2: resolveStrict + resolveLoose + requireInstallable
│   ├── name.ts                   # Phase 2: generated-name helpers + assertSafeName re-export
│   └── version.ts                # Phase 2: computeHashVersion + HASH_WALK_SKIP
│
├── persistence/
│   ├── state-io.ts               # Phase 2: loadState + saveState (TypeBox-validated)
│   ├── migrate.ts                # Phase 2: migrateLegacyMarketplaceRecords (IL-3 console.warn)
│   └── locations.ts              # Phase 2: ScopedLocations brand + locationsAt/locationsFor
│
└── transaction/
    ├── phase-ledger.ts           # Phase 2: runPhases<C> + Phase<C> + RunPhasesResult
    ├── with-state-guard.ts       # Phase 2: withStateGuard (ST-7/8/9 commit boundary)
    └── rollback.ts               # Phase 2: formatRollbackError + ROLLBACK_PHASE consts (D-03)
```

The CONTEXT.md D-03 calls for `schemas/manifest.ts` + `schemas/components/{plugin,skill,command,agent,mcp}.ts`. Per D-05, the actual location is `domain/manifest.ts` + `domain/components/*` -- schemas live next to their consumers, not in a separate `schemas/` folder. (The CONTEXT.md "schemas/" wording is from the discussion-log Q1 phrasing; D-05 in CONTEXT.md "Schema location" supersedes it.)

### Pattern 1: Discriminated union via TypeBox `Type.Union` of literal-tagged `Type.Object`s

**What:** TypeScript discriminated unions in TypeBox 1.x use `Type.Literal('tag')` as the discriminator field inside each variant; `Type.Union` itself takes no `discriminator` option. The `Static<>` inferred type is a proper TypeScript discriminated union that narrows under `if (x.kind === 'installable')` checks.

**When to use:** `ResolvedPlugin` (PR-1 / NFR-7), `ParsedSource` (D-04/D-08), and any other internally-typed variant where TypeScript narrowing is the value being preserved.

**Example:**
```typescript
// Source: github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/union.md
//         + github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/literal.md
// CONFIRMED in installed typebox@1.1.38:
//   build/type/types/union.d.mts → `Union<Types>(anyOf, options?: TSchemaOptions)`
//   No `discriminator` option exists on TUnion -- see Pitfall 1.
import Type from 'typebox';
import { Compile, type Validator } from 'typebox/compile';

// --- ResolvedPlugin (PR-1, NFR-7) ---------------------------------------
const ResolvedPluginCommon = Type.Object({
  name: Type.String(),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()),
  componentPaths: Type.Object({
    skills: Type.Optional(Type.String()),
    commands: Type.Optional(Type.String()),
    agents: Type.Optional(Type.String()),
  }),
  mcpServers: Type.Record(Type.String(), Type.Unknown()),
});

const ResolvedPluginInstallable = Type.Intersect([
  ResolvedPluginCommon,
  Type.Object({
    installable: Type.Literal(true),       // <-- discriminator
    pluginRoot: Type.String(),             // <-- only present on this variant
  }),
]);

const ResolvedPluginNotInstallable = Type.Intersect([
  ResolvedPluginCommon,
  Type.Object({
    installable: Type.Literal(false),      // <-- discriminator
    // pluginRoot intentionally absent -- NFR-7 / PR-1
  }),
]);

export const ResolvedPlugin = Type.Union([
  ResolvedPluginInstallable,
  ResolvedPluginNotInstallable,
]);

export type ResolvedPlugin = Type.Static<typeof ResolvedPlugin>;
//   = ({...common, installable: true,  pluginRoot: string})
//   | ({...common, installable: false                   })

// TypeScript narrows correctly:
function consumer(r: ResolvedPlugin): string | undefined {
  if (r.installable) {
    return r.pluginRoot;          // OK -- narrowed to installable variant
  }
  // r.pluginRoot;                 // ERROR -- Property 'pluginRoot' does not exist on type ...
  return undefined;
}
```

**Note on the `Type.Literal(true)` / `Type.Literal(false)` choice:** the discussion-log Q1 phrasing referred to `kind: 'installable' | 'not_installable'` but PR-1 uses `installable: true | false` literally. Use the boolean form to match the PRD verbatim; the TypeScript narrowing is identical.

### Pattern 2: TypeBox JIT validators compiled at module-load (D-07)

**What:** Each manifest schema gets paired with a validator export, both at module top-level. Compilation happens once during extension boot; the validator is a plain export that callers `Check()` or `Parse()` against unknown JSON.

**When to use:** Every TypeBox schema that `state-io.ts` or the orchestrators (Phase 4-5) will validate against unknown JSON -- `MARKETPLACE_VALIDATOR`, `PLUGIN_MANIFEST_VALIDATOR`, `STATE_VALIDATOR`, `MCP_SERVERS_VALIDATOR`.

**Example:**
```typescript
// Source: github.com/sinclairzx81/typebox/blob/main/design/website/docs/compile/0_compile.md
// CONFIRMED in installed typebox@1.1.38: build/compile/index.d.mts re-exports `Compile` and `Validator`.
import Type from 'typebox';
import { Compile } from 'typebox/compile';

export const MARKETPLACE_SCHEMA = Type.Object({
  name: Type.String(),
  plugins: Type.Array(/* PLUGIN_ENTRY_SCHEMA -- declared elsewhere */ Type.Unknown()),
  strict: Type.Optional(Type.Boolean()),
  owner: Type.Optional(Type.Object({ name: Type.String() })),
});

export type MarketplaceManifest = Type.Static<typeof MARKETPLACE_SCHEMA>;

// JIT-compiled at module-load (D-07). Compilation runs once during boot;
// thereafter, `MARKETPLACE_VALIDATOR.Check(...)` is the fast path.
export const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);

// Caller:
//   if (MARKETPLACE_VALIDATOR.Check(parsedJson)) {
//     parsedJson.name; // narrowed to MarketplaceManifest
//   }
//
// Or throw-on-invalid:
//   const m: MarketplaceManifest = MARKETPLACE_VALIDATOR.Parse(parsedJson);
```

### Pattern 3: `runPhases<C>` ledger primitive (D-01 LOCKED)

**What:** A pure async function that takes a literal `Phase<C>[]` array and an arbitrary context `C`. Executes each `phase.do(ctx)` in array order; on the first throw, walks the *executed* phases in reverse calling each `phase.undo?.(ctx)`. Aggregates `undo` failures and any out-of-band leak descriptors into a structured `RunPhasesResult`. Never re-throws on its own -- the caller does (typically by calling `formatRollbackError(result, originalError)` from `transaction/rollback.ts`).

**When to use:** Every install / update / uninstall orchestrator (Phase 5) wraps its work in `withStateGuard(... async (state) => { await runPhases(buildPhases(state), {...ctx, state}); })`. The literal `const PHASES: Phase<InstallCtx>[] = [...]` array at every call site is the explicit anti-pattern guard against implicit ordering.

**Example:**
```typescript
// Source: V1 features/initial:extensions/claude-marketplace/plugin/install.ts +
//         lifecycle.ts demonstrates the SAME ordering and rollback semantics
//         using nested try/catch. Phase 2's runPhases extracts the pattern
//         into a primitive. CONTEXT.md D-01 locks the API shape.
//
// transaction/phase-ledger.ts
export interface Phase<C> {
  readonly name: string;             // user-visible in (rollback partial: [<name>] ...)
  readonly do: (ctx: C) => Promise<void>;
  readonly undo?: (ctx: C) => Promise<void>;
}

export interface RollbackPartial {
  readonly phase: string;            // e.g. "skills/prompts"
  readonly msg: string;              // errorMessage(undoError)
}

export interface RunPhasesResult {
  readonly ok: boolean;
  readonly error?: Error;            // the original failing-phase error
  readonly rollbackPartials: readonly RollbackPartial[];
  readonly leaks: readonly string[]; // out-of-band cleanup-leak descriptors (AS-5)
}

export async function runPhases<C>(
  phases: readonly Phase<C>[],
  ctx: C,
): Promise<RunPhasesResult> {
  const executed: Phase<C>[] = [];
  for (const phase of phases) {
    try {
      await phase.do(ctx);
      executed.push(phase);
    } catch (err) {
      // Reverse-order undo of every phase that DID succeed.
      const partials: RollbackPartial[] = [];
      for (const done of executed.slice().reverse()) {
        if (!done.undo) continue;
        try {
          await done.undo(ctx);
        } catch (undoErr) {
          // PathContainmentError must NEVER be folded into rollback partial
          // per PI-14/PS-4 -- re-throw immediately, original error becomes cause.
          if (undoErr instanceof PathContainmentError) {
            throw undoErr;
          }
          partials.push({ phase: done.name, msg: errorMessage(undoErr) });
        }
      }
      return {
        ok: false,
        error: err instanceof Error ? err : new Error(String(err)),
        rollbackPartials: partials,
        leaks: [],
      };
    }
  }
  return { ok: true, rollbackPartials: [], leaks: [] };
}
```

Composition with `withStateGuard` (D-02):
```typescript
await withStateGuard(locations, async (state) => {
  const PHASES: Phase<InstallCtx>[] = [          // <-- literal const, grep-able order
    skillsPromptsPhase,
    agentsPhase,
    mcpPhase,
    statePhase,                                  // terminal: mutates `state`
  ];
  const result = await runPhases(PHASES, { ...ctx, state });
  if (!result.ok) {
    throw formatRollbackError(result, result.error!);
  }
});
```

### Pattern 4: Hand-written source parser with discriminated `ParsedSource` union (D-06 LOCKED)

**What:** `parsePluginSource(input: unknown): ParsedSource` is a pure function that branches on the input string's first character (`/`, `~`, `.`) and substring patterns (`https://github.com/`, `://`, `git@`). Returns a discriminated union; SP-7 preserved by carrying the verbatim input as `raw`. Factory functions `pathSource(raw)` / `githubSource(raw)` (SP-6) wrap parse + validate-or-throw and are the **single funnel** for both parse-time and state-load-time validation (ST-6).

**When to use:** Every `marketplace.json`'s plugin `source` field; every state-load record (ST-6); every `marketplace add` user input.

**Example:** see V1 `features/initial:extensions/claude-marketplace/sources.ts` lines 1-200 -- particularly the `parseGitHubUrl` branch which handles `.git`, `#<ref>`, trailing-slash, and `/tree/<ref>` rejection. Phase 2 should mirror these branches verbatim, just emitting the new `ParsedSource` discriminated union instead of V1's `MarketplaceSource`. Per MM-3/MM-4/D-08, the `unknown` branch is enriched with a `reason: string` field.

```typescript
// Source: V1 features/initial:extensions/claude-marketplace/sources.ts (verbatim
// behavioral reference) + CONTEXT.md D-06/D-08.
export interface PathSource   { kind: 'path';    raw: string; logical: string; }
export interface GitHubSource { kind: 'github';  raw: string; owner: string; repo: string; ref?: string; }
export interface UnknownSource{ kind: 'unknown'; raw: string; reason: string; }

export type ParsedSource = PathSource | GitHubSource | UnknownSource;

export function parsePluginSource(raw: string): ParsedSource {
  // path forms (D-06 line-by-line port from V1 sources.ts:84-118)
  if (raw === '~' || raw.startsWith('~/'))                             return { kind: 'path', raw, logical: raw };
  if (raw.startsWith('~'))                                             return { kind: 'unknown', raw, reason: `per-user tilde (${raw}) not supported; use ~/...` };
  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) return { kind: 'path', raw, logical: raw };

  // GitHub HTTPS URL form
  if (raw.startsWith('https://github.com/'))                            return parseGitHubUrl(raw); // see V1 parseGitHubUrl

  // Reject SSH and other URL sources
  if (raw.startsWith('git@') || raw.includes('://'))                    return { kind: 'unknown', raw, reason: `${raw} is not supported; only github URLs and local paths are accepted` };

  // owner/repo@ref reject (SP-2)
  const atIdx = raw.indexOf('@');
  if (atIdx !== -1) {
    return { kind: 'unknown', raw,
      reason: `${raw} uses unsupported owner/repo@<ref> form; use https://github.com/${raw.slice(0, atIdx)}#${raw.slice(atIdx + 1)}` };
  }

  // owner/repo (SP-5: exactly one slash, both halves non-empty)
  const slashCount = (raw.match(/\//g) ?? []).length;
  if (slashCount === 1) {
    const [owner, repo] = raw.split('/');
    if (!owner || !repo) return { kind: 'unknown', raw, reason: `owner/repo halves must be non-empty` };
    return { kind: 'github', raw, owner, repo };
  }

  // MM-4: non-relative string source becomes unknown, NOT github
  return { kind: 'unknown', raw, reason: `non-relative string source ${raw} cannot be classified` };
}

// SP-6 boundary factories -- used at state-load (ST-6) AND at parse time
export function pathSource(raw: string): PathSource {
  if (raw.trim() === '') throw new Error('Path source must be a non-empty string.');
  return { kind: 'path', raw, logical: raw };
}
export function githubSource(raw: string): GitHubSource {
  const parsed = parsePluginSource(raw);
  if (parsed.kind !== 'github') throw new Error(`Not a github source: ${raw} -- ${parsed.kind === 'unknown' ? parsed.reason : 'wrong kind'}`);
  return parsed;
}
```

### Pattern 5: SHA-256 hash with CRLF→LF + BOM normalization (D-11/D-12 LOCKED)

**What:** `computeHashVersion(pluginRoot)` walks the plugin tree (skipping `HASH_WALK_SKIP` entries), normalizes each file's bytes (strip leading UTF-8 BOM, collapse `\r\n` → `\n`), and feeds (path-bytes + normalized-content-bytes) into a single SHA-256 stream. Returns `'hash-' + hex.slice(0, 12)`.

**Path bytes are included verbatim before each file's content** so a rename invalidates the hash (a freshly-renamed file has the same content but different path → different hash → forced "upgrade" on next `update`, which is the desired behavior).

**When to use:** PI-7 fallback when neither plugin manifest `version` nor marketplace entry `version` is present. Snapshot test (per CONTEXT.md "Specific Ideas" / D-11 / Phase 2 success criterion 5) locks the algorithm + truncation length + walk filter list.

**Example:**
```typescript
// Source: CONTEXT.md D-11/D-12; PRD §5.2.1 PI-7; node:crypto + node:fs/promises docs.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const HASH_WALK_SKIP = Object.freeze(['.git', 'node_modules', '.DS_Store'] as const);
const HASH_TRUNC = 12;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function normalizeBytes(buf: Buffer): Buffer {
  // Strip leading UTF-8 BOM (D-11)
  const stripped = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    ? buf.subarray(3) : buf;
  // Collapse \r\n → \n (D-11; matches git autocrlf=input)
  if (!stripped.includes(0x0d)) return stripped;
  const out = Buffer.alloc(stripped.length);
  let j = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === 0x0d && stripped[i + 1] === 0x0a) continue; // skip the \r
    out[j++] = stripped[i];
  }
  return out.subarray(0, j);
}

export async function computeHashVersion(pluginRoot: string): Promise<string> {
  const hash = createHash('sha256');
  await walkAndHash(hash, pluginRoot, '');
  return 'hash-' + hash.digest('hex').slice(0, HASH_TRUNC);
}

async function walkAndHash(hash: crypto.Hash, root: string, rel: string): Promise<void> {
  const entries = (await readdir(path.join(root, rel), { withFileTypes: true }))
    .filter(e => !HASH_WALK_SKIP.includes(e.name as (typeof HASH_WALK_SKIP)[number]))
    .sort((a, b) => a.name.localeCompare(b.name));     // PI-7: sort by name at each dir
  for (const entry of entries) {
    const childRel = path.posix.join(rel, entry.name); // posix joiner so cross-OS hash matches
    hash.update(childRel);                             // path bytes (D-12)
    if (entry.isDirectory()) {
      await walkAndHash(hash, root, childRel);
    } else if (entry.isFile()) {
      const content = await readFile(path.join(root, childRel));
      hash.update(normalizeBytes(content));            // D-11
    }
    // Symlinks intentionally omitted (PI-7: "symlink targets MUST NOT be included")
  }
}
```

### Pattern 6: `withStateGuard` concurrency sentinel (ST-7/8/9 / D-02 / D-08-Q2)

**What:** `withStateGuard(locations, mutate)` does (1) load fresh state via `loadState(extensionRoot)`, (2) hand it to the closure, (3) save via `saveState(extensionRoot, state)` if the closure resolves successfully. The "fresh" load is an **intra-process** preflight -- V1's comments are explicit that this is NOT a cross-process file lock. Phase 2's deliverable is the same primitive, with the addition of an optional **commit-time invariant check** that the orchestrator can supply to detect ST-8/ST-9 races (e.g., "another caller installed `acme` while we were staging").

**When to use:** Every mutating orchestrator wraps its work here. Read-only paths (e.g., `list`) call `loadState` directly.

**Example:**
```typescript
// Source: V1 features/initial:extensions/claude-marketplace/transaction/state-guard.ts
// (verbatim behavioral reference) + CONTEXT.md D-02 + ST-7..9.
import { loadState, saveState } from '../persistence/state-io.ts';
import type { ScopedLocations } from '../persistence/locations.ts';
import type { ExtensionState } from '../persistence/state-io.ts';

export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => Promise<T> | T,
): Promise<T> {
  const fresh = await loadState(locations.extensionRoot);
  const result = await mutate(fresh);
  await saveState(locations.extensionRoot, fresh);
  return result;
}
```

ST-8 hard-fail-with-rollback (install side) is implemented by the orchestrator throwing inside the mutate closure when it detects the conflicting record at commit-time:

```typescript
await withStateGuard(locations, async (state) => {
  const mp = state.marketplaces[mpName];
  if (mp.plugins[pluginName]?.installed === true) {
    throw new Error(`Plugin "${pluginName}" was installed concurrently in marketplace "${mpName}".`);
  }
  // ... mutate state.marketplaces[mpName].plugins[pluginName] = newRecord ...
});
```

ST-9 (update concurrent change): same pattern -- orchestrator checks `version !== fromVersion` inside the closure and throws `changed concurrently; retry the update.`.

ST-8 soft-converge (uninstall side): orchestrator checks `state.marketplaces[mpName]?.plugins[pluginName] === undefined` and **does NOT throw** -- the mutation closure simply skips the delete and returns success.

### Anti-Patterns to Avoid

- **TypeBox `discriminator` option:** does not exist on `TUnion` in 1.x -- see Pitfall 1. Use literal-tagged objects.
- **`Type.Recursive` (TypeBox 0.34 API):** removed in 1.0; use `Type.Cyclic` or `Type.Module` [CITED: github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0-migration.md].
- **`TypeCompiler.Compile` import path:** `@sinclair/typebox/compiler` is the 0.34 path. In 1.x it's `import { Compile } from 'typebox/compile'`.
- **Lazy validator construction:** D-07 forbids; pay the JIT cost at module-load.
- **Stateful coordinator class for the Phase ledger:** D-01 forbids; use the literal-array pure function.
- **Single-resolver-with-strict-flag:** D-04 forbids; two distinct functions, no shared branching.
- **TypeBox-driven source parsing:** D-06 forbids; hand-written character-level work.
- **Direct `process.stdout.write` / `console.warn` outside the IL-3 site:** Phase 1 D-06 ESLint rule blocks; Phase 2 must wrap with `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: ...` exactly once in `persistence/migrate.ts`.
- **Path-derived writes that bypass `assertPathInside`:** Phase 1 D-15 single chokepoint applies; `persistence/locations.ts` paths must each route through `assertPathInside` at the same place V1's `pluginDataDir` / `marketplaceDataDir` / `sourceCloneDir` methods do.
- **Returning the `pluginRoot` field on the `installable: false` variant:** NFR-7 / PR-1 explicitly forbid; the success criterion 1 `// @ts-expect-error` test enforces.
- **Hashing with mtimes / permissions / ownership:** PI-7 explicit ban -- content + path only.
- **Treating `mpName` and `pluginName` as a single composite key in state:** D-09 LOCKED -- state nests per-marketplace; `(mp, plugin)` tuple is the natural composite, no joining required.
- **Cross-scope state reads at install time:** D-10 LOCKED -- `install` operates on targeted scope only; per-scope independent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `state.json` validation | Hand-rolled `validateState` / `validateMarketplaceRecord` (V1 had ~150 lines of branching in `state/io.ts`) | TypeBox schema + `STATE_VALIDATOR.Parse(parsedJson)` | One-line replacement; JIT-compiled; same error semantics; eliminates V1's per-field "must be string" / "must be an object" repetition |
| `marketplace.json` parsing | Hand-rolled per-field validators | `MARKETPLACE_VALIDATOR.Parse(parsedJson)` | Same |
| `plugin.json` parsing | Hand-rolled per-field validators (V1's `validatePluginManifest` in `plugin/resolve.ts`) | `PLUGIN_MANIFEST_VALIDATOR.Parse(parsedJson)` | Same -- the V1 module is one of the most error-prone in the V1 codebase per ARCHITECTURE research |
| Atomic JSON write | `fs.writeFileSync` / hand-rolled tmp+rename | `shared/atomic-json.ts` (Phase 1 D-03) | NFR-1 mandates atomicity; Phase 1 already wraps `write-file-atomic@^8` with fsync + concurrent-write queue |
| Discriminated union branching code | Manual `if (x.kind === 'a') ... else if ...` chains with type assertions | TypeScript's automatic narrowing on TypeBox `Type.Static<>` of literal-tagged unions | NFR-7 enforces; also the success criterion 1 test |
| Path containment checks | Per-call `path.relative` + startsWith snippet | `assertPathInside` from `shared/path-safety.ts` (Phase 1 D-15) | Single chokepoint for symlink + containment defense |
| Rollback-on-failure for multi-phase install | Nested try/catch chains (V1 `plugin/install.ts:130-260` has six nested catch blocks) | `runPhases<C>(phases, ctx)` (D-01) | The D-01 entire reason; literal-array call sites are grep-able and refactor-safe |
| `(rollback partial: ...)` string assembly | Inline `f => `\`[${f.phase}] ${f.message}\`` | `formatRollbackError(result, originalError)` from `transaction/rollback.ts` (D-03) | ES-5 user contract -- single chokepoint prevents drift; markers come from `shared/markers.ts` |

**Key insight:** V1 already proves every single one of these patterns works. The hand-rolled JSON validators in V1 were a deliberate trade-off (no peerDep on a schema library at the time); now that TypeBox is a peerDep (and was already used in `presentation/list.ts`), the schema seam is the most valuable place to spend it. The `runPhases` extraction is the single biggest architectural improvement over V1.

## Runtime State Inventory

> Phase 2 is foundational and I/O-light. It does not introduce any rename, refactor, or migration affecting existing runtime state. The Phase 1 SUMMARY confirmed `npm run check` green and zero V1 source carried over (this is a successor-architecture build on `features/initial-gsd`, not a refactor of V1's `features/initial`).
>
> However, **load-time legacy migration of V1-shaped `state.json`** is in scope (PR-1..PR-6, ST-4, ST-5, IL-3). Inventory below covers that case.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | A user upgrading from V1 to the successor will have a `<scopeRoot>/claude-marketplace/state.json` written by V1's `state/io.ts:saveState`. The shape matches V1's `ExtensionState` interface -- see V1 `extensions/claude-marketplace/types.ts`. Phase 2's `loadState` MUST normalize legacy shapes (missing `manifestPath` / `marketplaceRoot`, missing `resources.agents` / `resources.mcpServers`, schemaVersion may be absent on pre-1 records) per PR-1..PR-6, ST-4, ST-5. | Code addition: `persistence/migrate.ts` with `migrateLegacyMarketplaceRecords(parsed, extensionRoot)` (verbatim port of V1's same-named function in `state/io.ts`). Best-effort async re-save via `atomicWriteJson`; failure → IL-3 `console.warn` with eslint-disable comment per Phase 1 SUMMARY handoff #2. |
| Live service config | None -- Phase 2 has no services, no daemons, no scheduled tasks, no external service registrations. | None -- verified by grepping V1 source for `setInterval`, `setTimeout`, `child_process` (V1 uses none for state); the `no-shell-out.test.ts` from Phase 1 enforces. |
| OS-registered state | None -- Phase 2 introduces no OS-registered names, no Windows Task Scheduler entries, no launchd plists, no systemd unit names, no pm2 process names. | None -- this extension is a Pi-loaded module, not a standalone OS service. |
| Secrets/env vars | None -- Phase 2 reads no environment variables (the extension's `expandTildePath` reads `os.homedir()` at access time per SP-7, but this is not a secret). | None -- verified against V1 source: no `process.env.*` reads in `state/io.ts`, `sources.ts`, `plugin/resolve.ts`, or `transaction/state-guard.ts`. |
| Build artifacts | None -- Phase 2 introduces no compiled binaries, no native bindings, no installed packages with on-disk caches. The `node_modules/typebox/build/` ESM tree is what Node imports at runtime; nothing to invalidate. | None. |

## Common Pitfalls

### Pitfall 1: TypeBox `Type.Union([...], { discriminator: 'kind' })` does not exist in 1.x
**What goes wrong:** CONTEXT.md D-04, the discussion-log Q1 of "TypeBox Schema + Strict-Mode Resolver Layout", and Phase 1 SUMMARY handoff #7 all reference the syntax `Type.Union([...], { discriminator: "kind" })` for the discriminated `installable: true | false` union. **This syntax is not the TypeBox 1.x API.** A planner who copies it verbatim will see TypeScript accept it (since `TSchemaOptions` is permissive) but the option will be silently ignored -- the runtime validator will use the default heuristic (`union_score_select`).
**Why it happens:** Confusion with OpenAPI 3.x `discriminator` keyword (which TypeBox can emit when serializing schemas to JSON Schema), or with Zod 4 `z.discriminatedUnion(...)`, or with TypeBox 0.34's experimental options.
**How to avoid:** Use `Type.Union([VariantA, VariantB])` where each variant is a `Type.Object` with a `Type.Literal('tag')` field. TypeScript's `Type.Static<>` produces a proper discriminated union; the runtime `union_score_select` (in `node_modules/typebox/build/value/shared/union_score_select.mjs`) automatically scores literal-equality matches at +100 vs +10 for type-equality, so literal tags ARE the discriminator at runtime -- just without an explicit option.
**Warning signs:** A code review comment that points at `{ discriminator: '...' }` in any TypeBox call; an ESLint warning about an unknown property on `TSchemaOptions` (won't fire because `TSchemaOptions` is open-ended); a runtime test that passes invalid data and gets back the wrong narrowed type.
**Verification:** `grep -RE "discriminator" node_modules/typebox/build/` returns one hit, in `union_score_select.mjs`'s comment ("used as union discriminator fields") -- confirming the heuristic-not-option model.

### Pitfall 2: `Type.Recursive` was renamed to `Type.Cyclic` in TypeBox 1.0
**What goes wrong:** Code that imports/uses `Type.Recursive(This => Type.Object({ ... children: Type.Array(This) ... }))` will fail to compile in TypeBox 1.x -- the export was removed.
**Why it happens:** Training data and older docs reference `Type.Recursive`; CONTEXT.md "Library docs (planner should pull current versions)" lists `typebox` 1.1.38+ but doesn't pre-empt the rename.
**How to avoid:** Use `Type.Cyclic({ Plugin: Type.Object({ ... }) }, 'Plugin')` and reference siblings via `Type.Ref('Plugin')`. Or, when multiple types reference each other, use `Type.Module({ A: ..., B: ... })` which auto-detects cyclic refs and returns `TCyclic` instances [CITED: github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/module.md].
**Warning signs:** TypeScript error "Property 'Recursive' does not exist on type 'typeof Type'."
**Verification:** `ls node_modules/typebox/build/type/types/cyclic.d.mts` exists; `recursive.d.mts` does not.

### Pitfall 3: `TypeCompiler.Compile` is the 0.34 path; 1.x uses `Compile` from `typebox/compile`
**What goes wrong:** `import { TypeCompiler } from '@sinclair/typebox/compiler'` fails -- `@sinclair/typebox` is the deprecated 0.34 LTS package; the new package is `typebox` (no `@sinclair` prefix). The `TypeCompiler.Compile()` static is replaced by a free `Compile()` function, and the result type `TypeCheck` is renamed to `Validator`.
**Why it happens:** Same training-data lag as Pitfall 2; the V1 codebase doesn't use `@sinclair/typebox` (it doesn't have manifest schemas in TypeBox at all), so there's no in-repo example to learn from.
**How to avoid:** `import { Compile, Validator } from 'typebox/compile'`. The validator instance has `.Check(value)` (type guard), `.Parse(value)` (throw-on-invalid), `.Errors(value)` (detailed errors), `.IsAccelerated()` (true in JIT environments).
**Warning signs:** TypeScript error "Cannot find module '@sinclair/typebox/compiler'."
**Verification:** `cat node_modules/typebox/package.json` lists `./compile` as an export; `@sinclair/typebox` is **not** in `package.json` dependencies.

### Pitfall 4: V1's `withStateGuard` is intra-process only -- successor must NOT claim cross-process safety
**What goes wrong:** A planner reads ST-8 ("Concurrent install/uninstall MUST be detected at commit time") and assumes `withStateGuard` provides cross-process locking. It does not -- V1 is explicit ("Concurrency scope: this is an INTRA-process preflight guard, not a cross-process transaction"). Two `pi` processes targeting the same scope can still last-writer-wins on `state.json`.
**Why it happens:** ST-8's wording ("detected at commit time") suggests an absolute concurrency guarantee; the actual mechanism is "load-fresh + closure-checks-its-own-preconditions + save-or-throw". Cross-process safety would require advisory file locking (`flock`, `proper-lockfile`, etc.) which V1 deliberately omits.
**How to avoid:** Phase 2's `withStateGuard` is a verbatim port of V1's contract. Its docstring MUST repeat V1's "INTRA-process preflight guard" warning. The Phase 5 install orchestrator's commit-time invariant check (e.g., `if (state.marketplaces[mpName].plugins[pluginName]?.installed === true) throw ...`) is what ST-8 actually relies on -- and that check is run on the *fresh* snapshot, so the window where two processes both see "not yet installed", both stage, both reach commit, is real but small. The `write-file-atomic` queue from Phase 1 D-03 ensures the *final* `state.json` byte content is one of the two writers' versions, never a torn write.
**Warning signs:** Any Phase 2 PR that adds `proper-lockfile`, `lockfile`, `flock`, or hand-rolled lock-file logic. Any test that claims to verify cross-process safety. Any docstring that says "concurrent" without specifying "in-process".
**Verification:** Phase 1 SUMMARY handoff item #6 confirms the primitive lives in `transaction/with-state-guard.ts`; the file does not yet exist (Phase 2 creates it). V1's `transaction/state-guard.ts:11-23` docstring is the canonical contract -- port it verbatim.

### Pitfall 5: ESLint `no-restricted-syntax` blocks `console.warn` everywhere except the IL-3 site, but the disable-comment incantation has TWO eslint rules to disable
**What goes wrong:** Phase 1 D-06 wired `no-restricted-syntax` selectors AND base `no-console` rule. The IL-3 sanctioned `console.warn` in `migrateLegacyMarketplaceRecords` will fail two lint rules unless both are disabled in the same comment.
**Why it happens:** ESLint flat config can enable both rules independently; either alone catches `console.warn`, but both must be disabled to allow the call. Phase 1 SUMMARY handoff item #2 documents the exact incantation; Pitfall #5 of the project research PITFALLS.md (referenced in CONTEXT.md) flags this.
**How to avoid:** Use the EXACT incantation from Phase 1 SUMMARY handoff #2:
```typescript
// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
console.warn(`...`);
```
Place ONLY at the `migrateLegacyMarketplaceRecords` save-failure callsite. Any other `console.warn` in Phase 2 code triggers `tests/architecture/no-shell-out.test.ts` and lint failures.
**Warning signs:** Two-line ESLint failure on the migration save site; tests passing locally but CI failing.
**Verification:** Phase 1 SUMMARY handoff item #2 has the exact comment; the no-restricted-syntax selector message in `eslint.config.js` documents the IL-3 sanctioned site.

### Pitfall 6: The hash walk MUST use POSIX path joiner for cross-OS reproducibility
**What goes wrong:** `path.join(rel, entry.name)` on Windows produces `\\`-separated paths; on macOS/Linux, `/`-separated. Hashing the path bytes verbatim (D-12) means a Windows hash and a Linux hash of the same plugin tree differ, defeating the entire normalization effort.
**Why it happens:** Node's `path.join` is OS-aware by default; this is desirable for filesystem ops but fatal for cross-OS deterministic hashing. CONTEXT.md D-11 mentions normalization but doesn't call out path-separator normalization explicitly.
**How to avoid:** Use `path.posix.join(rel, entry.name)` for the path-bytes argument to `hash.update(...)`, AND `path.join(root, childRel)` for the actual filesystem read. Two different joiners on purpose.
**Warning signs:** Snapshot test passing on macOS CI but failing on Windows CI (or vice versa). A `hash-<12hex>` value that drifts between developer machines.
**Verification:** Snapshot fixture in `tests/domain/fixtures/hash-stability/` includes the precomputed expected hash; the test runs on whatever OS CI uses (Phase 1 D-01 = Node 24 only, but Phase 7's e2e suite may add Windows).

### Pitfall 7: TypeBox `Static<>` of `Type.Optional(...)` properties produces `T | undefined`, not optional `T?`
**What goes wrong:** A `Type.Object({ ref: Type.Optional(Type.String()) })` infers as `{ ref: string | undefined }`, not `{ ref?: string }`. Code that destructures `const { ref } = parsed` works, but code that does `if ('ref' in parsed)` may not match the runtime shape (TypeBox `Check()` accepts both forms but the runtime object may have either).
**Why it happens:** TypeBox infers strict types; the `?` modifier on optional keys is NOT applied because TypeBox's static inference predates exact-optional-property-types behavior in TS.
**How to avoid:** Use `parsed.ref === undefined` checks; don't rely on `'ref' in parsed`. Document this on every `Type.Optional` field used by Phase 2 schemas. (The state-load migration code in particular needs to handle "field absent" vs "field set to undefined" -- for Phase 2 they should be treated identically.)
**Warning signs:** Tests passing in unit context but state-migration tests failing on legacy fixtures that have the field absent rather than `undefined`.
**Verification:** Read `node_modules/typebox/build/type/types/_optional.d.mts` -- `Optional` adds the type to `Static<>` as a union with `undefined`, not as a `?`-modified property.

### Pitfall 8: PRD §6.5 RN-1's prefix-elision rule has THREE different cases per resource type
**What goes wrong:** A naive `generatedSkillName(plugin, source)` that does `${plugin}-${source}` produces `acme-acme-foo` when the source already starts with `acme-`. PRD RN-1 explicitly says "prefix elided" but the implementation requires three slightly different rules per resource type:
- **Skills:** `<plugin>-<skill>`, with `<plugin>-` prefix elided when source starts with `<plugin>-`
- **Commands:** `<plugin>:<command>`, with `<plugin>-` prefix (note: the **dash** prefix is elided, but the **colon** is the separator)
- **Agents:** `claude-marketplace-<plugin>-<agent>`, with `<plugin>-` prefix on source elided
**Why it happens:** Three resource types, three slightly different separators (`-`, `:`, double-prefix), one elision rule. Easy to write a single helper that gets one case wrong.
**How to avoid:** Three separate functions, one per resource type. Test each with both prefix-present and prefix-absent source names. V1's `agent/stage.ts`, `resource/stage.ts` have the canonical V1 implementations -- port verbatim.
**Warning signs:** Test expecting `acme-foo` but getting `acme-acme-foo` (or vice versa); test expecting `acme:foo` but getting `acme:acme-foo`.
**Verification:** PRD §6.5 RN-1 + Appendix B has the verbatim contract; PRD §5.5 SK-2, §5.6 CM-2, §5.7 AG generated-name detail rows confirm.

### Pitfall 9: `marketplaces` map being empty (vs undefined) on first-load -- handle both as `{}`
**What goes wrong:** A fresh state.json with `{ "schemaVersion": 1, "marketplaces": {} }` and a missing-file ENOENT both must produce `{ schemaVersion: 1, marketplaces: {} }` in memory. CONTEXT.md "Deferred Ideas" #6 calls this out explicitly: "State-io should treat missing/empty/undefined consistently (default to empty object, never throw); a small invariant test plus the existing state-schema.ts will cover."
**Why it happens:** ENOENT is the easy case; a malformed `{ "marketplaces": null }` or `{ "marketplaces": [] }` should throw (per V1 `validateState` line 162-167).
**How to avoid:** TypeBox schema for `ExtensionState` requires `marketplaces` be an object (use `Type.Object({})`); TypeBox `Check()` rejects null/array. ENOENT in `loadState` returns `DEFAULT_STATE`. Empty object passes through unchanged.
**Warning signs:** Tests passing on `{}` but failing on missing-file; or vice versa.
**Verification:** V1 `state/io.ts:32-39` -- verbatim ENOENT handler; port unchanged.

### Pitfall 10: `parsePluginSource` MUST classify `foo/bar` (no `./` or `../`) as `unknown`, NOT `github`
**What goes wrong:** MM-4 explicitly says non-relative string sources become `{ kind: 'unknown', reason: 'non-relative string source ...' }`. A naive parser that treats any single-slash string as `owner/repo` will misclassify a relative-path-without-leading-dot as a GitHub source.
**Why it happens:** The parser is plugin-source-aware (only `./`, `../`, and absolute paths qualify as paths) but the test surface for that is small.
**How to avoid:** The path branch tests for explicit `./`, `../`, `/`, `~/`, `~` prefixes. Anything that doesn't match those prefixes falls through to the GitHub-or-unknown branch. The GitHub branch tests for one-slash-exactly. Anything else (including `foo/bar/baz` with multiple slashes) is `unknown`.
**Warning signs:** A test with input `foo/bar` returning `kind: 'github'` instead of `kind: 'unknown'`.
**Verification:** PRD §6.3 MM-4 verbatim; V1 `sources.ts` does NOT have plugin-source parsing (V1's parser is for marketplace sources only -- Phase 2's plugin-source parser is partly novel; mirror MM-3's classification scheme).

## Code Examples

### Verifying NFR-7 narrowing with `// @ts-expect-error` (Phase 2 success criterion 1)

```typescript
// tests/domain/resolver.types.test.ts
// Source: PR-1 + NFR-7 + Phase 2 success criterion 1; CONTEXT.md "Specific Ideas" item 4.
import type { ResolvedPlugin } from '../../extensions/claude-marketplace/domain/resolver.ts';

declare const r: ResolvedPlugin;

if (r.installable) {
  // OK -- narrowed to the installable variant.
  const root: string = r.pluginRoot;
  void root;
} else {
  // @ts-expect-error -- pluginRoot must NOT be accessible on the not-installable variant.
  const root: string = r.pluginRoot;
  void root;
}
```

`node:test` does not need to execute this file for the test to "pass" -- `tsc --noEmit` failing is the failure mode. Wire via the existing `npm run typecheck` step (already part of `npm run check` per Phase 1).

### Snapshot test for `(rollback partial: ...)` formatting (D-03 / AS-4)

```typescript
// tests/transaction/rollback.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRollbackError } from '../../extensions/claude-marketplace/transaction/rollback.ts';
import { ROLLBACK_PARTIAL } from '../../extensions/claude-marketplace/shared/markers.ts';

test('formatRollbackError emits ES-5 marker exactly (AS-4)', () => {
  const result = {
    ok: false as const,
    error: new Error('staging failed'),
    rollbackPartials: [
      { phase: 'skills/prompts', msg: 'rm failed' },
      { phase: 'agents',         msg: 'index unreadable' },
    ],
    leaks: [],
  };
  const err = formatRollbackError(result, result.error);
  // Marker prefix is verbatim from shared/markers.ts:
  assert.ok(
    err.message.includes(`${ROLLBACK_PARTIAL}[skills/prompts] rm failed; [agents] index unreadable)`),
    `got: ${err.message}`,
  );
});
```

### `runPhases` reverse-undo + leak threading test (D-01 / AS-5)

```typescript
// tests/transaction/phase-ledger.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runPhases, type Phase } from '../../extensions/claude-marketplace/transaction/phase-ledger.ts';

test('runPhases: phase 3 throws → undo of phases 1+2 in reverse order', async () => {
  const order: string[] = [];
  type Ctx = { trace: string[] };
  const phases: Phase<Ctx>[] = [
    { name: 'p1', do: async (c) => { c.trace.push('do:p1'); }, undo: async (c) => { c.trace.push('undo:p1'); } },
    { name: 'p2', do: async (c) => { c.trace.push('do:p2'); }, undo: async (c) => { c.trace.push('undo:p2'); } },
    { name: 'p3', do: async () => { throw new Error('boom'); } },
    { name: 'p4', do: async (c) => { c.trace.push('do:p4'); } },
  ];
  const ctx: Ctx = { trace: order };
  const result = await runPhases(phases, ctx);
  assert.equal(result.ok, false);
  assert.equal(result.error?.message, 'boom');
  assert.deepEqual(order, ['do:p1', 'do:p2', 'undo:p2', 'undo:p1']);   // reverse-order undo
});

test('runPhases: undo failure aggregated with phase name (AS-4)', async () => {
  type Ctx = object;
  const phases: Phase<Ctx>[] = [
    { name: 'p1', do: async () => {}, undo: async () => { throw new Error('rm leak'); } },
    { name: 'p2', do: async () => { throw new Error('boom'); } },
  ];
  const result = await runPhases(phases, {});
  assert.equal(result.ok, false);
  assert.deepEqual(result.rollbackPartials, [{ phase: 'p1', msg: 'rm leak' }]);
});
```

### Hash-stability snapshot test (D-11 / D-12 / Phase 2 success criterion 5)

```typescript
// tests/domain/version.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeHashVersion, HASH_WALK_SKIP } from '../../extensions/claude-marketplace/domain/version.ts';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/hash-stability/sample-plugin');

test('computeHashVersion returns stable 12-hex prefix (PI-7 contract)', async () => {
  const got = await computeHashVersion(FIXTURE);
  // Snapshot value pre-computed once and pinned. Re-pinning requires a
  // CHANGELOG entry per PI-7 ("12-char truncation is a stable contract").
  assert.equal(got, 'hash-3f2a91b8c4d6');
  assert.match(got, /^hash-[0-9a-f]{12}$/);
});

test('computeHashVersion is invariant across CRLF↔LF and BOM↔no-BOM (D-11)', async () => {
  // Two fixture trees with byte-different but normalized-equivalent files
  // produce the same hash.
  const a = await computeHashVersion(path.join(FIXTURE, '../sample-lf'));
  const b = await computeHashVersion(path.join(FIXTURE, '../sample-crlf-bom'));
  assert.equal(a, b);
});

test('computeHashVersion ignores HASH_WALK_SKIP entries (D-12)', async () => {
  // FIXTURE includes `.git/HEAD` and `.DS_Store`; adding/removing them must
  // NOT change the hash.
  assert.deepEqual([...HASH_WALK_SKIP], ['.git', 'node_modules', '.DS_Store']);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Type.Recursive(This => Type.Object({ ... children: Type.Array(This) ... }))` | `Type.Cyclic({ Plugin: Type.Object({ ... }) }, 'Plugin')` or `Type.Module({ Plugin: ..., Manifest: ... })` | TypeBox 1.0 [CITED: github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0-migration.md] | Direct rename + structural shift; old code does not compile in 1.x |
| `import { TypeCompiler } from '@sinclair/typebox/compiler'` | `import { Compile } from 'typebox/compile'` | TypeBox 1.0 (package rename + scope drop) | Old import path still works on 0.34 LTS but is bug-fix-only through 2026; Phase 2 stays on 1.x |
| `TypeCompiler.Compile(SCHEMA)` returning `TypeCheck<T>` | `Compile(SCHEMA)` returning `Validator<...>` | TypeBox 1.0 | `.Check(value)` still type-guards; new methods `.Parse()`, `.Errors()`, `.IsAccelerated()`, `.Decode()`, `.Encode()` |
| Hand-rolled `validateMarketplace` / `validatePluginManifest` (V1) | TypeBox `MARKETPLACE_VALIDATOR.Parse()` / `PLUGIN_MANIFEST_VALIDATOR.Parse()` | Phase 2 (D-05/D-07) | ~150 V1 lines collapse to ~50 lines of schema declarations + 2 `Compile()` calls |
| Nested try/catch rollback chain (V1 `plugin/install.ts:130-260`) | `runPhases<C>(phases, ctx)` (D-01) | Phase 2 | The single biggest architectural improvement over V1 -- rollback failures aggregate in one place |
| `console.warn` in V1 `state/io.ts:73` | Same `console.warn` (IL-3 sanctioned), now in `persistence/migrate.ts` with explicit eslint-disable comment | Phase 2 (D-06 enforcement) | Behavior identical; ESLint enforcement moved upstream so future drift is caught |
| `Type.Union([...], { discriminator: 'kind' })` (NEVER existed in 1.x) | `Type.Union([Type.Object({ kind: Type.Literal('a'), ... }), ...])` (literal-tagged variants) | n/a -- CONTEXT.md/Phase 1 SUMMARY language is incorrect; Phase 2 must use the literal-tagged form | See Pitfall 1 |

**Deprecated/outdated:**
- `@sinclair/typebox` 0.34.x -- bug-fix-only LTS through 2026; Phase 1 migrated to `typebox` 1.x.
- `Type.Recursive` -- removed in 1.0.
- `TypeCompiler.Compile` -- replaced by `Compile`.
- V1's hand-rolled `validateState` -- replaced by `STATE_VALIDATOR.Parse()` in Phase 2.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node ≥ 22 (NFR-4) -- `package.json` `engines.node: ">=22"`. Phase 1 D-01 narrowed CI to Node 24 only.
- **Tech stack:** TypeScript strict; resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7) -- verified by `// @ts-expect-error` test (success criterion 1).
- **Pi API:** `@mariozechner/pi-coding-agent` peer dependency, currently `>=0.70.6` (Phase 1 D-05 interim floor); pinning a final min version is a Phase 7 SHOULD (NFR-11). Phase 2 imports only types (`ExtensionAPI`, `ExtensionContext`).
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1. Phase 2's `state-io.ts` MUST route through `shared/atomic-json.ts` (Phase 1 D-03), never call `fs.writeFile` for `state.json`.
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3). Phase 2 deliverables are all retry-safe by construction (pure functions + `withStateGuard`'s load-fresh semantics).
- **Network policy:** Phase 2 does NOT touch the network (NFR-5). Verified -- no imports from `node:https`, `node:http`, `isomorphic-git/http/*`.
- **Containment:** Refuse to write outside `<scopeRoot>/claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json` (NFR-10). `persistence/locations.ts` SC-3 brand symbol is the chokepoint; every name-derived path inside the bundle calls `assertPathInside` from Phase 1's `shared/path-safety.ts`.
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests (NFR-6). Phase 2 adds `tests/{domain,persistence,transaction}/` and must keep this green at the end of every plan.
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)` (IL-2). The single sanctioned `console.warn` is `migrateLegacyMarketplaceRecords` (IL-3) -- see Pitfall 5 for the disable-comment incantation.
- **No telemetry V1:** No metrics, no event sink, no analytics endpoint (IL-4). `tests/architecture/no-telemetry-deps.test.ts` from Phase 1 enforces; Phase 2 must not introduce any vendor SDK.
- **English only V1:** No message catalog, no locale negotiation (IL-1).
- **Scope model:** Exactly two scopes -- `user` (`~/.pi/agent/`) and `project` (`<cwd>/.pi/`). Claude Code's `local` scope is not introduced (SC-1). `Scope` type lands in `shared/types.ts` per Phase 1 SUMMARY handoff #1.

## Phase Requirements

| ID | Description (PRD §) | Research Support |
|----|--------------------|-------------------|
| **NFR-7** | TypeScript surface uses strictly typed resolved-plugin variants; installable consumers cannot read `pluginRoot` from non-installable | Pattern 1 (literal-tagged Type.Union); success criterion 1 `@ts-expect-error` test (Code Examples §1) |
| **NFR-12** | `marketplace.json` parser is forward-compatible (no schema-version check; unknown source kinds parse to `{ kind: "unknown", reason }`) | D-08 / Pattern 4 (`unknown` discriminated branch); MM-4 source-parser handling |
| **SP-1** | Parser accepts only the listed forms (`owner/repo`, `https://github.com/owner/repo[.git][#<ref>]`, trailing-slash variants, empty fragment, paths) | Pattern 4 + V1 `sources.ts:84-200` verbatim port |
| **SP-2** | Reject `owner/repo@<ref>` with hint pointing at `https://github.com/<owner/repo>#<ref>` | Pattern 4 (atIdx branch) -- exact V1 error wording in `sources.ts:107-110` |
| **SP-3** | Reject `git@…`, other `://` URLs, and `https://github.com/.../tree/<ref>` | Pattern 4 (`raw.startsWith('git@') || raw.includes('://')` branch); browser-paste reject in V1 `parseGitHubUrl:175-180` |
| **SP-4** | Reject per-user tilde forms (`~user/foo`) | Pattern 4 (`raw.startsWith('~')` after `~/` check) -- V1 `sources.ts:99-102` |
| **SP-5** | `owner/repo` requires exactly one slash, both halves non-empty, no further segments; empty `#` fragment dropped | Pattern 4 (slash count + parts.length === 2) -- V1 `parseGitHubUrl:160-180` |
| **SP-6** | Source factory functions (`pathSource`, `githubSource`) validate at every boundary including state-load | Pattern 4 (factories wrap parse + validate-or-throw); ST-6 funnels state-load through same factories |
| **SP-7** | Tilde paths stored unchanged in `state.json`; `expandTildePath` applied at access time | `raw` field in PathSource preserves verbatim; `expandTildePath` is V1 `location/index.ts` helper, not Phase 2 scope (Phase 4 marketplace orchestrator owns) |
| **SC-1** | Two scopes: `user`, `project`; no `local` | `Scope = 'user' \| 'project'` in `shared/types.ts` per handoff #1 |
| **SC-2** | Extension data at `<scopeRoot>/claude-marketplace/`; bridge files at `<scopeRoot>/agents/` and `<scopeRoot>/mcp.json` | `persistence/locations.ts` ScopedLocations fields -- V1 `location/index.ts` verbatim port |
| **SC-3** | `ScopedLocations` is typed bundle (brand symbol); hand-crafted shapes mixing scopes MUST not type-check | `unique symbol` brand pattern -- V1 `location/index.ts:33` verbatim port |
| **SC-4** | With `--scope`, error if name not found there; without `--scope`, search both, error on dual-found or not-found | Phase 4 owns the orchestrator; Phase 2 provides `loadState` for both scopes (the type bundle exists per SC-3) |
| **SC-7** | Path containment enforced for every name-derived path | `pluginDataDir` / `marketplaceDataDir` / `sourceCloneDir` methods on ScopedLocations call `assertPathInside` per V1 `location/index.ts:97-118` |
| **MM-1** | `marketplace.json` MUST have string `name`, array `plugins`, optional boolean `strict`, optional `owner.name` | TypeBox `MARKETPLACE_SCHEMA` in `domain/manifest.ts` (Pattern 2) |
| **MM-2** | Plugin entries MUST have safe-name `name`, `source` field, optional fields | TypeBox `PLUGIN_ENTRY_SCHEMA` in `domain/components/plugin.ts` |
| **MM-3** | `parsePluginSource` classifies into `path`/`github`/`url`/`git-subdir`/`npm` or `unknown`-with-reason; only `path` is installable in V1 | Pattern 4 + the resolver's source-kind switch (V1 `plugin/resolve.ts:151-154`) |
| **MM-4** | Non-relative string source becomes `{ kind: "unknown", reason: "..." }`, NOT `{ kind: "github" }` | Pattern 4 final branch + Pitfall 10 |
| **MM-5** | `strict=true` (default): resolver takes union of marketplace-entry, plugin-manifest, implicit-by-convention, standalone-file declarations | `resolveStrict` (D-04) -- V1 `plugin/resolve.ts:140-300+` is the canonical implementation |
| **MM-6** | `strict=false`: resolver uses entry-only; manifest/convention unsupported declarations cause "component declarations conflict" non-installable | `resolveLoose` (D-04) |
| **MM-7** | `strict=false`: manifest/standalone `mcpServers` without entry-level declaration also conflicts | `resolveLoose` MCP branch |
| **PR-1** | Resolver returns discriminated union; non-installable variant MUST NOT expose `pluginRoot` | Pattern 1 + success criterion 1 test |
| **PR-2** | Resolver marks unavailable for: non-`path` source, source escape, missing source dir, malformed manifest, declared unsupported components, malformed mcpServers, non-string component path, escaping component path, array-form supported component path | V1 `plugin/resolve.ts` enumerates all 9 cases; verbatim port |
| **PR-3** | Unsupported component name produces note `contains <name>` and disqualifies install | V1 `plugin/resolve.ts` UNSUPPORTED_COMPONENTS branch |
| **PR-4** | Detect implicit components by convention only when corresponding manifest field absent | V1 `plugin/resolve.ts:206-224` (implicitComponentKeys + hooks/hooks.json + .mcp.json) |
| **PR-5** | `dependencies` present adds note `declares dependencies that must be installed manually` but keeps installable | V1 `plugin/resolve.ts` dependencies branch |
| **PR-6** | `requireInstallable` narrows to installable variant or throws | TypeScript narrowing: `function requireInstallable(r: ResolvedPlugin): asserts r is ResolvedPluginInstallable { if (!r.installable) throw new Error(...); }` |
| **RN-1** | Generated names deterministic from `(plugin, source-name)` per resource type | Pitfall 8 + V1 `agent/stage.ts`, `resource/stage.ts` |
| **RN-2** | All names `assertSafeName`: non-empty, trimmed, not `.`/`..`, no path separators, no control chars | V1 `validation.ts:16-39` verbatim port to `domain/name.ts` (or `shared/types.ts`); Phase 1 `path-safety.ts` already imports from V1's pattern |
| **ST-1** | State at `<extensionRoot>/state.json` with `schemaVersion: 1`; save atomic | V1 `state/io.ts:140-143` -- port; `atomicWriteJson` from Phase 1 |
| **ST-2** | Per-marketplace records: name, scope, source, addedFromCwd, manifestPath, marketplaceRoot, optional lastUpdatedAt, optional autoupdate, plugins map | V1 `types.ts:55-86` -- port to TypeBox schema (or keep as TS interfaces with hand-validated `validateState`; D-05 says TypeBox so use it) |
| **ST-3** | Per-plugin install records: version, resolvedSource, compatibility, resources, installedAt, updatedAt | V1 `types.ts:30-51` -- port |
| **ST-4** | Legacy records missing `manifestPath`/`marketplaceRoot` MUST be load-time-migrated | V1 `state/io.ts:84-138` `migrateLegacyMarketplaceRecords` -- verbatim port |
| **ST-5** | Legacy plugin records missing `resources.agents`/`resources.mcpServers` MUST be load-time-normalized to `[]` | V1 has this in `plugin/uninstall.ts` per PU-6; Phase 2 lifts to `migrate.ts` |
| **ST-6** | Source-record validation funnels through same factory as parse-time | Pattern 4 + factories called by `state-io.ts` |
| **ST-7** | All mutating operations run inside `withStateGuard` (re-load fresh, save only on no-throw) | Pattern 6 |
| **ST-8** | Concurrent install/uninstall detected at commit; uninstall soft-converges, install hard-fails-with-rollback | Pattern 6 + Pitfall 4 |
| **ST-9** | Update detects concurrent change at commit (`installed=false` or `version !== fromVersion`) and aborts with "changed concurrently; retry the update" | Pattern 6 (orchestrator-side check inside the closure) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `discriminator` option is silently ignored on `Type.Union` rather than rejected at compile time | Pitfall 1 [VERIFIED: TypeBox 1.1.38 `union.d.mts` shows `Union(anyOf, options?: TSchemaOptions)` and `TSchemaOptions` is open-ended with `[key: string]: unknown` patterns; verified by reading `node_modules/typebox/build/type/types/union.d.mts` and `schema.d.mts`] | Low -- even if it errored, we'd want to remove it; the recommended literal-tagged pattern works regardless |
| A2 | `Static<>` of `Type.Optional` produces `T \| undefined` (not `T?`) on installed `typebox@1.1.38` | Pitfall 7 [VERIFIED via `node_modules/typebox/build/type/types/_optional.d.mts`] | Low -- well-documented TypeBox behavior across all 1.x versions |
| A3 | V1's `withStateGuard` semantics are correct for ST-7..9 (intra-process only) and Phase 2 should port verbatim | Pattern 6 + Pitfall 4 | Medium -- if cross-process safety is silently expected by ST-8/9, the deliverable would be wrong; mitigated by Pitfall 4's docstring requirement |
| A4 | `runPhases` is the right primitive name (vs. `runLedger`, `runPipeline`, `runStages`) | Pattern 3 [CITED: CONTEXT.md D-01 names it `runPhases`] | None -- name locked by D-01 |
| A5 | `path.posix.join` for hash-bytes argument produces stable cross-OS hashes | Pitfall 6 [CITED: Node docs `path.posix` is the explicit POSIX-flavor module always-available regardless of runtime OS] | Low -- well-documented Node behavior; snapshot test catches regressions |
| A6 | `Type.Cyclic` and `Type.Module` produce equivalent runtime behavior for the manifest schema's recursive plugin refs (D-03 "one Type.Recursive() boundary") | Pattern 1 + State of the Art [VERIFIED: `node_modules/typebox/build/type/types/cyclic.d.mts` exists; CONTEXT.md D-03 says "one Type.Recursive() boundary" -- D-03 should read "one Type.Cyclic() boundary" but the architectural intent is preserved] | Low -- both work; planner picks based on readability |
| A7 | The `Type.Literal(true)` / `Type.Literal(false)` discriminator produces the same TypeScript narrowing as `Type.Literal('installable')` / `Type.Literal('not_installable')` | Pattern 1 [CITED: TypeBox docs `Static<TLiteral<true>> = true`] | Low -- boolean literals are TypeScript discriminants identical to string literals; PR-1 wording (`installable: true \| false`) wins |
| A8 | The IL-3 `console.warn` disable-comment requires both `no-restricted-syntax` AND `no-console` rules disabled | Pitfall 5 [CITED: Phase 1 SUMMARY handoff item #2] | None -- handoff item is explicit |
| A9 | `eslint.config.js` per-file overrides for `tests/**/*.ts` already permit `console.warn` in tests | (No-op for Phase 2 tests) [CITED: Phase 1 SUMMARY: "per-file overrides for shared/notify.ts and tests/**/*.ts"] | Low -- verified in Phase 1 SUMMARY; no action needed |

**If this table is empty:** N/A -- assumptions exist and are tracked.

## Open Questions

1. **Should `domain/components/{skill,command,agent,mcp}.ts` exist as separate files in Phase 2, or only `domain/components/plugin.ts` and `domain/components/mcp.ts`?**
   - What we know: CONTEXT.md D-03 lists all five (`plugin/skill/command/agent/mcp`). D-05 says "domain/manifest.ts owns TypeBox schemas" and component schemas are split. Phase 3 owns the bridge implementations for skill/command/agent/mcp; the SCHEMA for each could live in `domain/components/` so Phase 2 lands them, OR could live next to the bridge in Phase 3.
   - What's unclear: whether the **schema** for, say, an agent's frontmatter shape is Phase 2 (declared with the manifest schemas) or Phase 3 (declared with the agent bridge that consumes it).
   - Recommendation: in Phase 2, land **only** `domain/components/plugin.ts` (the plugin-entry shape inside `marketplace.json`) and `domain/components/mcp.ts` (the `mcpServers` map shape -- needed by both the manifest validator AND Phase 3's MCP bridge). Defer `skill/command/agent` per-component schemas to Phase 3 unless a manifest-validation seam needs them. Reasoning: skill/command/agent shapes are runtime-discovered (V1 `agent/stage.ts` line-parses YAML frontmatter); they're not part of `marketplace.json` or `plugin.json`. The CONTEXT.md D-03 list is slightly aspirational.

2. **Where exactly does `Scope` live -- `shared/types.ts` only, or re-exported from `domain/`?**
   - What we know: Phase 1 SUMMARY handoff #1 says "Move `Scope` to `shared/types.ts`" and notes `domain/` may re-export. The 9-folder boundary rules forbid `edge/ → domain/`, so `edge/` must read `Scope` from `shared/`.
   - What's unclear: whether `domain/` should re-export, or whether everyone (including `domain/`) imports from `shared/types.ts` directly.
   - Recommendation: everyone imports from `shared/types.ts` directly. No re-export from `domain/`. Re-exports add maintenance surface for no benefit; explicit imports are searchable.

3. **Is the snapshot test for `(rollback partial: …)` the same test as `tests/architecture/markers-snapshot.test.ts`, or a separate test in `tests/transaction/`?**
   - What we know: Phase 1 already shipped `tests/architecture/markers-snapshot.test.ts` which asserts the marker prefix from `shared/markers.ts` matches PRD §6.12 byte-for-byte. CONTEXT.md "Existing Code Insights" says "Snapshot test infrastructure already wired."
   - What's unclear: whether Phase 2 needs a **runtime-emission** test (`formatRollbackError(...)` produces the right string) in addition to the prefix test, or whether the prefix test is sufficient.
   - Recommendation: add `tests/transaction/rollback.test.ts` with the runtime-emission assertion (Code Examples §2). The prefix test covers "the constant matches the PRD"; the new test covers "the formatter assembles the constant correctly with `[<phase>] <msg>` substitution." Both are needed.

4. **Does `runPhases` need to support phases that themselves do `await withStateGuard(...)`?**
   - What we know: D-02 LOCKED says `withStateGuard` wraps `runPhases` (outer guard, inner ledger). Inversion ("ledger wraps guard inside terminal phase") was rejected.
   - What's unclear: whether a *non-terminal* phase can call `withStateGuard` for some unrelated read (e.g., reading state of a different scope). The locked decision implies no -- the orchestrator owns state lifecycle.
   - Recommendation: `runPhases` does not need to know about `withStateGuard` at all. The contract is "`do` and `undo` are async and may do anything." If a phase happens to use `withStateGuard` internally, that's a code smell (suggests state lifecycle has leaked into a non-state phase) but not a runtime correctness issue. Lint/review at PR time, not at type level.

5. **PR-2 lists nine non-installable cases; does Phase 2's `resolveStrict` need a fixture per case, or is a representative subset sufficient?**
   - What we know: success criterion 2 says "Source-parser fixtures cover every accept/reject case in PRD §6.1" -- that's source parsing, not the resolver. CONTEXT.md "Specific Ideas" item 2 says `resolver-strict.spec.ts` and `resolver-loose.spec.ts` "each PRD case maps 1:1 to a test name so REQ-ID coverage is grep-able."
   - What's unclear: whether "1:1 to a test name" means PR-2's nine sub-cases × the strict/loose split = 18 test names, or one test name per PR-* requirement.
   - Recommendation: 1:1 per PR-* requirement, plus one fixture per PR-2 sub-case (so the test name `resolver: PR-2 unsupported source kind 'github'` covers one of the nine cases). Total ~14 strict-resolver tests + ~12 loose-resolver tests. Mirrors V1's existing test coverage shape.

## Environment Availability

> Phase 2 is purely code/config changes inside the existing extension. No new external runtime dependencies are introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | 24.x (per Phase 1 D-01) | -- |
| `typebox@^1.1.38` | `domain/manifest.ts` schemas + `persistence/state-io.ts` schema | ✓ | 1.1.38 (verified `node_modules/typebox/package.json`) | -- |
| `write-file-atomic@^8.0.0` (transitive via Phase 1 `shared/atomic-json.ts`) | `persistence/state-io.ts` save path | ✓ | 8.0.0 | -- |
| `node:crypto` | `domain/version.ts` SHA-256 | ✓ (built-in) | -- | -- |
| `node:fs/promises` | `domain/version.ts` walk + `persistence/state-io.ts` read | ✓ (built-in) | -- | -- |
| `node:path` (incl. `node:path/posix`) | `domain/version.ts` cross-OS path joiner + `persistence/locations.ts` | ✓ (built-in) | -- | -- |
| `@mariozechner/pi-coding-agent` types (`ExtensionAPI`, `ExtensionContext`) | none in Phase 2 (only Phase 1's `index.ts` + Phase 1's notify wrappers consume) | ✓ | 0.73.1 | -- |
| `node:test` | All Phase 2 tests | ✓ (built-in, native TS strip on Node 24 per D-02) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

> `.planning/config.json` does not exist on disk; per the "absent = enabled" rule, Validation Architecture is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node 24 native TS strip per Phase 1 D-02) |
| Config file | none -- `package.json` script `"test": "node --test \"tests/**/*.test.ts\""` |
| Quick run command | `node --test "tests/{domain,persistence,transaction}/**/*.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NFR-7 | resolver narrowing -- non-installable variant has no `pluginRoot` | type-level (`@ts-expect-error`) | `npx tsc --noEmit` (covered by `npm run typecheck`) | ❌ Wave 0 (`tests/domain/resolver.types.test.ts`) |
| NFR-12 | unknown source kind parses to `{ kind: 'unknown', reason }` | unit | `node --test tests/domain/source.test.ts` | ❌ Wave 0 |
| SP-1..7 | source parser accept/reject matrix per PRD §6.1 | table-driven unit | `node --test tests/domain/source.test.ts` | ❌ Wave 0 |
| SC-1, SC-2, SC-3, SC-7 | ScopedLocations brand + path containment | unit | `node --test tests/persistence/locations.test.ts` | ❌ Wave 0 |
| SC-4 | scope-resolution policy (planner: orchestrator owns; Phase 2 only ships `loadState`) | n/a Phase 2 | n/a | n/a |
| MM-1..7 | TypeBox schemas accept valid + reject invalid manifests | unit + table-driven | `node --test tests/domain/manifest.test.ts` | ❌ Wave 0 |
| PR-1..6 | resolver strict + loose modes; 9 unavailable cases per PR-2 | unit, table-driven, plus type-level for PR-1 | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ❌ Wave 0 |
| RN-1..2 | generated-name elision rules (3 resource types) + assertSafeName | unit, table-driven | `node --test tests/domain/name.test.ts` | ❌ Wave 0 |
| ST-1 | state.json save is atomic via `atomicWriteJson` | unit (mocks atomicWriteJson) | `node --test tests/persistence/state-io.test.ts` | ❌ Wave 0 |
| ST-2..3 | state shape per-marketplace and per-plugin records | unit | `node --test tests/persistence/state-io.test.ts` | ❌ Wave 0 |
| ST-4 | legacy records missing `manifestPath`/`marketplaceRoot` migrate at load | unit + fixtures | `node --test tests/persistence/migrate.test.ts` | ❌ Wave 0 (incl. `tests/persistence/fixtures/legacy/*.json`) |
| ST-5 | legacy `resources.agents`/`mcpServers` normalized to `[]` | unit + fixtures | same | ❌ Wave 0 |
| ST-6 | state-load funnels through pathSource/githubSource factories | unit | `node --test tests/persistence/state-io.test.ts` | ❌ Wave 0 |
| ST-7 | `withStateGuard` re-loads fresh, saves on no-throw, doesn't save on throw | unit | `node --test tests/transaction/with-state-guard.test.ts` | ❌ Wave 0 |
| ST-8 | concurrent install hard-fail (orchestrator-side check inside closure) | integration-style unit (two in-process closures) | same | ❌ Wave 0 |
| ST-9 | concurrent update aborts with "changed concurrently" | integration-style unit | same | ❌ Wave 0 |
| IL-3 | sanctioned `console.warn` fires on async migration save failure | unit (mocks atomicWriteJson to throw) | `node --test tests/persistence/migrate.test.ts` | ❌ Wave 0 |
| PI-7 (D-11/D-12) | hash version stable across CRLF↔LF + BOM↔no-BOM; HASH_WALK_SKIP excludes .git/, node_modules/, .DS_Store | snapshot + invariance | `node --test tests/domain/version.test.ts` | ❌ Wave 0 (incl. `tests/domain/fixtures/hash-stability/`) |
| AS-4 (D-01/D-03) | `runPhases` reverse-undo + `formatRollbackError` emits ES-5 marker | unit + snapshot | `node --test tests/transaction/phase-ledger.test.ts tests/transaction/rollback.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test "tests/{domain,persistence,transaction}/**/*.test.ts"` (~30 tests, expected runtime <2s)
- **Per wave merge:** `npm run check` (typecheck + lint + format:check + full test suite -- adds Phase 1's existing `tests/{shared,architecture}/` tests)
- **Phase gate:** `npm run check` green; success criteria 1-5 from ROADMAP §Phase 2 verified

### Wave 0 Gaps
- [ ] `tests/domain/source.test.ts` -- covers SP-1..7, MM-3, MM-4, NFR-12
- [ ] `tests/domain/manifest.test.ts` -- covers MM-1, MM-2 (TypeBox `MARKETPLACE_VALIDATOR`, `PLUGIN_MANIFEST_VALIDATOR`)
- [ ] `tests/domain/resolver-strict.test.ts` -- covers MM-5, PR-1..5
- [ ] `tests/domain/resolver-loose.test.ts` -- covers MM-6, MM-7, PR-1..5 (loose path)
- [ ] `tests/domain/resolver.types.test.ts` -- type-level test for NFR-7 / PR-1 (success criterion 1)
- [ ] `tests/domain/name.test.ts` -- covers RN-1, RN-2 (3 elision rules + assertSafeName)
- [ ] `tests/domain/version.test.ts` -- covers PI-7, D-11, D-12 (success criterion 5)
- [ ] `tests/domain/fixtures/hash-stability/{sample-plugin,sample-lf,sample-crlf-bom}/` -- fixture trees
- [ ] `tests/persistence/locations.test.ts` -- covers SC-1, SC-2, SC-3, SC-7
- [ ] `tests/persistence/state-io.test.ts` -- covers ST-1, ST-2, ST-3, ST-6
- [ ] `tests/persistence/migrate.test.ts` -- covers ST-4, ST-5, IL-3 (success criterion 4)
- [ ] `tests/persistence/fixtures/legacy/*.json` -- V1-shape state.json fixtures
- [ ] `tests/transaction/with-state-guard.test.ts` -- covers ST-7, ST-8, ST-9 (success criterion 3)
- [ ] `tests/transaction/phase-ledger.test.ts` -- covers D-01 (runPhases reverse-undo + leaks)
- [ ] `tests/transaction/rollback.test.ts` -- covers D-03 / AS-4 (formatRollbackError emits ES-5 marker)

No new framework install needed -- `node:test` already wired.

## Sources

### Primary (HIGH confidence)
- **V1 source on `features/initial`** -- `extensions/claude-marketplace/{state/io.ts, sources.ts, plugin/resolve.ts, plugin/install.ts, plugin/lifecycle.ts, transaction/state-guard.ts, location/index.ts, validation.ts, types.ts}`. Inspected directly via `git show features/initial:...`. These are the canonical behavioral references for every Phase 2 module.
- **Installed `typebox@1.1.38`** -- `node_modules/typebox/{package.json, build/type/types/{cyclic,union,literal,_optional}.d.mts, build/compile/{index,validator}.d.mts, build/value/shared/union_score_select.mjs}`. Inspected directly to verify API surface.
- **TypeBox docs via Context7 CLI** (`npx ctx7 docs /sinclairzx81/typebox ...`):
  - [github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0-migration.md](https://github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0-migration.md) -- `Type.Recursive` → `Type.Cyclic`, `TypeCompiler.Compile` → `Compile`, ESM-only migration
  - [github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/cyclic.md](https://github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/cyclic.md) -- Cyclic type API
  - [github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/module.md](https://github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/module.md) -- Module / order-independent ref
  - [github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/union.md](https://github.com/sinclairzx81/typebox/blob/main/design/website/docs/type/union.md) -- Union API (no discriminator option)
  - [github.com/sinclairzx81/typebox/blob/main/design/website/docs/compile/0_compile.md](https://github.com/sinclairzx81/typebox/blob/main/design/website/docs/compile/0_compile.md) -- Compile API
- **PRD** -- `docs/prd/pi-claude-marketplace-prd.md` §5.2.1 (PI-7 hash spec), §6.1 (SP-1..7), §6.3 (MM-1..7), §6.4 (PR-1..6), §6.5 (RN-1..6), §6.9 (ST-1..9), §6.10 (PS-1..5), §6.11 (AS-1..9), §6.12 (ES-1..5), §6.13 (IL-1..5), §10 (NFR-7, NFR-12)
- **Phase 1 SUMMARY** -- `.planning/phases/01-foundations-toolchain/01-07-SUMMARY.md` (handoff items #1-9, especially #1 [Scope in shared/types.ts], #2 [IL-3 incantation], #3 [atomic JSON], #6 [Phase ledger naming], #7 [TypeBox 1.x discriminated union])
- **Phase 1 source** -- `extensions/claude-marketplace/shared/{markers,errors,notify,atomic-json,path-safety}.ts` and `index.ts` -- inspected directly
- **`npm view`** -- typebox version 1.1.38; write-file-atomic version 8.0.0 + engines

### Secondary (MEDIUM confidence)
- **write-file-atomic README via WebFetch** (`https://github.com/npm/write-file-atomic/blob/main/README.md`) -- async/sync signatures, options table, queue semantics. Used only to confirm Phase 1's existing atomic-json.ts uses the right primitives; Phase 2 doesn't add new write-file-atomic calls.
- **CONTEXT.md** for Phase 2 -- `02-CONTEXT.md` (D-01 through D-12 + Canonical References + Existing Code Insights). Used as the binding constraint set, not as a research source per se.
- **DISCUSSION-LOG** for Phase 2 -- `02-DISCUSSION-LOG.md`. Used to confirm no rejected alternatives need to surface in research.

### Tertiary (LOW confidence)
- *None.* Every claim in this research is either (a) verified against installed packages, (b) cited from official docs, or (c) read directly from V1 source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every package is already installed; versions verified via `npm view` and `node_modules/{typebox,write-file-atomic}/package.json`
- Architecture patterns: HIGH -- Patterns 1-3 cite TypeBox docs verbatim; Pattern 4 mirrors V1 source line-by-line; Pattern 5 follows D-11/D-12 + node:crypto docs; Pattern 6 mirrors V1's `state-guard.ts:24-37` verbatim
- Pitfalls: HIGH for Pitfalls 1-7 (TypeBox + V1 verified); HIGH for Pitfall 8 (PRD §6.5 + V1 source); HIGH for Pitfalls 9-10 (PRD verbatim)
- Gap resolutions (D-09/D-10/D-11): HIGH -- locked by user in CONTEXT.md
- The single MEDIUM-confidence area is Open Question 1 (component-schema folder layout) -- both interpretations are valid; recommendation given but not authoritative.

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days; TypeBox 1.x is in stable maintenance, no breaking minor expected; V1 source is git-pinned and immutable)
