# Phase 7 -- Certified production coverage measurement

Plan 07-07 measures the stable post-Phase-6 production tree with the accepted producer and records the result here. Every figure below was measured on the two runs named in this document; no figure is copied from the exploratory research capture or from an earlier plan's working run.

## 1. Stability preconditions

| Precondition | Evidence |
| --- | --- |
| Phase 6 verification complete | `06-VERIFICATION.md`: `status: passed`, `score: 2/2 must-haves verified`, verified 2026-09-17T02:40:00Z |
| Phase 5/6 production and test writes finished | Last commit touching `extensions/`: `31ed3c72` (2026-09-17 10:38 -0400). Last commit touching `tests/` outside the coverage tooling: `31ed3c72`. Phase 7 (07-01 through 07-06) changed only `scripts/**`, `tests/scripts/coverage-*`, `tests/scripts/check-coverage-risk*`, `vendor/coverage/**` and `package.json`/`package-lock.json`. |
| Source revision measured | Run 1: HEAD `9e39c87be5acb5b09ee3f9ec58fa4c9de15d159e` plus this plan's Task 1 working set (section 3), whose bytes the run inventoried and which are byte-identical before and after the run (`sha256sum -c` over the seven files). Run 2: HEAD `8d8a16b7` (the Task 1 commit of exactly those bytes). Both runs inventoried the same 703 files with the same digests (inventory digest `3623260465ffae2b`). |

## 2. Run identity and fingerprints

Two full runs of the identical tree. Run 1 is the Task 1 measurement; run 2 is the tracer feedback gate's re-run of the same command and is the published bundle this document certifies.

| Item | Run 1 | Run 2 (published) |
| --- | --- | --- |
| Run | `20260918T174436245Z-3a4ec95a` | `20260918T175717646Z-4402189b` |
| Started / completed / accepted (UTC) | 17:44:36 / 17:50:53 / 17:51:58 | 17:57:17 / 18:04:05 / 18:05:10 |
| `npm run coverage:unit:verified` | exit 0, 446 s | exit 0, 477 s |
| `npm run coverage:validate` | exit 0, 5.9 s | exit 0, 5.9 s (and again after the Task 2 writes, exit 0, 6.1 s) |
| Workers / raw records / modules loaded | 311 / 541 / 616 | 311 / 541 / 616 |
| Captured manifest | `0229a9605cccacaf` | `2faf097e4d47a1ad` |
| Map `coverage/unit.istanbul.json` | `30fa2af358ed87e0` | `fa867583c050e8d1` |
| LCOV `coverage/unit.lcov` | `d82050fd915f31be` | `4dc4b36c2675a794` |
| Validation receipt | `709fa24a27f44b26` | `4087f35149a7bffa` |
| Accepted manifest `coverage/unit.manifest.json` | `97c1ca0764d5aba8` | `99556b2f08f1f1db` |
| Run directory | pruned after its figures were recorded here | `coverage/runs/20260918T175717646Z-4402189b` (809 MB, gitignored) |

Shared identities:

| Item | Value |
| --- | --- |
| Runtime | Node v26.8.2, V8 14.6.202.34-node.28, linux x64, npm 11.19.1 |
| Selection | the two `npm test` patterns; 311 test files |
| Inventory | 703 files hashed before, after and at publication: 239 production, 407 tests, 39 tooling, 18 resources; digest `3623260465ffae2b` |
| Producer | `ast-v8-to-istanbul` 1.0.6-project.1, payload `29377dc2bb113e40`, license `7771f0b6f55e76ef`; acorn 8.18.0; istanbul-lib-coverage 3.2.2; @jridgewell/sourcemap-codec 1.6.0; adapter `coverage-producer.convert.mjs` `28109d6802aaa61e` |
| Capture tooling | `coverage-capture.mjs` `f5786483140575c6`, `coverage-capture.manifest.mjs` `5c02b8820d36e769`, `coverage-capture.runtime.mjs` `be41926f74256e87` |
| Acceptance tooling | `coverage-unit.mjs` `135ca575e2385faf`, `coverage-acceptance.mjs` `6bb3e8b48a09ffc5`, `coverage-producer.mjs` `335165b8ad637536`, `coverage-producer.convert.mjs` `28109d6802aaa61e`, `coverage-source-map.mjs` `c519451726908f32`, `coverage-syntax.mjs` `9f29639eb6aa0890`, `coverage-correspondence.mjs` `8c3c2cd2fa67f08a`, `coverage-schema.mjs` `8e6bac135366b1d3`, `coverage-validate.mjs` `2846000baf145e22` |
| Consumer | Fallow 3.23.0 (signed, lockfile resolution), health report schema 11; policy `scripts/coverage-risk-policy.json` threshold 30 |

## 3. What changed before the runs (Task 1)

Both runs measure the tree with the Task 1 working set in place (commit `8d8a16b7`). The set adds controls and closes one acceptance gap; it changes no production source under `extensions/`.

- `scripts/coverage-acceptance.mjs` (new): the population and the two denominators, moved out of `coverage-unit.mjs` so the readback can recompute them.
- `scripts/coverage-validate.mjs`: the accepted mode recomputes the population and denominators from the bundle and refuses `summary-mismatch` rows. Before this change an accepted manifest whose `acceptance.population` and `acceptance.denominators` were copied from another run passed `coverage:validate`, `coverage:capture --verify` and `coverage:risk` (probe on a one-function fixture root: all three exited 0 with `statements: { total: 99, covered: 99 }` in the manifest).
- `scripts/coverage-capture.manifest.mjs`: `coverage-acceptance.mjs` joins the acceptance tooling list, so its bytes are bound by every accepted manifest.
- `scripts/coverage-unit.mjs`: imports the shared summary.
- `tests/scripts/coverage-unit.test.ts` (+2): a second run of an unchanged tree publishes the same map bytes and summary; a manifest whose summary is another run's is refused with `summary-mismatch` rows for `population` and `denominators`.
- `tests/scripts/check-coverage-risk-fixtures.ts`, `tests/scripts/check-coverage-risk.test.ts` (+2): a function whose implicit else is never taken scores at its complexity with `branchArms: { total: 2, covered: 1 }` beside `native.branches: { found: 2, hit: 2 }`; a rethrow no process executed scores from the map (4 of 5 statements, 3.072) while the merged native LCOV counts every line (17/17).

## 4. Denominators

Three measurements of one run, kept apart (D-07). None is derived from another. Both runs recorded the same values.

| Model | Files | Functions | Statements or lines | Branches |
| --- | --- | --- | --- | --- |
| Native (Node's LCOV over the 230 loaded production files) | 230 records | 1890/1890 | 63825/63825 lines | 9234/9234 blocks |
| Syntax (the accepted Istanbul map over all 239 production files) | 239 | 1865/1865 | 10392/10393 statements | 6633/6653 arms |
| Fallow production rows (health report, diagnostic form) | 239 files, 215 declaring a function | 1865 rows, all `istanbul` | -- | -- |
| Fallow non-production rows (tests, scripts) | -- | 13030 rows, all `estimated`, not gated | -- | -- |

The native invariant of D-01 holds: 100.00 percent lines, functions and branches, with zero `DA:...,0`, `BRDA:...,0` or `FNDA:0,...` entries in `coverage/unit.lcov`.

## 5. Independent verification

Each check below was recomputed apart from the pipeline (a scratch audit over the public artifacts and the run directory, using acorn directly), then compared with what the pipeline recorded. The audit ran on both runs and every result below is identical for both.

| Check | Result |
| --- | --- |
| LCOV totals recounted line by line | records 230, LF 63825, LH 63825, FNF 1890, FNH 1890, BRF 9234, BRH 9234: equal to `acceptance.denominators.native` |
| Map totals recounted over `f`, `s`, `b` | 239 files, functions 1865/1865, statements 10392/10393, arms 6633/6653: equal to `acceptance.denominators.syntax` |
| Production population, both directions | 239 `.ts` files under `extensions/` on disk = 239 inventoried production paths = 239 map keys; missing from map: none; extra in map: none; inventory digests equal the tree now: no drift |
| Loaded and unloaded | 230 loaded; 9 unloaded: `bridges/agents/types.ts`, `bridges/commands/types.ts`, `bridges/hooks/exec-result.ts`, `bridges/mcp/types.ts`, `bridges/skills/types.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/import/types.ts` (type-only) and `orchestrators/types.ts` (executable: `import { type ContentReason }` strips to a side-effect import and declares no construct) |
| Function identity | A plain acorn walk over each file's recorded executed text counts 1865 `FunctionDeclaration`/`FunctionExpression`/`ArrowFunctionExpression` nodes, per file equal to the map's `fnMap` sizes (zero mismatches). The validator's correspondence pass (exact `decl`/`loc` spans both ways) accepted every record; the risk wrapper joined all 1865 functions to Fallow's 1865 production rows in both directions with zero `row-unjoined`, `row-duplicate`, `function-unreported`, `coverage-mismatch`, `crap-mismatch` or `coverage-source` rows. |
| Statement identity | The validator's correspondence pass accepted every statement span; the wrapper's independent contained-statement proportion agreed with Fallow's `coverage_pct` for every function (tolerance 1e-9), so Fallow's statement attribution equals the model's for the whole population. |
| Reproducibility, run 1 against run 2 | Identical denominators, population, deficit list, function count, risk histogram, partial function, maximum and label agreement. Of the map's 18911 counters, 52 differ in execution count between the runs and none changes between zero and nonzero: 31 in `shared/path-containment.ts`, 15 in `bridges/hooks/async-rewake/pid-table.ts`, 4 in `bridges/hooks/runtime.ts`, 2 in `shared/path-safety.ts`, all counts of timing- or poll-dependent tests. The map bytes and the LCOV therefore differ between the runs; the coverage does not. Run 2's map digest `fa867583c050e8d1` is byte-identical to the map of 07-06's run `96fa8e3e` on the same extension tree. |

Native functions exceed syntax functions by 25: every extra native `FN` entry is V8's synthetic `<instance_members_initializer>` for a class with field initializers (13 in `shared/errors.ts`, 3 in `shared/errors-bridges.ts`, 2 in `shared/path-containment.ts`, 1 each in `bridges/hooks/async-rewake/ring-buffer.ts`, `bridges/mcp/stage.ts`, `edge/browser/plugin-browser.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/plugin/shared.ts`, `orchestrators/reconcile/apply-outcomes.ts`, `shared/completion-cache.ts`). The source declares no function node for them; the model counts declared functions only. 1890 - 25 = 1865. Every other file has equal counts.

## 6. Syntax deficits

21 counters at zero in the accepted map: one statement and twenty branch arms. Every function executed.

| # | Location | Construct | Counter |
| --- | --- | --- | --- |
| 1 | `bridges/commands/discover.ts:289:6` | `throw err;` | statement 0 |
| 2 | `bridges/commands/discover.ts:288:4` | `if (!(err instanceof CommandNameError))` | consequent arm 0 (if hits 1) |
| 3 | `bridges/hooks/spawn-helpers.ts:113:6` | `if (bounded !== undefined)` | implicit else 0 (if hits 1) |
| 4 | `bridges/skills/stage.ts:391:6` | `if ((err as NodeJS.ErrnoException).code !== "ENOENT")` | implicit else 0 (if hits 1) |
| 5 | `domain/source.ts:181:4` | `if (parsed.kind === "github")` | implicit else 0 (if hits 5) |
| 6 | `edge/browser/plugin-browser.ts:309:6` | `if (mp !== undefined)` | implicit else 0 (if hits 53) |
| 7 | `edge/browser/plugin-browser.ts:392:6` | `if (plugin !== undefined)` | implicit else 0 (if hits 28) |
| 8 | `orchestrators/marketplace/add.ts:734:11` | `else if (finalDir !== undefined)` | implicit else 0 (if hits 1) |
| 9 | `orchestrators/marketplace/autoupdate.ts:528:4` | `if (first !== undefined)` | implicit else 0 (if hits 4) |
| 10 | `orchestrators/plugin/clone-cache.ts:331:8` | `if (value !== "")` | implicit else 0 (if hits 3) |
| 11 | `orchestrators/plugin/info.ts:304:4` | `if (err instanceof Error)` | implicit else 0 (if hits 39) |
| 12 | `orchestrators/plugin/info.ts:1602:6` | `if (resolved.state === "installable")` | implicit else 0 (if hits 2) |
| 13 | `orchestrators/plugin/info.ts:1622:4` | `if (fetchCtx !== undefined)` | implicit else 0 (if hits 1) |
| 14 | `orchestrators/plugin/install-outcome.ts:991:4` | `if (capture !== undefined)` | implicit else 0 (if hits 19) |
| 15 | `orchestrators/plugin/reinstall-record.ts:78:2` | `if (error instanceof Error)` | implicit else 0 (if hits 41) |
| 16 | `orchestrators/plugin/update-flow.ts:583:2` | `if (primary instanceof Error)` | implicit else 0 (if hits 10) |
| 17 | `orchestrators/plugin/update-swap.ts:318:2` | `if (handles.agents !== undefined)` | implicit else 0 (if hits 2) |
| 18 | `orchestrators/plugin/update-swap.ts:328:2` | `if (handles.commands !== undefined)` | implicit else 0 (if hits 2) |
| 19 | `orchestrators/plugin/update-swap.ts:338:2` | `if (handles.skills !== undefined)` | implicit else 0 (if hits 2) |
| 20 | `orchestrators/reconcile/apply.ts:618:11` | `else if (result.status === "failed")` | implicit else 0 (if hits 2) |
| 21 | `shared/notification-grammar.ts:171:2` | `if (current !== "")` | implicit else 0 (if hits 46) |

Rows 1 and 2 are one site: the `if` at 288 was entered once and its consequent never ran. Rows 3 to 21 are `if` statements without `else` whose condition was never false. The list equals the one 07-05 reported on run `99cf68ec`, with the correction that 07-05 called all twenty arms implicit-else arms while row 2 is a consequent arm.

Native evidence for rows 1 and 2: the raw V8 records for `collectCommandFile` (line 246 to 297) appear in 57 of the 541 snapshots. 46 report the whole function at count 0 (never called in that process), 10 report it called with the second catch block (lines 287 to 294) at 0, and exactly one reports the catch entered once with a nested range for lines 288 to 290 at count 0. The published LCOV shows `DA:287,325 DA:288,1 DA:289,1 DA:290,1` and no `BRDA` for line 288: the merged native report counts the `throw err;` line as executed although no process executed it. The map records the statement at 289:6 with 0 hits and the `if` at 288:4 with arms `[0, 1]`.

## 7. CRAP distribution (policy 30, unrounded arithmetic)

`npm run coverage:risk -- --report coverage/unit.risk.json` exited 0 on both runs (11.4 s and 11.6 s): `Coverage risk verified: 20260918T175717646Z-4402189b, 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts:108:0 (statusTag), policy < 30; 13030 other row(s) not gated`. The report holds every production function with its anchor, cyclomatic complexity, contained statements, coverage, score and Fallow's own labels; the two runs' reports agree on every function.

| Score | Functions |
| --- | --- |
| below 5 | 1394 |
| 5 to 9.99 | 377 |
| 10 to 19.99 | 88 |
| 20 to 29.99 | 6 |
| 30 or more | 0 |

- Maximum 20.00 (six functions of cyclomatic 20 at 100 percent statement coverage): `edge/browser/plugin-browser.ts` `statusTag` (108), `statusDescription` (140), `availableActions` (179); `orchestrators/plugin/install.messaging.ts` `composeInstallFailureMessage` (226); `shared/notification-grammar.ts` `renderPluginRow` (901); `shared/notification-types.ts` `pluginVersion` (434). Next: `edge/router.ts` `routeClaudePlugin` 18, `edge/completions/provider.ts` `pluginRefBranchConfig` 17. Cyclomatic distribution above 13: 14 (10 functions), 15 (4), 16 (3), 17 (3), 18 (1), 20 (6); the whole-tree limit of 20 is met by every function, as the unchanged `fallow health` gate already requires.
- One partially covered function: `bridges/commands/discover.ts:246:0 collectCommandFile`, 16 of 17 statements (the `throw err;` above), cyclomatic 6 (two `catch` clauses and three `if`s), score 6 * 6 * (1/17)^3 + 6 = 6.0073, labeled 6 by Fallow.
- Four statement-empty bodies use the entry rule at 100 percent: `bridges/mcp/stage.ts:354 abortPreparedMcp`, `orchestrators/plugin/enable-disable.ts:134 assertRecordedStateLedgerInstalled`, `orchestrators/plugin/enable-disable.ts:477 assertDisableFailureReasonsNonEmpty`, `platform/git-credential.ts:165 (anonymous)`.
- Every score equals Fallow's one-decimal label within 0.05 (zero label drift); every production row carries `coverage_source: "istanbul"`; the wrapper's `failures` array is empty.
- The policy verdict is `passed`. The measurement task did not have to waive anything: no function meets or exceeds 30.

## 8. Discrepancy dispositions and activation conditions (Task 2)

### 8.1 Native and syntax denominators

| Difference | Cause | Kind | Disposition |
| --- | --- | --- | --- |
| 1890 native functions against 1865 syntax functions | 25 synthetic `<instance_members_initializer>` entries V8 reports for classes with field initializers; the source declares no function node for them (section 5, per-file list) | representation difference | Explained. Both counts are correct for their model; the wrapper anchors declared functions and Fallow lists 1865 production rows, so the population the policy gates is the declared one. |
| 63825 native lines against 10393 syntax statements | Lines against statements; a line holds any number of statements and a statement any number of lines | different units | Explained. Not comparable and never equated. |
| 9234 native branches against 6653 syntax arms | V8 emits a block range for every code range whose count differs from its parent (function bodies, `if` blocks, loop bodies, `catch` clauses, continuation ranges, logical operands); Istanbul counts arms of `if`/conditional/logical/switch/default-argument constructs, including the implicit else of an `if` without `else`, which is no code and therefore no V8 block | representation difference | Explained. The two models disagree on both the unit and the population of branches; each is reported under its own name and neither is a regression of the other. |
| Native 100 percent lines against one unexecuted statement (`discover.ts:289`) | Node's cross-process LCOV merge (`mergeCoverageRanges` in `lib/internal/test_runner/coverage.js`, identical in v24.11.0 and v26.8.2) keeps a zero-count block only when it exactly matches a block of the other side, or nests inside a zero-count block the scan reaches before an exact match ends the scan. The `throw` block sits inside the catch clause, which other processes report at the same span with count 0 and one process with count 1; the exact match on the catch span sums the counts and ends the scan, and the nested zero block is dropped in either merge order. The raw records, the direct single-process pair coverage (`scripts/test-coverage-direct.pin.json`: `discover.ts` `branches 55/56, lines 412/414`, finding BC-019) and the map all record the block as unexecuted. Reproduced in `tests/scripts/check-coverage-risk.test.ts` ("scores a rethrow no process executed although the merged native lines count it": 17/17 native lines against 4 of 5 statements). | documented runtime limit (Node) | Explained and pinned. The native figure over-reports this one line; the AST model is the faithful count. D-01 keeps the native gate as Node reports it, and no coverage configuration changes. |

### 8.2 The unexecuted statement (rows 1 and 2)

`throw err;` in `collectCommandFile`'s second catch is reachable only when `nameCommandInDir` throws something other than a `CommandNameError`. `nameCommandInDir` wraps every throw of `generatedCommandName` in a `CommandNameError`, so the guard can be true only if the `CommandNameError` constructor itself throws or `instanceof` is patched (`Symbol.hasInstance`). The guard exists to narrow the `unknown` catch binding for `badNameWarning(err)`; `as` and `!` are not available under `extensions/`, so removing it means a restructure. The direct-pair pin already records this disposition as BC-019.

Kind: genuine unexecuted statement, unreachable by construction, compiler-forced. Disposition: no test is fabricated for it (per the plan and the research), no exclusion or ignore hint is added, and the statement stays in the denominator. Its effect on the policy is 6.0073 against 6 for one function and 10392/10393 statements for the tree.

### 8.3 The nineteen implicit-else arms (rows 3 to 21)

Each site was read against its executed source. None affects statement coverage or the CRAP score (the formula uses statements only, as the `guard` control in `check-coverage-risk.test.ts` pins); none affects the native totals (V8 has no block for a missing `else`). They fall into two kinds.

Unreachable by construction, or defensive narrowing no production input falsifies (9 sites):

| Row | Site | Why the condition is always true |
| --- | --- | --- |
| 4 | `bridges/skills/stage.ts:391` | `rm(dir, { force: true })` never rejects with `ENOENT`, so a caught error is never `ENOENT`; the guard rethrows what `force` did not swallow. |
| 6, 7 | `edge/browser/plugin-browser.ts:309`, `:392` | The selected item's value is derived from the same array or map the lookup reads, so `find`/`get` cannot miss; the guard narrows `T \| undefined`. |
| 8 | `orchestrators/marketplace/add.ts:734` | `stagedAtFinal` becomes true only after `finalDir` is assigned; the `else if` guard is the type narrowing of an already-established invariant. |
| 9 | `orchestrators/marketplace/autoupdate.ts:528` | `missingEverywhere` is true only when every iterated scope errored, so `errors[0]` exists; the guard is forced by `noUncheckedIndexedAccess`. |
| 11, 15, 16 | `orchestrators/plugin/info.ts:304`, `reinstall-record.ts:78`, `update-flow.ts:583` | `catch (err)` binds `unknown`; Node's file-system and the project's own errors are `Error` instances, so the non-`Error` arm is reachable only by throwing a non-`Error` value from an injected collaborator. |
| 14 | `orchestrators/plugin/install-outcome.ts:991` | `capture` is optional in the signature, and both production callers (`install-flow.ts`, `enable-disable.ts`) pass one. |

Reachable, designed and untested at the arm level (10 sites):

| Row | Site | The untested path |
| --- | --- | --- |
| 3 | `bridges/hooks/spawn-helpers.ts:113` | No string value fits the stdin budget, so `largestFittingString` returns `undefined` and the loop breaks. |
| 5 | `domain/source.ts:181` | A `https://github.com/` URL the GitHub parser does not accept falls through to the generic URL parser. |
| 10 | `orchestrators/plugin/clone-cache.ts:331` | A clone config with a bare `url =` line (empty value) yields `undefined`, as the comment beside it states. |
| 12 | `orchestrators/plugin/info.ts:1602` | A materialized clone whose plugin resolves as not installable preserves the recorded status with `components: not resolved`. |
| 13 | `orchestrators/plugin/info.ts:1622` | Bare `info` (no fetch consent) with a probe or read throw degrades silently, as the comment beside it states (D-78-04). |
| 17, 18, 19 | `orchestrators/plugin/update-swap.ts:318`, `:328`, `:338` | `abortPartialHandles` with a handle absent because preparation failed before that bridge prepared; the tests abort only with all three handles present. |
| 20 | `orchestrators/reconcile/apply.ts:618` | A `skipped` enable/disable outcome, which the comment beside it drops on purpose (idempotent steady state). |
| 21 | `shared/notification-grammar.ts:171` | Wrapping an empty or whitespace-only text leaves `current` empty and pushes no line. |

Disposition: reported, not erased. The nine sites of the first kind carry no behavior a test can reach without a fabricated input or a patched runtime. The ten sites of the second kind are genuine untested behavior at the branch level with every statement executed; they are candidates for a bounded follow-up plan with exact ownership under the unit-testing rules, outside this plan's files. They do not block activation: the activation conditions require every gap explained, and none of these changes the native totals, a statement count or a CRAP score.

### 8.4 CRAP results at or above 30

None. The maximum is 20.00, held by six fully covered functions of cyclomatic 20 (the whole-tree cyclomatic limit). The boundary itself is verified by the shipping controls (exactly 30 refused, 29.952 passed) rather than by the population. The threshold stays 30; nothing was changed to reach this verdict.

### 8.5 Substantive product or metric-policy conflicts

None established. The exploratory research figures (1825 rows, maximum 20) are superseded by the certified 1865 rows and maximum 20.00 on the stable tree; the one unexecuted statement and the nineteen implicit-else arms are explained above with evidence; no threshold, coverage configuration, census pin, suppression or exclusion was changed.

### 8.6 Activation conditions

| Condition | Status | Evidence |
| --- | --- | --- |
| Full conformance of the producer, adapter and validators | met | Acceptance tooling digests bound in the published manifest (section 2); `coverage:validate` re-derives the receipt and the summary on readback; all eight coverage tooling suites plus the risk suites pass (186 + 19 cases). |
| Exact complete correspondence | met | Section 5: 239 = 239 = 239 files, 1865 functions both ways with acorn and with Fallow, every statement span accepted, zero join or agreement failures. |
| Fresh artifacts | met | Published bundle `20260918T175717646Z-4402189b`, accepted 2026-09-18T18:05:10Z, inventory equal to the committed tree at `8d8a16b7`; `coverage:validate` exit 0 after the Task 2 writes (`docs/` and `.planning/` are not inventoried). |
| Native 100 percent | met | 63825/63825 lines, 1890/1890 functions, 9234/9234 branches; no zero entry in the LCOV. |
| Unchanged direct floors | met | `npm run test:coverage:direct:all`: exit 0, 239 pairs in 497 s on v26.8.2, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly`; the pin file is unchanged. |
| Evidenced policy 30 outcome | met | `coverage:risk` exit 0 on both runs, 0 of 1865 at or above 30, report at `coverage/unit.risk.json`; controls for 42, 6, exactly 30 and 29.952 pass on the shipped policy. |
| Zero unexplained measurement gaps | met | Sections 8.1 to 8.3 explain every difference and every deficit with a cause, a kind and a disposition. |

Certification: the production coverage measurement on the stable tree is complete and reproducible, and the CRAP policy of 30 can be activated in `check` and CI (07-08) without weakening any coverage configuration, assertion, threshold or suppression. Known limits are documented in `docs/coverage-metrics.md`.

### 8.7 Runtime and tool support

Measured on Node v26.8.2 (V8 14.6.202.34-node.28), linux x64, npm 11.19.1, Fallow 3.23.0, the vendored producer 1.0.6-project.1. CI runs Node 24; its `mergeCoverageRanges` and `mapRangeToLines` are byte-identical to v26.8.2's, so the merge limit in 8.1 applies there too. Node 24 has not executed the capture in this plan; each CI job makes its own capture and binds its own runtime (D-10, 07-08).
