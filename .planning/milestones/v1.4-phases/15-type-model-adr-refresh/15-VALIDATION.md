---
phase: 15
slug: type-model-adr-refresh
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 15 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node >=22) |
| **Config file** | none -- driven by `package.json` `test` script |
| **Quick run command** | `npm run typecheck && node --test tests/architecture/notify-types.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test) |
| **Estimated runtime** | ~30 seconds (typecheck ~5-10s; full suite ~30s) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be GREEN
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Populated by the planner once tasks are defined. Each task must map to one or more SNM-* requirements with a node:test arch-test assertion (positive `_Assert` block + `@ts-expect-error` negative assertion where applicable) or an ADR-content manual check (SNM-21).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-XX | 01 | 1 | SNM-01..SNM-11 | -- | N/A (type-only) | typecheck | `npm run typecheck` | Wave 0 (notify.ts append) | pending |
| 15-02-XX | 02 | 2 | SNM-01..SNM-11 | -- | N/A (type-only) | arch-test | `node --test tests/architecture/notify-types.test.ts` | Wave 0 (new file) | pending |
| 15-03-XX | 03 | 3 | SNM-21 | -- | N/A (docs-only) | manual + grep | `grep -q "^Status: Accepted" docs/adr/v2-001-structured-notify.md` | existing (edit) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/notify-types.test.ts` -- new arch-test file. Pattern reference: `tests/architecture/grammar-frontmatter.test.ts`. Body: node:test import + `assert.equal(1, 1)` runner-anchor + a battery of `type _Assert_* = ...` blocks asserting closed-set membership, round-trip equivalence between tuple-derived `PluginStatus` and the 10 variant `status` literals (SNM-04 forward + backward), and per-variant structural invariants (D-15-12) for `cause?`, `rollbackPartial?`, `scope?`, `dependencies`, `reasons`, `from`/`to`. Negative-invariant assertions use `@ts-expect-error`.

*No other Wave 0 gaps -- TypeScript, node:test, ESLint, Prettier already configured; `npm run check` script already wired.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ADR body refresh (Decision section rewrite, Alternative 2 flip, Migration phase refs, Open Questions deletion) | SNM-21 | Documentation content; semantic correctness of prose against D-15-13..D-15-16 cannot be validated by markdownlint | Manually review `docs/adr/v2-001-structured-notify.md` end-to-end against CONTEXT.md D-15-13, D-15-14, D-15-15, D-15-16. Grep `^Status: Accepted` confirms status flip. |
| Success Criterion #4: zero call-site references to new types in Phase 15 | (cross-cutting) | Grep alone is the proof; no test infrastructure needed | `git grep -E "PluginNotificationMessage\|MarketplaceNotificationMessage\|UsageErrorMessage\|PluginStatus\|MarketplaceStatus" -- extensions/ ':!extensions/pi-claude-marketplace/shared/notify.ts' ':!tests/architecture/notify-types.test.ts'` returns empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`notify-types.test.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
