---
phase: 105-workflow-degradation-and-documentation
plan: 01
subsystem: ui
tags: [notify, soft-dependency, closed-set, workflows, pi-dynamic-workflows, output-catalog]

# Dependency graph
requires:
  - phase: 103-workflows-bridge
    provides: the workflows bridge and `installCtx.stagedWorkflowNames`, the fact this plan renders
  - phase: 104-workflow-lifecycle-completion
    provides: the 39th REASONS member and the additively-amendable catalog region this plan extends
provides:
  - "`hasLoadedWorkflowEngine` — the host-engine probe, discriminating on `workflow_control`"
  - "`SoftDepStatus.workflowEngineLoaded` — required, so every construction is visited"
  - "`DEPENDENCIES` grown to three members with `workflows` last, under a new order-and-length lock"
  - "`requires pi-dynamic-workflows` — the 40th REASONS member and the third soft-dep marker"
  - "a required `declaresWorkflows` on `softDepMarkers` / `composeReasons` / `companionSeverity`"
  - "`declaresWorkflows` on both plugin outcome bases and `stagedWorkflows` on the ledger signal shape"
  - "two byte-gated catalog states, one of which pins two-marker brace order"
affects: [workflows-compatibility docs, README discoverability, milestone close]

actuals:
  tokens: 51000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A soft dependency is four artifacts: a probe, a DEPENDENCIES member, a marker, a reason token — and the marker and the token are the same string"
    - "Closed-set growth is forced by a REQUIRED parameter, so the compile errors enumerate the sweep"
    - "A two-marker catalog state is what byte-pins brace ORDER; a single-marker state cannot"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - docs/output-catalog.md
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "The token is `requires pi-dynamic-workflows`, never the shorter `requires pi-workflows` — the short form is the npm name of an engine this bridge does not target"
  - "The probe reads `tool.name` only, with no `sourceInfo.source` arm, because a source-string match reopens the false positive the probe exists to close"
  - "`declaresWorkflows` is REQUIRED at every seam; an optional default compiles at all 33 call sites and visits none"
  - "Reinstall keeps its existing non-raise: the marker rides its brace without moving severity, matching the two markers that came before it"
  - "Six more `Dependency[]` derivations gained the third arm — a member registered on one surface and absent on six is a half-registered dependency"

patterns-established:
  - "Order pin by two independent gates: the DEPENDENCIES lock fails on a tuple reorder, the two-marker catalog state fails on a softDepMarkers reorder"
  - "A byte-asserted negative half asserts the WHOLE rendered block, never the token's absence"

requirements-completed: [WDEP-01, WDEP-02, WDEP-04, WDOC-02]

coverage:
  - id: D1
    description: "The host workflow engine is probed by its distinctive `workflow_control` tool; a session exposing only bare `workflow` reads as ABSENT"
    requirement: WDEP-01
    verification:
      - kind: unit
        ref: "tests/platform/pi-api.test.ts#WDEP-01: hasLoadedWorkflowEngine selects on the workflow_control discriminator"
        status: pass
      - kind: unit
        ref: "tests/platform/pi-api.test.ts#WDEP-01: a throwing getAllTools() degrades to unloaded and surfaces nothing"
        status: pass
      - kind: unit
        ref: "tests/platform/pi-api.test.ts#softDepStatus composes the SoftDepProbe shape from the three probes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Installing a workflow-bearing plugin with the engine absent still writes every envelope, still succeeds, and renders the degradation marker at `warning`"
    requirement: WDEP-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WDEP-02: a workflow-bearing install with the engine absent still writes the envelope and says so"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WDEP-02: the same install with the engine loaded renders the undegraded block"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WDEP-02: a plugin that staged no workflow renders no brace even with the engine absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "`DEPENDENCIES` is three members in tuple order under a lock that did not exist before; `REASONS` is 40 with the new token at the tail and nothing moved"
    requirement: WDEP-04
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#SNM-06: DEPENDENCIES is the closed 3-entry dependency set, in brace order"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 40-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
    human_judgment: false
  - id: D4
    description: "The staged-workflow fact travels on the install / update / reinstall / enable outcomes; update and enable raise to `warning`, reinstall keeps its deliberate non-raise"
    requirement: WDEP-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WDEP-04: an update that stages a workflow with the engine absent raises the row to warning"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WDEP-04: a reinstall of a workflow-bearing plugin marks the engine without raising severity"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WDEP-04: enabling a workflow-bearing plugin with the engine absent raises the row to warning"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two markers in one brace render in `DEPENDENCIES` order, byte-pinned by a catalog state; both new states pair with fixtures in both directions"
    requirement: WDOC-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-v2.test.ts#WDEP-04: two markers in one brace join in DEPENDENCIES order, pi-subagents first"
        status: pass
    human_judgment: false
  - id: D6
    description: "Installing the host engine and running /reload makes already-installed workflows run, with no reinstall (WDEP-03's live half)"
    verification: []
    human_judgment: true
    rationale: "Requires the real `@quintinshaw/pi-dynamic-workflows` resolvable out of tree; the live canary is deliberately outside `npm run check`. WDEP-03 is not this plan's requirement — the claim is stated in the new catalog prose and needs a human read against a real session."

duration: 31min
completed: 2026-08-15
status: complete
---

# Phase 105 Plan 01: Workflow degradation and documentation Summary

**The host workflow engine becomes the third soft dependency: probed by its distinctive `workflow_control` tool, marked as `requires pi-dynamic-workflows` on the install / update / reinstall / enable rows, and byte-pinned in two new catalog states — while the envelopes are still written and the install still succeeds.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-15T21:27:32-04:00 (first task commit)
- **Completed:** 2026-08-15T21:58:01-04:00
- **Tasks:** 3
- **Files modified:** 40

## Accomplishments

- `hasLoadedWorkflowEngine` discriminates on `workflow_control`, so a session running the untargeted engine — which registers only bare `workflow` — reads as ABSENT. That case is the one the requirement exists for: a positive-only pair passes under a bare-name probe too.
- A workflow-bearing install with no engine loaded now writes every envelope, succeeds, and says on its own row that nothing runs them yet, at `warning` severity. It was a silent success before.
- `DEPENDENCIES` grew from two members to three with `workflows` last, and gained the order-and-length lock it was the only closed set to lack.
- `requires pi-dynamic-workflows` joined `REASONS` as its 40th member with nothing reordered, and the required third declares-flag made the compiler enumerate all 33 `composeReasons` sites, the three `companionSeverity` sites and every outcome producer.
- Two catalog states landed additively under the byte gate, the second of which pins two-marker brace order — verified by reversing `softDepMarkers`'s arms and watching the gate go red.

## Task Commits

1. **Task 1 (tracer): One install, engine absent, says so — probe to rendered brace** — `14003459` (feat)
2. **Task 2: The fact travels on every outcome the phase's later verbs read** — `6f21c074` (feat)
3. **Task 3: Two catalog states pin the brace, and the catalog's stale counts are corrected** — `2499c729` (docs)

TDD RED was observed before GREEN on every behavioral change. Recorded failure text:

- Task 1 probe: `SyntaxError: The requested module '.../platform/pi-api.ts' does not provide an export named 'hasLoadedWorkflowEngine'`
- Task 1 `DEPENDENCIES` lock: `deepStrictEqual` actual `['agents','mcp']` against the three-member expectation; `REASONS.length` 39 against 40
- Task 1 install row: severity `undefined` against expected `'warning'`, with both negative halves already green (so the pair is not vacuous)
- Task 2: the three producer expressions were neutralized to `false` and the three positive per-verb cases failed with severity `undefined` against `'warning'`, while all five negative halves stayed green; the producers were then restored and all eight passed

## Files Created/Modified

- `platform/pi-api.ts` — `hasLoadedWorkflowEngine` (RH-3 shape, no source-string arm) and the required `SoftDepStatus.workflowEngineLoaded`
- `shared/concerns/soft-dep.ts` — the third `DEPENDENCIES` member, `SOFT_DEP_MARKER_WORKFLOWS`, the third `softDepMarkers` arm pushed last
- `shared/notify.ts` — the 40th `REASONS` member, the widened `composeReasons`, the three dep-bearing row composers
- `shared/notify-reasons.ts` — the token's `UNSUPPORTED_REASONS` home and `companionSeverity`'s third disjunct
- `orchestrators/types.ts` — required `declaresWorkflows` on both outcome bases; `stagedWorkflows?: never` added to the update partition's refusal block
- `orchestrators/plugin/shared.ts` — `stagedWorkflows` on `LedgerDegradationSignals` and the widened `enableRowDependencies`
- `orchestrators/plugin/{install,update,reinstall,enable-disable}.ts` — the fact supplied at each producer and read at the three `companionSeverity` sites
- `orchestrators/plugin/{list,update-row}.ts`, `orchestrators/{import/execute,reconcile/apply}.ts` — the third arm on their `Dependency[]` derivations
- `docs/output-catalog.md` — two new states plus two corrected prose sentences
- `tests/architecture/notify-closed-set-locks.test.ts` — the new `DEPENDENCIES` lock

## Decisions Made

- **The token is `requires pi-dynamic-workflows`.** The obvious short form names a different engine's npm package. A degradation message using it would send the operator to install the wrong thing, and the rationale is recorded on the marker constant so a future rename does not undo it.
- **The probe reads the tool name only.** No `sourceInfo.source` arm. A substring match on a source string reopens exactly the false-positive surface WDEP-01 closes, and a dedicated test case pins it: a tool named `workflow` whose `sourceInfo.source` names the host engine's package reads as absent.
- **Reinstall keeps its non-raise.** It stamps severity from `reasons.length` alone and never calls `companionSeverity`. The new marker copies that rather than "fixing" it, so all three companions behave alike on all six verbs. The rationale is now recorded at the severity site so a later reader does not take it for an oversight.
- **`piWithBothLoaded` was renamed, not extended in place.** After the third probe exists the old name is a lie and its "no soft-dep markers fire" claim becomes conditional; `piWithAllLoaded` now carries three tools and `piWithoutWorkflowEngine` names the old two-tool body for what it means.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Six more `Dependency[]` derivations needed the third arm**

- **Found during:** Task 2
- **Issue:** The plan wired `install.ts`'s derivation and the outcome fields, but the marker reaches `list`, `import`, `reconcile`, `update` and `reinstall` rows through five separate `Dependency[]` derivations plus a sixth `composeReasons` site in `marketplace/update.messaging.ts`. None of these produces a compile error when left unvisited — they return a valid `Dependency[]` either way. Left alone, a workflow-bearing plugin would carry the marker on its install row and silently lose it on `/claude:plugin list` and on every cascade.
- **Fix:** Added the `workflows` arm, pushed last, to `update-row.ts::outcomeDependencies`, `import/execute.ts::dependenciesFromInstalled`, `reconcile/apply.ts::dependenciesFromInstall`, `list.ts::dependenciesFromDeclares` (reading `record.resources.workflows`), `reinstall.ts::dependenciesFromOutcome`, and to the `p.dependencies.includes(...)` triple in `marketplace/update.messaging.ts`.
- **Files modified:** the six named above, plus `import/execute.ts`'s `PluginInstalledOutcome`
- **Verification:** `npm run check` green; the enable and reinstall per-verb cases exercise two of the six end-to-end
- **Committed in:** `6f21c074`

**2. [Rule 3 - Blocking] `sonarjs/cognitive-complexity` tripped on `outcomeToTypedResult`**

- **Found during:** Task 2 (pre-commit)
- **Issue:** Adding the `stagedWorkflows` spread arm pushed `enable-disable.ts::outcomeToTypedResult` from 15 to 16, over the project's error threshold.
- **Fix:** Extracted the `fresh`-arm enabled projection into a named `freshEnabledProjection` helper, as the plan directed for exactly this case. No disable directive.
- **Files modified:** `orchestrators/plugin/enable-disable.ts`
- **Verification:** `npx eslint` clean on the file; the 200-test enable-disable + reconcile run stayed green, so the extraction moved no bytes
- **Committed in:** `6f21c074`

**3. [Rule 3 - Blocking] Four pre-existing WLIF-06 fixtures started carrying the new marker**

- **Found during:** Task 2
- **Issue:** Four `WLIF-06` cases in the update and reinstall suites stage a workflow under a `pi` with no tools, so the new marker correctly joined their braces and their byte assertions failed. This is intended behaviour, not a regression.
- **Fix:** Gave each an engine-loaded `pi` so the soft-dep axis stays neutral and their assertions keep pinning exactly the stale-command fact they exist for. Their expected bytes are unchanged; the WDEP-04 cases added alongside own the soft-dep axis.
- **Files modified:** `tests/orchestrators/plugin/update.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** all four pass with their original expected blocks
- **Committed in:** `6f21c074`

### Sequencing adjustments

**4. `piWithoutWorkflowEngine` in `catalog-uat.test.ts` moved from Task 1 to Task 3.** The plan placed it in Task 1 alongside the rename, but its only consumers are the Task 3 fixtures, and `noUnusedLocals` rejects an unused local — Task 1 could not have compiled with it. The rename itself landed in Task 1 as planned, which is the half that matters (the old name becomes a lie the moment the probe exists). The sibling helper landed with the fixtures that use it.

**5. `declaresWorkflows: false` was passed at two `companionSeverity` sites in Task 1 and replaced with the real expression in Task 2.** Task 1's acceptance requires `npm run typecheck` to exit 0, and the outcome fields those sites read do not exist until Task 2. `false` was correct at that commit — no outcome carried the fact and no derivation pushed `"workflows"` on those verbs yet.

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking) + 2 sequencing adjustments
**Impact on plan:** The missing-critical fix is the larger one and is squarely in the plan's intent — the CONTEXT's own invariant is that a partial set of a dependency's artifacts is a latent bug, and six of seven surfaces silently dropping the marker is that bug. No scope creep beyond it.

## Issues Encountered

- **The plan's site counts were both stale, in opposite directions.** It expected 33 `composeReasons` sites (correct) and five dep-bearing ones; the tree has six — `marketplace/update.messaging.ts` reads `p.dependencies` inline rather than through a shared composer. Trusting the tree over either number was the orchestrator's instruction and was the right call.
- **`pre-commit run --files "$VAR"` silently checks nothing in this shell.** The configured shell is fish, so an unquoted variable holding newline-separated paths arrives as one argument and every hook reports "no files to check" — a green-looking run that verified nothing. Every pre-commit and trufflehog invocation here went through `xargs -a <file>` instead.
- **Assumption A2 held and was verified rather than assumed.** `catalog-uat.test.ts` was run immediately after the probe landed and before any fixture edit: 190 tests green, so the third probe moved no existing byte.

## User Setup Required

None — this plan installs nothing and touches no dependency manifest. `git diff --name-only` over the phase names neither `package.json`, `package-lock.json` nor `sonar-project.properties`.

## Next Phase Readiness

Ready. Notes for what follows:

- **WDEP-03 has no automated proof yet.** The plan scoped it out, and the research's layer-1 (probe-independence of the written envelope) and layer-2 (a boundary gate asserting `bridges/workflows/**` never reads a probe symbol) are both still Wave-0 gaps. The claim is now asserted in catalog prose, which makes it a documented promise with no test behind it. Worth closing before the milestone ships.
- **WDOC-01 is untouched** — `docs/workflows-compatibility.md` and the README pair (both languages) remain the phase's documentation work.
- **Three prose files carry stale soft-dep counts** the research flagged and this plan did not touch: `docs/messaging-style-guide.md` (`:28` `Dependency // "agents" | "mcp"`, `:61` "the closed set of **2** soft-dependency probe targets", `:67`, `:84`, `:166`) and `docs/open-closed-proof.md:56`. No gate covers them.
- **The catalog region stays additively amendable.** This plan added two sibling states under the install H2 and removed no fenced-block line; a third additive amendment lands cleanly.

## Self-Check: PASSED

All four named artifacts exist on disk; all three commit hashes resolve in `git log`; no file was deleted across the phase; `STATE.md` and `ROADMAP.md` were not modified by any of the three commits.

---
*Phase: 105-workflow-degradation-and-documentation*
*Completed: 2026-08-15*
