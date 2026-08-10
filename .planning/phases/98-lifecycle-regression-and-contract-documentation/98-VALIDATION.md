---
phase: 98
slug: lifecycle-regression-and-contract-documentation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-09
---

# Phase 98 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS run natively) |
| **Config file** | package.json scripts (no separate config) |
| **Quick run command** | `node --test <touched-suite>.test.ts` |
| **Full suite command** | `PI_SUBAGENTS_ROOT=~/.pi/agent/npm/node_modules/pi-subagents npm run check` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test <touched-suite>.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-1 tracer: shared signals + orphan-rewake threading | 98-01 | 1 | IN-07 | T-98-01, T-98-02 | The shared interface lives in the module both orchestrators already import, so no ESM initialization cycle is introduced | unit | `node --test tests/orchestrators/reconcile/notify.test.ts && npm run typecheck` | ✅ extend | ✅ green |
| 01-2 standalone enable dependency derivation | 98-01 | 1 | WR-06 | T-98-03 | Only staged-name array LENGTHS are read; the names never reach a rendered row | unit + architecture | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/architecture/catalog-uat.test.ts && npm run lint` | ✅ extend | ✅ green |
| 01-3 reconcile enable dependency projection | 98-01 | 1 | WR-06 | T-98-03 | Same length-only read across the orchestrated boundary | unit + architecture | `node --test tests/orchestrators/reconcile/notify.test.ts "tests/architecture/*.test.ts" && npm run typecheck` | ✅ extend | ✅ green |
| 02-1 seed factory gains the fifth resource kind | 98-02 | 1 | LIFE-04 | T-98-04 | The hooks seed writes only inside the scoped locations bundle | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts && npm run typecheck` | ✅ extend | ✅ green |
| 02-2 five isolated per-kind uninstall cases | 98-02 | 1 | LIFE-04 | T-98-04, T-98-05 | Removal is confined to the plugin's own paths; an unrelated MCP server key survives | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ extend | ✅ green |
| 02-3 empty-resources manifest-absent case | 98-02 | 1 | LIFE-04 | T-98-06 | Hermetic home plus temp-dir teardown; no process-global mutation | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts && npm run lint` | ✅ extend | ✅ green |
| 03-1 tracer: stale-gate enable remediation trailer | 98-03 | 2 | WR-02 | T-98-07, T-98-08 | Frozen trailer constant, no interpolation; an unrelated failed row is asserted byte-identical | unit + architecture | `node --test tests/orchestrators/plugin/enable-disable.test.ts "tests/architecture/*.test.ts"` | ✅ extend | ✅ green |
| 03-2 disabled records reach the update short-circuit | 98-03 | 2 | WR-04 | T-98-09 | The widened gate applies only to disabled records, which stage nothing; the five resources arrays are asserted empty | unit + architecture | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/edge-deps.test.ts tests/orchestrators/plugin/plugin-state-classifier.test.ts "tests/architecture/*.test.ts"` | ✅ extend | ✅ green |
| 04-1 extract the source-scanning helper | 98-04 | 3 | COMPAT-01 | T-98-10 | Reads go through the Node filesystem API; no subprocess can silently skip a file | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts && npm run typecheck` | ❌ new (`tests/helpers/source-scan.ts`) | ✅ green |
| 04-2 author the no-expansion gate | 98-04 | 3 | COMPAT-01 | T-98-11, T-98-12, T-98-13 | Hand-written literal pins plus a mandatory mutation check prove the gate can fail | architecture | `node --test "tests/architecture/*.test.ts" && npm run typecheck && npm run lint` | ❌ new (`tests/architecture/compat-01-no-expansion.test.ts`) | ✅ green |
| 05-1 marketplace-bulk and global-bulk update skip | 98-05 | 3 | LIFE-05 | T-98-15 | The rendered reason is a closed-set literal; no manifest content is echoed | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ extend | ✅ green |
| 05-2 autoupdate cascade mapper re-narrowing | 98-05 | 3 | LIFE-06 | T-98-15 | Same closed-set literal across the cascade boundary | unit | `node --test tests/orchestrators/marketplace/update.test.ts` | ✅ extend | ✅ green |
| 05-3 autoupdate end-to-end origin | 98-05 | 3 | LIFE-06 | T-98-14, T-98-16 | User scope plus hermetic home; the process working directory is never changed | unit | `node --test tests/orchestrators/marketplace/update.test.ts && npm run typecheck` | ✅ extend | ✅ green |
| 06-1 output-catalog accuracy sweep | 98-06 | 4 | DOC-08 | T-98-17, T-98-18 | No edit inside an annotated fenced block; the byte-equality gate re-runs | architecture | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/partial-vocabulary-guard.test.ts` | ✅ existing | ✅ green |
| 06-2 design-document sweep and flowchart redraw | 98-06 | 4 | DOC-08 | T-98-17, T-98-19 | Defects corrected in place, never deleted; retired vocabulary stays out | architecture | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ existing | ✅ green |
| 06-3 source-comment sweep and phase gate | 98-06 | 4 | DOC-08 | T-98-17 | Comment-only diff under `extensions/`; full check green | full suite | `npm run check` | ✅ existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Two new test-side files must exist before their gate can run; both are created inside plan 98-04
(wave 3), which is the first plan that needs them, so no separate wave-0 pass is required.

- [ ] `tests/helpers/source-scan.ts` — the shared source-scanning helper (created in 98-04 task 1; the existing orchestrator-network gate is refactored onto it in the same task)
- [ ] `tests/architecture/compat-01-no-expansion.test.ts` — the COMPAT-01 gate file (created in 98-04 task 2)
- [ ] `seedFullPlugin` in `tests/orchestrators/plugin/uninstall.test.ts` — extended with the fifth resource kind (98-02 task 1) before the per-kind cases can assert against it
- [ ] `PLUGIN_INSTALL_RECORD_SCHEMA` exported from `extensions/pi-claude-marketplace/persistence/state-io.ts` (98-04 task 2) before the record-key-set clause can read it
- [ ] The marketplace suite's path-marketplace seed helper — widened with optional scope, autoupdate, and plugin-record options (98-05 task 3) before the end-to-end autoupdate case can seed a user-scope fixture

No test framework or dependency install is required. Every other requirement is covered by
existing infrastructure.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The COMPAT-01 gate genuinely fails when a closed set grows | COMPAT-01 | A gate that asserts a tautology passes every automated run; only a deliberate mutation proves it has teeth | Append one member to the status-token tuple in `shared/notify.ts`, run `node --test tests/architecture/compat-01-no-expansion.test.ts`, confirm it FAILS, revert, confirm it passes. Record both observations in the 98-04 summary. |
| The redrawn decision flowchart reads correctly as a diagram | DOC-08 | Diagram legibility and edge correctness are judgment calls no test makes | Render the design document and read the diagram against the current lookup path in `orchestrators/plugin/list.ts`; confirm every branch has a destination and no retired branch survives. |

---

## Test-Environment Facts

- Export the companion-package root before any full-suite run — two integration cases resolve the
  peer through it and fail locally against a stale or missing global install:
  `PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check`
- Capture exit codes directly; never pipe a test command, which masks the code.
- Fixtures for the end-to-end autoupdate case must use user scope plus the suite's hermetic-home
  helper — the single-plugin update reads the process working directory itself, and changing that
  setting is unsafe under concurrent test execution.
- Harness IDE diagnostics on TypeScript files are stale noise here; trust `npm run typecheck`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-10 — full suite exit 0 with `PI_SUBAGENTS_ROOT` set; verifier independently re-ran all owning suites; COMPAT-01 mutation check recorded in the 98-04 summary; flowchart reviewed across three review iterations without a finding

---

## Validation Audit 2026-08-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 17 task rows COVERED: every automated command is a subset of `npm run
check`, green after the review fix loop (3386 unit + 18 integration, exit 0).
The fix loop added coverage beyond the strategy: the WR-10 disabled-record
autoupdate end-to-end case, the WR-11 type-completeness pin, the source-scan
ENOENT fail-loud test file, and the reinstall degraded/clean byte pins.
