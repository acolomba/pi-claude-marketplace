---
phase: 05-credential-surface
fixed_at: 2026-11-28T00:00:00Z
review_path: .planning/phases/05-credential-surface/05-REVIEW.md
iteration: 1
findings_in_scope: 20
fixed: 18
skipped: 2
status: partial
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-28
**Source review:** .planning/phases/05-credential-surface/05-REVIEW.md
**Iteration:** 1
**Base:** c18df4e

**Summary:**

- Findings in scope: 20 (1 critical, 9 warnings, 10 info). A WR-01 and B WR-05
  are one root cause, and A WR-02 and B WR-04 are one finding, so each pair
  has one fix.
- Fixed: 18 (A IN-01 is a citation fix plus an open question, see below).
- Skipped: 2 (A IN-02, and the proxy-header half of B IN-06).

## Fixed Issues

### A WR-01 / B WR-05: The D-1-02 hint is attached to refused credentials and SSH failures

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`,
`test/orchestrators/marketplace/shared.test.ts`, `test/orchestrators/marketplace/update.test.ts`,
`test/orchestrators/plugin/update-flow.test.ts`, `features/marketplace/github-refresh.feature`
**Commit:** b66a41a
**Status:** fixed: requires human verification (classification logic)
**Applied fix:** `lacksStoredCredential` now asks the git failure itself: only a
`GitCommandError` with `https-auth` / `no-credential` qualifies, after
`withoutCleanupLeaks`. A `GitHubTransportsFailedError` qualifies when one of its
two attempts does. A `StoredCredentialRejectedError`, an `https-auth` /
`rejected` failure, and every SSH failure no longer get the hint. The hint
text and its placement are unchanged (Phase 6 owns the wording).

- Scenario: the github-refresh "fails over both transports" scenario goes back
  to its pre-phase expectation (no hint after an HTTPS 404 and an SSH
  `ssh-auth`). Run red first, before the fix (adapter profile): `1 scenario (1
  failed)`; the actual cause chain held `..., git clone --depth failed: ssh-auth,
  exit code 128, no credential was obtained for github.com; store one with:
  printf ... | git credential approve, git clone --depth failed: ssh-auth, exit
  code 128` where the scenario expects no hint. Green after the fix.
- Unit cases (`shared.test.ts`): a no-credential failure behind a cleanup leak;
  an `https-auth` / `rejected` failure; an SSH `publickey` refusal; and the two
  two-attempt orders the review asked for (SSH refusal then a refused HTTPS
  credential; HTTPS network failure then SSH refusal), plus HTTPS no-credential
  then SSH refusal, which still qualifies.
- Three unit fixtures modelled git's bare 401/403 status line as
  `https-auth` / `rejected`, but `platform/git-failure-kind.ts` reads that line
  as `no-credential`. Two now use `no-credential`; the third is retitled to pin
  that a credential the host refused gets no hint.

### A WR-02 / B WR-04: auth-host.ts claims a credential-leak gate that no longer scans it

**Files modified:** `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`
**Commit:** 260594d
**Applied fix:** `orchestrators/auth-host.ts` and `orchestrators/plugin/update-flow.ts`
are appended last to `CREDENTIAL_LEAK_TARGETS`, so no positional binding moves,
and join `CREDENTIAL_CAPTURING_ORCHESTRATORS` (the Error and notify literal
scan). A new case pins the `NO_STORED_CREDENTIAL_CAUSE` `String.raw` literal to
interpolating `host` and nothing else, which the `password=<token>`
placeholder would otherwise trip in the field-name scan. The auth-host header
claim is true again, so it is unchanged.

### A WR-03: The constraint gate threads the notification context only to decide whether to attach an auth bundle

**Files modified:** `orchestrators/plugin/marketplace-tag-probe.ts`, `orchestrators/plugin/install-cascade.ts`,
`orchestrators/plugin/update-constraint-gate.ts`, `orchestrators/plugin/update-preflight.ts`, and the
three paired tests
**Commit:** e1ac9ab
**Applied fix:** `tagListingOf` always passes `authBundleFor(canonicalCloneUrl(source), source.kind)`,
and `withHostBundle` and its call-site spreads are gone. A refused credential
in a background run's tag listing now maps to `StoredCredentialRejectedError`
as in a command; the probe folds every listing failure into the current-copy
fallback, so nothing user-visible changes and no scenario is owed.
`UpdateConstraintOptions.notification` became `listsSourceTags?: true`, which
`update-preflight.ts` sets when it has a notification context. Which runs list
tags does not change: a background run lists exactly the tags it listed before.
The rest of the chain (`PreparePluginUpdateOptions.notification`,
`materialize-latest.ts`, `update-swap.ts`, `dependency-move.ts`) still carries
the context only for this boolean; narrowing those is a wider refactor left for
later.

### A IN-01: The git-arm tag skip for a notification-less run cites a rule NFR-5 does not contain

**Files modified:** `orchestrators/plugin/update-constraint-gate.ts` (same commit as A WR-03)
**Commit:** e1ac9ab
**Applied fix:** the citation is corrected. The comment now cites D-03-03 (an
update may read a constrained dependency's source tags) and D-PL8-01 (the
background pass may use the network as the command does), says that the skip
dates from the sign-in that needed a context and that no recorded decision
keeps it since D-SG-27, names the caller that omits the context (the autoupdate
cascade through `materialize-latest.ts`), drops the false "every real caller
threads a ctx" sentence, and notes that the path arm still lists its
marketplace's tags in the same run (D-SG-09). Behavior is unchanged.

**Open question for the maintainer (not changed):** I found no recorded
decision that requires the git-arm skip. NFR-5 (as amended by D-03-03 and
D-PL8-01) allows a background update to list a constrained git dependency's
tags, and D-SG-09 lets the path arm list a git marketplace's remote tags in the
same notification-less run, which it does. So the two arms disagree: either the
git skip is an upstream divergence that needs a decision ID, or it should go
(parity), which would make the background pass list tags it does not list
today. Per the task rules I did not change which runs list tags.

### A IN-03: Comments still describe the removed sign-in and credential threading

**Files modified:** `install-flow-cascade-context.ts`, `clone-cache.ts`, `materialize-latest.ts`,
`dependency-move.ts`, `update-flow.ts` (all under `orchestrators/plugin/`)
**Commit:** fad0d6d
**Applied fix:** each of the five comments now says what the code does. The
`update-flow.ts:1031` line (also A IN-04) is rewrapped there.

### A IN-04: Comment lines over the 100-column print width

**Files modified:** `platform/git.ts`, `orchestrators/plugin/fetch.ts`, `orchestrators/plugin/update-flow.ts`
**Commit:** ce19328 (and fad0d6d for `update-flow.ts:1031`)
**Applied fix:** re-wrapped. No added comment line in the phase diff is now
over 100 columns, except an `eslint-disable-next-line` directive.

### B CR-01: "shows no notice" rests on a step that only sees success notices

**Files modified:** `features/lib/pi-tui.ts`, `features/step_definitions/marketplace/background-update.steps.ts`,
`features/support/world.ts`, `test/architecture/pi-tui-notices.test.ts`
**Commit:** 8263f65
**Applied fix:** `the tui session reports no notice` now also reads every
`Error: ...` and `Warning: ...` notice (Pi's form for an error or warning
notify, from Pi or an extension) that the message added. The When records the
output mark when it sends the message. Pi redraws the whole screen at times, so
the notices shown before the message are left out rather than counted, and the
step requires Pi's own `No API key found for the selected model.` refusal to be
the only one added. It still requires no background update notice.
`tuiNoticeTexts` and `PiTuiSession.textBefore` are new; two architecture
cases pin the oracle. All five scenarios that use the step pass.
**Discrimination check:** with the background pass's per-marketplace update
temporarily given the real UI context in place of its silent one, the private
GitHub no-credential scenario failed with `added: ['Error: No API key found
for the selected model.', 'Error: Some operations have failed.']`; the old step
passed the same break. The planted change was reverted with `git checkout`.

### B WR-01: SG-AUTH-03 is not pinned on the refused-credential path

**Files modified:** `features/marketplace/credentials.feature`, `features/step_definitions/git-host.steps.ts`,
`features/lib/user-git-programs.ts`
**Commit:** a4c0180
**Applied fix:** new scenario "Adding a marketplace whose host refuses the
credential helper's credential leaves the erase to git (SG-AUTH-03)": the
user's global git config names the recording credential helper, the host
refuses its credential with 401, and `the credential helper has recorded these
runs:` states exactly `get` then `erase`. The two "names a program" Givens share
one helper (fallow flagged the copy).
**Discrimination check:** with a `git credential reject` planted in the
refused-credential branch of `platform/git.ts`, the scenario failed on a second
`erase` row. The plant was reverted with `git checkout`.

### B WR-02: The token-variable scenarios have no check that GITHUB_TOKEN and GH_TOKEN reached Pi

**Files modified:** `features/lib/github-redirect/extension.ts`, `features/step_definitions/git-host.steps.ts`
**Commit:** 8938ff8
**Applied fix:** the redirect's `loaded` log line names the token variables
(`GITHUB_TOKEN`, `GH_TOKEN`, `GITLAB_TOKEN`) that Pi's environment holds, by
name only. Starting the routed Pi asserts that list equals the token variables
the scenario set.
**Discrimination check:** with the step's variables replaced by `{}`, both
token scenarios failed on `tokenVariables: []`; restored afterwards.

### B WR-03: The NFR-5 traps in pending and register do not cover git

**Files modified:** `test/edge/handlers/plugin/pending.test.ts`, `test/edge/register.test.ts`
**Commit:** 09e521d
**Applied fix:** both files also replace `NODE_GIT_PROCESS.run` with a
fail-fast reject, as the marketplace handler tests do. Pending's zero now
counts both doors. The stale comments that called `https.request` the git
transport's door are corrected.

### B WR-06: SG-AUTH-03's "install and update" and SG-AUTH-01's token check cover only part of the verbs

**Files modified:** `features/plugin/credentials.feature`
**Commit:** c7b8463
**Applied fix:** two scenarios. "Updating a plugin from a private GitHub source
uses the stored credential and asks for nothing" (freshness ls-remote and
re-clone, each 401 then 200 with the stored `x-access-token` credential, ssh
launches and redirect log stated, credential still stored). "With only
GITHUB_TOKEN and GH_TOKEN set, installing a plugin from a private GitHub source
fails as authentication required and no request carries either token", with
all three ssh launches stated. Both are regression guards for existing
behavior, so they pass on the base too.

### B IN-01: Test titles and names still describe the removed sign-in

**Commit:** beabf28
**Applied fix:** retitled the two cases to "a clone that git found no
credential for", renamed the `install-auth-cancelled-` and
`update-git-usercanceled-` prefixes to `*-no-credential-`, and renamed the
`declined` marketplace to `private-mp` in both update cases.

### B IN-02: The print-mode step cites a retired decision

**Commit:** 49c2903
**Applied fix:** the comment cites MODE-04 (with JDOC-02) in place of D-BG-1101.

### B IN-03: github-transport's print-mode scenario claims "leaves the scope as it was" unchecked

**Commit:** e0ba199
**Applied fix:** the remember and unchanged steps cannot run there, because
that scenario's project scope does not exist before the command, so the title
now says "prints nothing and records no marketplace". The credentials sibling
keeps the full scope comparison. Not merged with it.

### B IN-04, B IN-05, B IN-06 (redirect half): credentials feature tightening

**Commit:** b8db030
**Applied fix:** IN-04: the two unused `tools` Givens are gone from the 404
scenario. IN-05: both credentials feature descriptions are three lines. IN-06:
the url-source token scenario now states `pi routes no github request` (a new
step), so an in-process request that carried a token would show.

## Skipped Issues

### A IN-02: Unused stdin path left in the process launcher

**File:** `extensions/pi-claude-marketplace/platform/process-run.ts`
**Reason:** not cheap. Removing `ProcessRequest.input`, `writeInput`, and the
`"pipe"` stdin type changes the shared launcher type and the shared
`test/platform/process-fake.ts`, which several suites use, plus the input
cases of `process-run.test.ts` and `git-process.test.ts`. It changes no
behavior, so it is left for its own refactor.
**Original issue:** no extension caller sets `input` since `GitRequest.input`
went, so the stdin pipe is dead code in production.

### B IN-06 (proxy-header half): the token-leak check does not see CONNECT proxy headers

**File:** `features/lib/github-redirect/connect-proxy.ts`
**Reason:** not cheap: it changes the proxy's log format, its readers, and the
leak step. The redirect-log half of the finding is fixed (b8db030).
**Original issue:** a token sent as `Proxy-Authorization` on the CONNECT is
never recorded.

## Verification

All checks ran in this agent worktree
(`/home/user/pi-claude-marketplace/.claude/worktrees/agent-a4dea19cf7d7a4792`,
which has its own `node_modules` and the optional-peers cache copied in), not
in the main checkout.

- Every commit passed the pre-commit hook (`npm run check:commit`).
- `npm run check:static`: passed on the final tree.
- `features/marketplace features/plugin`, adapter profile: 1542 scenarios
  (1542 passed), 18510 steps (18510 passed).
- `features/marketplace features/plugin`, builtin profile: 42 scenarios (42
  passed), 544 steps (544 passed).
- Not run here: the full `npm run check` (integration suite, the other feature
  directories, and direct coverage of every pair). The hook ran direct
  coverage for each commit's staged pairs.
- No test reaches a real remote host or runs a real ssh: every new scenario
  uses the https git host, the ssh stand-in, and the routed profile Pi.

---

_Fixed: 2026-11-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
