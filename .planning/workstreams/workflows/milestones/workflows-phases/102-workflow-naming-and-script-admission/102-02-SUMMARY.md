---
phase: 102-workflow-naming-and-script-admission
plan: 02
subsystem: domain
tags: [acorn, ast, workflows, naming, determinism, node-test]

# Dependency graph
requires:
  - phase: 102-workflow-naming-and-script-admission
    provides: "plan 01's verdict union, the single-parse entry point with its comment and string/template ranges, and generatedWorkflowName"
provides:
  - "the stem-fallback arm, with the file stem derived inside the admission function"
  - "the two skipped causes split apart: no-meta and meta-not-object-literal"
  - "per-file unsafe-name refusal -- the generatedWorkflowName throw no longer escapes"
  - "the vendored DETERMINISM_BLOCKLIST and its code / comment / string match classifier"
  - "assertNoWorkflowNameCollisions over the whole verdict set, before any dedup"
affects: [103 workflow materialization, bridges/workflows, orchestrators/plugin/info]

actuals:
  tokens: 7589
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendored engine constant: a flagless module-level regex plus a per-call `new RegExp(src, \"g\")` clone -- one pattern text, one boolean use and one positional use"
    - "Match classification from the parser's own evidence (comment ranges, string/template token ranges) rather than a second hand-written scanner"
    - "Throw-to-verdict conversion at a single private seam (`generateOrRefuse`), so a shared validator's throw becomes a per-file outcome without widening the validator"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - tests/domain/workflow-script.test.ts

key-decisions:
  - "findMetaObject now returns a three-arm MetaLookup instead of `Property[] | undefined`, because WNAM-03 reports the two unreadable shapes as distinct causes and the call site cannot recover the distinction from `undefined`"
  - "generateOrRefuse returns `string | RefusedWorkflow` rather than a tagged object, keeping the `outcome` discriminant exclusive to the four verdict arms"
  - "The determinism classification carries its own reason string, built at the point of classification, so no switch over the three causes is manufactured in production code"
  - "The classification fixtures deliberately carry no string-literal meta.name; only the dedicated gate-order fixture does, so the transposition experiment isolates exactly one flipping case"

patterns-established:
  - "Gate-order pins are proven by transposition, not asserted: the pin fixture is the only one on which both arms have a claim"
  - "A per-file refusal wraps every call into a throwing shared validator; a set-level defect stays a throw"

requirements-completed: [WNAM-02, WNAM-03, WNAM-04, WNAM-05, WVAL-01, WVAL-02, WVAL-03]

coverage:
  - id: D1
    description: "A meta object literal whose name is absent or is not a string literal falls back to the file stem, with the non-literal value classified by node type and never resolved"
    requirement: "WNAM-02"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-02 meta with no name property falls back to the whole file stem"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-02 an identifier name is never resolved -- the stem names the command"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-02 a template-literal name is not a string literal -- the stem names the command"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-02 a computed key cannot supply the name"
        status: pass
    human_judgment: false
  - id: D2
    description: "No meta and a meta that is not an object literal are skipped under distinct causes, neither reaching the stem fallback"
    requirement: "WNAM-03"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-03 a script with no meta declaration is skipped"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-03 meta built by a factory call is skipped, not stem-named"
        status: pass
    human_judgment: false
  - id: D3
    description: "An unparseable script is refused with nothing scavenged out of its source, and the parse check settles a script that is both unparseable and blocklist-hit"
    requirement: "WNAM-04"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-04 an unparseable script is refused with nothing scavenged out of it"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-04 a source that is both unparseable and blocklist-hit is refused as unparseable"
        status: pass
    human_judgment: false
  - id: D4
    description: "An individually unsafe name -- separator, dot, untrimmed, over-length, or an unsafe file stem on the fallback path -- is a per-file refusal and never a throw out of the admission function"
    requirement: "WNAM-06"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-06 a meta.name carrying a path separator is a per-file refusal"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-06 a joined name longer than 128 characters is a per-file refusal"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-06 an unsafe file stem on the stem-fallback path is a per-file refusal"
        status: pass
    human_judgment: false
  - id: D5
    description: "A script the engine's raw-text determinism blocklist matches is refused from source text alone, with the gate ahead of the meta walk so a usable meta.name cannot rescue it"
    requirement: "WVAL-01"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-01 a script whose source matches the engine blocklist is refused from its text alone"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-01 a usable meta.name does not rescue a script that calls a nondeterministic API"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-01 two scans in sequence both refuse -- a retained match position would make the second miss"
        status: pass
    human_judgment: false
  - id: D6
    description: "One refused script among four leaves every other script's verdict byte-identical, and the batch call throws on none of these arms"
    requirement: "WVAL-02"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-02 one blocklist-hit script among four leaves the other three verdicts untouched"
        status: pass
    human_judgment: false
  - id: D7
    description: "A match in code, in a comment, and in a string or template literal produce three distinct causes and reasons, with the comment reason carrying the reword remedy"
    requirement: "WVAL-03"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-03 a match confined to a comment is refused with the reword remedy"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-03 a match confined to a string literal is classified as non-executable"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-03 a template-literal match is non-executable even when it opens the template"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WVAL-03 the code reason and the comment reason are distinct sentences"
        status: pass
    human_judgment: false
  - id: D8
    description: "Two scripts resolving to one generated name throw a plain Error naming the generated name and both file names, over the whole set with nothing deduped first"
    requirement: "WNAM-05"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-05 two scripts resolving to one name throw, naming the name and both files"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-05 the RN-1 elision axis collides too, on names no file name reveals"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-05 a name claimed three times is reported whole -- nothing is deduped first"
        status: pass
      - kind: unit
        ref: "tests/domain/workflow-script.test.ts#WNAM-05 skipped and refused verdicts carry no generated name and are ignored"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-15
status: complete
---

# Phase 102 Plan 02: Workflow naming and script admission Summary

**Every non-admitted shape now has its own verdict: an unreadable name is skipped, a broken or nondeterministic script is refused by file with the real reason, and two scripts claiming one command name fail loudly instead of one silently winning.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-15T11:18:00Z
- **Completed:** 2026-08-15T11:53:00Z
- **Tasks:** 3 executed (each RED then GREEN; no refactor commit was needed)
- **Files modified:** 2

## Accomplishments

- `admitWorkflowScript` answers every shape it can meet. The stem is derived inside the function from the passed file name, so `drafter.workflow.js` with no readable name falls back to `paperjury:drafter.workflow` and the derivation lives in one place.
- A non-literal `name` is decided by its node type alone. Each fallback row asserts the identifier's or template's own text appears nowhere in the generated name, which is the assertion that separates "classified" from "evaluated".
- The `generatedWorkflowName` throw no longer escapes. Both generation sites route through one `generateOrRefuse` seam, so `"a/b"`, `"."`, `"audit "`, an over-128 joined form, and an unsafe file stem each cost one file. The five rows wrap the CALL in `assert.doesNotThrow`, not just the returned verdict.
- The engine's determinism blocklist is vendored flagless, with match positions coming from a per-call `g` clone of the same pattern text. Two sequential scans both refuse, which a retained `lastIndex` would break.
- A blocklist match is classified against acorn's own comment and token ranges into three distinct causes. The comment case carries the reword remedy, because the engine screens raw text and its own message names a rule the script does not violate.
- The collision assertion takes the full verdict array and narrows internally, so a caller cannot dedup the clash away first. The RN-1 elision axis is covered: `foo` and `acme-foo` in plugin `acme` both generate `acme:foo`, and neither file name reveals it.

## Task Commits

1. **Task 1: the stem-fallback, skipped and refused arms** — `ddbe0360` (test, RED) then `6b93bef5` (feat, GREEN)
2. **Task 2: the engine's text-level pre-validation** — `1fe29593` (test, RED) then `090976c6` (feat, GREEN)
3. **Task 3: two scripts, one name** — `a0e96365` (test, RED) then `1c919492` (feat, GREEN)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — the three remaining verdict arms, `fileStem`, the `generateOrRefuse` throw-to-verdict seam, `DETERMINISM_BLOCKLIST` with `findDeterminismViolation` and its three reason builders, `containsIndex`, and `assertNoWorkflowNameCollisions`. The union still has exactly four arms and there is still exactly one `parse()` call.
- `tests/domain/workflow-script.test.ts` — 5 tests before this plan, 36 after. Fixtures stay inline template literals; no on-disk `.js` fixture exists anywhere under `tests/`.

## Decisions Made

- **`findMetaObject` returns a three-arm lookup, not `Property[] | undefined`.** WNAM-03 reports "no `meta`" and "`meta` is not an object literal" as distinct causes, and the call site cannot recover that distinction from a collapsed `undefined`. Splitting at the helper rather than at the call site keeps the walk the only place that knows the AST shape.
- **`generateOrRefuse` returns `string | RefusedWorkflow`.** A tagged `{ outcome: "generated" }` result would have put a fifth `readonly outcome: "` in the file and blurred the discriminant that consumers narrow on. `typeof generated !== "string"` is the whole narrowing.
- **The determinism finding carries its own reason.** Building the reason at the point of classification avoids a second switch over the three causes in production code, which the plan's scope note asks to avoid manufacturing.
- **The classification fixtures carry no string-literal `meta.name`.** Only `GATE_ORDER_SOURCE` does. Without that separation the transposition experiment would have flipped eight cases instead of one and proved nothing about which fixture pins the order.

## Deviations from Plan

None — plan executed as written.

Two points where the plan left shape to judgment, recorded so the next plan is not surprised:

- The plan's acceptance criterion greps for at least four `doesNotThrow` occurrences. A table-driven loop covers five cases but greps as one line, so the five WNAM-06 rows are written as individual tests over a shared `assertRefusedUnsafeName` helper. The helper keeps the assertion block single-sourced; `sonarjs/no-identical-functions` did not fire.
- Both deferrals plan `102-01` recorded are closed here: the file stem is now derived (inside `stemFallbackVerdict`, its first consumer), and name safety is enforced as a per-file refusal at both generation sites.

## Issues Encountered

- **The gate-order transposition check, run for real.** With the blocklist moved behind the `meta` walk, exactly one test flipped — `WVAL-01 a usable meta.name does not rescue a script that calls a nondeterministic API`, failing with `'named' !== 'refused'` — and the other 28 stayed green. The correct order was restored with `git checkout --` on that one file and the suite returned to 29/29. Reaching that result required first rewriting the classification fixtures to drop their `meta.name`: as originally written, every determinism fixture carried a usable name, so the transposition flipped eight cases at once and no single fixture was pinning the order.
- The `trufflehog` pre-commit hook failed on all six commits with `failed to read index file: ... .git/index: not a directory` — the documented structural limitation of the git-mode scan inside a linked worktree, not a finding. Every commit was preceded by a filesystem-mode scan over its exact paths (`--results=verified,unknown --fail`), each clean at `verified_secrets: 0, unverified_secrets: 0`, and committed with `SKIP=trufflehog` and no other hook skipped.
- Prettier reflowed both files after most writes; formatting was applied and re-checked before each commit.

## Known Stubs

None. The provisional `skipped` return plan `102-01` recorded in `.planning/WINDOWS.md` (entry 4) is closed and the ledger entry is marked `fixed`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The decision layer is complete. `admitWorkflowScript` returns one of four arms for any `(pluginName, fileName, source)` and throws on none of them; `assertNoWorkflowNameCollisions` is the only throw, and it is a defect of the set.
- These verdicts still have no consumer. The `bridges/workflows/` discover and stage path routes the refusal and skip reasons into the bridge `warnings[]` channel, and the exhaustive `assertNever` switch over this union lands there.
- The `info` command's `workflows:` line still renders file stems; the swap to the admitted name belongs to the materialization phase, which already reads the sources.
- The admit-versus-run divergence stands unchanged: six shapes admitted here are shapes the engine refuses at invocation, carried as a WDOC-01 documentation deliverable.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — FOUND
- `tests/domain/workflow-script.test.ts` — FOUND
- Commits `ddbe0360`, `6b93bef5`, `1fe29593`, `090976c6`, `a0e96365`, `1c919492` — all FOUND in `git log`
- `node --test tests/domain/workflow-script.test.ts` — 36/36 pass
- `npm run check` — exit 0 (typecheck, lint, format:check, unit, integration)

---
*Phase: 102-workflow-naming-and-script-admission*
*Completed: 2026-08-15*
