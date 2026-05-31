---
phase: 19-migration-wave-2-plugin-orchestrator-family
fixed_at: 2026-05-27T00:00:00Z
review_path: .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-05-27
**Source review:** 19-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 12 (1 critical, 5 warnings, 6 info)
- Fixed: 12
- Skipped: 0
- `npm run check` status: GREEN (1369 pass / 0 fail / 2 todo)

## Fixed Issues

### CR-01: Phase-3a aggregate update failure emits two notifications

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`, `tests/orchestrators/plugin/update.test.ts`
**Commit:** `dd7fe6f`
**Applied fix:** Added an early-return in `updatePlugins` immediately after
`runThreePhaseUpdate` returns a `partition: "failed"` outcome whose
`phaseFailures !== undefined`. This is the structural signal that the inline
`notifyDirectFailure` inside `runThreePhaseUpdate` already fired for the
phase-3a aggregate path. Without the early-return the outcome fell through to
`outcomes.push` + `renderUpdateCascadeAndNotify`, producing a second
notification for the same failure. The minimal contract-preserving variant from
the review's "two fix options" -- chose this over deleting the inline emission
because the inline path uses `aggregateMsg` carrying the
`RECOVERY_PLUGIN_REINSTALL_PREFIX` ("plugin-uninstall + plugin-install for
...") which the cascade renderer does NOT reconstruct (it only emits the
per-phase `msg` strings). Updated the PUP-6 phase-3 test to assert
`notifications.length === 1` instead of joining all notifications via
`.join("\n")` before regex-matching.

### WR-01: `renderUpdateCascadeAndNotify` byMp grouping is correct but fragile

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `feb2472`
**Applied fix:** Replaced the get-then-conditional-set pattern with the
get-existing-or-construct-new shape from `reinstall.ts:597-610`. Behavior is
identical; intent is now explicit and a future refactor that converted the
conditional set to an unconditional one cannot silently break the second-
iteration mutation path.

### WR-02: `list.ts` orphan-fold duplicates available/unavailable rows

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
**Commit:** `908010a`
**Applied fix:** Filter the project-side rows to keep only
`installed | upgradable` before appending them as `extraPlugins` into the
user-scope block. The shared manifest means both scopes enumerated the same
plugins; without the filter, every manifest-listed plugin not installed in
either scope produced two `(available)` rows under the user-scope header (one
from the project-side enumeration, one from the user-side's own enumeration).
The integration test recommended by the review under
`tests/integration/fold-adoption.test.ts` was NOT added in this fix-pass (the
project does not currently have a `tests/integration/` directory; adding the
directory + test setup is out of scope for a defensive fix). The existing
list.test.ts unit coverage stays green.

### WR-03: `list.ts` aggregate-failure catch synthesises a misleading identity

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`, `tests/orchestrators/plugin/list.test.ts`
**Commits:** `5e4b4c4` (initial), `577b896` (lint-fix collapsing duplicate function)
**Applied fix:** Added a dedicated `narrowListFailReason` for orchestrator-
level list failures, distinct from the per-row `narrowProbeError`. The codomain
(`ListReason`) is shared, but the documented purpose differs at the call site.
The bodies are identical (errno + SyntaxError + permissive fallback), so the
follow-up `577b896` collapsed the implementation into a shared private
`narrowErrnoLikeError` core to satisfy `sonarjs/no-identical-functions`. Added
6 unit tests through the `__test_narrowListFailReason` re-export. The cosmetic
ambiguity of the synthetic marketplace name `"(list)"` is acknowledged in a
code comment; both the marketplace name and plugin name are held as module-
level constants for a single edit point. Did NOT rename `"(list)"` to a less
ambiguous form because the current `MarketplaceNotificationMessage` shape has
no separate failure-trailer channel (the review explicitly noted this
constraint).

### WR-04: `composeInstallFailureMessage` declares but does not consume `marketplace`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
**Commit:** `55117d6`
**Applied fix:** Removed `marketplace: string` from the args type and stopped
passing it at the call site. The function body never read it; the dead data
flow is gone. No runtime behavior change.

### WR-05: `updatePlugins` enumerate-failure arm defaults to wrong stand-ins

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `8a4a3c6`
**Applied fix:** Split the enumerate-failure catch on `target.kind`. The
`marketplace` / `plugin` paths route through `notifyDirectFailure` under the
real marketplace name (V1 behavior preserved); the bare `all` form routes
through a new `notifyBareFormEnumerateFailure` helper that emits a synthetic
`"(update)"` marketplace block carrying a failed row with the same name --
mirroring the `reinstall.ts::reinstallPlugins` bare-form precedent
(`"(reinstall)"`). The dead `targetMarketplaceName` helper was removed. The
synthetic name is held as a module-level constant
`SYNTHETIC_UPDATE_PLACEHOLDER_NAME` for a single edit point.

### IN-01: Dead `void` statements in reinstall.ts

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
**Commit:** `4dd647d` (combined with IN-02)
**Applied fix:** Replaced `void locked.bridgeWarnings;` and
`void maintenanceWarnings;` with a clarifying comment. Both variables are
already consumed earlier in the function (the destructuring and the side-
effect await respectively), so the `void` no-ops added executable code where
a comment sufficed.

### IN-02: Dead conditional spreads on always-non-empty version

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
**Commit:** `4dd647d` (combined with IN-01)
**Applied fix:** Dropped the `version !== ""` half of the defensive spread
guard at all four sites (install success row, reinstall success row, uninstall
success row, uninstall failure row). `resolvePluginVersion` always returns a
non-empty string; persisted state records always carry non-empty versions.
The renderer suppresses the `v<version>` token on undefined / empty anyway, so
the empty-version edge case is handled structurally. The
`removedVersion !== undefined` half of the guard in uninstall.ts is kept
because the variable is hoisted from inside the withStateGuard closure and TS
cannot prove the closure ran.

### IN-03: Non-exhaustive switch in `narrowDirectFailReason`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `cedd87f`
**Applied fix:** Added `default: return assertNever(err.shape)` to the
`switch (err.shape.kind)` block inside `narrowDirectFailReason`. A future 5th
kind added to `PluginShapeError`'s discriminated union will now trigger a
compile-time error here instead of silently falling through to the errno-
substring branch. Mirrors the install.ts:1155 and update.ts:1059 precedents.

### IN-04: `installedRow.scope` always set when same as marketplace scope

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
**Commit:** `68e3189`
**Applied fix:** Dropped the `scope` field from the install success row. The
renderer's `renderScopeBracket` already suppresses the bracket when
`pluginScope === mpScope` (always true on the single-plugin install surface),
so the byte output is identical. Aligns install.ts with the "only emit fields
that affect the byte output" convention used by uninstall.ts and reinstall.ts.

### IN-05: `uninstall.ts:174-178` marketplace-absent branch reachability comment

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
**Commit:** `10cc8de`
**Applied fix:** Added a code comment documenting that the branch is reached
only via the explicit-scope path (where `resolveInstalledPluginTarget` short-
circuits without reading state, so the closure's `loadState` may find an
empty state.json). Exercised by PU-5 at uninstall.test.ts:489. No behavior
change.

### IN-06: ESLint plugin-orchestrator MSG-GR-3 scope tightening

**Files modified:** `eslint.config.js`
**Commit:** `f3096f6`
**Applied fix:** Removed `orchestrators/plugin/**` from MSG-Block 1b's
`ignores` array. MSG-GR-3 (per-scope iteration discipline) is independent of
the V1->V2 wrapper migration that MSG-Block 1 (routing rules) targets, so
re-enabling it for the migrated subtree gates future regressions. MSG-Block 1
still ignores `orchestrators/plugin/**` because its rules check for retired
V1 wrappers. No new violations in the current tree (verified by `npm run
lint`).

## Skipped Issues

None.

---

_Fixed: 2026-05-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
