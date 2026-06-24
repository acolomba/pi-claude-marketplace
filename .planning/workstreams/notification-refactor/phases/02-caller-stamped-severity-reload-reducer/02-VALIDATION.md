---
phase: 2
slug: caller-stamped-severity-reload-reducer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase is OUTPUT-PRESERVING (D-01): the catalog-uat byte gate is the
> primary correctness anchor. No new behavioral fixtures are introduced for
> rendered output; the reproduction map (D-03) is proven by byte-equality, and
> GATE-01 relocation is proven by the type checker plus the thin architecture
> backstop (D-05).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — node --test strips TS natively (or via tsx loader) |
| **Quick run command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60–120 seconds |

The single source of correctness for output-neutrality is
`tests/architecture/catalog-uat.test.ts` (byte-equality against
`docs/output-catalog.md`). `npm run check` runs it as part of the test suite.

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` (must be green AND catalog-uat byte-identical)
- **Before `/gsd-verify-work`:** Full suite green; `catalog-uat` byte-identical to pre-phase baseline
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> The planner fills this from the final PLAN.md task list. Every state-change
> stamping task maps to the catalog-uat byte gate and/or a notify-grammar
> assertion; the GATE-01 type-level change maps to a deliberate TS2741 compile
> proof; the D-05 backstop maps to the new architecture test.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | SEV-01..05 / RLD-01..05 | — | N/A (output-preserving) | byte-equality | `npm run check` (catalog-uat) | ✅ | ⬜ pending |
| {N}-01-02 | 01 | 1 | GATE-01 | — | N/A | type-compile | `npx tsc --noEmit` (TS2741 on omitted transition stamp) | ✅ | ⬜ pending |
| {N}-0X-XX | 0X | 3 | GATE-01 | — | N/A | unit (arch) | `npm run check` (D-05 backstop) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New architecture-test file for the D-05 backstop (asserts every
      cascade-producing orchestrator — notably `reconcile/notify.ts` — stamps
      both `severity` and `needsReload` on its state-change rows). Drive
      `buildReconcileAppliedCascade` / `buildReconcilePendingNotification` via
      runtime introspection (matches the catalog-uat / notify-grammar idiom).
- [ ] Update/supersede `tests/shared/notify-inert-fields.test.ts` — the Phase-1
      "inert fields" guard whose premise is invalidated once the fields go LIVE.

*Existing infrastructure (node:test, catalog-uat, notify-v2 grammar spec)
covers all rendered-output requirements; no test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification — the catalog-uat byte gate,
the TypeScript compile gate (GATE-01), and the D-05 architecture backstop are
all machine-checkable.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (D-05 backstop test, inert-fields supersession)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
