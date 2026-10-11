---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
reviewed: 2026-10-10T00:00:00Z
depth: standard
iteration: 3
files_reviewed: 3
files_reviewed_list:
  - package-lock.json
  - tests/integration/provenance-invisibility.test.ts
  - tests/integration/skill-path-resolution.test.ts
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
status: clean
---

# Phase 08: Code Review Report (iteration 3)

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 3
**Status:** clean (Info items only)

## Summary

Scope: `git diff 3b1c61c7 HEAD -- package-lock.json tests/integration/`, through the iteration-2 WR-01 fix in `eddd3cf0`.

The iteration-2 WR-01 is resolved. The source matches `08-REVIEW-FIX.md`. In both loaders (`skill-path-resolution.test.ts:112-120`, `provenance-invisibility.test.ts:100-108`), a root with no `src/` tree now fails with `pi-subagents at <dir> is present but has no src/ tree` when `<root>/package.json` exists or when an explicit `PI_SUBAGENTS_ROOT` names an existing path. Otherwise it returns `undefined` and the test skips. So an installed global peer that ships no `src/` now fails instead of skipping silently. `PI_SUBAGENTS_ROOT=/nonexistent` and an empty global prefix still skip, because neither directory has a `package.json`.

I re-ran both tests: with the global peer present (pi-subagents at `npm root -g`) the result is `# pass 2`, and with `PI_SUBAGENTS_ROOT=/nonexistent` it is `# skipped 2`. The other paths are unchanged from iteration 2. A copy or import error still reaches the test, and a missing target module still trips `assert.ok`. SC-2 still resolves the root before the HOME swap, and both tests still clean up in `finally` / through `createHermeticEnvironment`. The lockfile change is still only the `brace-expansion` 5.0.9 -> 5.0.12 bump on the root entry.

No new Critical or Warning findings. The five Info items that were left on purpose remain and are re-reported below.

## Info

### IN-01: The two test files still repeat the same helpers

**File:** `tests/integration/provenance-invisibility.test.ts:51-121`; `tests/integration/skill-path-resolution.test.ts:62-132`

**Issue:** `PiSubagentsRoot`, `resolvePiSubagentsPackageRoot`, and the skip/fail branching are copied in both files. The `eddd3cf0` fix had to be made twice. The loaders differ only in the module path and the return type.

**Fix:** Move the resolver and a generic `loadPiSubagentsModule<T>(root, scratchRoot, relPath, label)` into one shared integration-test support module.

### IN-02: The ordering comment overstates where npm gets its global prefix

**File:** `tests/integration/skill-path-resolution.test.ts:135-136`

**Issue:** npm reads `prefix` from `~/.npmrc` only when the user config sets it. By default npm derives it from the node executable path, and `NPM_CONFIG_PREFIX` overrides both.

**Fix:** "npm may read its global prefix from ~/.npmrc, so the lookup runs before the hermetic environment repoints HOME."

### IN-03: The local `node_modules` still has `brace-expansion` 5.0.9

**File:** `package-lock.json:3634-3637`

**Issue:** `node_modules/brace-expansion/package.json` still reports 5.0.9 (checked again in this pass), while the lock pins 5.0.12. Local green runs did not use the bumped package. Only CI's `npm ci` does.

**Fix:** Run `npm ci` locally before treating a local run as evidence for the bump.

### IN-04: A high-severity advisory remains on the nested Pi copy (tracked as DEPADV-01)

**File:** `package-lock.json:1307-1310`

**Issue:** `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion` is still 5.0.9. The phase deliberately leaves it out of scope.

**Fix:** None in this phase. Keep DEPADV-01 open until upstream Pi updates its shrinkwrap.

### IN-05: A mistyped explicit `PI_SUBAGENTS_ROOT` skips with a generic message

**File:** `tests/integration/skill-path-resolution.test.ts:115,146`; `tests/integration/provenance-invisibility.test.ts:103,127`

**Issue:** An explicit override that names a missing path still skips with "not reachable in this environment". That keeps the `/nonexistent` CI simulation working, but the skip reason does not show that the override was ignored. A related small point: `existsSync(root.dir)` is also true when the override names a file, and then the failure message says the peer "is present but has no src/ tree".

**Fix:** Put the resolved directory in the skip reason, for example `` t.skip(`pi-subagents not found at ${piSubagentsRoot?.dir ?? "(no root)"}`) ``. Optionally use `statSync(...).isDirectory()` for the explicit-path check.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
