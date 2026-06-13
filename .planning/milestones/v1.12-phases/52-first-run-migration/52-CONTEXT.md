# Phase 52: First-Run Migration - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

A Pi user upgrading into v1.12 with an existing install gets a `claude-plugins.json` generated losslessly from their current `state.json` on first load, with nothing uninstalled -- the safety rail that guarantees an existing install is never reconciled against absence.

Success criteria (from ROADMAP):

1. On the first load where no `claude-plugins.json` exists, the extension generates one from the existing `state.json` containing every installed entry -- including soft-degraded `unavailable` ones -- so no declared reality is dropped; `state.json` is left intact and nothing is uninstalled (MIG-01).
2. Migration runs before any reconcile pass in execution order, so a populated install is never seen as "empty desired state" and pruned (MIG-01 ordering rail; the load wiring in Phase 55 places migrate-then-reconcile in that order).
3. Migration is atomic (the config file is written via tmp+rename before any bookkeeping is touched) and idempotent (driven by ENOENT detection, not a half-set flag), so an interrupted or repeated first-load cannot half-generate or double-generate the config (MIG-02, NFR-1, NFR-3).
4. Running a reconcile immediately after a fresh migration is a strict no-op -- zero installs, zero uninstalls, no file rewrites -- proven by a migrate-then-reconcile exit-gate test on a populated `state.json` fixture (MIG-02 convergence gate).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Relevant inherited constraints from Phase 51 (the frozen foundation this phase builds on):
- `persistence/config-io.ts` owns `CONFIG_SCHEMA`, `loadConfig` (discriminated absent/invalid/valid `ConfigLoadResult`), and `saveConfig` (validate → assertPathInside → atomicWriteJson). Migration writes MUST go through `saveConfig`.
- The SPLIT-02 architecture test (`tests/architecture/config-state-write-seams.test.ts`) allow-lists config writers; the migration module must be added to `ALLOWED_CONFIG_JSON_WRITERS` explicitly (the "exactly N" assertion will trip otherwise — that is by design).
- The D-13 ordering rail in `persistence/migrate.ts`/`state-io.ts`: the legacy `autoupdate` scrub in state is gated on `existsSync(configJsonPath)` so the legacy field survives until this phase's migration captures it into the config. Migration must read the legacy `autoupdate` value BEFORE the scrub can destroy it (i.e., capture it from the pre-scrub state record or from the gate-closed state).
- `loadConfig` returning `invalid` is an abort signal (CFG-03) — migration must NOT run when the config file exists but is invalid; ENOENT (`absent`) is the only migration trigger.

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
