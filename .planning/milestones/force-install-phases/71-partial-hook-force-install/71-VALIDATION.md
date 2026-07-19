---
phase: 71
slug: partial-hook-force-install
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
validated: 2026-06-28
---

# Phase 71 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), `node --test`, TS via native strip |
| **Config file** | none — globs in `package.json` scripts |
| **Quick run command** | `node --test tests/domain/components/hooks.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format + test + integration) |
| **Estimated runtime** | ~60-120 seconds (full `npm run check`) |

---

## Sampling Rate

- **After every task commit:** Run `node --test <touched test file>` + `npm run typecheck`
- **After every plan wave:** Run `npm test` (unit + architecture + orchestrator + shared)
- **Before `/gsd-verify-work`:** `npm run check` must be green (adds lint/format + `test:integration`)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Derived from RESEARCH.md "Phase Requirements -> Test Map". The planner refines per-task rows.

| Requirement | Behavior to prove | Test Type | Automated Command | Covering Tests | Status |
|-------------|-------------------|-----------|-------------------|----------------|--------|
| PHOOK-01 | `partitionHooks` partitions at event + group level; clean groups survive, bad ones drop; mixed event keeps supportable groups (D-71-02) | unit | `node --test tests/domain/components/hooks.test.ts tests/architecture/hooks-supportability.test.ts` | `PHOOK-01:` partition + per-discriminant drop cases (event/group/regex/unmapped-tool/closed-set) | ✅ green |
| PHOOK-02 | Parseable-but-unsupportable hooks + supported skills -> `state==="unsupported"`, `hooksConfigPath` set, `unsupported` includes `"hooks"` | unit | `node --test tests/domain/resolver-strict.test.ts` | `PHOOK-02 / D-71-03: kept group + dropped Stop event -> unsupported` | ✅ green |
| PHOOK-03 | Invalid JSON / `type:"command"` no `command` -> `unavailable` (structural precedence, D-71-03 / D-64-07); parse success arm returns filtered subset + dropped | unit | `node --test tests/domain/components/hooks.test.ts tests/architecture/catalog-uat.test.ts` | `PHOOK-03: parseHooksConfig success arm returns the filtered subset as value plus dropped`; catalog structural-unavailable rows | ✅ green |
| PHOOK-04 | `install --force` stages a `hooks.json` that is a STRICT SUBSET — dropped event/group absent from written file; no-force blocks | integration/orchestrator | `node --test tests/orchestrators/plugin/install.test.ts tests/architecture/catalog-uat.test.ts` | `PHOOK-04: install --force stages a strict-subset hooks.json ...`; `PHOOK-04 / D-71-02: drops only the unsupportable matcher group ...`; SEV-01/SEV-02 no-force block | ✅ green |
| PHOOK-05 | list row = single `{unsupported hooks}`; info enumerates `event(matcher) (unsupported)`; byte-identical across surfaces; force degrade at info / no-force at error; failure-row parity (IN-02) | byte-exact | `node --test tests/architecture/catalog-uat.test.ts tests/shared/notify-v2.test.ts tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/{info,list,cross-surface-reason-parity,install}.test.ts` | `PHOOK-05 / D-71-04/05` marker + enumeration cases; `cross-surface-reason-parity` list/info/install agreement (incl. IN-02 typed-kind failure-row) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/fixtures/` — mixed partial-hook fixtures (Stop-only edge case; bucket-A + Stop; intra-event matcher-group mix) seeded by the orchestrator/integration suites.
- [x] `tests/domain/resolver-strict.test.ts` — non-bucket-A -> `unsupported` cases present (PHOOK-02).
- [x] No framework install needed — `node:test` already in use.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-plugin install of hookify / ralph-loop / security-guidance | PHOOK-02, PHOOK-04 | Validation-target plugins are absent from the local checkout; synthetic fixtures stand in for automated coverage | If a local checkout of `anthropics/claude-plugins-official` is added, run `/claude:plugin install <plugin> --force` and confirm supported components + filtered hooks materialize while the `Stop` handler is dropped |

*Synthetic fixtures provide automated coverage for all phase behaviors; real-plugin runs are confirmatory only.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (fixtures + resolver cases)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-28

---

## Validation Audit 2026-06-28

| Metric | Count |
|--------|-------|
| Requirements audited | 5 |
| COVERED | 5 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All PHOOK-01..05 requirements carry behavior-targeting automated tests that
run green under the default-parallel `npm run check`. No gaps required new
tests; the auditor spawn was skipped per the zero-gap path. The IN-02
failure-row parity fix (commit 46bc0757) added cross-surface regression
coverage that reinforces PHOOK-05. Honors locked decisions D-71-01..06 —
this audit only records existing coverage and adds no behavior change.
