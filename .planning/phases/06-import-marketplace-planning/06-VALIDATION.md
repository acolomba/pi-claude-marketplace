---
phase: "06"
slug: "import-marketplace-planning"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test <owner test path>` and `npx cucumber-js --name '<scenario title>'` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~90 seconds for `npm run check` |

## Sampling Rate

- **After every task commit:** the owner `node --test` file(s), `npm run test:coverage:direct -- <source>` for each touched pair, and `npx cucumber-js --name ...` for each added scenario.
- **After every plan wave:** `npm run check` on the combined tree.
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** 120 seconds.

## Per-Task Verification Map

The plans fill this map; the requirement-to-command mapping is in `06-RESEARCH.md` under `## Validation Architecture`.

## Wave 0 Requirements

- [ ] `features/lib/published-marketplace.ts` and `features/step_definitions/plugin/publishing.steps.ts`: the read-only skill directory fixture and its release.
- [ ] `features/lib/run-tokens.ts` and `features/lib/field-rows.ts`: path-free error tokens and token projection in JSON cells.

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
