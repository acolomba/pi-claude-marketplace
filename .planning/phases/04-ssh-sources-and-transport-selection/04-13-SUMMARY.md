---
phase: 04-ssh-sources-and-transport-selection
plan: 13
subsystem: marketplace refresh transport notification
tags: [system-git, ssh, notification, marketplace-update, rebaseline, cucumber]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-08: the add's clone note collector, composeMarketplaceCloneLines, the url-arm note, the rebaseline rule and its diff filter; 04-09: refreshCloneBySwap's notes and subject arguments, marketplaceRefreshPlans, features/marketplace/github-refresh.feature"
provides:
  - "marketplace update's blocks (updated, skipped up to date, failed, kept in use) carry the note of the refresh's re-clone as `clone` (orchestrators/marketplace/update.ts)"
  - "one GitHubCloneNotes collector per marketplace refresh, keyed by the marketplace's name"
  - "the background autoupdate pass's debug-log blocks show the same note, with no change to background-pass.ts"
  - "github-refresh.feature states the clone columns; 16 github Outlines split out of update, reserved-name, and git-source features"
affects: [04-14, 04-15, 04-16, 04-17]

actuals:
  tokens: 21957 # chars/4 over the realized diff (87,828 chars, 7 files)
  tasks: 2
  commits: 2
plan_head_before: 63365bf2cfb14c71c712b042ee8d79723cba1a1a
plan_head_after: c6e5f0e40b624b208cc05a64d4561cba73784b7e

tech-stack:
  added: []
  patterns:
    - "A command that refreshes several marketplaces makes one clone-note collector per marketplace refresh, so a same-name marketplace of the other scope never shows another's note"
    - "Every block a refresh reports spreads cloneField(args), so the note follows any status the refresh ends in"

key-files:
  created:
    - .planning/phases/04-ssh-sources-and-transport-selection/04-13-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/marketplace/background-pass.test.ts
    - features/marketplace/github-refresh.feature
    - features/marketplace/update.feature
    - features/marketplace/reserved-name.feature
    - features/marketplace/git-source.feature

key-decisions:
  - "The collector is made in refreshOneMarketplace, once per marketplace refresh, not once per bare update: the subject is the marketplace's name, and a bare update can refresh the same name in both scopes"
  - "Every block the refresh reports carries the note, not only updated and failed: a re-clone whose manifest content did not change reports skipped up to date, and a new clone that could not replace the checkout reports kept; both ran a clone, and D-SG-22 names every GitHub clone's transport. A current refresh and a checkout kept because its remote was unreachable clone nothing and show none"
  - "A refresh whose freshness ls-remote fails still runs its re-clone (04-09, GAUTH-04), so its failed block names the clone it tried"
  - "background-pass.ts is unchanged: the pass notifies through updateMarketplace itself into its silent context, so the debug-log block already carries the note; a pass-level case pins it"

patterns-established:
  - "Rebaseline rule (04-08) applied to refreshes: only clone columns, clone cells, and clone lines change; a github Examples block of a source-kind Outline moves to its own Outline when only its rows get a note"

requirements-completed: [SG-SSH-02]

coverage:
  - id: D1
    description: "a marketplace update that re-cloned a GitHub marketplace names the transport under its block in the terminal and as clone.note and clone.url in JSON"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-22: an owner/repo marketplace refresh that re-clones over ssh names the transport under its updated block"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-22: an owner/repo marketplace refresh that re-clones over ssh puts the clone note on its updated block in JSON"
        status: pass
      - kind: e2e
        ref: "features/marketplace/github-refresh.feature#Updating a github marketplace when the user's ssh authenticates refreshes it over ssh"
        status: pass
    human_judgment: false
  - id: D2
    description: "a refresh whose re-clone fails over both transports names both attempts on its failed block"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-22: an owner/repo marketplace refresh whose re-clone fails over both transports names both attempts above its failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-22: an owner/repo marketplace refresh whose re-clone fails over both transports puts the note and its retry on the failed block in JSON"
        status: pass
      - kind: e2e
        ref: "features/marketplace/github-refresh.feature#A github marketplace refresh whose ssh check finds no repository retries over https"
        status: pass
    human_judgment: false
  - id: D3
    description: "a refresh that finds the checkout current clones nothing and shows no note (OQ-3)"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-22, OQ-3: a current owner/repo marketplace refresh clones nothing and its block has no clone note"
        status: pass
      - kind: e2e
        ref: "features/marketplace/github-refresh.feature#A current github marketplace refresh clones nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "the background autoupdate pass shows the same note on the refreshed marketplace's block"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/background-pass.test.ts#D-SG-22: the debug log of a pass whose refresh re-clones a GitHub marketplace names the transport under its block"
        status: pass
    human_judgment: false
  - id: D5
    description: "every re-baselined scenario differs from its old table only by clone columns or clone cells"
    verification:
      - kind: other
        ref: "git diff -U0 63365bf..HEAD -- features, filtered as in Task 2, plus verify_splits.py over the 16 split Outlines (see Rebaseline audit)"
        status: pass
    human_judgment: true
    rationale: "The diff filter leaves the steps copied into the split github Outlines and the note-value cells; a script compared each copy cell by cell with its original, and a reader confirms the audit"

duration: 50min
completed: 2026-11-25
status: complete
---

# Phase 4 Plan 13: Clone transport in the marketplace refresh notification Summary

**A `marketplace update` that re-clones a GitHub marketplace now names the transport under the marketplace's block, as the add does since 04-08: `Cloning via SSH: <url>`, `Cloning via HTTPS: <url>`, or `SSH not configured, cloning via HTTPS: <url>`, with one `<T1> clone failed, retrying with <T2>: <url>` line per retry, and `clone.note`, `clone.url`, `clone.retries` in JSON. A current refresh clones nothing and shows no note. The background autoupdate pass shows the same block in its debug log. Every marketplace scenario whose refresh re-clones a GitHub marketplace states the note.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-25T21:30Z (approximate; the plan base was recorded before Task 1)
- **Completed:** 2026-11-25T22:20Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (plus this SUMMARY)

## Accomplishments

- `refreshOneMarketplace` makes one `GitHubCloneNotes` collector per marketplace refresh and carries it in `RefreshRunArgs`. `refreshGitSource` passes it to `refreshCloneBySwap` with the marketplace's name as the subject. The swap records only when a re-clone runs, so the freshness check and a current refresh record nothing.
- `cloneField(args)` puts the note on every block the refresh reports: updated (with or without cascade rows), skipped up to date (a re-clone whose manifest content did not change), failed, and kept because the new clone could not replace the checkout. A checkout kept because its remote could not be reached cloned nothing and has none.
- The background pass calls `updateMarketplace` itself, into a silent context whose text goes to the debug log, so its block carries the note with no change to `background-pass.ts`. A new pass-level case pins it.
- `github-refresh.feature` states the clone columns of its four re-cloning scenarios; the current-refresh scenario keeps none.
- 16 github Outlines were split out of `update.feature`, `reserved-name.feature`, and `git-source.feature` and state the note. No code regression was found.

## Task Commits

1. **Task 1: Updating a github marketplace over ssh names the transport in its notification, end to end** (tracer) - `db2c6f5` (feat)
2. **Task 2: Re-baseline `features/marketplace`** - `c6e5f0e` (test)

**Plan metadata:** this SUMMARY commit (docs)

Tracer gate after Task 1: interactive mode (`auto_advance` false), `human_verify_mode` end-of-phase, automated-only verify, so the verify ran again on the committed tree: the two unit files 206 of 206, and `github-refresh.feature` 5 of 5 under the adapter profile ("Tracer verified end-to-end -- expanding").

## TDD Gate Compliance

Task 1 ran RED locally against the plan-base `update.ts`, then GREEN. RED and GREEN went into one `feat` commit, because the commit hook runs typecheck and the architecture tests, so a commit with only failing tests cannot pass it (sandbox note). The committing skill forbids a plan id in a commit scope, so no `test(04-13):` or `feat(04-13):` commit exists. The RED record is in the ignored `.gsd/tdd-evidence/04-13/` directory, which goes with the worktree; the entries below are the durable record.

- **RED (unit, update.ts):** `node --import scripts/isolated-pi-home.mjs --test --test-reporter=tap --test-name-pattern D-SG-22 test/orchestrators/marketplace/update.test.ts` against the plan-base `update.ts`. Exit 1, 6 tests, 5 failed. Target: `D-SG-22: an owner/repo marketplace refresh that re-clones over ssh names the transport under its updated block`. Expected `● official [project] (updated)` then `  Cloning via SSH: git@github.com:anthropics/claude-plugins-official.git`. Actual: the header line only. Classifier: `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the five targets ran and failed on the planned assertion only: the JSON case lacked `clone` on the updated block, both both-failed cases lacked the two note lines or `clone` with `retries`, and the kept-in-use case lacked the note line. The current-refresh case passed at RED; it guards OQ-3 (no note when nothing is cloned).
- **RED (unit, the pass):** `test/orchestrators/marketplace/background-pass.test.ts` with `--test-name-pattern D-SG-22`, the plan-base `update.ts` set aside by `aside.sh`: exit 1, 1 of 1 failed. Expected `[autoupdate] ● tools [project] (updated)\n  Cloning via SSH: git@github.com:acme/tools.git`; actual the header line only.
- **RED (scenarios):** `github-refresh.feature` with its new tables and the plan-base `update.ts`: 4 of 5 failed, each at `the results list these marketplaces and plugins:` (no clone columns). "A current github marketplace refresh clones nothing" passed, as intended.
- **GREEN:** `update.test.ts` 166 of 166 and `background-pass.test.ts` 40 of 40; `github-refresh.feature` 5 of 5; direct coverage of `update.ts` 100% (branches 191/191, functions 31/31, lines 1318/1318).

## Flipped unit cases

The first GREEN run of `update.test.ts` failed 34 existing cases, each only by the clone line under the block (or the `clone` member in JSON) of a refresh that re-cloned. A GitHub source spelled as a URL plans one HTTPS attempt with the `via-https` note and no probe, so most show `  Cloning via HTTPS: https://github.com/anthropics/claude-plugins-official.git`. The two probe-loop cases show the SSH and the "SSH not configured" leads, and a github.com url source shows its own URL (04-08's url arm). The cases now state the line through `HTTPS_CLONE_LINE`; the loops over a current and a re-cloning row (pinned commit, declared-source identity, reserved name) state it only on the re-cloning row. The failures were collected with a TAP diff script that printed each case's `+`/`-` lines, and every one named only the clone line or member.

## Re-baselined scenarios

`features/marketplace/github-refresh.feature` (Task 1, `db2c6f5`): "Updating a github marketplace when the user's ssh authenticates refreshes it over ssh" (`via-ssh`); "A github marketplace refresh whose ssh check finds no repository retries over https" (`via-ssh`, retry `https://github.com/acme/tools.git`); "A github marketplace added over https refreshes over ssh once the user's ssh authenticates" (`via-ssh`); "With CLAUDE_CODE_PLUGIN_PREFER_HTTPS set, a github marketplace refreshes over https with no probe" (`via-https`). "A current github marketplace refresh clones nothing" is unchanged. The feature description gains one line about the note.

`features/marketplace` (Task 2, `c6e5f0e`). Each is a source-kind Outline whose `@github` block moved to an Outline of its own, right after the original, with the same steps, a title that names the clone, and `marketplace clone note` `via-https` and `marketplace clone url` `https://github.com/acme/<repo>.git` on the update's result table (the shared Pi's base override forces one HTTPS clone, OQ-2):

- `update.feature`: "A bare update continues after a marketplace fails" (the failed `zeta` row; `alpha` and `beta` rows get empty cells), "A bare update refreshes the only populated scope", "A changed marketplace refreshes without plugin rows", "Whitespace and object key order do not change a marketplace" (skipped up to date after a re-clone), "An unknown manifest field changes the marketplace", "Reordering a manifest array changes the marketplace", "An isolated dependency entry retains its comparison fields", "Autoupdate off preserves installed versions", "Autoupdate exposes the offered version after a reload", "Autoupdate does not install newly offered plugins", "Autoupdate keeps a plugin removed from the catalog", "A repaired marketplace can be updated again".
- `reserved-name.feature`: "Updating a marketplace whose manifest now declares a reserved name fails with Claude Code's refusal", "Updating a marketplace whose manifest now declares a name Claude Code keeps for itself fails with Claude Code's refusal".
- `git-source.feature`: "Updating a git marketplace whose host now needs a credential fails as authentication required" (2 github rows) and "Updating a git marketplace whose host rejects the stored credential names the rejection" (2 github rows). Their freshness `ls-remote` fails, and the re-clone still runs (04-09, GAUTH-04), so the failed block names the clone it tried.

`device-flow.feature`, which the plan listed, showed no difference in the run, so it is unchanged. No scenario under `features/plugin`, `features/mcp-server`, or any other directory changed.

Regressions fixed in code: none. Every failure of the first `features/marketplace` adapter run (18) differed only by clone columns or cells.

## Rebaseline audit

`git diff -U0 63365bf..HEAD -- features`, filtered with the plan's `grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'`, prints 416 lines, of these kinds only:

- 8 removed lines: the old header and data row of the four `github-refresh.feature` tables that the clone-column tables replace.
- Data rows whose only new cells are note values (`via-https`, `via-ssh`, their URLs) or empty clone cells; the filter's words do not match those values.
- The steps of the 16 split github Outlines. `verify_splits.py` compared each copy with its original cell by cell, after dropping the clone columns: 16 of 16 equal, each original keeps no `@github` block, and each copy holds the original's. The diff of the three Task 2 files is insertions only (452), so the originals are unchanged.

## Verification

All runs are on the final tree (`c6e5f0e`), with `CI=1` where the script prints counts:

- `npm run test:modules`: 19852 of 19852 passed (`dispatch-exec.test.ts:39` passed too).
- `npm run test:integration`: 236 of 236 passed.
- Cucumber, adapter profile, whole suite (`features`): 2371 of 2376 scenarios, 29877 of 29887 steps. The 5 failures are the known `fd` baselines in `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834).
- Cucumber, builtin profile, whole suite: 260 of 260 scenarios (3576 steps).
- `npm run check:features`: passed, 2485 scenarios and 510 step definitions. `npm run check:static`: exit 0.
- Owner tests plus the two whole-tree files before each commit: `update.test.ts`, `background-pass.test.ts`, `test/orchestrators/plugin/bootstrap.test.ts`, `test/edge/register.test.ts`, and `test/edge/handlers/marketplace/update.test.ts`, 578 of 578.
- Task 1 acceptance: `clone note` appears 4 times in `github-refresh.feature` (needed at least 1); `GitHubCloneNotes`/`createGitHubCloneNotes` appear on 3 lines of `update.ts` (needed at least 1); direct coverage of `update.ts` is 100%.
- Task 2 acceptance: the audit above; every suite passes apart from the listed baselines.
- `check:commit` (which includes `check:static`) ran in each commit's hook and passed. No `--no-verify` was used.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`: `RefreshRunArgs`, `cloneField`, the collector in `refreshOneMarketplace`, `notes` and `subject` to `refreshCloneBySwap`, and `clone` on every block.
- `test/orchestrators/marketplace/update.test.ts`: six D-SG-22 cases (updated text and JSON, current, both-failed text and JSON, kept in use), the helpers `changedManifestGitOps`, `makeJsonCtx`, `marketplaceClones`, `HTTPS_CLONE_LINE`, and the 34 flipped cases.
- `test/orchestrators/marketplace/background-pass.test.ts`: one D-SG-22 pass case with a real `updateMarketplace` over a fake git port and an authenticated probe.
- `features/marketplace/github-refresh.feature`, `update.feature`, `reserved-name.feature`, `git-source.feature`.

`extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts` is in the plan's `files_modified` but is unchanged (see Decisions). All changed files are in the plan's list.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Scope adjustments

**1. The note is on every block of a refresh that cloned, not only the updated and failed ones**
- The plan's behavior list names the updated and failed blocks. A re-clone whose manifest content did not change reports `(skipped) {up-to-date}`, and a new clone that could not replace the checkout reports the kept block. Both ran a clone, and D-SG-22 names the transport of every GitHub clone, so both carry the note. The current refresh and the kept-unreachable checkout ran none and show none, so the "no note for a refresh that ran no clone" prohibition holds. Unit cases pin the kept-in-use and the current cases; "Whitespace and object key order do not change a github marketplace..." pins the skipped one.

**2. `background-pass.ts` is unchanged**
- The pass builds no marketplace block. It calls `updateMarketplace` with its silent context, and the block that `update.ts` composes, note included, goes to the debug log. A pass-level case in `background-pass.test.ts` pins it.

**3. The commits are a `feat` and a `test` commit per task, with RED and GREEN together**
- See TDD Gate Compliance.

**4. `device-flow.feature` unchanged; Task 2 had one feature directory to commit**
- The plan's file list was measured from the When lines. The run is the authority: only `features/marketplace` differed.

---

**Total deviations:** 4 scope adjustments, no auto-fixed bug. **Impact:** none beyond the plan's intent; no file outside `files_modified`.

## Issues Encountered

- The worktree harness refuses command text that names paths with `git` in them (`github-refresh.feature`, `git-source.feature`) or chains several commands. Checks, RED set-asides, the table edits, the audit, and commits ran from scripts in the scratch directory (`unit.sh`, `aside.sh`, `cuke.sh`, `cuke-aside.sh`, `cuke-profile.sh`, `patch_update_test.py`, `patch_refresh_feature.py`, `rebaseline.py`, `verify_splits.py`, `difffilter.sh`, `commit.sh`). Commits ran with hooks through `setpriv`.
- The worktree had no optional-peer cache, so `node scripts/install-test-peers.mjs` installed it.
- The first table-edit pass stopped at an Outline with three `marketplace name` tables; the tool gained an index for the update's table, and the remaining operations ran. No cucumber `ENOTEMPTY` flake occurred.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-40: the note's URL comes from the transport plan in github.com terms (GHB-04); under the base override the cases and scenarios show `https://github.com/...`, never the override host, and the JSON form goes through 04-02's closed `clone` wire object (`capture.assertValid()` in the JSON cases). T-04-41: the rebaseline rule, the diff filter, and the split verifier above. T-04-SC: no package was added.

## Orchestrator actions

The plan asks for no `gsd-tools windows append`. Nothing to record on the ledger.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04-14 to 04-17 can re-baseline under the same rule and tools. 04-15 owns the PUP-2 sync's note (`syncMarketplaceBySwap` still passes no `notes` or `subject`, as this plan's prohibition requires).

## Self-Check: PASSED

- The modified files exist, and this SUMMARY is at `.planning/phases/04-ssh-sources-and-transport-selection/04-13-SUMMARY.md`.
- Commits `db2c6f5` and `c6e5f0e` are ancestors of HEAD; `git rev-list --count 63365bf..HEAD` is 2 before this SUMMARY commit.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-25*
