---
phase: 03-dependency-resolution
plan: 04
subsystem: orchestrators/plugin
tags: [dependency-resolution, semver, git-tags, isomorphic-git, nfr-5, network-leaf]

requires:
  - phase: 03-dependency-resolution
    plan: 02
    provides: "domain/dependency-range.ts -- the satisfaction test and the bounded range rendering the probe reuses instead of writing a second evaluator"
  - phase: 03-dependency-resolution
    plan: 03
    provides: "the amended NFR-5 sentence and docs/dependency-resolution.md's stated tag-read contract, which this plan makes true in code"
provides:
  - "platform/git.ts::listRemoteTags -- a remote's tag list read through the single isomorphic-git chokepoint, annotated tags resolved to their commits, credentials threaded through the existing bundle"
  - "orchestrators/plugin/dependency-tag-probe.ts::probeDependencyTags -- a constrained dependency resolved to the highest satisfying `<pluginName>--v<semver>` release tag, or to a named failure"
  - "the `no-matching-tag` and `tag-listing-failed` failure discriminants"
  - "DependencyTagListingSeam -- the injectable listing seam that keeps both install owners outside the git surface"
affects:
  [
    the install cascade that composes the probe,
    per-member outcome reporting,
    the closed REASONS vocabulary,
  ]

actuals:
  tokens: 8896
  tasks: 3
  commits: 2
plan_head_before: 1bf76095c1f93c90b4cc3f51d9da3b9dd55eb90a

tech-stack:
  added: []
  patterns:
    - "A non-gated network leaf reached by injection, mirroring install-clone-probe.ts, so a gated owner needs no exemption to reach git"
    - "A per-URL listing memo evicted on failure, so one cascade makes one listing per repository and a transient error is not cached"
    - "A candidate filter keyed on the subject's OWN name prefix, so a crafted tag naming a different plugin is never a candidate"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
    - tests/orchestrators/plugin/dependency-tag-probe.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - tests/platform/git.test.ts
    - tests/architecture/gate-targets.ts

key-decisions:
  - "D-03-26: dependency-tag-probe.ts is NOT added to CREDENTIAL_LEAK_TARGETS. It composes a host credential bundle and threads it into the listing call without ever reading, storing or rendering a credential value -- structurally identical to install-clone-probe.ts, which is also absent from that group. The gate's two scans (state-write field names, git-credential.ts Error interpolation) have no surface here, and its members are destructured POSITIONALLY against a pinned module order, so an unneeded member would be a real cost."
  - "The probe parses a candidate version with semver's `valid` and compares with `gt`, but the SATISFACTION test is domain/dependency-range.ts's `recordedVersionSatisfies`. Parsing and ordering a version is not evaluating a range; one module keeps owning what it means for a version to satisfy one."
  - "The query URL is `ensureGitSuffix(canonicalCloneUrl(source))`. `canonicalCloneUrl` is the cache-key IDENTITY, not a wire URL (MURL-01), and a suffix-less smart-HTTP endpoint that 301-redirects makes the transport replay a bodyless GET."
  - "A no-match returns the identical arm whichever repository the query ran against, so the probe carries no branch on how the source parsed and no path to the repository head (D-03-09)."

patterns-established:
  - "A probe leaf absent from NETWORK_FREE_TARGETS while its callers stay in it is the cheapest reconciliation of a new network call with the NFR-5 gate -- no gate edit, no exemption, no new candidate set."
  - "A failure arm carries a classified cause and a rendered range, never the raw transport object's surroundings and never a credential."
  - "An export that becomes reachable only when a later plan composes it is written into the unowned-export census with the commit that will remove it named in the entry."

requirements-completed: []

coverage:
  - id: D1
    description: "A remote's tags are readable through the project's single git chokepoint, with an annotated tag resolved to the commit it points at rather than to the tag object"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#listRemoteTags returns one entry per advertised tag"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#listRemoteTags prefers an annotated tag's peeled commit and drops the peel entry"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#listRemoteTags passes the tag ref prefix to the library call"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#listRemoteTags omits auth callbacks when no credential bundle is supplied"
        status: pass
    human_judgment: false
  - id: D2
    description: "A constrained dependency resolves to the HIGHEST release tag on its source repository whose version satisfies the intersected range"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#pins a satisfying release tag to the object id it resolves to"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#pins the highest satisfying version when several tags satisfy the range"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#skips a prefixed tag whose version part is not a version and pins its sibling"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only tags carrying the dependency's own `<pluginName>--v` release prefix are candidates, so the probe can never resolve an arbitrary unpinned ref or a tag named for a different plugin"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#never considers a tag that carries a satisfying version without the release prefix"
        status: pass
    human_judgment: false
  - id: D4
    description: "No tag satisfying the constraint produces one named outcome, identically in both query arms, with no fallback to the repository head (D-03-09)"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#reports the no-match arm when the query ran against the dependency's own source"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#reports the same no-match arm when the query ran against the marketplace repository"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#reports no matching tag for a repository advertising no tags at all"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#reports no matching tag with the rendered range when no advertised version satisfies"
        status: pass
    human_judgment: false
  - id: D5
    description: "A transport failure during tag listing becomes a typed result carrying the classified cause, never an unhandled rejection"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#returns the failure arm for an unclassifiable listing throw instead of rejecting"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#classifies an unreachable host on the failure arm"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#wraps a listing throw that is not an Error before carrying it on the failure arm"
        status: pass
    human_judgment: false
  - id: D6
    description: "Repeated queries for one repository within a cascade reuse one memoized listing, and a failed query is evicted so a retry re-queries"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#serves a second query for the same repository from one listing call"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#serves a memoized listing without reaching the production seam"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#evicts a failed listing so the retry queries the repository again"
        status: pass
    human_judgment: false
  - id: D7
    description: "Neither install owner gained a git surface and no architecture gate needed an exemption; a private source repository is queried through the one existing credential path"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-tag-probe.test.ts#threads the host credential bundle into the listing for a private source"
        status: pass
      - kind: other
        ref: "node --test tests/architecture/no-orchestrator-network.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/import-boundaries.test.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "Live tag resolution against a real remote -- a real repository's advertisement, a real annotated tag, and a real private-repository credential challenge"
    verification: []
    human_judgment: true
    rationale: "Every case above drives a faulted seam; nothing in this plan has been run against a live git host. The wire behavior of `listServerRefs({ prefix, peelTags })` against a real advertisement, and a real credential challenge on a private source, are only observable in a runtime UAT."

duration: 7h 5m
completed: 2026-09-15
status: complete
---

# Phase 3 Plan 4: Live tag resolution Summary

**A constrained dependency now resolves over the network to the highest `<pluginName>--v<semver>` release tag on its source repository that satisfies the intersected range -- read through the project's single `isomorphic-git` chokepoint, reported as one named failure in both query arms with no fallback to the repository head, and reached from the gated install owners by injection so no architecture gate needed an exemption.**

## Performance

- **Duration:** 7h 5m elapsed (Task 1 commit to Task 3 commit), of which roughly six hours was the Task 2 `blocking-human` decision checkpoint waiting on the developer. Active execution was about an hour.
- **Started:** 2026-09-15T03:19Z (Task 1 committed)
- **Completed:** 2026-09-15T10:24Z
- **Tasks:** 3 (one of them a decision checkpoint)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **`platform/git.ts::listRemoteTags`** -- the `git ls-remote --tags` equivalent, built on the same `listServerRefs` call `resolveRemoteRef` already makes with `prefix: "refs/tags/"` and `peelTags: true`. Each entry prefers its `peeled` object id, so an annotated tag resolves to a commit rather than to the tag object, and the `^{}` peel entry the protocol also advertises is dropped so one annotated tag yields one result. An empty advertisement returns `[]`. `platform/git.ts` remains the only module in the extension tree importing the git library.
- **`orchestrators/plugin/dependency-tag-probe.ts::probeDependencyTags`** -- the network-legal leaf. It derives the query URL with `canonicalCloneUrl` + `ensureGitSuffix`, builds the host credential bundle with the existing `buildCloneAuth`, consults a per-URL memo, filters candidates by the dependency's OWN `<pluginName>--v` prefix, parses the remainder as a version, keeps those that satisfy the range, and returns the highest. It never falls through to the repository head.
- **One uniform no-match.** Per D-03-09 the probe carries no branch on whether the tag query ran against the dependency's own source repository or its marketplace repository: both return `{ kind: "no-matching-tag", range }` with the range bounded by `renderConstraintRange`. Two mirrored test cases assert the two sources produce the identical arm.
- **The NFR-5 gate needed no edit.** `dependency-tag-probe.ts` is absent from `NETWORK_FREE_TARGETS` while `install-flow.ts` and `install-outcome.ts` stay in it -- the same arrangement `install-clone-probe.ts` already uses. `node --test tests/architecture/no-orchestrator-network.test.ts` passes with no change to that group.
- Both new modules carry complete direct line, branch and function coverage (`platform/git.ts` 594/594 lines, 64/64 branches, 15/15 functions; `dependency-tag-probe.ts` 236/236 lines, 30/30 branches, 4/4 functions), and `npm run check` exits 0.

## Task Commits

1. **Task 1: List a remote's tags through the single git chokepoint** - `ed1432ad` (feat)
2. **Task 2: Confirm live tag resolution before it ships** - no commit (decision checkpoint, see below)
3. **Task 3: Turn a constraint into a pinned tag, or a named failure** - `1481bdf9` (feat)

**Plan metadata:** the `docs(03-04): complete the live tag resolution plan` commit, which carries this file (a commit cannot record its own hash).

## Checkpoint Outcome (Task 2)

Task 2 was a `type="checkpoint:decision"` task carrying `gate="blocking-human"`, so it stopped in every mode and was answered by the developer rather than auto-selected.

**The developer's reply, verbatim: `proceed-as-decided`.**

Selected from the three-option menu `proceed-as-decided` / `soften-no-match` / `stop-and-rescope`. Task 3 therefore ran UNAMENDED, and the two facts the checkpoint put up for confirmation stand as recorded:

- **D-03-09 is upheld.** The probe hard-fails a no-match in BOTH query arms. Upstream's asymmetric soft-degrade -- where a query against the marketplace repository falls through to a copy of the repository head -- is deliberately not ported, matching D-03-08's precedent of a uniform failure model over upstream's case-by-case soft degrades.
- **The `<pluginName>--v<semver>` release-tag convention stands as the only candidate filter.** The developer was shown, and accepted, that a constrained dependency against a source not following that convention reports no matching tag and, under D-03-07's all-or-nothing rollback, fails the whole install. That is expected behavior for most third-party sources today, not a defect to engineer around.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - `listRemoteTags`, plus the exported `ListRemoteTagsOptions` and `RemoteTag` shapes and the `refs/tags/` / `^{}` constants.
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts` - the probe, its injectable listing seam, the three-armed result, and the module header recording the gate placement and the D-03-09 divergence.
- `tests/platform/git.test.ts` - the tag-listing cases beside the existing remote-ref ones, on the same transport double.
- `tests/orchestrators/plugin/dependency-tag-probe.test.ts` - 15 cases, all against a faulted seam, never the network.
- `tests/architecture/gate-targets.ts` - the `domain/dependency-range.ts` entry in `UNOWNED_EXPORT_CENSUS` (see the deviation below).

## Decisions Made

- **D-03-26: the probe is NOT a `CREDENTIAL_LEAK_TARGETS` member.** Task 3's action asked that this be decided and recorded rather than assumed. It composes a credential bundle through `buildCloneAuth` and hands it to the listing call; it never reads a credential field, never writes one to state, and never interpolates one into an error or a returned arm. That is structurally what `install-clone-probe.ts` does, and that module is also absent from the group. The gate's two scans address state-write field names and `git-credential.ts` error interpolation -- neither has a surface here. The group is additionally destructured POSITIONALLY against a pinned `DECLARED_MODULE_ORDER`, so adding a member that the scans would not exercise costs a pin edit and buys nothing.
- **Parsing is not evaluating.** The probe uses `semver`'s `valid` to parse a candidate's version part and `gt` to order candidates, but asks `domain/dependency-range.ts`'s `recordedVersionSatisfies` whether a version satisfies the range. A second satisfaction evaluator is what the plan's key link forbids; a parse and a comparison are not one.
- **A tag whose version part does not parse is skipped, not an error.** An unrelated naming scheme living in the same repository is a normal condition, and failing the probe over one would make a repository's other tags unusable.
- **The query URL is the wire form, not the cache-key identity.** `canonicalCloneUrl`'s own contract says a caller sending it to the network passes it through `ensureGitSuffix` first (MURL-01); the tests assert the seam receives `…/formatter.git`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The unowned-export census was left un-amended, so `npm run check` was already red**

- **Found during:** Task 3 (at the plan-level `npm run check` verification)
- **Issue:** `tests/architecture/unowned-exports-census.test.ts` re-measures `UNOWNED_EXPORT_CENSUS` with `fallow dead-code --production --unused-exports` and asserts exact equality. Two separate drifts had accumulated against that pin. Measured at this plan's Task 1 commit, `platform/git.ts` reported an extra unowned export, `listRemoteTags` -- Task 1 added it with no production reader and did not write it down, so `npm run check` had been failing since `ed1432ad`. Task 3's probe imports `listRemoteTags`, which closes that half. But importing `recordedVersionSatisfies` and `renderConstraintRange` also turned `domain/dependency-range.ts` from an entirely unreferenced file (reported as no export at all under this issue class) into a referenced file whose three exports no production entry point reaches, so all three surfaced as unowned.
- **Fix:** Added the `domain/dependency-range.ts` entry to `UNOWNED_EXPORT_CENSUS` with an inline comment naming the condition that removes it -- the commit in which the install cascade composes the probe. No entry was removed: `platform/git.ts`'s pinned three-export list is already correct once the probe reads `listRemoteTags`.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** the census gate was run with the two new files temporarily moved aside, which reproduced the pre-existing `listRemoteTags` delta at `ed1432ad` and proved the failure was not introduced by Task 3. All three census cases pass after the amendment, and `npm run check` exits 0 (6289 unit + 32 integration tests, 0 failures).
- **Committed in:** `1481bdf9` (Task 3 commit), which is what the census's own header requires: "any change to the export surface of the tree has to be written down in the same commit that causes it".

**2. [Rule 3 - Blocking] A test double rejecting with a non-Error tripped the lint gate**

- **Found during:** Task 3
- **Issue:** The probe must wrap a non-`Error` throw, so its test needs a seam that rejects with a string. `Promise.reject(error)` over an `unknown` fails `@typescript-eslint/prefer-promise-reject-errors`, and the obvious escapes are worse: a cast to `Error` is a double assertion the project's unit-testing rules classify as a finding, and an `async` method that only throws trips `@typescript-eslint/require-await`.
- **Fix:** The double throws from inside a `Promise.resolve().then(...)` callback, which needs no cast and no `async`. `@typescript-eslint/only-throw-error` permits throwing an `unknown` by default.
- **Files modified:** `tests/orchestrators/plugin/dependency-tag-probe.test.ts`
- **Verification:** `npx eslint` clean on both new files; the non-Error case asserts the wrapped `cause`.
- **Committed in:** `1481bdf9`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blockers).
**Impact:** Deviation 1 is the consequential one -- it means the phase's quality gate had been red for one commit and is green again, and it leaves a dated removal condition in the census rather than a silent entry. Neither deviation changed a line of the plan's specified behavior.

## Issues Encountered

- **TruffleHog cannot scan this checkout.** `/home/acolomba/src/pi-claude-marketplace-manifest` is a linked git worktree, so `.git` is a file and TruffleHog fails to read the index. Both commits in this plan ran `SKIP=trufflehog`, per the repository's own worktree guidance. Every other pre-commit hook passed.
- **The census issue class is presence-sensitive, which made the failure look like Task 3's.** `fallow dead-code --production --unused-exports` does not list the exports of a file nothing references at all -- that is a different issue class. So `domain/dependency-range.ts` was invisible to the census until the probe imported from it, and the delta appeared to arrive with Task 3. Moving the two new files aside and re-measuring is what separated the two drifts; it is worth doing before attributing a census delta to the commit that surfaced it.

## Threat Flags

None. The plan's threat register is addressed in code: candidate selection is bounded by the dependency's own name prefix and a real version parse (T-03-13), the query is a structured library call with no shell and no argument vector (T-03-14), the prefix filter runs before any version parsing and the per-URL memo bounds one cascade to one listing (T-03-15), no credential value reaches a returned arm (T-03-16), and both install owners remain in `NETWORK_FREE_TARGETS` with zero git surface (T-03-17). T-03-18 (a tag moved on the remote between probe and clone) stays accepted: the existing clone-cache pin path carries the project's pinning guarantees and this plan adds none.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `probeDependencyTags` is ready for the cascade to compose. Inject it under a field name the NFR-5 gate does not match -- `tagProbe`, following `install-outcome.ts`'s `cloneProbe` precedent -- and keep `install-flow.ts` / `install-outcome.ts` free of any `gitOps` token.
- **The cascade MUST also drop the `domain/dependency-range.ts` entry from `UNOWNED_EXPORT_CENSUS`** in the same commit that makes the probe production-reachable, or the census gate fails in the opposite direction. The entry carries that instruction inline.
- `DependencyTagProbeOptions.tagMemo` is the analogue of the existing `authMemo` and should be created once per cascade run and threaded through every member, so one repository is listed once.
- The two new failure discriminants (`no-matching-tag`, `tag-listing-failed`) are stable. Neither has a closed-set `REASONS` token yet; `"network unreachable"` and `"authentication required"` already exist and the failure arm's `classification` field hands them over directly, so only `no-matching-tag` is likely to need a vocabulary amendment and its COMPAT-01 pin edit.
- Decision IDs through **D-03-26** are now allocated; a later plan should mint from D-03-27.

---

_Phase: 03-dependency-resolution_
_Completed: 2026-09-15_

## Self-Check: PASSED

Both created files exist on disk, all three modified files exist, and both task commits (`ed1432ad`, `1481bdf9`) are present in the repository.
