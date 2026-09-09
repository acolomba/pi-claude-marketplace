---
phase: "116"
slug: "load-time-workflow-convergence"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-09"
---

# Phase 116 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node >= 20.19.0 builtin) + `node:assert/strict` + `strong-mock` `^9.2.2` |
| **Config file** | none — driven by `package.json` scripts |
| **Quick run command** | `node --test tests/orchestrators/reconcile/backfill.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick run ~4 s; `npm test` ~40 s at 5645 tests; `npm run check` several minutes |

Architecture subset: `node --test "tests/architecture/*.test.ts"`.
Per-pair coverage: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`.

---

## Sampling Rate

- **After every task commit:** `node --test` on the touched files, plus `npm run typecheck`
- **After every plan wave:** `npm test` (~40 s) and `npm run test:integration`
- **Before `/gsd-verify-work`:** `npm run check` must be green, plus the per-pair
  coverage run above at 100% function/line/branch **run alone** (the pairing rule
  the `typescript-unit-testing-review` skill states)
- **Max feedback latency:** a few seconds for the per-task suite

Do not re-run `npm run check` as a spot-check step — run the quick command per
task and the full gate once per wave.

---

## Requirements → Validation Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| WCONV-01 | an `installable: true` record whose set grew is promoted; envelope placed; record gains `workflows` | unit | `node --test tests/orchestrators/reconcile/backfill.test.ts` | ✅ add case |
| WCONV-01 | negative control: restoring the deleted filter reddens that case | unit (control) | same file, filter restored | ✅ manual control |
| WCONV-01 | a git-source record with a grown set is skipped and no clone is made | unit | same file | ✅ add case — none today |
| WCONV-02 | a second load re-materializes nothing; `{bytes, inode, mtimeNs}` all unchanged | unit + integration | `backfill.test.ts` / `tests/integration/workflow-kind-inversion.test.ts` | ✅ extend (D-116-07) |
| WCONV-02 | an equal supported set is scanned but not materialized | unit | `backfill.test.ts:485` (retitle) and `:1170` | ✅ exists |
| WCONV-03 | a disabled record is never scanned, asserted as a MEASURED ZERO | unit | `backfill.test.ts` — manifest-poison or an injected counting seam | ✅ add case (`:1382`, `:1425`, `:1486` adjacent) |
| WCONV-03 | the token is a member of the closed set, at the tail, at the new length | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` | ✅ bump |
| WCONV-03 | the token renders byte-exactly on both arms | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ add states + fixtures + count |
| WCONV-03 | the projection stamps the token on both arms | unit | `node --test tests/orchestrators/reconcile/notify.test.ts` — the 4 backfill cases at `:1106`, `:1147`, `:1186`, `:1226` | ✅ exists — all four change |
| WCONV-03 | silence: no growth ⇒ no row at all | unit | `backfill.test.ts:1128`, `:1170`, `:1220` | ✅ exists |

---

## Wave 0 Requirements

- [x] **No gaps.** `tests/orchestrators/reconcile/backfill.test.ts` already carries
      the full hermetic harness (`createHermeticProjectScope`,
      `writeMarketplaceSource`, `pluginRecord`, `createOfflineGitOps`,
      `createSilentBoundary`, `savedWorkflowEntries`, `retryTree`), and
      `PluginTree.workflow` is already a fixture knob (`:137-138`). All four
      architecture tests exist. No framework install, no new config.
- [x] **No new unit test file may be created** under `tests/orchestrators/`
      (`scripts/check-corresponding-tests.mjs:10`), and a new top-level `tests/`
      directory reddens `tests/architecture/unit-suite-glob-completeness.test.ts`.
      Extend existing suites.

---

## The Negative Controls

Every gate this phase adds gets a control RUN before it is believed, and the
failing transcript goes in the SUMMARY — not a summary of it. This milestone has
shipped three guards that were green because they checked nothing.

1. **The widened scan.** Restore the deleted
   `if (record.compatibility.installable) return false;` in
   `backfillOnePluginIsolated`. Expect the WCONV-01 promotion case RED. Restore.
2. **The closed-set token.** Remove the new member from the `REASONS` set.
   Expect `notify-closed-set-locks.test.ts` and `compat-01-no-expansion.test.ts`
   RED. Restore.
3. **The token's rendering, not merely its membership.** Change the token's
   rendered bytes in the catalog without touching the set. Expect
   `catalog-uat.test.ts` RED. **If it stays green the pairing checks half of what
   criterion 4 asks and must be strengthened** — a token can be a legal member
   and never reach a rendered row.
4. **The measured zero.** With the disabled-record case green, remove the
   `isRecordedButDisabled` filter. Expect the count to move off zero and the case
   RED. A case that stays green proves the counter is not wired to the scan.

**Three amendment sites are known to stay silently green** and must be fixed by
inspection rather than waited on: the lock test's own TITLE (`45-entry`), and the
prose counts at `notify.ts:83` and `notify-reasons.ts:7,14`. Record that they
were checked.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The bounded population claim: are the two Anthropic-authored workflow plugins path-source or git-source? | WCONV-01 | A fact about upstream repositories, not about this tree | Read the marketplace manifests' `source` for each plugin; correct the CONTEXT/ROADMAP prose if the claim is false. The research bounds the widened scan to path-source records, so a git-source answer makes the population sentence wrong even though every criterion stays satisfiable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] All four negative controls run, transcripts pasted into the SUMMARY
- [ ] The three silently-green amendment sites checked by inspection and recorded
- [ ] The path-source population claim re-measured and the prose corrected or confirmed
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
