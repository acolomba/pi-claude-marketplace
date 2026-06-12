---
phase: 56-write-back-integration-documentation
reviewed: 2026-06-11T05:47:59Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - tests/persistence/config-write-back.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/no-split-01-cast-reads.test.ts
  - tests/orchestrators/import/execute.test.ts
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-06-11T05:47:59Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed the Phase 56 config write-back integration: the new
`persistence/config-write-back.ts` module, the cross-cutting
`edge/handlers/shared.ts` `--local` scanner, every mutating orchestrator that
gained write-back, the read-side SPLIT-01 rewires (list/info), the import
batched post-pass, the edge handlers that thread `--local`, and the
supporting tests.

Invariants verified to hold: target-path selection happens once and never
falls back to base on `--local` (invariant 2); all config writes route
through `saveConfig` via the write-back helpers (invariant 8); the import
post-pass performs exactly one `saveConfig` per scope under one lock
(invariant 6); the SPLIT-01 cast-read allow-list is empty and the seven
read sites are rewired to `loadMergedScopeConfig` (invariant 7); add writes
the verbatim `rawSource`; orchestrated-mode calls skip write-back everywhere
(WR-09).

Two invariants are violated. Invariant 5 ("post-command reconcile is a
no-op") breaks on the bare-form autoupdate flip (CR-01, a last-write-wins
clobber across multiple marketplaces) and on the cross-scope CMP-3 install
fallback (CR-02, a dangling plugin declaration without its marketplace
declaration that the planner converts into a planned marketplace removal
plus a perpetual failed row). Several lower-severity gaps degrade the
RECON-05 byte-stability discipline and the documented CFG-03 abort
semantics.

## Critical Issues

### CR-01: Bare-form autoupdate flip clobbers all but the last marketplace's config write

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:307-319`
**Issue:** `writeAutoupdateBack` loops over `changed` names calling
`writeMarketplaceConfigEntry(current, ...)` with the SAME stale `current`
snapshot on every iteration. `writeMarketplaceConfigEntry`
(`config-write-back.ts:50-65`) builds its patched document from `current`
(which never gains the previous iteration's patch) and saves the whole file.
With two or more fresh-flippable marketplaces — the normal case for the
bare form `/claude:plugin marketplace autoupdate` (no name), since
`applyAutoupdateFlipInPlace` (`marketplace/shared.ts:451-460`) flips every
marketplace in the scope — each save OVERWRITES the previous one. Only the
LAST marketplace's `autoupdate` (and any synthesized `source`) survives in
`claude-plugins.json`. The user is told every marketplace flipped
(`status: "autoupdate enabled"` rows for all), but config-side truth — the
declared source of truth after SPLIT-01 — is stale for N-1 of them: the next
same-value flip reclassifies them as "fresh" again, and the next reconcile
sees a config/state divergence. This is silent data loss in the
user-authored config and a direct violation of invariant 5.

No test covers the multi-marketplace bare form:
`tests/architecture/config-state-consistency.test.ts` flips a single named
marketplace only, and `tests/persistence/config-write-back.test.ts` never
exercises sequential `writeMarketplaceConfigEntry` calls against a stale
snapshot.
**Fix:** Accumulate one `BatchedConfigPatch` across the `changed` loop and
issue a single `writeBatchedConfigEntries` call (this also closes WR-06):
```ts
async function writeAutoupdateBack(current, state, targetConfigPath, scopeRoot, changed, enable) {
  const marketplaces: Record<string, Partial<MarketplaceConfigEntry>> = {};
  for (const name of changed) {
    marketplaces[name] = buildAutoupdatePatch(current, state, name, enable);
  }
  await writeBatchedConfigEntries(current, targetConfigPath, scopeRoot, { marketplaces });
}
```
Add a regression test: bare-form flip with two marketplaces in one scope,
assert BOTH entries carry `autoupdate` in the read-back config.

### CR-02: Cross-scope install (CMP-3 fallback) writes a dangling plugin declaration; next reconcile plans the marketplace's removal

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:871-887` (also `orchestrators/plugin/enable-disable.ts:366-376` for the enable path)
**Issue:** When a project-scope install resolves the marketplace via the
CMP-3 user-scope fallback, `runInstallLedger` clones the marketplace record
into PROJECT state (`install.ts:407-411`), and the standalone write-back
records `plugin@mp` into the PROJECT config — but NO marketplace entry for
`mp` is ever written to the project config (only `marketplace add` writes
marketplace entries, and it ran at USER scope). The Phase 53 planner then
produces a non-no-op, destructive plan for the project scope on the very
next reconcile:
- `reconcile/plan.ts:333-343`: the declared `plugin@mp` key has no declared
  marketplace → a perpetual dangling `(failed)` `<marketplace not declared>`
  source-mismatch row.
- `reconcile/plan.ts:220-227`: the cloned project-state marketplace record
  is recorded-but-undeclared → it lands in `marketplacesToRemove`, so the
  reconcile-driven apply tears down the marketplace clone (and with it the
  plugin the user just installed).

The recorded-but-undeclared clone removal pre-dates this phase, but the
Phase 56 write-back makes it strictly worse: it adds a config declaration
that can never converge (the plugin key survives the marketplace teardown
and re-surfaces as dangling on every load). This directly violates this
phase's invariant 5 (post-command reconcile must be a no-op) and WB-01
SC#4. The architecture test (`config-state-consistency.test.ts`) only
covers same-scope add+install paths, so the gap is untested.
**Fix:** In the standalone write-back arm, when the marketplace record was
materialized via the CMP-3 fallback (or more simply: whenever the targeted
config does not declare `marketplace`), write the marketplace entry in the
same patch using the cloned record's verbatim `source.raw` — i.e. use
`writeBatchedConfigEntries` with both the marketplace entry and the plugin
key, mirroring `buildAutoupdatePatch`'s source synthesis. Add an
architecture test: user-scope add, project-scope install of `plugin@mp`,
assert `planReconcile(projectMerged, projectState, "project")` is empty.

## Warnings

### WR-01: Import skip path never repairs missing config declarations; a failed batched post-pass converges destructively, not "self-healingly"

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:795-835` (batch builder), `execute.ts:782-792` (failure arm)
**Issue:** `buildBatchedPatchForScope` includes only `addedMarketplaces` and
`installedPlugins`. `skippedExistingMarketplaces` / `skippedExistingPlugins`
(already present in STATE) are never written to config. If state carries an
entry that config does not declare — e.g. the previous import's batched
post-pass failed (the `catch` at line 782 records a diagnostic and moves
on), or legacy pre-config state — then: (a) re-running import SKIPS the
entry as "already-present" and never repairs the config, and (b) the next
reconcile plans the recorded-but-undeclared marketplace for REMOVAL
(`reconcile/plan.ts:220-227`) and undeclared plugins for UNINSTALL
(`buildUninstallBucket`). The comment at line 716 claims the race window
"self-heals on next reconcile" — it converges, but toward tearing down what
import just installed, which is the opposite of healing. The write-back
failure is therefore not transient: it is permanent until the user
hand-edits the config.
**Fix:** Include skip outcomes in the batched patch (writing an
already-declared entry is a no-op merge; writing a missing one repairs the
declaration). Gate on key-absence in the loaded config if RECON-05 byte
stability for the all-declared case matters. Correct the "self-heals"
comment either way.

### WR-02: Delete write-backs are unconditional — uninstall/remove rewrite (or CREATE) the config file even when the entry is absent

**File:** `extensions/pi-claude-marketplace/persistence/config-write-back.ts:72-97` and `:127-144`; callers `orchestrators/plugin/uninstall.ts:490-499`, `orchestrators/marketplace/remove.ts:390-393`
**Issue:** `deletePluginConfigEntry` and
`deleteMarketplaceConfigEntryWithCascade` always call `saveConfig`, and both
normalize absent maps to `{}` (`plugins`, `marketplaces`). Consequences:
(a) uninstalling a plugin whose declaration is not in the TARGETED physical
file (e.g. declared only in `claude-plugins.local.json` while targeting
base, or not declared at all) rewrites the base file anyway — adding an
empty `plugins: {}` map and bumping mtime for a semantic no-op; (b) when
the config file is ABSENT (`loadConfig` → `absent`, `current =
{ schemaVersion: 1 }`), a `marketplace remove` or `plugin uninstall`
CREATES `claude-plugins.json` containing only empty maps. Both contradict
the RECON-05 byte/mtime-stability discipline this phase applies carefully
elsewhere (autoupdate's idempotent skip, reinstall/update's key-presence
short-circuit).
**Fix:** Short-circuit in the orchestrator (or helper) when the key is
absent from the loaded targeted config — mirror the
`maybeWritePluginConfigBack` key-presence gate in reverse:
```ts
if (cfg.status !== "valid" || cfg.config.plugins?.[key] === undefined) {
  return; // nothing declared in this physical file -- no write
}
```
(For the cascade delete: skip when the marketplace key is absent AND no
plugin key ends in `@<marketplace>`.)

### WR-03: enable/disable idempotency reads state-side truth only; config-opposite drift silently inverts the user's command

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:342-346`
**Issue:** The idempotency gate is `isCurrentlyDisabled(installed) ===
!enable` — purely state-side. When config and state disagree (config says
`enabled: false`, state record is materialized — e.g. a hand-edited config,
or base/local divergence pending reconcile), `plugin enable` hits the
idempotent arm, returns `skipped {already enabled}`, and never patches the
config. The next reconcile then applies the config's `enabled: false` and
DISABLES the plugin the user just explicitly enabled. Autoupdate had
exactly this failure mode and fixed it with `reclassifyByConfigTruth`
(`autoupdate.ts:249-278`, including the `unchanged → changed` promotion);
enable/disable did not get the equivalent treatment, so the two flip
surfaces now have inconsistent semantics against the same config-as-truth
model.
**Fix:** Before classifying as idempotent, compare the requested `enable`
against the targeted config entry's effective `enabled` (default `true`
when absent, per D-04). If the config carries the OPPOSITE explicit value,
treat the flip as fresh for the config write (write `{ enabled }`) even
when the state side is already in the requested shape — mirroring
`reclassifyByConfigTruth`'s promotion arm.

### WR-04: CFG-03 invalid-config abort re-saves state.json on install/uninstall (withStateGuard auto-save), diverging from the documented no-save abort

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:838-845`; `orchestrators/plugin/uninstall.ts:408-415`
**Issue:** install and uninstall run their CFG-03 check inside
`withStateGuard`, whose contract (`transaction/with-state-guard.ts:66-76`)
saves state UNCONDITIONALLY on closure return. The invalid-config early
`return` therefore still rewrites `state.json` (mtime bump, one atomic
write) on every abort. The sibling commands (add, remove, autoupdate,
enable-disable) deliberately use `withLockedStateTransaction` so the abort
arms skip `tx.save()` — enable-disable's header explicitly states
"state.json's mtime is UNCHANGED on every abort/no-op -- exactly what the
catalog's CFG-03 states claim" (`enable-disable.ts:21-24`). install and
uninstall violate that claim and diverge from the family's abort
semantics. Same applies to install's `marketplace-absent` arm.
**Fix:** Convert install/uninstall's guard to
`withLockedStateTransaction` with explicit `tx.save()` on the mutating
arms only (install already has the precedent: `runInstallLedger` is
guard-free by design), or hoist the `loadConfig` CFG-03 check before the
guard if pre-lock reads are acceptable for these commands.

### WR-05: Fresh autoupdate flips still write the carved-out legacy `autoupdate` field into state.json

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:440-460` (write sites); persisted by `orchestrators/marketplace/autoupdate.ts:364` (`tx.save()`)
**Issue:** SPLIT-01 moved `autoupdate` truth into the config, and this
phase's gate (`tests/architecture/no-split-01-cast-reads.test.ts`) proves
all cast-READS are rewired. But `applyAutoupdateFlipInPlace` still WRITES
`mut.autoupdate = enable` into the state record (the assignment form the
gate explicitly does not scan), and `flipOneScope` persists it via
`tx.save()` on every fresh flip. The shared.ts comment says the write path
is "rewired … until Phase 54-56" — this is Phase 56 and the write survives.
Net effect: every fresh flip writes a schema-stripped legacy field into
`state.json` that the D-13 scrub removes again on the next load — pointless
state churn, plus a window where on-disk state carries a field the schema
no longer owns. Behavior is masked by `reclassifyByConfigTruth`, so this is
not user-visible today, but it is exactly the kind of latent divergence the
SPLIT-01 carve-out exists to eliminate.
**Fix:** Drop the state mutation in `applyAutoupdateFlipInPlace` (classify
only; the config write is the real flip), and skip `tx.save()` in
`flipOneScope` when nothing state-side changed. Extend the architecture
gate's regex (or add a sibling) to also catch the assignment form
`mut.autoupdate =`.

### WR-06: Per-name sequential `saveConfig` calls in the flip loop are not failure-atomic; a missing-source synthesis failure surfaces as a lying `{not found}` row

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:287-319`
**Issue:** Two compounding problems in `writeAutoupdateBack`. (a) Each
iteration flushes its own `saveConfig`; a mid-loop throw (disk full,
EACCES) leaves earlier writes committed while the command reports a single
failure — partial config mutation under a command the user sees as failed
(NFR-3 retry-safety erosion). (b) `buildAutoupdatePatch` synthesizes
`source` from the state record's `source.raw`; when the config entry is
absent AND `raw` is not a string (hand-edited or legacy state — `source` is
`Type.Unknown` at the schema level), the merged entry lacks the REQUIRED
`source` field (`config-io.ts:46-48`) and `saveConfig` THROWS
("saveConfig refused: …"). That throw routes through
`notifyAutoupdateScopeFailure` → `autoupdateFailedRow`, which narrows
everything non-lock to `{not found}` — a misclassification of a config
write refusal.
**Fix:** Both are resolved by the CR-01 batched-write fix (single
`saveConfig`, all-or-nothing). For (b), skip the entry (or surface a
distinct reason) when no string `source` can be synthesized, rather than
letting `saveConfig`'s invariant throw masquerade as `{not found}`.

### WR-07: add.ts config write failure after the clone rename leaves an orphaned final clone (next add fails `{stale clone}`)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:386-397`
**Issue:** Ordering inside the lock is: `addGithubInGuard` (clone → rename
into `sources/<name>/` → state-snapshot mutation) → `writeMarketplaceConfigEntry`
→ `tx.save()`. If the config write throws (disk full, EACCES on
`claude-plugins.json`), the state snapshot is discarded (no `tx.save()`),
but the clone has ALREADY been committed to the final `sources/<name>/`
path — and `addGithubInGuard`'s cleanup catch (`add.ts:642-654`) is out of
scope by then, so nothing removes it. The retry then fails MA-6
`{stale clone}` until the user manually deletes the directory, violating
NFR-3 (safe to retry / fail-clean). Phase 56 widened this pre-existing
window (previously only `tx.save()` sat after the rename) by inserting a
second failure-prone write between rename and save.
**Fix:** Wrap the write-back + `tx.save()` in a try/catch inside
`runAddInGuard` that, on throw after a successful github materialization,
runs `cleanupStaging(finalDir, ...)` and appends the leak to the rethrown
error (mirroring the MA-9 discipline in `addGithubInGuard`).

## Info

### IN-01: commitFullRemove's `cfg` parameter type is an unsound intersection narrowed by cast

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:368-372, 390-392`
**Issue:** `cfg: { status: string } & ({ status: "valid"; config: ScopeConfig } | { status: string })`
collapses to `{ status: string }`, forcing the `(cfg as { config: ScopeConfig }).config`
cast. The real discriminated union (`ConfigLoadResult` from `config-io.ts`)
already exists and would make the narrow cast-free.
**Fix:** Type the parameter as `ConfigLoadResult` and narrow on
`cfg.status === "valid"`.

### IN-02: Dead branch in resolveRemoveTargetOrSurface

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:497-504`
**Issue:** `if ("status" in r) { return r; } return r;` — both arms return
`r`; the conditional is dead code.
**Fix:** `return resolveScopeOrFailedOutcome(opts, userLocations, projectLocations);`

### IN-03: narrowListFailReason's JSDoc claims a dedicated classification ladder; the body is an alias of the probe classifier

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:811-830`
**Issue:** The doc block ("Mirrors the `update.ts::narrowDirectFailReason`
precedent… Distinct from `narrowProbeError`") describes a distinct
errno/SyntaxError ladder, but the body is
`return sharedNarrowProbeError(err);` — byte-identical to
`narrowProbeError` two functions above. The "two semantic names" intent is
fine; the doc's claim of a different classification table is false and will
mislead the next maintainer.
**Fix:** Rewrite the JSDoc to state it intentionally delegates to the same
shared ladder, or actually implement the described list-specific ladder.

### IN-04: `as MarketplaceConfigEntry` cast in the write-back helper masks the required `source` field at compile time

**File:** `extensions/pi-claude-marketplace/persistence/config-write-back.ts:58, 177`
**Issue:** `{ ...existing, ...patch } as MarketplaceConfigEntry` silences
the compiler when neither `existing` nor `patch` carries the
schema-required `source` (`MARKETPLACE_CONFIG_ENTRY_SCHEMA` makes it
mandatory). The only guard is `saveConfig`'s runtime validation throw —
see WR-06(b) for a reachable path.
**Fix:** Make the helper's signature force a `source` when the entry is
being created (e.g. accept `patch: Partial<MarketplaceConfigEntry>` plus an
overload requiring `source` when `existing` is empty), or validate and
return a typed error before the spread.

### IN-05: extractLocalFlag's `--scope` consumption can swallow a following flag token and still strip `--local` from the residual

**File:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts:56-60, 83`
**Issue:** `--scope` advances `i += 2` without inspecting the value token,
so `--scope --local foo` treats `--local` as the (consumed) scope value —
yet the trailing `tokens.filter((t) => t !== "--local")` still removes it,
silently reinterpreting the user's args as `--scope foo`. Degenerate input,
but the failure is silent reinterpretation rather than a usage error.
**Fix:** When the token after `--scope` starts with `--`, emit the usage
error ("--scope requires a value") instead of consuming it.

### IN-06: Test gap — no coverage for multi-marketplace (bare-form) autoupdate write-back or cross-scope install write-back

**File:** `tests/architecture/config-state-consistency.test.ts` (whole file); `tests/persistence/config-write-back.test.ts`
**Issue:** The WB-01 SC#4 suite flips a single named marketplace and
installs nothing cross-scope, so both CR-01 (bare-form clobber) and CR-02
(CMP-3 dangling declaration) pass CI today. The unit suite never exercises
sequential single-entry writes against a stale snapshot.
**Fix:** Add (a) a bare-form flip test with two marketplaces in one scope
asserting both config entries, and (b) a user-scope add + project-scope
install test asserting `planReconcile(projectMerged, projectState,
"project")` is the empty plan.

---

_Reviewed: 2026-06-11T05:47:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
