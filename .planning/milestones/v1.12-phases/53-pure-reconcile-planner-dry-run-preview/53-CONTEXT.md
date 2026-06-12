# Phase 53: Pure Reconcile Planner & Dry-Run Preview - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

A Pi user can run a read-only command that shows exactly what the next load's reconcile would do, backed by a pure, exhaustively-testable diff between the merged config and the recorded reality -- no writes, no network.

Success criteria (from ROADMAP):

1. A pure `planReconcile(MergedConfig, state) -> ReconcilePlan` function computes the bidirectional diff -- declared-but-missing marketplaces/plugins to add/install, recorded-but-undeclared (extension-managed) ones to remove/uninstall, and enable/disable transitions -- with the full desired-x-actual matrix covered by a planner architecture test and no disk or network access in the planner (DIFF-01 foundation; reuses the `samePlannedSource` import-planner template).
2. A user can run a read-only diff/preview command that prints exactly the actions the next load's reconcile would take (adds, installs, removals, uninstalls, enable/disable transitions) and performs no writes and no network calls -- verifiable by running it twice and observing identical output with no file or state mutation (DIFF-01).
3. The diff output follows the locked subject-first row grammar (`<glyph> <name> [scope] (status) {reason}`); any pending-tense status tokens it introduces are closed-set extensions landing in lockstep with the `docs/output-catalog.md` catalog and the `catalog-uat` byte fixtures in the same atomic commit (DIFF-02; the planner's disabled-entry handling excludes disabled plugins from the desired-materialized set so the preview never shows them as pending installs).

</domain>

<decisions>
## Implementation Decisions

### Locked (user-decided 2026-06-10)
- D-53-01: The read-only command is `/claude:plugin preview` (subcommand name: `preview`).
- D-53-02: Pending-tense status tokens use the future-tense `(will ...)` form: `will add`, `will remove`, `will install`, `will uninstall`, `will enable`, `will disable`. New closed-set tokens (not reuse of past-tense tokens) so the `shouldEmitReloadHint` ladder is never mis-triggered. Renderer + `docs/output-catalog.md` + catalog-uat byte fixtures land in the SAME atomic commit.

### Claude's Discretion (research recommendations adopted)
- Rendering: one global cascade ordered by name-then-scope (not per-scope fan-out).
- Empty plan renders as a free-form advisory line (no new token).
- Autoupdate-flip bucket deferred (a setting, not a materialization transition) — Phase 55/56 territory.
- `samePlannedSource` extracted from `orchestrators/import/execute.ts` into `domain/source.ts` (pure module) so the planner imports no effectful code; both existing call sites updated, behavior-neutral.
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Inherited constraints from Phases 51-52 (the frozen foundation):
- `MergedConfig` (with per-entry `source: "base" | "local"` provenance) comes from `persistence/config-merge.ts`; `ConfigLoadResult` trichotomy from `config-io.ts` — `invalid` is an abort signal (CFG-03), never an empty desired state.
- Phase 52 left an explicit obligation: a planner-level convergence exit-gate test — `planReconcile` over a freshly migrated config + the originating state must return an empty plan (zero installs, zero uninstalls). This phase MUST land that test (see `tests/persistence/migrate-config.test.ts` header comments).
- The planner must be pure (no fs, no network imports) — mirror the architecture-test enforcement style used by `tests/architecture/config-state-write-seams.test.ts` and the existing import-planner `samePlannedSource` template (find it in the import orchestrator family).
- Disabled plugins (config `enabled: false`) are NOT part of the desired-materialized set: no pending-install row for them; enable/disable transitions are their own action kind (Phase 54 implements the commands; this phase only plans/classifies the transitions).

### Output grammar (locked project conventions — treat as constraints)
- Rows render subject-first: `<glyph> <name> [scope] (status) {reason}` — a status token never precedes the subject.
- Any new status tokens are closed-set catalog amendments: renderer + `docs/output-catalog.md` + `catalog-uat` byte fixtures land in the SAME atomic commit (v1.3 atomic-supersession lesson).
- All user-visible output goes through `ctx.ui.notify` via the structured `notify()` v2 entrypoint in `shared/notify.ts` (IL-2); error/warning-severity notifications carry a non-empty summary line with the cascade as its own block (v1.11 GRAM contract).
- The read-only command must perform no writes and no network (NFR-5 read-surface discipline; same class as `list`/`info`).

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
