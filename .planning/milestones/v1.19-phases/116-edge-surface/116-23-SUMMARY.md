---
phase: 116-edge-surface
plan: "23"
subsystem: testing
tags: [node-test, strong-mock, edge, plugin, exact-argument, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's pinned tests/helpers/notification-boundary.ts, consumed with an explicit toolProbes of 0 at every call site"
  - phase: 116-edge-surface
    provides: "116-12's settled G3 helper-owner shape and its two measured strong-mock facts (distinct empty proxies compare unequal; an extra key set to undefined mismatches)"
provides:
  - "tests/edge/handlers/plugin/shared.test.ts — the sole mirrored direct owner for edge/handlers/plugin/shared.ts, closing one of the phase's correspondence-gate violations (11 -> 10)"
  - "The delegation contract the nine plugin handler owners build on: they assert only the usage string, the arguments they supplied, and that the parsed result reached the next stage"
affects:
  [116-13, 116-14, 116-15, 116-16, 116-18, 116-19, 116-20, 116-21, 116-22, 116-24, 116-25]

actuals:
  tokens: 6200
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "G3 helper owner: one top-level describe() per exported entrypoint, no nesting, module-local type aliases derived from the module's own signature"
    - "Generic-seam derivation: PreludeRun<P> = Parameters<typeof withParsedArgs<P>>[2] binds the delegate double to the generic export's own parameter list at a chosen instantiation, so both the delegate shape and the context type track the seam"
    - "Never-called proof by absence of expectation: a strong-mock with nothing stated throws on its first call, so a green case is the proof"
    - "Position independence by identical whole value: three rows differing only in flag position share one hand-authored expected object"

key-files:
  created:
    - tests/edge/handlers/plugin/shared.test.ts
  modified: []

key-decisions:
  - "The delegate type is Parameters<typeof withParsedArgs<PluginMarketplaceRef>>[2], an instantiation-expression type query. It pins the delegate's parsed-value parameter AND its context parameter to the generic export's own signature; the bare Parameters<typeof withParsedArgs>[2] would have collapsed P to unknown and lost the exact-argument match in when()"
  - "The recognised downstream flag names are hand-authored literals (--map-model, --partial), not read from passThroughFlagNames(). The plan asked for catalog-driven names, but the module derives its own set from the same call, so a catalog-driven input would be tautological: it could not fail if the module named the wrong verbs. Hand-authored literals discriminate the union-of-install-and-update wiring; the catalog's per-verb contents stay owned by tests/edge/flag-catalog.test.ts and the drift guard"
  - "The non-Error throw case was kept rather than skipped. It is not a restatement of errorMessage(): it discriminates this module's choice of the tolerant formatter, because a withParsedArgs that read err.message directly would keep the Error case green and redden only this one"
  - "No exhaustiveness plant was attempted: plugin/shared.ts holds no switch and no closed-union dispatch, so D-116-14 has no target here (recorded per the plan's own must_have)"

patterns-established:
  - "Instantiation-expression seam derivation for a generic export: Parameters<typeof genericFn<Chosen>>[N] gives a double whose type is the production seam at the instantiation the case exercises, so widening or reordering the generic's parameters is a compile error in the suite"

requirements-completed: [MOD-09]

coverage:
  - deliverable: "tests/edge/handlers/plugin/shared.test.ts owns every branch of edge/handlers/plugin/shared.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/shared.test.ts"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts (branches 32/32, functions 7/7, lines 201/201)"
        status: pass
  - deliverable: "The interior-separator rule in splitPluginMarketplaceRef is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant A — the guard loosened from atIdx <= 0 to atIdx < 0; both leading-separator cases reddened"
        status: pass
  - deliverable: "The D-65-05 flag-before-rejection ordering in the private scanner is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant B — the unknown-flag rejection moved ahead of the membership test; all six recognised-flag cases reddened"
        status: pass
  - deliverable: "The prelude is proven to leave the run delegate uncalled on a parse throw"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant C — a delegate call added to the catch arm; both parse-failure cases reddened with strong-mock's unexpected-call error"
        status: pass
  - deliverable: "The scope member is proven present only when a scope flag was supplied, in both exports"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant D — both conditional scope spreads replaced by unconditional members; ten no-scope cases reddened"
        status: pass
  - deliverable: "The MSG-NC-2 collapse rule is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant E — the collapse comparison forced to always collapse; exactly the verbatim-diagnostic case reddened"
        status: pass
  - deliverable: "The correspondence gate no longer names this pair"
    human_judgment: false
    verification:
      - kind: command
        ref: "node scripts/check-corresponding-tests.mjs — 11 violations before, 10 after"
        status: pass

duration: "~50 min"
completed: 2026-09-02
---

# Phase 116 Plan 23: Plugin Argument Helper Owner Summary

`edge/handlers/plugin/shared.ts` now has a mirrored owner covering all four runtime exports, with
the injected `run` delegate stated by exact arguments, every rejection proven to leave that delegate
untouched, and the module-private positional scanner reached only through `parseMapModelArgs`.

## What was built

`tests/edge/handlers/plugin/shared.test.ts`, 502 lines, four top-level `describe()` blocks and no
nesting. Twenty-one case bodies emit thirty-three runtime cases. The suite passes alone at 100
percent direct functions, lines, and branches for the paired source.

**`describe("splitPluginMarketplaceRef")` — seven runtime cases from three bodies.**

| Case | What it pins |
| --- | --- |
| one interior separator | both halves returned as one whole object |
| `alpha@official@mirror` | the split takes the **first** separator, so every later one stays in the marketplace half |
| five rejection rows | no separator, a leading separator, a trailing separator, the separator alone, and the empty string each yield `undefined` |

**`describe("parseMapModelArgs")` — twelve runtime cases from seven bodies.**

| Case | What it pins |
| --- | --- |
| neither downstream flag | the whole value with both booleans false and **no** `scope` key |
| three flag rows | each downstream flag alone and both together set only their own member |
| three placement rows | a flag before, between, and after the positionals yields one identical whole value |
| two scope rows | a supplied scope reaches the result; the no-scope cases above prove the key is absent, not `undefined` |
| no token at all | an empty positional list with both booleans false |
| an unrecognised long flag | one notification carrying the unknown-flag sentence, a blank line, and the usage block — the only route to the private scanner's rejection arm |
| an invalid scope value plus an unknown flag | one notification carrying the **tokenizer's** diagnostic, not the unknown-flag sentence, so the positional scan is proven not to have run |

**`describe("parseRequiredPluginMarketplaceRef")` — nine runtime cases from six bodies.**

| Case | What it pins |
| --- | --- |
| the accepted arity of one ref | the whole `{ marketplace, plugin }`, no `scope` key |
| two scope rows | the same object plus `scope` |
| one below the arity (no positional) | one notification with the collapsed missing-argument sentence, and `undefined` |
| one above the arity (two positionals) | the observed outcome: the single-positional schema takes the first token and the delegate result is still returned — not an assumed rejection |
| three malformed-ref rows | one notification whose sentence names the offending token verbatim, and `undefined` |
| a diagnostic that is not the usage string | reaches the user verbatim rather than collapsed — the discriminating case for the collapse rule |

**`describe("withParsedArgs")` — five runtime cases from five bodies.**

| Case | What it pins |
| --- | --- |
| a successful parse | the delegate is called exactly once with the parsed value and the context; the boundary recorded zero notifications |
| a `parse` that echoes its input | the delegate receives what `parse` returned from the **raw** argument string |
| `parse` throws an `Error` | one notification with the error's own message and the usage block; the delegate is never called |
| `parse` throws a non-`Error` | the same, through the value's string form |
| the delegate rejects | the rejection reaches the caller by identity rather than being swallowed |

**The delegate double.** `mock<PreludeRun<PluginMarketplaceRef>>({ exactParams: true, name:
"plugin run" })`, created inside each case, one `when()` stating the complete call with no wildcard
matcher and no unbounded count, and `verify(run)` as the last line after the result and
notification assertions.

**The boundary.** `createNotificationBoundary` with an explicit `toolProbes` of 0 everywhere,
because every user-visible path in this module reaches the user through `notifyUsageError`, which
runs no soft-dependency probe. No case states `cwd`: nothing in this module reads it, so any read
would be unexpected.

## Plants

Five plants, all RED. Each was reverted and the revert confirmed with `git diff --quiet` before the
next one. The plan named two; three more were run because each covers a claim whose failure mode
has already shipped silently in this milestone.

**Plant A — loosen the interior-separator guard** (`atIdx < 0` in place of `atIdx <= 0`). Predicted
RED for the leading-separator rejection row; that row reddened, and so did the malformed-ref row
that drives the same shape through `parseRequiredPluginMarketplaceRef`.

```text
✖ rejects a ref with a leading separator (3.209114ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + {
  +   marketplace: 'official',
  +   plugin: ''
  + }
  - undefined
✖ names the offending token when the ref carries a leading separator (PI-1) (1.264657ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + {
  +   marketplace: 'official',
  +   plugin: ''
  + }
  - undefined
```

**Plant B — move the unknown-flag rejection ahead of the membership test** in
`parsePositionalsWithFlags`, which is the D-65-05 violation the source comment warns about. All six
recognised-flag cases reddened; the tokenizer-throw case correctly stayed GREEN, because that path
never reaches the scanner.

```text
test at tests/edge/handlers/plugin/shared.test.ts:138:5
✖ sets only the members named by the model-mapping flag on its own (1.151931ms)
  TypeError: ctx.ui.notify is not a function
      at notifyUsageError (…/shared/notify.ts:326:10)
      at parsePositionalsWithFlags (…/edge/handlers/plugin/shared.ts:71:7)
      at parseMapModelArgs (…/edge/handlers/plugin/shared.ts:120:19)
      at TestContext.<anonymous> (…/tests/edge/handlers/plugin/shared.test.ts:143:22)
```

The predicted RED arrived, but not with the predicted **text**: the plan expected the cases to fail
against the unknown-flag sentence. They cannot, because a case that promises silence sizes the
boundary at zero emissions, so `ctx.ui` is never stated and the first unwanted emission dies on the
pending-call proxy instead. That is the over-read failure shape wave 1 measured, not a suite defect:
the claim is proven, only the diagnostic is the proxy-death form. Recorded rather than "fixed" —
stating `ctx.ui` to get a prettier message would weaken the silence proof.

**Plant C — call the delegate on the parse-failure path** (`await run(undefined as P, ctx);` added
inside the `catch`). Not named by the plan, run because a never-called claim is the exact shape that
failed silently earlier in this milestone. Both parse-failure cases reddened with the named
unexpected-call error, which is what proves the no-expectation form does its job.

```text
✖ reports a parse failure with the usage block and never reaches the run delegate (MSG-NC-2)
  Error: Didn't expect plugin run(undefined, [Function extension context]) to be called.

  No remaining expectations.
```

**Plant D — replace both conditional scope spreads with unconditional members** (`scope:
parsed.scope,` in `parseMapModelArgs` and `parseRequiredPluginMarketplaceRef`). Not named by the
plan, run because "no `scope` key" is a claim about the matcher's treatment of an extra key set to
`undefined`, not about the code. Ten no-scope cases reddened across both exports; the four scope
rows stayed GREEN.

```text
✖ reports both downstream flags off and omits the scope member when none is supplied (4.138942ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
      mapModel: false,
      nonFlagPositionals: [
      partial: false,
  +   scope: undefined
    actual: { nonFlagPositionals: [ 'alpha@official' ], mapModel: false, partial: false, scope: undefined },
    expected: { mapModel: false, nonFlagPositionals: [ 'alpha@official' ], partial: false },
```

**Plant E — force the collapse comparison to always collapse** (`const head = "Missing required
argument.";` in place of the `message === usage ? … : message` ternary). Exactly one case reddened,
which is what makes the collapse rule a two-sided proof rather than a single-sided one.

```text
✖ shows a parse diagnostic other than the usage string verbatim (MSG-NC-2) (2.966779ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: 'Missing required argument.\n' +
  -     message: 'Invalid --scope value: "global". Must be "user" or "project".\n' +
          '\n' +
          'Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]',
        severity: 'error'
      }
    ]
```

**No exhaustiveness plant.** `plugin/shared.ts` holds no `switch` and no closed-union dispatch, so
D-116-14 has no target here. Recorded rather than attempted.

**One claim proven by reasoning rather than a plant.** "The positional scan did not run after a
tokenizer throw" has no small violation available: the scan consumes `parsed.positional`, which only
exists once `parseArgs` has returned, so making the scan run first is a rewrite of the function
rather than a planted defect. The case is still failing-capable, and by two independent routes: its
boundary is sized at one emission, so a second notification dies on the proxy, and its asserted
notification list is the scope diagnostic, so a swallowed tokenizer error surfacing the unknown-flag
sentence instead would mismatch. Plant B demonstrated the first of those two failure shapes against
the real module.

## Findings

**The plan's catalog-driven flag input would not have discriminated.** The plan asks that the flag
names be driven from `passThroughFlagNames("install")` / `("update")` rather than restated. The
module builds `DOWNSTREAM_BOOLEAN_FLAGS` from those same two calls, so a case that feeds the result
back in is tautological — it stays green whichever verbs the module names, and even if the catalog
itself were wrong. The claim was strengthened rather than weakened: the cases state `--map-model`
and `--partial` as hand-authored literals, which fails if the module ever unions the wrong verbs,
drops one, or lets a recognised flag fall through to the unknown-flag arm. The catalog's per-verb
contents remain owned by `tests/edge/flag-catalog.test.ts` and the drift guard, and no case here
asserts them.

**A bare `Parameters<typeof withParsedArgs>[2]` would have silently widened the proof.**
`withParsedArgs` is generic, and the uninstantiated type query collapses `P` to `unknown`, which
would have left the delegate's first parameter unconstrained and the `when()` match structural
rather than typed. The suite uses the instantiation-expression form
`Parameters<typeof withParsedArgs<PluginMarketplaceRef>>[2]`, so both the parsed-value parameter and
the context parameter track the production seam.

**No production change was needed and none was made.** `git diff --quiet` over the pair's own
source, all three `shared.ts` helpers, `flag-catalog.ts`, and
`tests/helpers/notification-boundary.ts` exits 0.

## Deviations from Plan

One substantive, and it strengthens rather than weakens the proof: the downstream flag names are
hand-authored literals instead of catalog-derived inputs. See Findings.

Three plants beyond the two the plan named (C, D, E) were run because each covers a claim that
cannot be read off the code: a delegate that must stay untouched, an absent optional key, and a
one-sided collapse rule.

The non-`Error` throw case was written rather than skipped. The plan allowed skipping it if the
supplied `parse` could not throw a non-`Error` in practice; `parse` is injected by the case, so it
can, and the case discriminates this module's use of the tolerant error formatter.

## Boundaries honored

- No production file changed; no symbol exported for a test; no coverage exception or ignore pragma
  added. The module-private positional scanner is reached only through `parseMapModelArgs`.
- `tests/helpers/notification-boundary.ts` untouched.
- Only `tests/edge/handlers/plugin/shared.test.ts` was staged. The operator's modified and untracked
  files were not touched, reverted, or cleaned. No `git add -A` and no `git add .`.
- `pre-commit` was run manually with `--files` and only `trufflehog` and `npm-format-check` skipped;
  the secret scan ran instead by the filesystem route (`chunks: 2, bytes: 20229, verified_secrets:
  0, unverified_secrets: 0`). Never `--no-verify`, never `--all-files`.
- No case restates what a gate already enforces: nothing asserts the absence of direct process
  output (ESLint and `fallow` own it), nothing re-proves the tokenizer
  (`tests/edge/args.test.ts`) or the positional schema (`tests/edge/args-schema.test.ts`), and no
  case re-pins the catalog's per-verb flag sets.

## Gates

Each run separately and its exit code checked. `npm run check` was not used.

| Gate | Result |
| --- | --- |
| `node --test tests/edge/handlers/plugin/shared.test.ts` | 33 pass, 0 fail |
| `npm run test:coverage:direct -- …/plugin/shared.ts` | passed — branches 32/32, functions 7/7, lines 201/201 |
| `npm run typecheck` | 0 |
| `npm exec -- eslint <file>` | 0 |
| `npm exec -- prettier --check <file>` | 0 |
| `npm run fallow` | 0 |
| anti-pattern scan (`! rg …`) | no match, negated link exits 0 |
| `rg -c '^\s+// arrange$'` | 21, equal to the 21 case bodies |
| `git diff --check` | clean |
| `git diff --quiet` over the five pinned files | 0 |
| `npm test` | 4934 pass, 0 fail, 280 suites |
| `npm run test:integration` | 31 pass, 0 fail |
| `node scripts/check-corresponding-tests.mjs` | 10 violations, down from 11 |

Branch numbers are recorded as an observation, not a pin: the lcov denominator is a property of
suite strength, not of the source.

## Issues Encountered

None blocking. One expectation-versus-observation gap is recorded under Plant B: the plan predicted
a failure message that a zero-emission boundary structurally cannot produce.

## Next

Ready for the next plan in this phase. The eleven plugin handler owners that parse through this
helper can now assert only the usage string they supplied, the arguments they forwarded, and that
the parsed result reached the next stage, and restate none of the splitting, flag scanning, or
prelude behavior proved here.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/shared.test.ts` exists on disk.
- `3a48bc39` is in `git log` and adds exactly that one file, 502 insertions, no deletions.
