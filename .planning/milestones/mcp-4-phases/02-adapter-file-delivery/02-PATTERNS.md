# Phase 2: Adapter-file delivery - Pattern Map

**Mapped:** 2026-10-02
**Files analyzed:** 22 (new + modified)
**Analogs found:** 21 / 22

All paths below are git-tracked (verified with `git ls-files`). `E/` abbreviates
`extensions/pi-claude-marketplace/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/bridges/mcp/adapter-doc.ts` (NEW) | utility (bridge-local reader) | file-I/O, transform | `E/bridges/mcp/stage.ts:53-130` (`readScopedDoc`, `classifyMcpServers`) | exact (code moves here) |
| `E/bridges/mcp/adapter-entry.ts` (NEW) | utility (stamp + carry-forward) | transform | `E/bridges/mcp/stage.ts:181-228` (`stampServers`) | exact (code moves here) |
| `E/bridges/mcp/collision-slots.ts` (REWRITE) | utility | file-I/O, batch read | itself (`:29-106`) | exact |
| `E/bridges/mcp/collision-ancestors.ts` (optional NEW) | utility | file-I/O | `E/bridges/mcp/collision-slots.ts` | role-match |
| `E/bridges/mcp/stage.ts` (MODIFY) | service (prepare/commit/replace) | file-I/O, request-response | itself | exact |
| `E/bridges/mcp/unstage.ts` (MODIFY) | service | file-I/O CRUD (delete) | itself | exact |
| `E/bridges/mcp/types.ts` (MODIFY) | model (type-only) | n/a | itself (`StageMcpCommitResult`, `UnstageMcpResult`) | exact |
| `E/bridges/mcp/index.ts` (MODIFY only if new exports) | barrel | n/a | itself | exact |
| `E/persistence/locations.ts` (MODIFY: `mcpAdapterJsonPath`) | config (path bundle) | n/a | `mcpJsonPath` at `:57-58, :203, :282` | exact |
| `E/shared/errors-bridges.ts` (MODIFY: typed parse error; collision `winningPath`) | model (error) | n/a | `McpServerCollisionError` `:50-65`, `WorkflowTargetOccupiedError` `:105-118` | exact |
| `E/orchestrators/plugin/install-outcome.ts` (MODIFY: `mcpPhase` -> replacement handle, D-02-11) | orchestrator ledger phase | transactional | `E/orchestrators/plugin/reinstall-replace.ts:435-489, 662-712` | exact |
| `E/orchestrators/plugin/prune-rollback.ts` (MODIFY: snapshot adapter file) | orchestrator | file-I/O snapshot/restore | itself `:300-393` (`mcp` snapshot) | exact |
| `E/orchestrators/marketplace/shared.ts` (MODIFY: `UnstageOutcome` notice carrier) | orchestrator helper | event (cascade) | `UnstageOutcome` `:317+`, `cascadeUnstagePlugin` mcp slot `:413-418` | exact |
| `E/orchestrators/plugin/shared.ts` (MODIFY: notice-surfacing helper) | orchestrator helper | notify | `surfaceDiscoveryWarnings` `:1575-1603` | exact |
| `E/orchestrators/plugin/{install-flow,update-flow,update-swap,reinstall-flow,reinstall-replace,enable-disable,uninstall}.ts`, `E/orchestrators/marketplace/remove.ts`, prune, `E/orchestrators/{reconcile,import}/*` (MODIFY: route notice, D-02-09) | orchestrator | notify | `install-flow.ts:2077` / `reinstall-flow.ts:598` / `update-flow.ts:400` calls to `surfaceDiscoveryWarnings` | role-match |
| `E/shared/notification-dispatch.ts` (MODIFY if a dedicated seam is added) | notify seam | request-response | `notifyStopHookOverrideCap` `:202-207`, `notifyDiagnostic` `:144-154` | exact |
| `docs/output-catalog.md` (MODIFY: catalog amendment) | doc/contract | n/a | `stop-override-cap` block `:4135-4146` | exact |
| `tests/architecture/<adapter-comments>-notify.test.ts` (NEW byte-lock) | test (architecture) | n/a | `tests/architecture/hooks-cap-notify.test.ts` | exact |
| `tests/architecture/gate-targets.ts` (MODIFY if a new production path is named) | test registry | n/a | itself (`VOCABULARY_GUARD_DOC_TARGETS`) | exact |
| `tests/bridges/mcp/adapter-doc.test.ts`, `adapter-entry.test.ts` (NEW) | test (unit, real fs) | n/a | `tests/bridges/mcp/unstage.test.ts:1-40`, `stage.test.ts` | exact |
| `tests/bridges/mcp/{stage,unstage,collision-slots}.test.ts`, `tests/persistence/locations.test.ts`, `tests/shared/errors-bridges.test.ts`, `tests/orchestrators/plugin/prune-rollback.test.ts` (MODIFY) | test | n/a | themselves | exact |
| `package.json` / `package-lock.json` (MODIFY: `strip-json-comments@^5.0.3`) | config | n/a | none in-repo (first JSONC dependency) | no analog |

## Pattern Assignments

### `E/bridges/mcp/adapter-doc.ts` (utility, file-I/O)

**Analog:** `E/bridges/mcp/stage.ts` lines 53-130. Move `readScopedDoc`, `MalformedMcpServersError`, `isMcpServersRecord`, `mcpServersValueKind`, `classifyMcpServers` here; `unstage.ts:31` imports `classifyMcpServers` from `stage.ts` today and must be repointed.

**File header + imports** (`stage.ts:1-33` style): path comment line, then purpose prose citing IDs; import groups builtin / external / internal / sibling / type, blank line between groups:
```typescript
import { readFile } from "node:fs/promises";

import stripJsonComments from "strip-json-comments";

import { AdapterConfigParseError } from "../../shared/errors-bridges.ts"; // name is planner's

import type { RawMcpDoc } from "./types.ts";
```

**ENOENT pattern to keep** (`stage.ts:62-73`):
```typescript
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { doc: {}, malformed: false };
    }

    throw err;
  }
```

**Pattern to REPLACE** (`stage.ts:75-89`): the `catch { return { doc: {}, malformed: true } }` and the non-object `malformed: true` branch become throws of the typed error (AFILE-02). Do not attach the raw `SyntaxError` as `cause` (Pitfall 7).

**Classifier to extend to both keys** (`stage.ts:113-130`):
```typescript
export function classifyMcpServers(doc: RawMcpDoc, mcpJsonPath: string):
  | { readonly kind: "missing" }
  | { readonly kind: "present"; readonly servers: Record<string, unknown> } {
  if (!Object.hasOwn(doc, "mcpServers")) { return { kind: "missing" }; }
  const value = doc.mcpServers;
  if (isMcpServersRecord(value)) { return { kind: "present", servers: value }; }
  throw new MalformedMcpServersError(mcpJsonPath, mcpServersValueKind(value));
}
```
Extend per RESEARCH Pattern 2: check `mcpServers` and `mcp-servers`, plus `selectServerKey` and `hasComments` (`stripJsonComments(body) !== body`). `RawMcpDoc` in `types.ts:15-18` gains an optional `"mcp-servers"` member or stays index-signature-only.

**Partition helper to move/extend** (`stage.ts:132-151`, `partitionExistingServers`): keep the `safeSet` WR-01 copy and its comment; enumerate both keys; add an overlay bucket for marker-less non-full entries (D-02-10).

---

### `E/bridges/mcp/adapter-entry.ts` (utility, transform)

**Analog:** `E/bridges/mcp/stage.ts:181-228` (`isPlainObject`, `stampServers`). Move verbatim, then add carry-forward. The final spread at `:224` is the insertion point:
```typescript
    safeSet(stamped, name, { ...entryObj, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker });
```
becomes `{ ...entryObj, ...carried, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker }`. The closed D-02-06 set is a module-private `const` (no export for tests). Warnings stay `string[]` exactly as `:190-219`.

---

### `E/bridges/mcp/collision-slots.ts` (REWRITE, file-I/O batch)

**Analog:** itself. Keep the per-slot read loop shape (`:50-79`) and ENOENT/ENOTDIR skip, EACCES propagate; keep `getAgentDir()` from `../../platform/pi-api.ts` and `homedir()` (hermetic via `createHermeticEnvironment`). Change: nine sources in adapter order (RESEARCH Pattern 3 table), JSONC parse via the adapter-doc parser, later-wins with winner attribution, `isFullDefinition` filter, and delete the unwrapped-form branch in `extractServers` (`:104-105`). Rewrite the header (`:1-9`, `:17-28`) in present tense; the frozen-order snapshot in `tests/bridges/mcp/collision-slots.test.ts` changes deliberately. Return type should carry enough to exempt same-plugin marked entries in the same-scope legacy `mcp.json` (D-02-12) and the other scope's adapter file (D-02-13) -- i.e. the entry value or owner, not just the path.

**Caller to update:** `stage.ts:153-179` `assertNoMcpCollisions` (the `owningPath !== input.mcpJsonPath` exemption and the `theirs` check).

---

### `E/bridges/mcp/stage.ts` / `unstage.ts` (service, file-I/O)

**Analog:** themselves. Keep the prepare -> in-memory `_nextDoc` -> single `atomicWriteJson` commit (`stage.ts:241-351`), AS-8 noop (`:266-276`, now: empty staged set + unparseable file = noop + notice, D-02-14), and the replacement handle (`:363-436`). Replace every `locations.mcpJsonPath` with `locations.mcpAdapterJsonPath` (`stage.ts:244,245,260,317,349,368,390-399`; `unstage.ts:45,61,74,100`). Delete the "will be replaced" warning (`stage.ts:294-302`). Merge write becomes `{ ...doc, [serverKey]: { ...theirsUnderKey, ...stamped } }` (replaces `:306`). Unstage keeps the "no removal -> no write" rule (`unstage.ts:94-98`) and the `safeSet` loop (`:81-92`), across both keys plus a marker-keyed sweep of the same-scope legacy `mcp.json` (D-02-12). Unstage's raw `Error` at `unstage.ts:61-63` becomes the typed parse error (no raw cause).

**Rollback message** (`stage.ts:398-400`) says `mcp.json`; retarget wording.

**Type-member pins** move: `stage.ts:49:29, :371:48, :416:42`, `types.ts:94:52` in `scripts/check-unused-type-members.contracts.json`. Prettier first, then shift LINE only.

---

### `E/bridges/mcp/types.ts` (model)

**Analog:** itself. Add the notice field next to `warnings`:
```typescript
export interface StageMcpCommitResult {
  readonly stagedNames: readonly string[];
  readonly recorded: readonly StagedMcpRecord[];
  readonly warnings: readonly string[];
}
...
export interface UnstageMcpResult {
  readonly removedNames: readonly string[];
  readonly warnings: readonly string[];
}
```
(`:53-59`, `:110-113`). Use `readonly commentsDropped?: { readonly path: string; readonly scope: Scope }` or a small union; with `exactOptionalPropertyTypes`, set it conditionally (see `StaleSourceCloneError` `if (x !== undefined) this.x = x` pattern in CONVENTIONS). Update the header comment (`:10-14`, "scoped `mcp.json`").

---

### `E/persistence/locations.ts` (config)

**Analog:** `mcpJsonPath`.
- Interface member (`:57-58`): `/** \`<scopeRoot>/mcp.json\` -- MCP server registry (SC-2). */ readonly mcpJsonPath: string;` -> add `mcpAdapterJsonPath` immediately after, and mark `mcpJsonPath` legacy (read/sweep only).
- Construction (`:203`): `const mcpJsonPath = path.join(scopeRoot, "mcp.json");` -> add `path.join(scopeRoot, "mcp-adapter.json")`.
- Frozen bundle (`:282`): add the member after `mcpJsonPath`.
- Covered by the T-03-04 suffix-only disposition comment (`:250-258`); no `assertPathInside`.
- Brand pin `locations.ts:41:3` is above the insertion and does not move.

Test: `tests/persistence/locations.test.ts` (key list + per-scope paths).

---

### `E/shared/errors-bridges.ts` (typed errors)

**Analog for the new parse error:** `WorkflowTargetOccupiedError` (`:105-118`):
```typescript
export class WorkflowTargetOccupiedError extends Error {
  readonly targetPath: string;
  constructor(targetPath: string) {
    super(`Cannot replace workflow target with non-previous content at ${targetPath}`);
    this.name = "WorkflowTargetOccupiedError";
    this.targetPath = targetPath;
  }
}
```
New class carries `readonly filePath: string` (and optionally a non-content discriminant such as `reason: "parse" | "top-level" | "servers-key"`), doc comment citing AFILE-02, message names the file and says "not valid JSONC" -- never the raw `SyntaxError.message`. Fold the private `MalformedMcpServersError` (`stage.ts:93-103`) into it or move it here.

**Collision error extension** (`:50-65`):
```typescript
export class McpServerCollisionError extends Error {
  readonly serverName: string;
  readonly owningPath: string;
  constructor(serverName: string, owningPath: string) {
    super(`Refusing to stage MCP server "${serverName}": already exists in ${owningPath}.`);
```
Add `readonly winningPath` (AFILE-05) -- use an opts bag if more optional fields come. Consumers: `tests/shared/errors-bridges.test.ts`, `stage.test.ts`, `update-flow.test.ts`, `reinstall-flow.test.ts`.

---

### `E/orchestrators/plugin/install-outcome.ts` `mcpPhase` (D-02-11)

**Current** (`:947-979`): `do` = `prepareStageMcpServers` + `commitPreparedMcp`, pushes `result.warnings` into `c.bridgeWarnings`; `undo` = `unstageMcpServers`.

**Analog to copy:** reinstall's handle flow, `E/orchestrators/plugin/reinstall-replace.ts`:
```typescript
    const mcp = await operations.replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
...
    case "mcp":
      return operations.rollbackMcpReplacement(entry.handle);
...
    case "mcp":
      return operations.finalizeMcpReplacement(entry.handle);
```
(`:483-484`, `:678-679`, `:709-710`). In the ledger: store the `McpReplacement` on the context (replacing `c.mcpPrep`), `do` calls `replacePreparedMcp(prep)` and reads `prep.kind === "staged" ? prep.result : prep.result` for `recorded`/notice; `undo` calls `rollbackMcpReplacement(handle)` and pushes returned leak strings like the other phases' undo leaks. `InstallLedgerContext` is module-private -- keep the handle there. `enable-disable.ts` inherits this via `runInstallLedger`. Existing install-outcome tests asserting an unstage on undo change.

---

### `E/orchestrators/plugin/prune-rollback.ts` (snapshot)

**Analog:** itself, the `mcp` snapshot (`:315-321`) and restore loop (`:354`):
```typescript
    mcp = await snapshotPath(
      locations.scopeRoot,
      locations.mcpJsonPath,
      "mcp",
      backupRoot,
      targets.length + 1,
    );
...
      for (const saved of [agentsIndex, mcp]) {
```
Add `mcpAdapter = await snapshotPath(locations.scopeRoot, locations.mcpAdapterJsonPath, "mcp adapter", backupRoot, targets.length + 2)`, bump `state` to `+ 3`, add to the `entries` array (`:328`) and the restore loop. Keep `mcp.json` (D-02-04/D-02-12 sweep).

---

### `E/orchestrators/marketplace/shared.ts` (`cascadeUnstagePlugin` / `UnstageOutcome`)

**Analog:** the mcp slot (`:413-418`):
```typescript
    const mcpResult = await unstageMcpServers({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.mcpServers = [...mcpResult.removedNames];
```
Carry `mcpResult.commentsDropped` onto `UnstageOutcome` (`:317+`, readonly optional field documented like `dropped`). Callers (uninstall, disable, marketplace remove, install-cascade undo, `operations.ts`) then route it.

---

### Notice routing per verb (D-02-09)

**Analog helper:** `E/orchestrators/plugin/shared.ts:1583-1603`:
```typescript
export function surfaceDiscoveryWarnings(ctx: NotificationContext, args: {
    readonly plugin: string;
    readonly verb: "installed" | "updated" | "reinstalled";
    readonly warnings: readonly string[];
  }): void {
  if (args.warnings.length === 0) { return; }
  const lines = args.warnings.map((w) => redactAbsolutePaths(w));
  const header = ...;
  notifyDiagnostic(ctx, header, lines);
}
```
Write one sibling helper (e.g. `surfaceAdapterCommentsDropped(ctx, notice)`) that composes the catalog byte form once and calls a notify seam. It must name scope + `mcp-adapter.json` because `redactAbsolutePaths` collapses paths to basenames. Call sites to mirror: `install-flow.ts:2077`, `reinstall-flow.ts:598`, `update-flow.ts:400`; cascade surfaces `reconcile/apply.ts:1474-1482`, `import/execute.ts:1440` (`postCommitWarnings` -> `notifyDiagnostic`). Do NOT put the notice in `result.warnings` -- `collectPostCommitWarnings` (`install-flow.ts:715-730`) drops hygiene strings in standalone mode, and `splitStagingWarnings` (`plugin/shared.ts:1551-1561`) classifies mcp as hygiene.

**Notify seam analog** (if a dedicated dispatch function is added; preferred so the byte-lock test drives one function): `E/shared/notification-dispatch.ts:202-207`:
```typescript
export function notifyStopHookOverrideCap(ctx: NotificationContext, pluginId: string): void {
  ctx.ui.notify(
    `Stop hook override cap reached.\n\n\`${pluginId}\`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.`,
    "warning",
  );
}
```
Add it to the list of direct-notify seams in the comment at `:88`. Summary line, blank line, detail block (GRAM-01/02, Error/Warning label grammar memory).

---

### `docs/output-catalog.md` (catalog amendment)

**Analog:** `:4135-4146`:
````markdown
### Stop hook override cap reached (STOP-07 / D-88-01)

<!-- catalog-state: stop-override-cap -->

```text
Stop hook override cap reached.

`ralph-wiggum`'s Stop hook blocked 8 times in a row; ...
```

Emitted exactly once by ... Severity: `warning` ... The byte form is locked by `tests/architecture/hooks-cap-notify.test.ts` (NOT `catalog-contract.test.ts`, ...).
````
New section with its own `catalog-state` id, cite AFILE-04, list every emitting verb (D-02-09), severity `warning`, name the byte-lock test. Also add a block for the D-02-14 "unparseable file left untouched" notice if it is user-visible. Separately, review prune states at `:1442-1485` naming `mcp.json` (Pitfall 10) and fixture `tests/architecture/catalog-uat/fixtures/plugin-prune.ts:376,413`. Markdown is formatted by mdformat, not prettier.

---

### `tests/architecture/<name>-notify.test.ts` (NEW byte-lock)

**Analog:** `tests/architecture/hooks-cap-notify.test.ts` (whole file). Copy: imports (`:16-26`), `const [OUTPUT_CATALOG_REL] = VOCABULARY_GUARD_DOC_TARGETS;` (`:31`), `readCatalogBlock` fence walker (`:43-91`, including the D-07-03 empty-block assert), `makeCtx` with `mock.fn()` (`:93-102`), three tests: one call at `"warning"`, summary + `\n\n` structure, byte-equal to the catalog block. Note `readCatalogBlock` is duplicated per file; fallow dupes threshold 3 -- consider whether a shared test helper already exists or extract one (do not leave a new clone group). If the test names a production path, register it as a full literal in `tests/architecture/gate-targets.ts` (D-07-05/06).

---

### Bridge unit tests (NEW/MODIFY)

**Analog:** `tests/bridges/mcp/unstage.test.ts:1-40`: real temp dir via `mkdtemp` + `t.after(rm ...)`, `locationsFor("project", cwd)`, stored bytes as a template literal, `// arrange / act / assert`, whole-bytes compare after write. `adapter-doc.test.ts` is the pair for the new module (100% direct coverage); fixtures must include BOM, `//` and `/* */`, trailing commas, CRLF, `mcp-servers`, `{ "disabled": true }` stub, a secret-shaped token absent from the error chain, and a differential assert against `JSON.parse(stripJsonComments(..., { trailingCommas: true }))`. `adapter-entry.test.ts` vendors the 35-key adapter 5.0.0 `ServerEntry` list with a provenance comment and asserts the whole entry.

## Shared Patterns

### Typed errors
**Source:** `E/shared/errors-bridges.ts:50-65, 105-118`. `extends Error`, `this.name = "<Class>"`, readonly structured fields, doc comment citing AFILE-0N; callers narrow by `instanceof`. Raw parse cause must not reach the cause chain (Pitfall 7).

### `__proto__`-safe copies
**Source:** `E/bridges/mcp/safe-set.ts` used at `stage.ts:146, 224`, `unstage.ts:90`. Every server-name copy, in both keys and the overlay bucket.

### Atomic write / byte restore
**Source:** `E/shared/atomic-json.ts::atomicWriteJson` (`stage.ts:349`, `unstage.ts:100`); byte restore via `writeFileAtomic(path, oldText, { encoding: "utf8" })` (`stage.ts:389-396`).

### Notify only via dispatch (IL-2)
**Source:** `E/shared/notification-dispatch.ts:144-154, 202-207`. Bridges return structured facts; orchestrators notify.

### Comments
Cite AFILE-0N / MC-N / NFR-N, never `D-02-NN`, no phase numbers, present tense (rewrite the "four-slot" / "scoped mcp.json" headers in `stage.ts:1-19`, `unstage.ts:1-22`, `collision-slots.ts:1-28`, `types.ts:10-14`, `marker.ts:3-10`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `package.json` dependency `strip-json-comments@^5.0.3` | config | n/a | First JSONC runtime dependency; justify per D-02-08 and commit the lockfile |

## Metadata

**Analog search scope:** `E/bridges/mcp/`, `E/persistence/`, `E/shared/`, `E/orchestrators/{plugin,marketplace}/`, `tests/architecture/`, `tests/bridges/mcp/`, `docs/output-catalog.md`
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-02
