# Phase 67: List Filters, Completion & Reinstall Repair - Research

**Researched:** 2026-06-27
**Domain:** Brownfield TypeScript surface/UX change — list filter flags, tab-completion candidate sets, reinstall flag retirement, byte-exact output contract
**Confidence:** HIGH (every claim verified by reading the live source; no external deps)

## Summary

This is a surgical, in-repo surface phase. There are NO external dependencies, NO
new libraries, NO resolver or `state.json` schema changes. The work is three
locked behaviors (LIST-01, LIST-02, RINST-01) realized across ~8 source files
plus their byte-exact tests and two prose docs, all landing in one `npm run
check`-green commit (D-67-04).

Two findings dominate planning and are easy to under-scope:

1. **`--unsupported` cannot be implemented from `row.status` alone.** A
   not-installed plugin that resolves `unsupported` currently renders the SAME
   `(unavailable)` token as a structurally-`unavailable` plugin — both collapse
   to `status: "unavailable"` inside `availableRowMessage`
   (`orchestrators/plugin/list.ts:449-467`). The `--unsupported` filter
   (D-67-01) therefore needs an internal resolver-state *bucket* threaded to the
   filter predicate; it is NOT a new render token and must NOT change the
   `(unavailable)` byte form. `--unavailable` must be narrowed in the same change
   so the two filters partition cleanly. [VERIFIED: source]

2. **The completion cache has no `unsupported` / `upgradable` /
   `force-upgradable` granularity.** `PluginIndexRow.status` is the closed set
   `installed | available | unavailable` (`shared/completion-cache.ts:78-98`),
   and the bucketizer (`orchestrators/edge-deps.ts:105-183`) explicitly collapses
   resolver `unsupported`→`unavailable` (line 152-154) and marks every
   state-present plugin as `installed` (never `upgradable`/`force-*`). LIST-02's
   `--force` candidate sets (`available`+`unsupported` for install;
   `upgradable`+`force-upgradable` for update) require finer buckets than the
   cache carries today. This is the largest piece of work in the phase. [VERIFIED: source]

**Primary recommendation:** Plan three independently-testable slices — (A)
reinstall `--force` retirement (smallest, self-contained), (B) `list
--unsupported` + widened `--installed` (orchestrator bucket + handler flag), (C)
`--force`-gated completion (cache-schema bump + shared classifier + provider
`--force` detection) — then one lockstep doc/test commit. Slice C is the
critical-path risk; size it generously.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-67-01:** `list --unsupported` filters to plugins that resolve `unsupported`
  but are NOT installed (available-but-partial — the force-installable
  candidates). force-installed plugins are reached by `--installed` (which spans
  `installed` + `force-installed`), NOT by `--unsupported`. Each filter targets
  one realized state cleanly (mirrors how `--available` excludes installed). No
  `--upgradable` filter is added.
- **D-67-02:** When `--force` precedes the plugin positional, source the candidate
  sets from the SAME Phase 66 derived-state classification `list` uses: `install`
  completion = `available` + `unsupported`; `update` completion = `upgradable` +
  `force-upgradable`; `unavailable` excluded in both. Without `--force`,
  completion output is byte-identical to today. No independent classification
  inside the completion provider.
- **D-67-03:** Remove `--force` from reinstall's accepted flags so `reinstall
  --force` errors as an UNKNOWN flag (a clear signal the contract changed — not
  silently ignored). Make the orchestrator's overwrite-everything behavior
  (collisions + foreign content) UNCONDITIONAL by deleting the `force`
  option/branch. reinstall becomes a pure repair primitive. Remove `--force` from
  reinstall's usage string, the router help, and the completion flag list /
  positional-extraction special-case.
- **D-67-04:** Update EVERYTHING in lockstep in this phase — usage strings, router
  help, completion flag lists, notify/catalog-uat tests, AND the prose docs
  (`docs/output-catalog.md`, `docs/messaging-style-guide.md`) — matching how
  Phases 65.1 and 66 handled docs this milestone. `npm run check` stays green;
  Phase 70 only does the final PRD §11 reconcile.

### Claude's Discretion

- Exact flag-parsing helper changes in `list.ts` (`BOOLEAN_FLAGS` set) and the
  completion provider's `--force`-position detection — left to planning, provided
  behavior matches D-67-01..04.

### Deferred Ideas (OUT OF SCOPE)

- Load-time backfill of force-installed plugins' skipped components — Phase 68.
- Force-path severity ladder SEV-01..05 — Phase 69.
- Final PRD §11 reconcile — Phase 70 (this phase updates output-catalog +
  style-guide per D-67-04).
- No `--upgradable` list filter (REQUIREMENTS Out of Scope — unrequested).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIST-01 | `list` gains a `--unsupported` filter; `--installed` spans `installed` + `force-installed`; no `--upgradable` filter | Slice B: resolver-state bucket in `availableRowMessage`, `shouldShow` widened; handler `BOOLEAN_FLAGS` + `ListPluginsOptions.unsupported` |
| LIST-02 | Under `--force`, install completion = available+unsupported, update completion = upgradable+force-upgradable; unavailable excluded; without `--force` unchanged | Slice C: `PluginIndexRow` status granularity bump + bucketizer + provider `--force` detection + data.ts per-mode/force filter |
| RINST-01 | `reinstall` drops `--force`; always overwrites everything (collisions + foreign content) | Slice A: handler + orchestrator + router + provider + usage-string edits; `replacePreparedAgents(..., {force:true})` unconditional |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `--unsupported` filter selection | API/orchestrator (`orchestrators/plugin/list.ts`) | Edge handler (`edge/handlers/plugin/list.ts` flag parse) | The resolver-state bucket distinction lives where `resolveStrict` is called; the handler only tokenizes the flag |
| `--installed` widening to force states | API/orchestrator (`shouldShow`) | — | Pure predicate change on already-derived render status |
| `--force`-gated completion candidate sets | API/orchestrator (`orchestrators/edge-deps.ts` bucketizer + cache schema) | Edge (`edge/completions/{provider,data}.ts` filter + `--force` detection) | Classification MUST stay out of the provider (D-67-02); the bucketizer already calls `resolveStrict` and is the right home |
| reinstall unconditional overwrite | API/orchestrator (`orchestrators/plugin/reinstall.ts`) | Bridge (`bridges/agents/stage.ts` force already supports it) | Overwrite semantics live in the agents bridge; orchestrator just stops gating them |
| Usage strings / router help / flag completions | Edge (`router.ts`, handler `USAGE`, `provider.ts`) | — | Pure string/closed-set surface |
| Byte-exact output contract | Docs + tests (`docs/*.md`, `tests/architecture/catalog-uat.test.ts`) | — | The catalog-UAT runner is the binding gate |

## Standard Stack

No new libraries. All work uses in-repo modules and the existing toolchain
(TypeScript strict, `node:test`, ESLint flat config, Prettier). Confirmed
versions from `package.json`: extension `0.6.2`; test runner `node --test`.
[VERIFIED: package.json]

**Package Legitimacy Audit:** N/A — this phase installs zero external packages.

**Environment Availability:** SKIPPED (no external dependencies; pure in-repo
code/doc/test changes). `npm run check` = `typecheck && lint && format:check &&
test && test:integration` is the only execution surface. [VERIFIED: package.json]

## Surface Map (exact current line numbers — verified against live tree)

### `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`
- `USAGE` string: **21-22** (`...[--installed] [--available] [--unavailable] [--scope ...]`). Add `[--unsupported]`.
- `BOOLEAN_FLAGS = new Set([...])`: **24**. Add `"--unsupported"`.
- Parse loop: **44-62** (`installed`/`available`/`unavailable` bool vars + token switch). Add an `--unsupported` branch and a `let unsupported = false`.
- `listPlugins({...})` call: **69-78**. Add `...(unsupported && { unsupported: true })`.
- `BOOLEAN_FLAGS` is re-exported at **83** for the completion provider — it is NOT currently imported there (see provider note), but adding `--unsupported` keeps it authoritative.

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
- `PluginRenderStatus` union: **103-115** (already includes `force-installed`/`force-upgradable`; the comment at 109-113 says `shouldShow` does NOT yet admit them under `--installed` — this phase flips that).
- `ListPluginsOptions`: **126-143** (`installed?`/`available?`/`unavailable?`). Add `unsupported?: boolean`.
- `filtersPassive`: **149-151**. Must also test `opts.unsupported !== true`.
- `shouldShow(opts, status)`: **153-174**. (1) widen the `--installed` arm (158-163) to also admit `"force-installed"` and `"force-upgradable"`; (2) add an `--unsupported` arm — but see the bucket finding below: `shouldShow` keys on render `status`, which CANNOT distinguish not-installed `unsupported` from `unavailable`.
- `availableRowMessage`: **422-497** — the collapse site. `resolved.state === "unsupported"` and `=== "unavailable"` BOTH return `status: "unavailable"` (449-467). This function must additionally surface the resolver bucket so the filter can select.
- `installedRowMessage`: **246-387** — already derives `force-installed` (306-315) and `force-upgradable` (346-355); no change needed for the row itself, only `shouldShow` admission.

### `extensions/pi-claude-marketplace/edge/completions/provider.ts`
- `flagCompletions`: **85-126**. reinstall `--force` push: **93-99** (DELETE per D-67-03). list flags `--installed/--available/--unavailable`: **101-107** (ADD `--unsupported`). install/update flags currently only `--map-model`: **109-117** (ADD `--force`).
- reinstall positional-extraction special-case: **260-261** — `extractPositionals(tokens, rawHead === "reinstall" ? ["--force"] : [])`. Change so `--force` is a recognized boolean flag for `install`/`update` (so the plugin-ref branch still fires at `positionals.length === 1`) and NO LONGER for `reinstall`.
- `--force` presence detection: NEW — detect whether `--force` precedes the positional (analogous to `extractScope`) and thread a `force: boolean` into `pluginRefBranchConfig`/`getPluginRefCompletions`.
- `pluginRefBranchConfig`: **189-245** — `install` (194-195) and `update` (202-207) arms gain force-awareness; `reinstall` (208-213) is unaffected by the force change but its mode stays installed-only.

### `extensions/pi-claude-marketplace/edge/completions/data.ts`
- Mode→status filtering doc comment: **21-29**.
- `getInstallPluginToMarketplacesMap`: **297-319** — keep `row.status === "available"` (310). Under `--force`, also keep `"unsupported"`.
- `getInstalledPluginToMarketplacesMap`: **321-347** — keeps `row.status === "installed"` (337). After the cache bump (Slice C) installed plugins split into `installed/upgradable/force-installed/force-upgradable`; **without `--force` this filter MUST admit ALL of them** (byte-identical-to-today constraint), and **with `--force` narrow to `upgradable`+`force-upgradable`**.
- `getMarketplaceOnlyCompletions`: **424-440** — uses `getPluginToMarketplacesMap("update", ...)`; the bare `@<marketplace>` update form inherits the same force-narrowing.
- `PluginRefCompletionMode`: **38-45** (no new mode needed; thread `force` as an option, not a mode).

### `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts`
- `USAGE`: **24-25** — DROP `[--force]`.
- `extractLocalFlag(args, ctx, USAGE, ["--force"])`: **33** — DROP the `["--force"]` passthrough (→ `[]`, or use the no-extra-flags overload). This is what makes bare `--force` fall through to the unknown-flag branch.
- Force parse: `let force = false` **46**, branch **49-50**, error branch **51-52** (this becomes the path `--force` now takes), orchestrator pass `...(force && { force: true })` **75-76** — DELETE all force-specific lines.

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
- `ReinstallPluginOptions.force?: boolean`: **149** — DELETE.
- `ReinstallPluginsOptions.force?: boolean`: **180** — DELETE.
- `reinstallPlugins` per-target call `...(opts.force === undefined ? {} : { force: opts.force })`: **458** — DELETE.
- `runLockedReinstall` destructure `const { ..., force } = opts;`: **1124** — DROP `force`.
- `replaceAll(handles, force, hooks)` signature: **1329-1333** — DROP the `force` param.
- `replacePreparedAgents(handles.agents, force === undefined ? {} : { force })`: **1340-1343** — make UNCONDITIONAL: `replacePreparedAgents(handles.agents, { force: true })`.
- NOTE: the `force: true` at **139/235/1732** are `fs.rm` options (`RemoveDataDirFn`), UNRELATED — leave them.

### `extensions/pi-claude-marketplace/edge/router.ts`
- `TOP_LEVEL_USAGE` reinstall help line: **93** — `reinstall [...] [--scope user|project] [--force]` → drop `[--force]`.

### `extensions/pi-claude-marketplace/shared/notify.ts`
- `STATUS_TOKENS` (count 22): **198-228** — `force-installed`/`force-upgradable` ALREADY present (226-227). **No change** — Phase 67 adds no render token.
- `PLUGIN_STATUSES` (count 17): **380-403** — likewise complete. **No change.**
- There is NO render token for "not-installed unsupported"; it renders `(unavailable)`. Catalog confirms (`docs/output-catalog.md:136`).

### `extensions/pi-claude-marketplace/shared/completion-cache.ts`
- `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion: Type.Literal(1)`: **72** — bump to `2` to force drop+rebuild of stale caches (mechanism exists at 88-89 / 189-196).
- `status` union `installed|available|unavailable`: **78-82** — extend with the finer buckets LIST-02 needs.
- `PluginIndexRow.status`: **94-98** — keep in lockstep with the schema literal union.

### `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`
- `loadManifestForMarketplace` bucketizer: **105-183** — installed-as-`installed` (131-137), not-installed `resolveStrict` collapse `unsupported`→`unavailable` (148-167, esp. 152-154/165). Extend to emit the finer statuses, reusing the list deriver's exact logic.

## Architecture Patterns

### Pattern 1: Internal resolver-state bucket for `--unsupported` (LIST-01)
**What:** The list filter currently keys on render `status` via `shouldShow(opts,
row.status)`. Since not-installed `unsupported` and `unavailable` both render
`(unavailable)`, the filter needs the *resolver bucket* (`available` /
`unsupported` / `unavailable`), not the render token.
**When to use:** Implementing `--unsupported` without a byte-output change.
**Recommended shape:** have `availableRowMessage` return `{ row, bucket }` (or have
`enumerateMarketplacePlugins` compute the bucket from `resolved.state` before
constructing the row) and pass `bucket` to `shouldShow`. Filter mapping:
- `--available` → bucket `available`
- `--unsupported` → bucket `unsupported` (not-installed only)
- `--unavailable` → bucket `unavailable` (NARROWED — now excludes `unsupported`)
- `--installed` → render status ∈ `{installed, upgradable, disabled, force-installed, force-upgradable}`

```typescript
// orchestrators/plugin/list.ts — availableRowMessage already computes resolved.state
// at line 441; capture it as the filter bucket instead of discarding it after the
// (unavailable) collapse (449-467). Source: source read, 2026-06-27.
switch (resolved.state) {
  case "installable":   /* bucket = "available"   */ break;
  case "unsupported":   /* bucket = "unsupported" */ break; // renders (unavailable)
  case "unavailable":   /* bucket = "unavailable" */ break;
}
```

### Pattern 2: Single classifier shared by list + completion (LIST-02)
**What:** D-67-02 forbids an independent classifier in the provider and requires the
SAME classification list uses. Today there are TWO: `installedRowMessage` /
`availableRowMessage` (list) and the `edge-deps.ts` bucketizer (completion).
**Recommended:** extract the per-entry classification (installed-record →
`installed|upgradable|force-installed|force-upgradable`; manifest-entry →
`available|unsupported|unavailable`, incl. the no-network candidate `resolveStrict`
that drives `force-upgradable`/`upgradable`) into ONE shared helper consumed by
both `orchestrators/plugin/list.ts` and `orchestrators/edge-deps.ts`. Then the
cache row carries the finer status and `data.ts` filters per `(mode, force)`.
**Cache invalidation:** install/update/reinstall already drop the plugin-index cache
(`dropMarketplaceCache`), and the 10-min TTL (`completion-cache.ts:113`) catches
cross-process drift; the finer `force-upgradable` status uses the same
cache/no-network candidate resolve (NFR-5).

### Pattern 3: `--force` detection mirrors `--scope` (LIST-02)
The provider already walks tokens for `--scope` (`data.ts::extractScope`) and treats
list flags as booleans in `extractPositionals`. Add `--force` to the boolean-flag
list for `install`/`update` positional extraction and a small `tokens.includes
("--force")`-style presence check threaded into the candidate-set selection. The
exact helper shape is Claude's Discretion (D-67).

### Anti-Patterns to Avoid
- **A new render token / glyph for not-installed `unsupported`.** Out of scope; it
  renders `(unavailable)`. `STATUS_TOKENS` stays 22 / `PLUGIN_STATUSES` stays 17.
- **A third classifier inside `provider.ts`.** D-67-02 forbids it; reuse/extend the
  bucketizer.
- **Bumping the cache schema without preserving no-`--force` output.** After
  splitting `installed`→4 buckets, the no-force update completion MUST still offer
  all four (today they were all `installed`); the no-force install MUST still offer
  ONLY `available` (NOT `unsupported`).
- **Leaving reinstall's `force` plumbing half-removed.** The `force` option threads
  through 6 sites (handler→`reinstallPlugins`→`reinstallPlugin`→`runLockedReinstall`
  →`replaceAll`→`replacePreparedAgents`); all must go or TS strict / the closed
  type will flag the orphan.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Classifying plugins for completion under `--force` | A bespoke classifier in `provider.ts` | The existing `resolveStrict`-based derivation, shared from the bucketizer/list deriver | D-67-02 mandates one classification; duplication drifts |
| Cache schema migration | Manual cache rewrite/backfill | Bump `schemaVersion` 1→2 — the read path already drops+rebuilds on mismatch (`completion-cache.ts:88,189`) | The drop-and-rebuild mechanism is purpose-built for this |
| reinstall foreign-content overwrite | New overwrite code | `replacePreparedAgents(..., {force:true})` (`bridges/agents/stage.ts:442-457`) | The bridge already implements unconditional overwrite + backup |
| Distinguishing `unsupported` vs `unavailable` rows | A new status token | The resolver `state` already computed in `availableRowMessage` (line 441) | Avoids a byte-contract change |

**Key insight:** Every capability this phase needs already exists in the resolver
and bridges; the work is *routing existing signals to new surfaces*, not building
new behavior.

## Runtime State Inventory

This is a refactor/flag-retirement phase — runtime state matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (`state.json`) | None. reinstall's `compatibility`/`resources` record shape is unchanged; no `force` field was ever persisted (it was an invocation-time flag only). | None — verified by reading `updateStateRecord` (`reinstall.ts:1418-1447`): no `force` field. |
| Live service config | None — no external services. | None. |
| OS-registered state | None. | None. |
| Secrets / env vars | None. | None. |
| Build artifacts / completion cache | The plugin-index completion cache (`*.json` under each scope's cache dir) carries `schemaVersion: 1` rows with the old 3-status set. Bumping to `2` makes every stale cache drop+rebuild on next read. | Cache schema bump (Slice C); NO manual migration — the read path rebuilds. |

**The canonical question — after every file is updated, what still has the old
string cached?** Only the plugin-index cache files, and the `schemaVersion` bump
auto-evicts them. No persisted `force` state exists anywhere (it was always an
invocation flag). [VERIFIED: source]

## Common Pitfalls

### Pitfall 1: `--unsupported` selecting structurally-`unavailable` rows
**What goes wrong:** Filtering on `row.status === "unavailable"` makes
`--unsupported` and `--unavailable` identical (both show every `(unavailable)`
row).
**Why:** `availableRowMessage` collapses resolver `unsupported`+`unavailable` into
one render token.
**How to avoid:** Filter on the resolver *bucket*, not the render status. Narrow
`--unavailable` to bucket `unavailable` in the same change.
**Warning signs:** A test that installs an `unsupported` (force-installable, not
installed) plugin and a structurally-broken plugin, runs `--unsupported`, and sees
both.

### Pitfall 2: Breaking no-`--force` completion when bumping cache granularity
**What goes wrong:** After splitting `installed`→4 statuses, the no-force `update`
completion suddenly offers fewer plugins (only `upgradable`), changing today's
output.
**Why:** Today ALL state-present plugins are `installed`; the no-force update path
returns all of them.
**How to avoid:** The no-force `update` filter must admit
`{installed, upgradable, force-installed, force-upgradable}`. Lock this with a
"no-force output byte-identical" regression test.
**Warning signs:** `provider.test.ts:934` ("reinstall completion mode shows only
installed plugins") analog for update fails, or a hand UAT shows a shrunken update
list.

### Pitfall 3: `install --force <TAB>` returning `null` today
**What goes wrong:** With `--force` not registered as a boolean flag for install,
`extractPositionals` counts it as a positional → `positionals.length === 2` → the
plugin-ref branch (which requires length 1) never fires → completion returns
`null`. Verified by tracing `provider.ts:260-294`.
**How to avoid:** Register `--force` as a boolean flag in positional extraction for
`install`/`update` (the same mechanism reinstall used for its now-removed `--force`).

### Pitfall 4: Orphaned `force` plumbing after partial removal
**What goes wrong:** Removing `--force` from the handler but leaving
`ReinstallPlugins{,Plugin}Options.force` (or vice-versa) leaves dead optional
fields / unused params.
**How to avoid:** Remove all 6 sites in one pass (handler 33/46-57/75; orchestrator
149/180/458/1124/1329-1343). TS strict + `noUnusedParameters` will flag stragglers.

### Pitfall 5: The reinstall flip-test asserts the OLD (gated) behavior
`tests/edge/handlers/plugin/reinstall.test.ts:216` ("--force works before and after
reinstall ref") asserts that WITHOUT `--force` a foreign-content reinstall renders
`(failed)` (239-240) and WITH `--force` it succeeds (242-267). After D-67-03 this
inverts: no-flag reinstall now SUCCEEDS unconditionally `(reinstalled)`, and
`reinstall --force` errors as UNKNOWN flag. This test must be rewritten, not
deleted.

## Validation Architecture

`npm run check` = `typecheck && lint && format:check && test && test:integration`.
The `test` script runs `node --test "tests/{architecture,...,edge,orchestrators,
...}/**/*.test.ts"`, which includes BOTH the catalog-UAT byte runner
(`tests/architecture/catalog-uat.test.ts`) and the closed-set tripwire
(`tests/architecture/notify-closed-set-locks.test.ts`). [VERIFIED: package.json]

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node ≥ 20.19 |
| Config | none (glob in `package.json` `test` script) |
| Quick run | `node --test "tests/edge/**/*.test.ts"` (handler + completion slices) |
| Catalog gate | `node --test "tests/architecture/catalog-uat.test.ts"` |
| Full suite | `npm run check` |

### Requirement / Decision → Verification Map

| ID | Behavior (observable) | Type | Assertion / Command | Where |
|----|----------------------|------|--------------------|-------|
| LIST-01 | `--unsupported` shows not-installed unsupported only; excludes force-installed & structural-unavailable | source+behavior | new handler test: `--unsupported` → `listPlugins({unsupported:true})`; new orchestrator test partitioning unsupported vs unavailable rows | `tests/edge/handlers/plugin/list.test.ts` (mirror 88-122), `tests/orchestrators/plugin/list.test.ts` |
| LIST-01 | `--installed` spans `installed`+`force-installed` (+`force-upgradable`) | behavior | orchestrator test: a force-installed plugin appears under `--installed`, absent under `--unsupported` | `tests/orchestrators/plugin/list.test.ts` |
| LIST-01 | usage string carries `[--unsupported]` | byte | assert `USAGE`/`TOP_LEVEL_USAGE` text | handler test + `tests/edge/router.test.ts` |
| LIST-02 | `install --force <TAB>` = available+unsupported (no unavailable) | behavior | new `provider.test.ts` case under `install --force ` with seeded unsupported/unavailable plugins | `tests/edge/completions/provider.test.ts` |
| LIST-02 | `update --force <TAB>` = upgradable+force-upgradable (no plain installed) | behavior | new `provider.test.ts` case under `update --force ` | same |
| LIST-02 | no-`--force` completion byte-identical to today | behavior (regression) | existing install/update completion cases stay green; add explicit "no-force unchanged" case | same |
| LIST-02 | `--force` offered as a flag completion for install/update; NOT for reinstall | byte | `provider.test.ts:343` flips (reinstall no longer offers `--force`); new install/update cases | `tests/edge/completions/provider.test.ts:343-356` |
| RINST-01 | `reinstall --force` → UNKNOWN flag usage error | behavior | rewrite `reinstall.test.ts:216`; bare `--force` joins the unknown-flag set (cf. 271-283) | `tests/edge/handlers/plugin/reinstall.test.ts` |
| RINST-01 | reinstall over foreign content succeeds with NO flag (`reinstalled`) | behavior | rewrite of the same test's first assertion (was `(failed)`) | same |
| RINST-01 | reinstall usage / router help drop `[--force]` | byte | `router.test.ts:87-89` flips to assert NO `[--force]` | `tests/edge/router.test.ts` |
| D-67-02 | completion classification reused (no provider-local classifier) | structural | existing architecture import-boundary tests stay green (edge/ ⇏ persistence/domain) | `tests/architecture/*` |
| D-67-04 | catalog byte-equality holds; closed set unchanged | byte | `catalog-uat.test.ts` green; `notify-closed-set-locks.test.ts` still `22/17/7` (NO bump this phase) | `tests/architecture/{catalog-uat,notify-closed-set-locks}.test.ts` |

### Sampling Rate
- **Per task:** the targeted `tests/edge/**` or `tests/orchestrators/plugin/**` file.
- **Per slice merge:** `npm test` (includes catalog-UAT + closed-set tripwire).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] New `--unsupported` handler + orchestrator filter tests (none exist —
  `grep --unsupported` returns zero hits across `extensions/ tests/ docs/`).
- [ ] New `install --force` / `update --force` completion candidate-set tests.
- [ ] Rewrite (not add) `reinstall.test.ts:216` and the `provider.test.ts:343`
  reinstall-`--force` flag case; `router.test.ts:87-89`.
- [ ] No new framework/fixtures needed — `withHermeticHome` + mock resolver
  infra already present.

## Byte-Contract & Docs (D-67-04)

| Surface | What references the changing strings | Action |
|---------|--------------------------------------|--------|
| `tests/edge/router.test.ts:87-89` | asserts `TOP_LEVEL_USAGE` contains `reinstall [...] [--force]` | Flip: assert NO `[--force]` |
| `tests/edge/router.test.ts:161` | dispatch test passes `"reinstall foo@bar --force"` (router is flag-agnostic) | Still passes; optional cleanup |
| `tests/edge/handlers/plugin/reinstall.test.ts:216,271-283` | `--force` success path; `--force=true` already unknown | Rewrite 216; bare `--force` now unknown |
| `tests/edge/completions/provider.test.ts:243-320` | list flag set, install/update `--map-model` | Add `--unsupported` to list; add `--force` to install/update |
| `tests/edge/completions/provider.test.ts:343-356,934-978` | reinstall `--force` flag + completion modes | Flip `--force` off reinstall; reinstall completion unchanged otherwise |
| `tests/edge/handlers/plugin/list.test.ts:88-122` | filter-flag propagation | Add `--unsupported` propagation case |
| `docs/output-catalog.md` | rendered output states only (no CLI usage strings); has `force-installed-inventory` (331), `force-upgradable-inventory` (342), `success-force-installed-with-soft-dep` (411) | No new catalog STATE needed for filters/completion (not notify() output). Verify no prose mentions `reinstall --force`; update list-filter prose to mention `--unsupported` if present. Catalog-UAT must stay green. |
| `docs/messaging-style-guide.md` | grammar/severity prose; no `--force`/filter mentions found | Light/no change; verify no stale `reinstall --force` reference. |

**Catalog-UAT scope note:** the byte runner drives `notify()` output ONLY. The
`--unsupported` filter and `--force` completion sets are NOT notify() output, so
they are NOT catalog-UAT states — they are exercised by handler/provider unit tests.
The catalog gate matters here only to confirm NO render bytes changed (they don't).

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| reinstall command-local `--force` (overload of the install/update `--force`) | reinstall always overwrites; `--force` belongs only to install/update | Phase 67 | Removes the last overloaded `--force` meaning on the command surface |
| not-installed `unsupported` indistinguishable in completion cache | finer `PluginIndexRow` status set (schema v2) | Phase 67 | Completion can offer force-install/force-update candidates |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `--installed` should also admit `force-upgradable` (not only `installed`+`force-installed` named in D-67-01), by parity with the existing `upgradable`/`disabled` treatment | shouldShow widening | LOW — a force-upgradable plugin is recorded-installed; excluding it would hide an installed plugin from `--installed`. Planner should confirm, but consistency strongly favors inclusion. |
| A2 | `--unavailable` should be NARROWED to exclude not-installed `unsupported` so filters partition cleanly ("each filter targets one realized state" — D-67-01) | Pattern 1 | MEDIUM — D-67-01 doesn't explicitly say `--unavailable` changes. If existing `--unavailable` tests/catalog assume it shows unsupported rows, they'd need updating. Recommend partition; flag for discuss if a test breaks. |
| A3 | Bumping `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion` is within "no state-model changes" (the completion cache is an ephemeral optimization cache, not `state.json`) | Slice C | LOW — the cache has an explicit drop+rebuild-on-mismatch contract; it is not the persisted state model. |
| A4 | Extending the `edge-deps.ts` bucketizer (which already calls `resolveStrict`) satisfies D-67-02's "same classification, no provider-local classifier" | Pattern 2 | LOW-MEDIUM — strict reading of "the SAME classification list uses" favors extracting a shared helper consumed by both list + bucketizer. Recommend the shared-helper extraction to be safe. |

## Open Questions (RESOLVED)

1. **Does `--unavailable` narrow (exclude not-installed `unsupported`)?**
   - RESOLVED: YES, partition. `--unavailable` = bucket `unavailable` only.
     Resolved by Plan 67-02 Task 2; the MEDIUM-risk A2 assumption is guarded by
     the plan's RED-first TDD task running `tests/{edge,orchestrators}/**/list*`
     early to catch any prior assumption that `--unavailable` showed unsupported
     rows.
   - Known: D-67-01 says each filter targets one realized state cleanly; passive
     (no-filter) shows everything.
   - Unclear: whether existing `--unavailable` tests assume unsupported rows appear.
   - Recommendation: partition (`--unavailable` = bucket `unavailable` only);
     run `tests/{edge,orchestrators}/**/list*` early to catch any assumption.

2. **Shared classifier extraction vs. parallel bucketizer extension (A4).**
   - RESOLVED: EXTRACT one shared helper. Plan 67-03 creates
     `orchestrators/plugin/plugin-state-classifier.ts` consumed by both
     `orchestrators/plugin/list.ts` and the `orchestrators/edge-deps.ts`
     bucketizer, with a parity test as the drift guard (the mirror-with-parity
     fallback is NOT taken).
   - Known: two classifiers exist today; D-67-02 wants one.
   - Recommendation: extract the per-entry derivation into one helper consumed by
     both `orchestrators/plugin/list.ts` and `orchestrators/edge-deps.ts`. If the
     refactor proves large, an acceptable fallback is extending the bucketizer to
     mirror the list deriver exactly, with a parity test asserting the two agree
     on a shared fixture.

3. **Does no-`--force` `update` completion semantics actually change?** Today it
   offers all installed plugins. After the cache split it must still offer all
   installed-family statuses.
   - RESOLVED: NO change. No-`--force` completion stays byte-identical. Pinned by
     Plan 67-04 Task 1, which adds explicit byte-identical no-force regression
     cases for install and update before the cache schema bump lands.

## Project Constraints (from CLAUDE.md / project skills)

- **Conventional Commits**, title 5-72 chars, body ≤80; one `npm run check`-green
  commit for the lockstep change (D-67-04). [CITED: CLAUDE.md]
- **ASCII-only commit messages** — the `fix-unicode-dashes` hook rejects em
  dashes in `COMMIT_EDITMSG`. [CITED: MEMORY.md]
- **`pre-commit run --all-files` before commit**; never `--no-verify`; from a
  worktree prefix `SKIP=trufflehog`. [CITED: CLAUDE.md]
- **Comment/test-title policy** (`.claude/rules/typescript-comments.md`): use
  `D-67-NN` / `LIST-NN` / `RINST-NN` / `NFR-N` IDs; NEVER GSD phase/plan/wave
  references in comments or test titles. [CITED: project rule]
- **All user output via `ctx.ui.notify`**; no direct stdout/stderr (IL-2). Usage
  errors go through `notifyUsageError`. [CITED: CLAUDE.md]
- **NFR-5 (no network):** the force-upgradable candidate resolve in the bucketizer
  must use the no-network `resolveStrict` path (it already does). The
  `no-orchestrator-network` architecture test guards `orchestrators/plugin/list.ts`.

## Sources

### Primary (HIGH confidence) — live source read 2026-06-27
- `edge/handlers/plugin/list.ts`, `orchestrators/plugin/list.ts` — filter machinery, render-status collapse.
- `edge/completions/provider.ts`, `edge/completions/data.ts` — completion dispatch + candidate filtering.
- `shared/completion-cache.ts`, `orchestrators/edge-deps.ts` — cache schema + bucketizer (the granularity gap).
- `edge/handlers/plugin/reinstall.ts`, `orchestrators/plugin/reinstall.ts`, `bridges/agents/stage.ts` — reinstall force plumbing + unconditional overwrite target.
- `edge/router.ts` — usage help.
- `shared/notify.ts` (198-440, force-token render arms) — closed sets (22/17/7), no token change.
- `docs/output-catalog.md`, `docs/messaging-style-guide.md` — byte-contract surfaces.
- `tests/architecture/{catalog-uat,notify-closed-set-locks}.test.ts`, `tests/edge/{router,handlers/plugin/{list,reinstall},completions/provider}.test.ts` — binding assertions.
- `package.json` — `npm run check` composition.

### Secondary
- `.planning/phases/67-CONTEXT.md` (D-67-01..04), `.planning/REQUIREMENTS.md` (LIST-01/02, RINST-01), `.planning/ROADMAP.md` (Phase 67 success criteria), `.planning/phases/66-CONTEXT.md` (the derived force states reused).

## Metadata

**Confidence breakdown:**
- Surface map / line numbers: HIGH — read every file directly.
- LIST-01 design (bucket): HIGH — collapse site verified at `list.ts:449-467`.
- LIST-02 design (cache granularity gap): HIGH — `PluginIndexRow` + bucketizer verified.
- RINST-01 plumbing: HIGH — all 6 force sites located.
- `--unavailable` narrowing (A2): MEDIUM — design recommendation, not locked.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable in-repo brownfield; only invalidated by
further edits to the same files before planning).

## RESEARCH COMPLETE
