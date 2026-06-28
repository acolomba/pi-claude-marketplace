---
phase: 71
slug: partial-hook-force-install
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
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

| Requirement | Behavior to prove | Test Type | Automated Command | File Exists | Status |
|-------------|-------------------|-----------|-------------------|-------------|--------|
| PHOOK-01 | `partitionHooks` partitions at event + group level; clean groups survive, bad ones drop; mixed event keeps supportable groups (D-71-02) | unit | `node --test tests/domain/components/hooks.test.ts` | ✅ migrate `:297-:436` | ⬜ pending |
| PHOOK-02 | Parseable-but-unsupportable hooks + supported skills -> `state==="unsupported"`, `hooksConfigPath` set, `unsupported` includes `"hooks"` | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ ADD case | ⬜ pending |
| PHOOK-03 | Invalid JSON / `type:"command"` no `command` -> `unavailable` (structural precedence, D-71-03 / D-64-07) | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ `:174-:205` KEEP | ⬜ pending |
| PHOOK-04 | `install --force` stages a `hooks.json` that is a STRICT SUBSET — dropped event/group absent from written file; no-force blocks | integration/orchestrator | `node --test tests/orchestrators/plugin/install.test.ts` + `tests/integration/hooks-*` | ✅ extend `:2941` | ⬜ pending |
| PHOOK-05 | list row = single `{unsupported hooks}`; info enumerates `event(matcher) (unsupported)`; byte-identical across surfaces; force degrade at info / no-force at error | byte-exact | `node --test tests/architecture/catalog-uat.test.ts tests/shared/notify-v2.test.ts tests/orchestrators/plugin/{info,list,cross-surface-reason-parity}.test.ts` | ✅ migrate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/` — add mixed partial-hook fixtures (Stop-only edge case; bucket-A + Stop; intra-event matcher-group mix). None exist today.
- [ ] `tests/domain/resolver-strict.test.ts` / `resolver-loose.test.ts` — add non-bucket-A -> `unsupported` cases (none today).
- [ ] No framework install needed — `node:test` already in use.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-plugin install of hookify / ralph-loop / security-guidance | PHOOK-02, PHOOK-04 | Validation-target plugins are absent from the local checkout; synthetic fixtures stand in for automated coverage | If a local checkout of `anthropics/claude-plugins-official` is added, run `/claude:plugin install <plugin> --force` and confirm supported components + filtered hooks materialize while the `Stop` handler is dropped |

*Synthetic fixtures provide automated coverage for all phase behaviors; real-plugin runs are confirmatory only.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (fixtures + resolver cases)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
