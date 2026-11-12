---
phase: "02"
slug: "hook-payloads-matchers-and-stop-limit"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-12"
---

# Phase 02 — Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Node test runner; Cucumber adapter and builtin profiles |
| Config file | package.json, cucumber.json |
| Quick run command | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-adapters.test.ts` |
| Direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` |
| Behavioral command | `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature` (repeat builtin) |
| Full suite command | `npm run check` |
| Estimated runtime | Measure during execution; full gate timeout is 2,400 seconds |

## Sampling Rate

- Each task runs its owner tests and focused scenarios; planner replaces the example paths with exact task owners.
- Before each commit, run repository fixers; the normal commit hook runs staged checks. Do not duplicate the hook's checks immediately before committing.
- Each wave, phase, merge, and final handoff requires `npm run check` on the combined tree. Reuse only unchanged-input evidence under the local-verification skill.
- Before verification, the full suite must be green. Record actual feedback latency; a timeout is not a pass.

## Per-Task Verification Map

The planner must replace provisional slice labels with actual task IDs, waves, commands, and unique threat references before plans pass review.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Input codecs | pending | pending | PG-HOOK-01 | pending | Invalid rewrite preserves original whole call; denial wins | unit/direct | Exact owner command assigned by planner | New owners needed | pending |
| Result projection/reverse | pending | pending | PG-HOOK-01 | pending | No invented facts or retained redacted structured/details output | unit/integration | Exact codec and observer owner commands assigned by planner | New owners/observer needed | pending |
| Batch and payload integration | pending | pending | PG-HOOK-01 | pending | No partial batch mutation; consistent target; generation safety | unit/cucumber | `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature` | Extend existing | pending |
| Alias/failure/async | pending | pending | PG-HOOK-01 | pending | Failed output unchanged; shared real result and correct identity | unit/cucumber | Exact existing owners assigned by planner | Extend existing | pending |
| Matcher admission/runtime | pending | pending | PG-HOOK-03 | pending | Whole-pattern regex; invalid pattern diagnosed; ignored matchers do not discard hooks | unit/cucumber | Exact matcher owners and features assigned by planner | Extend existing | pending |
| Stop cap/reset | pending | pending | PG-HOOK-13 | pending | Eight continuations; ninth override; tool/reset/reload isolation | unit/cucumber | `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-and-stop.feature` | Extend existing | pending |

All runnable task verification commands require an immediate `<fails_when>` sibling. Both MCP profiles must cover alias behavior. Use real command hooks and real Pi tools where available; direct coverage does not replace behavioral scenarios. Tests must distinguish the intended behavior from plausible wrong implementations.

## Wave 0 Requirements

- [ ] New codec modules each have exactly one mirrored owner test.
- [ ] Extend hook fixtures for pair-specific responses and downstream observation of content, structuredContent, and details.
- [ ] Add visible scenarios with each implementation slice; no final-only behavioral coverage deferral.
- Existing test frameworks suffice. No framework installation is required.

## Manual-Only Verifications

No manual test is currently required. Automate first and record exact evidence limits. PowerShell is unavailable locally: exercise its codec with contract fixtures and do not claim real PowerShell execution. LS schema and MCP mixed-field precedence evidence limits remain explicit in research and implementation records.

## Validation Sign-Off

- [ ] All tasks have concrete automated verification or Wave 0 dependencies.
- [ ] Every task has feedback; no three consecutive tasks lack automated verification.
- [ ] New references and observers are covered by Wave 0 dependencies.
- [ ] No watch-mode flags.
- [ ] Actual feedback latency recorded.
- [ ] Full combined-tree gate passes.
- [ ] `nyquist_compliant: true` set only after validation.

**Approval:** pending implementation and automated verification.
