# Phase 8: Atomic Reinstall Core - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers the atomic **single-plugin reinstall core**. One already-installed plugin can be restaged from the cached marketplace manifest without Git/network access, while preserving the previous install on any reinstall failure. Phase 8 owns the core API, transaction/rollback primitives, bridge replacement safety, recorded-version policy, installed-only outcomes, plugin-data cleanup ordering, and no-network architecture guard.

Phase 9 owns the user-facing edge and bulk UX: `/claude:plugin reinstall` routing, bare and `@marketplace` batch forms, `--scope` argument parsing, deterministic partition output, reload/soft-dependency presentation, completions, and docs. Phase 8 may define core flags/result fields that Phase 9 exposes, but it should not spend implementation effort wiring the command surface.

</domain>

<decisions>
## Implementation Decisions

### Installed-only and cached-manifest outcomes

- **D-01:** A target with no installed record returns a clean `skipped` / `not-installed` core outcome and performs **no disk mutation**. Phase 9 may render this for a direct `plugin@marketplace` target as `No plugins installed.` or as an explicit skipped/not-installed line, but the Phase 8 core contract is non-mutating success/skip rather than an error.
- **D-02:** If an installed record exists but the cached marketplace manifest entry is missing, malformed, fails schema validation, or resolves as no longer installable, reinstall is a **failure** for that plugin. The previous installed state, generated resources, agents index, MCP entries, and plugin data directory must remain available.
- **D-03:** Reinstall reads only the marketplace manifest path recorded in `state.json` and uses the existing installed record's version as the post-reinstall version. It must not call `resolvePluginVersion`, compute a new content hash, refresh a clone, invoke `gitOps`, import `DEFAULT_GIT_OPS`, call `refreshGitHubClone`, or import `platform/git`.

### Transaction boundary and rollback

- **D-04:** The per-scope `.state-lock` is held across the whole single-plugin reinstall transaction: load fresh state, validate installed record, load cached manifest, prepare all bridge replacements, perform backup-backed physical replacement, save `state.json`, rollback physical replacement if save fails, then release the lock.
- **D-05:** Phase 8 should add a lock-held/manual-save transaction helper, rather than forcing reinstall through existing `withStateGuard`, because `withStateGuard` auto-saves after the callback and does not let the orchestrator rollback already-swapped physical resources when `saveState` fails.
- **D-06:** Physical replacement uses backup/restore-capable bridge helpers. Existing `commitPrepared*` restage helpers are not sufficient for reinstall because they can delete old targets before later bridge/state failures are known.
- **D-07:** If rollback of a failed replacement also partially fails, surface the existing manual-recovery discipline: include `MANUAL RECOVERY REQUIRED:` plus exact failed rollback phases and paths. Do **not** add a reinstall-specific stable marker unless planning discovers the existing marker cannot carry the needed detail.

### Plugin data lifecycle

- **D-08:** The plugin data directory is deleted only after replacement resources and `state.json` commit both succeed. Cleanup failure emits a warning and does not turn the successful reinstall into failure.
- **D-09:** After successful reinstall, delete `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/` and leave it absent. Do not recreate an empty data directory as part of reinstall.
- **D-10:** Failed reinstall, including prepare failure, bridge replacement failure, state-save failure, or rollback path before success, must preserve the old plugin data directory.

### Agent foreign-content and force mode

- **D-11:** Default reinstall hard-blocks on foreign/manual previous agent content for this plugin. This is a reinstall failure before replacement; preserve old state/resources/data and require user intervention.
- **D-12:** `--force` is in scope for the reinstall feature. Phase 8 core should define a `force` boolean (or equivalent result/input field) that Phase 9 can expose through `/claude:plugin reinstall --force`.
- **D-13:** With `force: true`, reinstall may replace/overwrite foreign/manual previous agent content that belongs to the target plugin's existing agents-index rows. The force override is limited to this plugin's own previous agent targets; it must **not** override cross-plugin or cross-marketplace ownership conflicts, path-containment failures, unsafe names, or MCP collision rules.
- **D-14:** Forced replacement remains rollback-protected. If any later bridge/state failure occurs, rollback should restore backed-up forced-overwritten agent content when possible; rollback failure uses D-07 manual-recovery reporting.

### Cross-plugin conflicts and self-exemption

- **D-15:** Cross-plugin generated-name checks must exclude the target plugin's current record so a reinstall with unchanged generated names does not self-conflict. Conflicts with other plugins in the same scope still hard-fail before mutation.
- **D-16:** MCP name/collision policy remains bridge-owned. Do not add ad-hoc MCP cross-plugin checks in the reinstall orchestrator; rely on MCP bridge preparation/replacement semantics.

### the agent's Discretion

- Exact TypeScript names for the lock/manual-save helper and bridge replacement handles.
- Exact rollback result type shape, as long as it can report bridge phase, path, original error, rollback error, and manual-recovery detail.
- Whether single-plugin core returns a discriminated `ReinstallOutcome` or throws for fatal failures and lets a wrapper normalize outcomes, as long as D-01/D-02 are honored.
- Backup directory naming and cleanup strategy under existing staging roots.
- The exact warning text for data-dir cleanup failure, provided it uses `ctx.ui.notify(..., "warning")` through existing notify wrappers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.1 milestone specs

- `.planning/ROADMAP.md` - Phase 8 goal, requirements PRL-02/06/07/08/09/10/11/12, and success criteria for atomic single-plugin reinstall.
- `.planning/REQUIREMENTS.md` - v1.1 PRL requirement definitions; Phase 8 owns PRL-02 and PRL-06 through PRL-12. Also records future/out-of-scope reinstall enhancements.
- `.planning/PROJECT.md` - Current milestone scope, network policy, stable output-channel constraints, two-scope model, and state/resource persistence surfaces.
- `.planning/MILESTONES.md` - v1.1 milestone summary for the Reinstall Command.

### v1.1 research pass

- `.planning/research/SUMMARY.md` - Reinstall must be dedicated, not uninstall+install or thin update wrapper; identifies Phase 8 vs Phase 9 split and remaining gaps.
- `.planning/research/ARCHITECTURE.md` - Recommended `orchestrators/plugin/reinstall.ts`, lock/manual-save helper, backup-capable bridge replacement APIs, data flow, and validation focus.
- `.planning/research/PITFALLS.md` - Critical failure modes: unsafe composition, current bridge commit deletion, no-network guard, recorded-version preservation, data cleanup ordering, concurrency, self-conflicts, foreign agent content, cache invalidation.
- `.planning/research/FEATURES.md` - Reinstall feature semantics and user-facing parity with update; useful for ensuring Phase 8 core result shape can support Phase 9.
- `.planning/research/STACK.md` - Confirms no new dependency is needed; existing stack and tests are sufficient, but bridge APIs need reinstall-specific safety.

### Prior phase decisions and source surfaces

- `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` - Existing install/update/uninstall orchestrator contracts, per-plugin data dir lifecycle, `RECOVERY_PLUGIN_REINSTALL_PREFIX` precedent, cross-plugin conflict guard, bridge staging order, and update's weaker recovery model.
- `.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md` - Phase 9 will extend these edge/completion patterns; Phase 8 should leave an API shape that is easy to route.
- `.planning/phases/07-integration-pi-wiring/07-CONTEXT.md` - `.state-lock` semantics, `StateLockHeldError`, `STATE_LOCK_HELD_PREFIX`, and real cross-process concurrency safety assumptions.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Cached-manifest/no-network install pattern; not suitable for reinstall composition because it rejects installed records.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Target enumeration and staging reference; not suitable as atomicity model because state is saved before physical replacement.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - Data-dir cleanup-after-state-commit warning pattern; not suitable for reinstall composition because it removes resources/state first.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - Cross-plugin generated-name guard and version helper; reinstall must self-exempt current plugin and avoid recomputing version.
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` - Existing lock + auto-save guard; Phase 8 extends with manual-save transaction capability.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` - `loadState` / `saveState` and atomic state write behavior.
- `extensions/pi-claude-marketplace/persistence/locations.ts` - Scoped path bundle, `.state-lock`, plugin data dir, staging roots, cache paths.
- `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp}/stage.ts` - Current prepare/commit/abort behavior; planning must audit and add backup-capable replacement APIs.
- `extensions/pi-claude-marketplace/shared/markers.ts` - Stable marker constants; use existing manual-recovery marker discipline rather than adding a reinstall marker by default.
- `extensions/pi-claude-marketplace/shared/errors.ts` - Error classes and leak/manual-recovery composition surfaces.
- `extensions/pi-claude-marketplace/shared/notify.ts` - All user-visible warnings/errors must flow through notify wrappers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `transaction/with-state-guard.ts` already acquires `proper-lockfile` on `<scopeRoot>/pi-claude-marketplace/.state-lock` before `loadState` and releases after `saveState`. Phase 8 should factor or add a helper that exposes the same lock while giving reinstall explicit `loadState`/`saveState`/rollback control.
- `persistence/state-io.ts` provides `loadState` and `saveState`; `saveState` validates and writes atomically via `atomicWriteJson`.
- `persistence/locations.ts` provides `pluginDataDir`, `stateLockFile`, bridge staging roots, target roots, `mcpJsonPath`, and completion-cache file helpers with path containment.
- `orchestrators/plugin/install.ts` shows cached `marketplace.json` loading and no-network architecture discipline.
- `orchestrators/plugin/update.ts` shows useful per-plugin prepare logic, scope/target enumeration patterns, soft-dep/reload presentation, and cache invalidation, but must not be copied for atomicity.
- `orchestrators/plugin/uninstall.ts` shows the correct post-success data-dir cleanup warning pattern.
- `orchestrators/plugin/shared.ts` has `assertNoCrossPluginConflicts`; reinstall needs either a self-exempt wrapper or a state snapshot with the target plugin temporarily excluded.
- Bridge `prepareStage*` functions already stage replacements before touching target resources. Bridge `commitPrepared*` functions need reinstall-safe backup/rollback variants because current restage commits can remove previous targets before all failure points are cleared.

### Established Patterns

- TypeScript strict + ESM throughout.
- Import boundaries: plugin orchestrators may import bridges, domain, persistence, presentation, shared, transaction, and named marketplace shared helpers when justified; `edge/` remains out of Phase 8 core.
- No network/Git imports in install/list-style local operations; architecture tests grep for forbidden surfaces.
- Stable user-facing strings live in `shared/markers.ts` only when they become contractual markers. Phase 8 should reuse existing `MANUAL RECOVERY REQUIRED:` discipline rather than creating a new marker by default.
- Output channel discipline: user-visible warnings and errors go through `ctx.ui.notify` via `shared/notify.ts`; no stdout/stderr writes in command/orchestrator code.
- Completion cache invalidation failures are warning-only after the primary operation succeeds; reinstall should follow the same post-success pattern if Phase 8 touches cache invalidation.

### Integration Points

- New core file expected: `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`.
- New transaction helper expected in or near `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`.
- New bridge replacement APIs expected in `bridges/skills`, `bridges/commands`, `bridges/agents`, and `bridges/mcp`, exported through their `index.ts` barrels.
- Architecture guard expected to extend `tests/architecture/no-orchestrator-network.test.ts` for reinstall.
- Tests expected: `tests/orchestrators/plugin/reinstall.test.ts`, bridge replacement failure/rollback tests, transaction helper tests, and path/data cleanup tests.
- Phase 9 will wire edge handler/router/register/completions and expose `--force`; Phase 8 should define the core input/result shape now.

</code_context>

<specifics>
## Specific Ideas

- `ReinstallPluginOptions` should include at least `{ ctx, pi, scope, cwd, marketplace, plugin, force?: boolean }` or a lower-level core equivalent.
- A direct missing installed record can return something like `{ partition: "skipped", reason: "not-installed" }` without notification in the core; Phase 9 decides rendering.
- Installed-but-manifest-invalid should be a failed outcome/error with no mutation and a cause chain naming the cached manifest problem.
- Preserve `installedAt`; update `updatedAt` only after successful reinstall; preserve `version` exactly from the old installed record.
- Replacement result should capture staged skill/prompt/agent/MCP names so Phase 9 can emit refresh reload hints and soft-dep warnings when generated resources changed.
- Forced agent foreign-content override should be explicit in tests: default hard-block, `force: true` overwrites only target-plugin-owned previous agent files and can rollback them.
- If a physical replacement succeeds but `saveState` fails, rollback bridge replacements in reverse order: MCP → agents → commands → skills, then report any rollback failures with manual recovery details.
- Data-dir cleanup runs after state save and cache invalidation decisions; cleanup warning should not mask the successful reinstall outcome.

</specifics>

<deferred>
## Deferred Ideas

- JSON output for reinstall results remains future work unless Phase 9 separately scopes it.
- Dry-run/preview mode remains future work.
- Interactive plugin selector remains future work.
- Mutating LLM tool for reinstall remains future work.
- Parallel/bulk reinstall execution remains Phase 9 or later; Phase 8 focuses on one plugin's atomic guarantee.

</deferred>

---

*Phase: 08-atomic-reinstall-core*
*Context gathered: 2026-05-13*
