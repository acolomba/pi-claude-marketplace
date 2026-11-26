---
phase: 04-ssh-sources-and-transport-selection
fixed_at: 2026-11-26T00:00:00Z
review_path: .planning/phases/04-ssh-sources-and-transport-selection/04-REVIEW.md
iteration: 1
slice: A
findings_in_scope: 14
fixed: 9
skipped: 3
needs_user_decision: 2
status: partial
---

# Phase 4: Code Review Fix Report, slice A

**Fixed at:** 2026-11-26
**Source review:** `.planning/phases/04-ssh-sources-and-transport-selection/04-REVIEW.md`
**Iteration:** 1
**Scope:** CR-A-01, CR-A-02, WR-A-01..WR-A-04, IN-A-01..IN-A-07, and IN-B-04 (the plugin
both-failed label in `shared/errors.ts`). CR-A-01 also closes CR-B-01 and the security
audit's F-04-1.

**Summary:**

- Findings in scope: 14
- Fixed: 9 (CR-A-01, CR-A-02, WR-A-02, WR-A-03, WR-A-04, IN-A-03, IN-A-04, IN-A-06, IN-B-04)
- Skipped: 3 (IN-A-01, IN-A-02, IN-A-07)
- Needs a user decision: 2 (WR-A-01, IN-A-05)

Verification ran in the isolated agent worktree, not in the main checkout. Each commit
passed the commit hook (`npm run check:commit`). See "Suites" below for the full runs.

## Per-finding table

| Finding | Result | Commit | Tests |
| --- | --- | --- | --- |
| CR-A-01 | fixed | `34ac832` | `test/orchestrators/github-transport.test.ts` (T-04-06 note redaction), `test/shared/notification-resolve.test.ts` (block and row clone notes), `test/shared/notification-present.test.ts` (plugin-info clone note, identity kept), `test/architecture/no-credential-leak.test.ts` (3 planted-credential sites); scenario `features/marketplace/url-source.feature` "Adding a github url marketplace whose url holds a token shows the url redacted in its clone line" |
| CR-A-02 | fixed | `56ea0c3` | `test/orchestrators/marketplace/add.test.ts` (GHB-04 url add), `test/orchestrators/github-transport.test.ts` (GHB-04 url and git-subdir plans, D-SG-20 shorthand force); scenarios `features/marketplace/url-source.feature` "Adding a url marketplace outside github ignores an invalid github base address", `features/plugin/git-source.feature` "Installing a plugin from a url source outside github ignores an invalid github base address" |
| WR-A-01 | needs user decision | | |
| WR-A-02 | fixed | `bdb0dc0` | `test/shared/github-base-url.test.ts` (ssh+git wire URL and pair rows; a non-GitHub ssh+git address stays unchanged); scenario `features/plugin/ssh-source.feature` "Installing a plugin from an ssh+git address of github.com reaches the GitHub base over https" |
| WR-A-03 | fixed | `877fb8f` | `test/orchestrators/github-transport.test.ts` (aborted, git-missing, and Device Flow refused retries reach the caller unchanged); scenario `features/marketplace/github-transport.feature` "Adding a private github marketplace in pi's print mode whose ssh clone fails shows the sign-in remedy, not both attempts (MODE-04)" |
| WR-A-04 | fixed | `a7bff9f` | `test/orchestrators/marketplace/clone-swap.test.ts` (both-failed re-clone error thrown, GAUTH-04 refusal from any freshness attempt kept, fallback debug line); scenario `features/marketplace/github-refresh.feature` "A github marketplace refresh that fails over both transports reports both attempts" |
| IN-A-01 | skipped | | |
| IN-A-02 | skipped | | |
| IN-A-03 | fixed | `7b47359` | `test/orchestrators/github-transport.test.ts` (a failed clear keeps the first failure with the clearing failure added) |
| IN-A-04 | fixed | `31131db` | `test/orchestrators/marketplace/add.test.ts` (`file:/x`, `ssh:/h/x`, `owner/repo#ref:with-colon` refused; a `./path` holding `:` accepted); scenario row `acme/tools#feature:one` in `features/marketplace/unsupported-source.feature` |
| IN-A-05 | needs user decision | | |
| IN-A-06 | fixed | `470aa97` | refactor; existing owner tests of the five modules |
| IN-A-07 | skipped | | |
| IN-B-04 | fixed | `877fb8f` | `test/shared/errors.test.ts` ("names the transport of the last attempt in a plugin retry over HTTPS") |

Each new scenario and unit row was run against the pre-fix code and failed there.

## Fixed Issues

### CR-A-01: The D-SG-22 clone note shows URL credentials in clear text

**Files modified:** `orchestrators/github-transport.ts`, `shared/notification-resolve.ts`,
`shared/notification-present.ts`, tests and feature above.
**Commit:** `34ac832`
**Applied fix:** `recordNote` stores the first URL and each retry URL through
`redactCredentials`. As a second layer, `resolveRows` redacts the clone note of every
block and row (`redactCloneNote`, exported), and `redactPluginInfo` redacts the plugin-info
clone note and keeps the message by identity when nothing changed. Text and JSON both read
the redacted form.

### CR-A-02: An invalid GitHub base override fails non-GitHub adds and clones

**Files modified:** `orchestrators/marketplace/add.ts`, `orchestrators/github-transport.ts`.
**Commit:** `56ea0c3`
**Applied fix:** the add reads `transportForce` only for a `github` source, as the refresh
already did. `pluginCloneTransport` reads `context.force` only for a `github` source or a
git-subdir `owner/repo` shorthand (`forceApplies`).

### WR-A-02: An `ssh+git://` GitHub address bypasses the base override

**Files modified:** `shared/github-base-url.ts`.
**Commit:** `bdb0dc0`
**Applied fix:** `gitHubRewritePrefix` falls back to `sshGitAliasPrefix`, which reads git's
`ssh+git:` alias as `ssh:` for the rewrite only, so the address gets its own `insteadOf` pair
and reaches the base. `gitHubAddressOf` (the D-SG-23 identity fold) is unchanged and still
leaves `ssh+git:` out, at parity with upstream `Ort`.

### WR-A-03: A retry that stops the clone is reported as failed over both transports

**Files modified:** `orchestrators/github-transport.ts`.
**Commit:** `877fb8f`
**Applied fix:** `runAfter` rethrows a retry failure unchanged when `stopsTheClone` says it
stops the clone (abort, git missing, Device Flow refused in print mode), as it already did
for a first attempt. The plugin label part is IN-B-04 below.

### WR-A-04: A refresh that fails over both transports never shows the both-failed error

**Files modified:** `orchestrators/marketplace/clone-swap.ts`.
**Commit:** `a7bff9f`
**Applied fix:** `listRemoteHead` writes upstream's `Marketplace refresh failed with <T1> for
<subject> (<msg>), falling back to <T2>` debug line for each fallback and keeps a refused
stored credential from any attempt. A new `refreshFailure` picks what a failed re-clone
throws: the GAUTH-04 refusal first, then the re-clone's own `GitHubTransportsFailedError`
when it failed over both transports, and otherwise the check's failure as before.

This is narrower than the review's suggestion (throw the clone's error for every case but
GAUTH-04). The broader rule would change the cause of every failed single-attempt refresh,
url sources included, from `git ls-remote failed: ...` to `git clone --depth failed: ...`,
which about 15 scenarios pin (`features/marketplace/git-source.feature`,
`url-source-update.feature`, `features/plugin/git-source-update.feature`, and others).
03-EVIDENCE Q16 says upstream reports the clone's failure there too, so that remaining
single-attempt difference is a separate parity question for the maintainer; it is outside
this finding, which is about the both-failed case.

### IN-A-03: A failed `beforeRetry` replaces the clone failure

**Files modified:** `orchestrators/github-transport.ts`, `orchestrators/marketplace/add.ts`
(doc comment only).
**Commit:** `7b47359`
**Applied fix:** `clearBeforeRetry` catches a failed clear and throws the first attempt's
failure through `appendLeakToError`, with `could not clear the failed <T1> clone for the <T2>
retry: <msg>` added. No cucumber scenario: a failed removal of the staging directory is
fault injection, which the unit test covers.

### IN-A-04: Single-slash scheme forms get a different message from upstream

**Files modified:** `orchestrators/marketplace/add.ts`.
**Commit:** `31131db`
**Applied fix:** `isCommandLineRefusal` also refuses any input that holds `:` and `/` and is
not `http(s)://`, the scp form, or a path (`./`, `../`, `/`, `~`), as `$Ce` returns `null`
for it. The refusal message is not shown on the row (only the `unsupported source` reason),
so the user-visible change is that `owner/repo#ref:with-colon` no longer reaches the network;
the scenario row pins that.

### IN-A-06: Duplicated helpers across the transport modules

**Files modified:** `domain/github-transport.ts`, `domain/github-plugin-transport.ts`,
`orchestrators/marketplace/clone-swap.ts`, `orchestrators/github-transport.ts`,
`shared/errors.ts`.
**Commit:** `470aa97`
**Applied fix:** `domain/github-transport.ts` exports `noRetry`, `isOwnerRepoSpelling`, and
`shorthandSource`; the plugin plan and the refresh's legacy one-attempt plan use them, and
`tagReadUrl` uses `shorthandSource`. `shared/errors.ts` exports one
`GITHUB_TRANSPORT_LABELS` table, which the clone runner and the both-failed message share.
`shared/notification-grammar.ts` keeps its own `cloneTransport` reader (slice B file, left
alone).

### IN-B-04: The plugin both-failed message always says the retry was over SSH

**Files modified:** `shared/errors.ts`.
**Commit:** `877fb8f`
**Applied fix:** the plugin message reads `The retry over ${GITHUB_TRANSPORT_LABELS[last.transport]}
failed too`. Upstream's HTTPS-then-SSH pair keeps its exact words. With WR-A-03, the Windows
`[SSH, HTTPS]` pair no longer reaches this message through a stopping failure, but the label
now follows the attempt either way.

## Skipped Issues

### IN-A-01: The `owner/repo` shorthand is not checked against upstream's repository pattern

**File:** `domain/github-plugin-transport.ts:309-318`, `domain/github-transport.ts:97-100`
**Reason:** upstream `zHi` refuses at clone time with `Invalid GitHub repository format: <x>.
Expected format: owner/repo`. Matching it needs a new typed failure and its reason mapping in
the plugin install, update, and reinstall messaging (slice B files and the notification
vocabulary), and a choice between clone-time refusal (upstream) and parse-time refusal (which
changes the recorded-source contract, D-SG-17 calls that costly). argv stays safe (the host is
github.com and operands sit behind `--end-of-options`). The command-line marketplace form
`evil:x/y` is now refused by the IN-A-04 fix.
**Original issue:** `parseOwnerRepo` accepts `evil:x/y`, and the SSH arm builds
`git@github.com:evil:x/y.git`.

### IN-A-02: The transport label calls `http://` "HTTPS" and treats `file:` as HTTPS

**File:** `domain/github-transport.ts:85-86,147-168`
**Reason:** a correct label for plain HTTP needs a new clone note kind (`notification-types.ts`,
the grammar, and the JSON wire schema, slice B files and a wire contract; the deferred
D-SG-22 vocabulary). Dropping the note for `http:` instead would break D-SG-22's "every
GitHub clone names its transport". `gitHubAddressOf` never folds a `file:` URL, so a `file:`
source gets no note, and the auth bundle it carries is inert for the file transport (Device
Flow runs only after an `https-auth` failure).
**Original issue:** `http://github.com/o/r` is noted "Cloning via HTTPS"; a `file://` add
passes the host auth bundle.

### IN-A-07: Impossible-state guard: the `MAX_ATTEMPTS` cap is never reached

**File:** `orchestrators/github-transport.ts:159-161,187-190`
**Reason:** kept as documented defense, the first option the finding offers. The cap is
documented at its declaration and pinned by the SG-SSH-05 unit case "stops after three
attempts and names the last two when they all fail", which drives a plan that would give a
fourth attempt.
**Original issue:** no plan in the tree can ask for a fourth attempt.

## Needs user decision

### WR-A-01: Under the base override, an SSH-spelled GitHub address is labelled SSH and loses its auth bundle

**Question:** while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set, should a url source spelled
`git@github.com:o/r.git` (or `ssh://`, `git+ssh://`, `ssh.github.com`) be noted
"Cloning via HTTPS" and carry the base host's auth bundle, because git sends it to the base
over HTTPS? Or keep the note of its written scheme, as today?
**Evidence:** no upstream analogue (the base override is Pi's own, D-MF-01, D-SG-16, D-SG-21).
The D-SG-21 record in PROJECT.md says: "An scp- or https-spelled GitHub url source clones as
written and keeps the note of its own scheme in `github.com` terms (GHB-04, 04-08)". Two
scenarios pin today's form: `features/plugin/ssh-source.feature` "Installing a plugin from a
git@github.com address reaches the GitHub base over https" and
`features/marketplace/ssh-source.feature` "Adding a github marketplace by its scp address clones
it as written and names ssh" (both note `via-ssh` while the git host receives the HTTPS
requests). The auth half also decides whether a stored credential for the mirror is offered,
and Device Flow mapped, for these spellings (`auth-host.ts:118-121` binds the bundle to the
base host for this case). Changing it contradicts the recorded decision, so it was not done.

### IN-A-05: Skip checks are cached per command, but upstream re-runs them for each member

**Question:** record "each plugin skip check answers once per command" as a decided
divergence with an ID, or cache only the probe, as upstream does (`n??=Jxn()`), and re-run
`--get-url`, `ssh -G`, and `git config` for each `github` member?
**Evidence:** 04-EVIDENCE Q7: "The probe result is memoized within one CLI install
(`n??=Jxn()`), so a cascade probes once; the skip checks (`--get-url`, `ssh -G`, `git config`)
run again for each `github` member." No decision ID records Pi's broader cache. Users do not
see the difference except in the number of local `ssh -G` launches, which scenarios count
(`Then the user's ssh receives these launches`), and slice B's WR-B-01 fix builds on the
once-per-command contract, so the change was not made in parallel with it.

## Suites

All run in the isolated worktree at `31131db`, after `node scripts/install-test-peers.mjs`:

- `npm run test:modules`: pass (exit 0).
- `npm run test:integration`: pass (exit 0).
- Cucumber, adapter profile (`features`): 2395 scenarios, 2390 passed, 5 failed. The 5 are
  the known fd-dependent scenarios in `features/hook/tool-use.feature` (:296, :355, :443,
  :1696, :1834).
- Cucumber, builtin profile (`features`): 260 scenarios, 260 passed.

`npm run check` was not run here; the orchestrator runs it after the merge.

## Files touched outside slice A

- `extensions/pi-claude-marketplace/shared/notification-present.ts` (CR-A-01,
  `redactPluginInfo`, as the task asked).
- `test/shared/notification-present.test.ts` (its pair).
- `test/architecture/no-credential-leak.test.ts` (CR-A-01, as the task asked).
- `features/plugin/git-source.feature` (CR-A-02 plugin scenario) and
  `features/plugin/ssh-source.feature` (WR-A-02 scenario): plugin features that exercise
  slice A code.

---

_Fixed: 2026-11-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
