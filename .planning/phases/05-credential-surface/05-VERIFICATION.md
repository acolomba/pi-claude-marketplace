---
phase: 05-credential-surface
verified: 2026-11-28T04:07:13Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/9
  previous_head: d5506af
  reason: "ef91ed9 and eeb15e7 removed the constraint gate's tag-listing skip (D-SG-30) after the first verification"
  gaps_closed:
    - "Open question 05-REVIEW-FIX A IN-01 (the constraint gate skipped a git-source dependency's tag listing with no notification context) is settled by D-SG-30: the skip is removed"
  gaps_remaining: []
  regressions: []
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
  - "features/marketplace/background-update.feature"
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
  - "test/orchestrators/plugin/materialize-latest.test.ts"
  - "test/orchestrators/plugin/reinstall-flow.test.ts"
  - "test/orchestrators/plugin/update-constraint-gate.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
  - "test/orchestrators/plugin/update-swap.test.ts"
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
covered_digest: "v4:sha256:68ea55b1740750098840755bb6fdb97878445687922545bf3352ad31a325a3e5"
---

# Phase 5: Credential Surface Verification Report

**Phase Goal:** Git authenticates only through what the machine already holds, the extension keeps no git token of its own, Device Flow is removed or kept in the form discuss chose, and a user who stored a token through Device Flow keeps working with no action.
**Verified:** 2026-11-28T04:07:13Z (HEAD eeb15e7 for the code; a8bd0cb, a REQUIREMENTS.md-only commit, landed during the run)
**Status:** passed
**Re-verification:** Yes. The first report (d29fa7c, HEAD d5506af, `human_needed`, 9/9) went stale when ef91ed9 and eeb15e7 removed the constraint gate's tag-listing skip at the user's request (D-SG-30).

Discuss chose removal (D-SG-27), no runtime notice (D-SG-28), and documentation only for GitLab token expiry (D-SG-29). The code still matches these choices.

## What Changed Since the First Verification

| Commit | Files | Effect |
| ------ | ----- | ------ |
| ef91ed9 | 6 sources in `orchestrators/plugin/`, 6 unit tests, `features/marketplace/background-update.feature` | `UpdateConstraintOptions.listsSourceTags` is gone, so `probeGitStageOne` always calls `seam.probeDependencyTags`. The notification context that `materialize-latest.ts` (`preflightNotification`), `update-swap.ts` (`ThreePhaseArgsBase.preflightNotification`), `dependency-move.ts` (`DependencyMoveContext.notification`), `dependency-bindings.ts` (`callerFields`), and `update-preflight.ts` (`PreparePluginUpdateOptions.notification`) threaded only to set the flag is gone. `grep -rn "listsSourceTags\|preflightNotification" extensions test features` finds nothing. |
| eeb15e7 | `.planning/PROJECT.md`, `CHANGELOG.md` | D-SG-30 row (line 2629) and one `[Unreleased]` sub-bullet |

The only run whose behavior changes is a cascade-mode preflight whose caller gave no notification context, which is the autoupdate cascade (foreground `marketplace update` cascade and the background pass). Before ef91ed9 it admitted the range unpinned and took the branch head. Now it lists the dependency's tags as the foreground `update` does. Dependency moves always carried the context (`callerFields` set it unconditionally), so they listed tags before and still do.

`apply` is unaffected. Its tag-free behavior (D-23) comes from the materialization policy, not from the notification context: `RECONCILE_MOVE_MATERIALIZATION` and the converge policy in `update-flow.ts:1674` set `searchReleaseTags: false`, and `selectConstraintGate` (`update-preflight.ts:1199-1206`) then picks the tag-free `evaluateCatalogConstraint`. So `apply` still takes what `pending` previewed.

## Goal Achievement

### Observable Truths

Re-verification focus: truths 1, 2, and 3 touch the changed path (SG-AUTH-01 auth binding of the new listing, SG-AUTH-02 background pass with no input, SG-AUTH-03 the stored credential in background update). Truths 4 to 9 got a regression check: their files are unchanged since d29fa7c (`git diff --stat d29fa7c HEAD -- eslint.config.js rule-packs .fallowrc.json extensions/pi-claude-marketplace/platform extensions/pi-claude-marketplace/orchestrators/auth-host.ts README.md README.es.md` is empty) and the deleted files are still absent.

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC1 / SG-AUTH-01: a machine with an ssh key or agent, or a git credential helper, adds a private marketplace and installs from it with no prompt. With only `GITHUB_TOKEN`/`GH_TOKEN` set and no helper, the private clone fails as an auth failure, and the token is in no URL, header, or argument. | VERIFIED | Unchanged scenarios pass on HEAD: `features/marketplace/credentials.feature` and `features/plugin/credentials.feature` (19 scenarios, in the run below). The tag listing that the background pass now runs goes through `probeDependencyTags` (`dependency-tag-probe.ts:180-195`), which binds `authBundleFor(cloneUrl, source.kind)` and calls `listRemoteTags`, which runs `runRemote` (`platform/git.ts:666-679`). That is the same host-bound path as every other remote read. No second credential path exists. `no-token-variable-read.test.ts` and `no-credential-leak.test.ts` pass. |
| 2 | SC2 / SG-AUTH-02: Device Flow is gone and no command shows a device code. An autoapply load and the background autoupdate pass never wait for input. PROJECT.md restates the AAP, autoapply, and D-PL8-12 rules. | VERIFIED | The new background listing runs through `platform/git-process.ts`, which sets `credential.interactive=false` (line 323), `GIT_TERMINAL_PROMPT=0`, an empty `GIT_ASKPASS`, and `GCM_INTERACTIVE=never` (lines 668-670) on every git command. All 11 scenarios of `features/marketplace/background-update.feature` pass, including the two with no notice and no prompt and the new D-SG-30 scenario. AAP-D1, D-PL8-12, and NFR-5 (`PROJECT.md:1958`) keep their D-SG-27 amendments; eeb15e7 changed only line 2629 there. |
| 3 | SC3 / SG-AUTH-03: a token stored through Device Flow keeps working over HTTPS with no action, and the extension deletes no stored credential. The notice follows Q5 (none, D-SG-28). Cucumber pins each. | VERIFIED | The `x-access-token` store scenarios (add, update, background update, plugin install, plugin update) and the "leaves the erase to git" scenario pass on HEAD. `GitSubcommand` still has no `credential` member, and ef91ed9 touched no `platform/` file. |
| 4 | The D-SG-27 deletion list is gone: `domain/github-auth.ts`, `domain/auth-registry.ts`, `platform/git-credential.ts`, `platform/git-one-shot-credential.ts`, the `credentialOps`/`deviceFlowHttp`/`authMemo` threading, `features/marketplace/device-flow.feature`, and `features/lib/github-device-flow/` | VERIFIED | Regression check: `ls` finds none of the six paths, and `grep -rn "authMemo\|credentialOps\|deviceFlowHttp\|device-flow-prompt"` over `extensions/` and `schema/` finds nothing. |
| 5 | The gate config shrinks with the deletions: `fetch-chokepoint` exempts only `platform/hosted-manifest-fetch.ts`, `GIT_PROCESS_IMPORTERS` is `platform/git.ts` alone, and `NETWORK_SEAMS` has 16 entries without auth-host | VERIFIED | Regression check: `eslint.config.js`, `.fallowrc.json`, and `rule-packs/` are unchanged since d29fa7c. `update-constraint-gate.ts` still reaches git only through the injected seam, and the orchestrator's static gate passed on eeb15e7. |
| 6 | The `device-flow-prompt` kind leaves the types, wire, and schema, and `schemaVersion` stays 1 | VERIFIED | Regression check: no match in `extensions/` or `schema/`. No `shared/` or `schema/` file changed since d29fa7c. |
| 7 | git runs non-interactively and once: D-SG-05's environment is unchanged, there is no sign-in retry, and a refused credential maps to `StoredCredentialRejectedError` for the bundle's host only | VERIFIED | Regression check: `platform/` is unchanged since d29fa7c. The env lines are as cited under truth 2. |
| 8 | `orchestrators/auth-host.ts` is one pure host binding, `authBundleFor`, plus `NO_STORED_CREDENTIAL_CAUSE`. The bundle is `{ host }`. The module stays in the credential-leak scan. | VERIFIED | Regression check: the file is unchanged since d29fa7c. `test/orchestrators/auth-host.test.ts` and `test/architecture/no-credential-leak.test.ts` pass on HEAD. |
| 9 | The records and docs: PROJECT.md has D-SG-27..29 and dated amendments. README.md and README.es.md match. CHANGELOG has one `[Unreleased]` entry. | VERIFIED | D-SG-27..29 are unchanged at `PROJECT.md:2626-2628`, and D-SG-30 follows at line 2629. The READMEs are unchanged. CHANGELOG still has one `[Unreleased]` entry for this change set: eeb15e7 added a fifth sub-bullet to it and made no second entry. |

**Score:** 9/9 truths verified. None is present but behavior-unverified.

### NFR-5 as Amended

The background pass now lists a constrained git-source dependency's tags. NFR-5 (`PROJECT.md:1958`) allows this on three grounds. (1) D-03-03: "Resolving a dependency that carries a version constraint may additionally read that dependency's source repository tag list over the network." (2) D-PL8-01: "The background autoupdate pass runs `marketplace update`'s code ... so it may use the network as that command does, and git runs non-interactively with what the machine holds (D-PL8-01, D-PL8-12, D-SG-27)." (3) UPD-DEP-D1 says the autoupdate cascade runs install's cascade with its "constraint resolution, tag reads". The path arm already ran `ls-remote --tags` of the marketplace remote in the same run (D-SG-09). The read-only verbs (`list`, `info`, `uninstall`, `marketplace remove`, and a load without autoapply) do not reach `preparePluginUpdate`, so the change adds no network to them. `apply` stays tag-free through its policy, as shown above. D-SG-30 records the decision with an ID, as the upstream-parity constraint requires. It is a move toward parity: Claude Code and the foreground `update` list the tags in every run.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | Pure host binding | VERIFIED | Unchanged. The new listing uses it through `probeDependencyTags`. |
| `extensions/pi-claude-marketplace/platform/git.ts` | Single-run auth mapping | VERIFIED | Unchanged. `listRemoteTags` goes through `runRemote`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` | Git stage one lists tags in every run (D-SG-30) | VERIFIED | `probeGitStageOne` has no early return. The header comment cites D-SG-09 and D-SG-30. |
| `features/marketplace/background-update.feature` | D-SG-30 behavioral pin | VERIFIED | New scenario at line 90. It passes on HEAD and fails on the pre-fix source (see spot-checks). |
| `features/marketplace/credentials.feature` | SG-AUTH-01/02/03 pins | VERIFIED | 14 scenarios pass |
| `features/plugin/credentials.feature` | SG-AUTH-01/03 pins for plugins | VERIFIED | 5 scenarios pass |
| `test/architecture/no-token-variable-read.test.ts` | Token-variable scan | VERIFIED | Passes |
| Deleted modules (4 source, the feature, and the stand-in) | Absent | VERIFIED | Still missing |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| marketplace add/update, PUP-2 sync, plugin probes, tag probes | `authBundleFor` | `canonicalCloneUrl(source)` | WIRED | Unchanged. `dependency-tag-probe.ts:186` |
| `update-constraint-gate.ts` `probeGitStageOne` | `dependency-tag-probe.ts` `probeDependencyTags` | `UpdateConstraintSeam.probeDependencyTags` | WIRED | Now unconditional. The unit case "D-SG-30: a run with no notification context lists the git source's tags" asserts that the probe is called once with the folded range. |
| `update-preflight.ts` `selectConstraintGate` | `evaluateUpdateConstraint` / `evaluateCatalogConstraint` | `policy.searchReleaseTags` | WIRED | Keeps `apply` tag-free (D-23) without the removed context |
| `platform/git.ts` | `platform/git-process.ts` | sole importer | WIRED | `GIT_PROCESS_IMPORTERS` is unchanged |

### Data-Flow Trace (Level 4)

Not applicable. The phase renders no dynamic UI data. The auth bundle comes from the clone address with no I/O.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Credentials and background-update pins on HEAD (adapter) | `node scripts/cucumber.mjs --profile adapter features/marketplace/background-update.feature features/marketplace/credentials.feature features/plugin/credentials.feature` (`node_modules/.bin` on PATH) | 30 scenarios, 481 steps passed | PASS |
| The new D-SG-30 scenario fails without the fix | A scratch worktree at HEAD with `orchestrators/plugin/` checked out from `ef91ed9^`: `node scripts/cucumber.mjs --profile adapter features/marketplace/background-update.feature:90` | 16 steps: 14 passed, 1 failed (`Then the tui session reports the notice "Plugin updated: lib ..."`), 1 skipped. Worktree removed afterwards. | PASS (fails as intended) |
| Changed units, plus the auth, leak, token, and tag-probe tests | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test` over update-constraint-gate, update-preflight, materialize-latest, update-swap, dependency-move, dependency-bindings, no-token-variable-read, no-credential-leak, auth-host, dependency-tag-probe (`GIT_CONFIG_COUNT` unset, `/opt/pi-claude-marketplace/bin` on PATH) | 751/751 pass | PASS |

The orchestrator ran the gate on eeb15e7, and this run did not repeat it. Static, unpaired, integration, and direct coverage passed. The adapter profile passed 2422/2427 scenarios. The 5 failures are the known `fd` Glob baseline in `features/hook/tool-use.feature:296,355,443,1696,1834`, and no Phase 5 or D-SG-30 file touches them. The builtin profile passed 261/261.

### Probe Execution

Not applicable. The phase declares no `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SG-AUTH-01 | 05-01, 05-06, 05-08..05-11 | git auth only through what the machine holds, and no token variable is read | SATISFIED | Truths 1, 4, 7, 8. The new listing binds the same host bundle. |
| SG-AUTH-02 | 05-01..05-07, 05-13 | Device Flow removed, and the AAP/autoapply/D-PL8-12 rules restated | SATISFIED | Truths 2, 4, 5, 6, 9. The new listing in the background pass runs non-interactively. |
| SG-AUTH-03 | 05-01, 05-10, 05-11, 05-13 | Stored token keeps working, nothing is deleted, notice per Q5 | SATISFIED | Truths 3, 7, 9 |

No orphaned requirements. a8bd0cb marked them complete in REQUIREMENTS.md during this run.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (3/3: D-SG-27, D-SG-28, D-SG-29). D-SG-30 is a later quick-task decision. It is not in `05-CONTEXT.md`, and it is checked above under "What Changed" and "NFR-5 as Amended".

### Advisory (New Scope, Unevidenced)

None.

### Anti-Patterns Found

The ef91ed9..eeb15e7 diff (15 files) adds no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder text, or skipped tests.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `platform/process-run.ts` | - | `ProcessRequest.input` / stdin pipe is unused in production (review A IN-02, skipped) | Info | Carried from the first report. Dead path, no behavior. |
| `features/lib/github-redirect/connect-proxy.ts` | - | The CONNECT proxy does not record `Proxy-Authorization` (B IN-06, half skipped) | Info | Carried. Covered at code level. |
| `orchestrators/plugin/update-constraint-gate.ts` | - | 05-09's truth said the marketplace tag listing runs "with no bundle". WR-03 now always passes `authBundleFor(...)`. | Info | Carried. The bundle does no I/O. |

The first report's "notification context threaded only for `listsSourceTags`" row (A WR-03 residual) is resolved: ef91ed9 removed that threading.

### Open Question

None. The first report's open question (05-REVIEW-FIX A IN-01: keep the skip as a recorded divergence or remove it) is settled. The maintainer chose removal, D-SG-30 records it, and ef91ed9 implements it.

### Human Verification Required

### 1. Real gh / Git Credential Manager helper

**Test:** On a machine with `gh auth login` and `gh auth setup-git` (or GCM), add a private GitHub marketplace and install a plugin from it.
**Expected:** Both succeed over HTTPS with no prompt from Pi and no device code, and the helper entry stays.
**Why human:** No test may reach a real remote host. The scenarios use the `store` helper and a recording helper against the loopback git host.

### 2. Windows SG-SSH-05 checks

**Test:** On Windows, add a private GitHub marketplace and install a git-source plugin, with ssh configured and with ssh not configured.
**Expected:** Claude Code's Windows transport order, with no wait for input.
**Why human:** CI and the sandbox run Linux only. The Windows path is unit-tested with fakes.

### 3. Real ssh against github.com

**Test:** With a real ssh key registered on github.com, add a private GitHub marketplace.
**Expected:** The probe reports configured, the clone goes over ssh, and Pi asks for nothing.
**Why human:** Tests never run real ssh.

### Human Validation (2026-11-28)

The maintainer chose to run the three checks above by hand on the pull request, as in Phase 4 (see "Human Validation" in `.planning/phases/04-ssh-sources-and-transport-selection/04-VERIFICATION.md`). They do not block the phase. The items stay in `human_verification` so the pull request carries them, and the status is `passed`.

### Gaps Summary

None. Every roadmap success criterion and every merged plan truth is backed by code and passing tests on HEAD eeb15e7. The D-SG-30 change keeps SG-AUTH-01..03: the new background tag listing uses the same host-bound bundle, git's non-interactive environment, and no credential write. It stays inside NFR-5 as amended by D-03-03, D-PL8-01, and D-SG-09. `apply` stays tag-free (D-23) through its policy. The three environment checks are left for the pull request by the maintainer's choice.

---

_Verified: 2026-11-28T04:07:13Z_
_Verifier: Claude (gsd-verifier)_
