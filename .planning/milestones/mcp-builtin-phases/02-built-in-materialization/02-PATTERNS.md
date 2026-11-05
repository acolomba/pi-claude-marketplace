# Phase 2: Built-in Materialization - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 27 (product 11, unit tests 9, integration 1, cucumber 6 groups)
**Analogs found:** 26 / 27

All paths below are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`.
Every analog named here is git-tracked source (checked with `git ls-files`).
Frozen files (01-FROZEN.md §1) are listed only as read-only analogs, never as edit targets:
`platform/pi-api.ts`, `domain/mcp-implementation.ts`, `domain/mcp-server-features.ts`,
`domain/mcp-builtin-features.ts`, `orchestrators/mcp/{recorded-servers,session-materialize}.ts`,
`index.ts`, `orchestrators/plugin/info.ts` (the call), `features/support/**`,
`features/lib/{pi-process,mcp-implementation,mcp-stub-server,pi-registry-probe/**,builtin-mcp-stand-in/**}.ts`,
`features/step_definitions/{model,mcp-implementation,command}.steps.ts`, `mcp-server/{listing,status}.steps.ts`.
The seeds `orchestrators/mcp/builtin-registration-step.ts` and `platform/mcp-builtin-status.ts` keep their
signatures; Phase 2 fills only their bodies.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/domain/mcp-builtin-translation.ts` (NEW) | domain utility | transform (pure) | `E/domain/mcp-server-features.ts` `translateMcpServer` (L214-225) | exact |
| `E/bridges/mcp/substitute.ts` (MOD: `McpFieldEncoder` port) | bridge utility | transform | itself (L68-82, L97-106, L133-136, L181-195) | exact |
| `E/bridges/mcp/adapter-escape.ts` (MOD: `ADAPTER_FIELD_ENCODER`) | bridge utility | transform | itself (L295-319) | exact |
| `E/bridges/mcp/adapter-entry.ts` (MOD: pass encoder) | bridge | transform | itself L187-190 | exact |
| `E/bridges/mcp/builtin-escape.ts` (NEW) | bridge utility | transform | `E/bridges/mcp/adapter-escape.ts` | exact |
| `E/bridges/mcp/builtin-entry.ts` (NEW) | bridge | transform | `E/bridges/mcp/adapter-entry.ts` `translatedEntry` (L165-191) | exact |
| `E/bridges/mcp/builtin-registration.ts` (NEW) | bridge service | request-response over a port (sync) | `E/orchestrators/mcp/session-materialize.ts` (per-item try/catch + `hookDebugLog`) | role-match |
| sync `mcp.json` name reader (NEW, in bridges/mcp) | bridge reader | file-I/O (sync) | `E/bridges/mcp/adapter-doc.ts` `readMcpConfigDoc` (L185-209) + `PI_MCP_SERVER_KEYS` (L57) | role-match (async analog) |
| `E/bridges/mcp/index.ts` (MOD: barrel) | barrel | -- | itself | exact |
| `E/orchestrators/mcp/builtin-registration-step.ts` (fill bodies) | orchestrator / composition | batch read -> sync | `E/orchestrators/mcp/recorded-servers.ts` (L46-67, L145-188) + `E/orchestrators/marketplace/background-pass.ts:176` (`loadState` read-only) | role-match |
| `E/platform/mcp-builtin-status.ts` (fill body) | platform reader | request-response | `E/platform/mcp-status.ts` (adapter reader) | exact |
| `E/orchestrators/plugin/info-mcp-status.ts` (builtin arm) | orchestrator transform | transform (sync) | itself (L450-536) | exact |
| `test/domain/mcp-builtin-translation.test.ts` | test | -- | `test/domain/mcp-builtin-features.test.ts` (row table) | exact |
| `test/bridges/mcp/builtin-escape.test.ts` | test | -- | `test/bridges/mcp/adapter-escape.test.ts`, `expansion-cases.ts` | exact |
| `test/bridges/mcp/builtin-entry.test.ts` | test | -- | `test/bridges/mcp/adapter-entry.test.ts` | exact |
| `test/bridges/mcp/builtin-registration.test.ts` | test | -- | `test/orchestrators/mcp/builtin-registration-step.test.ts` (strong-mock `PiMcpRegistry`) | exact |
| `test/bridges/mcp/substitute.test.ts`, `adapter-escape.test.ts`, `adapter-entry.test.ts`, `index.test.ts` (MOD) | test | -- | themselves | exact |
| `test/orchestrators/mcp/builtin-registration-step.test.ts` (rewrite) | test | -- | itself + `test/platform/hermetic-environment.ts` `withHermeticEnvironment` | exact |
| `test/platform/mcp-builtin-status.test.ts` (rewrite) | test | -- | itself | exact |
| `test/orchestrators/plugin/info-mcp-status.test.ts` (extend) | test | -- | itself | exact |
| `test/integration/mcp-builtin-*.test.ts` (NEW) | integration test | conformance | `test/integration/mcp-variable-expansion.test.ts` + `test/integration/pi-mcp-adapter-peer.ts` / `optional-peer.ts` (file-URL import) | role-match |
| `features/mcp-server/{listing,configuration,sources,project-scope,lifecycle,invocation}.feature` (lift tag) | feature | -- | themselves; `features/mcp-server/implementation-profiles.feature` for tags | exact |
| `features/mcp-server/implementation-switch.feature`, `builtin-{trust,status,oauth,direct}.feature` (NEW) | feature | -- | `features/mcp-server/implementation-profiles.feature` (`@own-implementation`) | exact |
| `features/step_definitions/mcp-server/{invocation,implementation-switch,builtin-*}.steps.ts` (NEW) | step module | -- | `features/step_definitions/mcp-server/lifecycle.steps.ts`, `status.steps.ts`, `model.steps.ts:97-105` | exact |
| `features/lib/mcp-builtin-earlier-record.ts` (NEW) | harness lib | file-I/O | `features/lib/earlier-version-state.ts` | exact |
| `features/lib/mcp-builtin-tool-search.ts` (NEW) | harness projector | transform | `features/lib/upstream/index.ts` + `upstream/mcp.ts` | exact |
| `features/lib/mcp-builtin-config-probe/{extension,snapshot}.ts` (NEW) | harness Pi extension | event-driven | `features/lib/pi-registry-probe/{extension,snapshot}.ts`, `features/lib/pi-launch-environment.ts` | exact |
| `docs/mcp-compatibility.md` (MOD) | docs | -- | itself | n/a |

## Pattern Assignments

### `E/domain/mcp-builtin-translation.ts` (domain, pure transform)

**Analog:** `E/domain/mcp-server-features.ts` L203-225 (frozen; import, never edit).

```ts
export function translateMcpServer(
  server: Readonly<Record<string, unknown>>,
  description: string | undefined,
): Record<string, unknown> {
  return {
    ...serverFields(server),
    ...(description === undefined ? {} : { description }),
    directTools: server.alwaysLoad === true ? true : "search",
    toolPrefix: "mcp",
  };
}
```
- Derive from its output (RESEARCH Pattern 1, Code Examples L728-754): copy `command,args,env,url,headers` in fixed order, `type: "http"` first for remote, rename `requestTimeoutMs -> timeout` (`/1000`, no rounding), `oauth.redirectUri -> callbackUrl`, keep `clientId`, `authServerMetadataUrl`, `scope`; add `exposure`; `description` last. Never copy `auth`, `directTools`, `toolPrefix`, `httpTransport`.
- Fixed key order is load-bearing (Pitfall 3: Pi compares `JSON.stringify`).
- Doc header style: `// domain/<file>.ts` line + rationale paragraph with IDs (copy the substitute.ts header L1-14 shape).
- Zone `domain`: may import `domain/*` and the type `McpServerConfig` from `platform/pi-api.ts`. ESLint BLOCK F gates it from first commit (no `platform/git`).

### `E/bridges/mcp/substitute.ts` (MOD, encoder port)

Call sites to change (current text):
```ts
// L18
import { serializeLiteral, serializeSegments } from "./adapter-escape.ts";
// L81 in expandedValue
  return serializeSegments(expanded.segments, secret);
// L103-105 writtenEnvValue
  return LITERAL_ENV_KEYS.has(key)
    ? serializeLiteral(raw, true)
    : expandedValue(raw, "plain", ctx, true, names);
// L133-136 oauth
        ? mappedStrings(value, (_key, raw) => serializeLiteral(raw, false))
// L181-184
export function substituteAndInject(
  translated: Readonly<Record<string, unknown>>,
  ctx: McpSubstitutionContext,
): SubstitutedEntry {
```
- Declare `export interface McpFieldEncoder { readonly expanded: (segments: readonly Segment[], secret: boolean, env: ClaudeEnv) => string; readonly literal: (text: string, secret: boolean) => string }` here (consumer-declared port), add a required third parameter `encoder`, thread it through `expandedValue`/`writtenEnvValue`/`writtenField`, drop the `adapter-escape.ts` import (avoids a cycle once adapter-escape imports the port type).
- `withInjectedEnv` (L153-172) unchanged: it is the MENV-01/02 injection both paths share.
- Callers to trace: `adapter-entry.ts:187` is the only production caller (verify with `codegraph explore substituteAndInject`).

### `E/bridges/mcp/adapter-escape.ts` (MOD)
Add after L319, reusing the two exports verbatim:
```ts
export const ADAPTER_FIELD_ENCODER: McpFieldEncoder = {
  expanded: (segments, secret) => serializeSegments(segments, secret),
  literal: serializeLiteral,
};
```
Import `type { McpFieldEncoder } from "./substitute.ts"` in the type group (last).

### `E/bridges/mcp/adapter-entry.ts` (MOD) L187-190
```ts
  return withOAuthDecision(
    substituteAndInject(translateMcpServer(entry, description), substitution),
    substitution.env,
  );
```
Pass `ADAPTER_FIELD_ENCODER` as the third argument. Bytes of `mcp-adapter.json` must not change; the unchanged expectations in `test/bridges/mcp/adapter-entry.test.ts` are the proof.

### `E/bridges/mcp/builtin-escape.ts` (NEW)
**Analog:** `adapter-escape.ts` (header L1-20 explains the target resolver; imports L22-24; one exported writer per form).
Imports shape to copy:
```ts
import type { ClaudeEnv, Segment } from "../../domain/claude-mcp-variables.ts";
import type { McpFieldEncoder } from "./substitute.ts";
```
Body: RESEARCH Code Examples L691-726 (`segmentValue`, `escapedForPi` with function replacer `replaceAll("$", () => "$$")`, `BUILTIN_FIELD_ENCODER`). Header cites Pi `dist/core/resolve-config-value.js` and Claude 2.1.318 `n8`.
If fallow dupes flags a clone with `adapter-escape.ts`, put `// fallow-ignore-next-line code-duplication -- <reason>` in both copies (CONVENTIONS Suppressions).

### `E/bridges/mcp/builtin-entry.ts` (NEW)
**Analog:** `adapter-entry.ts` `translatedEntry` L165-191 (non-object guard, then translate, then walk).
```ts
  if (!isPlainObject(entry)) {
    warnings.push(`mcp server "${name}": entry is not an object; staged as an empty entry`);
    return { entry: translateMcpServer({}, description), report: { missing: [], blanked: [] } };
  }
```
- Built-in form: `builtinServerConfig(server: unknown, ctx: McpSubstitutionContext, description: string | undefined): McpServerConfig | undefined` = `substituteAndInject(translateBuiltinMcpServer(server, description), ctx, BUILTIN_FIELD_ENCODER).entry`, narrowed to Pi's type; `undefined` for a non-object (no warning sink at session time).
- Import `isPlainObject` from `./marker.ts`, `safeSet` from `./safe-set.ts` if writing keys (WR-01 `__proto__`).
- `projectDir` = `ctx.cwd` for both scopes (CONTEXT Builtins), unlike the adapter path's "user -> undefined" (substitute.ts L25-34 comment explains the adapter rule).

### `E/bridges/mcp/builtin-registration.ts` (NEW)
**Analog for failure isolation:** `orchestrators/mcp/session-materialize.ts` L28-35:
```ts
async function runStep(name: string, step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (err) {
    hookDebugLog(`${name} skipped: ${errorMessage(err)}`, "mcp");
  }
}
```
Imports: `import { hookDebugLog } from "../../shared/debug-log.ts"; import { errorMessage } from "../../shared/errors.ts";` and `import type { McpServerConfig, PiMcpRegistry } from "../../platform/pi-api.ts";`.
Body: RESEARCH Code Examples L756-785 (`syncBuiltinRegistrations(registry, desired, log)`; unregister `plugin_*` not desired; register when `JSON.stringify` differs; per-call try/catch). Prefer an injected `log` param (DI convention) over a hidden `hookDebugLog` call, so the strict-mock test can verify it.

### Sync `mcp.json` reader (NEW, bridges/mcp; name planner's, e.g. `builtin-overrides.ts`)
**Analog:** `adapter-doc.ts` `readMcpConfigDoc` L185-209 (BOM strip L194, empty check, `isPlainObject` top-level, `PI_MCP_SERVER_KEYS` L57).
```ts
  const body = text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
  ...
  const parsed = parseJsonc(filePath, stripped);
  if (!isPlainObject(parsed)) {
```
Must be synchronous (`readFileSync`; Pitfall 5): no existing sync analog in `E/` (grep found no `readFileSync`), so this is the first; any error -> "no override". Paths from `locationsFor(scope, cwd).mcpJsonPath` (`persistence/locations.ts`). Return a set of folded namespaces (`name.replaceAll("-", "_")`).

### `E/bridges/mcp/index.ts` (barrel)
Copy the existing `export { ... } from "./x.ts";` + `export type { ... }` blocks (L548-568 of the dump); add `syncBuiltinRegistrations`, `builtinServerConfig`, the override reader. `test/bridges/mcp/index.test.ts` pins the surface, update it.

### `E/orchestrators/mcp/builtin-registration-step.ts` (fill bodies)
**Keep:** header L1-17 (update the "seed" wording), `BuiltinRegistrationStepInput` L22-29, both signatures.
**Analogs:**
- Recorded servers + legacy reader (frozen, call only): `recorded-servers.ts` L46-67 `recordedMcpServers(record, reader)` answers `recorded | re-resolved | unreadable`; L145 `createLegacyServersReader({ marketplaceName, marketplace: Pick<mp, manifestPath|marketplaceRoot|...>, pluginName })`.
- Read-only state load: `orchestrators/marketplace/background-pass.ts:176`
  ```ts
  const state = await loadState(locations.extensionRoot, { persistMigration: false });
  ```
- Containment call style: `orchestrators/plugin/info.ts:314`
  ```ts
  await assertPathInside(marketplaceRoot, pluginRoot, `plugin source for "${source.raw}"`);
  ```
  Per Amendments: inside `mp.marketplaceRoot` (path) OR `locations.pluginClonesDir` (git / pinned). Catch `PathContainmentError` -> `hookDebugLog(..., "mcp")`, skip.
- Debug channel: `hookDebugLog(\`...: ${errorMessage(err)}\`, "mcp")` (recorded-servers.ts L63-65).
- Gate first: `if (input.snapshot.softDeps.mcpImplementation !== "builtin") return;` (MSEL-03), then trust `input.ctx.isProjectTrusted()`.
- `process.env` read here (composition), passed down as `env` (DI rule).
- Loops: `Promise.all` over scopes/records, or `// eslint-disable-next-line no-await-in-loop -- <reason>`; one function per level (cognitive 15 in both ESLint and fallow).
- Enabled filter: `isRecordedButDisabled` from `persistence/state-io.ts` (used in info-mcp-status.ts L469) plus the dependency-disabled check.

### `E/platform/mcp-builtin-status.ts` (fill body)
**Keep:** header L1-19 (MSEL-01: building reads nothing), signature L28-34. Zone `platform` imports `shared` + own zone only: no `domain/name.ts`.
**Analog:** `platform/mcp-status.ts` (adapter reader: `McpStatusReader.lookup` answering `McpServerRuntimeStatus | "unrecognized" | "unlisted" | "no-snapshot"`, L40-60).
Body: RESEARCH Code Examples L787+ and Q3: `getMcpServers()` first (`unlisted` wins, Pitfall 10), then tools whose `namespace.name === "mcp__" + name.replaceAll("-", "_")` read through `"namespace" in tool` narrowing (no cast); any non-`hidden` -> `connected`, all hidden -> `disabled`, none -> `not-connected`.

### `E/orchestrators/plugin/info-mcp-status.ts` (builtin arm)
**Analog:** itself. Status token map L440-460, override set L462-475, stamping L477-500:
```ts
    const answer = reader.lookup(generatedMcpServerKey(plugin, server));
    const status: McpServerStatus =
      answer !== "no-snapshot" && overridden.has(server)
        ? "overridden by project scope"
        : statusToken(answer);
```
- Branch on `lookup.implementation`: adapter/none keep these bytes; builtin uses `profileFor("builtin").serverName(plugin, server)` (never `generatedMcpServerKey`, trailing `_`), stamps names from `record.mcpServerConfigs` (fallback `resources.mcpServers` for legacy, Pitfall 4), precedence: `project not trusted` -> `overridden by mcp.json` -> `overridden by project scope` -> reader.
- Stay synchronous (frozen call in `info.ts`). Update the header comment's "until BLT-05" text.

## Test Patterns

### Strong-mock strict ports (all orchestrator/bridge/platform tests)
**Source:** `test/orchestrators/mcp/builtin-registration-step.test.ts` L1-30
```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify } from "strong-mock";

import { builtinRegistrationStep, resyncBuiltinRegistrations } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts";

import type { ExtensionContext, PiMcpRegistry } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
...
    const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
    ...
    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot }));
    verify(pi);
```
Keep the MSEL-03 cases (adapter / none: no Pi call) and add `when(() => pi.getMcpServers()).thenReturn([...])` cases. Arrange/act/assert comments; titles cite IDs, never phase numbers. Filesystem cases use `withHermeticEnvironment` (`test/platform/hermetic-environment.ts`, used by `test/integration/mcp-variable-expansion.test.ts` L42). Debug output can be captured with `test/platform/debug-log-capture.ts`.

### Row-table domain tests
**Source:** `test/domain/mcp-builtin-features.test.ts` L1-40 (`interface VerdictRow { title; server; verdict }`, `const ROWS: readonly Row[] = [...]`, one `test(row.title, ...)` per row).

### Shared expansion cases
**Source:** `test/bridges/mcp/substitute.test.ts` L1-50 (`FIELD_SHAPES` per `ExpansionField`, imports `EXPANSION_BUILTINS, EXPANSION_CASES` from `./expansion-cases.ts`). The substitute test passes `ADAPTER_FIELD_ENCODER` and keeps every expectation (byte-identity proof); `builtin-escape.test.ts` reuses `EXPANSION_CASES` with built-in expectations.

### Integration conformance (`test/integration/mcp-builtin-*.test.ts`)
**Source:** `test/integration/mcp-variable-expansion.test.ts` L1-40 (header, env save/restore `restoreVariables`, `withHermeticEnvironment`), and the file-URL import helper `test/integration/optional-peer.ts` (`importPeerModule`) / `pi-mcp-adapter-peer.ts` L13-15, L88-92. Import Pi's `node_modules/@earendil-works/pi-coding-agent/dist/core/{resolve-config-value,mcp-servers}.js` by absolute file URL (`pathToFileURL`), declare local interfaces for the functions read (as `PiMcpAdapterUtils` L30 does). Do not import `@earendil-works/pi-mcp`.

## Cucumber Patterns

### Feature tags
**Source:** `features/mcp-server/implementation-profiles.feature` L1-20 (feature description citing IDs; `@own-implementation` on the scenario). Lifted features drop the file-level `@adapter-only` (e.g. `listing.feature` L1); shared scenarios get `@mcp`, pairs get `@adapter-only`/`@builtin-only` with an ID in the title (`scripts/check-features.mjs` enforces).

### Step modules (`features/step_definitions/mcp-server/*.steps.ts`)
**Source:** `lifecycle.steps.ts` L1-27:
```ts
/**
 * @fileoverview Steps about ... (D-08-01, ...).
 */
import assert from "node:assert/strict";
...
import { Given } from "@cucumber/cucumber";

import { writeMcpAdapterOverride } from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given("the user has disabled ...", async function (this: ScenarioWorld, key: string, scope: string) {
  const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
  const written = await writeMcpAdapterOverride(file, key, { disabled: true });
  assert.strictEqual(await readFile(file, "utf8"), written);
});
```
Every `Given` asserts its own effect. Polling steps copy `status.steps.ts` L19-21 constants (`REPORT_TIMEOUT_MS`, `REPORT_POLL_MS`).

### `tool_search` calls step + projector
**Source:** frozen `features/step_definitions/model.steps.ts` L97-105:
```ts
Then("the model receives these calls:", function (this: ScenarioWorld, table: DataTable) {
  const rows = callMessageRows(modelCallsOf(this.requireTurn().logs)).map(([call, role, text]) => [
    call, role, projectCallText(text, this.tokens),
  ]);
  assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
  this.markTurnCompared();
});
```
New step text distinct from the frozen one; reduce `tool_search returned:` text through `features/lib/mcp-builtin-tool-search.ts`, shaped like `features/lib/upstream/index.ts` L12-22 (`RESULT_PROJECTORS` map, throw on unparsable text).

### Config probe extension (observing `getMcpServers()` configs)
**Source:** `features/lib/pi-registry-probe/extension.ts` L13-45 (register a command, `pi.appendEntry(ENTRY, snapshotOf(pi))`, `// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.`) and `snapshot.ts` L14-40 (exported `*_COMMAND`, `*_ENTRY`, `*_EXTENSION = fileURLToPath(new URL("extension.ts", import.meta.url))`, typebox `Compile` validator for the reader).
Loading: the launch list in `world.ts` L885-891 is frozen, but `usePiWithProfile({ companions: [], extraExtensions: [PROBE] })` is open; copy `listing.steps.ts` L119-135 (`pi runs with the scripted model, pi-mcp-adapter, and the environment variable ...`). Note the new `export default` adds one `unused-export` marker to the CONVENTIONS count.

### Earlier-record rewrite lib
**Source:** `features/lib/earlier-version-state.ts` L20-80 (`stateFilePath(scopeRoot)`, `jsonObject`, `readObject`, `objectMember`, read-modify-write of `state.json` with `JSON.stringify(..., null, 2)\n`). Delete `mcpServerConfigs` and `mcpBundle` from one plugin record; reuse `isPlainObject` from `./field-rows.ts`.

### Restart-scoped "no extension error"
`PiProcess.recordsSince(index)` (`features/lib/pi-process.ts:173`) and the `extension_error` record kind (L331); take the index right after the restart step returns.

## Shared Patterns

- **Debug, never notify:** `hookDebugLog(detail, "mcp")` + `errorMessage(err)` (`shared/debug-log.ts`, `shared/errors.ts`); no `ctx.ui.notify`, no console (rule pack). Apply to step, sync, entry.
- **Never throw from session steps (NFR-2):** per-item try/catch (session-materialize.ts L28-35).
- **Pi types only via `platform/pi-api.ts`** (`pi-peer-chokepoint`).
- **`safeSet` for dynamic keys** (`bridges/mcp/safe-set.ts`, substitute.ts L84-95).
- **Containment:** `assertPathInside(parent, child, label)` (`shared/path-safety.ts`); paths from `locationsFor`.
- **Imports order:** builtin, external, internal, parent, sibling, then `import type` last, blank line between groups, `.ts` extensions.
- **Explicit return types on exports; cognitive 15 in both ESLint and fallow; `no-await-in-loop` needs a reasoned disable.**

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| sync `mcp.json` override reader | bridge reader | sync file-I/O | No `readFileSync` in `E/` today; follow `readMcpConfigDoc` parsing steps synchronously |

## Metadata

**Analog search scope:** `E/{bridges/mcp,orchestrators/mcp,orchestrators/plugin,platform,domain}`, `test/{bridges/mcp,orchestrators/mcp,platform,domain,integration}`, `features/{lib,step_definitions,mcp-server,support}`
**Files scanned:** ~45
**Pattern extraction date:** 2026-11-04
