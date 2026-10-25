---
phase: 16-git-plugin-copies-and-version-rule
reviewed: 2026-10-23T10:15:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - features/step_definitions/plugin/fetch.steps.ts
  - features/step_definitions/plugin/git-source.steps.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-10-23T10:15:00Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

I reviewed `git diff 7a9bb481..HEAD -- extensions features/step_definitions`. I also traced the callers and collaborators of the changed code: `update-swap.ts` (the ST-9 check), `enable-disable.ts` (re-materialization), `fetch.ts` and `info.ts` (mirror refresh), `bridges/hooks/stage.ts` and `bridges/skills/stage.ts` (symlink handling), and `materializeMarketplaceTagClone` (the same copy pattern already used in this repo). I read the unit tests only to judge coverage.

The wiring is correct. Install, update, and reinstall now record the per-commit copy. The GC regex and the live-key derivation match `pluginCloneKey`. The version ladder is applied the same way in install, update, info, and list.

The main defect is in `copyMirrorAtCommit`. It copies the mirror's whole work tree with `fs.cp` defaults, then runs a non-forced isomorphic-git checkout. That checkout trusts the copied index. So the "per-commit copy" is not a clean checkout of the commit. Relative symlinks are rewritten to absolute paths that point back into the mirror. Untracked or modified files in the mirror carry over into the copy. I reproduced both against the repo's own `isomorphic-git` (see CR-01).

The unit tests use a fake `checkout`, so they cannot see this. One test even asserts the carry-over behavior (IN-05).

Secondary issues:
- The checkout fallback catches every error.
- `isSameRevision` ignores a change of source kind.
- The ST-9 concurrency guard is weaker now that two git revisions can share a version.
- The unlocked `fetch` can race the copy.
- `enable` still moves a git plugin to the mirror's freshly fetched HEAD.

I found no regression for path-source plugins outside the source-kind switch in WR-02. Tag-pinned updates still short-circuit through `pinnedVersion` and compare the tag oid against the recorded sha, which is correct. No new stdout, console, or network surface was added. NFR-10 path derivation goes through `pluginCloneDir`/`sourcesStagingDir`. The symlink rewrite in CR-01 is the containment gap.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The per-commit copy is not a clean checkout. Symlinks point back into the mirror, and untracked or modified mirror files carry over

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:258-275`

**Issue:** `copyMirrorAtCommit` runs `cp(mirrorRoot, staging, { recursive: true })` and then `gitOps.checkout({ dir: staging, ref: sha })` without `force`. Two separate problems follow. I reproduced both with the repo's `node_modules/isomorphic-git` and Node's `fs.cp`:

1. **Symlinks are rewritten to absolute paths into the mirror.** With `verbatimSymlinks` at its default of `false`, `fs.cp` resolves a relative link target against the *source* directory. So `skills/link -> ../shared` becomes `skills/link -> <plugin-clones>/<url12>/shared`. The non-forced checkout skips every path whose index entry already matches the target commit (this is documented at `platform/git.ts:99-106`), so the absolute link is never rewritten. Reproduction: after cp and checkout at `HEAD~1`, `readlink copy/skills/link` still gave `.../mirror/shared`. Consequences:
   - The installed plugin reads that content from the mutable mirror, so a `fetch` changes the installed plugin's files. That is the exact GIT-01 bug this phase exists to fix.
   - The plugin root no longer resolves inside its owning clone root (NFR-10).
   - `bridges/hooks/stage.ts` (LIFE-03) rejects any hooks symlink whose `realpath` escapes `pluginRoot` with `SymlinkRefusedError`. So a plugin with a relative symlink under `hooks/` installed fine from the mirror before this phase and now fails to install or update.
   - `bridges/skills/stage.ts:311-321` copies symlinks verbatim (T-03-15), so a skill directory staged from the copy carries the absolute link into the mirror. The house rule (T-03-15) is `verbatimSymlinks: true`, and this new `cp` drops it.
   - The checkout can also hit a link that does change between HEAD and `sha`. Then isomorphic-git sees a modified work-tree file and throws a checkout conflict. The `catch {}` turns that into a network clone (see WR-01), so reinstall stops being offline.
2. **Untracked and modified files carry over.** A checkout never removes untracked files. A non-forced checkout also leaves a modified tracked file alone when the target entry is unchanged. Reproduction: an untracked `untracked.txt` and a tampered `other.txt` in the mirror both appear in a copy checked out at the mirror's HEAD, which is exactly the install and update case.

   This is a real risk. Records made before this phase ran hooks and MCP servers *from the mirror*, so `node_modules/`, build output, caches, or edited files can already sit there. Every new copy inherits them. The copy is then keyed by sha and returned "as is" forever by the warm-key short-circuit at `:298`, so the contamination is permanent.

The repo already has the correct pattern and its rationale: `materializeMarketplaceTagClone` (`clone-cache.ts:776-799`) copies `.git` only, "so an untracked or gitignored file … cannot ride along."

**Fix:** Copy only the gitdir into an empty staging dir. Drop the copied index so the checkout writes the whole target tree, the way a fresh clone does. Keep symlinks verbatim.

Note on `force: true`: I verified that a forced checkout into an empty tree fails in isomorphic-git when a directory holds only a symlink (`ENOENT` on `symlink`). The index-less, non-forced checkout below succeeded and preserved `../shared`.

```ts
const staging = await args.locations.sourcesStagingDir(randomUUID());
try {
  await mkdir(staging, { recursive: true });
  await cp(path.join(mirrorRoot, ".git"), path.join(staging, ".git"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  // No index: checkout writes every path the commit names, as a fresh clone does.
  await rm(path.join(staging, ".git", "index"), { force: true });
} catch (err) {
  const leak = await cleanupStaging(ops, staging, "plugin commit copy staging");
  throw appendLeakToError(err, leak);
}
```

Then add a unit test that uses the real `platform/git.ts` checkout (or an integration test) over a fixture repo with a relative symlink and an untracked mirror file. Assert that the copy's link is relative and that the untracked file is absent.

## Warnings

### WR-01: The checkout fallback catches every error and drops the staging-cleanup leak

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:267-272`

**Issue:** `catch { …; return false; }` treats every checkout failure as "the mirror does not hold `sha`". It then falls through to `materializePluginClone`, which goes to the network. This includes ENOSPC, EACCES, a held `.git/index.lock` from a concurrent refresh, and the CR-01 conflict. Effects:
- A local disk fault turns into a network clone. That can fail with an unrelated `network unreachable` or `authentication required` reason, which hides the real cause.
- Reinstall loses its offline guarantee for a commit that is actually present (NFR-5 says reinstall goes to the network on cache miss only).
- The `cleanupStaging` leak string is thrown away, which breaks the MA-9 contract every other staging site follows.

`checkoutPinWithRefetch` (`:141-156`) already uses the narrow form `isGitCommitNotFetchedError`.

**Fix:** Fall back only on the "commit not present" classes. Rethrow everything else with the leak appended:

```ts
} catch (err) {
  const leak = await cleanupStaging(ops, staging, "plugin commit copy staging");
  if (isGitCommitNotFetchedError(err) || isGitNotFoundError(err)) {
    return false;
  }
  throw appendLeakToError(err, leak);
}
```

`isGitNotFoundError` is the name-based matcher in `shared.ts` that the file header refers to. Add a test for a non-missing-commit checkout failure.

### WR-02: `isSameRevision` ignores a change of source kind, so a path-to-git or git-to-path switch with the same declared version is reported `unchanged`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:326-341`

**Issue:** The sha comparison depends on the *new* entry's kind, and it is skipped whenever `record.resolvedSha === undefined`.

- **Path to git:** the marketplace moves a plugin from a `path` source to a git source and keeps its declared `version`. The record (path install, no `resolvedSha`) and `toVersion` match, `record.resolvedSha === undefined` returns `true`, and the verdict is `unchanged`. The plugin keeps running from the old path tree. Before this phase, the git `toVersion` was `sha-<12hex>`, which differed, so this was `updated`.
- **Git to path:** a record installed after this phase has a declared version. If the new entry is a `path` source with the same version, `isGitSourceEntry(entry)` is `false`, so the verdict is again `unchanged`. The record keeps naming a `plugin-clones/` copy the marketplace no longer refers to.

Both are regressions caused by moving to declared-version-first.

**Fix:** Compare the sha whenever either side has one. Keep "version alone decides" only when neither side has a sha:

```ts
function isSameRevision(record: PluginStateRecord, toVersion: string, resolvedSha: string | undefined): boolean {
  if (toVersion !== record.version) return false;
  if (record.resolvedSha === undefined && resolvedSha === undefined) return true;
  return record.resolvedSha === resolvedSha;
}
```

A git record made before D-77-02, with no sha, then reports `updated` once, which is harmless. A tag-pinned path record compares tag oids, which is also correct. Add cases for both switch directions to `update-preflight.test.ts`.

### WR-03: The ST-9 concurrency check compares version only, which no longer detects a concurrent git update. The unlocked preflight copy can also be garbage-collected under it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:589-595`, with `update-preflight.ts:228-244` and `:897` (a `loadState` with no lock)

**Issue:** `preparePluginUpdate` runs outside the state lock. ST-9 (`sRecord.version !== fromVersion`) is the only check that the record did not move between preflight and the intent-mark. Before VER-01, a git record's version *was* its sha, so any concurrent revision change tripped ST-9. Now two revisions share a declared version (D-09), and the following can happen:

1. Process A prepares an update to sha3 and materializes `<url12>-<sha3>` with no lock held.
2. Process B updates the same plugin to sha2. It finalizes, then runs `garbageCollectPluginClones`, which loads fresh state. No record names sha3, so B deletes A's copy.
3. A's ST-9 passes because both versions are `1.0.0`. A then stages from a deleted root, or records `resolvedSource` pointing at a directory that no longer exists.

Before this phase, an unpinned update worked from the mirror, which B's GC kept.

**Fix:** Have ST-9 also compare `sRecord.resolvedSha` with the preflight record's `resolvedSha`. Raise `PluginUpdateConcurrencyError("plugin-updated", …)` on a mismatch. Also re-check that `preflight.installable.pluginRoot` still exists inside the intent-mark guard, before any commit.

### WR-04: An unlocked `fetch` / `info --fetch` can refresh the mirror while `copyMirrorAtCommit` copies it, and the torn copy is then trusted forever

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:261`, `:298-300`; `orchestrators/plugin/fetch.ts:402`, `orchestrators/plugin/info.ts:2091`

**Issue:** `fetch` and `info --fetch` call `materializeOrRefreshPluginMirror` without the state lock. `refreshGitHubClone` rewrites objects, refs, and work-tree files in place. Install, update, and reinstall now `cp` that same directory.

A cross-process overlap can do one of two things:
- `cp` throws (for example ENOENT on a pack temp file that vanished). That fails the install even though a clone fallback exists.
- The copy captures a half-updated work tree, which the non-forced checkout leaves alone (CR-01).

The result is keyed by sha, and `materializePluginCommitCopy` returns any present key "as is" (`:298`). So the corruption survives until the copy is garbage-collected. Before this phase, the next refresh repaired the mirror.

**Fix:** The CR-01 fix (gitdir-only copy, index-less checkout) removes the work-tree half of this race. A torn object store then makes the checkout fail, and WR-01's narrowed catch, extended to `cp` failures that look like a vanished file, can route that to the clone fallback. Alternatively, take the scope lock around the mirror refresh in `fetch`.

### WR-05: `enable` still re-materializes an unpinned git plugin at the mirror's freshly fetched HEAD and keeps the old version

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:403-418`, `:948-962`; `install-clone-probe.ts:63-75`

**Issue:** The enable branch calls `runInstallLedger` with `pinVersionOverride: record.version` and no `sourcePinOverride`. `probeInstallClone` then refreshes the mirror over the network, copies it at the *new* HEAD, and records the new `resolvedSha` with the *old* version. So after `fetch` + `disable` + `enable`, the plugin runs a commit it was never updated to, under a version label that no longer matches. With declared versions, `update` may then report it `unchanged`.

This existed before this phase, but it breaks the guarantee this phase claims in D-04 and GIT-01: "an installed plugin's files change only through `update` or `reinstall`."

**Fix:** For a git record with a `resolvedSha`, pass `sourcePinOverride: record.resolvedSha` on enable. The probe's pinned arm then hits the existing `<url12>-<sha12>` copy offline. Otherwise, record this as an explicit deferral in ROADMAP so the invariant is not overstated.

## Info

### IN-01: A legacy mirror-backed record whose update is `unchanged` stays on the mirror and leaves an orphan copy

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:960-976`

**Issue:** Consider a record made before this phase (`resolvedSource` = mirror) for a plugin that declares no version and has no new commit. Update builds `<url12>-<sha12>`, finds the same revision, and returns `unchanged`. The record keeps naming the mutable mirror, and the new copy is unreferenced until the next GC. The CONTEXT deferral says such records migrate "until their next `update` or `reinstall`", which is not true for an unchanged update.

**Fix:** Either reword the deferral, or treat `record.resolvedSource` being the mirror key as "not the same revision" so the update moves the record onto its copy.

### IN-02: Stale tier references in `readDeclaredPluginVersion`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:1174-1183`, `:1196`

**Issue:** The doc comment still says "Tier 1 of {@link resolvePluginVersion}" and "falls to tier 2", and the catch comment says "tier 2 / tier 3 cover it". The function now feeds `resolveDeclaredPluginVersion`, and tier 3 is now the sha, not the hash.

**Fix:** Point the comment at `resolveDeclaredPluginVersion` and drop the tier numbering.

### IN-03: Redundant default in the list candidate row

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts:206`

**Issue:** `candidateRowFields(manifestEntry, outcome.version ?? manifestEntry.version)` repeats the parameter's own default (`version = manifestEntry.version`).

**Fix:** `candidateRowFields(manifestEntry, outcome.version)`.

### IN-04: The commit-copy staging duplicates `materializeMarketplaceTagClone`'s logic

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:243-276` vs `:776-799`

**Issue:** Both functions do the same thing: copy a checkout into `sources-staging`, check out an oid, promote to a `pluginCloneKey` dir. They differ in exactly the respects that make one correct and the other wrong (CR-01). A shared helper `copyCheckoutAtCommit(ops, locations, sourceRoot, oid, dest)` would keep them from drifting. Related observation outside the diff: the tag clone's `force: true` checkout into an empty tree fails in isomorphic-git for a directory that holds only a symlink. The index-less approach in CR-01 avoids that, and the shared helper would fix both.

**Fix:** Extract one helper and call it from both sites.

### IN-05: The unit tests hide CR-01 and assert the carry-over behavior

**File:** `test/orchestrators/plugin/clone-cache.test.ts:2014-2062`

**Issue:** `seedMirror` writes an untracked `plugin.txt` into a `.git`-only mirror. The fake `checkout` writes nothing. The test then asserts that the copy contains `"mirror tree"`, which locks in the untracked-file carry-over from CR-01. No test exercises the real isomorphic-git checkout on a copy, so neither the symlink rewrite nor the skipped index-matching paths can be caught.

**Fix:** After the CR-01 fix, change the assertion to "the copy holds exactly the commit's tree". Add one test against real `platform/git.ts` ops (a hermetic fixture repo with a relative symlink and an untracked file in the mirror).

---

_Reviewed: 2026-10-23T10:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
