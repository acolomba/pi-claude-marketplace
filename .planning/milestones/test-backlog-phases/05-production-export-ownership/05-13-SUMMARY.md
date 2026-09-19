---
phase: 05-production-export-ownership
plan: "13"
subsystem: command-edge
tags: [export-ownership, completion, catalog, dispatch, public-contract-tests]
status: complete
requires:
  - phase: 05-production-export-ownership
    plan: "01"
    provides: Complete production finding census and calibrated analyzer controls
provides:
  - Private completion, usage, fetch-target, and tool-status implementation details
  - Independent complete catalog inventory and public completion assertions
  - Precise loader and orphan-fold output types with negative compile proofs
affects: [05-production-export-ownership]
tech-stack:
  added: []
  patterns: [private-same-module-helpers, producer-derived-public-contracts]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - tests/edge/completions/data.test.ts
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - tests/edge/flag-catalog.test.ts
    - tests/architecture/flag-catalog-drift.test.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - tests/edge/router.test.ts
    - tests/edge/register.test.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
    - tests/edge/handlers/plugin/fetch.test.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/edge/handlers/tools.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - tests/orchestrators/plugin/list-flow.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts
    - tests/orchestrators/plugin/list-orphan-fold.test.ts
key-decisions:
  - Retire the unconsumed derived verb constant and keep independently authored exact catalog inventories.
  - Narrow the loader output to its nine producible statuses while preserving the separate listPlugins failure notification.
  - Preserve ordering helpers through generics and reject impossible producer outputs through type-negative controls.
duration: 13m
completed: 2026-09-14
plan_head_before: 7615c965593c12e9f984e183f1b74577a719e10a
actuals:
  tasks: 4
  commits: 1
---

# Phase 5 Plan 13: Production-owned command projections summary

Completion and command helpers are private, their live contracts remain covered through public operations, and tool status projection now consumes the precise nine-status loader contract.

## Completion and coordination

All four amended tasks are implemented. Source and test writes are frozen for independent review. The parent owns stable-wave census reconciliation, aggregate coverage, full precommit, commits, and root planning updates. This executor created no commits; final verification remains pending those parent-owned gates.

The exact source/test scope is the sixteen files listed above. CodeGraph preceded exploration and edits, including the final dependency-type closure in `/tmp/phase5-13-type-cleanup-codegraph.txt`. No shared census pin, configuration, root planning, or unrelated source was edited. Pending Phase 5 plans were checked for overlap before adding the four producer/owner files; none assigned these files elsewhere. `list.messaging.ts` and its owner remain unchanged.

## Caller and type evidence

- `buildItem` and `getPluginToMarketplacesMap` remain live within completion data and are exercised through `getPluginRefCompletions`.
- `CATALOG_VERBS` had no production consumer after Phase 4. Its derived constant is retired; the public catalog lookup and `CatalogVerb` contract remain.
- `TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` remain used privately by the router. Tests assert independent complete usage text through route dispatch and registration.
- `parseFetchTarget` and its exclusive `ParsedFetchTarget` interface remain private within the real fetch handler.
- `projectRowStatus` remains private within tool payload rendering. Its input is derived from `loadPluginListPayload`, whose producers construct nine list statuses. The separate `listPlugins` catch path still constructs its failed notification and retains its existing public failure fixture.
- `foldOrphanListRows` returns only the five installed inventory variants. Generic ordering helpers preserve whichever `ListMsg` subtype they receive, with unchanged runtime sorting behavior.

## Assertion ledger

| Original contract | Retained or replacement public assertions | Evidence |
| --- | --- | --- |
| Four direct `buildItem` cases | Public completion cases assert whole unique/ambiguous suggestion objects with empty/nonempty command prefixes, including exact labels, qualified references, replacement text, and trailing spaces. | Completion owner and direct coverage pass |
| Every direct plugin-to-marketplaces map case | Public completion arrays assert complete candidate membership, ordering, scope policy, unavailable and partial-status policy, and replacement values. The shared plugin case additionally asserts both ordered marketplace-half suggestions, preserving both original map memberships. | Completion direct coverage 100% |
| Completion cache and resolver failures | Existing cache reuse, missing cache path, resolver failure identity, and target-scope behavior remain. Tests derive option types from the public completion signature. | All completion owner cases pass |
| Derived verb constant order assertion | Retired with the unconsumed constant. Independently authored nineteen-verb tuples drive exact public lookup checks, while an exact union compile proof covers `CatalogVerb`. No expected inventory is read from production. | Catalog owner and drift guard pass |
| Catalog entry ordering, descriptions, flags, and negative lookups | Complete entries and flag inventories remain; prototype-key negatives remain. Architecture guard still compares nineteen canonical verbs and twenty-two accepted spellings including aliases, with offender and benign controls. | Task 1 focused batch: 200/200 |
| Two direct router usage constant assertions | Removed helper imports and direct checks only. Router cases retain independently written whole usage text, severity, and zero dispatch for each usage-producing condition. Registered unknown-command case now uses the same independently authored expected text rather than a production constant. | Router/register/fetch batch: 210/210 |
| Router and registered command contracts | Existing recognized/unknown flags, surplus arguments, quoted empty arguments, dispatch ordering, and exact handler calls remain unchanged. | Router direct coverage 100%; registration owner passes |
| Six fetch parser success shapes | Each internal target shape is now observed through a seeded public handler; the six explicit mappings are below. No private parser return object remains a test contract. | Fetch direct coverage 100% |
| Nine fetch parser refusals | Three malformed references, two surplus-reference cases, three unknown-flag cases, and invalid scope now call `makeFetchHandler`. Each preserves the exact complete error text and severity, with one notification, zero tool probes, and no cwd access despite seeded marketplaces. | Public validation owner passes |
| Parser failure return of `undefined` | Internal parse sentinel retired as a test assertion. The public handler is awaited and its whole notification plus strict no-work boundary is asserted; its `Promise<void>` completion is not captured as a value. | Scoped lint and direct owner pass |
| Nine direct tool status bucket checks | Existing registered-tool filesystem fixtures cover every producible status through complete tool text and structured details, including exact version/reasons and zero network activity. Eleven version cases collectively cover the nine actual statuses. | Tools direct coverage 100% |
| Ten helper-only non-list status refusal checks | Removed the impossible runtime guard branches and their direct helper throw assertions. The real producer contract now excludes these statuses, with individual negative compile proofs. Live loader failure and list notification behavior remains. | Strict typecheck; loader and tools owners pass |
| Existing loader and orphan-fold behavior | All runtime owner assertions remain, including failed marketplace/header behavior, separate failed notification, local merged configuration choices, row ordering, duplicate handling, scope folding, and exact emitted messages. | Both producer direct owners remain 100% |

### Six fetch success mappings

| Original parser success | Public handler coverage |
| --- | --- |
| No positional: all marketplaces | Empty argument handler case asserts the entire ordered project and user notification and three-success tally. |
| `--scope project`: all project marketplaces | Project-scope handler case asserts only the complete project rows and exact tally. |
| `--scope user`: all user marketplaces | User-scope handler case asserts only the complete user row. |
| `@mp`: named marketplace | Marketplace handler case asserts the complete two-plugin notification and two-success tally. |
| `alpha@mp`: named plugin | Plugin handler case asserts the complete single-plugin notification. |
| Named plugin plus explicit user scope | Added `gamma@other --scope user` handler case asserts the complete user-scoped gamma notification. |

Every successful handler fixture seeds both scopes. Existing boundary assertions retain exact notification count, tool probe count, and cwd access, so the target selection is visible in the actual workflow output.

## Compile-time proof ledger

- Loader return status has an exact nine-member union proof derived from `Awaited<ReturnType<typeof loadPluginListPayload>>`.
- Individual `@ts-expect-error` controls reject failed, updated, reinstalled, uninstalled, skipped, manual recovery, and the four will-install/uninstall/enable/disable statuses.
- Fold output has an exact five-member installed-inventory union proof; failed and available are rejected.
- Generic block ordering preserves a supplied installed-only row type and rejects a remote row as that output type.
- Catalog type completeness is checked against an independent nineteen-verb tuple.
- Completion option fixtures use the public function parameter contract rather than an exported private helper interface. Tool expected rows use an independent three-value public status union.

## Finding dispositions for parent reconciliation

Seven reviewed identities are expected to disappear from the initial census:

```text
unused_exports|extensions/pi-claude-marketplace/edge/completions/data.ts|buildItem
unused_exports|extensions/pi-claude-marketplace/edge/completions/data.ts|getPluginToMarketplacesMap
unused_exports|extensions/pi-claude-marketplace/edge/flag-catalog.ts|CATALOG_VERBS
unused_exports|extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts|parseFetchTarget
unused_exports|extensions/pi-claude-marketplace/edge/handlers/tools.ts|projectRowStatus
unused_exports|extensions/pi-claude-marketplace/edge/router.ts|MARKETPLACE_USAGE
unused_exports|extensions/pi-claude-marketplace/edge/router.ts|TOP_LEVEL_USAGE
```

### Integration-detected closure

The parent's intermediate raw census reported 89 findings instead of the expected combined-wave 86. The fail-closed parser correctly rejected a newly introduced private-type-leak category. These three findings were introduced during this implementation and are closure fixes, not extra initial-census removals:

1. `loadPluginListPayload` exposed private `PayloadListMsg`. Its public return now directly spells `Exclude<ListMsg, { status: "failed" }>`; the internal alias remains private.
2. `PluginMapOptions` became production-unused after its only consuming helper became private. The interface is now private, and the owner derives options from `getPluginRefCompletions`.
3. `ToolPluginStatus` became production-unused after its consuming projection became private. The alias is now private, while owner expectations independently spell the three public tool statuses.

The affected direct owners, typecheck, and scoped lint passed after these fixes. The parent then confirmed the stable-wave census is exactly 86 findings: 25 expected removals and no additions, and reconciled the shared pin. This executor did not relax report parsing or edit the pin.

## Verification

- Focused batches passed **200/200**, **210/210**, and **130/130** tests, respectively: **540 passing checks**, zero failures, skips, cancellations, or todos. Logs: `/tmp/phase5-13-task1-focused.log`, `/tmp/phase5-13-task23-focused.log`, `/tmp/phase5-13-tools-focused.log`.
- Direct coverage used one source path per `node scripts/test-coverage-direct.mjs` invocation, outside the sandbox:

| Owner | Lines | Functions | Branches |
| --- | --- | --- | --- |
| edge/completions/data.ts | 631/631 | 36/36 | 113/113 |
| edge/flag-catalog.ts | 213/213 | 10/10 | 11/11 |
| edge/router.ts | 221/221 | 3/3 | 37/37 |
| edge/handlers/plugin/fetch.ts | 132/132 | 4/4 | 27/27 |
| edge/handlers/tools.ts | 533/533 | 16/16 | 91/91 |
| orchestrators/plugin/list-flow.ts | 802/802 | 15/15 | 90/90 |
| orchestrators/plugin/list-orphan-fold.ts | 76/76 | 10/10 | 22/22 |

- Final affected direct logs: `/tmp/phase5-13-direct-data-final.log`, `/tmp/phase5-13-direct-tools-closure.log`, `/tmp/phase5-13-direct-list-flow-closure.log`, and `/tmp/phase5-13-direct-fetch-final.log`. Other direct logs use `/tmp/phase5-13-direct-` plus the hyphenated owner path.
- Strict typecheck passed with no diagnostics after the type closure: `/tmp/phase5-13-typecheck-closure.log`.
- All sixteen owned files are scoped-lint clean. The initial check found four captures of the public fetch handler's void completion; those captures and meaningless void assertions were removed while preserving complete public failure assertions. Final logs: `/tmp/phase5-13-fetch-final-eslint.log`, `/tmp/phase5-13-eslint-closure.log`, `/tmp/phase5-13-eslint-data-final.log`.
- Prettier completed on the changed files. `git diff --check` passed after the final source/test changes.
- The parent confirmed the complete stable-wave census at 86 findings with exactly 25 expected removals and no additions. Full native aggregate coverage, all-pairs coverage, controls, precommit, and commits remain parent coordinated.

## Deviations from plan

**Producer type correction added as a bounded four-file task.** Caller tracing showed that the broad list message type included an impossible loader `failed` row. The parent approved narrowing actual producer outputs and preserving generic ordering types. This expands source/test scope from twelve to sixteen files without changing list failure notification behavior. Every task remains within five files. No other pending plan owns the added files.

**Unconsumed catalog constant retired.** Phase 4 did not create a real production reader for the derived verb constant. Keeping it private would leave an unused value; retirement with independent public contract checks is the correct disposition.

**Exclusive types closed with their helper changes.** `ParsedFetchTarget`, `PluginMapOptions`, and `ToolPluginStatus` remain private. The integration-detected private type leak is fixed by exposing the existing public message contract directly, without adding a test-only export or analyzer exception.

## Self-Check: PASSED

All sixteen source/test files and the amended plan exist. Focused tests, all seven direct owners, strict typecheck, and scoped lint passed. Source/test writes are frozen. No stub, skipped test, coverage exclusion, threshold change, fake production caller, new dependency, or new trust boundary was introduced. Parent integration and commits remain explicit pending work.


## Final parent acceptance

Completed in `080d395e` with the five-plan stable wave. The earlier pending integration statements record executor handoff status and are superseded by this acceptance. The final complete census is 85 findings: exactly 26 reviewed initial findings removed, with no additions. The early frontmatter facade retirement accounts for the change from the intermediate 86-finding snapshot. All 53 analyzer/census controls pass. Native unit tests pass 6,230/6,230, with production coverage exactly 63,120/63,120 lines, 1,848/1,848 functions and 9,099/9,099 branches across 225 emitted modules. All 233 direct pairs pass; the two pre-existing shortfalls match their unchanged pins. The complete pre-commit gate passes and independent review reports no findings across all 54 changed paths. See [wave verification](05-WAVE-2-VERIFICATION.md) for logs, limits and assertion preservation. EXPORT-01 and EXPORT-02 remain open for later plans.
