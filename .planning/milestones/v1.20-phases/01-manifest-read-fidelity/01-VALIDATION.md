---
phase: "1"
slug: "manifest-read-fidelity"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-12"
audited: "2026-09-14"
manual_uat_status: pending
---

# Phase 1 — Validation Strategy

Automated coverage audit of all four executed plans, updated for the current tree and the later decisions D-01-34 through D-01-37. All seven requirements have automated behavioral coverage. The candidate-reader defect and assertion blind spot found during review are repaired and verified by an executed negative control. Live confirmation of the two named marketplace plugins remains pending; this document does not approve manual UAT.

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | `node:test` and `node:assert/strict`; strict interaction mocks use `strong-mock` |
| Config file | `package.json` test scripts |
| Quick command | `node --test <verified existing test paths>` |
| Full suite command | `npm run check` |
| Pairing command | `npm run test:corresponding` |
| Measured targeted runtime | 5.8 seconds for the ten-file run; 0.9 seconds for the three additional files |

The current full chain includes `typecheck`, `lint`, `lint:workflows`, `lint:workflows:negative`, `fallow`, `format:check`, corresponding-test positive and negative checks, direct-coverage negative checks, unit tests, and integration tests. A green whole suite does not establish isolated source/test coverage or manual acceptance; those remain separate review gates.

## Sampling Rate

- After each task: run the touched test pairs and the corresponding-test gate.
- After a plan wave: run typecheck, lint, fallow, and unit tests.
- Before phase acceptance: run the full check chain and pre-commit gates, and resolve the manual UAT items below.
- No watch-mode commands are used.

## Per-Task Verification Map

All paths in this map exist in the audited tree. Each command is `node --test` followed by the listed paths. Status refers to automated behavior coverage, not live UAT. The D-01-37 row includes the repaired non-file regression and a negative control that changes only the info reader and fails all four selected assertions.

| Task | Wave | Requirements / decisions | Behavior and test paths | Status |
| --- | --- | --- | --- | --- |
| 01-01-1 | 1 | MANF-01, MANF-02, D-01-06, D-01-12 | Shared frozen ordering and a real planted tree read by all three readers: `tests/domain/manifest-path.test.ts`, `tests/architecture/manifest-read-agreement.test.ts` | COVERED |
| 01-01-2 | 1 | MANF-01, MANF-02, MANF-04, MANF-05 | Bare location, wrapped precedence, malformed/unreadable refusal, no-manifest success: `tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/plugin/shared.test.ts` | COVERED |
| 01-02-1 | 1 | DEPS-01, DEPS-02, D-01-25 through D-01-28 | String/object parsing, range and SHA preservation, whole-declaration rejection: `tests/domain/dependencies.test.ts` | COVERED |
| 01-02-2 | 1 | DEPS-01, DEPS-02, D-01-01 through D-01-04, D-01-30, D-01-31 | Marketplace fill-in, constraints, stable name sorting and last-declaration collapse: `tests/orchestrators/plugin/info.test.ts` | COVERED |
| 01-02-3 | 1 | DEPS-01, D-01-22 | Catalog forward/inverse matching and exact emitted bytes: `tests/architecture/catalog-uat/catalog-contract.test.ts` | COVERED |
| 01-03-1 | 2 | MANF-03, D-01-14 through D-01-17 | Canonical paths after containment, dot for root, case-sensitive keys, raw refusal text: `tests/domain/plugin-resolver.test.ts`, `tests/domain/component-paths.test.ts` | COVERED |
| 01-03-2 | 2 | MANF-03, D-01-21 | Same-directory dedup with sibling preservation and real collision warnings: `tests/bridges/skills/discover.test.ts` | COVERED |
| 01-03-3 | 2 | MANF-03 | Both named plugin shapes preserve all expected skills with zero duplicate warnings: `tests/architecture/declared-component-path-overlap.test.ts` | COVERED |
| 01-04-1 | 2 | DEPS-01, DEPS-02, D-01-32 | Own-manifest authority, absent/silent distinction, warm/cold behavior, refused paths, no clone on cold read: `tests/orchestrators/plugin/info.test.ts`, `tests/architecture/no-orchestrator-network.test.ts` | COVERED |
| 01-04-2 | 2 | MANF-01, DEPS-01, D-01-12 | All three readers use the same planted file, with differing entry/manifest declarations proving precedence: `tests/architecture/manifest-read-agreement.test.ts` | COVERED |
| Review closure | — | MANF-03, D-01-34 | Overlapping command roots install each source once and preserve undeclared siblings: `tests/bridges/commands/discover.test.ts`, `tests/architecture/declared-component-path-overlap.test.ts` | COVERED |
| Review closure | — | DEPS-01, DEPS-02, D-01-35 | Invalid declarations reject as a whole; named marketplace entries become unsupported stubs, unnamed invalid entries are dropped, healthy siblings remain; installed info reports rejection: `tests/domain/dependencies.test.ts`, `tests/domain/manifest.test.ts`, `tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/plugin/info.test.ts` | COVERED |
| Review closure | — | DEPS-01, DEPS-02, D-01-36 | Name/marketplace/version/SHA bounds, compound ranges and caller-supplied marketplace validation: `tests/domain/dependencies.test.ts`, `tests/orchestrators/plugin/info.test.ts` | COVERED |
| Review closure | — | MANF-02, MANF-04, D-01-37 | Non-directory wrapper and non-file fall-through; denied/stat/read failure and malformed candidates stop before the bare sibling; real symlink-loop witness: `tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/plugin/shared.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/architecture/manifest-read-agreement.test.ts` | COVERED |

## Current Contract and Artifact Corrections

- `domain/resolver.ts` and its test were replaced by `domain/plugin-resolver.ts` and its pair; component normalization now lives in `domain/component-paths.ts`.
- Catalog assertions moved from `tests/architecture/catalog-uat.test.ts` to `tests/architecture/catalog-uat/catalog-contract.test.ts`; notification code was split into `notification-*` modules.
- D-01-34 supersedes the commands exclusion in the original plan. Its regression gate is included above.
- D-01-35 supersedes every old silent-drop assertion. Invalid dependency declarations are rejected as a whole. Missing and empty declarations remain valid.
- D-01-36 bounds rendered fields and validates marketplace fill-in; D-01-37 specifies the manifest-candidate failure policy.
- Cold/unavailable notification variants do not expose a dependency list. Tests assert the actual catalogued result and the absence of a clone rather than claiming an invisible fallback value was rendered.

## Wave 0 Requirements

- [x] `tests/domain/manifest-path.test.ts` exists and passes.
- [x] `tests/domain/dependencies.test.ts` exists and passes.
- [x] `tests/architecture/manifest-read-agreement.test.ts` plants actual manifest files and passes.
- [x] `tests/architecture/declared-component-path-overlap.test.ts` covers skills and commands.
- [x] Existing test framework is sufficient; no installation required.

## Manual-Only Verifications

| Item | Why automated fixtures are insufficient | Action and expected result | Status |
| --- | --- | --- | --- |
| Live `ui5` installation | The roadmap names an actual marketplace plugin; the hermetic gate reproduces its declaration and eight skill directories | Install the real `ui5` plugin from its marketplace in a disposable scope, capture output and installed skills, confirm all eight expected skills and zero duplicate-skill warnings | PENDING |
| Live `ui-theme-designer` installation | The hermetic gate reproduces its two declared paths rather than fetching the marketplace plugin | Install the real plugin in a disposable scope, capture output and installed skills, confirm both expected skills and zero duplicate-skill warnings | PENDING |

These are integration acceptance checks, not missing automated tests for MANF-03. The phase orchestrator must retain them in verification/UAT until actual evidence closes them.

## Validation Audit 2026-09-14

| Metric | Count |
| --- | --- |
| Requirements with automated tests | 7 |
| Original tasks with automated verification | 10 |
| Current targeted test files executed | 13 |
| Review gaps found | 2 |
| Review gaps resolved | 2 |
| Automated gaps remaining | 0 |
| Tests generated by this audit | 0 |
| Pending live integration confirmations | 2 |

Commands executed successfully:

```sh
node --test --test-reporter=spec tests/domain/manifest-path.test.ts tests/domain/dependencies.test.ts tests/domain/plugin-resolver.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/plugin/info.test.ts tests/bridges/skills/discover.test.ts tests/architecture/manifest-read-agreement.test.ts tests/architecture/declared-component-path-overlap.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/no-orchestrator-network.test.ts
node --test --test-reporter=spec tests/domain/component-paths.test.ts tests/domain/manifest.test.ts tests/bridges/commands/discover.test.ts
npm run test:corresponding
```

The first run reports ten file-level passes, the second three, with no failures or skips. The pairing gate reports `Corresponding-test gate passed.` The initial attempt using the old resolver/catalog filenames is excluded from evidence because Node ignored those missing paths. The preliminary no-gap result was withdrawn after review. The fixes and verification below now close both gaps; the original passing tests alone were not used as closure evidence.

## Review Gap Closure 2026-09-14

| Gap | Repair | Verification | Status |
| --- | --- | --- | --- |
| CR-03: D-01-37 non-file disagreement | `4053f227` adds the info reader's regular-file check before reading bytes; non-files, ENOENT and ENOTDIR permit fallback, other failures stop the walk | Real device (`os.devNull`), directory and non-directory wrapper fixtures make all three public readers select the bare manifest; direct info cases cover EACCES, ELOOP and non-errno stat failure | CLOSED |
| CR-04: D-01-37 third-reader assertion blind spot | `b64f0b98` makes the forbidden bare sibling carry invalid dependencies so wrong selection changes the complete public notification | A temporary mutation only to `readOwnManifestDependencies` made all four selected malformed/ELOOP/non-object assertions fail; restored production code passed all 177 focused tests | CLOSED |

`01-REVIEW-FIX.md` records the exact checks and restoration evidence:

- `node --test --test-isolation=none tests/orchestrators/plugin/info.test.ts tests/architecture/manifest-read-agreement.test.ts`: 177 passed, zero failed or skipped after restoration.
- Direct info pair coverage: 396/396 branches, 79/79 functions and 2831/2831 lines.
- Full `npm run check`: exit 0, 6,124 unit tests and 32 integration tests passed with no failures or skips.
- Exact-path pre-commit checks and equivalent filesystem secret scans passed for both repairs.

The mutation log `/tmp/phase1-cr04-negative.log` confirms that resolver state and version remained unchanged while only the info notification changed. This closes the masking defect rather than relying on aggregate green output. The mutation was removed and the production file verified byte-identical to committed code. No broad tests were repeated during this document reconciliation because the source was unchanged after the reported checks.

The prerequisite coverage-pin refresh `b84d7061` preserves the commands module's existing deficit of one branch and two lines (BC-019). It is not evidence of 100% direct coverage for that module; the current 100% figure above applies only to info. No coverage allowance was widened.

Independent re-review in `01-REVIEW.md` is clean: zero blockers, zero warnings, and 12 focused tests passed. CR-03 and CR-04 are closed. This does not replace the pending human verification.

## Validation Sign-Off

- [x] Every executed task has automated verification.
- [x] No three consecutive tasks lack automated verification.
- [x] All Wave 0 references now exist.
- [x] No watch-mode flags.
- [x] Targeted feedback is below ten seconds in this audit.
- [x] Shared-reader contract has effective negative-control coverage; `nyquist_compliant: true`.
- [ ] Live marketplace-plugin UAT is approved.

**Approval:** automated validation completed 2026-09-14; the two live marketplace-plugin confirmations remain pending. Logic-change human review recorded in `01-REVIEW-FIX.md` is not approved by this audit.
