# Project Research Summary

**Project:** pi-claude-marketplace v1.8 Plugin and Marketplace Info Commands
**Domain:** Internal spec consistency for two new read-only detail-surface commands
**Researched:** 2026-06-03
**Scope:** This research was deliberately constrained to the project's own specs (catalog, style guide, closed sets, render seams) -- no external CLI ecosystem research. Goal: ensure the new commands' message shapes align with existing conventions, save for the documented additions (one new reason `{not added}`).

## Compliance Verdict

Both proposed commands fit cleanly into the existing v1.4 `NotificationMessage` architecture with **one new closed-set member** required: `"not added"` added to the `REASONS` tuple in `extensions/pi-claude-marketplace/shared/notify.ts:63-92`.

All other artifacts (status tokens, markers, severity routing, reload-hint gate, scope-bracket rules, catalog UAT byte-equality, completion provider) extend without contract changes.

## Conventions the Info Commands Must Honor

### 1. Closed Sets (`shared/notify.ts`)

- `STATUS_TOKENS` (15 entries, lines 133-149): Reuse `"installed"`, `"available"`, `"unavailable"` for plugin rows. **No new status tokens needed.**
- `REASONS` (29 entries, lines 63-92): Reuse `"not in manifest"` for missing-plugin case. **Add `"not added"`** for missing-marketplace and `--scope` mismatch cases. This is the *only* closed-set extension v1.8 requires.
- `MARKERS` (2 entries, line 159): Reuse `"autoupdate"` / `"no autoupdate"` for marketplace info header.
- `PATTERN_CLASSES`: No additions; docs-only labels.
- Drift enforcement: v1.3 ESLint plugin retired in v1.4 (SNM-24/27/28); current lock is the `as const` tuple compiled types + `tests/architecture/notify-types.test.ts` + `catalog-uat.test.ts` byte-equality. Adding a reason requires updating the tuple and the catalog atomically in one commit (the v1.3 retrospective lesson: atomic user-contract boundary).

### 2. Catalog Structure (`docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts`)

- Every command has an H2 section: `` ## `/claude:plugin <verb> [<args>]` ``.
- Per-state byte form lives in `` ```text ... ``` `` fences, each preceded by a `<!-- catalog-state: STATE -->` annotation.
- UAT fixture map keys by `(section, state)`; driver calls `notify(mockCtx, mockPi, message)` and asserts byte-equality plus severity-arg shape.
- **New sections to add:** `` ## `/claude:plugin marketplace info <name>` `` and `` ## `/claude:plugin info <plugin>@<marketplace>` `` with all status/scope/error variants enumerated.

### 3. Messaging Style Guide (`docs/messaging-style-guide.md`)

- MSG-PL-6 scope bracket: emit `[<scope>]` on plugin rows only when `plugin.scope !== marketplace.scope`. Info commands follow this verbatim.
- MSG-RH-1 reload-hint gate: only state-changing tokens trigger; info commands emit no state-change, so no `/reload to pick up changes` trailer.
- MSG-SR ladder: info commands emit info severity (no 2nd arg to `ctx.ui.notify`) on success; error severity only on read-time failures (missing marketplace, missing plugin, parse errors).
- MSG-GR-5: markers/reasons stored without braces or chevrons; renderer composes them.

### 4. Edge Layer (`edge/handlers/{plugin,marketplace}/`, `edge/args-schema.ts`)

- Handler factory pattern: `makeXxxHandler(pi)` returns `(args, ctx) => Promise<void>`.
- Arg parsing via `parseCommandArgs<Spec>` with positional schema + `--scope` flag.
- On parse failure: `notifyUsageError(ctx, { message, usage: USAGE })`.
- New handlers: `edge/handlers/marketplace/info.ts`, `edge/handlers/plugin/info.ts`. Schema for plugin info: single `<plugin>@<marketplace>` positional, split via `splitPluginMarketplaceRef` from `plugin/shared.ts` (matches `install`).

### 5. Orchestrator Layer (`orchestrators/{plugin,marketplace}/`)

- Standard shape: options interface `{ ctx, pi, cwd, scope?, ...args }`; single async function; constructs `NotificationMessage`; calls `notify(ctx, pi, message)` exactly once.
- Closest analog for marketplace info: `orchestrators/marketplace/list.ts` (read-only state + manifest read).
- Closest analog for plugin info: `orchestrators/plugin/list.ts` (state + manifest + soft-dep probe).
- Both new orchestrators are read-only (no `withStateGuard` / `withLockedStateTransaction` needed) -- preserves NFR-5.

### 6. Completion Provider (`edge/completions/provider.ts`)

- TC-5 pattern (marketplace names): used by `marketplace remove`, `marketplace update`, `marketplace autoupdate`. `marketplace info <TAB>` adopts this -- union of both scopes' marketplace names from `getMarketplaceNamesAcrossScopes()`.
- TC-6 pattern (`<plugin>@<marketplace>` combos with status-aware filter): used by `install`, `uninstall`, `reinstall`, `update`. `plugin info <TAB>` adopts this with a new mode that includes `available + installed + unavailable` (info is exploratory; show everything).
- Host-side `@`-precedence (G-MIL-07 finding): pi-tui intercepts `@<TAB>` before reaching the provider for bare `@<mp>` tab completion. Our provider returns the correct candidates for `<plugin>@<TAB>` (post-`@`), but bare `@<TAB>` may still be host-broken. Accept this as out of v1.8 scope (same constraint affects existing commands).

### 7. State and Manifest Read Seams

- `persistence/state-io.ts`: `loadState(locations)` returns `State` typed against `MARKETPLACE_RECORD_SCHEMA` (lines 63-73) and `PLUGIN_INSTALL_RECORD_SCHEMA` (lines 38-55). Source kind, autoupdate, lastUpdatedAt, version, resources, timestamps -- all present.
- `domain/manifest.ts`: `loadMarketplaceManifest(manifestPath)` returns `MarketplaceManifest` validated against `MARKETPLACE_SCHEMA`. Per-plugin entries carry name/version/description/components/dependencies.
- `domain/components/plugin.ts`: plugin entry schema with full component arrays.
- For uninstalled-but-known plugins, the marketplace entry is sufficient for description/dependencies; `plugin.json` is needed for component names. If unreachable (external source not synced), surface `components: not resolved`.

### 8. Source Display Format

- `domain/source.ts:31-52`: `GitHubSource { kind, owner, repo, ref? }` and `PathSource { kind, path }`. The `ref?` field is populated only when the user originally specified `#<ref>` in the add form. **Render the compact form `github: <owner>/<repo>` when `ref` is undefined; `github: <owner>/<repo>#<ref>` when set.** Matches the user's intent that `#main` is omitted unless explicit.

## Watch Out For

- **Adding `"not added"` to REASONS** must land in ONE atomic commit with: (a) the tuple addition, (b) the catalog states using it, (c) any UAT fixtures referencing it. Per v1.3 retrospective lesson, splitting the change across commits guarantees a RED intermediate.
- **PI-7 hash version display**: persisted `hash-<12hex>` renders as `v#<7hex>` via existing `formatHashVersionForDisplay`. Info commands reuse this -- no new render path needed.
- **Description hard-wrap at col 66**: catalog PL-4 (lines 281-297) defines col-66 truncation for `list` (single-line, ellipsis). For `info`, hard-wrap at col 66 with no ellipsis -- this is a NEW renderer helper (`wrapDescription(text, indentCol, wrapCol)`) that the plugin-info renderer calls.
- **`components: not resolved`** is a render-time marker, not a closed-set member. Decide whether to encode this as a typed field on the plugin info variant (e.g., `componentsResolved: false`) or as a literal string emitted when the orchestrator can't resolve. Type-encoding is safer (compile-time exhaustiveness via discriminated-union).
- **Marketplace info has NO plugin rows** per user decision. The renderer needs a code path that emits the marketplace header alone followed by 3 indented detail lines (`github:`/`path:`, `last_updated:`, `description:`) -- this is a NEW marketplace-block shape not currently in the catalog. Encode via a new message variant `MarketplaceInfoMessage` or extend `MarketplaceNotificationMessage` with optional info-detail fields. Type-encoding preferred (NFR-7 discriminated-union discipline).
- **`{not added}` reason placement**: on `marketplace info <missing>`, the failure is at the marketplace level; the byte form is `⊘ <name> [<scope>] (failed) {not added}`. On `--scope` mismatch, the same byte form applies. The closed-set `"not added"` reason serves both surfaces; the same reason will support a future install-error misattribution fix (BACKLOG) where install/uninstall/update/reinstall encounter a missing marketplace and need to surface the precondition failure instead of `{not in manifest}` on a phantom plugin row.

---

*Spec-consistency summary written 2026-06-03 for v1.8 roadmap planning.*
