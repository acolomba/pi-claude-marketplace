---
quick_id: 261026-glv
description: match Claude Code on untagged updates and plugin directory ranges
date: 2026-10-26
mode: quick
---

# Quick task 261026-glv: untagged updates and plugin directory ranges

## Findings

- 261026-gvt kept two divergences from Claude Code 2.1.310:
  - An update that finds no release tag, at the commit a record's tag
    names, reports unchanged. Claude Code compares the recorded string
    (`B.version === qe`) and rewrites the record without the commit,
    deleting `resolvedVersion` (`MYn`).
  - A plugin of `anthropic-plugin-directory` picks a release tag by range.
    Claude Code never does: `mCo` drops the tag for it, the cascade passes
    the range as `be` instead, and `updatePluginOp` skips `IOr` for it.

## Plan

1. Read the install, cascade and update paths of the 2.1.310 binary for
   what a directory plugin under a range does instead of a tag.
2. `isSameRevision` takes `{ resolvedVersion, searched }`; a candidate from
   a verb that searches tags compares the recorded string. `apply` (D-23)
   keeps reading `<v>-<commit 12>` as `<v>`.
3. Skip tag selection for directory plugins in the update gate and the
   install cascade; install checks the listed copy's `plugin.json`
   version against the range and refuses with Claude Code's message.
4. Read a pinned directory plugin's declared version wherever a range
   reads a record or a candidate (`rangeVersionOf`, the post-fetch guard,
   the plan).
5. Update GV-01, `docs/dependency-resolution.md`, `docs/output-catalog.md`
   and the CHANGELOG.

## Tests (written first)

Cucumber: an update with no range left at the tag's commit, the update
after it, a directory dependency installed at its listed copy, a
directory copy outside its range, an installed pinned directory plugin a
new range reads, and a directory update with a newer tag. Unit cases in
`version`, `state-io`, `shared`, `update-preflight`,
`update-constraint-gate`, `install-cascade`, `install-cascade.messaging`,
`install-outcome`, `install-flow`, `dependency-plan` and `errors`.

- verify: the six scenarios fail on f1ba9adf; they pass on Node 22, 24
  and 26; `npm run check` exits 0.
