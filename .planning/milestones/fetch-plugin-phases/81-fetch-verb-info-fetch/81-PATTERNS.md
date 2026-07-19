# Phase 81: Fetch verb & info --fetch - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 15 (2 new orchestrator, 1 new edge handler, 6 edits, 6 test files)
**Analogs found:** 15 / 15

Every file in this phase has a strong existing analog — the phase is 100% composition over shipped seams (confirmed by RESEARCH.md). The two genuinely-new files (`fetch.ts`, `fetch.messaging.ts`) are near-clones of `update.ts` + `update.messaging.ts` with the enumeration source swapped from state-records to manifest (`edge-deps.ts::loadManifestForMarketplace`), and the git surface reached install-style (`install.ts::makeInstallCloneProbe`) rather than via the update-style gitOps exemption.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `orchestrators/plugin/fetch.ts` **NEW** | orchestrator | request-response + batch | `orchestrators/plugin/update.ts` (bulk sweep) + `install.ts` (seam injection) | role-match (hybrid) |
| `orchestrators/plugin/fetch.messaging.ts` **NEW** | config (render vocab) | transform | `orchestrators/plugin/update.messaging.ts` | exact |
| `orchestrators/plugin/info.ts` **EDIT** | orchestrator | request-response | self (add `--fetch` hook) + `install.ts::makeInstallCloneProbe` | exact |
| `edge/handlers/plugin/fetch.ts` **NEW** | edge handler (route) | request-response | `edge/handlers/plugin/info.ts` (positional parse) + `shared.ts::parsePositionalsWithFlags` | role-match |
| `edge/handlers/plugin/info.ts` **EDIT** | edge handler (route) | request-response | self (add `--fetch` boolean arm) | exact |
| `edge/router.ts` **EDIT** | router | request-response | self (`update` registration path — 4 sites) | exact |
| `edge/register.ts` **EDIT** | provider (wiring) | request-response | self (`makeUpdateHandler` wiring) | exact |
| `edge/completions/provider.ts` **EDIT** | provider (completion) | request-response | self (`PluginRefMode` `update` branch) | exact |
| `edge/completions/data.ts` **EDIT** | utility (filter) | transform | self (`INSTALL_STATUSES` / `PARTIAL_UPDATE_STATUSES` filter sets) | exact |
| `docs/output-catalog.md` **EDIT** | docs | — | self (`## /claude:plugin update` H2 section) | exact |
| `docs/messaging-style-guide.md` **EDIT** | docs | — | self (verb grammar summary) | exact |
| `tests/orchestrators/plugin/fetch.test.ts` **NEW** | test | — | `tests/orchestrators/plugin/update.test.ts` | exact |
| `tests/edge/handlers/plugin/fetch.test.ts` **NEW** | test | — | `tests/edge/handlers/plugin/*.test.ts` | role-match |
| `tests/architecture/no-orchestrator-network.test.ts` **EDIT** | test | — | self (`FORBIDDEN_TARGETS` list) | exact |
| `tests/architecture/catalog-uat.test.ts` **EDIT** | test | — | self (fixture-keying) | exact |
| `tests/orchestrators/plugin/clone-gc.test.ts` **EDIT** | test | — | self (sweep regression) | exact |

## Shared Patterns

These cross-cutting patterns apply to `fetch.ts` and the `info --fetch` path both. Extract them once; the planner threads them into every relevant plan.

### Git-surface delegation (install-style seam injection) — GATE-CRITICAL

**Source:** `orchestrators/plugin/install.ts` lines 552-623 (`makeInstallCloneProbe`)
**Apply to:** `fetch.ts` fetch-one core AND the `info --fetch` hook

The orchestrator NEVER names `gitOps` / `DEFAULT_GIT_OPS` / `platform/git`. It reaches git only through named `clone-cache.ts` entrypoints. `fetch.ts` and `info.ts` MUST both be in `FORBIDDEN_TARGETS` (info.ts already is). The pinned/unpinned fork:

```typescript
// install.ts:594-620 — pinned arm + unpinned arm + dispatch on source.sha
const probePinned = async (gitSource) => {
  const { cloneUrl, pin, ref } = await seam.resolvePluginPin({ source: gitSource });
  const authBundle = buildProbeAuth(cloneUrl, gitSource.kind, auth);
  const cloneRoot = await seam.materializePluginClone({
    locations, cloneUrl, pin,
    ...(ref !== undefined && { ref }),
    ...(authBundle !== undefined && { auth: authBundle }),
  });
  // ...resolveGitPluginRootWithSubdir(gitSource, cloneRoot, pin)
};

const probeUnpinned = async (gitSource) => {
  const cloneUrl = canonicalCloneUrl(gitSource);
  const authBundle = buildProbeAuth(cloneUrl, gitSource.kind, auth);
  const { pluginRoot: mirrorRoot, resolvedSha } = await seam.materializeOrRefreshPluginMirror({
    locations, cloneUrl,
    ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
    ...(authBundle !== undefined && { auth: authBundle }),
  });
  // ...
};

// dispatch: unpinned always refreshes (the consented fetch); pinned short-circuits warm
const probe = (gitSource) =>
  gitSource.sha === undefined ? probeUnpinned(gitSource) : probePinned(gitSource);
```

The optional test-only `cloneCacheSeam` (`InstallCloneCacheSeam`) is the injection point — mirror its shape for `fetch.ts` so the fetch tests can inject `makeMockGitOps` without any real git.

### Host auth + once-per-host memo (FTCH-06)

**Source:** `orchestrators/plugin/install.ts` lines 508-526 (`buildProbeAuth`)
**Apply to:** every per-plugin fetch in the sweep

```typescript
// install.ts:508-526
function buildProbeAuth(cloneUrl, kind, auth: {
  ctx; credentialOps; deviceFlowHttp?; authMemo?: Map<string, AuthAttemptResult>;
}) {
  const host = hostFromCloneUrl(cloneUrl, kind);
  return buildAuthForHost({
    host, credentialOps: auth.credentialOps, ctx: auth.ctx,
    ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
    ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
  });
}
```

**CRITICAL (Pitfall):** create `const authMemo = new Map<string, AuthAttemptResult>()` ONCE at the top of the sweep and thread it into EVERY `buildProbeAuth` call. `update.ts` threads `opts.authMemo` through its batch loop (see update.ts:387). A per-plugin memo re-triggers the device flow N times.

### Manifest enumeration (fetchable-set — NOT state-records)

**Source:** `orchestrators/edge-deps.ts` lines 195-224 + 116-135 (`loadMarketplaceManifest` + `classifyNotInstalledPluginRow`)
**Apply to:** `fetch.ts` bulk enumerator (`@<mp>` and bare shapes)

Fetch acts on the marketplace MANIFEST inventory (not-installed `(remote)` + unpinned-warm git), NOT on installed state records the way `update.ts::enumerateTargets` does. State records would silently drop every `(remote)` plugin — the whole point of fetch.

```typescript
// edge-deps.ts:195, 218-224 — the manifest+probe pattern to mirror
const parsed = await loadMarketplaceManifest(mp.manifestPath);
for (const entry of parsed.plugins) {
  const status = await probeManifestEntry(entry, mp.marketplaceRoot, locations); // fs-only, never throws
  // fetchable = status === "remote"  OR  (git source && source.sha === undefined)
  // pinned-warm (status !== "remote" && sha set) and path/non-git → no-op row
}
```

### No-op decision BEFORE materialize (idempotency, FTCH-02)

**Source:** `orchestrators/plugin/git-source-probe.ts` lines 110-139 (`makePresenceProbe`)
**Apply to:** every target, before touching any git seam

`makePresenceProbe(locations)(source)` is fs-only and returns `{ kind: "materialized", ... }` or `{ kind: "not-cached" }`. The no-op set is exactly `{pinned-warm, path}`:

```typescript
const presence = await makePresenceProbe(locations)(parsedSource);
const isNoOp =
  parsedSource.kind === "path" ||
  (parsedSource.sha !== undefined && presence.kind === "materialized"); // pinned-warm only
// isNoOp → render (skipped) {up-to-date} at info severity, skip network
// otherwise (remote cold OR any unpinned) → fetch path (unpinned always refreshes)
```

### Post-fetch row derivation (FRESH, not stale)

**Source:** `orchestrators/plugin/git-source-probe.ts` `probeManifestEntry` (lines 167+) / `list.ts::availableRowMessage` (exported `__test_availableRowMessage`, ~547-676)
**Apply to:** every successful fetch — derive the success row from the NOW-WARM tree

After the git seam returns, re-run `probeManifestEntry` / `availableRowMessage` FRESH against the warm tree (an unpinned refresh moves HEAD; a probe captured pre-materialize renders the stale classification). The classifier is fs-only and cheap. This is the exact `list`/`info` derivation — parity is drift-guard-tested.

## Pattern Assignments

### `orchestrators/plugin/fetch.ts` (NEW — orchestrator, batch)

**Analogs:** `update.ts` (bulk sweep structure) + `install.ts` (git seam) + `edge-deps.ts` (enumeration).

**Bulk sweep skeleton** — mirror `update.ts::updatePlugins` lines 267-441:

```typescript
// update.ts:279-284 — empty-targets success (round-trips to "(no marketplaces)" sentinel)
if (targets.length === 0) { notify(ctx, pi, { marketplaces: [] }); return; }

// update.ts:321-325 — outcome+target pairing for per-(scope,marketplace) grouping;
// single-vs-plural cardinality drives the tally
const outcomes: { target; outcome }[] = [];
const cardinality: "single" | "plural" = opts.target.kind === "plugin" ? "single" : "plural";

// update.ts:326-349 — per-target loop; a per-plugin failure is captured, NEVER aborts the sweep
for (const t of targets) { /* fetch-one inside try/catch → partition outcome */ }
```

**Failure-tolerant fetch-one (NEVER-throws contract)** — mirror `update.ts::updateSinglePlugin` lines 547-597. Each per-plugin fetch runs inside try/catch that captures the throw into a `partition: "failed"` outcome instead of aborting:

```typescript
// update.ts:584-595 — capture pattern
const typedReasons = reasonsFromTypedError(err);
const base = { partition: "failed", name: plugin, notes: [composeErrorWithCauseChain(err)],
  declaresAgents: false, declaresMcp: false };
return typedReasons === undefined ? base : { ...base, reasons: typedReasons };
```

**Failure reason narrowing** — reuse `update.ts::reasonsFromTypedError` (lines 605-645) + `classifyGitProbeFailure` (line 876). All members (`network unreachable`, `authentication required`, `source missing`, `permission denied`) already in REASONS. NO new members.

**Cascade dispatch** — `notifyUpdateWithContext` / `notifyUpdateNoOpWithContext` from `shared/notify-context.ts` (imported at update.ts:111-112) with a new `FETCH_CONTEXT`. Cardinality: `single` = no tally; `plural` = tally.

### `orchestrators/plugin/fetch.messaging.ts` (NEW — render vocabulary)

**Analog:** `orchestrators/plugin/update.messaging.ts` (whole file, 94 lines) — clone the shape exactly.

Declare `FETCH_STATUSES` (private status set), a `FetchMsg` union (subset of central plugin message shapes), a total render map, and the context:

```typescript
// mirror update.messaging.ts:32-94
export const FETCH_STATUSES = ["available","partially-available","unavailable","remote","skipped","failed"] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];
export type FetchMsg =
  | PluginAvailableMessage | PluginPartiallyAvailableMessage | PluginUnavailableMessage
  | PluginRemoteMessage | PluginSkippedMessage | PluginFailedMessage;
const FETCH_RENDER: { [K in FetchStatus]: RenderFn<Extract<FetchMsg, { status: K }>> } = { /* call SHARED row helpers verbatim */ };
export const FETCH_CONTEXT = { Messaging: { label: "Plugin fetch" }, render: FETCH_RENDER }
  as const satisfies CommandContext<FetchStatus, FetchMsg>;
```

Arm bodies call the SHARED `notify.ts` row helpers (`pluginRow`, `installedLikeRow`, etc.) — never duplicate them. A missing arm is a TS2741 compile error (D-10 open/closed discipline). No new icons/tokens. The `skipped` arm mirrors update.messaging.ts:77 (`pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe)`).

### `orchestrators/plugin/info.ts` (EDIT — add `--fetch` hook)

**Analog:** self (existing `componentsResolved: false` degrade arm) + shared `makeInstallCloneProbe`-style seam.

Add `fetch?: boolean` to `GetPluginInfoOptions` (info.ts:98-112). Thread a fetch hook BEFORE the fs-only resolve. **CRITICAL (Pitfall):** wrap the fetch in try/catch INSIDE `getPluginInfo`; on failure fall through to the EXISTING `componentsResolved: false` arm with an existing reason (`network unreachable` / `authentication required`) — NEVER let the throw fail `info` (D-81-04). info.ts already builds `components: not resolved` for external sources (the arm at ~756-761). Reuse it.

**NUL byte warning:** info.ts (~line 332) contains a pre-existing NUL byte — use `grep -a` / `rg --text` when searching it. Do NOT "fix" the NUL byte (pre-existing, out of scope).

### `edge/handlers/plugin/fetch.ts` (NEW — thin-shim handler)

**Analog:** `edge/handlers/plugin/info.ts` lines 30-79 (positional parse + `splitPluginMarketplaceRef` + delegate) + `shared.ts::parsePositionalsWithFlags` for the flag-scan idiom.

Parse the 3 positional shapes into a `FetchTarget` union: `<plugin>@<mp>` (single), `@<mp>` (marketplace-wide), bare (all). Follow info.ts's inline flag-rejection loop (lines 44-52) — reject any `--` flag other than `--scope`. Delegate to `fetchPlugins`.

### `edge/handlers/plugin/info.ts` (EDIT — accept `--fetch`)

**Analog:** self. Today info rejects ALL flags (lines 44-49: `if (token.startsWith("--")) { Unknown flag }`). Change to recognize the single boolean `--fetch`, keep rejecting others:

```typescript
// mirror shared.ts::parsePositionalsWithFlags allow-list arm (lines 58-71)
for (const token of parsed.positional) {
  if (token === "--fetch") fetch = true;
  else if (token.startsWith("--")) { notifyUsageError(...); return; }
  else nonFlagPositionals.push(token);
}
// then: await getPluginInfo({ ..., ...(fetch && { fetch: true }) });
```

### `edge/router.ts` (EDIT — register `fetch` in 4 sites)

**Analog:** self, the `update` registration path.

```typescript
// 1. SubcommandHandlers interface (near line 30):  fetch: (args, ctx) => Promise<void>;
// 2. TOP_LEVEL_SUBCOMMANDS tuple (55-69):          add "fetch"
// 3. TOP_LEVEL_USAGE string (87-100):              add line, byte-parallel to update's:
//      "  fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n"
// 4. routeClaudePlugin switch (143-172):           case "fetch": return handlers.fetch(rest, ctx);
```

### `edge/register.ts` (EDIT — wire handler)

**Analog:** self (`makeUpdateHandler` import + handlers-record entry). Add `import { makeFetchHandler } from "./handlers/plugin/fetch.ts";` and `fetch: makeFetchHandler(pi),` in the handlers record (~line 50 import block, handlers record below).

### `edge/completions/provider.ts` (EDIT — `fetch` branch)

**Analog:** self, the `update` branch of `pluginRefBranchConfig` (lines 221-227).

Add `"fetch"` to `PluginRefMode` (lines 181-188) and a `case "fetch":` in `pluginRefBranchConfig` with `allowMarketplaceOnly: true` (mirrors update, which supports `@<marketplace>`):

```typescript
case "fetch":
  return { mode: "fetch", allowMarketplaceOnly: true,
    ...(explicitScope !== undefined && { targetScope: explicitScope }) };
```

### `edge/completions/data.ts` (EDIT — fetchable status filter)

**Analog:** self, `INSTALL_STATUSES` (line 64) / `PARTIAL_UPDATE_STATUSES` (line 87) filter sets.

Add a `FETCH_STATUSES` filter set. **Planner decision (OPEN QUESTION 1):** the completion cache row `status` cannot distinguish pinned-warm from unpinned-warm. Recommended option (a) — offer `{remote, available, partially-available, unavailable}` and let pinned-warm no-op-if-typed (CONTEXT allows "still accepted if typed, rendering the no-op row"):

```typescript
const FETCH_STATUSES: ReadonlySet<PluginIndexRow["status"]> = new Set([
  "remote", "available", "partially-available", "unavailable",
]);
```

### `docs/output-catalog.md` (EDIT — new fetch section)

**Analog:** self, `## /claude:plugin update` H2 section (lines ~790-861) + remote rows (~345-368). Add a NEW `## /claude:plugin fetch` H2 with catalog-state fixture rows following catalog prose style. New verb = new catalog rows (mandatory per D-81-06 discretion resolution).

### `docs/messaging-style-guide.md` (EDIT)

**Analog:** self, verb grammar summary. Reference `fetch` in the grammar summary. No new closed-set frontmatter (v2.0 retired it).

### Test files

| Test file | Analog | What to lift |
|-----------|--------|--------------|
| `tests/orchestrators/plugin/fetch.test.ts` **NEW** | `tests/orchestrators/plugin/update.test.ts` | bulk patterns; import `makeMockGitOps`, `fixtureMarketplaceDir`, `makeMockCredentialOps`, `makeMockDeviceFlowHttp` from `tests/helpers/`. Covers FTCH-01/02/04/06/07. |
| `tests/edge/handlers/plugin/fetch.test.ts` **NEW** | sibling handler tests | 3-shape positional parse + `info --fetch` flag. |
| `tests/architecture/no-orchestrator-network.test.ts` **EDIT** | self | add `fetch.ts` to `FORBIDDEN_TARGETS`. |
| `tests/architecture/catalog-uat.test.ts` **EDIT** | self | one fixture per `(fetch section, catalog-state)` tuple. |
| `tests/orchestrators/plugin/clone-gc.test.ts` **EDIT** | self | FTCH-05 fetched-uninstalled sweep regression (fetch, don't install, GC, assert clone gone + next probe = `remote`). Verify-don't-build — no GC code change. |

## Architecture-gate placement (Claude's Discretion — RESOLVED)

**Install-style.** Add `orchestrators/plugin/fetch.ts` TO `FORBIDDEN_TARGETS`. `info.ts` is already a FORBIDDEN_TARGET and hosts `info --fetch`; the fetch surface it calls MUST be gitOps-free. Install-style keeps the exempt set at exactly one (`update.ts`) — the smaller exemption surface CONTEXT asks for. The gate greps `\bgitOps\b` on comment-stripped source; even a type-only `platform/git` import trips it. Use `auth-host.ts` re-exports + `clone-cache.ts` entrypoints only.

## No Analog Found

None. Every file has a strong analog.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/`, `.../orchestrators/`, `.../edge/`, `.../edge/completions/`, `.../edge/handlers/plugin/`, `.../shared/`, `docs/`, `tests/`.
**Files scanned:** ~14 source + doc files read; ~10 grep sweeps.
**Pattern extraction date:** 2026-07-14
