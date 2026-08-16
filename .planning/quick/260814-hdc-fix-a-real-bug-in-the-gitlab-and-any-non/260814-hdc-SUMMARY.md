---
phase: quick-260814-hdc
plan: 01
subsystem: git-clone
tags: [gitlab, url-source, git-subdir, clone-cache, bugfix]
status: complete

requires: []
provides:
  - "domain/source.ts::ensureGitSuffix -- the network-side counterpart to stripUrlDecorations"
  - "every gitOps.clone / gitOps.resolveRemoteRef call for a url-kind or git-subdir-kind source now sends a .git-suffixed url"
affects:
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/platform/git.ts

tech-stack:
  added: []
  patterns:
    - "Key-vs-wire split: a cache-key/identity value (canonicalCloneUrl, pluginCloneKey, pluginMirrorKey, resolvePluginPin's returned cloneUrl) and the literal network url are two different strings derived from the same source, bound to separate locals (cloneUrl vs networkUrl) rather than merged into one canonicalization function."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/platform/git.ts
    - tests/domain/source.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/plugin/clone-cache.test.ts

decisions:
  - "Fix shape: re-append .git at the five network-url call sites via a new exported ensureGitSuffix helper, rather than changing parse-time stripUrlDecorations behavior. D-76-01 identity comparison (sourceLogical / samePlannedSource) is untouched."
  - "Fix breadth: host-agnostic, applied to every url-kind and git-subdir-kind source regardless of host -- not scoped to gitlab.com, since the .git suffix is a general git-hosting convention and the redirect-breaks-POST mechanism is generic HTTP/simple-get behavior, not GitLab-specific."
  - "Cache-key identity (canonicalCloneUrl, pluginCloneKey, pluginMirrorKey, resolvePluginPin's returned cloneUrl) must stay reading the un-suffixed url so no warm plugin-clones/ directory is invalidated; only the literal url: field sent to gitOps.clone / gitOps.resolveRemoteRef gets the suffix, via a locally-bound networkUrl."

metrics:
  duration: ~25min
  completed: 2026-08-14

actuals:
  tokens: 49000
  tasks: 3
  commits: 2
---

# Quick Task 260814-hdc: Fix GitLab (and any non-GitHub url-kind) marketplace clone `.git`-suffix bug Summary

Every `gitOps.clone` / `gitOps.resolveRemoteRef` call for a `url`-kind or `git-subdir`-kind source now sends a `.git`-suffixed network url, closing the live `422 Unprocessable Entity` failure confirmed against gitlab.com, while cache-key identity (`pluginCloneKey`, `pluginMirrorKey`, `canonicalCloneUrl`) keeps hashing the un-suffixed canonical form so no warm `plugin-clones/` directory is invalidated.

## What Was Built

**Root cause:** `domain/source.ts`'s `stripUrlDecorations` strips a trailing `.git` at parse time so `sourceLogical` / `samePlannedSource` compare `.../repo` and `.../repo.git` as one identity (D-76-01). That same stripped string was then handed to the wire as the literal clone url (`orchestrators/marketplace/add.ts`, "MURL-01 / D-76-06: url-source add. Clones `source.url` VERBATIM"). GitLab's smart-HTTP endpoint 301-redirects the `.git`-less `info/refs` request, and `simple-get` (the transport behind `isomorphic-git/http/node`) downgrades the redirected `POST git-upload-pack` to a bodyless `GET`, which GitLab answers with `422 Unprocessable Entity`. GitHub was never affected because `add.ts` reconstructs its clone url fresh every time as `` `https://github.com/${owner}/${repo}.git` ``, never routing through the stripping parser.

**Live evidence gathered before this task** (standalone repro script against the real gitlab.com API, same cached credential both times): `clone({ url: "https://gitlab.com/acolomba/pi-cm-test-marketplace" })` (no `.git`) failed in 760ms with `HttpError: HTTP Error: 422 Unprocessable Entity`; the identical clone with `.git` appended succeeded in 651ms.

**Task 1** (`34008f15`) -- added `domain/source.ts::ensureGitSuffix(url: string): string`, the network-side counterpart to `stripUrlDecorations`: trims trailing slashes, then appends `.git` unless already present. Wired into `orchestrators/marketplace/add.ts`'s single clone funnel (`addGitClonedInGuard`) so `source.url` is passed through `ensureGitSuffix` for the network call while the stored source record keeps its canonical (un-suffixed) form. Amended the now-inaccurate "clones verbatim" doc comments in `add.ts` and `platform/git.ts`'s `CloneOptions.url` to describe the new split. Added `ensureGitSuffix` unit coverage (append, idempotent, trailing-slash trim, git-subdir-already-suffixed) plus a guard asserting `parsePluginSource` still strips `.git` from a `.git`-suffixed non-github https string, so a future change to the stripping side breaks that test first.

**Task 2** (`82aa35cb`) -- applied `ensureGitSuffix` at the four remaining network-url sites in `orchestrators/plugin/clone-cache.ts`: `materializePluginClone`, `materializeOrRefreshPluginMirror`, and both branches of `resolvePluginPin` (`gitOps.resolveRemoteRef`, ref and unpinned). Each site binds a separate `networkUrl` local from the existing `cloneUrl`/`args.cloneUrl`, so `pluginCloneKey`, `pluginMirrorKey`, and the `cloneUrl` returned by `resolvePluginPin` are untouched -- proven by explicit key-equality assertions in `clone-cache.test.ts` (e.g. the landed clone root still equals `pluginCloneDir(pluginCloneKey(unsuffixedUrl, pin))`). Added one sentence to `domain/clone-key.ts`'s `canonicalCloneUrl` doc block warning a future reader against folding the suffix into that function, since doing so would rehash every `plugin-clones/` directory.

**Task 3** -- ran the plan's exhaustiveness gate (every `url:` field inside a `gitOps.clone(` / `gitOps.resolveRemoteRef(` window must route through `ensureGitSuffix` or `networkUrl`, at least five sites) and the full `npm run check` quality bar. Both green; no further edits were required.

`domain/source.ts::parseUrlSource`, `stripUrlDecorations`, `sourceLogical`, and `samePlannedSource` were not touched -- D-76-01 identity comparison has zero behavior change.

## Deviations from Plan

### 1. Retitled one test whose title contradicted its own updated assertion

- **Found during:** Task 1, updating `add.test.ts`'s url-kind assertions to expect the `.git`-suffixed network url.
- **Issue:** One existing test's title asserted the clone URL is sent "VERBATIM" -- true before this fix, now false, since the network url gains a suffix the stored source does not carry.
- **Fix:** Retitled the test to describe the current (correct) behavior: the stored source stays canonical while the network clone url is suffixed. The assertion itself was already updated per the plan; only the title was stale.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Commit:** `34008f15`

### 2. Added a mirror-key split assertion the plan required only for the clone-key case

- **Found during:** Task 2, writing the key-equality regression coverage.
- **Issue:** The plan explicitly required an assertion proving `materializePluginClone`'s landed directory still equals `pluginCloneDir(pluginCloneKey(unsuffixedUrl, pin))` (the T-hdc-04 cache-invalidation hazard), but did not separately require the same proof for `materializeOrRefreshPluginMirror`, which carries an identical hazard via `pluginMirrorKey`.
- **Fix:** Added the equivalent split assertion for the mirror path, so both cache-keying functions have the same explicit protection against a future edit accidentally folding the suffix into the key.
- **Files modified:** `tests/orchestrators/plugin/clone-cache.test.ts`
- **Commit:** `82aa35cb`

## Verification

- Exhaustiveness gate (Task 3): 5 `url:` fields found inside `gitOps.clone`/`gitOps.resolveRemoteRef` call windows across `extensions/pi-claude-marketplace`, all 5 routed through `ensureGitSuffix`/`networkUrl`.
- `npm run check`: exit 0 -- typecheck, lint, `format:check`, 3457 unit tests pass, 18 integration tests pass, 0 fail. 2 pre-existing skips, none in the eight files this task touched.
- Exactly eight files changed across both commits: five source (`domain/source.ts`, `domain/clone-key.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/plugin/clone-cache.ts`, `platform/git.ts`), three test (`tests/domain/source.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/plugin/clone-cache.test.ts`) -- matching the plan's success criteria exactly.
- Both commits used `SKIP=trufflehog` after confirming cleanliness via the filesystem-mode scan documented in this repo's CLAUDE.md -- the git-mode hook fails structurally inside a linked worktree (`.git` is a file, not a directory, so `--since-commit HEAD` cannot read the index). Both filesystem scans returned `verified_secrets: 0, unverified_secrets: 0`.

## Commits

- `34008f15` -- fix(marketplace): clone url sources with a .git suffix
- `82aa35cb` -- fix(plugin): send .git-suffixed urls from the clone cache

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/source.ts` -- FOUND, `ensureGitSuffix` exported, committed
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` -- FOUND, four sites wired, committed
- Commits `34008f15` and `82aa35cb` -- FOUND in `git log`
- `npm run check` -- exit 0
- No file deletions in either commit
