---
phase: 117-extension-entry-and-final-gate
reviewed: 2026-09-04T01:05:00Z
depth: standard
iteration: 2
review_of: .planning/phases/117-extension-entry-and-final-gate/117-REVIEW-FIX.md
diff_base: 854998b1
files_reviewed: 13
files_reviewed_list:
  - CONTRIBUTING.md
  - eslint.config.js
  - package.json
  - scripts/test-coverage-direct.mjs
  - scripts/test-coverage-direct.negative.mjs
  - tests/architecture/unit-suite-glob-completeness.test.ts
  - tests/bridges/agents/unstage.test.ts
  - tests/edge/notification-boundary.ts
  - tests/index.test.ts
  - tests/orchestrators/import/settings.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/persistence/config-io.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 117: Code Review Report (iteration 2 — review of the fixes)

**Reviewed:** 2026-09-04T01:05:00Z
**Depth:** standard
**Diff under review:** `854998b1..HEAD` (12 commits), production tree untouched
**Status:** issues_found (no blockers)

## Summary

All ten findings from iteration 1 are genuinely closed. I re-ran the reviewer's
own experiments rather than reading the fix report, and every claim in
`117-REVIEW-FIX.md` that I could test held:

| Finding | Independent verification | Verdict |
|---|---|---|
| CR-01 | both ordinals set past the last read → **11 pass / 2 fail**, naming the two cases | closed |
| CR-02 | `check` now runs the three gates; measured 2.21 s / 0.83 s / 1.91 s, all rc 0 | closed |
| WR-01 | `node scripts/test-coverage-direct.mjs` now maps 21 pairs, runs 20, stops on `import.ts` branches 11/12 (rc 1) instead of aborting on `README.md` | closed |
| WR-02 | read-back arm added; see WR-04 below for its reachability | closed with residual |
| WR-03 | planted an unused binding + misformatting in `scripts/check-corresponding-tests.mjs` → `npm run lint` errors, `format:check` warns | closed |
| WR-04 | reverted the filter to `toProjectPath` → negative control dies with `Path is outside the project: /tmp/direct-coverage-gate-…` | closed |
| WR-05 | `makeRawNotifyFn` read in production: it writes straight to `ctx.ui.notify` and probes nothing — the new doc is true | closed |
| WR-06 | all five sites carry the `{ code, syscall }` whole-value pin | closed |
| WR-07 | gave `contextWithoutSessionManager` a working session manager → exactly that case fails | closed |
| WR-08 | quoted `--test-reporter=spec` in `test:coverage:unit` → the gate fails *naming the argument* | closed |

I also verified the load-bearing claim behind the WR-03 deviation. It is exactly
right, to the digit:

```
"**/*.{js,mjs,json,ts}"                     → 496 entry points (489 plugin) → ✗ 2 stale suppressions, rc 1
"**/*.{js,json,ts}" + "scripts/**/*.mjs"    → 494 entry points (487 plugin) → ✓ No issues found, rc 0
package.json at 854998b1 (control)          → 494 entry points (487 plugin) → ✓ No issues found, rc 0
```

The shipped narrower form is coherent, not merely green: it adds **zero** entry
points relative to the pre-fix baseline, so it changes nothing about what fallow
analyses while still reaching the gate scripts for prettier. `ea5ca571` shipping
the broken form and `ea14e3a0` correcting it is history, and the final state is
right.

State after the fixes, measured unpiped in this checkout: `npm test`
5143 / 295 suites / 0 fail (rc 0); `npm run fallow` rc 0; the three new gate
scripts rc 0; `pre-commit` over the thirteen changed files fails only on
trufflehog (structural `.git` issue) and on the eight untracked operator files
already excluded from scope.

**What is left is not a repeat of iteration 1.** The two defect classes that
remain are (a) the fix widened `npm run lint` and `npm run format:check` to read
`scripts/`, but did not widen the two `.pre-commit-config.yaml` `files:` patterns
that decide whether those hooks run at all — and that file's own comment now
quotes both script bodies verbatim and both quotes are false; and (b) the
strengthened arms added by CR-02/WR-02 are not reachable from any wired or
documented command. Neither blocks the phase. None requires touching
`extensions/`.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied for this review. `npm run fallow`
was run directly instead (rc 0, `✓ No issues found`, 494 entry points), together
with the two comparison runs recorded in the summary table.

## Narrative Findings (AI reviewer)

Every finding below is from direct reading plus a mutation experiment run against
the working tree. All mutations were reverted; `git status --porcelain` on
`tests/`, `scripts/`, `package.json` and `eslint.config.js` is clean, and
`npm test` was re-run afterwards at 5143 / 0.

## Warnings

### WR-01: `npm run lint` and `format:check` now read `scripts/`, but their pre-commit hooks still cannot see it

**File:** `.pre-commit-config.yaml:96-141` (caused by `package.json:78-81`)

**Issue:** The fix widened two scripts:

```json
"format:check": "prettier --check \"**/*.{js,json,ts}\" \"scripts/**/*.mjs\"",
"lint":         "eslint extensions tests scripts eslint.config.js",
```

It did not widen the `files:` patterns that gate the corresponding local hooks:

```yaml
- id: npm-lint
  files: '^(eslint\.config\.js|tsconfig\.json|(extensions|tests)/.*\.ts|package(-lock)?\.json)$'
- id: npm-format-check
  files: '^(\.prettierrc\.json|\.prettierignore|eslint\.config\.js|(extensions|tests)/.*\.ts|package(-lock)?\.json|tsconfig\.json)$'
```

Neither matches `scripts/`. Confirmed:

```
$ pre-commit run npm-lint         --files scripts/test-coverage-direct.mjs
npm lint.............................................(no files to check)Skipped
$ pre-commit run npm-format-check --files scripts/test-coverage-direct.mjs
npm format check.....................................(no files to check)Skipped
```

So a commit that touches only a gate script — the exact edit this phase makes
likely, since the gate scripts are now the milestone's load-bearing artifacts —
gets no local lint or format feedback at all. The very drift WR-03 was filed
about (two unformatted `.mjs` files sitting in the tree) can recur and reach a
push unchallenged.

This is worse than an oversight, because the file states the invariant it just
broke, in a comment that now quotes two script bodies that no longer exist:

> each pattern must name every path that can change that tool's verdict — …
> `npm run lint` is literally `eslint extensions tests eslint.config.js`,
> prettier globs `**/*.{js,json,ts}` …

Both quotes are stale as of `ea14e3a0`/`ea5ca571`. A future editor reading that
comment will reason from a false description of the gate.

Severity is WARNING, not BLOCKER, because CI still catches it twice over —
`ci.yml` runs the whole `npm run check`, and `lint.yml` runs `pre-commit` with
`--all-files`. It is the "local-feedback gap" class the file itself names, and it
is now real rather than hypothetical.

**Fix:** Add `scripts/` to both patterns and correct the two quotes.

```yaml
- id: npm-lint
  files: '^(eslint\.config\.js|tsconfig\.json|(extensions|tests)/.*\.ts|scripts/.*\.mjs|package(-lock)?\.json)$'
- id: npm-format-check
  files: '^(\.prettierrc\.json|\.prettierignore|eslint\.config\.js|(extensions|tests)/.*\.ts|scripts/.*\.mjs|package(-lock)?\.json|tsconfig\.json)$'
```

and in the block comment replace the two quoted bodies with the current ones
(`eslint extensions tests scripts eslint.config.js`, and prettier globbing
`**/*.{js,json,ts}` **plus** `scripts/**/*.mjs`). Verify the way the comment says
the original four were verified: plant a violation in a `scripts/*.mjs` file and
watch the hook fire on a scripts-only file list.

---

### WR-02: the new ESLint block's comment claims more coverage than the block delivers

**File:** `eslint.config.js:329-357`

**Issue:** The comment says:

> Switching the presets off rather than ignoring the directory keeps every rule
> that needs no type information, which is the point: these files carry the
> correspondence and direct-coverage invariants and used to be unlinted,
> unformatted and untypechecked all at once.

The reader's takeaway — the gate scripts are now linted like the rest of the
repository — is not true. The block that carries this project's own rules is
scoped `files: ["**/*.{js,ts}"]` (`eslint.config.js:28`), which does not match
`.mjs`. So `scripts/**/*.mjs` gets `js.configs.recommended` and
`strictTypeChecked`-minus-type-aware, and **none** of: `curly`, `no-console`,
`import-x/order`, `sonarjs/cognitive-complexity`, `sonarjs/no-identical-functions`,
`@stylistic/padding-line-between-statements`, `prefer-object-has-own`,
`@typescript-eslint/explicit-module-boundary-types`, or the `^_` ignore pattern
on `no-unused-vars`.

Measured. Appending this to `scripts/check-corresponding-tests.mjs`:

```js
if (process.env.NOPE) console.log("planted");
const x = 1; const y = 2;
```

produces exactly two errors, both from the tseslint default:

```
217:7   error  'x' is assigned a value but never used  @typescript-eslint/no-unused-vars
217:20  error  'y' is assigned a value but never used  @typescript-eslint/no-unused-vars
```

The braceless `if` and the `console.log` pass. In a repository whose stated bar
(CONVENTIONS.md) is two independent complexity gates, a `no-console` policy and
`curly: ["error", "all"]`, the ~1000 lines of gate logic are linted under a
materially weaker rule set than everything they guard — and the comment says the
opposite.

Note the fix is *not* widening `eslint.config.js:28` to `**/*.{js,mjs,ts}`: that
block sets `parserOptions.projectService: true`, and `scripts/` is deliberately
outside `tsconfig.json`'s `include`, so the type-aware service would refuse the
files.

**Fix:** Declare the non-type-aware subset explicitly in the scripts block, and
correct the comment to say what is and is not covered.

```js
{
  files: ["scripts/**/*.mjs"],
  ...tseslint.configs.disableTypeChecked,
  plugins: { "@stylistic": stylistic, "import-x": importX, sonarjs },
  languageOptions: { globals: { ...globals.node } },
  rules: {
    ...tseslint.configs.disableTypeChecked.rules,
    curly: ["error", "all"],
    "no-console": "warn",
    "prefer-object-has-own": "error",
    "sonarjs/cognitive-complexity": ["error", 15],
    "sonarjs/no-identical-functions": "error",
    "@stylistic/padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "block-like", next: "*" },
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
    ],
  },
}
```

Prove it the way the phase's own standard demands: plant the braceless `if` and
the `console.log` again and watch both fire.

---

### WR-03: the hydrate refusal case still cannot tell its own stage from the next one

**File:** `tests/index.test.ts:637-663` (constants at `:111-120`)

**Issue:** CR-01's core defect is closed — with both ordinals set past the last
read, the two cases now fail:

```
✖ still answers when the deferred project-scope hydrate fails (NFR-2)
✖ still answers when the plugin PATH recompute fails (NFR-2)
ℹ tests 13  ℹ pass 11  ℹ fail 2
```

But the stage pinning is only half there. The comment at `:111-118` names four
stages that read `event.cwd`: hydrate (1), reconcile (2), PATH recompute (3),
resource aggregation (4). I retargeted the hydrate case at each of the other
three:

| `CWD_READ_DEFERRED_HYDRATE` | result |
|---|---|
| `1` (shipped) | 13 pass / 0 fail |
| `2` (reconcile) | **13 pass / 0 fail** |
| `4` (aggregation) | 12 pass / 1 fail |
| `999` (nothing refused) | 12 pass / 1 fail |

Retargeting the case titled "the deferred project-scope hydrate fails" at the
**reconcile** read leaves it green. Both counters are satisfied (`refused: true`,
`reads: 4`), the answer is `EMPTY_DISCOVERY` either way, and the PATH observable
the fix added is identical because the recompute is downstream of both. So the
title is still not pinned to the stage, and the reconcile stage's own NFR-2
containment has no case of its own — it is covered only accidentally, by a case
that claims to be about a different stage.

The recompute case does not have this problem: retargeted at read 1 it fails on
the PATH observable, as the fix report says.

**Fix:** Give the hydrate case an observable the reconcile does not share. The
cheapest one is already in the suite: the reconcile emits when it has something
to report, so seed the project scope with a config the reconcile refuses (the
`seedInvalidConfig` fixture at `:526`) and assert the reconcile's raw error line
*was* emitted — which is exactly what a refusal retargeted at read 2 would
suppress.

```ts
await seedInvalidConfig(scope.cwd);
const { discover, ctx, notifications, verifyBoundary } = await loadExtension(0, 1);
// ...
// The refusal landed upstream of the reconcile, so the reconcile still ran and
// still reported. A refusal retargeted at read 2 loses this line.
assert.deepStrictEqual(notifications, [
  { message: RECONCILE_ABORTED_LINE, severity: "error" },
]);
```

Failing that, add a third case that refuses read 2 and asserts what only the
reconcile stage produces, so no ordinal in the documented list is untested.

---

### WR-04: the falsifiable half of the WR-02 fix is unreachable from every wired and documented command

**File:** `scripts/test-coverage-direct.mjs:429-443`; `package.json:88`; `CONTRIBUTING.md:47-50`

**Issue:** `runAllPairs` now reads the report back before asserting:

```js
const written =
  reportPath === undefined
    ? records
    : readFileSync(reportPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));

assertReportComplete(written, modulePaths);
```

The read-back arm — the one that can actually catch a lost append — runs only
when `--all --report <path>` is passed. Nothing passes it:

- `"test:coverage:direct:all": "node scripts/test-coverage-direct.mjs --all"` (`package.json:88`)
- `CONTRIBUTING.md` documents `npm run test:coverage:direct:all` and no `--report` form.

So every invocation a human or a machine will actually make takes the
`reportPath === undefined` branch, which the fix's own new comment
(`:327-332`) correctly describes as unable to fail at all. The strengthening is
real code that no reachable path executes. The fixer's Arm A / Arm B plant
exercised it only through a hand-built two-module scaffold.

**Fix:** Make the wired script take the arm that works.

```json
"test:coverage:direct:all": "node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl",
```

and name the report path in the `CONTRIBUTING.md` sweep section, so a reader
knows where the retained result lands. `coverage/` is already gitignored and
already used by the LCOV reporters, so this costs nothing.

---

### WR-05: the direct-coverage sweeps are documented as expected-to-fail, with nothing checking that a stop is ledgered

**File:** `CONTRIBUTING.md:44-54`; `scripts/test-coverage-direct.mjs:471-500`

**Issue:** CR-02's remedy for the two slow scripts is a documented cadence, which
the previous review explicitly permitted. But the cadence it documents is:

> Both stop at the first pair that falls short of complete direct coverage, which
> today includes the accepted single-branch shortfalls recorded in
> `.planning/WINDOWS.md`. Reaching one of those is the expected outcome, not a
> regression — read the ledger entry for the module the sweep names before
> treating a stop as a failure.

Confirmed on this branch: `npm run test:coverage:direct` runs 20 pairs green and
then exits 1 on `edge/handlers/plugin/import.ts: branches 11/12`.

Two consequences worth naming rather than accepting:

1. The exit code carries no information. A contributor who introduces a genuine
   new shortfall sees the same rc 1 and the same shape of message as the accepted
   one, and is instructed by CONTRIBUTING.md to go read a planning ledger by hand
   to tell them apart. That is the "green means nothing" failure mode inverted:
   red means nothing.
2. `test:coverage:direct:negative` — the negative control **for** this gate — is
   now in `npm run check` and runs on every CI job, while the gate it controls
   runs nowhere. CI proves the gate can fail and never asks it whether anything
   did.

Also minor: `CONTRIBUTING.md` is the contributor-facing document and it points
readers at `.planning/WINDOWS.md`, a GSD planning artifact excluded from the
markdown hooks and subject to milestone archival.

**Fix:** Teach the script its own accepted-shortfall list so the exit code means
something again — which is also the thing that makes the CI job possible:

```js
// One entry per accepted D-116-01a shortfall, keyed by module path, each with the
// ledger entry that justifies it. A stop on a listed module is reported and
// skipped; a stop on anything else, or a listed module that is now COMPLETE,
// fails the sweep.
const acceptedShortfalls = JSON.parse(readFileSync(path.join(projectRoot, "scripts/accepted-shortfalls.json"), "utf8"));
```

The "listed module that is now complete" half matters as much as the other: it is
what stops the list from silently outliving the shortfalls. With that in place,
`test:coverage:direct:all` can take the nightly job the fix report says is
currently impossible. If that is out of appetite for this phase, record it as a
deferred item rather than leaving the cadence prose as the only control.

## Info

### IN-01: `"no-restricted-syntax": "off"` in the new scripts block is dead configuration

**File:** `eslint.config.js:352-356`

**Issue:** The override is a no-op. The rule is enabled only by the block scoped
to `extensions/pi-claude-marketplace/**/*.ts` (`:92-94`), and the base
`**/*.{js,ts}` block does not match `.mjs`, so nothing ever turns it on for
`scripts/`. Verified by deletion: with the three lines removed,
`npx eslint scripts/check-corresponding-tests.mjs scripts/test-coverage-direct.mjs`
still exits 0 despite both files calling `process.stdout.write`. The accompanying
comment states the very fact that makes the line unnecessary ("The IL-2 ban on it
is scoped to extensions/\*\*, which these are not") and then sets it anyway.

**Fix:** Delete the three lines and keep the sentence as a note in the block
comment, so a future reader learns the scoping without inheriting a rule override
that guards nothing.

---

### IN-02: `isStructuralSupplement` is a second copy of the correspondence gate's rule, with an unused capture group

**File:** `scripts/test-coverage-direct.mjs:136-149` (original at `scripts/check-corresponding-tests.mjs:45-56,116-132`)

**Issue:** The supplement rule — "a `tests/{domain,platform}/<name>-fake.test.ts`
whose `-fake.ts` and `-contract.ts` companions both exist has no production pair"
— now exists twice, in two scripts, with two different regexes and two different
prefix derivations that happen to agree today. The direct-coverage copy also
declares a named group it never reads:

```js
const match = /^tests\/(?:domain|platform)\/(?<name>.+)-fake\.test\.ts$/.exec(projectPath);
// `match.groups.name` is never used; `prefix` is recomputed by slice() below.
```

The correspondence copy additionally requires the test to *import* both
companions; the direct-coverage copy checks only that the files exist. The two
will drift.

**Fix:** Export the rule from `check-corresponding-tests.mjs` (it already exports
`checkCorrespondingTests`) and import it in `test-coverage-direct.mjs`, or at
minimum drop the unused `(?<name>…)` group and add a comment pointing at the
other copy.

---

### IN-03: the WR-06 errno-identity block is copy-pasted five times

**Files:** `tests/persistence/config-io.test.ts:289-298`; `tests/orchestrators/import/settings.test.ts`; `tests/bridges/agents/unstage.test.ts:297-307`; `tests/orchestrators/plugin/install.test.ts`; `tests/orchestrators/plugin/reinstall.test.ts`

**Issue:** The same nine-line probe-plus-pin, and the same four-line comment,
appear verbatim at five sites. `fallow dupes` does not flag it today (rc 0), but
the repository's declared bar treats duplication as a gated concern, and five
copies of a pinned-identity literal means five places to edit when a runtime
changes the errno for a directory read.

**Fix:** Extract one helper into `tests/helpers/` — e.g.
`readFailureMessagePinning(filePath, { code: "EISDIR", syscall: "read" })` — and
call it from all five. The comment then has one home instead of five.

---

### IN-04: a truncated report line makes the read-back throw a raw `SyntaxError` instead of the gate's message

**File:** `scripts/test-coverage-direct.mjs:437-443`

**Issue:** The read-back maps `JSON.parse` over every non-empty line. A run
interrupted mid-`appendFileSync` — which is exactly one of the failure modes the
new comment says the read-back exists to catch ("a lost append, a truncated
write") — leaves a partial JSON line, and the sweep dies with an unhandled
`SyntaxError: Unexpected end of JSON input` rather than
`Missing from the all-pair result: <module>`.

**Fix:** Treat an unparseable line as an absent row so the gate's own message
still names the module:

```js
.map((line) => {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;      // a torn line is a row that was never retained
  }
})
.filter((record) => record !== undefined);
```

---

## Verification performed

Every experiment below was run in this checkout, unpiped where the exit code
mattered, and reverted afterwards. `git status --porcelain` on `tests/`,
`scripts/`, `package.json` and `eslint.config.js` is clean; `npm test` re-run
after the last revert reports 5143 / 295 suites / 0 fail, rc 0.

| Experiment | Result |
|---|---|
| both cwd ordinals → `999` | 11 pass / 2 fail — CR-01 closed |
| `CWD_READ_DEFERRED_HYDRATE` → `2` | **13 pass / 0 fail** — WR-03 above |
| `CWD_READ_DEFERRED_HYDRATE` → `4` | 12 pass / 1 fail |
| `CWD_READ_PLUGIN_PATH_RECOMPUTE` → `1` | 12 pass / 1 fail — stage pinned |
| `contextWithoutSessionManager` → working manager | that case fails — WR-07 closed |
| quoted `--test-reporter=spec` in `test:coverage:unit` | gate fails naming the argument — WR-08 closed |
| record filter reverted to `toProjectPath` | negative control dies on `Path is outside the project` — WR-04 closed |
| unused binding + misformat in a `scripts/*.mjs` | `lint` errors, `format:check` warns — WR-03 (iter 1) closed |
| `no-restricted-syntax: "off"` deleted | lint still rc 0 — IN-01 |
| braceless `if` + `console.log` in a `scripts/*.mjs` | no error — WR-02 above |
| `pre-commit run npm-lint --files scripts/*.mjs` | `Skipped` — WR-01 above |
| `**/*.{js,mjs,json,ts}` glob | 496 entry points, 2 stale suppressions, rc 1 |
| shipped glob | 494 entry points, rc 0 |
| `package.json` at `854998b1` | 494 entry points, rc 0 |
| `npm run test:coverage:direct` | 20 pairs pass, stops on `import.ts` branches 11/12, rc 1 |
| `test:corresponding` / `:negative` / `test:coverage:direct:negative` | rc 0, 2.21 s / 0.83 s / 1.91 s |
| `pre-commit run --files <13 changed files>` | fails only on trufflehog (structural) and the 8 untracked operator files |
| `npm test` | 5143 / 295 / 0 fail, rc 0 |

---

_Reviewed: 2026-09-04T01:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard — iteration 2_
