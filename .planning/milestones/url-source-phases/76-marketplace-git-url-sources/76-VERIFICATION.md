---
phase: 76-marketplace-git-url-sources
verified: 2026-07-11T07:23:14Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 76: Marketplace git-URL sources Verification Report

**Phase Goal:** A Pi user can add, update, remove, list, and inspect a marketplace sourced from any public HTTPS git URL, and declare such marketplaces in config or import them from Claude settings. (Marketplace-level `git-subdir` was dropped in phase discussion — upstream Claude Code has no subdirectory-marketplace concept; `git-subdir` remains a plugin-source concept for Phase 77.)
**Verified:** 2026-07-11T07:23:14Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `marketplace add <https-git-url>` clones directly from `source.url` (no github.com reconstruction), plugins list normally | VERIFIED | `domain/source.ts:366-388` (`parseUrlSource`) produces `UrlSource{url}` for generic https; `add.ts:746-762` (`addUrlInGuard`) sets `cloneUrl: source.url` verbatim and calls the shared `addGitClonedInGuard`; `add.test.ts` MURL-01 verbatim-clone-no-auth case passes (36/36 tests) |
| 2 | github.com URLs (string + object form) still normalize to `github` kind, not `url` | VERIFIED | `source.ts:298-300` github-host check precedes the generic-https arm (line 304); `urlObjectSource` (line 159-164) funnels `https://github.com/` object-form through the github parser; `source.test.ts` D-76-02 cases pass |
| 3 | `owner/repo@ref` folds to `github` kind with `ref` (D-76-04) | VERIFIED | `source.ts:314-326` (`parseOwnerRepo` fold on last `@`); `source.test.ts` D-76-04 cases pass (74/74 domain tests) |
| 4 | `marketplace update` re-fetches a url-sourced marketplace with the same atomic-swap semantics as github, no auth bundle | VERIFIED | `update.ts:397-406` url arm calls `refreshGitHubClone(cloneDir, source.ref, gitOps, cb)` with no auth argument, then `validateManifestAtRoot`; `update.test.ts` passes (49/49) |
| 5 | `marketplace remove` deletes a url-sourced marketplace's clone dir and state (no orphan) | VERIFIED | `remove.ts:85` `RecordedSourceKind` includes `"url"`; line 512-514 detection admits it; line 727 clone-deletion gate is `=== "github" \|\| === "url"`; `remove.test.ts` passes (31/31) including remove-then-re-add-no-orphan case |
| 6 | `marketplace list` and `marketplace info` render url-sourced marketplaces with correct source display | VERIFIED | `info.ts:68-77` `buildBlock` projects a `url` arm branched BEFORE the `path` fallback; `notify.ts:2916-2920` renders `url: <url>[#ref]`, never `path:`; `last_updated:` gate widened to `sourceKind !== "path"` (line 2935); `info.test.ts` passes (15/15); `list` intentionally unchanged (D-76-11 — list headers carry no source line) |
| 7 | A `claude-plugins.json` entry with a url source reconciles at load time (no spurious remove-then-re-add) | VERIFIED | `MARKETPLACE_CONFIG_ENTRY_SCHEMA.source` stays `Type.String()` (D-76-12, unchanged); `samePlannedSource` url arm live (no `c8 ignore`) at `source.ts:522-529`, ref-aware + `.git`-canonical via `sourceLogical` equality; `state-io.ts::normalizeStoredSource` gained exactly one `url` arm (line 216-225) that revalidates through `parsePluginSource`; `source.test.ts` MURL-06 cases pass; `state-io.test.ts` passes (25/25) |
| 8 | `import` maps an `extraKnownMarketplaces` entry with a url source (nested + flat legacy shapes, no regression) | VERIFIED | `import/marketplaces.ts:40-67` (`nestedMarketplaceSource`) reads nested `{source:{source:"url"/"github"/"directory"}}`; `marketplaceSourceFromExtra` (line 76-96) reads flat legacy shape first, then nested; `file` shape stays unmappable; `marketplaces.test.ts` passes (10/10) |
| 9 | A 401/403 clone challenge renders `(failed) {authentication required}`, not `{unparseable}`/`{network unreachable}` | VERIFIED | `add.ts:251-264` `classifyAddError` HttpError arm (duck-typed `code === "HttpError"` + `statusCode` 401/403) sits above the errno ladder; REASONS tuple (`notify.ts:134`) has 33 members ending with `"authentication required"`; tripwire asserts 33 (`notify-closed-set-locks.test.ts:31`); `add.test.ts` 401/403 cases pass; `catalog-uat.test.ts` passes (6/6) with the auth-required fixture |
| 10 | Marketplace-level `git-subdir` (ex-MURL-02) stays rejected as `{unsupported source}`; ROADMAP/REQUIREMENTS reflect the drop | VERIFIED | `add.ts:357` S5b gate admits only `github`/`path`/`url`; `git-subdir`/`npm` fall through to `UnsupportedSourceError`; ROADMAP.md Phase 76 success criteria (4 items, no subdir criterion) and REQUIREMENTS.md "Out of Scope" table both document the drop with rationale |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/source.ts` | Generic-https parser arm, `.git` canonicalization, owner/repo@ref fold, url object-form github funnel, live `samePlannedSource` url arm | VERIFIED | All present, wired, and tested (74/74 domain tests pass) |
| `extensions/pi-claude-marketplace/shared/notify.ts` | REASONS gains `authentication required` (33rd member); `MarketplaceInfoMessage.source` union gains `url` arm; renderer gains `case "url"`; `last_updated` gate widened | VERIFIED | Confirmed at lines 134, 1132, 2916-2920, 2935 |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | `authentication required` given a completeness-proof home in `FAILURE_REASONS` | VERIFIED | Line 106; typecheck green (compile-time completeness proof would fail otherwise) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | Shared `addGitClonedInGuard`; url clone path; S5b gate widened; `classifyAddError` HttpError arm | VERIFIED | `addGitClonedInGuard` (618-699) is the single shared body; `addUrlInGuard` (746-762) delegates with no auth; S5b (357) widened; HttpError arm (251-264) present |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | `refreshRecord` url arm, no auth | VERIFIED | Lines 397-406 |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | `RecordedSourceKind` gains `url`; clone-deletion gate widened | VERIFIED | Lines 85, 512-514, 727 |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` | `buildBlock` url projection before path fallback | VERIFIED | Lines 68-77 |
| `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` | Dual-shape `marketplaceSourceFromExtra` (flat legacy + nested upstream) | VERIFIED | Lines 40-96; post-merge refactor into `nestedMarketplaceSource` helper confirmed clean (no nested ternary) |
| `extensions/pi-claude-marketplace/platform/git.ts` | `CloneOptions.url` doc widened beyond github-only | VERIFIED | Lines 41-45; no executable change (as required) |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | `normalizeStoredSource` gains a `url` arm (deviation, both plans independently found this bug) | VERIFIED | Exactly one `url` arm present (lines 216-225) — merge correctly kept the strict re-parse-and-throw variant, no duplicate arm |
| `docs/output-catalog.md` | `authentication required` failure catalog row; url info byte-form rows (with/without ref) | VERIFIED | Lines 1166-1176 (auth-required), 1216-1233 (url info fixtures) |
| `docs/messaging-style-guide.md` | Closed-set REASONS contract row for `authentication required` | VERIFIED | Line 61 |
| `tests/architecture/notify-closed-set-locks.test.ts` | Tripwire bumped 32→33 | VERIFIED | Line 31 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| github-host check | generic-https arm | order in string parser | WIRED | `source.ts:298` (github) precedes `304` (generic https) — verified by reading and by D-76-02 passing tests |
| `.git`-suffix strip (url arm) | `parseGitHubUrl`'s strip | canonical identity | WIRED | Both strip a single trailing `.git` after fragment split (lines 383-385 vs 422-424); `samePlannedSource`/`sourceLogical` compare url forms canonically |
| url clone path | `gitOps.clone` | no auth bundle spread | WIRED | `add.ts:636` `...(auth !== undefined && { auth })` — url path never passes `auth`; test asserts absence |
| `classifyAddError` HttpError arm | duck-typed detection | no isomorphic-git import | WIRED | `add.ts` imports checked — no `isomorphic-git` import; detection is `code === "HttpError"` + `data.statusCode`, matching the `isGitNotFoundError` idiom in shared.ts |
| remove's clone-deletion gate | `github \|\| url` | NFR-3 no-orphan | WIRED | `remove.ts:727`; test `MURL-04 / NFR-3: remove of a url marketplace then re-add of the same repo succeeds` passes |
| `buildBlock` url projection | before `path` fallback | correct info display | WIRED | `info.ts:68-77` branches before the `else` path fallback (line 78) |
| import dual-shape reader | flat legacy shape read first | no regression | WIRED | `import/marketplaces.ts:81-88` reads flat shape before falling to nested (line 90-93); existing flat-shape tests still pass |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MURL-01 | 76-01, 76-02 | `marketplace add` arbitrary public HTTPS git URL, cloned directly from `source.url` | SATISFIED | Parser widening (76-01) + add.ts url clone path (76-02); both test suites pass |
| MURL-03 | 76-02 | `marketplace update` re-fetches URL-sourced marketplaces, atomic-swap parity | SATISFIED | `update.ts` url arm; `update.test.ts` passes |
| MURL-04 | 76-02 | `marketplace remove` deletes URL-sourced clones and state | SATISFIED | `remove.ts` widened gate; `remove.test.ts` passes including no-orphan case |
| MURL-05 | 76-03 | `marketplace list`/`info` render URL sources with correct display | SATISFIED | `info.ts`/`notify.ts` url projection + render case; `info.test.ts` + `catalog-uat.test.ts` pass; `list` unchanged per D-76-11 (documented, not a gap) |
| MURL-06 | 76-01 | `claude-plugins.json` URL source reconciles at load time | SATISFIED | Live ref-aware `.git`-canonical `samePlannedSource` url arm; `state-io.ts` revalidation arm; both test suites pass |
| MURL-07 | 76-03 | `import` maps `extraKnownMarketplaces` URL entries | SATISFIED | Dual-shape `marketplaceSourceFromExtra`; `marketplaces.test.ts` passes with nested + flat legacy + file-unmappable cases |

No orphaned requirements — MURL-01, 03, 04, 05, 06, 07 all appear in at least one plan's `requirements` field and are all in REQUIREMENTS.md's traceability table mapped to Phase 76. MURL-02 was formally dropped during phase discussion (D-76-05) and removed from REQUIREMENTS.md with a documented rationale (no upstream subdirectory-marketplace concept) — this is a requirements-set change, not an unaddressed requirement.

### Anti-Patterns Found

None. Scanned all files modified by this phase (`domain/source.ts`, `shared/notify.ts`, `shared/notify-reasons.ts`, `orchestrators/marketplace/{add,update,remove,info}.ts`, `orchestrators/import/marketplaces.ts`, `persistence/state-io.ts`, `platform/git.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/`placeholder`/`coming soon`/`not yet implemented`/`not available` — zero matches (the one `placeholder` hit was in an unrelated pre-existing docstring: `notify.ts:1303` "It has NO placeholder" describing a different design point, not phase-76 debt). No `Phase 76`/`Plan 0N`/`Wave N` planning references leaked into source comments (grepped the full phase diff — comment policy honored throughout, using `D-76-NN`/`MURL-NN` traceability anchors instead).

### Post-Merge Integration Notes (verified)

- **`normalizeStoredSource` url arm merge:** exactly one `url` arm exists in `state-io.ts` (lines 216-225); it is the strict re-parse-and-throw-on-mismatch variant described in the merge notes. `state-io.test.ts` passes (25/25).
- **`nestedMarketplaceSource` / info.ts source-projection refactor:** both post-merge lint-fix extractions read cleanly — `import/marketplaces.ts`'s `nestedMarketplaceSource` (lines 40-67) is a clean switch, not a nested ternary; `info.ts`'s `buildBlock` uses a clean if/else-if/else chain (lines 61-79), matching each plan's acceptance criteria.
- **`resolver-strict.test.ts` fixture:** confirmed updated to a non-github URL (`https://gitlab.com/obra/superpowers.git`) consistent with D-76-02 github-host normalization.
- **`npm run check` green claim:** independently re-verified via targeted spot-runs rather than re-running the full suite (per project guidance): `tests/domain/source.test.ts` (74/74), `tests/architecture/notify-closed-set-locks.test.ts` (4/4), `tests/orchestrators/marketplace/{add,update,remove,info}.test.ts` (36/49/31/15, all pass), `tests/orchestrators/import/marketplaces.test.ts` (10/10), `tests/architecture/catalog-uat.test.ts` (6/6), `tests/persistence/state-io.test.ts` (25/25), and `npm run typecheck` (clean, zero errors).

### Human Verification Required

None. All must-haves are programmatically verifiable via source inspection and targeted test execution; no visual, real-time, or external-service behavior is in scope for this phase (all operations are local git-clone plumbing and deterministic renderers).

### Gaps Summary

No gaps. All four ROADMAP success criteria and all six phase requirement IDs (MURL-01, 03, 04, 05, 06, 07) are backed by both source-level evidence and passing tests. The MURL-02 drop (marketplace-level git-subdir) was a deliberate, documented scope change made during phase discussion, not an unaddressed requirement — ROADMAP.md and REQUIREMENTS.md both reflect it consistently, and the underlying rejection behavior (`{unsupported source}` for git-subdir/npm marketplace sources) remains intact and gate-enforced.

---

*Verified: 2026-07-11T07:23:14Z*
*Verifier: Claude (gsd-verifier)*
