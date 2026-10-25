---
phase: 16-git-plugin-copies-and-version-rule
plan: 02
requirements-completed: [VER-01]
status: complete
---

# 16-02 Summary: one version rule

## What changed

- `shared.ts`: `resolvePluginVersion(entry, installable, resolvedSha?)` is the
  one rule (D-08): plugin.json version, then the marketplace entry version,
  then `sha-<12hex>` when a git commit is given, then the content hash. New
  export `resolveDeclaredPluginVersion` holds the first two tiers.
- `install-outcome.ts` (`deriveInstallVersion`) and `update-preflight.ts`
  (`deriveUpdateToVersion`) pass the commit for git kinds only; the enable
  pin override and a tag pin's version keep their precedence.
- `update-preflight.ts`: new `isSameRevision` (D-09). `unchanged` needs the
  same version and, for a git source whose record stores a sha, the same sha.
  The disabled-plugin refresh uses the same check, so a disabled plugin whose
  commit moved reports `skipped {already disabled}`, not `unchanged`.
- `info.ts` (warm not-installed git row) and `list-candidate-row.ts` (warm git
  candidate rows) show the same rule against the warm tree (D-10).
- Scenarios: every git version cell that stated `{<repo> revision N}` now
  states the declared version (fetch, git-source, git-source-update, info,
  prune). New scenarios: a plugin that declares no version is shown as
  `{ghp revision 2}` by install, list, and info; an update to a new commit at
  the same declared version reports `updated` 1.0.0 to 1.0.0 and the plugin
  runs revision 2. New step `the git-source plugin {string} of the git
  repository {string} declares no version`.

## Verification

- Direct coverage 100% for `shared`, `install-outcome`, `update-preflight`,
  `info`, `list-candidate-row`.
- Unit suites install/update/reinstall/info/list/enable-disable pass; 24
  tests that pinned D-77-01 (sha over a declared version) were updated, and
  new tests cover the sha tier, declared-over-sha, the same-version new-commit
  update, and a warm git-subdir row that lacks its subdir.
- `npx cucumber-js`: 706/706 scenarios.

## Deviations

- The unit fixtures that seeded records as `sha-...` while their plugin.json
  declared `9.9.9` now seed the declared version, the record an install makes
  under the new rule.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
