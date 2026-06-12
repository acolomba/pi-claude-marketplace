# Phase 52: First-Run Migration - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 3 new + 1 modified
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/persistence/migrate-config.ts` (NEW) | persistence module (pure projection + thin orchestrator) | transform + file-I/O (read-via-loadConfig, write-via-saveConfig) | `extensions/pi-claude-marketplace/persistence/migrate.ts` | exact (same role: legacy-shape migration sibling of state-io / config-io) |
| `tests/persistence/migrate-config.test.ts` (NEW) | unit test (node:test) | request-response (pure projection asserts) + file-I/O (tmp scopeRoot integration) | `tests/persistence/migrate.test.ts` + `tests/persistence/config-io.test.ts` | exact (sibling test for sibling module) |
| `tests/persistence/fixtures/legacy/state-populated-mixed.json` (NEW) | test fixture (data) | static JSON | `tests/persistence/fixtures/legacy/state-with-autoupdate.json` | exact (same fixture taxonomy, richer entries) |
| `tests/architecture/config-state-write-seams.test.ts` (POTENTIAL MODIFY) | architecture test | static set assertion | self (already exists) | n/a — RESEARCH A1 concludes no change is needed because `migrate-config.ts` routes through `saveConfig`, not `atomicWriteJson`. Plan MUST verify and document the no-op outcome. |

## Pattern Assignments

### `persistence/migrate-config.ts` (persistence transform + thin orchestrator)

**Primary analog:** `extensions/pi-claude-marketplace/persistence/migrate.ts`
**Secondary analog (write seam):** `extensions/pi-claude-marketplace/persistence/config-io.ts` (consumed, not copied)

**File-header docblock pattern** (from `migrate.ts:1-19` and `config-io.ts:1-29`):
- Top comment names the requirement IDs (e.g. `MIG-01 / MIG-02 / D-13`), states the role in one sentence, then enumerates load-bearing contracts (atomicity, pure-vs-impure split, ordering rails). Copy this shape verbatim.

**Imports pattern** (from `migrate.ts:21-24`):
```typescript
import path from "node:path"; // not needed here; included for pattern only

import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";
```
For `migrate-config.ts`, the analogous import block (per RESEARCH Code Example 1):
```typescript
import {
  loadConfig,
  saveConfig,
  type ScopeConfig,
} from "./config-io.ts";
import type { ExtensionState } from "./state-io.ts";
import type { ScopedLocations } from "./locations.ts";
import type { ParsedSource } from "../domain/source.ts";
```
Conventions to mirror: `.ts` extensions on relative imports; node builtins grouped first; type-only imports use `import type`.

**Pure-function-with-mutated-flag pattern** (from `migrate.ts:143-190` `migrateLegacyMarketplaceRecords`):
- Pure function, no I/O.
- Returns a readonly result interface (`MigrationResult` with `marketplaces` + `mutated`).
- For Phase 52, mirror as `buildConfigFromState(state): ScopeConfig` returning the projected config (no mutated flag — projection is unconditional, caller decides via ENOENT).

**Result-interface pattern** (from `migrate.ts:31-34`):
```typescript
export interface MigrationResult {
  readonly marketplaces: Record<string, unknown>;
  readonly mutated: boolean;
}
```
Apply to Phase 52:
```typescript
export interface MigrateFirstRunResult {
  readonly migrated: boolean;
  readonly entryCount: number;
  readonly filePath: string;
}
```

**Orchestrator-calls-write-seam pattern** (from `migrate.ts:206-218` `persistMigratedState`):
- Thin async function takes filepath + payload, delegates to the shared atomic writer.
- Phase 52 difference: route through `saveConfig` (NOT `atomicWriteJson`) so SPLIT-02 + NFR-10 + schema-revalidation are inherited. Do NOT replicate the IL-3 console.warn — `saveConfig` errors must propagate (CFG-03 abort is the caller's concern, not migration's).

**ENOENT-as-discriminated-arm pattern** (from `config-io.ts:119-155` `loadConfig`):
- `loadConfig` returns `{ status: "absent" | "invalid" | "valid" }`.
- Migration narrows on `result.status !== "absent"` to short-circuit. Do not collapse `invalid` into the migration path — RESEARCH Pitfall 52-5 forbids it.

**SPLIT-01 cast for legacy `autoupdate`** (from `migrate.ts:80-87` `ensureNoLegacyAutoupdate` reading `mp.autoupdate` on `Record<string, unknown>`):
- The legacy field lives on the in-memory marketplace record as an untyped property; access via `(mp as unknown as Record<string, unknown>).autoupdate`.
- RESEARCH explicitly cites this as the same cast pattern used at 11 production sites.

**Module docstring conventions** (from `config-io.ts:40-45`, `migrate.ts:26-34`):
- JSDoc above each exported symbol cites requirement IDs (`D-01 / D-04`), describes contracts (pure, throws-or-not), and names ordering rails when relevant.

---

### `tests/persistence/migrate-config.test.ts` (unit + integration tests)

**Primary analog (test taxonomy + assertion style):** `tests/persistence/migrate.test.ts`
**Secondary analog (tmp scopeRoot scaffolding):** `tests/persistence/config-io.test.ts`

**Imports pattern** (from `migrate.test.ts:1-11`):
```typescript
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  migrateLegacyMarketplaceRecords,
  persistMigratedState,
} from "../../extensions/pi-claude-marketplace/persistence/migrate.ts";
```

**Fixture-load pattern** (from `migrate.test.ts:22-23, 38-41`):
```typescript
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/legacy");
// ...
const fixture = JSON.parse(
  await readFile(path.join(FIXTURES, "v0-no-schemaversion.json"), "utf8"),
) as unknown;
```

**Tmp scopeRoot scaffolding** (from `config-io.test.ts:28-52`):
```typescript
async function tmpScopeRoot(): Promise<{ scopeRoot: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-config-test-"));
  const scopeRoot = path.join(dir, ".pi");
  await mkdir(scopeRoot, { recursive: true });
  const cleanup = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await rm(dir, { recursive: true, force: true });
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOTEMPTY" && attempt < 9) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          continue;
        }
        throw err;
      }
    }
  };
  return { scopeRoot, cleanup };
}
```
Apply unchanged — Phase 52 integration tests need the same retry-cleanup loop.

**Test-name pattern** (from `migrate.test.ts:38, 75, 94`):
- Format: `<REQ-ID> <verb-phrase> (<fixture-name or pitfall>)`.
- Examples: `"ST-4 migrate fills missing manifestPath ... (v0 fixture)"`, `"Pitfall 9 migrate on null returns empty marketplaces"`.
- Apply to Phase 52: `"MIG-01 losslessness: every state marketplace + plugin appears in the generated config"`, `"Pitfall 52-1 soft-degraded entries are included"`, `"MIG-02 idempotency: migration short-circuits on second call"`.

**Sectioned-comment pattern** (from `migrate.test.ts:118-120` and `config-io.test.ts:54-56`):
```typescript
// ──────────────────────────────────────────────────────────────────────────
// A. loadConfig trichotomy (CFG-03 / D-15)
// ──────────────────────────────────────────────────────────────────────────
```
Use to partition Phase 52 tests into (A) `buildConfigFromState` pure-projection asserts, (B) `migrateFirstRunConfig` ENOENT-arm integration, (C) idempotency / invalid-arm guards, (D) data-level convergence (Pattern 4 / RESEARCH Code Example 2).

**Data-level convergence test** (from RESEARCH Code Example 2, consuming `config-merge.ts::mergeScopeConfigs`):
- Imports `mergeScopeConfigs` from `persistence/config-merge.ts`; asserts marketplace key set equality + plugin key set equality + `source: "base"` provenance on every merged entry.

---

### `tests/persistence/fixtures/legacy/state-populated-mixed.json` (new fixture)

**Analog:** `tests/persistence/fixtures/legacy/state-with-autoupdate.json`

**Structural pattern to copy** (from the analog):
```json
{
  "marketplaces": {
    "mp-with-autoupdate": {
      "name": "mp-with-autoupdate",
      "scope": "user",
      "source": "./mp-with-autoupdate-local",
      "addedFromCwd": "/some/cwd",
      "autoupdate": true,
      "plugins": {
        "p1": {
          "version": "1.0.0",
          "resolvedSource": "/abs/p1",
          "compatibility": { "installable": true, "notes": [], "supported": ["skills"], "unsupported": [] },
          "resources": { "skills": ["mp-s1"], "prompts": [] },
          "installedAt": "2025-01-01T00:00:00.000Z",
          "updatedAt": "2025-01-01T00:00:00.000Z"
        }
      }
    }
  }
}
```

**Phase 52 additions per RESEARCH Example 3:**
- At least 2 marketplaces (one with `autoupdate: true`, one without).
- At least one plugin with `compatibility.installable: false` (Pitfall 52-1 coverage).
- At least 2 plugins sharing the same name across different marketplaces (Pitfall 52-6 coverage — flat-key collision).
- Source variety: include at least one GitHub-shaped source (e.g. `"acme/tools"`) alongside the path source to exercise `ParsedSource.raw` recovery on both variants.

---

### `tests/architecture/config-state-write-seams.test.ts` (verify-only, likely no change)

**Status:** RESEARCH Assumption A1 [VERIFIED] concludes the architecture test scans for `atomicWriteJson(...configJsonPath, ...)` callsites; `migrate-config.ts` calls `saveConfig(...)` and therefore does NOT trigger the allow-list assertion. Phase 52 plan MUST run this test in CI and confirm GREEN. If RED, fall back to the CONTEXT.md instruction: add `migrate-config.ts` to `ALLOWED_CONFIG_JSON_WRITERS` AND increment the "exactly N" sibling assertion in the same commit.

---

## Shared Patterns

### Atomic config write (NFR-1 / NFR-10 / SPLIT-02)
**Source:** `extensions/pi-claude-marketplace/persistence/config-io.ts:172-185` (`saveConfig`)
**Apply to:** Every config write in Phase 52. Migration calls `saveConfig(loc.configJsonPath, cfg, loc.scopeRoot)` — never `atomicWriteJson` directly.
```typescript
export async function saveConfig(
  filePath: string,
  config: ScopeConfig,
  scopeRoot: string,
): Promise<void> {
  if (!CONFIG_VALIDATOR.Check(config)) {
    throw new Error(`saveConfig refused: in-memory config failed schema validation: ${firstConfigValidationErrorDetail(config)}`);
  }
  await assertPathInside(scopeRoot, filePath, "saveConfig");
  await atomicWriteJson(filePath, config);
}
```
Inheriting `saveConfig` gets the migration: schema revalidation, NFR-10 containment, write-file-atomic tmp+fsync+rename — for free.

### ENOENT trichotomy (CFG-03 / D-15)
**Source:** `extensions/pi-claude-marketplace/persistence/config-io.ts:105-108, 119-155` (`ConfigLoadResult`, `loadConfig`)
**Apply to:** The migration trigger. Check `result.status === "absent"` only; any other status returns `notMigrated`.
```typescript
export type ConfigLoadResult =
  | { readonly status: "absent" }
  | { readonly status: "invalid"; readonly filePath: string; readonly error: string }
  | { readonly status: "valid"; readonly filePath: string; readonly config: ScopeConfig };
```

### SPLIT-01 cast for legacy fields
**Source:** `extensions/pi-claude-marketplace/persistence/migrate.ts:80-87` (`ensureNoLegacyAutoupdate`)
**Apply to:** Reading `mp.autoupdate` from the in-memory `ExtensionState` marketplace record.
```typescript
// In migrate.ts the field is checked / deleted on Record<string, unknown>:
if (mp.autoupdate === undefined) { return false; }
delete mp.autoupdate;
```
For Phase 52, the projection reads the field via the equivalent unchecked cast:
```typescript
const legacyAutoupdate = (mp as unknown as Record<string, unknown>).autoupdate;
```

### Test scaffolding (tmp scope + retry cleanup)
**Source:** `tests/persistence/config-io.test.ts:28-52` (`tmpScopeRoot`)
**Apply to:** All integration tests in `migrate-config.test.ts` that exercise the `saveConfig` write path.

### Fixture loading
**Source:** `tests/persistence/migrate.test.ts:22-23, 38-41`
**Apply to:** Loading the new `state-populated-mixed.json` fixture in projection tests.

### Source-comment policy (project memory)
**Source:** project CLAUDE memory "Source comment cleanup policy"
**Apply to:** Production code in `migrate-config.ts`. KEEP decision/requirement IDs (`MIG-01`, `D-13`, `SPLIT-01`, `Pitfall 52-N`) as inline traceability. STRIP phase/plan/wave milestone narrative — git history holds it.

---

## No Analog Found

None — all four files have direct sibling analogs in the existing persistence layer and its test tree. Phase 52 is, per RESEARCH, "almost entirely a glue layer over Phase 51's primitives."

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/persistence/`, `extensions/pi-claude-marketplace/shared/`, `tests/persistence/`, `tests/architecture/`
**Files scanned:** persistence/config-io.ts, persistence/migrate.ts, persistence/config-merge.ts, persistence/state-io.ts (referenced), tests/persistence/migrate.test.ts, tests/persistence/config-io.test.ts, tests/persistence/fixtures/legacy/state-with-autoupdate.json
**Pattern extraction date:** 2026-06-10
