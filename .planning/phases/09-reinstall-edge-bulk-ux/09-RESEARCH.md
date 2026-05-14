# Research: Phase 9 Reinstall Edge & Bulk UX

## Summary

Plan Phase 9 as an update-analogous command/bulk UX layer over the Phase 8 atomic single-plugin `reinstallPlugin` core. The critical planning issue is not resource replacement anymore; it is adding a quiet/batch seam, deterministic target enumeration/output, update-compatible scope resolution, safe `--force` parsing, and completion/router/docs wiring without copying update's Git/network refresh path.

## Findings

1. **Phase 9 should add a bulk orchestrator above the Phase 8 core, not loop in the edge handler.** The locked context decisions call for a `reinstallPlugins`-style entrypoint analogous to `updatePlugins`; the handler should remain a thin parser/adapter like `edge/handlers/plugin/update.ts`. This keeps loops, scope resolution, partition aggregation, continuation, reload hints, and soft-dependency aggregation in the orchestrator layer, where `updatePlugins` already owns the same concerns. [09-CONTEXT.md](09-CONTEXT.md), [extensions/pi-claude-marketplace/orchestrators/plugin/update.ts](../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts)

2. **The main Phase 8 API to consume is `reinstallPlugin(opts): Promise<ReinstallPluginOutcome>`.** Its outcome type is already Phase-9-ready: `partition: "reinstalled" | "skipped" | "failed"`, `scope`, `marketplace`, `name`, optional `version`, `notes`, `stagedAgents`, `stagedMcpServers`, and `resourcesChanged`. It preserves the installed version, reads only cached manifests, rolls back resource/state failures, deletes plugin data only after success, and treats cache/data cleanup failures as warnings. [extensions/pi-claude-marketplace/orchestrators/types.ts](../../../extensions/pi-claude-marketplace/orchestrators/types.ts), [08-04-SUMMARY.md](../08-atomic-reinstall-core/08-04-SUMMARY.md)

3. **A quiet/render seam is required before batching.** Current `reinstallPlugin` emits success/error notifications itself on direct core calls and warning notifications for bridge/cache/data cleanup paths. Batch UX must avoid one success/error notification per plugin and instead emit one deterministic summary. Plan a small refactor such as `render?: "default" | "none"`, `notify?: boolean`, or an internal core helper returning `{ outcome, warnings }`, with the default preserving current Phase 8 tests. [extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts](../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts), [09-CONTEXT.md](09-CONTEXT.md)

4. **Target forms should mirror update exactly, except reinstall must not sync Git.** Use a union equivalent to `UpdatePluginsTarget`: `{ kind: "all" }`, `{ kind: "marketplace"; marketplace }`, and `{ kind: "plugin"; plugin; marketplace }`. Reuse update's enumeration semantics: bare form scans installed plugins in selected scope set; marketplace/plugin form resolves scope using `resolveScopeFromState` when `--scope` is absent; explicit `--scope` bypasses ambiguity resolution and loads that scope directly. Do not copy update's `refreshGitHubClone`, `DEFAULT_GIT_OPS`, or `gitOps` path. [extensions/pi-claude-marketplace/orchestrators/plugin/update.ts](../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts), [tests/architecture/no-orchestrator-network.test.ts](../../../tests/architecture/no-orchestrator-network.test.ts)

5. **Scope behavior has three distinct cases to plan for.** Bare `reinstall` with no `--scope` enumerates both scopes in the fixed project model (`user`, then `project` is the established array order). Bare with `--scope project|user` enumerates only that scope. `reinstall @mp` and `reinstall plugin@mp` without `--scope` must surface the same marketplace-not-found and ambiguous-scope behavior as update via `resolveScopeFromState`; with `--scope`, a missing marketplace should report `Marketplace "mp" not found in <scope> scope.` [extensions/pi-claude-marketplace/orchestrators/plugin/update.ts](../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts), [extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts](../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts)

6. **Deterministic batch output should be stricter than update's helper.** `renderPartition` sorts by plugin `name` only, which is enough for many update cases but is ambiguous for reinstall outcomes that carry `scope` and `marketplace`. Plan a reinstall-specific renderer or a generalized helper that sorts by `(scopeOrder, marketplace, plugin)` and renders unambiguous labels such as `[project] plugin@marketplace`. Required sections are `Reinstalled:`, `Skipped:`, and `Failed:`; empty sections should be omitted. Deterministic output follows CLI guidance to group repeated errors and keep state-changing output brief and understandable. [extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts](../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts), [Command Line Interface Guidelines](https://clig.dev/)

7. **Batch execution should be sequential and continue per plugin.** Phase 9 explicitly prefers deterministic sequential processing over throughput. One `reinstallPlugin` failed outcome should land in `Failed:` and the loop should continue to later targets. Because Phase 8 isolates rollback per plugin under the per-scope `.state-lock`, this continuation model should not corrupt or uninstall other plugins. [09-CONTEXT.md](09-CONTEXT.md), [08-04-SUMMARY.md](../08-atomic-reinstall-core/08-04-SUMMARY.md)

8. **Reload hints must be aggregated from successful changed outcomes only.** Use `reloadHint("refresh", names)` and `appendReloadHint`, but pass names only for `partition === "reinstalled" && resourcesChanged === true`. Skipped and failed outcomes must never trigger a reload hint. This mirrors update's `refresh` verb but uses Phase 8's `resourcesChanged` flag so no-resource reinstalls suppress the hint. [extensions/pi-claude-marketplace/presentation/reload-hint.ts](../../../extensions/pi-claude-marketplace/presentation/reload-hint.ts), [tests/orchestrators/plugin/reinstall.test.ts](../../../tests/orchestrators/plugin/reinstall.test.ts)

9. **Soft-dependency warnings should be aggregated once from successful restaged resources.** Collect `stagedAgents` and `stagedMcpServers` from successful `reinstalled` outcomes only, then call `subagentWarningIfNeeded(pi, agents)` and `mcpAdapterWarningIfNeeded(pi, servers)` when composing the final summary. Do not invent new warning strings; the stable text lives in `platform/pi-api.ts` and is re-exported via `presentation/soft-dep.ts`. [extensions/pi-claude-marketplace/platform/pi-api.ts](../../../extensions/pi-claude-marketplace/platform/pi-api.ts), [extensions/pi-claude-marketplace/presentation/soft-dep.ts](../../../extensions/pi-claude-marketplace/presentation/soft-dep.ts)

10. **`--force` must be exposed safely in the reinstall handler.** Phase 8 added `force?: boolean` to the core for same-plugin previous foreign/manual agent content. Phase 9 context supersedes older anti-feature notes and requires exposing `--force` only for reinstall. Do not use current `parseCommandArgs` blindly because it ignores extra positionals beyond the schema; instead parse with `parseArgs`, extract `--force`, reject unknown `--*` flags, reject more than one ref, and pass `force: true` to the bulk orchestrator. [09-CONTEXT.md](09-CONTEXT.md), [extensions/pi-claude-marketplace/edge/args.ts](../../../extensions/pi-claude-marketplace/edge/args.ts), [extensions/pi-claude-marketplace/edge/args-schema.ts](../../../extensions/pi-claude-marketplace/edge/args-schema.ts)

11. **Router/register changes are straightforward but broad.** Add `reinstall` to `SubcommandHandlers`, `TOP_LEVEL_USAGE`, dispatch switch, `register.ts` handler map, and the command description. The handler file should be `edge/handlers/plugin/reinstall.ts`, modeled on update but with `--force` scanning and reinstall usage text: `Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force]`. [extensions/pi-claude-marketplace/edge/router.ts](../../../extensions/pi-claude-marketplace/edge/router.ts), [extensions/pi-claude-marketplace/edge/register.ts](../../../extensions/pi-claude-marketplace/edge/register.ts), [extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts](../../../extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts)

12. **Completion requires both provider and data-mode updates.** Add `reinstall` to `TOP_LEVEL_SUBCOMMANDS`, add a branch like update's plugin-ref branch with `allowMarketplaceOnly: true`, and extend `PluginRefCompletionMode` to include `"reinstall"` with `status === "installed"`. Preserve existing completion contracts: terminal suggestions have trailing spaces, multi-marketplace plugin suggestions produce `name@` without trailing space, per-marketplace manifest failures soft-fail to empty rows, and state errors propagate. [extensions/pi-claude-marketplace/edge/completions/provider.ts](../../../extensions/pi-claude-marketplace/edge/completions/provider.ts), [extensions/pi-claude-marketplace/edge/completions/data.ts](../../../extensions/pi-claude-marketplace/edge/completions/data.ts), [tests/edge/completions/provider.test.ts](../../../tests/edge/completions/provider.test.ts)

13. **Completion flag handling needs one extra edge case because of `--force`.** `extractPositionals()` currently skips only `--scope <value>`. If the user types `reinstall --force `, positionals would otherwise become `reinstall`, `--force` and plugin-ref completion would not fire. Plan either a reinstall-specific positional extractor in the provider or a generalized boolean-flag skip for `--force` that does not disturb list's boolean filters. Also add `--force` to `flagCompletions` only when the positional head is `reinstall`. [extensions/pi-claude-marketplace/edge/completions/data.ts](../../../extensions/pi-claude-marketplace/edge/completions/data.ts), [extensions/pi-claude-marketplace/edge/completions/provider.ts](../../../extensions/pi-claude-marketplace/edge/completions/provider.ts)

14. **Docs must explain semantic differences from update.** README should list the three reinstall forms, `--scope`, and `--force`; clarify cached manifests/no network, recorded-version preservation, installed-only behavior, and plugin data reset only after successful replacement. This helps avoid the common confusion that reinstall should fetch latest code; that is update/marketplace update's job. [README.md](../../../README.md), [Command Line Interface Guidelines](https://clig.dev/)

## Current Source/Test Inventory Relevant to Phase 9

### Source surfaces

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- Phase 8 single-plugin atomic core; currently emits direct notifications and returns `ReinstallPluginOutcome`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- closest target enumeration, scope resolution, partition rendering, reload hint, and soft-dep aggregation template; do not copy Git sync.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- shared reinstall outcome/result model.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- `resolveScopeFromState`, `formatErrorWithCauses`, and `renderPartition` precedent.
- `extensions/pi-claude-marketplace/edge/router.ts` -- top-level usage, dispatch, and `SubcommandHandlers` map.
- `extensions/pi-claude-marketplace/edge/register.ts` -- handler map and command registration/completion wiring.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` -- parser/target-union shim template.
- `extensions/pi-claude-marketplace/edge/args.ts` and `edge/args-schema.ts` -- tokenizer, `--scope` extraction, and positional schema helper; reinstall likely needs direct `parseArgs` use for `--force` and extra-token rejection.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` and `edge/completions/data.ts` -- top-level completion, plugin-ref completion, status filtering, `@marketplace` completion, trailing-space behavior.
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts`, `presentation/soft-dep.ts`, `platform/pi-api.ts` -- canonical reload and soft-dependency presentation.
- `README.md` -- user-facing command reference.

### Test surfaces

- `tests/orchestrators/plugin/reinstall.test.ts` -- Phase 8 single-plugin coverage; extend or add tests for batch orchestration.
- `tests/orchestrators/plugin/update.test.ts` -- target form, partition, scope, and reload hint precedent.
- `tests/edge/handlers/plugin/update.test.ts` -- handler parsing template for reinstall.
- `tests/edge/router.test.ts` -- add dispatch and usage assertions for `reinstall`.
- `tests/edge/register.test.ts` -- ensure registered top-level completions include `reinstall` and handler map still works.
- `tests/edge/completions/provider.test.ts` -- add reinstall installed-only refs, `@marketplace`, `--force`, trailing-space, soft-fail, and state-error cases.
- `tests/architecture/no-orchestrator-network.test.ts` -- already guards `reinstall.ts`; keep it green after adding bulk orchestration.

## Update-Command Patterns to Mirror

- Handler shape: parse optional ref; no ref => all target; `@mp` => marketplace target; `plugin@mp` => plugin target; invalid ref => usage.
- Orchestrator shape: enumerate targets before loop; empty targets => `notifySuccess(ctx, "No plugins installed.")`; collect outcomes; render one summary notification.
- Scope behavior: bare all uses both scopes unless explicit `--scope`; marketplace/plugin targets call `resolveScopeFromState` when no explicit scope.
- Presentation: partition sections in stable order, then soft-dep warnings, then `reloadHint("refresh", names)`.
- Error handling: target-enumeration errors are one `notifyError`; per-plugin failures in batch become failed outcomes rather than stopping later plugins for Phase 9.

Do **not** mirror update's GitHub clone refresh, version comparison/unchanged partition, or phase-3 recovery-hint model.

## Phase 8 Reinstall-Core APIs/Result Model to Consume

- Public current API: `reinstallPlugin({ ctx, pi, scope, cwd, marketplace, plugin, force? })`.
- Outcome partitions: `reinstalled`, `skipped`, `failed`.
- Success fields: `version` is preserved installed version; `stagedAgents`, `stagedMcpServers`, and `resourcesChanged` drive Phase 9 aggregation.
- Skipped fields: `notes` currently includes `not installed` for absent installed record.
- Failed fields: `notes` contains formatted error/cause text after rollback.
- Required refactor: preserve the default direct notification behavior while letting batch call the core without per-plugin success/error notifications.

## Scope-Resolution and Ambiguity Behavior to Reuse

Use `resolveScopeFromState(mpName, locationsFor("user", cwd), locationsFor("project", cwd))` for `@mp` and `plugin@mp` when `--scope` is omitted. This preserves two important user-visible behaviors: if the marketplace exists in both scopes, the user gets the existing ambiguity error; if it exists in neither, the user gets the existing not-found error listing candidate scopes. For bare `reinstall`, do not call `resolveScopeFromState`; enumerate installed records across selected scopes.

## Deterministic Batch Output Requirements

Plan output around a single success notification for all completed batch work:

```text
Reinstalled 2 plugins.
Reinstalled:
  - [project] alpha@mp
  - [user] beta@mp
Skipped:
  - [project] missing@mp: not installed
Failed:
  - [project] broken@mp: Plugin "broken" not found in cached manifest...
Run /reload to refresh "alpha", "beta".
```

Exact wording can vary, but the plan should lock:

- partition order: `Reinstalled`, `Skipped`, `Failed`;
- item order: stable `(scope, marketplace, plugin)` sort;
- line labels include enough scope/marketplace detail to disambiguate duplicates;
- `No plugins installed.` for empty target sets with no reload hint;
- continuation across per-plugin failures.

## Reload Hint and Soft-Dependency Warning Pathways

- Use `reloadHint("refresh", names)` and `appendReloadHint` only when at least one successful `reinstalled` outcome has `resourcesChanged === true`.
- Use the same staged-resource fields for warnings: `subagentWarningIfNeeded(pi, reinstalled.flatMap(o => o.stagedAgents ?? []))` and `mcpAdapterWarningIfNeeded(pi, reinstalled.flatMap(o => o.stagedMcpServers ?? []))`.
- Suppress both reload hints and soft-dep warnings for skipped/failed outcomes.
- Keep post-success cleanup/cache warnings warning-grade; decide during planning whether batch collects them into summary notes or allows separate warning notifications.

## Tab-Completion Architecture and Edge Cases

- Top-level: add `reinstall` to `TOP_LEVEL_SUBCOMMANDS`; all top-level terminal completions keep trailing spaces.
- Refs: call `getPluginRefCompletions("reinstall", current, argumentTextPrefix, resolver, { allowMarketplaceOnly: true })`.
- Data: extend mode type and `statusMatchesMode()` so reinstall shows only `status === "installed"`.
- `@marketplace`: match update behavior and complete bare `@mp` marketplace targets.
- Flags: `--scope` remains global; add `--force` only for reinstall flag completions.
- Positional extraction: skip `--force` for reinstall so `reinstall --force <TAB>` still completes installed refs.
- Failure semantics: do not change `ManifestSoftFailError` handling or state error propagation.

## Validation Architecture

Concrete validation categories and commands for `VALIDATION.md`:

1. **Focused orchestrator batch tests**
   - Target forms: all, marketplace, plugin.
   - Scope: explicit user/project, implicit ambiguity, implicit not found.
   - Empty state: `No plugins installed.` and no reload hint.
   - Continuation: one failed plugin and one successful plugin in same batch; old resources/data preserved for failed plugin, success committed for other plugin.
   - Determinism: shuffled state insertion order still renders stable section/item order.
   - Reload/soft-dep aggregation: only successful changed outcomes trigger `refresh`; agents/MCP warnings aggregate once.
   - Suggested command: `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts`

2. **Edge handler tests**
   - Bare `""` maps to `{ kind: "all" }`.
   - `"@mp"` maps to marketplace target.
   - `"plugin@mp"` maps to plugin target.
   - `--scope` works before, between, and after args.
   - `--force` works before/after ref and passes to orchestrator/core.
   - Invalid ref, unknown long flag, extra positionals, and missing `--scope` value emit usage/error without mutation.
   - Suggested command: `node --test tests/edge/handlers/plugin/reinstall.test.ts`

3. **Router/register tests**
   - `TOP_LEVEL_USAGE` includes reinstall syntax.
   - `routeClaudePlugin("reinstall ...")` dispatches to `handlers.reinstall`.
   - Registered command completions include `reinstall`.
   - Suggested command: `node --test tests/edge/router.test.ts tests/edge/register.test.ts`

4. **Completion tests**
   - Top-level `rei` => `reinstall `.
   - `reinstall ` completes installed refs only.
   - `reinstall @` completes marketplace-only form.
   - `reinstall --force ` still completes refs.
   - Terminal completions include trailing spaces; multi-marketplace plugin half `name@` does not.
   - Existing per-marketplace manifest soft-fail and top-level state-error tests still pass.
   - Suggested command: `node --test tests/edge/completions/provider.test.ts`

5. **Docs/static/no-network validation**
   - README contains reinstall syntax and semantic notes.
   - Architecture guard proves no Git/network surface in reinstall orchestrator after bulk additions.
   - Suggested commands:
     - `node --test tests/architecture/no-orchestrator-network.test.ts`
     - `npm run typecheck`
     - `npm run check`

## Sources

- Kept: Phase 9 context (`.planning/phases/09-reinstall-edge-bulk-ux/09-CONTEXT.md`) -- user decisions, force exposure, output/completion expectations.
- Kept: Requirements/Roadmap/State (`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`) -- PRL mapping, Phase 8 completion state, Phase 9 success criteria.
- Kept: Phase 8 summaries/plans -- authoritative single-plugin core behavior and result model.
- Kept: `orchestrators/plugin/update.ts` -- target, scope, partition, reload, soft-dep template.
- Kept: `orchestrators/plugin/reinstall.ts` and `orchestrators/types.ts` -- Phase 8 core API/outcomes.
- Kept: Edge router/handler/completion source and tests -- wiring and completion semantics to extend.
- Kept: Command Line Interface Guidelines (https://clig.dev/) -- supports concise usage on missing args, order-independent flags, grouped errors, and telling users when state changes.
- Kept: Node.js test runner docs (https://nodejs.org/api/test.html) -- validates using built-in `node --test` commands already used by this project.
- Dropped: Generic CLI blog/spec search results -- useful background but less authoritative than project code and clig.dev.
- Dropped: Shell/zsh completion forum results -- not load-bearing because Pi-tui completion behavior is already encoded in project tests.

## Gaps

- Exact batch wording is not locked by existing tests; planning should choose one stable wording before implementation.
- Whether batch cleanup/cache warnings should be separate `warning` notifications or folded into summary notes needs a small design call.
- `@marketplace` completion currently follows update's all-marketplace-name behavior; if Phase 9 wants only marketplaces with installed plugins, that is a deliberate departure and needs new helper/tests.

## Plan-Shaping Recommendation

Split Phase 9 into four implementation plans: (1) bulk orchestrator plus quiet core seam and deterministic output; (2) edge handler/router/register with safe `--force`; (3) completions including `--force` positional extraction; (4) README/docs plus full validation hardening. Do orchestrator first so handler/completion tests can target a stable public API and so the quiet notification seam is settled before UX wiring.

## RESEARCH COMPLETE
