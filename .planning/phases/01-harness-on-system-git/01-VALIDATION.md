---
phase: "1"
slug: "harness-on-system-git"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-23"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration), `@cucumber/cucumber` (behavioral) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/architecture/hermetic-git-environment.test.ts test/architecture/https-git-host-server.test.ts test/architecture/https-git-host-cgi.test.ts test/architecture/ssh-git-host.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~60 seconds; full ~15 minutes |

In this sandbox, prefix every command with `PATH="/opt/pi-claude-marketplace/bin:$PATH"` (Node 24 wrapper). See RESEARCH.md "Baseline gate result" for the known sandbox-only failures and the trimmed-environment gate command.

---

## Sampling Rate

- **After every task commit:** the pre-commit hook (`npm run check:commit`), plus the task's own owner test
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds for the quick command

---

## Per-Task Verification Map

Filled by the planner on 2026-11-23 from the eight plans. Prefix each command with `PATH="/opt/pi-claude-marketplace/bin:$PATH"` in this sandbox; `T` stands for `node --import "$PWD/scripts/isolated-pi-home.mjs" --test`, and `C` for `npm run --silent test:coverage:direct --`. Each task's PLAN.md holds the full command list and the `fails_when` of each command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SG-HRN-01 | T-01-01, T-01-02, T-01-03 | fixture git gets only the hermetic builder's keys and a scratch HOME | unit (existing contract consumers) | `T test/platform/git.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | SG-HRN-01 | T-01-01 | contract fixtures and warm mirror on the same builder | unit + direct coverage | `T test/platform/git.test.ts ... test/orchestrators/reconcile/convergence.test.ts`; `C` per pair (5 sources) | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | SG-HRN-04 | T-01-04 | static `run: git --version`, no template expression | CI config | `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .github/workflows/ci.yml .github/workflows/e2e-nightly.yml`; `T test/architecture/behavioral-shard-coverage.test.ts` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 1 | SG-HRN-04 | T-01-05, T-01-06, T-01-SC | e2e run variable overrides the shell; no dependency moves | config | `node -e` script check of the three e2e scripts; dependency-field and lockfile diff | ✅ | ⬜ pending |
| 01-03-01 | 03 | 2 | SG-HRN-01 | T-01-07 | clone-cache fixtures on the hermetic builder | unit + direct coverage | `T test/orchestrators/plugin/clone-cache.test.ts`; `C extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | ✅ | ⬜ pending |
| 01-03-02 | 03 | 2 | SG-HRN-01 | T-01-07 | warm mirrors on the hermetic builder | unit + direct coverage | `T test/orchestrators/plugin/list-candidate-row.test.ts test/orchestrators/plugin/list-flow.test.ts`; `C` per pair | ✅ | ⬜ pending |
| 01-03-03 | 03 | 2 | SG-HRN-01 | T-01-08, T-01-09 | clone inspection reads only the clone's own `.git` | behavioral (existing scenarios) | `npm run --silent test:cucumber:profile -- --profile adapter` on the 10 clone-inspecting feature files | ✅ | ⬜ pending |
| 01-04-01 | 04 | 2 | SG-HRN-01 | T-01-10 | install-cascade fixtures on the hermetic builder | unit + direct coverage | `T test/orchestrators/plugin/install-cascade.test.ts`; `C .../install-cascade.ts` | ✅ | ⬜ pending |
| 01-04-02 | 04 | 2 | SG-HRN-01 | T-01-10, T-01-11 | same staged files as before | unit + direct coverage | `T` on install-flow-planning, install-outcome, info tests; `C` per pair | ✅ | ⬜ pending |
| 01-04-03 | 04 | 2 | SG-HRN-01 | T-01-10 | contract doubles kept, fixtures moved | unit + direct coverage | `T` on update-flow, update-preflight tests; `C` per pair | ✅ | ⬜ pending |
| 01-05-01 | 05 | 2 | SG-HRN-01 | T-01-12 | tagged marketplace on the hermetic builder; clone git state unchanged | integration | `T test/integration/path-source-tag-install.test.ts` | ✅ | ⬜ pending |
| 01-05-02 | 05 | 2 | SG-HRN-01 | T-01-12 | checkouts on the hermetic builder | integration | `T test/integration/marketplace-add-seed-mirrors.test.ts test/integration/project-install-adds-user-marketplace.test.ts` | ✅ | ⬜ pending |
| 01-05-03 | 05 | 2 | SG-HRN-04 | T-01-13, T-01-14 | forked children start from five named keys | integration | `T test/integration/concurrent-install.test.ts test/integration/load-reconcile-race.test.ts` | ✅ | ⬜ pending |
| 01-06-01 | 06 | 2 | SG-HRN-02 | T-01-15, T-01-16 | trust only through the run's CA file; upload-pack settings as `-c` arguments | architecture (real host) | `T test/architecture/https-git-host-server.test.ts test/architecture/https-git-host-cgi.test.ts`; cucumber git-source subset | ✅ (new cases) | ⬜ pending |
| 01-06-02 | 06 | 2 | SG-HRN-02 | T-01-18 | refusing arm per repository; reset clears it | architecture (real host) | `T test/architecture/https-git-host-server.test.ts test/architecture/https-git-host-cgi.test.ts` | ✅ (new cases) | ⬜ pending |
| 01-06-03 | 06 | 2 | SG-HRN-02 | T-01-17 | Pi's CA file and PATH come from the run | architecture + integration + behavioral | `T test/architecture/hermetic-git-environment.test.ts`; `T test/integration/subagent-hook-ownership.test.ts`; cucumber subset | ✅ | ⬜ pending |
| 01-07-01 | 07 | 3 | SG-HRN-03 | T-01-20, T-01-21, T-01-22 | stub first on every Pi's PATH; unregistered host exits 255; contained paths | architecture (real git) + behavioral (Before snapshot) | `T test/architecture/ssh-git-host.test.ts`; cucumber subset | ❌ created by this task | ⬜ pending |
| 01-07-02 | 07 | 3 | SG-HRN-03 | T-01-21, T-01-23, T-01-24 | upstream probe answers; held stub leaves no process; traversal refused | architecture (real git) | `T test/architecture/ssh-git-host.test.ts test/architecture/https-git-host-server.test.ts` | ✅ after 01-07-01 | ⬜ pending |
| 01-07-03 | 07 | 3 | SG-HRN-03 | T-01-20 | real-children fixture's Pis get the stub-first PATH | behavioral | cucumber `features/plugin/subagent-child.feature features/agent/frontmatter.feature`, both profiles | ✅ | ⬜ pending |
| 01-08-01 | 08 | 4 | SG-HRN-01, SG-HRN-03 | T-01-25, T-01-26, T-01-27 | planted rewrite, ignore file, repository pointer, and ssh overrides reach no suite git | architecture (real clones) | `T test/architecture/hermetic-git-environment.test.ts` (full sandbox environment) | ✅ | ⬜ pending |
| 01-08-02 | 08 | 4 | SG-HRN-04 | T-01-25 | every builder's exact key set under every SG-HRN-04 family | architecture | `T test/architecture/hermetic-git-environment.test.ts test/architecture/https-git-host-cgi.test.ts` | ✅ | ⬜ pending |
| 01-08-03 | 08 | 4 | SG-HRN-01 (record) | T-01-28 | record matches the read-only scan | none (record) | the `node -e` scan of the request tables; `grep -rlE '^import [^t].*from "isomorphic-git' test features` lists the five contract files | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/architecture/ssh-git-host.test.ts` — argv table and real-git cases (SG-HRN-03): created by task 01-07-01, expanded by 01-07-02
- [ ] New cases in `test/architecture/https-git-host-server.test.ts` and `https-git-host-cgi.test.ts` (SG-HRN-02): tasks 01-06-01 and 01-06-02
- [ ] New planted-leak cases in `test/architecture/hermetic-git-environment.test.ts` (SG-HRN-01, SG-HRN-04): tasks 01-08-01 and 01-08-02

Frameworks are in place. No separate Wave 0 plan: each new test file or case lands in the task that builds the code it checks (the `tdd="true"` tasks write their `<behavior>` cases with the code), so no task runs without an automated check.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `git --version` appears in each test job's log | SG-HRN-04 | a workflow step has no local runner | read the PR's CI run logs for static, integration, behavioral, direct-coverage, e2e-tests, and e2e-nightly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
