---
phase: 61
status: passed
score: 5/5 must-haves verified
verified: 2026-06-15
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 61: `if` Field Permission-Rule Matcher Verification Report

**Phase Goal:** A hook entry's optional `if` field narrows tool-event dispatch via Claude Code's permission-rule syntax, matching the upstream truth table verbatim with explicit fail-open on parse failure.

**Verified:** 2026-06-15
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|--------------------|--------|----------|
| 1 | Per-prefix dispatch fires correctly: `if: Bash(...)` parses subcommands and matches glob; `if: Edit(*.ts)` (and cross-tool family) matches per-tool argument path with 4 anchors; `if: mcp__server__tool` literal-matches | VERIFIED | `bridges/hooks/if-field/index.ts:356-406` `ifFires` switch with 5 arms (match-all / bash / path-tool / mcp-literal / mcp-server-prefix); architecture test blocks 14-16 exercise all 3 prefix families end-to-end through `compileIfPredicate` + `ifFires` against `HOOKS_GUIDE_TRUTH_TABLE`, `PATH_ANCHOR_TABLE`, `MCP_TABLE` |
| 2 | Bash-glob edge cases byte-for-byte: trailing-space word-boundary (`Bash(ls *)` excludes `lsof`), `:*` trailing sugar, `$()`/backtick/`$VAR` specificity-override | VERIFIED | `tests/architecture/hooks-if-field.test.ts` blocks 2 (BASH_WORD_BOUNDARY_TABLE) + block 3 (COLON_SUGAR_TABLE) + block 6 (HOOKS_GUIDE_TRUTH_TABLE with specificity-override); `bash.ts:325-365` `stripWrappers` + `WRAPPERS_WITH_ARG`; `glob.ts` `trailingWordBoundary` semantic |
| 3 | Unparseable Bash command fires hook regardless (fail-open) | VERIFIED | `if-field/index.ts:372-376` `bash` arm catches `!parsed.ok`, emits `hookDebugLog`, returns `true`; `bash.ts:109` `MAX_RECURSION_DEPTH=8` cap; test "MATCH-03 §3: ifFires fails open on unparseable Bash command" (line 1057) pins the contract |
| 4 | AND composition with `matcher` — matcher filters at group level, `if` narrows within | VERIFIED | `dispatch.ts:171-180` `reduceBucket` sequence: `matcherFires(entry) → continue` THEN `ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent) → continue` THEN `activeExecutor(entry, event, ctx)`; test "MATCH-03 §4: AND composition with matcher" (line 1015) pins the both-gates-required semantic |
| 5 | Architecture test reproduces upstream truth table verbatim; non-tool events ignore `if` | VERIFIED | `tests/architecture/hooks-if-field.test.ts` (1212 LoC) contains all 7 truth-table fixtures (HOOKS_GUIDE/BASH_WORD_BOUNDARY/COLON_SUGAR/WRAPPER/COMPOUND/PATH_ANCHOR/MCP_TABLE); 50 active tests, 0 todos; non-tool-event "A5: ifFires fires on SessionStart handler with if field" pinned (line 1178) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts` | Hand-authored glob engine (D-61-01); `CompiledBashGlob`/`CompiledPathGlob`/`GlobToken`/`PathAnchor`; `compileBashGlob`/`compilePathGlob` | VERIFIED | 17K, exists; zero new runtime deps; discriminated unions; pure-and-total |
| `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts` | Bash subcommand parser (D-61-04); `parseBashSubcommands`/`bashSubcommandFires`/`WRAPPER_STRIP` | VERIFIED | 17K; `WRAPPER_STRIP` is exactly 6 elements `["timeout","time","nice","nohup","stdbuf","xargs"]`; sibling `WRAPPERS_WITH_ARG=["timeout","nice","stdbuf"]`; quote-aware splitter; depth-cap 8 on `$()`/backtick recursion; `find` excluded → -exec opaque |
| `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` | `IfPredicate` union (5 arms), `MATCH_ALL_IF` sentinel, `compileIfPredicate`, `ifFires`, `CompileIfPredicateContext` | VERIFIED | 18K; 5-arm discriminated union with `readonly` on every field; `MATCH_ALL_IF.kind==="match-all"`; `ifFires` is total switch with `assertNever(predicate)` (NFR-7) |
| `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` | `IF_PREFIX_TARGETS` closed-set table (D-61-03) | VERIFIED | Exactly 4 entries in locked order: Bash→{bash}/command; Read→{read,grep,find,ls}/path; Edit→{edit,write}/path; Write→{write}/path; closed via `as const satisfies Record<string, IfPrefixTarget>` |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | `HOOK_HANDLER_SCHEMA` admits `if: { type: "string" }`; `required: ["type"]`; `parseHooksConfig<P>` generic with side-Map | VERIFIED | Line 110 `readonly if?: string`; line 124 `required: ["type"]`; line 132 `if: { type: "string" }`; generic `<P>` widening preserves D-11 import direction |
| `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | `RoutingEntry.ifPredicate: IfPredicate` always-present field; `flattenPluginIntoBuckets` populates from side-Map | VERIFIED | Line 99 `readonly ifPredicate: IfPredicate`; line 310 `cacheEntry.ifPredicates.get(key) ?? MATCH_ALL_IF` (referential-equality fall-open); line 467 `addPluginConfigToCache(..., result.ifPredicates)` |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` | Single-line `ifFires` consult in `reduceBucket` between matcher gate and executor | VERIFIED | Line 52 `import { ifFires }`; lines 176-180 insertion between `matcherFires` (line 172) and `activeExecutor` (line 182); on miss → `continue` (NOT block); on hit → executor |
| `tests/architecture/hooks-if-field.test.ts` | Truth-table fixtures end-to-end | VERIFIED | 51K; 50 active tests, 0 todos, all pass via `node --test tests/architecture/hooks-if-field.test.ts` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `dispatch.ts` | `if-field/index.ts` | `import { ifFires }` | WIRED | `dispatch.ts:52`; consumed at `:178` inside `reduceBucket` |
| `event-router.ts` | `if-field/index.ts` | imports `IfPredicate`, `MATCH_ALL_IF` | WIRED | populates `RoutingEntry.ifPredicate` from side-Map at `:310` |
| `hooks.ts` | `if-field/index.ts` | `CompileIfCallback<P>` generic + bridge call site wires real `compileIfPredicate` | WIRED | Domain stays D-11-clean (no upward import); bridge layer injects callback |
| `hooks.ts` | `hook-if-targets.ts` | reads `IF_PREFIX_TARGETS` (consumed inside `compileIfPredicate` in if-field/index.ts, which IS the consumer) | WIRED | `if-field/index.ts:48` imports `IF_PREFIX_TARGETS` |
| Test | `if-field/index.ts` | imports `ifFires`, `compileIfPredicate`, `MATCH_ALL_IF`, `IfPredicate` | WIRED | All 5 truth-table tables exercised end-to-end through `compileIfPredicate` + `ifFires` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `RoutingEntry.ifPredicate` | flatten loop variable | Plan 02 `parseHooksConfig<IfPredicate>` side-Map populated by `compileIfPredicate` at parse time | YES — parser side-Map keyed `${event}|${groupIdx}|${handlerIdx}`; absent keys fall to `MATCH_ALL_IF` sentinel (referential equality) | FLOWING |
| `ifFires(predicate, event, ctx, _)` | `event.input.command`, `event.input.path`, `event.toolName` | Runtime Pi tool-event payload threaded through `reduceBucket(bucket, event, ctx, matcherFires)` | YES — extractors `extractBashCommand`, `extractToolName`, `extractPath`, `resolveTarget` read with `typeof === "string"` guards; absent fields handled per D-61-02 / D-61-03 substitute-cwd | FLOWING |

### D-61 Lock-Fidelity Cross-Check (CONTEXT.md)

| Decision | Lock | Status | Evidence |
|----------|------|--------|----------|
| D-61-01 | Hand-authored glob engine; zero new runtime deps; 3 metachars + 4 anchors + Bash word-boundary | VERIFIED | `package.json` diff for phase 61 (commits `7c0aa16..HEAD`) is empty; `glob.ts` has discriminated `GlobToken=literal\|star\|globstar\|slash`, `PathAnchor=filesystem-root\|home\|project-root\|cwd\|gitignore-bare`; no `picomatch`/`minimatch`/`micromatch` references in source (only one comment in glob.ts explaining why they were rejected) |
| D-61-02 | Fail-open everywhere; every `if`-layer failure collapses to `MATCH_ALL_IF` or substitute-cwd | VERIFIED | `compileIfPredicate` has 4 try/catch fall-open arms (empty, non-tool event, Bash glob compile fail, path glob compile fail, unknown prefix); `ifFires` bash arm fails open on `!parsed.ok`; substitute-cwd applied at `index.ts:393` (`extractPath(event) ?? ctx.cwd`); no `installable: false` flips from `if`-field issues |
| D-61-03 | Upstream-faithful prefixes only (Bash/Read/Edit/Write + 3 MCP forms); cross-tool semantic | VERIFIED | `IF_PREFIX_TARGETS` keys === `["Bash","Read","Edit","Write"]` (locked); `Read.piEvents===Set("read","grep","find","ls")`; `Edit.piEvents===Set("edit","write")`; `Write.piEvents===Set("write")`; REQUIREMENTS.md MATCH-03 amendment line 31 explicitly drops Grep/Glob/LS/MultiEdit/NotebookEdit/PowerShell/WebFetch/Agent/Cd and lines 36-38 add 3 MCP forms |
| D-61-04 | Bash parser upstream-verbatim: `WRAPPER_STRIP` exact 6-element set + with-flags xargs + opaque find -exec + literal `<()`/`>()` + 6 compound separators | VERIFIED | `bash.ts:88-95` WRAPPER_STRIP exactly `["timeout","time","nice","nohup","stdbuf","xargs"]`; `WRAPPERS_WITH_ARG=["timeout","nice","stdbuf"]` (sibling for arg consumption); xargs-with-flags detection in stripWrappers; `find` deliberately absent from WRAPPER_STRIP so `find -exec ...` opaque; longest-token-first separator precedence (`&&`/`\|\|`/`\|&` before `\|`/`&`/`;`/`\n`); quote-aware split via shared `QuoteCursor` |

### Atomic-Supersession Lockstep (D-58-01 / D-61-03)

| Check | Status | Evidence |
|-------|--------|----------|
| REQUIREMENTS.md MATCH-03 amendment + ifFires source land in ONE commit | VERIFIED | `git show --stat ca5f585` shows exactly two files: `.planning/REQUIREMENTS.md` (22 lines changed) AND `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` (135 lines added) |
| Amendment text in REQUIREMENTS.md | VERIFIED | Line 31 prefix list amended; lines 32-42 add cross-tool mapping rows, fail-open extension, AND-composition; MATCH-03 traceability row at line 195 still `Pending` (correct — phase-close commit will flip per Plan 03's documented contract) |

### Anti-Pattern Scan

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

Comment-policy scan over `if-field/{glob.ts,bash.ts,index.ts}`, `hook-if-targets.ts`, `dispatch.ts`, `hooks-if-field.test.ts`: zero `Phase NN`/`Plan NN-NN`/`Wave N`/`Pitfall N`/`Task N` tokens. No `TBD`/`FIXME`/`XXX` debt markers in phase-touched source. No `placeholder`/`coming soon`/`not implemented` strings. No console.log-only stubs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Architecture test suite runs clean | `node --test tests/architecture/hooks-if-field.test.ts` | `tests 50 / pass 50 / fail 0 / todo 0 / duration 4847ms` | PASS |
| No new runtime deps in package.json | `git diff 7c0aa16..HEAD -- package.json` | empty diff | PASS |
| WRAPPER_STRIP size lock | grep on `bash.ts:88-95` | 6 elements exactly: timeout/time/nice/nohup/stdbuf/xargs | PASS |
| IF_PREFIX_TARGETS lock | grep on `hook-if-targets.ts` | Exactly 4 keys in locked order: Bash/Read/Edit/Write | PASS |
| ifFires wired in dispatch.ts | grep on `dispatch.ts` | line 52 import; line 178 consult between matcher (172) and executor (182) | PASS |
| Atomic-supersession commit | `git show --stat ca5f585` | both REQUIREMENTS.md and if-field/index.ts in single commit | PASS |

Per the orchestrator note, `npm run check` is recorded as GREEN at phase close (2150 tests pass, 0 fail, 0 todo). Not re-run by verifier per "No redundant check re-runs" memory.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| MATCH-03 | 61-01, 61-02, 61-03 (all plans) | `if` field on tool-event hook entries narrows dispatch via permission-rule syntax with upstream-faithful prefixes + cross-tool semantic + fail-open everywhere | SATISFIED | All 5 ROADMAP success criteria VERIFIED; REQUIREMENTS.md MATCH-03 amendment landed atomically in `ca5f585`; traceability row at REQUIREMENTS.md:195 still `Pending` (flip is orchestrator's phase-close commit per Plan 03 contract); architecture test 50 tests pass with 0 todos |

No orphaned requirements: only MATCH-03 is mapped to phase 61, and all three plans claim it in their `requirements` frontmatter.

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` exist for this phase, and Phase 61 PLAN/SUMMARY make no probe declarations. Skipped.

### Human Verification Required

(none)

Phase 61 is a pure-data-path implementation with comprehensive architecture-test coverage matching the disposition of Phases 57-60. No external services, no UI surface, no runtime behavior outside the in-process dispatch loop. The architecture test exercises every truth-table row end-to-end through `compileIfPredicate` + `ifFires`. No human verification is required.

### Gaps Summary

(none) — all 5 ROADMAP success criteria verified; all 4 D-61 locks honored; atomic-supersession satisfied; quality bar green; comment policy clean; zero new runtime deps.

---

*Verified: 2026-06-15*
*Verifier: Claude (gsd-verifier)*
