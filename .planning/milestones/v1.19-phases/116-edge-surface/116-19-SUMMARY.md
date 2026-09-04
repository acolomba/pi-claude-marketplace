---
phase: 116-edge-surface
plan: "19"
subsystem: testing
tags: [node-test, edge, plugin, install, flag-matrix, group-c, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-06's flag-catalog owner, which owns the per-verb parse sets and the `SCOPE_TARGET_FLAG` constant this owner consumes without re-pinning"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C no-seam negative-delegation shape"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the map-model parse this handler calls"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the scope-target flag scan and its residual position contract"
provides:
  - "tests/edge/handlers/plugin/install.test.ts — the sole mirrored direct owner for edge/handlers/plugin/install.ts, at 100 percent direct branches, functions, and lines"
  - "the measured correction that omitting `cwd` is NOT universally load-bearing for a Group-C negative: `locationsFor` reads `cwd` only on the PROJECT arm, so an unstated `cwd` is inert on a user-scope workflow call and the negative fires on the emission count instead. The discriminator is the SCOPE the plant targets, not whether the plant forwards `ctx.cwd`"
  - "a worked answer to the 116-05 data-field finding on a real flag matrix: each flag classified PATH-changing vs VALUE-carrying, and every value-carrying member pinned in a row table against a hand-authored on-disk footprint"
  - "the measured outcome that `plugin/install.ts` ACCEPTS a scope flag beside the scope-target flag — the fourth acceptance among the handlers that reach `extractLocalFlag`, and the tenth distinct `--local` outcome in this phase"
  - "the measured correction that the previously-uncovered `install.ts:57-59` has TWO routes, not one: a quoted long flag claimed by the second scanner, and an unrecognised scope value whose tokenizer throw is caught inside the same shared parse"
  - "the four-plugin fixture shape that makes two independent downstream booleans observable in one matrix: a partially-available plugin carrying a model-bearing agent"

affects: []

actuals:
  tokens: 34000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "The flag matrix is driven over ONE plugin that is simultaneously partially-available (so the gate-widening flag has an effect) and carries an agent declaring a mappable model (so the model-mapping flag has an effect). Without that single fixture the two flags cannot be varied independently: on a fully-installable plugin the gate flag changes nothing, and on a blocked plugin the model flag changes nothing"
    - "Delegation is observed as an eight-member on-disk footprint read back as ONE whole value — both scopes' install records, both scopes' base and override config layers, and both scopes' generated agent files with their `model:` line — so a record or declaration that landed in the wrong scope or the wrong layer is visible rather than merely absent"
    - "Boundary sizing is stated PER ROW, not per suite: a rejection is `(1, 0)` with no `cwd`, a materialising install is `(1, 4, {cwd, reads: 1})`, and an install refused by the gate or landing disabled is `(1, 2, {cwd, reads: 1})`. All three were measured through a counting context before a case was written"
    - "The record projection drops `installedAt`, `updatedAt` and `resolvedSource` — the three non-deterministic fields — and keeps everything a flag can move, so the whole-value comparison stays hand-authorable"
    - "Delegating cases assert the footprint and NOT the notification body; the body belongs to tests/orchestrators/plugin/install.test.ts and re-deriving it here would restate a fact another pair owns"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/install.test.ts

key-decisions:
  - "FINDING for the remaining Group-C owners — omitting `cwd` is NOT universally load-bearing. The phase carried it as the one constant across four measured diagnostics. Measured here as conditional: `locationsFor(scope, cwd)` is `scope === 'user' ? getAgentDir() : path.join(cwd, '.pi')`, so an unstated `cwd` never reaches `path.join` on a user-scope call. Plant F1 (fall through, forward `ctx.cwd`, `scope: \"user\"`) and Plant F2 (same with a literal working directory) produced the IDENTICAL diagnostic — `ctx.ui.notify is not a function` at `orchestrators/plugin/install.ts:2390`, the workflow running to completion and its success notification tripping the emission count. Plant F3, differing only in `scope: \"project\"`, produced the OTHER family: `ERR_INVALID_ARG_TYPE` at `persistence/locations.ts:145`. The durable rule is that the negative fires at the first unstated boundary member the workflow reaches; WHICH member that is depends on the scope the call targets as much as on the orchestrator's error handling"
  - "DEVIATION — the plan's `must_haves` truth 5 ('mutually exclusive scope flags supplied together are rejected before any orchestrator call') is FALSE against this module. `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only the scope-target token, so `alpha@mp --scope project --local` is ACCEPTED and BOTH members are honoured: the record lands under the project scope root at the project version and the declaration lands in that scope's `claude-plugins.local.json`. Written as an acceptance case; Plant A (scope default flipped) and Plant E (local spread deleted) each turn it RED, so both members are separately load-bearing. Fourth acceptance among the handlers reaching `extractLocalFlag`, matching `marketplace/add.ts`, `marketplace/autoupdate.ts` and `marketplace/remove.ts`"
  - "CONFIRMATION — the plan's arity truth HOLDS in both halves here, only the second module in the phase where it does (116-18 was the first). The handler carries its own `nonFlagPositionals.length !== 1` guard, so zero, two and three references all reject with one sentence before any workflow call. Plant I (`!== 1` weakened to `< 1`) turns exactly the two surplus rows RED and leaves the zero rows green, which is what makes the upper half a measurement rather than an inherited assumption"
  - "DEVIATION — the plan states the uncovered region is reached by 'an unknown long flag that survives the first flag scan and is rejected by the second'. Measured: there are TWO routes into `install.ts:57-59`, and the second is simpler. An unrecognised scope value (`--scope bogus`, `--scope --frobnicate`) makes `parseArgs` throw inside `parseMapModelArgs`, which catches it, notifies, and returns the same `undefined`. Both routes are in the suite as separate bodies and Plant G (fall through on the second guard) turns all three cases RED. The quoted-flag route was constructed as the plan asked and it works: the first scan splits on whitespace and sees a token opening with a quote character, while `parseArgs`'s tokenizer strips the quotes and hands `--frobnicate` to the second scanner"
  - "The quoted second-scan case and the first-scan case emit the BYTE-IDENTICAL message, so on its own the pair would be an 'assert the identical outcome' tautology. Plant H (the second scanner pushes unrecognised long flags to the positionals instead of rejecting) is what separates them: the quoted case goes RED with the exactly-one-argument sentence while the first-scan case stays green. A row asserting two inputs agree proves nothing until an input is shown where they disagree"
  - "DEVIATION — the plan asks that the network entry point's call count be asserted zero 'in every case'. Not asserted, on 116-18's SC-4 measurement and 116-16's vacuity rule: every fixture here is a PATH source, which never reaches the git transport with or without any flag, so the zero could not fail and would prove the fixture rather than the module. The fail-fast `https.request` replacement is KEPT as a hermeticity device — an accidental network reach throws — but no count is read and none is compared. This plan states no NFR-5 claim; 116-20 and 116-21 carry that assignment"
  - "DEVIATION — the plan asks that the two downstream boolean flag names be taken 'from the catalog pass-through derivation for this verb rather than restating literals'. They are hand-authored instead. `passThroughFlagNames('install')` returns them as an ORDER, and the two are not interchangeable here: one selects the install gate and the other the generated agent's model field, so a positional read would silently swap the matrix's two behavior columns if the catalog order changed, and a read by name is the literal with extra steps. `SCOPE_TARGET_FLAG` has no such hazard — the catalog exports it as a single named constant — and IS taken from the catalog. No case asserts any catalog content either way"
  - "DEVIATION — the plan asks for the scope-target flag 'driven before and after the reference and between the two downstream flags, all asserting the identical outcome — the position-independence proof'. Written as three DISCRIMINATING rows instead. `tests/edge/handlers/shared.test.ts:60-65` already owns the residual position contract and asserts one identical whole value across placements, and nothing an edit to `install.ts` could do would make a pure position-permutation row fail — the sibling's rule is to ask what would have to change before copying a negative. Each row now asserts the full footprint with the declaration in the OVERRIDE layer, which the omitted counterpart (the scope table's first row, base layer) contradicts; Plant E turns all three RED with the declaration moving from the override layer to the base layer"
  - "No D-116-01a claim. The pair reaches 100 percent — branches 17/17, functions 2/2, lines 101/101, up from 16/17, 2/2, 99/101. Every branch is reachable through the module exports and nothing is left uncovered, so nothing was filed in `.planning/WINDOWS.md`"
  - "No production file was touched. Eleven plants were applied across `edge/handlers/plugin/install.ts` and `edge/handlers/plugin/shared.ts` and reverted from byte copies taken before the first plant; `git diff --stat -- extensions/` was empty after the last revert and the plan's pinned-path `git diff --quiet` exited 0 before staging"

patterns-established:
  - "For a flag matrix, ask of every flag whether it changes a PATH (coverage sees it) or a VALUE handed downstream (coverage does not). Here four of five members are value-carrying and one — `applyDefaultEnabled: true` — is a data field with no branch at all: no flag turns it off, so no coverage number and no gate could have caught it being wrong. Its only discriminating observation is the enabled state a plugin declaring `defaultEnabled: false` lands in, and Plant B proves the point exactly — deleting the member leaves the record `enabled: true`, the declaration `{}` instead of `{ enabled: false }`, and the generated agent file in place, with every gate still green"
  - "A two-flag matrix needs a fixture where BOTH flags bite at once. Four combinations over a fully-installable plugin leave the gate flag inert; four over a blocked plugin leave the mapping flag inert. A partially-available plugin carrying a model-bearing agent is the single fixture where the blocked rows prove the gate flag absent and the installed rows prove the mapping flag present and absent"
  - "State the boundary probe count per ROW when a module's paths disagree. This one has three distinct counts (0, 2 and 4) over one handler, split by which emission the workflow reaches, not by which handler ran"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/install.test.ts owns edge/handlers/plugin/install.ts, including the previously-uncovered early return after the shared map-model parse"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/install.test.ts — 23 runtime cases from 10 marked bodies, pass 23 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts → branches 17/17, functions 2/2, lines 101/101 (was 16/17, 2/2, 99/101, uncovered 58-59)"
        status: pass
  - deliverable: "All four combinations of the two downstream boolean flags are exercised, each asserting which members are absent rather than present-and-false"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/install.test.ts#forwards neither downstream flag to the install workflow, leaving the unsupplied one off (D-65-05)"
        status: pass
      - kind: command
        ref: "Plant C — delete the conditional mapModel spread; the both-flags row and the between-position row go RED on the missing model line"
        status: pass
      - kind: command
        ref: "Plant D — delete the conditional partial spread; both gate-widened rows go RED, the whole user-scope footprint collapsing to empty"
        status: pass
  - deliverable: "The unconditional default-enabled member is proven through the enabled state the workflow records"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — delete applyDefaultEnabled: true; the case goes RED on enabled true, the declaration losing its enabled:false, and the agent file surviving"
        status: pass
  - deliverable: "An omitted scope flag reaches the workflow as the user scope default, and a supplied scope flag reaches it unchanged"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A — change the default from user to project; 7 cases RED including the omitted-scope row, while both supplied-scope rows stay green"
        status: pass
  - deliverable: "The scope-target flag moves the declaration to the override layer whatever position it takes, and is honoured beside a scope flag"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant E — delete the conditional local spread; all 4 scope-target cases RED, the declaration moving from the override layer to the base layer"
        status: pass
  - deliverable: "The D-116-06 negative: the install workflow is proven unreached on every rejection channel"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/install.test.ts#names an unrecognised long flag the first scan claims and never reaches the install workflow (D-116-06)"
        status: pass
      - kind: command
        ref: "Plants F1/F2/F3 — fall through on the first guard to a real installPlugin call; F1 and F2 both die on the emission count at orchestrators/plugin/install.ts:2390, F3 (project scope) dies as ERR_INVALID_ARG_TYPE at persistence/locations.ts:145"
        status: pass
      - kind: command
        ref: "Plant G — fall through on the second guard; the quoted second-scan case and both scope-value cases go RED"
        status: pass
  - deliverable: "The quoted long flag is claimed by the SECOND scanner, not the first, despite the byte-identical message"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant H — the second scanner pushes unrecognised long flags to the positionals; the quoted case alone goes RED with the exactly-one-argument sentence"
        status: pass
  - deliverable: "Both halves of the arity obligation hold: zero, two and three references are all rejected before any workflow call"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant I — weaken the count guard from !== 1 to < 1; exactly the two surplus rows go RED, the zero rows staying green"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over install.ts, all three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 45 min
completed: 2026-09-02
---

# Phase 116 Plan 19: Plugin Install Owner Summary

The largest flag matrix in the handler tier now has one exhaustive owner at 100 percent direct
coverage, with every value-carrying member pinned against a hand-authored on-disk footprint rather
than left to a branch count.

## What was built

`tests/edge/handlers/plugin/install.test.ts` was rewritten from sixteen loose cases built on a
hand-rolled context cast into **23 runtime cases from 10 marked bodies**, all on the shared strict
boundary.

| Marked body | Args | Rows | Boundary sizing | Proves |
|-------------|------|------|-----------------|--------|
| flag matrix | `degraded@mp` ± the two downstream flags | 4 | `(1, 2)` blocked / `(1, 4)` installed, `cwd` reads 1 | all four combinations; each member present only when supplied |
| scope | `alpha@mp`, `--scope user`, `--scope project` | 3 | `(1, 4, {cwd, reads: 1})` | the omitted default is the user scope; a supplied scope reaches the workflow unchanged |
| scope target | flag before / after the reference / between the two downstream flags | 3 | same | the declaration lands in the override layer whatever the position |
| both selectors | `alpha@mp --scope project --local` | 1 | same | a scope flag beside the scope-target flag is ACCEPTED and both are honoured |
| default enabled | `optout@mp` | 1 | `(1, 2, {cwd, reads: 1})` | the unconditional member, observed as the recorded enabled state |
| arity | `""`, flags only, two refs, three refs | 4 | `(1, 0)`, **no `cwd`** | both halves of the arity obligation |
| malformed ref | no separator / leading / trailing | 3 | `(1, 0)`, **no `cwd`** | the offending token named verbatim |
| unknown flag, first scan | `alpha@mp --frobnicate` | 1 | `(1, 0)`, **no `cwd`** | the normative D-116-06 negative |
| unknown flag, second scan | `alpha@mp "--frobnicate"` | 1 | `(1, 0)`, **no `cwd`** | the previously-uncovered region, via the quoting route |
| scope value | `--scope bogus`, `--scope --frobnicate` | 2 | `(1, 0)`, **no `cwd`** | the second route into the same region |

Direct coverage moved from branches 16/17, functions 2/2, lines 99/101 (uncovered `58-59`) to
**17/17, 2/2, 101/101**.

## The flag classification (the 116-05 question, asked of a real matrix)

Coverage cannot see a data field. Each member the handler hands downstream was classified before a
case was written:

| Member | Kind | Discriminating observation |
|--------|------|----------------------------|
| `--map-model` → `mapModel: true` | VALUE | the `model:` line the generated agent frontmatter carries (AG-7 is opt-in; absent means the field is omitted entirely) |
| `--partial` → `partial: true` | VALUE | whether a partially-available plugin materialises at all (D-65-03) |
| `--local` → `local: true` | VALUE | which of the scope's two physical config files holds the declaration (WB-01 / CFG-02) |
| `--scope` → the scope member | VALUE, with a defaulted branch | which scope root holds the record, and at which version |
| `applyDefaultEnabled: true` | **VALUE, no branch at all** | the enabled state a plugin declaring `defaultEnabled: false` lands in |

The last row is the 116-05 class exactly. There is no flag that turns it off and no branch that
selects it, so a wrong value would have passed the suite, typecheck, lint, fallow **and** a 100
percent branch-coverage gate. Plant B is the proof: deleting the member leaves the record
`enabled: true`, the declaration `{}` instead of `{ enabled: false }`, and the generated agent file
in place — and nothing else in the repo notices.

## The fixture that makes two flags independently observable

A two-flag matrix needs one plugin where both flags bite:

- on a **fully-installable** plugin the gate-widening flag changes nothing, so two of the four rows
  would be one row run twice;
- on a **blocked** plugin the model-mapping flag changes nothing, because no agent is ever generated.

`degraded` is both: it declares an experimental component kind, so it resolves
`partially-available` and needs the gate widened, and it carries an agent declaring a mappable
model. The four rows then read cleanly — neither flag and the mapping flag alone leave the tree
untouched (the gate member is ABSENT, observed, not assumed); the gate flag alone installs with an
agent carrying no model line; both flags install with the mapped model.

## Plants (D-116-04)

Eleven plants, all RED, all reverted. **No plant stayed green.** Production is byte-identical to
HEAD (`git diff --stat -- extensions/` empty).

### Plant A — flip the scope default from the user scope to the project scope

```text
✖ records the install where an omitted scope flag reaches the workflow as the user scope (SC-1)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
      project: {
  -     agents: [],
  -     base: undefined,
  -     local: undefined,
  -     records: []
  -   },
  -   user: {
        agents: [
          {
            file: 'pi-claude-marketplace-alpha-scout.md'
          }
        ],
  ...
            mp: {
  +           source: './mp-src-project'
  -           source: './mp-src-user'
            }
  ...
  +         version: '1.0.0'
  -         version: '2.0.0'
```

7 cases RED. Both supplied-scope rows stayed GREEN, which is what makes the omitted row a default
proof rather than a scope proof.

### Plant B — delete the unconditional `applyDefaultEnabled: true`

```text
✖ records a plugin declaring itself off by default as disabled, because the default-enabled member is always forwarded (DFEN-04)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
      user: {
  +     agents: [
  +       {
  +         file: 'pi-claude-marketplace-optout-scout.md'
  +       }
  +     ],
  -     agents: [],
        base: {
  ...
          plugins: {
  +         'optout@mp': {}
  -         'optout@mp': {
  -           enabled: false
  -         }
          },
  ...
  +         enabled: true,
  -         enabled: false,
```

1 case RED. The data field is pinned.

### Plant C — delete the conditional `mapModel` spread

```text
✖ forwards both downstream flags to the install workflow, leaving the unsupplied one off (D-65-05)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
            file: 'pi-claude-marketplace-degraded-scout.md',
  -         model: 'anthropic/claude-sonnet-4-6'
          }
```

2 cases RED (the both-flags matrix row and the between-position scope-target row).

### Plant D — delete the conditional `partial` spread

```text
✖ forwards the gate-widening flag alone to the install workflow, leaving the unsupplied one off (D-65-05)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
      user: {
  +     agents: [],
  +     base: undefined,
  -     agents: [
  -       {
  -         file: 'pi-claude-marketplace-degraded-scout.md'
  -       }
  -     ],
  -     base: {
  ...
        local: undefined,
  +     records: []
  -     records: [
  -       {
  -         installable: false,
  -         plugin: 'degraded',
  -         unsupported: [
  -           'themes'
  -         ],
```

2 cases RED.

### Plant E — delete the conditional `local` spread

```text
✖ writes the declaration to the override layer when the scope-target flag is supplied after the reference (WB-01)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +     base: {
  -     base: undefined,
  -     local: {
          marketplaces: {
            mp: {
              source: './mp-src-user'
            }
          },
  ...
  +     local: undefined,
```

4 cases RED, and the failure is exactly the declaration moving from the override layer to the base
layer — a location proof, not an existence proof.

### Plants F1 / F2 / F3 — the Group-C negative, three variants

F1 replaces the first early return with a real `installPlugin` call forwarding `ctx.cwd` at
`scope: "user"`:

```text
✖ names an unrecognised long flag the first scan claims and never reaches the install workflow (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3660:12)
      at emitCascadeWith (.../shared/notify.ts:3850:3)
      at emitContextCascade (.../shared/notify.ts:3869:3)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at installPlugin (.../orchestrators/plugin/install.ts:2390:5)
      at async .../edge/handlers/plugin/install.ts:53:7
```

F2 is the same fall-through with a literal working directory (`cwd: "/tmp/plant-f2-cwd"`) and
produced the **byte-identical** diagnostic, same line, same frames. The two variants the phase
expects to differ did not differ here.

F3 changes one member of F1 — `scope: "project"` — and lands in the other family:

```text
✖ names an unrecognised long flag the first scan claims and never reaches the install workflow (D-116-06)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at installPlugin (.../orchestrators/plugin/install.ts:1925:21)
      at .../edge/handlers/plugin/install.ts:53:13
```

That is the finding below: the discriminator is the scope, not the `cwd` forwarding.

### Plant G — fall through on the SECOND guard (the newly-covered region)

```text
✖ names an unrecognised long flag that survives the first scan and is claimed by the second, and never reaches the install workflow (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at installPlugin (.../orchestrators/plugin/install.ts:2390:5)
      at async .../edge/handlers/plugin/install.ts:58:7
```

3 cases RED — the quoted second-scan case and both scope-value cases. The frame at
`install.ts:58` is the previously-uncovered line.

### Plant H — the second scanner stops rejecting unrecognised long flags

```text
✖ names an unrecognised long flag that survives the first scan and is claimed by the second, and never reaches the install workflow (D-116-06)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'install requires exactly one <plugin>@<marketplace> argument.\n' +
  -     message: 'Unknown flag: "--frobnicate".\n' +
          '\n' +
          'Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
        severity: 'error'
      }
    ]
```

**1 case RED — the quoted case alone.** The first-scan case stayed green, which is what separates
two rows that would otherwise emit the byte-identical message.

### Plant I — weaken the count guard from `!== 1` to `< 1`

```text
✖ rejects two references with the exactly-one-argument sentence and never reaches the install workflow (MSG-NC-2)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'A plugin operation needs attention.\n' +
  -     message: 'install requires exactly one <plugin>@<marketplace> argument.\n' +
          '\n' +
  +       '● mp [user]\n' +
  +       '  ● alpha v2.0.0 (installed) {requires pi-subagents}\n' +
  +       '\n' +
  +       '/reload to pick up changes',
  +     severity: 'warning'
  -       'Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
  -     severity: 'error'
      }
    ]
```

Exactly the two surplus rows RED; the zero rows stayed green.

## The measured correction: omitting `cwd` is not universally load-bearing

The phase has carried "omitting `cwd` is the constant; the diagnostic is not" across four measured
Group-C negatives. Measured here, the omission itself is conditional:

```ts
const scopeRoot = scope === "user" ? getAgentDir() : path.join(cwd, ".pi");
```

`locationsFor` reads `cwd` **only on the project arm**. On a user-scope workflow call the unstated
`cwd` — strong-mock's pending-call proxy function — is never passed to `path.join`, so the workflow
runs to completion and the boundary catches its success notification on the emission count instead.
That is why F1 and F2 agree: the difference between them (`ctx.cwd` versus a literal) is
immaterial when nothing reads it. F3 changes the scope alone and the `ERR_INVALID_ARG_TYPE` family
returns.

For the five remaining Group-C owners: **the negative still fires, and omitting `cwd` is still the
right sizing** — it is what stops a delegating workflow from writing anything. But do not describe
it as the trigger. The trigger is the first unstated boundary member the workflow reaches, and on a
user-scope path that is the emission, not the working directory.

## Deviations from Plan

### 1. [Rule 1 — false plan claim] `must_haves` truth 5: both scope selectors together are ACCEPTED

- **Found during:** Task 1, reading `edge/handlers/shared.ts` before writing a line.
- **Issue:** The truth promises that mutually exclusive scope flags supplied together are rejected
  before any orchestrator call. `extractLocalFlag` consumes `--scope <value>` as a downstream-owned
  pair and filters only the scope-target token, so both members survive.
- **Fix:** Wrote an acceptance case naming both selectors and asserting the whole footprint.
- **Verification:** `alpha@mp --scope project --local` records `alpha` at the project version under
  `<cwd>/.pi` and writes `<cwd>/.pi/claude-plugins.local.json`, never the base file. Plants A and E
  each turn it RED.
- **Commit:** `a9c160e8`

### 2. [Rule 1 — incomplete plan premise] The uncovered region has two routes, not one

- **Found during:** Task 1, reading both scanners before choosing the input.
- **Issue:** The plan describes `install.ts:58-59` as reached by "an unknown long flag that survives
  the first flag scan and is rejected by the second". An unrecognised scope value reaches the same
  lines through `parseMapModelArgs`'s catch.
- **Fix:** Both routes are in the suite as separate marked bodies. The quoted-flag construction the
  plan asked for was built and works.
- **Verification:** Plant G turns all three cases RED with the frame at `install.ts:58`.
- **Commit:** `a9c160e8`

### 3. [Scope narrowing] The offline zero was not asserted

- **Found during:** Task 1, case selection.
- **Issue:** The plan asks for the network entry point's call count to be asserted zero in every
  case. Every fixture here is a path source, which never reaches the git transport with or without
  any flag, so the zero cannot fail — 116-18's SC-4 measurement and 116-16's vacuity rule.
- **Fix:** Kept the fail-fast `https.request` replacement as a hermeticity device and asserted no
  count. This plan states no NFR-5 claim; 116-20 and 116-21 carry that assignment.
- **Commit:** `a9c160e8`

### 4. [Scope narrowing] The downstream flag names are hand-authored, not taken positionally

- **Found during:** Task 1, harness setup.
- **Issue:** The plan asks that the two downstream boolean names be taken from
  `passThroughFlagNames("install")`. That derivation returns an ORDER, and the two are not
  interchangeable: one selects the install gate, the other the generated agent's model field. A
  positional read would silently swap the matrix's two behavior columns if the catalog order
  changed; a read by name is the literal with extra steps.
- **Fix:** Hand-authored `"--map-model"` and `"--partial"`, which is also what the module's own
  USAGE string does. `SCOPE_TARGET_FLAG` is taken from the catalog — a single named constant with
  no ordering hazard. No case asserts any catalog content.
- **Commit:** `a9c160e8`

### 5. [Rule 1 — unfalsifiable specified case] The position rows were made discriminating

- **Found during:** Task 1, case selection.
- **Issue:** The plan asks for the scope-target flag before and after the reference and between the
  two downstream flags, "all asserting the identical outcome". `tests/edge/handlers/shared.test.ts`
  already owns the residual position contract and asserts one identical whole value across
  placements, and no edit to `install.ts` could make a pure position-permutation row fail.
- **Fix:** Each of the three rows asserts the full footprint with the declaration in the override
  layer, which the omitted counterpart (the scope table's first row, base layer) contradicts.
- **Verification:** Plant E turns all three RED with the declaration moving to the base layer.
- **Commit:** `a9c160e8`

### 6. [Observation] The arity truth holds in both halves

- **Found during:** Task 1, reading the handler's own count guard.
- **Issue:** Not a defect — a confirmation. The truth has been false in eleven plans running; it is
  true here because the handler carries its own `!== 1` guard rather than delegating arity to a
  positional schema.
- **Verification:** Plant I turns exactly the two surplus rows RED.
- **Commit:** `a9c160e8`

**Total deviations:** 5 (1 false `must_haves` truth corrected, 1 incomplete premise completed, 2
scope narrowings with stated reasons, 1 unfalsifiable case rewritten) plus 1 confirmation. **Impact:**
the owner asserts only what the module can falsify. No claim was weakened to go green; the two
narrowings each removed an assertion that could not have failed, and every replacement got a plant.

## Scoped gap (D-116-05, O3, Group C)

`installPlugin` is reached by direct import with no injection point, so this owner cannot state an
exact argument list against it. Delegation is observed instead as one minimal effect — the on-disk
footprint each scope root carries after the command. This exact-argument gap is recorded in the
plan's `must_haves` truth 6 and is **scoped, not missed**. The negative half of D-116-06 is proven
in full, on both rejection channels and on every one of the eleven rejecting cases, with five
plants (F1, F2, F3, G, H).

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/install.test.ts` | tests 23, pass 23, fail 0 |
| `npm run test:coverage:direct -- .../plugin/install.ts` | branches 17/17, functions 2/2, lines 101/101 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | **5084/5084 across 293 suites**, exit 0 (read from the runner's `ℹ tests` line) |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 10 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 4, bytes 38704, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | all hooks Passed |

## Note to the five remaining Group-C owners

1. **Do not describe omitting `cwd` as the trigger.** It is the right sizing and it still stops a
   workflow from writing, but on a user-scope path nothing reads it and the negative fires on the
   emission count. Read `locationsFor` and your orchestrator's error handling, then run the plant.
2. **Classify every flag before writing a case.** A flag that hands a VALUE downstream is invisible
   to coverage; a flag that selects a PATH is not. Pin each value in a row table against a
   hand-authored expectation.
3. **Watch for members with no branch at all.** `applyDefaultEnabled: true` here is unconditional,
   so nothing in this repo would have caught it being wrong.
4. **Two flags need a fixture where both bite.** Otherwise half the matrix is one case run twice.
5. **Two rows emitting the same message need a plant that separates them.** Plant H is the whole
   reason the second-scan case is worth having beside the first-scan case.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 116-20 (which carries the SC-4 offline assignment — read the SC-4 row in the handoff
first), then 116-21, 116-22, 116-24, 116-25, and finally 116-28.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/install.test.ts` exists on disk.
- `git log --oneline --all | grep a9c160e8` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
