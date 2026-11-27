---
phase: 05-credential-surface
reviewed: 2026-11-27T00:00:00Z
diff: 9debd0d..465d1c2
parts: [A source and gate config (44 files), B tests, harness and features (84 files)]
findings: {critical: 1, warning: 9, info: 10}
status: issues_found
---

# Phase 5 Code Review

Two reviewers split the diff. Overlaps: A WR-01 and B WR-05 share one root cause (`lacksStoredCredential`); A WR-02 and B WR-04 are one finding (auth-host leaves the leak scan).

# Part A: source and gate config


# Phase 5 (05-credential-surface): Code Review Report

**Reviewed:** 2026-11-27
**Depth:** deep
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Reviewed `git diff 9debd0d HEAD` over the 44 production and gate-config files. I traced
`authBundleFor` and `lacksStoredCredential` to every caller, and checked the deleted
modules (`domain/auth-registry.ts`, `domain/github-auth.ts`, `platform/git-credential.ts`,
`platform/git-one-shot-credential.ts`) for remaining dependents. `tsc --noEmit`, ESLint
(`--max-warnings 0`) on the reviewed files, and `fallow dead-code` all pass on HEAD.

These parts check out against the code:

- **Host binding:** `authBundleFor` (`orchestrators/auth-host.ts:58-65,107-109`) binds the
  same host as the old `buildCloneAuth`/`buildGitHubAuth` split, including the GitHub base
  override. The GitHub test moved from `gitHubWireUrl(url) !== url` to `gitHubAddressOf`,
  but the old non-GitHub arm already went through `hostFromCloneUrl`'s `gitHubAddressOf`
  check, so the result is the same. Marketplace add, update, the PUP-2 sync, and the
  plugin probes now all bind from `canonicalCloneUrl(source)`. For a url source that is
  `source.url`, the host the old code read.
- **Refused credential:** `runWithAuthBundle` (`platform/git.ts:349-370`) still maps a
  `https-auth`/`rejected` failure of a request to the bundle's own https origin to
  `StoredCredentialRejectedError`. It now does so for every host, as OQ1 accepted.
- **Non-interactive git:** the D-SG-05 environment is unchanged
  (`platform/git-process.ts:315-323,665-670,507`). `GitRequest.input` and the
  `credential` subcommand are gone, and `runProcess` opens stdin as `"ignore"` when no
  input is given (`platform/process-run.ts:420`).
- **No token variable:** no extension module names `GITHUB_TOKEN`, `GH_TOKEN`, or
  `GITLAB_TOKEN`.
- **Gates:** `fetch-chokepoint` now exempts only `platform/hosted-manifest-fetch.ts`.
  `GIT_PROCESS_IMPORTERS` is `platform/git.ts` alone. `NETWORK_SEAMS` has 16 entries, and
  no config file names a deleted module.
- **Deleted modules:** nothing in `extensions/` imports them or names their exports.

Concerns:

- **WR-01:** widening the D-1-02 hint to github.com (OQ1) exposes a classification bug.
  A two-transport GitHub marketplace refresh can show "no credential was obtained" when
  a credential was in fact refused, or when only SSH failed.
- **WR-02:** `auth-host.ts` claims a credential-leak gate that no longer scans it.
- **WR-03:** the constraint gate still threads a notification context only to decide
  whether to attach an auth bundle, which is a leftover of Device Flow.
- **Info:** some stale comments, an unused stdin path in the launcher, and a tag-listing
  skip whose cited reason (NFR-5) does not contain the rule.

## Warnings

### WR-01: The D-1-02 hint is attached to refused credentials and SSH failures after a two-transport GitHub refresh

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:288-302`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:500-514`

**Issue:** `lacksStoredCredential` checks `instanceof StoredCredentialRejectedError` only on the
outer error. It then asks `classifyGitFailure` for `authentication required`. Two problems
follow:

1. A GitHub `owner/repo` marketplace with no transport force gets a two-attempt plan: SSH
   then HTTPS, or HTTPS then SSH (`domain/github-transport.ts:207-215`). When both attempts
   fail with different messages, the refresh throws `GitHubTransportsFailedError`
   (`orchestrators/github-transport.ts:157-165`). `classifyGitFailure` classifies that
   wrapper by its last attempt (`shared/git-failure-classifiers.ts:118-122`). The outer
   `instanceof` check therefore never sees the `StoredCredentialRejectedError` inside the
   wrapper. Example: SSH fails with `publickey`, then HTTPS gets the helper's credential
   and the host refuses it. `attachStoredCredentialCause` then adds "no credential was
   obtained for github.com; store one with ... git credential approve" in front of a
   `StoredCredentialRejectedError` cause. That is the case the doc comment says must not
   qualify (GAUTH-04).
2. The `authentication required` reason also covers `ssh-auth`, `ssh-host-key-unknown`,
   and `ssh-host-key-changed` (`shared/git-failure-classifiers.ts:170-173`). An HTTPS
   network failure followed by an SSH `publickey` failure therefore gets an HTTPS
   credential-helper remedy. The doc comment at `shared.ts:289-291` says only `https-auth`
   with detail `no-credential` qualifies, so the code and the contract disagree.

Before this phase, the removed `auth.kind === "stored-credential"` test kept github.com
(a `device-flow` bundle) out of this path. When the base override was set, the source was
`stored-credential`, but D-SG-21 skips every SSH attempt, so the plan had only one attempt
and no wrapper. The phase makes this reachable for every github.com marketplace on
`marketplace update`.

**Fix:** Decide on the git failure itself, and unwrap the transport wrapper:

```ts
export function lacksStoredCredential(err: unknown): err is Error {
  if (!(err instanceof Error)) {
    return false;
  }

  const failures =
    err instanceof GitHubTransportsFailedError ? err.attempts.map((a) => a.error) : [err];
  if (failures.some((f) => withoutCleanupLeaks(f) instanceof StoredCredentialRejectedError)) {
    return false;
  }

  return failures.some((f) => {
    const e = withoutCleanupLeaks(f);
    return (
      e instanceof GitCommandError &&
      e.failure.kind === "https-auth" &&
      e.failure.detail === "no-credential"
    );
  });
}
```

Add a unit case for each two-attempt order (SSH then HTTPS rejected, and HTTPS network
failure then SSH `publickey`).

### WR-02: auth-host.ts claims a credential-leak gate that no longer scans it

**File:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:24-25`, `test/architecture/gate-targets.ts:140-153`

**Issue:** The module header says "AUTH-09: no credential field is ever interpolated into an
Error/notify here; enforced by test/architecture/no-credential-leak.test.ts." This phase
removed `orchestrators/auth-host.ts` from `CREDENTIAL_LEAK_TARGETS`. At `9debd0d` it was an
entry. Today the list is state-io, migrate, with-state-guard, git, marketplace add and
update, hosted-manifest-fetch, and git-process. So nothing enforces the claim. The module
still builds user-visible text that contains `password=<token>` and interpolates a host
(`NO_STORED_CREDENTIAL_CAUSE`, line 91-92). That text is the kind of surface the gate
exists for. A later edit that interpolates more than the host would pass every gate.

**Fix:** Either add the module back to `CREDENTIAL_LEAK_TARGETS`, appended last so no
positional binding moves, and aim a scan at it that allows the placeholder literal. Or
delete the "enforced by" sentence and say the AUTH-09 rule here is held by review only.

### WR-03: Phantom requirement: the constraint gate threads the notification context only to decide whether to attach an auth bundle

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:83-87,230`, `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts:80-84,123-131`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:935`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:1189`

**Category:** necessity

**Issue:** The requirement behind the gating no longer exists. The bundle used to need
`ctx`/`run` so that Device Flow could render a user code. `authBundleFor(cloneUrl, kind)`
now takes no context and does no I/O (`auth-host.ts:107-109`). Its own header says "the
bundle depends only on the address, so no verb passes a notification context to get one"
(`auth-host.ts:12-13`). Even so:

- `UpdateConstraintOptions.notification` is a full `{ ctx, run }`, but its fields are never
  read. Only `=== undefined` is tested (lines 198 and 230).
- `MarketplaceTagProbeOptions.withHostBundle?: true` exists only to carry that test into
  the tag probe. `install-cascade.ts:935` always passes `true`.

This also contradicts the stated GAUTH-04 contract. When a notification-less run (the
autoupdate cascade, through `materialize-latest.ts:205-215`) lists a git marketplace's tags
and the host refuses the stored credential, the failure stays a raw `GitCommandError`
instead of `StoredCredentialRejectedError`. The same listing from a command maps it
(`platform/git.ts:357-366`).

**Fix:** In `tagListingOf`, always pass `auth: authBundleFor(canonicalCloneUrl(source),
source.kind)`, and delete `withHostBundle` and its three call-site spreads. If WR-03's
neighbor IN-01 keeps the git-arm skip, change `UpdateConstraintOptions.notification` to an
explicit `listsSourceTags: boolean`, or drop it, rather than threading an unread context.

## Info

### IN-01: Phantom requirement (judgment): the git-arm tag skip for a notification-less run cites a rule NFR-5 does not contain

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:182-200,224-231`

**Category:** necessity

**Issue:** Before this phase, the skip was justified by Device Flow: with no `ctx`, Pi
"cannot safely authenticate a git host". The new comment cites "(NFR-5)" instead. The NFR-5
text in AGENTS.md does not contain this rule. It lets an update read a constrained
dependency's tag list (D-03-03), and it lets the background autoupdate pass "use the network
as that command does" (D-PL8-01).

The comment also says "Every REAL caller threads a `ctx`". That is not true: the cascade
mode of `materialize-latest.ts:205-215` omits the notification when
`preflightNotification` is unset.

Finally, the path arm in the same notification-less run still lists the marketplace's
remote tags (`probePathStageOne`, lines 224-231). So "a notification-less run lists no tags"
is not what the code does. Either the git skip is now an upstream divergence without a
decision ID, or the path arm breaks the rule the skip claims to keep.

**Fix:** Record the intended rule under a decision ID, then make both arms follow it.
Either remove the git-arm skip (parity), or also skip the path arm when there is no
notification, and update the comment to cite the ID.

### IN-02: Unused stdin path left in the process launcher

**File:** `extensions/pi-claude-marketplace/platform/process-run.ts:7-9,58-66,117-122,384-392,420,442`

**Issue:** `GitRequest.input` was the only production producer of `ProcessRequest.input`.
No extension caller sets it now: `platform/package-manager.ts` and `platform/git-process.ts`
pass no `input`. The stdin pipe, `writeInput`, and the `"ignore" | "pipe"` stdio type are
dead code in production. Because the launcher still accepts input, D-SG-05's amended rule
("no git command the extension starts reads stdin") holds only because `GitRequest` lacks
the field, not because the shared launcher enforces it.

**Fix:** Remove `input`, `writeInput`, and the `"pipe"` stdin option, fix stdio to
`["ignore", "pipe", "pipe"]`, and update the header comment and the module's unit tests.

### IN-03: Comments still describe the removed sign-in and credential threading

**File:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts:89-91`
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:251-253`
- `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:204`
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts:75`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:1030-1032`

**Issue:** Each comment states behavior that no longer exists:

- `install-flow-cascade-context.ts:89-91`: "`ctx` is always threaded so the git-source
  clone probe can wire the auth notify seam (PROV-03)". `InstallCloneProbeOptions` no
  longer takes `ctx` or an auth context.
- `clone-cache.ts:251-253`: "the bundle's credentials thread into the clone". The bundle
  is `{ host }` only.
- `materialize-latest.ts:204`: "The command's context for the preflight's prompts". No
  prompt exists now.
- `dependency-move.ts:75`: "so a move authenticates as the command does". The context no
  longer affects authentication.
- `update-flow.ts:1031`: "cascade mode gives git stored credentials only (D-3-04)". This
  implies other modes differ, but every mode now does the same.

**Fix:** Reword each comment to say what the code does now. For example, the
notification only decides whether the constraint gate queries tags, and the bundle names
the host whose refused credential maps to `StoredCredentialRejectedError`.

### IN-04: Comment lines over the 100-column print width added by this phase

**File:**
- `extensions/pi-claude-marketplace/platform/git.ts:606`
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts:428`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:342,1031`

**Issue:** The edits joined wrapped doc-comment lines into single lines of 115 to 140
characters. Prettier does not reflow comments, so `format:check` passes, but the lines
break the file's own wrapping and `printWidth: 100`.

**Fix:** Re-wrap these comment lines at 100 columns.

---

_Reviewed: 2026-11-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_


# Part B: tests, harness and features


# Phase 5: Code Review Report (tests, harness, behavioral scenarios)

**Reviewed:** 2026-11-27
**Depth:** standard (with cross-checks into the extension code the scenarios pin)
**Files Reviewed:** 84
**Status:** issues_found

## Summary

Scope: the test, harness and cucumber changes of `git diff 9debd0d HEAD` for the Device Flow removal (SG-AUTH-01..03, D-SG-27/28/29).

What holds up:
- The interactive "no device code" pins are sound. `the command reports these results:` and `the session reports these results:` compare the whole result list. `pi routes these github requests:` compares the whole redirect log. The redirect now sends every `github.com` path to the git host, which logs it, so any Device Flow POST to `/login/device/code` would add rows to both tables (`test/architecture/github-redirect.test.ts` pins that route).
- The token-leak step (`no request the git host received carries`) checks the path and every header, decodes Basic auth, and refuses to pass when no request was sent.
- The ssh argv is pinned in full in the GitHub token scenario.
- The refused stored credential (`github.com rejected the stored credential`), the D-1-02 hint, base-override binding (`auth-host.test.ts`), print mode, and `lacksStoredCredential` keep equivalent unit or cucumber coverage after the deletions. I checked every removed test title against its replacement.
- I found no path to a real host or a real ssh. The redirect, the CONNECT proxy and the ssh stand-in all refuse non-loopback targets.

What does not hold up:
- One scenario's "shows no notice" claim is backed by a step that only matches success notices (CR-01).
- SG-AUTH-03 ("the extension never deletes a stored credential") is not pinned on the one path where deleting would matter (WR-01).
- The token scenarios have no check that the token variables ever reached Pi (WR-02).
- Two NFR-5 network traps were re-documented as not covering git, but were not fixed (WR-03).
- A surviving module dropped out of the AUTH-09 scan, while its header still says the scan covers it (WR-04).
- An edited expectation pins a misplaced stored-credential hint (WR-05).
- There are coverage gaps for plugin update and plugin install (WR-06).
- Info items: stale names and titles.

## Critical Issues

### CR-01: "shows no notice" in the background no-credential scenario rests on a step that only sees success notices

**File:** `features/marketplace/credentials.feature:255-272` (title on line 255). Step: `features/step_definitions/marketplace/background-update.steps.ts:111-117`. Filter: `features/lib/pi-tui.ts:327-333`.
**Issue:** The scenario is titled "The background update of a private GitHub marketplace with no stored credential shows no notice and asks for nothing". It is the SG-AUTH-02 pin for the background pass. Its only notice check is `Then the tui session reports no notice`. That step asserts `backgroundUpdateNoticeTexts(tui.text)` is empty, and that function keeps only text that matches `/Plugins? updated: .*? · Run \/reload to apply/`. It then calls `markTuiNoticesCompared()`, which per `world.ts:1186` "marks the complete TUI notice set compared". The update fails in this scenario, so no "Plugins updated" text can appear whatever the product does. If the background pass started showing an authentication-failure toast, a sign-in hint, or any other notice, the scenario would still pass. Under `.agents/skills/cucumber/SKILL.md` this is a BLOCKER: "a scenario a plausible wrong implementation still passes". The phase gave this scenario its "shows no notice" title (the old one was "does not sign in"), so the gap now carries a requirement claim.
**Fix:** Add a TUI step that asserts no extension notice at all appears after the message is refused. For example, assert that the cleaned terminal text after `MESSAGE_REFUSED` holds no `claude:plugin`/marketplace notice line, or compare the screen region above the editor to an empty notice set. Use it in this scenario, or rename the existing step to `reports no background update notice` and add the stricter one:
```ts
Then("the tui session shows no notice", async function (this: ScenarioWorld) {
  const tui = this.requireTuiSession();
  await tui.waitForText(MESSAGE_REFUSED, 15_000);
  await tui.waitForQuiet(2_000, 15_000);
  assert.deepStrictEqual(extensionNoticeTexts(tui.text), []); // every notice, not only "Plugins updated"
  this.markTuiNoticesCompared();
});
```

## Warnings

### WR-01: SG-AUTH-03 "the extension deletes no stored credential" is not pinned on the refused-credential path

**File:** `features/marketplace/credentials.feature:112-145` and `:205-236`
**Issue:** The 401 scenario (line 115) expects `the user's git credential store holds no credentials`, because git's own `store` helper erases a refused credential. The 404 scenario (line 209) proves the entry stays only when git never sent it. So the case SG-AUTH-03 is about (the extension saw an auth failure for a credential it sent: `StoredCredentialRejectedError`) has no observable pin. Suppose a regression runs `git credential reject` after `StoredCredentialRejectedError`, which is exactly the AUTH-07 behavior this phase retired. The 401 scenario still sees an empty store, and the 404 scenario never reaches the rejected branch, so both pass. The 404 scenario would also pass on the base commit, so it is a regression guard, not a pin of a change. The harness already has the tool to close this: `features/lib/user-git-programs.ts` writes a `credential-helper` that records each action (`"$*"`: get/store/erase) and answers `get`.
**Fix:** Add a scenario where the user's global git config names the recording helper, the helper answers a wrong password, and the host refuses it with 401. Assert that the helper's run record is exactly git's own `get` then `erase`, once each. If the extension also deleted the credential, a second `erase` would appear. Add a `Then the credential helper has recorded these runs:` table step next to the existing `has recorded no run` step.

### WR-02: The token-variable scenarios have no check that GITHUB_TOKEN and GH_TOKEN reached Pi

**File:** `features/marketplace/credentials.feature:8-32`, `:81-110`; `features/step_definitions/git-host.steps.ts:474-495`; `features/support/world.ts:1464-1477`
**Issue:** Each scenario only asserts that a value is absent: no result and no git-host request contains `env-github-token-value` or `env-gh-token-value`. Nothing shows that the variables were in Pi's environment. If `profileGitEnvironment` stopped merging `profile.variables`, or `rpcChildEnvironment` dropped them, the scenarios would still pass while testing nothing. `test/architecture/hermetic-git-environment.test.ts` covers only `rpcChildEnvironment`, not the world path that feeds it. The harness already has a pattern for this: `features/lib/pi-launch-environment.ts` logs the variables it applies, "so the step can check that they arrived".
**Fix:** In the step that starts the routed Pi with variables, assert that the variables arrived. For example, load a small probe extension that appends `process.env.GITHUB_TOKEN`/`GH_TOKEN` presence (not the value) to the harness log, and assert `[{ GITHUB_TOKEN: true, GH_TOKEN: true }]` before the `When`.

### WR-03: The NFR-5 network traps in pending and register do not cover git, and the phase documented the gap instead of closing it

**File:** `test/edge/handlers/plugin/pending.test.ts:51-62`, `:114-123`; `test/edge/register.test.ts:30-36`, `:254-266`
**Issue:** Both files guard NFR-5 with a fail-fast `https.request` mock. The phase rewrote their rationale to say that git "runs as a child process ... which the trap does not see, so the trap guards in-process HTTP only". But git is the only network path a cold git source could take. So pending's "asserted at zero in every case" guard over "a COLD git source" fixture cannot fail on a git dial-out. Two comments are now false or stale. `pending.test.ts:116` says "the git transport door replaced by a counting fail-fast throw", and `register.test.ts:30` says "`https.request`, the door the git transport opens". Line 254 of the same file now contradicts line 30. The sibling handler tests (`test/edge/handlers/marketplace/add.test.ts`, `update.test.ts`) already trap `NODE_GIT_PROCESS.run`.
**Fix:** In both files, also replace `NODE_GIT_PROCESS.run` with a counting fail-fast mock, as `trapGitProcess` does in the marketplace handler tests. Assert its count is zero in pending. Correct the two stale comments.

### WR-04: orchestrators/auth-host.ts dropped out of the AUTH-09 scan, but its header still says that scan enforces it

**File:** `test/architecture/gate-targets.ts:140-154`; `test/architecture/no-credential-leak.test.ts:107-115`; `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:24-25`
**Issue:** D-SG-27 asked for the `CREDENTIAL_LEAK_TARGETS` entries of the deleted modules to be removed. `orchestrators/auth-host.ts` was not deleted: it keeps `authBundleFor` and `NO_STORED_CREDENTIAL_CAUSE` (OQ3). It was removed anyway, together with `PROVIDER_FILES`, its only scan. The module header still reads "AUTH-09: no credential field is ever interpolated into an Error/notify here; enforced by test/architecture/no-credential-leak.test.ts", which is no longer true. `orchestrators/plugin/update-flow.ts` also places the same hint (line 319-320) and is in no scan. Meanwhile `CREDENTIAL_CAPTURING_ORCHESTRATORS` is documented as "the marketplace verbs that ... place the GAUTH-04 stored-credential hint".
**Fix:** Append `orchestrators/auth-host.ts` and `orchestrators/plugin/update-flow.ts` to the end of `CREDENTIAL_LEAK_TARGETS`, so no positional binding is re-aimed. Add both to `CREDENTIAL_CAPTURING_ORCHESTRATORS`, or to a sibling scan. Alternatively, delete the enforcement claim from the auth-host header.

### WR-05: The edited github-refresh expectation pins an HTTPS stored-credential hint inside the SSH attempt's chain after an HTTPS 404

**File:** `features/marketplace/github-refresh.feature:70-71`. Cause: `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:296-302`, `orchestrators/marketplace/update.ts:501-513`.
**Issue:** The phase changed the expected cause chain to `... SSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, no credential was obtained for github.com; store one with: printf 'protocol=https...' | git credential approve, git clone --depth failed: ssh-auth, exit code 128`. The HTTPS attempt failed `repository-not-found` (404), not `https-auth`/`no-credential`. `lacksStoredCredential`'s own doc says only "git's `https-auth` failure with the `no-credential` detail qualifies". It actually returns true for any error that classifies as `authentication required`, which here comes from the SSH `ssh-auth`. The hint is then spliced between the two ssh-auth links of the SSH attempt. The scenario now locks in a misleading message: git reported no HTTPS credential miss, and the HTTPS remedy is attached to the SSH text. D-SG-27 OQ1 accepted the hint for github.com, but not this placement.
**Fix:** Decide the intended rule before Phase 6 wording work. Either narrow `lacksStoredCredential` to a chain that holds an `https-auth`/`no-credential` `GitCommandError`, and restore the previous expectation (no hint), or place the hint after the HTTPS attempt. Then make the scenario and a unit case in `test/orchestrators/marketplace/update.test.ts` pin the chosen form for a `GitHubTransportsFailedError`.

### WR-06: SG-AUTH-03's "install and update" and SG-AUTH-01's token check are covered for only part of the verbs

**File:** `features/plugin/credentials.feature` (whole file); `features/marketplace/credentials.feature:8-110`
**Issue:** 05-CONTEXT lists "a helper entry shaped like a Device Flow token (`username=x-access-token`) keeps working for install and update over HTTPS". Plugin install and marketplace add and update are covered. No scenario updates a git-source plugin (`/claude:plugin update`) with a stored `x-access-token` credential. That path goes through `update-flow.ts`/`materialize-latest.ts` and different clone code. Likewise, the GITHUB_TOKEN/GH_TOKEN scenarios cover only `marketplace add`. A regression that sends a token only on the plugin clone path (`clone-cache.ts`, `github-plugin-transport`) would pass every scenario. Only the source-name scan in `test/architecture/no-token-variable-read.test.ts` would catch it, and it misses an indirect read such as `process.env[name]`.
**Fix:** Add `Updating a plugin from a private GitHub source uses the stored credential and asks for nothing` to `features/plugin/credentials.feature`. Add a plugin-install variant of the token scenario that asserts `no request the git host received carries` for both values and states the ssh launches.

## Info

### IN-01: Test titles and names still describe the removed sign-in or say "refused" for a missing credential

**File:** `test/orchestrators/plugin/install-flow-ledger.test.ts:14023,14025`; `test/orchestrators/plugin/update-flow.test.ts:10983-11003`; `test/orchestrators/marketplace/update.test.ts:2020,6219`
**Issue:** Two titles say "a clone the host refused", but both cases throw `{ kind: "https-auth", detail: "no-credential" }`, which is a helper miss, not a refusal (`rejected`). Their temp-directory prefixes are still `install-auth-cancelled-` and `update-git-usercanceled-`. The marketplace name `declined` in update.test.ts is left over from "a declined Device Flow".
**Fix:** Retitle to "a clone git found no credential for ...", rename the prefixes, and rename `declined` (for example to `private-mp`).

### IN-02: The print-mode step cites a retired decision

**File:** `features/step_definitions/command.steps.ts:156`
**Issue:** The comment anchors the print-mode `When` to D-BG-1101, which PROJECT.md marks retired by D-SG-27. The behavior the comment describes (notify does nothing in print mode, JDOC-02) still holds.
**Fix:** Cite JDOC-02/MODE-04 (or D-BG-09) instead of D-BG-1101.

### IN-03: github-transport's print-mode scenario claims "leaves the scope as it was" without checking the scope's files

**File:** `features/marketplace/github-transport.feature:157-172`
**Issue:** The title was rewritten to "... prints nothing and leaves the scope as it was", but the scenario only asserts no marketplace record and no checkout. Its sibling `features/marketplace/credentials.feature:59-79` uses `the files of the project scope are remembered` and `... are unchanged`. The two scenarios also largely overlap: same command, print mode, 401, and two ssh launches.
**Fix:** Add the remember and unchanged steps, or drop "leaves the scope as it was" from the title. Consider merging it with the credentials scenario.

### IN-04: The 404 credential-store scenario carries setup that the command never uses

**File:** `features/marketplace/credentials.feature:210-211`
**Issue:** `the marketplace "tools" is published as a github source` and `the git host requires the user ... for the marketplace "tools"` do nothing in a scenario whose command adds `acme/extras`. They make the reader look for a role they do not have.
**Fix:** Remove the two `tools` Givens.

### IN-05: The new feature descriptions are four lines, while the rule asks for two or three

**File:** `features/marketplace/credentials.feature:3-6`; `features/plugin/credentials.feature:3-6`
**Issue:** `.agents/skills/cucumber/rules/features.md` asks for "a description of two or three lines". Many existing files also break this rule.
**Fix:** Tighten each description to three lines.

### IN-06: The token-leak check does not see CONNECT proxy headers, and the url token scenario does not state the redirect log

**File:** `features/lib/github-redirect/connect-proxy.ts:117-126`; `features/marketplace/credentials.feature:8-32`
**Issue:** `no request the git host received carries` reads only the git host's log. A token sent as `Proxy-Authorization` on the CONNECT is never recorded. The url-source token scenario also has no `pi routes these github requests:` step, so a refused in-process request (for example to `api.github.com` with a token header) would go unnoticed. The token would not leave the machine, but it would show that the product reads the variable.
**Fix:** Have the proxy log a `headers` field on routed and refused lines, and check it in the step. Add `Then pi routes these github requests:` with no rows, or a `pi routes no github request` step, to the url scenario.

---

_Reviewed: 2026-11-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
