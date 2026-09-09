---
phase: 115-install-time-admission-gate-warnings
plan: 01
subsystem: api
tags: [workflows, acorn, ast, admission-gates, warnings, engine-parity]
status: complete

requires:
  - phase: 111-workflows-bridge
    provides: "domain/workflow-script.ts::admitWorkflowScript, findMetaObject, readMetaString, literalString and the one parse() call every gate reads"
  - phase: 113-update-enable-disable-reconcile
    provides: "bridges/workflows/discover.ts::the tense discriminant, INSTALL_OUTCOMES/PREVIEW_OUTCOMES and softFailWarning"
  - phase: 112-install-and-removal-lifecycle
    provides: "orchestrators/plugin/install.ts::the workflows ledger phase and collectPostCommitWarnings' discovery/hygiene split"
provides:
  - "domain/workflow-script.ts::WorkflowGate (exported closed union) derived from the private GATE_ORDER tuple"
  - "domain/workflow-script.ts::readEngineGate -- first-failure-wins over the engine's own check order, with its own throw containment"
  - "NamedWorkflow.gate / StemFallbackWorkflow.gate -- the advisory field, on the two ADMITTED arms only"
  - "bridges/workflows/types.ts::WorkflowOutcomeSite gains a sixth member, `gate`"
  - "bridges/workflows/discover.ts::GATE_REASONS (Record<WorkflowGate, string>) and gateWarning, plus the named-plus-gate arm of verdictWarning"
  - "orchestrators/plugin/install.ts::the workflows bridge's warnings now ride discoveryWarnings, so a standalone install renders them"
  - "the measured correction to check 8's key rule: the engine reads an identifier and a string- OR number-valued literal key"
affects:
  - "115-02: the single-parse and containment source gates, and the stale-comment repairs in the same two files"
  - "115-03: reinstall's own drop site, which this plan deliberately left alone"
  - "115-04: the info preview surface and the output catalog, which now have a sixth site to render"
  - "115-05: docs/workflows-compatibility.md, whose replicate/warn/neither column must equal these six gate names"

actuals:
  tokens: 12262
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "a closed union DERIVED from an ordered tuple, with a Record over that union as the totality lock, at two layers (domain predicates, bridge reason sentences)"
    - "an allow-list stated in the upstream's own terms where the upstream's refusal side is an eleven-way enumeration"
    - "a defensive catch made reachable by a bounded walk, so containment is exercised by a real input instead of inspected"
    - "every fixture measured against the real engine before it is written into a test"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - extensions/pi-claude-marketplace/bridges/workflows/types.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/domain/workflow-script.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/bridges/workflows/discover.test.ts

key-decisions:
  - "MEASURED CORRECTION, and it falsifies both RESEARCH:483 and this plan's own acceptance criterion: the engine ADMITS a numeric-literal key. `propertyKey` at 3.10.1 reads `typeof node.value === \"string\" || typeof node.value === \"number\"`, so `{ 1: \"a\" }` resolves to the key `\"1\"` and the script loads. Firing `meta-not-pure-literal` there would have warned about a script the engine runs. The reachable eleventh sub-throw is a BigInt-literal key (`{ 1n: \"x\" }` -> `unsupported key type in meta: Literal`), which is what the test pins, with the numeric key beside it as a control."
  - "MEASURED CORRECTION: the engine's literal arm is `case \"Literal\": return node.value` with no type test at all, so a regular-expression or BigInt VALUE is resolvable. The allow-list accepts any `Literal` rather than the four types the plan named, and a regex-value control pins it."
  - "MEASURED CORRECTION: the reserved key set is three names, not one. `__proto__`, `constructor` and `prototype` are all refused, read verbatim from `evaluateLiteral`. All three are in RESERVED_META_KEYS and all three have a case."
  - "The gate walk carries a depth budget (32) enforced by a throw, so the WGATE-03 containment catch is reachable from a real script. Without it the catch is unreachable by construction -- acorn's own stack limit stops a nested literal at under 800 levels, far below what the tiny recursive walk survives -- and an unreachable catch fails this module's 100% direct-coverage gate. The budget also makes the containment a pinned behavior rather than a transcript."
  - "GateContext carries the narrowed `declaration` and `declaratorName` beside `first`, rather than the two fields the plan listed. Narrowing once, over every admitted script, keeps each predicate a single comparison AND exercises both arms of the narrowing -- a predicate that re-narrowed internally would carry an arm no input can reach."
  - "`metaPropertyKey` was widened to the engine's own key rule rather than duplicated for the gate reader. Behavior is unchanged for its existing caller: `readMetaString` compares against `name` and `description`, and no numeric key can equal either."
  - "The stem-fallback overlap is resolved by ENRICHING the existing unrunnable reason (RESEARCH Assumption A1's second option), so one file gets one line. The rule is stated in a comment beside the code that enforces it."

patterns-established:
  - "Assert the gate NAME on every row. A presence assertion (`a gate exists`) is green for the wrong gate, and the name is the whole content of the warning."
  - "Prove a guard by removing what covers it. The containment catch was proven by deleting one test and watching coverage name lines 841-842."
  - "Measure the upstream before writing the fixture. Three of this plan's inherited claims were wrong, and all three were caught by running the real engine over the intended fixtures first."

requirements-completed: [WGATE-01, WGATE-02, WGATE-03, WGATE-04]

coverage:
  - id: D1
    description: "A script the engine will refuse installs anyway, and a standalone install prints a second notification naming the file and the engine check that refuses it"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-01 / D-115-05: a standalone install names the engine check a script will be refused at"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each of the six warnable gates is reported, by name, for the script shape the engine refuses at that check"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#reports meta-not-first-export|meta-not-const-export|meta-not-sole-declarator|meta-not-named-meta|meta-not-pure-literal|meta-fields-invalid for a script that ... (40 rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "At most one gate per script, chosen first-failure-wins in the engine's own check order"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#reports the gate the engine stops at, not the last one a script trips"
        status: pass
    human_judgment: false
  - id: D4
    description: "One warning line per file: a stem-fallback script carrying a gate names it inside the existing unrunnable reason rather than earning a second line"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#warns the same way when the declared name is present but not a literal"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-03: a script whose meta carries shapes the gate predicates never expect still installs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gate reading is decided from the one parse admitWorkflowScript already performs -- no second parse, no engine import, no evaluation"
    requirement: WGATE-02
    verification:
      - kind: other
        ref: "grep -c 'parse(' extensions/pi-claude-marketplace/domain/workflow-script.ts -- one call site, unchanged; the permanent source gate lands in 115-02 Task 2"
        status: pass
    human_judgment: false
  - id: D6
    description: "A gate reading never changes a verdict: the field exists only on the two admitted arms, the generated name is unchanged, and a throw inside gate reading cannot fail an install"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#gives a gate-warned script the same generated name as the same script without the gate"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#stops deciding rather than throwing when a meta literal nests past the walk budget"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-03: a script whose meta carries shapes the gate predicates never expect still installs"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both refusal paths keep their exact cause and reason bytes and carry no gate, so a later reordering of the decision order fails rather than attaching gate findings to a refusal"
    requirement: WGATE-04
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WGATE-04: keeps the refusal reason for a blocklist match ... (4 rows) + the two adjacency cases + the escaped-file-name case"
        status: pass
    human_judgment: false
  - id: D8
    description: "The plugin row a warned install renders is untouched -- no gate text, no new reasons-brace token"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-01 / D-115-05: a standalone install names the engine check a script will be refused at (the doesNotMatch assertions)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Each GATE_REASONS sentence states the engine's rule truthfully and reads as an advisory rather than as a refusal"
    verification: []
    human_judgment: true
    rationale: "Prose judgement. The plan names this reviewer-read; the automated side only pins that no sentence interpolates script-derived text and that the install phrase states the admitted fact first."

duration: 53min
completed: 2026-09-09
---

# Phase 115 Plan 01: Install-time admission-gate warnings — Summary

**A plugin author who ships a workflow script the host engine will refuse now learns it at install time, with the refusing check named — read off the acorn AST the bridge already had, carried on the two admitted verdict arms, and rendered by the standalone install that used to drop the channel on the floor.**

## Performance

- **Duration:** 53 min
- **Started:** 2026-09-09T03:15:50Z (plan base `0c8e8112`)
- **Completed:** 2026-09-09T04:08:26Z (last task commit)
- **Tasks:** 3 of 3
- **Files modified:** 7

## Accomplishments

- **Six gates, read from one parse.** `GATE_ORDER` is the engine's own check order (3, 4, 5, 6, 8, 9); `WorkflowGate` is derived from it; `GATE_PREDICATES` is annotated `Record<WorkflowGate, (ctx: GateContext) => boolean>`. A seventh gate cannot compile without a predicate, and the bridge's `GATE_REASONS` is a second, independently-edited lock over the same union.
- **First-failure-wins.** `readEngineGate` returns the first gate whose predicate fires and nothing else, so a script that fails the first-statement check is never told about an object the engine would not have evaluated.
- **The gate rides the admitted arms only.** `NamedWorkflow` and `StemFallbackWorkflow` gained `readonly gate?: WorkflowGate`; the two refusal arms cannot carry one by type, and now cannot carry one in fact either.
- **The standalone install shows it.** The workflows bridge's warnings moved from `bridgeWarnings` (gated behind `orchestrated`) to `discoveryWarnings`, which is the array `surfaceDiscoveryWarnings` renders — the call `update.ts` already made for the same array and the same reason.
- **Three inherited claims about the engine were falsified by measurement** before a single fixture was written. See Deviations.
- **The containment catch is exercised, not asserted.** The gate walk carries a depth budget; a literal nested past it leaves the script admitted with no gate, and removing that one test drops the module's coverage on exactly the `catch` lines.

## Task Commits

1. **Task 1 (tracer): the end-to-end gate warning** — `8827af3a` (test, RED) → `5917b267` (feat, GREEN)
2. **Task 2: pin all six gates, the order and the boundaries** — `408d5440` (test)
3. **Task 3: pin both refusal paths as bytes** — `3391effc` (test)

**Plan metadata:** committed with this SUMMARY.

`plan_head_before: 0c8e8112853f2b45ed5416e2f69c6598521bf078` — `git rev-list --count 0c8e8112..HEAD` = **4**, which is the `actuals.commits` figure above.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — `GATE_ORDER`, the exported `WorkflowGate`, `GateContext`/`gateContext`, `GATE_PREDICATES`, `readEngineGate` with its own containment, the three-way literal allow-list (`isLiteralObject` / `isLiteralProperty` / `isLiteralValue` / `isLiteralArray` / `isNegativeNumber`), the field checks (`metaFieldsFailValidation` / `isEngineModel` / `isEnginePhases` / `isEnginePhase`), `metaValue`, the `gate` field on both admitted interfaces, and `metaPropertyKey` widened to the engine's key rule.
- `extensions/pi-claude-marketplace/bridges/workflows/types.ts` — `WorkflowOutcomeSite` gains `gate`; the doc comment describes the six sites as they now stand.
- `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` — `GATE_REASONS`, `gateWarning`, the `gate` entry in both phrase tables, the `named`-plus-gate arm of `verdictWarning`, and the gate clause inside `unrunnableWarning`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — the workflows phase pushes to `c.discoveryWarnings`; the surrounding comment and `collectPostCommitWarnings`' doc now state which bridges feed that array.
- `tests/orchestrators/plugin/install.test.ts` — the `installGatedWorkflowPlugin` fixture and two end-to-end cases (the check-9 warning, the hostile `meta`).
- `tests/domain/workflow-script.test.ts` — 40 gate rows, the ordering case, the absent-seventh-gate case, four boundary cases, the unchanged-name case, the depth-budget case, and Task 3's seven refusal-byte cases.
- `tests/bridges/workflows/discover.test.ts` — the existing stem-fallback warning's expected bytes now carry the check-3 clause, and its verdict carries the gate.

## Decisions Made

See `key-decisions` in the frontmatter. The three that change what the phase ships:

1. **`{ 1: "a" }` does not fire a gate.** The plan's acceptance criterion said it must. The engine admits it. The criterion was written from RESEARCH:483's discriminator list, which the plan itself flagged as short — it was short in the *opposite* direction from the one anticipated.
2. **The literal allow-list accepts any `Literal` node.** The engine performs no type test in that arm.
3. **The gate walk is depth-bounded.** This is the only mechanism under which the plan's mandatory `try`/`catch` is reachable from an input, and therefore the only one under which the module keeps 100% direct coverage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The plan's check-8 key rule fires on a shape the engine admits**

- **Found during:** Task 1, at the measurement step the plan mandates before pinning the key rule.
- **Issue:** `115-RESEARCH.md:483` and this plan's `<action>` and `<acceptance_criteria>` both state that the engine refuses a numeric-literal key, and the plan requires a test asserting `{ 1: "a" }` fires `meta-not-pure-literal`. The engine's `propertyKey` at 3.10.1 accepts a `Literal` key whose value is a string **or a number**. `{ name: "a", description: "d", 1: "x" }` is admitted and resolves to `{"1":"x",...}`.
- **Fix:** the allow-list accepts an identifier or a string- or number-valued literal key, matching the engine. The eleventh sub-throw is pinned with the shape that actually reaches it — a BigInt-literal key — and the numeric key is pinned as a control that must NOT fire. The plan's own instruction covers this: "if the engine accepts a form this allow-list rejects, widen the allow-list rather than leaving the gate to fire on a shape the engine admits."
- **Files modified:** `domain/workflow-script.ts`, `tests/domain/workflow-script.test.ts`.
- **Verification:** measured twice — source-read of `propertyKey` at `src/workflow.ts:1604-1609`, and an executable probe running the packed engine's own `parseWorkflowScript`. Both transcripts below.
- **Committed in:** `5917b267` (predicate), `408d5440` (both cases).

**2. [Rule 1 — Bug] The plan's literal allow-list is narrower than the engine's**

- **Found during:** Task 1, same measurement.
- **Issue:** the plan names the resolvable literal forms as "a `Literal` of string, number, boolean or null". The engine's arm is `case "Literal": return node.value` — no type test — so a regular-expression or BigInt value is resolvable too. The narrower list would have fired on `{ pattern: /x/ }`, which the engine loads.
- **Fix:** `isLiteralValue` accepts any `Literal`; a regex-value row pins that it does not fire.
- **Files modified:** `domain/workflow-script.ts`, `tests/domain/workflow-script.test.ts`.
- **Verification:** `ADMITS | value: regex literal` in the transcript below.
- **Committed in:** `5917b267`, `408d5440`.

**3. [Rule 2 — Missing critical functionality] The reserved key set is three names, not one**

- **Found during:** Task 1, same measurement.
- **Issue:** the plan says to fire on `prototype` alone and to record that it is the only measured reserved key. The engine refuses `__proto__`, `constructor` and `prototype`, in one `if` read verbatim from `evaluateLiteral`. Two thirds of that gate would have been missed warnings.
- **Fix:** `RESERVED_META_KEYS` carries all three, each with a case, and the comment keeps the re-check-on-upgrade caveat the plan asked for.
- **Files modified:** `domain/workflow-script.ts`, `tests/domain/workflow-script.test.ts`.
- **Verification:** three `REFUSES | reserved key name not allowed` rows in the transcript below.
- **Committed in:** `5917b267`, `408d5440`.

**4. [Rule 3 — Blocking issue] The mandatory containment catch and the 100%-coverage gate are unsatisfiable together without a bounded walk**

- **Found during:** Task 1, while designing `readEngineGate`.
- **Issue:** Task 1 requires a `try`/`catch` inside `readEngineGate` whose catch returns no gate, and 115-02 Task 2 will pin those tokens in source. Task 2's third verify requires complete direct coverage of `domain/workflow-script.ts`, which stands at 100% today (116/116 branches before this plan). A catch no input can reach is an uncovered branch — measured on this Node: an unexecuted catch reports `BRH 3 / BRF 4`. And no input can reach it: acorn's own recursion fails between depth 400 and 800, while the tiny predicate walk survives everything acorn parses, so the `RangeError` arm the plan names is already contained by `parseScript`.
- **Fix:** the walk carries `GATE_WALK_MAX_DEPTH = 32`, enforced by a throw the containment catch swallows. A `meta` nested past it leaves the script admitted with **no** gate — a missed warning, never a false one and never a blocked install, which is the direction WGATE-03 chose. A real 40-level fixture hiding a spread the engine would refuse exercises it.
- **Files modified:** `domain/workflow-script.ts`, `tests/domain/workflow-script.test.ts`.
- **Verification:** control 3 below — deleting that single test drops coverage to `branches 189/191, lines 1148/1152` and names lines 841-842 (`catch`) and 971-972 (`throw`).
- **Committed in:** `5917b267`, `408d5440`.

**5. [Rule 3 — Blocking issue] `GateContext` needed the narrowed fields to keep every predicate branch reachable**

- **Found during:** Task 1.
- **Issue:** the plan specifies `GateContext` as `{ first, elements }`. A predicate that re-narrows `first` to an `ExportNamedDeclaration` carries an else-arm no input reaches at that point in the order (check 3 already returned), which is another uncovered branch.
- **Fix:** `gateContext` narrows once, unconditionally, for every admitted script — including the malformed ones, which is what exercises each arm — and carries `declaration` and `declaratorName` alongside `first` and `elements`. Each predicate is one comparison.
- **Files modified:** `domain/workflow-script.ts`.
- **Verification:** `branches 191/191, functions 59/59, lines 1152/1152`.
- **Committed in:** `5917b267`.

**6. [Rule 1 — Bug] `tests/bridges/workflows/discover.test.ts` asserted a warning this plan changes**

- **Found during:** Task 1, GREEN.
- **Issue:** that file is listed under plan 115-02's `files_modified`, but 115-01 changes the behavior it asserts: its stem-fallback fixture declares a statement before its `meta` export, so the warning now names the engine's check 3 inside the same reason.
- **Fix:** the expected bytes carry the gate clause and the expected verdict carries `gate: "meta-not-first-export"`. No assertion was weakened — the comparison is still whole-value and byte-exact.
- **Files modified:** `tests/bridges/workflows/discover.test.ts`.
- **Verification:** 91/91 in the domain + discover suites.
- **Committed in:** `5917b267`.

---

**Total deviations:** 6 auto-fixed (3 × Rule 1, 1 × Rule 2, 2 × Rule 3). **Zero Rule 4 escalations.**

**Impact on plan:** every deviation moves the implementation *toward* the measured engine and away from an inherited claim. Deviations 1-3 are the milestone's short-enumeration pattern appearing a sixth time, in a plan explicitly written to catch it; the plan's own instruction to measure before pinning is what caught them. Deviations 4-5 are the cost of the plan's own coverage gate meeting its own containment requirement, resolved with the smallest mechanism that satisfies both. No scope creep: no new module, no new test file, no dependency, and the `reinstall.ts` half of D-115-05 was deliberately left to plan 115-03.

## Controls Run

Every construct this plan adds was checked by removing something and watching what went red. Transcripts, not summaries.

### Control 1 — the engine measurement that falsified three inherited claims

Source-read (`$SCRATCH/node_modules/@quintinshaw/pi-dynamic-workflows/src/workflow.ts:1604-1609`, engine installed with `npm install --prefix "$SCRATCH" @quintinshaw/pi-dynamic-workflows@3.10.1 --no-save`, outside the repository, removed after):

```ts
function propertyKey(node: AnyNode, path: string): string {
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && (typeof node.value === "string" || typeof node.value === "number"))
    return String(node.value);
  throw new Error(`unsupported key type in ${path}: ${node.type}`);
}
```

Executable cross-probe, running the packed engine's own `parseWorkflowScript` over the shapes this plan intended to pin (abridged to the rows that matter; every row of the full 54-shape run agreed with the predicates as shipped):

```text
ADMITS  | identifier key        | meta={"name":"a","description":"d"}
ADMITS  | numeric literal key   | meta={"1":"x","name":"a","description":"d"}      <- plan said REFUSES
ADMITS  | string literal key    | meta={"name":"a","description":"d","k-1":"x"}
REFUSES | bigint literal key    | unsupported key type in meta: Literal            <- the reachable 11th
REFUSES | prototype key         | reserved key name not allowed in meta: prototype
REFUSES | constructor key       | reserved key name not allowed in meta: constructor
REFUSES | __proto__ key         | reserved key name not allowed in meta: __proto__
ADMITS  | value: regex literal  | {"name":"a","description":"d","v":{}}            <- plan's list was narrower
ADMITS  | value: true           | {"name":"a","description":"d","v":true}
ADMITS  | value: null           | {"name":"a","description":"d","v":null}
REFUSES | value: arrow fn       | non-literal node type in meta.v: ArrowFunctionExpression
REFUSES | value: +1 unary       | only negative-number unary allowed in meta.v
REFUSES | c3 stmt before        | `export const meta = ...` must be the first statement in the script
REFUSES | c4 export{meta} 1st   | meta export must be `export const meta = ...`
REFUSES | c5 two declarators    | meta export must declare only `meta`
REFUSES | c6 other first        | meta export must declare `meta`
REFUSES | c7 no init            | Unexpected token (1:17)                          <- acorn, not check 7
REFUSES | c8 nested spread      | spread not allowed in meta.phases[0]
REFUSES | c8 sparse phases      | sparse arrays not allowed in meta.phases
REFUSES | c9 no description     | meta.description must be a non-empty string
REFUSES | c9 negative model     | meta.model must be a string                      <- check 9, not 8
REFUSES | c9 phases no title    | each meta phase must have a title string
ADMITS  | c9 phases tmpl title  | {"name":"a","description":"d","phases":[{"title":"t"}]}
ADMITS  | deep 40 nesting       | {"name":"a","description":"d","v":{"a":{"a":...
```

### Control 2 — the totality lock, in both configurations

**2a. A seventh member added to `GATE_ORDER`, nothing else touched:**

```text
$ npx tsc --noEmit
extensions/pi-claude-marketplace/bridges/workflows/discover.ts(162,7): error TS2741: Property
'"fabricated-gate"' is missing in type '{ "meta-not-first-export": string; ... }' but required in
type 'Record<"meta-not-first-export" | ... | "fabricated-gate", string>'.
extensions/pi-claude-marketplace/domain/workflow-script.ts(892,7): error TS2741: Property
'"fabricated-gate"' is missing in type '{ "meta-not-first-export": (ctx: GateContext) => boolean;
... }' but required in type 'Record<"meta-not-first-export" | ... | "fabricated-gate",
(ctx: GateContext) => boolean>'.
TYPECHECK_EXIT=2
```

Both locks fire, in two files a single edit cannot change together.

**2b. Attribution — the same seventh member, with the predicate map's annotation REMOVED.** Recorded as observed:

```text
$ npx tsc --noEmit
extensions/pi-claude-marketplace/bridges/workflows/discover.ts(162,7): error TS2741: Property
'"fabricated-gate"' is missing ... Record<..., string>.
extensions/pi-claude-marketplace/domain/workflow-script.ts(840,38): error TS7053: Element implicitly
has an 'any' type because expression of type '"meta-not-first-export" | ... | "fabricated-gate"'
can't be used to index type '{ "meta-not-first-export": (ctx: any) => boolean; ... }'.
  Property 'fabricated-gate' does not exist on type '{ ... }'.
extensions/pi-claude-marketplace/domain/workflow-script.ts(893,29): error TS7006: Parameter 'ctx'
implicitly has an 'any' type.
[... five more TS7006 ...]
TYPECHECK_EXIT=2
```

The TS2741 that **named the predicate map** disappeared with the annotation, which is the attribution 2a needed: 2a's redness at that site came from the annotation. Redness did not vanish entirely, and what replaced it is informative rather than confounding — unannotated, the map is no longer total, so `GATE_PREDICATES[gate]` fails at the **use site** instead (TS7053, line 840, inside `readEngineGate`'s own walk). Neither configuration lets a seventh gate through silently, and the bridge-side lock stayed red in both.

### Control 3 — the containment catch is exercised, not inspected

The plan asks for a planted throw; the permanent proof is stronger, so both were run.

**3a. Planted throw.** `"meta-not-pure-literal"`'s predicate replaced with `() => { throw new Error("planted predicate defect"); }`:

```text
$ node --test --test-reporter=tap tests/orchestrators/plugin/install.test.ts
ok 135 - WLIF-01: an installed workflow lands as an envelope and the record names it
ok 137 - WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host engine is loaded
not ok 153 - WGATE-01 / D-115-05: a standalone install names the engine check a script will be refused at
  expected: 2
  actual: 1
  operator: 'strictEqual'
not ok 154 - WGATE-03: a script whose meta carries shapes the gate predicates never expect still installs
# tests 154
# pass 152
# fail 2
```

152 of 154 install cases pass with a predicate that throws on every script. The two that fail do so on the **notification count** (1 vs 2) — the fixture's own `readFile` of `hello:greet.json` and its record assertion ran *before* that line, so the envelope was written and the record persisted. A predicate defect costs the author a warning, never the install. Plant removed; `grep -c "planted predicate defect"` = 0; 154/154 restored.

**3b. Coverage attribution.** Deleting ONLY the depth-budget case:

```text
ℹ    workflow-script.ts    |  99.65 |    98.95 |  100.00 | 841-842 971-972
Incomplete direct coverage for .../domain/workflow-script.ts: branches 189/191, lines 1148/1152
EXIT=1
```

Lines 841-842 are `} catch { return undefined;`; lines 971-972 are the budget's `throw`. Restored:

```text
Direct coverage passed: extensions/pi-claude-marketplace/domain/workflow-script.ts
(branches 191/191, functions 59/59, lines 1152/1152)
```

## Verification Results

Every `<automated>` command from every task, plus the plan-level block.

| Command | Result |
|---|---|
| `npm run typecheck` (Task 1) | exit 0 |
| `node --test tests/orchestrators/plugin/install.test.ts` (Task 1) | 154 tests, 154 pass, 0 fail |
| `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts` (Task 1) | 91 tests, 91 pass, 0 fail |
| `npm run fallow` (Task 1) | exit 0; no `health` finding in either changed source file (0 above threshold) |
| `node --test tests/domain/workflow-script.test.ts` (Tasks 2, 3) | 118 tests, 118 pass, 0 fail |
| `grep -c` the six gate members (Task 2) | 36 (per member: 5, 4, 1, 1, 14, 11 — all ≥ 1) |
| `node scripts/test-coverage-direct.mjs .../domain/workflow-script.ts` (Task 2) | exit 0 — branches 191/191, functions 59/59, lines 1152/1152 |
| `grep -c` the four determinism causes (Task 3) | 13 (per cause: 6, 2, 3, 2 — all ≥ 1) |
| `npm run lint` (Task 3) | exit 0; zero mentions of `tests/domain/workflow-script.test.ts` |
| `npm test && npm run typecheck && npm run fallow` (plan level) | 5625 tests, 5625 pass, 0 fail; both exits 0 |
| `test -z "$(git diff HEAD --name-only -- package.json package-lock.json)"` (plan level) | exit 0 — no dependency manifest touched, and `git diff --name-only 0c8e8112..HEAD` names no manifest, `sonar-project.properties` or `CHANGELOG.md` |
| `npm run test:corresponding` | exit 0 |
| `npm run test:corresponding:negative` | exit 0 |
| `npm run test:coverage:direct:negative` | exit 0 |
| `npm run test:integration` | 34 tests, 34 pass, 0 fail |
| `npm run check` | **exit 1 at `format:check`, on a pre-existing violation this plan did not introduce** — see Issues Encountered |

The rendered gate line, in both tenses (directory reduced for reading; the render sites redact it per NFR-9):

```text
[install] workflow script "greet.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared
[preview] workflow script "greet.js" in "workflows" would be installed but the engine will refuse to load it: the engine refuses at its check 9 -- ...
```

## TDD Gate Compliance

| Gate | Commit | Status |
|---|---|---|
| RED | `8827af3a` `test(115-01): add failing install-time gate warning cases` | ✓ verified `RED_EVIDENCE_OK` |
| GREEN | `5917b267` `feat(115-01): warn at install time which engine gate refuses a script` | ✓ 154/154 |
| REFACTOR | — | not needed; no cleanup pass changed behavior |

RED evidence, verified rather than asserted:

```text
$ node .claude/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence <record.json>
"verdict": "RED_EVIDENCE_OK",
"reason": "target_test_failed",
"exit_code": 1, "tests": 154, "pass": 152, "fail": 2,
"target_test": "WGATE-01 / D-115-05: a standalone install names the engine check a script will be refused at"
"message": "RED evidence verified: target test ... failed as expected (exit 1). GREEN authorized."
```

**Tasks 2 and 3 carry no RED commit, and that is structural rather than a lapse.** Both are declared `tdd="true"` and both are test-only tasks over behavior the plan's own `type="tracer"` Task 1 shipped. A failing-first test is unavailable for them by construction: the behavior exists before the pin is written. Writing the plan's literal `{ 1: "a" }` criterion *would* have been RED — and making it green would have shipped a warning about a script the engine loads, which is why it was measured instead. Both tasks are committed as `test(115-01)`, which is the honest type for a regression pin.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced, and no test was skipped.

## Threat Flags

None. The plan's `<threat_model>` covers every surface this plan touched, and each `mitigate` disposition is implemented: T-115-01 (no `eval`/`Function`/`vm`/dynamic `import()` — every predicate is a property test on a node already in hand), T-115-02 (`GATE_REASONS` interpolates nothing; the reasons are literal sentences), T-115-03 (first-failure-wins plus one-line-per-file caps output at one line per script), T-115-04 (the field is on the admitted arms only, and the walk contains its own throws — both pinned), T-115-05 (no new render site), T-115-06 (no manifest touched), T-115-07 (the install phrase states the admitted fact before the caveat).

## Issues Encountered

**1. `npm run check` stops at `format:check` on a pre-existing violation.** `.planning/HANDOFF.json` fails `prettier --check`, and it was committed that way at `9a1c0180` — before this plan ran. `git diff HEAD -- .planning/HANDOFF.json` is empty, so nothing here touched it. It is out of this plan's scope and it is a GSD planning artifact rather than source, so it was **not** fixed and not swept into a plan commit; `npx prettier --write .planning/HANDOFF.json` clears it in one edit. Because `format:check` sits ahead of the test steps in the chain, every step it masked was run directly instead and all passed (see the table above), plus `prettier --check` over `extensions/**/*.ts`, `tests/**/*.ts` and `scripts/**/*.mjs`: clean. Recorded in `deferred-items.md` and `.planning/WINDOWS.md`.

**2. A finding this plan makes reachable, for 115-03/115-04 to decide.** `surfaceDiscoveryWarnings` heads its block with `Plugin "<name>" installed; 1 declared component was skipped.` (`orchestrators/plugin/shared.ts:1453`). A gate warning's own line says `was installed but the engine will refuse to load it`, so the two sentences of one notification now disagree about whether anything was skipped. D-115-05 is what made this visible on install — before it, a standalone install rendered none of these strings. It was **not** fixed here: the header is shared by install, update and reinstall, its exact bytes are asserted in four test files, and changing it moves rendered bytes with a catalog consequence that belongs to plan 115-04. The gate LINE itself satisfies the plan's transparency prohibition — it never claims the script was not installed, was refused or was skipped. Recorded in `deferred-items.md` and `.planning/WINDOWS.md`.

## User Setup Required

None — no external service configuration required. The engine tarball used for measurement was installed with `--prefix` outside the repository and `--no-save`, and removed; it is deliberately not a declared dependency and no task imports it.

## Next Phase Readiness

Ready for **115-02**, which needs exactly what this plan left in place:

- `readEngineGate`'s `try`/`catch` sits inside its own body, where 115-02 Task 2's source slice can see it — not hoisted into a helper and not lifted to the call site.
- `domain/workflow-script.ts` still performs exactly one `parse(` call.
- The stale comments 115-02 owns were left alone: `stemFallbackVerdict`'s "tracked as a roadmap criterion" sentence and `DETERMINISM_BLOCKLIST`'s "only engine gate replicated" / "0.x package" claims. One exception: `verdictWarning`'s doc claim that the `named` arm alone earns no warning was corrected here, because this plan is what falsified it — leaving a false comment behind for one plan was the worse option, and 115-02's prohibition over that claim now already holds.

For **115-05**, the six gate names are fixed and are the set the doc's `replicate / warn / neither` column must equal: `meta-not-first-export`, `meta-not-const-export`, `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`, `meta-fields-invalid`. Two corrections must reach that document: nothing in the seven needs evaluation **and** the engine admits a numeric-literal `meta` key, so the doc must not describe check 8 as refusing one.

For **115-03**, `reinstall.ts:1062` still drops the same array standalone; this plan changed `install.ts` only, as scoped.

## Self-Check: PASSED

- `[ -f ]` on all seven modified files: present.
- `git log --oneline --all | grep` each of `8827af3a`, `5917b267`, `408d5440`, `3391effc`: all four found.
- `git rev-list --count 0c8e8112..HEAD` = 4, equal to the `actuals.commits` figure.
- Every task's `<acceptance_criteria>` re-run: all pass, with the one documented exception — the criterion requiring `{ 1: "a" }` to fire `meta-not-pure-literal` is **not** satisfied and must not be, because the engine admits that shape (Deviation 1). The criterion's own instruction, and the measured engine, both point the other way.
- Plan-level `<verification>`: `npm test` 5625/5625, `npm run typecheck` 0, `npm run fallow` 0, manifest-diff guard 0.

---

*Phase: 115-install-time-admission-gate-warnings*
*Completed: 2026-09-09*
