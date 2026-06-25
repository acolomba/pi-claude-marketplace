---
phase: 4
slug: concern-module-extraction-open-closed-proof
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> This is an **output-neutral refactor**. Its primary gate is byte-equality of
> the rendered catalog plus `npm run check`. No new tests are added — and a
> `notify.ts`-purity architecture test is **explicitly forbidden** (D-02). The
> "sampling" is the byte-freeze run performed at every commit boundary.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node ≥ 20.19.0) |
| **Config file** | none — invoked via `package.json` scripts |
| **Quick run command** | `node --test tests/architecture/catalog-uat.test.ts && git diff --exit-code docs/output-catalog.md` |
| **Full suite command** | `npm run check` (`typecheck && lint && format:check && test && test:integration`) |
| **Estimated runtime** | ~quick < 10s · full suite ~1–2 min |

---

## Sampling Rate

- **After every task commit:** Run the quick command — `node --test tests/architecture/catalog-uat.test.ts` and `git diff --exit-code docs/output-catalog.md` (catalog byte-frozen, diff MUST be empty).
- **After every plan wave:** Run `npm run check`.
- **Before `/gsd-verify-work`:** `npm run check` must be green AND `git diff docs/output-catalog.md` empty.
- **Max feedback latency:** < 10 seconds for the per-commit byte-freeze; full suite is the wave/gate sample.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-soft-dep | concerns | 1 | MOD-04 | — | Output byte-identical; fence intact | byte-equality + typecheck | `node --test tests/architecture/catalog-uat.test.ts` + `git diff --exit-code docs/output-catalog.md` + `npm run typecheck` | ✅ catalog-uat.test.ts | ⬜ pending |
| 04-hooks | concerns | 1 | MOD-04 | — | Output byte-identical; fence intact | byte-equality + typecheck | same as above | ✅ catalog-uat.test.ts | ⬜ pending |
| 04-proof-doc | proof | 2 | MOD-05, MOD-06 | — | N/A (documentation) | manual doc review | review `docs/open-closed-proof.md` | ❌ W2 (authored this phase) | ⬜ pending |
| 04-gate | gate | 2 | GATE-03 | — | Full gate green | full suite | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- **No new test files needed.** The existing `tests/architecture/catalog-uat.test.ts`
  byte-compares `notify()` output against the fenced blocks in `docs/output-catalog.md`
  and fully covers the output-neutrality contract.
- `docs/open-closed-proof.md` is a **documentation deliverable** (the D-02 measurement +
  D-03 catalog floor), not a test. It is authored during the phase, not a Wave 0 test stub.
- Adding a `notify.ts`-purity architecture test is **explicitly forbidden** (D-02).

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ≤3-central-files / 0-`notify.ts`-edits open-closed target | MOD-05 | A documented measurement (D-02), not an enforced test — the user chose the lighter path over an architecture test | Review `docs/open-closed-proof.md`: it enumerates the 3 central files a new command touches (`edge/router.ts` registration, `edge/register.ts` wiring line, one `docs/output-catalog.md` section) and 0 `notify.ts` edits, measured against the `research/MESSAGING-COUPLING.md` baseline (5 no-grammar / 9–11 new-grammar). |
| Catalog floor documented | MOD-06 | Documentation deliverable (D-03) | Confirm `docs/open-closed-proof.md` records the hand-authored catalog floor: one central section per new rendered state, no generation/aggregation seam, deferred. |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify (byte-equality + `npm run check`) or are documented manual-only deliverables (the proof doc)
- [ ] Sampling continuity: byte-freeze runs at every commit boundary — no commit without the catalog diff check
- [ ] Wave 0 covers all MISSING references (none — existing catalog-uat suffices)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for the per-commit byte-freeze
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
