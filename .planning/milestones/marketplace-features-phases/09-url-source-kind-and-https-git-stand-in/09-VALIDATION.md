---
phase: "9"
slug: "url-source-kind-and-https-git-stand-in"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-20"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `09-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | @cucumber/cucumber 13.3.0 (behavioral); node:test (unit, `tests/architecture/`) |
| **Config file** | `cucumber.json` (`tags: "not @url and not @github"` until the last plan, then `"not @github"`) |
| **Quick run command** | `npx cucumber-js --parallel 1 <touched feature file>` plus `npm run check:commit` |
| **`@url` triage** | scratch config with `"tags": "@url"` passed through `-c` (`--tags @url` alone runs 0 scenarios) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (check), cucumber file ~10-30 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run check:commit` plus the targeted cucumber file the task touched (the hook skips cucumber)
- **After every plan wave:** `npm run check`; before the last plan also the `@url` scratch-config run
- **Before `/gsd-verify-work`:** `npm run check` green with `"tags": "not @github"`, and two random-order `npm run test:cucumber` runs
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

Filled in by the planner and executor per task. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| HOST-01 | url add clones over HTTPS from 127.0.0.1, run-time cert, log shows clone | behavioral | url-only feature file | ✅ | ✅ green |
| HOST-01 | no `NODE_TLS_REJECT_UNAUTHORIZED`, no committed key | grep | `! rg -n 'NODE_TLS_REJECT_UNAUTHORIZED\|BEGIN (EC )?PRIVATE KEY' features tests/e2e` | n/a | ✅ green |
| HOST-01 | CGI header parser | unit | `node --test tests/architecture/<parser>.test.ts` | ✅ | ✅ green |
| HOST-02 | reset empties repos, arms, log, connections, children; asserted | behavioral (every `Before`) | `npm run test:cucumber` ×2 random | ✅ | ✅ green |
| HOST-03 | 401 / 404 / 500 / 502 / 503 / drop arms | behavioral | url-only feature files | ✅ | ✅ green |
| HOST-04 | exact log table; empty log (requests and connections) | behavioral | url-only feature files | ✅ | ✅ green |
| DRV-03 | env builders: no inherited `GIT_*`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL` set | unit | `node --test tests/architecture/<env>.test.ts` | ✅ | ✅ green |
| DRV-03 / ADD-11 url | 401 fails without credential, succeeds with sandbox credential | behavioral | url-only feature file | ✅ | ✅ green |
| ADD-08 | refused forms → `unsupported source`, no request | behavioral | refused-form Outline | ✅ | ✅ green |
| ADD-09 | 404 → `source missing` | behavioral | url-only feature file | ✅ | ✅ green |
| ADD-10 | 500/502/503 → `network error` + cause; drop → `network unreachable` | behavioral | url-only feature file | ✅ | ✅ green |
| ADD-12 | remove then re-add from same source | behavioral (`@url`, `@github` block) | git-source feature file | ✅ | ✅ green |
| RM-09 / LS-05 / INFO-07 | remove / list / info make no request | behavioral (`@url`, `@github` block) | git-source feature file | ✅ | ✅ green |
| UPD-11 | update vs 5xx/404 → `network error` + frame; drop → `network unreachable` | behavioral | url-only update feature file | ✅ | ✅ green |
| SRC-01 | typed URL without `.git` cloned verbatim | behavioral | url-only feature file | ✅ | ✅ green |
| D-16 | missing `#ref` → typed failure, not `internal-error` | behavioral RED→GREEN + unit | url-only feature file + paired unit test | ✅ | ✅ green |
| D-19 | failed url add child row id corrected | behavioral RED→GREEN + unit | url-only feature file + paired unit test | ✅ | ✅ green |
| SC5 | `@url` removed from exclusion; every `@url` row passes | behavioral | `npm run test:cucumber` | ✅ | ✅ green |
| SC6 | three remove rows RED on local edit, GREEN restored | behavioral + evidence | `09-NN-RED.json` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `features/lib/` stand-in module (+ CGI parser) — HOST-01/03/04
- [x] `features/lib/` bare-repository fixture and fixture-git env — DRV-03, D-12
- [x] `tests/e2e/_rpc.ts` typed extra env; `features/lib/pi-process.ts` pass-through
- [x] `features/support/pi-process.ts` lifetime and reset assertion; per-command log window hook
- [x] `features/lib/run-tokens.ts` `{git host}`
- [x] `tests/architecture/<…>.test.ts` — parser and env builders

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A hostile system/global credential helper changes no result | DRV-03 (D-11) | No committed negative controls (CONVENTIONS) | Uncommitted edit plants a hostile `GIT_CONFIG_SYSTEM` helper in Pi's env; the 401-without-credential scenario still fails as `authentication required` with no marker; dropping `GIT_CONFIG_NOSYSTEM` makes it pass (positive control); restore. Record in SUMMARY. |
| SC6 red proof on old behavior | LAYER-07 rows | Plant is never committed | Local edit in `resolveTargetScopeMarketplace` (plant from `f78907bf` no longer loads); run the three remove `@url` rows; save `09-NN-RED.json`; restore; run green. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-21

## Validation Audit 2026-10-21

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
