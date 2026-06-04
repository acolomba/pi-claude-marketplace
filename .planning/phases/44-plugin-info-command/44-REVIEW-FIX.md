---
phase: 44-plugin-info-command
fixed_at: 2026-06-04T00:00:00Z
review_path: .planning/phases/44-plugin-info-command/44-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 5
status: partial
fix_commit: 1debb76
---

# Phase 44: Code Review Fix Report

**Fixed at:** 2026-06-04T00:00:00Z
**Source review:** `.planning/phases/44-plugin-info-command/44-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope (WARNING tier): 3
- Fixed: 2 (WR-01, WR-02)
- Deferred: 1 WARNING (WR-03) + 4 INFO (per fix directives)
- Atomic commit: `1debb76`
- `npm run check`: GREEN (1459 tests pass, including catalog UAT byte-equality)

## Fixed Issues

### WR-01: `buildInstalledRow` silently swallows `resolveStrict` throws and `installable: false`

**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- `tests/orchestrators/plugin/info.test.ts`

**Commit:** `1debb76`

**Applied fix:**

1. Added a local file-private `narrowProbeError(err)` classifier in
   `info.ts` that mirrors the ladder in
   `orchestrators/plugin/list.ts::narrowProbeError` (extraction to
   `shared/` was rejected: project layering rules treat `shared/` as
   the only sanctioned cross-orchestrator import surface, and the fix
   directive constrained scope to `info.ts` + its test file). The two
   implementations are documented as needing to stay in lockstep.

2. `buildInstalledRow` catch branch now classifies the thrown error via
   `narrowProbeError(err)` and threads the closed-set Reason
   (`permission denied` / `source missing` / `unparseable` /
   `unreadable`) onto the `(installed)` row's `reasons` field. Status
   remains `installed` because the state record confirms the install;
   the brace makes the persistence-vs-disk disagreement explicit, so
   the row no longer renders byte-identically to a deliberate INFO-05
   external-source defer.

3. `buildInstalledRow` `!resolved.installable` branch now forwards
   `narrowResolverNotes(resolved.notes)` as `reasons` on the
   `(installed)` row. Unsupported-field disagreements (e.g. the
   manifest now declares `hooks` / `lspServers`) are surfaced via the
   existing `{hooks}` / `{lsp}` / `{unsupported source}` REASONs
   instead of being silently hidden behind the
   `components: not resolved` marker.

4. Added `__test_narrowProbeError` re-export for direct unit testing
   of the classifier (mirrors the
   `orchestrators/plugin/list.ts::__test_narrowProbeError` precedent).

**New tests:**

- `WR-01: narrowProbeError -> EACCES classifies as 'permission denied'`
- `WR-01: narrowProbeError -> ENOENT classifies as 'source missing'`
- `WR-01: narrowProbeError -> SyntaxError classifies as 'unparseable'`
- `WR-01: narrowProbeError -> generic Error falls through to 'unreadable'`
- `WR-01: installed plugin whose manifest declares hooks surfaces '{hooks}'
  on the (installed) row` (locks the post-fix byte form
  `● legacy v0.1.0 (installed) {hooks}` + `components: not resolved`)

### WR-02: `buildNotInstalledRow` hardcodes `reasons: ["unreadable"]`

**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
  (same commit as WR-01)
- `tests/orchestrators/plugin/info.test.ts` (same commit as WR-01)

**Commit:** `1debb76`

**Applied fix:**

Replaced the hardcoded `reasons: ["unreadable"]` in
`buildNotInstalledRow`'s catch branch with the new shared
`narrowProbeError(err)` classifier (same helper added for WR-01). The
catch handler now distinguishes `permission denied` / `source missing`
/ `unparseable` / `unreadable` so the info surface and the list
surface produce the SAME user-facing reason for the same underlying
failure (post-Phase 29 / UXG-08 cross-surface consistency contract).

**New tests:**

- `WR-02: not-installed plugin with malformed plugin.json surfaces
  '{unparseable}' (not '{unreadable}')` (writes a malformed
  `plugin.json` under the plugin source dir so `resolveStrict`'s
  JSON.parse throws `SyntaxError`; asserts the rendered row does NOT
  contain the pre-fix hardcoded `(unavailable) {unreadable}` and DOES
  contain `(unavailable)`).

## Skipped (Deferred) Issues

### WR-03: `nameFromEntry` cannot distinguish a real Pi skill from a noise subdirectory

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:185-195`
**Reason:** deferred per fix directives -- non-blocking; surfaces only
non-skill subdirs as skills, byte-form remains valid; full
`SKILL.md` discovery is a v1.9 plugin-schema task. Documented
behavior is "info surface displays the authoring intent; the bridges'
filtering only affects install-time staging" -- a deliberate design
choice consistent with the catalog narrative.

### IN-01: `getInfoPluginToMarketplacesMap` silently discards `targetScope`

**File:** `extensions/pi-claude-marketplace/edge/completions/data.ts:354-373` and `386-388`
**Reason:** deferred per fix directives (INFO tier). Current behavior
is correct (the scope filter MUST NOT narrow the candidate set per
the TC-6 contract). Recommended renames / `_unused`-prefix
signature parameter are purely cosmetic maintainability concerns.

### IN-02: INFO-04 carve-out `marketplaceScope: opts.scope ?? "user"` placeholder

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:597-600`
**Reason:** deferred per fix directives (INFO tier). Structural-
protection suggestion only; renderer predicate ordering is currently
correct (verified in review focus area #4). Recommended notify-v2
test addition is follow-up hardening, not a contract bug.

### IN-03: `installablePluginDirs` coverage gap on implicit-by-convention path

**File:** `tests/orchestrators/plugin/info.test.ts:113-183, 260-265, 304-321`
**Reason:** deferred per fix directives (INFO tier). The missing
"installed with completely empty component dirs" fixture is a quality
nicety, not a correctness gap. Existing tests already cover
`componentsResolved: true` with non-empty components AND the
`componentsResolved: false` marker arm.

### IN-04: serial awaits in `composeResolvedComponents` vs. parallel fan-out in `getPluginInfo`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:631-633`
**Reason:** deferred per fix directives (INFO tier). Explicitly flagged
as out-of-v1-scope per the review charter ("Performance issues are
explicitly out of v1 scope"). Behavior is correct.

---

## Verification

- `npm run check` exits 0: typecheck + ESLint + Prettier + tests all
  GREEN.
- Test suite: 1459 tests pass, 0 fail.
- Catalog UAT byte-equality preserved (Wave 2 fixtures untouched).
- Scope guardrails honored:
  - `shared/notify.ts` renderer untouched (orchestrator-layer fix only).
  - Catalog and UAT fixtures unchanged.
  - All forbidden notify.ts functions (`composeMarketplaceBlock`,
    `renderMpHeader`, `renderPluginRow`, `composePluginLines`,
    `joinTokens`, `composeReasons`, `renderMarketplaceInfo`,
    `composeMpInfoHeader`, `renderMarketplaceInfoCascade`,
    `renderPluginInfo`, `wrapDescription`,
    `pluginInfoStatusGlyph`, `appendResolvedComponentLines`) untouched.
- Pre-commit hooks ran without `--no-verify`; `trufflehog` scan
  performed separately from the main worktree (the worktree's `.git`
  is a file, not a directory, which causes trufflehog's git-index
  reader to fail per the documented CLAUDE.md workaround).

---

_Fixed: 2026-06-04T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
