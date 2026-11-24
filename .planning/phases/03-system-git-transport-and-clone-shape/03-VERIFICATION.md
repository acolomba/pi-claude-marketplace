---
phase: 03-system-git-transport-and-clone-shape
verified: 2026-11-24T18:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/03-system-git-transport-and-clone-shape/03-01-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-01-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-02-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-02-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-03-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-03-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-04-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-04-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-05-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-05-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-06-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-06-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-07-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-07-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-08-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-08-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-09-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-09-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-10-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-10-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-11-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-11-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-12-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-12-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-13-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-13-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-14-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-14-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-15-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-15-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-16-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-16-SUMMARY.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-17-PLAN.md
  - .planning/phases/03-system-git-transport-and-clone-shape/03-17-SUMMARY.md
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/platform/git-failure-kind.ts
  - extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts
  - extensions/pi-claude-marketplace/platform/git-process.ts
  - extensions/pi-claude-marketplace/platform/git-timeout.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/github-base-url.ts
covered_digest: "v4:sha256:b0cc2966aa0eda0e40f10c82acd904227b1cf75b827f835878b0eb0fedbfcca5"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Review the WR-02 classification change: a bare `The requested URL returned error: 401|403` line (no `Authentication failed for` line) now classifies as `https-auth` / `no-credential`, so it keeps the `authentication required` reason, adds the GAUTH-04 store-a-credential hint under a stored-credential bundle, and runs the Device Flow sign-in under a device-flow bundle."
    expected: "The maintainer accepts that a 403 a host returns after a helper's credential was sent (git prints the same line either way) reads as `no-credential` rather than `rejected`, and that the new scenario 'Updating a git marketplace whose host answers 403 before any credential is sent names the command that stores one' states the wording they want."
    why_human: "It is a judgement about which failure story is right for an ambiguous git message. git does not say whether a credential was sent, so no test can decide it. The fix commit (b69ad37) and 03-REVIEW-FIX.md both flag it."
  - test: "Run the manual macOS and Windows check of the git process module and the Phase 3 Windows branches (WINDOWS.md #120 and #121 from Phase 2, plus #122 to #125 from this phase) on the pull request."
    expected: "A copy of an old clone with `core.symlinks` unset checks out correctly on Git for Windows (#122); the `!`-prefixed one-shot credential helper runs under Git for Windows' sh (#123); a marketplace checkout or plugin mirror held open (EBUSY/EPERM on rename) is kept or failed and retried on the next command (#124, #125)."
    why_human: "CI and this sandbox run Linux only. Injected renames and a fake win32 host prove the branches, not Windows itself. The entries are `unrun-verify` rows in .planning/WINDOWS.md, deferred to the pull request by plan."
---

# Phase 3: System Git Transport and Clone Shape Verification Report

**Phase Goal:** Marketplaces and git-source plugins clone, fetch, refresh, and update on system git in Claude Code's shape, the custom HTTP client and the `isomorphic-git` auth callbacks are gone, and a clone that `isomorphic-git` made before the upgrade keeps working with no manual step.
**Verified:** 2026-11-24T18:00:00Z
**Status:** human_needed
**Re-verification:** No, initial verification
**HEAD:** 9a29f1e on `features/system-git`, working tree clean

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Every `GitOps` operation runs on system git; `platform/git.ts` imports nothing from `isomorphic-git`; the redirect client and `git-auth-callbacks.ts` are gone; cucumber tables re-baselined (SG-TRN-01) | VERIFIED | `grep -rn isomorphic extensions` returns nothing. `package.json` and `package-lock.json` hold no `isomorphic-git` (0 matches). `platform/git-auth-callbacks.ts` does not exist and `platform/` holds no redirect client. The `GitOps` interface in `orchestrators/marketplace/shared.ts:153` has `clone`, `fetchCommit`, `checkout`, `resolveRef`, `resolveRemoteRef`, `listRemoteTags`/`listLocalTags`, `listRemotes`, all backed by `gitProcess.run` calls in `platform/git.ts`. The `refreshGitHubClone`, ref-update and current-branch members were deleted with the D-14 verbs (D-SG-10); they have no callers, and only comments mention `refreshGitHubClone`. The rule pack `isomorphic-git-chokepoint` is now a total ban over `extensions/**` (`rule-packs/architecture.json:103`). No `NotFoundError`/`CommitNotFetchedError` name matcher remains; narrowing is `instanceof GitCommandError` plus `kind` (`add.ts:325`, `clone-swap.ts:222`, `clone-cache.ts:77`). The gate ran green on static, unpaired, integration and direct coverage. |
| 2   | Clone with `--depth 1` and `--branch <ref>`; a SHA pin ends with `HEAD` equal to the pin through `--unshallow` fallback; a `-` ref and a malformed SHA are refused before git runs (SG-TRN-02) | VERIFIED | `git.ts::clone` builds `--depth 1 --no-recurse-submodules [--no-checkout] [--branch=<ref>] [--single-branch]` through `runRemote`. `clone-cache.ts::cloneAtPin` runs the ladder: `clone --no-checkout` with no `--branch`, `fetchCommit` (`fetch --depth 1 origin <sha>`, then `--unshallow` only on a shallow clone, skipped for an abort), `checkout`, then `resolveRef HEAD === pin` else `pin-mismatch`; `commit-missing` becomes `PinnedCommitMissingError`. `domain/source.ts` refuses a sha that is not 40 or 64 hex (`FULL_SHA_RE`, after lower-casing) and a ref starting with `-` (`refRefusal`), turning the source `unknown` at parse time. `marketplace/add.ts:739-766` refuses a capital-letter commit-id ref before git. Cucumber: abbreviated-sha refusal, dash-ref refusal, the "refuses fetches by SHA" `--unshallow` scenario (03-10-01). Owner tests (`git.test.ts`, `source.test.ts`) pass. |
| 3   | `marketplace update` follows a moved default branch and moved tag; a failed or interrupted update leaves the previous checkout usable; the keep variable works; version-range resolution finds tags at the chosen depth (SG-TRN-03, -04, -06) | VERIFIED | `orchestrators/marketplace/clone-swap.ts` implements D-SG-10: `ls-remote` freshness (`current`/`stale`/`unreachable`, full-SHA ref compares `HEAD` and asks nothing), `recoverInterruptedSwap`, clone into a fixed staging dir, move live to `.bak`, move staging in, rename back on failure, `EBUSY`/`EPERM`/`EACCES` returns `kept-in-use`. `keepMarketplaceOnFailure` reads `1/true/yes/on` (trimmed, any case) and applies only on `unreachable` with a valid manifest. Wired from `update.ts:343-563`, `update-flow.ts:241-379` (PUP-2) and `clone-cache.ts` (mirror swap, `keepOnUnreachable: false`). Scenarios at `features/marketplace/git-source.feature:385` (default branch), `:423` (tag), `:460` (interrupted), `:489` (dropped), `:328` (checkout in use); keep and not-kept scenarios in `url-source-update.feature:66/92/130`. TAGS: `marketplace-tag-probe.ts` lists a git marketplace's tags with `ls-remote --tags` through `listRemoteTags`, a directory marketplace's with `for-each-ref`; the tag copy runs `fetchCommit` with `unshallow: false` (`clone-cache.ts:1091`); `test/architecture/marketplace-tag-probe-remote.test.ts` pins the import set; scenarios at `install-dependencies.feature:704` and `:735` (tag pushed after add). NFR-5 amendment is in AGENTS.md and PROJECT.md (D-SG-09). `clone-swap.test.ts` (in the 530 passing owner tests) passes. |
| 4   | A clone or fetch past 120 s, or past `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, fails as a timeout and is safe to retry; `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` keeps working and the harness reaches its stand-in (SG-TRN-05, SG-TRN-07) | VERIFIED | `platform/git-timeout.ts::gitTimeoutMs` reads trimmed decimal digits above 0, caps at 2147483647, else 120000, on every call. `runRemote` passes it as `timeoutMs`; `git-process.ts` throws `GitCommandError({kind:"timeout", timeoutMs})` (`:931`, `:1019`). `failed-add.feature:145` holds a clone past the variable's limit, expects `network unreachable` and a clean retry. D-SG-16: `gitHubInsteadOfPairs` emits `url.<base>/.insteadOf=https://github.com/` on every remote request, so the recorded origin stays canonical and the harness variable is still read (`features/support/world.ts`, `pi-process.ts`, `apply.feature`, `autoapply.feature` and others). `git-timeout.test.ts` and `github-base-url` cases pass. |
| 5   | A user with `isomorphic-git`-made clones needs no manual step: `/reload` succeeds, and after the next operation the clone has real symlinks and a correct checkout (SG-MIG-01) | VERIFIED | D-SG-11 (re-clone on the next network operation, recorded in PROJECT.md): a stale marketplace and every mirror refresh re-clone through the swap. `git.ts::checkout` with `fromCopiedGitDir` unsets `core.symlinks`, `core.ignorecase`, `core.filemode` first (exit 5 tolerated); both copy-from-clone sites in `clone-cache.ts` (`:299` per-commit copy, `:1101` tag copy) pass the flag. Scenarios: `features/marketplace/git-source.feature:535` (old clone, new session reports nothing and makes no request, then `marketplace update` re-clones and the linked skill works) and `:581` (remote has not moved: reported up to date, plugins still served); `features/plugin/git-source.feature:62` (old mirror, copy writes a link); `install-dependencies.feature:766` (tag copy of an old clone). The load runs nothing that touches git (APL-D1). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| SG-TRN-01 | 03-01, -03 to -06, -12, -13, -15, -16 | All `GitOps` on system git; HTTP client and callbacks gone | SATISFIED | Truth 1 |
| SG-TRN-02 | 03-02, -04, -06, -10, -11 | Upstream clone shape, SHA ladder, refusals before git | SATISFIED | Truth 2 |
| SG-TRN-03 | 03-07, -09, -11 | Update model (D-SG-10), atomic, retry-safe, follows moved branch and tag | SATISFIED | Truth 3 |
| SG-TRN-04 | 03-08 | Tag reads at the chosen depth, NFR-5 amended | SATISFIED | Truth 3, D-SG-09 |
| SG-TRN-05 | 03-04, -10 | 120 s timeout, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | SATISFIED | Truth 4 |
| SG-TRN-06 | 03-07, -10, -14 | Keep checkout on unreachable remote | SATISFIED | Truth 3 |
| SG-TRN-07 | 03-01, -05 | Base URL variable decided and the harness reaches its stand-in | SATISFIED | Truth 4, D-SG-16 |
| SG-MIG-01 | 03-04, -09, -14 | Old clones keep working, no manual step | SATISFIED | Truth 5, D-SG-11 |

No orphaned requirements: ROADMAP lists the same eight IDs and every one is claimed by at least one plan.

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `platform/git.ts` (system git `GitOps`) | VERIFIED | 889 lines, all verbs call `gitProcess.run`; no third-party git import |
| `platform/git-timeout.ts` | VERIFIED | Reader wired into `runRemote` and local verbs |
| `platform/git-one-shot-credential.ts` | VERIFIED | Origin-keyed pairs plus a `host=` check in the helper (CR-01 fix) |
| `orchestrators/marketplace/clone-swap.ts` | VERIFIED | Imported by `update.ts`, `update-flow.ts`, `clone-cache.ts` |
| `persistence/locations.ts` staging getters | VERIFIED | `sourceSwapStagingDir`, `pluginMirrorStagingDir` use `assertSafeName` and `assertPathInside` |
| `orchestrators/plugin/marketplace-tag-probe.ts` | VERIFIED | Remote listing for git marketplaces, local for directories |
| `platform/git-auth-callbacks.ts` | ABSENT (intended) | Deleted in 03-15 |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `git.ts::runRemote` | `git-timeout.ts` | `timeoutMs: gitTimeoutMs()` | WIRED |
| `git.ts::runRemote` | `github-base-url.ts` | `gitHubInsteadOfPairs(remote.url)` | WIRED |
| `git.ts::retryAfterSignIn` | `git-one-shot-credential.ts` | `withOneShotCredential(cred, origin, ...)`, host-bound | WIRED |
| `update.ts` / `update-flow.ts` | `clone-swap.ts::refreshCloneBySwap` | swap args with `keepOnUnreachable` | WIRED |
| `clone-cache.ts` mirror and tag copy | `checkout(..., fromCopiedGitDir)` | D-SG-11 key unset | WIRED |
| `marketplace-tag-probe.ts` | `platform/git.ts::listRemoteTags` | auth bundle of the marketplace host | WIRED |
| `domain/source.ts` | parse-time refusal | `shaRefusal`, `refRefusal` to `unknown` source | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Owner tests of the transport, timeout, source refusals, swap, one-shot helper and failure kinds (real git 2.43 cases included) | `node --import scripts/isolated-pi-home.mjs --test test/platform/git-timeout.test.ts test/platform/git.test.ts test/domain/source.test.ts test/orchestrators/marketplace/clone-swap.test.ts test/platform/git-one-shot-credential.test.ts test/platform/git-failure-kind.test.ts` | 530 tests, 530 pass, 0 fail | PASS |
| No isomorphic-git anywhere in the extension or manifests | `grep -rn isomorphic extensions; grep -c isomorphic-git package-lock.json` | no matches; 0 | PASS |
| Debt markers in phase-modified files | grep for `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` over 106 changed source, test and feature-support files | none | PASS |

The full suite was not re-run, as instructed. The gate evidence supplied (static, unpaired, integration, direct coverage green; cucumber 2133 of 2138, the 5 failures being the known `fd`-dependent Glob scenarios in `features/hook/tool-use.feature`) is taken as given.

### Probe Execution

SKIPPED. Phase 3 plans declare no `probe-*.sh` scripts.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` in the changed files.

### Review Findings Status

| Finding | State at HEAD | Judgement |
| ------- | ------------- | --------- |
| CR-01 (one-shot helper hands the token to any host) | Fixed: `bundleOrigin` binds the retry to an https request to the bundle host; pairs are `credential.<origin>.helper`; the helper also checks `host=` on stdin | Closed. The 03-REVIEW-FIX unit cases include a real-git `insteadOf` case that fails with an unscoped helper. |
| WR-01 (request `-c` pairs could undo hardening) | Fixed: request pairs come first | Closed |
| WR-02 (403 read as `rejected`) | Fixed in code: only `Authentication failed for` is `rejected` | Needs the maintainer's judgement (human item 1) |
| WR-03 (leaked staging directories) | Partly fixed: refresh staging has a fixed name and is swept; `sources-staging/<uuid>` entries of add, pinned clones, per-commit and tag copies, and mirror seeding are still never swept | Known, accepted. Retry safety (NFR-3) holds because each run uses a fresh UUID; the cost is disk only. Warning, not a gap. |
| WR-04 (PUP-2 carry-over from an unlocked read) | Fixed | Closed |
| IN-04, IN-05 | Fixed | Closed |
| IN-01, IN-02, IN-03 | Deferred by instruction | Known. IN-01 and IN-03 are unrecorded leftovers and could join the D-SG-10 note. |
| Audit F-2 (git-subdir URL schemes) | Goes to Phase 4 | Not a Phase 3 gap |

### Human Verification Required

1. **WR-02 classification of a bare 401/403.** Test: read `platform/git-failure-kind.ts` rows and the new scenario at `features/marketplace/git-source.feature:304`. Expected: the maintainer accepts `no-credential` for a 403 git reaches with or without a credential. Why human: git prints the same line either way, so only a product judgement can settle the wording.
2. **macOS and Windows manual check (WINDOWS.md #120 to #125).** Test: run the manual check on the pull request. Expected: Git for Windows branches (old-clone copy, `!`-helper, rename of a held checkout or mirror) behave as the unit cases assume. Why human: no Windows or macOS runner exists in this sandbox or in CI. Already deferred to the pull request by plan.

### Gaps Summary

No goal gaps. All five roadmap success criteria and all eight requirements are met by code, wiring and tests in the tree at HEAD 9a29f1e. Status is `human_needed` only because two judgement or platform items are still open, both named in the task as known.

Notes for the caller, none of which block:

- `.planning/REQUIREMENTS.md` still shows SG-TRN-01..07 and SG-MIG-01 as unchecked, and its traceability table says "Pending". Update them when the phase is closed.
- ROADMAP.md line 105 still lists Phase 3 as `[ ]`, while its plan list is all `[x]` (17/17).
- Roadmap criterion 1 names "ref update" and "current branch" among the `GitOps` operations. Those two were removed as unused with the D-14 verbs (03-15) rather than ported, which is consistent with D-SG-10 and leaves nothing on `isomorphic-git`.
- The isomorphic-git dependency was removed in this phase (03-15), earlier than CONTEXT.md's "Phase 8" note; this exceeds the goal.

---

_Verified: 2026-11-24T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
