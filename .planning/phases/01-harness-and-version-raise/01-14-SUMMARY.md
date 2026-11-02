---
phase: 01-harness-and-version-raise
plan: 14
subsystem: mcp
tags: [pi-mcp-adapter, mcp-variables, env-expansion, oauth, conformance-property]

requires:
  - phase: 01-harness-and-version-raise (01-01)
    provides: pi-mcp-adapter 7.0.0 peer cache, the widened TRIGGER escape, and the literal-path conformance property
  - phase: 01-harness-and-version-raise (01-15)
    provides: docs that name pi-mcp-adapter 7.0.0
provides:
  - A ref Segment with an optional fallback, written as ${NAME:-default} for pi-mcp-adapter to expand at connect time (D-CF1-13)
  - Install-time resolution kept for a default holding $env: or {env: text, a deny-listed name, and a base-URL name in url or headers
  - Serializer guards for a reference with a default, including two guards a plain reference does not need
  - The D-08-04 OAuth decision for a header that holds a reference with a default
  - Conformance proof (unset-at-connect variant, marker-default alphabet, default-beside-reference run) with 0 mismatches
  - MCP and environment docs that describe connect-time expansion and its exceptions
affects: [01-06 (cucumber scenario for connect-time ${NAME:-default}), 01-09 (CHANGELOG line)]

actuals:
  tokens: 16551   # chars/4 over the realized diff (66,203 chars, 12 files)
  tasks: 3
  commits: 3
plan_head_before: 9a815c57e5be80e7c6c7ca4df70dbebe7f7bb60c
plan_head_after: 7567b725ea293dfa474a6aa4a79f75dfff5c3ffd

tech-stack:
  added: []
  patterns:
    - "A reference's guard reads its default as a possible connect-time value: the default is the preceding text for the next reference, and a default that could complete a marker gets the split token after a reference"
    - "The OAuth clean check reads the written value as the adapter scans it, plus an install-time reading in which a set ${NAME:-x} is ${NAME} and an unset one is its default text"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - test/domain/claude-mcp-variables.test.ts
    - test/bridges/mcp/adapter-escape.test.ts
    - test/bridges/mcp/adapter-entry.test.ts
    - test/bridges/mcp/expansion-cases.ts
    - test/bridges/mcp/stage.test.ts
    - test/integration/adapter-expansion-conformance.test.ts
    - test/integration/mcp-variable-expansion.test.ts
    - docs/mcp-compatibility.md
    - docs/env-vars.md

key-decisions:
  - "D-CF1-13 precondition held on pi-mcp-adapter 7.0.0: unset gives the default, empty gives \"\", set gives the value, so marker-free defaults are delegated"
  - "A default holding $env: or {env: keeps install-time resolution; without that check the property reports 344 mismatches (for example ${B:-${B:-$env:K} leaks K)"
  - "A base-URL name (CREDENTIAL_BASE_URL_NAMES) in url or headers keeps install-time resolution, because its deny decision reads the value"
  - "OAuth clean rule: a set ${NAME:-x} reads as ${NAME} and an unset one as its default text, which keeps every decision the old written form produced"
  - "Two extra serializer guards: before a reference after a reference when its default could complete a marker, and before a reference after a default that ends in a partial trigger"

patterns-established:
  - "A connect-time default is a possible runtime tail and head: guard it on both sides like a reference's value"

requirements-completed: [VER-04, VER-05]

coverage:
  - id: D1
    description: "pi-mcp-adapter 7.0.0 expands ${NAME:-default} as Claude does for unset, empty, and set values (the D-CF1-13 precondition)"
    requirement: VER-05
    verification:
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts#D-CF1-13: pi-mcp-adapter expands ${NAME:-default} as Claude does for an unset variable (and the empty and set cases)"
        status: pass
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts#AVAR-03: pi-mcp-adapter outputs Claude's value for every short adversarial value (3,017,082 checks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A marker-free ${NAME:-default} on a name that is not deny-listed is written as ${NAME:-default}; a variable set after install takes effect at connect"
    requirement: VER-05
    verification:
      - kind: unit
        ref: "test/domain/claude-mcp-variables.test.ts#D-CF1-13: a variable unset at install keeps its default for the adapter"
        status: pass
      - kind: unit
        ref: "test/bridges/mcp/adapter-escape.test.ts#D-CF1-13: writes a reference with a default as ${NAME:-default}"
        status: pass
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts#AVAR-03: D-CF1-13: args ${VAR:-default} takes a variable set after install comes out of pi-mcp-adapter as Claude Code's value"
        status: pass
    human_judgment: false
  - id: D3
    description: "Defaults holding $env:/{env:, deny-listed names, and remote base-URL names keep install-time resolution and never leak"
    requirement: VER-05
    verification:
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts#D-CF1-13: pi-mcp-adapter outputs Claude's value for every short marker-default value (1,062,930 checks)"
        status: pass
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts#AVAR-05: no deny-listed credential reaches pi-mcp-adapter's url or headers output"
        status: pass
      - kind: unit
        ref: "test/domain/claude-mcp-variables.test.ts#D-CF1-13: a remote unset base-URL name with a default becomes the default text"
        status: pass
    human_judgment: false
  - id: D4
    description: "The serializer guards a delegated reference like a plain one, plus the default-beside-reference cases"
    requirement: VER-04
    verification:
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts#D-CF1-13: a default left to the adapter cannot form a marker with a reference's value (11,096 checks)"
        status: pass
      - kind: unit
        ref: "test/bridges/mcp/adapter-escape.test.ts#D-CF1-13: guards a default that could complete a marker begun by the reference before it"
        status: pass
    human_judgment: false
  - id: D5
    description: "The D-08-04 OAuth decision for a header with a reference with a default"
    verification:
      - kind: unit
        ref: "test/bridges/mcp/adapter-entry.test.ts#D-08-04: a reference with a default and its variable set to empty drops auth (and the five sibling rows)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/mcp-compatibility.md and docs/env-vars.md describe connect-time expansion and its install-time exceptions"
    verification:
      - kind: other
        ref: "grep -c 'D-CF1-13' docs/mcp-compatibility.md (5); grep -c 'If `NAME` is not set, the install writes the default text' docs/mcp-compatibility.md (0); pre-commit on both files"
        status: pass
    human_judgment: true
    rationale: "Whether the prose reads clearly to a user is a reading judgment no test asserts"

duration: 51min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 14: Connect-time `${NAME:-default}` Summary

**pi-mcp-adapter 7.0.0 now expands a plugin MCP `${NAME:-default}` at connect time, as Claude Code does, except where the adapter's second `$env:`/`{env:` pass or a value-based deny decision would leak. Those defaults keep install-time resolution.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-11-01T02:54:46Z
- **Completed:** 2026-11-01T03:46:06Z
- **Tasks:** 3
- **Files modified:** 12

## Precondition result (D-CF1-13)

The precondition held on pi-mcp-adapter 7.0.0, for all three named cases:

| Case | `interpolateEnvVars("${PI_CM_LEVEL:-info}", env)` | Claude Code | Same |
| --- | --- | --- | --- |
| unset (`{}`) | `info` | `info` | yes |
| empty (`PI_CM_LEVEL=""`) | `""` | `""` | yes |
| set (`PI_CM_LEVEL="warn"`) | `warn` | `warn` | yes |

The extended property, with an unset-at-connect variant that models Claude's value as the runtime value when set and the default when unset, gives these results:

- Before the domain change (baseline): 3,017,082 checks, 0 mismatches.
- After the change: 3,017,082 checks, 0 mismatches.
- After the change with the marker check disabled (a probe): 344 mismatches. The first one is `${B:-${B:-$env:x}`, where the adapter gave `${B:-` and Claude gives `${B:-$env:x`.

## Written shape for plan 01-06

A delegated reference is written into the `mcp-adapter.json` entry as **`${NAME:-default}`, verbatim**. The default text is written as the same JavaScript code units it was read as, with no escaping inside the braces. For example, args `"${PI_CM_LEVEL:-info}"` is written as `"${PI_CM_LEVEL:-info}"`. A header `"${PI_CM_TEAM:-acme}"` is written as `"${PI_CM_TEAM:-acme}"`. The split token `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` appears beside it only in these cases:

- In front of it, when the text before it ends in a partial trigger (`$`, `{`, `$e`, `$en`, `$env`, `{e`, `{en`, `{env`).
- In front of it, when it follows another reference and its default starts with a marker completion (`[\w}]` or `:\w`).
- In front of it, when it follows a reference whose default ends in a partial trigger.
- After it, in front of the following literal text, when that text starts with a marker completion.

So a plain whole-value `${NAME:-default}` with a word-free start, like `${PI_CM_LEVEL:-info}`, is written unchanged.

## Install-time exceptions kept under D-CF1-13

1. **A default that holds `$env:` or `{env:` text**, such as `${A:-$env:HOME}` or `${A:-{env:SECRET}`. The adapter runs its `$env:` and `{env:` passes over the default that its first pass inserted, which Claude never does. The split token holds `}`, so it cannot go inside a default. When the variable is unset at install, the default is written as escaped literal text. When it is set, the value is written as plain `${NAME}`. This is the existing install-time rule. Residual: a variable set after install does not take effect until a reinstall.
2. **A deny-listed name (AVAR-05).** The deny branch runs first and is unchanged. A remote field writes `""`. A plain field writes `""` when the variable is set, and the default text or the literal `${NAME}` when it is not.
3. **A base-URL name (`CREDENTIAL_BASE_URL_NAMES`, such as `ANTHROPIC_BASE_URL`) in `url` or `headers`.** Its deny decision reads the value. Delegation would let a credential-bearing value that is set after install reach the adapter unchecked. In a plain field, the name is delegated, because the plain field does not deny it.

## CHANGELOG line for plan 01-09

- A plugin MCP setting `${NAME:-default}` now takes a variable you set after install, as in Claude Code, without a reinstall.

## Accomplishments

- `Segment`'s ref arm carries an optional `fallback`. `segmentFor` returns `{ kind: "ref", name, fallback }` for every default that the hybrid rule allows, whether the variable is set or not. Such a reference is never reported missing.
- `serializeSegments` writes `${NAME:-fallback}` and applies the plain-reference guards. It also applies two guards that only a default needs. The first guards a default that could complete a marker begun by the value of the reference before it. The second guards a reference that follows a default ending in a partial trigger.
- `isCleanHeaderValue` (D-08-04) keeps every OAuth decision the old written form produced. The four behavior rows from the plan pass, and so do a blank default and `team ${PI_CM_TEAM:-}`.
- The conformance file proves the change. It holds the precondition cases, the unset-at-connect variant (3,017,082 checks), the marker-default alphabet (1,062,930 checks), and the default-beside-reference run (11,096 checks). All report 0 mismatches.
- The shared expansion rows, the stage test, and the install integration test assert the delegated form. The VER-05 rows check empty, spaces, and non-ASCII defaults, and the variable-set-after-install row checks a later value.

## Task Commits

1. **Task 1: Prove the precondition and delegate a marker-free default end to end**: `c04a32c` (feat)
2. **Task 2: Keep install-time resolution where delegation would leak, and keep the OAuth decision**: `67ecf59` (fix)
3. **Task 3: Describe connect-time expansion in the MCP and environment docs**: `7567b72` (docs)

## TDD Gate Compliance

I checked RED for each code task before writing GREEN, but I did not commit RED separately. The commit hook runs `check:commit`, which runs the staged pairs' tests and typecheck. A commit with failing tests cannot pass it, and `--no-verify` is forbidden. Plan 01-01 used the same approach. `workflow.tdd_mode` is false, so this gate is advisory.

- **Task 1 RED:** I ran `node --test --test-reporter=tap test/domain/claude-mcp-variables.test.ts`. It exited 1, with 9 of 64 tests failing. The target was `D-CF1-13: a variable unset at install keeps its default for the adapter`. The classifier returned `RED_EVIDENCE_OK` (`target_test_failed`). In the semantic check, the target ran and failed on `deepStrictEqual`: it got `{kind:"text",text:"info"}` but expected `{kind:"ref",name:"PI_CM_LEVEL",fallback:"info"}`. That is the planned behavior, and there was no load or syntax fault. The escape rows failed the same way, writing `${NAME}` without the default.
- **Task 1 GREEN:** after the domain and serializer change, the three verify files pass 187/187 (192/192 after the new shared rows).
- **Task 2 RED:** I ran `node --test --test-reporter=tap test/bridges/mcp/adapter-entry.test.ts`. It exited 1, with 3 of 56 tests failing. The target was `D-08-04: a reference with a default and its variable set to empty drops auth`. The classifier returned `RED_EVIDENCE_OK`. In the semantic check, the entry kept `auth: "oauth"` where the test expected it gone. The two base-URL domain rows and the base-URL shared row also failed on their assertions. The marker-default alphabet and the default-beside-reference run already passed on the Task 1 serializer. They prove behavior, and the Task 1 code was in place.
- **Task 2 GREEN:** 327/327 across the domain, entry, substitute, escape, and conformance files.
- No REFACTOR commits.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts`: the `fallback` field, `holdsAdapterMarker`, `leavesDefaultToAdapter`, the hybrid branch in `segmentFor`, and the header for D-CF1-13.
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts`: `needsReferenceGuard`, `writtenReference`, and the default treated as preceding text.
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`: `DEFAULTED_REFERENCE`, `isSet`, `installTimeHeaderValue`, `namesSetForAdapter`, and the extended `isCleanHeaderValue`.
- `test/domain/claude-mcp-variables.test.ts`: the delegation, VER-05, marker, base-URL, and deny-list rows.
- `test/bridges/mcp/adapter-escape.test.ts`: the rows for writing a reference with a default and for each guard.
- `test/bridges/mcp/adapter-entry.test.ts`: six D-08-04 rows.
- `test/bridges/mcp/expansion-cases.ts`: the changed `:-` rows plus new VER-05, set-after-install, marker, and base-URL rows.
- `test/bridges/mcp/stage.test.ts`, `test/integration/mcp-variable-expansion.test.ts`: the written `--level` value is now `${PI_CM_AVAR_LEVEL:-info}`.
- `test/integration/adapter-expansion-conformance.test.ts`: the unset-at-connect variant, the precondition cases, the marker-default alphabet, and the default-beside-reference run.
- `docs/mcp-compatibility.md`, `docs/env-vars.md`: the connect-time rule and its exceptions.

## Decisions Made

- **The OAuth clean rule keeps the decisions the old written form produced.** The plan's per-reference rule would drop `auth` for `team ${TEAM:-}` with `TEAM` unset. The old written form `team ` kept `auth`, and the adapter accepts the new form too. So in the clean check, a set `${NAME:-x}` reads as `${NAME}` and an unset one reads as its default text. The check also scans the written value as the adapter does, which catches a `${X}` inside a default.
- **Base-URL names in remote fields stay install-time.** This reads "deny-listed" in the plan's prohibition as covering the value-conditional remote deny list. See exception 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Moved the marker check into Task 1**
- **Found during:** Task 1. The tracer property must pass before expansion.
- **Issue:** Without the `$env:`/`{env:` check, the third existing alphabet already shows a leak: 344 mismatches.
- **Fix:** I put `holdsAdapterMarker` in Task 1's delegation branch. Task 2 added the dedicated alphabet and the remaining exceptions.
- **Files modified:** `domain/claude-mcp-variables.ts`
- **Verification:** The property reports 0 mismatches.
- **Committed in:** `c04a32c`

**2. [Rule 3 - Blocking] Moved the shared-row and assertion updates into Task 1, and edited `test/bridges/mcp/stage.test.ts`**
- **Found during:** Task 1. The full module run showed 7 failures, 6 shared rows and 1 stage case.
- **Issue:** The new written form breaks those assertions. Leaving them for Task 2 would commit a red tree. `stage.test.ts` is not in `files_modified`, but it asserts the written `--level` value.
- **Fix:** I updated the rows and the two integration and stage assertions in Task 1.
- **Files modified:** `test/bridges/mcp/expansion-cases.ts`, `test/bridges/mcp/stage.test.ts`, `test/integration/mcp-variable-expansion.test.ts`
- **Verification:** `npm run test:modules` (under the non-DAC wrapper) passed except for the cases the change targets. After the fix, the affected files pass.
- **Committed in:** `c04a32c`

**3. [Rule 2 - Missing critical] Added two serializer guards beyond the plan's "same guards as a plain reference"**
- **Found during:** Task 1 design review.
- **Issue:** A default is plugin-controlled text that sits beside the value of a neighboring reference. In `${R}${A:-v:K}` with R ending in `$en`, and in `${A:-p{en}${R}` with R starting `v:K}`, the two can form a marker. Before delegation, that default was text and got the text guards.
- **Fix:** `needsReferenceGuard` and the default as `precedingText`.
- **Files modified:** `bridges/mcp/adapter-escape.ts`
- **Verification:** The escape unit rows and the 11,096-check default-beside-reference run pass with 0 mismatches.
- **Committed in:** `c04a32c` (guards), `67ecf59` (property)

**4. [Rule 2 - Missing critical] Base-URL names in url or headers keep install-time resolution**
- **Found during:** Task 2.
- **Issue:** Delegating `${ANTHROPIC_BASE_URL:-x}` in a remote field would send a credential-bearing value that is set after install. Claude would withhold it.
- **Fix:** `leavesDefaultToAdapter`.
- **Committed in:** `67ecf59`

---

**Total deviations:** 4 auto-fixed (3 Rule 2, 1 Rule 3).
**Impact on plan:** All work stayed inside the plan's goal. The task boundaries moved so that each commit stays green and the tracer gate passes. One file outside `files_modified` (`test/bridges/mcp/stage.test.ts`) got a one-line assertion change.

## Issues Encountered

- Each commit that stages `test/bridges/mcp/expansion-cases.ts` runs every pair's direct coverage in the hook, about 30 minutes on the shared sandbox. Both code commits did.
- The root sandbox needs the non-DAC script-shell wrapper. Under plain root, 2 `stage.test.ts` permission-injection cases fail, as they do on any tree.

## Verification

- `node --test test/domain/claude-mcp-variables.test.ts test/bridges/mcp/adapter-escape.test.ts test/integration/adapter-expansion-conformance.test.ts`: 192/192 after Task 1 and after the tracer gate re-run.
- `node --test test/domain/claude-mcp-variables.test.ts test/bridges/mcp/adapter-entry.test.ts test/bridges/mcp/substitute.test.ts test/bridges/mcp/adapter-escape.test.ts test/integration/adapter-expansion-conformance.test.ts`: 327/327.
- `npm run test:integration` passed (exit 0, under the wrapper).
- `npm run test:coverage:direct --` returned exit 0 (100%) for `claude-mcp-variables.ts`, `adapter-escape.ts`, `adapter-entry.ts`, and `substitute.ts`.
- `npm run fallow` and ESLint on the touched files passed. The hook's `check:static` and all-pairs coverage passed on `c04a32c` and `67ecf59`.
- Task 3: `grep -c 'D-CF1-13' docs/mcp-compatibility.md` gives 5. The old sentence's grep gives 0. Pre-commit is clean on both docs.

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 01-06 can write the cucumber scenario against the written shape above: install with `NAME` unset, set it, and the next connect uses the value.
- Plan 01-09 has its CHANGELOG line.

## Dubious Choices

1. **Task boundaries moved** (deviations 1 and 2): the marker check, the shared rows, the stage and integration assertion updates, and all serializer guards landed in Task 1 rather than Task 2, so that each commit is green and the tracer property passes.
2. **Two extra serializer guards** (deviation 3), beyond the plan's "same guards as a plain reference".
3. **Base-URL names in remote fields stay install-time** (deviation 4). This reads "deny-listed" as covering the value-conditional list.
4. **OAuth rule keeps the old decisions** rather than following the plan's literal per-reference wording. The two differ only for mixed text such as `team ${TEAM:-}`, which keeps `auth` here, as before and as the adapter accepts.
5. **No separate RED commits.** The hook runs the failing tests, so I recorded RED evidence here.
6. **The unset-at-connect variant leaves every reference unset**, including plain ones. A plain reference that is unset at connect is modeled as `""`, the adapter's output and the residual already documented for a missing variable, not as Claude's literal `${NAME}`.
7. **The old shared row "headers default text and adjacent literal text are escaped as one run"** (`${PI_CM_A:-{}env:PI_CM_SECRET}`) now tests the delegated form with a guard, under a new title. A new `{env:`-default row keeps the merged-run case under test.
8. **`${CLAUDE_PROJECT_DIR:-x}` is now delegated at both scopes.** At user scope, the adapter reads the `CLAUDE_PROJECT_DIR` that Pi's process exports at connect, or the default when the session export skipped it.
9. **One file outside `files_modified`** (`test/bridges/mcp/stage.test.ts`) got a one-line assertion change.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-26 is mitigated by the marker check and the marker-default alphabet. T-01-27 is mitigated because the deny branch runs first and the base-URL exception exists. T-01-28 is mitigated by the D-08-04 rows.

## Self-Check: PASSED

- All 12 modified files exist, and commits `c04a32c`, `67ecf59`, and `7567b72` are ancestors of HEAD.
- `commits: 3` was measured with `git rev-list --count 9a815c5..HEAD`.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
