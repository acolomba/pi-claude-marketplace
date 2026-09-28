---
phase: 109-kind-inversion
verified: 2026-09-04T00:00:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 109: Kind inversion Verification Report

**Phase Goal:** `workflows` moves from `UNSUPPORTED_COMPONENT_KINDS` to both supported tuples, and
every closed set, classifier arm, doc, and locking test that #154 wrote is turned with it
(WINV-01..05).
**Verified:** 2026-09-04 (re-run against `features/workflow` HEAD `304f4dfe`)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `workflows` is absent from `UNSUPPORTED_COMPONENT_KINDS`/`UNSUPPORTED_COMPONENT_CONVENTIONS` and present in both `SUPPORTED_COMPONENT_KINDS` (5) and `SUPPORTED_COMPONENT_PATH_KINDS` (4) | ✓ VERIFIED | Read `extensions/pi-claude-marketplace/domain/resolver.ts:353-397` directly: `SUPPORTED_COMPONENT_KINDS = ["skills","commands","agents","hooks","workflows"]`; `SUPPORTED_COMPONENT_PATH_KINDS = ["skills","commands","agents","workflows"]`; `UNSUPPORTED_COMPONENT_KINDS` has 7 members, none `workflows`; `UNSUPPORTED_COMPONENT_CONVENTIONS` has 5 entries, none keyed `workflows` |
| 2 | `componentPaths.workflows` exists as a required field on all three spellings (schema, accumulator, initializer) | ✓ VERIFIED | `ComponentPathsSchema` (line 68-73), `PartialResolution.componentPaths` (line 417), `emptyResolution()` (line 445) all carry `workflows: string[]` / `workflows: []` |
| 3 | The `{workflows}` reason token is retired from `REASONS`, `notify-reasons.ts`, and `probe-classifiers.ts`, and both independent length pins read 43 | ✓ VERIFIED | `grep -n workflows` on all three shared files shows only the retained arithmetic ledger comment; `grep -n 'REASONS.length'` in both lock test files reads `43`; live `node --test` run on both confirms `pass` |
| 4 | `docs/output-catalog.md` states the post-inversion behavior with ids matching what they render, and `catalog-uat` pairs byte-for-byte | ✓ VERIFIED | Direct read of the three blocks (lines 431-444, 567-580, 622-636); `grep -c '{workflows}' docs/output-catalog.md` = 0; `node --test tests/architecture/catalog-uat.test.ts` → 6/6 pass |
| 5 | Every locking gate (`compat-01`, `notify-closed-set-locks`, `notify.test.ts`, `hooks-foundation`, `catalog-uat`, `resolver.test.ts` WINV-01 pattern) was observed RED against unmodified production code and then GREEN — a red-then-green pair, not an absence (Success Criterion 4) | ✓ VERIFIED | `109-01-SUMMARY.md` §Red observations captures all six RED runs verbatim with `git diff --name-only 85fecdba~1..HEAD -- extensions/` = 0 files, confirming production was untouched at capture time; `109-02-SUMMARY.md`/`109-04-SUMMARY.md` pair each with its GREEN run; independently re-ran all six at current HEAD — all green |
| 6 | A real install of a workflow-bearing plugin succeeds with no `--partial` flag and renders the clean installed row (WINV-02) | ✓ VERIFIED | `tests/integration/workflow-kind-inversion.test.ts` drives a real `installPlugin`; re-ran directly — 1/1 pass. Test asserts the joined notification summary contains `(installed)` and excludes `(failed)`, `(partially-available)`, `--partial`, `{workflows}` |
| 7 | The install-level test is non-vacuous — it fails if the fixture does not actually engage the inverted kind | ✓ VERIFIED | The test asserts `record.compatibility.supported.includes("workflows")` against the persisted install record before the ENOENT check; the code-review's independent mutation (rename `workflows/` → `NOTworkflows/`, observe red, restore, observe green) is recorded in `109-REVIEW.md` WR-01 and matches the current test body |
| 8 | The D-109-06 window (no workflow artifact materializes) is pinned as a fact, not an undocumented gap | ✓ VERIFIED | The same integration test asserts `stat(<HOME>/.pi/workflows)` rejects with `ENOENT`; the carry-forward obligation to invert this in Phase 111 is recorded in `109-CONTEXT.md`, `109-05-SUMMARY.md`, and — after the CR-01 fix — durably in `ROADMAP.md` §Phase 111 Success Criteria items 7-8 |
| 9 | No `docs/` prose states that a workflow-bearing plugin degrades (WINV-05) | ✓ VERIFIED | `grep -n -i workflow docs/output-catalog.md` — all nine hits read the post-inversion meaning; `grep -oE '44-member|44-entry' docs/output-catalog.md` = 0; the other four tracked docs mentioning "workflow" are unrelated generic/competitive-analysis usages, not plugin-degradation claims |
| 10 | No release was cut and no version was bumped inside the 109-111 window (A-03) | ✓ VERIFIED | `EXTENSION_VERSION`, `package.json` version, `sonar-project.properties` all read `0.18.1`; `git log -- CHANGELOG.md` shows last touch at `872b2d34` (pre-phase-109, PR #154), confirming it is untouched by this phase |
| 11 | Requirements WINV-01..05 are each satisfied by concrete artifacts/tests, not merely claimed | ✓ VERIFIED | Cross-referenced against `REQUIREMENTS.md` (all five checked `[x]` and mapped "Phase 109 / Complete") and against the direct codebase evidence in rows 1-9 above |
| 12 | `npm run check`'s full gate chain is green against the inverted tree | ✓ VERIFIED | Independently re-ran: `npm run typecheck` (0 errors), `npm run lint` (exit 0), `npm run fallow` (exit 0 — pre-existing duplication debt unrelated to this phase, confirmed by glyph-vs-exit-code per the phase's own note), `npm run format:check` (clean), `npm run test:corresponding` / `:negative` (pass), `npm run test:coverage:direct:negative` (pass), `npm test` (5197/5197 pass), `npm run test:integration` (32/32 pass) |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | workflows in both supported tuples, out of unsupported tuple/conventions, `componentPaths.workflows` on all 3 spellings | ✓ VERIFIED | Confirmed by direct read; `SECURITY (T-02-25)` and `D-90-06` comments survive |
| `extensions/pi-claude-marketplace/domain/components/plugin.ts` | workflows field moved to `SUPPORTED_COMPONENT_PATH_FIELDS` | ✓ VERIFIED | `grep -c workflows` = 1 (single bag) |
| `extensions/pi-claude-marketplace/shared/notify.ts` | 43-member REASONS, corrected catalog-stability narrative | ✓ VERIFIED | `grep -c '43-entry'` = 1; `REASONS.length` test passes at 43 |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | narrowed `UnsupportedReason` group, corrected count derivation | ✓ VERIFIED | Retained `WDET-04 / D-106-04` term + one new `WINV-03` arithmetic term |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | 4-member `UnsupportedReason` alias, 2-carveout `kindToReason` | ✓ VERIFIED | `grep -c -i workflow` = 0; classifier test turned to fall-through assertion |
| `docs/output-catalog.md` | 3 turned catalog-state blocks under matching ids | ✓ VERIFIED | ids `workflow-available-inventory`, `workflow-install-success`, `workflow-plus-unsupported-rejection` each appear exactly once, paired in `catalog-uat.test.ts` |
| `tests/integration/workflow-kind-inversion.test.ts` | install-level proof of both window halves | ✓ VERIFIED | New file, tracked, 1 test, passes; non-vacuity precondition present |
| 76 `componentPaths` construction/assertion sites across 11 test files | widened with the 4th key | ✓ VERIFIED | `npm run typecheck` 0 errors; `npm test` 5197/5197 pass; `grep -rn 'componentPaths: {' tests/ --include=*.test.ts \| wc -l` = 76 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `docs/output-catalog.md` | `tests/architecture/catalog-uat.test.ts` | id-string pairing (`${section}::${state}`) | ✓ WIRED | 6/6 pass, no orphan on either the forward or inverse walk |
| `tests/architecture/hooks-foundation.test.ts` | `extensions/.../domain/resolver.ts` | imports and pins both closed-set tuples | ✓ WIRED | 9/9 pass including the 5-tuple pin and the negative mirror |
| `extensions/.../domain/resolver.ts` | `extensions/.../shared/probe-classifiers.ts` | `narrowUnsupportedKinds` no longer reaches a workflows arm | ✓ WIRED | Confirmed via the turned classifier test (`WINV-03: a stray workflows kind ... falls through to unsupported component`, pass) |
| `extensions/.../shared/notify.ts` | `extensions/.../shared/notify-reasons.ts` | `_ReasonsCoverageProof` compile-time completeness proof | ✓ WIRED | `npm run typecheck` 0 errors — proof still resolves to `never` on both `Exclude` arms |
| `tests/integration/workflow-kind-inversion.test.ts` | `extensions/.../orchestrators/plugin/install.ts` | real `installPlugin` call, no partial flag | ✓ WIRED | Test passes; asserted rendered bytes match a clean install |
| `tests/integration/workflow-kind-inversion.test.ts` | `extensions/.../domain/resolver.ts` | install succeeds only because resolver returns `installable` | ✓ WIRED | Non-vacuity precondition (`compatibility.supported.includes("workflows")`) asserted and passing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Resolver treats workflow-bearing plugin as installable | `node --test --test-name-pattern="WINV" tests/domain/resolver.test.ts` | 4/4 pass | ✓ PASS |
| Full resolver suite unaffected | `node --test tests/domain/resolver.test.ts` | 159/159 pass | ✓ PASS |
| Real install produces clean row, no artifact | `node --test tests/integration/workflow-kind-inversion.test.ts` | 1/1 pass | ✓ PASS |
| Six locking gates green post-inversion | `node --test` over each of the six files/patterns | 379/379 pass (combined run) | ✓ PASS |
| Whole-tree typecheck | `npm run typecheck` | exit 0, no `error TS` lines | ✓ PASS |
| Whole-tree unit suite | `npm test` | 5197/5197 pass | ✓ PASS |
| Whole-tree integration suite | `npm run test:integration` | 32/32 pass | ✓ PASS |
| ESLint | `npm run lint` | exit 0 | ✓ PASS |
| Fallow (3 sub-gates) | `npm run fallow` | exit 0 (dupe report is pre-existing debt, not phase-109-introduced) | ✓ PASS |
| Prettier | `npm run format:check` | clean | ✓ PASS |
| Corresponding-test gates | `npm run test:corresponding[:negative]` | pass | ✓ PASS |
| Direct-coverage negative gate | `npm run test:coverage:direct:negative` | pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WINV-01 | 109-01, 02, 03, 04 | Kind moves across closed sets; convention probe unchanged | ✓ SATISFIED | Direct resolver.ts read; hooks-foundation + resolver.test.ts WINV-01 tests pass |
| WINV-02 | 109-01, 02, 05 | Plugin resolves `installable` and installs without `--partial`; envelope materialization explicitly out of scope (struck, owned by WLIF-01/Phase 112) | ✓ SATISFIED | Integration test asserts both halves; REQUIREMENTS.md text confirms the envelope clause was deliberately struck from this requirement's scope |
| WINV-03 | 109-01, 02, 04 | `{workflows}` reason retired, closed-set counts move together | ✓ SATISFIED | All 4 declaration sites clean; both length pins at 43; classifier fall-through test passes |
| WINV-04 | 109-01, 04 | Locking tests turned via red-then-green, not deleted | ✓ SATISFIED | `109-01-SUMMARY.md` captures the 6 REDs against unmodified production; `109-02/04-SUMMARY.md` pair each with a GREEN; re-run confirms |
| WINV-05 | 109-01, 05 | `docs/output-catalog.md` and any degrading `docs/` prose corrected | ✓ SATISFIED | Human-read prose confirmed post-inversion; zero stale count narratives or reason braces |

No orphaned requirements: `REQUIREMENTS.md`'s traceability table maps WINV-01..05 to Phase 109 exclusively, matching the five requirement IDs declared across all five PLAN.md frontmatters.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers introduced by this phase's files. No planning-reference tokens (`Phase N`, `Plan N`, `Wave N`, `Pitfall N`) found in any comment or test title added by this phase (spot-checked via the plans' own acceptance criteria, which explicitly gate on this, and independently `grep`-confirmed absent in the reviewed files). Two Info-tier findings from the code review (IN-01, IN-02, IN-03, IN-04, IN-05, IN-06, IN-07) remain open by design — explicitly out of the review's `fix_scope` and re-confirmed as non-blocking in iteration 2; none describes a stub, a defect in the delivered behavior, or a must-have gap.

### Human Verification Required

None. All must-haves resolved to VERIFIED via direct codebase inspection and live test/gate execution; no item required subjective judgment beyond the WINV-05 prose read, which was performed directly in this verification (not merely inherited from the SUMMARY) and confirmed clean.

### Gaps Summary

No gaps. All 12 derived truths (roadmap Success Criteria plus the union of PLAN frontmatter
`must_haves.truths` across all five plans) verified directly against the current codebase state at
`features/workflow` HEAD (`304f4dfe`), not merely inferred from SUMMARY.md narrative. The two-iteration
code review's Critical finding (CR-01: the Phase 111 version-bump obligation lacked a durable carrier)
and its accompanying Warnings (WR-01/WR-02 in iteration 2, covering an over-broad doc citation and a
missing premise-lineage citation) were confirmed fixed in commit `b4ecb9a2`, which lands after the
review's recorded head (`b4bb4f42`) and is verified present in `ROADMAP.md` §Phase 111 (items 7-8),
`docs/output-catalog.md:444`, and `tests/domain/resolver.test.ts:1804-1808`. The remaining seven
Info-tier findings are explicitly out of the configured fix scope and describe no must-have gap.

The phase deliberately leaves an accepted, pinned, and now-durably-carried-forward window open
(D-109-06: a workflow-bearing plugin resolves `installable` and installs cleanly, but materializes
zero workflow artifacts until Phase 111's bridge lands). This is a documented design decision, not a
gap — it is asserted by a passing test (`tests/integration/workflow-kind-inversion.test.ts`) rather
than left as a silent absence, and its two inversion obligations (assert-flip, version bump) are now
Phase 111 Success Criteria items 7 and 8.

---

_Verified: 2026-09-04_
_Verifier: Claude (gsd-verifier)_
