# Phase 43: Marketplace Info Command - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`/claude:plugin marketplace info <name> [--scope user|project]` lands as a working read-only command with byte-locked render, per-scope fan-out when no `--scope` is given, argument completion via the TC-5 union pattern, and full catalog UAT coverage of every status/scope state -- exercising the Phase 42 type model and `{not added}` REASON end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Anchored to Phase 42
Phase 42 landed the type model (`MarketplaceInfoMessage` discriminated-union variant + `renderMarketplaceInfo` arm + `composeMpInfoHeader` helper + `{not added}` REASON). Phase 43 wires the command surface (edge handler + orchestrator + completion + catalog states + UAT fixtures) on top of that contract. No closed-set churn should be needed.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Specific reference points:
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `MarketplaceInfoMessage` and `renderMarketplaceInfo` already exist (added Phase 42, fixed in commits cd0bc40 + 3704efd)
- Phase 42 first catalog state (the `--scope` mismatch) is the only existing MarketplaceInfoMessage fixture; Phase 43 fills in the rest (path + github sources, installed/available/unavailable/failed scope states)
- TC-5 completion union pattern -- referenced in the goal; researcher should locate existing TC-1..TC-4 completion modes for pattern parity
- Orchestrators live under `extensions/pi-claude-marketplace/orchestrators/marketplace/`
- Edge handlers live under `extensions/pi-claude-marketplace/edge/`

</code_context>

<specifics>
## Specific Ideas

Per the ROADMAP phase definition, this phase should produce:
- Edge handler for the `marketplace info` command
- Orchestrator implementing per-scope fan-out (when no `--scope` is given, render both user + project)
- TC-5 completion mode for marketplace-name argument
- Catalog states in `docs/output-catalog.md` for every status/scope state
- Catalog UAT fixtures matching each state, byte-equal via `notify()`

</specifics>

<deferred>
## Deferred Ideas

- Phase 44 will add the parallel `plugin info` command (uses the install-cascade form with `PluginInfoMessage`)
- Closed-set additions (would violate Phase 42's atomic-supersession)

</deferred>
