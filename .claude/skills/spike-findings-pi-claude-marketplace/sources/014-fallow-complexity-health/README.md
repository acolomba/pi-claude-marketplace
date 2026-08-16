---
spike: 014
name: fallow-complexity-health
type: standard
validates: "Given `sonarjs/cognitive-complexity: 15` (lint-time hard error), when `npx fallow health` runs, then compare its 0-100 scoring against cognitive-complexity findings for the same hotspots"
verdict: VALIDATED
related: [010]
tags: [fallow, static-analysis, complexity, tooling]
---

# Spike 014: Fallow Complexity/Health Scoring

## What This Validates

`eslint.config.js` gates cognitive complexity at 15 as a hard CI error
(`sonarjs/cognitive-complexity`) but does not check cyclomatic complexity,
function line count, file-level maintainability, or untested-but-reachable
code anywhere. Does `fallow health`'s composite score agree with ESLint on
the functions they both measure, and what does it cover that nothing else
in this project's toolchain does?

## Research

`fallow health --help`: default run shows health score, complexity
findings, file scores, hotspots, and refactoring targets together;
`--complexity`/`--file-scores`/`--coverage-gaps`/`--hotspots`/`--ownership`
narrow to one section. Resolved config defaults
(`fallow config`, captured in Spike 010): `maxCyclomatic: 20, maxCognitive:
15, maxCrap: 30, maxUnitSize: 60`.

## How to Run

```bash
npx --yes fallow health --format human --summary
npx --yes fallow health --complexity --format human --top 10
```

## What to Expect

8,623 functions analyzed, 639 above at least one threshold, a health score
of "64 C," and a top-ranked `installPlugin` function at cognitive
complexity 49 -- more than 3x the project's own ESLint ceiling of 15.

## Investigation Trail

**First look was alarming:** `installPlugin`
(`orchestrators/plugin/install.ts:1328`) reported cyclomatic 40, cognitive
49, 598 lines, CRAP 1640 -- "CRITICAL." If `sonarjs/cognitive-complexity:
15` is a hard CI error, a function at 49 shouldn't be able to exist in a
green `main`.

**Checked for an ESLint suppression before assuming a gap:** `grep
"eslint-disable"` on `install.ts` found `// eslint-disable-next-line
sonarjs/cognitive-complexity` directly above `installPlugin`, with a
two-line comment explaining why: "Install sequencing intentionally keeps
the state guard, failure routing, and post-commit/notification logic in
one audited flow matching PI-1..15." **Not a gap -- a deliberate, documented
exception ESLint already knows to skip and Fallow has no way to know
about**, since Fallow doesn't parse ESLint disable directives.

**Counted how many such suppressions exist project-wide:** 8 total
`eslint-disable-next-line sonarjs/cognitive-complexity` comments, across
`install.ts` (×2), `uninstall.ts`, `enable-disable.ts` (×2), `update.ts`
(×2), `execute.ts`. Fallow's top complexity findings matched every one of
these 8 functions by name and location. Since ESLint's rule is a hard
error with no other suppressions in the codebase, every OTHER function
Fallow lists among its "639 above threshold" must be exceeding a
*different* threshold than cognitive complexity -- confirmed by checking
`eslint.config.js`: **there is no `complexity` (cyclomatic) rule
configured at all.** Cyclomatic complexity, function line count (`434`
functions over 60 lines), file-level maintainability index, and CRAP score
are metrics nothing in this project's toolchain currently measures,
anywhere.

**Checked `--coverage-gaps`:** "0 Untested files (100.0% file coverage),
0 Untested exports" -- a clean result, but a materially weaker claim than
it sounds. This is *static reachability from a test root* (does some test
file import this, transitively), not *runtime line coverage* like the
project's actual `node --test --experimental-test-coverage` + SonarCloud
pipeline measures (which recently reported "99.6% new coverage" per a
prior PR's quality gate). A file can be import-reachable from a test
without a single line inside it actually executing under test. Useful as
a coarse, free-in-the-same-pass signal, not a substitute for real coverage.

**Checked `--file-scores`:** CRAP-risk numbers for the top files (>999,
870.0, 812.0, 600.0) come with an explicit caveat in the tool's own output:
"CRAP estimated from export references... Run `fallow health --coverage
<coverage-final.json>` for exact scores." Not wired to real coverage data
in this run -- the project's coverage pipeline produces `lcov`, not the
Istanbul `coverage-final.json` shape Fallow expects, so feeding it real
data would need a format conversion step, not just a flag. The numbers
shown here are rough estimates, not calibrated against this project's
actual (good) test coverage.

## Results

**Verdict: VALIDATED.** Fallow's complexity/health analysis is accurate on
the metrics it shares with ESLint (it found exactly the 8 functions the
project already knows about and has documented reasons for exempting) and
adds real, currently-uncovered signal: cyclomatic complexity, unit size
(434 functions over 60 lines, several over 300-600), and file-level
maintainability/fan-in/fan-out -- none of which ESLint or SonarCloud's
configured gates check today in this project's CI.

**Two caveats before treating any of this as actionable without more
work:**
1. Fallow has no awareness of ESLint's `eslint-disable-next-line`
   suppressions. Any adoption of `fallow health` as a gate needs its own
   suppression pass (`// fallow-ignore-next-line`, confirmed supported
   elsewhere in this spike series) for the 8 already-reviewed exceptions,
   or every CI run reports them as new CRITICAL findings forever.
2. CRAP/file-risk scores are unreliable without wiring in real coverage
   data, which requires converting this project's `lcov` output to the
   Istanbul `coverage-final.json` format Fallow expects -- a real, not
   trivial, integration cost, not just a missing flag.
