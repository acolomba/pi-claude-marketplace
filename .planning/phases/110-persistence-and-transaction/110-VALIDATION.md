---
phase: 110
slug: persistence-and-transaction
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-29
---

# Phase 110 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                               |
| ---------------------- | --------------------------------------------------- |
| **Framework**          | Node.js built-in test runner                        |
| **Config file**        | None — scripts are defined in `package.json`        |
| **Quick run command**  | `npm run test:coverage:direct -- <owner-test-path>` |
| **Full suite command** | `npm run check`                                     |
| **Estimated runtime**  | ~30 seconds focused; ~90 seconds full               |

---

## Sampling Rate

- **After every task commit:** Run the pair's focused direct-coverage command.
- **After every plan wave:** Run `npm test` and the focused commands for all pairs in that wave.
- **Before `$gsd-verify-work`:** Run all 12 focused commands, `npm run test:corresponding`, and `npm run check`.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement | Threat Ref                                                                     | Secure Behavior                                                                    | Test Type                                                                                       | Automated Command                                                               | File Exists | Status     |
| --------- | ---- | ---- | ----------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------- | ---------- |
| 110-01-01 | 01   | 2    | MOD-03      | T110-01                                                                        | Rejects corrupt envelopes while isolating corrupt rows and preserving atomic bytes | unit + filesystem                                                                               | `npm run test:coverage:direct -- tests/persistence/agents-index-io.test.ts`     | ✅          | ⬜ pending |
| 110-02-01 | 02   | 1    | MOD-03      | T110-02                                                                        | Accepts only the version-1 agents-index schema and complete row shape              | unit                                                                                            | `npm run test:coverage:direct -- tests/persistence/agents-index-schema.test.ts` | ✅          | ⬜ pending |
| 110-03-01 | 03   | 2    | MOD-03      | T110-03                                                                        | Distinguishes absent and invalid input, validates saves, and enforces containment  | unit + filesystem                                                                               | `npm run test:coverage:direct -- tests/persistence/config-io.test.ts`           | ✅          | ⬜ pending |
| 110-04-01 | 04   | 3    | MOD-03      | T110-04                                                                        | Preserves whole-entry replacement and exact provenance across both files           | unit + filesystem                                                                               | `npm run test:coverage:direct -- tests/persistence/config-merge.test.ts`        | ✅          | ⬜ pending |
| 110-05-01 | 05   | 2    | MOD-03      | T110-05                                                                        | Applies cascade and batch updates to one validated physical document               | unit + filesystem                                                                               | `npm run test:coverage:direct -- tests/persistence/config-write-back.test.ts`   | ✅          | ⬜ pending |
| 110-06-01 | 06   | 1    | MOD-03      | Rejects unsafe derived names and keeps every path inside its scope root        | unit + filesystem                                                                  | `npm run test:coverage:direct -- tests/persistence/locations.test.ts`                           | ✅                                                                              | ⬜ pending  |
| 110-07-01 | 07   | 3    | MOD-03      | Writes only eligible first-run projections and makes replay an exact no-op     | unit + filesystem                                                                  | `npm run typecheck && npm run test:coverage:direct -- tests/persistence/migrate-config.test.ts` | ✅                                                                              | ⬜ pending  |
| 110-08-01 | 08   | 2    | MOD-03      | Filters invalid legacy rows and preserves best-effort persistence warnings     | unit + filesystem                                                                  | `npm run typecheck && npm run test:coverage:direct -- tests/persistence/migrate.test.ts`        | ✅                                                                              | ⬜ pending  |
| 110-09-01 | 09   | 3    | MOD-03      | Validates and normalizes stored state before atomic persistence                | unit + filesystem                                                                  | `npm run typecheck && npm run test:coverage:direct -- tests/persistence/state-io.test.ts`       | ✅                                                                              | ⬜ pending  |
| 110-10-01 | 10   | 2    | MOD-03      | Compensates every failure position newest-first without losing causes or leaks | unit                                                                               | `npm run test:coverage:direct -- tests/transaction/phase-ledger.test.ts`                        | ✅                                                                              | ⬜ pending  |
| 110-11-01 | 11   | 1    | MOD-03      | Preserves path-containment identity and structured rollback partials           | unit                                                                               | `npm run test:coverage:direct -- tests/transaction/rollback.test.ts`                            | ✅                                                                              | ⬜ pending  |
| 110-12-01 | 12   | 3    | MOD-03      | Holds one case-local lock across load, mutation, save, release, and retry      | unit + filesystem                                                                  | `npm run test:coverage:direct -- tests/transaction/with-state-guard.test.ts`                    | ✅                                                                              | ⬜ pending  |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All 12 owner files and the direct-coverage runner exist.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have an automated verification command.
- [x] Sampling continuity has no three consecutive tasks without automated verification.
- [x] Wave 0 has no missing test references.
- [x] Commands contain no watch-mode flags.
- [x] Expected feedback latency is less than 90 seconds.
- [ ] `nyquist_compliant: true` is set after execution evidence is complete.

**Approval:** pending
