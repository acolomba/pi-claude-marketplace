# Phase 66: Derived Force-State, Glyphs & Force-Upgradability - Research

**Researched:** 2026-06-27
**Domain:** Internal TypeScript codebase — notification status model, resolver-derived display state, byte-exact output contract
**Confidence:** HIGH (all claims verified against the current post-65.1 tree this session)

> This is a RE-PLAN. All findings below were regenerated against the CURRENT
> code (HEAD on `features/force-install`, post-65.1). No value was carried from
> the discarded pre-65.1 plans or from git history. Every line number and
> closed-set count was read live this session.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-66-01:** A SINGLE shared deriver computes the realized status from
  (recorded-installed record + current resolver state): recorded-installed AND
  resolves `unsupported` → `force-installed`; recorded-installed AND resolves
  `installable` → `installed`. All surfaces (list, cascade, `info`, success
  notification) read this one deriver. NO persisted `forceInstalled` flag, NO
  state migration. FSTAT-03 falls out for free.
- **D-66-02:** Reuse the EXISTING no-network (cache) candidate resolution that
  drives `upgradable`. Mark `force-upgradable` when the current resolve is
  `installable` (clean) AND the candidate resolve is `unsupported`. Exclude any
  plugin already `force-installed`. No separate candidate path.
- **D-66-03:** Extend the notify.ts status union with `force-installed` (new
  glyph `ICON_FORCE_INSTALLED = "◉"`, U+25C9) and `force-upgradable` (reuses
  `ICON_INSTALLED = "●"`). Add both to the exhaustive glyph switch + lean on
  `assertNever`. `◉` is distinct from `●` (FSTAT-02).
- **D-66-04:** Thread the SAME derived force signal into all display surfaces:
  pending/preview renders `will force install` / `will force update` in place of
  `will install` / `will update` when a force operation is planned; `info`
  reports `force-installed` and surfaces dropped-component detail via
  `narrowUnsupportedKinds`; the force install/update success row reads
  "force-installed".
- **D-66-05:** Re-planned after Phase 65.1. Closed-set baseline is now
  `STATUS_TOKENS = 20`, `MARKETPLACE_STATUSES = 7`. Adding `force-installed` +
  `force-upgradable` moves `STATUS_TOKENS` 20→22 and `PLUGIN_STATUSES` 15→17.
  Implement ONLY `will force install`; `will force update` is VACUOUS (the
  pending/reconcile surface has no update action) — document the absence, do not
  design a `will force update` surface.

### Claude's Discretion
- Exact deriver helper name/location, the shape of the recorded-state record it
  consumes, and where the candidate-supportability comparison slots into the
  existing list/upgradable path — left to planning, provided behavior matches
  D-66-01..05.
- Byte-exact preview/info/notification wording is finalized against the catalog
  in Phase 70 (DOC); this phase implements the tokens and the glyph values.

### Deferred Ideas (OUT OF SCOPE)
- `--unsupported` list filter, `--force` completion sets, reinstall-as-repair —
  Phase 67 (LIST-01/02, RINST-01).
- Load-time backfill of previously-skipped components — Phase 68 (BFILL-01/02).
- Force-path severity ladder SEV-01..05 — Phase 69.
- Byte-exact token/catalog reconciliation + PRD §11 — Phase 70 (DOC-01/02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FSTAT-01 | Force-installed is DERIVED — recorded-installed + currently re-resolving `unsupported`; no persisted flag, no migration | `PLUGIN_INSTALL_RECORD_SCHEMA.compatibility` already persists `{installable, supported, unsupported, notes}` at install time (state-io.ts:54-73). The "deriver" reads this recorded resolver state — it is NOT a new flag. See Architecture Patterns §Deriver. |
| FSTAT-02 | Force-installed renders `force-installed` + `◉` on cascade and list surfaces | Add union arm + `ICON_FORCE_INSTALLED="◉"` + render-switch arm in `renderPluginRow` (notify.ts:1798); install/update success cascade row emits the new status (install.ts:1391). |
| FSTAT-03 | Force-installed → `(installed)` automatically after a fully-supported upgrade — no lingering state | Falls out: upgrade rewrites `record.compatibility` with the new version's resolution; the deriver reads live compatibility, so an installable upgrade yields `installed`. No separate code path. |
| FSTAT-04 | `list` shows `force-upgradable` (wears `●`) for a currently-clean plugin whose newer cache-resolved candidate would NEWLY degrade it; force-installed is never force-upgradable | Add `resolveStrict` of the candidate manifest entry into the list deriver (`installedRowMessage`, list.ts:232); reuses `ICON_INSTALLED`. |
| FSTAT-05 | The candidate driving upgradable / force-upgradable is resolved without network | `resolveStrict` is the no-network resolver (domain/resolver.ts:948); the `no-orchestrator-network` architecture test guards `list`. List already loads manifests softly with no network. |
| FSTAT-06 | Pending/preview renders `will force install` (only — `will force update` is vacuous) in place of `will install` | Add a `force?: boolean` modifier to `PluginWillInstallMessage` (notify.ts:740) rendered by the `case "will install"` arm; the reconcile plan has NO update bucket (types.ts:203-211 — confirmed 7 buckets, none for updates). |
| FSTAT-07 | `info` reports `force-installed` + dropped-component detail; success notification reads "force-installed" | info orchestrator already resolves three-way + uses `narrowUnsupportedKinds` (info.ts:52); add `force-installed` to `PluginInfoRowBase` status set (notify.ts:1043) + `pluginInfoStatusGlyph` (notify.ts:2704); success rows in install.ts/update.ts branch on `resolved.state`. |
</phase_requirements>

## Summary

Phase 66 is a **display/derivation** phase entirely inside the existing
TypeScript notification model. It introduces zero persisted data and zero
network access. Two new realized plugin statuses — `force-installed` (glyph
`◉`) and `force-upgradable` (glyph `●`) — are derived from data the codebase
already has: the per-plugin `compatibility` record persisted at install time
(`state-io.ts` `PLUGIN_INSTALL_RECORD_SCHEMA.compatibility`, carrying
`installable` / `supported` / `unsupported` / `notes`), plus a no-network
`resolveStrict` of the marketplace candidate manifest entry.

The work is a closed-set extension following the established pattern: extend two
`as const` tuples (`STATUS_TOKENS` 20→22, `PLUGIN_STATUSES` 15→17), add two
discriminated-union arms, add the matching arms to the exhaustive
`renderPluginRow` switch (whose `assertNever` tail compile-forces every render
site), wire the new statuses through the `tools.ts` projection and the
`notify-stamp-coverage` compile switch, and land the closed-set tripwire bumps
plus any new catalog/UAT fixtures in **one lockstep change** so `npm run check`
stays green. Phase 65.1 set the exact precedent for this lockstep discipline
(commit 5e102920 changed source tuples, render arms, every coupled test, AND
`docs/output-catalog.md` + `docs/messaging-style-guide.md` in a single green
commit).

The single non-mechanical design question is **how the deriver determines the
CURRENT installed version's supportability** when a newer candidate exists. The
marketplace clone advances to HEAD on `marketplace update`, so the older
installed version's manifest is no longer on disk and cannot be re-resolved
no-network. The persisted `record.compatibility` is the only reliable
no-network signal for the current version — `resolveStrict` of the marketplace
manifest entry resolves the CANDIDATE (HEAD), not the installed version.

**Primary recommendation:** Implement the deriver as: **force-installed ⟸ read
`record.compatibility` (unsupported non-empty / `installable === false`)**;
**force-upgradable ⟸ record is clean AND a no-network `resolveStrict` of the
newer candidate manifest entry returns `state === "unsupported"`**. This is
fully no-network, needs no new persisted field, and makes FSTAT-03 fall out
because upgrade rewrites `compatibility`. Land all closed-set, render, test, and
catalog changes in one green commit per the 65.1 lockstep precedent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Derive force-installed/force-upgradable | Orchestrator (`orchestrators/plugin/list.ts`) | Domain (`domain/resolver.ts` resolveStrict) | The list orchestrator owns row-status computation; it reads the persisted record and calls the no-network resolver. |
| Status tokens + glyphs + render switch | Shared (`shared/notify.ts`) | — | notify.ts is the SOLE closed-set + renderer authority; every surface routes through it. |
| Force-installed success row | Orchestrator (`orchestrators/plugin/install.ts`, `update.ts`) | Shared (notify message types) | The install/update orchestrator holds the live `resolved.state` at success time — no re-derivation needed. |
| `info` force-installed + dropped detail | Orchestrator (`orchestrators/plugin/info.ts`) | Shared (`probe-classifiers.ts::narrowUnsupportedKinds`) | info re-resolves independently and already uses the marker helper. |
| `will force install` pending modifier | Orchestrator (`orchestrators/reconcile/notify.ts`) | Shared (notify `PluginWillInstallMessage`) | The reconcile projection owns pending-row construction; the modifier is a render-time field. |
| Tool-surface projection | Edge (`edge/handlers/tools.ts`) | — | The LLM-tool surface flattens statuses; both force states project to `installed`. |

## Standard Stack

No external packages. This phase is pure internal TypeScript against the
existing stack already declared in CLAUDE.md (TypeScript strict, typebox,
node:test). No `npm install`. **Package Legitimacy Audit and Environment
Availability sections are intentionally omitted — this phase installs no
dependencies and changes only code/docs/tests.**

## Architecture Patterns

### System Data Flow (force-state derivation)

```
                          /claude:plugin list  (no network — NFR-5)
                                   │
                                   ▼
                 orchestrators/plugin/list.ts :: enumerateMarketplacePlugins
                                   │
                  ┌────────────────┴─────────────────┐
         (installed bucket)                  (manifest-only bucket)
                  │                                   │
                  ▼                                   ▼
        installedRowMessage(record, manifestEntry)   availableRowMessage  (unchanged)
                  │
   ┌──────────────┴───────────────────────────────────────────────┐
   │  DERIVER (new):                                                │
   │  1. record.compatibility.unsupported non-empty?  ── yes ──▶ force-installed (◉)  │
   │  2. else upgradable (manifestEntry.version !== record.version)?               │
   │       └─ resolveStrict(manifestEntry)  (no network, CANDIDATE)               │
   │            ├─ state==="unsupported" ──▶ force-upgradable (●)                 │
   │            └─ state==="installable" ──▶ upgradable (●)                       │
   │  3. else ───────────────────────────────────────────▶ installed (●)         │
   └───────────────────────────────────────────────────────────────┘
                  │
                  ▼
        shared/notify.ts :: renderPluginRow (exhaustive switch + assertNever)
                  │
                  ▼
            ctx.ui.notify(text, severity)   (IL-2)
```

The same realized-status values surface on: the install/update **success
cascade** (orchestrator stamps the status directly from `resolved.state`),
**`info`** (info orchestrator re-resolves and reports `force-installed` +
dropped kinds), and the tool projection (both force states → `installed`).

### Component Responsibilities

| File | Line(s) (verified) | Responsibility / Change |
|------|--------------------|-------------------------|
| `shared/notify.ts` | `STATUS_TOKENS` 198-219 | Add `"force-installed"`, `"force-upgradable"` → length 20→22. |
| `shared/notify.ts` | `PLUGIN_STATUSES` 371-387 | Add both → length 15→17. |
| `shared/notify.ts` | ICON block 1272-1285 | Add `export const ICON_FORCE_INSTALLED = "◉";` (U+25C9). force-upgradable reuses `ICON_INSTALLED`. |
| `shared/notify.ts` | message interfaces ~554-780 | Add `PluginForceInstalledMessage` + `PluginForceUpgradableMessage` (model on `PluginInstalledMessage` / `PluginUpgradableMessage`: name, version?, scope?, reasons? (ContentReason[]), description?). |
| `shared/notify.ts` | `PluginNotificationMessage` union 790-801 | Add the two arms. |
| `shared/notify.ts` | `renderPluginRow` switch 1798-1955 | Add `case "force-installed"` (ICON_FORCE_INSTALLED) + `case "force-upgradable"` (ICON_INSTALLED, like the existing `upgradable` arm at 1879-1880). `assertNever` tail (1951) compile-forces this. |
| `shared/notify.ts` | `PluginWillInstallMessage` 740-744 | Add `readonly force?: boolean`. |
| `shared/notify.ts` | `case "will install"` 1888-1898 | Branch on `p.force` → render `(will force install)` vs `(will install)` (FSTAT-06). |
| `shared/notify.ts` | PL-4 description filter 3172-3180 | Add `force-installed` + `force-upgradable` to the list-inventory description-carrying set. |
| `shared/notify.ts` | `PluginInfoRowBase.status` 1043 | Widen the `Extract<PluginStatus, ...>` set to include `"force-installed"` (FSTAT-07). |
| `shared/notify.ts` | `pluginInfoStatusGlyph` 2704-2718 | Add `case "force-installed": return ICON_FORCE_INSTALLED;`. |
| `orchestrators/plugin/list.ts` | `installedRowMessage` 232-305 | THE DERIVER SEAM. Add `record.compatibility` read + no-network candidate `resolveStrict`. Make the function `async` (it is currently sync) OR resolve the candidate in the already-async `enumerateMarketplacePlugins` caller (453-465) and pass the resolved state in. |
| `orchestrators/plugin/list.ts` | `PluginRenderStatus` 101, `shouldShow` 139-146 | Extend the local render-status union + the `--installed` filter scope (note: the `--installed` filter spanning force-installed is technically LIST-01 / Phase 67 — keep Phase 66 to the derivation + render). |
| `orchestrators/plugin/install.ts` | success row 1391-1400 | When `installCtx.resolved.state === "unsupported"`, emit `status: "force-installed"` instead of `"installed"` (FSTAT-07 success wording). |
| `orchestrators/plugin/update.ts` | success row (mirror of install) | Same branch on the candidate `resolved.state`. |
| `orchestrators/plugin/info.ts` | row builders ~523-595 | For an installed plugin resolving `unsupported`, emit `status: "force-installed"` + dropped kinds via `narrowUnsupportedKinds`. |
| `edge/handlers/tools.ts` | `projectRowStatus` 159-171 | Add `case "force-installed": case "force-upgradable": return "installed";`. |
| `orchestrators/reconcile/notify.ts` | pending projection 248-277 | When a planned `pluginsToInstall` entry resolves `unsupported` (no-network `resolveStrict`), set `force: true` on the `will install` row (FSTAT-06). |

### Pattern 1: Closed-set token extension (the canonical recipe)

**What:** Add a status by extending the `as const` tuple, deriving the type via
indexed access, adding a union arm, and adding the render-switch arm.
**When to use:** Every new plugin status.
**Why it is safe:** `PluginStatus = (typeof PLUGIN_STATUSES)[number]` plus the
`assertNever` tail in `renderPluginRow` (notify.ts:1951) means a new tuple
member that lacks a render arm is a **compile error at the switch**. The
`notify-stamp-coverage` test also holds a compile-enforced switch over
`PLUGIN_STATUSES` (test header at line 51 states adding a token there is a
compile error) — both must gain arms.

```typescript
// Source: shared/notify.ts:371 (verified this session)
export const PLUGIN_STATUSES = [
  "installed", "updated", "reinstalled", "uninstalled", "available",
  "unavailable", "upgradable", "failed", "skipped", "manual recovery",
  "will install", "will uninstall", "will enable", "will disable", "disabled",
  // ADD: "force-installed", "force-upgradable"
] as const;
```

### Pattern 2: Glyph reuse for the clean-but-pending precedent

`force-upgradable` reuses `ICON_INSTALLED` (`●`) exactly as the existing
`upgradable` arm does (notify.ts:1879-1880) — the row is currently clean.
`force-installed` is the only new glyph (`◉`). This mirrors the documented
glyph-sharing precedent in the file (notify.ts:1282: "`●` for `(installed)` /
`(will install)`").

### Pattern 3: `will force install` is a MODIFIER, not a closed-set token

`STATUS_TOKENS` grows by exactly 2 (the two realized statuses), NOT 3. The
pending `will force install` is rendered by the existing `"will install"`
discriminator with a new boolean field — it is NOT a separate `StatusToken`.
This is why D-66-05 specifies 20→22 (not 23). The `notify-grammar-invariant`
`WILL_TOKEN_RE` (test line 219) must widen to allow `will force install`.

### Anti-Patterns to Avoid
- **Re-resolving the OLD installed version no-network.** The marketplace clone
  is at HEAD after `marketplace update`; the installed version's manifest is
  gone. `resolveStrict(manifestEntry)` resolves the CANDIDATE, never the
  historical installed version. Use `record.compatibility` for current-version
  supportability.
- **A persisted `forceInstalled` flag or state migration.** Explicitly
  forbidden (D-66-01, REQUIREMENTS Out-of-Scope: the v1.15 sticky flag was built
  and removed). `compatibility` already exists — reuse it; do not add a field.
- **Designing a `will force update` surface.** Vacuous — the reconcile plan has
  no update bucket (verified: `ReconcilePlan` has 7 buckets, none for updates,
  types.ts:203-211). Document the absence.
- **Splitting the token/glyph change from the catalog + tripwire change across
  commits.** The catalog-UAT byte gate and the closed-set tripwire will go RED
  between commits. Land atomically (65.1 precedent, commit 5e102920).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-kind dropped-component markers for `info` | A new `{kind→reason}` map | `narrowUnsupportedKinds` (probe-classifiers.ts:146) | Single shared render-time helper (D-64-02) — list/info/install already route through it; cross-surface parity is by construction. |
| No-network candidate resolution | A custom manifest re-parse | `resolveStrict` (resolver.ts:948) | Already the no-network resolver; returns the three-way `state` the deriver needs; guarded by `no-orchestrator-network` test. |
| Current-version supportability | A re-resolve of installed artifacts | `record.compatibility.{installable,unsupported}` (state-io.ts:57-62) | Persisted at install time; the only no-network-reliable signal once the clone advances. |
| Exhaustiveness enforcement | Manual "did I cover every status" review | `assertNever` tails (renderPluginRow:1951, pluginInfoStatusGlyph:2715, projectRowStatus, stamp-coverage switch) | The compiler enumerates missing arms for you. |

**Key insight:** Almost every part of this phase is mechanical tuple/switch
extension. The compiler + the closed-set tripwire tests will surface every site
that must change. The only judgment call is the deriver's data source (resolved
above).

## Runtime State Inventory

This is a rename-free, migration-free derivation phase. The inventory is
included because the phase touches persisted-state SEMANTICS (it reads
`compatibility`), but it adds and migrates nothing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per-plugin `compatibility` field (installable/supported/unsupported/notes) is READ by the new deriver. | None — read-only. No schema change, no migration. The field already exists (state-io.ts:57-62). |
| Live service config | None — no external service holds force-state. | None — verified: force-state is purely derived at render time. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | None — code/docs/tests only. | None. |

**Critical confirmation:** No persisted `forceInstalled` flag is added; no
`state.json` schema bump; no migration. FSTAT-01 / D-66-01 satisfied by reading
the EXISTING `compatibility` record.

## Common Pitfalls

### Pitfall: Treating `resolveStrict(manifestEntry)` as the CURRENT version's resolve
**What goes wrong:** A force-installed plugin with a newer available version
would be mis-classified, because resolving the HEAD manifest entry tells you
about the candidate, not the installed (older) version.
**Why it happens:** The marketplace clone advances to HEAD on `marketplace
update`; the installed version is no longer on disk.
**How to avoid:** force-installed comes from `record.compatibility`; the
candidate `resolveStrict` is used ONLY to split clean+upgradable into
upgradable vs force-upgradable.
**Warning sign:** Any deriver branch that calls `resolveStrict` to decide
force-INSTALLED (rather than force-UPGRADABLE) is wrong.

### Pitfall: Forgetting a render/projection/coverage site (compile-caught, but plan for it)
**What goes wrong:** Adding a `PLUGIN_STATUSES` member without updating every
exhaustive switch fails the typecheck.
**Why it happens:** There are at least four `assertNever`-guarded sites:
`renderPluginRow` (1951), `pluginInfoStatusGlyph` (2715), `tools.ts
projectRowStatus`, and `notify-stamp-coverage`'s switch.
**How to avoid:** Plan tasks to touch all four; let `npm run typecheck` (part of
`npm run check`) enumerate any missed site.
**Warning sign:** `Argument of type '"force-installed"' is not assignable to
parameter of type 'never'`.

### Pitfall: Catalog-UAT / tripwire RED between commits
**What goes wrong:** `notify-closed-set-locks` asserts exact lengths (20/15/7/32
today, test lines 29-42); `catalog-uat` asserts byte equality against
`docs/output-catalog.md`. Changing tuples without updating both in the same
commit breaks `npm run check`.
**Why it happens:** The byte contract couples source, tests, and prose docs.
**How to avoid:** Land the tuple bump (20→22, 15→17), render arms, every coupled
test, and any new catalog example + its FIXTURES entry as ONE green commit
(65.1 / commit 5e102920 precedent).
**Warning sign:** A commit that touches `STATUS_TOKENS` but not
`notify-closed-set-locks.test.ts`.

### Pitfall: `installedRowMessage` is synchronous today
**What goes wrong:** Adding a `resolveStrict` (async) inside the currently-sync
`installedRowMessage` (list.ts:232) forces a signature change.
**How to avoid:** Either make it `async` and `await` it in the already-async
`enumerateMarketplacePlugins` loop (453-465), or resolve the candidate in the
caller and pass the resolved state down. Either is fine — note that
`availableRowMessage` (340) is already async and resolves, so the async loop
shape exists.

## Code Examples

### The current upgradable computation (the seam to extend)
```typescript
// Source: orchestrators/plugin/list.ts:241 (verified this session)
const upgradable =
  manifestEntry?.version !== undefined && manifestEntry.version !== record.version;
// ...
if (upgradable) {
  return { status: "upgradable", name: pluginName, reasons: [], version: record.version, ... };
}
return { status: "installed", name: pluginName, dependencies: ..., version: record.version, ... };
```
The deriver inserts, BEFORE the `upgradable` branch, a force-installed check on
`record.compatibility`, and WITHIN the upgradable branch a no-network
`resolveStrict(manifestEntry)` to split upgradable vs force-upgradable.

### The persisted compatibility record (the force-installed signal)
```typescript
// Source: persistence/state-io.ts:57 (verified this session)
compatibility: Type.Object({
  installable: Type.Boolean(),
  notes: Type.Array(Type.String()),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
}),
```
`force-installed ⟺ recorded-installed AND compatibility.unsupported.length > 0`
(equivalently `installable === false` for the component-degraded case; a
structurally `unavailable` plugin would not have been installable at all).

### The exhaustive render switch tail (the enforcement lever)
```typescript
// Source: shared/notify.ts:1951 (verified this session)
default: {
  assertNever(p);
  return "";
}
```

## State of the Art

| Old Approach (pre-65.1, discarded plans) | Current Approach (post-65.1) | Impact |
|------------------------------------------|------------------------------|--------|
| `STATUS_TOKENS = 22`, `MARKETPLACE_STATUSES = 9` (marketplace `will add`/`will remove` present) | `STATUS_TOKENS = 20`, `MARKETPLACE_STATUSES = 7` (marketplace will-tokens retired in 65.1, commit 5e102920) | Phase 66 bumps stack on 20, not 22 → 20→22 for the two new plugin statuses. |
| `will force update` considered a real preview token | Vacuous — reconcile has no update bucket | Implement only `will force install`; document the `will force update` absence (D-66-05). |
| `will install` as plain token | `will install` + a `force?` modifier renders `will force install` | No new closed-set member for the force-pending case. |

**Deprecated/outdated:**
- The four discarded Phase 66 plans (`66-01..04-PLAN.md` listed in ROADMAP) —
  built on pre-65.1 closed-set sizes and marketplace will-tokens. Ignore them.

## Validation Architecture

> nyquist_validation = true (verified `.planning/config.json`). Test runner:
> `node --test`; gate: `npm run check` (typecheck + lint + format + test +
> test:integration). Tests live under repo-root `tests/`, NOT under
> `extensions/`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict` |
| Config | none (glob in `package.json` `test` script) |
| Quick run | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` |
| Full suite | `npm run check` (serialize with `TEST_CONCURRENCY=1` to avoid the known temp-dir cleanup races noted in 65.1) |

### Phase Requirements → Test Map (critical behaviors to validate)
| Req | Behavior to validate | Test type | Where / command |
|-----|----------------------|-----------|------------------|
| FSTAT-01 | **Derivation purity** — same (record, candidate-state) inputs yield same status; no flag written | unit | `tests/orchestrators/plugin/list.test.ts` — assert force-installed derived from `compatibility.unsupported` with NO state write. |
| FSTAT-01/03 | **Auto-return to installed** — a record whose `compatibility` is clean after a supported upgrade renders `installed` | unit | list deriver test: clean compatibility + installable candidate → `installed`. |
| FSTAT-02 | **Glyph distinctness** — force-installed renders `◉`, distinct from `●` | unit (byte) | `tests/shared/notify-v2.test.ts` render assertion; `tests/architecture/catalog-uat.test.ts` byte block. |
| FSTAT-04 | **force-upgradable = clean current + degrading candidate**, AND **exclusion of force-installed** | unit | list deriver test matrix: (clean + candidate unsupported)→force-upgradable; (compatibility unsupported + any candidate)→force-installed (never force-upgradable). |
| FSTAT-04 | force-upgradable wears `●` | unit (byte) | notify-v2 / catalog-uat. |
| FSTAT-05 | **No-network candidate resolve** | architecture | `tests/architecture/no-orchestrator-network.test.ts` must stay green with the new `resolveStrict` call in `list`. |
| FSTAT-06 | **`will force install` token** rendered by the `will install` arm under `force: true`; subject-first grammar holds | unit + invariant | `tests/architecture/notify-grammar-invariant.test.ts` — widen `WILL_TOKEN_RE`; assert `(will force install)` row. |
| FSTAT-06 | **`will force update` absence** — reconcile emits no update/force-update row | unit | `tests/orchestrators/reconcile/*.test.ts` — assert no update bucket / token. |
| FSTAT-07 | **info dropped-component detail** + force-installed status | unit | `tests/orchestrators/plugin/info.test.ts` — installed+unsupported → `force-installed` row with `narrowUnsupportedKinds` markers. |
| FSTAT-07 | **Success-row wording** — force install/update success row reads "force-installed" | unit | install/update orchestrator tests — `resolved.state === "unsupported"` → success row status `force-installed`. |
| D-66-05 | **Closed-set tripwire bumps** | architecture | `tests/architecture/notify-closed-set-locks.test.ts` — assert `STATUS_TOKENS=22`, `PLUGIN_STATUSES=17`, `MARKETPLACE_STATUSES=7` (unchanged), `REASONS=32` (unchanged). |

### Sampling Rate
- **Per task commit:** `node --test "tests/architecture/notify-closed-set-locks.test.ts" "tests/shared/notify-v2.test.ts"`
- **Per wave merge:** `node --test "tests/architecture/**/*.test.ts" "tests/orchestrators/plugin/**/*.test.ts" "tests/orchestrators/reconcile/**/*.test.ts"`
- **Phase gate:** `npm run check` green (TEST_CONCURRENCY=1).

### Wave 0 Gaps
- None — existing test infrastructure (notify-closed-set-locks, catalog-uat,
  notify-grammar-invariant, notify-stamp-coverage, notify-v2, list/info/reconcile
  orchestrator tests) covers all phase behaviors. New CASES are added to those
  existing files; no new framework/config/fixture file is required.
- **Lockstep reminder:** any new force-installed/force-upgradable catalog example
  added to `docs/output-catalog.md` requires a matching `FIXTURES` entry in
  `tests/architecture/catalog-uat.test.ts` in the SAME commit.

## Security Domain

Not applicable to this phase. No authentication, session, access-control,
cryptography, or input-validation surface is touched — it renders derived
display state from already-validated persisted records and already-validated
resolver output. No new input parsing. V5 (input validation) continues to be
owned upstream by typebox schema validation of `state.json` (state-io.ts) and
the resolver; this phase adds no new external input. The only invariant of note
is NFR-5 (no network on `list`/`info`/pending), enforced by the existing
`no-orchestrator-network` architecture test — covered under Validation above.

## Project Constraints (from CLAUDE.md)

- **IL-2:** All user-visible output through `ctx.ui.notify(message, severity)` —
  the new rows render through the existing `notify()` path; no direct stdout.
- **NFR-5 (network policy):** `list` / `info` / pending MUST NOT touch the
  network — the candidate `resolveStrict` is the cache/no-network resolver;
  guarded by the `no-orchestrator-network` test.
- **NFR-6 (quality bar):** `npm run check` must stay green — drives the lockstep
  requirement.
- **NFR-7 (resolver discriminated state):** The `unsupported` arm carries
  `pluginRoot` + component lists; `unavailable` never does. The deriver only
  reads `state === "unsupported"` and the component lists — it never reaches for
  `pluginRoot` on an `unavailable` plugin.
- **Comment/test-title policy (`.claude/rules/typescript-comments.md`):** Use
  `D-66-NN` / `FSTAT-NN` / `NFR-N` / `SNM-NN` IDs in comments and test titles;
  NEVER GSD phase/plan references.
- **Git:** never commit to main; conventional commits; `pre-commit run` before
  commit; ASCII-only commit messages (no em dashes — the `fix-unicode-dashes`
  hook rejects them); `SKIP=trufflehog` only when committing from a worktree.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | force-installed is best derived by reading `record.compatibility.unsupported` (the persisted install-time resolution), NOT by re-resolving the installed version | Deriver / Summary | If the planner instead expects a live re-resolve of the current version, the design changes — but a live re-resolve is impossible no-network once the clone advances, so A1 is strongly supported by NFR-5. Confirm the planner adopts `compatibility` as "the recorded resolver state" per D-66-01's wording. |
| A2 | `will force install` is a render-time modifier (`force?: boolean` on `PluginWillInstallMessage`), not a new `STATUS_TOKEN` | Pattern 3 | If it were a new token, the tripwire would be 20→23, contradicting D-66-05's explicit 20→22. A2 is required for the stated tripwire to hold. |
| A3 | The `--installed` filter spanning `force-installed` (LIST-01) is Phase 67, so Phase 66's `shouldShow`/filter changes are limited to making the new statuses RENDER, not FILTER | Component table | If the planner pulls LIST-01 forward, scope grows. Keep Phase 66 to derivation + render per the phase boundary. |
| A4 | `force-upgradable` exclusion-of-force-installed is achieved by checking `record.compatibility` FIRST (force-installed wins), before the candidate-resolve branch | Deriver | If ordering is reversed, a force-installed plugin with a degrading candidate could mis-render force-upgradable. Order is load-bearing. |

## Open Questions (RESOLVED)

1. **Should the deriver also re-resolve to catch an EXTENSION-support-boundary
   change (vs. reading stale `compatibility`)?**
   - RESOLVED: Leave it to Phase 68 (load-time backfill). Phase 66 reads
     `compatibility` for steady-state display; FSTAT-03's in-scope auto-return is
     a plugin VERSION upgrade that rewrites `compatibility` and works correctly.
   - What we know: `compatibility` is written at install/upgrade time. If the
     EXTENSION later gains support for a previously-unsupported kind, the stale
     `compatibility` would still show force-installed until re-materialized.
   - What's unclear: whether Phase 66 should reflect that live, or leave it to
     Phase 68 (load-time backfill, gated on `lastReconciledExtensionVersion`).
   - Recommendation: **Leave it to Phase 68.** BFILL-01/02 explicitly own the
     extension-version-boundary case; Phase 66 reads `compatibility` for the
     steady-state display. FSTAT-03 (the in-scope auto-return case) is a plugin
     VERSION upgrade, which rewrites `compatibility` and works correctly.

2. **For the reconcile pending `will force install`, does the reconcile path
   actually force-install an `unsupported` declared plugin?**
   - What we know: FORCE-03 says non-`--force` install of `unsupported` blocks;
     reconcile installs declared+enabled plugins. The PENDING surface only needs
     to PREVIEW `will force install` when the planned install would degrade.
   - RESOLVED: Phase 66 implements the pending TOKEN derivation only (resolve the
     install candidate no-network; `force: true` when `unsupported`). Whether
     reconcile-apply actually degrades is a separate concern; do not expand scope.

3. **info surface: add `force-installed` to `PluginInfoRowBase.status` or map it
   at render?**
   - What we know: the info row status is an inlined `Extract<PluginStatus,...>`
     (notify.ts:1043), deliberately NOT the full set.
   - RESOLVED: Widen the Extract to include `"force-installed"` and add the
     `pluginInfoStatusGlyph` arm. `force-upgradable` is a LIST-only concept (an
     installed plugin's info is force-installed or installed, never
     force-upgradable), so info needs only `force-installed`.

## Sources

### Primary (HIGH confidence — read live this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` — STATUS_TOKENS (198-219),
  PLUGIN_STATUSES (371-387), MARKETPLACE_STATUSES (402-410), REASONS (89-130),
  ICON_* (1272-1285), renderPluginRow switch (1798-1955), PluginWillInstallMessage
  (740-744), PluginInfoRowBase (1042-1049), pluginInfoStatusGlyph (2704-2718),
  PL-4 filter (3168-3182).
- `extensions/pi-claude-marketplace/persistence/state-io.ts` —
  PLUGIN_INSTALL_RECORD_SCHEMA.compatibility (54-73).
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` —
  installedRowMessage (232-305), availableRowMessage (340-415),
  enumerateMarketplacePlugins (440-493), PluginRenderStatus/shouldShow (101-146).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — three-way union
  (64-136), resolveStrict (948), requireForceInstallable (1110).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — force gate
  (491-505), success row (1391-1411).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — candidate
  force gate (735-745).
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — resolve +
  narrowUnsupportedKinds (33-52, 523-595).
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{types,notify,plan}.ts`
  — ReconcilePlan 7 buckets, no update bucket (types.ts:203-216); pending
  projection (notify.ts:248-335).
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — projectRowStatus
  (159-177).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` —
  narrowUnsupportedKinds (146-160).
- `tests/architecture/notify-closed-set-locks.test.ts` — current tripwires
  (REASONS=32, STATUS_TOKENS=20, PLUGIN_STATUSES=15, MARKETPLACE_STATUSES=7).
- `tests/architecture/catalog-uat.test.ts` — byte-equality runner reading
  `docs/output-catalog.md` (1-90).
- `tests/architecture/notify-grammar-invariant.test.ts` — WILL_TOKEN_RE (219).
- `.planning/phases/65.1-.../65.1-02-SUMMARY.md` — the 20/7 retirement + lockstep
  precedent (commit 5e102920).
- `.planning/config.json` — nyquist_validation: true.

### Secondary (MEDIUM confidence)
- ROADMAP Phase 66 success criteria + the STALE discarded-plan list (ignored per
  objective).

## Metadata

**Confidence breakdown:**
- Closed-set / glyph / render mechanics: HIGH — every tuple, switch, and tripwire
  read live; the extension recipe is the established codebase pattern.
- Deriver data source (compatibility vs re-resolve): HIGH on the no-network
  constraint forcing `compatibility`; flagged as A1 for planner confirmation.
- Surface threading (info/success/pending): HIGH — all seams located and read.
- `will force update` vacuity: HIGH — verified the reconcile plan has no update
  bucket.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable internal codebase; re-verify if notify.ts or
the reconcile plan shape changes before planning).
