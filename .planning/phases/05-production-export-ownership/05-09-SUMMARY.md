---
phase: 05-production-export-ownership
plan: "09"
status: complete
requirements-completed: []
plan_head_before: 7615c965
actuals:
  tasks: 3
---

# Public MCP ownership and peer status

Implementation and focused verification are complete. Stable-wave census reconciliation, full quality gates, aggregate native coverage and parent commits remain required.

# Plan 05-09 assertion ledger

| Removed test surface | Preserved public contract | Verification |
| --- | --- | --- |
| readMarker complete identity object | isOwnedBy checks the exact owner, a different plugin, a different marketplace, and reversed identity; complete four-result object | Focused and direct checks passed |
| readMarker eleven malformed/missing fixtures | All eleven inputs remain named sibling cases, asserting ownership refusal | Passed |
| inherited marker and each singly inherited identity field | All three fixtures remain; each refuses the purported owner through isOwnedBy | Passed |
| Existing isOwnedBy and buildMarker tests | Unchanged complete result/identity assertions | Passed |
| MCP_COLLISION_SLOTS exact order | Real four-file lookup checks seven complete server/path entries, including conflicts whose earliest declaration begins at slot0,slot1,slot2; repeated lookup must return the same whole map | Passed |
| Object.isFrozen(private slot list) | Retired private implementation assertion; freeze implementation remains; no external mutation surface after export removal | N/A (public map replaces slot-array contract) |
| All other collision reader cases | Complete maps and EISDIR rejection unchanged | Passed |
| Four subagent and seven MCP helper inventory cases | Each inventory preserved; softDepStatus compares both dependency fields independently | Passed |
| Two helper discovery failures + existing public discovery failure | One existing public failure now owns all three identical fixtures' complete false/false contract; duplicate scalar assertions removed | Passed |
| Two helper name-accessor failures | One identical accessor fixture asserts both false/false public status fields; duplicate scalar assertion removed | Passed |
| Four public dependency combinations, Pi forwarding and all type proofs | Unchanged | Passed |

Baseline three owners: 63/63 pass, /tmp/test-backlog-owner9-before.log. No runtime policy changes: only four exports become private. No thresholds, pins or exclusions change. Expected finding removals: marker.readMarker, collision-slots.MCP_COLLISION_SLOTS, pi-api.hasLoadedPiSubagents, pi-api.hasLoadedPiMcpAdapter. Count alone is not acceptance evidence.

## Verification

Three owners passed 60/60 cases after privatization (`/tmp/test-backlog-owner9-final.log`). The preceding 63-case baseline and the prepared public-contract suite against unchanged production both passed; the three removed cases were duplicate scalar failure assertions consolidated under full public status checks. No unique input or failure path was removed.

Direct coverage (`/tmp/test-backlog-owner9-direct.log`):

| Owner | Lines | Functions | Branches |
| --- | --- | --- | --- |
| MCP marker | 70/70 | 3/3 | 21/21 |
| MCP collision slots | 107/107 | 3/3 | 27/27 |
| Pi API boundary | 183/183 | 5/5 | 12/12 |

Private slot-array freezing remains in implementation. Its former direct freeze assertion described an exported implementation object that callers can no longer obtain; complete public maps prove every priority level and repeated-read stability. This is the sole retired implementation-only assertion. All type proofs remain unchanged.


## Final parent acceptance

Completed in `080d395e` with the five-plan stable wave. The earlier pending integration statements record executor handoff status and are superseded by this acceptance. The final complete census is 85 findings: exactly 26 reviewed initial findings removed, with no additions. The early frontmatter facade retirement accounts for the change from the intermediate 86-finding snapshot. All 53 analyzer/census controls pass. Native unit tests pass 6,230/6,230, with production coverage exactly 63,120/63,120 lines, 1,848/1,848 functions and 9,099/9,099 branches across 225 emitted modules. All 233 direct pairs pass; the two pre-existing shortfalls match their unchanged pins. The complete pre-commit gate passes and independent review reports no findings across all 54 changed paths. See [wave verification](05-WAVE-2-VERIFICATION.md) for logs, limits and assertion preservation. EXPORT-01 and EXPORT-02 remain open for later plans.
