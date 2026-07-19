---
phase: 65
slug: force-install-update
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-27
validated: 2026-06-28
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node >= 20.19.0 (native TS strip on 22.18+) |
| **Config file** | none — glob in `package.json` `test` script |
| **Quick run command** | `node --test "tests/orchestrators/plugin/{install,update}.test.ts" "tests/edge/handlers/plugin/{install,update}.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~30 seconds (quick), ~2 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/orchestrators/plugin/{install,update}.test.ts" "tests/edge/handlers/plugin/{install,update}.test.ts"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| FORCE-01 | `install --force` on `unsupported` installs supported components, skips unsupported (state record + on-disk artefacts; no unsupported kind materialized) | integration (orchestrator) | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ |
| FORCE-01 (no-op) | `install --force` on fully-supported installs as `(installed)`, identical to non-force | integration (orchestrator) | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ |
| FORCE-01 (parse) | install handler threads `force: true` into the orchestrator options | unit (handler) | `node --test tests/edge/handlers/plugin/install.test.ts` | ✅ |
| FORCE-02 | `update --force` where the resolved candidate became `unsupported` updates by degrading the now-unsupported components | integration (orchestrator) | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ |
| FORCE-02 (parse) | update handler threads `force: true` into the orchestrator options | unit (handler) | `node --test tests/edge/handlers/plugin/update.test.ts` | ✅ |
| FORCE-03 | Without `--force`, an `unsupported` install/update still blocks (existing `requireInstallable` throw behavior holds) | integration (orchestrator) | both orchestrator tests | ✅ |
| FORCE-04 | No emitted message carries `severity: "warning"` and no rendered summary begins with `Warning:` on either force path | integration (orchestrator, notify-recorder assertion) | both orchestrator tests | ✅ |
| FORCE-05 | `--force` on `unavailable` (structural defect / NFR-10 escape / missing marketplace / unresolvable source) still blocks | integration (orchestrator) + unit (gate) | orchestrator tests + `node --test tests/domain/resolver-strict.test.ts` | ✅ |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* All target test files exist with the fixture helpers and notify-recorder harness needed; new cases are additive:

- `tests/orchestrators/plugin/install.test.ts`
- `tests/orchestrators/plugin/update.test.ts`
- `tests/edge/handlers/plugin/install.test.ts`
- `tests/edge/handlers/plugin/update.test.ts`
- `tests/domain/resolver-strict.test.ts` (gate negatives; unsupported-plugin fixture recipe proven)

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra covers all)
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

Retroactive audit: FORCE-01..05 all carry automated coverage landed during
execution (FORCE-01/02/03/04 in install/update orchestrator + handler suites,
FORCE-05 gate negatives in resolver-strict). 165 targeted tests pass across
`install`/`update` orchestrator and edge-handler suites. No new tests generated;
no implementation files touched.
