---
phase: "3"
slug: "system-git-transport-and-clone-shape"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-23"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (unit, architecture, integration, e2e); `@cucumber/cucumber` (profiles `adapter`, `builtin`) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/platform/git.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~30 seconds per owner test file; one feature file under both profiles 1 to 10 minutes; full ~40 minutes (`workflow.test_gate_timeout` 2400 s) |

---

## Sampling Rate

- **After every task commit:** the task's owner tests and `npm run test:coverage:direct -- <source>` for each touched pair; the hook runs `npm run check:commit`, which does not run cucumber, so a task that changes request rows also runs its feature files under both profiles
- **After every plan that changes rows:** the touched feature files, then their whole directory, under `--profile adapter` and `--profile builtin`
- **After every plan wave:** `npm run check` on the combined tree (the orchestrator's post-merge gate); the 5 known `fd` Glob failures in `features/hook/tool-use.feature` are sandbox failures, recorded and not counted as passes
- **Before `/gsd-verify-work`:** `npm run check` green on the phase's combined tree
- **Max feedback latency:** 120 seconds for owner unit runs; a feature file's profile runs take longer and run once per task that changes rows

---

## Per-Task Verification Map

Requirement-level map from `03-RESEARCH.md` "Validation Architecture", filled with the task IDs of `03-01-PLAN.md` to `03-17-PLAN.md`. "Unit run" means `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test <files>`; every unit task also runs `npm run test:coverage:direct -- <source>` for each touched pair. "Profile runs" means `npm run test:cucumber:profile -- --profile adapter <features>`, then the same with `--profile builtin`. "Static" means typecheck, ESLint, and `npm run fallow`. A scenario task records a RED run made with a local, uncommitted mutation (the plan names it).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SG-TRN-01, SG-TRN-07 | T-03-01 | Pi-owned `-c` pairs follow every hardening pair; `for-each-ref` runs on the local lane | unit (fake spawn + real git) | unit run of `test/platform/git-process.test.ts`; static | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | SG-TRN-01, SG-TRN-02 | T-03-02, T-03-03 | https-auth says `no-credential` or `rejected`; the v0 SHA refusal is `commit-missing`; a `remote:` copy stays `failed` | unit | unit run of `test/platform/git-failure-kind.test.ts test/shared/git-failure-classifiers.test.ts test/platform/git-process.test.ts test/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 1 | SG-TRN-02 | T-03-05 | an abbreviated sha is refused before any git run | unit + cucumber | unit run of `test/domain/source.test.ts`; profile run (adapter) with `--name 'Installing a plugin pinned to an abbreviated commit is refused before git runs'` | ❌ W0 (the offer fixture's `sha` and `ref` support, created in this task) | ⬜ pending |
| 03-02-02 | 02 | 1 | SG-TRN-02 | T-03-04 | a ref that starts with `-` is refused for plugins and for `marketplace add` | unit + cucumber | unit run of `test/domain/source.test.ts`; profile run (adapter) of `features/plugin/git-source.feature features/marketplace/url-source.feature`; `npm run check:features` | ✅ after 03-02-01 | ⬜ pending |
| 03-03-01 | 03 | 1 | SG-TRN-01 | T-03-06, T-03-08 | the CONNECT proxy tunnels only `github.com:443` to the stand-in and logs every tunnel | architecture (real git) | unit run of `test/architecture/github-device-flow-connect-proxy.test.ts test/architecture/https-git-host-server.test.ts` | ❌ W0 (`connect-proxy.ts` and its test, created in this task) | ⬜ pending |
| 03-03-02 | 03 | 1 | SG-TRN-01, SG-TRN-05, SG-TRN-06 | T-03-07 | the stand-in forwards the backend's refusal; a shell's `CLAUDE_CODE_PLUGIN_*` value reaches no child | architecture | unit run of `test/architecture/https-git-host-cgi.test.ts test/architecture/https-git-host-server.test.ts test/architecture/hermetic-git-environment.test.ts` | ✅ | ⬜ pending |
| 03-04-01 | 04 | 1 | SG-MIG-01, SG-TRN-05 | T-03-09, T-03-11 | a copy of an old clone drops `core.symlinks`, `core.ignorecase`, `core.filemode` and writes links; the timeout reader caps and defaults | unit + real git | unit run of `test/platform/git-timeout.test.ts test/platform/git.test.ts test/platform/git-ops-fake.test.ts test/orchestrators/plugin/clone-cache.test.ts`; static | ❌ W0 (`git-timeout.test.ts`, created in this task) | ⬜ pending |
| 03-04-02 | 04 | 1 | SG-TRN-01 | T-03-10 | an absent ref answers `undefined`; failures narrow on `GitCommandError` kinds only | unit + real git | unit run of `test/platform/git.test.ts test/platform/git-ops-fake.test.ts test/orchestrators/plugin/clone-cache.test.ts test/orchestrators/marketplace/shared.test.ts test/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| 03-04-03 | 04 | 1 | SG-TRN-01, SG-TRN-02, SG-TRN-05 | T-03-11 | `fetchCommit` unshallows only a shallow clone, one limit per command | unit + real git + cucumber | unit run of `test/platform/git.test.ts test/platform/git-ops-fake.test.ts test/edge/types.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/shared.test.ts test/integration/marketplace-layer-redeclare.test.ts test/integration/marketplace-add-seed-mirrors.test.ts`; profile run (adapter) of `features/marketplace/git-source.feature features/plugin/git-source.feature` | ✅ | ⬜ pending |
| 03-05-01 | 05 | 2 | SG-TRN-01, SG-TRN-07 | T-03-13 | every remote request carries the `insteadOf` pair only for github.com; `=` in the base is refused | unit + real git + cucumber | unit run of `test/shared/github-base-url.test.ts test/platform/git.test.ts`; profile runs of `features/plugin/fetch.feature` | ✅ | ⬜ pending |
| 03-05-02 | 05 | 2 | SG-TRN-01 | T-03-12, T-03-15, T-03-16 | Device Flow runs once after `no-credential`; the token lives only in a removed 0600 file | unit + architecture | unit run of `test/platform/git-one-shot-credential.test.ts test/platform/git.test.ts test/architecture/no-credential-leak.test.ts` | ❌ W0 (`git-one-shot-credential.test.ts`, created in this task) | ⬜ pending |
| 03-05-03 | 05 | 2 | SG-TRN-01 | T-03-14 | tag listings run on system git; only the Device Flow profile's Pi gets `https_proxy` | unit + architecture + cucumber | unit run of `test/platform/git.test.ts test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/dependency-tag-probe.test.ts test/architecture/hermetic-git-environment.test.ts test/architecture/github-device-flow-connect-proxy.test.ts`; profile runs of `features/marketplace/device-flow.feature features/plugin/info.feature features/plugin/git-source.feature features/plugin/install-dependencies.feature` | ✅ after 03-03-01 | ⬜ pending |
| 03-06-01 | 06 | 3 | SG-TRN-01, SG-TRN-02, SG-TRN-07 | T-03-17, T-03-19, T-03-20, T-03-53 | clone at depth 1 with `--branch=<ref>` as one word, no submodules, the `insteadOf` pair; the D-14 verbs bring a depth-1 clone, with and without `--branch`, to the remote's new commit (interim gate: a failure stops the plan) | unit + real git + cucumber | unit run of `test/platform/git.test.ts test/platform/git-ops-fake.test.ts test/orchestrators/marketplace/add.test.ts`; profile runs of `features/marketplace/add.feature` | ✅ | ⬜ pending |
| 03-06-02 | 06 | 3 | SG-TRN-02 | T-03-18 | the pin ladder ends with `HEAD` equal to the pin, else `pin-mismatch` | unit + real git + integration | unit run of `test/orchestrators/plugin/clone-cache.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts test/integration/auth-e2e.test.ts` | ✅ | ⬜ pending |
| 03-06-03 | 06 | 3 | SG-TRN-01 | T-03-20 | every clone row and cause chain re-baselined once, one commit per directory; the `fetch` row of `features/plugin/update.feature` changes and its PUP-2 `update` row waits for 03-09; no request leaves the stand-ins | cucumber | profile runs of `features/marketplace`, then `features/plugin/update.feature` and `features/plugin`, then `features/mcp-server/verdict-fetch.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 03-07-01 | 07 | 4 | SG-TRN-03 | T-03-21, T-03-23 | a stale marketplace re-clones into staging and swaps through `sources-backup/`; the ownership marker is written first | unit + cucumber | unit run of `test/persistence/locations.test.ts test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/add.test.ts`; profile runs of `features/marketplace/github-source.feature`; static | ❌ W0 (`clone-swap.test.ts`, created in this task) | ⬜ pending |
| 03-07-02 | 07 | 4 | SG-TRN-03, SG-TRN-06 | T-03-22, T-03-24 | an interrupted swap recovers; the keep variable keeps only an unreachable checkout with its manifest; the lock survives a long clone | unit | unit run of `test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/background-pass.test.ts` | ✅ after 03-07-01 | ⬜ pending |
| 03-07-03 | 07 | 4 | SG-TRN-03 | T-03-20, T-03-22 | marketplace update rows re-baselined once; every re-clone row carries the `insteadOf` pair to the stand-in; a checkout that cannot be moved aside (`EACCES`, read-only folder) is kept with a warning and replaced by the next update | cucumber | profile runs of `features/marketplace` and of `features/plugin/update.feature` (unchanged); `npm run check:features` | ❌ W0 (the read-only checkout folder Given, created in this task) | ⬜ pending |
| 03-08-01 | 08 | 4 | SG-TRN-04 | T-03-25 | a git marketplace's tags come from its remote, a directory's locally; the gate proves the remote read | unit + architecture | unit run of `test/platform/git.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts test/architecture/marketplace-tag-probe-remote.test.ts`; static | ❌ W0 (`marketplace-tag-probe-remote.test.ts`, moved from the offline test in this task) | ⬜ pending |
| 03-08-02 | 08 | 4 | SG-TRN-04 | T-03-26 | the tag copy fetches only the chosen commit | unit + real git | unit run of `test/orchestrators/plugin/install-cascade.test.ts test/orchestrators/plugin/update-constraint-gate.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/clone-cache.test.ts` | ✅ | ⬜ pending |
| 03-08-03 | 08 | 4 | SG-TRN-04 | T-03-25 | a constrained dependency finds a tag present at add and one pushed after it | cucumber | profile runs of `features/plugin/install-dependencies.feature`; `npm run check:features` | ❌ W0 (the marketplace release-tag step, created in this task) | ⬜ pending |
| 03-09-01 | 09 | 5 | SG-TRN-03, SG-MIG-01 | T-03-27, T-03-28, T-03-29, T-03-31 | a warm mirror swaps through `plugin-clones-backup/`; a mirror that cannot be replaced is never used (a scenario with a read-only mirror folder pins the `EACCES` form); the next refresh of a key clears its leftover backup | unit + cucumber | unit run of `test/orchestrators/plugin/clone-cache.test.ts test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/info.test.ts`; profile runs of `features/plugin/fetch.feature`; static; `npm run check:features` | ❌ W0 (the read-only mirror folder Given, created in this task) | ⬜ pending |
| 03-09-02 | 09 | 5 | SG-TRN-03, SG-TRN-06 | T-03-30 | the PUP-2 sync swaps with the keep rule; the D-14 wrappers are deleted | unit | unit run of `test/orchestrators/plugin/update-flow.test.ts test/orchestrators/marketplace/shared.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/marketplace/update.test.ts`; static | ✅ | ⬜ pending |
| 03-09-03 | 09 | 5 | SG-TRN-03 | T-03-20 | refresh rows re-baselined once, the PUP-2 row of `features/plugin/update.feature` with the `fetch` row's reason; every re-clone row carries the `insteadOf` pair to the stand-in | cucumber | profile runs of `features/plugin/update.feature`, then `features/plugin features/marketplace features/mcp-server/verdict-fetch.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 03-10-01 | 10 | 5 | SG-TRN-02 | T-03-34 | a non-tip pin installs through `--unshallow` from a v0 host | cucumber | profile runs with `--name "refuses fetches by SHA"` of `features/plugin/git-source.feature`; `npm run check:features` | ❌ W0 (the SHA-refusing git host Given, created in this task) | ⬜ pending |
| 03-10-02 | 10 | 5 | SG-TRN-06 | T-03-32 | an unreachable marketplace is kept only with the variable; the variable reaches only its scenario's Pi | architecture + cucumber | unit run of `test/architecture/hermetic-git-environment.test.ts`; profile runs of `features/marketplace/url-source-update.feature` | ❌ W0 (the keep Given and the `RpcGitEnvironment` members, created in this task) | ⬜ pending |
| 03-10-03 | 10 | 5 | SG-TRN-05 | T-03-33 | a held clone stops at the user's timeout, leaves nothing, and the retry succeeds | cucumber | profile runs of `features/marketplace/failed-add.feature`; `npm run check:features` | ❌ W0 (the timeout Given, created in this task) | ⬜ pending |
| 03-11-01 | 11 | 5 | SG-TRN-02 | T-03-35, T-03-52 | a marketplace ref that looks like a commit id with capital letters is refused before any lock, disk, or git access, as upstream's `wCn` refuses it; a lower-case one reaches git and fails clean as a missing ref | unit + cucumber | unit run of `test/orchestrators/marketplace/add.test.ts`; profile runs of `features/marketplace/url-source.feature` | ✅ | ⬜ pending |
| 03-11-02 | 11 | 5 | SG-TRN-03 | T-03-37 | a moved default branch and a moved tag are followed | cucumber | profile runs of `features/marketplace/git-source.feature`; `npm run check:features` | ❌ W0 (the default-branch and tag-move Givens, created in this task) | ⬜ pending |
| 03-11-03 | 11 | 5 | SG-TRN-03 | T-03-36 | an interrupted or dropped update leaves a usable checkout; the next update succeeds | cucumber | profile runs of `features/marketplace/git-source.feature`; `npm run check:features` | ❌ W0 (the interrupted-update Given, created in this task) | ⬜ pending |
| 03-12-01 | 12 | 6 | SG-TRN-01 | T-03-38 | the bundle types move unchanged; sign-in tested through `onAuthRequired`; no token in output | unit | unit run of `test/orchestrators/auth-host.test.ts test/platform/git-credential.test.ts test/platform/git-auth-callbacks.test.ts test/platform/git.test.ts`; static | ✅ | ⬜ pending |
| 03-12-02 | 12 | 6 | SG-TRN-01 | T-03-38 | no orchestrator test uses the callback builder or names a D-14 member | unit | unit run of `test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/shared.test.ts test/orchestrators/plugin/fetch.test.ts` | ✅ | ⬜ pending |
| 03-12-03 | 12 | 6 | SG-TRN-01 | T-03-39 | BLOCK F and BLOCK C name the live seams | static | `npm run lint`; `npm run fallow` | ✅ | ⬜ pending |
| 03-13-01 | 13 | 6 | SG-TRN-01 | T-03-41 | the fake reports only recorded members; no literal names a D-14 member | unit + integration + e2e | unit run of `test/platform/git-ops-fake.test.ts test/integration/marketplace-add-seed-mirrors.test.ts test/integration/marketplace-layer-redeclare.test.ts test/edge/types.test.ts test/e2e/import-command.test.ts`; static | ✅ | ⬜ pending |
| 03-13-02 | 13 | 6 | SG-TRN-01 | T-03-41 | git host failures are fabricated as system git reports them | unit | unit run of `test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/update-preflight.test.ts` | ✅ | ⬜ pending |
| 03-13-03 | 13 | 6 | SG-TRN-01 | T-03-40 | an edge command that bypasses its injected port fails at the git process trap | unit | unit run of `test/edge/handlers/marketplace/add.test.ts test/edge/handlers/marketplace/update.test.ts test/edge/handlers/plugin/bootstrap.test.ts test/edge/handlers/tools.test.ts`; static | ✅ | ⬜ pending |
| 03-14-01 | 14 | 6 | SG-MIG-01 | T-03-43, T-03-54 | an old marketplace clone loads unchanged and its next stale update brings links; one whose remote has not moved reports up to date after the freshness check alone and still serves its plugins | cucumber | profile runs with `--name "earlier version made"` of `features/marketplace/git-source.feature` (two scenarios); `npm run check:features` | ❌ W0 (the old-settings and linked-file Givens, created in this task) | ⬜ pending |
| 03-14-02 | 14 | 6 | SG-MIG-01 | T-03-43 | copies of an old mirror and an old marketplace clone write links | cucumber | profile runs with `--name "earlier version made"` of `features/plugin/git-source.feature features/plugin/install-dependencies.feature`; `npm run check:features` | ❌ W0 (the old-mirror Given, created in this task) | ⬜ pending |
| 03-14-03 | 14 | 6 | SG-TRN-06, SG-TRN-01 | T-03-42, T-03-44 | a link out of a git marketplace is refused and nothing outside changes; `plugin update` keeps an unreachable marketplace only when asked | cucumber | profile runs of `features/plugin/install.feature features/plugin/url-marketplace-update.feature`; `npm run check:features` | ✅ after 03-10-02 | ⬜ pending |
| 03-15-01 | 15 | 7 | SG-TRN-01 | T-03-46 | `GitOps` has no ref update or branch read; the vocabulary guard keeps the live homonyms | unit + architecture | unit run of `test/platform/git.test.ts test/platform/git-ops-fake.test.ts test/architecture/partial-vocabulary-guard.test.ts`; static | ✅ | ⬜ pending |
| 03-15-02 | 15 | 7 | SG-TRN-01 | T-03-45, T-03-46, T-03-47 | one transport; the leak gate scans the one-shot credential module; `isomorphic-git` leaves the dependency tree | unit + architecture + static | unit run of `test/platform/git.test.ts test/platform/git-ops-fake.test.ts test/shared/errors.test.ts test/architecture/no-credential-leak.test.ts test/architecture/no-shell-out.test.ts`; static; `npm run test:coverage:direct -- <git.ts, errors.ts, shared.ts>` | ✅ | ⬜ pending |
| 03-15-03 | 15 | 7 | SG-TRN-01 | T-03-46 | the rule pack bans `isomorphic-git` everywhere; a missing git is the git process module's to report | unit + static + cucumber | unit run of `test/platform/git.test.ts`; `npm run fallow`; profile runs of `features/marketplace/without-git.feature features/plugin/without-git.feature` | ✅ | ⬜ pending |
| 03-16-01 | 16 | 8 | SG-TRN-01 | T-03-48 | the classifier reads system git failures only; every live answer unchanged | unit | unit run of `test/shared/git-failure-classifiers.test.ts test/shared/errors.test.ts test/orchestrators/marketplace/shared.test.ts test/orchestrators/marketplace/update.test.ts`; static | ✅ | ⬜ pending |
| 03-16-02 | 16 | 8 | SG-TRN-01 | T-03-49 | no extension comment describes the old transport | static | `grep -rn 'isomorphic' extensions/pi-claude-marketplace` counts 0; typecheck, lint, `format:check` | ✅ | ⬜ pending |
| 03-16-03 | 16 | 8 | SG-TRN-01 | T-03-49 | the Device Flow harness and feature describe the D-SG-14 retry | cucumber | profile runs of `features/marketplace/device-flow.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 03-17-01 | 17 | 9 | SG-TRN-01, SG-TRN-05, SG-TRN-06, SG-TRN-07 | T-03-50 | the stack, integration, and structure pages describe system git and its variables | doc check | the task's `node -e` check of the pages against `package.json` and the tree | ✅ | ⬜ pending |
| 03-17-02 | 17 | 9 | SG-TRN-01 | T-03-50 | the architecture page counts and lists exactly the `NETWORK_SEAMS` files | doc check | the task's `node -e` comparison of ARCHITECTURE.md with `eslint.config.js` | ✅ | ⬜ pending |
| 03-17-03 | 17 | 9 | SG-TRN-01 to SG-TRN-07, SG-MIG-01 | T-03-51 | every D-SG outcome of this phase recorded from the SUMMARYs, 03-16's included: the upstream-parity refusal of capital-letter commit-id marketplace refs (D-SG-10), the criterion 5 reading (D-SG-11), and the Phase 4 probe-skip note (D-SG-16) | doc check | the task's `grep` check of `.planning/PROJECT.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each new test file, step, and fixture is created by the task that first needs it (TDD: the case is written and run red before the code), so no separate Wave 0 plan exists. The list below is what those tasks create.

- [ ] `features/lib/github-device-flow/connect-proxy.ts` and `test/architecture/github-device-flow-connect-proxy.test.ts` (03-03-01)
- [ ] `extensions/pi-claude-marketplace/platform/git-timeout.ts` and `test/platform/git-timeout.test.ts` (03-04-01)
- [ ] `extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts` and `test/platform/git-one-shot-credential.test.ts` (03-05-02)
- [ ] `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts`, `test/orchestrators/marketplace/clone-swap.test.ts`, and the backup getter rows of `test/persistence/locations.test.ts` (03-07-01)
- [ ] `test/architecture/marketplace-tag-probe-remote.test.ts`, moved from the offline test (03-08-01), and the marketplace release-tag step (03-08-03)
- [ ] the abbreviated-sha and dash-ref fixture support in `features/lib/git-plugin.ts` and the plugin publishing steps (03-02-01)
- [ ] the SHA-refusing git host Given, the git timeout and keep Givens, and the two optional `RpcGitEnvironment` members (03-10)
- [ ] the default-branch, tag-move, and interrupted-update Givens (03-11-02, 03-11-03)
- [ ] the read-only checkout folder Given and its writable-again When in `features/step_definitions/marketplace/checkout.steps.ts` (03-07-03)
- [ ] the read-only mirror folder Given and its writable-again When in `features/step_definitions/plugin/git-source.steps.ts` (03-09-01)
- [ ] `recordedCalls` in `test/platform/git-ops-fake.ts` (03-13-01)
- [ ] the old-settings Givens for a marketplace clone and a plugin mirror, and the linked-file Givens (03-14-01, 03-14-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A copy of an old clone with `core.symlinks` unset on Git for Windows; the Device Flow retry's `!`-prefixed one-shot helper under Git for Windows' `sh`; a marketplace checkout or plugin mirror held open (`EBUSY`/`EPERM` on rename) is kept or failed and retried | SG-MIG-01, SG-TRN-01, SG-TRN-03 | CI and this sandbox run Linux only; injected renames and a fake win32 host prove the branches, not Windows itself. The Linux `EACCES` form of the move-aside is not manual: the read-only folder scenarios of 03-07-03 and 03-09-01 pin it | No checkpoint in this phase: each branch is an `unrun-verify` windows entry that the plan's output appends (03-04, 03-05, 03-07, 03-09), and Phase 2's deferred macOS and Windows check (WINDOWS #120, #121) covers them at the pull request |
| A real GitHub clone, freshness check, and Device Flow sign-in over the public network | SG-TRN-01, SG-TRN-03, SG-TRN-07 | No test may reach the network; the https git host, the CONNECT proxy, and the Device Flow stand-ins serve the same protocol | Not run in this phase; the e2e suite (`npm run test:e2e`, CI only) exercises a pinned upstream ref |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s for owner unit runs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
