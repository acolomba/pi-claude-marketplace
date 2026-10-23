---
phase: 09-plugin-list
review: 09-REVIEW.md
status: fixed
---

# Phase 9 review fixes

| Finding | Outcome | How |
| ------- | ------- | --- |
| CR-01 `--scope user` hides a project-only plugin | fixed | The fold now applies only when both scopes are listed; under `--scope user` the plugin is an `available` row. Unit test and scenario updated. |
| CR-02 `--scope project` drops a failed clone header | fixed | Same change: the project clone is its own block, so its `(failed)` header stays. New unit test pins `⊘ mp1 [project] (failed)`, error. |
| CR-03 `list mp1 --scope project` prints nothing for a clone with no installs | fixed | Same change: the clone block lists its candidates. |
| CR-04 not-added check passes when looking only in user scope | fixed | The positional scenario now names the project-only marketplace `tools`. |
| WR-01 no scenario for unknown marketplace with `--scope` | fixed | Added `Naming a marketplace no scope holds with a scope fails as not added to that scope`. |
| WR-02 LLM tool shows folded project rows under a user header | fixed | With no fold under `scope`, the tool lists the clone under `(project)`. |
| WR-03 fixture copied into eight scenarios | skipped | Splitting into a second feature file with a `Background:` would add a file outside this phase's ownership (`features/plugin/list.feature` only). Left for the orchestrator. |
| WR-04 title claims every status | fixed | Renamed to "The list shows each kind of plugin with its status and scope". |
| WR-05 stale doc comments | fixed | `scope` option and `listPlugins` docs describe the current code. |
| IN-01 not-added message built in three places | skipped | Info; a shared builder touches `plugin/info.ts` and `marketplace/info.ts`, outside the fix. |
| IN-02 `rowScope`/`otherScope` duplicates | fixed | Removed with `narrowToScope`. |
| IN-03 catalog, PRD PL-3, CHANGELOG not updated | deferred | CHANGELOG is written at PR time; the catalog/PRD wording is for the orchestrator. |

CONTEXT D-02 was amended to the new design.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
