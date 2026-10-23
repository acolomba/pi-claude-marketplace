---
phase: 09-plugin-list
plan: 01
subsystem: plugin-list
tags: [list, scope, marketplace-not-added, bug-fix]
requires: []
provides:
  - "`list <marketplace>` fails with `marketplace-not-added` when no consulted scope records the marketplace"
  - "`list --scope <s>` keeps only installations of scope `<s>`, judged per row"
affects: [phase-9-plugin-list]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - test/orchestrators/plugin/list-flow.test.ts
---

# 09-01 Summary: plugin list bug fixes

## What changed

- **D-01** `listPlugins` checks a named marketplace with
  `collectMarketplaceRecordsByScope` (the presence test `info` uses). When no
  consulted scope records it, it emits `marketplace-not-added`, with `scope`
  and the cross-scope reason (`crossScopeFlag`) under `--scope`. Before, it
  printed an empty list. The LLM tool and browser loader are unchanged.
- **D-02** `loadPluginListPayload` narrows `--scope` per row (`narrowToScope`):
  a block of the asked scope drops folded rows of the other scope; a block of
  the other scope keeps only rows of the asked scope and is dropped when none
  remain. Before, `--scope project` hid a project installation folded under a
  user marketplace and `--scope user` showed it.

## Tests

Five new cases in `test/orchestrators/plugin/list-flow.test.ts` with exact
notifications: unknown marketplace, marketplace only in the other scope,
`--scope project` and `--scope user` over the fold, and `--scope project`
dropping a user marketplace with no project installation. 99/99 pass; direct
coverage of `list-flow.ts` is complete (the hook's `check:commit` passed).

## Deviations

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
