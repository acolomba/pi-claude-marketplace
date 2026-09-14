# Phase 6: Unused Type Member Gate — Context

Recorded from the authorized test-backlog scope and completed compiler research.

## Decisions

- **D-01:** Add a static gate that rejects the unread optional `EdgeDeps.neverReadAnywhere` plant. Declaration presence, indexed-access types, and an enumeration test are not runtime consumers.
- **D-02:** Count actual runtime reads outside declarations in production and tests. Report reads present only in tests separately. Production export reachability remains Phase 5's gate. Never add a test just to make a declaration look used.
- **D-03:** Resolve members by declaration/symbol identity and actual value transfers. Same property spelling or structural assignability alone does not establish a read. Preserve provenance through the project's real aliases, containers, callbacks, and return values.
- **D-04:** Classify syntax before reference flags: property access and destructuring can read; simple assignment and type-only references cannot. Model bulk runtime consumers by their resolved symbol and actual production-derived input, not a matching function name.
- **D-05:** Validate precise external and type-system contracts with boundary evidence and drift controls. No broad file/type/member exclusions or a baseline allowance for unexplained findings. A planted unread sibling must still fail.
- **D-06:** Fail with an actionable diagnostic for unread declarations and relevant unsupported analysis. Keep a witness path for accepted members. Document the supported scope and limitations honestly; a clean count does not prove a sound analysis.
- **D-07:** Use the installed TypeScript compiler and existing Node test runner. Preserve 100% aggregate production unit coverage, direct-pair requirements, assertion strength, and every completed lifecycle safeguard. Integrate the same executable gate into normal local and CI checks.
- **D-08:** Exercise offender and benign controls through the executable gate, including the actual EdgeDeps source overlay. Cover read/write/type-only, same-name unrelated declarations, aliases, structural transfers, computed access, bulk operations, and validated external consumers. Retain exact diagnostic/exit/report assertions and launch-error discrimination.
- **D-09:** Reclassify the live population after Phase 5. The research prototype's 228 unresolved declarations are investigation work, not an allow-list, confirmed defects, or an acceptable shipping baseline. Resolve every unexplained diagnostic before enabling the mandatory gate.

## Implementation discretion

Choose coherent analyzer modules based on the measured algorithm and complexity. Prefer correcting an incomplete analysis over changing working product code to satisfy it. Remove an actually unused declaration only after proving its full contract and call-site consequences. Retain legitimate compile-time proofs and external outputs with precise justification.

No substantive product decision remains open. Research and planning may proceed independently; production triage starts after Phase 5 stabilizes its ownership changes.
