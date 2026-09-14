---
phase: 06
slug: unused-type-member-gate
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-14
---

# Phase 6 — Validation Strategy

Planning is complete; implementation and validation results are pending. There are eight bounded plans, nineteen tasks and seven execution waves. Wave 2 runs directed flow (06-02) and the contract engine (06-03) in parallel with disjoint ownership. All other ordering reflects analyzer integration, the live Phase 5 dependency, or shared files.

## Required outcome and limits

An unread optional member planted in the **actual** EdgeDeps declaration must fail the normal static gate. Its real-read benign counterpart must pass. A declaration, indexed-access type, unrelated same-spelling field, shape compatibility, or declaration enumeration must not count as a runtime read.

The analyzer establishes a bounded **may-observe** property from AST observations and actual directed value transfers. It does not establish branch execution, usefulness of a test assertion, or soundness for arbitrary TypeScript/JavaScript. Accepted records carry exact declaration and witness paths, distinguishing production observations from genuine observations only in tests. Precise type-system/external contracts are a separate evidence category. Unread and unsupported-analysis records fail; malformed setup/internal failures are distinct process outcomes.

The researched 234 files, 3462 candidates and 228 unresolved rows are provisional historical observations. Neither those counts nor the prototype's accepted rows are a shipping baseline. Plan 06-06 remeasures every live candidate after Phase 5 is complete and stable.

## Architecture and chosen interfaces

- `check-unused-type-members.mjs`: inert-on-import CLI, `--root`, `--json`, contained existing-file CompilerHost `--overlay`; exit 0 clean, 1 member findings, 2 setup/internal failure. Never import or execute analyzed source.
- `.analysis.mjs`: compile configured inputs, compose observations/flow/operations/contracts, and produce deterministic versioned reports.
- `.model.mjs`: compiler declaration/symbol identity, complete candidate inventory and AST read/write/type classification.
- `.flow.mjs`: origin/property-path value nodes and actual directed transfers, including callbacks, nested containers and refinements.
- `.operations.mjs`: symbol-identified shallow/deep operations and derived/body-validated wrapper summaries.
- `.contracts.mjs` plus `.contracts.json`: exact necessary external/type-system contracts with drift checks; no wildcards or grandfathered finding counts.
- `.audit.mjs`: fresh population/ledger reconciliation; `--check` fails any unread, unsupported, missing or stale evidence. This reports the analyzer's verdict; it does not override it.
- `.negative.mjs`: real CLI offender/benign execution and detector/harness defect controls.

Exact presence observations (`in` or resolved own-property checks) may establish member existence and are explicitly tagged separately from value reads. Keys-only enumeration is not a per-member value consumer. Whole-object consumers require actual operand provenance and proven eligible-key semantics; interfaces alone do not prove own/enumerable properties.

## Execution and source ownership

| Wave | Plans | Result |
| --- | --- | --- |
| 1 | 06-01 | Compiler-to-CLI tracer, exact inventory/AST observation contract |
| 2 | 06-02, 06-03 | Directed transfers and validated contracts in disjoint files |
| 3 | 06-04 | Whole-object operations and pipeline integration |
| 4 | 06-05 | Audit instrument and stable post-Phase-5 live inventory |
| 5 | 06-06 | Live model/contract corrections and zero-unexplained closure |
| 6 | 06-07 | Actual EdgeDeps offender/benign and negative-runner discrimination |
| 7 | 06-08 | Mandatory npm/pre-commit/CI integration and final full evidence |

Plan 06-05 Task 2 cannot begin live inventory until Phase 5 verification records completion and production/test owners have finished writes. Compiler/control development in 06-01 through 06-04 can proceed before that boundary.

The exact files needing genuine production-member removal cannot be known until that fresh inventory. Plan 06-06 explicitly owns analysis corrections, strict contract validation and closure. If it proves a genuine source repair outside those owners, the orchestrator must create a concrete bounded owner-specific Phase 6 GSD plan (exact files, at most five per task, paired tests, assertion/coverage ledger), execute it under existing authorization, and resume closure. Record those plan IDs and dependencies in 06-LIVE-TRIAGE.md and update 06-07/06-08 dependencies as needed. There is no permission checkpoint or acceptance of unresolved rows. The live closure task and gate activation remain incomplete until all repairs pass. This is a required execution-time refinement based on unavailable post-Phase-5 evidence, not an omitted cleanup allowance.

Every plan has 2–3 tasks, at most nine distinct files, and each task at most five files. A leading tracer proves that plan's actual path. No plan creates one production module per private helper or changes production design merely to appease analysis.

Executable package aliases are added with the CLI (06-01), audit tool (06-05) and negative runner (06-07) so new tools have real package entry ownership immediately. The CLI supplies 06-03's contract validator through 06-01's established contractEvaluator interface; that preserves production reachability and allows 06-02 and 06-03 to modify disjoint files. Mandatory npm check activation remains 06-08 after closure.

## Test infrastructure and feedback cadence

Use installed TypeScript 6.0.3 and Node's native test runner. Existing script tests live under `tests/scripts`; the normal unit command already discovers them. Reuse the documented .mjs import boundary pattern in `tests/scripts/check-phase-06-hub-ledger.test.ts` when TypeScript declarations are needed, without loosening compiler/lint configuration. No package installation is planned.

Each new behavior starts with a failing independently authored test in its creating task. The missing new test files are deliberate task outputs, not an unassigned scaffold. The audit split preserves all original eighteen tasks' behavior and separates its instrumentation and live-inventory responsibilities into two independently verified tasks, giving nineteen tasks in total. The research's final-diagnostic, performance and boundary-drift planning questions are resolved by explicit adopted policies and task links; implementation acceptance remains pending. Plan 06-06 Task 2 must record measured work/time and budget rationale, deliberately fail exhausted-budget controls, and revalidate installed boundary contracts before zero-unexplained closure. Plan 06-08 Task 1 checks this evidence before activation.

Wave 0 is complete only when the 06-01 compiler/CLI fixture harness exists and passes its first tracer. Small compiler/CLI fixture suites target under 30 seconds; measure real performance before setting whole-tree process budgets. Budget exhaustion must fail explicitly. Expensive stable-tree/live control runs are scheduled at integration boundaries rather than after every small edit.

Run focused automated checks after each task. The orchestrator runs typecheck/lint/format plus unchanged native aggregate production unit and direct-pair gates once per stable integration wave. Record the exact snapshot and reuse results until a relevant change invalidates them. Never repeat a full aggregate run for documentation-only changes.

## Per-task verification map

| Task | Wave | Requirement | Test type | Automated command | Test availability | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 06-01-T1 | 1 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.test.ts` | Created by this task or earlier dependency | Pending |
| 06-01-T2 | 1 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.model.test.ts tests/scripts/check-unused-type-members.test.ts` | Created by this task or earlier dependency | Pending |
| 06-01-T3 | 1 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.test.ts tests/scripts/check-unused-type-members.model.test.ts` | Created by this task or earlier dependency | Pending |
| 06-02-T1 | 2 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.flow.test.ts` | Created by this task or earlier dependency | Pending |
| 06-02-T2 | 2 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.flow.test.ts` | Created by this task or earlier dependency | Pending |
| 06-02-T3 | 2 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.flow.test.ts tests/scripts/check-unused-type-members.model.test.ts` | Created by this task or earlier dependency | Pending |
| 06-03-T1 | 2 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | Created by this task or earlier dependency | Pending |
| 06-03-T2 | 2 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.contracts.test.ts` | Created by this task or earlier dependency | Pending |
| 06-04-T1 | 3 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.operations.test.ts tests/scripts/check-unused-type-members.contracts.test.ts` | Created by this task or earlier dependency | Pending |
| 06-04-T2 | 3 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.operations.test.ts tests/scripts/check-unused-type-members.flow.test.ts` | Created by this task or earlier dependency | Pending |
| 06-04-T3 | 3 | MEMBER-01, MEMBER-02 | compiler/CLI fixture | `node --test tests/scripts/check-unused-type-members.test.ts tests/scripts/check-unused-type-members.model.test.ts tests/scripts/check-unused-type-members.flow.test.ts tests/scripts/check-unused-type-members.contracts.test.ts tests/scripts/check-unused-type-members.operations.test.ts` | Created by this task or earlier dependency | Pending |
| 06-05-T1 | 4 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/scripts/check-unused-type-members.audit.test.ts` | Created by this task or earlier dependency | Pending |
| 06-05-T2 | 4 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/scripts/check-unused-type-members.audit.test.ts && node scripts/check-unused-type-members.audit.mjs --inventory` | Created by this task or earlier dependency | Pending |
| 06-06-T1 | 5 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/scripts/check-unused-type-members.live.test.ts tests/scripts/check-unused-type-members.model.test.ts tests/scripts/check-unused-type-members.flow.test.ts tests/scripts/check-unused-type-members.operations.test.ts` | Created by this task or earlier dependency | Pending |
| 06-06-T2 | 5 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/scripts/check-unused-type-members.contracts.test.ts tests/scripts/check-unused-type-members.live.test.ts && node scripts/check-unused-type-members.audit.mjs --check` | Created by this task or earlier dependency | Pending |
| 06-07-T1 | 6 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/scripts/check-unused-type-members.negative.test.ts tests/architecture/unused-type-member-gate.test.ts` | Created by this task or earlier dependency | Pending |
| 06-07-T2 | 6 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/scripts/check-unused-type-members.negative.test.ts && node scripts/check-unused-type-members.negative.mjs` | Created by this task or earlier dependency | Pending |
| 06-08-T1 | 7 | MEMBER-01, MEMBER-02 | fixture + live evidence | `node --test tests/architecture/unused-type-member-gate.test.ts && npm run lint:type-members && npm run lint:type-members:negative` | Created by this task or earlier dependency | Pending |
| 06-08-T2 | 7 | MEMBER-01, MEMBER-02 | fixture + live evidence | `npm run check && npm run test:coverage:unit && npm run test:coverage:direct:all` | Created by this task or earlier dependency | Pending |

Every task also has an explicit `<fails_when>` counterexample and an `<assertion_coverage_ledger>` row in its PLAN. Execution records the independently authored expected behavior, counterexample, command/result, new analyzer branches exercised, preserved existing assertions and production/direct coverage impact in its SUMMARY. A green process status alone never proves correct detection.

## Required control matrix

| Area | Accepted evidence | Required rejecting counterexample | Plan |
| --- | --- | --- | --- |
| Inventory/identity | Exact declaration/root/merged/instantiated symbols; nested/anonymous members | Same key on unrelated type; missing candidates or empty inventory | 06-01 |
| Syntax | Dot/optional/literal/finite computed reads; receiver/key reads; binding and assignment destructuring | Declaration, initializer destination, simple write/delete/loop target, indexed-access/type query | 06-01 |
| Read-write/presence | Compound/logical/update reads and tagged exact presence | Keys-only enumeration and type-only presence | 06-01 |
| Local flow | Actual aliases, assignments, conditional, return and nested source paths | Structural assignability without a transfer; unread sibling | 06-02 |
| Calls/callbacks | Resolved implementation parameters, generics, callback input and output direction | Unrelated callable, reversed transfer or passed-but-unread parameter | 06-02 |
| Containers | Actual array/tuple, Promise and Map/WeakMap value transfer | Wrong tuple/field path, key/value confusion, cycle/cutoff clean result | 06-02 |
| Type-system purpose | Actual unique-symbol brand and demonstrated selection relationship | Fake brand, ordinary sibling, filter-shaped syntax without narrowing | 06-03 |
| External outputs | Exact member origin reaches evidenced return/output boundary | Upstream existence without local transfer or new unread sibling | 06-03, 06-06 |
| External inputs | Demonstrated indispensable local signature/type purpose | Unused upstream input mirror without local purpose | 06-03, 06-06 |
| Contract integrity | Current exact identity/schema/boundary/proof | Missing, duplicate, wildcard, unknown keys, stale or redundant exception | 06-03, 06-06 |
| Shallow operations | Proven own enumerable sources; rest exclusions; assign source roles | Recursive credit from shallow copies; target/key-only/unknown-enumerability credit | 06-04 |
| Serialization | Actual JSON semantics and wrapper-body evidence preserve nested source origins | Shadowed name, changed wrapper body, unsupported replacer/toJSON/symbol semantics | 06-04 |
| Test observations | Genuine production result metadata/deep-comparison read, independently authored expectations | Identity comparison, freshly built typed expected literal, declaration enumeration | 06-04 |
| Relevant unknowns | Independent direct witness may settle a candidate | Erased origin, unbounded reflection or exhausted budget without separate witness | 06-01, 06-02, 06-04 |
| Live population | Fresh fingerprint, every candidate explained, zero unread/unsupported | Historical prototype count allowance, omitted rows or stale evidence | 06-05, 06-06 |
| Actual EdgeDeps | Current member witnesses and real-read benign overlay | Actual optional neverReadAnywhere plant and unrelated same-name read | 06-07 |
| Harness | Exact intended diagnostic/span/status and successful benign run | Always-pass/fail, wrong member, malformed JSON, setup/launch failure | 06-07 |
| Integration | Identical CLI/negative invocation in npm check and whole-project hook | Reader removal in another file not triggering; dropped/weakened existing gate | 06-08 |

## Coverage and assertion preservation

The final unchanged commands are `npm run check`, `npm run test:coverage:unit` and `npm run test:coverage:direct:all`. Use the native `coverage/unit.lcov` generated by the unit runner and inspect the entire production inventory: line, branch and function coverage must meet the user's 100 percent aggregate production unit requirement, including direct-pair pin floors. Integration/E2E coverage cannot substitute. Do not change exclusions, coverage thresholds, pin values, source layout or assertion contracts to improve measured results.

New analyzer script branch tests are meaningful static-analysis behavior tests. They do not replace existing production unit tests or direct pins. Any evidence-driven production source repair receives its own exact owner/paired-test plan and before/after assertion/coverage ledger before it may contribute to the zero-unexplained closure.

## Multi-source coverage audit

| Source | ID | Required item | Plans | Status |
| --- | --- | --- | --- | --- |
| GOAL | Phase 6 | Automated unread optional EdgeDeps detection | 06-01, 06-06, 06-07, 06-08 | COVERED |
| REQ | MEMBER-01 | Static interface/type member gate | 06-01 through 06-08 | COVERED |
| REQ | MEMBER-02 | Discriminating controls and justified contracts | 06-03, 06-04, 06-07, 06-08 | COVERED |
| CONTEXT | D-01 | Actual EdgeDeps offender, no declaration witness | 06-01, 06-07 | COVERED |
| CONTEXT | D-02 | Production/test read separation, genuine assertions | 06-01, 06-04, 06-07 | COVERED |
| CONTEXT | D-03 | Symbol identity and actual directed value transfers | 06-01, 06-02, 06-04 | COVERED |
| CONTEXT | D-04 | AST classification and resolved bulk consumers | 06-01, 06-04 | COVERED |
| CONTEXT | D-05 | Precise necessary contracts and drift controls | 06-03, 06-06 | COVERED |
| CONTEXT | D-06 | Witnesses, unsupported diagnostics and honest scope | 06-01, 06-02, 06-04, 06-08 | COVERED |
| CONTEXT | D-07 | Existing stack, same normal gate, all coverage/assertions preserved | 06-01, 06-06, 06-08 | COVERED |
| CONTEXT | D-08 | Offender/benign, exact processes and harness controls | 06-04, 06-07 | COVERED |
| CONTEXT | D-09 | Fresh whole live population and zero unexplained | 06-06 closure including required owner-specific follow-ups; 06-08 | COVERED |
| RESEARCH | Compiler inventory | Installed program, nested/anonymous declarations, AST before reference flags | 06-01 | COVERED |
| RESEARCH | Directed flow | Aliases, assignments, callbacks, returns, generics, containers and intermediate nodes | 06-02 | COVERED |
| RESEARCH | Operation semantics | Own/enumerable shallow operations, JSON/deep comparisons, wrapper drift | 06-04 | COVERED |
| RESEARCH | External boundaries | Exact Pi output paths, input local purpose, hook serializers | 06-03, 06-04, 06-06 | COVERED |
| RESEARCH | Type proofs | Primitive/object nominal brands and selection refinements retained | 06-03, 06-06 | COVERED |
| RESEARCH | Live difficult cases | Nested replacement/WeakMap, anonymous callbacks, details and test-only metadata | 06-02, 06-04, 06-06 | COVERED |
| RESEARCH | Unknowns/performance | Relevant failure diagnostics, cycle/cache/budget safeguards and measured runtime | 06-01, 06-02, 06-08 | COVERED |
| RESEARCH | Real controls | Actual-source overlay, sibling controls, expected-literal rejection, always-pass mutant | 06-04, 06-07 | COVERED |
| RESEARCH | Normal integration | Package/whole-project pre-commit trigger and CI npm check | 06-08 | COVERED |
| RESEARCH | Security | Parse only, contained overlays, strict contracts and safe bounded subprocesses | 06-01, 06-03, 06-07 | COVERED |

No deferred idea is implemented. No new dependency or package installation is required. The only execution-time plan refinement is exact source-remediation ownership after the live Phase 5 inventory; all such work remains mandatory before closure.

## Sign-off

Planning verification after revision: all eight PLAN files pass GSD frontmatter schema and plan-structure validation with zero errors or warnings. The revised scope has nineteen tasks, no same-wave file overlap, at most nine files per plan and five per task, and explicit fails_when/automated checks on every task. These are planning checks; implementation results remain pending below.

- [x] All planned tasks have automated verification, explicit fails_when and an assertion/coverage ledger.
- [x] Plan scopes and same-wave write ownership are bounded.
- [x] All locked decisions and requirement/research items have execution owners.
- [ ] New analyzer/control tests implemented and passed.
- [ ] Stable post-Phase-5 population reconciled; any additional owner plans executed.
- [ ] Real EdgeDeps offender/benign and negative-harness mutants passed.
- [ ] Final native aggregate production unit coverage is 100 percent and direct floors/assertions are unchanged.
- [ ] Normal npm/pre-commit/CI path and supported-scope evidence verified.
