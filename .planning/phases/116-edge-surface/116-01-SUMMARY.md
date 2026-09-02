---
phase: 116-edge-surface
plan: "01"
subsystem: edge
tags: [unit-test, pair-contract, args-schema, positional-validation, mod-09]
status: complete
requires:
  - "116-00 notification boundary (not consumed: this pair takes no Pi context)"
provides:
  - "Sole mirrored direct owner for edge/args-schema.ts, contract-compliant at 100 percent direct coverage"
affects: []
tech-stack:
  added: []
  patterns:
    - "G1 pure-function owner: three import statements, a flat sequence of test() bodies, no describe(), no fixture"
    - "An injected callback parameter is recorded by a plain closure over a string array and asserted as a whole array, not turned into an interaction mock"
    - "assert.deepStrictEqual discriminates an absent property from one set to undefined, so whole-value equality is enough to prove omission"
key-files:
  created: []
  modified:
    - tests/edge/args-schema.test.ts
key-decisions:
  - "The onError double stays a plain recorder closure asserted as a whole array; the module's promise is its return value, not the callback's call count"
  - "The tokenizer-failure cases declare a required positional the input satisfies, so an undefined result can only mean the early return fired"
  - "No exhaustiveness plant was attempted: args-schema.ts has no switch and no closed-union dispatch, so there is no missing-arm target here"
requirements-completed: [MOD-09]
coverage:
  - deliverable: "tests/edge/args-schema.test.ts owns every branch of edge/args-schema.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/args-schema.test.ts"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/args-schema.ts"
        status: pass
  - deliverable: "Every rejection branch is proven discriminating by a planted violation"
    human_judgment: false
    verification:
      - kind: command
        ref: "three plants applied to edge/args-schema.ts, each confirmed RED then reverted"
        status: pass
metrics:
  duration: "~25 min"
  completed: 2026-09-02
actuals:
  tokens: 3000
  tasks: 1
  commits: 3
---

# Phase 116 Plan 01: args-schema Owner Summary

`tests/edge/args-schema.test.ts` is rewritten as a flat pure-function owner: 11 marked case
bodies emitting 15 runtime cases, every expectation hand-authored, every result compared as one
whole value, and every rejection branch proven discriminating by a planted violation.

## What was built

The old suite was 88 lines, four cases, zero phase markers, and a `makeNotifyErrorSpy()` factory.
It asserted `result?.name` one property at a time, matched the tokenizer diagnostic with a regex,
and carried a case titled "compile-time check" whose body was three typed local variables.

The new suite copies the skeleton of `tests/orchestrators/import/refs.test.ts`: three import
statements, no `describe()`, no fixture, no context, no helper. `onError` is recorded by an
inline closure pushing into a `usageErrors: string[]` and asserted as a whole array — it is the
module's own declared parameter, so no mock library is involved and no call count is asserted.

**The 11 case bodies, derived from the source rather than sampled:**

| Case body | Branch it reaches |
|-----------|-------------------|
| Two required positionals, no `--scope` | `parsed !== undefined`, required guard false, `parsed.scope === undefined` |
| `--scope project` before / between / after the positionals (3-row table) | `parsed.scope !== undefined`, position independence |
| Optional tail supplied | `value !== undefined && value.trim() !== ""` true |
| Optional tail absent | first operand false |
| Optional tail blank (`"   "`) | second operand false |
| Required positional absent | `value === undefined` short-circuit |
| Required positional blank | `value.trim() === ""` second operand |
| Empty vector / whitespace-only vector (2-row table) | required guard on an empty token list |
| Zero-positional schema, empty vector | loop body never entered, result `{}` |
| `--scope bogus` | `parseArgsOrNotify` catch, `parsed === undefined` early return |
| `--scope` trailing / `--scope ""` (2-row table) | tokenizer missing-value throw |

Direct coverage: **branches 17/17, functions 2/2, lines 96/96** — unchanged from HEAD, which was
the point. The debt this plan paid was contract shape, not reach, and an outcome-thin rewrite can
silently drop a branch the old suite covered incidentally. It did not.

Every diagnostic string is written out by hand in the assert, never read back off the schema
object the case constructed:

- `"Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]"`
- `"Usage: /claude:plugin marketplace remove <marketplace>"`
- `'Invalid --scope value: "bogus". Must be "user" or "project".'`
- `'--scope requires a value: "user" or "project".'`

The absent-optional case proves omission rather than `undefined` through whole-value equality
alone: `assert.deepStrictEqual({ a: 1 }, { a: 1, b: undefined })` throws, which was measured
before the case was written rather than assumed.

The tokenizer cases prove that no positional validation runs after a throw without observing an
internal call. Their schema declares a required positional the input **does** satisfy, so the
only reading of `undefined` is that the early return fired: had validation run, the satisfied
positional would have produced an object.

## Plants (D-116-04)

Three plants, each applied to `extensions/pi-claude-marketplace/edge/args-schema.ts`, confirmed
RED, then reverted. `git diff --quiet` over the pinned production files and
`tests/helpers/notification-boundary.ts` exits 0 after every revert, and again before the commit.

**Plant 1 — the plant the plan names.** Deleted `|| value.trim() === ""` from the required-value
guard (line 80). Result: 14 pass, 1 fail.

```text
✖ parseCommandArgs reports usage and yields nothing when a required positional is blank
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + {
  +   marketplace: 'official',
  +   plugin: '   '
  + }
  - undefined

    actual: { marketplace: 'official', plugin: '   ' },
    expected: undefined,
    operator: 'deepStrictEqual',
```

**Plant 2 — the omission claim.** Replaced `} else if (value !== undefined && value.trim() !== "")`
with a bare `} else {`, so an optional positional is always assigned. Result: 13 pass, 2 fail.
This is the plant that proves the whole-value assertion discriminates omission from `undefined`:

```text
✖ parseCommandArgs omits an absent optional tail positional instead of setting it undefined
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      marketplace: 'official',
  +   plugin: undefined
    }

    actual: { marketplace: 'official', plugin: undefined },
    expected: { marketplace: 'official' },
    operator: 'deepStrictEqual',

✖ parseCommandArgs omits a blank optional tail positional and reports no usage error
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      marketplace: 'official',
  +   plugin: '   '
    }
```

**Plant 3 — the early-return claim.** Made the `parseArgsOrNotify` catch return
`{ positional: ["official"] }` instead of `undefined`, so a tokenizer failure no longer
short-circuits. Result: 12 pass, 3 fail — all three tokenizer-rejection cases.

```text
✖ parseCommandArgs reports the tokenizer diagnostic and never reaches positional validation
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + {
  +   marketplace: 'official'
  + }
  - undefined

    actual: { marketplace: 'official' },
    expected: undefined,
    operator: 'deepStrictEqual',
```

No plant stayed GREEN.

**No exhaustiveness plant was attempted.** `args-schema.ts` contains no `switch` and no
closed-union dispatch, so a missing-arm plant has no target in this pair. Stating that is the
honest close; hunting for a target that does not exist would have produced a case proving nothing.

## What was deliberately not tested (D-116-12)

- **Absence of direct process output.** ESLint's `no-restricted-syntax` rule and `fallow`'s
  `boundaries.calls.forbidden` both fire on `process.stdout.write` in this zone. A case
  restating it cannot fail.
- **Per-verb flag-catalog contents.** `tests/architecture/flag-catalog-drift.test.ts` pins those
  exactly; this pair does not touch `flag-catalog.ts`.
- **Tokenizer quoting rules for their own sake.** `edge/args.ts` is a separate pair (116-02).
  This owner drives quoting only where it is the sole way to reach an args-schema branch — a
  blank token and an empty `--scope` value.

## Verification

Each gate run separately, exit code checked. `npm run check` was never used: its `format:check`
link fails on pre-existing untracked operator files and short-circuits before the tests run.

| Gate | Exit | Result |
|------|------|--------|
| `node --test tests/edge/args-schema.test.ts` | 0 | 15/15 pass |
| `npm run test:coverage:direct -- .../edge/args-schema.ts` | 0 | branches 17/17, functions 2/2, lines 96/96 |
| `npm run typecheck` | 0 | clean |
| `npm run lint` (whole repo) | 0 | clean |
| `npm exec -- eslint tests/edge/args-schema.test.ts` | 0 | clean |
| `npm exec -- prettier --check tests/edge/args-schema.test.ts` | 0 | clean |
| `npm run fallow` | 0 | dead-code, health, dupes all pass |
| `npm test` | 0 | 4843/4843 |
| `npm run test:integration` | 0 | 31/31 |
| anti-pattern `rg` scan | 1 (no match) | no `only`/`skip`/`todo`, no coverage pragma, no double assertion, no wildcard matcher, no module replacement, no capitalized phase markers |
| `rg -c '^\s+// arrange$'` | 11 | equals the 11 case bodies; `// act` 11, `// assert` 11 |
| `git diff --check` | 0 | no whitespace damage |
| `git diff --quiet` over pinned sources + boundary helper | 0 | no production change, no helper change |
| trufflehog `filesystem` scan | 0 | chunks 1, bytes 7947, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files ...` | 0 | all applicable hooks pass |

The unit-suite count moved from 4832 to 4843: 15 new runtime cases replacing 4 old ones.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 116-02 (`tests/edge/args.test.ts`, the same G1 shape against the tokenizer). This plan
leaves `edge/args.ts` at 95.51 percent line and 88.46 percent branch coverage under the
args-schema pair run, with lines 35-37 and 71 uncovered — that is 116-02's own target and is
recorded here only so the next executor does not have to re-measure it.

## Self-Check: PASSED

- `tests/edge/args-schema.test.ts` exists on disk.
- `7d1a065b` (`test(116-01): rewrite the args-schema owner against the pair contract`) is in
  `git log`, one file changed, no deletions.
- All `<acceptance_criteria>` re-run above; all pass.
