# Requirements Archive: force-install Force Install

**Archived:** 2026-07-02
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: pi-claude-marketplace — force-install

**Defined:** 2026-06-26
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install. `--force` extends this to *partially*-supported plugins: install the supported components, degrade the unsupported ones, never block.

## Milestone Requirements

Reconciled from the historical `force-install-requirements.md` (which consolidated the scrapped v1.15 Force Install and v1.16 Severity attempts) through a full requirements de-confliction. The load-bearing decisions: force-state is **derived** (no persisted flag, no migration); severity is **desired-state vs end-state**; the resolver gains a **three-way state** so "force degrades components, never hard failures" is type-enforced.

### Resolver State (RSTATE)

The structural foundation: distinguish "not installable, but force can drop the unsupported parts" from "not installable, and force cannot help."

- [x] **RSTATE-01**: The resolver exposes a three-way discriminated state -- `installable` / `unsupported` / `unavailable` -- replacing the binary `installable: true | false`.
- [x] **RSTATE-02**: A structural defect (unreadable/invalid manifest, malformed `hooks.json`, path/NFR-10 containment violation) yields `unavailable` and takes precedence over unsupported component kinds -- a plugin that is both broken and partial resolves `unavailable`.
- [x] **RSTATE-03**: `unsupported` carries `pluginRoot` plus the supported and unsupported component lists; `unavailable` exposes `pluginRoot` to no consumer (type-enforced, NFR-7 refined not weakened).
- [x] **RSTATE-04**: Two narrowing gates exist -- `requireInstallable` (→ `installable` only; default path) and `requireForceInstallable` (→ `installable | unsupported`; `--force` path).
- [x] **RSTATE-05**: Unsupported-component reasons are derived per-kind from the component list as a marker family distinct from structural reasons, and are identical across `list` and `info` (including soft-dep markers) and across all force states.

### Force Install & Update (FORCE)

- [x] **FORCE-01**: `install --force <plugin>@<marketplace>` on an `unsupported` plugin installs the supported components and skips the unsupported ones; `--force` on a fully-supported plugin is a no-op and installs normally as `(installed)`.
- [x] **FORCE-02**: `update --force <plugin>` on a plugin whose newer version became `unsupported` updates it by degrading the now-unsupported components instead of failing.
- [x] **FORCE-03**: Without `--force`, install/update of an `unsupported` plugin still blocks/fails -- `--force` is the only per-invocation opt-in to component degradation.
- [x] **FORCE-04**: No `Warning:` summary is emitted in any force path (the explicit `--force` is the opt-in; dropped-component detail lives in `info`).
- [x] **FORCE-05**: `--force` never bypasses hard failures -- `unavailable`/structural defects, NFR-10 path containment, missing marketplace, and unresolvable source fail/block regardless of `--force`.

### Reload-Deferred Will Grammar (WILL)

- [x] **WILL-01**: The pending/preview surface renders a `will`-prefixed token for a reconciliation action if and only if that action's effect is deferred to the next `/reload`; actions whose effect is immediate render without a bare `will` token.
- [x] **WILL-02**: The `will`-grammar is consistent with the per-command reload-hint discipline -- a pending token carries `will` exactly when its corresponding command path emits the `/reload to pick up changes` trailer.
- [x] **WILL-03**: Marketplace add (immediately effective) does not render `will add`; marketplace remove renders a `will` token only for its reload-deferred plugin-uninstall cascade, not for the immediate source de-registration. Plugin install / uninstall / enable / disable remain reload-deferred and retain their `will` tokens.
- [x] **WILL-04**: `docs/output-catalog.md`, `docs/messaging-style-guide.md`, the status-token closed set, and the byte-exact catalog/notify tests reflect the reconciled grammar.

### Status, Glyph & Force-Upgradability (FSTAT)

- [x] **FSTAT-01**: A plugin's force-installed state is **derived** -- recorded as installed and currently re-resolving to `unsupported` -- with no persisted `forceInstalled` flag and no state migration.
- [x] **FSTAT-02**: Force-installed plugins render with a `force-installed` realized status and the `◉` glyph (distinct from `●` installed) on cascade and list surfaces, driven by the derived state.
- [x] **FSTAT-03**: A force-installed plugin whose newer version is fully supported returns to `(installed)` automatically after upgrade -- no lingering force state.
- [x] **FSTAT-04**: `list` shows `force-upgradable` for an installed plugin whose newer candidate would **newly** degrade a currently-clean plugin; a force-installed plugin is never force-upgradable; a `force-upgradable` row wears the `●` glyph (it is currently clean).
- [x] **FSTAT-05**: The candidate (newer) version that drives `upgradable` / `force-upgradable` is resolved without network access (from cache).
- [x] **FSTAT-06**: The pending/preview surface renders `will force install` / `will force update` in place of `will install` / `will update` when a force operation is planned.
- [x] **FSTAT-07**: `/claude:plugin info` reports `force-installed` and surfaces the dropped-component detail; the success notification for a force install/update reads "force-installed".

### List Filters & Completion (LIST)

- [x] **LIST-01**: `list` gains a `--unsupported` filter; `--installed` spans both `installed` and `force-installed`; no `--upgradable` filter is added.
- [x] **LIST-02**: When `--force` precedes the plugin positional, `install` completion offers `available` + `unsupported` plugins and `update` completion offers `upgradable` + `force-upgradable` plugins; `unavailable` is excluded in both. Without `--force`, completion is unchanged.

### Reinstall (RINST)

- [x] **RINST-01**: `reinstall` no longer accepts `--force`; it always overwrites everything (collisions and foreign content) as a repair primitive.

### Load-Time Backfill (BFILL)

- [x] **BFILL-01**: Load-time reconciliation re-materializes (reinstall semantics) a force-installed plugin's previously-skipped components once the extension supports them, promoting it toward `(installed)` in place -- no upgrade, no manual command.
- [x] **BFILL-02**: The backfill scan is gated on a new `lastReconciledExtensionVersion` stamp in `state.json` and fires only when the extension version changed (the only thing that can move the supported-kind boundary); an unchanged extension version skips the scan.

### Force Severity (SEV)

Builds on the desired-state, caller-stamped severity model delivered by the notification-refactor workstream. These are the force-specific severity behaviours.

- [x] **SEV-01**: A direct `install --force` / `update --force` degrade renders at **info** (no `Warning:`); a `reinstall` manual-recovery and a missing soft-dependency companion on an otherwise-successful install render at **warning**.
- [x] **SEV-02**: Installing an `unsupported` plugin without `--force` renders at **error** with a message pointing at `--force`; installing an `unavailable` (structural) plugin renders at **error** with **no** `--force` suggestion.
- [x] **SEV-03**: Auto-update of a force-upgradable plugin is taken automatically (no `(skipped) {no longer installable}` for the unsupported-component case); it renders at **warning** only when it **newly** degrades a previously-clean plugin, at **info** when the plugin was already degraded.
- [x] **SEV-04**: A targeted `update <plugin>@<marketplace>` that declines a force-upgradable upgrade (no `--force`) renders at **warning**; an untargeted/bulk `update` that skips a force-upgradable plugin renders at **info**.
- [x] **SEV-05**: Any row carries a factual `{reasons}` brace whenever reasons are present, including `installed`, `force-installed`, and `force-upgradable` rows.

### Spec & Documentation Reconcile (DOC)

- [x] **DOC-01**: PRD §11 reflects `--force` install/update, the three-way resolver state, the new status tokens, and the force-upgradable rules, and removes the dropped items (global force default, manual `complete` command).
- [x] **DOC-02**: `docs/output-catalog.md` and `docs/messaging-style-guide.md` reflect the reconciled token set (`force-installed`, `unsupported`, `force-upgradable`), the derived-state severity, and the exact byte forms.
- [x] **DOC-03**: No stale comments claim idempotent autoupdate is "warning" -- such cases are info/benign.

### Partial Hook Force-Install (PHOOK)

Extends `--force` component degradation to hooks: a parseable-but-unsupportable `hooks.json` becomes force-degradable instead of a structural failure, so the supportable handlers install and only the unsupportable ones are dropped.

- [x] **PHOOK-01**: `checkMatcherSupportability` partitions a parsed `hooks.json` into supported vs unsupported handlers at BOTH event level (non-bucket-A events) and matcher level (unsupported matchers on a supported event), instead of rejecting the whole config on the first failure.
- [x] **PHOOK-02**: A plugin whose `hooks.json` parses but contains at least one unsupportable handler, with no structural defect, resolves `unsupported` (force-degradable) rather than `unavailable`; the dropped handlers surface via `partial.unsupported` (not the structural `dirty` accumulator).
- [x] **PHOOK-03**: Structural precedence is preserved -- an unparseable `hooks.json` or a malformed handler (e.g. `type:"command"` with no `command`) still resolves `unavailable`; only supportability failures (event/matcher) become degradable.
- [x] **PHOOK-04**: `install --force` materializes the supported components plus a FILTERED `hooks.json` containing only the supportable handlers; dropped handlers are never staged by the hooks bridge. Without `--force`, the plugin still blocks.
- [x] **PHOOK-05**: Dropped hook handlers render as `{unsupported hooks}` reasons on the force-installed row at the correct desired-state severity, identical across `list` and `info`; the byte-exact catalog/style-guide and notify tests reflect the partial-hook rows.

### Unsupported Render Token (USTAT)

Closes the D-64-01 deferral: the render layer collapsed both resolver `unsupported` (force-installable) and `unavailable` (structural) into one `(unavailable)` / `⊘` row, deferring distinct glyphs/states to "a later phase". DOC-02 already documented an `unsupported` token the display never emitted. This gives the not-installed force-installable row its own token and glyph.

- [x] **USTAT-01**: A not-installed plugin that resolves `unsupported` (force-installable: unsupported components, no structural defect) renders a distinct `(unsupported)` status token with a dedicated `⊖` glyph in both `list` and `info`, instead of collapsing into the `(unavailable)` / `⊘` render. A structurally-`unavailable` plugin still renders `(unavailable)` / `⊘`. `⊘` stays reserved for `unavailable` / blocked / failed rows.
- [x] **USTAT-02**: `STATUS_TOKENS` gains an `"unsupported"` member (closed-set tripwire bumped) and the new row keeps its per-kind `{unsupported hooks}` / `{lsp}` reason braces via `narrowUnsupportedKinds`; the `--unsupported` / `--unavailable` list filters keep partitioning on the pre-collapse resolver bucket; the OUT-08 closed-set invariant test and `list`/`info` catalog/golden fixtures are updated byte-exact.

### Force Cross-Surface Token Unification (XSURF)

Extends the Phase 72 `⊖ (unsupported)` de-collapse to the surfaces it did not cover (install failure, update decline) so a force-installable plugin reads consistently everywhere. Surfaced by the force-install milestone UAT (2026-06-29). Severity is already correct (SEV-02 / SEV-04) and is NOT changed -- only the token + reason wording.

- [x] **XSURF-01**: The install-failure surface renders an `unsupported` (force-installable) plugin with the `⊖ (unsupported)` token consistent with `list`/`info`, not `⊘ (unavailable)`; the SEV-02 `--force` hint is preserved.
- [x] **XSURF-02**: `info.ts`'s non-locally-resolvable arm derives its status from `resolved.state` (matching the `list` surface) instead of hardcoding `"unavailable"` (UAT review finding IN-01).
- [x] **XSURF-03**: A manual `update` decline of a force-upgradable plugin surfaces a force-aware reason (not the misleading `{no longer installable}`) and points the user at `--force`; the SEV-04 severity split (targeted=warning, bulk=info) is preserved.

### Bulk Update Grammar Refinement (UGRM)

Pre-existing v1.5 (UXG-05) / v1.11 bulk-update grammar surfaced by the same UAT: a bulk `update` lists every up-to-date plugin and counts at-desired-state rows as "successes". Not force-install-specific; refines the cascade + summary for consistency with the project's benign-no-op suppression philosophy (UXG-02). Target grammar settled in spec/discuss.

- [x] **UGRM-01**: A bulk `update` does not emit a per-plugin `(skipped) {up-to-date}` row for every unchanged plugin (exact suppress-vs-summarize shape settled in spec); an all-up-to-date bulk update still communicates the no-op clearly.
- [x] **UGRM-02**: The bulk-update summary line distinguishes "updated" from "already at desired state" so the headline count reflects operations performed, not unchanged no-ops; `docs/output-catalog.md` / `docs/messaging-style-guide.md` and the byte-exact update tests are reconciled.

## Out of Scope

Explicitly excluded; documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Global always-force config default | Pure convenience; everything it enables is reachable via per-command `--force`. New config field + merge + migration to save four keystrokes. User explicitly declined. (was FORCE-06) |
| Manual `complete` command | Redundant with `reinstall` (same re-materialize) + automatic load-time backfill + `/reload`. (was FCOMPLETE-01) |
| Persisted `forceInstalled` flag / sticky-flag state | Superseded by the derived-state model; was built and removed in the v1.15 attempt -- do not rebuild. (was FSTATE-01/02/03) |
| `reinstall --force` axis | Removed; reinstall now always overwrites. (was the v1.15 reinstall force axis) |
| `--upgradable` list filter | Unrequested; `--unsupported` is the only new filter justified by a new base status. |
| Desired-state severity mechanism + non-force command severities | Foundation delivered by the notification-refactor workstream (caller-stamped per-row severity, max-reduce cascade, enable/disable/uninstall/marketplace-remove severities); this milestone wires force onto it, does not re-deliver it. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RSTATE-01 | Phase 64 | Complete |
| RSTATE-02 | Phase 64 | Complete |
| RSTATE-03 | Phase 64 | Complete |
| RSTATE-04 | Phase 64 | Complete |
| RSTATE-05 | Phase 64 | Complete |
| FORCE-01 | Phase 65 | Complete |
| FORCE-02 | Phase 65 | Complete |
| FORCE-03 | Phase 65 | Complete |
| FORCE-04 | Phase 65 | Complete |
| FORCE-05 | Phase 65 | Complete |
| WILL-01 | Phase 65.1 | Complete |
| WILL-02 | Phase 65.1 | Complete |
| WILL-03 | Phase 65.1 | Complete |
| WILL-04 | Phase 65.1 | Complete |
| FSTAT-01 | Phase 66 | Complete |
| FSTAT-02 | Phase 66 | Complete |
| FSTAT-03 | Phase 66 | Complete |
| FSTAT-04 | Phase 66 | Complete |
| FSTAT-05 | Phase 66 | Complete |
| FSTAT-06 | Phase 66 | Complete |
| FSTAT-07 | Phase 66 | Complete |
| LIST-01 | Phase 67 | Complete |
| LIST-02 | Phase 67 | Complete |
| RINST-01 | Phase 67 | Complete |
| BFILL-01 | Phase 68 | Complete |
| BFILL-02 | Phase 68 | Complete |
| SEV-01 | Phase 69 | Complete |
| SEV-02 | Phase 69 | Complete |
| SEV-03 | Phase 69 | Complete |
| SEV-04 | Phase 69 | Complete |
| SEV-05 | Phase 69 | Complete |
| DOC-01 | Phase 70 | Complete |
| DOC-02 | Phase 70 | Complete |
| DOC-03 | Phase 70 | Complete |
| PHOOK-01 | Phase 71 | Complete |
| PHOOK-02 | Phase 71 | Complete |
| PHOOK-03 | Phase 71 | Complete |
| PHOOK-04 | Phase 71 | Complete |
| PHOOK-05 | Phase 71 | Complete |
| USTAT-01 | Phase 72 | Complete |
| USTAT-02 | Phase 72 | Complete |
| XSURF-01 | Phase 73 | Complete |
| XSURF-02 | Phase 73 | Complete |
| XSURF-03 | Phase 73 | Complete |
| UGRM-01 | Phase 74 | Complete |
| UGRM-02 | Phase 74 | Complete |

**Coverage:**

- Requirements: 42 total
- Mapped to phases: 42 (Phases 64-74) ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-26*
*Last updated: 2026-06-29 after Phases 73-74 added from the force-install milestone UAT (XSURF-01..03 force cross-surface unification; UGRM-01..02 bulk-update grammar); Phases 64-74 mapped, 42/42 coverage*
