---
phase: "04"
slug: "posttoolusefailure-hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The test map lives in 04-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (profiles `adapter`, `builtin`); `node:test` |
| **Config file** | `cucumber.json`, `package.json` scripts (both frozen) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter features/hook/tool-failure.feature` and the owner unit test with `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` (parts in order, each backgrounded with its exit code written to a file), plus `npm run test:modules` at the phase gate |
| **Estimated runtime** | quick about 2 min; full suite about 8 min |

---

## Sampling Rate

- **After every task commit:** the owner unit test and its direct coverage, the touched scenarios under the profile(s) they run in, `npm run check:features`.
- **After every plan wave:** `npm run check` parts in order (`check:static`, `test:unpaired`, `test:integration`, both cucumber profiles with `--parallel 3`, `test:coverage:direct:all`).
- **Before `/gsd-verify-work`:** full `npm run check` and `npm run test:modules` green.
- **Max feedback latency:** 180 seconds.

---

## Per-Task Verification Map

Filled by the plans; every scenario records its red proof in its plan SUMMARY (see 04-RESEARCH.md § Phase Requirements → Test Map).

| Requirement | Behavior | Test Type | Proof |
|-------------|----------|-----------|-------|
| TFAIL-01 c1 | failed `read`, failed plugin MCP call (adapter and builtin pair) | cucumber | `features/hook/tool-failure.feature` |
| TFAIL-01 c2 | literal, alternation, MCP name and server-prefix matchers; a non-selecting matcher | cucumber | `features/hook/tool-failure.feature` |
| TFAIL-01 c3 | failure runs no PostToolUse; success runs no PostToolUseFailure | cucumber | `features/hook/tool-failure.feature` |
| TFAIL-01 c4 | additionalContext, systemMessage, exit 2, decision block, updatedToolOutput ignored | cucumber + unit | `features/hook/tool-failure.feature`, `test/bridges/hooks/event-adapters.test.ts` |
| D-BG-401 | `is_interrupt: false` | unit + cucumber | `test/bridges/hooks/payloads/post-tool-use-failure.test.ts`, `test/bridges/hooks/dispatch-exec.test.ts`, `features/hook/tool-use.feature` |
| D-BG-402 | cancelled call runs no hook | unit + cucumber | `test/bridges/hooks/dispatch.test.ts`, interrupt scenario |
| D-BG-404 | adapter failure routed to PostToolUseFailure | unit + cucumber | `test/bridges/hooks/dispatch.test.ts`, `@adapter-only` scenario |

---

## Wave 0 Requirements

- [ ] `features/hook/tool-failure.feature`
- [ ] `features/step_definitions/hook/tool-failure.steps.ts`

No framework install needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
