# Phase 10: Claude Settings Import Foundation - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers a pure, testable import-planning foundation for Claude Code settings. It reads standard Claude settings files for user and project scopes, merges base plus local override deterministically, extracts enabled plugin refs, and maps marketplace sources for the official built-in marketplace plus supported `extraKnownMarketplaces` entries.

This phase does **not** mutate Pi state, add marketplaces, install plugins, wire `/claude:plugin import`, or emit reload hints. Those orchestration and edge concerns belong to Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Settings Discovery Paths

- **D-01:** Use standard Claude Code settings paths, while respecting Claude Code's `CLAUDE_CONFIG_DIR` override for the user settings home when it is set:
  - User scope default: `~/.claude/settings.json` plus `~/.claude/settings.local.json`
  - User scope with `CLAUDE_CONFIG_DIR=/path/to/dir`: `/path/to/dir/settings.json` plus `/path/to/dir/settings.local.json`
  - Project scope: `<cwd>/.claude/settings.json` plus `<cwd>/.claude/settings.local.json`
- **D-02:** Missing settings files are treated as empty settings for that scope.
- **D-03:** Phase 10 should remain pure/testable; planners should add a path resolver seam that accepts an explicit Claude config dir/env override for tests. Production semantics are the standard paths above plus `CLAUDE_CONFIG_DIR` for the user settings home.

### Merge Semantics

- **D-04:** Merge base and local settings with shallow object merge for the known sections Phase 10 consumes.
- **D-05:** For `enabledPlugins`, merge entries by plugin-ref key; local values override base values. This allows `settings.local.json` to disable a base-enabled plugin by setting the same key to `false` while preserving unrelated base entries.
- **D-06:** For `extraKnownMarketplaces`, merge entries by marketplace name; local values override base values. Do not deep-merge nested marketplace source objects.

### Malformed Settings Policy

- **D-07:** Use warn-and-continue wherever possible. Valid refs in valid portions of settings should still produce import-plan actions even when unrelated entries are malformed.
- **D-08:** Malformed JSON in one settings file records a diagnostic for that scope instead of crashing the process. Other files/scopes continue to be processed.
- **D-09:** Malformed `enabledPlugins` keys are reported and skipped without blocking valid refs.
- **D-10:** `enabledPlugins` entries whose merged value is exactly boolean `true` are imported. Boolean `false` is silent/normal and means disabled. Non-boolean values are warnings and are not imported.

### Marketplace Source Mapping

- **D-11:** Claude Code's built-in `claude-plugins-official` marketplace maps to Pi source `anthropics/claude-plugins-official` when missing from the target Pi scope.
- **D-12:** For non-official marketplaces, map only source shapes that match Pi-supported marketplace source patterns:
  - Claude `directory` source -> Pi path-source marketplace add input
  - Claude `github.repo` source -> Pi GitHub-source marketplace add input
- **D-13:** Unsupported or missing `extraKnownMarketplaces` source info records a warning. Plugin refs depending on that missing/unmappable marketplace become unavailable/skipped in the import plan rather than blocking unrelated valid refs.
- **D-14:** Do not attempt broad parsing of arbitrary source-looking values in Phase 10; unsupported Claude source shapes are outside the supported Pi marketplace source contract for v1.2.

### Scope Carry-Forward

- **D-15:** Carry forward milestone decision D-26: `/claude:plugin import` with omitted `--scope` processes both user and project Claude settings and maps them to matching Pi scopes. Explicit `--scope user|project` narrows to one matching scope.
- **D-16:** Claude `local` scope remains out of scope; Phase 10 must not introduce a third Pi scope.

### the agent's Discretion

- Exact diagnostic object shape/naming, as long as malformed JSON, malformed refs, non-boolean values, and unmappable marketplace sources are distinguishable for Phase 11 warning presentation.
- Exact module/file names for the pure foundation, as long as import boundaries are respected and downstream orchestration can consume the plan without re-reading settings.
- Whether test seams are root-path injection, filesystem abstraction, or explicit file-content inputs; production path semantics are locked by D-01.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.2 milestone requirements

- `.planning/PROJECT.md` - Current milestone v1.2 goal, target features, and project-wide decisions D-26/D-27 for import scope and official marketplace mapping.
- `.planning/REQUIREMENTS.md` §"Milestone v1.2 Requirements" - IMP-04 through IMP-08 are the primary Phase 10 requirements; IMP-01 through IMP-03 and IMP-09 through IMP-11 frame Phase 11 consumers.
- `.planning/ROADMAP.md` §"Phase 10: Claude Settings Import Foundation" - Phase-goal source for the v1.2 Claude settings import foundation.
- `.planning/STATE.md` - Current milestone state and accumulated v1.2 decisions.

### Existing v1 contracts that constrain Phase 10

- `docs/prd/pi-claude-marketplace-prd.md` §6.1 - Existing Pi source parser accepted forms; Phase 10 source mapping must feed only supported `owner/repo`, GitHub URL, or local path forms into later marketplace-add orchestration.
- `docs/prd/pi-claude-marketplace-prd.md` §6.2 - Two-scope model (`user`, `project`) and no Claude `local` scope.
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 - User-visible diagnostics ultimately route through `ctx.ui.notify`; Phase 10 itself should return diagnostics for Phase 11 rather than writing stdout/stderr.
- `docs/prd/pi-claude-marketplace-prd.md` §10 - Network policy and retry-safety constraints; Phase 10 is pure planning and must not touch network or mutate Pi state.

### Prior phase carry-forward

- `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md` - Source parsing, state shape, per-scope independence, and TypeBox validation patterns.
- `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` - Marketplace add semantics, source parsing inputs, idempotent duplicate handling, and no-reload-hint add behavior consumed by Phase 11.
- `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` - Plugin install semantics, cached-manifest-only install policy, unavailable plugin handling, and soft-dependency warning patterns consumed by Phase 11.
- `.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md` - `--scope user|project` parsing conventions and edge-handler layout that Phase 11 will extend.
- `.planning/phases/07-integration-pi-wiring/07-CONTEXT.md` - Real Pi wiring, platform API wrapper, and state-lock semantics that Phase 11 orchestration must reuse.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/domain/source.ts`: Existing `parsePluginSource`, `pathSource`, and `githubSource` funnels define the Pi-supported source inputs Phase 10 should produce for marketplace add planning.
- `extensions/pi-claude-marketplace/persistence/locations.ts`: Existing `locationsFor(scope, cwd)` models Pi user/project scopes. Phase 10 may add or mirror a Claude-settings path resolver, but must keep Pi scope semantics aligned.
- `extensions/pi-claude-marketplace/persistence/state-io.ts`: Existing `loadState` returns empty state on missing file and throws structured errors for malformed state; Phase 10 should follow the same explicit error/warning discipline for settings diagnostics.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`: Phase 11 will consume Phase 10 marketplace-source actions by delegating to existing add semantics rather than reimplementing mutation.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`: Phase 11 will consume Phase 10 plugin actions by delegating to existing install semantics rather than reimplementing staging.
- `extensions/pi-claude-marketplace/edge/args.ts`: Existing `--scope user|project` parser conventions should be reused by Phase 11; Phase 10 plan types should model the same two scopes.

### Established Patterns

- Pure domain/persistence helpers return typed results and diagnostics rather than printing; command/bridge code uses notify wrappers for user-visible output.
- Missing persisted files often map to empty/default state; malformed structured files surface explicit diagnostics.
- TypeScript strict discriminated unions are preferred for results that may be valid vs warning/error-bearing.
- Existing marketplace and plugin mutation semantics already handle atomicity, locks, soft dependencies, reload hints, and network policy; Phase 10 should only plan actions for those later orchestrators.

### Integration Points

- Phase 10 should likely introduce a new pure foundation module (for example under `domain/` or `orchestrators/import/` depending on planner boundary decisions) that returns an import plan grouped by `Scope`.
- Phase 11 `/claude:plugin import` orchestration should consume this plan, add missing marketplaces first, then install enabled plugins, preserving existing idempotency and warnings.
- Tests should create temp Claude settings roots or inject file reads; production code uses the standard paths locked in D-01 and should test `CLAUDE_CONFIG_DIR` by pointing it at a temp user settings directory.

</code_context>

<specifics>
## Specific Ideas

- Follow-up research found Claude Code 2.1.116 exposes `CLAUDE_CONFIG_DIR` in its binary strings and help-adjacent setting-source text confirms filesystem settings sources: `user` = global user settings, `project` = `.claude/settings.json`, `local` = `.claude/settings.local.json`. Phase 10 should respect `CLAUDE_CONFIG_DIR` for user-scope settings and use it as a convenient test seam.
- The user specifically chose supported source mapping because “it's the same patterns we support.” Downstream agents should not add broad best-effort parsing for unsupported Claude marketplace source objects.
- The local override case that must be tested: base enables `plugin@mp: true`, local sets `plugin@mp: false`, final extraction does not include that plugin.
- Non-boolean enabled values such as `"true"`, `1`, `null`, or `{}` should be warnings; boolean `false` should not be noisy.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within the Phase 10 foundation scope.

</deferred>

---

*Phase: 10-claude-settings-import-foundation*
*Context gathered: 2026-05-13*
