---
phase: 09-adapter-entries-and-mcp-features
iteration: 1
reviewed: 2026-11-14T21:53:52Z
depth: deep
files_reviewed: 37
files_reviewed_list:
  - CHANGELOG.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - features/lib/hook-mcp-tool-server.ts
  - features/lib/mcp-implementation.ts
  - features/lib/mcp-server-files.ts
  - features/lib/mcp-stub-server.ts
  - features/mcp-server/companion-missing.feature
  - features/mcp-server/configuration.feature
  - features/mcp-server/invocation.feature
  - features/mcp-server/legacy-move.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/project-scope.feature
  - features/mcp-server/resources.feature
  - features/plugin/subagent-child.feature
  - features/step_definitions/hook/tool-use.steps.ts
  - features/step_definitions/mcp-server/lifecycle.steps.ts
  - features/step_definitions/mcp-server/listing.steps.ts
  - features/step_definitions/mcp-server/resources.steps.ts
  - features/step_definitions/mcp-server/verdict-settings.steps.ts
  - test/architecture/integration-materialization-gate.test.ts
  - test/bridges/mcp/adapter-entry.test.ts
  - test/bridges/mcp/marker.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/domain/mcp-server-features.test.ts
  - test/integration/mcp-home-path-partial.test.ts
  - test/integration/mcp-legacy-sweep.test.ts
  - test/integration/mcp-override-lifecycle.test.ts
  - test/integration/mcp-variable-expansion.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
  necessity: 1
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-11-14T21:53:52Z
**Depth:** deep
**Iteration:** 1
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Scope: `git diff --name-only deaa35c4..d987142a | grep -v '^.planning/'` in the `features/gaps-mcp` worktree. Intent was read from 09-CONTEXT.md (including the D-PG9-07 amendment). Each claim was checked against the installed pi-mcp-adapter 7.0.1 and pi-subagents 0.88.1 under `node_modules/.cache/optional-peers/node_modules/`, against Pi 1.5.0, and against the Claude Code 2.1.323 binary.

What holds up:

- **Hash claim.** For every field this phase writes or carries, the hashes agree. pi-mcp-adapter 7.0.1 `computeServerHash` (`metadata-cache.ts:143-178`) and pi-subagents 0.88.1 `computeMcpServerHash` (`src/runs/shared/mcp-direct-tool-allowlist.js:381-412`, and the same in `bundle/chunk-D32H53HM.js`) both hash `protocolVersion` and `exposeResources`. Neither hashes `lifecycle`, `tasks`, or `caFile`. Both sort keys through `stableStringify`. `openUi` is the only asymmetric field, and the D-PG9-07 amendment correctly withholds it.
- **Marker parsing.** `isDefaultRecord` reads own members only. A JSON `__proto__` key holding an object is rejected. A `__proto__` key holding a scalar is harmless, because `isRecordedDefault` looks up only `CARRIED_FIELDS` names through `Object.hasOwn`.
- **`defaultFields` precedence.** Recording and recompute (D-PG9-03) are correct for the plugin, user, and default precedence. The leaving-choice store (`adapter-doc.ts:510-520`) correctly excludes recorded defaults through `userCarriedFields`.
- **Tests.** The targeted owner tests pass: 294 tests in `adapter-entry`, `marker`, and `mcp-server-features`, run in a hermetic `HOME`.

The defects are in how the new carried fields and the lifecycle default interact with pi-mcp-adapter's real semantics:

- A carried `caFile` breaks a server whose transport changes.
- The `lazy-keep-alive` default silently overrides a user's `idleTimeout`, and the docs misstate this.
- Keep-alive health checks bring in an upstream divergence (background respawn of a stdio server) that has no decision ID.

## Critical Issues

### CR-01: A carried `caFile` makes pi-mcp-adapter refuse a plugin server whose update changes it to stdio or to plain http

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:58-76, 235-256`
**Issue:** D-PG9-05 adds `caFile` to `CARRIED_FIELDS`, and `carriedFields` copies it whatever the new translated entry's transport is. pi-mcp-adapter 7.0.1 calls `validateCaFile(definition)` at the start of every `connect` and `reconnect` (`server-manager.ts:576`, `:672`). That function throws `"MCP caFile is only supported for HTTPS HTTP servers"` when the entry has `command` or `socket`, or when the url is not `https:` (`http-ca.ts:9-18`). A probe of `stampServers` confirms the problem. Take a previous entry `{url: "https://a.example/mcp", caFile: "/ca.pem", ...}`. A plugin update to `{command: "node"}` writes `{"command":"node",...,"caFile":"/ca.pem","lifecycle":"lazy-keep-alive",...}`. An update to `http://plain.example/mcp` keeps `caFile` too. Either way, the plugin's server can no longer connect at all, and no warning is given (`warnings: []`).

The adapter's own merge rule shows that it treats `caFile` as bound to its transport and url:

- `mergeServerMaps` deletes `caFile` when a definition switches to `command` or `socket` (`config.ts:1103-1124`).
- It lists `caFile` in `URL_BOUND_AUTH_FIELDS` and `CREDENTIAL_FIELDS`, which it drops when the url changes (`config.ts:1070-1081`).

So two statements are wrong against the source they cite: "None of the four holds a credential" (`docs/mcp-compatibility.md:381`), and "No credential-bearing field is in the set" (`adapter-entry.ts:49-51`). D-PG9-05 covered only the certificate-mismatch case ("a mismatch refuses the connection"), not the transport change. The scenarios (`lifecycle.feature`, the two D-PG9-05 scenarios) use an https-to-https url change only.
**Fix:** Carry `caFile` only when the new translated entry is an https remote. At minimum, drop it when the entry gains `command` or `socket`, or when its url is not `https:`. Consider also matching the adapter's url binding: drop it when the origin changes, and report the drop as a stage warning (the `warnings` array already exists). For example, in `stampServers` after `carriedFields`:

```ts
const carried = withoutStrandedCaFile(carriedFields(input.previous[name], pluginSetFields), translated, warnings, name);

function withoutStrandedCaFile(carried, translated, warnings, name) {
  if (!Object.hasOwn(carried, "caFile")) return carried;
  const url = translated.url;
  const https = typeof url === "string" && translated.command === undefined && /^https:/i.test(url);
  if (https) return carried;
  const { caFile: _dropped, ...rest } = carried;
  warnings.push(`mcp server "${name}": your caFile applies only to an https server; it was not kept`);
  return rest;
}
```

Add a unit case for remote-to-stdio and https-to-http, and correct the two "no credential" statements.

## Warnings

### WR-01: The `lazy-keep-alive` default voids a user's `idleTimeout` and the global `settings.idleTimeout`, and the docs claim the opposite

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:335-349`; `docs/mcp-compatibility.md:145`
**Issue:** `defaultFieldsFor` writes `lifecycle: "lazy-keep-alive"` whenever the user carried no `lifecycle`, even when the user carried `idleTimeout`, a lifetime choice of their own. In pi-mcp-adapter 7.0.1, `markKeepAliveAfterConnect` puts a `lazy-keep-alive` server into `keepAliveServers` after its first connection (`init.ts:680-685`, `:522`). From then on, `checkConnections` skips every keep-alive server before it reads any idle timeout: `if (this.keepAliveServers.has(name)) continue;` (`lifecycle.ts:146`). The adapter's own docs agree: "Once spawned, never idle-shut down" (`docs/configuration.md:135`). This has three consequences:

1. A user who wrote `idleTimeout: 5` on a plugin stdio entry gets the extension's default lifecycle at the next reinstall or update, and their carried `idleTimeout` silently stops working. That contradicts the user-wins rule that D-PG9-03 states.
2. `docs/mcp-compatibility.md:145` says that "the adapter gives it no idle time unless the entry sets `idleTimeout`". That is false in 7.0.1, because an entry `idleTimeout` does not stop a lazy-keep-alive server after it starts. The text tells users that a remedy works when it does not.
3. D-PG9-02 says that "a per-entry value overrides nothing the user set elsewhere". But `lazy-keep-alive` also overrides the global `settings.idleTimeout` (`init.ts:1032-1034`, `lifecycle.ts:413-416`), and neither the decision nor the CHANGELOG says so.

**Fix:** Treat a carried `idleTimeout` as the user's lifetime choice. In `defaultFieldsFor`, skip the `lifecycle` default when `Object.hasOwn(carried, "idleTimeout")`, and add a unit case and a scenario. Correct `docs/mcp-compatibility.md:145`: "After the start the server stays running for the session; an `idleTimeout` on the entry does not stop it (`lifecycle.ts`). To let it stop when idle, set `lifecycle: "lazy"` yourself." Note in D-PG9-02 that the global `settings.idleTimeout` no longer applies to plugin stdio servers.

### WR-02: Keep-alive health checks respawn a crashed stdio plugin server in the background, an upstream divergence with no decision ID

**File:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts:83-86`; `docs/mcp-compatibility.md:143-151, 656`
**Issue:** `lazy-keep-alive` does more than keep the connection. After the first connection, pi-mcp-adapter puts the server under the keep-alive health checks. `checkKeepAliveConnection` (`lifecycle.ts:165-211`) reconnects, which means it respawns, any keep-alive server whose connection is not `connected`, stdio included, with bounded backoff. Claude Code marks a failed stdio server as failed and leaves the reconnect to the user (U25, `docs/research/parity-gaps/mcp.md:81`, `UP/mcp.md:384-415`). D-PG9-01's premise covers only start time and staying connected. Neither it, the "Places where the products differ" list (`docs/mcp-compatibility.md:656`), nor the CHANGELOG records that a crashing plugin stdio server is now restarted repeatedly with no use. The project constraint requires a decision ID or a recorded Pi capability gap for every user-visible divergence.
**Fix:** Record the divergence. Either extend D-PG9-01, or add a decision row that states the respawn behavior and the reason (the adapter has no keep-without-reconnect mode). Add it to the differences list in `docs/mcp-compatibility.md:656` with its source line (`lifecycle.ts`), or put it to the maintainer as part of the pending D-PG9-01 review.

### WR-03: Phantom requirement — the release-0.23.0 fixture deletes an `openUi` default that no release ever wrote

**File:** `features/lib/mcp-server-files.ts:336-355`
**Category:** necessity
**Issue:** `writeRelease0230McpAdapterEntry` says that 0.23.0 "predates the request timeout, `lifecycle`, and `openUi` defaults", and it runs `delete entry.openUi`. No `openUi` default exists. D-PG9-07 was amended to withhold it. `adapterEntryDefaults` never emits it, and `test/domain/mcp-server-features.test.ts` ("D-PG9-07: no transport's defaults hold openUi") proves that. The entry this helper starts from is the current release's install output, which holds `openUi` only when a user wrote it. So the deletion defends against a state that cannot occur, and the comment names a default that does not exist. A future scenario that writes a user `openUi` before calling this helper would also lose it without notice.
**Fix:** Remove `delete entry.openUi;` and drop "and `openUi`" from the doc comment.

### WR-04: The docs present `openUi: false` as the user's way out without saying that it breaks agent MCP grants

**File:** `docs/mcp-compatibility.md:172, 658`
**Issue:** Both passages say that the adapter declares the MCP Apps UI extension "unless you set `openUi: false` on its entry". They also say that an `openUi: false` default makes pi-subagents 0.88.1 read the adapter's tool cache as stale, so an agent with a plugin MCP grant does not launch. The same failure follows from a user-written `openUi: false`, because `computeServerHash` hashes the field whoever writes it (`metadata-cache.ts:173-174`), and `computeMcpServerHash` never hashes it. The page offers a setting as the user's remedy and leaves out its known breakage.
**Fix:** After "unless you set `openUi: false`", add: "Under pi-subagents 0.88.1, an entry with `openUi: false` also stops every agent granted one of the server's tools from launching (D-CF6-10), so set it only on a server no agent is granted."

## Info

### IN-01: A single malformed `defaultFields` member turns every recorded default into a user value, permanently

**File:** `extensions/pi-claude-marketplace/bridges/mcp/marker.ts:64-66, 103`
**Issue:** `isDefaultRecord` is all-or-nothing. If one member is not a scalar (`{requestTimeoutMs: 1800000, lifecycle: "lazy-keep-alive", x: null}`), the whole record is dropped. `carriedFields` then carries both defaults as the user's. `defaultFieldsFor` writes no default the user "holds", so the next marker records none, and the defaults stay as user values forever. The behavior was the same before for the numbers-only record. The widening makes it cover `lifecycle` too.
**Fix:** Either keep the scalar members (filter rather than reject), or fail closed with a stage warning, as the project's corrupt-data rule prefers. Do not silently reclassify.

### IN-02: CHANGELOG omits the project-server re-approval that the lifecycle default triggers

**File:** `CHANGELOG.md:19`
**Issue:** The bullet tells adapter users to run `/claude:plugin reinstall`. The `lifecycle` and `defaultFields` change alters a project entry, and pi-mcp-adapter computes each approval from the whole entry (`project-server-trust.ts:101-102`). So an approved project server asks again, and a headless session blocks it. The docs say this (`docs/mcp-compatibility.md:183`), but the CHANGELOG mentions re-approval only for the timeout (`CHANGELOG.md:10`).
**Fix:** Extend line 10 or line 19: "pi-mcp-adapter asks for project server approval again after this reinstall."

### IN-03: The `exposeResources` cell cites `init.ts` for the global setting, which lives in `config.ts`

**File:** `docs/mcp-compatibility.md:161`
**Issue:** The global `settings.exposeResources` is copied into each entry that lacks it by `applySettingDefaults` (`config.ts:748-754`). `init.ts:471`, `:770` read only the per-entry value.
**Fix:** Cite `config.ts` and `init.ts`.

### IN-04: `adapterEntryDefaults` returns a shared module constant and restates the marker value union

**File:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts:83-86, 114-119`
**Issue:** `ADAPTER_ENTRY_DEFAULTS` is `as const`, which does not freeze it at runtime. The exported function returns `ADAPTER_ENTRY_DEFAULTS[kind]` itself, so a caller that casts away `Readonly` can change the defaults for the whole process. The return type `number | string | boolean` also duplicates `MarkerDefaultValue` (`marker.ts:24`), which the domain layer cannot import, so the two can drift.
**Fix:** `Object.freeze` both inner objects (or return a copy). Name the scalar type once in `domain/` and let `marker.ts` reuse it, since bridges may import from domain.

### IN-05: Comment lines past the 100-column width

**File:** `extensions/pi-claude-marketplace/bridges/mcp/marker.ts:74`; `features/lib/hook-mcp-tool-server.ts:13`
**Issue:** Prettier does not rewrap comments, so the edited JSDoc lines run to about 150 characters, unlike the rest of each block.
**Fix:** Rewrap to the block's width.

### IN-06: The D-PG9-07 guard test leaves out `streamable-http`

**File:** `test/domain/mcp-server-features.test.ts:111-123`
**Issue:** The guard checks `{}`, `stdio`, `sse`, and `http`, but not `streamable-http`, a remote transport that `transportKind` maps. The `stampServers` exact-JSON cases cover only fresh `http` and stdio entries.
**Fix:** Add `{ type: "streamable-http" }` to the guard's servers.

---

_Reviewed: 2026-11-14T21:53:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
