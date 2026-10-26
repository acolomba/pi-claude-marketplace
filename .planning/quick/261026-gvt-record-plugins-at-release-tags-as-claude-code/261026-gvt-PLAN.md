---
quick_id: 261026-gvt
description: record plugins at release tags as Claude Code does
date: 2026-10-26
mode: quick
---

# Quick task 261026-gvt: release-tag version parity

## Findings

- GV-01 left one upstream rule out. Claude Code records a plugin that a
  dependency's version range installs at a release tag as
  `<declared>-<tag commit 12>` (`vqt`), and keeps the tag's semver as
  `resolvedVersion`.
- This extension recorded the tag's semver as the version itself
  (RESV-05).
- The suffixed form is a semver prerelease, so a range such as `^1.2.0`
  rejects it. Every range check must read the tag's semver first.

## Plan

1. Read the install, update and range read-back rules from the Claude
   Code 2.1.310 binary.
2. Add `withTagCommit` and `tagShaVersion` to `domain/version.ts`, and
   `resolveTagPinnedPluginVersion` to `orchestrators/plugin/shared.ts`.
3. Record `resolvedVersion` on install (cascade members, plan moves) and
   on update (update, autoupdate, apply, reinstall, dependency moves).
   Carry it through enable, re-enable and promotion.
4. Read `resolvedVersion ?? version` in RESV-05, UPD-DEP-D1, the load and
   apply verdicts, and the plan's ruled-out versions. A catalog move
   drops it.
5. Keep `isSameVersion`, list, completion and convergence from reading a
   suffixed record as a move; treat a record written before GV-01 at the
   same tag and commit as unchanged.
6. Update GV-01/GV-02, the docs and the CHANGELOG.

## Tests (written first)

Cucumber: a fresh dependency at a tag, a second install that asks for
the same dependency, an update at the same tag, an update to a newer
tag, and `pending` after the install; the four existing tag scenarios
move to the suffixed form. Unit cases in `version`, `shared`,
`state-io`, `install-outcome`, `install-cascade`, `install-flow`,
`enable-disable`, `update-preflight`, `update-flow`, `dependency-plan`,
`dependency-verdict`, `convergence`, `list-installed-row` and
`edge-deps`.

- verify: the nine scenarios fail on 5a4099a1; they pass on Node 22, 24
  and 26; `npm run check` exits 0.
