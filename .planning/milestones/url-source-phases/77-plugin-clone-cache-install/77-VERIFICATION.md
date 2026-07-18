---
phase: 77-plugin-clone-cache-install
verified: 2026-07-11T00:00:00Z
status: passed
previous_status: "human_needed"
human_validated: 2026-07-11 (live clone/dedup/offline UAT passed — awslabs/agent-plugins trio)
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Install a url-source plugin from a real public git repo; re-install a second plugin referencing the same url+sha and confirm no new clone is made; then disconnect the network and confirm a warm-cache install still succeeds"
    expected: "First install clones once into plugin-clones/<key>/; second install (same url+sha, any plugin name) completes with zero additional network calls; an offline warm-cache install completes successfully with no network reachable"
    why_human: "All automated coverage mocks the git transport layer (GitOps injection). PURL-02's live network/offline behavior against a real git host is explicitly flagged as a Manual-Only Verification in 77-VALIDATION.md and has never been exercised against a real remote in this phase."
---

# Phase 77: Plugin clone cache + install Verification Report

**Phase Goal:** A Pi user can install a plugin whose source is a `url`, `git-subdir`, or `github`-object entry; the plugin clones once into a shared source-addressed cache and installs its supported components, with the recorded version reflecting the resolved commit.
**Verified:** 2026-07-11
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `url`/`git-subdir`/`github`-object plugin source resolves installable; partial-component degradation still applies | ✓ VERIFIED | `sourceUnsupportedReason` in `domain/resolver.ts:538-550` returns `undefined` for `path`/`github`/`url`/`git-subdir` (only `npm`/`unknown` reject). `tests/domain/resolver-strict.test.ts` (73 pass) exercises materialized/escapes/missing-subdir/not-cached/no-callback arms. `ResolvedPluginUnavailableSchema` (resolver.ts:211-216) still omits `pluginRoot` — NFR-7 discriminated union unchanged. |
| 2 | `install` clones the plugin source at its pinned sha into the shared clone cache; a second install of the same url+sha completes with no new clone (deduped); a warm-cache install completes offline | ✓ VERIFIED | `orchestrators/plugin/clone-cache.ts::materializePluginClone` — warm-cache short-circuit at line 65 (`if (await pathExists(cloneRoot)) return cloneRoot`) before any clone call. `tests/orchestrators/plugin/clone-cache.test.ts` (15 pass) includes a dedicated behavioral test that pre-seeds the cache dir, injects a `gitOps` whose `clone` throws, and asserts `materializePluginClone` still succeeds (`PURL-02: a warm cache returns offline even when gitOps.clone throws`). `install.test.ts` (90 pass) asserts a second install of the same url+sha triggers zero additional clone calls. |
| 3 | For `git-subdir`, plugin root = clone-root + subdirectory; NFR-10 containment anchored to the plugin's own clone root, not `marketplaceRoot` | ✓ VERIFIED | `install.ts::resolveGitSubdirRoot` (line 501-528) computes `pluginRoot = path.resolve(cloneRoot, subPath)` and calls `assertPathInside(cloneRoot, pluginRoot, ...)` — anchored to `cloneRoot`, never `marketplaceRoot`. An escape returns `{kind: "escapes"}`; a missing subdir returns `{kind: "missing-subdir"}`; both surface as resolver `unavailable`. `install.test.ts` asserts an escaping subdir and a missing subdir both fail the install. |
| 4 | The recorded plugin version reflects the pinned/resolved commit; an unpinned source resolves to remote head at install and records the resolved sha | ✓ VERIFIED | `install.ts::deriveInstallVersion` branches git sources to `shaVersion(resolvedSha)` (`sha-<12hex>`), replacing the 3-tier ladder; `resolvedSha` (full 40-hex) is threaded through `InstallCtx` into the state record (`resolvedSha: c.resolvedSha`, install.ts:997). `clone-cache.ts::resolvePluginPin` resolves `sha` (if set) over `ref` over unpinned-HEAD via the new `resolveRemoteRef` GitOps primitive. `install.test.ts` asserts: version 12-hex == resolvedSha first-12; sha wins over ref; unpinned resolves + records; path-source regression unaffected. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `domain/clone-key.ts` | `pluginCloneKey(url, sha)` — source-addressed cache key | ✓ VERIFIED | Exports `pluginCloneKey`; `<12hex(sha256(url))>-<sha12>` format confirmed by reading the file; `tests/domain/clone-key.test.ts` covers determinism, cross-URL distinctness, fs-safety. |
| `domain/version.ts` | `shaVersion`/`looksLikeShaVersion`/`SHA_VERSION_RE` | ✓ VERIFIED | All three exported; `SHA_VERSION_RE = /^sha-[0-9a-f]{12}$/`; anchored-exact per T-77-01-02. |
| `persistence/locations.ts` | `pluginClonesDir` + `pluginCloneDir(key)` SC-7 chokepoint | ✓ VERIFIED | Interface field, const, bundle entry, and `assertSafeName` → `path.join` → `assertPathInside` chokepoint order all present (lines 80, 170, 210, 247-256). |
| `persistence/state-io.ts` | `resolvedSha` additive-optional field | ✓ VERIFIED | `resolvedSha: Type.Optional(Type.String())` at line 63; `schemaVersion` unchanged (still `Type.Union([1,2])`); no migrate.ts fill added. |
| `shared/notify.ts` | `sha-<12hex>` → `#<7hex>` display transform | ✓ VERIFIED | Local `SHA_VERSION_DISPLAY_RE`/`looksLikeShaVersion`/`formatShaVersionForDisplay` (lines 1761-1785) — confirms the post-merge fix: no import from `domain/version.ts` (shared/→domain/ import is architecturally forbidden per `tests/architecture/import-boundaries.test.ts`, verified green). `renderVersion` chains `formatShaVersionForDisplay(formatHashVersionForDisplay(version))`. |
| `domain/resolver.ts` | Widened `sourceUnsupportedReason`, `GitPluginRootResult`, `ResolveContext.resolveGitPluginRoot`, branched `preflightStages` | ✓ VERIFIED | All four present; NFR-7 discriminated union unchanged; git-subdir containment delegated to the callback (not resolver-internal marketplaceRoot anchor). |
| `orchestrators/plugin/clone-cache.ts` | `materializePluginClone` + `resolvePluginPin`; NOT gitOps-forbidden | ✓ VERIFIED | Both exported; no `isomorphic-git` import (confined to `platform/git.ts` per D-13); imports `DEFAULT_GIT_OPS` from `marketplace/shared.ts` (S-9 pattern, like `update.ts`). |
| `orchestrators/plugin/install.ts` | Injects clone-materializing callback; zero git-token surface | ✓ VERIFIED | `grep -nE '\bgitOps\b|\bDEFAULT_GIT_OPS\b|platform/git|\brefreshGitHubClone\b'` on install.ts returns nothing (only a rationale comment at line 55 mentions "gitOps" in prose, stripped by the gate's comment-stripping grep). Imports `materializePluginClone`/`resolvePluginPin` by name and `shaVersion`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `pluginCloneKey` | clone seam (Plan 03) + install (Plan 04) | Single shared helper | ✓ WIRED | `clone-cache.ts` imports `pluginCloneKey` from `domain/clone-key.ts` directly (line 26); no re-derivation at any call site. |
| `pluginCloneDir` | SC-7 chokepoint | `assertSafeName` → `path.join` → `assertPathInside` | ✓ WIRED | Verified order in `locations.ts:247-256`; traversal-key rejection asserted in `tests/persistence/locations.test.ts`. |
| `ResolveContext.resolveGitPluginRoot` | install.ts `installCloneProbe` | Injected callback | ✓ WIRED | `install.ts` builds `makeInstallCloneProbe` and passes `clone.probe` as `resolveGitPluginRoot` into `resolveStrict` (line 675); list/info surfaces (not touched this phase) omit the callback, staying network-free per the resolver's `ctx.resolveGitPluginRoot === undefined` guard. |
| `materializePluginClone`/`resolvePluginPin` | install.ts | Named import, not `gitOps` | ✓ WIRED | Confirmed via grep — install.ts imports the seam's entrypoints, never the git surface itself. `no-orchestrator-network` gate green (1 pass). |
| `resolvedSha` (side-channel capture) | `InstallCtx` → state record | Closure capture in `makeInstallCloneProbe` | ✓ WIRED | Captured only on the materialized path (line 482/488), read after resolve via `clone.resolvedSha()`, threaded into `InstallCtx.resolvedSha` and the state-record write (`...(c.resolvedSha !== undefined && { resolvedSha: c.resolvedSha })`, line 997). |
| github-object → canonical URL | plugin-clones dedup | `resolvePluginPin` reconstruction | ✓ WIRED | `resolvePluginPin` reconstructs `https://github.com/<owner>/<repo>` for `kind === "github"`; `tests/orchestrators/plugin/install.test.ts#D-77-06` asserts a github-object source dedups to the same clone as an equivalent url source. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Cache-key/version/locations/state-io unit suite | `node --test tests/domain/clone-key.test.ts tests/domain/version.test.ts tests/persistence/locations.test.ts tests/persistence/state-io.test.ts` | 89 pass / 0 fail | ✓ PASS |
| Resolver widening suite | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | 73 pass / 0 fail | ✓ PASS |
| Resolver comp01 + types | `node --test tests/domain/resolver-comp01.test.ts tests/domain/resolver.types.test.ts` | 5 pass / 0 fail | ✓ PASS |
| Clone-cache seam + network guard | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/architecture/no-orchestrator-network.test.ts` | 15 + 1 pass / 0 fail | ✓ PASS |
| Install wiring suite | `node --test tests/orchestrators/plugin/install.test.ts` | 90 pass / 0 fail | ✓ PASS |
| Catalog-UAT byte-form (sha-version list row) | `node --test tests/architecture/catalog-uat.test.ts` | 6 pass / 0 fail | ✓ PASS |
| Import-zone boundary (shared/ ↛ domain/) | `node --test tests/architecture/import-boundaries.test.ts` | 3 pass / 0 fail | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0, no output | ✓ PASS |
| ESLint on all phase-touched files | `npx eslint <10 files>` | exit 0, no output | ✓ PASS |
| Full workspace check (single run) | `npm run check` | exit 0; 2665 + 16 tests pass, 0 fail | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PURL-01 | 77-02, 77-04 | Resolver classifies url/git-subdir/github installable | ✓ SATISFIED | `sourceUnsupportedReason` widening + install end-to-end test coverage. |
| PURL-02 | 77-03, 77-04 | Install clones at pinned sha into shared cache; warm-cache offline | ✓ SATISFIED | `materializePluginClone` dedup/offline short-circuit; behavioral offline test passes. |
| PURL-03 | 77-02, 77-04 | git-subdir plugin root = clone-root + subdir; NFR-10 anchored to clone root | ✓ SATISFIED | `resolveGitSubdirRoot` anchors `assertPathInside` to `cloneRoot`. |
| PURL-04 | 77-01, 77-03, 77-04 | Clone cache source-addressed (url+sha), deduped | ✓ SATISFIED | `pluginCloneKey` + warm-cache short-circuit + github/url cross-shape dedup test. |
| PURL-09 | 77-01, 77-03, 77-04 | Recorded version reflects resolved commit; unpinned resolves HEAD | ✓ SATISFIED | `shaVersion`/`resolvedSha` field + `resolvePluginPin` sha-over-ref precedence + unpinned HEAD resolution. |

**REQUIREMENTS.md checkbox note:** PURL-01/02/03/04/09 are still shown unchecked (`[ ]`) in `.planning/workstreams/url-source/REQUIREMENTS.md` as of this verification. This is a documentation-tracking gap, not a code gap — the ROADMAP.md phase entry and all four PLAN frontmatters declare exactly these five IDs, and the code/test evidence above satisfies each. No requirement ID is orphaned (all five map to at least one plan; no additional Phase-77 IDs exist in REQUIREMENTS.md beyond these five). Recommend updating REQUIREMENTS.md checkboxes at milestone-close or via a follow-up doc commit — not a phase-blocking gap.

### Anti-Patterns Found

None. Scanned all 10 phase-touched source files (`domain/clone-key.ts`, `domain/version.ts`, `domain/resolver.ts`, `persistence/locations.ts`, `persistence/state-io.ts`, `shared/notify.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/install.ts`, `platform/git.ts`, `orchestrators/marketplace/shared.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and planning-artifact tokens (`Phase 77|Plan 0[1-4]|Wave [0-9]|Pitfall [0-9]`) — zero matches in both scans.

### Human Verification Required

1. **Live network install + dedup + offline warm-cache against a real public git host**
   - **Test:** Install a `url`-source plugin from a real public git repository. Then install a second, differently-named plugin whose manifest entry references the same `url`+`sha`. Then disconnect the network and reinstall/install a third reference to the same warm cache key.
   - **Expected:** First install performs exactly one clone into `plugin-clones/<key>/`. The second install (different plugin name, same url+sha) completes with zero additional network/clone activity (dedup). The offline install completes successfully with no network reachable (warm cache).
   - **Why human:** This phase's automated coverage (`tests/orchestrators/plugin/clone-cache.test.ts`, `tests/orchestrators/plugin/install.test.ts`) exclusively drives the clone through an injected mock `GitOps` — the real `isomorphic-git` transport is never exercised end-to-end against a live remote. This is explicitly flagged as a **Manual-Only Verification** in `77-VALIDATION.md` ("Live clone of a real public git plugin repo into the cache"), and is required to close out PURL-02's "warm-cache install completes offline" success criterion with genuine network-layer evidence rather than a mocked substitute.

### Gaps Summary

No blocking gaps. All four ROADMAP success criteria and all five requirement IDs (PURL-01/02/03/04/09) are backed by real, passing code and tests — verified independently (not from SUMMARY.md narrative alone) via direct source reads, targeted test-suite runs, a full `npm run check` (2681 tests, 0 failures), and grep-based absence checks for git-surface leakage in `install.ts` and forbidden imports in `shared/notify.ts`. The one open item is a live-network manual verification explicitly called out by the phase's own validation strategy (77-VALIDATION.md) as out of automated-test reach — this routes to human verification per the Escalation Gate pattern, not to a code gap. A cosmetic REQUIREMENTS.md checkbox lag was also noted (informational only, not blocking).

---

*Verified: 2026-07-11*
*Verifier: Claude (gsd-verifier)*
