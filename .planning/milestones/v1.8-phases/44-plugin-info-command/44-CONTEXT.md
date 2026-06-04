# Phase 44: Plugin Info Command - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`/claude:plugin info <plugin>@<marketplace> [--scope user|project]` lands as a working read-only command using the install-cascade always-marketplace-header form, with status-aware plugin rows, hard-wrapped descriptions at col 4 indent / 66-col total, sorted-by-kind component lists, the `components: not resolved` marker for unsynced external sources, plugin-info argument completion in a new TC-6 mode, and full catalog UAT coverage -- closing the v1.8 milestone.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Anchored to Phases 42 and 43
- Phase 42 landed: `PluginInfoMessage` discriminated-union variant + `renderPluginInfo` arm + `wrapDescription` helper + `componentsResolved: true|false` discriminator + `{not added}` REASON.
- Phase 43 landed: per-scope fan-out pattern (`MarketplaceInfoCascadeMessage`); orchestrator/edge/completion patterns for read-only info commands; catalog UAT seam for info H2 sections.
- Phase 44 wires the second info surface (plugin) on top of both -- orchestrator + edge handler + new TC-6 "info" mode + catalog states + UAT fixtures.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Reference points:
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `PluginInfoMessage`, `renderPluginInfo`, `wrapDescription`, `PluginInfoComponentsResolved`/`Unresolved` discriminator already exist (Phase 42; warning-fixed in commits cd0bc40 + 3704efd)
- Phase 43 first plugin-info catalog state: none yet -- Phase 42 added only the `{not added}` scope-mismatch fixture for marketplace-info; Phase 44 fills in all plugin-info states.
- `orchestrators/marketplace/info.ts` (Phase 43) -- closest analog for new `orchestrators/plugin/info.ts`
- `edge/handlers/marketplace/info.ts` (Phase 43) -- closest analog for new `edge/handlers/plugin/info.ts`
- `edge/completions/provider.ts` -- TC-6 branch (`<plugin>@<marketplace>`) currently handles `install/uninstall/update/reinstall`; Phase 44 adds a new `info` mode that unions installed + available + unavailable across both scopes
- For per-scope fan-out (INFO-03 already met by Phase 43's `MarketplaceInfoCascadeMessage`): Phase 44 needs a parallel `PluginInfoCascadeMessage` wrapper (or extend the cascade variant generically) for the both-scopes case

</code_context>

<specifics>
## Specific Ideas

Per the ROADMAP phase definition, Phase 44 owns INFO-02 (plugin-info byte form) + INFO-05 (`components: not resolved` marker), and should produce:
- Orchestrator: `orchestrators/plugin/info.ts` (local-state only; NFR-5 carry-forward)
- Edge handler: `edge/handlers/plugin/info.ts` + router/register wiring
- TC-6 new "info" mode in `edge/completions/provider.ts`: unions installed + available + unavailable plugin-refs across both scopes (per INFO-06)
- New cascade variant for per-scope fan-out (parallel to `MarketplaceInfoCascadeMessage`)
- Catalog states under new `## /claude:plugin info <plugin>@<marketplace>` H2 in `docs/output-catalog.md`
- UAT fixtures matching each state in `tests/architecture/catalog-uat.test.ts`

State matrix (per INFO-02/03/04/05/07):
- Status: `installed` | `available` | `unavailable` | `failed`
- Scope: `--scope user` | `--scope project` | (omitted → fan-out both)
- Components: resolved (per-kind sorted lists, optional dependencies) | unresolved (`components: not resolved` marker, INFO-05)
- Description: present (hard-wrapped at col 4 / 66-col total via `wrapDescription`) | absent
- Failure modes: `{not added}` (`mp` not added at all) and `{not in manifest}` (`mp` exists but plugin not in its manifest)

</specifics>

<deferred>
## Deferred Ideas

- Closed-set extensions (would violate Phase 42's atomic-supersession)
- Any additional info surfaces beyond `plugin info` and `marketplace info` -- out of scope for v1.8

</deferred>
