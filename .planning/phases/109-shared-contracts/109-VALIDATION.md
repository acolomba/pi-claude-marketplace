---
phase: 109
slug: shared-contracts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-29
---

# Phase 109 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property                     | Value                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| **Framework**                | Node.js built-in test runner with `node:assert/strict` and experimental direct coverage |
| **Config file**              | `package.json`; focused mapping in `scripts/test-coverage-direct.mjs`                   |
| **Quick run command**        | `node --test <owner-test-path>`                                                         |
| **Focused coverage command** | `npm run test:coverage:direct -- <production-source-path>`                              |
| **Full suite command**       | `npm run check`                                                                         |
| **Estimated runtime**        | Pair checks: seconds; full suite: several minutes                                       |

---

## Sampling Rate

- **After every task commit:** Run the owner test, then its focused direct-coverage command.
- **After every plan wave:** Re-run focused direct coverage for every pair changed in the wave.
- **After notification waves:** Run all completed P109-03, P109-04, P109-12, P109-13, and P109-14 owners together.
- **Before `$gsd-verify-work`:** Run all 19 focused pair commands separately, then `npm run check`.
- **Max feedback latency:** One focused owner run per task; no three consecutive tasks without automated verification.

`test:coverage:direct:all` is not the Phase 109 acceptance command because later milestone
pairs are intentionally still open.

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement      | Threat Ref | Secure Behavior                                                         | Test Type                             | Automated Command                                                                                    | File Exists | Status     |
| --------- | ---- | ---- | ---------------- | ---------- | ----------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 109-01-01 | 01   | 1    | MOD-02 / P109-01 | —          | Atomic replacement leaves exact JSON bytes                              | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/atomic-json.ts`             | ✅          | ⬜ pending |
| 109-02-01 | 02   | 1    | MOD-02 / P109-02 | T-109-02   | Corrupt/stale cache cannot escape schema and invalidation rules         | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/completion-cache.ts`        | ✅          | ⬜ pending |
| 109-03-01 | 03   | 1    | MOD-02 / P109-03 | —          | Hook public values stay closed and exact                                | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/concerns/hooks.ts`          | ❌ W0       | ⬜ pending |
| 109-04-01 | 04   | 1    | MOD-02 / P109-04 | —          | Soft-dependency probes produce only promised markers                    | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`       | ❌ W0       | ⬜ pending |
| 109-05-01 | 05   | 1    | MOD-02 / P109-05 | T-109-05   | Debug output is exact and environment-gated                             | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/debug-log.ts`               | ✅          | ⬜ pending |
| 109-06-01 | 06   | 1    | MOD-02 / P109-06 | —          | Bridge errors expose complete stable values                             | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors-bridges.ts`          | ✅          | ⬜ pending |
| 109-07-01 | 07   | 1    | MOD-02 / P109-07 | T-109-07   | Shared errors preserve type, fields, cause, and message contracts       | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors.ts`                  | ✅          | ⬜ pending |
| 109-08-01 | 08   | 1    | MOD-02 / P109-08 | —          | Runtime version equals the checked-in package contract                  | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/extension-version.ts`       | ❌ W0       | ⬜ pending |
| 109-09-01 | 09   | 1    | MOD-02 / P109-09 | T-109-09   | Filesystem operations preserve exact cleanup and failure effects        | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/fs-utils.ts`                | ✅          | ⬜ pending |
| 109-10-01 | 10   | 1    | MOD-02 / P109-10 | —          | Git failure classification stays closed and deterministic               | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` | ✅          | ⬜ pending |
| 109-11-01 | 11   | 1    | MOD-02 / P109-11 | —          | Marker prefixes remain byte-exact                                       | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/markers.ts`                 | ❌ W0       | ⬜ pending |
| 109-12-01 | 12   | 2    | MOD-02 / P109-12 | T-109-12   | Dispatch emits one exact notification through the owned renderer        | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify-context.ts`          | ❌ W0       | ⬜ pending |
| 109-13-01 | 13   | 1    | MOD-02 / P109-13 | —          | Reason selection is complete, ordered, and de-duplicated                | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify-reasons.ts`          | ❌ W0       | ⬜ pending |
| 109-14-01 | 14   | 3    | MOD-02 / P109-14 | T-109-14   | Notification grammar exposes exact bytes without leaking hidden data    | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify.ts`                  | ❌ W0       | ⬜ pending |
| 109-15-01 | 15   | 1    | MOD-02 / P109-15 | T-109-15   | Containment rejects traversal and symlink escape with structured errors | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/path-safety.ts`             | ✅          | ⬜ pending |
| 109-16-01 | 16   | 1    | MOD-02 / P109-16 | —          | Probe classifiers return exact public outputs                           | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/probe-classifiers.ts`       | ✅          | ⬜ pending |
| 109-17-01 | 17   | 1    | MOD-02 / P109-17 | T-109-17   | Session and PATH updates modify only extension-owned environment values | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/session-env.ts`             | ✅          | ⬜ pending |
| 109-18-01 | 18   | 1    | MOD-02 / P109-18 | —          | Scope runtime and type-level closed sets agree                          | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/types.ts`                   | ❌ W0       | ⬜ pending |
| 109-19-01 | 19   | 1    | MOD-02 / P109-19 | T-109-19   | Variable substitution is single-pass and cannot re-expand injected text | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/vars.ts`                    | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/shared/concerns/hooks.test.ts` — P109-03 mirrored owner.
- [ ] `tests/shared/concerns/soft-dep.test.ts` — P109-04 mirrored owner.
- [ ] `tests/shared/extension-version.test.ts` — P109-08 mirrored owner.
- [ ] `tests/shared/markers.test.ts` — P109-11 mirrored owner.
- [ ] `tests/shared/notify-context.test.ts` — P109-12 mirrored owner.
- [ ] `tests/shared/notify-reasons.test.ts` — P109-13 mirrored owner.
- [ ] `tests/shared/notify.test.ts` — P109-14 mirrored owner and legacy-suite consolidation target.
- [ ] `tests/shared/types.test.ts` — P109-18 mirrored owner.

Existing infrastructure covers all framework and script requirements. Each owning plan creates
its missing mirror before executing that pair's direct-coverage gate.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have automated verification or an owning Wave 0 file-creation dependency.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing owner-test references.
- [ ] No watch-mode flags.
- [ ] Every runtime data row uses separate lowercase arrange, act, and assert phases.
- [ ] Every pair reaches 100 percent direct function, line, and branch coverage.
- [ ] `nyquist_compliant: true` is set in frontmatter after validation.

**Approval:** pending
