---
phase: 04-ssh-sources-and-transport-selection
verified: 2026-11-26T14:00:00Z
status: gaps_found
score: 4/5 must-haves verified
covered_files:
  - .planning/phases/04-ssh-sources-and-transport-selection/04-01-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-01-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-02-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-02-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-03-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-03-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-04-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-04-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-05-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-05-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-06-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-06-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-07-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-07-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-08-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-08-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-09-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-09-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-10-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-10-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-11-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-11-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-12-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-12-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-13-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-13-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-14-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-14-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-15-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-15-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-16-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-16-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-17-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-17-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-18-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-18-SUMMARY.md
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/git-url.ts
  - extensions/pi-claude-marketplace/domain/github-plugin-transport.ts
  - extensions/pi-claude-marketplace/domain/github-transport.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/git-failure-kind.ts
  - extensions/pi-claude-marketplace/platform/git-process.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/github-base-url.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/upstream-flag.ts
covered_digest: "v4:sha256:da89bc2dd3fa56e2cc3ba2415a96c5abe145e99b35c65d8389f56e4cd11c247e"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "D-SG-22 (SG-SSH-02): every GitHub clone's final notification names the transport it used, with the retry line and the both-failed error when they apply"
    status: closed
    closed_by: [04-19, 04-21, 04-22, 04-23, 04-24, 04-25]
    reason: "The closed clone note, its lines, its JSON fields, and the both-failed error exist and are wired on marketplace add, marketplace update, install, update, reinstall, the PUP-2 sync, fetch, info --fetch, enable, apply, and import. Twelve reporting paths that run a GitHub clone still show no note, so the decision's 'every GitHub clone' is not met. Three of them are marketplace clones of an owner/repo source, which SC2's 'the user sees upstream's progress lines' also covers. PROJECT.md D-SG-22 and 04-VALIDATION.md both say a gap plan closes them after verification. No later phase owns them: Phase 6 settles wording only, and D-SG-22 gives this phase the note's placement."
    artifacts:
      - path: "extensions/pi-claude-marketplace/shared/notification-types.ts"
        issue: "PluginDisabledMessage has no clone field (WINDOWS #130). The skipped, partially-upgradable, and manual-recovery update and reinstall row types have no clone field (#133)"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts"
        issue: "a failure while an install plans its dependency moves calls projectCaughtFailure without the install's notes (#131)"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
        issue: "a D-MF-04 add of a dependency's other marketplace has no block in the install notification, so its marketplace clone shows no note (#132)"
      - path: "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
        issue: "the autoupdate cascade's plugin rows show no note for the plugin clones the cascade runs (#134)"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
        issue: "a bulk update where every plugin stayed current drops its blocks, so a PUP-2 marketplace re-clone there shows no note (#135)"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
        issue: "a failing enable cascade member's re-clone (#136) and an enable that fails after its ledger (#137) show no note"
      - path: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
        issue: "an apply or import dependency row whose rollback failed shows no note (#138)"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts"
        issue: "notifyAddFailure has no collector, so a bootstrap add that fails after its clone shows no note, unlike marketplace add of the same source (#127)"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
        issue: "the fetch remote row shows no note (listed in PROJECT.md D-SG-22 and 04-VALIDATION, but it has no .planning/WINDOWS.md entry)"
      - path: "extensions/pi-claude-marketplace/domain/github-transport.ts"
        issue: "review IN-A-02: an http:// GitHub url source clone is noted 'Cloning via HTTPS', which names an encrypted transport for a plain-http clone (also github-plugin-transport.ts asWritten)"
    missing:
      - "A clone note on each of the twelve paths above, carried through the message types, the wire and JSON schema, and the grammar, with a cucumber scenario per path that fails without the change"
      - "A correct note for an http:// GitHub address: a new note kind, or no note, as the maintainer chooses (IN-A-02)"
      - "A .planning/WINDOWS.md entry for the fetch remote row, or its closure in the gap plan"
      - "PROJECT.md D-SG-22 outcome updated from 'partly landed' once the paths are closed, and WINDOWS #127 and #130 to #138 resolved"
human_verification:
  - test: "Run the manual Windows check of the SG-SSH-05 path on the pull request (WINDOWS #128): a github owner/repo plugin install on Windows goes SSH first with no probe; after a publickey or host-key failure, with the skip checks passing, it runs the ssh -G check through Git for Windows' sh (git ls-remote with Pi's GIT_SSH_COMMAND plus ' -G >&2'), then tries HTTPS, then SSH once more."
    expected: "The install clones over HTTPS for a user with no key, the -G tail runs under Git for Windows' sh, and any other SSH failure is reported unchanged."
    why_human: "CI and this sandbox run Linux only. Fake-platform unit rows prove the plan, not Git for Windows' sh or the real ssh -G output."
  - test: "Run a real ssh -T git@github.com probe and a real SSH clone of a GitHub marketplace and a github plugin on a machine with an SSH key for GitHub, and again on one with no key (04-VALIDATION Manual-Only)."
    expected: "With a key, the probe reads configured and both clones go over SSH. With no key, the marketplace add goes HTTPS first with 'SSH not configured, cloning via HTTPS', and the plugin install goes HTTPS first when the skip checks pass."
    why_human: "No test may reach github.com or run a real ssh. The ssh stand-in serves the same protocol, but only the real host proves GitHub's exit 1 text and ssh's 255 refusal text match what the probe reads."
  - test: "Decide review IN-A-01: upstream refuses an owner/repo value that fails /^[a-zA-Z0-9-_.]+\\/[a-zA-Z0-9-_.]+$/ with 'Invalid GitHub repository format: <x>. Expected format: owner/repo' at clone time (zHi). Pi accepts any one-slash string (parseOwnerRepo, unchanged this phase), so a manifest repo 'evil:x/y' now builds git@github.com:evil:x/y.git on the SSH arm."
    expected: "The maintainer chooses parity (port zHi's check, at clone time as upstream) or records a divergence under its own decision ID."
    why_human: "AGENTS.md: a divergence needs a recorded decision ID or a Pi capability gap, else it goes to the user. None exists. argv stays safe (host github.com, operands after --end-of-options), so it is not a security gap."
---

# Phase 4: SSH Sources and Transport Selection Verification Report

**Phase Goal:** A user who authenticates git over SSH can add a marketplace or install a plugin from an SSH URL or from a private `owner/repo` repository, and `owner/repo` sources choose SSH or HTTPS as Claude Code does (issue #325).
**Verified:** 2026-11-26T14:00:00Z
**Status:** gaps_found
**Re-verification:** No, initial verification
**HEAD:** bd898e6 on `features/system-git`. The code is the same as at 65f01f0. bd898e6 only adds the PROJECT.md rows D-SG-25 and D-SG-26.

## Goal Achievement

### Observable Truths

Truths 1 to 4 are the ROADMAP success criteria. Truth 5 is D-SG-22, the maintainer decision that 04-02, 04-08, and 04-13 to 04-17 carry as must-haves ("names the transport of every GitHub clone").

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `marketplace add` with a `git@host:path` URL (and the `ssh://`, `git+ssh://`, `ssh+git://` forms as discuss chose), install over SSH from it, `git://` refused, `http://` and the git-subdir `url` as discuss chose, cucumber pins each form (SG-SSH-01) | VERIFIED | `domain/git-url.ts` (311 lines) ports upstream's `iTs`. Every git address the parser reads goes through it. `marketplace/ssh-source.feature:7` adds `git@127.0.0.1:acme/tools.git` over the ssh stand-in, and the https git host receives no request. `:26` adds an `ssh://` marketplace through `apply`. `plugin/ssh-source.feature:7` installs a `git@host:path` url plugin over ssh. `:30` refuses a git-subdir `ext::` url before git runs (F-2 closed). `:82` installs an `ssh+git://` github.com plugin. `unsupported-source.feature:22-27` refuses the URL-scheme ssh forms and `git://` on the add command line, and refuses an `http://` `.json` catalog (D-PL5-36). An `http://` git address is accepted (`url-source.feature`, "Adding a marketplace from an http:// git address reaches git instead of being refused"). Deviation from the SC's literal text: the command line refuses `ssh://`, `git+ssh://`, and `ssh+git://`, as upstream does. Those forms reach Pi through config and manifest entries. D-SG-17 records this, and the maintainer accepted it on 2026-11-25. This is parity, so it needs no override. The ROADMAP wording could be aligned with it. |
| 2   | For an `owner/repo` marketplace source: SSH first only when the probe says configured, HTTPS first otherwise, a retry over the other transport, upstream's both-failed error, upstream's progress lines; `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` gives HTTPS with no probe; `CLAUDE_CODE_REMOTE` changes nothing (SG-SSH-02, SG-SSH-03) | VERIFIED (for the add and refresh surfaces; see truth 5 for three marketplace clone paths with no line) | `platform/git-process.ts:707-720` launches `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` with a 3000 ms limit. `platform/git.ts:896-922` reads exit 1 plus "successfully authenticated" as configured, and exit 255 plus a publickey or host-key refusal as not-configured. `domain/github-transport.ts::planMarketplaceClone` orders the attempts, and `retryWith` gives the other transport once. Git missing, an abort, or a print-mode Device Flow refusal stop the retry. `shared/errors.ts:1468` holds "Fetching the marketplace from GitHub failed on both attempts." `shared/upstream-flag.ts` reads `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`. No extension file reads `CLAUDE_CODE_REMOTE`; the two hits are hook-env comments. Scenarios: `marketplace/github-transport.feature` (configured, not-configured outline, ssh fails then https, https fails then ssh, both fail, PREFER_HTTPS, CLAUDE_CODE_REMOTE, MODE-04) and `marketplace/github-refresh.feature` (six refresh paths). I re-ran these features: they pass. |
| 3   | A `github` plugin source on install, update, and dependency install follows the probe, fallback, and skip rules of the chosen surface (D-SG-18: shell `claude plugin install`; D-SG-19: update, reinstall, moves, and enable follow install); on Windows a plugin install retries an SSH failure over HTTPS (SG-SSH-04, SG-SSH-05) | VERIFIED (Windows on fake-platform unit rows; real Windows is a human item) | `domain/github-plugin-transport.ts::planPluginClone`: off Windows, HTTPS goes first only when `userOverride` is false, `urlRewritten` is false, the probe says `not-configured`, and ssh is absent or `ssh -G` shows a direct hop. Otherwise the clone goes SSH only. `windowsPlan` goes SSH first with no probe, then after a publickey or host-key failure, with the checks passing, HTTPS, then SSH. `orchestrators/github-transport.ts::pluginCloneTransport` is reached from `install-clone-probe.ts`, `update-preflight.ts`, `fetch.ts`, and `info.ts`, with one context per command root (04-11, 04-12, 04-17). Scenarios: `plugin/github-transport.feature` (15: configured, denied key, the GIT_SSH_COMMAND and GIT_SSH outline, core.sshCommand, an unknown probe, an ssh proxy, a user insteadOf, PREFER_HTTPS, both-failed, one probe with a dependency, the D-SG-20 tag reads and their HTTPS retry), `github-transport-update.feature` (update, reinstall, fetch, info --fetch, enable), and `github-transport-apply.feature` (one probe per apply and import run). SG-SSH-05 rows: 8 in `test/domain/github-plugin-transport.test.ts`, 6 in `test/orchestrators/github-transport.test.ts`, 5 in `test/platform/git.test.ts`, 4 in `test/platform/git-process.test.ts`. They pass. |
| 4   | A marketplace or plugin cloned over SSH is the same source as its HTTPS form: never refused as a stale clone, and its `plugin-clones/<key>/` does not move (SG-SSH-06) | VERIFIED | `git diff 76b7543 HEAD -- domain/clone-key.ts` leaves `canonicalCloneUrl` unchanged. `originMatchesSource` now runs `gitHubRepositoriesMatch` (the `gitHubAddressOf` fold, D-SG-23) before the exact compare. Refreshes take their URL list from the declared source, not from the recorded origin (04-09, `clone-swap.ts:145`). Unit case `clone-cache.test.ts:1298` "SG-SSH-06: an ssh clone fills the directory an https clone of the same source fills" passes. Scenarios: "Adding a github marketplace over a leftover checkout whose origin is its ssh address replaces it", "Adding Acme/Tools after acme/tools reports the marketplace already added", and "A github marketplace added over https refreshes over ssh once the user's ssh authenticates". |
| 5   | D-SG-22: every GitHub clone's final notification names its transport, with the retry line and the both-failed error when they apply | FAILED (partial) | The note is wired on 11 command surfaces (see the gap). Twelve paths that run a GitHub clone still show none. I confirmed the cause in the code for two of them: `PluginDisabledMessage` in `shared/notification-types.ts` has no `clone` field, and `bootstrap.ts:137` calls `notifyAddFailure(addOptions, err)` with no note collector. The other ten are recorded in WINDOWS #131 to #138 and in PROJECT.md D-SG-22 ("Open, to be closed after phase verification"). The fetch remote row is listed in PROJECT.md and 04-VALIDATION but has no WINDOWS entry. Review IN-A-02 adds a wrong label: `http://github.com/...` is noted "Cloning via HTTPS". |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/git-url.ts` | Port of upstream's `iTs` validator | VERIFIED | 311 lines, used by `domain/source.ts` and `orchestrators/marketplace/add.ts` |
| `domain/github-transport.ts` | Marketplace clone plan, `tagReadUrl`, `TransportForce` | VERIFIED | 210 lines; imported by `add.ts` and `clone-swap.ts` |
| `domain/github-plugin-transport.ts` | Plugin plan, skip checks, Windows plan | VERIFIED | 262 lines; imported by `orchestrators/github-transport.ts` |
| `orchestrators/github-transport.ts` | Runner over the plan's attempts, clone notes, per-command plugin context | VERIFIED | 489 lines; reached by more than 30 orchestrator modules |
| `platform/git-process.ts` ssh launches | `github-probe`, `github-config`, `print-config` tail | VERIFIED | `SSH_LAUNCHES` at `:706`; the only ssh spawn site |
| `platform/git.ts` ssh reads | `probeGitHubSsh`, `userSshOverride`, `sshUrlRewritten`, `sshShowsDirectGitHub`, `sshShowsDirectGitHubThroughGit` | VERIFIED | `:896` onward |
| `shared/upstream-flag.ts` | `preferHttps`, shared with D-SG-15 | VERIFIED | 25 lines; reads no other variable (unit case) |
| `shared/github-base-url.ts` | D-SG-21 pairs for each SSH spelling, `gitHubAddressOf` fold | VERIFIED | 367 lines; WR-A-02 fix covers `ssh+git://` |
| `domain/clone-key.ts` | Fold in comparisons, key unchanged | VERIFIED | `gitHubRepositoriesMatch`; `canonicalCloneUrl` untouched |
| `scripts/isolated-pi-home.mjs` refusing ssh, `features/lib/ssh-git-host` stand-in | No test reaches a real ssh or host | VERIFIED | Refusing `ssh` first on every test PATH; the stand-in records every launch |
| Clone note on every GitHub clone path | D-SG-22 | PARTIAL | 12 paths missing (gap) |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `marketplace/add.ts` | `planMarketplaceClone` | `gitStagingSteps.stage`, force read only for a GitHub source (CR-A-02 fix) | WIRED |
| `marketplace/clone-swap.ts` | `planMarketplaceClone` | refresh URL list from the declared source | WIRED |
| `install-clone-probe.ts`, `update-preflight.ts`, `fetch.ts`, `info.ts` | `pluginCloneTransport` | command root's transport context | WIRED |
| `pluginCloneTransport` | `planPluginClone` | context checks bound to `DEFAULT_GITHUB_SSH_OPS` | WIRED |
| `probeGitHubSsh` | `gitProcess.ssh("github-probe")` | the one spawn site | WIRED |
| `dependency-tag-probe.ts`, `marketplace-tag-probe.ts` | `tagReadUrl` | `transportForce(process.env)` (IN-B-03: env read, not the context; same value in production) | WIRED |
| `originMatchesSource` | `gitHubRepositoriesMatch` | D-SG-23 fold | WIRED |
| Clone notes | grammar, JSON, wire | `CloneTransportNote` on 10 message types | WIRED on the landed paths; missing on the 12 gap paths |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Marketplace and plugin rows | `clone` note | `recordNote` in `orchestrators/github-transport.ts` from the run's plan and retries, redacted (CR-A-01 fix) | Yes; the scenario tables assert `clone note` and `clone url` columns | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Owner tests of the validator, fold, plans, runner, base pairs, flag reader, clone cache, git verbs, swap, and source parser | `env -u GIT_CONFIG_COUNT PATH=/opt/pi-claude-marketplace/bin:$PATH node --import scripts/isolated-pi-home.mjs --test` over 11 files (clone-key, git-url, github-plugin-transport, github-transport x2, github-base-url, upstream-flag, clone-cache, git, clone-swap, source) | 958 tests, 958 pass | PASS |
| Phase scenarios, adapter profile | `node scripts/cucumber.mjs --profile adapter` over `marketplace/github-transport.feature`, `plugin/github-transport.feature`, `marketplace/ssh-source.feature`, `plugin/ssh-source.feature` | 35 scenarios, 35 pass | PASS |
| `CLAUDE_CODE_REMOTE` not read | `grep -rn CLAUDE_CODE_REMOTE extensions` | 2 hits, both hook-env comments | PASS |
| Debt markers in the 64 changed extension files and the changed test, feature, and script files | grep for `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` | none | PASS |

The full gate was not re-run, as instructed. I take the supplied evidence at 65f01f0 as given: static, unpaired, integration, and direct coverage green; cucumber adapter 2391/2396 (the 5 known fd-dependent Glob scenarios in `features/hook/tool-use.feature`); builtin 260/260.

### Probe Execution

SKIPPED. No phase 4 plan declares a `probe-*.sh` script.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| SG-SSH-01 | 04-01, 04-03 | SSH URL forms with upstream's validator, `git://` refused | SATISFIED | Truth 1, D-SG-17 |
| SG-SSH-02 | 04-02, 04-04, 04-05, 04-08, 04-09, 04-13 | Probe, order, retry, progress lines, both-failed error | PARTIAL | Truth 2 is verified for selection and retry. The progress lines are missing on three marketplace clone paths (truth 5) |
| SG-SSH-03 | 04-04, 04-05 | PREFER_HTTPS, CLAUDE_CODE_REMOTE not read | SATISFIED | Truth 2, D-SG-24 |
| SG-SSH-04 | 04-06, 04-07, 04-11, 04-12, 04-14 to 04-17 | Plugin probe, fallback, and skip rules on install, update, dependency install | SATISFIED | Truth 3, D-SG-18, D-SG-19, D-SG-20, D-SG-25 |
| SG-SSH-05 | 04-10 | Windows SSH-to-HTTPS retry | SATISFIED on unit rows; real Windows is a human item | Truth 3, WINDOWS #128 |
| SG-SSH-06 | 04-03, 04-06, 04-09 | Scp-aware identity, key unchanged | SATISFIED | Truth 4, D-SG-23 |

No orphaned requirements: ROADMAP lists SG-SSH-01 to SG-SSH-06, and plans claim each one. REQUIREMENTS.md still shows them unchecked, with "Pending" in its traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| none | | No debt markers in changed files | | |

### Review Findings Status

| Finding | State at HEAD | Judgement |
| ------- | ------------- | --------- |
| CR-A-01 / CR-B-01 / F-04-1 (clone note shows URL credentials) | Fixed (`34ac832`): redacted where the note is made and again in the resolvers; scenario and architecture test | Closed |
| CR-A-02 (invalid base override fails non-GitHub clones) | Fixed (`56ea0c3`) | Closed |
| CR-B-02 (bare update or reinstall puts one scope's note on the other's row) | Fixed (`8cf8f62`) | Closed |
| WR-A-01 (SSH-spelled GitHub address under the base override is noted SSH) | Needs user decision in 04-REVIEW-FIX-A. The D-SG-21 outcome already says such a source "keeps the note of its own scheme in `github.com` terms" | Covered by the recorded D-SG-21 outcome. Not a gap |
| WR-A-02, WR-A-03, WR-A-04, WR-B-01 to WR-B-03 | Fixed. WR-A-04's single-attempt wording is D-SG-26 | Closed |
| IN-A-05 (skip checks cached per command) | Recorded as D-SG-25 (bd898e6) | Closed |
| IN-A-01 (owner/repo not checked against upstream's pattern) | Skipped | Unlicensed parity gap: human decision item 3. Recommend porting `zHi` in the gap plan |
| IN-A-02 (`http://` labelled HTTPS) | Skipped | Part of the D-SG-22 gap: a wrong transport label in the note this phase owns |
| IN-A-07, IN-B-02, IN-B-03 | Skipped with reasons | Accepted. IN-B-03 does not change behavior in production |
| WINDOWS #126 (debug line keyed on the note), #129 (pre-D-PL5-04 `.json` url record refreshes from its recorded origin) | Open deviations | Warnings. They are not in the success criteria, and no user output is wrong |

### Human Verification Required

These are recorded in the frontmatter. The status stays `gaps_found` because the gap takes precedence.

1. **Windows SSH-first plugin install (SG-SSH-05, WINDOWS #128).** Test: the manual Windows check at the pull request. Expected: SSH first, then the `-G` check through Git for Windows' sh, then HTTPS, then SSH. Why human: CI and this sandbox run Linux only.
2. **Real ssh against github.com (04-VALIDATION Manual-Only).** Test: run the probe and SSH clones on machines with a GitHub key and without one. Expected: the probe reads configured or not-configured as upstream does. Why human: no test may reach github.com or run a real ssh.
3. **IN-A-01 decision.** Test: the maintainer chooses parity with upstream's `zHi` check or records a divergence ID. Why human: AGENTS.md sends an unlicensed divergence to the user.

### Gaps Summary

The phase goal is met in substance. A user who authenticates over SSH can add and install from scp and ssh addresses. `owner/repo` sources probe, order, retry, and honour `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` as Claude Code does on the marketplace path and the shell install path. An SSH clone is the same source as its HTTPS form. Code, wiring, unit rows, and scenarios prove all of this, and the targeted re-runs pass.

One gap remains, with a single root cause: D-SG-22 is only partly landed. The maintainer chose to show each GitHub clone's transport in the final notification, because Pi has no live progress line. Twelve reporting paths still drop the note. Three of them are marketplace clones of an owner/repo source (the bootstrap add failure, the D-MF-04 add of a dependency's other marketplace, and the PUP-2 re-clone in a bulk update where every plugin stayed current), so SG-SSH-02's "prints upstream's progress lines" also fails there. No later phase owns placement, and PROJECT.md and 04-VALIDATION both say a gap plan closes these. So this is a gap, not a deferral.

**Suggested gap-plan scope (one concern, `/gsd-plan-phase 4 --gaps`):**

1. Message types (`shared/notification-types.ts`, the wire, the JSON schema, the grammar): add the `clone` field to `PluginDisabledMessage` and to the skipped, partially-upgradable, and manual-recovery update and reinstall rows (#130, #133).
2. Install flow: pass the install's notes into `projectCaughtFailure` (#131), and give the D-MF-04 marketplace add a block or a note in the install notification (#132).
3. Update family: notes on the autoupdate cascade's plugin rows (#134), and keep the PUP-2 marketplace block when every plugin stayed current (#135).
4. Enable: a note on a failing cascade member's row (#136) and on a post-ledger failure (#137).
5. Apply and import: a note on a dependency row whose rollback failed (#138).
6. Bootstrap: give `notifyAddFailure` the add's note collector (#127).
7. Fetch: a note on the remote row, and a WINDOWS entry or its closure.
8. IN-A-02: a correct note for a plain `http://` GitHub address. The maintainer picks a new note kind or no note.
9. Optional, if the maintainer picks parity on IN-A-01: upstream's `zHi` repository-format refusal at clone time, with its message.
10. Records: one cucumber scenario per path that fails without the change; resolve WINDOWS #127 and #130 to #138; change the PROJECT.md D-SG-22 outcome from "partly landed"; tick SG-SSH-01 to SG-SSH-06 in REQUIREMENTS.md and Phase 4 in ROADMAP.md (line 107) when the phase closes.

Each scenario the plan changes should differ only by clone columns or clone lines (04-08's rule).

---

_Verified: 2026-11-26T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
