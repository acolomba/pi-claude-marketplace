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

| Task ID | Plan | Wave | Requirement | Automated Command | File / Wave 0 State | Sampling Status |
|---------|------|------|-------------|-------------------|---------------------|-----------------|
| 108-01-01 | 01 | 1 | MOD-01 | `node --test tests/domain/auth-registry.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/auth-registry.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-01-02 | 01 | 1 | MOD-01 | `node --test tests/domain/auth-registry.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/auth-registry.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-02-01 | 02 | 6 | MOD-01 | `node --test tests/domain/clone-key.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-02-02 | 02 | 6 | MOD-01 | `node --test tests/domain/clone-key.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/clone-key.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-02-03 | 02 | 6 | MOD-01 | `node --test tests/architecture/config-state-consistency.test.ts tests/architecture/cross-op-convergence.test.ts tests/edge/handlers/marketplace/add.test.ts tests/edge/handlers/marketplace/update.test.ts tests/edge/handlers/plugin/bootstrap.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/clone-key.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-03-01 | 03 | 6 | MOD-01 | `node --test tests/domain/components/hook-events.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-03-02 | 03 | 6 | MOD-01 | `node --test tests/domain/components/hook-events.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-03-03 | 03 | 6 | MOD-01 | `node --test tests/integration/auth-e2e.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/add-seed-mirrors.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/shared.test.ts tests/orchestrators/marketplace/update-transport.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-04-01 | 04 | 6 | MOD-01 | `node --test tests/domain/components/hook-if-targets.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-04-02 | 04 | 6 | MOD-01 | `node --test tests/domain/components/hook-if-targets.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-04-03 | 04 | 6 | MOD-01 | `node --test tests/orchestrators/marketplace/remove.test.ts tests/orchestrators/marketplace/update.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-05-01 | 05 | 6 | MOD-01 | `node --test tests/domain/components/hook-tool-names.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-05-02 | 05 | 6 | MOD-01 | `node --test tests/domain/components/hook-tool-names.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-05-03 | 05 | 6 | MOD-01 | `node --test tests/orchestrators/plugin/bootstrap.test.ts tests/orchestrators/plugin/clone-cache-seed.test.ts tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/info-manifest-absent.test.ts tests/orchestrators/plugin/info.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-06-01 | 06 | 6 | MOD-01 | `node --test tests/domain/components/hooks.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-06-02 | 06 | 6 | MOD-01 | `node --test tests/domain/components/hooks.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-07-01 | 07 | 6 | MOD-01 | `node --test tests/domain/components/hooks/matcher.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-07-02 | 07 | 6 | MOD-01 | `node --test tests/domain/components/hooks/matcher.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-07-03 | 07 | 6 | MOD-01 | `node --test tests/orchestrators/plugin/install-auth.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/update-reinstall-auth.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/device-flow-prompt.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-08-01 | 08 | 2 | MOD-01 | `node --test tests/domain/components/hooks/partition.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-08-02 | 08 | 2 | MOD-01 | `node --test tests/domain/components/hooks/partition.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/partition.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-09-01 | 09 | 2 | MOD-01 | `node --test tests/domain/components/hooks/schema.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-09-02 | 09 | 2 | MOD-01 | `npm run typecheck && node --test tests/domain/components/hooks/schema.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/schema.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-10-01 | 10 | 2 | MOD-01 | `node --test tests/domain/components/mcp.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-10-02 | 10 | 2 | MOD-01 | `node --test tests/domain/components/mcp.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/mcp.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-11-01 | 11 | 2 | MOD-01 | `node --test tests/domain/components/plugin.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-11-02 | 11 | 2 | MOD-01 | `npm run typecheck && node --test tests/domain/components/plugin.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/plugin.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-12-01 | 12 | 4 | MOD-01, PRES-03, PRES-04 | `node --test tests/domain/github-auth.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-12-02 | 12 | 4 | MOD-01, PRES-03, PRES-04 | `node --test tests/domain/github-auth.test.ts tests/domain/device-flow-fake.test.ts` | ❌ Wave 0 creates: `tests/domain/device-flow-contract.ts`, `tests/domain/device-flow-fake.ts`, `tests/domain/device-flow-fake.test.ts` | ⬜ pending — sample after task commit |
| 108-12-03 | 12 | 4 | MOD-01, PRES-03, PRES-04 | `node --test tests/domain/github-auth.test.ts tests/domain/device-flow-fake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/github-auth.ts && npm run test:corresponding && npm run test:corresponding:negative` | ❌ Wave 0 creates: `tests/domain/device-flow-contract.ts`, `tests/domain/device-flow-fake.ts`, `tests/domain/device-flow-fake.test.ts` | ⬜ pending — sample after task commit |
| 108-13-01 | 13 | 2 | MOD-01 | `node --test tests/domain/manifest-cache.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-13-02 | 13 | 2 | MOD-01 | `node --test tests/domain/manifest-cache.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest-cache.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-14-01 | 14 | 2 | MOD-01 | `node --test tests/domain/manifest-lookup.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-14-02 | 14 | 2 | MOD-01 | `node --test tests/domain/manifest-lookup.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest-lookup.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-15-01 | 15 | 2 | MOD-01 | `node --test tests/domain/manifest.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-15-02 | 15 | 2 | MOD-01 | `node --test tests/domain/manifest.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-16-01 | 16 | 2 | MOD-01 | `node --test tests/domain/name.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-16-02 | 16 | 2 | MOD-01 | `node --test tests/domain/name.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/name.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-17-01 | 17 | 2 | MOD-01 | `node --test tests/domain/plugin-root.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-17-02 | 17 | 2 | MOD-01 | `node --test tests/domain/plugin-root.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/plugin-root.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-18-01 | 18 | 2 | MOD-01, RES-01 | `npm run typecheck && node --test tests/domain/resolver.test.ts` | 🛠 Task 108-18-01 creates `tests/domain/resolver.test.ts` before verification | ⬜ pending — sample after task commit |
| 108-18-02 | 18 | 2 | MOD-01, RES-01 | `node --test tests/domain/resolver.test.ts && npm run typecheck && npm run test:corresponding` | ⏩ owner exists from Task 108-18-01; this task extends it | ⬜ pending — sample after task commit |
| 108-18-03 | 18 | 2 | MOD-01, RES-01 | `node --test tests/domain/resolver.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/resolver.ts && npm run typecheck` | ⏩ owner exists from Task 108-18-01 | ⬜ pending — sample after task commit |
| 108-19-01 | 19 | 6 | MOD-01 | `node --test tests/domain/source.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-19-02 | 19 | 6 | MOD-01 | `node --test tests/domain/source.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-20-01 | 20 | 2 | MOD-01 | `node --test tests/domain/version.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-20-02 | 20 | 2 | MOD-01 | `node --test tests/domain/version.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/version.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-21-01 | 21 | 3 | MOD-01, PRES-03, PRES-04 | `node --test tests/platform/git-credential.test.ts` | ❌ Wave 0 creates: `tests/platform/credential-process-fake.ts` | ⬜ pending — sample after task commit |
| 108-21-02 | 21 | 3 | MOD-01, PRES-03, PRES-04 | `node --test tests/platform/git-credential.test.ts tests/platform/credential-ops-fake.test.ts` | ❌ Wave 0 creates: `tests/platform/credential-ops-contract.ts`, `tests/platform/credential-ops-fake.ts`, `tests/platform/credential-ops-fake.test.ts` | ⬜ pending — sample after task commit |
| 108-21-03 | 21 | 3 | MOD-01, PRES-03, PRES-04 | `npm run test:corresponding && npm run test:corresponding:negative && node --test tests/platform/git-credential.test.ts tests/platform/credential-ops-fake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git-credential.ts` | ❌ Wave 0 creates: `tests/platform/credential-ops-contract.ts`, `tests/platform/credential-ops-fake.ts`, `tests/platform/credential-ops-fake.test.ts` | ⬜ pending — sample after task commit |
| 108-22-01 | 22 | 5 | MOD-01, PRES-03, PRES-04 | `node --test tests/platform/git.test.ts` | ❌ Wave 0 creates: `tests/platform/git.test.ts`, `tests/platform/git-test-repository.ts` | ⬜ pending — sample after task commit |
| 108-22-02 | 22 | 5 | MOD-01, PRES-03, PRES-04 | `node --test tests/platform/git.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts` | ❌ Wave 0 creates: `tests/platform/git.test.ts`, `tests/platform/git-ops-contract.ts`, `tests/platform/git-test-repository.ts` | ⬜ pending — sample after task commit |
| 108-22-03 | 22 | 5 | MOD-01, PRES-03, PRES-04 | `node --test tests/platform/git.test.ts tests/platform/git-ops-fake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts && npm run test:corresponding && npm run test:corresponding:negative` | ❌ Wave 0 creates: `tests/platform/git-ops-contract.ts`, `tests/platform/git-ops-fake.ts`, `tests/platform/git-ops-fake.test.ts` | ⬜ pending — sample after task commit |
| 108-23-01 | 23 | 7 | MOD-01 | `node --test tests/platform/pi-api.test.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-23-02 | 23 | 7 | MOD-01 | `npm run typecheck && node --test tests/platform/pi-api.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |
| 108-23-03 | 23 | 7 | MOD-01 | `! rg -n 'helpers/(git-mock|credential-mock|device-flow-mock)' tests --glob '!helpers/git-mock.ts' --glob '!helpers/credential-mock.ts' --glob '!helpers/device-flow-mock.ts' && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:all && npm run check` | ✅ inputs exist at planning time | ⬜ pending — sample after task commit |

All 56 executable task IDs are mapped. Wave values match plan frontmatter; every row carries its exact task-level automated command, current/Wave-0 file state, and per-commit sampling status.
## Wave 0 Requirements

- No resolver Wave 0 scaffold is required: Task 108-18-01 explicitly creates `tests/domain/resolver.test.ts` before running its automated verification, and Tasks 108-18-02/03 extend that owner.
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
