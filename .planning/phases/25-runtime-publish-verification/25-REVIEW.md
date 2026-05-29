---
phase: 25-runtime-publish-verification
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - tests/shared/snm37-behavioral-smoke.test.ts
  - tests/shared/snm38-indent-ladder.test.ts
  - tests/edge/completions/provider.test.ts
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 25 changed no product code. The four reviewed artifacts are two new test
files under `tests/shared/`, a comment-only addition to an existing edge test,
and a doc clarification in `docs/output-catalog.md`.

Both new test files pass cleanly (`node --test` green). Assertions are grounded
in the real `notify.ts` renderer -- the mock shapes align with `softDepStatus`'s
actual probe surface, the hash-version regex matches the `formatHashVersionForDisplay`
algorithm, the full ladder snapshot matches the fixture output analytically and
empirically. No false-positive risk was found in the primary assertions.

Two warnings surfaced: a dead filter-arm in SNM-38's header-detection predicate
(the `◐` glyph is not produced by any renderer arm), and a maintenance-debt
concern from duplicated mock infrastructure across three test files with no
shared helper. Two info-level items: the doc's "0 / 2 / 4 / 6" claim slightly
over-claims the SNM-38 gate's scope (6-space is locked elsewhere), and a
comment-enumeration gap in provider.test.ts (item b is skipped).

---

## Warnings

### WR-01: Dead filter arm `◐` in SNM-38 header-detection predicate

**File:** `tests/shared/snm38-indent-ladder.test.ts:152`

**Issue:** The marketplace-header filter checks three glyph prefixes:

```ts
.filter(({ l }) => l.startsWith("● ") || l.startsWith("◐ ") || l.startsWith("⊘ "))
```

The `◐` (half-filled circle, U+25D0) is not emitted by any arm of
`renderMpHeader` in `notify.ts`. That function uses exactly two icon constants:
`ICON_INSTALLED = "●"` and `ICON_UNINSTALLABLE = "⊘"`. The `◐` branch never
matches. This is misleading to future readers -- it suggests an unloaded or
in-progress marketplace state that does not exist in the v1.4 renderer. If a
future renderer update introduces `◐` for a new marketplace state, the filter
would accidentally catch those lines and silently assert they are at column 0
(which may or may not be correct for the new state), suppressing any indent
regression for that state.

**Fix:** Remove the dead arm or replace it with a comment explaining why it is
intentionally absent:

```ts
// ◐ is not used by any renderer arm in v1.4; omit it.
.filter(({ l }) => l.startsWith("● ") || l.startsWith("⊘ "))
```

---

### WR-02: Duplicated mock infrastructure across three test files with no shared helper

**File:** `tests/shared/snm37-behavioral-smoke.test.ts:66-87`,
`tests/shared/snm38-indent-ladder.test.ts:73-94`
(also: `tests/architecture/catalog-uat.test.ts:145-180`)

**Issue:** All three files independently declare identical or near-identical
boilerplate:

```ts
interface MockCtx { ui: { notify: ReturnType<typeof mock.fn> }; }
function makeCtx(): MockCtx { return { ui: { notify: mock.fn() } }; }
interface MockTool { name?: string; }
interface MockPi { getAllTools: () => MockTool[]; }
function piWithBothLoaded(): MockPi { return { getAllTools: () => [...] }; }
```

The interfaces already diverge: `catalog-uat.test.ts` includes
`sourceInfo?: { source?: string }` on `MockTool` (needed for the alternative
`pi-mcp-adapter` detection path in `hasLoadedPiMcpAdapter`), which the SNM-37/38
mocks omit. This divergence is currently harmless because `hasLoadedPiMcpAdapter`
checks `tool.name === "mcp"` first and the mock supplies `{ name: "mcp" }`, so
the `sourceInfo` branch is never reached. However, if `hasLoadedPiMcpAdapter` is
ever refactored to require `sourceInfo`, the SNM-37/38 mocks will silently
misreport the probe state rather than failing at compile time.

**Fix:** Extract a shared test helper module (e.g.,
`tests/helpers/notify-mock.ts`) with the canonical `MockCtx`, `makeCtx`,
`MockTool`, `MockPi`, `piWithBothLoaded`, `piWithMcpLoaded`, and
`piWithNothingLoaded` factories. Import from it in all three files. This is the
same pattern already used elsewhere under `tests/helpers/`.

---

## Info

### IN-01: Doc "0 / 2 / 4 / 6" claim over-attributes the SNM-38 gate

**File:** `docs/output-catalog.md:56`

**Issue:** The added paragraph reads:

> …which `tests/architecture/catalog-uat.test.ts` (byte-equality) and
> `tests/shared/snm38-indent-ladder.test.ts` (explicit leading-whitespace) both
> lock at 0 / 2 / 4 / **6**…

SNM-38 exercises 0, 2, and 4 only. Its fixture contains no `rollbackPartial`
row, so the 6-space rollback-phase cause-chain level is not asserted by
`snm38-indent-ladder.test.ts`. The 6-space level IS byte-locked by
`catalog-uat.test.ts` (the `failure-rollback-partial` fixture). Attributing the
"6" to SNM-38 is inaccurate and will mislead anyone auditing which gate covers
the 6-space level.

**Fix:** Qualify the claim:

> …which `tests/architecture/catalog-uat.test.ts` (byte-equality, covers the
> full 0 / 2 / 4 / 6 ladder) and
> `tests/shared/snm38-indent-ladder.test.ts` (explicit leading-whitespace,
> covers 0 / 2 / 4) together lock the pre-tui indent contract…

---

### IN-02: Comment in provider.test.ts skips enumeration item (b)

**File:** `tests/edge/completions/provider.test.ts:821-823`

**Issue:** The "Causes ruled out" comment enumerates items (a) and (c) with no
(b):

```
// Causes ruled out: (a) provider code-path divergence -- ELIMINATED, ...
// (c) `getInstalledPluginToMarketplacesMap` empty via scope-root mismatch...
```

Item (b) is absent. This suggests it was either investigated and dismissed
without being recorded, or removed during editing and the labels were not
renumbered. It leaves a gap in the root-cause audit trail that the comment is
intended to provide.

**Fix:** Either restore the missing (b) item, or renumber (c) to (b) if the
omission was intentional:

```
// Causes ruled out:
//   (a) provider code-path divergence -- ELIMINATED, ...
//   (b) `getInstalledPluginToMarketplacesMap` empty via scope-root mismatch -- ...
```

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
