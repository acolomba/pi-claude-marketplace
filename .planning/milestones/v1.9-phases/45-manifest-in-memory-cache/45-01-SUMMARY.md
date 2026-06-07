---
phase: 45-manifest-in-memory-cache
plan: 01
subsystem: domain
tags: [cache, manifest, tdd, wave-0, test-scaffold]
requires:
  - tests/domain/manifest.test.ts (harness analog)
  - extensions/pi-claude-marketplace/shared/errors.ts (errorMessage)
provides:
  - tests/domain/manifest-cache.test.ts (RED behavioral suite for createManifestCache)
affects:
  - extensions/pi-claude-marketplace/domain/manifest-cache.ts (binding spec for Plan 45-02)
tech-stack:
  added: []
  patterns:
    - "injected counting loader as the CACHE-01 observability seam (no readFile/JSON.parse/validator mock)"
    - "mkdtemp/writeFile/try-finally-rm per-test isolation harness (mirrors tests/domain/manifest.test.ts)"
    - "size-driven (mtimeMs,size) invalidation in tests (never same-size rewrite)"
key-files:
  created:
    - tests/domain/manifest-cache.test.ts
  modified: []
decisions:
  - "7 test blocks (not 6): CACHE-01 split into loader-runs-once and by-reference-identity to match the 7 frontmatter truths"
  - "stat-fail (D-02) modeled with an ENOENT-coded loader error so the propagated code is assertable without a real fs.stat"
metrics:
  duration: ~6m
  completed: 2026-06-07
requirements: [CACHE-01, CACHE-02, CACHE-03, CACHE-05]
---

# Phase 45 Plan 01: Wave 0 Manifest-Cache Test Scaffold Summary

Authored the RED behavioral suite `tests/domain/manifest-cache.test.ts` (7 tests) that
binds the full `createManifestCache` contract through a single injected-counting-loader
seam, intentionally failing at import until Plan 45-02 lands the module.

## What Was Built

A new Wave 0 (TDD RED) test file, `tests/domain/manifest-cache.test.ts`, encoding the
locked cache contract as 7 sequential `test(...)` blocks. Each test constructs a FRESH
`createManifestCache(loader)` instance and uses an INJECTED COUNTING LOADER as its sole
observability seam -- no `readFile`/`JSON.parse`/`MARKETPLACE_VALIDATOR` mocking (the ESM
`readFile` namespace binding is unmockable, RESEARCH Pitfall 1), and no routing through
the module singleton (Pitfall 6). The harness mirrors the `mkdtemp` + `writeFile` +
`try/finally rm` per-test isolation pattern from `tests/domain/manifest.test.ts`.

The 7 tests, keyed to requirements:

| # | Test | Requirement | Asserts |
|---|------|-------------|---------|
| 1 | N sequential reads → loader runs once | CACHE-01 | `calls === 1` across 3 sequential `await` reads (not `Promise.all`) |
| 2 | hits return by reference | CACHE-01 / D-03 | `r1 === r2 === r3 === value` |
| 3 | size change → reload + new value | CACHE-02 success→success | `calls === 2`, second value reflects larger content |
| 4 | negative entry discarded on size change | CACHE-02 / CACHE-05 failure→success | first read throws + negative-caches; size change re-attempts and succeeds |
| 5 | bad manifest negative-cached | CACHE-05 | same `Error` instance re-thrown, `.message` stable, no re-parse (`calls === 1`), `errorMessage(e1) === errorMessage(e2)` |
| 6 | stat-fail is a pure miss | D-02 | nonexistent path: loader runs on EVERY read (`calls === 2`), original `ENOENT` code propagates |
| 7 | fresh cache cold start | CACHE-03 | first `load` is a miss (`calls === 1`); no cache file/sidecar written to tmpdir |

Every CACHE-02 invalidation is driven off a different byte length (added a plugin entry),
never a same-size rewrite -- avoiding the same-tick `(mtimeMs,size)` mtime-resolution
flakiness (Pitfall 3/4). All CACHE-01 loads are sequential `await`s.

## Verification

- `node --check tests/domain/manifest-cache.test.ts` → exit 0 (syntactically valid).
- `grep -c "test("` → 7 (meets the acceptance criterion; 267-line file > `min_lines: 90`).
- No `loadMarketplaceManifest` / `t.mock.method` / `Promise.all` tokens anywhere in the
  file (including comments) → 0 matches; the only cache import is `createManifestCache`.
- Requirement tokens present: CACHE-01, CACHE-02, CACHE-03, CACHE-05, D-02, D-03.
- `node --test tests/domain/manifest-cache.test.ts` → FAILS with `ERR_MODULE_NOT_FOUND`
  for `domain/manifest-cache.ts` (the intended Wave 0 RED scaffold; Plan 45-02 turns it
  GREEN by creating the module).
- `pre-commit run --files tests/domain/manifest-cache.test.ts` → all hooks Passed
  (prettier, trufflehog, normalization, etc.); no hook modified the file.

## TDD Gate Compliance

This plan is the RED phase of the plan-level TDD cycle (`type: execute`, `tdd="true"`
task). The test commit (`test(45-01): ...`) is the RED gate. The corresponding GREEN gate
(a `feat(...)` commit implementing `domain/manifest-cache.ts`) is deferred to Plan 45-02
by design -- the suite is EXPECTED to fail at import resolution until then. No fail-fast
RED violation occurred: the suite cannot pass prematurely because the module does not
exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split CACHE-01 into 2 tests to satisfy the 7-block acceptance criterion**
- **Found during:** Task 1 verification (`grep -c "test("` returned 6, but the plan's
  acceptance criteria and frontmatter `must_haves.truths` require 7).
- **Issue:** The `<behavior>` block enumerates 6 scenarios, but the frontmatter lists 7
  distinct truths -- CACHE-01 carries two (loader-runs-once AND by-reference identity).
- **Fix:** Split the CACHE-01 scenario into two tests: one asserting the single loader
  call across N sequential reads, one asserting by-reference identity (`r1 === r2 === r3`).
  This maps 1:1 to the 7 frontmatter truths without changing the contract.
- **Files modified:** tests/domain/manifest-cache.test.ts
- **Commit:** 42ae8c3

**2. [Rule 3 - Blocking] Reworded comments to remove literal forbidden tokens**
- **Found during:** Task 1 verification (acceptance-criteria greps for `loadMarketplaceManifest`
  and `Promise.all` matched comment text, not code).
- **Issue:** Explanatory comments referenced the singleton name and `Promise.all` to
  document the design intent; a literal verifier grep would flag them as false positives.
- **Fix:** Reworded the comments ("module-level cache singleton", "fired one at a time
  (deliberately not concurrent)") so the file contains zero literal forbidden tokens while
  preserving the documented rationale. No behavioral change.
- **Files modified:** tests/domain/manifest-cache.test.ts
- **Commit:** 42ae8c3

## Known Stubs

None. This is a test-only scaffold; its intended RED state (import of the not-yet-created
`domain/manifest-cache.ts`) is documented in the plan, the file header, and this summary as
the Wave 0 contract, not a stub. Plan 45-02 implements the module and turns the suite GREEN.

## Self-Check: PASSED

- FOUND: tests/domain/manifest-cache.test.ts
- FOUND commit: 42ae8c3 (test(45-01): add Wave 0 manifest-cache behavioral suite)
