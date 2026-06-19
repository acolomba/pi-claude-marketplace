---
phase: 61-if-field-permission-rule-matcher
plan: 01
subsystem: hooks
tags: [if-field, glob, bash-parser, permission-rule, match-03, d-61-01, d-61-02, d-61-03, d-61-04, nfr-7]

# Dependency graph
requires:
  - phase: 60-hook-execution-payload-translators-env-vars
    provides: assertNever import seam at bridges/hooks/exec-result.ts; hookDebugLog at shared/debug-log.ts; errorMessage at shared/errors.ts
  - phase: 58-matcher-parser-tool-name-mapping-supportability-gate
    provides: PiToolName literal union + TOOL-01 hook-tool-names.ts pattern (as const satisfies Record); ParsedMatcher discriminated-union precedent
provides:
  - Hand-authored glob engine (zero new runtime deps) with discriminated CompiledBashGlob / CompiledPathGlob shapes
  - Bash subcommand parser implementing upstream verbatim strip / split / recurse contract
  - IF_PREFIX_TARGETS closed-set table (Bash/Read/Edit/Write -> Pi event sets + extract target)
  - IfPredicate five-arm discriminated union + MATCH_ALL_IF fall-open sentinel
  - Architecture-test fixture pinning every upstream truth-table row verbatim (Wave-0 scaffold)
affects: [61-02 parse-time-compile, 61-03 dispatch-consult-plus-amendment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union for compiled glob output (CompiledBashGlob / CompiledPathGlob with readonly token list + flag fields)"
    - "Pure-and-total contract on parse-time compile entry points (never throw; consumers fail-open)"
    - "Closed-set `as const satisfies Record<string, IfPrefixTarget>` gate at domain/components/hook-if-targets.ts (mirrors TOOL-01 pattern)"
    - "Quote-aware compound-separator splitter with longest-token-first precedence (Bash subcommand parse)"
    - "Recursion-depth-capped $(...) / backtick walker with shared QuoteCursor helper"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts
    - tests/architecture/hooks-if-field.test.ts
  modified: []

key-decisions:
  - "D-61-01 hand-authored glob engine: chose linear recursive-descent matcher; segment-bounded `**` + segment-local `*` give linear-time match with no catastrophic backtrack. Caller passes PathAnchorContext (homedir/cwd/projectRoot) since Pi's ExtensionContext does not expose projectRoot."
  - "D-61-04 wrapper-arg stripping refinement: WRAPPER_STRIP contains exactly the 6-element upstream closed set; sibling WRAPPERS_WITH_ARG (timeout/nice/stdbuf) also consumes the next non-option token so `timeout 30 npm test` strips to `npm test` matching the upstream truth-table row."
  - "Bash trailing-space word-boundary semantic: matcher tries `subcommand + ' '` when trailingWordBoundary is true so `<cmd> *` admits `<cmd>` standalone (e.g. timeout-stripped `npm test` against `Bash(npm test *)`) without breaking the `Bash(ls *)` vs `lsof` exclusion."
  - "filesystem-root anchor (`//abs`) keeps ONE leading `/` in the remaining pattern so tokens match a full absolute path verbatim (e.g. `//abs/**` tokenizes to `[slash, literal('abs'), slash, globstar]` against `/abs/x.ts`)."
  - "IfPredicate always-present-with-sentinel: MATCH_ALL_IF is the fall-open sentinel; absent / malformed `if` fields normalize to it at parse time so the dispatch switch is total and assertNever enforces NFR-7 exhaustiveness without an `undefined` arm."

patterns-established:
  - "QuoteCursor: shared mutable quote-state helper consumed by both the compound-separator splitter and the balanced-paren scanner; consumeQuoteChar returns true when the char was consumed as part of quote bookkeeping"
  - "Truth-table architecture test: ReadonlyArray<{ifPattern, bashCommand|inputPath|toolName, fires, reason}> with verbatim upstream rows + iterate-and-assert per row; Wave-0 scaffold uses test.todo(...) for rows depending on follow-up plans"

requirements-completed: []  # MATCH-03 amendment + closure lands in Plan 03 (atomic-supersession per D-61-03)

# Metrics
duration: ~45min
completed: 2026-06-15
---

# Phase 61 Plan 01: Foundation Primitives Summary

**Hand-authored glob engine + Bash subcommand parser + upstream-faithful prefix-to-Pi-event-set mapping + IfPredicate fall-open sentinel; parse-time-compile primitives for MATCH-03 with zero new runtime deps.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 3
- **Files created:** 5

## Accomplishments

- Built the entire parse-time-compile foundation for the `if`-field
  permission-rule matcher. Plans 02 (parse-time attach) and 03
  (dispatch-time consult + REQUIREMENTS.md amendment) can both compile
  against this surface without modification.
- Pinned every upstream truth-table row verbatim in the architecture
  test (13 active blocks across 8 truth-table sections + 6 todos for
  follow-up-plan dependencies). `npm run check` passes with 2113 active
  tests + 6 new todos pending.
- Preserved D-61-01 zero-new-runtime-deps stance (no picomatch / no
  minimatch); the hand-authored matcher is linear-time with zero
  alternation and zero catastrophic-backtrack risk.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hand-author glob engine + IF_PREFIX_TARGETS + IfPredicate union** — `75dcfb1` (feat)
2. **Task 2: Hand-author Bash subcommand parser + bashSubcommandFires** — `f90920c` (feat)
3. **Task 3: Architecture-test scaffold pinning upstream truth-table rows** — `316d77f` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts` —
  ~280 LoC hand-authored glob engine. Discriminated `GlobToken`
  (literal/star/globstar/slash) and `PathAnchor` (filesystem-root/
  home/project-root/cwd/gitignore-bare) unions; `compileBashGlob` +
  `compilePathGlob` pure-and-total entry points; per-kind match helpers
  (`matchStar`, `matchGlobstar`, `stripBase`) keep cognitive complexity
  at lint-allowed levels with `assertNever` exhaustiveness at every
  switch default.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts` —
  ~340 LoC upstream-verbatim Bash subcommand parser. `WRAPPER_STRIP`
  closed set + sibling `WRAPPERS_WITH_ARG`; quote-aware compound
  splitter via shared `QuoteCursor` helper; `$(...)` / backtick
  recursion with `MAX_RECURSION_DEPTH=8`; specificity-override branch
  in `bashSubcommandFires`. Discriminated `ParseResult` surfaces fail-
  clean reason for the consumer's fail-open contract.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` —
  ~90 LoC public surface. `IfPredicate` five-arm union with `readonly`
  on every field; `MATCH_ALL_IF` sentinel; re-exports the glob + bash
  surfaces.
- `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` —
  ~90 LoC closed-set table. Four entries (`Bash` / `Read` / `Edit` /
  `Write`) mapping upstream prefixes to Pi-event sets + extract target;
  `as const satisfies Record<string, IfPrefixTarget>` compile-time gate.
- `tests/architecture/hooks-if-field.test.ts` — ~550 LoC architecture-
  test scaffold. 10 blocks (IF_PREFIX_TARGETS introspection + word-
  boundary + colon-sugar + wrapper + compound + hooks-guide truth
  table + path anchor + MCP + IfPredicate exhaustiveness + todos for
  Plan 02 / Plan 03 wiring).

## Decisions Made

- **D-61-01 implementation shape:** `CompiledBashGlob` and
  `CompiledPathGlob` are both `interface`-typed with `readonly`
  fields + a method (`test` / `testAbsolute`) closing over the
  compiled tokens. This keeps the public dispatch surface a single
  function call against an opaque value, instead of forcing
  consumers to thread tokens + flags as separate parameters.
- **D-61-04 timeout-arg consumption:** the upstream truth-table row
  `Bash(npm test *) ↔ timeout 30 npm test → fires:true` requires
  the parser to consume both `timeout` AND its duration argument.
  Added a sibling `WRAPPERS_WITH_ARG` set (`timeout` / `nice` /
  `stdbuf`) that strips the next non-option token after the wrapper
  head. `nohup` / `time` / bare `xargs` strip only the head (no arg
  to consume). Documented in the bash.ts file-leading comment as
  the "with-arg" clause of D-61-04.
- **Bash trailing-space word-boundary fallback:** the literal-space
  approach (`Bash(<cmd> *)` tokenizes to
  `[literal("<cmd>"), literal(" "), star]`) does not match bare
  `<cmd>` (no trailing space). Added a fallback in `matchBashGlob`:
  when `trailingWordBoundary` is true, also try matching
  `subcommand + " "` to admit the no-arg case. Preserves the upstream
  invariant that `Bash(ls *)` excludes `lsof` (because `lsof` does
  not start with `ls ` and never gets a trailing-space appended).
- **filesystem-root remaining-pattern shape:** kept one leading `/`
  in the remaining pattern so tokens for `//abs/**` tokenize to
  `[slash, literal("abs"), slash, globstar]` and match `/abs/x.ts`
  via the standard `matchTokens` path. The alternative (strip both
  slashes, then handle the anchor in `matchPathGlob`) would have
  duplicated the matchTokens logic at the anchor seam.
- **Architecture-test todos vs verbatim rows:** every truth-table row
  RESEARCH.md snapshotted from upstream is pinned VERBATIM in the
  test file. The 6 todos cover ONLY the dispatch-time consult
  (`ifFires`) and parse-time entry (`compileIfPredicate`) that land
  in follow-up plans -- not any truth-table row. This satisfies the
  Wave-0 scaffold contract from VALIDATION.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment block prematurely terminated by `**/` token**

- **Found during:** Task 1 typecheck
- **Issue:** The JSDoc comment on `CompiledPathGlob` contained the literal
  string `` `**/<basename>` `` to illustrate gitignore-bare semantics.
  The `*/` substring closed the `/**` comment block early, producing 50+
  parser errors. Same pattern repeated in the `resolveAnchor` JSDoc
  ("implicit `**/` prefix").
- **Fix:** Rewrote both phrasings to use prose ("implicit any-depth
  prefix" / "implicit any-depth-prefix shape") without literal `**/`
  inside JSDoc.
- **Files modified:** `bridges/hooks/if-field/glob.ts`
- **Verification:** `npx tsc --noEmit` clean after the change.
- **Committed in:** `75dcfb1` (Task 1 commit)

**2. [Rule 3 - Blocking] Wrong relative-import depth from `if-field/`**

- **Found during:** Task 1 typecheck
- **Issue:** `index.ts` and `bash.ts` used `../../shared/errors.ts` and
  `../../domain/components/hook-tool-names.ts` -- but `if-field/` is
  three levels under `extensions/pi-claude-marketplace/` so the correct
  prefix is `../../../`.
- **Fix:** Updated both imports to use `../../../shared/errors.ts` and
  `../../../domain/components/hook-tool-names.ts`.
- **Files modified:** `bridges/hooks/if-field/bash.ts`,
  `bridges/hooks/if-field/index.ts`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `75dcfb1` (Task 1 commit) and `f90920c` (Task 2 commit)

**3. [Rule 1 - Bug] Cognitive-complexity lint failures on the matchers**

- **Found during:** Task 1 + Task 2 lint
- **Issue:** `matchTokens` (cc=20), `splitOnCompoundSeparators` (cc=17),
  `pushRecursed` (cc=19), and `readBalancedParens` (cc=22) exceeded the
  sonarjs/cognitive-complexity allowed=15.
- **Fix:** Extracted per-kind helpers (`matchStar`, `matchGlobstar`,
  `stripBase`) from `matchTokens` / `matchPathGlob`; introduced a
  shared `QuoteCursor` helper (`consumeQuoteChar`) consumed by both
  `splitOnCompoundSeparators` and `readBalancedParens`; extracted
  `emitInner` from `pushRecursed` to deduplicate the
  split-push-recurse pattern between `$(...)` and backtick branches.
- **Files modified:** `bridges/hooks/if-field/glob.ts`,
  `bridges/hooks/if-field/bash.ts`
- **Verification:** `npx eslint` clean; smoke-test still PASSES.
- **Committed in:** `75dcfb1` (Task 1 commit), `f90920c` (Task 2 commit)

**4. [Rule 2 - Missing Critical] WRAPPERS_WITH_ARG sibling for upstream
truth-table conformance**

- **Found during:** Task 3 smoke-test run before architecture-test
  authoring
- **Issue:** The plan said "strip the wrapper" but the upstream truth-
  table row `Bash(npm test *) ↔ timeout 30 npm test → fires:true`
  requires the parser to consume both `timeout` AND its duration arg
  (`30`). Without this, the parser leaves `30 npm test` as the head
  subcommand and the truth-table row red-fails.
- **Fix:** Added `WRAPPERS_WITH_ARG = new Set(["timeout","nice","stdbuf"])`
  in `bash.ts`; `stripWrappers` consumes the next non-option token
  after the wrapper head when the head is in this set. `nohup` /
  `time` / bare `xargs` are NOT in this set so the bare-strip
  behavior is preserved. Documented in the bash.ts file-leading
  comment as the "with-arg" clause of D-61-04.
- **Files modified:** `bridges/hooks/if-field/bash.ts`
- **Verification:** smoke-test PASSES; architecture-test PASSES every
  WRAPPER_TABLE row.
- **Committed in:** `f90920c` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 Rule 1 - JSDoc bug, 1 Rule 3 -
import depth, 1 Rule 1 - cognitive-complexity refactor, 1 Rule 2 -
upstream-conformance gap)

**Impact on plan:** All four auto-fixes preserve the plan's documented
semantics. No scope creep: the cognitive-complexity refactor extracted
private helpers without changing the public surface; the import-depth
fix is a typo correction; the JSDoc rewrite is cosmetic; the
WRAPPERS_WITH_ARG addition closes a documented upstream truth-table
row that the plan's action prose underspecified.

## Issues Encountered

- The Bash trailing-space word-boundary semantic ("Bash(ls *)
  excludes lsof; Bash(ls*) matches both") is non-trivial in a
  tokenize-and-match model. Initial attempt left `<cmd> *` as
  `[literal("<cmd>"), literal(" "), star]` which correctly excluded
  the no-space case but failed to match bare `<cmd>` (relevant for
  the timeout-stripped `npm test` case). Resolved via the
  `matchBashGlob` fallback that retries with `subcommand + " "` when
  the pattern declares a trailing word boundary -- preserving the
  `lsof` exclusion (which never matches the trailing-space prefix
  in either branch) while admitting the no-arg case.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 02 (parse-time attach)** can compile against the Task 1 / Task
  2 exports without modification. The `IfPredicate` union shape, the
  `MATCH_ALL_IF` sentinel, and the `compileBashGlob` / `compilePathGlob`
  signatures are all final. Plan 02 needs to: (a) extend
  `HOOK_HANDLER_SCHEMA` with `if: Type.Optional(Type.String())`, (b)
  add `compileIfPredicate(rawIf, ctx)` in
  `domain/components/hooks.ts`, (c) attach `ifPredicate: IfPredicate`
  to `RoutingEntry` in `event-router.ts`, (d) populate the
  architecture-test todos for the parse-time-compile arm.
- **Plan 03 (dispatch consult + REQUIREMENTS.md amendment)** can wire
  the `ifFires(predicate, event, ctx, claudeEvent): boolean` consult
  in `bridges/hooks/dispatch.ts` against the surface this plan ships.
  The MATCH-03 amendment in `.planning/REQUIREMENTS.md` lands
  atomically in Plan 03's commit (atomic-supersession per D-61-03).
- No blockers; the Wave-0 scaffold is in place.

## Self-Check: PASSED

- All 5 created files exist:
  - `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` -- FOUND
  - `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` -- FOUND
  - `tests/architecture/hooks-if-field.test.ts` -- FOUND
- All 3 task commits exist in `git log --oneline`:
  - `75dcfb1` Task 1 (feat: glob engine + IF_PREFIX_TARGETS) -- FOUND
  - `f90920c` Task 2 (feat: Bash subcommand parser) -- FOUND
  - `316d77f` Task 3 (test: architecture truth-table fixtures) -- FOUND
- `npm run check` GREEN: 2113 active tests pass, 6 todos pending, 0 fails.
- Comment policy clean: `grep -nE 'Phase [0-9]+|Pitfall [0-9]+|Plan [0-9]+-[0-9]+|Wave [0-9]+|Task [0-9]+'`
  returns 0 matches in new source and test files.
- `Object.keys(IF_PREFIX_TARGETS) === ["Bash","Read","Edit","Write"]` (locked order).
- `MATCH_ALL_IF.kind === "match-all"`.
- `WRAPPER_STRIP.size === 6`.

---

*Phase: 61-if-field-permission-rule-matcher*
*Completed: 2026-06-15*
