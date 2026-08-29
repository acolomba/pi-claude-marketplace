---
phase: 108
slug: domain-and-platform
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 108 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner, `node:assert/strict`, test-context mocks/timers, and `strong-mock` 9.2.2 |
| **Config file** | `package.json`, `tsconfig.json` |
| **Quick run command** | `node --test <owner-test-path> && npm run test:coverage:direct -- <source-or-owner-path>` |
| **Full suite command** | `npm run test:coverage:direct:all && npm run check` |
| **Estimated runtime** | Focused pair under 30 seconds; measure and record the completed all-pair/full-suite runtime |

---

## Sampling Rate

- **After every task commit:** Run the owner test alone and its focused direct-coverage command. Also run `npm run typecheck` when a production type or exported result changes.
- **After every adapter task:** Run both contract participants, the fake's exact negative control, correspondence positive/negative gates, affected relocated-support consumers, and `npm run test:coverage:direct:all`.
- **After every plan wave:** Run `npm run test:coverage:direct:all && npm run check`.
- **Before `$gsd-verify-work`:** All 23 focused records, three shared contracts, three exact negative controls, correspondence gates, and `npm run check` must be green.
- **Max feedback latency:** 30 seconds for a focused owner; full gates run at adapter and wave boundaries.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 108-01-02 | 01 | 1 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/auth-registry.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/auth-registry.ts` | ✅ | ⬜ pending |
| 108-02-02 | 02 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/clone-key.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/clone-key.ts` | ✅ | ⬜ pending |
| 108-03-02 | 03 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/components/hook-events.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts` | ✅ | ⬜ pending |
| 108-04-02 | 04 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/components/hook-if-targets.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` | ✅ | ⬜ pending |
| 108-05-02 | 05 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/components/hook-tool-names.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` | ✅ | ⬜ pending |
| 108-06-02 | 06 | 6 | MOD-01 | — | N/A | schema unit/direct coverage | `node --test tests/domain/components/hooks.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks.ts` | ✅ coverage gap | ⬜ pending |
| 108-07-02 | 07 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/components/hooks/matcher.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` | ✅ | ⬜ pending |
| 108-08-02 | 08 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/components/hooks/partition.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/partition.ts` | ✅ | ⬜ pending |
| 108-09-02 | 09 | 2 | MOD-01 | — | N/A | schema unit/direct coverage | `node --test tests/domain/components/hooks/schema.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/schema.ts` | ✅ | ⬜ pending |
| 108-10-02 | 10 | 2 | MOD-01 | — | N/A | schema unit/direct coverage | `node --test tests/domain/components/mcp.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/mcp.ts` | ✅ | ⬜ pending |
| 108-11-02 | 11 | 2 | MOD-01 | — | N/A | schema unit/direct coverage | `node --test tests/domain/components/plugin.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/plugin.ts` | ✅ | ⬜ pending |
| 108-12-03 | 12 | 4 | MOD-01, PRES-03, PRES-04 | T-108-AUTH | Synthetic tokens never reach notifications/errors; HTTP and waits are injected | contract/unit/direct coverage | `node --test tests/domain/github-auth.test.ts tests/domain/device-flow-fake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/github-auth.ts` | owner ✅; concern support ❌ W0 | ⬜ pending |
| 108-13-02 | 13 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/manifest-cache.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest-cache.ts` | ✅ | ⬜ pending |
| 108-14-02 | 14 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/manifest-lookup.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest-lookup.ts` | ✅ | ⬜ pending |
| 108-15-02 | 15 | 2 | MOD-01 | — | N/A | schema unit/direct coverage | `node --test tests/domain/manifest.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest.ts` | ✅ | ⬜ pending |
| 108-16-02 | 16 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/name.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/name.ts` | ✅ | ⬜ pending |
| 108-17-02 | 17 | 2 | MOD-01 | T-108-PATH | Plugin-root resolution remains contained | unit/direct coverage | `node --test tests/domain/plugin-root.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/plugin-root.ts` | ✅ | ⬜ pending |
| 108-18-03 | 18 | 2 | MOD-01, RES-01 | T-108-TYPE | False resolver arms cannot expose `pluginRoot`; three state distinctions remain | runtime/type/direct coverage | `node --test tests/domain/resolver.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/resolver.ts && npm run typecheck` | ❌ W0 | ⬜ pending |
| 108-19-02 | 19 | 6 | MOD-01 | T-108-INPUT | Parsed-source validation preserves containment and rejects invalid shapes | unit/direct coverage | `node --test tests/domain/source.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts` | ✅ coverage gap | ⬜ pending |
| 108-20-02 | 20 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/domain/version.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/version.ts` | ✅ | ⬜ pending |
| 108-21-03 | 21 | 3 | MOD-01, PRES-03, PRES-04 | T-108-CRED | Credential wire input rejects controls and never invokes a real helper/keychain | contract/process/direct coverage | `node --test tests/platform/git-credential.test.ts tests/platform/credential-ops-fake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git-credential.ts` | owner ✅; concern support ❌ W0 | ⬜ pending |
| 108-22-03 | 22 | 5 | MOD-01, PRES-03, PRES-04 | T-108-GIT | Git uses case-owned local repositories and poisoned remote/auth boundaries | contract/filesystem/direct coverage | `node --test tests/platform/git.test.ts tests/platform/git-ops-fake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts` | ❌ W0 | ⬜ pending |
| 108-23-02 | 23 | 2 | MOD-01 | — | N/A | unit/direct coverage | `node --test tests/platform/pi-api.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts` | ✅ | ⬜ pending |

The task IDs above map to each finalized plan's coverage-closing task: `-02` for two-task plans and `-03` for the resolver and adapter carrier plans. Wave numbers match the dependencies in the 23 PLAN files.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/domain/resolver.test.ts` — canonical owner for RES-01 runtime and compile-time contracts.
- [ ] `tests/platform/git.test.ts` — canonical owner for the Git production adapter.
- [ ] Concern-local Git contract, fake, fake participant, guarded local-repository/HTTP support, and exact negative control under `tests/platform/`.
- [ ] Concern-local credential contract, relocated fake, fake participant, deterministic process support, and exact negative control under `tests/platform/`.
- [ ] Concern-local device-flow contract, relocated fake, fake participant, fetch/wait support, and exact negative control under `tests/domain/`.
- [ ] Structural supplemental-evidence classification in `scripts/check-corresponding-tests.mjs` plus a negative fixture proving arbitrary unexpected tests still fail.
- [ ] Replace the loopback Git remote-ref fixture with explicit injected HTTP behavior; no socket listener is permitted.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing owner and support files.
- [ ] No watch-mode flags.
- [ ] Focused feedback latency stays below 30 seconds.
- [ ] `nyquist_compliant: true` is set after execution evidence is recorded.

**Approval:** pending
