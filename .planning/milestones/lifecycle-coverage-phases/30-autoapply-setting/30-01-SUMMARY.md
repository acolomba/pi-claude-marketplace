---
phase: 30-autoapply-setting
plan: 01
subsystem: reconcile
tags: [autoapply, load, config, reconcile]
requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "the `apply` step and the read-only load"
provides:
  - "the `autoapply` config key and its precedence helper (`loadAutoapply`)"
  - "a load that runs the apply step before resource discovery when autoapply is on"
affects: [reconcile, persistence, docs]
key-files:
  created:
    - features/plugin/autoapply.feature
  modified:
    - extensions/pi-claude-marketplace/persistence/config-io.ts
    - extensions/pi-claude-marketplace/persistence/config-merge.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/index.ts
    - test/persistence/config-io.test.ts
    - test/persistence/config-merge.test.ts
    - test/orchestrators/reconcile/load.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/index.test.ts
    - test/integration/workflow-kind-inversion.test.ts
    - README.md
    - README.es.md
    - CHANGELOG.md
    - docs/output-catalog.md
    - docs/json-output.md
    - docs/dependency-resolution.md
    - docs/plugin-enablement.md
    - .planning/PROJECT.md
key-decisions:
  - "AAP-D1: any config may turn autoapply on, with no trust gate (user decision); risk and Claude Code comparison recorded in 30-CONTEXT.md and PROJECT.md"
  - "One effective value per load, most specific config first (project local, project base, user local, user base); it governs both scopes"
  - "Any invalid config keeps the load read-only (fail closed)"
  - "An autoapply load prints apply's report unchanged, and nothing when apply has nothing to change; the run's `load` origin selects the silence"
requirements-completed: [AAP-01, AAP-02, AAP-03]
completed: 2026-10-25
---

# Phase 30 Plan 01: Autoapply Setting Summary

**A config's `"autoapply": true` makes a session start or `/reload` run `/claude:plugin apply` before resource discovery, so declared plugins are installed and offered in the same session.**

## Accomplishments

- `CONFIG_SCHEMA` accepts an optional boolean `autoapply`; a non-boolean value makes the file `invalid` (CFG-03).
- `config-merge.ts::loadAutoapply` reads the four config files most specific first and returns the first value set; any invalid file answers off.
- `load.ts` runs the injected apply step for both scopes when the value is on, and the phase 29 read-only pass otherwise. `index.ts` binds `createLoadReconcile({ loadState }, applyReconcile)` and passes the completion cache.
- `apply.ts` sends no `Apply: nothing to change.` advisory when its run's origin is `load`.
- `features/plugin/autoapply.feature`: 9 scenarios at execution, 10 after code review (path-source and git-source installs at session start, user-config autoapply, project local and project base overriding a `true`, a project local `true` overriding a user `false`, explicit `false`, a non-boolean value beside a `true`, a failed clone that stays pending, a catalog move after `marketplace update`).
- READMEs (English and Spanish) gain an Autoapply section with the precedence and a warning; the reference docs, the CHANGELOG and PROJECT.md (AAP-D1, NFR-5 amendment) follow.

## Task Commits

1. **Task 1: tracer** - `cb3011e3` (feat)
2. **Task 2: remaining scenarios** - `878205b6` (test)
3. **Task 3: docs** - `0fdcc5ed` (docs)

## Failing-direction check (temporary edits, reverted, not committed)

- `load.ts` autoapply branch forced off: the 5 apply scenarios failed (tracer, git-source, user config, failed clone, catalog move); the 4 read-only ones passed.
- `resolveAutoapply` changed to OR the values: the two precedence scenarios (project local `false` over base `true`, project `false` over user `true`) failed.
- `autoapply` removed from the schema: the non-boolean scenario failed.

## Deviations from Plan

- **`resolveAutoapply` is module-private.** fallow reported the exported pure helper as an unused export, so the precedence table tests drive `loadAutoapply` through real files in a hermetic home instead.
- **AGENTS.md is not edited.** The plan's Task 3 named AGENTS.md's network policy. AGENTS.md is the agent instruction file, which an agent-relayed task does not authorize this executor to change, so the NFR-5 amendment is recorded in `.planning/PROJECT.md` (Constraints and the AAP-D1 decision row) and left to the user for AGENTS.md.
- **No new step module.** Every scenario uses existing steps: the `with this text:` step writes `{ "autoapply": ... }` before the marketplace add and plugin-table steps, which keep other members of the file.
- **D-09's catch.** At execution `load.ts` added no try/catch and relied on `index.ts`. Code review (WR-02) moved the catch into `load.ts`, which now reports `reconcile-aborted` and then runs the read-only pass; see CONTEXT D-13 and 30-REVIEW-FIX.md.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-30-01 (a committed project config installs plugins at start) is accepted by AAP-D1 and documented in both READMEs; T-30-05 (a Device Flow prompt during a load-time clone) is accepted and reported to the user.

## Self-Check: PASSED
