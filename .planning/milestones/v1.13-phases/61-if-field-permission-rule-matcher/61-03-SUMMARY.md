---
phase: 61-if-field-permission-rule-matcher
plan: 03
subsystem: hooks
tags: [if-field, dispatch, match-03, d-61-02, d-61-03, d-61-04, nfr-7, atomic-supersession]

# Dependency graph
requires:
  - phase: 61-if-field-permission-rule-matcher
    plan: 01
    provides: glob.ts / bash.ts primitives; IfPredicate union; MATCH_ALL_IF sentinel; IF_PREFIX_TARGETS table; architecture-test scaffold
  - phase: 61-if-field-permission-rule-matcher
    plan: 02
    provides: compileIfPredicate parse-time entry; RoutingEntry.ifPredicate always-present-with-sentinel; parseHooksConfig side-Map
provides:
  - ifFires(predicate, event, ctx, claudeEvent) dispatch-time consult exported from bridges/hooks/if-field/index.ts
  - Per-event input extractors (extractBashCommand / extractToolName / extractPath / resolveTarget)
  - dispatch.ts reduceBucket now consults ifFires between matcher gate and activeExecutor (single-line insertion at the established seam)
  - REQUIREMENTS.md MATCH-03 amendment lockstep with the first commit (atomic-supersession per D-58-01 lesson)
  - Architecture-test closure: every upstream truth-table row asserted end-to-end through ifFires + compileIfPredicate; zero t.todo markers
affects: []  # Phase 61 ships ready for verification + phase close

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-event input extractor seam: `(event as { input?: { command?: unknown } }).input?.command` style readers tolerate shape-fragile runtime payloads without throwing; consumers handle undefined explicitly per kind."
    - "Atomic-supersession commit lockstep: REQUIREMENTS.md closed-set amendment lands in the SAME commit as the source code that implements it; no intermediate divergence window between contract and implementation."
    - "Dispatch-time fail-open via hookDebugLog: ifFires returns true on parser !ok and emits a hookDebugLog warning; MATCH-03 §3 best-effort contract preserved without notify.ts pollution (IL-2 clean)."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - tests/architecture/hooks-if-field.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Atomic-supersession lockstep (D-61-03 / D-58-01): the REQUIREMENTS.md MATCH-03 amendment lands in the SAME commit as the source `ifFires` insertion + per-event extractors so the contract and implementation never diverge mid-phase. Conventional Commits title: `feat(61-03): ifFires dispatch consult + amend MATCH-03 lockstep`."
  - "ifFires `_claudeEvent` parameter is reserved for forward-compat: the parse-time compile path already collapses non-tool events to MATCH_ALL_IF (A5 disposition), so the dispatch consult never observes a non-tool-event predicate that needs per-event nuance. The argument is accepted (and prefixed with `_` to silence the unused-arg lint) so future per-event behavior can wire in without changing the signature."
  - "Per-event extractors guard on `typeof === 'string'` rather than null-checking: a malformed event payload (number, object, array) returns undefined just like an absent field. Consumers (the path-tool / bash arms) handle undefined explicitly per the D-61-02 fail-open contract; the bash arm returns false on undefined command (nothing to match), the path-tool arm substitutes ctx.cwd per D-61-03."
  - "No `fs.realpath` at dispatch: `resolveTarget` is pure string normalization (path.normalize / path.resolve against ctx.cwd). Symlink resolution at dispatch time would add I/O cost and surface race conditions (RESEARCH T-61-05). The glob comparison runs against the literal absolute path the runtime event carries."

patterns-established:
  - "Dispatch-time consult shape: total switch over `IfPredicate.kind` with `assertNever` exhaustiveness (NFR-7); per-arm extraction + comparison stays small (5-10 lines per arm); zero string-parsing on the `match-all` / `mcp-*` hot path arms."
  - "AND composition gate sequence in reduceBucket: matcher gate -> ifFires gate -> activeExecutor. Both gates return `continue` on miss (skip entry); only the executor's HookExecResult arm drives the block / stop / mutate / noop reducer fold."

requirements-completed:
  - MATCH-03

# Metrics
duration: ~40min
completed: 2026-06-15
---

# Phase 61 Plan 03: ifFires dispatch consult + MATCH-03 amendment lockstep + architecture-test closure

**Phase 61 closes: `if`-field permission-rule matching ships in full -- AND composition with the group matcher, D-61-02 fail-open on every failure mode, D-61-03 substitute-cwd for path tools, D-61-04 Bash specificity-override + wrapper strip; REQUIREMENTS.md MATCH-03 amended atomically in the first commit.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 3 (all auto, atomic per-task commits)
- **Files modified:** 4 (3 source/test + 1 REQUIREMENTS doc)

## Accomplishments

- Implemented the MATCH-03 dispatch-time consult `ifFires(predicate, event, ctx, claudeEvent)` as a flat switch over `IfPredicate.kind` with `assertNever` exhaustiveness (NFR-7). Five arms cover match-all (true), bash (parseBashSubcommands + specificity-override), path-tool (cross-tool guard + D-61-03 substitute-cwd + pathGlob.testAbsolute), mcp-literal (equality), mcp-server-prefix (startsWith).
- Wired the consult into `reduceBucket` as a single-line insertion between the matcher gate and the activeExecutor call. The `if`-no-match path returns `continue` (NOT block); D-60-02 reducer arms (block / stop / mutate / noop) remain unchanged. Both gates are evaluated in order; AND composition is exactly MATCH-03 §4.
- Amended REQUIREMENTS.md MATCH-03 in lockstep with the first commit (D-58-01 atomic-supersession): the prefix closed set drops `Grep` / `Glob` / `LS` / `MultiEdit` / `NotebookEdit`; the cross-tool mapping table is documented in-line (`Read` covers `read/grep/find/ls`; `Edit` covers `edit/write`; `Write` covers `write`; `Bash` covers `bash`); the two extra MCP forms (`mcp__<server>`, `mcp__<server>__*`) are added; the substitute-cwd rule for path tools without `input.path` is added; fail-open is extended to ALL `if`-layer failure modes.
- Closed the architecture test: every upstream truth-table row is now asserted end-to-end through `compileIfPredicate` + `ifFires` (not just the Plan 01 unit-level checks against `compileBashGlob` / `compilePathGlob`). Zero `t.todo` markers remain. New blocks pin AND composition, fail-open, compile-failure collapse, substitute-cwd, cross-tool guard, A5 SessionStart disposition, and hookDebugLog emission on fail-open.
- `npm run check` GREEN: 2150 unit tests pass (up from 2138 after retiring 3 todos + adding 12 end-to-end blocks), 10 integration tests pass, 0 fails, 0 todos.

## Task Commits

Each task was committed atomically:

1. **Task 1: ifFires + per-event extractors + REQUIREMENTS.md MATCH-03 amendment (atomic-supersession)** — `ca5f585` (feat)
2. **Task 2: wire ifFires into reduceBucket (single-line dispatch insertion)** — `a49d034` (feat)
3. **Task 3: close architecture test (retire all todos with end-to-end ifFires assertions)** — `3f44470` (test)

## Files Created/Modified

### Source files (2 modified)

- `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` — Added imports (`node:path`, `assertNever`, `parseBashSubcommands`/`bashSubcommandFires`, `ExtensionContext`). Added 4 private helpers (`extractBashCommand` / `extractToolName` / `extractPath` / `resolveTarget`). Added the exported `ifFires(predicate, event, ctx, claudeEvent): boolean` function implementing the 5-arm discriminated switch with `assertNever` default arm.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` — Added `import { ifFires } from "./if-field/index.ts"`. Inserted the 4-line `if (!ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)) continue;` block between the matcher gate (line 171-173) and the `activeExecutor` call (line 175). No other changes.

### Test files (1 modified)

- `tests/architecture/hooks-if-field.test.ts` — Added imports (`ifFires`, `parseMatcher`, `BucketAEvent`, `ExtensionContext`). Replaced the 3 Plan 03 `t.todo` markers with 12 new end-to-end blocks:
  - Block 14 (5 tests): end-to-end ifFires against HOOKS_GUIDE / BASH_WORD_BOUNDARY / COLON_SUGAR / WRAPPER / COMPOUND truth tables.
  - Block 15: end-to-end ifFires against PATH_ANCHOR_TABLE.
  - Block 16: end-to-end ifFires against MCP_TABLE.
  - Block 17: MATCH-03 §4 AND composition (matcher + ifFires both required).
  - Block 18 (2 tests): MATCH-03 §3 fail-open on unparseable Bash + false on missing command.
  - Block 19: D-61-02 every compile-failure mode collapses to MATCH_ALL_IF.
  - Block 20 (2 tests): D-61-03 substitute-cwd + cross-tool guard.
  - Block 21: A5 SessionStart fall-open.
  - Block 22: ifFires fail-open emits hookDebugLog when PI_CLAUDE_MARKETPLACE_DEBUG=1.
  - Stripped pre-existing `Plan 02 / Plan 03` and `Pitfall 9` tokens from the file-leading comment + the `predicateFromMcpIfPattern` doc-comment per the typescript-comments policy.

### Documentation (1 modified)

- `.planning/REQUIREMENTS.md` — MATCH-03 paragraph replaced verbatim with the RESEARCH-drafted amendment (RESEARCH lines 1306-1372). Prefix list now reads `Bash`, `Read`, `Edit`, `Write` + 3 MCP forms; cross-tool mapping table inline; substitute-cwd rule documented; fail-open extended to ALL `if`-layer failure modes. Traceability row stays `MATCH-03 | Phase 61 | Pending` (flip to `Complete` happens at phase close, NOT in this plan).

## Decisions Made

- **Atomic-supersession lockstep (D-61-03 / D-58-01):** the REQUIREMENTS.md amendment landed in the SAME commit as the `ifFires` source code (Task 1's commit `ca5f585`), not as a separate doc-only commit. This honors the D-58-01 lesson from Phase 58: closed-set source-of-truth changes (`MATCH-03`'s accepted prefix list, cross-tool mapping, substitute-cwd rule) land alongside their consumers (the dispatch-time consult) so byte-equality gates and the source-of-truth never diverge mid-phase. The commit message documents both sides verbatim.
- **`_claudeEvent` argument retained for forward-compat:** the dispatch consult does not branch on `claudeEvent` today (parse-time compile already collapses non-tool events to MATCH_ALL_IF, so a non-tool entry reaching `ifFires` is already the fall-open sentinel). Keeping the argument in the signature (prefixed `_` to silence the unused-arg lint) preserves the option for future per-event nuance without a signature change.
- **Per-event extractors guard on `typeof === 'string'`:** a malformed event payload (number / object / array shape for `command` or `path` or `toolName`) returns undefined just like an absent field. The path-tool arm substitutes `ctx.cwd` per D-61-03; the bash arm returns false (nothing to match); the mcp arms compare against the empty string and fail equality. This shape-tolerant stance matches the T-61-09 mitigation pinned in the threat model.
- **No `fs.realpath` at dispatch:** `resolveTarget` is pure string normalization (`path.normalize` for absolute, `path.resolve(ctx.cwd, p)` for relative). Symlink resolution at dispatch time would add per-event I/O and surface TOCTOU race conditions. The glob comparison runs against the literal absolute path the runtime event carries -- which matches the parse-time compile's anchor model (compileTime homedir/cwd/projectRoot snapshot, not realpath'd).
- **Empty command -> false (NOT fail-open):** when an `if: Bash(...)` predicate fires against a `bash` event with no `input.command`, `ifFires` returns false (entry skipped). The matcher gate has already admitted the entry as a bash event, so the absence of a command field at the runtime layer means there is nothing to evaluate the glob against -- not the same condition as "command parse failed" (which IS fail-open per D-61-04). The architecture test pins this in Block 18.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Style] eslint --fix reorders `./bash.ts` import before `./glob.ts`**

- **Found during:** Task 1 lint
- **Issue:** The initial draft of `if-field/index.ts` had `import { compileBashGlob, compilePathGlob } from "./glob.ts"` BEFORE `import { bashSubcommandFires, parseBashSubcommands } from "./bash.ts"`, but `import-x/order` alphabetizes intra-group imports so `./bash.ts` must precede `./glob.ts`.
- **Fix:** `npx eslint --fix` reordered the imports; also added prettier-style blank lines between statements.
- **Files modified:** `bridges/hooks/if-field/index.ts`
- **Verification:** `npm run lint` clean.
- **Committed in:** `ca5f585` (Task 1 commit)

**2. [Rule 1 - Style] Prettier reflow on the new architecture-test blocks**

- **Found during:** Task 3 `npm run check` format step
- **Issue:** The new end-to-end test blocks had one line (the `ifFires` call argument list) that exceeded the printWidth and needed multi-line reflow.
- **Fix:** `npx prettier --write tests/architecture/hooks-if-field.test.ts`. No semantic change.
- **Files modified:** `tests/architecture/hooks-if-field.test.ts`
- **Verification:** `npm run check` clean.
- **Committed in:** `3f44470` (Task 3 commit)

**3. [Rule 1 - Comment policy] Pre-existing `Plan 02 / Plan 03` and `Pitfall 9` tokens in the test file**

- **Found during:** Task 3 comment-policy scan after closing the todos
- **Issue:** The file-leading comment block (carried over from Plan 01) said "Plan 02 / Plan 03 wire `compileIfPredicate` and `ifFires`" and "rows that depend on those entry points are marked `test.todo(...)`"; the `predicateFromMcpIfPattern` doc-comment said "Plan 02's `compileIfPredicate` will own this construction at parse time"; one test title said `(Pitfall 9)`. Now that Plan 03 closes the todos, the references are stale AND violate the typescript-comments policy (forbidden tokens: bare `Plan NN`, bare `Pitfall N`).
- **Fix:** Rewrote the file-leading paragraph to reflect the closed state ("End-to-end blocks drive every row through `compileIfPredicate` (parse-time entry) and `ifFires` (dispatch-time consult), closing the MATCH-03 contract"); rewrote `predicateFromMcpIfPattern` doc to drop the `Plan 02` reference; stripped `(Pitfall 9)` from the empty-string test title.
- **Files modified:** `tests/architecture/hooks-if-field.test.ts`
- **Verification:** `grep -nE 'Phase [0-9]+|Pitfall [0-9]+|Plan [0-9]+|Wave [0-9]+|Task [0-9]+'` returns 0 matches across the 3 touched files.
- **Committed in:** `3f44470` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 - style/format auto-fixes via eslint --fix / prettier --write, 1 Rule 1 - comment policy cleanup as a precondition for closing the phase). No Rule 4 architectural changes; no checkpoint hits.

**Impact on plan:** All three are cosmetic / hygiene fixes. No scope change; no API surface change; no semantic change. The comment-policy cleanup is a precondition the plan flagged explicitly under "Comment policy: every section divider uses the 74-dash-rule shape; every test title uses the `MATCH-03: <invariant>` or `D-61-NN: <invariant>` form -- NO `Phase 61` / `Plan 03` / `Pitfall N` / `Wave N` tokens".

## Issues Encountered

- None. Task 1's lint failure (import order) was a trivial auto-fix; Task 3's prettier reflow was a trivial auto-fix. The MATCH-03 amendment text in RESEARCH.md was byte-for-byte usable (no reconciliation needed against the current REQUIREMENTS.md baseline).
- The plan's `read_first` list cited dispatch.ts "lines 80-204" for the reduceBucket shape; the file had no drift -- the `matcherFires(entry)` -> `activeExecutor(entry, event, ctx)` seam was at the documented location (lines 171-175 in the original baseline), and the single-line insertion went in cleanly. No seam re-anchoring required.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 61 (`if`-field permission-rule matcher)** ships ready for `/gsd-verify-work` and phase close. All 3 plans complete:
  - **Plan 01:** glob.ts / bash.ts hand-authored primitives + IF_PREFIX_TARGETS closed set + IfPredicate union + MATCH_ALL_IF sentinel + architecture-test scaffold.
  - **Plan 02:** HOOK_HANDLER_SCHEMA admits optional `if`; parseHooksConfig widened to generic `<P>` with CompileIfCallback; RoutingEntry.ifPredicate always-present-with-sentinel; flatten reads the parser side-Map.
  - **Plan 03 (this plan):** ifFires dispatch consult; reduceBucket insertion; REQUIREMENTS.md MATCH-03 amendment; architecture-test closure.
- **REQUIREMENTS.md MATCH-03 traceability row** stays `Pending` for now (per the plan's instruction "the flip happens when Plan 03 closes after Task 3 verification" -- this is the phase-close commit's job, NOT Plan 03 Task 3 itself).
- **Next phase (62):** `asyncRewake` registry + EXEC-05 background-spawn pattern (HOOK-06). No blockers; Plan 03 leaves no follow-up debt.

## Self-Check: PASSED

- All 4 modified files exist:
  - `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` — FOUND (contains `export function ifFires`)
  - `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` — FOUND (contains `ifFires(entry.ifPredicate`)
  - `tests/architecture/hooks-if-field.test.ts` — FOUND (0 t.todo markers; 50 tests pass)
  - `.planning/REQUIREMENTS.md` — FOUND (MATCH-03 amended with cross-tool mapping table + 3 MCP forms + substitute-cwd rule)
- All 3 task commits exist in `git log --oneline`:
  - `ca5f585` Task 1 (feat: ifFires + amend MATCH-03 atomic) — FOUND
  - `a49d034` Task 2 (feat: wire ifFires into reduceBucket) — FOUND
  - `3f44470` Task 3 (test: close architecture test) — FOUND
- `npm run check` GREEN: 2150 unit tests pass, 10 integration tests pass, 0 fails, 0 todos.
- `grep -E 'matcherFires|ifFires' extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` shows both gates present in `reduceBucket`.
- `grep -cE '\*\*MATCH-03\*\*' .planning/REQUIREMENTS.md` returns 1 (the amended paragraph).
- Comment-policy compliance across the Plan 03 diff: `grep -nE 'Phase [0-9]+|Pitfall [0-9]+|Plan [0-9]+|Wave [0-9]+|Task [0-9]+'` against the 3 modified source/test files returns 0 matches.

---

*Phase: 61-if-field-permission-rule-matcher*
*Completed: 2026-06-15*
