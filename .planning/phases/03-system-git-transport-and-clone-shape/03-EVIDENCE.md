# Phase 3 (system-git) upstream-parity evidence: System Git Transport and Clone Shape

Scope line (skill step 1): Phase 3 touches the upstream contract. How a marketplace is cloned, how
`marketplace update` follows its remote, how a pinned plugin reaches its commit, how long a clone may
run, and what happens when the remote is down are all things a Claude Code user meets on
`/plugin marketplace add`, `/plugin marketplace update`, and `/plugin install`. Q5 (old clones), Q13
(the state lock), and the Device Flow interim have no upstream analogue; those records recommend from
Pi and project constraints.

## Evidence base

- Binary: `/opt/claude-code/bin/claude`, `VERSION:"2.1.330"`, `BUILD_TIME:"2026-11-20T17:34:37Z"`,
  `GIT_SHA:"8c664bec500172ded713624f9ecac0eb7e714829"` (Linux build). Grepped on 2026-11-23 with a
  byte-offset context extractor (Python `mmap`, `tools/ctx.py` in the scratchpad) and against the
  pre-extracted strings dump. The binary was never run.
- Minified names (`wbi`, `PG`, `$Ft`, `ZMo`, `mCi`, `hCi`, `Aoe`, `bNe`, `Wpt`, `j9o`, `hpe`, `G9o`,
  `Wto`, `KPo`, `tLo`, `eLo`, `y5e`, `ze`, `kt`) belong to this build only. Each record quotes string
  literals for finding the code again.
- Facts already established in `.planning/phases/02-git-process-seam-and-typed-failures/02-EVIDENCE.md`
  are cited as "02-EVIDENCE Qn" and not re-derived: the three hardening layers and `pinArgs` (Q14),
  the lack of a version probe (Q17), the git-missing messages (Q1, Q3), the lanes (Q11), and the
  typed-kind table (SG-PRC-05). The decisions they produced are D-SG-01..08 in PROJECT.md.
- Local experiments: git 2.43.0, Node 24.22.3, isomorphic-git 1.44.10 (the repository's
  `node_modules`), in `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/ev3/`
  under `env -i HOME=<scratch>/home PATH=/usr/bin:/bin GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null`.
  Servers were `file://` bare repositories and a loopback smart-HTTP server that wraps
  `git http-backend` (`tools/githttp.mjs`, optional Basic auth, request log). Experiment IDs below
  are `E3-*`.
- Isolation note: one step of E3-Q8 ran `git fetch` without the `insteadOf` rewrite on purpose, to
  show that the recorded origin is canonical; that one request left loopback and reached
  `https://github.com/repo.git` through the sandbox proxy (`repository ... not found`). It carried no
  credential (`credential.helper=` was cleared). No other request left loopback.
- Repository read 2026-11-23: `platform/git.ts`, `platform/git-process.ts`, `platform/git-failure-kind.ts`,
  `orchestrators/marketplace/{shared,add,update}.ts`, `orchestrators/plugin/{clone-cache,marketplace-tag-probe,dependency-tag-probe,update-constraint-gate,install-cascade}.ts`,
  `shared/{github-base-url,path-containment}.ts`, `domain/manifest-containment.ts`,
  `transaction/with-state-guard.ts`, `features/marketplace/device-flow.feature`,
  `features/lib/github-device-flow/extension.ts`, `features/support/pi-process.ts`,
  `features/step_definitions/git-host.steps.ts`, and the Phase 1 re-baseline record
  (`01-08-SUMMARY.md` "Phase 3 re-baseline record": 79 request tables in 19 files, 59 smart-HTTP
  tables in 17 files).

## Corrections to the milestone research (re-checked against 2.1.330)

| # | Research claim (file) | Verdict | Correction |
|---|---|---|---|
| C1 | "The explicit-install plugin clone timeout is unverified" (FEATURES E-SG-11, SUMMARY Q15) | **Settled: 10 minutes per git command** | `gitTimeoutMs` is set in exactly one place, `gitTimeoutMs:Wto()` in the session-load install path (`l6a`). Every other caller of the plugin loader leaves it undefined, `mCi` passes `timeout:k` (undefined) to `kt`, `kt` passes `timeout:r.timeout` to `ut`/`ze`, and `ze`'s destructuring default `timeout:o=10*ee*Q` applies, with `var Q=1000,ee=60` in the same chunk. So an explicit `/plugin install` gives each git command (clone, SHA fetch, `--unshallow`, checkout) 600 000 ms. HIGH for the chain, MEDIUM that no caller wraps it in its own deadline. |
| C2 | "Upstream preserves symlinks inside the plugin, dereferences ones inside the marketplace, skips outside" (PITFALLS Pitfall 16, SUMMARY Q19) | **Partly wrong** | The plugin cache copy (`copyDir`) makes the cached tree **symlink-free**: `Plugin tree at <p> could not be made symlink-free (...); refusing to cache it`, `copyDir: skipping symlink escaping containment root:`, `copyDir: skipping broken symlink`, `copyDir: skipping symlink to an ancestor directory`, `copyDir: skipping cyclic symlink target`, `Plugin materializes more files through symlinks than the copy budget allows`. A link inside the containment root is materialized as a copy; one outside is dropped. The loader text says an installed plugin follows a symlink "only if it points inside the plugin's installed folder, or, for a plugin read in place from a local marketplace folder, inside that folder". MEDIUM (strings, not a traced copy loop). |
| C3 | "The TAGS-01 marketplace tag probe has no upstream analogue" (implied by PITFALLS Pitfall 5, STACK) | **Upstream reads those tags over the network** | `j9o(entrySource, marketplaceSource)` returns, for a string (path) entry, `hpe(marketplaceSource)`: the marketplace's own remote URL (`github` -> `git@github.com:<repo>.git` or the HTTPS form under `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `git` -> its url, `directory` -> a `file://` href). `G9o` -> `Wpt(url, name, ...)` runs `git ls-remote --tags -- <url>` in a `claude-lsremote-` temp dir and keeps `refs/tags/<name>--v<semver>` (peeled `^{}` preferred). Callers: `materializeOne` (dependency install) and `updatePluginOp`. On no satisfying tag for a path entry: `materializeOne(<dep>): no <name>--v* tag satisfying <range> on marketplace repo; falling through to HEAD`. HIGH. |
| C4 | "The marketplace update re-clones; a failed re-clone keeps the old checkout" (FEATURES E-SG-07) | **Confirmed, with recovery detail** | `wbi` first restores a leftover `<dir>.bak` (an interrupted swap), deletes it, deletes a leftover `<name>..clone` staging dir, clones into `..clone`, then renames live -> `.bak`, staging -> live, and deletes `.bak`. A failed move-in renames `.bak` back. `EBUSY`/`EPERM`/`EACCES` on the move-aside keeps the existing copy ("the next refresh will try again"). HIGH. |
| C5 | Upstream clone shape | **Confirmed** | Marketplace `ZMo`: `clone --depth 1` (dropped only for a SHA `ref` behind flag `tengu_tender_raven`), `--no-recurse-submodules`, `--branch <ref>` when a ref is set, `-- <url> <dir>`, timeout `Wto()`. Plugin `mCi`: `clone --depth 1 (--recurse-submodules --shallow-submodules | --no-recurse-submodules)`, `--branch <ref>` only without a SHA, `--no-checkout` with one. HIGH. |
| C6 | "The marketplace lock is held around the clone" (none; Q13 framing) | **Upstream holds no lock during a clone** | The only lock on this surface is `known_marketplaces.json.lock` (`proper-lockfile`, `retries:{retries:5,minTimeout:100,maxTimeout:1000}`), held by `y5e` around the read-modify-write of the registry JSON, and on failure `Failed to acquire known_marketplaces.json lock, writing without it`. The clone (`PG` -> `wbi` -> `ZMo`) runs before and outside it. HIGH for the lock and its scope. |

---

## Q5 (part): clones that isomorphic-git made before the upgrade

**Question.** isomorphic-git clones carry `core.symlinks=false`, `core.filemode=false`,
`core.ignorecase=true`, full history, a wildcard refspec, and an `origin/HEAD` that isomorphic-git
kept current. When system git takes over, correct these settings in place, or re-clone on the next
network operation? A load must stay free of installation changes and network.

**Claude Code behavior.** No upstream position: Claude Code never used isomorphic-git. The nearest
behavior: its update probe (`$Ft`) returns `stale`, and so re-clones, whenever the checkout does not
match what it expects ("sparse paths changed, re-cloning", "no readable HEAD, cloning",
"<ref> not advertised by the remote, re-cloning"), and its update never runs git inside an existing
checkout; it swaps in a fresh clone (C4). The core keys `core.autocrlf`, `core.eol`, `core.symlinks`,
`core.filemode`, `core.ignorecase` appear only in an unrelated set (`ai`, a gitconfig serializer);
no plugin or marketplace clone sets or clears them.

**What git does (E3-Q5, git 2.43, isomorphic-git 1.44.10).**

| Step | Command | Result |
|---|---|---|
| a | isomorphic-git `clone` over loopback HTTP | `.git/config` holds `filemode = false`, `symlinks = false`, `ignorecase = true`, `fetch = +refs/heads/*:refs/remotes/origin/*`; `refs/remotes/origin/HEAD` = `ref: refs/remotes/origin/main`; the committed symlink `link` was written as a real symlink. |
| b (E-8 re-verified) | server `symbolic-ref HEAD refs/heads/dev`, then isomorphic-git `fetch` | `refs/remotes/origin/HEAD` became `ref: refs/remotes/origin/dev`. isomorphic-git does track a moved default branch. |
| c | same move, system git `fetch origin` and bare `fetch` on a system clone | `origin/HEAD` stayed `refs/remotes/origin/main`. `ls-remote --symref origin HEAD` printed `ref: refs/heads/dev HEAD`; `remote set-head origin --auto` set it to `dev`. `-c remote.origin.followRemoteHEAD=always` is accepted and ignored on 2.43. |
| d | push a new symlink `newlink -> lf.txt`, then system `fetch` + `update-ref` + `checkout` + `reset --hard` in the isomorphic-git clone | `newlink` became a 6-byte regular file; `git status` showed it clean. |
| e | `config --unset core.symlinks`, `--unset core.ignorecase`, `--unset core.filemode` | `status` then showed ` T newlink` (typechange). |
| f | `checkout -f HEAD` | `newlink` became a real symlink; status clean. |
| g | `git init -q` on the clone (reinitialize) with all three keys set | re-probed `core.filemode=true` only; `symlinks=false` and `ignorecase=true` stayed. |
| h | fresh system `clone` on Linux | local config has `core.filemode=true` and no `core.symlinks` or `core.ignorecase` key (`config --get core.symlinks` exits 1). |

So an isomorphic-git clone is harmless until system git **checks out into it**; from then on new
symlinks become text files. Detection is cheap and local: `core.symlinks=false` (or
`ignorecase=true`) on a host whose filesystem supports symlinks (case-sensitive) marks it.

**Pi today.** Three places would make system git check out into an existing clone:
- `orchestrators/marketplace/shared.ts::refreshGitHubClone` (the D-14 fetch -> `forceUpdateRef` ->
  `checkout` refresh), used by `marketplace update` (github and url arms), the PUP-2 sync, and the
  plugin mirror refresh (`clone-cache.ts::materializeOrRefreshPluginMirror`).
- `clone-cache.ts::checkoutGitDirCopy`, which copies a mirror's or a marketplace's `.git` (its
  `config` included) into a staging dir and checks a commit out there: per-commit copies
  (`materializePluginCommitCopy`) and release-tag copies (`materializeMarketplaceTagClone`). The copied
  `symlinks=false` reaches every new copy.
- `seedSameRepoPluginMirrors` copies a marketplace checkout, `.git` included.
The load (`resources_discover`) never runs git and never touches a clone's `.git` except the fs-only
`readOriginRemoteUrl` (NFR-5, APL-D1).

**Constraints.** APL-D1 and NFR-5: the load may not normalize or re-clone. NFR-2: no step may need a
restart, so the fix runs on the next operation that already touches the clone. NFR-1/NFR-3:
`git config` writes through a lock file and rename; a re-clone goes through staging and rename.
NFR-10: unchanged (all writes inside `<scopeRoot>/pi-claude-marketplace/`).

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. Re-clone on the next network operation that would touch the clone (marketplace update; mirror refresh); for a local copy step (`checkoutGitDirCopy`), pass `-c core.symlinks=<probed> -c core.ignorecase=<probed>` or rewrite the copied config before checkout. | Same shape as upstream (`$Ft` re-clones a checkout it does not trust). With Q9 option A the marketplace update re-clones anyway, so marketplace clones need no extra code. | A mirror refresh becomes a re-clone (more transfer) unless the mirror refresh also adopts Q9's model. The copy step still needs the override. | **Rec** if Q9 picks re-clone-and-swap. |
| B. Normalize in place on the first system-git operation: unset `core.symlinks`, unset `core.ignorecase` on a case-sensitive filesystem, `git init -q` (re-probes filemode), then `checkout -f HEAD`. | No transfer. Works with Q9 option B. | Platform probes to get right (Windows without symlink rights, macOS case-insensitive APFS). Multi-step, needs a "done" marker or an idempotent re-check each time. Copied `.git` dirs still need the fix. | Rec only if Q9 keeps D-14 in place. |
| C. Do nothing. | No code. | Symlinked plugin files silently break after the first update of an old clone (PITFALLS Pitfall 7, E3-Q5 d). Fails SG-MIG-01. | Not viable. |

**License a divergence needs.** None for A or B: no upstream position applies (Pi-only migration).
Record the choice as a `D-SG-NN`.

**Recommendation.** Option A, tied to Q9 option A, with a one-line override on the copy step
(`checkoutGitDirCopy` reads the copied config and drops `core.symlinks`/`core.ignorecase` before the
checkout, or passes `-c` with the probed values). Nothing runs at load.

**Confidence.** HIGH for the isomorphic-git and git behavior (experiment). HIGH that no upstream
position exists.

**Reversibility.** Reversible technical (can be decided autonomously): internal migration with no
user-visible surface once it works; either option can replace the other.

---

## Q8: `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (D-MF-01, GHB-01..04)

**Question.** Keep the variable as a `-c url.<base>/.insteadOf=https://github.com/` key, as an
explicit wire URL on every remote command, or retire it? How does the cucumber harness reach its
GitHub stand-in either way?

**Claude Code behavior.** No such variable. The GitHub host is the literal `Kr="github.com"`;
github sources become `git@github.com:<repo>.git` or `https://github.com/<repo>.git` (`hCi`, `Upt`,
`wbi`'s add path). No `*GITHUB*BASE*` variable appears on the plugin surface (the 23 `GH_HOST` hits
belong to the `gh` integration). A user who needs a mirror uses their own git `url.<base>.insteadOf`,
which upstream respects, and Phase 4's SSH probe-skip reads it through `ls-remote --get-url`
(FEATURES E-SG-02). HIGH.

**What git does (E3-Q8, loopback server requiring Basic auth, logging credential helper).**

| Case | Result |
|---|---|
| `git -c url.http://127.0.0.1:18433/.insteadOf=https://github.com/ -c credential.helper=<log> clone https://github.com/repo.git` | rc 0. Recorded `remote.origin.url` = `https://github.com/repo.git` (canonical, no reset needed). The helper saw `get protocol=http host=127.0.0.1:18433` and `store ... host=127.0.0.1:18433`: **credentials are keyed by the rewritten host**. |
| later `fetch` without the `-c` | went to `https://github.com/repo.git` (the isolation note above). The rewrite must ride on every remote command. |
| the same rewrite through `GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n` | rc 0, same helper host. |
| `fetch <wire-url> '+refs/heads/*:refs/remotes/origin/*'` with no rewrite | rc 0, tracking refs updated, recorded origin unchanged. |

**Pi today.** `shared/github-base-url.ts::gitHubWireUrl` rewrites the `https://github.com/` prefix
in process; `platform/git.ts::clone` resets `remote.origin.url` to the canonical form after an
isomorphic-git clone; `fetch` passes the wire URL beside the remote name. GHB-02 binds the auth host
to the base's host, so Device Flow never fires under the override. GHB-03/04: an invalid value is a
typed error with its own output (`docs/output-catalog.md`). It is user-facing: CHANGELOG
"GitHub sources clone and fetch from another https git host, such as a mirror, when you set
`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`." The cucumber harness sets it on every Pi
(`features/support/pi-process.ts:175`) to reach the HTTPS stand-in; the Device Flow scenarios run
without it (`withoutGitHubBaseOverride`) and route through an in-process `https.request`/`fetch`
patch (`features/lib/github-device-flow/extension.ts`), which **cannot see a system git process**.

**Constraints.** Upstream parity says no variable; D-MF-01 is a recorded decision that licenses
keeping it. NFR-5 unchanged. The behavior "auth host = override host" (GHB-02) is exactly what git's
credential keying does under `insteadOf` (E3-Q8 row 1), so option A keeps GHB-02 with no code. Phase 4
needs the answer for the SSH probe: under option A the rewrite matches only `https://github.com/`, so
`ls-remote --get-url git@github.com:o/r.git` is unchanged and the probe would still run.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. Keep D-MF-01 as `-c url.<base>/.insteadOf=https://github.com/` on every remote command when set (same validation, same GHB-03 errors). | Smallest change. Credential host follows the base (GHB-02 kept). Recorded origins stay canonical without a reset. The harness keeps working unchanged. | Every remote verb must add it (one builder row). Phase 4 must exclude Pi's own `-c` from the probe-skip check and decide whether SSH is skipped under the override (an `ssh` URL is not rewritten). | **Rec.** |
| B. Explicit wire URL on every remote command (`fetch <url> <refspec>`, `ls-remote <url>`, clone of the wire URL then reset origin). | No config key, so no interference with the probe-skip detector. | Every fetch needs an explicit refspec (tags, heads) and a hand-written tracking update; easy to get wrong; more code than A. | Rec only if Phase 4 finds A breaks the probe-skip rule. |
| C. Retire it; the user (and the harness) uses their own `url.<base>.insteadOf`. | Parity. Deletes `shared/github-base-url.ts` and GHB-01..04. | A documented, user-visible feature goes away (CHANGELOG entry). The harness must write `insteadOf` into the sandbox `.gitconfig`, which changes credential keying in the Device Flow scenarios. | Rec only if the maintainer wants strict parity over D-MF-01. |

**Harness either way.** A and B: unchanged (`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL=https://<git host>`
plus `GIT_SSL_CAINFO`). C: a `[url "https://<git host>/"] insteadOf = https://github.com/` section in
the sandbox `GIT_CONFIG_GLOBAL` file (respected as user config under D-SG-05).

**License a divergence needs.** A and B keep a divergence that D-MF-01 already licenses. C needs
GHB-01..04 retired under a new `D-SG-NN`.

**Recommendation.** Option A.

**Confidence.** HIGH (upstream has no variable; experiment for git behavior).

**Reversibility.** A or B: reversible technical (internal mechanism, no user-visible change).
C: costly / preference (ask the maintainer): it removes a shipped, documented user feature.

---

## Q9: the marketplace update model

**Question.** Keep D-14 (`fetch`, resolve, `update-ref`, `checkout` in place), or adopt upstream's
`ls-remote` freshness check followed by a re-clone into staging and a swap? Include a moved default
branch, a moved tag, and what an interrupted update leaves.

**Claude Code behavior (2.1.330).** `PG(url, dir, ...)` -> `wbi`:
1. `Refreshing marketplace cache (timeout: <n>s)…`, then `$Ft(dir, url, {ref, sparsePaths, timeout: Wto()})`:
   - sparse paths changed, or no readable `HEAD` -> `stale`;
   - `ref` is a full SHA -> compare with `HEAD`;
   - else `git -C <tmp claude-lsremote-*> <inCheckoutArgs> ls-remote -- <url> HEAD`
     (or `refs/heads/<r>`, `refs/tags/<r>^{}`, `refs/tags/<r>`); non-zero exit -> `unreachable`;
     ref not advertised -> `stale`; equal SHA -> `current`, else `stale`
     (`Marketplace checkout probe: local <12> remote <12> — up to date|re-cloning`).
2. `current` -> return; `unreachable` -> KEEP rule (Q16), else fall through; `stale` -> fall through.
3. Restore an interrupted swap: `rename(<dir>.bak, <dir>)`; on a non-ENOENT failure, if `<dir>` has
   no `.claude-plugin/marketplace.json`, delete it and restore `.bak`. Then delete `.bak`
   (`Failed to clean up stale marketplace backup directory...` on failure) and delete
   `<name>..clone` (`Failed to clean up a leftover marketplace staging directory...`).
4. `Cloning repository (timeout: <n>s): <url>[ (ref: <r>)]` -> `ZMo(url, <name>..clone, ref, ...)`
   (`--depth 1`, `--branch <ref>` when set). Failure: delete staging, throw
   `Failed to clone marketplace repository: <stderr>`; the live checkout is untouched.
5. Swap: `rename(<dir>, <dir>.bak)` (`Replacing the existing marketplace clone…`; `EBUSY`/`EPERM`/`EACCES`
   -> `Could not replace the marketplace directory at <dir> because it is in use; the existing copy was kept and the next refresh will try again.`),
   `rename(staging, <dir>)` (failure -> rename `.bak` back, `Failed to move the new marketplace clone into place at <dir>. Please try again.`),
   delete `.bak`, `Clone complete, validating marketplace…`.
- A **moved default branch**: `ls-remote <url> HEAD` returns the new branch's tip, which differs, so
  the re-clone (no `--branch`) checks out the new default branch. No `origin/HEAD` bookkeeping exists.
- A **moved tag**: `refs/tags/<r>^{}` differs, so the re-clone `--branch <tag>` takes the new target.
- Interrupted at any point: the next run's step 3 restores `.bak` or discards the half staging dir.
- For github sources, the refresh retries over the other transport (`Marketplace refresh failed with <T> for <repo> (...), falling back to <T2>`), Phase 4's subject.
Evidence: `async function wbi(`, `async function $Ft(`, `async function bNe(e,{flags:o=[],patterns:r=[],timeout:g,endsWithItsChildren:h=!1}={})`, literals above. HIGH.

**What git does (E3-Q9).** On a full clone after the server moves `HEAD` to `dev`: `fetch` leaves
`origin/HEAD` at `main` (E-8, Q5 row c). After a server-side `tag -f p--v2.0.0 <new>`:
`fetch origin p--v2.0.0` leaves the local tag (only `FETCH_HEAD` moves);
`fetch origin --tags` prints `! [rejected] p--v2.0.0 -> p--v2.0.0 (would clobber existing tag)`;
an explicit `refs/tags/X:refs/tags/X` without `+` is refused; `fetch --force origin 'refs/tags/X:refs/tags/X'`
and `fetch --force --tags origin` move it.

**Pi today.** `refreshGitHubClone` (D-14, D-23 "follow upstream blindly"): `fetch` ->
`resolveRef(refs/remotes/origin/HEAD | refs/remotes/origin/<ref>)` -> `forceUpdateRef` -> `checkout`;
a tag/SHA ref falls back to a detached checkout through the `NotFoundError` name matcher. Under system
git it would (1) keep following the old default branch forever (E-8), (2) never move a moved tag
(the fallback checks out the stale local tag), (3) leave `index.lock`/`shallow.lock` behind on an
abort (PITFALLS E-11), and (4) check out into isomorphic-git clones with `symlinks=false` (Q5). The
same function refreshes unpinned plugin mirrors. `update.ts` holds the scope lock around it
(`snapshotAfterRefresh`). `add.ts` already clones into `sources-staging/<uuid>` and renames (D-09).

**Constraints.** NFR-1 (atomic): re-clone-and-swap is two renames inside one filesystem
(`sources-staging/` and `sources/` are siblings, D-09). NFR-3 (retry-safe): step 3 is the upstream
recovery. NFR-5: no change; `marketplace update` is already a network command, and `ls-remote` is a
read of the same remote. NFR-10: staging and `.bak` must live inside `<scopeRoot>/pi-claude-marketplace/`
(use `sources-staging/` rather than a `<name>..clone` sibling, or check both through `ScopedLocations`).
MU-5 retry hint ("clone advanced") and UXG-05 `changed` detection must be re-anchored on the swap.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. `Claude Code`: `ls-remote` check, then re-clone into staging and swap with `.bak` recovery. Apply the same model to plugin mirror refreshes. | Parity in behavior (moved default branch and moved tag followed for free). No `origin/HEAD`, no `--force` tag fetch, no stale `*.lock` in a live tree, no in-place checkout into old clones (Q5). Fits NFR-1/NFR-3. | Rewrites `refreshGitHubClone`, its callers in `update.ts`, `update-flow.ts`/`update-preflight.ts` (PUP-2 sync), and `clone-cache.ts`'s mirror refresh. A changed marketplace re-downloads in full (shallow, so small). A shallow re-clone drops the tags Q10 option B fetched, so the tag fetch must follow the re-clone. | **Rec.** |
| B. Keep D-14 on system git: `fetch --force` with explicit refspecs (heads and tags), `ls-remote --symref` or `remote set-head --auto` for the default branch, `checkout --force` of the resolved SHA, stale-lock cleanup, and Q5 normalization. | Smaller diff to the call graph. Less transfer for big repos. | Every pitfall needs its own guard; an interrupted fetch or checkout leaves a half-updated live tree (NFR-1). Diverges from upstream's observable "re-clone" behavior (for example a force-pushed branch or a rewritten history behaves the same, but a corrupted clone is not healed). | Rec only if the re-clone rewrite is judged too large for this phase. |

**License a divergence needs.** B has no license (no Pi gap; D-14/D-23 said "follow upstream", and
upstream now re-clones). It would need a new `D-SG-NN`. A needs D-14's mechanism superseded under a
`D-SG-NN` (it keeps D-23's intent).

**Recommendation.** Option A, for marketplaces and for plugin mirrors.

**Confidence.** HIGH (binary for upstream; experiment for git).

**Reversibility.** Reversible technical (can be decided autonomously): the user-visible result
(the checkout matches the remote's ref after `update`) is the same under both; the choice is
internal mechanism. It is the largest code change of the phase, so flag the size to the maintainer.

---

## Q10: shallow marketplace clones against TAGS-01 and NFR-5

**Question.** Upstream clones marketplaces `--depth 1`. A shallow clone carries no tags, and TAGS-01
reads a path-source dependency's `<name>--v<semver>` tags from the marketplace clone with no network.
What does upstream do for those tags, what does `--unshallow` cost, and does `ls-remote --tags`
replace the local read?

**Claude Code behavior.** It never reads tags from the marketplace clone. For a path entry it runs
`git ls-remote --tags -- <marketplace remote URL>` (C3: `j9o` -> `hpe` -> `G9o` -> `Wpt`), during
dependency install (`materializeOne`) and plugin update (`updatePluginOp`), memoized per URL in
`lsRemoteCache`. A listing failure returns `null`
(`listPluginTagVersions: ls-remote failed for <url>: ...`), and for a path entry the install falls
through to the marketplace's HEAD copy; for a git entry with no matching tag it fails
`no-matching-tag`. For a `directory` (local folder) marketplace the URL is a `file://` href, so the
read is local. The marketplace clone itself stays `--depth 1` (C5). HIGH.

**What git does (E3-Q10, git 2.43).**

| Case | Result |
|---|---|
| a `clone --depth 1 file://...repo.git` (3 tags, one annotated) | `tag -l` prints nothing; `remote.origin.fetch = +refs/heads/main:refs/remotes/origin/main`. |
| b `fetch --depth 1 origin '+refs/tags/*:refs/tags/*'` | rc 0; all three tags present; `for-each-ref --format='%(refname:strip=2) %(objecttype) %(objectname) %(*objectname)'` peels the annotated one; the repository stays shallow with one graft per tag commit; `checkout p--v1.0.0` works. |
| c `ls-remote --tags file://...` | lists each tag plus `^{}` for the annotated one; needs no clone. |
| d `--unshallow` cost (3000 commits, 26 MB pack, loopback) | depth-1 clone 0.04 s / 612 KB; `fetch --unshallow` 0.82 s / 26 MB; full clone 0.68 s / 26 MB. `--unshallow` costs about a full clone. On a complete repository it fails `fatal: --unshallow on a complete repository does not make sense`. |

**Pi today.** TAGS-01 callers (every one):
- `orchestrators/plugin/marketplace-tag-probe.ts::probeMarketplaceTags` (imports only `listTags` and
  `resolveTagOid`; pinned by `test/architecture/marketplace-tag-probe-offline.test.ts`), called from
  - `orchestrators/plugin/install-cascade.ts:928` (constrained path-source member of an install cascade, `marketplaceTagMemo`), and
  - `orchestrators/plugin/update-constraint-gate.ts:224` (`probePathStageOne`, update preflight), fed by `update-preflight.ts`/`update-flow.ts`/`dependency-move.ts` memos.
- The selected tag is materialized by `clone-cache.ts::materializeMarketplaceTagClone`
  (`install-outcome.ts:846`, `update-preflight.ts:557`), which copies the marketplace `.git` and checks
  out the tag's commit, so it needs that commit's objects locally.
- `clone-cache.ts::resolveLocalTagOffline` / `resolveFetchedRefOffline` (mirror reinstall,
  D-18-04/D-PL7-10) read local tags of plugin **mirrors**, not marketplaces.
- `dependency-tag-probe.ts::probeDependencyTags` (`listRemoteTags`, D-03-03) is the network read for
  git-source dependencies; it does not depend on clone depth.
Both TAGS-01 callers fold a failed or empty listing into "fall back to the current copy"
(`fellBackToCurrentCopy`, TAGS-02, D-10-14/16). So a shallow clone without tags would **silently**
install the current copy instead of the pinned release: no error, a wrong version.

**Constraints.** NFR-5 today: a path-source plugin install is network-free; D-03-03 allows a network
tag read only for a dependency's own source repository. A network read of the marketplace remote
during a path-source install or update is new (NFR-5 amendment). TAGS-01's offline proof test pins
the local-only read. Q9 option A re-clones on every changed update, which drops any tags fetched
after the previous clone.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. `Claude Code`: shallow clone; resolve path-source ranges with `ls-remote --tags` of the marketplace remote (memoized per URL per command); then fetch the chosen commit into the tag copy (`fetch --depth 1 origin <sha>` in staging). | Exact parity, including the offline fallback to HEAD. One remote read per marketplace per command. | New network read on path-source install/update with a constraint: NFR-5 amendment (extend D-03-03 to the marketplace remote) and TAGS-01's offline test inverted. The tag copy needs a network fetch too. `marketplace-tag-probe.ts` joins the network seams. | Rec if parity outranks NFR-5's offline path-source install. |
| B. Shallow clone plus one tag fetch at add and after each re-clone (`fetch --depth 1 origin '+refs/tags/*:refs/tags/*'`, with `--force`); TAGS-01 stays a local read through one `for-each-ref`. | No NFR-5 amendment; TAGS-01 and its proof test stay; the tag copy finds its objects locally (E3-Q10 b). | Diverges invisibly (upstream reads the remote at install time, so it sees a tag pushed after the last `marketplace update`; Pi would not until the next update). One commit and tree per tag on add/update: a marketplace with hundreds of release tags transfers hundreds of trees. | **Rec** (default: keeps NFR-5). |
| C. Keep marketplace clones full (no `--depth 1`). | No tag problem, no amendment. | Diverges from upstream's clone shape; large marketplaces pay full history on every re-clone (Q9 A). | Not recommended. |

**License a divergence needs.** B diverges in when tags are read (add/update time instead of install
time). NFR-5 is a recorded constraint, so B is licensed by it; record it as `D-SG-NN`. A needs an
NFR-5 amendment `D-SG-NN` (it is parity, so no divergence license).

**Recommendation.** Option B, unless the maintainer prefers exact parity (A) and accepts the NFR-5
amendment. Either way, add a cucumber scenario that a constrained path-source dependency still pins
its tag after `marketplace add`, so a silent fallback is caught.

**Confidence.** HIGH (binary for upstream; experiment for git). MEDIUM for the transfer cost on real
marketplaces (loopback only).

**Reversibility.** Costly / preference (ask the maintainer): A amends NFR-5 (a recorded user-facing
network policy) and changes what an offline install does; B is a visible-only-in-edge-cases
divergence from parity. Either is a policy call.

---

## Q13: where the state lock sits during a clone of up to 120 s

**Question.** A system-git clone can run up to the timeout. Pi holds its per-scope lock around the
clone today. What does a concurrent Pi see, and should the clone move outside the lock?

**Claude Code behavior.** No lock around the clone (C6). The registry `known_marketplaces.json` is
locked only for its read-modify-write, with 5 retries (100-1000 ms), and written without the lock if
that fails. The clone works in a fixed staging dir `<name>..clone` that each refresh deletes first,
so two concurrent refreshes of one marketplace can race on that directory; upstream accepts this.
HIGH for the lock; LOW for any race handling beyond what the code shows.

**Pi today.** `transaction/with-state-guard.ts`: `proper-lockfile` on the extension root,
`retries: 0`, `stale: 10_000`, `update: 2_000`, not re-entrant. `marketplace add` wraps the whole
flow, network included (D-04, `runAddInGuard`); `marketplace update` wraps refresh and persist
(`snapshotAfterRefresh`); unpinned plugin materialization runs inside the caller's lock (GIT-03, so no
mirror refresh races the copy). A second Pi on the same scope gets `StateLockHeldError` at once
("Another pi-claude-marketplace operation is in progress for <scope> scope ... Retry after it
completes.") for as long as the clone runs. The background autoupdate pass (D-PL8) holds the lock per
marketplace. The lock's `update` timer keeps the lock fresh only while the event loop runs, so the
spawn must stay async (Phase 2's `git-process.ts` is async; a sync spawn would let the lock go stale
after 10 s and be stolen).

**Constraints.** NFR-1/NFR-3; D-04 (outer guard), GIT-03 (mirror read and copy under the lock),
MA-8 duplicate-name check, which reads the cloned manifest and the state together. APL-D1 unaffected.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. Keep the lock around the clone (accept up to 120 s, or the user's timeout, of `StateLockHeldError` for a concurrent Pi). | No ledger change; D-04/GIT-03 hold as written. | A second Pi (or the background pass in another session) fails fast for up to 2 minutes instead of the few seconds isomorphic-git's small clones took. | **Rec** for this phase. |
| B. Clone into staging outside the lock, then take the lock to re-check state, rename, and save (upstream-like). | Lock held for milliseconds. Matches upstream's lock scope. | Re-check logic for every ledger (duplicate names, a concurrent add of the same name, a mirror refreshed between read and copy); bigger blast radius in the riskiest phase. | Rec as a follow-up only if contention is reported. |
| C. A with bounded retries on `StateLockHeldError` (like upstream's 5 retries). | Softens short overlaps. | Does not help a 120 s clone; changes D-06's fail-fast contract. | Not recommended. |

**License a divergence needs.** No user-visible upstream contract (upstream's own lock scope is an
implementation detail). A keeps a project decision (D-04); record the 120 s worst case in the
phase CONTEXT.md.

**Recommendation.** Option A, with the async spawn as a hard requirement and a unit row that the
lock's refresh timer fires during a long fake clone.

**Confidence.** HIGH (code and binary).

**Reversibility.** Reversible technical (can be decided autonomously): B can follow without changing
user-visible behavior beyond fewer lock errors.

---

## Q14 (part): `core.autocrlf`, and how the default branch is tracked

**Question.** Keep the user's `core.autocrlf` (parity) or force bytes-as-committed? Track the default
branch with `origin/HEAD`, `remote set-head`, `followRemoteHEAD`, or `--branch`?

**Claude Code behavior.** Sets no `core.autocrlf`, `core.eol`, or `core.symlinks` on any plugin or
marketplace clone (the only list naming them, `ai`, belongs to another feature; 02-EVIDENCE Q14
"Not set upstream"). The user's setting and the repository's `.gitattributes` apply. It tracks no
default branch: the freshness check reads `ls-remote <url> HEAD` and a re-clone without `--branch`
follows the remote's current default (Q9). It passes `-c remote.origin.followRemoteHEAD=never` only
on the SHA-pinned marketplace fetch (`bCn`, flag `tengu_tender_raven`), where it must not touch
`origin/HEAD`. HIGH.

**What git does.**
- E3-Q14a (user `core.autocrlf=true` in the global config): a clone checks out `a\r\nb\r\n...`;
  `git -c core.autocrlf=false clone` checks out LF but writes no local key, so later commands in that
  clone read the user's `true` again; `git clone --config core.autocrlf=false` writes the local key.
  The working-tree hash differs (`d69a64aa20df` vs `3ef65b928379` for one file). `.gitattributes`
  `eol=`/`text=` still apply either way (PITFALLS E-4).
- `origin/HEAD`: git 2.43 `fetch` never moves it (Q5 row c); `remote set-head origin --auto` and
  `ls-remote --symref origin HEAD` read the new default; `remote.<name>.followRemoteHEAD` is accepted
  and ignored on 2.43. From release notes (memory, MEDIUM) it arrived in git 2.48, whose default only
  creates a missing `origin/HEAD`. CI and many distributions ship older git (02-EVIDENCE Q17), so no
  design may rely on it.

**Pi today.** `domain/version.ts::computeHashVersion` hashes the working-tree bytes of a path-source
plugin in the marketplace clone; isomorphic-git wrote blob bytes unchanged, so every Windows user with
Git for Windows' default `autocrlf=true` would get a different hash version after the switch, and a
reinstall/update would report a new version (PITFALLS Pitfall 4). The default branch is read from
`refs/remotes/origin/HEAD` in `refreshGitHubClone` and `resolveFetchedRefOffline`.

**Options (autocrlf).**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. `Claude Code`: keep the user's setting. | Parity; no config written. | Hash versions of path-source plugins change on CRLF platforms, and differ between machines of one team. | Rec if hash-version stability is not a concern. |
| B. Write `core.autocrlf=false` into every clone Pi makes (`clone --config core.autocrlf=false`; the re-clone of Q9 A carries it). | Bytes as committed (as isomorphic-git did), so hash versions do not change on upgrade and match across machines. `.gitattributes` still applies, as upstream. | Invisible divergence from upstream (a Windows user's plugin files are LF where Claude Code would give CRLF; Claude Code users rarely see this because its versions come from commits, not tree hashes). | **Rec**, licensed by the existing hash-version contract. |

**Options (default branch).** Under Q9 A there is nothing to track for marketplaces: the re-clone
follows the remote. For plugin mirrors, either the same re-clone, or `ls-remote --symref` / `remote
set-head origin --auto` inside the network refresh step (never at load). Never `followRemoteHEAD`.

**License a divergence needs.** autocrlf B: no Pi capability gap; it protects the recorded
hash-version derivation (`domain/version.ts`, the version contract of path sources). Record as
`D-SG-NN`.

**Recommendation.** autocrlf B; default branch through Q9 A (no `origin/HEAD` reads remain), with
`remote set-head --auto` as the fallback if a mirror keeps an in-place refresh.

**Confidence.** HIGH for git behavior and upstream's absence of settings. MEDIUM for the
`followRemoteHEAD` version.

**Reversibility.** Reversible technical (can be decided autonomously): no user-visible output on
Linux and macOS; on Windows it restores today's bytes. Removing the key later would change hash
versions again, so treat a later removal as costly.

---

## Q15: the clone timeout variable, and the explicit-install plugin clone timeout

**Claude Code behavior.**
- `var pbi=120000,mbi="..clone";function Wto(){let e=s.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;if(e!==void 0&&e>0)return Math.min(e,au);return pbi}`, `au=2147483647`. The variable is parsed by
  `H.int()` (`Ux=H.int()`): a finite number, else unset. Values `<= 0` and garbage fall back to 120 s.
- `Wto()` bounds the marketplace freshness `ls-remote`, the marketplace clone, and (as
  `gitTimeoutMs:Wto()`) plugin clones that the session-load path makes. Messages:
  `Refreshing marketplace cache (timeout: <n>s)…`, `Cloning repository (timeout: <n>s): <url>`,
  `Git clone timed out after <n>s. The repository may be too large for the current timeout. Set CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS to increase it (e.g., 300000 for 5 minutes).`,
  and for plugins `Failed to clone repository: timed out after <n>s (CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS sets the limit). `.
- Explicit `/plugin install` (and other loader callers): no `gitTimeoutMs`, so each git command gets
  the process wrapper's default `10*60*1000` = 600 000 ms (C1). The variable is also in a
  propagate-to-children set (`ze=new Set(["CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS",...])`).
- Each command has its own timeout: `--unshallow` after a refused SHA fetch gets a fresh limit
  (`mCi` passes `timeout:k` to each call).
HIGH for `Wto` and the messages; HIGH for the 600 s default chain, MEDIUM that nothing wraps it.

**Pi today.** No git timeout (isomorphic-git runs unbounded). `git-process.ts` requires a
`timeoutMs` per request and kills the process group. The only 120 s constant is
`platform/prompt-shell.ts`.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. `Claude Code`: read `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` (finite `> 0`, capped at 2147483647, else 120 000) for marketplace clone, re-clone, freshness `ls-remote`, and plugin clones; per-command limits; messages name the variable. | Parity; users of both tools set one variable. | Pi has no "session load" vs "explicit install" split for plugin clones (installs run from commands or `apply`). | **Rec**, with plugin clones using `Wto()` too (SG-TRN-05 already says 120 s for clone and fetch). |
| B. A, plus 600 s for explicit plugin installs, as upstream. | Exact upstream numbers on the explicit path. | Two numbers to explain; Pi's `apply` would need a classification. | Rec only if the maintainer wants the 600 s explicit-install figure. |

**License a divergence needs.** A's single 120 s for every Pi plugin clone diverges from upstream's
600 s explicit-install default; SG-TRN-05 records 120 s, so cite it in the `D-SG-NN`.

**Recommendation.** Option A. Name the timeout in the Phase 6 wording.

**Confidence.** HIGH.

**Reversibility.** Reversible technical (can be decided autonomously): a constant and one variable read.

---

## Q16 (part): `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`

**Claude Code behavior.** `mD=H.bool()`: true for `1`, `true`, `yes`, `on` (trimmed, any case),
else false. Applies only in `wbi` when the freshness check returns `unreachable` (the `ls-remote`
exited non-zero: network, DNS, auth, timeout alike) **and** the existing checkout has
`.claude-plugin/marketplace.json` (`KPo`); it then logs
`Marketplace remote unreachable, keeping existing clone (CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE)`
at warn level and returns `kept-stale`, and `PG` skips recording the confirmed commit. Without the
variable, `unreachable` re-clones; that clone fails the same way and the old checkout stays (Q9 step
4), but the command reports the failure. `stale` (new commits) is never kept. A SHA ref skips the
`ls-remote`, so KEEP never applies to it. The official marketplace's GCS path is separate. HIGH.

**Pi today.** Not read. A failed `marketplace update` already leaves the checkout (D-14 fetch fails
before any write) and reports `MarketplaceUpdateError`.

**Constraints.** IL-2 (no log channel: the kept-stale outcome needs a notification or a debug-log
line), D-PL7-01 closed reason set (a kept checkout is not a failure), D-PL8 background pass
(`kept-stale` must not be reported as an update).

**Options.**

| Option | Recommendation |
|---|---|
| A. `Claude Code`: same truthy set, same two conditions, the marketplace reports as unchanged with a warning-level note naming the variable. | **Rec.** |
| B. Read the variable but report nothing (debug log only). | Rec only if Phase 6 wants no new row. |

**Recommendation.** Option A; the row's wording belongs to Phase 6, the outcome kind to this phase.

**Confidence.** HIGH.

**Reversibility.** Reversible technical (can be decided autonomously).

---

## Q19: symlinks in clones, and containment

**Question.** System git with `core.symlinks=true` writes real symlinks, including ones pointing
outside the clone. Adopt upstream's copy rules, keep in-place roots, and do NFR-10 checks use
`realpath`?

**Claude Code behavior.** Marketplace and plugin clones are checked out with git's default
(`core.symlinks` unset). Installed plugins run from a **symlink-free cache copy** (C2): links inside
the containment root are materialized, escaping, broken, cyclic, and ancestor links are dropped, and
a tree that cannot be made symlink-free is refused. Path entries read in place from a local
marketplace are bounded by `realpath` and an inode compare
(`it opens <p>, outside the marketplace directory`, `its spelling opens a different file from the one realpath names`).
MEDIUM (strings).

**What git does.** PITFALLS E-0: a committed `escape-link -> ../../../etc/passwd` is written as a
real symlink by system git (and by isomorphic-git), so the exposure is not new; old clones wrote
symlinks as text only after a system-git checkout (Q5 row d).

**Pi today.**
- Writes: `shared/path-containment.ts::createPathSafetyGuard` is lexical plus an `lstat` walk that
  refuses **every** symlink on the path (D-14 house policy, D-16), with no `realpath`.
- Reads: `domain/manifest-containment.ts` resolves links with `realpath` against Claude Code's
  boundaries (D-PL2-17, D-PL2-24); `bridges/skills/discover.ts` refuses symlinked skill dirs;
  `shared/fs-utils.ts::pathExists` does not follow links.
- Git plugins run from per-commit copies made by `checkoutGitDirCopy` (only `.git` copied, then a
  checkout), so they contain whatever symlinks the commit has, real ones under system git.

**Constraints.** NFR-10 (write containment, re-anchored by url-source to the owning clone root).
D-PL2-17 already adopted Claude Code's read boundaries. A symlink-free copy step would be a new
materialization stage for every git plugin.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. Keep in-place roots and the current checks (writes: lstat refusal; reads: `realpath` per D-PL2-17). Add a cucumber fixture with an outside-pointing symlink in a git plugin and a marketplace, proving nothing outside is read or written. | No new stage; the read rules already match upstream's boundaries. | A plugin that relies on an inside symlink works in Pi as a link and in Claude Code as a copy (same content). | **Rec** for this phase. |
| B. `Claude Code` copy rules: make per-commit copies symlink-free (materialize inside, drop outside). | Closer to upstream's cache shape. | A new copy stage with its own budget and error rules; largest blast radius; belongs with Phase 7 or later. | Defer. |

**License a divergence needs.** A keeps D-14 (write refusal) and D-PL2-17 (read boundaries), both
recorded; the remaining difference (links kept as links) needs a `D-SG-NN` note.

**Recommendation.** Option A; NFR-10 needs no amendment: write checks stay lexical plus `lstat`
refusal (stricter than `realpath`), read checks already use `realpath`.

**Confidence.** MEDIUM (upstream copy loop seen as strings only).

**Reversibility.** Costly / preference (ask the maintainer) only if B is wanted in this milestone (a
scope call); A itself is reversible technical.

---

## The SHA-pin ladder and input refusals

**Claude Code behavior (`mCi`).**
1. Input guards before any git: `eLo(sha)`: `Invalid sha "<x>": must be a full commit hash (40 or 64 hex digits)` (regex `/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i`, so upper case passes here); `Invalid ref "<x>": cannot start with "-"`. The marketplace path refuses an upper-case SHA ref instead (`wCn`: `Refusing to clone: this marketplace's \`ref\` (<x>) looks like a commit id with capital letters...`). URL checks (`r$t`) prefix `Refusing to clone. ` / `Refusing to query. `.
2. `clone --depth 1 [...submodule flags] --no-checkout -- <url> <dir>` (no `--branch` when a SHA is set).
3. `fetch --upload-pack=git-upload-pack --depth 1 origin <sha>`; on **any** non-zero exit
   `Shallow fetch of SHA <sha> failed, falling back to unshallow fetch`, then
   `fetch --upload-pack=git-upload-pack --unshallow [origin <ref>]` (`Failed to fetch commit <sha>: <stderr>`).
4. `checkout <sha>` (`Failed to checkout commit <sha>: ...`).
5. `tLo`: `rev-parse HEAD` must equal the SHA (case-insensitive), else
   `SHA pin verification failed: expected HEAD to be <sha>, got <x>. The pinned commit may have been removed upstream, or a ref with the same name exists. Refusing to install.`
HIGH.

**What git does (E3-PIN, git 2.43).**

| Case | Result |
|---|---|
| v2 (file:// and loopback HTTP), SHA not at any tip, not on the default branch | `fetch --depth 1 origin <sha>` rc 0. |
| v0, same SHA | `error: Server does not allow request for unadvertised object <sha>`, rc 1 (HTTP: rc 128). |
| v0 with server `uploadpack.allowReachableSHA1InWant=true` | rc 0. |
| v0, SHA reachable only from a tag | rc 0 (a tag tip is advertised). |
| unknown SHA, v2 | `fatal: remote error: upload-pack: not our ref <sha>`, rc 128. |
| v0 refusal, then `fetch --unshallow` with no ref, SHA on a non-default branch | rc 0 but the object is still missing: `checkout` fails `fatal: reference is not a tree: <sha>`. With `--unshallow origin dev` the commit arrives. |
| `--unshallow` on a complete repository | `fatal: --unshallow on a complete repository does not make sense`. |

**Pi today.** `clone-cache.ts::materializePluginClone`: full clone (single-branch when a ref hint is
given), `checkout <pin>`, and on `CommitNotFetchedError` after a ref-hint clone one `fetch --tags` and
a retry (PURL-04, INR-06); `PinnedCommitMissingError` (INR-03) otherwise. The comment "the clone left
the wildcard fetch refspec" is false for system git (PITFALLS E-19). `git-failure-kind.ts` maps
`not our ref` and `reference is not a tree:` to `commit-missing`; the v0 `Server does not allow request
for unadvertised object` line matches no row and becomes `failed`.

**Recommendation.** Parity: validate the SHA (40/64 hex; Pi may lowercase first, matching `tLo`'s
case-insensitive compare) and a leading `-` in `domain/` before git runs; fall back to `--unshallow`
on any failure of the shallow SHA fetch, as upstream, passing `origin <ref>` when the source has a
ref; then `checkout --detach <sha>` (Pi's `checkout` operand rule appends `--`) and verify
`rev-parse HEAD`. Map `commit-missing` after the last rung to `PinnedCommitMissingError`. Note in the
plan that an unpinned-ref-less source whose SHA lives only on a non-default branch fails on a v0 server
after `--unshallow` exactly as upstream does (parity, not a Pi bug). Optional, licensed by nothing:
`-c protocol.version=2` on the pin fetch (PITFALLS) — upstream does not pass it, and modern git
defaults to v2 anyway, so leave it out. Reversible technical.

**Confidence.** HIGH.

---

## Q2 interim (belongs to Phase 5): keeping the Device Flow scenarios green after the auth callbacks go

**Question.** Phase 3 deletes `platform/git-auth-callbacks.ts`. How do the eight scenarios of
`features/marketplace/device-flow.feature` stay green until Phase 5 decides Device Flow's fate?

**Claude Code behavior.** No token of its own and no Device Flow for git (FEATURES E-SG-13). HTTPS
clones rely on the user's credential helper, with prompts, askpass, and helper interaction turned off;
the failure message says `HTTPS authentication failed. Please ensure your credential helper is configured (e.g., gh auth login)` for github.com
(`Sbi`), and `your git credential helper has valid credentials for <host> (e.g., a personal access token)` elsewhere.
SSH relies on the agent. The only GitHub-connection path is the remote-session git proxy
(`remote: access denied by the git proxy`). HIGH.

**What changes under system git.**
- The scenarios' routing is an in-process patch of `https.request`/`fetch` in Pi's own process
  (`features/lib/github-device-flow/extension.ts`); a system git child does not pass through it, so
  the clone would go to real `github.com` (the redirect refuses non-loopback only inside Node).
- The request tables assume isomorphic-git's pattern (`GET info/refs` 401, `GET` 200, one `POST`);
  system git with protocol v2 sends `GET` plus two `POST`s per clone (E3-PIN server log), and with no
  helper and prompts off it fails after the 401 with `terminal prompts disabled`.
- git cannot call back into Node, so a Device Flow can only run **after** a failed git run
  (retry-after-failure), and the token must reach the retry through a credential helper.
- Credential keying follows the URL git sends (E3-Q8): a token approved for `github.com` is found
  only if git's request host is `github.com`.

**Options.**

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| A. Interim retry: on an `https-auth` `GitCommandError` for a registry host with no helper answer, run Device Flow, `git credential approve` the token (D-BG-1102, already done today), and rerun the git command once. Harness: route git with a loopback HTTPS `CONNECT` proxy (`https_proxy` in Pi's environment, the git host's certificate extended with a `github.com` name) so git's request host stays `github.com`. | Keeps every Device Flow scenario's meaning (the sign-in rows stay; git rows are re-baselined). Phase 5 deletes or keeps it with no wasted design. | The install scenario at `device-flow.feature:121` configures no credential store, so `approve` stores nothing and the retry fails; it needs a store Given or a Pi-owned one-shot helper (`-c credential.helper=` reset plus a helper that reads a 0600 file in the neutral dir: the token never goes into argv or a URL, Anti-Pattern 1). New harness proxy. | Rec if Phase 5 is likely to keep Device Flow. |
| B. Answer Q2 now (remove Device Flow, parity) and rewrite `device-flow.feature` into upstream-shaped credential-helper scenarios. | Parity; no interim code; FEATURES and SUMMARY already recommend removal. | Pulls Phase 5's whole blast radius (registry, `auth-host.ts`, the `fetch-chokepoint` exemption, keychain migration notice, D-PL8-12/AAP rewrites, READMEs) into the riskiest phase; Phase 5's discuss becomes moot. | Rec if the maintainer already leans to removal. |
| C. Tag the Device Flow scenarios as pending until Phase 5. | Least work. | Violates the milestone's green-gate and behavioral-test rules (a whole feature unpinned for two phases). | Not recommended. |

**License a divergence needs.** A is a temporary continuation of the existing divergence (D-79-04,
D-79-05, D-BG-1101); record it as an interim `D-SG-NN` that Phase 5 closes. B is parity; it needs the
Phase 5 decision taken early.

**Recommendation.** Ask the maintainer whether Q2 is already decided. If not, Option A, with the
CONNECT-proxy harness and a credential-store Given added to the install scenario (the helper file is
the fallback if the maintainer wants that scenario unchanged).

**Confidence.** HIGH for upstream and for git's credential keying; MEDIUM for the exact request rows
after the re-baseline (not run through the harness).

**Reversibility.** Costly / preference (ask the maintainer): it decides whether a user-visible
sign-in feature survives this phase and pre-empts Phase 5's discuss step.

---

## Research-flag verifications

### `git fetch --force` for moved tags
Verified (E3-Q9): only `--force` (or a `+` refspec) moves an existing local tag; `fetch origin <tag>`
updates `FETCH_HEAD` only; `fetch --tags` rejects with `would clobber existing tag`. Relevant only if
Q9 keeps an in-place refresh or Q10 B re-fetches tags into an existing clone (then use
`fetch --force --depth 1 origin '+refs/tags/*:refs/tags/*'`). HIGH.

### `origin/HEAD` across git versions
git 2.43 `fetch` never updates `origin/HEAD`; `followRemoteHEAD` is accepted and ignored on 2.43
(E3-Q9). isomorphic-git 1.44.10 `fetch` does update it (E-8 re-verified, Q5 row b). The config key's
introduction (2.48, from memory) is MEDIUM; do not depend on it. HIGH for 2.43 behavior.

### The isomorphic-git name matchers, and the kind each becomes
Three predicates, six call sites, plus the classifier's code checks and one test fake:

| Site | Today | System-git equivalent (E3-KIND, git 2.43, `LC_MESSAGES=C`) | Kind from `classifyGitExit` | Suggested handling |
|---|---|---|---|---|
| `orchestrators/marketplace/shared.ts:254` `isGitNotFoundError` at `:326` (`resolveRef refs/remotes/origin/<ref>` absent -> detached checkout of the stored ref) | `name === "NotFoundError"` | `rev-parse --verify --quiet --end-of-options <ref>^{commit}` | exit 1, empty stderr -> `no-stderr` (or, without `--quiet`, `fatal: Needed a single revision` exit 128 -> `failed`) | Run with `allowExit: [1]` and return `undefined`; no error kind needed. Moot if Q9 A deletes the function. |
| `orchestrators/plugin/clone-cache.ts:74` `isGitCommitNotFetchedError` at `:156`, `:176` (`checkout <pin>` lacks the commit) | `name === "CommitNotFetchedError"` | `checkout <sha> --` | `fatal: reference is not a tree: <sha>` exit 128 | `commit-missing` -> `instanceof GitCommandError && kind === "commit-missing"`; after the ladder's last rung, `PinnedCommitMissingError`. |
| `clone-cache.ts:79` `isGitNotFoundError` at `:320` (`copyMirrorAtCommit`: mirror lacks the SHA) | `CommitNotFetchedError` or `NotFoundError` | `checkout <sha> --` in the copy | `fatal: reference is not a tree:` | `commit-missing` -> return `undefined` (clone instead). |
| `clone-cache.ts:574` (`resolveFetchedRefOffline`: tracking ref absent) | `NotFoundError` | `rev-parse --verify --quiet` | exit 1, no stderr | `allowExit: [1]` -> `undefined`. |
| `clone-cache.ts:591` (`resolveLocalTagOffline`: local tag absent) | `NotFoundError` | `rev-parse --verify --quiet refs/tags/<t>^{commit}` (or one `for-each-ref`) | exit 1, no stderr | `allowExit: [1]` -> `undefined`. |
| checkout of an unknown ref name (any site) | `NotFoundError` | `checkout <name> --` | `error: pathspec '<name>' did not match any file(s) known to git` exit 1 | `local-ref-missing`. |
| `shared/git-failure-classifiers.ts:30,102,128` (`code === "HttpError"`, `UserCanceledError`, `code === "NotFoundError"`) | duck-typed codes | Phase 2 kinds | `https-auth`, `repository-not-found`, `network`, ... | Map from `GitCommandError.kind` (Phase 6 wording); keep the hosted `HostedManifestHttpError` row. |
| `test/platform/git-ops-fake.ts:75-76` | manufactures `NotFoundError` | — | — | Manufacture `GitCommandError` kinds, or return `undefined` per the new contract. |

Two gaps for the plan: the v0 refusal `error: Server does not allow request for unadvertised object`
(exit 1) classifies as `failed` (harmless if the ladder falls back on any failure, as upstream does);
and `rev-parse --verify` without `--quiet` prints `fatal: Needed a single revision` (classifies as
`failed`), so the local reads should use `--quiet` with `allowExit: [1]`. `git-process.ts`'s closed
`GitSubcommand` union has no `for-each-ref`, `symbolic-ref`, `remote`, `ls-files`, or `cat-file` yet;
each new verb needs its own operand rule (E7). HIGH.

### Every TAGS-01 caller
Listed under Q10 (Pi today): `probeMarketplaceTags` from `install-cascade.ts:928` and
`update-constraint-gate.ts:224`; the materializer `materializeMarketplaceTagClone` from
`install-outcome.ts:846` and `update-preflight.ts:557`; the mirror-local tag reads in
`clone-cache.ts:564-596` (not TAGS-01, same local-tag dependency); the offline proof
`test/architecture/marketplace-tag-probe-offline.test.ts`. HIGH.

---

## Summary table

| Question | Upstream answer (2.1.330) | Recommendation | Reversible / costly | Confidence |
|---|---|---|---|---|
| Q5 old clones | No position (never used isomorphic-git); upstream re-clones any checkout it does not trust | Re-clone on the next network operation (via Q9 A); drop `core.symlinks`/`ignorecase` on the copied `.git` before a copy checkout; nothing at load | Reversible technical | HIGH |
| Q8 GitHub base override | No variable; `github.com` hard-coded; user `insteadOf` respected | Keep D-MF-01 as `-c url.<base>/.insteadOf=https://github.com/` on every remote command | Reversible (A/B); costly if retired (C) | HIGH |
| Q9 update model | `ls-remote` check, re-clone into `..clone`, swap via `.bak`, recover a leftover `.bak`; follows moved default branch and tag by re-cloning | Adopt upstream for marketplaces and plugin mirrors | Reversible technical (large change) | HIGH |
| Q10 shallow vs TAGS-01 | Marketplace clone `--depth 1`; path-source tags read by `ls-remote --tags` of the marketplace remote at install/update; offline falls back to HEAD | Shallow plus a `--depth 1` tag fetch at add and after each re-clone (keeps NFR-5); or A (parity, NFR-5 amendment) | Costly / preference | HIGH |
| Q13 lock during clone | No lock around the clone; registry lock with 5 retries only around the JSON write | Keep the lock around the clone (D-04, GIT-03); async spawn required | Reversible technical | HIGH |
| Q14 autocrlf | Not set; user setting applies | Write `core.autocrlf=false` into Pi's clones to keep hash versions stable | Reversible technical | HIGH |
| Q14 default branch | Not tracked; re-clone follows the remote | No `origin/HEAD` reads after Q9 A; `remote set-head --auto` only if an in-place refresh remains; never `followRemoteHEAD` | Reversible technical | HIGH (MEDIUM on 2.48) |
| Q15 timeout | `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, finite `> 0`, cap 2147483647, default 120 000 ms; explicit plugin install 600 000 ms per command | Read the variable for every clone, fetch, and `ls-remote`; 120 s default for plugin clones too (SG-TRN-05) | Reversible technical | HIGH |
| Q16 KEEP on failure | `1/true/yes/on`; only on `unreachable` and with an existing `.claude-plugin/marketplace.json`; warn log, `kept-stale` | Same conditions; report unchanged with a warning note | Reversible technical | HIGH |
| Q19 symlinks | Clones keep git defaults; installed copies made symlink-free; path entries bounded by `realpath` + inode | Keep in-place roots and current checks; add an outside-symlink fixture; no NFR-10 amendment | Reversible (A); costly only if copy rules are pulled in | MEDIUM |
| SHA ladder | Validate SHA (40/64 hex) and refuse `-` refs before git; shallow SHA fetch, `--unshallow [origin <ref>]` on any failure, checkout, verify `HEAD` | Parity; map final `commit-missing` to `PinnedCommitMissingError` | Reversible technical | HIGH |
| Q2 interim | No Device Flow, helpers only (`gh auth login` hint) | Ask whether Q2 is decided; else interim retry-after-failure with `approve` and a CONNECT-proxy harness | Costly / preference | HIGH (MEDIUM on rows) |
| Moved tags / `--force` | n/a (re-clone) | Use `--force` only where a tag fetch lands in an existing clone | Reversible technical | HIGH |
| Name matchers -> kinds | n/a | `commit-missing`, `local-ref-missing`, or `rev-parse --verify --quiet` with `allowExit: [1]` | Reversible technical | HIGH |
