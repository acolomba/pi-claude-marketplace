---
phase: 116-edge-surface
plan: "25"
subsystem: testing
tags: [node-test, edge, plugin, update, group-c, target-forms, flag-matrix, footprint, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C no-seam negative-delegation shape"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the shared map-model parse and the reference split this handler calls"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the shared unknown-flag rule this handler's first rejection delegates to"
  - phase: 116-edge-surface
    provides: "116-06's `edge/flag-catalog.ts` owner, which owns the per-verb flag sets and exports the scope-target flag constant"
provides:
  - "tests/edge/handlers/plugin/update.test.ts — the sole mirrored direct owner for edge/handlers/plugin/update.ts, at 100 percent direct functions, lines AND branches"
  - "a NINTH parser/arity/flag combination: `extractLocalFlag` then `parseMapModelArgs` plus an own `> 1` guard — zero ACCEPTED (it is the all form), surplus REJECTED"
  - "a FIFTEENTH distinct `--local` outcome: ACCEPTED, invisible in the notification, VISIBLE in the config layer — the middle answer between 116-22 and 116-24, and the discriminator is the write-back, not the flag"
  - "the sixth acceptance of mutually exclusive scope selectors, so that inherited truth is again FALSE"
  - "a NEW Group-C diagnostic family: on a two-scanner handler, falling through the FIRST rejection lands in the SECOND scanner's rejection, never in the workflow"
  - "a measured finding that an OMITTED selector can produce a THIRD outcome, which is what turns 'absent, not present-and-default' into a measurement rather than a restatement"
  - "a THIRD SC-4 shape measured twice over: the git door is genuinely in this orchestrator's import graph and still unreachable through the handler"

affects: []

actuals:
  tokens: 9600
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A cross product is owned by making each cell exclude something the other cells include. The three target forms run against a fixture where the all form updates five records across two scopes and two marketplaces, the marketplace form updates two, and the plugin form updates one — so a form that collapsed into another is visible rather than merely unproven"
    - "An omitted selector is worth checking for a THIRD outcome before writing its row. Where the omitted form enumerates BOTH scopes and each explicit value enumerates one, the omitted row is a measurement; where it is identical to one supplied value, it is half a tautology"
    - "On a handler that runs two rejection channels in sequence, plant EACH guard separately. Only the second guard's plant reaches the orchestrator; the first guard's plant proves the two channels are independent"
    - "Boundary sizing per row, MEASURED through a counting context before a line was written: a rejection is `(1, 0)` with NO stated `cwd`, every delegating case is `(1, 4, {cwd, reads: 1})` — including the two rows the candidate gate refuses, which spend the same four probes"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/update.test.ts

key-decisions:
  - "MEASURED — a NINTH parser/arity/flag combination: `extractLocalFlag`, then `parseMapModelArgs`, then the handler's own `nonFlagPositionals.length > 1` guard. TWO and THREE references are rejected with `Too many arguments.`; ZERO is ACCEPTED because it IS the all form, so nothing lies below the accepted arity and the lower half of the arity truth has NO TARGET. The `must_haves` arity truth is therefore half false for a SEVENTEENTH consecutive plan, and the suite says so in its header rather than inventing a rejection case that cannot exist"
  - "MEASURED — `--local` is ACCEPTED, the FIFTEENTH distinct outcome in this phase and the SIXTH acceptance. The emission is BYTE-IDENTICAL with and without it; the sole observable difference is that the update's config write-back creates the declaration in `claude-plugins.local.json` instead of `claude-plugins.json`. This is 116-22's config-layer shape and NOT 116-24's footprint-invisible one, and the discriminator is the WRITE-BACK: `maybeWritePluginConfigBack` (`orchestrators/plugin/shared.ts:1049-1079`) targets ONE layer chosen by the flag, where `uninstall`'s success path sweeps BOTH layers unconditionally. Read the write-back, not the flag"
  - "MEASURED — the inherited truth 'mutually exclusive scope flags supplied together are rejected before any orchestrator call' is FALSE against this module, the SIXTH acceptance in the phase. `--scope user one@alpha --local` honours BOTH selectors: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only the scope-target token, so the scope narrows the target to the user root while the flag moves the declaration to that root's override layer. One case proves both, because a dropped scope and a dropped flag fail in two visibly different places"
  - "MEASURED — an OMITTED scope flag is NOT a default here, which is what made the plan's 'assert the identical outcome' family falsifiable rather than tautological. `enumerateTargets` (`orchestrators/plugin/update.ts:3017-3019`) walks `explicitScope === undefined ? [\"project\", \"user\"] : [explicitScope]`, so the omitted form produces a THIRD footprint neither explicit value can. Plant D (delete the scope conditional spread) turned BOTH scope rows RED plus the both-selectors case, where 116-24's equivalent plant left one row GREEN because project is what its unqualified form already resolves to"
  - "MEASURED — the Group-C negative fires, and BOTH the scope AND the working-directory forwarding discriminate it: 116-19's rule on one axis and the mirror of 116-22 on the other. From ONE plant (delete the too-many-arguments guard) three outcomes. Unstated cwd, no scope token: `A plugin operation has failed. … ⊘ one (failed) {unreadable manifest} cause: The \"path\" argument must be of type string. Received function` — CAUGHT by the orchestrator, so the emission count stays at ONE and only the whole-value message comparison catches it (116-20's warning reproduced on a different module). Unstated cwd, `--scope user`: `locationsFor` never calls `path.join`, the update COMPLETES and reports `● one v1.0.0 → v3.0.0 (updated)`. STATED cwd, no scope token: completes the same way against the project source at v2.0.0. `--scope project` reproduces the failed variant"
  - "MEASURED — a NEW Group-C diagnostic family for this phase. Deleting the early return after the FIRST scan does NOT reach the workflow at all: the token is re-rejected by the SECOND scanner, so the plant fires as `TypeError: ctx.ui.notify is not a function` at `shared/notify.ts:326` via `parsePositionalsWithFlags` (`edge/handlers/plugin/shared.ts:76`). It is still a second `ctx.ui` access past `times(1)`, but from a sibling rejection channel rather than from the orchestrator. Only the SECOND guard's plant reaches `updatePlugins`, where it lands at `notify.ts:3660` via `notifyBareFormEnumerateFailure` / `handleEnumerateFailure`"
  - "MEASURED — SC-4 has a THIRD shape here and it was measured twice over. `orchestrators/plugin/update.ts` IS the one documented git-operations exemption, so the transport door is genuinely in its import graph, yet no input through the HANDLER opens it. A `url`-source marketplace left the counter at ZERO because `makeSyncCloneOnce` (`update.ts:293-298`) no-ops for every non-`github` source kind; a `github`-source marketplace left it at ZERO because `refreshGitHubClone` fails on the absent clone (`Could not find HEAD.`) before reaching the transport. The `https.request` zero is kept in all 22 cases, folded into the same whole-value comparison, and LABELLED an NFR-5 and hermeticity regression guard with neither a positive control nor a reachable input; an out-of-suite control confirmed the door is instrumented (a direct `https.request` call moved the counter 0 → 1)"
  - "No production file was touched. EIGHT plants were applied across two production files — `edge/handlers/plugin/update.ts` and `edge/handlers/shared.ts` — all EIGHT RED, all reverted from byte copies taken beforehand. Post-revert `git hash-object` reads `acc5ea9d892560e68e5deeb4b2f1300690df1439` for `update.ts` and `9c42cb8b2c5c7066e962b50dbef035485c7e0320` for `shared.ts`; `git diff --quiet` over the five pinned production files and `tests/helpers/notification-boundary.ts` exits 0"

patterns-established:
  - "Own a cross product by giving each cell something to exclude. Three target forms against one fixture holding two marketplaces, three project plugins and two user plugins: the all form moves five records, the marketplace form two, the plugin form one, and no two expected footprints are equal"
  - "Ask whether an omitted selector is a DEFAULT or a THIRD OUTCOME before writing its row. Where it is a third outcome, absence is provable by measurement rather than asserted"
  - "Classify each flag by what it changes, then choose the fixture where it bites. The gate-widening flag needs a plugin whose NEW source declares an unsupported component kind; the model-mapping flag needs a model-bearing agent on that same plugin; the scope-target flag needs a write-back that targets one layer"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/update.test.ts owns edge/handlers/plugin/update.ts at 100 percent direct functions, lines and branches"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/update.test.ts — 22 runtime cases from 9 marked bodies, pass 22 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts → 100.00 / 100.00 / 100.00, exit 0"
        status: pass
  - deliverable: "Both previously-uncovered regions are covered: the too-many-arguments rejection (update.ts:51-53) and the early return after the shared map-model parse (update.ts:45-46)"
    human_judgment: false
    verification:
      - kind: command
        ref: "Baseline was branches 20/22, lines 85/90, uncovered 45-46 and 51-53; after the rewrite the gate reports no uncovered lines"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/update.test.ts — two arity rows drive 51-53; the quoted long flag and the two invalid scope values drive 45-46"
        status: pass
  - deliverable: "Each of the three target forms is discriminating, and a form that collapsed into another is visible"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A (remove the leading-separator branch) turned exactly the marketplace-form case RED while the all and plugin forms stayed GREEN"
        status: pass
  - deliverable: "Every rejection leaves the seeded fixture byte-unchanged and the workflow unreached (D-116-06 negative half, T-116-25-A)"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/update.test.ts — nine rejecting cases at (1, 0) with no stated cwd, each asserting NOTHING_UPDATED and calling verifyBoundary()"
        status: pass
      - kind: command
        ref: "Plant B (delete the too-many-arguments guard) turned exactly the two arity rows RED in all four scope and cwd variants; Plant C and Plant C2 turned exactly the rows that reach each guard RED"
        status: pass
  - deliverable: "Every value-carrying flag member is pinned, and each is proven absent rather than present-and-false where absence is what the module means"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant F (unconditional mapModel) turned nine rows RED including the gate-widened row that pins the model field's ABSENCE; Plant G (unconditional partial) turned exactly the two refused rows RED; Plant D and Plant E turned exactly the scope and scope-target rows RED"
        status: pass
  - deliverable: "The scope-target flag is honoured position-independently"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant H (honour the flag only at index 0 of extractLocalFlag) turned exactly the two non-leading rows and the both-selectors case RED, leaving the leading row GREEN"
        status: pass
  - deliverable: "NFR-5 offline half: the git transport door is never opened"
    human_judgment: true
    rationale: "The zero is asserted in all 22 cases and the door was proven instrumented out of suite, but nothing in this handler's reachable input space can move the counter — a url-source marketplace is skipped by the marketplace sync and a github-source one fails before the transport. It is a regression guard, not a discriminated measurement, and a verifier should read it as one."

duration: 62 min
completed: 2026-09-03
---

# Phase 116 Plan 25: Plugin Update Shim Owner Summary

The update handler is now owned across all three of its target forms: 22 cases compare the whole
on-disk footprint of both scope roots, so a form that selected too many plugins, too few, or the
wrong scope is visible as a record that moved rather than as a claim nobody checked.

## Accomplishments

- Rewrote `tests/edge/handlers/plugin/update.test.ts` on `createNotificationBoundary`, removing the
  previous suite's hand-rolled context and its double assertion through `unknown`, and replacing
  every `assert.equal` probe with whole-value `assert.deepStrictEqual` comparisons.
- Made each of the three target forms EXCLUDE something the other two include. The fixture holds two
  marketplaces and three plugins in the project scope and the same marketplace with two plugins in
  the user scope, at a different source version per scope: the all form moves five records across
  both scopes, the marketplace form moves two, and the plugin form moves one. No two expected
  footprints are equal, so no cell differs only in a dimension the module ignores.
- Took the closed two-region coverage gap to zero. `update.ts:51-53` (the too-many-arguments
  rejection) is driven by two arity rows; `update.ts:45-46` (the early return after the shared
  map-model parse) is driven by THREE inputs on TWO routes — a quoted long flag that survives the
  first scanner and is claimed by the second, and two invalid scope values whose tokenizer throw is
  caught inside the same shared parse.
- Sized every rejection at one emission and zero probes with no stated working directory, and called
  `verifyBoundary()` in all 22 cases. The probe count (4 on every delegating path, 0 on a rejection)
  and the `ctx.cwd` read count (1 and 0) were MEASURED through a counting context before a line of
  the suite was written.
- Ran eight plants, all eight RED, all reverted; `git diff --quiet` over the pinned sources exits 0
  (T-116-25-C).

## Task Commits

| Task | Name                                                       | Commit     | Files                                    |
| ---- | ---------------------------------------------------------- | ---------- | ---------------------------------------- |
| 1    | Rewrite the update owner crossing three forms with the flags | `0e45fd55` | tests/edge/handlers/plugin/update.test.ts |

## Case inventory

22 runtime cases from 9 marked bodies (`rg -c '^\s+// arrange$'` = 9, and the same for `// act` and
`// assert`).

| Body                       | Rows | Input                                            | Outcome                                                    |
| -------------------------- | ---- | ------------------------------------------------ | ---------------------------------------------------------- |
| Target forms               | 3    | `""`, `@alpha`, `one@alpha`                      | five records / two records / one record                     |
| Scope selection            | 2    | `--scope project`, `--scope user`                | the selected root alone; the other survives stale           |
| Downstream boolean matrix  | 4    | `degraded@alpha` with and without the two flags  | refused, refused, updated without a model, updated with one |
| Scope-target flag position | 3    | flag ahead of, after, and between the two flags  | declaration in the override layer                           |
| Both selectors together    | 1    | `--scope user one@alpha --local`                 | user root narrowed AND override layer                       |
| One above the arity        | 2    | two and three references                         | `Too many arguments.`, nothing moved                        |
| Malformed reference        | 3    | `no-at-sign`, `@`, `one@`                        | offending token named verbatim, nothing moved               |
| Unknown long flag          | 2    | `--frobnicate`, `"--frobnicate"`                 | one sentence from two different scanners                    |
| Unrecognised scope value   | 2    | `bogus`, `--frobnicate` in the value position    | the tokenizer's own sentence, nothing moved                 |

The flag-OMITTED companion for the scope-target family is the plugin-reference target-form case,
which lands the same declaration in the BASE layer. The scope-OMITTED companion is the no-positional
target-form case, which enumerates BOTH scope roots.

## Plants (D-116-04)

All eight reverted from byte copies taken beforehand. No plant stayed GREEN.

**Plant A — remove the leading-separator branch** so a bare marketplace reference falls through to
the plugin split. RED on exactly the marketplace-form case:

```
✖ selects the update target so that a leading-separator reference considers only the named marketplace (PUP-1)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
      networkCalls: 0,
      project: {
  +     agents: [],
  +     base: undefined,
  -     agents: [ { file: 'pi-claude-marketplace-one-scout.md' } ],
  -     base: { plugins: { 'one@alpha': {}, 'two@alpha': {} }, schemaVersion: 1 },
        local: undefined,
        records: [
  ...
  +         version: '1.0.0'
  -         version: '2.0.0'
ℹ tests 22   ℹ pass 21   ℹ fail 1
```

**Plant B — delete the too-many-arguments guard.** RED on exactly the two arity rows, and run in
FOUR variants because both the scope and the working-directory forwarding discriminate here.

Unstated cwd, no scope token — the throw is CAUGHT by the orchestrator, so the emission count stays
at ONE and the boundary's sizing is satisfied; only the whole-value comparison catches it:

```
    actual: [ { message: 'A plugin operation has failed.\n\n● alpha [project]\n  ⊘ one (failed) {unreadable manifest}\n    cause: The "path" argument must be of type string. Received function ', severity: 'error' } ],
    expected: [ { message: 'Too many arguments.\n\nUsage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--map-model] [--partial] [--local]', severity: 'error' } ],
```

Unstated cwd, `--scope user` — `locationsFor` never calls `path.join` on a user-scope call, so the
update runs to COMPLETION against the user sources:

```
    actual: [ { message: 'A plugin operation needs attention.\n\n● alpha [user]\n  ● one v1.0.0 → v3.0.0 (updated) {requires pi-subagents}\n\n/reload to pick up changes', severity: 'warning' } ],
```

Unstated cwd, `--scope project` — the failed variant again. STATED cwd, no scope token — completes
against the project sources:

```
    actual: [ { message: 'A plugin operation needs attention.\n\n● alpha [project]\n  ● one v1.0.0 → v2.0.0 (updated) {requires pi-subagents}\n\n/reload to pick up changes', severity: 'warning' } ],
```

**Plant C — fall through past the FIRST scan's usage error** (`extractLocalFlag(...) ?? { local:
false, residualArgs: args }`, because the literal deletion does not compile — the same TS18048 shape
116-24 recorded). RED on exactly the first-scan unknown-flag row, and with a diagnostic family this
phase has not seen: the fall-through lands in the SECOND scanner's rejection, never in the workflow.

```
✖ names an unrecognised long flag that is claimed by the first scan and never reaches the update workflow (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at notifyUsageError (.../shared/notify.ts:326:10)
      at parsePositionalsWithFlags (.../edge/handlers/plugin/shared.ts:76:7)
      at parseMapModelArgs (.../edge/handlers/plugin/shared.ts:123:19)
      at .../edge/handlers/plugin/update.ts:43:21
ℹ tests 22   ℹ pass 21   ℹ fail 1
```

**Plant C2 — fall through past the SECOND guard**, the previously-uncovered `update.ts:45-46`. RED on
exactly the three rows that reach it — the quoted unknown flag and the two invalid scope values — and
this time the workflow IS reached:

```
✖ names an unrecognised long flag that is quoted past the first scan and claimed by the second and never reaches the update workflow (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3660:12)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at notifyBareFormEnumerateFailure (.../orchestrators/plugin/update.ts:2969:3)
      at handleEnumerateFailure (.../orchestrators/plugin/update.ts:537:5)
      at updatePlugins (.../orchestrators/plugin/update.ts:365:5)
ℹ tests 22   ℹ pass 19   ℹ fail 3
```

**Plant D — delete `...(flagged.scope !== undefined && { scope: flagged.scope })`.** RED on BOTH
scope rows and the both-selectors case:

```
✖ narrows the considered plugins to the project scope alone when that scope is supplied (SC-1)
✖ narrows the considered plugins to the user scope alone when that scope is supplied (SC-1)
✖ honors a scope flag and the scope-target flag supplied together, narrowing the scope and moving the layer (WB-01)
ℹ tests 22   ℹ pass 19   ℹ fail 3
```

Both rows fall, where 116-24's equivalent plant left one green, because the scope-omitted form here
enumerates BOTH roots rather than resolving to one of them.

**Plant E — delete `...(localFlag.local && { local: true })`.** RED on all four flag-supplied rows,
GREEN on the flag-omitted plugin-reference companion:

```
✖ writes the declaration to the override layer when the scope-target flag is supplied ahead of the reference (WB-01)
✖ writes the declaration to the override layer when the scope-target flag is supplied after the reference (WB-01)
✖ writes the declaration to the override layer when the scope-target flag is supplied between the two downstream flags (WB-01)
✖ honors a scope flag and the scope-target flag supplied together, narrowing the scope and moving the layer (WB-01)
ℹ tests 22   ℹ pass 18   ℹ fail 4
```

with the diff showing the declaration moving back to the base layer:

```
  +     base: {
  -     base: undefined,
  -     local: {
          plugins: {
```

**Plant F — forward the model-mapping member unconditionally (`mapModel: true`).** RED on NINE rows —
every delegating row that pins the model field's ABSENCE — and GREEN on the two rows that expect the
field. This is the "absent, not present-and-false" proof:

```
  +         model: 'anthropic/claude-sonnet-4-6'
ℹ tests 22   ℹ pass 13   ℹ fail 9
```

**Plant G — forward the gate-widening member unconditionally (`partial: true`).** RED on exactly the
two refused matrix rows and GREEN on the two widened ones:

```
✖ forwards the downstream flags so that neither downstream flag leaves the candidate refused (D-65-05)
✖ forwards the downstream flags so that the model-mapping flag alone does not widen the candidate gate (D-65-05)
ℹ tests 22   ℹ pass 20   ℹ fail 2
```

**Plant H — honour the scope-target flag only at index 0 of `extractLocalFlag`** (on the pinned
`edge/handlers/shared.ts`). RED on exactly the two non-leading rows plus the both-selectors case;
GREEN on the leading row and on all eighteen others:

```
✖ writes the declaration to the override layer when the scope-target flag is supplied after the reference (WB-01)
✖ writes the declaration to the override layer when the scope-target flag is supplied between the two downstream flags (WB-01)
✖ honors a scope flag and the scope-target flag supplied together, narrowing the scope and moving the layer (WB-01)
ℹ tests 22   ℹ pass 19   ℹ fail 3
```

This is what makes the position rows falsifiable rather than three assertions that agree.

## Where the plan's inherited truths do NOT hold here

Stated rather than tidied away, because the next reader will inherit them.

1. **The arity claim is half false, again.** The `must_haves` truth says both out-of-range counts are
   rejected. There is no count below the accepted arity: ZERO positionals is the all form, which this
   handler accepts. Only the surplus half has a target, and it holds.
2. **The mutually-exclusive-selector truth is false, for the sixth time.** `--scope user … --local`
   is accepted and both selectors are honoured.
3. **The scope-target flag is not observable in the notification at all.** A message-only suite would
   have called it inert. It IS observable in the footprint, unlike `uninstall`'s, because the update's
   write-back targets one layer instead of sweeping both.

## Deviations from Plan

**1. [Rule 2 — falsifiability] The offline zero kept, but labelled and bounded**

- **Found during:** Task 1
- **Issue:** the plan asks for the network call count asserted at zero in every case. Measured, no
  input through this handler can open the door — even though `orchestrators/plugin/update.ts` is the
  one documented git-operations exemption and the door is genuinely in its import graph. Two
  independent fixture attempts confirmed it: a `url`-source marketplace is skipped by
  `makeSyncCloneOnce`, which no-ops for every non-`github` kind, and a `github`-source marketplace
  fails at `refreshGitHubClone` with `Could not find HEAD.` before reaching the transport.
- **Fix:** kept the assertion, folded it into the same whole-value comparison so every case carries
  it, proved the door instrumented with an out-of-suite positive control (a direct `https.request`
  call moved the counter 0 → 1), and stated the limit in the suite header and in the coverage block
  with `human_judgment: true`. This is 116-24's answer reached by a different route.
- **Commit:** `0e45fd55`

**2. [Rule 2 — falsifiability] Position independence proven by a plant, not by three rows agreeing**

- **Found during:** Task 1
- **Issue:** the plan's `<action>` asks for the scope-target flag driven "before and after the
  positional and between the two downstream flags, all asserting the identical outcome", which is the
  phase's known tautology template.
- **Fix:** the flag IS observable here (the config layer moves), so supplied-versus-omitted is a
  genuine disagreement rather than a restatement — the flag-omitted companion is the plugin-reference
  target-form case, which asserts the base layer. Position independence is then carried by Plant H,
  which turns exactly the non-leading rows RED, rather than by the three rows agreeing.
- **Commit:** `0e45fd55`

**3. [Rule 2 — plant strengthened] The first-guard plant run in the compiling form, and split in two**

- **Found during:** Task 1
- **Issue:** deleting the early return after the first scan does not compile (the TS18048 shape
  116-24 recorded), and the plan names only two plants, neither of which exercises the D-116-06
  negative the phase requires of every Group-C owner.
- **Fix:** ran the first guard's plant as `?? { local: false, residualArgs: args }` (Plant C) and the
  second guard's separately (Plant C2), which is what revealed that only the SECOND guard's plant
  reaches the orchestrator. Ran Plant B in all four scope and working-directory variants and recorded
  each output after running it, never before.
- **Commit:** `0e45fd55`

**Total deviations:** 3 auto-fixed (3 × Rule 2). **Impact:** one inherited negative had its limits
recorded instead of being presented as evidence, one plan-specified family was given a demonstrated
disagreement and a plant instead of three agreeing assertions, and the phase-mandated Group-C
negative was run in the forms that reach the code they claim to exercise.

## Verification

Each gate run separately, exit code checked. `npm run check` was NOT used — its `format:check` link
fails on the operator's pre-existing untracked files and short-circuits before the tests.

| Gate                                                                  | Result                                     |
| --------------------------------------------------------------------- | ------------------------------------------ |
| `node --test tests/edge/handlers/plugin/update.test.ts`                | tests 22, pass 22, fail 0                  |
| `npm run test:coverage:direct -- .../plugin/update.ts`                 | 100.00 / 100.00 / 100.00, exit 0           |
| `npm run typecheck`                                                    | exit 0                                     |
| `npm run lint` / `eslint <file>`                                       | exit 0                                     |
| `npm run fallow`                                                       | exit 0                                     |
| `npm exec -- prettier --check <file>`                                  | exit 0                                     |
| `npm test`                                                             | exit 0 — `ℹ tests 5136`, 293 suites, fail 0 |
| `npm run test:integration`                                             | exit 0 — `ℹ tests 31`, fail 0              |
| anti-pattern `rg` scan                                                 | no match (the negated link exits 0)        |
| `rg -c '^\s+// arrange$'`                                              | 9, equal to the marked-body count          |
| `git diff --check`                                                     | exit 0                                     |
| `git diff --quiet` over 5 pinned sources + `notification-boundary.ts`  | exit 0                                     |
| trufflehog filesystem scan                                             | chunks 4, bytes 47656, 0 verified, 0 unverified |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>`       | exit 0                                     |

The suite total was READ from the runner's `ℹ tests` line, never computed from a delta. The baseline
was 5132; this pair replaced 18 cases with 22.

## Issues Encountered

None.

## Next Phase Readiness

Wave 5 is CLOSED. Only 116-28 (register) remains before the phase gates. It is the last plan of the
phase and the only one left that has not measured its own module's arity, `--local` and Group-C
answers — the three questions every handler owner in this phase has found module-specific.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/update.test.ts` and
  `.planning/phases/116-edge-surface/116-25-SUMMARY.md` both present on disk.
- Commit `0e45fd55` reachable from `git log --all`.
- The plan's whole `<verify>` chain re-run end to end against the committed pair: exit 0, with the
  arrange-marker link reporting 9.
- Both planted production files restored byte-for-byte; `git hash-object` and `git diff --quiet` both
  confirm it.
- `git status --short` lists only the operator's pre-existing modified and untracked entries plus the
  planning files this plan owns.
- The three scratch measurement files created for the measurement pass
  (`scratch-probe-116-25.ts`, `scratch-git-probe.ts`, `scratch-door-control.test.ts`) were deleted
  before the commit, and `npm run fallow` re-run clean afterwards.
- Nothing filed in `.planning/WINDOWS.md`: this pair carries no stub, no skipped test, no unrun
  `<verify>` link and no D-116-01a shortfall — direct coverage is complete at 22/22 branches with no
  unreachable region measured.
