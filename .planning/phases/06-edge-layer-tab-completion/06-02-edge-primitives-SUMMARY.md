---
phase: 06-edge-layer-tab-completion
plan: 02

subsystem: edge
tags: [edge-layer, parser, router, completions, persistence, wave-1, ap-1, ap-2, ap-3, ap-4, tc-2, tc-7, d-03, d-04]

# Dependency graph
requires:
  - phase: 06-edge-layer-tab-completion
    plan: 01
    provides: "18 skipped test stubs across tests/edge/** + tests/shared/completion-cache.test.ts (Wave 0 Nyquist gate). This plan unskips args, args-schema, router, and normalize."
provides:
  - "edge/args.ts: AP-1 tokenizer + AP-2 / AP-4 --scope validator (parseArgs + ParsedArgs)."
  - "edge/args-schema.ts: parseCommandArgs schema-driven positional validator (PositionalSpec + ParsedCommandArgs<Spec>)."
  - "edge/router.ts: routeClaudePlugin + routeMarketplace dispatch with TOP_LEVEL_USAGE + MARKETPLACE_USAGE (AP-3) and SubcommandHandlers map type. Direct Pi-context notify replaced with notifyUsageError (ESLint BLOCK A + notify-discipline grep gate)."
  - "edge/types.ts: EdgeDeps interface (D-04 injection surface: gitOps + pluginUpdate) plus SubcommandHandlers re-export for single-import-surface ergonomics."
  - "edge/completions/normalize.ts: TC-7 normalizeCompletionWhitespace + isClaudePluginCommandLine + CLAUDE_PLUGIN_LINE regex (collision-suffix tolerant)."
  - "persistence/locations.ts: cacheDir + marketplaceNamesCacheFile readonly properties on ScopedLocations + async pluginCacheFile(marketplace) method (D-03 cache path helpers)."
affects: [06-03-completions-provider-cache, 06-04-edge-handlers, 06-05-register-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verbatim V1 port + targeted refinements: tokenizer + schema validator + completion normalizer + dispatch router carry across unchanged except for (a) Scope import re-anchored to shared/types.ts (Phase 2 carry-forward), and (b) every direct Pi-context notify call in the router replaced with notifyUsageError(ctx, message, usageBlock) per D-07."
    - "Notify-discipline grep gate: per Plan 06-02 Task 2 verify, the literal Pi-context notify expression must not appear in router.ts. The plan's grep (`grep -v '^#'`) does not exclude TypeScript line comments, so even comments mentioning the forbidden expression trip the gate. The docstring at the top of router.ts paraphrases the rule to avoid the literal string while preserving the intent."
    - "EdgeDeps single-import surface: `edge/types.ts` re-exports `SubcommandHandlers` from `./router.ts` so consumers can `import type { EdgeDeps, SubcommandHandlers } from \"./types.ts\"` without two import lines."
    - "Defense-in-depth path containment for D-03 cache files: `pluginCacheFile(marketplace)` mirrors `pluginDataDir`'s pattern -- `assertSafeName` upstream rejects every separator-bearing / control-char / empty / `.` / `..` input regardless of the downstream `assertPathInside` check."

key-files:
  created:
    - "extensions/pi-claude-marketplace/edge/args.ts"
    - "extensions/pi-claude-marketplace/edge/args-schema.ts"
    - "extensions/pi-claude-marketplace/edge/router.ts"
    - "extensions/pi-claude-marketplace/edge/types.ts"
    - "extensions/pi-claude-marketplace/edge/completions/normalize.ts"
  modified:
    - "extensions/pi-claude-marketplace/persistence/locations.ts"
    - "tests/edge/args.test.ts"
    - "tests/edge/args-schema.test.ts"
    - "tests/edge/router.test.ts"
    - "tests/edge/completions/normalize.test.ts"
    - "tests/persistence/locations.test.ts"

key-decisions:
  - "Notify-discipline gate must not trip on docstring references: the plan's `grep -v '^#'` filter only strips shell-style comment lines; TypeScript `//` comments still match. Rewrote the router.ts file-level docstring to paraphrase 'direct Pi-context notify' without using the literal `ctx.ui.notify` substring. ESLint BLOCK A (`no-restricted-syntax`) is the actual enforcement; the grep is a fast-feedback canary."
  - "args-schema.ts injects notifyError as a callback parameter (not an import). The caller (handler) constructs the closure that wraps the canonical `notifyError(ctx, ...)` from `shared/notify.ts`. This keeps args-schema independent of `ExtensionContext` and lets tests inject a plain spy."
  - "Verbatim port from V1 -- AP-1 tokenizer remains escape-free (single + double quotes only, no `\\`/`\\n` interpretation, no quote nesting). This is the PRD §11 V1-locked baseline (deferred change)."
  - "EdgeDeps interface placed in `edge/types.ts` rather than `edge/router.ts` so router stays focused on dispatch and the injection surface lives next to other type-only surfaces consumers will import together."

patterns-established:
  - "Wave 1 V1-port pattern: read the V1 source (`git show features/initial:...`), copy verbatim into the new path, refactor only import anchors (Scope to shared/types.ts, notify to shared/notify.ts wrappers, parseArgs to ./args.ts), unskip the matching Wave 0 stubs."
  - "Wave 0 -> Wave 1 mechanical transition: in each test file, (a) remove the `@ts-expect-error` directive, (b) remove the `import type * as _target ...` line + the `export type _TargetShape = typeof _target;` line + the file-level `/* eslint-disable @typescript-eslint/no-empty-function */`, (c) replace every `test.skip(name, () => {})` with `test(name, () => { ... })` containing real assertions. Plan 06-01 designed this transition; this plan executed it for 4 files."

requirements-completed: [AP-1, AP-2, AP-3, AP-4, TC-2, TC-7]

# Metrics
duration: ~22min
completed: 2026-05-11
---

# Phase 6 Plan 02: Edge Primitives Summary

**Five new edge-layer modules (`args`, `args-schema`, `router`, `types`, `completions/normalize`) plus three new `ScopedLocations` cache-path helpers ported verbatim from V1 with notify-discipline refinements, unskipping 42 Wave-0 test stubs and adding 8 new locations assertions -- `npm run check` exits 0 with 676 pass + 118 skip + 0 fail.**

## Performance

- **Started:** 2026-05-11T14:16:04Z
- **Completed:** 2026-05-11T14:38:24Z
- **Duration:** ~22 minutes
- **Tasks:** 3 / 3
- **Files created:** 5
- **Files modified:** 6

## Task Commits

Each task was committed atomically:

1. **Task 1: port edge/args.ts + args-schema.ts (AP-1/2/4)** -- `9e10c78` (feat)
2. **Task 2: port edge router + types + normalize (AP-3 TC-2 TC-7)** -- `a8179d4` (feat)
3. **Task 3: extend ScopedLocations with cache path helpers (D-03)** -- `2fde048` (feat)

## Accomplishments

### Verbatim V1 Ports vs. Refinements

| File | V1 source | Refinement applied |
|------|-----------|--------------------|
| `edge/args.ts` | `args.ts` | Imported `Scope` from `shared/types.ts` (was `./types.ts`). Body unchanged. |
| `edge/args-schema.ts` | `commands/_args.ts` | Imported `parseArgs` from `./args.ts`, `errorMessage` from `../shared/errors.ts`, `Scope` from `../shared/types.ts`. Body unchanged. |
| `edge/router.ts` | `commands/router.ts` | Replaced every `ctx.ui.notify(message, "error")` call with `notifyUsageError(ctx, message, usageBlock)` (one of two refinements). Imported `notifyUsageError` from `../shared/notify.ts`. Empty-input case now emits `"Usage error.\n\n<TOP_LEVEL_USAGE>"`; unknown-subcommand emits `'Unknown subcommand: "X".\n\n<TOP_LEVEL_USAGE>'`. |
| `edge/completions/normalize.ts` | `completions.ts` (`normalizeCompletionWhitespace` + `isClaudePluginCommandLine` + `CLAUDE_PLUGIN_LINE`) | None; verbatim. The other V1 completion helpers (`buildItem`, `splitCompletionInput`, `extractPositionals`, `getPluginRefCompletions`, ...) move to `edge/completions/provider.ts` in Plan 06-03. |
| `edge/types.ts` | (new) | New file -- `EdgeDeps` interface per D-04 + re-export of `SubcommandHandlers` from `./router.ts`. |
| `persistence/locations.ts` | extends Phase 2's `ScopedLocations` | New readonly fields `cacheDir`, `marketplaceNamesCacheFile`, and new async method `pluginCacheFile(marketplace)` mirroring `pluginDataDir`'s assertSafeName + assertPathInside pattern. |

### Decision-ID Traceability

| Decision / REQ-ID | File | Where it surfaces |
|-------------------|------|-------------------|
| AP-1 (tokenizer) | `edge/args.ts` | `tokenize()` body -- single + double quote handling, no escapes. Asserted by 5 unskipped tests in `tests/edge/args.test.ts`. |
| AP-2 (--scope validation) | `edge/args.ts` | `parseArgs` --scope branch -- valid `user`/`project`, missing value throws "requires a value", invalid value throws "Invalid --scope value". Asserted by 4 unskipped tests. |
| AP-3 (Usage block on empty/unknown) | `edge/router.ts` | `routeClaudePlugin` empty-head + default branch; `routeMarketplace` empty-head + default branch -- all routed through `notifyUsageError`. Asserted by 4 unskipped tests in `tests/edge/router.test.ts`. |
| AP-4 (--scope at any position) | `edge/args.ts` | `parseArgs` loop scans every token; `--scope` pair recoverable at positions 0, middle, end. Asserted by 4 unskipped tests. |
| TC-2 router slice (rm alias) | `edge/router.ts` | `routeMarketplace` `case "remove": case "rm":` fall-through. Asserted by the dedicated rm-alias test. |
| TC-7 (whitespace normalize + line regex) | `edge/completions/normalize.ts` | `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` + `CLAUDE_PLUGIN_LINE`. Asserted by 10 unskipped tests in `tests/edge/completions/normalize.test.ts`. |
| D-04 (EdgeDeps placement) | `edge/types.ts` | `EdgeDeps` interface with `gitOps: GitOps` + `pluginUpdate: PluginUpdateFn`, both imported across the `edge -> orchestrators` boundary allowed by Phase 1 D-11. |
| D-03 (cache path helpers) | `persistence/locations.ts` | `cacheDir` + `marketplaceNamesCacheFile` + `pluginCacheFile(marketplace)` -- Plan 06-03's `shared/completion-cache.ts` consumes via its public API. |

### Notify-Discipline Checkpoints

The Phase 6 router must surface AP-3 Usage blocks via the canonical `notifyUsageError` wrapper; direct calls to the Pi-context `ui.notify` are forbidden in `edge/`. Two checkpoints enforce this:

1. **Plan-level grep gate (Task 2 verify):** `grep -v '^#' extensions/pi-claude-marketplace/edge/router.ts | grep -c 'ctx\.ui\.notify' | grep -qx 0`. Counts substring occurrences (not call-expressions) so it is conservative -- ANY mention of the literal, including in docstrings, trips the gate. Result: **0 occurrences after the docstring rewrite (see Deviation 1).**
2. **ESLint BLOCK A (`eslint.config.js`):** `no-restricted-syntax` AST selector `CallExpression[callee.property.name='notify'][callee.object.property.name='ui']` makes any actual call-expression on `*.ui.notify` an ESLint error in `extensions/pi-claude-marketplace/**/*.ts` outside the per-file BLOCK B override for `shared/notify.ts`. Result: **`npx eslint extensions/pi-claude-marketplace/edge/router.ts` reports 0 errors.**

Both gates pass.

## Test Counts

Baseline before this plan (Wave 0 / Plan 06-01 output):

```
ℹ tests 786
ℹ pass 626
ℹ fail 0
ℹ skipped 160
```

After this plan:

```
ℹ tests 794   (+8 new locations.test.ts assertions)
ℹ pass 676    (+50 transitioned/new)
ℹ fail 0
ℹ skipped 118 (-42 unskipped)
```

Breakdown of the +50 passing delta:

| File | New / Unskipped | Count |
|------|-----------------|-------|
| `tests/edge/args.test.ts` | 13 unskipped | 13 |
| `tests/edge/args-schema.test.ts` | 4 unskipped | 4 |
| `tests/edge/router.test.ts` | 15 unskipped | 15 |
| `tests/edge/completions/normalize.test.ts` | 10 unskipped | 10 |
| `tests/persistence/locations.test.ts` | 8 new D-03 assertions | 8 |
| **Total** | | **50** |

Plan claimed "roughly 36+ tests transitioned from skipped to passing." Actual unskip count is **42**; the additional 8 are new D-03 cache-path assertions added per Task 3's optional smoke-test instruction (the plan said "If `tests/persistence/locations.test.ts` exists, add three small assertions"; that file did exist, so 8 assertions were added covering happy path, layout, frozen-property invariant, and three failure modes).

## REQ-ID Coverage Matrix

| REQ-ID | Asserted by | Count |
|--------|-------------|-------|
| AP-1 | `tests/edge/args.test.ts` (5) | 5 |
| AP-2 | `tests/edge/args.test.ts` (4) | 4 |
| AP-3 | `tests/edge/router.test.ts` (4) | 4 |
| AP-4 | `tests/edge/args.test.ts` (4) | 4 |
| TC-2 (router rm-alias slice) | `tests/edge/router.test.ts` (1 dedicated + 10 dispatch) | 1 + 10 |
| TC-7 | `tests/edge/completions/normalize.test.ts` (10) | 10 |
| D-03 (cache path helpers) | `tests/persistence/locations.test.ts` (8) | 8 |
| D-04 (EdgeDeps) | covered structurally by typecheck pass; behavior tested indirectly via router dispatch | -- |

## Files Created/Modified

**Created (5):**

- `extensions/pi-claude-marketplace/edge/args.ts`
- `extensions/pi-claude-marketplace/edge/args-schema.ts`
- `extensions/pi-claude-marketplace/edge/router.ts`
- `extensions/pi-claude-marketplace/edge/types.ts`
- `extensions/pi-claude-marketplace/edge/completions/normalize.ts`

**Modified (6):**

- `extensions/pi-claude-marketplace/persistence/locations.ts` (cacheDir, marketplaceNamesCacheFile, pluginCacheFile additions)
- `tests/edge/args.test.ts` (Wave 0 stub -> Wave 1 implementation)
- `tests/edge/args-schema.test.ts` (Wave 0 stub -> Wave 1 implementation)
- `tests/edge/router.test.ts` (Wave 0 stub -> Wave 1 implementation)
- `tests/edge/completions/normalize.test.ts` (Wave 0 stub -> Wave 1 implementation)
- `tests/persistence/locations.test.ts` (8 new D-03 assertions appended)

## Decisions Made

1. **Notify-discipline grep gate vs. docstring documentation.** The plan's notify-discipline gate uses `grep -v '^#'` to filter comments, but TypeScript line comments start with `//`, not `#`. So even a comment that paraphrases or references the forbidden expression trips the substring check. The intent of the gate is clearly "no direct call expressions" -- enforced statically by ESLint BLOCK A. To preserve the plan's grep contract verbatim and avoid future executors hitting the same false positive, I rewrote the file-level docstring at the top of `edge/router.ts` to paraphrase the rule (`"Direct Pi notify calls are replaced with notifyUsageError(...)..."`, `"ESLint BLOCK A ... forbids direct notify on the Pi context"`) without using the literal `ctx.ui.notify` substring. The ESLint rule is the load-bearing enforcement; the grep is fast-feedback.

2. **Empty-input usage message wording.** V1's router emitted `"<TOP_LEVEL_USAGE>"` raw on empty input (no leading message). `notifyUsageError(ctx, message, usageBlock)` requires a leading `message` argument -- it emits `"${message}\n\n${usageBlock}"`. The plan instructed `notifyUsageError(ctx, "Usage error.", TOP_LEVEL_USAGE)` for the empty case, so the surfaced text is now `"Usage error.\n\n<TOP_LEVEL_USAGE>"`. This is a deliberate Phase 6 refinement over V1's wording -- consistent with the `notifyUsageError` contract (Phase 1 D-07 commits to the blank-line separator as part of the user contract).

3. **Test arg-schema schema literal.** TypeScript's `as const` plus `satisfies readonly PositionalSpec[]` is the V1-compatible idiom that preserves both the literal types (so `parseCommandArgs<Spec>` infers per-field discriminated optionality) and the strict-mode lint compliance. The test file uses this form consistently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Router docstring contains literal `ctx.ui.notify` substring, tripping notify-discipline grep gate**

- **Found during:** Task 2 verification.
- **Issue:** Plan's Task 2 grep gate (`grep -v '^#' extensions/pi-claude-marketplace/edge/router.ts | grep -c 'ctx\.ui\.notify' | grep -qx 0`) reported 2 matches even though the file contains zero call expressions. The matches are in the file-level docstring at lines 6 and 9, which mention the forbidden expression to document the rule. The plan's filter only excludes shell-style `#` comments, not TypeScript `//` comments.
- **Fix:** Rewrote the docstring to paraphrase the rule without using the literal `ctx.ui.notify` substring. The exact wording: `"Direct Pi notify calls are replaced with notifyUsageError(...)..."` and `"ESLint BLOCK A ... forbids direct notify on the Pi context"`. ESLint BLOCK A is the load-bearing enforcement; this preserves the plan's grep invariant verbatim. Self-removing once the verifier learns to skip TS comments.
- **Files affected:** `extensions/pi-claude-marketplace/edge/router.ts` only.
- **Verification:** `grep -v '^#' extensions/pi-claude-marketplace/edge/router.ts | grep -c 'ctx\.ui\.notify'` -> 0; `npx eslint .../router.ts` -> 0 errors.
- **Committed in:** `a8179d4` (Task 2).

**2. [Rule 1 - Bug] Initial test handler factory `async (args: string) => {}` tripped @typescript-eslint/require-await**

- **Found during:** Task 2 ESLint run.
- **Issue:** First draft of `tests/edge/router.test.ts` defined the handler-spy factory as `const mk = (name) => async (args) => { calls.push(...) };`. The handler body has no `await`, which `@typescript-eslint/require-await` flags. Also tripped `@stylistic/padding-line-between-statements` due to no blank line between the assignment and the next statement.
- **Fix:** Rewrote the factory to return `(args): Promise<void> => { calls.push(...); return Promise.resolve(); }` (explicit Promise return instead of async-keyword), and added a blank line before the next const. Functionally identical -- `SubcommandHandlers` only requires the function to return `Promise<void>`; the async keyword was syntactic sugar that lost its value when no `await` appeared.
- **Files affected:** `tests/edge/router.test.ts` only.
- **Verification:** `npx eslint tests/edge/router.test.ts` -> 0 errors.
- **Committed in:** `a8179d4` (Task 2).

**3. [Rule 3 - Blocking] Commit message title length cap (gitlint 72-char limit)**

- **Found during:** Task 1 first commit attempt.
- **Issue:** Initial commit title `"feat(06-02): port edge/args.ts + edge/args-schema.ts; unskip AP-1/2/4 tests"` was 75 chars, tripping gitlint's `T1 Title exceeds max length (75>72)`. Pre-commit hook ran on the commit (NOT the pre-message hook, so the commit was rejected after the file hooks passed). Body was multi-line and clean.
- **Fix:** Shortened title to `"feat(06-02): port edge/args.ts + args-schema.ts (AP-1/2/4)"` (58 chars). Same semantic content; the conjunction "edge/args.ts + edge/args-schema.ts" reduced to "edge/args.ts + args-schema.ts" (the trailing path is clear in context) and the trailing "unskip ... tests" removed (already implied by the bullet list in the body).
- **Files affected:** None (commit-message-only).
- **Verification:** Subsequent commit (`9e10c78`) passed gitlint cleanly.

**4. [Rule 3 - Blocking] Prettier auto-reformatted test files after creation**

- **Found during:** Task 1 + Task 2 verification runs.
- **Issue:** Two test files (`tests/edge/args.test.ts`, `tests/edge/args-schema.test.ts`, `tests/edge/router.test.ts`) were created with formatting that prettier wanted to normalize (specifically: tests with long argument tuples were folded onto more lines, and inline `as const satisfies readonly PositionalSpec[]` was reformatted).
- **Fix:** Ran `npx prettier --write` on each file. Prettier's output is the canonical format; no semantic change.
- **Files affected:** `tests/edge/args.test.ts`, `tests/edge/args-schema.test.ts`, `tests/edge/router.test.ts`.
- **Verification:** `npx prettier --check ...` -> clean.

---

**Total deviations:** 4 (all Rule 1 / Rule 3 -- minor tooling-compliance fixes).
**Impact on plan:** All four deviations are mechanical / scoped to single files; none change the plan's user contract or the V1 carry-forward semantics. The notify-discipline gate, ESLint BLOCK A, and `npm run check` all pass cleanly after the fixes.

## Issues Encountered

- **Plan's notify-discipline grep filter is fragile:** `grep -v '^#'` excludes shell-style `#` comments but not TypeScript `//` comments. Any future executor working in TypeScript will hit the same false positive if their docstring mentions the forbidden expression. ESLint BLOCK A is the durable check; the grep is a fast-feedback canary. Consider documenting in 06-CONTEXT that docstrings should paraphrase, not quote, the forbidden expression.
- **`gitlint` T1 title length cap (72) is tighter than the conventional-commits 75-char guideline.** Future executors writing feat-port commits should keep titles short by truncating the scope detail to one file name.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - no new threat surface introduced beyond the plan's `<threat_model>` (T-EDGE-2 and T-EDGE-5b are mitigated inline by the existing assertSafeName + assertPathInside pattern that this plan re-applies to `pluginCacheFile`).

## Next Phase / Plan Readiness

- **Plan 06-03 (completions provider + cache):** Consumes `cacheDir`, `marketplaceNamesCacheFile`, `pluginCacheFile` from `persistence/locations.ts`. Consumes `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` from `edge/completions/normalize.ts`. The remaining V1 completion helpers (`buildItem`, `splitCompletionInput`, `extractPositionals`, `getPluginRefCompletions`, ...) move into `edge/completions/provider.ts` per the 06-CONTEXT layout.
- **Plan 06-04 (edge handlers):** Consumes `SubcommandHandlers` from `edge/router.ts` (re-exported via `edge/types.ts`) and the `parseCommandArgs` validator from `edge/args-schema.ts`.
- **Plan 06-05 (register wiring):** Consumes `routeClaudePlugin` from `edge/router.ts`, `EdgeDeps` from `edge/types.ts`, and `isClaudePluginCommandLine` + `normalizeCompletionWhitespace` from `edge/completions/normalize.ts` to wire the `session_start` autocomplete post-processor.

## Self-Check: PASSED

All 5 created files verified present:

- extensions/pi-claude-marketplace/edge/args.ts -- FOUND
- extensions/pi-claude-marketplace/edge/args-schema.ts -- FOUND
- extensions/pi-claude-marketplace/edge/router.ts -- FOUND
- extensions/pi-claude-marketplace/edge/types.ts -- FOUND
- extensions/pi-claude-marketplace/edge/completions/normalize.ts -- FOUND

Modified file extends ScopedLocations:

- extensions/pi-claude-marketplace/persistence/locations.ts: contains `cacheDir` (8 refs), `pluginCacheFile` (4 refs), `marketplaceNamesCacheFile` (3 refs) -- FOUND

Notify-discipline gate:

- `grep -v '^#' extensions/pi-claude-marketplace/edge/router.ts | grep -c 'ctx\.ui\.notify'` -> 0 -- PASS

All three task commits verified in git log:

- 9e10c78 (Task 1: port edge/args.ts + args-schema.ts (AP-1/2/4)) -- FOUND
- a8179d4 (Task 2: port edge router + types + normalize (AP-3 TC-2 TC-7)) -- FOUND
- 2fde048 (Task 3: extend ScopedLocations with cache path helpers (D-03)) -- FOUND

`npm run check` exit code: 0 (typecheck + ESLint + Prettier + node:test all green).

---
*Phase: 06-edge-layer-tab-completion*
*Plan: 02-edge-primitives*
*Completed: 2026-05-11*
