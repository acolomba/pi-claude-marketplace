---
phase: 109-kind-inversion
plan: 05
subsystem: testing
tags: [node-test, integration, resolver, install-orchestrator, hermetic-home, output-catalog]

requires:
  - phase: 109-01
    provides: the turned locking gates and the turned `docs/output-catalog.md` prose and byte blocks
  - phase: 109-02
    provides: the production inversion — `workflows` in both supported tuples, `componentPaths.workflows`, the retired reason
  - phase: 109-03
    provides: the compile-forced `componentPaths` widening across the test tree
  - phase: 109-04
    provides: the compiler-invisible payload widening, the three turned catalog fixtures, the turned classifier test
provides:
  - an install-level proof that a workflow-bearing plugin installs with no partial flag and renders the clean installed row
  - a pinned assertion that the host engine's storage root is not written during the 109-111 window
  - a confirmed WINV-05 documentation sweep — `docs/output-catalog.md` carries no prose claiming a workflow-bearing plugin degrades
  - the full `npm run check` gate chain green against the inverted tree
affects: [110-domain-and-platform-modules, 111-workflows-bridge, 112-install-and-removal-lifecycle, 114-degradation-and-documentation]

actuals:
  tokens: 1500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Install-level window pinning: assert both what a partial delivery DOES render and what it does NOT materialize, so the gap is a fact under test rather than an undocumented state"

key-files:
  created:
    - tests/integration/workflow-kind-inversion.test.ts
  modified: []

key-decisions:
  - "The documentation sweep was a confirmed no-op: 109-01 had already turned every one of the 17 mentions, so this plan changed no byte under docs/ and recorded the confirmation instead"
  - "The released `[0.18.1]` CHANGELOG entry is left intact deliberately — it records what that version shipped; the inversion belongs in the next version's entry"
  - "The window assertion composes `<HOME>/.pi/workflows` with `path.join` rather than adding a locations getter, because that getter is Phase 110's deliverable and adding it here would be an unused export and a boundary widening"

patterns-established:
  - "Non-vacuity probe for a negative assertion: before trusting a green 'no artifact exists' test, drive the resolver against the same fixture shape and confirm the kind actually resolves supported — otherwise the test passes for a plugin that has no workflows at all"

requirements-completed: [WINV-02, WINV-05]

coverage:
  - id: D1
    description: "A real install of a workflow-bearing plugin succeeds with no partial flag and renders the clean installed row, with no partially-available token, no partial-flag hint and no reason brace"
    requirement: WINV-02
    verification:
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#WINV-02 / D-109-06: a workflow-bearing plugin installs with no partial flag and writes no workflow artifact"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same install writes no workflow artifact — the host engine's storage root under the hermetic home does not exist afterwards, pinning the D-109-06 window as a fact"
    requirement: WINV-02
    verification:
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#WINV-02 / D-109-06: a workflow-bearing plugin installs with no partial flag and writes no workflow artifact"
        status: pass
    human_judgment: false
  - id: D3
    description: "No prose under docs/ states that a workflow-bearing plugin degrades — the byte gates report zero surviving reason braces and zero surviving count narratives"
    requirement: WINV-05
    verification:
      - kind: automated_ui
        ref: "grep -o '{workflows}' docs/output-catalog.md | wc -l -> 0; grep -oE '44-member|44-entry' docs/output-catalog.md | wc -l -> 0"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts (run after pre-commit run --all-files)"
        status: pass
    human_judgment: true
    rationale: "The byte gates pin the fenced blocks and the vocabulary guard scans for retired force/unsupported vocabulary; neither reads the surrounding paragraphs. A human read of every surviving mention is the only thing that attests the prose states the post-inversion meaning."
  - id: D4
    description: "The observation sequence behind Success Criterion 4 — one red-then-green pair per locking gate, with the byte gate's red captured while production was still untouched"
    verification: []
    human_judgment: true
    rationale: "The criterion is about the order in which gates were observed failing, not about the end state. A suite green at the end of the phase is exactly what the criterion says is insufficient, so no run can attest to it — only a read of the captured reds in 109-01-SUMMARY.md against the greens in 109-02/04."

duration: 15 min
completed: 2026-09-05
status: complete
---

# Phase 109 Plan 05: Install-level window pin and phase gate Summary

**A real `installPlugin` against a seeded workflow-bearing path-source plugin proves both halves of the 109-111 window — the plain install renders `● (installed)` with no `--partial` and no brace, and `<HOME>/.pi/workflows` does not exist afterwards — closing Phase 109 with the whole `npm run check` chain green.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-05T00:04:00Z
- **Completed:** 2026-09-05T00:19:00Z
- **Tasks:** 2
- **Files modified:** 1 created, 0 modified

## Accomplishments

- **The window is pinned at install level, both halves.** `tests/integration/workflow-kind-inversion.test.ts` drives a real `installPlugin` for project scope against a seeded marketplace whose plugin carries `skills/tool/SKILL.md` and `workflows/greet.js`, with no partial option anywhere in the call. The joined notification bytes contain `(installed)` and contain none of `(failed)`, `(partially-available)`, `--partial` or `{workflows}`. The same test then asserts `stat(<HOME>/.pi/workflows)` REJECTS with `ENOENT`.
- **The fixture was proved non-vacuous before the green was trusted.** A scratch probe drove `resolveStrict` against the identical fixture shape and returned `state: "installable"`, `supported: ["skills", "workflows"]`, `componentPaths.workflows: ["workflows"]`. Without that check the `ENOENT` assertion would pass just as happily for a plugin with no `workflows/` directory at all.
- **The WINV-05 sweep is confirmed as a no-op, not skipped.** All 17 mentions 109-RESEARCH enumerated were already turned by 109-01. Every surviving mention in `docs/output-catalog.md` was re-read and states the post-inversion meaning. This plan changed no byte under `docs/`.
- **The phase gate is green end to end.** Typecheck 0 errors, all three fallow sub-gates, Prettier, both corresponding-test gates, the direct-coverage negative gate, the unit suite at **5195 pass / 0 fail**, the integration suite at **32 pass / 0 fail** (31 before), and ESLint exit 0. `pre-commit run --all-files` passes with no file left modified.

## Task Commits

1. **Task 1: Write the install-level window test** — `e5ae373f` (test)
2. **Task 2: Confirm the documentation sweep and take the phase through the full gate** — no commit; the sweep was a confirmed no-op and the task produced no byte change

**Plan metadata:** see the `docs(109-05)` commit that carries this SUMMARY.

## Files Created/Modified

- `tests/integration/workflow-kind-inversion.test.ts` (created, 165 lines) — declares `makeCtx`, `withHermeticHome` and `seedWorkflowPlugin` locally (`tests/helpers/` does not exist on this branch), then one `test(...)` inside the hermetic-home block asserting both halves of the window.

## Decisions Made

- **`stat` was added to the `node:fs/promises` import.** The analog `tests/integration/transaction-lifecycle-cascade.test.ts` imports `{ mkdir, mkdtemp, readFile, rm, writeFile }` with no `stat`; the window assertion needs it. `readFile` was dropped as unused — `noUnusedLocals` and `@typescript-eslint/no-unused-vars` both make an unused import an error. `reinstallPlugin`, `updatePlugins`, `uninstallPlugin`, the hooks `resetRoutingState` reset and the analog's `fileExists` helper were all left out for the same reason.
- **The storage root is composed by hand, not read from a getter.** `path.join(process.env.HOME ?? "", ".pi", "workflows")` matches what `os.homedir()` resolves under the hermetic HOME override. `locations.workflowsSavedDir` is Phase 110's deliverable; adding it here would be an unused export that `fallow dead-code` would flag, and a boundary widening this phase does not need.
- **One `test(...)` per hermetic-home block.** `withHermeticHome` mutates `process.env.HOME` process-wide, so a second concurrent test in the same file reading `HOME` outside its own block could see the other's temp root. The analog's single-test structure is followed exactly, and the full integration suite run confirms no sibling test saw a leaked HOME.

## The D-109-06 window

Between this phase and Phase 111 a workflow-bearing plugin resolves `installable`, renders a clean
installed row, and materializes zero workflow commands, which is less honest than the pre-inversion
behavior. **Cut no release from this branch before Phase 111 lands.** The window has no external
surface: this is a feature branch, CI carries no push trigger for it, and the milestone runs end to
end in one session.

**The A-03 corollary.** Do not bump the manifest version, the Sonar project version or the extension
version constant inside the window, because the load-time backfill scan is gated on the recorded
extension version matching the current one and a bump would fire a convergence with no bridge behind
it. All three still read `0.18.1`, and `git diff --stat` over `package.json`,
`sonar-project.properties` and `extensions/pi-claude-marketplace/shared/extension-version.ts` is
empty for this phase.

## The Phase 111 carry-forward

**The no-artifact half of `tests/integration/workflow-kind-inversion.test.ts` MUST be inverted when
the bridge lands.** Add it to Phase 111's CONTEXT. An assertion that quietly stays green while
meaning the opposite is worse than no assertion.

Concretely: the `assert.rejects(stat(...), { code: "ENOENT" })` call is one line with an obvious
home, and Phase 111 replaces it with an assertion that the envelopes ARE written under
`<HOME>/.pi/workflows/projects/<key>/saved/`. The `--partial`-free success half above it survives
Phase 111 unchanged. This is also recorded in `109-CONTEXT.md` §Deferred Ideas; the SUMMARY is the
second, more findable home for it.

## The released CHANGELOG entry

`CHANGELOG.md` was left untouched deliberately. Its two workflow bullets sit under the released
`## [0.18.1] - 2026-08-29` heading, and `package.json` version and `EXTENSION_VERSION` both read
`0.18.1`, so the entry is a record of what that version shipped rather than live prose. The
inversion belongs in the NEXT version's entry, which is release work the workstream STATE already
carries. `CHANGELOG.md` is not under `docs/`, so WINV-05 does not reach it. `git diff --stat
CHANGELOG.md` is empty — a later reader should not read the untouched entry as an oversight.

## The Sonar duplication risk (assumption A3)

The turned `workflow-install-success` fixture is byte-identical to the existing `success` state's
fixture. `fallow dupes` does not flag it — measured at the same duplicated-line count before and
after — but SonarCloud uses a different duplication engine, is not part of `npm run check`, and
`tests/architecture/catalog-uat.test.ts` is not among the seven files already listed in the Sonar
duplication exclusions. If a Sonar PR quality gate later reports it, **the fix is an exclusion entry
with a justification, never a distinguishing token added to the fixture to make the two differ.**

## Human-check answers

**1. Success Criterion 4 — the observation sequence: CONFIRMED.** The
`Red-then-green pairs (Success Criterion 4)` table in `109-04-SUMMARY.md` carries six rows, one per
locking gate: `catalog-uat` (the byte gate), `compat-01-no-expansion` (the ordered reason
enumeration), `notify-closed-set-locks` and `notify.test.ts` (the two independent length pins),
`hooks-foundation` (the supported-kind tuple pin plus the negative mirror), and `resolver.test.ts`
(the two `WINV-01` owner tests). Each row cites a captured RED from `109-01-SUMMARY.md`
§*Red observations* and a matching GREEN run. The byte gate's red — `ℹ tests 6 / pass 5 / fail 1`,
`catalog UAT failures (3)`, a byte mismatch on all three turned states — was observed with the
documentation half turned and production still untouched, which the table itself calls out as the
one gate whose red is unobtainable in any other order. The classifier owner test is correctly
excluded as a row: it has no red half by design.

**2. WINV-05 — the prose read: CONFIRMED.** `grep -n -i workflow docs/output-catalog.md` returns
nine hits across three state blocks (lines 431-442, 565-576, 618-630), and each states the
post-inversion meaning:

- `workflow-available-inventory` — "renders as an ordinary not-installed inventory row: the `○`
  glyph, the `(available)` status, and no reason brace".
- `workflow-install-success` — "A plain install -- no flag opt-in -- materializes the supported
  components of a workflow-bearing plugin and renders the clean `(installed)` row with no reason
  brace."
- `workflow-plus-unsupported-rejection` — "The rejection is driven by that second kind, and the
  brace names it alone -- which is what shows the workflow kind contributes no token of its own."

The five prose lines 109-01 corrected are clean: line 63 reads `43-member` with the workflows
carve-out gone, line 65's sentence is deleted, line 147's `(partially-available)` row lists only
"LSP / hooks / unsupported component", and lines 1947/1949 name neither workflows nor `{workflows}`.
Both byte gates print `0`.

**Also confirmed:** no release was cut from this branch, and no version number was bumped in the
manifest, the Sonar properties or the extension version constant. Both stay open as D-109-06 and
A-03 obligations until Phase 111 lands.

## Deviations from Plan

None - plan executed exactly as written.

Task 2 produced no byte change. That is the outcome the plan named as expected ("If nothing needs
correcting, change no byte and say so in the SUMMARY — a no-op is the expected outcome and is not a
skipped step"), so it is recorded here rather than as a deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 109 is complete.** The inversion is live in production code, the whole test tree agrees with
it, the published contract states the post-inversion meaning, and both halves of the intermediate
window are pinned by an assertion rather than accepted silently.

Ready for Phase 110 (domain and platform modules), which adds `platform/workflow-home.ts` and the
`locations` getters this plan deliberately did not add. Phase 111 (the workflows bridge) carries the
inversion obligation above.

Carried forward unchanged from the workstream STATE: Phase 101 was never code-reviewed; the
`workflows` milestone release work is still open; the bare planning-artifact token at
`tests/orchestrators/reconcile/backfill.test.ts:320` is Phase 116's to clean; the five
`VALIDATION.md` files for Phases 101-105 are still `status: draft`; and the `README.es.md`
Spanish-wording question belongs to Phase 114, not here — that bullet does not exist on this branch.

---
*Phase: 109-kind-inversion*
*Completed: 2026-09-05*

## Self-Check: PASSED

- `tests/integration/workflow-kind-inversion.test.ts` exists on disk and is tracked.
- `.planning/workstreams/workflows/phases/109-kind-inversion/109-05-SUMMARY.md` exists on disk.
- Task commit `e5ae373f` is present in `git log`.
- Every task `<acceptance_criteria>` re-run and passing; the plan-level `<verification>` chain re-run green (unit 5195/0, integration 32/0, ESLint exit 0, `pre-commit run --all-files` clean).
