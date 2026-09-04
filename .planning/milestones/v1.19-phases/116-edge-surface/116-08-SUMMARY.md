---
phase: 116-edge-surface
plan: "08"
subsystem: testing
tags: [node-test, edge, marketplace, autoupdate, dual-form, group-c, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-01's args-schema owner, which owns the positional-schema contract this handler consumes"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the scope-target flag scan this handler calls"
provides:
  - "tests/edge/handlers/marketplace/autoupdate.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/autoupdate.ts, at 100 percent direct branches, functions, and lines"
  - "the phase normative Group-C (D-116-05 O3) no-seam negative-delegation case, written verbatim below for the nine wave-5 owners that copy it"
  - "the measured correction that the Group-C negative's PRIMARY trigger is module-specific: it fires on the emission count whenever the orchestrator wraps its own work in a catch that notifies, because the unstated-`cwd` failure is swallowed into a failure notification instead of escaping"
  - "the measured outcome that `marketplace/autoupdate.ts` ACCEPTS a scope flag beside the scope-target flag — the third `--local` outcome measured on a handler that calls `extractLocalFlag`, matching `marketplace/add.ts` and unlike `list.ts` (drops) and `update.ts` (takes as the name)"
  - "the measured outcome that a single OPTIONAL positional drops surplus tokens rather than rejecting them, so this handler has no out-of-range rejection above its accepted arity"
  - "the config-footprint observation shape: read both scopes' base and override config layers back as one whole value, which turns 'which scope, which layer' into a measurement rather than a re-derivation"
affects: []

actuals:
  tokens: 30000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED, both scopes seeded so a workflow that ran would have marketplaces to flip, plus an on-disk assertion that nothing was recorded"
    - "Delegating cases size the boundary at `(1, 2, { value: cwd, reads: 1 })` — one emission, two `getAllTools()` reads (one soft-dependency probe reading twice), one `cwd` read. All four counts were measured against the real module through a counting proxy before a line of the suite was written"
    - "Both scope roots are hand-authored: `<cwd>/.pi` for the project scope, and the user scope root pinned through `PI_CODING_AGENT_DIR` rather than left to the `homedir()` default. The footprint is read back from those paths, never from `locationsFor`, so the record-location claim is independent of the path the workflow computed"
    - "Delegation is observed through the declarative config (SPLIT-01 makes the config write-back the real flip; `classifyAutoupdateFlip` never writes state.json), read back as a four-member footprint compared as one whole value"
    - "The dual-form arms are driven as a row table wherever only the usage block or only the recorded flip separates them, so both `usageFor` arms and both workflow arms are exercised without duplicated bodies"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace/autoupdate.test.ts

key-decisions:
  - "FINDING for the nine wave-5 Group-C owners — the corrected mechanism needs a second correction. 116-10 measured that the phase's normative G5 excerpt was wrong (an orchestrator emission is not what fires; the workflow dies earlier reading an unstated `ctx.cwd` inside `locationsFor`). Measured here: that is ALSO not universal. `setMarketplaceAutoupdate` wraps `flipOneScope` in a try/catch, so the `ERR_INVALID_ARG_TYPE` from `path.join` is CAUGHT and routed to `notifyAutoupdateScopeFailure`, which then makes a SECOND `ctx.ui` access past `times(1)` and dies as `TypeError: ctx.ui.notify is not a function`. Plant A2a proves it: the failure surfaces at `orchestrators/marketplace/autoupdate.ts:499`, inside the catch, not at `locationsFor`. The durable rule is neither 'the emission count' nor 'the cwd read' — it is: THE NEGATIVE FIRES AT THE FIRST UNSTATED BOUNDARY MEMBER THE WORKFLOW REACHES AFTER WHATEVER ERROR HANDLING IT PERFORMS. Omitting `cwd` is still correct and still load-bearing (it is what makes the workflow fail at all before it can write anything), but a Group-C owner must not promise WHICH of the two diagnostics its plant will produce until it has run the plant"
  - "DEVIATION — the plan's `must_haves` truth 3 ('Each handler owner proves the accepted positional arity, one below it, and one above it … both out-of-range counts are rejected with a usage error before any orchestrator call') is FALSE against this module, for the third plan running. The schema is `[{ name: 'name', required: false }]` — ONE optional positional — so zero positionals is also an accepted arity and there is nothing below it, and `parseCommandArgs` iterates `schema.positional.entries()` (the SCHEMA, not the input), so the second token of `alpha beta` is never inspected. Measured: `alpha beta` flips `alpha` alone and leaves `beta` — a real seeded marketplace in the user scope — untouched, byte-identical to `alpha`. Written instead as a DROP proof, with Plant H (a surplus-positional rejection added to `parseCommandArgs`) confirming the row discriminates"
  - "DEVIATION — the plan's `must_haves` truth 4 ('mutually exclusive scope flags supplied together are rejected before any orchestrator call') is FALSE against this module. `--scope project --local` is ACCEPTED: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only the scope-target token, so BOTH members reach the workflow. Measured: the flip lands in `claude-plugins.local.json` under the project scope root and the base file is never created. Written as an acceptance case naming both selectors, with Plants E and F confirming each member is separately load-bearing. This is the third distinct `--local` outcome measured in this phase and the second acceptance, matching `marketplace/add.ts`"
  - "DEVIATION — the plan's Plant A as literally worded ('delete the early return that follows the flag-scan guard … confirm the normative negative case goes RED with an unexpected-call report from the boundary') does not exercise the boundary. Deleting the return makes `localFlag.residualArgs` a read off `undefined`, and the case goes RED on a plain `TypeError` before any boundary member is touched. Two further variants were run: A2a falls through to a real `setMarketplaceAutoupdate` call forwarding `ctx.cwd`, and A2b does the same with a literal working directory. Both are recorded verbatim; A2a and A2b are the load-bearing ones and they agree — this module's negative fires on the emission count"
  - "The rejecting cases assert an empty config footprint IN ADDITION to `verifyBoundary()`. The boundary proves the workflow could not complete; the footprint proves no state was recorded. D-116-06 asks for the first; the second costs one line and is the fact a user cares about"
  - "The two parse-rejection inputs (`--scope bogus` and `--scope --frobnicate`) are ONE marked body emitting two runtime cases, not two bodies. They share a branch and a diagnostic template; the second row's distinct fact is which of the handler's two rejection channels claims a `--`-prefixed token, and a row label carries that without a copy-pasted body. Neither row restates `tests/edge/handlers/shared.test.ts:114` or `:130` (the scan's pass-through and pair-consumption in isolation) — what is asserted here is the user-visible diagnostic the handler's scan-then-parse composition produces"
  - "The missing-`--scope`-value diagnostic (`--scope` with no operand) was NOT added. It enters the same callback and the same early return, adds no branch, and its diagnostic is owned by `tests/edge/args.test.ts:176`. 116-10 and 116-07 narrowed the same case for the same reason"
  - "The parse-rejection body runs on the enable arm alone rather than as a four-row arm × token table. `usageFor(enable)` is evaluated ONCE in the factory and closed over, so arm-to-usage-block selection is a single fact; the unknown-flag body already proves it on both arms, and Plant B (swapping the two usage strings) goes RED across all four rejecting cases"
  - "No offline/`fetch` guard was added. This plan states no network claim, `orchestrators/marketplace/autoupdate.ts` imports no git surface by construction, and adding an unrequested assertion would widen the owner past what it promises. 116-10 carried one because its plan required an NFR-5 offline proof for the listing"
  - "No D-116-01a claim. The pair reaches 100 percent — branches 15/15, functions 4/4, lines 61/61. The baseline read 13/14 branches; the denominator ROSE with the numerator exactly as the phase's V8 finding predicts, and nothing is uncovered. Nothing was filed in `.planning/WINDOWS.md`"
  - "No production file was touched. Eight plants were applied across `edge/handlers/marketplace/autoupdate.ts` and `edge/args-schema.ts` and reverted from byte copies taken before the first plant; `git diff --stat -- extensions/` was empty after the last revert, and the plan's pinned-path check exited 0 before staging"

patterns-established:
  - "A Group-C plan must not promise the DIAGNOSTIC its negative-delegation plant will produce. Three modules now give three different answers to the same plant — a raw `TypeError` on `undefined` (literal early-return deletion), `ERR_INVALID_ARG_TYPE` from `path.join` (list.ts, no catch), and `ctx.ui.notify is not a function` (autoupdate.ts, catch-and-notify). What is durable is the SIZING, not the stack trace"
  - "An orchestrator that catches its own failures and notifies converts every unstated-member failure into an emission-count failure. Read the orchestrator's error handling before predicting which boundary member the negative will trip"
  - "When the observable effect of a delegation is a file, read every candidate location back as ONE whole value with absent locations set to `undefined`. A footprint compared whole catches a write that landed in the wrong scope or the wrong layer; four separate existence assertions do not"
  - "Pin the user scope root through `PI_CODING_AGENT_DIR` rather than deleting it. Deleting it makes the case depend on `homedir()` and on the `.pi/agent` default; setting it makes both scope roots values the suite chose, which is what lets the record-location assertion be hand-authored"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/marketplace/autoupdate.test.ts owns edge/handlers/marketplace/autoupdate.ts, including the previously-uncovered parse-failure callback and the early return that follows it"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/autoupdate.test.ts — 14 runtime cases from 9 marked bodies, pass 14 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts → branches 15/15, functions 4/4, lines 61/61 (was 13/14, 3/4, 58/61)"
        status: pass
  - deliverable: "The D-116-06 negative: the autoupdate workflow is proven unreached on both rejection channels"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/autoupdate.test.ts#reports an unknown flag with the autoupdate usage block and never flips (D-116-06)"
        status: pass
      - kind: command
        ref: "Plant A2a/A2b — fall through to a real setMarketplaceAutoupdate call; both unknown-flag rows go RED with ctx.ui.notify is not a function"
        status: pass
      - kind: command
        ref: "Plant C — fall through on the parse-failure guard; both invalid-scope rows go RED the same way"
        status: pass
  - deliverable: "The two usage blocks are hand-authored literals selected by the factory boolean, not values read back off the module"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — swap the two arms of usageFor; all four rejecting cases go RED on the deepStrictEqual diff"
        status: pass
  - deliverable: "The name positional, the scope flag, and the scope-target flag are each present in the workflow options only when supplied"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D — delete the conditional name spread; 4 cases RED"
        status: pass
      - kind: command
        ref: "Plant E — delete the conditional scope spread; 3 cases RED"
        status: pass
      - kind: command
        ref: "Plant F — delete the conditional local spread; 3 cases RED, the footprint moving from the override layer to the base layer"
        status: pass
  - deliverable: "The factory boolean reaches the workflow, and the two arms leave opposite recorded states for the same input"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant G — forward !enable; all 10 delegating cases RED"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/marketplace/autoupdate.test.ts#records the autoupdate/noautoupdate outcome for a marketplace already declared with autoupdate on"
        status: pass
  - deliverable: "A surplus positional token is dropped rather than rejected, and the first name alone is flipped"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant H — add a surplus-positional rejection to parseCommandArgs; the surplus case goes RED"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over autoupdate.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 40 min
completed: 2026-09-02
---

# Phase 116 Plan 08: Marketplace Autoupdate Owner Summary

The dual-form autoupdate shim now has one exhaustive owner at 100 percent direct coverage, and it
carries the phase normative no-seam negative-delegation case — with a second measured correction to
the mechanism that case actually relies on.

## What was built

`tests/edge/handlers/marketplace/autoupdate.test.ts` was rewritten from eight loose cases built on a
hand-rolled context cast into fourteen runtime cases from nine marked bodies, all on the shared
strict boundary.

| Marked body | Args | Arms | Boundary sizing | Proves |
|-------------|------|------|-----------------|--------|
| unknown flag | `--frobnicate` | both | `(1, 0)`, **no `cwd`** | the normative D-116-06 negative; the factory boolean selects the usage block |
| invalid scope value | `--scope bogus`, `--scope --frobnicate` | enable | `(1, 0)`, **no `cwd`** | the parse-failure callback and its early return (the uncovered region); which channel claims a `--`-prefixed token |
| bare form | `""` | enable | `(1, 2, {cwd, reads: 1})` | accepted arity zero; an omitted scope enumerates both scopes |
| named form | `alpha` | enable | same | the name reaches the workflow and narrows the flip to it |
| surplus positional | `alpha beta` | enable | same | the surplus token is DROPPED; `beta` stays unflipped |
| already declared on | `alpha --scope project` | both | same | the boolean reaches the workflow: opposite recorded states for one input |
| scope narrowing | `--scope project`, `--scope user` | enable | same | the scope member is present only when supplied, observed by record location |
| scope-target position | `--local alpha`, `alpha --local` | enable | same | position independence; the flip lands in the override layer |
| both selectors | `--scope project --local` | enable | same | a scope flag beside the scope-target flag is ACCEPTED and both are honored |

Direct coverage moved from branches 13/14, functions 3/4, lines 58/61 to **15/15, 4/4, 61/61**.

Delegation is observed as the **config footprint** — both scopes' `claude-plugins.json` and
`claude-plugins.local.json`, read back as one four-member value with absent files set to `undefined`.
SPLIT-01 makes that config write-back the real flip: `classifyAutoupdateFlip` is classify-only and a
flip never rewrites `state.json`, so the config is the only durable record a delegation leaves.

## The normative no-seam negative-delegation case (copy this shape)

Recorded verbatim for the nine wave-5 Group-C owners:

```ts
for (const { enable, expectedMessage, subcommand } of [
  {
    enable: true,
    subcommand: "autoupdate",
    expectedMessage:
      'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]',
  },
  {
    enable: false,
    subcommand: "noautoupdate",
    expectedMessage:
      'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]',
  },
]) {
  test(`reports an unknown flag with the ${subcommand} usage block and never flips (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `unknown-flag-${subcommand}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const autoupdateHandler = makeAutoupdateHandler(pi, enable);

    // act
    await autoupdateHandler("--frobnicate", ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readConfigFootprint(workspace), NOTHING_RECORDED);
    verifyBoundary();
  });
}
```

Five properties are load-bearing, and each was planted:

1. **`createNotificationBoundary(1, 0)`** — one emission, ZERO probes. `notifyUsageError` writes
   straight to the notification channel and runs no soft-dependency probe.
2. **The `cwd` parameter is OMITTED.** This is what makes the workflow fail before it can write
   anything, whatever diagnostic it then produces.
3. **Both scopes are seeded**, so a workflow that did run would have marketplaces to flip and files
   to write. An unseeded tree weakens the negative to "the empty-state sentinel did not appear".
4. **The whole notification list is compared**, with both usage blocks written out by hand — never
   interpolated from a constant read off the module.
5. **`verifyBoundary()` is called last**, and the on-disk footprint is asserted empty beside it.

### The mechanism correction, corrected again

116-10 measured that the phase's original G5 excerpt named the wrong mechanism: the workflow does not
survive to make a second `ctx.ui` access, because `listMarketplaces` reads `opts.cwd` inside
`locationsFor` on its first line and dies in `path.join`. That is true of `list.ts`. It is **not**
true here.

`setMarketplaceAutoupdate` wraps `flipOneScope` in a try/catch. The `ERR_INVALID_ARG_TYPE` that the
unstated `cwd` produces is **caught** and routed to `notifyAutoupdateScopeFailure`, which then makes
the second `ctx.ui` access and dies there instead. Plant A2a shows the failure landing at
`orchestrators/marketplace/autoupdate.ts:499` — inside the catch — not at `locationsFor`.

So the durable statement is neither "the emission count" nor "the `cwd` read":

> **The Group-C negative fires at the first unstated boundary member the workflow reaches AFTER
> whatever error handling it performs.** An orchestrator with no catch dies at its first `cwd` read;
> an orchestrator that catches and notifies converts that same failure into an emission-count
> failure. Omitting `cwd` is still correct and still load-bearing. Which diagnostic appears is a
> property of the orchestrator, and no Group-C plan may promise it before running its plant.

## Plants (D-116-04)

Eight plants, all RED, all reverted. Production is byte-identical to HEAD.

### Plant A1 — delete the early return after the flag-scan guard (the plan's literal wording)

```text
✖ reports an unknown flag with the autoupdate usage block and never flips (D-116-06) (33.150851ms)
  TypeError: Cannot read properties of undefined (reading 'residualArgs')
      at .../edge/handlers/marketplace/autoupdate.ts:35:17
      at TestContext.<anonymous> (.../tests/edge/handlers/marketplace/autoupdate.test.ts:211:11)
```

RED on both arms, but for the wrong reason: `localFlag` is `undefined`, so `localFlag.residualArgs`
dereferences it before any boundary member is touched. This proves the return is load-bearing; it
does not prove the boundary catches a workflow run.

### Plant A2a — fall through to a real workflow call forwarding `ctx.cwd` (the mechanism)

```ts
    if (localFlag === undefined) {
      await setMarketplaceAutoupdate({ ctx, pi, cwd: ctx.cwd, enable });
      return;
    }
```

```text
✖ reports an unknown flag with the autoupdate usage block and never flips (D-116-06) (33.830329ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3660:12)
      at emitCascadeWith (.../shared/notify.ts:3850:3)
      at emitContextCascade (.../shared/notify.ts:3869:3)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at notifyAutoupdateScopeFailure (.../orchestrators/marketplace/autoupdate.ts:225:3)
      at setMarketplaceAutoupdate (.../orchestrators/marketplace/autoupdate.ts:499:9)
      at async .../edge/handlers/marketplace/autoupdate.ts:34:7
```

Line 499 is inside the orchestrator's `catch`. The unstated-`cwd` failure was caught and converted
into a failure notification, which is the access that trips the boundary. This is the finding above.

### Plant A2b — the same fall-through with a literal working directory

```ts
    if (localFlag === undefined) {
      await setMarketplaceAutoupdate({ ctx, pi, cwd: "/tmp/plant-a2b-cwd", enable });
      return;
    }
```

```text
✖ reports an unknown flag with the autoupdate usage block and never flips (D-116-06) (93.357485ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at emitCascadeWith (.../shared/notify.ts:3850:3)
      at emitContextCascade (.../shared/notify.ts:3869:3)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at setMarketplaceAutoupdate (.../orchestrators/marketplace/autoupdate.ts:602:3)
      at async .../edge/handlers/marketplace/autoupdate.ts:34:7
```

Line 602 is the orchestrator's own final `notifyWithContext` — the workflow ran to completion and its
success notification is what the boundary refused. The emission-count mechanism, cleanly.

### Plant C — fall through on the parse-failure guard (the newly-covered region)

```text
✖ reports an ordinary token in the scope-value position as an invalid scope and never flips (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at setMarketplaceAutoupdate (.../orchestrators/marketplace/autoupdate.ts:602:3)
```

Both invalid-scope rows RED.

### Plant B — swap the two arms of `usageFor`

```text
✖ reports an unknown flag with the autoupdate usage block and never flips (D-116-06) (31.286443ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
        message: 'Unknown flag: "--frobnicate".\n' +
          '\n' +
  +       'Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]',
  -       'Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]',
        severity: 'error'
      }
    ]
```

All four rejecting cases RED.

### Plant D — delete the conditional `name` spread

```text
✖ flips only the marketplace the name positional selects (18.794436ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: '● alpha [project] <autoupdate>\n\n● beta [user] <autoupdate>'
  -     message: '● alpha [project] <autoupdate>'
      }
    ]
```

4 cases RED (named form, surplus positional, both scope-target positions).

### Plant E — delete the conditional `scope` spread

```text
✖ flips the project scope alone when --scope project is supplied (18.153753ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: '● alpha [project] <autoupdate>\n\n● beta [user] <autoupdate>'
  -     message: '● alpha [project] <autoupdate>'
      }
    ]
```

3 cases RED (both scope rows, both selectors).

### Plant F — delete the conditional `local` spread

```text
✖ records the flip in the override layer when the scope-target flag appears before the name positional
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
  +   projectBase: {
  -   projectBase: undefined,
  -   projectLocal: {
        marketplaces: { alpha: { autoupdate: true, source: './alpha-src' } }
      },
  +   projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined
    }
```

3 cases RED, and the failure is exactly the record moving from the override layer to the base layer —
which is what makes the footprint a location proof rather than an existence proof.

### Plant G — forward `!enable` to the workflow

```text
    actual: [ { message: '● alpha [project] <no autoupdate> {already no autoupdate}\n\n● beta [user] <no autoupdate> {already no autoupdate}' } ],
    expected: [ { message: '● alpha [project] <autoupdate>\n\n● beta [user] <autoupdate>' } ],
```

All 10 delegating cases RED.

### Plant H — reject surplus positionals inside `parseCommandArgs`

```text
✖ drops a surplus positional token and flips only the first name (12.411434ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]\n' +
  +       '\n' +
  +       'Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]',
  +     severity: 'error'
  -     message: '● alpha [project] <autoupdate>'
      }
    ]
```

This is what makes the drop row discriminating rather than decorative.

## Deviations from Plan

### 1. [Rule 1 — false plan claim] `must_haves` truth 3: a single optional positional drops surplus tokens

- **Found during:** Task 1, reading `edge/args-schema.ts` before writing a line.
- **Issue:** The truth promises "the accepted positional arity, one below it, and one above it …
  both out-of-range counts are rejected with a usage error". The schema is one OPTIONAL positional,
  so zero is also an accepted arity and there is nothing below it; and `parseCommandArgs` walks
  `schema.positional.entries()`, so the second token is never inspected.
- **Fix:** Wrote the surplus row as a DROP proof, and planted a rejection (Plant H) to show it
  discriminates.
- **Verification:** Measured before writing — `alpha beta` emits `● alpha [project] <autoupdate>`
  and writes only alpha's entry, byte-identical to `alpha`, leaving the seeded user-scope `beta`
  unflipped.
- **Commit:** `88dc753e`

### 2. [Rule 1 — false plan claim] `must_haves` truth 4: both scope selectors together are ACCEPTED

- **Found during:** Task 1.
- **Issue:** The truth promises that mutually exclusive scope selectors supplied together are
  rejected before any orchestrator call. `extractLocalFlag` consumes `--scope <value>` as a
  downstream-owned pair and filters only the scope-target token, so both members survive.
- **Fix:** Wrote an acceptance case naming both selectors and asserting the record location, with
  Plants E and F showing each member is separately load-bearing.
- **Verification:** `--scope project --local` writes `claude-plugins.local.json` under the project
  scope root and never creates the base file.
- **Commit:** `88dc753e`

### 3. [Rule 1 — plan plant produces the wrong diagnostic] Plant A needed two further variants

- **Found during:** Task 1, plant phase.
- **Issue:** The plan predicted "an unexpected-call report from the boundary". The literal plant
  produces a plain `TypeError` on `undefined`, before the boundary is consulted.
- **Fix:** Ran A2a and A2b, which reach the workflow with a valid options bag. Both are recorded
  verbatim, and together they produced the mechanism correction above.
- **Verification:** All three variants RED; production reverted and `git diff --stat -- extensions/`
  empty.
- **Commit:** `88dc753e`

### 4. [Scope narrowing] Two specified cases folded, one omitted

- **Found during:** Task 1, case selection.
- **Issue:** The plan lists "the boolean selects the usage block" as its own case, but the
  unknown-flag body already drives both arms and both blocks. The plan also asks for the
  parse-rejection case on both arms, which would restate a fact `usageFor` establishes once. The
  missing-`--scope`-value diagnostic is owned by `tests/edge/args.test.ts:176`.
- **Fix:** Folded the usage-block selection into the unknown-flag row table, ran the parse-rejection
  body on the enable arm alone, and omitted the missing-value diagnostic. Plant B covers all four
  rejecting cases, so nothing is left unproven.
- **Commit:** `88dc753e`

**Total deviations:** 4 (2 false `must_haves` truths corrected, 1 plant strengthened into two
variants, 1 set of cases narrowed). **Impact:** the owner asserts only what the module can falsify.
No claim was weakened to go green; two claims were replaced with the measured behaviors and both got
a plant.

## Scoped gap (D-116-05, O3, Group C)

`setMarketplaceAutoupdate` is reached by direct import with no injection point, so this owner cannot
state an exact argument list against it. Delegation is observed as one minimal effect — the
declarative config each scope root carries after the command. This exact-argument gap is recorded in
the plan's `must_haves` truth 6 and is **scoped, not missed**. The negative half of D-116-06 is
proven in full, on both rejection channels, with three plants.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/marketplace/autoupdate.test.ts` | tests 14, pass 14, fail 0 |
| `npm run test:coverage:direct -- .../marketplace/autoupdate.ts` | branches 15/15, functions 4/4, lines 61/61 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 5053/5053 across 291 suites, exit 0 |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 9 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 2, bytes 19828, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0 |

## Note to the nine wave-5 Group-C owners

1. Copy the sizing, not the stack trace. `createNotificationBoundary(1, 0)` with `cwd` OMITTED, both
   scopes seeded, whole-value notification comparison, `verifyBoundary()` last.
2. Read your orchestrator's error handling before you predict your plant's diagnostic. A catch that
   notifies turns the `cwd` trigger into an emission-count trigger.
3. Do not carry a `--local` claim across handlers. Four measured, four different: `list.ts` drops it,
   `update.ts` takes it as the marketplace name, `add.ts` and `autoupdate.ts` accept it beside
   `--scope`.
4. Check your positional schema's arity before writing an out-of-range rejection case. An empty
   schema (116-10) and a single optional positional (here) both DROP surplus tokens.
5. Add the on-disk negative beside `verifyBoundary()` where your workflow writes something. It costs
   one line and it is the fact a user cares about.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 116-09 (marketplace info), then 116-11 and 116-05 to close wave 4. The normative Group-C
shape and the twice-corrected negative mechanism are the reusable output for the nine wave-5 owners.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/autoupdate.test.ts` exists on disk.
- `git log --oneline --all | grep 88dc753e` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
