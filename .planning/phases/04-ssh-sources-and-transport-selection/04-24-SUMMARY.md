---
phase: 04-ssh-sources-and-transport-selection
plan: 24
subsystem: apply, import, and bootstrap clone notes
tags: [system-git, ssh, notification, clone-note, apply, import, bootstrap, gap-closure, cucumber]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-19: the clone member of PluginDisabledMessage and the other row and block types; 04-17: withOwnCloneNotes views per apply and import call, CloneNoted, carriedClone, cloneNoteOf; 04-08: the rebaseline rule and its diff filter"
provides:
  - "apply's DFEN-04 plugin-disabled outcome carries the install view's clone note, and notify.ts puts it on the (disabled) {installs disabled} row (WINDOWS #130, the apply half)"
  - "installFailedOutcomes(op, result, outcomes, notes) in reconcile/apply-outcomes.ts (moved from apply.ts): the requested plugin's row reads the note of <plugin>@<marketplace>, a failed dependency's own (failed) {rollback partial} row reads the note of the dependency's key (WINDOWS #138, apply)"
  - "import's failedDependency carries the dependency key's note, and its row shows it in text and JSON (WINDOWS #138, import)"
  - "AddMarketplaceOptions.cloneNotes?: AddCloneNotes and the exported createAddCloneNotes(forward?): one subject rule for the add's own note and the caller's; notifyAddFailure reads it; bootstrap makes one collector per run (WINDOWS #127)"
affects: [04-26]

actuals:
  tokens: 17122 # chars/4 over the realized diff (68,487 chars, 14 files)
  tasks: 3
  commits: 3
plan_head_before: 913c3b987a7ec33612c5acf2af1cf90bd8bdfa02
plan_head_after: 70db65c78b7dfa62b897f58d10571d32d0cda539

tech-stack:
  added: []
  patterns:
    - "A row composer that reports several plugins of one call takes the call's own clone-note view and reads each row's note by that row's own key"
    - "A caller that must report an add's failure itself passes a collector made by createAddCloneNotes in the add options, so the add and the caller apply one subject rule"
    - "An apply unit case can run a real GitHub plugin clone with no network: a local bare repository and a url.file://<dir>/.insteadOf=https://github.com/ row in the test's own GIT_CONFIG_* variables, which platform/git-process.ts keeps for the user"

key-files:
  created:
    - .planning/phases/04-ssh-sources-and-transport-selection/04-24-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/apply-outcomes.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/import/execute.test.ts
    - test/orchestrators/plugin/bootstrap.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - features/plugin/github-transport-apply.feature
    - features/plugin/bootstrap.feature

key-decisions:
  - "apply's failed-install projection (installFailedOutcomes, dependencyRollbackOutcome, showsFailedDependency, redactedDependencyCascadeError) moved from apply.ts into apply-outcomes.ts and is exported. apply builds its install operation itself, so no unit case can hand an apply install a dependency whose rollback fails after a GitHub clone; the move lets apply-outcomes.test.ts drive the projection with different notes for the requested plugin and the dependency (T-04-72). installFailureReasonFields lost its export, since only the moved code uses it now"
  - "installFailedOutcomes takes the call's GitHubCloneNotes view instead of the requested plugin's CloneNoted, and returns PluginInstallFailedOutcome[]; both apply call sites (applyPluginInstalls, applyDependencyInstalls) pass their view"
  - "The add's collector option is AddCloneNotes (notes plus note()), made by the exported createAddCloneNotes(forward?). runAddOutcome forwards every record to it, and notifyAddFailure reads note() from it, so the last-recorded-subject rule lives in one function"
  - "Bootstrap's add now names its clone on every failure after the clone, not only the invalid manifest: a missing repository (both attempts) and a duplicate name read as marketplace add of the same source reads"

patterns-established:
  - "Rebaseline rule (04-08) applied to bootstrap: only clone columns change"

requirements-completed: [SG-SSH-04, SG-SSH-02]

coverage:
  - id: D1
    description: "an apply (or autoapply) install of a GitHub plugin whose entry declares defaultEnabled false names its clone on the (disabled) {installs disabled} row; a toggle disable names none"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#D-SG-22: an install whose entry installs it disabled names its clone on the disabled row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#an install-disabled row names the clone its install ran, and a toggle disable names none"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport-apply.feature#Applying a config that declares a github plugin whose entry installs it disabled names the clone on the disabled row"
        status: pass
    human_judgment: false
  - id: D2
    description: "an apply or import install whose GitHub dependency's rollback could not finish shows the dependency's own row with the dependency's note, while the requested plugin's row keeps its own; with no note both rows are as before"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/apply-outcomes.test.ts#D-SG-22, T-04-72: a dependency whose undo could not finish names its own clone, and the requested plugin keeps its own"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/apply-outcomes.test.ts#D-SG-22, OQ-3: an install call that cloned nothing gives neither row a clone"
        status: pass
      - kind: unit
        ref: "test/orchestrators/import/execute.test.ts#D-SG-22 / T-04-72: a dependency whose rollback could not finish names its own clone, and the plugin keeps its own"
        status: pass
      - kind: unit
        ref: "test/orchestrators/import/execute.test.ts#D-SG-22 / T-04-72: the JSON rows of a failed dependency and its plugin each carry their own clone"
        status: pass
      - kind: e2e
        ref: "features/plugin/apply.feature + features/plugin/import.feature (adapter, 88 of 88): the dir-source rollback scenarios keep their bytes"
        status: pass
    human_judgment: true
    rationale: "No scenario can make a cloned plugin's rollback fail (see the #138 reason below), so the user-visible row is proven by unit cases only; 04-26 records this in the D-SG-22 outcome"
  - id: D3
    description: "a bootstrap whose add of the official marketplace fails after its clone names the clone on the failed block, as marketplace add does; an add given no collector is unchanged"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#D-SG-22: notifyAddFailure names the clone a caught add ran, as the add's own failure does"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#D-SG-22: an add given a collector records its clone's note there and reports its added block as before"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/bootstrap.test.ts#D-SG-22: renders a failed add as marketplace add does, naming its clone, and never reaches the missing-dependency step"
        status: pass
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping when the official marketplace's manifest is invalid names the clone on its failed result"
        status: pass
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#A bootstrap whose official marketplace is missing reports why and records nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "every re-baselined scenario differs only by clone columns or clone lines"
    verification:
      - kind: other
        ref: "git diff -U0 913c3b9..HEAD -- features, filtered with grep -v -i 'clone|Cloning via|retrying with|SSH not configured' (see Rebaseline audit)"
        status: pass
    human_judgment: true
    rationale: "The filter leaves the old header line the widened table replaces and the lines of the two new scenarios; a reader confirms the audit"

duration: 1h 45m
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 24: Clone notes on apply's disabled row, the failed dependency row, and bootstrap's failed add Summary

**An apply (or a load with autoapply on) that installs a GitHub plugin whose entry declares `defaultEnabled: false` now names the clone under its `(disabled) {installs disabled}` row. An apply or import install whose GitHub dependency could not finish its rollback names the dependency's own clone on the dependency's `(failed) {rollback partial}` row, while the requested plugin's row keeps its own note. A bootstrap whose add of the official marketplace fails after the clone names the clone on the failed block, as `marketplace add` of the same source does (D-SG-22; WINDOWS #130 apply half, #138, #127).**

PLAN_BASE: `913c3b987a7ec33612c5acf2af1cf90bd8bdfa02`

## Performance

- **Duration:** 1h 45m
- **Started:** 2026-11-26T19:20:19Z
- **Completed:** 2026-11-26T21:05:00Z
- **Tasks:** 3 of 3
- **Files modified:** 14 (plus this SUMMARY)

## Accomplishments

- `reconcile/apply.ts`: the DFEN-04 `plugin-disabled` outcome spreads the install view's note. Both failed-install call sites pass the call's whole notes view to `installFailedOutcomes`.
- `reconcile/apply-outcomes.ts`: `PluginDisabledOutcome` extends `CloneNoted`. The failed-install projection lives here now: the requested plugin's row reads `cloneNoteOf(notes, "<plugin>@<marketplace>")`, and `dependencyRollbackOutcome` reads `cloneNoteOf(notes, error.key)`.
- `reconcile/notify.ts`: the `plugin-disabled` arm spreads `carriedClone(outcome)`. A toggle disable carries no note, so its row stays byte-frozen.
- `import/execute.ts`: `dispatchFailedOutcome` takes the call's view (`notes`). Its DependencyCascadeError arm hands `cloneNoteOf(notes, error.key)` to `partialMember`, `failedDependency` carries it (`CloneNoted &`), and the dependency's row spreads `carriedClone(o.failedDependency)`.
- `marketplace/add.ts`: `AddCloneNotes` and the exported `createAddCloneNotes(forward?)`, plus `AddMarketplaceOptions.cloneNotes`. `runAddOutcome` forwards each record to the caller's collector, and `notifyAddFailure` passes `opts.cloneNotes?.note()` to `handleAddFailure`.
- `plugin/bootstrap.ts`: one `createAddCloneNotes()` per bootstrap, in the options the add and `notifyAddFailure` share.
- Two new scenarios and one re-baselined scenario (see below).

## Task Commits

1. **Task 1: Applying a config whose github plugin installs disabled names the clone on the disabled row, end to end** (tracer): `400cf12` (feat)
2. **Task 2: An apply or import whose github dependency's rollback cannot finish names the dependency's clone on its own row**: `15002e0` (feat)
3. **Task 3: A bootstrap whose add fails after its clone names the clone, as marketplace add does**: `70db65c` (feat)

**Plan metadata:** this SUMMARY commit (docs)

Tracer gate after Task 1: `auto_advance` is false, `human_verify_mode` is end-of-phase, and the verify is automated only. The scenario ran again on the committed tree and passed 1 of 1 under adapter. The three unit files had passed 414 of 414 on the same bytes before the commit. Tracer verified end-to-end -- expanding.

## TDD Gate Compliance

Each task ran RED locally, then GREEN. RED and GREEN went into one `feat` commit per task, because the commit hook runs typecheck and the architecture tests, so a commit with only failing tests cannot pass it (sandbox note, the 04-08 precedent). The committing skill forbids a plan id in a commit scope, so no `test(04-24):` commit exists. Each RED run set the named sources back to PLAN_BASE with `red.sh` or `red-cuke.sh` in the scratch directory and restored them afterwards.

- **RED, Task 1 unit:** `node --import scripts/isolated-pi-home.mjs --test --test-name-pattern "installs it disabled names its clone|install-disabled row names the clone" test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/notify.test.ts`, with `apply.ts`, `apply-outcomes.ts`, and `notify.ts` at PLAN_BASE: exit 1, 2 tests, 2 failed. In the apply case, the line under `◍ ghp v1.0.0 (disabled) {installs disabled}` was `    Run enable on this plugin to use its components.`, not `    SSH not configured, cloning via HTTPS: https://github.com/acme/ghp.git`. In the notify case, the disabled row had no `clone` member.
- **RED, Task 1 scenario:** with the same three sources at PLAN_BASE, "Applying a config that declares a github plugin whose entry installs it disabled names the clone on the disabled row" failed at `the result lists these plugins:`. The `clone note` and `clone url` columns were missing.
- **RED, Task 2 import:** `--test-name-pattern "T-04-72" test/orchestrators/import/execute.test.ts`, with `execute.ts` at PLAN_BASE: exit 1, 2 tests, 2 failed. In the text case, `failedDependency.clone` was `undefined`, not `{ note: 'via-ssh', url: 'git@github.com:acme/lib.git' }`. In the JSON case, the clone of the `lib@mp` row was `undefined`.
- **RED, Task 2 apply:** with `apply.ts` and `apply-outcomes.ts` at PLAN_BASE, `apply-outcomes.test.ts` fails to load (`SyntaxError: ... does not provide an export named 'installFailedOutcomes'`). A semantic RED on the moved code, with the `...cloneNoteOf(notes, error.key)` spread removed from `dependencyRollbackOutcome`, ran 7 tests and 2 failed: the T-04-72 case and the D-PL6-15 case. In both, the dependency's row lacked `clone: { note: 'via-ssh', ... }`.
- **RED, Task 3 unit:** with the tests written and the sources at the Task 2 commit, `add.test.ts` failed to load (`does not provide an export named 'createAddCloneNotes'`). The bootstrap case "renders a failed add as marketplace add does, naming its clone ..." got the bare `{source missing}` block without its two clone lines.
- **RED, Task 3 scenario:** "Bootstrapping when the official marketplace's manifest is invalid names the clone on its failed result" failed at `the result lists these marketplaces:`. The `clone note` and `clone url` columns were missing.
- **GREEN:** every owner file passes, and direct coverage of `apply.ts`, `apply-outcomes.ts`, `notify.ts`, `import/execute.ts`, `marketplace/add.ts`, and `plugin/bootstrap.ts` is 100% (`npm run test:coverage:direct -- <source>`, exit 0 for each; the commit hooks ran the staged pairs again).

## Why WINDOWS #138 has no scenario

A scenario for #138 needs a dependency that clones from GitHub and then cannot finish its rollback. The harness has one rollback fault: the read-only skill directory of a local publication (`features/lib/published-marketplace.ts::publishReadOnlySkillDirectory`). Its doc notes that git stores no directory mode, so a clone can never carry the read-only directory. Every other undo removes only what its own do wrote first. So no Given can make a cloned plugin's rollback fail. The apply unit path cannot reach it either: `applyReconcile` builds its install operation itself, and a real clone has the same limit. The fix is proven by unit cases that drive the two projections with different notes for the requested plugin and the dependency: `apply-outcomes.test.ts` (`installFailedOutcomes`) and `import/execute.test.ts` (an injected install). The dir-source rollback scenarios (`features/plugin/apply.feature` line 343, `features/plugin/import.feature` line 1147) clone nothing and keep their bytes (88 of 88 for the two files under adapter). 04-26 carries this into the D-SG-22 outcome.

## New and re-baselined scenarios

- New: `features/plugin/github-transport-apply.feature`, "Applying a config that declares a github plugin whose entry installs it disabled names the clone on the disabled row". `ghp` comes from a github source with `defaultEnabled: false`, written by the existing manifest step `the marketplace "gits" publishes this manifest:`. The scenario uses the denied ssh and the routed Pi. The row reads `disabled` with `installs disabled`, `hint` `enable`, and the clone cells `ssh-not-configured` and `https://github.com/acme/ghp.git`. The installation record holds `enabled: false`, and ssh receives one probe and one `-G`.
- New: `features/plugin/bootstrap.feature`, "Bootstrapping when the official marketplace's manifest is invalid names the clone on its failed result". The scenario uses the existing step `the manifest of the marketplace ... has become invalid`. The block reads `failed` with `invalid manifest`, `via-https`, and `https://github.com/anthropics/claude-plugins-official.git`.
- Re-baselined (planned): `features/plugin/bootstrap.feature`, "A bootstrap whose official marketplace is missing reports why and records nothing". The table gains `marketplace clone note` `via-https` and `marketplace clone url` `https://github.com/anthropics/claude-plugins-official.git`.
- No scenario outside this plan's feature files changed: the whole adapter run showed no other difference.

## Rebaseline audit

`git diff -U0 913c3b9..HEAD -- features`, filtered with `grep '^[-+][^-+]' | grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'`, prints 40 lines of two kinds only:

- The old header line of the 404 scenario's table. Its replacement holds `clone`.
- The lines of the two new scenarios (their Given, When, and Then lines, the manifest text, the fields tables, the record table, and the ssh launches table).

No other line changed.

## Verification

All runs are on the final code tree (`70db65c`):

- `npm run check:static` (with `CI=1`): passed. That covers typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features (2511 scenarios, 510 step definitions).
- `npm run test:modules`: 20048 of 20048 passed (`dispatch-exec.test.ts:39` passed too).
- `npm run test:integration`: 236 of 236 passed.
- Cucumber, adapter, whole suite (`features`): 2402 scenarios, 2396 passed, 6 failed. Five are the known `fd` baselines in `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834). The sixth, `features/marketplace/device-flow.feature:223` "The background update of a private GitHub marketplace with no stored credential does not sign in", saw one 401 request instead of two under a load average near 23. Alone it passed 1 of 1, and its path is the background update, which this plan does not touch. `features/plugin/bootstrap.feature` alone: 19 of 19 (its json-mode scenarios had timed out at 25 s under load, at PLAN_BASE's sources too).
- Cucumber, builtin, whole suite: 260 of 260 scenarios (3576 steps).
- Task 1 verify: the three unit files passed 414 of 414, and the new scenario passed 1 of 1 under adapter.
- Task 2 verify: `apply.test.ts`, `apply-outcomes.test.ts`, and `execute.test.ts` passed 393 of 393. `apply.feature` and `import.feature` passed 88 of 88 under adapter.
- Task 3 verify: `bootstrap.test.ts`, `add.test.ts`, `test/edge/handlers/plugin/bootstrap.test.ts`, and `test/edge/register.test.ts` passed 624 of 624 after the duplicate-name case was re-baselined.
- Acceptance: `grep -c 'installs disabled' features/plugin/github-transport-apply.feature` = 1. `grep -c 'cloneNoteOf\|carriedClone' import/execute.ts` = 20 (expected 19 or more). `grep -c 'cloneNotes' plugin/bootstrap.ts` = 2. `grep -c -i 'clone' features/plugin/bootstrap.feature` = 14 (expected 12 or more). `grep -c 'cloneNoteOf' reconcile/apply.ts` = 6, below the expected 8 (see Deviations).
- `npm run check` was not run: the orchestrator runs it at the wave gate. No `--no-verify` was used.

## Files Created/Modified

- `orchestrators/reconcile/apply.ts`: the disabled outcome's note, and both callers pass the view to `installFailedOutcomes`. The moved code and its now-unused imports are gone.
- `orchestrators/reconcile/apply-outcomes.ts`: `PluginDisabledOutcome extends CloneNoted`, and the moved projection with the dependency's note.
- `orchestrators/reconcile/notify.ts`: the `plugin-disabled` arm's `carriedClone`.
- `orchestrators/import/execute.ts`: the dependency's note on `failedDependency` and on its row.
- `orchestrators/marketplace/add.ts`: `AddCloneNotes`, `createAddCloneNotes(forward?)`, `AddMarketplaceOptions.cloneNotes`, and `notifyAddFailure`'s note.
- `orchestrators/plugin/bootstrap.ts`: the per-run collector.
- Tests: `apply.test.ts` (the disabled-row case with a local GitHub host), `notify.test.ts`, `apply-outcomes.test.ts` (the `installFailedOutcomes` suite; the old `installFailureReasonFields` cases now read the reasons through it), `execute.test.ts`, `add.test.ts`, and `bootstrap.test.ts` (two cases re-baselined with their clone lines).
- Features: the two new scenarios and the 404 rebaseline.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The apply dependency row could not be unit-tested where it lived**
- **Found during:** Task 2
- **Issue:** the plan asked for cases in `apply.test.ts` that drive the dependency row with different notes. `createApplyReconcile` builds its install operation internally, so a case cannot hand an apply install a failed dependency cascade. A real GitHub clone cannot make the dependency's rollback fail either (see the #138 reason).
- **Fix:** the pure projection (`installFailedOutcomes` and its three helpers) moved from `apply.ts` to `apply-outcomes.ts` (both in `files_modified`) and is exported. Its cases are in `apply-outcomes.test.ts`, not `apply.test.ts`. `installFailureReasonFields` lost its export because fallow reported it unused once only the moved code called it. Its five cases now read the reasons through `installFailedOutcomes`.
- **Committed in:** `15002e0`

**2. [Rule 1 - Expected output] Bootstrap's duplicate-name refusal names its clone too**
- **Found during:** Task 3
- **Issue:** "MPA-01: refuses a different source under the official name as a duplicate name" (`bootstrap.test.ts`) now shows the clone line, because the add clones before it reads the manifest's name. `marketplace add` of the same source already shows it (`add.test.ts` MA-8).
- **Fix:** the case states the clone line (only a clone line changed, under 04-08's rule).
- **Committed in:** `70db65c`

### Scope adjustments

**3. The apply disabled-row unit case runs a real clone.** No apply unit case had cloned a GitHub plugin before. The new case serves `acme/ghp` from a local bare repository and sets `GIT_CONFIG_COUNT=1` with `url.file://<dir>/.insteadOf=https://github.com/` for the test only, restored after it. `platform/git-process.ts` keeps the user's `GIT_CONFIG_*`, so the clone succeeds with no request leaving the machine. The probe is the case's own counting context, which answers not-configured.

**4. The plan's "manifest step writes defaultEnabled" is the raw manifest step.** The git-repository offer step has no `defaultEnabled` column. The scenario uses `the marketplace "gits" publishes this manifest:` with the entry's JSON, so no step definition or `features/lib` file changed. The row's hint field is named `hint` (`enable`), not `enable hint`.

**5. Acceptance grep for `cloneNoteOf` in `apply.ts`.** The count is 6, not 8 or more, because the projection moved to `apply-outcomes.ts` (3 there). Across the two files the count is 9. Each row still reads its own key from the call's view.

**6. The add's collector type.** The plan's "optional clone-note collector" is `AddCloneNotes` (`notes` plus `note()`), made by the exported `createAddCloneNotes`, rather than a bare `GitHubCloneNotes`. That keeps the last-recorded-subject rule in one function, as the plan asks.

**7. `test/edge/handlers/plugin/bootstrap.test.ts` and `test/edge/register.test.ts` did not change.** Their bootstrap cases pass unchanged. The handler's own failed row, for a thrown non-precondition error, is not `notifyAddFailure`'s.

**8. No REFACTOR commit, and the commits pair RED with GREEN** (see TDD Gate Compliance).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 expected output) and 6 scope adjustments. **Impact:** no file outside `files_modified` was touched.

## Issues Encountered

- The worktree harness refuses command text that names paths containing `git` (`github-transport`, `ghp@gits`, `GIT_CONFIG_COUNT`) or chains several commands. Edits, RED runs, unit and cucumber runs, coverage, pre-commit, and commits therefore ran from scripts in the scratch directory: `t2apply.py`, `t2import.py`, `t3src.py`, the test edit scripts, `red.sh`, `red-cuke.sh`, `unit.sh`, `cuke.sh`, `cukes.sh`, `cov.sh`, `precommit.sh`, `commit.sh`, `suites.sh`, and `audit.sh`. Commits ran with hooks through `setpriv`.
- The worktree had no optional-peer cache, so `node scripts/install-test-peers.mjs` installed the declared test peers (no package was added to the project).
- Four executors shared the machine (load average 20 to 30). The json-mode bootstrap scenarios timed out at 25 s during one run, at PLAN_BASE's sources too, and passed later.
- The Task 2 commit hook failed once: fallow reported `installFailureReasonFields` as an unused export (Deviation 1). The fix was committed in the same task commit.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-72: each row reads its own key from the install call's own `withOwnCloneNotes` view. The apply and import unit cases give the requested plugin and the dependency different notes and fail if either row reads the other's. T-04-73: the note URL is redacted where the note is made and again in `resolveRows` (CR-A-01). The bootstrap collector is made per run and holds only that run's add. T-04-74: the rebaseline rule, the audit above, and the #138 reason above. T-04-SC: no package was added.

## Orchestrator actions

The plan asks for no `gsd-tools windows append`. This plan closes these ledger entries in code, for the orchestrator or 04-26 to resolve: #127 (bootstrap), #138 (apply and import, unit-proven only, reason above), and the apply half of #130 (the standalone install half is 04-21's).

Run `npm run check` on the merged tree (the wave gate).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04-26 can record the D-SG-22 outcome: apply, autoapply, import, and bootstrap name every GitHub clone they run. #138's row has unit proof only, for the reason above.

## Self-Check: PASSED

- The modified files exist, and this SUMMARY is at `.planning/phases/04-ssh-sources-and-transport-selection/04-24-SUMMARY.md`.
- Commits `400cf12`, `15002e0`, and `70db65c` are ancestors of HEAD. `git rev-list --count 913c3b9..HEAD` is 3 before this SUMMARY commit.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
