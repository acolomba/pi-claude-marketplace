---
phase: 06-unused-type-member-gate
plan: "08"
subsystem: testing
tags: [typescript, static-analysis, gate, pre-commit, negative-control, activation, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The runnable gate, its three-way exit contract and its `--json` report
  - phase: 06-unused-type-member-gate
    provides: The seven executable sensitivity controls and their measured cost
  - phase: 06-unused-type-member-gate
    provides: The audit that records and reconciles the live population
  - phase: 06-unused-type-member-gate
    provides: The 6-row live residual, with the mechanism named for each
provides:
  - "`lint:type-members` and `lint:type-members:negative` in the mandatory `npm run check` chain, which is also what CI runs"
  - "Two local pre-commit hooks with `pass_filenames: false`, on deliberately different triggers"
  - "`scripts/check-unused-type-members.exceptions.mjs` + `.json`: the per-row recorded-decision layer that makes activation possible without a count, a threshold or a path pattern"
  - "A stale-entry rule that refuses the run, so a repaired member takes its own allowance with it"
  - "A measured 6 -> 5 live population: the resolver mirror collapsed, three test imports repointed, zero findings gained"
  - "`docs/unused-type-member-gate.md`: invocation, supported operations, the plant procedure, contract drift including the `node_modules/` edge, and the may-observe limitation"
  - "19 new controls, one of which plants a new unread member into the real tree and requires the real gate to fail on it alone"
affects: []

actuals:
  tokens: 29333
  tasks: 3
  commits: 5
plan_head_before: a0e96bae3b2410796f92f28747580237a3b99b7a

tech-stack:
  added: []
  patterns:
    - "The analyzer never excuses anything; a separate, later layer applies recorded decisions to the exit status, so the record keeps counting what the analysis measured"
    - "A residual allowance is made un-widenable by the SHAPE of its file: the identity field admits no pattern character and any field outside the five is a setup failure"
    - "An allowance that matches no finding refuses the run, so the list self-expires instead of outliving its reason"
    - "A hook trigger is asserted by exercising it against sample paths, so narrowing or widening it is an edit someone has to make on purpose"

key-files:
  created:
    - scripts/check-unused-type-members.exceptions.mjs
    - scripts/check-unused-type-members.exceptions.json
    - docs/unused-type-member-gate.md
    - .planning/phases/06-unused-type-member-gate/06-08-SUMMARY.md
  modified:
    - package.json
    - .pre-commit-config.yaml
    - scripts/check-unused-type-members.mjs
    - tests/scripts/check-unused-type-members.test.ts
    - tests/architecture/unused-type-member-gate.test.ts
    - tests/architecture/gate-targets.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - tests/edge/completions/data.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/architecture/flag-catalog-drift.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md
    - .planning/WINDOWS.md

key-decisions:
  - "The plan's literal instruction -- both scripts in the check chain -- was followed exactly. What was NOT followed literally is `a local pre-commit hook that invokes the same pair`: two hooks were added instead of one, on different triggers, because the negative runner's subject is the gate's machinery and not the tree"
  - "The recorded-decision layer lives in the CLI, not in the analyzer. `audit.mjs` calls `analyzeProject` directly, so `--inventory` and `--check` still report all five members as unread. A decision changes the exit status and nothing else"
  - "An exception entry that matches no reported finding is a SETUP FAILURE, not a harmless leftover. Without that rule the list would outlive its reasons and become a mute button"
  - "An `unsupported-analysis` finding can never be excused. That status is the analyzer saying it could not decide, and a decision cannot stand in for an analysis nobody made"
  - "T0 succeeded, so the residual is five rather than six. The three consuming test imports were repointed at the surviving declaration and the republished name was dropped, which is exactly the resolution 06-17 measured and handed on"
  - "No `fallow-ignore` was added, no consumer was manufactured, and no dead-code run was weakened -- the three escapes 06-17 refused and this plan refused again"

requirements-completed: [MEMBER-01, MEMBER-02]

coverage:
  - id: D1
    description: "The mandatory check chain and the pre-commit hooks both run the whole-project gate and its negative controls, and CI runs the same chain"
    requirement: MEMBER-01
    verification:
      - kind: other
        ref: "npm run check -- exit 0 in 14m21s, tail reads `Unused type member gate passed with 5 recorded exception(s)` then `negative controls passed (7 of 7)`"
        status: pass
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#the mandatory check chain runs the gate and its negative controls"
        status: pass
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#continuous integration runs the same chain the local path runs"
        status: pass
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#both member hooks analyse the whole project rather than the changed files"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --files <T1 set> -- both member hooks Passed on the real commit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Removing the sole reader in any production or test file triggers the gate, and configuration or contract changes cannot bypass it"
    requirement: MEMBER-01
    verification:
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#the gate hook triggers on every input that can change what the gate reports -- 9 inputs matched, 3 non-inputs refused"
        status: pass
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#the negative hook triggers on the gate's own machinery and not on ordinary source"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#removing the only test read leaves the same member unread"
        status: pass
    human_judgment: false
  - id: D3
    description: "A new unread member outside the recorded decisions still fails the gate, proved against the real tree"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#a new unread member outside the recorded decisions fails the real gate -- real gate, real repository, read overlay, exit 1 with exactly the planted id and all 5 decisions still excused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#a member outside the recorded decisions still fails the gate"
        status: pass
      - kind: other
        ref: "scripts/check-unused-type-members.negative.mjs (control: offender-plant) -- the control an always-passing gate fails, passing with the decisions active"
        status: pass
    human_judgment: false
  - id: D4
    description: "The residual is exact member coordinates with measured mechanisms, and it cannot be widened into a count, a threshold or a path glob"
    requirement: MEMBER-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#an identity carrying a pattern character is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#an unknown field is refused, so a count or a threshold cannot be recorded"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#a mechanism too short to state what was measured is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-unused-type-members.test.ts#a recorded decision that matches no finding refuses the run"
        status: pass
      - kind: unit
        ref: "tests/architecture/unused-type-member-gate.test.ts#every recorded decision names one exact member and states a measured mechanism"
        status: pass
    human_judgment: false
  - id: D5
    description: "Aggregate production unit coverage stays at 100 percent and every direct-pair pin is unchanged"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "coverage/unit.lcov over 227 extension modules -- 1833/1833 functions, 9049/9049 branches, 62971/62971 lines, 0 modules below 100 percent"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -- exit 0, 236 pairs in 482.4s, 2 pinned shortfalls matched exactly, scripts/test-coverage-direct.pin.json unmodified"
        status: pass
    human_judgment: false
  - id: D6
    description: "The published reference states the bounded claim, the plant procedure, the contract drift controls and the one sanctioned residual form"
    requirement: MEMBER-02
    verification:
      - kind: other
        ref: "docs/unused-type-member-gate.md -- 204 lines; mdformat and markdownlint-cli2 pass"
        status: pass
    human_judgment: true
    rationale: "Whether the document is USEFUL to a future reader is a judgment no test makes. The gates prove it is well-formed and that its claims match the shipped help text; they do not prove it explains well."

duration: 3h 52m
completed: 2026-09-17
---

# Phase 6 Plan 8: Activating the Unused Type Member Gate Summary

**The gate becomes mandatory: `lint:type-members` and `lint:type-members:negative` join the `npm run check` chain CI already runs, two pre-commit hooks invoke the same pair over the whole project, and the tree's last mechanical row is repaired so that the residual is five named members -- each carried by a per-row recorded decision stating its exact coordinate and its measured mechanism, and none of it expressible as a count, a threshold or a path pattern.**

## The trajectory, end to end

| Stage | Unread members |
| --- | --- |
| First live run | 614 |
| Analyzer corrections | 468 |
| Analyzer corrections | 261 |
| Analyzer corrections | 138 |
| Six source repairs | 33 |
| Analyzer plan 06-15 | 16 |
| Analyzer plan 06-16 | 9 |
| Source plan 06-17 | 6 |
| **This plan** | **5** |

Five of the remaining six were decisions before this plan started. The sixth was a bounded cleanup that 06-17 measured precisely and could not take, because its own `fails_when` forbade editing test files. This plan took it.

## T0: the last mechanical row

**Row:** `orchestrators/edge-deps.ts:92:5` -- `LocationsResolverLike.loadStateForScope` -> `marketplaces`.

06-17 left it standing with the blocker quoted verbatim: aliasing `edge/completions/data.ts::LocationsResolver` onto the orchestrator declaration removes the only in-extension reference to `data.ts::MarketplaceStateRecord`, after which the production-scoped `fallow dead-code` run reports `data.ts:142 MarketplaceStateRecord` under "Unused type exports" and `npm run fallow` exits 1. The finding was true: after the alias the name's only remaining consumers were three test files, and that run excludes `tests/`.

**What was done.** The three test imports were repointed at the surviving declaration and the republished name was dropped entirely:

| File | Change |
| --- | --- |
| `tests/architecture/flag-catalog-drift.test.ts` | `MarketplaceStateRecord` -> `MarketplaceStateRecordLike`, imported from `orchestrators/edge-deps.ts` |
| `tests/edge/completions/data.test.ts` | same |
| `tests/edge/completions/provider.test.ts` | same |
| `extensions/.../edge/completions/data.ts` | `export type MarketplaceStateRecord` deleted; `export interface LocationsResolver` became `export type LocationsResolver = LocationsResolverLike` |

The import direction was verified before it was relied on: `.fallowrc.json` permits `{"from":"edge","allow":["orchestrators",...]}`, and `orchestrators -> edge` is the forbidden direction. The surviving declaration therefore had to be the orchestrator one, which is where it already was. `edge/completions/provider.ts` still imports `LocationsResolver` from `data.ts`, so that alias keeps a production consumer and does not become the next dead type export.

**None of the three escapes was taken.** No `fallow-ignore` was added (repo-wide count unchanged), no consumer was manufactured, and no dead-code run was weakened. The blocking finding is gone because the name it named no longer exists, not because anything stopped reporting it.

**Measured delta, as a `(path, owner, key)` set difference:** the only row that left is `edge-deps.ts:92:5`. Nothing was gained.

| Count | Before | After |
| --- | --- | --- |
| `unread` | 6 | **5** |
| `candidates` | 3348 | **3344** |
| `runtimeObserved` | 2995 | **2992** |
| `testOnlyObserved` | 239 | **239** |
| `explicitContract` | 108 | **108** |
| `unsupportedAnalysis` | 0 | **0** |
| `productionFiles` | 236 | **236** |

The candidate arithmetic checks out exactly: the deleted `LocationsResolver` interface declared four members (`pluginCachePath`, `loadStateForScope`, the nested `marketplaces`, `loadManifestForMarketplace`), three of which were `runtime-observed` and one `unread`.

## The problem activation actually had, and how it was solved

The plan as amended says closure means **every finding is absent or carried by a named per-row exception stating the exact member coordinate and its measured mechanism.** The gate shipped with no way to express that. Its help text said so plainly: the contracts file "is the only source of accepted exceptions", and every contract category is a claim the engine PROVES. Two of the five standing rows had already been submitted to that engine and refused on purpose.

So the gate could not be activated as it stood: adding `lint:type-members` to `npm run check` would have made `npm run check` exit 1 on the first run.

**What was built** (deviation 1 below): `scripts/check-unused-type-members.exceptions.json`, validated and applied by `scripts/check-unused-type-members.exceptions.mjs`, consumed by the command-line entry point.

### Where it lives, and why that matters

The layer is in the **CLI**, not in the analyzer. `check-unused-type-members.audit.mjs` calls `analyzeProject` directly and never sees it. So:

- `--inventory` still records all five members as `unread` in the live population;
- `--check` still reports all five and still exits 1;
- `report.members` and `report.counts` are byte-identical to what the analyzer measured.

Only `report.findings` -- which is what the exit status answers for -- is narrowed, and the excused rows move into `report.exceptions` where they are still named. **A recorded decision changes the exit status and nothing else.** The population never moves because someone wrote something down.

### What an entry must carry

| Field | Requirement |
| --- | --- |
| `id` | one exact `path:line:column`, matched against `/^[^\s:*?[\]{}]+:[1-9][0-9]*:[1-9][0-9]*$/` |
| `owner` | exactly as the gate reports it |
| `key` | exactly as the gate reports it |
| `decision` | where the decision is recorded |
| `mechanism` | at least 120 characters of what was tried and what was observed |

### The four rules that keep it from becoming a mute button

1. **An entry that matches no reported finding is a setup failure (exit 2).** A repaired member takes its own allowance with it; a drifted coordinate refuses the run instead of excusing whatever now sits there.
1. **Matching coordinates with a different `owner` or `key` is a setup failure.** Identity is the triple, not the location.
1. **An `unsupported-analysis` finding can never be excused.** That status is the analyzer reporting it could not decide, and a decision cannot stand in for an analysis nobody made.
1. **Every excused member is printed on every run**, passing or failing alike, with the decision that accepted it.

A count, a threshold and a path glob are not "discouraged" here -- they are **unwritable**. The identity pattern rejects every glob metacharacter, and any field outside the five above is refused by name (`maximumUnread: 6` produces `carries an unknown field maximumUnread`). Each of those refusals has its own control.

## The five recorded decisions

Printed by the gate on every run:

| Coordinate | Member | Mechanism |
| --- | --- | --- |
| `orchestrators/plugin/info.messaging.ts:68:69` | `PLUGIN_INFO_RENDER.status` | A `type-selection` draft was submitted to the real engine and refused: `PluginInfoCascadeMsg` is a single variant, so the selected-over type is not a union and discriminates nothing. The draft was withdrawn, not reshaped. The filter was not dropped -- every sibling render map carries the same `Extract<Msg, { status: K }>` shape with an accepted entry, and dropping it hands each arm the whole union the moment info gains a second cascade status. |
| `orchestrators/plugin/shared.ts:129:5` | `enableRowDependencies.signals.partition` | A `partition?: never` refusal marker. `LedgerDegradationSignals` declares no `partition` and the `Pick<...>` left operand declares none either, so there is no slot to narrow and every restatement ADDS a key -- the `type-refinement` prover refuses it by construction, not by coordinate. Its documented job (WR-01) is to refuse `PluginUpdateUpdatedOutcome`, which would otherwise match structurally and silently return an empty dependency list for every update. |
| `orchestrators/types.ts:155:3` | `UpdatePhaseFailure.msg` | Populated by exactly one path, the phase-3 rollback aggregation, whose header states the contract: surface failures structurally so the cascade renderer can build the rollback-partial parent plus indented children. A slot a rollback path populates is behaviour even with no reader today; deleting it forces a future consumer to re-parse per-phase text out of `notes` prose. |
| `platform/git-auth-callbacks.ts:41:39` | `AuthAttemptResult.authAttempted` | D-32-05 put the marker on both arms deliberately, and the declaration's own comment states the implementation never branches on it. The structural twin `DeviceFlowResult.authAttempted` is `test-only-observed` with 36 witnesses; the platform copy exists only because `platform/README.md` forbids a platform -> domain import. Clearing this means revisiting D-32-05. |
| `platform/git-auth-callbacks.ts:42:34` | `AuthAttemptResult.authAttempted` | The second arm of the same decision. Listed separately because the list is per exact coordinate, never per type. |

Every one of them is also recorded in `06-LIVE-TRIAGE.md` (which still counts them as unread) and in `.planning/WINDOWS.md` as a waived entry, so the residual is visible in the three places a reader would look.

## The cost decision

The plan does not settle whether the negative runner belongs in the mandatory chain. It is settled here, measured, and split by axis.

| Invocation | Whole-program analyses | Wall clock | Peak resident |
| --- | --- | --- | --- |
| `npm run lint:type-members` | 1 | **1 m 21 s** | -- |
| `npm run lint:type-members:negative` | 5 | **6 m 50 s** | **2.12 GiB** |
| `npm run check` (before) | 0 | ~6 m | -- |
| `npm run check` (after) | 7 | **14 m 21 s** | **2.53 GiB** |

**`npm run check`: both, exactly as the plan says.** It is a deliberate, infrequent invocation, and it is what CI runs, so CI's invocation is the same one you run locally and cannot be weaker.

**Pre-commit: two hooks, two triggers.** This is the deviation, and the reasoning is a claim about what the negative runner's SUBJECT is.

The gate measures the tree, so any `.ts` change can alter what it reports and the gate hook must fire on all of them. The negative runner measures whether **the gate** can still see an offender -- and that question is settled by the analyzer modules, its contract and decision records, the compiler inputs, and the declaration the plant goes into. **No ordinary edit under `extensions/` can change the answer.** Running five whole-program analyses on every source commit would buy nothing and cost seven minutes, and a hook people route around is worse than a slower CI. `--no-verify` is forbidden by project policy, which makes the edit-loop cost a real risk rather than an inconvenience.

The measurement that settled it: committing the analyzer changes ran the full hook set and **exceeded ten minutes**, which is what an analyzer commit now costs. A commit touching only `extensions/**.ts` costs about 85 seconds. That gap is what the narrowed trigger buys, and it is bought without losing the proof -- the controls still run in full on every `npm run check`, local and CI alike.

Both triggers are asserted by exercising them against sample paths (`tests/architecture/unused-type-member-gate.test.ts`), including the explicit statement that an ordinary `extensions/` edit is outside the negative trigger. Widening or narrowing either one is an edit someone has to make there on purpose.

## The `node_modules/` contract-coordinate edge

Three contract entries resolve an `upstream` coordinate inside

```text
node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts
```

They are the two `external-input` entries (`ResourcesDiscoverEvent.type` at `:405:5` and `.reason` at `:407:5`) and the one `external-mirror` entry (`ResourcesDiscoverResult.themePaths` at `:413:5`), all owned by `platform/pi-api.ts`. `resolveNode(parseSite(entry.upstream, ...))` resolves each one for real, so upgrading the peer moves those lines and the gate refuses all three **by name with exit 2 before any member verdict**. That fails safe, and it looks alarming if you are not expecting it.

It is documented in `docs/unused-type-member-gate.md` under "The peer-upgrade edge", with the fix: open the new `types.d.ts`, find the same three slots, and update the `upstream` coordinates in the same commit as the upgrade.

## Controls added

**19 in total**, none of which passes without running the thing it names.

`tests/scripts/check-unused-type-members.test.ts`, **+11** (18 -> 29). Written against the ways the list could become a mute button rather than against how it is meant to be used: a pattern instead of a coordinate, a count instead of a member, a word instead of a mechanism, an entry that outlived its finding, a drifted coordinate, a mismatched owner, a duplicate, another schema version, an `unsupported-analysis` verdict, a member outside the list, and no list at all.

`tests/architecture/unused-type-member-gate.test.ts`, **+8** (4 -> 12). The check chain, the CI invocation, both hooks' `pass_filenames`, both triggers exercised against sample paths, the decision list's shape, the decision list's liveness against current source, and:

**"a new unread member outside the recorded decisions fails the real gate"** -- the control the orchestrator's success criteria name. It plants `RecordedDecisionControl.neverExcusedAnywhere` into the real `edge/types.ts` through a compiler read overlay, runs the real gate over the real repository, and requires exit 1 with the findings being **exactly** the planted identity while all five decisions stay excused. It also reads the file back to prove the overlay never touched disk. It costs about 80 seconds, which is the price of proving the shipped list against the shipped tree rather than against a fixture.

The claim-to-control ledger gained three rows binding the help text's recorded-decision claims to those controls, so a renamed case fails here instead of quietly widening what the gate is believed to prove.

## Verification results

Each command run in the foreground with its exit status captured, on one snapshot at `03f9773c`.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` | **0** | 14 m 21 s, 2.53 GiB peak. typecheck, lint, both workflow gates, all four fallow sub-gates, format, both corresponding-test gates, the direct-coverage negative gate, **6555 unit tests (0 fail)**, 32 integration (30 pass, 2 environment-skipped), then the member gate and its negative controls |
| `npm run lint:type-members` | **0** | `passed with 5 recorded exception(s)`, all five named on stderr with their decisions |
| `npm run lint:type-members:negative` | **0** | 7 of 7: baseline, offender-plant, benign-receiver-read, unrelated-same-spelling-read, plant-removed, compiler-failure, option-failure. 6 m 50 s, 2.12 GiB |
| `node scripts/check-unused-type-members.audit.mjs --inventory` | **0** | 3344 candidates, 236 production files, 5 unresolved; digest `84197cf6`, revision `7fd6b12a` |
| `node scripts/check-unused-type-members.audit.mjs --check` | **1** | 5 problems, **all five `unread`** -- zero stale-source, stale-record, missing, duplicate, incomplete or invalid. Exit 1 is by design: the record never excuses anything |
| `npm run test:coverage:unit` | **0** | see below |
| `npm run test:coverage:direct:all` | **0** | 236 pairs in 482.4 s; 2 pinned shortfalls matched `scripts/test-coverage-direct.pin.json` exactly; the pin file is unmodified |
| `SKIP=trufflehog pre-commit run --files ...` | **0** | run before each of the five commits; both member hooks Passed on the T1 set |

`baseline` deserves a note: with the decisions active the real tree reports **zero findings and exits 0**, and the negative runner accepted that. Its `reportFrom` checks the exit status against what the report itself says, so a gate whose status and findings disagreed would have been caught there rather than assumed.

### Coverage

Read out of the unmodified native `coverage/unit.lcov`, aggregated over the 227 `extensions/pi-claude-marketplace` modules:

| Metric | Inherited | Measured |
| --- | --- | --- |
| functions | 1833/1833 | **1833/1833** |
| branches | 9049/9049 | **9049/9049** |
| lines | 62986/62986 | **62971/62971** |
| modules below 100 percent | 0 | **0** |

The line total moved by **-15** and the movement is accounted for exactly rather than accepted. `git diff --numstat` over `extensions/` for T0 is `data.ts` 11+/30- and `edge-deps.ts` 25+/21-, net **-15**. `LF` fell by 15 and `LH` by the same 15. Functions and branches -- the figures that measure emitted JavaScript -- are byte-identical, which is what a type-only change must produce. No threshold was lowered, no source excluded, no pin re-anchored.

### Contract coordinates

Re-derived against the current `scripts/check-unused-type-members.contracts.json` before the first edit and again after the last: **108 entries, of which 0 name any file this plan touched.** Every run reported `contracts: 108 validated` and the analyzer exited 1 or 0, never 2. The file appears in no commit.

## Deviations from Plan

### 1. [Rule 2 - missing critical functionality] The recorded-decision layer was built

- **Found during:** Task 1, before any activation edit.
- **Issue:** The amended plan's closure rule requires "a named per-row exception stating the exact member coordinate and its measured mechanism", and the gate had no way to express one. Its only exception mechanism was the contract file, every category of which the engine proves -- and two of the five standing rows had been submitted to that engine and refused on purpose. Adding `lint:type-members` to `npm run check` as it stood would have made the mandatory chain exit 1 on its first run.
- **Fix:** `scripts/check-unused-type-members.exceptions.mjs` (the loader, validator and applier) and `scripts/check-unused-type-members.exceptions.json` (the five rows), wired into the command-line entry point after the analysis and validated before it.
- **Why this is not scope creep:** without it the plan's own objective is unreachable. The amendment says zero is not reachable and names the form the residual must take; nothing in the tree could take that form.
- **What was deliberately NOT done:** the layer was not added to the analyzer, no contract category was invented to absorb the rows, and no existing category was widened to accept a draft it had already refused.
- **Files:** `scripts/check-unused-type-members.{mjs,exceptions.mjs,exceptions.json}`, `tests/scripts/check-unused-type-members.test.ts`
- **Commit:** `3673f8fd`

### 2. [Rule 3 - measured cost] The pre-commit pair became two hooks on two triggers

- **Found during:** Task 1.
- **Issue:** The plan says "add a local pre-commit hook that invokes the same pair". One hook on the gate's trigger would put five whole-program analyses -- 6 m 50 s and 2.12 GiB -- on every commit touching a `.ts` file.
- **Fix:** two hooks. `npm-type-members` fires on production and test `.ts`, the analyzer scripts, both records, `tsconfig.json`, the manifests and the hook config. `npm-type-members-negative` fires on the gate's own machinery plus the declaration the plant goes into, and not on ordinary source.
- **Measurement behind it:** committing the analyzer changes ran the full hook set and exceeded ten minutes. A commit touching only `extensions/**.ts` costs about 85 seconds.
- **What is NOT lost:** the controls still run in full on every `npm run check`, which is also what CI runs. Nothing about the plan's "CI no weaker than local" constraint is affected -- both run the same chain.
- **Files:** `.pre-commit-config.yaml`, `tests/architecture/unused-type-member-gate.test.ts`
- **Commit:** `3673f8fd`

### 3. [Environment, not a regression] One test reads the real home directory

- **Found during:** Task 2.
- **Issue:** the first `npm run check` failed at `tests/orchestrators/marketplace/remove.test.ts` -- "swallows clone garbage-collection failure and safely reports the retry" -- with `state.json at /home/acolomba/.pi/agent/pi-claude-marketplace/state.json has an unsupported schema version`. The suite reads the operator's real `~/.pi/agent/`.
- **Resolution:** re-run under a hermetic `HOME`. The suite passes 24/24 in isolation, and the recorded `npm run check` exit 0 is the hermetic run. **This is not a defect this plan introduced and it was not repaired here** -- it is a pre-existing hermeticity leak in a file outside this plan's scope.
- **Consequence worth stating:** the first run stopped at `npm test` and never reached the member gate. The recorded result is the complete hermetic run, not a patched-together one.

**Total deviations:** 2 deliberate, 1 environment observation. **Impact:** no gate was weakened. No suppression, census pin, threshold override, coverage exclusion or assertion relaxation was added, and the gate is now inside `npm run check` rather than outside it.

## `fails_when` counterexamples exercised

| Clause | Evidence |
| --- | --- |
| activation precedes closure | Closure reached first: T0 cleared the last mechanical row, and the five that remain are each carried by a named per-row exception before `npm run check` ever invoked the gate |
| CI uses a weaker invocation | CI runs `npm run check` (`.github/workflows/ci.yml:80`), which is the same chain; asserted by "continuous integration runs the same chain the local path runs" |
| deleting a reader misses the hook | The gate hook's trigger is exercised against nine inputs including a production file that declares nothing of its own and a test file; both match |
| any existing quality gate dropped | `scripts.check` gained two entries and lost none; the full chain ran green |
| the exception list is anything but exact member coordinates | The identity field rejects every glob metacharacter and any sixth field is refused by name; both have their own control, and the architecture test re-states the requirement against the shipped file |
| the list may grow without a recorded decision | Every entry carries a required `decision` field and a 120-character `mechanism` floor; a short mechanism is refused with its measured length |
| a listed row loses its mechanism | Same floor, plus "every recorded decision names one exact member and states a measured mechanism" |
| a new unread member outside the list passes | Proved live against the real tree with a read overlay, and again in the fixture suite, and again by `offender-plant` |
| coverage comes from integration or E2E | The figures above are read out of `coverage/unit.lcov`, written by `test:coverage:unit` |
| any production metric below 100 percent | 1833/1833 functions, 9049/9049 branches, 0 modules below |
| direct floors change | `scripts/test-coverage-direct.pin.json` appears in no commit; 2 pinned shortfalls matched exactly |
| a new allowance masks findings | The five allowances are each printed on every run, are each an exact coordinate, and each refuses the run if it stops matching |
| evidence predates a source change | Every figure above was measured on the snapshot at `03f9773c`, after the last source commit `3673f8fd` |

## Known Stubs

None. No placeholder value, empty-value surface, unwired output, committed `skip` or `todo`, and no control that passes without running the thing it names.

The five recorded decisions are not stubs. They are members that measurably have no reader, each with a stated reason why removing it would be wrong, each visible on every run of the gate, and each recorded in `06-LIVE-TRIAGE.md` and `.planning/WINDOWS.md`.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at a trust boundary.

T-06-08-01 (candidate provenance and contract evidence) is mitigated by the exception layer matching on the full `(id, owner, key)` triple rather than on coordinates alone, and by refusing an entry that matches nothing. T-06-08-02 (compiler inputs and subprocess controls) by the new architecture control driving the gate through `spawnSync` with an argv array and no shell, applying its plant as a compiler read override and reading the target back afterwards. T-06-08-03 (resource exhaustion) is unchanged -- the budget refusal still exits 2 with no report, and the recorded-decision layer cannot excuse an `unsupported-analysis` verdict, so a cutoff still cannot return clean. T-06-08-04 (gate acceptance) by the decisions being printed on every run, by the record continuing to count them as unread, and by the nineteen controls above.

## Observed Limits

- **`npm run check` now costs about 14 minutes.** Seven whole-program analyses, 2.53 GiB peak. That is the price of a gate that is actually mandatory.
- **The gate is a floor, not a verdict.** It reports that some run-time syntax *could* read a member. It does not claim the branch executes, that the value influences behaviour, or that an asserting test is a useful one. This is stated in the help text, in the published reference and here, because a green run that reads as "these members are fine" is the way this gate would do the most damage.
- **A live negative run and concurrent editing do not mix.** The runner analyses the tree as it is on disk when each child starts, and it takes minutes.
- **The decision list needs a periodic reader, not just a gate.** The stale-entry rule guarantees a decision cannot outlive its member, and the per-run printing guarantees it stays visible. Neither guarantees anyone revisits D-32-05.
- **One test still reads the real home directory.** `tests/orchestrators/marketplace/remove.test.ts` fails outside a hermetic `HOME`, and it is not this plan's to repair.

## Issues Encountered

None beyond the recorded deviations. The one failure encountered was the pre-existing hermeticity leak in deviation 3.

## Next Phase Readiness

**The phase is complete.** The gate the phase set out to build is running in the normal quality path, it fails on a new unread member anywhere in the tree, and the residual it ships with is five members that a human decided to keep, each stating the exact coordinate and the measured mechanism, none of it expressible as a count, a threshold or a path glob.

Two items a later owner inherits, both recorded rather than hidden:

1. **D-32-05 has never been revisited.** Two of the five rows exist only because of it, and the marker's own comment says the implementation never branches on the value. Revoking it would clear two rows and simplify `AuthAttemptResult`; that is a decision, not a repair.
1. **The `Like` suffix now records two different things.** `MarketplaceStateRecordLike` and `LocationsResolverLike` are both the single declarations of their shapes -- neither is "like" anything any more. 06-17 deferred the rename because only one had become inaccurate; both have now. A rename is safe and cheap, and it buys zero rows, which is why it was not taken here.

## Self-Check: PASSED

- `.planning/phases/06-unused-type-member-gate/06-08-SUMMARY.md` -- FOUND
- `scripts/check-unused-type-members.exceptions.mjs` -- FOUND
- `scripts/check-unused-type-members.exceptions.json` -- FOUND, 5 entries
- `docs/unused-type-member-gate.md` -- FOUND, 204 lines
- `1eda5aad` -- FOUND (`refactor: declare the completions resolver surface once`)
- `3673f8fd` -- FOUND (`feat: run the unused type member gate in the normal quality path`)
- `7fd6b12a` -- FOUND (`docs: publish the unused type member gate reference`)
- `22cb0bec` -- FOUND (`docs: reconcile the member record after the activated gate`)
- `03f9773c` -- FOUND (`docs: record the member gate residual in the defect ledger`)
- `npm run check` exit 0 on the final snapshot
