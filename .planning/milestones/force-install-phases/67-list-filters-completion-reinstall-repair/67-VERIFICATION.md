---
phase: 67-list-filters-completion-reinstall-repair
verified: 2026-06-27T18:00:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 67: List Filters, Completion & Reinstall Repair Verification Report

**Phase Goal:** Deliver three capabilities -- (RINST-01) retire reinstall `--force` at all sites and make overwrite-everything unconditional; (LIST-01) add a `list --unsupported` filter and widen `list --installed` to span installed + force-installed, with no `--upgradable` filter; (LIST-02) gate install/update tab-completion candidate sets on a `--force` token with byte-identical completion output when `--force` is absent, built on a single shared plugin-state-classifier consumed by both list and the completion bucketizer (cache schema v1->2).
**Verified:** 2026-06-27
**Status:** passed
**Re-verification:** No — initial verification

> **Forward-reference (record accuracy):** The completion plugin-index cache is
> cited below as `schemaVersion 2` with a 7-status union -- the as-of-67
> snapshot. The Phase 67 WR-02 follow-up fix (commit `31589e66`) later added the
> internal `force-installed-upgradable` status, bumping the cache to
> `schemaVersion 3` with an 8-status union. The user-visible closed-set tokens
> (22/17/7) were unaffected. The values here are a correct point-in-time record,
> not the current cache schema.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `reinstall --force` errors as UNKNOWN flag (not silently ignored) | VERIFIED | `extractLocalFlag(args, ctx, USAGE, [])` — empty pass-through list means `--force` hits the shared UNKNOWN-flag arm; test asserts `startsWith('Unknown flag: "--force".')` |
| 2  | Bare reinstall over foreign content succeeds unconditionally (no `--force` needed) | VERIFIED | `replacePreparedAgents(handles.agents, { force: true })` at line 1341 — unconditional; no `force?: boolean` field remains anywhere in the option bags |
| 3  | USAGE string and router TOP_LEVEL_USAGE no longer contain `[--force]` for reinstall | VERIFIED | Handler USAGE: `"...[--scope user|project] [--local]"` — no `[--force]`; router line 93 similarly clean |
| 4  | Completion provider no longer offers `--force` for reinstall and no longer special-cases reinstall positional extraction | VERIFIED | `flagCompletions` adds `--force` under `install`/`update` heads only (line 107-122); `booleanFlags = head === "install" || head === "update" ? ["--force"] : []` — reinstall excluded |
| 5  | `list --unsupported` selects NOT-installed plugins resolving `unsupported`, excludes force-installed and structural-unavailable | VERIFIED | `shouldShow`: `if (opts.unsupported === true && bucket === "unsupported")` keys on pre-collapse resolver bucket, not render token; force-installed rows pass `"installed-inventory"` bucket and are only reachable via `--installed` |
| 6  | `list --installed` spans installed + force-installed + force-upgradable (all installed-inventory render statuses) | VERIFIED | `shouldShow` admits `status === "force-installed" || status === "force-upgradable"` under the `--installed` arm (line 202-204) |
| 7  | `list --unavailable` narrowed to structural-unavailable bucket only | VERIFIED | `if (opts.unavailable === true && bucket === "unavailable")` — `unsupported` bucket excluded from this arm (A2 partition) |
| 8  | USAGE carries `[--unsupported]`; no `--upgradable` filter exists | VERIFIED | Handler USAGE: `"...[--unsupported] [--scope user|project]"`; `BOOLEAN_FLAGS` does not include `--upgradable` |
| 9  | ONE shared plugin-state-classifier.ts consumed by BOTH list and the completion bucketizer | VERIFIED | `plugin-state-classifier.ts` exists (118 lines, pure, no I/O); `list.ts` imports `classifyInstalledRecord, classifyManifestEntry`; `edge-deps.ts` imports both from same module |
| 10 | Parity drift-guard test exists asserting bucketizer equals shared classifier on shared fixture | VERIFIED | `tests/orchestrators/edge-deps.test.ts` line 460: "D-67-02 / T-67-08 parity: the bucketizer rows equal the shared classifier on the SAME fixture" |
| 11 | Completion plugin-index cache schemaVersion is 2; finer 7-status union | VERIFIED | `schemaVersion: Type.Literal(2)` in completion-cache.ts; status union includes upgradable, force-installed, force-upgradable, unsupported alongside installed/available/unavailable |
| 12 | Force-upgradable candidate resolution in bucketizer stays no-network (NFR-5) | VERIFIED | `classifyInstalledPluginRow` uses `resolveStrict` (no-network); `no-orchestrator-network.test.ts` enforces the boundary |
| 13 | install/update completion `--force`-gated; without `--force` output is byte-identical | VERIFIED | `data.ts`: `FORCE_INSTALL_STATUSES` (available + unsupported), `FORCE_UPDATE_STATUSES` (upgradable + force-upgradable), `INSTALLED_INVENTORY_STATUSES` (all 4 installed states for no-force update); regression tests assert byte-identical output |
| 14 | `--force` is a registered boolean flag for install/update positional extraction; `install --force <TAB>` no longer returns null | VERIFIED | Provider line 286: `booleanFlags = head === "install" || head === "update" ? ["--force"] : []`; test asserts non-null result |
| 15 | Closed-set token tripwire remained 22/17/7 | VERIFIED | `notify-closed-set-locks.test.ts` asserts `STATUS_TOKENS.length === 22`, `PLUGIN_STATUSES.length === 17`, `MARKETPLACE_STATUSES.length === 7`; no new render tokens added |

**Score:** 3/3 roadmap success criteria verified (15/15 observable truths)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | reinstall handler with `--force` removed from accepted flags and USAGE | VERIFIED | `extractLocalFlag(args, ctx, USAGE, [])` — empty pass-through; USAGE has no `[--force]` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | unconditional overwrite-everything; no force option on any reinstall option bag | VERIFIED | `replacePreparedAgents(handles.agents, { force: true })` unconditional; grep for `force` returns only the unrelated `fs.rm` sites and the unconditional `{ force: true }` call |
| `extensions/pi-claude-marketplace/edge/router.ts` | TOP_LEVEL_USAGE reinstall line without `[--force]` | VERIFIED | Line 93 reads `"  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n"` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | resolver-state bucket threaded to shouldShow; `--unsupported` arm; widened `--installed`; `ListPluginsOptions.unsupported` | VERIFIED | `FilterBucket` type, `shouldShow(opts, status, bucket)`, `readonly unsupported?: boolean`, `filtersPassive` updated; ~530 lines, substantive |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` | `--unsupported` in BOOLEAN_FLAGS + USAGE + forwarding spread | VERIFIED | `BOOLEAN_FLAGS = new Set(["--installed", "--available", "--unavailable", "--unsupported"])`; USAGE has `[--unsupported]`; spread includes `unsupported: true` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` | shared pure per-entry classifier (classifyInstalledRecord + classifyManifestEntry) | VERIFIED | 118 lines; exports `classifyInstalledRecord` (InstalledClassification) and `classifyManifestEntry` (ManifestEntryClassification); imports only `assertNever` + resolver type |
| `extensions/pi-claude-marketplace/shared/completion-cache.ts` | schemaVersion 2; widened status union | VERIFIED | `Type.Literal(2)` for plugin-index schema; `PluginIndexRow.status` union covers 7 statuses |
| `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` | bucketizer emitting finer statuses via shared classifier | VERIFIED | Imports `classifyInstalledRecord, classifyManifestEntry`; `classifyInstalledPluginRow` / `classifyNotInstalledPluginRow` helpers extract the shared classifier calls |
| `extensions/pi-claude-marketplace/edge/completions/provider.ts` | `--force` flag for install/update; force boolean threaded through PluginRefBranchConfig | VERIFIED | `flagCompletions` adds `--force` entry for install/update only; `force?: boolean` in `PluginRefBranchConfig`; detection via flag-free head recovery then re-extraction |
| `extensions/pi-claude-marketplace/edge/completions/data.ts` | per-(mode, force) candidate-set narrowing | VERIFIED | `INSTALL_STATUSES`, `FORCE_INSTALL_STATUSES`, `FORCE_UPDATE_STATUSES`, `INSTALLED_INVENTORY_STATUSES` sets; `force` parameter on map builders |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | unit tests including A4 precedence and CR-01 degrade | VERIFIED | 149 lines; covers all branches including `A4: force-installed wins over upgradable` and CR-01 probe-failure degrade |
| `tests/orchestrators/edge-deps.test.ts` | finer-status bucketizer tests + parity drift-guard | VERIFIED | Parity test at line 460: "D-67-02 / T-67-08 parity..." |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `edge/handlers/plugin/reinstall.ts` (no pass-through) | UNKNOWN-flag arm | `extractLocalFlag(args, ctx, USAGE, [])` | WIRED | Empty list means `--force` is not recognized; falls to shared UNKNOWN arm that calls `notifyUsageError` |
| `orchestrators/plugin/reinstall.ts::replaceAll` | `bridges/agents replacePreparedAgents` | unconditional `{ force: true }` | WIRED | Line 1341: `replacePreparedAgents(handles.agents, { force: true })` — no ternary |
| `edge/handlers/plugin/list.ts --unsupported token` | `orchestrators/plugin/list.ts listPlugins({ unsupported: true })` | optional-field spread | WIRED | `...(filterFlags.has("--unsupported") && { unsupported: true })` |
| `orchestrators/plugin/list.ts availableRowMessage resolver bucket` | `shouldShow` filter predicate | `FilterBucket` threaded alongside render status | WIRED | `availableRowMessage` returns `{ message, bucket }`; `shouldShow(opts, status, bucket)` consumes bucket |
| `orchestrators/plugin/list.ts` | `orchestrators/plugin/plugin-state-classifier.ts` | import + delegation | WIRED | `import { classifyInstalledRecord, classifyManifestEntry }` at line 75; both `installedRowMessage` and `availableRowMessage` delegate status derivation |
| `orchestrators/edge-deps.ts loadManifestForMarketplace` | `orchestrators/plugin/plugin-state-classifier.ts` | same classifier, same status | WIRED | Imports both functions; `classifyInstalledPluginRow` and `classifyNotInstalledPluginRow` helpers call them |
| `edge/completions/provider.ts --force detection` | `edge/completions/data.ts candidate-set filters` | `force` boolean through `PluginRefBranchConfig` | WIRED | `force: boolean` in `PluginRefBranchConfig`; threaded to `getInstallPluginToMarketplacesMap(force)` and `getInstalledPluginToMarketplacesMap(force)` |
| `edge/completions/data.ts` | `shared/completion-cache.ts PluginIndexRow.status` (finer set) | `row.status` narrowing per mode and force | WIRED | `FORCE_INSTALL_STATUSES`, `FORCE_UPDATE_STATUSES`, `INSTALLED_INVENTORY_STATUSES` all key on `row.status` with the widened schema-v2 union |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `edge/completions/data.ts` | `row.status` from `PluginIndexRow[]` | `completion-cache.ts` built by `edge-deps.ts` via `classifyInstalledRecord`/`classifyManifestEntry` | Yes — derived from actual persisted state + no-network manifest resolution | FLOWING |
| `orchestrators/plugin/list.ts shouldShow` | `bucket: FilterBucket` | `availableRowMessage` resolver `switch (resolved.state)` returning `{ message, bucket }` | Yes — keyed on actual `resolveStrict` result passed to `availableRowMessage` | FLOWING |
| `orchestrators/edge-deps.ts loadManifestForMarketplace` | `status` field per row | `classifyInstalledPluginRow` / `classifyNotInstalledPluginRow` calling `resolveStrict` (no-network) | Yes — based on actual state records and manifest entries | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Verification | Status |
|----------|-------------|--------|
| `npm run check` (typecheck + ESLint + Prettier + tests + integration) | All 4 SUMMARYs report green; 2430 tests / 0 fail; integration 16/0. Cannot re-run within verifier timeout budget. | SKIP (reported green by executor; trust commit history showing no failures) |
| Architecture tests (import-boundaries, no-orchestrator-network, catalog-uat, notify-closed-set-locks) | All asserted green in SUMMARYs; no new render tokens; classifier stays in orchestrator layer | SKIP (same reason) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RINST-01 | 67-01-PLAN.md | `reinstall` no longer accepts `--force`; always overwrites everything as repair primitive | SATISFIED | Handler pass-through `[]`; USAGE clean; router clean; completion clean; orchestrator unconditional `{ force: true }`; REQUIREMENTS.md shows `[x]` |
| LIST-01 | 67-02-PLAN.md | `list` gains `--unsupported` filter; `--installed` spans installed + force-installed; no `--upgradable` added | SATISFIED | All filter machinery verified in list.ts and list handler; REQUIREMENTS.md shows `[x]` |
| LIST-02 | 67-03-PLAN.md, 67-04-PLAN.md | Force-gated completion candidate sets; no-force byte-identical; shared classifier; cache schema v2 | SATISFIED (code) — WARNING: REQUIREMENTS.md checkbox `[ ]` and traceability table show "Pending" despite the implementation being in the codebase | All classifier, cache, provider, data.ts artifacts verified; parity drift-guard confirmed |

**REQUIREMENTS.md Discrepancy — LIST-02:**  REQUIREMENTS.md line 48 shows `[ ] **LIST-02**` (unchecked) and the traceability table at line 116 shows `| LIST-02 | Phase 67 | Pending |`. Both the implementation and the plan SUMMARYs confirm LIST-02 is complete. This is a documentation tracking artifact — the REQUIREMENTS.md was not updated after plans 03/04 executed. The implementation is verified; the checkbox needs to be ticked and the traceability row updated to `Complete`.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `orchestrators/plugin/reinstall.ts` line 507 | `"placeholder"` in JSDoc comment | Info | Domain language describing a synthetic placeholder name in the cascade row output, not a code stub. Not a blocker. |

No TBD, FIXME, or XXX markers found in any file modified by this phase.

---

### Human Verification Required

None. All behaviors are covered by existing automated tests (unit, orchestrator, edge handler, architecture, and integration). No visual/UX or external-service-dependent behavior was introduced.

---

## Gaps Summary

No gaps. All three ROADMAP success criteria are verified in the codebase:

1. **RINST-01 (SC-3):** `reinstall --force` errors as UNKNOWN flag; overwrite is unconditional at all surfaces. Code, tests, USAGE strings, router help, and completion provider are all free of the retired flag.

2. **LIST-01 (SC-1):** `list --unsupported` is implemented via the `FilterBucket` mechanism (pre-collapse resolver bucket threaded to `shouldShow`) without changing any rendered byte form. `--installed` spans the full installed inventory including force states. `--unavailable` narrowed to structural-unavailable bucket only. No `--upgradable` filter added.

3. **LIST-02 (SC-2):** One shared `plugin-state-classifier.ts` is consumed by both `list` and the completion bucketizer. Cache is schema v2 with 7-status union. `data.ts` provides per-(mode, force) candidate sets. Provider detects `--force` position and threads the boolean through `PluginRefBranchConfig`. No-force output is byte-identical via `INSTALLED_INVENTORY_STATUSES`. A parity drift-guard test enforces shared-classifier contract between the two consumers.

**Non-blocking documentation item:** REQUIREMENTS.md LIST-02 checkbox and traceability table show "Pending" — needs a one-line documentation update to tick the checkbox and change the status to "Complete." Not a phase goal gap; implementation is complete and verified.

---

_Verified: 2026-06-27_
_Verifier: Claude (gsd-verifier)_
