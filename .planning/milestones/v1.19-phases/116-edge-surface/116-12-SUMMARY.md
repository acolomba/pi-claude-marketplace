---
phase: 116-edge-surface
plan: "12"
subsystem: testing
tags: [node-test, strong-mock, edge, marketplace, exact-argument, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's pinned tests/helpers/notification-boundary.ts, consumed with an explicit toolProbes of 0 and the optional cwd option"
provides:
  - "tests/edge/handlers/marketplace/shared.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/shared.ts, closing one of the phase's correspondence-gate violations (12 -> 11)"
  - "The settled delegation contract the marketplace info and remove handler owners build on: they assert only the usage string and the delegate they supplied"
affects: [116-07, 116-09, 116-11]

actuals:
  tokens: 5400
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "G3 helper owner: one top-level describe() per exported entrypoint, no nesting, module-local type aliases derived from the module's own signature"
    - "Never-called proof by absence of expectation: a strong-mock with nothing stated throws on its first call, so a green case is the proof; times(0) is inert and would prove nothing"
    - "Ordering proof by identical whole value: two rows that differ only in flag position must produce one hand-authored expected object, so a reordered implementation reddens exactly one row"

key-files:
  created:
    - tests/edge/handlers/marketplace/shared.test.ts
  modified: []

key-decisions:
  - "The delegate type is Parameters<typeof makeSingleNameMarketplaceHandler>[2] and the scope row type is NonNullable<Parameters<MarketplaceRun>[0][\"scope\"]>; the exported SingleNameMarketplaceRun alias is deliberately not imported, so the suite is bound to the factory's own parameter list rather than to a name that could drift away from it"
  - "The closed-over-API case was strengthened past the plan's wording: it builds TWO boundaries with two distinct pi values instead of one, because a same-pi case is not discriminating. Measured first with a throwaway probe: strong-mock compares two distinct empty mock proxies as UNEQUAL, so the distinct-pi form fails if the factory ever ignored its own parameter"
  - "The scope-omission proof relies on strong-mock rejecting an extra key set to undefined. Measured with the same probe and then planted: an always-spread scope member reddens all three no-scope delegating cases"
  - "No exhaustiveness plant was attempted: marketplace/shared.ts has no switch and no closed-union dispatch, so a missing-arm plant has no target here (recorded per the plan's own must_have)"

patterns-established:
  - "Distinct-instance closure proof: to prove a factory closed over ITS OWN argument rather than a shared module value, give each factory call a different collaborator instance and state each delegate's expectation against its own; a same-instance case only repeats the delegation case"

requirements-completed: [MOD-09]

coverage:
  - deliverable: "tests/edge/handlers/marketplace/shared.test.ts owns every branch of edge/handlers/marketplace/shared.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/shared.test.ts"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts (branches 18/18, functions 5/5, lines 134/134)"
        status: pass
  - deliverable: "The WB-01 flag-before-positional ordering rule is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant A — the two steps swapped; the flag-before row reddened with source '--local' against 'official'"
        status: pass
  - deliverable: "The MSG-NC-2 collapse rule is proven discriminating in both exports"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant B — both collapse comparisons forced to always collapse; both verbatim-diagnostic cases reddened"
        status: pass
  - deliverable: "Every rejection path is proven to leave the run delegate uncalled"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant C — a delegate call added to the rejection branch; both rejection cases reddened with strong-mock's unexpected-call error"
        status: pass
  - deliverable: "The scope member is proven present only when a scope flag was supplied"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant D — conditional spread replaced by an unconditional scope member; all three no-scope delegating cases reddened"
        status: pass
  - deliverable: "The correspondence gate no longer names this pair"
    human_judgment: false
    verification:
      - kind: command
        ref: "node scripts/check-corresponding-tests.mjs — 12 violations before, 11 after"
        status: pass

duration: "~45 min"
completed: 2026-09-02
---

# Phase 116 Plan 12: Single-Name Marketplace Helper Owner Summary

`edge/handlers/marketplace/shared.ts` now has a mirrored owner that states the injected `run`
delegate's complete options object with exact arguments, proves every rejection leaves that
delegate untouched, and pins the WB-01 rule that makes the scope-target flag position-independent.

## What was built

`tests/edge/handlers/marketplace/shared.test.ts`, 326 lines, two top-level `describe()` blocks and
no nesting. Thirteen case bodies emit sixteen runtime cases. The suite passes alone at 100 percent
direct functions, lines, and branches for the paired source.

**`describe("makeSingleNameMarketplaceHandler")` — seven runtime cases from six bodies.**

| Case | What it pins |
| --- | --- |
| one positional | the delegate receives `{ ctx, cwd, name, pi }` with every member stated and no `scope` key |
| `--scope project` / `--scope user` (row table) | the same object plus `scope`; the only two cases where that key exists |
| no positional | one notification whose whole value is the collapsed sentence, a blank line, and the usage block; the delegate is never reached |
| a surplus positional | the single-positional schema ignores the extra token and the delegate is still called with the first one — the observed outcome, not an assumed rejection |
| an unrecognised `--scope` value | the diagnostic reaches the user verbatim rather than collapsed, and the delegate is never reached |
| two factory calls | each handler forwards the API **its own** factory call received |

**`describe("openMarketplaceCommand")` — nine runtime cases from seven bodies.**

| Case | What it pins |
| --- | --- |
| positional name `source` / `name` (row table) | the returned key is the caller-supplied name, not a hard-coded one |
| flag before / flag after the positional (row table) | one identical whole value — the WB-01 ordering proof |
| `--scope project`, no `--local` | `scope` carried through and `local: false` |
| the scope-target flag alone | one collapsed-sentence notification and `undefined` |
| an unknown long flag | one unknown-flag notification and `undefined` — this function's early return after a failed flag scan |
| a parse failure after a successful flag scan | one verbatim diagnostic and `undefined` |
| empty arguments | the collapsed sentence |

**The delegate double.** `mock<MarketplaceRun>({ exactParams: true, name: "marketplace run" })`,
created inside each case, one `when()` stating the complete options object with no wildcard matcher
and no unbounded count, and `verify(run)` as the last line after the result and notification
assertions. `MarketplaceRun` is `Parameters<typeof makeSingleNameMarketplaceHandler>[2]`, so a
change to the factory's third parameter is a compile error here rather than a stale hand-copy.

**The boundary.** `createNotificationBoundary` with an explicit `toolProbes` of 0 in every case,
because every path here reaches the user through `notifyUsageError`, which runs no
soft-dependency probe. Delegating cases state `cwd` as `{ reads: 1, value: "/work/project" }`;
rejecting cases omit the option entirely, so a `cwd` read on a rejection path would be unexpected.

## Plants

Four plants, all RED. Each was reverted and the revert confirmed with `git diff --quiet` before
the next one.

**Plant A — swap the two steps in `openMarketplaceCommand`** so `parseCommandArgs` runs on `args`
before `extractLocalFlag`. Predicted RED for the flag-before-positional row; that is what happened,
and the flag-after row stayed GREEN, which is exactly what makes the pair a discriminating ordering
proof.

```text
✖ parses the same command whether the scope-target flag comes before the positional (WB-01)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      local: true,
  +   source: '--local'
  -   source: 'official'
    }
```

The plant also reddened `rejects the scope-target flag on its own with the collapsed sentence`
(`actual { local: true, source: '--local' }` against `expected undefined`), because with the order
swapped the flag token itself satisfies the positional. Reddening more than predicted is not a
finding; the predicted row reddened for the predicted reason.

**Plant B — force both collapse comparisons to always collapse** (`message: "Missing required
argument."` in place of the `message === usage ? … : message` ternary in both exports). Both
verbatim-diagnostic cases reddened and nothing else did.

```text
✖ shows a parse diagnostic other than the usage string verbatim (MSG-NC-2)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: 'Missing required argument.\n' +
  -     message: 'Invalid --scope value: "global". Must be "user" or "project".\n' +
          '\n' +
          'Usage: /claude:plugin marketplace info <name> [--scope user|project]',
        severity: 'error'
      }
    ]
```

```text
✖ returns nothing and shows the parse diagnostic verbatim when the flag scan succeeded
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: 'Missing required argument.\n' +
  -     message: 'Invalid --scope value: "global". Must be "user" or "project".\n' +
          '\n' +
          'Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]',
        severity: 'error'
      }
    ]
```

**Plant C — call the delegate on the rejection path** (`await run({ ctx, pi, name: "", cwd:
"/work/project" });` added inside the `parsed === undefined` guard). Not named by the plan, run
because the never-called proof is exactly the class of claim that failed silently earlier in this
milestone: an expectation of zero calls is inert in `strong-mock`. Both rejection cases reddened,
which proves the no-expectation form does what the zero-count form only claims.

```text
✖ collapses the duplicated usage block to one sentence and never reaches the run collaborator (MSG-NC-2)
  Error: Didn't expect marketplace run({"ctx": [Function extension context], "cwd": "/work/project",
  "name": "", "pi": [Function extension API]}) to be called.

  No remaining expectations.
```

**Plant D — replace the conditional scope spread with an unconditional member**
(`scope: parsed.scope,`). Not named by the plan, run because "no `scope` key" is a claim about the
matcher's treatment of an extra key set to `undefined`, not about the code. All three no-scope
delegating cases reddened; the two scope rows stayed GREEN.

```text
✖ hands the run collaborator the context, the closed-over API, the name, and the working directory
  Error: Didn't expect marketplace run({"ctx": [Function extension context], "cwd": "/work/project",
  "name": "official", "pi": [Function extension API], "scope": undefined}) to be called.

  Remaining expectations:
  when(() => marketplace run({"ctx": [Function extension context], "cwd": "/work/project",
  "name": "official", "pi": [Function extension API]})).thenResolve(undefined).between(1, 1)
```

**No exhaustiveness plant.** `marketplace/shared.ts` holds no `switch` and no closed-union
dispatch, so D-116-14 has no target here. Recorded rather than attempted.

## Findings

**The plan's closed-over-API case as written would not have discriminated.** The plan says "two
handlers built from the same `pi` both forward that identical reference." With one `pi`, that case
is the first delegating case run twice — nothing about it can fail that the first case does not
already catch. The claim was strengthened rather than weakened: the case now builds two boundaries,
so the two factory calls receive two different API values, and each delegate states its own. That
form fails if the factory ever read a shared value instead of its parameter.

The strengthening rests on a measured fact, not an assumption. A throwaway probe (run once, deleted,
never committed) established that `strong-mock` compares two distinct empty mock proxies as
**unequal** — `Didn't expect port({"a": "1", "host": [Function host B]}) to be called` — and that an
extra key set to `undefined` also mismatches. Both facts are load-bearing: the first for the
closure case, the second for every "no scope member" assertion. Plant D then confirmed the second
one against the real module.

**No production change was needed and none was made.** `git diff --quiet` over the pair's own
source, all three `shared.ts` helpers, `flag-catalog.ts`, and `tests/helpers/notification-boundary.ts`
exits 0.

## Deviations from Plan

One, and it strengthens rather than weakens the proof: the closed-over-API case uses two distinct
`pi` values instead of the plan's single shared one. See Findings. Two plants beyond the two the
plan named (C and D) were run because both claims are non-obvious and one of them (the never-called
proof) is the exact shape that failed silently earlier in this milestone.

## Boundaries honored

- No production file changed; no symbol exported for a test; no coverage exception or ignore
  pragma added.
- `tests/helpers/notification-boundary.ts` untouched.
- Only `tests/edge/handlers/marketplace/shared.test.ts` was staged. The operator's modified and
  untracked files were not touched, reverted, or cleaned. No `git add -A` and no `git add .`.
- `pre-commit` was run manually with `--files` and only `trufflehog` and `npm-format-check` skipped;
  the secret scan ran instead by the filesystem route (`chunks: 2, bytes: 13928,
  verified_secrets: 0, unverified_secrets: 0`). Never `--no-verify`, never `--all-files`.
- No case restates what a gate already enforces: nothing asserts the absence of direct process
  output (ESLint and `fallow` own it), nothing re-proves the positional schema
  (`tests/edge/args-schema.test.ts`), and the one flag-scan case pins this function's own early
  return rather than `extractLocalFlag`'s behavior.

## Gates

Each run separately and its exit code checked. `npm run check` was not used.

| Gate | Result |
| --- | --- |
| `node --test tests/edge/handlers/marketplace/shared.test.ts` | 16 pass, 0 fail |
| `npm run test:coverage:direct -- …/marketplace/shared.ts` | passed — branches 18/18, functions 5/5, lines 134/134 |
| `npm run typecheck` | 0 |
| `npm exec -- eslint <file>` | 0 |
| `npm exec -- prettier --check <file>` | 0 |
| `npm run fallow` | 0 |
| anti-pattern scan (`! rg …`) | no match, negated link exits 0 |
| `rg -c '^\s+// arrange$'` | 13, equal to the 13 case bodies |
| `git diff --check` | clean |
| `git diff --quiet` over the five pinned files | 0 |
| `npm test` | 4901 pass, 0 fail, 276 suites |
| `npm run test:integration` | 31 pass, 0 fail |
| `node scripts/check-corresponding-tests.mjs` | 11 violations, down from 12 |

Branch numbers are recorded as an observation, not a pin: the lcov denominator is a property of
suite strength, not of the source.

## Issues Encountered

None.

## Next

Ready for the next plan in this phase. The marketplace handler owners that build on this helper
(116-07 `add`, 116-09 `info`, 116-11 `remove`) can now assert only the usage string and the
delegate they supplied, and restate none of the parsing proved here.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/shared.test.ts` exists on disk.
- `cf75489a` is in `git log` and adds exactly that one file, 326 insertions, no deletions.
