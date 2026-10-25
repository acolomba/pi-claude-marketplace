---
phase: 18-update-and-reinstall-unification
reviewed: 2026-10-23T21:39:57Z
depth: standard
files_reviewed: 74
files_reviewed_list:
  - docs/competitive-analysis/asermax-pi-cc-plugins.md
  - docs/competitive-analysis/pi-plugins.md
  - docs/dependency-resolution.md
  - docs/mcp-compatibility.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/index.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/index.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/index.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/fs-utils.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/plugin/git-source-update.feature
  - features/plugin/reinstall.feature
  - rule-packs/architecture.json
  - test/architecture/gate-targets.ts
  - test/architecture/hooks-lifecycle.test.ts
  - test/architecture/manifest-lookup-drift.test.ts
  - test/architecture/no-test-only-production-surface.test.ts
  - test/architecture/partial-vocabulary-guard.test.ts
  - test/bridges/agents/index.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/agents/types.test.ts
  - test/bridges/commands/index.test.ts
  - test/bridges/commands/stage.test.ts
  - test/bridges/commands/types.test.ts
  - test/bridges/mcp/index.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/bridges/skills/index.test.ts
  - test/bridges/skills/stage.test.ts
  - test/bridges/skills/types.test.ts
  - test/edge/handlers/plugin/reinstall.test.ts
  - test/edge/handlers/plugin/update.test.ts
  - test/integration/plugin-layer-verbs.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/reinstall.messaging.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/backfill.test.ts
  - test/orchestrators/types.test.ts
  - test/persistence/state-io.test.ts
findings:
  critical: 2
  warning: 9
  info: 7
  total: 18
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-10-23T21:39:57Z
**Depth:** standard
**Files Reviewed:** 74 (plus the deleted `reinstall-replace.ts`, `reinstall-clone-probe.ts`, and their tests, read at `claude/plugin-lifecycle-coverage-b1d431` to compare behavior)
**Status:** issues_found

Scope: `git diff refs/heads/claude/plugin-lifecycle-coverage-b1d431...HEAD -- extensions test features rule-packs eslint.config.js docs` (phase 18's side of the merge only). Spec: `18-CONTEXT.md` D-01..D-18 and `18-0{1..7}-SUMMARY.md`.

## Summary

The shared runner `materialize-latest.ts` is small and correct as a composition: preflight, then swap, with the policy passed to both. The two policy knobs that reach git and the agents bridge are where the defects are.

- **`overwrite` (D-15):** the agents commit's new `force` path deletes index rows' `targetPath` values. It checks neither containment nor ownership. The deleted replace path asserted `assertPathInside(agentsDir, targetPath)` for exactly these rows (CR-01).
- **`refreshSource: false` (D-04):** reads the URL-keyed mirror's checked-out `HEAD`. It ignores the `ref` the marketplace entry declares, so `reinstall` can install and record a revision the marketplace does not offer (CR-02).

The `update` behavior is unchanged apart from D-11 and D-17, with two exceptions. A `--partial` update now records `installable: false`, and the phase-3 aggregate text changed (WR-09).

Under reinstall, update's swap semantics turn a few cases that used to fail cleanly into stuck `rollback partial` states. Agents target collisions are found only after the intent mark (WR-02). Same-revision runs in two processes are no longer serialized (WR-04). The recovery hint names uninstall + install, but D-10 and the PRD say to run `reinstall` again (WR-01). MCP config notices are dropped on a failed reinstall (WR-03).

Backfill now goes through the constraint gate and the D-17 walk. A range hold closes the backfill gate silently (WR-05). A plugin delisted by its marketplace blocks every reinstall in its scope (WR-06).

Tests are hermetic where they touch HOME (`createHermeticEnvironment` / `withHermeticHome`; `update-preflight.test.ts` and `clone-cache.test.ts` stay project-scope under `mkdtemp`). Assertions are mostly full-outcome `deepStrictEqual`. No test covers CR-01 or CR-02, and the D-13 "equivalence" scenario never runs `reinstall` (IN-04).

### Downstream seams (phases 25 and 26)

- **Phase 25, row versions:** clean single seam. `reinstallOutcomeFromRun` (`reinstall-record.ts:74-86`) drops `run.fromVersion`, `run.partialDegrade`, and `run.constraint`. Carrying them is a local change there plus `reinstalledRowFromOutcome` (`reinstall.messaging.ts:184`).
- **Phase 25, `failed {not installed}`:** not unified. Reinstall makes its own `skipped {not installed}` before the runner (`reinstall-flow.ts:367-371`, error severity flip at `reinstall.messaging.ts:313`). Update makes its own in `triageUpdateMembership` (`update-preflight.ts:599-618`). Both sites must change together.
- **Phase 25, `{source missing}`:** clean. A cold-clone failure and a seam rejection both become `skipped {no longer installable}` inside the shared preflight's candidate resolution. One change fixes both verbs (see IN-05).
- **Phase 26, fetch lock:** the new `refresh: false` read in `materializeOrRefreshPluginMirror` (`clone-cache.ts:435-439`) reads mirror `HEAD` with no lock. A concurrent `fetch` or `update` refresh moves it. The phase 26 lock must cover the read path too, not only the refresh.
- **Phase 26, shared copy helper:** reinstall's own copy path is gone. The mirror + per-commit copy composition is now duplicated in exactly two places, `update-preflight.ts:259-291` (`probeUnpinned`) and `install-clone-probe.ts:60-90`. That is a clean extraction target. CR-02's fix belongs in the same helper.

## Critical Issues

### CR-01: `commitPreparedAgents({ force })` deletes unvalidated, unowned paths read from the agents index (NFR-10 regression)

**File:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts:294-302, 344-360`
**Issue:** With `force: true` (reinstall, D-15), `partitionPreviousEntries` adds `prepared.foreignPreservedEntries` to `replaced`. The commit then runs `rm(entry.targetPath)` on each one. These rows are exactly the ones `isOwnedAgentFile` rejected. That covers a missing generated marker, and also any basename that does not start with the generated prefix. `targetPath` is a bare `Type.String()` in `agents-index-schema.ts:32`, and nothing on the load, prepare, or commit path checks it against `locations.agentsDir`.

The deleted replace path did check it: `assertPathInside(prepared.locations.agentsDir, entry.targetPath, "previous agent file")` for every forced entry (old `stage.ts:487`). Phase 18 removed the only containment guard on this delete.

Any index row owned by the plugin is enough to delete an arbitrary file during `reinstall` or a reload backfill. The path can be outside `<scopeRoot>/agents/`, or be a file that is not ours. Examples:
- a hand-edited or corrupt `agents-index.json`;
- a project-scope `.pi/` copied or moved, whose absolute `targetPath` values still point into the old project tree;
- a repository that ships `.pi/` state.

Non-forced callers are protected only by the marker check, which force skips by design. The new force tests (`test/bridges/agents/stage.test.ts:1571`, `:1648`) do not cover an out-of-root row.
**Fix:** Restore containment for every row the commit removes, before any `rm`. Refuse the forced overwrite of a row whose basename is not a generated name:
```ts
const previous = partitionPreviousEntries(prepared, options);
try {
  for (const entry of previous.replaced) {
    // eslint-disable-next-line no-await-in-loop -- refuse before any removal
    await assertPathInside(prepared.locations.agentsDir, entry.targetPath, "previous agent file");
  }
  // ...existing occupied-target check and rm loop
```
In `partitionPreviousEntries`, keep a foreign row in `kept` when `!path.basename(entry.targetPath).startsWith(GENERATED_AGENT_PREFIX)`. Add a test: a forced commit over a row whose `targetPath` is outside `agentsDir` rejects with `PathContainmentError` and leaves that file in place.

### CR-02: `refreshSource: false` installs the mirror's checked-out HEAD, not the ref the marketplace declares (REI-04 truthfulness)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:435-439`; `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:262-277`
**Issue:** The mirror is keyed by URL only (`pluginMirrorKey(args.cloneUrl)`), so every source of one repository shares it, whatever `ref` it declares. The refresh path is what makes `HEAD` match the declared ref. `refreshGitHubClone(mirrorRoot, args.ref, ...)` fetches that ref and checks it out (`marketplace/shared.ts:261-301`).

With `refresh: false`, the refresh is skipped and `resolveRef({ ref: "HEAD" })` returns whatever the last writer checked out. That writer can be another plugin with a different `ref`, or the entry's previous `ref` before a `marketplace update` changed it. `args.ref` is then ignored entirely. Reinstall copies that commit and records its `resolvedSha`, version, and `resolvedSource` as "the version the marketplace offers now". That breaks D-08 / REI-04, and the row reports it as a success.

The scenario D-14 tests has no `ref`, so this is not covered.
**Fix:** With `refresh === false` on a warm mirror, resolve the declared ref locally (offline) instead of `HEAD`:
```ts
const localRef = args.ref === undefined ? "refs/remotes/origin/HEAD" : `refs/remotes/origin/${args.ref}`;
const resolvedSha =
  args.refresh === false && promotion !== "renamed"
    ? await resolveLocalRefOrUndefined(gitOps, mirrorRoot, localRef) // try tags/<ref> for a tag ref
    : await gitOps.resolveRef({ dir: mirrorRoot, ref: "HEAD" });
```
If the local ref cannot be resolved, treat it as a cache miss and refresh. Add tests: two sources share one repository with different refs, and an entry's `ref` changes between install and reinstall.

## Warnings

### WR-01: The phase-3 recovery hint tells a reinstall user to uninstall + install, contradicting D-10 and the PRD

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1224-1227`; `docs/prd/pi-claude-marketplace-prd.md:454`
**Issue:** D-10 says a commit or finalize failure of `reinstall` is `rollback partial` "whose recovery hint is to run `reinstall` again". The PRD now says the same. The rendered cause line (the aggregate `PluginUpdatePhase3Error`, which reinstall forwards as `cause`) still reads `Plugin "x" failed during physical replace. plugin-uninstall + plugin-install for "x".`

The 18-05 summary flagged this and left it in place. The AGENT-01 case (`reinstall-flow.test.ts`) now pins the contradicting text.
**Fix:** Make the hint verb-aware: add `recoveryHint` (or `verb`) to `ThreePhaseArgsBase`, and have reinstall pass `Run /claude:plugin reinstall x@mp again.`. Alternatively, record a decision that supersedes D-10's hint clause and fix the PRD line. Either way, the test, PRD, and rendered text must agree.

### WR-02: Agents target collisions are now found after the intent mark, so a reinstall that used to refuse cleanly now leaves a half-applied plugin that never converges

**File:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts:344-352`; `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1328-1343`
**Issue:** The "file no index row names at a new target" refusal runs inside `commitPreparedAgents`, during phase 3a. By then `markUpdateInProgress` has written `installable: false` + `update-in-progress`, and skills and commands have already been committed. Phase 3a commits bridges independently: hooks, MCP, and workflows still run after the agents failure.

The old reinstall refused the same collision with no change at all (old title "AGENT-01: reinstall preserves legacy bytes and state when the new target holds foreign content"). Now the user gets `rollback partial`, live artifacts are partly replaced, and the record reads as partially installed (`!installable`, which enable and install treat as partial consent). Every retry hits the same file and fails again. That breaks NFR-3 (retry-safe: idempotent or fail-clean) and makes the D-10 / PRD claim "running `reinstall` again repairs it" false for this case.
**Fix:** Move the occupied-new-target probe into prepare. Either add it to `prepareStagePluginAgents`, or export `assertAgentTargetsUnoccupied(prepared, options)` and call it in `swapPluginUpdate` before `markUpdateInProgress`, so the refusal aborts the handles like any other prepare failure. Keep the commit-time check as the race backstop.

### WR-03: A failed reinstall drops the MCP config notices, and the comment that justifies it is now false

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:419-420, 585-590`; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts:93-103`
**Issue:** `composePhase3FailureOutcome` carries `mcpConfigNotices` on the failed outcome because "a bridge after it, or the finalize, can fail once the file is already rewritten" (AFILE-04). Reinstall keeps notices only for `run.partition === "updated"`, and `reinstallOutcomeFromRun`'s failed arm does not copy them.

The swap does not roll the MCP file back. So after an agents, hooks, workflows, or finalize failure, `mcp-adapter.json` has been rewritten and the user is not told. `surfaceReinstallMcpConfigNotices`' JSDoc ("A failed reinstall restores the file's exact bytes") described the deleted replace path.
**Fix:** Add `mcpConfigNotices?` to `ReinstallFailedOutcome`, and copy `run.mcpConfigNotices` in the failed arm. Return them from `runReinstall` for failed runs too. Render them in `surfaceReinstallMcpConfigNotices` and in the single-plugin failure path. Correct the JSDoc.

### WR-04: Reinstalls of the same plugin in two processes are no longer serialized, and ST-9 cannot see the overlap

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:590-597`; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:353-357`
**Issue:** The old reinstall held the scope lock for the whole operation. D-10 moved it to update's intent-mark and finalize guards, whose ST-9 check compares only `version` and `resolvedSha`. A same-revision reinstall changes neither.

So two processes can both pass the intent mark and run phase 3a at the same time, renaming and unlinking the same targets. For example: a user's `reinstall` in one Pi, and a reload backfill or a second `reinstall` / same-version `update` in another. They then finalize in either order. Update had the same window for the same-revision case, but it could only be reached by a no-op update. Reinstall now reaches it on every run.
**Fix:** The intent mark already restamps `updatedAt`, so include it in the ST-9 check: `|| sRecord.updatedAt !== preflight.record.updatedAt`. The second process then fails `concurrently updated` before any commit, and crash residue still recovers, because the preflight reads the residue's own stamp. Add a test with two interleaved swaps.

### WR-05: A range hold now silently cancels a backfill promotion that used to succeed, and the gate closes

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:429-441`
**Issue:** Before phase 18, backfill re-materialized at the recorded version, with no constraint gate. Now it runs the shared runner (D-12), which also runs the gate (D-07) and moves to the offered version. When dependents hold the offered version out of range, the runner returns `skipped {dependents constrain}`. Backfill treats every `skipped` as benign and returns `false`, so the version gate closes.

The plugin stays degraded, missing the kind the extension now supports, with no row, until the extension version moves again. This is a BFILL-01 regression that the backfill comment presents as intended.
**Fix:** Keep the gate open (return `true`, with no row or a warning row) for runner skips other than `not installed` and `already disabled`. Alternatively, have backfill materialize the recorded revision (a fourth knob, or `refreshSource: false` plus an explicit pin). Either choice needs a user decision against D-12, and a test that pins it.

### WR-06: D-17 lets one delisted plugin block every reinstall and update in its scope, including recurring backfill failures

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:458-466`
**Issue:** The declaration walk reads every recorded plugin in the scope. A record whose marketplace no longer declares it counts as "cannot read" (`cannot read the dependencies of bad@mp: not declared by its marketplace`). With D-17 that is now a hard failure, and D-07 put `reinstall` behind the same gate. 18-05 pins the result: after a marketplace drops one plugin, every other `reinstall` in the scope fails `{unreadable}`. That includes the repair verb REI-01/02 relies on.

On reload, a backfill candidate fails, keeps the gate open, and emits a `(failed)` row on every load until the delisted plugin is uninstalled. WCONV-01's comment in the same file argues against exactly this kind of endless row. A delisted entry is a normal marketplace change, not corrupt data.
**Fix:** Raise this with the user before shipping. Two options: only treat records that could constrain the target (declarers with a dependency edge to it) as fatal, or count "not declared by its marketplace" as "no declarations" (no constraint) while keeping fail-closed for real read or parse errors. At minimum, make the row name the remedy (`uninstall bad@mp`).

### WR-07: A reinstall row reads `(reinstalled)` / info while the swap dropped components or held the version

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts:74-86`
**Issue:** `reinstallOutcomeFromRun` drops three facts the runner computed:
- `partialDegrade`: a clean record newly degraded (D-06 / D-18) unstages working components but reports a plain `(reinstalled)` at `info`. Update renders `(partially-installed)` for the same transition.
- `constraint`: a range-held pin installs an older tag with no disclosure. It can be a downgrade below the recorded version, and the row has no arrow.
- `orphanRewake`.

D-08 / REI-04 require the row to report the result truthfully.
**Fix:** Carry `partialDegrade` and `constraint` onto `ReinstallReinstalledOutcome`. In `reinstalledRowFromOutcome`, render the dropped kinds as reasons (or a `partially-installed` row) with a `warning` raise when `newlyDegraded`, and the constraint disclosure as the cause line, as update's row does. This overlaps phase 25's row work; decide there if it is deferred.

### WR-08: The output catalog was not updated for reinstall's new rows

**File:** `docs/output-catalog.md:1634-1820`
**Issue:** Reinstall now renders rows the catalog does not document:
- `(skipped) {dependents constrain}` with a holders cause line (D-07);
- `(skipped) {no longer installable}` / `{not in manifest}` from the runner;
- a named `(failed) {unreadable}` from the walk (D-17), where only the bulk-selection case is described;
- `(failed) {rollback partial}` with per-bridge children (D-10).

Line 1703 still describes "the names the replace step reported placing", which is the deleted machinery. The catalog is the user-visible contract that the rest of the codebase cites.
**Fix:** Add catalog states for each new reinstall row, with the exact bytes the tests pin, and reword 1703 to say "the names the shared swap staged".

### WR-09: `update` behavior changed outside D-11 and D-17

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:756, 1227`
**Issue:** The phase is meant to change only IN-01 (D-11) and D-17 for `update`. Two more changes reach update users:
1. `applyAllSuccessRecordFields` now writes `installable: installable.state === "installable"`. An `update --partial` of a partially-available plugin used to record `installable: true` and now records `false`. That changes `list`, `info`, enable's partial gate (`enable-disable.ts:403`), install's refusal (`install-flow.ts:1388`), and backfill eligibility for that plugin. It is arguably a fix, because install writes the same value, but it carries no decision of its own (it is cited only as a "D-18-06 prerequisite") and no update scenario pins it.
2. The phase-3 text changed from `Plugin "x" update failed during physical replace.` to `Plugin "x" failed during physical replace.`.
**Fix:** Record both as explicit decisions in `18-CONTEXT.md` or a later phase. Add an `update --partial` then `list` scenario that pins the new record flag and its rendering.

## Info

### IN-01: Stale comments that name the deleted locked ledger and replace path

**File:** `extensions/pi-claude-marketplace/orchestrators/types.ts:98, 118, 159`; `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:202`; `extensions/pi-claude-marketplace/domain/plugin-resolver.ts:780`; `extensions/pi-claude-marketplace/bridges/agents/stage.ts:13-14`
**Issue:**
- `types.ts:98` and `:118` say the warnings "originate inside the locked ledger". There is no ledger lock now.
- `types.ts:159` says reasons are "Populated by the catch in `reinstallPlugins`". They are set in `reinstall-record.ts`.
- `backfill.ts:202` says "reinstallPlugin self-locks".
- `plugin-resolver.ts:780` says "The `--partial` install/update flag plumbing lands later". That flag has shipped, and the line also exceeds the comment width.
- The agents header says "Foreign-preserved index rows survive the commit", which is false under `force`.

**Fix:** Reword each to describe the shared swap's intent-mark and finalize guards and the `force` exception.

### IN-02: The policy is optional with a silent `update` default on both shared entry points

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:155, 973, 1008`; `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1282, 1343`
**Issue:** `policy?` plus `?.refreshSource !== false` / `?.overwrite === true` means a new caller that forgets the policy silently gets update's semantics. Both production callers always pass it. `MaterializationPolicy` lives in `update-preflight.ts` rather than in the shared leaf that owns it.
**Fix:** Make `policy` required on `PreparePluginUpdateOptions` and `swapPluginUpdate`, update the test helpers, and move the type to `materialize-latest.ts` (type-only import back into preflight and swap).

### IN-03: A reinstall that races a disable writes the disabled record's pin while reporting `skipped`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts:87-90`; `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:1043-1045`
**Issue:** If the record is disabled between reinstall's unlocked read and the preflight's read, the preflight runs `refreshDisabledPluginUpdate`. That writes the disabled pin (version, root, sha) under a lock, and reinstall then reports `skipped {already disabled}`. D-05 says the pin refresh is update's alone. The `unchanged` arm's comment does not mention the write.
**Fix:** Thread `skipDisabledRefresh` (or reuse `skipSameRevision === false`) so the preflight returns `skipped {already disabled}` without writing for reinstall's policy.

### IN-04: The D-13 "equivalence" scenario does not run `reinstall`

**File:** `features/plugin/reinstall.feature:304-319`
**Issue:** "Updating after the same marketplace update records the version a reinstall records" runs only `update`. The equivalence it claims depends on a separate scenario's numbers, so a change that makes the two verbs disagree on version derivation could still pass both.
**Fix:** Retitle it to what it checks, or run `reinstall` in a second scope or a follow-up step and compare both records.

### IN-05: A cold-cache clone failure renders `{no longer installable}`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:957-972` (the candidate resolution reached through `resolvePinnedUpdateCandidate`)
**Issue:** For both verbs, `network unreachable: clone` and a rejected clone seam become `skipped {no longer installable}` (pinned in 18-07). The source has not stopped being installable. This is the phase 25 `{source missing}` item, recorded here so the shared seam is noted.
**Fix:** In phase 25, classify transport failures from the clone seam separately in the shared preflight. One site fixes both verbs.

### IN-06: `RemovalOps.rename` is now an orphan member

**File:** `extensions/pi-claude-marketplace/shared/fs-utils.ts:60, 75`
**Issue:** The only production caller (`rollbackReplacementCommon`) was deleted in this phase. The phase's own changes created the orphan, so the project rule ("remove what your changes made unused") applies. The 18-04 summary raised it and left it.
**Fix:** Narrow the port to `rm` and update `createRemovalOps`, the fake, and their tests. Alternatively, record why the member stays.

### IN-07: The user guide cites a GSD decision ID

**File:** `docs/mcp-compatibility.md:333`
**Issue:** The remedy cell ends "(D-18-04)". The rest of that user-facing table cites no internal decision IDs, and the ID means nothing to a reader of the guide.
**Fix:** Drop the parenthetical. Keep the ID in source comments only.

---

_Reviewed: 2026-10-23T21:39:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
