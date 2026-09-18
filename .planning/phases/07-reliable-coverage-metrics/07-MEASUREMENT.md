# Phase 7 -- Certified production coverage measurement

Plan 07-07 measures the stable post-Phase-6 production tree with the accepted producer and records the result here. Every figure below was measured on the run named in this document; no figure is copied from the exploratory research capture or from an earlier plan's working run.

## 1. Stability preconditions

| Precondition | Evidence |
| --- | --- |
| Phase 6 verification complete | `06-VERIFICATION.md`: `status: passed`, `score: 2/2 must-haves verified`, verified 2026-09-17T02:40:00Z |
| Phase 5/6 production and test writes finished | Last commit touching `extensions/`: `31ed3c72` (2026-09-17 10:38 -0400). Last commit touching `tests/` outside the coverage tooling: `31ed3c72`. Phase 7 (07-01 through 07-06) changed only `scripts/**`, `tests/scripts/coverage-*`, `tests/scripts/check-coverage-risk*`, `vendor/coverage/**` and `package.json`/`package-lock.json`. |
| Source revision measured | HEAD `9e39c87be5acb5b09ee3f9ec58fa4c9de15d159e` plus this plan's Task 1 working set (the tooling completion and the new controls listed in section 3), whose bytes the run inventoried and which are byte-identical before and after the run (`sha256sum -c` over the seven files). |

## 2. Run identity and fingerprints

| Item | Value |
| --- | --- |
| Run | `20260918T174436245Z-3a4ec95a`, started 2026-09-18T17:44:36.247Z, completed 2026-09-18T17:50:53.039Z, accepted 2026-09-18T17:51:58.306Z |
| Command | `npm run coverage:unit:verified` (exit 0, 446 s) then `npm run coverage:validate` (exit 0, 5.9 s) |
| Runtime | Node v26.8.2, V8 14.6.202.34-node.28, linux x64, npm 11.19.1 |
| Selection | the two `npm test` patterns; 311 test files, 311 workers, 541 raw V8 records, 616 modules loaded |
| Inventory | 703 files hashed before, after and at publication: 239 production, 407 tests, 39 tooling, 18 resources; digest `3623260465ffae2b` |
| Producer | `ast-v8-to-istanbul` 1.0.6-project.1, payload `29377dc2bb113e40`, license `7771f0b6f55e76ef`; acorn 8.18.0; istanbul-lib-coverage 3.2.2; @jridgewell/sourcemap-codec 1.6.0; adapter `coverage-producer.convert.mjs` `28109d6802aaa61e` |
| Capture tooling | `coverage-capture.mjs` `f5786483140575c6`, `coverage-capture.manifest.mjs` `5c02b8820d36e769`, `coverage-capture.runtime.mjs` `be41926f74256e87` |
| Acceptance tooling | `coverage-unit.mjs` `135ca575e2385faf`, `coverage-acceptance.mjs` `6bb3e8b48a09ffc5`, `coverage-producer.mjs` `335165b8ad637536`, `coverage-producer.convert.mjs` `28109d6802aaa61e`, `coverage-source-map.mjs` `c519451726908f32`, `coverage-syntax.mjs` `9f29639eb6aa0890`, `coverage-correspondence.mjs` `8c3c2cd2fa67f08a`, `coverage-schema.mjs` `8e6bac135366b1d3`, `coverage-validate.mjs` `2846000baf145e22` |
| Consumer | Fallow 3.23.0 (signed, lockfile resolution), health report schema 11; policy `scripts/coverage-risk-policy.json` threshold 30 |
| Public artifacts (sha256, first 16) | manifest `97c1ca0764d5aba8`, map `30fa2af358ed87e0`, LCOV `d82050fd915f31be`, validation receipt `709fa24a27f44b26`; captured manifest `0229a9605cccacaf` |
| Run directory | `coverage/runs/20260918T174436245Z-3a4ec95a` (809 MB, gitignored) |

## 3. What changed before the run (Task 1)

The run measures the tree with the Task 1 working set in place. The set adds controls and closes one acceptance gap; it changes no production source under `extensions/`.

- `scripts/coverage-acceptance.mjs` (new): the population and the two denominators, moved out of `coverage-unit.mjs` so the readback can recompute them.
- `scripts/coverage-validate.mjs`: the accepted mode recomputes the population and denominators from the bundle and refuses `summary-mismatch` rows. Before this change an accepted manifest whose `acceptance.population` and `acceptance.denominators` were copied from another run passed `coverage:validate`, `coverage:capture --verify` and `coverage:risk` (probe on a one-function fixture root: all three exited 0 with `statements: { total: 99, covered: 99 }` in the manifest).
- `scripts/coverage-capture.manifest.mjs`: `coverage-acceptance.mjs` joins the acceptance tooling list, so its bytes are bound by every accepted manifest.
- `scripts/coverage-unit.mjs`: imports the shared summary.
- `tests/scripts/coverage-unit.test.ts` (+2): a second run of an unchanged tree publishes the same map bytes and summary; a manifest whose summary is another run's is refused with `summary-mismatch` rows for `population` and `denominators`.
- `tests/scripts/check-coverage-risk-fixtures.ts`, `tests/scripts/check-coverage-risk.test.ts` (+2): a function whose implicit else is never taken scores at its complexity with `branchArms: { total: 2, covered: 1 }` beside `native.branches: { found: 2, hit: 2 }`; a rethrow no process executed scores from the map (4 of 5 statements, 3.072) while the merged native LCOV counts every line (17/17).

## 4. Denominators

Three measurements of one run, kept apart (D-07). None is derived from another.

| Model | Files | Functions | Statements or lines | Branches |
| --- | --- | --- | --- | --- |
| Native (Node's LCOV over the 230 loaded production files) | 230 records | 1890/1890 | 63825/63825 lines | 9234/9234 blocks |
| Syntax (the accepted Istanbul map over all 239 production files) | 239 | 1865/1865 | 10392/10393 statements | 6633/6653 arms |
| Fallow production rows (health report, diagnostic form) | 239 files, 215 declaring a function | 1865 rows, all `istanbul` | -- | -- |
| Fallow non-production rows (tests, scripts) | -- | 13030 rows, all `estimated`, not gated | -- | -- |

The native invariant of D-01 holds: 100.00 percent lines, functions and branches, with zero `DA:...,0`, `BRDA:...,0` or `FNDA:0,...` entries in `coverage/unit.lcov`.

## 5. Independent verification

Each check below was recomputed apart from the pipeline (a scratch audit over the public artifacts and the run directory, using acorn directly), then compared with what the pipeline recorded.

| Check | Result |
| --- | --- |
| LCOV totals recounted line by line | records 230, LF 63825, LH 63825, FNF 1890, FNH 1890, BRF 9234, BRH 9234: equal to `acceptance.denominators.native` |
| Map totals recounted over `f`, `s`, `b` | 239 files, functions 1865/1865, statements 10392/10393, arms 6633/6653: equal to `acceptance.denominators.syntax` |
| Production population, both directions | 239 `.ts` files under `extensions/` on disk = 239 inventoried production paths = 239 map keys; missing from map: none; extra in map: none; inventory digests equal the tree now: no drift |
| Loaded and unloaded | 230 loaded; 9 unloaded: `bridges/agents/types.ts`, `bridges/commands/types.ts`, `bridges/hooks/exec-result.ts`, `bridges/mcp/types.ts`, `bridges/skills/types.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/import/types.ts` (type-only) and `orchestrators/types.ts` (executable: `import { type ContentReason }` strips to a side-effect import and declares no construct) |
| Function identity | A plain acorn walk over each file's recorded executed text counts 1865 `FunctionDeclaration`/`FunctionExpression`/`ArrowFunctionExpression` nodes, per file equal to the map's `fnMap` sizes (zero mismatches). The validator's correspondence pass (exact `decl`/`loc` spans both ways) accepted every record; the risk wrapper joined all 1865 functions to Fallow's 1865 production rows in both directions with zero `row-unjoined`, `row-duplicate`, `function-unreported`, `coverage-mismatch`, `crap-mismatch` or `coverage-source` rows. |
| Statement identity | The validator's correspondence pass accepted every statement span; the wrapper's independent contained-statement proportion agreed with Fallow's `coverage_pct` for every function (tolerance 1e-9), so Fallow's statement attribution equals the model's for the whole population. |
| Reproducibility against the previous accepted run | Run `20260918T165606022Z-96fa8e3e` (07-06, same extension tree, older tooling bytes) recorded the same native and syntax denominators and the same 1865 rows, max 20.00. |

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

Rows 1 and 2 are one site: the `if` at 288 was entered once and its consequent never ran. Rows 3 to 21 are `if` statements without `else` whose condition was never false. The list equals the one 07-05 reported on run `99cf68ec`, with the correction that 07-05 called all twenty arms implicit-else arms while row 2 is a consequent arm. Their causes and dispositions are in section 8.

Native evidence for rows 1 and 2: the raw V8 records for `collectCommandFile` (line 246 to 297) appear in 57 of the 541 snapshots. 46 report the whole function at count 0 (never called in that process), 10 report it called with the second catch block (lines 287 to 294) at 0, and exactly one reports the catch entered once with a nested range for lines 288 to 290 at count 0. The published LCOV shows `DA:287,325 DA:288,1 DA:289,1 DA:290,1` and no `BRDA` for line 288: the merged native report counts the `throw err;` line as executed although no process executed it. The map records the statement at 289:6 with 0 hits and the `if` at 288:4 with arms `[0, 1]`.

## 7. CRAP distribution (policy 30, unrounded arithmetic)

`npm run coverage:risk -- --report coverage/unit.risk.json` exited 0 in 11.4 s: `Coverage risk verified: 20260918T174436245Z-3a4ec95a, 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts:108:0 (statusTag), policy < 30; 13030 other row(s) not gated`. The report holds every production function with its anchor, cyclomatic complexity, contained statements, coverage, score and Fallow's own labels.

| Score | Functions |
| --- | --- |
| below 5 | 1394 |
| 5 to 9.99 | 377 |
| 10 to 19.99 | 88 |
| 20 to 29.99 | 6 |
| 30 or more | 0 |

- Maximum 20.00 (six functions of cyclomatic 20 at 100 percent statement coverage): `edge/browser/plugin-browser.ts` `statusTag` (108), `statusDescription` (140), `availableActions` (179); `orchestrators/plugin/install.messaging.ts` `composeInstallFailureMessage` (226); `shared/notification-grammar.ts` `renderPluginRow` (901); `shared/notification-types.ts` `pluginVersion` (434). Next: `edge/router.ts` `routeClaudePlugin` 18, `edge/completions/provider.ts` `pluginRefBranchConfig` 17.
- One partially covered function: `bridges/commands/discover.ts:246:0 collectCommandFile`, 16 of 17 statements (the `throw err;` above), cyclomatic 6 (two `catch` clauses and three `if`s), score 6 * 6 * (1/17)^3 + 6 = 6.0073, labeled 6 by Fallow.
- Every score equals Fallow's one-decimal label within 0.05 (zero label drift); every production row carries `coverage_source: "istanbul"`; the wrapper's `failures` array is empty.
- The policy verdict is `passed`. The measurement task did not have to waive anything: no function meets or exceeds 30.

## 8. Discrepancy dispositions and activation conditions

Completed by Task 2.
