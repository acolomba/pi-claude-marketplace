---
phase: 260912-fp2
plan: 01
subsystem: documentation
tags: [output-catalog, testing-doc, windows-ledger, auth-03, auth-09, strong-mock]
status: complete

# Dependency graph
requires:
  - phase: 09-final-quality-and-backlog-closure
    provides: WINDOWS.md ledger entries 24, 25 and 29 naming three stale documentation references
provides:
  - The AUTH-03 byte-form lock reference in docs/output-catalog.md resolves on disk
  - TESTING.md names no tests/helpers path and no retired test-double symbol
  - Evidence for sibling item 260912-fp3 to dispose WINDOWS entries 24 and 25 as fixed by edit
  - Evidence for 260912-fp3 to dispose WINDOWS entry 29 as fixed with NO edit, citing a64d00a4
affects: [260912-fp3, windows-ledger-disposition]

actuals:
  tokens: 4936
  tasks: 3
  commits: 2
plan_head_before: 2673a589f84988d743cde5049a072665bb9c4bae

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A doc that is @-included from CLAUDE.md is verified by resolving every path it names against the filesystem, not by reading it for plausibility"
    - "A ledger entry is checked against the document AND against git log before it is treated as a defect; an entry can go stale by being fixed incidentally"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - .planning/codebase/TESTING.md

key-decisions:
  - "Entry 29 was closed with no edit: CONVENTIONS.md line 165 already reads correctly, and a64d00a4 is the commit that made it so six days after the entry was recorded"
  - "The AUTH-03 repoint changed exactly one token; the AUTH-09 no-token-interpolatable guarantee in the same paragraph is byte-identical, proved by word-diff"
  - "Two facts the plan supplied as established were re-measured and found overstated, and the accurate version was written instead of the supplied one"
  - "The npm run check chain was corrected inside the same code fence as the test glob rather than left knowingly false three lines below a rewritten line"

patterns-established:
  - "Where a plan supplies a measured fact to transcribe, the fact is still re-measured before it is written into a session-loaded doc; transcribing an overstated fact converts detected drift into undetected drift"

requirements-completed: [WINDOW-24, WINDOW-25, WINDOW-29]
---

# Quick Item 260912-fp2: Correct Three Stale Documentation References Summary

Closed two real documentation defects with verified edits and closed the third by declining to
edit it, because the document was already right and the ledger row was the stale artifact.

## The three dispositions

These are deliberately kept distinct. Flattening them into "three files corrected" would be
false, and item `260912-fp3` needs the distinction to dispose entry 29 with a truthful reason.

| entry | file | disposition |
| ----- | ---- | ----------- |
| 24 | `docs/output-catalog.md` | **FIXED BY EDIT** — one-token repoint, commit `c10cf7f3` |
| 25 | `.planning/codebase/TESTING.md` | **FIXED BY EDIT**, and the ledger under-described it — commit `beacfe7a` |
| 29 | `.planning/codebase/CONVENTIONS.md` | **FIXED, NO EDIT — the ledger was stale, not the document** |

## Accomplishments

- **Entry 24 — the AUTH-03 byte-form lock.** The catalog named
  `tests/shared/device-flow-prompt.test.ts` as the lock on the device-flow prompt emission
  string. That suite is absent from both `git ls-files` and the working tree, confirmed before
  editing. The lock now lives in `tests/domain/github-auth.test.ts`, in the test
  `"emits the documented AUTH-03 prompt before any token is acquired"`, which asserts the exact
  string `Open https://github.com/login/device and enter: ABCD-1234`. That test's own comment
  already cited this catalog entry by its `catalog-state: device-flow-prompt` marker, so the
  lockstep pair held in only one direction; the repoint restores it in both.
- **The AUTH-09 guarantee survived byte-identical.** The repoint sits in the same paragraph as
  the contract sentence stating that `access_token` / `accessToken` / `cred.password` are not
  interpolatable into the message. A `--word-diff` over the commit shows exactly two word
  tokens changed — the old path out, the new path in — and nothing else in the paragraph moved.
  No reflow, no re-punctuation.
- **Entry 25 was real and wider than a path swap.** `tests/helpers/` does not exist. Only two
  of the four modules the ledger called "pre-move" actually moved
  (`marketplace-seed.ts` → `tests/edge/handlers/marketplace-seed.ts`,
  `source-scan.ts` → `tests/architecture/source-scan.ts`). The other two, `credential-mock.ts`
  and `git-mock.ts`, were **retired outright**, along with `MockCredentialState`, the
  `makeMock*` factory naming and the `*Throws?: Error` injection fields — all of which return
  zero hits repo-wide.
- **The Mocking section's framework claim was false in both halves.** It asserted no mocking
  library and all-hand-written doubles. Both are now wrong: `strong-mock@^9.2.2` is a
  devDependency imported by 31 test files, and the doubles that remain hand-written are
  concern-owned `*-fake.ts` ports, each paired with a `*-contract.ts` case set whose
  `register*Contract(factory)` is called twice — once with the production implementation, once
  with the fake. The four pairs are now tabulated with the suite that runs each against
  production.
- **Counts and the directory listing were re-measured, not carried over.** 303 total
  `.test.ts` files, 284 under the `npm test` glob, 13 integration, 6 e2e. 284 + 13 + 6 = 303,
  so the partition is complete and the summary line says so. The listing drops `helpers/` and
  gains `scripts/` and the top-level `index.test.ts`, matching the live children of `tests/`.
- **Entry 29 was confirmed correct and left alone.** See the dedicated section below.

## Two facts the plan supplied as established, re-measured and corrected

The plan's `<context>` said to treat its measurements as established and not re-derive them.
Two did not survive measurement. Writing either as supplied would have put a fresh false
statement into a file that loads into every session — the exact failure class this item exists
to repair — so the accurate version was written instead.

1. **`withHermeticHome` is not a shared exported helper.** The plan described it as "exported
   from `tests/orchestrators/plugin/update-flow.test.ts:352` and imported by sibling suites"
   (plural). Measured: **13 local definitions**, of which exactly **one** is exported
   (`update-flow.test.ts:352`) and exactly **one** file imports it
   (`update-swap.test.ts:21`). The real shared support module is
   `tests/platform/hermetic-environment.ts`, which the per-suite wrappers delegate to. The doc
   now names that module and records the per-suite duplication rather than implying one shared
   helper. The load-bearing point the plan wanted preserved is preserved and strengthened: it
   `mkdtemp`s a real root and repoints `HOME`/`PI_CODING_AGENT_DIR` at real directories, so it
   relocates the filesystem rather than faking one, and the never-mock-the-filesystem rule
   still holds.
2. **The fakes are no longer unconditionally pure in-memory.** The plan instructed that the
   old text's "no filesystem, no env mutation, no subprocess" discipline "still holds" and
   should be kept. It no longer holds unconditionally: `git-ops-fake.ts` accepts
   `cloneFixture: { boundary: "local" }` and copies a real directory with `cp`, and
   `removal-ops-fake.ts` accepts `boundary: "delegate"` with a real collaborator. What is
   actually true — and stronger — is that the boundary is **declared in the options bag and
   enforced at runtime by a throw**, `"memory"` is the default, and every escape from it is a
   separately-named opt-in. That is what the doc now says. The second discipline the plan named
   (production contracts imported with `import type` only) was verified and kept.

## Entry 29: ledger-stale, no edit

`.planning/codebase/CONVENTIONS.md` was **not modified** and is absent from this item's diff.

Confirmed against the tree at hand:

- `extensions/pi-claude-marketplace/bridges/index.ts` — absent
- `extensions/pi-claude-marketplace/bridges/*/index.ts` — exactly 5 present
- `grep -c 'bridges/index' .planning/codebase/CONVENTIONS.md` — exactly **1** hit, and that
  single hit is line 165 naming the aggregate barrel only in order to say it was removed:
  "The aggregate `bridges/index.ts` … were all removed as unreachable from the extension entry
  point." The document is correct and agrees with the tree.

The correcting commit, verified directly rather than taken on trust:

- `a64d00a4` — `docs(06): repoint architecture docs at post-split owners`, **2026-09-09**,
  touched `.planning/codebase/CONVENTIONS.md` (7 insertions, 7 deletions).
- `git show a64d00a4^:.planning/codebase/CONVENTIONS.md` still carries the wording entry 29
  quotes, verbatim: *"Barrels exist per bridge kind (`bridges/<kind>/index.ts`, plus the
  aggregate `bridges/index.ts`)"*. `a64d00a4` replaced exactly that clause.
- Entry 29 was recorded **2026-09-03**. It was accurate when written and was fixed six days
  later as a side effect of an unrelated docs pass, which is why it reads as a false alarm now.

**A negative grep for `bridges/index.ts` against this file would be a false alarm** — the path
is supposed to appear there, once, in a sentence that says it is gone.

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Repoint the AUTH-03 byte-form lock in the output catalog | `c10cf7f3` |
| 2 | Rewrite the TESTING.md passages naming tests/helpers or a retired double | `beacfe7a` |
| 3 | Record entry 29 as ledger-stale — confirm, make no edit | no source diff by design |

Task 1 was a tracer task. Its verify was re-run end-to-end on the committed tree before Task 2
began, per the tracer feedback gate, and passed unchanged.

## Gate Readings (measured)

| Gate | Reading |
| ---- | ------- |
| Five catalog gates + `tests/domain/github-auth.test.ts`, **pre-edit baseline** | **129 pass / 0 fail** (2.06s) |
| Same six suites, **post-edit** | **129 pass / 0 fail** (2.03s) |
| Same six suites, **tracer gate re-run on committed tree** | **129 pass / 0 fail**, exit 0 |
| `grep -c 'device-flow-prompt.test.ts' docs/output-catalog.md` | 1 → **0** |
| `grep -c 'tests/domain/github-auth.test.ts' docs/output-catalog.md` | 0 → **1** |
| `grep -c 'are NOT interpolatable into this message'` | **1** before and after |
| Word tokens changed in the catalog commit | **2** (one path out, one in); 1 line, 1 insertion, 1 deletion |
| `grep -c 'tests/helpers' .planning/codebase/TESTING.md` | 10 hits → **0** |
| Retired double symbols in TESTING.md (`credential-mock`, `git-mock`, `MockCredentialState`, `makeMock*`, `Throws?: Error`) | **0** |
| `grep -c 'strong-mock' .planning/codebase/TESTING.md` | **4** |
| `grep -c 'test:corresponding' .planning/codebase/TESTING.md` | **1** |
| Every `tests/…` path named in TESTING.md resolves on disk | **PASS** — 5 were missing before (all under `tests/helpers/`), 0 after |
| `node --test tests/architecture/partial-vocabulary-guard.test.ts` (D-75-01) | **58 pass / 0 fail** |
| Files in this item's diff | **exactly 2** — `docs/output-catalog.md`, `.planning/codebase/TESTING.md` |
| `.planning/codebase/CONVENTIONS.md` in diff | **absent**, as required |
| `.planning/WINDOWS.md` | unmodified |
| Commit subjects | Conventional Commits, 59 and 64 chars; longest body lines 74 and 75; no phase or milestone reference |
| File deletions in either commit | **0** |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — False statement avoided] Two supplied "established" facts were overstated.**

- **Found during:** Task 2
- **Issue:** The plan's `<context>` instructed that `withHermeticHome` is exported and imported
  by sibling suites, and that the fakes' unconditional in-memory purity "still holds". Both
  overstate the tree.
- **Fix:** Measured both, then wrote the accurate version — the real shared module is
  `tests/platform/hermetic-environment.ts` with 13 per-suite wrappers and a single importer;
  the purity discipline is a runtime-enforced default boundary with two named opt-outs.
- **Rationale:** The plan's own threat `T-fp2-05` forbids replacing a known-stale statement
  with an unverified one. Transcribing these as supplied would have satisfied the letter of the
  instruction while recreating the drift class in a file loaded into every session.
- **Commit:** `beacfe7a`

**2. [Rule 1 — Self-corrected before commit] A first-draft directory comment was wrong.**

- **Found during:** Task 2
- **Issue:** The new `scripts/` row in the directory listing initially read
  "e.g. `scripts/revalidation.mjs`". `tests/scripts/` actually holds one suite,
  `check-phase-06-hub-ledger.test.ts`, targeting `scripts/check-phase-06-hub-ledger.mjs`;
  `revalidation.test.ts` lives under `tests/architecture/`.
- **Fix:** Replaced with a generic accurate description ("tests for the repo's own .mjs tooling
  under `scripts/`"), which also avoids planting a phase-numbered filename in prose.
- **Commit:** `beacfe7a` (corrected before staging; never committed wrong)

### Planned, disclosed scope addition

**3. Same-fence `npm run check` chain correction.** The plan authorised and required this. The
quoted chain was four members short of the live script, missing `test:corresponding`,
`test:corresponding:negative` and `test:coverage:direct:negative`. It sits three lines below a
line being rewritten inside the same code fence. Corrected and disclosed in the commit body.

## Follow-ups Routed Here (out of scope, NOT fixed)

1. **`tests/fixtures/bad-imports/` no longer exists.** `.planning/codebase/TESTING.md` still
   names it in the static-fixtures bullet, alongside `tests/fixtures/import-command/` (which
   does exist). Confirmed absent on disk. It is not a `tests/helpers` passage and not part of
   ledger entry 25, so fixing it would have widened this item past its approved disposition.
   Note that the path carries no file extension, so the path-resolution gate used here does not
   catch it — a future sweep needs a directory-aware check, not the same regex.
2. **Both ledger entries record line numbers that no longer locate their passages.** Entry 24
   records line 2729 for the catalog paragraph, which now sits at line 3015. Entry 29 records
   line 151 for the CONVENTIONS barrels sentence, which now sits at line 165. Every passage in
   this item was therefore located **by content, not by line number**. Line numbers in a ledger
   that outlives several edits to the same file are a liability; content anchors are not.

## Pre-commit Notes

`pre-commit run --files` was run before each commit and every applicable hook passed. No hook
rewrote either file, so no follow-up commit was needed —
`git status --porcelain` was empty for each file immediately after its commit.

- `docs/output-catalog.md` — `mdformat` and `markdownlint-cli2` both **Passed**. They apply to
  `docs/**`, so this was the file at genuine formatting risk.
- `.planning/codebase/TESTING.md` — `mdformat`, `markdownlint-cli2` and the smartquote / dash /
  ligature fixers did not run at all: `.planning/**` is excluded from them in
  `.pre-commit-config.yaml`. Expected, and the reason the new markdown table in the Mocking
  section needed no reflow.
- `trufflehog` was skipped via `SKIP=trufflehog` on both commits. It cannot run in this linked
  worktree — it reads `<root>/.git/index`, and `.git` here is a file, not a directory. CLAUDE.md
  sanctions the skip for worktree commits.
- `npm-format-check` was **not** skipped and did not need to be: it reported
  `(no files to check)` for both paths, so the known coordinator-owned `BATCH.json` warning
  never arose. `BATCH.json` was not written or reformatted.
- `prettier` was never run against either markdown file.

`npm run check` was deliberately not run; the batch coordinator runs the suite once after every
item lands.

## Known Stubs

None.

## Threat Flags

None. No code path, network call, credential handler or package install was introduced — both
commits are documentation-only.

## Self-Check: PASSED

- `docs/output-catalog.md` — FOUND
- `.planning/codebase/TESTING.md` — FOUND
- `.planning/quick/260912-fp2-correct-three-stale-documentation-refere/260912-fp2-SUMMARY.md` — FOUND
- Commit `c10cf7f3` — FOUND in `git log`
- Commit `beacfe7a` — FOUND in `git log`
- `git rev-list --count 2673a589..HEAD` — **2**, matching the two task commits recorded above
