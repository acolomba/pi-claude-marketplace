# Phase 3: Claude Code tool names and tool search - Pattern Map

**Mapped:** 2026-10-06
**Files analyzed:** 20 (new + modified, from 03-CONTEXT.md and 03-RESEARCH.md "Recommended module layout")
**Analogs found:** 19 / 20

All paths are relative to `extensions/pi-claude-marketplace/` unless they start with `tests/` or `docs/`. All analogs are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `domain/name.ts` (+ `generatedMcpServerKey`, `mcpServerDisplayName`, fold helper) | utility | transform | `domain/name.ts::generatedAgentName` (lines 175-188) | exact |
| `domain/mcp-server-features.ts` (NEW, closed field table + `classifyMcpServer`) | utility (pure domain) | transform | `domain/hooks-resolution.ts` + `domain/components/hooks/matcher.ts` | role-match |
| `domain/mcp-resolution.ts` (classify; `droppedMcpServers`; push `"mcpServers"` into `unsupported`; malformed -> `{malformed mcp}`) | service (resolver) | transform | `domain/hooks-resolution.ts::recordHooksConfig` (lines 144-155) | exact |
| `domain/resolver-types.ts` (+ `droppedMcpServers?`, `description?`) | model | — | `DroppedHook` / `droppedHooks` in same file | exact |
| `domain/plugin-resolver.ts` (`materializableFields` spread; description plumbing) | service | transform | own `droppedHooks` spread (~line 147); `decideResolution` (660) unchanged | exact |
| `domain/components/hooks/matcher.ts` (+ server-prefix kind) | utility | transform | own `isMcpLiteral` (lines 16-31); `bridges/hooks/if-field/index.ts` `mcp-server-prefix` (93-115, 207-221, 276) | exact |
| `domain/components/hooks/partition.ts` (new kind is supported) | utility | transform | own handling of `tool-set` | exact |
| `bridges/hooks/dispatch.ts` (+ switch arm) | service | event-driven | own `matcherFiresOnToolEvent` (113-123) | exact |
| `bridges/mcp/adapter-entry.ts` (closed translation, ownership of `directTools`/`toolPrefix`/`description`, plugin-set carried fields) | service | transform | own `CARRIED_FIELDS` / `translatedEntry` / `stampServers` | exact |
| `bridges/mcp/translate.ts` (OPTIONAL split if fallow unit size demands) | utility | transform | `bridges/mcp/substitute.ts` | role-match |
| `bridges/mcp/marker.ts` (+ plugin-set field names array) | model | — | own `keptOverride` optional member + tolerant `readMarker` | exact |
| `bridges/mcp/adapter-doc.ts` (`restoredOverride` call site) | service | file-I/O | own `survivingEntry` | exact |
| `bridges/mcp/stage.ts` (keys via builder; D-03-12/13 checks) | service | file-I/O | own `otherDeclarers` / `assertNoMcpCollisions` (80-105) | exact |
| `bridges/mcp/collision-slots.ts` (folded index) | utility | file-I/O | own `walkMcpSources` | exact |
| `shared/errors-bridges.ts` (+ `McpServerKeyCollisionError`) | model (error) | — | `McpServerCollisionError` (lines 59-72) | exact |
| `bridges/agents/convert.ts` (`mcp__` -> `mcp:` mapping, async warning) | service | transform | own `TOOL_MAP` (54-62), `mapToolTokens`, `mapTools` (209+) | exact |
| `shared/probe-classifiers.ts` (`"unsupported mcp"`; `kindToReason("mcpServers")`) | utility | transform | own `kindToReason` hooks arm (203-213) | exact |
| `shared/notification-types.ts`, `shared/notify-reasons.ts` (Reason += `"unsupported mcp"`) | model | — | `"unsupported hooks"` member | exact |
| `orchestrators/plugin/info.ts`, `install.messaging.ts`, `list-flow.ts` (display `plugin:<p>:<s>`, per-server breakdown, widened reason unions) | controller (orchestrator) | request-response | `info.ts::composeResolvedComponents` (~1001) + hooks breakdown; `install.messaging.ts:264`, `list-flow.ts:575` | exact |
| `orchestrators/plugin/install-outcome.ts` / `update-swap.ts` / `reinstall-replace.ts` (pass written server set to agents stage; `declaredName` on `StagedMcpRecord`) | controller | request-response | own call sites 855 / 304 / 431; `install-outcome.ts:975` | exact |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat/*` fixtures | config (doc contract) | — | `{unsupported hooks}` rows (~147, ~492-497) | exact |
| `tests/architecture/notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts` | test (gate) | — | existing `REASON_ENROLLMENT` (count 65 -> 66, line 196), `EXPECTED_REASONS` | exact |
| README "Customizing generated agents" + ANAME-05 lifecycle divergence doc | doc | — | none in code | no analog (prose) |

## Pattern Assignments

### `domain/name.ts` (utility, transform)

**Analog:** `domain/name.ts` lines 175-188
```ts
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const generated = `pi-claude-marketplace-${plugin}-${source}`;
  assertSafeName(generated);
  return generated;
}
```
Apply: `generatedMcpServerKey(plugin, server)` = `` `plugin:${plugin}:${server}`.replace(/[^A-Za-z0-9_-]/g, "_") + "_" `` (the ONLY copy of the normalization regex in the repo -- research Anti-Pattern "Two normalizers"). Note: server names may contain characters `assertSafeName` rejects; assert only `plugin`, not the declared server (verify against current `mcpServers` key acceptance before adding an assert). Add `foldMcpKey(key) = key.replace(/-/g, "_")` and `mcpServerDisplayName(plugin, server) = \`plugin:${plugin}:${server}\``. Doc comment cites ANAME-01 / ANAME-03, not D-03-NN.

**Tests:** extend `tests/domain/name.test.ts` (plain, hyphenated, dotted, colon-bearing names).

---

### `domain/mcp-resolution.ts` + `domain/resolver-types.ts` + `domain/plugin-resolver.ts` (resolver, transform)

**Analog:** `domain/hooks-resolution.ts` lines 144-155
```ts
function recordHooksConfig(resolution: HooksResolution, hooks: ResolvedHooksConfig): void {
  if (hooks.dropped.length > 0) {
    resolution.unsupported.push("hooks");
    resolution.droppedHooks = [...hooks.dropped];
  }

  if (Object.keys(hooks.value).length > 0) {
    resolution.supported.push("hooks");
    ...
```
Apply: classify each server via the new pure module; keep supported servers in `mcpServers`; set `droppedMcpServers: {server, feature}[]`; push `"mcpServers"` into `unsupported` ONCE (kind string on the `lspServers` precedent). Malformed (D-03-18: unknown `type`, `url` without `type`, invalid `timeout`/`callbackPort`) takes the existing `{malformed mcp}` path the broken `mcpServers` reference uses today -> `unavailable` (see `narrowResolverNotes` in `shared/probe-classifiers.ts`, which already maps malformed-MCP notes). `decideResolution` (plugin-resolver.ts:660), `requireInstallable` (687) and `requirePartialInstallable` (735) need no change. `compatibility.unsupported` is free strings (`persistence/state-io.ts:135`), so no schema change. `partially-installed` derives automatically (`plugin-state-classifier.ts:146-153`).

`resolver-types.ts`: mirror the `DroppedHook` type + `droppedHooks?` member and its drift checks.

**Tests:** `tests/domain/hooks-resolution.test.ts` is the structural template for new `tests/domain/mcp-server-features.test.ts` and extensions to `tests/domain/mcp-resolution.test.ts` / `tests/domain/plugin-resolver.test.ts` (description fallback plugin.json -> marketplace entry -> omitted).

---

### `domain/mcp-server-features.ts` (NEW, pure)

**Analog:** `domain/components/hooks/matcher.ts` (module-level `const` regexes, closed lookup maps, small pure functions returning a discriminated union) -- see `ParsedMatcher` union lines 10-14. Return shape suggestion: `{ kind: "supported" } | { kind: "unsupported"; feature: string } | { kind: "malformed"; detail: string }`. Zone: `domain` imports `shared` only. Not a `NETWORK_SEAMS` member. Feature list = D-03-10 + D-03-20 (`ws`, `headersHelper`, `oauth.xaa`, `tools[].permission_policy`, `toolPermissions`, `bareElicitationCapability: true`, `sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy`). Silent drops: `cwd`, `role`, `discoveryCache`, unknown keys.

---

### `domain/components/hooks/matcher.ts` (utility, transform)

**Analog:** own `isMcpLiteral` lines 16-31:
```ts
function isMcpLiteral(raw: string): boolean {
  if (!raw.startsWith("mcp__")) {
    return false;
  }
  const body = raw.slice("mcp__".length);
  const separatorIndex = body.lastIndexOf("__");
  if (separatorIndex <= 0 || separatorIndex >= body.length - 2) {
    return false;
  }
  return (
    MCP_SEGMENT.test(body.slice(0, separatorIndex)) &&
    MCP_SEGMENT.test(body.slice(separatorIndex + 2))
  );
}
```
Apply: add `isMcpServerPrefix(token)` (starts `mcp__`, ends `__.*`, middle passes `MCP_SEGMENT`; string ops only). Critical ordering: `parseMatcher` rejects via `SAFE_MATCHER_CHARS` (line ~51) BEFORE the per-alternative loop, and `.*` fails that regex -- so the check must run per alternative before/instead of the whole-string reject (D-03-21: accepted inside pipe matchers, per-alternative degradation #217). Extend `ParsedMatcher` with either a prefix list on `tool-set` or a new kind; keep `regex` for everything else (MATCH-02). Reuse split style from `bridges/hooks/if-field/index.ts` `mcp-server-prefix` (93-115, 207-221, 276).

**Tests:** `tests/domain/components/hooks/matcher.test.ts`, `tests/domain/components/hooks/partition.test.ts`.

### `bridges/hooks/dispatch.ts` (event-driven)

**Analog:** own lines 113-123:
```ts
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return matcher.toolNames.has(toolName);
    case "regex":
    case "unmapped":
      return false;
  }
}
```
Add arm `toolName.startsWith(prefix)` (exhaustive switch; TS7030 if missing). Tests: `tests/bridges/hooks/dispatch.test.ts` (fires on `mcp__plugin_p_s__t`, not `mcp__plugin_p_s2__t` nor `mcp`); `tests/bridges/hooks/if-field/index.test.ts` proof-only cases.

---

### `bridges/mcp/adapter-entry.ts` (transform)

**Analog:** own lines 1-60. Header convention (path comment + rationale paragraph citing requirement IDs), imports:
```ts
import { CLAUDE_MARKETPLACE_MARKER_KEY, buildMarker } from "./marker.ts";
import { safeSet } from "./safe-set.ts";
import { substituteAndInject, type McpSubstitutionContext } from "./substitute.ts";
```
Carried-field constant pattern:
```ts
const CARRIED_FIELDS = [
  "disabled", "approveTools", "includeTools", "excludeTools", "lifecycle",
  "idleTimeout", "requestTimeoutMs", "debug", "searchKeywords",
] as const;
const CARRIED_FIELD_SET: ReadonlySet<string> = new Set(CARRIED_FIELDS);
```
Apply: replace whole-entry pass-through in `translatedEntry` with a closed field table (import the table/classifier from `domain/mcp-server-features.ts` rather than duplicating it). Owned fields always rewritten: `toolPrefix: "mcp"`, `directTools: "search" | true` (alwaysLoad), `description`. Plugin-set carried fields (D-03-04): carry-forward skips them; record their names in the marker (D-03-05); `inactiveOverrideFields` returns them for the D-03-06 warning. Keep `substituteAndInject` behavior unchanged (Phase 4 narrows it). Use `safeSet` for writes (prototype-safe). Add `StampServersInput.description?`. Watch cognitive 15 (sonarjs and fallow both) -- split into `bridges/mcp/translate.ts` if needed.

**Tests:** `tests/bridges/mcp/adapter-entry.test.ts` -- reuse its vendored-adapter-facts pattern (`SERVER_ENTRY_KEYS`, provenance comment, dist.shasum `6c20461d658ec7d7b7e303b067e2ff13a7846d00` floor-tie) for the security test that every adapter-only key is absent from output.

### `bridges/mcp/marker.ts` (model)

**Analog:** own `keptOverride` member (lines 17-27):
```ts
export interface ClaudeMarketplaceMarker {
  readonly plugin: string;
  readonly marketplace: string;
  readonly keptOverride?: Readonly<Record<string, unknown>>;
}
```
Add an optional `readonly string[]` member (name at discretion, e.g. `pluginSetFields`), parsed tolerantly in `readMarker` the same way `keptOverride` is (invalid -> parse without it, never throw). Marker key `_piClaudeMarketplace` is user contract, unchanged. Test: `tests/bridges/mcp/marker.test.ts`.

### `bridges/mcp/adapter-doc.ts`

`restoredOverride(kept, live)`: restore `kept[field]` when `live`'s marker lists `field` as plugin-set, else the D-02-22/23 live-value rule. `survivingEntry` call site needs no new parameter. Test: `tests/bridges/mcp/adapter-doc.test.ts`.

### `bridges/mcp/stage.ts` + `collision-slots.ts` (file-I/O)

**Analog:** own `otherDeclarers` lines 86-100:
```ts
const declarers = (walk.declarations.get(name) ?? [])
  .filter(
    (declaration) =>
      declaration.sourcePath !== check.targetPath &&
      !isOwnedBy(declaration.entry, check.pluginName, check.marketplaceName),
  )
  .map((declaration) => declaration.sourcePath);
return Object.hasOwn(check.theirs, name) ? [...declarers, check.targetPath] : declarers;
```
Apply: compute keys first (Pitfall 2: `newNames = Object.keys(servers)` at stage.ts:226 feeds collision walk, `ours`/`theirs`, `recorded`, notices -- switch them ALL to keys). Same-plugin clash (equal or folded) throws before `readTargetConfig`. Cross-source: lookup by folded key (folded index in `walkMcpSources` or at the check), keep the `isOwnedBy` self-exemption, fold the `theirs` check too. Tests: `tests/bridges/mcp/stage.test.ts` (file bytes unchanged on refusal), `tests/bridges/mcp/collision-slots.test.ts`.

### `shared/errors-bridges.ts` (+ `McpServerKeyCollisionError`)

**Analog:** lines 59-72:
```ts
export class McpServerCollisionError extends Error {
  readonly serverName: string;
  readonly owningPath: string;
  readonly winningPath: string;
  constructor(serverName: string, owningPath: string, winningPath: string) {
    super(`Refusing to stage MCP server "${serverName}": ...`);
    this.name = "McpServerCollisionError";
    ...
  }
}
```
Sibling class with `plugin`, `servers: readonly [string, string]`, `key`. Callers discriminate via `instanceof`. Check where `McpServerCollisionError` is caught in orchestrators/messaging and add the sibling there.

---

### `bridges/agents/convert.ts` (transform)

**Analog:** own `TOOL_MAP` (54-62) and `mapTools` (209+):
```ts
const TOOL_MAP: Readonly<Record<string, string>> = Object.freeze({
  Read: "read", Bash: "bash", Edit: "edit", Write: "write",
  Grep: "grep", Glob: "find", LS: "ls",
});
...
function mapTools(rawTools: string | undefined, rawDisallowed: string | undefined): ToolMappingResult {
  const disallowedTokens = splitCsv(rawDisallowed);
  const disallowedPi: string[] = [];
  for (const token of disallowedTokens) {
    const piName = TOOL_MAP[token];
    if (piName !== undefined) { disallowedPi.push(piName); }
  }
  ...
  const { mapped, dropped } = mapToolTokens(tokens);
```
Apply: thread a `writtenServers: ReadonlySet<string>` (declared names after D-03-10 drops) into `mapTools`/`mapToolTokens`; map `mcp__plugin_<p>_<s>__<tool>` -> `mcp:<key>/<tool>`, `mcp__plugin_<p>_<s>` and `mcp__plugin_<p>_<s>__*` -> `mcp:<key>`, build `<key>` with `domain/name.ts::generatedMcpServerKey` (agents bridge may import domain; must NOT import `bridges/mcp` -- fallow zones). Others keep the existing drop warning. Add conversion warning (D-03-19) when any `mcp:` entry was produced, using the existing warnings channel in this file. Callers: `orchestrators/plugin/install-outcome.ts:855`, `update-swap.ts:304`, `reinstall-replace.ts:431` -- derive from `resolved.mcpServers` (agents phase runs before MCP phase). Test: `tests/bridges/agents/convert.test.ts`.

---

### `shared/probe-classifiers.ts`, `notification-types.ts`, `notify-reasons.ts`

**Analog:** `kindToReason` (probe-classifiers.ts:203-213):
```ts
function kindToReason(kind: string): UnsupportedReason {
  if (kind === "lspServers") { return "lsp"; }
  if (kind === "hooks") { return "unsupported hooks"; }
  return "unsupported component";
}
```
and `export type UnsupportedReason = "unsupported hooks" | "lsp" | "unsupported source" | "unsupported component";` (line 76-77). Add `"mcpServers"` -> `"unsupported mcp"`. `Reason` in `notification-types.ts`: append at tail (catalog order). `notify-reasons.ts` private `UnsupportedReason` partition (~104). Update the module header comment that enumerates the mappings.

### Orchestrators: `info.ts`, `install.messaging.ts`, `list-flow.ts`

`info.ts::composeResolvedComponents` lists `Object.keys(resolved.mcpServers)` (~1001); state-only arm `sortComponentNames(record.resources.mcpServers)` (~1702) -- BOTH must render `mcpServerDisplayName` (Pitfall 5). Per-server breakdown copies the hooks dropped-handler breakdown in the same file (PHOOK-04). `components.mcp` becomes `{ name, unsupported? }[]` (Phase 6 reuses it). Widen local reason unions at `install.messaging.ts:264`, `list-flow.ts:575`. Renderer stays dumb: orchestrator composes names.

### Record names (D-03-16)

Keep declared names in `record.resources.mcpServers`; add `declaredName` to `StagedMcpRecord` (`bridges/mcp/types.ts:46`, currently documented "== input key"). Map unstage results back in `orchestrators/marketplace/shared.ts:452,499` and filters at `orchestrators/plugin/shared.ts:1368`, `orchestrators/marketplace/remove.ts:409` (match key OR raw name for legacy entries). Readers: `install-outcome.ts:975`, `update-swap.ts:698,1442`.

## Shared Patterns

### Closed-catalog token amendment
**Source:** `{unsupported hooks}` across `docs/output-catalog.md` (~147, ~492-497), `tests/architecture/notify-closed-set-locks.test.ts` (`REASON_ENROLLMENT`, count assertion line 196: 65 -> 66), `tests/architecture/compat-01-no-expansion.test.ts` (`EXPECTED_REASONS`), `tests/architecture/catalog-uat/catalog-contract.test.ts` (byte-equality fixtures).
**Apply to:** `"unsupported mcp"` reason, `plugin:<p>:<s>` display, new collision error text, D-03-19 agent warning.

### Typed errors
`extends Error`, `this.name = "<Class>"`, readonly structured fields, `instanceof` only (`shared/errors-bridges.ts`).

### Comments
Cite ANAME-0N / MATCH-02 / AFILE-06 style IDs; never `D-03-NN`, phase or plan numbers (CONTEXT note; memory "source comment cleanup policy").

### Complexity / boundaries
sonarjs + fallow cognitive 15 independently; `domain` -> `shared` only; no bridge-to-bridge imports; new domain module stays out of `NETWORK_SEAMS`; new src file needs paired test with 100% direct coverage.

### Test structure
`node:test` + `node:assert/strict`, relative `.ts` imports, type imports last; vendored adapter facts with provenance (pattern in `tests/bridges/mcp/adapter-entry.test.ts`), never import pi-mcp-adapter.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| README "Customizing generated agents" async note + ANAME-05 lifecycle / tool-search-off-by-default / provider length limits docs | doc | Prose only; use RESEARCH.md "Measurement record", E7 and "Tool search and hooks" sections |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,bridges/mcp,bridges/hooks,bridges/agents,shared,orchestrators/plugin}`, `tests/architecture`
**Files scanned:** ~14
**Pattern extraction date:** 2026-10-06
