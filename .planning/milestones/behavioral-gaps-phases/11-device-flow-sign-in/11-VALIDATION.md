---
phase: "11"
slug: "device-flow-sign-in"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> The roadmap sets no research step for this phase, so this strategy is drawn
> from 11-CONTEXT.md and the Phase 1 harness rather than from a RESEARCH.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral, `features/`) plus `node:test` for any product unit pair |
| **Config file** | `cucumber.json` (frozen) |
| **Quick run command** | `npx cucumber-js features/marketplace/device-flow.feature` |
| **Full suite command** | `npm run check` (its parts in order under load: `check:static`, `test:unpaired`, `test:integration`, `test:cucumber:profile -- --profile adapter --parallel 3`, `test:cucumber:profile -- --profile builtin --parallel 3`, `test:coverage:direct:all`) |
| **Estimated runtime** | ~45 seconds quick; ~10 to 15 minutes full under the shared machine's load |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js features/marketplace/device-flow.feature` and `npm run check:features`
- **After every plan wave:** Run the full suite command (its parts, each in the background with its exit code in a file)
- **Before `/gsd-verify-work`:** Full suite must be green, plus `npm run test:modules` at the phase gate
- **Max feedback latency:** 60 seconds for the quick command

---

## Per-Task Verification Map

The planner fills the task IDs. Each requirement's scenarios live in `features/marketplace/device-flow.feature`, and each scenario's red proof (it fails without the behavior it names) is recorded in its plan SUMMARY.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | DFLOW-01 | T-11-01, T-11-02, T-11-03, T-11-04 | the token lands only in the sandbox store; no request leaves the machine | cucumber (tracer) | `npx cucumber-js features/marketplace/device-flow.feature` ("3 scenarios (3 passed)"); `npm run check:features` | verb module created by the task; seed 1 exists | ⬜ pending |
| 11-01-02 | 01 | 1 | DFLOW-02 | T-11-01, T-11-03, T-11-04 | a refused sign-in keeps no credential and polls no further | cucumber | same ("5 scenarios (5 passed)"); `npm run check:features` | ✅ after 11-01-01 | ⬜ pending |
| 11-02-01 | 02 | 2 | DFLOW-04 | T-11-05, T-11-06, T-11-07, T-11-08 | the background pass prompts no one; the new Given writes only the sandbox store | cucumber (tracer) | same ("7 scenarios (7 passed)"); `npm run check:features`; `npx fallow dupes --fail-on-issues` | ✅ (seed 2 and the 11-01 module) | ⬜ pending |
| 11-02-02 | 02 | 2 | DFLOW-03 | T-11-07, T-11-08 | one authorization per install command; a cached pinned clone makes no request | cucumber | same ("9 scenarios (9 passed)"); `npm run check:features` | ✅ after 11-02-01 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements: the Phase 1 sign-in stand-in, the GitHub redirect, the git host, and their steps. The phase's own verb module `features/step_definitions/marketplace/device-flow.steps.ts` adds the credential-store steps.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
