---
phase: 02-adapter-file-delivery
reviewed: 2026-10-03T00:00:00Z
depth: standard
files_reviewed: 74
files_reviewed_list:
  - AGENTS.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
  - extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - package.json
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-block.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-prune.ts
  - tests/architecture/config-state-write-seams.test.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/bridges/mcp/adapter-doc.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/collision-ancestors.test.ts
  - tests/bridges/mcp/collision-slots.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/types.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/e2e/install-soft-deps.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-disable-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall-replace.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/reconcile/apply-outcomes.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/persistence/locations.test.ts
  - tests/shared/errors-bridges.test.ts
  - tests/shared/notification-dispatch.test.ts
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-03
**Depth:** standard
**Files Reviewed:** 74
**Status:** issues_found

## Summary

I reviewed the MCP bridge rewrite (`adapter-doc`, `adapter-entry`, `collision-*`,
`stage`, `unstage`) in full. I also read the phase's diff (`c6fa7367..HEAD`) in every
orchestrator that now routes `McpConfigNotice`s. The JSONC grammar, the
`mcp-servers` key choice, carry-forward and the nine-source walk all match the
locked decisions. One defect breaks the phase's core promise ("never lose or
corrupt anything the user or the adapter wrote"). The self-replace exemption in the
collision check reads owned entries from both server keys. When the plugin's old
entry sits under the shadowed key, a staged entry silently overwrites a user's own
full server definition of the same name. I reproduced this against the real
`adapter-doc.ts` functions (CR-01).

The rest are notice-routing gaps on error paths and two partial readings of
D-02-11. I checked both gaps the executors already flagged against the code, and
both are real:

- **Known gap (1), confirmed.** `restoreMetadata` (`prune-rollback.ts:220-230`)
  never writes a target that differs from its backup. A rolled-back prune that
  rewrote `mcp-adapter.json` always reports `occupied metadata path`, and the file
  stays in its post-unstage form while `state.json` is restored. See WR-04.
- **Known gap (2), confirmed.** `runRemoveOutcome` rethrows every non-sentinel
  error (`remove.ts:819-822`) before any notice call. The collected
  `mcpConfigNotices` are dropped. See WR-03.

The same notice-loss class also exists in places the executors did not flag:
install (WR-01), bulk update (WR-02) and the unstage bridge (WR-05).

## Structural Findings (fallow)

fallow found 5 duplicate-block candidates (`fallow audit --changed-since ebc971de^`). `npm run fallow` itself passes on percentage. All five are treated as candidates, not proven defects:

| # | File:line | Related file | Note |
|---|-----------|--------------|------|
| S-1 | `shared/notification-dispatch.ts:453` | same file | `emitCascadeWith` / `emitUpdateNoOpCascade` share their probe-and-block loop. This code was there before the phase; the phase only added `notifyMcpConfigNotices`. |
| S-2 | `orchestrators/plugin/install-flow.ts:1672` | same file | `buildInstallLedgerOptions` call shape inside the cascade options. This code was there before the phase. |
| S-3 | `orchestrators/plugin/enable-disable.ts:1779` | `install-flow.ts` | Hook hydration loop (`withHooks` / `hooksJsonPath`). This code was there before the phase. |
| S-4 | `orchestrators/plugin/reinstall.messaging.ts:371` | `reconcile/apply-outcomes.ts` | `dependenciesFromOutcome` / `dependenciesFromInstall` soft-dep list builders. This code was there before the phase. |
| S-5 | `orchestrators/plugin/install-flow.ts:826` | `uninstall.ts` | Workflow-staging GC try/catch and debug-log block. This code was there before the phase. |

None of the five clone groups comes from this phase's code. The phase did add one
real duplicated helper that fallow does not report (IN-03).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The self-replace exemption overwrites a user's full server definition when the plugin's old entry sits under the shadowed key

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:111-114`, `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:188-203`, `:259-286`
**Issue:** `partitionServers` builds `ours` from every server map (`ownedServers` walks `selectedKeyFirst`). It builds `theirs` from the selected key only. `assertNoMcpCollisions` then skips any name in `ours` (`if (Object.hasOwn(check.ours, name)) continue;`) before it looks at `theirs`. Here is how that goes wrong:

1. The file holds only `mcp-servers`, so the plugin's marked `x` was written there (AFILE-03).
2. Later the user, or another tool, adds an `mcpServers` key that holds the user's own full definition of `x`, for example with an `env` token. The adapter now loads `mcpServers` and ignores the plugin's `x`.
3. The plugin is updated or reinstalled. `ours.x` exists, so the collision check is skipped. `withPluginServers` keeps the user's `x` in the selected map (it is neither owned nor an overlay). Then `safeSet(target, "x", stamped)` replaces it.

The user's definition, credentials included, is deleted without a refusal or a notice.

I reproduced this with the real module. The input was `{"mcpServers":{"x":{"command":"user-own-server","env":{"TOKEN":"secret"}}},"mcp-servers":{"x":{...marked p@m...}}}`. `partitionServers` reported `ours has x: true theirs has x: true`, and `withPluginServers` returned `{"mcpServers":{"x":{"command":"plugin-new",...}},"mcp-servers":{}}`. This breaks the phase boundary ("never lose or corrupt anything the user ... wrote there") and AFILE-05. Before the phase, `ours` came from one key, so this could not happen. The both-key partition introduced it.
**Fix:** A foreign full definition under the selected key must refuse even when the plugin owns the name elsewhere. Exempt only a name the plugin owns under the selected key:
```ts
// stage.ts assertNoMcpCollisions
for (const name of check.names) {
  // A self-replace is exempt only when no foreign entry in the loaded map holds the name.
  if (Object.hasOwn(check.ours, name) && !Object.hasOwn(check.theirs, name)) {
    continue;
  }
  ...
}
```
Add a `stage.test.ts` case with the two-key fixture above. It should assert `McpServerCollisionError` and unchanged file bytes.

## Warnings

### WR-01: Install drops the comments-dropped notice when the config write-back or the save throws after a successful cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1480`, `:1590`, `:1733-1842`, `:1960`, `:2290`, `:2420`, `:2458`
**Issue:** `CascadeFailureSink.mcpConfigNotices` is only set by `unwrapCascade` on `member-failed`. On the success path, the cascade (and the landed-disabled disable cascade) has already rewritten `mcp-adapter.json` by the time several later steps run: `writeAdoptingConfigEntries`, `writeReEnabledCascadeMemberConfigEntries`, `writeOrchestratedDeclarations` and `tx.save()` (line 1842). Nothing rolls those artifacts back when one of these steps throws. The catch at line 1960 reports `cascadeFailure.mcpConfigNotices`, which is still `[]`. The same holds for:

- the promotion arm: `promoteDependencyRecord` re-materializes, then `tx.save()` at line 1590 throws;
- `installMissingDependencyWithTransaction`: `tx.save()` at line 2420, then the catch at line 2458.

Comments are lost without notice, which breaks D-02-09 ("AFILE-04 covers every path that rewrites the file"). Plan 02-07 fixed this same class in `enable-disable.ts` with a sink set before the throw points. Install was not given the same fix.
**Fix:** Write the notices onto the sink as soon as each rewrite returns, before any throw point:
```ts
const installed = unwrapCascade(cascade, capture, rootKey, cascadeFailure);
...
cascadeFailure.mcpConfigNotices = installed.mcpConfigNotices;          // after the cascade
...
cascadeFailure.mcpConfigNotices = mcpConfigNotices;                      // after disableFreshInstall
// promotion arm: cascadeFailure.mcpConfigNotices = promotion.mcpConfigNotices before tx.save()
```
Then add a test that injects a `tx.save()` failure over a commented file.

### WR-02: A bulk update that aborts on a thrown plugin or sync failure drops the notices of plugins it already updated

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:286-306`, `:322-339`
**Issue:** `surfaceUpdateMcpConfigNotices` runs only on the success path and on the phase-3a aggregate abort (lines 368, 378). The two `notifyDirectFailure(...); return;` arms skip it:

- the `syncCloneOnce` failure;
- the `runPluginUpdate` throw.

Earlier targets in `outcomes` have already committed and rewritten `mcp-adapter.json`, so their comments-dropped notices are lost. For example, plugins 1 to 3 in marketplace A update, then the sync of marketplace B fails. This is the same AFILE-04 / D-02-09 gap. The rows for those plugins were already missing before the phase, but the notices are new obligations that this phase took on.
**Fix:** Call `surfaceUpdateMcpConfigNotices(ctx, outcomes)` after `notifyDirectFailure` in both early-return arms. Better, also render the accumulated cascade, as the phase-3a arm does.

### WR-03: removeMarketplace loses collected MCP notices when its state transaction throws (known gap 2, confirmed)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:796-828`
**Issue:** I confirmed this on the code. `cascadePluginsInPlace` pushes each cascade's notices into the hoisted `mcpConfigNotices`. When `withLockedStateTransaction` throws anything other than `cfgInvalidSentinel`, for example `tx.save()` or the config write in `runRemoveLockBody`, the catch rethrows at line 821 before either notify site. Standalone mode shows no notice. In a reconcile, `applyMarketplaceRemoves` turns the throw into an `mp-remove-failed` row with no notices (`apply.ts:286`). The plugin cascades have already rewritten `mcp-adapter.json` and `mcp.json` by then.
**Fix:** In the catch, before the rethrow, call `notifyMcpConfigNotices(opts.ctx, mcpConfigNotices)` when `!orchestrated`. For orchestrated callers, attach the notices to a typed error, or return a `failed` outcome that carries `mcpConfigNotices` instead of rethrowing.

### WR-04: A rolled-back prune never restores mcp-adapter.json, leaving state and the adapter file out of step (known gap 1, confirmed)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:220-230`, `:323-331`, `:364-372`
**Issue:** I confirmed this on the code. `restoreMetadata` returns only when the target already matches its backup. Otherwise it throws `Prune rollback found an occupied metadata path`. The prune's own unstage always changes `mcp-adapter.json` when a pruned member had MCP servers, so every rollback over such a member ends this way. Three problems follow:

- The swept members' entries are not restored. `state.json` is restored and still records them, so state and the file disagree until a manual merge from `prune-backup-*/` (NFR-3).
- The message blames "other writers" for a change this same prune made.
- The comments are gone from the live file. No comments-dropped notice is sent; the rollback-failed row names the file instead.

This behavior was already there for `mcp.json` and `agents-index.json`. The phase extends it to the file that now holds every plugin entry.
**Fix:** Record, per metadata target, the bytes this prune wrote (or their hash) right after the unstage. In `restoreMetadata`, restore the backup when the live file still equals what this prune wrote, and keep the "occupied" refusal for a real third-party change. At minimum, reword the error so it does not claim an outside writer.

### WR-05: An unstage that fails on the legacy write loses the adapter file's notice and reports no dropped MCP servers

**File:** `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:285-288`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:432-438`
**Issue:** `unstageMcpServers` writes `mcp-adapter.json` first, then `mcp.json`. It builds `notices` only after both writes succeed. If the second `atomicWriteJson` throws (EACCES, ENOSPC), the adapter file is already rewritten, with comments dropped and owned entries removed, but the function throws. `cascadeUnstagePlugin` then keeps `mcpConfigNotices = []` and `dropped.mcpServers = []` (both are assigned after the `await`). Two things go wrong. The comment loss is not reported. And `applyPartialCascadeFold` keeps every MCP server name in the record even though they have left the adapter file. A retry is harmless (unstage is marker-keyed), but the user is never told about the comments.
**Fix:** Build the result per file as each write succeeds. On a throw, attach what was already done to the error, for example a typed `McpUnstagePartialError { removedNames, notices, cause }`, so `cascadeUnstagePlugin` can still fill `dropped.mcpServers` and `mcpConfigNotices`.

### WR-06: A failed multi-member install or enable cascade does not restore mcp-adapter.json bytes, which departs from D-02-11's wording

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1007-1070`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:830-857`
**Issue:** D-02-11 says: "A failed install restores the exact prior bytes of `mcp-adapter.json` ... instead of unstaging from the rewritten file." Only the inner per-plugin ledger does that (`install-outcome.ts` mcp phase). When member B of a dependency cascade fails, the outer undo for already-materialized member A calls `cascadeUnstagePlugin`. That unstages from the rewritten file, the exact pattern D-02-11 rules out. The install fails, yet the user's file comes back reformatted and without its comments. The enable cascade's `unstageBackToDisabled` does the same. Plan 02-04 narrowed D-02-11 to single-plugin installs and reports a notice instead. No SUMMARY records that narrowing as a deviation from a locked decision.
**Fix:** Snapshot the `mcp-adapter.json` text (as a Buffer, see WR-07) once, before the first member phase in `runInstallCascade` and `runEnableCascade*`. When the outer ledger unwinds with no rollback partials, write the snapshot back and drop the members' comments-dropped notices. Otherwise, take the narrowing back to the operator as an amendment to D-02-11.

### WR-07: The "exact prior bytes" restore decodes as UTF-8, so it is not byte-exact

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:301`, `:328-330`, `:361-371`
**Issue:** `replacePreparedMcp` captures `oldText` with `readFile(path, "utf8")`, and `rollbackMcpReplacement` writes that string back. Any byte sequence that is not valid UTF-8 becomes U+FFFD and stays that way after the restore. Such bytes can sit in a JSONC comment or in a string value; the file still parses, so the stage goes ahead. D-02-11 and T-02-15 promise the exact prior bytes. Install now relies on this path (it is no longer reinstall-only), so the gap affects every failed install.
**Fix:** Capture and restore raw bytes:
```ts
const oldBytes: Buffer | undefined = await readOptionalBytes(path); // readFile(path) without encoding
...
await writeFileAtomic(target, internals.oldBytes);
```

## Info

### IN-01: Stub absorption drops the stub's other fields without notice, and uninstall then loses the user's override

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:231-248`, `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:220-230`
**Issue:** D-02-10 copies only the carried fields from a marker-less stub. `withPluginServers` then removes the stub. Any other field the user put in it is deleted without a notice, for example an `env` or `headers` override for the same plugin installed in the other scope. After a later uninstall, D-02-07 has nothing left to preserve: the user's project-level `disabled: true` for the user-scope copy is gone, and the server comes back in that project. The locked decisions allow this, but the user is never told.
**Fix:** Consider a notice (closed-catalog amendment) when an absorbed stub carried fields outside `CARRIED_FIELDS`. Alternatively, record this in BACKLOG next to MCPOVR-01.

### IN-02: Update and reinstall leave the plugin's stale legacy mcp.json entries live until Phase 5

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:230`, `:282`
**Issue:** Staging rewrites only `mcp-adapter.json`. A server that the new plugin version drops or renames still has its marked entry in `<scopeRoot>/mcp.json`. The adapter keeps loading it (source 4 or 8), and only an unstage removes it (D-02-12). The release rule (Phases 2 to 5 in one release) keeps users from seeing this. Still, Phase 5's migration must move only names the current record lists, and must delete orphaned legacy entries rather than move them.
**Fix:** Add this as a Phase 5 note in ROADMAP. Optionally, have stage remove the plugin's legacy entries for names absent from `servers`.

### IN-03: Helpers duplicated across modules, with diverging policies

**File:** `orchestrators/plugin/install-flow.ts:648` and `orchestrators/marketplace/shared.ts:350` (`mcpConfigNoticesMember`), `orchestrators/reconcile/apply-outcomes.ts:688` (`carriedMcpConfigNotices`); `bridges/mcp/adapter-doc.ts:71`, `adapter-entry.ts:43`, `collision-slots.ts:121` (`isPlainObject` / `isSettingsObject`); `bridges/mcp/adapter-doc.ts:102` vs `stage.ts:361` (`readOptionalText`)
**Issue:** Three omit-when-empty spread helpers do the same job. The two `readOptionalText` copies treat errors differently: `adapter-doc` treats `ENOTDIR` as a missing file, while `stage.ts` throws on it. So prepare and replace can disagree about whether the file exists.
**Fix:** Have install-flow import `mcpConfigNoticesMember` from `marketplace/shared.ts`, as plan 02-06 intended. Export one `readOptionalText` from `adapter-doc.ts` and reuse it in `stage.ts`.

### IN-04: A non-object `mcp-servers` blocks every install and uninstall even when `mcpServers` is present and the adapter ignores `mcp-servers`

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:124-144`, `:174-175`
**Issue:** `collectServerMaps` validates every server key that is present. A file such as `{"mcpServers":{...},"mcp-servers":null}` loads fine in pi-mcp-adapter (it uses `mcpServers` and never reads `mcp-servers`). Here it raises `McpConfigFileError("mcp-servers-not-object")`. That refuses the install of every MCP plugin, and, through unstage, every uninstall, disable, marketplace remove and prune in that scope. The inverse case (`mcpServers: null`, which the adapter's `??` falls back from) also refuses. Refusing is safe, but stricter than D-02-01's "read with the adapter's grammar".
**Fix:** Validate only the selected key, and the other key when it holds an object; leave other values to pass through untouched via the `{ ...config.doc }` spread.

---

_Reviewed: 2026-10-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
