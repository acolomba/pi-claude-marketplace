---
quick_id: 261026-dpt
description: match Claude Code on directory pins and tag-commit listings
date: 2026-10-26
mode: quick
---

# Quick task 261026-dpt: directory pins and tag-commit listings

## Findings

- 261026-glv kept three divergences from Claude Code 2.1.310:
  - `list` and completion read `<v>-<commit 12>` at the recorded commit
    as `<v>`. Claude Code's only installed-versus-available check, the
    install hint (`vt`), compares the strings (`availableVersion !==
    installedVersion`).
  - The MISS-01 refusal of a plugin directory copy named no requirer.
    Claude Code's cascade names every plugin whose range it is (`dr`,
    seeded by `_Co` with the installed declarers that carry a range).
  - An update of a pinned plugin directory plugin ran the range check
    when the listed commit was the recorded one. Claude Code returns
    `up_to_date` first (`AZ(b, k.source) === B.gitCommitSha`).

## Plan

1. Read `updatePluginOp`, `resolveMissingDependencies`, the cascade's
   `qs`/`_Co`, and the install hint (`Rt`/`vt`/`yi`) in the binary.
2. `list-installed-row` and `edge-deps` compare the recorded string;
   `apply` keeps D-23's reading.
3. The plan carries the ranged declarers as `requirers`; `apply` passes
   them to `installMissingDependency`, the cascade's `rootRequiredBy`
   reaches the root's `directoryPin`, and the error names every one.
   `apply` classifies `DirectoryPinUnsatisfiedError` as
   `{version conflict}` and carries it as the row's cause.
4. `preparePluginUpdate` returns `unchanged` for a pinned directory plugin
   whose listed commit is the recorded one, before the clone and the
   post-fetch guard, under every policy that skips the same revision.
5. Update GV-01, `docs/dependency-resolution.md`, `docs/output-catalog.md`
   and the CHANGELOG.

## Tests (written first)

Cucumber: `list` after a tag install with a warm mirror, `apply`'s
MISS-01 refusal of a directory copy outside the range, and `update` of a
pinned directory plugin at its listed commit outside a dependent's range.
Unit cases in `version`, `errors`, `install-outcome`, `install-cascade`,
`install-cascade.messaging`, `install-flow`, `plan`, `apply`,
`apply-outcomes`, `update-preflight`, `list-installed-row`, `edge-deps`,
and a catalog state `reconcile-dependency-directory-pin-unsatisfied`.

- verify: the three scenarios fail on 6c0eaf69; they pass on Node 22, 24
  and 26; `npm run check` exits 0.
