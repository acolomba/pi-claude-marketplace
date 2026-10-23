# Phase 27: Install and Reconcile Reason Residue - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

The reasons phases 22-24 aligned read the same in every remaining command.
Requirements: INR-05, INR-06, REC-06, MPR-01. The orchestrator's 2026-10-23
decision in ROADMAP "### Phase 27" is binding: follow Claude Code's range form;
carry install's narrowed reasons into reconcile and import; match named
uninstall's disabled-holder rule. Fetching an unreachable pinned sha directly is
out of scope (put to the user). Phase 18 runs in parallel: no `update-*` or
`reinstall-*` edits.

</domain>

<decisions>
## Implementation Decisions

### INR-05: declared ranges, Claude Code's form
- **D-01:** Claude Code 2.1.309's dependency formatter (`Vfn`) prints
  `ranges.map(q).join(", ")`, unquoted (phase 22 D-01). Every
  `CascadeConstraintFailure.range` becomes the member's declared ranges joined
  with `, ` and bounded by `renderConstraintRange` (one helper in
  `install-cascade.ts`): contradictory declarations, installed-unsatisfied,
  too complex, invalid, no matching version (both the probe arm and the
  tagless-source arm) and tag-listing failed. The cause sentences drop the
  quotes around the range. A `||` range now keeps its meaning
  (`^1.0.0 || ^2.0.0, ^3.0.0`).
- **D-02:** The `{no matching version}` arm reports the declared ranges, not
  the probe's normalized intersection (upstream prints the declared
  constraint: `has no git tag satisfying ...`).

### INR-06: the missing-pin cause and tag-only pins
- **D-03:** `PinnedCommitMissingError` no longer chains isomorphic-git's
  `CommitNotFetchedError` as its cause. Its own message names the commit; the
  library's "Do a git fetch to make the branch available locally" advice cannot
  be acted on inside Pi. This is a deliberate exception to "wrap with
  `{ cause }`": the dropped error adds nothing but that advice.
- **D-04:** The ref-hint recovery fetch passes `tags: true`.
  `platform/git.ts::FetchOptions` and the `GitOps.fetch` port gain an optional
  `tags` flag passed to isomorphic-git's `fetch` (its default `tags: false`
  keeps only `refs/heads/*`). A pin reachable only from a tag then installs on
  the ref-hint path, as it already did on the no-ref path (clone fetches tags).

### REC-06: reconcile and import reasons
- **D-05:** Reconcile's failed install of a plugin that cannot be installed
  (`PluginShapeError` `not-installable` / `no-longer-installable`) reads
  install's narrowed reasons (`narrowResolverReasons`, as import's IMP-08
  does). `PluginInstallFailedOutcome` gains an optional `reasons` list that the
  row renders when set; `reason` stays the summary token `no longer
  installable`, so every reader of the single reason is unchanged. (Amended in
  review: the missing-dependency arm uses the same fields.) The row keeps reconcile's `failed` status.
- **D-06:** The orchestrated install's failed outcome carries
  `rollbackPartials` (when any), and `import` reads them: a rollback-partial
  install reads `{rollback partial}` as `install`'s row does. The per-phase
  child rows are not rendered by import (its outcome shape has no slot; listed
  for the user).

### MPR-01: marketplace remove's holders
- **D-07:** `withoutDisabledHolders` moves from `plugin/uninstall.ts` to
  `plugin/dependency-index.ts` (exported), and `marketplace remove`'s
  layer-only refusal runs over the filtered index. The dependency cascade that
  follows keeps the full index, as named uninstall's orphan sweep does.

### Tests
- **D-08:** Cucumber: the conflict and no-matching-version cause lines in
  `install-dependencies.feature` (and any other feature quoting a range);
  a tag-only pin on the ref-hint path and the missing-pin cause in
  `git-source.feature`; a reconcile scenario for an uninstallable declared
  plugin; a `marketplace remove` scenario with a disabled holder. Unit tests for
  every new branch.

</decisions>

<deferred>
## Deferred Ideas

- Fetching a pinned sha no branch or tag reaches (user decision).
- Import's rollback-partial child rows.
</deferred>
