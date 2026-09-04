# Phase 109: Shared Contracts - Research

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Milestone test contract carried forward

- **D-01:** Normalize all 19 Phase 109 owner tests, including tests whose accepted-HEAD
  triage already passes focused coverage. A passing brownfield test is input, not evidence
  that the pair satisfies v1.19.
- **D-02:** Every runtime case created or modified in this phase uses exact lowercase
  `// arrange`, `// act`, and `// assert` comments in that order, with the canonical blank
  lines. Lowercase `// act & assert` is limited to one `assert.throws()` or
  `assert.rejects()` expression. Data rows use separate phases.
- **D-03:** Type-only evidence uses positive `satisfies` checks and negative
  `@ts-expect-error` checks without artificial runtime cases or phase comments.
- **D-04:** Each case owns and restores its filesystem, environment, cache, console,
  notification, timer, mock, and other mutable state. Use current public seams and
  concern-local support; do not add a generic helper directory or test-only production
  state.

### Notification suite consolidation

- **D-05:** Consolidate the distinct public contracts in the legacy shared notification
  suites into the mirrored owner tests and delete the absorbed legacy suites. Do not add
  correspondence-gate exceptions for them. — **Reversibility:** costly — Reversing this
  would restore unexpected legacy suites and weaken the one-source-to-one-owner structure
  across a large public rendering surface.
- **D-06:** Split cases that currently exercise `notify-context.ts` and `notify.ts`
  together according to the module that owns the contract. `notify-context.test.ts` owns
  dispatch behavior through controlled renderers; `notify.test.ts` owns exact rendered
  bytes. Do not preserve or duplicate the old cross-module cases merely as supplemental
  tests.
- **D-07:** Express the large `notify.ts` output matrix as named data rows grouped by
  public status. Every row carries an expected full byte string independent of production
  constants and computations, and every runtime row follows the separate lowercase
  arrange/act/assert phase contract.
- **D-08:** Preserve every distinct public behavior represented by the legacy suites, but
  remove cases that only duplicate an already-proved contract. Remove migration history,
  relocation notes, and work-session commentary while retaining durable product and spec
  identifiers that still explain the contract.

### the agent's Discretion

- Choose the exact section ordering, local data-row shapes, and case names inside each
  mirrored owner test while keeping case titles behavior-focused and expected values
  independent from production code.
- Choose the precise legacy-case-to-owner mapping when a test file contains several
  concerns, provided each distinct public contract survives under the production module
  that owns it and no duplicate supplemental copy remains.
- Make behavior-preserving internal production refactors only where an existing public
  seam cannot provide complete direct coverage, and follow `DES-01` through `DES-03`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                | Research Support                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOD-02                | “All 19 shared-contract pairs complete the pair contract.” | The pair matrix below identifies the public contract, accepted-HEAD condition, direct-coverage gap, state boundary, and focused verification for every P109 pair. [VERIFIED: .planning/REQUIREMENTS.md:87-93,183-205] |
| </phase_requirements> |

**Researched:** 2026-08-29
**Domain:** Hermetic TypeScript unit contracts for shared values, errors, filesystem/cache behavior, environment effects, and notification rendering
**Confidence:** HIGH for repository findings; MEDIUM for official language/runtime documentation

## Summary

Phase 109 should remain nineteen atomic source/owner-test plans. The accepted inventory contains exactly five `PASS`, six `COVERAGE_FAIL`, and eight `MISSING` owner pairs; D-01 means all nineteen still require guideline normalization and fresh evidence. [VERIFIED: .planning/REQUIREMENTS.md:183-205; focused direct-coverage audit, 2026-08-29] The phase gate is not merely aggregate test success: every owner must directly import its source, each runtime case must follow the lowercase three-phase contract, and each source must independently reach 100% functions, lines, and branches. [VERIFIED: .planning/REQUIREMENTS.md:12-25,29-55; .claude/rules/typescript-unit-testing.md:24-42]

The only cross-plan dependency cluster is notification ownership. Build the pure `hooks`, `soft-dep`, `notify-reasons`, and controlled-renderer `notify-context` owners before the central `notify` owner; then make P109-14 the consolidation carrier that deletes the seven absorbed legacy notification suites after every distinct contract has a new owner. [VERIFIED: 109-CONTEXT.md:37-67,108-148; codebase/CodeGraph notification call-path audit, 2026-08-29] All other pairs can be planned in independent waves because their required mutable state is local to a test process, a case-owned temporary directory, a case-owned environment restore, or unique cache keys. [VERIFIED: .claude/rules/typescript-unit-testing.md:182-229; source audit, 2026-08-29]

**Primary recommendation:** Plan one pair per commit, put P109-14 after P109-03/04/12/13, and require focused owner execution plus focused direct coverage in every plan before the final `npm run check` phase gate. [VERIFIED: .planning/ROADMAP.md:114-151; package.json:75-95]

## Project Constraints (from AGENTS.md and CLAUDE.md)

- Because `.codegraph/` exists, use `codegraph explore "<specific symbol or question>"` before grep, find, or direct source reads when locating or understanding code. [VERIFIED: AGENTS.md:1-13; .claude/CLAUDE.md project instructions]
- Preserve unrelated worktree changes; Phase 109 plans own only their named source/owner-test pair, plus explicitly mapped legacy-suite deletions in P109-14. [VERIFIED: .planning/ROADMAP.md:129-151; 109-CONTEXT.md:39-67]
- Use `node:test`, `node:assert/strict`, current-test-context `t.mock`, and `strong-mock` for strict public interactions. Do not add another runner, assertion library, or mocking library, and do not import process-wide `mock` from `node:test`. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-22]
- Tests must use independent `test()` cases, behavior titles, lowercase phase comments, whole-value assertions, independent expected values, and case-owned cleanup. [VERIFIED: .claude/rules/typescript-unit-testing.md:34-52,89-109,151-188]
- Use real case-owned temporary filesystems for path/byte behavior. Do not introduce a generic helper directory or production test seam. [VERIFIED: .claude/rules/typescript-unit-testing.md:190-223; 109-CONTEXT.md:23-35]

## Architectural Responsibility Map

| Capability                                                              | Primary Tier                    | Secondary Tier                   | Rationale                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closed values, errors, classifiers, and pure format helpers             | API / Backend shared contract   | TypeScript compile-time contract | These exports are consumed across domain, persistence, transaction, bridge, and edge tiers, while type-only evidence is enforced by `tsc`. [VERIFIED: extensions/pi-claude-marketplace/shared/types.ts:1-19; CodeGraph caller audit, 2026-08-29]               |
| Atomic JSON, filesystem cleanup, path containment, and completion cache | Database / Storage boundary     | API / Backend                    | These modules own filesystem bytes, cache schemas, path validation, cleanup, and invalidation behavior. [VERIFIED: extensions/pi-claude-marketplace/shared/atomic-json.ts:24-30; completion-cache.ts:65-145,383-439; fs-utils.ts:40-313; path-safety.ts:9-147] |
| Notification reasons and byte rendering                                 | API / Backend presentation seam | Host UI                          | Shared code reduces command intent to exact Pi notification bytes and severity; later command consumers remain outside this phase. [VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:95-202,268-315,458-592,1605-1721; notify-context.ts:1-338]     |
| Environment projection and debug output                                 | OS process boundary             | API / Backend                    | `session-env.ts` projects/mutates process environment and `debug-log.ts` conditionally writes `console.error`. [VERIFIED: session-env.ts:37-70,94-127; debug-log.ts:22-25]                                                                                     |
| Owner tests and direct coverage                                         | Test / verification tier        | All tiers above                  | One mirrored owner provides direct public-contract evidence for each production module. [VERIFIED: .planning/REQUIREMENTS.md:12-25,50-55,183-205]                                                                                                              |

Primary data flow for the phase: [VERIFIED: CodeGraph call-path audit and source reads, 2026-08-29]

```text
command/domain caller input
        |
        +--> pure shared classifier/value/error -----------------> exact value or typed error
        |
        +--> shared filesystem/cache/path boundary --------------> file bytes / cache state / failure
        |
        +--> notify-context controlled dispatch
                 |
                 +--> selected renderer --> notify exact grammar --> Pi notify(msg, severity)
                 +--> missing render arm -------------------------> deterministic fallback row

mirrored owner test --> direct import --> isolated public call --> exact result/state assertion
                                            |
                                            +--> focused direct coverage: 100/100/100
```

## Exact In-Repository Contract Registry

The following verbatim values are the planner's source of truth. Do not reconstruct them from memory or from nearby consumers.

DATA_V8R3C1QZ_START
`Scope = "user" | "project"`; `SCOPES = ["user", "project"] as const`; “The Claude Code `local` scope is intentionally NOT introduced.”
DATA_V8R3C1QZ_END
[VERIFIED: extensions/pi-claude-marketplace/shared/types.ts:7-19]

DATA_4TK9N2LP_START
`EXTENSION_VERSION = "0.17.0"`
`RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"`
`STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for"`
DATA_4TK9N2LP_END
[VERIFIED: extensions/pi-claude-marketplace/shared/extension-version.ts:13-16; markers.ts:9-24]

DATA_H6P1W9AX_START
`Dependency = "agents" | "mcp"`
`SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents"`
`SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp"`
Canonical output order: “agents before mcp”.
DATA_H6P1W9AX_END
[VERIFIED: extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts:25-59]

DATA_K2M7D4SF_START
`ClaudeHookEvent = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PreCompact" | "PostCompact" | "SessionEnd" | "Stop" | "StopFailure"`
`ToolEvent = "PreToolUse" | "PostToolUse" | "PostToolUseFailure"`
`HookSummaryEntry = { readonly event: ToolEvent; readonly matcher: string } | { readonly event: Exclude<ClaudeHookEvent, ToolEvent> } | { readonly kind: "lenient"; readonly event: string; readonly supported: boolean; readonly matcher?: string }`
Runtime indentation literals: `"    hooks:"`, `` `      ${entry.event}(${entry.matcher})` ``, and `` `      ${entry.event}` ``.
DATA_K2M7D4SF_END
[VERIFIED: extensions/pi-claude-marketplace/shared/concerns/hooks.ts:57-91,109-128]

DATA_J5B8Q3NV_START
Completion cache schema versions: marketplace names `2`; plugin index `6`.
Plugin index statuses: `"installed"`, `"upgradable"`, `"partially-installed"`, `"partially-installed-upgradable"`, `"partially-upgradable"`, `"available"`, `"partially-available"`, `"unavailable"`, `"remote"`.
TTL expression: `10 * 60 * 1000`.
Existing public whole-cache operation: `resetCompletionCache()` clears `memMarketplaceNames` and `memPluginIndex`.
DATA_J5B8Q3NV_END
[VERIFIED: extensions/pi-claude-marketplace/shared/completion-cache.ts:65-145,426-439]

DATA_R9C4X7MU_START
Session projection keys and fixed value: `CLAUDECODE: "1"`, `CLAUDE_CODE_SESSION_ID: sessionId`, `CLAUDE_SESSION_ID: sessionId`.
PATH ledger key: `PATH_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_PATH"`.
Debug gate and effect: `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"`; default tag `"hooks"`; `console.error(`[${tag}] ${detail}`)`.
DATA_R9C4X7MU_END
[VERIFIED: extensions/pi-claude-marketplace/shared/session-env.ts:37-70; debug-log.ts:22-25]

DATA_3YL6F2QD_START
`ClaudePluginVars` fields: `pluginRoot`, `pluginData`, optional `skillDir`, optional `projectDir`.
Token map: `CLAUDE_PLUGIN_ROOT -> pluginRoot`, `CLAUDE_PLUGIN_DATA -> pluginData`, `CLAUDE_SKILL_DIR -> skillDir`, `CLAUDE_PROJECT_DIR -> projectDir`.
Undefined values return the matched literal unchanged; replacement is single-pass.
DATA_3YL6F2QD_END
[VERIFIED: extensions/pi-claude-marketplace/shared/vars.ts:20-72]

DATA_6FU1Z8KR_START
Plugin statuses: `"installed"`, `"updated"`, `"reinstalled"`, `"uninstalled"`, `"available"`, `"unavailable"`, `"upgradable"`, `"failed"`, `"skipped"`, `"manual recovery"`, `"will install"`, `"will uninstall"`, `"will enable"`, `"will disable"`, `"disabled"`, `"partially-installed"`, `"partially-upgradable"`, `"partially-available"`, `"remote"`.
Marketplace statuses: `"added"`, `"removed"`, `"updated"`, `"failed"`, `"autoupdate enabled"`, `"autoupdate disabled"`, `"skipped"`.
Severity: `"info" | "warning" | "error"`.
Glyphs: installed `"●"`, available `"○"`, uninstallable `"⊘"`, disabled `"◍"`, remote `"◌"`, partially-installed `"◉"`, partially-available `"⊖"`.
DATA_6FU1Z8KR_END
[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:458-518,587-592,1674-1721]

DATA_A4S7P9HE_START
Shared notification reasons: `"up-to-date"`, `"not found"`, `"already installed"`, `"not installed"`, `"not in manifest"`, `"invalid manifest"`, `"no longer installable"`, `"unsupported source"`, `"unsupported component"`, `"unsupported hooks"`, `"lsp"`, `"requires pi-subagents"`, `"requires pi-mcp"`, `"rollback partial"`, `"unreadable"`, `"unparseable"`, `"unreadable manifest"`, `"source mismatch"`, `"plugins remain"`, `"concurrently uninstalled"`, `"concurrently updated"`, `"stale clone"`, `"duplicate name"`, `"lock held"`, `"already autoupdate"`, `"already no autoupdate"`, `"already enabled"`, `"already disabled"`, `"permission denied"`, `"source missing"`, `"network unreachable"`, `"not added"`, `"orphan rewake"`, `"authentication required"`, `"dangling reference"`, `"malformed mcp"`, `"malformed skill"`, `"malformed command"`, `"installs disabled"`.
DATA_A4S7P9HE_END
[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:95-202]

## Standard Stack

### Core

| Library / runtime                                                     | Installed version | Purpose                                                                          | Required use                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js built-ins: `node:test`, `node:assert/strict`, filesystem APIs | Node 26.7.0       | Runner, assertions, current-context doubles, coverage, real temporary filesystem | Use the existing runtime and `t.mock`; no new runner or assertion dependency. [VERIFIED: local version probe, 2026-08-29; .claude/rules/typescript-unit-testing.md:12-22]                                          |
| TypeScript                                                            | 6.0.3             | Strict source/test checking and type-only evidence                               | Use existing `satisfies` and `@ts-expect-error` patterns; type-only owners run with zero runtime cases. [VERIFIED: `npm ls --depth=0`, 2026-08-29; .claude/rules/typescript-unit-testing.md:182-218]               |
| `strong-mock`                                                         | 9.2.2             | Exact interaction contracts                                                      | Use only where invoking a callback/notification is itself public behavior; set `exactParams: true` and call `verify`. [VERIFIED: `npm ls --depth=0`, 2026-08-29; .claude/rules/typescript-unit-testing.md:128-151] |

### Supporting

| Library             | Installed version | Purpose                                    | When to use                                                                                                                                                                      |
| ------------------- | ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typebox`           | 1.3.14            | Existing completion-cache runtime schemas  | Exercise the current schemas through public cache reads; do not add a validation library. [VERIFIED: `npm ls --depth=0`, 2026-08-29; completion-cache.ts:65-110]                 |
| `write-file-atomic` | 8.0.0             | Existing atomic JSON writer implementation | Preserve its production use and assert final file bytes/directories through the public `atomicWriteJson` export. [VERIFIED: `npm ls --depth=0`, 2026-08-29; atomic-json.ts:1-30] |

### Alternatives Considered

| Instead of                                         | Could Use                    | Tradeoff                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing Node test stack                           | Another runner/mock library  | Rejected by the project testing rule and unnecessary for the public seams in this phase. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-22]                                                      |
| Real temp filesystem                               | An in-memory filesystem mock | Rejected where bytes, paths, cleanup, symlinks, or encoding are the behavior. [VERIFIED: .claude/rules/typescript-unit-testing.md:221-225]                                                               |
| Controlled render maps in `notify-context.test.ts` | Importing command renderers  | Importing command renderers would prove consumer behavior and blur owner boundaries; the existing typed render-map seam is sufficient. [VERIFIED: 109-CONTEXT.md:44-48,113-115; notify-context.ts:1-338] |

**Installation:** No installation. Phase 109 requires no new package and must keep the current dependency surface. [VERIFIED: package.json:53-98; source/test audit, 2026-08-29]

## Package Legitimacy Audit

Not applicable: this phase installs no external package. Existing dependencies are retained without version or manifest changes. [VERIFIED: package.json:53-98; phase boundary in 109-CONTEXT.md:6-16]

## Pair-by-Pair Planning Matrix

The exact accepted inventory and triage values are quoted here so the planner does not infer paths or statuses. [VERIFIED: .planning/REQUIREMENTS.md:183-205]

DATA_N7Q2M5WC_START
`P109-01 atomic-json.ts -> tests/shared/atomic-json.test.ts PASS`
`P109-02 completion-cache.ts -> tests/shared/completion-cache.test.ts COVERAGE_FAIL`
`P109-03 concerns/hooks.ts -> tests/shared/concerns/hooks.test.ts MISSING`
`P109-04 concerns/soft-dep.ts -> tests/shared/concerns/soft-dep.test.ts MISSING`
`P109-05 debug-log.ts -> tests/shared/debug-log.test.ts PASS`
`P109-06 errors-bridges.ts -> tests/shared/errors-bridges.test.ts COVERAGE_FAIL`
`P109-07 errors.ts -> tests/shared/errors.test.ts COVERAGE_FAIL`
`P109-08 extension-version.ts -> tests/shared/extension-version.test.ts MISSING`
`P109-09 fs-utils.ts -> tests/shared/fs-utils.test.ts COVERAGE_FAIL`
`P109-10 git-failure-classifiers.ts -> tests/shared/git-failure-classifiers.test.ts PASS`
`P109-11 markers.ts -> tests/shared/markers.test.ts MISSING`
`P109-12 notify-context.ts -> tests/shared/notify-context.test.ts MISSING`
`P109-13 notify-reasons.ts -> tests/shared/notify-reasons.test.ts MISSING`
`P109-14 notify.ts -> tests/shared/notify.test.ts MISSING`
`P109-15 path-safety.ts -> tests/shared/path-safety.test.ts COVERAGE_FAIL`
`P109-16 probe-classifiers.ts -> tests/shared/probe-classifiers.test.ts PASS`
`P109-17 session-env.ts -> tests/shared/session-env.test.ts COVERAGE_FAIL`
`P109-18 types.ts -> tests/shared/types.test.ts MISSING`
`P109-19 vars.ts -> tests/shared/vars.test.ts PASS`
DATA_N7Q2M5WC_END

| Pair    | Public contract and side effects to pin                                                                                                                                                                                                                                                           | Current gap and plan prescription                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P109-01 | `atomicWriteJson` creates the parent and writes `JSON.stringify(value, null, 2) + "\n"` as UTF-8. [VERIFIED: atomic-json.ts:24-30]                                                                                                                                                                | Focused coverage is already 100/100/100 with 3 cases, but normalize all cases and keep one fresh temp directory per case. [VERIFIED: focused audit, 2026-08-29; D-01]                                                                                                                                                                                                                                                                                                                                                                                    |
| P109-02 | Prove schema acceptance/rejection, cold/warm reads, injected time/TTL, poison caching, exact disk behavior, and all three public invalidation paths. [VERIFIED: completion-cache.ts:65-160,250-439]                                                                                               | Current direct result is 100% functions, 98.18% lines, 94.55% branches; add plugin-cache JSON parse failure and the non-`ENOENT` rethrow arms of both unlinking invalidators. Use unique scope/marketplace keys plus public invalidation in ordinary cases; cover the already-public whole-cache reset in one dedicated case, but do not use it as shared setup or add another reset. [VERIFIED: focused audit, 2026-08-29; completion-cache.ts:383-439]                                                                                                 |
| P109-03 | Prove the exact hook block for undefined, empty, strict tool, strict non-tool, and lenient supported/unsupported entries; add positive and negative evidence for all closed type arms. [VERIFIED: concerns/hooks.ts:57-128]                                                                       | Owner is missing. Move the pure hook-summary render/type evidence currently embedded in legacy notification coverage here; P109-14 should retain only integration bytes that are truly `notify.ts` behavior. [VERIFIED: codebase test audit, 2026-08-29; D-06/D-08]                                                                                                                                                                                                                                                                                      |
| P109-04 | Prove the Boolean truth table and canonical agents-before-MCP marker order; add type-only evidence for the exact dependency union. [VERIFIED: concerns/soft-dep.ts:25-59]                                                                                                                         | Owner is missing. Move pure soft-dependency marker selection here; central notification rows only prove how already-selected markers render. [VERIFIED: codebase test audit, 2026-08-29; D-06/D-08]                                                                                                                                                                                                                                                                                                                                                      |
| P109-05 | Prove silence for every non-exact gate, default/custom tags, and exact `console.error` bytes under the exact gate. [VERIFIED: debug-log.ts:1-25]                                                                                                                                                  | Focused coverage is 100/100/100 with 3 cases, but normalize and make each case save/restore the env key and use `t.mock.method(console, "error")`. [VERIFIED: focused audit, 2026-08-29; .claude/rules/typescript-unit-testing.md:124-151,229]                                                                                                                                                                                                                                                                                                           |
| P109-06 | Prove every exported bridge error class, exact message, stable fields/cause, and defensive/frozen collections where exposed. [VERIFIED: errors-bridges.ts:24-121]                                                                                                                                 | Current direct result is 80% functions, 95.90% lines, 90% branches; the uncovered export is `CommandNameError` at lines 117-121. Add its exact class/field/message case and normalize the existing 8. [VERIFIED: focused audit, 2026-08-29; errors-bridges.ts:117-121]                                                                                                                                                                                                                                                                                   |
| P109-07 | Prove every exported helper and error class through exact whole structured values, cause traversal/trailers, stable discriminator unions, frozen copies, and defensive aliasing. [VERIFIED: errors.ts:3-28,94-168,179-348,362-474,513-617]                                                        | Current direct result is 56.10% functions, 88.19% lines, 80.95% branches. The plan must explicitly cover currently untouched helpers/classes and all union arms, not add incidental cases until counters happen to turn green. [VERIFIED: focused audit, 2026-08-29]                                                                                                                                                                                                                                                                                     |
| P109-08 | Directly import and assert the exact extension version literal. [VERIFIED: extension-version.ts:13-16]                                                                                                                                                                                            | Owner is missing. Keep the existing architecture sync test as a supplemental drift guard; it does not replace this direct owner. [VERIFIED: extension-version.ts:9-11; 109-CONTEXT.md:146-148]                                                                                                                                                                                                                                                                                                                                                           |
| P109-09 | Prove path existence/cleanup, orphan file/tree removal, rollback reverse order and frozen leaks, materialization result variants, tolerant directory reads, and markdown filtering. [VERIFIED: fs-utils.ts:40-313]                                                                                | Current direct result is 57.14% functions, 83.39% lines, 89.66% branches. Add the untested materialization/list/filter exports and deterministic exceptional cases. Remove existing `t.skip` and permission-mode assumptions; they violate CASE-04 and are unreliable under privileged CI. [VERIFIED: focused audit and owner-test read, 2026-08-29; .planning/REQUIREMENTS.md:29-36]                                                                                                                                                                    |
| P109-10 | Prove exact network/authentication/undefined classifier outputs across HTTP, cancellation, errno, cause-chain, and negative cases. [VERIFIED: git-failure-classifiers.ts:33-62]                                                                                                                   | Focused coverage is 100/100/100 with 11 cases; normalize titles, values, whole results, and lowercase phases. [VERIFIED: focused audit, 2026-08-29; D-01]                                                                                                                                                                                                                                                                                                                                                                                                |
| P109-11 | Directly import and assert both exact stable prefixes. [VERIFIED: markers.ts:9-24]                                                                                                                                                                                                                | Owner is missing. Retain the architecture snapshot only as a supplemental drift guard. [VERIFIED: markers.ts:3-7; 109-CONTEXT.md:146-148]                                                                                                                                                                                                                                                                                                                                                                                                                |
| P109-12 | Prove all four public context wrappers, label/cardinality projection, tally/no-op/reconcile dispatch, renderer selection, and deterministic missing-arm fallback through controlled render maps. [VERIFIED: notify-context.ts:1-338]                                                              | Owner is missing. Absorb dispatch behavior from `notify-context-dispatch-guard`, and split cross-module reason suites so this owner proves dispatch effects without importing production command renderers or duplicating `notify.ts` bytes. [VERIFIED: codebase test audit, 2026-08-29; D-06]                                                                                                                                                                                                                                                           |
| P109-13 | Prove idempotent reason selection, skip/companion severity, failure reason classification, malformed kind mapping/order, and type-level completeness. [VERIFIED: notify-reasons.ts:1-257]                                                                                                         | Owner is missing and no direct cases were found. Create pure named matrices; do not duplicate their selection truth tables in P109-14. [VERIFIED: codebase test audit, 2026-08-29]                                                                                                                                                                                                                                                                                                                                                                       |
| P109-14 | Prove every public renderer/helper/entrypoint, closed status/reason grammar, exact full bytes, severity/reload reductions, descriptions, indentation, causes, summaries, cascades, and fallback/diagnostic effects. [VERIFIED: notify.ts:95-4134; messaging-style-guide.md notification contract] | Owner is missing. Create named data rows grouped by public status with a literal full expected byte string in every row; absorb and delete seven legacy suites after deduplication. P109-14 must depend on P109-03/04/12/13. [VERIFIED: D-05 through D-08; codebase test audit, 2026-08-29]                                                                                                                                                                                                                                                              |
| P109-15 | Prove contained paths, parent/self/outside rejection, symlink refusal, exact error classes/fields/messages, unexpected `lstat` propagation, and unreadable-link fallback. [VERIFIED: path-safety.ts:9-147]                                                                                        | Current direct result is 100% functions, 95.24% lines, 88% branches; uncovered lines are the exceptional `lstat` and `readlink` arms. Use real temp paths for normal behavior. If deterministic coverage of an imported filesystem function is impossible, make the smallest behavior-preserving internal import-object refactor and use current-context `t.mock.method`; the Node filesystem object properties were locally verified writable/configurable. Add no export. [VERIFIED: focused audit and local runtime property probe, 2026-08-29; D-04] |
| P109-16 | Prove all exact narrow error/reason/note classifications, prefix ordering, deduplication, cause walking, and negative cases. [VERIFIED: probe-classifiers.ts:37-217]                                                                                                                              | Focused coverage is 100/100/100 with 28 cases; normalize all cases despite the green baseline. [VERIFIED: focused audit, 2026-08-29; D-01]                                                                                                                                                                                                                                                                                                                                                                                                               |
| P109-17 | Prove the exact session triple, non-interfering live env mutation, pure PATH-ledger removal/dedup/order/tamper handling, and exact ledger key. [VERIFIED: session-env.ts:37-70,94-127]                                                                                                            | Current direct result is 66.67% functions, 74.02% lines, 100% branches because `applyPathLedger` is untested. Add pure table rows and ensure the same live-env case registers restoration before mutation. [VERIFIED: focused audit, 2026-08-29]                                                                                                                                                                                                                                                                                                         |
| P109-18 | Prove the two allowed scopes and reject the intentionally absent third scope at compile time. [VERIFIED: types.ts:7-19]                                                                                                                                                                           | Owner is missing. Runtime evidence for `SCOPES` may use normal phases; type-only evidence must use positive `satisfies` and negative `@ts-expect-error` at module scope with no fake runtime case or phase comments. [VERIFIED: D-03; .claude/rules/typescript-unit-testing.md:211-218]                                                                                                                                                                                                                                                                  |
| P109-19 | Prove all four substitutions, absent optional pass-through, unknown token pass-through, repeated tokens, and single-pass non-re-expansion; add compile-time shape evidence where useful. [VERIFIED: vars.ts:20-72]                                                                                | Focused coverage is 100/100/100 with 12 cases; normalize every case and restore any process environment changed by integration-style cases. [VERIFIED: focused audit, 2026-08-29; D-01/D-04]                                                                                                                                                                                                                                                                                                                                                             |

## Notification Consolidation Map

Seven legacy shared notification suites contain 174 existing cases in total; case count is migration input, not a retention target, because D-08 requires distinct contracts to survive and duplicate evidence to be removed. [VERIFIED: codebase test enumeration, 2026-08-29; D-08]

| Legacy suite                                         | New owner                                                                     | Required disposition                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/shared/notify-context-dispatch-guard.test.ts` | P109-12                                                                       | Move controlled-dispatch and fallback behavior, then delete the legacy file. [VERIFIED: suite/source audit, 2026-08-29; D-05/D-06]                                                            |
| `tests/shared/notify-disabled-reasons.test.ts`       | Split P109-12/P109-14                                                         | Put dispatch selection/effects under P109-12 and exact central renderer bytes under P109-14; retain no cross-module duplicate. [VERIFIED: suite/source audit, 2026-08-29; D-06]               |
| `tests/shared/notify-not-installed-reasons.test.ts`  | Split P109-12/P109-14                                                         | Apply the same ownership split and delete the legacy file after both owners contain distinct evidence. [VERIFIED: suite/source audit, 2026-08-29; D-06]                                       |
| `tests/shared/notify-inert-fields.test.ts`           | P109-14                                                                       | Retain only distinct public byte/field-inertness contracts; remove duplicates. [VERIFIED: suite/source audit, 2026-08-29; D-07/D-08]                                                          |
| `tests/shared/notify-v2.test.ts`                     | Primarily P109-14; pure hook and soft-dependency selection to P109-03/P109-04 | Convert the output catalog into named status rows with literal full bytes. Move concern-owned pure evidence first, then delete. [VERIFIED: suite/source audit, 2026-08-29; D-05 through D-08] |
| `tests/shared/snm37-behavioral-smoke.test.ts`        | P109-14                                                                       | Preserve only its distinct public grammar behavior and delete historical smoke packaging. [VERIFIED: suite/source audit, 2026-08-29; D-08]                                                    |
| `tests/shared/snm38-indent-ladder.test.ts`           | P109-14                                                                       | Preserve exact indentation ladder bytes in owner rows, then delete the legacy file. [VERIFIED: suite/source audit, 2026-08-29; D-07/D-08]                                                     |

Architecture notification catalog/grammar tests remain supplemental and must not be deleted merely because shared legacy owners are consolidated. [VERIFIED: 109-CONTEXT.md:125-148]

## Architecture Patterns

### Pattern 1: One source, one owner, one atomic plan

Each plan changes its named production source only if direct public coverage truly requires a behavior-preserving internal refactor, changes its mirrored owner test, runs focused validation, and commits that pair alone. P109-14 is the explicit exception for file count—not ownership—because it also deletes the seven absorbed legacy suites. [VERIFIED: .planning/ROADMAP.md:129-151; 109-CONTEXT.md:39-67]

### Pattern 2: Named data rows create sibling runtime cases

Use a typed row table and a `for` loop that creates one sibling `test()` per row. Keep separate arrange, act, and assert phases inside every generated case; never branch inside the loop body. [VERIFIED: .claude/rules/typescript-unit-testing.md:160-179; D-02/D-07]

```typescript
for (const { name, input, expected } of rows) {
  test(name, () => {
    // arrange
    const expectedOutput = expected;

    // act
    const output = render(input);

    // assert
    assert.strictEqual(output, expectedOutput);
  });
}
```

For notification rows, `expected` must be a literal complete byte string in the row and must not call production constants, status maps, icon maps, or helper formatters. [VERIFIED: D-07; .claude/rules/typescript-unit-testing.md:89-109]

### Pattern 3: Separate runtime data from type-only evidence

Runtime constants such as `SCOPES` receive runtime cases; union acceptance/rejection belongs at module scope and creates no artificial phase comments or runtime cases. [VERIFIED: D-03; .claude/rules/typescript-unit-testing.md:211-218]

```typescript
declare const acceptedScope: Scope;
void (acceptedScope satisfies Scope);

// @ts-expect-error local is intentionally not a Scope
void ("local" satisfies Scope);
```

The literal `"local"` in this example is the verbatim excluded value quoted in the Exact In-Repository Contract Registry. [VERIFIED: types.ts:7-19]

### Pattern 4: State ownership is per case

Register `t.after()` restoration before mutating environment or globals; create a fresh temp directory for every filesystem case; use unique completion-cache keys; use `t.mock.method` on the current test context; explicitly verify each strict interaction mock. [VERIFIED: .claude/rules/typescript-unit-testing.md:122-151,182-229; D-04]

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/shared/<source>.ts
tests/shared/<source>.test.ts
extensions/pi-claude-marketplace/shared/concerns/<source>.ts
tests/shared/concerns/<source>.test.ts
```

These are the only owner layouts for Phase 109; supplemental architecture tests do not replace them. [VERIFIED: .planning/REQUIREMENTS.md:183-205; 109-CONTEXT.md:125-148]

### Anti-Patterns to Avoid

- **Stopping when baseline coverage is green:** D-01 requires normalization of all nineteen owner tests. [VERIFIED: D-01]
- **Using coverage as the case-design oracle:** enumerate exports, branches, stable fields, mutations, and exact outputs first; use coverage only to find missed paths. [VERIFIED: .claude/rules/typescript-unit-testing.md:24-32,89-109]
- **Cross-module notification tests:** dispatch belongs to `notify-context`, pure selection to concerns/reasons, and exact central bytes to `notify`. [VERIFIED: D-06 through D-08]
- **Process-wide Node mocks or shared mutable setup:** use `t.mock` and case-local cleanup. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-22,34-42,151-188]
- **Weak fragments and snapshots:** compare complete error values, arrays, file bytes, and notification strings to independent literals. [VERIFIED: .claude/rules/typescript-unit-testing.md:89-109]
- **Fake runtime phases for type evidence:** keep `satisfies`/`@ts-expect-error` checks at module scope. [VERIFIED: D-03; .claude/rules/typescript-unit-testing.md:211-218]
- **Test-only production state:** do not add exports, readers, reset hooks, modes, coverage ignores, or private-member access. [VERIFIED: 109-CONTEXT.md:6-16; .claude/rules/typescript-unit-testing.md:194-209]

## Don't Hand-Roll

| Problem                         | Don't Build                                                          | Use Instead                                           | Why                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime lifecycle/doubles       | Global mock registry or custom loader                                | `node:test` TestContext                               | Each test context owns a `MockTracker` that restores mocked methods after the test. [CITED: https://nodejs.org/download/release/v24.13.1/docs/api/test.html]                                                                                                                                                    |
| Strict interaction verification | Ad hoc call arrays for ordinary exact interactions                   | Existing `strong-mock`                                | Project rules require exact parameters and explicit verification when interaction is the promise. [VERIFIED: .claude/rules/typescript-unit-testing.md:128-147]                                                                                                                                                  |
| Filesystem behavior             | In-memory filesystem facsimile                                       | Real `mkdtemp` directory plus case cleanup            | Paths, symlinks, encoding, bytes, and cleanup are the contracts. [VERIFIED: .claude/rules/typescript-unit-testing.md:221-225]                                                                                                                                                                                   |
| Completion-cache isolation      | A new production reset/test mode                                     | Unique keys, temp paths, current public invalidations | The module already exposes narrow public invalidations; the phase forbids new test state. [VERIFIED: completion-cache.ts:383-439; D-04]                                                                                                                                                                         |
| Notification expectations       | Snapshot generation or production formatter-derived expected strings | Literal complete expected strings in named rows       | Independent exact bytes are the required public evidence. [VERIFIED: D-07; .claude/rules/typescript-unit-testing.md:107-108]                                                                                                                                                                                    |
| Type contract testing           | Fake runtime assertions or reflective type machinery                 | `satisfies` and `@ts-expect-error`                    | `satisfies` checks assignability without changing the expression's inferred type; unused `@ts-expect-error` directives report an error. [CITED: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html; https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html] |

## Runtime State Inventory

| Category                             | Items Found                                                                                                                                                                                                                | Action Required                                                                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data                          | Two process-memory completion maps plus caller-selected on-disk cache files with schema versions `2` and `6`. [VERIFIED: completion-cache.ts:65-145]                                                                       | No data migration: schemas and public behavior are unchanged. Tests use unique keys/temp paths and narrow public invalidation; existing disk data is test input only. [VERIFIED: 109-CONTEXT.md:6-16,116-118] |
| Live service config                  | None — verified by the Phase 109 source/caller audit; shared modules in scope have no external UI/database-held configuration. [VERIFIED: CodeGraph/source audit, 2026-08-29]                                              | None. Do not broaden plans into later command/service consumers. [VERIFIED: 109-CONTEXT.md:138-145]                                                                                                           |
| OS-registered state                  | None — verified by the source audit; no Phase 109 module registers a scheduler task, service, daemon, or process name. [VERIFIED: CodeGraph/source audit, 2026-08-29]                                                      | None.                                                                                                                                                                                                         |
| Secrets/env vars                     | Exact runtime keys are `PI_CLAUDE_MARKETPLACE_DEBUG`, `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`, and `PI_CLAUDE_MARKETPLACE_PATH`; none is renamed. [VERIFIED: debug-log.ts:22-25; session-env.ts:37-70] | Code edit only: cases save and restore the keys they mutate. No secret migration. [VERIFIED: D-04]                                                                                                            |
| Build artifacts / installed packages | None — no build, package-name, or dependency change is in scope. [VERIFIED: 109-CONTEXT.md:6-16; package.json:53-98]                                                                                                       | Run existing checks; do not reinstall or rewrite artifacts as a phase task.                                                                                                                                   |

## Common Pitfalls

### Pitfall 1: A 100% baseline is mistaken for compliance

**What goes wrong:** Five accepted-HEAD pairs already show 100/100/100, but their cases retain old structure or evidence style. [VERIFIED: focused audit, 2026-08-29]
**How to avoid:** Plan a real normalization task for P109-01/05/10/16/19 and re-run focused coverage afterward. [VERIFIED: D-01]

### Pitfall 2: Completion-cache tests leak process state

**What goes wrong:** The two memory maps survive between cases in the same process, and disk files can rehydrate stale state. [VERIFIED: completion-cache.ts:132-145,250-439]
**How to avoid:** Use unique scope/marketplace identifiers and temp cache paths, invalidate through public seams, and reserve the existing whole-cache reset for its own contract case rather than shared setup. [VERIFIED: completion-cache.ts:383-439; D-04]

### Pitfall 3: Notification consolidation silently loses a contract

**What goes wrong:** Deleting legacy suites before mapping distinct dispatch, reason-selection, hook, soft-dependency, and exact-byte behavior can erase evidence; blindly copying all 174 cases creates duplicates instead. [VERIFIED: codebase suite audit, 2026-08-29; D-05 through D-08]
**How to avoid:** Create a case-level migration ledger inside the P109-14 plan, mark every legacy case `move`, `split`, or `duplicate`, and delete only after the new owners pass. [VERIFIED: D-05 through D-08]

### Pitfall 4: Filesystem failures depend on permissions or timing

**What goes wrong:** `chmod` and symlink race techniques can behave differently under privileged CI and skipped cases violate CASE-04. [VERIFIED: existing fs-utils/path-safety owner audit, 2026-08-29; .planning/REQUIREMENTS.md:29-36]
**How to avoid:** Use real temporary boundaries for normal behavior and current-context method substitution only for deterministic exceptional Node API branches; keep any production refactor internal and behavior-preserving. [VERIFIED: .claude/rules/typescript-unit-testing.md:124-151,221-225; D-04]

### Pitfall 5: Exact values are derived from production

**What goes wrong:** Importing icons/reasons or calling helpers to build an expected notification lets production and expectation drift together. [VERIFIED: legacy suite audit, 2026-08-29]
**How to avoid:** Put a complete literal byte string on every notification row and complete literal objects/arrays in other assertions. [VERIFIED: D-07; .claude/rules/typescript-unit-testing.md:89-109]

### Pitfall 6: Type-only evidence invents runtime work

**What goes wrong:** A fake `test()` or phase comments imply runtime behavior that the module does not have. [VERIFIED: .claude/rules/typescript-unit-testing.md:211-218]
**How to avoid:** Keep positive and negative compile-time expressions at module scope and accept zero runtime cases for type-only proof. [VERIFIED: D-03]

## State of the Art

| Old approach in the brownfield input                         | Required Phase 109 approach                                             | Impact                                                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Passing focused coverage treated as sufficient               | Normalize all accepted-HEAD tests against the v1.19 contract            | Five green pairs still receive atomic plans. [VERIFIED: D-01; focused audit, 2026-08-29]                                                  |
| Several shared notification suites overlap ownership         | One mirrored owner per source, with legacy files absorbed/deleted       | P109-14 becomes the consolidation carrier after P109-03/04/12/13. [VERIFIED: D-05 through D-08]                                           |
| Cross-module dispatch/render cases                           | Controlled renderer dispatch in P109-12; exact central bytes in P109-14 | Failures point to the module that owns the behavior. [VERIFIED: D-06]                                                                     |
| Process-wide `node:test` mocks in legacy notification suites | Current-test-context `t.mock` or per-case `strong-mock`                 | Restores state at the owning case boundary. [VERIFIED: legacy test audit, 2026-08-29; .claude/rules/typescript-unit-testing.md:12-22,151] |
| Mixed or absent phase comments                               | Exact lowercase runtime phases; separate type-only evidence             | Runtime and compile-time contracts remain truthful. [VERIFIED: D-02/D-03]                                                                 |

## Assumptions Log

| #   | Claim                                                                                                                                                                | Section | Risk if Wrong |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| —   | None. Repository claims were read from source-of-truth files or verified by focused commands; external runtime/language guidance is cited to official documentation. | —       | —             |

## Open Questions (RESOLVED)

No user decision remains open. Resolution for P109-15: first attempt full public-surface coverage with no production edit. Only if that is impossible, the owning P109-15 pair may make the smallest behavior-preserving internal dependency-access refactor permitted by D-04 and the agent's discretion. It must add no public export, test mode, reset hook, or state reader. [VERIFIED: D-04 and the agent's Discretion; path-safety.ts:9-147]

## Environment Availability

| Dependency                 | Required By                     | Available | Version                                                          | Fallback                                                                                                    |
| -------------------------- | ------------------------------- | --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Node.js                    | All runtime owners and coverage | ✓         | 26.7.0                                                           | Project floor is `>=20.19.0`; no fallback needed. [VERIFIED: local probe, 2026-08-29; package.json engines] |
| npm                        | Scripts and phase gate          | ✓         | 11.19.0                                                          | — [VERIFIED: local probe, 2026-08-29]                                                                       |
| TypeScript                 | Type-only and full typecheck    | ✓         | 6.0.3                                                            | — [VERIFIED: local probe/`npm ls`, 2026-08-29]                                                              |
| ESLint                     | Case/style enforcement          | ✓         | 10.8.1                                                           | — [VERIFIED: local probe/`npm ls`, 2026-08-29]                                                              |
| Existing test dependencies | Shared owner suites             | ✓         | `strong-mock` 9.2.2; `typebox` 1.3.14; `write-file-atomic` 8.0.0 | — [VERIFIED: `npm ls --depth=0`, 2026-08-29]                                                                |

**Missing dependencies with no fallback:** None. [VERIFIED: local environment audit, 2026-08-29]

**Missing dependencies with fallback:** None. [VERIFIED: local environment audit, 2026-08-29]

## Validation Architecture

### Test Framework

| Property                 | Value                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework                | Node.js built-in test runner 26.7.0 with strict assert and experimental direct coverage. [VERIFIED: local probe, 2026-08-29; package.json:82-91] |
| Config file              | None; scripts live in `package.json`, and focused mapping is implemented by `scripts/test-coverage-direct.mjs`. [VERIFIED: package.json:75-95]   |
| Quick run command        | `node --test <owner-test-path>` [VERIFIED: .claude/rules/typescript-unit-testing.md:24-32]                                                       |
| Focused coverage command | `npm run test:coverage:direct -- <production-source-path>` [VERIFIED: package.json:88-90; .claude/rules/typescript-unit-testing.md:24-32]        |
| Full suite command       | `npm run check` [VERIFIED: package.json:75-95]                                                                                                   |

### Phase Requirements → Test Map

| Req ID           | Behavior                                         | Test Type                             | Automated Command                                                                                    | File Exists?                              |
| ---------------- | ------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| MOD-02 / P109-01 | Atomic JSON exact bytes and directory creation   | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/atomic-json.ts`             | ✅ [VERIFIED: REQUIREMENTS.md:187]        |
| MOD-02 / P109-02 | Completion cache memory/disk/schema/invalidation | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/completion-cache.ts`        | ✅ [VERIFIED: REQUIREMENTS.md:188]        |
| MOD-02 / P109-03 | Hook type/render contract                        | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/concerns/hooks.ts`          | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:189] |
| MOD-02 / P109-04 | Soft dependency marker contract                  | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`       | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:190] |
| MOD-02 / P109-05 | Debug environment/console effect                 | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/debug-log.ts`               | ✅ [VERIFIED: REQUIREMENTS.md:191]        |
| MOD-02 / P109-06 | Bridge error values                              | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors-bridges.ts`          | ✅ [VERIFIED: REQUIREMENTS.md:192]        |
| MOD-02 / P109-07 | Shared error values and helpers                  | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors.ts`                  | ✅ [VERIFIED: REQUIREMENTS.md:193]        |
| MOD-02 / P109-08 | Extension version exact value                    | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/extension-version.ts`       | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:194] |
| MOD-02 / P109-09 | Filesystem results and cleanup                   | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/fs-utils.ts`                | ✅ [VERIFIED: REQUIREMENTS.md:195]        |
| MOD-02 / P109-10 | Git failure classifications                      | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` | ✅ [VERIFIED: REQUIREMENTS.md:196]        |
| MOD-02 / P109-11 | Exact marker prefixes                            | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/markers.ts`                 | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:197] |
| MOD-02 / P109-12 | Controlled notification dispatch                 | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify-context.ts`          | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:198] |
| MOD-02 / P109-13 | Pure notification reason selection               | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify-reasons.ts`          | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:199] |
| MOD-02 / P109-14 | Exact notification byte grammar                  | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notify.ts`                  | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:200] |
| MOD-02 / P109-15 | Path containment/symlink/failure values          | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/path-safety.ts`             | ✅ [VERIFIED: REQUIREMENTS.md:201]        |
| MOD-02 / P109-16 | Probe classification exact outputs               | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/probe-classifiers.ts`       | ✅ [VERIFIED: REQUIREMENTS.md:202]        |
| MOD-02 / P109-17 | Session/PATH environment behavior                | unit + direct coverage                | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/session-env.ts`             | ✅ [VERIFIED: REQUIREMENTS.md:203]        |
| MOD-02 / P109-18 | Scope runtime and type contract                  | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/types.ts`                   | ❌ Wave 0 [VERIFIED: REQUIREMENTS.md:204] |
| MOD-02 / P109-19 | Variable substitution exact values               | unit + compile-time + direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/vars.ts`                    | ✅ [VERIFIED: REQUIREMENTS.md:205]        |

### Sampling Rate

- **During each plan:** Run `node --test <owner-test-path>` after case groups, then the pair's focused direct-coverage command before commit. [VERIFIED: .claude/rules/typescript-unit-testing.md:24-32]
- **Per wave merge:** Re-run focused direct coverage for every pair changed in the wave; notification waves also run all completed P109-03/04/12/13/14 owners together. [VERIFIED: dependency analysis, 2026-08-29]
- **Phase gate:** Run focused direct coverage separately for all nineteen listed production sources, then `npm run check`. Do not use `test:coverage:direct:all` as the Phase 109 acceptance gate because later inventory pairs are intentionally still missing. [VERIFIED: REQUIREMENTS.md:183-205,207 onward; package.json:88-89]

### Wave 0 Gaps

- [ ] `tests/shared/concerns/hooks.test.ts` — P109-03. [VERIFIED: REQUIREMENTS.md:189]
- [ ] `tests/shared/concerns/soft-dep.test.ts` — P109-04. [VERIFIED: REQUIREMENTS.md:190]
- [ ] `tests/shared/extension-version.test.ts` — P109-08. [VERIFIED: REQUIREMENTS.md:194]
- [ ] `tests/shared/markers.test.ts` — P109-11. [VERIFIED: REQUIREMENTS.md:197]
- [ ] `tests/shared/notify-context.test.ts` — P109-12. [VERIFIED: REQUIREMENTS.md:198]
- [ ] `tests/shared/notify-reasons.test.ts` — P109-13. [VERIFIED: REQUIREMENTS.md:199]
- [ ] `tests/shared/notify.test.ts` — P109-14. [VERIFIED: REQUIREMENTS.md:200]
- [ ] `tests/shared/types.test.ts` — P109-18. [VERIFIED: REQUIREMENTS.md:204]

The test framework, scripts, direct-coverage harness, and the other eleven owner files already exist; no framework Wave 0 is required. [VERIFIED: package.json:75-95; REQUIREMENTS.md:183-205]

## Wave and Dependency Recommendation

| Wave | Plans                                                       | Reason                                                                                                                                                                                                                                      |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | P109-01, 02, 05, 06, 07, 08, 09, 10, 11, 15, 16, 17, 18, 19 | These pairs are mutually independent at the owner-test boundary and can proceed as separate atomic plans. [VERIFIED: CodeGraph/source ownership audit, 2026-08-29]                                                                          |
| 1    | P109-03, P109-04, P109-13                                   | Establish pure hook, soft-dependency, and reason ownership before their legacy evidence is removed. [VERIFIED: notification consolidation audit, 2026-08-29; D-06/D-08]                                                                     |
| 2    | P109-12                                                     | Establish controlled dispatcher ownership and absorb/split dispatch-guard evidence. [VERIFIED: D-06; notify-context.ts:1-338]                                                                                                               |
| 3    | P109-14                                                     | Consolidate exact rendering bytes after P109-03/04/12/13 are green; delete all seven absorbed legacy files in this plan. [VERIFIED: D-05 through D-08]                                                                                      |
| Gate | All P109 owners                                             | Run nineteen focused direct-coverage commands and `npm run check`; verify no new public exports, reset hooks, state readers, test modes, coverage ignores, `skip`, `todo`, or `only`. [VERIFIED: ROADMAP.md:122-127; REQUIREMENTS.md:29-55] |

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                 |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | Phase 109 has no credential or identity decision; HTTP authentication is only an exact classifier value. [VERIFIED: git-failure-classifiers.ts:33-62; phase source audit, 2026-08-29]                                            |
| V3 Session Management | No      | The Claude session identifiers are environment projection aliases, not web authentication sessions. [VERIFIED: session-env.ts:32-60]                                                                                             |
| V4 Access Control     | No      | No authorization policy is implemented in these shared modules. [VERIFIED: phase source audit, 2026-08-29]                                                                                                                       |
| V5 Input Validation   | Yes     | Preserve TypeBox cache schemas, exact discriminated unions/classifiers, path containment, and symlink refusal; test malformed/unreadable inputs. [VERIFIED: completion-cache.ts:65-110; errors.ts:513-617; path-safety.ts:9-147] |
| V6 Cryptography       | No      | No cryptographic primitive or secret transformation exists in Phase 109. [VERIFIED: phase source audit, 2026-08-29]                                                                                                              |

### Known Threat Patterns for the Stack

| Pattern                                                | STRIDE                             | Standard Mitigation                                                                                                                                                                                |
| ------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path traversal or symlink escape                       | Tampering / Elevation of privilege | Exact real-filesystem containment and symlink-refusal cases through `assertPathInside`; pin structured errors. [VERIFIED: path-safety.ts:9-147]                                                    |
| Corrupt or stale completion cache                      | Tampering / Denial of service      | Validate exact schema versions, rebuild/drop invalid data, prove poison and invalidation semantics. [VERIFIED: completion-cache.ts:65-160,250-439]                                                 |
| Environment/token re-expansion                         | Tampering / Information disclosure | Prove single-pass replacement, optional/unknown pass-through, PATH-ledger ownership, and same-case restoration. [VERIFIED: vars.ts:51-72; session-env.ts:73-127]                                   |
| Absolute path or cause leakage in notifications/errors | Information disclosure             | Pin the current exact public error/notification contract and do not add new diagnostic surfaces under test pressure. [VERIFIED: errors.ts:94-168,179-617; notify.ts:325-4134; 109-CONTEXT.md:6-16] |
| Cross-case global/cache contamination                  | Tampering / Repudiation            | Case-owned env, console, notification doubles, cache keys, cleanup, and current-context mocks. [VERIFIED: D-04; .claude/rules/typescript-unit-testing.md:151-188]                                  |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/109-shared-contracts/109-CONTEXT.md` — locked scope, test form, state ownership, and notification consolidation decisions. [VERIFIED: read 2026-08-29]
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` — MOD-02, exact nineteen-pair inventory, triage, and success criteria. [VERIFIED: read 2026-08-29]
- `.claude/rules/typescript-unit-testing.md` — executable test, assertion, double, filesystem, type-only, and production-design rules. [VERIFIED: read 2026-08-29]
- The nineteen `extensions/pi-claude-marketplace/shared/` sources and existing/missing mirrored owners — public values, side effects, call paths, and branch gaps. [VERIFIED: CodeGraph, source reads, and focused coverage runs, 2026-08-29]
- `docs/messaging-style-guide.md`, `docs/output-catalog.md`, and `docs/env-vars.md` — exact notification/environment vocabulary. [VERIFIED: read 2026-08-29]

### Secondary (MEDIUM confidence)

- [Node.js v24 test documentation](https://nodejs.org/download/release/v24.13.1/docs/api/test.html) — TestContext mock ownership and restoration. [CITED: official Node.js docs]
- [TypeScript 4.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) — `satisfies`. [CITED: official TypeScript docs]
- [TypeScript 3.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html) — `@ts-expect-error`. [CITED: official TypeScript docs]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — current scripts, installed versions, and project rules were read/probed locally. [VERIFIED: package.json and local probes, 2026-08-29]
- Architecture: HIGH — all nineteen sources/owners and notification call paths were audited with CodeGraph before direct source reads. [VERIFIED: CodeGraph/source audit, 2026-08-29]
- Pitfalls: HIGH — grounded in current coverage output, current tests, and locked phase decisions. [VERIFIED: focused audit and 109-CONTEXT.md, 2026-08-29]
- External runtime/language behavior: MEDIUM — cited to official Node.js and TypeScript documentation through the research seam. [CITED: official docs listed above]

**Research date:** 2026-08-29
**Valid until:** 2026-09-28; repository-specific coverage/path findings must be re-audited if Phase 109 implementation begins after shared code changes. [VERIFIED: current HEAD audit date, 2026-08-29]
