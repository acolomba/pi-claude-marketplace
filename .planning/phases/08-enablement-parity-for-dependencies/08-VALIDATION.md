---
phase: "08"
slug: "enablement-parity-for-dependencies"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-19"
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node --test` (TypeScript run via `--experimental-strip-types` or equivalent, per `package.json`'s `test` script) |
| **Config file** | none — test file glob is inline in `package.json`'s `"test"` script |
| **Quick run command** | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` (and the sibling `.messaging.test.ts`, `install-cascade.test.ts` files) |
| **Full suite command** | `npm test` (covers `tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts`) |
| **Estimated runtime** | ~2-5 minutes (existing corpus; no new framework) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the file(s) touched by that task.
- **After every plan wave:** Run `npm test` plus `npm run test:coverage:direct:commit` (the CI direct-coverage gate this repo enforces on every changed production module).
- **Before `/gsd-verify-work`:** `npm run check` full suite must be green.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-* | TBD | TBD | EDEP-01 | — | `enable <plugin>` enables its declared dependencies transitively, one row each | unit/orchestrator | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ✅ | ⬜ pending |
| 08-01-* | TBD | TBD | EDEP-01 | — | Row rendering for the cascade (root + member rows) | unit/messaging | `node --test "tests/orchestrators/plugin/enable-disable.messaging.test.ts"` | ✅ | ⬜ pending |
| 08-02-* | TBD | TBD | EDEP-02 | — | `disable <plugin>` refused while a dependent declares it, names dependents + chained instruction | unit/orchestrator | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ✅ | ⬜ pending |
| 08-02-* | TBD | TBD | EDEP-02 | — | Edge-level argument parsing unaffected (still single-target) | unit/edge | `node --test "tests/edge/handlers/plugin/enable-disable.test.ts"` | ✅ | ⬜ pending |
| 08-03-* | TBD | TBD | EDEP-03 | — | Install cascade enables an already-installed disabled dependency through its record | unit/orchestrator | `node --test "tests/orchestrators/plugin/install-cascade.test.ts"` | ✅ | ⬜ pending |
| 08-03-* | TBD | TBD | EDEP-03 | — | New `{dependency enabled}` row rendering, retirement of `{already installed, dependency disabled}` | unit/messaging + architecture | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` + catalog-parser/catalog-contract tests | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* `tests/orchestrators/plugin/enable-disable.test.ts`, `enable-disable.messaging.test.ts`, `edge/handlers/plugin/enable-disable.test.ts`, `orchestrators/plugin/dependency-index.test.ts`, `domain/dependency-closure.test.ts`, and the install-cascade test siblings cover every module this phase touches. No new test file or fixture framework is required — every requirement extends an existing corresponding-test pair, which this repo's `test:corresponding` CI gate already enforces.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
