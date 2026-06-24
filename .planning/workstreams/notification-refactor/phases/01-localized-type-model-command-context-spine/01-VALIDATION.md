---
phase: 1
slug: localized-type-model-command-context-spine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase is OUTPUT-NEUTRAL: validation centers on byte-equality + typecheck-as-exhaustiveness-proof.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node `>=20.19.0` |
| **Config file** | none — test globs live in `package.json` scripts |
| **Quick run command** | `node --test "tests/architecture/catalog-uat.test.ts" "tests/shared/notify-v2.test.ts" "tests/architecture/notify-grammar-invariant.test.ts"` + `npm run typecheck` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test + test:integration) |
| **Estimated runtime** | ~30-90 seconds (quick); full `npm run check` longer |

---

## Sampling Rate

- **After every task commit:** Run quick command (`catalog-uat` + `notify-v2` byte gates) + `npm run typecheck` — the output-neutrality tripwire.
- **After every plan wave (per command family):** Run `npm run check`.
- **Before `/gsd-verify-work`:** Full `npm run check` green; `catalog-uat` byte-identical against `docs/output-catalog.md`.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

| Req ID | Behavior to validate | Test Type | Automated Command | File Exists |
|--------|----------------------|-----------|-------------------|-------------|
| MOD-01 | Each command co-locates statuses/reasons/label/render map locally | typecheck-as-proof + structural | `npm run typecheck` | ✅ (typecheck) |
| MOD-02 | `notify()` takes context+rows; no central registry; drift is local compile error | typecheck-as-proof | `npm run typecheck` | ✅ |
| MOD-02 | `notify-types.test.ts` proofs deleted (D-03) | absence check | file removed; `npm run check` green | ✅ (delete file) |
| MOD-03 | Render map total over command's own statuses (missing arm = compile error, TS2741) | typecheck-as-proof | `npm run typecheck` | ✅ |
| OUT-07 | Cardinality expressed structurally (single = 1-tuple, plural = array) | typecheck-as-proof | `npm run typecheck` | ✅ |
| OUT-08 | Closed reasons set preserved; output byte-identical | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ existing (114 fixtures) |
| (all) | Zero rendered-byte change | byte-equality + grammar | `catalog-uat` + `notify-v2` + `notify-grammar-invariant` | ✅ existing |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **None new required** — existing `catalog-uat` (114 fixtures), `notify-v2` (per-status grammar mini-spec), and `notify-grammar-invariant` cover output-neutrality; `tsc --noEmit` covers MOD-03/D-10 exhaustiveness.
- [ ] **Delete** `tests/architecture/notify-types.test.ts` (D-03) — a planned removal, not a gap. The file is self-contained, runtime-inert, and nothing imports its `_V*`/`_Assert_*` aliases. Verify no other test imports them before deletion.

*Existing infrastructure covers all phase requirements; the only Wave-0-class action is the planned `notify-types.test.ts` deletion.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Catalog byte-identity vs `docs/output-catalog.md` | OUT-08 / output-neutrality | Automated, but reviewer must confirm `docs/output-catalog.md` was NOT edited this phase | `git diff docs/output-catalog.md` shows no change; `catalog-uat` green |

*All phase behaviors otherwise have automated verification (byte gates + typecheck).*

---

## Output-Neutrality Validation Strategy (core of this phase)

1. **Byte gate (catalog-uat):** 114 `(section, state)` fixtures drive `notify()` and byte-compare against `docs/output-catalog.md`; asserts exactly one `ctx.ui.notify` call per invocation. Do NOT edit `docs/output-catalog.md` this phase. If a new `notify` entry point is introduced, fixtures must drive whichever entry point produces canonical bytes (adapter keeps fixtures unchanged → lowest risk).
2. **Grammar mini-spec (notify-v2):** per-status invariant suite (icon dispatch, scope-bracket placement, reasons-brace format, soft-dep injection) — the binding per-row contract that must stay byte-identical.
3. **Typecheck-as-exhaustiveness-proof:** `npm run typecheck` enforces MOD-03/D-10 — a per-command render map missing an arm is TS2741. This replaces the deleted central `assertNever`.
4. **Grammar-invariant survives:** `notify-grammar-invariant.test.ts` (summary first-line grammar) is output-behavior coverage, unaffected by the type-model reshape.

---

## Validation Sign-Off

- [ ] All requirements have automated verify (byte-equality or typecheck-as-proof) or are the planned `notify-types.test.ts` deletion
- [ ] Sampling continuity: byte gates + typecheck run after every task commit
- [ ] Wave 0 covers the planned test deletion; no new test infra needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (set during execution once map is confirmed)

**Approval:** pending
