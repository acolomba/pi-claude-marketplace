# Phase 72: Unsupported Render Token - Research

**Researched:** 2026-06-28
**Domain:** TypeScript discriminated-union render layer (notification grammar) — pi-claude-marketplace
**Confidence:** HIGH (contained, self-verified against source; all claims carry file:line evidence)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Glyph (LOCKED by maintainer):** the not-installed force-installable `unsupported` row uses a NEW glyph `⊖` (circled minus, U+2296), exported as `ICON_UNSUPPORTED`. It stays in the circled-operator family with `⊘` (`ICON_UNINSTALLABLE`) but reads "diminished / components dropped" rather than "blocked". It is deliberately distinct from `◉` (`ICON_FORCE_INSTALLED`, the *installed*-degraded row). `⊘` stays RESERVED for `unavailable` / blocked / failed / manual-recovery rows — do not reuse it for `unsupported`.
- **Final glyph grammar (target):** `○ available`, `⊖ available, would degrade (unsupported)` ← new, `● installed`, `◉ installed, degraded (force-installed)`, `⊘ unavailable / blocked / failed`.
- **Status token:** add `"unsupported"` to the closed `STATUS_TOKENS` tuple in `shared/notify.ts`; the closed-set tripwire test must be bumped in the same lockstep commit.
- **Union variant:** add a `PluginUnsupportedMessage` variant to the notify discriminated union with `status: "unsupported"`, mirroring `PluginUnavailableMessage` (carries `name`, `version?`, `description?`, `reasons`). Widen the exhaustiveness `assertNever` gates to include it.
- **De-collapse (the fix):** in `availableRowMessage` (`list.ts`) split the `unsupported` arm from `unavailable`; the `unsupported` arm emits `status: "unsupported"` (reasons from `narrowUnsupportedKinds(resolved.unsupported)`); the `unavailable` arm and the probe-error `catch` keep `status: "unavailable"`. Same split in `buildNotInstalledRow` / `buildNonInstallableRowFields` (`info.ts`).
- **Filter buckets unchanged:** the internal `FilterBucket` is already distinct from the render status and must NOT change — `--unsupported` / `--unavailable` keep keying on the pre-collapse resolver bucket.
- **Reasons:** the new `(unsupported)` row carries the same per-kind `{unsupported hooks}` / `{lsp}` / `{unsupported source}` braces it carries today via `narrowUnsupportedKinds`. No change to that helper.
- **Severity:** match the severity the not-installed `unsupported` row renders at today (token rename, not a severity change). Introduce no new severities.

### Claude's Discretion
- Exact placement of the new `ICON_UNSUPPORTED` constant and `PluginUnsupportedMessage` interface within `notify.ts` (follow the `force-installed` precedent for ordering).
- How the info-surface caller threads `resolved.state` into the row `status` (caller-side branch vs. returning the status from the field builder).
- The tool-projection target bucket for `unsupported` (research recommends `"unavailable"`, see Q1 / blast-radius site #11).

### Deferred Ideas (OUT OF SCOPE)
- None — the phase scope is the render-token distinction only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USTAT-01 | A not-installed plugin resolving `unsupported` (force-installable: unsupported components, no structural defect) renders a distinct `(unsupported)` token with a dedicated `⊖` glyph in both `list` and `info`, instead of collapsing into `(unavailable)` / `⊘`. A structurally-`unavailable` plugin still renders `(unavailable)` / `⊘`. | Blast-radius map (sites #1–#11) + Q2 (LSP resolution) + Q5 (severity). De-collapse points: `list.ts:521-555`, `info.ts:1010-1034`. |
| USTAT-02 | `STATUS_TOKENS` gains `"unsupported"` (closed-set tripwire bumped); the new row keeps per-kind `{unsupported hooks}` / `{lsp}` braces via `narrowUnsupportedKinds`; `--unsupported` / `--unavailable` filters keep partitioning on the pre-collapse resolver bucket; the OUT-08 closed-set invariant test and `list`/`info` catalog/golden fixtures updated byte-exact. | Q3 (tripwire counts) + Q4 (fixture reconciliation scope) + filter-unchanged confirmation (`list.ts:117-227`, `FilterBucket` keyed by `classifyManifestEntry`). |
</phase_requirements>

## Summary

This is a contained render-layer change in a well-understood, type-enforced codebase. The resolver already produces a clean three-way `ResolvedPlugin.state` (`installable` / `unsupported` / `unavailable`) and the list/info **filter** layer already partitions on the pre-collapse bucket (that is why `--unsupported` works today). The only defect is at the two **render** collapse points where both resolver `unsupported` and `unavailable` are mapped onto a single `status: "unavailable"` message — a deliberate D-64-01 deferral. Phase 72 closes that deferral by giving the not-installed force-installable `unsupported` row its own `(unsupported)` token + `⊖` glyph.

The blast radius is exactly mirrored on the Phase 66 `force-installed` / `◉` precedent: add the closed-set member (two tuples), add the glyph constant, add the union variant, add the renderer `switch` arm, bump the closed-set tripwire, and reconcile catalog/byte-exact fixtures. There are **eleven source edit sites** and a documentation/fixture reconciliation that is the most delicate part of the work because the SAME reason brace (`{unsupported hooks}`) can appear on BOTH the `unsupported` (⊖) and `unavailable` (⊘) arms — so each fixture must be reclassified by its intended resolver **state**, never by its reason brace.

Two open questions are resolved definitively here: (Q2) an LSP-only plugin resolves `unsupported`, not `unavailable`, so `clangd-lsp` WILL flip to `⊖ ... (unsupported) {lsp}` (contradicting the tentative CONTEXT example); (Q3) `STATUS_TOKENS` goes 22→23 and `PLUGIN_STATUSES` goes 17→18 (both bump — `PLUGIN_STATUSES` MUST gain the member because the info-row status set derives from it via `Extract`).

**Primary recommendation:** Follow the Phase 66 `force-installed` lockstep template exactly. Edit the eleven source sites listed in the Blast Radius table, bump both tripwire counts, then reconcile fixtures/catalog by classifying each `{unsupported hooks}`/`{lsp}`/`{unsupported source}` row by resolver **state** (not by brace).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolver three-way state | Domain (`domain/resolver.ts`) | — | Read-only this phase; already produces `installable`/`unsupported`/`unavailable` (`decideResolution`, resolver.ts:1088). |
| Render status → glyph/token mapping | Shared render (`shared/notify.ts`) | — | Sole site that owns the grammar vocabulary (closed sets + `renderPluginRow` + glyph switches). |
| Resolver-state → render-status collapse | Orchestrator (`orchestrators/plugin/list.ts`, `info.ts`) | Shared render | The two collapse points; this is where the de-collapse happens. |
| Filter bucketing | Orchestrator (`list.ts` `FilterBucket` / `shouldShow`) | Shared classifier (`plugin-state-classifier.ts`) | Already keys on the pre-collapse bucket; MUST stay unchanged. |
| LLM-tool status projection | Edge (`edge/handlers/tools.ts`) | — | Projects the widened union onto a 3-bucket tool surface; compile-forced to handle the new member. |
| Reason-brace derivation | Shared (`shared/probe-classifiers.ts` `narrowUnsupportedKinds`) | — | Read-only; already maps `lspServers`→`lsp`, `hooks`→`unsupported hooks`, else→`unsupported source`. |

## Standard Stack

No new dependencies. This phase is pure first-party TypeScript edits within the existing extension. Toolchain (from `package.json`, verified): TypeScript strict (`tsc --noEmit`), ESLint 10 flat config, Prettier 3, `node:test` runner. Quality gate: `npm run check` (typecheck + lint + format:check + test + test:integration).

## Package Legitimacy Audit

Not applicable — no external packages are installed by this phase. (Code/config-only change within the existing first-party extension.)

## Architecture Patterns

### Lockstep "new closed-set token" template (the Phase 66 `force-installed` precedent)

Adding a render status to this codebase is a fixed, type-enforced sequence. Phase 66 added `force-installed` (`◉`) the same way; Phase 72 mirrors it for `unsupported` (`⊖`). The compiler and the closed-set tripwire make each omitted step a hard failure, so the sequence is self-checking:

1. Append the literal to the closed-set tuples (`STATUS_TOKENS`, `PLUGIN_STATUSES`).
2. Declare the glyph constant (`ICON_UNSUPPORTED`).
3. Declare the per-variant message interface (`PluginUnsupportedMessage`) and add it to the `PluginNotificationMessage` union.
4. Add the renderer `switch` arm in `renderPluginRow` (cascade/list) and `pluginInfoStatusGlyph` (info glyph).
5. Widen every exhaustive `switch` over the plugin-status union (the `assertNever`/no-default tails force this).
6. Bump the closed-set length tripwire in the SAME change.
7. Reconcile byte-exact fixtures and `docs/output-catalog.md` / `docs/messaging-style-guide.md`.

### The collapse points (the actual fix)

**`list.ts` — `availableRowMessage` (list.ts:490-559):** the `switch (resolved.state)` currently routes `case "unsupported":` and `case "unavailable":` to the SAME block emitting `status: "unavailable"` (list.ts:532-555). Split: the `unsupported` arm emits `status: "unsupported"` with `reasons = narrowUnsupportedKinds(resolved.unsupported)` (already computed at list.ts:538-541); the `unavailable` arm keeps `status: "unavailable"` with `sharedNarrowResolverNotes(resolved.notes)`. The `catch (probeErr)` block (list.ts:560+) keeps `status: "unavailable"`. Widen the function return type from `PluginAvailableMessage | PluginUnavailableMessage` (list.ts:494) to add `PluginUnsupportedMessage`. The `bucket` field is unchanged (already derived by `classifyManifestEntry`, list.ts:510).

**`info.ts` — not-installed path-source branch (info.ts:987-1035):** for a not-installed plugin, info already discriminates two sub-paths: non-path sources short-circuit to `status: "unavailable"` via `!isLocallyResolvable(parsedSource)` (info.ts:988-998) and STAY `(unavailable)` — they never reach the resolver-state switch. Only PATH sources reach `buildNonInstallableRowFields` (info.ts:1011) which already switches `resolved.state` (info.ts:815-835). Today the caller hard-codes `status: "unavailable"` (info.ts:1018). Fix: set the status from `resolved.state` — when `resolved.state === "unsupported"` emit `status: "unsupported"`, else `"unavailable"`. The `...fields` spread (reasons/components) is unchanged.

### Anti-Patterns to Avoid

- **Splitting on the reason brace instead of the resolver state.** `{unsupported hooks}` appears on BOTH arms: a parseable-but-unsupportable `hooks.json` resolves `unsupported` (→ `⊖`), while a structurally-malformed `hooks.json` resolves `unavailable` (→ `⊘`) and ALSO renders `{unsupported hooks}` via the structural `narrowResolverNotes` path (confirmed: probe-classifiers unifies both under one reason; resolver.ts:879 pushes `"hooks"` to `partial.unsupported` only on the supportability-drop path). The render split MUST follow `resolved.state`.
- **Touching `FilterBucket` / `shouldShow` / `classifyManifestEntry`.** These already partition correctly on the pre-collapse bucket (list.ts:117-227, plugin-state-classifier.ts:165-176). Changing them would regress `--unsupported` / `--unavailable`.
- **Modifying `narrowUnsupportedKinds` or the resolver.** Both are read-only this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-kind reason braces for the new row | A second reason mapper | `narrowUnsupportedKinds` (probe-classifiers.ts:151) | Already the single shared helper across list/info/install; guarantees byte-identical markers (SURF-01 parity). |
| Resolver-state → render-status decision | Inline `if (lsp || hooks)` checks | `resolved.state` discriminant | The resolver already encodes the force-installable vs. structural distinction; re-deriving it from component kinds re-introduces the D-64-01 bug. |

## Blast Radius — exhaustive map (answers Q1)

Every site that switches on the plugin-status union or the resolver state, every closed-set tuple, every projection, and every test that asserts the closed set or a status→glyph row. Mirrors the Phase 66 `force-installed` file list.

### Source edits (11 sites)

| # | File:line | Site | Edit |
|---|-----------|------|------|
| 1 | `shared/notify.ts:380-403` | `PLUGIN_STATUSES` tuple | Append `"unsupported"` → 18 entries. **Required** because `PluginInfoRowBase.status` derives via `Extract<PluginStatus, ...>` (#7); without it `Extract<…, "unsupported">` = `never`. |
| 2 | `shared/notify.ts:198-228` | `STATUS_TOKENS` tuple | Append `"unsupported"` → 23 entries. |
| 3 | `shared/notify.ts:~1383` | New `ICON_UNSUPPORTED = "⊖"` | Add next to `ICON_FORCE_INSTALLED` with a doc comment (`⊖` U+2296; distinct from `⊘`/`◉`). |
| 4 | `shared/notify.ts:~682` | New `PluginUnsupportedMessage` interface | Mirror `PluginUnavailableMessage` (notify.ts:668-681): `status: "unsupported"`, `name`, `reasons: readonly ContentReason[]`, `version?`, `description?`. **Omit** the `forceHint?` field (that is the install-error surface, out of scope). `extends MessageBase` (optional severity, defaults to info). |
| 5 | `shared/notify.ts:867-884` | `PluginNotificationMessage` union | Add `| PluginUnsupportedMessage`. |
| 6 | `shared/notify.ts:2008-2017 / 1937 switch` | `renderPluginRow` cascade/list switch | Add `case "unsupported":` → `ICON_UNSUPPORTED` + `"(unsupported)"` + `composeReasons(p.reasons, false, false, probe)` (clone the `unavailable` arm at 2008-2017, swapping glyph + token). `assertNever(p)` tail (2101) then compiles. |
| 7 | `shared/notify.ts:1127-1130` | `PluginInfoRowBase.status` `Extract` | Add `"unsupported"` to the union member list. |
| 8 | `shared/notify.ts:2863-2881` | `pluginInfoStatusGlyph` switch | Add `case "unsupported": return ICON_UNSUPPORTED;`. `assertNever(status)` tail (2878) then compiles. |
| 9 | `orchestrators/plugin/list.ts:490-559` | `availableRowMessage` | Widen return type (494) to add `PluginUnsupportedMessage`; split the `unsupported` arm (532-555) to emit `status: "unsupported"`. Bucket unchanged. |
| 10 | `orchestrators/plugin/info.ts:1010-1034` | not-installed path-source branch | Set row `status` from `resolved.state` (`"unsupported"` vs `"unavailable"`). Non-path short-circuit (988-998) stays `unavailable`. |
| 11 | `edge/handlers/tools.ts:159-196` | `projectRowStatus` | Add `case "unsupported": return "unavailable";` — **compile-forced**: the switch has NO `default`, so the widened `PluginNotificationMessage["status"]` makes a missing arm a "not all paths return" error. A not-installed `unsupported` list row DOES traverse this projection, so it must map to a real bucket (recommend `"unavailable"`, mirroring `disabled`→`unavailable` at 177-181), not the throw arm. |

**Notes on non-sites (verified, no edit needed):**
- `plugin-state-classifier.ts:165-176` (`classifyManifestEntry`) already returns `"unsupported"` distinctly — no change.
- `resolver.ts` `decideResolution` (1088) — read-only.
- `narrowUnsupportedKinds` (probe-classifiers.ts:151) — read-only; already covers lsp/hooks/source.
- The install-error surface (`requireInstallable` → `PluginShapeError` → render with `forceHint`, notify.ts:674-680 / resolver.ts:1162-1185) is NOT one of the two collapse points and is OUT OF SCOPE — it keeps `(unavailable)` + `--force` hint. See Open Questions for the resulting cross-surface inconsistency.

### Test edits

| File:line | What flips / changes |
|-----------|----------------------|
| `tests/architecture/notify-closed-set-locks.test.ts:37,42` | `STATUS_TOKENS` 22→23; `PLUGIN_STATUSES` 17→18. `REASONS` stays 32; `MARKETPLACE_STATUSES` stays 7. (This is the OUT-08 / SNM-02 tripwire — see Q3.) |
| `tests/orchestrators/plugin/list.test.ts:446-487` | The test "a not-installed plugin resolving `unsupported` shows under --unsupported (still the `(unavailable)` row token)" + assertion at 476 (`⊘ unsup … (unavailable) {lsp}`) FLIPS to `⊖ unsup … (unsupported) {lsp}`. Revise the now-false comments at 442-443 + 470-471 ("No rendered byte changes"). Verify line 336 `gamma … {unsupported source}` and 487 `gone … {unsupported source}` — classify by resolver state (an unsupported component kind → ⊖; structural → ⊘). |
| `tests/orchestrators/plugin/info.test.ts` | 347/389 malformed-hooks.json → STAYS `⊘ (unavailable) {unsupported hooks}` (structural). 1709/1752 path-source `{unsupported hooks}` → classify (parseable-unsupportable → `⊖ (unsupported)`). 1835 `remote` npm non-path → STAYS `⊘ (unavailable) {unsupported source}` (non-path short-circuit). |
| `tests/architecture/catalog-uat.test.ts:247-267` | **Stale audit comment** declaring "NONE of them flip" (written under the collapse regime) must be rewritten. Reclassify the in-scope list/info fixtures: `epsilon` (302-306, carries `lsp` → definitively `⊖ (unsupported)`); `delta` (302, 1276 — classify); `unavailable-plugin` (1827). The install/cascade scenarios (`failure-unsupported-features` 898-910 etc.) stay `(unavailable)` (out of scope). |
| `tests/shared/notify-v2.test.ts:400,1307` | Renderer byte-form fixtures `⊘ … (unavailable) {unsupported hooks}` — reclassify if modeling resolver-`unsupported`. **Add** a new renderer test for the `unsupported` arm byte form (`⊖ … (unsupported) {…}`). |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:14,62` | Assertions test the reason ARRAYS (via `narrowUnsupportedKinds`), not full rows, so they survive; comments referencing `(unavailable) {<reason>}` need updating to `(unsupported)` for the list/info surfaces. |
| `tests/shared/snm37-behavioral-smoke.test.ts`, `snm38-indent-ladder.test.ts`, `tests/domain/resolver-strict.test.ts`, `tests/architecture/hooks-supportability.test.ts` | Grep-hits for `(unavailable)` / `unsupported` — audit each for not-installed `unsupported` rows that flip; most are resolver-state or structural-unavailable assertions that do not flip. |

### Docs edits

| File | What |
|------|------|
| `docs/output-catalog.md` | Glyph legend (line 11, 37) — add `⊖`. Status-token table (line 136) — split the `(unavailable)` row into a new `(unsupported)`/`⊖` row (force-installable, carries `{unsupported hooks}`/`{lsp}`) and a narrowed `(unavailable)`/`⊘` row (structural). List examples 183-184, 302, 449, 463, 662, 937 — flip the ones modeling resolver-`unsupported`. Info section 1333 — split the conflated description. Filter section 163 — the stale "collapses both … into `(unavailable)`" / "no rendered byte changes" prose is now false. |
| `docs/messaging-style-guide.md` | Mirror the token-set + glyph references (DOC-02 already names the `unsupported` token; the display now emits it). |

## Common Pitfalls

### Pitfall: reclassifying fixtures by reason brace instead of resolver state
**What goes wrong:** flipping every `{unsupported hooks}` row to `⊖`. **Why:** a malformed `hooks.json` (structural `unavailable`, `⊘`) and a parseable-but-unsupportable `hooks.json` (`unsupported`, `⊖`) BOTH render `{unsupported hooks}`. **How to avoid:** for each fixture, determine the modeled resolver `state` from the scenario description (e.g. info.test.ts:347 says "malformed" → stays `⊘`). `lsp` always implies `unsupported` (`⊖`); a malformed/invalid-manifest scenario stays `⊘`.

### Pitfall: forgetting `PLUGIN_STATUSES` (only bumping `STATUS_TOKENS`)
**What goes wrong:** `Extract<PluginStatus, "unsupported">` resolves to `never`, so the info-row status (#7) silently rejects the new member and `pluginInfoStatusGlyph` won't accept the case. **How to avoid:** both tuples get the member; both tripwire counts bump.

### Pitfall: missing the `tools.ts` projection arm
**What goes wrong:** a not-installed `unsupported` plugin in the LLM-tool list payload hits the `projectRowStatus` no-default switch — a typecheck failure (best case) or the throw arm at runtime. **How to avoid:** add `case "unsupported": return "unavailable"` (site #11).

## Runtime State Inventory

Not a rename/refactor/migration phase — no stored data, live-service config, OS-registered state, secrets, or build artifacts are affected. This is a pure render-layer code change.
- **Stored data:** None — the persisted `compatibility.unsupported` field is unchanged; force-state remains derived (FSTAT-01), no migration.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Both resolver `unsupported` + `unavailable` collapse to `(unavailable)` / `⊘` on list/info | Distinct `(unsupported)` / `⊖` for force-installable not-installed rows | This phase (D-64-01 deferral closed) | Hooks/LSP/unsupported-source not-installed plugins become visually distinguishable from structural failures. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The tool-surface projection for `unsupported` should be `"unavailable"` (no distinct tool bucket). | Blast Radius #11 | Low — the tool surface is a coarse 3-bucket projection; `disabled` already maps to `unavailable`. If the maintainer wants a distinct surface that is a separate decision. |
| A2 | The install-error surface stays `(unavailable)` (out of scope per CONTEXT's "two render collapse points only"). | Open Questions | Medium — produces a deliberate cross-surface inconsistency (list/info say `unsupported`, install error says `unavailable` + `--force` hint). Confirm the scope boundary is intended. |

## Open Questions

1. **Cross-surface consistency of the install-error row.** After this phase, `list`/`info` render `⊖ (unsupported)` for a force-installable plugin, but the `install <plugin>` error surface (no `--force`) still renders `⊘ (unavailable)` + the `--force` hint (SEV-02, notify.ts:674-680). The CONTEXT explicitly scopes the fix to the two list/info collapse points, so this is OUT OF SCOPE — but it leaves the same plugin showing two different tokens across surfaces.
   - What we know: the CONTEXT locks scope to `availableRowMessage` and `buildNotInstalledRow` only; USTAT-01 names "list and info" only.
   - What's unclear: whether the maintainer wants the install-error surface aligned to `(unsupported)` in a follow-up.
   - Recommendation: keep it out of scope per the lock; note the inconsistency in the phase summary so it can be a deferred idea.

## Environment Availability

No external dependencies — code/config-only change. (Step 2.6 SKIPPED: no external tools/services.)

## Validation Architecture

Test framework and config (verified from `package.json`):

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥ 20.19; native TS strip) |
| Config file | none — globs in `package.json` `scripts.test` |
| Quick run command | `node --test "tests/architecture/notify-closed-set-locks.test.ts" "tests/shared/notify-v2.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Requirement → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| USTAT-02 | Closed-set invariant: `STATUS_TOKENS`=23, `PLUGIN_STATUSES`=18 | architecture/unit | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` | ✅ (counts bump 22→23, 17→18) |
| USTAT-01 | `renderPluginRow` emits `⊖ … (unsupported) {…}` for a `status: "unsupported"` message | unit (byte-exact) | `node --test "tests/shared/notify-v2.test.ts"` | ✅ exists; ❌ Wave 0: ADD an `unsupported`-arm byte-form case |
| USTAT-01 | `list` renders `⊖ (unsupported)` for a not-installed resolver-`unsupported` plugin; `⊘ (unavailable)` for structural | integration (byte-exact) | `node --test "tests/orchestrators/plugin/list.test.ts"` | ✅ (446-487 flips to `⊖`/`(unsupported)`) |
| USTAT-01 | `info` path-source renders `⊖ (unsupported)`; non-path + malformed stay `⊘ (unavailable)` | integration (byte-exact) | `node --test "tests/orchestrators/plugin/info.test.ts"` | ✅ (reclassify 1709; 347 + 1835 stay) |
| USTAT-01 | `pluginInfoStatusGlyph("unsupported")` → `⊖` (exhaustive switch, no silent default) | unit | covered by info.test.ts + typecheck (`assertNever`) | ✅ |
| USTAT-02 | Filters unaffected: `--unsupported` shows it, `--unavailable` excludes it | integration | `node --test "tests/orchestrators/plugin/list.test.ts"` (505) | ✅ (assertions on bucket survive; row token updates) |
| USTAT-02 | Catalog byte-equality for the reconciled rows | architecture | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (reclassify fixtures + rewrite stale 247-267 comment) |
| USTAT-01 | Cross-surface reason parity preserved on the new token | integration | `node --test "tests/orchestrators/plugin/cross-surface-reason-parity.test.ts"` | ✅ (reason-array assertions survive; comments update) |
| USTAT-01 | LLM-tool projection handles `unsupported` (→ `[unavailable]`) | unit | `node --test "tests/edge/**/*.test.ts"` | verify a tools-handler test covers a list payload row; ADD if absent |

### Sampling Rate
- **Per task commit:** `node --test "tests/architecture/notify-closed-set-locks.test.ts" "tests/shared/notify-v2.test.ts"` plus `tsc --noEmit` (the `assertNever`/no-default switches are the primary exhaustiveness gate).
- **Per wave merge:** `npm test` (full unit/integration globs).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/shared/notify-v2.test.ts` — add a byte-exact `unsupported`-arm renderer case (`⊖ … (unsupported) {…}`); none exists today (no `⊖` anywhere in repo, confirmed by grep).
- [ ] `tests/edge/handlers/tools.*.test.ts` — confirm/add coverage for an `unsupported` list-payload row projecting to `[unavailable]`.
- Framework install: none — `node:test` already in use.

## Security Domain

Not applicable to this phase's substance (no auth, input parsing, crypto, network, or data-handling surface is touched — it is a render-token rename). The governing project NFRs (NFR-5 no-network on list/info, NFR-7 type-enforced discriminants, NFR-10 path containment) are preserved unchanged: the resolver and `isLocallyResolvable` short-circuits are untouched, and the new variant adds no `pluginRoot`-bearing field. No ASVS category newly applies.

## Answers to the Decision-Relevant Questions

**Q1 — Exhaustive blast radius:** 11 source sites (table above) + tests + docs. Switch/exhaustiveness sites over the plugin-status union: `renderPluginRow` (notify.ts:1937, `assertNever` at 2101), `pluginInfoStatusGlyph` (notify.ts:2864, `assertNever` at 2878), `projectRowStatus` (tools.ts:159, no-default exhaustive). Resolver-state switches at the collapse points: `availableRowMessage` (list.ts:521, `assertNever` 558) and `buildNonInstallableRowFields` (info.ts:815, `assertNever` 834) — both already have a distinct `unsupported` arm; only the emitted `status` changes. Projections: `tools.ts` `projectRowStatus` (the one tool projection). Closed sets: `STATUS_TOKENS` + `PLUGIN_STATUSES`. Tripwire: `notify-closed-set-locks.test.ts`.

**Q2 — LSP-only resolution (definitive):** An LSP-only plugin (e.g. `clangd-lsp`) resolves **`unsupported`** (force-installable), NOT `unavailable`. Evidence: `lspServers` ∈ `UNSUPPORTED_COMPONENT_KINDS` (resolver.ts:247-248); `addUnsupportedKindNotes` pushes it to `partial.unsupported` (resolver.ts:1015) and does NOT set `dirty` (resolver.ts:1068-1072); `decideResolution` returns `unsupported` when `structuralDirty` is false and `partial.unsupported.length > 0` (resolver.ts:1094-1099). Therefore the render split (which follows `resolved.state`) makes `clangd-lsp` render **`⊖ clangd-lsp v1.0.0 (unsupported) {lsp}`** — this CONTRADICTS the tentative `# IF lsp-only plugins are structurally unavailable` example in 72-CONTEXT.md (specifics, line 96). Both `hookify` and `clangd-lsp` flip to `⊖`.

**Q3 — Closed-set tripwire (definitive):** Asserted in `tests/architecture/notify-closed-set-locks.test.ts`. Current values (verified): `STATUS_TOKENS.length === 22` (line 37), `PLUGIN_STATUSES.length === 17` (line 42), `REASONS.length === 32` (line 30), `MARKETPLACE_STATUSES.length === 7` (line 46). After adding `"unsupported"`: `STATUS_TOKENS` **22→23**, `PLUGIN_STATUSES` **17→18**. `REASONS` stays 32 (`unsupported hooks`/`lsp`/`unsupported source` already exist) and `MARKETPLACE_STATUSES` stays 7. Both bumps are mandatory; `PLUGIN_STATUSES` MUST gain the member so `PluginInfoRowBase.status`'s `Extract<PluginStatus, …>` can include `"unsupported"`.

**Q4 — Byte-form catalog reconciliation scope:** Fixtures/golden rows asserting `(unavailable)` for not-installed plugins that may flip to `(unsupported)`: `tests/architecture/catalog-uat.test.ts` (list scenario 302-306 `delta`/`epsilon`, 1276 `delta`, import 1827 `unavailable-plugin`; rewrite the stale Q3-AUDIT comment 247-267), `tests/orchestrators/plugin/list.test.ts` (446-487 `unsup {lsp}` — flips; 336/487 `{unsupported source}` — classify), `tests/orchestrators/plugin/info.test.ts` (1709/1752 path-source — classify; 347/1835 stay), `tests/shared/notify-v2.test.ts` (400, 1307 — classify). Docs: `docs/output-catalog.md` lines 11, 37, 136, 163, 183-184, 302, 449, 463, 662, 937, 1333 and the matching `docs/messaging-style-guide.md` token references. **Rule:** flip iff the modeled resolver state is `unsupported` (lsp / unsupported component kind / parseable-but-unsupportable hooks); keep `⊘` for structural (`malformed hooks.json`, `invalid manifest`, non-path source).

**Q5 — Severity (definitive, preserve as-is):** The not-installed `(unavailable)` list/info row renders at **info** today and the new `(unsupported)` row must keep info. Evidence: `PluginUnavailableMessage extends MessageBase` (notify.ts:668) — `severity?` is optional and defaults to info (notify.ts:524-526, SEV-01/RLD-01); the list/info producers do not stamp a non-info severity on these rows; `docs/output-catalog.md:1333` states "Severity `info` (unavailable is not a failure on the info surface; only `failed` routes to error)". Therefore `PluginUnsupportedMessage` should also `extends MessageBase` (optional severity), and the producers stamp nothing — preserving info. (The catalog-UAT import scenario at 1827 stamps `warning` on a specific import-producer unavailable row — that is the import surface's caller-stamped choice and is independent of the list/info default; preserve whatever the corresponding producer stamps.)

## Sources

### Primary (HIGH confidence — source-of-truth, this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `STATUS_TOKENS` (198-228), `PLUGIN_STATUSES` (380-403), `PluginUnavailableMessage` (668-681), `PluginNotificationMessage` union (867-884), `ICON_*` constants (1359-1383), `renderPluginRow` switch (1937-2104), `PluginInfoRowBase.status` (1127-1130), `pluginInfoStatusGlyph` (2863-2881).
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `PluginRenderStatus`/`FilterBucket`/`shouldShow` (104-227), `availableRowMessage` collapse (490-559).
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `buildNonInstallableRowFields` (805-836), not-installed branch (960-1049).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `UNSUPPORTED_COMPONENT_KINDS` (247), `addUnsupportedKindNotes` (1005-1015), `resolveStrict` (1026-1080), `decideResolution` (1088-1103).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — `narrowUnsupportedKinds`/`kindToReason` (151-177).
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — `projectRowStatus` (159-196).
- `tests/architecture/notify-closed-set-locks.test.ts` — closed-set counts (29-47).
- `tests/orchestrators/plugin/{list,info,cross-surface-reason-parity}.test.ts`, `tests/architecture/catalog-uat.test.ts`, `tests/shared/notify-v2.test.ts` — fixture grep results.
- `docs/output-catalog.md` — glyph legend + token table + examples (grep results).
- `package.json` — `scripts.check` / `scripts.test` (verified).

## Metadata

**Confidence breakdown:**
- Blast radius: HIGH — every site read directly and cross-checked against the Phase 66 `force-installed` precedent.
- LSP resolution (Q2): HIGH — traced `decideResolution` + `addUnsupportedKindNotes` to source lines.
- Tripwire counts (Q3): HIGH — read the assertion file.
- Fixture reconciliation (Q4): MEDIUM-HIGH — the set of files is exhaustive; per-fixture flip/keep classification requires the planner to read each scenario's intent (the rule is given, but some `{unsupported hooks}`-only rows are ambiguous without their setup).

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable internal codebase; only invalidated by edits to `notify.ts` closed sets or the two collapse points before planning).
