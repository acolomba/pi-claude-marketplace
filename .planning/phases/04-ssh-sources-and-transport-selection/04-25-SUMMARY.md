---
phase: 04-ssh-sources-and-transport-selection
plan: 25
subsystem: enable transport notification
tags: [system-git, ssh, notification, clone-note, enable, gap-closure, cucumber]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-16: enable's command-root transport context and composeEnableCascadeRows's clones argument; 04-19: the optional clone.plugin label (`<plugin>: ` prefix, redacted with redactRowName); 04-22: the github-transport-update.feature scenarios this plan adds beside"
provides:
  - "the merged and the members-only enable ledgers record the failing cascade member's key on the run; the enable-failed outcome carries it as the module-private failingMember"
  - "composeEnableCascadeRows clones.failingMember: the root's failed row carries that member's clone note, labelled with the member's <plugin>@<marketplace>"
  - "the standalone transaction-throw row of an enable reads the root key's clone note (withCloneNote)"
  - "harness: holdInstallationRecordReadOnly (features/lib/installation-record.ts), the {installation record save error} token (features/lib/run-tokens.ts), and the Given `the installation record of the {word} scope can be read but no longer saved`"
affects: [04-26]

actuals:
  tokens: 10816
  tasks: 3
  commits: 2

plan_head_before: 3d0c4ed409dd0b6a3f7a193ab62e6af0543e8cf2
plan_head_after: 00a392c05e4eaa1b0158089d60eba7a87ea068bb

tech-stack:
  added: []
  patterns:
    - "a ledger phase that must be named in a failure records its own key on the run context in its catch, because runPhases reports the error and not the phase"
    - "a harness fault that makes a file readable but not saveable: move it into a read-only subdirectory and link its place to it; write-file-atomic resolves the link and is refused beside the real file"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/enable-disable.messaging.test.ts
    - features/plugin/github-transport-update.feature
    - features/step_definitions/plugin/installation.steps.ts
    - features/lib/installation-record.ts
    - features/lib/run-tokens.ts

key-decisions:
  - "The failing member is recorded only in the member phase's catch around runInstallLedger; the root phase and the config phase record nothing, so their failures keep the root's own note, unlabelled"
  - "The transaction-throw row reads the root key's note only for enable (a disable clones nothing), so every disable row keeps its bytes even when a caller-given context holds a note"
  - "The ok:false results of both cascade runners and the two enable-failed outcomes are built by two shared helpers (enableCascadeFailure, enableCascadeFailedOutcome), which also removes the near-duplicate blocks the new member would have widened"

patterns-established:
  - "An error token whose message names a randomly numbered temporary file matches the number as any digits, in the message and in its cut form (shorterErrorForm in run-tokens.ts)"

requirements-completed: [SG-SSH-04]

coverage:
  - id: D1
    description: "An enable whose re-enabled dependency's re-clone fails keeps today's root failed row and adds that dependency's clone note, labelled with the dependency's <plugin>@<marketplace> (WINDOWS #136)"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose re-enabled member's re-clone fails names that member's clone on the root's failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an already-enabled plugin whose re-enabled member's re-clone fails names that member's clone on its failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.messaging.test.ts#D-SG-22: gives a failed root row the clone note of the cascade member that failed, labelled with its key"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.messaging.test.ts#D-SG-22: leaves a failed root row unchanged when the member that failed cloned nothing over GitHub"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport-update.feature#Enabling a plugin whose re-enabled github dependency cannot be cloned names that dependency's clone on the plugin's failed row"
        status: pass
    human_judgment: false
  - id: D2
    description: "A root-phase or config-phase failure keeps the root's own clone note, unlabelled"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose own re-clone fails after its member's names only its own clone, unlabelled"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose config write fails after every re-clone names only the root's clone, unlabelled"
        status: pass
    human_judgment: false
  - id: D3
    description: "An enable that fails after its ledger re-cloned the plugin (a record that loads but cannot be saved) names that clone on its brace-less failed row; a throw before any clone and a disable keep their rows (WINDOWS #137)"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose save fails after its re-clone names that clone on its failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose transaction fails before any clone keeps its failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: a disable whose transaction fails keeps its failed row, whatever clone the context holds"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport-update.feature#Enabling a github plugin whose installation record can be read but no longer saved names its clone on the failed row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every other scenario is unchanged: no rebaseline, enable.feature untouched, both cucumber profiles pass apart from the known sandbox baselines"
    verification:
      - kind: e2e
        ref: "npm run --silent test:cucumber:profile -- --profile adapter features (2412 scenarios, 2406 passed; 5 fd Glob baselines and 1 parallel-load flake that passes alone)"
        status: pass
      - kind: e2e
        ref: "npm run --silent test:cucumber:profile -- --profile builtin features (261 scenarios, 261 passed)"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 25: Clone notes on the enable failure paths Summary

**A failed enable now names every GitHub clone whose failure it reports: a failing re-enabled dependency's clone note rides the root plugin's failed row, labelled `ghp@gits: ...` (`clone.plugin` in JSON), and an enable that fails at its save after re-cloning names that clone on its brace-less failed row. The enable failure shape is otherwise unchanged.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-11-26T21:35:57Z
- **Completed:** 2026-11-26T22:13:43Z
- **Tasks:** 3 (2 commits; Task 3 needed no rebaseline, so it has no commit)
- **Files modified:** 8

PLAN_BASE: `3d0c4ed409dd0b6a3f7a193ab62e6af0543e8cf2`

## Accomplishments

- WINDOWS #136: `buildEnableCascadeMemberPhase`'s catch sets `run.failingMember = member.key` before it rethrows. `runEnableCascadeMembers` and `runEnableCascadeWithRoot` return it on their `ok: false` result (`enableCascadeFailure`), and `settleIdempotentEnableCascade` and `runFreshEnableCascadeWithRoot` put it on the `enable-failed` outcome (`enableCascadeFailedOutcome`). `dispatchOutcome` passes it as `clones.failingMember`, and `composeEnableCascadeRows` gives the root's failed row that member's note plus `plugin: <member key>`. No member row, reason, cause, or severity changed. `outcomeToTypedResult` ignores the new member, so an orchestrated caller's typed result is unchanged.
- A root-phase or config-phase failure records no failing member, so the root row keeps its own note unlabelled, as 04-16 made it.
- WINDOWS #137: the standalone transaction-throw row of an enable is built through `withCloneNote(row, opts.transportContext.notes, "<plugin>@<marketplace>")`. A disable passes no notes. A throw before the ledger finds no note, so its row keeps its bytes.
- Harness fault for #137: `holdInstallationRecordReadOnly(scopeRoot)` moves `state.json` into `pi-claude-marketplace/held-record/`, links `state.json` to it, makes `held-record` mode 0555, and returns `{ release, saveError }`. `saveError` is the message of an open for writing of `held-record/state.json.1`. It throws if that open succeeds, so a run that ignores file modes fails at the Given. The Given registers `release` through `onRelease` and checks that the record still reads the same.
- `{installation record save error}` matches the save error with any digits on the temporary file's number, in the message and in its cut form. `shorterErrorForm` keeps the `{read-only skill directory removal error}` special case and the default cut form as they were.

## Task Commits

1. **Task 1 (tracer): a failing re-enabled dependency's clone on the root's failed row** - `da183bc` (feat, RED and GREEN in one commit)
2. **Task 2: the clone on the failed row of an enable whose save fails** - `00a392c` (feat, RED and GREEN in one commit)
3. **Task 3: every enable scenario and every suite with only clone differences** - no commit: no scenario differed, so nothing was re-baselined

RED and GREEN share each commit because the commit hook runs typecheck and every architecture test, so a failing-test-only commit cannot pass it (the 04-08 precedent). Each RED was run locally first.

Tracer gate (Task 1): auto mode is off and `HUMAN_VERIFY_MODE` is `end-of-phase`, and the tracer's `<verify>` is automated only, so its verify was re-run (unit suite and scenario green) and the plan continued with no checkpoint.

## TDD Gate Compliance (red runs)

**Task 1 unit RED** (`node --import scripts/isolated-pi-home.mjs --test test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/enable-disable.messaging.test.ts`, with `GIT_CONFIG_COUNT` unset): `tests 247, pass 243, fail 4`:

- `D-SG-22: gives a failed root row the clone note of the cascade member that failed, labelled with its key` (the root got its own note)
- `D-SG-22: leaves a failed root row unchanged when the member that failed cloned nothing over GitHub` (the root got its own note)
- `D-SG-22: an enable whose re-enabled member's re-clone fails names that member's clone on the root's failed row`: actual `⊘ a v1.0.0 (failed)` then `cause: both clones failed`, with no `b@official: ...` lines
- `D-SG-22: an already-enabled plugin whose re-enabled member's re-clone fails names that member's clone on its failed row`: the same, with no clone line

The root-failure and config-failure cases passed at RED: they guard the unlabelled root note that 04-16 already shows.

**Task 1 scenario RED** (adapter, `enable-disable.ts` and its messaging module set back to PLAN_BASE): "Enabling a plugin whose re-enabled github dependency cannot be cloned names that dependency's clone on the plugin's failed row" gave `1 scenario (1 failed)` at `Then the result lists these plugins:`: the actual row had no `clone note`, `clone url`, `clone retries`, or `clone plugin` cells.

**Task 2 scenario RED** (adapter, once the fault and token existed, with the two sources set back to PLAN_BASE): "Enabling a github plugin whose installation record can be read but no longer saved names its clone on the failed row" gave `1 scenario (1 failed)` at `Then the result lists these plugins:`: no `clone note` or `clone url` cells. The cause chain read `{installation record save error}` at RED, so the token matched the real save error.

**Task 2 unit RED**: `tests 206, pass 205, fail 1`: `D-SG-22: an enable whose save fails after its re-clone names that clone on its failed row` (actual `⊘ a (failed)` then `cause: state.json could not be saved`, with no clone line). The before-any-clone and disable cases passed at RED: they guard that those rows keep their bytes.

**GREEN:** both unit files `tests 250, pass 250, fail 0`; each new scenario passes under the adapter profile.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - `EnableCascadeRun.failingMember`, the member catch, `EnableCascadeFailure`/`enableCascadeFailure`/`enableCascadeFailedOutcome`, `enable-failed.failingMember`, `dispatchOutcome`'s `clones.failingMember`, the transaction-throw row's `withCloneNote`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` - `clones.failingMember`, module-private `withRootCloneNote`, doc comment
- `test/orchestrators/plugin/enable-disable.test.ts` - `cloningTransaction`'s optional `failingSubject`, `savingFailsTransaction`, seven cases
- `test/orchestrators/plugin/enable-disable.messaging.test.ts` - two cases
- `features/plugin/github-transport-update.feature` - two scenarios, one description sentence
- `features/step_definitions/plugin/installation.steps.ts` - the new Given, header sentence
- `features/lib/installation-record.ts` - `holdInstallationRecordReadOnly`, `HeldInstallationRecord`, header paragraph
- `features/lib/run-tokens.ts` - `INSTALLATION_RECORD_SAVE_ERROR_TOKEN`, `escapeRegExp`, `anyTemporaryNumberPattern`, `shorterErrorForm`, header and `projectTokens` docs

## Harness files added

No new file. In the existing harness files: the Given `the installation record of the {word} scope can be read but no longer saved` (`installation.steps.ts`), `holdInstallationRecordReadOnly` (`installation-record.ts`), and the `{installation record save error}` token (`run-tokens.ts`). No other step definition or `features/lib` file changed.

## New and re-baselined scenarios

New (not re-baselines), both in `features/plugin/github-transport-update.feature`:

- "Enabling a plugin whose re-enabled github dependency cannot be cloned names that dependency's clone on the plugin's failed row": one plugin row, `app@gits` `failed`, empty reasons, today's cause chain, `clone note` `ssh-not-configured`, `clone url` `https://github.com/acme/ghp.git`, `clone retries` `git@github.com:acme/ghp.git`, `clone plugin` `ghp@gits`. Both records stay disabled. The plan's list of expected cells did not name `clone retries`, but the run shows it: the HTTPS 404 is retried over the denied SSH, as in `github-transport.feature`'s both-attempts install scenario.
- "Enabling a github plugin whose installation record can be read but no longer saved names its clone on the failed row": the brace-less `ghp` `failed` row, cause chain `{installation record save error}`, `clone note` `ssh-not-configured`, `clone url` `https://github.com/acme/ghp.git`.

Re-baselined: none. `git diff --stat 3d0c4ed..HEAD -- features/plugin/enable.feature` prints nothing.

Rebaseline audit: `git diff -U0 3d0c4ed..HEAD -- features`, filtered with `grep '^[-+][^-+]' | grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'`, printed only:

- the added steps and data rows of the two new scenarios
- the new Given and its import and header lines in `installation.steps.ts`
- the new harness code and header paragraph in `installation-record.ts`, and its widened `node:fs/promises` import
- the new token, its helpers, and their docs in `run-tokens.ts`, plus the refactored lines of `anyQuotedPathPattern` and the `projectTokens` loop, whose behaviour is unchanged for the two existing token kinds

No line of any other scenario was removed or changed.

## Suite counts (final tree, `GIT_CONFIG_COUNT` unset)

- `npm run --silent check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features)
- `npm run --silent test:modules`: passed (exit 0)
- `npm run --silent test:integration`: passed (exit 0)
- cucumber `--profile adapter features`: 2412 scenarios, 2406 passed, 6 failed. Five are the known fd-dependent Glob baselines in `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834). The sixth, `features/plugin/package-dependencies.feature:221` "Enabling an unchanged disabled plugin keeps its packages and makes no npm request", failed in the shared `Before` hook (`ENOTEMPTY: directory not empty, rmdir '<sandbox>/project/.pi/pi-claude-marketplace'`) before any of its steps ran. It passed alone, and `github-transport-update.feature`, `package-dependencies.feature`, and `enable.feature` run together passed (53 scenarios, 53 passed). It is a parallel-load race while the sandbox is emptied, not a scenario difference. `ENOTEMPTY` is not the `EACCES` that a held directory left read-only would give.
- cucumber `--profile builtin features`: 261 scenarios, 261 passed
- Direct coverage (`npm run --silent test:coverage:direct -- <source>`): 100% for `orchestrators/plugin/enable-disable.ts` and `orchestrators/plugin/enable-disable.messaging.ts`

`npm run check` was not run here; the wave gate runs it on the merged tree.

## Decisions Made

- Only the member phase records a failing member. A throw from `assertRecordedStateLedgerInstalled` after a member's ledger returned records none: that assertion is an invariant check and runs no clone.
- The transaction-throw row reads the root key's note only for `enable`, so a disable keeps its bytes even with a caller-given context that holds a note (pinned by a unit case).
- A cascade member's clone is not named on the transaction-throw row, as the plan's placement table says: the row reports the root, and the failure belongs to the save, not to a member. 04-26 records this in the D-SG-22 outcome.

## Deviations from Plan

None in scope or behaviour. Two small notes:

- The plan did not list `clone retries` among the Task 1 scenario's expected cells. The real run shows it, and the scenario states it, because the rebaseline rule counts clone columns as clone data.
- `cloningTransaction` in the unit test gained an optional third parameter (`failingSubject`), so one member can fail while the others run the real ledger. The existing calls are unchanged.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Issues Encountered

- The optional test peer cache was empty in this worktree. `node scripts/install-test-peers.mjs` installed the declared peers (pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, pi-dynamic-workflows 3.15.0) into `node_modules/.cache/optional-peers`. No package was added to the project.
- The adapter flake described under Suite counts.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-75: the root row reads only the failing member's key or its own; the note's URL and label go through the existing redaction (`resolveRows`, `redactRowName`). T-04-76: the label is the failing phase's own key, set in that phase's catch; unit cases pin a member failure, a root failure, and a config-phase failure. T-04-77: the root row's status, reasons, and cause are unchanged, and nothing was re-baselined. T-04-78: the Given's release restores the held directory's mode through `onRelease`, inside the scenario's own extension root. T-04-SC: no package added.

## Orchestrator actions

The plan asks for no `gsd-tools windows append`. WINDOWS #136 and #137 are closed in code and by scenario (the commits above). Resolving those ledger entries and recording the D-SG-22 outcome is left to the orchestrator and 04-26. This plan does not edit `.planning/WINDOWS.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The enable paths of the D-SG-22 gap are closed. 04-26 can record the outcome, including the decision that the transaction-throw row names only the root's clone.

## Self-Check: PASSED

- All eight modified files exist. Commits `da183bc` and `00a392c` are on this branch, and `git rev-list --count 3d0c4ed..HEAD` is 2.
- Acceptance greps: `clone plugin` in the feature file 1 (HEAD 0); `can be read but no longer saved` in `installation.steps.ts` 1 and in the feature file 2 (the Given and the scenario title); `installation record save error` in `run-tokens.ts` 3. The Task 1 scenario table has exactly one plugin row. Both scenarios fail on PLAN_BASE's sources and pass on HEAD.
- Direct coverage of both sources is 100%; `enable.feature` has no diff.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
