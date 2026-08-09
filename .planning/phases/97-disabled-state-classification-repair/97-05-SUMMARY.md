---
phase: 97-disabled-state-classification-repair
plan: 05
subsystem: update
tags: [typescript, derived-state, short-circuit, idempotency, mutation-check, vocabulary-guard]

requires:
  - phase: 97-disabled-state-classification-repair
    plan: 01
    provides: "`isRecordedButDisabled` keyed only on `enabled` — the collapse that routes a disabled partial into the update short-circuit at all"
provides:
  - "the ENBL-09 derived availability discriminant in `refreshDisabledRecord` — the refreshed compatibility block can no longer persist full availability beside a non-empty unsupported list"
  - "the degraded/promotion counter-case pair that proves the value is derived rather than pinned to either constant"
  - "the on-disk no-stage pin for `update --partial` over a disabled partial, asserted by skill absence rather than by record state alone"
  - "the two-call idempotency fixed point over the refreshed record, compared field-wise excluding `updatedAt`"
  - "the corrected D-UPD short-circuit comment — the retired two-axis marker description is gone, anchored on ENBL-05/ENBL-09"
affects: [98, update, autoupdate]

actuals:
  tokens: 3490
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Derive-don't-hard-code for persisted discriminants: any record field copied beside a resolution-derived list must itself be read off the same resolution, or the two fields can disagree"
    - "Counter-case pairing as derivation proof: a single degraded assertion is satisfied by a hard-coded `false`; the promotion case on the same fixture is what excludes both constants"
    - "On-disk absence assertion for no-op paths: a short-circuit that must not re-stage is pinned by the artifact's absence in the target directory, not by the record's empty resource arrays"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "The derive landed in `refreshDisabledRecord` rather than in `runThreePhaseUpdate`. The small function has no complexity suppression of its own, so the edit does not push an already-suppressed function further past the sonarjs threshold; suppression count in `update.ts` is unchanged at 6."
  - "The record factory gained a separate `makeDisabledPartialPluginRecord` variant rather than an optional axis on `makeDisabledPluginRecord`. The disabled-partial shape differs in three correlated compatibility fields at once (`installable`, `supported`, `unsupported`), so an axis parameter would have had to encode the correlation; the existing factory's single call site is untouched."
  - "Every test in the plan passes `partial: true`. Without it `resolveUpdateCandidate` runs the strict `requireInstallable` gate, the degraded candidate throws, and the throw becomes a skipped outcome BEFORE the short-circuit — so a test without the flag asserts nothing about the short-circuit. The requirement is recorded in the section banner and in the short-circuit test's own title."
  - "The idempotency comparison is field-wise over a projected object, not a whole-record deep-equal. `updatedAt` is a wall-clock stamp the refresh rewrites on every call, so a whole-record equality would be flaky by construction."
  - "The comment fix chose the allowlisted `\\`unsupported\\` array` wording over deleting the backticks. The referent genuinely is the component-kind array (`compatibility.unsupported`), which is the out-of-scope homonym the D-75-01 guard explicitly preserves — so the guard-clean form is also the more accurate prose."

patterns-established:
  - "A persisted discriminant and the list it summarizes are one unit: assert both in the same test, in both directions, or a future edit can re-pin either to a constant without a red test."

requirements-completed: [ENBL-09]

coverage:
  - id: D1
    description: "`refreshDisabledRecord` derives the persisted availability discriminant from the resolution — a disabled partial's refreshed record keeps a false discriminant beside its non-empty unsupported list"
    requirement: ENBL-09
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#ENBL-09: the disabled-record refresh derives compatibility.installable from the resolution -- degraded stays degraded"
        status: pass
      - kind: other
        ref: "Mutation check: reverting the derive to the literal `installable: true` turned exactly this test red (77 tests, 76 pass, 1 fail); the source file was restored via `git checkout --` and `git status --porcelain` confirmed clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "The derive is a derive, not the opposite constant: a candidate resolving fully supported promotes the refreshed record's discriminant to true with an empty unsupported list, and never enables it"
    requirement: ENBL-09
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#ENBL-09 counter-case: a candidate that resolves fully supported promotes the refreshed record's availability"
        status: pass
    human_judgment: false
  - id: D3
    description: "`update --partial` over a disabled partial renders the existing unchanged byte form, refreshes the version pin and resolved source, and stages nothing on disk"
    requirement: ENBL-09
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#ENBL-09: update --partial on a disabled PARTIAL refreshes the pin and stages nothing (--partial is required to reach the short-circuit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The refresh is a fixed point: two identical calls leave version, resolved source, availability discriminant, unsupported list, enabled flag and all five resource arrays identical"
    requirement: ENBL-09
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#ENBL-09: update --partial on a disabled PARTIAL is idempotent -- two identical calls leave the record unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "No comment in update.ts still describes the disabled marker as empty resources plus full availability"
    verification:
      - kind: other
        ref: "The D-UPD short-circuit comment now names the explicit `enabled` boolean read through `isRecordedButDisabled` and cites ENBL-05/ENBL-09; availability is stated as an orthogonal axis"
        status: pass
    human_judgment: false
  - id: D6
    description: "The edit adds no complexity debt and keeps the retired-vocabulary guard green"
    verification:
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts — exit 0 after the comment reword (be4da56d)"
        status: pass
      - kind: other
        ref: "`grep -c cognitive-complexity` over update.ts returns 6 at 5c412456^ and 6 at HEAD — no new suppression"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 97 Plan 05: Update short-circuit for a disabled partial Summary

**`refreshDisabledRecord` now reads its persisted availability discriminant off the resolution instead of hard-coding `installable: true`, so the short-circuit a disabled partial reaches can no longer write a record whose availability contradicts its own unsupported list — pinned in both directions plus an on-disk no-stage assertion and a two-call fixed point.**

## Close-out note

**This plan's production work landed as concurrent commits outside the paused session's dispatch.** `c15ad05a` (test) and `5c412456` (fix) were authored directly on `features/manifest-independent-plugin-info` while the session was paused at the 97-05 hand-off, so no SUMMARY existed and the plan's own gates had never been run end to end.

This SUMMARY is a continuation close-out: every acceptance criterion in `97-05-PLAN.md` was verified post-hoc against the committed code rather than observed during authoring. That verification found one real gap — recorded under Deviations — which is now fixed and committed as `be4da56d`. The criterion-by-criterion result:

| Criterion (Task 1) | Result |
|---|---|
| Compatibility block reads the resolution's state discriminant; no literal boolean assigned to the availability field inside `refreshDisabledRecord` | pass — `installable: installable.state === "installable"`; the only other `installable` tokens in the function body are the destructured resolution and its `pluginRoot`/`notes`/`supported`/`unsupported` reads |
| Degraded case asserts false discriminant AND non-empty unsupported; promotion asserts true AND empty; both assert `enabled === false` and five empty `resources.*` arrays | pass — both tests present, both assert all four facts via the shared `assertResourcesEmpty` helper |
| Both tests pass the partial flag | pass — `partial: true` present in every one of the four new `updatePlugins` invocations |
| D-UPD short-circuit comment corrected: explicit disabled boolean through the single predicate, cites ENBL-05 and ENBL-09, no two-axis marker | pass |
| Partial-disabled factory variant exists beside `makeDisabledPluginRecord`; existing call sites unchanged | pass — `makeDisabledPartialPluginRecord` at :155 spreads the existing factory; the one pre-existing call site is byte-identical, only shifted by the insertion |
| No new `sonarjs/cognitive-complexity` suppression in `update.ts` | pass — 6 at `5c412456^`, 6 at HEAD |
| **Mutation check:** the degraded case fails when the derive is reverted | **pass** — see below |
| `node --test tests/orchestrators/plugin/update.test.ts` exits 0 including the untouched canonical D-UPD test | pass — 77/77; the canonical test survives at :2853 |

| Criterion (Task 2) | Result |
|---|---|
| Short-circuit test asserts exactly one notification matching the existing unchanged byte form | pass — `notifications.length === 1` and an exact string equality against `"● mp [project]\n  ⊘ hello (skipped) {up-to-date}"` |
| …and asserts the generated skill name is absent from the skills target directory | pass — `pathExists(locations.skillsTargetDir/hello-tool) === false` |
| Idempotency test runs the identical call twice and deep-equals the two records on version, resolved source, availability discriminant, unsupported list, enabled flag and all five resource arrays, excluding `updatedAt` | pass — the `settledFields` projection names exactly those fields and omits `updatedAt` |
| Both tests pass the partial flag; the short-circuit test's title records why | pass |
| All four planned test titles exist | pass — all four match `<artifacts_produced>` verbatim |
| `node --test tests/orchestrators/plugin/update.test.ts` exits 0 | pass |

**Mutation check (the criterion the plan required and the concurrent author had no recorded result for).** `installable: installable.state === "installable"` was temporarily reverted to the literal `installable: true` — edit only, never committed. The suite went from 77/77 to 76 pass / 1 fail, and the single red test was:

`ENBL-09: the disabled-record refresh derives compatibility.installable from the resolution -- degraded stays degraded`

Exactly the intended test, and only that test. The file was restored with `git checkout --` and `git status --porcelain` confirmed empty before proceeding.

## Performance

- **Duration:** ~25 min (close-out verification, one fix, gate, documentation)
- **Tasks:** 2 (both pre-landed; verified post-hoc)
- **Files modified:** 2 (1 source, 1 test)
- **Diff:** +271 / -7 across the three commits

## Accomplishments

- **The self-contradictory record is gone.** `refreshDisabledRecord` copied `notes`, `supported` and `unsupported` from the resolution but hard-coded `installable: true` beside them. For a disabled partial — the record shape ENBL-05 made reachable here — that wrote full availability next to a non-empty unsupported list. Every downstream classifier reads one of those two fields, so the same record rendered as disabled on one surface and partially-installed on another. The block now reads `installable.state === "installable"`, mirroring reinstall's record write.
- **The counter-case is what makes the fix provable.** A degraded-only assertion is satisfied by hard-coding `false` — the opposite bug. The promotion case runs the same fixture minus the unsupported marker and asserts the discriminant flips to `true` with an empty list, so the pair excludes both constants. It also asserts `enabled` stays `false`: promoting the availability axis must never touch the intent axis.
- **The no-stage claim is asserted on disk, not in state.** The defect the short-circuit guards against is re-staging artifacts for a plugin the user disabled. Empty `resources.*` arrays would still hold if the ledger had written files and failed to record them, so the test asserts the generated `hello-tool` skill is absent from the skills target directory — the claim in the terms the user would notice.
- **The fixed point is pinned field-wise.** Two identical `update --partial` calls produce one identical notification each and a record equal on the six fields the operation owns. `updatedAt` is excluded deliberately: the refresh rewrites it every call, so including it would make the assertion fail for a reason that has nothing to do with idempotency.
- **The falsified short-circuit comment is corrected.** It described the disabled marker as empty resources plus full availability — the two-axis marker ENBL-05 retired. It now names the explicit `enabled` boolean read through `isRecordedButDisabled`, states that availability is an orthogonal axis, and keeps the original rationale (a disabled record must not re-materialize; `enable` is the re-materialization surface; the pin is refreshed so a later enable reads current values).

## Task Commits

1. **Task 1 (TDD RED) + Task 2: the factory variant and all four ENBL-09 tests** — `c15ad05a` (test)
2. **Task 1 (TDD GREEN): the derived discriminant plus the short-circuit comment correction** — `5c412456` (fix)
3. **Close-out fix: the comment reword off the retired verdict token** — `be4da56d` (fix)

The two pre-landed commits combine both tasks' test surface into one test commit rather than splitting per task; the RED/GREEN ordering across `c15ad05a` → `5c412456` is intact.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the derived availability discriminant with its ENBL-09 invariant comment, and the rewritten D-UPD short-circuit comment
- `tests/orchestrators/plugin/update.test.ts` — the `makeDisabledPartialPluginRecord` variant, the `assertResourcesEmpty` helper, the section banner recording why every test passes the partial flag, and the four ENBL-09 tests

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The ENBL-09 comment tripped the D-75-01 retired-vocabulary guard**

- **Found during:** close-out gate (the plan's own task-level `<verify>` never ran it)
- **Issue:** The comment added by `5c412456` read ``...next to a non-empty `unsupported` is a record whose two fields contradict each other``. `tests/architecture/partial-vocabulary-guard.test.ts` forbids the standalone backtick token `` `unsupported` `` anywhere under the guarded sources — it is the retired resolver verdict, renamed to `partially-available` — allowing it only when immediately followed by `array` or `kind`, the two out-of-scope component homonyms. The full suite failed 1/3323 on `D-75-01 guard: standalone backtick verdict \`unsupported\` absent (allowlist: array/kind homonyms)`, naming `update.ts`.
- **Why the plan's gates missed it:** Task 1's `<verify>` is `node --test tests/orchestrators/plugin/update.test.ts && npm run typecheck && npm run lint`, and the plan's `<verification>` block names only `update.test.ts` and `no-orchestrator-network.test.ts`. The vocabulary guard is a separate architecture test reached only by the full suite, which the plan's task-level gates never invoke.
- **Fix:** Reworded to ``a non-empty `unsupported` array``. The referent here genuinely is `compatibility.unsupported`, the component-kind array — precisely the homonym the guard allowlists — so the guard-clean form is also the more accurate prose. One line, no behavior change.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- **Verification:** `node --test tests/architecture/partial-vocabulary-guard.test.ts tests/orchestrators/plugin/update.test.ts` — 129/129, exit 0; full gate re-run exit 0
- **Committed in:** `be4da56d`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope change. The fix is a three-word comment reword; the plan's source and test behavior are exactly as the two pre-landed commits left them.

## Issues Encountered

The `pre-commit` trufflehog hook fails structurally in a linked worktree (the git-mode scan cannot read `.git/index`, which is a file here, not a directory). Per CLAUDE.md each commit was preceded by a filesystem-mode scan over the changed paths — clean, `verified_secrets: 0` and `unverified_secrets: 0` — and committed with `SKIP=trufflehog`. Every other hook ran and passed (prettier, npm lint, npm format check, npm typecheck). No other hook was skipped and no commit was amended.

## Verification

- `node --test tests/orchestrators/plugin/update.test.ts` — exit 0, 77/77, including the untouched canonical D-UPD disabled-record test
- Mutation confirmation: the literal `installable: true` revert produced 76 pass / 1 fail, red on the degraded-case test alone; restored and confirmed clean
- `node --test tests/architecture/partial-vocabulary-guard.test.ts tests/orchestrators/plugin/update.test.ts` — exit 0, 129/129
- `PI_SUBAGENTS_ROOT=… npm run check` — **exit 0**; 3323 unit tests (3322 pass, 0 fail) plus 18 integration tests. Exit code captured directly, not through a pipe.
- `grep -c cognitive-complexity` over `update.ts` — 6 at `5c412456^`, 6 at HEAD
- `grep -P '\`unsupported\`(?! (array|kind))'` over `update.ts` — no hit

## Requirement Accounting

**ENBL-09 — Complete.** The requirement's short-circuit half was already satisfied by the ENBL-05 collapse in `97-01`: a disabled partial reaches `isRecordedButDisabled` and returns before any staging. What was outstanding — and what this plan closes — is the short-circuit's own record write, which rewrote the compatibility block untruthfully every time it fired. Both halves are now pinned: the no-stage half by an on-disk absence assertion, the record half by the degraded/promotion pair, and the combination by the two-call fixed point.

## Known Stubs

None.

## Out-of-Scope Discoveries (not fixed)

- The plan's task-level `<verify>` blocks and its `<verification>` section do not reach `tests/architecture/partial-vocabulary-guard.test.ts`, which is why a guard-tripping comment could pass every gate the plan named. Any phase editing comments under `extensions/` carries the same blind spot. Worth a line in Phase 98's DOC-08 contract sweep: comment edits under the guarded tree need the vocabulary guard in the task-level verify, not only in the full suite.

## Next Phase Readiness

Phase 97 is functionally complete — ENBL-05 through ENBL-09 all closed, with the full suite green. The four surfaces a disabled partially-installed record touches now agree: it renders as disabled, enables through the partially-available arm, is a fixed point under load-time reconcile, and survives `update --partial` with an internally consistent record and nothing re-staged. Phase 98 inherits no production work from this plan; its carrier list gains the one prose item above.

## Self-Check: PASSED

`c15ad05a`, `5c412456` and `be4da56d` all resolve in `git log`. Both files named as modified exist on disk and appear in `git diff --stat c15ad05a^ HEAD` over the two paths.

---
*Phase: 97-disabled-state-classification-repair*
*Completed: 2026-08-09*
