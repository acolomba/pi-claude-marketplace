---
phase: 116-edge-surface
plan: "02"
subsystem: edge
tags: [unit-test, pair-contract, args, tokenizer, scope-validation, d-116-01a, mod-09]
status: complete
requires:
  - "116-00 notification boundary (not consumed: this pair takes no Pi context)"
provides:
  - "Sole mirrored direct owner for edge/args.ts, contract-compliant at the argued D-116-01a shortfall"
affects:
  - "D-116-01a recorded coverage numbers for edge/args.ts — the pinned pair (25/26) is superseded by measurement (28/29); operator ratification required"
tech-stack:
  added: []
  patterns:
    - "G1 pure-function owner: three import statements, a flat sequence of test() bodies, no describe(), no fixture"
    - "The lcov branch denominator is a property of the suite, not of the source: V8 emits a block range only when its count diverges from the enclosing range, so covering a guard's false arm raises numerator AND denominator together"
key-files:
  created: []
  modified:
    - tests/edge/args.test.ts
key-decisions:
  - "The direct-coverage branch denominator for edge/args.ts moved from 26 to 29 because the new suite exercises three guard arms the old suite never took; the single uncovered branch is unchanged in identity and location"
  - "The plan's full-line verdict pin was not relaxed and the suite was not shrunk to restore 25/26; the finding is reported instead"
  - "No exhaustiveness plant was attempted: args.ts has no switch and no closed-union dispatch, so there is no missing-arm target here"
requirements-completed: [MOD-09]
coverage:
  - deliverable: "tests/edge/args.test.ts owns every runtime-reachable branch of edge/args.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/args.test.ts"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/args.ts"
        status: pass
  - deliverable: "The --scope accepted-value comparison is proven discriminating by a planted violation"
    human_judgment: false
    verification:
      - kind: command
        ref: "plant applied to edge/args.ts line 42, confirmed RED, reverted"
        status: pass
  - deliverable: "The documented D-116-01a shortfall for edge/args.ts is re-measured and argued"
    human_judgment: true
    rationale: "The measured verdict line differs from the number D-116-01a and the plan recorded. The identity of the shortfall is unchanged and the evidence is stronger, but the recorded number is a locked decision artifact, so the correction needs operator ratification rather than an executor edit."
metrics:
  duration: "20 min"
  completed: 2026-09-02
actuals:
  tokens: 3300
  tasks: 1
  commits: 3
---

# Phase 116 Plan 02: args Owner Summary

`tests/edge/args.test.ts` is rewritten as a flat pure-function owner: 17 marked case bodies
emitting 19 runtime cases, every expectation hand-authored and compared as one whole value. The
pair lands at the D-116-01a shortfall — one compiler-forced branch, at `edge/args.ts:34-37` — but
at **branches 28/29, lines 86/89**, not the **25/26** the plan pinned. That discrepancy is the
headline finding of this plan and is argued in full below.

## FINDING — the pinned verdict line is not a property of the source

**Measured verdict, verbatim:**

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/args.ts: branches 28/29, lines 86/89
```

**Pinned verdict, from the plan's `<verify>` and from D-116-01a:**

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/args.ts: branches 25/26, lines 86/89
```

The plan instructs the executor to stop and report any other verdict line, "including a passing
one, because the documented shortfall has changed", and forbids relaxing the pin. The pin was not
relaxed, the suite was not shrunk to restore 25/26, and no production file was changed. This is
the report.

**What actually changed, and why it is not a regression.** The gate reads `BRF`/`BRH` out of
lcov, which Node derives from V8 block coverage. V8 emits a block range only when that block's
execution count **diverges** from the enclosing range. A guard whose false arm is never taken has
the same count as its parent, so V8 collapses it and the branch never appears in the denominator
at all. Covering that false arm makes the counts diverge, so the range appears — raising the
numerator **and** the denominator by one each time.

The old suite never took the false arm of three guards. The new one does. Diffing the `BRDA`
records between the two suites over the same source shows exactly three new ranges and no lost
ones:

| New `BRDA` line | Source | The arm the old suite never took |
|-----------------|--------|----------------------------------|
| `BRDA:46` | `args.ts:46-47`, the invalid-`--scope` `else` throw | reached distinctly once the missing-value and invalid-value forms are both driven |
| `BRDA:75` | `args.ts:75`, `if (current.length > 0)` inside the space handler | a space arriving on an empty buffer — leading, trailing, and repeated interior spaces |
| `BRDA:84` | `args.ts:84`, the trailing `if (current.length > 0)` flush | an input that ends on a space, and the empty argument vector |

Every one of the old suite's 25 covered branches is still covered. `BRDA:34,3,0,0` — the guard —
is still the only zero, in both runs.

**Consequence.** The branch denominator for a pair is a function of the suite that drives it, not
of the source alone. A full-line verdict pin therefore cannot be authored ahead of the rewrite that
strengthens the suite; it can only be authored after. The number D-116-01a records for
`edge/args.ts` (`branches 25/26`) was measured against the pre-rewrite suite and is superseded by
`branches 28/29`. **The identity of the shortfall is unchanged.** The three remaining D-116-01a
claimants (116-26, 116-21, 116-17) carry the same exposure and their pinned numbers should be
treated as provisional until each is re-measured against its own rewritten owner.

**Requires operator ratification** — of the amended number in D-116-01a and in this plan's
`<verify>` block, and of the same treatment for the other three claimants. An executor amending a
locked decision artifact is out of bounds, so nothing was edited.

## The four-part D-116-01a record

1. **Exact line range:** `extensions/pi-claude-marketplace/edge/args.ts:34-37` — the
   `if (token === undefined) { i++; continue; }` guard inside the `parseArgs` `while` loop.
2. **Unreachable at runtime:** `tokenize` returns a dense `string[]` built only by
   `tokens.push(current)`, so it has no holes and no `undefined` member. The loop's own condition
   is `i < tokens.length`, and `i` starts at 0 and only increments, so every `tokens[i]` the loop
   reads is inside the array's length. No input to `parseArgs` can make the read produce
   `undefined`, so no case can enter the guard. This is why the plan's own instruction not to
   write a case that cannot fail applies here: any case aimed at this arm would be theatre.
3. **The compiler setting that forces it to exist:** `noUncheckedIndexedAccess`
   (`tsconfig.json:12`) types every index read as `T | undefined` regardless of what the
   surrounding bounds already guarantee, so `const token = tokens[i]` is `string | undefined` and
   the arm must be written. Removing it needs a non-null assertion or a type assertion.
   `@typescript-eslint/no-non-null-assertion` is an error throughout `extensions/` and
   `as unknown as` / `as any` are barred by this phase's own anti-pattern grep, so the only
   remaining route is a loop rewrite — a production change, out of scope for a milestone scoped to
   tests. No coverage-exception pragma was added and no production file was changed.
4. **Exact coverage numbers:** **functions 2/2, lines 86/89, branches 28/29.** Uncovered lines are
   exactly 35-37. Functions and lines match the plan's expectation; branches are as argued above.

## What was built

The old suite was 92 lines and 13 cases with no phase markers. It asserted `result.positional` and
`result.scope` one property at a time — so the **absence** of a `scope` key was never part of any
promise, only its value — and matched both rejection diagnostics with an anchored regex.

The new suite copies the skeleton of `tests/orchestrators/import/refs.test.ts`: three import
statements, no `describe()`, no fixture, no context, no helper. Every expected value is a
hand-authored literal checked with `satisfies ParsedArgs` and compared with
`assert.deepStrictEqual`, so omission of `scope` is asserted rather than assumed. Both diagnostics
are asserted by error class and exact message:

- `--scope requires a value: "user" or "project".`
- `Invalid --scope value: "bogus". Must be "user" or "project".`

**The 17 case bodies, derived from the source rather than sampled:**

| Case body | Branch it reaches |
|-----------|-------------------|
| Two positionals, no flag | `token === "--scope"` false, `scope !== undefined` false |
| `--scope user` | first operand of the accepted-value test |
| `--scope project` | second operand of the accepted-value test |
| Pair leading / between / trailing (3-row table) | position independence, `scope !== undefined` true |
| Single-quoted run | `ch === "'" && !inDouble` true, space suppressed by `inSingle` |
| Double-quoted run | `ch === '"' && !inSingle` true, space suppressed by `inDouble` |
| Single quote inside a double-quoted run | `ch === "'"` true, `!inDouble` false — no toggle |
| Double quote inside a single-quoted run | `ch === '"'` true, `!inSingle` false — no toggle |
| Backslash before a space | no escape arm exists; `\` falls to `current += ch` and the space still splits |
| Leading, trailing, repeated interior spaces | `if (current.length > 0)` false inside the space handler, and false at the trailing flush |
| Empty argument vector | `while (i < tokens.length)` never entered; trailing flush false |
| Bare verb, no operand | single-token positional list |
| Unterminated quoted run | trailing flush true with a quote flag still set |
| `--scope` as the final token | `val === undefined` throw |
| `--scope ""` | the value token is discarded by the tokenizer, reaching the same throw |
| `--scope bogus` | the invalid-value `else` throw |
| Two `--scope` pairs | last assignment wins |

New reach over the old suite: the empty argument vector, the bare verb, space collapsing, the
unterminated quoted run, the empty quoted scope value, and last-scope-wins. Nothing the old suite
covered was dropped.

The `--scope ""` case proves an outcome rather than assuming one. The tokenizer sees `"` twice,
toggles `inDouble` on and off, and `current` stays empty, so the trailing flush pushes nothing and
the value token never exists — which is why an empty quoted value produces the **missing-value**
diagnostic and not the invalid-value one.

## Plants (D-116-04)

One plant, the one the plan names, applied to `extensions/pi-claude-marketplace/edge/args.ts` and
reverted. `git diff --quiet` over the pinned production files and
`tests/helpers/notification-boundary.ts` exits 0 after the revert, and again before the commit.

**Plant — the accepted-value claim.** Narrowed `if (val === "user" || val === "project")` at line
42 to `if (val === "user")`, so the second accepted value falls through to the invalid-value
throw. Result: 17 pass, 2 fail.

```text
✖ failing tests:

test at tests/edge/args.test.ts:36:1
✖ parseArgs returns the project scope alongside the positionals in input order (0.51484ms)
  Error: Invalid --scope value: "project". Must be "user" or "project".
      at parseArgs (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/edge/args.ts:47:15)
      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/tests/edge/args.test.ts:45:22)

test at tests/edge/args.test.ts:227:1
✖ parseArgs keeps the last scope value when the pair is supplied twice (0.413389ms)
  Error: Invalid --scope value: "project". Must be "user" or "project".
      at parseArgs (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/edge/args.ts:47:15)
      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/tests/edge/args.test.ts:236:22)
```

The plant went RED, and it caught the last-scope-wins case as well as the direct one — the second
accepted value is load-bearing in both. No plant stayed GREEN.

**No exhaustiveness plant was attempted.** `args.ts` contains no `switch` and no closed-union
dispatch, so a missing-arm plant has no target in this pair. Recording that absence is the honest
close; hunting for a target that does not exist would produce a case proving nothing.

## What was deliberately not tested (D-116-12)

- **Absence of direct process output.** ESLint's `no-restricted-syntax` rule and `fallow`'s
  `boundaries.calls.forbidden` both fire on `process.stdout.write` in this zone. A case restating
  it cannot fail. The plan says so explicitly.
- **The unreachable `token === undefined` guard.** Argued above rather than covered. Any case
  aimed at it would be a case that cannot fail.
- **Positional-schema validation.** `edge/args-schema.ts` is a separate pair, owned by 116-01 at
  branches 17/17. This owner drives only the raw `ParsedArgs` shape.
- **Per-verb flag names.** `tests/architecture/flag-catalog-drift.test.ts` pins those exactly;
  this pair does not touch `flag-catalog.ts`.

## Verification

Each gate run separately, exit code checked. `npm run check` was never used: its `format:check`
link fails on pre-existing untracked operator files and short-circuits before the tests run.

| Gate | Exit | Result |
|------|------|--------|
| `node --test tests/edge/args.test.ts` | 0 | 19/19 pass |
| `npm run test:coverage:direct -- .../edge/args.ts` | **1** | **branches 28/29, funcs 2/2, lines 86/89, uncovered 35-37 — the pinned full-line match fails; see the finding above** |
| `npm run typecheck` | 0 | clean |
| `npm run lint` (whole repo) | 0 | clean |
| `npm exec -- eslint tests/edge/args.test.ts` | 0 | clean |
| `npm exec -- prettier --check tests/edge/args.test.ts` | 0 | clean |
| `npm run fallow` | 0 | dead-code, health, dupes all pass |
| `npm test` | 0 | 4849/4849 across 274 suites |
| `npm run test:integration` | 0 | 31/31 |
| anti-pattern `rg` scan | 1 (no match) | no `only`/`skip`/`todo`, no coverage pragma, no double assertion, no wildcard matcher, no module replacement, no capitalized phase markers |
| `rg -c '^\s+// arrange$'` | 17 | equals the 17 case bodies; `// act` 14 plus `// act & assert` 3 = 17; `// assert` 14 |
| `git diff --check` | 0 | no whitespace damage |
| `git diff --quiet` over pinned sources + boundary helper | 0 | no production change, no helper change |
| trufflehog `filesystem` scan | 0 | chunks 1, bytes 6773, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files ...` | 0 | all applicable hooks pass |

The unit-suite count moved from 4843 to 4849: 19 new runtime cases replacing 13 old ones.

The coverage gate exits 1 by design for this pair — D-116-01a admits the shortfall, and the gate
has no mechanism to record an argued exception. Only the number inside the verdict differs from
what the plan expected.

## Deviations from Plan

**[Finding — not auto-fixed] The pinned coverage verdict line does not match the measurement.**

- **Found during:** Task 1, after every behavioral case passed.
- **Issue:** The plan's `<verify>` block pins `branches 25/26, lines 86/89` as a full-line match,
  and D-116-01a records the same. The rewritten owner measures `branches 28/29, lines 86/89`.
- **Why it was not fixed:** Both available fixes are barred. Relaxing the pin is forbidden by the
  plan's own wording. Shrinking the suite back to 13 cases to restore a denominator of 26 would
  drop real proof to flatter a number — the exact prohibition in the plan's `must_haves`.
- **What was done instead:** Root-caused by diffing lcov `BRDA` records between the two suites over
  the same source, and reported. No file was edited to make the link pass.
- **Files modified:** none beyond `tests/edge/args.test.ts` itself.
- **Commit:** `c32f8c41`

**Total deviations:** 0 auto-fixed, 1 finding escalated.
**Impact:** The plan's `<verify>` block cannot pass as written and `<success_criteria>` line 1 is
unmet as stated. Every other gate is green and the pair's substantive obligation — one owner, every
runtime-reachable branch, one argued compiler-forced shortfall, no production change — is met.

## Issues Encountered

The finding above. Three other plans (116-26, 116-21, 116-17) claim D-116-01a with pre-measured
branch numbers taken from their current suites; each is exposed to the same denominator movement
once its owner is rewritten. Flagging now so those executors are not surprised.

## Next Phase Readiness

Ready for 116-03 (`tests/edge/completions/data.test.ts`, the G6 read-only projection shape) once
the operator rules on the pinned-number correction. 116-03 does not claim D-116-01a and is not
blocked by it.

## Self-Check: PASSED

- `tests/edge/args.test.ts` exists on disk.
- `c32f8c41` (`test(116-02): rewrite the args owner against the pair contract`) is in `git log`,
  one file changed, no deletions of other files.
- All `<acceptance_criteria>` re-run above. All pass except the verdict-line quotation, which is
  recorded verbatim as measured together with the D-116-01a argument, and escalated rather than
  edited away.
