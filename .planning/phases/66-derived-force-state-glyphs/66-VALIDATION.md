---
phase: 66
slug: derived-force-state-glyphs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 66-RESEARCH.md "## Validation Architecture". This phase is
> DISPLAY/DERIVATION only — every requirement is proven by direct-`notify()`
> byte assertions and orchestrator/handler unit tests. No new persisted data,
> no network.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node >=20.19.0) + `node:assert/strict` |
| **Config file** | none — test files discovered by glob; run via `node --test` |
| **Quick run command** | `node --test tests/shared/notify-v2.test.ts tests/architecture/notify-closed-set-locks.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + `node --test`) |
| **Estimated runtime** | ~quick: a few seconds; full `npm run check`: tens of seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched test file via `node --test <file>`; run `npm run check` whenever `notify.ts` status tuples / glyph switch change (the closed-set length tripwire is fast and catches a missed render site).
- **After every plan wave:** Run `npm run check` (full typecheck + lint + format + tests).
- **Before `/gsd-verify-work`:** Full `npm run check` must be green (NFR-6).
- **Max feedback latency:** quick run a few seconds; full suite tens of seconds.

---

## Per-Task Verification Map

> Task IDs bind to the gsd-planner output (task IDs filled during execution /
> Wave 0). Rows below map each phase requirement to its proving test seam.

| Requirement | Behavior proven | Test Type | Automated Command | File Exists | Status |
|-------------|-----------------|-----------|-------------------|-------------|--------|
| FSTAT-01 | No persisted flag — STATE schema unchanged; force-state is derived from (recorded-installed record + resolver state) | unit/arch | `node --test tests/domain/` (state schema) + new deriver unit | partial — schema tests exist; deriver unit ❌ W0 | ⬜ pending |
| FSTAT-02 | `force-installed` renders `◉ ... (force-installed)`; `◉` (U+25C9) is byte-distinct from `●` (U+25CF) | unit (renderer byte) | `node --test tests/shared/notify-v2.test.ts` | file exists; new cases ❌ W0 | ⬜ pending |
| FSTAT-03 | After a fully-supported upgrade the deriver yields `installed` (no lingering force-state) | unit (deriver) | `node --test tests/orchestrators/plugin/list.test.ts` | file exists; case ❌ W0 | ⬜ pending |
| FSTAT-04 | `force-upgradable` row wears `●`; a force-installed plugin is never force-upgradable | unit (renderer + deriver) | `node --test tests/shared/notify-v2.test.ts tests/orchestrators/plugin/list.test.ts` | files exist; cases ❌ W0 | ⬜ pending |
| FSTAT-05 | Candidate resolved no-network (cache) — reuses the existing upgradable candidate path | unit (orchestrator, injected resolve ctx, no network) | `node --test tests/orchestrators/plugin/list.test.ts` | file exists; case ❌ W0 | ⬜ pending |
| FSTAT-06 | Preview renders `will force install` / `will force update` in place of `will install` / `will update` | unit (pending/reconcile renderer) | `node --test tests/edge/handlers/plugin/pending.test.ts` | files exist; cases ❌ W0 | ⬜ pending |
| FSTAT-07 | info reports `(force-installed)` + dropped-component detail via `narrowUnsupportedKinds`; force install/update success notification reads "force-installed" | unit (info renderer + install/update orch) | `node --test tests/orchestrators/plugin/info.test.ts tests/edge/handlers/plugin/info.test.ts` | files exist; cases ❌ W0 | ⬜ pending |
| (closed-set gate) | Both new tokens added to `PLUGIN_STATUSES` + `STATUS_TOKENS`; every render site compile-forced via `assertNever`; runtime length tripwires bumped | arch | `node --test tests/architecture/notify-closed-set-locks.test.ts` | file exists; counts must be EDITED | ⬜ pending |
| (tools projection) | `force-installed` / `force-upgradable` project to `[installed]` on the tool surface (`tools.ts projectRowStatus`) | unit | `node --test tests/edge/handlers/tools.test.ts` | file exists; cases ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shared/notify-v2.test.ts` — add `force-installed` + `force-upgradable` renderer byte-form cases (template: existing `upgradable` test ~line 404; PL-4 description tests ~1064-1175). Covers FSTAT-02 / FSTAT-04.
- [ ] `tests/architecture/notify-closed-set-locks.test.ts` — bump the two runtime length tripwires (15→17 and 22→24) and update titles. Edit, not new file.
- [ ] `tests/orchestrators/plugin/list.test.ts` — deriver cases: force-installed (record installed + cached tree resolves `unsupported`), force-upgradable (clean current + newer candidate degrades), FSTAT-03 return-to-installed.
- [ ] `tests/orchestrators/plugin/info.test.ts` / `tests/edge/handlers/plugin/info.test.ts` — info `(force-installed)` row + dropped-component detail (FSTAT-07).
- [ ] `tests/edge/handlers/tools.test.ts` — force-installed / force-upgradable project to `[installed]` (template: existing `[installed]` assertions).
- [ ] Pending/preview test for `will force install` / `will force update` (FSTAT-06) — contingent on the planner locking the `will force update` surface (research open question Q3).
- [ ] No new framework install — `node --test` already in place.

**Catalog boundary (do NOT violate):** Phase 66 keeps `docs/output-catalog.md` UNTOUCHED. New force rows are proven by `notify-v2.test.ts` direct-`notify()` byte assertions, NOT by new `<!-- catalog-state: -->` blocks. Byte-exact catalog reconciliation is Phase 70 (DOC). Adding a catalog block without a fixture would RED the `catalog-uat.test.ts` gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (direct-`notify()` byte assertions + orchestrator/handler unit tests). No manual-only checks.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (quick run seconds; full suite tens of seconds)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
