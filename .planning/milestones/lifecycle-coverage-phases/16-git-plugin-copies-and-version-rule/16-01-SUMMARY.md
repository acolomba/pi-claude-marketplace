---
phase: 16-git-plugin-copies-and-version-rule
plan: 01
requirements-completed: [GIT-01, GIT-02]
status: complete
---

# 16-01 Summary: per-commit git copies and clone cleanup

## What changed

- `clone-cache.ts`: new `materializePluginCommitCopy` (D-02). It returns the
  per-commit copy `plugin-clones/<url12>-<sha12>/` when present, else copies
  the URL-keyed mirror and checks out the commit (local, atomic rename), else
  clones the commit through `materializePluginClone`.
- `install-clone-probe.ts` and `update-preflight.ts`: the unpinned arm keeps
  the mirror step and then installs from the per-commit copy at the mirror's
  HEAD (D-03). `fetch` and `info --fetch` are unchanged and touch only the
  mirror (D-04).
- `reinstall-clone-probe.ts`: every git reinstall restores the copy at the
  recorded sha (D-05). This fixed a bug: an unpinned reinstall read the
  mirror's HEAD but kept the old sha and version in the record.
- `git-source-probe.ts` (`makeRecordedShaPresenceProbe`): the reload
  migration reads the recorded-sha copy first, and a mirror only when its HEAD
  is the recorded sha (D-06).
- `clone-gc.ts`: a live `<url12>-<sha12>` copy also keeps the mirror
  `<url12>`; every other directory is swept (D-07).
- Scenarios: `fetch.feature` (a fetch leaves the installed plugin at
  revision 1), `git-source-update.feature` (update moves it to revision 2;
  cleanup keeps the mirror and the new copy), `git-source.feature` (cleanup
  keeps an installed plugin's copy and mirror and removes a fetch-warmed
  mirror of a plugin that is not installed). New step module
  `features/step_definitions/plugin/git-source.steps.ts`; `fetch.steps.ts`
  reads the mirror only.

## Verification

- Direct coverage 100% for `clone-cache`, `clone-gc`, `git-source-probe`,
  `install-clone-probe`, `reinstall-clone-probe`, `update-preflight`.
- install/update/reinstall/fetch/info/list/mcp-migration unit suites pass
  after the six tests that pinned the mirror as `resolvedSource` were updated.
- `npx cucumber-js` on git-source, git-source-update, fetch: 21/21.
- `npm run check:features` green.

## Deviations

- The `declares no version` step was written here and moved to plan 02,
  which first uses it (the feature gate fails on an unused step).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
