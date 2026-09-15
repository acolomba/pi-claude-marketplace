---
phase: 03-dependency-resolution
plan: 02
subsystem: domain
tags: [dependency-resolution, semver, version-constraints, range-intersection, dos-guard]

requires:
  - phase: 01-manifest-read-fidelity
    provides: "domain/dependencies.ts -- the VERSION_PATTERN allowlist every declared range has already passed before it reaches the intersection"
  - phase: 03-dependency-resolution
    plan: 01
    provides: "ClosureMember.ranges -- the per-dependency accumulator this fold consumes"
provides:
  - "semver as this package's own declared runtime dependency, and @types/semver as a dev dependency, so a production install resolves the evaluator rather than borrowing a dev-tooling hoist or a peer's nested tree"
  - "domain/dependency-range.ts: intersectDependencyRanges folds N declared ranges for one dependency name into one effective range or into one of three named failures (invalid, disjoint, too-complex)"
  - "recordedVersionSatisfies: the valid-then-coerce ladder, unguarded for this project's hash- and sha- prefixed recorded versions"
  - "renderConstraintRange: a length bound with an explicit truncation marker for a synthesized range entering a notification reason"
affects:
  [
    live tag resolution,
    already-installed conflict reporting,
    per-member outcome reporting,
    the closed REASONS vocabulary,
  ]

actuals:
  tokens: 6044
  tasks: 2
  commits: 2
plan_head_before: 0e688e4d9013434f670d11294551b6acc8713a97

tech-stack:
  added:
    - "semver ^7.8.5 (dependencies)"
    - "@types/semver ^7.8.0 (devDependencies)"
  patterns:
    - "Both size caps are walked to completion BEFORE any product is allocated, so the guard never has to build the explosion it refuses"
    - "A satisfiability filter written on minimum-version rather than on range validity, because a validator accepts a conjunct pair that admits nothing"
    - "A length bound on synthesized text that inherits an allowlist's character set but not its length"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/dependency-range.ts
    - tests/domain/dependency-range.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "semver is declared because resolution needs a real evaluator, not because it is already present. The hoisted copy comes from the ESLint dev chain and the nested copy from the pi-coding-agent peer, so neither survives a consumer's production install -- the inaccurate half of D-03-01's original rationale is corrected here rather than repeated."
  - "The conjunct cap is walked over every input's branch count before any cross-product is allocated, rather than checked per fold step against a partially built accumulator. The first input needs no separate check because the running product after it IS its own branch count."
  - "The conjunct filter tests minimum-version ONLY. The upstream shape re-validates each conjunct first, but a conjunct is a concatenation of comparator sets a validator already produced, so that arm is unreachable here and would fail the direct-coverage gate."
  - "The intersected range is rejoined with a bare `||` and not re-validated. Every survivor is already a canonical comparator set and a bare `||` is exactly how semver renders a union, so the result is canonical by construction and carries no unreachable null arm."
  - "All three caps (4096 input characters, 1024 conjuncts, 200 rendered characters) are documented as PROJECT-OWNED. The research logs the upstream conjunct value as inferred rather than extracted, so only the guard-before-the-work mechanism claims parity."

patterns-established:
  - "A defensive re-validation copied from an upstream shape can be structurally unreachable in the port; the direct-coverage gate makes keeping it a failure, so the port drops it and states why."
  - "A size guard that walks the whole projected cost first is stronger than a per-step guard, because nothing is allocated even on the input that trips it."

requirements-completed: []

coverage:
  - id: D1
    description: "semver is a declared runtime dependency and @types/semver a declared dev dependency, both locked, so a production install resolves the evaluator itself"
    requirement: RESV-03
    verification:
      - kind: command
        ref: "node -e \"const p=require('./package.json'); ...\" reports declared"
        status: pass
      - kind: command
        ref: "npm run typecheck with a flat named semver import present"
        status: pass
      - kind: architecture
        ref: "node --test tests/architecture/no-telemetry-deps.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "An empty accumulator intersects to the wildcard and a single declared range intersects to its semver-canonical form"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-02.1 an empty accumulator of declared ranges is no constraint"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-02.1 a single declared range intersects to its canonical form"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two overlapping ranges intersect to a range admitting exactly the versions both admit, and a union-bearing input multiplies the branch count"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#RESV-03 two overlapping ranges intersect to the versions both admit"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-02.1 a union-bearing input multiplies the branch count and drops the disjoint cells"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-02.1 a cross-product under the cap keeps every satisfiable cell and drops the rest"
        status: pass
    human_judgment: false
  - id: D4
    description: "A pair with no common version fails as disjoint rather than producing a range that silently matches nothing"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#RESV-03 a disjoint pair fails as a conflict rather than as a range matching nothing"
        status: pass
      - kind: plant
        ref: "replacing minVersion with validRange in isSatisfiableConjunct turns 3 of 20 cases red"
        status: pass
    human_judgment: false
  - id: D5
    description: "A range the validator rejects fails as invalid and names the field position, never the raw text of an adjacent element"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#RESV-03 an unparseable declared range names its position and no sibling's text"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both size caps fail closed as too-complex BEFORE the work they bound: total characters before any parse, projected conjuncts before any product allocation"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#T-03-07 total input characters are measured before any range is parsed"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#T-03-07 a cross-product over the conjunct cap fails before the product is allocated"
        status: pass
    human_judgment: false
  - id: D7
    description: "A recorded version normalizes through the same coerce ladder as any other candidate, with no special case for this project's hash- or sha- prefixed forms, and one that normalizes to nothing satisfies no range"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-04 a content-hash recorded version runs the unguarded coercion ladder"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-04 a git-sha recorded version runs the unguarded coercion ladder"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#D-03-02.3 the recorded-version ladder resolves a string that normalizes to nothing"
        status: pass
    human_judgment: false
  - id: D8
    description: "An intersected range rendered into a reason is bounded so a maximally wide cross-product cannot flood a notification row"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#T-03-08 a range past the rendering bound is truncated and names what it dropped"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#T-03-08 a range widened by intersection is bounded before it can reach a reason"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every failure arm is reachable from a declared-range input and none of them throws"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/dependency-range.ts (branches 40/40, functions 12/12, lines 269/269)"
        status: pass
    human_judgment: false

duration: 41min
completed: 2026-09-15
status: complete
---

# Phase 3 Plan 2: Dependency version-constraint algebra Summary

**`semver` is now this package's own declared runtime dependency, and `domain/dependency-range.ts` folds the N ranges declared for one dependency name into one effective range or into one of three named failures -- with both denial-of-service caps walked to completion before any work they bound is allocated.**

## Performance

- **Duration:** ~41 min
- **Started:** 2026-09-15T01:16Z
- **Completed:** 2026-09-15T01:57Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **`semver@^7.8.5` in `dependencies`, `@types/semver@^7.8.0` in `devDependencies`**, both locked in the same commit. The declaration is a genuine new runtime dependency: `npm ls semver` in this tree resolves a hoisted `7.8.5` from the ESLint dev-tooling chain and a nested `7.8.0` under the `@earendil-works/pi-coding-agent` peer, and neither chain is guaranteed present in a consumer's production install.
- **`intersectDependencyRanges`** returns the canonical effective range for every satisfiable input set, and `invalid`, `disjoint` or `too-complex` otherwise. Each arm carries a `detail` assembled from measurements and field positions only -- never the raw text of a declared range, so one element's content cannot be reported against another's failure.
- **Both caps run before the work they bound.** Total input characters are summed before a single range is parsed; the projected conjunct count is walked over every input's branch count before a single cross-product cell is allocated. The over-cap fixture projects to 16,777,216 conjuncts and completes in under a millisecond, which it could not if the guard ran after the product.
- **The disjointness detection is the minimum-version test, not range validation.** A validator accepts `">=2.0.0 <1.0.0"`; only `minVersion` returns null for it. Planting a validity-only filter turns three of the twenty cases red.
- **`recordedVersionSatisfies`** runs every candidate through the same `valid` then `coerce` ladder, with no guard for the `hash-<12hex>` and `sha-<12hex>` forms this project produces (D-03-04). The tests derive the expected answers from the unguarded ladder -- both forms coerce to `123.0.0` and are held against `^123.0.0` and `^1.0.0` -- rather than from a rejection.
- **`renderConstraintRange`** bounds a range at 200 characters with a `... (+N chars)` marker. The doc comment states why: an intersected range is synthesized text that inherits the declared allowlist's character SET but not its 64-character length bound.
- Direct coverage is complete: branches 40/40, functions 12/12, lines 269/269. `npm run check` exits 0.

## Task Commits

1. **Task 1 + Task 2: declare semver and fold N ranges into one** - `c1e0f201` (feat)
2. **Test-matrix strengthening pass** - `aa333379` (test)

**Plan metadata:** the `docs(03-02): complete the version-constraint algebra plan` commit, which carries this file (a commit cannot record its own hash).

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependency-range.ts` - the intersection, the recorded-version ladder, the rendering bound, and the three project-owned caps.
- `tests/domain/dependency-range.test.ts` - 20 cases over the whole contract.
- `package.json` - `semver` in `dependencies`, `@types/semver` in `devDependencies`.
- `package-lock.json` - the recorded resolution for both.

## Decisions Made

- **The conjunct cap walks the whole projected cost first.** The plan described a per-fold-step check against a partially built accumulator. Walking every input's branch count first is strictly stronger: on the input that trips the cap, nothing has been allocated at all. It also removes the plan's separate "check the FIRST input's own branch count" step, because the running product after the first input IS that input's branch count.
- **The satisfiability filter tests minimum-version only.** The upstream shape re-validates each conjunct before testing it. A conjunct here is a concatenation of comparator sets that `validRange` itself produced, so the validator can never reject one -- the arm is structurally unreachable and the project's direct-coverage gate admits no unreachable branch. The prohibition the plan names ("must never rely on `semver.validRange` alone") is satisfied by the stronger form.
- **The result is rejoined with a bare `||` and not re-validated.** `validRange` renders a union as trimmed comparator sets joined by a bare `||`, so rejoining the survivors the same way reproduces the canonical form exactly and avoids a second unreachable null arm.
- **All three caps are documented as project-owned.** Research assumption A1 records the upstream conjunct value as inferred from a minifier-reused binding rather than extracted, so the doc comments claim parity on the guard-before-the-work mechanism and on nothing else.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] The dependency declaration cannot land as its own commit**

- **Found during:** Task 1 (at commit time)
- **Issue:** The plan's Task 1 commits `package.json` and `package-lock.json` alone. `fallow dead-code` -- a mandatory member of the `check` chain and a pre-commit hook -- reports `semver` as an unused dependency until something imports it, so the hook failed and the standalone commit was refused. A commit that lands red is bisect-hostile and would fail CI on its own SHA.
- **Fix:** Task 1's manifest change ships in the same commit as Task 2's module, which is its first consumer. Both acceptance criteria that bind the two files together ("`package-lock.json` is modified in the same commit as `package.json`", "`npm run typecheck` reports no errors with a probe import of `satisfies` from the `semver` package present in the tree") are satisfied. The typecheck criterion was additionally verified in isolation before the module existed, using a temporary probe module that imported `satisfies` and was removed after `tsc --noEmit` exited 0.
- **Files modified:** none beyond the plan's own file list.
- **Verification:** `SKIP=trufflehog pre-commit run --files package.json package-lock.json extensions/.../dependency-range.ts tests/.../dependency-range.test.ts` passes every hook; `npm run check` exits 0.
- **Commit:** `c1e0f201`

**2. [Rule 1 - Bug] Two cases would have passed a wrong implementation**

- **Found during:** the post-implementation review pass against the project's `typescript-unit-testing-review` skill
- **Issue:** Three cases asserted during their `// arrange` phase, and two asserted a length or a bare `ok` flag where the whole value was the promise. The cap-boundary case in particular asserted only `intersected.ok === true` over a 1024-conjunct fixture, which a wrong range would have passed.
- **Fix:** The disjointness control now rides in the same whole value as the outcome it explains. The cap-boundary fixture is replaced by a seven-input union cross-product whose two surviving conjuncts are small enough to author by hand, so the case pins the product AND the disjoint cells the filter drops. The rendering case compares the complete rendered string against an expectation derived from its own input.
- **Files modified:** `tests/domain/dependency-range.test.ts`
- **Verification:** 20 cases pass; direct coverage unchanged at branches 40/40, functions 12/12, lines 269/269; planting a validity-only filter turns 3 cases red.
- **Commit:** `aa333379`

**Total deviations:** 2 auto-fixed (1 Rule 3 blocker, 1 Rule 1 bug).
**Impact:** Deviation 1 costs the plan one commit boundary and nothing else -- the same class of gate collision plan 03-01 hit with the coverage hook, and worth recording as a recurring shape: this repository's gates run over the whole tree, so a commit that introduces one half of a two-part change is refused. Deviation 2 is the substantive one: the suite as first written had two cases that could not have failed.

## Issues Encountered

- **TruffleHog cannot scan this checkout.** `/home/acolomba/src/pi-claude-marketplace-manifest` is a linked git worktree, so `.git` is a file and TruffleHog fails to read the index. Both commits ran `SKIP=trufflehog`, per the repository's own worktree guidance and plan 03-01's precedent. Every other pre-commit hook passed.
- **No production consumer yet.** `dependency-range.ts` is reachable only from its own test until the cascade wiring lands. `fallow dead-code` accepts this because `.fallowrc.json` sets `production: false`, so a test counts as a consumer; the first plan that imports the module from `install-cascade.ts` changes nothing here.

## Known Stubs

None. Every exported function is implemented and exercised.

## Threat Flags

None. `dependency-range.ts` performs no network and no filesystem I/O, imports only `semver`, and introduces no new endpoint, auth path or trust boundary. The three threats the plan's register assigns to this module (T-03-07 denial of service, T-03-08 row flooding, T-03-09 misleading disjointness) are each mitigated and each carries a named test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `intersectDependencyRanges` is the input to the tag probe: a result of `{ok: true, range: "*"}` means no constraint and the probe can be skipped entirely, which is the branch D-03-02.2 turns on.
- `renderConstraintRange` is ready for the reason-token work; it bounds whatever text the closed-set `REASONS` rendering decides to carry.
- `recordedVersionSatisfies` is the whole of D-03-02.3's `installed-unsatisfied` check. The caller supplies the recorded version string and the intersected range; nothing else is needed.
- The three failure discriminants (`invalid`, `disjoint`, `too-complex`) are stable and carry human-readable `detail` text. Mapping them onto the closed `REASONS` vocabulary is a separate concern, and `"marketplace not added"` aside, none of them has an existing member.

---

_Phase: 03-dependency-resolution_
_Completed: 2026-09-15_

## Self-Check: PASSED

Both created files exist on disk and both task commits (`c1e0f201`, `aa333379`) are present in the repository.
