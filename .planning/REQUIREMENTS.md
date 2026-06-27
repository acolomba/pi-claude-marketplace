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
- [ ] **RSTATE-05**: Unsupported-component reasons are derived per-kind from the component list as a marker family distinct from structural reasons, and are identical across `list` and `info` (including soft-dep markers) and across all force states.

### Force Install & Update (FORCE)

- [ ] **FORCE-01**: `install --force <plugin>@<marketplace>` on an `unsupported` plugin installs the supported components and skips the unsupported ones; `--force` on a fully-supported plugin is a no-op and installs normally as `(installed)`.
- [ ] **FORCE-02**: `update --force <plugin>` on a plugin whose newer version became `unsupported` updates it by degrading the now-unsupported components instead of failing.
- [ ] **FORCE-03**: Without `--force`, install/update of an `unsupported` plugin still blocks/fails -- `--force` is the only per-invocation opt-in to component degradation.
- [ ] **FORCE-04**: No `Warning:` summary is emitted in any force path (the explicit `--force` is the opt-in; dropped-component detail lives in `info`).
- [ ] **FORCE-05**: `--force` never bypasses hard failures -- `unavailable`/structural defects, NFR-10 path containment, missing marketplace, and unresolvable source fail/block regardless of `--force`.

### Status, Glyph & Force-Upgradability (FSTAT)

- [ ] **FSTAT-01**: A plugin's force-installed state is **derived** -- recorded as installed and currently re-resolving to `unsupported` -- with no persisted `forceInstalled` flag and no state migration.
- [ ] **FSTAT-02**: Force-installed plugins render with a `force-installed` realized status and the `◉` glyph (distinct from `●` installed) on cascade and list surfaces, driven by the derived state.
- [ ] **FSTAT-03**: A force-installed plugin whose newer version is fully supported returns to `(installed)` automatically after upgrade -- no lingering force state.
- [ ] **FSTAT-04**: `list` shows `force-upgradable` for an installed plugin whose newer candidate would **newly** degrade a currently-clean plugin; a force-installed plugin is never force-upgradable; a `force-upgradable` row wears the `●` glyph (it is currently clean).
- [ ] **FSTAT-05**: The candidate (newer) version that drives `upgradable` / `force-upgradable` is resolved without network access (from cache).
- [ ] **FSTAT-06**: The pending/preview surface renders `will force install` / `will force update` in place of `will install` / `will update` when a force operation is planned.
- [ ] **FSTAT-07**: `/claude:plugin info` reports `force-installed` and surfaces the dropped-component detail; the success notification for a force install/update reads "force-installed".

### List Filters & Completion (LIST)

- [ ] **LIST-01**: `list` gains a `--unsupported` filter; `--installed` spans both `installed` and `force-installed`; no `--upgradable` filter is added.
- [ ] **LIST-02**: When `--force` precedes the plugin positional, `install` completion offers `available` + `unsupported` plugins and `update` completion offers `upgradable` + `force-upgradable` plugins; `unavailable` is excluded in both. Without `--force`, completion is unchanged.

### Reinstall (RINST)

- [ ] **RINST-01**: `reinstall` no longer accepts `--force`; it always overwrites everything (collisions and foreign content) as a repair primitive.

### Load-Time Backfill (BFILL)

- [ ] **BFILL-01**: Load-time reconciliation re-materializes (reinstall semantics) a force-installed plugin's previously-skipped components once the extension supports them, promoting it toward `(installed)` in place -- no upgrade, no manual command.
- [ ] **BFILL-02**: The backfill scan is gated on a new `lastReconciledExtensionVersion` stamp in `state.json` and fires only when the extension version changed (the only thing that can move the supported-kind boundary); an unchanged extension version skips the scan.

### Force Severity (SEV)

Builds on the desired-state, caller-stamped severity model delivered by the notification-refactor workstream. These are the force-specific severity behaviours.

- [ ] **SEV-01**: A direct `install --force` / `update --force` degrade renders at **info** (no `Warning:`); a `reinstall` manual-recovery and a missing soft-dependency companion on an otherwise-successful install render at **warning**.
- [ ] **SEV-02**: Installing an `unsupported` plugin without `--force` renders at **error** with a message pointing at `--force`; installing an `unavailable` (structural) plugin renders at **error** with **no** `--force` suggestion.
- [ ] **SEV-03**: Auto-update of a force-upgradable plugin is taken automatically (no `(skipped) {no longer installable}` for the unsupported-component case); it renders at **warning** only when it **newly** degrades a previously-clean plugin, at **info** when the plugin was already degraded.
- [ ] **SEV-04**: A targeted `update <plugin>@<marketplace>` that declines a force-upgradable upgrade (no `--force`) renders at **warning**; an untargeted/bulk `update` that skips a force-upgradable plugin renders at **info**.
- [ ] **SEV-05**: Any row carries a factual `{reasons}` brace whenever reasons are present, including `installed`, `force-installed`, and `force-upgradable` rows.

### Spec & Documentation Reconcile (DOC)

- [ ] **DOC-01**: PRD §11 reflects `--force` install/update, the three-way resolver state, the new status tokens, and the force-upgradable rules, and removes the dropped items (global force default, manual `complete` command).
- [ ] **DOC-02**: `docs/output-catalog.md` and `docs/messaging-style-guide.md` reflect the reconciled token set (`force-installed`, `unsupported`, `force-upgradable`), the derived-state severity, and the exact byte forms.
- [ ] **DOC-03**: No stale comments claim idempotent autoupdate is "warning" -- such cases are info/benign.

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
| RSTATE-05 | Phase 64 | Pending |
| FORCE-01 | Phase 65 | Pending |
| FORCE-02 | Phase 65 | Pending |
| FORCE-03 | Phase 65 | Pending |
| FORCE-04 | Phase 65 | Pending |
| FORCE-05 | Phase 65 | Pending |
| FSTAT-01 | Phase 66 | Pending |
| FSTAT-02 | Phase 66 | Pending |
| FSTAT-03 | Phase 66 | Pending |
| FSTAT-04 | Phase 66 | Pending |
| FSTAT-05 | Phase 66 | Pending |
| FSTAT-06 | Phase 66 | Pending |
| FSTAT-07 | Phase 66 | Pending |
| LIST-01 | Phase 67 | Pending |
| LIST-02 | Phase 67 | Pending |
| RINST-01 | Phase 67 | Pending |
| BFILL-01 | Phase 68 | Pending |
| BFILL-02 | Phase 68 | Pending |
| SEV-01 | Phase 69 | Pending |
| SEV-02 | Phase 69 | Pending |
| SEV-03 | Phase 69 | Pending |
| SEV-04 | Phase 69 | Pending |
| SEV-05 | Phase 69 | Pending |
| DOC-01 | Phase 70 | Pending |
| DOC-02 | Phase 70 | Pending |
| DOC-03 | Phase 70 | Pending |

**Coverage:**
- Requirements: 30 total
- Mapped to phases: 30 (Phases 64-70) ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-26*
*Last updated: 2026-06-27 after roadmap creation (Phases 64-70 mapped; 30/30 coverage)*
