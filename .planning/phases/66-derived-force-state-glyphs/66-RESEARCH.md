# Phase 66: Derived Force-State, Glyphs & Force-Upgradability - Research

**Researched:** 2026-06-27
**Domain:** TypeScript discriminated-union status model + byte-exact notification renderer (internal codebase, no external libraries)
**Confidence:** HIGH (every claim verified by reading the live source on `features/force-install`)

## Summary

This is a **display/derivation-only** phase. It adds two new realized statuses —
`force-installed` (glyph `◉`, new `ICON_FORCE_INSTALLED`) and `force-upgradable`
(glyph `●`, reuses `ICON_INSTALLED`) — derived purely from
(recorded-installed record + current no-network resolver state). No persisted
flag, no migration, no new package. The entire surface being extended is the
single file `extensions/pi-claude-marketplace/shared/notify.ts` (3302 lines) plus
the orchestrators that compose its messages and the `tools.ts` tool-surface
projection.

The codebase enforces correctness through a **closed-set discriminated union**:
`PLUGIN_STATUSES` (runtime tuple) → `PluginStatus` (derived type) → per-arm
interfaces → an exhaustive `renderPluginRow` switch closed with `assertNever`.
Adding a status forces a compile error at every render site that does not handle
it — this is the FSTAT-02/04 enforcement lever the CONTEXT references. Two
runtime length-tripwire tests (`notify-closed-set-locks.test.ts`) must be
bumped in the same change.

**Primary recommendation:** Add `force-installed` as a `TransitionMessageBase`
arm (mirrors `installed` — double-duty list-inventory + success-notification,
required `severity`/`needsReload`) and `force-upgradable` as a `MessageBase`
list-only arm (mirrors `upgradable` — advisory, no required stamps). Derive both
in the list orchestrator's `installedRowMessage` by **resolving the cached
manifest entry** (the no-network candidate resolve already used by
`availableRowMessage`), and in the info orchestrator's `buildInstalledRow` (which
already resolves and currently mislabels an unsupported installed plugin as
`installed`). The single biggest planning decision is the precise force-installed
vs force-upgradable predicate given the marketplace cache holds exactly ONE
source tree per plugin — see Open Questions.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FSTAT-01 | Force-installed is DERIVED (recorded-installed + currently re-resolves `unsupported`), no persisted flag, no migration | Derivation seam is `installedRowMessage` (list orch, line 232) + `buildInstalledRow` (info orch, line 799); both already have/can-get the resolved `state`. No state schema change. |
| FSTAT-02 | Force-installed renders `force-installed` status + `◉` glyph (distinct from `●`) on cascade + list | New `ICON_FORCE_INSTALLED = "◉"` (U+25C9), new `PluginForceInstalledMessage` arm, new `renderPluginRow` case. assertNever forces every site. |
| FSTAT-03 | Force-installed → `(installed)` automatically after a fully-supported upgrade, no lingering state | Falls out free: once record.version == manifest.version and the cached tree resolves `installable`, the same deriver yields `installed`. No code path needed beyond the deriver being pure. |
| FSTAT-04 | `list` shows `force-upgradable` for an installed clean plugin whose newer candidate would NEWLY degrade; force-installed never force-upgradable; `●` glyph | New `PluginForceUpgradableMessage` (list-only, mirrors `upgradable`), reuses `ICON_INSTALLED`. Derived alongside upgradable in `installedRowMessage`. |
| FSTAT-05 | Candidate driving upgradable/force-upgradable resolved without network (cache) | `resolveStrict(entry, { marketplaceRoot })` is already the no-network cache resolve (NFR-5); reused from `availableRowMessage` (list, line 350) and `update.ts` (line 735). |
| FSTAT-06 | Pending/preview renders `will force install` / `will force update` in place of `will install` / `will update` | Pending surface = `orchestrators/reconcile/reconcile.messaging.ts` (`will install` renderer). NOTE: NO `will update` token exists today — see Open Questions Q3. Byte wording deferred to Phase 70. |
| FSTAT-07 | `info` reports `force-installed` + dropped-component detail; force install/update success notification reads "force-installed" | info: `buildInstalledRow` line 832-850 currently emits `status: "installed"` for an unsupported installed plugin — change to `force-installed`; widen `PluginInfoRowBase.status` Extract + `pluginInfoStatusGlyph`. Notification: `install.ts:1391` / update analog build a `PluginInstalledMessage` — swap to force-installed arm when `resolved.state === "unsupported"`. Dropped-component detail via `narrowUnsupportedKinds` (already wired in info). |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-66-01:** A SINGLE shared deriver computes realized status from
  (recorded-installed record + current resolver state): recorded-installed AND
  resolves `unsupported` → `force-installed`; recorded-installed AND resolves
  `installable` → `installed`. All surfaces (list, cascade, `info`, success
  notification) read this one deriver. NO persisted `forceInstalled` flag, NO
  state migration. FSTAT-03 falls out for free.
- **D-66-02:** Reuse the EXISTING no-network (cache) candidate resolution that
  already drives `upgradable`. Mark `force-upgradable` when the current resolve
  is `installable` (clean) AND the candidate resolve is `unsupported` (newly
  degrades). Exclude any plugin already `force-installed`. No separate candidate
  path.
- **D-66-03:** Extend the notify.ts status union with `force-installed` (new
  glyph `ICON_FORCE_INSTALLED = "◉"`, U+25C9) and `force-upgradable` (reuses
  `ICON_INSTALLED = "●"`). Add both to the exhaustive glyph switch and lean on
  the existing `assertNever` so every render site must handle them at compile
  time. `◉` is distinct from `●` (FSTAT-02).
- **D-66-04:** Thread the SAME derived force signal into all display surfaces:
  pending/preview (`will force install`/`will force update`), `info`
  (`force-installed` + dropped-component detail via `narrowUnsupportedKinds`),
  success notification ("force-installed" not "installed").

### Claude's Discretion
- Exact deriver helper name/location, the shape of the recorded-state record it
  consumes, and where the candidate-supportability comparison slots into the
  existing list/upgradable path — left to planning, provided behavior matches
  D-66-01..04.
- Byte-exact preview/info/notification wording is finalized against the catalog
  in Phase 70 (DOC); this phase implements the tokens and the glyph values.

### Deferred Ideas (OUT OF SCOPE)
- `--unsupported` list filter, `--force` completion sets, reinstall-as-repair —
  Phase 67 (LIST-01/02, RINST-01).
- Load-time backfill of previously-skipped components — Phase 68 (BFILL-01).
- Force-path severity ladder SEV-01..05 — Phase 69.
- Byte-exact token/catalog reconciliation + PRD §11 — Phase 70 (DOC-01/02).
</user_constraints>

## Project Constraints (from CLAUDE.md)

These bind the planner with the same authority as locked decisions:

- **IL-2:** All user-visible messages go through `ctx.ui.notify(message, severity)`.
  Direct `process.stdout`/`stderr` forbidden in command/bridge code. (The
  renderer already centralizes this; new force arms render through `notify()`.)
- **NFR-7:** TypeScript strict; discriminated unions are the enforcement
  mechanism. The new force statuses MUST be added as discriminated-union arms,
  never as a boolean flag or a stringly-typed back-door.
- **NFR-6:** `npm run check` (typecheck + ESLint + Prettier + `node --test`) must
  stay GREEN. The two closed-set length tripwires WILL fail until bumped.
- **NFR-5:** Candidate resolution MUST be no-network (cache). `resolveStrict` is
  already the cache path; do not introduce a network fetch.
- **Comment/test-title policy** (`.claude/rules/typescript-comments.md`): use
  `D-66-NN` / `FSTAT-NN` / `NFR-N` IDs in comments and test titles. NEVER
  reference GSD phase/plan/wave/task numbers. (Verified: this rule file exists
  and is explicit.)
- **Git:** never commit to `main`; conventional commits; ASCII-only commit
  messages (the `fix-unicode-dashes` hook rejects em-dashes); run
  `pre-commit run --files <changed>` before commit; worktree commits prefix
  `SKIP=trufflehog`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Derive force-installed / force-upgradable from (record + resolver state) | Orchestrator (`orchestrators/plugin/{list,info}.ts`) | Domain resolver (`resolveStrict`) | The resolver provides the three-way `state`; the orchestrator owns the record-vs-state derivation. No new resolver field (D-66-01). |
| Status token + glyph vocabulary | Shared presentation (`shared/notify.ts`) | — | `notify.ts` is the SOLE site that owns `PLUGIN_STATUSES`, `ICON_*`, and the render switch (the D-11 "central vocabulary" rule). |
| Dropped-component (`unsupported` per-kind) detail for info | Shared render helper (`shared/probe-classifiers.ts::narrowUnsupportedKinds`) | info orchestrator | Phase 64 / D-64-02 already centralizes this; reused verbatim. |
| Tool-surface status projection | Edge (`edge/handlers/tools.ts`) | — | The tool surface is a distinct projection (`installed`/`available`/`unavailable`); force tokens project onto `installed`. |
| Success-notification force row | Orchestrator (`orchestrators/plugin/{install,update}.ts`) | shared/notify.ts arm | The orchestrator stamps the realized transition row; the renderer renders it. |

## Standard Stack

**No external packages.** This phase is pure internal TypeScript over the
existing stack already pinned in CLAUDE.md (TypeScript 5.9.x strict, TypeBox
1.x for the resolver schema, `node:test` runner). The resolver arm schemas are
TypeBox `Type.Object` literal-tagged unions; the new notification arms are plain
TS interfaces (the notification union is NOT a TypeBox schema — it is a hand-
written discriminated union over interfaces). No `npm install` required.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. All work is over
in-repo modules and Node built-ins already present.

## Architecture Patterns

### Data flow (force-state derivation → render)

```
                    state.json record (recorded-installed: version, resources)
                              │
                              ▼
  marketplace manifest entry  │   resolveStrict(entry, {marketplaceRoot})   [NFR-5 cache, no network]
  (the cached candidate tree) ┼──────────────► ResolvedPlugin.state ∈ {installable | unsupported | unavailable}
                              │                          │
                              ▼                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  SINGLE DERIVER (D-66-01)                    │
                    │  record installed + state=unsupported        │──► force-installed (◉)
                    │  record installed + state=installable        │──► installed (●)
                    │  + version-differs(candidate) + newly-degrade │──► force-upgradable (●)
                    └─────────────────────────────────────────────┘
                              │
            ┌─────────────────┼───────────────────┬──────────────────┐
            ▼                 ▼                   ▼                  ▼
   list orchestrator   info orchestrator   install/update orch   tools.ts projection
   installedRowMessage buildInstalledRow   success row build     projectRowStatus
            │                 │                   │                  │
            └─────────────────┴───────────────────┴──────────────────┘
                              ▼
            shared/notify.ts  renderPluginRow switch + assertNever  ──►  ctx.ui.notify(body, severity)   [IL-2]
                              (glyph picked from ICON_* constants)
```

### Pattern 1: Closed-set discriminated union + exhaustive switch + assertNever
**What:** `PLUGIN_STATUSES` is a runtime `as const` tuple (line 373);
`PluginStatus = (typeof PLUGIN_STATUSES)[number]` (line 418). Each status has a
per-arm interface; `PluginNotificationMessage` (line 791) unions them. The
`renderPluginRow(p)` switch (line 1827) has a `default: { assertNever(p); }` tail
(line 1985-1988). Adding an arm to the union without a `case` is a TS compile
error at `assertNever`.
**When to use:** This is THE mechanism for FSTAT-02/04. Add the tuple entries,
the interfaces, the union members, and the switch cases together.
**Source:** `extensions/pi-claude-marketplace/shared/notify.ts:373,418,791,1827,1985`

### Pattern 2: `installed` is a double-duty TransitionMessageBase arm
**What:** `PluginInstalledMessage` (line 555) extends `TransitionMessageBase`
(required `severity` + `needsReload` per GATE-01). The list inventory row stamps
`needsReload: false`; the install/cascade transition stamps `needsReload: true`.
The SAME token serves list inventory AND realized transition.
**Apply to:** `force-installed` mirrors this exactly — it appears as a list
inventory row (`installedRowMessage`) AND a success-notification transition row
(`install.ts:1391`). So `PluginForceInstalledMessage` must extend
`TransitionMessageBase` (required `severity`/`needsReload`) and carry
`name`, `dependencies`, optional `version`/`scope`/`reasons`/`description` like
`PluginInstalledMessage`.
**Source:** `shared/notify.ts:555-563`

### Pattern 3: `upgradable` is a list-only MessageBase arm
**What:** `PluginUpgradableMessage` (line 668) extends `MessageBase` (NOT
TransitionMessageBase) — no required severity/needsReload (a list advisory row is
info, no reload). Carries required `reasons` (empty-array sentinel renders no
brace), optional `version`/`scope`/`description`. Rendered via the shared
`pluginRow(ICON_INSTALLED, p, mpScope, "(upgradable)", probe)` helper (line 1914).
**Apply to:** `force-upgradable` mirrors this — list-only advisory, reuses
`ICON_INSTALLED` (`●`), renders `pluginRow(ICON_INSTALLED, p, mpScope,
"(force-upgradable)", probe)`. Required `reasons` (empty sentinel) for the
optional `{...}` brace (SEV-05 in Phase 69 will populate it).
**Source:** `shared/notify.ts:668-675,1913-1914`

### Pattern 4: Glyph constants are module-level `ICON_*` exports
**What:** `ICON_INSTALLED = "●"` (line 1293), `ICON_AVAILABLE = "○"` (1294),
`ICON_UNINSTALLABLE = "⊘"` (1295), `ICON_DISABLED = "◌"` (1306). Each has a
doc-comment explaining its semantic group.
**Apply to:** Add `export const ICON_FORCE_INSTALLED = "◉";` (U+25C9 FISHEYE)
next to the others, with a D-66-03 doc-comment noting it is distinct from `●`
(U+25CF) and marks the realized force-degraded inventory/transition row.
**Source:** `shared/notify.ts:1293-1306`

### Pattern 5: Resolver three-way state already exists (Phase 64)
**What:** `ResolvedPlugin` is a TypeBox union of `installable` / `unsupported` /
`unavailable` (resolver.ts:64-123). `unsupported` carries `pluginRoot` +
`supported[]` + `unsupported[]` (component-kind lists) + `notes[]`.
`resolveStrict(entry, ctx)` returns this union; consumers narrow on
`resolved.state` with `switch` + `assertNever`. `narrowUnsupportedKinds(resolved.unsupported)`
(probe-classifiers.ts:146) maps the kind list to `lsp` / `unsupported source`
reasons.
**Apply to:** The deriver reads `resolved.state` — no resolver change.
**Source:** `domain/resolver.ts:64-136`, `shared/probe-classifiers.ts:146-160`

### Anti-Patterns to Avoid
- **Persisted `forceInstalled` flag / state migration:** explicitly out of scope
  (FSTAT-01; the v1.15 sticky flag was built and removed — do NOT rebuild).
- **A boolean back-door** (`isForceInstalled()`) instead of a union arm: violates
  NFR-7 and bypasses the assertNever enforcement that FSTAT-02/04 rely on.
- **A separate candidate-resolve path:** D-66-02 mandates reusing the existing
  `resolveStrict` cache path; do not add a second resolver call shape.
- **GSD phase/plan numbers in comments/test titles:** forbidden by
  `.claude/rules/typescript-comments.md`; use `D-66-NN`/`FSTAT-NN`/`NFR-N`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-kind unsupported reason markers for info dropped-component detail | A new `{kind→reason}` mapper in info.ts | `narrowUnsupportedKinds(resolved.unsupported)` (probe-classifiers.ts:146) | Phase 64 / D-64-02 already centralizes this; info.ts already imports + uses it (info.ts:52,770). Cross-surface parity is by-construction. |
| No-network candidate resolve | A new cache-fetch helper | `resolveStrict(entry, { marketplaceRoot })` | Already the NFR-5 cache path; used by `availableRowMessage` (list:350) and `update.ts:735`. |
| Plugin row composition (icon + name + scope + version + label + reasons brace) | Inline `joinTokens([...])` per new arm | `pluginRow(icon, p, mpScope, label, probe)` (notify.ts:1756) for reasons-bearing list rows; `installedLikeRow(...)` (1799) for dependency-bearing transition rows | These are the D-11 SOLE composition helpers; force arms reuse them verbatim so byte forms cannot drift. |
| Exhaustiveness enforcement | Manual checklist of render sites | The existing `assertNever` tails | The compiler enumerates every unhandled site for you. |

**Key insight:** Almost everything force-state needs already exists from Phases
64/65 — the resolver three-way `state`, the `narrowUnsupportedKinds` helper, the
`pluginRow`/`installedLikeRow` composers, the `resolveStrict` cache path. Phase 66
is overwhelmingly *additive wiring* of two new union arms through paths that
already discriminate on status.

## Common Pitfalls

### Pitfall 1: Closed-set length tripwires fail the build until bumped
**What goes wrong:** `tests/architecture/notify-closed-set-locks.test.ts` asserts
exact tuple lengths: `PLUGIN_STATUSES.length === 15` (line 37-39) and
`STATUS_TOKENS.length === 22` (line 33-35). Adding `force-installed` +
`force-upgradable` makes them 17 and 24. The test will RED until the expected
counts are bumped in the SAME change.
**Why it happens:** This is a *deliberate* additive-drift tripwire (the test's own
header explains it forces a conscious update + catalog fixture).
**How to avoid:** Bump BOTH counts (15→17, 22→24) and update the test titles
(`"closed 15-entry"` → `"closed 17-entry"`, etc.). Add the two tokens to BOTH
`PLUGIN_STATUSES` (line 373) and `STATUS_TOKENS` (line 198).
**Warning signs:** `node --test` fails with `15 !== 17` style assertion.

### Pitfall 2: `STATUS_TOKENS` and `PLUGIN_STATUSES` are TWO separate sets
**What goes wrong:** Adding the tokens only to `PLUGIN_STATUSES` leaves
`STATUS_TOKENS` (the broader SNM-02 catalog set, line 198, currently 22 entries
including marketplace tokens + `no marketplaces`/`no plugins`/`rollback failed`)
out of sync.
**How to avoid:** Add `force-installed` + `force-upgradable` to `STATUS_TOKENS`
too. There is NO compile-time coverage proof binding plugin statuses to
STATUS_TOKENS (the `_ReasonsCoverageProof` in notify-reasons.ts covers REASONS,
not STATUS_TOKENS), so only the length tripwire catches the omission.
**Source:** `shared/notify.ts:198-223,373-389`; `shared/notify-reasons.ts:131-134`

### Pitfall 3: info uses a DISTINCT status type, not PluginNotificationMessage
**What goes wrong:** `force-installed` added only to `PluginStatus` won't appear
in info. info rows use `PluginInfoRow` whose `PluginInfoRowBase.status` is
`Extract<PluginStatus, "installed" | "available" | "unavailable" | "failed">`
(line 1064). The info glyph mapper `pluginInfoStatusGlyph` (line 2738) is a
SEPARATE exhaustive switch.
**How to avoid:** Add `"force-installed"` to the `Extract<...>` on line 1064 AND
add a `case "force-installed": return ICON_FORCE_INSTALLED;` to
`pluginInfoStatusGlyph` (line 2738). The info row renders `(${plugin.status})`
literally (line 2872), so it will emit `(force-installed)` once the status is set.
Do NOT add `force-upgradable` to info — info is single-plugin, not advisory
(FSTAT-07 mentions only force-installed for info).
**Source:** `shared/notify.ts:1063-1064,2738-2752,2867-2875`

### Pitfall 4: info's installed-but-unsupported branch currently mislabels as `installed`
**What goes wrong:** `buildInstalledRow` (info.ts:799) resolves via
`resolveStrict`; when `resolved.state !== "installable"` (i.e. `unsupported`) it
currently returns `status: "installed"` (line 845) with the unsupported component
fields. That is the exact row that must become `force-installed`.
**How to avoid:** Discriminate: when the installed plugin's resolve is
`unsupported`, set `status: "force-installed"` (FSTAT-07). The
`narrowUnsupportedKinds` reasons are already threaded via
`buildNonInstallableRowFields` (info.ts:756,770) — the dropped-component detail
comes for free.
**Source:** `orchestrators/plugin/info.ts:818-850`

### Pitfall 5: list `installedRowMessage` does NOT currently resolve the plugin
**What goes wrong:** `installedRowMessage` (list.ts:232) derives `upgradable`
from a pure version-STRING compare (`manifestEntry.version !== record.version`,
line 241) and never calls the resolver. There is no `resolved.state` in scope —
so force-installed/force-upgradable cannot be derived without adding a resolve.
**How to avoid:** Thread a `resolveStrict(manifestEntry, { marketplaceRoot })`
into the installed-plugin path (the same call `availableRowMessage` already makes
at list.ts:350). The `marketplaceRoot` is available in `loadPluginListPayload`.
Resolve once per installed plugin (NFR-5 cache, no network). This is the central
new wiring of the phase — see Open Questions Q1 for the exact predicate.
**Warning signs:** Trying to derive force-state from the record's `resources`
counts alone — that is the persisted-flag anti-pattern in disguise and does not
reflect the CURRENT supported-kind boundary.

### Pitfall 6: `tools.ts` has multiple switches over plugin status
**What goes wrong:** `projectRowStatus` (tools.ts:159) is an exhaustive switch
over `PluginNotificationMessage["status"]` with a `throw new Error(...)` default
(line 186) — NOT assertNever, so a new status compiles but throws at RUNTIME on
the list tool surface. Both `force-installed` and `force-upgradable` must be added
as `case` → `return "installed"` (both ARE installed on the tool surface, per the
CONTEXT D-66-03 note and the existing `upgradable → installed` precedent at
line 165).
**How to avoid:** Add both cases to `projectRowStatus`. The other two tools.ts
switches (`statusLabel` line 192, `statusKey` line 235) are over `ToolPluginStatus`
(only installed/available/unavailable) — they do NOT need force cases.
**Source:** `edge/handlers/tools.ts:159-190`

### Pitfall 7: GATE-01 stamp-coverage backstops for the new transition arm
**What goes wrong:** `force-installed` as a `TransitionMessageBase` arm requires
`severity` + `needsReload` (compile-enforced at construction). The architecture
backstops `notify-stamp-coverage.test.ts` (reconcile projection) and
`notify-producer-wire-coverage.test.ts` (render-map producers) assert
representative realized-transition rows carry both stamps. If the force-install
success row flows through the reconcile projection or a render-map producer, add
it to the relevant backstop's representative set.
**How to avoid:** When building the success-notification force row
(`install.ts` / `update.ts`), stamp `severity: "info"` (Phase 65 D-65-01 keeps
force at info, no `Warning:`) + `needsReload: true`; list inventory stamps
`severity: "info"` + `needsReload: false`. Check whether the producer-wire
coverage test enumerates the force arm.
**Source:** `tests/architecture/notify-stamp-coverage.test.ts`,
`tests/architecture/notify-producer-wire-coverage.test.ts`

## Code Examples

### Adding the glyph constant (notify.ts ~line 1306)
```typescript
// Source: shared/notify.ts:1293-1306 (existing ICON_* pattern)
export const ICON_INSTALLED = "●";        // U+25CF BLACK CIRCLE (existing)
// D-66-03 / FSTAT-02: realized force-degraded plugin (installed via --force,
// currently re-resolving `unsupported`). U+25C9 FISHEYE -- visually distinct
// from ICON_INSTALLED's U+25CF so a force-installed row is unambiguous on
// cascade + list surfaces. force-upgradable reuses ICON_INSTALLED (the row is
// currently clean).
export const ICON_FORCE_INSTALLED = "◉";  // U+25C9
```

### The exhaustive render switch additions (notify.ts ~line 1913)
```typescript
// Source: shared/notify.ts:1842-1914 (existing arms)
// force-installed mirrors the `installed` arm (dependency-bearing, double-duty):
case "force-installed":
  return installedLikeRow(
    ICON_FORCE_INSTALLED, p, mpScope,
    renderVersion(p.version), "(force-installed)", p.reasons, probe,
  );
// force-upgradable mirrors the `upgradable` arm (list-only, reasons-bearing):
case "force-upgradable":
  return pluginRow(ICON_INSTALLED, p, mpScope, "(force-upgradable)", probe);
```

### info glyph mapper addition (notify.ts ~line 2738)
```typescript
// Source: shared/notify.ts:2738-2752
function pluginInfoStatusGlyph(status: PluginInfoRow["status"]): string {
  switch (status) {
    case "installed":       return ICON_INSTALLED;
    case "force-installed": return ICON_FORCE_INSTALLED;  // FSTAT-07
    case "available":       return ICON_AVAILABLE;
    case "unavailable":
    case "failed":          return ICON_UNINSTALLABLE;
    default: assertNever(status); return "";
  }
}
```

### tools.ts projection addition (tools.ts ~line 164)
```typescript
// Source: edge/handlers/tools.ts:159-190
case "installed":
case "upgradable":
case "force-installed":    // D-66-03: a force-installed plugin IS installed
case "force-upgradable":   // on the tool surface (clean, newer would degrade)
  return "installed";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary `installable: true\|false` resolver | Three-way `state: installable\|unsupported\|unavailable` | Phase 64 (D-64-01) | The `unsupported` arm IS the force-installed signal source — no new resolver work. |
| Persisted `forceInstalled` sticky flag (v1.15) | Pure derivation from (record + resolve) | This milestone | Built + removed in v1.15; explicitly out of scope (REQUIREMENTS Out of Scope). |
| `upgradable` = version string compare (list) | Same for upgradable; force-upgradable needs a supportability resolve | This phase | list orchestrator gains a per-installed-plugin resolve (Pitfall 5). |

**Deprecated/outdated:** none relevant — this is current `features/force-install`
code as of 2026-06-27.

## Runtime State Inventory

This phase is derivation/display-only and adds NO persisted data, but the CONTEXT
frames force-state as the *absence* of persisted state, so the inventory confirms
nothing new is stored.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — FSTAT-01 mandates NO persisted `forceInstalled` flag; `state.json` schema (`STATE_SCHEMA`) is UNCHANGED. Verified: no schema field added. | None (data migration explicitly forbidden) |
| Live service config | None — no external service holds force-state; it is computed at render time. | None |
| OS-registered state | None — pure in-process render. | None |
| Secrets/env vars | None. | None |
| Build artifacts | None — no package rename; `narrowUnsupportedKinds` already shipped (Phase 64). | None |

**The canonical question — after every file is updated, what runtime systems
still cache the old shape?** Answer: none. Force-state is a pure function
recomputed on every `list`/`info`/install invocation; there is nothing to migrate
or backfill in Phase 66. (Load-time backfill of previously-skipped *components* is
a separate concern — Phase 68 / BFILL-01.)

## Environment Availability

Skipped — no external tools, services, or runtimes beyond the project's own Node
test toolchain (already present per CLAUDE.md: Node ≥20.19.0, `node --test`). This
phase is code-only.

## Validation Architecture

> nyquist_validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥20.19.0) + `node:assert/strict` |
| Config file | none — test files discovered by glob; run via `npm run check` / `node --test` |
| Quick run command | `node --test tests/shared/notify-v2.test.ts tests/architecture/notify-closed-set-locks.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + `node --test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FSTAT-01 | No persisted flag — STATE_SCHEMA unchanged; force-state derived | unit/arch | `node --test tests/domain/` (state schema) + new deriver unit | ✅ existing schema tests; ❌ deriver unit = Wave 0 |
| FSTAT-02 | `force-installed` renders `◉ name v.. (force-installed)`; `◉` ≠ `●` | unit (renderer byte) | `node --test tests/shared/notify-v2.test.ts` | ✅ file exists; ❌ new test cases = Wave 0 |
| FSTAT-03 | After supported upgrade, deriver yields `installed` (no lingering force) | unit (deriver) | new deriver/orchestrator unit | ❌ Wave 0 |
| FSTAT-04 | `force-upgradable` row wears `●`; force-installed never force-upgradable | unit (renderer + deriver) | `node --test tests/shared/notify-v2.test.ts` + `tests/orchestrators/plugin/list.test.ts` | ✅ files exist; ❌ cases = Wave 0 |
| FSTAT-05 | Candidate resolved no-network (cache) | unit (orchestrator with injected resolve ctx, no network stub) | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ file; ❌ case = Wave 0 |
| FSTAT-06 | Preview renders `will force install`/`will force update` | unit (pending renderer) | `node --test tests/edge/handlers/plugin/pending.test.ts` + reconcile pending | ✅ files; ❌ cases = Wave 0; see Q3 |
| FSTAT-07 | info row `(force-installed)` + dropped-component detail; success notif "force-installed" | unit (info renderer + install/update orch) | `node --test tests/orchestrators/plugin/info.test.ts tests/edge/handlers/plugin/info.test.ts` | ✅ files; ❌ cases = Wave 0 |
| (gate) | Closed-set length tripwires bumped | arch | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ exists; must EDIT counts |

### The byte-exact output-contract machinery (catalog-uat)
The repo's byte-exact contract lives in
`tests/architecture/catalog-uat.test.ts`. Mechanism (verified by reading the
runner):
1. `loadCatalogExamples(catalog)` parses `docs/output-catalog.md`, pairing each
   `<!-- catalog-state: STATE -->` comment with the NEXT fenced block, scoped to
   a per-command H2 section (`` ## `/claude:plugin <verb>` ``, `## Manual
   recovery anchors`, or `## reconcile-applied-cascade`).
2. A hand-written `FIXTURES` map keyed `(section, state)` carries a
   `NotificationMessage` payload + a `MockPi` factory.
3. The driver calls `notify(mockCtx, mockPi, message)` and asserts **byte
   equality** against the catalog's fenced block.
   - A catalog block with NO matching fixture → test FAILS (missing fixture).
   - A fixture with NO catalog block → simply not exercised (the loop iterates
     catalog examples, not fixtures).

**Phase 66 vs Phase 70 boundary (CRITICAL for task scoping):**
- **Phase 66 implements** the token VALUES, the glyph VALUES, and the
  **`notify-v2.test.ts` unit assertions** that drive `notify()` directly and
  byte-assert the new `◉ ... (force-installed)` / `● ... (force-upgradable)` row
  forms (e.g. the existing `notify-v2.test.ts:404` upgradable test is the exact
  template). These unit byte-tests do NOT touch `docs/output-catalog.md`.
- **Phase 66 must NOT** add new `<!-- catalog-state: -->` blocks to
  `docs/output-catalog.md` (that is byte-exact catalog reconciliation = Phase 70
  / DOC-02). Adding a catalog block without a fixture would RED the catalog-uat
  gate, and adding fixtures+catalog now would pre-empt the Phase 70 freeze.
- **Therefore:** keep the catalog UNTOUCHED in Phase 66; the catalog-uat suite
  stays GREEN because it only iterates existing catalog states. The new force
  rows are proven by `notify-v2.test.ts` direct-`notify()` byte assertions +
  orchestrator unit tests. The glyph legend table in `docs/output-catalog.md`
  (lines 7-12, 131-157) and `docs/messaging-style-guide.md` are reconciled in
  Phase 70.

### Sampling Rate
- **Per task commit:** `node --test <touched test file>` + `npm run check` if
  notify.ts/tuples changed (the length tripwire is fast).
- **Per wave merge:** `npm run check` (full typecheck + lint + format + tests).
- **Phase gate:** full suite GREEN before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/shared/notify-v2.test.ts` — add `force-installed` + `force-upgradable`
  renderer byte-form cases (template: existing `upgradable` test at line 404 and
  the PL-4 description tests at 1064-1175). Covers FSTAT-02/04.
- [ ] `tests/architecture/notify-closed-set-locks.test.ts` — bump 15→17 and
  22→24, update titles. (Edit, not new file.)
- [ ] `tests/orchestrators/plugin/list.test.ts` — deriver cases: force-installed
  (record installed + cached tree resolves unsupported), force-upgradable
  (clean current + newer candidate degrades), FSTAT-03 return-to-installed.
- [ ] `tests/orchestrators/plugin/info.test.ts` / `tests/edge/handlers/plugin/info.test.ts`
  — info `(force-installed)` row + dropped-component detail (FSTAT-07).
- [ ] `tests/edge/handlers/tools.test.ts` — force-installed/force-upgradable
  project to `[installed]` (template: existing `[installed] p1` assertions).
- [ ] Pending/preview test for `will force install`/`will force update` —
  contingent on Q3 resolution.
- [ ] No new framework install — `node --test` already in place.

## Security Domain

`security_enforcement` not explicitly disabled, so noted. This phase is a
display/derivation change with NO new input parsing, NO network, NO crypto, NO
auth, NO filesystem writes.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | marginal | The only "input" is the resolver's typed `unsupported[]` kind list; already validated by the TypeBox `ResolvedPlugin` schema (Phase 64). `narrowUnsupportedKinds` first-wins dedups it. No new untrusted input. |
| V6 Cryptography | no | none introduced |
| V2/V3/V4 Auth/Session/Access | no | not applicable (local CLI extension, no auth surface) |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plugin manifest description / name rendering | Information disclosure / spoofing | Existing `truncateDescription` (notify.ts:1315) + whitespace-normalizing hard-wrap (T-42-01 mitigation) already neutralize control chars in user-supplied strings; force rows reuse the same composers, inheriting the mitigation. |

No new threat surface. NFR-10 path containment and NFR-5 no-network are
preserved because the phase reuses `resolveStrict` (cache) and adds no FS writes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | force-installed should be a `TransitionMessageBase` arm (required severity/needsReload, double-duty list+notification), and force-upgradable a `MessageBase` list-only arm | Architecture Patterns 2/3 | If force-installed is modeled as MessageBase-only, the success-notification transition row can't stamp needsReload — but D-66-01/04 require it on the notification surface, so TransitionMessageBase is strongly indicated. Low risk. |
| A2 | The list force-state predicate splits force-installed vs force-upgradable on whether the cached candidate version equals the recorded version | Open Questions Q1 | The marketplace cache holds ONE tree, so "current installed" vs "candidate newer" supportability cannot both be independently resolved when versions differ. The exact predicate is Claude's-discretion per D-66 but MUST be pinned by the planner. Medium risk — see Q1. |
| A3 | `STATUS_TOKENS` must also gain the two force tokens (not just `PLUGIN_STATUSES`) | Pitfall 2 | If STATUS_TOKENS is NOT meant to carry plugin-only realized tokens, the bump is 15→17 only. But STATUS_TOKENS already contains every plugin status token (installed, upgradable, disabled, will install…), so force tokens belong there. Low risk. |
| A4 | Phase 66 leaves `docs/output-catalog.md` and `docs/messaging-style-guide.md` untouched (Phase 70 owns byte reconciliation) | Validation Architecture | If the catalog-uat gate is expected to cover force rows in Phase 66, a fixture+catalog pair would be needed now. CONTEXT D-66 + ROADMAP explicitly defer byte reconciliation to Phase 70, so untouched-catalog is correct. Low risk. |
| A5 | `will force update` preview has no current home (no `will update` token exists) | Open Questions Q3 | If a `will update` surface exists that I did not find, the threading is simpler. Grep confirms only `will install`/`will uninstall`/`will enable`/`will disable` tokens exist. Medium risk — needs planner confirmation. |

## Open Questions (RESOLVED)

> All three questions were locked during planning (FSTAT-NN / D-66-NN). The
> plan files are authoritative; resolutions recorded inline below.
>
> - RESOLVED Q1 (66-02): version-differs split locked. force-installed =
>   record-installed AND state===unsupported AND NOT version-differs;
>   force-upgradable = record-installed AND state===unsupported AND
>   version-differs; mutually exclusive; FSTAT-03 falls out (D-66-01/02).
> - RESOLVED Q2 (66-03): build PluginForceInstalledMessage when
>   resolved.state==="unsupported", stamped severity:"info" + needsReload:true
>   (no Warning), per D-66-04 / Phase 65 D-65-01.
> - RESOLVED Q3 (66-04): `will force install` is threaded via a force modifier
>   on the reconcile `will install` renderer. `will force update` has NO
>   preview surface in the current architecture (no `will update` token exists;
>   reconcile models no update action) and adding one would breach the locked
>   +2 token bump (D-66-03); recorded as a documented architectural gap, not
>   implemented in this phase.

1. **The exact force-installed vs force-upgradable derivation predicate in `list`.**
   - What we know: The marketplace cache holds exactly ONE source tree per plugin
     (the latest fetched), and `resolveStrict` resolves THAT tree. `installedRowMessage`
     currently computes `upgradable` from a pure version-string compare and does
     not resolve at all. force-installed (D-66-01) needs the CURRENT installed
     version's resolve; force-upgradable (D-66-02) needs current-clean AND
     candidate-degrades.
   - What's unclear: When `record.version !== manifest.version` (upgradable), the
     single cached tree IS the candidate (newer) — the OLD installed version's
     supportability is not independently resolvable from the cache. So "current
     resolves installable" (the force-upgradable precondition) and "current
     re-resolves unsupported" (the force-installed condition) both depend on a
     "current" resolve that the cache may not hold when versions differ.
   - Recommendation (tag A2, needs planner lock): Resolve the cached tree once →
     `state`. Then: `force-installed` = record-installed AND `state === unsupported`
     AND NOT version-differs (the cached tree IS the installed version, re-resolving
     unsupported); `force-upgradable` = record-installed AND `state === unsupported`
     AND version-differs (the cached NEWER tree degrades a plugin whose installed
     version was clean); plain `upgradable` = `state === installable` AND
     version-differs; plain `installed` = `state === installable` AND NOT
     version-differs. This split makes force-installed and force-upgradable mutually
     exclusive (satisfying "force-installed is never force-upgradable") and makes
     FSTAT-03 fall out. The planner should confirm this matches the intended
     "currently clean" semantics, or define a stricter current-version resolve if
     the marketplace clone retains per-version trees.

2. **Does the success-notification force row need a new transition arm, or reuse
   `installed` with a swapped token?**
   - What we know: `install.ts:1391` and the update analog build a
     `PluginInstalledMessage`. D-66-04 says the success row reads "force-installed".
   - Recommendation: Build a `PluginForceInstalledMessage` (TransitionMessageBase
     mirror) when `installCtx.resolved.state === "unsupported"`, else the existing
     `installed`. Stamp `severity: "info"` (Phase 65 D-65-01: no Warning on force
     path), `needsReload: true`. Confirm against the GATE-01 producer-wire backstop.

3. **Where does `will force update` render? No `will update` token exists.**
   - What we know: Grep confirms the only pending-tense tokens are `will install`,
     `will uninstall`, `will enable`, `will disable` (notify.ts + reconcile.messaging.ts).
     The `pending` surface is the reconcile diff. FSTAT-06 names BOTH `will force
     install` AND `will force update`.
   - What's unclear: There is no `will update` token to swap to `will force update`,
     and the reconcile-pending surface does not emit updates (it emits install/
     uninstall/enable/disable diffs). The `will force install` half maps cleanly to
     the reconcile `will install` renderer; the `will force update` half has no
     obvious current surface.
   - Recommendation: The planner should locate the intended preview surface for
     force update (possibly a dry-run on `update --force`, or a deferred token).
     Since byte wording is Phase 70 and FSTAT-06 is display-threading, scope Phase
     66 to thread the force signal into the `will install` reconcile renderer
     (→ `will force install`) and FLAG `will force update` for clarification —
     do not invent a `will update` token without confirming the surface.

## Sources

### Primary (HIGH confidence — read directly from the repo, 2026-06-27)
- `extensions/pi-claude-marketplace/shared/notify.ts` — status union, tuples
  (`PLUGIN_STATUSES`:373, `STATUS_TOKENS`:198), `ICON_*`:1293-1306, per-arm
  interfaces (`PluginInstalledMessage`:555, `PluginUpgradableMessage`:668),
  `renderPluginRow`:1827 + `assertNever`:1986, `pluginRow`:1756,
  `installedLikeRow`:1799, `PluginInfoRowBase.status`:1064,
  `pluginInfoStatusGlyph`:2738, info row render:2867.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` —
  `narrowUnsupportedKinds`:146, `narrowResolverNotes`:87.
- `extensions/pi-claude-marketplace/domain/resolver.ts` — three-way state
  schema:64-123, `MaterializablePlugin`:136, `requireForceInstallable`:1110.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` —
  `installedRowMessage`:232 (version-string upgradable:241), `availableRowMessage`
  resolve:350, `sortPluginsInBlock` status switch:799.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` —
  `buildInstalledRow`:799 (unsupported→`installed` mislabel:845),
  `buildNonInstallableRowFields`:756 (narrowUnsupportedKinds:770).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — candidate
  resolve + force gate:735-745.
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — `projectRowStatus`:159
  (throw default:186), `statusLabel`:192, `statusKey`:235.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` (full),
  `orchestrators/reconcile/reconcile.messaging.ts` (`will install` renderer:84).
- `tests/architecture/catalog-uat.test.ts` — byte-equality runner +
  `loadCatalogExamples` parser + FIXTURES map shape.
- `tests/architecture/notify-closed-set-locks.test.ts` — length tripwires (15/22).
- `tests/shared/notify-v2.test.ts` — direct-`notify()` byte assertion template
  (upgradable:404, PL-4 description:1064-1175).
- `tests/architecture/notify-{stamp,producer-wire}-coverage.test.ts` — GATE-01
  backstops.
- `docs/output-catalog.md` — glyph legend (7-12, 131-157).
- `.claude/rules/typescript-comments.md` — comment/test-title ID policy.
- `.planning/phases/{64,65,66}-*/...-CONTEXT.md`, `.planning/REQUIREMENTS.md`.

### Secondary / Tertiary
- None — no web search needed; this is a closed internal codebase with no
  external-library research surface.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external deps; all infrastructure verified in-repo.
- Architecture / seams: HIGH — every file, line, and switch read directly.
- Derivation predicate (Q1): MEDIUM — the union arms + render path are certain;
  the exact force-installed/force-upgradable split is genuinely under-determined
  by the single-cached-tree constraint and is the one decision the planner must
  lock (A2/Q1).
- Preview surface (Q3): MEDIUM — `will force install` path is clear; `will force
  update` has no current token/surface and needs clarification.

**Research date:** 2026-06-27
**Valid until:** stable until the notify.ts status model or the resolver three-way
state changes; re-verify line numbers if `shared/notify.ts` is edited before
planning (the file is actively churned).
