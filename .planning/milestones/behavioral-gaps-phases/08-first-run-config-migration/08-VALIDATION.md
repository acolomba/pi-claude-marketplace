---
phase: "8"
slug: "first-run-config-migration"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration), `@cucumber/cucumber` (behavior) |
| **Config file** | `package.json` scripts, `cucumber.json` (frozen) |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/migrate-config.test.ts` and `npx cucumber-js features/plugin/config-migration.feature` |
| **Full suite command** | `npm run check` (both cucumber profiles); the phase gate also runs `npm run test:modules` |
| **Estimated runtime** | quick ~60 seconds; full ~10 minutes under load |

---

## Sampling Rate

- **After every task commit:** the owner unit test and direct coverage of the touched pair; `npx cucumber-js features/plugin/config-migration.feature`; `npm run check:features` when the feature file changes
- **After every plan wave:** `npm run check` as its parts in order (`check:static`, `test:unpaired`, `test:integration`, both cucumber profiles with `--parallel 3`, `test:coverage:direct:all`)
- **Before `/gsd-verify-work`:** full `npm run check` and `npm run test:modules` green
- **Max feedback latency:** 120 seconds for the quick commands

---

## Per-Task Verification Map

Filled by the planner per task; the requirement map is:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| CFGMIG-01 | projection: user-disabled, dependency-check hold, enabled dependency left out, user-disabled dependency kept | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/migrate-config.test.ts` | file yes, cases no | ⬜ pending |
| CFGMIG-01 | user 0.4.3 upgrade, deleted config with a disabled plugin, pending empty, cascade dependency | cucumber | `npx cucumber-js features/plugin/config-migration.feature` | partly (seeds) | ⬜ pending |
| CFGMIG-01 | project 0.4.3 upgrade, project pending empty, `--local`-only scope | cucumber | same | no | ⬜ pending |
| CFGMIG-02 | the user's edit survives a new session and a terminal `/reload` | cucumber | same | no | ⬜ pending |
| CFGMIG-02 | an invalid base config is reported and kept; an unreadable local config is reported, kept, and no base config is written | cucumber | same | no | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New projection cases in `test/persistence/migrate-config.test.ts` (D-BG-801 to D-BG-803)

*No new framework, fixture, step, support, or lib file is needed.*

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
