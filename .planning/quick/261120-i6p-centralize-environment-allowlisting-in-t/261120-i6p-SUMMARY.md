---
phase: quick-261120-i6p
plan: 01
subsystem: test-harness
status: complete
tags: [tests, environment, cucumber, node-test, windows]
requires: []
provides:
  - features/lib/child-environment.ts hostVariables (cucumber tier allowlist)
  - test/platform/process-environment.ts allowlistedEnvironment, useAllowlistedProcessEnvironment, restoreEnvironmentAfter (node:test tier allowlist)
affects:
  - test/platform/hermetic-environment.ts (createHermeticEnvironment shares the per-case ledger)
tech-stack:
  added: []
  patterns:
    - per-test-case environment ledger (first record wins, one after hook, never assigns undefined)
    - one host-variable picker with a Windows base list and upper-case name match
key-files:
  created:
    - features/lib/child-environment.ts
    - test/platform/process-environment.ts
    - test/architecture/child-environment.test.ts
  modified:
    - features/lib/state-lock-holder.ts
    - features/lib/pi-rpc.ts
    - features/lib/hermetic-git.ts
    - features/lib/https-git-host/server.ts
    - test/platform/hermetic-environment.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/architecture/hook-script-cleanup.test.ts
    - test/architecture/json-output-docs.test.ts
    - test/architecture/hermetic-git-environment.test.ts
    - test/architecture/https-git-host-cgi.test.ts
    - test/orchestrators/plugin/state-fifo.ts
    - test/integration/concurrent-install.test.ts
    - test/integration/load-reconcile-race.test.ts
    - test/integration/hooks-additionalcontext-end-to-end.test.ts
    - test/integration/hooks-spawn-end-to-end.test.ts
    - test/integration/hooks-dispatch-end-to-end.test.ts
    - test/e2e/json-output-runtime.ts
    - test/e2e/pi-runtime-smoke.ts
    - test/e2e/upstream-marketplace.ts
    - CHANGELOG.md
decisions:
  - The upstream e2e fetch keeps the proxy and CA variables (https_proxy, HTTPS_PROXY, all_proxy, ALL_PROXY, no_proxy, NO_PROXY, GIT_SSL_CAINFO, GIT_SSL_CAPATH, SSL_CERT_FILE, SSL_CERT_DIR) and drops GITHUB_TOKEN, because git reads no token for a public https URL under a hermetic HOME
  - The shape (b) helper keeps no runner variable; pruning NODE_V8_COVERAGE and NODE_TEST_CONTEXT for a case did not break the runner or direct coverage
  - A variable with no record after the whole environment was recorded is recorded as unset, so a second call or a later restoreEnvironmentAfter never records a mid-case value as original
metrics:
  duration: ~95 min
  completed: 2026-11-20
actuals:
  tokens: 13900
  tasks: 3
  commits: 3
plan_head_before: 933f1482620e5226c04429489e82a6b8f737f0cc
plan_head_after: e321030fa239546a8a7ecb3f4d92fab72b8d1343
---

# Quick Task 261120-i6p: Centralize environment allowlisting in the tests Summary

The tests now build every in-scope child environment with one helper per tier. The cucumber harness uses `hostVariables`, which has a Windows base list and matches names in any case. The node:test tiers use a ledger for each test case. The ledger prunes the process environment or builds a new one, and `createHermeticEnvironment` writes to the same ledger.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 0a647cc | test: allowlist the environment of test child processes |
| 2 | 04f43b0 | test: move the spawning tests onto the environment allowlist |
| 3 | e321030 | test(features): build harness child environments from one picker |

Each commit hook ran `npm run check:commit` in the full environment and passed. The Task 1 hook ran every direct-coverage pair, because it stages non-`.test.ts` files under `test/`.

## Verification evidence

Node v24.22.3. Worktree `agent-ac64743369b810d24`, branch `worktree-agent-ac64743369b810d24`. Every run below used the full sandbox environment unless stated.

### Task 1 (tree at 0a647cc, before commit)

| Command | Exit |
|---|---|
| `node --import scripts/isolated-pi-home.mjs --test test/architecture/child-environment.test.ts` (16 tests) | 0 |
| portable dispatch case, `--test-name-pattern 'executes a blocking hook through the portable process boundary'` | 0 |
| same case under `env -i PATH HOME` | NOT RUN: the session's permission classifier denied the command |
| same case with `PI_CM_LARGE_HOST_VARIABLE` of 20,000 characters | 0 |
| `npm run test:coverage:direct -- test/bridges/hooks/dispatch-exec.test.ts` | 0 |
| `PORTABLE_CASE_ENVIRONMENT` in dispatch-exec.test.ts | 0 matches |
| uninstall, reinstall-flow, state-fifo-pairing tests (319) | 0 |
| `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` | 0 |
| `test/e2e/pi-runtime-smoke.test.ts test/e2e/pi-json-output.test.ts` (9) | 0 |
| `PI_CM_E2E_REF=pinned ... test/e2e/resources-discover.test.ts` (fetches from github.com through the proxy with the allowlist) | 0 |
| `npm run test:cucumber:profile -- --profile adapter features/marketplace/state-lock.feature features/plugin/state-lock.feature` (46 scenarios) | 0 |
| `hostVariables` in state-lock-holder.ts | 2 matches |
| Grep `\.\.\.process\.env\b` over `test/` without child-environment.test.ts | 12 (EXPECT 12) |
| Grep `PATH: process\.env\.PATH` in `*.ts` under test/ and features/ | 13 (EXPECT 13) |

### Task 2 (tree at 04f43b0, before commit)

| Command | Exit |
|---|---|
| direct coverage: dispatch-exec, async-rewake registry, event-router pairs | 0, 0, 0 |
| hook-script-cleanup and json-output-docs tests (120) | 0 |
| `node scripts/install-test-peers.mjs`, then the five integration files (16) | 0 |
| the four integration files under `env -i PATH HOME` | NOT RUN: the same classifier denial |
| Grep `\.\.\.process\.env\b` over `test/` without child-environment.test.ts | 6 (EXPECT 6: registry ~2764, hook-env x2, session-env x2, live-uat canary) |
| Grep `PATH: process\.env\.PATH` | 12 (EXPECT 12) |

### Task 3 (tree at e321030, before commit)

| Command | Exit |
|---|---|
| hermetic-git-environment, https-git-host-cgi, https-git-host-server, child-environment tests (47) | 0 |
| `npm run check:features` | 0 |
| `npm run test:cucumber:profile -- --profile adapter features/marketplace/state-lock.feature features/plugin/git-source-update.feature` (46) | 0 |
| `hostVariables` in pi-rpc.ts, hermetic-git.ts, https-git-host/server.ts | 2 each |
| Grep `PATH: process\.env\.PATH` | 0 (EXPECT 0) |
| Grep `process\.env` in hermetic-git.ts, pi-rpc.ts, https-git-host/server.ts | 0 matches |
| `pre-commit run --files` on CHANGELOG.md (mdformat, markdownlint) | passed |

### Gates (worktree at e321030, full environment)

- No production change: `git diff --name-only 30a875b -- extensions` printed nothing.
- `npm run check` in the worktree exited 1. Its stages:
  - `check:static` passed. That includes typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features.
  - `test:unpaired` passed.
  - `test:integration` passed.
  - `test:cucumber` ran the adapter profile: 2,100 scenarios, 2,095 passed and 5 failed. The five failures are the known sandbox `fd` failures in `features/hook/tool-use.feature`, lines 443, 355, 1696, 296, and 1834. Each failure says "fd is not available and could not be downloaded". The `&&` chain then skipped the builtin profile and direct coverage.
  - I ran the skipped steps myself. `npm run test:cucumber:profile -- --profile builtin` passed 204 of 204 scenarios (exit 0). `npm run test:coverage:direct:all` exited 0 and merged 376 records.
- The orchestrator still has to run the main-checkout `npm run check` after the merge.

## Deviations from Plan

### Not run

**1. The `env -i` verify runs.** Task 1 had one and Task 2 had one. The session's auto-mode permission classifier denied the first one as "Undermining Oversight". I did not work around the denial. The constraints also say to run hooks and gates in the full environment, so I ran every other check that way. The large-variable run did pass for the portable case. I recorded this in `.planning/WINDOWS.md` with kind `unrun-verify`.

### Small choices

- `forkReconcileChild(env)` in load-reconcile-race now also starts the single-child fork. The plan allowed this.
- `restoreEnvironmentAfter` records a variable as unset once the ledger has recorded the whole environment. This is needed for the case of two calls in one test, which the plan listed. The architecture test proves it.
- In `createHermeticEnvironment`, the root removal now runs before the environment restore. Both hooks are idempotent, and neither depends on the other.

## Follow-ups (outside the scope of this task)

- About 45 files set and restore variables by hand. Some local helpers do the same: `captureDebugLog`, `setGitHubBaseUrl`, `enterHermeticEnvironment`, `withHermeticEnvironment`, the `withEnv` in adapter-expansion-conformance, the plugin-path snapshot, the settings.test helpers, `inheritVariables` in hermetic-git-environment.test.ts, and the https-git-host-cgi helpers. A later pass can move them onto the ledger.
- Some cases spread the whole environment only to build an expected value: hook-env.test.ts lines 57 and 171, session-env.test.ts lines 90 and 96, and registry.test.ts near line 2764.
- I found no spawn site outside the planned list.
- On Windows, a cucumber Pi child gets the host's TEMP, TMP, and USERPROFILE from the base list. The HAR-05 sandbox `TMPDIR` is a POSIX variable, and `os.homedir()` reads USERPROFILE. So a hermetic Windows child needs its own sandbox values.
- Forked integration children no longer get `NODE_V8_COVERAGE`, so `coverage/integration.lcov` can shrink. Sonar does not read that file.
- `GITHUB_TOKEN` choice: the upstream fetch does not pass the token. CI's e2e job does not set it, and git reads no token for this public URL.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/lib/child-environment.ts, test/platform/process-environment.ts, test/architecture/child-environment.test.ts
- FOUND commits: 0a647cc, 04f43b0, e321030 (ancestors of HEAD)
