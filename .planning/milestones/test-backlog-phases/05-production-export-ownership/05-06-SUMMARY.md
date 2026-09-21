---
phase: 05-production-export-ownership
plan: "06"
subsystem: hooks
tags: [export-ownership, exhaustiveness, public-contract-tests]
status: complete
requires:
  - phase: 05-01
    provides: Complete production finding census and controls
provides:
  - Predicate facade restricted to its production-owned compilation and dispatch contracts
  - One shared exhaustiveness implementation preserving both established error messages
  - Type-only HookExecResult owner retaining positive and negative compiler checks
affects: [05-wave-2-integration, 05-22]
tech-stack:
  added: []
  patterns: [Caller-owned diagnostic passed to canonical exhaustiveness helper]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - tests/bridges/hooks/if-field/index.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - tests/bridges/hooks/exec-result.test.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - tests/shared/errors.test.ts
key-decisions:
  - Preserve the shared default String diagnostic and the hook JSON diagnostic through assertNever's optional message argument, used by eight live production call sites.
  - Retire convenience re-export identity proofs while retaining the complete public predicate union proof and every predicate runtime assertion.
actuals:
  tasks: 3
plan_head_before: 7615c965593c12e9f984e183f1b74577a719e10a
requirements-completed: []
completed: 2026-09-14
---

# Phase 5 Plan 6: Hook Predicate Ownership and Exhaustiveness Summary

Eight unused predicate convenience exports are removed, and all hook exhaustiveness checks use the shared implementation without changing either established error contract.

## Integration Status

Both executor tasks are implemented and focused/direct checks pass. The parent owns commits, typecheck, the exact eighth Sonar type-only owner exception, the stable-wave finding census, aggregate unit coverage, and state updates. This summary deliberately remains `integration_pending`; EXPORT-01 is not marked complete by this plan alone. Token usage was not measured. The executor made no commits; the parent records the stable-wave commit after integration.

## Task 1: Predicate Facade and Live Exhaustiveness

CodeGraph traced the predicate compiler, glob matcher, dispatch reducer, adapters, and both exhaustiveness implementations before editing. The facade's eight convenience value exports have no production importer through that facade. Their actual public glob/bash/PowerShell implementations and owner tests remain. Three convenience type re-exports also retire; the facade retains `IfPredicate`, `CompileIfPredicateContext`, `compileIfPredicate`, `ifFires`, and `MATCH_ALL_IF`.

All eight live default calls now import `shared/errors.assertNever`: two in glob, four in event-adapters, one in dispatch, and one in predicate dispatch. Each supplies its existing `unreachable HookExecResult arm: ${JSON.stringify(...)}` diagnostic. Existing hook error assertions remain unchanged, including exact glob, reducer, and adapter errors. The unrelated domain parse context is unchanged.

### Assertion Ledger

All seventeen runtime cases in `tests/bridges/hooks/if-field/index.test.ts` remain unchanged. The only removed assertions are compile-time comparisons of retired re-exports to their defining symbols:

| Removed assertion | Disposition and retained public evidence |
| --- | --- |
| `Same<typeof exportedCompileBashGlob, typeof definingCompileBashGlob>` | Unused facade identity retired. Public compiler prefix case checks Bash kind, events, raw glob, word-boundary and name-only fields; evaluation cases retain exact match/miss/missing-command results. |
| `Same<typeof exportedCompilePathGlob, typeof definingCompilePathGlob>` | Unused identity retired. Public Read case retains complete anchor, base, tokens, events and firing result; path matrix retains membership, nonmembership, absolute paths and cwd fallback. |
| `Same<typeof exportedCompilePowerShellGlob, typeof definingCompilePowerShellGlob>` | Unused identity retired. Public prefix case preserves exact PowerShell compiler metadata; canonical glob owner remains unchanged. |
| `Same<typeof exportedCompilePowerShellRule, typeof definingCompilePowerShellRule>` | Unused identity retired. Public compilation, alias evaluation and shell-isolation cases retain exact results. |
| `Same<typeof exportedParseBashSubcommands, typeof definingParseBashSubcommands>` | Unused identity retired. Public Bash evaluation and recursion-limit fall-open cases remain; canonical bash owner is unchanged and included in focused verification. |
| `Same<typeof exportedParsePowerShellSubcommands, typeof definingParsePowerShellSubcommands>` | Unused identity retired. Public PowerShell evaluation, alias handling and recursion-limit fall-open cases remain; canonical PowerShell owner is unchanged and included in focused verification. |
| `Same<typeof exportedBashSubcommandFires, typeof definingBashSubcommandFires>` | Unused identity retired. Exact Bash match/miss/missing-command and shell-isolation decisions remain. |
| `Same<typeof exportedPowerShellSubcommandFires, typeof definingPowerShellSubcommandFires>` | Unused identity retired. Exact PowerShell match/miss/missing-command/alias and shell-isolation decisions remain. |
| `Same<ExportedCompiledBashGlob, DefiningCompiledBashGlob>` | Type facade identity retired. Retained complete `Same<IfPredicate, ExpectedIfPredicate>` checks the bash payload against canonical `CompiledBashGlob`. |
| `Same<ExportedCompiledPathGlob, DefiningCompiledPathGlob>` | Type facade identity retired. Complete predicate union proof retains canonical path payload type. |
| `Same<ExportedCompiledPowerShellGlob, DefiningCompiledPowerShellGlob>` | Type facade identity retired. Complete predicate union proof retains canonical PowerShell payload type. |

The complete context type proof, all positive/negative predicate type cases, shell compiler failure cases, malformed-prefix case, MCP results, six-arm dispatch case, and unsupported-predicate error case remain.

## Task 2: Canonical Error and Type-Only Outcome Owner

The shared error helper's default diagnostic stays `Unexpected value: ${String(x)}`. A supplied message preserves the hook diagnostic, including JSON serialization, through one throwing implementation. The optional message has eight real production consumers. The duplicate hook function is removed after all production imports move.

`tests/bridges/hooks/exec-result.test.ts` retains nine positive `satisfies` checks and five `@ts-expect-error` negative checks for the closed union. Its sole runtime error test moves to the shared owner; no decorative runtime case replaces it.

| Original assertion | Canonical shared-owner replacement |
| --- | --- |
| Hook `assert.throws` observes an exception | Shared caller-message test uses `assert.throws`. |
| Hook error is an `Error` instance | Identical `instanceof Error` assertion. |
| Hook error constructor is exactly `Error` | Identical exact constructor assertion. |
| Hook name is exactly `Error` | Same whole `{ name, message, cause }` assertion. |
| Hook message is exactly `unreachable HookExecResult arm: {"kind":"future"}` | Same independent literal expected message in the whole error assertion. |
| Hook cause is exactly `undefined` | Same whole error assertion. |
| Shared default name is exactly `Error` | Retained, strengthened with instance and exact constructor assertions. |
| Shared default message is exactly `Unexpected value: future-arm` | Retained, strengthened with absent-cause assertion. |

The moved direct misuse tests use documented compiler-negative calls rather than `as never` casts. No new unreachable consumer test or test-only production export was introduced.

## TDD Evidence

Before production changes, `node --test --test-name-pattern=assertNever tests/shared/errors.test.ts` exited 1 with two discovered cases: the existing default-message case passed and the new caller-message case failed its exact object assertion. Expected message: `unreachable HookExecResult arm: {"kind":"future"}`. Actual: `Unexpected value: [object Object]`.

The TAP capture is persisted in `/tmp/05-06-red-evidence.json`. `node .codex/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence /tmp/05-06-red-evidence.json` returned `RED_EVIDENCE_OK`. That parser only recognizes the enclosing `assertNever` suite as the failing target; the record also names the exact failing child case. The canonical optional message then made both cases pass.

## Verification

The combined focused command passed 273 reported tests, with no failures, skips or cancellations:

```text
node --test tests/bridges/hooks/if-field/index.test.ts tests/bridges/hooks/if-field/glob.test.ts tests/bridges/hooks/if-field/bash.test.ts tests/bridges/hooks/if-field/powershell.test.ts tests/bridges/hooks/dispatch.test.ts tests/bridges/hooks/event-adapters.test.ts tests/bridges/hooks/exec-result.test.ts tests/shared/errors.test.ts
```

The type-only exec-result owner appears as one file-level runner entry; it contains zero runtime cases. All other discovered cases are named runtime tests.

Each row below ran `npm run test:coverage:direct -- extensions/pi-claude-marketplace/<source>` and exited 0. These are canonical direct-owner measurements, not aggregate or integration coverage:

| Source | Lines | Branches | Functions |
| --- | --- | --- | --- |
| `bridges/hooks/if-field/index.ts` | 527/527 | 73/73 | 13/13 |
| `bridges/hooks/if-field/glob.ts` | 559/559 | 88/88 | 15/15 |
| `bridges/hooks/dispatch.ts` | 510/510 | 68/68 | 12/12 |
| `bridges/hooks/event-adapters.ts` | 353/353 | 59/59 | 7/7 |
| `bridges/hooks/exec-result.ts` | Type-only | Type-only | Type-only |
| `shared/errors.ts` | 773/773 | 132/132 | 51/51 |

All test and coverage runs used the approved unsandboxed Node execution path to avoid Node 26's false file-only discovery. File-scoped ESLint found only import ordering in dispatch/adapters; its `--fix --max-warnings=0` run passed, and those two direct owners were remeasured afterward. The other seven files passed scoped lint without changes. Prettier and `git diff --check` passed. Parent-owned whole-tree typecheck, census/control checks and native aggregate production coverage remain pending integration.

## Reviewed Finding Dispositions

Expected reviewed removals, to be checked against the parent's complete stable-wave census:

- `unused_exports` on `bridges/hooks/if-field/index.ts`: `compileBashGlob`, `compilePathGlob`, `compilePowerShellGlob`, `bashSubcommandFires`, `parseBashSubcommands`, `compilePowerShellRule`, `parsePowerShellSubcommands`, `powerShellSubcommandFires`. Each unused facade binding is retired; the live implementation remains in its coherent production owner.
- `duplicate_exports: assertNever` group containing `bridges/hooks/exec-result.ts` and `shared/errors.ts`: the duplicate implementation retires and all eight live calls use the shared owner.

The three removed type conveniences were not independent findings in the research snapshot. No live census or pin was edited by this executor, and no finding is declared closed from a count alone.

## Deviations from Plan

The parent approved a caller-supplied message on the canonical helper after tracing both exact existing error contracts. This preserves behavior without changing the three additional owner tests outside this plan's file set. Shared API work and its RED evidence precede the import switch because the callers require the optional message. Commit and wave verification ownership remain with the parent as instructed.

## Self-Check: PASSED

All nine declared source/test files and this summary exist. The duplicate hook function and facade convenience exports are absent; one canonical throw remains. No new stub, skipped test, coverage exclusion, threshold change, external endpoint or filesystem trust boundary was introduced. Commits are parent-owned and have not been claimed.

## Parent integration: type-only owner

The parent added only exec-result.test.ts to the exact no-empty-test-file exception and independent control list. All fourteen Sonar controls pass, including removing that exception and observing the required diagnostic. All earlier rule and type-owner controls remain. Evidence: `/tmp/test-backlog-wave2-sonar.log`. The plan now records this two-file parent-owned integration task. No estimated diff size is reported as actual token usage.


## Final parent acceptance

Completed in `080d395e` with the five-plan stable wave. The earlier pending integration statements record executor handoff status and are superseded by this acceptance. The final complete census is 85 findings: exactly 26 reviewed initial findings removed, with no additions. The early frontmatter facade retirement accounts for the change from the intermediate 86-finding snapshot. All 53 analyzer/census controls pass. Native unit tests pass 6,230/6,230, with production coverage exactly 63,120/63,120 lines, 1,848/1,848 functions and 9,099/9,099 branches across 225 emitted modules. All 233 direct pairs pass; the two pre-existing shortfalls match their unchanged pins. The complete pre-commit gate passes and independent review reports no findings across all 54 changed paths. See [wave verification](05-WAVE-2-VERIFICATION.md) for logs, limits and assertion preservation. EXPORT-01 and EXPORT-02 remain open for later plans.
