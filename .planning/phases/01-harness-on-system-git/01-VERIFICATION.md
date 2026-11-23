---
phase: 01-harness-on-system-git
verified: 2026-11-23T06:00:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - .github/workflows/ci.yml
  - .github/workflows/e2e-nightly.yml
  - .planning/phases/01-harness-on-system-git/01-01-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-01-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-02-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-02-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-03-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-03-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-04-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-04-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-05-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-05-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-06-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-06-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-07-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-07-SUMMARY.md
  - .planning/phases/01-harness-on-system-git/01-08-PLAN.md
  - .planning/phases/01-harness-on-system-git/01-08-SUMMARY.md
  - features/lib/git-clones.ts
  - features/lib/hermetic-git.ts
  - features/lib/https-git-host/cgi.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-rpc.ts
  - features/lib/real-subagent-child.ts
  - features/lib/ssh-git-host/host.ts
  - features/lib/ssh-git-host/launch.ts
  - features/lib/ssh-git-host/stub.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - features/support/pi-process.ts
  - package.json
  - test/architecture/hermetic-git-environment.test.ts
  - test/architecture/https-git-host-cgi.test.ts
  - test/architecture/https-git-host-server.test.ts
  - test/architecture/ssh-git-host.test.ts
  - test/e2e/upstream-marketplace.ts
  - test/integration/concurrent-install.test.ts
  - test/integration/ipc-child-environment.ts
  - test/integration/load-reconcile-race.test.ts
  - test/integration/marketplace-add-seed-mirrors.test.ts
  - test/integration/path-source-tag-install.test.ts
  - test/integration/pi-subagents-child-identity.test.ts
  - test/integration/project-install-adds-user-marketplace.test.ts
  - test/integration/subagent-hook-ownership.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/list-candidate-row.test.ts
  - test/orchestrators/plugin/list-flow.test.ts
  - test/orchestrators/plugin/marketplace-tag-probe.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/warm-mirror-seed.ts
  - test/platform/git-test-repository.ts
  - test/platform/git.test.ts
covered_digest: "v4:sha256:6e613d33d502507e6669c36e7ac812b10c73f031bfead884317a6e63f4dd2851"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the CI run of the phase's pull request and read the log of the static, integration, behavioral, e2e-tests, and direct-coverage jobs in ci.yml, and of e2e-nightly.yml."
    expected: "Each job log shows a `Show the git version` step that prints `git version <x>` before its test step."
    why_human: "The workflow steps exist in the files, but a CI log exists only after a CI run; a sandbox cannot produce it."
---

# Phase 1: Harness on System Git Verification Report

**Phase Goal:** The unit, integration, and cucumber suites build their fixture repositories and run every git operation with the system `git` binary under a hermetic environment, and the cucumber stand-ins can serve a product that speaks system git over HTTPS and SSH, before the product changes its transport.
**Verified:** 2026-11-23
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

The truths are the five ROADMAP success criteria. Plan `must_haves` add detail and
are folded into the evidence.

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Every fixture repository of the unit, integration, and cucumber suites is built by system `git`; the fixture builders no longer import `isomorphic-git` (SG-HRN-01) | VERIFIED | `grep` for value imports of `isomorphic-git` under `test/`, `features/`, and `scripts/` finds exactly five files: `test/platform/git.test.ts`, `test/orchestrators/plugin/{reinstall-flow,update-flow,update-preflight}.test.ts`, and `test/integration/auth-e2e.test.ts`. Each uses it only for the production module's contract (`git.Errors.*`, the `http` transport mock, `listRemotes`/`getConfigAll` oracles). No fixture is written with `git.init/add/commit/...`. All other hits (about 20 files) are comments. `test/platform/git-test-repository.ts` spawns `git` through `hermeticGitEnvironment`. Only other `git` spawns: `features/lib/hermetic-git.ts` (`runGit`), the CGI and SSH stub (`upload-pack`), and `test/e2e/upstream-marketplace.ts`, which deliberately keeps the shell environment (a comment states the reason; it is not a fixture). Re-ran 1276 unit cases (11 migrated suites) and 23 integration cases (6 suites): 0 failures. `npm run check` pieces from the parallel gate: static, unpaired, integration rc=0 (the cucumber and direct-coverage rows were still running when this report was written). |
| 2 | A git command a test runs sees no user, system, or sandbox-injected git config; with `GIT_CONFIG_COUNT` rewrites set, the suites pass and no request follows the rewrite (SG-HRN-01) | VERIFIED | The shell here has `GIT_CONFIG_COUNT=3` with `url.https://github.com/.insteadOf` values and `GIT_SSL_CAINFO` set. Under that environment: `hermetic-git-environment.test.ts` (92 cases across the four architecture suites, all pass), the 1276 unit cases, 23 integration cases, and 128 cucumber scenarios (`plugin/git-source`, `marketplace/git-source`, `plugin/git-source-update`, `plugin/install-dependencies`) pass. `hermeticGitEnvironment` returns exactly eight keys (`PATH`, `HOME`, `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL=/dev/null`, name/email) plus named additions. The planted-leak cases plant a rewrite via `GIT_CONFIG_COUNT` and `GIT_CONFIG_PARAMETERS` (replacement in key, matched prefix in value, pointed at a closed port), an `XDG_CONFIG_HOME` ignore file, `GIT_DIR`/`GIT_WORK_TREE` at a decoy, and dead proxies, then build a fixture and clone from the host: the clone holds the file, the host logged `info/refs` and `git-upload-pack` with 200, and the decoy head is unchanged. Forked IPC children use `ipcChildEnvironment`, built from scratch, which throws without `PI_CM_TEST_HOME`. |
| 3 | In the cucumber harness, a system `git` clone and a fetch by SHA from the HTTPS stand-in succeed with only the harness's CA trust, and the refusing arm makes the SHA fetch fail (SG-HRN-02) | VERIFIED | `https-git-host-server.test.ts` "HttpsGitHost with system git": shallow clone with only `GIT_SSL_CAINFO=<host cert>` succeeds; a git with no CA file fails with exit 128 and "certificate"; a commit no ref names is fetched by SHA over protocol v2 and v0; under `{ kind: "refuse-sha-want" }` the fetch fails with `Server does not allow request for unadvertised object`, the host logs only the `GET info/refs`, a full clone and `--unshallow` still succeed, a second repository still serves SHA fetches, and disarm and reset restore the default. The upload-pack settings travel as `-c` args of `git http-backend` (`cgi.ts`), not `GIT_CONFIG_*`. `features/support/pi-process.ts` gives every cucumber Pi `GIT_SSL_CAINFO: gitHost.certificatePath` beside `NODE_EXTRA_CA_CERTS`. No TLS verification bypass exists (`grep` for `sslVerify`, `GIT_SSL_NO_VERIFY`, `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized` in `features/`, `test/`, `scripts/`, `package.json` finds none). |
| 4 | In the cucumber harness, a system `git` clone from a `git@<host>:<path>` URL and an SSH probe launch both reach the SSH stand-in (stub `ssh` on `PATH`) and get scripted answers, with no real network (SG-HRN-03) | VERIFIED | `ssh-git-host.test.ts` passes: scp-like clone, `ssh://` with port, upstream's `core.sshCommand` form, SHA fetch into a shallow clone, unregistered host fails as unreachable (exit 255), traversal refused, probe answers (authenticated exit 1, denied 255, host-key 255, unknown 255, hold until killed), `ssh -G` with and without a proxy line, concurrent launches recorded as whole lines, and the same HEAD over HTTPS and SSH. `pi-process.ts` starts `SshGitHost` in `BeforeAll`, puts `sshHost.searchPath()` first on every Pi's `PATH`, resets it in `Before` and closes it in `AfterAll` and on startup failure. The stub only spawns `git upload-pack`; it never runs a real `ssh`. The planted-leak SSH case sets `GIT_SSH_COMMAND`, `GIT_SSH`, `SSH_AUTH_SOCK`, and an SSH-URL rewrite, and the clone still reaches the stand-in. The two review warnings (held-stub lifetime WR-01, kill-timing race WR-02) were fixed in `2a5adcc` and `2913837`; the new "ends a held probe on its own once its caller dies" case passes. |
| 5 | `test/architecture/hermetic-git-environment.test.ts` checks every variable SG-HRN-04 names, and the CI log of every job that runs git shows the git version (SG-HRN-04) | ? UNCERTAIN (human) | Test half VERIFIED: `INHERITED_VARIABLES` plants the `GIT_CONFIG_*` family, `GIT_SSL_CAINFO`, `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `SSH_AUTH_SOCK`, `SSH_ASKPASS`, the proxy variables in both cases, `XDG_CONFIG_HOME`, `GIT_TRACE*`, `GCM_*`, and `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`; the file asserts the exact key set of `hermeticGitEnvironment` (four forms), `cgiEnvironment` (both policies), `uploadPackEnvironment` (two forms), `ipcChildEnvironment` (two forms plus the throw), and `rpcChildEnvironment` (seven cases). All pass. CI half: `ci.yml` has a `Show the git version` step (`run: git --version`) in `static`, `integration`, `behavioral`, `e2e-tests`, and `direct-coverage`, each before its test step, and `e2e-nightly.yml` has one; both files parse as YAML. `package.json` `test:e2e`, `test:e2e:nightly`, and `test:coverage:e2e` set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`. The printed log line needs a CI run. |

**Score:** 4/5 truths verified (0 present, behavior-unverified; 1 awaiting human confirmation of the CI log)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `features/lib/hermetic-git.ts` | Suite-wide hermetic git environment with named additions | VERIFIED | `HermeticGitVariables`, `hermeticGitEnvironment`, `runGit`; consumed by the unit runner, CGI, SSH launch |
| `test/platform/git-test-repository.ts` | System-git runner, fixture repository, checkout handle | VERIFIED | Imports `hermeticGitEnvironment`; no `isomorphic-git` import; `runSystemGit`, `initGitTestCheckout`, `createGitTestRepository` used by migrated suites |
| `test/orchestrators/plugin/warm-mirror-seed.ts` | Warm mirror seed on system git | VERIFIED | Consumer suites pass |
| `features/lib/git-clones.ts` | Clone inspection on system git | VERIFIED | Uses `runGit`; exercised by cucumber steps (128 scenarios pass); no direct unit test (see IN-03) |
| `features/lib/https-git-host/{cgi,server}.ts` | SHA-want policies, refusing arm, `repositoriesRoot` | VERIFIED | Tests above |
| `features/lib/pi-rpc.ts` | `GIT_SSL_CAINFO` and `PATH` in Pi's git environment | VERIFIED | `rpcChildEnvironment` copies both; wired in `pi-process.ts` |
| `features/lib/ssh-git-host/{launch,stub,host}.ts` | SSH stand-in | VERIFIED | Tests above; wired in `pi-process.ts` and `real-subagent-child.ts` |
| `test/integration/ipc-child-environment.ts` | From-scratch IPC child environment | VERIFIED | Used by `concurrent-install` and `load-reconcile-race` (grep and passing runs) |
| `.github/workflows/{ci,e2e-nightly}.yml` | Git version step | VERIFIED (file) | Log output is the human item |
| `package.json` | e2e run variable | VERIFIED | Three scripts set it |
| `.planning/STATE.md` | Re-baseline record for Phase 3 | VERIFIED | Counts re-measured: 79 `Then the git host receives these requests:` tables in 19 files and 7 `Then pi routes these github requests:` tables, as recorded; the 500-on-upload-pack-error note and the five kept isomorphic-git files are recorded |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `git-test-repository.ts` | `hermetic-git.ts` | `hermeticGitEnvironment(call.home, call.variables)` | WIRED | line 66 |
| `https-git-host/cgi.ts` | `hermetic-git.ts` | `...hermeticGitEnvironment(home)` | WIRED | line 84 |
| `ssh-git-host/launch.ts` | `hermetic-git.ts` | `uploadPackEnvironment` | WIRED | line 185 |
| `pi-process.ts` | `ssh-git-host/host.ts` | `SshGitHost.start`, `searchPath()`, `reset`, `close` | WIRED | lines 162-315 |
| `pi-process.ts` | `pi-rpc.ts` | `GIT_SSL_CAINFO: gitHost.certificatePath` | WIRED | line 173 |
| `installation.steps.ts` | `git-clones.ts` | `readGitClones` | WIRED | cucumber steps pass |
| `concurrent-install` / `load-reconcile-race` | `ipc-child-environment.ts` | `ipcChildEnvironment(...)` | WIRED | suites pass |
| `hermetic-git-environment.test.ts` | cgi, launch, ipc, rpc builders | imports and exact-key assertions | WIRED | 92 cases pass |

### Data-Flow Trace (Level 4)

Not applicable: the phase changes test harness code, with no rendered dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Hermetic, HTTPS-host, CGI, and SSH stand-in suites under the sandbox's `GIT_CONFIG_COUNT=3` | `node --import scripts/isolated-pi-home.mjs --test test/architecture/{hermetic-git-environment,https-git-host-server,https-git-host-cgi,ssh-git-host}.test.ts` | 92/92 pass | PASS |
| Migrated unit suites | same runner, 11 files | 1276/1276 pass | PASS |
| Migrated integration suites | same runner, 6 files | 23/23 pass | PASS |
| Git-source cucumber features, adapter profile | `node scripts/cucumber.mjs --profile adapter features/plugin/git-source.feature features/marketplace/git-source.feature features/plugin/git-source-update.feature features/plugin/install-dependencies.feature` | 128/128 scenarios, 16 hooks pass | PASS |
| Parallel full gate | `.../gates/phase1-final/summary.txt` | static, unpaired, integration rc=0; cucumber and direct coverage not yet written | PARTIAL (reported, not relied on) |

### Probe Execution

No probe scripts declared or found for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SG-HRN-01 | 01-01, 01-03, 01-04, 01-05, 01-08 | Suites build fixtures and run every git with system git under a hermetic environment | SATISFIED | Truths 1 and 2 |
| SG-HRN-02 | 01-06 | HTTPS stand-in trusted via `GIT_SSL_CAINFO`, serves fetch-by-SHA, refusing arm | SATISFIED | Truth 3 |
| SG-HRN-03 | 01-07 | SSH probe and transport through a stand-in, no real network | SATISFIED | Truth 4 |
| SG-HRN-04 | 01-02, 01-05, 01-08 | Hermetic test fails on a leaked steering variable; CI logs git version | SATISFIED in code; CI log pending | Truth 5 |

All four IDs appear in plan frontmatter and in `REQUIREMENTS.md`. `REQUIREMENTS.md` maps only these four to Phase 1, so there are no orphaned requirements. The traceability table still reads "Pending"; the orchestrator updates it with the phase close.

### Prohibitions (`must_haves.prohibitions`, all `verification: test`)

| Prohibition | Status | Enforcement evidence |
| ----------- | ------ | -------------------- |
| SG-HRN-01: no suite git reads or changes the developer's git config, credential stores, or repositories | VERIFIED | Exact-key tests on every builder, plus the planted-leak real clones with a decoy repository whose head is asserted unchanged |
| SG-HRN-02: no TLS verification bypass for the stand-in | VERIFIED | The no-CA clone fails certificate verification; no bypass setting exists anywhere in `features/`, `test/`, `scripts/` |
| SG-HRN-03: never start the real `ssh` or use the developer's agent or keys | VERIFIED | The stub runs only `git upload-pack`; an unregistered host fails as unreachable; the planted `SSH_AUTH_SOCK`/`GIT_SSH*` case still reaches the stand-in |

None is flagged as unverified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 41 files changed in the phase | n/a | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER` | none found | Clean |

Open review items (non-blocking, left in `01-REVIEW.md`; the two warnings are fixed):

- IN-01: `ssh -G` for an unregistered host exits 255; real OpenSSH prints a config. No product code runs `ssh -G` yet.
- IN-02: stale comment says the stub reads only `GIT_PROTOCOL`; it also reads `PATH`.
- IN-03: `readGitClones` has no direct unit test (the cucumber steps cover it).
- IN-04: no minimum git version is asserted; CI only logs it (git 2.43.0 here).
- IN-05: the SSH probe, `-G`, and proxy arms have no scenario consumer in this phase. The ROADMAP says Phase 4 consumes them.

### Environment Notes (not gaps)

- `fd` is absent here, so five Glob scenarios in `features/hook/tool-use.feature` fail before and after the phase; none of the checks above touch them.
- I did not re-run the full cucumber and direct-coverage gates; the parallel gate had not written those rows when this was written.

### Human Verification Required

#### 1. CI logs show the git version

**Test:** Open the CI run of the phase's pull request. Read the logs of the `static`, `integration`, `behavioral` (all matrix legs), `e2e-tests`, and `direct-coverage` jobs in `ci.yml`, and of `e2e-nightly.yml` when it runs.
**Expected:** Each shows the `Show the git version` step printing `git version <x>` before its tests.
**Why human:** A CI log exists only after a CI run.

### Gaps Summary

No gaps. All four requirements have code and test evidence, and every plan `must_haves` truth I checked holds in the tree. The only open item is the CI log of the git version (success criterion 5, second half), which needs a CI run.

---

_Verified: 2026-11-23_
_Verifier: Claude (gsd-verifier)_
