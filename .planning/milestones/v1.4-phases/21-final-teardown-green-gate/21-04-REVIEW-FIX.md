---
phase: 21-04-gap-closure
fixed_at: 2026-05-28T00:00:00Z
review_path: .planning/phases/21-final-teardown-green-gate/21-04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 21-04: Code Review Fix Report

**Fixed at:** 2026-05-28T00:00:00Z
**Source review:** `.planning/phases/21-final-teardown-green-gate/21-04-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (1 BLOCKER, 4 Warnings)
- Fixed: 5
- Skipped: 0
- Out of scope: 2 Info findings (IN-01, IN-02) -- intentionally not addressed per the fix prompt; IN-02 is explicitly out-of-scope per the reviewer.

## Fixed Issues

### CR-01 (BLOCKER): Orphan-fold filter drops every `"present"` row

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`, `tests/orchestrators/plugin/list.test.ts`
**Applied fix:**

1. Changed the carry-over filter at `list.ts:690` to discriminate on `"present"` instead of `"installed"` (the unreachable token post-21-04 delta). The fix matches the new `installedRowMessage` emission and restores the orphan-fold pre-condition path. Added an explanatory comment block citing the regression source (21-04-REVIEW.md CR-01) and the integration counterpart at `tests/integration/fold-adoption.test.ts` phase 2.
2. Added a new orchestrator-level regression test in `tests/orchestrators/plugin/list.test.ts` named `"CR-01 / G-21-01: project-scope plugin under a CLONED user marketplace folds under the user-scope header (carry-over filter must discriminate on \`present\`)"`. The setup uses the existing `seedMarketplace` helper for the user-scope record + a direct `saveState` write for the project-scope record that points at the SAME `marketplaceRoot` directory (the on-disk shape produced by the install orchestrator's clone path). The assertions catch the regression that `tests/integration/fold-adoption.test.ts` phase 2 catches: the folded `● alpha [project] v1.0.0 (installed)` row must appear under the user-scope header, the duplicate `○ alpha v1.0.0 (available)` row must NOT appear, and no separate project-scope mp1 header is emitted.

**Verification:**

- `node --test tests/orchestrators/plugin/list.test.ts` -- 29 tests pass (28 existing + 1 new).
- `node --test tests/integration/fold-adoption.test.ts` -- phase 2 (line 238) now PASSES. Phase 1 still fails for the unrelated pre-existing reason flagged by the reviewer (out of scope for this fix pass; documented in the reviewer's summary).
- `npm run check` -- GREEN end-to-end.

### WR-01: `notify-types.test.ts` missing per-variant invariants for `PluginPresentMessage`

**Files modified:** `tests/architecture/notify-types.test.ts`
**Applied fix:** Added the `_VPresent` alias adjacent to the existing 10 `_V<Variant>` aliases (with a comment block citing UAT G-21-01 / 21-04-REVIEW.md WR-01). Added the per-variant invariants mirroring `_VInstalled`:

- Negative-presence: `_NoCauseOnPresent`, `_NoRollbackOnPresent`, `_NoReasonsOnPresent`, `_NoFromOnPresent`, `_NoToOnPresent` (each as `@ts-expect-error` indexed access, single-line under the directive per the file's documented pattern).
- Positive REQUIRED: `_Assert_DepsRequiredPresent` + `_Assert_DepsNotOptionalPresent` (mirrors the `_VInstalled` dependencies-required pair).
- Positive OPTIONAL: `_Assert_ScopeOnPresent`, `_Assert_VersionOnPresent` (mirrors the `_VInstalled` scope/version optional blocks).

**Verification:**

- `node --test tests/architecture/notify-types.test.ts` -- 1 test passes (the anchor test counts at runtime; the load-bearing assertions are compile-time `_Assert_*`).
- `npx tsc --noEmit -p .` -- 0 errors. The new `@ts-expect-error` directives correctly suppress the indexed-access TS2339s; removing the field from `PluginPresentMessage` in a future regression would fire "Unused @ts-expect-error" on those lines, surfacing the drift.

### WR-02: `sortPluginsInBlock` silently strips `p.scope` from a stray `"installed"` row

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
**Applied fix:** Adopted **Option (a)** from the review (the reviewer's preferred fix). Moved `"installed"` back into the scope-bearing case-fall-through alongside `"present"` and `"upgradable"`. The arm body `return p.scope ?? marketplaceScope` is correct for both the (post-fix) unreachable list-surface case AND any future regression that re-routes a cascade-context `installed` row through the list orchestrator -- a cross-scope orphan-fold `scope` value on a `PluginInstalledMessage` (SNM-11 / D-13-18) is preserved instead of silently overwritten with `marketplaceScope`. Comment block updated to cite WR-02 (21-04-REVIEW.md) and explain the defense-in-depth motivation.

**Verification:**

- `npx tsc --noEmit -p .` -- 0 errors (the switch is still exhaustive over `PluginNotificationMessage["status"]`; moving `"installed"` to the scope-bearing arm does not affect exhaustiveness).
- `npm run check` -- GREEN end-to-end. All existing list orchestrator tests still pass (the `installed` arm is unreachable on the list surface post-21-04, so the behavior change is invisible to current paths -- WR-02 hardens the defensive bucket against future regressions).

### WR-03: Status-token reference table omits the `"present"` discriminator

**Files modified:** `docs/output-catalog.md`
**Applied fix:** Inserted the suggested one-row entry verbatim from the review at the appropriate position in the "Status token reference" table (immediately after the existing `(installed)` row), with the cross-reference text:

```
| `(installed)` (via `present` discriminator) | ●    | Plugin row -- list surface (steady-state inventory). Byte-identical render to the transition `(installed)` token but does not trigger the reload-hint per SNM-15 / G-21-01. |
```

This resolves the inconsistency between the table and the prose at lines 71-72 / 218 that references the `present` discriminator by name without the table defining it.

**Verification:**

- Visual diff of the table shows the new row sits between the existing `(installed)` transition row and the `(updated)` row.
- `npm run check` -- GREEN (no markdown-aware tests; Prettier formatting preserved the table alignment).

### WR-04: `(installed)` status reference does not mention the `list` surface

**Files modified:** `docs/output-catalog.md`
**Applied fix:** Updated the existing `(installed)` row's "Where it appears" column to include the `list` surface verbatim per the review's suggested text:

```
| `(installed)`       | ●    | Plugin row -- `list` (steady-state inventory via `present` discriminator), install, import cascade, reinstall (rare), update (rare). |
```

The `list` mention is now first in the call-site enumeration, reflecting that the list surface is the dominant emission site for the rendered `(installed)` token (7+ occurrences in the `## /claude:plugin list` section flow from `PluginPresentMessage`, not `PluginInstalledMessage`).

**Verification:**

- Visual diff confirms the row's "Where it appears" column now includes the list surface alongside install, import cascade, reinstall, update.
- `npm run check` -- GREEN.

## Skipped Issues

None in scope.

### Out-of-scope (intentionally not addressed)

- **IN-01:** Doc comment clarification on `installedRowMessage`. Doc-comment-only; not load-bearing. Out of scope per the fix prompt.
- **IN-02:** `compareReasons` cross-variant ergonomics. Explicitly out of scope per the reviewer (the line was unchanged by the 21-04 delta).

## Verification Summary

| Check | Result | Status |
| ----- | ------ | ------ |
| `npm run check` | 1123 tests pass / 0 fail / 0 skipped; exit code 0 | GREEN |
| `node --test tests/integration/fold-adoption.test.ts` phase 2 (line 238) | PASS (was FAIL on the diff base) | GREEN |
| `node --test tests/integration/fold-adoption.test.ts` phase 1 (line 165) | FAIL (pre-existing per reviewer; OUT OF SCOPE) | n/a |
| `node --test tests/orchestrators/plugin/list.test.ts` (new CR-01 regression test) | PASS (29/29 tests pass) | GREEN |
| `node --test tests/architecture/notify-types.test.ts` (compile-time `_Assert_*` for `_VPresent`) | PASS (typecheck 0 errors) | GREEN |
| `npx tsc --noEmit -p .` after all edits | 0 errors | GREEN |

## Notes for the Developer

1. The CR-01 fix is the load-bearing change; the regression test catches the silent drop at the orchestrator boundary. The integration test at `tests/integration/fold-adoption.test.ts` phase 2 is the end-to-end counterpart and now passes.
2. The fold-adoption phase 1 failure on the diff base is unrelated to this review pass and was flagged by the reviewer as a pre-existing issue. It should be addressed separately (likely as a follow-up review or a `gsd-debug` session).
3. WR-02 is a defense-in-depth fix: the arm is structurally unreachable on the list surface today (`installedRowMessage` only emits `present` / `upgradable`), but the change preserves correct behavior under any future regression that re-routes an `installed` row through the list orchestrator. The `assertNever`-style throw was not adopted (Option b in the review) because Option a is simpler and matches the pre-delta semantic.
4. Documentation edits (WR-03 / WR-04) align the status-token reference table with the prose elsewhere in the same authoritative spec file. Future readers of the catalog who land on the table now see the `present` discriminator alongside its rendered `(installed)` token.

---

_Fixed: 2026-05-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
