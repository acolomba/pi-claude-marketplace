---
phase: 07-marketplace-repo-tag-resolution
verified: 2026-09-19T23:45:32Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/07-marketplace-repo-tag-resolution/07-01-PLAN.md
  - .planning/phases/07-marketplace-repo-tag-resolution/07-01-SUMMARY.md
  - .planning/phases/07-marketplace-repo-tag-resolution/07-02-PLAN.md
  - .planning/phases/07-marketplace-repo-tag-resolution/07-02-SUMMARY.md
  - .planning/phases/07-marketplace-repo-tag-resolution/07-03-PLAN.md
  - .planning/phases/07-marketplace-repo-tag-resolution/07-03-SUMMARY.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
covered_digest: "v1:sha256:eecac11f0fce864166fcd0ec7e0e743f098032211b615f9d83754a4bad9fbf02"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 07: Marketplace-repository tag resolution for path-source dependencies Verification Report

**Phase Goal:** A version constraint on a path-source dependency — the common case — resolves the way upstream resolves it: against the marketplace repository's `{name}--v{version}` tags, offline, with a stated fallback when no tag matches.
**Verified:** 2026-09-19T23:45:32Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TAGS-01: a constrained path-source dependency resolves against the marketplace clone's local `{name}--v{version}` tags with no network call | ✓ VERIFIED | `platform/git.ts::listTags`/`resolveTagOid` (local isomorphic-git, no network); `orchestrators/plugin/marketplace-tag-probe.ts::probeMarketplaceTags`; `tests/architecture/marketplace-tag-probe-offline.test.ts` pins the module's `platform/git.ts` import set to exactly `["listTags","resolveTagOid"]` (ran green: 4/4 pass); `tests/architecture/no-orchestrator-network.test.ts` green (4/4 pass) |
| 2 | TAGS-03: when a tag satisfies, the plugin's files come from the marketplace repository at that tag, not the current checkout, and the record's version reflects the tag | ✓ VERIFIED | `clone-cache.ts::materializeMarketplaceTagClone` (copy-then-checkout, D-07-04); `install-outcome.ts` wires `resolvedSha`/`pinVersionOverride` through the existing seam; `tests/integration/path-source-tag-install.test.ts#TAGS-01/TAGS-03` ran green, asserting installed bytes match the tag (not the later commit) and the record's version/resolvedSha match the tag |
| 3 | The marketplace clone's own working tree, HEAD and index are byte-identical across the install (no mutation) | ✓ VERIFIED | Copy-then-checkout construction (D-07-04) never opens the marketplace clone through any git API; `tests/integration/path-source-tag-install.test.ts` asserts `.git/index`/`.git/HEAD`/working-tree bytes unchanged for both the single-member and two-member concurrent cases, plus a dedicated CR-01 test proving an untracked file in the marketplace root does not leak into the materialized clone — all ran green |
| 4 | TAGS-02: when no tag satisfies the constraint, the install proceeds with the marketplace's current copy, the cascade succeeds, and the row says so as a quiet info note (not a failure, not a warning) | ✓ VERIFIED | `install-cascade.ts::probeMemberPin`'s path branch resolves `no-matching-tag`/`tag-listing-failed` to `fellBackToCurrentCopy: true` (success, no pin); `dependency current copy` token added to `REASONS`/`CommandPrivateReason`; `composeCascadeMemberRows` spreads the token only on `installed` rows and leaves severity to `companionSeverity` (confirmed by direct grep of source — no literal severity stamp); the D-07-03 "warning" regression introduced and reverted mid-review (commits `cf3873bd` then `5f10f40f`) is now byte-identical to the original info-tone design per `07-REVIEW.md`'s iteration-3 diff audit. `install-cascade.test.ts`, `install-cascade.messaging.test.ts` (270 tests) and the integration TAGS-02 case all ran green |
| 5 | An unreadable local tag listing (non-git marketplace root, throwing probe) takes the same fallback as an empty/non-satisfying listing (D-07-07) | ✓ VERIFIED | `install-cascade.test.ts` cases "a path-source member whose local listing THROWS resolves anyway, identically" and "...whose marketplace root is not a git repository resolves anyway" both pass |
| 6 | The materialized directory survives the clone GC sweep because it carries `resolvedSha`, and is provably swept without it (T-07-02) | ✓ VERIFIED | `tests/orchestrators/plugin/clone-gc.test.ts` carries both the survive-with-field and swept-without-field cases; ran green as part of the 270-test batch |
| 7 | DIVG-01: `docs/dependency-resolution.md` states upstream accepts a `sha` field and this extension refuses it, and describes the shipped path-source resolution and fallback; the document no longer claims a path source can satisfy no constraint but the wildcard | ✓ VERIFIED | Direct read of `docs/dependency-resolution.md`: line 33 states "Claude Code accepts a `sha` field on a dependency element and pins the dependency to that commit. This extension refuses the field instead..."; `### When no tag satisfies the constraint` (line 98) describes the fallback; §"How a constrained dependency is resolved" splits git-backed (network) vs path-source (local) tag reads; grep for the old wildcard-only claim finds nothing |
| 8 | A gate binds the fallback prose and the sha-divergence sentence to the real composer/document so they cannot silently drift | ✓ VERIFIED | `tests/architecture/dependency-doc-agreement.test.ts` drives `composeCascadeMemberRows` and reads the real document sections; ran green (part of the 270-test batch) |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts` | `listTags`, `resolveTagOid` exported, network-free | ✓ VERIFIED | Both exported (lines 402, 444); no network calls (architecture gate confirms) |
| `extensions/pi-claude-marketplace/domain/release-tag.ts` | shared release-tag selection module | ✓ VERIFIED | Exists, exports `selectHighestSatisfyingTag`, `ReleaseTagCandidate`, `SelectedReleaseTag`, `RELEASE_TAG_SEPARATOR`; consumed by both probes |
| `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts` | local, network-free tag probe | ✓ VERIFIED | Exists, `probeMarketplaceTags` exported, import surface pinned to exactly 2 symbols |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts::materializeMarketplaceTagClone` | copy-then-checkout materializer | ✓ VERIFIED | Present, used by `install-outcome.ts`'s `pathPinProbe` seam |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | path-source branch, `fellBackToCurrentCopy` marker | ✓ VERIFIED | `resolveMemberTagSource`'s path arm, `ResolvedCascadeMember.fellBackToCurrentCopy?`, `CascadeMemberOutcome.fellBackToCurrentCopy` (required) all present |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` / `notification-types.ts` | new closed-set token | ✓ VERIFIED | `"dependency current copy"` present in `CommandPrivateReason` union and `REASONS` tuple tail |
| `docs/output-catalog.md` | new catalog state for the fallback row | ✓ VERIFIED | `dependency-cascade-fallback-current-copy` state present; catalog-contract test green |
| `tests/integration/path-source-tag-install.test.ts` | end-to-end real-repository proof | ✓ VERIFIED | 4 tests, all pass, covering TAGS-01/02/03 and the untouched-git-state proof |
| `tests/architecture/marketplace-tag-probe-offline.test.ts` | positive offline import-set gate | ✓ VERIFIED | Exists, 4/4 pass |
| `docs/dependency-resolution.md` | rewritten resolution sections + sha divergence | ✓ VERIFIED | Confirmed by direct read (see Truth 7) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `install-cascade.ts::resolveMemberTagSource` path branch | `marketplace-tag-probe.ts::probeMarketplaceTags` | direct call | WIRED | Confirmed in source and by passing `install-cascade.test.ts` cases exercising the path branch |
| `ResolvedCascadeMember.pin` | `install-outcome.ts::deriveInstallVersion` first precedence arm | `pinVersionOverride` | WIRED | No change needed to `install-outcome.ts`'s existing precedence arm (by design — D-07-02); `install-outcome.test.ts` proves the pinned path-source install records tag semver + oid |
| `probeMemberPin` path-source no-match arm | `ResolvedCascadeMember.fellBackToCurrentCopy` → `CascadeMemberOutcome` → `CascadeInstalledRow` → `composeCascadeMemberRows` | direct structural pass-through, `install-flow.ts` untouched | WIRED | `git diff --name-only` across plan 07-02's commits confirms `install-flow.ts` is unmodified; messaging tests confirm the token reaches the rendered row |
| new token → `CommandPrivateReason` → `REASONS` → `notify-closed-set-locks`/`compat-01-no-expansion`/catalog | amendment across all 5 (+1 unplanned) gate sites | WIRED | All gates ran green in this verification session; 07-02-SUMMARY documents the 5th unplanned gate (`notification-types.test.ts::EXPECTED_REASONS`) was also closed |
| `composeCascadeMemberRows` fallback row reasons | `docs/dependency-resolution.md` §"How a constrained dependency is resolved" | `dependency-doc-agreement.test.ts` driving the real composer | WIRED | Test ran green in this session |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Path-source tag selection unit + local probe | `node --test tests/domain/release-tag.test.ts tests/orchestrators/plugin/marketplace-tag-probe.test.ts tests/architecture/marketplace-tag-probe-offline.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts` | 37/37 pass | ✓ PASS |
| End-to-end real-repository install (tag hit, tag miss, concurrent members, untracked-file leak) | `node --test tests/integration/path-source-tag-install.test.ts` | 4/4 pass | ✓ PASS |
| Cascade resolution, messaging, doc-agreement, GC survival, resolver containment | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-cascade.messaging.test.ts tests/architecture/dependency-doc-agreement.test.ts tests/orchestrators/plugin/clone-gc.test.ts tests/domain/plugin-resolver.test.ts` | 270/270 pass | ✓ PASS |
| Closed-set reason vocabulary gates | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/shared/notification-types.test.ts` | 35/35 pass (4+14+4+13) | ✓ PASS |
| No-network architecture gate | `node --test tests/architecture/no-orchestrator-network.test.ts` | 4/4 pass | ✓ PASS |
| Whole-repo typecheck | `npx tsc --noEmit -p .` | exit 0, no output | ✓ PASS |
| Debt-marker scan on all 7 new/modified production files | `grep -nE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` | no matches in any file | ✓ PASS |

I did not re-run the full `npm test` suite myself (per the "run the full suite at most once" guidance and because `07-REVIEW-FIX.md` already documents a fresh, independent 6,722/6,722 pass after the final fix commit `bfb7956a`, matching the current `HEAD` = `f2a96f94`). The targeted runs above independently re-confirm every phase-specific test file named across the three plans' `<verify>` blocks.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TAGS-01 | 07-01 | Path-source constraint resolves against local marketplace tags, offline | ✓ SATISFIED | See Truth 1; REQUIREMENTS.md marks `[x]` Complete |
| TAGS-02 | 07-02 | No satisfying tag installs current copy, row says so, install succeeds | ✓ SATISFIED | See Truth 4/5; REQUIREMENTS.md marks `[x]` Complete |
| TAGS-03 | 07-01 | Satisfying tag's tree materializes; record version reflects tag | ✓ SATISFIED | See Truth 2; REQUIREMENTS.md marks `[x]` Complete |
| DIVG-01 | 07-03 | Docs record the `sha`-field divergence and the new resolution behavior | ✓ SATISFIED | See Truth 7/8; REQUIREMENTS.md marks `[x]` Complete |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s TAGS/DIVG sections map exactly to the four IDs declared across the three plans' frontmatter, and all four are marked `[x]` / "Complete" in the requirements-coverage table at the end of that file.

### Anti-Patterns Found

None in the phase's new/modified production files. `grep` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` across `platform/git.ts`, `domain/release-tag.ts`, `domain/plugin-resolver.ts`, `orchestrators/plugin/marketplace-tag-probe.ts`, `orchestrators/plugin/install-cascade.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/install-outcome.ts` returned no matches.

Three code-review iterations ran against this phase (`07-REVIEW.md`, `07-REVIEW-FIX.md`), progressing from 2 critical/multiple warnings (iteration 1-2) down to 0 critical / 4 warnings (iteration 3, all test-quality/comment-policy, not behavior bugs), all 4 of which `07-REVIEW-FIX.md` records as fixed with a fresh 6,722/6,722 full-suite pass. Notably, iteration 2 introduced (via WR-05) an accidental reversal of the locked D-07-03 decision — raising the fallback row from `info` to `warning` severity — which iteration 3's review caught as CR-02 and which fix commit `5f10f40f` reverted byte-for-byte back to the original info-tone design (confirmed independently in this verification session by reading the current `composeCascadeMemberRows` source, which calls the unmodified `companionSeverity(...)` with no literal severity override, and by reading the current `docs/dependency-resolution.md`, which states the info-tone rationale). This was a real regression that a less thorough review would have shipped; it is fully closed at current `HEAD`.

### Human Verification Required

None. Every truth resolved to VERIFIED through direct source inspection, direct documentation reading, and independently re-run automated tests in this verification session (not merely trusted from SUMMARY.md).

### Gaps Summary

No gaps. All four requirement IDs (TAGS-01, TAGS-02, TAGS-03, DIVG-01) are implemented, wired, tested, documented, and independently re-verified in this session against the actual codebase at `HEAD` (`f2a96f94`). The phase goal — a path-source version constraint resolving against the marketplace clone's own tags offline, with a stated info-level fallback when no tag matches — is observably true in the code, not merely claimed in the SUMMARYs.

---

_Verified: 2026-09-19T23:45:32Z_
_Verifier: Claude (gsd-verifier)_
