---
phase: 03-dependency-cascade-rows-and-status
plan: 02
subsystem: dependency-cascade
tags: [install, plugin-id, notification, catalog, cucumber]

requires: []
provides:
  - "DependencyClosureResult arm { ok: false; reason: \"invalid-root-id\"; key; invalidPart: \"plugin\" | \"marketplace\" | \"both\" } in domain/dependency-closure.ts"
  - "module-private refuseUnsplittableRoot and invalidIdPart: an install walk looks an unsplittable root up once before refusing it"
  - "printable(text) exported from shared/notification-mcp.ts"
  - "INVALID_ID_HALVES and the invalid-root-id case of closureFailureFacts in install-cascade.messaging.ts"
  - "catalog state dependency-invalid-root-id (docs/output-catalog.md + catalog-UAT fixture)"
affects: [03-06 phase gate and D-PL3 decision records]

actuals:
  tokens: 7466
  tasks: 2
  commits: 2
plan_head_before: 6d594be0b46f0462b85d4c035466f92e1ed9f461
plan_head_after: dfa3509df95b3f81865518d1387d31a467719410

tech-stack:
  added: []
  patterns:
    - "Root-of-install verdicts are looked up first, then refused, in Claude Code's order; non-install walks keep their old verdict"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/dependency-closure.ts
    - test/domain/dependency-closure.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - test/orchestrators/plugin/install-cascade.messaging.test.ts
    - extensions/pi-claude-marketplace/shared/notification-mcp.ts
    - test/shared/notification-mcp.test.ts
    - test/integration/reserved-record-keys.test.ts
    - features/plugin/install.feature
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/plugin-install.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts

key-decisions:
  - "D-PL3-04 (as amended by D-PL3-14): an install looks the root up first; an unlisted root keeps {not in manifest}, a listed root whose id breaks the token rule is refused {invalid manifest} with Claude Code's verbatim cause (capital `Each`)"
  - "D-PL3-05: the fix is a root-specific closure arm plus its cause in the cascade messaging; enable-disable.ts is untouched"
  - "D-PL3-14: three wording variants (plugin's name, marketplace's name, both), id escaped through printable, lookup-first only when installPolicy is passed"
  - "D-PL3-17 (known limit): apply, a load, and import classify the cause as {dependency failed}"

patterns-established:
  - "An install-only behavior in the closure walk keys off the presence of installPolicy, which the enable walk never passes"

requirements-completed: [CAS-02]

coverage:
  - id: D1
    description: "install of a listed `_x@fixtures` fails with one `_x (failed) {invalid manifest}` row and Claude Code's invalid-id cause"
    requirement: CAS-02
    verification:
      - kind: e2e
        ref: "features/plugin/install.feature#Installing a plugin whose name breaks the plugin id rule fails as an invalid manifest"
        status: pass
      - kind: integration
        ref: "test/integration/reserved-record-keys.test.ts#D-08-07: a marketplace that declares __proto__ installs hello, lists __proto__ as unavailable and refuses its install without a file change"
        status: pass
    human_judgment: false
  - id: D2
    description: "install of an unlisted `_x@fixtures` fails as `{not in manifest}` with `Plugin \"_x\" not found in marketplace \"fixtures\".`"
    requirement: CAS-02
    verification:
      - kind: e2e
        ref: "features/plugin/install.feature#Installing a plugin whose name breaks the plugin id rule and that the marketplace does not offer fails as not in manifest"
        status: pass
      - kind: unit
        ref: "test/domain/dependency-closure.test.ts#CAS-02 / D-PL3-04 an install of an unlisted root with an invalid id resolves to itself alone, leaving the miss to the caller"
        status: pass
    human_judgment: false
  - id: D3
    description: "The closure walk returns invalid-root-id with the right invalidPart for the three variants, and keeps unusable-declaration without installPolicy or without an @"
    requirement: CAS-02
    verification:
      - kind: unit
        ref: "test/domain/dependency-closure.test.ts#CAS-02 / D-PL3-14 (three variants, unusable, absent, no @)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The cause renders the three wording variants and escapes a format character in the id"
    requirement: CAS-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#CAS-02 / D-PL3-14 (three variants) and D-PL3-14 escape case"
        status: pass
      - kind: unit
        ref: "test/shared/notification-mcp.test.ts#printable"
        status: pass
    human_judgment: false
  - id: D5
    description: "The refusal is the documented catalog state dependency-invalid-root-id"
    requirement: CAS-02
    verification:
      - kind: other
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts, catalog-parser.test.ts, catalog-wire.test.ts (324 states, 54_443 bytes)"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-10-27
status: complete
---

# Phase 3 Plan 02: Invalid Plugin Id Refusal Summary

**An install of a root whose `<plugin>@<marketplace>` id breaks the token rule now gets Claude Code's verdict in Claude Code's order: looked up first, `{not in manifest}` when unlisted, and `{invalid manifest}` with the verbatim invalid-id cause when listed.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-10-27T03:33Z
- **Completed:** 2026-10-27T03:57Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `resolveDependencyClosure` hands an unsplittable root to the new `refuseUnsplittableRoot`. With `installPolicy` and an `@` in the key, it looks the root up once. An `absent` answer resolves to the root alone, so the ledger reports `Plugin "_x" not found in marketplace "fixtures".`. Any other answer returns the new `invalid-root-id` arm, with `invalidPart` taken from `isRenderableDependencyToken` on each half.
- Without `installPolicy` (the enable walk), or with no `@`, the verdict is the old `unusable-declaration` with `root: expected <plugin>@<marketplace>`, and no lookup happens. `enable-disable.ts` compiles unchanged.
- `closureFailureFacts` renders the arm as `{invalid manifest}` with `Plugin "<id>" cannot be installed, because its id is invalid: Each part of a plugin id ...` and one of three endings from `INVALID_ID_HALVES`. The id goes through the now-exported `printable`.
- `failureDeclarers` answers the new arm with no declarer.
- The D-08-07 `__proto__@hostile` integration pin moved to the new cause. It still asserts that the refused install changes no file. The only line that changed was the cause line.
- Two `install.feature` scenarios and the catalog state `dependency-invalid-root-id` pin the behavior. Both scenarios failed on the tree before Task 1 (checked in a temporary detached worktree at `b2cabb7e^`, since removed).

## Task Commits

1. **Task 1: An install refuses a listed root whose id breaks the token rule with Claude Code's cause** - `b2cabb7e` (fix)
2. **Task 2: Scenarios and the catalog state for an install of an invalid plugin id** - `dfa3509d` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependency-closure.ts` - `invalid-root-id` arm, `invalidIdPart`, `refuseUnsplittableRoot`. The header, `ClosureSubject`, and `installPolicy` doc comments now state the lookup-first order.
- `test/domain/dependency-closure.test.ts` - three variant cases, plus the unusable, absent, and no-`@` cases under `installPolicy`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `failureDeclarers` returns `[]` for `invalid-root-id`
- `test/orchestrators/plugin/install-cascade.test.ts` - `walkDependencyGraph` over a listed `_app@marketplace` answers `closure-failed` with no declarer
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` - `INVALID_ID_HALVES`, the `invalid-root-id` case, and a switch doc comment that no longer counts arms
- `test/orchestrators/plugin/install-cascade.messaging.test.ts` - variant trio (whole notification) and the U+202E escape case
- `extensions/pi-claude-marketplace/shared/notification-mcp.ts` - `export function printable`, with one doc clause added
- `test/shared/notification-mcp.test.ts` - `describe("printable")`, two cases
- `test/integration/reserved-record-keys.test.ts` - D-08-07 expected cause
- `features/plugin/install.feature` - the listed and the unlisted `_x@fixtures` scenarios
- `docs/output-catalog.md` - the state `dependency-invalid-root-id`, with prose
- `test/architecture/catalog-uat/fixtures/plugin-install.ts` - the `dependency-invalid-root-id` fixture
- `test/architecture/catalog-uat/catalog-{contract,parser,wire}.test.ts` - 323 -> 324 states, 334 -> 335 presented kinds, 54_039 -> 54_443 bytes

## Decisions Made

None beyond the plan. D-PL3-04 (as amended by D-PL3-14), D-PL3-05, and D-PL3-14 were applied as written. D-PL3-17 is recorded as a known limit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A fifth count pin in catalog-wire.test.ts**
- **Found during:** Task 2
- **Issue:** The plan named four places for the 323 -> 324 count. `catalog-wire.test.ts` also pins `PRESENTED.length` at 334 (catalog states plus the kinds that have no catalog tuple), and WIRE-02 failed with 335 !== 334.
- **Fix:** Raised `PRESENTED.length` to 335 in the same file. The file was already in the task's Files list.
- **Files modified:** test/architecture/catalog-uat/catalog-wire.test.ts
- **Verification:** The three catalog tests pass (73 cases).
- **Committed in:** dfa3509d

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** One extra count line in a file the plan already listed. No scope change.

## Issues Encountered

- gitlint rejected the first two Task 2 titles because they were longer than 72 characters. The commit was made a third time with a shorter title. No hook was skipped and nothing was amended.

## Touched outside Files

- `extensions/pi-claude-marketplace/shared/notification-mcp.ts`: `printable` is now exported (D-PL3-14). The invalid-id cause escapes the id the same way the MCP notices do. Exporting is the smallest change; nothing moved.
- `test/integration/reserved-record-keys.test.ts`: the D-08-07 pin of the old cause changes with CAS-02 (D-PL3-05).
- The catalog-UAT fixture and the count and byte pins (`catalog-contract`, `catalog-parser`, `catalog-wire`), for the new state.
- `install-cascade.ts` is on the Files line. Only `failureDeclarers` changed.

## CHANGELOG line

- Installing a plugin whose name breaks the plugin id rule now gets Claude Code's invalid-id refusal, and an unlisted one reads `{not in manifest}`, instead of a dependency error.

## Decision rows

| **D-PL3-04 (plugin-lifecycle), as amended by D-PL3-14: an install looks its root up before checking the id** -- an unlisted root keeps `{not in manifest}`; a listed root whose id breaks the token rule is refused `{invalid manifest}` with `Plugin "<id>" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it.` | Claude Code 2.1.310 checks the id after the lookup and words the refusal this way, with a capital `Each` (E2). The root is nobody's dependency, so `declares an unusable dependency` was wrong for it | Shipped; domain, messaging, and integration cases, plus two `install.feature` scenarios |
| **D-PL3-05 (plugin-lifecycle): the fix is a root-specific closure arm** -- `invalid-root-id` in `domain/dependency-closure.ts` and its cause in `install-cascade.messaging.ts`; `enable-disable.ts` is untouched, and the D-08-07 integration pin moves with it | Keeps the change in the walk that produces the verdict and the module that renders it | Shipped |
| **D-PL3-14 (plugin-lifecycle): Claude Code's three variants, an escaped id, install walks only** -- the plugin's name, the marketplace's name, or both (`they do not; ... rename both`); the id goes through `printable`; lookup-first applies only when `installPolicy` is passed | Upstream text verbatim; the id is outside the allowlist by definition, so control and format characters must not reach the terminal; the enable walk keeps its old verdict | Shipped; three variant cases and one escape case |
| **D-PL3-17 (plugin-lifecycle, known limit): `apply`, a load, and `import` report the cause under `{dependency failed}`** -- `apply-outcomes.ts` classifies every cascade cause that way, so a config-declared `_x@mp` shows `{dependency failed}` with the new cause line | CAS-02 is about `install`; `apply-outcomes.ts` belongs to another phase | Recorded, not changed |

## Backlog dispositions

- `ROOTKEY-01`: fixed (CAS-02).
- Deferred, not done here: `list` and `info` show `{unsupported source}` for `__proto__` (CONTEXT Deferred Ideas). This is a backlog candidate.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The catalog now holds 324 states, with 54_443 bytes. A later plan that adds a catalog state starts from those numbers. Plan 03-06 runs the phase gate (`npm run check`).

## Self-Check: PASSED

- All 15 modified files exist. Commits `b2cabb7e` and `dfa3509d` are on HEAD. Each lists exactly its task's files, and `enable-disable.ts` is in neither.
- Acceptance greps: `invalid-root-id` appears in dependency-closure.ts and install-cascade.messaging.ts; `export function printable` 1; `because its id is invalid: Each part` in the integration test 1; `catalog-state: dependency-invalid-root-id` 1; `EXPECTED_STATE_COUNT = 324;` 1; `cannot be installed, because its id is invalid` in install.feature 1.
- The D-08-07 integration test failed before the change (1 failure out of 14) and passes after it.
- Owner tests: 249 pass, 0 fail. Direct coverage of the four sources reports nothing (exit 0). `install.feature`: 21 of 21 scenarios pass. Catalog tests: 73 pass. `npm run check:features` exits 0.
- Both commits passed the `npm run check:commit` hook.

---
*Phase: 03-dependency-cascade-rows-and-status*
*Completed: 2026-10-27*
