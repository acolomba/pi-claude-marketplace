# Roadmap: pi-claude-marketplace

## Milestones

- Done **v1.0 successor architecture** -- Phases 1-7 (shipped 2026-05-11)
- Done **v1.1 Reinstall Command** -- Phases 8-9 (shipped 2026-05-14)
- Done **v1.2 Claude Settings Import** -- Phases 10-11 (shipped 2026-05-20)
- Done **v1.3 Consistent Messaging** -- Phases 12-14.2 (shipped 2026-05-25)
- Done **v1.4 Structured Notification Messages** -- Phases 15-21 (shipped 2026-05-28)
- Done **v1.4.1 Post-ship UAT Patches** -- Phases 22-26 (closed 2026-05-30)
- Done **v1.5 Notification Output Polish** -- Phases 27-29 (shipped 2026-05-31)
- Done **v1.6 GitHub Private Marketplace Authentication** -- Phases 30-36 (shipped 2026-06-01)
- Done **v1.7 Transaction Resilience Hardening** -- Phases 37-41 (shipped 2026-06-02)
- Done **v1.8 Plugin and Marketplace Info Commands** -- Phases 42-44 (shipped 2026-06-04)
- Done **v1.9 Manifest In-Memory Cache** -- Phase 45 (shipped 2026-06-07)
- Done **v1.10 Error Attribution & Message-Type Consistency** -- Phases 46-49 (shipped 2026-06-08)
- Done **v1.11 Notification Summary-Line Grammar** -- Phase 50 (shipped 2026-06-08)
- Done **v1.12 Marketplace and Plugin Config Files** -- Phases 51-56 (shipped 2026-06-11)

For full details of each milestone, see `.planning/milestones/v[X.Y]-ROADMAP.md` and `.planning/milestones/v[X.Y]-REQUIREMENTS.md`.

## Phases

<details>
<summary>Done v1.0 successor architecture (Phases 1-7) -- SHIPPED 2026-05-11</summary>

PRD-derived V1 surface. See PROJECT.md "Validated" section for details; phase summaries live under `.planning/phases/`.

- [x] Phase 1: Foundations
- [x] Phase 2: Primitives
- [x] Phase 3: Bridges
- [x] Phase 4: Marketplace Orchestrators
- [x] Phase 5: Plugin Orchestrators
- [x] Phase 6: Edge
- [x] Phase 7: Integration & Real Pi Wiring

</details>

<details>
<summary>Done v1.1 Reinstall Command (Phases 8-9) -- SHIPPED 2026-05-14</summary>

`reinstall` command with atomic per-plugin replacement, cached-manifest reuse, no network sync, bulk-cascade partitioning, reload-hint + soft-dep aggregation, installed-only tab completion plus reinstall-specific `--force`.

- [x] Phase 8: Atomic Reinstall Core (4/4 plans) -- completed 2026-05-13
- [x] Phase 9: Reinstall Edge & Bulk UX (4/4 plans) -- completed 2026-05-14

</details>

<details>
<summary>Done v1.2 Claude Settings Import (Phases 10-11) -- SHIPPED 2026-05-20</summary>

`/claude:plugin import [--scope user|project]` with Claude settings discovery, base/override merge, enabled-plugin extraction, official + extraKnownMarketplaces source mapping, idempotent orchestration, unavailable-plugin warning aggregation, source-mismatch protection.

- [x] Phase 10: Claude Settings Import Foundation -- completed 2026-05-19
- [x] Phase 11: Import Command Orchestration -- completed 2026-05-20

</details>

<details>
<summary>Done v1.3 Consistent Messaging (Phases 12-14.2) -- SHIPPED 2026-05-25</summary>

Closed-set grammar primitives, Wave 1 presentation composers, ES-5 atomic supersession, per-command catalog conformance via byte-equality UAT runner, 34-rule ESLint drift-guard plugin. v1.3 user-contract is structurally enforced. 38/38 CMC requirements satisfied. See `.planning/milestones/v1.3-ROADMAP.md` for full details.

- [x] Phase 12: Messaging Foundations & Renderer Primitives (4/4 plans) -- completed 2026-05-22
- [x] Phase 13: Conformance Refactor & ES-5 Supersession (10/10 plans) -- completed 2026-05-24
- [x] Phase 14: Drift Guard & Test Alignment (6/6 plans) -- completed 2026-05-24
- [x] Phase 14.1: Close gap: CMC-13 propagate declaresAgents/Mcp through import (2/2 plans) -- completed 2026-05-24
- [x] Phase 14.2: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (5/5 plans) -- completed 2026-05-24

</details>

<details>
<summary>Done v1.4 Structured Notification Messages (Phases 15-21) -- SHIPPED 2026-05-28</summary>

Replaced v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simplified the user-output spec to always render a marketplace header with indented plugin rows. Final state: 1120/1120 tests GREEN, ~4300 LoC net removal, V1 severity wrappers + `tests/lint-rules/` + `presentation/` + `shared/grammar/` all retired. See `.planning/milestones/v1.4-ROADMAP.md` for full details (when archived).

- [x] Phase 15: Type Model & ADR Refresh (3/3 plans) -- completed 2026-05-25
- [x] Phase 16: Renderer & Public API (Alongside V1) (6/6 plans) -- completed 2026-05-26
- [x] Phase 17: Spec Rewrite & Catalog UAT Migration (3/3 plans) -- completed 2026-05-26
- [x] Phase 17.1: V2 Grammar Amendment: Autoupdate Surface (INSERTED) (4/4 plans) -- completed 2026-05-26
- [x] Phase 17.2: renderScopeBracket orphan-fold contract fix (INSERTED) (4/4 plans) -- completed 2026-05-26
- [x] Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family (7/7 plans) -- completed 2026-05-27
- [x] Phase 19: Migration Wave 2 -- Plugin Orchestrator Family (6/6 plans) -- completed 2026-05-27
- [x] Phase 20: Migration Wave 3 -- Edge Handlers & UsageError (6/6 plans) -- completed 2026-05-27
- [x] Phase 21: Final Teardown & GREEN Gate (4/4 plans) -- completed 2026-05-28

</details>

<details>
<summary>Done v1.4.1 Post-ship UAT Patches (Phases 22-26) -- CLOSED 2026-05-30</summary>

Closed the 8 gaps surfaced by the v1.4 milestone-spanning UAT: reload-hint suppression on read-only/no-op marketplace ops (G-MIL-01/02/06), plugin.json version tier-2 fallback (G-MIL-05), hash-version `v#<7hex>` display (G-MIL-08), `{lsp}` grammar token rename (G-MIL-04), runtime reproduction of indent ladder (G-MIL-03 refuted) and tab-completion gap (G-MIL-07 deferred-with-finding). 1137/1137 tests GREEN at close.

- [x] Phase 22: Reload-hint Discipline Family (1/1 plans) -- completed 2026-05-29
- [x] Phase 23: Version Display Bundle (2/2 plans) -- completed 2026-05-29
- [x] Phase 24: Grammar Consistency (1/1 plans) -- completed 2026-05-29
- [x] Phase 25: Runtime Publish & Verification (3/3 plans) -- completed 2026-05-29
- [x] Phase 26: GREEN Gate Close (1/1 plans) -- completed 2026-05-30

</details>

<details>
<summary>Done v1.5 Notification Output Polish (Phases 27-29) -- SHIPPED 2026-05-31</summary>

8 UXG output-grammar and severity-presentation refinements from the 2026-05-30 hands-on UAT sweep. Benign no-ops suppressed from `Warning:` (UXG-02), autoupdate marker grammar corrected (UXG-04), update no-op renders `(skipped)` (UXG-05), `<last-updated>` timestamp dropped (UXG-01), summary line prepended to error/warning cascades (UXG-07), update of manifest-absent plugin classifies as `(failed)` (UXG-08). 1168/1168 tests GREEN. Full details: `.planning/milestones/v1.5-ROADMAP.md`.

- [x] Phase 27: Marketplace & Autoupdate Output Grammar (5/5 plans) -- completed 2026-05-31
- [x] Phase 28: Severity Routing & Label Discipline (2/2 plans) -- completed 2026-05-31
- [x] Phase 29: Notification Label Suppression & Update Classification (3/3 plans) -- completed 2026-05-31

</details>

<details>
<summary>Done v1.6 GitHub Private Marketplace Authentication (Phases 30-36) -- SHIPPED 2026-06-01</summary>

On-demand Device Flow auth for private GitHub marketplace sources. Tries `git credential fill` first (silent reuse); triggers Device Flow only on a cache miss or 401; stores the resulting token via `git credential approve`; evicts via `git credential reject` on `onAuthFailure`. No env vars required. Two new modules (`platform/git-credential.ts`, `domain/github-auth.ts`) plus targeted wiring changes. 10/10 AUTH requirements.

- [x] Phase 30: Duplicate Type Fix (AUTH-10) (completed 2026-06-01)
- [x] Phase 31: Credential Subprocess Layer (AUTH-06, AUTH-08, AUTH-09) (completed 2026-06-01)
- [x] Phase 32: Device Flow State Machine (AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07) (completed 2026-06-01)
- [x] Phase 33: git.ts Auth Wiring (AUTH-01, AUTH-02) (completed 2026-06-01)
- [x] Phase 34: GitOps Interface Threading (AUTH-01, AUTH-02) (completed 2026-06-01)
- [x] Phase 35: Orchestrator Call Sites & Output Catalog (AUTH-01, AUTH-02, AUTH-03)
- [x] Phase 36: Integration Gate (all AUTH) (completed 2026-06-01)

</details>

<details>
<summary>Done v1.7 Transaction Resilience Hardening (Phases 37-41) -- SHIPPED 2026-06-02</summary>

Eight correctness fixes to the existing saga/two-phase-commit infrastructure: phase-ledger
undo gap, parallel-rename orphan leaks in agents and commands bridges, ghost state records
on partial cascade unstage, update.ts state-before-commit divergence, reinstall blocking
on orphan targets, and inline documentation for two already-safe patterns. No new
dependencies; no user-visible behavior changes on the happy path.

- [x] Phase 37: Phase-Ledger Undo Gap (TR-02)
- [x] Phase 38: Sequential Commit Loops + Orphan Tolerance (TR-01, TR-05, TR-06)
- [x] Phase 39: Cascade Ghost Record (TR-03)
- [x] Phase 40: Update State-Before-Commit Reorder (TR-04)
- [x] Phase 41: Documentation and Test Closeout (TR-07, TR-08)

</details>

<details>
<summary>Done v1.8 Plugin and Marketplace Info Commands (Phases 42-44) -- SHIPPED 2026-06-04</summary>

Two new read-only detail-surface commands (`/claude:plugin marketplace info <name>` and `/claude:plugin info <plugin>@<marketplace>`) picking up the PRD-deferred `info` subcommand. Both work on uninstalled, installed, and unavailable targets, support `--scope user|project` filtering, render per-scope when no scope is given, read existing local data only (preserves NFR-5), and lock byte-form via the catalog UAT. 1459/1459 tests GREEN at close; 8/8 INFO requirements satisfied; full audit at `.planning/milestones/v1.8-MILESTONE-AUDIT.md`.

- [x] Phase 42: Type Model & Render Seam Foundations (1/1 plans) -- completed 2026-06-03
- [x] Phase 43: Marketplace Info Command (2/2 plans) -- completed 2026-06-04
- [x] Phase 44: Plugin Info Command (2/2 plans) -- completed 2026-06-04

</details>

## Phase Details

<details>
<summary>Done v1.12 Marketplace and Plugin Config Files (Phases 51-56) -- SHIPPED 2026-06-11</summary>

Declarative per-scope config files (`claude-plugins.json` + entry-level-override `claude-plugins.local.json`) became the authoritative desired-state record: typebox-validated schema with discriminated absent/invalid/valid loading (an invalid file can never read as "uninstall everything"), lossless first-run migration from state.json, a pure 7-bucket reconcile planner behind a read-only `/claude:plugin preview` command (six `will *` tokens), offline enable/disable with a distinct `(disabled)` token, automatic load-time reconciliation on every startup/`/reload` (per-entry network soft-fail, one structured cascade, fixed-point convergence, two-process safe), and config write-back on every mutating command with `--local` targeting. See `.planning/milestones/v1.12-ROADMAP.md` for full details.

- [x] Phase 51: Config Schema, Persistence & State Split (3/3 plans) -- CFG-01..03, SPLIT-01..02 -- completed 2026-06-10
- [x] Phase 52: First-Run Migration (1/1 plans) -- MIG-01..02 -- completed 2026-06-10
- [x] Phase 53: Pure Reconcile Planner & Dry-Run Preview (2/2 plans) -- DIFF-01..02 -- completed 2026-06-10
- [x] Phase 54: Enable/Disable Commands (2/2 plans) -- ENBL-01..04 -- completed 2026-06-10
- [x] Phase 55: Load-Time Reconcile Apply, Notification & Wiring (3/3 plans) -- RECON-01..06 -- completed 2026-06-11
- [x] Phase 56: Write-Back Integration & Documentation (4/4 plans) -- WB-01..04, CFG-04 -- completed 2026-06-11

</details>

## Progress

| Phase                                                                | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1-7. (v1.0 successor architecture)                                   | v1.0      | --             | Complete    | 2026-05-11 |
| 8. Atomic Reinstall Core                                             | v1.1      | 4/4            | Complete    | 2026-05-13 |
| 9. Reinstall Edge & Bulk UX                                          | v1.1      | 4/4            | Complete    | 2026-05-14 |
| 10. Claude Settings Import Foundation                                | v1.2      | --             | Complete    | 2026-05-19 |
| 11. Import Command Orchestration                                     | v1.2      | --             | Complete    | 2026-05-20 |
| 12. Messaging Foundations & Renderer                                 | v1.3      | 4/4            | Complete    | 2026-05-22 |
| 13. Conformance Refactor & ES-5                                      | v1.3      | 10/10          | Complete    | 2026-05-24 |
| 14. Drift Guard & Test Alignment                                     | v1.3      | 6/6            | Complete    | 2026-05-24 |
| 14.1. CMC-13 import propagation closure                              | v1.3      | 2/2            | Complete    | 2026-05-24 |
| 14.2. CR-01 + retroactive Phase 12/14.1 gates                        | v1.3      | 5/5            | Complete    | 2026-05-24 |
| 15. Type Model & ADR Refresh                                         | v1.4      | 3/3            | Complete    | 2026-05-25 |
| 16. Renderer & Public API (Alongside V1)                             | v1.4      | 6/6            | Complete    | 2026-05-26 |
| 17. Spec Rewrite & Catalog UAT Migration                             | v1.4      | 3/3            | Complete    | 2026-05-26 |
| 17.1. V2 Grammar Amendment: Autoupdate Surface (INSERTED)            | v1.4      | 4/4            | Complete    | 2026-05-26 |
| 17.2. renderScopeBracket orphan-fold contract fix (INSERTED)         | v1.4      | 4/4            | Complete    | 2026-05-26 |
| 18. Migration Wave 1 -- Marketplace Orchestrator Family              | v1.4      | 7/7            | Complete    | 2026-05-27 |
| 19. Migration Wave 2 -- Plugin Orchestrator Family                   | v1.4      | 6/6            | Complete    | 2026-05-27 |
| 20. Migration Wave 3 -- Edge Handlers & UsageError                   | v1.4      | 6/6            | Complete    | 2026-05-27 |
| 21. Final Teardown & GREEN Gate                                      | v1.4      | 4/4            | Complete    | 2026-05-28 |
| 22. Reload-hint Discipline Family                                    | v1.4.1    | 1/1 | Complete    | 2026-05-29 |
| 23. Version Display Bundle                                           | v1.4.1    | 2/2 | Complete    | 2026-05-29 |
| 24. Grammar Consistency                                              | v1.4.1    | 1/1 | Complete    | 2026-05-29 |
| 25. Runtime Publish & Verification                                   | v1.4.1    | 3/3 | Complete    | 2026-05-29 |
| 26. GREEN Gate Close                                                 | v1.4.1    | 1/1 | Complete    | 2026-05-30 |
| 27. Marketplace & Autoupdate Output Grammar                          | v1.5      | 5/5 | Complete    | 2026-05-31 |
| 28. Severity Routing & Label Discipline                              | v1.5      | 2/2 | Complete    | 2026-05-31 |
| 29. Notification Label Suppression & Update Classification          | v1.5      | 3/3 | Complete    | 2026-05-31 |
| 30. Duplicate Type Fix                                               | v1.6      | 1/1 | Complete    | 2026-06-01 |
| 31. Credential Subprocess Layer                                      | v1.6      | 2/2 | Complete   | 2026-06-01 |
| 32. Device Flow State Machine                                        | v1.6      | 1/2 | Complete    | 2026-06-01 |
| 33. git.ts Auth Wiring                                               | v1.6      | 1/1 | Complete   | 2026-06-01 |
| 34. GitOps Interface Threading                                       | v1.6      | 1/1 | Complete    | 2026-06-01 |
| 35. Orchestrator Call Sites & Output Catalog                         | v1.6      | 4/4 | Complete    | 2026-06-01 |
| 36. Integration Gate                                                 | v1.6      | 1/1 | Complete   | 2026-06-01 |
| 37. Phase-Ledger Undo Gap                                            | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 38. Sequential Commit Loops + Orphan Tolerance                       | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 39. Cascade Ghost Record                                             | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 40. Update State-Before-Commit Reorder                               | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 41. Documentation and Test Closeout                                  | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 42. Type Model & Render Seam Foundations                             | v1.8      | 1/1 | Complete    | 2026-06-03 |
| 43. Marketplace Info Command                                         | v1.8      | 2/2 | Complete    | 2026-06-04 |
| 44. Plugin Info Command                                              | v1.8      | 2/2 | Complete    | 2026-06-04 |
| 45. Manifest In-Memory Cache                                        | v1.9      | 2/2 | Complete    | 2026-06-07 |
| 46. Type-Model Foundations                                          | v1.10     | 1/1 | Complete    | 2026-06-07 |
| 47. Plugin-Ops Attribution & Cross-Scope                            | v1.10     | 3/3 | Complete    | 2026-06-07 |
| 48. Marketplace-Ops Attribution                                     | v1.10     | 3/3 | Complete    | 2026-06-08 |
| 49. Cross-Op Convergence & GREEN-Gate Close                         | v1.10     | 3/3 | Complete    | 2026-06-08 |
| 50. Notification Summary-Line Grammar                               | v1.11     | 1/1 | Complete    | 2026-06-08 |
| 51. Config Schema, Persistence & State Split                        | v1.12     | 3/3 | Complete    | 2026-06-10 |
| 52. First-Run Migration                                             | v1.12     | 1/1 | Complete    | 2026-06-10 |
| 53. Pure Reconcile Planner & Dry-Run Preview                        | v1.12     | 2/2 | Complete    | 2026-06-10 |
| 54. Enable/Disable Commands                                         | v1.12     | 2/2 | Complete    | 2026-06-10 |
| 55. Load-Time Reconcile Apply, Notification & Wiring                | v1.12     | 3/3 | Complete    | 2026-06-11 |
| 56. Write-Back Integration & Documentation                          | v1.12     | 4/4 | Complete    | 2026-06-11 |
