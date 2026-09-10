---
phase: "109"
slug: "kind-inversion"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-04"
validated: "2026-09-10"
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
| — | — | 0 | WINV-04 | — | N/A | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ turn doc blocks first — observed red | ✅ green |
| — | — | 0 | WINV-03 | — | N/A | unit | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ turn line 173 + message | ✅ green |
| — | — | 0 | WINV-03 | — | N/A | unit | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ turn line 51 + ledger comment | ✅ green |
| — | — | 0 | WINV-01 | T-02-25 | Kind in exactly one closed set | unit | `node --test tests/architecture/hooks-foundation.test.ts` | ✅ turn line 199; add mirror by line 207 | ✅ green |
| — | — | 0 | WINV-01, WINV-02 | NFR-10 | `assertPathInside` now covers `workflows` | unit (owner) | `node --test tests/domain/resolver.test.ts` | ✅ turn line 101; two positive tests | ✅ green |
| — | — | 1 | WINV-01, WINV-02 | T-02-25 | Both tuple moves land in ONE commit | unit | `npm run typecheck` | ✅ enumerates the test-side widening | ✅ green |
| — | — | 2 | WINV-03 | — | N/A | unit | `node --test tests/shared/notify.test.ts` | ✅ second length pin at line 5008 | ✅ green |
| — | — | 2 | WINV-03 | — | N/A | unit (owner) | `node --test tests/shared/probe-classifiers.test.ts` | ✅ turn line 266 to assert fall-through | ✅ green |
| — | — | 2 | WINV-01 | — | N/A | unit | `npm test` | ✅ 131 typecheck sites + ~10 `deepStrictEqual` payloads | ✅ green |
| — | — | 3 | WINV-02 | — | Plain install succeeds; nothing materialized | integration | `node --test tests/integration/workflow-kind-inversion.test.ts` | ❌ **Wave 0** | ✅ green |
| — | — | 3 | WINV-05 | — | N/A | manual read + guard | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ partial coverage only | ✅ green |
| — | — | 3 | all | — | N/A | full gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are filled by the planner. Wave numbers follow the research's four-wave
shape: Wave 0 turns the gates and observes them red, Wave 1 applies production,
Wave 2 does the mechanical test-side widening, Wave 3 adds the integration test
and the remaining prose.*

---

## Wave 0 Requirements

- [x] `tests/integration/workflow-kind-inversion.test.ts` — covers WINV-02 at install
      level, both halves of D-109-07 part 2 (plain install succeeds; no workflow
      artifact on disk). New file. No production pair required —
      `tests/integration/` sits in `nonCorrespondingRoots` in
      `scripts/check-corresponding-tests.mjs`.
- [x] No new framework, config, or fixture infrastructure. The
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

## Validation Audit 2026-09-10

| Metric | Count |
|--------|-------|
| Map rows audited | 12 |
| Covered | 12 |
| Partial | 0 |
| Missing | 0 |
| Manual-only rows audited | 2 |
| Gaps found | 0 |
| Tests generated | 0 |

Run retroactively. This file was seeded by plan-phase and never reconciled, so
every row still read `⬜ pending` and every Task ID `TBD` while the phase itself
verified 12/12. The audit ran each cited command live rather than trusting the
map: `catalog-uat` (6/6 within an 89/89 run), `compat-01-no-expansion`,
`notify-closed-set-locks` (`REASONS.length === 46`, an exact-length pin rather
than a range), `hooks-foundation` (9/9, both tuples plus a negative mirror),
`resolver.test.ts` (4/4 within 159/159), `notify.test.ts:5013` (an independent
second pin of the same length), `probe-classifiers`, the integration case (1/1),
and `partial-vocabulary-guard` (78 subtests). `npm run typecheck` exited 0.

**The Task ID and Plan columns read `—` rather than retrofitted values.** The
planner never filled them, and inventing IDs now would fabricate a mapping that
never existed. The Status column is the reconciliation that carries meaning.

### The red-slice claim is real, not narrated

Criterion 4 asks for a red-then-green pair rather than a green suite at the end,
which is a claim about an observation sequence and therefore the kind of thing a
later reader normally has to take on trust. It holds here.
`109-01-SUMMARY.md` §"Red observations" carries actual captured stdout for all
six gates — exit 1, fail counts, error text — and each block opens with
`git diff --name-only 85fecdba~1..HEAD -- extensions/` returning zero files,
proving production was untouched at capture time. Each RED is paired in
`109-02-SUMMARY.md` / `109-04-SUMMARY.md` with the commit SHA showing the GREEN.

### No vacuous coverage found

Every closed-set test pins an exact length or an exact tuple rather than a range,
and the integration case carries an explicit non-vacuity precondition
(`compatibility.supported.includes("workflows")`) before asserting rendered bytes
— so it cannot pass against a fixture that carries no workflows at all.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — the integration file landed and was run
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

`nyquist_compliant: true` is set with both Manual-Only rows adjudicated as
genuinely un-automatable rather than declined:

1. **The red-then-green observation sequence.** No single assertion at HEAD can
   attest to an ordering over time. Automatable only by parsing commit history or
   CI logs; correctly left manual, and the obligation was in fact discharged —
   see the verdict above.
2. **No `docs/` prose still claims workflow-bearing plugins degrade.** Confirmed
   directly during this audit: `docs/output-catalog.md` carries zero stale
   count tokens and zero kind-level degrade claims tied to `workflows`. The two
   `degrad` hits are about missing soft-dependency companions — a different and
   correct concept. `partial-vocabulary-guard.test.ts` contains zero `workflow`
   references, which confirms the map's own statement that no gate covers this
   claim. Automatable in principle by a token guard; correctly scoped out rather
   than papered over with a gate that does not cover it.

**Approval:** validated 2026-09-10
