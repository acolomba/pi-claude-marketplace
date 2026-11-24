---
phase: 03-system-git-transport-and-clone-shape
fixed_at: 2026-11-24T16:20:00Z
review_path: .planning/phases/03-system-git-transport-and-clone-shape/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-11-24T16:20:00Z
**Source review:** .planning/phases/03-system-git-transport-and-clone-shape/03-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (CR-01, WR-01, WR-02, WR-03, WR-04, IN-04, IN-05), plus audit item F-4
- Fixed: 7, and F-4
- Skipped: 0
- Deferred by scope: IN-01, IN-02, IN-03 (see below)

Every fix was committed on `features/system-git` in the main checkout, not in a worktree. Each commit went through the pre-commit hook, which passed `npm run check:commit` every time.

## Audit IDs closed

| Audit ID | Review ID | Commits |
| --- | --- | --- |
| T-03-55 | CR-01 | `52eaf33`, `30666ee` |
| F-3 | WR-01 | `3b327f8` |
| F-4 | (audit only) | `a1942d6` |
| F-6 | WR-03 | `952ae7f` |

## Fixed Issues

### CR-01: The D-SG-14 one-shot helper gives the signed-in token to any host

**Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`, `extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`, `test/platform/git.test.ts`, `test/platform/git-one-shot-credential.test.ts`
**Commits:** `52eaf33` (fix(git): bind the sign-in retry to the bundle's host), `30666ee` (fix(git): check the host in the one-shot credential helper)
**Applied fix:**

- `runWithAuthBundle` maps an auth failure only when the request is an https request to the bundle's host, checked on the URL after the D-SG-16 rewrite (`bundleOrigin`). Any other failure is thrown as git failed: no sign-in, no `StoredCredentialRejectedError`, no retry.
- The one-shot pairs are keyed to the bundle host's origin: `credential.<origin>.helper=` (an empty reset), then `credential.<origin>.helper=<helper>`. git matches URL-keyed credential config against the URL it really contacts, after a user's `insteadOf` rewrite or a redirect, so the token never reaches another host. The user's own helpers still answer for other hosts. An origin that holds `=` is refused.
- As a second guard (the auditor's request), the helper reads the `host=` line that git writes on stdin and prints the credential only when that line names the bundle's host.
- The comments in `add.ts` and `auth-host.ts` now state the guarantee as the code holds it.
- New unit cases: a github.com Device Flow bundle against another host that answers 401 (no sign-in, no helper pair, the first failure thrown); a stored-credential bundle for another host (failure unchanged); a `fetchCommit` rung in a clone whose origin is another host; non-https and unparseable URLs; a real-git case where a user's `insteadOf` sends a github.com request to the stand-in host, which wants the token: the retry runs, but the stand-in never gets the token, so the run fails. That case was checked to fail with an unscoped helper. Real-git cases in the one-shot test prove that `git credential fill` gets the file for the origin only, that another host keeps the user's own helper, and that the helper itself prints nothing for another host.
- No cucumber scenario: the fix is seen only on a cross-host path, and the unit cases prove that no token is offered (as the task allowed).

### WR-01: Request `-c` pairs could override the D-SG-05 hardening pairs (audit F-3)

**Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`
**Commit:** `3b327f8` (fix(git): place request -c pairs before the hardening pairs)
**Applied fix:** `gitArguments` now places the request pairs before the module's pairs, so git's last-wins rule keeps the hardening. No module pair touches `credential.helper` or `url.*`, and both are list keys, so the `insteadOf` rewrite and the one-shot reset still work (the real-git D-SG-14 cases in `git.test.ts` pass). The module header and the `GitRequest.config` JSDoc were corrected, and the argv test now pins the request pairs first, including a pair that repeats a hardening key.

### WR-02: An HTTP 403 with no credential sent was classified `rejected`

**Files modified:** `extensions/pi-claude-marketplace/platform/git-failure-kind.ts`, `extensions/pi-claude-marketplace/shared/errors.ts`, `features/lib/https-git-host/server.ts`, `features/marketplace/git-source.feature`, `test/platform/git-failure-kind.test.ts`
**Commit:** `b69ad37` (fix(git): read a bare 401 or 403 as no credential sent)
**Applied fix:** Only `fatal: Authentication failed for '` classifies as `rejected`. A bare `The requested URL returned error: 401|403` line is now `no-credential`, so the kind stays `https-auth` (reason `authentication required`, which matches upstream's 401/403 → `https-auth` mapping in 02-EVIDENCE), the GAUTH-04 store-a-credential line is added under a stored-credential bundle, and a Device Flow bundle signs in. 03-EVIDENCE and 03-RESEARCH record only that git prints the 403 line for every 403. Nothing there shows that a credential was sent, so `no-credential` is the kind that keeps the hint and the sign-in.
**Feature rows:** No existing row changed. The "host rejects the stored credential" rows run through a 401 and a refused credential (`Authentication failed for`) and still read `rejected the stored credential`. One new scenario outline (`@url`), "Updating a git marketplace whose host answers 403 before any credential is sent names the command that stores one", pins the new cause chain. It was checked to fail without the fix. The git host stand-in can now be armed with 403.
**Requires human verification:** this is a classification change. A 403 that a host returns after a helper's credential was sent (git shows no difference) now reads as `no-credential`, not `rejected`.

### WR-03: Staging clones that an interrupted run leaves were never removed (audit F-6)

**Files modified:** `extensions/pi-claude-marketplace/persistence/locations.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `test/orchestrators/marketplace/clone-swap.test.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `test/persistence/locations.test.ts`
**Commit:** `952ae7f` (fix(clone): remove the staging an interrupted refresh left)
**Applied fix:** As upstream does with `<name>..clone` (03-EVIDENCE Q9 step 3), each refresh target has one staging directory of fixed name. It comes from two new `ScopedLocations` getters, each with `assertSafeName` and `assertPathInside` (NFR-10): `sourceSwapStagingDir(mp)` → `sources-staging/marketplace-<mp>`, and `pluginMirrorStagingDir(key)` → `sources-staging/mirror-<key>`. `CloneSwapArgs` takes `stagingDir` in place of `locations`. `recoverInterruptedSwap` restores the backup, then removes a leftover staging directory. A cold mirror clone removes a leftover `mirror-<key>` before it clones. Every caller holds the scope lock (marketplace update, the PUP-2 sync, and every mirror materialize, as `fetch` and `info --fetch` lock the unpinned arm), so what the run finds there belongs to a dead run. The test that pinned the leftover as kept is inverted: a refresh removes its own leftover and leaves a UUID staging entry of another run alone. A current checkout also loses the leftover. A cold mirror case was added.
**Not covered:** `sources-staging/<uuid>` entries of `marketplace add`, pinned plugin clones, per-commit copies, the tag copy, and the post-add mirror seeding. Pinned clones (`fetch`, `info --fetch`) and the seeding run without the scope lock, so a sweep could remove a live run's staging. Upstream's step-3 cleanup covers only its refresh staging, which this fix now matches.

### WR-04: The PUP-2 sync read the carry-over list outside the lock

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `test/orchestrators/plugin/update-flow.test.ts`
**Commit:** `85f5df1` (fix(update): read the swap's carry-over list under the lock)
**Applied fix:** `syncMarketplaceBySwap` reads the state itself, inside the scope lock that `refreshFramed` holds, after the origin read, and builds `carryOver` from that read, as `marketplace update` does. The unlocked read in `makeSyncCloneOnce` now only picks the source and the bundle. The new case records a plugin during the locked origin read and proves that its `node_modules` is carried. It was checked to fail on the old code.

### IN-04: The retry's debug line said "signed in" on a memo hit

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`, `extensions/pi-claude-marketplace/platform/git.ts`, `test/orchestrators/auth-host.test.ts`, `test/platform/git.test.ts`
**Commit:** `c59fa42` (fix(auth): log a reused sign-in apart from a new one)
**Applied fix:** The sign-in closure logs `reusing the sign-in for <host>` when the auth memo answers. The retry line now says `git <op>: has a sign-in for <host>, running it once more`.

### IN-05: `isUnreachable` treated non-git errors as an unreachable remote

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts`, `test/orchestrators/marketplace/clone-swap.test.ts`
**Commit:** `bbe3e72` (fix(clone): treat only remote failures as an unreachable remote)
**Applied fix:** Only a `GitCommandError` outside `NOT_REMOTE_FAILURES`, or a `StoredCredentialRejectedError`, counts as unreachable. Every other error is thrown: a `DeviceFlowUnavailableError`, a one-shot credential write failure, a lock error, and an `InvalidGitHubBaseUrlError` (which needs no special case now). New cases cover a refused stored credential (kept) and a `DeviceFlowUnavailableError` (thrown).

### F-4 (audit): The tag copy fell back to `fetch --unshallow`

**Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `test/platform/git-ops-fake.ts`, `test/platform/git.test.ts`, `test/orchestrators/plugin/clone-cache.test.ts`
**Commit:** `a1942d6` (fix(clone): fetch only the tag's commit into the tag copy)
**Applied fix:** `fetchCommit` takes `unshallow: false`, which skips the `--unshallow` rung and throws the depth-1 fetch's failure. `materializeMarketplaceTagClone` passes it, so the tag copy fetches one commit with `git fetch --depth 1`, as D-SG-09 and NFR-5 say. A real-git case proves that a shallow clone stays shallow and runs no second rung.

## Deferred Issues

### IN-01: A user's own `insteadOf` for `https://github.com/` wins over the D-SG-16 base pair

**File:** `extensions/pi-claude-marketplace/shared/github-base-url.ts:114-121`
**Reason:** Out of scope by instruction. The fix is either documentation or a change to D-SG-16's pair shape (one longer prefix per owner path), which is a decision about which configuration wins. The CR-01 fix already keeps the token safe under such a rewrite.

### IN-02: After an unreachable freshness check, the clone's own failure is replaced by the check's

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:300-307`
**Reason:** Out of scope by instruction. Choosing which failure leads the cause chain changes the GAUTH-04 framing that the feature rows pin. It needs a decision, not a local fix.

### IN-03: A `plugin-clones-backup/<key>` left by an interrupted mirror swap is never removed once the key stops being live

**File:** `extensions/pi-claude-marketplace/persistence/locations.ts:414-421`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:616-630`
**Reason:** Out of scope by instruction. The fix is a new sweep in `collectPluginClonesLocked`, or a recorded leftover beside D-SG-10. Either one is a decision about the clone collector's contract.

## Verification

Every suite ran in the main checkout on `features/system-git` at `c59fa42`, with system git 2.43.0, under `setpriv --bounding-set=-dac_override,-dac_read_search`:

- `npm run test:modules`: 19092 tests, 19091 passed, 1 failed. The failure is the known sandbox baseline `test/bridges/hooks/dispatch-exec.test.ts:39`.
- `npm run test:integration`: 426 tests, 425 passed, 1 failed (`test/integration/subagent-hook-ownership.test.ts:234`, `ESRCH` reading `/proc/<pid>/environ` in teardown). It passed when run again alone (2 of 2), so it is a process-timing flake and not caused by these fixes.
- `npm run test:cucumber:profile -- --profile adapter features/marketplace`: 547 scenarios, 547 passed.
- `npm run test:cucumber:profile -- --profile adapter features/plugin`: 784 scenarios, 783 passed, 1 failed in a `Before` hook (`ENOTEMPTY` on `rmdir` of the scenario's `.pi/pi-claude-marketplace`). `features/plugin/usage-errors.feature` passed in full when run again (117 of 117).
- `npm run test:cucumber:profile -- --profile builtin features/plugin`: 39 scenarios, 39 passed.

Direct coverage stayed at 100% for every touched source: the commit hook checked each staged pair, and the F-4 commit, which stages `test/platform/git-ops-fake.ts`, ran every pair. `npm run check` was not run as a whole.

---

_Fixed: 2026-11-24T16:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
