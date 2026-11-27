---
phase: 04-ssh-sources-and-transport-selection
verified: 2026-11-27T06:53:40Z
status: passed
score: 5/5 must-haves verified
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
  - .planning/phases/04-ssh-sources-and-transport-selection/04-19-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-19-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-20-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-20-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-21-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-21-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-22-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-22-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-23-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-23-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-24-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-24-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-25-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-25-SUMMARY.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-26-PLAN.md
  - .planning/phases/04-ssh-sources-and-transport-selection/04-26-SUMMARY.md
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
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
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
  - schema/claude-plugin.schema.json
covered_digest: "v4:sha256:0d8d84782278db600cc9d58211a51a5970281d4945c626fc7c2dc7eb8fb57430"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "D-SG-22: an aborted plural update keeps the PUP-2 re-clone block of every marketplace other than the failing target's own scope and marketplace (2788f80)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "A constrained `github` dependency whose manifest repo the zHi check now refuses (for example `acme/ghp#main`) still has its tag list read for `<owner>/<repo>` before the clone plan refuses it, so the install reaches the network for a source it then reports as `unsupported source`"
    category: other
    reason: "Recorded by 04-GAP-REVIEW-FIX.md as not checked against upstream. No scenario or test shows a user-visible difference. Resolve by checking upstream's order (tag read vs. zHi) and either moving the check ahead of the tag read or recording the order"
    evidence_status: "none provided"
human_verification:
  - test: "Run the manual Windows check of the SG-SSH-05 path on the pull request (WINDOWS #128): a github owner/repo plugin install on Windows goes SSH first with no probe; after a publickey or host-key failure, with the skip checks passing, it runs the ssh -G check through Git for Windows' sh (git ls-remote with Pi's GIT_SSH_COMMAND plus ' -G >&2'), then tries HTTPS, then SSH once more."
    expected: "The install clones over HTTPS for a user with no key, the -G tail runs under Git for Windows' sh, and any other SSH failure is reported unchanged."
    why_human: "CI and this sandbox run Linux only. Fake-platform unit rows prove the plan, not Git for Windows' sh or the real ssh -G output."
  - test: "Run a real ssh -T git@github.com probe and a real SSH clone of a GitHub marketplace and a github plugin on a machine with an SSH key for GitHub, and again on one with no key (04-VALIDATION Manual-Only)."
    expected: "With a key, the probe reads configured and both clones go over SSH. With no key, the marketplace add goes HTTPS first with 'SSH not configured, cloning via HTTPS', and the plugin install goes HTTPS first when the skip checks pass."
    why_human: "No test may reach github.com or run a real ssh. The ssh stand-in serves the same protocol, but only the real host proves GitHub's exit 1 text and ssh's 255 refusal text match what the probe reads."
---

# Phase 4: SSH Sources and Transport Selection Verification Report

**Phase Goal:** A user who authenticates git over SSH can add a marketplace or install a plugin from an SSH URL or from a private `owner/repo` repository, and `owner/repo` sources choose SSH or HTTPS as Claude Code does (issue #325).
**Verified:** 2026-11-27T06:53:40Z
**Status:** human_needed
**Re-verification:** Yes, after the aborted batch re-clone fix (2788f80). The previous report (2026-11-27T06:02:20Z, HEAD 75b740b) was `gaps_found` at 4/5, with one gap on truth 5 (D-SG-22).
**HEAD:** 502d784 on `features/system-git`. The only code commit since the previous report is 2788f80. It changes two extension files (`orchestrators/plugin/update-cascade.ts`, `orchestrators/plugin/update-flow.ts`), one feature file, one step file, and one test file. 824703c and 502d784 change records only. The covered file set is unchanged (120 files), and both changed extension files are in it.

## Goal Achievement

### Observable Truths

Truths 1 to 4 are the ROADMAP success criteria. Truth 5 is D-SG-22, the maintainer decision that 04-02, 04-08, 04-13 to 04-17, and 04-19 to 04-25 carry as must-haves ("names the transport of every GitHub clone").

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `marketplace add` with a `git@host:path` URL (and the `ssh://`, `git+ssh://`, `ssh+git://` forms as discuss chose), install over SSH from it, `git://` refused, `http://` and the git-subdir `url` as discuss chose, cucumber pins each form (SG-SSH-01) | VERIFIED (regression check) | 2788f80 touches no file of this truth. `domain/git-url.ts` and `domain/source.ts` are unchanged since the previous report. The supplied gate at 502d784 runs `marketplace/ssh-source.feature` and `plugin/ssh-source.feature` green (adapter 2415/2420, only the 5 known fd failures). The `ssh://`, `git+ssh://`, and `ssh+git://` command-line refusal is D-SG-17 parity, accepted 2026-11-25. |
| 2   | For an `owner/repo` marketplace source: SSH first only when the probe says configured, HTTPS first otherwise, a retry over the other transport, upstream's both-failed error, upstream's progress lines; `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` gives HTTPS with no probe; `CLAUDE_CODE_REMOTE` changes nothing (SG-SSH-02, SG-SSH-03) | VERIFIED (regression check) | The marketplace clone plan (`domain/github-transport.ts`) and runner (`orchestrators/github-transport.ts`) are unchanged since the previous report. The progress-line clause now also holds on the aborted-batch path (truth 5). The gate runs `marketplace/github-transport.feature` and `marketplace/github-refresh.feature` green. |
| 3   | A `github` plugin source on install, update, and dependency install follows the probe, fallback, and skip rules of the chosen surface (D-SG-18, D-SG-19); on Windows a plugin install retries an SSH failure over HTTPS (SG-SSH-04, SG-SSH-05) | VERIFIED (Windows on fake-platform unit rows; real Windows is a human item) | Plan logic unchanged since the previous report, which checked WR-G-03 (`source.ts:404`, `orchestrators/github-transport.ts:392-394`) against the pre-fix code. 2788f80 does not touch the plugin clone plan. PROJECT.md D-SG-18 carries the 2026-11-27 amendment. |
| 4   | A marketplace or plugin cloned over SSH is the same source as its HTTPS form: never refused as a stale clone, and its `plugin-clones/<key>/` does not move (SG-SSH-06) | VERIFIED (regression check) | `domain/clone-key.ts` and the D-SG-23 comparison in `source.ts` are unchanged. |
| 5   | D-SG-22: every GitHub clone's final notification names its transport, with the retry line and the both-failed error when they apply | VERIFIED | The gap is closed. `groupCascadeOutcomes` (`update-cascade.ts:221-266`) drops a group with no rows only when its name and scope are the failing target's: `group.plugins.length > 0 \|\| (group.clone !== undefined && (group.name !== abortedBy?.marketplace \|\| group.scope !== abortedBy.scope))` (`:247-253`). With `abortedBy` undefined, every rowless group with a note is kept, as before. `abortUpdateBatch` (`update-flow.ts:951`) passes `cascade.failedTarget` (`:965`), and all three callers pass `failedTarget: t` (sync failure `:631`, phase-2 throw `:686`, phase-3a aggregate `:717`). The completed run passes `undefined` (`:727`). The failure notification still names the failing target's own sync note (`notifyDirectFailure`, `update-flow.ts:1355`, `:1386`), so the dropped group is exactly the one it shows. The no-op headline guard keeps reading `abortedByFailure = abortedBy !== undefined` (`update-cascade.ts:284`), so WR-01's suppression is unchanged. Tests that fail without the fix: see Behavioral Spot-Checks. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### D-SG-22 Path Closure (truth 5)

"Pre-gap" means HEAD tests run against the extension code at 373e8e6, the commit before the gap plans. Earlier reports checked those columns, and I did not re-run them. The new row was checked against the pre-fix code at 824703c. Line numbers in `github-transport-update.feature` after `:191` moved by 30, because the new scenario was added at `:215`.

| Path (WINDOWS / review) | Code at HEAD | Test that fails without the change | HEAD | Pre-gap / pre-fix |
| -------------- | ------------ | ---------------------------------- | ---- | ------- |
| Disabled install row, standalone (#130) | `PluginDisabledMessage.clone` (`notification-types.ts:576`); requesting row in `install-cascade.messaging.ts` | `git-source.feature:123` | pass | fail |
| Disabled install row, apply (#130) | `notify.ts` puts the install view's note on the `(disabled) {installs disabled}` row | `github-transport-apply.feature:118` | pass | fail |
| Failure while an install plans its dependency moves (#131) | `install-flow-planning.ts:276` passes the notes through `projectCaughtFailure`, and `projectFailedMoves` takes them too | `install-dependencies.feature:469` | pass | fail |
| D-MF-04 add of another marketplace (#132) | `addedMarketplaceBlocks` / `addedMarketplaceNames` (`install-flow-results.ts`, `install-cascade.messaging.ts`) | `cross-scope-install.feature:35` | pass | fail |
| Skipped update row (#133) | `withCloneNote` directly for every status (`update-cascade.ts:202`) | `github-transport-update.feature:44` | pass | fail |
| Partially-upgradable update row (#133) | `PluginPartiallyUpgradableMessage.clone` (`notification-types.ts:670`) | `github-transport-update.feature:60` (builtin profile) | pass | fail |
| Skipped reinstall row (#133) | `withCloneNote` directly for every status (`reinstall.messaging.ts:145`) | `github-transport-update.feature:307` | pass | fail |
| Manual-recovery reinstall row (#133) | same, `PluginManualRecoveryMessage.clone` (`notification-types.ts:770`) | unit `reinstall.messaging.test.ts` (maintainer-accepted unit-only) | pass | fail |
| Autoupdate cascade plugin rows (#134) | `PluginUpdateBase.clone` (`orchestrators/types.ts`), set by the autoupdate seam in `update-flow.ts`, copied in `marketplace/update.messaging.ts` | `marketplace/update.feature:796` | pass | fail |
| Autoupdate no-op whose plugin update re-cloned (WR-G-02) | `clonedRows` keeps the up-to-date row of each outcome with a note (`marketplace/update.ts:1269-1273`) | `marketplace/update.feature:819`; unit "an all-unchanged autoupdate cascade keeps the up-to-date row..." | pass | fail (pre-fix) |
| Bulk update that changed nothing (#135) | `update-cascade.ts` keeps an empty marketplace group that carries a sync note, and an up-to-date row that cloned | `github-transport-update.feature:170` and `:245` | pass | fail |
| Aborted bulk update, failing target's marketplace (WR-G-01) | rowless group of the failing target's scope and marketplace dropped (`update-cascade.ts:247-253`); the failure block keeps the note | `github-transport-update.feature:191`; unit "an aborted bulk update sends no block that only repeats..." (`update-cascade.test.ts:1020`) | pass | fail (mutation: keep every rowless group) |
| Aborted bulk update, another marketplace's sync re-clone (gap, 2788f80) | same filter keeps a rowless group of any other marketplace, or of the same marketplace in the other scope | `github-transport-update.feature:215`; unit "keeps the block of another marketplace's sync re-clone" (`:1042`) and "keeps the sync re-clone block of the failed target's marketplace in the other scope" (`:1074`) | pass | fail at 824703c |
| Failing enable cascade member (#136) | `run.failingMember` set in the member phase's catch (`enable-disable.ts:1088`); the root row gets the member's note labelled `clone.plugin` (`enable-disable.messaging.ts`) | `github-transport-update.feature:421` | pass | fail |
| Enable that fails after its ledger (#137) | the transaction-throw row reads the root key's note (`enable-disable.ts`) | `github-transport-update.feature:450` (harness fault `holdInstallationRecordReadOnly`) | pass | fail |
| Apply dependency row whose rollback failed (#138) | `installFailedOutcomes(op, result, outcomes, notes)` in `reconcile/apply-outcomes.ts` reads the dependency's own key | unit `apply-outcomes.test.ts` (maintainer-accepted unit-only) | pass | fail |
| Import dependency row whose rollback failed (#138) | `failedDependency` carries the dependency key's note (`import/execute.ts`) | unit `execute.test.ts` (maintainer-accepted unit-only) | pass | fail |
| Apply re-enable whose dependency clone fails (IN-G-02 guard) | apply enables each declared plugin by its own call; the dependency's own failed row carries its note | `github-transport-apply.feature:149` (guard; passes before and after, by design) | pass | pass |
| Bootstrap add that fails after its clone (#127) | `createAddCloneNotes` collector given to `addMarketplace` and read by `notifyAddFailure` (`bootstrap.ts`, `marketplace/add.ts`) | `bootstrap.feature:118` and `:133` | pass | fail |
| `http://` GitHub address labelled HTTPS (IN-A-02) | `via-http` kind and the shared `writtenAddressNote` in `domain/github-transport.ts`, read by both clone plans | `url-source.feature:40`, `git-source.feature:90` | pass | fail |
| Fetch `remote` row | No note, by maintainer acceptance: no public input makes a fetch row after a clone read `remote` (PROJECT.md D-SG-22 outcome) | none (accepted) | n/a | n/a |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/git-url.ts` | Port of upstream's `iTs` validator | VERIFIED | Unchanged |
| `domain/github-transport.ts` | Marketplace clone plan, `tagReadUrl`, `TransportForce`, `writtenAddressNote` | VERIFIED | Unchanged since the previous report |
| `domain/github-plugin-transport.ts` | Plugin plan, skip checks, Windows plan | VERIFIED | Unchanged since the previous report |
| `domain/source.ts` | `isGitHubOwnerRepo` (zHi / KHi), `GitHubSource.repository` | VERIFIED | Unchanged since the previous report |
| `orchestrators/github-transport.ts` | Runner, clone notes, per-command plugin context, the zHi refusal | VERIFIED | Unchanged since the previous report |
| `shared/errors.ts` `InvalidGitHubRepositoryError` | Upstream's message, typed field, accurate doc | VERIFIED | Unchanged |
| `orchestrators/plugin/update-cascade.ts` | Bulk cascade grouping with clone notes | VERIFIED | `abortedBy?: UpdateCascadeTarget` replaces the boolean; the filter keys on the failing target's name and scope (gap closed). The doc comments describe the new rule. |
| `orchestrators/plugin/update-flow.ts` | `abortUpdateBatch` passes the failing target | VERIFIED | `UpdateCascadeComposer` type and `abortUpdateBatch`'s `cascade.failedTarget` field; three callers pass `t` |
| `orchestrators/marketplace/update.ts` | Autoupdate no-op block | VERIFIED | `clonedRows` (WR-G-02), unchanged |
| `update.messaging.ts`, `reinstall.messaging.ts` | No pass-through wrappers | VERIFIED | Unchanged |
| Every artifact of the previous report not listed here | | VERIFIED (regression) | Not touched by 2788f80 |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `abortUpdateBatch` callers (`update-flow.ts:631`, `:686`, `:717`) | `abortUpdateBatch` | `failedTarget: t` | WIRED (2788f80) |
| `abortUpdateBatch` (`update-flow.ts:965`) | `composeCascade` (`composeUpdateCascade`, bound at `:1812`) | `cascade.failedTarget` | WIRED |
| `composeUpdateCascade` | `groupCascadeOutcomes` | `abortedBy` | WIRED; the filter compares `scope` and `marketplace` |
| Completed batch (`update-flow.ts:727`) | `composeCascade` | `undefined` | WIRED; every rowless group with a note is kept |
| `parseDiscriminatorObjectSource` (github arm) | `pluginCloneTransport` | `GitHubSource.repository` | WIRED (96c6e31, unchanged) |
| `refreshOneMarketplace` no-op block | `outcomeToCascadePluginMessage` | `clonedRows` | WIRED (fc00741, unchanged) |
| Every link of the previous report | | | WIRED (regression; no other link touched) |

No other caller of `composeUpdateCascade` exists outside `update-flow.ts` and its unit test. The type change from `boolean` to `UpdateCascadeTarget | undefined` is checked by the supplied `typecheck` at 502d784.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Marketplace and plugin rows, bare D-MF-04 blocks | `clone` note (`note`, `url`, `retries`, `plugin`) | `recordNote` in `orchestrators/github-transport.ts` from the run's plan and retries, redacted; read per row key through `GitHubCloneNotes` views | Yes, asserted by the scenario tables over the stand-in git host | FLOWING |
| Aborted bulk update, rowless group of a non-failing marketplace | `group.clone` | `clones.marketplace(scope, marketplace)` | Yes: kept by the filter and rendered as the second `cascade` result; `github-transport-update.feature:215` asserts `kit project via-ssh git@github.com:acme/kit.git` | FLOWING (was DISCONNECTED) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Owner unit tests of the touched files, HEAD | `node --import ./scripts/isolated-pi-home.mjs --test test/orchestrators/plugin/update-cascade.test.ts test/orchestrators/plugin/update-flow.test.ts` (GIT_CONFIG_* unset) | 331 tests, 331 pass | PASS |
| New scenario and the step's three earlier users, HEAD, adapter | `node scripts/cucumber.mjs --profile adapter` over `github-transport-update.feature:191`, `:215`, `update.feature:709`, `:728` | 4 scenarios pass (run as 3 + 2, overlapping `:709`) | PASS |
| `@mcp` step user, HEAD, builtin | `--profile builtin features/plugin/update.feature:709` | 1 pass | PASS |
| New unit cases against the pre-fix code | scratch worktree at 824703c with HEAD `update-cascade.test.ts` | 34 tests, 2 fail: exactly the two new cases ("another marketplace's sync re-clone", "the failed target's marketplace in the other scope"); the WR-G-01 case passes | PASS (the tests fail without the fix) |
| New scenario against the pre-fix code | same worktree with HEAD `github-transport-update.feature` and `update.steps.ts` | `:215` fails at "the command reports these results" (the second `cascade info` result is missing); `:191` passes | PASS (the scenario fails without the fix) |
| Mutation: keep every rowless group (HEAD code, filter's key check replaced by `true`) | same worktree | unit WR-G-01 case fails; scenario `:191` fails; `:215` passes | PASS (WR-G-01 protection survives the fix) |
| Mutation: key the filter on the marketplace name only | same worktree | the other-scope unit case fails | PASS (the scope half of the key is pinned) |
| Debt markers in the files 2788f80 changed | grep `TBD|FIXME|XXX|TODO|HACK` | none | PASS |

The scratch worktree was removed after the runs. No test reached a real host or ran a real ssh. The scenarios run over the stand-in git host and the ssh stand-in. The unit runs use `isolated-pi-home.mjs` with `GIT_CONFIG_COUNT` and the `GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` variables unset.

**The changed step.** "the failed update names these repairs" (`features/step_definitions/plugin/update.steps.ts`) used to assert exactly one `cascade` result. It now reads the marketplaces of every `cascade` result in emission order, and gives a block with no plugin rows one row with empty plugin cells. I checked the three earlier users. Each still pins exactly one cascade through another step in the same scenario: `github-transport-update.feature:191` and `update.feature:728` through "the command reports these results" (one `cascade` row, plus one `diagnostic` row at `:728`), and `update.feature:709` through "the result has these fields", whose `lastResult()` fails unless there is exactly one result. Their repair tables are unchanged by 2788f80, and all three pass at HEAD. So they still assert what they did. The step alone is slightly weaker than before: a second `cascade` result whose `marketplaces` list is empty adds no row. No current user depends on that, because each pins its result count elsewhere (info, not a gap).

I did not re-run the full gate. I take the supplied gate evidence at 502d784 as given: `check:static`, `test:unpaired`, `test:integration`, and `test:coverage:direct:all` pass. Cucumber adapter: 2415 of 2420 pass. The only failures are the 5 known fd-dependent Glob scenarios in `features/hook/tool-use.feature` (`:296`, `:355`, `:443`, `:1696`, `:1834`), because fd is not installed. Cucumber builtin: 261 of 261 pass.

### Probe Execution

SKIPPED. No phase 4 plan declares a `probe-*.sh` script.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| SG-SSH-01 | 04-01, 04-03 | SSH URL forms with upstream's validator, `git://` refused | SATISFIED | Truth 1, D-SG-17 |
| SG-SSH-02 | 04-02, 04-04, 04-05, 04-08, 04-09, 04-13, 04-19, 04-21, 04-22, 04-24, 04-26 | Probe, order, retry, progress lines, both-failed error | SATISFIED | Truth 2. The progress-line clause holds on every path, including the PUP-2 re-clone of a non-failing marketplace in an aborted bulk update (2788f80, `github-transport-update.feature:215`) |
| SG-SSH-03 | 04-04, 04-05 | PREFER_HTTPS, CLAUDE_CODE_REMOTE not read | SATISFIED | Truth 2, D-SG-24 |
| SG-SSH-04 | 04-06, 04-07, 04-11, 04-12, 04-14 to 04-17, 04-19 to 04-26 | Plugin probe, fallback, and skip rules on install, update, dependency install | SATISFIED | Truth 3, D-SG-18 (amended 2026-11-27), D-SG-19, D-SG-20, D-SG-25 |
| SG-SSH-05 | 04-10 | Windows SSH-to-HTTPS retry | SATISFIED on unit rows; real Windows is a human item | Truth 3, WINDOWS #128 |
| SG-SSH-06 | 04-03, 04-06, 04-09 | Scp-aware identity, key unchanged | SATISFIED | Truth 4, D-SG-23 |

No orphaned requirements. REQUIREMENTS.md still shows SG-SSH-01 to SG-SSH-06 unchecked and "Pending", and ROADMAP.md leaves Phase 4 unchecked. They should be ticked when the phase closes (info, not a gap). The PROJECT.md D-SG-22 outcome does not yet mention the aborted-batch path that 2788f80 fixed; adding a clause there is optional record keeping (info).

### Anti-Patterns Found

None in the files 2788f80 changed. The previous report's blocker (the over-broad filter at `update-cascade.ts:246`) is gone.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------ |
| 1 | A constrained `github` dependency whose written `repo` zHi now refuses still has its tag list read for `<owner>/<repo>` before the clone plan refuses it (recorded in 04-GAP-REVIEW-FIX.md as not checked against upstream) | other | Carried over. New scope, and no deterministic evidence of a user-visible difference or of upstream's order |

No new advisory finding from 2788f80.

### Review Findings and Open Records

| Item | State at HEAD | Judgement |
| ---- | ------------- | --------- |
| CR-A-01, CR-A-02, CR-B-01, CR-B-02, WR-A-02 to WR-A-04, WR-B-01 to WR-B-03, IN-A-05 | Fixed or recorded (initial report) | Closed |
| WR-A-01 | Covered by the D-SG-21 outcome | Not a gap |
| IN-A-01 (owner/repo format) | Fixed by 04-20 as parity with upstream's `zHi`, then moved to the written `repo` by WR-G-03 | Closed |
| IN-A-02 (`http://` labelled HTTPS) | Fixed by 04-19 (`via-http`) | Closed |
| WINDOWS #139 (enable shows no `unsupported source` for a non-owner/repo repository) | Open deviation | Maintainer-accepted. It is older than this phase: enable's ladder classifies no clone failure. PROJECT.md D-SG-18 says enable does not yet report it |
| Fetch `remote` row has no note | Recorded in the D-SG-22 outcome | Maintainer-accepted: no public input reaches it |
| #138 dependency rollback rows and the reinstall manual-recovery row | Unit proof only | Maintainer-accepted: the harness has no rollback fault for a cloned plugin, and no restore fault for a reinstall |
| D-SG-21, D-SG-25, D-SG-26, the `.json` legacy exception (WINDOWS #129) | Recorded decisions | Maintainer-accepted |
| WINDOWS #126 (debug line keyed on the note) | Open deviation | Warning. Debug output only. No user-visible row is wrong |

### Gap Review Follow-Up

| Item | State at HEAD | Judgement |
| ---- | ------------- | --------- |
| WR-G-01 (aborted bulk update repeats the sync note in a second block) | Still fixed: the failing target's own rowless group is dropped. Its unit case and `github-transport-update.feature:191` pass at HEAD and fail under the keep-every-group mutation | Closed |
| WR-G-02 (unchanged autoupdate drops a plugin re-clone's note) | Unchanged since the previous report | Closed |
| WR-G-03 (owner/repo check ran on the stripped pair) | Unchanged since the previous report | Closed |
| WR-G-04, IN-G-01 (wrappers, duplicate predicate) | Unchanged | Closed |
| IN-G-02 (apply and import enable rows name no member clone) | Cannot happen (previous report) | Not a gap |
| Aborted bulk update, another marketplace's sync re-clone (previous gap) | Fixed by 2788f80: the filter keys on the failing target's scope and marketplace. Two unit cases and `github-transport-update.feature:215` fail at 824703c and pass at HEAD | Closed |

### Human Verification Required

These items are in the frontmatter. Automated checks pass; these remain.

1. **Windows SSH-first plugin install (SG-SSH-05, WINDOWS #128).** Test: the manual Windows check on the pull request. Expected: SSH first, then the `-G` check through Git for Windows' sh, then HTTPS, then SSH. Why human: CI and this sandbox run Linux only.
2. **Real ssh against github.com (04-VALIDATION Manual-Only).** Test: run the probe and SSH clones on a machine with a GitHub key and on one without. Expected: the probe reads configured or not-configured as upstream does, and the clones follow. Why human: no test may reach github.com or run a real ssh.

### Human Validation (2026-11-27)

The maintainer chose to run both human items as manual checks on the pull request: the Windows SSH-first plugin install (SG-SSH-05, WINDOWS #128) and real ssh against github.com, with and without a GitHub key. Every automated check passes, so the phase status is `passed`, and the two checks stay open on the pull request.

### Gaps Summary

No gaps. The one gap of the previous report is closed. In a plural `/claude:plugin update` that aborts on a failing target, the aborted cascade now drops a rowless marketplace group only when it is the failing target's own scope and marketplace, which the failure notification already names. Every other GitHub marketplace that its PUP-2 sync re-cloned keeps its block with the transport note. The fix reaches the filter from all three abort paths. Two unit cases and one scenario fail without it. The WR-G-01 duplicate stays suppressed, and the changed repair step still asserts what its three earlier users asserted. Truths 1 to 4 are untouched by the fix and stay green in the supplied gate. The two human items and the accepted records carry over unchanged.

---

_Verified: 2026-11-27T06:53:40Z_
_Verifier: Claude (gsd-verifier)_
