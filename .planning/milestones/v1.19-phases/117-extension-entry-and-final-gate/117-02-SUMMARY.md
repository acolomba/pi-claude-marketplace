---
phase: 117-extension-entry-and-final-gate
plan: "02"
subsystem: testing
tags: [node-test, architecture-test, integration, git-rename, import-order]

requires:
  - phase: 116-edge-surface
    provides: the D-116-04 plant-and-record discipline, and the 116-17 rename-similarity finding this plan's one-commit shape rests on
provides:
  - the shared source-scanning mechanic and its gate-the-gate suite, beside the five architecture gates that consume them
  - the forked-child IPC stubs, beside the two integration children that consume them
  - one fewer correspondence-gate violation, resolved by subject rather than by an allow-list
  - tests/helpers/ reduced to its two remaining cross-tier modules
affects: [117-03 notification-boundary move, 117-04 orphan relocations, 117-07 marketplace-seed move and directory close-out]

actuals:
  tokens: 2023
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "move-and-rewrite in one commit: the git mv and its consumer import rewrites ship together, because a commit that moves a module without fixing its consumers does not typecheck"
    - "the rename is asserted by a staged-diff gate rather than claimed in prose"

key-files:
  created:
    - tests/architecture/source-scan.ts
    - tests/architecture/source-scan.test.ts
    - tests/integration/ipc-child.ts
  modified:
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/import-boundaries.test.ts
    - tests/architecture/manifest-lookup-drift.test.ts
    - tests/architecture/no-lifecycle-default-enabled-read.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/integration/concurrent-install-child.ts
    - tests/integration/load-reconcile-race-child.ts

key-decisions:
  - "The move and its consumer rewrites are one commit per module, not a pure-move commit plus a rewrite commit: a pure-move commit would leave the consumers importing a path that no longer exists, so it would not typecheck."
  - "The moved modules' bodies were not rewritten. Their pre-existing double assertions stay as they are; rewriting them is a second concern and would also destroy the rename similarity the gate measures."
  - "ESLint placed the new import group and Prettier decided the statement shape; neither was guessed. Prettier's collapse of the two integration imports contradicted the ESLint autofix result and was found only by running both."

patterns-established:
  - "Support module beside its consumers: when every consumer of a test-support module lives in one tier, the module moves into that tier and the import becomes a sibling."
  - "A data-only path literal is planted, not reasoned about: no branch selects it, so only a case that reads it can catch a wrong value."

requirements-completed: [SUITE-02, SUITE-03, OWN-06, DEL-03]

coverage:
  - id: D1
    description: "The shared source-scanning mechanic and its gate-the-gate suite live in tests/architecture/, and all five architecture gates import them as siblings"
    requirement: SUITE-02
    verification:
      - kind: unit
        ref: "node --test tests/architecture/source-scan.test.ts — 4 tests, 4 pass, 0 fail"
        status: pass
      - kind: unit
        ref: "node --test over the five consumers (no-orchestrator-network, import-boundaries, compat-01-no-expansion, manifest-lookup-drift, no-lifecycle-default-enabled-read) — 26 tests, 26 pass, 0 fail"
        status: pass
      - kind: other
        ref: "npm exec -- eslint tests/architecture — exit 0 after the import-group placement ESLint itself chose"
        status: pass
    human_judgment: false
  - id: D2
    description: "The WR-06 case's path literal names the module's new location and is load-bearing"
    requirement: SUITE-03
    verification:
      - kind: other
        ref: "plant: the literal reverted to tests/helpers/source-scan.ts — the case went RED with the target-missing message instead of the expected-failure message; verbatim output recorded in this summary"
        status: pass
    human_judgment: false
  - id: D3
    description: "The forked-child IPC stubs live beside the two integration children, and the fork target is unaffected"
    requirement: SUITE-02
    verification:
      - kind: integration
        ref: "npm run test:integration — runner reported ℹ tests 31, ℹ pass 31, ℹ fail 0"
        status: pass
      - kind: other
        ref: "read both fork call sites: each parent composes CHILD_PATH absolutely from its own directory and names a child already in tests/integration/"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both moves are recorded by git as renames, so git log --follow reaches through each"
    requirement: DEL-03
    verification:
      - kind: other
        ref: "git diff --cached -M --summary reported rename ... source-scan.ts (96%), source-scan.test.ts (96%), ipc-child.ts (98%); git log --follow reaches the pre-move history for all three"
        status: pass
    human_judgment: false
  - id: D5
    description: "One correspondence-gate violation resolved, and no production file or manifest changed"
    requirement: OWN-06
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs — 7 violations, down from 8; no source-scan or ipc-child row"
        status: pass
      - kind: other
        ref: "git diff --quiet -- extensions/ package.json and git diff --cached --quiet -- extensions/ package.json — both exit 0"
        status: pass
    human_judgment: false

duration: 15 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 02: The Two Clean Helper Moves Summary

**`source-scan.ts` and its suite moved beside the five architecture gates that consume them, and `ipc-child.ts` beside the two integration children — seven import lines rewritten, both moves recorded by git as renames at 96 and 98 percent, and one correspondence-gate violation resolved as a side effect.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-03T17:23:36Z
- **Completed:** 2026-09-03T17:39:04Z
- **Tasks:** 2
- **Files modified:** 10 (3 moved, 7 edited in place)

## Accomplishments

- `tests/helpers/source-scan.ts` and `tests/helpers/source-scan.test.ts` now live in `tests/architecture/`, beside all five gates that consume them. Every consumer's specifier is a sibling import.
- `tests/helpers/ipc-child.ts` now lives in `tests/integration/`, beside `concurrent-install-child.ts` and `load-reconcile-race-child.ts`. Both children import it as a sibling.
- The correspondence gate went from **8 violations to 7**. `unexpected-test: tests/helpers/source-scan.test.ts` is gone — `tests/architecture` is one of the gate's `nonCorrespondingRoots`, so the suite is exempt by root at its new home. No allow-list entry was added.
- `tests/helpers/` is down to exactly **two files**: `marketplace-seed.ts` and `notification-boundary.ts` — the state success criterion 1 names.
- The repository-root climb survived both moves, confirmed by running the suites rather than by counting path segments. Both old and new homes sit two levels below the root; every gate that resolves targets through `REPO_ROOT` still finds them.
- Neither moved module's body was rewritten. Their pre-existing double assertions are untouched.

## Task Commits

1. **Task 1: Move the source-scanning mechanic and its suite beside the architecture gates** — `d2287d5e` (refactor)
2. **Task 2: Move the forked-child IPC stubs beside the integration children** — `263b9c26` (refactor)

**Plan metadata:** see the `docs(117-02)` commit that carries this summary.

## Files Created/Modified

Moved (recorded as renames):

- `tests/helpers/source-scan.ts` → `tests/architecture/source-scan.ts` (96%) — the shared scanning mechanic
- `tests/helpers/source-scan.test.ts` → `tests/architecture/source-scan.test.ts` (96%) — its gate-the-gate suite
- `tests/helpers/ipc-child.ts` → `tests/integration/ipc-child.ts` (98%) — the forked-child stubs

Edited in place:

- `tests/architecture/compat-01-no-expansion.test.ts` — sibling specifier, a blank line ESLint added for the new import group, and the prose at line 39 that named the old path
- `tests/architecture/import-boundaries.test.ts` — sibling specifier
- `tests/architecture/manifest-lookup-drift.test.ts` — sibling specifier
- `tests/architecture/no-lifecycle-default-enabled-read.test.ts` — sibling specifier
- `tests/architecture/no-orchestrator-network.test.ts` — sibling specifier and the prose at line 123 that named the old path
- `tests/integration/concurrent-install-child.ts` — sibling specifier, import group placed by ESLint and collapsed by Prettier
- `tests/integration/load-reconcile-race-child.ts` — same

## Edits inside the moved files

`source-scan.ts`: the sentence naming `tests/helpers/` and two sibling modules (`credential-mock.ts`, `git-mock.ts`) was deleted — both were confirmed absent from `tests/` by `find`, so it named nothing. The surviving fact it carried, that the module registers no case of its own, is kept as a one-line sentence. The `REPO_ROOT` doc comment's directory name was corrected to `tests/architecture/`.

`source-scan.test.ts`: the line-1 path header comment, and the line-55 data string the WR-06 case feeds the scanner.

`ipc-child.ts`: the line-1 path header comment only. Its line-3 sentence ("the forked IPC child drivers under `tests/integration/`") was already accurate and was left alone.

No relocation note was added to any of the three. `rg -n 'Phase [0-9]|Plan [0-9]|Wave [0-9]|Pitfall [0-9]|moved from|relocated'` finds nothing in any of them.

## The plant (D-116-04)

A byte copy of `source-scan.test.ts` was taken first; the restore was made from that copy, never by re-editing, and `md5sum` matched afterwards.

**Plant:** the line-55 path literal reverted to its old value `"tests/helpers/source-scan.ts"`. The case went **RED**. Verbatim, trimmed to the material lines:

```
✔ WR-06: a target that does not exist fails the scan instead of being skipped (9.682779ms)
✔ WR-06: a not-yet-written target passes only when it is named in allowMissing (6.191177ms)
✖ WR-06: an existing target is really inspected -- a forbidden pattern in it fails (2.431812ms)
✔ stripComments removes block and line comments so a gate does not match its own prose (1.867164ms)
ℹ tests 4
ℹ pass 3
ℹ fail 1

✖ failing tests:

test at tests/architecture/source-scan.test.ts:51:1
✖ WR-06: an existing target is really inspected -- a forbidden pattern in it fails (2.431812ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /expected-failure/. Input:

  'AssertionError [ERR_ASSERTION]: source-scan: target tests/helpers/source-scan.ts does not exist, so this gate inspected nothing for it. A renamed or deleted target silently uncovers the gate; add it to allowMissing only while it is genuinely unwritten.'
```

This is the diagnostic the plan anticipated, and it arrives by the route that matters: the case rejects with the **target-missing** message rather than the **expected-failure** message it asserts. The three sibling cases stayed green, so the plant is scoped to the one case that reads the literal. Exit code 1. After restore, exit 0 with 4/4 passing.

## The fork call sites, as read

Task 2's acceptance criterion asks for what the two `fork` call sites actually do with the child path, so it is recorded rather than assumed:

```
tests/integration/concurrent-install.test.ts:52
  const CHILD_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "concurrent-install-child.ts",
  );
tests/integration/concurrent-install.test.ts:125,130   fork(CHILD_PATH, [], { … })

tests/integration/load-reconcile-race.test.ts:57
  const CHILD_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "load-reconcile-race-child.ts",
  );
tests/integration/load-reconcile-race.test.ts:140,145,449   fork(CHILD_PATH, [], { … })
```

Each parent composes an absolute path from its **own** directory and names a child that already lived in `tests/integration/`. Moving `ipc-child.ts` into that same directory changes the children's own relative import and nothing about the spawn target. The 31/31 integration run is the confirmation.

## Gate results

Every link run separately, exit code read from the command itself and never from a pipe tail.

| Link | Task 1 | Task 2 |
| --- | --- | --- |
| focused `node --test` (moved suite) | 0 — 4 tests, 4 pass | — |
| focused `node --test` (five consumers) | 0 — 26 tests, 26 pass | — |
| `npm run typecheck` | 0 | 0 |
| `npm exec -- eslint <dir>` | 0 | 0 |
| `npm exec -- prettier --check <files>` | 0 | 0 (after the collapse below) |
| `npm run fallow` | 0 | 0, moved module named in no finding |
| `npm test` | 0 — 5143 tests, 295 suites, 0 fail | 0 — 5143 tests, 295 suites, 0 fail |
| `npm run test:integration` | — | 0 — `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0` |
| old-directory scan | 1 (no match) | 1 (no match) |
| relocation-history scan | 1 (no match) | 1 (no match) |
| correspondence gate names the moved path | 1 (not named) | 1 (not named) |
| `git diff --quiet -- extensions/ package.json` | 0 | 0 |
| staged rename summary carries a rename line | 0 — 96% and 96% | 0 — 98% |

`npm run check` was not used, per the plan: its `format:check` link fails on the operator's pre-existing untracked files and short-circuits before the tests run.

The correspondence gate itself still exits 1, now with **7** violations — `missing-test: tests/index.test.ts` plus six `unexpected-test` rows. The eighth, `unexpected-test: tests/helpers/source-scan.test.ts`, is resolved by this plan.

Pre-commit hooks were run file-scoped before each commit and all passed, with `trufflehog` and `npm-format-check` skipped for the two documented reasons (the git-mode scan aborts structurally in a linked worktree; the format check fails on the operator's untracked files). Both commits were preceded by the sanctioned substitute — a filesystem trufflehog scan over the literal paths, `--results=verified,unknown --fail`: task 1 `chunks: 10, bytes: 75143, verified_secrets: 0, unverified_secrets: 0`, exit 0; task 2 `chunks: 3, bytes: 6235, verified_secrets: 0, unverified_secrets: 0`, exit 0.

## Decisions Made

- **One commit per module, containing the move and its consumer rewrites.** The plan's `must_haves` already declined the split and this execution confirmed the reason empirically: a pure-move commit leaves five (then two) files importing a path that no longer exists, so `npm run typecheck` would fail on it. The 116-17 rule that forces a split bites on a move plus a *total* rewrite; these are a header line, a stale sentence and one data string, and git reported renames at 96 and 98 percent.
- **The import placement was measured, not authored.** ESLint reported one violation in `compat-01-no-expansion.test.ts` (the parent group needed a blank line before the new sibling group) and two in the integration children, and `--fix` produced the placement. That is the plan's instruction — do not guess the ordering — and it mattered: only one of the five architecture consumers needed any change beyond its specifier.
- **Prettier overrode ESLint's shape in `tests/integration/`.** After `eslint --fix`, `prettier --check` failed on both children: the shorter `./ipc-child.ts` specifier let each multi-line import collapse onto one 94-character line. Running both tools rather than either alone is what caught it. The moved `source-scan` files needed no such collapse.
- **`ipc-child.ts` line 3 was left alone.** It reads "the forked IPC child drivers under `tests/integration/`", which is now the module's own directory and still accurate. Rewriting an accurate sentence is not this plan's concern.

## Deviations from Plan

None — plan executed exactly as written. No production file, no `package.json` line, and no `.prettierignore` entry was touched, and the two remaining `tests/helpers/` modules were not moved.

## Issues Encountered

1. **One plan fact was imprecise and is corrected here.** Task 1's action says "Both files open with a path header comment naming the old location. Update each to its new path." Measured: only `source-scan.test.ts` has such a comment (line 1). `source-scan.ts` opens with a JSDoc block and has no path header; it named its old directory in **prose** at two places instead — the sibling sentence and the `REPO_ROOT` doc comment — which is what the preceding bullet in the same action describes. Both sites were corrected, so the instruction's intent is satisfied; the header-comment count was one, not two. Research (`117-RESEARCH.md`) carries the same imprecision.

2. **`git add` aborts the whole invocation on a pathspec that no longer exists.** Staging was first attempted with all nine of task 1's paths, including the two `tests/helpers/` originals. `git mv` had already staged their deletion, so those pathspecs matched nothing and `git add` exited with `fatal: pathspec ... did not match any files` **having staged none of the other seven** — and the rename summary then read a misleading 100%, because it was measuring the pure `git mv` with the edits still unstaged. Re-running with only the seven existing paths staged correctly and the summary dropped to the real 96%. Worth knowing: after a `git mv`, the destination path is the only one to name.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `tests/helpers/` holds `marketplace-seed.ts` and `notification-boundary.ts`. 117-03 (the boundary helper, 26 consumers) and 117-07 (the marketplace seed, plus the directory close-out and the `helpers` token in the two `package.json` globs) inherit a directory with nothing else in it.
- The move-and-rewrite mechanic is proved on a 5-consumer and a 2-consumer module before it is applied to the 26-consumer one, which is why these went first.
- The correspondence gate's remaining 7 violations are untouched and are 117-04's and the entry-pair plans' work. None of them is new.
- `package.json` is unchanged, so the 117-01 glob-completeness control is still green and 117-08 still inherits the free RED it was given.
- No blockers.

## Self-Check: PASSED

- `tests/architecture/source-scan.ts`, `tests/architecture/source-scan.test.ts` and `tests/integration/ipc-child.ts` all exist on disk; `tests/helpers/source-scan.ts`, `tests/helpers/source-scan.test.ts` and `tests/helpers/ipc-child.ts` do not.
- Commits `d2287d5e` and `263b9c26` are present in `git log`, each carrying its rename line in `git log -1 --stat`.
- `git log --follow` reaches the pre-move history for all three moved files.
- Both `<verify>` chains were run link by link, each exit code read directly.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
