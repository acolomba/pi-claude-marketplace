---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
plan: 01
subsystem: marketplace-add
tags: [git, isomorphic-git, marketplace-add, leftover-clone, gitops]

requires:
  - phase: 02-endpoints-that-answer-only-at-the-verbatim-url
    provides: canonicalCloneUrl / networkCloneUrl identity-vs-wire separation (D-2-01, D-2-03, D-2-05)
provides:
  - "GitOps.listRemotes -- the 8th platform-git primitive, a discriminated four-arm return (origin/no-origin/not-a-repo/unreadable) that never throws"
  - "addGitClonedInGuard step 4 as a recognize-remove-rename branch: a same-origin leftover clone recovers a marketplace add retry"
  - "domain/source.ts::stripGitSuffix exported as a shared leaf for the same-source identity comparison"
affects: [03-02-refusal-arm-and-leak-proofs, 03-03-cascade-and-phase-boundary]

actuals:
  tokens: 7690
  tasks: 2
  commits: 2
  plan_head_before: 41cc0d0b68c86eb25f0a4f7c6472afcdddf88a04
  plan_head_after: 498986513025080c073fa8c1544d3c733370fc24

tech-stack:
  added: []
  patterns:
    - "Discriminated-value return for a 'could not tell' distinction (mirrors domain/manifest-lookup.ts::ManifestLookup) -- listRemotes reports origin/no-origin/not-a-repo/unreadable instead of throwing, so a foreign tree stays distinguishable from an unreadable one."
    - "Own filesystem probe BEFORE the library call, because isomorphic-git 1.42.2 resolves a missing .git, an unreadable .git/config, and a real repo with zero remotes to the same empty array."
    - "Extract-to-reduce-complexity: a nested switch inside an already-large orchestrator function is pulled into its own module-private helper the moment a health gate (fallow's cognitive-complexity threshold) is crossed, rather than suppressed."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - tests/platform/git.test.ts
    - tests/platform/git-ops-fake.ts
    - tests/platform/git-ops-fake.test.ts
    - tests/platform/git-ops-contract.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/edge/types.test.ts
    - tests/e2e/import-command.test.ts
    - tests/domain/source.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "Extracted recognizeLeftover() out of addGitClonedInGuard (Rule 1 deviation, not in the plan): the inline switch pushed cognitive complexity to 18 against fallow's threshold of 15. The helper keeps the exhaustive four-arm switch (no default, so switch-exhaustiveness-check still catches a future fifth arm) but moves it out of the already-large orchestrator function."
  - "git-ops-fake.ts's listRemotes reads (and discards via void) opts.dir rather than dropping the parameter: GATE-01's unused-type-member gate flagged GitOps.listRemotes.opts.dir as unread when the fake ignored its argument entirely -- no other production or test code reads a value typed through the GitOps interface's own inline parameter type."
  - "The two check-unused-type-members.contracts.json pins at add.ts:545 (addMarketplace's overload signature literal) shifted to add.ts:565 once the joinLeaks and recognizeLeftover helpers landed above them; remapped in place after `npm run format`, entry count unchanged at 108."
  - "tests/orchestrators/marketplace/update.test.ts::makeForbiddenGitOps is a SIXTH hand-enumerated GitOps literal that 03-CONTEXT.md and 03-VALIDATION.md did not predict (they named git-ops-fake.ts, edge/types.test.ts, orchestrators/marketplace/shared.test.ts, e2e/import-command.test.ts). Fixed in the same style as its siblings: every operation, including the new listRemotes, rejects with 'Unexpected Git operation'."

patterns-established:
  - "listRemotes is the only GitOps member that reports failure as a return value instead of throwing -- documented inline at both the interface declaration and the implementation so a later reader does not 'simplify' the probe-then-throw ordering away."

requirements-completed: [MA-12, MA-13, MA-14]
# Copied verbatim from 03-01-PLAN.md frontmatter. MA-12/MA-13/MA-14 are ALSO
# declared by 03-02-PLAN.md's frontmatter, so REQUIREMENTS.md keeps them
# Pending until that plan's SUMMARY exists (shared-ID gate) -- this plan
# proves the MA-12 success path and all four listRemotes arms (MA-13's
# platform-tier half); MA-13's orchestrator-tier mismatch refusal and
# MA-14's leak arm are plan 02's proof.

coverage:
  - id: D1
    description: "marketplace add recovers from a same-origin leftover clone: the leftover's marker file is gone, the fresh clone's manifest is present at the same path, and state records the entry (MA-12)"
    requirement: MA-12
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-12: a leftover clone whose origin names the same source recovers"
        status: pass
    human_judgment: false
  - id: D2
    description: "GitOps.listRemotes returns a four-arm discriminated value (origin/no-origin/not-a-repo/unreadable) and never throws, proven against real git fixtures including a chmod-0o000 .git/config"
    requirement: MA-13
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#listRemotes (4 cases: origin, not-a-repo, no-origin, unreadable)"
        status: pass
      - kind: unit
        ref: "tests/platform/git-ops-contract.ts#reports the origin remote url"
        status: pass
    human_judgment: false
  - id: D3
    description: "domain/source.ts::stripGitSuffix exported and directly tested (one-suffix strip, no-suffix pass-through, doubled-suffix, no case folding)"
    verification:
      - kind: unit
        ref: "tests/domain/source.test.ts#stripGitSuffix"
        status: pass
    human_judgment: false
  - id: D4
    description: "platform/git.ts, orchestrators/marketplace/shared.ts, and domain/source.ts hold 100% direct branch/function/line coverage with no new scripts/test-coverage-direct.pin.json row"
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs (run on each of the three files)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-27
status: complete
---

# Phase 3 Plan 1: GitOps.listRemotes and the recognize-remove-rename leftover-clone guard Summary

**`GitOps` gains an 8th, never-throwing primitive (`listRemotes`) that lets `marketplace add` tell its own leftover clone apart from a foreign tree by comparing origins on identity, not wire form -- a same-source retry now succeeds instead of demanding a manual `rm -rf`.**

## Performance

- **Duration:** 55 min (approximate; start time not captured at dispatch)
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 15 (11 predicted by the plan + 4 deviation-driven: `tests/orchestrators/marketplace/update.test.ts`, `scripts/check-unused-type-members.contracts.json` pin remap, and the coverage/complexity fixes inside already-listed files)

## Accomplishments

- `platform/git.ts::listRemotes({ dir })` -- reads `<dir>/.git/config` itself before calling `git.listRemotes`, because isomorphic-git 1.42.2 resolves a missing `.git`, an unreadable `.git/config`, and a real zero-remote repo identically to `[]`. Returns `{ kind: "origin", url }` | `{ kind: "no-origin" }` | `{ kind: "not-a-repo" }` | `{ kind: "unreadable" }` and never throws.
- `orchestrators/marketplace/shared.ts` -- `GitOps` interface gains `listRemotes` as its 8th member (documented as the one member that returns failure instead of throwing); `DEFAULT_GIT_OPS.listRemotes = defaultGit.listRemotes`.
- `domain/source.ts::stripGitSuffix` -- the `export` keyword added; body unchanged. Third consumer (recognition) named in its docstring alongside the two existing parse-time compositions.
- `orchestrators/marketplace/add.ts::addGitClonedInGuard` step 4 -- now `pathExists` -> `gitOps.listRemotes` -> a new `recognizeLeftover()` helper that switches on all four arms (no `default`, so `switch-exhaustiveness-check` still catches a future fifth arm): the `origin` arm compares `stripGitSuffix(url)` against `canonicalCloneUrl(source)`; a match removes the leftover and falls through to the existing atomic rename; a mismatch or any other arm throws `StaleSourceCloneError` exactly as before (MA-13 unchanged). A leftover-removal leak that leaves the tree partially removed also throws (MA-14) rather than renaming over it.
- The leftover-removal leak and the staging-cleanup leak join into ONE string via a new `joinLeaks()` helper before the single pre-existing `appendLeakToError` call in the bottom MA-9 catch -- `unwrapAddError`'s one-level `Error.cause` unwrap contract is unaffected (`appendLeakToError(` call count: 4, unchanged; `cleanupStaging(` call count: 4 -> 5).
- End-to-end proof: `tests/orchestrators/marketplace/add.test.ts` -- a pre-existing `finalDir` with a marker file and a matching `listRemotesResult` recovers through the real parser, orchestrator, and `GitOps` seam; the marker is gone and the freshly cloned manifest is present at the same path.
- All four `listRemotes` arms proven against real directories on disk in `tests/platform/git.test.ts` (task 2), including a `chmod 0o000` unreadable `.git/config`, restored in a `finally`. The origin arm joined the shared production-vs-fake parity contract (`GIT_OPS_CASE_NAMES` 12 -> 13).

## Task Commits

Each task was committed atomically:

1. **Task 1: A leftover clone of the same source recovers, end to end** - `5b075fe0` (feat)
2. **Task 2: The other three listRemotes arms, against real directories** - `49898651` (test)

_Note: `tests/platform/git.test.ts` is shared by both tasks -- its origin-arm case and the `@ts-expect-error` removal landed in commit 1, its three remaining-arm cases landed in commit 2, matching the plan's task split exactly (the file was temporarily reduced to task 1's slice before the first commit, then task 2's cases were restored before the second)._

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - `listRemotes` wrapper + `ListRemotesOptions`/`ListRemotesResult` types
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - 8th `GitOps` member + `DEFAULT_GIT_OPS` wiring
- `extensions/pi-claude-marketplace/domain/source.ts` - `stripGitSuffix` exported
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - recognize-remove-rename step 4, `recognizeLeftover`, `joinLeaks`
- `tests/platform/git.test.ts` - `listRemotes` describe block (4 cases), 2 `@ts-expect-error` controls removed, `productionGitOps` updated
- `tests/platform/git-ops-fake.ts` - `listRemotesResult` option + `listRemotes` impl (reads `opts.dir`, no call ledger)
- `tests/platform/git-ops-fake.test.ts` - fake participant now supplies `listRemotesResult`
- `tests/platform/git-ops-contract.ts` - new parity case, `GIT_OPS_CASE_NAMES` 13 entries
- `tests/orchestrators/marketplace/add.test.ts` - `listRemotesResult` threaded through `createGitOps`; MA-12 end-to-end case
- `tests/orchestrators/marketplace/shared.test.ts` - `createGitOps` stub + `DEFAULT_GIT_OPS` reference-equality test updated
- `tests/orchestrators/marketplace/update.test.ts` - `makeForbiddenGitOps` gained a rejecting `listRemotes` stub (deviation)
- `tests/edge/types.test.ts` - `satisfies GitOps` literal stub
- `tests/e2e/import-command.test.ts` - `fixtureGitOps` stub (typecheck-only; suite not run by `npm run check`)
- `tests/domain/source.test.ts` - direct `stripGitSuffix` cases
- `scripts/check-unused-type-members.contracts.json` - two pins remapped 545 -> 565 (deviation)

## Decisions Made

See `key-decisions` in frontmatter. In prose: the leftover-removal and switch logic was extracted into a private `recognizeLeftover()` helper (not in the plan's literal text, which sketched the switch inline) because the inline version pushed `addGitClonedInGuard`'s cognitive complexity to 18 against fallow's health-gate threshold of 15 -- `npm run fallow` failed with exactly one over-threshold finding until the extraction. The extraction preserves every acceptance criterion byte-for-byte (same `cleanupStaging(` count of 5, same `appendLeakToError(` count of 4, same exhaustive four-arm switch with no `default`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/health-gate] Extracted `recognizeLeftover()` to keep `addGitClonedInGuard` under fallow's cognitive-complexity threshold**
- **Found during:** Task 1 verification (`npm run fallow`)
- **Issue:** The plan's literal inline switch inside `addGitClonedInGuard` pushed cognitive complexity to 18 (cyclomatic 15, 115 lines), crossing `.fallowrc.json`'s `maxCognitive: 15` and failing `fallow health --fail-on-issues`.
- **Fix:** Extracted the switch into a module-private `recognizeLeftover(finalDir, derivedName, source, gitOps, removalOps)` helper returning `string | undefined` (the leak, or undefined); `addGitClonedInGuard` now calls it and does only the `leftoverLeak !== undefined` MA-14 check inline.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
- **Verification:** `npm run fallow; echo "FALLOW_EXIT=$?"` -> `FALLOW_EXIT=0`, "0 above threshold" (was 1). All task 1/2 acceptance-criteria greps re-ran unchanged.
- **Commit:** `5b075fe0`

**2. [Rule 3 - Blocking] `tests/orchestrators/marketplace/update.test.ts::makeForbiddenGitOps` — unpredicted sixth hand-enumerated `GitOps` literal**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `makeForbiddenGitOps()` builds a `GitOps` value by enumerating all seven members with a rejecting stub per member; the eighth member broke `TS2741`. Neither 03-CONTEXT.md's "Planning found more than the research did" note nor 03-VALIDATION.md's Wave 0 list named this file.
- **Fix:** Added `listRemotes: () => reject("listRemotes"),` in the same style as its seven siblings.
- **Files modified:** `tests/orchestrators/marketplace/update.test.ts`
- **Verification:** `npx tsc --noEmit` exit 0; `node --test tests/orchestrators/marketplace/update.test.ts` 134/134 pass (combined with add.test.ts and e2e/import-command.test.ts).
- **Commit:** `5b075fe0`

**3. [Rule 3 - Blocking] `DEFAULT_GIT_OPS` by-reference equality test needed the new entry**
- **Found during:** Task 1 verification (`node --test tests/orchestrators/marketplace/shared.test.ts`)
- **Issue:** `shared.test.ts`'s "DEFAULT_GIT_OPS exposes every platform git function by exact reference" test builds its own `expectedReferences` object enumerating all seven members; `assert.deepStrictEqual` failed on the missing eighth key.
- **Fix:** Added `listRemotes: defaultGit.listRemotes,` to `expectedReferences`.
- **Files modified:** `tests/orchestrators/marketplace/shared.test.ts`
- **Verification:** `node --test tests/orchestrators/marketplace/shared.test.ts` -- 0 fail (was 1).
- **Commit:** `5b075fe0`

**4. [Rule 3 - Blocking] GATE-01's unused-type-member gate flagged `GitOps.listRemotes.opts.dir` as unread**
- **Found during:** Task 1 verification (`npm run lint:type-members`, after the two `add.ts:545` pins were remapped)
- **Issue:** `tests/platform/git-ops-fake.ts`'s `listRemotes` implementation took no parameter (`async listRemotes() { ... }`), so no code anywhere read a value typed through `GitOps.listRemotes`'s own inline `{ dir: string }` parameter type -- the interface member itself was called from `add.ts` (satisfying the member-level gate), but the `dir` FIELD inside its options type had no runtime read.
- **Fix:** Accepted the parameter and read (and discarded) `opts.dir` via `void listRemotesOptions.dir;`, with a comment explaining why, rather than adding a call ledger (forbidden by the plan, since `git-ops-fake.test.ts` deep-equals the whole `state.calls` object).
- **Files modified:** `tests/platform/git-ops-fake.ts`
- **Verification:** `npm run lint:type-members` -- "Unused type member gate passed with 4 recorded exception(s)" (the same 4 pre-existing exceptions; no new pin or exception added).
- **Commit:** `5b075fe0`

**5. [Rule 3 - Blocking] `check-unused-type-members.contracts.json` pins at `add.ts:545` moved to `add.ts:565`**
- **Found during:** Task 1 verification (`npm run lint:type-members`, before fix 4)
- **Issue:** The `joinLeaks` and `recognizeLeftover` helper functions, added above `addMarketplace`'s overload signatures, pushed the pinned `notifications`/`mode` type-refinement sites from line 545 to line 565. No import line changed (as the plan predicted), but new function bodies did.
- **Fix:** Remapped both `id` and `refines` fields from `545:*` to `565:*` (columns 35/52/9 unchanged -- the code moved vertically only).
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` -- no "Invalid contract" error; entry count unchanged at 108.
- **Commit:** `5b075fe0`

---

**Total deviations:** 5 auto-fixed (1 Rule 1 health-gate fix, 4 Rule 3 blocking-compile/gate fixes).
**Impact on plan:** All five were required to reach the plan's own verify commands (`npx tsc --noEmit`, `node --test`, `npm run fallow`, `npm run lint:type-members`). None widened MA-12/MA-13 semantics, changed the five compile-break file list's outcome, or touched the declared mid-plan red in `add.ts`'s refusal arms. No scope creep.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Answers to `<output>`'s required record

- **Final arm names/payloads of `ListRemotesResult`:** `{ kind: "origin"; url: string }` | `{ kind: "no-origin" }` | `{ kind: "not-a-repo" }` | `{ kind: "unreadable" }`. No `errno` field on `unreadable` (no consumer needed one).
- **Single `.git/config` read sufficiency:** Yes -- one `fs.promises.readFile(<dir>/.git/config)` distinguishes `not-a-repo` (ENOENT/ENOTDIR) from `unreadable` (any other error code) BEFORE the isomorphic-git call; no second probe was needed.
- **Leak-joining helper name:** `joinLeaks(a, b)` in `add.ts`, beside `unwrapAddError`.
- **`appendLeakToError(` count:** 4 before this plan, 4 after (unchanged, as required).
- **`cleanupStaging(` count:** 4 before this plan, 5 after.
- **`add.ts:545` pins:** MOVED to `add.ts:565` (columns unchanged: 35, 52, refines-9).
- **New `GIT_OPS_CASE_NAMES` entry verbatim:** `"reports the origin remote url"`.
- **Files needing a `listRemotes` stub purely for interface conformance:** `tests/platform/git-ops-fake.ts`, `tests/edge/types.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/e2e/import-command.test.ts` (all predicted by the plan), plus **one the plan did not predict**: `tests/orchestrators/marketplace/update.test.ts::makeForbiddenGitOps`.
- **`npm run test:e2e`:** NOT run this session (optional per the plan; the suite hits a real network and is not part of `npm run check`). `npx tsc --noEmit` and `npm run lint` both cover `tests/e2e/import-command.test.ts` and both passed.
- **Empirically confirmed uncovered `add.ts` branches at this plan's boundary** (measured via `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`; NOT a required gate for this plan, run for documentation only -- branches 136/140, lines 983/996):
  - `joinLeaks()` lines 250-255: only the `a === undefined` (return `b`) arm is exercised; the `b === undefined` (return `a`) arm and the both-defined join arm are not.
  - `recognizeLeftover()` lines 726-729: the `origin`-arm-but-mismatched throw (an `origin` remote naming a DIFFERENT source) is not exercised. The `no-origin`/`not-a-repo`/`unreadable` throws (line 735) ARE exercised, via the pre-existing MA-6/WR-07 tests whose fake defaults to `{ kind: "not-a-repo" }`.
  - `addGitClonedInGuard()` lines 791-793: the MA-14 "recognized leftover whose removal leaks" throw is not exercised.

  This is a narrower, measured list than 03-VALIDATION.md's "Branch Budget" prediction (which additionally counted the already-covered no-origin/not-a-repo/unreadable throws as open). Plan 02 should target exactly these three uncovered spans plus the whole-suite `npm run test:coverage:unit` 100%-branch gate.

## Next Phase Readiness

Plan 02 has an exact, measured list of what to close (above) rather than a prediction. The `GitOps` seam, `recognizeLeftover`/`joinLeaks` helpers, and the exported `stripGitSuffix` leaf are all in place and stable; plan 02 adds refusal-arm and leak proofs to `add.test.ts` without touching production code further (per the plan's own scope note). No blockers.

## Threat Flags

None. `T-3-01` (removal-decision tampering) and `T-3-02` (origin-url information disclosure) from the plan's own threat model are both mitigated as designed: removal only fires on a byte-equal `stripGitSuffix(origin) === canonicalCloneUrl(source)` match, and the origin url is compared and discarded -- never interpolated into `StaleSourceCloneError`, which carries only `finalDir` and the derived name. `tests/architecture/no-credential-leak.test.ts` already registers both touched files and ran clean as part of `npm run lint`/`npx tsc --noEmit`. No new network endpoint, auth path, or schema change was introduced.

---
*Phase: 03-marketplace-add-recovers-from-its-own-leftover-clone*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 15 modified files verified present on disk; both task commits (`5b075fe0`, `49898651`) verified present in `git log --oneline --all`. `npx tsc --noEmit`, the task-level `node --test` suites, `npm run lint`, `npm run format:check`, `npm run lint:type-members`, and `npm run fallow` all re-ran green after the final state of both commits.
