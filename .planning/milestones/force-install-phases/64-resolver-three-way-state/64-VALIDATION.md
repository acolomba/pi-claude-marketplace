---
phase: 64
slug: resolver-three-way-state
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-26
validated: 2026-06-28
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. This is a
> type-safety-critical refactor: the type system (`tsc --noEmit`) is itself a
> load-bearing test. NFR-7 compile-enforcement is verified by `@ts-expect-error`
> assertions, not just runtime tests.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (bundled) + `tsc --noEmit` (NFR-7 type gate) |
| **Config file** | none (Node native test runner); `tsconfig.json` for typecheck |
| **Quick run command** | `npm run typecheck && node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/domain/resolver.types.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` (NFR-7 must stay green) + `node --test tests/domain/resolver-*.test.ts tests/domain/resolver.types.test.ts`
- **After every plan wave:** Run `npm test` (full unit suite — consumer surfaces in `list` / `info` / `edge-deps`)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| RSTATE-01 | `resolve` returns one of three `state` values (`installable` / `unsupported` / `unavailable`) | unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ✅ COVERED — 43 strict + 25 loose `r.state` assertions |
| RSTATE-02 | structural defect + unsupported kind → `unavailable` (structural precedence, D-64-07) | unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ✅ COVERED — precedence fixtures (resolver-strict.test.ts:665, resolver-loose.test.ts:325) |
| RSTATE-03 | `unavailable.pluginRoot` is a compile error (NFR-7); `unsupported.pluginRoot` readable | type | `npm run typecheck` (`tests/domain/resolver.types.test.ts`) | ✅ COVERED — `@ts-expect-error` on `unavailable.pluginRoot` + positive reads on installable/unsupported |
| RSTATE-04 | `requireInstallable` throws on `unsupported` + `unavailable`; `requireForceInstallable` admits `unsupported`, throws on `unavailable` | unit + type | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` + `npm run typecheck` | ✅ COVERED — `requireForceInstallable` admit/throw tests (strict:686-727, loose:350-375) + `@ts-expect-error` narrowing (types:84) |
| RSTATE-05 | per-kind unsupported-component markers render identically across `list` / `info` and all force states | unit | `node --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | ✅ COVERED — cross-surface parity + structural-stays-on-notes guard (cross-surface-reason-parity.test.ts:75-139) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Test-assertion migration map (the false-assertion split)

Every existing `assert.equal(r.installable, false)` must become either
`assert.equal(r.state, "unavailable")` or `assert.equal(r.state, "unsupported")`:

| Existing test (file:line) | New `state` |
|---------------------------|-------------|
| resolver-strict source kind github/url (79, 92) | `unavailable` |
| resolver-strict path escape (99) | `unavailable` |
| resolver-strict dir missing (109) | `unavailable` |
| resolver-strict malformed plugin.json (122) | `unavailable` |
| resolver-strict hooks parse-fail / shape mismatch (182, 201) | `unavailable` |
| resolver-strict malformed mcpServers (466) | `unavailable` |
| resolver-strict component-path failures (476, 486, 500, 510) | `unavailable` |
| resolver-strict unsupported default locations (439) | `unsupported` |
| resolver-strict experimental themes/monitors (458) | `unsupported` |
| resolver-strict multiple unsupported components (527) | `unsupported` |
| resolver-loose manifest conflict (94) | `unavailable` |
| resolver-loose mcp conflict / standalone .mcp.json (131, 145) | `unavailable` |
| resolver-loose hooks parse-fail (209) | `unavailable` |
| resolver-loose entry unsupported component (173) | `unsupported` |
| resolver-loose unsupported default locations (253) | `unsupported` |

All `assert.equal(r.installable, true)` → `assert.equal(r.state, "installable")`;
all `if (r.installable)` guards → `if (r.state === "installable")`.

---

## Wave 0 Requirements

- [x] `tests/domain/resolver.types.test.ts` — rewritten for three arms: positive `pluginRoot` read on `installable` + `unsupported`; `@ts-expect-error` negative on `unavailable`; `requireForceInstallable` rejects `unavailable` (covers RSTATE-03, RSTATE-04)
- [x] `tests/domain/resolver-strict.test.ts` — RSTATE-02 both-defects precedence fixture (malformed manifest + unsupported kind → `unavailable`) + `requireForceInstallable` narrow/throw tests landed in execution
- [x] `tests/domain/resolver-loose.test.ts` — `requireForceInstallable` + precedence additions for loose mode landed in execution
- [x] Framework install: none — existing `node:test` + `tsc` infrastructure covers all phase requirements

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | All phase behaviors have automated verification (runtime `node:test` + compile-time `tsc --noEmit`). |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (precedence fixture, `requireForceInstallable` tests, three-arm type test)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-28

## Validation Audit 2026-06-28

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Retroactive audit: all five RSTATE requirements (RSTATE-01..05) carry automated
coverage that landed during phase execution — the draft's three Wave 0 gaps
(RSTATE-02 precedence fixture, `requireForceInstallable` tests, three-arm type
test) were all filled. `npm run typecheck` green; 66 targeted tests pass
(resolver-strict, resolver-loose, resolver.types, cross-surface-reason-parity).
No new tests generated; no implementation files touched.
