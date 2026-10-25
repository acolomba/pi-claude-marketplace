---
phase: 27-install-and-reconcile-reason-residue
plan: 01
subsystem: install, reconcile, import and marketplace remove reasons
tags: [install, cascade, reconcile, import, marketplace-remove, git]
requires: [INR-05, INR-06, REC-06, MPR-01]
decisions: [D-01, D-02, D-03, D-04, D-05, D-06, D-07]
requirements-completed: [INR-06, REC-06, MPR-01]
---

# Plan 27-01 Summary: Install and reconcile reason residue

## What changed

- **INR-05:** `install-cascade.ts::renderDeclaredRanges` gives every
  `CascadeConstraintFailure.range` the member's declared ranges joined with
  `, ` (Claude Code's form), bounded as before. The `{no matching version}`
  arms (probe and tagless source) and the tag-listing arm report declared
  ranges too. The cause sentences in `install-cascade.messaging.ts` drop the
  quotes. A `||` range keeps its meaning (`^1.0.0 || ^2.0.0, ^3.0.0`).
- **INR-06:** `PinnedCommitMissingError` no longer chains isomorphic-git's
  `CommitNotFetchedError`, so the cause is just "A fresh clone from the git host
  does not hold the commit <sha>". `platform/git.ts::FetchOptions` and the
  `GitOps.fetch` port gain `tags`; the ref-hint recovery fetch passes
  `tags: true`, so a pin only a tag reaches installs.
- **REC-06:** `reconcile/apply-outcomes.ts::installFailureReasonFields` gives a
  failed reconcile install of a plugin that cannot be installed install's
  narrowed reasons (`narrowResolverReasons`), carried on the new optional
  `PluginInstallFailedOutcome.reasons` and rendered by `notify.ts`. The failed
  `InstallPluginOutcome` carries `rollbackPartials`
  (`install.messaging.ts::classifyInstallFailure`), and `import` reads them as
  `{rollback partial}`.
- **MPR-01:** `withoutDisabledHolders` moved to `plugin/dependency-index.ts`;
  `marketplace remove`'s layer refusal runs over the filtered index.

## Tests

- Cucumber: `git-source.feature` (a tag-only pin on the ref-hint path, with
  new steps for a tag-only revision and a source ref; the missing-pin cause
  line), `install-dependencies.feature` (comma-joined unquoted ranges),
  `reconcile.feature` (a hand-declared partly supported plugin reads
  `{unsupported component}`), `remove.feature` (a disabled local-layer holder
  does not refuse the base-layer remove).
- Unit: install-cascade (declared ranges everywhere, `||` case),
  install-cascade.messaging, install-flow, catalog fixtures and byte pin,
  clone-cache (tags on the recovery fetch, no chained cause), platform/git
  (tag fetch), errors, apply-outcomes (`installFailureReasonFields` arms),
  apply (missing source tree now `{source missing}`), notify (narrowed row),
  import execute (rollback partial), install.messaging (partials carried),
  dependency-index (`withoutDisabledHolders`), marketplace remove (MPR-01).
- `docs/output-catalog.md`: the dependency cause examples use the new form.

## Deviations

- `test/orchestrators/reconcile/apply.test.ts`: the RECON-03 missing-source
  cases now read `{source missing}`, install's narrowing of that resolver note
  (phase 20).
- Feature step support refactored to clear fallow clone groups
  (`changeGitPluginSource`, `replaceRepositoryPlugins`).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
