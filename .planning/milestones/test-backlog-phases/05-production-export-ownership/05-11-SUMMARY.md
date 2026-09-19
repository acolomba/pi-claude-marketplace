---
phase: 05-production-export-ownership
plan: "11"
subsystem: hook-contracts
tags: [export-ownership, hooks, validation, drift-proofs]
status: complete
requires:
  - phase: 05-production-export-ownership
    plan: "10"
    provides: Strict resolver ownership and preserved hook-only resolution
provides:
  - Private hook schema behind its live validator and public resolver
  - Distinct resolver and notification context names
  - Private event completeness proof consumed by the public registration contract
affects: [05-production-export-ownership]
tech-stack:
  added: []
  patterns: [public-contract-assertions, consumed-type-proofs, compiler-controls]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - tests/domain/components/hooks.test.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/schema.ts
    - tests/domain/components/hooks/schema.test.ts
    - tests/architecture/hooks-foundation.test.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/domain/components/hook-events.test.ts
    - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
    - tests/shared/concerns/hooks.test.ts
key-decisions:
  - Inspect the unchanged private hook schema through the existing live validator Type API in its real owner.
  - Preserve event completeness with a private proof consumed by the actual public registration tuple, without analyzer exemptions.
  - Prove the missing-event failure from actual production declarations independently of downstream matcher tables.
completed: 2026-09-14
plan_head_before: ce407cf6049492e238d4acb2e4a53e690595dde8
actuals:
  tasks: 2
  commits: 0
---

# Phase 5 Plan 11: Hook validation and event ownership summary

Hook parsing retains its complete input and error contracts while the facade's unused schema and validator exports disappear. Event and notification types have distinct owners, and the private event completeness proof now participates in the actual public registration contract.

## Completion and coordination

Both tasks are implemented across the declared nine source/test files. Preparation stayed under `/tmp` until the parent authorized execution after Wave 3 source commit `6a463603` and records commit `ce407cf6`. All nine baseline SHA-256 hashes matched before applying. CodeGraph revalidation is recorded in `/tmp/phase5-11-apply-codegraph.txt`; the reviewed patch, manifest, and preparation ledger remain in `/tmp/phase5-11-prepared`.

Source and plan writes are frozen. This executor created no commits and modified no shared configuration, census pin, root state, or unrelated source. The parent coordinates stable-wave review, census reconciliation, aggregate coverage, precommit, commits, and final summary status. Actual token usage is unavailable and is not estimated. The final foundation-test baseline was sent to the Plan 05-12 executor for its subsequent state-schema migration.

## Implementation and caller evidence

- `parseHooksConfig` still imports the real `HOOKS_VALIDATOR` directly from its schema owner and uses its existing `Check` and `Errors` operations. Only the unused facade re-exports retire.
- `HOOKS_CONFIG_SCHEMA` becomes private; its TypeBox construction, compiled validator, exported derived types, and validation behavior are unchanged. The recursive schema invariant uses the existing validator `Type()` API in the schema owner.
- `ResolveHookIfContext` replaces only the domain `CompileIfPredicateContext` name in real parser/compiler-callback signatures. The distinct bridge context stays unchanged.
- `HookSummaryToolEvent` replaces only the shared notification `ToolEvent` name and is consumed by `HookSummaryEntry`. The domain event type, matcher semantics, and production imports stay unchanged.
- A private canonical tuple retains the same ten event literals and registration order. `BUCKET_A_EVENTS` references that same array and retains its readonly literal tuple type. Its real `satisfies` constraint consumes the private completeness proof, while `BucketAEvent` stays derived from the public tuple.

## Assertion ledger

| Original contract | Final disposition and assertion |
| --- | --- |
| Foundation recursive schema walker and exact empty offender list for nested `additionalProperties: false` | Same recursive implementation and empty-list assertion move to the schema owner, using `HOOKS_VALIDATOR.Type()`. No new seam or schema export is introduced. |
| Foundation validator accepts unknown handler properties | Complete public parse success now asserts the retained extension field, exact command and matcher fields, empty dropped list, and empty predicate map. |
| Foundation validator accepts unknown matcher-group properties | Complete public parse success now asserts the retained group extension field, exact remaining fields, empty dropped list, and empty predicate map. |
| Foundation validator accepts an unknown event key | Complete public parse success now asserts empty accepted configuration, exact `{ kind: "event", event: "FutureEventX" }` dropped record, and empty predicate map. |
| Foundation state version, required hook resources, and hook-only strict resolution | All existing assertions remain unchanged. Plan 05-12 owns the later state-schema migration. |
| Schema owner's five accepted and thirteen rejected inputs | All eighteen checks remain unchanged: primitive/null/array rejection; missing and wrongly typed handler fields; unknown handler kinds; lenient extra properties. |
| Schema owner's positive and negative derived-type proofs | All remain unchanged; runtime schema construction and public derived contracts are preserved. |
| Public hook parser's sixteen runtime cases | All original assertions remain unchanged: bare/wrapped empty configuration; primitive/null/array/invalid JSON errors; malformed group and command errors; accepted/drop partitioning; compiler arguments and predicate map; skipped compilation; summary projection; persisted narrowing; upstream fixture; unsupported events and mixed event/matcher siblings. |
| Domain context structure | The real fixture now satisfies the renamed public context. New negative proofs reject missing project root and numeric working directory. Runtime fixture values and expected compiler arguments remain unchanged. |
| Imported private event proof resolves to `never` | Replaced by bidirectional exact event-set equality through public `ClaudeHookEvent` and `BucketAEvent`. The test no longer imports a private proof. |
| Event registration order, tool subset and relative order, dispatchable set, matcher field map, closed matcher vocabularies | All six runtime tests retain their complete independently written expected values. |
| Existing positive and negative event type checks | All remain through public contracts. Domain `ToolEvent`, `DispatchableEvent`, and closed error vocabulary remain unchanged. |
| Missing-event compiler failure | Two real compiler cases extract the actual six production declarations and actual shared event union. Complete registration emits exactly zero diagnostics; deleting only SessionStart emits exactly TS2344: `Type '"SessionStart"' does not satisfy the constraint 'never'.` Isolation prevents unrelated downstream matcher-table errors from masking a missing proof. |
| Shared notification type proofs | References use `HookSummaryToolEvent`; all positive tool-event and negative non-tool-event checks remain, including summary-entry discriminants. |
| Shared formatting owner's nine runtime cases | All complete line-array assertions remain unchanged: absent/empty input, strict tool/non-tool entries, lenient suffixes, indentation, absent versus empty matcher, and duplicate ordering. |

The compiler controls use a fresh temporary directory, fixed source inputs, guaranteed cleanup, and TypeScript's installed compiler API. No external service, runtime type seam, or manufactured production consumer is involved.

## Finding dispositions

Six original finding identities are expected to disappear. The parent verifies the stable-wave delta; no whole-tree census or pin update was performed by this executor.

| Original finding | Disposition |
| --- | --- |
| `unused_exports`: domain/components/hooks.ts `HOOKS_CONFIG_SCHEMA` | Remove unused facade re-export. |
| `unused_exports`: domain/components/hooks.ts `HOOKS_VALIDATOR` | Remove unused facade re-export; live schema-owner export remains. |
| `unused_exports`: domain/components/hooks/schema.ts `HOOKS_CONFIG_SCHEMA` | Private implementation still drives the compiled validator and derived types. |
| `unused_types`: domain/components/hook-events.ts `_BucketAEventsCoverageProof` | Private proof consumed by the real registration tuple's constraint. |
| `duplicate_exports`: `CompileIfPredicateContext` across bridge/domain | Rename domain contract to `ResolveHookIfContext`; leave bridge contract untouched. |
| `duplicate_exports`: `ToolEvent` across domain/shared | Rename shared contract to `HookSummaryToolEvent`; leave domain contract untouched. |

Preparation also ran two isolated real Fallow 3.22.0 controls over the actual extracted event declarations with production dead-code mode and private-type-leaks set to error. The consumed private proof reports exactly zero findings and exit 0. Adding an unrelated exported `UnusedProof` reports exactly one unused type at `events.ts:UnusedProof`, no private leak, and exit 1. Both reports discover exactly one manual entry point; final stderr files are empty and neither process was signalled. No analyzer exemption is needed. Reports and statuses are `/tmp/phase5-11-analyzer-{consumed,stray-proof}.json`, matching `.stderr` files, and `/tmp/phase5-11-analyzer-status.json`.

## Verification

The applied checkout was verified with native Node discovery outside the sandbox. All commands exited 0; no tests failed, skipped, or were cancelled.

| Check | Result | Evidence |
| --- | --- | --- |
| Five focused owners, `node --test` | 58/58 tests passed | `/tmp/phase5-11-checkout-focused.log` |
| Direct domain/components/hooks.ts | 416/416 lines, 9/9 functions, 36/36 branches | `/tmp/phase5-11-checkout-direct-domain-components-hooks.log` |
| Direct domain/components/hooks/schema.ts | 61/61 lines, 0/0 functions, 1/1 branches | `/tmp/phase5-11-checkout-direct-domain-components-hooks-schema.log` |
| Direct domain/components/hook-events.ts | 278/278 lines, 0/0 functions, 1/1 branches | `/tmp/phase5-11-checkout-direct-domain-components-hook-events.log` |
| Direct shared/concerns/hooks.ts | 128/128 lines, 1/1 functions, 15/15 branches | `/tmp/phase5-11-checkout-direct-shared-concerns-hooks.log` |
| `npm run typecheck` | Exit 0 | `/tmp/phase5-11-checkout-typecheck.log` |
| Scoped ESLint across all nine source/test files | Exit 0 | `/tmp/phase5-11-checkout-eslint.log` |
| Scoped `git diff --check` | Exit 0 | Applied source/test and plan diff |

Each direct command was `npm run test:coverage:direct -- extensions/pi-claude-marketplace/<exact module above>`. Combined direct coverage is 883/883 lines, 10/10 functions, and 53/53 branches. The focused command includes tests/domain/components/hooks.test.ts, tests/domain/components/hooks/schema.test.ts, tests/architecture/hooks-foundation.test.ts, tests/domain/components/hook-events.test.ts, and tests/shared/concerns/hooks.test.ts. Parent-owned aggregate and stable-wave gates remain pending.

## Deviations and refinements

The existing two tasks were clarified without scope expansion: the nested schema invariant moves unchanged to its real owner through the existing validator API, while foundation behavior is asserted through complete public parse results. The event control isolates actual production declarations so the specific proof must reject the offender. The original long BucketAEvent JSDoc was moved beside the actual exported type, replacing a redundant short comment; this changes no runtime or proof behavior.

No new stubs, deferred source defects, dependencies, or security-relevant surfaces were introduced.

## Self-Check: PASSED

All nine intended source/test files and the amended plan exist. Baseline hashes matched before applying; focused/direct/typecheck/lint and whitespace checks pass on the applied checkout. This summary records zero executor commits because the parent explicitly owns the combined reviewed commit. Final wave verification remains pending.


## Final parent acceptance

Completed in `851c5e26`. The stable wave passes 6,242/6,242 unit tests with exact 100% coverage across 225 emitted production modules: 62,664/62,664 lines, 1,835/1,835 functions and 9,063/9,063 branches. All 58 analyzer/census/Sonar controls and mandatory pre-commit checks pass, including affected direct pairs. Independent review has zero open findings across 22 changed source/test paths; all thirteen restored-export compiler controls reject their offenders. The complete census is 57 → 42: fifteen exact removals, zero additions. RingBuffer.read remains in the census until its proven adjacent exception can be activated with production mode in Plan 05-28. See [wave verification](05-WAVE-4-VERIFICATION.md). EXPORT-01 and EXPORT-02 remain open for later plans.
