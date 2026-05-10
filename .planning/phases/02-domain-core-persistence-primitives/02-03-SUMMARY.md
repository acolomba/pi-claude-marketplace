---
phase: 02-domain-core-persistence-primitives
plan: 03
subsystem: domain
tags: [name-validation, hash-version, sha256, normalization, fixtures, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: assertPathInside chokepoint (defense-in-depth peer to assertSafeName)
provides:
  - assertSafeName(name: string): void -- RN-2 path-safety validator
  - generatedSkillName / generatedCommandName / generatedAgentName -- RN-1 deterministic name generators
  - computeHashVersion(pluginRoot): Promise<string> -- PI-7 hash-version helper
  - HASH_WALK_SKIP frozen list -- D-12 walk filter contract
  - Pinned snapshot hash hash-743f35130ec4 freezing the PI-7 algorithm
affects:
  - 02-05 (resolver) -- consumes assertSafeName on every plugin entry name and component-path basename
  - phase-03 (bridges) -- consumes generated names for staged-file paths
  - phase-05 (install/update) -- consumes computeHashVersion for PI-7 fallback

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic SHA-256 walk: posix-joiner for hash bytes + OS-aware joiner for fs reads (Pitfall 6)"
    - "D-11 normalization: BOM-strip + CRLF->LF before hashing"
    - "D-12 walk-filter: Object.freeze readonly tuple of skip names ('.git', 'node_modules', '.DS_Store')"
    - "Snapshot-locked hash contract: pinned 12-hex value, future changes require CHANGELOG entry"
    - "Test-time fixture materialization for git-untrackable paths (.git/HEAD via before() hook)"

key-files:
  created:
    - extensions/claude-marketplace/domain/name.ts
    - extensions/claude-marketplace/domain/version.ts
    - tests/domain/name.test.ts
    - tests/domain/version.test.ts
    - tests/domain/fixtures/hash-stability/sample-plugin/plugin.json
    - tests/domain/fixtures/hash-stability/sample-plugin/skills/foo.md
    - tests/domain/fixtures/hash-stability/sample-plugin/.DS_Store
    - tests/domain/fixtures/hash-stability/sample-lf/file.txt
    - tests/domain/fixtures/hash-stability/sample-crlf-bom/file.txt
  modified:
    - .gitattributes
    - .pre-commit-config.yaml

key-decisions:
  - "PI-7 SNAPSHOT pinned at hash-743f35130ec4 -- this is the stable user contract over (algorithm + 12-char truncation + HASH_WALK_SKIP list + D-11 normalization). Any future change MUST be accompanied by a CHANGELOG entry per the PI-7 contract."
  - "HASH_WALK_SKIP locked at exactly ['.git', 'node_modules', '.DS_Store'] (D-12). Adding/removing entries is a breaking change to the user-visible hash version."
  - "computeHashVersion uses path.posix.join for hash-input path bytes AND path.join for fs reads -- two different joiners on purpose (Pitfall 6 cross-OS reproducibility)."
  - ".git/HEAD fixture materialized at runtime via test before() hook because git refuses to track files under any .git/ path component. The walker still gets a real .git/HEAD to filter, exercising HASH_WALK_SKIP exactly as a freshly-cloned plugin tree would."
  - "Hash-stability fixtures must round-trip byte-for-byte through clone/checkout. .gitattributes 'tests/domain/fixtures/hash-stability/** -text' disables git's CRLF/BOM normalization. Pre-commit global exclude was extended to skip the same path so fix-byte-order-marker / mdformat / markdownlint / prettier do not rewrite fixture content."
  - "Force-add .DS_Store fixture via 'git add -f' to override the global .gitignore .DS_Store rule."

patterns-established:
  - "Snapshot-locked algorithm contract: pin the value, freeze the inputs, require a CHANGELOG entry for re-pin"
  - "Two-joiner walk pattern: posix joiner for cross-platform hash bytes, OS-aware joiner for filesystem reads"
  - "Fixture-via-before-hook for git-untrackable decoys (paths under .git/, paths in global .gitignore)"
  - "Defense-in-depth chokepoints: assertSafeName at the name layer + assertPathInside (Phase 1) at the path layer"

requirements-completed: [RN-1, RN-2]

# Metrics
duration: ~28min (full plan, T1-T4 inclusive)
completed: 2026-05-10
---

# Phase 02 Plan 03: Name + Version Helpers Summary

**Path-safe name validator (RN-2) + three deterministic resource-name generators (RN-1) + PI-7 hash-version helper with D-11 normalization, D-12 walk filter, and a snapshot-locked SHA-256 contract pinned at `hash-743f35130ec4`.**

## Performance

- **Duration:** ~28 min (Tasks 1-3 in worktree; Task 4 in main repo)
- **Started:** 2026-05-10T08:08:00Z (Wave 1 worktree spawn)
- **Completed:** 2026-05-10T08:40:00Z (Task 4 + SUMMARY)
- **Tasks:** 4
- **Files modified:** 11 (4 source/test files + 5 fixture files + 2 config files)

## Accomplishments

- `domain/name.ts` ships `assertSafeName` (RN-2) plus three RN-1 generators (`generatedSkillName`, `generatedCommandName`, `generatedAgentName`) with `<plugin>-` prefix elision per Pitfall 8.
- `domain/version.ts` ships `computeHashVersion` (PI-7) with cross-OS-stable `path.posix.join` hash bytes, D-11 BOM/CRLF normalization, and the frozen `HASH_WALK_SKIP` list (D-12).
- `tests/domain/name.test.ts` covers ≥6 RN-2 reject paths and ≥4 cases per RN-1 generator including double-prefix anti-cases.
- `tests/domain/version.test.ts` pins the snapshot value `hash-743f35130ec4`, asserts the format `/^hash-[0-9a-f]{12}$/`, asserts CRLF+BOM↔LF normalization invariance (D-11), asserts walk-filter exact list (D-12), and asserts determinism across runs.
- Three byte-exact fixture trees committed under `tests/domain/fixtures/hash-stability/`. CRLF+BOM round-trips through git unchanged thanks to the new `.gitattributes` `-text` rule and an extended pre-commit global exclude.

## Task Commits

1. **Task 1: domain/name.ts (assertSafeName + 3 generators)** -- `0b68fd7` (feat)
2. **Task 2: tests/domain/name.test.ts (RN-1, RN-2 coverage)** -- `95568c9` (test)
3. **Task 3: domain/version.ts (computeHashVersion + HASH_WALK_SKIP)** -- `45fd1d7` (feat)
4. **Task 4: tests/domain/version.test.ts + hash-stability fixtures** -- `15d303e` (test)

(Tasks 1-3 merged into `features/initial-gsd` via worktree merge `a6dfd47`. Task 4 was completed by a sequential continuation executor on the main working tree.)

**Plan metadata:** _(this commit)_ docs(02-03)

## Files Created/Modified

### Created

- `extensions/claude-marketplace/domain/name.ts` -- `assertSafeName` (RN-2) + `generatedSkillName` / `generatedCommandName` / `generatedAgentName` (RN-1).
- `extensions/claude-marketplace/domain/version.ts` -- `computeHashVersion` (PI-7) + `HASH_WALK_SKIP` (D-12) + private `walkAndHash` + `normalizeBytes` (D-11).
- `tests/domain/name.test.ts` -- table-driven RN-2 + RN-1 coverage.
- `tests/domain/version.test.ts` -- 5 PI-7 / D-11 / D-12 contract tests; `before()` hook materializes `.git/HEAD` decoy.
- `tests/domain/fixtures/hash-stability/sample-plugin/plugin.json`
- `tests/domain/fixtures/hash-stability/sample-plugin/skills/foo.md`
- `tests/domain/fixtures/hash-stability/sample-plugin/.DS_Store` (force-added past global .gitignore)
- `tests/domain/fixtures/hash-stability/sample-lf/file.txt` -- LF only, no BOM (verified via `od -c`).
- `tests/domain/fixtures/hash-stability/sample-crlf-bom/file.txt` -- UTF-8 BOM (`efbbbf`) + CRLF (`0d 0a`), verified via `xxd`.

### Modified

- `.gitattributes` -- new rule: `tests/domain/fixtures/hash-stability/** -text` so git does NOT normalize CRLF/BOM bytes during clone/checkout.
- `.pre-commit-config.yaml` -- global `exclude:` extended from `^\.claude/` to `^(\.claude/|tests/domain/fixtures/hash-stability/)` so fix-byte-order-marker / mdformat / markdownlint / prettier do not rewrite fixture bytes.

## Decisions Made

1. **PI-7 snapshot pinned at `hash-743f35130ec4`** -- This is now the stable user contract per CONTEXT.md D-11 / D-12 and PRD §11 PI-7. The 12-hex-char truncation, the SHA-256 algorithm, the HASH_WALK_SKIP list, AND the D-11 normalization rules (BOM strip + CRLF→LF) are all parts of this contract. Any future change MUST be accompanied by a CHANGELOG entry. The snapshot test is the regression gate.
2. **`.git/HEAD` fixture is materialized at runtime, not committed** -- Git refuses to track files under any `.git/` path component. The test's `before()` hook creates `tests/domain/fixtures/hash-stability/sample-plugin/.git/HEAD` on every run so the walker exercises the HASH_WALK_SKIP filter against a real `.git/` entry.
3. **Two-joiner pattern (Pitfall 6)** -- `path.posix.join` for the path-bytes argument to `hash.update(...)` and `path.join` for the actual fs read. This is intentional: Windows and POSIX produce identical hashes for identical trees only because the hash input is normalized to forward slashes.
4. **Pre-commit + .gitattributes coordination** -- The fixture's whole point is to round-trip byte-for-byte. Two layers were needed: `.gitattributes -text` to disable git's own CRLF/BOM normalization, AND a pre-commit `exclude:` extension to disable fix-byte-order-marker / mdformat / markdownlint-cli2 / prettier rewrites. Without both, the CRLF+BOM fixture would be silently flattened to LF on commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit hook was about to flatten the CRLF+BOM fixture to LF**

- **Found during:** Task 4 (first commit attempt)
- **Issue:** The pre-commit `fix-byte-order-marker` hook stripped the UTF-8 BOM from `sample-crlf-bom/file.txt` and `mdformat` rewrote `sample-plugin/skills/foo.md`, both of which would have broken the snapshot hash on every clone/CI run. Additionally, git's default `text=auto` normalization (`.gitattributes` line 1) would silently rewrite CRLF→LF on next checkout.
- **Fix:** Added `tests/domain/fixtures/hash-stability/** -text` rule to `.gitattributes`; extended pre-commit global `exclude:` from `^\.claude/` to `^(\.claude/|tests/domain/fixtures/hash-stability/)`. Restored the byte-exact fixtures via `printf` and re-staged. Snapshot hash unchanged at `hash-743f35130ec4`.
- **Files modified:** `.gitattributes`, `.pre-commit-config.yaml`, `tests/domain/fixtures/hash-stability/sample-crlf-bom/file.txt`, `tests/domain/fixtures/hash-stability/sample-plugin/skills/foo.md`
- **Verification:** `xxd` shows BOM `efbbbf` at byte 0 of crlf-bom fixture; `od -c` confirms CRLF in crlf-bom and no CR in lf fixture; `node --test tests/domain/version.test.ts` exits 0 with all 5 tests passing the same pinned hash.
- **Committed in:** `15d303e` (Task 4 commit)

**2. [Rule 3 - Blocking] Git refuses to track files under any `.git/` path component**

- **Found during:** Task 4 (first staging attempt)
- **Issue:** The plan called for committing `tests/domain/fixtures/hash-stability/sample-plugin/.git/HEAD` as a static fixture so the walk-filter test could prove `.git/` is excluded. Git silently refused to add the file (no error, just no addition) because of the `.git/` path component.
- **Fix:** Restructured the test to materialize `.git/HEAD` at test startup via a `node:test` `before()` hook using `mkdirSync`/`writeFileSync`. The fixture file is no longer committed; the test creates it on every run before any test executes. The walker still exercises HASH_WALK_SKIP exactly as a freshly-cloned plugin tree would.
- **Files modified:** `tests/domain/version.test.ts` (added `before()` hook + import of `node:fs` mkdirSync/writeFileSync)
- **Verification:** Snapshot hash unchanged at `hash-743f35130ec4` (the original computation already excluded `.git/`); all 5 tests pass.
- **Committed in:** `15d303e` (Task 4 commit)

**3. [Rule 3 - Blocking] `.DS_Store` fixture covered by global .gitignore**

- **Found during:** Task 4 (first staging attempt)
- **Issue:** Global `.gitignore` includes `.DS_Store`, blocking `git add` of the fixture decoy.
- **Fix:** `git add -f` to bypass the ignore for this specific fixture.
- **Files modified:** `tests/domain/fixtures/hash-stability/sample-plugin/.DS_Store`
- **Verification:** `git ls-files` shows the fixture is tracked; snapshot test passes (proving the file is on disk and HASH_WALK_SKIP excludes it).
- **Committed in:** `15d303e` (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - Blocking)
**Impact on plan:** All three auto-fixes were necessary to land the byte-exact fixtures the plan calls for. No scope creep -- each fix exists solely to make the planned snapshot/normalization-invariance tests reliable across clone/CI/commit. The pinned hash value is unchanged.

## Issues Encountered

- **Initial commit message exceeded gitlint limits** (T1=75>72, B1=85>80 / 82>80). Resolved by shortening the title and reflowing the body. No semantic loss.

## User Setup Required

None - no external service configuration required.

## Self-Check

- [x] `extensions/claude-marketplace/domain/name.ts` exists (commit 0b68fd7)
- [x] `extensions/claude-marketplace/domain/version.ts` exists (commit 45fd1d7)
- [x] `tests/domain/name.test.ts` exists (commit 95568c9)
- [x] `tests/domain/version.test.ts` exists (commit 15d303e)
- [x] `tests/domain/fixtures/hash-stability/sample-plugin/plugin.json` exists (commit 15d303e)
- [x] `tests/domain/fixtures/hash-stability/sample-plugin/skills/foo.md` exists (commit 15d303e)
- [x] `tests/domain/fixtures/hash-stability/sample-plugin/.DS_Store` exists (commit 15d303e)
- [x] `tests/domain/fixtures/hash-stability/sample-lf/file.txt` exists (commit 15d303e)
- [x] `tests/domain/fixtures/hash-stability/sample-crlf-bom/file.txt` exists (commit 15d303e)
- [x] All 4 task commits reachable in `git log` of `features/initial-gsd`
- [x] `node --test tests/domain/version.test.ts` exits 0 (5/5 pass)
- [x] `npm run check` exits 0 (112/112 tests, typecheck + lint + format clean)
- [x] `grep -c "PIN_ME_DURING_EXECUTION" tests/domain/version.test.ts` returns 0
- [x] Pinned snapshot value `hash-743f35130ec4` is the literal in the test file
- [x] BOM bytes `efbbbf` verified at start of crlf-bom fixture (xxd)
- [x] CRLF bytes `0d 0a` verified in crlf-bom fixture (od -c)
- [x] No CR bytes in lf fixture (od -c)

## Self-Check: PASSED

## Next Phase Readiness

- Plan 02-05 (resolver) can now consume `assertSafeName` from `extensions/claude-marketplace/domain/name.ts` and the three RN-1 generators.
- Phase 3 bridges can consume the RN-1 generators for staged-file paths.
- Phase 5 install/update can consume `computeHashVersion` for PI-7 fallback when a plugin lacks a `plugin.json` version.
- The PI-7 snapshot is now a regression gate. Future plans that touch `computeHashVersion` MUST update the pinned hash AND add a CHANGELOG entry.
- No blockers.

---

_Phase: 02-domain-core-persistence-primitives_
_Plan: 03_
_Completed: 2026-05-10_
