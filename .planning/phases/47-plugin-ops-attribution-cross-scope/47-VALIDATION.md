---
phase: 47
slug: plugin-ops-attribution-cross-scope
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 47 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none (CLI invocation in package.json) |
| **Quick run command** | `node --test "tests/orchestrators/plugin/<op>.test.ts"` (per-op) |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + npm test) |
| **Byte-contract runner** | `node --test "tests/architecture/catalog-uat.test.ts"` |
| **Estimated runtime** | per-op a few seconds; full check ~1-2 min |

---

## Sampling Rate

- **While editing / per task:** `npx tsc --noEmit` + the touched op's `node --test tests/orchestrators/plugin/<op>.test.ts` + (after any catalog edit) `node --test tests/architecture/catalog-uat.test.ts`.
- **Per wave merge:** `npm run check` (the family is serialized through shared.ts / notify.ts -- one merge gate).
- **Phase gate:** full `npm run check` GREEN before `/gsd-verify-work`. NOTE: `git diff --stat docs/output-catalog.md` is NON-empty this phase (bytes change for corrected attribution); every changed byte form MUST have a paired catalog state + catalog-uat fixture.
- **Max feedback latency:** typecheck < ~10s.

---

## Per-Task Verification Map

> Task IDs are assigned during planning. Reconcile concrete IDs after `/gsd-plan-phase`.

| Requirement | Behavior | Test Type | Automated Command | Status |
|-------------|----------|-----------|-------------------|--------|
| ATTR-01 | install missing mp → standalone `(failed) {not added}` (not `{not in manifest}` on plugin row) | unit + byte | `node --test tests/orchestrators/plugin/install.test.ts`; catalog-uat | ⬜ pending |
| ATTR-08 | install distinguishes mp-absent (`{not added}`) from plugin-absent (`{not in manifest}`) | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ⬜ pending |
| ATTR-02 | update `<pl>@<mp>` and `@<mp>` missing mp → `{not added}`, no raw throw | unit + byte | `node --test tests/orchestrators/plugin/update.test.ts`; catalog-uat | ⬜ pending |
| ATTR-03 | reinstall missing mp → `{not added}` across explicit + bare forms | unit + byte | `node --test tests/orchestrators/plugin/reinstall.test.ts`; catalog-uat | ⬜ pending |
| ATTR-04 | uninstall never-added mp → `{not added}`; already-gone plugin → silent | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ⬜ pending |
| ATTR-09 | cascade/cleanup failure → truthful reason (not `{not in manifest}`) | unit | `node --test tests/orchestrators/plugin/{uninstall,reinstall}.test.ts` | ⬜ pending |
| SCOPE-01 | target in other scope → reports it (not not-installed / not-in-manifest); CMP-3 fallback preserved | unit | `node --test tests/orchestrators/plugin/shared.test.ts` (+ op tests) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The reason-classification + byte-equality infrastructure already exists (catalog-uat runner +
per-op test scaffolds). The genuinely-new surfaces this phase must add:

- [ ] Cross-scope resolution tests in `tests/orchestrators/plugin/shared.test.ts` -- SCOPE-01 (new
  discriminated resolver behavior; no existing coverage for "present in other scope").
- [ ] New catalog states + FIXTURES entries for each op's `missing-marketplace-not-added` (and
  scope-mismatch) -- ATTR-01/02/03/04 byte contract.

No framework install; no new test harness.

---

## Manual-Only Verifications

*All phase behaviors have automated verification* (orchestrator unit tests for reason
classification + cross-scope resolution; catalog-uat byte-equality for rendered forms).

---

## Validation Sign-Off

- [ ] All tasks have automated verify (per-op test + catalog-uat where bytes change)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers cross-scope tests + new catalog states
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (typecheck/per-op)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
