# Deferred items — phase 117

Out-of-scope discoveries logged during execution. Each names the plan that found
it and why that plan could not resolve it.

## 1. Stale test path in an `install.messaging.ts` doc comment

- **Found during:** 117-04 Task 1
- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`
  (the `isHooksResolverNote` doc comment)
- **Issue:** the comment pins the cross-surface parity contract to
  `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`. Plan 117-04
  moved that suite to `tests/architecture/cross-surface-reason-parity.test.ts`,
  so the cited path no longer exists.
- **Why not fixed here:** 117-04 forbids production edits, and both of its verify
  blocks assert `git diff --quiet -- extensions/ package.json`. Correcting the
  comment would have failed the plan's own gate.
- **Suggested owner:** the 117-12 closing sweep, or any later plan already
  editing this file.
- **Impact:** documentation only. No gate reads the cited path, and the pinning
  suite still runs — at its new location.

## 2. Stale byte-form-lock path in the output catalog

- **Found during:** 117-05 Task 1
- **File:** `docs/output-catalog.md` (the `### Device Flow user-code prompt
  (AUTH-03)` entry, `<!-- catalog-state: device-flow-prompt -->`)
- **Issue:** the entry's prose says "The byte form is locked by
  `tests/shared/device-flow-prompt.test.ts`". Plan 117-05 folded that suite into
  `tests/domain/github-auth.test.ts` and deleted it, so the cited path no longer
  exists. The correct pointer is the
  `emits the documented AUTH-03 prompt before any token is acquired` case in
  `tests/domain/github-auth.test.ts`.
- **Why not fixed here:** 117-05 pins the catalog. Its verify block ends with
  `git diff --quiet -- extensions/ package.json docs/output-catalog.md`, so
  editing the entry would have failed the plan's own gate.
- **Suggested owner:** the 117-12 closing sweep, or any later plan already
  editing the catalog.
- **Impact:** documentation only. No gate reads the cited path — `catalog-uat`
  pairs on the `catalog-state` marker, not on the prose — and the byte form is
  still locked, at its new location.

## 3. Stale `tests/helpers/` references throughout the codebase map

- **Found during:** 117-07 Task 1
- **File:** `.planning/codebase/TESTING.md` (lines 16, 38, 51, 91, 93, 115, 124,
  127, 144, 147)
- **Issue:** the document describes `tests/helpers/` as a live directory that
  holds every hand-written test double, quotes both unit globs with the
  `helpers` alternative still in them, and names four modules by their old
  paths — including `tests/helpers/marketplace-seed.ts` and
  `tests/helpers/source-scan.ts`. Plans 117-02, 117-03, 117-04 and this plan
  moved all four out and 117-07 deleted the directory and both glob
  alternatives, so none of those paths exists.
- **Why not fixed here:** 117-07's `files_modified` names only the seed, its 15
  consumers and `package.json`. The staleness is phase-wide rather than this
  plan's, and a single plan rewriting a shared map another plan is also about
  to touch invites a conflict.
- **Suggested owner:** the 117-12 closing sweep, which can re-derive the whole
  section once every move in the phase has landed.
- **Impact:** documentation only. No gate reads `TESTING.md`; the
  glob-completeness control reads the live scripts in `package.json`, which are
  correct.

## 4. RESOLVED - `--all` cannot complete: the seven D-116-01a shortfalls are accepted

- **Found during:** 117-11 Task 2
- **File:** `scripts/test-coverage-direct.mjs` (`assertCompleteCoverage`), against the
  seven `edge/` modules in `.planning/WINDOWS.md` entries 15-19, 21 and 22
- **Issue:** the all-pair run throws `Incomplete direct coverage for <source>` on the
  first D-116-01a claimant it reaches and stops, so `--all` cannot produce a 204-row
  result on this tree. Measured over every row on both available interpreters: the
  same seven modules fall short, each by **exactly one branch** —
  `edge/args.ts` 28/29, `edge/completions/data.ts` 109/110,
  `edge/completions/provider.ts` 79/80,
  `edge/handlers/marketplace/update.ts` 11/12,
  `edge/handlers/plugin/import.ts` 11/12,
  `edge/handlers/plugin/pending.ts` 9/10,
  `edge/handlers/shared.ts` 14/15. Those are precisely the seven `open`
  D-116-01a claimants, each already pinned by its own pair and filed in the ledger.
  Nothing regressed; the operator accepted these shortfalls in the previous phase.
- **Consequence for COV-05:** the true composition of the 204 rows is **190 complete
  numeric records + 7 accepted single-branch shortfalls + 7 type-only verdicts**.
  D-117-20 reads COV-05 as "197 numeric records plus 7 named type-only rows"; that
  reading does not account for the seven D-116-01a rows and cannot be satisfied.
- **Why not fixed here:** 117-11 Task 2 forbids editing the gate script, and
  D-116-01a's standing ban — "no coverage-exception pragma, ever" — means the obvious
  workaround (an allowlist of accepted shortfalls) is exactly the thing the phase
  prohibits. How the all-pair gate should represent an accepted shortfall is an
  operator decision, not an executor one.
- **RESOLUTION (operator, 2026-09-03):** amend D-117-20 to **190 + 7 + 7**. The gate is
  deliberately NOT changed, no ledger-keyed verdict is added, and no production licence is
  opened -- a ledger-keyed pass would be D-116-01a's banned pragma wearing a different hat,
  and the seven are already pinned by identity in their own pairs. The decision record moves
  to meet the measurement. The retained 204-row result is
  `117-ALL-PAIR-RESULT.ndjson`, produced by driving the shipped gate once per row and
  recording each row's exit code; `117-ALL-PAIR-RESULT.md` carries the reading, the line
  dimension per shortfall, the runtime and the concurrency decision. Ledger entry 27 is
  closed. Nothing is left for the 117-12 sweep here.

## 5. RESOLVED - The PATH interpreter was upgraded mid-phase and reddened 11 tests

- **Found during:** 117-11 Task 2
- **File:** ten test suites, led by
  `tests/bridges/agents/marker.test.ts:232` ("propagates a read error for a directory
  target")
- **Issue:** `/home/linuxbrew/.linuxbrew/bin/node` moved from **v26.7.0** (the version
  D-117-18 measured, and the version this phase's `npm test` baseline was taken on) to
  **v26.8.1** during this plan's execution. The Cellar no longer holds 26.7.0.
  On v26.8.1 an `EISDIR` error raised by `readFile` on a directory now carries a
  `path` property; on v26.7.0 and on v22.22.2 it does not. Eleven whole-value
  assertions compare against `path: undefined` and now fail. Measured:
  `npm test` on v26.8.1 is **5131 pass / 11 fail**; on `/usr/bin/node` v22.22.2 the
  same tree is **5142 pass / 0 fail**.
- **Why not fixed here:** 117-11 forbids editing test files, the failures belong to ten
  pairs this plan does not own, and installing a Node version is an environment
  mutation the executor may not make unasked.
- **Impact:** CI is unaffected — it pins Node 24 in `.github/workflows/ci.yml`
  (`node-version: "24"` at lines 70, 91, 111 and 132). This is a local-tree hazard, and
  the same class as D-117-18's warning: a whole-value comparison that captures a value
  the runtime owns.
- **RESOLUTION (operator, 2026-09-03):** an authorized scope addition to plan 117-11
  hardened the assertions in place. The measured set was **12 sites across 10 files** --
  two projecting the errno `path` and ten pinning the errno message text -- not the 16
  sites across 7 suites the failure log suggested. `tests/bridges/commands/unstage.test.ts`
  was correctly left alone: its `unlink` message is path-based and always carried the path.
  The fix keeps every comparison whole-value: projections that already carry `code` and
  `syscall` drop the derived field, and the five sites where production composes its own
  sentence read the runtime's wording back from the same failing read. Measured after:
  `npm test` 5142/295/0 on v26.8.1, and the ten suites 411/411 on BOTH v22.22.2 and
  v26.8.1. Five plants confirm the assertions still fire. Ledger entry 28 is closed.
