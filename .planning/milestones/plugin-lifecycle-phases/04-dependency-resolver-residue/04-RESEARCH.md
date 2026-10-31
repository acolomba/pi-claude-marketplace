# Phase 4: Dependency Resolver Residue - Research

**Researched:** 2026-10-26
**Domain:** In-repo TypeScript orchestration (dependency plan, install ledger, agents bridge, tag probes). No new packages.
**Confidence:** HIGH. Every mechanism claim was read from source this session. RSV-01 and RSV-04 were also checked by running draft cucumber scenarios against the current code and against throwaway prototypes in a scratch copy.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upstream evidence (one record, used by every decision below)

- **Question:** how does Claude Code's dependency resolver choose versions,
  and what does one dependency that cannot install do to the plugin that asked
  for it?
- **Claude Code 2.1.310** (binary
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`,
  grepped 2026-10-26; confidence high, read from the minified source):
  - `installResolvedPlugin` (`lsn`) walks the closure once (`o3s`, a
    depth-first walk that returns the post-order, dependencies first). It skips
    an installed, enabled dependency unless an installed plugin's recorded range
    rejects it (`Kn`, "force-include").
  - It then materializes the members root first, in reverse post-order
    (`for(ii=sn.closure.length-1;ii>=0;ii--) qs(...)`), so each member comes
    after every closure member that requires it. A member's range is the
    intersection (`cWt`) of what the members materialized before it declare and
    what installed plugins record (`_Co`). It takes the highest release tag
    inside that range (`IOr`: `ls-remote --tags`, `maxSatisfying`), and fetches
    the member once (`mCo`).
  - There is no backtracking. A member whose ranges are disjoint
    (`range-conflict`), that has no matching tag (`no-matching-tag`), or whose
    fetch throws fails the whole install: `Zs` / `xr` roll back what the
    install changed and the root is not installed. The one exception is a
    force-included installed dependency: its failure is logged and skipped
    ("pinner stays demoted").
  - An installed dependency outside the root's own range is not moved: the
    install fails `range-conflict` / `installed-unsatisfied` with
    `suggestDependencyUpdate` (this extension moves it instead, UPD-DEP-D1).
  - `resolveMissingDependencies` (`bae`, the load-time pass that MISS-01
    mirrors) installs each missing dependency with its own `lsn` call and only
    logs a failure (`did not complete`); it refuses nothing else.
- **Pi constraints:** NFR-5 (an install clones on a cache miss; a present
  mirror is refreshed; `apply` lists no tags, D-23), NFR-3 (fail before
  changing anything), D-03-07 (a cascade is all or nothing), UPD-DEP-D1 (plan
  first, then carry the plan out exactly).

#### RSV-01: the previewed commit is the installed commit
- **D-PL4-01:** every plugin the plan previews and then installs installs the
  commit its preview resolved. That is each fresh dependency of the graph and
  the root of an install plan (the plugin the user named, which
  `planInstallMoves` previews first).
  - `previewInstall` (`install-outcome.ts`) returns the commit its preflight
    resolved (`resolvedSha`), or `undefined` when the source resolved none.
  - The plan's `preview` port returns that commit. `dependency-plan.ts` keeps
    one commit per fresh key and sets it on the member it schedules, so a
    materialize step and the final closure carry it. The caller passes the
    root's commit through `DependencyPlanOptions` (`rootCommit`).
  - `ResolvedCascadeMember` (`install-cascade.ts`) gains an optional
    `previewedCommit`. One helper in `install-flow.ts` gives a member's ledger
    pin: the release tag's commit and semver when `pin` is set (RESV-03,
    GV-01), else `previewedCommit` as `sourcePinOverride` alone, with no
    `resolvedVersion`. The recorded version then derives as an unpinned
    install's does (`deriveInstallVersion`'s third tier), from the same
    commit. Both ledger option builders use the helper:
    `dependencyLedgerOptions` and the inline builder in
    `installPluginWithTransaction`.
  - Mechanism: with `sourcePinOverride` set, `probeInstallClone` takes its
    pinned arm. `resolvePluginPin` answers the pin with no network, and
    `materializePluginClone` finds the per-commit copy the preview created
    under the same key (`pluginCloneKey(url, sha)`) and returns it. So the
    install reads no network.
  - Upstream: Claude Code fetches each member once (`mCo`) and has no
    separate preview. One network resolve per fresh git plugin matches it.
  - Not covered: under `apply` (`dependencyInstallsFollow`), a fresh
    dependency that only a moved dependency's new version needs is installed
    by apply's MISS-01 step. That step walks again, so it keeps its own
    resolve (Uncertain choice 2).

#### RSV-02: one bad dependency under `apply`
- **D-PL4-02:** keep the refusal. Under `apply`, the plan still previews every
  fresh dependency of the graph, including one that only a moved dependency's
  new version needs and that apply's MISS-01 step installs later. When the
  install's preflight refuses such a dependency, the root's install fails
  before any of its moves land.
  - Upstream: `installResolvedPlugin` is all or nothing over the closure. A
    closure member that cannot install fails the root and rolls back. The
    `apply` config install is this extension's counterpart of one such
    install. `resolveMissingDependencies` logs and refuses nothing, but it is
    MISS-01's counterpart, and MISS-01 keeps its own row. Keeping the refusal
    matches D-03-07 (all or nothing) and NFR-3.
  - Code: no behavior change. The `dependencyInstallsFollow` doc comment and
    the `dependency-plan.ts` header state the rule with this ID. A unit test
    pins it: a deferring plan refuses on a fresh node that only a move
    reaches.

#### RSV-03: the resolver's completeness
- **D-PL4-03:** record the limit, do not build a complete solver.
  - Upstream's resolver is a single greedy pass with no backtracking (the
    evidence record above). The tentative-pick search with permanent
    rule-outs (UPD-DEP-D1, WR-1, WR-4) already settles every graph Claude Code
    settles, and more.
  - The limit: when a conflict involves several tentative picks, the plan rules
    out the version of the first involved pick in walk order that still has a
    version left. It does not try the others first, and a ruled-out version
    stays ruled out. So a graph that only that version solves (for example
    `a@3` with `b@2`, when `a@3` and `b@3` conflict) is refused.
  - A complete solver would need a search over every combination of
    candidate versions (each candidate is a judge call and possibly a network
    tag read). That cost buys no parity, since upstream refuses these graphs
    too.
  - Code: the `dependency-plan.ts` header names the limit with this ID. A unit
    test pins the refusal of such a solvable graph, so a future complete solver
    must change the test and this decision together.

#### RSV-04: agent-target refusals before any move lands
- **D-PL4-04:** the plan finds an occupied agent target before any move
  lands.
  - A write-free check refuses a new agent target that holds a file which no
    replaced index row of the plugin names. Its rule is the rule of the agents
    commit without `force` (`assertAgentCommitTargets`): an index row of the
    plugin is replaced only when its file is the plugin's own
    (`isOwnedAgentFile`). The check reads the agents index and the disk, and
    writes nothing. It throws the commit's own message, `Cannot replace agent
    target with non-previous content at <path>`. It lives in the agents bridge
    (a new module that reuses `partitionByOwner` and `isOwnedAgentFile`) and is
    exported through the bridge barrel.
  - `assertUpdateNamesFree` (`update-swap.ts`) runs the check after the PI-6
    name check. The move judge (`judgeDependencyMove`) and the update's own
    WR-C check (`settleUpdateDependencies`) already call it, so a move, or the
    updated plugin, whose target is occupied refuses before anything lands.
    The swap keeps a names-only check, so reinstall's forced overwrite
    (RINST-01, D-18-15) is unchanged. The swap and the install ledger keep
    their commit-time refusals for a file that appears in between.
  - `previewInstall` runs the same check, so the install root and each fresh
    dependency the plan previews refuse before any move lands as well.
  - A move whose judge refuses this way takes the WR-1 path that any judge
    refusal takes. The plan refuses with RESV-05's `installed-unsatisfied`
    subject, whose `moveRefusal` is the check's message.
  - Side effect: a plain `update` (no moves) whose agent target is occupied
    now refuses in WR-C, before the first cascade run installs a missing
    dependency. Before, it refused in the swap after that install (Uncertain
    choice 5).
  - Upstream: no position. Claude Code loads plugin agents from the plugin's
    own cache directory, so no shared agents directory can collide. Licensed as
    a Pi capability gap: Pi agents live in one shared `<scope>/agents/`
    directory (NFR-3 and UPD-DEP-D1's "known post-move failure" settle the
    behavior).

#### RSV-05: probe and outcome types
- **D-PL4-05 (b2):** remove the unread `range` from the `no-matching-tag` arm
  of `SelectedReleaseTag` (`domain/release-tag.ts`) and
  `DependencyTagProbeResult` (`dependency-tag-probe.ts`). Every caller renders
  the member's declared ranges instead (`install-cascade.ts` passes
  `declared`). `renderConstraintRange` leaves `release-tag.ts`'s imports. The
  decoders that type the probe answer structurally
  (`install-cascade.ts::toMemberConstraintOutcome`) drop the field from their
  parameter type.
- **D-PL4-06 (b3):** declare `rollbackPartials?: readonly RollbackPartial[]` on
  the failed arm of `InstallMissingDependencyOutcome` (`install-flow.ts`), with
  the doc of `InstallPluginOutcome`'s failed arm (REC-06, omitted when every
  undo finished, NREG-01). The value already reaches the object through
  `handleCaughtInstallFailure`. `apply` does not render it yet (LCORCH-01).

### Claude's Discretion
- Field and helper names (`previewedCommit`, `rootCommit`, the bridge
  module's name), test layout, and the exact wording of the doc comments.
- Whether the bridge check returns the occupied path or throws. The decisions
  above require the commit's message.

### Deferred Ideas (OUT OF SCOPE)
- **Workflow-target refusals** (`Cannot replace workflow target with
  non-previous content`) are made in a move's swap too: in the workflows
  bridge's prepare or commit, after earlier moves have landed. RSV-04 names
  agent targets only. Proposed as a new backlog entry.
- **Re-enabled members:** a disabled recorded dependency that the plan
  re-enables runs the install ledger again, and its agents commit can refuse
  an occupied target after a move landed. The plan previews fresh nodes only.
- **`apply`'s deferred fresh dependencies:** these are resolved again by
  MISS-01 (D-PL4-01, last bullet).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSV-01 | A fresh unpinned git dependency installs the commit the plan previewed, with one network resolve | Mechanism confirmed line by line (§RSV-01). Measured today: 2 request rounds. Measured with a prototype: 1 round. |
| RSV-02 | Decide and implement whether one bad dependency refuses the root under `apply` before its moves land | `previewFresh` already previews every fresh node, deferred ones too (dependency-plan.ts:409-435 vs 512-524). Test shape given (§RSV-02/03). |
| RSV-03 | Compare completeness with Claude Code; record the limit with an ID | Exact `ruleOut`/`settleChoices` trace for a 2x2 graph, with expected `calls.walks` and `calls.judged` (§RSV-02/03). |
| RSV-04 | An agent-target refusal in an update is found before any move lands | Commit rule quoted; write-free equivalent specified; caller map; rendering measured with a prototype (§RSV-04). |
| RSV-05 | Remove or read the `no-matching-tag` range; declare `rollbackPartials` on the failed arm | Full list of changed files and failing tests, from a scratch typecheck and test run (§RSV-05). |
</phase_requirements>

## Summary

Every mechanism the CONTEXT relies on matches the code, with one correction and three planning hazards.

**RSV-01 works as designed.** The unpinned and the pinned arms of `probeInstallClone` write the per-commit copy at the same key, `pluginCloneKey(canonicalCloneUrl(source), sha)`. `materializePluginClone` returns a present key with no network. Clone garbage collection does not run between the preview and the install on either the install path or the update path. A draft cucumber scenario against today's code records two request rounds for the fresh `util` repository. The same scenario against a prototype that threads the previewed sha as `sourcePinOverride` records one round, and the record is unchanged.

**RSV-04 has three hazards.**
1. **Swap/judge split (required).** The swap calls the same exported `assertUpdateNamesFree` that the judge and WR-C call (update-swap.ts:1407). So "the swap keeps a names-only check" means the planner must split the function: a private names-only body for the swap, and the exported check that also tests agent targets.
2. **Signature widening (required).** The exported function's `args` Pick lacks `locations`, so it must widen to include it.
3. **Absolute path in the row (behavior change, flagged A1).** A refusal from the judge now shows the full absolute path in the row's cause, `{project dir}/.pi/agents/pi-claude-marketplace-zzz-helper.md`. Today the swap-time refusal goes through `failedMoveRow`, which redacts the path to its basename. The prototype measured both.

**RSV-05 is mechanical.** Removing `range` produces 20 TS2353 errors, all in `install-cascade.test.ts`. It also breaks 12 runtime assertions across three probe tests. No source file other than the three named ones needs an edit.

**Primary recommendation:** Build RSV-04's agent check first, as a pure bridge module with its own pair test. Split `assertUpdateNamesFree` so the swap keeps calling a names-only body. Then add the RSV-01 commit threading, with one shared `memberLedgerPin` helper in `install-flow.ts`. Pin each behavior with the unit-test shapes and the two cucumber scenarios below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan search, commit bookkeeping per fresh key | orchestrators (`dependency-plan.ts`, pure over ports) | — | The plan is pure. Ports carry I/O. |
| Preview resolve, then return the commit | orchestrators (`install-outcome.ts::previewInstall`) | platform via `clone-cache.ts` seam | The preflight already captures `resolvedSha` (install-outcome.ts:738-812). |
| Member to ledger options (pin or previewed commit) | orchestrators (`install-flow.ts`) | — | Both builders live there (994-1014, 2335-2357). |
| Write-free agent-target check | bridges-agents (new module) | persistence (`agents-index-io`), shared (`fs-utils`) | The fallow zone `bridges-agents` may import `domain, persistence, shared, platform` [VERIFIED: .fallowrc.json:104-105]. |
| Calling the agent check | orchestrators (`update-swap.ts::assertUpdateNamesFree`, `install-outcome.ts::previewInstall`) | — | Both already import the agents barrel (update-swap.ts:70, install-outcome.ts:81). |

## RSV-01: verified mechanics

**(a) `previewInstall` can return the commit.**
- `preflightInstallResolve` returns `{ kind: "ready", entry, installable, resolvedSha }` (install-outcome.ts:812).
- `previewInstall` reads `preflight` at 866. It returns `void` today (848-877) after the PI-6 check at 871-876.
- The unpinned arm of `probeInstallClone` (install-clone-probe.ts:64-76) calls `materializeUnpinnedSource`. That function calls `materializeOrRefreshPluginMirror` (clone-cache.ts:379; it clones cold or refreshes warm) and then `materializePluginCommitCopy({ sha: mirror.resolvedSha })` (387-393). The probe returns `resolvedSha = result.resolvedSha` (74).
- For a path source with no pin, `resolvedSha` stays `undefined`. `resolvePathPluginRoot` is wired only when `sourcePinOverride` is set (install-outcome.ts:774-791).
- `marketplace-absent` returns early (867-869), so the commit is `undefined` there.

**(b) A pinned re-run makes no network request.**
- `sourcePinOverride` becomes `{ ...gitSource, sha }` (install-outcome.ts:752-755), so the probe takes its pinned arm (install-clone-probe.ts:78-88).
- `resolvePluginPin` with `source.sha` set takes `pin = source.sha` and makes no `resolveRemoteRef` call (clone-cache.ts:796-797).
- `materializePluginClone` computes `key = pluginCloneKey(args.cloneUrl, args.pin)` (228) and returns a present `cloneRoot` with no clone (235-237). `resolveAuth` runs only on a cold key (239).
- Key parity:
  - The preview copy uses `pluginCloneKey(args.cloneUrl, args.sha)` (339), with `cloneUrl = canonicalCloneUrl(source)` (377).
  - The pinned arm uses `pin.cloneUrl`, which is `canonicalCloneUrl(source)` (786), and `pin.pin`, which is the same sha.
  - `canonicalCloneUrl` ignores `sha` (clone-key.ts:83-85).
  - Result: same directory, so the recorded `resolvedSource` is identical too.
- Side effect: the GitHub auth bundle is no longer built eagerly. The unpinned arm builds it up front (install-clone-probe.ts:70). The pinned arm builds it lazily (85).

**(c) The record is identical.**
- `deriveInstallVersion` uses tier 2 only when both `resolvedVersion` and `resolvedSha` are set (install-outcome.ts:494). With `sourcePinOverride` alone, it falls to tier 3, `resolvePluginVersion(entry, installable, name, isGitSource ? resolvedSha : undefined)` (503-510). The inputs are the same as an unpinned install's.
- Precedent for "sha pin without `resolvedVersion`": enable-disable.ts:926-930 re-materializes a kept record with `sourcePinOverride: record.resolvedSha`.
- Measured: the prototype records `util@tools 1.0.0 true`, the same as the unpinned run.

**(d) No sweep removes the copy before the install reads it.**
- Install path (`installAfterMoves`):
  - `planCloneSweep` snapshots the clones that were already unreferenced at 3554, before `planInstallMoves` at 3556. The sweep runs only in `finally` (3574-3577), after `installPluginWithTransaction` returns.
  - Moves run with `cleanupClones: leaveClonesToTheSweep`, which does nothing (dependency-bindings.ts:97-99, 117; dependency-move.ts:127 `moveArgs`).
  - Materialize steps (`lockedRootCascade` → `runDependencyCascade`) contain no GC.
  - The install ledger never calls `garbageCollectPluginClones`. Its callers are remove.ts:1238, uninstall.ts:1155, reinstall-flow.ts:414, apply.ts:1496, the update-flow.ts cleanupClones bindings (276/678/704), and the sweep.
- Update path (`settleDependencies`):
  - `planSweep()` runs at dependency-settle.ts:220, before `settlePlanned` → `ports.plan()` (190). The steps and the final materialize run inside `settlePlanned` (200-202). The sweep runs in `finally` (223-225).
  - The update's own `cleanupClones` runs after the swap's finalize (update-swap.ts:1511-1513). By then the fresh dependencies are recorded, so their keys are live (clone-gc.ts:46-66).
- Under `apply` (defers), the preview copies of deferred nodes are unreferenced at the end of `installAfterMoves`, so the sweep removes them. MISS-01 then clones again. This matches D-PL4-01's last bullet.

**(e) Where a planned member becomes ledger options.**

| Path | Builder | Site |
|------|---------|------|
| Plan preview of a fresh node | `dependencyLedgerOptions` (via `planningPorts.ledgerOptionsFor`) | install-flow.ts:3296-3300, 3331 |
| Root preview | `buildInstallLedgerOptions(opts, …)` with no pin | install-flow.ts:3596-3608 |
| Materialize step (install and update) | `dependencyLedgerOptions` | `lockedRootCascade` 3397, reached from `dependencyStepPorts.materialize` 3481-3487 |
| Update `final` | the same materialize port | dependency-settle.ts:200-202 |
| **Install `final` (root included)** | inline `ledgerOptionsFor` in `installPluginWithTransaction` | install-flow.ts:2335-2357 |

- `plan.final` reaches the install like this: `installAfterMoves` calls `installPluginWithTransaction(…, { moved, carried, planned: plan.final })` (3566-3573). Then `installRun` → `runInstallCascade({ ...options, planned })` (2095-2099) → `resolveCascade` → `plannedCascade`, which passes `install` entries through unchanged (install-cascade.ts:1501-1504, 1536-1537) → `buildMemberPhase` → `options.ledgerOptionsFor(member)` (1236).
- The root's entry is `{ kind: "install", member: graph.root }` (dependency-plan.ts:531). In the inline builder, `isRoot = member.key === rootKey` (2336).
- For an update, `graph.root` is `undefined` because `installedKeys` has the root (install-cascade.ts:1845). So `rootCommit` is install-only.
- The re-enable phase spreads `ledgerOptionsFor(member)` with a `ClosureMember` (1386). That still type-checks if the helper reads an optional `previewedCommit`.

**(f) A path-source member never carries a preview commit without a pin.** It gets `resolvedSha` only through `resolvePathPluginRoot`, which requires `sourcePinOverride` (install-outcome.ts:774-787). A dependency member gets that only from `pin`. So "pin wins, else `previewedCommit`" can never put a git sha on a path source's `pathPluginPin`. A pinned path member's preview commit equals `pin.oid`, and `pin` wins anyway.

**(g) Measured with a cucumber draft** (`npx cucumber-js <file> --parallel 1`, scratch copy). The scenario:
- `lib` is installed at 1.2.0.
- `app` needs `lib@^2.0.0` and `util`.
- `util` is offered `url`, unpinned, from git repository `util`.
- The marketplace `tools` is a dir source.

| Code | `/claude:plugin install app@tools --scope project` → git host requests |
|------|------------------------------------------------------------------------|
| Today | `GET /acme/util.git/info/refs?service=git-upload-pack 200`, `POST /acme/util.git/git-upload-pack 200`, then the same pair again (4 rows: the preview clone, then the install's mirror refresh) |
| Prototype (previewed sha → `sourcePinOverride`) | one `GET …info/refs…` + one `POST …git-upload-pack` (2 rows) |
| Control: same app with no move | 2 rows today (no plan, so no preview) |

A git **root** can't be shown this way with today's steps. A git plugin's own `plugin.json` dependencies are not visible to the first walk before the plugin is cloned (`lookupCascadeDependencies` reads the catalog entry, install-flow.ts:813-829). The draft with a git root installed `app` without moving `lib` and made 1 request round. Prove `rootCommit` with a unit test instead. [VERIFIED: draft run]

## RSV-04: verified mechanics

**(a) The commit's rule, quoted.**
```ts
// bridges/agents/stage.ts:295-301
return options?.force === true
  ? { replaced: [...prepared.previousEntries, ...prepared.foreignPreservedEntries], kept: [] }
  : { replaced: prepared.previousEntries, kept: prepared.foreignPreservedEntries };
// stage.ts:324-331
const previousTargets = new Set(previous.replaced.map((entry) => entry.targetPath));
for (const entry of prepared.newEntries) {
  if (!previousTargets.has(entry.targetPath) && (await pathExists(entry.targetPath))) {
    throw new Error(
      `Cannot replace agent target with non-previous content at ${entry.targetPath}`,
```
- `previousEntries` are this plugin's index rows (from `partitionByOwner(loaded.agents, mp, plugin)`, stage.ts:120-125) whose `isOwnedAgentFile(entry.targetPath).ok` (174-186).
- `newEntries[].targetPath = path.join(locations.agentsDir, c.generatedName + ".md")` (203).

The write-free equivalent, without `force`:
1. `loaded = await loadAgentsIndex(locations)`. This is read only and returns an empty index on ENOENT (agents-index-io.ts:81-97).
2. Get `previous` from `partitionByOwner(loaded.agents, marketplace, plugin)` (index-mutation.ts:33-49).
3. Build `replaced`: the `targetPath` of each `previous` row where `(await isOwnedAgentFile(row.targetPath)).ok`. ENOENT counts as ok (marker.ts:53-85).
4. For each `name` of `discoverGeneratedNames(…).agents` (discover-names.ts: `agentsDiscovery.discovered.map(a => a.generatedName)`), set `target = path.join(locations.agentsDir, `${name}.md`)`. Throw the message above when `!replaced.has(target) && await pathExists(target)`. `pathExists` comes from `shared/fs-utils.ts`, which stage.ts:32 already imports.

Notes on the check:
- **Name parity.** `convertAgent` keeps `discovered.generatedName` (convert.ts:617, 722), so the discovered names equal the commit's names.
- **Containment.** `generatedAgentName` runs `assertSafeName` on the plugin, the source, and the result (domain/name.ts:192-197). The target cannot escape `agentsDir`, and the check only reads. An `assertPathInside(locations.agentsDir, target, "agent target path")` would mirror stage.ts:205, but it is optional, not required.
- **Message parity.** Keep the literal text. Tests compare it exactly (update-swap.test.ts:291, 564).
- **AG-9.** `prepareStagePluginAgents` throws `AgentOwnershipConflictError` before reaching this rule (stage.ts:129-141). The new check does not reproduce AG-9. PI-6 (`assertNoCrossPluginConflicts` on state) covers cross-owner names first.
- **Barrel test.** `test/bridges/agents/index.test.ts` asserts each barrel re-export with `strictEqual`, so a new export needs a new case there.

**(b) Callers of `assertUpdateNamesFree`** (update-swap.ts:1370-1381; it returns the generated names):

| Caller | Site | Policy (`overwrite`) |
|--------|------|----------------------|
| `judgeDependencyMove` | dependency-move.ts:186 (after `preparePluginUpdate` with `judgeOnly`) | `context.policy`: `INSTALL_MOVE_MATERIALIZATION` `overwrite: false` (dependency-bindings.ts:35-40), `RECONCILE_MOVE_MATERIALIZATION` spreads it (46-49), `UPDATE_MATERIALIZATION` `overwrite: false` (update-preflight.ts:177-182) |
| `settleUpdateDependencies` (WR-C) | install-flow.ts:3680 | update root, swapped later with `UPDATE_MATERIALIZATION` |
| `swapPluginUpdate` | update-swap.ts:1407 (uses the returned names for `prepareUpdateHandles`) | the caller's policy. Reinstall's is `overwrite: true` (reinstall-flow.ts:207-219) |

- Reinstall reaches only the swap. `reinstall-flow.ts` calls `materializeLatestVersion` (400-423) with no `settleDependencies`. Only `update-flow.ts:1362` sets it, and `materialize-latest.ts:84` reads it. Reinstall never calls `judgeDependencyMove`.
- `moveArgs` sets no `settleDependencies` (dependency-move.ts:112-136), so moves do not settle their own closures.
- **Required design consequence.** The swap must call a names-only body. Recommended shape: a module-private `assertNamesFree(args, preflight)` holding today's body. The swap calls that. The exported `assertUpdateNamesFree` calls `assertNamesFree`, then the bridge check. Widen its `args` to `Pick<ThreePhaseArgsBase, "marketplace" | "plugin" | "scope" | "locations">`. `locations` is on `ThreePhaseArgsBase` (update-swap.ts:196), and both external callers pass full args.
- No test calls `assertUpdateNamesFree` directly today (no grep hit under `test/`). The agent branch in update-swap.ts therefore needs a direct case in `test/orchestrators/plugin/update-swap.test.ts`.

**(c) How a judge refusal reaches the user.**
- `judgeDependencyMove`'s catch returns `{ ok: false, cause: errorMessage(err) }` (dependency-move.ts:188-191).
- `chooseMoves` builds `Conflict { refusal: ruledOutBy.get(key) ?? unmovable(request, cause), involved: requesters }` (dependency-plan.ts:257-262).
- `ruleOut` finds no involved pick in the previous round's `moving` (first round: empty), so it returns `conflict.refusal` (283-308).
- `unmovable` produces `{ kind: "range-conflict", why: "installed-unsatisfied", …, moveRefusal: cause }` (150-165).
- The install path then runs `planInstallMoves` → `{ err: cascadeFailureCause(subject), cascadeFailure: { subject } }` (3611-3616) → `handleCaughtInstallFailure` → `handleCascadeThrow` (1781-1822) → `composeCascadeFailureMessage`.
- The cause text is `Dependency "<key>" is installed at version <v>, which does not satisfy <range>, and cannot move: <moveRefusal>` (install-cascade.messaging.ts:366-371).
- **No path redaction happens on this route.** Cascade rows serialize causes with `redactCredentials` only (shared/errors.ts:182-195, shared/notification-resolve.ts:568-583). `redactCauseChain` is applied by producers such as `failedMoveRow` (dependency-move.ts:298-309), not centrally. Unredacted absolute paths already appear in rows (the lock-held rows in features/plugin/state-lock.feature:23 etc.).

Measured rows for the RSV-04 scenario. `aaa` and `zzz` are installed at 1.0.0. `app` needs `aaa@^2.0.0` and `zzz@^2.0.0`. `zzz` 2.0.0 adds `agents/helper.md`. The user wrote `.pi/agents/pi-claude-marketplace-zzz-helper.md`.

| Code | Rows |
|------|------|
| Today | `app` failed `dependency failed`. `aaa@tools` **updated** 1.0.0→2.0.0. `zzz@tools` failed, cause `Cannot replace agent target with non-previous content at pi-claude-marketplace-zzz-helper.md` (basename, via `failedMoveRow`). |
| Prototype (check in the judge) | `app` failed `dependency failed`. `zzz@tools` failed `already installed, version conflict`, version `1.0.0`, cause `Dependency "zzz@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0, and cannot move: Cannot replace agent target with non-previous content at {project dir}/.pi/agents/pi-claude-marketplace-zzz-helper.md`. No `aaa` row. |

**(d) WR-C throw versus the swap throw for a plain `update`.**
- Both reject out of `materializeLatestVersion`. `settleDependencies` is awaited with no catch (materialize-latest.ts:84). The swap is called with no catch when the settle has no rows (99-101).
- The swap wraps the error in `errorWithCleanupFailures(err, cleanup)`, which returns the same `Error` when nothing failed to clean (shared/errors.ts:117-124). So message and class are identical.
- Differences:
  - The missing dependencies are not installed first.
  - The `swapAfterSettle` branch, which attaches `dependencyRows` (122-140), is never reached.
- Affected tests: none found.
  - `update-flow.test.ts` mentions only the workflow refusal (12769) and never wires a resolver (no `createUpdateDependencyResolver`).
  - `install-flow.test.ts`'s `createUpdateDependencyResolver` suite (18627-) seeds skill-only catalogs (`publishCatalog`, 18163-18200).
  - `dependency-move.test.ts` has no agents.
  - `features/` has no agent steps.
  - The swap tests (update-swap.test.ts:273-300, 554-575) call `swapPluginUpdate` directly, so they are unaffected if the swap stays names-only.

**(e) `previewInstall` callers and their failure paths.**
- Root preview (`planInstallMoves`, 3596): a throw goes to the catch (3617-3618), giving `{ err, cascadeFailure: { mcpConfigNotices: [] } }` with no subject. `handleCaughtInstallFailure` then routes it to `handleInstallThrow`, a single failed row for the root with the error as cause.
- Fresh node (`planningPorts.preview`, 3331): `previewFresh` turns it into a `member` subject (dependency-plan.ts:418-431). `handleCascadeThrow` then renders the dependency's own row.
- Existing unit tests: install-outcome.test.ts:2446-2580 (`previewInstall …`). A test can inject `cloneProbe` (`InstallLedgerOptions.cloneProbe`, install-outcome.ts:235) to return a `resolvedSha`.

**(f) Cucumber needs.**
- Published agent file: `writePublishedPluginFile(published, plugin, "agents/<name>.md", text)` (features/lib/published-marketplace.ts:471-484) commits and pushes for git publications. Re-offering a plugin keeps its existing files (doc at 513-517), so add the agent after `offers these plugins with dependencies`.
  - Recommended home: a `publishAgent` helper beside `publishOutputStyle` in `features/lib/published-marketplace.ts`, plus a step `the published plugin {string} of the marketplace {string} has the agent {string}` in `features/step_definitions/plugin/publishing.steps.ts`. That module already owns `… has an output style`.
  - Agent body that converts: `---\nname: helper\ndescription: …\ntools: Read, Grep\n---\n\nBody.\n`. AG-11 throws on an empty mapped tool list (stage.ts:101-117). Used in the draft run.
- Hand-written file: `this.scopeRoot(scope)` gives the scope root (features/step_definitions/scope-state.steps.ts:17). Write `<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md`.
  - Recommended home: `features/step_definitions/plugin/installation.steps.ts`. Its header already allows user-setup steps that plant files.
  - Add a `Then` that the file still holds its text, so a wrong implementation that overwrites it fails.
- pi-subagents: not needed. Agents stage without it (it only adds `{requires pi-subagents}` on success rows, install-flow.test.ts:4678). In the scenario no agent ever stages. The draft ran in the stock headless Pi.

## RSV-02 / RSV-03: unit test shapes (dependency-plan.test.ts `ports` fake)

**RSV-02.** A deferring plan refuses on a fresh node only a move reaches. Reuse the MISS-01 graph at dependency-plan.test.ts:375-408 (`"aaa@mp=2.0.0"` has `fresh("fff", ["kept@mp"])`, reachable only through `aaa`). Add `preview: (m) => m.key === "fff@mp" ? Promise.reject(error) : Promise.resolve(undefined)` and call `planDependencyGraph(bound, { deferMoveDependencies: true })`.
- Expected: `{ ok: false, subject: { kind: "member", key: "fff@mp", error, rollbackPartials: [] } }` and `calls.previewed === ["fff@mp"]`. `previewFresh` iterates `graph.nodes` in order (kept, fff, aaa, ggg) and ignores `deferMoveDependencies` (dependency-plan.ts:409-435).
- It fails on a wrong implementation that skips deferred nodes: that plan would return `ok: true` with steps `[move aaa]`.

**RSV-03.** The minimal graph has two recorded dependencies, each with candidates 3.0.0 then 2.0.0. Use `>=2.0.0`, not `^2`: `^2` does not admit 3.0.0. Setup:
- `const R = [{ key: "app@mp", ranges: [">=2.0.0"] }]`.
- Walk `""` returns `graph([wall("aaa","1.0.0",R), wall("bbb","1.0.0",R)], ["aaa@mp","bbb@mp"])`.
- `versions: (j) => ["3.0.0","2.0.0"].find((v) => !(j.excludedVersions ?? []).includes(v))`.

Exact trace:

| Round | Walk signature (`calls.walks`) | Outcome | Judge calls added |
|-------|-------------------------------|---------|-------------------|
| 1 | `""` | graph. `chooseMoves` judges aaa → 3.0.0, bbb → 3.0.0 | `request("aaa", R)`, `request("bbb", R)` |
| 2 | `"aaa@mp=3.0.0,bbb@mp=3.0.0"` | script a walk failure with `declarers: ["aaa@mp","bbb@mp"]`. `ruleOut` tries aaa first: excl `[3.0.0]` → 2.0.0 ok | `request("aaa", R, ["3.0.0"])` |
| 3 | `"aaa@mp=2.0.0,bbb@mp=3.0.0"` | failure, same declarers. aaa excl `[3.0.0,2.0.0]` → none. bbb excl `[3.0.0]` → 2.0.0 | `request("aaa", R, ["3.0.0","2.0.0"])`, `request("bbb", R, ["3.0.0"])` |
| 4 | `"aaa@mp=2.0.0,bbb@mp=2.0.0"` | failure. aaa `[3,2]` is a memo hit (same signature, dependency-plan.ts:219-226). bbb `[3,2]` → none. Returns **round 4's** `conflict.refusal` | `request("bbb", R, ["3.0.0","2.0.0"])` |

- Expected `calls.walks` is the 4 signatures above. Never `"aaa@mp=3.0.0,bbb@mp=2.0.0"`; script it as a settled graph to show the graph is solvable.
- Expected `calls.judged` has 6 entries, in table order.
- Expected plan: `{ ok: false, subject: { kind: "constraint", failure: <round-4 failure>.failure } }`.
- Expected `calls.previewed`: `[]`.
- Map insertion order holds `aaa` before `bbb` (`new Map(moving).set(key, …)` keeps position, dependency-plan.ts:304). That is why the signatures read `aaa…,bbb…`.
- Give the three failures distinct `failure.key`/`range` so the assertion proves round 4's refusal wins. The fixture `contradiction()` hardcodes `fff@mp`, so add a key parameter.

**Port type change.** D-PL4-01 makes `preview` return `Promise<string | undefined>`. The fake's `world.preview` type (dependency-plan.test.ts:119) and the `?? Promise.resolve()` fallback (138) must become `Promise<string | undefined>` / `Promise.resolve(undefined)`, because `Promise<void>` is not assignable [ASSUMED: TS assignability, the typecheck will confirm]. Existing `deepStrictEqual` plans stay valid only if `previewedCommit` is spread conditionally (exactOptionalPropertyTypes).

## RSV-05: change list (from a scratch typecheck and test run)

Source edits:
- `extensions/pi-claude-marketplace/domain/release-tag.ts`: the arm at 53 becomes `{ readonly kind: "no-matching-tag" }`; the return at 112 drops `range`; the import at 16 drops `renderConstraintRange`; the doc at 44 drops the "carries the range" sentence. `renderConstraintRange` stays used by `constraint-fold.ts:26,180` and `dependency-range.ts:300`, so there is no dead export.
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts`: the arm at 66 and the doc at 56-57.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`: the `toMemberConstraintOutcome` parameter at 815. The failure already uses `declared` (834, 860).
- `marketplace-tag-probe.ts`: **no edit**. Its result type is `SelectedReleaseTag | {tag-listing-failed}` (68), so it follows automatically.
- `update-constraint-gate.ts`: **no edit**. Its decoder already types `{ readonly kind: "no-matching-tag" }` (131), which is the precedent.

Compile errors after the change: 20 × TS2353 in `test/orchestrators/plugin/install-cascade.test.ts`, at lines 1085, 1182, 1218, 1454, 1495, 1497, 1527, 1690, 1741, 1824, 1866, 1915, 2102, 2199, 2240, 3674, 3776, 3850, 3907 (TS2345 via a union), and 4004.

Runtime failures (12):
- `test/domain/release-tag.test.ts`: 5 (lines 48, 105, 120, 135, 152). The title "an empty candidate list yields the no-match arm carrying the rendered range" needs a new title.
- `test/orchestrators/plugin/dependency-tag-probe.test.ts`: 5 (244, 262, 286, 304, 323). The title "reports no matching tag with the rendered range…" needs a new title.
- `test/orchestrators/plugin/marketplace-tag-probe.test.ts`: 2 (90, 98).

Fakes that still compile but return a dead `range`. Drop it for honesty:
- install-flow.test.ts:4939, 16126
- update-constraint-gate.test.ts:99, 105, 461

The `{ kind: "no-matching-tag", key, range }` objects are `CascadeConstraintFailure` and are unaffected (install-cascade.ts:252). Examples: install-cascade.test.ts:1997, 2109, 2206; dependency-bindings.test.ts:377.

**D-PL4-06 (b3).**
- `classifyInstallFailure` spreads `rollbackPartials` only when non-empty (install.messaging.ts:664-669).
- `handleCaughtInstallFailure` → `handleInstallThrow` (orchestrated) returns that object (install-flow.ts:1696-1702). `handleCascadeThrow` never sets `rollbackPartials` (1797-1800).
- `installMissingDependencyWithTransaction` spreads `failed` into its outcome (3160-3168). So the field is present exactly when the missing dependency's own ledger (the root member, no subject) had undo failures.
- The change is type-only (install-flow.ts:2964-2974), with no new executable line.
- To observe it: in `install-flow.test.ts`, override `owner.transactionControl.runPhases` (fixture at 347-367; pattern at 163-233) so that, for the inner per-plugin ledger only (phase names `skills…state`; outer phases are named by member key), a later phase throws and the `skills` undo throws. Then assert the failed outcome's `rollbackPartials` phases equal `["skills"]`.

## Standard Stack

No new dependency. Existing tools only: TypeScript strict, `node:test`, `@cucumber/cucumber` ^13.3.0 [VERIFIED: package.json:18], fallow, ESLint.

## Package Legitimacy Audit

Not applicable. This phase installs no external package.

## Architecture Patterns

### Data flow after the change (install with moves)

```
/claude:plugin install app@mp
  → installPluginWithTransaction (first run, locked) → cascade answers "planned"
  → installAfterMoves: planCloneSweep(before)  ─────────────────────────┐
      → planInstallMoves                                                │
          previewInstall(root) ── git? clone/refresh once ──► rootCommit │
                               └─ agent-target check (RSV-04)           │
          planDependencyGraph(ports, { defer, rootCommit })             │
            settleChoices: walk ⇄ judge (judge → assertUpdateNamesFree  │
                             → names + agent-target check)              │
            previewFresh: preview(fresh) → commit per key (+agent check)│
            schedule: members carry previewedCommit                     │
      → runDependencySteps: materialize (dependencyLedgerOptions)       │
                            move (runDependencyMove, no GC)             │
      → installPluginWithTransaction(planned final, inline builder)     │
          member → memberLedgerPin: pin ▸ {oid, version}                │
                                    else previewedCommit ▸ sourcePin    │
          probeInstallClone pinned arm → warm per-commit key, no network│
  → finally: sweep() removes clones created and left unreferenced ◄─────┘
```

### Recommended file touch list

| File | Change | Paired test |
|------|--------|-------------|
| `bridges/agents/<new>.ts` (for example `target-check.ts`) | the write-free check | `test/bridges/agents/<new>.test.ts` (new, Wave 0) |
| `bridges/agents/index.ts` | re-export | `test/bridges/agents/index.test.ts` |
| `orchestrators/plugin/update-swap.ts` | split names-only body, widen Pick, call check | `test/orchestrators/plugin/update-swap.test.ts` |
| `orchestrators/plugin/install-outcome.ts` | `previewInstall` returns commit and runs check | `test/orchestrators/plugin/install-outcome.test.ts` |
| `orchestrators/plugin/dependency-plan.ts` | `preview` port type, commit map, `rootCommit`, header IDs D-PL4-02/03 | `test/orchestrators/plugin/dependency-plan.test.ts` |
| `orchestrators/plugin/install-cascade.ts` | `previewedCommit?` on `ResolvedCascadeMember`, decoder param type | `test/orchestrators/plugin/install-cascade.test.ts` |
| `orchestrators/plugin/install-flow.ts` | `memberLedgerPin` helper in both builders, `rootCommit` from `planInstallMoves`, `dependencyInstallsFollow` doc, `rollbackPartials?` | `test/orchestrators/plugin/install-flow.test.ts` |
| `domain/release-tag.ts`, `orchestrators/plugin/dependency-tag-probe.ts` | drop `range` | `test/domain/release-tag.test.ts`, `test/orchestrators/plugin/dependency-tag-probe.test.ts` (+ `marketplace-tag-probe.test.ts`) |
| `features/plugin/install-dependencies.feature`, `features/lib/published-marketplace.ts`, `features/step_definitions/plugin/{publishing,installation}.steps.ts` | 2 scenarios + agent steps | `npm run check:features` |

Pairing rule: `extensions/pi-claude-marketplace/<p>.ts` ↔ `test/<p>.test.ts` (scripts/check-corresponding-tests.mjs: `expectedTestPath`). Each pair needs 100% line, branch, and function coverage when run alone.

### Anti-patterns to avoid
- **Adding the agent check inside the swap's call.** That would apply `force: false` semantics before reinstall's `overwrite: true` commit, and reinstall would refuse a user-edited own agent that RINST-01 must repair (reinstall-flow.test.ts:777).
- **Setting `resolvedVersion` with `previewedCommit`.** That routes `deriveInstallVersion` into tier 2 (`resolveTagPinnedPluginVersion`) and records a tag-shaped version the plan never chose (install-outcome.ts:494-500).
- **Keying preview commits by anything but `member.key`.** `schedule` and `final` look members up by key (dependency-plan.ts:494-503).
- **Mutating `graph.nodes[].member`.** Build new member objects (`{ ...node.member, previewedCommit }`). The fake's graphs are shared across walks.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Which agent rows a commit replaces | a new ownership rule | `partitionByOwner` + `isOwnedAgentFile` | It must match `partitionPreviousEntries` exactly (stage.ts:295-301). |
| Clone reuse | a new cache lookup | `sourcePinOverride` → pinned arm → `materializePluginClone` warm key | It already exists and is keyed identically. Enable/disable already uses it (enable-disable.ts:930). |
| Path redaction (if chosen) | a regex | `redactAbsolutePaths` / `redactCauseChain` (shared/redact-absolute-paths.ts) | This is the T-55-02-02 seam. |

## Runtime State Inventory

Not a rename or migration phase. Omitted.

## Common Pitfalls

### Pitfall 1: The swap loses reinstall's forced repair
**What goes wrong:** the agent check lands in the shared `assertUpdateNamesFree` while the swap still calls it.
**How to avoid:** use a private names-only body for the swap (update-swap.ts:1407).
**Warning signs:** reinstall-flow.test.ts:777 or the update-swap D-18-15 tests fail.

### Pitfall 2: Cognitive complexity in `installPluginWithTransaction`'s inline builder
**What goes wrong:** adding a branch to the closure at 2335-2357 can push it over 15 under sonarjs or fallow.
**How to avoid:** move the pin logic into the shared helper, which also removes the duplicated `member.pin` spread (1005-1008 vs 2344-2347).

### Pitfall 3: Absolute path in the moved-dependency refusal
**What goes wrong:** the judge-path refusal shows `{project dir}/.pi/agents/…`, while today's swap-time refusal shows only the basename.
**How to avoid:** decide explicitly (see A1). If redacting, apply `redactAbsolutePaths` to `judged.cause` in `unmovable` or at the judge's catch, and pin it in the scenario.

### Pitfall 4: `preview` port type cascade
**What goes wrong:** `Promise<void>` fakes stop compiling.
**How to avoid:** update `dependency-plan.test.ts`'s fake (119, 138) in the same task as the port.

### Pitfall 5: A cucumber scenario that passes without the fix
**What goes wrong:** for RSV-04, asserting only the failed rows passes both before and after. Both fail `app`.
**How to avoid:** the discriminating checks are that `aaa@tools` stays at **1.0.0** in `the installation record of the project scope holds these plugins:`, and that no `aaa` row appears. Today `aaa` moves to 2.0.0.

## Code Examples

The ledger pin helper (shape only; names are at Claude's discretion):
```ts
// install-flow.ts -- used by dependencyLedgerOptions and the inline builder
function memberLedgerPin(
  member: ResolvedCascadeMember,
): { readonly sourcePin?: string; readonly resolvedVersion?: string } {
  if (member.pin !== undefined) {
    return { sourcePin: member.pin.oid, resolvedVersion: member.pin.version };
  }
  return member.previewedCommit === undefined ? {} : { sourcePin: member.previewedCommit };
}
```

The bridge check (shape only):
```ts
// bridges/agents/<new>.ts
export async function assertAgentTargetsFree(
  locations: ScopedLocations,
  owner: { readonly marketplace: string; readonly plugin: string },
  generatedNames: readonly string[],
): Promise<void> {
  const { previous } = partitionByOwner(
    (await loadAgentsIndex(locations)).agents,
    owner.marketplace,
    owner.plugin,
  );
  const replaced = new Set<string>();
  for (const entry of previous) {
    // eslint-disable-next-line no-await-in-loop -- one ownership read per prior agent
    if ((await isOwnedAgentFile(entry.targetPath)).ok) {
      replaced.add(entry.targetPath);
    }
  }
  for (const name of generatedNames) {
    const target = path.join(locations.agentsDir, `${name}.md`);
    // eslint-disable-next-line no-await-in-loop -- the first occupied target throws
    if (!replaced.has(target) && (await pathExists(target))) {
      throw new Error(`Cannot replace agent target with non-previous content at ${target}`);
    }
  }
}
```

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Leave the judge-path agent refusal unredacted. It then matches D-PL4-04 ("the commit's own message") and today's lock-held rows, but differs from today's basename-only swap-time row. | RSV-04 (c) | A reviewer may call it a T-55-02-02 regression. Confirm with the user, or redact in `unmovable`. |
| A2 | `Promise<void>` is not assignable to `Promise<string \| undefined>`, so the plan test fake must change. | RSV-02/03 | Low. The typecheck decides. |
| A3 | A git-source root of an install plan reaches the plan only when its catalog entry, or an existing clone, exposes its dependencies, so `rootCommit` is shown by unit test only. | RSV-01 (g) | Low. If a cucumber root scenario is wanted, it needs a marketplace entry that declares dependencies. |

## Open Questions

1. **Redact the absolute path in the move refusal?** What we know: today's swap-time row shows the basename, and the judge-path row would show the full path. Recommendation: ask in the plan review. Default: unredacted (A1).
2. **One cucumber scenario or two for RSV-01?** The fresh-dependency scenario is proven discriminating (4 rows → 2 rows). A root scenario is not reachable with today's steps (A3). Recommendation: one scenario, plus a `rootCommit` unit test in install-flow.test.ts using a counting `cloneCacheSeam` (`seamWith(gitOps)`, install-flow.test.ts:11132-11140; `createGitOps` state `cloneCalls`, 11067-11126).

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | v26.12.1 | — |
| cucumber-js | scenarios | ✓ (ran the drafts) | ^13.3.0 | — |
| loopback https git host | RSV-01 scenario | ✓ (features/lib/https-git-host) | — | — |
| pi-subagents | not needed | — | — | — |

## Validation Architecture

### Test framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit), `@cucumber/cucumber` ^13.3.0 (behavior) |
| Config file | package.json scripts; `cucumber.json` (parallel 8, random order) |
| Quick run command | `node --test <test-path>`, or `node --test --test-name-pattern '<title>' <test-path>` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` (100% line, branch, function) |
| One scenario | `npx cucumber-js --name '<scenario title>'` |
| Full suite command | `npm run check` (static + unpaired + integration + **test:cucumber** + direct coverage, all pairs) |

### Phase requirements → test map
| Req ID | Behavior | Type | Automated command | File exists? |
|--------|----------|------|-------------------|-------------|
| RSV-01 | the plan carries the preview commit to members and the root | unit | `node --test test/orchestrators/plugin/dependency-plan.test.ts` | ✅ |
| RSV-01 | `previewInstall` returns `resolvedSha` (via `cloneProbe` fake), `undefined` for path/absent | unit | `node --test test/orchestrators/plugin/install-outcome.test.ts` | ✅ |
| RSV-01 | the install after moves reads the copy: no `materializeOrRefreshPluginMirror` / no clone in the final run; root uses `rootCommit` | unit | `node --test --test-name-pattern 'UPD-DEP-D1' test/orchestrators/plugin/install-flow.test.ts` | ✅ |
| RSV-01 | install that moves a dependency fetches a fresh git dependency once | cucumber | `npx cucumber-js --name '<RSV-01 title>'` | ❌ add to install-dependencies.feature |
| RSV-02 | deferring plan refuses on a fresh node only a move reaches | unit | `node --test test/orchestrators/plugin/dependency-plan.test.ts` | ✅ |
| RSV-03 | 2x2 solvable graph refused; walks and judged exactly as traced | unit | same | ✅ |
| RSV-04 | bridge check: occupied, owned-previous, foreign-previous, ENOENT, empty index | unit | `node --test test/bridges/agents/<new>.test.ts` | ❌ Wave 0 |
| RSV-04 | barrel re-export binding | unit | `node --test test/bridges/agents/index.test.ts` | ✅ |
| RSV-04 | `assertUpdateNamesFree` refuses an occupied target; swap stays names-only (forced reinstall still repairs) | unit | `node --test test/orchestrators/plugin/update-swap.test.ts` | ✅ |
| RSV-04 | WR-C refuses before installing a missing dependency | unit | `node --test --test-name-pattern 'createUpdateDependencyResolver' test/orchestrators/plugin/install-flow.test.ts` | ✅ |
| RSV-04 | `previewInstall` refuses an occupied target | unit | `node --test test/orchestrators/plugin/install-outcome.test.ts` | ✅ |
| RSV-04 | an install whose 2nd move would overwrite a user's agent file fails and the 1st dependency keeps 1.0.0 | cucumber | `npx cucumber-js --name '<RSV-04 title>'` | ❌ add |
| RSV-05 | no-match arm has no range | unit | `node --test test/domain/release-tag.test.ts test/orchestrators/plugin/dependency-tag-probe.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts test/orchestrators/plugin/install-cascade.test.ts` | ✅ |
| RSV-05 | the missing-dependency failed outcome carries `rollbackPartials` | unit | `node --test --test-name-pattern 'MISS-01' test/orchestrators/plugin/install-flow.test.ts` | ✅ |

### Sampling rate
- **Per task commit:** the owner test(s) above, plus `npm run test:coverage:direct -- <each changed source>`. The pre-commit hook runs `check:commit`, which covers static checks and staged pairs. It does **not** run cucumber.
- **Per task touching `features/`:** `npm run check:features` plus the one scenario via `npx cucumber-js --name`.
- **Per wave merge / phase gate:** `npm run check` on the combined tree (AGENTS.md "Build verification").

### Wave 0 gaps
- [ ] `test/bridges/agents/<new>.test.ts`: covers RSV-04's pure check (pairs with the new bridge module).
- [ ] A `contradiction`-with-key variant in dependency-plan.test.ts, for RSV-03's distinct round failures.
- [ ] Cucumber steps: an agent publish step plus a hand-written agent file `Given` and its `Then`.

## Security Domain

| ASVS category | Applies | Control |
|---------------|---------|---------|
| V5 Input validation | yes | Generated agent names pass `assertSafeName` (domain/name.ts:192-197). The new check only reads. |
| V12 Files and resources | yes | No new write path. The check reads `agents-index.json` and stats `<scope>/agents/*.md`. NFR-10 is unaffected. |
| V7 Error and logging | yes | Absolute-path disclosure in a row cause (A1, T-55-02-02). |
| V2/V3/V4/V6 | no | — |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| A user file silently overwritten by a dependency move | Tampering | RSV-04's refusal before any move lands. The commit-time check stays as the backstop. |
| A stale commit installed between preview and install | Tampering / integrity | RSV-01 pins the exact previewed sha. The per-commit copy is immutable (clone-cache.ts:320-349). |

## Sources

### Primary (HIGH confidence, read this session)
- `orchestrators/plugin/{dependency-plan,install-flow,install-outcome,install-clone-probe,clone-cache,clone-gc,dependency-bindings,dependency-settle,dependency-move,update-swap,materialize-latest,reinstall-flow,update-flow,update-preflight,install-cascade,install-cascade.messaging,dependency-tag-probe,update-constraint-gate}.ts`, `domain/{release-tag,clone-key,name}.ts`, `bridges/agents/{stage,index-mutation,marker,index}.ts`, `persistence/agents-index-io.ts`, `shared/{redact-absolute-paths,notification-present,notification-resolve,errors}.ts`.
- Tests: dependency-plan.test.ts, install-flow.test.ts (fixtures 160-370, 11060-11140, 18146-18790), update-swap.test.ts:255-575, install-outcome.test.ts:2446-2580, features/plugin/install-dependencies.feature, features/step_definitions/{git-host,plugin/publishing,plugin/installation,scope-state}.steps.ts.
- Experiments (scratch copy, not committed): the draft scenarios and prototypes under `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-pl-p4-resolver-b12272/5c8e9397-d990-44c1-951d-720265174ac9/scratchpad/repo/features/zzdraft/`. A scratch `tsc --noEmit` and `node --test` ran with `range` removed.

## Metadata

**Confidence breakdown:**
- RSV-01 mechanism: HIGH (code plus a measured prototype)
- RSV-04 mechanism and rendering: HIGH (code plus a measured prototype)
- RSV-02/03 traces: HIGH (hand-traced against dependency-plan.ts; not executed)
- RSV-05 change list: HIGH (compiler and test run)

**Research date:** 2026-10-26
**Valid until:** until the next merge that touches `install-flow.ts` or `dependency-plan.ts` (line numbers shift; the mechanisms stay)
