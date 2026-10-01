---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
plan: 04
subsystem: platform-git
tags: [isomorphic-git, marketplace-add, leftover-clone, listRemotes, gap-closure]
gap_closure: true

requires:
  - phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
    provides: "03-01's listRemotes and recognizeLeftover, 03-02's MA-13 refusal table, 03-03's green gate at 50746b81"
provides:
  - "listRemotes returns its origin arm only when isomorphic-git's parsed url is a string; an origin section with no url answers no-origin"
  - "end-to-end proof, both modes, that a url-less leftover refuses as stale clone through the real adapter"
  - "platform-tier proof, against real repositories, of both truncation shapes plus the empty-url boundary"
affects: [marketplace-add, leftover-clone-recovery, GATE-01]

actuals:
  tokens: 2386
  tasks: 3
  commits: 2
plan_head_before: 720ff74e7a22d9fe5cd620ceaf19a482a4270557
plan_head_after: 235fdc17665b2e9e7d367100ef5055c319df6807

tech-stack:
  added: []
  patterns:
    - "Library values whose declared type does not hold at runtime are read as unknown and narrowed with typeof at the platform boundary"
    - "Real-adapter platform rows first assert the library's own output, so the fixture proves it reproduces the shape it names"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/platform/git.test.ts

key-decisions:
  - "The guard is a type check on the url (typeof === 'string'), not a truthiness check: an empty url stays on the origin arm and the caller's byte comparison refuses it (D-3-01 keeps the refusal decision in add.ts)."
  - "Task 1's RED run was recorded and verified (RED_EVIDENCE_OK) but not committed on its own, because the npm-coverage-direct pre-commit hook runs the changed pair's tests and a deliberately failing test cannot pass it; test and fix landed in one commit, matching 03-01's precedent."

patterns-established:
  - "Compose the real listRemotes into the fake-clone GitOps seam when a case needs a config shape the fake's typed canned value cannot express."

requirements-completed: [MA-13, GATE-01]

coverage:
  - id: D1
    description: "A leftover whose origin section records no url refuses in standalone mode with one {stale clone} row, resolves undefined, leaves .git/config unchanged and records no state"
    requirement: MA-13
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-13 / ATTR-07: a leftover whose origin section names no url refuses as stale clone"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same leftover in orchestrated mode yields status failed, reason stale clone, a StaleSourceCloneError for the destination, no notification, config unchanged"
    requirement: MA-13
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-13 / RECON-03: orchestrated mode reports a leftover whose origin section names no url as stale clone"
        status: pass
    human_judgment: false
  - id: D3
    description: "listRemotes answers no-origin for a fetch-only and a keyless origin section, and keeps an empty url on the origin arm, against real repositories"
    requirement: MA-13
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#reports no-origin for an origin section with a fetch line but no url"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#reports no-origin for an origin section with no keys"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#reports the empty url of an origin section whose url value is empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whole gate green on the plan's final committed tree, measured fresh"
    requirement: GATE-01
    verification:
      - kind: other
        ref: "npm run check (CHECK_EXIT=0 at 235fdc17)"
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-09-28
status: complete
---

# Phase 3 Plan 04: Url-less Origin Leftover Refusal Summary

**`platform/git.ts::listRemotes` now returns the `origin` arm only when isomorphic-git's parsed url is a string. A leftover whose `origin` section records no url therefore refuses as `{stale clone}` / reason `stale clone` in both modes. Before this fix it crashed `marketplace add` with a raw `TypeError` or was mislabelled `unparseable`.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-09-28T02:15:16Z
- **Completed:** 2026-09-28T03:01:15Z
- **Tasks:** 3 (2 with commits; Task 3 measured the tree and changed no file)
- **Files modified:** 3

## Accomplishments

- **Guard shape (one sentence):** `listRemotes` selects the remote named `origin`, reads its `url` into a local declared `unknown`, and returns `{ kind: "origin", url }` only when `typeof url === "string"`, else `{ kind: "no-origin" }`.
- The `ListRemotesResult` docstring and the `listRemotes` docstring describe the url-less section (D-3-03, MA-13). A one-line `//` note at the `unknown` declaration points at that paragraph.
- **Pre-fix failure of the new standalone case, verbatim** (from `node --test tests/orchestrators/marketplace/add.test.ts` before the production edit):
  ```
  ✖ MA-13 / ATTR-07: a leftover whose origin section names no url refuses as stale clone (17.449064ms)
    TypeError [Error]: Cannot read properties of undefined (reading 'endsWith')
        at stripGitSuffix (.../extensions/pi-claude-marketplace/domain/source.ts:463:15)
        at recognizeLeftover (.../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:725:11)
  ```
  The RED record (TAP run, `exitCode: 1`) was checked with `gsd-tools check tdd-red-evidence`, which returned `RED_EVIDENCE_OK` (`target_test_failed`).
- **Orchestrated outcome as asserted** (one whole-value `assert.deepStrictEqual`, `makeCtx(0)`):
  `{ status: "failed", reason: "stale clone", error: new StaleSourceCloneError(finalDir, "valid-marketplace"), cause: \`stale source clone at ${finalDir}\` }`, then `notifications` deep-equals `[]`, and the config bytes are unchanged. Against the pre-fix `git.ts` the same case failed with `reason: 'unparseable'`.
- **Platform rows** (`tests/platform/git.test.ts`, `ORIGIN_SECTION_SHAPES`, real repositories from `createGitTestRepository`):

  | Row title | Library output (`git.listRemotes`) | Wrapper output (`listRemotes`) |
  |---|---|---|
  | `reports no-origin for an origin section with a fetch line but no url` | `[{ remote: "origin", url: undefined }]` | `{ kind: "no-origin" }` |
  | `reports no-origin for an origin section with no keys` | `[{ remote: "origin", url: undefined }]` | `{ kind: "no-origin" }` |
  | `reports the empty url of an origin section whose url value is empty` | `[{ remote: "origin", url: "" }]` | `{ kind: "origin", url: "" }` |

  Against the pre-fix `git.ts`, the first two rows failed and the empty-url row passed. That is the intended pin: an empty string is a string, and the caller's byte comparison refuses it.
- `git.ts` direct coverage was already 100% before the platform rows existed (branches 47/47, functions 11/11, lines 394/394). The pre-existing zero-remote case reaches the non-string branch. The behaviour is therefore proven by the named cases, not by the coverage figure (GATE-01 empty-input edge).

## Echoed exit values

- Task 1: `ADD_EXIT=0` (count `1`), `node --test tests/platform/git.test.ts` exit 0 (`ℹ pass 36`, `ℹ fail 0`), `TSC_EXIT=0`, `ESLINT_EXIT=0`, `DIRECT_GIT_EXIT=0`
- Task 2: `GIT_TEST_EXIT=0` (count `3`), `ADD_EXIT=0` (count `2`), `DIRECT_GIT_EXIT=0`, `TSC_EXIT=0`, `ESLINT_EXIT=0`
- Task 3: `FORMAT_EXIT=0` (no rewrite; `git status --porcelain` showed only the untracked orchestrator `milestone.lock`), `TYPE_MEMBERS_EXIT=0` (the same 4 recorded exceptions), `DIRECT_GIT_EXIT=0`, `CHECK_EXIT=0`
- `CONTRACTS=108`

## Closing gate (Task 3), measured on HEAD `235fdc17`

- `npm run check` ran once, output to a log file, exit code captured: **`CHECK_EXIT=0`**
- `test:coverage:unit`: `ℹ tests 7369`, `ℹ pass 7369`, `ℹ fail 0`. That is 7364 at `f301135e` plus this plan's 5 new cases.
- `all files                        | 100.00 |   100.00 |  100.00 |`. The uncovered-lines cell is empty on every row under `extensions/`.
- `test:integration`: `ℹ tests 36`, `ℹ pass 36`, `ℹ fail 0`
- `lint:type-members` passed with 4 recorded exceptions. `lint:type-members:negative`: `Unused type member negative controls passed (7 of 7).`
- Carried cases green in the same run: `MA-12: a leftover clone whose origin names the same source recovers`, `MA-8: a matching leftover still yields (failed) {duplicate name}, not {stale clone}`, both `MA-14` cases, `reports the origin remote url of a real repository`.
- Scope fence, `git diff --name-only f301135e..HEAD -- ':!.planning/'`:
  ```
  extensions/pi-claude-marketplace/platform/git.ts
  tests/orchestrators/marketplace/add.test.ts
  tests/platform/git.test.ts
  ```
- `git diff --name-only f301135e..HEAD -- scripts/test-coverage-direct.pin.json scripts/check-unused-type-members.contracts.json` printed nothing.
- `git status --porcelain -- extensions tests scripts package.json package-lock.json` printed nothing, before and after the run.
- **Unchanged, confirmed by an empty `git diff --name-only f301135e..HEAD`:** `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/shared.ts`, `tests/platform/git-ops-fake.ts`, `tests/platform/git-ops-contract.ts`.
- This run supersedes SC4's recorded evidence. That evidence was an empty source diff from `50746b81`, and it was already stale twice over: the `origin/main` merge at `f301135e` changed eight source files after it was taken, and this plan changes three more.

## Task Commits

1. **Task 1: url-less origin refuses as stale clone, end to end** - `24f2da2c` (fix). Guard, docs, and the standalone case, committed together; see Deviations.
2. **Task 2: orchestrated refusal and platform-tier proof** - `235fdc17` (test)
3. **Task 3: whole gate on the final committed tree** - no commit. The format run produced no rewrite, and no gate failure required a fix.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - adds the `typeof` guard in `listRemotes` and the `ListRemotesResult`/`listRemotes` docs for the url-less section
- `tests/orchestrators/marketplace/add.test.ts` - adds the `listRemotes` and `StaleSourceCloneError` imports, `ORIGIN_WITHOUT_URL_CONFIG`, `arrangeLeftoverWithoutOriginUrl`, and the standalone and orchestrated cases (numstat `85 0`: additions only)
- `tests/platform/git.test.ts` - adds `writeFile` to the import, and `ORIGIN_SECTION_SHAPES` with its three row cases (numstat `51 1`: the one removed line is the `node:fs/promises` import)

## Decisions Made

- The guard checks the value's type, not its truthiness. An empty `url =` stays on the `origin` arm so that D-3-01's single refusal site in `add.ts` decides it.
- `url` stays required on `ListRemotesResult`'s `origin` arm. The url-less section is moved to the `no-origin` arm at the platform boundary instead (assumption-delta decision `no-change`).

## Deviations from Plan

### TDD commit shape

**1. [Rule 3 - Blocking] RED and GREEN for Task 1 landed in one commit**
- **Found during:** Task 1 (RED commit attempt)
- **Issue:** The `npm-coverage-direct` pre-commit hook (`test:coverage:direct:commit`) runs the changed pair's tests. It failed on the intentionally failing RED case, so a `test(03-04)` RED-only commit cannot pass the hooks. AGENTS.md forbids `--no-verify`, and skipping any hook other than `trufflehog` would be the same bypass.
- **Fix:** The RED run was recorded with the TAP reporter and checked with `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK`, `target_test_failed`). The pre-fix failure is quoted above. The test and the fix were then committed together as `fix(03-04)`, the same shape 03-01 used (`5b075fe0`).
- **Files modified:** none beyond the plan's
- **Verification:** RED evidence verdict above; GREEN run `ADD_EXIT=0`.
- **Committed in:** `24f2da2c`

---

**Total deviations:** 1 (commit shape only; code and tests as planned)
**Impact on plan:** None on behaviour or scope. No `test(03-04)` RED commit precedes the fix commit.

## TDD Gate Compliance

- RED: verified by the recorded evidence (`RED_EVIDENCE_OK`), not by a separate commit (see Deviations).
- GREEN: `24f2da2c`.
- Task 2's cases were additionally run against the pre-fix `git.ts` (checked out temporarily from `f301135e`, then restored with `git checkout --`). The two truncation rows and the orchestrated case failed there; the empty-url boundary row passed, as designed.
- REFACTOR: none needed.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-3-10 and T-3-11 are mitigated as planned: the url-less origin takes the existing refusal arm, and both end-to-end cases assert the leftover's `.git/config` is byte-unchanged. T-3-12 is mitigated by the fresh `CHECK_EXIT=0` on the final committed tree, taken with a clean source status.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the phase's last plan. SC2 / MA-13's gap (CR-01, WR-10) is closed, and GATE-01 is re-measured green on the tree that exists. WR-01..WR-09 and IN-01..IN-06 stay open and fenced out, as the plan specifies.

---
*Phase: 03-marketplace-add-recovers-from-its-own-leftover-clone*
*Completed: 2026-09-28*

## Self-Check: PASSED
