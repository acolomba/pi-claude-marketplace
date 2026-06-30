---
phase: 73-force-cross-surface-token-unification
plan: 01
subsystem: ui
tags: [notify, discriminated-union, render-token, force-install, output-catalog]

# Dependency graph
requires:
  - phase: 72-unsupported-render-token
    provides: "PluginUnsupportedMessage, ICON_UNSUPPORTED (⊖), the resolver-state-driven (unsupported) vs (unavailable) split on list/info not-installed rows"
  - phase: 69-force-path-severity
    provides: "PluginUnavailableMessage.forceHint + FORCE_INSTALL_HINT_TRAILER (SEV-02 install hint), cascadeSkipSeverity SEV-04 cardinality split"
provides:
  - "Install-failure surface renders ⊖ (unsupported) for a force-degradable plugin (XSURF-01), keeping the --force install trailer"
  - "info.ts non-locally-resolvable arm derives status + reason source from resolved.state (XSURF-02, latent-divergence repair)"
  - "Manual no---force update decline renders the (force-upgradable) token + a new update-worded --force trailer with a list-consistent degrade reason (XSURF-03)"
  - "FORCE_UPDATE_HINT_TRAILER frozen DOC literal; forceHint? on PluginUnsupportedMessage and PluginForceUpgradableMessage"
  - "PluginUpdateSkippedOutcome.forceUpgradable discriminant field"
affects: [bulk-update-grammar, force-install milestone UAT, output-catalog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-side resolver-state split, sourcing the render token from a typed discriminant (entityErrorRow.forceable / err.shape.forceable / resolved.state), never from the reason brace"
    - "forceHint?-gated trailer composition kept central in the renderer, out of per-row render arms"
    - "Cross-surface reason byte-parity via the shared narrowUnsupportedKinds seam"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/notify.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts"
    - "extensions/pi-claude-marketplace/orchestrators/types.ts"
    - "docs/output-catalog.md"
    - "docs/messaging-style-guide.md"

key-decisions:
  - "XSURF-03 reason sourced via narrowUnsupportedKinds (the list-row helper), NOT the install-path narrowResolverReasons, to guarantee byte-parity with the list (force-upgradable) row"
  - "XSURF-03 SEV-04 split moved onto the force-upgradable status arm (cardinality === single ? warning : info); cascadeSkipSeverity left untouched"
  - "Install split kept at compose time (composeNotInstallableMessage); classifyEntityShapeError still emits status: unavailable for the thrown shape"

patterns-established:
  - "Token follows resolved.state across install-failure, info-non-resolvable, and update-decline surfaces (extends D-64-01)"
  - "forceUpgradable discriminant on the skipped outcome, not the reason string, so only the force-upgradable arm flips"

requirements-completed: [XSURF-01, XSURF-02, XSURF-03]

coverage:
  - id: D1
    description: "XSURF-01: no---force install of a force-degradable unsupported plugin renders ⊖ (unsupported) + the --force install trailer; structural unavailable stays ⊘ no trailer"
    requirement: "XSURF-01"
    verification:
      - kind: unit
        ref: "tests/shared/notify-v2.test.ts#XSURF-01: unsupported install-failure row with forceHint emits the --force install trailer"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#SEV-02 / D-69-03: composeInstallFailureMessage points at --force iff the verdict is force-degradable"
        status: pass
    human_judgment: false
  - id: D2
    description: "XSURF-02: info.ts non-locally-resolvable arm derives status + reason source from resolved.state; existing non-path unavailable rows byte-unchanged (latent)"
    requirement: "XSURF-02"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts (full suite green; XSURF-02 is masked latent-divergence repair, no live byte change)"
        status: pass
    human_judgment: false
  - id: D3
    description: "XSURF-03: manual no---force update decline of a force-upgradable plugin renders ● (force-upgradable) {degrade reason} + update --force trailer at warning (targeted) / info (bulk); reason byte-identical to list"
    requirement: "XSURF-03"
    verification:
      - kind: unit
        ref: "tests/shared/notify-v2.test.ts#XSURF-03: force-upgradable update-decline row with forceHint emits the --force update trailer"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/update.test.ts#XSURF-03 / SEV-04: the manual `update` path (no --force) of a force-upgradable candidate declines with `(force-upgradable) {lsp}`"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/update.test.ts#XSURF-03 / SEV-04: bulk update skipping a force-upgradable candidate -> info"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#XSURF-03: update-decline force-upgradable reason brace === list force-upgradable brace (same kinds)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Byte-exact catalog/style-guide reconciliation; closed sets unchanged; npm run check green"
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts (REASONS=32, STATUS_TOKENS=23, PLUGIN_STATUSES=18 unchanged)"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

# Metrics
duration: 28min
completed: 2026-06-30
status: complete
---

# Phase 73 Plan 01: Force Cross-Surface Token Unification Summary

**Extended the Phase-72 resolver-state-driven render token to the install-failure (⊖ unsupported) and manual update-decline (● force-upgradable) surfaces, repaired the info.ts non-resolvable latent divergence, and replaced the misleading `{no longer installable}` update-decline reason with a list-consistent degrade reason pointing at `--force`.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- XSURF-01: the no-`--force` install failure of a force-degradable plugin now renders `⊖ … (unsupported) {reasons}` plus the SEV-02 `--force` install trailer (consistent with how `list`/`info` describe the same plugin); a structural `unavailable` install stays `⊘ … (unavailable)` with no trailer.
- XSURF-02: `info.ts`'s non-locally-resolvable arm derives both its status and its reason source from `resolved.state` (parity with the list surface) instead of hardcoding `unavailable` — latent-divergence repair (no live byte change today).
- XSURF-03: a manual no-`--force` `update` of a force-upgradable plugin now declines with the `● … (force-upgradable) {degrade reason}` token + a NEW update-worded `--force` trailer, sourcing the degrade reason through the SAME `narrowUnsupportedKinds` seam the `list (force-upgradable)` row uses (byte-parity, asserted). The SEV-04 split (targeted=warning, bulk=info) is preserved, moved onto the status arm.
- Closed sets unchanged (REASONS=32, STATUS_TOKENS=23, PLUGIN_STATUSES=18); `npm run check` green (2504 unit + 16 integration tests pass).

## Task Commits

1. **Task 1: notify.ts type + trailer foundation + Wave-0 renderer byte tests** — `a79663aa` (feat) — TDD types + four renderer byte cases landed together (the byte tests reference the new `forceHint?` fields).
2. **Task 2: producer flips — install (XSURF-01), info (XSURF-02), update-decline (XSURF-03) + messaging maps** — `4544c282` (feat)
3. **Task 3: byte-exact catalog + style-guide reconciliation, full green gate** — `6d1a663f` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` — `forceHint?` on `PluginUnsupportedMessage` + `PluginForceUpgradableMessage`; `FORCE_UPDATE_HINT_TRAILER` literal; widened install trailer gate + new update trailer gate.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `composeNotInstallableMessage` splits on `entityErrorRow.forceable` → `unsupported` (forceHint) vs `unavailable`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` — `INSTALL_STATUSES`/`InstallMsg`/`INSTALL_RENDER` gain the `unsupported` arm.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — non-resolvable arm derives status + reasons from `resolved.state`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — catch arm sources the discriminant from `err.shape.forceable` and marks `forceUpgradable`; `projectSkippedOutcome` flips the force-upgradable decline to the `force-upgradable` token (extracted to keep cognitive complexity in budget).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` — `UPDATE_STATUSES`/`UpdateMsg`/`UPDATE_RENDER` gain the `force-upgradable` arm.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` — `PluginUpdateSkippedOutcome.forceUpgradable?` discriminant.
- `docs/output-catalog.md`, `docs/messaging-style-guide.md` — byte-exact token/trailer reconciliation + frozen-DOC-contract update.
- `tests/shared/notify-v2.test.ts`, `tests/orchestrators/plugin/{install,update}.test.ts`, `tests/architecture/catalog-uat.test.ts`, `tests/edge/handlers/plugin/update.test.ts` — byte-form flips, SEV-04 regression, cross-surface byte-parity assertion.

## Decisions Made

- **XSURF-03 reason helper (reconciled per plan's Task 3 directive):** the plan's Task 2 prose named `narrowResolverReasons(err.shape.reasons, err.shape.unsupportedKinds)`, but Task 3's byte-parity assertion requires the brace to be byte-identical to the `list (force-upgradable)` row, which uses `narrowUnsupportedKinds(candidateResolved.unsupported)`. `narrowResolverReasons` prepends `narrowUnsupportedKinds(...)` and THEN folds in note-derived reasons, so it can diverge from `list` for note-bearing candidates. Chose `narrowUnsupportedKinds(err.shape.unsupportedKinds)` — already imported in update.ts and the exact `list` seam — which guarantees parity. The plan explicitly authorized this reconciliation ("use whichever the `list` row uses").
- **Install split kept at compose time** (`composeNotInstallableMessage`), per RESEARCH Note A: `classifyEntityShapeError` still returns `status: "unavailable"` (it classifies the thrown shape); the compose helper reads `forceable` and picks the render token. Minimizes the `EntityErrorRow` type surface.
- **SEV-04 preserved by STATUS, not reason string:** the force-upgradable projection arm applies `cardinality === "single" ? "warning" : "info"` directly; `cascadeSkipSeverity` is untouched (its `no longer installable` branch still serves structural declines).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `err.shape.forceable` requires narrowing on `kind` first**
- **Found during:** Task 2
- **Issue:** `PluginShapeErrorShape` is a discriminated union; `forceable`/`unsupportedKinds` exist only on the `not-installable`/`no-longer-installable` arms. Branching on `err.shape.forceable` alone is a `TS2339`.
- **Fix:** Narrowed the catch guard to `err.shape.kind === "no-longer-installable" && err.shape.forceable` (the kind `requireInstallable` throws).
- **Files modified:** update.ts
- **Verification:** `tsc --noEmit` clean.
- **Committed in:** `4544c282`

**2. [Rule 3 - Blocking] Cognitive-complexity + lint cleanups**
- **Found during:** Task 2 (pre-commit `npm lint`)
- **Issue:** the new force-upgradable branch pushed `outcomeToCascadePluginMessage` over the cognitive-complexity budget (19 > 15); a redundant `=== true` boolean compare; a missing padding line.
- **Fix:** extracted the `skipped` arm into `projectSkippedOutcome`; dropped the redundant `=== true`; added the padding line.
- **Files modified:** update.ts, install.ts
- **Verification:** `npm run lint` clean; producer tests still green.
- **Committed in:** `4544c282`

**3. [Rule 1 - Bug] Edge-handler update decline fixture asserted the old token**
- **Found during:** Task 3 (`npm run check`)
- **Issue:** `tests/edge/handlers/plugin/update.test.ts:378` asserted the old `(skipped) {no longer installable}` decline form, which XSURF-03 replaced — an in-scope downstream fixture flip not listed in the plan's `files_modified`.
- **Fix:** flipped the assertion to the `(force-upgradable)` token + update trailer.
- **Files modified:** tests/edge/handlers/plugin/update.test.ts
- **Verification:** `npm run check` green.
- **Committed in:** `6d1a663f`

---

**Total deviations:** 3 auto-fixed (1 type-blocking, 1 lint/complexity-blocking, 1 downstream fixture bug). **Impact:** all necessary to land the planned behavior; no scope creep — every change traces to XSURF-01/02/03.

## Issues Encountered

- **Pre-existing NUL byte in `info.ts`:** a `\x00` delimiter at line 320 (`${drop.event}\x00${matcher ?? ""}` dedup key) makes `grep` treat the file as binary and silently suppress matches. It is an intentional domain separator, NOT a defect, and is unrelated to this plan — left as-is. Use `grep -a` when searching that file.

## Known Stubs

None — pure render-token/reason wording change; no placeholders, empty data sources, or TODOs introduced.

## Next Phase Readiness

- Phase 74 (bulk-update grammar) depends on the `skip-force-upgradable-bulk` catalog state, which now renders the `(force-upgradable)` token — Phase 74's fixtures must reflect this token (the cross-phase guard noted in planning).

## Self-Check: PASSED

- SUMMARY.md present at `.planning/phases/73-force-cross-surface-token-unification/73-01-SUMMARY.md`.
- All three task commits exist: `a79663aa`, `4544c282`, `6d1a663f`.

---
*Phase: 73-force-cross-surface-token-unification*
*Completed: 2026-06-30*
