---
phase: 04-ssh-sources-and-transport-selection
verified: 2026-11-27T06:02:20Z
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
covered_digest: "v4:sha256:a091dbde7d72c0da67ccdc4b34685b73468db990fe4abffab5da167755b8f4c1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Gap review WR-G-01: an aborted bulk update no longer sends a second block that repeats the failing target's sync note (112555c)"
    - "Gap review WR-G-02: an unchanged marketplace update with autoupdate on keeps the up-to-date row of a plugin whose update re-cloned it (fc00741)"
    - "Gap review WR-G-03: the owner/repo refusal reads a github object source's repo as the manifest wrote it, as upstream zHi does (96c6e31)"
    - "Gap review WR-G-04 and IN-G-01: pass-through wrappers and the duplicate predicate removed (7e5046f, 9049813)"
  gaps_remaining: []
  regressions:
    - "D-SG-22: the WR-G-01 fix drops the PUP-2 re-clone note of every marketplace other than the failing target's in an aborted bulk update. 3bde55c showed it (with the duplicate WR-G-01 reported); 373e8e6 did not"
gaps:
  - truth: "D-SG-22: every GitHub clone's final notification names its transport, with the retry line and the both-failed error when they apply"
    status: partial
    reason: "In a plural update that aborts on a failing target, a different marketplace whose PUP-2 sync re-cloned it over GitHub for an earlier unchanged target is named by no notification. groupCascadeOutcomes drops every group with no rows when abortedByFailure is set, but the failure notification (notifyDirectFailure) names only the failing target's own marketplace. 04-GAP-REVIEW-FIX.md records this as a residual; no maintainer decision accepts it."
    artifacts:
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts"
        issue: "Line 246: `group.plugins.length > 0 || (!abortedByFailure && group.clone !== undefined)` cannot tell the failing target's marketplace from another one"
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
        issue: "abortUpdateBatch (:937) passes only `true` to the cascade, not the failing target's scope and marketplace; its three callers (:625, :673, :699) all know `t`"
    missing:
      - "Pass the failing target's `scope:marketplace` into the aborted cascade and drop a rowless group only when it is that key; keep every other rowless group that carries a sync note"
      - "A unit case in test/orchestrators/plugin/update-cascade.test.ts: aborted plural batch, one unchanged outcome in marketplace `other` whose sync note is set, failing target in `mp`; expect one notification naming `other`'s clone"
      - "A scenario with two github marketplaces that both moved: the first plugin is unchanged, the second plugin's update fails; expect the failure block and a second block naming the first marketplace's re-clone"
      - "Or, if the maintainer accepts the residual: an override entry (see the report body) and a note in the PROJECT.md D-SG-22 outcome"
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
**Verified:** 2026-11-27T06:02:20Z
**Status:** gaps_found
**Re-verification:** Yes, after the gap review fixes (112555c..1837ce1). The previous report (2026-11-26T22:55:28Z, HEAD 3bde55c) was `human_needed` at 5/5. It went stale because the fixes changed covered source files.
**HEAD:** 75b740b on `features/system-git`. The code changes since the previous report are the five fix commits 112555c, fc00741, 96c6e31, 7e5046f, and 9049813: 10 extension files, 4 feature files, 1 step file, and 6 test files. 96868c6 adds only a guard scenario. 1837ce1, 38e4ce2, and 75b740b change records only. The covered file set is unchanged, and every changed extension file is in it.

## Goal Achievement

### Observable Truths

Truths 1 to 4 are the ROADMAP success criteria. Truth 5 is D-SG-22, the maintainer decision that 04-02, 04-08, 04-13 to 04-17, and 04-19 to 04-25 carry as must-haves ("names the transport of every GitHub clone").

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `marketplace add` with a `git@host:path` URL (and the `ssh://`, `git+ssh://`, `ssh+git://` forms as discuss chose), install over SSH from it, `git://` refused, `http://` and the git-subdir `url` as discuss chose, cucumber pins each form (SG-SSH-01) | VERIFIED (regression check) | `domain/git-url.ts` is unchanged since 3bde55c. The git-subdir shorthand test now calls `isGitHubOwnerRepo` (`source.ts:308`), with the same regex (`GITHUB_OWNER_REPO`, `source.ts:116`) as before (IN-G-01 rename). The re-run of `marketplace/ssh-source.feature` and `plugin/ssh-source.feature` passes. The `ssh://`, `git+ssh://`, and `ssh+git://` command-line refusal is D-SG-17 parity, accepted 2026-11-25. |
| 2   | For an `owner/repo` marketplace source: SSH first only when the probe says configured, HTTPS first otherwise, a retry over the other transport, upstream's both-failed error, upstream's progress lines; `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` gives HTTPS with no probe; `CLAUDE_CODE_REMOTE` changes nothing (SG-SSH-02, SG-SSH-03) | VERIFIED (regression check) | The fixes do not touch the marketplace clone plan (`domain/github-transport.ts` changed only the predicate name at `:122`). The re-run of `marketplace/github-transport.feature` and `marketplace/github-refresh.feature` passes. The three marketplace clone paths of the previous report (bootstrap, D-MF-04 add, bulk no-op re-clone) are unchanged. |
| 3   | A `github` plugin source on install, update, and dependency install follows the probe, fallback, and skip rules of the chosen surface (D-SG-18, D-SG-19); on Windows a plugin install retries an SSH failure over HTTPS (SG-SSH-04, SG-SSH-05) | VERIFIED (Windows on fake-platform unit rows; real Windows is a human item) | Plan logic unchanged. WR-G-03 changes only the input of the zHi refusal: `parseDiscriminatorObjectSource` puts the manifest `repo` on `GitHubSource.repository` for the `{ "source": "github" }` arm only (`source.ts:404`), and `pluginCloneTransport` checks `source.repository ?? <owner>/<repo>` before it reads the force, a check, or the probe (`orchestrators/github-transport.ts:392-394`). The string shorthand and the github.com `url` object keep their D-MF-07 / D-PL5-13 / D-76-02 parsing. No other code reads `repository` (it does not enter the clone key or the D-SG-23 comparison). The new Outline `plugin/github-transport.feature:226` (4 rows) passes at HEAD and fails on 4 of 4 rows against the pre-fix code. The four new `github-transport.test.ts` cases fail there too. PROJECT.md D-SG-18 carries the 2026-11-27 amendment. |
| 4   | A marketplace or plugin cloned over SSH is the same source as its HTTPS form: never refused as a stale clone, and its `plugin-clones/<key>/` does not move (SG-SSH-06) | VERIFIED (regression check) | `domain/clone-key.ts` is unchanged since 3bde55c. The D-SG-23 comparison in `source.ts` (`gitHubIdentityOf`) does not read the new `repository` field. |
| 5   | D-SG-22: every GitHub clone's final notification names its transport, with the retry line and the both-failed error when they apply | FAILED (partial) | Every path of the previous report still carries its note, and WR-G-02 closes one more (autoupdate no-op re-clone). But the WR-G-01 fix opened a hole. `groupCascadeOutcomes` drops every rowless group once the batch is aborted (`update-cascade.ts:246`), and the failure notification names only the failing target's own marketplace (`notifyDirectFailure`, `update-flow.ts:1340`; `marketplaceClone = args.clones?.marketplace(scope, marketplace)`). So in a plural update across two GitHub marketplaces, `other`'s PUP-2 re-clone for an earlier unchanged target is named nowhere when a target of `mp` then fails. I reproduced this with a throwaway unit case (`composeUpdateCascade(..., [unchanged in "other"], "plural", true, { marketplace: note for "other" })` emits no notification). The case was then deleted. 3bde55c named it. 04-GAP-REVIEW-FIX.md records it as a residual, with no maintainer acceptance. The fixer gave a reason against the review's second fix: it would also strip the note from the failing marketplace's group that has rows. That reason does not apply to a filter keyed on the failing target's `scope:marketplace` that drops only rowless groups. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### D-SG-22 Path Closure (truth 5)

"Pre-gap" means HEAD tests run against the extension code at 373e8e6, the commit before the gap plans. The previous report checked those columns, and I did not re-run them. The new rows were checked against the pre-fix code at b0c6df9. Line numbers in `github-transport-update.feature` after `:170` moved by 24, because WR-G-01's scenario was added at `:191`.

| Path (WINDOWS / review) | Code at HEAD | Test that fails without the change | HEAD | Pre-gap / pre-fix |
| -------------- | ------------ | ---------------------------------- | ---- | ------- |
| Disabled install row, standalone (#130) | `PluginDisabledMessage.clone` (`notification-types.ts:576`); requesting row in `install-cascade.messaging.ts` | `git-source.feature:123` | pass | fail |
| Disabled install row, apply (#130) | `notify.ts` puts the install view's note on the `(disabled) {installs disabled}` row | `github-transport-apply.feature:118` | pass | fail |
| Failure while an install plans its dependency moves (#131) | `install-flow-planning.ts:276` passes the notes through `projectCaughtFailure`, and `projectFailedMoves` takes them too | `install-dependencies.feature:469` | pass | fail |
| D-MF-04 add of another marketplace (#132) | `addedMarketplaceBlocks` / `addedMarketplaceNames` (`install-flow-results.ts`, `install-cascade.messaging.ts`) | `cross-scope-install.feature:35` | pass | fail |
| Skipped update row (#133) | `withCloneNote` directly for every status (`update-cascade.ts:202`, after WR-G-04) | `github-transport-update.feature:44` | pass | fail |
| Partially-upgradable update row (#133) | `PluginPartiallyUpgradableMessage.clone` (`notification-types.ts:670`) | `github-transport-update.feature:60` (builtin profile) | pass | fail |
| Skipped reinstall row (#133) | `withCloneNote` directly for every status (`reinstall.messaging.ts:145`, after WR-G-04) | `github-transport-update.feature:277` | pass | fail |
| Manual-recovery reinstall row (#133) | same, `PluginManualRecoveryMessage.clone` (`notification-types.ts:770`) | unit `reinstall.messaging.test.ts` (maintainer-accepted unit-only) | pass | fail |
| Autoupdate cascade plugin rows (#134) | `PluginUpdateBase.clone` (`orchestrators/types.ts`), set by the autoupdate seam in `update-flow.ts`, copied in `marketplace/update.messaging.ts` | `marketplace/update.feature:796` | pass | fail |
| Autoupdate no-op whose plugin update re-cloned (WR-G-02) | `clonedRows` keeps the up-to-date row of each outcome with a note (`marketplace/update.ts:1269-1273`) | `marketplace/update.feature:819`; unit "an all-unchanged autoupdate cascade keeps the up-to-date row..." | pass | fail (pre-fix) |
| Bulk update that changed nothing (#135) | `update-cascade.ts` keeps an empty marketplace group that carries a sync note, and an up-to-date row that cloned | `github-transport-update.feature:170` and `:215` | pass | fail |
| Aborted bulk update, failing target's marketplace (WR-G-01) | rowless group dropped when `abortedByFailure` (`update-cascade.ts:246`); the failure block keeps the note | `github-transport-update.feature:191`; unit "an aborted bulk update sends no block that only repeats..." | pass | fail (pre-fix: second block) |
| Aborted bulk update, another marketplace's sync re-clone (new) | same filter drops it, and no other notification names it | none | **no note** | 3bde55c: named; 373e8e6: no note |
| Failing enable cascade member (#136) | `run.failingMember` set in the member phase's catch (`enable-disable.ts:1088`); the root row gets the member's note labelled `clone.plugin` (`enable-disable.messaging.ts`) | `github-transport-update.feature:391` | pass | fail |
| Enable that fails after its ledger (#137) | the transaction-throw row reads the root key's note (`enable-disable.ts`) | `github-transport-update.feature:420` (harness fault `holdInstallationRecordReadOnly`) | pass | fail |
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
| `domain/github-transport.ts` | Marketplace clone plan, `tagReadUrl`, `TransportForce`, `writtenAddressNote` | VERIFIED | Only the predicate import was renamed (IN-G-01) |
| `domain/github-plugin-transport.ts` | Plugin plan, skip checks, Windows plan | VERIFIED | Only the predicate import was renamed (IN-G-01) |
| `domain/source.ts` | `isGitHubOwnerRepo` (zHi / KHi), `GitHubSource.repository` | VERIFIED | One predicate over `GITHUB_OWNER_REPO` (`:116`, `:126`). `repository?` (`:48`) is set only on the github object arm (`:404`). `isGitSubdirShorthand` and `isGitHubRepositoryFormat` have no remaining users |
| `orchestrators/github-transport.ts` | Runner, clone notes, per-command plugin context, the zHi refusal | VERIFIED | `:392-394` checks the written `repo` first, before the plan reads anything |
| `shared/errors.ts` `InvalidGitHubRepositoryError` | Upstream's message, typed field, accurate doc | VERIFIED | The doc now names the value it holds (WR-G-03) |
| `orchestrators/plugin/update-cascade.ts` | Bulk cascade grouping with clone notes | PARTIAL | WR-G-01's filter is correct for the failing target's marketplace and wrong for every other one (gap) |
| `orchestrators/marketplace/update.ts` | Autoupdate no-op block | VERIFIED | `clonedRows` (WR-G-02) |
| `update.messaging.ts`, `reinstall.messaging.ts` | No pass-through wrappers | VERIFIED | `withUpdateCloneNote` / `withReinstallCloneNote` deleted, call sites call `withCloneNote` (WR-G-04) |
| Every artifact of the previous report not listed here | | VERIFIED (regression) | Not touched by the fixes |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `parseDiscriminatorObjectSource` (github arm) | `pluginCloneTransport` | `GitHubSource.repository` | WIRED (96c6e31) |
| `pluginCloneTransport` | `isGitHubOwnerRepo` | refusal before the force and the checks are read | WIRED |
| `composeUpdateCascade` | `groupCascadeOutcomes` | `abortedByFailure` | WIRED, but carries no failing-target key (gap) |
| `abortUpdateBatch` (`update-flow.ts:937`) | `composeCascade` | `true` plus the run's `clones` | WIRED; the failing target `t` is not passed |
| `refreshOneMarketplace` no-op block | `outcomeToCascadePluginMessage` | `clonedRows` | WIRED (fc00741) |
| `update-cascade.ts`, `reinstall.messaging.ts` | `withCloneNote` | direct calls | WIRED (7e5046f) |
| Every link of the previous report | | | WIRED (regression; the transport feature re-run passes) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Marketplace and plugin rows, bare D-MF-04 blocks | `clone` note (`note`, `url`, `retries`, `plugin`) | `recordNote` in `orchestrators/github-transport.ts` from the run's plan and retries, redacted; read per row key through `GitHubCloneNotes` views | Yes, asserted by the scenario tables over the stand-in git host | FLOWING |
| Aborted bulk update, rowless group of a non-failing marketplace | `group.clone` | `clones.marketplace(scope, marketplace)` | Computed, then filtered out at `update-cascade.ts:246` | DISCONNECTED (gap) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| The four new gap review scenarios, adapter, HEAD | `node scripts/cucumber.mjs --profile adapter` over `github-transport-update.feature:191`, `marketplace/update.feature:819`, `github-transport.feature:226` (Outline, 4 rows), `github-transport-apply.feature:149` | 7 scenarios, 7 pass | PASS |
| Same, against the pre-fix code | scratch worktree at b0c6df9 with HEAD `features/` | 6 fail (WR-G-01, WR-G-02, the 4 WR-G-03 rows); the IN-G-02 guard passes, as intended | PASS (the tests fail without the change) |
| New unit cases against the pre-fix code | HEAD `update-cascade.test.ts`, `marketplace/update.test.ts`, `github-transport.test.ts` at b0c6df9 | 6 fail: the 4 zHi cases, the autoupdate no-op case, the aborted-batch case | PASS |
| Regression, phase transport features | adapter over `marketplace/github-transport`, `marketplace/github-refresh`, `plugin/github-transport`, `marketplace/ssh-source`, `plugin/ssh-source`, `plugin/github-transport-update`, `plugin/github-transport-apply`, plus `marketplace/update.feature:796` and `plugin/fetch.feature:236` | 70 scenarios, 70 pass | PASS |
| Builtin-only partially-upgradable row | `--profile builtin features/plugin/github-transport-update.feature:60` | 1 pass | PASS |
| Owner unit tests of the touched files | `env -u GIT_CONFIG_COUNT node --import ./scripts/isolated-pi-home.mjs --test` over `domain/source`, `orchestrators/github-transport`, `plugin/update-cascade`, `marketplace/update`, `plugin/update.messaging`, `plugin/reinstall.messaging`, `domain/github-transport`, `domain/github-plugin-transport` | 670 tests, 670 pass | PASS |
| The new gap: another marketplace's re-clone in an aborted batch | throwaway `composeUpdateCascade` case (deleted after the run) | no notification is emitted | FAIL (gap) |
| Debt markers in every file changed since 3bde55c | grep `TBD|FIXME|XXX|TODO|HACK` | none | PASS |

No test reached a real host or ran a real ssh. The scenarios run over the stand-in git host and the ssh stand-in. The unit runs use `isolated-pi-home.mjs` with `GIT_CONFIG_COUNT` unset.

I did not re-run the full gate. I take the supplied gate evidence at 1837ce1 as given (the code tree is the same at 75b740b): `check:static`, `test:unpaired`, `test:integration`, and `test:coverage:direct:all` pass. Cucumber adapter: 2414 of 2419 pass. The only failures are the 5 known fd-dependent Glob scenarios in `features/hook/tool-use.feature` (`:296`, `:355`, `:443`, `:1696`, `:1834`), because fd is not installed. Cucumber builtin: 261 of 261 pass.

### Probe Execution

SKIPPED. No phase 4 plan declares a `probe-*.sh` script.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| SG-SSH-01 | 04-01, 04-03 | SSH URL forms with upstream's validator, `git://` refused | SATISFIED | Truth 1, D-SG-17 |
| SG-SSH-02 | 04-02, 04-04, 04-05, 04-08, 04-09, 04-13, 04-19, 04-21, 04-22, 04-24, 04-26 | Probe, order, retry, progress lines, both-failed error | BLOCKED (partial) | Truth 2 holds. The progress-line clause fails on one path: the PUP-2 re-clone of a non-failing marketplace in an aborted bulk update (truth 5 gap) |
| SG-SSH-03 | 04-04, 04-05 | PREFER_HTTPS, CLAUDE_CODE_REMOTE not read | SATISFIED | Truth 2, D-SG-24 |
| SG-SSH-04 | 04-06, 04-07, 04-11, 04-12, 04-14 to 04-17, 04-19 to 04-26 | Plugin probe, fallback, and skip rules on install, update, dependency install | SATISFIED | Truth 3, D-SG-18 (amended 2026-11-27), D-SG-19, D-SG-20, D-SG-25 |
| SG-SSH-05 | 04-10 | Windows SSH-to-HTTPS retry | SATISFIED on unit rows; real Windows is a human item | Truth 3, WINDOWS #128 |
| SG-SSH-06 | 04-03, 04-06, 04-09 | Scp-aware identity, key unchanged | SATISFIED | Truth 4, D-SG-23 |

No orphaned requirements. REQUIREMENTS.md still shows SG-SSH-01 to SG-SSH-06 unchecked and "Pending", and ROADMAP.md line 107 leaves Phase 4 unchecked. They should be ticked when the phase closes (info, not a gap).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `orchestrators/plugin/update-cascade.ts` | 246 | Over-broad filter: an abort flag stands in for "the failure block already names this marketplace" | Blocker | Drops a GitHub re-clone note that nothing else shows (truth 5) |

No debt markers in the files changed since 3bde55c.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------ |
| 1 | A constrained `github` dependency whose written `repo` zHi now refuses still has its tag list read for `<owner>/<repo>` before the clone plan refuses it (recorded in 04-GAP-REVIEW-FIX.md as not checked against upstream) | other | New scope, and no deterministic evidence of a user-visible difference or of upstream's order |

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

### Gap Review Follow-Up (2026-11-27)

`04-GAP-REVIEW.md` found 0 critical, 4 warnings, and 2 info items after the previous report. `04-GAP-REVIEW-FIX.md` records the fixes, merged at 1837ce1. I checked each one against the code at HEAD, not against the fix report.

| Item | State at HEAD | Judgement |
| ---- | ------------- | --------- |
| WR-G-01 (aborted bulk update repeats the sync note in a second block) | Fixed for the failing target's marketplace (`update-cascade.ts:246`), with a unit case and the scenario `github-transport-update.feature:191`. Both fail on the pre-fix code | Closed as reported. But the fix over-reaches: see the new gap below |
| WR-G-02 (unchanged autoupdate drops a plugin re-clone's note) | Fixed (`marketplace/update.ts:1269-1273`), with a unit case and the scenario `marketplace/update.feature:819`. Both fail on the pre-fix code | Closed |
| WR-G-03 (owner/repo check ran on the stripped pair) | Fixed: `GitHubSource.repository` holds the written `repo` of the github object arm only, and the plan checks it first. D-SG-18 amended. Four unit cases and the Outline `github-transport.feature:226` (4 rows) fail on the pre-fix code | Closed |
| WR-G-04, IN-G-01 (wrappers, duplicate predicate) | Refactored. The old names have no remaining users | Closed |
| IN-G-02 (apply and import enable rows name no member clone) | Cannot happen. `resolveEnableCascadeStep` returns `skipped` when `!enable \|\| orchestrated` (`enable-disable.ts:1550`), so `cascadeMembers` is empty (`:2570`), and the fresh-root cascade runs only `if (enable && !orchestrated)` (`:2616`). `failingMember` is set only in the member phase's catch (`:1088`), so it is never set on the path apply and import take. The guard scenario `github-transport-apply.feature:149` pins the dependency's own failed row and passes | Not a gap (confirmed) |
| New: aborted bulk update, another marketplace's sync re-clone | Dropped by the WR-G-01 filter, and named by no other notification. Reproduced with a throwaway unit case. Recorded as a residual in the fix report, with no maintainer acceptance | Gap (truth 5) |

Gate at 1837ce1: static, unpaired, integration, and direct coverage pass. Cucumber adapter: 2414 of 2419 pass; the 5 failures are the known `fd` Glob scenarios in `features/hook/tool-use.feature`. Cucumber builtin: 261 of 261 pass.

### Human Verification Required

These items are in the frontmatter. They stay open whatever the gap's outcome.

1. **Windows SSH-first plugin install (SG-SSH-05, WINDOWS #128).** Test: the manual Windows check on the pull request. Expected: SSH first, then the `-G` check through Git for Windows' sh, then HTTPS, then SSH. Why human: CI and this sandbox run Linux only.
2. **Real ssh against github.com (04-VALIDATION Manual-Only).** Test: run the probe and SSH clones on a machine with a GitHub key and on one without. Expected: the probe reads configured or not-configured as upstream does, and the clones follow. Why human: no test may reach github.com or run a real ssh.

### Gaps Summary

One gap, and the WR-G-01 fix caused it. In a plural `/claude:plugin update` that aborts on a failing target, the aborted cascade now drops every marketplace group with no rows. The failure notification names only the failing target's own marketplace. So when another GitHub marketplace was re-cloned by its PUP-2 sync for an earlier unchanged target, no notification names that clone's transport. 3bde55c named it, though with the WR-G-01 duplicate. 373e8e6 did not. The fix is small. `abortUpdateBatch` already knows the failing target. It can pass that target's `scope:marketplace` to the cascade, and the filter can then drop only that rowless group. Add the unit case and the two-marketplace scenario listed in the frontmatter.

**If the maintainer accepts the residual instead,** add this to the frontmatter and record it in the PROJECT.md D-SG-22 outcome:

```yaml
overrides:
  - must_have: "D-SG-22: every GitHub clone's final notification names its transport, with the retry line and the both-failed error when they apply"
    reason: "An aborted bulk update names the sync re-clone of the failing target's marketplace only; another marketplace's re-clone in the same aborted batch goes unnamed (as at 373e8e6)"
    accepted_by: "{maintainer}"
    accepted_at: "{ISO timestamp}"
```

Everything else holds. WR-G-02, WR-G-03, WR-G-04, and IN-G-01 are fixed, and each behavior fix has a test that fails without it. IN-G-02 cannot occur. Truths 1 to 4 hold on the regression re-run. The two human items and the accepted records carry over unchanged.

---

_Verified: 2026-11-27T06:02:20Z_
_Verifier: Claude (gsd-verifier)_
