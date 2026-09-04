---
phase: "109"
slug: "kind-inversion"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
---

# Phase 109 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 26.8.1 built-in); TypeScript stripped natively, no build step |
| **Config file** | none — configured through `package.json` scripts |
| **Quick run command** | `node --test <path/to/file.test.ts>` |
| **Full suite command** | `npm test && npm run test:integration` |
| **Estimated runtime** | < 5 s per architecture file; `npm run check` chains nine gates and is far slower (type-aware ESLint alone exceeded a 600 s foreground budget) |

---

## Sampling Rate

- **After every task commit:** Run `node --test` on the single file the task touched
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~5 seconds for the per-task command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | WINV-04 | — | N/A | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ turn doc blocks first — observed red | ⬜ pending |
| TBD | TBD | 0 | WINV-03 | — | N/A | unit | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ turn line 173 + message | ⬜ pending |
| TBD | TBD | 0 | WINV-03 | — | N/A | unit | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ turn line 51 + ledger comment | ⬜ pending |
| TBD | TBD | 0 | WINV-01 | T-02-25 | Kind in exactly one closed set | unit | `node --test tests/architecture/hooks-foundation.test.ts` | ✅ turn line 199; add mirror by line 207 | ⬜ pending |
| TBD | TBD | 0 | WINV-01, WINV-02 | NFR-10 | `assertPathInside` now covers `workflows` | unit (owner) | `node --test tests/domain/resolver.test.ts` | ✅ turn line 101; two positive tests | ⬜ pending |
| TBD | TBD | 1 | WINV-01, WINV-02 | T-02-25 | Both tuple moves land in ONE commit | unit | `npm run typecheck` | ✅ enumerates the test-side widening | ⬜ pending |
| TBD | TBD | 2 | WINV-03 | — | N/A | unit | `node --test tests/shared/notify.test.ts` | ✅ second length pin at line 5008 | ⬜ pending |
| TBD | TBD | 2 | WINV-03 | — | N/A | unit (owner) | `node --test tests/shared/probe-classifiers.test.ts` | ✅ turn line 266 to assert fall-through | ⬜ pending |
| TBD | TBD | 2 | WINV-01 | — | N/A | unit | `npm test` | ✅ 131 typecheck sites + ~10 `deepStrictEqual` payloads | ⬜ pending |
| TBD | TBD | 3 | WINV-02 | — | Plain install succeeds; nothing materialized | integration | `node --test tests/integration/workflow-kind-inversion.test.ts` | ❌ **Wave 0** | ⬜ pending |
| TBD | TBD | 3 | WINV-05 | — | N/A | manual read + guard | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ partial coverage only | ⬜ pending |
| TBD | TBD | 3 | all | — | N/A | full gate | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are filled by the planner. Wave numbers follow the research's four-wave
shape: Wave 0 turns the gates and observes them red, Wave 1 applies production,
Wave 2 does the mechanical test-side widening, Wave 3 adds the integration test
and the remaining prose.*

---

## Wave 0 Requirements

- [ ] `tests/integration/workflow-kind-inversion.test.ts` — covers WINV-02 at install
      level, both halves of D-109-07 part 2 (plain install succeeds; no workflow
      artifact on disk). New file. No production pair required —
      `tests/integration/` sits in `nonCorrespondingRoots` in
      `scripts/check-corresponding-tests.mjs`.
- [ ] No new framework, config, or fixture infrastructure. The
      `makeCtx` / `withHermeticHome` / `seed*Plugin` triple is copied from
      `tests/integration/transaction-lifecycle-cascade.test.ts`, which declares its
      own local copies rather than importing shared helpers (`tests/helpers/` does
      not exist on this branch).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each of the five locking tests was seen red before the production change and green after | WINV-04 (criterion 4) | The obligation is about the *observation sequence*, which no single automated run can attest to — a green suite at the end is exactly what criterion 4 says is insufficient | Run the per-file `node --test` command at the Wave 0 boundary, paste the failure output into VERIFICATION.md, then re-run after Wave 1/2 and paste the pass. `catalog-uat` needs its doc block turned first or it is green at runtime (A-02) |
| No `docs/` prose still claims workflow-bearing plugins degrade | WINV-05 | `partial-vocabulary-guard` scans `docs/output-catalog.md` for *retired vocabulary*, not for workflows prose — no gate covers this claim | Re-read the 17 flagged lines in `docs/output-catalog.md` after the edit; confirm each states the post-inversion meaning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
