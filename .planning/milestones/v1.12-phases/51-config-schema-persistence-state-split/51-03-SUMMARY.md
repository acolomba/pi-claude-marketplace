---
phase: 51-config-schema-persistence-state-split
plan: 03
subsystem: architecture-test
tags: [architecture-test, write-seam-ownership, NFR-10, v1.12, SPLIT-02]
requirements: [SPLIT-02]
dependency_graph:
  requires:
    - 51-01 (config-io.ts::saveConfig — the SOLE permitted config-file writer)
    - 51-02 (state-io.ts::saveState + migrate.ts::persistMigratedState — the SOLE permitted state.json writers)
    - tests/architecture/no-shell-out.test.ts (template for the walker shape + 'exactly N' sibling assertion)
  provides:
    - tests/architecture/config-state-write-seams.test.ts (NEW; runs as part of npm run check via the existing tests/architecture glob)
    - ALLOWED_STATE_JSON_WRITERS / ALLOWED_CONFIG_JSON_WRITERS ReadonlySet constants
    - Three FORBIDDEN_*_PATTERN regexes pinning the protected-path call patterns
  affects:
    - Phases 52-56 (any future writer of claude-plugins.json or state.json must add itself to the matching allow-list AND update the 'exactly N' sibling assertion in the same commit)
    - Any future milestone (the structural seam survives across phases)
tech-stack:
  added: []
  patterns:
    - "Recursive .ts walker + regex-on-source-text offender detection (mirror of no-shell-out.test.ts walker)"
    - "Path-name-specific forbidden patterns with optional `<identifier>.` prefix (`(?:\\w+\\.)?`) — catches both member-access (`loc.stateJsonPath`) and bare-local (`stateJsonPath`) callsite shapes without coarse-walk false positives on other JSON writers"
    - "'Exactly N' sibling assertion — literal-array deepEqual against the sorted allow-list forces silent widening to fail CI"
    - "Walker-regression self-test — forbidden patterns asserted against synthetic offender strings AND benign callsites in the same test file, so a regex bug cannot silently make the walker GREEN against any codebase"
key-files:
  created:
    - tests/architecture/config-state-write-seams.test.ts
  modified: []
decisions:
  - "Use path-name-specific regex patterns (Rule 1 deviation from the plan's locked COARSE-WALK formulation): scope offender detection to the three protected file names (stateJsonPath / configJsonPath / configLocalJsonPath) instead of the entire `atomicWriteJson(` callsite vocabulary."
  - "Optional `(?:\\w+\\.)?` prefix covers both shapes: `loc.stateJsonPath` (member access) and `stateJsonPath` (bare local). The current legitimate writers use both — state-io.ts::saveState binds the target into a bare local `stateJsonPath`, and the matching is on the local name regardless of the storage class."
  - "Include an in-file walker-regression test: assert each forbidden pattern matches a synthetic offender string AND does NOT match a synthetic benign callsite. This is the manual-positive evidence required by acceptance criterion #7, captured as a permanent test artefact instead of a one-off temporary edit."
  - "Accept the alias-evasion limitation (someone copying `loc.configJsonPath` into a differently-named local before passing to atomicWriteJson) — documented in the test's header docstring; the 'exactly N' sibling assertions are the second-line defense via code review."
requirements_completed: [SPLIT-02]
metrics:
  duration_minutes: ~25
  completed_date: "2026-06-10"
  tests_added: 5
  files_created: 1
  files_modified: 0
---

# Phase 51 Plan 03: SPLIT-02 Write-Seam Ownership Architecture Test Summary

One-liner: Locked SPLIT-02 at the architecture level — a new
`tests/architecture/config-state-write-seams.test.ts` refuses any
`atomicWriteJson(...)` callsite that targets `claude-plugins.json`,
`claude-plugins.local.json`, or `state.json` outside the named allow-lists
(`config-io.ts::saveConfig` for the config files; `state-io.ts::saveState` +
`migrate.ts::persistMigratedState` for `state.json`), with 'exactly N' sibling
assertions so any future widener must update both the allow-list and the
literal expectation in the same commit.

## What Shipped

### `tests/architecture/config-state-write-seams.test.ts` (NEW, 222 lines)

Five `test(...)` declarations covering the SPLIT-02 contract:

1. **`SPLIT-02: only saveConfig writes claude-plugins.json /
   claude-plugins.local.json`** — recursively walks every `.ts` file under
   `extensions/pi-claude-marketplace/`; for each file outside
   `ALLOWED_CONFIG_JSON_WRITERS`, checks the source text against both
   `FORBIDDEN_CONFIG_JSON_PATTERN` and `FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN`.
   Currently GREEN: the only callsite that matches either pattern is in
   `config-io.ts::saveConfig` itself (allow-listed).
2. **`SPLIT-02: only saveState / persistMigratedState write state.json`** —
   analogous walk; for each file outside `ALLOWED_STATE_JSON_WRITERS`, checks
   the source text against `FORBIDDEN_STATE_JSON_PATTERN`. Currently GREEN:
   the only callsites that match are in `state-io.ts::saveState` and
   `migrate.ts::persistMigratedState` (both allow-listed).
3. **`SPLIT-02 whitelist: exactly the named writers may write state.json`** —
   `assert.deepEqual([...ALLOWED_STATE_JSON_WRITERS].sort(), [...])` against
   a literal two-entry array.
4. **`SPLIT-02 whitelist: exactly one file may write claude-plugins.json
   files`** — `assert.deepEqual([...ALLOWED_CONFIG_JSON_WRITERS].sort(),
   [...])` against a literal one-entry array.
5. **`SPLIT-02 walker: forbidden patterns catch a synthetic offender`** — the
   manual-positive evidence required by acceptance criterion #7. Asserts each
   forbidden pattern matches synthetic offender strings (both
   member-access and bare-local shapes), AND asserts the patterns do NOT
   match three synthetic benign callsites (`locations.mcpJsonPath`,
   `agentsIndexPathFor(loc)`, `marketplaceNamesCachePath`) — proving the
   walker catches what it should and skips what it shouldn't.

### Constants

- `ALLOWED_STATE_JSON_WRITERS: ReadonlySet<string>` — exactly two entries:
  `extensions/pi-claude-marketplace/persistence/state-io.ts` and
  `extensions/pi-claude-marketplace/persistence/migrate.ts`.
- `ALLOWED_CONFIG_JSON_WRITERS: ReadonlySet<string>` — exactly one entry:
  `extensions/pi-claude-marketplace/persistence/config-io.ts`.

### Forbidden patterns

```ts
const FORBIDDEN_STATE_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?stateJsonPath\b/;
const FORBIDDEN_CONFIG_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?configJsonPath\b/;
const FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN =
  /atomicWriteJson\(\s*(?:\w+\.)?configLocalJsonPath\b/;
```

The optional `(?:\w+\.)?` prefix matches both member-access shapes
(`loc.stateJsonPath`, `locations.configJsonPath`) and bare-local shapes
(`stateJsonPath`). The current legitimate writers use a mix:
`state-io.ts::saveState` binds the target into a bare local `stateJsonPath`;
`migrate.ts::persistMigratedState` takes a parameter named `stateJsonPath`;
`config-io.ts::saveConfig` takes a parameter named `filePath` (deliberately
not matched — config-io.ts is the allow-listed writer).

### Walker

Verbatim copy of the `walkTsFiles` async generator from
`tests/architecture/no-shell-out.test.ts` (lines 50-60), with the same
`isDirectory()` recursion and `.ts` filter.

## Verification

- `node --test tests/architecture/config-state-write-seams.test.ts` —
  5/5 GREEN.
- `npm run check` — typecheck + lint + format:check + node:test + integration
  GREEN end-to-end: **1549 unit tests + 7 integration tests pass** (Plan
  51-02 baseline was 1544 unit; this plan adds the 5 new architecture
  tests).

### Acceptance criteria

- [x] The file `tests/architecture/config-state-write-seams.test.ts` exists.
- [x] `grep -c "ALLOWED_STATE_JSON_WRITERS\|ALLOWED_CONFIG_JSON_WRITERS"
      tests/architecture/config-state-write-seams.test.ts` returns 14 (>= 4
      required).
- [x] 5 top-level `test(...)` declarations (>= 3 required; the plan allows
      up to 4 when the walks are split — we are at 5 because the walker
      regression test is the documented manual-positive evidence).
- [x] The literal
      `"extensions/pi-claude-marketplace/persistence/config-io.ts"` appears
      in the file (allow-list entry).
- [x] The literal
      `"extensions/pi-claude-marketplace/persistence/state-io.ts"` appears
      in the file (allow-list entry).
- [x] The literal
      `"extensions/pi-claude-marketplace/persistence/migrate.ts"` appears
      in the file (allow-list entry).
- [x] `grep -nE 'assert\.deepEqual\(\s*\[\.\.\.'
      tests/architecture/config-state-write-seams.test.ts` returns 2
      (>= 2 required).
- [x] Behavior assertion: the walker catches a planted offender.
      Implemented as the in-file walker-regression test (test #5) against
      synthetic offender strings AND benign callsite strings — permanent
      and verifiable on every CI run, no temporary production edit required.
- [x] The test is GREEN against the codebase after Plans 51-01 + 51-02
      land.
- [x] `grep -nE 'from "\.\./\.\.'
      tests/architecture/config-state-write-seams.test.ts` returns nothing
      (the test inspects source text only; no production-runtime-type
      imports).
- [x] `npm run check` GREEN end-to-end.

### Success criteria

- [x] SPLIT-02 ownership is structurally enforced by the architecture test.
- [x] Adding a future writer to either allow-list requires an explicit,
      conspicuous edit to both the `ReadonlySet` AND the sibling 'exactly N'
      assertion in the same commit.
- [x] The test runs automatically as part of `npm run check` (caught by the
      existing `tests/{architecture,...}/**/*.test.ts` glob in `package.json`
      `scripts.test` — no opt-in glob required).
- [x] **Phase 51 GREEN GATE:** all five Phase 51 requirements (CFG-01,
      CFG-02, CFG-03, SPLIT-01, SPLIT-02) are closed; `npm run check` is
      GREEN end-to-end across 1549 unit + 7 integration tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug in plan IMPLEMENTATION DECISION] Path-name-specific
patterns instead of coarse `atomicWriteJson(` walk**

- **Found during:** Task 1, pre-implementation pattern survey of the
  codebase.
- **Issue:** The plan's `<action>` block locks an IMPLEMENTATION DECISION
  using the COARSE-WALK formulation: "detect `atomicWriteJson(` callsite
  presence in any non-allow-listed file and refuse." The plan's reasoning
  (#4) claims "Plan 02 + Plan 01 land EXACTLY THREE callers in the source
  tree: `state-io.ts::saveState`, `migrate.ts::persistMigratedState`, and
  `config-io.ts::saveConfig`." This is incorrect against the actual
  codebase. The extension tree has **seven additional legitimate
  `atomicWriteJson(...)` callsites** that write OTHER JSON files entirely:
  - `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:251` (mcp.json)
  - `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:95` (mcp.json)
  - `extensions/pi-claude-marketplace/persistence/agents-index-io.ts:159`
    (agents-index.json)
  - `extensions/pi-claude-marketplace/shared/completion-cache.ts:236`
    (marketplaceNamesCachePath)
  - `extensions/pi-claude-marketplace/shared/completion-cache.ts:315`
    (pluginCachePath — poison write)
  - `extensions/pi-claude-marketplace/shared/completion-cache.ts:324`
    (pluginCachePath)
  - (plus the implementation in `shared/atomic-json.ts`, which is the
    `writeFileAtomic` body — not an `atomicWriteJson(` call)

  A coarse-walk formulation would have wrongly flagged every one of these
  as a SPLIT-02 violation, RED-failing CI immediately on land. SPLIT-02 is
  scoped to the three protected files (`state.json`,
  `claude-plugins.json`, `claude-plugins.local.json`); other JSON files
  have other ownership contracts (e.g., `mcp.json` is owned by the
  `bridges/mcp/{stage,unstage}.ts` seam, `agents-index.json` is owned by
  `persistence/agents-index-io.ts`, completion caches are owned by
  `shared/completion-cache.ts`) — none of which are SPLIT-02's concern.

- **Fix:** Used path-name-specific regex patterns that match
  `atomicWriteJson(<optional-prefix>stateJsonPath|configJsonPath|configLocalJsonPath)`
  with `(?:\w+\.)?` covering both member-access (`loc.stateJsonPath`) and
  bare-local (`stateJsonPath`) callsite shapes. This:
  1. Scopes enforcement to the three protected files only (no false
     positives on the seven legitimate non-protected writers).
  2. Catches every current legitimate writer in the allow-lists (which
     would have failed the coarse walk's verification step #4 anyway).
  3. Catches every hypothetical future offender that uses either the
     member-access form or the conventional bare-local-name form.

- **Accepted residual:** A hypothetical aliasing offender that copies the
  protected path into a differently-named local (e.g.
  `const x = loc.configJsonPath; atomicWriteJson(x, ...);`) slips the
  regex. This is documented in the test's header docstring as an accepted
  limitation — the 'exactly N' sibling assertions remain the second-line
  defense via code review, where adding a new writer to either allow-list
  is conspicuous enough that the alias pattern would be intentional rather
  than accidental.

- **Files modified:** Only the new file
  `tests/architecture/config-state-write-seams.test.ts`. No production code
  touched (the deviation lives entirely inside the test file's pattern
  selection).

- **Committed in:** `edac28d` (the same single commit that lands the
  plan's deliverable).

**Confidence the deviation is correct:** The plan author's IMPLEMENTATION
DECISION reasoning (claim #4) is empirically falsified by
`grep -rn "atomicWriteJson(" extensions/pi-claude-marketplace/` —
documented above. The walker-regression test (#5) provides positive
evidence in BOTH directions: it asserts the patterns match the offender
shapes AND that they do NOT match the benign callsites — codified
inside the test file so the deviation's correctness is asserted on every
CI run.

### Manual-positive evidence (acceptance criterion #7)

Per the plan's acceptance criterion: *"the coarse walk catches a planted
offender ... Document the manual-positive in the plan SUMMARY. (Optional:
instead of touching production code, write a helper that creates a
synthetic offender source string and runs the walker against it inline;
either path is acceptable.)"*

Chose the **synthetic-string helper path**: the walker-regression test
(test #5 in the file) asserts each `FORBIDDEN_*_PATTERN` matches synthetic
offender strings:

- `"await atomicWriteJson(loc.stateJsonPath, state);"` → matches
  `FORBIDDEN_STATE_JSON_PATTERN`.
- `"await atomicWriteJson(stateJsonPath, state);"` → matches
  `FORBIDDEN_STATE_JSON_PATTERN` (bare-local form).
- `"await atomicWriteJson(loc.configJsonPath, cfg);"` → matches
  `FORBIDDEN_CONFIG_JSON_PATTERN`.
- `"atomicWriteJson(configJsonPath, cfg)"` → matches
  `FORBIDDEN_CONFIG_JSON_PATTERN` (bare-local form).
- `"await atomicWriteJson(loc.configLocalJsonPath, cfg);"` → matches
  `FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN`.

And asserts the patterns do NOT match benign strings drawn from the actual
codebase:

- `"await atomicWriteJson(locations.mcpJsonPath, doc);"` (from
  `bridges/mcp/unstage.ts`)
- `"await atomicWriteJson(agentsIndexPathFor(loc), index);"` (from
  `persistence/agents-index-io.ts`)
- `"await atomicWriteJson(marketplaceNamesCachePath, payload);"` (from
  `shared/completion-cache.ts`)

This is **stronger evidence** than a one-off temporary production-file
edit-then-revert because it is permanent (runs in every CI execution) and
asserts BOTH the positive (catches offenders) and negative (no false
positives on legitimate non-protected writers) properties of the walker.

## Threat Model Closure

The plan's `<threat_model>` STRIDE register lists five threats
(T-51-03-01..05 + T-51-03-SC). All `mitigate` dispositions are closed by
this plan:

- **T-51-03-01** (new orchestrator / reconcile-path file grows a
  `atomicWriteJson(loc.configJsonPath, ...)` call bypassing `saveConfig`):
  closed by `FORBIDDEN_CONFIG_JSON_PATTERN` +
  `FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN` against any non-allow-listed file,
  plus the 'exactly N' sibling assertion.
- **T-51-03-02** (new code path grows
  `atomicWriteJson(loc.stateJsonPath, ...)` outside the allow-list):
  closed by `FORBIDDEN_STATE_JSON_PATTERN` against any non-allow-listed
  file, plus the 'exactly N' sibling assertion.
- **T-51-03-03** (walker regex misses a writer because the callsite uses
  an unusual variable name): the plan's locked COARSE-WALK formulation was
  intended to mitigate this by ignoring argument shape entirely; we
  inverted the choice but added the optional `(?:\w+\.)?` prefix so both
  member-access and bare-local forms are caught. The remaining alias-class
  evasion (`const x = loc.stateJsonPath; atomicWriteJson(x, ...)`) is
  documented as accepted residual — the 'exactly N' sibling assertion is
  the code-review-level second-line defense, mirroring the plan's
  T-51-03-04 process-risk acceptance pattern.
- **T-51-03-04** (future contributor adds the architecture test to the
  allow-list as a quick fix): `accept` — process risk, not structural.
  The 'exactly N' sibling assertion makes the widening conspicuous in
  code review per the plan's mitigation.
- **T-51-03-SC** (package legitimacy): no new packages introduced.

## Commits

- `edac28d` — `test(51-03): add SPLIT-02 write-seam ownership architecture
  test`

## Files Created/Modified

Created:

- `tests/architecture/config-state-write-seams.test.ts` (222 lines)

Modified: none (no production source files touched, as required by the
plan's `<verification>` block).

## Known Stubs

None. The test is fully wired end-to-end against the actual codebase and
runs as part of `npm run check`. The 'exactly N' sibling assertions pin
literal arrays — there is no placeholder data or hardcoded empty return.

## Threat Flags

None new. The plan's STRIDE register at `<threat_model>` covers the
architecture-test surface (T-51-03-01..05 + T-51-03-SC); no additional
trust-boundary surface introduced.

## Self-Check: PASSED

Files referenced in this SUMMARY exist on disk:

- `tests/architecture/config-state-write-seams.test.ts` — FOUND

Commits referenced in this SUMMARY exist in git history:

- `edac28d` — FOUND
