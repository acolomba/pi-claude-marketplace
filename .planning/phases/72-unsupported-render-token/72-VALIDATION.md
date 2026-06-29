---
phase: 72
slug: unsupported-render-token
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-28
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — `node --test` strips TS natively |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

All Phase 72 behavior is observable via the existing typed-union, closed-set
invariant, and byte-exact catalog/golden test infrastructure. Existing
infrastructure covers all phase requirements — no new framework needed.

| Requirement | Secure/Correct Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|-------------------------|-----------|-------------------|-------------|--------|
| USTAT-01 | not-installed resolver `unsupported` row renders `⊖`/`(unsupported)`; structural `unavailable` keeps `⊘`/`(unavailable)` in both `list` and `info` | unit + catalog byte-equality | `npm test` | ✅ (catalog UAT, notify render tests) | ⬜ pending |
| USTAT-01 | render split follows resolver STATE, never the reason brace (LSP-only + hooks-only both flip to `unsupported`) | unit | `npm test` | ✅ (resolver-state→glyph mapping tests) | ⬜ pending |
| USTAT-02 | `STATUS_TOKENS` 22→23 and `PLUGIN_STATUSES` 17→18 closed-set tripwire bumps; `REASONS` stays 32 | architecture invariant | `npm test -- tests/architecture/notify-closed-set-locks.test.ts` | ✅ `tests/architecture/notify-closed-set-locks.test.ts` | ⬜ pending |
| USTAT-02 | per-kind `{unsupported hooks}` / `{lsp}` braces still render on the new `(unsupported)` row | unit + catalog | `npm test` | ✅ | ⬜ pending |
| USTAT-02 | `--unsupported` / `--unavailable` filters keep partitioning on the pre-collapse bucket (regression) | unit | `npm test` | ✅ (list filter tests) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The new
`PluginUnsupportedMessage` variant is exercised through the same closed-set
invariant test and `list`/`info` catalog/golden fixtures that already lock the
`force-installed` (`◉`) variant added in Phase 66 — the worked precedent.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-marketplace visual confirmation | USTAT-01 | Live `/claude:plugin list` against the official marketplace renders `⊖ hookify (unsupported)` and `⊖ clangd-lsp v1.0.0 (unsupported) {lsp}` | After `/reload`, run `/claude:plugin list --unsupported` and confirm the `⊖` glyph + `(unsupported)` token |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (notify-v2 `⊖` arm + tools projection test, both created in the foundation task)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-28
