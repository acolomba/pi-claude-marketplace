---
phase: "08"
slug: "final-verification-and-reconciliation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-18"
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node v26.8.2 built-in), driven through `package.json` scripts |
| **Config file** | `package.json` scripts; `scripts/coverage-capture.manifest.mjs` |
| **Quick run command** | `npm run coverage:validate; echo "exit=$?"` |
| **Full suite command** | the sixteen `npm run check` members run as separate processes, then `npm run test:e2e`, `npm run test:coverage:direct:all`, `pre-commit run --all-files` |
| **Estimated runtime** | ~6 s quick; ~45 min full set (check chain 1300 s, direct all-pairs 509 s, pre-commit 838 s) |

---

## Sampling Rate

- **After every task commit:** Run `npm run coverage:validate; echo "exit=$?"` plus `pre-commit run --files <edited files>; echo "exit=$?"` and `git status --short`
- **After every plan wave:** Run the FINAL-02 grep set (see 08-RESEARCH.md § Validation Architecture) and `npm run coverage:validate`
- **Before `/gsd-verify-work`:** Full suite must be green (every exit recorded in 08-MEASUREMENT.md; the TruffleHog worktree failure classified as environment)
- **Max feedback latency:** 10 seconds for the quick command; the full set is a phase-gate run, not a per-task loop

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | FINAL-01 | — | N/A | gate | sixteen `npm run <member>; echo "exit=$?"` rows, all `exit=0` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | FINAL-01 | — | N/A | measurement | `npm run coverage:validate; echo "exit=$?"` and LCOV recount `LF==LH`, `FNF==FNH`, `BRF==BRH`, zero-count entries 0 | ✅ | ⬜ pending |
| 08-01-03 | 01 | 1 | FINAL-01 | — | N/A | gate | `npm run test:e2e; echo "exit=$?"`; `npm run test:coverage:direct:all; echo "exit=$?"`; `pre-commit run --all-files; echo "exit=$?"` with `git status --short` before/after | ✅ | ⬜ pending |
| 08-02-01 | 02 | 2 | FINAL-02 | — | N/A | doc check | `grep -n "FLOW-05\|SWTEST-01" .planning/BACKLOG.md`; `ls .planning/todos/pending/`; `grep -n "Detect unused code" .planning/STATE.md` | ❌ W0 (edits are the phase's work) | ⬜ pending |
| 08-02-02 | 02 | 2 | FINAL-02 | — | N/A | diff | `git diff --stat <phase-start>..HEAD -- .planning/milestones .planning/inputs .planning/phases/0[1-7]-*` additive only; `git diff --quiet <phase-start>..HEAD -- extensions tests scripts package.json .fallowrc.json eslint.config.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None in test infrastructure. The FINAL-02 checks are greps and diffs against the records the plan edits; they go green as the edits land.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TruffleHog red under `pre-commit run --all-files` is an environment failure, not a regression | FINAL-01 | The hook opens `.git/index`; in a worktree `.git` is a file | Confirm `.git` is a file (`gitdir:` pointer); run `SKIP=trufflehog pre-commit run --all-files; echo "exit=$?"` → `exit=0` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
