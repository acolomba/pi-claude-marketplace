---
phase: "02"
slug: "adapter-file-delivery"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-02"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (Node v26) |
| **Config file** | none — scripts in `package.json` (`test`, `test:modules`, `test:architecture`, `test:integration`, `test:coverage:direct`) |
| **Quick run command** | `node --test tests/bridges/mcp/*.test.ts tests/persistence/locations.test.ts tests/orchestrators/plugin/prune-rollback.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~4 seconds; full ~20-30 minutes |

---

## Sampling Rate

- **After every task commit:** Run the owner test files with `node --test` (pre-commit runs `check:changed` and selected direct coverage)
- **After every plan wave:** Run `npm run test:modules && npm run test:architecture`
- **Before `/gsd-verify-work`:** `npm run check` green; `npm run test:e2e` once
- **Max feedback latency:** 60 seconds for the quick command

---

## Per-Task Verification Map

Filled by the planner from the eight plans' `<verify>` blocks. Each orchestrator command filters with `--test-name-pattern="^AFILE-0..."`, so a run that matched nothing reports `pass 0` and fails its `<fails_when>`. Coverage commands enforce 100% direct line/branch/function coverage per source-test pair.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AFILE-01, AFILE-02, AFILE-03 | T-02-01, T-02-02, T-02-03, T-02-04 | Unparseable file refused, bytes unchanged; no parser text in any error; no key added beside `mcp-servers`; `__proto__` names kept own | unit + orchestrator | `npm run typecheck && node --test tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts tests/persistence/locations.test.ts tests/shared/errors-bridges.test.ts && node --test --test-name-pattern="^AFILE-0" tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/uninstall.test.ts && npm run test:coverage:direct -- <the five modules>` | ❌ W0 (adapter-doc.test.ts created in this task) | ⬜ pending |
| 02-01-02 | 01 | 1 | AFILE-01 | T-02-05 | Prune rollback snapshots and restores `mcp-adapter.json` | unit + architecture + e2e | `npm run typecheck && npm run test:modules && npm run test:architecture && node --test tests/e2e/install-soft-deps.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts` | ✅ retarget | ⬜ pending |
| 02-01-03 | 01 | 1 | AFILE-01 | T-02-SC | NFR-10 write set names the file; full pre-commit (package.json) | gate | `npm run lint:type-members && tail -n 1 tmp/p2-01-precommit.log && git show --stat --format=%s HEAD` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | AFILE-05 | T-02-07, T-02-23 | Every other full definition refuses and names the winning source; the plugin's own marked entries never collide, in any source (D-02-17) | unit + orchestrator | `npm run typecheck && node --test tests/bridges/mcp/collision-slots.test.ts tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/stage.test.ts tests/shared/errors-bridges.test.ts && node --test --test-name-pattern="^AFILE-05" tests/orchestrators/plugin/install-flow.test.ts && npm run test:coverage:direct -- <four modules>` | ✅ rewrite | ⬜ pending |
| 02-02-02 | 02 | 2 | AFILE-05 | T-02-08, T-02-23 | Ancestor discovery only on a user-global opt-in; the plugin's own entry in an ancestor file never collides (D-02-17) | unit (hermetic HOME) | `node --test tests/bridges/mcp/collision-ancestors.test.ts tests/bridges/mcp/collision-slots.test.ts tests/bridges/mcp/stage.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts` | ❌ W0 (collision-ancestors.test.ts created in this task) | ⬜ pending |
| 02-02-03 | 02 | 2 | AFILE-01, AFILE-05 | T-02-10 | Legacy sweep marker-keyed and fail-clean | unit + orchestrator + gate | `node --test tests/bridges/mcp/unstage.test.ts && node --test --test-name-pattern="^AFILE-01" tests/orchestrators/plugin/uninstall.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/unstage.ts && npm run lint:type-members && tail -n 1 tmp/p2-02-precommit.log` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 3 | AFILE-06 | T-02-11 | Closed carried set; disabled survives update | unit + orchestrator | `npm run typecheck && node --test tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts && node --test --test-name-pattern="^AFILE-06" tests/orchestrators/plugin/update-flow.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts extensions/pi-claude-marketplace/bridges/mcp/stage.ts` | ❌ W0 (adapter-entry.test.ts created in this task) | ⬜ pending |
| 02-03-02 | 03 | 3 | AFILE-06 | T-02-11 | 34-key pin; credentials never carried; reinstall keeps disable | unit + orchestrator + gate | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts && node --test --test-name-pattern="^AFILE-06" tests/orchestrators/plugin/reinstall-flow.test.ts && npm run test:coverage:direct -- <two modules> && npm run lint:type-members && tail -n 1 tmp/p2-03-precommit.log` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 4 | AFILE-04 | T-02-14 | Notice names scope and basename only | unit + orchestrator | `npm run typecheck && node --test tests/shared/notification-dispatch.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/types.test.ts tests/architecture/integration-materialization-gate.test.ts tests/orchestrators/plugin/install-outcome.test.ts && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/install-flow.test.ts && npm run test:coverage:direct -- <three modules>` | ✅ | ⬜ pending |
| 02-04-02 | 04 | 4 | AFILE-04, AFILE-02 | T-02-15, T-02-16 | Failed install restores exact bytes; unreadable file left alone and reported; catalog byte lock | unit + architecture + orchestrator | `node --test tests/orchestrators/plugin/install-outcome.test.ts tests/bridges/mcp/stage.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/mcp-config-notices.test.ts && node --test --test-name-pattern="^AFILE-0[24]" tests/orchestrators/plugin/install-flow.test.ts && npm run test:coverage:direct -- <two modules>` | ❌ W0 (mcp-config-notices.test.ts and catalog-block.ts created in this task) | ⬜ pending |
| 02-04-03 | 04 | 4 | AFILE-04 | — | Cascade, promotion, member failure and orchestrated outcomes carry notices | unit + orchestrator + gate | `npm run typecheck && node --test tests/orchestrators/plugin/install-cascade.test.ts && node --test --test-name-pattern="^AFILE-0" tests/orchestrators/plugin/install-flow.test.ts && npm run test:coverage:direct -- <two modules> && npm run lint:type-members && tail -n 1 tmp/p2-04-precommit.log` | ✅ | ⬜ pending |
| 02-05-01 | 05 | 5 | AFILE-04 | T-02-17 | Direct update shows the notice after its cascade | unit + orchestrator | `npm run typecheck && node --test tests/orchestrators/plugin/update-swap.test.ts && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/update-flow.test.ts && npm run test:coverage:direct -- <two modules>` | ✅ | ⬜ pending |
| 02-05-02 | 05 | 5 | AFILE-04 | T-02-17 | Reinstall shows the notice; rollback restores comments | unit + orchestrator | `npm run typecheck && node --test tests/orchestrators/plugin/reinstall-replace.test.ts && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/reinstall-flow.test.ts && npm run test:coverage:direct -- <two modules>` | ✅ | ⬜ pending |
| 02-05-03 | 05 | 5 | AFILE-04, AFILE-02 | T-02-17 | Post-commit failures and cascade entry carry the notice | unit + orchestrator + gate | `node --test tests/orchestrators/plugin/update-swap.test.ts && node --test --test-name-pattern="^AFILE-0[24]" tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts && npm run test:coverage:direct -- <two modules> && npm run lint:type-members && tail -n 1 tmp/p2-05-precommit.log` | ✅ | ⬜ pending |
| 02-06-01 | 06 | 6 | AFILE-04 | T-02-18 | Unstage reports per file; cascade carries both arms; uninstall shows it | unit + orchestrator | `npm run typecheck && node --test tests/bridges/mcp/unstage.test.ts tests/bridges/mcp/types.test.ts tests/orchestrators/marketplace/shared.test.ts && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/uninstall.test.ts && npm run test:coverage:direct -- <three modules>` | ✅ | ⬜ pending |
| 02-06-02 | 06 | 6 | AFILE-04 | T-02-18 | Prune shows the notice, dry run silent | orchestrator | `node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/prune.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts` | ✅ | ⬜ pending |
| 02-06-03 | 06 | 6 | AFILE-04 | T-02-18, T-02-19 | Marketplace remove shows and returns the notice | orchestrator + gate | `node --test --test-name-pattern="^AFILE-04" tests/orchestrators/marketplace/remove.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts && npm run lint:type-members && tail -n 1 tmp/p2-06-precommit.log` | ✅ | ⬜ pending |
| 02-07-01 | 07 | 7 | AFILE-04 | T-02-20 | Disable shows and returns the notice | orchestrator | `npm run typecheck && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/enable-disable.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | ✅ | ⬜ pending |
| 02-07-02 | 07 | 7 | AFILE-04, AFILE-02 | T-02-20 | Enable, cascade members and undo carry the notice | orchestrator | `node --test --test-name-pattern="^AFILE-0[24]" tests/orchestrators/plugin/enable-disable.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | ✅ | ⬜ pending |
| 02-07-03 | 07 | 7 | AFILE-04 | T-02-20 | Install-cascade undo and landed-disabled install carry the notice | unit + orchestrator + gate | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-disable-cascade.test.ts && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/plugin/install-flow.test.ts && npm run test:coverage:direct -- <three modules> && npm run lint:type-members && tail -n 1 tmp/p2-07-precommit.log` | ✅ | ⬜ pending |
| 02-08-01 | 08 | 8 | AFILE-04 | T-02-21 | Reload install shows the notice after the cascade; empty reload silent | unit + orchestrator | `npm run typecheck && node --test tests/orchestrators/reconcile/apply-outcomes.test.ts && node --test --test-name-pattern="^AFILE-04" tests/orchestrators/reconcile/apply.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | ✅ | ⬜ pending |
| 02-08-02 | 08 | 8 | AFILE-04 | T-02-21, T-02-22 | Every reconcile bucket and backfill feed one de-duplicated notice | orchestrator | `node --test --test-name-pattern="^AFILE-04" tests/orchestrators/reconcile/apply.test.ts && node --test tests/orchestrators/reconcile/backfill.test.ts && npm run test:coverage:direct -- <two modules>` | ✅ | ⬜ pending |
| 02-08-03 | 08 | 8 | AFILE-04 | T-02-21 | Import and marketplace update show the notice | orchestrator + gate | `node --test --test-name-pattern="^AFILE-04" tests/orchestrators/import/execute.test.ts tests/orchestrators/marketplace/update.test.ts && npm run test:coverage:direct -- <two modules> && npm run lint:type-members && tail -n 1 tmp/p2-08-precommit.log` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Correction from planning: pi-mcp-adapter 5.0.0's `ServerEntry` (types.ts:438-525) has 34 members, not 35; the research list itself names 34. The AFILE-06 pin vendors 34 keys (9 carried, 2 extension-owned, 23 from the plugin entry).

Plan 02-01 stays one plan and one commit, because the move to `mcp-adapter.json` and the test retarget cannot land green apart. Its Task 2 retarget is scripted from a measured inventory, the same `test:modules` and `test:architecture` runs verify it (row 02-01-02), and its SUMMARY records a cost checkpoint after Tasks 1 and 2.

---

## Wave 0 Requirements

Each scaffold is created inside the task whose `<verify>` first runs it (task-level TDD), so no task references a test file that does not exist yet.

- [ ] `npm install strip-json-comments@^5.0.3` (lockfile committed, D-02-08) — 02-01 Task 1
- [ ] `tests/bridges/mcp/adapter-doc.test.ts` — AFILE-02/03 parsing, differential grammar check, key selection — 02-01 Task 1
- [ ] `tests/bridges/mcp/collision-ancestors.test.ts` — AFILE-05 ancestor rules — 02-02 Task 2
- [ ] `tests/bridges/mcp/adapter-entry.test.ts` — AFILE-06, vendored 34-key list with provenance comment — 02-03 Tasks 1-2
- [ ] `tests/architecture/catalog-block.ts` (shared reader) and `tests/architecture/mcp-config-notices.test.ts` (byte lock for both AFILE-04 catalog states; names no production path literal, D-07-05/D-07-06) — 02-04 Task 2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real pi-mcp-adapter 5 loads our entries from `mcp-adapter.json` after `/reload` | AFILE-01..06 | Needs a live Pi + adapter install; covered by Phase 7 live proof | Phase 7 live UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
