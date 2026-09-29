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
