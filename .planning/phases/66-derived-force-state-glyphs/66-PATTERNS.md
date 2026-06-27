# Phase 66: Derived Force-State, Glyphs & Force-Upgradability - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 11 (6 source modified, 5 test modified/extended)
**Analogs found:** 11 / 11 (all in-repo; this phase is additive wiring through existing seams)

This phase adds NO new modules. Every change is an **in-place edit** that mirrors
an existing arm. The dominant analogs are the `installed` arm (which
`force-installed` mirrors — a double-duty `TransitionMessageBase`) and the
`upgradable` arm (which `force-upgradable` mirrors — a list-only `MessageBase`).
The exhaustive `assertNever` switches do the cross-surface enforcement.

Comment/test-title policy: use `D-66-NN` / `FSTAT-NN` / `NFR-N` IDs. Never cite
GSD phase/plan/wave/task numbers (`.claude/rules/typescript-comments.md`).

## File Classification

| Modified File | Role | Data Flow | Closest Analog (in-file arm) | Match Quality |
|---------------|------|-----------|------------------------------|---------------|
| `shared/notify.ts` — tuples + glyph + arms + 2 switches | model + view (status vocabulary) | transform (status→bytes) | `installed` arm (force-installed) + `upgradable` arm (force-upgradable) | exact |
| `orchestrators/plugin/list.ts` — `installedRowMessage` | orchestrator (deriver) | request-response (derive row) | `availableRowMessage` resolve (l.350) + existing upgradable branch (l.274) | exact (same file, sibling fn) |
| `orchestrators/plugin/info.ts` — `buildInstalledRow` | orchestrator (deriver) | request-response | existing unsupported branch already in `buildInstalledRow` (l.832-850) | exact (same branch, change label) |
| `orchestrators/plugin/install.ts` — success row | orchestrator (transition stamp) | event-driven (post-install notify) | `installedRow` literal (l.1391-1400) | exact |
| `orchestrators/plugin/update.ts` — success row | orchestrator (transition stamp) | event-driven | `outcomeToCascadePluginMessage` updated arm (l.1560-1574) | role-match (see Q3/Q2) |
| `edge/handlers/tools.ts` — `projectRowStatus` | edge (projection) | transform (status→tool tag) | `installed`/`upgradable` cases (l.164-166) | exact |
| `orchestrators/reconcile/reconcile.messaging.ts` — `renderWillInstall` force modifier | view (preview renderer) | transform (action→bytes) | `renderWillInstall` `will install` renderer (l.82-83) | exact (add force branch) |
| `orchestrators/reconcile/notify.ts` — `buildReconcilePendingNotification` force flag | orchestrator (preview compose) | request-response (diff→preview) | existing `buildReconcilePendingNotification` will-install path | role-match (thread force flag) |
| `orchestrators/reconcile/pending.ts` — no-network candidate resolve | orchestrator (non-pure preview) | request-response | `resolveStrict` cache call from `list.ts availableRowMessage` (l.350) | exact (same cache pattern) |
| `tests/orchestrators/reconcile/pending.test.ts` — will-force-install case | test (preview row) | — | existing will-install pending-row cases | role-match (template) |
| `tests/architecture/notify-closed-set-locks.test.ts` | test (arch tripwire) | — | the 15/22 length asserts (l.33-39) | exact (edit counts) |
| `tests/shared/notify-v2.test.ts` | test (renderer byte) | — | upgradable byte test (l.404-429) | exact (template) |
| `tests/orchestrators/plugin/list.test.ts` | test (deriver) | — | existing upgradable/installed deriver cases | role-match |
| `tests/edge/handlers/tools.test.ts` | test (projection) | — | upgradable→`[installed]` test (l.581-608) | exact (template) |
| `tests/orchestrators/plugin/info.test.ts` + `tests/edge/handlers/plugin/info.test.ts` | test (info row) | — | existing installed/unsupported info-row cases | role-match |

## Pattern Assignments

### `shared/notify.ts` (model + view) — THE central change

This single file owns `PLUGIN_STATUSES`, `STATUS_TOKENS`, `ICON_*`, the per-arm
interfaces, the union, `renderPluginRow`, `PluginInfoRowBase.status`, and
`pluginInfoStatusGlyph`. Six distinct edits, each with an in-file analog.

#### Edit 1 — tuples (add 2 entries to BOTH `STATUS_TOKENS` and `PLUGIN_STATUSES`)

**Analog — `STATUS_TOKENS`** (lines 198-221, currently 22 entries):
```typescript
export const STATUS_TOKENS = [
  "installed",
  ...
  "upgradable",     // <- force-upgradable goes adjacent
  ...
  "disabled",
] as const;
```
**Analog — `PLUGIN_STATUSES`** (lines 373-389, currently 15 entries):
```typescript
export const PLUGIN_STATUSES = [
  "installed",
  ...
  "upgradable",
  ...
  "disabled",
] as const;
```
**Insertion:** add `"force-installed"` and `"force-upgradable"` to BOTH tuples
(Pitfall: STATUS_TOKENS and PLUGIN_STATUSES are TWO separate sets; the length
tripwires only catch the omission — there is no compile-time binding). Result:
PLUGIN_STATUSES 15→17, STATUS_TOKENS 22→24.

#### Edit 2 — glyph constant (after line 1306)

**Analog** (lines 1293-1306):
```typescript
export const ICON_INSTALLED = "●";        // U+25CF
...
export const ICON_DISABLED = "◌";
```
**Insertion** (D-66-03 / FSTAT-02):
```typescript
// D-66-03 / FSTAT-02: realized force-degraded plugin (installed via --force,
// currently re-resolving `unsupported`). U+25C9 FISHEYE -- visually distinct
// from ICON_INSTALLED's U+25CF. force-upgradable reuses ICON_INSTALLED (the
// row is currently clean).
export const ICON_FORCE_INSTALLED = "◉";  // U+25C9
```

#### Edit 3 — two new arm interfaces (near lines 555 / 668)

**Analog A — `PluginInstalledMessage`** (lines 555-563), the
`TransitionMessageBase` double-duty arm (required `severity`/`needsReload`):
```typescript
export interface PluginInstalledMessage extends TransitionMessageBase {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
  readonly description?: string;
}
```
→ `PluginForceInstalledMessage` mirrors it verbatim with
`status: "force-installed"` (double-duty: list inventory row + install/update
success transition row; needs the stamps).

**Analog B — `PluginUpgradableMessage`** (lines 668-675), the list-only
`MessageBase` arm (NO required stamps; required `reasons` empty-array sentinel):
```typescript
export interface PluginUpgradableMessage extends MessageBase {
  readonly status: "upgradable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}
```
→ `PluginForceUpgradableMessage` mirrors it verbatim with
`status: "force-upgradable"`.

**Union add** (lines 791-806): append both new arms to
`PluginNotificationMessage` (the `assertNever` in `renderPluginRow` then
compile-forces the two new cases).

#### Edit 4 — render switch cases (in `renderPluginRow`, near line 1914)

**Analog — `installed` arm** (lines 1842-1855, uses `installedLikeRow`-style
manual `joinTokens`; note the `upgradable` arm at 1913 uses the `pluginRow`
helper):
```typescript
case "upgradable":
  return pluginRow(ICON_INSTALLED, p, mpScope, "(upgradable)", probe);
```
**Insertion** (mirror — force-installed is dependency-bearing like `installed`,
so use `installedLikeRow` (lines 1799-1825); force-upgradable is reasons-bearing
list-only like `upgradable`, so use `pluginRow`):
```typescript
case "force-installed":
  return installedLikeRow(
    ICON_FORCE_INSTALLED, p, mpScope,
    renderVersion(p.version), "(force-installed)", p.reasons, probe,
  );
case "force-upgradable":
  return pluginRow(ICON_INSTALLED, p, mpScope, "(force-upgradable)", probe);
```

#### Edit 5 — info row status type widening (line 1064)

**Analog** (lines 1063-1064):
```typescript
interface PluginInfoRowBase {
  readonly status: Extract<PluginStatus, "installed" | "available" | "unavailable" | "failed">;
```
**Edit:** add `"force-installed"` to the `Extract<...>` union. Do NOT add
`force-upgradable` (info is single-plugin, not advisory — FSTAT-07 names only
force-installed for info).

#### Edit 6 — info glyph mapper (`pluginInfoStatusGlyph`, lines 2738-2752)

**Analog** (the separate exhaustive switch over `PluginInfoRow["status"]`):
```typescript
function pluginInfoStatusGlyph(status: PluginInfoRow["status"]): string {
  switch (status) {
    case "installed":       return ICON_INSTALLED;
    case "available":       return ICON_AVAILABLE;
    case "unavailable":
    case "failed":          return ICON_UNINSTALLABLE;
    default: assertNever(status); return "";
  }
}
```
**Insertion:** `case "force-installed": return ICON_FORCE_INSTALLED;`. The info
row body at lines 2867-2874 renders `(${plugin.status})` literally, so it emits
`(force-installed)` once the status is set — no further info-render edit needed.

---

### `orchestrators/plugin/list.ts` — `installedRowMessage` (deriver, request-response)

**This is the central new wiring of the phase** (D-66-01/02). Today the function
derives `upgradable` from a pure version-string compare and **never resolves**.

**Analog A — current upgradable branch** (lines 241-288):
```typescript
const upgradable =
  manifestEntry?.version !== undefined && manifestEntry.version !== record.version;
...
if (upgradable) {
  return {
    status: "upgradable",
    name: pluginName,
    reasons: [],
    version: record.version,
    ...scopeField,
    ...descriptionField,
  };
}
```
**Analog B — the no-network resolve to copy in** (from `availableRowMessage`,
line 350, same file — this is the NFR-5 cache path):
```typescript
const resolved = await resolveStrict(manifestEntry, { marketplaceRoot });
switch (resolved.state) {
  case "installable": ...
  case "unsupported":
  case "unavailable": ...
}
```
**Edit point:** thread a `resolveStrict(manifestEntry, { marketplaceRoot })` into
the installed-plugin path (after the `isRecordedButDisabled` guard at line 260,
before the upgradable branch). `marketplaceRoot` is available in
`loadPluginListPayload`. The return type widens to add
`PluginForceInstalledMessage | PluginForceUpgradableMessage`.

**Predicate to implement (A2/Q1 — planner must lock):** resolve the cached tree
once → `state`; then
- `force-installed` = recorded-installed AND `state === "unsupported"` AND NOT version-differs
- `force-upgradable` = recorded-installed AND `state === "unsupported"` AND version-differs
- `upgradable` = `state === "installable"` AND version-differs (existing)
- `installed` = `state === "installable"` AND NOT version-differs (existing)

This makes the two force states mutually exclusive (force-installed is never
force-upgradable) and FSTAT-03 falls out (once the newer tree resolves
`installable`, the deriver yields plain `installed`). NFR-5: one cache resolve
per installed plugin, no network.

---

### `orchestrators/plugin/info.ts` — `buildInstalledRow` (deriver, request-response)

**Analog — the existing unsupported branch that currently mislabels as
`installed`** (lines 832-850):
```typescript
// resolveStrict returned a non-installable arm but the state record says
// installed ...
const fields = await buildNonInstallableRowFields(resolved, entry, ...);
return {
  status: "installed",   // <- FSTAT-07: change to "force-installed" when unsupported
  name: pluginName,
  ...(version !== undefined && { version }),
  ...(description !== undefined && { description }),
  ...fields,
};
```
**Edit point:** discriminate on `resolved.state` — when `unsupported`, emit
`status: "force-installed"`. The dropped-component detail is already threaded:
`buildNonInstallableRowFields` (line 756) already calls
`narrowUnsupportedKinds(resolved.unsupported)` (line 770) for the `unsupported`
arm, so the `{lsp}` / `{unsupported source}` brace comes for free (D-66-04).
The `unavailable` arm keeps `status: "installed"` (D-64-05 independence).

---

### `orchestrators/plugin/install.ts` — success notification row (transition stamp)

**Analog — `installedRow` literal** (lines 1391-1400):
```typescript
const installedRow: PluginInstalledMessage = {
  status: "installed",
  name: plugin,
  dependencies,
  version: installCtx.version,
  ...(reasons.length > 0 && { reasons }),
  severity: "info",
  needsReload: true,
};
```
**Edit point:** when `installCtx.resolved.state === "unsupported"`, build a
`PluginForceInstalledMessage` (same shape, `status: "force-installed"`) instead;
keep `severity: "info"` (Phase 65 D-65-01: force path stays info, no `Warning:`)
+ `needsReload: true`. GATE-01 backstops
(`notify-stamp-coverage.test.ts` / `notify-producer-wire-coverage.test.ts`) may
enumerate the force arm — check their representative sets.

---

### `orchestrators/plugin/update.ts` — success notification row (transition stamp)

**Analog — `outcomeToCascadePluginMessage` updated arm** (lines 1560-1574):
```typescript
case "updated":
  return {
    status: "updated",
    name: outcome.name,
    scope: target.scope,
    from: outcome.fromVersion,
    to: outcome.toVersion,
    dependencies: outcomeDependencies(...),
    severity: "info",
    needsReload: true,
  };
```
**Note (Q2):** the update success row uses the `(updated)` arrow form, not
`(installed)`. D-66-04 says the force **success notification** reads
"force-installed". The planner must decide whether a forced update emits
`force-installed` (swap arm when the updated tree resolves `unsupported`) here,
mirroring the install.ts edit. Byte wording is finalized in Phase 70.

---

### `edge/handlers/tools.ts` — `projectRowStatus` (edge projection, transform)

**Analog — the installed/upgradable cases** (lines 164-166):
```typescript
case "installed":
case "upgradable":
  return "installed";
```
**Edit point:** add `case "force-installed":` and `case "force-upgradable":` to
that same return — both ARE installed on the tool surface (D-66-03). CRITICAL:
this switch's default is `throw new Error(...)` (line 186), NOT `assertNever`, so
a missing case **compiles but throws at runtime** on the list-tool surface. The
other two switches (`statusLabel` line 192, `statusKey` line 235) are over
`ToolPluginStatus` (only installed/available/unavailable) — they need NO force
cases.

## Shared Patterns

### Closed-set discriminated union + exhaustive `assertNever`
**Source:** `shared/notify.ts:373` (tuple) → `:418` (derived type) → `:791`
(union) → `:1832` (switch) → `:1986` (`assertNever`).
**Apply to:** every status-bearing edit. Adding the two union arms WITHOUT both
`renderPluginRow` cases is a TS compile error at `assertNever` — this is the
FSTAT-02/04 enforcement lever. The two non-assertNever switches that must be
hand-checked are `tools.ts::projectRowStatus` (throws) and the separate
`pluginInfoStatusGlyph` (does assertNever, so it IS compile-forced).

### No-network candidate resolve (NFR-5)
**Source:** `resolveStrict(entry, { marketplaceRoot })` — `list.ts:350`
(`availableRowMessage`), `info.ts:819` (`buildInstalledRow`), `update.ts:735`.
**Apply to:** the new list deriver. Do NOT add a second resolver-call shape
(D-66-02 mandates reusing the existing cache path).

### Render-time dropped-component markers
**Source:** `shared/probe-classifiers.ts:146` `narrowUnsupportedKinds(resolved.unsupported)`
→ maps the typed `unsupported[]` kind list to `"lsp"` / `"unsupported source"`
reasons (first-wins dedup).
**Apply to:** `info` dropped-component detail (D-66-04). Already wired through
`buildNonInstallableRowFields` (`info.ts:770`) — comes for free once the info
status flips to `force-installed`.

### Row composition helpers (D-11 SOLE composers)
**Source:** `pluginRow(icon, p, mpScope, label, probe)` (`notify.ts:1756`) for
reasons-bearing list rows; `installedLikeRow(...)` (`notify.ts:1799`) for
dependency-bearing transition rows.
**Apply to:** force-upgradable → `pluginRow`; force-installed → `installedLikeRow`.
Reuse verbatim so byte forms cannot drift.

### Closed-set length tripwires (must bump in the SAME change)
**Source:** `tests/architecture/notify-closed-set-locks.test.ts:33-39`.
```typescript
test("SNM-02: STATUS_TOKENS is the closed 22-entry token set", () => {
  assert.equal(STATUS_TOKENS.length, 22);
});
test("SNM-02: PLUGIN_STATUSES is the closed 15-entry plugin-status set", () => {
  assert.equal(PLUGIN_STATUSES.length, 15);
});
```
**Apply to:** bump 22→24 and 15→17, and update the titles
(`"closed 22-entry"` → `"closed 24-entry"`, `"closed 15-entry"` →
`"closed 17-entry"`). These RED the build until bumped (NFR-6).

## Test Pattern Assignments (Wave 0)

### `tests/shared/notify-v2.test.ts` — renderer byte cases (FSTAT-02/04)
**Template — upgradable byte test** (lines 404-429):
```typescript
test("notify renders upgradable plugin with version and reasons brace", () => {
  ...
  plugins: [{ status: "upgradable", name: "commit-commands", version: "1.0.0", reasons: ["stale clone"] }],
  ...
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ● commit-commands v1.0.0 (upgradable) {stale clone}`,
  ]);
});
```
**New cases:** `force-installed` row asserts `◉ <name> v.. (force-installed)`
(distinct `◉` glyph) and `force-upgradable` asserts `● <name> v.. (force-upgradable)`
(reuses `●`). Drive `notify()` directly; do NOT touch `docs/output-catalog.md`
(byte-catalog reconciliation is Phase 70 — see A4).

### `tests/edge/handlers/tools.test.ts` — projection (D-66-03)
**Template — upgradable→`[installed]` test** (lines 581-608): seed an installed
plugin whose cache tree resolves `unsupported`, assert
`out.content[0].text` matches `/\[installed\] <name>/` and
`details.plugins[0].status === "installed"`.

### `tests/orchestrators/plugin/list.test.ts` — deriver (FSTAT-03/04/05)
Cases: force-installed (record installed + cached tree resolves unsupported,
versions equal), force-upgradable (clean current + newer candidate degrades,
versions differ), FSTAT-03 return-to-installed (newer tree resolves installable).
Inject the resolve ctx; assert no network (NFR-5).

### `tests/orchestrators/plugin/info.test.ts` + `tests/edge/handlers/plugin/info.test.ts`
Info `(force-installed)` row + dropped-component `{lsp}` / `{unsupported source}`
brace (FSTAT-07). Template: existing installed/unsupported info-row cases.

### Pending/preview `will force install` / `will force update` (FSTAT-06)
**FLAGGED — Q3.** The reconcile pending renderer
(`reconcile.messaging.ts:83` `renderWillInstall`) emits `will install`; the
`will force install` half maps cleanly there. But there is NO `will update`
token in the codebase (only `will install`/`will uninstall`/`will enable`/`will
disable`), so `will force update` has no current surface. The planner must
locate/confirm the intended preview surface before inventing a `will update`
token. Scope Phase 66 to thread the force signal into the existing `will install`
renderer and FLAG `will force update` for clarification.

## No Analog Found

None. Every change mirrors an existing in-repo arm, helper, switch, or test. The
only genuinely under-determined item is the **predicate split** (Q1/A2, planner
must lock) and the **`will force update` preview surface** (Q3, planner must
confirm) — both are decisions, not missing analogs.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/`,
`extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/`,
`extensions/pi-claude-marketplace/edge/handlers/`, `tests/shared/`,
`tests/architecture/`, `tests/edge/handlers/`.
**Files scanned:** 9 source + 3 test (live `features/force-install`).
**Pattern extraction date:** 2026-06-27
