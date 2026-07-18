---
phase: 77-plugin-clone-cache-install
plan: 02
subsystem: api
tags: [resolver, git-source, discriminated-union, dependency-injection, typescript]

# Dependency graph
requires:
  - phase: 76-marketplace-git-url-sources
    provides: "domain/source.ts parsing of url / git-subdir / github object sources"
  - phase: 64-resolver-three-way-state
    provides: "three-way installable / partially-available / unavailable resolver union (NFR-7)"
provides:
  - "sourceUnsupportedReason widened: url / git-subdir / github resolve installable; npm / unknown still reject"
  - "GitPluginRootResult discriminated union (materialized is the only pluginRoot-bearing arm)"
  - "ResolveContext.resolveGitPluginRoot injection seam for clone-vs-probe policy"
  - "preflightStages git-source pluginRoot derivation branched from path sources; git-subdir containment clone-root-anchored"
affects: [77-04-install-clone-cache, list, info, plugin-state-classifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected optional callback on ResolveContext (mirrors readFileText/statKind) keeps the domain network-free while install supplies a clone-materializing policy and list/info omit it"
    - "Result-arm discriminated union (materialized-only pluginRoot) enforces NFR-7 at the injection boundary, parity with the ResolvedPlugin union"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - tests/domain/resolver-strict.test.ts

key-decisions:
  - "Git-subdir NFR-10 containment is the callback's responsibility (anchored to the clone root), surfaced to the resolver as the escapes result arm — the resolver never marketplaceRoot-anchors a clone path (PURL-03)"
  - "not-cached resolves unavailable with a plain 'not installed' note; the list surface stays network-free by NOT injecting resolveGitPluginRoot, so this arm is never reached during list"
  - "No new closed-set REASONS token minted: resolver notes are free-form strings narrowed at the render boundary (narrowResolverNotes), so 'not installed' / 'git source requires a clone-cache resolver' / the callback's escape+missing details fall through to the existing render vocabulary"

patterns-established:
  - "Optional-injection callback seam: git-source policy is injected, not decided in the domain (D-11/D-13 boundary preserved)"
  - "Result-union NFR-7 discipline extended to an injected callback's return type"

requirements-completed: [PURL-01, PURL-03]

coverage:
  - id: D1
    description: "url / git-subdir / github-object plugin sources resolve installable when resolveGitPluginRoot materializes the clone root"
    requirement: "PURL-01"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: url source + materialized callback -> installable carrying the clone pluginRoot"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: git-subdir source + materialized callback -> installable carrying the clone pluginRoot"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: github-object source + materialized callback -> installable carrying the clone pluginRoot"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm stays unavailable; a git source with no injected callback resolves unavailable (path-only back-compat)"
    requirement: "PURL-01"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: npm source stays unavailable with unsupported-source note"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: url source with NO resolveGitPluginRoot injected -> unavailable (path-only back-compat)"
        status: pass
    human_judgment: false
  - id: D3
    description: "git-subdir containment anchored to the clone root — an escaping subdir resolves unavailable; a missing subdir resolves unavailable with detail (PURL-03)"
    requirement: "PURL-03"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-03: escapes result -> unavailable carrying the escape detail"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-03: missing-subdir result -> unavailable carrying the missing detail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Three-way state and NFR-7 non-readability preserved; git sources feed the unchanged dir-existence + manifest downstream stages"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: not-cached result -> unavailable (never carries pluginRoot)"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: materialized clone with malformed plugin.json -> unavailable with the manifest note"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PURL-01: materialized clone whose dir is absent -> unavailable (source dir does not exist)"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 34min
completed: 2026-07-11
status: complete
---

# Phase 77 Plan 02: Resolver git-source widening Summary

**The resolver now classifies url / git-subdir / github-object plugin sources as installable by delegating clone-vs-probe to an injected `resolveGitPluginRoot` callback, staying network-free for list/info while anchoring git-subdir containment to the clone root (NFR-7 preserved via a materialized-only result arm).**

## Performance

- **Duration:** 34 min
- **Started:** 2026-07-11T10:47:00Z
- **Completed:** 2026-07-11T11:20:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Widened `sourceUnsupportedReason` to an exhaustive switch: `url` / `git-subdir` / `github` / `path` return `undefined` (installable); `npm` / `unknown` still reject with their reasons (PURL-01, D-77-01).
- Added the `GitPluginRootResult` discriminated union — `materialized` (carries `pluginRoot` + `resolvedSha`), `not-cached`, `escapes`, `missing-subdir` — with `materialized` as the only `pluginRoot`-bearing arm, mirroring the ResolvedPlugin union's NFR-7 discipline.
- Added the optional `ResolveContext.resolveGitPluginRoot` injection seam (mirrors the existing `readFileText` / `statKind` idiom); absent callback => git sources resolve `unavailable` (path-only back-compat for list.ts).
- Branched `preflightStages` pluginRoot derivation into a `deriveSourcePluginRoot` helper: `path` keeps the verbatim marketplaceRoot escape check; git kinds delegate to the callback and feed the unchanged downstream dir-existence + manifest stages. git-subdir NFR-10 containment is anchored to the clone root inside the callback and surfaces as the `escapes` result (PURL-03).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1+2 RED: failing git-source resolver tests** - `cc4e9a9f` (test)
2. **Task 1+2 GREEN: widen resolver for git-source plugins** - `997e4645` (feat)

_The two TDD tasks share one resolver file and one test file; the RED commit adds the failing cases for both tasks (widening + preflightStages branch), and the single GREEN commit implements both since Task 2's `preflightStages` branch is what makes the Task 1 materialized/escapes/missing-subdir cases pass. No refactor commit was needed._

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/resolver.ts` - Widened `sourceUnsupportedReason`; added `GitPluginRootResult` union; added `ResolveContext.resolveGitPluginRoot`; added `deriveSourcePluginRoot` helper branching path vs git pluginRoot derivation.
- `tests/domain/resolver-strict.test.ts` - Added a `gitCtx` helper and 12 git-source cases (materialized url/git-subdir/github, npm-still-unavailable, no-callback back-compat, path-escape regression, escapes/missing-subdir/not-cached, materialized-then-malformed-manifest, materialized-then-absent-dir); updated 2 pre-existing PR-2(1) tests that asserted the superseded "unsupported source kind" contract for github/url.

## Decisions Made
- **Git-subdir containment stays clone-root-anchored inside the callback** (PURL-03 / NFR-10): the resolver does NOT add a marketplaceRoot-anchored `assertPathInside` for git sources; the escape surfaces as the `escapes` result arm. This matches the research recommendation (the callback holds `cloneRoot` in scope).
- **No new closed-set REASONS token minted.** Resolver `notes` are free-form strings narrowed at the render boundary (`shared/probe-classifiers.ts::narrowResolverNotes`), not the closed `Reason` vocabulary. The new notes (`git source requires a clone-cache resolver`, `not installed`, and the callback-supplied escape/missing details) fall through the existing narrowing to `unsupported source`, so the closed set is unchanged. Preferred reuse over amendment per the lockstep catalog policy.
- **`not-cached` resolves `unavailable` with a plain `not installed` note.** The list surface stays network-free by not injecting the callback, so this arm is only reachable by a probe-style caller (a later-phase concern); the resolver keeps it structurally `unavailable` with no `pluginRoot` leak.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two pre-existing tests asserting the superseded resolver contract**
- **Found during:** Task 1 (GREEN)
- **Issue:** `PR-2(1) non-path source kind (github)` and `PR-2(1) upstream object source kind (url)` asserted that github/url sources resolve `unavailable` with an `unsupported source kind` note. PURL-01 deliberately makes these kinds installable, so the note changed — both still resolve `unavailable` when no callback is injected (path-only back-compat), but via the new `git source requires a clone-cache resolver` note, not the old rejection.
- **Fix:** Retitled both tests and updated their note assertions to match the PURL-01 back-compat contract (state stays `unavailable`, note now mentions `clone`).
- **Files modified:** tests/domain/resolver-strict.test.ts
- **Verification:** Full four-file resolver suite green (78 tests); typecheck green.
- **Committed in:** `997e4645` (GREEN commit)

**2. [Rule 3 - Blocking] Explicit npm/unknown narrowing inside `deriveSourcePluginRoot`**
- **Found during:** Task 2 (GREEN)
- **Issue:** After the `path` branch, TypeScript still saw the full `ParsedSource` union (including `NpmSource` / `UnknownSource`) at the `resolveGitPluginRoot(parsedSource)` call, failing typecheck (TS2345). The caller's `sourceUnsupportedReason` gate already excludes npm/unknown, but TS cannot see that across the helper boundary.
- **Fix:** Added an explicit `kind` guard in the helper narrowing to the three git kinds before the callback call; the unreachable npm/unknown fallthrough returns `unavailable` with an `unsupported source kind` note (defensive, never hit at runtime).
- **Files modified:** extensions/pi-claude-marketplace/domain/resolver.ts
- **Verification:** `npm run typecheck` passes.
- **Committed in:** `997e4645` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug: superseded-contract test update; 1 blocking: TS narrowing).
**Impact on plan:** Both were necessary to land the planned widening (the test update reflects the intended PURL-01 contract change; the narrowing satisfies the plan's typecheck acceptance criterion). No scope creep.

## Issues Encountered
- Trufflehog pre-commit hook cannot scan inside the Claude Code worktree (the worktree `.git` is a file, not a directory, so trufflehog's git-index read fails). This is the documented worktree limitation in the project CLAUDE.md; commits used `SKIP=trufflehog` per the sanctioned workaround. Test fixtures use obviously-fake hex strings (`deadbeef...`); no real secrets.
- The worktree lacked `node_modules`; symlinked the main repo's `node_modules` (gitignored, never staged) so `node --test` / `tsc` / eslint / prettier run against the worktree source.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The injection seam is ready for Plan 04 (install) to supply a clone-materializing `resolveGitPluginRoot` callback; list/info omit it and stay network-free (the `no-orchestrator-network` gate on list.ts is untouched).
- `GitPluginRootResult.materialized.resolvedSha` is threaded for the `sha-<12hex>` version + full-sha state field that later plans record.
- No blockers.

## Self-Check: PASSED

- Files exist on disk: `domain/resolver.ts`, `tests/domain/resolver-strict.test.ts`, `77-02-SUMMARY.md`.
- Commits present: `cc4e9a9f` (test RED), `997e4645` (feat GREEN).
- TDD gate order correct: `test(77-02)` precedes `feat(77-02)`.
- Verification: `node --test` across all four resolver test files → 78 pass / 0 fail; `npm run typecheck` clean; eslint + prettier clean on touched files.

---
*Phase: 77-plugin-clone-cache-install*
*Completed: 2026-07-11*
