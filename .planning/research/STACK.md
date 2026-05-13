# Research pass: STACK for v1.1 `/claude:plugin reinstall`

## Recommended stack / technology reuse

- **No new runtime dependencies or version bumps are recommended.** Current stack is enough:
  - TypeScript strict / ESM (`package.json` scripts use `tsc`, ESLint, Prettier, `node --test`).
  - `proper-lockfile@^4.1.2` indirectly through `withStateGuard` for per-scope cross-process locking.
  - `write-file-atomic@^7.0.1` indirectly through existing JSON writers for `state.json`, `mcp.json`, and `agents-index.json`.
  - `isomorphic-git@^1.37.6` exists but **must not be used** by reinstall.
- Reuse existing orchestrator/bridge primitives, but expect a **small transaction-shape addition** for replacement-safe rollback:
  - Current bridge `prepare*` APIs are valuable for staging new resources into temp locations.
  - Current bridge `commitPrepared*` APIs are **not sufficient as-is** for reinstall's preserve-old-on-failure contract because they remove previous targets before renaming new resources.
  - Prefer new helper(s) built from existing `fs/promises` + existing atomic JSON writers to backup old resources, commit replacements, and restore backups on failure. No library needed.

## Evidence and relevant existing patterns

- Milestone requirements explicitly require cached manifests, no sync, atomic preservation, and post-success data cleanup (`.planning/PROJECT.md:13-25`, active requirements at `:41-46`).
- Existing update has the right **target model** (`all`, `marketplace`, `plugin`) and scope handling (`extensions/.../orchestrators/plugin/update.ts:119-132`, enumeration around `:147-230`), but it is not reusable directly because it runs GitHub refresh (`:165-193`) and skips when target version equals recorded version (`:374-378`). Reinstall must force replacement and keep recorded version.
- Existing install uses `runPhases` + reverse undo (`install.ts:292-502`; ledger in `transaction/phase-ledger.ts:24-111`) and soft-dep/reload-hint notification patterns (`install.ts:577-609`). Useful patterns, but install rejects already-installed plugins (`install.ts:187-198`).
- Existing uninstall has the post-state data-dir cleanup pattern to reuse (`uninstall.ts:167-185`) but uninstall+install composition is explicitly unsafe for reinstall because a failed install would leave the plugin absent.
- Existing update prepare/commit sequence (`update.ts:415-465`, `:560-680`) proves reusable staging mechanics, but its state-before-physical-replace recovery model intentionally only emits a reinstall recovery hint on phase-3 failure (`:643-665`); v1.1 requires stronger preservation.
- `withStateGuard` currently owns load/mutate/save and lock release (`with-state-guard.ts:55-100`). Reinstall should use the same lock boundary, but if physical rollback must react to `saveState` failure, a small extension/lower-level helper may be needed because callers cannot hook after `saveState` inside current `withStateGuard`.

## Integration points

- Add `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`.
  - Target type can mirror/refactor `UpdatePluginsTarget`.
  - Reuse `locationsFor`, `loadState`, `withStateGuard` or a lock-preserving variant, `loadMarketplaceManifest`, `PLUGIN_ENTRY_VALIDATOR`, `resolveStrict`, `requireInstallable`, `assertNoCrossPluginConflicts`, `pickAgentsSourceDir`, bridge `prepare*`/`abort*`, soft-dep warning helpers, reload-hint helpers, and notify wrappers.
  - Preserve recorded install version from state; do not call `resolvePluginVersion` except possibly only for diagnostics.
- Export from `orchestrators/plugin/index.ts` and top-level `orchestrators/index.ts`.
- Add edge shim analogous to `edge/handlers/plugin/update.ts` (`Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]`).
- Wire router/register/completions:
  - `SubcommandHandlers`, `TOP_LEVEL_USAGE`, and router switch need `reinstall` (`edge/router.ts:31-50`, `:92-103`).
  - `register.ts` handler map needs `reinstall` next to update (`edge/register.ts:72-84`).
  - Completion top-level list and plugin-ref branch need `reinstall`, with status filtering like `update`/`uninstall` and marketplace-only form allowed (`edge/completions/provider.ts:43-50`, `:197-217`).
- Add tests near existing update tests and edge update shim tests; reuse their hermetic HOME/cwd fixture style.

## What NOT to add

- Do **not** add a new package for transactions, backups, locking, or atomic writes.
- Do **not** add network/git integration, `gitOps`, `DEFAULT_GIT_OPS`, or `refreshGitHubClone` to reinstall.
- Do **not** add mutating LLM tools for reinstall; current project scope keeps mutation on slash commands only.
- Do **not** implement reinstall as uninstall followed by install.
- Do **not** change Pi peer dependencies or TypeScript/runtime versions for this feature.

## Validation implications

- Unit tests should prove all three forms: bare, `@marketplace`, and `plugin@marketplace`, with `--scope` at any position.
- Add an architectural/source-grep test similar to no-network install/list guard: `reinstall.ts` must not import `platform/git`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`, or expose `gitOps`.
- Critical failure tests:
  - Prepare failure leaves old state and all old resources intact.
  - Physical replace failure restores old skills/prompts/agents/MCP and leaves state unchanged.
  - State-save failure path is explicitly covered or the design documents why it cannot strand new physical resources.
  - Plugin data dir is **not** deleted on any failure, and is deleted only after successful replacement; cleanup failure should warn, not convert success to failure.
- Existing `npm run check` remains the final validation gate.

## Confidence

High that no stack/library changes are needed. Medium-high on implementation shape: existing update/install code provides most pieces, but reinstall's stronger atomic-preserve contract requires careful backup/restore or a transaction primitive extension beyond current bridge commit APIs.
