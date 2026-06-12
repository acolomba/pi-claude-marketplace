---
phase: 52-first-run-migration
fixed_at: 2026-06-10T12:45:00Z
review_path: .planning/phases/52-first-run-migration/52-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 52: Code Review Fix Report

**Fixed at:** 2026-06-10T12:45:00Z
**Source review:** .planning/phases/52-first-run-migration/52-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (fix_scope: critical_warning; 4 Info findings out of
  scope)
- Fixed: 3
- Skipped: 0

Full `npm run check` green after all fixes: typecheck + ESLint + Prettier +
1575 unit tests (1571 pre-existing + 4 new) + 7 integration tests.

## Fixed Issues

### CR-01: Unguarded `.raw` cast wedges first-run migration on forward-compat source records

**Files modified:**
`extensions/pi-claude-marketplace/persistence/migrate-config.ts`,
`tests/persistence/migrate-config.test.ts`
**Commit:** 4df18df
**Applied fix:** Guarded the source recovery: when `mp.source` lacks a string
`raw`, the projection coerces the record to its JSON string
(`JSON.stringify(storedSource ?? null)`), matching the `objectRaw` precedent
the `domain/source.ts` parse funnel already applies to raw-less objects. The
projection now ALWAYS emits a string `source`, so migration can never wedge
and no marketplace is ever silently dropped.

**Deviation from the review's suggested fix (deliberate):** the review
suggested falling back to `sourceLogical(parsed)`. Verified at runtime that
this is NOT safe — `sourceLogical`'s `unknown` arm returns `source.raw`,
which is `undefined` for exactly the raw-less trigger shape, so the suggested
fix would not have unwedged the migration. The cast was also changed from
`as ParsedSource` to `as Partial<ParsedSource> | null | undefined` to keep
the guard type-honest (STATE_SCHEMA declares `source: Type.Unknown()`); the
lying cast tripped `@typescript-eslint/no-unnecessary-condition`.

Two regression tests added (the WR-02 item-2 obligation): raw-less
`{ kind: "unknown" }` source coerces to its JSON string and the projection
passes `CONFIG_VALIDATOR.Check`; unknown-kind source WITH a string `raw`
recovers `raw` byte-stably.

### WR-01: Skip arm conflates "existing valid config" with "existing invalid config" and discards the CFG-03 error detail

**Files modified:**
`extensions/pi-claude-marketplace/persistence/migrate-config.ts`,
`tests/persistence/migrate-config.test.ts`
**Commit:** 313fe20
**Applied fix:** `MigrateFirstRunResult` is now a discriminated union: the
`migrated: false` arm carries
`reason: "existing-valid" | "existing-invalid"` and forwards `loadConfig`'s
invalid-arm `error` detail, so the Phase 55 caller keeps the CFG-03
trichotomy without a second (divergence-prone) `loadConfig` probe.
`entryCount` was dropped from the false arm (it was a constant 0). Confirmed
zero production callers exist (only the test file), as the review stated.
Section C tests updated to pin the reasons and error details
(`JSON parse failed` for the 0-byte case, `schema validation failed` for the
schema-invalid case).

### WR-02: No test coverage for the fresh-install (empty-state) arm or the CR-01 trigger

**Files modified:** `tests/persistence/migrate-config.test.ts`
**Commit:** eecd9c9
**Applied fix:** Added the fresh-install coverage: a pure-projection test
(`buildConfigFromState({ schemaVersion: 1, marketplaces: {} })` deep-equals
the empty config and passes `CONFIG_VALIDATOR.Check`) and a
`migrateFirstRunConfig` round-trip on the real `DEFAULT_STATE` export
asserting `migrated: true`, `entryCount: 0`, and
`loadConfig(...).status === "valid"` with the expected empty-config body
(the D-13 gate-opening file). The CR-01 trigger-input regression tests
(item 2 of this finding) landed with the CR-01 fix commit (4df18df).

## Out of Scope (not addressed)

Info findings IN-01 through IN-04 were outside `fix_scope: critical_warning`
and remain open in 52-REVIEW.md.

---

_Fixed: 2026-06-10T12:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
