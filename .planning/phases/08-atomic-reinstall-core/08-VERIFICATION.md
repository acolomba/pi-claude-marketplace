---
phase: 08-atomic-reinstall-core
status: passed
verified: 2026-05-15T22:54:01Z
reverified: 2026-05-16T00:00:00Z
post_merge_status: passed
score: 5/5
requirements_verified: [PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12]
review_status: clean
human_verification_required: false
---

# Phase 08 Verification: Atomic Reinstall Core

## Verdict

**PASSED** - Phase 08 achieves its atomic single-plugin reinstall goal. The codebase contains a dedicated cached-manifest reinstall core, lock-held manual-save transaction support, rollback-safe bridge replacement helpers, and focused tests proving preservation of old installs across preflight, replacement, and state-save failures.

## Goal Coverage

| Success Criterion | Status | Evidence |
|------------------|--------|----------|
| Installed-only single-plugin target skips absent installs without mutation | Passed | `reinstallPlugin` returns `partition: "skipped"` / `notes: ["not installed"]` when the marketplace or plugin record is absent; covered by `PRL-06: absent installed record returns skipped and does not mutate state or disk`. |
| Cached manifest only; no Git/network helpers | Passed | `reinstall.ts` loads the installed marketplace record's `manifestPath` via `loadCachedEntry`; `tests/architecture/no-orchestrator-network.test.ts` includes `orchestrators/plugin/reinstall.ts` and forbids `platform/git`, `DEFAULT_GIT_OPS`, `gitOps`, and `refreshGitHubClone`. |
| Restages from cached manifest while preserving installed version | Passed | `updateStateRecord` and `successOutcome` both use `oldRecord.version`; covered by `PRL-08/11 happy: success preserves installed version, restages resources, deletes data, and refreshes`. |
| Failure before or during replacement/state-save preserves old state/resources/data | Passed | `runLockedReinstall` prepares all handles before replacement, uses `withLockedStateTransaction`, and rolls back replacements on replacement or `tx.save()` failure; tests cover missing cached entry, replacement failure, state-save failure, and force rollback. |
| Plugin data cleanup happens only after successful replacement and state commit; cleanup failure warns only | Passed | `runPostSuccessMaintenance` runs after a `reinstalled` outcome and reports cache/data cleanup failures as warnings; covered by `PRL-12: cache and data cleanup failures are warning-only after successful reinstall`. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` | Lock-held manual-save transaction helper | Verified | Exports `withLockedStateTransaction`; tests prove explicit save-only behavior, lock holding, and lock release on save/callback failure. |
| `tests/transaction/with-state-guard.test.ts` | Manual transaction coverage | Verified | Contains Phase 8 / PRL-10 tests for save-only semantics and lock behavior. |
| `tests/architecture/no-orchestrator-network.test.ts` | Reinstall no-network architecture guard | Verified | Guards `reinstall.ts` against Git/network surfaces including `refreshGitHubClone`. |
| `extensions/pi-claude-marketplace/bridges/skills/stage.ts` | Backup-backed skills replacement lifecycle | Verified | Exports `replacePreparedSkills`, `rollbackSkillsReplacement`, and `finalizeSkillsReplacement` through the skills barrel. |
| `extensions/pi-claude-marketplace/bridges/commands/stage.ts` | Backup-backed commands replacement lifecycle | Verified | Exports `replacePreparedCommands`, `rollbackCommandsReplacement`, and `finalizeCommandsReplacement` through the commands barrel. |
| `extensions/pi-claude-marketplace/bridges/agents/stage.ts` | Backup-backed agents replacement lifecycle with force support | Verified | `replacePreparedAgents` blocks prepared failures by default and accepts `force: true`; rollback restores files and `agents-index.json`. |
| `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` | Rollback-safe MCP replacement lifecycle | Verified | `replacePreparedMcp`, `rollbackMcpReplacement`, and `finalizeMcpReplacement` snapshot/restore scoped `mcp.json`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | Dedicated single-plugin reinstall core | Verified | Implements `reinstallPlugin`; composes cached-manifest preflight, bridge replacement, explicit state save, rollback, warnings, reload hints, and data cleanup. |
| `tests/orchestrators/plugin/reinstall.test.ts` | PRL-02/06/07/08/09/10/11/12 behavior coverage | Verified | Covers absent installs, version preservation, manifest/preflight failure, replacement rollback, save rollback, force rollback, cleanup warnings, reload hints, and soft-dependency warnings. |
| `extensions/pi-claude-marketplace/orchestrators/{plugin/index.ts,index.ts,types.ts}` | Reinstall API exported for Phase 9 | Verified | Reinstall outcome/types and orchestrator exports are available to edge/bulk routing. |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `reinstallPlugin` | `withLockedStateTransaction` | Explicit transaction callback | Wired | Reinstall holds the per-scope state lock across load, preflight, replacement, and explicit `tx.save()`. |
| `runLockedReinstall` | cached marketplace manifest | `loadCachedEntry(mp.manifestPath, marketplace, plugin)` | Wired | Reads the manifest path recorded in `state.json`; no resolver version refresh or Git sync is involved. |
| `runLockedReinstall` | cross-plugin conflict guard | `assertNoCrossPluginConflicts(..., removePluginRecord(...))` | Wired | Self-exempts the target plugin while preserving cross-plugin conflict checks. |
| `prepareAllHandles` | all four bridges | `prepareStageSkills`, `prepareStageCommands`, `prepareStagePluginAgents`, `prepareStageMcpServers` | Wired | All resource staging completes before physical replacement starts. |
| `replaceAll` | bridge replacement helpers | skills → commands → agents → MCP replacement | Wired | Replacement uses backup-backed bridge helpers; failures invoke reverse rollback plus staging abort. |
| `runLockedReinstall` | state save rollback | `catch` around `updateStateRecord` + `tx.save()` | Wired | If state save fails after resource replacement, replacements are rolled back before the error is surfaced. |
| `runPostSuccessMaintenance` | cache/data cleanup | post-success warning-only maintenance | Wired | Runs only after a successful `reinstalled` outcome; warnings are emitted without changing outcome. |
| `reinstall.ts` | user-visible output channel | `notifyError`, `notifyWarning`, `notifySuccess` | Wired | No direct stdout/stderr path in command/orchestrator code. |

## Automated Gates

| Gate | Result |
|------|--------|
| Focused reinstall + architecture tests | Passed: `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` |
| Phase-relevant architecture/bridge/orchestrator/transaction suite | Passed: `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"` |
| Full project check | Passed: `npm run check` with 898 tests, 0 failures |

## Requirement Traceability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PRL-02 | Verified | `reinstallPlugin` handles `plugin@marketplace`; single-plugin tests exercise direct reinstall. |
| PRL-06 | Verified | Absent installed record returns a skipped/not-installed outcome with no mutation. |
| PRL-07 | Verified | Cached-manifest read path plus no-network architecture guard. |
| PRL-08 | Verified | State mutation and outcome preserve `oldRecord.version`. |
| PRL-09 | Verified | All bridge `prepareStage*` calls complete before `replaceAll` mutates targets. |
| PRL-10 | Verified | Replacement and save failures roll back resources and preserve old data; focused tests cover failure modes. |
| PRL-11 | Verified | Data directory removal is post-success maintenance after replacement and state commit. |
| PRL-12 | Verified | Data cleanup failure is warning-only and does not convert success to failure. |

## Risks / Follow-Up

- Phase 08 intentionally did not wire the slash-command UX; Phase 09 owns command routing, batch output, completions, and docs.
- Live Pi UAT is not required for Phase 08 because this phase is core/orchestrator behavior with automated coverage. Phase 09 UAT covers the user-facing reinstall flow.

## Conclusion

Phase 08 is complete and verified. The atomic single-plugin reinstall core is implemented, exported, no-network guarded, and covered by focused and full-suite tests.

## Post-Merge Re-verification (2026-05-16)

**Context:** Merge commit `bd26932` brought origin/main into this branch (v1.2 import + bootstrap commands, CMP-1..8 scope rules, AG-7 agent-mapping omit-model quick task `260516-08j`).

**Verdict:** PASSED -- Phase 08 success criteria still hold.

| Concern | Result |
|---------|--------|
| Architecture guard (`tests/architecture/no-orchestrator-network.test.ts`) | Passed: `orchestrators/plugin/reinstall.ts` still in `FORBIDDEN_TARGETS`; all four forbidden patterns (`platform/git`, `DEFAULT_GIT_OPS`, `gitOps`, `refreshGitHubClone`) still asserted. Import orchestrators correctly not added (they may legitimately call marketplace add which uses git for GitHub sources). |
| Reinstall orchestrator unchanged | Verified: `git log origin/main..HEAD -- orchestrators/plugin/reinstall.ts` shows only the branch-side `5d8fd1d fix(reinstall): close phase 9 UAT gaps`; main never touched the file. `withLockedStateTransaction`, `prepareAllHandles`, `replaceAll`, `runPostSuccessMaintenance`, `assertNoCrossPluginConflicts`, `loadCachedEntry` all still present at expected sites. |
| Bridge replacement contract intact | Verified: `bridges/agents/types.ts` keeps `ReplacePreparedAgentsOptions` + `AgentsReplacement{Noop,Replaced}` from Phase 08-03; `replacePreparedAgents`/`rollbackAgentsReplacement`/`finalizeAgentsReplacement` symbols still exported. |
| Agent `mapModel` semantics | Composes cleanly: `convertAgent` now requires `mapModel: boolean`; `stage.ts` forwards `StageAgentsInput.mapModel ?? false`; `reinstall.ts:571` calls `prepareStagePluginAgents` without `mapModel`, so reinstall generates frontmatter without `model:` (matches main's "cascade-driven re-installs always omit `model:`" comment in `types.ts`). PRL-08/09/11 are about version/ordering/cleanup, not agent fields -- no PRL contract violated. |
| Focused suite | Passed: `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` -- 19/19 tests green (18 reinstall + 1 architecture). |
| Full `npm run check` | Passed: typecheck + lint + format + 1010 tests, 0 failures. |
