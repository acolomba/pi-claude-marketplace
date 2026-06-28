# Phase 69: Force-Path Severity - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 13 (all EXISTING; this phase stamps into a shipped model)
**Analogs found:** 13 / 13 (every change has a live in-file or sibling analog)

This phase changes NO models. Every edit is a **producer-side severity stamp** or
a **conditioning branch** that an existing live row already demonstrates. For each
file the planner touches, the closest analog is almost always **another row in the
SAME file that already stamps the value** — copy that literal shape, change only
the conditioning signal. The notification core (`shared/notify.ts`
`cascadeSeverity`/`composeReasons`) is READ-ONLY for this phase.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `orchestrators/plugin/install.ts` (SEV-01 missing-companion) | producer / stamp site | event-driven (notify row) | `install.ts:1404-1424` force-installed/installed arm (same file) | exact (in-file) |
| `orchestrators/plugin/install.ts` (SEV-02 hint compose) | producer / classify+compose | request-response (error→row) | `composeInstallFailureMessage` branch 3 + `classifyEntityShapeError` (same file) | exact (in-file) |
| `domain/resolver.ts` (SEV-02 thread three-way) | producer / throw site | request-response | `requireForceInstallable` vs `requireInstallable` (same file, adjacent) | exact (in-file) |
| `shared/errors.ts` (SEV-02 carry `forceable`) | model / error shape | transform | `not-installable`/`no-longer-installable` variants of `PluginShapeErrorShape` | exact (in-file) |
| `orchestrators/plugin/update.ts` (SEV-04 targeted/bulk) | producer / cascade mapper | event-driven | `update.ts:1639-1642` skip-severity branch + `cardinality` (same file) | exact (in-file) |
| `orchestrators/plugin/update.ts` (SEV-03 candidate force gate) | producer / resolve gate | request-response | `update.ts:733-766` `args.force` gate (same file) | exact (in-file) |
| `orchestrators/marketplace/update.ts` (SEV-03 autoupdate takes force) | producer / cascade driver | batch | `cascadeAutoupdates:475-527` (same file) + `update.ts` force gate | role-match (cross-file) |
| `persistence/state-io.ts` (SEV-03 prior-compat read) | model / persisted read | file-I/O (read-only) | `compatibility.unsupported` field already in `PLUGIN_INSTALL_RECORD_SCHEMA` | exact (no schema change) |
| `orchestrators/reconcile/notify.ts` (SEV-03/SEV-05 backfill row) | producer / stamp site | event-driven | `force-installed` arm in same `plugin-backfilled` case + `install.ts:1411` reasons | exact (in-file) |
| `orchestrators/reconcile/apply-outcomes.ts` (SEV-05 carry kinds) | model / outcome shape | transform | `PluginBackfilledOutcome:108-113` (add field alongside `installable`) | exact (in-file) |
| `shared/notify-reasons.ts` (SEV-04 — maybe) | utility / severity helper | transform | `skipSeverity:51-57` (caller passes new signal instead) | role-match |
| `tests/architecture/catalog-uat.test.ts` | test / fixture | — | `force-installed-inventory` / `force-upgradable-inventory` fixtures (647-691) | exact (in-file) |
| `docs/output-catalog.md` | docs / byte fixture | — | `failure-unsupported-features` block (424-433) + force-installed block (418-422) | exact (in-file) |

## Shared Patterns

### Severity stamp shape (the literal to copy for ALL stamps)
**Source:** `orchestrators/plugin/install.ts:1404-1424`
**Apply to:** every SEV-01/03/04 stamp. A row literal carries `severity` + `needsReload`
as PLAIN fields; transition rows (`installed`/`updated`/`force-installed`) REQUIRE both
(TS2741 if omitted, per `TransitionMessageBase` at `notify.ts:541-544`). Conditioning is a
ternary on a signal the producer already holds.
```typescript
const installedRow: InstallMsg =
  installCtx.resolved.state === "unsupported"
    ? {
        status: "force-installed",
        name: plugin,
        dependencies,
        version: installCtx.version,
        reasons: [...reasons, ...narrowUnsupportedKinds(installCtx.resolved.unsupported)],
        severity: "info",        // <- the stamp; flip to "warning" on missing-companion (SEV-01)
        needsReload: true,
      }
    : { status: "installed", /* ... */ severity: "info", needsReload: true };
```
**Anti-pattern (RESEARCH §Anti-Patterns):** never re-derive severity in `cascadeSeverity`
(`notify.ts:2184-2205`) — it reads ONLY the stamped field, MAX-reduces, maps rank→arg.
Stamp at the producer; the reducer is frozen.

### Reasons-brace population (SEV-05)
**Source:** `install.ts:1411` (producer) + `shared/probe-classifiers.ts:146-160` (helper)
**Apply to:** the reconcile backfill force-installed row (`reconcile/notify.ts:523`, currently
`reasons: []`). The render seam ALREADY calls `composeReasons` for `force-installed`
(`notify.ts:2014` → `forceInstalledRow:1850-1874`). The ONLY gap is producer-side: thread the
re-resolved unsupported kinds through `narrowUnsupportedKinds`, exactly as install does:
```typescript
reasons: [...reasons, ...narrowUnsupportedKinds(installCtx.resolved.unsupported)],
```
`narrowUnsupportedKinds(unsupported)` maps `lspServers`→`lsp`, else `unsupported source`,
first-wins dedup. It is the SOLE shared per-kind marker helper — do not hand-roll a map.

### Soft-dep probe (SEV-01 missing-companion)
**Source:** `platform/pi-api.ts:121-126` — `softDepStatus(pi): SoftDepStatus` returns
`{ piSubagentsLoaded, piMcpAdapterLoaded }`. `pi` is in scope at the install stamp site.
**Apply to:** SEV-01 — flip the success-arm `severity` from `info` to `warning` when a
DECLARED dependency's companion is absent from the probe. Compare against
`installCtx.stagedAgentNames` / `stagedMcpServerNames` (declares-agents / declares-mcp).
This is the same probe the renderer uses for the `{requires pi-subagents}` marker — reuse it,
do not invent a second companion check.

### Comment/test-title anchors (project rule)
Per `.claude/rules/typescript-comments.md`: use `SEV-NN` / `D-69-NN` / `NFR-N` / `D-03` / `D-06`
ID anchors only. NEVER `Phase 69` / `Plan NN` / `Wave N`. Existing stamps already model this
(`// D-03/D-06: realized install transition -> info, reloads Pi resources.`).

## Pattern Assignments

### `orchestrators/plugin/install.ts` — SEV-01 missing-companion warning (producer, event-driven)

**Analog (in-file):** the force-installed/installed success arm at `install.ts:1404-1424`
(excerpt above). Both branches stamp `severity: "info"` UNCONDITIONALLY today. The change:
condition the stamp on `softDepStatus(pi)` vs declared deps, raising to `"warning"` when a
declared companion is unloaded. Applies to BOTH branches (clean `installed` and `force-installed`).
RESEARCH `[A1]` recommends scoping to install success (clean+force) and update success by
symmetry; CONFIRM with planner.

**Severity field is the only byte-invisible change** — no row text moves; the test surface is
the catalog-uat fixture `expectedSeverity` + (for bulk) the summary-line tally.

---

### `orchestrators/plugin/install.ts` + `domain/resolver.ts` + `shared/errors.ts` — SEV-02 `--force` hint (producer/model)

**The structural fact (RESEARCH §SEV-02):** `requireInstallable` AND `requireForceInstallable`
BOTH throw the same `not-installable`/`no-longer-installable` shape — the three-way distinction
is LOST at the throw. The catch site `classifyEntityShapeError:1646-1661` collapses both to one
`status: "unavailable"` row.

**Analog A — the two resolver gates already branch on `r.state`** (`resolver.ts:1084-1124`):
```typescript
// requireInstallable: blocks unsupported AND unavailable
if (r.state === "installable") return;
throw new PluginShapeError({ kind: op === "update" ? "no-longer-installable" : "not-installable",
  plugin: r.name, reasons: r.notes });

// requireForceInstallable: admits unsupported, blocks unavailable
if (r.state === "installable" || r.state === "unsupported") return;
throw new PluginShapeError({ /* same shape */ });
```
`r.state` is the Phase 64 three-way discriminant. SEV-02 wiring: add a discriminant field
(e.g. `forceable: boolean`, set `r.state === "unsupported"`) to the `not-installable` /
`no-longer-installable` variants of `PluginShapeErrorShape` (`errors.ts:407-416`):
```typescript
| { readonly kind: "not-installable"; readonly plugin: string; readonly reasons: readonly string[] }
```
**Keep `buildPluginShapeMessage` (`errors.ts:446-459`) byte-frozen** — the hint renders at the
ROW, not the Error `.message` (preserves `.message.includes("is not installable")` assertions;
RESEARCH §Pitfall: changing `buildPluginShapeMessage` bytes).

**Analog B — the catch/compose branch already dispatches on `err.shape.kind`**
(`classifyEntityShapeError:1620-1661` + `composeInstallFailureMessage` branch 3 at
`install.ts:1540-1549`). Thread `forceable` into the `EntityErrorRow`, then in
`composeInstallFailureMessage` append the `--force` hint when `forceable === true`, plain
structural error (byte-identical to today) when `false`. Severity stays `error` on both arms.
RESEARCH `[A2]` recommends a trailer line (not a new frozen `REASONS` tuple member) — CONFIRM
against Phase 70.

---

### `orchestrators/plugin/update.ts` — SEV-04 targeted/bulk skip severity (producer, event-driven)

**Analog (in-file):** the skip-severity branch at `update.ts:1639-1642`:
```typescript
severity:
  reasons.includes("not installed") || reasons.includes("not found")
    ? "error"
    : skipSeverity(reasons),
```
Today `skipSeverity` (`notify-reasons.ts:51-57`) returns `warning` for any non-idempotent reason,
so `no longer installable` is ALWAYS `warning`. SEV-04 wiring: the signal already exists —
`cardinality` at `update.ts:272`:
```typescript
const cardinality: "single" | "plural" = opts.target.kind === "plugin" ? "single" : "plural";
```
Thread `cardinality` (or `opts.target.kind`) into `outcomeToCascadePluginMessage`
(`update.ts:1563`, currently `(target, outcome)`) so the `no longer installable` decline stamps
`info` for `plural` (bulk) and `warning` for `single` (targeted). Apply ONLY to
`no longer installable` — keep `not installed`/`not found` on `error` (RESEARCH §scope check).

**Byte impact:** bulk path flips a `warning`→`info` skip, which shifts the summary-line tally
(`countSkippedOperations`/`countRowsBySeverity`, `notify.ts:2281-2289`). Single-target emits no
tally — only `expectedSeverity` on the fixture changes.

---

### `orchestrators/plugin/update.ts` + `orchestrators/marketplace/update.ts` — SEV-03 autoupdate takes force (producer, batch)

**Analog A (in-file, update.ts):** the candidate force gate ALREADY exists at `update.ts:733-766`:
```typescript
if (args.force === true) {
  requireForceInstallable(resolved, "update");   // degrades unsupported instead of skipping
} else {
  requireInstallable(resolved, "update");         // skip arm -> (skipped) {no longer installable}
}
```
SEV-03/D-69-01 requires the autoupdate cascade to take the `args.force === true` path.

**Analog B (cross-file, marketplace/update.ts):** `cascadeAutoupdates:475-527` loops plugins
calling `pluginUpdate(plugin, name, scope)` and TODAY never sets force. The `updateSinglePlugin`
force opt-in already exists — the cascade just never passes it. Thread a force-equivalent into
this call so degrading candidates resolve via `requireForceInstallable`.

**Prior-state read (D-69-01):** read persisted `compatibility.unsupported` BEFORE applying, from
`PLUGIN_INSTALL_RECORD_SCHEMA` (`state-io.ts:54-62`) — the field already exists, NO schema change:
```typescript
compatibility: Type.Object({
  installable: Type.Boolean(),
  notes: Type.Array(Type.String()),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),   // <- read this; empty -> newly degraded -> warning
}),
```
Empty `unsupported` → previously clean → NEWLY degraded → stamp **warning**; non-empty → already
force-installed → stamp **info**. (`compatibility.installable === false` is the Phase 66
force-installed predicate.)

**Byte impact:** the autoupdate row flips `(skipped) {no longer installable}` →
`(force-installed) {<dropped kinds>}` and the bulk summary tally shifts. New catalog states +
catalog-uat fixtures in the SAME commit (RESEARCH §Pitfall: catalog/fixture lockstep).

---

### `orchestrators/reconcile/notify.ts` + `apply-outcomes.ts` — SEV-03/SEV-05 backfill row (producer/model)

**Analog (in-file):** the `force-installed` branch of the `plugin-backfilled` case
(`reconcile/notify.ts:516-526`) currently stamps `severity: "info"` with `reasons: []`:
```typescript
block.plugins.push({
  status: "force-installed",
  name: outcome.plugin,
  ...(outcome.version !== undefined && { version: outcome.version }),
  dependencies: outcome.dependencies,
  reasons: [],          // <- SEV-05 gap: populate via narrowUnsupportedKinds(...)
  severity: "info",     // <- RESEARCH [A3]: benign promotion stays info; CONFIRM
  needsReload: true,
});
```
SEV-05 fix: carry the re-resolved `unsupported[]` on `PluginBackfilledOutcome`
(`apply-outcomes.ts:108-113`, add a field alongside `installable`), then populate
`reasons: narrowUnsupportedKinds(outcome.unsupported)` here — mirroring `install.ts:1411`.
SEV-03 nuance: a backfill PROMOTION is benign (not a NEW degradation) → keep `info`; only the
reasons brace changes (RESEARCH §SEV-03 surface (b), `[A3]`). CONFIRM with planner.

**Byte impact:** the backfill force-installed row gains a `{<dropped kinds>}` brace; reconcile
catalog state + catalog-uat fixture update together.

---

### `tests/architecture/catalog-uat.test.ts` — fixture analog (test)

**Analog (in-file):** `force-installed-inventory` (647-666) and `force-upgradable-inventory`
(672-691) fixtures show the exact `(section, state)` shape, MockPi factory selection, and the
`expectedSeverity?` convention (202): set `"warning" | "error"` only when `computeSeverity`
returns non-info; OMIT for info. For every SEV severity flip, set/clear `expectedSeverity`;
for cascades, also update the catalog body summary-line prefix (RESEARCH §"How severity is
observable in tests", lines 450-456). Add new states IN-PLACE — no net-new files (Wave 0 Gaps).

---

### `docs/output-catalog.md` — byte fixture analog (docs)

**Analog (in-file):** `failure-unsupported-features` block (424-433) is the exact block the
SEV-02 unsupported-install error edits (gains a `--force` hint trailer; the structural
`unavailable` arm stays byte-identical). The `(force-installed)` success block (418-422)
models the brace/glyph form the SEV-03 autoupdate and SEV-05 backfill rows adopt. Land each
byte-visible block edit WITH its catalog-uat fixture in ONE commit (the byte-equality gate goes
RED otherwise).

## No Analog Found

None. Every change has a live in-file or sibling analog; this phase stamps into a fully-shipped
model. The only genuinely NEW byte string is the SEV-02 `--force` hint text (deferred wording to
Phase 70 — land a clear placeholder), and even its RENDER mechanism reuses the existing trailer /
reasons composition.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{shared,orchestrators,domain,persistence,platform}/`,
`tests/architecture/`, `docs/`.
**Files scanned:** 13 source + 1 test + 1 doc (all targeted reads against RESEARCH file:line).
**Pattern extraction date:** 2026-06-28
