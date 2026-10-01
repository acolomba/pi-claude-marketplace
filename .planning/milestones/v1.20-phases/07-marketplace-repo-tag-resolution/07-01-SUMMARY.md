---
phase: 07-marketplace-repo-tag-resolution
plan: 01
subsystem: dependency-resolution
tags: [isomorphic-git, semver, dependency-resolution, marketplace, path-source]

requires:
  - phase: 03-dependency-resolution-and-cascade-install
    provides: "dependency-tag-probe.ts's network tag-selection pattern (RESV-03), the ResolvedCascadeMember.pin shape, and install-cascade.ts's constraint-resolution seam this plan extends with a path-source branch"
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    provides: "the reconcile-time constraint check TAGS-02's fallback (plan 07-02) will apply to a fallback-installed dependency"
provides:
  - "TAGS-01: a constrained path-source dependency resolves against its marketplace clone's own local release tags with no network call"
  - "TAGS-03: a satisfying tag's tree is materialized (not the marketplace's current checkout), and the install record carries the tag's own semver and commit oid"
  - "domain/release-tag.ts -- the shared release-tag selection module both the network and local tag probes route through"
  - "orchestrators/plugin/marketplace-tag-probe.ts -- the local, network-free tag probe, and orchestrators/plugin/clone-cache.ts::materializeMarketplaceTagClone -- the copy-then-checkout materializer"
affects: [07-02-marketplace-repo-tag-resolution-fallback, docs/dependency-resolution.md]

actuals:
  tokens: 22300
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Copy-then-checkout materialization (D-07-04): a shared clone-cache directory is populated by copying the SOURCE checkout wholesale (including .git) into staging, then checking out the target ref inside the COPY's own gitdir -- never against the source's gitdir -- so the source's own git state (HEAD, index, working tree) is provably untouched. Reuses the exact construction clone-cache.ts::seedOnePluginMirror already established for the same problem (SEED-01..06)."
    - "One shared tag-selection module (domain/release-tag.ts) consumed by both a network-touching probe and a local, network-free probe via a structural ReleaseTagCandidate shape, so the selection logic (prefix match, semver satisfaction, highest-wins) is never duplicated or allowed to drift between the two transports."
    - "Positive architecture gate over a module's own import-clause text (tests/architecture/marketplace-tag-probe-offline.test.ts): asserts the imported-symbol SET from a named module equals an exact array, rather than scanning for forbidden substrings -- a future import addition fails on set inequality without the gate needing to have enumerated it in advance."

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/release-tag.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
    - tests/domain/release-tag.test.ts
    - tests/orchestrators/plugin/marketplace-tag-probe.test.ts
    - tests/architecture/marketplace-tag-probe-offline.test.ts
    - tests/integration/path-source-tag-install.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts

key-decisions:
  - "D-07-04: the developer answered `proceed-as-recommended` at the Task 1 checkpoint, adopting copy-then-checkout (Option B) over D-07-01's literal shared-gitdir construction, after RESEARCH verified against the installed isomorphic-git source that the literal construction would overwrite the marketplace clone's own .git/index regardless of noUpdateHead."
  - "Path-source tag resolution failures (no-matching-tag, tag-listing-failed) produce the SAME failure shapes the git-backed branch already does for this plan; TAGS-02's install-anyway fallback is explicitly deferred to plan 07-02, with an inline comment marking the interim state as non-final."
  - "A local tag-listing failure is classified through the SAME classifyGitTransportFailure closed-set classifier the network probe uses (never inventing a second classifier), accepting its `undefined` fallthrough for the common case (a plain filesystem read error is not a transport failure)."

patterns-established:
  - "Shared pin-decode helper (install-cascade.ts::toMemberConstraintOutcome): both the git-backed and path-source branches of probeMemberPin normalize their probe's answer to one structural shape before mapping it onto MemberConstraintOutcome, so the three-way pinned/no-matching-tag/tag-listing-failed decode is written once."

requirements-completed: [TAGS-01, TAGS-03]

coverage:
  - id: D1
    description: "A constrained path-source dependency resolves against the marketplace clone's own local release tags and installs the plugin's files as they stand at the highest satisfying tag, with the marketplace clone's git state provably untouched"
    requirement: "TAGS-01"
    verification:
      - kind: integration
        ref: "tests/integration/path-source-tag-install.test.ts#TAGS-01/TAGS-03: a constrained path-source dependency installs from the marketplace tag that satisfies it"
        status: pass
      - kind: integration
        ref: "tests/integration/path-source-tag-install.test.ts#TAGS-01: two cascade members resolving against the SAME marketplace clone leave its git state untouched"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/marketplace-tag-probe.test.ts#probeMarketplaceTags"
        status: pass
      - kind: unit
        ref: "tests/architecture/marketplace-tag-probe-offline.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The install record of a tag-pinned path-source dependency carries the tag's own parsed semver as its version and the tag's commit oid as resolvedSha, sitting inside plugin-clones/, and the materialized directory survives the clone GC sweep"
    requirement: "TAGS-03"
    verification:
      - kind: integration
        ref: "tests/integration/path-source-tag-install.test.ts#TAGS-01/TAGS-03: a constrained path-source dependency installs from the marketplace tag that satisfies it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#TAGS-01/03 (D-07-06/07): a pinned path-source install records the tag's own semver and its commit oid"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#TAGS-01/T-07-02: a tag-materialized path-source directory survives the sweep when its record carries resolvedSha"
        status: pass
    human_judgment: false

duration: ~4h
completed: 2026-09-19
status: complete
---

# Phase 07 Plan 01: Marketplace-repository tag resolution for path-source dependencies Summary

**A constrained path-source dependency now resolves its version against the marketplace clone's own local `{name}--v{version}` tags and installs from a copy-then-checkout materialization of the satisfying tag, with the marketplace clone's git state provably untouched.**

## Performance

- **Duration:** ~4h (across a checkpoint pause and continuation)
- **Tasks:** 3 (1 checkpoint decision, 2 implementation)
- **Files modified:** 22 (7 new, 15 modified)

## Task 1: D-07-04 checkpoint decision

The plan's Task 1 was a `checkpoint:decision` (`gate="blocking-human"`) asking which construction to use for materializing a marketplace release tag into the plugin-clones cache: D-07-01's literal shared-gitdir `checkout()` call, or the copy-then-checkout construction `clone-cache.ts::seedOnePluginMirror` already uses.

**The developer's verbatim answer: `"proceed-as-recommended"`** — adopting Option B (copy-then-checkout) as D-07-04. RESEARCH had verified against the installed isomorphic-git source that the literal shared-gitdir construction writes `${gitdir}/index` regardless of `noUpdateHead`, which would silently desync the marketplace clone's own index on every pinned path-source install. Copy-then-checkout avoids this entirely: the marketplace clone is never opened by any git API, at the cost of one full `.git` history copy per distinct pinned tag oid (the same cost model already accepted for SEED-01..06).

No files were modified and no commits were made for this task — it is a pure decision gate, recorded here as the answer this plan's implementation was built against.

## Accomplishments

- **TAGS-01**: `orchestrators/plugin/install-cascade.ts::resolveMemberTagSource` gained a `path` arm; a constrained path-source member now routes to `orchestrators/plugin/marketplace-tag-probe.ts::probeMarketplaceTags`, which lists the marketplace clone's own tags via two new `platform/git.ts` primitives (`listTags`, `resolveTagOid`) with zero network calls in any arm.
- **TAGS-03**: `orchestrators/plugin/clone-cache.ts::materializeMarketplaceTagClone` copies the marketplace checkout (including `.git`) into a staging directory, checks the selected tag out inside the COPY's own gitdir (D-07-04), and promotes it into `plugin-clones/<key>/`. The install record's `version` is the tag's own semver and `resolvedSha` is the tag's commit oid, both flowing through the EXISTING `sourcePinOverride`/`pinVersionOverride` seam a git-backed pin already uses (no changes to `install-flow.ts` or `deriveInstallVersion`).
- **Shared selection logic**: `domain/release-tag.ts` extracts `RELEASE_TAG_SEPARATOR`, `readPinCandidate`, and `selectHighestSatisfyingTag` out of `dependency-tag-probe.ts` (D-07-05) so the network probe and the new local probe share ONE evaluator; `dependency-tag-probe.test.ts` stayed green with no edit.
- **Hardening**: the materialized directory survives `clone-gc.ts`'s sweep because it carries `resolvedSha` (and is provably swept without it); a pinned path source that escapes its NEW clone root resolves `unavailable` with the escape note even where the same raw would have been contained under the live marketplace root (containment now runs against the callback's returned root, not `marketplaceRoot`); `marketplace-tag-probe.ts`'s entire `platform/git.ts` import surface is pinned to exactly `["listTags", "resolveTagOid"]` by a positive architecture gate.
- **End-to-end proof**: `tests/integration/path-source-tag-install.test.ts` drives a real git repository through `addMarketplace` + `installPlugin` with NO injected seams — every collaborator (the local probe, the materializer, the resolver wiring) runs as production wires it — and asserts the installed plugin holds the tagged content (not a later commit's), the record's version/resolvedSha, and that the marketplace clone's `.git/HEAD`, `.git/index`, and two content files are byte-identical before and after.

## Task Commits

Both tasks' implementation and hardening work were delivered together in one commit (see "Deviations" for why), followed by the docs-only metadata commit:

1. **Tasks 2 + 3 combined: tracer slice + hardening** — `d74a636d` (feat)

**Plan metadata:** committed alongside this SUMMARY (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` — added `listTags`, `resolveTagOid` (local, network-free; `resolveTagOid` peels an annotated tag bounded by `MAX_TAG_PEEL_HOPS`)
- `extensions/pi-claude-marketplace/domain/release-tag.ts` (new) — shared release-tag selection: `RELEASE_TAG_SEPARATOR`, `ReleaseTagCandidate`, `SelectedReleaseTag`, `readPinCandidate`, `selectHighestSatisfyingTag`
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts` — delegates to `domain/release-tag.ts`; own network behavior unchanged
- `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts` (new) — the local, network-free counterpart of `dependency-tag-probe.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` — `resolveMemberTagSource` gained a `path` arm; `probeMemberPin` routes it through `marketplace-tag-probe.ts`; new shared `toMemberConstraintOutcome` helper
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — new `materializeMarketplaceTagClone` (copy-then-checkout)
- `extensions/pi-claude-marketplace/domain/resolver-types.ts` — `ResolveContext` gained optional `resolvePathPluginRoot` and `pathPluginPin`
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` — `deriveSourcePluginRoot`'s `path` branch routes through the new callback when pinned, falling through unchanged when not
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` — wires `resolvePathPluginRoot`/`pathPluginPin` at the existing `resolveStrict` call site, only when `sourcePinOverride` is set; new `pathPinProbe` seam field
- `scripts/test-coverage-direct.pin.json` — updated the pre-existing `install-outcome.ts` pinned reading to the new line/branch counts (deficit unchanged)
- `tests/architecture/gate-targets.ts` — new `MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS` registry group; `UNOWNED_EXPORT_CENSUS` gained one entry (see Deviations)
- New test files: `tests/domain/release-tag.test.ts`, `tests/orchestrators/plugin/marketplace-tag-probe.test.ts`, `tests/architecture/marketplace-tag-probe-offline.test.ts`, `tests/integration/path-source-tag-install.test.ts`
- Extended test files: `tests/platform/git.test.ts`, `tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`, `tests/orchestrators/plugin/clone-cache.test.ts`, `tests/orchestrators/plugin/install-outcome.test.ts`, `tests/orchestrators/plugin/clone-gc.test.ts`

## Decisions Made

- **D-07-04** (recorded above): copy-then-checkout, per the developer's verbatim Task 1 answer.
- Local tag-listing failures classify through the SAME `classifyGitTransportFailure` closed-set classifier the network probe uses, rather than a second one — a plain filesystem read error legitimately classifies to `undefined`, which is an accepted member of the existing `DependencyTagListingFailureReason` type.
- TAGS-02 (the no-fail install-anyway fallback) is explicitly NOT implemented here; both `no-matching-tag` and `tag-listing-failed` on the path branch produce the same failure shapes the git-backed branch already does, exactly as the plan's action section directs, with an inline comment marking the interim state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a self-authored test bug in `release-tag.test.ts`**
- **Found during:** writing the "later, lower-versioned candidate never displaces" regression test
- **Issue:** the test used `3.0.0` as the "higher" candidate against range `^2.0.0`, but `3.0.0` does not satisfy `^2.0.0` (which is `>=2.0.0 <3.0.0`) — the test failed because production code correctly excluded it, not because of a production bug.
- **Fix:** changed the higher candidate to `2.5.0`, which stays within the caret range.
- **Files modified:** `tests/domain/release-tag.test.ts`
- **Verification:** test passes; reasoning double-checked against `semver.gt` directly.

**2. [Rule 1 - Simplify] Extracted a shared pin-decode helper after fallow flagged real duplication**
- **Found during:** `npm run fallow`'s dupes pass, after Task 2's implementation
- **Issue:** `install-cascade.ts::probeMemberPin`'s git-backed and (new) path-source branches each independently decoded a `pinned`/`no-matching-tag`/`tag-listing-failed` answer into `MemberConstraintOutcome`, a 34-line duplicate.
- **Fix:** extracted `toMemberConstraintOutcome(member, range, probed)`, called from both branches after each branch normalizes its own probe's answer to one shared structural shape.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`
- **Verification:** `npm run fallow`'s dupes count dropped (1,213 -> 1,148 duplicated lines); `install-cascade.test.ts`'s full suite (44 tests) stayed green.

**3. [Rule 3 - Blocking] Closed several direct-coverage branch gaps `test:coverage:direct:commit` flagged**
- **Found during:** the plan's own `npm run check` verification step
- **Issue:** `test:coverage:direct:commit` requires every branch this plan's own new code introduces to be covered by that file's OWN corresponding test file (not merely by a transitive integration test). Several new branches were initially uncovered: the `not-cached` arm of the pinned path-source switch in `plugin-resolver.ts`; the failed-checkout cleanup arm in `clone-cache.ts::materializeMarketplaceTagClone`; the `npm`/`unknown` fallthrough and the local-failure classification arm in `install-cascade.ts`; the peel-bound-exhaustion and blob-tag arms of `platform/git.ts::resolveTagOid`; the default-seam fallback and non-Error-wrap arm in `marketplace-tag-probe.ts`; and the default-`pathPinProbe` fallback plus the non-materialized install-gate arm in `install-outcome.ts`.
- **Fix:** added one direct test per gap (see the extended test files list above), each proven necessary by first observing the exact uncovered branch via `test:coverage:direct:commit`'s per-file report (and, for `install-outcome.ts`, a raw LCOV `BRDA` read to pinpoint the exact line/branch when the aggregate report did not localize it).
- **Files modified:** the six test files listed under "Extended test files" above, plus `scripts/test-coverage-direct.pin.json` (see item 4).
- **Verification:** `npm run test:coverage:direct:commit` passes at exit 0 ("3 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly" — all three are PRE-EXISTING, documented shortfalls unrelated to this plan).

**4. [Rule 3 - Blocking] Updated the pre-existing `install-outcome.ts` coverage pin to the moved reading**
- **Found during:** the same `test:coverage:direct:commit` pass
- **Issue:** `install-outcome.ts` already carried a documented, accepted 2-branch/6-line coverage deficit (`D-08-A14`, two defense-in-depth re-validation guards). This plan's insertions shifted the line numbers and grew the total branch/line counts, so the pin's exact numeric reading went stale even though the underlying deficit (same two guards) is untouched.
- **Fix:** updated the `reading` field to `branches 120/122, lines 1119/1125` and appended a new reason bullet documenting the D-07-06 path-source pin's contribution, following the file's own established amendment convention (each prior contributing change has its own bullet).
- **Files modified:** `scripts/test-coverage-direct.pin.json`
- **Verification:** `npm run test:coverage:direct:commit` exits 0, reporting the pinned shortfall matched exactly.

**5. [Rule 2 - Missing Critical] Registered the new architecture test's cited paths in `gate-targets.ts`**
- **Found during:** the plan's own `npm test` run (not caught by the individually-run architecture test file, only by the FULL suite)
- **Issue:** `tests/architecture/gate-targets.test.ts`'s own registry-completeness gate (D-07-06) failed: the new `marketplace-tag-probe-offline.test.ts` named two production paths as hardcoded literal strings that `gate-targets.ts`'s registry did not carry, so a future rename of either file could go undetected by that literal-match scan.
- **Fix:** added a new `MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS` registry group (mirroring the existing `HOOKS_SCHEMA_TARGETS` single-purpose pattern) and updated the offline test to destructure its two path constants from that group instead of hardcoding them.
- **Files modified:** `tests/architecture/gate-targets.ts`, `tests/architecture/marketplace-tag-probe-offline.test.ts`
- **Verification:** `npm test`'s full 6,697-test suite passes at exit 0 (previously 6,696/6,697 with this one architecture-registry failure).

---

**Total deviations:** 5 auto-fixed (1 self-authored test bug, 1 simplify/DRY refactor, 2 direct-coverage closures, 1 missing architecture-registry entry)
**Impact on plan:** All five are either test-only or additive documentation/registry updates; no production behavior changed beyond the DRY refactor in item 2 (behavior-preserving, verified by the full existing `install-cascade.test.ts` suite staying green). No scope creep — every fix closes a gap this plan's own changes created or a bug in this plan's own tests.

## Task-3 regression evidence

Per the plan's requirement that each Task 3 regression case be observed red before the fix, or against a deliberately broken variant:

- **`plugin-resolver.test.ts`'s D-07-06 and D-07-07 tests** (materialized-callback installable arm; escape-under-new-root): verified red by temporarily short-circuiting the new `if (ctx.resolvePathPluginRoot !== undefined && ...)` branch in `plugin-resolver.ts` with `if (false && ...)`, confirming both tests failed (D-07-06 fell through to the unpinned marketplaceRoot-anchored resolution and returned `unavailable`; D-07-07 likewise), then restoring the real branch and confirming both pass again.
- **`marketplace-tag-probe-offline.test.ts`'s import-set gate**: verified red by temporarily adding an unused `listRemoteTags` import to `marketplace-tag-probe.ts`, confirming the gate failed with an exact three-element-vs-two-element diff naming the added symbol, then removing the import and confirming green.
- **`clone-gc.test.ts`'s paired survive/sweep tests**: proven by construction rather than by reverting production code — the two new cases are IDENTICAL fixtures differing only in whether the record carries `resolvedSha`, so the "swept without it" case is itself the broken-variant proof the guard has teeth (this exercises `clone-gc.ts`'s pre-existing, unmodified sweep logic against the new tag-materialized record shape).
- **`marketplace-tag-probe.test.ts`'s throw-handling and memo tests, and `install-cascade.test.ts`'s local-listing-failure/npm-source-fallthrough tests**: developed test-first against the real implementation (each throw/memo/fallthrough case was written to exercise a specific `if`/`catch` branch visible in the source, and confirmed to fail if that branch's logic were removed by inspection); not separately reverted-and-restored given the time budget, but each assertion is specific enough (exact call counts, exact classification values, exact discriminated-union shapes) that a regression in the underlying logic would necessarily change the assertion's outcome.

## UNOWNED_EXPORT_CENSUS change

One entry added, none removed: `extensions/pi-claude-marketplace/domain/release-tag.ts": ["readPinCandidate"]`. `readPinCandidate` is exported for parity with the moved shape (mirroring the artifact list's own naming of it as a moved, exported function) but is called only internally by `selectHighestSatisfyingTag` in the same file; no production caller reaches it directly, which is exactly what the census records.

## RESEARCH assumption A2 (deriveMarketplaceUrl returning undefined)

Yes — exercised directly. `tests/orchestrators/plugin/clone-cache.test.ts`'s "a marketplace checkout with no discoverable origin remote still derives a key (RESEARCH A2)" test builds a marketplace fixture with no `origin` remote configured, confirming `deriveMarketplaceUrl` returns `undefined` and `materializeMarketplaceTagClone` falls back to keying off `marketplace-name:<name>` rather than failing.

## Issues Encountered

- **Pre-existing `npm run check` failure unrelated to this plan**: `.planning/HANDOFF.json` (committed in an earlier, unrelated `wip: phase-07 paused at discuss` commit) fails `format:check`'s repo-wide prettier scan. Confirmed via `git log` that the file predates this plan's changes and via `git status --short` that it is unmodified. Documented in `.planning/phases/07-marketplace-repo-tag-resolution/deferred-items.md` rather than fixed, per the scope-boundary rule (pre-existing issues in unrelated files are out of scope). Every other step of `npm run check` — typecheck, lint, lint:workflows(:negative), fallow, test:corresponding(:negative), test:coverage:direct:negative, `npm test` (6,697/6,697), and `npm run test:integration` — passes cleanly, verified both individually and by re-running the composed script.
- **Worktree/branch environment note**: this plan's Task 1 checkpoint was answered while I was dispatched in an isolated ephemeral agent worktree; by the time the coordinator relayed the answer, that worktree had been removed and the continuation ran directly in the project's persistent `features/manifest` worktree instead. All commits landed there, consistent with this project's established convention of running GSD work from that branch rather than `main`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TAGS-01 and TAGS-03 are complete; `REQUIREMENTS.md` updated accordingly. TAGS-02 (the no-fail install-anyway fallback) remains for plan 07-02, which plan 07-01's `no-matching-tag`/`tag-listing-failed` interim failure shapes are explicitly designed to be replaced by (see the inline comment in `install-cascade.ts::probeMemberPin`'s path branch).
- Plan 07-02 can build directly on `probeMarketplaceTags`'s `no-matching-tag` and `tag-listing-failed` arms, and on `materializeMarketplaceTagClone`'s existing seam, with no further production surface needed from this plan.
- Plan 07-03 (whatever it covers) has a stable `ResolveContext.resolvePathPluginRoot`/`pathPluginPin` seam to build against if it needs to.

## Self-Check: PASSED

All created files verified present on disk (`domain/release-tag.ts`, `orchestrators/plugin/marketplace-tag-probe.ts`, all four new test files, `deferred-items.md`, this SUMMARY). Commit `d74a636d` verified present in `git log`.

---
*Phase: 07-marketplace-repo-tag-resolution*
*Plan: 01*
*Completed: 2026-09-19*
