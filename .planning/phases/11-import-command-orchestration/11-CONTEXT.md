# Phase 11: Import Command Orchestration - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 wires the Phase 10 Claude settings import plan into the real `/claude:plugin import [--scope user|project]` command. It routes and documents the command, executes missing marketplace adds before plugin installs, preserves user/project scope separation, skips already-present records idempotently, reports unavailable or failed imports as actionable warnings, and validates the full user-facing flow.

This phase does **not** change Phase 10 settings merge semantics, introduce Claude `local` scope, add new marketplace source kinds, or reimplement marketplace/plugin mutation internals. It must consume `buildClaudeImportPlan` and delegate mutation to the existing marketplace-add and plugin-install semantics wherever possible.

</domain>

<decisions>
## Implementation Decisions

### Import Failure Semantics

- **D-01:** Import should continue whenever safe. If a marketplace cannot be added, skip only plugins that depend on that marketplace; continue unrelated marketplace adds and plugin installs.
- **D-02:** Plugin-install outcomes must be classified. Expected unavailable/uninstallable/already-installed outcomes become warning or skip diagnostics; unexpected failures preserve cause text and stop only the affected plugin unless continuing would be unsafe.
- **D-03:** Warnings and errors should be aggregated so the user can identify the affected `plugin@marketplace`, target scope, reason, and relevant cause text.

### User-Facing Import Output

- **D-04:** Preserve underlying `addMarketplace` / `installPlugin` action semantics, but add a final import summary listing installed/skipped/warned items by scope.
- **D-05:** Reload guidance should be aggregated once at import end instead of repeated for every installed plugin.
- **D-06:** Planning should include a notification-control seam for internal plugin installs so `installPlugin` behavior can be reused without immediately notifying the user about reload. Do not duplicate install logic solely to control messages.
- **D-07:** Final warning output should include actionable detail per skipped item: `plugin@marketplace`, target scope, reason, and preserved cause text for unexpected failures.

### Idempotency and Existing Records

- **D-08:** Already-added marketplaces and already-installed plugins are silent skips during normal action execution.
- **D-09:** If everything was already present or no changes were made, the final summary should clearly state that import was already up to date.
- **D-10:** If a marketplace already exists in the target Pi scope but its recorded source differs from the Claude settings source, import should fail/skip imports depending on that marketplace rather than installing from a potentially different marketplace.

### End-to-End Validation Shape

- **D-11:** Phase 11 should prioritize a single rich end-to-end fixture that proves the command works as a user runs it.
- **D-12:** The rich fixture must cover: official GitHub marketplace, extra-known directory marketplace, extra-known GitHub marketplace, local override disabling a base plugin, already-installed skip, unavailable-plugin warning, both user and project scopes, final summary, and source-mismatch skip/failure behavior.

### the agent's Discretion

- Exact import result type names and summary formatting, as long as every warning remains actionable and user-visible messages go through `ctx.ui.notify`.
- Exact classification codes for expected vs unexpected failures, as long as tests can assert unavailable/uninstallable, already-installed, marketplace-add failure, source mismatch, and unexpected failure paths separately.
- Whether source mismatch detection compares normalized source strings, stored state fields, or a helper abstraction, as long as the behavior is deterministic and does not silently install from a mismatched marketplace.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.2 import requirements

- `.planning/PROJECT.md` - Current milestone v1.2 goal, target features, project constraints, and import feature boundaries.
- `.planning/REQUIREMENTS.md` §"Milestone v1.2 Requirements" - IMP-01, IMP-02, IMP-03, IMP-09, IMP-10, and IMP-11 are the primary Phase 11 requirements.
- `.planning/ROADMAP.md` §"Phase 11: Import Command Orchestration" - Phase goal, success criteria, and expected three-plan split.
- `.planning/STATE.md` - Accumulated v1.2 decisions and current handoff from Phase 10.

### Phase 10 foundation consumed by Phase 11

- `.planning/phases/10-claude-settings-import-foundation/10-CONTEXT.md` - Locked settings discovery, merge, source mapping, diagnostic, and scope decisions that Phase 11 must carry forward.
- `.planning/phases/10-claude-settings-import-foundation/10-01-PLAN.md` - Settings discovery and merge model details.
- `.planning/phases/10-claude-settings-import-foundation/10-02-PLAN.md` - Enabled-plugin ref extraction and malformed/non-true entry handling.
- `.planning/phases/10-claude-settings-import-foundation/10-03-PLAN.md` - Marketplace source planning for official and extra-known marketplaces.

### Existing orchestrator and edge contracts

- `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` - Marketplace add semantics, duplicate handling, state locking, source parsing, and no-reload-hint add behavior.
- `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` - Plugin install semantics, installability handling, atomic staging, rollback, soft-dependency warnings, and reload hints.
- `.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md` - `--scope user|project` parsing conventions, edge handler/router layout, and completion patterns.
- `.planning/phases/07-integration-pi-wiring/07-CONTEXT.md` - Pi API wiring, platform wrapper, and runtime integration constraints.

### Authoritative PRD constraints

- `docs/prd/pi-claude-marketplace-prd.md` §6.2 - Exactly two Pi scopes, `user` and `project`; no Claude `local` scope.
- `docs/prd/pi-claude-marketplace-prd.md` §6.5 - Completion surface and command surface conventions.
- `docs/prd/pi-claude-marketplace-prd.md` §6.6 - Argument parsing and `--scope` validation requirements.
- `docs/prd/pi-claude-marketplace-prd.md` §6.8 - Reload hint and soft-dependency warning contracts.
- `docs/prd/pi-claude-marketplace-prd.md` §6.9 - State persistence and concurrency constraints.
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 - Error surfaces, severity discipline, and `ctx.ui.notify` output-channel requirement.
- `docs/prd/pi-claude-marketplace-prd.md` §10 - NFRs for atomicity, reload-only recovery, retry safety, network policy, containment, quality bar, and no telemetry.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts`: `buildClaudeImportPlan` already returns scoped marketplace ensure actions, plugin install actions, skipped plugins, and diagnostics.
- `extensions/pi-claude-marketplace/orchestrators/import/types.ts`: Existing import-plan and diagnostic types should be extended or wrapped rather than replaced.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`: `addMarketplace` owns source parsing, state locking, atomic clone/path recording, duplicate checks, and success notification. Phase 11 should delegate marketplace mutation here.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`: `installPlugin` owns installability resolution, staging, rollback, soft-dependency warnings, resource-change notifications, and reload hints. Phase 11 should add a notification-control seam if needed rather than reimplementing this flow.
- `extensions/pi-claude-marketplace/edge/args.ts`: `parseArgs` already supports position-independent `--scope user|project`; import should reuse this behavior.
- `extensions/pi-claude-marketplace/edge/router.ts`: Top-level routing and usage strings need to include `import` consistently with existing commands.

### Established Patterns

- Orchestrators receive resolved `Scope` values from the edge layer; omitted scope defaults vary by command and must be explicit for import because omitted scope means both scopes.
- Existing marketplace-add and plugin-install code use `withStateGuard` internally. Import planning should preserve per-scope safety without adding cross-scope coupling.
- User-visible output must route through shared notify helpers / `ctx.ui.notify`; direct stdout/stderr is forbidden in command and bridge code.
- Existing install operations emit reload hints only on resource changes. Phase 11 needs a seam to aggregate reload guidance once while preserving that resource-change condition.

### Integration Points

- Add a Phase 11 import orchestrator that reads Phase 10 scoped plans, ensures marketplaces first, then installs plugins for each selected scope.
- Add an edge handler for `/claude:plugin import [--scope user|project]` where omitted scope expands to both `user` and `project`; explicit scope narrows to one.
- Update router usage, top-level dispatch, and tab completion data for the new `import` subcommand and `--scope` value completion.
- Extend integration/e2e tests around `tests/orchestrators/import/` and `tests/edge/handlers/` patterns, plus one rich command-level fixture.

</code_context>

<specifics>
## Specific Ideas

- The final import summary should be useful even when underlying add/install messages have already fired: group by scope and include changed, skipped, warning, and up-to-date information.
- Silent idempotent skips are preferred for normal operation, but an all-skipped/no-change import should explicitly say it was already up to date.
- Source mismatch is a safety concern: do not silently trust an existing Pi marketplace by name if Claude settings point at a different source.
- The reload-hint aggregation decision may require extracting the place where install notification happens so internal API calls can install a plugin without immediately messaging the user about reloading.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 11 scope.

</deferred>

---

*Phase: 11-import-command-orchestration*
*Context gathered: 2026-05-14*
