---
phase: 110-domain-and-platform-modules
plan: 03
subsystem: domain
tags: [port, workflows, acorn, ast, script-admission, determinism, node-test, coverage]

# Dependency graph
requires:
  - phase: 110-domain-and-platform-modules
    provides: "110-02's `generatedWorkflowName` in `domain/name.ts` and `WorkflowNameCollisionError` / `WorkflowNameCollision` / `errorMessage` in `shared/errors.ts` — the four imports this module resolves against"
  - phase: 110-domain-and-platform-modules
    provides: "110-01's proved mechanism — path-scoped checkout, blast-radius assertion, owner test as sole consumer, complete direct coverage, whole-tree gate at the commit boundary"
  - phase: 109-kind-inversion
    provides: "`workflows` as a supported component kind"
provides:
  - "`admitWorkflowScript(pluginName, fileName, source)` in `domain/workflow-script.ts` — one script's fate decided from its text alone, by parsing and never evaluating"
  - "`assertNoWorkflowNameCollisions(verdicts)` — the set-level defect that stays a throw"
  - "`WORKFLOW_SCRIPT_EXTENSIONS` and `fileStem(fileName)` — the stem rule and the suffix set the discovery filter must agree with"
  - "eight verdict types: `NamedWorkflow`, `StemFallbackWorkflow`, `SkippedWorkflow`, `RefusedWorkflow`, `WorkflowVerdict`, `AdmittedWorkflow`, `SkippedCause`, `RefusedCause`"
  - "`acorn` at `^8.16.0` under `dependencies` — the range the host engine itself pins"
  - "`tests/domain/workflow-script.test.ts` — 51 cases across three entrypoint blocks, every export imported by name"
affects: [111-workflows-bridge, 115-admission-gate-warnings]

actuals:
  tokens: 12294
  tasks: 3
  commits: 1

tech-stack:
  added: [acorn@^8.16.0]
  patterns:
    - "A verdict is asserted through a projection that drops `reason`, so wording edits cannot break a test and no test can discriminate a verdict by message text"
    - "A coverage gap is closed by finding the arm at the reported line and adding a public-behaviour case, never by a suppression directive"
    - "The dependency, the module that imports it, and the owner test that consumes its exports land as one commit, because any intermediate tree is red"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - tests/domain/workflow-script.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "The docblock's engine citation was refreshed to 3.10.1 / `dist/workflow.js:37` and now states the literal was re-verified unchanged at that version; no line of executable code was touched."
  - "Two coverage cases the research did not predict were needed — a computed `meta` key and a stem fallback whose stem is itself unusable. The restructure changed which arms the case set reaches, exactly as Assumptions Log A2 warned, so the draft's measured pair was treated as a starting point rather than a guarantee."
  - "The plugin-name throw is asserted by exact message equality, not substring, mirroring the in-repo shape at `tests/domain/name.test.ts:127-132`. `assertSafeName` throws a bare `Error` with no structured field, so class plus exact message is the strongest available discrimination."
  - "The three encoding backstop sources and the two normalization-form names are written as `\\uXXXX` escapes, never as pasted code points."

patterns-established:
  - "Projection-based verdict assertion: build `{outcome, cause}` or `{outcome, metaName, generatedName}` from the actual verdict, `satisfies` the expectation against a projection interface, and compare with one `deepStrictEqual`."
  - "Ordering divergences are pinned as adjacent case pairs — unparseable-and-blocklisted next to no-meta-and-blocklisted, empty-source next to invalid-syntax — so two outcomes can never quietly collapse into one."

requirements-completed: [WNAM-01, WNAM-02, WNAM-04, WNAM-05]

coverage:
  - id: D1
    description: "`meta.name` extraction survives the comment decoy, the string decoy and the double-quoted key — all three resolve to the AST-declared name"
    requirement: "WNAM-01"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#reads the declared name past a usage comment naming a different name / a help string quoting a different name / a double-quoted name key"
        status: pass
    human_judgment: false
  - id: D2
    description: "The generated name carries the plugin-prefix elision, and `metaName` and `generatedName` are pinned in one projection so they cannot drift apart"
    requirement: "WNAM-01"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#elides the plugin prefix from the declared name"
        status: pass
    human_judgment: false
  - id: D3
    description: "An empty (0-byte) script is `skipped` / `no-meta`, not `refused` / `unparseable`; genuinely invalid syntax is `refused` / `unparseable`. Both halves are pinned adjacently"
    requirement: "WNAM-04"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#skips an empty script for declaring no meta, rather than refusing it as unparseable ; #refuses genuinely invalid syntax as unparseable"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both ordering divergences from the engine: unparseable settles before the determinism scan, and the meta lookup settles before it too"
    requirement: "WNAM-04"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#settles unparseable before the determinism scan when a script is both ; #settles the meta lookup before the determinism scan when a helper module is both"
        status: pass
    human_judgment: false
  - id: D5
    description: "The three skip causes are each reachable and each distinctly reported, including the optional-chain arm reached by a bare `let meta;` and the spread-position pair that makes last-wins a rule"
    requirement: "WNAM-03"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#skips a script that declares no meta at all / initializes meta from a call expression / declares meta with no initializer at all / carries a spread after its last literal name ; #lets a literal name that follows a spread win"
        status: pass
    human_judgment: false
  - id: D6
    description: "A non-string-literal `name` — template literal, concatenation, numeric literal, bare identifier — falls back to the file stem with the value never evaluated, proved by the generated name being the stem and not the written text"
    requirement: "WNAM-02"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#falls back to the file stem when the name is a template literal / a string concatenation / a numeric literal / a bare identifier"
        status: pass
    human_judgment: false
  - id: D7
    description: "An empty string LITERAL name is `refused` / `unsafe-name` — an admitted name that then fails the safe-name check, distinct from every stem fallback and every skip"
    requirement: "WNAM-02"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#refuses an empty string name, which is neither a stem fallback nor a skip"
        status: pass
    human_judgment: false
  - id: D8
    description: "All six refusal causes are reachable and distinct; the four determinism causes are separated by WHERE the match sits, and the first executable match decides the whole script"
    requirement: "WNAM-04"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#refuses a blocklisted token sitting in executable code / only inside a line comment / only inside a string literal / only inside a regular-expression literal / straddling the boundary between a comment and code ; #lets the first executable match decide"
        status: pass
    human_judgment: false
  - id: D9
    description: "The vendored literal carries no global flag, pinned behaviourally: a second scan over the same source refuses identically, so no match position is carried between calls"
    requirement: "WNAM-04"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#refuses the same source on a second scan, so no match position is carried over"
        status: pass
    human_judgment: false
  - id: D10
    description: "The module holds no state between calls — one source gets the same verdict whether or not another source was read between. Structural support for the phase's no-module-global claim"
    requirement: "WNAM-02"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#gives one source the same verdict whether or not another source was read between"
        status: pass
    human_judgment: false
  - id: D11
    description: "A per-file unsafe name refuses that file alone rather than escaping; an unsafe PLUGIN name throws, because it disqualifies the whole set"
    requirement: "WNAM-05"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#refuses this file alone when its declared name carries a path separator / an interior space / when the stem it falls back to is itself unusable ; #throws on an unsafe plugin name"
        status: pass
    human_judgment: false
  - id: D12
    description: "Collision detection: two claimants throw `WorkflowNameCollisionError` with every claimant as structured data; empty, single-element and non-admitting-arm inputs return without throwing; two independent collisions group by first-seen name"
    requirement: "WNAM-05"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#reports both claimants ; #accepts an empty verdict set ; #accepts a single admitted verdict ; #accepts skipped and refused verdicts that share a file name ; #groups two independent collisions by first-seen name"
        status: pass
    human_judgment: false
  - id: D13
    description: "The stem rule: each of the three suffixes is dropped, a mixed-case suffix is dropped, a double extension keeps its inner segment, and an unknown or mid-name suffix is returned unchanged"
    requirement: "WNAM-02"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#lists the script suffixes the stem drops ; #derives \"drafter\" from \"drafter.js\"/.mjs/.cjs ; #derives \"Drafter\" from \"Drafter.JS\" ; #derives \"drafter.workflow\" from \"drafter.workflow.js\""
        status: pass
    human_judgment: false
  - id: D14
    description: "SECURITY (T-110-12): the module parses and never evaluates — no evaluator call, no function constructor, no vm import, no dynamic module load"
    verification:
      - kind: other
        ref: "grep -v '^\\s*[/*]' workflow-script.ts | grep -cE '\\beval\\(|new Function\\(|node:vm|import\\(' == 0"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#falls back to the file stem when the name is a template literal (the value is denied a name, never resolved)"
        status: pass
    human_judgment: false
  - id: D15
    description: "`acorn` is declared at `^8.16.0` under `dependencies`, not `devDependencies`, and the dependency plus module plus owner test landed as one commit so no intermediate tree is red"
    verification:
      - kind: other
        ref: "node -e package.json check => '^8.16.0|undefined' ; git show --pretty=format: --name-only HEAD names exactly four paths ; fallow dead-code => No issues found"
        status: pass
    human_judgment: false
  - id: D16
    description: "The unicode-normalization backstop: two canonically equivalent generated names in different forms are NOT reported as a collision by this module"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#compares names as exact strings, so two normalization forms do not collide here"
        status: pass
    human_judgment: false
  - id: D17
    description: "The encoding backstop: a source carrying a byte-order mark, a lone surrogate, or replacement characters answers deterministically and never throws out of `admitWorkflowScript`"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#answers deterministically and throws nothing for a source carrying a leading byte-order mark / a lone surrogate / replacement characters"
        status: pass
    human_judgment: false
  - id: D18
    description: "The whole gate chain is green and all five pairs the phase touched are at complete direct coverage, so no new accepted shortfall is created"
    verification:
      - kind: other
        ref: "typecheck 0 errors; eslint exit 0; fallow exit 0 (dead-code: No issues found); format:check clean; test:corresponding + negative pass; test:coverage:direct:negative pass; 5284 unit tests pass; 32 integration tests pass"
        status: pass
      - kind: other
        ref: "test:coverage:direct — workflow-home 2/2 1/1 32/32; workflow-project-key 5/5 2/2 71/71; workflow-script 105/105 32/32 684/684; name 44/44 6/6 234/234; errors 102/102 46/46 651/651"
        status: pass
    human_judgment: false
  - id: D19
    description: "The optional live-engine parity check for `workflowProjectKey` against a scratch-installed engine at 3.10.1"
    verification: []
    human_judgment: true
    rationale: "Recorded as manual-only in 110-VALIDATION.md and deliberately outside the gate. The oracle is not a dependency of this package and must not become one, so no automated run can attest to it. NOT RUN in this plan; the committed measured literals remain the standing mitigation."

# Metrics
duration: 47 min
completed: 2026-09-05
status: complete
---

# Phase 110 Plan 03: Script admission by parsed `meta.name` Summary

**One acorn parse decides an untrusted workflow script's fate — command name from the declared `meta.name`, nine distinct non-admission causes, and a determinism blocklist match attributed to code, comment, literal or boundary — landed with `acorn` and its 51-case owner test in one commit.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-09-05T00:45:00Z
- **Completed:** 2026-09-05T01:32:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `domain/workflow-script.ts` ported verbatim from the port branch with one comment edit only: the vendored-blocklist docblock now cites engine 3.10.1 / `dist/workflow.js:37` and records that the literal was re-verified unchanged there. Zero lines of executable code changed; the diff against `HEAD` is purely additive.
- `acorn` declared at `^8.16.0` under `dependencies` — the range the host engine itself pins. The lockfile diff is exactly the measured two lines: one root-dependency entry added, and the dev-only marker dropped from the already-resolved acorn record.
- `tests/domain/workflow-script.test.ts` written fresh from the spike draft's proven case set, restructured to the current rule: three top-level `describe()` blocks (one per entrypoint, none nested), `strictEqual`/`deepStrictEqual` only, `// arrange` / `// act` / `// assert` on every case, and no case that reads the module's own source from disk.
- Every export — four runtime, eight type — imported by name, so the dead-code gate stays green with no suppression marker anywhere. `fallow dead-code` reports `No issues found`.
- Complete direct coverage on the pair: **branches 105/105, functions 32/32, lines 684/684**. All five pairs the phase touched are at `hit === found`.

## Task Commits

All three tasks land as one commit by design — the dependency, the module that imports it, and the owner test that consumes its exports cannot be separated without publishing a tree the dead-code gate rejects.

1. **Tasks 1–3: declare acorn, land the module, pin every verdict, close the gate** — `d3c5be6f` (feat)

**Plan metadata:** see the `docs` commit that carries this SUMMARY.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — 684 lines. Decides one script's fate from `(pluginName, fileName, source)`, parsing and never evaluating.
- `tests/domain/workflow-script.test.ts` — 771 lines, 51 cases across three entrypoint blocks.
- `package.json` — `acorn: "^8.16.0"` added to `dependencies`, alphabetically before `isomorphic-git`.
- `package-lock.json` — npm's two-line rewrite, committed exactly as produced.

## The two coverage gaps the research did not predict

The research measured the spike draft's owner test at `FN 32/32 · BR 106/107 · LN 681/683`, with the single gap at `metaPropertyKey`'s trailing `return undefined`, and predicted that one numeric-key case would close it.

The restructured case set produced a different gap pair. The first measurement after Tasks 1 and 2 reported **branches 101/103, lines 680/684**, with uncovered lines `276-277` and `584-585`:

- `584-585` is `metaPropertyKey`'s `p.computed` early return — a *different* arm from the trailing `return undefined` the numeric-key case closes. The draft reached the computed arm somewhere the restructure dropped.
- `276-277` is `stemFallbackVerdict`'s refusal arm: a `meta` with no readable name whose *stem* is itself an unusable command name. Nothing in the draft's set exercised it.

Two cases closed both through public behaviour:

- `reads past a computed meta key, which is not statically knowable` — `{ [chosenKey]: "x", name: "ship" }`
- `refuses this file alone when the stem it falls back to is itself unusable` — file name `weekly report.js` with a description-only `meta`, whose stem `weekly report` fails the engine-parity whitespace screen

No coverage suppression directive was added, and no code was removed to shrink the denominator. This is exactly the outcome Assumptions Log **A2** anticipated: the restructure changes which cases execute which arms, so the draft's numbers are a starting point, never a guarantee.

## WNAM-03 carry-forward

Flagged in the plan's `<flagged_planner_assumptions>` and confirmed here, unchanged.

WNAM-03 reads: *"A script with no `meta` declaration is skipped with a warning and not installed."* It has two halves, and **only the classification half closes in this phase**:

| Half | Status | Owner |
|---|---|---|
| classified as `skipped` with cause `no-meta` | **Done here** — pinned by three cases, and by the case that keeps it apart from `refused`/`unparseable` | this plan |
| surfaced to the user as a warning | **Not done** — nothing in Phase 110 emits anything to a user | Phase 111 bridge rendering |
| "and not installed" | **Not done** — nothing in this phase installs | Phase 111 |

`requirements-completed` therefore lists **WNAM-01, WNAM-02, WNAM-04, WNAM-05** and deliberately omits WNAM-03. If WNAM-03 was meant to close inside Phase 110 it does **not**, and the requirement should be re-scoped or split rather than marked satisfied.

## Human-check confirmations

The plan's `<human-check>` asked for four phase-boundary confirmations plus one optional live check. Recorded:

| Confirmation | Answer | Evidence |
|---|---|---|
| No release cut from this branch | Confirmed | no `v*` tag created; no publish workflow invoked |
| No version number moved | Confirmed | `package.json` version `0.18.1`; `sonar.projectVersion=0.18.1`; `EXTENSION_VERSION = "0.18.1"`. `git diff --stat HEAD -- extension-version.ts sonar-project.properties` is empty |
| No dead-code suppression marker added anywhere in the phase | Confirmed | `grep -c 'fallow-ignore'` over `workflow-script.ts`, `workflow-project-key.ts`, `workflow-home.ts`, `name.ts` and the new test file → `0` each |
| Phase 109 and Phase 111 territory untouched | Confirmed | both `git status --porcelain` blast-radius checks printed `0`, immediately after the checkout and again after the commit |
| Optional live-engine parity for `workflowProjectKey` | **NOT RUN** | Manual-only by design (`110-VALIDATION.md`). The oracle `@quintinshaw/pi-dynamic-workflows` is deliberately not a dependency and must not become one; the committed measured literals are the standing mitigation. Running it later requires a scratch `npm install --prefix` at 3.10.1 and the Spike 025 key-parity comparison, expecting zero mismatches across fourteen cases. |

## Decisions Made

- **The engine citation was refreshed, not annotated.** The docblock now names 3.10.1 and `dist/workflow.js:37` and states the literal was re-verified unchanged at that version. Everything else in the docblock — why the literal carries no global flag, why this is the only replicated engine gate — stays verbatim.
- **Verdicts are asserted through a projection that drops `reason`.** Two module-scope pure functions build `{outcome, cause}` and `{outcome, metaName, generatedName}` from the actual verdict; the expectation is a literal checked with `satisfies` and compared with one `deepStrictEqual`. `reason` is the only field that changes when wording is edited, and discriminating a verdict by message text is the failure the literal-tagged union exists to remove.
- **The plugin-name throw is asserted by class plus exact message.** `assertSafeName` throws a bare `Error` with no structured field, so exact-message equality is the strongest discrimination available. This mirrors the in-repo shape at `tests/domain/name.test.ts:127-132`. It is not a substring match, and no verdict anywhere in the file is discriminated by its `reason`.
- **Invisible code points are escapes, never pasted.** The first draft of the encoding backstop carried a literal byte-order mark and a literal replacement character; both were converted to their backslash-u escape form before any gate ran, along with the lone-surrogate source and the two normalization-form names in the collision backstop. Same lesson 110-02 recorded, caught the same way.

## Deviations from Plan

### Documentation deviations (no rule fired)

No deviation rule 1–4 fired: no bug, no missing critical functionality, no blocker, and no architectural question arose.

**1. One grep-shaped criterion carries a pattern that cannot match the house code shape**

- **Found during:** Task 1, at the acceptance-criteria gate
- **Issue:** the criterion reads `grep -cE 'describe\("admitWorkflowScript"\)' ... prints 1`. The pattern requires a closing paren immediately after the closing quote, but every `describe()` in this repository is written `describe("Name", () => {`, so it matches zero blocks. This is the same unsatisfiable-as-written shape 110-02 recorded for its two criteria.
- **Fix:** verified the intent with the corrected pattern `describe\("admitWorkflowScript",` → `1`. The two Task 2 criteria are written in the corrected form already and both print `1`.
- **Files modified:** none — a criterion-authoring error, not an implementation gap
- **Verification:** `grep -cE 'describe\("admitWorkflowScript",'` → `1`; `grep -cE '^\s*describe\('` → `3`, none nested

**2. The module deletion-line criterion passes more strictly than written**

- **Found during:** Task 1
- **Issue:** the criterion expects `git diff HEAD -- workflow-script.ts | grep -c '^-[^-]'` to print at most `2` — the two replaced docblock citation lines. It prints `0`.
- **Fix:** none needed. The module does not exist on `HEAD` at all, so the checkout produces a purely additive diff and the citation rewrite leaves no deletion line behind. `0` satisfies the criterion's guarantee — that no line of executable code was removed — more completely than `2` could. The same effect was recorded in 110-02.
- **Verification:** `git diff --diff-filter=D --name-only HEAD~1 HEAD` → 0 files; the commit reports `1457 insertions(+), 1 deletion(-)`, the single deletion being the citation line replaced by two

**3. Two coverage cases beyond the plan's named one**

- **Found during:** Task 2, Step 4
- **Issue:** the plan named one added case (the numeric `meta` key) and cited a measured target of `BR 106/106 · LN 683/683`. After the restructure the measured pair was `BR 101/103 · LN 680/684`, with two arms uncovered rather than one, and neither was the arm the numeric-key case closes.
- **Fix:** read the two reported line ranges, found the arms (`metaPropertyKey`'s computed-key early return; `stemFallbackVerdict`'s refusal arm), and added one public-behaviour case for each. This is the procedure Step 4 prescribes for exactly this situation.
- **Files modified:** `tests/domain/workflow-script.test.ts`
- **Verification:** `branches 105/105, functions 32/32, lines 684/684`
- **Committed in:** `d3c5be6f`

---

**Total deviations:** 0 auto-fixed. 2 criteria verified by intent with the correction and the reason recorded; 1 planned-but-underspecified coverage step completed per its own written fallback.
**Impact on plan:** none. No production behavior differs from what the plan specified, and the coverage target the plan set was met exactly.

## Issues Encountered

- **`pre-commit run --files` and `--all-files` both report the documented structural `TruffleHog` failure** (`failed to read index file: ... .git/index: not a directory`, because `.git` is a file in this worktree). Handled per `CLAUDE.md` §Git: a filesystem-mode scan over the four committed paths reported `verified_secrets: 0, unverified_secrets: 0` and exit 0, and the commit carried `SKIP=trufflehog` and nothing else. No `--no-verify`, no `--amend`.
- **`pre-commit run --all-files` was run twice, consecutively.** Both runs left zero files modified across `extensions/`, `tests/`, `package.json` and `package-lock.json`; every hook except the structural TruffleHog one passed on both. `prettier --write` had been run on the test file before staging (it rewrapped one arrow-function body), so no post-commit drift appeared.
- **ESLint needed its own budget.** The type-aware pass over `extensions tests scripts eslint.config.js` was run separately in the background rather than inside the `npm run check` chain, and returned exit 0 with no output. All other chain members were run individually and green.

## Standing note: SonarCloud duplication on `domain/name.ts`

Carried forward from 110-02 unchanged, and re-confirmed here. `npm run fallow` exits 0, but `fallow dupes` reports a clone family in `domain/name.ts` — "2 groups, 70 lines" — that is absent on the pre-phase tree, taking the repository from 840 to 928 duplicated lines. `sonar-project.properties`'s `sonar.cpd.exclusions` does not list `domain/name.ts`.

Expect a SonarCloud "Duplicated Lines" condition at pull-request time. **The remedy is an addition to `sonar.cpd.exclusions` carrying the `port/README.md` rationale, not a refactor into a shared helper** — WNAM-06's amendment explicitly declines that refactor, because sharing a helper with the command generator would pull its nested-path and empty-head rules into a caller that can never produce either shape.

## Open question: no parse size or depth cap (T-110-17)

`admitWorkflowScript` places no bound on source size or nesting depth before handing the text to acorn, so a pathologically huge or deeply nested script can exhaust parser resources. **The host engine has no such cap either**, and matching its posture is the current decision — the script is one the user already chose to install.

This is recorded as a **candidate for the admission-gate hardening phase**, not a gap in this one. Anyone revisiting it should note that a cap stricter than the engine's would refuse a script the engine accepts, and only the lax direction self-corrects across engine upgrades — the same reasoning that governs the WNAM-06 parity screens.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 110 is complete.** All three leaf modules, the workflow name generator, the collision class and its interface are on the branch, each with a mirrored owner test at complete direct coverage, and `acorn` is a declared runtime dependency.
- Phase 111 (the workflows bridge) is unblocked. `AdmittedWorkflow` and `WORKFLOW_SCRIPT_EXTENSIONS` gain their production consumers there; `fileStem` has no consumer even after Phase 111 and is justified by its own docblock as the read-only `info`-surface stem rule.
- **Phase 111 owes the `EXTENSION_VERSION` bump (A-03).** None was made in this phase, deliberately.
- Nothing in production imports `domain/workflow-script.ts` yet. `fallow` stays clean solely because the owner test imports every export by name — a Phase 111 change that drops an import will not make the module dead, but a change that *removes* an export must remove its test import in the same commit.
- **WNAM-03 is carried forward, not satisfied.** See the section above; its warning-rendering and not-installed halves belong to Phase 111.
- Carried to pull-request time, not to Phase 111: the `sonar.cpd.exclusions` addition for `domain/name.ts`.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — FOUND
- `tests/domain/workflow-script.test.ts` — FOUND
- `package.json` — `acorn: ^8.16.0` under `dependencies`, absent from `devDependencies`
- `package-lock.json` — `1 1` numstat, the measured two-line rewrite
- commit `d3c5be6f` — FOUND, carrying exactly the four intended paths and nothing else
- every task `<acceptance_criteria>` re-run (one verified by intent, recorded above); plan-level `<verification>` re-run and green: typecheck 0 errors, ESLint exit 0, `fallow` exit 0 with `dead-code: No issues found`, `format:check` clean, both corresponding-test gates pass, the direct-coverage negative control passes, 5284 unit tests and 32 integration tests pass, all five pairs at `hit === found`, both blast-radius checks `0`, no version moved, no suppression marker anywhere, and no dynamic-evaluation construct in the module

---
*Phase: 110-domain-and-platform-modules*
*Completed: 2026-09-05*
