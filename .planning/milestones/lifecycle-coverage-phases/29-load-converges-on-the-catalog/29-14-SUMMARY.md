---
phase: 29-load-converges-on-the-catalog
plan: 14
subsystem: docs
tags: [apply, decisions, readme, changelog, reconcile, architecture-map, output-catalog]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-13: apply re-materializes grown plugins; the backfill and EXTENSION_VERSION are deleted"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-08: the load prints pending's block through composePendingReport"
provides:
  - "PROJECT.md Key Decisions rows APL-D1 (read-only load, apply makes every change, with the Claude Code comparison) and APL-D2 (NFR-2: apply, then /reload, must suffice)"
  - "README.md and README.es.md: configs are the desired state; pending lists, apply changes, /reload loads"
  - "CHANGELOG.md Unreleased entry for apply"
  - "docs/plugin-enablement.md, the reconcile README, the architecture map, the output catalog and reconcile/types.ts comments name apply as the step that changes state"
affects: [phase-29-verification, milestone-pr]

actuals:
  tokens: 21143
  tasks: 2
  commits: 2
plan_head_before: cb0da4787649c92cbf3f2d5527aa9d2afab2fb44
plan_head_after: b2c4502a77018e304f96f40d5ad9b96af01d74d5

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - README.md
    - README.es.md
    - CHANGELOG.md
    - docs/plugin-enablement.md
    - docs/output-catalog.md
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "README.md's dependents sentence says apply reinstalls the uninstalled dependency and disables the dependents only if that install fails, as docs/dependency-resolution.md states, instead of the plan's 'apply disables those dependents'"
  - "The APL-D1 rationale cites loading.md by full URL and names host-marketplace.md and org.md beside it, because the phase records no full URL for org.md"

patterns-established: []

requirements-completed: [APL-04]

coverage:
  - id: D1
    description: "APL-D1 and APL-D2 rows in PROJECT.md's Key Decisions table, with the D-01 upstream comparison and its sources"
    requirement: APL-04
    verification:
      - kind: other
        ref: "grep -c 'APL-D1' .planning/PROJECT.md (1); grep -c 'APL-D2' .planning/PROJECT.md (2); pre-commit run --files .planning/PROJECT.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "README.md and README.es.md tell users to run pending, then apply, then /reload after a hand edit"
    requirement: APL-04
    verification:
      - kind: other
        ref: "grep -c 'claude:plugin apply' README.md (5) and README.es.md (3); pre-commit run --files README.md README.es.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "One CHANGELOG.md Unreleased entry for apply"
    requirement: APL-04
    verification:
      - kind: other
        ref: "grep -c 'claude:plugin apply' CHANGELOG.md (2); pre-commit run --files CHANGELOG.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "The enablement doc, the reconcile README and the architecture map describe apply as the state-changing step and the load as read-only"
    requirement: APL-04
    verification:
      - kind: other
        ref: "grep -c 'backfill.ts' reconcile/README.md (0); grep -c 'convergence.ts' reconcile/README.md (3); grep -c 'claude:plugin apply' docs/plugin-enablement.md (2); npm run test:unpaired; npm run check"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 14: Record the Apply Decisions and Update the Docs Summary

**PROJECT.md now records APL-D1 (a load changes no installation state, and `/claude:plugin apply` makes every change, with the Claude Code comparison) and APL-D2 (the NFR-2 amendment). The READMEs, the CHANGELOG, the enablement doc, the reconcile README, the architecture map and the output catalog now tell the `pending`, `apply`, `/reload` story.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-24T23:01:11Z
- **Completed:** 2026-10-24T23:21:03Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Two Key Decisions rows, in the D-MF style. APL-D1 cites `loading.md`, `host-marketplace.md` and `org.md` (retrieved 2026-10-24) and states D-01's confidence (high, from explicit docs, binary not grepped). It names the three divergences: no background install, no auto-update, and `apply` writes the disk while `/reload` activates. APL-D2 carries the NFR-2 wording.
- README.md: the configuration passage says the configs are the desired state and that a load only lists changes, then gives `pending`, `apply`, `/reload` in a `text` block. The command-reference intro adds "If you edit a config by hand, run `/claude:plugin apply` before `/reload`." The dependents and prune sentences name `apply`. README.es.md has the same two passages, translated.
- CHANGELOG.md: one top-level entry with four sub-bullets (apply's changes and catalog moves, the blocked-move rows, `(will add)`, and the parse-cause row). The sibling entry "When a reload installs a plugin..." now says `/claude:plugin apply`.
- docs/plugin-enablement.md: every "reload convergence loop", "next reload" and "A `/reload` installs a MISSING dependency" now names `apply`. `pending` and a load list the change first.
- Reconcile README: the intro names the three entry points. The module list adds `read-pass.ts`, `load.ts`, `convergence.ts`, `mcp-migration.ts` and `delisted-plugins.ts`, and drops `backfill.ts`. The apply step list ends with the converge step, and a new paragraph describes it. New "Load path" section. The pending paragraph names `composePendingReport`, the LOAD-01 verdict, the D-09-07 assumed-success re-plan and the convergence rows.
- Architecture map: the load-time reconcile flow is now read-only (`loadReconcile` with the read pass, MCP move, pending block, warnings and routing). A new "Apply Request Path" section. The reconcile component row, the orchestrators purpose line and the entry-point subcommand list name `apply`. The deleted `extension-version.ts` is gone from the shared list.

## Task Commits

1. **Task 1: Record APL-D1 and APL-D2 and name apply in the user docs** - `43c9f676` (docs)
2. **Task 2: The enablement doc, the reconcile README and the architecture map** - `b2c4502a` (docs)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] README.md dependents sentence follows the real apply behavior**
- **Found during:** Task 1
- **Issue:** The plan asked for "When you run `/claude:plugin apply`, Pi disables those dependents." Since D-02, `apply` first reinstalls an uninstalled dependency that an enabled dependent still declares, and it disables the dependents only when that install fails (docs/dependency-resolution.md, "Removing a plugin other plugins need").
- **Fix:** "The next `/claude:plugin apply` installs the plugin again as a dependency, because the dependents still declare it. If that install fails, `apply` disables those dependents."
- **Files modified:** README.md
- **Commit:** 43c9f676

**2. [Rule 1 - Bug] Stale "reload" wording outside the plan's file list (orchestrator-requested)**
- **Found during:** Task 2
- **Issue:** docs/output-catalog.md still said the next reload stops on a layer gap (LAYER-06 pending state and `reload-layer-marketplace-undeclared`), that `(will enable)` "applies on next reload", that the load-time reconcile cascade installs, and "the next reload to act on". reconcile/types.ts had the backfill-era section note and an `ApplyReconcileOptions.run` doc that called it the load pass's run. CHANGELOG.md had a sibling entry that said a reload installs a hand-added plugin.
- **Fix:** Each now names `apply`. The types.ts change is comment-only.
- **Files modified:** docs/output-catalog.md, extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts, CHANGELOG.md
- **Commits:** 43c9f676, b2c4502a

**3. [Scope] Architecture map: three small lines beyond the two the plan names**
- **Found during:** Task 2
- **Issue:** The plan says "change nothing else in the map". But the orchestrators purpose line said "load-time reconcile", the entry-point subcommand list left out `apply`, and the shared list named the deleted `extension-version.ts` (the orchestrator asked to drop EXTENSION_VERSION mentions).
- **Fix:** Changed those three phrases only.
- **Files modified:** .planning/codebase/ARCHITECTURE.md
- **Commit:** b2c4502a

---

**Total deviations:** 3 (2 stale-text bugs, 1 scope). **Impact:** documentation only. No behavior changed.

## Issues Encountered

None.

## Follow-ups

- README.es.md has no counterpart of README.md's uninstall/`--keep-data`/`--prune`, dependents (`{dependents unsatisfied}`) and `prune` paragraphs. This drift existed before this plan. The plan did not add translations of passages that do not exist there. A later README sync can close it.
- `.planning/codebase/STRUCTURE.md` line 87 still lists `extension-version.ts` in `shared/`, and line 62 says `reconcile/apply.ts` "drives `resources_discover` self-healing". The plan did not list that file.
- `orchestrators/reconcile/mcp-migration.ts` header still says "the reload's first read" and "the next reload" for the plan's toggle buckets. That text describes the apply path, so "the apply's" is more exact. The plan did not list that file.
- Many `apply.test.ts` titles still say "a reload ..." (29-05 note).
- The operator's memory version-bump checklist names `EXTENSION_VERSION`, which no longer exists. It lives under the user's home, which this executor must not touch.

## Verification

- Task 1: `pre-commit run --files .planning/PROJECT.md README.md README.es.md CHANGELOG.md` exit 0 (also passed in the commit hook). Acceptance: APL-D1 `1`, APL-D2 `2`, README.md `5`, README.es.md `3`, CHANGELOG.md `2`. The tracer gate re-ran the automated verify and it passed.
- Task 2: `pre-commit run` on the five changed files exit 0 after mdformat realigned the enablement table. `npm run test:unpaired` exit 0 (it covers the catalog contract, parser and wire gates that read docs/output-catalog.md). Acceptance: `backfill.ts` `0`, `convergence.ts` `3`, `claude:plugin apply` in docs/plugin-enablement.md `2`.
- `npm run check` at b2c4502a: **exit 0**. Tail:

```text
16 hooks (16 passed)
790 scenarios (790 passed)
7632 steps (7632 passed)
0m 27.203s (3m 7.971s executing your code)
Merged LCOV: coverage/direct.lcov (284 records)
exit=0
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. (T-29-36: the APL-D1 row makes no claim beyond D-01's quoted evidence and states its confidence. T-29-SC: no package was installed.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase complete, ready for the phase gate and verification. REQUIREMENTS.md is untouched: the orchestrator marks APL-* at phase end.

## Self-Check: PASSED

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*
