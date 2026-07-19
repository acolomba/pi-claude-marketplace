---
phase: 80-remote-status-glyph-reassignment-warm-cache-resolution
verified: 2026-07-14T00:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 80: Remote status, glyph reassignment & warm-cache resolution Verification Report

**Phase Goal:** A not-installed git-source plugin with no materialized clone reads as an honest `(remote)` instead of over-claiming `(available)`; where a clone is already warm, `info`/`list` resolve components fs-only with no network; and users can filter the `(remote)` bucket with `list --remote`.
**Verified:** 2026-07-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A not-installed git-source plugin (url/git-subdir/github) with no clone renders `(remote)` in `list`, `info`, and install-completion — never the old `(available)`; installed plugins never render `(remote)` | ✓ VERIFIED | `list.ts::availableRowMessage` (list.ts:576-591) returns `bucket: "remote"` on `presence.kind === "not-cached"`; `info.ts::buildGitNotInstalledRow`→`buildRemoteNotInstalledRow` (info.ts:1156-1202) same; `edge/completions/data.ts::INSTALL_STATUSES = new Set(["available","remote"])` offers it at install-completion. Installed-never-remote preserved via `buildInstalledGitRow`'s D-78-04 fallback (info.ts:924-974) and `list.ts` T-80-08 test (list.test.ts:581). Behavioral tests: `list.test.ts:468,2283,2309,2333`; `info.test.ts` RSTA-01 cases. |
| 2 | Glyph is `◌` U+25CC for `(remote)`, `◍` U+25CD for disabled/`will disable`, consistent across list/info/preview/style guide | ✓ VERIFIED | `notify.ts:1491` `ICON_DISABLED = "◍"`, `notify.ts:1499` `ICON_REMOTE = "◌"`; renderer arm `notify.ts:2177-2189`; `pluginInfoStatusGlyph` `notify.ts:3113-3116`; `docs/output-catalog.md` glyph legend (lines 13-14) + status-token table (line 138,148-149) + byte fixtures; `docs/messaging-style-guide.md:42,54`. Tripwires: `notify-grammar-invariant.test.ts` (`DISABLED_TOKEN_RE` / `WILL_TOKEN_RE`), `notify-closed-set-locks.test.ts` (24/19-entry closed sets) — both green. |
| 3 | Bare `info` on a warm clone resolves components fs-only, no network; fetched-not-installed classifies via three-way resolver on warm clone; installed git plugin with missing clone degrades to `(upgradable)`/`(installed)`, never `(unavailable)` | ✓ VERIFIED | `info.ts::buildGitNotInstalledRow` (1186-1242) — warm branch runs `resolveStrict` + `composeResolvedComponents` fs-only, routes installable/partially-available/unavailable through the same reason-brace arms path sources use. `buildInstalledGitRow` (924-974) preserves D-78-04: cold/missing clone or any throw keeps the recorded installed status. `info.ts` imports only `makePresenceProbe`/`resolveStrict`/`composeResolvedComponents` — no git seam. `no-orchestrator-network.test.ts` 1/1 pass (git-free grep gate). Behavioral tests: `info.test.ts` RSTA-04/05 warm cases + `D-78-04` missing-clone guard (line 2428). |
| 4 | `list --remote` selects exactly the `(remote)` bucket and composes with other PL-1 filters as a union (`--available --remote` restores pre-milestone `--available` set); every classification path network-free | ✓ VERIFIED | `list.ts::shouldShow` (208-242): `--available` keys on `status === "available"` only (line 232, no longer includes cold git sources); `--remote` is a separate arm on `bucket === "remote"` (line 240); `filtersPassive` includes `opts.remote !== true` (197). `edge/handlers/plugin/list.ts` wires `--remote` in `BOOLEAN_FLAGS` + spread + `USAGE`. Behavioral test `list.test.ts:491-539` asserts exactly this 3-case matrix (`--remote` alone / `--available` alone excludes cold git / `--available --remote` restores both) end-to-end via `listPlugins()`. `no-orchestrator-network.test.ts` covers list.ts + edge-deps.ts. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Locked User Decisions (CONTEXT.md)

| Decision | Verified | Evidence |
|----------|----------|----------|
| D-80-01 (◍ locked, atomic lockstep, ONE commit) | ✓ | Commit `124e88bd` — single commit, 13 files, notify.ts + catalog + style-guide + all three tripwire suites together (per 80-01-SUMMARY.md self-check + `git show 124e88bd --stat`) |
| D-80-02 (mirror/per-sha presence derivation, no prefix scan) | ✓ | `makePresenceProbe` (git-source-probe.ts:110-141) — unpinned via mirror-dir presence, pinned via exact per-sha key; no scan logic anywhere in the probe |
| D-80-03 (bare remote row, no reason brace, manifest order, installed never remote) | ✓ | `notify.ts:2177-2189` renderer arm drops `composeReasons`; `PluginRemoteMessage` (notify.ts:714-719) has no `scope`/`reasons` fields; installed-never-remote per D-78-04 preservation above |
| D-80-04 (info marker unchanged for remote; warm gating on makePresenceProbe materialized) | ✓ | `buildRemoteNotInstalledRow` preserves `componentsResolved: false` / `components: not resolved` wording (info.ts:1147-1170); warm gate is `presence.kind === "materialized"` |
| D-80-05 (completion offers remote; schemaVersion 5→6) | ✓ | `INSTALL_STATUSES` includes `"remote"` (edge/completions/data.ts:64); `completion-cache.ts` schemaVersion `6` at all 3 sites (lines 88, 342, 357), `5` at none |
| D-80-06 (info severity, needsReload false, append-last tuples) | ✓ | `remote` appended last in both `STATUS_TOKENS` (24th) and `PLUGIN_STATUSES` (19th); `remote` projects to coarse `available` tool bucket / info severity per notify.ts comments |
| D-80-07 (--remote union filter, INTENDED --available change) | ✓ | Behaviorally proven by `list.test.ts:491-539` (see truth #4 above) |

### Architecture Gates

| Gate | Result |
|------|--------|
| `tests/architecture/no-orchestrator-network.test.ts` | ✓ PASS (1/1) |
| `tests/architecture/notify-closed-set-locks.test.ts` | ✓ PASS (part of 16/16 combined run; STATUS_TOKENS=24, PLUGIN_STATUSES=19) |
| `tests/architecture/notify-grammar-invariant.test.ts` | ✓ PASS (DISABLED_TOKEN_RE `^◍ `, WILL_TOKEN_RE `[●○⊘◍]` both pass) |
| `tests/architecture/catalog-uat.test.ts` | ✓ PASS (forward + inverse byte-equality walks green, incl. new `remote-inventory`, `remote-inventory-with-description`, `remote-single-scope` fixtures) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | `ICON_REMOTE`, `PluginRemoteMessage`, tuple members, renderer arm | ✓ VERIFIED | All present; `ICON_REMOTE = "◌"` ×1, `ICON_DISABLED = "◍"` ×1, `interface PluginRemoteMessage` with no scope/reasons |
| `docs/output-catalog.md` | remote legend + status row + fixtures; disabled glyph flipped | ✓ VERIFIED | Legend split (lines 13-14), status-token table row (138), fixtures at 351/362/1423, disabled rows flipped to ◍ |
| `docs/messaging-style-guide.md` | `PluginRemoteMessage` variant line; disabled ◍ note | ✓ VERIFIED | Lines 42, 54 |
| `orchestrators/plugin/plugin-state-classifier.ts` | `ManifestEntryClassification += remote` | ✓ VERIFIED | Confirmed via `probeManifestEntry` return type usage; classifier switch stays 3-way (`Exclude<..., "remote">` narrowing) |
| `orchestrators/plugin/git-source-probe.ts` | `probeManifestEntry` presence-derived rewrite | ✓ VERIFIED | git-source-probe.ts:167-200 — cold→`remote`, warm→3-way via `resolveStrict`, non-git unchanged |
| `shared/completion-cache.ts` | `remote` in schema + `PluginIndexRow.status`; schemaVersion 6 | ✓ VERIFIED | 3/3 sites bumped to 6, `Type.Literal("remote")` present |
| `edge/completions/data.ts` | `INSTALL_STATUSES += remote` | ✓ VERIFIED | Line 64 |
| `orchestrators/plugin/list.ts` | `availableRowMessage` consolidated; `FilterBucket += remote`; `--remote` filter arms | ✓ VERIFIED | list.ts:555-591 (row builder), 135-147 (FilterBucket), 181-242 (options/filter) |
| `edge/handlers/plugin/list.ts` | `--remote` flag wiring | ✓ VERIFIED | `BOOLEAN_FLAGS` + spread + `USAGE` string all present |
| `orchestrators/plugin/info.ts` | `buildNotInstalledRow`/`buildInstalledRow` remote/warm branches | ✓ VERIFIED | `buildRemoteNotInstalledRow`, `buildGitNotInstalledRow`, `buildWarmGitNonInstallableRow`, `buildInstalledGitRow`, `isGitSource` type guard all present and wired |

**Note on tooling:** `info.ts` is flagged by `file(1)` as "data" (contains a byte sequence that trips naive binary detection), which caused plain `grep` (without `-a`) to silently report zero matches during the first verification pass. Re-running with `grep -a` recovered full, accurate results; this is a verifier-tooling artifact, not a code defect — `node --test`, `tsc`, and `eslint` all read the file correctly and pass.

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `list.ts::availableRowMessage` | `git-source-probe.ts::makePresenceProbe` | direct call, `locations` threaded from `enumerateMarketplacePlugins` | ✓ WIRED |
| `info.ts::buildGitNotInstalledRow`/`buildInstalledGitRow` | `git-source-probe.ts::makePresenceProbe` | direct call, `locations` threaded from `getPluginInfo`→`buildBlock` | ✓ WIRED |
| `edge-deps.ts::classifyNotInstalledPluginRow` | `git-source-probe.ts::probeManifestEntry` | inherits `remote` automatically (verify-only, no logic change needed) | ✓ WIRED (parity confirmed by `edge-deps.test.ts` drift-guard) |
| `PluginInfoRowBase.status` | `PLUGIN_STATUSES` | `Extract<PluginStatus, ...>` includes `"remote"` | ✓ WIRED |
| `catalog-uat.test.ts` FIXTURES | `docs/output-catalog.md` catalog-state blocks | bidirectional byte-equality runner | ✓ WIRED (forward + inverse both green) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Architecture gates (4 required) | `node --test tests/architecture/{no-orchestrator-network,notify-closed-set-locks,notify-grammar-invariant,catalog-uat}.test.ts` | 17/17 pass | ✓ PASS |
| Classification + list + info + completion suites | `node --test tests/orchestrators/plugin/{git-source-probe,list,info}.test.ts tests/orchestrators/edge-deps.test.ts tests/shared/completion-cache.test.ts tests/edge/handlers/plugin/list.test.ts` | 182/182 pass | ✓ PASS |
| Full workspace suite | `npm test` (single run) | 2771 pass / 0 fail / 1 skip (pre-existing, unrelated) | ✓ PASS |
| `npm run check` (typecheck+lint+format+test+integration) | background run | exit 0 | ✓ PASS |
| `--remote`/`--available`/`--available --remote` end-to-end union filter | `list.test.ts:491-539` (real `listPlugins()` call, 3-case matrix) | all 3 assertions pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RSTA-01 | 01, 02, 03, 04 | `(remote)` status token replacing manifest-only `(available)` | ✓ SATISFIED | notify.ts token, list.ts/info.ts/edge-deps.ts consumption, behavioral tests |
| RSTA-02 | 01 | `◌`/`◍` glyph reassignment, lockstep closed-set amendment | ✓ SATISFIED | Single commit `124e88bd`; tripwires green |
| RSTA-03 | 02, 03 | Shared `git-source-probe.ts` classification consumed by list + completion; drift-guard; schemaVersion 5→6 | ✓ SATISFIED | `probeManifestEntry` shared by both surfaces; edge-deps.test.ts parity case; schemaVersion confirmed 6 |
| RSTA-04 | 04 | Bare `info` resolves components fs-only, network-free | ✓ SATISFIED | `info.ts` warm-tree resolution; `no-orchestrator-network.test.ts` green |
| RSTA-05 | 02, 04 | Fetched-not-installed classifies via three-way resolver on warm clone; D-78-04 preserved | ✓ SATISFIED | `probeManifestEntry`/`buildGitNotInstalledRow` warm branches; D-78-04 guard tests |
| RSTA-06 | 02, 04 | Unpinned mirror-dir presence derivation via SC-7 chokepoint, fs-only | ✓ SATISFIED | `makePresenceProbe` mirror arm (inherited from 79.1, consumed here) |
| RSTA-07 | 03 | `list --remote` joins PL-1 filter union; `--available` behavior change intended | ✓ SATISFIED | `list.ts::shouldShow`/`filtersPassive`; `edge/handlers/plugin/list.ts` flag wiring; behavioral test |

No orphaned requirements — all 7 RSTA IDs declared across the four plans' `requirements` frontmatter match REQUIREMENTS.md exactly. FTCH-01..06 belong to Phase 81 and are out of this phase's scope (confirmed via the `deferred` todo note in 80-CONTEXT.md).

### Anti-Patterns Found

None. Scanned all 10 touched source files (`notify.ts`, `list.ts`, `info.ts`, `git-source-probe.ts`, `plugin-state-classifier.ts`, `completion-cache.ts`, `edge/completions/data.ts`, `edge/handlers/plugin/list.ts`, `edge-deps.ts`, `list.messaging.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — zero matches. No stub returns, no hardcoded-empty data flowing to render paths, no console.log-only implementations.

### Comment Discipline

Spot-checked for forbidden `Phase NN`/`Plan NN`/`Wave NN` planning references in touched files — none found; all traceability anchors use `RSTA-NN`/`D-80-NN`/`SNM-NN`/`NFR-N` per `.claude/rules/typescript-comments.md`.

### Human Verification Required

None. All must-haves resolved to VERIFIED with codebase + automated-test evidence; no visual, UX, or non-programmatically-verifiable claims in this phase's scope (the glyph rendering itself was operator-verified in-terminal at discuss, per D-80-01, and the gate carries `T-80-02: accept` disposition — no runtime re-verification required per CONTEXT.md).

### Gaps Summary

None. All four ROADMAP success criteria, all seven locked decisions (D-80-01..07), all four architecture gates, and all seven RSTA requirement IDs are verified against actual code behavior (not just symbol presence) via passing automated tests that assert the specific byte forms and filter semantics the roadmap describes. `npm run check` is green.

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
