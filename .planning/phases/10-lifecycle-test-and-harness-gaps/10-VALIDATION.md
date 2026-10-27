---
phase: "10"
slug: "lifecycle-test-and-harness-gaps"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-27"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test`, Cucumber, direct coverage |
| **Config file** | `package.json`, `cucumber.json` |
| **Quick run command** | `node --test <owner-test>` or `npx cucumber-js --name '<scenario>'` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~600 seconds |

## Sampling Rate

- **After every task commit:** Run the named owner test or scenario and direct coverage for changed source pairs.
- **After every plan wave:** Run every touched feature and source/test pair; run `npm run check:features` after shared Cucumber changes.
- **Before `$gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** 120 seconds for focused checks.

## Per-Task Verification Map

The planner must give every task an exact owner-test or scenario command and an observable failing direction. Each requirement is covered by at least one automated task:

| Requirement | Primary automated proof |
|-------------|-------------------------|
| TST-01 | Named Cucumber scenarios or discriminating unit cases with a recorded harness limit |
| TST-02 | Harness owner tests plus `npm run check:features` |
| TST-03 | Install/reinstall owner tests for a record-plus-manifest seeder |
| CAS-08 | Three named install-dependency scenarios plus direct coverage |
| MIM-05 | Apply partial-rollback scenario plus direct coverage |
| XPH-01 | TUI, completion, reinstall, reconcile, and import scenarios |
| XPH-02 | A named scenario for each user-visible correction and focused unit parity cases |

## Wave 0 Requirements

- [ ] PTY TUI driver and world lifecycle support.
- [ ] Completion capture step/API.
- [ ] Shared marketplace-record seeder for unit fixtures.
- [ ] Test fixtures selecting each CAS-08 failure route.

## Manual-Only Verifications

None planned. Any unreachable behavior must carry a concrete harness-limit reason and a discriminating unit case.

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or explicit Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Focused feedback latency stays below 120 seconds.
- [ ] `nyquist_compliant: true` is set after execution evidence is complete.

**Approval:** pending
