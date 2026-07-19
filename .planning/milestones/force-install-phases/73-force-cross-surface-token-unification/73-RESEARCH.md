# Phase 73: Force Cross-Surface Token Unification - Research

**Researched:** 2026-06-29
**Domain:** TypeScript discriminated-union render layer (notification grammar) — pi-claude-marketplace
**Confidence:** HIGH (contained, self-verified against the live post-Phase-72 tree; every claim carries file:line evidence)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Resolver-state-driven token everywhere (LOCKED — extends Phase 72 / D-64-01):** the render token follows `resolved.state`: `unsupported` → `⊖ (unsupported)`; structural `unavailable` → `⊘ (unavailable)`. Already true on `list`/`info` not-installed rows (Phase 72); this phase brings the install-failure and update-decline surfaces (and the `info.ts` non-resolvable arm) into line. `⊘` / `ICON_UNINSTALLABLE` stays RESERVED for genuine `unavailable` / blocked / failed rows.
- **XSURF-01 — install-failure surface:** when `install` (no `--force`) fails on an `unsupported` plugin, the cascade row renders `⊖ (unsupported)` (not `⊘ (unavailable)`) and KEEPS the SEV-02 `--force` hint trailer. A genuinely `unavailable` install failure keeps `⊘ (unavailable)` with no hint (catalog `failure-unavailable-structural` — unchanged).
- **XSURF-02 — `info.ts` non-resolvable arm (IN-01):** the non-locally-resolvable branch derives its status from `resolved.state` (mirroring the path-source arm) instead of hardcoding `"unavailable"`. Same de-collapse rule as Phase 72.
- **XSURF-03 — update-decline framing (LOCKED by maintainer):** a force-upgradable `update` decline (no `--force`) must NOT render `(skipped) {no longer installable}` (misleading — the plugin IS installable with `--force`). **Decision: reuse the `force-upgradable` framing** rather than minting a new `(skipped)` reason. The declined update renders consistently with how `list` describes the same plugin (`(force-upgradable)` concept) and guides the user to `--force`. Severity stays per SEV-04 (targeted=warning, bulk=info) — do NOT touch the cardinality logic. Only the token/reason framing changes.

### Claude's Discretion (research recommendations within the lock)
- The exact composition mechanism for XSURF-03 ("reuse force-upgradable framing"): whether to flip the decline row to `status: "force-upgradable"` + a `--force` trailer, or keep `status: "skipped"` and swap the reason + add a trailer. This research RECOMMENDS the `force-upgradable` token flip (Option A below) — it is the larger, most cross-surface-consistent reading the maintainer explicitly chose.
- The `--force` trailer wording for the update-decline surface (the existing `FORCE_INSTALL_HINT_TRAILER` is install-worded; an update-decline likely needs an update-worded analog).

### Deferred Ideas (OUT OF SCOPE)
- Bulk-update grammar (up-to-date no-op suppression, success-count semantics) is Phase 74 (UGRM-01..02), not this phase.
- Severity is NOT changed: SEV-02 (install error +/- hint) and SEV-04 (update decline targeted=warning/bulk=info) are correct and verified. This phase moves the token + reason WORDING only, never severity. Do NOT modify `cascadeSkipSeverity` (the function the orchestrator brief calls `decideUpdateSkipSeverity`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XSURF-01 | The install-failure surface renders an `unsupported` (force-installable) plugin with `⊖ (unsupported)`, not `⊘ (unavailable)`; the SEV-02 `--force` hint is preserved. | Edit map §XSURF-01 (install.ts collapse + `PluginUnsupportedMessage.forceHint?` + trailer gate widen + `INSTALL_STATUSES`). |
| XSURF-02 | `info.ts`'s non-locally-resolvable arm derives status from `resolved.state` (matching `list`) instead of hardcoding `"unavailable"` (IN-01). | Edit map §XSURF-02 (info.ts:1045-1056, mirror the path-arm at info.ts:990 + the reason-source split). |
| XSURF-03 | A manual `update` decline of a force-upgradable plugin surfaces a force-aware reason (not `{no longer installable}`) and points at `--force`; SEV-04 split (targeted=warning, bulk=info) preserved. | Edit map §XSURF-03 (update message projection + `force-upgradable` token in `UPDATE_STATUSES` + trailer + severity-keying preservation). |
</phase_requirements>

## Summary

Phase 72 already built the entire `unsupported` render vocabulary: `STATUS_TOKENS`/`PLUGIN_STATUSES` carry `"unsupported"` (23/18 entries), `ICON_UNSUPPORTED = "⊖"` exists, `PluginUnsupportedMessage` exists, `renderPluginRow` has an `unsupported` arm (notify.ts:2065-2077), `pluginInfoStatusGlyph` returns `⊖` for it, and `projectRowStatus` maps it to `"unavailable"`. The `force-upgradable` vocabulary likewise already exists (`STATUS_TOKENS`/`PLUGIN_STATUSES` entry, `PluginForceUpgradableMessage`, `renderPluginRow` arm at notify.ts:2082-2086 reusing `ICON_INSTALLED`). **This phase mints NO new closed-set members for XSURF-01/02. XSURF-03's recommended Option A reuses the existing `force-upgradable` token and ALSO needs no closed-set bump.** The closed-set tripwire (`tests/architecture/notify-closed-set-locks.test.ts`: REASONS=32, STATUS_TOKENS=23, PLUGIN_STATUSES=18, MARKETPLACE_STATUSES=7) **stays unchanged** under the recommended design.

The work is three localized producer-side flips plus their byte-exact catalog/test reconciliation:

1. **XSURF-01** — `install.ts`'s `composeInstallFailureMessage`/`composeUnavailableMessage` route the force-degradable arm into `status: "unavailable"` + `forceHint: true` today (install.ts:1516-1528, 1587-1590). Flip the **force-degradable** arm (`entityErrorRow.forceable === true`) to `status: "unsupported"` while keeping `forceHint`. This needs: (a) add an optional `forceHint?: boolean` to `PluginUnsupportedMessage` (Phase 72 deliberately omitted it, notify.ts:703-704); (b) widen the `--force` trailer gate (notify.ts:3422) to fire on `unsupported` too; (c) add `"unsupported"` to `INSTALL_STATUSES` + an `unsupported` arm to `INSTALL_RENDER` (install.messaging.ts:39, 69-96).

2. **XSURF-02** — `info.ts:1045-1056` (the `!isLocallyResolvable(parsedSource)` arm) hardcodes `status: "unavailable"`. Mirror the path-source arm at info.ts:990: derive status AND reasons from `resolved.state` (an `unsupported` resolution sources reasons via `narrowUnsupportedKinds(resolved.unsupported)`, a structural `unavailable` via `narrowResolverNotes(resolved.notes)`). Currently masked (non-path sources never resolve `unsupported`), so this is latent-divergence repair, not a live-byte change.

3. **XSURF-03** — the manual `update` (no `--force`) decline emits `partition: "skipped"` + `reasons: ["no longer installable"]` (update.ts:768-776), projected to `status: "skipped"` (update.ts:1675-1697) and rendered `⊘ … (skipped) {no longer installable}`. Recommended Option A: project this decline to `status: "force-upgradable"` (the same token `list` uses for the same plugin) with a force-aware reason and a `--force` trailer, keeping the cardinality severity. This requires adding `"force-upgradable"` to `UPDATE_STATUSES` + render arm (update.messaging.ts:30, 52-70) and an update-worded `--force` trailer.

**Primary recommendation:** Follow the resolver-state-split precedent at each producer. For XSURF-01/02, mirror the Phase-72 `availableRowMessage`/`buildNotInstalledPathRow` pattern (split on `forceable`/`resolved.state`, source reasons from the typed kind list). For XSURF-03, take Option A (flip the decline to the existing `force-upgradable` token) — it is the maintainer's explicit "reuse the framing" choice and needs no closed-set bump. The single most delicate constraint is that `cascadeSkipSeverity` (update.ts:1578-1591) currently keys severity on `reasons.includes("no longer installable")`; the XSURF-03 change MUST keep the severity decision firing for the declined row even as the rendered reason wording changes (see Pitfall 3).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolver three-way state (`installable`/`unsupported`/`unavailable`) | Domain (`domain/resolver.ts`) | — | Read-only this phase; `decideResolution` + `forceable: r.state === "unsupported"` (resolver.ts:1177) already encode the distinction. |
| Render status → glyph/token + `--force` trailer | Shared render (`shared/notify.ts`) | — | Sole owner of the grammar vocabulary (closed sets, `renderPluginRow`, the `forceHint`/trailer gate). |
| Install-failure status collapse (`forceable` → token) | Orchestrator (`orchestrators/plugin/install.ts`, `install.messaging.ts`) | Shared render | XSURF-01 collapse point; `composeUnavailableMessage` currently flattens both arms onto `unavailable`. |
| Info non-resolvable status derivation | Orchestrator (`orchestrators/plugin/info.ts`) | Shared render | XSURF-02 collapse point; the non-path arm hardcodes `unavailable`. |
| Update-decline reason/token projection | Orchestrator (`orchestrators/plugin/update.ts`, `update.messaging.ts`) | Shared render | XSURF-03 collapse point; `outcomeToCascadePluginMessage` projects the decline onto `skipped`. |
| Decline severity (cardinality) | Orchestrator (`update.ts::cascadeSkipSeverity`) | — | LOCKED unchanged — keys on `reasons.includes("no longer installable")`. |
| LLM-tool status projection | Edge (`edge/handlers/tools.ts::projectRowStatus`) | — | `unsupported` (tools.ts:177-181) and `force-upgradable` (tools.ts:170-172) arms ALREADY exist — no edit unless XSURF-03 introduces a new status (it does not under Option A). |

## Standard Stack

No new dependencies. Pure first-party TypeScript edits within the existing extension. Toolchain (verified from `package.json`): TypeScript strict (`tsc --noEmit`), ESLint 10 flat config, Prettier 3, `node:test` runner. Quality gate: `npm run check` (typecheck + lint + format:check + test + test:integration).

## Package Legitimacy Audit

Not applicable — no external packages are installed by this phase. Code-only change within the existing first-party extension.

## Architecture Patterns

### Pattern: producer-side resolver-state split (the Phase-72 precedent)
Phase 72 split `availableRowMessage` (list.ts) and `buildNotInstalledPathRow` (info.ts) on `resolved.state` so the `unsupported` arm emits `status: "unsupported"` (reasons via `narrowUnsupportedKinds`) and the `unavailable` arm keeps `status: "unavailable"` (reasons via `narrowResolverNotes`). XSURF-01 and XSURF-02 apply the SAME split to two more producers. The discriminant differs by surface:
- **install.ts:** the resolver throws `PluginShapeError`; `classifyEntityShapeError` already threads `forceable: err.shape.forceable` (install.ts:1704) onto `EntityErrorRow`. `forceable === true` ⇔ resolver verdict `unsupported`. So split on `entityErrorRow.forceable`, NOT on the reason brace.
- **info.ts non-path arm:** `resolved.state` is in scope directly (info.ts:1045 narrows `resolved.state !== "installable"`). Split on `resolved.state === "unsupported"`.

### Pattern: install-failure surface carries `forceHint`, list/info do not
The install-failure `unsupported` row is the FIRST `unsupported` row that needs a `--force` trailer. Phase 72 deliberately omitted `forceHint?` from `PluginUnsupportedMessage` (notify.ts:703-704) because the list/info rows render byte-frozen with no trailer. XSURF-01 adds `forceHint?: boolean` to `PluginUnsupportedMessage` and widens the trailer gate (notify.ts:3422) from `p.status === "unavailable"` to `(p.status === "unavailable" || p.status === "unsupported")`. List/info producers never set `forceHint`, so their rows stay byte-frozen.

### Pattern: command-local status sets gate each surface's vocabulary (D-10)
Each command declares a private `*_STATUSES` tuple + a render map total over it (`INSTALL_STATUSES`/`INSTALL_RENDER`, `UPDATE_STATUSES`/`UPDATE_RENDER`). Adding a status a command can emit requires BOTH the tuple entry AND the render-map arm (omitting the arm is a TS2741 compile error at the `satisfies` site). XSURF-01 adds `"unsupported"` to `INSTALL_STATUSES`; XSURF-03 Option A adds `"force-upgradable"` to `UPDATE_STATUSES`. The render-map arm bodies are lifted VERBATIM from the central `renderPluginRow` switch (D-11 "call, never duplicate").

### Anti-Patterns to Avoid
- **Splitting the install/info arms on the reason brace.** `{unsupported hooks}` appears on BOTH `unsupported` and structural `unavailable` rows. Split on `forceable` (install) / `resolved.state` (info), never on the reason.
- **Touching `cascadeSkipSeverity` cardinality logic (update.ts:1578-1591).** SEV-04 is locked. The severity decision keys on `reasons.includes("no longer installable")`; preserve that signal (see Pitfall 3).
- **Minting a new `(skipped)` reason for XSURF-03.** The maintainer explicitly chose the `force-upgradable` framing over a `{needs --force}` / `{would degrade}` reason-brace swap.
- **Bumping the closed-set tripwire.** Under the recommended design no closed set grows — both `unsupported` and `force-upgradable` already exist. Do not edit `notify-closed-set-locks.test.ts` counts.

## XSURF-01 — Install-failure token flip (exact edit map)

**Goal:** a no-`--force` install of an `unsupported` plugin renders `⊖ … (unsupported) {reasons}` + the `--force` trailer; a structural `unavailable` install keeps `⊘ … (unavailable)` with no trailer.

| # | File:line | Site | Edit |
|---|-----------|------|------|
| 1 | `shared/notify.ts:709-715` | `PluginUnsupportedMessage` interface | Add `readonly forceHint?: boolean;` (mirror `PluginUnavailableMessage.forceHint?` at notify.ts:694). Update the doc comment (currently says "DELIBERATELY OMITS the `forceHint?` field" at notify.ts:703-704) to note the install-error surface now sets it. |
| 2 | `shared/notify.ts:3422` | `--force` trailer gate | Widen `if (p.status === "unavailable" && p.forceHint === true)` to `if ((p.status === "unavailable" || p.status === "unsupported") && p.forceHint === true)`. The trailer literal `FORCE_INSTALL_HINT_TRAILER` (notify.ts:2228, "Re-run with --force to install the supported components.") is correct for both — it is install-worded and D-70-01-frozen. |
| 3 | `orchestrators/plugin/install.ts:168-179` | `EntityErrorRow.status` | Widen `status: Extract<StatusToken, "failed" \| "unavailable">` to add `"unsupported"`. (Or leave `EntityErrorRow.status` as the classifier-level `unavailable` and branch at compose time — see Note A.) |
| 4 | `orchestrators/plugin/install.ts:1516-1529` | `composeUnavailableMessage` | Split: when `entityErrorRow.forceable === true`, return `status: "unsupported"` with `forceHint: true` + `severity: "error"`; else keep `status: "unavailable"` (no `forceHint`) + `severity: "error"`. Both arms keep error severity (D-70-02). Rename/duplicate the helper as needed (e.g. `composeNotInstallableMessage`). |
| 5 | `orchestrators/plugin/install.ts:1587-1590` | `composeInstallFailureMessage` branch 3 | The `entityErrorRow.status === "unavailable"` guard routes into the compose helper. If Note A is taken (classifier still emits `unavailable`), this guard is the branch point; otherwise widen it to also catch the `unsupported` status. |
| 6 | `orchestrators/plugin/install.messaging.ts:39` | `INSTALL_STATUSES` | Add `"unsupported"` → `["installed", "force-installed", "failed", "unavailable", "unsupported"]`. |
| 7 | `orchestrators/plugin/install.messaging.ts:48-52` | `InstallMsg` union | Add `\| PluginUnsupportedMessage` (import it from `notify.ts`). |
| 8 | `orchestrators/plugin/install.messaging.ts:69-96` | `INSTALL_RENDER` map | Add an `unsupported` arm cloning the `unavailable` arm (lines 85-94) but swapping `ICON_UNINSTALLABLE`→`ICON_UNSUPPORTED` and `"(unavailable)"`→`"(unsupported)"`. The trailer is rendered by the central trailer composer (edit #2), not by the row arm. |

**Note A (discretion):** the cleanest split point is the COMPOSE helper (install.ts:1516), keeping `classifyEntityShapeError` returning `status: "unavailable"` (it is a classifier of the THROWN shape, not the render token). The compose helper reads `forceable` and chooses the render status. This minimizes the `EntityErrorRow` type change. Recommend this over widening `EntityErrorRow.status`.

**Severity is unchanged:** both arms stay `severity: "error"` (install failures must fire the summary line — D-70-02). Only the token + glyph move on the force-degradable arm. `computeSeverity` MAX-reduces the caller-stamped `error` (messaging-style-guide.md:136), so the `unsupported` install-failure row routes to error exactly as the `unavailable` one did.

## XSURF-02 — info.ts non-resolvable arm (exact edit map)

**Site:** `orchestrators/plugin/info.ts:1045-1056` — inside `buildNotInstalledRow`, the `if (!isLocallyResolvable(parsedSource))` branch.

**Current (info.ts:1046-1055):**
```ts
if (!isLocallyResolvable(parsedSource)) {
  const resolverReasons = narrowResolverNotes(resolved.notes);
  return {
    status: "unavailable",                       // ← hardcoded
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    ...(resolverReasons.length > 0 && { reasons: resolverReasons }),
    componentsResolved: false,
  };
}
```

**Fix:** derive status AND reason-source from `resolved.state`, mirroring the path-source arm (info.ts:990) and `buildNonInstallableRowFields` (info.ts:815-835):
```ts
if (!isLocallyResolvable(parsedSource)) {
  const reasons =
    resolved.state === "unsupported"
      ? narrowUnsupportedKinds(resolved.unsupported)
      : narrowResolverNotes(resolved.notes);
  return {
    status: resolved.state === "unsupported" ? "unsupported" : "unavailable",
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    ...(reasons.length > 0 && { reasons }),
    componentsResolved: false,
  };
}
```

**Type note:** at info.ts:1045 the union is already narrowed to `ResolvedPluginUnsupported | ResolvedPluginUnavailable` (the `resolved.state !== "installable"` guard), so `resolved.unsupported` is reachable on the `unsupported` arm. `narrowUnsupportedKinds` is already imported (used at info.ts:819, 864). **No new import.**

**Masking (verified, latent not live):** the comment at info.ts:1071-1075 records that non-path sources resolve structurally `unavailable` (no-network), never `unsupported` — so today this branch only ever sees `unavailable` and the byte output is UNCHANGED. The fix is latent-divergence repair (parity with the list surface, which switches on `resolved.state` for all sources via `availableRowMessage`). No catalog byte flips for XSURF-02; the existing `info-not-installed` catalog state (output-catalog.md:1336-1342) models a path-source structural case and stays `⊘ (unavailable)`.

## XSURF-03 — Update-decline framing (exact edit map + design)

**The UAT before-state:** `update demo-tool@demo-local` (no `--force`) on a force-upgradable plugin → `⊘ demo-tool v1.0.0 (skipped) {no longer installable}` (warning, targeted). Target: a force-aware reason consistent with `list`'s `(force-upgradable)` + `--force` guidance, SAME warning severity.

**Decline data flow (verified):**
1. Producer (update.ts:761-776): `requireInstallable` throws `PluginShapeError(kind: "no-longer-installable")`; the catch emits `partition: "skipped"`, `reasons: ["no longer installable"]`, `fromVersion: record.version`.
2. Severity (update.ts:1578-1591): `cascadeSkipSeverity` returns `cardinality === "single" ? "warning" : "info"` when `reasons.includes("no longer installable")`.
3. Projection (update.ts:1675-1697): the `skipped` partition → `status: "skipped"` + `reasons` + `severity: cascadeSkipSeverity(reasons, cardinality)`.
4. Render (update.messaging.ts:68): `pluginRow(ICON_UNINSTALLABLE, …, "(skipped)", …)` → `⊘ … (skipped) {no longer installable}`.

### Recommended: Option A — flip the declined row to the `force-upgradable` token

The maintainer's "reuse the `force-upgradable` framing" reads most naturally as: render the declined update with the SAME `(force-upgradable)` token + `●` glyph `list` uses for the same plugin, plus a `--force` trailer.

| # | File:line | Site | Edit |
|---|-----------|------|------|
| 1 | `orchestrators/plugin/update.ts:1675-1697` | `outcomeToCascadePluginMessage` `skipped` arm | When `reasons.includes("no longer installable")` (the force-upgradable decline — distinct from `not installed`/`not found`/`up-to-date`), return `status: "force-upgradable"` with the version (`fromVersion`), `reasons` (see #5), `severity: cascadeSkipSeverity(reasons, cardinality)` UNCHANGED, `needsReload: false`. Other `skipped` reasons keep `status: "skipped"`. |
| 2 | `orchestrators/plugin/update.messaging.ts:30` | `UPDATE_STATUSES` | Add `"force-upgradable"` → `["updated", "force-installed", "skipped", "force-upgradable", "failed"]`. |
| 3 | `orchestrators/plugin/update.messaging.ts:38-42` | `UpdateMsg` union | Add `\| PluginForceUpgradableMessage` (import from `notify.ts`). |
| 4 | `orchestrators/plugin/update.messaging.ts:52-70` | `UPDATE_RENDER` map | Add a `"force-upgradable"` arm: `pluginRow(ICON_INSTALLED, p, mpScope, "(force-upgradable)", probe)` — byte-identical to the central `renderPluginRow` arm at notify.ts:2082-2086. |
| 5 | reason choice | the declined row's `{…}` brace | DECISION POINT: keep `{no longer installable}` (then `cascadeSkipSeverity` is untouched and the severity keying still works) OR introduce a force-aware reason. The catalog target should read consistently with `list (force-upgradable)`. RECOMMEND: keep the existing closed-set reason `"no longer installable"` UNLESS the maintainer wants a new brace — a new reason would bump `REASONS` 32→33 AND require re-keying `cascadeSkipSeverity` (Pitfall 3). The `force-upgradable` TOKEN flip alone already removes the misleading `(skipped)` framing. |
| 6 | `--force` trailer for update-decline | `shared/notify.ts` | The `force-upgradable` token has no trailer today. To "point the user at `--force`", add a trailer. The existing `FORCE_INSTALL_HINT_TRAILER` ("Re-run with --force to install the supported components.") is install-worded; an update-decline likely wants an update-worded analog (e.g. "Re-run with --force to update with the supported components."). This is a NEW frozen DOC string → add to output-catalog.md + messaging-style-guide.md. Gate it on a marker — recommend a `forceHint?: boolean` on `PluginForceUpgradableMessage` (mirrors the XSURF-01 pattern) set only on the update-decline producer, so the list-inventory `force-upgradable` row stays byte-frozen (no trailer). |

**Closed-set impact (Option A, recommended reason choice = keep `"no longer installable"`):** `force-upgradable` already in `STATUS_TOKENS`/`PLUGIN_STATUSES`; `no longer installable` already in `REASONS`. **No tripwire bump.** `projectRowStatus` already has a `force-upgradable` arm (tools.ts:170-172 → `installed`-bucket) — but note the declined update row now traverses `projectRowStatus` only if it reaches the tool surface; the manual update cascade is a notify surface, so verify whether the update path projects through `tools.ts` at all (it does not for the cascade body — `projectRowStatus` is the LLM-tool list payload). No edit.

**Caveat on reusing `force-upgradable` (verify in planning):** `PluginForceUpgradableMessage` is documented "STRUCTURALLY list-only" (notify.ts:765-766) and carries `scope?` but the `force-upgradable` render arm uses `pluginRow`, which renders the `version` slot and `scope` bracket. The update-decline producer supplies `fromVersion` + `target.scope`. Confirm the rendered bytes (`● demo-tool v1.0.0 (force-upgradable) {…}`) match the intended catalog form, and that emitting `force-upgradable` from `update` does not violate the "list-only" invariant any architecture test enforces (grep `force-upgradable` in `tests/architecture/`).

### Alternative: Option B — keep `status: "skipped"`, swap reason + trailer

Keep `(skipped)` / `⊘` but replace `{no longer installable}` with a force-aware reason (e.g. `{would degrade}` or `{needs --force}`) and add the trailer. This is the SMALLER change the maintainer explicitly REJECTED in favor of the cross-surface-consistent Option A. Documented here only for completeness. It would bump `REASONS` 32→33 and re-key `cascadeSkipSeverity`.

**Recommendation:** Option A (force-upgradable token flip) with the reason kept as `"no longer installable"` (no `REASONS` bump, no severity re-keying) + a new update-worded `--force` trailer gated by a `forceHint?` flag on `PluginForceUpgradableMessage`. This is the minimal change that satisfies the lock: it removes the misleading `(skipped)` framing, renders the same `(force-upgradable)` token as `list`, points at `--force`, and leaves SEV-04 cardinality untouched.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reason braces for the flipped rows | A new reason mapper | `narrowUnsupportedKinds` (probe-classifiers.ts) on the unsupported arm; existing closed-set reasons elsewhere | Single shared helper guarantees byte-identical markers across surfaces (cross-surface reason parity). |
| Install force-degradable vs structural decision | Inline component-kind inspection | `entityErrorRow.forceable` (already threaded from `resolver.ts:1177`) | The resolver already stamped `forceable = (state === "unsupported")`; re-deriving re-introduces the D-64-01 bug. |
| Update force-upgradable decline token | A bespoke `(skipped)` variant | The existing `force-upgradable` token + `renderPluginRow` arm | The token, glyph, and message variant already exist (Phase 66); D-11 "call, never duplicate". |
| `--force` trailer plumbing | Manual string concat in the row arm | The central trailer composer (notify.ts:3415-3424) gated by a `forceHint?` flag | Keeps the trailer byte-frozen and out of the per-row render arms. |

## Blast Radius — exhaustive map

### Source edits

| Req | File:line | Edit |
|-----|-----------|------|
| XSURF-01 | `shared/notify.ts:709-715` | `PluginUnsupportedMessage` += `forceHint?: boolean` |
| XSURF-01 | `shared/notify.ts:3422` | trailer gate widen to include `unsupported` |
| XSURF-01 | `orchestrators/plugin/install.ts:1516-1529` | compose helper splits `forceable` → `unsupported` vs `unavailable` |
| XSURF-01 | `orchestrators/plugin/install.ts:1587-1590` | branch routing (Note A) |
| XSURF-01 | `orchestrators/plugin/install.messaging.ts:39, 48-52, 69-96` | `INSTALL_STATUSES` += `unsupported`; `InstallMsg` += variant; `INSTALL_RENDER` += arm |
| XSURF-02 | `orchestrators/plugin/info.ts:1045-1056` | non-path arm derives status + reasons from `resolved.state` |
| XSURF-03 | `orchestrators/plugin/update.ts:1675-1697` | `skipped` arm flips force-upgradable decline → `force-upgradable` token |
| XSURF-03 | `orchestrators/plugin/update.messaging.ts:30, 38-42, 52-70` | `UPDATE_STATUSES` += `force-upgradable`; `UpdateMsg` += variant; `UPDATE_RENDER` += arm |
| XSURF-03 | `shared/notify.ts` (`PluginForceUpgradableMessage` + trailer) | `forceHint?` flag + new update-worded trailer literal + gate |

### Non-sites (verified, NO edit needed)
- `shared/notify.ts` closed-set tuples (`STATUS_TOKENS`/`PLUGIN_STATUSES`/`REASONS`/`MARKETPLACE_STATUSES`) — `unsupported`, `force-upgradable`, and `no longer installable` ALL already present. **No tripwire bump.**
- `shared/notify.ts::renderPluginRow` — `unsupported` arm (2065-2077) and `force-upgradable` arm (2082-2086) already exist.
- `shared/notify.ts::pluginInfoStatusGlyph` — already returns `⊖` for `unsupported`.
- `edge/handlers/tools.ts::projectRowStatus` — `unsupported` (177-181) and `force-upgradable` (170-172) arms already exist.
- `update.ts::cascadeSkipSeverity` (1578-1591) — LOCKED unchanged (SEV-04); only verify the reason it keys on is preserved (Pitfall 3).
- `domain/resolver.ts` — read-only; `forceable: r.state === "unsupported"` (1177) already correct.

### Test edits

| File | What changes |
|------|--------------|
| `tests/orchestrators/plugin/install.test.ts` | The force-degradable install-failure byte form flips `⊘ … (unavailable) {…}` → `⊖ … (unsupported) {…}` (KEEP the `Re-run with --force …` trailer). Tests using `__test_composeInstallFailureMessage`/`__test_classifyEntityShapeError` (install.test.ts:2153-2229) that assert the unsupported-kind reason ARRAYS survive (reasons unchanged); their composed-row byte assertions flip. The PI-4 NON-path `{unsupported source}` case (install.test.ts:470, 511: `⊘ hello (unavailable) {unsupported source}`) — classify: a non-path source is `forceable: false` (structural), so it STAYS `⊘ (unavailable)` (verify via `resolver.ts:1214 forceable: false` for the non-path/no-`pluginRoot` arm). |
| `tests/orchestrators/plugin/info.test.ts` | XSURF-02 is masked (no live byte change), so existing info fixtures stay. If planning adds a test exercising a hypothetical non-path `unsupported` (forcing the new branch), assert `⊖ (unsupported)`. Existing `⊘ (unavailable)` non-path rows are unchanged. |
| `tests/orchestrators/plugin/update.test.ts` | The targeted decline (update.test.ts:1041-1074: `SEV-03 … manual update (no --force) … declines with (skipped) {no longer installable}`, severity warning) FLIPS its byte form to the new `force-upgradable` token + trailer; KEEP `severity: "warning"`. The PUP-4 targeted decline (350-385) flips similarly. The autoupdate FORCE-05 structural case (1005-1031: github `unavailable` candidate → `partition='skipped' {no longer installable}`) — verify it STAYS a decline (it is structural/`unavailable`, force can't help) — but note it is a CASCADE/autoupdate path (`force: true` already), so confirm whether it reaches the same projection (it returns `partition: "skipped"` with `reasons: ["no longer installable"]` from the cascade producer at update.ts:541-548, distinct from the manual decline at 768-776). Classify each `{no longer installable}` fixture by whether it is a force-UPGRADABLE decline (flips to `force-upgradable`) or a structural/cascade `unavailable` skip (stays `skipped`). |
| `tests/architecture/notify-closed-set-locks.test.ts` | **NO change** under the recommended design (no closed set grows). If the planner chooses a new reason (Option B / XSURF-03 #5 alternative), bump `REASONS` 32→33 in lockstep. |
| `tests/architecture/catalog-uat.test.ts` | The catalog-UAT gate re-asserts every `<!-- catalog-state: … -->` byte block. Reconcile `failure-unsupported-features` (XSURF-01), `decline-force-upgradable-targeted` + `skip-force-upgradable-bulk` (XSURF-03). |
| `tests/shared/notify-v2.test.ts` | Add a renderer byte-form case for the `unsupported` install row WITH the `--force` trailer (`⊖ … (unsupported) {…}` + trailer line), and for the `force-upgradable` update-decline row + its trailer. |
| `tests/edge/handlers/plugin/install.test.ts` | Audit for install-failure byte assertions that flip. |

### Docs edits (byte-exact reconciliation)

| File | What |
|------|------|
| `docs/output-catalog.md:444-456` | `failure-unsupported-features` (XSURF-01): flip `⊘ helper (unavailable) {unsupported hooks, lsp}` → `⊖ helper (unsupported) {unsupported hooks, lsp}`; KEEP the `Re-run with --force …` trailer line; update the prose ("the `unavailable` variant" → the `unsupported` variant). The structural `failure-unavailable-structural` (466-469: `⊘ helper (unavailable) {unsupported source}`) STAYS `⊘`. |
| `docs/output-catalog.md:868-877, 881-890` | `decline-force-upgradable-targeted` + `skip-force-upgradable-bulk` (XSURF-03): flip `⊘ hello v1.0.0 (skipped) {no longer installable}` → the new `force-upgradable` token form (`● hello v1.0.0 (force-upgradable) {…}`) + the `--force` trailer; preserve the severity prose (targeted=warning summary line; bulk=info, counted in tally). |
| `docs/output-catalog.md:11-12, 136-138` | Glyph legend + status-token table: `⊖`/`(unsupported)` already documented as "list / info surfaces" — widen to include the install-failure surface. `(force-upgradable)` row: widen from "list-inventory-only" to also cover the update-decline surface. |
| `docs/output-catalog.md:1754` (autoupdate) | Verify the FORCE-05 structural decline prose still reads `(skipped) {no longer installable}` for the `unavailable` arm (unchanged) and is not conflated with the new force-upgradable decline. |
| `docs/messaging-style-guide.md:136` | Update the install-failure severity prose: the force-degradable arm now uses the `(unsupported)` token (not `(unavailable)`) while still stamping `error` + carrying the `--force` trailer. Add the new update-decline trailer string to the frozen-DOC-contract list if a new trailer literal is introduced. |

## Common Pitfalls

### Pitfall 1: flipping the structural install-failure to `unsupported`
**What goes wrong:** flipping ALL install-failure `unavailable` rows to `⊖`. **Why:** the `{unsupported source}` non-path case (install.test.ts:470) and a missing-source structural defect are `forceable: false`. **Avoid:** split ONLY on `entityErrorRow.forceable === true`. Verify against `resolver.ts:1177` (`forceable: r.state === "unsupported"`) vs `resolver.ts:1214` (`forceable: false` for the non-forceable throw).

### Pitfall 2: forgetting the `forceHint` field on `PluginUnsupportedMessage`
**What goes wrong:** the install-failure `unsupported` row renders WITHOUT the `--force` trailer (XSURF-01 requires it kept). **Why:** Phase 72 deliberately omitted `forceHint?` from `PluginUnsupportedMessage`, and the trailer gate (notify.ts:3422) only fires on `unavailable`. **Avoid:** add `forceHint?` (edit #1) AND widen the gate (edit #2) together; add a notify-v2 byte test asserting the trailer line.

### Pitfall 3: breaking SEV-04 by changing the reason `cascadeSkipSeverity` keys on
**What goes wrong:** the targeted force-upgradable decline silently drops to `info` (loses the warning summary line) because `cascadeSkipSeverity` (update.ts:1586) no longer matches the reason. **Why:** it keys on `reasons.includes("no longer installable")`. **Avoid:** under the recommended design KEEP the reason `"no longer installable"` so the severity keying is untouched; flip only the STATUS token. If a new reason is introduced, re-key `cascadeSkipSeverity` in the SAME change and re-assert the warning/info split (update.test.ts:1074, 385).

### Pitfall 4: the `force-upgradable` "list-only" invariant
**What goes wrong:** emitting `force-upgradable` from `update` trips an architecture test asserting the token is list-surface-only. **Why:** `PluginForceUpgradableMessage` is documented "STRUCTURALLY list-only" (notify.ts:765-766). **Avoid:** grep `force-upgradable` in `tests/architecture/` (notably `notify-producer-wire-coverage.test.ts`, `notify-stamp-coverage.test.ts`) before planning; if such a test exists, the planner must update its surface-allowlist as part of XSURF-03.

## Runtime State Inventory

Not a rename/refactor/migration phase — no stored data, live-service config, OS-registered state, secrets, or build artifacts are affected. Pure render-layer code change.
- **Stored data:** None — `compatibility.unsupported` unchanged; force-state remains derived. Verified: no producer in scope writes state.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Install-failure + update-decline + info-non-path collapse a force-installable plugin onto `(unavailable)` / `(skipped)` | Resolver-state-driven `(unsupported)` (install/info) and `(force-upgradable)` (update-decline) tokens, cross-surface-consistent with `list` | This phase (XSURF-01..03; extends D-64-01) | A force-installable plugin reads consistently across `list`, `info`, install-error, and update-decline, all pointing at `--force`. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Reuse the force-upgradable framing" means flipping the update-decline row to the `force-upgradable` TOKEN (Option A), not merely a reason-brace swap. | XSURF-03 | Medium — if the maintainer meant a lighter reason swap, Option B applies (smaller, but the maintainer explicitly chose the larger cross-surface-consistent option per CONTEXT). Confirm before planning the `UPDATE_STATUSES` bump. |
| A2 | Keeping `reasons: ["no longer installable"]` (no new reason) is acceptable for XSURF-03, so `cascadeSkipSeverity` and `REASONS` are untouched. | XSURF-03 #5 | Medium — if the maintainer wants a NEW force-aware brace (e.g. `{would degrade}`), `REASONS` bumps 32→33 and `cascadeSkipSeverity` must re-key. The token flip alone already removes the misleading `(skipped)`. |
| A3 | The update-decline needs a NEW update-worded `--force` trailer (the existing install-worded `FORCE_INSTALL_HINT_TRAILER` says "install", not "update"). | XSURF-03 #6 | Low-Medium — reusing the install trailer verbatim would read slightly off ("install" on an update surface) but is functional; a new frozen DOC string is the cleaner choice. Confirm wording with the maintainer. |
| A4 | XSURF-02 produces no live byte change (non-path sources never resolve `unsupported` today). | XSURF-02 | Low — verified via the info.ts:1071-1075 masking comment; the fix is latent-divergence repair. |
| A5 | No `tests/architecture/` test forbids `update` from emitting `force-upgradable`. | Pitfall 4 | Medium — NOT yet grep-verified in this session for an explicit surface-allowlist; the planner must confirm before the `UPDATE_STATUSES` change. |

## Open Questions

1. **XSURF-03 trailer wording.** The locked decision says "point at `--force`" but does not specify the trailer string. The install trailer is "Re-run with --force to install the supported components." An update-decline likely wants "…to update with the supported components." (or similar). **Recommendation:** propose the update-worded string to the maintainer in planning; freeze it in output-catalog.md + messaging-style-guide.md as a new DOC contract.
2. **XSURF-03 reason brace.** Keep `{no longer installable}` (zero severity-keying risk) or introduce a force-aware brace? **Recommendation:** keep `{no longer installable}` — the TOKEN flip (`skipped`→`force-upgradable`, `⊘`→`●`) already removes the "cannot install at all" misread, and the new `--force` trailer supplies the affordance. Surface the choice in discuss-phase.
3. **`force-upgradable` list-only invariant (A5).** Whether any architecture test must be widened to allow `update` to emit `force-upgradable`. **Recommendation:** grep `tests/architecture/` in Wave 0 and treat any allowlist update as part of the XSURF-03 task.

## Environment Availability

No external dependencies — code-only change. (Step 2.6 SKIPPED: no external tools/services.)

## Validation Architecture

Test framework and config (verified from `package.json`):

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥ 20.19; native TS strip) |
| Config file | none — globs in `package.json` `scripts.test` |
| Quick run command | `node --test "tests/shared/notify-v2.test.ts" "tests/orchestrators/plugin/install.test.ts" "tests/orchestrators/plugin/update.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Requirement → Test Map

| Req | Behavior (observable) | Test Type | Automated Command | File Exists? |
|-----|-----------------------|-----------|-------------------|-------------|
| XSURF-01 | No-`--force` install of an `unsupported` plugin renders `⊖ … (unsupported) {…}` + `Re-run with --force …` trailer; structural `unavailable` install stays `⊘ … (unavailable)` no trailer | integration (byte-exact) | `node --test "tests/orchestrators/plugin/install.test.ts"` | ✅ (force-degradable byte form flips; PI-4 non-path `{unsupported source}` stays `⊘`) |
| XSURF-01 | `renderPluginRow`/install render map emits the `unsupported` install row + trailer byte form | unit (byte-exact) | `node --test "tests/shared/notify-v2.test.ts"` | ❌ Wave 0: ADD a `forceHint`-bearing `unsupported` renderer case |
| XSURF-02 | `info` non-path arm derives `status` from `resolved.state` (parity with `list`); existing non-path `unavailable` rows unchanged (masked) | integration | `node --test "tests/orchestrators/plugin/info.test.ts"` | ✅ (no live byte change; optional new branch-coverage test) |
| XSURF-03 | Targeted manual `update` (no `--force`) of a force-upgradable plugin renders the `force-upgradable` token (`● … (force-upgradable) {…}`) + `--force` trailer at `warning`; bulk at `info`; structural `unavailable` candidate stays a decline | integration (byte-exact) | `node --test "tests/orchestrators/plugin/update.test.ts"` | ✅ (1041-1074 + 350-385 flip; 1005-1031 structural stays) |
| XSURF-03 | SEV-04 cardinality preserved (targeted=warning, bulk=info) | integration | `node --test "tests/orchestrators/plugin/update.test.ts"` | ✅ (assert `notifications[0].severity` unchanged) |
| all | Catalog byte-equality for the reconciled `<!-- catalog-state -->` blocks | architecture | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (reconcile `failure-unsupported-features`, `decline-force-upgradable-targeted`, `skip-force-upgradable-bulk`) |
| invariant | Closed sets unchanged (REASONS=32, STATUS_TOKENS=23, PLUGIN_STATUSES=18) under the recommended design | architecture | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` | ✅ (NO bump expected; if a new reason is chosen, bump REASONS 32→33 in lockstep) |
| invariant | `force-upgradable` may be emitted from `update` (surface allowlist) | architecture | `node --test "tests/architecture/notify-producer-wire-coverage.test.ts"` (and `notify-stamp-coverage.test.ts`) | ⚠️ verify in Wave 0 (A5) |

### Sampling Rate
- **Per task commit:** `tsc --noEmit` (the `satisfies` render-map + `assertNever` switches are the primary exhaustiveness gate) + `node --test "tests/shared/notify-v2.test.ts"`.
- **Per wave merge:** `npm test` (full unit/integration globs).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/shared/notify-v2.test.ts` — add byte-exact renderer cases: (a) `unsupported` install row + `--force` trailer; (b) `force-upgradable` update-decline row + its `--force` trailer.
- [ ] `tests/architecture/notify-producer-wire-coverage.test.ts` / `notify-stamp-coverage.test.ts` — confirm/extend the surface allowlist so `update` may emit `force-upgradable` (A5 / Pitfall 4).
- [ ] (Conditional) if a new force-aware reason is chosen for XSURF-03, bump `REASONS` 32→33 in `notify-closed-set-locks.test.ts` and add a reason-array test.
- Framework install: none — `node:test` already in use.

## Security Domain

Not applicable to this phase's substance (no auth, input parsing, crypto, network, or data-handling surface is touched — it is a render-token/reason rename across three producers). Governing NFRs are preserved: NFR-5 (no-network on list/info/install/update decline — the decline is a pre-resolve verdict, no fetch), NFR-7 (the discriminated-union/`satisfies` gates stay total), NFR-10 (path containment unchanged — `derivePluginRootForInfo`/`isLocallyResolvable` short-circuits untouched). The new/widened fields (`forceHint?` on `PluginUnsupportedMessage`/`PluginForceUpgradableMessage`) add no `pluginRoot`-bearing data. No ASVS category newly applies. `security_enforcement` is enabled (absent in config = enabled), so this section is included; the verdict is "no new threat surface".

## Sources

### Primary (HIGH confidence — source-of-truth, this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `STATUS_TOKENS` (197-235), `PLUGIN_STATUSES` (387-417), `PluginUnavailableMessage`+`forceHint` (682-695), `PluginUnsupportedMessage` (709-715), `PluginForceUpgradableMessage` (771-778), `PluginSkippedMessage` (815-821), `PluginNotificationMessage` union (907-919), `ICON_*` (1394-1430), `renderPluginRow` unsupported/force-upgradable arms (2065-2086), `FORCE_INSTALL_HINT_TRAILER` (2228), trailer gate (3400-3424).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `EntityErrorRow` (168-179), failure-routing catch (1105-1175), `composeUnavailableMessage` (1516-1529), `composeInstallFailureMessage` (1531-1621), `classifyEntityShapeError` (1657-1709).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` — `INSTALL_STATUSES` (39), `InstallMsg` (48-52), `INSTALL_RENDER` (69-96).
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `buildNonInstallableRowFields` (805-836), `buildNotInstalledPathRow` (970-1008), `buildNotInstalledRow` non-path arm (1016-1068).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — manual decline producer (744-777), cascade `reasonsFromTypedError` (536-548), `cascadeSkipSeverity` (1578-1591), `outcomeToCascadePluginMessage` (1609-1755).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` — `UPDATE_STATUSES` (30), `UpdateMsg` (38-42), `UPDATE_RENDER` (52-70).
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — `projectRowStatus` (159-196), `unsupported`/`force-upgradable` arms.
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `forceable: r.state === "unsupported"` (1177), `forceable: false` (1214).
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — `REASONS` members incl. `no longer installable` (92), `unsupported hooks`/`lsp`/`unsupported source` (87-91).
- `tests/architecture/notify-closed-set-locks.test.ts` — REASONS=32 (30), STATUS_TOKENS=23 (39), PLUGIN_STATUSES=18 (47), MARKETPLACE_STATUSES=7 (51).
- `tests/orchestrators/plugin/{install,update,info}.test.ts` — byte-form fixtures (grep results, lines cited inline).
- `docs/output-catalog.md` — `failure-unsupported-features` (444-456), `failure-unavailable-structural` (466-469), `decline-force-upgradable-targeted` (868-877), `skip-force-upgradable-bulk` (881-890), info not-installed (1336-1342), glyph legend (11-12), token table (136-138).
- `docs/messaging-style-guide.md` — install-failure severity / trailer prose (136).
- Phase 72 artifacts: `72-RESEARCH.md` (Open Question 1 scoped this phase), `72-VERIFICATION.md` (Phase 72 landed), `72-REVIEW.md` (IN-01 origin, info.ts:1045-1056).

## Metadata

**Confidence breakdown:**
- XSURF-01 edit map: HIGH — every site read directly; the `forceable` discriminant + trailer gate are confirmed in source.
- XSURF-02 edit map: HIGH — exact branch (info.ts:1045-1056) and mirror site (info.ts:990) read; masking confirmed.
- XSURF-03 design: MEDIUM-HIGH — data flow and severity-keying confirmed in source; the "reuse force-upgradable framing" → Option A reading (A1) and the new-trailer/reason choices (A2/A3) need maintainer confirmation in discuss-phase. The `force-upgradable` list-only architecture-test risk (A5) is grep-verifiable but not yet confirmed this session.
- Closed-set impact: HIGH — verified all three needed tokens/reasons already exist (no tripwire bump under the recommended design).

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable internal codebase; invalidated only by edits to the three producers or the notify closed sets before planning).
