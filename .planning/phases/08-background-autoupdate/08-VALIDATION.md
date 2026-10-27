---
phase: "8"
slug: "background-autoupdate"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock`; `@cucumber/cucumber` |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test <test-path>`; `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (full); seconds per owner test |

---

## Sampling Rate

- **After every task commit:** the owner test(s) via `node --test <path>`, then direct coverage for each touched source pair; the commit hook runs `check:commit`.
- **After notification-wire changes:** `npm run schema:generate`, then the wire-schema, json-output-docs, and catalog-wire architecture tests.
- **After every plan wave:** `npm run check:static`.
- **Before `/gsd-verify-work`:** `npm run check` green on the combined tree.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| AUP-01 | arms on first `input` in tui/rpc only; once per runtime; delay `floor(random()*max)`; unref'd | unit | `node --test test/orchestrators/marketplace/background-update.test.ts` | ❌ W0 | ⬜ pending |
| AUP-01 | pass selects marketplaces with merged autoupdate true, project first, reuses `updateMarketplace` with a silent load run | unit | same | ❌ W0 | ⬜ pending |
| AUP-01 | gate: a command waits for the in-flight step and blocks new steps; pass yields between plugins | unit | background gate test | ❌ W0 | ⬜ pending |
| AUP-01 | `/claude:plugin` handler runs inside `runForeground` | unit | `node --test test/edge/register.test.ts` | ✅ | ⬜ pending |
| AUP-01 | shutdown cancels timer, awaits step except on quit, no throw escapes, stopped runtime never notifies | unit | background-update test | ❌ W0 | ⬜ pending |
| AUP-01 | `index.ts` registers `input` + `session_shutdown`, passes the gate | unit | `node --test test/index.test.ts` | ✅ | ⬜ pending |
| AUP-01/03 | end to end: delay 0, plain message, one `background-update` entry naming the plugin | behavioral | `npx cucumber-js --name '<scenario title>'` | ❌ W0 | ⬜ pending |
| AUP-02 | opt-out variables, FORCE override, delay parse incl. > 2147483647 | unit | background-update (policy) test | ❌ W0 | ⬜ pending |
| AUP-03 | text for 1 / 2 / 3+ names, dedupe, severity info | unit | `node --test test/shared/notification-grammar.test.ts` | ✅ | ⬜ pending |
| AUP-03 | wire payload `needsReload: true`, load origin, schema | unit + architecture | `node --test test/shared/notification-json.test.ts test/shared/notification-wire.test.ts`; `npm run test:unpaired` | ✅ | ⬜ pending |
| AUP-03 | nothing updated → silent | unit | background-update test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] new owner tests for each new `orchestrators/marketplace/background-*.ts` module
- [ ] `features/marketplace/background-update.feature` + steps + world helper + `test/e2e/_rpc.ts` env key + hermetic-git-environment case + `result-rows.ts` row field

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 10-minute real-time delay in a TUI session | AUP-01 | wall-clock wait; covered by unit tests with injected timer | run Pi in TUI with an autoupdate-on marketplace, send a message, wait ≤10 min |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
