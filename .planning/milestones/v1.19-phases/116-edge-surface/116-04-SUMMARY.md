---
phase: 116-edge-surface
plan: "04"
subsystem: edge
tags: [unit-test, pair-contract, completions, normalize, comparison-form, mod-09]
status: complete
requires:
  - "116-00 notification boundary (not consumed: both exports are pure and take no Pi context)"
provides:
  - "Sole mirrored direct owner for edge/completions/normalize.ts at 100 percent functions, lines, and branches"
  - "The phase's stated candidate-matching comparison form: raw UTF-16 code units, no case folding, no Unicode normalization"
affects:
  - "No production file changed. tests/helpers/notification-boundary.ts unchanged."
tech-stack:
  added: []
  patterns:
    - "G1 pure-function owner: three import statements, a flat sequence of test() bodies, no describe(), no fixture, no context"
    - "Row tables carry the promised outcome as a row field (recognized: boolean); the loop body has no conditional"
    - "Copy-not-alias proof: mutate the returned array, then compare the caller's array against a second hand-authored literal"
key-files:
  created: []
  modified:
    - tests/edge/completions/normalize.test.ts
key-decisions:
  - "The comparison form is stated in the file header and proven by three reject rows: two case variants and one NFKC-equivalent fullwidth character"
  - "The plan predicted the while-to-if plant would redden both the three-space and the four-space row. It reddened only the four-space row. Recorded as a finding and the claim narrowed rather than papered over"
  - "Two plants beyond the two the plan named were run, on the out-of-range fallback and on the array copy, because both proofs are non-obvious"
  - "No exhaustiveness plant was attempted: normalize.ts has no switch and no closed-union dispatch, so there is no missing-arm target here"
requirements-completed: [MOD-09]
coverage:
  - deliverable: "tests/edge/completions/normalize.test.ts owns every branch of edge/completions/normalize.ts"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/completions/normalize.ts"
        status: pass
  - deliverable: "The collision-suffix accept rows are proven discriminating by a planted violation"
    human_judgment: false
    verification:
      - kind: command
        ref: "plant 1 applied to normalize.ts:23, confirmed RED, reverted"
        status: pass
  - deliverable: "The space-run loop is proven to iterate more than once"
    human_judgment: false
    verification:
      - kind: command
        ref: "plant 2 applied to normalize.ts:37, confirmed RED on the four-space row, reverted"
        status: pass
  - deliverable: "The out-of-range cursor-line fallback and the array copy are proven discriminating"
    human_judgment: false
    verification:
      - kind: command
        ref: "plants 3 and 4 applied to normalize.ts:31 and :30, both confirmed RED, reverted"
        status: pass
  - deliverable: "The comparison form is stated explicitly and proven"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/normalize.test.ts reject rows for /CLAUDE:PLUGIN, /Claude:Plugin, and /claude:\\uFF50lugin"
        status: pass
metrics:
  duration: "25 min"
  completed: 2026-09-02
actuals:
  tokens: 2600
  tasks: 1
  commits: 2
---

# Phase 116 Plan 04: Completion Normalize Owner Summary

`tests/edge/completions/normalize.test.ts` is now the sole mirrored owner of
`edge/completions/normalize.ts`, at 100 percent functions, lines, and branches when run alone, and
it states the comparison form the recogniser uses instead of leaving it implied.

## What was built

One rewritten test file, 22 runtime cases from 6 marked case bodies, in the G1 flat shape copied
from `tests/orchestrators/import/refs.test.ts`. No `describe()`, no fixture, no context, no helper.

`normalizeCompletionWhitespace` (5 bodies, 11 runtime cases):

| Body | Rows | What it pins |
|------|------|--------------|
| collapse | 2, 3, 4 spaces | a run of any length at the cursor collapses to exactly one space, and `cursorLine` / `cursorCol` come back unchanged |
| no-op | 4 rows | left char not a space; char at cursor not a space; cursor past the last character; cursor at column zero |
| out-of-range cursor line | 1 case | `cursorLine: 3` against a one-line array returns the input lines unchanged |
| other lines untouched | 1 case | a three-line input where the two non-cursor lines keep their own doubled spaces |
| fresh array | collapse path, no-op path | the returned array is a copy on both paths |

`isClaudePluginCommandLine` (1 body, 11 runtime cases): 4 accept rows (bare, with arguments, bare
collision suffix, collision suffix with arguments) and 7 reject rows.

Every result is compared as one whole value with `assert.deepStrictEqual`, against a literal
written out by hand. No expectation is produced by calling the code under test.

## The comparison form (the phase's encoding claim)

Read out of the source, not assumed. `isClaudePluginCommandLine` is one call:

```ts
const CLAUDE_PLUGIN_LINE = /^\/claude:plugin(?::\d+)?(?:\s|$)/;
return CLAUDE_PLUGIN_LINE.test(line);
```

The candidate is the caller's raw line. The pattern carries **no `i` flag**, and the module calls
**no case-mapping function and no `String.prototype.normalize`**. The comparison is therefore over
raw UTF-16 code units: **no case folding, and no Unicode normalization of any form.**

Both halves are proven by reject rows that differ from an accept row only in the named form:

| Accept row | Reject row that differs only in the stated form | Proves |
|------------|-------------------------------------------------|--------|
| `/claude:plugin` | `/CLAUDE:PLUGIN` | no case folding |
| `/claude:plugin install foo@bar` | `/Claude:Plugin install foo@bar` | no case folding |
| `/claude:plugin install foo@bar` | `/claude:<U+FF50>lugin install foo@bar` | no Unicode normalization |

The third row is the honest form of the normalization half. `U+FF50 FULLWIDTH LATIN SMALL LETTER P`
has the compatibility decomposition `p`, so `NFKC("/claude:<U+FF50>lugin install foo@bar")` is exactly
the accepted line; the recogniser still rejects it, which is only possible if no normalization is
applied. A canonical (NFC vs NFD) pair cannot be constructed here: every character of
`/claude:plugin` is ASCII with no canonical decomposition, so the NFC and NFD forms of any accepted
line are the identical string and the difference is unobservable. Compatibility form is the only
normalization difference this input surface can express, and the reject row shows it is not
applied.

## Plants (D-116-04)

Four plants run, each applied to production, run, and reverted with
`git checkout -- extensions/pi-claude-marketplace/edge/completions/normalize.ts`. `git diff --quiet`
confirmed a clean revert after each. Working tree shows no change under `extensions/`.

### Plant 1 — drop the collision-suffix group (`normalize.ts:23`)

`/^\/claude:plugin(?::\d+)?(?:\s|$)/` to `/^\/claude:plugin(?:\s|$)/`. **RED, 2 of 22 failing.**

```
test at tests/edge/completions/normalize.test.ts:190:3
✖ isClaudePluginCommandLine accepts the bare collision-suffix form (1.635745ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  false !== true

    actual: false,
    expected: true,
    operator: 'strictEqual',
```

The second failure is `accepts the collision-suffix form followed by arguments`, identical shape.

### Plant 2 — collapse the space-run loop to a single `if` (`normalize.ts:37`)

`while (line[result.cursorCol + n] === " ")` to `if (...)`. **RED, 1 of 22 failing.**

```
test at tests/edge/completions/normalize.test.ts:22:3
✖ normalizeCompletionWhitespace collapses a run of 4 spaces at the cursor to one (2.396426ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      cursorCol: 5,
      cursorLine: 0,
      lines: [
  +     'list  --installed'
  -     'list --installed'
      ]
    }
```

**Finding — the plan's prediction was wrong and is corrected here.** The plan expected this plant to
redden the three-space row as well. It did not: the three-space row stayed GREEN.

With a three-space run and the cursor between the first and second space, `while` and a single `if`
both settle on `n = 2` — the loop's guard fails on its second evaluation, so the loop body runs
exactly once and a single `if` reproduces it. Only a run of four or more spaces forces a second
iteration and therefore discriminates the two forms.

The response was to add the discriminating input, not to weaken the claim. The four-space row was
already in the matrix and carries the loop-iterates-more-than-once claim on its own. The three-space
row is kept for a different, still-falsifiable reason: it is the minimum input that enters the loop
body at all (`normalize.ts:38-39`, the two lines uncovered at HEAD), and it fails against other
wrong implementations such as `n += 2`. The claim recorded for the pair is narrowed accordingly:
**the four-space row is what proves the loop is a loop.**

### Plant 3 — drop the out-of-range cursor-line fallback (`normalize.ts:31`)

`lines[result.cursorLine] ?? ""` to `lines[result.cursorLine] as string`. **RED, 1 of 22 failing.**

```
test at tests/edge/completions/normalize.test.ts:76:1
✖ normalizeCompletionWhitespace is a no-op when the cursor line is outside the lines array (0.501007ms)
  TypeError: Cannot read properties of undefined (reading '4')
      at normalizeCompletionWhitespace (.../edge/completions/normalize.ts:32:11)
```

Not named by the plan; run because the proof is non-obvious. It also confirms the case reaches the
`??` right-hand branch rather than passing for an unrelated reason.

### Plant 4 — return the caller's array instead of a copy (`normalize.ts:30`)

`const lines = [...result.lines]` to `const lines = result.lines as string[]`. **RED, 2 of 22
failing.**

```
test at tests/edge/completions/normalize.test.ts:114:3
✖ normalizeCompletionWhitespace returns a fresh lines array when it collapses a space run (2.255681ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
  +   'overwritten through the returned array'
  -   'list  --installed'
    ]
```

The second failure is the no-op-path row, identical shape. This is the T-116-04-A mitigation: the
wrapper cannot write through to the caller's array on either path.

## Coverage

Measured with the pair's owner alone, before and after.

| | Before | After |
|-|--------|-------|
| branches | 6/8 | **9/9** |
| lines | 45/47 | **47/47** |
| functions | 2/2 | **2/2** |
| uncovered lines | 38-39 | none |

```
Direct coverage passed: extensions/pi-claude-marketplace/edge/completions/normalize.ts (branches 9/9, functions 2/2, lines 47/47)
```

The branch **denominator** rose from 8 to 9 while the shortfall closed. This is the carried-forward
V8 behavior, not a regression and not a source change: V8 emits a branch range only when its count
diverges from the enclosing block, so covering a guard arm the old suite never took adds a range to
both sides of the fraction. No absolute branch pair is pinned anywhere in this pair.

The two branches uncovered at HEAD are both reachable through the exports, exactly as the plan
predicted, so no coverage exception and no production change were needed.

## Exhaustiveness

This pair carries **no exhaustiveness claim**. `edge/completions/normalize.ts` contains no `switch`
and no closed-union dispatch, so a missing-arm plant has no target here. Recorded as an explicit
absence rather than substituted with a case that would prove nothing.

## Facts left to their gates (D-116-12)

Not written as cases, because a gate already owns each:

| Fact | Gate that owns it |
|------|-------------------|
| no `process.stdout` / `process.stderr` / `console.*` writes | `eslint.config.js` BLOCK A plus `.fallowrc.json` `boundaries.calls.forbidden` |
| per-verb flag catalog contents and completion labels | `tests/architecture/flag-catalog-drift.test.ts` |
| the module has exactly two exports and neither is dead | `fallow dead-code` `unused-export` |
| the argument object's member types | the TypeScript compiler at every call site |

## Deviations from Plan

**1. [Finding, not a rule deviation] The plan's plant-2 prediction was corrected.**

- **Found during:** Task 1, plant 2.
- **Issue:** The plan states the `while`-to-`if` plant reddens "the three-space and four-space rows".
  Only the four-space row went RED.
- **Response:** The discriminating input was already present, so nothing was added and nothing was
  weakened. The claim is narrowed in this summary and the arithmetic is recorded above.
- **Files modified:** none beyond the plan's own file.

**2. [Rule 2 - missing critical proof] Two plants beyond the two the plan named.**

- **Found during:** Task 1.
- **Issue:** The out-of-range fallback and the copy-not-alias proof are both non-obvious, and
  D-116-04 requires a plant for every non-obvious proof, not only for the ones a plan enumerates.
- **Fix:** Plants 3 and 4 above. Both RED, both reverted.
- **Files modified:** none (production reverted).

Everything else executed as written.

## Verification

Each gate run separately with its exit code checked. `npm run check` was **not** used: its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests, so a green result there would mean nothing.

| Gate | Exit | Result |
|------|------|--------|
| `node --test tests/edge/completions/normalize.test.ts` | 0 | 22 pass, 0 fail |
| `npm run test:coverage:direct -- .../normalize.ts` | 0 | branches 9/9, functions 2/2, lines 47/47 |
| `npm run typecheck` | 0 | clean |
| `npm exec -- eslint tests/edge/completions/normalize.test.ts` | 0 | clean |
| `npm run lint` (whole repo) | 0 | clean |
| `npm exec -- prettier --check tests/edge/completions/normalize.test.ts` | 0 | clean |
| `npm run fallow` | 0 | clean (the `✗` summary lines print on success; the exit code is what was read) |
| `npm test` | 0 | 4861 pass, 0 fail, 274 suites |
| `npm run test:integration` | 0 | 31 pass, 0 fail |
| anti-pattern `rg` scan | 1 (no matches) | no `only` / `skip` / `todo`, no coverage pragma, no double assertion, no wildcard matcher, no module replacement, no capitalized phase markers |
| `rg -c '^\s+// arrange$'` | 0 | 6 markers, equal to the 6 case bodies |
| `git diff --check` | 0 | no whitespace damage |
| `git diff --quiet` over the 5 pinned production files plus the boundary helper | 0 | unchanged |
| trufflehog `filesystem` scan | 0 | chunks 1, bytes 5921, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files ...` | 0 | all applicable hooks passed |

The whole unit suite stands at 4861 passing across 274 suites. This file contributes 22 of them,
up from the 10 it replaced, so the suite total rose by exactly 12 and nothing else moved.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change. The plan's three
threat rows are all mitigated: T-116-04-A by the no-op matrix, the fresh-array rows, and the
contains-but-does-not-start-with reject row; T-116-04-B by the re-measured direct coverage above;
T-116-04-C by the `git diff --quiet` pin, which passed.

## Self-Check: PASSED

- `tests/edge/completions/normalize.test.ts` exists on disk.
- `.planning/phases/116-edge-surface/116-04-SUMMARY.md` exists on disk.
- Commit `1981394a` is present in `git log`.
- `git diff --quiet` over the five pinned production files and the shared boundary helper exits 0.
