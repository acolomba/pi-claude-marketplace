# Phase 3: System Git Transport and Clone Shape - Research

**Researched:** 2026-11-23
**Domain:** replacing the `isomorphic-git` transport behind `GitOps` with system git (clone shape, SHA-pin ladder, re-clone-and-swap refresh, remote tag reads, Device Flow interim, cucumber re-baseline)
**Confidence:** HIGH for the code inventory and git behavior (read this session and run against git 2.43.0); MEDIUM for exact cucumber row counts after the swap (rule table measured, not run through the harness)

## Summary

The upstream questions are settled in `03-EVIDENCE.md` and locked in `03-CONTEXT.md`. This research adds three things the planner needs. First, an inventory of every `GitOps` member and free git function, every caller, and the system-git command each one becomes. Second, measured smart-HTTP request sequences (protocol v2 and v0) so the request-table re-baseline can be done by rule. Third, the traps the swap hits in this codebase: fallow, the request tables, the ownership marker, the credential store, and the `operationOf` text in cause chains.

The swap is not a one-file change. `GitOps` and its fake/contract are used by 29 test files. `refreshGitHubClone` has four production callers. Two of the three name-matcher sites hold logic that D-SG-10 deletes anyway. Deleting `platform/git-auth-callbacks.ts` removes the only producers of `CrossOriginChallengeError`, `TooManyRedirectsError`, `UserCanceledError`, and part of the `StoredCredentialRejectedError` path. Those feed GAUTH-04 cause lines that 3 feature files pin. Removing the last production `isomorphic-git` import also makes fallow report `isomorphic-git` as an unused dependency unless the dependency moves or is removed in this phase.

**Primary recommendation:** Run the phase in four waves. Wave 1 is additive groundwork: the git-process rows and fields, the classifier details, the harness `CONNECT` proxy and backend-error forwarding, and the domain input refusals. Wave 2 moves every `GitOps` verb onto system git and keeps D-14's in-place refresh as a short interim. That wave also switches the matcher sites to `instanceof`, deletes the HTTP client and auth callbacks, adds the D-SG-14 retry, D-SG-16 `insteadOf`, and D-SG-13 timeout, and re-baselines the clone and fetch rows. Wave 3 is the clone shape and refresh: `--depth 1`/`--branch`, the pin ladder, re-clone-and-swap with `.bak` recovery, KEEP, the D-SG-09 `ls-remote --tags` read, and the D-SG-11 copy step. Wave 4 holds the new behavior scenarios and the codebase-map and docs updates. Each wave ends with `npm run check`, cucumber included.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawning git, argv hardening, lanes, timeouts, kinds | platform (`git-process.ts`, `git-failure-kind.ts`) | — | D-SG-01: the only git spawn site; only `platform/git.ts` and `platform/git-credential.ts` may import it (BLOCK C `GIT_PROCESS_IMPORTERS`) |
| GitOps verbs on system git, `insteadOf` pair, timeout read, abort signal, Device Flow retry | platform (`platform/git.ts`) | shared (`github-base-url.ts` for GHB-03 validation) | Platform may import only `shared` (fallow zone); the retry needs only the auth bundle's `onAuthRequired` closure, which the orchestrator builds |
| Clone shape, pin ladder, mirror re-clone-and-swap, tag copy, D-SG-11 copy step | orchestrators (`plugin/clone-cache.ts`) | platform | Already a `NETWORK_SEAMS` file; install/update/reinstall reach it by entrypoint name |
| Marketplace freshness + re-clone-and-swap + `.bak` recovery + KEEP | orchestrators (`marketplace/shared.ts` replacing `refreshGitHubClone`) | persistence (`ScopedLocations` getters for staging and backup) | Shared by `marketplace update`, the PUP-2 sync, autoupdate, and mirror refresh |
| SHA / ref input refusals | domain (`domain/source.ts` or a new `domain/git-ref.ts`) | — | CONTEXT: "Before git runs, `domain/` refuses..." |
| Path-source constraint tag read | orchestrators (`plugin/marketplace-tag-probe.ts`) | platform (`listRemoteTags`, local tag list) | Already in `NETWORK_SEAMS`; D-SG-09 |
| Auth bundle and Device Flow | orchestrators (`auth-host.ts`) | domain (`github-auth.ts`), platform (`git-credential.ts`) | Unchanged owners; the bundle type moves off `git-auth-callbacks.ts` |
| Request-table and harness stand-ins | test harness (`features/lib/https-git-host`, `github-device-flow`) | — | Phase 1 stand-ins; the `CONNECT` proxy is new |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The full upstream evidence records (Claude Code 2.1.330 binary, grepped
2026-11-23, never run; git 2.43.0 and isomorphic-git 1.44.10 experiments) are
in `03-EVIDENCE.md` in this directory. Each decision below cites its record.
Decisions with a `D-SG-NN` ID land in PROJECT.md Key Decisions under that ID.

#### Asked (maintainer answered 2026-11-23)
- D-SG-09 (Q10, amends NFR-5, extends D-03-03; SG-TRN-04): upstream parity for version-range tag reads. Marketplace clones stay `--depth 1`, so they hold no tags. To resolve a path-source dependency that carries a version constraint, on install and on update, the extension runs `git ls-remote --tags -- <marketplace remote URL>` and keeps the `<name>--v<semver>` tags (the peeled `^{}` line when the tag is annotated), as Claude Code does (`03-EVIDENCE.md` C3 and Q10). The listing is memoized per URL for one command. If the listing fails or no tag satisfies the range, the install uses the marketplace's current copy, which is today's TAGS-02 fallback (`fellBackToCurrentCopy`) and upstream's "falling through to HEAD". The tag copy (`clone-cache.ts::materializeMarketplaceTagClone`) needs the chosen commit, so it fetches it with `fetch --depth 1 origin <sha>` in its staging directory. NFR-5 is amended: a path-source install or update with a constrained dependency may read the marketplace remote's tag list. `orchestrators/plugin/marketplace-tag-probe.ts` is already in `NETWORK_SEAMS`; `test/architecture/marketplace-tag-probe-offline.test.ts`, which proves the read is local, is inverted to prove the read goes to the marketplace remote. A cucumber scenario pins that a constrained path-source dependency gets its tag after `marketplace add`, and one pins that a tag pushed after the add is found at install. Declined: the recommended option B (a `--depth 1` tag fetch at add and after each re-clone, with no NFR-5 amendment). — **Reversibility:** costly — it amends a recorded network constraint and inverts an offline proof test; going back means a tag fetch at add and a second NFR-5 change.
- D-SG-10 (Q9, supersedes D-14's mechanism; SG-TRN-03): upstream's update model for marketplaces and plugin mirrors. An `ls-remote` freshness check (`HEAD`, `refs/heads/<r>`, `refs/tags/<r>^{}`, or `refs/tags/<r>`; a full-SHA ref compares with `HEAD` and runs no `ls-remote`) gives `current`, `stale`, or `unreachable`. On `stale` (or `unreachable` without D-SG-15), the extension restores a leftover `<dir>.bak` from an interrupted swap, deletes a leftover staging directory, clones into staging, renames the live checkout to `<dir>.bak`, renames staging to live, and deletes `.bak`. A failed move-in renames `.bak` back. `EBUSY`, `EPERM`, or `EACCES` on the move-aside keeps the existing copy, and the next update tries again (`03-EVIDENCE.md` C4 and Q9). A failed clone leaves the live checkout untouched. A moved default branch and a moved tag are followed because the re-clone reads the remote again. Staging lives in `sources-staging/` (D-09) and `.bak` beside the live checkout, both checked through `ScopedLocations` (NFR-10). D-14's user-visible contract stays: after `update`, the checkout matches the remote's ref, and D-23's "follow upstream" intent stands. `refreshGitHubClone` and its callers (`update.ts`, the PUP-2 sync in `update-flow.ts` and `update-preflight.ts`, `clone-cache.ts`'s mirror refresh) move to this model. The MU-5 "clone advanced" retry hint and UXG-05 `changed` detection are re-anchored on the swap. This is the largest code change of the phase. — **Reversibility:** costly — it replaces the refresh mechanism that every update path, the mirror refresh, and many request tables depend on; going back means a second rewrite.
- D-SG-12 (Q14 part, upstream parity): the extension leaves the user's `core.autocrlf` alone and writes no `core.autocrlf`, `core.eol`, or `core.symlinks` key into its clones, as Claude Code writes none (`03-EVIDENCE.md` Q14). The repository's `.gitattributes` applies as usual. Accepted consequence: on a host with `core.autocrlf=true` (the Git for Windows default), files of a path-source plugin check out with CRLF, so `domain/version.ts::computeHashVersion` gives a different hash version than `isomorphic-git` gave. After the upgrade, a reinstall or update on such a host reports a new version once, and two machines of one team can disagree. Declined: the recommendation to write `core.autocrlf=false` into every clone. — **Reversibility:** costly — writing the key later changes hash versions on CRLF hosts a second time.
- D-SG-14 (Q2 interim, until Phase 5): Device Flow keeps working through a retry after an auth failure. git cannot call back into Node, so when a git command fails with an `https-auth` `GitCommandError` for a registry host and no credential helper answered, the extension runs Device Flow where it runs today, stores the token with `git credential approve` (D-BG-1102), and runs the git command once more. The token never goes into argv or a URL. As today, the background autoupdate pass and an autoapply load run no Device Flow (D-PL8-12, AAP-D1). The cucumber harness routes git through a loopback HTTPS `CONNECT` proxy (`https_proxy` in Pi's environment, the git host's certificate extended with a `github.com` name), so git's request host stays `github.com` and the approved credential is found (credentials are keyed by the request host, `03-EVIDENCE.md` E3-Q8). The scenario "Installing a plugin from a private GitHub source with no cached clone signs in through Device Flow" (`features/marketplace/device-flow.feature`) sets up no credential store, so `approve` stores nothing; it gets a credential-store Given or a Pi-owned one-shot helper (planner's discretion, see below). The sign-in rows of the Device Flow scenarios keep their meaning, and their git request rows are re-baselined. Phase 5 still answers Q2 and closes or keeps this interim. Licensed as a temporary continuation of D-79-04, D-79-05, and D-BG-1101 (`03-EVIDENCE.md` Q2 interim). — **Reversibility:** costly — it decides whether a user-visible sign-in feature survives this phase; Phase 5 can still remove it.

#### Decided autonomously
- [Old clones] Q: "What happens to a clone that `isomorphic-git` made before the upgrade (Q5 part, SG-MIG-01)?" → Selected: "D-SG-11: re-clone on the next network operation that touches it. Under D-SG-10, `marketplace update` and the plugin mirror refresh re-clone anyway, so old marketplace clones and mirrors need no extra code. The local copy step (`clone-cache.ts::checkoutGitDirCopy`, used by per-commit copies and release-tag copies) drops `core.symlinks` and `core.ignorecase` from the copied `.git/config` before its checkout, so a copy made from an old clone writes real symlinks. Nothing runs at load (APL-D1, NFR-5). Evidence: `03-EVIDENCE.md` Q5 (an old clone is harmless until system git checks out into it; from then on new symlinks become text files)." — reversible technical: an internal migration with no user-visible surface once it works; in-place correction (option B) can replace it.
- [GitHub base URL] Q: "What becomes of `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (Q8, SG-TRN-07)?" → Selected: "D-SG-16: keep D-MF-01, carried as `-c url.<base>/.insteadOf=https://github.com/` on every remote command (clone, fetch, `ls-remote`) when the variable is set, with the same validation and the same GHB-03/GHB-04 errors. The recorded origin stays canonical, so the origin reset after a clone goes away. git keys credentials by the rewritten host, which keeps GHB-02 (the auth host is the override host, so Device Flow never fires under the override) with no code. The harness keeps working unchanged. Phase 4 must leave Pi's own `-c` out of its probe-skip check. Evidence: `03-EVIDENCE.md` Q8." — reversible technical: an internal mechanism with no user-visible change; an explicit wire URL (option B) can replace it.
- [State lock] Q: "Where does the state lock sit during a clone of up to 120 s (Q13)?" → Selected: "The lock stays around the clone (D-04, GIT-03). The git spawn must stay async, so the lock's `update` timer keeps it fresh; a unit row proves that the timer fires during a long fake clone. A second Pi on the same scope gets `StateLockHeldError` for up to the timeout (120 s, or the user's `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`). Upstream holds no lock around its clone (`03-EVIDENCE.md` C6); its lock scope is not user-visible. Evidence: `03-EVIDENCE.md` Q13." — reversible technical: a clone outside the lock can follow with no user-visible change beyond fewer lock errors.
- [Default branch] Q: "How is the default branch tracked (Q14 part)?" → Selected: "Not tracked. Once the re-clone of D-SG-10 lands, no code reads `refs/remotes/origin/HEAD` (today `refreshGitHubClone` and `resolveFetchedRefOffline` read it). A re-clone without `--branch` checks out the remote's current default. `remote.origin.followRemoteHEAD` is not relied on, because git 2.43 accepts and ignores it. If any in-place refresh remains, it uses `remote set-head origin --auto` in the network step, never at load. Evidence: `03-EVIDENCE.md` Q14 and Q5 row c." — reversible technical: no user-visible surface.
- [Timeout] Q: "Which timeout bounds a git command (Q15, SG-TRN-05)?" → Selected: "D-SG-13: `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` as upstream reads it (a finite number above 0, capped at 2147483647, else 120 000 ms) bounds every clone, fetch, and `ls-remote`, plugin clones included. Each command gets its own limit, so an `--unshallow` after a refused SHA fetch starts a fresh one. A timeout is the `timeout` kind with its limit, and the scope stays safe to retry. Evidence correction: upstream gives an explicit `/plugin install` 600 000 ms per git command (`03-EVIDENCE.md` C1); only its session-load install path uses the variable. Pi has no such split (installs run from commands, `apply`, and an autoapply load), SG-TRN-05 records 120 s, and one number is simpler to explain; the variable raises it. Error wording names the variable (Phase 6)." — reversible technical: a constant and one variable read.
- [Keep on failure] Q: "How does `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` work (Q16 part, SG-TRN-06)?" → Selected: "D-SG-15: as upstream. The value is true for `1`, `true`, `yes`, or `on` (trimmed, any case). It applies only when the freshness check gives `unreachable` (the `ls-remote` exited non-zero, for any reason) and the existing checkout has `.claude-plugin/marketplace.json`. The checkout is then kept, the marketplace reports as unchanged with a warning-level note that names the variable, and the confirmed commit is not recorded. A `stale` result is never kept, and a SHA ref skips the `ls-remote`, so the variable never applies to it. The background autoupdate pass does not report a kept checkout as an update. This phase owns the outcome kind; Phase 6 owns the row's wording." — reversible technical: one variable read and one outcome kind.
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

### Deferred Ideas (OUT OF SCOPE)
- Upstream's symlink-free plugin cache copy (C2, Q19 option B): a new materialization stage with its own budget and error rules; Phase 7 or later.
- A clone outside the state lock (Q13 option B): only if lock contention is reported.
- The fate of Device Flow (Q2): Phase 5, which closes or keeps D-SG-14.
- The other-transport retry of a GitHub marketplace refresh, and the SSH probe: Phase 4.
- Wording for the timeout, kept-stale note, and every new kind: Phase 6.
- Writing `core.autocrlf=false` into clones: declined (D-SG-12).
- A tag fetch at add and after each re-clone (Q10 option B): declined (D-SG-09).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SG-TRN-01 | Every `platform/git.ts` operation runs on system git behind `GitOps`; the HTTP redirect client and auth callbacks are gone | Verb inventory and command map (§GitOps inventory); removal list (§Removal list); matcher-site table (§Name matchers); request-table rule table (§Cucumber re-baseline) |
| SG-TRN-02 | `--depth 1`, `--branch <ref>`, SHA ladder with `--unshallow` fallback, `HEAD == pin`; `-`-refs and malformed SHAs refused before git | §Clone shape and pin ladder (argv verified on 2.43, v0/v2 behavior measured); §Pitfall "unshallow on a complete repository" |
| SG-TRN-03 | Marketplace update follows Q9's model, atomic and retry-safe, follows moved default branch and tag | §Re-clone-and-swap (D-SG-10) design, recovery, lock placement, ownership-marker pitfall, MU-5/UXG-05 re-anchoring |
| SG-TRN-04 | Tag-reading range resolution works with shallow clones (D-SG-09) | §Tag reads (TAGS-01 callers, URL derivation, path-marketplace local read, tag copy fetch verified on v0 and v2), inverted offline test |
| SG-TRN-05 | 120 s default, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | §Timeout reader (parse rules, per-command limit, local verbs), timeout scenario via the `hold` arm |
| SG-TRN-06 | KEEP on failure as upstream | §KEEP outcome (conditions, which failures count as `unreachable`, outcome kind, autoupdate) |
| SG-TRN-07 | GitHub base URL per Q8 (`insteadOf`), harness still reaches the stand-in | §D-SG-16 (`GitRequest` needs a Pi-owned `-c` field, GHB-03 read rule, `=` hazard, `FetchedUrlCause` kept) |
| SG-MIG-01 | Old `isomorphic-git` clones keep working | §Old clones (which paths check out into an old clone, `checkoutGitDirCopy` key drop, fixture recipe without `isomorphic-git`) |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Upstream parity is the default; divergences need a recorded ID or a Pi capability gap (D-SG-09..16 are recorded in PROJECT.md:2548-2555). [VERIFIED: .planning/PROJECT.md read via grep of D-SG rows]
- Never commit to `main`; merge, never rebase; commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- `npm run check` is the gate at each wave merge, the phase gate, and the handoff. `check:commit` (the hook) does **not** run cucumber, so a cucumber-breaking change is caught only at the wave gate (`.agents/skills/local-verification/rules/commands.md`). [VERIFIED: read this session]
- A user-visible `/claude:plugin` change ships with a cucumber scenario that fails without it (refusals, timeout, KEEP, moved branch/tag, interrupted update, old clones, tag after add, outside symlink).
- NFR-1 atomic writes; NFR-2 no restart; NFR-3 retry-safe; NFR-5 network policy (now amended by D-SG-09); NFR-10 containment; IL-2 output only through `notification-dispatch.ts`; APL-D1 a load changes nothing and reaches no network.
- `## Threat Flags` section in every plan SUMMARY.md.
- TypeScript strict; explicit return types; ESLint `sonarjs/cognitive-complexity` 15 and fallow `maxCognitive` 15 / `maxCyclomatic` 20 both gate; 100% direct coverage per source-test pair; one paired test per new source file.
- DI over test-only seams (CONVENTIONS "Dependency injection over test-only seams"): build `platform/git.ts` from an injected `GitProcess` rather than a module-global override.
- Comments cite durable IDs (D-SG-NN, NFR-N), never plan or wave numbers.
- `windows append --description` prefixed `[system-git]`.

## GitOps inventory: every operation, caller, and system-git command

Current `GitOps` (8 members) at `orchestrators/marketplace/shared.ts:167-215`: `clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`, `currentBranch`, `resolveRemoteRef`, `listRemotes`. Free functions in `platform/git.ts`: `listRemoteTags` (:768), `listTags` (:803), `resolveTagOid` (:845), `runWithGitAbortSignal` (:309). [VERIFIED: orchestrators/marketplace/shared.ts:167-236, platform/git.ts read this session]

`GitSubcommand` today, verbatim: `"clone" | "fetch" | "ls-remote" | "checkout" | "rev-parse" | "config" | "tag" | "update-ref" | "credential" | "version"`; operand rules verbatim: `clone`/`fetch`/`ls-remote`/`config`/`tag`/`update-ref`: `MARKER_RULE`; `rev-parse`: `VERIFY_MARKER_RULE`; `checkout`: `DASH_REFUSED_RULE`; `credential`/`version`: `NO_OPERANDS_RULE`; `ssh: true` only for `clone`, `fetch`, `ls-remote`. [VERIFIED: platform/git-process.ts:125-135, 321-332]

| Operation | Production callers (file:line) | System-git command (final state) | Lane | `SUBCOMMAND_RULES` row |
|---|---|---|---|---|
| `clone` (marketplace) | `marketplace/add.ts:889` (`gitStagingSteps.stage`); re-clone in the new refresh (D-SG-10) | `clone --depth 1 --no-recurse-submodules [--branch=<ref>] --end-of-options <wireOrCanonicalUrl> <stagingDir>` | network | existing `clone` |
| `clone` (plugin mirror, unpinned) | `clone-cache.ts:127` via `cloneIntoStaging` from `:500` | same shape, `--branch=<ref>` when the source has a ref | network | existing |
| `clone` (plugin pin) | `clone-cache.ts:127` via `materializePluginClone :247` | `clone --depth 1 --no-checkout --no-recurse-submodules --end-of-options <url> <staging>` (no `--branch` when a SHA is set, C5) | network | existing |
| `fetch` (pin ladder) | replaces `clone-cache.ts:160` (`fetch --tags` refetch) | `fetch --depth 1 --end-of-options origin <sha>`; on any non-zero: `fetch --unshallow --end-of-options origin [<ref>]` (cwd = staging) | network | existing |
| `fetch` (tag copy, D-SG-09) | new in `materializeMarketplaceTagClone` (`clone-cache.ts:944`) | `fetch --depth 1 --end-of-options origin <tagCommitSha>` in the staging copy, git marketplaces only | network | existing |
| `fetch` (D-14 refresh) | `marketplace/shared.ts:281` | **deleted** by D-SG-10 (interim only if Wave 2 keeps D-14) | — | — |
| `forceUpdateRef` | `marketplace/shared.ts:300,336` | **deleted** with `refreshGitHubClone` (interim: `update-ref --end-of-options <ref> <sha>`, local) | local | existing `update-ref` |
| `currentBranch` | `marketplace/shared.ts:294` | **deleted** (interim: `symbolic-ref --quiet --short HEAD`, allowExit `[1]` → undefined; new row) | local | new `symbolic-ref` (interim only) |
| `checkout` | `shared.ts:296,305,334,341`; `clone-cache.ts:154,162,291` | `checkout --detach <sha> --` (DASH_REFUSED_RULE appends `--`) | local | existing |
| `resolveRef` | `clone-cache.ts:542` (HEAD), `:572` (tracking ref); `shared.ts:290,311` | `rev-parse --verify --quiet --end-of-options <ref>^{commit}` with `allowExit: [1]` → `string \| undefined` | local | existing `rev-parse` |
| `resolveRemoteRef` | `clone-cache.ts:856,862` (`resolvePluginPin`) | `ls-remote --end-of-options <url> HEAD` or `<url> refs/heads/<r> refs/tags/<r> refs/tags/<r>^{}`; JS picks `refs/heads/<r>`, then peeled tag, then tag, then exact `<r>` | network | existing |
| freshness probe (new, D-SG-10) | new refresh function | same `ls-remote` as above but returns `undefined` when the ref is not advertised (→ `stale`) and throws on a non-zero exit (→ `unreachable`) | network | existing |
| `listRemotes` | `marketplace/add.ts:1712` (`recognizeLeftover`) | keep the fs pre-read (arms `not-a-repo`/`permission-denied`/`unreadable`), then `config --local --get-all --end-of-options remote.origin.url` (cwd = dir, allowExit `[1]` = no value) | local | existing `config` |
| `listRemoteTags` | `dependency-tag-probe.ts:126`; new in `marketplace-tag-probe.ts` | `ls-remote --tags --end-of-options <url>`; pair `refs/tags/X^{}` with `refs/tags/X`, prefer the peeled oid, drop `^{}` lines | network | existing |
| `listTags` + `resolveTagOid` | `marketplace-tag-probe.ts:97,106`; `resolveTagOid` also `clone-cache.ts:473,589` | replaced by one local list: `for-each-ref --format=%(refname:strip=2) %(objecttype) %(objectname) %(*objecttype) %(*objectname) --end-of-options refs/tags`; entries whose `*objecttype` is `tag` (tag of a tag) get `rev-parse --verify --quiet --end-of-options refs/tags/<n>^{commit}` | local | **new `for-each-ref`** (MARKER_RULE, verified below) |
| D-SG-11 key drop | new in `checkoutGitDirCopy` (`clone-cache.ts:282-292`) | `config --local --unset-all --end-of-options core.symlinks` and `core.ignorecase` (allowExit `[5]` = key absent) | local | existing `config` |
| `runWithGitAbortSignal` | `index.ts:352` via `marketplace/shared.ts:242` | keep the `AsyncLocalStorage` scope; `platform/git.ts` passes `gitAbortScope.getStore()` as `GitRequest.signal` on every network request (the run then rejects with kind `aborted`) | — | — |

Verified on git 2.43.0 this session (scratchpad `r3/`): `for-each-ref ... --end-of-options refs/tags` rc 0; `%(*objectname)` peels only one level (a tag of a tag shows `*objecttype tag`); `rev-parse --verify --quiet --end-of-options 'refs/tags/tot^{commit}'` peels fully; a missing ref gives rc 1 with empty stderr; `config --local --unset-all --end-of-options <absent key>` gives rc 5; `ls-remote --tags` prints fully peeled `^{}` lines (a tag of a tag peels to its commit); `symbolic-ref --quiet --short --end-of-options HEAD` rc 0, detached HEAD rc 1; `cat-file -e --end-of-options 'HEAD^{commit}'` rc 0. [VERIFIED: local git 2.43.0 experiment]

**Recommendation on new verbs:** add only `for-each-ref` to the closed union (it has a production caller at phase end). Add `symbolic-ref` only if Wave 2 keeps the D-14 interim, and delete it in Wave 3. `remote`, `ls-files`, and `cat-file` have no caller under D-SG-10 (re-clone, no `set-head`; a missing commit shows as `commit-missing` from `checkout`), so leave them out. CONTEXT lists them as candidates, not requirements. Every row needs both columns (`operands`, `ssh: false`) and a corpus/rule row in `test/platform/git-process.test.ts` (02-07 SUMMARY "Lines for later plans"). [VERIFIED: 02-06/02-07 SUMMARY read this session]

### Required `git-process.ts` extension: Pi-owned `-c` pairs

D-SG-16 needs `-c url.<base>/.insteadOf=https://github.com/` on clone/fetch/ls-remote. `GitRequest` has no config field. `options` go **after** the subcommand, and `gitArguments` emits `[...rules.config, ...PIN_PAIRS, ...lane pairs]` as `-c` before the subcommand (`platform/git-process.ts:749-756`). Add `readonly config?: readonly string[]` to `GitRequest` and append it after the lane pairs. Do not route it through `GIT_CONFIG_COUNT`: the module deliberately keeps the user's `GIT_CONFIG_COUNT` (git-process.ts:30-32), so appending would need index merging. [VERIFIED: platform/git-process.ts:138-159, 749-756]

## Clone shape and pin ladder (SG-TRN-02)

Argv verified on git 2.43.0 (`file://` repo, scratchpad `r3/`): `clone -q --depth 1 --no-recurse-submodules --branch=dev --end-of-options <url> <dir>` rc 0; `clone --depth 1 --no-checkout --no-recurse-submodules --end-of-options <url> <dir>`, then `fetch --depth 1 --end-of-options origin <sha>`, then `checkout --detach <sha> --` gives `HEAD == sha`; `fetch --unshallow --end-of-options origin` rc 0; `clone --branch=nope` → `fatal: Remote branch nope not found in upstream origin` (classifier row `remote-ref-missing`, git-failure-kind.ts:106). [VERIFIED: local experiment]

Prescriptive ladder (in `clone-cache.ts`, replacing `checkoutPinWithRefetch` :148-167 and `asPinnedCommitMissing` :175-177):

1. `domain/` refuses before any git run: SHA not `/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/` after lower-casing; ref starting with `-`. [CITED: 03-EVIDENCE.md "The SHA-pin ladder"] Pass `--branch` in the attached form `--branch=<ref>` as well. A single argv word cannot be read as a separate option, and that is defense in depth on top of the domain refusal.
2. `clone --depth 1 --no-checkout --no-recurse-submodules` (no `--branch`).
3. `fetch --depth 1 origin <sha>`. On **any** `GitCommandError`, `fetch --unshallow origin [<ref>]`. Skip rung 3b when `rev-parse --is-shallow-repository` prints `false` (see Pitfall 3).
4. `checkout --detach <sha> --`. A `commit-missing` here → `PinnedCommitMissingError(pin)` (INR-03).
5. `rev-parse --verify --quiet HEAD` must equal the lower-cased pin, else throw `GitCommandError({kind: "pin-mismatch"}, ...)`. `pin-mismatch` already exists in the union (errors.ts:1328) and maps to `source missing` in `GIT_FAILURE_ANSWERS`. [VERIFIED: shared/errors.ts:1308-1336, shared/git-failure-classifiers.ts read this session]

Protocol behavior measured against a loopback `git http-backend` (the evidence's `tools/githttp.mjs`) [VERIFIED: local experiment]:

| Command | v2 requests | v0 (`-c protocol.version=0`) requests |
|---|---|---|
| `clone --depth 1` (any `--branch`, `--no-checkout`) | GET info/refs, POST, POST | GET, POST, POST |
| full `clone` | GET, POST, POST | — |
| `ls-remote <url> <patterns>` / `ls-remote --tags` | GET, POST | GET only |
| `fetch --depth 1 origin <sha>` (advertised or not, v2) | GET, POST, POST | unadvertised: GET only, then `error: Server does not allow request for unadvertised object <sha>` rc 1 |
| `fetch --unshallow origin` | GET, POST, POST | GET, POST, POST |
| auth: no helper answer (prompts off) | GET 401 → `fatal: could not read Username ... terminal prompts disabled` | — |
| auth: stored credential accepted | GET 401, GET 200, POST, POST (clone); GET 401, GET 200, POST (ls-remote) | — |
| auth: stored credential rejected | GET 401, GET 401 → `fatal: Authentication failed for '...'`; **git's `store` helper then erased the credential** | — |

A v0 shallow fetch of an annotated tag's **peeled** commit succeeds (rc 0), as does a fetch by tag name. A non-tip SHA is refused. So the D-SG-09 tag-copy fetch `fetch --depth 1 origin <sha>` works on v0 servers too. [VERIFIED: local experiment, file:// v0]

Classifier addition: add the v0 refusal `^error: Server does not allow request for unadvertised object ` → `commit-missing`, placed with the commit rows (git-failure-kind.ts:109). The ladder falls back on any failure anyway. The row matters for the final error when `--unshallow` also cannot bring the commit (a SHA only on a non-default branch with no ref, which upstream also fails). [VERIFIED: platform/git-failure-kind.ts:77-116]

**Submodules (discretion):** keep `--no-recurse-submodules` on every clone. `configPairs` already passes `submodule.recurse=false` (git-process.ts:244). SG-SUB-01/02 belong to Phase 7. [VERIFIED: platform/git-process.ts:237-256]

## Re-clone-and-swap (D-SG-10) design

Replace `refreshGitHubClone` (`marketplace/shared.ts:274-343`) and `refreshUrlClone` (:367-408) with one function. A suggested name and shape: `refreshCloneBySwap({ liveDir, source, gitOps, locations, auth, keepOnFailure })` returning `{ kind: "current" } | { kind: "replaced" } | { kind: "kept-stale" } | { kind: "kept-in-use" }`. The new name must be added to `NETWORK_SEAM_NAMES` in `eslint.config.js:106-107`, which today lists `refreshGitHubClone` verbatim: `"gitOps|DEFAULT_GIT_OPS|refreshGitHubClone|hostedManifestFetch|..."`. Otherwise BLOCK F stops gating the name. [VERIFIED: eslint.config.js:106-107]

Callers to move (all four):
- `marketplace/update.ts:467-488` (`refreshGitHubSource`) and `:555` (`refreshUrlClone`), inside `snapshotAfterRefresh`'s `withLockedStateTransaction`.
- `plugin/update-flow.ts:231-280` (`makeSyncCloneOnce`, PUP-2), inside `refreshFramed`'s `withExistingScopeLock`.
- `plugin/clone-cache.ts:539` (mirror refresh in `materializeOrRefreshPluginMirror`).
- `update-preflight.ts` reaches the sync through `update-flow.ts`.

Algorithm (upstream `wbi` + `$Ft`, `03-EVIDENCE.md` Q9):
1. Freshness: a full-SHA ref compares local `rev-parse HEAD` with the ref (no network). Otherwise run `ls-remote` for `HEAD`, or for `refs/heads/<r>`, `refs/tags/<r>^{}`, `refs/tags/<r>`. Exit non-zero → `unreachable`. Ref not advertised → `stale`. Equal to local `HEAD` → `current`, else `stale`. A missing or unreadable local `HEAD` → `stale`.
2. `current` → return, no write. `unreachable` + KEEP + `<live>/.claude-plugin/marketplace.json` exists → `kept-stale` (marketplaces only). Otherwise go on.
3. Recover: rename `<bak>` → `<live>`. On a non-ENOENT failure, if `<live>` lacks `.claude-plugin/marketplace.json` (mirrors: lacks `.git/HEAD`), remove `<live>` and restore. Then remove `<bak>`.
4. Clone into `sources-staging/<uuid>`, write the ownership marker (Pitfall 5), clone failure → clean staging, rethrow; live untouched.
5. `rename(live, bak)`: `EBUSY`/`EPERM`/`EACCES` → clean staging, `kept-in-use`. Then `rename(staging, live)`: failure → `rename(bak, live)`, rethrow. Then `rm(bak)`; a leak there is a warning, not a failure.

**Backup location (discretion).** Marketplace names may contain `.` (`assertSafeName` refuses only separators, control characters, `.` and `..`, domain/name.ts:35-66). So `sources/<name>.bak` can collide with a marketplace that is really named `<name>.bak`. Recommend a deterministic directory that no marketplace name can reach, under the extension root on the same filesystem: `sources-backup/<name>/` for marketplaces and `plugin-clones-backup/<key>/` for mirrors. Expose both through new `ScopedLocations` getters that run `assertSafeName` + `assertPathInside`, mirroring `sourceCloneDir` (persistence/locations.ts:360-366). Keep mirror backups out of `plugin-clones/`: `clone-gc.ts` deletes every `plugin-clones/` entry that is not a live key. [VERIFIED: domain/name.ts:35-66, persistence/locations.ts:355-387 read this session] [ASSUMED: that "beside the live checkout" in D-SG-10 allows a sibling directory under the extension root rather than a literal `<dir>.bak`; CONTEXT's discretion item allows any name inside `<scopeRoot>/pi-claude-marketplace/`]

**Re-anchoring.** MU-5: set `cloneAdvanced = true` only after `rename(staging, live)` succeeds (today it flips after `fetch`, update.ts:41-44, 543-570). UXG-05 stays content-based (`lastSuccessfulManifest` compare), so a `current` result or an identical re-clone reports `skipped {up-to-date}` with no extra code. `kept-stale` must not stamp `lastUpdatedAt` or `lastSuccessfulManifest` ("the confirmed commit is not recorded"). [VERIFIED: orchestrators/marketplace/update.ts:1-110, 380-720 read this session]

**`resolveFetchedRefOffline` after re-clones (discretion).** A depth-1 clone without `--branch` writes `refs/remotes/origin/HEAD` (a symref to `origin/<default>`). A `--branch <branch>` clone writes `refs/remotes/origin/<branch>` and no `origin/HEAD`. A `--branch <tag>` clone writes `refs/tags/<tag>` (and auto-follows other tags on that commit), a detached HEAD, and no tracking ref. Remote-tracking refs land in `packed-refs`, and `refs/heads/<branch>` stays loose. [VERIFIED: local experiment] So keep today's lookup order: no ref → `refs/remotes/origin/HEAD`; ref → `refs/remotes/origin/<ref>`, then `refs/tags/<ref>`. Each read is a `rev-parse --verify --quiet ...^{commit}` with `allowExit: [1]`. A miss → `undefined` → refresh. This also handles a mirror that was last cloned for another source's ref. Old `isomorphic-git` mirrors still answer through `origin/HEAD`. `git-source-probe.ts::readMirrorHeadSha` (fs-only, :54-87) already reads `packed-refs`. [VERIFIED: orchestrators/plugin/git-source-probe.ts:54-87]

**Lock (Q13).** The lock stays around freshness + clone + swap. `withLockedStateTransaction` uses `retries: 0, stale: 10_000, update: 2_000` (transaction/with-state-guard.ts:215-217). The unit row: a fake `GitOps.clone` that waits past one `update` interval (2 s) while holding the lock, then asserts the lock file's mtime moved, or that `onCompromised` never fired. `git-process.ts` spawns asynchronously through `runProcess`, so the event loop stays free. [VERIFIED: transaction/with-state-guard.ts:205-222]

## Tag reads (D-SG-09, SG-TRN-04)

Every TAGS-01 caller [VERIFIED: grep + reads this session]:
- `probeMarketplaceTags` (`marketplace-tag-probe.ts`) from `install-cascade.ts:928` (via `resolveMemberTagSource :820-847`, which already holds the marketplace `record`) and `update-constraint-gate.ts:224` (`probePathStageOne`, fed `options.marketplaceRoot`; memos from `update-preflight.ts:1182`, `update-flow.ts:792,827,1576`, `install-flow-dependency-ledger.ts:520,651`).
- The tag materializer `materializeMarketplaceTagClone` (`clone-cache.ts:944`) from `install-outcome.ts:846` and `update-preflight.ts:557`.
- Mirror-local tag reads `clone-cache.ts:564-597` (not TAGS-01; the same local-tag code).

Changes:
1. `MarketplaceTagProbeOptions` gains the marketplace source (or its derived wire URL) and the auth context. `resolveMemberTagSource` returns `{ kind: "path", marketplaceRoot, marketplaceSource }`. `UpdateConstraintOptions` gains the source as well.
2. Remote URL: for a `github`/`url` marketplace, `networkCloneUrl(parsed source)` (wire form) with the D-SG-16 `-c` pair and the auth bundle (`buildCloneAuth`). Memoize the listing per URL (D-SG-09), not per `marketplaceRoot` as today.
3. **Path (directory) marketplaces (recommendation):** read tags **locally** with `for-each-ref` on the local lane in `marketplaceRoot`. Upstream lists a `directory` marketplace with `ls-remote` of its `file://` href, which is a local read, so this gives the same tags. It also keeps a path-source install off the network lane (NFR-5, D-SG-02), and a user's `GIT_ALLOW_PROTOCOL` without `file` cannot break it. If git is missing, the listing fails → `tag-listing-failed` → TAGS-02 fallback, which is upstream's "falls through to HEAD" when ls-remote fails. [CITED: 03-EVIDENCE.md C3, Q10] [ASSUMED: that the maintainer accepts the local read for directory marketplaces as D-SG-09 parity; D-SG-09's text names only "the marketplace remote URL"]
4. Tag copy: copy `.git` → drop keys (D-SG-11) → for git marketplaces `fetch --depth 1 origin <sha>` (network, auth, `-c insteadOf`, timeout) → `checkout --detach <sha> --`. For a path marketplace, skip the fetch: the user's repository holds the commit locally. The copied `.git/config` holds the canonical origin (system-git clones record it; Q8), so `fetch origin` plus the `insteadOf` pair reaches the right host. `install-outcome.ts` must hand the auth inputs to the materializer. That needs no new `NETWORK_SEAMS` entry, because it reaches `clone-cache.ts` by entrypoint name.
5. A checkout with no index in a copied `.git` writes the full tree (git treats a missing index as an initial checkout). Verified for a target equal to HEAD and for a fetched older commit, with symlinks written as links. [VERIFIED: local experiment]

**Inverting `test/architecture/marketplace-tag-probe-offline.test.ts`.** Today it pins the probe's `platform/git` named imports to exactly `["listTags", "resolveTagOid"]` (it reads `MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS` from `gate-targets.ts:191`). Invert it to pin the set to the new network reader (for example `["listRemoteTags", "listLocalTags"]`), so the probe provably calls the remote listing. Rename the target constant away from "OFFLINE". The companion assertion (`domain/release-tag.ts` imports nothing from `platform/`) stays. Pin the "goes to the marketplace remote URL" behavior with a unit row in the probe's own test (a fake listing records the URL it was handed). [VERIFIED: test/architecture/marketplace-tag-probe-offline.test.ts:1-80]

**Cucumber.** No feature today pins a path-source dependency **selecting** a marketplace tag. All "dependency current copy" rows in `install-dependencies.feature` use dir marketplaces (56 "dir source" vs 1 "url source"), so those rows stay local and unchanged. Add the two D-SG-09 scenarios with a **url or github** marketplace: (a) after `marketplace add`, a constrained path dependency gets `<name>--v2.0.0`; (b) a tag pushed to the marketplace repository after the add is found at install. Rows: `ls-remote --tags` (GET, POST) then the tag-copy fetch (GET, POST, POST). [VERIFIED: grep of features this session]

## Device Flow interim (D-SG-14)

**Detection needs a structured detail.** SG-PRC-05 forbids narrowing on stderr text outside the classifier. D-SG-14 needs "no credential helper answered", and GAUTH-04 needs "the host rejected the stored credential". Today both stderr forms map to one kind (git-failure-kind.ts:88-91: `could not read (Username|Password)`, `terminal prompts disabled`, `Authentication failed for`, `returned error: 40[13]` → `https-auth`). Recommend splitting the https-auth outcome into a detail:
`{ kind: "https-auth"; detail: "no-credential" | "rejected" }`. `no-credential` for `could not read (Username|Password) for '` and `terminal prompts disabled`; `rejected` for `Authentication failed for '` and a 401/403 URL error. This moves `https-auth` out of the plain-kind arm of `GitFailure` (errors.ts:1316-1336), which the `satisfies Record<Exclude<...>>` in `git-failure-classifiers.ts` and its tests must follow. [VERIFIED: shared/errors.ts:1308-1336, platform/git-failure-kind.ts:88-91] Measured stderr: no helper → `fatal: could not read Username for 'http://127.0.0.1:18602': terminal prompts disabled`; rejected → `fatal: Authentication failed for 'http://127.0.0.1:18602/acme/tools.git/'`. [VERIFIED: local experiment]

**Where the retry lives.** Put it in `platform/git.ts`: one wrapper around each network request (clone, fetch, ls-remote). On `GitCommandError` with `kind === "https-auth"`, `detail === "no-credential"`, and `auth?.kind === "device-flow"`: `const result = await auth.onAuthRequired()`. `initiateDeviceFlow` already runs `credentialOps.approve` (domain/github-auth.ts:362). If `result.ok`, run the same request once more. Otherwise rethrow the original error. `DeviceFlowUnavailableError` (print mode) propagates as today. The command-scope `authMemo` already caps the flow at once per host (auth-host.ts `buildAuthForHost`). A clone retry needs its target directory absent or empty: git removes a directory it created when the clone fails, and a pre-created empty directory is reusable. [VERIFIED: orchestrators/auth-host.ts read this session; domain/github-auth.ts:362 via grep] [ASSUMED: git's cleanup of a failed clone's directory, from memory of `builtin/clone.c` `remove_junk`]

**GAUTH-04 lines (keep them in this phase).** `git-source.feature:235-298` pins `The operation was canceled., no credential was obtained ... git credential approve` (helper miss on a stored-credential host) and `{git host} rejected the stored credential` (`StoredCredentialRejectedError`). Recommend that `platform/git.ts` keep throwing `StoredCredentialRejectedError(host)` (with the `GitCommandError` as cause) for `https-auth/rejected` on a `stored-credential` bundle. `lacksStoredCredential` (`marketplace/shared.ts:418`) then keys on `https-auth/no-credential` + `stored-credential` instead of `UserCanceledError`. The `The operation was canceled.` link (isomorphic-git's `UserCanceledError` message) becomes the `GitCommandError` message. That is a cause-chain re-baseline, and Phase 6 owns the final wording. [VERIFIED: features/marketplace/git-source.feature:235-298]

**One-shot helper vs credential-store Given (discretion).** Recommend the **one-shot helper** for the retry, not only the Given. Today, on a machine with no credential helper, a Device Flow token is used directly in-process, so the operation succeeds. With only `approve` + retry, such a user signs in successfully and still gets `authentication required`: a product regression that a test-only Given would hide. Helper shape: write `username=x-access-token\npassword=<token>\n` to a 0600 file in the neutral directory (`platform/git-neutral-directory.ts`), run the retry with `-c credential.helper=` (reset) and `-c "credential.helper=!f() { cat <path>; }; f"` through the new `GitRequest.config` field, and delete the file in `finally`. The token is in neither argv nor a URL. The approved credential still reaches the user's own helper when they have one. The install scenario then stays unchanged. If the planner picks the Given instead, record the helper-less regression as an accepted interim in the SUMMARY. [ASSUMED: that `!`-prefixed helpers run through git's shell on Windows (Git for Windows bundles `sh`); the manual Windows check is already deferred to the PR per D-SG-04]

**Harness `CONNECT` proxy.** Device Flow scenarios run without the base override (`usePiWithProfile({ withoutGitHubBaseOverride: true, extraExtensions: [GITHUB_REDIRECT_EXTENSION] })`, git-host.steps.ts:319-338). The in-process patch (`features/lib/github-device-flow/extension.ts`) replaces `https.request`/`fetch` in Pi only, and a git child never passes through it. Build:
- `features/lib/github-device-flow/connect-proxy.ts`: an `http.createServer` `connect` handler. It tunnels `CONNECT github.com:443` to `127.0.0.1:<git host port>`, refuses every other target, and appends `{decision: "routed"|"refused", method: "CONNECT", url: "github.com:443", target: "git host"}` to the same `github-redirect.jsonl` log, so `Then pi routes these github requests:` can still prove nothing left the machine.
- Pi env: `https_proxy=http://127.0.0.1:<proxy port>` for the device-flow profile only. `test/architecture/hermetic-git-environment.test.ts` asserts exact key sets of `rpcChildEnvironment`, so that test must learn the new profile key.
- Certificate: `CERTIFICATE_ARGUMENTS` ends with `"subjectAltName=IP:127.0.0.1"` (features/lib/https-git-host/server.ts:57-58); make it `IP:127.0.0.1,DNS:github.com`. [VERIFIED: features/lib/https-git-host/server.ts:40-59]
- Node 24's own `fetch`/`https` ignore `https_proxy` unless `NODE_USE_ENV_PROXY` is set, and the patch replaces both anyway, so the sign-in rows are unaffected. [ASSUMED]
- The 7 `Then pi routes these github requests:` tables lose their git `GET/POST https://github.com/...git...` rows. Those become `CONNECT github.com:443` rows, one per git process; curl reuses one tunnel per process. [ASSUMED: one CONNECT per git process; measure once]

**Expected device-flow git rows after the swap** (add, no stored token): GET 401 (first git run, no helper answer), then after sign-in GET 401, GET 200, POST, POST (retry with the credential). Update after sign-in (D-SG-10): GET 401, GET 200, POST (freshness `ls-remote`) → `current` → `skipped {up-to-date}`. [VERIFIED: rows from local auth experiment; MEDIUM until run in the harness]

**Credential erase (flag for Phase 5).** When a helper-supplied credential is rejected, git calls `credential reject`, and the `store` helper **erased** it in the experiment. GAUTH-04's "a rejected credential stays stored" and SG-AUTH-03's "the extension never deletes a stored credential" can no longer hold as written: git does the delete, as it does under Claude Code. No feature asserts the store contents after a rejection (grep), so no scenario breaks. Record it in the Phase 3 SUMMARY as a GAUTH-04 change for Phase 5. [VERIFIED: local experiment + grep]

## D-SG-16, D-SG-13, D-SG-15, D-SG-11, D-SG-12 specifics

**D-SG-16 `insteadOf`.** Add a function to `shared/github-base-url.ts` that validates exactly as `readGitHubBase` does (GHB-03 errors) and returns `url.<base>/.insteadOf=https://github.com/`, or `undefined` when unset. `platform/git.ts` adds the pair only when the request's URL starts with `https://github.com/`, so a URL outside github.com never reads or validates the variable (shared/github-base-url.ts:73-90 contract). `fetch` runs in a clone whose recorded origin is canonical, so callers pass the canonical remote URL to `fetch` (or `platform/git.ts` reads it with one `config --get remote.origin.url`) to decide. Delete the origin reset after clone (platform/git.ts:605-609) and the explicit-url `fetch` override (:639). Keep `withFetchedUrlCause` (:493-512). It is pure JS, and GHB-01's `fetched https://...` cause line is pinned in 6 feature files. [VERIFIED: shared/github-base-url.ts read this session; grep counts this session]
- Hazard: git splits `-c name=value` at the first `=`. A base whose path contains `=` (WHATWG keeps `=` unescaped in a path) would build a broken key, and the rewrite would silently not apply, so requests would go to real github.com. Refuse `=` in the base as a GHB-03 reason, or assert in the new function that the base holds no `=`. [ASSUMED: git `-c` parsing splits at the first `=`, from memory of `git_config_parse_parameter`]

**D-SG-13 timeout.** Add one reader in `platform/` (a new `platform/git-timeout.ts` with its paired test, or a function inside `platform/git.ts`). Read `process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` on every call. A finite number above 0 → `Math.min(value, 2147483647)`, else `120_000`. Pass it as `timeoutMs` on every clone/fetch/ls-remote, one fresh limit per command (`run()` computes its own deadline, git-process.ts:1105-1107). For local verbs (checkout of a big tree, `rev-parse`, `for-each-ref`, `config`), use the same value: `GitRequest.timeoutMs` is required, and a short fixed limit could cut a large checkout. The cap matters because Node fires a `setTimeout` above 2^31-1 immediately. [CITED: 03-EVIDENCE.md Q15; VERIFIED: platform/git-process.ts:994-1003, 1105-1115]
- The hermetic test should also plant `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, so a developer shell that sets them cannot change a test. The suites build environments from scratch, so this only pins that.
- Scenario: `pi runs with ... CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS set to "1000"` (the profile env step pattern exists, `mcp-server/listing.steps.ts:126`), plus the existing `the git host holds the response body for ...` arm. The result is reason `network unreachable` (`GIT_FAILURE_ANSWERS.timeout`), no clone left, and a second run succeeds after `serves ... again`.

**D-SG-15 KEEP.** Truthy: trim, lower-case, one of `1|true|yes|on`. It applies only to marketplaces (not mirrors), only on `unreachable`, and only when `<live>/.claude-plugin/marketplace.json` exists. `unreachable` = the freshness `ls-remote` exited non-zero for a network/auth/timeout/not-found reason. Recommend **excluding** `git-missing`, `refused-input`, and `aborted` (an abort of the background pass must not become a "kept" success). Outcome: a new kind in the refresh result. `marketplace update` renders the marketplace row as not updated with a warning note naming the variable. The row needs a new token in the closed reason/notification sets (`closed-set-enrollment`, `notify-closed-set-locks`, `docs/output-catalog.md`). Phase 6 rewords it, but a placeholder must exist now. The background pass (`background-pass.ts`) must not count it as an update. [CITED: 03-EVIDENCE.md Q16] [ASSUMED: the excluded kinds; upstream says "any non-zero exit" but its git is always present]

**D-SG-11 old clones.** Under D-SG-10 nothing checks out **into** a live clone. The checkout runs only in copies: `checkoutGitDirCopy` callers are `copyMirrorAtCommit` (:317), `seedOnePluginMirror` (:722), and `materializeMarketplaceTagClone` (:974). So the key drop in `checkoutGitDirCopy` (clone-cache.ts:282-292) is the whole migration. A `current` freshness result leaves an old clone's `.git/config` as is, which is harmless: its files were written by `isomorphic-git` with real symlinks (Q5 row a), and nothing checks out into it. Unsetting `core.symlinks` lets the user's, system, or compiled default decide, as for a fresh clone. On Windows, Git for Windows sets `core.symlinks` in its system config. [CITED: 03-EVIDENCE.md Q5] [ASSUMED: Windows default; part of the deferred manual check]
- Fixture recipe without `isomorphic-git` (Phase 8 removes it): add with system git, then `git config core.symlinks false`, `core.ignorecase true`, `core.filemode false`, and `remote.origin.fetch +refs/heads/*:refs/remotes/origin/*` in the clone. Push a commit that adds a symlink. Run `marketplace update` (→ `stale` → re-clone) and assert a real symlink and no `core.symlinks` key. Do the same for a plugin mirror and for a release-tag copy made from such a marketplace clone.

**D-SG-12 autocrlf.** Nothing to write. Make sure no helper adds `--config core.autocrlf` anywhere, and note the CRLF hash-version consequence in the CHANGELOG at PR time.

## Removal list (SG-TRN-01)

| Item | Where | Notes |
|---|---|---|
| `isomorphic-git` + `isomorphic-git/http/node` imports | `platform/git.ts:5-6,19` | SC1: platform/git.ts imports nothing from isomorphic-git |
| HTTP redirect client (`http`, `requestWithinOrigin`, `sendHop`, `nextHop`, `raceAbort`, `abortableBody`, constants) | `platform/git.ts:214-484` | The abort scope moves to `GitRequest.signal` |
| `platform/git-auth-callbacks.ts` (270 lines) + `test/platform/git-auth-callbacks.test.ts` (545) | — | Move `AuthAttemptResult`, `OnAuthRequiredFn`, and the bundle union (`BuildAuthCallbacksOpts` → `GitAuthBundle`) to `platform/git-credential.ts` (credential concern, importable by `platform/git.ts` and by orchestrators as types). `GitCredentials` stays in `platform/git.ts` or moves alongside; `domain/auth-registry.ts:23` and `domain/github-auth.ts:50` import it type-only |
| `CrossOriginChallengeError`, `TooManyRedirectsError` | `shared/errors.ts` (~583, 619), `git-failure-classifiers.ts`, `marketplace/shared.ts` | Only the HTTP client throws them; fallow dead-code reports them once unused |
| isomorphic-git rungs in `classifyGitFailure` (`HttpError` code, `UserCanceledError`, `NotFoundError`, errno ladder) | `shared/git-failure-classifiers.ts:33-36,100-120,126-136,198-215` | Keep the `GitCommandError` arm, `PinnedCommitMissingError`, `StoredCredentialRejectedError`, `HostedManifestFetchError` |
| Name matchers | `marketplace/shared.ts:253-255` (goes with `refreshGitHubClone`); `clone-cache.ts:73-80` (`isGitCommitNotFetchedError`, `isGitNotFoundError`) at `:156`, `:176`, `:320`, `:574`, `:591` | `instanceof GitCommandError && kind === ...` per CONTEXT |
| `forceUpdateRef`, `currentBranch` (GitOps + platform) | shared.ts, platform/git.ts:890-919 | Deleted with D-14; `test/platform/git-ops-contract.ts` cases "force-updates a ref...", "returns the attached current branch", "returns undefined for a detached HEAD" go too |
| `listTags`, `resolveTagOid` | platform/git.ts:803-878 | Replaced by the local `for-each-ref` list |
| `isomorphic-git-chokepoint` rule | `rule-packs/architecture.json:102-109` | **Keep the rule and drop its `exclude`**, so no extension file may import isomorphic-git until Phase 8 deletes the dependency. The rule's `files` glob still matches files, so no rule-pack `WARN` [VERIFIED: rule-packs/architecture.json:100-111] |
| Tests importing isomorphic-git values | `test/platform/git.test.ts` (3050 lines, mostly redirect-client cases), `test/orchestrators/plugin/update-flow.test.ts:19,104`, `test/integration/auth-e2e.test.ts:29,55`, `test/orchestrators/plugin/reinstall-flow.test.ts:9`, `test/orchestrators/plugin/update-preflight.test.ts:8` | The production contract they mirror goes away in this phase. Rewrite them on system git (`test/platform/git-test-repository.ts`) |
| `gate-targets.ts:158-167`, `no-credential-leak.test.ts:104-109,579` | name `git-auth-callbacks.ts` | Update the subjects to the new files |
| `NETWORK_SEAMS` comments | `eslint.config.js:64-101` | Update reasons (`marketplace-tag-probe.ts` now reads the remote, D-SG-09; `shared.ts` owns the new refresh name) |

**Fallow consequence (key pitfall).** `npx fallow dead-code --trace-dependency isomorphic-git` reports one production importer, `platform/git.ts`. After the swap, `fallow dead-code` (production mode) will report `isomorphic-git` as an **unused dependency** (`fallow/unused-dependency`: "Packages listed in dependencies that are never imported"), which fails `npm run fallow`. Choose one in this phase: move it to `devDependencies` while a test still imports it, or delete it once the tests above are rewritten. The second option pulls part of SG-CLS-01 forward, so ask the maintainer. [VERIFIED: fallow --trace-dependency and fallow explain run this session] [ASSUMED: that production mode reports it as soon as the last production import goes]

The three `fallow-ignore-next-line unused-export` markers on `createGitProcess`, `NODE_GIT_HOST`, `NODE_GIT_SPAWN` (git-process.ts:948,1134,1154) go stale if `platform/git.ts` imports any of them. Bind to `NODE_GIT_PROCESS` only, or remove the matching marker. [VERIFIED: platform/git-process.ts read this session]

## Name matchers → `instanceof` (wave-1-of-the-swap work)

| Site | Today | Replacement |
|---|---|---|
| `clone-cache.ts:156` (`checkoutPinWithRefetch`) | `isGitCommitNotFetchedError` → `fetch --tags` retry | Pin ladder; `checkout` `commit-missing` → `PinnedCommitMissingError` |
| `clone-cache.ts:176` (`asPinnedCommitMissing`) | name check | `err instanceof GitCommandError && err.kind === "commit-missing"` |
| `clone-cache.ts:320` (`copyMirrorAtCommit`) | `CommitNotFetched` or `NotFound` → `undefined` | `commit-missing` (and `local-ref-missing`) → `undefined` |
| `clone-cache.ts:574` (`resolveFetchedRefOffline`) | `NotFoundError` → fall back to tag | `resolveRef` returns `undefined` (`rev-parse --verify --quiet`, allowExit `[1]`) |
| `clone-cache.ts:591` (`resolveLocalTagOffline`) | `NotFoundError` → `undefined` | same `undefined` contract |
| `marketplace/shared.ts:326` | `NotFoundError` → detached checkout | deleted with `refreshGitHubClone` |
| `test/platform/git-ops-fake.ts:75-76` | manufactures `NotFoundError` | manufactures `GitCommandError` kinds / returns `undefined`; the contract (`git-ops-contract.ts`, 13 case names) runs against both the fake and the real system-git GitOps |

`createGitOpsFake` or the contract is used by **29** test files, and **40** test files name `gitOps`. Change the `GitOps` interface once, in one plan, and update the fake and contract in the same commit. [VERIFIED: grep counts this session]

## Cucumber re-baseline

Phase 1 counts (STATE.md): 79 `Then the git host receives these requests:` tables in 19 files; 59 tables in 17 files carry smart-HTTP rows; 20 hosted-only tables are unaffected; 7 `Then pi routes these github requests:` tables (device-flow); 2 inline `requestsSince` assertions in `features/step_definitions/marketplace/background-update.steps.ts` (68-70, 92-101); 49 `the git host receives no request` steps (unchanged). [VERIFIED: .planning/STATE.md:42-80]

Mechanical rule table (from the measurements above; the step compares the whole table with `deepStrictEqual`, git-host.steps.ts:340-347):

| Today's isomorphic-git rows | System git rows |
|---|---|
| clone/fetch success: `GET info/refs 200`, `POST git-upload-pack 200` | clone: GET, POST, POST. A plain `fetch` disappears from marketplace update and mirror refresh (D-SG-10); in its place a freshness `ls-remote` (GET, POST) and, when `stale`, a re-clone (GET, POST, POST) |
| `resolveRemoteRef` / `listRemoteTags` (`listServerRefs` v2): GET, POST | `ls-remote`: GET, POST (same) |
| pinned plugin: GET, POST (full clone + checkout) | GET, POST, POST (clone) + GET, POST, POST (SHA fetch) |
| auth, no credential: `GET 401` | `GET 401` (same) |
| stored credential rejected: `GET 401`, `GET 401` | `GET 401`, `GET 401` (same) |
| refused at first GET (404/503/dropped): single GET row | single GET row (same status) |

Cause-chain columns change in 10 feature files (grep for `HTTP Error:`, `socket hang up`, `fetched https`): `marketplace/{git-source,url-source,url-source-update}`, `plugin/{bootstrap,fetch,git-source,git-source-update,reinstall,url-marketplace-update}`. The `hook/tool-failure` hit is unrelated. The isomorphic-git texts (`HTTP Error: 404 Not Found`, `socket hang up`, `The operation was canceled.`) become `GitCommandError` messages, `git <operation> failed: <kind>, exit code <n>`. Keep the trailing `fetched https://{git host}/...` (GHB-01) link. [VERIFIED: grep this session]

**Pitfall in the new text:** `operationOf` is `subcommand` plus the **first Pi-owned option** (git-process.ts:891-893), so the visible link reads e.g. `git clone --depth failed: ...` or `git fetch --unshallow failed: ...`. Fix one option order for each command shape, and put the most meaningful flag first, before re-baselining, or the rows will churn again. [VERIFIED: platform/git-process.ts:889-893]

**Plan for the re-baseline.** Do it by rule, one feature file at a time, in the same wave as the code that changes the rows. Run each file with `npm run test:cucumber:profile -- --profile adapter features/<path>.feature`. The failure diff shows the actual table. Copy it only after checking it against the rule table above. Do not add a "print actual rows" mode to the step: that is test-only production surface for the harness, and it hides whether a row is right. Also fix the Phase 1 carry-over: `runHttpBackend` (features/lib/https-git-host/cgi.ts:172-206) rejects a non-zero `git http-backend` exit, so an upload-pack `not our ref` becomes HTTP 500. Forward the backend's own answer so the client sees `fatal: remote error: upload-pack: not our ref` → `commit-missing`. The `refuse-sha-want` arm exists in `server.ts` but has no step and no scenario yet. Add a `Given the git host refuses fetches by SHA for the {git repository}` step and the v0 ladder scenario. [VERIFIED: features/lib/https-git-host/cgi.ts:172-206; features/lib/https-git-host/server.ts:60-80]

## Architecture Patterns

### System flow after the swap

```
/claude:plugin marketplace update X ──► update.ts (lock held: D-04/Q13)
        │                                   │
        │                        refreshCloneBySwap(live, source, auth)
        │                                   │
        │              ┌── SHA ref? ──yes──► rev-parse HEAD (local lane) ──► current|stale
        │              └── no ──► ls-remote url HEAD|refs/... (network lane, -c insteadOf, timeout)
        │                              │ rc≠0 ──► unreachable ──► KEEP? ──► kept-stale (no record stamp)
        │                              │ https-auth/no-credential & device-flow ──► Device Flow ──► approve ──► retry once
        │                              ▼
        │                      current ──► return (no write)
        │                      stale ──► recover .bak ─► clone --depth 1 [--branch=] into sources-staging/<uuid>
        │                                              ─► write ownership marker
        │                                              ─► rename live→backup ─► rename staging→live ─► rm backup
        │                                                (EBUSY/EPERM/EACCES ─► kept-in-use; move-in fail ─► restore)
        ▼
  manifest re-read ─► UXG-05 content compare ─► notify (one call)

install <git plugin> ──► install-clone-probe ─► clone-cache
   unpinned: mirror (freshness/re-clone as above, no KEEP) ─► commit copy (checkoutGitDirCopy: drop keys, checkout --detach)
   pinned:   clone --depth 1 --no-checkout ─► fetch --depth 1 origin <sha> ─► (any fail) fetch --unshallow origin [<ref>]
             ─► checkout --detach <sha> -- ─► rev-parse HEAD == pin ─► rename into plugin-clones/<key>
   constrained path dep: ls-remote --tags <marketplace wire url> (git mp) | for-each-ref refs/tags (dir mp)
             ─► select tag ─► tag copy (.git copy, drop keys, fetch --depth 1 origin <sha> for git mp, checkout)
```

### Recommended module layout

```
extensions/pi-claude-marketplace/
├── platform/git.ts            # GitOps verbs on system git: request builders, ls-remote parsers, insteadOf,
│                              #   timeout, abort signal, Device Flow retry; built from an injected GitProcess
├── platform/git-credential.ts # + GitAuthBundle / AuthAttemptResult / OnAuthRequiredFn types (moved)
├── platform/git-timeout.ts    # (optional) CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS reader + paired test
├── platform/git-process.ts    # + GitRequest.config, + for-each-ref row
├── platform/git-failure-kind.ts # + https-auth detail, + v0 unadvertised row
├── domain/source.ts (or domain/git-ref.ts)  # SHA/ref refusals
├── orchestrators/marketplace/shared.ts      # GitOps (reshaped), refreshCloneBySwap replacing refreshGitHubClone/refreshUrlClone
├── orchestrators/plugin/clone-cache.ts      # ladder, mirror swap, D-SG-11 copy step, tag copy fetch
├── orchestrators/plugin/marketplace-tag-probe.ts # remote/local tag list by marketplace kind
└── persistence/locations.ts   # + backup-dir getters (assertSafeName + assertPathInside)
```

### Anti-patterns to avoid
- **Narrowing on stderr outside the classifier.** Every "which auth failure" decision reads `GitFailure` fields (SG-PRC-05).
- **A sync spawn or a busy wait anywhere on the clone path.** It starves the lock's `update` timer, and a second Pi then steals a stale lock (Q13).
- **Running git with no `timeoutMs` source.** Every request reads the one timeout reader. No hard-coded 120 000 constants spread around.
- **Putting the `insteadOf` pair in `options`.** Options go after the subcommand. It must be a `-c` before it (new `GitRequest.config`).
- **Checking out into a live clone.** Under D-SG-10 only staging copies are checked out, which is what makes D-SG-11 a one-site change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Spawning git, timeouts, kill trees | `child_process` calls in `platform/git.ts` | `NODE_GIT_PROCESS.run` | The chokepoint rule; hardening; process-group kill |
| Parsing git's failure text | regexes in orchestrators | `classifyGitExit` rows (+ details) | SG-PRC-05 |
| Atomic dir replace | copy-then-delete | two `rename`s on one filesystem + recovery (upstream `wbi`) | NFR-1/NFR-3 |
| Peeling tags | object reads in JS | `ls-remote` `^{}` lines / `for-each-ref %(*objectname)` + `rev-parse ^{commit}` | git peels fully |
| Path containment for staging/backup | `path.join` | `ScopedLocations` getters (`assertSafeName` + `assertPathInside`) | NFR-10 |
| URL rewrite | string surgery per call | `-c url.<base>/.insteadOf=` from one shared builder | D-SG-16; credential keying follows git |
| Credential storage | Pi-owned token store | `credentialOps.approve` (existing) and git's helpers | D-BG-1102 |

## Common Pitfalls

### Pitfall 1: fallow fails on the unused `isomorphic-git` dependency
**What goes wrong:** `npm run fallow` reports `unused-dependency` once `platform/git.ts` stops importing it. **How to avoid:** decide in the plan (devDependencies while tests use it, or delete with the test rewrites; maintainer question). **Warning sign:** `npx fallow dead-code` red right after the swap commit.

### Pitfall 2: request tables change twice
**What goes wrong:** with the D-14 interim in Wave 2, the update rows change in Wave 2 (fetch now GET+POST+POST) and again in Wave 3 (ls-remote + re-clone). **How to avoid:** either accept two re-baselines, or put the refresh swap into Wave 2 and drop the interim (no `update-ref`/`symbolic-ref` verbs, larger plan).

### Pitfall 3: `--unshallow` on a complete repository
**What goes wrong:** a fixture repository with a single commit clones complete at depth 1, so `fetch --unshallow` fails with `fatal: --unshallow on a complete repository does not make sense` (rc 128, classifies `failed`) and hides the real `commit-missing`. **How to avoid:** check `rev-parse --is-shallow-repository` first and skip the rung when it prints `false`. Then `checkout` gives `commit-missing` → `PinnedCommitMissingError`. Many cucumber fixture repositories have one commit. [VERIFIED: local experiment]

### Pitfall 4: `--unshallow` without a ref deepens only the cloned branch
A depth-1 clone narrows `remote.origin.fetch` to the one branch it cloned (`+refs/heads/main:refs/remotes/origin/main`). Pass `origin <ref>` when the source has a ref (upstream). A ref-less SHA on another branch fails on v0, as upstream does. [VERIFIED: local experiment + 03-EVIDENCE E3-PIN]

### Pitfall 5: the ownership marker lives inside `.git`
`ownershipMarkerPath` is `<cloneDir>/.git/<marker>` (add.ts:1673-1675), and `recognizeLeftover` refuses a leftover without it (MA-12/13). A re-cloned marketplace must get the marker written into staging before the swap. Otherwise the next `marketplace add` of a leftover reports `stale clone`. [VERIFIED: grep + read of add.ts:1673-1686]

### Pitfall 6: GAUTH-04 lines vanish silently
Without the `https-auth` detail, the `rejected the stored credential` and `no credential was obtained` lines (git-source.feature:235-298) disappear, and the rows still render `authentication required`, so only the cause-chain column fails. Keep both mappings explicit.

### Pitfall 7: insteadOf on `fetch` inside a clone
The recorded origin is canonical (`https://github.com/...`). A `fetch origin ...` without the `-c` pair goes to real github.com. The evidence leaked one request this way. Every remote command, `fetch` in the ladder and the tag copy included, must carry it. A unit row asserts the argv. [CITED: 03-EVIDENCE.md isolation note and Q8]

### Pitfall 8: KEEP masking an abort or a missing git
Count only real remote failures as `unreachable` (see D-SG-15 above), or the background pass reports a cancelled step as a kept success.

### Pitfall 9: a load reaching git
Nothing on `resources_discover` may call `GitOps`. Today `readOriginRemoteUrl` and `readMirrorHeadSha` are fs-only. Keep them fs-only; do not "simplify" them onto `rev-parse`. [VERIFIED: clone-cache.ts:607-639, git-source-probe.ts:54-87]

### Pitfall 10: edge "network door" counters
`installNetworkCounter` in 5 edge test files counts `https.request` calls to prove a clone went through the injected port (`test/edge/handlers/marketplace/add.test.ts:28-40`). Under system git a missed injection spawns git, and the counter stays 0, so the measured guard turns into a tautology. Re-anchor it, for example by pointing the test process `PATH` at a recording `git` stub, or state that the injected `gitOps` fake now carries the proof. [VERIFIED: test/edge/handlers/marketplace/add.test.ts:20-60]

## Code Examples

```typescript
// Source: platform/git-process.ts GitRequest (+ proposed config field)
const clone: GitRequest = {
  subcommand: "clone",
  lane: "network",
  config: insteadOfPairFor(url),            // [] or ["url.<base>/.insteadOf=https://github.com/"]
  options: ["--depth", "1", "--no-recurse-submodules", ...(ref ? [`--branch=${ref}`] : [])],
  operands: [url, stagingDir],               // MARKER_RULE inserts --end-of-options
  timeoutMs: gitTimeoutMs(),
  ...(signal !== undefined && { signal }),
};
```

```typescript
// Source: replacement for clone-cache.ts:574 (resolveFetchedRefOffline)
const result = await git.run({
  subcommand: "rev-parse", lane: "local", cwd: mirrorRoot,
  options: ["--verify", "--quiet"], operands: [`${trackingRef}^{commit}`],
  allowExit: [1], timeoutMs: gitTimeoutMs(),
});
return result.exitCode === 1 ? undefined : result.stdout.trim();
```

```typescript
// Source: D-SG-14 retry shape (platform/git.ts)
async function runWithAuthRetry(request: GitRequest, auth: GitAuthBundle | undefined): Promise<GitResult> {
  try {
    return await git.run(request);
  } catch (error: unknown) {
    if (!(error instanceof GitCommandError) || error.failure.kind !== "https-auth"
        || error.failure.detail !== "no-credential" || auth?.kind !== "device-flow") {
      throw error;
    }
    const minted = await auth.onAuthRequired();       // runs Device Flow + approve (github-auth.ts:362)
    if (!minted.ok) throw error;
    return git.run(withOneShotHelper(request, minted.cred)); // or plain retry if the Given route is chosen
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| isomorphic-git full clone, in-process HTTP client, `onAuth` callbacks | system git, `--depth 1`, git's own credential helpers | this phase (D-SG-01 reversed D-21) | request rows, cause chains, credential behavior |
| D-14 fetch → `update-ref` → checkout | `ls-remote` freshness → re-clone → swap | D-SG-10 | moved default branch and moved tags followed; no lock files left in live trees |
| local TAGS-01 read of marketplace clone | `ls-remote --tags` of the marketplace remote | D-SG-09 | NFR-5 amended; offline install falls back to the current copy |
| `origin/HEAD` default-branch tracking | not tracked | D-SG-10 | git 2.43 `fetch` never moves `origin/HEAD`; isomorphic-git did |

**Deprecated/outdated:** `remote.<name>.followRemoteHEAD` (ignored on 2.43; never rely on it). `-c protocol.version=2` (not passed; upstream passes none).

## Suggested wave split

| Wave | Plans (parallel within a wave) | Gate |
|---|---|---|
| 1 groundwork | (a) `git-process.ts` `GitRequest.config` + `for-each-ref` row; `git-failure-kind.ts` https-auth detail + v0 row; classifier table follow-up; (b) harness: backend error forwarding, `refuse-sha-want` step (needs a scenario, so pair it with (c) or Wave 3), `CONNECT` proxy module + cert SAN + architecture test; hermetic test plants the two new variables; (c) domain refusals for SHA/leading `-` ref + cucumber "refused before git runs" scenarios (pass on the old transport too) | `npm run check` |
| 2 the swap | one plan, or two sequential plans with the GitOps reshape first: `platform/git.ts` on system git (all verbs, `insteadOf`, timeout, abort signal, D-SG-14 retry + GAUTH-04 mappings), auth types moved, auth callbacks + HTTP client + redirect errors deleted, matcher sites to `instanceof`, fake/contract on `GitCommandError`, isomorphic test imports removed, dependency decision (Pitfall 1), device-flow harness switched to the proxy, all request tables and cause chains re-baselined | `npm run check` |
| 3 shape and refresh | (a) `clone-cache.ts`: pin ladder, mirror swap, D-SG-11 copy step, `resolveFetchedRefOffline`, tag copy fetch; (b) `marketplace/shared.ts` `refreshCloneBySwap` + `update.ts`/`update-flow.ts` callers + backup getters + KEEP outcome + BLOCK F name; (c) D-SG-09 probe + inverted architecture test. (a) and (b) both touch `shared.ts`/`clone-cache.ts`, so run them sequentially or split by file ownership | `npm run check` |
| 4 scenarios and docs | new scenarios: v0 fallback, pin mismatch / missing pin, moved default branch, moved tag, interrupted update recovery (leftover backup/staging Given), KEEP, timeout, tag after add, tag pushed after add, old clone migration, outside-pointing symlink (git plugin and marketplace); codebase map (STACK/ARCHITECTURE/CONVENTIONS/INTEGRATIONS), PROJECT.md D-SG outcomes, AGENTS.md NFR-5 text (still lists amendments up to D-PL9-10) | phase gate `npm run check` |

If Pitfall 2 matters more than plan size, merge Wave 3(b) into Wave 2 and skip the D-14 interim.

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `state.json` marketplace records store `source`, `marketplaceRoot`, `lastUpdatedAt`, `lastSuccessfulManifest`; no git-transport field. Clones on disk: `sources/<name>/`, `plugin-clones/<key>/` made by isomorphic-git (full history, `core.symlinks=false`, `core.ignorecase=true`, `core.filemode=false`, wildcard refspec) | No data migration; D-SG-11 handles the clones lazily (re-clone on stale, key drop on copy). Nothing at load |
| Live service config | None. No external service holds transport config | None, verified by reading the transport surface |
| OS-registered state | Credentials Device Flow stored through `git credential approve` live in the user's helper (keychain, `~/.git-credentials`), keyed `protocol=https host=github.com` | No change. git's helpers find them by the same host. git may now erase a rejected one (flagged for Phase 5) |
| Secrets/env vars | `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (kept, D-SG-16); new reads `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` | Code only; the hermetic test plants the new names |
| Build artifacts | `isomorphic-git` in `package.json` dependencies and `package-lock.json` | Pitfall 1 decision (devDependencies or removal) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| git | everything | ✓ | 2.43.0 | — |
| Node | tests, Pi | ✓ (via `PATH="/opt/pi-claude-marketplace/bin:$PATH"`) | v24.22.3 | default `/opt/node22` is wrong for the engines range |
| openssl | git host / CONNECT cert | ✓ | 3.0.13 | — |
| `git http-backend` | harness, measurements | ✓ | `/usr/lib/git-core/git-http-backend` | — |
| ssh | Phase 4 only | ✗ | — | stub `ssh` on PATH (Phase 1) |
| fd | 5 known Glob cucumber scenarios | ✗ | — | known sandbox failures, not regressions; CI has it |

The sandbox injects `GIT_CONFIG_COUNT=3` with `url.https://github.com/.insteadOf` rewrites. The harness builds every environment from scratch (hermetic test), so experiments and tests must keep using the hermetic builders. Any ad-hoc git run needs those variables unset (as this research did).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit/integration), cucumber-js (behavioral, `adapter` + `builtin` profiles) |
| Config file | `package.json` scripts, `cucumber.json` |
| Quick run command | `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test <test-path>` |
| One pair's coverage | `npm run test:coverage:direct -- <source-or-test>` |
| One feature file | `npm run test:cucumber:profile -- --profile adapter features/<path>.feature` (then `builtin`) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-TRN-01 | each GitOps verb builds the right argv/lane/`-c`; contract passes on real system git and the fake | unit | `node --test test/platform/git.test.ts test/platform/git-ops-fake.test.ts` | ✅ (rewrite) |
| SG-TRN-01 | no isomorphic-git import in production; rule without exclude | static | `npm run fallow` | ✅ |
| SG-TRN-01 | marketplace/plugin features pass with re-baselined tables | cucumber | `npm run test:cucumber` | ✅ (rebaseline) |
| SG-TRN-02 | ladder order, `--unshallow` fallback, complete-repo skip, `HEAD==pin`, `PinnedCommitMissingError` | unit + real git | `node --test test/orchestrators/plugin/clone-cache.test.ts` | ✅ |
| SG-TRN-02 | refusals before git (no host request), v0 fallback via `refuse-sha-want` | cucumber | `npm run test:cucumber:profile -- --profile adapter features/plugin/git-source.feature` | ❌ new scenarios + step |
| SG-TRN-02 | domain SHA/ref validation | unit | `node --test test/domain/source.test.ts` (or new `git-ref.test.ts`) | ❌ Wave 1 |
| SG-TRN-03 | freshness → current/stale/unreachable; swap; `.bak` recovery; EBUSY keep; move-in rollback; ownership marker | unit | `node --test test/orchestrators/marketplace/shared.test.ts test/orchestrators/marketplace/update.test.ts` | ✅ (rewrite) |
| SG-TRN-03 | moved default branch, moved tag, interrupted update then success | cucumber | `features/marketplace/git-source.feature` / `url-source-update.feature` | ❌ new scenarios |
| SG-TRN-03 / Q13 | lock refresh timer fires during a long fake clone | unit | `node --test test/transaction/with-state-guard.test.ts` (or update.test.ts) | ❌ Wave 3 |
| SG-TRN-04 | probe calls `ls-remote --tags` of the marketplace wire URL, memo per URL, fallback on failure | unit | `node --test test/orchestrators/plugin/marketplace-tag-probe.test.ts` | ✅ (rewrite) |
| SG-TRN-04 | inverted import proof | architecture | `node --test test/architecture/marketplace-tag-probe-offline.test.ts` (renamed) | ✅ (invert) |
| SG-TRN-04 | tag after add; tag pushed after add | cucumber | `features/plugin/install-dependencies.feature` | ❌ new |
| SG-TRN-05 | timeout reader parse rows (unset, garbage, ≤0, cap) | unit | `node --test test/platform/git-timeout.test.ts` | ❌ new |
| SG-TRN-05 | hold arm + variable → timeout, scope retryable | cucumber | new scenario | ❌ |
| SG-TRN-06 | KEEP truthiness, the two conditions, excluded kinds, no record stamp, autoupdate not counted | unit | update.test.ts / background-pass.test.ts | ❌ rows |
| SG-TRN-06 | unreachable + variable keeps checkout | cucumber | new scenario | ❌ |
| SG-TRN-07 | `-c insteadOf` on every remote verb incl. ladder fetch and tag copy; GHB-03 errors; no pair for non-github URL | unit | `node --test test/platform/git.test.ts test/shared/github-base-url.test.ts` | ✅ (extend) |
| SG-TRN-07 | harness reaches the stand-in (existing scenarios) | cucumber | full suite | ✅ |
| SG-MIG-01 | `checkoutGitDirCopy` unsets `core.symlinks`/`core.ignorecase` (allowExit 5) | unit + real git | clone-cache.test.ts | ❌ rows |
| SG-MIG-01 | old-clone settings fixture → update → real symlink | cucumber | new scenario | ❌ |
| D-SG-14 | retry only for `https-auth/no-credential` + device-flow; once; memo; one-shot helper file 0600 removed | unit | git.test.ts | ❌ rows |
| D-SG-14 | Device Flow scenarios via the CONNECT proxy | cucumber | `features/marketplace/device-flow.feature` | ✅ (rebaseline) |

### Sampling Rate
- **Per task commit:** the owner test(s) plus `npm run check:commit` (the hook; it does not run cucumber).
- **Per plan that changes rows:** the touched feature files under both profiles.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`. In this sandbox, expect the 5 known `fd` Glob failures; record them, and do not wave them through as passes.

### Wave 0 Gaps
- [ ] `test/platform/git-timeout.test.ts` (if the reader gets its own module)
- [ ] domain refusal tests (`test/domain/...`)
- [ ] `features/lib/github-device-flow/connect-proxy.ts` + architecture test (pattern: `test/architecture/https-git-host-server.test.ts`)
- [ ] step `the git host refuses fetches by SHA for the {git repository}` and the old-clone, leftover-backup, marketplace-tag Given steps
- [ ] `persistence/locations.ts` backup getter rows in its test

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | git's credential helpers; Device Flow token through `approve` / a 0600 one-shot file, never argv or URL |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | domain SHA/ref refusal; `--end-of-options` operand rules; attached `--branch=`; GHB-03 base validation (+ refuse `=`) |
| V6 Cryptography | no | TLS is git/curl's; the harness CA only in tests |
| V12 Files and Resources | yes | `ScopedLocations` for staging/backup (NFR-10); `lstat` write refusal unchanged; outside-symlink fixture |
| V14 Configuration | yes | hardening `-c` pairs unchanged; Pi-owned `-c` only from code constants |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Option injection through a marketplace ref (`--upload-pack=...`) | Elevation | domain refusal of a leading `-` + `--branch=<ref>` attached + operands after `--end-of-options` |
| Token leak in argv, URL, or stderr | Info disclosure | helper file or `approve`; `GitCommandError.stderr` already passes `redactCredentials` |
| Rewrite to an attacker host via the base variable | Spoofing | GHB-03 validation; user-owned variable; refuse `=` |
| Symlink in a clone pointing outside | Tampering | `lstat` write refusal; `realpath` read boundaries; new fixture |
| Interrupted swap leaves no checkout | DoS | `.bak` recovery on the next refresh; lock around the swap |
| Test proxy leaking real traffic | Info disclosure | `CONNECT` proxy refuses every target but `github.com:443` and logs it |

## Package Legitimacy Audit

No package is installed in this phase. The only package change is the `isomorphic-git` move or removal (Pitfall 1). `npm view isomorphic-git version` → `1.44.19`; it is already in the lockfile. **Packages removed due to [SLOP]:** none. **Flagged [SUS]:** none.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A sibling backup dir (`sources-backup/<name>`) satisfies D-SG-10's "`.bak` beside the live checkout" | Re-clone-and-swap | Reword the plan to `<dir>.bak` and accept the name-collision edge |
| A2 | Directory marketplaces may read tags locally (`for-each-ref`) under D-SG-09 | Tag reads | If the maintainer wants a literal `ls-remote file://`, use the network lane for them |
| A3 | fallow production mode flags `isomorphic-git` as unused after the last production import | Removal list | None if wrong; the dependency simply stays |
| A4 | `!`-prefixed one-shot helper works on Windows | D-SG-14 | Fall back to the credential-store Given and record the helper-less regression |
| A5 | Node 24 fetch ignores `https_proxy` without `NODE_USE_ENV_PROXY` | D-SG-14 harness | Sign-in requests would go to the proxy; refuse non-git paths there |
| A6 | One `CONNECT` per git process | Cucumber | Row counts in the 7 routing tables |
| A7 | git `-c` splits at the first `=` | D-SG-16 | An extra refusal rule may be unnecessary (harmless) |
| A8 | `git-missing`, `refused-input`, `aborted` are not "unreachable" for KEEP | D-SG-15 | The background pass could report a kept checkout on abort |
| A9 | Windows `core.symlinks` default after unsetting matches a fresh clone | D-SG-11 | Copies on Windows without symlink rights; covered by the deferred manual check |
| A10 | git removes a failed clone's directory, so a clone retry starts clean | D-SG-14 | Pre-clean the staging dir before the retry |

## Open Questions (RESOLVED)

1. **Delete or demote `isomorphic-git` now?** We know fallow will likely flag it once production stops importing it. Unclear: whether Phase 3 may touch `package.json` dependencies (SG-CLS-01 is Phase 8). Recommendation: move it to `devDependencies` in Wave 2 if any test still needs it, else remove it, and ask the maintainer during planning.
   RESOLVED: `isomorphic-git` is removed from `dependencies` (and from `package-lock.json`) in 03-15, once no production, test, script, or features file imports it; it does not move to `devDependencies`.
2. **Keep the D-14 interim in Wave 2?** Fewer plans in Wave 3, but rows change twice and two verbs exist briefly. Recommendation: skip the interim if one plan can carry the refresh swap; otherwise keep it and delete `update-ref`/`symbolic-ref` use in Wave 3.
   RESOLVED: no interim D-14 on system git; the refresh goes straight to D-SG-10's re-clone and swap, for `marketplace update` in 03-07 and for the mirror refresh and the PUP-2 sync in 03-09 (03-06's real-git case checks that the old D-14 verbs still serve depth-1 clones until then).
3. **KEEP and kept-in-use row tokens.** Both need a closed-set token before Phase 6 rewords them. Recommendation: one new marketplace reason with warning severity, plus a diagnostic note naming the variable; register it in the closed-set tests and `docs/output-catalog.md`.
   RESOLVED: no new token; a kept checkout reuses the closed reasons `network unreachable` (D-SG-15) and `permission denied` (kept-in-use) with the existing cause shape, and Phase 6 owns the wording.
4. **Marketplace SHA `ref` today.** `clone --branch=<40-hex>` fails (`Remote branch ... not found`). SG-PIN-01 (Phase 7) owns the SHA path for marketplaces. Check that no current scenario adds a marketplace at a SHA ref; if one does, keep it on the plugin ladder path or mark it for Phase 7.
   RESOLVED: match upstream (maintainer decision): `marketplace add` refuses only a ref that looks like a commit id with capital letters, as Claude Code 2.1.330's `wCn` does (03-11); a lower-case 40- or 64-hex ref reaches git and fails clean as a missing ref, and working marketplace pins wait for SG-PIN-01 (Phase 7).
5. **GAUTH-04 credential survival.** git erases a rejected helper credential. Recommendation: accept (upstream parity), record it for Phase 5 (SG-AUTH-03 wording).
   RESOLVED: GAUTH-04 and SG-AUTH-03 stay unchanged in this phase; the erase is accepted as upstream parity, and 03-05's output carries the note for Phase 5.

## Sources

### Primary (HIGH confidence)
- `03-EVIDENCE.md` (Claude Code 2.1.330 records, git 2.43 / isomorphic-git experiments) — every upstream behavior cited
- Codebase reads this session: `platform/git.ts`, `platform/git-process.ts`, `platform/git-failure-kind.ts`, `shared/errors.ts:1306-1374`, `shared/git-failure-classifiers.ts`, `shared/github-base-url.ts`, `orchestrators/marketplace/{shared,update,add}.ts`, `orchestrators/plugin/{clone-cache,marketplace-tag-probe,dependency-tag-probe,update-constraint-gate,install-cascade,update-flow}.ts`, `orchestrators/auth-host.ts`, `platform/git-auth-callbacks.ts`, `transaction/with-state-guard.ts:205-222`, `rule-packs/architecture.json:100-120`, `eslint.config.js:40-130`, harness `features/lib/https-git-host/*`, `features/lib/github-device-flow/extension.ts`, `features/step_definitions/git-host.steps.ts`, `features/support/pi-process.ts`, `test/architecture/{marketplace-tag-probe-offline,hermetic-git-environment}.test.ts`
- Local experiments, git 2.43.0 (scratchpad `r3/`): shallow ref layout, argv with `--end-of-options`, missing-index checkout, v0/v2 request sequences, auth rows and credential erase, v0 peeled-tag fetch, `for-each-ref` peel depth, exit codes
- `npx fallow dead-code --trace-dependency isomorphic-git`, `npx fallow explain unused-dependency`

### Secondary (MEDIUM)
- Phase 1/2 records in `.planning/STATE.md` and the `02-0N-SUMMARY.md` "Lines for later plans"

### Tertiary (LOW)
- Assumptions A1-A10 above

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new packages; system git behavior measured)
- Architecture: HIGH (every caller located; the swap and ladder follow verified upstream records)
- Pitfalls: HIGH for git behavior, MEDIUM for harness row counts until run

**Research date:** 2026-11-23
**Valid until:** 2026-12-23 (stable; re-check if the git floor or the harness changes)

## RESEARCH COMPLETE
