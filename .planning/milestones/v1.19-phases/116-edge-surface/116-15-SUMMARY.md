---
phase: 116-edge-surface
plan: "15"
subsystem: testing
tags: [node-test, edge, plugin, enable-disable, dual-form, group-c, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C shape: boundary sized at one emission and zero probes with `cwd` omitted, both scopes seeded, whole-value comparison, `verifyBoundary()` last, plus an on-disk negative"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the `<plugin>@<marketplace>` reference parse this handler calls"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the scope-target flag scan this handler calls"
provides:
  - "tests/edge/handlers/plugin/enable-disable.test.ts — the sole mirrored direct owner for edge/handlers/plugin/enable-disable.ts, at 100 percent direct branches, functions, and lines"
  - "the measured FIFTH and SIXTH diagnostic sites for the Group-C negative, both inside orchestrators/plugin/enable-disable.ts: the RESOLUTION catch at :610 when `ctx.cwd` is forwarded, and dispatchOutcome at :785/:1048 with a literal working directory"
  - "the measured outcome that a single REQUIRED positional splits the arity truth: zero IS rejected, and a surplus token is still silently DROPPED"
  - "the SEVENTH distinct `--local` outcome in this phase: `--scope user --local` is ACCEPTED and both selectors are honoured — the scope names the record, the scope-target flag names the config layer"
  - "the derived-context technique for reaching a defense-in-depth catch without hand-rolling any Pi member: a Proxy over the shared boundary that throws on the single `cwd` read, leaving `verifyBoundary()` in charge of the emission"
  - "the measured boundary counts for a handler that emits through BOTH paths: four tool probes when delegating (the orchestrator's context cascade runs two probes), two on the handler's own `notify()` failure conversion, zero on a rejection"
affects: []

actuals:
  tokens: 7100
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED, both scopes seeded with two installed plugin records each, plus an on-disk assertion that the whole footprint is unchanged"
    - "Delegating cases size the boundary at `(1, 4, { value: cwd, reads: 1 })`. The FOUR is measured, not inherited: the orchestrator emits through `notifyWithContext`, whose context cascade runs TWO soft-dependency probes and each probe reads `getAllTools()` twice. The handler's own failure conversion calls `notify()` directly and states `(1, 2)`"
    - "A defense-in-depth catch is reached through a `Proxy` over the boundary's own context that throws on the single `cwd` read. Every other member still resolves through `createNotificationBoundary`, so no Pi member is hand-rolled, there is no cast, and `verifyBoundary()` still governs the emission"
    - "Delegation is observed as a six-member footprint compared as one whole value: the enabled flag each scope's `state.json` carries for BOTH seeded plugins, plus both scopes' base and override config layers with absent files set to `undefined`"
    - "The dual-form arms are driven as a four-row table over {arm x seeded enabled state}, so each arm is proven once as a REAL flip and once as an idempotent no-op, and the pair leaves opposite recorded states for one input"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/enable-disable.test.ts

key-decisions:
  - "DEVIATION — the plan's `must_haves` truth 3 ('the accepted positional arity, one below it, and one above it … both out-of-range counts are rejected with a usage error') is HALF false against this module, and the half that fails is the OPPOSITE of the one that failed for the optional-positional siblings. `parseRequiredPluginMarketplaceRef` declares `[{ name: 'ref' }]` with `required` defaulting to true, so ZERO positionals IS rejected — the lower half HOLDS, unlike 116-08 and 116-10 — while `parseCommandArgs` still iterates `schema.positional.entries()`, so the second token of `alpha@mp beta@mp` is never inspected. Measured: the surplus form flips `alpha` alone and leaves the seeded `beta` untouched, byte-identical to `alpha@mp`. Written as a DROP proof, with Plant J (a surplus-positional rejection added to `parseCommandArgs`) confirming the row discriminates"
  - "DEVIATION — the plan's `must_haves` truth 4 ('mutually exclusive scope flags supplied together are rejected before any orchestrator call') is FALSE against this module. `--scope user --local` is ACCEPTED: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only the scope-target token, so BOTH members reach the workflow and BOTH are honoured — the scope selects which scope's record flips, the scope-target flag selects the config LAYER the declaration lands in. This is the seventh distinct `--local` outcome measured in this phase and the fourth acceptance. Written as the WR-02 position-independence row table, which names both selectors, with Plants F and G showing each member is separately load-bearing"
  - "The two branches uncovered at HEAD were the `?? \"user\"` scope default (line 66) and the non-Error arm of the cause normalization (line 67), read off the LCOV BRDA rows rather than guessed. Both live inside the handler's defense-in-depth catch, so both need a throw escaping `setPluginEnabled` — and the orchestrator catches its own resolution throw AND its own transaction throw, so nothing the filesystem can do reaches that catch. The plan's suggestion (seed an unreadable state) was measured NOT to work for that reason. The only route through the module's exports is a caller-supplied `ctx` whose `cwd` read throws"
  - "The throwing `cwd` is delivered by a `Proxy` over the boundary's own `ctx`, not by a hand-rolled context and not by `strong-mock`. `thenThrow` normalizes its argument through `getError`, which wraps a string and returns a bare `new Error()` for anything else, so it CANNOT produce the non-Error throw line 67 needs. `Object.create` would work but returns `any` and needs an assertion; the `Proxy` form is typed end to end, needs no cast, and lints clean under `strictTypeChecked`"
  - "NO D-116-01a claim is filed. Both previously-uncovered branches are reachable through the exports and are now covered, so neither is an unreachable-branch shortfall. Direct coverage reads branches 17/17, functions 3/3, lines 87/87 — the denominator ROSE from 16 to 17 with the numerator, exactly as the phase's V8 finding predicts, and nothing regressed"
  - "Delegating cases do NOT assert the notification body. The plan's action text forbids re-deriving the workflow's outcome, which `tests/orchestrators/plugin/enable-disable.test.ts` owns at full direct coverage; the boundary's `times(1)` on `ctx.ui` and on `ui.notify` already bounds the emission to exactly one, and the footprint carries the fact a user cares about. Rejecting and failure-conversion cases DO assert the whole notification, because the handler authors those payloads itself"
  - "A `fetch` replacement that throws is installed per case through `t.mock.method`, and every delegating case asserts its call count is zero. This is not a restatement of `tests/architecture/no-orchestrator-network.test.ts`, whose FORBIDDEN_TARGETS list does not name `orchestrators/plugin/enable-disable.ts`; the enable arm runs the real install ledger end to end here, and the guard is what proves that path stayed offline"
  - "`roadmap.update-plan-progress` was NOT run. Every prior plan in this phase reported that it mangles ROADMAP.md, so the checkbox and BOTH counts (the `**Plans**:` prose line and the progress-table row) were edited by hand; the diff is three lines and `grep -c '^- \\[x\\] \\*\\*116-'` reads 22. `state.advance-plan`, `state.update-progress` and `state.record-metric` were likewise not run — STATE.md was hand-edited so the Current Position keeps NAMING the completed plans and `completed_plans` moves 196 → 197 exactly once"
  - "The `actuals.tokens` figure is `chars/4` over the realized changed file (28,100 chars), the scale the executor instruction names. Sibling summaries in this phase reported a harness-consumption figure near the plan estimate instead, so the two are NOT on the same scale and must not be averaged"
  - "No production file was touched. Eleven plants were applied across `edge/handlers/plugin/enable-disable.ts`, `orchestrators/plugin/shared.ts` and `edge/args-schema.ts` and reverted from byte copies taken before the first plant; `git diff --stat -- extensions/` was empty afterwards and the plan's pinned-path check exited 0 before staging"

patterns-established:
  - "A Group-C owner whose orchestrator catches BOTH its resolution throw and its transaction throw cannot reach its own defense-in-depth catch through the filesystem. Check the orchestrator's catch coverage before planning a 'seed a state the workflow cannot read' case; the only remaining route is a context whose member read throws"
  - "`strong-mock`'s `thenThrow` cannot produce a non-Error throw. `getError` returns the argument only when it is already an `Error`, wraps a string, and otherwise returns a bare `new Error()`. A branch that discriminates `err instanceof Error` needs a different mechanism"
  - "When a factory boolean can only flip a record one way per fixture, drive {arm x seeded state} as a four-row table. Each arm then appears once as a real flip and once as an idempotent no-op, and a negated-boolean plant turns all four rows red — a two-row table on one fixture proves the same thing with one arm never doing real work"
  - "A row table whose rows share an expectation is not automatically one case run twice. Find the plant that separates them: here the `--scope project` row and the scope-omitted row are byte-identical against this fixture, and Plant C (swapping the unqualified project-then-user preference) turns ONLY the omitted row red"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/enable-disable.test.ts owns edge/handlers/plugin/enable-disable.ts, including the two branches uncovered at HEAD"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/enable-disable.test.ts — 17 runtime cases from 9 marked bodies, pass 17 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../plugin/enable-disable.ts → branches 17/17, functions 3/3, lines 87/87 (was 14/16, 3/3, 87/87)"
        status: pass
  - deliverable: "The D-116-06 negative: the enable-disable workflow is proven unreached on every rejection channel"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/enable-disable.test.ts#reports an unknown flag with the enable usage block and records nothing (D-116-06)"
        status: pass
      - kind: command
        ref: "Plant H1 — fall through to a real setPluginEnabled call forwarding ctx.cwd; both unknown-flag rows RED with ctx.ui.notify is not a function at orchestrators/plugin/enable-disable.ts:610"
        status: pass
      - kind: command
        ref: "Plant H2 — the same fall-through with a literal working directory; both rows RED at dispatchOutcome, orchestrators/plugin/enable-disable.ts:1048 via :785"
        status: pass
  - deliverable: "Both factory arms are proven: the boolean selects the usage block AND reaches the workflow, leaving opposite recorded states for one input"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant I — swap the two arms of usageFor; all 5 rejecting rows RED on the deepStrictEqual diff"
        status: pass
      - kind: command
        ref: "Plant E — forward !enable; all 9 delegating rows RED"
        status: pass
  - deliverable: "The scope flag, the scope-target flag, and the ordering rule are each present-only-when-supplied and position-independent"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A — parse the reference before the flag scan; the flag-before-reference row RED (the override layer never written)"
        status: pass
      - kind: command
        ref: "Plant F — delete the conditional scope spread; 5 rows RED, the record moving from the user scope to the project scope"
        status: pass
      - kind: command
        ref: "Plant G — delete the conditional scope-target spread; both WR-02 rows RED, the declaration moving from the override layer to the base layer"
        status: pass
      - kind: command
        ref: "Plant C — swap the unqualified project-then-user preference; only the scope-omitted row RED"
        status: pass
  - deliverable: "The failure conversion carries the parsed marketplace, the parsed plugin, error severity, the unreadable reason, the cause, and the user scope default"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/enable-disable.test.ts#converts a throw escaping the workflow into one failed row naming the user scope when no scope flag was supplied (IL-2)"
        status: pass
      - kind: command
        ref: "Plant B — change the scope default from user to project; both default-scope rows RED, the supplied-scope row green"
        status: pass
      - kind: command
        ref: "Plant D — replace new Error(errorMessage(err)) with a literal; only the non-Error row RED"
        status: pass
  - deliverable: "A surplus reference token is dropped rather than rejected, and only the first one is flipped"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant J — add a surplus-positional rejection to parseCommandArgs; the surplus row RED"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over enable-disable.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 40 min
completed: 2026-09-02
---

# Phase 116 Plan 15: Plugin Enable/Disable Owner Summary

The dual-form plugin enable/disable shim now has one exhaustive owner at 100 percent direct
coverage, and it reaches the handler's defense-in-depth catch without hand-rolling a single Pi
member.

## What was built

`tests/edge/handlers/plugin/enable-disable.test.ts` was rewritten from ten loose cases built on a
hand-rolled context cast into **seventeen runtime cases from nine marked bodies**, all on the shared
strict boundary.

| Marked body | Args | Arms | Boundary sizing | Proves |
|-------------|------|------|-----------------|--------|
| unknown flag | `alpha@mp --frobnicate` | both | `(1, 0)`, **no `cwd`** | the D-116-06 negative; the factory boolean selects the usage block |
| missing positional | `""` | enable | `(1, 0)`, **no `cwd`** | one below the accepted arity IS rejected, with the collapsed sentence |
| malformed reference | `no-at-sign` | disable | `(1, 0)`, **no `cwd`** | the offending token is named verbatim |
| invalid scope value | `--scope bogus` | enable | `(1, 0)`, **no `cwd`** | the parse-failure channel, on the arm the other rejections do not use |
| arm x seeded state | `alpha@mp --scope user` | both x2 | `(1, 4, {cwd, reads: 1})` | the accepted arity; each arm once as a REAL flip and once idempotent; opposite recorded states |
| surplus positional | `alpha@mp beta@mp --scope user` | disable | same | the surplus token is DROPPED; the seeded `beta` stays enabled |
| scope selection | `alpha@mp --scope project`, `alpha@mp` | disable | same | the flag names the record; an omitted scope prefers the project record |
| scope-target position | `--local alpha@mp --scope user`, `alpha@mp --scope user --local` | disable | same | position independence; both selectors honoured; the override layer |
| failure conversion | `alpha@mp --scope project`, `alpha@mp` x2 | both | `(1, 2)`, **throwing `cwd`** | the failed row, the user scope default, the non-Error normalization |

Direct coverage moved from branches **14/16** to **17/17**, functions 3/3, lines 87/87.

## Which parser this module calls, checked before any arity or flag claim

`makeEnableDisableHandler` calls `extractLocalFlag` **directly**, then
`parseRequiredPluginMarketplaceRef`, which calls **`parseCommandArgs`** with
`positional: [{ name: "ref" }]` — `required` defaults to `true`. That single fact decided all three
inherited questions, and it answers them in a NEW combination:

| Question | This module | The six marketplace siblings | The two `parseArgs` handlers |
|---|---|---|---|
| Zero positionals | **REJECTED** (`Missing required argument.`) | accepted (optional/empty schema) | no arity below zero |
| Surplus positional | **DROPPED** | dropped | rejected |
| `--scope X --local` | **ACCEPTED, both honoured** | four different answers | ordinary positional token |

So the arity `must_haves` truth fails on its **surplus** half only — the reverse of the
optional-positional siblings, where the lower half failed too.

## The Group-C negative, and two more diagnostic sites

The negative fires exactly as 116-08 specified — one emission, zero probes, `cwd` OMITTED, both
scopes seeded, whole-value notification comparison, `verifyBoundary()` last, plus an on-disk
footprint assertion. What it produced is a **fifth and sixth** diagnostic site for the phase, and
neither matches any sibling:

- **Forwarding `ctx.cwd`** dies at `orchestrators/plugin/enable-disable.ts:610` — inside
  `setPluginEnabled`'s **resolution** catch, which routes the `ERR_INVALID_ARG_TYPE` to
  `emitResolutionFailure` and makes the second `ctx.ui` access there. No sibling landed in a
  resolution catch; `autoupdate.ts` landed in a TRANSACTION catch.
- **A literal working directory** runs the workflow to completion and dies at `dispatchOutcome`
  (`:1048` / `:1056`, reached from `:785`) — the orchestrator's own success notification is what the
  boundary refuses.

The rule the handoff carries holds: omitting `cwd` is the constant, the diagnostic is a property of
the orchestrator's error handling. Neither output was promised before the plant was run.

## Reaching the defense-in-depth catch

The two branches uncovered at HEAD were read off the LCOV `BRDA` rows, not guessed:

```text
BRDA:66,14,0,0    // the `parsed.scope ?? "user"` fallback
BRDA:67,15,0,0    // the non-Error side of `err instanceof Error ? err : new Error(errorMessage(err))`
```

Both live in the handler's `catch`. That catch is defense-in-depth: `setPluginEnabled` wraps its
resolution in one try/catch and its whole transaction in another, so **no filesystem state can
reach it** — the plan's "seed a state the workflow cannot read" suggestion was measured not to
work. The only route through the module's exports is a `ctx` whose `cwd` read throws.

`strong-mock` cannot supply it: `thenThrow` runs its argument through `getError`, which returns an
`Error` unchanged, wraps a `string`, and returns a bare `new Error()` for everything else — so line
67's non-Error arm is out of reach that way. The owner therefore uses a `Proxy` over the boundary's
own context:

```ts
function withUnreadableCwd(
  ctx: ExtensionCommandContext,
  failure: unknown,
): ExtensionCommandContext {
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        throw failure;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
```

Every other member still resolves through `createNotificationBoundary`, there is no cast, it
type-checks and lints clean under `strictTypeChecked`, and `verifyBoundary()` still governs the
emission.

## Measured boundary counts

All four counts were taken against the real module through a counting proxy before a line of the
suite was written, because this handler emits through **both** notification paths:

| Path | `ctx.ui` | `ctx.cwd` | `pi.getAllTools()` | Sizing |
|---|---|---|---|---|
| rejection (`notifyUsageError`) | 1 | 0 | 0 | `(1, 0)` |
| delegation (orchestrator `notifyWithContext`) | 1 | 1 | **4** | `(1, 4, {cwd, reads: 1})` |
| failure conversion (handler `notify()`) | 1 | 1 (throws) | **2** | `(1, 2)` |

The FOUR is the finding worth carrying: the phase's helper documents "one probe per emission, two
reads per probe", which predicts 2. The orchestrator's context cascade runs **two** probes, so a
delegating case that inherited the documented default would have failed naming the probe instead of
the mistake.

## Plants (D-116-04)

Eleven plants across three production files. Ten RED, one GREEN-by-design. All reverted;
`git diff --stat -- extensions/` empty afterwards.

### Plant A — parse the reference before the flag scan (the plan's named ordering plant)

```text
✖ honours the scope flag and writes the override layer with the scope-target flag before the plugin reference (WR-02)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
      userBase: undefined,
  +   userLocal: undefined,
  -   userLocal: {
  -     marketplaces: { mp: { source: './mp-src' } },
  -     plugins: { 'alpha@mp': { enabled: false } },
  -     schemaVersion: 1
  -   },
```

Exactly the flag-BEFORE row RED; the flag-after row stays green, which is what makes the pair an
ordering proof rather than a restatement.

### Plant B — change the failure-row scope default from user to project (the plan's second named plant)

```text
✖ converts a throw escaping the workflow into one failed row naming the user scope when no scope flag was supplied (IL-2)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
        message: 'A plugin operation has failed.\n' +
          '\n' +
  +       '● mp [project]\n' +
  -       '● mp [user]\n' +
          '  ⊘ alpha (failed) {unreadable}\n' +
          '    cause: state directory is unreadable',
        severity: 'error'
      }
    ]
```

Both default-scope rows RED; the supplied-scope row green.

### Plant C — swap the unqualified project-then-user preference

```text
✖ flips the project record when no scope flag is supplied (SCOPE-01)
  + projectBase: undefined,
  + projectRecords: { alpha: true, beta: true },
  + userBase: { marketplaces: { mp: { source: './mp-src' } } ... }
  - projectBase: { ... }
```

Only the scope-omitted row RED; the `--scope project` row green. This is what separates two rows
whose expectation is byte-identical against this fixture.

### Plant D — replace `new Error(errorMessage(err))` with a literal

```text
✖ converts a throw escaping the workflow into one failed row naming the user scope when the escaping throw carried no error object (IL-2)
  + '    cause: unknown failure',
  - '    cause: state directory is unreadable',
```

Only the non-Error row RED, so the third failure row is not the second one run twice.

### Plant E — forward `!enable` to the workflow

```text
✖ disable flips an enabled record and declares the flip in the base config (ENBL-02)
  + userBase: undefined,
  - userBase: { plugins: { 'alpha@mp': { enabled: false } }, ... }
```

All **9** delegating rows RED, the four arm-x-state rows included. This is the proof that the
boolean reaches the workflow rather than only selecting a usage block.

### Plant F — delete the conditional `scope` spread

```text
✖ disable flips an enabled record and declares the flip in the base config (ENBL-02)
  + projectBase: { marketplaces: { mp: { source: './mp-src' } } ... },
  - projectBase: undefined,
  - userBase: { ... }
```

5 rows RED, and the failure is exactly the record moving from the user scope to the project scope.

**GREEN-by-design observation:** the two idempotent rows of the arm-x-state table stayed green under
Plant F. With the scope member gone, `--scope user` resolves to the project record — which is
seeded at the same enabled state, so nothing moves either way and the footprint is unchanged. The
scope claim is carried by the FLIPPING rows; the idempotent rows carry the arm claim (Plant E turns
them red) and nothing else. Recorded rather than papered over.

### Plant G — delete the conditional scope-target spread

```text
✖ honours the scope flag and writes the override layer with the scope-target flag before the plugin reference (WR-02)
  + userBase: { marketplaces: { mp: { source: './mp-src' } } ... },
  - userBase: undefined,
  - userLocal: { ... }
  + userLocal: undefined,
```

Both WR-02 rows RED, and the failure is the declaration moving from the override layer to the base
layer — which makes the footprint a location proof rather than an existence proof, and makes
"supplied versus omitted" a measurement (the omitted form is the arm-x-state table's first row,
which lands in `userBase`).

### Plant H1 — negative fall-through forwarding `ctx.cwd`

```ts
    const localFlag = extractLocalFlag(args, ctx, usage);
    if (localFlag === undefined) {
      await setPluginEnabled({ ctx, pi, cwd: ctx.cwd, marketplace: "mp", plugin: "alpha", enable });
      return;
    }
```

```text
✖ reports an unknown flag with the enable usage block and records nothing (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3660:12)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at emitEnableDisableFailedRow (.../orchestrators/plugin/enable-disable.ts:876:5)
      at emitResolutionFailure (.../orchestrators/plugin/enable-disable.ts:839:3)
      at setPluginEnabled (.../orchestrators/plugin/enable-disable.ts:610:12)
      at async .../edge/handlers/plugin/enable-disable.ts:40:7
```

Line 610 is the **resolution** catch — a site no sibling has produced.

### Plant H2 — the same fall-through with a literal working directory

```text
✖ reports an unknown flag with the enable usage block and records nothing (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at dispatchOutcome (.../orchestrators/plugin/enable-disable.ts:1048:5)
      at setPluginEnabled (.../orchestrators/plugin/enable-disable.ts:785:3)
      at async .../edge/handlers/plugin/enable-disable.ts:40:7
```

The workflow ran to completion and its own notification is what the boundary refused.

### Plant I — swap the two arms of `usageFor` (the verb-swap plant)

```text
✖ reports an unknown flag with the enable usage block and records nothing (D-116-06)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
        message: 'Unknown flag: "--frobnicate".\n' +
          '\n' +
  +       'Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]',
  -       'Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]',
        severity: 'error'
      }
```

All **5** rejecting rows RED, on both arms. A case that claims to distinguish the two verbs does.

### Plant J — reject surplus positionals inside `parseCommandArgs`

```text
✖ drops a surplus reference token and flips only the first one (ENBL-01)
  + userBase: undefined,
  - userBase: { plugins: { 'alpha@mp': { enabled: false } }, ... }
```

This is what makes the drop row discriminating rather than decorative.

## Deviations from Plan

### 1. [Rule 1 — half-false plan claim] `must_haves` truth 3: a REQUIRED positional rejects zero and still drops the surplus

- **Found during:** Task 1, reading `edge/args-schema.ts` and
  `edge/handlers/plugin/shared.ts` before writing a line.
- **Issue:** The truth promises both out-of-range counts are rejected. The schema declares ONE
  positional with `required` defaulting to true, so the LOWER half holds here — unlike every
  optional-positional sibling — while `parseCommandArgs` still walks `schema.positional.entries()`,
  so the surplus token is never inspected.
- **Fix:** Kept the missing-positional rejection case as specified, and wrote the surplus case as a
  DROP proof with a second seeded plugin (`beta@mp`) whose enabled flag makes the drop visible.
  Plant J shows the row discriminates.
- **Verification:** Measured before writing — `alpha@mp beta@mp --scope user` disables `alpha` and
  leaves the seeded `beta` enabled, byte-identical to `alpha@mp --scope user`.
- **Commit:** `52a4aec5`

### 2. [Rule 1 — false plan claim] `must_haves` truth 4: both scope selectors together are ACCEPTED and both are honoured

- **Found during:** Task 1.
- **Issue:** The truth promises that mutually exclusive scope selectors supplied together are
  rejected before any orchestrator call. `extractLocalFlag` consumes `--scope <value>` as a
  downstream-owned pair and filters only the scope-target token, so both members survive.
- **Fix:** Wrote the WR-02 position row table with `--scope user --local` in both orders, asserting
  the user record flips AND the declaration lands in `claude-plugins.local.json`. Plants F and G
  show each selector is separately load-bearing.
- **Verification:** `--scope user --local` writes `claude-plugins.local.json` under the user scope
  root and never creates that scope's base file.
- **Commit:** `52a4aec5`

### 3. [Rule 3 — the plan's stated route to the branch does not exist] The failure conversion cannot be driven from disk

- **Found during:** Task 1, reading `orchestrators/plugin/enable-disable.ts`.
- **Issue:** The plan says to "drive the workflow to throw — seed a state the workflow cannot read,
  or make the state file unreadable in the hermetic tree". `setPluginEnabled` catches its own
  resolution throw (`:609`) and its own transaction throw (`:748`), so a corrupt or unreadable
  `state.json` becomes a notification, never an escaping throw. The handler's catch is unreachable
  from disk.
- **Fix:** Reached it through the module's exports instead, with a `Proxy` over the boundary's own
  context that throws on the single `cwd` read. `strong-mock`'s `thenThrow` was measured unable to
  carry the non-Error value line 67 needs.
- **Verification:** All three failure rows pass; Plants B and D each turn a distinct subset red.
- **Commit:** `52a4aec5`

### 4. [Scope narrowing] Three specified case shapes folded or narrowed

- **Found during:** Task 1, case selection.
- **Issue:** The plan lists "the boolean also selects the usage block" as its own case, but the
  unknown-flag body already drives both arms and both blocks. It asks for "each scope value
  supplied, as a row table, and scope omitted", but the `--scope user` value is the arm-x-state
  table's own argument, so repeating it would be one case run twice. It asks for the scope-target
  flag "supplied and omitted", but the omitted form is that same table's first row.
- **Fix:** Folded the usage-block selection into the unknown-flag row table; ran the scope table on
  the two values the arm table does not use (`--scope project` and omitted); made the supplied
  versus omitted scope-target comparison run against the arm table's first row. Plants I, C and G
  cover the three folded claims, so nothing is left unproven.
- **Commit:** `52a4aec5`

**Total deviations:** 4 (2 false or half-false `must_haves` truths corrected, 1 plan-stated route
measured not to exist, 1 set of cases folded). **Impact:** the owner asserts only what the module
can falsify. No claim was weakened to go green.

## Scoped gap (D-116-05, O3, Group C)

`setPluginEnabled` is reached by direct import with no injection point, so this owner cannot state
an exact argument list against it. Delegation is observed as one minimal effect — the enabled flag
each scope's `state.json` carries after the command, plus the declaration the write-back leaves in
that scope's base or override config layer. This exact-argument gap is recorded in the plan's
`must_haves` truth 6 and is **scoped, not missed**. The negative half of D-116-06 is proven in full,
on every rejection channel, with three plants.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/enable-disable.test.ts` | tests 17, pass 17, fail 0 |
| `npm run test:coverage:direct -- .../plugin/enable-disable.ts` | branches 17/17, functions 3/3, lines 87/87 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | **5061/5061 across 291 suites**, exit 0 (read from the runner's `ℹ tests` line) |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 9 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 3, bytes 28100, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0, every applicable hook Passed |

## Note to the seven remaining Group-C owners

1. Read the LCOV `BRDA` rows for your source before choosing cases. Two branches at 100 percent
   lines are conditional spreads and defaults, and the rows name them in one command.
2. Check whether your orchestrator catches its OWN throws before planning a "drive it to throw"
   case. Two catches here make the handler's defense-in-depth catch unreachable from disk.
3. `strong-mock` cannot throw a non-Error. If a branch discriminates `err instanceof Error`, a
   `Proxy` over the boundary's context is the cast-free way to supply one.
4. Measure your probe count. This module needs FOUR on the delegating path, not the two the helper's
   documentation predicts, because the orchestrator's context cascade runs two probes.
5. Drive a dual-form factory as {arm x seeded state}, not {arm}. Otherwise one arm never does real
   work.

## Issues Encountered

None.

## Next Phase Readiness

Ready for the next wave-5 owner. 116-16, 116-18, 116-19, 116-20, 116-21, 116-22, 116-24 and 116-25
remain, then 116-28. **116-21 is still the outstanding D-116-01a claimant and must pin
`plugin/pending.ts:39`.**

## Self-Check: PASSED

- `tests/edge/handlers/plugin/enable-disable.test.ts` exists on disk.
- `git log --oneline --all | grep 52a4aec5` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
