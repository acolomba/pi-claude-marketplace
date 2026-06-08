---
phase: 50
slug: notification-summary-line-grammar
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
approved: 2026-06-08
---

<!-- Post-execution: all phase requirements (GRAM-01..05) have automated
     coverage with no MISSING references; the Wave 0 deliverables (the
     grammar-invariant test + the notify-v2 byte cases) were created and are
     GREEN; npm run check exits 0 (1515 tests). No watch-mode flags; feedback
     latency < 30s. Nyquist sign-off satisfied. -->


# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in), Node >= 20.19.0 |
| **Config file** | none — `package.json` `test` script |
| **Quick run command** | `node --test "tests/shared/notify-v2.test.ts" "tests/architecture/catalog-uat.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + `npm test`) |
| **Estimated runtime** | ~30 seconds (quick); ~90 seconds (full check) |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/shared/notify-v2.test.ts" "tests/architecture/catalog-uat.test.ts"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must exit 0
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Task IDs are assigned during planning. This map is requirement-anchored; the
> planner binds each requirement to its tasks. Every requirement below has an
> automated command — no requirement is manual-only.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| GRAM-01 | Every error/warning notification has a non-empty summary first line + separate detail block | unit + invariant | `node --test "tests/architecture/catalog-uat.test.ts"` + new invariant test | catalog-uat ✅; invariant ❌ W0 | ⬜ pending |
| GRAM-02 | Summary subject follows failed row (marketplace vs plugin) | unit (byte) | `node --test "tests/shared/notify-v2.test.ts"` (+2 byte cases) | ✅ extend | ⬜ pending |
| GRAM-03 | Two-block shape across every `marketplace-not-added` + failed `plugin-info` state | byte-equality | `node --test "tests/architecture/catalog-uat.test.ts"` (after fence rewrite) | ✅ | ⬜ pending |
| GRAM-04 | Single shared summary path; `dispatchInfoMessage` no longer bypasses `buildSummaryLine` | unit / structural | new invariant test + notify-v2 standalone tests | ❌ W0 | ⬜ pending |
| GRAM-05 | Cross-cutting invariant over all catalog fixtures; catalog + fixtures corrected in lockstep | invariant + byte-equality | new invariant test + catalog-uat | ❌ W0 (test); ✅ catalog-uat | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/notify-grammar-invariant.test.ts` (placement at planner's discretion; peer to `catalog-uat`) — cross-cutting invariant asserting every error/warning fixture's emitted message has a non-empty summary first line distinct from the cascade block (GRAM-01 / GRAM-04 / GRAM-05). New file.
- [ ] 2 new byte-equality cases in `tests/shared/notify-v2.test.ts` for the standalone `marketplace-not-added` and failed `plugin-info` two-block forms (GRAM-02). Extend existing file.
- [ ] Framework install: none — node:test is built in.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

*All phase behaviors have automated verification — the catalog-uat byte-equality gate plus the new grammar-invariant test cover every success criterion. The success-criterion-1 install-against-missing-marketplace surface is byte-asserted through the catalog fixture, so no manual `/claude:plugin install` run is required for sign-off.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
