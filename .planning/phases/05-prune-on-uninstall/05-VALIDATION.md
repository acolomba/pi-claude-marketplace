---
phase: "5"
slug: "prune-on-uninstall"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-16"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 26 local / 24 CI), `node:assert/strict` |
| **Config file** | none — npm scripts in `package.json` |
| **Quick run command** | `node --test tests/orchestrators/plugin/uninstall.test.ts` (add `--test-name-pattern "D-05-"` for the new cases) |
| **Full suite command** | `npm run check` (typecheck, lint, fallow, format:check, test:corresponding, test:coverage:direct:negative, test, test:integration) |
| **Estimated runtime** | quick ≈ 20 s; full ≈ 5 min |

---

## Sampling Rate

- **After every task commit:** the owner suite named in that task's `<verify>` plus `npm run typecheck && npm run lint && npm run fallow && npm run test:coverage:direct:commit` (the pre-commit hooks' scripts, run by hand — no hook is installed in this checkout), then `SKIP=trufflehog pre-commit run --files <paths>`.
- **After every plan wave:** `npm run check`.
- **Before `/gsd-verify-work`:** `npm run check` exit 0 and `SKIP=trufflehog pre-commit run --all-files` exit 0 (Plan 03 Task 3).
- **Max feedback latency:** ≈ 20 s for the owner suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | PRUNE-05 (D-05-14, D-05-04, D-05-05, D-05-07) | T-05-03 / T-05-04 / T-05-05 | refusal throws inside the lock before any artifact leaves disk; cause lines carry keys and redacted text only; no path joined in `uninstall.ts` | unit (owner + two new pairs) | `node --test --test-name-pattern "D-05-14" tests/orchestrators/plugin/uninstall.test.ts`; `node --test tests/orchestrators/plugin/dependency-index.test.ts tests/domain/dependency-orphans.test.ts` | ✅ owner suite; ❌ W0 the two new pairs | ⬜ pending |
| 5-01-01 | 01 | 1 | PRUNE-05 (closed-set member, 3 vocabulary pins; NFR-5 gate pin) | T-05-05 | `uninstall.ts` + `dependency-index.ts` name no git surface | architecture | `node --test tests/shared/notification-types.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/manifest-read-agreement.test.ts tests/architecture/unowned-exports-census.test.ts` | ✅ | ⬜ pending |
| 5-01-02 | 01 | 1 | PRUNE-05 (D-05-15 bytes; catalog states `refused-dependents-remain`, `refused-declarer-unreadable`) | T-05-04 | N/A | catalog contract | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | ✅ suites; ❌ W0 fixtures | ⬜ pending |
| 5-01-03 | 01 | 1 | PRUNE-05 (D-05-16 reconcile refusal + cause) | T-05-04 | cause spread only for `UninstallRefusedError`; RECON-03 rows unchanged | unit (reconcile) + catalog | `node --test --test-name-pattern "D-05-16" tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/notify.test.ts` | ✅ suites; ❌ W0 cases | ⬜ pending |
| 5-02-01 | 02 | 2 | FLAG-01 (D-05-10) | T-05-12 | `--prune` name owned by the catalog; `-y`/`--yes`/`--delete-data` still rejected | architecture + edge | `node --test tests/architecture/flag-catalog-drift.test.ts tests/edge/flag-catalog.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/router.test.ts tests/edge/handlers/shared.test.ts` | ✅ (pins must move) | ⬜ pending |
| 5-02-02 | 02 | 2 | PRUNE-01, PRUNE-02, PRUNE-03 (D-05-01, D-05-02 — pure fixpoint) | T-05-07 | provenance filter before any declaration is consulted | unit (domain) | `node --test tests/domain/dependency-orphans.test.ts` | ❌ W0 (created in 5-01-01, extended here) | ⬜ pending |
| 5-02-03 | 02 | 2 | PRUNE-01..04 (D-05-03, D-05-09, D-05-12, D-05-13), NFR-3 | T-05-09 / T-05-10 | member body total, one save, ghost-record guard (AG-5 on member #2); paths via `ScopedLocations` only | unit (owner + messaging) + catalog | `node --test --test-name-pattern "D-05-01\|D-05-02\|D-05-03\|D-05-09\|D-05-12\|D-05-13\|PRUNE-02\|PRUNE-03" tests/orchestrators/plugin/uninstall.test.ts`; `node --test tests/orchestrators/plugin/uninstall.messaging.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ suites; ❌ W0 cases + fixtures | ⬜ pending |
| 5-03-01 | 03 | 3 | FLAG-01 → PRUNE-01 (edge to sweep) | T-05-12 | the typed flag reaches the option the orchestrator reads | edge (end to end) | `node --test --test-name-pattern "D-05-10" tests/edge/handlers/plugin/uninstall.test.ts` | ✅ suite; ❌ W0 cases | ⬜ pending |
| 5-03-02 | 03 | 3 | PRUNE-04 / PRUNE-05 prose | T-05-13 / T-05-14 | no token row inside the gated failure table | architecture (doc gate) | `node --test tests/architecture/dependency-doc-agreement.test.ts` | ✅ | ⬜ pending |
| 5-03-03 | 03 | 3 | all | all | full gate | phase gate | `npm run check`; `SKIP=trufflehog pre-commit run --all-files` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/domain/dependency-orphans.test.ts` — pairs the new pure module (`findDependents` in 5-01-01; `pruneOrphans` cases in 5-02-02; the `test:corresponding` gate requires the pair to exist in the same commit as the module).
- [ ] `tests/orchestrators/plugin/dependency-index.test.ts` — pairs the new leaf; drives all four arms through the injected `loadManifest` / `reader` seams (5-01-01).
- [ ] A manifest-writing seed helper in `tests/orchestrators/plugin/uninstall.test.ts` (5-01-01) — writes `marketplace.json` + per-plugin `plugin.json` with declarations on both sides and records with chosen `provenance` / `enabled`; also repairs the shared-clone `seedGitPlugin` case, which seeds two records under a manifest path that does not exist.
- [ ] `PluginTree.dependencies` in `tests/orchestrators/reconcile/apply.test.ts` (5-01-03).
- [ ] Catalog fixtures: `refused-dependents-remain`, `refused-declarer-unreadable` (5-01-02); `reconcile-uninstall-refused-dependents` (5-01-03); `success-prune`, `success-prune-keep-data`, `prune-partial-failure` (5-02-03).
- [ ] Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The refusal row and the pruned row read sensibly in a live Pi session | PRUNE-04, PRUNE-05 | The catalog pins the bytes; whether they read well to a person is judgment | On a scratch scope: install a plugin that declares a dependency; `uninstall <dependency>@<mp>` → the row names the dependent; `uninstall <root>@<mp> --prune` → the `{dependency pruned}` row; `list` shows neither afterwards |
| Dev-tree provenance residue (04-06-SUMMARY item 1) | PRUNE-02 | Records written before the provenance field were back-filled as direct installs on the operator's own tree | Expect `--prune` to DECLINE those specific plugins; the remedy is to uninstall and reinstall them — this is not a prune defect |
| Two stale records block each other (Plan 01 A-2, D-05-07's cost) | PRUNE-05 | Needs two records in one scope both absent from their manifests; a decision point for the operator | Seed the scenario; observe the mutual `{not in manifest}` refusals naming each other; confirm `marketplace remove` clears it; decide whether D-05-07 stands or is relaxed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
