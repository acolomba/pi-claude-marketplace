---
phase: 07
slug: reliable-coverage-metrics
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-14
---

# Phase 7 — Validation Strategy

Eight plans contain twenty-two tasks across seven waves. These are implementation and acceptance instructions; the producer and production baseline are not certified yet. The source-map adapter (07-03) and independent schema/correspondence validator (07-04) have disjoint ownership and run in parallel after producer-delivery qualification.

## Required acceptance order

| Wave | Plans | Acceptance |
| --- | --- | --- |
| 1 | 07-01 | Same successful native unit run, immutable source/executed-JavaScript capture and complete worker/input identity |
| 2 | 07-02 | Known omission reproduced; selected producer delivered with exact provenance/license and full producer corpus |
| 3 | 07-03, 07-04 | Exact UTF-16 mapping/source names; independent schema/function/statement correspondence |
| 4 | 07-05 | Complete production merging and atomic accepted same-run artifact bundle; freshness controls |
| 5 | 07-06 | Exact Fallow production joins and actual shipping CRAP30 offender/benign/boundary controls |
| 6 | 07-07 | Fresh complete production measurement after stable Phase 6; discrepancies resolved before certification |
| 7 | 07-08 | Actual local/CI order activated; final full quality/native/direct evidence |

Every plan has 2–3 tasks and at most ten declared files; every task has at most five files, an automated verify command, explicit fails_when, and an assertion/coverage ledger. The tracer in each plan proves an actual path before expansion.

Plan 07-02 reaches ten paths because its single producer-qualification chain includes four active code/test files, a targeted upstream traversal patch, two dependency records and three provenance/license/generated-archive artifacts. Its scoped estimate remains 35,000 tokens (11,000/10,000/14,000 by task), below the 100,000-token budget. The plan now records mandatory per-task assertion and hash/provenance acceptance: original counterexample/payload -> deterministic licensed delivery -> exact installed-byte full conformance. Binary/archive contents are inspected by manifest/payload and digest, not loaded as prose. General capture, mapping, correspondence, metric policy and live certification remain separate plans. Broader repair evidence requires a bounded owner-specific follow-up before expanding this plan. This addresses the scope warning by making its actual context boundary and acceptance chain explicit without introducing another plan solely for the path count.

## Adopted planning policies

| Research question | Adopted policy | Binding acceptance |
| --- | --- | --- |
| Producer delivery | Prefer a specifically verified corrected official release. Only 1.0.6 is currently locally verified; a newer registry lookup failed EAI_AGAIN. If no corrected version passes, deliver a reproducible 1.0.6-project.1 npm tarball from verified upstream bytes, visible patch and original MIT license. | 07-02 Tasks 1–3; complete pipeline qualification again in 07-03 through 07-05 |
| Nested walker omission | Suppression of duplicate logical branch registration must retain descendant traversal; functions and body statements must both survive. The one-line research patch is only a lead. | 07-02 full corpus plus independent 07-04 missing-function/missing-statement rejection |
| Exact implicit else | Admit only the pinned producer's absent-location representation when the AST proves an if with no else; confirm actual Fallow consumption. Reject all other missing locations and never fabricate zeros. | 07-04 Task 2 |
| Exact source identity | Preloaded synchronous Node hooks record immutable original and actual evaluated JavaScript under original URLs, using only Node's native stripping. Require equivalence to ordinary native execution before expansion, and reject unsupported transforms or changed loaded bytes. | 07-01 Task 1 tracer and Tasks 2–3 worker/drift controls |
| Complete correspondence | Independent source AST inventory checks one-to-one explicit functions and every covered-statement syntax relationship, not raw/native count equality or Fallow nearest-function matching. | 07-04 Tasks 1–3; 07-05 merge; 07-06 exact consumer join |
| CRAP policy/scope | Separate production risk policy file specifies >=30. Existing all-tree Fallow cyclomatic20/cognitive15/unit-size60/maxCrap0 stays unchanged; the additional wrapper gates the complete production population using verified measured coverage. | 07-06 Tasks 1–3 and 07-08 activation |
| Fresh real measurement | Wait for completed stable Phase 6 and finished Phase 5/6 source writes. Remeasure all source/function/statement identities and retain honest native/AST differences. | 07-07 Tasks 1–2 |
| AST deficits/policy outcome | Investigate every faithful deficit and CRAP>=30 finding. Tooling or legitimate source/test repairs need bounded exact-owner plans and fresh captures. Only a certified substantive product/metric-policy conflict is raised for a decision; no threshold or coverage waiver is inferred. | 07-07 Task 2 before 07-08 Task 1 |

The planning choices above resolve the implementation direction. They do not claim completed runtime tests, a corrected producer release, a validated patch, or a certified current measurement.

## Package provenance and delivery

The research's two SUS labels were age-only signals. The user explicitly requires evaluating actual history/source rather than treating a recent release as malicious. Planning checked the official [converter repository](https://github.com/AriPerkkio/ast-v8-to-istanbul), its locally downloaded 1.0.6 package metadata/distribution and MIT license, and the official [source-map codec package identity](https://github.com/jridgewell/sourcemaps/tree/main/packages/sourcemap-codec). These establish the intended upstream identities; they do not establish functionality. Current registry refresh failed with EAI_AGAIN, so no newer converter is asserted.

| Dependency | Planned exact source | Disposition |
| --- | --- | --- |
| ast-v8-to-istanbul | Verified 1.0.6 source; corrected exact release only after refresh and conformance, otherwise licensed reproducible 1.0.6-project.1 local npm artifact | Official identity verified; unmodified 1.0.6 rejected for fidelity |
| acorn | Reviewed 8.18.0, locked and tested | Existing research registry/provenance audit OK |
| istanbul-lib-coverage | Reviewed 3.2.2, locked and tested | Existing research registry/provenance audit OK |
| @jridgewell/sourcemap-codec | Reviewed 1.6.0, exact package integrity rechecked before install | Official identity verified; age-only signal does not create a permission gate |

Before actual installation verify exact selected registry/archive integrity, manifest, namespace/repository and license against the audit, then use scripts-disabled npm installation. Do not claim the failed latest-version lookup verified any release. Ordinary tests/gates install or consume already-corrected dependency bytes and never patch node_modules. The maintained-patch path retains source URL/hash, patch, original license, deterministic artifact hash and reproduction command. A corrected upstream delivery omits an unnecessary fork.

## Exact runtime and artifact contract

The application engines field remains unchanged. Node26.8.2 was the researched local tool runtime; existing CI uses Node24. The capture/producer corpus must pass on the concrete runtime used by each job, and artifacts bind that exact runtime and all relevant tool/patch hashes. A report from a different runtime or changed producer cannot be reused.

The capture tracer uses [Node synchronous load hooks](https://nodejs.org/api/module.html#moduleregisterhooksoptions) before entry/application modules and in workers. It records the exact source supplied for evaluation and native-stripped JavaScript. This is an implementation choice requiring equivalence controls, not a claim that a custom loader is already validated. Reject position-changing transforms and unexpected loader behavior. Hash complete source/test/support/config/tool sets before/after execution and before publication; compare loaded bytes with immutable pre-run records too.

Each unique run retains source and executed-JavaScript snapshots, raw V8 records, worker completion evidence and native LCOV. Accepted publication adds validated Istanbul, exact source/function/statement correspondence, producer identity receipt and artifact hashes, then atomically writes the manifest last. A captured-only manifest is never accepted-converted. The public outputs are `coverage/unit.lcov`, `coverage/unit.istanbul.json` and `coverage/unit.manifest.json`.

A direct consumer fails missing/stale reports. The orchestrator can explicitly create a fresh run or reuse a content-validated current result; it must never hide a consumer failure by guessing another report. Content hashes and full sets establish freshness, never filenames or modification times.

## Independent producer and consumer controls

| Area | Required positive evidence | Required rejection |
| --- | --- | --- |
| Same-run capture | One native unit execution supplies LCOV and raw data; exact source/worker receipts | Different run IDs, omitted worker, failed tests, missing raw/source/LCOV, interrupted child |
| Immutable inputs | Captured original/evaluated bytes agree with pre-run identity | Mid-load edit even if later reverted; source/test/support/config/tool additions, deletions or changes |
| Coordinates | Exact UTF-16 start/end, same-line and surrogate-pair identities, CRLF, blank lines and EOL endpoint | Negative, null, nonfinite, fractional, reversed/out-of-bounds positions; no clamping |
| Functions | Every explicit function maps exactly both ways; repeated names retain separate spans/counters | Deleted nested callback, same-name/opposite-coverage neighbor, invented or duplicate function |
| Statements | Every adopted statement relationship, including partially covered nested callback bodies | Missing body statement that could force binary function-hit fallback |
| Original names | Exact original AST declaration/identifier proof | Heuristic suffix stripping; real identifier ending _2 |
| Syntax corpus | Arrows, methods/constructors/accessors, async/generators, empty and expression bodies, logical descendants | A traversal that visits outer logical nodes but omits nested callbacks/statements |
| Implicit branches | Exact AST-proven no-else absent-location convention | Any ordinary missing position or fabricated zero |
| Counters/schema | Exact map-counter keys, finite nonnegative integer hits, branch cardinality and supported versions | Missing/extra counters, negative hits, schema/version drift |
| Source population | Every production file; unloaded runtime files have zero models; type-only empty maps have AST proof | Dropped file, empty runtime map, missing source, duplicate/outside-root canonical path |
| Worker merge | Stable source/map identities, fresh AST per conversion, reordered/split captures agree | Reused mutated AST, duplicate snapshot summed twice, mixed-source maps |
| V8 limits | Explicit examples of default-argument/after-throw observation limits | Claiming exact execution where V8 lacks that information |
| Artifact acceptance | Fresh exact manifests/map/source/tool identities | Integration/E2E/foreign-run substitution; altered hashes or stale pointers |
| Consumer identity | Every production Fallow row joins exactly to original AST/Istanbul body with measured source | Estimated coverage, nearby fallback, missing or swapped repeated-name row |
| Threshold | Uncovered CC6 ->42 fails; covered ->6 passes; CC5 at zero ->30 fails; true just-below30 passes | Rounded display deciding verdict or > used where >= is required |
| Scope | Complete production CRAP denominator plus unchanged all-tree complexity/dupes | Test/script rows treated as missing production coverage, excluded extension sources, dropped complexity check |
| Harness | Exact diagnostic/score/member identity and successful benign control | Always-pass/fail, wrong diagnostic, malformed report, signal or launch failure accepted as intended offender |

The producer-level corpus may supply independently authored exact maps as valid input. Full production promotion also requires the separate source-map adapter and strict independent validators; rerun the complete corpus when adapter bytes change. Counts such as AST100 or Fallow1825/1825 are not correspondence evidence.

## Per-task verification map

| Task | Wave | Automated command | Scope | Status |
| --- | --- | --- | --- | --- |
| 07-01-T1 | 1 | `node --test tests/scripts/coverage-capture.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-01-T2 | 1 | `node --test tests/scripts/coverage-capture.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-01-T3 | 1 | `node --test tests/scripts/coverage-capture.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-02-T1 | 2 | `node --test tests/scripts/coverage-producer.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-02-T2 | 2 | `node scripts/build-coverage-producer.mjs --verify` | Small real-runtime/compiler/CLI controls | Pending |
| 07-02-T3 | 2 | `node --test tests/scripts/coverage-producer.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-03-T1 | 3 | `node --test tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-producer.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-03-T2 | 3 | `node --test tests/scripts/coverage-source-map.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-04-T1 | 3 | `node --test tests/scripts/coverage-correspondence.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-04-T2 | 3 | `node --test tests/scripts/coverage-schema.test.ts tests/scripts/coverage-correspondence.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-04-T3 | 3 | `node --test tests/scripts/coverage-validation.test.ts tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-schema.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-05-T1 | 4 | `node --test tests/scripts/coverage-unit.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-05-T2 | 4 | `node --test tests/scripts/coverage-unit.test.ts tests/scripts/coverage-producer.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-05-T3 | 4 | `node --test tests/scripts/coverage-unit.negative.test.ts && node scripts/coverage-unit.negative.mjs` | Small real-runtime/compiler/CLI controls | Pending |
| 07-06-T1 | 5 | `node --test tests/scripts/check-coverage-risk.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-06-T2 | 5 | `node --test tests/scripts/check-coverage-risk.test.ts` | Small real-runtime/compiler/CLI controls | Pending |
| 07-06-T3 | 5 | `node --test tests/scripts/check-coverage-risk.negative.test.ts && node scripts/check-coverage-risk.negative.mjs` | Small real-runtime/compiler/CLI controls | Pending |
| 07-07-T1 | 6 | `npm run coverage:unit:verified && npm run coverage:validate` | Stable live integration | Pending |
| 07-07-T2 | 6 | `npm run coverage:validate && npm run coverage:risk && npm run test:coverage:direct:all` | Stable live integration | Pending |
| 07-08-T1 | 7 | `node --test tests/architecture/coverage-metrics-pipeline.test.ts && npm run coverage:unit:negative && npm run coverage:risk:negative` | Stable live integration | Pending |
| 07-08-T2 | 7 | `node --test tests/architecture/coverage-metrics-pipeline.test.ts && npm run lint:workflows && npm run lint:workflows:negative` | Stable live integration | Pending |
| 07-08-T3 | 7 | `npm run check && npm run test:coverage:direct:all` | Stable live integration | Pending |

New test files are created by their owning task. Wave 0 becomes complete when 07-01's first native-runtime tracer and its fixture harness pass. Small conformance cases target under30 seconds; measure live runtime before setting whole-process budgets. Do not repeatedly rerun the complete unit suite during small tooling iterations.

Each PLAN includes per-task independent assertions, fails_when and coverage ledger entries. Record exact command/result, partial/zero/error cases, assertion strength and any production coverage impact in that plan's SUMMARY. A source repair discovered during certified measurement requires an exact bounded owner plan, paired tests, preserved public behavior, before/after assertion and native/direct coverage evidence, execution and a fresh capture before activation.

## Native coverage and check-order preservation

The normal quality command remains `npm run check`. Integration replaces its existing full unit execution with the single verified native capture and then consumes the accepted metrics. The pipeline keeps native unit line/function/branch coverage at exactly100% for all production sources, without rounding, exclusions or threshold changes. Sonar continues to read only `coverage/unit.lcov`. Existing integration/E2E reports and direct-pair pins are independent measurements.

The Fallow diagnostic invocation used to enumerate all rows is data collection, not the shipping gate. The wrapper independently validates complete exact production correspondence and applies the explicit policy30 using unrounded arithmetic. Its actual offender/benign tests run the shipping policy file. Existing full-tree health/dupes still run at their unchanged limits. No --min-score0, baseline allowance, top/diff filter or broad ignore is an acceptance path.

Run unchanged `npm run test:coverage:direct:all` against the final stable snapshot. Reuse the unit result already produced by normal checks; do not add a duplicate unit run solely for a second format. Each isolated CI job either makes its own valid capture or verifies exact same-content artifact provenance before use. Existing Node24 CI must pass concrete-runtime conformance; local Node26 evidence cannot substitute.

## Multi-source coverage audit

| Source | ID | Requirement | Plans | Status |
| --- | --- | --- | --- | --- |
| GOAL | Phase7 | Valid Istanbul with measured source/function correspondence and no clamping | 07-01 through 07-05, 07-07 | COVERED |
| REQ | METRIC-01 | Reliable current unit conversion and fidelity | 07-01 through 07-05, 07-07, 07-08 | COVERED |
| REQ | METRIC-02 | Real measured CRAP policy and negative controls | 07-06 through 07-08 | COVERED |
| CONTEXT | D-01 | Native100, Sonar unit-only, separate direct/integration/E2E | 07-01, 07-05, 07-07, 07-08 | COVERED |
| CONTEXT | D-02 | Same-run raw, immutable inputs, stale/incomplete rejection | 07-01, 07-05 | COVERED |
| CONTEXT | D-03 | Conformance before promotion; strict no-clamping/no-fuzzy matching | 07-02, 07-03, 07-04, 07-06 | COVERED |
| CONTEXT | D-04 | Actual JS, exact UTF-16/EOL, source AST names, every function/statement | 07-01, 07-03, 07-04, 07-05 | COVERED |
| CONTEXT | D-05 | Known omission resolved by tested release or licensed maintained patch | 07-02 | COVERED |
| CONTEXT | D-06 | Additional CRAP30, unchanged limits, real baseline/boundary | 07-06, 07-07, 07-08 | COVERED |
| CONTEXT | D-07 | Honest model denominators/deficits; native100 preserved | 07-05, 07-07 | COVERED |
| CONTEXT | D-08 | Existing all-tree health/dupes and complete production risk scope | 07-06, 07-08 | COVERED |
| CONTEXT | D-09 | Complete syntax, malformed/stale/missing and shipping controls | 07-01 through 07-06 | COVERED |
| CONTEXT | D-10 | Actual local/CI order, content freshness, one unit run | 07-01, 07-05, 07-08 | COVERED |
| RESEARCH | Runtime identity | Native stripping/version/compile-cache and worker evidence | 07-01 | COVERED |
| RESEARCH | Producer defect | Nested logical callback AND body statements, not one-line-patch assumption | 07-02, 07-04 | COVERED |
| RESEARCH | Maps/names | Exact endpoints and AST-proven method-name restoration | 07-03 | COVERED |
| RESEARCH | Strict input | Position/schema/counters/path/implicit-else proof | 07-04 | COVERED |
| RESEARCH | Merge/population | Fresh ASTs, duplicate snapshots, unloaded/type-only modules, full denominator | 07-05 | COVERED |
| RESEARCH | Consumer | Exact joins, contained nested statements, empty-body rule and rounded displays | 07-06 | COVERED |
| RESEARCH | Invalid prototype | Fresh stable measurement, no reuse of counts or max20 | 07-07 | COVERED |
| RESEARCH | Model limits | Throw/default-argument limits and faithful AST deficits | 07-02, 07-07, 07-08 | COVERED |
| RESEARCH | Deployment | Package aliases, scripts-disabled reproducible install, Node24/26 distinction | 07-02, 07-08 | COVERED |
| RESEARCH | Security | Immutable hashes, contained paths, process discrimination, license/provenance | All plans | COVERED |

## Sign-off

Planning checks: all eight PLAN files pass GSD frontmatter schema and plan-structure validation with zero errors or warnings. An independent scope check confirms twenty-two tasks, at most ten files per plan and five per task, leading tracers, explicit fails_when/automated checks, and no same-wave write overlap. Implementation acceptance remains pending below.

- [x] All decisions, requirements and research constraints have owners and acceptance tasks.
- [x] All tasks have automated verification, fails_when and an assertion/coverage ledger.
- [x] Plan/task scopes and same-wave write ownership are bounded.
- [ ] Producer delivery and full conformance accepted on actual tooling runtimes.
- [ ] Exact function/statement/source/consumer correspondence accepted.
- [ ] Fresh stable full-production measurement and model differences reconciled.
- [ ] Normal local/CI pipeline activated with native100 and all direct/complexity/dupe safeguards.
