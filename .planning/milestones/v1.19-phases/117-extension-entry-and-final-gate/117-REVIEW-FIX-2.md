---
phase: 117-extension-entry-and-final-gate
fixed_at: 2026-09-04T01:20:00Z
review_path: .planning/phases/117-extension-entry-and-final-gate/117-REVIEW-2.md
iteration: 3
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 117: Code Review Fix Report (iteration 3)

**Fixed at:** 2026-09-04T01:20:00Z
**Source review:** `.planning/phases/117-extension-entry-and-final-gate/117-REVIEW-2.md`
**Iteration:** 3 (final)

**Summary:**

- Findings in scope: 5 (WR-01 through WR-05)
- Fixed: 4 (WR-01, WR-02, WR-03, WR-04)
- Skipped: 1 (WR-05 — barred by D-117-20; recorded, with the cost of reversing
  that decision measured)
- Info findings IN-01 through IN-04: out of scope, untouched

Every behavioural fix was proved by planting the fault, watching it go RED,
reverting, and watching it go GREEN. The verbatim output of each plant is below.
`extensions/` is unchanged: `git diff --quiet 562f5d13 HEAD -- extensions/`
exits 0 across the whole phase including these five commits.

## Fixed Issues

### WR-01: `npm run lint` and `format:check` read `scripts/`, but their pre-commit hooks could not see it

**Files modified:** `.pre-commit-config.yaml`
**Commit:** `131ef069`

**Applied fix:** `scripts/.*\.mjs` added to the `files:` patterns of `npm-lint`
and `npm-format-check`, and the block comment's two stale quotes replaced with
the current script bodies.

**Beyond the review, and measured rather than assumed.** The review named two
hooks. A third, `npm-fallow`, was stale for the same reason: fallow reads
`scripts/*.mjs`, so an edit there moves its verdict too. Measured before the fix
— an unused export planted in `scripts/check-corresponding-tests.mjs` makes
`npm run fallow` exit 1 naming that file, while the hook on that file alone
reported:

```
npm fallow...........................................(no files to check)Skipped
rc=0
```

`npm-typecheck` was deliberately left alone and the comment now says why:
`tsconfig.json`'s `include` does not reach `scripts/`, so no edit there can move
`tsc --noEmit`.

**Plants (all three, each run on the scripts file alone, after the fix):**

```
PLANT A: unused binding
npm lint.................................................................Failed
  216:7  error  'plantedUnusedBinding' is assigned a value but never used

PLANT B: misformatted statement
npm format check.........................................................Failed
  [warn] scripts/check-corresponding-tests.mjs

PLANT C: unused export
npm fallow...............................................................Failed
  scripts/check-corresponding-tests.mjs
    :216 plantedUnusedExport
```

All three previously reported `(no files to check)Skipped` at rc 0.

______________________________________________________________________

### WR-02: the ESLint block's comment claimed more coverage than the block delivered

**Files modified:** `eslint.config.js`
**Commit:** `8bfcab38`

**Applied fix:** the review offered two shapes — correct the sentence, or make
the sentence true. The second turned out to be free, so it was taken.

Measured first: with the rules added and nothing else changed,
`npx eslint scripts` exits 0. The gate scripts already satisfy the entire
non-type-aware subset, so **no line of either script changed**. The block now
declares `@stylistic`, `import-x` and `sonarjs`, and restates `curly`,
`no-console`, `prefer-object-has-own`, `import-x/order`,
`padding-line-between-statements`, `no-empty-function`, the four `sonarjs`
rules, and the `^_` ignore pattern on `no-unused-vars`.

`explicit-module-boundary-types` was deliberately left off — a return-type
annotation is not valid JavaScript — and the comment says so, alongside the
reason not to widen the base block's glob into the type service. The fallow
constraint recorded in that comment was true and is untouched.

**Plants:**

```
BEFORE (the finding): braceless `if` + console.log appended to a gate script
  npx eslint scripts/check-corresponding-tests.mjs → rc=0, no output

AFTER: the same two statements
  216:23  error    Expected { after 'if' condition  curly
  216:23  warning  Unexpected console statement     no-console
  rc=1

AFTER: a misplaced builtin import, to prove the plugin rules are live and not
merely configured
  5:1  error  There should be at least one empty line between import groups  import-x/order
  6:1  error  `node:os` import should occur before import of `node:path`     import-x/order
  rc=1
```

`npm run lint` over the whole repository stays rc 0.

______________________________________________________________________

### WR-03: the hydrate refusal case could not tell its own stage from the next one

**Files modified:** `tests/index.test.ts`
**Commit:** `87efdd14`

**Applied fix:** both halves the review named.

The hydrate case now seeds a config the reconcile refuses (`seedInvalidConfig`)
and asserts the reconcile's own cascade was emitted. That is the observable the
reconcile does not share: retargeted at the reconcile read, the reconcile never
runs and the raw `reconcile aborted` line stands in place of the cascade.

A third case was added for the reconcile ordinal, which had none. It asserts the
one line only a refusal at that read produces, against an otherwise clean
workspace — so retargeted at either neighbouring read the refusal is swallowed in
silence and the case fails.

The doc comment on the ordinals now states the rule (each named ordinal has a
case, and each case asserts an observable only its own stage produces) and says
why the fourth read has none: resource aggregation is the one stage outside a
try, so refusing it is a throw out of the handler rather than an NFR-2
containment. Suite is 14 cases.

**Plants:**

```
CWD_READ_DEFERRED_HYDRATE = 2 (the reviewer's own experiment, 13 pass / 0 fail
before this fix):
✖ still answers when the deferred project-scope hydrate fails (NFR-2)
ℹ tests 14  ℹ pass 13  ℹ fail 1
  actual:   [ { message: 'reconcile aborted: working directory read 2 refused', severity: 'error' } ]
  expected: [ { message: 'Some operations have failed.\n\n⊘ claude-plugins.json [project] (failed) ...

CWD_READ_RECONCILE retargeted at each other ordinal:
  = 1   → ✖ still answers when the reconcile fails (NFR-2)   13 pass / 1 fail
  = 3   → ✖ still answers when the reconcile fails (NFR-2)   13 pass / 1 fail
  = 999 → ✖ still answers when the reconcile fails (NFR-2)   13 pass / 1 fail
```

Reverted: 14 pass / 0 fail.

______________________________________________________________________

### WR-04: the falsifiable half of the read-back was unreachable from every wired command

**Files modified:** `package.json`, `CONTRIBUTING.md`
**Commit:** `8f9324a3`

**Applied fix:** `test:coverage:direct:all` now passes
`--report coverage/all-pairs.jsonl`, so the wired command takes the read-back arm
rather than the arm the code's own comment says cannot fail. The script is
prefixed `mkdir -p coverage &&`, matching the existing `test:coverage` script,
because `coverage/` is not present in a clean checkout. `CONTRIBUTING.md` names
the report path.

**Plants** (two-module scaffold with one dropped `appendFileSync`, both arms run
unpiped through the npm script; scaffold and plant reverted):

```
ARM A (the now-wired form, --all --report):
  rc=1  Missing from the all-pair result: extensions/pi-claude-marketplace/shared/atomic-json.ts
        report rows actually written: 1

ARM B (the previously-wired form, --all only, SAME lost append):
  rc=0  All-pair run complete: 2 pairs in 1.1s on v26.8.1
        report rows actually written: 1
```

Arm B is the finding: a run reporting two pairs against a report holding one row.

**Limit of this fix, stated plainly.** The sweep still stops at the first
accepted D-116-01a shortfall, so on this tree the run never reaches the read-back
— the arm is now reachable *from the wired command* but not yet *on this tree*.
What the report path buys today is the retained partial result, which is exactly
what this phase had to build an external driver to obtain. The read-back engages
by itself once the seven shortfalls close, or if WR-05 is ever revisited. This is
the coupling between WR-04 and WR-05, and it is why WR-05's outcome below matters
to this finding too.

## Skipped Issues

### WR-05: the sweeps are documented as expected-to-fail, with nothing checking that a stop is ledgered

**File:** `CONTRIBUTING.md:44-54`; `scripts/test-coverage-direct.mjs:471-500`
**Reason:** the remedy the finding asks for is barred in terms by **D-117-20**,
an operator decision this phase already recorded.
**Original issue:** both sweeps stop at the first accepted shortfall, so a red
run does not distinguish a genuine new gap from a known one; and
`test:coverage:direct:negative` — the negative control *for* this gate — runs on
every CI job while the gate it controls runs nowhere.

**Why it was not applied.** `117-CONTEXT.md`'s amended D-117-20 says COV-05 is
met and is:

> **Not** resolved by a pragma, **not** by a ledger-keyed verdict (which would be
> D-116-01a's banned pragma wearing a different hat), and **not** by weakening
> the other 190. The gate is deliberately unchanged and still refuses a
> shortfall.

Deferred item 4 records the same operator decision, dated 2026-09-03, in the same
words. The reviewer's fix — "teach the script its own accepted-shortfall list" —
is precisely a ledger-keyed verdict. The reviewer did not have D-117-20 in view.

**Measured before deciding, then reverted unshipped.** Rather than argue the cost
of reversing that decision, the ledger-keyed form was built and driven, so the
operator can revisit D-117-20 against numbers:

- With the list in place, `npm run test:coverage:direct` ran **204 pairs at exit
  0** — 197 passed plus 7 `Accepted shortfall` lines, each naming its module,
  reading and ledger entry. The shipped gate stops at 20 pairs and exits 1.
- Both self-expiry refusals fired under a plant: a listed module that has become
  complete ("drop its entry ... and close ledger entry 99"), and an entry naming
  a module no longer in the tree.
- Accepting any incomplete reading for a listed module — a name-only ledger —
  was also planted and refused, so a shortfall that *widens* would still fail.
- All seven readings are identical on Node v22.22.2 and v26.8.1, so an exact
  counter pin is not runtime-fragile.
- Size: roughly 80 lines in the gate, 7 entries of data, 8 states in the
  negative control.

The whole change was reverted with `git checkout --`; nothing from it is in any
commit. `scripts/test-coverage-direct.mjs` and its negative control are
byte-identical to their pre-session state.

**What was done instead, within the decision.** The finding's minor point is
independently valid and needs no gate change: `CONTRIBUTING.md` is the
contributor-facing document and it pointed readers at `.planning/WINDOWS.md`, a
planning artifact subject to milestone archival. The sweeps section now names all
seven modules and their exact readings inline, and states that a stop on any
other module — or on one of these reporting different numbers — is a real
failure. A contributor can now tell an expected stop from a regression without
opening a planning artifact. The gate is untouched.

**Recorded, not dropped:** deferred item 6 in
`.planning/phases/117-extension-entry-and-final-gate/deferred-items.md`, and
broken-windows entry 30. Both carry the measurement above so the decision can be
revisited cheaply. Commit `fd7aad87`.

## Verification

All gates were run in the **main checkout** of `features/unit-test-refactor`
(`workflow.use_worktrees` is `false`, so no worktree was created — the numbers
below are reproducible from the tree you are reading). Each was run **unpiped**
with its own exit code read on its own, because `$status` is `$?` in this shell
and a piped gate reports the pipe's code.

| Gate | Result |
|---|---|
| `npm run typecheck` | rc 0 |
| `npm run lint` | rc 0 |
| `npm run fallow` | rc 0 |
| `npm run format:check` | **rc 1** — see below |
| `npm run test:corresponding` | rc 0 |
| `npm run test:corresponding:negative` | rc 0 |
| `npm run test:coverage:direct:negative` | rc 0 |
| `npm test` (PATH node v26.8.1) | rc 0 — 5144 tests / 295 suites / 0 fail |
| `npm test` (`/usr/bin/node` v22.22.2) | rc 0 — 5144 tests / 295 suites / 0 fail |
| `npm run test:integration` | rc 0 — 31 / 31 |
| `git diff --quiet 562f5d13 HEAD -- extensions/` | rc 0 |

5144 is the measured baseline of 5143 plus the one case WR-03 added, on both
interpreters.

`npm run format:check` exits 1 on eight files that are pre-existing, untracked
and unrelated to this phase: `.mcp.json` and seven
`.planning/research/.cache/*.json`. The failure list contains no file this
session touched, and those files were deliberately left alone. Because that link
short-circuits `npm run check`, every remaining link was run separately and read
on its own; all are rc 0.

Committing used the documented worktree route: this checkout is a linked git
worktree, so `trufflehog` fails structurally in git mode. Each commit's paths
were scanned with the filesystem route
(`--results=verified,unknown --fail`, clean at `verified_secrets: 0,
unverified_secrets: 0`) before `SKIP=trufflehog`. No other hook was skipped and
`--no-verify` was never used. Git hooks are not installed here, so
`pre-commit run --files <paths>` was invoked explicitly for every commit.

The working tree holds only the operator's own pre-existing modifications
(`.claude/settings.json`, `.codex/config.toml`) and untracked files; nothing from
this session is uncommitted.

## Notes for the reader

1. **WR-05 is the one thing that did not close, and it did not close because a
   recorded decision says it must not.** If the intent behind D-117-20 was to
   keep a *pass* from being granted by a list, note that what was measured grants
   nothing new: the seven are already accepted, and the list only changes whether
   the gate can keep going and whether an eighth would be distinguishable. That
   is the operator's call, not a fixer's.
2. **WR-04 is a half-measure until WR-05 moves.** The read-back is now reachable
   from the wired command but the sweep still stops before it. Stated in the
   WR-04 entry rather than hidden.
3. **WR-01 grew by one hook and WR-02 by a rule list**, both because the measured
   answer was larger than the reviewed one. Neither changed a line of the gate
   scripts themselves.
4. Info findings IN-01 through IN-04 were left untouched, as scoped. IN-01 (the
   dead `"no-restricted-syntax": "off"`) survives the WR-02 edit unchanged and is
   still dead for the reason its own comment gives.

______________________________________________________________________

*Fixed: 2026-09-04T01:20:00Z*
*Fixer: Claude (gsd-code-fixer)*
*Iteration: 3*
