---
phase: "1"
slug: "presentation-model"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
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
| **Corpus re-diff** | `node scripts/notify-corpus.mjs check` (not part of `check`) |
| **Estimated runtime** | ~2 min quick per pair; `npm run check` several minutes; corpus re-diff ~2 min |

---

## Sampling Rate

- **After every task commit:** `node --test` on touched owner tests; `npm run test:coverage:direct -- <pair>`; `npm run lint`; `npm run typecheck`
- **After every plan:** `npm run check` (Prettier, then `lint:type-members`) plus the corpus re-diff (research recommends per plan; D-03 requires it at phase end)
- **Before `/gsd-verify-work`:** full `npm run check` green, corpus re-diff empty, `docs/output-catalog.md` git diff empty
- **Max feedback latency:** ~120 seconds per task

---

## Per-Task Verification Map

Audited on 2026-10-01 against all 16 plans and summaries, current test files, and the refreshed `01-VERIFICATION.md`.

| Req / SC | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| SC-1 (PMOD-01/03 bytes) | Corpus re-diff empty; catalog diff empty; byte/state counts unchanged | tooling + architecture | `node scripts/notify-corpus.mjs check`; `git diff --exit-code e40d3dda -- docs/output-catalog.md`; `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ✅ green |
| SC-1 non-vacuity | Planted drift fails and names the file; count floor refuses | negative script | `node scripts/notify-corpus.negative.mjs` | ✅ | ✅ green |
| SC-2 (PMOD-01) | One resolve step; content reasons then markers; dispatch has no `softDepStatus`; text renderer takes no probe | unit + scan | `node --test tests/shared/notification-resolve.test.ts`; `rg` scans of dispatch and grammar | ✅ | ✅ green |
| SC-3 (PMOD-01) | One probe per run feeds severity and markers | unit | two-answer probe case (stateful `getAllTools`) | ✅ | ✅ green |
| SC-4 (PMOD-03) | No live `Error` in rendering; cause-chain bytes unchanged | type proof + scan + corpus | `@ts-expect-error` proof; `rg` scan of grammar imports; corpus diff | ✅ | ✅ green |
| SC-5 | Per-verb marker table as data; `workflows-marker-coverage` scans the new derivation site | architecture | `node --test` marker-policy test + `tests/architecture/workflows-marker-coverage.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task-level map (every plan from 01-02 on also runs `node scripts/notify-corpus.mjs check` and ends with an unpiped `npm run check`):

| Task ID | Wave | Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|---------|------|------------------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 1 | D-01 | tooling tracer | `node scripts/notify-corpus.mjs capture --out <tmp> --files tests/edge/handlers/plugin/help.test.ts` then `diff` against itself | ✅ | ✅ green |
| 01-01-T2 | 1 | D-02, D-04 | negative script | `node scripts/notify-corpus.negative.mjs` | ✅ | ✅ green |
| 01-01-T3 | 1 | D-03 | tooling | `node scripts/notify-corpus.mjs check` (self-diff both directions before commit) | ✅ | ✅ green |
| 01-02-T1 | 2 | PMOD-01, D-09, D-10 | unit | `node --test tests/shared/notification-resolve.test.ts ...`; `npm run test:coverage:direct -- <pair>` | ✅ | ✅ green |
| 01-02-T2 | 2 | PMOD-01, D-10 | unit + architecture | `node --test ... tests/architecture/notify-will-reload-agreement.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ✅ green |
| 01-03-T1 | 3 | PMOD-03, D-11, SC-4 | unit + type proof | `node --test tests/shared/errors.test.ts tests/shared/notification-resolve.test.ts ...`; grammar import scan | ✅ | ✅ green |
| 01-03-T2 | 3 | PMOD-01, D-10 | unit | `node --test tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts ...` | ✅ | ✅ green |
| 01-04-T1 | 4 | PMOD-01, D-12, D-13 | unit | `node --test ... "tests/orchestrators/**/*.messaging.test.ts"` | ✅ | ✅ green |
| 01-04-T2 | 4 | SC-5, D-12 | architecture | `node --test tests/architecture/soft-dep-marker-policy.test.ts` | ✅ | ✅ green |
| 01-05-T1 | 5 | PMOD-01, D-13, SC-2 | unit + scan | `node --test ...`; `! rg -n "SoftDepStatus\|softDepMarkers" .../notification-grammar.ts` | ✅ | ✅ green |
| 01-05-T2 | 5 | SC-5, D-12 | architecture + planted control | `node --test tests/architecture/workflows-marker-coverage.test.ts tests/architecture/gate-targets.test.ts` | ✅ (new case) | ✅ green |
| 01-06-T1 | 6 | D-05, D-06, D-07 | unit tracer | `node --test tests/shared/notification-run.test.ts tests/edge/router.test.ts tests/edge/register.test.ts ...` | ✅ | ✅ green |
| 01-06-T2 | 6 | D-05 | unit | `node --test tests/edge/handlers/marketplace/info.test.ts tests/orchestrators/marketplace/info.test.ts ...` | ✅ | ✅ green |
| 01-07-T1 | 7 | D-05, D-07 | unit + integration tracer | `node --test tests/index.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/types.test.ts ...`; `npm run test:integration` | ✅ | ✅ green |
| 01-07-T2 | 7 | D-05 | unit | `node --test tests/orchestrators/reconcile/pending.test.ts tests/edge/handlers/plugin/shared.test.ts tests/edge/handlers/plugin/pending.test.ts ...` | ✅ | ✅ green |
| 01-08-T1 | 8 | D-05 | unit | `node --test tests/orchestrators/import/execute.test.ts ...` | ✅ | ✅ green |
| 01-08-T2 | 8 | D-07 | unit + integration | `node --test tests/orchestrators/marketplace/{shared,remove,update}.test.ts ...` | ✅ | ✅ green |
| 01-09-T1 | 9 | D-07 | unit + integration | `node --test tests/orchestrators/marketplace/add.test.ts ...`; `npm run test:integration` | ✅ | ✅ green |
| 01-09-T2 | 9 | D-05 | unit | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/plugin/bootstrap.test.ts ...` | ✅ | ✅ green |
| 01-10-T1 | 10 | D-05, D-07 | unit + integration | `node --test tests/orchestrators/plugin/install-flow.test.ts ...`; `npm run test:integration` | ✅ | ✅ green |
| 01-10-T2 | 10 | SC-3, D-08 | two-answer probe case | `node --test --test-name-pattern="SC-3" tests/edge/register.test.ts` | ✅ | ✅ green |
| 01-11-T1 | 11 | D-05, D-07 | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts ...` | ✅ | ✅ green |
| 01-11-T2 | 11 | D-07 | unit + integration | `node --test tests/orchestrators/plugin/uninstall.test.ts ...`; `npm run test:integration` | ✅ | ✅ green |
| 01-12-T1 | 12 | D-07 | unit | `node --test tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/reconcile/backfill.test.ts ...` | ✅ | ✅ green |
| 01-12-T2 | 12 | D-05, D-07 | unit + integration | `node --test tests/orchestrators/reconcile/apply.test.ts tests/index.test.ts ...`; `npm run test:integration` | ✅ | ✅ green |
| 01-13-T1 | 13 | D-05 | unit + integration + scan | `node --test tests/orchestrators/plugin/update-*.test.ts ...`; orchestrator `softDepStatus(` code scan | ✅ | ✅ green |
| 01-13-T2 | 13 | D-05 | unit | `node --test tests/orchestrators/plugin/fetch.test.ts tests/edge/handlers/plugin/fetch.test.ts ...` | ✅ | ✅ green |
| 01-14-T1 | 14 | D-05 | unit + integration | `node --test tests/orchestrators/plugin/list-flow.test.ts tests/edge/handlers/tools.test.ts ...` | ✅ | ✅ green |
| 01-14-T2 | 14 | D-05 | unit + scan | `node --test tests/orchestrators/plugin/info.test.ts ...`; handler/orchestrator `pi` parameter scan | ✅ | ✅ green |
| 01-15-T1 | 15 | D-05 | unit sweep + scan | `node --test $(rg -l "createNotificationBoundary\(" tests --glob "*.test.ts")`; `rg -n "toolProbes" tests` prints nothing | ✅ | ✅ green |
| 01-15-T2 | 15 | D-05 (Pitfall I) | unit + scan | `node --test tests/index.test.ts tests/edge/register.test.ts ...`; boundary Pi-mock scan | ✅ | ✅ green |
| 01-16-T1 | 16 | SC-2, D-06 | unit + architecture + scan | `node --test tests/shared/notification-dispatch.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts ...`; dispatch scan | ✅ | ✅ green |
| 01-16-T2 | 16 | SC-1..SC-5, D-03 | phase gate | `npm run check`; `node scripts/notify-corpus.mjs check`; `git diff --exit-code e40d3dda -- docs/output-catalog.md`; root-construction, prose, and boundary scans | ✅ | ✅ green |

---

## Wave 0 Requirements

- [x] Capture tool, loader hook, and `*.negative.mjs` companion under `scripts/` (SC-1)
- [x] Baseline `.jsonl` (ASCII-escaped) plus meta (Node version, date, counts) under `.planning/phases/01-presentation-model/`
- [x] `tests/shared/notification-resolve.test.ts` owner (100% direct)
- [x] Owner test for the per-invocation run constructor
- [x] SC-5 marker-policy architecture test
- [x] New `workflows-marker-coverage` case with a planted control
- [x] SC-3 two-answer probe case

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baseline holds no local paths or secrets | SC-1 | Worktree commits skip the TruffleHog hook | Resolved: original normalizer review is recorded in 01-01-SUMMARY.md. The current corpus scan on 2026-10-01 exited 0 with no findings (`--no-verification`, offline). |
| Markers and severity remain intact | PMOD-01 | Broad judgment beyond finite tests | User passed UAT test 1 on 2026-10-01. |
| Failure details remain intact | PMOD-03 | Broad judgment beyond finite tests | User passed UAT test 2 on 2026-10-01. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 180s is a target, not a measured guarantee. The latest full unit run took 404 seconds. Use focused commands for task feedback.
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-01 against existing passing evidence. No test additions were needed.


## Validation Audit 2026-10-01

| Metric | Count |
|--------|-------|
| Plans with summaries | 16 |
| Tasks with automated verification | 33/33 |
| Missing referenced test files | 0 |
| Automated coverage gaps found | 0 |
| Test gaps resolved in this audit | 0 |
| Escalated implementation bugs | 0 |
| Human checks passed | 2/2 |

The refreshed verification report supplies the current execution evidence:
7,552 unit tests, 36 integration tests, and 100% unit coverage for lines,
branches, and functions. All 2,661 corpus entries match, with no extras.
The report distinguishes the initial sandbox failure from the successful
permission-enabled continuation of the failed and remaining stages.
No covered implementation or test changed after those runs.

SC-1 and task 01-16-T2 use the catalog baseline accepted in
`01-VERIFICATION.md`: upstream commit `e40d3dda`, 206 states, and 26,848 bytes.
The original 205-state expectation is superseded by that recorded merge.
The corpus negative controls and type-member negative controls passed during
the review and verification runs. Every task has an automated command, so
there is no gap of three tasks without automated feedback.

The fresh corpus secret scan used:
`trufflehog filesystem --no-verification --no-update --fail --json .planning/phases/01-presentation-model/notify-corpus`.
It exited 0 with zero findings. This scan did not contact credential providers.
