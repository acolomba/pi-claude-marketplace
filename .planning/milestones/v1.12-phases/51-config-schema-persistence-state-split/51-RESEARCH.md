# Phase 51: Config Schema, Persistence & State Split - Research

**Researched:** 2026-06-09
**Domain:** Pi-extension persistence layer — typebox-validated declarative config files (`claude-plugins.json` + `.local.json`), entry-level base+local merge, and `STATE_SCHEMA` field carve-out into the new `CONFIG_SCHEMA`.
**Confidence:** HIGH

## Summary

Phase 51 is the **frozen data foundation** for v1.12. It is pure addition + a small carve-out
of `STATE_SCHEMA`, with no behavior change in command paths. Every later phase (52 migration,
53 dry-run, 54 enable/disable, 55 reconcile, 56 write-back) reads the shapes this phase locks
in: `CONFIG_SCHEMA`, `ScopeConfig`, `ConfigLoadResult` (discriminated trichotomy), `MergedConfig`
(entry-level base+local), `STATE_SCHEMA` minus `autoupdate`, and two new `locations.ts` paths.

The implementation pattern is **direct mirroring of `persistence/state-io.ts`**: a typebox
`Type.Object` + `Compile`-d JIT validator + `loadConfig`/`saveConfig` seam routing through the
existing `shared/atomic-json.ts` (`write-file-atomic`). Zero new runtime dependencies. The
new mechanics are (a) the absent/invalid/valid trichotomy as a discriminated union (not throw),
(b) the per-scope entry-level merge — explicit domain code, no `deepmerge` — and (c) the SPLIT-02
architecture test enforcing write-seam ownership. All five Phase 51 decisions sit inside the
`<canonical_refs>` already-researched stack and architecture documents; no fresh external
investigation is warranted.

**Primary recommendation:** Mirror `state-io.ts` line-for-line for `config-io.ts`. Mirror
`migrate.ts`'s `migrateLegacyMarketplaceRecords` + `persistMigratedState` fire-and-forget pair
for the D-12 autoupdate scrub. Keep `config-merge.ts` a separate file producing `MergedConfig`
with provenance. Defer all wiring (orchestrators, index.ts, notify emission) to Phases 52-56.

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Config file shape
- **D-01 (layout):** Flat, two top-level records: `marketplaces` keyed by marketplace name,
  `plugins` keyed by `plugin@marketplace`. Each plugin is its own entry-level override unit
  (a `.local.json` can flip one plugin without replacing a marketplace's plugin set). No
  nesting of plugins under marketplaces.
- **D-02 (source representation):** Marketplace `source` is a raw string -- exactly what the
  user would pass to `marketplace add` -- classified at load through the existing
  `parsePluginSource` funnel in `domain/source.ts`. No structured-object source grammar.
- **D-03 (path anchor):** Relative path sources resolve against the project root (the
  directory containing `.pi/`) for project scope, and against the home directory for user
  scope; `~` expansion supported. Write-back records the same anchored form. Absolute paths
  allowed but not required for portability.
- **D-04 (defaults):** Entry fields are optional with defaults: marketplace `autoupdate`
  omitted = `false` (matches today: add never auto-enables autoupdate); plugin `enabled`
  omitted = `true`. `"plugin@mp": {}` is a valid entry. No boolean plugin shorthand.
- **D-05 (top-level optionality):** Both top-level records are optional; an absent record
  means empty. Accepted residual: a typo'd top-level key reads as empty at schema level --
  mass-prune sanity guarding is reconcile-phase (53/55) territory, not the schema's.

#### Version pin semantics
- **D-06 (no version field):** The v1.12 config plugin entry carries NO `version` field.
  Config = pure user intent (source/autoupdate/enabled). Resolved versions stay machine
  bookkeeping in the internal state file.
- **D-07 (ENBL-02 reading):** "A disabled plugin keeps its version pin" = the internal
  record (resolved version + artefact records) survives disable, so `enable` re-materializes
  the same version from cache. SPLIT-01's "version pin" lives in the internal file, not the
  config, for v1.12.
- **D-08 (WB consequence, constrains Phase 56):** With no version field,
  `update`/`reinstall` config write-back reduces to "ensure the entry exists" -- no-op with
  no file rewrite when the entry is present; recreates it if hand-deleted while installed.

#### Schema strictness & evolution
- **D-09 (lenient unknown keys):** Unknown keys are IGNORED on load, never abort. Only known
  keys with wrong types/shapes trigger the CFG-03 invalid classification. Typo'd field names
  are silently inert and defaults apply.
- **D-10 (unknown keys round-trip):** Write-back's entry-level patches PRESERVE unknown
  fields inside any entry they touch. Unknown keys elsewhere survive untouched by
  construction because write-back never rewrites the whole file (constrains Phase 56).
- **D-11 (config schemaVersion):** Optional `schemaVersion` field; must equal `1` if
  present; omitted = 1. Write-back does not inject it into files that omit it.
- **D-12 (state schemaVersion):** No STATE_SCHEMA bump; `schemaVersion` stays `1`. The
  leftover `autoupdate` field on old state.json records is scrubbed on load via the existing
  legacy-migration path (`migrateLegacyMarketplaceRecords` + fire-and-forget persist).
- **D-13 (ORDERING RAIL, constrains Phase 52):** The autoupdate scrub must NOT destroy
  autoupdate intent before Phase 52's first-run migration captures it into the generated
  config. The migration reader must see the legacy field (e.g., scrub only when a config
  file already exists, or expose the legacy value to the migration path). Planner picks the
  mechanism; the constraint is non-negotiable.
- **D-14 (source in both files):** `state.json` KEEPS its recorded `source` alongside
  config's desired `source`. Config source = desired intent (sole authority); state source =
  materialized record (machine fact). The reconcile planner compares them; mismatch =>
  re-add. The SPLIT-02 architecture test must sanction `source` in STATE_SCHEMA as a
  materialized record -- do not read SPLIT-01's "live only in config" as forbidding it.

#### Trichotomy & load-seam shape
- **D-15 (load seam):** `loadConfig` returns a discriminated result, not throw-plus-default:
  `{ status: "absent" } | { status: "invalid"; error } | { status: "valid"; config }`.
  Exhaustive switch + `assertNever` at every consumer (NFR-7 convention). Migration keys off
  `absent`; invalid can never be mistaken for empty by a careless catch.
- **D-16 (dangling plugin reference):** A declared plugin whose marketplace is not visible
  anywhere is a VALID config -- it is a per-entry "can't load" soft-fail at reconcile time
  (reported, skipped), never a CFG-03 abort.
- **D-17 (cross-scope marketplace visibility, constrains Phase 53):** Plugin entries resolve
  their marketplace cross-scope, one-way, mirroring CMP-3
  (`orchestrators/plugin/shared.ts:203-222`): a project-config plugin entry resolves against
  project config first, then user config; a user-config plugin entry sees user marketplaces
  only.
- **D-18 (one-invalid-file fallback):** When exactly one of base/local in a scope is invalid
  and the other valid, the merged view falls back to the valid file with a warning, and
  reconcile runs FULL for that scope, prunes included. The CFG-03 abort applies when a scope
  has NO valid view. Scopes stay independent.
- **D-19 (messaging consistency):** All user-visible success/error messaging for config
  load/validation/fallback flows through `shared/notify.ts` / `emitWithSummary`. Phase 51
  itself surfaces little (seams only); this binds Phases 52/55/56 emission contexts.

### Claude's Discretion

- Internal API split between `loadConfig` (per-file) and the merge step (`config-merge.ts`
  producing `MergedConfig`), and whether merge provenance (which file an entry came from) is
  carried on `MergedConfig` for later write-back/diff use.
- Exact validation-error detail format inside the `invalid` arm (mirror
  `firstValidationErrorDetail` in state-io.ts).
- TypeScript naming (`ScopeConfig`, `MergedConfig`, `ConfigLoadResult`, etc.) and file
  placement following the research structure (`persistence/config-io.ts`,
  `persistence/config-merge.ts`, `locations.ts` additions).
- How the architecture test enforces the SPLIT-02 write-seam ownership (e.g., import-graph
  or call-site assertion style, following existing `tests/architecture/` patterns).

### Deferred Ideas (OUT OF SCOPE)

- Version pins with teeth (enforced/range pins, update policy in the committed file) --
  CFGV2-01, v2 backlog (reaffirmed by D-06).
- Boolean plugin shorthand (`"plugin@mp": true`) -- considered for file-shape ergonomics,
  rejected for v1.12.
- Mass-prune sanity guard for typo'd/empty-looking configs -- not schema-level (D-05);
  belongs to the reconcile phases (53/55) if pursued.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | User declares marketplaces (name, source, autoupdate) and plugins (`plugin@marketplace`, enabled) in per-scope `claude-plugins.json` with Pi-native typebox schema. | Standard Stack: typebox `Type.Object`+`Compile` mirror of `STATE_SCHEMA`. Code Examples: §"CONFIG_SCHEMA shape". File: `persistence/config-io.ts` (NEW). |
| CFG-02 | `claude-plugins.local.json` overrides base at entry level (never field-merged); single `MergedConfig` view consumed downstream; merge matrix unit-tested. | Architecture Patterns: "Entry-level merge as explicit domain code". Anti-Patterns: "deepmerge / lodash.merge". File: `persistence/config-merge.ts` (NEW). |
| CFG-03 | Unparseable / schema-invalid config abort signal, never silently coerced to "empty desired state"; load seam distinguishes absent vs unparseable vs valid-but-empty. | Architecture Patterns: "Discriminated `ConfigLoadResult`". Pitfalls: Pitfall 1. D-15 + D-18. |
| SPLIT-01 | Desired-state fields live only in config; `state.json` retains only machine bookkeeping; STATE_SCHEMA field-relocation documented; old state.json still loads. | Architecture Patterns: "STATE_SCHEMA carve-out (D-12 scrub via existing migrate.ts path)". D-12/D-13/D-14. |
| SPLIT-02 | Write seams split by ownership: machine records only to internal state file; user config only via command write-back / one-time migration; architecture test enforced; config + internal paths added to NFR-10 containment allow-list. | Architecture Patterns: "SPLIT-02 architecture test". File: `tests/architecture/config-state-write-seams.test.ts` (NEW). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config schema (typebox `Type.Object`) | persistence | — | Mirrors `STATE_SCHEMA` location; schema is intra-extension contract |
| Config load (read + parse + validate + trichotomy) | persistence | — | Mirrors `loadState`; pure I/O + validation, no orchestration |
| Config save (atomic write) | persistence | shared | `saveConfig` wraps `atomic-json.ts::atomicWriteJson` (`shared/`) |
| Entry-level base+local merge | persistence | domain | `config-merge.ts` is pure domain logic (no I/O) but sits in persistence because its inputs/outputs are persistence types |
| `STATE_SCHEMA` carve-out (drop `autoupdate`) | persistence | — | Field-relocation inside `state-io.ts`; legacy scrub via existing `migrate.ts` |
| Legacy `autoupdate` scrub at load | persistence | — | Reuses `migrateLegacyMarketplaceRecords` + `persistMigratedState` pattern |
| New paths (`configJsonPath`, `configLocalJsonPath`) | persistence | — | Sibling of `stateJsonPath` in `locations.ts`; under `scopeRoot` not `extensionRoot` |
| NFR-10 containment of new paths | shared | persistence | `shared/path-safety.ts::assertPathInside` invoked at write sites in persistence |
| SPLIT-02 ownership architecture test | tests/architecture | — | Mirrors existing structural-invariant tests like `import-boundaries.test.ts`, `no-shell-out.test.ts` |

**Why this matters:** Phase 51 is a single-tier (persistence) phase with one dependency on
`shared/` (atomic-json + path-safety) and one on `domain/` (source parser funnel). It must
NOT touch `edge/`, `orchestrators/`, `bridges/`, `index.ts`, or `notify.ts`. Any plan that
edits those files is out of scope for Phase 51 and must defer to Phases 52-56.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` (peer; current installed `1.2.6`) | `CONFIG_SCHEMA` + JIT validator | Already the project's schema seam; mirrors `STATE_SCHEMA` pattern in `state-io.ts` [VERIFIED: `package.json` dev/peer + `state-io.ts` import] |
| `write-file-atomic` | `^8.0.0` (direct dep) | `saveConfig` atomic write via `shared/atomic-json.ts` | NFR-1 sanctioned single JSON-write seam; no parallel mechanism [VERIFIED: `package.json` + `shared/atomic-json.ts`] |
| `node:fs/promises` | built-in (Node >=20.19.0) | `readFile` + `mkdir` at load + save | Already the load-path pattern in `loadState` [VERIFIED: `state-io.ts` import] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | No supporting library is added for Phase 51. The entry-level merge is plain object reduction. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain object reduction for merge | `deepmerge` / `lodash.merge` | **Wrong**, not just heavyweight: entry-level override is domain-specific (`plugin@marketplace` key replacement), not recursive deep merge. A generic library would silently field-merge nested objects, violating D-01/CFG-02. |
| `parsePluginSource` runtime classification | `Type.Union` of structured source shapes in schema | Rejected by D-02. The config carries `source` as a raw string; the funnel in `domain/source.ts` is the single semantic gate. Putting source shapes in the typebox schema duplicates the parser and creates a divergence risk. |
| Discriminated `ConfigLoadResult` | Throw + try/catch + default | Throw-and-default is exactly the bug pattern Pitfall 1 warns about: a careless `catch` interprets a parse error as empty desired state, silently triggering mass uninstall. Discriminated union forces `assertNever` exhaustiveness (NFR-7). |
| Field-merge of base+local | Entry-level merge | Rejected at requirements level (CFG-02 locked "entry replaces entry wholesale"). Whole-section-replace is also rejected (Pitfall 9). |

**Installation:**

No new dependencies. All required libraries are already present.

**Version verification:**

```bash
# Verified 2026-06-09
$ grep -E "write-file-atomic|typebox|proper-lockfile" package.json
"write-file-atomic": "^8.0.0",
"typebox": "^1.1.38",
"proper-lockfile": "^4.1.2",
```

[VERIFIED: `package.json` HEAD on `features/v1.12-config-files`]

## Package Legitimacy Audit

> Phase 51 installs no new packages. The audit is "carry forward" — every package below is
> already in `package.json` and has been used in shipped milestones (v1.0-v1.11).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `typebox` | npm | 3+ yrs | 500k+/wk | github.com/sinclairzx81/typebox | OK | Already used (`state-io.ts`); carry forward |
| `write-file-atomic` | npm | 12+ yrs | 90M+/wk | github.com/npm/write-file-atomic | OK | Already used (`shared/atomic-json.ts`); carry forward |
| `proper-lockfile` | npm | 8+ yrs | 8M+/wk | github.com/moxystudio/node-proper-lockfile | OK | Already used (`transaction/with-state-guard.ts`); not directly touched by Phase 51 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ FUTURE (Phase 52+) callers     (NOT WIRED IN PHASE 51)              │
│   migrate-config.ts ─► loadConfig(absent) ─► generate                │
│   reconcile/plan.ts ─► loadConfig(valid)  ─► MergedConfig            │
│   command write-back ─► saveConfig (entry-level patch)               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                  (Phase 51 freezes the shapes below)
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│ persistence/config-io.ts  (NEW)                                      │
│                                                                      │
│   loadConfig(filePath) ─► ConfigLoadResult                           │
│     readFile → ENOENT? → { status: "absent" }                        │
│     JSON.parse → fail? → { status: "invalid", error }                │
│     CONFIG_VALIDATOR.Check → fail? → { status: "invalid", error }    │
│     success → { status: "valid", config: ScopeConfig }               │
│                                                                      │
│   saveConfig(filePath, config)                                       │
│     CONFIG_VALIDATOR.Check → atomicWriteJson(filePath, config)       │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │   ScopeConfig (one per file: base or local)
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ persistence/config-merge.ts  (NEW)                                   │
│                                                                      │
│   mergeScopeConfigs(base, local) ─► MergedConfig                     │
│     For each entryKey ∈ union(base.marketplaces, local.marketplaces):│
│       merged[k] = local[k] ?? base[k]            (entry-level)       │
│     Same for plugins.                                                 │
│     Carries provenance: { entry, source: "base" | "local" }          │
│                                                                      │
│   loadMergedScopeConfig(loc, notify?) ─► ScopeLoadOutcome            │
│     base   = loadConfig(loc.configJsonPath)                          │
│     local  = loadConfig(loc.configLocalJsonPath)                     │
│     D-18 trichotomy → MergedConfig | abort                           │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │   uses
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ persistence/locations.ts  (MODIFIED — sibling additions)             │
│   + configJsonPath:      <scopeRoot>/claude-plugins.json             │
│   + configLocalJsonPath: <scopeRoot>/claude-plugins.local.json       │
│   (peer of agentsDir, mcpJsonPath — under scopeRoot, NOT             │
│    extensionRoot; pi-claude-marketplace/ is machine-owned)           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ persistence/state-io.ts  (MODIFIED — carve-out)                      │
│   MARKETPLACE_RECORD_SCHEMA:                                         │
│     - autoupdate: Type.Optional(Type.Boolean())   ← REMOVED          │
│     - source: Type.Unknown()                       ← KEEPS (D-14)    │
│   STATE_SCHEMA.schemaVersion: Type.Literal(1)      ← UNCHANGED (D-12)│
│                                                                      │
│   loadState already runs migrateLegacyMarketplaceRecords; extend     │
│   that path to scrub the now-unknown `autoupdate` field —            │
│   subject to D-13 ordering rail (see below).                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
extensions/pi-claude-marketplace/
├── persistence/
│   ├── config-io.ts         # NEW: CONFIG_SCHEMA + loadConfig + saveConfig
│   ├── config-merge.ts      # NEW: entry-level merge → MergedConfig
│   ├── state-io.ts          # MODIFIED: drop `autoupdate` from marketplace
│   ├── migrate.ts           # MODIFIED: scrub legacy autoupdate (D-12, gated by D-13)
│   ├── locations.ts         # MODIFIED: + configJsonPath, + configLocalJsonPath
│   └── (existing files unchanged)
├── shared/
│   ├── atomic-json.ts       # UNCHANGED (saveConfig calls atomicWriteJson)
│   └── path-safety.ts       # UNCHANGED (NFR-10 callers invoke assertPathInside)
└── (everything else UNCHANGED in Phase 51)

tests/
├── persistence/
│   ├── config-io.test.ts          # NEW: load trichotomy, save round-trip
│   ├── config-merge.test.ts       # NEW: matrix (base-only, local-only, both, conflicting)
│   ├── state-io.test.ts           # MODIFIED: assert old state.json with autoupdate still loads
│   ├── migrate.test.ts            # MODIFIED: cover autoupdate scrub + D-13 ordering rail
│   └── locations.test.ts          # MODIFIED: + new path assertions
└── architecture/
    └── config-state-write-seams.test.ts  # NEW: SPLIT-02 ownership enforcement
```

### Pattern 1: typebox schema + `Compile`d validator + `firstValidationErrorDetail`

**What:** Direct mirror of `STATE_SCHEMA` in `state-io.ts`. A `Type.Object` of two `Type.Record`s
(marketplaces, plugins), each value an entry-level object with optional fields, exported as
`CONFIG_SCHEMA`. JIT-compiled via `Compile(CONFIG_SCHEMA)` to `CONFIG_VALIDATOR`. The
`.Errors(value)[0]` is reformatted into a single-line `"<path>: <message>"` detail.

**When to use:** Every load + every save. Validator is the structural gate; the `parsePluginSource`
funnel (called during merge or by downstream consumers) is the semantic gate on the raw `source`
string.

**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/persistence/state-io.ts:76-99 (pattern)
import Type from "typebox";
import { Compile } from "typebox/compile";

// CFG-01 D-01 D-04 D-09 D-11
const MARKETPLACE_CONFIG_ENTRY_SCHEMA = Type.Object({
  source: Type.String(),                    // D-02: raw string, funnelled at consume
  autoupdate: Type.Optional(Type.Boolean()), // D-04: omitted = false
});

const PLUGIN_CONFIG_ENTRY_SCHEMA = Type.Object({
  enabled: Type.Optional(Type.Boolean()),    // D-04: omitted = true
});

export const CONFIG_SCHEMA = Type.Object({
  schemaVersion: Type.Optional(Type.Literal(1)),                   // D-11
  marketplaces: Type.Optional(                                     // D-05
    Type.Record(Type.String(), MARKETPLACE_CONFIG_ENTRY_SCHEMA),
  ),
  plugins: Type.Optional(                                          // D-05
    Type.Record(Type.String(), PLUGIN_CONFIG_ENTRY_SCHEMA),
  ),
});

export type ScopeConfig = Type.Static<typeof CONFIG_SCHEMA>;
export const CONFIG_VALIDATOR = Compile(CONFIG_SCHEMA);
```

**Note on D-09 (lenient unknown keys):** typebox `Type.Object` accepts additional properties by
default (no `additionalProperties: false` is set anywhere in `STATE_SCHEMA`). Unknown top-level
keys, unknown entry-level keys, and unknown fields-inside-entries all pass validation. Only known
keys with wrong types fail — exactly D-09. No special flag needed.

### Pattern 2: Discriminated `ConfigLoadResult` trichotomy (D-15, CFG-03)

**What:** `loadConfig` returns a discriminated union, never throws on missing file or invalid
content. Consumers exhaustive-switch with `assertNever`.

**When to use:** Every call site that loads config (Phase 51 has no callers; this contract
constrains Phases 52-56).

**Example:**
```typescript
// CFG-03 D-15 (pattern; not yet in source)
export type ConfigLoadResult =
  | { status: "absent" }
  | { status: "invalid"; filePath: string; error: string }
  | { status: "valid"; filePath: string; config: ScopeConfig };

export async function loadConfig(filePath: string): Promise<ConfigLoadResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "absent" };
    }
    // Other I/O errors are invalid — never silently fall through.
    return { status: "invalid", filePath, error: `read failed: ${errorMessage(err)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { status: "invalid", filePath, error: `JSON parse failed: ${errorMessage(err)}` };
  }

  if (!CONFIG_VALIDATOR.Check(parsed)) {
    return {
      status: "invalid",
      filePath,
      error: `schema validation failed: ${firstConfigValidationErrorDetail(parsed)}`,
    };
  }
  return { status: "valid", filePath, config: parsed };
}
```

The `assertNever` consumer pattern is already used in `state-io.ts` callers; mirror it.
**Crucial property:** the 0-byte file case (`raw = ""`) lands in the JSON-parse branch (`Unexpected
end of JSON input`), classified as `invalid` — NOT as valid-empty. This is the Pitfall 1 safety
gate at the load seam.

### Pattern 3: Entry-level base+local merge (CFG-02, D-01, Pitfall 9)

**What:** `mergeScopeConfigs(base, local) → MergedConfig` is plain code, no library. Per `D-01`,
the override unit is the entry (per marketplace, per plugin). `merged[k] = local[k] ?? base[k]`
over the union of keys.

**When to use:** Once per scope load, after both `loadConfig` calls succeed. Per-scope; never
cross-scope.

**Example:**
```typescript
// CFG-02 D-01 D-09 D-10 (pattern; not yet in source)
export interface MergedConfigEntry<T> {
  readonly entry: T;
  readonly source: "base" | "local"; // provenance for write-back & diff (Claude's discretion)
}

export interface MergedConfig {
  readonly marketplaces: Record<string, MergedConfigEntry<MarketplaceConfigEntry>>;
  readonly plugins: Record<string, MergedConfigEntry<PluginConfigEntry>>;
}

export function mergeScopeConfigs(base: ScopeConfig, local: ScopeConfig): MergedConfig {
  const marketplaces: MergedConfig["marketplaces"] = {};
  const baseMps = base.marketplaces ?? {};
  const localMps = local.marketplaces ?? {};
  for (const key of new Set([...Object.keys(baseMps), ...Object.keys(localMps)])) {
    const localEntry = localMps[key];
    if (localEntry !== undefined) {
      marketplaces[key] = { entry: localEntry, source: "local" };
    } else {
      marketplaces[key] = { entry: baseMps[key]!, source: "base" };
    }
  }
  // Same for plugins.
  return { marketplaces, plugins: /* ... */ };
}
```

**Provenance recommendation (Claude's discretion area):** carry `source: "base" | "local"` on
every merged entry. Phase 53 (dry-run) needs it to show users where an entry came from; Phase 56
(write-back) needs it to decide which file a `marketplace remove` should patch. Adding it now
costs nothing; not adding it forces an awkward retrofit later.

### Pattern 4: STATE_SCHEMA carve-out + D-12/D-13 ordering rail

**What:** Drop `autoupdate: Type.Optional(Type.Boolean())` from `MARKETPLACE_RECORD_SCHEMA`
(line 71 of `state-io.ts`). KEEP `source: Type.Unknown()` (D-14). `STATE_SCHEMA.schemaVersion`
stays `Type.Literal(1)` (D-12).

The legacy `autoupdate` field on existing state.json files must be scrubbed at load, BUT only
**after** Phase 52's migration has had its chance to read the legacy value and write it into the
generated config (D-13 ordering rail).

**Recommended mechanism for D-13 (planner picks; this is one viable shape):** extend
`migrateLegacyMarketplaceRecords` to take a `preserveLegacyAutoupdate: boolean` flag. The flag
defaults to `false` (Phase 51 behavior: scrub on every load) BUT in Phase 52 the migration code
path will call a sibling entry point that reads the legacy `autoupdate` BEFORE the scrub runs.
Alternative: have the scrub only fire when a config file already exists at the scope's
`configJsonPath` (so the first-ever load preserves the legacy value for migration to consume).

The Phase 51 plan should **document the constraint** and pick a mechanism, but the actual
preserve/read path lives in Phase 52. What Phase 51 must NOT do: blindly scrub on the very first
load before Phase 52 exists.

**When to use:** Every legacy `state.json` load (i.e., one that contains a record with the now-
unknown field). The scrub uses the existing `migrate.ts` `ensure*`+`persistMigratedState`
fire-and-forget pattern.

**Example (state-io.ts diff sketch):**
```typescript
// SPLIT-01 D-12 D-14 — modify in place
const MARKETPLACE_RECORD_SCHEMA = Type.Object({
  name: Type.String(),
  scope: Type.Union([Type.Literal("user"), Type.Literal("project")]),
  source: Type.Unknown(),              // D-14: KEEPS — materialized record (machine fact)
  addedFromCwd: Type.String(),
  manifestPath: Type.String(),
  marketplaceRoot: Type.String(),
  lastUpdatedAt: Type.Optional(Type.String()),
  // autoupdate: Type.Optional(Type.Boolean()),   ← REMOVED (moves to CONFIG_SCHEMA)
  plugins: Type.Record(Type.String(), PLUGIN_INSTALL_RECORD_SCHEMA),
});
```

### Pattern 5: SPLIT-02 architecture test (write-seam ownership)

**What:** A new `tests/architecture/config-state-write-seams.test.ts` enforces:
- `atomicWriteJson(<configJsonPath>|<configLocalJsonPath>, ...)` only appears in `config-io.ts`
  (`saveConfig`) and Phase 52's migration entry point (not yet written).
- `atomicWriteJson(<stateJsonPath>, ...)` only appears in `state-io.ts` (`saveState`) and
  `migrate.ts` (`persistMigratedState`).
- No file under `orchestrators/reconcile/` (when added in Phases 53-55) writes the config file.

**When to use:** Always — joins `import-boundaries.test.ts`, `no-shell-out.test.ts`,
`no-telemetry-deps.test.ts` as a structural invariant.

**Example (mirror `no-shell-out.test.ts` style):**
```typescript
// Pattern: walk extensions/pi-claude-marketplace/**/*.ts;
// for each file, parse imports + regex for atomicWriteJson(<target>, ...)
// allow-list the legal writers per target file.
```

### Anti-Patterns to Avoid

- **`deepmerge` / `lodash.merge` for base+local merge.** Entry-level override is domain logic.
  Use a plain `Object.keys` union and `??`. CFG-02, Pitfall 9.
- **Throw on missing/invalid config + try/catch + default to empty.** This is the Pitfall 1
  pattern. Use discriminated `ConfigLoadResult`. D-15.
- **Whole-file replacement on `--local` write.** Promotes base entries into local. Anti-Pattern 4
  in ARCHITECTURE.md; constraint for Phase 56 — call out in Phase 51 plan so the merge return
  shape supports per-file targeted patches.
- **Writing config files under `extensionRoot`.** Locked: `<scopeRoot>/claude-plugins.json`,
  same tier as `agents/` and `mcp.json`. Anti-Pattern 5 in ARCHITECTURE.md.
- **Schema reads `Type.Union` over PathSource | GitHubSource | ...** in CONFIG_SCHEMA for
  `source`. D-02 explicitly rejects structured-object source grammar. Keep `Type.String()`;
  classify via the existing `parsePluginSource` funnel at consume time.
- **Field-level merge inside an entry** (e.g., user `autoupdate: true` from local + `source:
  "foo/bar"` from base → "local autoupdate with base source"). CFG-02 + D-01: entry replaces
  entry wholesale.
- **Scrubbing legacy `autoupdate` from state.json before Phase 52 migration runs.** D-13
  ordering rail. Loses user intent.
- **`additionalProperties: false` on `CONFIG_SCHEMA` or any nested object.** D-09 mandates
  lenient. Default typebox behavior is correct — don't override.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | `fs.writeFile(tmp) → fs.rename` | `atomic-json.ts::atomicWriteJson` (wraps `write-file-atomic`) | NFR-1; concurrent-write queue; fsync of file + parent dir |
| JSON schema validation | Hand-written field checks | typebox `Type.Object` + `Compile` | JIT validator; precise error path via `.Errors()[0].instancePath` |
| Source string classification | `if (s.startsWith("/"))` inline | `parsePluginSource` from `domain/source.ts` | Single semantic gate (D-02); 6 source kinds with forward-compat `unknown` tail (NFR-12) |
| Path containment | Custom `startsWith` checks | `shared/path-safety.ts::assertPathInside` | NFR-10; rejects symlinks; walks every component |
| Discriminated-union exhaustiveness | Comment "// TODO add new case" | `assertNever(x: never)` pattern (existing in codebase) | Compile-time gap detection (NFR-7) |
| First-error formatting | Custom error walking | `firstValidationErrorDetail` style in `state-io.ts:98` | Mirror exact pattern for consistency |

**Key insight:** Phase 51 is a *mirror* phase. Every line of new code has an existing template
within 50 lines in `state-io.ts`, `migrate.ts`, `locations.ts`, `atomic-json.ts`, or
`path-safety.ts`. Originality is the anti-pattern. If a plan task says "design new …" without
naming the file it mirrors, it's wrong.

## Runtime State Inventory

> Phase 51 is a schema carve-out + new file additions. The carve-out touches `STATE_SCHEMA`
> and existing `state.json` files in the wild.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `state.json` files at `<scopeRoot>/pi-claude-marketplace/state.json` may contain `autoupdate: boolean` on marketplace records (v1.0+ shape). | The D-12 scrub at load — implemented in `migrate.ts`, gated by D-13 ordering rail (scrub must not destroy intent before Phase 52 migration captures it). |
| Live service config | None — pi-claude-marketplace has no live service that registers config externally. | None |
| OS-registered state | None — no OS task/launchd/systemd registrations carry `autoupdate`. | None |
| Secrets/env vars | None — `autoupdate` is not a secret nor an env var. `PI_CODING_AGENT_DIR` env (D-honored by `getAgentDir`) is unchanged by Phase 51. | None |
| Build artifacts | None — no compiled artifact embeds `autoupdate`. The `tests/persistence/fixtures/legacy/` directory contains legacy state.json fixtures used by `migrate.test.ts`; these may need a new fixture for "legacy state.json with autoupdate after Phase 51 load → scrubbed (subject to D-13 mechanism)". | Add fixture(s) for the new scrub behavior; update `migrate.test.ts`. |

**Nothing found in category:** Live service config / OS state / Secrets / Build artifacts —
verified by repo grep (`autoupdate` appears only in `extensions/pi-claude-marketplace/` source
files and `.planning/` docs).

## Common Pitfalls

### Pitfall 51-1: Treating 0-byte / truncated config as valid-empty (Pitfall 1 lineage)

**What goes wrong:** A careless `loadConfig` reads `""`, `JSON.parse` throws `Unexpected end of
JSON input`, the catch block returns `{ marketplaces: {}, plugins: {} }` as the default.
Downstream reconcile interprets it as "uninstall everything declared."

**Why it happens:** Throw-and-default is the natural Node.js pattern for I/O. Pitfall 1's whole
point is that this seam is exactly where empty-vs-broken must be distinguished.

**How to avoid:** Use the discriminated `ConfigLoadResult` (D-15). 0-byte and JSON parse errors
both land in the `invalid` arm. Only an explicit `{}` (which validates and yields
`{ marketplaces: {} ?? {} }` post-merge defaults) is valid-empty. **The architecture test
`tests/persistence/config-io.test.ts` must include a 0-byte case asserting `status === "invalid"`,
not `valid` with an empty config.**

**Warning signs:** A `try { JSON.parse(raw) } catch { return { ...default } }` block anywhere in
`config-io.ts` or `config-merge.ts`. A test that loads a 0-byte file and expects a valid result.

### Pitfall 51-2: Stale `Type.Static<typeof STATE_SCHEMA>` consumers after carve-out

**What goes wrong:** Removing `autoupdate` from `MARKETPLACE_RECORD_SCHEMA` makes
`ExtensionState['marketplaces'][string]['autoupdate']` no longer exist. Any code that reads
`mp.autoupdate` (e.g., `orchestrators/marketplace/list.ts`, `autoupdate.ts`, completion
generation in `shared/completion-cache.ts`) is now a typecheck or runtime error.

**Why it happens:** TypeScript's structural inference will catch the typecheck error, but runtime
reads of legacy-loaded state.json that still contains `autoupdate` would silently use the value
(typebox accepts extra properties by default — Pitfall 51-3 below) until the migrate scrub
removes it.

**How to avoid:** Run `npm run typecheck` after the carve-out and walk every site that reads
`mp.autoupdate`. For Phase 51, those reads should either (a) be lifted into a Phase 51 plan as
"remove read site, value moved to config" (acceptable if it's a no-op in the Phase 51 wave —
unlikely because no config reader exists yet) or (b) be deferred to Phase 54/55/56 with a
documented TODO. **The cleanest Phase 51 boundary:** carve out the schema field, scrub it on
load, leave all reader sites untouched (they read `undefined` post-scrub, which is the existing
"omitted = false" behavior) — and let Phase 53/54/55 swap each reader to read from the merged
config.

**Warning signs:** typecheck errors after the carve-out that touch files outside `persistence/`.
Those are Phase 52-56 work, not Phase 51 work.

### Pitfall 51-3: D-09 lenient + D-12 scrub interaction

**What goes wrong:** `STATE_SCHEMA` accepts additional properties by default (typebox default).
After dropping `autoupdate` from the schema, an old state.json with `autoupdate: true` STILL
validates against the new schema (extra-property tolerance). If the planner assumes "load fails →
scrub triggers," the scrub never runs. Meanwhile the in-memory state record carries an
`autoupdate` field the rest of the code base doesn't expect (because it's not in `ExtensionState`
type) — until the eventual Phase 52 migration reads it.

**Why it happens:** Lenient validation + carve-out is exactly the forward-compat shape. The scrub
must run as an unconditional normalization step (like the existing `ensureMarketplacePaths` and
`ensurePluginResources` calls in `migrateLegacyMarketplaceRecords`), not as a fallback for
validation failure.

**How to avoid:** Extend `migrateLegacyMarketplaceRecords` to walk every marketplace record and
`delete mp.autoupdate`, with the D-13 escape hatch (preserve mechanism — see Pattern 4).
`migrateLegacyMarketplaceRecords` already returns `{ marketplaces, mutated }` so the
fire-and-forget persist runs only when something changed — perfect for "first load after upgrade
scrubs; subsequent loads no-op."

**Warning signs:** A plan task that says "validate state.json — if it has autoupdate, fail" or
"migrate by rejecting old shape." Neither is correct. The scrub is unconditional normalization.

### Pitfall 51-4: Allowing `--local` write-back to read the merged view (Pitfall 3 lineage)

**What goes wrong:** A Phase 56 plan calls `loadMergedScopeConfig(...).config`, mutates one
entry, then writes the whole merged result to `claude-plugins.local.json`. Base entries get
promoted into the local file (Anti-Pattern 4).

**Why it happens:** The merged view is the natural in-memory representation, and "write what you
have" is the obvious wrong path.

**How to avoid (Phase 51 must enable, Phase 56 enforces):** `loadMergedScopeConfig` (or its
caller) must return BOTH the merged view AND the individual `ScopeConfig` results for base and
local separately, so write-back can target the right physical file. Recommend a return shape
like `{ merged: MergedConfig, base: ConfigLoadResult, local: ConfigLoadResult }`. Then a Phase 56
write-back function takes a `target: "base" | "local"` argument, reads the targeted file fresh
under the scope lock, patches the one entry, and writes only that file.

**Warning signs:** A Phase 51 plan that exposes only `MergedConfig` and not the per-file
`ScopeConfig`s. That foreclosure forces Phase 56 to either re-load (acceptable) or replay merge
(wrong).

### Pitfall 51-5: NFR-10 containment escape via `claude-plugins.local.json`

**What goes wrong:** A user puts the config files at a symlink, or a config path joins an
attacker-supplied name. The existing `state.json` is `path.join(extensionRoot, "state.json")` —
no untrusted components. The new config paths are also `path.join(scopeRoot, "claude-plugins.json")`
— still no untrusted components. **The containment risk for Phase 51 is zero at the path-
construction level** because both new paths are hard-coded suffixes on `scopeRoot`.

**However,** the SPLIT-02 requirement explicitly says "config + internal-file paths are added to
the NFR-10 containment allow-list." The allow-list mechanism in this codebase is `assertPathInside`
called at write sites, not a central allow-list registry. The Phase 51 deliverable for the NFR-10
extension is: every write site in `saveConfig` invokes `assertPathInside(scopeRoot, filePath, ...)`
before `atomicWriteJson`.

**Why it happens:** SPLIT-02's wording could be misread as "add a string to a config." There is
no such config — the assertion lives at the write site.

**How to avoid:** `saveConfig(filePath, config, scopeRoot)` signature; `await
assertPathInside(scopeRoot, filePath, "saveConfig")` before the atomic write. The architecture
test `config-state-write-seams.test.ts` can assert this call appears in `saveConfig`.

**Warning signs:** A `saveConfig` that takes a raw path and writes without bounds-checking. A
plan task that says "add config path to allow-list config" with no file to point at.

### Pitfall 51-6: D-13 ordering rail collapses if Phase 51 scrub is unconditional

**What goes wrong:** Phase 51 scrubs `autoupdate` from state.json on every load, including the
first load that Phase 52 migration depends on. By the time Phase 52's migration code reads
state.json, the field is gone. The migration generates a config without `autoupdate`
declarations and the user's intent (which marketplaces auto-updated) is lost.

**Why it happens:** "Scrub on load" is the natural normalization point. D-13 is a temporal
constraint, not a structural one, so the planner can miss it.

**How to avoid (recommended mechanism):** Phase 51's `migrateLegacyMarketplaceRecords` scrub
**skips the autoupdate field** when no config file exists at `loc.configJsonPath`. Equivalently:
the scrub is gated by `existsSync(loc.configJsonPath)` (or async equivalent). This way:
- First load before Phase 52 migration runs: `state.json` keeps `autoupdate`; Phase 52
  reads it; Phase 52 writes the config; the next load sees `existsSync(configJsonPath) === true`
  and scrubs.
- Steady state (Phase 52+): config exists, scrub runs every load, state.json converges.

Alternative mechanism: expose `migrateLegacyMarketplaceRecords` returning the legacy autoupdate
values to the caller, so Phase 52 can read them BEFORE the scrub mutates the record. The planner
picks; this research notes the constraint and the two viable paths.

**Warning signs:** A `migrate.ts` patch that unconditionally `delete mp.autoupdate` with no
gating. A test that asserts "loading a populated state.json always scrubs autoupdate."

## Code Examples

Verified patterns from the existing codebase:

### Example 1: typebox schema + JIT validator + first-error detail

```typescript
// Source: extensions/pi-claude-marketplace/persistence/state-io.ts (lines 38-106)
import Type from "typebox";
import { Compile } from "typebox/compile";

export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
export const STATE_VALIDATOR = Compile(STATE_SCHEMA);

function firstValidationErrorDetail(value: unknown): string {
  const errors = STATE_VALIDATOR.Errors(value);
  const first = errors[0];
  if (!first) return "(no detail available)";
  return `${first.instancePath || "<root>"}: ${first.message}`;
}
```

**Phase 51 mirror:** `CONFIG_VALIDATOR = Compile(CONFIG_SCHEMA)`,
`firstConfigValidationErrorDetail` — identical structure, different schema.

### Example 2: Atomic JSON write seam

```typescript
// Source: extensions/pi-claude-marketplace/persistence/state-io.ts (lines 215-224)
export async function saveState(extensionRoot: string, state: ExtensionState): Promise<void> {
  if (!STATE_VALIDATOR.Check(state)) {
    throw new Error(
      `saveState refused: in-memory state failed schema validation: ${firstValidationErrorDetail(state)}`,
    );
  }
  const stateJsonPath = stateJsonPathFor(extensionRoot);
  await atomicWriteJson(stateJsonPath, state);
}
```

**Phase 51 mirror:** `saveConfig(filePath, config)` — Check then `atomicWriteJson`. Add
`assertPathInside(scopeRoot, filePath, "saveConfig")` before write per Pitfall 51-5.

### Example 3: Legacy-shape migration with fire-and-forget persist

```typescript
// Source: extensions/pi-claude-marketplace/persistence/migrate.ts (lines 111-182)
export function migrateLegacyMarketplaceRecords(
  parsed: unknown,
  extensionRoot: string,
): MigrationResult {
  // ... walk + ensure* helpers + mutated flag
  return { marketplaces, mutated };
}

export async function persistMigratedState(
  stateJsonPath: string,
  normalizedState: unknown,
): Promise<void> {
  try {
    await atomicWriteJson(stateJsonPath, normalizedState);
  } catch (err) {
    // IL-3 sanctioned warn (only one in the extension)
    console.warn(/* ... */);
  }
}
```

**Phase 51 mirror:** Add `ensureNoLegacyAutoupdate(mp)` helper called from the existing record
walk loop. Gate per D-13.

### Example 4: ScopedLocations brand + hard-coded suffix

```typescript
// Source: extensions/pi-claude-marketplace/persistence/locations.ts (lines 115-133)
export function locationsFor(scope: Scope, cwd: string): ScopedLocations {
  const scopeRoot = scope === "user" ? getAgentDir() : path.join(cwd, ".pi");
  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  // ... siblings:
  const mcpJsonPath = path.join(scopeRoot, "mcp.json");
  // Phase 51 additions:
  // const configJsonPath = path.join(scopeRoot, "claude-plugins.json");
  // const configLocalJsonPath = path.join(scopeRoot, "claude-plugins.local.json");
}
```

**Phase 51 mirror:** Two new `path.join(scopeRoot, ...)` calls, both with hard-coded suffixes.
Add to the `ScopedLocations` interface + the `Object.freeze` returned bundle. Update
`tests/persistence/locations.test.ts` to assert the new paths.

### Example 5: Architecture test pattern (mirror for SPLIT-02)

```typescript
// Source: extensions/pi-claude-marketplace/../tests/architecture/no-shell-out.test.ts (pattern)
// Walks every .ts file under extensions/pi-claude-marketplace/, asserts no forbidden
// import or call appears. SPLIT-02 test will:
//   1. allow `atomicWriteJson(<state>...)` only in state-io.ts + migrate.ts
//   2. allow `atomicWriteJson(<config>|<configLocal>...)` only in config-io.ts
//      (+ Phase 52's migrate-config.ts when added)
//   3. forbid all other writers
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Desired state + machine bookkeeping co-mingled in `state.json` (v1.0-v1.11) | State split: `state.json` = machine only; `claude-plugins.json` = desired (v1.12) | Phase 51 (this phase) | Reconcile and write-back become tractable; user has a reviewable VCS-able file |
| Imperative-only commands as sole mutation surface | Declarative config + load-time reconcile + write-back from commands | v1.12 milestone | New safety class around destructive reconcile (Pitfalls 1-7 in PITFALLS.md) |
| `@sinclair/typebox` 0.34.x (legacy package name) | `typebox` 1.x (renamed package) | Pre-v1.0 (already migrated) | No action; carry forward |
| Hand-rolled JSON atomic write | `write-file-atomic@^8` via `shared/atomic-json.ts` | Pre-v1.0 (already adopted) | No action; saveConfig wraps this seam |

**Deprecated/outdated:**
- `STATE_SCHEMA.MARKETPLACE_RECORD_SCHEMA.autoupdate` — relocated to `CONFIG_SCHEMA` by D-12;
  scrubbed on load by D-12/D-13 mechanism.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | typebox accepts additional properties by default (no `additionalProperties: false` needed for D-09 lenient posture). | Pattern 1 + Anti-Patterns | If wrong (rare typebox config), D-09 lenience requires an explicit annotation; would surface immediately in `tests/persistence/config-io.test.ts` (an unknown key would fail validation). [VERIFIED: `state-io.ts` schemas have no `additionalProperties` directive and the state-io test suite includes legacy-shape fixtures that pass validation with extra keys.] |
| A2 | `JSON.parse("")` throws `SyntaxError: Unexpected end of JSON input` in Node 20+. | Pitfall 51-1 | If wrong, the 0-byte test would lie. [VERIFIED: standard Node behavior; trivial to confirm at test write time.] |
| A3 | The recommended D-13 mechanism (gate scrub on `existsSync(configJsonPath)`) is acceptable to the planner. | Pattern 4 + Pitfall 51-6 | Alternative mechanism (expose legacy values to Phase 52) is equally valid. Planner chooses; both are documented. [ASSUMED — D-13 explicitly leaves mechanism to the planner.] |
| A4 | Carrying provenance (`source: "base" \| "local"`) on `MergedConfig` entries is the right Phase 51 deliverable, not a Phase 56 retrofit. | Pattern 3 | If left out, Phase 56 write-back has to either re-load both files (acceptable cost) or replay merge (wrong). [ASSUMED — listed under Claude's Discretion in CONTEXT.md, so the recommendation is non-binding.] |
| A5 | Existing `tests/persistence/fixtures/legacy/` directory is the right home for new legacy-state-with-autoupdate fixtures. | Runtime State Inventory + Code Examples | Worst case: fixture lives in a different directory; trivial cosmetic fix. [VERIFIED: directory exists per `ls`.] |

## Open Questions

1. **D-13 mechanism choice (Pattern 4 + Pitfall 51-6).**
   - What we know: D-13 mandates that Phase 52 migration sees the legacy `autoupdate` value
     before any scrub destroys it.
   - What's unclear: Two viable mechanisms (existsSync-gated scrub vs expose legacy values
     to migration caller); choice is planner's per the CONTEXT.md decision text.
   - Recommendation: Default to existsSync-gating. It is the smaller diff, requires no
     signature change to `migrateLegacyMarketplaceRecords`, and the gating predicate is
     trivially testable. The Phase 51 plan should pick a path and lock it.

2. **Should `MergedConfig` entry carry full `ScopeConfig` reference, or just the entry's
   own object?** (Claude's discretion.)
   - What we know: Provenance is `"base" | "local"` (Pattern 3 recommendation).
   - What's unclear: Whether the full file reference (for Phase 56 re-load under lock) is
     also part of `MergedConfig` or computed separately at write-back time.
   - Recommendation: Keep `MergedConfig` minimal — provenance string only. Phase 56 re-loads
     the targeted file fresh under the scope lock (correct Pitfall 3 mitigation), so a
     stored reference on `MergedConfig` would invite Pitfall 3 misuse.

3. **Plugin entry ID format normalization (`plugin@marketplace`).**
   - What we know: D-01 keys plugins by `plugin@marketplace`. The format mirrors existing
     `installPlugin`/`uninstallPlugin` shapes.
   - What's unclear: Whether the schema should enforce a regex (`/^[\w-]+@[\w-]+$/`) or
     accept arbitrary strings.
   - Recommendation: Accept arbitrary strings at the schema level (D-09 lenient posture).
     Downstream consumers (Phase 53 reconcile planner) classify any unparseable key as
     "dangling reference → soft-fail per-entry" (D-16). Schema enforcement would conflict
     with D-09 and produce a less useful error than reconcile's per-entry skip.

## Environment Availability

> Phase 51 has no external dependencies beyond Node + already-installed npm packages.
> No new tools or services are introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ (project engines: `>=20.19.0`) | (host) | — |
| `typebox` | `CONFIG_SCHEMA` | ✓ (peer + dev pin) | `^1.1.38` | — |
| `write-file-atomic` | `saveConfig` | ✓ (direct dep) | `^8.0.0` | — |
| `node:test` runner | All Phase 51 tests | ✓ (built-in) | (Node) | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node `>=20.19.0`) |
| Config file | none — invoked via npm scripts; tests are `tests/**/*.test.ts` |
| Quick run command | `npm test -- "tests/persistence/config-io.test.ts" "tests/persistence/config-merge.test.ts" "tests/architecture/config-state-write-seams.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format + test + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CFG-01 | typebox-validated `claude-plugins.json` load/save round-trip | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ Wave 0 |
| CFG-01 | Defaults (autoupdate=false, enabled=true) applied at consume time | unit | `npm test -- "tests/persistence/config-merge.test.ts"` | ❌ Wave 0 |
| CFG-02 | Entry-level base+local merge produces `MergedConfig` (matrix: base-only / local-only / both / disjoint) | unit | `npm test -- "tests/persistence/config-merge.test.ts"` | ❌ Wave 0 |
| CFG-03 | `ConfigLoadResult` trichotomy: absent / invalid / valid; 0-byte ≠ valid-empty | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ Wave 0 |
| CFG-03 | Invalid file aborts with structured error detail | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ Wave 0 |
| SPLIT-01 | Old `state.json` with `autoupdate` field still loads (lenient) | unit | `npm test -- "tests/persistence/state-io.test.ts"` | ✅ extend |
| SPLIT-01 | `autoupdate` scrubbed at load when config file exists (D-13 mechanism) | unit | `npm test -- "tests/persistence/migrate.test.ts"` | ✅ extend |
| SPLIT-01 | `STATE_SCHEMA.schemaVersion` stays `1` (D-12) | unit | `npm test -- "tests/persistence/state-io.test.ts"` | ✅ extend |
| SPLIT-02 | Only `saveConfig` writes config files; only `saveState`/`persistMigratedState` write state file | architecture | `npm test -- "tests/architecture/config-state-write-seams.test.ts"` | ❌ Wave 0 |
| SPLIT-02 | NFR-10 containment: `assertPathInside(scopeRoot, ...)` enforced on config writes | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ Wave 0 |
| (locations) | `configJsonPath` and `configLocalJsonPath` resolve under `scopeRoot` (not `extensionRoot`) | unit | `npm test -- "tests/persistence/locations.test.ts"` | ✅ extend |

### Sampling Rate
- **Per task commit:** `npm test -- "tests/persistence/**/*.test.ts" "tests/architecture/config-state-write-seams.test.ts"` (~10 seconds; pure unit tests with memfs/tmpdir)
- **Per wave merge:** `npm test` (full unit suite ~30 seconds)
- **Phase gate:** `npm run check` before `/gsd-verify-work` (full pipeline + integration)

### Wave 0 Gaps
- [ ] `tests/persistence/config-io.test.ts` — covers CFG-01 / CFG-03 / NFR-10 enforcement
- [ ] `tests/persistence/config-merge.test.ts` — covers CFG-02 (matrix: base-only, local-only, both with overlap, disjoint)
- [ ] `tests/architecture/config-state-write-seams.test.ts` — covers SPLIT-02
- [ ] `tests/persistence/fixtures/legacy/state-with-autoupdate.json` (or similar) — extending the existing `tests/persistence/fixtures/legacy/` directory with v1.12-pre-migration fixtures
- [ ] Existing `tests/persistence/state-io.test.ts` — add SPLIT-01 case (old state.json still loads + scrub interaction)
- [ ] Existing `tests/persistence/migrate.test.ts` — add D-13 ordering rail case (scrub gated by config file presence)
- [ ] Existing `tests/persistence/locations.test.ts` — add config path assertions

Framework install: none — `node:test` is built-in.

## Security Domain

> Required because security_enforcement is implicitly enabled (no `security_enforcement: false`
> in `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth at this layer; config files are local |
| V3 Session Management | no | N/A — no session state |
| V4 Access Control | no | Filesystem permissions enforced by OS; NFR-10 handles path containment |
| V5 Input Validation | **yes** | typebox `CONFIG_VALIDATOR.Check` is the structural gate; `parsePluginSource` is the semantic gate on raw `source` strings |
| V6 Cryptography | no | No crypto in Phase 51 |
| V8 Data Protection | partial | Config files may contain marketplace source URLs but no secrets; `.local.json` is gitignored by convention (CFG-04 / Phase 56) — Phase 51 only locks the path |
| V12 Files & Resources | **yes** | NFR-10 containment via `assertPathInside`; `write-file-atomic` for atomic writes |

### Known Threat Patterns for {persistence/typebox/atomic-write stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via crafted config path | Tampering | `assertPathInside(scopeRoot, filePath, ...)` before `atomicWriteJson` in `saveConfig`; hard-coded `path.join(scopeRoot, "claude-plugins.json")` construction in `locations.ts` (no untrusted components participate) |
| Malformed JSON treated as valid-empty → mass uninstall | Denial-of-Service / Integrity | Discriminated `ConfigLoadResult` (D-15); 0-byte → `invalid`, not `valid`; downstream Phase 55 reconcile aborts on `invalid` per CFG-03 |
| Power-loss mid-write → corrupted config | Tampering / DoS | `atomicWriteJson` via `write-file-atomic` (tmp + fsync + rename; NFR-1) |
| Concurrent process writes to same config file | Tampering | `write-file-atomic` internal queue serializes same-path writes intra-process; per-scope `proper-lockfile` via `withStateGuard` covers cross-process (Phase 56 wires write-back inside this lock) |
| Schema-strict rejection of forward-compat files | DoS / Compat-break | D-09 lenient default — typebox accepts unknown keys; D-10 preserves them on write-back (Phase 56) |
| Attacker-crafted source string in config (e.g., `../../etc/passwd`) | Tampering | Source is `Type.String()` at schema level (passes typebox); `parsePluginSource` classifies into 6 kinds with `unknown` tail; downstream consumers (Phase 53 reconcile planner) reject unclassifiable sources |
| Hand-edited `claude-plugins.json` declares a malicious GitHub source | Supply-chain | Reused existing GitHub source validation (post-Phase 51); no source-kind broadening in v1.12 |
| Symlink at `<scopeRoot>/claude-plugins.json` pointing outside scope | Tampering | `assertPathInside` refuses symlinks (D-14 in `path-safety.ts`); applies to the leaf component |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — primary template for `config-io.ts`
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — template for D-12 scrub via `migrateLegacyMarketplaceRecords` + `persistMigratedState`
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `ScopedLocations` brand + `scopeRoot` joins
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` — NFR-1 atomic write seam
- `extensions/pi-claude-marketplace/shared/path-safety.ts` — `assertPathInside` for NFR-10
- `extensions/pi-claude-marketplace/domain/source.ts` — `parsePluginSource` semantic gate
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:203-222` — CMP-3 cross-scope fallback that D-17 mirrors
- `tests/architecture/no-shell-out.test.ts`, `tests/architecture/import-boundaries.test.ts` — structural-invariant test patterns for SPLIT-02
- `tests/persistence/state-io.test.ts`, `tests/persistence/migrate.test.ts` — test patterns for extension
- `.planning/REQUIREMENTS.md` — CFG-01..04, SPLIT-01/02 definitions and Out of Scope locks
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,STACK}.md` — milestone-level research (already accepted)
- `.planning/phases/51-config-schema-persistence-state-split/51-CONTEXT.md` — locked decisions D-01..D-19
- `package.json` — confirmed dep set (`typebox@^1.1.38` dev pin + peer; `write-file-atomic@^8.0.0` direct; engines `>=20.19.0`)

### Secondary (MEDIUM confidence)
- typebox library README and current install — verified `additionalProperties` default lenient (cross-referenced with `state-io.ts` schema behavior and the legacy fixtures in `tests/persistence/fixtures/legacy/`)

### Tertiary (LOW confidence)
- (none)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already in `package.json` and used in shipped code.
- Architecture: HIGH — every pattern has a same-file or sibling-file template within
  `extensions/pi-claude-marketplace/persistence/`.
- Pitfalls: HIGH — system-specific pitfalls inherited from the locked v1.12 decisions and
  the milestone-level PITFALLS.md (already accepted).
- D-13 mechanism choice: MEDIUM — two viable paths; planner picks. Both documented.

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (30 days; stable foundation, no fast-moving deps)
