---
phase: 117-extension-entry-and-final-gate
plan: "01"
subsystem: testing
tags: [node-test, glob, architecture-test, npm-scripts, coverage]

requires:
  - phase: 116-edge-surface
    provides: the D-116-04 plant-and-record discipline this control was proved with
provides:
  - a control that fails when either unit-suite glob stops matching every unit test file on disk
  - a measured RED plant for each of the two guarded npm scripts
  - the free RED that the 117-08 glob amendment must clear before it can go green again
affects: [117-08 glob amendment, entry pair ownership, helpers dissolution]

actuals:
  tokens: 938
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "two-mechanism equality: a glob expansion of patterns parsed out of package.json compared against a recursive directory read"

key-files:
  created:
    - tests/architecture/unit-suite-glob-completeness.test.ts
  modified: []

key-decisions:
  - "The control lands before the amendment it guards, so 117-08 must turn it RED and back GREEN rather than tuning it to agree."
  - "The two sides are computed by different mechanisms on purpose; a control that re-read the script it guards would restate the configuration instead of measuring it."
  - "Whole arrays are compared with a deep strict comparison rather than counts, because two sets of the same size can have different membership."
  - "e2e and integration are dropped from the tree side because each has its own npm script; the unit scripts are not meant to reach them."

patterns-established:
  - "Reachability control: prove that the runner's own selection argument reaches every file it is supposed to reach, by an enumeration the argument cannot influence."

requirements-completed: [COV-04, SUITE-05]

coverage:
  - id: D1
    description: "The `test` script's glob arguments match exactly the unit test files that exist under tests/"
    requirement: COV-04
    verification:
      - kind: unit
        ref: "tests/architecture/unit-suite-glob-completeness.test.ts#COV-04 the test script reaches every unit test file that exists"
        status: pass
      - kind: other
        ref: "plant A: one directory alternative deleted from the test script's brace list — case went RED"
        status: pass
    human_judgment: false
  - id: D2
    description: "The `test:coverage:unit` script's glob arguments match exactly the same set, independently, so the two scripts cannot drift apart"
    requirement: COV-04
    verification:
      - kind: unit
        ref: "tests/architecture/unit-suite-glob-completeness.test.ts#COV-04 the test:coverage:unit script reaches every unit test file that exists"
        status: pass
      - kind: other
        ref: "plant B: the whole quoted glob argument deleted from the test:coverage:unit script — case went RED"
        status: pass
    human_judgment: false
  - id: D3
    description: "The repository gates stay green with the control in place, and no production file or manifest changed"
    requirement: SUITE-05
    verification:
      - kind: other
        ref: "npm run typecheck; npm exec -- eslint <file>; npm exec -- prettier --check <file>; npm run fallow; npm test; git diff --quiet -- extensions/ package.json"
        status: pass
    human_judgment: false

duration: 11 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 01: Unit-Suite Glob Completeness Summary

**A two-mechanism equality control that fails the moment either unit-suite glob stops matching every `.test.ts` file that exists under `tests/`, landed green and proved RED by two separate plants.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-03T17:04:45Z
- **Completed:** 2026-09-03T17:16:12Z
- **Tasks:** 1
- **Files modified:** 1 created, 0 modified

## Accomplishments

- `tests/architecture/unit-suite-glob-completeness.test.ts` answers a question no gate in this repository answered before: do the two npm scripts that run the unit suite actually reach every unit test that exists? Two independent top-level cases, one per script.
- The two sides are produced by **different mechanisms**. The script side reads `package.json` with the node filesystem API, pulls the double-quoted substrings out of the script string, and expands each with `globSync`. The tree side walks `tests/` with a recursive `readdirSync` carrying file types and drops the `e2e` and `integration` roots that have their own npm scripts. Neither side can be derived from the other.
- Both cases compare whole arrays with `assert.deepStrictEqual`, never a count, and name the offending script in the assertion message.
- The claim the plan asked to confirm before relying on it is confirmed: each of the two scripts contains **exactly one** double-quoted substring, and it is the glob argument (`patterns=1` for both, measured).
- Measured on the committed tree: `test` matches **250**, `test:coverage:unit` matches **250**, the recursive directory read finds **250**. The 249 the plan cites was the count before this file existed; it is 250 now because this suite is itself one of the files it counts.
- Neither glob was amended. The equality holds as-is, which is the point: 117-08 now has to turn this control RED before it can turn it green again.

## Task Commits

1. **Task 1: Prove the unit-suite globs match every unit test that exists** — `1b8db56b` (test)

**Plan metadata:** see the `docs(117-01)` commit that carries this summary.

## Files Created/Modified

- `tests/architecture/unit-suite-glob-completeness.test.ts` — the COV-04 planting control for D-117-15. Compares each unit-suite glob's expansion against a recursive directory read of `tests/`.

## Plants (D-116-04)

A byte copy of `package.json` was taken before the first plant and both restores were made from that copy, never by re-editing. `md5sum` matched the copy after each restore and `git diff --quiet -- package.json` exited 0 both times.

### Plant A — one directory alternative deleted from the `test` script's brace list

`helpers,` removed from line 82's brace list. Verbatim, trimmed to the material lines:

```
✖ COV-04 the test script reaches every unit test file that exists (43.069476ms)
✔ COV-04 the test:coverage:unit script reaches every unit test file that exists (19.42274ms)
ℹ tests 2
ℹ pass 1
ℹ fail 1

✖ failing tests:

test at tests/architecture/unit-suite-glob-completeness.test.ts:71:1
✖ COV-04 the test script reaches every unit test file that exists (43.069476ms)
  AssertionError [ERR_ASSERTION]: the "test" script no longer matches exactly the unit test files under tests/
  + actual - expected
  ... Skipped lines

    [
      'tests/architecture/catalog-uat.test.ts',
      ...
      'tests/edge/types.test.ts',
  -   'tests/helpers/source-scan.test.ts',
      'tests/orchestrators/auth-host.test.ts',
      ...
```

The diff names the single dropped file. The `test:coverage:unit` case stayed green, which is the evidence the two cases are genuinely independent rather than one assertion counted twice.

### Plant B — the whole quoted glob argument deleted from the `test:coverage:unit` script

Line 91 left with no quoted argument at all. Verbatim, trimmed:

```
✔ COV-04 the test script reaches every unit test file that exists (42.959995ms)
✖ COV-04 the test:coverage:unit script reaches every unit test file that exists (15.664797ms)
ℹ tests 2
ℹ pass 1
ℹ fail 1

✖ failing tests:

test at tests/architecture/unit-suite-glob-completeness.test.ts:86:1
✖ COV-04 the test:coverage:unit script reaches every unit test file that exists (15.664797ms)
  AssertionError [ERR_ASSERTION]: the "test:coverage:unit" script no longer matches exactly the unit test files under tests/
  + actual - expected

  + []
  - [
  -   'tests/architecture/catalog-uat.test.ts',
  ...
```

`+ []` against the full expected list. Again the sibling case stayed green.

Neither plant stayed GREEN, so neither claim needed narrowing.

## Gate results

Every link run separately, exit code read from the command itself and not from a pipe tail:

| Link | Exit | Note |
| --- | --- | --- |
| `node --test <file>` | 0 | 2 tests, 2 pass, 0 fail |
| `npm run typecheck` | 0 | |
| `npm exec -- eslint <file>` | 0 | |
| `npm exec -- prettier --check <file>` | 0 | |
| `npm run fallow` | 0 | new file named in no finding |
| `npm test` | 0 | 5143 tests, 295 suites, 0 fail — 5141 baseline plus this suite's 2 cases |
| anti-pattern scan | 1 (no match) | no suppressor, coverage pragma, or planning reference |
| `rg -c '^\s*// arrange$'` | 0 | 2 markers, one per case |
| correspondence gate names the file | 1 (not named) | |
| `git diff --check` | 0 | |
| `git diff --quiet -- extensions/ package.json` | 0 | |

The correspondence gate itself exits 1 with the same 8 pre-existing violations it had before this plan (`missing-test: tests/index.test.ts` plus 7 `unexpected-test` rows). None of them is new: `tests/architecture/` is one of the gate's own `nonCorrespondingRoots`, so a file added there cannot enter the violation set.

Pre-commit hooks were run file-scoped before committing and all passed: `trailing-whitespace`, `end-of-file-fixer`, `fix-byte-order-marker`, `check-case-conflict`, `check-merge-conflict`, `check-symlinks`, `destroyed-symlinks`, `check-executables-have-shebangs`, `check-shebang-scripts-are-executable`, `detect-private-key`, `check-added-large-files`, `check-json`, `check-vcs-permalinks`, `forbid-submodules`, `forbid-new-submodules`, `prettier`, `fix-smartquotes`, `fix-spaces`, `fix-unicode-dashes`, `fix-ligatures`, `forbid-bidi-controls`, `npm-lint`, `npm-typecheck`, `npm-fallow`.

Secret scan by the filesystem route, as the repository's own guidance requires inside a worktree: `chunks: 1, bytes: 3752, verified_secrets: 0, unverified_secrets: 0`, exit 0.

## Decisions Made

- **Two explicit cases rather than a loop over rows.** Each case carries its own `// arrange`, `// act`, `// assert` markers, which is what the plan asked for and what makes a single-script failure legible. `sonarjs/no-identical-functions` is disabled for `tests/**` and `fallow dupes` named neither case, so the small textual overlap costs nothing.
- **No separate "the script quotes at least one pattern" assertion.** An empty pattern list already fails the equality assertion loudly — that is exactly what plant B produced — so a second assertion would only add a maintenance surface.
- **The tree side keeps root-level files.** Its exclusion filter drops only the `e2e` and `integration` first segments, so a file at the `tests/` root is expected to be matched. That is what makes this control fire on D-117-15's actual hazard rather than merely on a deleted brace alternative.

## Deviations from Plan

None — plan executed exactly as written. No production file, no `package.json` line, and no glob was amended.

## Issues Encountered

1. **The dispatch prompt's checkout premise was wrong, and it matters for the secret scan.** The prompt states this is the main checkout and that `SKIP=trufflehog` must not be used. Measured: `.git` is a file reading `gitdir: /home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-unit-test-refactor`, so this is a linked worktree. The trufflehog hook was run and failed structurally with `failed to read index file: open .../.git/index: not a directory` — the exact failure the repository's own guidance documents for worktrees. The filesystem-route scan was run instead and came back clean with non-zero chunk and byte counts, which is the sanctioned substitute. The branch is `features/unit-test-refactor`, the operator's own long-lived branch, not a protected ref and not a GSD per-agent worktree.

2. **`SKIP=... pre-commit run` was refused by the harness classifier.** Rather than work around it, every hook was run individually by id, which executes the same hooks with nothing skipped and nothing bypassed. `npm-format-check` was the one hook that failed, and it failed on eight files this plan never touched: `.mcp.json` and seven `.planning/research/.cache/*.json`, all pre-existing and untracked in the operator's working tree. The plan anticipated this and forbade touching those files or `.prettierignore`; the new file passes `prettier --check` on its own and passes the `prettier` hook.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The control is in place and green, so 117-08 inherits a forcing function rather than an assertion it can author to taste: adding the root pattern to both globs must keep both cases equal, and dropping the `helpers` token must be done on both scripts or case 2 goes RED.
- The entry owner `tests/index.test.ts` does not exist yet. When it lands without the glob amendment, both cases go RED with the new file on the expected side — which is the intended sequencing, not a regression.
- No blockers.

## Self-Check: PASSED

- `tests/architecture/unit-suite-glob-completeness.test.ts` exists on disk.
- Commit `1b8db56b` is present in `git log`.
- The full `<verify>` chain was re-run end to end after the commit; all eleven links returned their passing exit codes.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
