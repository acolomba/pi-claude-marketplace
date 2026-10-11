# Row-policy execution checkpoint

**Recorded:** 2026-10-01
**Plan:** 02-01
**Status:** resolved on 2026-10-01; both tasks are committed and verified.
**Branch:** `features/json`
**Base:** `1c363b91e0fb401daec19fa33c2aff1c50161291`
**Worktree:** `/home/acolomba/src/pi-claude-marketplace-json`

## Resolution

The user explicitly approved the three additional substitutions with "yes".
Current D-07 permits exactly 28 replacements. The immutable ledger check passed:
28 replacements, 2,633 unchanged occurrences, 2,661 total. The complete corpus
check passed with 2,661 baseline entries present and zero extra. Severity,
argument count, metadata, and the production catalog remain unchanged.

All-owner direct coverage completed successfully: 253 pairs in 499.5 seconds.
Required pre-commit checks passed, including the clean lint-hook rerun after a
documentation edit triggered its whole-tree change detector. Checked task bytes
were unchanged. Per-commit Fallow audits reported no blocking findings.

- Task 1: `029250ee` — semantic row-policy migration and approved corpus ledger.
- Task 2: `aaa57348` — defensive policies and collection-edge tests.
- Completed evidence: `02-01-SUMMARY.md`.

The sections below preserve the original checkpoint as historical evidence.
Their pending-job and approval instructions are superseded by this resolution.

## Required decision

D-07 authorizes exactly 25 synthetic substitutions. The complete corpus run
found three additional pre-existing synthetic callback emissions in
`tests/shared/notification-summary.test.ts`. Removing its `renderRow` callback
correctly adds the real glyphs and reasons. Preserving those old callback bytes
would require the callback/template/replay behavior that the plan forbids.

The parent has requested explicit approval to expand the exception from 25 to
28. **No approval has been received and no extra baseline change has been made.**

| Original baseline line | Test | Old body row | New body row | Severity / argc |
| --- | --- | --- | --- | --- |
| 2633 | nonempty all-failure summary, tally, and reload hint retain their exact order | `  alpha (failed)` | `  ⊘ alpha (failed) {not found}` | error / 2 |
| 2634 | reconcile applied fold suppresses reload while preserving severity and tally | `  alpha (failed)` | `  ⊘ alpha (failed) {not found}` | error / 2 |
| 2640 | update no-op fold preserves empty and non-empty bodies | `  alpha (partially-upgradable)` | `  ● alpha (partially-upgradable) {lsp}` | null / 1 |

All prefixes, summaries, tallies, reload/no-op trailers, severities, and argument
counts remain unchanged. Exact additional records are prepared outside the
repository at `/tmp/row-policy-extra-corpus-changes.json`.

The repository's `02-CORPUS-CHANGES.json` still contains exactly 25 records.
The original baseline blob is `25f4e3c0a943a15a91d5231afef1551e5e5a6259`.
The metadata remains at blob `5304d88af67d0b4d58c3572aea6f9e5d3e73be7b`.

## Implemented work

- All 18 contexts across 15 messaging modules use total data-only row policies.
- The resolver owns reason inclusion and missing-policy facts, uses own-property
  lookup, and preserves writable/frozen severity behavior.
- The shared grammar uses one private 19-status layout table. Public
  `composePluginLines` formats resolved rows without command callbacks.
- All context wrappers retain producer-status constraints, including reconcile.
- Owner and architecture tests use the policy/formatter path. The fresh AST
  census is **69 actual callback calls in 12 owner files**, with zero remaining.
  The plan's 70-call inventory was stale: 84 `.render` references included 15
  key-enumeration references.
- Task 2 adds pure tests for inherited names, duplicates and ordering, opposite
  pending snapshots, diagnostic trailers, empty/singleton collections, and null
  compile-time refusals. It adds no notification calls.

Necessary additional consumers outside the initial list were
`orchestrators/plugin/shared.ts`, `orchestrators/reconcile/notify.ts`, their
relevant shared owner tests, and `tests/architecture/compat-01-no-expansion.test.ts`.
The existing type-member contract records were reanchored; 12 retired contracts
and four retired exceptions were removed with their deleted declarations.
`scripts/check-unused-type-members.exceptions.json` retains its three existing
surviving exceptions, with the shifted shared.ts coordinate corrected.

The plan's suggested omission of an uninstalled version contradicted existing
source and tests. The parent authorized preserving that optional version under
D-07. A complete reconcile-owner assertion pins this behavior.

## Verification evidence

| Check | Result / evidence |
| --- | --- |
| Intentional RED | Missing-policy fact assertion failed before implementation; `/tmp/row-policy-red.json` passed `check tdd-red-evidence` |
| Focused migration suites | 679 tests passed; `/tmp/row-policy-focused-final.log` |
| Full `npm run check` | Passed on task 1 tree; `/tmp/row-policy-check4.log` |
| Unit coverage | 7,572 tests, 312 suites, zero skips; 100% functions, lines, and branches; 439.1 seconds |
| Integration | 36 tests passed; 15.3 seconds |
| Type-member gate | Passed with three pre-existing exceptions; all seven negative controls passed |
| Full-check duration | 22m57s, 22:05:20–22:28:17 UTC |
| Immutable 25-record ledger check | Passed: 25 substitutions, 2,636 unchanged occurrences, 2,661 total; metadata hash unchanged |
| Catalog | `git diff --exit-code e40d3dda -- docs/output-catalog.md` passed |
| Complete corpus | Failed only on the three summary-owner substitutions above; `/tmp/row-policy-corpus3.log` |
| Changed-owner direct coverage | All 22 owners reached 100%; original run plus completed grammar/resolver follow-ups in `/tmp/row-policy-direct.log`, `/tmp/row-policy-grammar-direct.log`, `/tmp/row-policy-resolve-direct.log` |
| Task 2 scoped lint | Passed; `/tmp/row-policy-task2-lint.log` |
| Task 2 typecheck | Passed; `/tmp/row-policy-task2-typecheck.log` |
| Task 2 focused suites | 220 tests passed; `/tmp/row-policy-task2-focused.log` |
| Required all-owner direct coverage | RUNNING; see job details below |

The parent authorized reuse of task 1's full check for task 2's pure test
additions, with focused/typecheck/direct coverage here and the final full check
and corpus after plan 02. Do not repeat a full check or full capture while
corpus approval is pending.

## Active required coverage job

- Command: `npm run test:coverage:direct:all`
- Tool session: `74799`
- Process at handoff preparation: PID `2098390`, parent `2098357`
- Started: 22:33:08 UTC
- Latest progress: 211 owners passed; the run has reached persistence owners.
  No failure has been reported.
- Log: `/tmp/row-policy-direct-all.log`
- Final report: `coverage/all-pairs.jsonl`

This is the plan's required all-owner gate. Preserve the running job and read its
result; do not start a duplicate. Sibling worktree jobs must remain untouched.

## Resume and commit boundaries

No task commits or summary have been created. Git staging is untouched.
Parent-owned edits in `STATE.md`, `state.json`, and `milestone.lock` must remain
separate. This checkpoint is also separate from the task commits.

- Task 1 file list: `/tmp/row-policy-task1-files` (48 explicit paths).
- Task 1 versions of the three shared test files:
  `/tmp/row-policy-task1-tests/`.
- Task 2 changes only: `/tmp/row-policy-task2.patch` (257 lines).
- Git base ledger:
  `/home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-json/gsd-plan-head-before-02-01`.
- Worktree guard is recorded in the adjacent `gsd-spawn-toplevel` file.

If the three replacements are approved, update the explicit ledger and patch
only those three original occurrences, preserving ASCII serialization and sort
order. Update the exact acceptance count to 28 substitutions / 2,633 unchanged /
2,661 total. Recheck the immutable ledger and full corpus, without recapturing
the baseline. If approval is declined, obtain a revised contract; do not add an
adapter, replay old literals, or weaken corpus validation.

Keep task commits separate. One safe staging method is to stage the explicit
task 1 paths and reverse-apply `/tmp/row-policy-task2.patch` **to the index only**.
Verify the three staged test files equal the saved task 1 versions. The working
tree retains task 2. Run mandatory pre-commit and Fallow audit before committing,
with `SKIP=trufflehog`, Conventional Commit titles, and no history rewrite.
Then stage and commit the remaining task 2 test changes with their required
gates. Required pre-commit/Fallow audit have not yet been run for these commits.

Finally write `02-01-SUMMARY.md` with measured actuals, commit hashes, evidence,
deviations, and the mandatory Threat Flags section. Parent owns state/roadmap
updates and plan 02. Do not mark this plan or phase complete at this checkpoint.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced.
