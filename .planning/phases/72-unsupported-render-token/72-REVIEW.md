---
phase: 72-unsupported-render-token
reviewed: 2026-06-28T22:36:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
status: issues_found
---

# Phase 72: Code Review Report

**Reviewed:** 2026-06-28T22:36:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 72 de-collapses the prior D-64-01 behavior, splitting resolver
`unsupported` (not-installed, force-installable) out of the `unavailable`
render token into a dedicated `(unsupported)` / `⊖` (`ICON_UNSUPPORTED`) row.
The type model (`PluginUnsupportedMessage`, `PLUGIN_STATUSES` / `STATUS_TOKENS`
additions, `PluginInfoRowBase` widening), the list/info orchestrator splits, and
the closed-set tripwire bumps (22→23, 17→18) are correct and internally
consistent.

Exhaustiveness is sound. Every status switch that needed an `unsupported` arm
got one: `renderPluginRow` (notify.ts:2065), `pluginInfoStatusGlyph`
(notify.ts:2933), `list.messaging.ts` `LIST_RENDER.unsupported`, and tools.ts
`projectRowStatus` / `pluginScopeOrFallback` / `pluginVersion` / `pluginReasons`,
plus `sortPluginsInBlock.scopeOf` (list.ts:1019). No lazy `default` swallows the
new member. Routing is correct: the `unsupported` resolver arm emits
`status:"unsupported"` while every probe-error/containment catch path and the
non-locally-resolvable arm still emit `"unavailable"` (list.ts:556-604,
info.ts:1028-1056, buildNotInstalledPathRow catch). Severity is unchanged — the
row carries optional severity defaulting to info, matching the prior
`unavailable` collapse. The `buildNotInstalledPathRow` extraction is clean (a
params-bag helper that mirrors `buildInstalledRow`'s outer catch).

One BLOCKER: the new `(unsupported)` list/cascade row silently drops its
manifest `description` second line — a user-visible regression from the
pre-72 behavior where the same plugins rendered as `(unavailable)` WITH their
description, and a direct contradiction of the phase's "byte-consistent across
list and info surfaces" claim (the info surface DOES still render the
description).

## Critical Issues

### CR-01: `(unsupported)` list/cascade rows silently drop the manifest description line

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:3399-3411`
**Issue:**
`PluginUnsupportedMessage` declares `readonly description?: string`
(notify.ts:714) and that field IS populated in practice:
- `list.ts` `availableRowMessage` spreads `...descriptionField` into the
  `unsupported` arm (list.ts:549-552), and
- `info.ts` `buildNotInstalledPathRow` threads `...(description !== undefined && { description })`.

But the only description-rendering guard for the list/cascade surface
(`composePluginLinesWith`, which the central `composePluginLines` delegates to
at notify.ts:2792) enumerates statuses explicitly and OMITS `"unsupported"`:

```ts
if (
  (p.status === "installed" ||
    p.status === "upgradable" ||
    p.status === "available" ||
    p.status === "unavailable" ||
    p.status === "disabled" ||
    p.status === "force-installed" ||
    p.status === "force-upgradable") &&
  p.description !== undefined &&
  p.description.length > 0
) {
  lines.push(`    ${truncateDescription(p.description)}`);
}
```

Consequence: a not-installed plugin that resolves `unsupported` (e.g. an LSP or
hooks plugin) renders `⊖ <name> (unsupported) {lsp}` but NEVER prints its
4-space-indented description line. This is a regression — pre-phase-72 the same
plugin rendered through the collapsed `unavailable` arm, which IS in the guard,
so its description line WAS emitted (PL-4). It also breaks the stated
list/info parity: the info surface renders the description unconditionally
(notify.ts:3070), so the two surfaces now disagree for any unsupported plugin
that has a description.

**Fix:** add `"unsupported"` to the description guard:
```ts
if (
  (p.status === "installed" ||
    p.status === "upgradable" ||
    p.status === "available" ||
    p.status === "unavailable" ||
    p.status === "unsupported" ||
    p.status === "disabled" ||
    p.status === "force-installed" ||
    p.status === "force-upgradable") &&
  p.description !== undefined &&
  p.description.length > 0
) {
  lines.push(`    ${truncateDescription(p.description)}`);
}
```
Also update the comment at notify.ts:3395-3398 to include `unsupported` in the
enumerated list-inventory rows that carry the manifest description.

## Warnings

### WR-01: PL-4 description test coverage missing for the `unsupported` row (let CR-01 slip through)

**File:** `tests/shared/notify-v2.test.ts:404-456`
**Issue:**
The two new `unsupported` render tests (lines 404 and 434) exercise the row
WITHOUT a `description`, so neither catches CR-01. Meanwhile the existing PL-4
suite has explicit "description emits a second line" cases for `installed`
(line 1255), `upgradable` (1285), `available` (1313), `unavailable` (1340), and
`disabled` (1367) — but none for `unsupported`. The phase added a new
list-inventory row that carries `description?` and did not extend the PL-4
parity suite to it, which is exactly why the dropped-line regression went
unnoticed.

**Fix:** add a PL-4 test mirroring the `unavailable`-with-description case
(notify-v2.test.ts:1340-1364) for the `unsupported` status, asserting the
`    <description>` second line is emitted, e.g.:
```ts
test("PL-4: unsupported row with description emits description line", () => {
  // ... build an unsupported plugin row with a description ...
  assert.equal(
    body,
    "● official [user]\n  ⊖ delta (unsupported) {lsp}\n    <description>",
  );
});
```
This test fails before the CR-01 fix and passes after.

## Info

### IN-01: info.ts non-locally-resolvable arm hardcodes `"unavailable"` even for `resolved.state === "unsupported"`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1045-1056`
**Issue:**
`buildNotInstalledRow` only consults `resolved.state` for path
(locally-resolvable) sources; for non-locally-resolvable sources it returns
`status: "unavailable"` unconditionally, regardless of whether the resolver
reported `unsupported`. The list surface (`availableRowMessage`) switches on
`resolved.state` for ALL sources. The divergence is currently masked by the
resolver contract (no-network GitHub sources resolve structurally `unavailable`,
never `unsupported` — see the comment at info.ts:1071-1075), so it is not a live
bug today. But if that contract ever changes, the info surface would render
`(unavailable)` where the list surface renders `(unsupported)` for the same
plugin, re-breaking cross-surface parity. The resolver was intentionally NOT
changed this phase, so this is a latent-coupling note, not a defect in the diff.

**Fix (optional, robustness):** key the info non-path arm on `resolved.state`
the same way the path arm does, or add an `assertNever`-guarded note that the
non-path arm relies on the resolver never returning `unsupported` for
non-locally-resolvable sources.

### IN-02: pre-existing NUL byte in info.ts (NOT a phase-72 finding)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (~line 320)
**Issue:** The file contains an embedded NUL byte that predates phase 72 (it
originates in phase 71). Recorded here for completeness only — out of scope for
this review per the review brief. No action required as part of phase 72.

---

_Reviewed: 2026-06-28T22:36:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
