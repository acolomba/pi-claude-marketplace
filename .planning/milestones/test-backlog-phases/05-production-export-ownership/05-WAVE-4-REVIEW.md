---
phase: 05-production-export-ownership
reviewed: 2026-09-14T16:51:26Z
depth: standard
diff_base: ce407cf6049492e238d4acb2e4a53e690595dde8
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/schema.ts
  - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/hooks-async-rewake.test.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/bridges/agents/index.test.ts
  - tests/bridges/commands/index.test.ts
  - tests/bridges/hooks/async-rewake/pid-table.test.ts
  - tests/bridges/hooks/async-rewake/registry.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/hooks/index.test.ts
  - tests/bridges/skills/index.test.ts
  - tests/domain/components/hook-events.test.ts
  - tests/domain/components/hooks.test.ts
  - tests/domain/components/hooks/schema.test.ts
  - tests/shared/concerns/hooks.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved_findings:
  critical: 2
status: clean
scope_sha256: 0c9cdf4cd868097ea78287f0f309c1af70482c6a2a7476452eb6fe88f8505011
requirements_completed: []
---

# Phase 5 Wave 4 Code Review

## Narrative Findings (AI reviewer)

The final reviewed snapshot has no open findings. Two BLOCKER findings were repaired by the parent and independently checked again: unreliable export-absence assertions (including a lint failure in the first repair), and an annotation that broke the shipping analyzer gate. Frontmatter finding counts describe the final snapshot; the resolved defects are retained below. This review covers plans 05-05 and 05-11 plus the authorized repair of related absence checks in three other barrel owners. It supersedes the earlier 23-file review snapshot.

### CR-01: Export-absence assertions accepted restored exports

**Classification:** BLOCKER. **Status:** Resolved in the reviewed snapshot.

**Files:**

- `/home/acolomba/src/pi-claude-marketplace-test-backlog/tests/bridges/hooks/index.test.ts:22`
- `/home/acolomba/src/pi-claude-marketplace-test-backlog/tests/bridges/agents/index.test.ts:67`
- `/home/acolomba/src/pi-claude-marketplace-test-backlog/tests/bridges/commands/index.test.ts:67`
- `/home/acolomba/src/pi-claude-marketplace-test-backlog/tests/bridges/skills/index.test.ts:82`

**Issue:** The initial hook tests used `undefined satisfies HooksBarrel.Member` under `@ts-expect-error`. Restoring the supposedly forbidden interface still produced an assignability error, satisfying the directive and letting the regression pass. The related agents, commands, and skills tests used `true satisfies Same<Barrel.Member, never>`; restoring a real member likewise left a type error that satisfied the directive. These checks did not prove the claimed absence.

**Reproduction:** A virtual TypeScript compiler host restored all five hook aliases from their actual defining modules. The original owner still emitted zero diagnostics. For each of the other three owners, reconstructing the original assertions and restoring all its forbidden exports also emitted zero diagnostics. These were compiler checks of the actual test files and imports, with mutations held in memory; production files were not changed.

**Intermediate repair and gate failure:** Adding `| undefined` made all 13 restoration controls fail as intended, but the full lint gate rejected the absent member's error-any union under `@typescript-eslint/no-redundant-type-constituents`. The earlier compiler-only qualification did not establish lint compatibility. This intermediate form is not retained.

**Applied final fix:** The parent changed each absence expression to an empty object satisfying an optional property whose type names the retired member:

```typescript
// @ts-expect-error the barrel does not expose this type
void ({} satisfies { readonly retired?: HooksBarrel.HooksFileReader });
```

Value-member checks retain `typeof`. The absent member is the only intended error; a restored member makes the expression valid regardless of its type because the property is optional and omitted. The unused directive then produces TS2578. All four final candidate owners compile with zero diagnostics before mutation. Each independent restoration below produces exactly one diagnostic, TS2578 in that owner at the listed directive line:

| Owner | Independently restored member | TS2578 line |
| --- | --- | --- |
| hooks/index.test.ts | HooksFileReader | 22 |
| hooks/index.test.ts | HooksHydration | 24 |
| hooks/index.test.ts | HooksHydrationDeps | 26 |
| hooks/index.test.ts | ReadAndCachePluginHooksOptions | 28 |
| hooks/index.test.ts | HooksRuntime | 30 |
| agents/index.test.ts | PreparedAgentsStaged | 67 |
| agents/index.test.ts | GENERATED_AGENT_PREFIX | 69 |
| agents/index.test.ts | GENERATED_AGENT_MARKER | 71 |
| agents/index.test.ts | GENERATED_AGENT_MARKER_LEGACY | 73 |
| commands/index.test.ts | PreparedCommandsStaged | 67 |
| commands/index.test.ts | StageCommandsCommitResult | 69 |
| skills/index.test.ts | PreparedSkillsStaged | 82 |
| skills/index.test.ts | StageSkillsCommitResult | 84 |

Type restorations use the actual defining modules. The three agent value restorations use temporary literal exports in the virtual barrel because the tests inspect existence through `typeof`; this does not expose private production implementation modules or alter the checkout. All 13 controls completed successfully for the final optional-property form. Four temporary owner copies, using the exact repository ESLint config, tsconfig, package configuration, and real production imports, also report zero lint errors and warnings. Evidence is `/tmp/wave4-optional-proof-8TVPLC/evidence.json`. No rule was disabled or weakened. The applied, formatted files were compared to these qualified candidates. This closes the finding for the submitted snapshot, including related assertions inherited from earlier waves.

### CR-02: Production-only member annotation broke the shipping analyzer gate

**Classification:** BLOCKER. **Status:** Resolved by deferring the annotation.

**File:** `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts:127` (the former annotation site; the final file matches the base).

**Issue:** The proposed adjacent `unused-class-member` annotation suppressed the genuine production-mode false positive for the live `RingBuffer.read`, but shipping mode already sees test readers and reports this suppression as stale. The shipping/production transition gate consequently failed with `Unnormalized finding category: stale_suppressions`. The parent full unit run reported 6,241/6,242 passing tests despite exact 100% production coverage. The two locality controls run during the initial review were production-mode controls and did not cover this shipping-mode interaction.

**Evidence:** The failure is recorded in `/tmp/test-backlog-wave4-unit-final.log` at the `D-07-20: shipping and production reports measure the entry-point transition` case in `tests/architecture/unowned-exports-census.test.ts:171`. The live registry callers remain at registry.ts lines 445–446; deleting the method would be incorrect.

**Applied fix:** Remove the premature annotation and retain the exact production member finding in the census pin. Parent plan 05-28 now owns activating the narrow annotation atomically with `production: true`. `ring-buffer.ts` is byte-identical to the Wave 4 base and is no longer a changed path. No stale-suppression category or production finding was silently ignored. An independent native rerun of the exact shipping/production transition test passes after removal: one test, zero failures, skips, or cancellations.

## Scope and structural reconciliation

The exact 22 paths above match `/tmp/test-backlog-wave4-commit-files.json`. Source and test changes were reviewed against `ce407cf6`, with CodeGraph consulted before source exploration and the project TypeScript style and unit-testing rules applied. Supporting unchanged runtime, ring buffer, barrel/type definitions, and analyzer controls were read to trace the affected contracts. PLAN/SUMMARY ledgers were checked against the implementation; their parent-owned integration gates are not treated as independently executed evidence.

The production census and unused-export pins in `tests/architecture/gate-targets.ts` were independently parsed as TypeScript literals and compared again by complete finding identity after the final repairs. The full census changes from 57 to 42: exactly 15 removals and zero additions. The unused-export pin changes from 44 to 37: exactly seven removals and zero additions. The current complete identities agree with `/tmp/test-backlog-wave4-census.json`, whose raw report retains 11 entry points and the expected nonzero exit for remaining findings. The `RingBuffer.read` member identity remains pinned. Every removed identity was checked against its source disposition:

| Category | Owner and binding | Source disposition |
| --- | --- | --- |
| unused_exports | bridges/hooks/async-rewake/pid-table.ts: ASYNC_REWAKE_PIDS_FILENAME | Private; real path construction and filesystem operations remain. |
| unused_exports | bridges/hooks/async-rewake/pid-table.ts: ASYNC_REWAKE_PID_TABLE_VERSION | Private; serialized envelope and version validation remain. |
| unused_exports | bridges/hooks/async-rewake/registry.ts: MARKER_ENV | Private; child environment and process-ownership checks remain. |
| unused_exports | bridges/hooks/event-router.ts: createBeforeAgentStartHandler | Private; real registration still constructs and invokes it. |
| unused_exports | domain/components/hooks.ts: HOOKS_CONFIG_SCHEMA | Unused facade re-export removed. |
| unused_exports | domain/components/hooks.ts: HOOKS_VALIDATOR | Unused facade re-export removed; parser still uses defining export. |
| unused_exports | domain/components/hooks/schema.ts: HOOKS_CONFIG_SCHEMA | Private schema still drives compiled validator and derived types. |
| unused_types | bridges/hooks/index.ts: HooksFileReader | Facade alias removed; defining signature contract retained. |
| unused_types | bridges/hooks/index.ts: HooksHydration | Facade alias removed; defining return contract retained. |
| unused_types | bridges/hooks/index.ts: HooksHydrationDeps | Facade alias removed; real factory dependency contract retained. |
| unused_types | bridges/hooks/index.ts: ReadAndCachePluginHooksOptions | Facade alias removed; defining operation contract retained. |
| unused_types | bridges/hooks/index.ts: HooksRuntime | Facade alias removed; defining runtime contract retained. |
| unused_types | domain/components/hook-events.ts: _BucketAEventsCoverageProof | Private constrained proof consumed by actual public tuple declaration. |
| duplicate_exports | CompileIfPredicateContext: bridges/hooks/if-field/index.ts and domain/components/hooks.ts | Domain type renamed ResolveHookIfContext; distinct bridge type unchanged. |
| duplicate_exports | ToolEvent: domain/components/hook-events.ts and shared/concerns/hooks.ts | Shared type renamed HookSummaryToolEvent; distinct domain type unchanged. |

Owner paths in this table are relative to `extensions/pi-claude-marketplace/`.

## Behavioral and assertion review

- The removed inner epoch guard was redundant on the actual registered path. `bindRegistrationCallback` in event-router.ts checks the captured generation at line 472 and calls the inner callback synchronously at line 476. There is no intervening await, external callback, or generation mutation; the real runtime getter only returns its owned counter. Registration still advances the generation and uses this wrapper. Migrated tests call the actual captured registration, retain the exact joined prompt, verify the empty second drain, and show a stale callback leaves the full live buffer untouched. Existing reload ordering and lifecycle assertions remain.
- The PID tests retain independently authored complete serialized bytes and exact filesystem path assertions after direct constant checks disappear. Registry fixtures now use independent marker-key bytes while preserving complete spawn environment, wrong-owner, suffix-lookalike, process failure, finalization, stream, and cleanup expectations. Architecture assertions still require actual synchronous and asynchronous spawns.
- `RingBuffer.read` remains unchanged at line 127 and the real stderr and stdout consumers remain in registry.ts at lines 445–446. The method and its existing owner tests are byte-identical to the base. Production-mode controls establish that an adjacent annotation would preserve unrelated `Peer.read` findings, but shipping mode prevents activating that annotation in this wave. The exact member finding stays open for plan 05-28.
- The recursive schema walker moved to the schema owner and reads the existing compiled validator's actual `Type()` result. The private schema construction and exported derived types are unchanged. The prior unknown-handler/group/event acceptance checks now assert complete public parser results, including retained extension fields or the precise dropped-event record. Existing accepted/rejected schema cases and parser behavior remain.
- The event tuple keeps the same ten literals and order. The private completeness proof is constrained to `never` and consumed by the public tuple's `satisfies` constraint; it is neither exported nor suppressed. The tests compile six actual production declarations with the actual shared event union. Baseline compilation has zero diagnostics; removing only SessionStart yields the precise TS2344 proof failure independently of downstream matcher tables. Public event sets, ordering, maps, and existing type assertions remain.
- Both renamed types retain their original structures and live consumers. The bridge CompileIfPredicateContext and domain ToolEvent remain distinct, unchanged contracts. The three additional barrel files change only the defective absence checks; their exact binding, discriminant, narrowing, and public shape assertions remain intact.
- No production gate is relaxed. The diff against the base is empty for `.fallowrc.json`, `eslint.config.js`, `.pre-commit-config.yaml`, `scripts/test-coverage-direct.pin.json`, `package.json`, and `tsconfig.json`. The architecture census pin edits retire only the verified identities above.

## Independent execution

| Check | Result |
| --- | --- |
| Native Node tests for hooks event-router, hooks barrel, domain hook-events, and hook schema owners | 60 tests passed; 11 suites; zero failures, cancellations, skips, or todos. |
| Native Node production analyzer controls selected by `member annotation remains local` and `local member companion consumes sibling` | Both tests passed; zero failures. |
| Virtual TypeScript restoration probes against all four actual barrel owners | Four final optional-property baselines clean; 13 separate restorations each produce exactly the intended TS2578. Original assertion controls demonstrate the former false negatives. |
| ESLint on four final candidate owner copies with actual repository configuration | Zero errors and warnings; no rule overrides. Applied files match candidates apart from formatting. |
| Native shipping/production transition regression after annotation removal | One test passed; zero failures, skips, cancellations, or todos. |
| Independent AST/literal census and pin comparison after final repairs | Exact 57→42 full and 44→37 unused-export deltas; no additions; both pins equal the raw census; RingBuffer.read retained. |
| `git diff --check ce407cf6 -- extensions/pi-claude-marketplace tests` | Passed after repairs. |

Native Node commands ran outside the sandbox to obtain genuine test discovery. Whole-file-only sandbox results are not counted. The initial 60 focused tests and two locality controls preceded the final optional-property substitution and annotation removal; the final repairs have the independent compiler, lint, exact-file comparison, and shipping-transition evidence above. The full aggregate, direct coverage, broad typecheck, and pre-commit reruns remain parent-owned and are not represented here as reviewer executions. No expensive full gate was rerun by this reviewer.

The scope hash is SHA-256 over sorted manifest paths, each encoded as path bytes, NUL, current file bytes, NUL. The final fixed source snapshot was checked again before handoff. This reviewer made no tracked edits or commits; only this review artifact was created. Other worktree changes are outside this scope and were preserved. EXPORT-01 and EXPORT-02 remain open until the entire phase meets its requirements. Actual token telemetry is unavailable.


## Parent integration acceptance

Completed in `851c5e26`. The stable wave passes 6,242/6,242 unit tests with exact 100% coverage across 225 emitted production modules: 62,664/62,664 lines, 1,835/1,835 functions and 9,063/9,063 branches. All 58 analyzer/census/Sonar controls and mandatory pre-commit checks pass, including affected direct pairs. Independent review has zero open findings across 22 changed source/test paths; all thirteen restored-export compiler controls reject their offenders. The complete census is 57 → 42: fifteen exact removals, zero additions. RingBuffer.read remains in the census until its proven adjacent exception can be activated with production mode in Plan 05-28. See [wave verification](05-WAVE-4-VERIFICATION.md). EXPORT-01 and EXPORT-02 remain open for later plans.
