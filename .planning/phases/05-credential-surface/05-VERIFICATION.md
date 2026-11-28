---
phase: 05-credential-surface
verified: 2026-11-28T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 3
  total: 3
  not_honored: []
human_verification:
  - test: "On a machine with `gh auth login` and `gh auth setup-git` (or Git Credential Manager), run `/claude:plugin marketplace add <owner>/<private-repo>` and then install a plugin from it"
    expected: "The marketplace clones and the plugin installs over HTTPS with the helper's credential. Pi shows no prompt and no device code. The helper entry stays in place."
    why_human: "No test may reach a real remote host. The scenarios use `credential.helper=store` and a recording helper against the loopback https git host, not a real gh or GCM helper."
  - test: "On Windows, add a private GitHub marketplace and install a git-source plugin with ssh configured and not configured (SG-SSH-05 checks, `sshShowsDirectGitHubThroughGit`)"
    expected: "The transport order and the ssh checks match Claude Code's Windows order, and no command waits for input"
    why_human: "CI and this sandbox run Linux only. The Windows path is unit-tested with fakes only."
  - test: "With a real ssh key loaded in the agent and registered on github.com, add a private GitHub marketplace"
    expected: "The `ssh -T git@github.com` probe reports configured, the clone goes over ssh, and Pi asks for nothing"
    why_human: "Tests never run real ssh. The scenarios use the ssh stand-in, so the real ssh answer and timing are not exercised."
covered_files:
  - ".planning/phases/05-credential-surface/05-01-PLAN.md"
  - ".planning/phases/05-credential-surface/05-01-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-02-PLAN.md"
  - ".planning/phases/05-credential-surface/05-02-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-03-PLAN.md"
  - ".planning/phases/05-credential-surface/05-03-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-04-PLAN.md"
  - ".planning/phases/05-credential-surface/05-04-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-05-PLAN.md"
  - ".planning/phases/05-credential-surface/05-05-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-06-PLAN.md"
  - ".planning/phases/05-credential-surface/05-06-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-07-PLAN.md"
  - ".planning/phases/05-credential-surface/05-07-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-08-PLAN.md"
  - ".planning/phases/05-credential-surface/05-08-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-09-PLAN.md"
  - ".planning/phases/05-credential-surface/05-09-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-10-PLAN.md"
  - ".planning/phases/05-credential-surface/05-10-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-11-PLAN.md"
  - ".planning/phases/05-credential-surface/05-11-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-12-PLAN.md"
  - ".planning/phases/05-credential-surface/05-12-SUMMARY.md"
  - ".planning/phases/05-credential-surface/05-13-PLAN.md"
  - ".planning/phases/05-credential-surface/05-13-SUMMARY.md"
  - "CHANGELOG.md"
  - "README.es.md"
  - "README.md"
  - "docs/competitive-analysis/pi-plugins.md"
  - "docs/json-output.md"
  - "docs/output-catalog.md"
  - "eslint.config.js"
  - "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts"
  - "extensions/pi-claude-marketplace/domain/github-transport.ts"
  - "extensions/pi-claude-marketplace/domain/source.ts"
  - "extensions/pi-claude-marketplace/orchestrators/auth-host.ts"
  - "extensions/pi-claude-marketplace/orchestrators/github-transport.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/platform/git-failure-kind.ts"
  - "extensions/pi-claude-marketplace/platform/git-process.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts"
  - "extensions/pi-claude-marketplace/shared/errors.ts"
  - "extensions/pi-claude-marketplace/shared/fs-utils.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
  - "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  - "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
  - "extensions/pi-claude-marketplace/shared/notification-json.ts"
  - "extensions/pi-claude-marketplace/shared/notification-resolve.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "extensions/pi-claude-marketplace/shared/notification-wire.ts"
  - "features/lib/github-redirect/connect-proxy.ts"
  - "features/lib/github-redirect/extension.ts"
  - "features/lib/github-redirect/routing.ts"
  - "features/lib/hermetic-git.ts"
  - "features/lib/https-git-host/server.ts"
  - "features/lib/pi-rpc.ts"
  - "features/lib/pi-tui.ts"
  - "features/lib/user-git-programs.ts"
  - "features/marketplace/credentials.feature"
  - "features/marketplace/github-transport.feature"
  - "features/plugin/credentials.feature"
  - "features/step_definitions/command.steps.ts"
  - "features/step_definitions/git-host.steps.ts"
  - "features/step_definitions/marketplace/background-update.steps.ts"
  - "features/support/github-redirect.ts"
  - "features/support/world.ts"
  - "rule-packs/architecture.json"
  - "schema/claude-plugin.schema.json"
  - "test/architecture/catalog-uat/catalog-wire.test.ts"
  - "test/architecture/gate-targets.ts"
  - "test/architecture/github-connect-proxy.test.ts"
  - "test/architecture/github-redirect.test.ts"
  - "test/architecture/hermetic-git-environment.test.ts"
  - "test/architecture/https-git-host-server.test.ts"
  - "test/architecture/json-output-docs.test.ts"
  - "test/architecture/no-credential-leak.test.ts"
  - "test/architecture/no-shell-out.test.ts"
  - "test/architecture/no-test-only-production-surface.test.ts"
  - "test/architecture/no-token-variable-read.test.ts"
  - "test/architecture/pi-tui-notices.test.ts"
  - "test/architecture/wire-schema.test.ts"
  - "test/domain/github-plugin-transport.test.ts"
  - "test/domain/github-transport.test.ts"
  - "test/edge/command-run.test.ts"
  - "test/edge/completions/data.test.ts"
  - "test/edge/completions/provider.test.ts"
  - "test/edge/handlers/marketplace/add.test.ts"
  - "test/edge/handlers/marketplace/info.test.ts"
  - "test/edge/handlers/marketplace/list.test.ts"
  - "test/edge/handlers/marketplace/remove.test.ts"
  - "test/edge/handlers/marketplace/update.test.ts"
  - "test/edge/handlers/plugin/bootstrap.test.ts"
  - "test/edge/handlers/plugin/enable-disable.test.ts"
  - "test/edge/handlers/plugin/import.test.ts"
  - "test/edge/handlers/plugin/list.test.ts"
  - "test/edge/handlers/plugin/pending.test.ts"
  - "test/edge/handlers/plugin/reinstall.test.ts"
  - "test/edge/handlers/plugin/uninstall.test.ts"
  - "test/edge/register.test.ts"
  - "test/integration/marketplace-add-seed-mirrors.test.ts"
  - "test/integration/marketplace-layer-remove.test.ts"
  - "test/orchestrators/auth-host.test.ts"
  - "test/orchestrators/github-transport.test.ts"
  - "test/orchestrators/marketplace/add.test.ts"
  - "test/orchestrators/marketplace/clone-swap.test.ts"
  - "test/orchestrators/marketplace/shared.test.ts"
  - "test/orchestrators/marketplace/update.test.ts"
  - "test/orchestrators/plugin/carried-marketplace-adds.test.ts"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/dependency-bindings.test.ts"
  - "test/orchestrators/plugin/dependency-move.test.ts"
  - "test/orchestrators/plugin/dependency-tag-probe.test.ts"
  - "test/orchestrators/plugin/fetch.test.ts"
  - "test/orchestrators/plugin/info.test.ts"
  - "test/orchestrators/plugin/install-cascade.test.ts"
  - "test/orchestrators/plugin/install-clone-probe.test.ts"
  - "test/orchestrators/plugin/install-flow-cascade-context.test.ts"
  - "test/orchestrators/plugin/install-flow-fixture.ts"
  - "test/orchestrators/plugin/install-flow-ledger.test.ts"
  - "test/orchestrators/plugin/install-flow-planning.test.ts"
  - "test/orchestrators/plugin/install-outcome.test.ts"
  - "test/orchestrators/plugin/install.messaging.test.ts"
  - "test/orchestrators/plugin/marketplace-tag-probe.test.ts"
  - "test/orchestrators/plugin/reinstall-flow.test.ts"
  - "test/orchestrators/plugin/update-constraint-gate.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
  - "test/platform/git-failure-kind.test.ts"
  - "test/platform/git-ops-fake.test.ts"
  - "test/platform/git-process.test.ts"
  - "test/platform/git.test.ts"
  - "test/shared/errors.test.ts"
  - "test/shared/git-failure-classifiers.test.ts"
  - "test/shared/notification-dispatch.test.ts"
  - "test/shared/notification-grammar.test.ts"
  - "test/shared/notification-json.test.ts"
  - "test/shared/notification-resolve.test.ts"
  - "test/shared/notification-types.test.ts"
  - "test/shared/notification-wire.test.ts"
covered_digest: "v4:sha256:868c010a2a303c267ed6097b77958c3bc3ddb0800637fe0cc1eddf742ecc3f8c"
---

# Phase 5: Credential Surface Verification Report

**Phase Goal:** Git authenticates only through what the machine already holds, the extension keeps no git token of its own, Device Flow is removed or kept in the form discuss chose, and a user who stored a token through Device Flow keeps working with no action.
**Verified:** 2026-11-28 (HEAD d5506af, branch features/system-git)
**Status:** human_needed
**Re-verification:** No. This is the first verification.

Discuss chose removal (D-SG-27), no runtime notice (D-SG-28), and documentation only for GitLab token expiry (D-SG-29). The code matches these choices.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC1 / SG-AUTH-01: a machine with an ssh key or agent, or a git credential helper, adds a private marketplace and installs from it with no prompt. With only `GITHUB_TOKEN`/`GH_TOKEN` set and no helper, the private clone fails as an auth failure, and the token is in no URL, header, or argument. | VERIFIED | `features/marketplace/credentials.feature`: the stored-credential add and update scenarios, and two token-variable scenarios (url and github source) that check the results, the git host's request paths and headers, the ssh launches, and `pi routes no github request`. `features/plugin/credentials.feature`: stored-credential install and update, and a token-variable install. The ssh half: `features/marketplace/github-transport.feature:6` and `ssh-source.feature`. `test/architecture/no-token-variable-read.test.ts`: no extension module names the three token variables, and the scan visits modules that read `process.env`. The token-variable Given asserts that Pi received the variables (B WR-02). |
| 2 | SC2 / SG-AUTH-02: Device Flow is gone and no command shows a device code. An autoapply load and the background autoupdate pass never wait for input. PROJECT.md restates the AAP, autoapply, and D-PL8-12 rules. | VERIFIED | The modules are deleted (see truth 4). The no-credential add and install fail as `authentication required` with one `cascade` result. The autoapply reload scenario and two background-update scenarios finish with no notice and no prompt. The `tui session reports no notice` oracle now sees error and warning notices (CR-01, with a discrimination check). PROJECT.md: AAP-D1 (line 2098), D-PL8-12 (line 2237), and NFR-5 (line 1958) carry the 2026-11-27 D-SG-27 amendments. |
| 3 | SC3 / SG-AUTH-03: a token stored through Device Flow keeps working over HTTPS with no action, and the extension deletes no stored credential. The notice follows Q5 (none, D-SG-28). Cucumber pins each. | VERIFIED | `x-access-token` store entries work for marketplace add, marketplace update, the background update, plugin install, and plugin update. Each scenario then checks that the store still holds the entry. "A failed add that never sends the stored GitHub credential leaves it in the credential store." "...leaves the erase to git (SG-AUTH-03)" checks that the recording helper sees exactly `get` then `erase`. A planted `git credential reject` failed it (05-REVIEW-FIX B WR-01). `GitSubcommand` has no `credential` member (`platform/git-process.ts:137-147`). No runtime notice exists, as D-SG-28 decided. |
| 4 | The D-SG-27 deletion list is gone: `domain/github-auth.ts`, `domain/auth-registry.ts`, `platform/git-credential.ts`, `platform/git-one-shot-credential.ts`, the `credentialOps`/`deviceFlowHttp`/`authMemo` threading, `features/marketplace/device-flow.feature`, and `features/lib/github-device-flow/` | VERIFIED | `ls` finds none of these files. `git grep -i "device.flow\|deviceflow\|device_code\|user_code"` outside `.planning` and CHANGELOG finds only historical rows in the cucumber skill's layout record and one sentence in `docs/json-output.md`. `grep` finds no `authMemo`, `credentialOps`, or `deviceFlowHttp` under `extensions/`. |
| 5 | The gate config shrinks with the deletions: `fetch-chokepoint` exempts only `platform/hosted-manifest-fetch.ts`, `GIT_PROCESS_IMPORTERS` is `platform/git.ts` alone, and `NETWORK_SEAMS` has 16 entries without auth-host | VERIFIED | `rule-packs/architecture.json` fetch-chokepoint `exclude` has one file. `eslint.config.js:43` lists one importer. The `NETWORK_SEAMS` array lists 16 files, and `auth-host` appears in none of `eslint.config.js`, `.fallowrc.json`, or the rule pack. |
| 6 | The `device-flow-prompt` kind leaves the types, wire, and schema, and `schemaVersion` stays 1 | VERIFIED | No match in `extensions/` or `schema/claude-plugin.schema.json`. `test/architecture/wire-schema.test.ts` passes. `docs/json-output.md:166` states the version rule. |
| 7 | git runs non-interactively and once: D-SG-05's environment is unchanged, there is no sign-in retry, and a refused credential maps to `StoredCredentialRejectedError` for the bundle's host only | VERIFIED | `platform/git-process.ts:323,668-670` (`credential.interactive=false`, `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS`, `GCM_INTERACTIVE=never`). `platform/git.ts:349-370` `runWithAuthBundle` runs the request once. `test/platform/git.test.ts`, `test/platform/git-process.test.ts`, and `test/architecture/hermetic-git-environment.test.ts` pass. |
| 8 | `orchestrators/auth-host.ts` is one pure host binding, `authBundleFor`, plus `NO_STORED_CREDENTIAL_CAUSE`. The bundle is `{ host }`. The module stays in the credential-leak scan. | VERIFIED | Read in full: it does no I/O and has no `platform/git*` import. `test/orchestrators/auth-host.test.ts` and `test/architecture/no-credential-leak.test.ts` pass (auth-host and update-flow were added back to `CREDENTIAL_LEAK_TARGETS`, A WR-02). |
| 9 | The records and docs: PROJECT.md has D-SG-27..29 and dated amendments (D-SG-14, D-BG-1101/1102, D-PL9-11, D-1-01, D-79-03, D-UTR-05, AUTH-D02 and others). README.md and README.es.md match. CHANGELOG has one `[Unreleased]` entry. | VERIFIED | `.planning/PROJECT.md:2626-2628` and the amendment lines. `README.md:42-70` and `README.es.md:42-70` have the same structure and commands (`gh auth setup-git`, GCM, `glab auth setup-git`, `git credential reject` with `username=x-access-token` / `oauth2`). CHANGELOG.md line 5 has one entry with four sub-bullets. |

**Score:** 9/9 truths verified. None is present but behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | Pure host binding | VERIFIED | 38 references to `authBundleFor` across the extension |
| `extensions/pi-claude-marketplace/platform/git.ts` | Single-run auth mapping | VERIFIED | `runWithAuthBundle` |
| `features/marketplace/credentials.feature` | SG-AUTH-01/02/03 pins | VERIFIED | 14 scenarios, all pass |
| `features/plugin/credentials.feature` | SG-AUTH-01/03 pins for plugins | VERIFIED | 5 scenarios, all pass |
| `test/architecture/no-token-variable-read.test.ts` | Token-variable scan | VERIFIED | 2 cases pass |
| `features/lib/github-redirect/` | Renamed harness, one route | VERIFIED | Used by every routed credentials scenario |
| Deleted modules (4 source, the feature, and the stand-in) | Absent | VERIFIED | Missing as intended |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| marketplace add/update, PUP-2 sync, plugin probes, tag probes | `authBundleFor` | `canonicalCloneUrl(source)` | WIRED | Per 05-REVIEW part A, confirmed by grep |
| `platform/git.ts` | `platform/git-process.ts` | sole importer | WIRED | `GIT_PROCESS_IMPORTERS` |
| github-redirect harness | git host | CONNECT github.com:443 | WIRED | Each scenario's `pi routes these github requests` table |

### Data-Flow Trace (Level 4)

Not applicable. The phase renders no dynamic UI data. The auth bundle is derived from the clone address with no I/O.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Credentials pins on HEAD (adapter) | `node scripts/cucumber.mjs --profile adapter features/marketplace/credentials.feature features/plugin/credentials.feature` | 19 scenarios, 311 steps passed | PASS |
| Review-fix scenarios (WR-01 refresh hint, CR-01 oracle) | `node scripts/cucumber.mjs --profile adapter features/marketplace/github-refresh.feature features/marketplace/background-update.feature` | 16 scenarios, 230 steps passed | PASS |
| Token scan, leak scan, auth-host, marketplace shared, hermetic git env, git, git-process | `node --import scripts/isolated-pi-home.mjs --test <7 files>` (`GIT_CONFIG_*` unset) | 613/613 pass | PASS |
| Wire schema, tui-notices oracle, https git host, constraint gate, marketplace tag probe | `node --import scripts/isolated-pi-home.mjs --test <5 files>` | 83/83 pass | PASS |

The first unit run left out `--import scripts/isolated-pi-home.mjs`. Two D-SG-18/SG-SSH-05 cases in `shared.test.ts` then failed, because the refusing ssh stand-in was not on PATH. The sandbox has no `ssh` binary, so no real ssh ran. With the import, as the npm scripts run them, they pass.

The orchestrator's gate on 465d1c2 is recorded and was not re-run here: static, unpaired, integration, and direct coverage passed; adapter 2418/2423, where the 5 failures are the known `fd` Glob baseline in `features/hook/tool-use.feature`; builtin 261/261.

### Probe Execution

Not applicable. The phase declares no `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SG-AUTH-01 | 05-01, 05-06, 05-08..05-11 | git auth only through what the machine holds, and no token variable is read | SATISFIED | Truths 1, 4, 7, 8 |
| SG-AUTH-02 | 05-01..05-07, 05-13 | Device Flow removed, and the AAP/autoapply/D-PL8-12 rules restated | SATISFIED | Truths 2, 4, 5, 6, 9 |
| SG-AUTH-03 | 05-01, 05-10, 05-11, 05-13 | Stored token keeps working, nothing is deleted, notice per Q5 | SATISFIED | Truths 3, 7, 9 |

No orphaned requirements. REQUIREMENTS.md still shows them as Pending. Updating that is the orchestrator's job.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (3/3: D-SG-27, D-SG-28, D-SG-29).

### Anti-Patterns Found

The phase diff (`9debd0d..HEAD`, 80 commits, 184 files) adds no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder text, or skipped tests.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `platform/process-run.ts` | - | `ProcessRequest.input` / stdin pipe is unused in production (review A IN-02, skipped) | Info | Dead path, no behavior |
| `features/lib/github-redirect/connect-proxy.ts` | - | The CONNECT proxy does not record `Proxy-Authorization` (B IN-06, half skipped) | Info | Covered at code level: no extension module names a token variable, and git reads none |
| `orchestrators/plugin/{materialize-latest,update-swap,dependency-move}.ts` | - | The notification context is threaded only for the `listsSourceTags` boolean (A WR-03 residual) | Info | Refactor left for later |
| `orchestrators/plugin/update-constraint-gate.ts` | - | 05-09's truth said the marketplace tag listing runs "with no bundle". WR-03 now always passes `authBundleFor(...)`. | Info | The bundle does no I/O, and which runs list tags is unchanged, so the NFR-5 intent of the truth holds |

### Open Question (user decision, not a gap)

05-REVIEW-FIX A IN-01: the constraint gate skips the tag listing of a git-source dependency when there is no notification context (the autoupdate cascade). The path arm still lists its marketplace's tags in the same run (D-SG-09). No recorded decision keeps the skip since D-SG-27. Two options: record it as a divergence with a decision ID, or remove it for parity. No phase-5 must-have depends on the answer.

### Human Verification Required

### 1. Real gh / Git Credential Manager helper

**Test:** On a machine with `gh auth login` and `gh auth setup-git` (or GCM), add a private GitHub marketplace and install a plugin from it.
**Expected:** Both succeed over HTTPS with no prompt from Pi and no device code, and the helper entry stays.
**Why human:** No test may reach a real remote host. The scenarios use the `store` helper and a recording helper against the loopback git host.

### 2. Windows SG-SSH-05 checks

**Test:** On Windows, add a private GitHub marketplace and install a git-source plugin, with ssh configured and with ssh not configured.
**Expected:** Claude Code's Windows transport order, with no wait for input.
**Why human:** Linux-only CI and sandbox. The Windows path is unit-tested with fakes.

### 3. Real ssh against github.com

**Test:** With a real ssh key registered on github.com, add a private GitHub marketplace.
**Expected:** The probe reports configured, the clone goes over ssh, and Pi asks for nothing.
**Why human:** Tests never run real ssh.

### Gaps Summary

None. Every roadmap success criterion and every merged plan truth is backed by code and passing tests on HEAD d5506af. The status is `human_needed` only because of the three deferred environment checks above.

---

_Verified: 2026-11-28_
_Verifier: Claude (gsd-verifier)_
