---
phase: 04-ssh-sources-and-transport-selection
plan: 16
subsystem: fetch, info --fetch, and enable transport notification
tags: [system-git, ssh, notification, fetch, info, enable, rebaseline, cucumber]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-12: the fetch, info --fetch, and enable transport contexts and pluginCloneTransport; 04-14: withCloneNote and the rebaseline tools; 04-15: the update and reinstall rows; 04-02: the clone member on the cascade row types, its wire, JSON, and text forms (the plugin-info row left to this plan); 04-08: the rebaseline rule and its diff filter"
provides:
  - "withOwnCloneNotes(context) in orchestrators/github-transport.ts: a context view with its own collector that also hands each note to the context's"
  - "withFetchCloneNote(row, notes, subject) in fetch.messaging.ts; each fetched target clones over its own view, and its fetched or failed row names that clone"
  - "PluginInfoRowBase.clone?: CloneTransportNote, with the wire member, JSON projection, text lines, regenerated schema, and docs line"
  - "withInfoCloneNote(message, notes, subject) in info.messaging.ts; buildScopeBlock in info.ts gives each scope of an info --fetch its own view"
  - "composeEnableCascadeRows(..., clones?): the enable root row reads its <plugin>@<marketplace> note, each re-enabled member row its key's"
affects: [04-17, 04-18]

actuals:
  tokens: 25228 # chars/4 over the realized diff (100,912 chars, 27 files)
  tasks: 3
  commits: 4
plan_head_before: c671c79b9ab448835e437ad81bf8cdd5b1c904a3
plan_head_after: 88760c7c6346d227baffbd831f63c6f65c99268f

tech-stack:
  added: []
  patterns:
    - "A command that can clone one <plugin>@<marketplace> in both scopes gives each target or scope a withOwnCloneNotes view, so a row reads only the note of its own clone while the command's collector still receives every note"
    - "A row composer reads its note at composition time by subject; only the row types with a clone field take one (remote and skipped rows never do)"

key-files:
  created:
    - .planning/phases/04-ssh-sources-and-transport-selection/04-16-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md
    - test/orchestrators/github-transport.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - test/orchestrators/plugin/fetch.messaging.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/info.messaging.test.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/enable-disable.messaging.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-json.test.ts
    - test/shared/notification-types.test.ts
    - features/plugin/github-transport-update.feature
    - features/plugin/fetch.feature
    - features/plugin/info.feature
    - features/mcp-server/verdict-fetch.feature

key-decisions:
  - "Each fetch target and each info --fetch scope clones over its own withOwnCloneNotes view of the command's context. The subject is <plugin>@<marketplace> in both scopes, so a shared collector would give a scope that cloned nothing the other scope's note (info builds both scopes in parallel). The view also hands each note to the command's collector, keeps the context's checks, and reads its force lazily (NFR-5: the context's force is a getter, so the view does not spread it)"
  - "The plugin-info row gains the clone member (04-02 left it to this plan): optional on PluginInfoRowBase, closed CLONE object on PLUGIN_INFO_ROW_FIELDS, wireClone in the JSON projection, the lines under the row after the description and before the components, the regenerated schema, and one row in docs/json-output.md"
  - "The enable rows read the note in dispatchOutcome through composeEnableCascadeRows's clones argument: the root by <plugin>@<marketplace>, each member by its row name, which is its key. withEnableCloneNote stays module-private (fallow: no production consumer outside the module)"
  - "Remote and skipped rows take no note: their types have no clone field. A failed fetch, info, or enable row names each attempt of the clone it tried"

patterns-established:
  - "Rebaseline rule (04-08) applied to fetch, info --fetch, and enable: only clone columns, clone cells, and plugin clone fields change; a fields table that gains the two clone fields is re-padded with its names and values unchanged"

requirements-completed: [SG-SSH-04, SG-SSH-02]

coverage:
  - id: D1
    description: "plugin fetch names the transport of each GitHub clone under the fetched or failed row of the plugin that cloned, in the terminal and as clone.note/url/retries in JSON; a warm or current clone names nothing"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#D-SG-22: a fetch that clones a github plugin names the transport under its row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#D-SG-22: a fetch whose github clone fails names each attempt under its failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#D-SG-22, OQ-3: a fetch that finds its github mirror current names no clone"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport-update.feature#Fetching a github plugin with no ssh setting clones it over https first"
        status: pass
    human_judgment: false
  - id: D2
    description: "info --fetch names the transport of the clone each scope ran under that scope's row (text, and plugin.clone in JSON); a warm pinned clone names nothing"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#D-SG-22: info --fetch that clones a github plugin names the transport under its row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#D-SG-22, OQ-3: info --fetch of a github plugin whose pinned clone is warm names no clone"
        status: pass
      - kind: unit
        ref: "test/shared/notification-json.test.ts#D-SG-22: carries an info row's clone note and copies its retries"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport-update.feature#Info with --fetch on a github plugin with no ssh setting clones it over https first"
        status: pass
    human_judgment: false
  - id: D3
    description: "the same plugin fetched or read with --fetch in both scopes names each clone under its own scope's row only"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#D-SG-22: a sweep of one plugin in two scopes names each clone under its own scope's row only"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#D-SG-22: info --fetch over both scopes names each clone under its own scope's row only"
        status: pass
      - kind: unit
        ref: "test/orchestrators/github-transport.test.ts#D-SG-22: keeps the notes recorded through the view apart and hands each to the context"
        status: pass
    human_judgment: false
  - id: D4
    description: "an enable that re-clones names its clone on the enable row and each re-enabled member's clone on the member's row; an enable over kept clones names nothing; a failed enable names each attempt"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose root and a re-enabled member re-clone names each clone under its own row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22, OQ-3: an enable over kept clones names no clone"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-SG-22: an enable whose re-clone fails names each attempt under its failed row"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport-update.feature#Enabling a github plugin whose clone is gone falls back to https for a user with no ssh key"
        status: pass
    human_judgment: false
  - id: D5
    description: "every re-baselined scenario differs from its old table only by clone columns, clone cells, or plugin clone fields"
    verification:
      - kind: other
        ref: "git diff -U0 c671c79..HEAD -- features, filtered as in Task 3, plus verify_rebase.py over every hunk (see Rebaseline audit)"
        status: pass
    human_judgment: true
    rationale: "The filter leaves the re-padded fields rows and the note-value cells; a script compared every hunk with clone data dropped, and a reader confirms the audit"

duration: 68min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 16: Clone transport on the fetch, info --fetch, and enable rows Summary

**`/claude:plugin fetch`, `/claude:plugin info --fetch`, and `/claude:plugin enable` now name the transport of every GitHub clone they run, on the row of the plugin that cloned: `Cloning via SSH: <url>`, `Cloning via HTTPS: <url>`, or `SSH not configured, cloning via HTTPS: <url>`, plus one retry line per retry, and `clone.note`/`clone.url`/`clone.retries` in JSON. The plugin-info row gains the `clone` member for this. An enable's re-enabled dependencies name their own clones. A plugin fetched or read in both scopes names each scope's clone under that scope's row only. A warm or current clone, a kept clone, and a bare info name nothing. With 04-15, D-SG-22 now holds for every update-family and fetch verb.**

## Performance

- **Duration:** 68 min
- **Started:** 2026-11-26T01:28:53Z
- **Completed:** 2026-11-26T02:37:04Z
- **Tasks:** 3 of 3
- **Files modified:** 27 (plus this SUMMARY)

## Accomplishments

- `orchestrators/github-transport.ts`: `withOwnCloneNotes(context)` gives a context view whose collector keeps its own notes and hands each one to the context's collector. The view shares the checks and the platform and reads the force only when a clone asks for it.
- `fetch.ts`: each git target clones over its own view, and `withFetchCloneNote` (`fetch.messaging.ts`) puts the target's note on its fetched row and on its failed row.
- `info.ts`: `buildScopeBlock` builds one scope's block (shared by the single-scope and fan-out paths). Under `--fetch` each scope clones over its own view, and `withInfoCloneNote` (`info.messaging.ts`) puts the scope's note on its row.
- `shared/notification-{types,wire,json,grammar}.ts`: `clone` on the plugin-info row, its closed wire object, its JSON projection, and its lines under the row (after the description, before the components). The schema is regenerated, and `docs/json-output.md` lists the field.
- `enable-disable.ts` and `enable-disable.messaging.ts`: `dispatchOutcome` passes the command's notes to `composeEnableCascadeRows`, which gives the root row its `<plugin>@<marketplace>` note and each installed member row its key's note.
- The fetch, info --fetch, and enable scenarios of `github-transport-update.feature` state the clone columns, and 10 more scenario runs in three feature files were re-baselined.

## Task Commits

1. **Task 1: Fetching a github plugin names the transport on its row, and info --fetch names it too, end to end** (tracer) - `19bb2bf` (feat)
2. **Task 2: Enabling a github plugin that re-clones names the transport on its row** - `b665ce5` (feat)
3. **Task 3: Re-baseline `features/plugin`** - `d982f3c` (test)
4. **Task 3: Re-baseline `features/mcp-server`** - `88760c7` (test)

**Plan metadata:** this SUMMARY commit (docs)

Tracer gate after Task 1: interactive (`auto_advance` off), `human_verify_mode` end-of-phase, automated-only verify. The verify ran again on the committed tree: the four plan unit files 374 of 374, and "Fetching a github plugin with no ssh setting clones it over https first" 1 of 1 under adapter ("Tracer verified end-to-end -- expanding").

## TDD Gate Compliance

Tasks 1 and 2 ran RED locally, then GREEN. RED and GREEN went into one `feat` commit per task, because the commit hook runs typecheck and the architecture tests, so a commit with only failing tests cannot pass it (sandbox note). The committing skill forbids a plan id in a commit scope, so no `test(04-16):` or `feat(04-16):` commit exists. The records are in the ignored `.gsd/tdd-evidence/04-16/` directory, which goes with the worktree; the entries below are the durable record.

- **RED (fetch):** `node --import scripts/isolated-pi-home.mjs --test --test-reporter=tap --test-name-pattern D-SG-22 test/orchestrators/plugin/fetch.test.ts`, with the new cases and the plan-base sources: exit 1, 4 tests, 3 failed. Target: `D-SG-22: a fetch that clones a github plugin names the transport under its row`. Expected the available row, then `    SSH not configured, cloning via HTTPS: https://github.com/acme/ghp.git`. Actual: the available row alone. Classifier: `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed on the missing clone line only. The failed-clone case lacked both the first-attempt and the retry line. The two-scope case lacked the project row's line; its user row (no note) already matched. The current-mirror case passed at RED; it guards OQ-3.
- **RED (info):** `--test-name-pattern D-SG-22 test/orchestrators/plugin/info.test.ts`: exit 1, 3 tests, 2 failed. Target: `D-SG-22: info --fetch that clones a github plugin names the transport under its row`. Expected the row, the clone line, then `skills: fetched-skill`. Actual: no clone line. Classifier: `RED_EVIDENCE_OK`. Semantic assessment: both failing cases failed only on the missing clone line. The warm-clone case passed at RED; it guards the no-note rule.
- **RED (enable):** `--test-name-pattern D-SG-22 test/orchestrators/plugin/enable-disable.test.ts`: exit 1, 4 tests, 3 failed. Target: `D-SG-22: an enable whose root and a re-enabled member re-clone names each clone under its own row`. Actual: both installed rows with no clone line. Classifier: `RED_EVIDENCE_OK`. Semantic assessment: the root, failed-row, and given-context cases each failed only on missing clone lines. The kept-clone case passed at RED; it guards OQ-3.
- **RED (scenarios):** with the Task 1 sources set back to `c671c79`, `github-transport-update.feature` ran 8 scenarios, 2 failed: the fetch scenario at `the result lists these plugins:` and the info scenario at `the result has these fields:`. With `enable-disable.ts` and its messaging module set back to `19bb2bf`, the enable scenario failed at `the result lists these plugins:` (Task 2's acceptance criterion).
- **New API:** the `withOwnCloneNotes`, `withFetchCloneNote`, `withInfoCloneNote`, and `composeEnableCascadeRows` clones cases import exports or arguments the plan base lacks, so they fail at load there. They were not offered to the classifier.
- **GREEN:** Task 1 owner files plus `bootstrap.test.ts`, `test/edge/register.test.ts`, and `test/architecture/*`: all passed (357 fetch and info, 61 transport and messaging, 439 shared notification, 1259 architecture and whole-tree). Task 2: 241 of 241 in the enable owner files, 1259 of 1259 in the whole-tree files. Direct coverage 100% (branches, functions, lines): `github-transport.ts` (64/64, 32/32, 415/415), `fetch.ts` (96/96, 19/19, 669/669), `fetch.messaging.ts` (5/5, 1/1, 62/62), `info.ts` (552/552, 134/134, 3859/3859), `info.messaging.ts` (5/5, 1/1, 70/70), `notification-grammar.ts` (266/266, 63/63, 1505/1505), `notification-json.ts` (247/247, 55/55, 791/791), `notification-wire.ts` (4/4, 3/3, 994/994), `notification-types.ts` (32/32, 6/6, 1900/1900), `enable-disable.ts` (354/354, 77/77, 3431/3431), `enable-disable.messaging.ts` (39/39, 10/10, 258/258).

## Rebaseline rule

As 04-08: a re-baselined scenario may change only clone columns (`clone note`, `clone url`, `clone retries`), clone cells, and, for an info result, the `plugin clone note` and `plugin clone url` fields. Any other difference is a regression to fix in the code. The shared Pi's base override forces one HTTPS clone, so a fetch or info --fetch in the shared Pi shows `via-https` with `https://github.com/acme/ghp.git`. The `github-transport-update.feature` scenarios deny ssh, so they show `ssh-not-configured`.

## Re-baselined scenarios

`features/plugin/github-transport-update.feature` (Tasks 1 and 2, `19bb2bf`, `b665ce5`): "Fetching a github plugin with no ssh setting clones it over https first" (`ssh-not-configured`); "Info with --fetch on a github plugin with no ssh setting clones it over https first" (`plugin clone note` `ssh-not-configured`); "Enabling a github plugin whose clone is gone falls back to https for a user with no ssh key" (`ssh-not-configured`). The feature description gains one sentence about the note.

`features/plugin` (Task 3, `d982f3c`):

- `fetch.feature`: "Fetching a git-source plugin downloads its new revision from the git host"; "Fetching a git-source plugin whose mirror cannot be moved aside fails as permission denied, and the next fetch replaces it" (both tables: the failed fetch's re-clone ran before the move-aside failed, and the next fetch re-clones); "A fetch leaves the installed plugin running the revision it installed until an update"; "Fetching a marketplace fetches each git-source plugin and reports the one the git host refuses" (the refused `ghp` row names the clone it tried; the `demo` and `urlp` rows get empty cells); "A bare fetch continues through every marketplace after one plugin fails" (same).
- `info.feature`: "Info with --fetch reads the plugin repository and reports its new revision"; "Info with --fetch on an installed plugin shows the installed revision after the repository moves"; "Info with --fetch on a plugin never fetched clones its repository with one request round"; "Info with --fetch on a plugin the git host answers with 404 names it source missing" (the `remote` row names the clone it tried).

`features/mcp-server` (Task 3, `88760c7`): `verdict-fetch.feature`: "Fetching a plugin whose new revision declares an sse server reports it available, under pi-mcp-adapter (P3-DC-25)" (adapter profile) and "Fetching a plugin whose new revision declares an sse server reports it partially available, under Pi's built-in MCP (P3-DC-25)" (builtin profile).

Listed in the plan but unchanged, because the run showed no difference: `features/plugin/git-source.feature`. No enable scenario outside `github-transport-update.feature` changed. Regressions fixed in code: none; every non-baseline failure of the first whole adapter run (10 scenario runs) and of the builtin run (1) differed only by clone data.

## Rebaseline audit

`git diff -U0 c671c79..HEAD -- features`, filtered with the plan's `grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'`, prints 160 lines, of these kinds only:

- Old header and data lines that the clone-column tables replace (a removed line prints when its replacement holds `clone`).
- Data rows whose only new cells are note values (`via-https`, `ssh-not-configured`, their URL) or empty clone cells.
- The old and new rows of the five info fields tables (four in `info.feature`, one in `github-transport-update.feature`), which the long `plugin clone url` value widened: each keeps its names and values, padded wider. These are not header or separator lines, so they are listed here by the plan's acceptance rule.

`verify_rebase.py` (scratch) parsed every hunk, dropped the clone columns and the plugin clone fields, and stripped cell padding: 15 of 15 hunks equal on both sides. The one non-table change is the `github-transport-update.feature` description sentence.

## Verification

All runs are on the final tree (`88760c7`), with `CI=1`:

- `npm run test:modules`: 19948 of 19948 passed (`dispatch-exec.test.ts:39` passed too).
- `npm run test:integration`: 236 of 236 passed.
- Cucumber, adapter, whole suite (`features`): 2384 scenarios, 2379 passed, 5 failed: the 5 known `fd` baselines in `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834). 30017 steps.
- Cucumber, builtin, whole suite: 260 of 260 scenarios (3576 steps).
- `npm run check:features`: passed, 2493 scenarios and 510 step definitions. `check:static` ran in each commit's hook (`check:commit`) and passed.
- Task 1 acceptance: direct coverage of every changed source is 100% (above); `npm run schema:generate` after the commit leaves `schema/` unchanged.
- Task 2 acceptance: the enable scenario states `clone note` and failed on the tree before the task; direct coverage of `enable-disable.ts` and `enable-disable.messaging.ts` is 100%.
- Task 3 acceptance: the audit above; every suite passes apart from the listed baselines.
- No `--no-verify` was used.

## Files Created/Modified

- `orchestrators/github-transport.ts`: `withOwnCloneNotes` (outside `files_modified`, see Deviations).
- `orchestrators/plugin/fetch.ts`, `fetch.messaging.ts`: the per-target view, `withFetchCloneNote`, the note on the fetched and failed rows.
- `orchestrators/plugin/info.ts`, `info.messaging.ts`: `buildScopeBlock`, the per-scope view, `withInfoCloneNote`.
- `orchestrators/plugin/enable-disable.ts`, `enable-disable.messaging.ts`: the notes in `dispatchOutcome`, the `clones` argument, module-private `withEnableCloneNote`.
- `shared/notification-{types,wire,json,grammar}.ts`, `schema/claude-plugin.schema.json`, `docs/json-output.md`: the plugin-info row's `clone`.
- Tests: the six plan test files, plus `test/orchestrators/github-transport.test.ts` and `test/shared/notification-{grammar,json,types}.test.ts`. The 04-12 `sharesNotes` check in `fetch.test.ts` and `info.test.ts` now records a note through the transport under a subject no row reads and checks that it reaches the command's collector, since a transport's collector is now a view. The fetch Device Flow case ("materializes a cold unpinned GitHub mirror through Device Flow once per host") now states the clone line its clone produces.
- The five feature files listed above.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] One subject in two scopes shared one note**
- **Found during:** Task 1
- **Issue:** fetch and info --fetch note every clone under `<plugin>@<marketplace>`, which is the same in both scopes. A fetch without `--scope` (and info, which builds both scopes in parallel) would show one scope's note on the other scope's row when only one scope cloned.
- **Fix:** `withOwnCloneNotes` in `orchestrators/github-transport.ts` (outside `files_modified`), with its owner test; each fetch target and each info scope clones over its own view.
- **Verification:** the two two-scope unit cases; the info case holds the user scope's row until the project scope's clone has noted, so the case fails without the view.
- **Committed in:** `19bb2bf`

**2. [Rule 1 - Expected output] Existing cases that ran a GitHub clone now state its note**
- **Found during:** Task 1
- **Issue:** the fetch Device Flow case cloned `acme/plugin` over GitHub, and the 04-12 `sharesNotes` checks compared collector identity, which a view changes.
- **Fix:** the Device Flow case states its clone line; `sharesNotes` checks that a note reaches the command's collector.
- **Committed in:** `19bb2bf`

**3. [Rule 3 - Blocking] Two commits failed the hook and were retried**
- **Issue:** Task 1: ESLint `import-x/order` and a padding line in two test files (fixed with `eslint --fix`). Task 2: typecheck (two literal notes without `as const`, two installed rows without `dependencies`) and fallow's unused export (`withEnableCloneNote` had no consumer outside its module; it is now private, and its cases go through `composeEnableCascadeRows`).
- **Committed in:** `19bb2bf`, `b665ce5`

### Scope adjustments

**4. The shared notification files changed.** 04-02 left the plugin-info row to this plan, so Task 1 added `clone` there as the plan's action 2 asks, with `docs/json-output.md`.

**5. The run decided the feature list.** `git-source.feature` (listed) did not change.

**6. No REFACTOR commit, and the commits pair RED with GREEN** (see TDD Gate Compliance).

---

**Total deviations:** 3 auto-fixed (2 bugs or expected output, 1 blocking) and 3 scope adjustments. **Impact:** no scope creep; the extra source file is named above.

## Deferred Issues

- **A failing enable cascade member's clone shows no note.** When a re-enabled dependency's re-clone fails, the enable reports the root's failed row, which reads the root's note; the member that cloned has no row.
- **A transaction-level enable failure shows no note.** A throw after the ledger (for example a failed state save) reports a brace-less failed row composed apart from `dispatchOutcome`, which reads no notes.
- **A fetch row that stays `remote` after a clone shows no note.** `PluginRemoteMessage` has no `clone` field; the case needs a clone that leaves the cache cold.

## Issues Encountered

- The worktree harness refuses command text that names paths with `git` in them (`github-transport`, `git-source`) or chains several commands, so edits, RED runs, cucumber runs, coverage, the audit, and commits ran from scripts in the scratch directory (`edit_*.py`, `t.sh`, `cov.sh`, `cov-t1.sh`, `cov-t2.sh`, `cuke.sh`, `cuke-ght.sh`, `cuke-red-t1.sh`, `cuke-red-t2.sh`, `rebase.py`, `fields_rebase.py`, `verify_rebase.py`, `difffilter.sh`, `suites.sh`, `commit.sh`). Commits ran with hooks through `setpriv`.
- The worktree had no optional-peer cache, so `node scripts/install-test-peers.mjs` installed it.
- No cucumber `ENOTEMPTY` flake and no container restart occurred.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-46: the plugin-info `clone` member is optional and uses 04-02's closed `CLONE` object under `additionalProperties: false`; the schema is regenerated and the schema and docs tests pass. T-04-58: the note's URL comes from the transport plan in github.com terms (GHB-04); under the base override every case and scenario shows `https://github.com/...`, and each row reads only its own subject's note in its own scope. T-04-59: the rebaseline rule, the diff filter, and the hunk verifier above. T-04-SC: no package was added.

## Orchestrator actions

The plan asks for no `gsd-tools windows append`. If the orchestrator records the deferred issues on the ledger, these are the commands:

```bash
gsd-tools windows append --kind deviation --phase 04 --file extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts --description "[system-git] A failing enable cascade member's re-clone shows no clone note: the enable reports only the root's failed row (D-SG-22)"
gsd-tools windows append --kind deviation --phase 04 --file extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts --description "[system-git] An enable that fails after its ledger (a transaction-level throw) shows no clone note on its failed row (D-SG-22)"
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04-17 (apply, import) can pass one context per run; an orchestrated enable composes no rows here, so 04-17 reads the run's notes onto its own rows. A command that can clone one plugin in both scopes should give each scope a `withOwnCloneNotes` view, as fetch and info do.

## Self-Check: PASSED

- The modified files exist, and this SUMMARY is at `.planning/phases/04-ssh-sources-and-transport-selection/04-16-SUMMARY.md`.
- Commits `19bb2bf`, `b665ce5`, `d982f3c`, and `88760c7` are ancestors of HEAD; `git rev-list --count c671c79..HEAD` is 4 before this SUMMARY commit.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
