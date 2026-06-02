---
phase: 31-credential-subprocess-layer-auth
plan: 01
subsystem: testing
tags: [architecture-gate, node-test-glob, child_process, whitelist, auth-prep]

# Dependency graph
requires:
  - phase: 30-duplicate-gitcredentials-type-fix
    provides: "GitCredentials canonical type exported from platform/git.ts (consumed by the Phase 31-02 git-credential.ts module that this plan unblocks)"
provides:
  - "ALLOWED_CHILD_PROCESS_FILES whitelist in tests/architecture/no-shell-out.test.ts permitting extensions/pi-claude-marketplace/platform/git-credential.ts only"
  - "Sibling exact-membership assertion test that pins the whitelist to exactly one entry (silent-widening guard)"
  - "tests/platform/**/*.test.ts now discovered by `npm test` and `npm run test:coverage:unit`"
affects:
  - "31-02 (CredentialOps interface + DEFAULT_CREDENTIAL_OPS + spawn-based fill/approve/reject in platform/git-credential.ts)"
  - "31-03 (tests/helpers/credential-mock.ts + tests/platform/git-credential.test.ts unit tests)"
  - "31-04 (tests/architecture/no-credential-leak.test.ts AUTH-09 gate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Architecture-gate narrowing pattern: ReadonlySet<string> whitelist + skip-by-relative-path inside walk loop + sibling exact-membership assertion (forces lockstep edits)"

key-files:
  created: []
  modified:
    - tests/architecture/no-shell-out.test.ts
    - package.json

key-decisions:
  - "Adopt RESEARCH.md Pitfall 1 / Example 3 verbatim: skip-by-relative-path BEFORE readFile, sibling exact-membership assertion as the silent-widening guard (Phase 31 plan 31-01 specification)"
  - "Insert `platform` alphabetically between `persistence` and `shared` in the brace-expansion globs; do NOT extend to test:e2e / test:integration globs which operate on disjoint roots"

patterns-established:
  - "Whitelist-based architecture-gate narrowing: a forbidden-import gate that needs a single legitimate exception now uses a ReadonlySet<string> of repo-relative paths checked before any per-file source read, plus a separate test asserting the whitelist has exactly its expected entries. Future phases needing another exception MUST edit BOTH the set and the assertion's expected array."

requirements-completed: [AUTH-06, AUTH-08, AUTH-09]

# Metrics
duration: 6min
completed: 2026-06-01
---

# Phase 31 Plan 01: No-shell-out Gate Narrowing + Platform Test Glob Summary

**ALLOWED_CHILD_PROCESS_FILES whitelist + exact-membership guard added to the D-21 no-shell-out architecture test, plus `platform` folded into the npm test glob -- two preparatory amendments that unblock Plan 31-02's git-credential.ts production module and surface 6 latent tests in CI.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-01T11:05:30Z (orchestrator hand-off)
- **Completed:** 2026-06-01T11:11:33Z
- **Tasks:** 2
- **Files modified:** 2 (tests/architecture/no-shell-out.test.ts, package.json)

## Accomplishments

- Narrowed the D-21 no-shell-out architecture gate so the upcoming `extensions/pi-claude-marketplace/platform/git-credential.ts` (Phase 31-02 deliverable) can import `node:child_process` under an explicit single-file exception. Whitelist mechanism: `ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string>` with skip-by-relative-path before the per-file `readFile`. Failure message preserves the D-21 / MA-7 / W-8 supersession narrative.
- Added the silent-widening guard: a second test `Phase 31 whitelist: exactly one file may import node:child_process` that `assert.deepEqual([...ALLOWED_CHILD_PROCESS_FILES].sort(), ["extensions/pi-claude-marketplace/platform/git-credential.ts"])`. Any future widening forces a lockstep edit caught in CI / PR review.
- Folded `platform` into the brace-expansion globs of `scripts.test` and `scripts.test:coverage:unit` in package.json (alphabetically between `persistence` and `shared`). `tests/platform/pi-api.test.ts` (6 tests, in the tree since Phase 17.2) was typechecked but never executed under `npm test`; that latent gap is now closed.
- `npm run check` exits 0 with 1267/1267 tests passing (baseline 1260; +1 new whitelist-membership test, +6 newly-discovered platform tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: Narrow no-shell-out architecture gate with whitelist + exact-membership assertion** -- `2e4916f` (test)
2. **Task 1 lint fixup (Rule 3 deviation):** `739a19b` (fix) -- `curly` + `@stylistic/padding-line-between-statements` against the new `if (...) continue;` skip
3. **Task 2: Fold tests/platform/ into the npm test glob** -- `7fb746f` (chore)

## Files Created/Modified

- `tests/architecture/no-shell-out.test.ts` -- Added `ALLOWED_CHILD_PROCESS_FILES` whitelist with sole entry `extensions/pi-claude-marketplace/platform/git-credential.ts`; renamed the gate test to mention the Phase 31 narrowing; extended the docstring header to record the AUTH-06/08/09 reason for the narrowing (preserves the D-21 / MA-7 / W-8 narrative); added a sibling test asserting the whitelist is exactly one entry. The whitelist contents that Plan 31-02 must mirror in its production file path:
  - `extensions/pi-claude-marketplace/platform/git-credential.ts`
- `package.json` -- Inserted `platform` into the brace-expansion glob of `scripts.test` and `scripts.test:coverage:unit`, alphabetically between `persistence` and `shared`. Did NOT change `test:coverage:e2e`, `test:coverage:integration`, `test:e2e`, `test:e2e:nightly`, or `test:integration` (disjoint roots). Did NOT reorder any other key in package.json.

## Production-file Status (per `<output>` spec, point b)

No production file under `extensions/pi-claude-marketplace/platform/` has been added in this plan. The directory still contains exactly the Phase 30 / pre-31 files:

```
extensions/pi-claude-marketplace/platform/
├── README.md
├── git.ts
└── pi-api.ts
```

`extensions/pi-claude-marketplace/platform/git-credential.ts` is the Plan 31-02 deliverable; the architecture gate is forward-compatible for it.

## Test-count Delta (per `<output>` spec, point a)

| Source | Delta |
|--------|-------|
| New whitelist-membership test (`Phase 31 whitelist: exactly one file may import node:child_process` in tests/architecture/no-shell-out.test.ts) | +1 |
| Newly-discovered tests/platform/pi-api.test.ts (6 cases, pre-existing since Phase 17.2; now in glob) | +6 |
| **Total** | **+7** |

Observed `npm test` count after both tasks: 1267/1267 (was 1260 on the diff base; +7 matches the arithmetic above). `npm run check` exits 0. The implied Phase 31 RESEARCH baseline of "1168" cited in the plan's success criteria refers to a different point in history -- the actual diff-base baseline at execution time was 1260, and the +7 delta is consistent with the plan's intent.

## ALLOWED_CHILD_PROCESS_FILES Whitelist Contents (per `<output>` spec, point c)

For Plan 31-02 to mirror as the literal file path of the new production module:

```typescript
const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
]);
```

One entry only. Plan 31-02's new file MUST live at `extensions/pi-claude-marketplace/platform/git-credential.ts` (repo-relative, exactly as spelled above) -- any other path will hit the D-21 gate as `D-21 violation: child_process import detected outside the Phase 31 whitelist`.

## Decisions Made

- **Followed the plan task specification verbatim.** The whitelist shape, skip-by-relative-path placement, and exact-membership assertion are all from RESEARCH.md Pitfall 1 / Example 3, which the plan adopts as the canonical narrowing.
- **Did NOT change FORBIDDEN_PATTERNS or walkTsFiles** (per Task 1 action constraint).
- **Used `assert.deepEqual([...set].sort(), [...])`** rather than `assert.equal(set.size, 1) + assert.ok(set.has(...))` so a future addition triggers a clear array-shape diff in the failure output (matches RESEARCH Example 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint failures on the new `if (...) continue;` line in the whitelist skip**

- **Found during:** Task 2 verification (`npm run check`), after Task 1 had already been committed
- **Issue:** Task 1 introduced `if (ALLOWED_CHILD_PROCESS_FILES.has(rel)) continue;` as a single-line statement. The project's ESLint config enforces (a) `curly` (always brace `if` bodies) and (b) `@stylistic/padding-line-between-statements` (require a blank line before the next statement after a braced control-flow block). Both fired in `npm run lint`. This blocked `npm run check` from exiting 0 -- a Rule 3 condition that prevents completing Task 2's verification.
- **Fix:** Rewrote the skip as
  ```typescript
  if (ALLOWED_CHILD_PROCESS_FILES.has(rel)) {
    continue;
  }

  const source = await readFile(file, "utf8");
  ```
  Same semantics, lint-compliant. Both gate tests continue to pass (`node --test tests/architecture/no-shell-out.test.ts` -> 2/2 pass).
- **Files modified:** tests/architecture/no-shell-out.test.ts
- **Verification:** `npm run lint` exits 0; `npm run format:check` exits 0; the two gate tests still pass; full `npm run check` exits 0 at 1267/1267 tests.
- **Committed in:** `739a19b` (separate `fix(31-01):` commit per CLAUDE.md "create NEW commits rather than amending" guidance -- Task 1's `2e4916f` was already pushed when the lint failure surfaced)

---

**Total deviations:** 1 auto-fixed (1 blocking lint fix)
**Impact on plan:** No scope creep -- pure formatting against the same source the task already authored. The two gate tests continue to satisfy every Task 1 acceptance criterion bit-for-bit.

## Issues Encountered

- None beyond the auto-fixed lint deviation above.
- Trufflehog pre-commit hook fails inside the worktree sandbox (auto-updater cannot spawn child processes), exactly as documented in CLAUDE.md. Used `SKIP=trufflehog` on each commit and ran `pre-commit run trufflehog --all-files` separately on the main checkout -- scan is clean.

## User Setup Required

None -- no external service configuration, no environment variables, no dashboard setup.

## Next Phase Readiness

- Plan 31-02 is unblocked: it can author `extensions/pi-claude-marketplace/platform/git-credential.ts` and its `node:child_process` import will pass the D-21 gate.
- The new whitelist-membership test ensures any future broadening of the exception requires an explicit, reviewed edit.
- `tests/platform/` is now a first-class test root; Plan 31-03's `tests/platform/git-credential.test.ts` will be discovered by `npm test` automatically.
- No blockers carried forward.

## Self-Check: PASSED

Verified before writing this section:

- File `tests/architecture/no-shell-out.test.ts` modified -- FOUND (`git log -p tests/architecture/no-shell-out.test.ts | head` confirms the whitelist + sibling test additions)
- File `package.json` modified -- FOUND (`node -p "require('./package.json').scripts.test"` shows `platform` in the glob)
- Commit `2e4916f` -- FOUND (`git log --all --oneline | grep -q 2e4916f`)
- Commit `739a19b` -- FOUND
- Commit `7fb746f` -- FOUND
- Two `test(` declarations in the gate file -- FOUND (2 matches via `grep -cE '^test\\(' tests/architecture/no-shell-out.test.ts`)
- AUTH-06 / AUTH-08 / AUTH-09 cited in docstring -- FOUND (4 / 1 / 1 grep hits respectively)
- `npm run check` exits 0 with 1267/1267 tests -- FOUND (full run captured 2026-06-01T~11:11Z)
- No production file added under `extensions/pi-claude-marketplace/platform/` -- FOUND (`ls` shows only README.md, git.ts, pi-api.ts)

---
*Phase: 31-credential-subprocess-layer-auth*
*Completed: 2026-06-01*
