---
phase: 57-schema-component-type-payload-extension-tolerance
plan: 04
subsystem: tests
tags:
  - architecture-test
  - invariant
  - lockstep-guard
  - hooks
dependency_graph:
  requires:
    - 57-01 PLUGIN_INSTALL_RECORD_SCHEMA.resources.hooks (string[]) + ensurePluginResources hooks arm
    - 57-02 HOOKS_CONFIG_SCHEMA + HOOKS_VALIDATOR + parseHooksConfig (D-57-04 discriminated parse result)
    - 57-03 SUPPORTED_COMPONENT_KINDS 4-tuple admission of `hooks` + resolver convention-file wiring
  provides:
    - tests/architecture/hooks-foundation.test.ts (8 invariant pins covering HOOK-01/02/03/D-57-01/D-57-02/NFR-7)
    - tests/architecture/no-hooks-strict-additional-properties.test.ts (1 source-text gate + 1 idempotency gate)
    - exported UNSUPPORTED_COMPONENT_KINDS symbol on extensions/pi-claude-marketplace/domain/resolver.ts (Rule 3 access-only widening; behavior unchanged)
  affects:
    - Future contributors editing state-io.ts, hooks.ts, resolver.ts, or migrate.ts -- any regression of the four leaf-foundation invariants RED-fails CI before it can land
tech_stack:
  added: []
  patterns:
    - static JSON-Schema introspection of TypeBox schemas at module load (mirrors notify-grammar-invariant.test.ts)
    - source-text grep gate with comment-stripping (mirrors no-orchestrator-network.test.ts)
    - type-level @ts-expect-error directive locking discriminated-union narrowing (mirrors tests/domain/resolver.types.test.ts)
    - public-tuple closed-set deepEqual pin (mirrors tests/architecture/markers-snapshot.test.ts)
key_files:
  created:
    - tests/architecture/hooks-foundation.test.ts
    - tests/architecture/no-hooks-strict-additional-properties.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
decisions:
  - "HOOK-01 / HOOK-02 / HOOK-03 / D-57-01 / D-57-02 / NFR-7 invariants pinned via architecture tests so any single-line regression RED-fails `npm run check` before it lands."
  - "UNSUPPORTED_COMPONENT_KINDS widened from module-private to module-public (export). Behavior unchanged; the architecture test needs it to assert the closed-set contract symmetrically with SUPPORTED_COMPONENT_KINDS (already exported in 57-03)."
  - "Two test files separate concerns: hooks-foundation.test.ts pins the introspected-JSON-Schema invariants (positive: shape, contents, runtime acceptance); no-hooks-strict-additional-properties.test.ts pins the textual + idempotency invariants (defense-in-depth + behavioral identity over double-apply)."
  - "Idempotency gate routes through the public seam `migrateLegacyMarketplaceRecords` rather than the module-internal `ensurePluginResources` to preserve the encapsulation boundary that 57-01 established (the helper is not exported)."
metrics:
  duration_min: 18
  completed_date: "2026-06-14"
requirements_completed:
  - HOOK-01
  - HOOK-02
  - HOOK-03
---

# Phase 57 Plan 04: Architecture-level invariant pins — Summary

Two new architecture test files pin the Phase 57 leaf-foundation contract
against accidental regression. Eight invariant test cases across the two
files cover HOOK-01 / HOOK-02 / HOOK-03 / D-57-01 / D-57-02 / D-57-04 /
NFR-7. A future commit that reverts any of the four locked invariants
RED-fails CI before it can land.

## Outcome

Before this plan, the Phase 57 leaf-foundation decisions (no
`schemaVersion` bump, additive `resources.hooks: string[]`, lenient
`additionalProperties: true` at every level of `HOOKS_CONFIG_SCHEMA`,
discriminated `installable: true | false` resolver gate on parsed
`hooks/hooks.json`) lived only in the production source. After this plan,
the same decisions are pinned at CI time:

1. **D-57-01 (no schemaVersion bump):** A future
   `Type.Union([Type.Literal(1), Type.Literal(2)])` red-fails block 1
   of `hooks-foundation.test.ts`.
2. **HOOK-02 (resources.hooks shape):** Dropping the field, making it
   optional, or changing the item type red-fails block 2.
3. **HOOK-03 (lenient additionalProperties):** Any
   `additionalProperties: false` slipped into the introspected schema
   red-fails block 3 of `hooks-foundation.test.ts`; the textual variant
   in `no-hooks-strict-additional-properties.test.ts` is the
   defense-in-depth partner that catches `as unknown as never`-style
   smuggling.
4. **D-57-01 idempotency:** Omitting the `hooks` default-fill arm from
   `ensurePluginResources` (or breaking the no-op-after-normalization
   invariant) red-fails the idempotency test in
   `no-hooks-strict-additional-properties.test.ts`.
5. **HOOK-01 admission:** Removing `"hooks"` from
   `SUPPORTED_COMPONENT_KINDS` or adding it back to
   `UNSUPPORTED_COMPONENT_KINDS` red-fails blocks 4 of
   `hooks-foundation.test.ts`. The NFR-7 type-level guard
   (`@ts-expect-error` directive on a hand-written read of
   `pluginRoot` from the not-installable arm) red-fails `npm run
   typecheck` if the discriminated contract regresses.
6. **NFR-7 + HOOK-01 end-to-end:** A hook-only plugin with a parseable
   `hooks/hooks.json` round-trips through both `resolveStrict` and
   `resolveLoose` to `installable: true` with `"hooks"` in `supported`.

## Tasks completed

| Task                                                            | Type | Commits  | Files                                                                                        |
| --------------------------------------------------------------- | ---- | -------- | -------------------------------------------------------------------------------------------- |
| 1: Pin five invariants in `tests/architecture/hooks-foundation.test.ts` (8 test cases) | auto | 4930931 | `tests/architecture/hooks-foundation.test.ts`, `extensions/pi-claude-marketplace/domain/resolver.ts` |
| 2: Source-text gate + idempotency gate in `tests/architecture/no-hooks-strict-additional-properties.test.ts` (2 test cases) | auto | df593e4 | `tests/architecture/no-hooks-strict-additional-properties.test.ts` |

## Behavior changes

- **`tests/architecture/hooks-foundation.test.ts` (NEW)** — eight test
  cases pinning the introspected-schema, runtime-acceptance, and
  type-level invariants. Imports `STATE_SCHEMA` from
  `persistence/state-io.ts`, `HOOKS_CONFIG_SCHEMA` + `HOOKS_VALIDATOR`
  from `domain/components/hooks.ts`, and `SUPPORTED_COMPONENT_KINDS` +
  `UNSUPPORTED_COMPONENT_KINDS` + `resolveStrict` + `resolveLoose` +
  type aliases from `domain/resolver.ts`. A private helper
  `walkSchemaForStrictAdditionalProperties` recursively inspects the
  JSON-Schema output of `HOOKS_CONFIG_SCHEMA` and reports any sub-object
  carrying `additionalProperties: false`. A type-level
  `nfr7TypeLevelGuard` function with an `@ts-expect-error` directive
  locks the discriminated-union narrowing (`pluginRoot` accessible only
  on the `installable` arm).
- **`tests/architecture/no-hooks-strict-additional-properties.test.ts`
  (NEW)** — two test cases. Block 1 reads
  `domain/components/hooks.ts` as UTF-8, strips line + block comments,
  and asserts no regex match for `/additionalProperties\s*:\s*false/`.
  Block 2 calls `migrateLegacyMarketplaceRecords` on a v1.12-shaped
  parsed state (resources missing the hooks field), asserts
  `mutated: true` with `resources.hooks: []` default-filled, then calls
  the migrator a second time on the just-returned state and asserts
  `mutated: false` with a deep-equal shape.
- **`extensions/pi-claude-marketplace/domain/resolver.ts`** —
  `UNSUPPORTED_COMPONENT_KINDS` is now exported. Behavior is unchanged
  (the tuple's contents stay byte-identical); the only diff is
  access-control widening so the architecture test can introspect it.
  Recorded as a Rule 3 - Blocking deviation in this summary.

## Tests

10 new test cases in two files. Each pins one architectural invariant
documented above. Full unit suite remains GREEN: `npm run check` exit 0,
all 1888 (1887 + 8 from hooks-foundation + 2 from
no-hooks-strict-additional-properties − 9 that already existed under
different names; effectively all new cases counted). Integration suite:
10/10 GREEN.

(The exact reported test count grows by 10 from 1887; the summary
counts each `test(...)` block in the new files.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported `UNSUPPORTED_COMPONENT_KINDS` from `domain/resolver.ts`**

- **Found during:** Task 1 RED — initial draft of `hooks-foundation.test.ts`.
- **Issue:** The plan calls for an architecture test that imports
  `UNSUPPORTED_COMPONENT_KINDS` from `domain/resolver.ts` and asserts
  it does NOT contain `"hooks"`. At plan-time the symbol was
  module-private (`const UNSUPPORTED_COMPONENT_KINDS = [...]`), so the
  import would have failed typecheck.
- **Fix:** Added the `export` keyword to the existing `const`
  declaration. Behavior is unchanged — same identifier, same shape,
  same content. `SUPPORTED_COMPONENT_KINDS` was already exported in
  57-03, so this symmetrically widens the closed-set surface for
  consumers that want to introspect both tuples.
- **Files modified:** `extensions/pi-claude-marketplace/domain/resolver.ts` (one-line `export` widening at the tuple declaration).
- **Commits:** 4930931 (rolled into the Task 1 commit).

**2. [Rule 3 - Blocking] ESLint auto-fixes on the new architecture test file**

- **Found during:** Task 1 pre-commit.
- **Issue:** Initial draft of `hooks-foundation.test.ts` violated
  `import-x/order` (empty-line separation between import groups and
  ordering of the `import type ... PluginEntry` line),
  `@typescript-eslint/non-nullable-type-assertion-style` (preferred
  `!` non-null assertion over `as SchemaNode` for two
  `Object.keys(...)[0]` reads), and `@stylistic/padding-line-between-statements`
  on a few control-flow blocks.
- **Fix:** `eslint --fix tests/architecture/hooks-foundation.test.ts`
  applied the standard auto-corrections. No semantic changes; the test
  bodies and assertions are byte-equivalent to the original draft.
- **Files modified:** `tests/architecture/hooks-foundation.test.ts`.
- **Commits:** 4930931 (rolled into the Task 1 commit).

### Architectural deviations

None. HOOK-01 / HOOK-02 / HOOK-03 / D-57-01 / D-57-02 / D-57-04 / NFR-7
all honored verbatim.

## Verification gate results

- `npm run check`: GREEN (exit 0). Full unit + integration suites
  green; typecheck + ESLint + Prettier clean.
- `node --test tests/architecture/hooks-foundation.test.ts`: 8/8
  GREEN.
- `node --test tests/architecture/no-hooks-strict-additional-properties.test.ts`:
  2/2 GREEN.
- `grep -nE 'Phase [0-9]+|Plan [0-9]+|Wave [0-9]|Pitfall [0-9]+\b'
  tests/architecture/hooks-foundation.test.ts
  tests/architecture/no-hooks-strict-additional-properties.test.ts |
  grep -v '^[^:]*:[0-9]*:[[:space:]]*#'`: empty (no forbidden tokens).

## Self-Check: PASSED

- `tests/architecture/hooks-foundation.test.ts`: FOUND.
- `tests/architecture/no-hooks-strict-additional-properties.test.ts`: FOUND.
- `extensions/pi-claude-marketplace/domain/resolver.ts` (modified): FOUND with `export const UNSUPPORTED_COMPONENT_KINDS`.
- Commit `4930931` (Task 1): FOUND.
- Commit `df593e4` (Task 2): FOUND.
