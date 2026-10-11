# Phase 4: Variable expansion at Claude Code parity - Pattern Map

**Mapped:** 2026-10-07
**Files analyzed:** 22 (new + modified)
**Analogs found:** 21 / 22

All paths below are git-tracked; `E` = `extensions/pi-claude-marketplace`.
Zone rule (`.fallowrc.json`): `domain/` imports `shared/` only; `bridges-mcp`
may import `domain/` and `shared/`. So the deny-list and Claude-rule port live
in `domain/`, the adapter serializer in `bridges/mcp/`, and the reserved name
`PI_CLAUDE_MARKETPLACE_EMPTY` in `shared/session-env.ts` (imported by the bridge).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| NEW `E/domain/claude-credential-denylist.ts` | utility (static data snapshot) | transform | `E/domain/components/hook-tool-names.ts`; `E/domain/mcp-server-features.ts` (Claude 2.1.291 pinned table) | role-match |
| NEW `E/domain/claude-mcp-variables.ts` | utility (pure rule port) | transform | `E/bridges/mcp/substitute.ts` (`VAR_RE` + function replacer) | role-match |
| NEW `E/bridges/mcp/adapter-escape.ts` | utility (serializer) | transform | `E/bridges/mcp/substitute.ts` | role-match |
| MOD `E/bridges/mcp/substitute.ts` | utility | transform | itself (rewrite) | exact |
| MOD `E/bridges/mcp/adapter-entry.ts` | utility | transform | itself (`translatedEntry`, `stampServers`) | exact |
| MOD `E/bridges/mcp/stage.ts` | service (stage) | file-I/O | itself (`overrideKeptNotices`) | exact |
| MOD `E/shared/notification-dispatch.ts` | utility (notify seam) | event-driven | itself (`McpOverrideKeptNotice`) | exact |
| MOD `E/domain/mcp-server-features.ts` | model/classifier | transform | itself (`remoteFeature`, `classifyStdio`) | exact |
| MOD `E/domain/resolver-types.ts` | model | — | itself (`DroppedMcpServerSchema`) | exact |
| MOD `E/orchestrators/plugin/info.ts` | service | request-response | itself (`composeMcpEntries`) | exact |
| MOD `E/shared/notification-types.ts` | model | — | `McpServerSummaryEntry` | exact |
| MOD `E/shared/notification-grammar.ts` | utility (renderer) | transform | `appendMcpLine` / `appendRequiresLine` | exact |
| MOD `E/shared/session-env.ts` | utility | event-driven (process env) | `applySessionEnv`, `PATH_LEDGER_ENV` | exact |
| MOD `E/index.ts` | entry/provider | event-driven | existing `session_start` handler | exact |
| NEW `tests/integration/pi-mcp-adapter-peer.ts` (or generalized optional-peer helper) | test support | file-I/O | `tests/integration/pi-subagents-peer.ts` | exact |
| NEW `tests/integration/adapter-expansion-conformance.test.ts` | test (integration) | transform | `tests/integration/provenance-invisibility.test.ts` | exact |
| NEW `tests/bridges/mcp/expansion-cases.ts` | test support (shared case table) | — | `tests/domain/device-flow-contract.ts` (non-test shared module) | partial |
| NEW `tests/domain/claude-credential-denylist.test.ts`, `tests/domain/claude-mcp-variables.test.ts`, `tests/bridges/mcp/adapter-escape.test.ts` | test (unit, paired) | — | `tests/domain/mcp-server-features.test.ts`, `tests/bridges/mcp/substitute.test.ts` | exact |
| MOD `tests/architecture/mcp-config-notices.test.ts` | test (gate) | — | its `CATALOG_NOTICE_ROWS` | exact |
| MOD `tests/architecture/catalog-uat/catalog-contract.test.ts` (+ `fixtures/plugin-info.ts`) | test (gate) | — | itself, lines 39-40 | exact |
| MOD `docs/output-catalog.md` | doc (closed catalog) | — | `mcp-override-kept` block (line ~4212) | exact |
| MOD `.github/workflows/ci.yml` | config (CI) | batch | `integration` job (lines 97-117) | exact |
| MOD `.planning/BACKLOG.md`, `package.json`/lock/README (D-04-17 `<6`) | config/doc | — | — | no code analog needed |

## Pattern Assignments

### `domain/claude-credential-denylist.ts` (new, static snapshot)

**Analog:** `E/domain/components/hook-tool-names.ts` header (lines 1-34): a
file-header comment states the module is "domain-tier static contract -- pure
data, no I/O", cites requirement IDs, and justifies hand-written tables. Copy
that header shape; cite AVAR-05 and the Claude Code version, never `D-04-NN`.
Second analog for the "pinned to Claude 2.1.291, first match in table order"
doc style: `classifyMcpServer` JSDoc in `E/domain/mcp-server-features.ts`
(lines ~322-333).

Shape to produce (per RESEARCH "Where each change lands"):
- `export const CLAUDE_CODE_DENYLIST_VERSION = "2.1.291";`
- frozen `ReadonlySet<string>` of uppercase names; small predicates
  `isPlainDenied(upper)`, `isRemoteSinkDenied(upper, value)` each under
  cognitive 15; verbatim `JA` regexes carry
  `// eslint-disable-next-line sonarjs/regex-complexity -- verbatim Claude Code 2.1.291 ...`.
- No imports (pure leaf), explicit return types on exports.

### `domain/claude-mcp-variables.ts` (new, Claude `oq` rule port)

**Analog:** `E/bridges/mcp/substitute.ts` lines 30-44 -- single global regex
with a function replacer, so a substituted value is never re-scanned:

```ts
const VAR_RE = /\$\{(CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|CLAUDE_PROJECT_DIR)\}/g;

function substituteLeaf(value: string, map: ReadonlyMap<string, string>): string {
  return value.replace(VAR_RE, (whole, name: string) => {
    return map.get(name) ?? whole;
  });
}
```

Replace the grammar with Claude's verbatim
`/\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g`, but emit `Segment[]`
(`text` | `ref`) plus `{missing, blanked}` instead of a string (see RESEARCH
"Pattern: Claude tokenizer" lines 473-501). Env is an injected
`Readonly<Record<string, string | undefined>>` parameter -- never
`process.env` (anti-pattern list, RESEARCH line 537). Imports only the sibling
`./claude-credential-denylist.ts`.

### `bridges/mcp/adapter-escape.ts` (new serializer)

**Analog:** `E/bridges/mcp/substitute.ts` (same file-header style: path
comment line, then a "why bridge-local" paragraph, lines 1-10). Import
`PI_CLAUDE_MARKETPLACE_EMPTY` from `../../shared/session-env.ts` and the
`Segment` type from `../../domain/claude-mcp-variables.ts` (type-only import
last, per import-x/order). Body follows RESEARCH lines 503-531 (merge text,
one-pass trigger regex, guard before refs, `!`->`!!` for secret fields).

### `bridges/mcp/substitute.ts` (rewrite)

Keep: `McpSubstitutionContext` interface (lines 24-28; `projectDir` arm may be
retired per D-04-19 MENV-03 drop -- trace callers), `safeSet` import (line 12),
`isPlainObject` (lines 92-94), and the injection spread order (lines 114-121):

```ts
const injected: Record<string, string> = {
  CLAUDE_PLUGIN_ROOT: ctx.pluginRoot,
  CLAUDE_PLUGIN_DATA: ctx.pluginData,
  ...(ctx.projectDir !== undefined ? { CLAUDE_PROJECT_DIR: ctx.projectDir } : {}), // drop (D-04-19)
};
const declared = isPlainObject(substituted.env) ? substituted.env : {};
return { ...substituted, env: { ...injected, ...declared } };
```

Retire: `deepSubstitute` (lines 52-74) whole-entry walk; replace with an
explicit five-field walk (`command`, `args[]`, `env` values except
`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` keys, `url`, `headers` values).
Return `{ entry, report: { missing: string[]; blanked: string[] } }`.

### `bridges/mcp/adapter-entry.ts`

**Current order** (lines 79-101): `translateMcpServer(substituteAndInject(entry, substitution), description)`.
New order: translate first, then inject + expand per field matrix.
Warning push pattern to reuse (lines 87, 95-97):

```ts
warnings.push(`mcp server "${name}": entry is not an object; staged as an empty entry`);
```

`stampServers` return (lines 208-236) currently `{ stamped, warnings }`;
extend to `{ stamped, warnings, variableReports }` keyed by server name, built
in the same `for (const [name, entry] of Object.entries(input.servers))` loop.

### `bridges/mcp/stage.ts`

**Analog:** `overrideKeptNotices` (lines ~193-216) -- map stamped servers to
notices, push only when non-empty:

```ts
const notices: McpOverrideKeptNotice[] = [];
for (const [server, entry] of Object.entries(stamped)) {
  ...
  if (fields.length > 0) {
    notices.push({ kind: "override-kept", scope, file: "mcp-adapter.json", plugin: pluginName, server, fields });
  }
}
return notices;
```

Add a sibling `variableNotices(variableReports, scope, pluginName)` producing
`variables-missing` / `credentials-blanked` with `names`. Append to the frozen
list at lines 389-392:

```ts
const notices = Object.freeze<McpConfigNotice[]>([
  ...commentsDroppedNotices(config.hadComments, locations.scope),
  ...overrideKeptNotices(stamped, overlays, locations.scope, pluginName),
]);
```

Every staging path already forwards `StageMcpCommitResult.notices` -- no
orchestrator changes needed beyond tests asserting forwarding.

### `shared/notification-dispatch.ts`

**Analog:** `McpOverrideKeptNotice` (lines ~232-239), its line builder
`mcpOverrideKeptLine` (line ~256) and the `warnings` table in
`notifyMcpConfigNotices` (lines ~316-335):

```ts
export interface McpOverrideKeptNotice {
  readonly kind: "override-kept";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly fields: readonly string[];
}
...
const warnings: ReadonlyArray<readonly [summary: string, lines: readonly string[]]> = [
  ["MCP config comments removed.", mcpConfigFileLines(notices, "comments-dropped")],
  ...
];
for (const [summary, lines] of warnings) { const distinct = new Set(lines); if (distinct.size > 0) ctx.ui.notify(...,"warning"); }
```

Add two interfaces with `names: readonly string[]`, widen the
`McpConfigNotice` union, add two `[summary, lines]` rows, and update the JSDoc
order list and catalog-block names. Names only, never values (T9).

### `domain/mcp-server-features.ts` + `domain/resolver-types.ts` (`~` arm, D-04-06/15)

Add literals (e.g. `"command ~"`, `"args ~"`) to `McpUnsupportedFeature`
(lines 20-30). Hook into `classifyStdio` (lines 305-309) the same way
`elicitationFeature` is chained via `featureVerdict`:

```ts
function classifyStdio(server: unknown): McpServerVerdict {
  return STDIO_SERVER.Check(server)
    ? featureVerdict(elicitationFeature(server))
    : malformed(STDIO_SERVER.Errors(server));
}
```

Pattern: a small `homeFeature(server)` returning `McpUnsupportedFeature | undefined`
(raw leading `~`, `~/`, `~\`, or `${VAR:-~...}` default), ordered before
`elicitationFeature`; update the table-order JSDoc. The type-level drift check
forces the matching `Type.TLiteral<...>` additions in `DroppedMcpServerSchema`
(`E/domain/resolver-types.ts` lines 71-87). Rendering is free:
`appendMcpLine` already prints `(unsupported <feature>)`. No new `Reason`, so
`compat-01` / `notify-closed-set-locks` stay untouched.

### `orchestrators/plugin/info.ts` + `shared/notification-types.ts` + `shared/notification-grammar.ts` (D-04-11)

`composeMcpEntries` (info.ts lines 1768-1784) uses conditional spread for an
optional field -- copy for the new name lists:

```ts
.map((entry) => ({
  name: mcpServerDisplayName(pluginName, entry.server),
  ...("feature" in entry && { unsupportedFeature: entry.feature }),
}))
```

Extend `McpServerSummaryEntry` (notification-types.ts line 873) with optional
`readonly unsetVariables?: readonly string[]; readonly blankedVariables?: ...`
(`exactOptionalPropertyTypes`: omit, don't set `undefined`). Render in
`appendMcpLine` (notification-grammar.ts lines 1384-1394) or an
`appendRequiresLine`-style sibling (lines 1402+). Only the resolved arm (call at
line ~1006) gets variables; record arm (line 1716) shows none. Thread `env`
through info deps, defaulting to `process.env` at the edge.

### `shared/session-env.ts` + `index.ts` (D-04-05/09/16/19)

**Constant analog** (session-env.ts line 70):
```ts
export const PATH_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_PATH";
```
Add `export const ADAPTER_EMPTY_ENV = "PI_CLAUDE_MARKETPLACE_EMPTY";` with the
same doc-comment style. **Function analog** (lines 58-60):
```ts
export function applySessionEnv(sessionId: string): void {
  Object.assign(process.env, claudeSessionEnvFor(sessionId));
}
```
New `applyMcpAdapterEnv(cwd: string): void` -- leave `applySessionEnv` at
exactly three keys (its test pins that); skip `CLAUDE_PROJECT_DIR` when cwd
contains `$env:` or `{env:` (D-04-16). The debug-log line must be emitted by
the caller in `index.ts` or via a returned flag, because session-env.ts is a
pure leaf (header lines 10-14); `hookDebugLog(..., "env")` is the house call.

**index.ts wiring** (lines 200-206) -- add the call inside the existing handler,
outside/before the `getSessionId()` try, wrapped for NFR-2:
```ts
pi.on("session_start", (_event, ctx) => {
  try {
    applySessionEnv(ctx.sessionManager.getSessionId());
  } catch (err) {
    hookDebugLog(`session env apply skipped: ${errorMessage(err)}`, "env");
  }
});
```
Also call `applyMcpAdapterEnv(process.cwd())` as the first statement of
`claudeMarketplaceExtension` (line 49-50). Do not register a second
`session_start` handler (`tests/index.test.ts` consumes handlers in order).

### `tests/integration/pi-mcp-adapter-peer.ts` (new)

**Analog:** `tests/integration/pi-subagents-peer.ts` (whole file, 140 lines).
Copy: `readPeer` name check (lines 48-57), `readPeerFloor` from
`package.json` `peerDependencies` via `semver.minVersion` (lines 95-107),
`isBelowPeerFloor` (lines 113-115), file-URL loader (lines 121-129).
**Drop** `globalPackageRoot` / `npm root -g` (lines 59-70, 87-92): the local
global adapter is stale 2.6.1; lookup is `PI_MCP_ADAPTER_ROOT` only. Fallow
dupes threshold 3: prefer generalizing into one helper parameterized by
package name + env var (`tests/integration/optional-peer.ts`) and making both
callers use it, else expect a clone finding.

### `tests/integration/adapter-expansion-conformance.test.ts` (new)

**Analog:** `tests/integration/provenance-invisibility.test.ts` lines 1-60:
header explaining optional-peer skip semantics, then
```ts
const peer = await findPiSubagentsPackage();
if (!peer) { t.skip("pi-subagents is not installed in this environment"); return; }
if (await isBelowPeerFloor(peer.version)) { t.skip(`... below the peer floor ${await readPeerFloor()}`); }
```
Replace the "CI gap" TODO paragraph (lines 25-29) with a statement that CI
runs it (D-04-18). Never feed a single leading `!` to
`resolveCommandSecret`; set/restore any `process.env` mutation in `t.after`.

### Unit tests (paired, 100% direct coverage)

Analogs: `tests/bridges/mcp/substitute.test.ts` (rewrite alongside source),
`tests/domain/mcp-server-features.test.ts` (verdict table cases). Import
order: `node:` builtins, blank line, relative `.ts` imports, type imports
last. Read `skills/typescript-unit-testing/SKILL.md` first.

### `tests/architecture/mcp-config-notices.test.ts`

Add rows to `CATALOG_NOTICE_ROWS` (line 28) matching the existing shape:
```ts
{ state: "mcp-override-kept", notice: { kind: "override-kept", scope: ..., file: "mcp-adapter.json", plugin, server, fields } },
```
The loop at line 59 automatically asserts one warning-severity call and
byte-equality to the catalog block.

### `docs/output-catalog.md` + `catalog-contract.test.ts`

Copy the `mcp-override-kept` block shape (lines ~4212-4226): `### Title (REQ-ID)`,
`<!-- catalog-state: <state> -->`, fenced `text` block, then prose naming the
emitting function, commands, severity, and the locking test. Info-line state
needs a fixture in `tests/architecture/catalog-uat/fixtures/plugin-info.ts`
and bumps `EXPECTED_STATE_COUNT = 265` / `EXPECTED_UTF8_BYTES = 40_571`
(catalog-contract.test.ts lines 39-40). Notice blocks are locked by
mcp-config-notices, not catalog-contract (check whether they still count
toward the state/byte totals -- they live in the same file). Also update the
`{unsupported mcp}` feature-list prose (~line 725). Markdown is formatted by
mdformat, not prettier.

### `.github/workflows/ci.yml` (integration job, lines 97-117)

Existing steps: checkout (`persist-credentials: false`), setup-node 24,
`npm ci --ignore-scripts`, `npm run test:integration`. Insert before the last
step, zizmor-clean (pinned version, no `${{ }}` inside `run`):
```yaml
      - name: Install the pinned pi-mcp-adapter peer
        run: npm install --prefix "$RUNNER_TEMP/pi-mcp-adapter" pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer --no-audit --no-fund

      - name: Run the integration tests
        env:
          PI_MCP_ADAPTER_ROOT: ${{ runner.temp }}/pi-mcp-adapter/node_modules/pi-mcp-adapter
        run: npm run test:integration
```
Consider the 10-minute job timeout.

## Shared Patterns

- **Notices, not warning strings:** structured `McpConfigNotice` -> stage
  result `notices` -> `notifyMcpConfigNotices` (`E/shared/notification-dispatch.ts`).
  Apply to both new warning kinds.
- **Typed closed unions + drift checks:** any new `McpUnsupportedFeature`
  literal requires the matching TypeBox literal in `resolver-types.ts`.
- **Injected dependencies over globals:** env map passed as a parameter in
  domain and info code; only `index.ts`/`session-env.ts` touch `process.env`.
- **NFR-2 boundary:** every `session_start`/factory side effect wrapped so a
  throw never escapes; failures go to `hookDebugLog(..., "env")`.
- **Comments:** cite AVAR-0N / MENV-0N, never `D-04-NN` or phase numbers.
- **Complexity:** cognitive <= 15 under both sonarjs and fallow; keep new
  logic out of `substitute.ts`/`adapter-entry.ts` beyond wiring.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `bridges/mcp/adapter-escape.ts` core algorithm | serializer | No adapter-encoding code exists; use RESEARCH lines 503-531 (probe-verified). Only file-shape conventions come from `substitute.ts`. |

## Metadata

**Analog search scope:** `E/bridges/mcp`, `E/domain`, `E/shared`, `E/orchestrators/plugin/info.ts`, `E/index.ts`, `tests/integration`, `tests/architecture`, `docs/output-catalog.md`, `.github/workflows/ci.yml`
**Files scanned:** ~18
**Pattern extraction date:** 2026-10-07
