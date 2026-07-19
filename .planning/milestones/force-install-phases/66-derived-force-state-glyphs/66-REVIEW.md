---
phase: 66-derived-force-state-glyphs
reviewed: 2026-06-27T19:25:52Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
  resolved: 4
status: issues_found
---

# Phase 66: Code Review Report

**Reviewed:** 2026-06-27T19:25:52Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the phase-66 "derived force-state, glyphs and force-upgradability" surface:
the two new closed-set tokens (`force-installed` / `force-upgradable`), their
derivers across `list` / `info` / `install` / `update` / reconcile-pending, the
glyph wiring, and the NFR-5 no-network candidate resolves.

The closed-set plumbing is sound: `tsc --noEmit` is clean, the renderer switch is
exhaustive with the two new arms and an `assertNever` tail, the load-bearing A4
ordering (force-installed checked before force-upgradable) is correct in `list.ts`,
the pending will-force-install resolver correctly guards its `resolveStrict` against
throws, and the targeted/architecture/catalog-uat test suites pass (181 + 243
green locally).

However the review surfaced one genuine robustness regression and several
correctness / contract-fidelity defects:

1. The new `force-upgradable` candidate `resolveStrict` in `list.ts` is the ONLY
   force-resolve site that is NOT wrapped in try/catch. Every sibling site
   (`availableRowMessage`, `info.ts::buildInstalledRow`, `pending.ts` via
   `resolvePendingForceInstalls`) guards it because `resolveStrict` can throw on
   disk I/O (EACCES/EIO/etc.). A single upgradable plugin's candidate probe error
   therefore aborts the ENTIRE `/claude:plugin list` into the synthetic `(list)`
   failure row, hiding every other row.
2. The catalog documents `(force-installed) {unsupported hooks}` and
   `(force-upgradable) {unsupported hooks}` as the canonical byte forms, but the
   real deriver (`narrowUnsupportedKinds`) can only ever emit `lsp` /
   `unsupported source` — `unsupported hooks` is unreachable on these rows.
3. `force-installed` is derived from two different sources across surfaces
   (persisted `compatibility.unsupported` on `list`; a LIVE `resolveStrict` on
   `info` / `install` / `update`), producing divergent output for the same plugin.

## Critical Issues

### CR-01: `force-upgradable` candidate `resolveStrict` is unguarded — a single plugin's probe error fails the whole list

**Status:** RESOLVED — the candidate `resolveStrict` in `installedRowMessage`
is now wrapped in try/catch; a probe throw degrades the offending row to the
plain `(upgradable)` form instead of escaping to the top-level `listPlugins`
catch and blanking the whole list. A regression test
(`CR-01 / FSTAT-04 / NFR-5: a candidate resolveStrict throw degrades to
(upgradable), never blanks the whole list`) proves a throwing candidate
degrades while sibling rows stay intact.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:328`
**Issue:**
The `force-upgradable` derivation calls `await resolveStrict(manifestEntry, { marketplaceRoot })`
with NO surrounding try/catch:

```ts
if (upgradable) {
  const candidate = await resolveStrict(manifestEntry, { marketplaceRoot });
  if (candidate.state === "unsupported") { return { status: "force-upgradable", ... }; }
  return { status: "upgradable", reasons: [], ... };
}
```

`resolveStrict` returns a not-installable variant for *resolution* failures but
PROPAGATES disk-I/O failures (EACCES, EIO, ENOTDIR on a component dir, malformed
plugin.json the lenient path rethrows). This is established by every other call
site, all of which wrap it:
- `availableRowMessage` (same file, list.ts:414) — `catch (probeErr)` with the
  comment "EACCES, JSON parse failures, and programming bugs are not hidden".
- `info.ts::buildInstalledRow` (info.ts:818) — `try { resolveStrict } catch`.
- `reconcile/notify.ts::resolvePendingForceInstalls` (notify.ts:306) — `try/catch`
  that "degrades to NO force ... never a crash on this read-only surface".

The `force-upgradable` branch is the lone unguarded site. A throw here escapes
`installedRowMessage` → `enumerateMarketplacePlugins` (list.ts:520, no catch) →
`buildMarketplaceMessage` → `loadPluginListPayload` → and is caught only by the
top-level `listPlugins` catch (list.ts:971), which replaces the ENTIRE list output
with a single synthetic `⊘ (list) (failed) {…}` row. Every other plugin's row is
lost. A per-row, transient FS condition is mis-attributed as an orchestrator-level
list failure. On the LLM-tool surface (`tools.ts::loadToolPluginPayload`, which
calls `loadPluginListPayload` directly) the same throw flips the whole tool call to
`isError: true`.

This is a regression introduced by this phase: before phase 66, installed plugins
were never re-resolved during `list`, so this path did not exist. It is also
untested — the FSTAT list tests only exercise candidates that resolve cleanly
(`lspServers`), never a candidate that throws.

**Fix:** mirror the sibling sites — wrap the candidate resolve and degrade to the
plain `(upgradable)` row on throw (the truthful "we could not assert a degrade"
default), instead of letting it tank the list:

```ts
if (upgradable) {
  let candidate;
  try {
    candidate = await resolveStrict(manifestEntry, { marketplaceRoot });
  } catch {
    // A candidate probe I/O failure cannot assert a degrade; fall back to the
    // plain upgradable row rather than failing the entire list (parity with
    // availableRowMessage / info.ts / resolvePendingForceInstalls).
    candidate = undefined;
  }
  if (candidate?.state === "unsupported") {
    return { status: "force-upgradable", name: pluginName, reasons: narrowUnsupportedKinds(candidate.unsupported), version: record.version, ...scopeField, ...descriptionField };
  }
  return { status: "upgradable", name: pluginName, reasons: [], version: record.version, ...scopeField, ...descriptionField };
}
```

## Warnings

### WR-01: Catalog documents an unreachable reason (`{unsupported hooks}`) for force-installed / force-upgradable

**Status:** RESOLVED — the force-installed catalog row now documents `{lsp}`
and the force-upgradable row `{unsupported source}`, both reachable from
`narrowUnsupportedKinds`. The matching `catalog-uat` fixtures were updated to
the same reasons so the byte-exact catalog matches the true render.

**File:** `docs/output-catalog.md:335` and `docs/output-catalog.md:346`
**Issue:**
The catalog (the project's byte-source-of-truth for output) documents:
```
◉ degraded-plugin v1.0.0 (force-installed) {unsupported hooks}
● clean-plugin   v1.0.0 (force-upgradable) {unsupported hooks}
```
Both rows derive their reasons brace via `narrowUnsupportedKinds(...)`
(`shared/probe-classifiers.ts:146`), which maps `lspServers → "lsp"` and EVERY
other kind → `"unsupported source"`. The input domain is
`UNSUPPORTED_COMPONENT_KINDS` (`domain/resolver.ts:214`) =
`["lspServers","monitors","themes","outputStyles","channels","userConfig","bin","settings"]`
— `hooks` is deliberately NOT a member (resolver.ts:990: "hooks is no longer in
UNSUPPORTED_COMPONENT_KINDS"; structural hooks defects route to the `unavailable`
arm, which both install/update gates REJECT per FORCE-05). Therefore a real
force-installed/force-upgradable row can only ever render `{lsp}`,
`{unsupported source}`, or `{lsp, unsupported source}` — never `{unsupported hooks}`.

The `catalog-uat` test does not catch this because it constructs the message arm
with a hardcoded `reasons: ["unsupported hooks"]`
(`tests/architecture/catalog-uat.test.ts:660` / `:685`) and renders that directly,
bypassing the orchestrator deriver. It validates the renderer, not the
orchestrator→catalog path. The orchestrator-level `list.test.ts` correctly asserts
the realistic `{lsp}` / `{unsupported source}` markers (list.test.ts:916, :975,
:1049), confirming the catalog example is the outlier.

**Fix:** change both catalog reason braces to a reachable marker, e.g.
`{unsupported source}` (matching a dropped non-lsp kind) or `{lsp}`, and update the
`catalog-uat` fixtures at catalog-uat.test.ts:660 / :685 to the same reason so the
documented byte form is one the deriver can actually emit.

### WR-02: `force-installed` is derived from two divergent sources — `list` (persisted) vs `info`/`install`/`update` (live resolve)

**Status:** RESOLVED (commit `82cb9d8c`) — `info.ts::buildInstalledRow`'s
non-path branch now derives `force-installed` from the SAME persisted
`record.compatibility.unsupported` that the `list` deriver reads (the
D-66-01 single deriver), instead of returning `(installed)` before resolving.
A github/non-path force-installed plugin therefore renders `◉ (force-installed)`
consistently on both `list` and `info`; `componentsResolved: false` is
preserved (NFR-5: no fetch). Path sources keep their live resolve (not
regressed). The inaccurate "same derived signal the list deriver reads"
comments in `install.ts`/`update.ts` are corrected to state those rows read
the LIVE resolved state. Cross-surface parity regression tests were added on
both `list` and `info`.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:306` and `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:851`
**Issue:**
`list.ts` derives force-installed from the PERSISTED record:
`if (record.compatibility.unsupported.length > 0)`. `info.ts::buildInstalledRow`
and the `install`/`update` success rows derive it from a LIVE `resolveStrict`
(`resolved.state === "unsupported"`). These sources can disagree:

- A plugin installed cleanly (persisted `unsupported` empty) whose marketplace
  clone later drops a component: `list` shows `(installed)`/`(upgradable)` (reads
  stale-clean persisted), `info` shows `(force-installed)` (live resolve). And the
  reverse — a force-installed record whose clone is later fixed — flips the other
  way.
- For NON-path sources (github), `info.ts::buildInstalledRow` returns
  `status: "installed", componentsResolved: false` at info.ts:808 BEFORE any
  resolve (NFR-5 forbids fetching). So a github-source plugin that was
  force-installed (persisted `unsupported` non-empty) renders `◉ (force-installed)`
  on `list` but `● (installed)` on `info` — permanently, not just transiently.

The in-code comments compound the confusion: install.ts:1392 and update.ts:1571
both claim force-installed uses "the same derived signal the list deriver reads",
but `list` reads `record.compatibility.unsupported` while install/update read the
live `resolved.state`. They coincide only at write time.

**Fix:** decide one source of truth for force-installed across surfaces. The
NFR-5-safe option is to have `info.ts` read the persisted
`record.compatibility.unsupported` for installed plugins (as `list` does) rather
than re-resolving, which also fixes the github-source gap. If the live-resolve
behaviour on `info` is intentional, correct the install.ts/update.ts comments to
stop claiming parity with the list deriver and document the divergence explicitly.

### WR-03: `force-installed` install row silently drops soft-dep markers

**Status:** RESOLVED (commit `cc8818e5`) — `PluginForceInstalledMessage` gained
an optional `dependencies?: readonly Dependency[]` field, and a shared
`forceInstalledRow` composer (in `shared/notify.ts`) threads it through
`composeReasons` so the `{requires pi-subagents}` / `{requires pi-mcp}` markers
compose into the SAME brace AFTER the dropped-component reasons (MSG-GR-4),
exactly like the `installed` arm. The central `renderPluginRow` switch and the
`install`/`update` command-local render maps all call the one composer, so the
bytes stay identical across surfaces. The install/update success rows now pass
`dependencies`; the list/info inventory rows omit it and render unchanged. A
catalog state + fixture and renderer/orchestrator regression tests were added;
the closed-set counts are unchanged (no new reason token).

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1398`
**Issue:**
On a successful force install the row is built as `PluginForceInstalledMessage`,
which (by type) carries no `dependencies` field; the `dependencies` array computed
at install.ts:1361-1368 is discarded for the force arm. The force-degradable
`unsupported` resolver arm still materializes SUPPORTED components (resolver.ts:502
"the unsupported arm carries only supported kinds in componentPaths"), so a
force-installed plugin can legitimately stage agents / mcp servers. When the
companion extension (pi-subagents / pi-mcp) is not loaded, a normal `(installed)`
row would render `{requires pi-subagents}` / `{requires pi-mcp}`; the
`(force-installed)` row cannot, because the renderer arm (`pluginRow`) receives no
dependencies. The user loses the soft-dep signal precisely on a degraded install
where it is most relevant. The same applies to the force `(force-installed)` update
row (update.ts:1576) and the list/info force rows.

**Fix:** if soft-dep markers are wanted on degraded installs, add an optional
`dependencies?: readonly Dependency[]` to `PluginForceInstalledMessage` and thread
it through the force arm's `composeReasons` call (sharing the brace with the
unsupported-kind reasons per MSG-GR-4). If the omission is intentional (mirroring
`upgradable`), add a one-line note at install.ts:1398 stating that soft-dep markers
are deliberately suppressed on force-installed rows.

## Info

### IN-01: LLM-tool `pluginReasons` omits force-state reasons inconsistently

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:355`
**Issue:** `pluginReasons` returns reasons only for `unavailable` / `upgradable`,
not for `force-installed` / `force-upgradable` (both of which carry non-empty
dropped-component reasons). Since `projectRowStatus` flattens both force states to
the `installed` tool bucket, the agent never sees the degradation detail — whereas
`upgradable` (whose `reasons` are empty by construction in list.ts:347) IS handled.
The asymmetry is harmless today (the dropped tool reason is never user-facing on
the `[installed]` projection), but it is an inconsistency a future reader may
misread.
**Fix:** either include `force-installed` / `force-upgradable` in `pluginReasons`
for parity, or add a comment at tools.ts:355 noting the force states deliberately
project to `[installed]` without surfacing their degradation reasons on the tool
surface.

### IN-02: `force-upgradable` resolves the candidate on every list invocation

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:328`
**Issue:** Every upgradable installed plugin now triggers a fresh `resolveStrict`
(disk walk of the candidate's component dirs + plugin.json/hooks parse) on each
`/claude:plugin list`. This is a behavioural change from the prior list path (which
never resolved installed plugins). Performance is out of scope for this review;
flagged only because the added per-row I/O is also the surface that CR-01's missing
guard exposes. No action required beyond CR-01.

---

_Reviewed: 2026-06-27T19:25:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
