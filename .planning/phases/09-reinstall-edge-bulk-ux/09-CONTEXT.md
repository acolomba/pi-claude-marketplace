# Phase 9: Reinstall Edge & Bulk UX - Context

**Gathered:** 2026-05-14 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers the user-facing and bulk reinstall experience on top of the Phase 8 single-plugin atomic core. A Pi user can drive reinstall through `/claude:plugin` using update-analogous target forms: bare `reinstall`, `reinstall @<marketplace>`, and `reinstall <plugin>@<marketplace>`, with `--scope user|project` accepted at any argument position. Phase 9 owns command routing, handler parsing, batch target enumeration, deterministic partition output, reload hints, soft-dependency warnings, tab completion, docs, and tests for the edge/bulk UX.

Phase 9 does **not** change the Phase 8 atomic replacement contract, recorded-version policy, no-network policy, or post-success data cleanup semantics except as needed to expose and aggregate those outcomes through the command surface.

</domain>

<decisions>
## Implementation Decisions

### Bulk orchestration shape

- **D-01:** Add a bulk reinstall entrypoint above the existing single-plugin `reinstallPlugin` core, analogous to `updatePlugins`. The bulk entrypoint should own target enumeration, scope resolution, per-plugin continuation, partition aggregation, and user-facing summary rendering instead of putting loops directly in the edge handler.
- **D-02:** The edge handler for `/claude:plugin reinstall` should remain a thin parser/adapter, modeled on `edge/handlers/plugin/update.ts`, and should call the bulk orchestrator with a target union equivalent to update: `{ kind: "all" }`, `{ kind: "marketplace" }`, and `{ kind: "plugin" }`.
- **D-03:** Batch reinstall should run plugins sequentially by default. Parallel/bulk execution is not required for Phase 9; preserving the per-plugin atomicity guarantee and deterministic output matters more than throughput.

### Notification and output aggregation

- **D-04:** Refactor or wrap `reinstallPlugin` so bulk reinstall can suppress per-plugin success/error notifications and produce one deterministic batch summary. Direct single-plugin command routing may still render a concise single-target result through the same summary path.
- **D-05:** Batch output must partition outcomes deterministically into `Reinstalled`, `Skipped`, and `Failed` sections, using stable sorting by scope/marketplace/plugin or an equivalent update-compatible deterministic ordering.
- **D-06:** A batch with no installed targets should succeed with exactly the existing empty-set message shape, `No plugins installed.`, and should not emit a reload hint.
- **D-07:** One plugin failure must not stop later plugins in the selected batch. The failed plugin lands in the `Failed` partition while other plugins may still be reinstalled or skipped.

### Scope and target semantics

- **D-08:** Scope and target resolution must mirror `update` exactly: bare `reinstall` enumerates installed plugins across both scopes unless `--scope` is explicit; `@marketplace` and `plugin@marketplace` resolve scope via the same ambiguity/not-found behavior as update when `--scope` is omitted.
- **D-09:** `--scope user|project` remains the only scope model. Do not introduce Claude `local` scope or a new reinstall-specific scope default.
- **D-10:** Reinstall remains installed-only. It must not install absent plugins; absent or non-selected plugins are skipped/not-found per the existing Phase 8 core and update-compatible edge behavior.
- **D-11:** Reinstall must not perform marketplace refresh, Git fetch, clone update, or any other network sync. Do not copy update's `refreshGitHubClone` / `gitOps` path into reinstall bulk orchestration.

### Reload hints and soft-dependency warnings

- **D-12:** Aggregate reload hints only from successful `reinstalled` outcomes whose `resourcesChanged` flag is true. Skipped and failed outcomes must not trigger reload hints.
- **D-13:** Aggregate soft-dependency warnings only from successful restaged resources: agents feed the existing `pi-subagents` warning path, and MCP servers feed the existing `pi-mcp-adapter` warning path. Use the existing presentation helpers and stable warning strings.
- **D-14:** Keep the reload verb as `refresh`, matching the existing reinstall/update reload-hint family.

### Completion and docs

- **D-15:** Add `reinstall` to top-level command completions and command usage text with trailing-space completion behavior preserved.
- **D-16:** Reinstall plugin-ref completion should match update's installed-only semantics: complete installed `<plugin>@<marketplace>` refs and allow bare `@<marketplace>` marketplace targets.
- **D-17:** Preserve existing completion soft-fail behavior: per-marketplace failures should not break all completions, and top-level state-error behavior should remain unchanged.
- **D-18:** Update README/user docs to list reinstall syntax, clarify that reinstall uses cached manifests/no network, preserves the recorded version, and resets plugin data only after successful replacement.

### Force flag exposure

- **D-19:** Expose `--force` for `/claude:plugin reinstall` in Phase 9 because Phase 8 deliberately added the `force?: boolean` core option for foreign/manual previous agent content. Without edge exposure, that Phase 8 behavior is unreachable.
- **D-20:** `--force` should be reinstall-specific and should not alter install/update/uninstall semantics. Parser handling must avoid treating `--force` as a plugin ref or silently ignoring invalid extra tokens.
- **D-21:** Document `--force` narrowly: it permits overwriting foreign/manual previous agent content only within the Phase 8 limits for the target plugin's own previous agents-index rows. It must not override cross-plugin ownership conflicts, unsafe names, path-containment failures, or MCP collision rules.

### the agent's Discretion

- Exact TypeScript names for the bulk target union, bulk options, and quiet-notification seam.
- Whether the quiet seam is a `notify?: boolean`, `render?: "single" | "none"`, dependency-injected presenter, or a lower-level internal helper, as long as single and batch UX remain deterministic and tested.
- Exact wording and ordering of partition headings, provided the output clearly distinguishes reinstalled/skipped/failed outcomes and remains stable under test.
- Whether `--force` appears in the top-level usage block only for reinstall or in a command-specific usage message, as long as invalid/empty forms show clear usage.
- Exact README section placement and examples.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.1 milestone specs

- `.planning/ROADMAP.md` - Phase 9 goal, PRL-01/03/04/05/13/14/15/16 mapping, and success criteria for routing, scope, batch output, reload hints, soft-dependency warnings, and completion.
- `.planning/REQUIREMENTS.md` - v1.1 requirement definitions and out-of-scope boundaries for reinstall.
- `.planning/PROJECT.md` - Current milestone scope, target forms, no-network policy, two-scope model, stable output-channel constraints, and reinstall command goals.
- `.planning/MILESTONES.md` - v1.1 milestone summary for reinstall command semantics.

### v1.1 research and prior phase context

- `.planning/research/FEATURES.md` - Reinstall UX expectations, target forms, installed-only completion, no-network differentiation, and docs/testing parity. Note: its anti-feature note saying "No --force" is superseded by Phase 8 context and this Phase 9 D-19 decision.
- `.planning/research/ARCHITECTURE.md` - Recommended reinstall target union, update-analogous enumeration, edge wiring surfaces, completion updates, and validation focus.
- `.planning/research/SUMMARY.md` - Milestone-level research synthesis and Phase 8/Phase 9 split.
- `.planning/research/PITFALLS.md` - Known reinstall failure modes and UX risks to preserve during bulk orchestration.
- `.planning/phases/08-atomic-reinstall-core/08-CONTEXT.md` - Phase 8 locked decisions for single-plugin reinstall core, force semantics, result shape, reload/soft-dep fields, and deferred Phase 9 responsibilities.
- `.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md` - Existing edge/router/completion patterns that Phase 9 extends.
- `.planning/phases/07-integration-pi-wiring/07-CONTEXT.md` - Pi wiring, `.state-lock` semantics, and runtime integration assumptions.

### Source surfaces to inspect

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Phase 8 single-plugin core, current notification behavior, `force?: boolean`, and outcome fields available for aggregation.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Closest template for target union, scope resolution, batch enumeration, deterministic partition rendering, reload hints, and soft-dependency aggregation.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - `ReinstallPluginOutcome` fields available to Phase 9.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - `renderPartition` helper and deterministic partition formatting precedent.
- `extensions/pi-claude-marketplace/edge/router.ts` - Top-level usage block, handler interface, and dispatch switch that need `reinstall`.
- `extensions/pi-claude-marketplace/edge/register.ts` - Command registration handler map and completion provider wiring.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` - Thin handler template for bare, `@marketplace`, and `plugin@marketplace` forms.
- `extensions/pi-claude-marketplace/edge/args.ts` - Current `--scope` parsing and flag/positional handling; Phase 9 must add safe `--force` handling.
- `extensions/pi-claude-marketplace/edge/args-schema.ts` - Argument validation schema behavior for lifecycle handlers.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - Top-level and plugin-ref completion branches that need `reinstall`.
- `extensions/pi-claude-marketplace/edge/completions/data.ts` - Completion data mode filtering; `reinstall` should be installed-only like update/uninstall.
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` - Canonical reload-hint composer.
- `extensions/pi-claude-marketplace/presentation/soft-dep.ts` - Existing soft-dependency warning presentation.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` - Soft-dependency probing helpers and Pi API boundary.
- `tests/architecture/no-orchestrator-network.test.ts` - Existing no-network architecture guard for reinstall.
- `tests/orchestrators/plugin/reinstall.test.ts` - Phase 8 reinstall core tests and result-shape expectations.
- `tests/edge/router.test.ts` - Router usage/dispatch test patterns.
- `tests/edge/handlers/plugin/update.test.ts` - Handler parsing test template for reinstall.
- `tests/edge/completions/provider.test.ts` - Completion behavior and failure-semantics test patterns.
- `README.md` - User-facing command documentation to update.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `orchestrators/plugin/reinstall.ts` already provides `reinstallPlugin(opts)` for one plugin, including installed-only skip outcomes, version preservation, no-network cached manifest loading, backup-backed replacement, data cleanup, completion-cache dropping, reload hints, soft-dep warnings, and `force?: boolean`.
- `orchestrators/types.ts` exposes `ReinstallPluginOutcome` with fields Phase 9 can aggregate: `partition`, `scope`, `marketplace`, `name`, `version`, `notes`, `stagedAgents`, `stagedMcpServers`, and `resourcesChanged`.
- `orchestrators/plugin/update.ts` provides the closest bulk UX template for target forms, scope resolution, deterministic partitions, and aggregate presentation.
- `orchestrators/marketplace/shared.ts` has partition rendering utilities already used by update-style output.
- `presentation/reload-hint.ts`, `presentation/soft-dep.ts`, and `platform/pi-api.ts` provide existing reload and soft-dependency warning composition; Phase 9 should reuse rather than invent strings.
- `edge/handlers/plugin/update.ts` is the handler-shim template for parsing lifecycle commands with optional scope and target refs.
- `edge/completions/provider.ts` and `edge/completions/data.ts` already implement update's installed-only plugin-ref completion and `@marketplace` support.

### Established Patterns

- Edge handlers parse arguments and call orchestrators; they should not own lifecycle loops or state mutation policy.
- User-visible messages must flow through `ctx.ui.notify` via shared notify/presentation helpers; no stdout/stderr or ad-hoc notification channels.
- Update-like bulk commands render one summary rather than many unrelated messages.
- Completion values include trailing spaces and should tolerate per-marketplace completion failures where existing tests expect soft-fail behavior.
- Architecture tests protect no-network boundaries; reinstall must remain free of `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`, and `platform/git` imports.
- State scope remains exactly `user` and `project`.

### Integration Points

- Add or extend `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` with a bulk target union and `reinstallPlugins`-style entrypoint.
- Export the bulk reinstall entrypoint from `extensions/pi-claude-marketplace/orchestrators/plugin/index.ts` and any relevant root orchestrator barrel.
- Add `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` and wire it through `edge/router.ts` and `edge/register.ts`.
- Extend argument parsing/validation to accept `--force` safely for reinstall while preserving `--scope` at any position.
- Extend completions in `edge/completions/provider.ts` and `edge/completions/data.ts` for top-level `reinstall`, installed-only refs, and `@marketplace` form.
- Update README docs and add/extend tests for router, handler, completions, orchestrator bulk partitions, no-network guard, reload hints, soft-dep aggregation, and force parsing.

</code_context>

<specifics>
## Specific Ideas

- Likely usage line: `Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force]`.
- Example commands to document:
  - `/claude:plugin reinstall`
  - `/claude:plugin reinstall --scope project`
  - `/claude:plugin reinstall @claude-plugins-official --scope user`
  - `/claude:plugin reinstall pr-review-toolkit@claude-plugins-official`
  - `/claude:plugin reinstall pr-review-toolkit@claude-plugins-official --force`
- Bulk output should be easy to test with stable headings like `Reinstalled:`, `Skipped:`, and `Failed:`.
- Direct single-target not-installed behavior may render as a skipped/not-installed line or `No plugins installed.` as long as no mutation occurs and the message is clear.
- The Phase 8 research conflict on `--force` is intentionally resolved in favor of exposing force now.

</specifics>

<deferred>
## Deferred Ideas

- JSON output for reinstall results remains future work.
- Dry-run/preview mode remains future work.
- Interactive plugin selector remains future work.
- Mutating LLM tool for reinstall remains future work.
- Parallel batch execution remains future work unless a later phase explicitly scopes it.
- Multi-ref reinstall syntax beyond the three Phase 9 target forms remains out of scope.

</deferred>

---

*Phase: 09-reinstall-edge-bulk-ux*
*Context gathered: 2026-05-14*
