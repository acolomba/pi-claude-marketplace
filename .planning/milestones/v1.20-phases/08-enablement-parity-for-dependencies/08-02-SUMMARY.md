---
phase: 08-enablement-parity-for-dependencies
plan: 02
subsystem: plugin-lifecycle
tags: [dependency-guard, disable, notification-vocabulary, closed-set]

requires:
  - phase: 08-01
    provides: "EnableRefusedError (widened here for the disable guard), the D-08-01/B1 inherited ruling on the refusal's closed-set token, and orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex reused as-is"
provides:
  - "EDEP-02: disable <plugin> is refused while an installed and ENABLED plugin in the same scope still declares it, naming the dependents and the disable order on the cause line"
  - "The dependents remain closed-set reason token (REASONS 60 -> 61), landed across all ten pinning surfaces"
  - "readEnabledDependents / composeDisableRefusalCause / renderDependentKeys -- the guard, its refusal sentence, and its untrusted-name defense"
  - "disable-refused-dependents catalog state, matched by an independent fixture"
affects: [08-03-install-cascade-dependency-enabled]

actuals:
  tokens: 16406
  tasks: 2
  commits: 5
  plan_head_before: 2452230f

tech-stack:
  added: []
  patterns:
    - "A guard that must not run on an orchestrated (reconcile-driven) call takes its own `orchestrated` flag and no-ops on it internally, so the caller gains exactly one unconditional statement rather than an inline branch -- mirrors EDEP-01's own runEnableCascadeStep skip for the identical reason (a reconcile pass has its own dependency handling and must not be refused by a guard written for the standalone command)."
    - "A test fixture that reaches a precondition a NEW guard now correctly refuses seeds that precondition directly (toDisabledRecord + the skill taken off disk, or orchestrated mode when the state write is what's needed) instead of routing through the now-refused command -- the guard's correctness is the fix, not the fixture's workaround."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/enable-disable.messaging.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/reconcile/apply.test.ts (verified green, not modified)
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/shared/notification-types.test.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-disable.ts

key-decisions:
  - "Inherited from 08-01's Task 1 ruling (recorded there verbatim, developer replied \"proceed as recommended\"): Decision B took OPTION B1 -- the disable refusal re-adds `dependents remain` to REASONS at the tail (60 -> 61), the exact token Phase 5 shipped for the uninstall refusal and D-06-07 retired when that refusal stopped happening; the refusal it named now happens on `disable` instead. Rejected alternatives: B2 (reuse `dependents unsatisfied` -- its own rationale states its subject is a removal that WENT THROUGH on a SUCCESS row, so reuse would make one grep return two different situations) and B3 (no token at all -- every other refusal row in the catalog names its fact in the brace)."
  - "EnableRefusedError (08-01's class) was widened to carry the disable guard's refusal too, rather than adding a second class -- both refusals share the same carrier shape (closed-set reason + rendered cause line, no absolute path, no chained cause) and the same catch site in setPluginEnabledWithTransaction's outer try/catch. The plan's artifacts section explicitly authorized this choice over a parallel DisableRefusedError class."
  - "readEnabledDependents skips (no-ops) for `enable=true`, for a target that is already disabled, AND for an orchestrated (reconcile-driven) call -- discovered as a real regression during full-suite verification, not anticipated by the plan or its research. A reconcile pass disables a dependency chain in dependents-before-dependencies order precisely because the dependents still declare what it is unwinding (LOAD-02); without the orchestrated exclusion the guard tripped that propagation and, because the orchestrated catch path (classifyTransactionThrow) has no EnableRefusedError narrowing of its own, misclassified the refusal as {unreadable} via narrowDisableFailure's generic default. Mirrors EDEP-01's own runEnableCascadeStep orchestrated-skip exactly."
  - "Three pre-existing test fixtures (install-flow.test.ts's disableSeededDependency, and two D-04-07 promotion fixtures in import/execute.test.ts) disabled a dependency through the real standalone verb while the plugin declaring it stayed enabled -- a state EDEP-02 now correctly refuses to produce that way. All three were rewritten to seed the disabled-record precondition directly (toDisabledRecord + skill removal, or orchestrated mode, chosen per fixture depending on whether the fixture's own assertions needed the disable verb's config write) rather than loosened or skipped."

patterns-established:
  - "Guard-skip-on-orchestrated is now a two-instance pattern in enable-disable.ts (EDEP-01's cascade, EDEP-02's dependents guard); a third dependency-aware guard added to this file should default to the same exclusion unless a reason is recorded for not doing so."

requirements-completed: [EDEP-02]

coverage:
  - id: D1
    description: "disable <plugin> is refused while an installed and ENABLED plugin in the same scope still declares it: nothing is unstaged, tx.save is never called, and the row is (failed) {dependents remain} with a cause line naming the dependent(s) and the disable order"
    requirement: EDEP-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: a disable is refused while an installed and enabled plugin still declares it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: two enabled dependents are named on the cause line, sorted"
        status: pass
    human_judgment: false
  - id: D2
    description: "A disabled declarer, an other-scope declarer, or no declarer at all leaves the disable proceeding exactly as before, byte for byte"
    requirement: EDEP-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: a DISABLED declarer does not block the disable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: a declarer in the OTHER scope does not block the disable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: nothing declares the target, disable proceeds byte-identically to disable-fresh"
        status: pass
    human_judgment: false
  - id: D3
    description: "A record whose declarations cannot be established fail-closes the disable with {unreadable} and the declarer on the cause line, exactly as the uninstall guard did; an orchestrated (reconcile-driven) disable skips the guard entirely"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: an unreadable declarer refuses the disable with no absolute path leaked"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-02: an orchestrated disable skips the dependents guard entirely"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-02: one pass propagates a broken dependency the full depth of a chain"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every dependent key reaches the cause sentence only through the renderable-key gate (T-08-06); an unrenderable name collapses the list to a count instead of forging the sentence"
    requirement: EDEP-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.messaging.test.ts#composeDisableRefusalCause > T-08-06: counts the dependents when one key could close the sentence's quote"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.messaging.test.ts#composeDisableRefusalCause > T-08-06: counts a single unrenderable dependent in the singular"
        status: pass
    human_judgment: false
  - id: D5
    description: "dependents remain lands across all ten closed-set pinning surfaces (REASONS 60 -> 61) and the refused disable is a documented catalog state matched by an independently hand-written fixture"
    requirement: EDEP-02
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 61-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the reason vocabulary holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 220 exact documented states"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-parser.test.ts#loadCatalogExamples parses all 220 independent catalog tuples"
        status: pass
    human_judgment: false

duration: 180min
completed: 2026-09-21
status: complete
---

# Phase 8 Plan 2: Disable's dependents guard -- refuse a disable while an enabled dependent still declares it Summary

**`disable <plugin>` is now refused, with nothing written, while an installed and enabled plugin in the same scope still declares it -- carrying the re-added `{dependents remain}` closed-set token (REASONS 60 -> 61) and a plain-English cause line naming the dependents and the disable order, with a matching new catalog state.**

## Performance

- **Duration:** 180 min
- **Started:** 2026-09-21 (continuation of Phase 8's wave 2)
- **Completed:** 2026-09-21T15:23:23Z
- **Tasks:** 2 (Task 1: the guard; Task 2: the catalog state)
- **Files modified:** 16 (across 5 commits)

## Accomplishments

- `readEnabledDependents` guards the disable branch inside `enable-disable.ts`'s locked transaction closure: `buildScopeDeclarationIndex({ state, locations, exclude: key })` + `findDependents`, the exact composition `uninstall.ts::readDeclarers` uses, narrowed to declarers whose own record is not `isRecordedButDisabled` (D-05-04 -- a disabled declarer holds its declaration but is not active, so it does not block). Fail-closed on an unreadable declarer (D-05-07). Placed so it runs before the idempotency short-circuit and before `dispatchBranch`/`runDisableBranch`, and no-ops for `enable`, for an already-disabled target, and for an orchestrated call.
- `EnableRefusedError` (08-01's class) was widened rather than paired with a second class, per the plan's own authorization: both the enable cascade's refusal and the disable guard's refusal share the same carrier and the same outer catch.
- `composeDisableRefusalCause` / `renderDependentKeys` in `enable-disable.messaging.ts` compose the plain-English refusal sentence D-08-01 locked in (`Disable A, B first, then X.`), routing every dependent key through `isRenderablePluginKey` before it reaches the cause line (T-08-06) -- an adversarial name collapses to a count instead of forging the sentence.
- `"dependents remain"` re-added to the closed reason set at the tail (REASONS 60 -> 61), landed in one commit across all ten pinning surfaces the plan named: `notification-types.ts`, `notify-reasons.ts` (+ its header narrative, corrected from a pre-existing stale "59-entry" mention in the same paragraph), `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `notification-types.test.ts`, `docs/output-catalog.md`'s reasons paragraph, and the producer (`composeDisableRefusalCause`).
- `docs/output-catalog.md` documents `disable-refused-dependents` as a new catalog state, its bytes produced by running the real dispatcher over the composer's output through the same `makeCtx` boundary the contract test uses; `plugin-disable.ts`'s matching fixture entry is hand-written independently from the documented contract. Every catalog count swept: `EXPECTED_STATE_COUNT` 219 -> 220, `EXPECTED_UTF8_BYTES` recomputed from the committed file (30104), both catalog test titles, and the parser test's tuple count.
- A real regression discovered and fixed during full-suite verification (see Deviations): the guard now explicitly skips orchestrated (reconcile-driven) disables, mirroring EDEP-01's own `runEnableCascadeStep` exclusion, so LOAD-02's own dependency-propagation pass is never refused by a guard written for the standalone command.

## Task Commits

Each task was committed atomically, plus follow-up fixes discovered during full-suite verification:

1. **Task 1: the guard** - `00b102a8` (feat) -- the dependents guard, `composeDisableRefusalCause`/`renderDependentKeys`, the closed-set amendment, and the new EDEP-02/messaging tests.
2. **Prettier reformatting from the pre-commit hook re-run** - `f806ad72` (style).
3. **Regression fix: skip the guard for orchestrated disables** - `f8b7411e` (fix) -- discovered via `tests/orchestrators/reconcile/apply.test.ts`'s LOAD-02 suite and `tests/orchestrators/plugin/install-flow.test.ts` failing after Task 1; see Deviations.
4. **Task 2: the catalog state** - `a5eb9ee8` (docs) -- `disable-refused-dependents`, its fixture, and every catalog count.
5. **Regression fix: import's two D-04-07 fixtures** - `289c3803` (fix) -- discovered via `tests/orchestrators/import/execute.test.ts`; see Deviations.

**Plan metadata:** commit pending (this SUMMARY + REQUIREMENTS.md, written after this file).

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - `readEnabledDependents` (the guard), `EnableRefusedError` widened, the call site inside `setPluginEnabledWithTransaction`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` - `composeDisableRefusalCause`, `renderDependentKeys`
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `"dependents remain"` appended to `Reason` (tail)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - `"dependents remain"` added to `CommandPrivateReason`, header narrative updated (and its stale "59-entry" mention corrected to "61-entry")
- `docs/output-catalog.md` - new `disable-refused-dependents` catalog state; reasons paragraph updated to 61-member and the new token
- `scripts/check-unused-type-members.contracts.json` - pins remapped twice (once after Task 1's insertions, again after the orchestrated-guard fix's further insertions)
- `tests/orchestrators/plugin/enable-disable.test.ts` - 7 new EDEP-02 cases
- `tests/orchestrators/plugin/enable-disable.messaging.test.ts` - `composeDisableRefusalCause` unit cases, a `DISABLE_CONTEXT` render case for the new reason
- `tests/orchestrators/plugin/install-flow.test.ts` - `disableSeededDependency` switched to orchestrated mode (Deviation)
- `tests/orchestrators/import/execute.test.ts` - two D-04-07 fixtures switched to seeding the disabled-dependency precondition directly (Deviation)
- `tests/architecture/notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `tests/shared/notification-types.test.ts` - the 61-member enrollment/enumeration updates
- `tests/architecture/catalog-uat/fixtures/plugin-disable.ts`, `catalog-contract.test.ts`, `catalog-parser.test.ts` - the `disable-refused-dependents` fixture and the 220-state / recomputed-byte-count pins

## Decisions Made

See `key-decisions` in the frontmatter for the full text. In summary: the inherited B1 ruling (re-add `dependents remain`), `EnableRefusedError` widened rather than paired with a new class, and the orchestrated-mode exclusion added as a discovered-and-fixed gap rather than an anticipated plan item.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The guard refused reconcile-driven (orchestrated) disables, misclassifying the refusal as `{unreadable}`**
- **Found during:** Post-Task-1 full-suite verification (`tests/orchestrators/reconcile/apply.test.ts`'s LOAD-02 suite)
- **Issue:** `readEnabledDependents` ran unconditionally on every disable, including orchestrated (reconcile-driven) calls. LOAD-02's own dependency-propagation pass disables a dependency chain in dependents-before-dependencies order -- exactly the situation the guard is written to refuse -- so a reconcile pass disabling `bravo` (whose own dependency is unsatisfied) while `alfa` (enabled) still declared it tripped the new guard. Worse, the orchestrated catch path (`classifyTransactionThrow`) has no `EnableRefusedError` narrowing of its own (only the standalone catch does), so the refusal fell through `narrowDisableFailure`'s generic default and rendered `{unreadable}` instead of the intended `{dependents remain}` -- a silent misclassification, not merely a refusal in the wrong place.
- **Fix:** `readEnabledDependents` now takes an `orchestrated` flag and no-ops when it is true, mirroring EDEP-01's own `runEnableCascadeStep` exclusion for the identical reason (a reconcile-driven call has its own dependency handling and is a different call site).
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
- **Verification:** `tests/orchestrators/reconcile/apply.test.ts` (69/69 pass), new orchestrated-skip test in `enable-disable.test.ts`
- **Committed in:** f8b7411e

**2. [Rule 1 - Bug] `install-flow.test.ts`'s `disableSeededDependency` fixture disabled a still-declared dependency through the now-guarded standalone verb**
- **Found during:** Post-Task-1 full-suite verification
- **Issue:** The fixture installed `hello` (declaring `some-other-plugin`) then disabled `some-other-plugin` directly while `hello` stayed enabled -- exactly what EDEP-02 now refuses. The refusal is correct; the fixture's own precondition (a disabled dependency-provenance record with its declaring parent still enabled) was reachable only because the guard did not yet exist.
- **Fix:** Switched the fixture's disable call to `notifications: { mode: "orchestrated" }`, which both bypasses the guard (a legitimate reconcile-style call, per Deviation 1's exclusion) and skips the config write-back (RECON-03) -- and the test's own assertions never depended on that config write, since the later promotion step writes its own entry unconditionally.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** both `D-04-07` promotion tests in the file pass; full file (164 tests) green
- **Committed in:** f8b7411e

**3. [Rule 1 - Bug] Two `import/execute.test.ts` D-04-07 fixtures had the identical problem, with config-byte assertions that made the orchestrated-mode fix from Deviation 2 unsafe to reuse verbatim**
- **Found during:** Post-fix full-suite verification (a second full run after Deviation 1/2's fixes)
- **Issue:** Same root cause as Deviation 2 (a standalone disable of a still-declared dependency, now refused), but one of the two fixtures explicitly asserts the disable verb's own config write (`--local` writes `{enabled: false}` to the local file) as a mid-test checkpoint -- switching that fixture to orchestrated mode (which skips the config write per RECON-03) would have silently defeated the test's own purpose (D-103-16 file-selection-follows-declaration).
- **Fix:** Both fixtures now seed the disabled-dependency precondition directly: `seedDisabledDependencyRecord` (new local helper) writes the state record via `toDisabledRecord` and removes the skill from disk; the `--local` fixture additionally writes its expected local-config bytes directly via the file's own `configBytes` helper (guaranteeing byte-parity with the fixture's own assertions by construction, not by re-deriving the format). The notification boundary and a `notifications[]` index were adjusted for the one fewer notify emission each fixture now makes (the seeding step touches neither `ctx.ui` nor `pi.getAllTools()`).
- **Files modified:** `tests/orchestrators/import/execute.test.ts`
- **Verification:** both D-04-07 fixtures pass; full file (58 tests) green
- **Committed in:** 289c3803

**4. [Rule 3 - Blocking] `scripts/check-unused-type-members.contracts.json`'s line:col pins shifted twice**
- **Found during:** Task 1 (first shift, from the guard's own insertions) and again after Deviation 1's fix (second shift, from the widened doc comment and the new `orchestrated` parameter)
- **Issue:** The contract file pins exact `line:col` positions; inserting code above a pinned position invalidates it (`Invalid contract: ... names no declaration in this program`).
- **Fix:** Remapped every affected pin to its post-insertion position (column unchanged, row shifted), verified against the actual file content before writing, and re-verified via the full `unused-type-member-gate.test.ts` suite (including the ~2-minute live-gate overlay control) after the second remap.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` clean; `tests/architecture/unused-type-member-gate.test.ts` (12/12 pass, including the real-gate overlay control)
- **Committed in:** f8b7411e (first remap), 289c3803 (second remap)

**5. [Rule 1 - Bug] `notify-reasons.ts`'s top-of-file overview comment already understated the reason count before this plan touched it**
- **Found during:** Task 1, while editing the same paragraph to add the narrative continuation
- **Issue:** The overview sentence said "the 59-entry membership" while the actual set was already 60 members (08-01 bumped it but did not update this earlier sentence in the same file).
- **Fix:** Corrected to "the 61-entry membership" (the post-this-plan count) in the same edit, since it is the identical sentence being extended.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
- **Verification:** no test pins this prose sentence; a visual re-read of the paragraph
- **Committed in:** 00b102a8

---

**Total deviations:** 5 auto-fixed (3 bug, 1 blocking, 1 minor prose correction folded into an in-scope edit). **Impact:** Deviations 1-3 were necessary to keep the pre-existing test suite green under the new guard and to close a real, previously-latent misclassification bug in the orchestrated catch path that this plan's own guard was the first code to expose; none changed EDEP-02's required standalone-command behavior. Deviation 4 is mechanical bookkeeping. Deviation 5 is a one-line correction inside an edit already in scope.

## Issues Encountered

- A `test:coverage:unit` background run (whole-repo, coverage-instrumented) took over 5 minutes without completing and was killed rather than waited out further, once it was confirmed that the orchestrator runs this gate centrally after the plan returns (per the dispatch prompt's own verification-net note) and that targeted `test:coverage:direct:commit` runs already confirmed 100% branch/function/line coverage on every changed production module (`enable-disable.ts`, `enable-disable.messaging.ts`, `notification-types.ts`, `notify-reasons.ts`, `install-flow.ts`, `import/execute.ts`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EDEP-02 is Complete. `REASONS` sits at 61 members with `dependents remain` at the tail, and `disable-refused-dependents` is a documented catalog state (220 total states).
- Plan 08-03 (the install cascade's own already-installed-disabled arm, EDEP-03) is next -- it reuses the same `{dependency enabled}` token 08-01 landed and is unaffected by this plan's guard (the guard is `disable`-branch-only, per the plan's own prohibition).
- No blockers. Full targeted verification (521 tests across the affected suites, plus whole-repo `typecheck`/`eslint`/`fallow`/`format:check`/`test:corresponding`/`lint:type-members`) is green; the orchestrator's own end-of-wave `test:coverage:unit` run is the one gate this plan did not run to completion itself (see Issues Encountered).

---

*Phase: 08-enablement-parity-for-dependencies*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Created/modified files verified present on disk (all 16 files listed above, `git status --short` clean of anything but the pre-existing untouched dirty files).
- Commit hashes verified present in `git log --oneline 2452230f..HEAD`: `00b102a8`, `f806ad72`, `f8b7411e`, `a5eb9ee8`, `289c3803`.
- Acceptance criteria re-run: all 7 EDEP-02 `<behavior>` cases pass in `enable-disable.test.ts`/`enable-disable.messaging.test.ts`; `node --test` over the plan's full verification block plus the regression-fix files (521 cases across 12 files) all pass; `npm run typecheck`, whole-repo `npx eslint extensions tests scripts eslint.config.js`, `npm run fallow`, `npm run format:check`, `npm run test:corresponding`, and `npm run lint:type-members` all exit 0 on the final committed tree; `npm run test:coverage:direct:commit` reports 100% lines/branches/functions on every changed production module; `npx prettier --check docs/output-catalog.md` clean.
- `REASONS` closed set confirmed 61-entry via `tests/architecture/notify-closed-set-locks.test.ts` and `tests/architecture/compat-01-no-expansion.test.ts`; catalog confirmed 220-state via `tests/architecture/catalog-uat/catalog-contract.test.ts` and `catalog-parser.test.ts`.
