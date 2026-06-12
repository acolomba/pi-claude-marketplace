# Phase 51: Config Schema, Persistence & State Split - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 8 (4 new, 4 modified)
**Analogs found:** 8 / 8

Phase 51 is a *mirror* phase: every new file has a direct in-tree template within
`extensions/pi-claude-marketplace/persistence/` or `tests/`. Originality is the
anti-pattern. The single new analog gap is the SPLIT-02 architecture test, which
mirrors the existing `tests/architecture/no-shell-out.test.ts` walker shape.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/persistence/config-io.ts` (NEW) | persistence schema + I/O seam | file-I/O + transform | `extensions/pi-claude-marketplace/persistence/state-io.ts` | exact |
| `extensions/pi-claude-marketplace/persistence/config-merge.ts` (NEW) | persistence pure-domain reducer | transform | (no direct analog; pure new code) | role-only |
| `extensions/pi-claude-marketplace/persistence/locations.ts` (MODIFIED) | persistence path bundle | config | self (sibling additions) | exact |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` (MODIFIED) | persistence schema + I/O seam | file-I/O + transform | self (carve-out of one field) | self |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` (MODIFIED) | persistence normalizer + fire-and-forget persist | transform | self (extend existing walker) | self |
| `tests/persistence/config-io.test.ts` (NEW) | unit test | request-response | `tests/persistence/state-io.test.ts` | exact |
| `tests/persistence/config-merge.test.ts` (NEW) | unit test | transform | `tests/persistence/state-io.test.ts` (tmpdir scaffolding) | role-match |
| `tests/architecture/config-state-write-seams.test.ts` (NEW) | architecture invariant test | static scan | `tests/architecture/no-shell-out.test.ts` | exact |

## Pattern Assignments

### `persistence/config-io.ts` (NEW — schema + load + save)

**Analog:** `extensions/pi-claude-marketplace/persistence/state-io.ts` (lines 25-224, the whole file is the template)

**Imports pattern** (state-io.ts:25-35):
```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";
```
Copy verbatim. Add `assertPathInside` from `../shared/path-safety.ts` per Pitfall 51-5 (saveConfig must bounds-check).

**Schema pattern** (state-io.ts:63-90):
```typescript
const MARKETPLACE_RECORD_SCHEMA = Type.Object({
  name: Type.String(),
  scope: Type.Union([Type.Literal("user"), Type.Literal("project")]),
  source: Type.Unknown(),
  // ...
  autoupdate: Type.Optional(Type.Boolean()),  // ← carved out, see below
});

export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
export type ExtensionState = Type.Static<typeof STATE_SCHEMA>;
export const STATE_VALIDATOR = Compile(STATE_SCHEMA);
```
Mirror as `MARKETPLACE_CONFIG_ENTRY_SCHEMA` / `PLUGIN_CONFIG_ENTRY_SCHEMA` /
`CONFIG_SCHEMA` / `ScopeConfig` / `CONFIG_VALIDATOR`. Per D-09 (lenient) do NOT add
`additionalProperties: false` — typebox default is correct. Per D-11 use
`Type.Optional(Type.Literal(1))` for `schemaVersion`. Per D-05 both `marketplaces`
and `plugins` records are `Type.Optional(Type.Record(...))`.

**First-error formatting pattern** (state-io.ts:98-106):
```typescript
function firstValidationErrorDetail(value: unknown): string {
  const errors = STATE_VALIDATOR.Errors(value);
  const first = errors[0];
  if (!first) return "(no detail available)";
  return `${first.instancePath || "<root>"}: ${first.message}`;
}
```
Copy as `firstConfigValidationErrorDetail`.

**Load pattern (mutate for trichotomy)** (state-io.ts:150-206):
The state-io shape THROWS on bad shapes and returns DEFAULT_STATE on ENOENT. Phase 51
INVERTS this for `loadConfig` per D-15: return a discriminated `ConfigLoadResult`
instead of throwing. Reuse the read+parse+validate **flow** but route each failure
arm into the union:
- ENOENT → `{ status: "absent" }`
- other read error → `{ status: "invalid", filePath, error }`
- JSON.parse fail → `{ status: "invalid", filePath, error }`
- `CONFIG_VALIDATOR.Check` fail → `{ status: "invalid", filePath, error: firstConfigValidationErrorDetail(parsed) }`
- success → `{ status: "valid", filePath, config }`

CRITICAL (Pitfall 51-1): a 0-byte file lands in JSON.parse → `invalid`, NOT
`absent` or `valid-with-defaults`. Test the 0-byte case explicitly.

**Save pattern** (state-io.ts:215-224):
```typescript
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
Mirror, but per Pitfall 51-5 add `await assertPathInside(scopeRoot, filePath, "saveConfig")` BEFORE `atomicWriteJson`. Suggested signature: `saveConfig(filePath: string, config: ScopeConfig, scopeRoot: string)`.

---

### `persistence/config-merge.ts` (NEW — entry-level base+local merge)

**Analog:** None directly. Pure plain-TS reduction; the closest convention reference
is `state-io.ts`'s record walks (e.g. lines 182-189). Do NOT pull in `deepmerge` /
`lodash.merge` — entry-level override is domain logic (CFG-02 / D-01 / Pitfall 9).

**Shape (per CONTEXT D-09/D-10 + RESEARCH Pattern 3):**
```typescript
export interface MergedConfigEntry<T> {
  readonly entry: T;
  readonly source: "base" | "local"; // provenance for Phase 53 dry-run + Phase 56 write-back targeting
}

export interface MergedConfig {
  readonly marketplaces: Record<string, MergedConfigEntry<MarketplaceConfigEntry>>;
  readonly plugins: Record<string, MergedConfigEntry<PluginConfigEntry>>;
}

export function mergeScopeConfigs(base: ScopeConfig, local: ScopeConfig): MergedConfig {
  // For each key in union(base.marketplaces ?? {}, local.marketplaces ?? {}):
  //   merged[k] = local[k] ? { entry: local[k], source: "local" }
  //                        : { entry: base[k],  source: "base"  };
  // Same loop for plugins.
}
```

**Pitfall 51-4 guardrail:** the higher-level loader (e.g. `loadMergedScopeConfig`)
MUST return BOTH the `MergedConfig` AND the per-file `ConfigLoadResult` for base
and local separately, so Phase 56 write-back can target the correct physical file
without re-loading. Suggested return shape:
`{ merged: MergedConfig, base: ConfigLoadResult, local: ConfigLoadResult }`.

**D-18 fallback (one-invalid-file):** when exactly one of base/local is invalid and
the other is valid, fall back to the valid file with a warning and run FULL
reconcile for that scope. When BOTH (or the only existing one) are invalid, the
scope aborts. Scope independence is non-negotiable: an aborted scope must not block
the other scope. Phase 51 may stub the warning surface (D-19 routes through
`shared/notify.ts` later); the merge function itself is pure.

---

### `persistence/locations.ts` (MODIFIED — sibling additions)

**Self-analog:** lines 115-133 + interface lines 38-100 + freeze block lines 144-163.

**Add to `ScopedLocations` interface** (mirror the `mcpJsonPath` doc comment style
at locations.ts:55-56):
```typescript
/** `<scopeRoot>/claude-plugins.json` -- declarative config base (CFG-01). */
readonly configJsonPath: string;
/** `<scopeRoot>/claude-plugins.local.json` -- per-machine override layer (CFG-02). */
readonly configLocalJsonPath: string;
```

**Construction pattern** (locations.ts:120-123 shows the `path.join(scopeRoot, ...)` peer-tier convention used by `agentsDir` and `mcpJsonPath`):
```typescript
const configJsonPath = path.join(scopeRoot, "claude-plugins.json");
const configLocalJsonPath = path.join(scopeRoot, "claude-plugins.local.json");
```
Note (per RESEARCH ARCHITECTURE): config paths sit under `scopeRoot`, NOT
`extensionRoot`. They are user-owned files at the same tier as `agents/` and
`mcp.json`. The comment block at locations.ts:134-143 explicitly sanctions
hard-coded-suffix joins on `scopeRoot` without `assertPathInside` because no
untrusted name components participate — the same rationale applies to the two new
paths. NFR-10 enforcement happens at the WRITE site in `saveConfig` (Pitfall 51-5),
not here.

**Add to the `Object.freeze` bundle** (locations.ts:144-163): include
`configJsonPath` and `configLocalJsonPath` in the frozen literal.

**Test update** (`tests/persistence/locations.test.ts`): add assertions mirroring
the existing `mcpJsonPath` checks for both new fields under user and project scope.

---

### `persistence/state-io.ts` (MODIFIED — carve-out)

**Self-modify:** line 71 only.

**Before:**
```typescript
const MARKETPLACE_RECORD_SCHEMA = Type.Object({
  // ...
  lastUpdatedAt: Type.Optional(Type.String()),
  autoupdate: Type.Optional(Type.Boolean()),  // ← line 71
  plugins: Type.Record(Type.String(), PLUGIN_INSTALL_RECORD_SCHEMA),
});
```

**After (D-12, D-14):**
```typescript
const MARKETPLACE_RECORD_SCHEMA = Type.Object({
  // ...
  lastUpdatedAt: Type.Optional(Type.String()),
  // autoupdate REMOVED per SPLIT-01 / D-12 — moves to CONFIG_SCHEMA.
  // source (line 66) KEEPS per D-14 — materialized record (machine fact).
  plugins: Type.Record(Type.String(), PLUGIN_INSTALL_RECORD_SCHEMA),
});
```
`STATE_SCHEMA.schemaVersion: Type.Literal(1)` (line 77) is UNCHANGED (D-12).

**Pitfall 51-2 + 51-3 implication:** typebox's lenient default means legacy
state.json with `autoupdate` STILL validates (extra-property tolerance). The scrub
must run as unconditional normalization in `migrate.ts`, NOT triggered by
validation failure. See next section.

**Test update** (`tests/persistence/state-io.test.ts`): add a case "legacy
state.json containing `autoupdate` still loads" — asserting the field is dropped
post-load when the D-13 gate is open, and preserved when the gate is closed.

---

### `persistence/migrate.ts` (MODIFIED — extend the existing walker)

**Self-analog:** the `ensureMarketplacePaths` (lines 36-59) and `ensurePluginResources` (lines 61-95) helpers, called from `migrateLegacyMarketplaceRecords` (lines 111-153). Add a third helper following the SAME shape:

```typescript
function ensureNoLegacyAutoupdate(mp: Record<string, unknown>): boolean {
  if (mp.autoupdate === undefined) return false;
  delete mp.autoupdate;
  return true;
}
```
Wire it inside the existing for-loop at lines 138-151, OR-merging into `mutated`
the same way the two existing helpers do:
```typescript
// existing pattern at lines 147-148:
mutated = ensureMarketplacePaths(mpName, mp, extensionRoot) || mutated;
mutated = ensurePluginResources(mp) || mutated;
// new line (D-12):
mutated = ensureNoLegacyAutoupdate(mp) || mutated;
```

**D-13 ORDERING RAIL (non-negotiable, see Pitfall 51-6):** the scrub must NOT
destroy autoupdate intent before Phase 52's first-run migration captures it.
Planner picks the mechanism; two viable shapes from RESEARCH Pattern 4:

1. **Gated-by-config-exists:** the scrub fires only when a config file already
   exists at the scope's `configJsonPath`. First load (pre-Phase-52) preserves
   `autoupdate`; Phase 52 migration reads it and generates the config; subsequent
   loads see the config exists and scrub. This requires the migration call to
   receive the relevant `loc.configJsonPath` (a signature change on
   `migrateLegacyMarketplaceRecords` and its caller in `state-io.ts` line 175).

2. **Preserve-and-expose:** `migrateLegacyMarketplaceRecords` returns the legacy
   `autoupdate` values to the caller without mutating the in-memory record, and
   Phase 52 reads them BEFORE invoking the scrub.

Mechanism (1) is the simpler diff; mechanism (2) keeps `migrate.ts` synchronous on
the FS. Either is acceptable. Both meet D-13.

**Persist pattern** (lines 170-182): `persistMigratedState` is UNCHANGED. It
already fires when `mutated === true` and routes failures through the IL-3
sanctioned `console.warn`. No new warn callsite is introduced. Note from
docstring lines 165-168: the `migrate.ts` block in `eslint.config.js` BLOCK B-2
permits the existing `console.warn` only for this file; do NOT add another.

**Test update** (`tests/persistence/migrate.test.ts`): add fixtures
(`tests/persistence/fixtures/legacy/`) for "legacy state.json with `autoupdate`"
and assert (a) D-13 gate closed → field preserved, (b) D-13 gate open → field
scrubbed, (c) `mutated` flips correctly so `persistMigratedState` fires once and
no-ops on the next load.

---

### `tests/persistence/config-io.test.ts` (NEW)

**Analog:** `tests/persistence/state-io.test.ts` (entire file is the template).

**Imports + tmpdir scaffolding pattern** (state-io.test.ts:1-50):
```typescript
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

async function tmpExtensionRoot(): Promise<{ root: string; cleanup: ... }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-state-test-"));
  // ... ENOTEMPTY-retry cleanup loop (state-io.test.ts:34-49) ...
}
```
Copy the helper renamed `tmpScopeRoot`; the ENOTEMPTY-retry loop is required
because `loadConfig` may trigger fire-and-forget persist in the legacy-scrub path
analog (mirror state-io.test.ts:30-49 verbatim).

**Test cases required (per CFG-03 / D-15 / D-18 / Pitfall 51-1):**
- `loadConfig` on ENOENT → `{ status: "absent" }`
- `loadConfig` on **0-byte file** → `{ status: "invalid", error: /JSON parse/ }` (THE Pitfall 51-1 anchor; mandatory)
- `loadConfig` on malformed JSON → `{ status: "invalid", ... }`
- `loadConfig` on JSON-valid-but-schema-invalid (e.g., `marketplaces: "not an object"`) → `{ status: "invalid", error: /schema/ }`
- `loadConfig` on minimal-valid `{}` → `{ status: "valid", config: {} }`
- `loadConfig` on minimal-valid CONTEXT `<specifics>` example → `{ status: "valid", config }`
- `loadConfig` on UNKNOWN keys (D-09 lenient) → `{ status: "valid" }` (unknown keys pass)
- `loadConfig` on `schemaVersion: 2` → `{ status: "invalid" }` (D-11: literal 1 only)
- `saveConfig` round-trip: write → read → byte-equal (modulo trailing `\n`)
- `saveConfig` refuses on schema-invalid in-memory value (mirror state-io.ts:216-220)
- `saveConfig` refuses with `PathContainmentError` when `filePath` escapes `scopeRoot` (Pitfall 51-5)

---

### `tests/persistence/config-merge.test.ts` (NEW)

**Analog:** `tests/persistence/state-io.test.ts` (scaffolding only — merge is pure, so no tmpdir needed).

**Test matrix (CFG-02):**
- base-only entries pass through with `source: "base"`
- local-only entries pass through with `source: "local"`
- both present → local wins, `source: "local"`
- base entry with unknown nested fields + local entry that overrides → local fully replaces (D-01 entry-level, never field-merge); unknown fields in the replaced base entry are NOT preserved here (D-10's preservation is a write-back concern, not a merge concern)
- empty base + empty local → empty `MergedConfig`
- dangling plugin (plugin references marketplace absent in BOTH base and local) → still a VALID merged result (D-16); reconcile soft-fails later, merge itself does not abort

---

### `tests/architecture/config-state-write-seams.test.ts` (NEW)

**Analog:** `tests/architecture/no-shell-out.test.ts` (file-walker shape, lines 50-92 are the template).

**Walker pattern (no-shell-out.test.ts:50-60):**
```typescript
async function* walkTsFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTsFiles(full);
    } else if (entry.isFile() && full.endsWith(".ts")) {
      yield full;
    }
  }
}
```
Copy verbatim.

**Allow-list pattern (no-shell-out.test.ts:46-48):**
```typescript
const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
]);
```
Mirror with two allow-lists for SPLIT-02:
```typescript
const ALLOWED_STATE_JSON_WRITERS: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/persistence/state-io.ts",   // saveState
  "extensions/pi-claude-marketplace/persistence/migrate.ts",    // persistMigratedState
]);
const ALLOWED_CONFIG_JSON_WRITERS: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/persistence/config-io.ts",  // saveConfig
  // Phase 52 will add migrate-config.ts here
]);
```

**Assertion pattern (no-shell-out.test.ts:71-92):**
For each .ts file under `extensions/pi-claude-marketplace/`, refuse if a forbidden
write pattern appears outside its allow-list. Suggested patterns to scan for (mix
of import-graph and call-site detection — Claude's discretion per CONTEXT):
- A file that imports `atomicWriteJson` AND references `stateJsonPath` /
  `configJsonPath` / `configLocalJsonPath` from `ScopedLocations` must be in the
  matching allow-list.
- A simpler regex variant: forbid `atomicWriteJson(loc.stateJsonPath` outside
  ALLOWED_STATE_JSON_WRITERS, and `atomicWriteJson(loc.configJsonPath` /
  `atomicWriteJson(loc.configLocalJsonPath` outside ALLOWED_CONFIG_JSON_WRITERS.

**Sibling "exactly N" assertion (no-shell-out.test.ts:100-104):**
Mirror the trailing test that pins the allow-list to a specific set so any future
widening MUST update the test in the same commit.

## Shared Patterns

### Atomic JSON write (NFR-1)
**Source:** `extensions/pi-claude-marketplace/shared/atomic-json.ts:24-31`
**Apply to:** `saveConfig` (and only `saveConfig` for the new config paths).
```typescript
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8",
  });
}
```
Do NOT call `fs.writeFile` directly for either config file. Do NOT introduce a
parallel atomic mechanism. This is the single sanctioned JSON-write seam.

### Path containment (NFR-10)
**Source:** `extensions/pi-claude-marketplace/shared/path-safety.ts:77-`
**Apply to:** `saveConfig` (and only `saveConfig`). Per Pitfall 51-5, both new
config paths are constructed in `locations.ts` from hard-coded suffixes on
`scopeRoot` — containment at the construction site is structurally
guaranteed. The architecture-test requirement of SPLIT-02 ("config + internal
paths added to the NFR-10 containment allow-list") is satisfied at the write
site, not via a config string:
```typescript
await assertPathInside(scopeRoot, filePath, "saveConfig");
await atomicWriteJson(filePath, config);
```

### Discriminated-union exhaustiveness (NFR-7 convention)
**Source:** Established codebase convention (e.g. `installable: true | false` per
PRD NFR-7; `assertNever` callers in `orchestrators/`).
**Apply to:** Every `ConfigLoadResult` consumer (Phase 51 has none — this contract
binds Phases 52-56). Phase 51's deliverable is the discriminated SHAPE; planner
should call out the binding for downstream phases in the PLAN.md so the no-throw,
no-default-empty discipline is preserved end-to-end.

### Source string semantic gate
**Source:** `extensions/pi-claude-marketplace/persistence/state-io.ts:108-137`
(`normalizeStoredSource`) + `extensions/pi-claude-marketplace/domain/source.ts`
(`parsePluginSource`, `pathSource`, `githubSource`).
**Apply to:** Wherever a `MarketplaceConfigEntry.source` raw string is consumed
(Phase 53/55, NOT Phase 51 itself). Per D-02, the CONFIG_SCHEMA schema field stays
`Type.String()`; classification happens at consume time through `parsePluginSource`,
NOT inside the schema. Phase 51 must NOT add a `Type.Union` of structured source
shapes (Anti-Pattern in RESEARCH; D-02).

### Fire-and-forget persist after legacy normalization
**Source:** `extensions/pi-claude-marketplace/persistence/migrate.ts:170-182` +
`extensions/pi-claude-marketplace/persistence/state-io.ts:201-203` (`void persistMigratedState(...)`).
**Apply to:** The D-12 autoupdate scrub. Reuse `persistMigratedState` as-is; do
NOT create a parallel async persister. The existing IL-3 `console.warn` is the
only sanctioned warn callsite — do not add a second.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `persistence/config-merge.ts` | pure-domain reducer | transform | No prior pure-reducer file in `persistence/`; the closest reference is the inline record walks in `state-io.ts:182-189` and `migrate.ts:138-151`. The file is short enough (~50 LOC) that a brand-new structure is appropriate. Use plain `Object.keys` + `??`; do NOT pull in a library. |

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/persistence/` (state-io.ts, migrate.ts, locations.ts)
- `extensions/pi-claude-marketplace/shared/` (atomic-json.ts, path-safety.ts)
- `tests/persistence/` (state-io.test.ts, locations.test.ts, migrate.test.ts)
- `tests/architecture/` (no-shell-out.test.ts as the walker analog)

**Files scanned (Read):** 7
**Files inventoried (Bash):** 3 directories
**Pattern extraction date:** 2026-06-09
