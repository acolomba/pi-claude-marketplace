---
phase: 03-system-git-transport-and-clone-shape
reviewed: 2026-11-24T14:50:29Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/auth-registry.ts
  - extensions/pi-claude-marketplace/domain/github-auth.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts (deleted)
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - extensions/pi-claude-marketplace/platform/git-failure-kind.ts
  - extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts
  - extensions/pi-claude-marketplace/platform/git-process.ts
  - extensions/pi-claude-marketplace/platform/git-timeout.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/github-base-url.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
  necessity: 0
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-11-24T14:50:29Z
**Depth:** standard
**Files Reviewed:** 29 (one of them, `platform/git-auth-callbacks.ts`, deleted)
**Status:** issues_found

## Summary

The review covered the 29 production files that `git diff --name-only e8fbff2..HEAD -- extensions` lists on `features/system-git` (HEAD `db85603`). Their tests were read for test quality only. The focus was the re-clone swap and its recovery, the freshness check and `ls-remote` parsing, the pin ladder, the D-SG-14 Device Flow retry and its one-shot credential, error classification, git argument construction, cleanup on failure paths, and NFR-1/NFR-3.

The swap itself is sound. Every rename stays under one extension root. A failed clone leaves the live checkout alone. A failed move-in renames the backup back. The next run recovers an interrupted swap in the same order as upstream's step 3. The `ls-remote` name selection (branch, then peeled tag, then tag, then exact name) and the `--tags` peel-wins fold are correct for git's tail-match pattern semantics. The pin ladder lower-cases the pin, checks out with `--` so that an absent full SHA reads as `reference is not a tree` (`commit-missing`), and checks `HEAD` afterwards. Operands always follow `--end-of-options`, or come before `--` for `checkout`. `--branch=<ref>` is one argv word, and the parser refuses a leading `-` in refs.

One defect is a security blocker. The D-SG-14 one-shot credential helper answers every host that git asks for during the retried run. The host binding (D-1-03, T-79-04) that the old auth callbacks enforced is gone. The swap and the tag copy also send requests to a checkout's recorded `origin`, which can name a different host than the one the bundle is bound to. Four warnings cover:
- a hardening comment in `git-process.ts` that says the opposite of how git applies `-c` precedence;
- an HTTP 403 that git reaches without sending any credential, classified as a refused stored credential;
- staging clones left by an interrupted run, which nothing ever removes;
- the PUP-2 sync computing the swap's package carry-over from a state read taken outside the lock.

Recorded and justified deviations were not re-reported: the lower-case SHA ref that reaches `--branch` (D-SG-10, Phase 7), the `marketplace remove` backup leftover (D-SG-10), the debug-log-only PUP-2 kept notice (D-SG-15), the refused-token no-second-sign-in note (D-SG-14), the 120 s timeout (D-SG-13), and the `for-each-ref` directory-marketplace listing (D-SG-09).

## Critical Issues

### CR-01: The D-SG-14 one-shot helper gives the signed-in token to any host, and the swap can request a host the bundle is not bound to

**File:** `extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts:85-88`, `extensions/pi-claude-marketplace/platform/git.ts:309-364`, `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:79-86`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:549-559`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:300-302`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:1084-1092`

**Issue:** The retry helper is `!f() { test "$1" = get && cat '<file>'; }; f`. It reads neither the `protocol=` nor the `host=` line that git writes to its stdin, and the `credential.helper=` pair before it is global, not URL-scoped. So during the retried run, git gets the token for every credential request it makes, whatever the host. `runWithAuthBundle`/`retryAfterSignIn` never compare the request's host with `auth.host`. The deleted `buildAuthCallbacks.onAuth` did exactly that comparison (D-1-03, T-79-04). The new comments in `add.ts` ("a credential stored for one host is never sent to another") and `auth-host.ts` claim the guarantee still holds, but that is true only for the user's own host-keyed helpers.

This is reachable in production. `refreshGitSource` (`update.ts:549-559`) and `syncMarketplaceBySwap` (`update-flow.ts:300-302`) build the bundle from the record's source (`buildGitHubAuth` means `github.com`). They then send the freshness `ls-remote` and the re-clone to `swapCloneUrl(...)`, which is the live checkout's recorded `origin`. The unit test `D-SG-10: a marketplace refresh clones from the checkout's recorded origin` (`test/orchestrators/marketplace/clone-swap.test.ts:1071-1096`) pins exactly this mix: a github source `github.com/acme/market` refreshed from `https://git.example/acme/tools.git`. If that host answers 401, the run fails as `https-auth`/`no-credential` under a `device-flow` bundle for `github.com`. `retryAfterSignIn` then calls `onAuthRequired()`. When the command's `authMemo` already holds a successful `github.com` sign-in (the run-scoped memo that `plugin update` shares across marketplace syncs and plugin clones), the memo answers with no prompt at all, and the GitHub token goes to `git.example`. The tag copy (`clone-cache.ts:1084-1092`) has the same split: the bundle comes from the record source, while `fetchCommit` reads the copied `.git`'s `origin` for its URL (`git.ts:448`).

**Fix:** Bind the retry to the bundle's host in both places:
1. In `runWithAuthBundle`, retry only when the host git actually contacts (the `gitHubWireUrl(remote.url)` host, so the D-SG-16 rewrite is honoured) equals `auth.host`. Otherwise throw the failure unchanged.
2. Scope the helper pairs to that host, so git never asks the helper for another host:

```ts
// platform/git-one-shot-credential.ts
export async function withOneShotCredential<T>(
  credential: { readonly username?: string; readonly password?: string },
  origin: string, // e.g. "https://github.com", the bundle host's URL
  run: (config: readonly string[]) => Promise<T>,
  parent: () => string = extensionRoot,
): Promise<T> {
  // ...
  return await run([
    `credential.${origin}.helper=`,
    `credential.${origin}.helper=!f() { test "$1" = get && cat ${shellQuoted(file)}; }; f`,
  ]);
}
```

Also consider making `swapCloneUrl` refuse, or rebuild the bundle for, an `origin` whose host differs from the source's host. Add a unit case where the request host and `auth.host` differ, proving that no retry runs and no helper pair is sent.

## Warnings

### WR-01: `git-process.ts` claims request `-c` pairs cannot undo the hardening, but git's last-wins precedence means they can

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:32-33`, `extensions/pi-claude-marketplace/platform/git-process.ts:146-149`, `extensions/pi-claude-marketplace/platform/git-process.ts:765-771`

**Issue:** `gitArguments` puts `request.config` after `rules.config`, `PIN_PAIRS`, and the lane pairs. The module header and the `GitRequest.config` JSDoc both say that this order means "a later pair can never undo the hardening placed before it". git does the reverse: for a single-valued key, the last `-c` wins, and for a multi-valued list key such as `credential.helper`, an empty later value resets it. The D-SG-14 helper depends on that reset. Placing request pairs last is exactly what would let a request pass `core.hooksPath=...`, `protocol.ext.allow=always`, `core.fsmonitor=...`, or `safe.bareRepository=all` and override D-SG-05/SG-PRC-03. `config` is an unvalidated `readonly string[]`. Today only `insteadOf` and `credential.helper` pass through it, so nothing is broken yet, but the security comment on this boundary is false, and a future caller would be misled by it.

**Fix:** Put the request pairs before the module's pairs, so the hardening always wins. Both current uses still work there: `url.*.insteadOf` is multi-valued, and the `credential.helper=` reset still comes after every config file. Alternatively, keep the order but validate each request pair against an allow-list of key patterns. Either way, correct both comments:

```ts
const pairs = [
  ...(request.config ?? []),
  ...rules.config,
  ...PIN_PAIRS,
  ...LANES[request.lane].pairs,
];
```

### WR-02: An HTTP 403 that git reaches without sending any credential is classified `rejected`, which throws `StoredCredentialRejectedError` and skips the Device Flow and the store-a-credential hint

**File:** `extensions/pi-claude-marketplace/platform/git-failure-kind.ts:91-98`, `extensions/pi-claude-marketplace/platform/git.ts:325-331`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:248-255`

**Issue:** The `rejected` row matches `^(?:fatal|error): .*The requested URL returned error: 40[13]\b`. git prints `fatal: unable to access '<url>': The requested URL returned error: 403` for every 403, whether or not a helper supplied a credential (a 403 is not a reauth status in `http.c`). Examples of an anonymous 403: a blocked or disabled repository, a corporate proxy refusal that does not print the git-proxy text, a host that forbids anonymous access with 403. Under a `stored-credential` bundle, `runWithAuthBundle` turns such a 403 into `StoredCredentialRejectedError("<host> rejected the stored credential")`, which is a credential the user never had. Because `lacksStoredCredential` excludes that class, the GAUTH-04 `NO_STORED_CREDENTIAL_CAUSE` line ("store a credential for <host>") is also suppressed, though it is the one hint that applies. Under a `device-flow` bundle, the same 403 is "a refused token" and runs no sign-in. Only `fatal: Authentication failed for '` proves that the host refused a credential that was sent.

**Fix:** Keep `rejected` for the `Authentication failed for` line only. Map the bare 401/403 status line to its own detail (for example `http-status`), which `runWithAuthBundle` rethrows unchanged. It then keeps `authentication required` through the classifier and still gains the stored-credential hint:

```ts
[/^fatal: Authentication failed for '/m, { kind: "https-auth", detail: "rejected" }],
[/^(?:fatal|error): .*The requested URL returned error: 40[13]\b/m, { kind: "https-auth", detail: "status" }],
[/^fatal: could not read (?:Username|Password) for '|^fatal: .*terminal prompts disabled/m, { kind: "https-auth", detail: "no-credential" }],
```

### WR-03: Staging clones that an interrupted run leaves are never removed (NFR-3), unlike upstream, which deletes its leftover staging

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:252-276`, `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:286-287`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:252`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:527`

**Issue:** Every swap, mirror clone, and pinned clone stages into `sources-staging/<randomUUID()>`. `recoverInterruptedSwap` says "A staging directory of an earlier run is not this run's and is left to the removal of its own run". The test `D-SG-10: a staging directory an earlier run left is not this run's and stays` pins that rule. A run that crashed, or was killed by Pi exiting, never comes back to remove its own staging, and no sweep of `sources-staging/` exists anywhere in the extension. Each interrupted refresh therefore leaks one full depth-1 checkout per marketplace or mirror, without bound. The window is widest during the clone itself, which can run for up to `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`. `03-EVIDENCE.md` Q9 step 3 records that upstream deletes its `<name>..clone` staging on the next run, so this is an unrecorded divergence. It is not among the D-SG-10 leftovers (only the `sources-backup/<name>` on `marketplace remove` is recorded).

**Fix:** The swap, add, and install paths all run under the scope's state lock, so any entry in `sources-staging/` at lock time belongs to a dead run. Sweep it once per locked refresh, or at the start of `refreshCloneBySwap`, with a debug-logged leak on failure, and invert the unit test. If some unlocked writer exists (for example, the post-commit seeding in `seedSameRepoPluginMirrors`), give swap staging a deterministic per-target name (`sources-staging/swap-<name>` or `swap-<key>`) and remove that name in `recoverInterruptedSwap`, as upstream does with `<name>..clone`.

### WR-04: The PUP-2 sync reads state outside the lock, so the swap's package carry-over uses a stale plugin list

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:359-377`

**Issue:** `makeSyncCloneOnce` calls `loadState` before `refreshFramed` takes the scope lock (`withExistingScopeLock`). It then passes `installedRootsInside(liveDir, state.marketplaces)` from that unlocked read as `carryOver`. Another Pi process can install a path-source plugin into the marketplace between the read and the lock. That plugin's `node_modules` is then not carried. `swapIn` deletes the backup holding it, and the plugin is left without its packages until it is reinstalled or updated (D-PL9-10 runs the package install only on a materialization). `marketplace update` does this correctly: it computes `carryOver` from `tx.state` inside `withLockedStateTransaction` (`update.ts:812`, `565`).

**Fix:** Compute the carry-over list inside the lock. Pass a thunk, or re-read state at the start of the locked body:

```ts
await withExistingScopeLock(locations, async () => {
  const locked = await loadState(locations.extensionRoot);
  await syncMarketplaceBySwap({ ...args, marketplaces: locked.marketplaces });
});
```

## Info

### IN-01: A user's own `insteadOf` for `https://github.com/` wins over the D-SG-16 base pair

**File:** `extensions/pi-claude-marketplace/shared/github-base-url.ts:114-121`

**Issue:** git's `alias_url` keeps the longest matching `insteadOf` and, on a tie, the rewrite defined first. The config files come before `-c`. A user with the common `url.git@github.com:.insteadOf=https://github.com/` or `url.https://<token>@github.com/.insteadOf=https://github.com/` therefore keeps the rewrite to the real GitHub, and `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` silently has no effect. The GHB-01 cause still names the base URL as the URL fetched.

**Fix:** Document the precedence next to D-SG-16. If the override must win, use a strictly longer prefix, such as one pair per owner path. Otherwise accept the precedence as user configuration.

### IN-02: After an unreachable freshness check, the clone's own failure is replaced by the check's

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:300-307`

**Issue:** `cloneIntoStaging` throws `freshness.cause` whenever the check was `unreachable`, whatever made the clone fail. Suppose a transient `ls-remote` timeout is followed by a clone that fails locally (`ENOSPC`, an `assertPathInside` refusal while writing the ownership marker, `refused-input`). The row then reports `network unreachable`, and the real cause is lost. The GAUTH-04 rationale only needs the check's error when the clone failed as a git network or auth failure.

**Fix:** Prefer the check's failure only when the clone's error is a `GitCommandError` whose kind is a remote failure. Otherwise throw the clone's error and attach the check's error as its `cause`.

### IN-03: A `plugin-clones-backup/<key>` that an interrupted mirror swap leaves is never removed once the key stops being live

**File:** `extensions/pi-claude-marketplace/persistence/locations.ts:414-421`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:616-630`

**Issue:** The backup root sits outside `plugin-clones/` so that the clone sweep does not touch it. Only a later refresh of the same key recovers it, and if that mirror key is never refreshed again (its plugins uninstalled, or the source changed), the full mirror copy stays forever. This is the mirror counterpart of the recorded `sources-backup/<name>` leftover, but it is not recorded.

**Fix:** Let `collectPluginClonesLocked` also remove `plugin-clones-backup/<key>` entries whose key is not live, or record the leftover beside the D-SG-10 one.

### IN-04: The retry's debug line says "signed in" when the memo answered with an earlier result

**File:** `extensions/pi-claude-marketplace/platform/git.ts:352-360`

**Issue:** On a memo hit, `onAuthRequired()` returns the cached result. The log line then says `signed in to <host>, running it once more` for each git command in the ladder (clone, both fetch rungs, `ls-remote`), which makes CR-01 harder to see in a debug trace.

**Fix:** Have the closure report whether it came from the memo, or log `reusing the sign-in for <host>` on a memo hit.

### IN-05: `isUnreachable` treats non-git errors from the freshness check as an unreachable remote

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:207-214`

**Issue:** Q16 records that upstream keeps a checkout on any `ls-remote` non-zero exit. Pi also counts any thrown non-`GitCommandError` as `unreachable`: a `mkdtemp`/`EACCES` from the one-shot credential, `DeviceFlowUnavailableError`, or a lock-compromise error. With the keep variable set, these become a kept checkout reported as `network unreachable`. Without it, they trigger a re-clone. None of them says anything about the remote.

**Fix:** Count only a `GitCommandError` (other than `NOT_REMOTE_FAILURES`) or a `StoredCredentialRejectedError` as `unreachable`, and rethrow everything else.

---

_Reviewed: 2026-11-24T14:50:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
