---
phase: 06-unused-type-member-gate
plan: "17"
subsystem: testing
tags: [typescript, static-analysis, hooks-bridge, completions, architecture-boundaries, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable member gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The alias-not-delete repair shape proved on the async-rewake duplicate
  - phase: 06-unused-type-member-gate
    provides: The two edge-deps rows 06-12 recorded rather than closed, with the file-ownership reason
  - phase: 06-unused-type-member-gate
    provides: The 9-row live residual 06-16 left behind, with the mechanism named for each
provides:
  - "`CompileIfPredicateContext` published as an alias of `ResolveHookIfContext`: one declaration of the if-field anchor triple instead of two"
  - "`MarketplaceStateRecord` published as an alias of `MarketplaceStateRecordLike`: one declaration of the completions state-record shape instead of two"
  - "A measured 9 -> 6 live population with ZERO findings gained and the lost set exactly the three rows the collapses removed"
  - "A measured, source-checkable reason for the fourth owned row, with both published alias forms tried and the same gate finding recorded for each"
  - "The disproved `edge-deps.ts` sync comment removed, and its replacement states what actually guards the surviving mirror"
  - "`ResolveHookIfContext.cwd` reclassified from test-only-observed to runtime-observed, removing a recorded disposition rather than moving it"
  - "`06-LIVE-TRIAGE.md` regenerated against digest `92dab823`, reconciling with 6 problems that are ALL `unread`"
affects: [06-08]

actuals:
  tokens: 12800
  tasks: 3
  commits: 5
plan_head_before: c45fdf049a5f16c5c594468f92a6ee982fff2a67

tech-stack:
  added: []
  patterns:
    - "A published duplicate becomes an alias of the declaration its reads already resolve to; the name stays exported and the structural pin test passes unmodified"
    - "The architecture allow-list decides WHICH of two mirrored declarations survives -- the collapse runs the direction the zone graph already permits, never the reverse"
    - "A collapse blocked by a DIFFERENT gate is left standing with the blocking finding quoted verbatim, not forced through with a suppression or a manufactured consumer"

key-files:
  created:
    - .planning/phases/06-unused-type-member-gate/06-17-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md
    - .planning/WINDOWS.md

key-decisions:
  - "Step B was NOT taken: step A (aliasing the bridge twin alone) cleared both anchor rows, so `PathAnchorContext` in `glob.ts` is untouched and the file appears in no commit. The phase does not churn source without a measured row to show for it"
  - "The completions seam was collapsed HALFWAY, deliberately. `MarketplaceStateRecord` became an alias and cleared its row; `LocationsResolver` was left as its own declaration because aliasing it too makes `fallow dead-code` exit 1 on the sibling name, and both published forms were measured producing the identical finding"
  - "The fallow finding was not suppressed and no consumer was manufactured for it. Adding a `fallow-ignore` or a redundant annotation to keep the name alive would trade a reported finding for an unreported one, which is the laundering this phase exists to prevent"
  - "The three consuming test files were not edited, so the clean resolution (point their imports at the surviving declaration and drop the republish) is handed on rather than taken"
  - "The `Like` suffix was NOT renamed. After the half-collapse it is still structurally accurate for `LocationsResolverLike` and records history only for `MarketplaceStateRecordLike`; a rename churns the implementation and its paired test for zero rows"
  - "06-15's grouping of the two `ResolveHookIfContext` rows under a `satisfies`-constraint category is corrected with evidence: they were a duplicate declaration with a legal collapse direction, and no engine change was needed or made to clear them"

patterns-established:
  - "The non-comment diff is the behaviour argument: four files changed and the whole non-comment change set is two type-only imports and two interface-to-alias conversions, which emit no JavaScript"
  - "A coverage figure that moves is explained line-for-line before it is accepted: lcov `LF` tracks total source lines, so +46 net comment lines is +46 LF and +46 LH, while functions and branches stay byte-identical"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The if-field anchor triple has ONE declaration, the domain one, and both unread rows on it are cleared by removing the duplicate"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run fallow -- exit 0 each, all four fallow sub-gates"
        status: pass
      - kind: unit
        ref: "node --test tests/domain/components/hooks.test.ts tests/bridges/hooks/if-field/index.test.ts tests/bridges/hooks/if-field/glob.test.ts tests/architecture/hooks-if-field.test.ts tests/bridges/hooks/event-router.test.ts -- 91/91, UNMODIFIED"
        status: pass
      - kind: other
        ref: "analyzer CLI stderr grep -c 'domain/components/hooks.ts' -- 2 before, 0 after"
        status: pass
    human_judgment: false
  - id: D2
    description: "The completions state-record shape has ONE declaration, the orchestrator one, and its unread row is cleared by removing the duplicate"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run fallow -- exit 0 each"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/edge-deps.test.ts tests/edge/completions/{data,provider}.test.ts tests/edge/register.test.ts tests/architecture/{flag-catalog-drift,import-boundaries}.test.ts -- 351/351, UNMODIFIED"
        status: pass
      - kind: other
        ref: "analyzer CLI stderr -- edge-deps.ts:58:3 MarketplaceStateRecordLike.plugins present before, absent after"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fourth owned row is left standing with a measured blocker rather than laundered, and the blocker is reproducible from the recorded commands"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "full-alias form -- npm run fallow exit 1: 'Unused type exports (1) .../edge/completions/data.ts :142 MarketplaceStateRecord'"
        status: pass
      - kind: other
        ref: "re-export form -- npm run fallow exit 1, same finding reported with a '(re-export)' marker"
        status: pass
      - kind: other
        ref: "half-collapse form -- npm run fallow exit 0, row :92:5 still unread, disposition recorded in the ledger and accepted by --check"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero findings gained, measured as a (path, owner, key) set difference in both directions against the pre-edit baseline"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "comm -13 before after -- EMPTY; comm -23 before after -- exactly the three cleared rows"
        status: pass
      - kind: other
        ref: "analyzer counts -- unread 9 -> 6, candidates 3352 -> 3348, testOnlyObserved 240 -> 239, explicitContract 108 -> 108, unsupportedAnalysis 0 -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing was weakened: the whole gate chain is green on the final snapshot and the record reconciles against a fresh digest"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "npm run check -- exit 0, 6535 unit tests 0 fail, 32 integration 30 pass 2 environment-skipped"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.negative.mjs -- 7 of 7"
        status: pass
      - kind: other
        ref: "coverage/unit.lcov -- 1833/1833 functions, 9049/9049 branches, 0 modules below 100 percent"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- 236 pairs, 2 pinned shortfalls matched exactly, pin file unmodified"
        status: pass
      - kind: other
        ref: "node scripts/check-unused-type-members.audit.mjs --check -- exit 1 with 6 problems, ALL unread, zero stale/missing/duplicate/incomplete/invalid"
        status: pass
    human_judgment: false

duration: 1h 22m
completed: 2026-09-17
---

# Phase 6 Plan 17: Collapsing the Last Two Duplicate Declarations Summary

**Two mirrored shapes become one declaration each -- the if-field anchor triple onto its domain declaration and the completions state-record onto its orchestrator declaration -- taking the live residual from 9 unread members to 6 with zero findings gained, and leaving the fourth owned row standing with the exact `fallow` finding that blocks its collapse quoted rather than suppressed.**

## Performance

- **Duration:** 1h 22m
- **Tasks:** 3
- **Commits:** 5 (measured: `git rev-list --count c45fdf04..HEAD` at close-out -- two source, one record, one SUMMARY, one state; a re-run after this correction reads 6)
- **Files modified:** 6 (1 created, 5 modified)

## Predicted versus measured

The plan predicted four rows cleared. Three cleared. This is stated before anything else because the shortfall, not the successes, is the finding a reader needs.

| Row id (pre-plan) | Owner and member | Predicted | Measured |
| --- | --- | --- | --- |
| `domain/components/hooks.ts:77:3` | `ResolveHookIfContext.homedir` | cleared | **cleared** |
| `domain/components/hooks.ts:79:3` | `ResolveHookIfContext.projectRoot` | cleared | **cleared** |
| `orchestrators/edge-deps.ts:58:3` | `MarketplaceStateRecordLike.plugins` | cleared | **cleared** |
| `orchestrators/edge-deps.ts:64:5` | `LocationsResolverLike.loadStateForScope.marketplaces` | cleared | **STANDING** -- re-keyed to `:92:5` |

Population: **9 -> 6**, against a predicted 9 -> 5. The orchestrator's five-row "final residual" is therefore **six**, and the sixth row is the one above.

All other measured counts, read out of the real CLI on the final snapshot:

| Count | Before | After | Predicted direction |
| --- | --- | --- | --- |
| `unread` | 9 | **6** | falling (predicted 5) |
| `candidates` | 3352 | **3348** | falling by roughly eleven **if step B had been taken**; step A alone removed 3 declarations, the record alias removed 1 |
| `testOnlyObserved` | 240 | **239** | 240 -> 239 -- matched exactly |
| `explicitContract` | 108 | **108** | unchanged -- matched |
| `unsupportedAnalysis` | 0 | **0** | unchanged -- matched |
| `productionFiles` | 236 | **236** | unchanged |

The plan's candidate prediction was written against a 101-entry contract file and an unexecuted step B; the measured -4 is the arithmetic of what was actually done (3 members on the bridge interface + 1 on the edge interface), not a shortfall against it.

## The delta, as a set difference

Measured by `(path, owner, key)` against `tmp/members-before.json`, captured before the first edit at `c45fdf04`:

```
comm -13 before after   # GAINED
<empty>

comm -23 before after   # LOST
extensions/pi-claude-marketplace/domain/components/hooks.ts|ResolveHookIfContext|homedir
extensions/pi-claude-marketplace/domain/components/hooks.ts|ResolveHookIfContext|projectRoot
extensions/pi-claude-marketplace/orchestrators/edge-deps.ts|MarketplaceStateRecordLike|plugins
```

**Zero findings gained.** The lost set is exactly three rows, all of them owned by this plan, and no row outside this plan's scope moved in either direction. The five rows the position brief named as deliberate survivors -- `enableRowDependencies.signals.partition`, `AuthAttemptResult.authAttempted` twice, `UpdatePhaseFailure.msg`, `PLUGIN_INFO_RENDER.status` -- are all still present, still `unread`, and none of their files was touched.

## Collapse 1: the if-field anchor triple

**Direction: `bridges-hooks -> domain`.** Permitted by `.fallowrc.json` `boundaries.rules`: `{"from":"bridges-hooks","allow":["domain","persistence","shared","platform"]}`. The reverse is forbidden by `{"from":"domain","allow":["shared","platform"]}` and by `eslint.config.js:222` ("domain/ MUST NOT import upward -- pure logic only"). So the surviving declaration **had** to be the domain one.

`ResolveHookIfContext` (`domain/components/hooks.ts`) is now the sole declaration of `{homedir, cwd, projectRoot}`. `bridges/hooks/if-field/index.ts` keeps the name `CompileIfPredicateContext` exported with the same spelling, as `export type CompileIfPredicateContext = ResolveHookIfContext;`, reached by a type-only import. The module edge is new for that file; the **zone** edge is not -- it already imports `hook-events.ts` and `hook-if-targets.ts` from `domain/`, and `domain/components/hooks.ts` imports nothing from any bridge, so no cycle formed and both fallow cycle runs are unchanged.

**Step B was not taken.** Step A alone took `domain/components/hooks.ts` from 2 rows to 0, measured directly off the CLI's stderr (`grep -c 'domain/components/hooks.ts'` = 2 before, 0 after). `PathAnchorContext` in `glob.ts` is therefore untouched and `glob.ts` appears in no commit (`git diff --name-only HEAD~2 HEAD -- .../glob.ts` returns nothing). The five `resolveAnchor` property accesses still reach the domain declaration through one transfer hop, which the analyzer follows.

### The `cwd` reclassification, reported as required

`ResolveHookIfContext.cwd` was `test-only-observed` with exactly one witness (`tests/domain/components/hooks.test.ts:141:14`, a test supplying its own inline `compileIf` callback). After the collapse it is **`runtime-observed` with 4 witnesses**, the production ones arriving through `if-field/index.ts` into `glob.ts`. Its recorded disposition **disappeared** from the "Members only tests read" section rather than moving; the regenerated record carries no `ResolveHookIfContext` row of any kind (`grep -c ResolveHookIfContext 06-LIVE-TRIAGE.md` = 0).

This is also the confirmation that the plan's stated mechanism was right rather than plausible: `cwd` was credited before precisely because a test read it off the domain-typed parameter, and it is credited by production now because production reads finally land on the same declaration.

## Collapse 2: the completions seam, taken halfway

**Direction: `edge -> orchestrators`.** Permitted by `{"from":"edge","allow":["orchestrators","domain","shared","platform"]}` and `eslint.config.js:195`; the reverse is forbidden by the `orchestrators` allow-list, which does not list `edge`, and by `eslint.config.js:200` ("orchestrators/ MUST NOT import from edge/"). So again the surviving declaration had to be the orchestrator one.

`MarketplaceStateRecordLike` (`orchestrators/edge-deps.ts`) is now the sole declaration of the state-record shape; `edge/completions/data.ts` keeps `MarketplaceStateRecord` exported with the same spelling as an alias of it, via a type-only import. The import is erased, so `edge/` gains no runtime dependency and the seam's whole point -- that `edge/` never imports `persistence/` or `domain/` -- is untouched. That cleared `:58:3`.

`LocationsResolver` was **not** collapsed. What follows is why, measured.

### The blocker: a different gate, quoted verbatim

Aliasing `edge/completions/data.ts::LocationsResolver` to `LocationsResolverLike` removes the only reference to `data.ts::MarketplaceStateRecord` inside the extension -- that reference was the `LocationsResolver` interface body itself. `fallow dead-code`, which the first run scopes to the production entry graph, then reports:

```
● Unused type exports (1)
  extensions/pi-claude-marketplace/edge/completions/data.ts
    :142 MarketplaceStateRecord
  Type exports with no known consumers
✗ 1 type
```

`npm run fallow` exits 1. **Both published forms the plan offered were tried and both produced the identical finding:**

| Form written in `data.ts` | `npm run fallow` |
| --- | --- |
| `export type MarketplaceStateRecord = MarketplaceStateRecordLike;` | exit 1, finding as above |
| `export type { MarketplaceStateRecordLike as MarketplaceStateRecord } from "../../orchestrators/edge-deps.ts";` | exit 1, same finding, reported with a `(re-export)` marker |
| the half-collapse that shipped (`LocationsResolver` kept, record aliased) | **exit 0** |

The finding is true rather than a tool artifact. After the alias the name's only remaining consumers are `tests/edge/completions/data.test.ts`, `tests/edge/completions/provider.test.ts` and `tests/architecture/flag-catalog-drift.test.ts`; `edge/completions/provider.ts` imports only `LocationsResolver`. The first `fallow dead-code` run excludes `tests/`, so a test-only published type export is exactly what it is.

**What was refused rather than done.** Three ways out were available and all three are the laundering this phase exists to prevent:

1. A `fallow-ignore` marker on the name -- forbidden by the plan by name, and it trades a reported finding for an unreported one.
2. A manufactured production consumer (a redundant `const record: MarketplaceStateRecord | undefined = ...` annotation, or a one-call helper that exists to name the type). The row would still have cleared from the alias either way, so the annotation's only job would be to keep a dead name alive for the gate.
3. Repointing the three test imports at `orchestrators/edge-deps.ts` and dropping the republish. This is the **correct** end state, and it is out of scope: the plan's `fails_when` fails the task if any of those four consuming test files is edited.

So the row stands, re-keyed to `:92:5` (derived from the edited source: line 92 column 5 is `marketplaces:` inside `loadStateForScope`'s return), with the above recorded in the triage ledger and in `.planning/WINDOWS.md`.

**Also refused, as the plan required by name:** returning the persistence state unprojected. It would clear the row, but it changes what `loadStateForScope` returns and `tests/orchestrators/edge-deps.test.ts:267-291` deep-compares that exact value. Behaviour, not a type repair. The projection loop is byte-identical -- see the non-comment diff below.

### The disproved comment is gone

`edge-deps.ts` claimed the two mirrors "MUST stay in sync" and that "a future rename would be caught by the edge-side TypeScript compile". The second claim was measured false in `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-root.md:36-37`. It is removed, and its replacement states what is now true and what actually guards the pair:

- the state-record shape **cannot** drift, because there is one declaration of it;
- the resolver shape **can**, and the comment says so explicitly, names the optional-field silent-omission class as the reason the compile does not catch it, and points at `tests/edge/register.test.ts` as the real guard.

The file header claim naming `edge/completions/data.ts` as the declaring file was corrected to match the split ownership. The BLOCK C rationale and both error contracts are untouched.

## No production behaviour changed, proved by the diff rather than by argument

Four files changed. The **entire** non-comment change set across all four is:

```
if-field/index.ts:  + import type { ResolveHookIfContext } from ".../domain/components/hooks.ts";
                    - export interface CompileIfPredicateContext { homedir; cwd; projectRoot }
                    + export type CompileIfPredicateContext = ResolveHookIfContext;

data.ts:            + import type { MarketplaceStateRecordLike } from "../../orchestrators/edge-deps.ts";
                    - export interface MarketplaceStateRecord { plugins? }
                    + export type MarketplaceStateRecord = MarketplaceStateRecordLike;

hooks.ts:           (nothing -- comments only)
edge-deps.ts:       (nothing -- comments only)
```

`edge-deps.ts` has **zero** non-comment changed lines: the two interfaces were re-emitted with identical members and member doc comments added, and `makeLocationsResolver` including its projection loop is untouched. Two type-only imports and two interface-to-alias conversions emit no JavaScript.

## Verification

Run once each on the final snapshot at `241f5faa`, in the foreground with the exit status captured directly.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` | **0** | typecheck, lint, all four fallow sub-gates, format, corresponding-tests, direct-coverage negative, 6535 unit tests (0 fail), 32 integration (30 pass, 2 environment-skipped for the absent global `pi-subagents` peer) |
| `node scripts/check-unused-type-members.mjs --json` | **1** | 6 findings, never 2 -- every contract coordinate resolves |
| `node scripts/check-unused-type-members.negative.mjs` | **0** | 7 of 7: baseline, offender-plant, benign-receiver-read, unrelated-same-spelling-read, plant-removed, compiler-failure, option-failure. `offender-plant` is the control an always-passing gate fails, and it passed |
| `node scripts/check-unused-type-members.audit.mjs --inventory` | **0** | 3348 candidates, 236 production files, 6 unresolved; digest `92dab823`, revision `241f5faa` |
| `node scripts/check-unused-type-members.audit.mjs --check` | **1** | 6 problems, **all six `unread`** -- zero stale-source, stale-record, missing, duplicate, incomplete or invalid. Exit 1 is by design while unread rows stand |
| `npm run test:coverage:unit` | **0** | see below |
| `npm run test:coverage:direct:all` | **0** | 236 pairs in 481s; 2 pinned shortfalls matched `scripts/test-coverage-direct.pin.json` exactly; the pin file is unmodified |

### The precondition

The plan's precondition is a green `npm run check` on the inherited tree. Spot-checked rather than re-run: `git diff --name-only b9f705d7..HEAD` at plan start returned only `.planning/` documents, so `extensions/`, `scripts/` and `tests/` were byte-identical to the tree 06-16 measured exit 0 on at `b9f705d7`. The final `npm run check` in this plan is the independent confirmation.

### Contract coordinates

Re-derived against the **current** `scripts/check-unused-type-members.contracts.json`, before the first edit and again after the last: **108 entries, of which 0 name any file this plan touches.** So this was a confirmation, not a re-anchoring, and no entry, `category`, `owner`, `key` or `purpose` changed. The file appears in no commit. The analyzer exited 1 at every measurement point and never 2.

### Coverage

Read out of the unmodified native `coverage/unit.lcov`, aggregated over the 227 `extensions/pi-claude-marketplace` modules:

| Metric | Inherited | Measured |
| --- | --- | --- |
| functions | 1833/1833 | **1833/1833** |
| branches | 9049/9049 | **9049/9049** |
| lines | 62940 | **62986/62986** |
| modules below 100 percent | 0 | **0** |

The line total moved and the movement is accounted for exactly rather than accepted. `git diff --numstat c45fdf04..HEAD -- extensions/` is 80 insertions, 34 deletions, **net +46**; `LF` rose by **46** and `LH` rose by the same 46. lcov's `LF` here tracks total source lines, so the comment and declaration lines added are the whole delta, one for one. Functions and branches -- the figures that measure emitted JavaScript -- are byte-identical, which is what a type-level change must produce. No threshold was lowered, no source excluded, no pin re-anchored.

## A recorded disposition this plan judges mis-assigned

06-15's "Next Phase Readiness" grouped six rows under "two new evidence categories", counting "a `satisfies`-constraint category (4 rows across `hook-if-targets.ts` and `hooks.ts`)" (`06-15-SUMMARY.md:644`).

**That grouping was wrong for the two `hooks.ts` rows, and the evidence is this plan.** `ResolveHookIfContext.homedir` and `.projectRoot` were not constrained by any `satisfies` expression; they were a duplicate declaration whose reads resolved one hop past them, and they cleared by deleting the duplicate with **no engine change at all** -- no new category, no new contract entry, no widened proof. The triage rows themselves said so; the summary's forward-looking grouping did not agree with them.

The other two rows in that group, `hook-if-targets.ts:55:3` and `:56:3`, really were `satisfies`-constrained, and 06-16 cleared them with the real `satisfies-constraint` category. The correction applies only to the `hooks.ts` half.

## Deviations from Plan

### 1. [Rule 4 escalation resolved in-plan] The completions collapse was taken halfway

- **Found during:** Task 2
- **Issue:** The plan's `<behavior>` requires zero unread members for `orchestrators/edge-deps.ts` and its `must_haves` requires "exactly ONE declaration of the resolver shape". The full collapse makes `npm run fallow` exit 1 on a newly-dead type export, and `npm run check` exit 0 is a hard success criterion of the same plan.
- **Attempts:** Two, both measured, both recorded above -- the direct alias form and the `export type {...} from` re-export form. Both produced the identical `fallow` finding.
- **Resolution:** Took the half that is free (the state-record shape) and left the half that is not, with the blocking finding quoted and the clean resolution handed to a later owner. This follows the plan's own standing constraint: "If a collapse breaks a boundary or changes behaviour, leave the row and record why. An honest outstanding row beats a boundary violation."
- **Why not escalated to the user:** the plan pre-authorises exactly this outcome for a blocked collapse and forbids all three shortcuts that would have forced it through.
- **Commit:** `241f5faa`

### 2. [Documentation] Task 2's automated verify assertion does not hold, by construction

- **Found during:** Task 2
- **Issue:** The task's `<verify>` ends with `test "$(... | grep -c 'orchestrators/edge-deps.ts')" = 0`, which fails because `:92:5` stands.
- **Resolution:** Recorded rather than worked around. Every other clause of that verify command passed: `npm run typecheck`, `npm run lint`, `npm run fallow` and all six named test files (351/351, unmodified).

**Total deviations:** 2 recorded, 0 auto-fixed source bugs. **Impact:** three of four owned rows cleared; the fourth is documented to a standard a reader can re-derive from source in one command.

## `fails_when` counterexamples exercised

| Clause | Evidence |
| --- | --- |
| collapse runs `domain -> bridges` | Not taken: `domain/components/hooks.ts` has no new import (its diff is comments only); the import added is `bridges -> domain` |
| a published name is deleted rather than aliased | `export type CompileIfPredicateContext` and `export type MarketplaceStateRecord` both present, same spellings |
| a structural pin test is edited | No test file appears in any commit (`git diff --name-only HEAD~3 HEAD` lists 4 source files + 2 planning docs) |
| step B taken when step A sufficed | `glob.ts` appears in no commit |
| a row clears because a reader, test or contract entry was added | Contracts 108 -> 108, no test added, and the non-comment diff is two imports and two aliases |
| a duplication comment survives the collapse | `grep` for "duplicated here" / "MUST stay in sync" / "would be caught by the edge-side TypeScript compile" returns nothing in the four files |
| collapse runs `orchestrators -> edge` | `edge-deps.ts` gained no import; `data.ts` gained the type-only import |
| the projection loop or the resolver's return value changes | `edge-deps.ts` has **zero** non-comment changed lines |
| a consuming test file is edited | None of the four appears in any commit |
| any finding gained | `comm -13` is empty |
| the analyzer exits 2 and the run continues | Exit was 1 at every one of the four measurement points |
| a threshold, exclusion, pin or suppression adjusted to pass | `scripts/test-coverage-direct.pin.json` and `.fallowrc.json` unmodified; no `fallow-ignore` added (repo-wide count unchanged) |
| a measured figure restated from the prediction | Every number above is read out of the real CLI; the one prediction that missed is stated as a miss in the first table |

## Known Stubs

None. No placeholder, empty-value or TODO surface was introduced.

## Naming observation deferred to a later owner

The `Like` suffix now records two different things and should not stay as one convention:

- `MarketplaceStateRecordLike` is **no longer** "like" anything -- it is the single declaration, and `edge/completions/data.ts::MarketplaceStateRecord` is the alias of it. The suffix records history.
- `LocationsResolverLike` **is** still structurally-alike-but-separate, so its suffix is still accurate.

A rename of the first was available and not taken: it churns the implementation and its paired test for zero rows. A later owner that repoints the three test imports and finishes the resolver collapse should rename both at the same time, when both become inaccurate together.

## The final residual: six rows, each with its mechanism

| Row | Mechanism | Owner |
| --- | --- | --- |
| `edge-deps.ts:92:5` `LocationsResolverLike.loadStateForScope.marketplaces` | Cross-boundary mirror whose remaining half cannot collapse without a `fallow` dead-type-export finding on the sibling republished name; the clean fix moves three test imports | A plan holding `tests/edge/completions/{data,provider}.test.ts` and `tests/architecture/flag-catalog-drift.test.ts` |
| `plugin/shared.ts:129:5` `enableRowDependencies.signals.partition` | WR-01 refusal marker; no left operand declares the slot, so no restatement reaches the prover, and weakening it reintroduces the bug it prevents | A decision, not a repair |
| `types.ts:155:3` `UpdatePhaseFailure.msg` | Rollback-populated structured surface; a slot a rollback path writes is behaviour even with no reader today | A decision, not a repair |
| `info.messaging.ts:68:69` `PLUGIN_INFO_RENDER.status` | Family-consistent `Extract<Msg, {status: K}>` filter over a single-variant union the prover cannot discriminate; dropping it widens every arm the moment info gains a second cascade status | A decision, not a repair |
| `git-auth-callbacks.ts:41:39`, `:42:34` `AuthAttemptResult.authAttempted` (x2) | Recorded decision D-32-05 put the marker on both arms deliberately; revoking it is out of any repair plan's authority | Revisiting D-32-05 |

Five of the six are unchanged from the residual this plan inherited. The sixth is this plan's own, and it is the only one whose blocker is a tooling interaction rather than a decision.

## Issues Encountered

None beyond the recorded deviations.

## Next Phase Readiness

**Ready for 06-08 (activation) with one honest qualification.** The live population is 6, not the 5 the activation plan was sized against, and every one of the six carries a disposition that `--check` accepts. Activation still has to decide the same question it always had -- whether a mandatory gate ships with an explained residual or with none -- and this plan moves the answer by exactly one row in that decision's favour without changing its shape.

The one new piece of information for 06-08: `edge-deps.ts:92:5` is the only standing row whose blocker is **removable by a bounded mechanical change** (three test imports), as distinct from the five that need a decision. If activation wants a five-row residual, that is the cheapest row to buy.

## Self-Check: PASSED

- `.planning/phases/06-unused-type-member-gate/06-17-SUMMARY.md` -- FOUND
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` -- FOUND, regenerated, digest `92dab823`
- `58530151` -- FOUND (`refactor: publish the if-field anchor context as one declaration`)
- `241f5faa` -- FOUND (`refactor: declare the completions state-record shape once`)
- `4d80d5e2` -- FOUND (`docs: reconcile the member record after the two collapses`)
- All four modified source files present and type-checking; `npm run check` exit 0 on the final snapshot
