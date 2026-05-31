---
phase: 27-marketplace-autoupdate-output-grammar
plan: 05
subsystem: ui
tags: [notify, output-grammar, marketplace, update, autoupdate, change-detection, catalog-uat, UXG-05, gap-closure]

# Dependency graph
requires:
  - phase: 27-marketplace-autoupdate-output-grammar (plan 27-04)
    provides: "RefreshSnapshot.changed manifest-content change detector + the autoupdate-OFF (skipped) {up-to-date} no-op + the update-no-op-skipped catalog state -- the byte form + signal this plan reuses on the autoupdate-ON path"
provides:
  - "marketplace update on an autoupdate-ON marketplace renders (skipped) {up-to-date} on a true no-op (snapshot.changed === false AND every cascade outcome unchanged) instead of the always-emitted (updated) -- closes the Phase 27 UAT Test-3 gap (UXG-05, severity major)"
  - "WR-01 comment correction: manifestContentKey no longer claims typebox .Parse yields a stable key order; it describes the raw JSON.parse comparison and warns against optimizing into .Parse()"
  - "WR-02 ENOENT-narrowed PRE-read catch: only a genuine no-manifest-yet (ENOENT) maps to the changed-safe default; EACCES / malformed JSON / schema-invalid PRE-read failures propagate to the existing (failed) path"
  - "WR-03 coverage closure: orchestrator tests for the autoupdate-ON no-op + the autoupdate-ON plugin-update regression guard; catalog + catalog-uat + notify-v2 byte coverage for the autoupdate-ON no-op"
affects: [phase-28, notification-output-polish, marketplace-update, UXG-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Autoupdate-ON no-op gate: a true no-op requires BOTH the content-compare signal (snapshot.changed === false) AND outcomes.every(o => o.partition === 'unchanged'); when both hold the autoupdate-ON cascade converges to the SAME (skipped) {up-to-date} payload (plugins:[]) as the autoupdate-OFF no-op -- updated/skipped/failed outcomes are NOT no-ops and keep the existing (updated)-with-rows / failed routing"
    - "WR-02 errno-narrowing on the PRE read: gate the catch on (err as NodeJS.ErrnoException).code === 'ENOENT' (mirrors reasonsFromCascadeError); re-throw all other failures so a corrupt/unreadable pre-existing manifest routes to (failed) instead of silently forcing (updated)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "The autoupdate-ON no-op gate is BOTH-conditions: snapshot.changed === false AND outcomes.every(o => o.partition === 'unchanged'). A `skipped` plugin (e.g. source mismatch) is NOT a clean up-to-date result and a `failed` outcome must keep the existing failed routing, so only `unchanged` counts as a no-op (LOCKED DECISION, plan)."
  - "The autoupdate-ON no-op emits plugins:[] (drops the all-`unchanged` cascade rows) for byte-form consistency with the autoupdate-OFF no-op -- NOT the per-plugin (skipped) {up-to-date} rows (LOCKED DECISION, plan)."
  - "Severity stays warning (mp.status === 'skipped' routes warning via computeSeverity); the UXG-02 info-softening is Phase 28 and is deliberately NOT pre-empted here."
  - "WR-01 is comment-only: the change detector is byte-stable for the same input (diagnosis-confirmed), so the key is NOT canonicalized (LOCKED DECISION, plan). The corrected comment also warns a future maintainer against optimizing loadMarketplaceManifest into .Parse()."
  - "No renderer change: the shared mp-level skipped arm already composes (skipped) {up-to-date} from up-to-date (a REASONS member). The renderer is autoupdate-flag-agnostic; the no-op vs changed distinction is purely the orchestrator's decision."
  - "No closed-set churn: MARKETPLACE_STATUSES (7) / MARKERS (2) / REASONS membership byte-unchanged (notify.ts byte-unchanged across this plan); reused the existing `skipped` status + `up-to-date` reason."

patterns-established:
  - "Mirror the autoupdate-OFF no-op decision on the autoupdate-ON path by ANDing the content-compare signal with a cascade-outcomes no-op predicate, then emitting the identical mp-level skipped payload."

requirements-completed: [UXG-05]

# Metrics
duration: 9min
completed: 2026-05-31
---

# Phase 27 Plan 05: Autoupdate-ON Marketplace-Update No-Op Grammar (UXG-05 Gap Closure) Summary

`marketplace update` on an **autoupdate-ON** marketplace now renders a true no-op as `● <mp> [<scope>] (skipped) {up-to-date}` (warning, no `/reload` trailer) instead of the always-emitted `(updated)`, closing the Phase 27 UAT Test-3 gap (UXG-05, severity major); the fix threads the existing `snapshot.changed` content-compare signal plus a cascade-outcomes no-op predicate into the autoupdate-ON branch, and folds in the two same-file robustness findings (WR-01 comment, WR-02 ENOENT-narrowed catch).

## What Was Built

### Task 1 -- Autoupdate-ON no-op decision + WR-01 comment + WR-02 catch narrowing (orchestrator)

`extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`:

- **(1) Autoupdate-ON no-op gate (the gap fix):** before the autoupdate-ON cascade emission, added a gate `const cascadeIsNoOp = outcomes.every((o) => o.partition === "unchanged"); if (!snapshot.changed && cascadeIsNoOp) { ... return; }` that emits the SAME `{ name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] }` payload as the autoupdate-OFF no-op. `updated` / `skipped` / `failed` outcomes are NOT no-ops, so they fall through to the existing `{ status: "updated", plugins: outcomes.map(outcomeToCascadePluginMessage) }` emission verbatim -- the failed routing and per-plugin cascade mapping are unchanged. Rewrote the CMC-32 / UXG-05 binding comment block to document the no-op vs changed split on both paths and cite the UAT Test-3 gap it closes.
- **(2) WR-01 comment correction (comment-only, LOCKED):** rewrote the `manifestContentKey` docstring to describe the actual behavior -- `loadMarketplaceManifest` returns the raw `JSON.parse` value (`.Check()` only, never `.Parse()`), so the key is `JSON.stringify` of the schema-validated-but-raw parsed manifest whose key order mirrors the source file and which retains unknown fields; any content delta reads as "changed". Removed every claim that `.Parse` is used or that key order is canonical, and added a warning against optimizing `loadMarketplaceManifest` into `.Parse()`.
- **(3) WR-02 catch narrowing:** narrowed the bare `catch { return undefined }` to `catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw err; }`. Only a genuine no-manifest-yet (ENOENT) maps to the changed-safe default; EACCES / malformed JSON / schema-invalid PRE-read failures propagate to `refreshRecord`'s try/catch -> `MarketplaceUpdateError` -> the existing `(failed)` path. Updated the docstring accordingly. Mirrors the `reasonsFromCascadeError` errno-narrowing idiom.

`npm run typecheck` exit 0. No new REASONS/MARKERS/MARKETPLACE_STATUSES members.

### Task 2 -- Catalog state + catalog-uat + notify-v2 + two orchestrator tests (one atomic commit)

- `docs/output-catalog.md`: added the `update-autoupdate-noop-skipped` catalog state (`● official [user] (skipped) {up-to-date}`, warning, no trailer) under the `marketplace update <name>` section; extended the section preamble to note the no-op vs changed distinction now applies on the autoupdate-ON cascade path too. Used the distinct mp name `official` (matching the section's autoupdate-ON cascade examples) so the two no-op fixtures are not confusable with the OFF `local-mp` state.
- `tests/architecture/catalog-uat.test.ts`: added the byte-paired `update-autoupdate-noop-skipped` FIXTURES entry (`piWithBothLoaded()`, `expectedSeverity: "warning"`, `official`/`user`/`skipped`/`["up-to-date"]`/`plugins: []`). Net +1; `examples.length >= 30` holds.
- `tests/shared/notify-v2.test.ts`: added a byte test asserting the autoupdate-ON no-op payload renders `● official [user] (skipped) {up-to-date}`, severity `"warning"`, and no `/reload to pick up changes` substring -- locking that the renderer is autoupdate-flag-agnostic (same shared mp-`skipped` arm).
- `tests/orchestrators/marketplace/update.test.ts`: **tightened** the existing cascade all-unchanged test (the one that previously asserted only trailer-absence and passed against the buggy `(updated)` output -- the test that masked the gap) to also assert `● noupd [project] (skipped) {up-to-date}` + warning severity, preserving its SNM-33 / D-22-01 reload-hint intent. Added a **changed-plugin regression guard**: same seed but `pluginUpdate` returns `partition: "updated"` -> asserts the `(updated)` header + reload-hint trailer (proving Condition B keeps `(updated)` when a plugin actually updated even with `snapshot.changed === false`).

`node --test` on the three targeted suites exit 0 -- 85/85.

### Task 3 -- Full GREEN gate

- `npm run check` exit 0 -- 1148/1148 (typecheck + ESLint + Prettier + tests). Baseline was 1146 at 27-04 close; net +2 (the notify-v2 byte test + the changed-plugin regression test; the all-unchanged test was tightened in place, not added).
- Confirmed: the autoupdate-ON no-op renders `(skipped) {up-to-date}`; the changed/failed paths are unregressed (the every-`unchanged` gate excludes `failed`); `MARKETPLACE_STATUSES` / `MARKERS` / `REASONS` membership byte-unchanged (`notify.ts` byte-unchanged across the plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MU-5 test setup incompatible with the WR-02 narrowing**

- **Found during:** Task 2 (running the orchestrator test surface).
- **Issue:** The pre-existing `MU-5: clone advances + manifest re-validation fails` test seeded an `invalid-manifest` fixture at the clone dir for BOTH the PRE and POST reads. Before WR-02, the PRE-read `manifestContentKey` silently swallowed the malformed-JSON error to `undefined`, letting the refresh proceed so the failure surfaced at the POST `validateManifestAtRoot` with the `cloneAdvanced=true` "clone advanced but manifest could not be persisted" diagnostic the test asserts. With WR-02, the malformed PRE read now (correctly) re-throws BEFORE the clone refresh runs, so `cloneAdvanced` stays false and the diagnostic becomes the generic `Failed to update marketplace` -- the assertion `/cause:.*clone advanced but manifest could not be persisted/` failed.
- **Fix:** Adapted the test to seed a VALID manifest (so the PRE-read key resolves) and overwrite the clone-dir manifest with the `invalid-manifest` fixture in a `checkout` override (mirroring the UXG-05 "changed" test's checkout-rewrite pattern). The clone now advances (fetch + checkout) and the POST re-validation fails -- exactly the clone-advanced retry-hint path the test intends, now reached without relying on the WR-02 blind spot the diagnosis flagged. This validates that WR-02 routes a malformed PRE manifest to `(failed)` instead of silently forcing `(updated)`.
- **Files modified:** `tests/orchestrators/marketplace/update.test.ts`
- **Commit:** `0208dd2`

Note: the pre-commit `prettier` hook reformatted `tests/orchestrators/marketplace/update.test.ts` on the first pass (added-test indentation); restaged and re-ran until clean before committing per CLAUDE.md policy. The added tests passed unchanged after the reformat.

## Threat Model Outcome

- **T-27-05 (Tampering, manifestContentKey PRE/POST read):** mitigated and STRENGTHENED. The key is still computed only from post-`loadMarketplaceManifest` (typebox-`.Check`-validated) content. WR-02 strengthens the mitigation: a corrupt/unreadable PRE manifest now propagates to `(failed)` instead of silently forcing `(updated)` (verified by the adapted MU-5 test).
- **T-27-05b (wrong-decision, autoupdate-ON branch emitting status):** mitigated. The no-op decision gates on `snapshot.changed === false` AND `outcomes.every(unchanged)`; it cannot emit `(skipped)` while a plugin actually updated/installed/failed, so no state-change is masked as a no-op (verified by the changed-plugin regression guard).
- **T-27-SC (package installs):** n/a -- no package installs, no new dependencies, no new closed-set members.

No new security surface introduced.

## Verification

- `npm run typecheck` exit 0 (Task 1 gate).
- `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts tests/orchestrators/marketplace/update.test.ts` exit 0 -- 85/85 (Task 2 gate).
- `npm run check` exit 0 -- 1148/1148 (Task 3 / full gate); re-confirmed exit 0.
- catalog-uat byte-equality gate GREEN: the new `update-autoupdate-noop-skipped` catalog state byte-pairs with its FIXTURES entry; `examples.length >= 30` holds.
- `git diff HEAD~2 HEAD -- shared/notify.ts` empty -> renderer + closed sets byte-unchanged across this plan.
- No comment in `update.ts` claims `.Parse` is used (WR-01); the PRE-read catch re-throws non-ENOENT errors (WR-02).

## Commits

- `932e405` feat(27-05): render autoupdate-ON no-op as (skipped) {up-to-date}  (Task 1, orchestrator decision + WR-01 + WR-02)
- `0208dd2` test(27-05): cover autoupdate-ON no-op (UXG-05 UAT Test-3 gap)  (Task 2, four lockstep files)
- `e12311a` docs(27-05): summarize autoupdate-ON no-op gap closure (UXG-05)  (this SUMMARY)

## Self-Check: PASSED

All 5 modified files + the SUMMARY present on disk; all three commits (`932e405`, `0208dd2`, `e12311a`) found in git history. STATE.md and ROADMAP.md unmodified (orchestrator owns those writes).
