# Roadmap: pi-claude-marketplace v1.1 Reinstall Command

## Overview

Milestone v1.1 adds a `reinstall` command to the existing `/claude:plugin` lifecycle surface. The command is intentionally analogous to `update` in syntax and scope handling, but semantically different: it uses cached marketplace manifests, preserves the installed record's existing version, performs no network sync, and forces replacement even when versions match.

The roadmap continues phase numbering from the completed v1.0 successor architecture. Because v1.0 ended at Phase 7, v1.1 begins at Phase 8. The work splits into two dependency-driven phases: first the atomic per-plugin replacement core, then the edge/bulk user experience that depends on that per-plugin guarantee.

## Phases

**Phase Numbering:** continued from previous milestone; v1.1 starts at Phase 8.

- [ ] **Phase 8: Atomic Reinstall Core** - Dedicated reinstall orchestrator and replacement-safe transaction primitives for one plugin
- [ ] **Phase 9: Reinstall Edge & Bulk UX** - `/claude:plugin reinstall` routing, batch forms, completions, docs, and user-facing output

## Phase Details

### Phase 8: Atomic Reinstall Core

**Goal:** A single installed plugin can be reinstalled from the cached marketplace manifest without network access, while preserving the old install on any reinstall failure.

**Depends on:** v1.0 Phase 7 complete

**Requirements:** PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12

**Success Criteria** (what must be TRUE):

1. `reinstall <plugin>@<marketplace>` resolves only an already-installed plugin and returns `No plugins installed.` or an explicit not-installed outcome without mutating disk when the target is absent.
2. Reinstall reads the cached `marketplace.json` from state and never imports or invokes Git/network helpers; a test/architecture guard proves no `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`, or `platform/git` usage exists in the reinstall orchestrator.
3. Reinstall restages resources from the cached manifest but preserves the existing installed record version even when the manifest or plugin source now reports a different version.
4. If preflight, resource preparation, bridge replacement, or state save fails, the old `state.json`, generated skills/prompts/agents/MCP entries, agents index, and plugin data directory remain available.
5. Plugin data is deleted only after resource replacement and state commit both succeed; data cleanup failure emits a warning and does not turn the successful reinstall into failure.

**Plans:** 4 plans

Plans:
- [x] `08-01-PLAN.md` -- Lock-held manual-save transaction helper and no-network architecture guard
- [x] `08-02-PLAN.md` -- Backup-backed skills and commands replacement helpers
- [x] `08-03-PLAN.md` -- Backup-backed agents and MCP replacement helpers
- [ ] `08-04-PLAN.md` -- Single-plugin atomic reinstall orchestrator core

### Phase 9: Reinstall Edge & Bulk UX

**Goal:** A Pi user can drive reinstall through `/claude:plugin` with update-analogous target forms, scope filtering, deterministic batch output, reload hints, soft-dependency warnings, and tab completion.

**Depends on:** Phase 8

**Requirements:** PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15, PRL-16

**Success Criteria** (what must be TRUE):

1. `/claude:plugin reinstall`, `/claude:plugin reinstall @<marketplace>`, and `/claude:plugin reinstall <plugin>@<marketplace>` route through the command surface with a clear `Usage:` block on empty/invalid forms.
2. `--scope user|project` is accepted at any argument position; bare reinstall enumerates the selected scope set, while marketplace/plugin targets resolve scope with the same ambiguity/not-found behavior as `update`.
3. Batch reinstall continues per plugin and reports deterministic `reinstalled` / `skipped` / `failed` partitions; one plugin failure does not corrupt or uninstall other plugins.
4. Successful reinstall emits the existing `refresh` reload hint only when generated resources changed and includes existing pi-subagents/pi-mcp-adapter soft-dependency warnings when relevant.
5. Tab completion surfaces `reinstall`, completes installed plugin refs, supports `@<marketplace>` form, includes trailing spaces, and preserves existing per-marketplace soft-fail and top-level state-error behavior.

**Plans:** TBD during `/gsd-plan-phase 9`

## Progress

**Execution Order:** 8 → 9

| Phase | Goal | Requirements | Plans | Status | Completed |
| ----- | ---- | ------------ | ----- | ------ | --------- |
| 8. Atomic Reinstall Core | Atomic single-plugin reinstall with preserve-old-on-failure semantics | PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12 | 3/4 plans | Executing | - |
| 9. Reinstall Edge & Bulk UX | Command routing, batch forms, scope, completion, output, docs | PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15, PRL-16 | TBD | Not started | - |

## Coverage

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| PRL-01 | Phase 9 | Pending |
| PRL-02 | Phase 8 | Pending |
| PRL-03 | Phase 9 | Pending |
| PRL-04 | Phase 9 | Pending |
| PRL-05 | Phase 9 | Pending |
| PRL-06 | Phase 8 | Pending |
| PRL-07 | Phase 8 | Pending |
| PRL-08 | Phase 8 | Pending |
| PRL-09 | Phase 8 | Pending |
| PRL-10 | Phase 8 | Pending |
| PRL-11 | Phase 8 | Pending |
| PRL-12 | Phase 8 | Pending |
| PRL-13 | Phase 9 | Pending |
| PRL-14 | Phase 9 | Pending |
| PRL-15 | Phase 9 | Pending |
| PRL-16 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

## Research Notes

- Phase 8 should receive deeper design attention during planning for bridge backup/restore details and rollback-failure/manual-recovery semantics.
- Phase 9 follows existing update/router/completion patterns and should not need external research unless Phase 8 changes the result model.

---
*Roadmap created: 2026-05-13 for milestone v1.1 Reinstall Command*
