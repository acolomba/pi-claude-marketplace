---
phase: "06"
slug: "marketplace-update-and-c-10-fix"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-18"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Cucumber 13.3.0 behavioral tests and Node.js `node:test` unit tests |
| **Config file** | `cucumber.json`, `package.json` |
| **Quick run command** | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~30 seconds for focused feedback |

---

## Sampling Rate

- **After every task commit:** Run the task's focused Cucumber or paired unit-test command from the map below
- **After every plan wave:** Run `npm run check`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds for focused checks

---

## Per-Task Verification Map

The task IDs are provisional until the phase plans are written. The planner must preserve this requirement coverage when assigning final task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | FIX-01 | — | Exact external manifest path is retained and reread without escaping its owning root | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "An external manifest is refreshed from its original file"` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | UPD-01 | — | N/A | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "An unchanged marketplace is up to date"` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | UPD-02 | — | N/A | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "A changed marketplace refreshes without plugin rows"` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 2 | UPD-10 | — | Invalid refreshed data cannot replace the last successful baseline or mutate plugins | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "An invalid refreshed manifest leaves installed plugins unchanged"` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 2 | UPD-14 | — | A missing source fails cleanly and preserves its registration for retry | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "A missing marketplace directory leaves its registration intact"` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | UPD-03 | — | N/A | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "Autoupdate off preserves installed versions"` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | UPD-04 | — | N/A | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "Autoupdate exposes the offered version in a new session"` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | UPD-05 | — | N/A | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "An unchanged autoupdate is up to date"` | ❌ W0 | ⬜ pending |
| 06-02-04 | 02 | 2 | UPD-06 | — | A refresh cannot install plugins that the user did not request | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "Autoupdate does not install newly offered plugins"` | ❌ W0 | ⬜ pending |
| 06-02-05 | 02 | 2 | UPD-13 | — | A catalog removal cannot silently uninstall or disable an installed plugin | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "Autoupdate keeps a plugin removed from the catalog"` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | UPD-07 | — | Scope boundaries and deterministic insertion order are preserved across a bare update | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "A bare update preserves scope and insertion order with adjacent notices"` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 1 | UPD-08 | — | N/A | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "A bare update with no marketplaces reports an empty result"` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 1 | UPD-09 | — | A scope miss cannot read or mutate the registration in the other scope | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name "An update reports the marketplace missing from the requested scope"` | ❌ W0 | ⬜ pending |

Each source edit must also pass its direct paired coverage command. For the update orchestrator, run `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`.

---

## Wave 0 Requirements

- [ ] `features/marketplace/update.feature` — Phase 6 behavioral scenarios and exact output assertions
- [ ] `features/step-definitions/marketplace.steps.ts` — row assertions that accept adjacent `mcp-config-notices` without weakening other result validation
- [ ] `tests/orchestrators/marketplace/update.test.ts` — owner tests for refresh baselines, equality, failure continuation, and ordering
- [ ] Paired tests for every additional changed TypeScript source file — 100% direct statement, branch, function, and line coverage

The existing Cucumber and `node:test` infrastructure is sufficient; no framework installation is needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
