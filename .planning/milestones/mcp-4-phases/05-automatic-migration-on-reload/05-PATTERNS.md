# Phase 5: Automatic migration on /reload - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** 17 (source) + tests/docs
**Analogs found:** 16 / 17

All paths below are relative to `extensions/pi-claude-marketplace/` unless they
start with `tests/` or `docs/`. All analogs are git-tracked source.

## CONTEXT overrides RESEARCH (read first)

RESEARCH.md predates the 2026-10-08 revisions. Do NOT plan these RESEARCH items:

- **Pattern 3 "Legacy carry" + "Old-name stub absorption"** -- dropped. D-05-09
  (revised): nothing is carried from a legacy entry; only its marker is read.
  D-05-10 (revised): old-name adapter leftovers (disable stub, panel
  direct-tools copy) are DELETED, no kept-stub absorption, no write-back.
  So `marker.ts` gets no "original key" member, and `adapter-doc.ts`
  `survivingEntry`/`keptServers`/`restoredOverrideNames` and `adapter-entry.ts`
  `stampServers` need no change for this. `StageMcpInput` needs no legacy inputs.
- **Pattern 8 (per-server malformed opt-in on `ResolveContext`)** -- dropped.
  D-05-07 (revised): malformed follows the fresh-install rule; the resolver's
  `unavailable` arm means "delete all of the plugin's marked legacy entries,
  write none, empty the record's MCP inventory". `resolver-types.ts` /
  `mcp-resolution.ts` / `plugin-resolver.ts` change only for D-05-05.
- **D-05-08 scope** -- extended: reinstall (`reinstall-replace.ts`) and update
  (`update-swap.ts`) ALSO sweep legacy entries + D-05-10 leftovers, keeping
  their byte rollback (RESEARCH Open Question 2 is settled).
- Write order is locked (D-05-16): `mcp-adapter.json` -> `state.json` -> `mcp.json`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `orchestrators/reconcile/mcp-migration.ts` (NEW) | orchestrator step | batch, file-I/O under lock | `orchestrators/reconcile/backfill.ts` (`applyBackfillForScopeIsolated`, `resolveRecordedPluginOffline`) + `orchestrators/plugin/reinstall-replace.ts` (`ReinstallReplaceOperations` seam) | role-match |
| `orchestrators/reconcile/apply.ts` (MOD) | orchestrator | event-driven (load) | itself: backfill call site at the per-scope loop | exact |
| `orchestrators/reconcile/types.ts` (MOD) | config/types | - | `uninstallPlugin?` D-12 seam on `ApplyReconcileOptions` (types.ts:355-375) | exact |
| `orchestrators/plugin/git-source-probe.ts` (MOD: recorded-sha probe) | utility | file-I/O (fs-only) | `makePresenceProbe` in the same file (lines 117-168) | exact |
| `bridges/mcp/legacy.ts` (NEW: list owners, remove owners, leftover sweep, rollback handle) | bridge helper | file-I/O, transform | `bridges/mcp/unstage.ts` (`readUnstageTarget` 79-100, `unstageMcpServers` 187-216) | exact |
| `bridges/mcp/marker.ts` (MOD: exported owner reader) | utility | transform | `isOwnedBy` / private `readMarker` in same file | exact |
| `orchestrators/plugin/install-outcome.ts` (MOD: D-05-08 sweep in `mcpPhase`) | orchestrator ledger phase | transactional | `mcpPhase` itself (lines 963-1005) | exact |
| `orchestrators/plugin/reinstall-replace.ts` (MOD: sweep) | orchestrator | transactional | its MCP replace block (~444-498) + `mcpPhase` sweep | role-match |
| `orchestrators/plugin/update-swap.ts` (MOD: sweep) | orchestrator | transactional | `update-swap.ts:322, 1151` replace sites | role-match |
| `domain/mcp-server-features.ts` (MOD: D-05-05) | domain | transform | `remoteFeature` (lines 291-309) | exact |
| `domain/resolver-types.ts` (MOD: union mirror) | model | - | `DroppedMcpServerSchema` + `AssertTrue` drift checks (71-105) | exact |
| `bridges/mcp/stage.ts`, `bridges/mcp/types.ts` (MOD: permission-policy notice) | bridge | transform | `variableNotices` emission in `stage.ts` (~227-241) | exact |
| `orchestrators/marketplace/shared.ts` (MOD: `foldUnstageNotices`) | orchestrator helper | transform | its existing drop of `variables-missing`/`credentials-blanked` (372-393) | exact |
| `shared/notification-dispatch.ts` (MOD: new notice kind + `notifyMcpMigration`) | output chokepoint | request-response | `notifyMcpConfigNotices` (368-394) + line builders (284-308) | role-match |
| `docs/output-catalog.md`, `docs/mcp-compatibility.md` (MOD) | docs | - | existing `<!-- catalog-state: ... -->` MCP notice blocks | exact |
| `tests/architecture/mcp-migration-notice.test.ts` (NEW) | test (byte lock) | - | `tests/architecture/mcp-config-notices.test.ts` | exact |
| `tests/integration/mcp-migration*.test.ts` (NEW, incl. fault injection) | integration test | - | `tests/integration/mcp-override-lifecycle.test.ts` + `tests/integration/mcp-plugin-seed.ts` | role-match |
| Paired unit tests: `tests/orchestrators/reconcile/mcp-migration.test.ts`, `tests/bridges/mcp/legacy.test.ts`, plus edits to `tests/orchestrators/reconcile/apply.test.ts`, `tests/orchestrators/plugin/git-source-probe.test.ts`, `tests/domain/mcp-server-features.test.ts` (463-499 flip), `tests/bridges/mcp/stage.test.ts`, `tests/shared/notification-dispatch.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/architecture/mcp-config-notices.test.ts` (new row) | test | - | `tests/orchestrators/reconcile/backfill.test.ts`, `tests/bridges/mcp/unstage.test.ts` | exact |

## Pattern Assignments

### `orchestrators/reconcile/mcp-migration.ts` (NEW)

**Analogs:** `orchestrators/reconcile/backfill.ts` (offline resolve, per-plugin
fault isolation), `orchestrators/plugin/reinstall-replace.ts:151+`
(injected operations object for write-order fault injection).

**Offline resolve** (backfill.ts:523-546) -- copy the shape, add the git-source
callback from the new recorded-sha probe; every `undefined`/throw/`unavailable`
from a cache miss maps to a D-05-02 left-in-place row. Note: a malformed MCP
server also yields `unavailable`, but D-05-07 treats it as "delete all, write
none" -- distinguish by the resolver's malformed reason, not by the arm alone.
```ts
async function resolveRecordedPluginOffline(mp, plugin, record) {
  try {
    const manifest = await loadMarketplaceManifest(mp.manifestPath);
    const entry = manifest.plugins.find((p) => p.name === plugin);
    if (entry === undefined || !PLUGIN_ENTRY_VALIDATOR.Check(entry)) {
      return undefined;
    }
    return await resolveStrict(entry, {
      marketplaceRoot: mp.marketplaceRoot,
      marketplaceName: mp.name,
    });
  } catch (err) { ... }
}
```

**Per-plugin isolation loop** (backfill.ts:258-273): iterate owners, each wrapped
so one plugin's throw becomes its own row and the loop continues; each awaited
call in the loop carries
`// eslint-disable-next-line no-await-in-loop -- <reason>`.

**Operations seam** (reinstall-replace.ts:151-163): an exported interface of
`typeof fn` members, a `REAL_*` default object, and the step takes it as a
parameter. Members for this step: adapter write (`commitPreparedMcp`/
`atomicWriteJson`), `tx.save`, legacy write. The fault-injection test records
call order and throws between write 1 and write 3 (AMIG-02).
```ts
export interface ReinstallReplaceOperations {
  readonly abortPreparedMcp: typeof abortPreparedMcp;
  readonly finalizeMcpReplacement: typeof finalizeMcpReplacement;
  ...
}
```

**Lock:** own `withLockedStateTransaction(locationsFor(scope, cwd), async (tx) => ...)`
(precedent `apply.ts:158`, `apply.ts:1465`); `tx.save()` at most once
(with-state-guard.ts:96-106). Read `mcp.json` BEFORE locking and return with no
lock/mkdir when there is no marked entry (lock acquisition mkdirs
`extensionRoot`, with-state-guard.ts:117-118).

**Failure isolation:** do NOT reuse `runScopeIsolated` (backfill.ts:144-160) as-is
-- it pushes an `invalid-block` reconcile outcome, which D-05-17 forbids. Copy its
try/catch shape but push a migration left-in-place row into the migration report.
Use `redactAbsolutePaths(errorMessage(err))` the same way.

---

### `orchestrators/reconcile/apply.ts` (MOD)

**Insertion point** (apply.ts:1320-1384): after the `readPassForScope` try/catch
(1328-1352) and BEFORE `if (readResult.invalidOutcomes.length > 0) ... continue;`
(D-05-17 + RESEARCH Pattern 1 rule 5: the migration runs even when the config is
invalid; skip only when the read pass threw). Pass `readResult.plan` for the
AMIG-04 planned-install suppression (`plan.pluginsToInstall`,
`plan.pluginsToDependencyInstall`).
```ts
    if (readResult.plan !== undefined) {
      // eslint-disable-next-line no-await-in-loop -- each scope's apply edits shared hooks routing
      await applyPlan(reader, opts, readResult.plan, outcomes);
    }
```
**Notice emission:** after the scope loop and BEFORE
`if (outcomes.length === 0) { return; }` (apply.ts:1390-1392), so the migration
speaks with no reconcile outcomes and precedes `notifyReconcileAppliedWithContext`
(1403-1404). Import next to the existing
`import { notifyDiagnostic, notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";` (line 72).

### `orchestrators/reconcile/types.ts` (MOD)

Copy the `uninstallPlugin?: UninstallPluginOperation` D-12-style seam doc + member
(types.ts:355-375): optional, production (`index.ts`) omits it, default = real step.

---

### `orchestrators/plugin/git-source-probe.ts` (MOD)

**Analog:** `makePresenceProbe` (117-168), same file. Reuse its `anchorSubdir`
closure (lift it to module scope so both probes share it -- avoids a fallow dupe)
and the unpinned-mirror arm verbatim; key the pinned arm on the record's
`resolvedSha` instead of `source.sha`:
```ts
    const key = pluginCloneKey(cloneUrl, source.sha);   // existing
    const cloneDir = await locations.pluginCloneDir(key);
    return (await pathExists(cloneDir))
      ? anchorSubdir(source, cloneDir, source.sha)
      : { kind: "not-cached" };
```
Never import `clone-cache.ts`'s `materializePluginClone` or
`reinstall-clone-probe.ts` (NFR-5 / BLOCK F; D-05-18).

---

### `bridges/mcp/legacy.ts` (NEW)

**Analog:** `bridges/mcp/unstage.ts`.

**Read pattern** (unstage.ts:79-100) -- read with `PI_MCP_SERVER_KEYS`, tolerate
`top-level-not-object`, partition by marker:
```ts
  let config: McpConfigDoc;
  try {
    config = await readMcpConfigDoc(filePath, serverKeys);
  } catch (err) {
    if (err instanceof McpConfigFileError && err.defect === "top-level-not-object") {
      return undefined;
    }
    throw err;
  }
  const ownedNames = Object.keys(partitionServers(config, pluginName, marketplaceName).ours);
```
For D-05-19 (unparseable file -> no write in that scope, one row) catch
`McpConfigFileError` at the migration level rather than rethrowing.

**Removal:** `withPluginServers(config, plugin, mp, {})` per owner over one doc
read (keeps foreign keys/order, `safeSet` against `__proto__`). Write only when
there is something to remove (unstage.ts:205-207 "a file with nothing to remove
is not rewritten"). Return `written` prior bytes like `UnstageMcpResult` so
install/reinstall/update `undo` can restore (NFR-3).

**Leftover sweep (D-05-10):** marker-less key equal to an old name the moved
legacy entries used, in the same scope's `mcp-adapter.json` (stub or
direct-tools full copy) and, for disable stubs, also the project
`mcp-adapter.json`. Matching rule is the only guard -- test it with
foreign-key negatives.

### `bridges/mcp/marker.ts` (MOD)

Add an exported owner reader (e.g. `markerOwnerOf(entry)`) built on the private
`readMarker`, same own-string tolerance as `isOwnedBy`. Marker shape
(`CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace"`, `plugin`,
`marketplace`, optional `pluginSetFields`, `keptOverride`) is unchanged.

---

### `orchestrators/plugin/install-outcome.ts` (MOD)

**Analog:** `mcpPhase` (963-1005). Add the sweep in `do` right after
`c.mcpReplacement = await replacePreparedMcp(prep);` (line 977); store the
legacy handle on the context; in `undo` restore the legacy bytes FIRST, then
`rollbackMcpReplacement` (re-add before remove on rollback too). Route the
sweep's `comments-dropped` notice through `c.mcpConfigNotices.push(...)`.
```ts
    undo: async (c) => {
      if (c.mcpReplacement === undefined) { return; }
      const leaks = await rollbackMcpReplacement(c.mcpReplacement);
      if (leaks.length > 0) { throw new Error(leaks.join("; ")); }
    },
```
This one phase covers install, enable (`runInstallLedger`), install cascade,
reconcile install and import.

### `reinstall-replace.ts`, `update-swap.ts` (MOD)

Same sweep after their adapter replace; restore bytes in their existing
hand-rolled rollback paths (reinstall: `ReinstallReplaceOperations` gains the
sweep member so tests can inject it).

---

### `domain/mcp-server-features.ts` (MOD, D-05-05)

Remove these two arms from `remoteFeature` (291-309) and the two literals from
`McpUnsupportedFeature`; keep the fields in `REMOTE_SERVER_SCHEMA` (they still
decide malformed). Add a pure helper returning the restriction fields present:
```ts
  if ((server.tools ?? []).some((tool) => tool.permission_policy !== undefined)) {
    return "tools[].permission_policy";
  }
  if (Object.keys(server.toolPermissions ?? {}).length > 0) {
    return "toolPermissions";
  }
```
`domain/resolver-types.ts:71-105` `DroppedMcpServerSchema` mirror -- the
`AssertTrue` checks force the edit.

### `bridges/mcp/stage.ts` + `types.ts` (MOD)

Emit a new per-server `McpConfigNotice` kind (scope, `file: "mcp-adapter.json"`,
plugin, server, field names) alongside `variableNotices` (~227-241), declared
order. Shape analog = `McpVariablesMissingNotice` (`names` -> `fields`).

### `orchestrators/marketplace/shared.ts` (MOD)

`foldUnstageNotices` (372-393): add the new kind to the set dropped for removed
servers, exactly as `variables-missing`/`credentials-blanked`.

---

### `shared/notification-dispatch.ts` (MOD)

1. Add the permission-policy kind to `McpConfigNotice` (277-282) and a
   `[summary, lines]` pair to the `warnings` table in `notifyMcpConfigNotices`
   (368-394), with a `isX` type guard + `mcpXLine` builder like
   `mcpVariablesMissingLine` (294-296).
2. New `notifyMcpMigration(ctx, report)`: ONE `ctx.ui.notify` call (not one per
   kind). Reuse the private builders (`mcpVariablesMissingLine`,
   `mcpCredentialsBlankedLine`, the new permission-policy line) for the D-04-10 /
   D-05-05 lines. Warning shape = `${summary}\n\n${body}` (host prepends
   `Warning:`); info needs no summary. End with `RELOAD_HINT_TRAILER`
   (`shared/notification-summary.ts:108`). Sort scope first (project, user),
   then plugin, then old name -- NOT `compareByNameThenScope`. Body order per
   D-05-15. Prose reasons; reuse literal `{unsupported mcp}` / `{malformed mcp}`
   tokens, no new `Reason` members.

## Shared Patterns

### Output chokepoint (IL-2)
All new output via `shared/notification-dispatch.ts`; a `ctx.ui.notify` anywhere
else trips `architecture/notify-chokepoint`.

### Atomic writes + byte-compare skip (NFR-1, D-05-16)
`shared/atomic-json.ts::atomicWriteJson` serializes as
`JSON.stringify(value, null, 2) + "\n"`; compare with current bytes and skip an
identical `mcp-adapter.json` write (restage can reorder entries via
`withPluginServers`, so never assume a no-op).

### Network boundary (NFR-5)
`mcp-migration.ts` is gated by BLOCK F from its first commit: no `platform/git`,
no `gitOps`/`DEFAULT_GIT_OPS`/`refreshGitHubClone`, no `clone-cache.ts`
materialize, no `reinstall-clone-probe.ts`. Do not add it to `NETWORK_SEAMS`.

### Comments / IDs
Cite AMIG-0N, NFR-N, COMPAT-01 in source; never `D-05-NN` or phase numbers.

### Catalog byte lock
Copy `tests/architecture/mcp-config-notices.test.ts` (reads
`<!-- catalog-state: ... -->` blocks through `catalog-block.ts`, `CATALOG_NOTICE_ROWS`)
for `tests/architecture/mcp-migration-notice.test.ts`.

### Test style
`node:test` + `node:assert/strict`, real temp dirs (`mkdtemp`,
`withHermeticHome`), one paired test per source, `.ts` import extensions,
type-only imports last. Fixtures: legacy `mcp.json` as main writes it
(declared-name keys, `_piClaudeMarketplace` with plugin+marketplace only) and a
`github: { "disabled": true }` stub in `mcp-adapter.json`; seed helpers in
`tests/integration/mcp-plugin-seed.ts`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `notifyMcpMigration` single-body multi-section notice | output | request-response | Every existing MCP notice is one notify per kind; the multi-section single body is new (use `notifyDiagnostic`'s summary+blank-line shape and the private line builders) |

## Metadata

**Analog search scope:** `orchestrators/reconcile`, `orchestrators/plugin`, `bridges/mcp`, `domain`, `shared`, `tests/integration`, `tests/orchestrators/reconcile`
**Files scanned:** ~12
**Pattern extraction date:** 2026-10-08
