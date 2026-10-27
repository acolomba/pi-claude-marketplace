# Phase 4: Dependency Resolver Residue - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning
**Mode:** autonomous discuss. The parent session of wave 1 asked for a run
without prompts: every open choice took the most consistent answer, checked
against Claude Code 2.1.310, and each choice that was not clear-cut is listed
under "Uncertain choices" below.

<domain>
## Phase Boundary

The UPD-DEP-D1 dependency resolver (`orchestrators/plugin/dependency-plan.ts`
and its ports in `install-flow.ts`) leaves five items open (UPDDEP-01 b1 b4 b5
b6, LCCODE-01 b2 b3). This phase closes them:

- **RSV-01 (b1):** the plan previews a fresh dependency over the network, then
  the install fetches it again and can land a commit the plan never previewed.
- **RSV-02 (b4):** under `apply`, the plan previews dependencies that apply's
  own later MISS-01 step installs, so one bad dependency refuses the root
  before its moves land. Decide whether it should.
- **RSV-03 (b5):** the resolver is a tentative-pick search with permanent
  rule-outs, not a complete solver. Compare with Claude Code; make it complete
  or record the limit with an ID.
- **RSV-04 (b6):** an occupied agent target refuses only in a move's swap,
  after earlier moves have landed.
- **RSV-05 (b2, b3):** the unread `range` of the tag probes' `no-matching-tag`
  answer, and the undeclared `rollbackPartials` of the failed arm of
  `InstallMissingDependencyOutcome`.

Out of scope: `install-flow.ts`'s restructuring (Phase 11), the cascade rows
and status (Phase 3), the git error classification of `dependency-tag-probe.ts`
(Phase 7), `apply`'s rendering of a rollback partial (LCORCH-01, not this
phase), the workflow-target refusal (see Deferred).

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (one record, used by every decision below)

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

### RSV-01: the previewed commit is the installed commit
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

### RSV-02: one bad dependency under `apply`
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

### RSV-03: the resolver's completeness
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

### RSV-04: agent-target refusals before any move lands
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

- **D-PL4-07:** a move refusal's cause is shown with absolute paths reduced to
  their last segment (`redactAbsolutePaths`), applied where the plan builds
  the refusal (`dependency-plan.ts::unmovable`). Today a move that fails in
  the swap shows the redacted basename (`failedMoveRow`, T-55-02-02); the
  same failure found by the plan must read the same.

### RSV-05: probe and outcome types
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dependency-plan.ts`: `planDependencyGraph`, `previewFresh`, `schedule`
  (where planned members are built), `DependencyPlanPorts.preview`.
- `install-flow.ts`: `planningPorts` (binds `preview` to `previewInstall`),
  `planInstallMoves` (previews the root), `dependencyLedgerOptions` and the
  inline `ledgerOptionsFor` in `installPluginWithTransaction` (both map
  `member.pin` to `sourcePin` / `resolvedVersion`), `settleUpdateDependencies`
  (WR-C: `assertUpdateNamesFree`), `InstallMissingDependencyOutcome`.
- `install-outcome.ts`: `previewInstall`, `preflightInstallResolve` (captures
  `resolvedSha`), `deriveInstallVersion`.
- `install-clone-probe.ts::probeInstallClone`: the pinned arm (`source.sha`)
  versus the unpinned arm (`materializeUnpinnedSource`, which refreshes a
  present mirror).
- `update-swap.ts`: `assertUpdateNamesFree` (exported; called by
  `dependency-move.ts::judgeDependencyMove`, `install-flow.ts`, and the swap).
- `bridges/agents/stage.ts::assertAgentCommitTargets`,
  `index-mutation.ts::partitionByOwner`, `marker.ts::isOwnedAgentFile`,
  `persistence/agents-index-io.ts::loadAgentsIndex`,
  `domain/name.ts::generatedAgentName` (`pi-claude-marketplace-<plugin>-<agent>`).
- `discover-names.ts::discoverGeneratedNames` returns `agents` (the generated
  agent names).

### Established Patterns
- Ports keep the plan pure: `test/orchestrators/plugin/dependency-plan.test.ts`
  scripts walks, judges and previews.
- `features/plugin/install-dependencies.feature` covers git-source
  dependencies (`the git repository ... holds these plugins`, `offers these
  plugins from git repositories`) and network traffic (`the git host receives
  these requests`, which lists the last command's requests).

### Integration Points
- `dependency-move.ts` (Phase 3) and `dependency-settle.ts` (Phase 1) are not
  edited: both reach the new behavior through `assertUpdateNamesFree` and the
  plan's steps.
- `install-cascade.ts` (Phase 3) changes in two places only: the
  `ResolvedCascadeMember` field and the `toMemberConstraintOutcome` parameter
  type.

</code_context>

<specifics>
## Specific Ideas

- RSV-01 scenario: installing a plugin that moves an installed dependency and
  needs a fresh, unpinned git dependency fetches that repository once. The
  git host receives one `info/refs` and one `git-upload-pack` request for it.
  Without the fix it receives a second fetch from the install's refresh.
- RSV-04 scenario: a plugin needs two installed dependencies moved. The
  second one's new version adds an agent whose target in the project's
  `agents/` directory already holds a hand-written file. The install fails,
  and the first dependency keeps its old version. Without the fix, the first
  dependency moves and stays moved.

</specifics>

<deferred>
## Deferred Ideas

- **Workflow-target refusals** (`Cannot replace workflow target with
  non-previous content`) are made in a move's swap too: in the workflows
  bridge's prepare or commit, after earlier moves have landed. RSV-04 names
  agent targets only. Proposed as a new backlog entry.
- **Re-enabled members:** a disabled recorded dependency that the plan
  re-enables runs the install ledger again, and its agents commit can refuse
  an occupied target after a move landed. The plan previews fresh nodes only.
- **`apply`'s deferred fresh dependencies:** these are resolved again by
  MISS-01 (D-PL4-01, last bullet).

</deferred>

## Uncertain choices (for user review)

1. **RSV-01 covers the install root too.** Chosen: the root of an install plan
   also installs its previewed commit. Alternative: only fresh dependencies,
   as RSV-01's text says. Why: the root is previewed by the same plan and has
   the same double fetch.
2. **RSV-01 leaves `apply`'s deferred dependencies out.** Chosen: a fresh
   dependency that apply's MISS-01 step installs keeps its own resolve.
   Alternative: thread the previewed commits into the MISS-01 step, or skip
   previewing those nodes. Why: MISS-01 walks the graph again in a later step,
   with its own failure reporting, and threading commits across apply steps is
   new plumbing outside this phase's files.
3. **RSV-02 keeps the refusal.** Chosen: one bad dependency anywhere in the
   graph refuses the root before its moves land, under `apply` too.
   Alternative: under `apply`, do not preview the nodes MISS-01 installs, so
   the root and its moves land and MISS-01 reports the bad dependency on its
   own row, closer to `resolveMissingDependencies`, which only logs. Why:
   upstream's install of one plugin is all or nothing over its closure, and
   that install is what apply's config install mirrors.
4. **RSV-03 records the limit.** Chosen: no complete solver. Alternative: a
   complete backtracking search. Why: upstream is strictly greedy, and a
   complete search multiplies judge calls and tag reads.
5. **RSV-04 also moves a plain update's refusal earlier.** Chosen: the WR-C
   check refuses an occupied agent target before the first cascade run, so an
   update with no moves no longer installs its missing dependencies before
   refusing. Alternative: run the check only when a plan is needed. Why: it is
   the same "refuse before anything lands" rule, the message is unchanged, and
   splitting WR-C by whether a plan follows adds a branch for no user benefit.
6. **RSV-04 extends to install previews.** Chosen: `previewInstall` runs the
   agent-target check, so an install plan's root and fresh dependencies refuse
   before any move lands. Alternative: limit the check to updates (moves and
   the update root), as RSV-04's text says. Why: the phase goal is "refuses
   before any move lands", and the install steps land after the moves.
8. **D-PL4-07 redacts the move refusal's paths.** Chosen: the basename only,
   as the swap's failed move row shows today. Alternative: the full path, as
   lock-held rows show. Why: the same failure should read the same wherever
   it is found.
7. **RSV-05 b2 removes the field.** Chosen: remove the unread `range`.
   Alternative: read it. Why: every caller already renders the declared
   ranges. Removing it touches Phase 3's `install-cascade.ts` (one parameter
   type) and `install-cascade.test.ts` (the probe answers its fakes return).
