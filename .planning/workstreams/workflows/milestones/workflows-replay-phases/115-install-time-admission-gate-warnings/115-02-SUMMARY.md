---
phase: 115-install-time-admission-gate-warnings
plan: 02
subsystem: api
tags: [workflows, architecture-gate, source-scan, warnings, comments]
status: complete

requires:
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 01: readEngineGate with its own try/catch, the six-member WorkflowGate union, GATE_REASONS, gateWarning and the gate clause inside unrunnableWarning"
  - phase: 111-workflows-bridge
    provides: "domain/workflow-script.ts::the one parse() call every gate reads; bridges/workflows/discover.ts::softFailWarning and the tense phrase tables"
  - phase: 098-architecture-gates
    provides: "tests/architecture/source-scan.ts::REPO_ROOT, stripComments, assertNoForbiddenSurface, filesMatching"
provides:
  - "tests/architecture/workflows-single-parse.test.ts::the WGATE-02 parse-count gate, the evaluator-surface gate over the analyzer plus the derived workflows-bridge roster, and the WGATE-03 containment pin"
  - "tests/bridges/workflows/discover.test.ts::five bridge-contract cases -- one line per warned file, both tenses over one fixture, the stem-fallback overlap, a three-kind mixed directory, and frozen non-accumulating results"
  - "GATE_READER_DECLARATION -- the measured lesson that a bare indexOf of a declaration name is green for a name-EXTENDING rename"
  - "the three corrected comments: stemFallbackVerdict names the composition site, DETERMINISM_BLOCKLIST states two replicated gates and 3.10.1, and verdictWarning states the one-line-per-file rule"
affects:
  - "115-03: reinstall's own drop site; this plan changed no orchestrator"
  - "115-04: the info preview surface -- the preview-tense gate line is now pinned at the bridge layer, so a render-site case can assert the rendered bytes rather than re-deriving the phrase"
  - "115-05: docs/workflows-compatibility.md -- workflow-script.ts's comment now points at that document for the replicated-gate count, so the two must agree"

actuals:
  tokens: 6283
  tasks: 3
  commits: 3

plan_head_before: 250b54f55cf355c8a104c865a0540f40473ff08a

tech-stack:
  added: []
  patterns:
    - "a source gate that asserts a CARDINALITY (exactly one call site), which no zone-granularity import rule can express"
    - "a source gate that asserts a construct is PRESENT, not absent -- the inverse of every other gate in tests/architecture/"
    - "a declaration slice bounded by a line-initial keyword, with the identifier closed on the right by a word boundary so a name-extending rename fails instead of greening"
    - "a roster derived through the shared filesMatching mechanic rather than a second readdir helper, so the gate and its sibling cannot drift on how a target is read"

key-files:
  created:
    - tests/architecture/workflows-single-parse.test.ts
  modified:
    - tests/bridges/workflows/discover.test.ts
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts

key-decisions:
  - "MEASURED CORRECTION to this plan's own Task 2 instruction: it says to take `the index of \\`function readEngineGate\\``, and a bare `indexOf` of that string ALSO matches `readEngineGateRenamed`, because the sought text is a PREFIX of the renamed one. The slice then lands on the renamed function's body, still finds `try`/`catch`, and the case greens over a declaration that no longer exists under the name it pins. Caught by running a rename control the plan did not ask for. Fixed with `/^function readEngineGate\\b/m` and `exec`, and the control then reddens with the intended message."
  - "The slice's END boundary matches `interface` and `type` as well as `function` and `const`. The plan names only the latter two; the declaration that actually follows `readEngineGate` is `interface GateContext`, so the narrower pattern would have widened the window past a second declaration. Measured: the corrected boundary yields a 237-character slice that is exactly the signature plus the body."
  - "`filesMatching(dir, /\\S/)` supplies the bridge roster rather than a local `readdir` helper. `no-probe-in-workflows-bridge.test.ts` already carries such a helper for the same directory, and a second copy would be a duplicate the toolchain gates; the shared mechanic is also the one that guarantees the read-and-strip step cannot drift between the two gates (D-98-10)."
  - "Task 3's fourth falsified claim -- that the `named` arm alone earns no warning -- was already retired by plan 01, which is what falsified it. No edit was manufactured for it; the surviving unmet half of that acceptance criterion, the one-line-per-file rule, was added to the same comment."
  - "Task 1 has no RED commit and could not have one: its `<files>` names a test file only, so it adds no behavior, and the behavior it pins shipped in plan 01. Committed as `test(115-02)`, the honest type for a regression pin."

requirements-completed: [WGATE-01, WGATE-02, WGATE-03]

coverage:
  - id: D1
    description: "Each warned script earns exactly one warning line, and a sibling in the same directory that trips no gate earns none"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#WGATE-01: warns once for a gate-tripping script and leaves its well-formed siblings unwarned"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#WGATE-01: warns once per affected file in scan order across a mixed directory"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate line is stated in both tenses over one fixture, differing only in its outcome phrase"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#WGATE-01: states one gate line in both tenses, differing only in the outcome phrase"
        status: pass
    human_judgment: false
  - id: D3
    description: "A stem-fallback script carrying a gate earns one line, not two: the gate name rides the existing unrunnable caveat"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#WGATE-01: warns once, naming the engine check, for a stem-fallback script whose name is a substituted template"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#warns the same way when the declared name is present but not a literal"
        status: pass
    human_judgment: false
  - id: D4
    description: "Discovery returns frozen arrays and accumulates nothing across two passes over one unchanged directory"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#WGATE-03: returns a frozen warning array and accumulates nothing across two discovery passes"
        status: pass
    human_judgment: false
  - id: D5
    description: "The analyzer carries exactly one parse call site, so no gate can be read off a tree the verdict was not built from"
    requirement: WGATE-02
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-single-parse.test.ts#WGATE-02: the workflow script analyzer carries exactly one parse call site"
        status: pass
      - kind: other
        ref: "control A: a second bare parse call planted in the real module -- case one red, other two green; transcript in Controls Run"
        status: pass
    human_judgment: false
  - id: D6
    description: "Neither the analyzer nor any code-carrying workflows bridge module reaches for an evaluator, a function constructor, vm, or a dynamic import"
    requirement: WGATE-02
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-single-parse.test.ts#WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface"
        status: pass
      - kind: other
        ref: "control B (Function constructor in the analyzer) and control E (eval in bridges/workflows/stage.ts) -- case two red in both, transcripts in Controls Run"
        status: pass
    human_judgment: false
  - id: D7
    description: "readEngineGate's throw containment is pinned permanently in source, so deleting the try/catch wrapper reddens the tree"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-single-parse.test.ts#WGATE-03: readEngineGate still wraps its walk in try/catch"
        status: pass
      - kind: other
        ref: "control C (wrapper removed, walk left unwrapped) and control D (declaration renamed) -- case three red in both after the boundary fix; transcripts in Controls Run"
        status: pass
    human_judgment: false
  - id: D8
    description: "No comment in the two changed modules states a claim this hardening falsified, and the two falsifiable literals grep to zero"
    requirement: WGATE-02
    verification:
      - kind: other
        ref: "grep -c '0\\.x' and grep -c -iE 'phase [0-9]|plan [0-9]|wave [0-9]|task [0-9]' over both modules -- all zero"
        status: pass
    human_judgment: true
    rationale: "The two falsifiable literals are machine-checked, but whether each correction reads as a present-tense fact and narrates nothing that no longer exists is prose judgement. The plan names this reviewer-read and that is the honest ceiling."

duration: 24min
completed: 2026-09-09
---

# Phase 115 Plan 02: The WGATE-02 source gate and the bridge-side warning shape — Summary

**WGATE-02 stopped being a claim in a comment and became a gate that reads the source: exactly one `parse` call site, no evaluator surface anywhere in the analyzer or its bridge, and `readEngineGate`'s throw containment pinned as a property rather than as a one-time transcript — each of the three proven fail-first against a violation planted in the real module.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-09T04:36Z (plan base `250b54f5`)
- **Completed:** 2026-09-09T05:00Z (last task commit)
- **Tasks:** 3 of 3
- **Files created:** 1 — **modified:** 3

## Accomplishments

- **A gate that counts, which no zone rule can.** `tests/architecture/workflows-single-parse.test.ts` asserts the comment-stripped analyzer holds exactly one bare `parse(` call. Fallow's `boundaries.calls.forbidden` is per-zone and per-callee-name; it can bar a call, it cannot say "one is required and two is the violation". Stripping is mandatory and not stylistic — the module header legally names `parse`, the evaluator, the function constructor and the vm module in prose, so an unstripped scan would fail on its own subject's documentation.
- **A gate that asserts PRESENCE.** Case three is the inverse of every other gate in `tests/architecture/`: it requires a construct to exist. Before it, the only evidence `readEngineGate` contained its throws was a transcript in plan 01's SUMMARY plus one depth-budget unit test; delete the budget and the wrapper together and the phase's absolute — no gate reading can ever block an install — reverted to a hope.
- **The evaluator roster is derived, not listed.** The scan covers the analyzer plus every code-carrying module under `bridges/workflows/`, read from the tree through the shared `filesMatching` mechanic, so a bridge module added tomorrow is screened the day it lands. Control E planted `eval(` in `stage.ts` — a bridge module, not the analyzer — and the case went red, which is what proves the roster is not vacuous.
- **One line per warned file, pinned by a count.** Five bridge-layer cases: a gate-tripping script beside two well-formed siblings returns one warning; the same fixture read in both tenses yields two strings sharing a subject and a reason binding; a substituted-template `meta.name` earns one line that still names check 8; a three-kind mixed directory earns exactly three lines in scan order; and two passes over one unchanged directory return equal, frozen arrays.
- **A control the plan did not ask for found a real hole in the plan's own instruction.** See Deviations.
- **Three comments now state present-tense facts** about where the warning is composed, that the determinism screen is one of two replicated gates, that the host engine is at 3.10.1, and that one-line-per-file is a rule rather than an artifact of arm ordering.

## Task Commits

1. **Task 1: one warning line per file, both tenses, siblings untouched** — `525e690d` (`test(115-02)`)
2. **Task 2: the WGATE-02 source gate and the WGATE-03 containment pin** — `5aa155d5` (`test(115-02)`)
3. **Task 3: retire the falsified comments** — `92833f5c` (`docs(115-02)`)

**Plan metadata:** committed with this SUMMARY.

`plan_head_before: 250b54f55cf355c8a104c865a0540f40473ff08a` — `git rev-list --count 250b54f5..HEAD` = **3** at SUMMARY-write time, which is the `actuals.commits` figure above. The `actuals.tokens` figure is `chars/4` over `git diff 250b54f5..HEAD` (25135 chars), against a plan estimate of 55000 on the same instrument — a large overestimate, recorded as measured rather than adjusted toward the estimate.

## Files Created/Modified

- `tests/architecture/workflows-single-parse.test.ts` **(new, 210 lines)** — three cases plus `ANALYZER`, `WORKFLOWS_BRIDGE_DIR`, `BARE_PARSE_CALL`, `GATE_READER_DECLARATION`, `FORBIDDEN_PATTERNS`, `bridgeModules()` and `strippedAnalyzerSource()`. Imports `REPO_ROOT`, `assertNoForbiddenSurface`, `filesMatching` and `stripComments` from `./source-scan.ts`; imports no `*.test.ts` module (D-98-09).
- `tests/bridges/workflows/discover.test.ts` — five new cases under a `WGATE-01` section header, plus `GATED_NAMED`, `GATED_TEMPLATE_NAME`, `CHECK_3_REASON`, `CHECK_8_REASON` and `UNRUNNABLE_REASON`. Every expected string is a hand-written literal; nothing calls the production composer for its expectation.
- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — two doc comments. No code changed.
- `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` — one doc comment. No code changed.

## Decisions Made

See `key-decisions` in the frontmatter. The one that changes what this plan shipped:

**The plan's slice-start instruction was green for a rename.** It says to take the index of the literal string `function readEngineGate`. That string is a prefix of `function readEngineGateRenamed`, so `indexOf` finds it either way, the slice lands on the renamed function's body, and the `try`/`catch` tokens are still there. The case would have passed while pinning a declaration that no longer exists under the name in its title — precisely the failure mode the plan's own "a rename must fail this case loudly" clause was written to prevent. The fix closes the identifier on the right with `\b`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The plan's literal slice-start instruction greens on a name-extending rename**

- **Found during:** Task 2, running a rename control the plan did not mandate.
- **Issue:** the plan's `<action>` says to "Take the index of `function readEngineGate` in the stripped source". Implemented literally as `stripped.indexOf("function readEngineGate")`, it matches `function readEngineGateRenamed` as well, because the sought text is a PREFIX. The start-boundary assertion the plan requires — "a rename of `readEngineGate` must fail this case loudly, not green it over an empty slice" — therefore never fires: the slice is not empty, it is the WRONG function, and it still carries a `try`/`catch`. Measured: control D on the first implementation printed `pass 3 / fail 0`.
- **Fix:** the declaration is matched with `/^function readEngineGate\b/m` via `exec`, so the identifier is closed on the left by the line start and on the right by a word boundary. The message names the pattern rather than a bare string, so a failure tells the reader what to re-point.
- **Files modified:** `tests/architecture/workflows-single-parse.test.ts`.
- **Verification:** control D re-run after the fix — case three red with `no declaration matching /^function readEngineGate\b/m was found`, cases one and two green. All of A, B and C re-run against the corrected gate and each still reddens exactly its own case. Transcripts below.
- **Committed in:** `5aa155d5` (the corrected form is what landed; the weak form was never committed).

**2. [Rule 1 — Bug] The plan's slice END boundary would have widened the window past a second declaration**

- **Found during:** Task 2.
- **Issue:** the plan says to take "the index of the next line-initial `function ` or `const ` after it". The declaration that actually follows `readEngineGate` in the stripped source is `interface GateContext`, and the one after that is `function gateContext` — so the narrower pattern would have sliced across an entire intervening declaration. Harmless today (an interface cannot carry a `try`), but the case's own claim is that it reads ONE function's body.
- **Fix:** the end pattern matches a line-initial `function`, `const`, `let`, `var`, `class`, `interface`, `type` or `enum`, with the optional `export` and `async` prefixes. Measured: the resulting slice is 237 characters — exactly `readEngineGate`'s signature and body, ending immediately before the blank line preceding `interface GateContext`.
- **Files modified:** `tests/architecture/workflows-single-parse.test.ts`.
- **Verification:** the probe transcript under Controls Run, control C's `sed` output, and case three's own redness on wrapper removal.
- **Committed in:** `5aa155d5`.

**3. [Rule 3 — Blocking issue] Task 3's fourth comment was already correct**

- **Found during:** Task 3, at the mandated read of the current source.
- **Issue:** the plan lists `verdictWarning`'s claim that "the `named` arm alone earns no warning" as one of four comments to retire. Plan 01 already corrected it — its own Next Phase Readiness section says so and gives the reason (plan 01 is what falsified the claim, and leaving a false comment behind for one plan was the worse option). Re-correcting it would have manufactured an edit.
- **Fix:** no edit to that sentence. The half of the same acceptance criterion that was NOT yet satisfied — "states the one-line-per-file rule" — was added as a new paragraph to the same doc comment, so the rule is stated where the arms are chosen rather than only in an inline comment inside `unrunnableWarning`.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts`.
- **Verification:** `grep -rn -iE "roadmap criterion|ONLY engine gate|only replicated|arm alone earns no"` over the analyzer and the whole bridge directory returns nothing.
- **Committed in:** `92833f5c`.

**4. [Rule 3 — Blocking issue] Task 1's fourth behavior bullet is pinned by an existing case**

- **Found during:** Task 1.
- **Issue:** the bullet "a `stem-fallback` script that trips a structural gate earlier in the engine's order returns one warning naming that earlier check" describes exactly the case `warns the same way when the declared name is present but not a literal`, which plan 01 updated to carry the check-3 clause byte-exactly. A second case over the same shape would be a near-duplicate the toolchain gates (`sonarjs/no-identical-functions`, `fallow dupes`).
- **Fix:** no new case for that bullet; it is credited to the existing one, and listed under coverage `D3` beside the new substituted-template case, which trips check 8 instead — a different gate, so the pair covers both an early structural gate and a later literal gate.
- **Files modified:** none.
- **Verification:** `node --test tests/bridges/workflows/discover.test.ts` — 34 pass, including that existing case.
- **Committed in:** n/a (no edit).

---

**Total deviations:** 4 auto-fixed (2 × Rule 1, 2 × Rule 3). **Zero Rule 4 escalations.**

**Impact on plan:** deviations 1 and 2 make the new gate stricter than the plan specified, and deviation 1 is this milestone's "green because it checked nothing" pattern appearing inside the very gate written to guard against it — found only because a control beyond the mandated three was run. Deviations 3 and 4 avoid two manufactured edits; both are reported rather than silently absorbed, and neither reduces what the plan asserts. No scope creep: no new production symbol, no dependency, no orchestrator touched.

## Controls Run

Five planted-violation controls, three mandated and two added. Every plant went into the REAL module so the gate read the plant, and every restore was confirmed with `git status --short`. Transcripts, not summaries.

### The measurement that preceded the gate

Run before a line of the gate was written, so no threshold was chosen to fit:

```text
bare parse( count: 1 ["parse("]
extensions/pi-claude-marketplace/domain/workflow-script.ts        -> clean | nonWS: true
extensions/pi-claude-marketplace/bridges/workflows/discover.ts    -> clean | nonWS: true
extensions/pi-claude-marketplace/bridges/workflows/index.ts       -> clean | nonWS: true
extensions/pi-claude-marketplace/bridges/workflows/stage.ts       -> clean | nonWS: true
extensions/pi-claude-marketplace/bridges/workflows/types.ts       -> clean | nonWS: true
extensions/pi-claude-marketplace/bridges/workflows/unstage.ts     -> clean | nonWS: true
startIndex: 12080
nextDecl offset: 237
--- slice ---
"(ast: Program, elements: readonly MetaElement[]): WorkflowGate | undefined {\n  try {\n    const ctx = gateContext(ast, elements);\n\n    return GATE_ORDER.find((gate) => GATE_PREDICATES[gate](ctx));\n  } catch {\n    return undefined;\n  }\n}\n\n"
```

### Control A — a second bare `parse(` call site

Planted into `domain/workflow-script.ts`:

```ts
function plantedSecondParse(source: string): unknown {
  return parse(source, { ecmaVersion: "latest", sourceType: "module" });
}
```

```text
✖ WGATE-02: the workflow script analyzer carries exactly one parse call site (23.58528ms)
✔ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (32.446284ms)
✔ WGATE-03: readEngineGate still wraps its walk in try/catch (11.824456ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1
✖ failing tests:
✖ WGATE-02: the workflow script analyzer carries exactly one parse call site (23.58528ms)
  AssertionError [ERR_ASSERTION]: WGATE-02 violation: extensions/pi-claude-marketplace/domain/workflow-script.ts has 2 bare parse call sites, not one. Every gate this module reports must be decided from the ONE tree the verdict was built from. A second parse lets the gate reader and the verdict disagree about the same script -- naming a rule the installed script does not break, or staying silent about one it does. Reuse the existing parse products instead of adding a call.
--- restore ---
(empty above == restored)
```

Re-run against the corrected gate after deviation 1: `✖` case one, `✔ ✔` the other two, `pass 2 / fail 1`.

### Control B — a function constructor in the analyzer

Planted `return new Function(code)();`:

```text
✔ WGATE-02: the workflow script analyzer carries exactly one parse call site (7.653325ms)
✖ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (19.366667ms)
✔ WGATE-03: readEngineGate still wraps its walk in try/catch (8.900768ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1
✖ failing tests:
✖ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (19.366667ms)
  AssertionError [ERR_ASSERTION]: WGATE-02 violation: evaluator surface detected in the workflow script analyzer or its bridge:
    extensions/pi-claude-marketplace/domain/workflow-script.ts matches forbidden function constructor call: /\bFunction\s*\(/
--- restore ---
(empty above == restored)
```

Re-run against the corrected gate: `✔ ✖ ✔`, `pass 2 / fail 1`.

### Control C — `readEngineGate`'s `try`/`catch` WRAPPER removed

The wrapper, not the `catch` clause alone: a bare `try` with no `catch` and no `finally` is a `SyntaxError`, and the regression this case guards is an unwrapped walk, not an unparseable file. The planted state, read back off disk:

```ts
function readEngineGate(ast: Program, elements: readonly MetaElement[]): WorkflowGate | undefined {
  const ctx = gateContext(ast, elements);

  return GATE_ORDER.find((gate) => GATE_PREDICATES[gate](ctx));
}
```

```text
✔ WGATE-02: the workflow script analyzer carries exactly one parse call site (8.379204ms)
✔ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (10.18567ms)
✖ WGATE-03: readEngineGate still wraps its walk in try/catch (3.033727ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1
✖ failing tests:
✖ WGATE-03: readEngineGate still wraps its walk in try/catch (3.033727ms)
  AssertionError [ERR_ASSERTION]: WGATE-03 violation: `function readEngineGate` no longer opens a `try`. A gate reading may never block an install: it walks untrusted third-party AST through mutually recursive predicates, and its only caller does not guard it, so a throw escaping this function fails a whole plugin install rather than costing one script its warning.
--- restore ---
(empty above == restored)
```

That transcript is the re-run against the corrected gate. The first implementation reddened identically here — the boundary defect deviation 1 records is invisible to this control, which is why control D exists.

### Control D — the declaration renamed (added; this is the one that found the hole)

`function readEngineGate(ast: Program` → `function readEngineGateRenamed(ast: Program`.

**First implementation, `indexOf("function readEngineGate")`:**

```text
declaration renamed
✔ WGATE-02: the workflow script analyzer carries exactly one parse call site (26.423633ms)
✔ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (24.951011ms)
✔ WGATE-03: readEngineGate still wraps its walk in try/catch (7.384947ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

Green. The sought string is a prefix of the renamed one, so the slice landed on the renamed function's body and found its `try`/`catch`.

**After the fix, `/^function readEngineGate\b/m` with `exec`:**

```text
declaration renamed to readEngineGateRenamed
✔ WGATE-02: the workflow script analyzer carries exactly one parse call site (10.622926ms)
✔ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (7.627968ms)
✖ WGATE-03: readEngineGate still wraps its walk in try/catch (2.932856ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1
✖ failing tests:
✖ WGATE-03: readEngineGate still wraps its walk in try/catch (2.932856ms)
  AssertionError [ERR_ASSERTION]: WGATE-03: no declaration matching /^function readEngineGate\b/m was found in extensions/pi-claude-marketplace/domain/workflow-script.ts. This case pins that function's throw containment, so a rename leaves the containment unchecked; point the pattern at the new name.
--- restore ---
(empty above == restored)
```

### Control E — an evaluator in a BRIDGE module, not the analyzer (added)

`return eval(code);` planted in `bridges/workflows/stage.ts`, to prove the derived roster is not vacuous:

```text
✔ WGATE-02: the workflow script analyzer carries exactly one parse call site (8.727188ms)
✖ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (11.968887ms)
✔ WGATE-03: readEngineGate still wraps its walk in try/catch (3.524302ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1
✖ failing tests:
✖ WGATE-02: neither the analyzer nor the workflows bridge carries an evaluator surface (11.968887ms)
    extensions/pi-claude-marketplace/bridges/workflows/stage.ts matches forbidden direct evaluator call: /\beval\s*\(/
--- restore ---
(empty above == restored)
```

### Restored state, after every control

```text
$ git status --short -- extensions/
(no output)
$ node --test tests/architecture/workflows-single-parse.test.ts
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

Each control reddens EXACTLY ONE case and leaves the other two green, so no case is passing on another's evidence.

## Verification Results

Every `<automated>` command from every task, plus the plan-level block.

| Command | Result |
|---|---|
| `node --test tests/bridges/workflows/discover.test.ts` (Task 1) | 34 tests, 34 pass, 0 fail |
| `node scripts/test-coverage-direct.mjs .../bridges/workflows/discover.ts` (Task 1) | exit 0 — branches 56/56, functions 13/13, lines 472/472 |
| `node --test tests/architecture/workflows-single-parse.test.ts` (Task 2) | 3 tests, 3 pass, 0 fail |
| tap-reporter focused verify (Task 2) | exit 0; matched `ok 3 - WGATE-03: readEngineGate still wraps its walk in try/catch`, the only WGATE-03-anchored case in the file |
| `npm run lint` (Task 2) | exit 0; zero mentions of `tests/architecture/workflows-single-parse.test.ts` |
| `node --test "tests/{architecture,bridges,domain}/**/*.test.ts"` (Task 2) | 2040 tests, 151 suites, 2040 pass, 0 fail |
| `grep -c "0\.x"` in the analyzer (Task 3) | exit 0 — count zero |
| `grep -c -iE "phase [0-9]\|plan [0-9]\|wave [0-9]\|task [0-9]"` in the analyzer (Task 3) | exit 0 — count zero |
| the same grep in `bridges/workflows/discover.ts` (Task 3) | exit 0 — count zero |
| `npm run typecheck` (Task 3) | exit 0 |
| `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts` (Task 3) | 152 tests, 152 pass, 0 fail |
| `npm test` (plan level) | 5633 tests, 313 suites, 5633 pass, 0 fail |
| `npm run fallow` (plan level) | exit 0 — dead-code, health and dupes all clean, via the `npm fallow` pre-commit hook on each commit and again inside `npm run check` |
| `npm run test:corresponding` (plan level) | exit 0 — "Corresponding-test gate passed." |
| `test -z "$(git diff HEAD --name-only -- package.json package-lock.json)"` (plan level) | exit 0 — no dependency manifest touched; `git diff --name-only 250b54f5..HEAD` names only the four planned files |
| **`npm run check`** (whole gate, beyond the plan's ask) | **exit 0** — typecheck, lint, fallow, format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative, 5633/5633 unit, 34/34 integration |

The baseline was 5625 unit tests in 313 suites. 5633 is +8: five new discovery cases and three new architecture cases, exactly the number added.

## TDD Gate Compliance

| Gate | Commit | Status |
|---|---|---|
| RED | — | structurally unavailable; see below |
| GREEN | — | n/a — no production behavior added |
| REFACTOR | — | not needed |

**Task 1 is declared `tdd="true"` and carries no RED commit, and that is structural rather than a lapse.** Its `<files>` names one test file, so it is not a behavior-adding task by the plan's own declaration: `tdd="true"` is present and a `<behavior>` block is present, but there are no non-test source files in `<files>`, so the MVP+TDD behavior-adding predicate is false and the gate is exempt. The behavior it pins shipped in plan 01 and every case passed on first run — which under `tdd.md`'s fail-fast rule 1 is the "feature may already exist" branch, investigated and confirmed: `git log` shows `5917b267 feat(115-01): warn at install time which engine gate refuses a script`. A failing-first test was available only by asserting something false. All three tasks are committed as the honest type for what they contain — `test(115-02)` for the two regression pins, `docs(115-02)` for the comment corrections.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced; no test is skipped, `todo`, or `only`; every `<verify>` command in every task was run with real output. Nothing was appended to `.planning/WINDOWS.md` because there is nothing open to record.

## Threat Flags

None. The plan's `<threat_model>` covers every surface touched, and each `mitigate` disposition is implemented:

- **T-115-08 (elevation of privilege, critical)** — the evaluator-surface case forbids `eval`, the `Function` constructor, a `node:vm`/`vm` import, a `vm` require and a dynamic `import(` across the analyzer and every code-carrying bridge module, proven fail-first by controls B and E.
- **T-115-09 (tampering with the gate itself, high)** — reads through `readFile` rather than a `grep` subprocess (D-98-10), strips comments before every match, and fails on a target that does not exist (`assertNoForbiddenSurface` WR-06). The roster is derived from the tree, and control E shows a bridge module is genuinely inside it.
- **T-115-10 (spoofing the gate reader's inputs, medium)** — `GATE_REASONS` interpolates no script-derived text; every expected string in the new discovery cases is a hand-written literal, so the pinned bytes contain nothing an attacker could choose.
- **T-115-11 (repudiation, the corrected comments, low — accepted)** — the two falsifiable literals grep to zero; truthfulness of the prose is reviewer-read, recorded as `human_judgment: true` on coverage `D8`.
- **T-115-12 (dependency manifests, high)** — no package installed; the manifest-diff guard exits 0.

## Issues Encountered

**1. The gate's residual limitation, stated rather than papered over.** `stripComments` removes block comments and LINE-INITIAL `//` comments only, so a trailing `// ...` comment inside `readEngineGate` would survive the strip and could in principle carry the words `try` and `catch`. Case three is therefore a presence pin backed by a removal control, not a proof that those words appear nowhere else in the slice. The limitation is written into the case's own comment. Not worth closing: tightening the strip is a change to a primitive four other gates depend on, and the failure it would guard needs someone to write a comment containing both words inside that one function while deleting the construct.

**2. The stale-header finding plan 01 surfaced is still open, and this plan did not touch it.** `surfaceDiscoveryWarnings` heads its block with `... 1 declared component was skipped.` while a gate line says `was installed but the engine will refuse to load it`. Already recorded in `deferred-items.md` and `.planning/WINDOWS.md` by plan 01; it belongs to 115-04, which owns the render sites and the output catalog. No new ledger entry was added, because a second entry for one defect is what makes a ledger unreadable.

**3. `STATE.md` and `ROADMAP.md` were deliberately not written.** The known-broken workstream state verbs aside, plans 03, 04 and 05 of this phase have no SUMMARY yet, so a per-plan write here would race a sibling executor and misreport the phase position. The orchestrator owns that update centrally; this plan's committed artifact is the SUMMARY.

## User Setup Required

None. No external service, no credential, no dependency install. The controls edited files in place and restored them from a scratchpad copy; `git stash` was never used, in either direction.

## Next Phase Readiness

Ready for **115-03** and **115-04**. What this plan leaves in place for them:

- **`115-04` inherits a pinned preview phrase.** `would be installed but the engine will refuse to load it` is now asserted at the bridge layer over the same fixture as its install-tense pair, so an `info` render-site case can compare rendered bytes instead of re-deriving the phrase — and if 115-04 changes either phrase, the tense-pair case is where it shows up as a diff.
- **`115-05` inherits a pointer it must honor.** `DETERMINISM_BLOCKLIST`'s comment now says `docs/workflows-compatibility.md` carries the replicated-gate count. That document says **two** (the determinism screen and the parse). If 115-05 restates the count, the comment and the document must move together.
- **Nothing in `orchestrators/` changed.** `reinstall.ts`'s own drop site is untouched and remains 115-03's, exactly as plan 01 left it.
- **The new gate needs no maintenance on a bridge addition.** Its roster is derived. It DOES need a one-line edit if `readEngineGate` is ever renamed, and control D proves that edit is forced rather than optional.

## Self-Check: PASSED

- `[ -f ]` on `tests/architecture/workflows-single-parse.test.ts` and all three modified files: present.
- `git log --oneline --all | grep` each of `525e690d`, `5aa155d5`, `92833f5c`: all three found.
- `git rev-list --count 250b54f5..HEAD` = 3, equal to the `actuals.commits` figure, measured rather than narrated.
- `git diff --name-only 250b54f5..HEAD` names exactly the four files in `files_modified`, and no operator-owned file (`.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/`, the workstream `config.json` and `.verification-ledger.json`) is staged or committed.
- Every task's `<acceptance_criteria>` re-run: all pass, with the two documented substitutions — Task 3's `verdictWarning` sentence was already correct (deviation 3, the unmet half of that criterion is satisfied) and Task 1's early-structural-gate bullet is credited to an existing case (deviation 4).
- Plan-level `<verification>`: `npm test` 5633/5633, `npm run typecheck` 0, `npm run fallow` 0, `npm run test:corresponding` 0, manifest-diff guard 0, and `npm run check` 0 end to end.

---

*Phase: 115-install-time-admission-gate-warnings*
*Completed: 2026-09-09*
