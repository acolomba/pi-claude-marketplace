---
phase: "02"
slug: "containment-and-input-safety"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-05"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Node built-in test runner with `node:test` and `node:assert/strict`                                                                                                                                                                                                                                                        |
| **Config file**        | none — repository scripts invoke `node --test` directly                                                                                                                                                                                                                                                                    |
| **Quick run command**  | `node --test tests/bridges/mcp/types.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts tests/shared/path-safety.test.ts tests/orchestrators/plugin/info.test.ts tests/bridges/commands/stage.test.ts tests/persistence/locations.test.ts tests/index.test.ts tests/orchestrators/discover.test.ts` |
| **Full suite command** | `npm test && npm run test:integration`                                                                                                                                                                                                                                                                                     |
| **Repository gate**    | `npm run check`                                                                                                                                                                                                                                                                                                            |
| **Measured runtime**   | focused owners 5.83 seconds; unit suite 37.23 seconds on clean retry; integration suite 11.24 seconds                                                                                                                                                                                                                      |

All filesystem cases use a case-owned temporary root. No validation reads or
writes the developer's real home or Pi directories or uses network access. The
aggregate-recovery case is the sole built-in patch: it is explicitly
non-concurrent, targets only the exact case-owned project skills path, proves
the real aggregation operation was reached, and restores plus re-synchronizes
the built-in both before same-callback recovery and in `t.after()`.

---

## Sampling Rate

- **After every task commit:** Run the direct owner test named by that task.
- **After every plan wave:** Run all tests for the source-test pairs changed in that wave, plus `npm run typecheck`.
- **Before `$gsd-verify-work`:** Run direct coverage for every changed pair, then run `npm run check`.
- **Max feedback latency:** 30 seconds for focused owner tests.

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement | Threat Ref        | Secure Behavior                                                                                                                                                                                                          | Test Type                            | Automated Command                                                                                                              | File Exists | Status   |
| -------- | ----- | ---- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------- |
| 02-01-01 | 02-01 | 1    | PDEF-03     | T-02-01           | Parsed `mcpServers` remains `unknown` until one shared stage/unstage classifier accepts an object map                                                                                                                    | type + unit                          | `node --test tests/bridges/mcp/types.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts`                | ✅          | ✅ green |
| 02-01-02 | 02-01 | 1    | PDEF-03     | T-02-01           | Present null, string, array, boolean, and number values fail closed with an exact typed outcome and unchanged configuration bytes; absence remains a no-op                                                               | unit + filesystem                    | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts`                                                | ✅          | ✅ green |
| 02-02-01 | 02-02 | 2    | PDEF-02     | T-02-02 / T-02-03 | Raw `..` traversal returns exact LexicalTraversalError with honest message/normalized fields and unchanged outside state; source review pins the pre-normalization/pre-filesystem ordering; contained paths remain valid | unit + real filesystem + code review | `node --test tests/shared/path-safety.test.ts`                                                                                 | ✅          | ✅ green |
| 02-02-02 | 02-02 | 2    | PDEF-02     | T-02-02 / T-02-03 | Lenient plugin-info and affected manifest/state consumers cannot read or mutate outside the owning root                                                                                                                  | unit + consumer                      | `node --test tests/orchestrators/plugin/info.test.ts tests/bridges/commands/stage.test.ts tests/persistence/locations.test.ts` | ✅          | ✅ green |
| 02-03-01 | 02-03 | 3    | PDEF-04     | T-02-04 / T-02-05 | Discovery failure returns exact empty paths after completed reconcile/PATH work, every skipped-scope notification is attempted, and a second invocation recovers                                                         | unit + lifecycle                     | `node --test tests/index.test.ts tests/orchestrators/discover.test.ts`                                                         | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing test infrastructure and all direct owner files already exist. The
planned tasks add the missing cases in place; no framework, fixture, or stub
must be created before Wave 1.

## Final Hard Gate

| Command                                    | Result                                                      |
| ------------------------------------------ | ----------------------------------------------------------- |
| Phase 2 focused matrix                     | ✅ 257 passed, 0 failed, 0 skipped, 0 todo                  |
| Nine direct source-owner coverage commands | ✅ each source passed 100% lines, branches, and functions   |
| `npm test`                                 | ✅ 5,244 passed, 0 failed, 0 skipped, 0 todo on clean retry |
| `npm run test:integration`                 | ✅ 31 passed, 0 failed, 0 skipped, 0 todo                   |
| TypeScript, ESLint, and Fallow gates       | ✅ passed during final independent code review              |
| Scoped Prettier for all 13 reviewed files  | ✅ passed                                                   |

The first full unit run had one unrelated load-sensitive readiness timeout in
`tests/orchestrators/plugin/uninstall.test.ts`. The exact case passed alone in
0.43 seconds, and the complete suite then passed 5,244/5,244 on a clean retry.
The repository-wide `npm run check` wrapper still stops when Prettier sees the
user-owned untracked `.mcp.json`; that protected file is outside this phase and
was not modified or staged. All tracked Phase 2 files pass scoped formatting,
and every other configured gate completed successfully.

## Validation Audit 2026-09-05

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

---

## Manual-Only Verifications

All Phase 2 behaviors have automated verification. No manual-only check is
required.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 seconds for focused checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** all Phase 2 requirements have current automated verification; no manual-only gap remains.
