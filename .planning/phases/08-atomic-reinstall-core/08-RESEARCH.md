# Phase 8: Atomic Reinstall Core - Research

**Researched:** 2026-05-13
**Domain:** TypeScript plugin lifecycle transaction safety
**Confidence:** HIGH

## Summary

Phase 8 should implement reinstall as a dedicated single-plugin core path, not as `uninstall + install` and not as a thin wrapper around `update`. Existing `uninstallPlugin` intentionally removes state/resources before data cleanup, `installPlugin` rejects already-installed records, and `updatePlugins` imports Git refresh machinery and accepts a weaker state-first physical replacement recovery contract. Those properties conflict with Phase 8's guarantee that reinstall never leaves an installed plugin absent when preflight, preparation, bridge replacement, or state save fails.

The implementation needs no new runtime dependency. The existing strict TypeScript/ESM stack, `proper-lockfile` lock discipline, atomic JSON writer, bridge staging primitives, path-safety helpers, and `node:test` suite are sufficient. The missing pieces are shape-oriented: a lock-held manual-save transaction helper, backup/restore-capable bridge replacement APIs, a self-exempt cross-plugin conflict path, and a new `orchestrators/plugin/reinstall.ts` that reads cached manifests only and preserves the old installed version.

**Primary recommendation:** Land Phase 8 as four dependency-driven plans: transaction/no-network guard, skills+commands backup replacements, agents+MCP backup replacements, then the single-plugin reinstall orchestrator and tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A target with no installed record returns a clean `skipped` / `not-installed` core outcome and performs **no disk mutation**. Phase 9 may render this for a direct `plugin@marketplace` target as `No plugins installed.` or as an explicit skipped/not-installed line, but the Phase 8 core contract is non-mutating success/skip rather than an error.
- **D-02:** If an installed record exists but the cached marketplace manifest entry is missing, malformed, fails schema validation, or resolves as no longer installable, reinstall is a **failure** for that plugin. The previous installed state, generated resources, agents index, MCP entries, and plugin data directory must remain available.
- **D-03:** Reinstall reads only the marketplace manifest path recorded in `state.json` and uses the existing installed record's version as the post-reinstall version. It must not call `resolvePluginVersion`, compute a new content hash, refresh a clone, invoke `gitOps`, import `DEFAULT_GIT_OPS`, call `refreshGitHubClone`, or import `platform/git`.
- **D-04:** The per-scope `.state-lock` is held across the whole single-plugin reinstall transaction: load fresh state, validate installed record, load cached manifest, prepare all bridge replacements, perform backup-backed physical replacement, save `state.json`, rollback physical replacement if save fails, then release the lock.
- **D-05:** Phase 8 should add a lock-held/manual-save transaction helper, rather than forcing reinstall through existing `withStateGuard`, because `withStateGuard` auto-saves after the callback and does not let the orchestrator rollback already-swapped physical resources when `saveState` fails.
- **D-06:** Physical replacement uses backup/restore-capable bridge helpers. Existing `commitPrepared*` restage helpers are not sufficient for reinstall because they can delete old targets before later bridge/state failures are known.
- **D-07:** If rollback of a failed replacement also partially fails, surface the existing manual-recovery discipline: include `MANUAL RECOVERY REQUIRED:` plus exact failed rollback phases and paths. Do **not** add a reinstall-specific stable marker unless planning discovers the existing marker cannot carry the needed detail.
- **D-08:** The plugin data directory is deleted only after replacement resources and `state.json` commit both succeed. Cleanup failure emits a warning and does not turn the successful reinstall into failure.
- **D-09:** After successful reinstall, delete `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/` and leave it absent. Do not recreate an empty data directory as part of reinstall.
- **D-10:** Failed reinstall, including prepare failure, bridge replacement failure, state-save failure, or rollback path before success, must preserve the old plugin data directory.
- **D-11:** Default reinstall hard-blocks on foreign/manual previous agent content for this plugin. This is a reinstall failure before replacement; preserve old state/resources/data and require user intervention.
- **D-12:** `--force` is in scope for the reinstall feature. Phase 8 core should define a `force` boolean (or equivalent result/input field) that Phase 9 can expose through `/claude:plugin reinstall --force`.
- **D-13:** With `force: true`, reinstall may replace/overwrite foreign/manual previous agent content that belongs to the target plugin's existing agents-index rows. The force override is limited to this plugin's own previous agent targets; it must **not** override cross-plugin or cross-marketplace ownership conflicts, path-containment failures, unsafe names, or MCP collision rules.
- **D-14:** Forced replacement remains rollback-protected. If any later bridge/state failure occurs, rollback should restore backed-up forced-overwritten agent content when possible; rollback failure uses D-07 manual-recovery reporting.
- **D-15:** Cross-plugin generated-name checks must exclude the target plugin's current record so a reinstall with unchanged generated names does not self-conflict. Conflicts with other plugins in the same scope still hard-fail before mutation.
- **D-16:** MCP name/collision policy remains bridge-owned. Do not add ad-hoc MCP cross-plugin checks in the reinstall orchestrator; rely on MCP bridge preparation/replacement semantics.

### the agent's Discretion

- Exact TypeScript names for the lock/manual-save helper and bridge replacement handles.
- Exact rollback result type shape, as long as it can report bridge phase, path, original error, rollback error, and manual-recovery detail.
- Whether single-plugin core returns a discriminated `ReinstallOutcome` or throws for fatal failures and lets a wrapper normalize outcomes, as long as D-01/D-02 are honored.
- Backup directory naming and cleanup strategy under existing staging roots.
- The exact warning text for data-dir cleanup failure, provided it uses `ctx.ui.notify(..., "warning")` through existing notify wrappers.

### Deferred Ideas (OUT OF SCOPE)

- JSON output for reinstall results remains future work unless Phase 9 separately scopes it.
- Dry-run/preview mode remains future work.
- Interactive plugin selector remains future work.
- Mutating LLM tool for reinstall remains future work.
- Parallel/bulk reinstall execution remains Phase 9 or later; Phase 8 focuses on one plugin's atomic guarantee.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| PRL-02 | User can reinstall one installed plugin with `reinstall <plugin>@<marketplace>` | New `reinstallPlugin` core entrypoint accepts parsed `plugin`, `marketplace`, `scope`, `cwd`, and `force` options. |
| PRL-06 | Reinstall targets installed plugins only; empty target sets succeed with `No plugins installed.` and no reload hint | Core absent-record outcome should be `skipped/not-installed` with no disk mutation. Phase 9 renders empty sets. |
| PRL-07 | Reinstall uses cached marketplace manifests only and never performs network sync or Git operations | Architecture guard should include `orchestrators/plugin/reinstall.ts`; orchestrator must not import `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`, or `platform/git`. |
| PRL-08 | Reinstall preserves the installed record's existing version instead of recomputing or upgrading it | Orchestrator must use `oldRecord.version` and must not call `resolvePluginVersion` or `computeHashVersion`. |
| PRL-09 | Reinstall prepares replacement resources before removing old resources | Existing bridge `prepareStage*` APIs already stage new resources first; new replacement APIs perform backup-backed swaps. |
| PRL-10 | If reinstall preflight, preparation, replacement, or state save fails, previous plugin state/resources/data remain available | Requires lock-held manual-save helper and bridge rollback handles; tests must inject failures for prepare, replacement, and save. |
| PRL-11 | Reinstall deletes the plugin data directory only after replacement resources and state commit succeed | Data cleanup belongs after successful save; use `rm(dataDir, { recursive: true, force: true })`. |
| PRL-12 | Plugin data-directory cleanup failure is reported as a warning without turning successful reinstall into failed reinstall | Reuse uninstall warning pattern via `notifyWarning`; do not alter success outcome after cleanup failure. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
| --- | --- | --- | --- |
| TypeScript | package-managed | Strict ESM implementation | Existing project standard; no new language/runtime needed. |
| node:test | Node v26 locally, Node >=20.19.0 project floor | Unit/integration/architecture tests | Existing test suite uses `node --test`; fastest feedback for Phase 8. |
| proper-lockfile | package-managed | Per-scope `.state-lock` | Existing `withStateGuard` concurrency contract; reuse lock parameters. |
| write-file-atomic | v7 package choice | Atomic JSON writes via `atomicWriteJson` | Existing state/MCP/agents-index persistence primitive. |

### Supporting

| Library | Version | Purpose | When to Use |
| --- | --- | --- | --- |
| TypeBox | package-managed | Manifest and state schema validation | Validate cached manifest entries with `PLUGIN_ENTRY_VALIDATOR`. |
| isomorphic-git | package-managed | Marketplace update Git operations | **Do not use in reinstall.** Only update/add paths may touch Git. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| Dedicated reinstall transaction | `uninstallPlugin` then `installPlugin` | Violates preserve-old-on-failure because uninstall removes resources/state first and install rejects existing records. |
| Backup bridge replacement helpers | Existing `commitPrepared*` helpers | Current commit paths delete old targets before all later failures are known. |
| Manual-save lock helper | `withStateGuard` only | `withStateGuard` auto-saves after callback, preventing rollback after save failure. |

**Installation:** No package installation required.

## Architecture Patterns

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── transaction/with-state-guard.ts      # add lock-held manual-save helper
├── bridges/{skills,commands}/stage.ts   # backup replacement for directory/file resources
├── bridges/{agents,mcp}/stage.ts        # backup replacement for agents-index and mcp.json
└── orchestrators/plugin/reinstall.ts    # single-plugin reinstall core

tests/
├── transaction/with-state-guard.test.ts
├── bridges/{skills,commands,agents,mcp}/stage.test.ts
├── architecture/no-orchestrator-network.test.ts
└── orchestrators/plugin/reinstall.test.ts
```

### Pattern 1: Lock-held manual-save transaction

**What:** Expose a helper such as `withLockedStateTransaction(locations, callback)` that acquires the same per-scope lock as `withStateGuard`, loads fresh state, passes `{ state, save }` or `{ state, saveState }` to the callback, and releases the lock only after callback completion.

**When to use:** Reinstall only, because it must perform physical resource replacement and explicitly react to `saveState` failure while the lock remains held.

**Example:**

```typescript
await withLockedStateTransaction(locations, async ({ state, save }) => {
  // validate installed record from fresh state
  // prepare replacements
  const replacement = await replacePreparedSkills(prepared);
  try {
    mutateStateRecord(state);
    await save();
  } catch (err) {
    await rollbackSkillsReplacement(replacement);
    throw err;
  }
});
```

### Pattern 2: Bridge-owned backup replacement handles

**What:** Bridges expose opaque `replacePrepared*` / `rollback*Replacement` / `finalize*Replacement` helpers. Orchestrators do not read `_previousNames`, `_renamePairs`, `_nextDoc`, or other internal fields.

**When to use:** Physical reinstall replacement after all bridge prepare calls succeed.

**Bridge-specific guidance:**
- Skills: move old target dirs to backup under `skills-staging`, rename staged dirs into place, restore backups on rollback.
- Commands: move old prompt files to backup under `commands-staging`, rename staged files into place, restore backups on rollback.
- Agents: backup previous target files and `agents-index.json`, support default hard-block on `prepared.result.failed`, support force overwrite for target-plugin previous entries only, restore files/index on rollback.
- MCP: snapshot old `mcp.json`, atomic-write prepared doc, restore old doc on rollback.

### Pattern 3: Preflight failure before mutation

**What:** Installed-record absence is a clean skipped outcome, but installed-record + bad cached manifest entry is a failure. Manifest loading, entry validation, resolver strictness, cross-plugin conflict checks, and foreign-agent default block all happen before any target resource is moved.

**When to use:** Always in `reinstallPlugin` before replacement.

### Anti-Patterns to Avoid

- **Calling `updatePlugins` from reinstall:** update refreshes GitHub clones, recomputes versions, and treats equal versions as unchanged.
- **Calling `resolvePluginVersion`:** reinstall preserves `oldRecord.version` exactly.
- **Using bridge `commitPrepared*` directly for reinstall:** those helpers can remove old targets before later bridge/state failures.
- **Adding MCP conflict logic in orchestrator:** MCP collision policy is bridge-owned by `prepareStageMcpServers`.
- **Creating a new stable recovery marker by default:** use existing `MANUAL RECOVERY REQUIRED:` discipline unless truly insufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| Cross-process lock | Custom lock file protocol | Existing proper-lockfile parameters from `withStateGuard` | Preserves Phase 7 `.state-lock` semantics. |
| JSON atomic writes | Manual temp write/rename | `atomicWriteJson` via `saveState` and MCP/agents IO | Existing tested primitive and stable behavior. |
| Manifest parsing | Ad-hoc JSON shape checks | `loadMarketplaceManifest`, `PLUGIN_ENTRY_VALIDATOR`, `resolveStrict`, `requireInstallable` | Existing domain/schema validators. |
| User notifications | stdout/stderr or raw `ctx.ui.notify` scattered everywhere | `notifyError`, `notifySuccess`, `notifyWarning` | Output-channel discipline and testability. |
| Plugin data path | `path.join` in orchestrator | `locations.pluginDataDir(marketplace, plugin)` | Enforces safe names and containment. |

**Key insight:** The complex part is not discovering plugin resources; existing bridges do that. The complex part is preserving the old multi-resource install across partial replacement and save failure.

## Common Pitfalls

### Pitfall 1: Update's recovery model is too weak for reinstall

**What goes wrong:** A copied update flow saves state first, then physical replacement fails and leaves users with state pointing to new resources while old/new disk resources are partial.

**Why it happens:** `update.ts` accepts recovery-hint semantics. Phase 8 requires old install preservation.

**How to avoid:** Physical replacement must be backup-backed, followed by `saveState`, followed by rollback on save failure.

**Warning signs:** Reinstall imports `updatePlugins`, `DEFAULT_GIT_OPS`, or calls `commitPrepared*` directly.

### Pitfall 2: Self-conflict on unchanged generated names

**What goes wrong:** A reinstall of a plugin with unchanged skill/command/agent generated names fails because the current plugin owns those names.

**Why it happens:** `assertNoCrossPluginConflicts` scans all state owners.

**How to avoid:** Remove/exclude the target plugin record from the state snapshot used for conflict checks, matching the update self-exemption pattern.

### Pitfall 3: Foreign agent content is accidentally overwritten by default

**What goes wrong:** A user's manually edited/generated agent target is overwritten during reinstall.

**Why it happens:** Current agents bridge soft-fails foreign previous content for install/update-style semantics.

**How to avoid:** Default reinstall inspects `prepared.result.failed`; if non-empty and `force !== true`, throw before replacement. Force mode must be limited to this plugin's own previous index rows and must remain rollback-protected.

### Pitfall 4: Data directory cleanup changes failure semantics

**What goes wrong:** Successful reinstall is reported as failed because data-dir deletion hit EACCES.

**Why it happens:** Cleanup is implemented inside the transaction or as a thrown post-success step.

**How to avoid:** Run cleanup after state save and replacement finalization; catch and `notifyWarning` only.

### Pitfall 5: Rollback failure lacks actionable recovery detail

**What goes wrong:** The old state remains on disk but some resources were not restored, and the user gets a generic error.

**Why it happens:** Rollback errors are swallowed or collapsed.

**How to avoid:** Aggregate rollback failures by bridge phase/path and include `MANUAL RECOVERY REQUIRED:` with exact details.

## Code Examples

### Existing state guard lock parameters to reuse

```typescript
release = await lockfile.lock(locations.extensionRoot, {
  lockfilePath: locations.stateLockFile,
  realpath: false,
  retries: 0,
  stale: 10_000,
  update: 2_000,
});
```

### Existing post-success data cleanup warning pattern

```typescript
try {
  await rm(dataDir, { recursive: true, force: true });
} catch (err) {
  notifyWarning(ctx, `Plugin "${plugin}" reinstalled; data cleanup deferred at ${dataDir}: ${errorMessage(err)}`);
}
```

### Existing no-network architecture guard pattern

```typescript
const FORBIDDEN_PATTERNS = [
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| --- | --- | --- | --- |
| Last-writer-wins state writes only | Per-scope `.state-lock` around mutation | Phase 7 | Reinstall can safely hold one writer across state/resource transaction. |
| Component paths replace defaults | Component paths supplement defaults | Phase 5 D-24 | Reinstall must use strict resolver like install/update, not custom resource discovery. |
| Update recovery hint on physical failure | Reinstall rollback to old resources | v1.1 Phase 8 | New backup APIs are required; update remains unchanged. |

**Deprecated/outdated:**
- `write-file-atomic@8` comments are stale; project intentionally uses `write-file-atomic@7` after Node engine correction.
- PRD PI-15 old concurrent-install marker is superseded by Phase 7 lock-held marker semantics (PROJECT D-25).

## Open Questions

None requiring user input. Naming and exact result type shape are agent discretion, constrained by CONTEXT.md.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node.js | `node --test`, TypeScript tooling | ✓ | v26.0.0 | CI validates supported Node separately. |
| npm | `npm run check` | ✓ | package-managed | None needed. |
| Git | documentation commit only | ✓ | repository present | No runtime dependency for reinstall. |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
| --- | --- |
| Framework | Node built-in `node:test` with TypeScript ESM runtime |
| Config file | none -- tests are run through package scripts |
| Quick run command | `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
| --- | --- | --- | --- | --- |
| PRL-02 | Single installed plugin can reinstall | unit/integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ❌ Wave 2 |
| PRL-06 | Missing installed record is skipped without mutation | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ❌ Wave 2 |
| PRL-07 | No Git/network surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ |
| PRL-08 | Recorded version preserved | unit/integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ❌ Wave 2 |
| PRL-09 | Prepare before replacement | bridge unit | `node --test tests/bridges/{skills,commands,agents,mcp}/stage.test.ts` | ✅ (extend) |
| PRL-10 | Failure preserves old state/resources/data | bridge + orchestrator | `node --test tests/bridges/{skills,commands,agents,mcp}/stage.test.ts tests/orchestrators/plugin/reinstall.test.ts` | mixed |
| PRL-11 | Data dir deleted only after success | orchestrator unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ❌ Wave 2 |
| PRL-12 | Data cleanup failure warning-only | orchestrator unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ❌ Wave 2 |

### Sampling Rate

- **Per task commit:** Run the task's focused `node --test ...` command.
- **Per wave merge:** Run `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"`.
- **Phase gate:** Run `npm run check` before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/orchestrators/plugin/reinstall.test.ts` -- covers PRL-02/06/08/10/11/12.
- [ ] Bridge stage tests need focused replacement/rollback cases for PRL-09/10.
- [ ] `tests/architecture/no-orchestrator-network.test.ts` must include reinstall target for PRL-07.

## Sources

### Primary (HIGH confidence)

- `.planning/ROADMAP.md` -- Phase 8 goal and requirements.
- `.planning/REQUIREMENTS.md` -- PRL-02 and PRL-06 through PRL-12 definitions.
- `.planning/phases/08-atomic-reinstall-core/08-CONTEXT.md` -- locked user decisions D-01 through D-16.
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,FEATURES,STACK}.md` -- milestone research pass.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install,update,uninstall,shared}.ts` -- lifecycle precedents and pitfalls.
- `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp}/stage.ts` -- current prepare/commit limitations.
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` -- existing lock semantics.
- `tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts` -- validation patterns.

### Secondary (MEDIUM confidence)

- Prior Phase 5/6/7 context documents for decisions about transaction, edge, and integration boundaries.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- existing dependencies and scripts are sufficient.
- Architecture: HIGH -- integration points are explicit in current source and prior research.
- Pitfalls: HIGH -- failure modes are directly visible in current commit helpers and orchestrators.

**Research date:** 2026-05-13
**Valid until:** 2026-06-12
