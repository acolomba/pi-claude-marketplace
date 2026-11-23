# Phase 3: System Git Transport and Clone Shape - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every `GitOps` operation in `platform/git.ts` runs on system git: clone,
fetch, checkout, ref and remote-ref resolution, tag listing and peeling, ref
update, current branch, and remotes. The custom HTTP redirect client and
`platform/git-auth-callbacks.ts` are deleted. Marketplace and git-source plugin
clones take Claude Code's shape: `--depth 1`, `--branch <ref>` when a ref is
set, and the SHA-pin ladder. `marketplace update` follows its remote the way
Claude Code does. A clone has a timeout, and the two upstream variables
`CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and
`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` work as they do upstream. A
clone that `isomorphic-git` made before the upgrade keeps working with no
manual step.

The `isomorphic-git` name matchers (`NotFoundError`, `CommitNotFetchedError`)
become `instanceof GitCommandError` checks with a `kind`. The cucumber request
tables are re-baselined once, here (Phase 1 counted 79 tables in 19 files, 59
of them smart-HTTP tables in 17 files). A load stays free of installation
changes and of the network (APL-D1, NFR-5).

Not in this phase: SSH sources and the transport probe (Phase 4), the fate of
Device Flow (Phase 5, Q2), failure wording (Phase 6), and removing the
`isomorphic-git` dependency (Phase 8). The requirements are SG-TRN-01 through
SG-TRN-07 and SG-MIG-01.

</domain>

<decisions>
## Implementation Decisions

The full upstream evidence records (Claude Code 2.1.330 binary, grepped
2026-11-23, never run; git 2.43.0 and isomorphic-git 1.44.10 experiments) are
in `03-EVIDENCE.md` in this directory. Each decision below cites its record.
Decisions with a `D-SG-NN` ID land in PROJECT.md Key Decisions under that ID.

### Asked (maintainer answered 2026-11-23)
- D-SG-09 (Q10, amends NFR-5, extends D-03-03; SG-TRN-04): upstream parity for version-range tag reads. Marketplace clones stay `--depth 1`, so they hold no tags. To resolve a path-source dependency that carries a version constraint, on install and on update, the extension runs `git ls-remote --tags -- <marketplace remote URL>` and keeps the `<name>--v<semver>` tags (the peeled `^{}` line when the tag is annotated), as Claude Code does (`03-EVIDENCE.md` C3 and Q10). The listing is memoized per URL for one command. If the listing fails or no tag satisfies the range, the install uses the marketplace's current copy, which is today's TAGS-02 fallback (`fellBackToCurrentCopy`) and upstream's "falling through to HEAD". The tag copy (`clone-cache.ts::materializeMarketplaceTagClone`) needs the chosen commit, so it fetches it with `fetch --depth 1 origin <sha>` in its staging directory. NFR-5 is amended: a path-source install or update with a constrained dependency may read the marketplace remote's tag list. `orchestrators/plugin/marketplace-tag-probe.ts` is already in `NETWORK_SEAMS`; `test/architecture/marketplace-tag-probe-offline.test.ts`, which proves the read is local, is inverted to prove the read goes to the marketplace remote. A cucumber scenario pins that a constrained path-source dependency gets its tag after `marketplace add`, and one pins that a tag pushed after the add is found at install. Declined: the recommended option B (a `--depth 1` tag fetch at add and after each re-clone, with no NFR-5 amendment). — **Reversibility:** costly — it amends a recorded network constraint and inverts an offline proof test; going back means a tag fetch at add and a second NFR-5 change.
- D-SG-10 (Q9, supersedes D-14's mechanism; SG-TRN-03): upstream's update model for marketplaces and plugin mirrors. An `ls-remote` freshness check (`HEAD`, `refs/heads/<r>`, `refs/tags/<r>^{}`, or `refs/tags/<r>`; a full-SHA ref compares with `HEAD` and runs no `ls-remote`) gives `current`, `stale`, or `unreachable`. On `stale` (or `unreachable` without D-SG-15), the extension restores a leftover `<dir>.bak` from an interrupted swap, deletes a leftover staging directory, clones into staging, renames the live checkout to `<dir>.bak`, renames staging to live, and deletes `.bak`. A failed move-in renames `.bak` back. `EBUSY`, `EPERM`, or `EACCES` on the move-aside keeps the existing copy, and the next update tries again (`03-EVIDENCE.md` C4 and Q9). A failed clone leaves the live checkout untouched. A moved default branch and a moved tag are followed because the re-clone reads the remote again. Staging lives in `sources-staging/` (D-09) and `.bak` beside the live checkout, both checked through `ScopedLocations` (NFR-10). D-14's user-visible contract stays: after `update`, the checkout matches the remote's ref, and D-23's "follow upstream" intent stands. `refreshGitHubClone` and its callers (`update.ts`, the PUP-2 sync in `update-flow.ts` and `update-preflight.ts`, `clone-cache.ts`'s mirror refresh) move to this model. The MU-5 "clone advanced" retry hint and UXG-05 `changed` detection are re-anchored on the swap. This is the largest code change of the phase. — **Reversibility:** costly — it replaces the refresh mechanism that every update path, the mirror refresh, and many request tables depend on; going back means a second rewrite.
- D-SG-12 (Q14 part, upstream parity): the extension leaves the user's `core.autocrlf` alone and writes no `core.autocrlf`, `core.eol`, or `core.symlinks` key into its clones, as Claude Code writes none (`03-EVIDENCE.md` Q14). The repository's `.gitattributes` applies as usual. Accepted consequence: on a host with `core.autocrlf=true` (the Git for Windows default), files of a path-source plugin check out with CRLF, so `domain/version.ts::computeHashVersion` gives a different hash version than `isomorphic-git` gave. After the upgrade, a reinstall or update on such a host reports a new version once, and two machines of one team can disagree. Declined: the recommendation to write `core.autocrlf=false` into every clone. — **Reversibility:** costly — writing the key later changes hash versions on CRLF hosts a second time.
- D-SG-14 (Q2 interim, until Phase 5): Device Flow keeps working through a retry after an auth failure. git cannot call back into Node, so when a git command fails with an `https-auth` `GitCommandError` for a registry host and no credential helper answered, the extension runs Device Flow where it runs today, stores the token with `git credential approve` (D-BG-1102), and runs the git command once more. The token never goes into argv or a URL. As today, the background autoupdate pass and an autoapply load run no Device Flow (D-PL8-12, AAP-D1). The cucumber harness routes git through a loopback HTTPS `CONNECT` proxy (`https_proxy` in Pi's environment, the git host's certificate extended with a `github.com` name), so git's request host stays `github.com` and the approved credential is found (credentials are keyed by the request host, `03-EVIDENCE.md` E3-Q8). The scenario "Installing a plugin from a private GitHub source with no cached clone signs in through Device Flow" (`features/marketplace/device-flow.feature`) sets up no credential store, so `approve` stores nothing; it gets a credential-store Given or a Pi-owned one-shot helper (planner's discretion, see below). The sign-in rows of the Device Flow scenarios keep their meaning, and their git request rows are re-baselined. Phase 5 still answers Q2 and closes or keeps this interim. Licensed as a temporary continuation of D-79-04, D-79-05, and D-BG-1101 (`03-EVIDENCE.md` Q2 interim). — **Reversibility:** costly — it decides whether a user-visible sign-in feature survives this phase; Phase 5 can still remove it.

### Decided autonomously
- [Old clones] Q: "What happens to a clone that `isomorphic-git` made before the upgrade (Q5 part, SG-MIG-01)?" → Selected: "D-SG-11: re-clone on the next network operation that touches it. Under D-SG-10, `marketplace update` and the plugin mirror refresh re-clone anyway, so old marketplace clones and mirrors need no extra code. The local copy step (`clone-cache.ts::checkoutGitDirCopy`, used by per-commit copies and release-tag copies) drops `core.symlinks` and `core.ignorecase` from the copied `.git/config` before its checkout, so a copy made from an old clone writes real symlinks. Nothing runs at load (APL-D1, NFR-5). Evidence: `03-EVIDENCE.md` Q5 (an old clone is harmless until system git checks out into it; from then on new symlinks become text files)." — reversible technical: an internal migration with no user-visible surface once it works; in-place correction (option B) can replace it.
- [GitHub base URL] Q: "What becomes of `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (Q8, SG-TRN-07)?" → Selected: "D-SG-16: keep D-MF-01, carried as `-c url.<base>/.insteadOf=https://github.com/` on every remote command (clone, fetch, `ls-remote`) when the variable is set, with the same validation and the same GHB-03/GHB-04 errors. The recorded origin stays canonical, so the origin reset after a clone goes away. git keys credentials by the rewritten host, which keeps GHB-02 (the auth host is the override host, so Device Flow never fires under the override) with no code. The harness keeps working unchanged. Phase 4 must leave Pi's own `-c` out of its probe-skip check. Evidence: `03-EVIDENCE.md` Q8." — reversible technical: an internal mechanism with no user-visible change; an explicit wire URL (option B) can replace it.
- [State lock] Q: "Where does the state lock sit during a clone of up to 120 s (Q13)?" → Selected: "The lock stays around the clone (D-04, GIT-03). The git spawn must stay async, so the lock's `update` timer keeps it fresh; a unit row proves that the timer fires during a long fake clone. A second Pi on the same scope gets `StateLockHeldError` for up to the timeout (120 s, or the user's `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`). Upstream holds no lock around its clone (`03-EVIDENCE.md` C6); its lock scope is not user-visible. Evidence: `03-EVIDENCE.md` Q13." — reversible technical: a clone outside the lock can follow with no user-visible change beyond fewer lock errors.
- [Default branch] Q: "How is the default branch tracked (Q14 part)?" → Selected: "Not tracked. Once the re-clone of D-SG-10 lands, no code reads `refs/remotes/origin/HEAD` (today `refreshGitHubClone` and `resolveFetchedRefOffline` read it). A re-clone without `--branch` checks out the remote's current default. `remote.origin.followRemoteHEAD` is not relied on, because git 2.43 accepts and ignores it. If any in-place refresh remains, it uses `remote set-head origin --auto` in the network step, never at load. Evidence: `03-EVIDENCE.md` Q14 and Q5 row c." — reversible technical: no user-visible surface.
- [Timeout] Q: "Which timeout bounds a git command (Q15, SG-TRN-05)?" → Selected: "D-SG-13: `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` as upstream reads it (a finite number above 0, capped at 2147483647, else 120 000 ms) bounds every clone, fetch, and `ls-remote`, plugin clones included. Each command gets its own limit, so an `--unshallow` after a refused SHA fetch starts a fresh one. A timeout is the `timeout` kind with its limit, and the scope stays safe to retry. Evidence correction: upstream gives an explicit `/plugin install` 600 000 ms per git command (`03-EVIDENCE.md` C1); only its session-load install path uses the variable. Pi has no such split (installs run from commands, `apply`, and an autoapply load), SG-TRN-05 records 120 s, and one number is simpler to explain; the variable raises it. Error wording names the variable (Phase 6)." — reversible technical: a constant and one variable read.
- [Keep on failure] Q: "How does `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` work (Q16 part, SG-TRN-06)?" → Selected: "D-SG-15: as upstream. The value is true for `1`, `true`, `yes`, or `on` (trimmed, any case). It applies only when the freshness check gives `unreachable` (the `ls-remote` exited non-zero, for any reason) and the existing checkout has `.claude-plugin/marketplace.json`. The checkout is then kept, the marketplace reports as unchanged with a warning-level note that names the variable, and the confirmed commit is not recorded. A `stale` result is never kept, and a SHA ref skips the `ls-remote`, so the variable never applies to it. The background autoupdate pass does not report a kept checkout as an update. This phase owns the outcome kind; Phase 6 owns the row's wording. Evidence: `03-EVIDENCE.md` Q16." — reversible technical: one variable read and one outcome kind.
- [Symlinks] Q: "Does the extension adopt upstream's symlink-free copy, and do NFR-10 checks use `realpath` (Q19)?" → Selected: "Plugins keep running in place with today's checks. Writes refuse every symlink on the path through the `lstat` walk of `shared/path-containment.ts`; reads resolve links with `realpath` against Claude Code's boundaries (D-PL2-17, D-PL2-24). A cucumber fixture with a symlink that points outside, in a git plugin and in a marketplace, proves that nothing outside is read or written. NFR-10 needs no change. A plugin that relies on a symlink inside its tree works in Pi as a link and in Claude Code as a copy, with the same content. Evidence: `03-EVIDENCE.md` Q19 and correction C2." — reversible technical: no new stage; the copy rules can follow later (deferred).
- [SHA pins] Q: "How does a pinned plugin reach its commit (SG-TRN-02)?" → Selected: "Upstream's ladder. Before git runs, `domain/` refuses a SHA that is not 40 or 64 hex digits (lower-cased first, matching upstream's case-insensitive compare) and a ref that starts with `-`. Then `clone --depth 1 --no-checkout` with no `--branch`, `fetch --depth 1 origin <sha>`, and on any non-zero exit `fetch --unshallow`, plus `origin <ref>` when the source has a ref. Then `checkout --detach <sha>` (Pi's operand rule appends `--`), and `rev-parse HEAD` must equal the pin, else the `pin-mismatch` kind. A `commit-missing` after the last rung becomes `PinnedCommitMissingError` (INR-03). The classifier maps the protocol v0 refusal `Server does not allow request for unadvertised object` to a fitting kind (likely `commit-missing`) instead of `failed`. An unpinned, ref-less source whose SHA lives only on a non-default branch fails on a v0 server after `--unshallow`, as upstream does. No `-c protocol.version=2`. Evidence: `03-EVIDENCE.md` 'The SHA-pin ladder and input refusals' and C5." — reversible technical: internal command order with the same user-visible result as upstream.
- [Name matchers] Q: "What replaces the `isomorphic-git` name matchers?" → Selected: "`instanceof GitCommandError` with a `kind`, per the table in `03-EVIDENCE.md` 'The isomorphic-git name matchers': a checkout that lacks the commit is `commit-missing` (in `clone-cache.ts`, a retry rung for a pin, or `undefined` in `copyMirrorAtCommit`); an absent tracking ref or local tag is read with `rev-parse --verify --quiet` and `allowExit: [1]`, which returns `undefined`; a checkout of an unknown ref name is `local-ref-missing`; the `code` checks in `shared/git-failure-classifiers.ts` map from the kind, and the `HostedManifestHttpError` row stays; `test/platform/git-ops-fake.ts` manufactures `GitCommandError` kinds. The `marketplace/shared.ts` matcher goes with `refreshGitHubClone` (D-SG-10). Each new verb (`for-each-ref`, `symbolic-ref`, `remote`, `ls-files`, `cat-file`) gets its own operand rule in the closed `GitSubcommand` union." — reversible technical: internal error narrowing.

### Claude's Discretion
- For the Device Flow install scenario with no credential store: a credential-store Given, or a Pi-owned one-shot helper (`-c credential.helper=` reset plus a helper that reads a 0600 file in the neutral directory). The evidence prefers the Given; the helper is the fallback if the scenario must stay unchanged.
- Whether `checkoutGitDirCopy` rewrites the copied config or passes `-c core.symlinks=<probed> -c core.ignorecase=<probed>`, and whether it also drops `core.filemode` (the evidence did not test its effect on a fresh checkout; dropping it is harmless).
- What `resolveFetchedRefOffline` reads instead of `origin/HEAD` once mirrors re-clone.
- The staging directory name under `sources-staging/` and the `.bak` name, as long as both stay inside `<scopeRoot>/pi-claude-marketplace/` (NFR-10).
- Plugin clones' submodule flags: upstream picks `--recurse-submodules --shallow-submodules` or `--no-recurse-submodules` (C5); the evidence does not name the condition, so keep today's behavior (no submodules) unless the planner's research finds it.
- Wave split: the verbs and the `instanceof` matcher sites first, then the clone shape, pins, refresh, and old clones (ROADMAP note).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/git-process.ts` (Phase 2): async spawn, hardening builder, `local` and network lanes, `GitCommandError` with a closed `kind` union, per-request `timeoutMs` with a process-group kill.
- `orchestrators/marketplace/add.ts`: already clones into `sources-staging/<uuid>` and renames (D-09), the shape D-SG-10 reuses for update.
- `orchestrators/plugin/dependency-tag-probe.ts` (`listRemoteTags`, D-03-03): the existing network tag read for git-source dependencies, the model for the marketplace tag read of D-SG-09.
- `platform/git-credential.ts`: `git credential approve` through the git process module (D-BG-1102), used by the D-SG-14 retry.
- `features/lib/https-git-host/*`, `features/lib/hermetic-git.ts`: Phase 1 stand-ins; the `CONNECT` proxy of D-SG-14 joins them.

### Established Patterns
- `shared/github-base-url.ts::gitHubWireUrl`: today's in-process rewrite, replaced by the `insteadOf` key of D-SG-16.
- `shared/path-containment.ts` (lexical plus `lstat` refusal for writes) and `domain/manifest-containment.ts` (`realpath` for reads): unchanged (Q19).
- `transaction/with-state-guard.ts`: `retries: 0`, `stale: 10_000`, `update: 2_000`, not re-entrant.

### Integration Points
- `orchestrators/marketplace/shared.ts::refreshGitHubClone` and its callers (`update.ts`, `update-flow.ts`, `update-preflight.ts`, `clone-cache.ts::materializeOrRefreshPluginMirror`) move to D-SG-10.
- TAGS-01 callers: `probeMarketplaceTags` from `install-cascade.ts` and `update-constraint-gate.ts::probePathStageOne`; the materializer `materializeMarketplaceTagClone` from `install-outcome.ts` and `update-preflight.ts`; the offline proof `test/architecture/marketplace-tag-probe-offline.test.ts`.
- `clone-cache.ts`: `checkoutGitDirCopy`, `materializePluginClone` (the pin ladder), `seedSameRepoPluginMirrors` (copies a marketplace checkout, `.git` included; with shallow marketplaces the seeded mirror is shallow too), `resolveFetchedRefOffline`, `resolveLocalTagOffline`.
- `platform/git.ts::clone` (origin reset after an `isomorphic-git` clone goes away under D-SG-16); `platform/git-auth-callbacks.ts` and the custom HTTP redirect client are deleted.
- `features/marketplace/device-flow.feature` and `features/lib/github-device-flow/extension.ts` (the in-process `https.request`/`fetch` patch cannot see a git child process).
- `docs/output-catalog.md`: new rows for the kept-stale note (D-SG-15) and the timeout wording wait for Phase 6.

</code_context>

<specifics>
## Specific Ideas

Evidence-record summary (full records in `03-EVIDENCE.md`):

- C1: an explicit `/plugin install` gives each git command 600 000 ms; only the session-load path uses `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`. HIGH for the chain, MEDIUM that nothing wraps it.
- C2: upstream's plugin cache copy is symlink-free (links inside the root become copies, others are dropped). MEDIUM (strings).
- C3: upstream reads a path entry's tags with `ls-remote --tags` of the marketplace remote, during dependency install and plugin update, and falls through to HEAD when none satisfies. HIGH.
- C4 and Q9: `ls-remote` freshness check, re-clone into staging, swap through `.bak`, recovery of an interrupted swap, `EBUSY`/`EPERM`/`EACCES` keeps the copy. HIGH.
- C5: marketplace clone `--depth 1 --no-recurse-submodules [--branch <ref>]`; plugin clone `--depth 1`, `--branch <ref>` only without a SHA, `--no-checkout` with one. HIGH.
- C6: upstream holds no lock around a clone. HIGH.
- Q5: `isomorphic-git` clones carry `symlinks=false`, `ignorecase=true`, `filemode=false`; harmless until system git checks out into them (E3-Q5 rows d to f). HIGH.
- Q8: under `insteadOf`, the recorded origin stays canonical and credentials are keyed by the rewritten host; the rewrite must ride on every remote command. HIGH.
- Q10: a depth-1 clone has no tags; `ls-remote --tags` needs no clone; `--unshallow` costs about a full clone. HIGH (MEDIUM on real transfer cost).
- Q14: upstream sets no `autocrlf`; `fetch` on git 2.43 never moves `origin/HEAD`; `followRemoteHEAD` is ignored on 2.43. HIGH (MEDIUM on the 2.48 version).
- Q15: `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, finite above 0, cap 2147483647, default 120 000 ms. HIGH.
- Q16: `1|true|yes|on`, only on `unreachable` with an existing `.claude-plugin/marketplace.json`. HIGH.
- SHA ladder: v2 servers serve an unadvertised SHA; v0 refuses with `Server does not allow request for unadvertised object` (today classified `failed`); `--unshallow` without a ref does not fetch a commit that lives only on another branch. HIGH.
- Q2 interim: a system git child does not pass through the in-process routing patch; protocol v2 sends `GET` plus two `POST`s per clone, so the request tables change. HIGH (MEDIUM on exact rows).

Isolation note from the evidence: one E3-Q8 step sent one request, with no credential, to `https://github.com/repo.git` on purpose.

</specifics>

<deferred>
## Deferred Ideas

- Upstream's symlink-free plugin cache copy (C2, Q19 option B): a new materialization stage with its own budget and error rules; Phase 7 or later.
- A clone outside the state lock (Q13 option B): only if lock contention is reported.
- The fate of Device Flow (Q2): Phase 5, which closes or keeps D-SG-14.
- The other-transport retry of a GitHub marketplace refresh, and the SSH probe: Phase 4.
- Wording for the timeout, kept-stale note, and every new kind: Phase 6.
- Writing `core.autocrlf=false` into clones: declined (D-SG-12).
- A tag fetch at add and after each re-clone (Q10 option B): declined (D-SG-09).

</deferred>
