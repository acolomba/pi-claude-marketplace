---
phase: 3
slug: desired-state-output-atomic-catalog-supersession
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase CHANGES rendered output, so the byte-equality `catalog-uat` gate is
> the primary correctness oracle and MUST be green at every commit boundary
> (atomic catalog supersession — D-06 / OUT-08 / GATE-02).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node >= 20.19.0 built-in runner, TS strip) |
| **Config file** | none — package.json scripts |
| **Quick run command** | `node --test "tests/architecture/catalog-uat.test.ts" "tests/architecture/notify-producer-wire-coverage.test.ts" "tests/shared/notify-v2.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test + test:integration) |
| **Estimated runtime** | ~30–90 seconds (full `npm run check`) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (catalog-uat + wire-coverage + notify grammar). MUST be green — atomic supersession admits no red gate between commits.
- **After every plan wave:** Run `npm run check` (full gate).
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

> Filled per-plan by the planner. Every output-changing task pairs a code edit
> with its catalog/fixture rewrite IN THE SAME TASK; the catalog-uat byte gate is
> the automated command proving the pairing is correct.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner-filled) | — | — | OUT-0x | — / — | N/A | byte-equality | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. `catalog-uat`,
  `notify-producer-wire-coverage`, and `notify-v2` test files already exist and
  are GREEN at baseline (confirmed in 03-RESEARCH.md). No new framework or stub
  files required — fixtures are rewritten in lockstep, not bootstrapped.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendered notification prose reads naturally (leading sentence + tally grammar) | OUT-02 / OUT-03 | Byte fixtures assert exact bytes; human read confirms the chosen wording is the intended one before it is frozen into fixtures | Inspect the rewritten fenced blocks in `docs/output-catalog.md` for the leading sentence + tally states |

*All structural/behavioral invariants have automated verification via the byte-equality gate.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (catalog-uat / wire-coverage / npm run check) or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — existing infra)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
