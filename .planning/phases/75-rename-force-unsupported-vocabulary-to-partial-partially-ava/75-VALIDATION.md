---
phase: 75
slug: rename-force-unsupported-vocabulary-to-partial-partially-ava
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node >=20.19) |
| **Config file** | none |
| **Quick run command** | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/partial-vocabulary-guard.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + node --test) |
| **Estimated runtime** | quick ~5s · full ~1-2 min |

---

## Sampling Rate

- **After every task commit:** Run the quick command (byte-equality catalog UAT + closed-set length locks + — once it exists — the grep-absence guard)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite (`npm run check`) must be green
- **Max feedback latency:** ~5 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 75-01-01 | 01 | 1 | RVOC-01 | T-75-01 | `--force`/`--unsupported` → `--partial`; overwrite-`force` untouched | unit | `node --test tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/list.test.ts tests/edge/handlers/plugin/reinstall.test.ts tests/edge/completions/provider.test.ts tests/edge/completions/data.test.ts tests/edge/router.test.ts` | ✅ | ⬜ pending |
| 75-01-02 | 01 | 1 | RVOC-01 | T-75-02 | degrade plumbing → `partial`; component-level `unsupported` untouched | full | `npm run check` | ✅ | ⬜ pending |
| 75-02-01 | 02 | 2 | RVOC-02, RVOC-03 | T-75-03 / T-75-04 | status/state literals + cache v3→v4 renamed; render bytes UNCHANGED (byte-invisible) | full | `npm run check` | ✅ | ⬜ pending |
| 75-02-02 | 02 | 2 | RVOC-02 | T-75-05 | render strings + trailer bodies flipped atomic with catalog + fixtures | byte-equality | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/shared/notify-v2.test.ts && npm run check` | ✅ | ⬜ pending |
| 75-02-03 | 02 | 2 | RVOC-04 | T-75-03 | grep absence/presence guard (surgical-completeness) + CHANGELOG | architecture guard | `node --test tests/architecture/partial-vocabulary-guard.test.ts && npm run check` | ❌ W0 (created by this task) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Rename buckets → gates: catalog-uat byte-equality for render tokens/glyphs/hint-trailers (75-02-02);
closed-set length locks for token-set integrity, unchanged 23/18/32/7 (75-02-01/02); resolver-\*/
classifier tests for the verdict + force-state literal rename (75-02-01); completions/handler tests
for `--force`→`--partial` + degrade plumbing (75-01); completion-cache round-trip for the v3→v4
drop-rebuild (75-02-01); the new grep-absence guard as the surgical-completeness criterion (75-02-03).*

---

## Wave 0 Requirements

- [ ] New architecture test `tests/architecture/partial-vocabulary-guard.test.ts` (grep-based absence/presence guard) — created by task **75-02-03** and lands **in** the rename commit asserting the post-state (cannot be green on the current tree), per RESEARCH.md § "NEW test to add".

*This rename is length-preserving; the existing closed-set length locks (23/18/32/7) stay green with no count bump. Existing infrastructure otherwise covers all rename buckets — no other Wave 0 scaffolding required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification: the byte-equality catalog UAT covers every
user-visible token change, the closed-set locks cover token-set integrity, the completion-cache
round-trip covers the persisted migration, and the new grep-absence guard machine-enforces the
surgical-completeness criterion. No manual-only verification is required.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the grep-absence guard, created in 75-02-03)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
