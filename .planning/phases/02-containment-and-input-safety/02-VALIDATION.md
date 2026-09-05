---
phase: "02"
slug: "containment-and-input-safety"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-05"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Node built-in test runner with `node:test` and `node:assert/strict`                                                                  |
| **Config file**        | none — repository scripts invoke `node --test` directly                                                                              |
| **Quick run command**  | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts tests/shared/path-safety.test.ts tests/index.test.ts` |
| **Full suite command** | `npm run check`                                                                                                                      |
| **Estimated runtime**  | focused owners under 30 seconds; full suite about 4 minutes from the Phase 1 measurement                                             |

All filesystem cases use a case-owned temporary root. No validation may read
or write the developer's real home or Pi directories, use network access, or
patch process-global filesystem or builtin-module behavior.

---

## Sampling Rate

- **After every task commit:** Run the direct owner test named by that task.
- **After every plan wave:** Run all tests for the source-test pairs changed in that wave, plus `npm run typecheck`.
- **Before `$gsd-verify-work`:** Run direct coverage for every changed pair, then run `npm run check`.
- **Max feedback latency:** 30 seconds for focused owner tests.

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement | Threat Ref        | Secure Behavior                                                                                                                                                  | Test Type              | Automated Command                                                                                                              | File Exists | Status     |
| -------- | ----- | ---- | ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 02-01-01 | 02-01 | 1    | PDEF-03     | T-02-01           | Parsed `mcpServers` remains `unknown` until one shared stage/unstage classifier accepts an object map                                                            | type + unit            | `node --test tests/bridges/mcp/types.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts`                | ✅          | ⬜ pending |
| 02-01-02 | 02-01 | 1    | PDEF-03     | T-02-01           | Present null, string, and array values fail closed with an exact typed outcome and unchanged configuration bytes; absence remains a no-op                        | unit + filesystem      | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts`                                                | ✅          | ⬜ pending |
| 02-02-01 | 02-02 | 2    | PDEF-02     | T-02-02 / T-02-03 | Normalized outside-root and existing symlink-component paths are rejected before I/O while contained absolute paths remain valid                                 | unit + real filesystem | `node --test tests/shared/path-safety.test.ts`                                                                                 | ✅          | ⬜ pending |
| 02-02-02 | 02-02 | 2    | PDEF-02     | T-02-02 / T-02-03 | Lenient plugin-info and affected manifest/state consumers cannot read or mutate outside the owning root                                                          | unit + consumer        | `node --test tests/orchestrators/plugin/info.test.ts tests/bridges/commands/stage.test.ts tests/persistence/locations.test.ts` | ✅          | ⬜ pending |
| 02-03-01 | 02-03 | 3    | PDEF-04     | T-02-04 / T-02-05 | Discovery failure returns exact empty paths after completed reconcile/PATH work, every skipped-scope notification is attempted, and a second invocation recovers | unit + lifecycle       | `node --test tests/index.test.ts tests/orchestrators/discover.test.ts`                                                         | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing test infrastructure and all direct owner files already exist. The
planned tasks add the missing cases in place; no framework, fixture, or stub
must be created before Wave 1.

---

## Manual-Only Verifications

All Phase 2 behaviors have automated verification. No manual-only check is
required.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 seconds for focused checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending plan verification and execution evidence.
