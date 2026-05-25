# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **v1.0 successor architecture** -- Phases 1-7 (shipped 2026-05-11)
- ✅ **v1.1 Reinstall Command** -- Phases 8-9 (shipped 2026-05-14)
- ✅ **v1.2 Claude Settings Import** -- Phases 10-11 (shipped 2026-05-20)
- ✅ **v1.3 Consistent Messaging** -- Phases 12-14.2 (shipped 2026-05-25)
- 📋 **v1.4 (next)** -- to be defined via `/gsd:new-milestone`

For full details of each milestone, see `.planning/milestones/v[X.Y]-ROADMAP.md` and `.planning/milestones/v[X.Y]-REQUIREMENTS.md`.

## Phases

<details>
<summary>✅ v1.0 successor architecture (Phases 1-7) -- SHIPPED 2026-05-11</summary>

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
<summary>✅ v1.1 Reinstall Command (Phases 8-9) -- SHIPPED 2026-05-14</summary>

`reinstall` command with atomic per-plugin replacement, cached-manifest reuse, no network sync, bulk-cascade partitioning, reload-hint + soft-dep aggregation, installed-only tab completion plus reinstall-specific `--force`.

- [x] Phase 8: Atomic Reinstall Core (4/4 plans) -- completed 2026-05-13
- [x] Phase 9: Reinstall Edge & Bulk UX (4/4 plans) -- completed 2026-05-14

</details>

<details>
<summary>✅ v1.2 Claude Settings Import (Phases 10-11) -- SHIPPED 2026-05-20</summary>

`/claude:plugin import [--scope user|project]` with Claude settings discovery, base/override merge, enabled-plugin extraction, official + extraKnownMarketplaces source mapping, idempotent orchestration, unavailable-plugin warning aggregation, source-mismatch protection.

- [x] Phase 10: Claude Settings Import Foundation -- completed 2026-05-19
- [x] Phase 11: Import Command Orchestration -- completed 2026-05-20

</details>

<details>
<summary>✅ v1.3 Consistent Messaging (Phases 12-14.2) -- SHIPPED 2026-05-25</summary>

Closed-set grammar primitives, Wave 1 presentation composers, ES-5 atomic supersession, per-command catalog conformance via byte-equality UAT runner, 34-rule ESLint drift-guard plugin. v1.3 user-contract is structurally enforced. 38/38 CMC requirements satisfied. See `.planning/milestones/v1.3-ROADMAP.md` for full details.

- [x] Phase 12: Messaging Foundations & Renderer Primitives (4/4 plans) -- completed 2026-05-22
- [x] Phase 13: Conformance Refactor & ES-5 Supersession (10/10 plans) -- completed 2026-05-24
- [x] Phase 14: Drift Guard & Test Alignment (6/6 plans) -- completed 2026-05-24
- [x] Phase 14.1: Close gap: CMC-13 propagate declaresAgents/Mcp through import (2/2 plans) -- completed 2026-05-24
- [x] Phase 14.2: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (5/5 plans) -- completed 2026-05-24

</details>

### 📋 v1.4 (next milestone)

Run `/gsd:new-milestone` to define scope for the next milestone.

## Progress

| Phase                                         | Milestone | Plans Complete | Status   | Completed  |
| --------------------------------------------- | --------- | -------------- | -------- | ---------- |
| 1-7. (v1.0 successor architecture)            | v1.0      | --              | Complete | 2026-05-11 |
| 8. Atomic Reinstall Core                      | v1.1      | 4/4            | Complete | 2026-05-13 |
| 9. Reinstall Edge & Bulk UX                   | v1.1      | 4/4            | Complete | 2026-05-14 |
| 10. Claude Settings Import Foundation         | v1.2      | --              | Complete | 2026-05-19 |
| 11. Import Command Orchestration              | v1.2      | --              | Complete | 2026-05-20 |
| 12. Messaging Foundations & Renderer          | v1.3      | 4/4            | Complete | 2026-05-22 |
| 13. Conformance Refactor & ES-5               | v1.3      | 10/10          | Complete | 2026-05-24 |
| 14. Drift Guard & Test Alignment              | v1.3      | 6/6            | Complete | 2026-05-24 |
| 14.1. CMC-13 import propagation closure       | v1.3      | 2/2            | Complete | 2026-05-24 |
| 14.2. CR-01 + retroactive Phase 12/14.1 gates | v1.3      | 5/5            | Complete | 2026-05-24 |
