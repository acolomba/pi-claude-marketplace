# Research Pass: v1.1 Reinstall Command Architecture

## Recommendation

Add a dedicated `reinstall` path rather than composing `uninstall + install` or reusing `update` as-is.

Reason: `uninstall` intentionally removes resources before deleting state (`orchestrators/plugin/uninstall.ts:100-136`), and `update` currently saves the new state before physical replacement (`orchestrators/plugin/update.ts:571-588`) then uses bridge commits that remove old targets before renaming new ones (`bridges/skills/stage.ts:177-205`, `bridges/commands/stage.ts:168-196`). Those are acceptable for their existing contracts but do not satisfy v1.1's stronger requirement: failed reinstall must preserve the previous installed plugin and resources.

## Recommended Components

### New orchestrator

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
  - Target union analogous to update:
    - `{ kind: "all" }`
    - `{ kind: "marketplace"; marketplace }`
    - `{ kind: "plugin"; plugin; marketplace }`
  - Enumeration should mirror `update` target resolution (`update.ts:801-858`): bare target scans installed plugins; marketplace/plugin target resolves scope via `resolveScopeFromState` when `--scope` is omitted.
  - No `gitOps`, `DEFAULT_GIT_OPS`, `platform/git`, or `refreshGitHubClone` import. Reinstall must read cached `mp.manifestPath` only, matching install's no-network pattern (`install.ts:200-226`).

### New transaction primitive

- Add a lock-only/manual-save helper in `transaction/with-state-guard.ts`, e.g. `withStateLock(locations, callback)` or `withLockedStateTransaction`.
- Why: current `withStateGuard` hides `saveState` after the callback returns (`with-state-guard.ts:80-83`), so an orchestrator cannot rollback already-swapped physical resources if `saveState` fails. Reinstall needs lock-held control over:
  1. load fresh state,
  2. prepare,
  3. physical swap with backups,
  4. save state,
  5. rollback physical swap if save fails.
- Preserve existing `withStateGuard` for install/update/uninstall.

### New bridge replacement APIs

Add reinstall-specific commit/rollback helpers inside bridge modules so orchestrators do not read underscore/private fields from prepared handles.

Suggested shape per bridge:

```ts
const replacement = await replacePreparedSkillsAtomically(prepared);
// later on failure:
await rollbackSkillsReplacement(replacement);
// later on success:
await finalizeSkillsReplacement(replacement); // cleanup backups
```

Bridge-specific notes:

- **Skills**: current commit removes previous directories before rename (`skills/stage.ts:195-205`), which can leave old skills absent on rename failure. New helper should move old skill dirs to a same-filesystem backup under `skills-staging`, rename staged dirs into place, and restore backups on failure.
- **Commands**: command targets are files, but old commands that disappear in the new reinstall still need a backup until all phases and state save succeed. Use backup for removed names; direct rename-over-existing is OK for same-name replacements on POSIX but backup keeps rollback uniform.
- **Agents**: current commit can remove old agent files before writing new files and saves `agents-index.json` last (`agents/stage.ts:276-285`). New helper must backup old agent files and old index contents, write new files/index, and restore both on rollback. Treat same-plugin foreign-content previous entries as a hard reinstall failure or preserve them without overwrite; do not reuse the current soft-warning path if it can overwrite foreign files.
- **MCP**: `commitPreparedMcp` uses atomic JSON write (`mcp/stage.ts:199-224`), so write failure preserves old `mcp.json`. For rollback after later phase/state failure, keep the old doc from prepare/commit and atomic-write it back.

### Edge wiring

- Add `edge/handlers/plugin/reinstall.ts`, modeled on `edge/handlers/plugin/update.ts:21-65`.
- Modify:
  - `edge/router.ts`: add `reinstall` to `SubcommandHandlers`, usage, and switch (`router.ts:31-50`, `92-103`).
  - `edge/register.ts`: add `reinstall: makeReinstallHandler(pi)` to handlers (`register.ts:72-84`).
  - `edge/completions/provider.ts`: add top-level completion and plugin-ref completion. Completion behavior should match update: installed-only refs and `@marketplace` allowed (`provider.ts:43-44`, `161-188`).
  - `edge/completions/data.ts`: extend `PluginRefCompletionMode` from `install|uninstall|update` to include `reinstall`, with status filter `installed` like update/uninstall (`data.ts:221-263`).

## Recommended Data Flow Per Plugin

Under the per-scope state lock:

1. Load fresh state (`loadState`) and locate installed record.
2. If marketplace/plugin record is absent, return a skipped outcome; do not uninstall or mutate.
3. Load cached marketplace manifest from `mp.manifestPath`; no network sync.
4. Find entry, validate with `PLUGIN_ENTRY_VALIDATOR`, resolve with `resolveStrict`, `requireInstallable`.
5. Use **recorded installed version** from the existing state record as the post-reinstall `version`; do not call git/network and do not upgrade to a newer manifest version. Reinstall is not update.
6. Discover generated names and run `assertNoCrossPluginConflicts` against state with this plugin's own record removed, matching update's self-exemption (`update.ts:566-569`, `867+`).
7. Prepare all bridge handles into staging before removing any old resource (`prepareStage*` already stages under bridge staging dirs; see skills `84-174`, commands `91-165`, agents `70-247`, MCP `160-224`).
8. Execute backup-capable physical replacement in bridge order: skills → commands → agents → MCP.
9. Mutate state record only after physical replacement succeeds:
   - preserve `installedAt`,
   - set `updatedAt` to now,
   - keep `version` = old record version,
   - update `resolvedSource`, `compatibility`, and `resources` from prepared results.
10. Save state atomically (`saveState` uses `atomicWriteJson`; `state-io.ts:208-224`).
11. If any replacement or state save fails, rollback all already-replaced bridges in reverse order and leave state on disk unchanged.
12. On success only: drop completion cache, delete plugin data dir, emit reload hint and soft-dep warnings.

## Atomicity Strategy

- Hold the existing per-scope lock for the whole per-plugin reinstall. `withStateGuard` already uses `proper-lockfile` with `.state-lock` (`with-state-guard.ts:55-72`); expose/reuse that locking without auto-save.
- Prepare first; preparation failures abort staging and leave old resources/state untouched.
- Physical replacement must be backup-backed and reversible. Current bridge `commitPrepared*` functions are not sufficient because they delete old targets before new targets are guaranteed.
- Save `state.json` after physical replacement. If save fails, rollback physical resources from backups while state remains old.
- Clean plugin data dir only after physical replacement and state save both succeed. Cleanup failure should be warning severity, not reinstall failure, analogous to uninstall data cleanup warnings (`uninstall.ts:167-186`).

Known hard limit: no portable Node API provides atomic multi-file/directory exchange. The practical contract should be "fail-clean with best-effort rollback; if rollback itself fails, surface manual recovery with exact paths." This is stronger than update's current recovery-hint model but cannot be mathematically all-or-nothing across multiple filesystem objects.

## New vs Modified Files

### New

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts`
- Tests:
  - `tests/orchestrators/plugin/reinstall.test.ts`
  - `tests/edge/handlers/plugin/reinstall.test.ts`
  - router/completion tests updated or new focused cases

### Modified

- `transaction/with-state-guard.ts` -- add lock-only/manual-save helper.
- Bridge stage modules/types/barrels for backup-capable replacement APIs:
  - `bridges/skills/stage.ts`, `types.ts`, `index.ts`
  - `bridges/commands/stage.ts`, `types.ts`, `index.ts`
  - `bridges/agents/stage.ts`, `types.ts`, `index.ts`
  - `bridges/mcp/stage.ts`, `types.ts`, `index.ts`
- Edge wiring:
  - `edge/router.ts`
  - `edge/register.ts`
  - `edge/completions/provider.ts`
  - `edge/completions/data.ts`
- Architecture test:
  - extend `tests/architecture/no-orchestrator-network.test.ts` to include `orchestrators/plugin/reinstall.ts`.

## Suggested Build Order

1. Add tests/fixtures around one simple skill+command plugin and target parsing.
2. Add lock-only transaction helper with focused tests for lock-held behavior and save failure handling.
3. Add bridge backup replacement APIs one bridge at a time, with failure injection tests proving old resource restoration.
4. Implement single-plugin `reinstall` orchestrator core.
5. Add batch enumeration/partition rendering analogous to update.
6. Wire edge handler/router/register/completions.
7. Add no-network architecture guard and run `npm run check`.

## Validation Focus

- Reinstall a single installed plugin succeeds even when manifest version differs; state version remains the old recorded version.
- Missing manifest entry / not installable / prepare failure leaves old state and old resource bytes unchanged.
- Inject commit failure in each bridge: old resources and state remain unchanged; staging/backups are cleaned or reported.
- Inject `saveState` failure after physical swap: old resources restored and old state remains on disk.
- No `gitOps`/network imports in reinstall orchestrator.
- Plugin data dir is removed only after successful reinstall; cleanup failure is warning-only.
- Bare, `@marketplace`, and `plugin@marketplace` forms match update's scope behavior.

## Confidence

High on integration points and no-network/target-form behavior; medium on bridge-level atomic replacement details because true multi-resource atomicity is not available portably, so implementation must explicitly define rollback-failure/manual-recovery semantics.
