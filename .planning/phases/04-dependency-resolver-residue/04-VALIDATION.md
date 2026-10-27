---
phase: "04"
slug: "dependency-resolver-residue"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| **Config file** | `package.json` scripts, `cucumber.json` |
| **Quick run command** | `node --test <test-path>` and `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~120 seconds (full), ~10 seconds (one test file) |

## Sampling Rate

- **After every task commit:** the owner test file plus direct coverage of each changed source (the commit hook runs `check:commit`).
- **After a task touching `features/`:** `npm run check:features` and the scenario via `npx cucumber-js --name '<title>'`.
- **After every plan wave and before verification:** `npm run check` on the combined tree.
- **Max feedback latency:** 120 seconds.

## Per-Task Verification Map

See `04-RESEARCH.md` § Validation Architecture for the requirement-to-command
map; each plan's tasks carry the matching `<automated>` command.

## Wave 0 Requirements

- [ ] `test/bridges/agents/<new>.test.ts` pairs with the new agents-bridge check (RSV-04).
- [ ] A keyed `contradiction` fixture in `test/orchestrators/plugin/dependency-plan.test.ts` (RSV-03).
- [ ] Cucumber steps: publish a plugin agent; place a hand-written agent file (RSV-04).

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
