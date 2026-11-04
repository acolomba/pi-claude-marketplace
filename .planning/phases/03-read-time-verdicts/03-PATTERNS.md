# Phase 3: Read-Time Verdicts - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 7 new (plus the owned edits listed in 03-RESEARCH.md "Per-surface wiring table" / "Unit, Integration, and E2E Impact")
**Analogs found:** 7 / 7

Frozen files (01-FROZEN.md) are analogs only, never edit targets: `orchestrators/mcp/recorded-servers.ts`, `domain/mcp-implementation.ts`, `features/lib/mcp-implementation.ts`, `features/lib/mcp-server-files.ts`, `features/step_definitions/mcp-implementation.steps.ts`, `features/support/**`, `features/mcp-server/implementation-profiles.feature`, shared step modules. `verdict-markers.feature` is Phase-3 owned (edit allowed).

## File Classification

| New File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts` | pure helper (orchestrator) | transform | `domain/mcp-implementation.ts` (`profileFor`, `effectiveMcpCompatibility`) | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts` | I/O read helper | file-I/O, read-only | `orchestrators/mcp/recorded-servers.ts` | exact |
| `test/orchestrators/plugin/mcp-verdict.test.ts`, `test/orchestrators/plugin/mcp-verdict-read.test.ts` | unit test pair | - | `test/domain/mcp-implementation.test.ts`, `test/orchestrators/mcp/recorded-servers.test.ts` | exact |
| `features/mcp-server/verdict-*.feature` | cucumber feature | request-response | `features/mcp-server/verdict-markers.feature` (pairs) + `implementation-profiles.feature` (`@own-implementation` restart) | exact |
| `features/step_definitions/mcp-server/verdict-*.steps.ts` | step module | request-response | `features/step_definitions/mcp-server/invalid-configs.steps.ts`, `status.steps.ts` | role-match |
| `features/lib/mcp-verdict-*.ts` | harness lib | file-I/O | `features/lib/mcp-server-files.ts`, `features/lib/mcp-implementation.ts` (`readBuiltinTurnedOff`, line 205) | role-match |
| `test/integration/mcp-verdict-*.test.ts` | integration test | file-I/O (hermetic) | `test/integration/mcp-server-records.test.ts` | exact |

## Pattern Assignments

### `orchestrators/plugin/mcp-verdict.ts` (pure)
**Analog:** `domain/mcp-implementation.ts` lines 13-26, 140-142, 304-308. Header comment cites IDs (MREC-0x, D-P3-xx), states "no I/O, no network (NFR-5)". MUST NOT import `recorded-servers.ts` (Pitfall 1: cycle via `install-outcome.ts`). Body per 03-RESEARCH.md lines 610-629:
```ts
import { profileFor } from "../../domain/mcp-implementation.ts";

import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { McpDependency } from "../../shared/concerns/soft-dep.ts";

export function profileFor(id: McpImplementationId): McpImplementationProfile { return PROFILES[id]; }  // analog style: explicit return types
```
Imports order: builtin, external, relative, then `import type` last (import-x/order).

### `orchestrators/plugin/mcp-verdict-read.ts` (I/O)
**Analog:** `orchestrators/mcp/recorded-servers.ts` lines 1-26 (header: "The read changes nothing ... reaches no network (NFR-5). Outside NETWORK_SEAMS"), entry points `recordedMcpServers` (l.46) and `createLegacyServersReader(source: LegacyServersSource)` (l.145):
```ts
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
...
import type { RecordedMcpServer, RecordedMcpServers } from "../../domain/mcp-implementation.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
```
Core (RESEARCH l.631-643): `const recorded = await recordedMcpServers(record, createLegacyServersReader(source)); return { effective: effectiveMcpCompatibility(record, recorded, active), recorded };`. Import only from cycle-safe consumers (list/info/reconcile), never from `install-outcome.ts`. Once consumed, remove `recorded-servers.ts` / `mcp-implementation.ts` names from `.fallowrc.json` `ignoreExports` only if this phase is the consumer phase (CONVENTIONS says Phase 6 removes them; leave unless plan says so).

### Unit test pairs
**Analog:** `test/orchestrators/mcp/recorded-servers.test.ts` lines 1-40:
```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import { createLegacyServersReader, recordedMcpServers } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

function installRecord(resolvedSource = "/abs/plugin-root"): PluginInstallRecord {
  return { version: "1.0.0", resolvedSource,
    compatibility: { installable: true, notes: [], supported: ["mcpServers"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true, provenance: "explicit",
    installedAt: "2026-11-04T00:00:00.000Z", updatedAt: "2026-11-04T00:00:00.000Z" };
}
```
Pure-module tests: table-driven rows as in `test/domain/mcp-implementation.test.ts` lines 1-30 (`describe`/`test`, `readonly` row interface, `const ROWS: readonly Row[]`). Path mirrors source exactly; 100% direct coverage (`npm run test:coverage:direct:commit`). Phase 3 records add `compatibilityBasis: "neutral"` to fixtures.

### `features/mcp-server/verdict-*.feature`
**Pair analog:** `verdict-markers.feature` lines 1-12: feature description cites IDs (MREC-03/05/07, D-MB-07); each twin is `@builtin-only` / `@adapter-only` with the title suffix naming the implementation (", under Pi's built-in MCP"). Declare servers with the frozen step `Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:` (doc strings for sse/ws/bare-elicitation in RESEARCH l.666-675).
**Restart analog:** `implementation-profiles.feature` lines 11-24:
```gherkin
  @own-implementation
  Scenario: ...
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    When the user restarts pi without pi-mcp-adapter
    When the user runs "/claude:plugin list"
    Then ...
```
No-implementation form (l.43-52): `Given pi runs with the scripted model` + `When the user restarts pi with no mcp`, or `Given the user's pi settings turn off pi's built-in mcp`. Tag rules: exactly one implementation tag; `@mcp` never names pi-mcp-adapter (`npm run check:features`).

### `features/step_definitions/mcp-server/verdict-*.steps.ts`
**Analog:** `invalid-configs.steps.ts` lines 1-17 (fileoverview citing IDs, `node:` imports, `@cucumber/cucumber`, `../../lib/*` helpers, `import type { ScenarioWorld } from "../../support/world.ts"`); Then shape from `configuration.steps.ts` lines 151-160:
```ts
Then("...", async function (this: ScenarioWorld, ...) {
  ...
  assert.deepStrictEqual(actual, expected);
});
```
Settings-unchanged step: call frozen `readBuiltinTurnedOff(agentDir, projectDir)` (`features/lib/mcp-implementation.ts:205`); sandbox paths from `this` run (`world.ts:269-270`: `projectDir: run.sandbox.cwd`, `agentDir: run.sandbox.agentDir`).

### `features/lib/mcp-verdict-*.ts`
**Analog:** `features/lib/mcp-server-files.ts` lines 1-25 (fileoverview, fs/promises, writes via `writePublishedPluginFile(s)` from `published-marketplace.ts`). Refuse paths outside the run root (T-01-14 note in `mcp-implementation.ts` header). Must have a consumer (fallow dead-code).

### `test/integration/mcp-verdict-*.test.ts`
**Analog:** `test/integration/mcp-server-records.test.ts` lines 1-60: header names IDs and says "drives the real operation in a hermetic home and reads the saved state.json"; imports `createInstallOperation`/`createEnableOperation`/`createReinstallOperation` (`orchestrators/plugin/operations.ts`), `createPluginUpdateOperations` (`update-flow.ts`), `locationsFor`, `loadState`/`saveState`, `createCompletionCache`, `withHermeticEnvironment` (`../platform/hermetic-environment.ts`), `makeCtx` (`./mcp-plugin-seed.ts`); declarations as `const` server literals (`LIVE = { type: "ws", ... }`).

## Shared Patterns
- **Output:** notify only through `shared/notification-dispatch.ts`; no console/stdio.
- **No network:** new orchestrator modules are default-denied by BLOCK F; do not add to NETWORK_SEAMS.
- **Complexity:** sonarjs 15 + fallow cognitive 15 / cyclomatic 20; keep marker selection flat (lookup table, RESEARCH l.583-606).
- **Comments:** cite spec IDs, never Phase/Plan numbers.

## No Analog Found
None.

## Metadata
Search scope: `extensions/pi-claude-marketplace/{domain,orchestrators/mcp}`, `test/{domain,orchestrators/mcp,integration}`, `features/{mcp-server,step_definitions/mcp-server,lib,support}`.
