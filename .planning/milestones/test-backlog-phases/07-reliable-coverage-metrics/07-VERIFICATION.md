---
phase: 07-reliable-coverage-metrics
verified: 2026-09-18T23:15:00Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - ".fallowrc.json"
  - ".github/workflows/ci.yml"
  - ".github/workflows/sonarcloud.yml"
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-01-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-01-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-02-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-02-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-03-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-03-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-04-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-04-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-05-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-05-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-06-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-06-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-07-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-07-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-08-PLAN.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-08-SUMMARY.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-CONTEXT.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-REVIEW-FIX.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-REVIEW.md"
  - ".planning/phases/07-reliable-coverage-metrics/07-VALIDATION.md"
  - ".pre-commit-config.yaml"
  - "docs/coverage-metrics.md"
  - "package.json"
  - "scripts/build-coverage-producer.mjs"
  - "scripts/check-coverage-risk.mjs"
  - "scripts/check-coverage-risk.negative.mjs"
  - "scripts/coverage-acceptance.mjs"
  - "scripts/coverage-capture.manifest.mjs"
  - "scripts/coverage-capture.mjs"
  - "scripts/coverage-capture.runtime.mjs"
  - "scripts/coverage-correspondence.mjs"
  - "scripts/coverage-producer.convert.mjs"
  - "scripts/coverage-producer.mjs"
  - "scripts/coverage-risk-policy.json"
  - "scripts/coverage-schema.mjs"
  - "scripts/coverage-source-map.mjs"
  - "scripts/coverage-syntax.mjs"
  - "scripts/coverage-unit.mjs"
  - "scripts/coverage-unit.negative.mjs"
  - "scripts/coverage-validate.mjs"
  - "sonar-project.properties"
  - "vendor/coverage/PROVENANCE.md"
covered_digest: "v1:sha256:62ecb16e048b702569880e179696dace47239be8b39c9f36f0a63c827d95a993"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 07: Reliable Coverage Metrics Verification Report

**Phase Goal:** Unit coverage converts to valid Istanbul data with measured source/function correspondence and no clamped coordinates.
**Verified:** 2026-09-18T23:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Unit coverage converts to valid Istanbul data with measured source/function correspondence and no clamped coordinates (ROADMAP SC1) | ✓ VERIFIED | `scripts/coverage-source-map.mjs::isConcretePosition`/`isConcrete` reject non-integer, negative, out-of-bounds, and reversed coordinates (no `Math.max(0, …)`/clamp anywhere in the conversion or validation path — confirmed by grep). `scripts/coverage-correspondence.mjs` + `coverage-schema.mjs` independently walk the executed AST and reject any function/statement the map does not declare both ways. Re-ran `npm run coverage:validate` against the live published bundle: exit 0, "239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es)". Spot-checked one converted function (`plugin-browser.ts::capitalize`) against its source: `fnMap` decl/loc spans match the real line 102 text exactly. `node --test tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-schema.test.ts` all pass (in the 240-test run below). |
| 2 | Fallow health consumes verified coverage under a measured CRAP policy; offender and benign controls reject missing or misleading inputs (ROADMAP SC2) | ✓ VERIFIED | `scripts/coverage-risk-policy.json` pins `maxCrap: 30`, Fallow 3.23.0. Re-ran `npm run coverage:risk`: exit 0, "1865 production function(s) in 239 file(s) measured, max CRAP 20.00 … policy < 30; 13100 other row(s) not gated" — matches 07-MEASUREMENT.md §7/§9.3 to the function and file. Re-ran `npm run coverage:risk:negative`: 20 of 20 offender/benign controls pass (source-changed, schema-changed, map-malformed, nested-function-deleted, counter-swap, estimated-row, row-omitted/duplicated, wrong-join, consumer-version, all-tree-denominator, mixed-violation, environment-override, etc.). |
| 3 | One successful native unit execution produces both LCOV and raw V8 tied to the exact executed source, and drift/incomplete workers cannot publish (07-01) | ✓ VERIFIED | `tests/scripts/coverage-capture.test.ts` (in the 240-test run) covers same-run identity and drift rejection. `npm run coverage:unit:negative`: 32/32 pass, including `receipt-changed`, `tests-failed`, `worker-interrupted`, `environment-override`, `foreign-run-bundle`. |
| 4 | Only a pinned producer preserving nested logical descendants is eligible for conversion; delivery is reproducible with license/provenance; ordinary runs never mutate `node_modules` (07-02) | ✓ VERIFIED | `vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz` + `PROVENANCE.md` + `LICENSE` + `.patch` present; `package.json`/`package-lock.json` resolve the dependency to `file:vendor/coverage/…tgz`. `scripts/coverage-producer.convert.mjs::loadProducer` now computes identity/`deliveryFailures` from bytes on disk and throws **before** `await import(entryUrl)` (WR-02 fix, confirmed by reading the code). Re-ran `npm run coverage:producer:check` (29/29 pass) and `npm run coverage:producer:build -- --verify` (exit 0, "Producer delivery verified"). |
| 5 | Every concrete location uses exact UTF-16 coordinates; repeated methods restored only by AST declaration identity; invalid transforms/positions rejected, not repaired (07-03) | ✓ VERIFIED | Same `isConcretePosition`/`isConcrete` evidence as truth 1; `tests/scripts/coverage-source-map.test.ts` in the 240-test run. |
| 6 | Every production function/statement maps exactly to the declared Istanbul model; missing nested records cannot pass through a fallback; implicit-else admitted only by AST-proven convention (07-04) | ✓ VERIFIED | `coverage-correspondence.mjs`/`coverage-schema.mjs` reviewed; 07-MEASUREMENT.md §5/§6 documents the 19 AST-proven implicit-else sites and 1 genuine deficit, all dispositioned in §8.2–8.3. `tests/scripts/coverage-correspondence.test.ts`, `coverage-schema.test.ts` pass. |
| 7 | Every production source is represented (loaded, unloaded-executable, unloaded-type-only); worker merge preserves identities; only complete accepted same-run bundles reach the consumer (07-05) | ✓ VERIFIED | 07-MEASUREMENT.md §5 "Production population, both directions": 239 = 239 = 239, 0 missing/extra. `scripts/coverage-unit.mjs::refuse`/`removePublicArtifacts` now runs on every failure path including a non-refusal crash (WR-03 fix, confirmed in code at `coverage-unit.mjs:394-403`). |
| 8 | CRAP 30 rejects >=30 while existing whole-tree complexity gates remain intact; missing/estimated/approximate coverage cannot pass the shipping wrapper (07-06) | ✓ VERIFIED | `git diff 587bb567..HEAD -- .fallowrc.json` shows only an `entry` addition (the new script's own dead-code entry point) — `maxCyclomatic: 20`, `maxCognitive: 15`, `maxUnitSize: 60`, `maxCrap: 0` (whole-tree) unchanged. `coverage-risk-policy.json` pins the separate production wrapper at 30. `npm run coverage:risk:negative` (20/20) exercises exactly-30-refused/29.952-passed boundary and estimated/approximate-row refusal. |
| 9 | Baseline is measured on the stable post-Phase-6 tree with the qualified producer, not research artifacts; native 100% holds while AST deficits are investigated and reported honestly; CRAP activation requires zero unexplained gaps (07-07) | ✓ VERIFIED | 07-MEASUREMENT.md §1 cites `06-VERIFICATION.md: status: passed` and the exact commit `31ed3c72` as the stability precondition; §5–§8 document every deficit (25 synthetic initializers, 1 unexecuted statement, 19 implicit-else arms) with cause/kind/disposition; §8.6 "Activation conditions" table is all "met" with evidence references. Native 100% reconfirmed live (see truth 10). |
| 10 | Normal checks produce/validate one current unit run before consuming risk metrics; pre-commit/CI/Sonar preserve scope and use content-validated artifacts; all existing gates unchanged in strength (07-08) | ✓ VERIFIED | `package.json` `check` chain: `... test:coverage:unit && coverage:unit:negative && coverage:risk && coverage:risk:negative ...` with `npm test` removed from the chain (one launch). `.pre-commit-config.yaml` hooks `npm-coverage-unit`→`coverage:unit:current`, `npm-coverage-risk`→`coverage:risk`, both scoped to `extensions/**`, `tests/**` (excl. e2e/integration/live-uat), `scripts/**`, `vendor/coverage/**`, config files — matches doc and MEASUREMENT §9.1 verbatim. `.github/workflows/ci.yml`/`sonarcloud.yml` both run `coverage:producer:build -- --verify` + `coverage:producer:check` before `npm run check`/`npm run test:coverage`. `sonar-project.properties` `sonar.javascript.lcov.reportPaths=coverage/unit.lcov` unchanged. `node --test tests/architecture/coverage-metrics-pipeline.test.ts`: 30/30 pass (in the 240-test run). |

**Score:** 10/10 truths verified (roadmap SC1/SC2 plus 8 plan-level truths), 0 present-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `scripts/coverage-capture.mjs` + `.manifest.mjs` + `.runtime.mjs` | Same-run capture, immutable-input hashing | ✓ VERIFIED | Present, exercised by 240 passing tests, wired into `npm test`/`coverage:unit:verified`/pre-commit hooks/CI |
| `scripts/coverage-producer.mjs` + `.convert.mjs`, `vendor/coverage/*` | Qualified vendored producer, pre-import identity check | ✓ VERIFIED | WR-02 fix confirmed in code; conformance corpus 29/29 pass; provenance files present and verified live |
| `scripts/coverage-source-map.mjs`, `coverage-correspondence.mjs`, `coverage-schema.mjs` | Exact coordinates, correspondence, strict schema | ✓ VERIFIED | No clamping code paths found; independent correspondence/schema tests pass |
| `scripts/coverage-unit.mjs`, `coverage-acceptance.mjs`, `coverage-validate.mjs` | Merge, accept, atomic publish, freshness readback | ✓ VERIFIED | `coverage:validate` readback succeeds live; WR-03/WR-05 fixes present in code |
| `scripts/check-coverage-risk.mjs`, `coverage-risk-policy.json` | CRAP-30 consumer wrapper with join verification | ✓ VERIFIED | `coverage:risk` live run matches MEASUREMENT.md figures exactly; WR-01/WR-04 fixes present in code |
| `.pre-commit-config.yaml`, `.github/workflows/ci.yml`, `sonarcloud.yml`, `package.json` (`check` chain) | Pipeline activated in local/CI order | ✓ VERIFIED | All wiring inspected directly, matches documented contract |
| `docs/coverage-metrics.md` | Published contract | ✓ VERIFIED | Consistent with code and post-review-fix behavior (WR-03/WR-05 language present) |
| `07-MEASUREMENT.md` | Certified figures and discrepancy dispositions | ✓ VERIFIED | Every figure I independently re-derived (validate/risk live re-runs, source spot-check, git diff of gate configs) matches |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `npm run check` | `coverage:unit:verified` (`test:coverage:unit`) | package.json chain member | ✓ WIRED | Confirmed by reading `package.json` scripts directly |
| `coverage:unit:current` / `coverage:risk` | pre-commit hooks | `.pre-commit-config.yaml` `npm-coverage-unit`/`npm-coverage-risk` | ✓ WIRED | Confirmed, correct trigger globs |
| CI `check`/`sonarcloud` jobs | producer qualification | `coverage:producer:build -- --verify` + `coverage:producer:check` before capture | ✓ WIRED | Confirmed in `ci.yml`/`sonarcloud.yml` |
| Sonar | `coverage/unit.lcov` | `sonar-project.properties` | ✓ WIRED | Unchanged, native LCOV only |
| `check-coverage-risk.mjs` | published map | `PUBLIC_ISTANBUL_PATH` constant (post WR-01 fix) | ✓ WIRED | Confirmed — no longer reads the unverified manifest field |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full coverage tooling test suite | `node --test tests/scripts/coverage-*.test.ts tests/scripts/check-coverage-risk*.test.ts tests/architecture/coverage-metrics-pipeline.test.ts` | 240 pass, 0 fail | ✓ PASS |
| Unit-bundle negative controls | `npm run coverage:unit:negative` | 32 of 32 passed | ✓ PASS |
| Risk-gate negative controls | `npm run coverage:risk:negative` | 20 of 20 passed | ✓ PASS |
| Live readback of published bundle | `npm run coverage:validate` | exit 0, "239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es)" | ✓ PASS |
| Live CRAP gate on published bundle | `npm run coverage:risk` | exit 0, max CRAP 20.00, matches MEASUREMENT.md | ✓ PASS |
| Producer conformance corpus | `npm run coverage:producer:check` | 29 of 29 pass | ✓ PASS |
| Producer provenance verify | `npm run coverage:producer:build -- --verify` | exit 0, "Producer delivery verified" | ✓ PASS |
| Gate-config non-weakening | `git diff 587bb567..HEAD -- .fallowrc.json sonar-project.properties` | Only a benign `entry` addition and a comment; no threshold/pin change | ✓ PASS |
| Debt-marker scan | `grep TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` over phase's `scripts/coverage-*.mjs` | none found | ✓ PASS |

Did not re-run the full `npm run check` (25+ min) or a fresh full-population capture, per verification guidance — the orchestrator's own re-run (exit 0, 21m27s, run `e88ba46e`) and the pre-commit hook re-captures after the review fixes are accepted as sufficient heavy evidence, and every fast/targeted check above independently corroborates the same figures.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| METRIC-01 | 07-01 through 07-08 | Reliably convert current unit coverage to Fallow-compatible Istanbul JSON and verify measurement fidelity | ✓ SATISFIED | Truths 1, 3, 5, 7, 9, 10 above; live `coverage:validate` pass |
| METRIC-02 | 07-06 through 07-08 | Select and validate a CRAP metric policy using real measurements and negative controls | ✓ SATISFIED | Truths 2, 8 above; live `coverage:risk` and `coverage:risk:negative` pass |

**Note on REQUIREMENTS.md checkbox state:** `.planning/REQUIREMENTS.md` still shows `METRIC-01`/`METRIC-02` as unchecked (`[ ]`) with traceability status "Pending", unlike the completed phases above them (marked `[x]`/"Complete"). This is not treated as a gap: prior phases in this project show the checkbox flip happens as part of phase-close (after verification passes), not during verification itself, and all functional evidence above independently confirms both requirements are met. The phase-close step should update these two rows.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none found (no TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in phase-owned `scripts/coverage-*.mjs`) | — | — |

9 Info-level findings remain open by design from `07-REVIEW.md` (IN-01 through IN-09: `--root` non-directory exit code, malformed-input stack traces vs structured rows, absolute-path producer identity, standalone `coverage:capture` leaving stale public files, Node engines-floor documentation gap, docs overstating shared `--root`, pid-reuse edge case, substring-matching test assertions, `--reuse-current` masking a validator crash as staleness). These are documented, non-blocking residue per the review-fix scope (`findings_in_scope: 5`, all fixed) — none contradicts a must-have or the roadmap success criteria, so they are recorded here as known limitations rather than gaps.

### Human Verification Required

None. All must-haves resolved to VERIFIED through direct code inspection, live re-execution of the fast/targeted commands, and cross-checked figures against 07-MEASUREMENT.md.

### Gaps Summary

No gaps found. All 10 observable truths (2 roadmap success criteria + 8 plan-level truths spanning both requirement IDs) are VERIFIED against the live codebase: the converter rejects malformed/clamped coordinates rather than repairing them, correspondence is independently walked both ways, the producer is qualified before its code executes, public artifacts are cleaned up on both refusal and crash, superseded run directories are pruned, the risk gate reads the verified map path and relays consumer stderr, and the CRAP-30 policy is wired into `npm run check`, two pre-commit hooks, and three CI jobs without weakening any pre-existing gate (`.fallowrc.json` whole-tree limits, Sonar's native-LCOV-only input, and the direct-pair pin are all unchanged). All five WR-tier review findings are confirmed fixed in the current source, not just claimed in REVIEW-FIX.md. The nine open Info items are acknowledged, non-blocking residue.

The only administrative loose end is the unflipped REQUIREMENTS.md checkboxes for METRIC-01/METRIC-02, which is a phase-close bookkeeping step, not a functional gap.

---

_Verified: 2026-09-18T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
