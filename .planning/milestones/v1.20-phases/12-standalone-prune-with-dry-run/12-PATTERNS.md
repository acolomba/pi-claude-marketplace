# Phase 12: Standalone prune with dry-run - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 31 prospective paths
**Analogs found:** 31 / 31

All analogs named below are git-tracked. The paths are planning candidates from CONTEXT.md and RESEARCH.md, not a mandate to change every file. The research specifically calls for a new handler, paired tests, and an integration test; other paths are existing owners to amend as needed.

## File Classification

| New/modified file | Role | Data flow | Closest tracked analog | Match |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts` | controller | request-response | `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` | exact |
| `extensions/pi-claude-marketplace/edge/router.ts`, `edge/register.ts`, `edge/flag-catalog.ts`, `edge/completions/provider.ts` | route/config | request-response | same respective file | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` | service | batch | same file | exact |
| `extensions/pi-claude-marketplace/domain/dependency-orphans.ts` | utility | transform | same file | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `operations.ts` | service | batch, file-I/O | same respective file | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts` (if extracted) | service | batch, file-I/O | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | exact |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | service | file-I/O | same file | exact |
| `extensions/pi-claude-marketplace/shared/notification-types.ts`, `notification-grammar.ts`, `notification-dispatch.ts` | model/utility | transform, event-driven | same respective file | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` (or new `prune.messaging.ts`) | utility | transform | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` | exact |
| `tests/edge/handlers/plugin/prune.test.ts` | test | request-response | `tests/edge/handlers/plugin/uninstall.test.ts` | exact |
| `tests/orchestrators/plugin/prune.test.ts`, `tests/integration/standalone-prune.test.ts` | test | batch, file-I/O | `tests/orchestrators/plugin/uninstall.test.ts` | role/data-flow match |
| `tests/orchestrators/plugin/dependency-index.test.ts`, `uninstall.test.ts`, `operations.test.ts`; `tests/domain/dependency-orphans.test.ts`; `tests/persistence/state-io.test.ts` | test | batch, file-I/O | same respective file | exact |
| `tests/edge/router.test.ts`, `tests/edge/completions/provider.test.ts`; `tests/architecture/flag-catalog-drift.test.ts` | test | request-response | same respective file | exact |
| `tests/shared/notification-grammar.test.ts`; `tests/architecture/catalog-uat/catalog-contract.test.ts`, `catalog-parser.test.ts`, `notify-closed-set-locks.test.ts` | test | transform | same respective file | exact |
| `docs/output-catalog.md`, `docs/messaging-style-guide.md`, `docs/dependency-resolution.md`, `README.md`, `.planning/BACKLOG.md` | documentation | reference | same respective file | exact |

## Pattern Assignments

### Command boundary: `edge/handlers/plugin/prune.ts`, `edge/router.ts`, `edge/register.ts`, `edge/flag-catalog.ts`, completions

**Analog:** `edge/handlers/plugin/uninstall.ts:12-64`. The handler imports an operation factory and catalog-owned flag names, uses `extractLocalFlag(args, ctx, USAGE, { consumeLongFlags: passThroughFlagNames("uninstall") })`, returns on parse failure, then awaits the operation. For prune, use `passThroughFlagNames("prune")`, parse the residual as scope with zero positionals, and pass `dryRun` from the consumed flag. Do not reuse the plugin-reference parser: prune has no target.

```typescript
const CONSUMED_FLAGS = { consumeLongFlags: passThroughFlagNames("uninstall") };
const localFlag = extractLocalFlag(args, ctx, USAGE, CONSUMED_FLAGS);
if (localFlag === undefined) return;
```

**Router/registration:** `edge/router.ts:26-79,99-105,145-194` owns the handler interface, verb list, top-level usage, and dispatch switch. `edge/register.ts:92-105` constructs the handler and passes it into the router. Add prune in all four places. `edge/flag-catalog.ts:24-32,127-212` owns only extra per-verb flags; `--scope` is shared. A prune entry should contain exactly `--dry-run` with `parse: true, complete: true`; no `-y`, `--prune`, `--keep-data`, or `--local`. `tests/architecture/flag-catalog-drift.test.ts` independently pins accepted parse and completion sets.

### Selection and removal: `dependency-index.ts`, `dependency-orphans.ts`, `uninstall.ts`, `operations.ts`, optional `prune.ts`

**Analog:** `orchestrators/plugin/dependency-index.ts:113-116,130-140,184-220,231-254`. The index walks every installed record, reads its declarations offline, and returns either `{ok:false, declarer, cause}` or `{ok:true,index,candidates}`. Its required `exclude` currently omits uninstall's primary key at lines 239-241. Make exclusion optional or add a full-scope entry point; keep uninstall's exclusion. Unreadable declarations must end the whole walk. Disabled declarers remain in the index.

```typescript
const read = await readRecordDeclarations(options, marketplace, name);
if (!read.ok) return read;
index.set(key, new Set(read.declared.map(declarationKey)));
candidates.push({ key, provenance: record.provenance, marketplace, plugin: name, record });
```

**Pure selector:** `domain/dependency-orphans.ts:110-132` implements `pruneOrphans(records, index, removed)` as a sorted fixpoint. Standalone selection starts with an empty removed set. Use this same result for preview and actual execution; do not derive preview from a different predicate.

**Actual sweep:** `orchestrators/plugin/uninstall.ts:622-653` maps selected keys back to snapshot records, calls `isHeldBy` before each removal, and adds only successfully removed keys to `gone`. Preserve this failed-member hold rule. Its callers are in `uninstallPluginWithTransaction` (CodeGraph) and the factory is at `uninstall.ts:1276-1302`. `operations.ts:117-132` shows the production binding pattern:

```typescript
export function createUninstallOperation(
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): UninstallPluginOperation {
  return createUninstallPlugin(REAL_UNINSTALL_TRANSACTION, hooksRouting, completionCache);
}
```

The standalone operation should reuse the transaction owner and post-commit cleanup, without a fabricated primary plugin. Keep a single selected order across actual and preview rows; `composeRemovalBlocks` in `uninstall.messaging.ts:203-260` groups by marketplace and can change visible global order for interleaved marketplaces.

### Read-only state: `persistence/state-io.ts`

**Analog:** `persistence/state-io.ts:407-510`. `loadState` returns a default state for ENOENT, parses and validates JSON, normalizes legacy records, and fires `persistMigratedState` when `mutated` at lines 504-507. A dry-run read must suppress that write. The lock path in `transaction/with-state-guard.ts:83-165` creates a lock and extension root, so preview must not enter that transaction. Preserve the present load default for other callers; give the preview an explicit no-persist mode and test legacy state.

### Messages: notification types, grammar, dispatch, and command messaging

**Analog:** `shared/notification-types.ts:515-520` defines `PluginWillUninstallMessage` with status/name/scope but no reasons. `shared/notification-grammar.ts:830-852` renders pending rows; its `will uninstall` arm currently omits reasons:

```typescript
case "will uninstall":
  return joinTokens([ICON_AVAILABLE, p.name, bracket, "(will uninstall)"]);
```

Extend that row path to permit `{dependency pruned}` while preserving every existing plain pending row. Actual prune rows use `orchestrators/plugin/uninstall.messaging.ts:67-99`:

```typescript
const PRUNED_ROW_REASONS = ["dependency pruned"] as const satisfies readonly ContentReason[];
return { status: "uninstalled", name: args.plugin, version: args.version,
  reasons: PRUNED_ROW_REASONS, severity: "info", needsReload: true };
```

The shared notification dispatcher is the only user-output path (`shared/notification-dispatch.ts:36-75`); command code must use `notifyWithContext`/`ctx.ui.notify`, not direct stdout. Empty selection is a normal informational `Nothing to prune` message naming scope and cause. Update the closed catalog and its fixtures for both pending and actual bytes.

### Tests and documentation

Use the corresponding tracked tests listed in the table as direct analogs. The new handler test should pin exact accepted flags and no positional target. The new orchestrator and integration tests should prove same-scope fixpoint/order, failed-member holds, declaration-read refusal, offline behavior, and zero state/disk/lock writes for dry-run including legacy state. `tests/persistence/state-io.test.ts` is the direct migration-write regression home. `tests/architecture/catalog-uat/catalog-contract.test.ts` and `catalog-parser.test.ts` own output catalog conformance. `tests/shared/notification-grammar.test.ts` pins pending row bytes; `tests/architecture/notify-closed-set-locks.test.ts` guards the closed message union.

Amend the existing command and output sections in `README.md`, `docs/dependency-resolution.md`, `docs/output-catalog.md`, and `docs/messaging-style-guide.md`; close `PRUNE-CMD-01` in `.planning/BACKLOG.md`. Do not add the dropped `{orphaned}` list/info marker.

## Shared Patterns

- **Fail closed:** `dependency-index.ts:184-220,231-254` returns a declarer and cause before any sweep on unreadable declarations.
- **Removal safety:** `uninstall.ts:639-649` rechecks holds and adds only successful members to `gone`.
- **Scope and flags:** `edge/flag-catalog.ts:24-32` excludes shared `--scope` from each verb's extra flag set; router and handler use the same catalog names.
- **Output:** `uninstall.messaging.ts:62-99` uses a typed command context and `ContentReason`; `notification-grammar.ts:830-852` owns pending row rendering.
- **Persistence:** `state-io.ts:501-510` reveals a hidden migration write on read; preview needs an explicit nonpersisting load.

## No Analog Found

None. Standalone prune itself is new, but uninstall supplies an exact batch-removal analog and pending reconciliation supplies the preview row type.

## Metadata

**Analog search scope:** tracked `extensions/pi-claude-marketplace/`, `tests/`, `docs/`, README, and backlog.
**Primary analogs read:** uninstall handler/orchestrator/messaging, declaration index, state I/O, flag catalog, router, register, operations, notification types/grammar.
**Pattern extraction date:** 2026-09-23.
