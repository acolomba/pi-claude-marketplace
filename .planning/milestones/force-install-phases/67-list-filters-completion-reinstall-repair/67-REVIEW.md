---
phase: 67-list-filters-completion-reinstall-repair
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/router.test.ts
  - tests/orchestrators/edge-deps.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/plugin-state-classifier.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/shared/completion-cache.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: warnings_resolved
warnings_resolved:
  - WR-01: f3426c34
  - WR-02: 31589e66
---

# Phase 67: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** standard
**Files Reviewed:** 20
**Status:** warnings_resolved (WR-01 `f3426c34`, WR-02 `31589e66`; INFO items
IN-01..03 remain deferred)

## Summary

Phase 67 (RINST-01 / LIST-01 / LIST-02) is a careful, well-tested change. The
shared `plugin-state-classifier.ts` extraction is clean and pure (NFR-5 respected
-- the no-network `resolveStrict` probe stays at the callers). The `--force`-gated
completion candidate sets are correct and the byte-identical-without-`--force`
contract holds (verified against the regression tests). The reinstall `--force`
retirement is consistent across router usage, handler, completion, and the agents
bridge (`{ force: true }` now unconditional). The plugin-index cache schema bump
1->2 correctly drops+rebuilds stale caches via the existing schema-mismatch path,
and all three on-disk writes were updated in lockstep.

No BLOCKER-class defects (no incorrect output, data loss, or security issue) were
found. Two WARNING-class issues concern a real (if minor) behavioral divergence
between the completion bucketizer and the `list` orchestrator for *disabled*
records, plus a parity drift-guard test that does not actually guard what its
comment claims. Three INFO items are stale comments and unreachable/inconsistent
error-handling code.

## Warnings

### WR-01: completion bucketizer skips the `isRecordedButDisabled` guard that `list` applies, and the parity test does not catch the divergence

**Resolved:** commit `f3426c34` (`fix(67): WR-01 route disabled guard through
shared classifier`). The recorded-but-disabled guard now lives in the shared
`classifyInstalledRecord` (collapses a disabled record to `installed` ahead of
the force-installed branch), so the completion bucketizer and `list` agree
(D-67-02) with no completion-local reclassification -- a disabled +
version-drifted plugin is `installed` in the cache (never upgradable/
force-upgradable) so it cannot leak into the `update --force` candidate set
while `list` renders it `(disabled)`. The parity drift-guard test dropped the
false "== a divergence from list" claim and a dedicated WR-01 test now proves
the property directly (bucketizer `installed` + `isRecordedButDisabled` holds).

**File:** `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:81-107` (`classifyInstalledPluginRow`), `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:334-346`, `tests/orchestrators/edge-deps.test.ts:460-520`

**Issue:** The `list` orchestrator checks `isRecordedButDisabled(record)` *before*
the shared classifier (`installedRowMessage` returns `"disabled"` and never calls
`classifyInstalledRecord` for a disabled record). The completion bucketizer
(`classifyInstalledPluginRow`) calls `classifyInstalledRecord` directly with **no**
disabled guard, so a disabled plugin is classified as `installed` / `upgradable`
/ `force-installed` / `force-upgradable` in the completion cache.

The drift-guard test asserts the bucketizer equals `classifyInstalledRecord`
re-run on the same inputs (`tests/orchestrators/edge-deps.test.ts:460-520`), and
its comment claims this is "== a divergence from `list`". That equivalence is
false: because `list` applies `isRecordedButDisabled` ahead of the classifier,
`bucketizer == classifier` does **not** imply `bucketizer == list`. The test
therefore gives false confidence that the two surfaces never diverge.

Net user-visible effect: a disabled plugin whose manifest version has drifted
classifies as `upgradable`/`force-upgradable` in the cache, so it is offered as a
candidate under `update --force <TAB>` even though `list` renders it `(disabled)`
and its version pin is frozen while disabled (ENBL-02). (Note: the omission is
also *load-bearing* for the no-`--force` byte-identical contract -- a `disabled`
status would not be a member of `INSTALLED_INVENTORY_STATUSES` and disabled
plugins would silently vanish from `uninstall`/`update` completion. So the fix is
not "add the guard" but "stop claiming `list` parity and decide the `update
--force` disabled case deliberately.")

**Fix:** Either (a) narrow the drift-guard test's stated contract (drop the "==
a divergence from `list`" claim; it only proves bucketizer == raw classifier),
and add an explicit case asserting the intended completion behavior for a disabled
+version-drifted record; or (b) if disabled plugins must not be offered under
`update --force`, exclude them in the bucketizer before classification, e.g.:
```ts
// in classifyInstalledPluginRow, before classifyInstalledRecord:
if (isRecordedButDisabled(installed)) {
  return { name: pluginName, status: "installed", version: installed.version };
}
```
(keeping `installed` so the no-`--force` set still includes it, while the
`force-upgradable`/`upgradable` mislabel that leaks into `update --force` is
avoided).

### WR-02: `update --force` completion can surface a force-installed plugin's upgrade as nothing, and a force-installed+drifted plugin is silently unreachable

**Resolved:** commit `31589e66` (`fix(67): WR-02 offer force-installed-upgradable
under update --force`). Settled behavior: a force-installed plugin WITH a newer,
NON-unavailable candidate has meaningful `update --force` work (promote back to
`installed` if the candidate is supported -- FSTAT-03 -- or re-apply force if
still unsupported), so it must be offerable; a no-candidate (or
structural-unavailable-candidate) degraded record stays plain `force-installed`
(a same-version re-apply is `reinstall`'s job, RINST-01), consistent with update
completion's newer-version contract. The classifier now derives a distinct
`force-installed-upgradable` status for that case -- rendered `(force-installed)`
on `list` (no new user-visible token; STATUS_TOKENS stay 22/17/7), admitted to
`FORCE_UPDATE_STATUSES`, and NEVER `force-upgradable` (FSTAT-04 unchanged). The
plugin-index cache union gained the status and bumped schemaVersion 2 -> 3. The
inaccurate `data.ts` comment was corrected.

**File:** `extensions/pi-claude-marketplace/edge/completions/data.ts:80-83` (`FORCE_UPDATE_STATUSES`), `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:80-97`

**Issue:** A degraded-installed plugin (`compatibility.unsupported` non-empty) that
*also* has a newer manifest version classifies as `force-installed` (A4 precedence
wins over the upgrade signal -- `classifyInstalledRecord` returns before consulting
the candidate). `FORCE_UPDATE_STATUSES = {upgradable, force-upgradable}` excludes
`force-installed`, so `update --force <TAB>` will **not** offer that plugin even
though a newer version exists and `update --force` is exactly the operation that
would re-resolve it. The comment at `data.ts:78` ("Plain `installed` /
`force-installed` are excluded (nothing to upgrade)") is inaccurate for the
force-installed-with-newer-version case -- there *is* something to upgrade.

This is consistent between `list` and the completion (both apply A4), so it is a
deliberate-precedence artifact rather than a divergence, but it produces a
completion blind spot for a legitimate `update --force` target.

**Fix:** Confirm with the LIST-02 decision owner whether a force-installed plugin
with a newer candidate should be a `force-upgradable` (offered) candidate. If yes,
the A4 precedence needs a carve-out for "degraded AND newer candidate". If the
current behavior is intended, correct the `data.ts:74-83` comment to state that
force-installed plugins are intentionally excluded from `update --force`
completion even when a newer version exists, so the gap is documented rather than
appearing to be an oversight.

## Info

### IN-01: stale comments still describe three list filters after `--unsupported` made four

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:35-37`, `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts:7-8`

**Issue:** The list orchestrator's PL-1 header comment ("when NO filter flags
(--installed / --available / --unavailable) are set") and the handler's shim
comment ("three boolean filter flags (--installed / --available / --unavailable)")
omit the new `--unsupported` flag. The code (`filtersPassive`, `BOOLEAN_FLAGS`) is
correct and lists all four; only the prose is stale.

**Fix:** Add `--unsupported` to both comments so the documented filter set matches
the implemented one.

### IN-02: reinstall handler's `--`-positional rejection is unreachable and uses different wording than the list handler

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts:48-55`

**Issue:** `extractLocalFlag(args, ctx, USAGE, [])` already rejects every unknown
long flag (with `Unknown flag: "<tok>".`) and strips `--local`, and `parseArgs`
consumes `--scope <value>`. So `parsed.positional` can never contain a
`--`-prefixed token, making the loop's `if (token.startsWith("--")) { ... "Unknown
option: ..." }` branch dead. It also emits `Unknown option:` whereas the reachable
path (`extractLocalFlag`) and sibling commands use `Unknown flag:`, and `list.ts`
uses `Unknown option:` -- an inconsistent user-facing wording across handlers.

**Fix:** Remove the unreachable `--` branch from the reinstall positional loop (it
is fully covered by `extractLocalFlag`), or, if kept as defense-in-depth, align
its message string with the canonical `Unknown flag:`/`Unknown option:` choice
used project-wide.

### IN-03: `getInstalledPluginToMarketplacesMap` retains an unused `_mode` parameter

**File:** `extensions/pi-claude-marketplace/edge/completions/data.ts:379-415`

**Issue:** The first parameter `_mode` is never read in the body (it only narrows
the type at the call site). It is harmless and underscore-prefixed per convention,
but worth noting since the mode no longer influences candidate selection for the
installed-modes path (only `force` does).

**Fix:** Optional -- drop the parameter if the type narrowing is not needed at the
call boundary, or leave as-is with the underscore convention.

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
