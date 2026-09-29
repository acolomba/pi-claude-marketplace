---
phase: "1"
slug: "presentation-model"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-28"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (Node 26 local, 24 CI) |
| **Config file** | none (npm scripts in `package.json`) |
| **Quick run command** | `node --test <touched test paths>`; pair coverage `npm run test:coverage:direct -- <path>` |
| **Full suite command** | `npm run check` |
| **Corpus re-diff** | the D-01 capture tool's `diff` command (name at planner's discretion; ~2 min; not part of `check`) |
| **Estimated runtime** | ~2 min quick per pair; `npm run check` several minutes; corpus re-diff ~2 min |

---

## Sampling Rate

- **After every task commit:** `node --test` on touched owner tests; `npm run test:coverage:direct -- <pair>`; `npm run lint`; `npm run typecheck`
- **After every plan:** `npm run check` (Prettier, then `lint:type-members`) plus the corpus re-diff (research recommends per plan; D-03 requires it at phase end)
- **Before `/gsd-verify-work`:** full `npm run check` green, corpus re-diff empty, `docs/output-catalog.md` git diff empty
- **Max feedback latency:** ~120 seconds per task

---

## Per-Task Verification Map

Filled in by the planner (task IDs are assigned by the plans). Requirement-level map from research:

| Req / SC | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| SC-1 (PMOD-01/03 bytes) | Corpus re-diff empty; catalog diff empty; byte/state counts unchanged | tooling + architecture | corpus `diff`; `git diff --exit-code <phase-base> -- docs/output-catalog.md`; `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | ❌ W0 (tool) / ✅ catalog | ⬜ pending |
| SC-1 non-vacuity | Planted drift fails and names the file; count floor refuses | negative script | the tool's `*.negative.mjs` | ❌ W0 | ⬜ pending |
| SC-2 (PMOD-01) | One resolve step; content reasons then markers; dispatch has no `softDepStatus`; text renderer takes no probe | unit + scan | `node --test tests/shared/notification-resolve.test.ts`; `rg` scans of dispatch and grammar | ❌ W0 | ⬜ pending |
| SC-3 (PMOD-01) | One probe per run feeds severity and markers | unit | two-answer probe case (stateful `getAllTools`) | ❌ W0 | ⬜ pending |
| SC-4 (PMOD-03) | No live `Error` in rendering; cause-chain bytes unchanged | type proof + scan + corpus | `@ts-expect-error` proof; `rg` scan of grammar imports; corpus diff | ❌ W0 | ⬜ pending |
| SC-5 | Per-verb marker table as data; `workflows-marker-coverage` scans the new derivation site | architecture | `node --test` marker-policy test + `tests/architecture/workflows-marker-coverage.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task-level map (every plan from 01-02 on also runs `node scripts/notify-corpus.mjs check` and ends with an unpiped `npm run check`):

| Task ID | Wave | Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|---------|------|------------------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 1 | D-01 | tooling tracer | `node scripts/notify-corpus.mjs capture --out <tmp> --files tests/edge/handlers/plugin/help.test.ts` then `diff` against itself | ❌ W0 | ⬜ pending |
| 01-01-T2 | 1 | D-02, D-04 | negative script | `node scripts/notify-corpus.negative.mjs` | ❌ W0 | ⬜ pending |
| 01-01-T3 | 1 | D-03 | tooling | `node scripts/notify-corpus.mjs check` (self-diff both directions before commit) | ❌ W0 | ⬜ pending |
| 01-02-T1 | 2 | PMOD-01, D-09, D-10 | unit | `node --test tests/shared/notification-resolve.test.ts ...`; `npm run test:coverage:direct -- <pair>` | ❌ W0 | ⬜ pending |
| 01-02-T2 | 2 | PMOD-01, D-10 | unit + architecture | `node --test ... tests/architecture/notify-will-reload-agreement.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ⬜ pending |
| 01-03-T1 | 3 | PMOD-03, D-11, SC-4 | unit + type proof | `node --test tests/shared/errors.test.ts tests/shared/notification-resolve.test.ts ...`; grammar import scan | ✅ | ⬜ pending |
| 01-03-T2 | 3 | PMOD-01, D-10 | unit | `node --test tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts ...` | ✅ | ⬜ pending |
| 01-04-T1 | 4 | PMOD-01, D-12, D-13 | unit | `node --test ... "tests/orchestrators/**/*.messaging.test.ts"` | ✅ | ⬜ pending |
| 01-04-T2 | 4 | SC-5, D-12 | architecture | `node --test tests/architecture/soft-dep-marker-policy.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-T1 | 5 | PMOD-01, D-13, SC-2 | unit + scan | `node --test ...`; `! rg -n "SoftDepStatus\|softDepMarkers" .../notification-grammar.ts` | ✅ | ⬜ pending |
| 01-05-T2 | 5 | SC-5, D-12 | architecture + planted control | `node --test tests/architecture/workflows-marker-coverage.test.ts tests/architecture/gate-targets.test.ts` | ✅ (new case) | ⬜ pending |
| 01-06-T1 | 6 | D-05, D-06, D-07 | unit tracer | `node --test tests/shared/notification-run.test.ts tests/edge/router.test.ts tests/edge/register.test.ts ...` | ❌ W0 | ⬜ pending |
| 01-06-T2 | 6 | D-05 | unit | `node --test tests/edge/handlers/marketplace/info.test.ts tests/orchestrators/marketplace/info.test.ts ...` | ✅ | ⬜ pending |
| 01-07-T1 | 7 | D-05, D-07 | unit + integration tracer | `node --test tests/index.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/types.test.ts ...`; `npm run test:integration` | ✅ | ⬜ pending |
| 01-07-T2 | 7 | D-05 | unit | `node --test tests/orchestrators/reconcile/pending.test.ts tests/edge/handlers/plugin/shared.test.ts tests/edge/handlers/plugin/pending.test.ts ...` | ✅ | ⬜ pending |
| 01-08-T1 | 8 | D-05 | unit | `node --test tests/orchestrators/import/execute.test.ts ...` | ✅ | ⬜ pending |
| 01-08-T2 | 8 | D-07 | unit + integration | `node --test tests/orchestrators/marketplace/{shared,remove,update}.test.ts ...` | ✅ | ⬜ pending |
| 01-09-T1 | 9 | D-07 | unit + integration | `node --test tests/orchestrators/marketplace/add.test.ts ...`; `npm run test:integration` | ✅ | ⬜ pending |
| 01-09-T2 | 9 | D-05 | unit | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/plugin/bootstrap.test.ts ...` | ✅ | ⬜ pending |
| 01-10-T1 | 10 | D-05, D-07 | unit + integration | `node --test tests/orchestrators/plugin/install-flow.test.ts ...`; `npm run test:integration` | ✅ | ⬜ pending |
| 01-10-T2 | 10 | SC-3, D-08 | two-answer probe case | `node --test --test-name-pattern="SC-3" tests/edge/register.test.ts` | ❌ W0 (new case) | ⬜ pending |
| 01-11-T1 | 11 | D-05, D-07 | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts ...` | ✅ | ⬜ pending |
| 01-11-T2 | 11 | D-07 | unit + integration | `node --test tests/orchestrators/plugin/uninstall.test.ts ...`; `npm run test:integration` | ✅ | ⬜ pending |
| 01-12-T1 | 12 | D-07 | unit | `node --test tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/reconcile/backfill.test.ts ...` | ✅ | ⬜ pending |
| 01-12-T2 | 12 | D-05, D-07 | unit + integration | `node --test tests/orchestrators/reconcile/apply.test.ts tests/index.test.ts ...`; `npm run test:integration` | ✅ | ⬜ pending |
| 01-13-T1 | 13 | D-05 | unit + integration + scan | `node --test tests/orchestrators/plugin/update-*.test.ts ...`; orchestrator `softDepStatus(` code scan | ✅ | ⬜ pending |
| 01-13-T2 | 13 | D-05 | unit | `node --test tests/orchestrators/plugin/fetch.test.ts tests/edge/handlers/plugin/fetch.test.ts ...` | ✅ | ⬜ pending |
| 01-14-T1 | 14 | D-05 | unit + integration | `node --test tests/orchestrators/plugin/list-flow.test.ts tests/edge/handlers/tools.test.ts ...` | ✅ | ⬜ pending |
| 01-14-T2 | 14 | D-05 | unit + scan | `node --test tests/orchestrators/plugin/info.test.ts ...`; handler/orchestrator `pi` parameter scan | ✅ | ⬜ pending |
| 01-15-T1 | 15 | D-05 | unit sweep + scan | `node --test $(rg -l "createNotificationBoundary\(" tests --glob "*.test.ts")`; `rg -n "toolProbes" tests` prints nothing | ✅ | ⬜ pending |
| 01-15-T2 | 15 | D-05 (Pitfall I) | unit + scan | `node --test tests/index.test.ts tests/edge/register.test.ts ...`; boundary Pi-mock scan | ✅ | ⬜ pending |
| 01-16-T1 | 16 | SC-2, D-06 | unit + architecture + scan | `node --test tests/shared/notification-dispatch.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts ...`; dispatch scan | ✅ | ⬜ pending |
| 01-16-T2 | 16 | SC-1..SC-5, D-03 | phase gate | `npm run check`; `node scripts/notify-corpus.mjs check`; `git diff --exit-code 2f173031 -- docs/output-catalog.md`; root-construction, prose, and boundary scans | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Capture tool, loader hook, and `*.negative.mjs` companion under `scripts/` (SC-1)
- [ ] Baseline `.jsonl` (ASCII-escaped) plus meta (Node version, date, counts) under `.planning/phases/01-presentation-model/`
- [ ] `tests/shared/notification-resolve.test.ts` owner (100% direct)
- [ ] Owner test for the per-invocation run constructor
- [ ] SC-5 marker-policy architecture test
- [ ] New `workflows-marker-coverage` case with a planted control
- [ ] SC-3 two-answer probe case

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baseline holds no local paths or secrets | SC-1 | TruffleHog is skipped in worktree commits | Run trufflehog on the baseline files and review the normalizer output before committing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
