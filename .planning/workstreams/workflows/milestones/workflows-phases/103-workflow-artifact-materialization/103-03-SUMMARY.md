---
phase: 103-workflow-artifact-materialization
plan: 03
subsystem: bridges
tags: [workflows, soft-fail, warnings, state-schema, migration, install-record]
status: complete

requires:
  - bridges/workflows/discover.ts (discoverPluginWorkflows, the warnings channel)
  - domain/workflow-script.ts (the skipped and refused verdict reasons)
  - InstallCtx.stagedWorkflowNames (populated by the workflows ledger phase)
provides:
  - the read-failure / skipped / refused warning builders in bridges/workflows/discover.ts
  - resources.workflows on PLUGIN_INSTALL_RECORD_SCHEMA (required string array)
  - the workflows arm of the migration default-fill
  - the sixth term of the resources-changed disjunction
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - 31 test suites that build a plugin install record literal

tech-stack:
  added: []
  patterns:
    - one message shape per soft-fail arm, rendering the decision layer's own reason
    - additive required schema member paired with a default-fill that runs before validation
    - a keyed list in place of byte-identical default-fill arms

key-files:
  created:
    - tests/bridges/workflows/discover.test.ts
    - tests/bridges/_fixtures/workflows-plugin/workflows/helpers.js
    - tests/bridges/_fixtures/workflows-plugin/workflows/broken.js
    - tests/bridges/_fixtures/workflows-plugin/workflows/stamped.workflow.js
  modified:
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/persistence/migrate.ts
    - tests/persistence/migrate.test.ts
    - tests/orchestrators/plugin/install-workflows.test.ts
    - .prettierignore

decisions:
  - Reinstall carries the recorded workflow inventory forward verbatim rather than recording an empty array, because it re-materializes five kinds and leaves the envelopes on disk
  - The four byte-identical default-fill arms became one keyed list, because a fifth arm exceeded the caller's cognitive-complexity budget
  - The three soft-fail fixture scripts are checked in beside the well-formed one, so a reviewer reads them as the artifacts a real plugin ships

requirements: [WBRG-03, WLIF-01, WNAM-05]

metrics:
  duration: ~1h45m
  completed: 2026-08-15

estimate:
  tokens: 58000
  tasks: 2
actuals:
  tokens: 23765
  tasks: 2
  commits: 4
---

# Phase 103 Plan 03: Workflow soft-fails and the install record Summary

A plugin whose workflow directory carries a helper module, a broken draft and a comment
that trips the engine's raw-text gate now installs its real workflows and reports each of
the others by file name, while two scripts fighting over one name still fail the whole
install — and every install records the names it wrote.

## What Was Built

**The soft-fail warnings.** `bridges/workflows/discover.ts` gained one builder per arm —
read failure, skipped, refused — all three composing the same message shape: the file
name, the containing directory, then the verdict's own reason text verbatim. Nothing is
paraphrased. The decision layer is where a raw-text blocklist match is attributed to code,
to a comment or to a literal, and restating it here would reintroduce the misattribution
that layer exists to remove. A test asserts a comment mention never renders as a call.

**The routing was already correct.** The tracer wired `prep.result.warnings` onto
`InstallCtx.bridgeWarnings` in the same shape as the mcp phase, so this plan asserted that
path rather than rebuilding it.

**The sixth disjunction term.** `stagedWorkflowNames.length > 0` joined the
resources-changed predicate. The "preserved verbatim" comment above it now says what it
means: preserve the SEMANTICS — did this install materialize anything — not the arity. A
plugin shipping only workflows previously installed and reported `resourcesChanged: false`,
which the bulk-import cascade reads structurally and the reload hint keys on.

**The install record's sixth inventory.** `resources.workflows` is a required string array
on the record schema, filled by the migration before validation runs. Its comment in
`install.ts` says why it matters more than the other five: the other kinds live under a
scope root a cleanup pass can sweep, while workflow envelopes live in the host engine's
storage root, outside every scope root. Nothing else on disk records that they exist.

## Key Implementation Notes

**The default-fill arms collapsed into a list.** `ensurePluginResources` carried three
`if (resources.X === undefined)` arms; a fourth pushed it from 15 to 17 on the
cognitive-complexity gate. The arms differed only in the key, so they became
`DEFAULT_FILLED_RESOURCE_KEYS` iterated by an extracted helper. The comment records that
`skills` and `prompts` are deliberately absent: they predate the migration and every record
that has ever existed carries them.

**Reinstall does not erase what it did not touch.** Making the member required surfaced two
production sites in `reinstall.ts`. `resourcesFromHandles` builds the post-reinstall record
from the prepared handles of five kinds; workflows are not among them, and reinstall leaves
the envelopes on disk. Writing `[]` there would orphan files that still exist — the exact
repudiation the record is meant to prevent — so the previous inventory is now passed in and
carried forward verbatim. `clonePluginRecord` enumerates fields rather than spreading, and
its own comment warns that an omission drops the key silently, so it clones the new array
too.

**Inducing a read failure needs `chmod`, not a directory.** The plan suggested placing a
directory where a script file is expected. That does not work: `isWorkflowScriptFile` tests
`entry.isFile()` before reading, so a directory named `broken.js` is filtered out with no
warning at all. The case uses the `chmod 0o000` pattern already established in
`tests/bridges/commands/stage.test.ts`, with its two skip guards (Windows, root).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Reinstall carries the workflow inventory forward**

- **Found during:** Task 2, Step A — the schema change surfaced it as a type error
- **Issue:** `resourcesFromHandles` had no source for the new member. Filling `[]` was the
  path of least resistance and would have recorded "this plugin has no workflows" for a
  plugin whose envelopes are still on disk, one command after they were written.
- **Fix:** The previous inventory is a parameter now, carried forward verbatim, with a doc
  comment stating why. `clonePluginRecord` clones it as well.
- **Files modified:** `orchestrators/plugin/reinstall.ts`
- **Commit:** 09736c34

**2. [Rule 3 - Blocking] The default-fill arms were collapsed rather than extended**

- **Found during:** Task 2, Step B
- **Issue:** The plan says to copy the most recent arm exactly. Doing so raised
  `ensurePluginResources` to a cognitive complexity of 17 against a limit of 15, and lint is
  part of the task's own verify.
- **Fix:** The four arms became one keyed list iterated by an extracted helper. Behaviour
  and the mutation-report contract are unchanged; the existing arms' rationale moved into
  the list's doc comment.
- **Files modified:** `persistence/migrate.ts`
- **Commit:** 09736c34

**3. [Rule 3 - Blocking] The unparseable fixture needed a prettier exclusion**

- **Found during:** Task 1, Step D
- **Issue:** `npm run format:check` and the prettier hook both cover `**/*.js`, and a file
  that exists to be unparseable cannot be parsed by a formatter either.
- **Fix:** One narrow `.prettierignore` entry for that single file, following the
  invalid-manifest JSON precedent already in the file. The other two fixture scripts are
  well-formed and stay formatted.
- **Files modified:** `.prettierignore`
- **Commit:** 77830a17

### Acceptance criterion not met literally

`node --test tests/persistence/state-io.test.ts` passes, but NOT unedited. Making
`resources.workflows` required means every record fixture in that file must carry it,
including the validator-acceptance fixtures whose whole point is "this shape loads". Four
of its cases fail without the edit, for a reason none of them is about. The same is true
across the suite: 31 test files build a plugin install record literal, and all of them
gained the member. That is what "additive required member" costs, and the `hooks` precedent
paid it the same way.

Two fixture shapes gained a populated value rather than an empty one, so the assertions
still have teeth: `toDisabledRecord`'s "preserves every resources array" case now seeds
`workflows: ["w"]` and expects it back.

### Non-vacuity reasoning for the default-fill

The plan asks for confirmation that removing the fill arm turns the pre-change-fixture load
case red, by reasoning rather than by leaving the fill out.

The case writes a complete `schemaVersion: 2` state file whose one plugin record carries the
five older inventories and no `workflows` key, then calls `loadState`. `loadState` runs
`migrateLegacyMarketplaceRecords` and only afterwards calls `STATE_VALIDATOR.Check`, which
throws `state.json ... failed schema validation` on a missing required member. With the
`workflows` entry removed from `DEFAULT_FILLED_RESOURCE_KEYS`, nothing supplies the key
between those two steps, so the validator sees the fixture exactly as written and the call
rejects — the case's `await loadState(dir)` throws before its assertion runs.

This was observed rather than only reasoned about, in the opposite direction: the case was
red for precisely that reason during the RED run, with the error
`must have required properties workflows`, and the same message appeared at `saveState` in
24 unrelated suites until their fixtures gained the member.

## Carried-Forward Limitation: the standalone-surface visibility gap

**This is not closed, and nothing in this plan claims it is.**

Per-file workflow warnings ride `InstallCtx.bridgeWarnings`, which reaches the user only
through the orchestrated-mode `postCommitWarnings` list. On a plain standalone
`/claude:plugin install`, D-19-01 drops that channel: bridge-side soft warnings have no
representation on the install row. So a user who installs a workflow-bearing plugin
directly, and whose helper module or broken draft was skipped, sees a plain success row.

The channel that DOES surface a token on the standalone row draws from the closed `REASONS`
set in `shared/notify.ts`, pinned by `tests/architecture/compat-01-no-expansion.test.ts` and
by the `docs/output-catalog.md` byte gate. Closing the gap needs a new member of that set,
which WDEP-04 schedules with the soft-dependency work of the following phase.

**The following phase must carry this as scope.** The ledger case added here asserts the
warning through the orchestrated path only, and is titled accordingly; no acceptance
criterion in this plan is phrased as "the user sees a warning".

## Known Stubs

None. No stub patterns, no TODO/FIXME markers, no skipped tests added, no unrun `<verify>`
blocks. The two `t.skip` guards on the read-failure case are platform guards (Windows, root)
matching the established pattern, and the case runs on this machine.

The one skipped test in the suite total is pre-existing and unrelated.

## Threat Flags

None. Every surface this plan touches is already in the plan's threat register: the warning
construction (T-103-11), the per-file arms that never throw (T-103-12), the collision that
does (T-103-13), the required member with its fill (T-103-14), and the record that names the
artifacts (T-103-15). This plan installs no package, so T-103-SC needs no legitimacy
checkpoint.

## Verification

`npm run check` exit 0: typecheck, lint, format:check, 3602 unit tests (3601 pass, 1
pre-existing skip, 0 fail), 18 integration tests, 0 failures.

Plan-specific gates, measured:

| Gate | Required | Actual |
|---|---|---|
| `tests/bridges/workflows/discover.test.ts` cases | >= 7 | 7 |
| `grep -c 'WBRG-03'` in that file | >= 6 | 8 |
| `tests/orchestrators/plugin/install-workflows.test.ts` cases | >= 4 + 3 + 2 | 9 (was 4) |
| `grep -c 'stagedWorkflowNames'` in `install.ts` | >= 4 | 5 |
| `stagedAny` block mentions `stagedWorkflowNames` | 1 | 1 |
| `tests/persistence/migrate.test.ts` cases | >= 3 higher | 29 (was 26) |
| `grep -c 'workflows'` in `migrate.ts` | >= 2 | 2 |
| `resources` schema block mentions `workflows` | 1 | 1 |
| `compat-01-no-expansion` + `catalog-uat` | green | green |
| `git diff` of `notify.ts` and `docs/output-catalog.md` | empty | empty |
| GSD-process tokens in the new source and test files | none | none |

The closed reason set, the record's pinned outer key set and the output catalog are all
untouched: the no-expansion gate enumerates the record's own keys and not the inner
`resources` keys, so an additive member there does not trip it.

## Forward Notes

- Removal of the recorded artifacts on uninstall, update, reinstall and disable is the next
  phase, and `resources.workflows` is its input. Reinstall already carries the inventory
  forward, so that phase inherits a record to act on rather than a migration to perform.
- The standalone-surface visibility gap above is the other input, and it needs a reason
  token, not a rewire.

## Self-Check: PASSED

All four created files verified present on disk; all four commit hashes verified in
`git log`.
