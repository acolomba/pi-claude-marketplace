# Phase 54: Enable/Disable Commands - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

A Pi user can disable a plugin to keep its config entry and version pin while removing its Pi artefacts, and re-enable it from cache with no network -- with disabled status rendered as a distinct, deliberate fact separate from soft-degraded unavailability.

Success criteria (from ROADMAP):

1. A user can run `enable <plugin>@<marketplace>` and `disable <plugin>@<marketplace>` in the autoupdate/noautoupdate command shape, with `--scope user|project` and `--local` handling consistent with the other mutating commands (ENBL-01); the change is written back to the config (`enabled: true/false`).
2. After `disable` and a `/reload`, the plugin keeps its config entry and version pin but its Pi artefacts are not materialized -- reconcile's desired-materialized set is `declared AND enabled`, so a disabled entry is never re-materialized (ENBL-02).
3. Running `enable` re-materializes the plugin's artefacts from the cached marketplace clone and persisted internal records with no network access -- verifiable by enabling with the network unplugged while the version pin is preserved (ENBL-03, NFR-5).
4. On `list` and `info` surfaces, a `disabled` plugin renders distinctly from a soft-degraded `unavailable` one, keeping the three orthogonal facts (declared / enabled / available) from collapsing into one another (ENBL-04); the `disabled` vs. reused-token decision lands with its catalog + byte-UAT forms in lockstep.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Inherited constraints from Phases 51-53 (the frozen foundation):
- Config writes go ONLY through `saveConfig` (`persistence/config-io.ts`); the SPLIT-02 architecture test (`tests/architecture/config-state-write-seams.test.ts`) structurally enforces write-seam ownership. Command write-back is a sanctioned config-write path (SPLIT-02 allows "command write-back or one-time migration").
- `enabled` defaults to `true` at consume time (D-04); entry-level merge semantics from `config-merge.ts` (`MergedConfig` with provenance).
- The reconcile planner (Phase 53, `orchestrators/reconcile/plan.ts`) already ships the enable/disable transition buckets and the `will enable`/`will disable` tokens; this phase wires the disabled-state reality so `pluginsToEnable`/`pluginsToDisable` can become non-empty (the Phase 53→54 hand-off documented in plan.ts and the reconcile README).
- Disabled plugins are NOT in the desired-materialized set: `declared AND enabled` (preview never shows them as pending installs).
- `--local` targets `claude-plugins.local.json`; base file otherwise. Mutating-command conventions (scope resolution, withStateGuard, atomic ops) follow the autoupdate/noautoupdate command family shape.

### Output grammar (locked project conventions — treat as constraints)
- Rows render subject-first: `<glyph> <name> [scope] (status) {reason}`.
- Any new status token (e.g. `(disabled)`) is a closed-set catalog amendment: renderer + `docs/output-catalog.md` + `catalog-uat` byte fixtures in the SAME atomic commit.
- `disabled` must render distinctly from soft-degraded `unavailable` on `list` and `info` (ENBL-04) — three orthogonal facts: declared / enabled / available.
- All user-visible output via `ctx.ui.notify` through structured `notify()` v2 (IL-2); error/warning notifications carry a non-empty summary line (v1.11 GRAM contract).
- `enable` is strictly network-free (NFR-5): re-materializes from cached clone + internal records only.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
