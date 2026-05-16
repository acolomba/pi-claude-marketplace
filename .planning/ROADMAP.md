# Roadmap: pi-claude-marketplace v1.1 Reinstall Command

## Overview

Milestone v1.1 adds a `reinstall` command to the existing `/claude:plugin` lifecycle surface. The command is intentionally analogous to `update` in syntax and scope handling, but semantically different: it uses cached marketplace manifests, preserves the installed record's existing version, performs no network sync, and forces replacement even when versions match.

The roadmap continues phase numbering from the completed v1.0 successor architecture. Because v1.0 ended at Phase 7, v1.1 begins at Phase 8. The work splits into two dependency-driven phases: first the atomic per-plugin replacement core, then the edge/bulk user experience that depends on that per-plugin guarantee.

## Phases

**Phase Numbering:** continued from previous milestone; v1.1 starts at Phase 8.

- [x] **Phase 8: Atomic Reinstall Core** - Dedicated reinstall orchestrator and replacement-safe transaction primitives for one plugin
- [x] **Phase 9: Reinstall Edge & Bulk UX** - `/claude:plugin reinstall` routing, batch forms, completions, docs, and user-facing output

The merge from main also brings in the completed v1.2 phases:

- [x] **Phase 10: Claude Settings Import Foundation** - Read/merge Claude settings, extract enabled plugin refs, map marketplace sources including official built-in marketplace
- [x] **Phase 11: Import Command Orchestration** - `/claude:plugin import [--scope user|project]` handler, idempotent marketplace/plugin orchestration, warnings and reload-hint integration

Phases 1-7 belong to the v1.0 successor architecture and are documented in `PROJECT.md` under Validated requirements.

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
- [x] `08-04-PLAN.md` -- Single-plugin atomic reinstall orchestrator core

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

**Plans:** 4 plans

Plans:
- [x] `09-01-PLAN.md` -- Bulk reinstall orchestrator, quiet seam, deterministic summary output
- [x] `09-02-PLAN.md` -- Reinstall edge handler, router, registration, --scope, and --force
- [x] `09-03-PLAN.md` -- Reinstall tab completion and failure semantics
- [x] `09-04-PLAN.md` -- README docs, static docs test, full validation, and traceability

### Phase 10: Claude Settings Import Foundation

**Goal**: A pure, testable import-planning foundation can read Claude Code settings for user/project scopes, merge base plus local override correctly, extract only true-enabled plugin refs, and resolve marketplace sources for official and extra-known marketplaces without mutating Pi state **Depends on**: Phase 7 and the separately-developed v1.1 milestone merge **Requirements**: IMP-04, IMP-05, IMP-06, IMP-07, IMP-08 **Success Criteria** (what must be TRUE):

1. Settings discovery reads the correct files per scope: user Claude settings and project `.claude/settings*.json`; missing files are treated as empty while malformed JSON reports a warning/error through the import result path rather than crashing the process.
2. Merge semantics are deterministic: `settings.local.json` overrides `settings.json`, including disabling a base `enabledPlugins["plugin@marketplace"]: true` by setting the local value to `false`.
3. Enabled-plugin extraction returns only refs whose merged value is exactly boolean `true`; malformed keys and non-true values are ignored or warned according to import policy without blocking valid refs.
4. Marketplace source planning maps `claude-plugins-official` to `anthropics/claude-plugins-official` when missing, and maps `extraKnownMarketplaces` Claude `directory` and `github.repo` sources into existing Pi source parser inputs.
5. Unit tests cover both-scope duplication: if the same plugin/marketplace is enabled in user and project Claude settings, the import plan contains one action per matching Pi scope.

**Plans**: 3 plans

- [x] `10-01-PLAN.md` -- Settings file discovery and merge model for user/project scopes with local override tests (Wave 1)
- [x] `10-02-PLAN.md` -- Enabled-plugin ref extraction and malformed/non-true entry handling (Wave 1)
- [x] `10-03-PLAN.md` -- Marketplace source planning: official built-in mapping + extraKnownMarketplaces directory/github mapping (Wave 2)

### Phase 11: Import Command Orchestration

**Goal**: A Pi user can run `/claude:plugin import [--scope user|project]` and have enabled Claude Code plugins installed into the matching Pi scopes idempotently, with missing marketplaces added first and unavailable plugins reported as warnings while valid imports continue **Depends on**: Phase 10 **Requirements**: IMP-01, IMP-02, IMP-03, IMP-09, IMP-10, IMP-11 **Success Criteria** (what must be TRUE):

1. `/claude:plugin import` is routed and documented consistently with existing commands; `--scope` accepts only `user` and `project`, may appear at any position, and omitted scope processes both scopes.
2. Import adds missing marketplaces before installing enabled plugins, skips marketplaces/plugins already present in the target scope, and preserves same-name marketplace/plugin imports in both user and project scopes when both Claude scopes enable them.
3. Import reuses existing marketplace-add and plugin-install semantics so network access, state locking, atomic staging, soft-dependency warnings, and reload hints match the underlying operations.
4. Unavailable/uninstallable enabled plugins do not abort the whole import; they are aggregated and reported at warning severity with enough context to identify `plugin@marketplace` and target scope.
5. Integration tests exercise a mixed import: official GitHub marketplace, extra-known directory marketplace, extra-known GitHub marketplace, local override disabling a base plugin, already-installed skip, and unavailable-plugin warning.

**Plans**: 3 plans

- [x] `11-01-PLAN.md` -- Import orchestrator: action execution, idempotency, per-scope state locking, warning aggregation (Wave 1)
- [x] `11-02-PLAN.md` -- Edge handler/router/completion updates for `/claude:plugin import [--scope user|project]` (Wave 2)
- [x] `11-03-PLAN.md` -- End-to-end import fixtures and validation sign-off (Wave 3)

## Progress

**Execution Order:** 8 → 9 (v1.1 milestone scope). v1.0 executed 1 → 2 → 3 → 4 → 5 → 6 → 7; v1.2 added 10 → 11.

| Phase | Goal | Requirements | Plans | Status | Completed |
| ----- | ---- | ------------ | ----- | ------ | --------- |
| 8. Atomic Reinstall Core | Atomic single-plugin reinstall with preserve-old-on-failure semantics | PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12 | 4/4 plans | Complete | 2026-05-14 |
| 9. Reinstall Edge & Bulk UX | Command routing, batch forms, scope, completion, output, docs | PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15, PRL-16 | 4/4 plans | Complete | 2026-05-14 |
| 10. Claude Settings Import Foundation (v1.2) | Pure import-planning foundation | IMP-04..IMP-08 | 3/3 plans | Complete | 2026-05-14 |
| 11. Import Command Orchestration (v1.2) | `/claude:plugin import` command | IMP-01..IMP-03, IMP-09..IMP-11 | 3/3 plans | Complete | 2026-05-14 |

## Coverage

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| PRL-01 | Phase 9 | Complete |
| PRL-02 | Phase 8 | Complete |
| PRL-03 | Phase 9 | Complete |
| PRL-04 | Phase 9 | Complete |
| PRL-05 | Phase 9 | Complete |
| PRL-06 | Phase 8 | Complete |
| PRL-07 | Phase 8 | Complete |
| PRL-08 | Phase 8 | Complete |
| PRL-09 | Phase 8 | Complete |
| PRL-10 | Phase 8 | Complete |
| PRL-11 | Phase 8 | Complete |
| PRL-12 | Phase 8 | Complete |
| PRL-13 | Phase 9 | Complete |
| PRL-14 | Phase 9 | Complete |
| PRL-15 | Phase 9 | Complete |
| PRL-16 | Phase 9 | Complete |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

## Research Notes

- Phase 8 should receive deeper design attention during planning for bridge backup/restore details and rollback-failure/manual-recovery semantics.
- Phase 9 follows existing update/router/completion patterns and should not need external research unless Phase 8 changes the result model.

---
*Roadmap created: 2026-05-13 for milestone v1.1 Reinstall Command*
*Last updated: 2026-05-14 after Phase 8 completion*
*Last updated: 2026-05-14 after Phase 9 completion*
*Last updated: 2026-05-16 after merge from main brought in v1.2 phases 10 & 11.*
