---
phase: 67
slug: list-filters-completion-reinstall-repair
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node >= 20.19 |
| **Config file** | none — test globs live in `package.json` `test` script |
| **Quick run command** | `node --test "tests/edge/**/*.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test + test:integration) |
| **Estimated runtime** | ~60-120 seconds for `npm run check` |

Notable gates inside `npm test`:
- `tests/architecture/catalog-uat.test.ts` — byte-exact `notify()` output runner (must stay green; no render bytes change this phase).
- `tests/architecture/notify-closed-set-locks.test.ts` — closed-set tripwire; counts stay 22 STATUS_TOKENS / 17 PLUGIN_STATUSES / 7 (NO bump this phase; force tokens already added in Phase 66).

---

## Sampling Rate

- **After every task commit:** Run the targeted `tests/edge/**` or `tests/orchestrators/plugin/**` file for the touched surface.
- **After every plan wave / slice merge:** Run `npm test` (includes catalog-UAT + closed-set tripwire).
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** < 120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| RINST | reinstall-retirement | 1 | RINST-01 | — | `reinstall --force` errors as UNKNOWN flag; bare reinstall overwrites collisions + foreign content | behavior | `node --test "tests/edge/handlers/plugin/reinstall.test.ts"` | ✅ (rewrite line 216) | ⬜ pending |
| RINST | reinstall-retirement | 1 | RINST-01 | — | reinstall usage + router help drop `[--force]` | byte | `node --test "tests/edge/router.test.ts"` | ✅ (flip 87-89) | ⬜ pending |
| LIST-01 | list-filters | 1 | LIST-01 | — | `--unsupported` shows not-installed unsupported only; `--installed` spans installed + force-installed (+force-upgradable); `--unavailable` partitions cleanly | source+behavior | `node --test "tests/edge/handlers/plugin/list.test.ts" "tests/orchestrators/plugin/list.test.ts"` | ❌ W0 (new cases) | ⬜ pending |
| LIST-01 | list-filters | 1 | LIST-01 | — | usage string carries `[--unsupported]` | byte | `node --test "tests/edge/handlers/plugin/list.test.ts" "tests/edge/router.test.ts"` | ✅ | ⬜ pending |
| LIST-02 | force-completion | 2 | LIST-02 | — | `install --force <TAB>` = available + unsupported (no unavailable); `update --force <TAB>` = upgradable + force-upgradable (no plain installed) | behavior | `node --test "tests/edge/completions/provider.test.ts"` | ❌ W0 (new cases) | ⬜ pending |
| LIST-02 | force-completion | 2 | LIST-02 | — | no-`--force` completion byte-identical to today (regression); `--force` offered for install/update, NOT reinstall | behavior+byte | `node --test "tests/edge/completions/provider.test.ts"` | ✅ (flip 343) | ⬜ pending |
| D-67-02 | force-completion | 2 | LIST-02 | — | completion reuses the same classification (shared classifier; no provider-local one); edge import boundaries intact | structural | `node --test "tests/architecture/**/*.test.ts"` | ✅ | ⬜ pending |
| D-67-04 | docs-byte-lockstep | 3 | LIST-01, LIST-02, RINST-01 | — | catalog byte-equality holds; closed set unchanged (22/17/7); docs free of stale `reinstall --force` | byte | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New `--unsupported` handler + orchestrator filter tests (none exist today — `grep --unsupported` returns zero hits across `extensions/ tests/ docs/`).
- [ ] New `install --force` / `update --force` completion candidate-set tests in `tests/edge/completions/provider.test.ts`.
- [ ] Rewrite (not add) `tests/edge/handlers/plugin/reinstall.test.ts:216`, `tests/edge/completions/provider.test.ts:343` (reinstall `--force` flag case), `tests/edge/router.test.ts:87-89`.
- [ ] No new framework/fixtures needed — `withHermeticHome` + mock resolver infra already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | All phase behaviors have automated verification | — |

*All phase behaviors (filter selection, completion candidate sets, reinstall flag rejection, byte-exact usage/help) are exercised by `node:test` unit + architecture tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`--unsupported` tests, `--force` completion tests)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
