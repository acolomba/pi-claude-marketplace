---
phase: quick-260718-x2o
plan: "01"
subsystem: plugin-clone-cache
tags: [sonar, S8786, coverage, seeding, clone-cache]
status: complete
provides:
  - "S8786-safe origin-url regex in readOriginRemoteUrl (clone-cache.ts)"
  - "behavioral coverage for the same-repo seeding new-code branches"
requires:
  - "quick 260718-v2a same-repo seeding implementation"
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - tests/orchestrators/plugin/clone-cache-seed.test.ts
decisions:
  - "add.ts:597-598 outer catch left as defense-in-depth: unreachable through the public addMarketplace surface"
metrics:
  duration: ~35m
  completed: 2026-07-19
  tasks: 2
  files: 2
---

# Quick Task 260718-x2o: fix Sonar S8786 regex smell and cover new-code gaps Summary

Linearized the origin-url regex in `readOriginRemoteUrl` to clear SonarCloud
`typescript:S8786` (super-linear match), then added three behavioral tests
closing the same-repo seeding new-code coverage gaps; the add.ts outer catch is
documented as unreachable defense-in-depth.

## Task 1: fix S8786 super-linear regex

Replaced `/^url\s*=\s*(.+)$/` with `/^url\s*=(.*)$/` in `readOriginRemoteUrl`
(clone-cache.ts). The flagged ambiguity is `\s*` and `(.+)` both matching
spaces; `=(.*)` removes the overlap. The capture is optional-chained, trimmed,
and returned only when non-empty, so a bare `url =` still yields `undefined` --
behavior is identical to the prior pattern. The `[remote "origin"]` section
regex was left untouched (not flagged).

Verified by the existing origin-parsing tests (SEED-02 Case B cases) plus the
new non-git-canonical-origin test: all pass.

## Task 2: cover the uncovered seeding branches

Added three tests to `tests/orchestrators/plugin/clone-cache-seed.test.ts`:

1. **deriveMarketplaceUrl fallthrough (clone-cache.ts ~321-322).** A
   path-marketplace whose checkout origin is a local filesystem path (not an
   https git source): `parsePluginSource` classifies it `path`, so
   `deriveMarketplaceUrl` falls through to `return undefined` and the sweep is a
   no-op. Asserts the plugin stays unseeded.
2. **EEXIST/ENOTEMPTY rename swallow arm (clone-cache.ts ~381-389).** A pinned
   same-repo source with a stub `gitOps.checkout` that populates the destination
   clone dir after the warm short-circuit passed, so the staging->dest `rename`
   fails ENOTEMPTY. Asserts no throw, the concurrent winner's tree survives
   (warm-cache win, no overwrite), and staging is cleaned.
3. **non-EEXIST rethrow + per-entry swallow (clone-cache.ts ~386-388 and
   ~449-451).** Two same-repo entries; the pinned entry's stub checkout removes
   the staging tree so its `rename` fails ENOENT (not EEXIST/ENOTEMPTY),
   rethrowing from `seedOnePluginMirror` into the per-entry swallow. Asserts the
   sweep completes, the failed pinned entry is not seeded, the sibling unpinned
   entry still seeds (per-entry isolation), and staging is cleaned.

A coverage run scoped to the seed test file confirms lines 321-322, 381-389, and
449-451 are no longer in the uncovered set.

### Task-2 item 4: add.ts:597-598 outer catch reachability finding

**Finding: NOT reachable through the public `addMarketplace` surface. Left as
defense-in-depth (no test added, no code contorted), per the plan's
instruction.**

The outer `try/catch` around `seedSameRepoPluginMirrors` in add.ts only fires if
the sweep throws OUTSIDE its own per-entry `try`. Every call on that path is
non-throwing for input that passes `marketplace add` validation:

- `parsePluginSource` (source.ts) is a **total function** -- it returns an
  `unknown`-kind `ParsedSource` for any unrecognized input rather than throwing.
  So the entry-source parse (line 435) and the origin re-parse inside
  `deriveMarketplaceUrl` cannot throw.
- `canonicalCloneUrl` (clone-key.ts) is **pure string building** -- it never
  throws, and it is only called on the url/git-subdir/github kinds the guard at
  line 436 already narrowed to.
- `deriveMarketplaceUrl` self-swallows: `readOriginRemoteUrl` catches its own
  fs errors and returns `undefined`.
- `loadState` and `loadMarketplaceManifest` read artifacts the add itself **just
  wrote and validated** immediately before seeding (state committed;
  manifest already loaded during the add flow), so they do not throw for
  add-validated input.

The only way to trip the catch is external interference between the committed
add and the best-effort sweep (state.json / manifest deleted or corrupted, or a
raw filesystem error such as EACCES) -- precisely the defense-in-depth scenario
the catch exists for. Reproducing it would require contorting the code or
injecting a filesystem fault outside the public surface, which the plan
explicitly instructs against.

## Deviations from Plan

**1. [Rule 3 - Blocking] Optional-chain the regex capture for
noUncheckedIndexedAccess**
- **Found during:** Task 1 verification (full `npm run typecheck`).
- **Issue:** The first-cut fix used `match[1].trim()`, which the strict
  `noUncheckedIndexedAccess` typecheck flags as possibly `undefined` (TS2532).
  The single-file pre-commit run did not surface it (tsc runs repo-wide).
- **Fix:** Rewrote to `const captured = /.../.exec(line)?.[1];` +
  `if (captured !== undefined)`, matching the prior code's idiom.
- **Files modified:** clone-cache.ts
- **Commit:** 66d67c70

**2. [Rule 3 - Blocking] Reorder GitOps type import for import-x/order**
- **Found during:** Task 2 verification (`npm run lint`, `eslint .`).
- **Issue:** The added `GitOps` type import sat after the `locations` type
  import, violating `import-x/order` alphabetical ordering.
- **Fix:** Moved the `orchestrators/marketplace/shared.ts` type import ahead of
  the `persistence/*` type imports.
- **Files modified:** tests/orchestrators/plugin/clone-cache-seed.test.ts
- **Commit:** 66d67c70

Both deviations were green-check fixups on already-committed work; per the repo's
no-rewrite-history rule they landed as a follow-up `fix:` commit rather than an
amend.

## Known Stubs

None.

## Verification

`npm run check` (typecheck + lint + format:check + test + test:integration): green.
The 13 seed unit tests (10 existing + 3 new) pass; coverage confirms the target
new-code lines are covered.

## Self-Check: PASSED

- clone-cache.ts modified: FOUND
- clone-cache-seed.test.ts modified: FOUND
- Commit e3a69129 (Task 1 regex fix): present
- Commit 7292e44b (Task 2 tests): present
- Commit 66d67c70 (green-check fixup): present
