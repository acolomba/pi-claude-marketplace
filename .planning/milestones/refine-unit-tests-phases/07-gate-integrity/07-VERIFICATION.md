---
phase: 07-gate-integrity
verified: 2026-09-10T17:30:00Z
status: passed
score: 7/7 must-haves verified
covered_files: [".fallowrc.json",".planning/REQUIREMENTS.md",".planning/ROADMAP.md",".planning/phases/07-gate-integrity/07-01-PLAN.md",".planning/phases/07-gate-integrity/07-01-SUMMARY.md",".planning/phases/07-gate-integrity/07-02-PLAN.md",".planning/phases/07-gate-integrity/07-02-SUMMARY.md",".planning/phases/07-gate-integrity/07-03-PLAN.md",".planning/phases/07-gate-integrity/07-03-SUMMARY.md",".planning/phases/07-gate-integrity/07-04-PLAN.md",".planning/phases/07-gate-integrity/07-04-SUMMARY.md",".planning/phases/07-gate-integrity/07-05-PLAN.md",".planning/phases/07-gate-integrity/07-05-SUMMARY.md",".planning/phases/07-gate-integrity/07-06-PLAN.md",".planning/phases/07-gate-integrity/07-06-SUMMARY.md",".planning/phases/07-gate-integrity/07-07-PLAN.md",".planning/phases/07-gate-integrity/07-07-SUMMARY.md",".planning/phases/07-gate-integrity/07-08-PLAN.md",".planning/phases/07-gate-integrity/07-08-SUMMARY.md",".planning/phases/07-gate-integrity/07-09-PLAN.md",".planning/phases/07-gate-integrity/07-09-SUMMARY.md",".planning/phases/07-gate-integrity/07-10-PLAN.md",".planning/phases/07-gate-integrity/07-10-SUMMARY.md",".planning/phases/07-gate-integrity/07-11-PLAN.md",".planning/phases/07-gate-integrity/07-11-SUMMARY.md",".planning/phases/07-gate-integrity/07-12-PLAN.md",".planning/phases/07-gate-integrity/07-12-SUMMARY.md",".planning/phases/07-gate-integrity/07-13-PLAN.md",".planning/phases/07-gate-integrity/07-13-SUMMARY.md",".planning/phases/07-gate-integrity/07-14-PLAN.md",".planning/phases/07-gate-integrity/07-14-SUMMARY.md",".planning/phases/07-gate-integrity/07-15-PLAN.md",".planning/phases/07-gate-integrity/07-15-SUMMARY.md",".planning/phases/07-gate-integrity/07-16-PLAN.md",".planning/phases/07-gate-integrity/07-16-SUMMARY.md",".planning/phases/07-gate-integrity/07-CONTEXT.md",".planning/phases/07-gate-integrity/07-REVIEW-FIX.md",".planning/phases/07-gate-integrity/07-REVIEW.md",".planning/phases/07-gate-integrity/07-VALIDATION.md","extensions/pi-claude-marketplace/domain/components/hook-events.ts","extensions/pi-claude-marketplace/domain/manifest.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","scripts/test-coverage-direct.mjs","scripts/test-coverage-direct.negative.mjs","tests/architecture/closed-set-enrollment.test.ts","tests/architecture/config-state-write-seams.test.ts","tests/architecture/eslint-effective-config.test.ts","tests/architecture/eslint-effective-config.ts","tests/architecture/gate-targets.test.ts","tests/architecture/gate-targets.ts","tests/architecture/hooks-dispatch.test.ts","tests/architecture/import-boundaries.test.ts","tests/architecture/no-credential-leak.test.ts","tests/architecture/no-shell-out.test.ts","tests/architecture/no-test-only-production-surface.test.ts","tests/architecture/partial-vocabulary-guard.test.ts","tests/architecture/scope-order-drift.test.ts","tests/architecture/source-scan.ts","tests/architecture/temp-root-control.ts","tests/architecture/unowned-exports-census.test.ts"]
covered_digest: "v1:sha256:2606d55e77882710cba9abe56ffd1ed8acac789f80c08787288b7c508847ca29"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  note: "No prior VERIFICATION.md existed for this phase; this is the initial verification."
deferred:
  - truth: "CONVENTIONS.md 'exactly 11 fallow-ignore markers' claim"
    addressed_in: "carried-forward, out of Phase 7 scope"
    evidence: "07-16-SUMMARY.md Open Items #1 — measured 12 markers (07-08 added an approved SCN-F025 compile-time-proof marker); routed for a doc fix, not a Phase 7 blocker"
  - truth: "shared/concerns/hooks.ts:20-24 falsified satisfies claim"
    addressed_in: "carried-forward, out of Phase 7 scope"
    evidence: "07-16-SUMMARY.md Open Items #2 — 07-08 corrected the identical claim in hook-events.ts but could not touch this second file"
  - truth: "PROJECT.md promises tests/architecture/no-legacy-markers.test.ts"
    addressed_in: "carried-forward, out of Phase 7 scope"
    evidence: "07-16-SUMMARY.md Open Items #3 — git log --all confirms the file was never written; the dangling citation inside shared/markers.ts was fixed, PROJECT.md's promise was not"
  - truth: "markers-snapshot.test.ts's three duplicated agents-bridge byte pins"
    addressed_in: "Phase 9 (recorded disposition: move to tests/bridges/agents/marker.test.ts, the owner test)"
    evidence: "07-16-SUMMARY.md Open Items #4; matches the phase's own CONTEXT.md ruling on SHC-F047"
  - truth: "pre-commit run --all-files unicode-dash exclusion asymmetry"
    addressed_in: "Phase 9's CLOSE-01"
    evidence: "07-16-SUMMARY.md Open Items #5 and Chain Results; reproduced independently below, unrelated to any Phase 7 gate's firing behavior"
  - truth: "bridges/commands/discover.ts and bridges/hooks/event-router.ts direct-coverage branch shortfalls"
    addressed_in: "Phase 8's RCOV-03"
    evidence: "traced to Phase 6 splits, named explicitly in the verification brief as out of Phase 7 scope"
---

# Phase 7: Gate Integrity Verification Report

**Phase Goal:** Make structural gates prove that they scan and enforce real production contracts.
**Verified:** 2026-09-10T17:30:00Z
**Status:** passed
**Re-verification:** No — initial verification.

## Note on ROADMAP.md checkbox staleness

`.planning/ROADMAP.md`'s Phase 7 section still shows `**Plans:** 12/16 plans executed`
and leaves Waves 4–6 (`07-13` through `07-16`) unchecked. This is a documentation
artifact, not evidence of incomplete work: every one of the 16 `SUMMARY.md` files
carries `status: complete` in its frontmatter, every plan's commits are present in
`git log --all` (verified: `3412d600`, `9b9b4444`, `504194a7`, `f7997ff9`,
`f677bff4`, plus the nine `fix(07):` review-fix commits), and `07-16-SUMMARY.md`
explicitly declares itself "the last plan of Phase 7" and closes the phase on a
green `npm run check`. This report verifies the actual codebase, not the checkbox
state, and treats all 16 plans as landed. The checkbox staleness itself is not a
phase-goal gap and is not scored below.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Terminal scanning-gate gaps prove target visitation and pass a synthetic offender + benign control (SC1, GGAT-01) | VERIFIED | `node --test "tests/architecture/*.test.ts"` → 410/410 pass (live re-run). Spot-checked `no-credential-leak.test.ts`, `no-test-only-production-surface.test.ts`, `gate-targets.test.ts` directly: each carries visited-path deep-compare, a temp-root offender, and benign/near-miss controls. See finding F1. |
| 2 | Changed-pair discovery proves deterministic base selection and a fail-closed zero-selection case (SC1, GGAT-01) | VERIFIED | `scripts/test-coverage-direct.mjs`'s `selectBase()` walks `origin/main → main → upstream → HEAD~1`, prints the chosen candidate (`Changed-pair base: ...`), and returns `ok:false` only when every candidate fails. `npm run test:coverage:direct:negative` (live re-run) → exit 0, printing all five planted fixture states including the CR-02 fix's new fixture-pair proof. See finding F2. |
| 3 | `FLOW-07` varies effective config sources and broad overrides across both terminal ESLint/Fallow boundary gaps and proves target visitation (SC2, GGAT-03) | VERIFIED | `tests/architecture/eslint-effective-config.ts` resolves via `ESLint#calculateConfigForFile`; `overrideConfigFile` is the string form naming the real `eslint.config.js` everywhere — `grep -rn "overrideConfigFile: true"` returns 0 hits repo-wide. Three offenders (`BLANKET_NO_CONSOLE_OFF`, `RESTRICTED_PATHS_OFF`, `ZONE_SUBSTITUTION`) exist and are asserted single-block via `assertSingleAppendedBlock`. `node --test tests/architecture/eslint-effective-config.test.ts` (live re-run) → 5/5 pass. See finding F3. |
| 4 | Closed-set and delegated-contract gates exercise real production consumers and any public seams created by approved splits (SC3, GGAT-04) | VERIFIED | `__operations` and `__deps` are absent from `extensions/` (`grep -rn` → 0 hits). `no-test-only-production-surface.test.ts` fires on a planted `__`-prefixed member and does NOT fire on `bridges/mcp/safe-set.ts`'s `key === "__proto__"` prototype-pollution defense or `mcp__server__tool` naming — confirmed both by reading `safe-set.ts` (string comparison, not member position) and by the gate's own passing test `a __-prefixed member inside a line comment passes`. `node --test tests/architecture/no-test-only-production-surface.test.ts` (live re-run) → 10/10 pass. See finding F4. |
| 5 | Every gate addressing targets by an assembled path is discoverable without a literal path in its own source, and still resolves each target (Criterion 4) | VERIFIED | `gate-targets.test.ts`'s assembly rule keys on a `.ts`-suffixed literal *segment* inside `path.join`/`path.resolve` that is not already a whole repo-relative path (`WHOLE_REPO_RELATIVE` test) — not on the mere presence of `path.join`. Directly confirmed it does NOT fire on the shared scan mechanic (`source-scan.ts`'s `path.join(scanRoot, rel)`, `rel` a variable) via the passing case `the assembly rule does not report the shared scan mechanic itself`. `node --test tests/architecture/gate-targets.test.ts` (live re-run) → 15/15 pass, including the corroboration clause (`T-07-48`). See finding F5. |
| 6 | The production-unowned-export census is a pinned exact-match set, not a length check, and detects a same-length swap (D-07-19) | VERIFIED — reproduced live | `assert.deepStrictEqual(measured, UNOWNED_EXPORT_CENSUS, ...)` at `unowned-exports-census.test.ts:170`. I swapped two export-name entries between two registry groups (same total count) and reran the test: it failed with a full-object diff naming the exact mismatch. Restored the file byte-for-byte (`diff` confirms identity) and reran — 3/3 pass. Census counts exactly 100 (89 `extensions/` + 11 `scripts/`), matching `D-07-19`'s measured figure precisely. See finding F6. |
| 7 | `.fallowrc.json`'s `production: false` setting is untouched by Phase 7 (D-07-20) | VERIFIED | `git log --oneline -- .fallowrc.json` shows no Phase 7 commit touched the file (last touching commits predate this milestone: `697d6812`, `39dc5b89`, `2df8ae48`). `grep '"production"' .fallowrc.json` → `false`, unchanged. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### The Phase's Central Adversarial Claim: Can Each Touched Gate Actually Fail?

The verification brief's core question was not "does `npm run check` pass" but
"can each gate this phase touched be made to fail?" Three live plant-and-restore
experiments were run directly against the working tree (all restored, `git status`
confirmed clean afterward):

1. **Credential-leak gate, the CR-01 "sixth vacuous pass."** The code review found
   the gate's own documented bypass (`[^)]*` cannot cross a literal `)`) was left
   open in 4 of 6 scans, including `git-credential.ts`'s `errorWithCred` check.
   The review-fix commit `a469cde6` claims this was closed by routing all six scans
   through `assertNoCredentialInLiterals`/`fullTemplateLiteralsAfter`. I appended the
   exact documented-bypass offender (`` `git credential fill failed for ${describeHostProbe(opts)}: ${cred.password}` ``)
   to a real copy of `platform/git-credential.ts` and reran the gate: it failed with
   `AUTH-09 violation: ... interpolates a credential field past a literal ) or
   beyond the first interpolation`, naming the exact planted string. Restored; the
   file is byte-identical to its pre-experiment state.

2. **The meta-gate's segment-vs-`path.join` discriminator.** Read the assembly
   rule's implementation directly (`gate-targets.test.ts:346-356`): it matches a
   quoted `.ts`-suffixed literal inside a `path.join`/`path.resolve` call only when
   that literal is NOT already a whole repository-relative path. `source-scan.ts`'s
   own `path.join(scanRoot, rel)` passes a *variable*, not a literal, so the rule
   structurally cannot fire on it — confirmed by the passing case that materializes
   `source-scan.ts` unmutated and asserts zero offenders.

3. **The unowned-export census's exactness.** Swapped one export name between two
   adjacent registry file entries (equal total count, so a length-only check would
   have passed). `assert.deepStrictEqual` caught it immediately with a full-object
   diff. This is empirical proof the gate is not a `.length === N` pin dressed up as
   something stronger.

All three experiments reproduce the phase's own review-fix claims rather than
merely trusting the SUMMARY narrative.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/architecture/gate-targets.ts` | Central literal-path registry (D-07-05) | VERIFIED | 24 array-valued groups, 121 entries, 117 resolve on disk (4 deliberate `MISSING_TARGET_PROBES`); exists, substantive, imported by every re-pointed gate |
| `tests/architecture/gate-targets.test.ts` | Self-hosting meta-gate (D-07-06) | VERIFIED | 15/15 tests pass live; two enforcement rules (naming, assembly) plus a blinded-extractor corroboration clause |
| `tests/architecture/temp-root-control.ts` | Shared `mkdtemp`/copy/mutate helper (Wave 0) | VERIFIED | `materializeTargets`/`appendToCopy` route through `insideRoot` (WR-07 fix, commit `8945958f`), confirmed present |
| `tests/architecture/eslint-effective-config.ts` | Effective-config resolver via `calculateConfigForFile` (D-07-09) | VERIFIED | No test cases of its own by design; exports offenders + `resolveEffectiveConfigs`/`assertSingleAppendedBlock`, consumed by `eslint-effective-config.test.ts` and `import-boundaries.test.ts` |
| `tests/architecture/no-test-only-production-surface.test.ts` | `__`-prefixed test-only surface gate (D-07-18) | VERIFIED | 10/10 pass live; walks 229 modules; `__operations`/`__deps` confirmed absent from `extensions/` |
| `tests/architecture/unowned-exports-census.test.ts` | Pinned production-unowned-export census (D-07-19) | VERIFIED | 3/3 pass live; `deepStrictEqual` against committed `UNOWNED_EXPORT_CENSUS`; swap-detection reproduced live |
| `scripts/test-coverage-direct.mjs` | Fail-closed, deterministic base selection (D-07-13, D-07-14) | VERIFIED | `selectBase`, `pairForPath`, `toProjectPath`, `isStructuralSupplement` all take/thread a root parameter (CR-02 fix confirmed by reading the source) |
| `scripts/test-coverage-direct.negative.mjs` | Negative harness proving base-selection and fixture-pair cases (D-07-15) | VERIFIED | Live re-run: all five planted states pass, including the fixture-pair-resolves-under-injected-root case CR-02 added |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tests/architecture/*.test.ts` (20 gates) | `tests/architecture/gate-targets.ts` | `import { ... } from "./gate-targets.ts"` | VERIFIED | Confirmed via the meta-gate's own passing "naming rule" case — a production path outside the registry is caught, so every currently-shipping literal must already be registry-carried |
| `tests/architecture/*.test.ts` | `tests/architecture/eslint-effective-config.ts` | `resolveEffectiveConfigs`/`ESLint#calculateConfigForFile` | VERIFIED | `eslint-effective-config.test.ts` and `import-boundaries.test.ts` both call it; live test run confirms the offenders flip resolved severity |
| `orchestrators/plugin/reinstall-flow.ts` | `orchestrators/plugin/reinstall-replace.ts` | `ReinstallTransaction.replaceOperations` | VERIFIED | `__operations` and `__deps` confirmed removed repo-wide; `no-test-only-production-surface.test.ts`'s classification case names `replaceOperations` on `reinstall-flow.ts` and a rename-control (case 10) proves the assertion actually fires |
| `scripts/test-coverage-direct.negative.mjs` | `scripts/test-coverage-direct.mjs` (`pairsForChangedPaths`) | direct import, fixture root injection | VERIFIED | Live re-run passes the new fixture-pair-under-injected-root case the CR-02 fix added |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Credential-leak gate fires on the documented bypass (git-credential.ts) | Planted offender + `node --test tests/architecture/no-credential-leak.test.ts` | Failed with the exact expected AUTH-09 assertion message | ✓ PASS |
| Census gate detects a same-length swap | Swapped two export names, same total count + `node --test tests/architecture/unowned-exports-census.test.ts` | `deepStrictEqual` failure naming the mismatch | ✓ PASS |
| Meta-gate assembly rule does not fire on its own scan mechanic | `node --test tests/architecture/gate-targets.test.ts` | `the assembly rule does not report the shared scan mechanic itself` passes | ✓ PASS |
| ESLint effective-config gate flips on a blanket override | `node --test tests/architecture/eslint-effective-config.test.ts` | `GGAT-03: a blanket block disabling no-console flips the resolved severity and fails the gate` passes | ✓ PASS |
| Test-only-surface gate ignores `__proto__`/`mcp__` and fires on a planted `__` member | `node --test tests/architecture/no-test-only-production-surface.test.ts` | 10/10 pass, including both the negative (safe-set/MCP naming) and positive (planted member) cases | ✓ PASS |
| Full quality/test chain | `npm run check` (background, live run) | exit 0; `npm test` 5952/5952 pass; `npm run test:integration` 32/32 pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| GGAT-01 | 07-01, 07-02, 07-03, 07-04, 07-05, 07-06, 07-16 | Scanning-gate visitation, offender/benign controls, deterministic changed-pair base selection, fail-closed zero-selection | SATISFIED | Truths 1, 2; live test runs; `selectBase` source read directly |
| GGAT-03 | 07-07 | `FLOW-07`'s two terminal ESLint/Fallow boundary gaps: effective config resolution, three offenders, target visitation | SATISFIED | Truth 3; live test run; `overrideConfigFile: true` confirmed absent repo-wide |
| GGAT-04 | 07-08, 07-09, 07-10, 07-12, 07-13 | Closed-set/delegated-contract gates cover real production consumers and public seams from approved splits | SATISFIED | Truth 4; `__operations`/`__deps` confirmed removed; gate fires on planted offender and not on legitimate `__`-bearing code |

No orphaned requirements: `GGAT-01`, `GGAT-03`, `GGAT-04` are the only three requirements ROADMAP.md and REQUIREMENTS.md map to Phase 7, and all three are claimed by at least one plan's `requirements:` field.

### Anti-Patterns Found

None blocking. The code review (`07-REVIEW.md`) found and the review-fix
(`07-REVIEW-FIX.md`) closed 2 critical + 7 of 8 warning findings, each verified
live above or by direct source reading. Two Info-level findings (`IN-01`: a bare
`--all` CLI arm degrades one completeness check to a tautology when invoked by
hand outside any npm script; `IN-03`: one gate's positive-direction probe checks
occurrence rather than declaration shape) and one Warning's control-shape ask
(`WR-05`'s `withTempRoot` case, the underlying finding itself fixed and measured
another way) were explicitly left out of the fix pass's scope per its own recorded
brief. None of the three touches a truth this phase's roadmap criteria assert —
they are narrower quality asks than the phase's scanning/firing contract — and
none was found in this verification's own independent grep/read pass over the
higher-risk gates named in the verification brief (`gate-targets.test.ts`,
`unowned-exports-census.test.ts`).

### Human Verification Required

None. Every truth above is either directly observable in source (grep/read) or
was independently exercised live with a planted offender and a restore, matching
the phase's own stated proof standard.

### Gaps Summary

No gaps. All 7 must-have truths verified against live-executed evidence, not
SUMMARY narrative. The two REVIEW blockers (CR-01 credential-leak bypass, CR-02
half-threaded root) were independently reproduced as fixed. `npm run check` is
green end to end (5952 unit + 32 integration tests, 0 failures). Six deferred
items are carried forward per the phase's own CONTEXT.md rulings and the
verification brief's explicit scope list; none blocks the Phase 7 goal.

---

_Verified: 2026-09-10T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
