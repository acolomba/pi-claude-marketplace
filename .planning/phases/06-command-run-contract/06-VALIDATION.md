---
phase: "06"
slug: command-run-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 6 - Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Node `node:test` and `node:assert/strict` |
| Configuration | `package.json`, `tsconfig.json` |
| Quick run command | `node --test tests/shared/notification-run.test.ts tests/edge/router.test.ts tests/edge/register.test.ts` |
| Full suite command | `npm run check` |
| Estimated runtime | Not measured in this session |

## Sampling Rate

- During each task, run the changed owner's tests for feedback.
- Before each commit, run fixers and linters with `SKIP=npm-check pre-commit`.
  The commit hook runs checks for staged build inputs.
- After each combined wave and at the phase gate, run `npm run check`.
- Before final handoff, require a passing full check for the same inputs.
- Record measured feedback time during execution. Do not claim a latency
  bound until it has been measured.

## Per-Task Verification Map

Planning must replace the provisional plan/task assignments below with the
actual task IDs and threat references. The behavior and command coverage are
required even if the planner uses different task boundaries.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pending assignment | Pending | Pending | WIRE-02 | Pending | Correct command/load/hook origin and canonical names | Unit | `node --test tests/edge/router.test.ts tests/shared/notification-wire.test.ts tests/shared/notification-json.test.ts` | Yes | Pending |
| Pending assignment | Pending | Pending | WIRE-07 | Pending | Runs cannot borrow another run's identity | Unit | `node --test tests/shared/notification-run.test.ts tests/edge/register.test.ts` | Yes | Pending |
| Pending assignment | Pending | Pending | JOUT-03 | Pending | Awaited handler sees complete output with no late command emissions | Unit | `node --test tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts` | Yes | Pending |
| Pending assignment | Pending | Pending | JOUT-04 | Pending | Redacted causes, bounded delivery recovery, preserved reload need | Unit | `node --test tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notification-resolve.test.ts` | Yes | Pending |

## Wave 0 Requirements

Existing infrastructure covers the framework requirements. Extend existing
run fixtures and JSON capture helpers with deterministic invocation IDs in the
same task that introduces their production reader. No new framework is needed.

## Manual-Only Verifications

All functional behaviors have automated verification. Any intent-based
prohibitions from the planning probe remain separately identified in plans.

## Validation Sign-Off

- [ ] All tasks have automated verification or explicit Wave 0 dependencies.
- [ ] Task IDs and threat references match the final plans.
- [ ] No three consecutive tasks lack automated feedback.
- [ ] No watch-mode flags are used.
- [ ] Feedback latency is measured and recorded.
- [ ] Strict text corpus and catalog checks pass.
- [ ] Combined-tree `npm run check` passes.
- [ ] Validation audit sets `nyquist_compliant: true` only after evidence exists.

**Approval:** Pending execution and validation audit.
