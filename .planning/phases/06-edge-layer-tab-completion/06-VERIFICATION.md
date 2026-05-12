---
phase: 06-edge-layer-tab-completion
verified: 2026-05-11T12:37:00-04:00
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
test_suite: "npm test -> 799 pass / 0 fail / 0 skip"
requirements_covered:
  - AP-1
  - AP-2
  - AP-3
  - AP-4
  - TC-1
  - TC-2
  - TC-3
  - TC-4
  - TC-5
  - TC-6
  - TC-7
  - TC-8
  - TC-9
---

# Phase 6: Edge Layer & Tab Completion -- Verification Report

**Phase Goal:** A Pi user can drive `/claude:plugin` end-to-end: subcommand routing
with Usage blocks on empty/unknown input, quoted-argument tokenization, `--scope`
validation, fish-style space normalization, and tab completion at every position
with soft-fail on per-marketplace manifest errors.

**Verified:** 2026-05-11T12:37:00-04:00
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Tab completion: first positional surfaces `install/uninstall/update/list/marketplace`; after `marketplace` surfaces `add/remove/list/update/autoupdate/noautoupdate` (`rm` accepted but not surfaced); after `--scope` surfaces only `user`/`project` | VERIFIED | `edge/completions/provider.ts:44-59` exports `TOP_LEVEL_SUBCOMMANDS` (5 keywords) and `MARKETPLACE_SUBCOMMANDS` (6 keywords -- no `rm`). Branch 3 (lines 128-133) emits MARKETPLACE_SUBCOMMANDS after `marketplace`. Branch 2a (lines 93-99) emits only `["user", "project"]` after `--scope`. Router (`router.ts:122-138`) accepts both `remove` and `rm` cases. |
| 2 | Plugin tokens for `install/uninstall/update <here>` complete to `<plugin>@<marketplace>`; `update` accepts bare `@<marketplace>`; per-marketplace manifest-load failures soft-fail to empty; top-level `state.json` errors propagate | VERIFIED | `provider.ts:139-155` calls `getPluginRefCompletions` with status-aware mode; `update` passes `allowMarketplaceOnly: true`. `orchestrators/edge-deps.ts:113-186` wraps manifest-load errors in `ManifestSoftFailError` (TC-8 soft-fail). `loadStateForScope` (line 87-91) lets `loadState` errors propagate verbatim (TC-9). `shared/completion-cache.ts:122` defines `ManifestSoftFailError`; cache rebuild path uses it to emit empty plugin list. |
| 3 | Tokenizer handles single/double quotes; missing/invalid `--scope` errors clearly; `--scope` at any position; `Usage:` block at `error` severity on empty/unknown subcommand | VERIFIED | `edge/args.ts:65-91` `tokenize()` handles single (`'`) and double (`"`) quotes; line 76 splits on ASCII space when not in quotes. Lines 41-50 throw clear errors (`--scope requires a value...` / `Invalid --scope value...`). While-loop traversal (line 34) accepts `--scope` at any position. `edge/router.ts:88-91, 105-106` calls `notifyUsageError` (shared/notify.ts wrapper) at `error` severity for empty and unknown subcommands. |
| 4 | All terminal completions include trailing space; double-space collapse via fish-style normalization scoped to `/claude:plugin` | VERIFIED | All terminal completion values in `provider.ts` use `${headPrefix}${label} ` / `label + " "` (lines 85-88, 98, 119, 131, plus `getMarketplaceCompletions` / `getPluginRefCompletions` in data.ts -- both append " "). `edge/completions/normalize.ts:26-44` implements `normalizeCompletionWhitespace` (collapse run of spaces at cursor). `register.ts:101-117` installs the wrapper via `pi.on("session_start")`; the wrapper at line 108-110 gates normalization on `isClaudePluginCommandLine(original)` (regex `/^\/claude:plugin(?::\d+)?(?:\s|$)/` at normalize.ts:24). |
| 5 | Every user-visible message routes through `ctx.ui.notify`; ESLint blocks any new `process.stdout`/`stderr` write in `src/edge/` | VERIFIED | `eslint.config.js:67-83` applies `no-restricted-syntax` to `extensions/pi-claude-marketplace/**/*.ts` (a superset of `edge/`), targeting `process.stdout.write` and `process.stderr.write` with clear messages citing IL-2. Line 118-120 carves out `shared/notify.ts` as the single sanctioned channel. Plan 06-05 SUMMARY documents a probe-file ESLint test confirming the rule is active for `edge/probe.ts`. Router uses `notifyUsageError` (shared/notify.ts). All edge handlers delegate to orchestrators which use `notify*` wrappers. |

**Score:** 5/5 truths VERIFIED

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/edge/args.ts` | Tokenizer + `--scope` validator (AP-1, AP-2, AP-4) | VERIFIED | 92 lines; quote-aware tokenize; throws on missing/invalid scope; while-loop for any-position |
| `extensions/pi-claude-marketplace/edge/args-schema.ts` | `parseCommandArgs(args, schema, notifyError)` | VERIFIED | 100 lines; positional schema with required/optional; routes errors to `notifyError` callback |
| `extensions/pi-claude-marketplace/edge/router.ts` | Dispatch + Usage blocks (AP-3) | VERIFIED | 141 lines; `routeClaudePlugin` + `routeMarketplace`; `TOP_LEVEL_USAGE` + `MARKETPLACE_USAGE` constants; `rm` alias case |
| `extensions/pi-claude-marketplace/edge/types.ts` | `EdgeDeps` interface | VERIFIED | Present (946B) |
| `extensions/pi-claude-marketplace/edge/completions/normalize.ts` | TC-7 normalization | VERIFIED | 49 lines; `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` regex |
| `extensions/pi-claude-marketplace/edge/completions/data.ts` | Cache-backed data accessors | VERIFIED | 11K; uses `SCOPES` constant for cross-scope enumeration |
| `extensions/pi-claude-marketplace/edge/completions/provider.ts` | `getArgumentCompletions` dispatcher | VERIFIED | 183 lines; 5 branches (TC-1..TC-6); status-aware mode for install/uninstall/update |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/{install,uninstall,update,list}.ts` | Thin shim handlers | VERIFIED | All 4 present (1.4K-2.5K each) |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts` | Thin shim handlers | VERIFIED | All 5 present (1.1K-1.8K each) |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | Two LLM tool registrations | VERIFIED | TypeBox params schemas; `pi_claude_marketplace_list` (empty params) + `pi_claude_marketplace_plugin_list` (filter params) |
| `extensions/pi-claude-marketplace/edge/register.ts` | `registerClaudePluginCommand` + `registerClaudeMarketplaceTools` | VERIFIED | 129 lines; both helpers exported; `pi.on("session_start")` wrapper installs normalize; `process.cwd()` at one sanctioned site |
| `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` | `makeLocationsResolver` constructor | VERIFIED | Present (8.0K); closes over persistence + domain; wraps manifest errors in `ManifestSoftFailError` (TC-8); propagates state errors (TC-9) |
| `extensions/pi-claude-marketplace/shared/completion-cache.ts` | Two-tier cache | VERIFIED | Present (13K); exports `getMarketplaceNames`, `getPluginIndex`, `invalidateMarketplaceNames`, `invalidateMarketplaceCache`, `dropMarketplaceCache`, `ManifestSoftFailError`, `__resetCacheForTests` |
| `extensions/pi-claude-marketplace/persistence/locations.ts` | Cache helpers added | VERIFIED | Lines 73-99, 130-208: `cacheDir`, `marketplaceNamesCacheFile`, `pluginCacheFile(mp)` -- the last routes through `assertSafeName` + `assertPathInside` (NFR-10) |

### Key Link Verification (Wiring)

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `edge/router.ts` | `shared/notify.ts::notifyUsageError` | direct import | WIRED | Imported at line 28; called on empty (line 89) and unknown subcommand (line 105) |
| `edge/register.ts` | `routeClaudePlugin` | `pi.registerCommand` handler | WIRED | Line 88: `handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx)` |
| `edge/register.ts` | `getArgumentCompletions` | `pi.registerCommand` `getArgumentCompletions` | WIRED | Lines 92-93: passes through `makeLocationsResolver(process.cwd())` |
| `edge/register.ts` | `normalizeCompletionWhitespace` | `pi.on("session_start")` provider | WIRED | Lines 101-117: scoped via `isClaudePluginCommandLine` (line 108) |
| `edge/register.ts` | LLM tools | `registerClaudeMarketplaceTools(pi)` | WIRED | Lines 125-128: calls `registerListMarketplacesTool` + `registerListPluginsTool` |
| `orchestrators/marketplace/add.ts` | cache invalidation | post-state-commit call | WIRED | Lines 125-126: `invalidateMarketplaceNames(opts.scope)` + `invalidateMarketplaceCache(opts.scope, recordedName)` |
| `orchestrators/marketplace/remove.ts` | cache invalidation | post-state-commit call | WIRED | Lines 158-160: `invalidateMarketplaceNames` + `await dropMarketplaceCache` |
| `orchestrators/marketplace/update.ts` | cache invalidation | post-state-commit call | WIRED | Line 284: `invalidateMarketplaceCache(scope, name)` |
| `orchestrators/plugin/install.ts` | cache invalidation | post-state-commit call | WIRED | Line 595: `invalidateMarketplaceCache(scope, marketplace)` |
| `orchestrators/plugin/uninstall.ts` | cache invalidation | post-state-commit call | WIRED | Line 159: `invalidateMarketplaceCache(scope, marketplace)` |
| `orchestrators/edge-deps.ts::loadManifestForMarketplace` | TC-8 soft-fail | `ManifestSoftFailError` wrap | WIRED | Lines 113-185: wraps every manifest read failure |
| `orchestrators/edge-deps.ts::loadStateForScope` | TC-9 propagation | unwrapped `loadState` | WIRED | Lines 87-91: `loadState` errors propagate without wrapping |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `provider.ts::getArgumentCompletions` | suggestions list | `resolver.loadStateForScope` + `loadManifestForMarketplace` via cache; live `state.json` + `marketplace.json` | YES (rebuild path goes through `loadState` + `loadMarketplaceManifest`, not stub fixtures) | FLOWING |
| `handlers/tools.ts::pi_claude_marketplace_list` | `marketplaces` payload | `loadVisibleMarketplaces({ cwd: ctx.cwd })` | YES (live state.json read) | FLOWING |
| `handlers/tools.ts::pi_claude_marketplace_plugin_list` | `plugins` payload | `loadPluginListPayload` (orchestrator) | YES (live state + manifest read) | FLOWING |
| `edge/handlers/plugin/install.ts` (and 8 sibling shims) | orchestrator call | `parseCommandArgs` + delegation | YES (delegates to Phase 4/5 orchestrators which execute real mutations) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npm test` | `tests 799 / pass 799 / fail 0 / skipped 0 / duration_ms 4228` | PASS |
| 5 orchestrators have cache invalidation calls | `grep -E "invalidateMarketplace(Names|Cache)\|dropMarketplaceCache" orchestrators/{marketplace,plugin}/*.ts` | 13 matches across 5 files (add: 4, remove: 3, update: 2, install: 2, uninstall: 2) | PASS |
| ESLint blocks `process.stdout.write` in edge/ | inspect `eslint.config.js:67-83` | Rule applies to `extensions/pi-claude-marketplace/**/*.ts` (superset includes edge/); `process.stdout.write` and `process.stderr.write` in `no-restricted-syntax` array | PASS |
| `SCOPES` exported from shared/types.ts | `grep "SCOPES" shared/types.ts edge/completions/data.ts` | Defined at types.ts:19 as `["user", "project"] as const`; consumed in data.ts:33 import + lines 209, 230 | PASS |
| `normalize.ts` exists with correct regex | `grep CLAUDE_PLUGIN_LINE normalize.ts` | Regex `/^\/claude:plugin(?::\d+)?(?:\s|$)/` at line 24 (matches `/claude:plugin`, `/claude:plugin:42`, plus space/EOL terminators) | PASS |
| Cache helpers in locations.ts | `grep -E "cacheDir\|marketplaceNamesCacheFile\|pluginCacheFile" locations.ts` | 3 distinct helpers exported on `ScopedLocations`; `pluginCacheFile` containment-checks via `assertSafeName` + `assertPathInside` (lines 206-208) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AP-1 | 06-02 | Tokenizer handles single/double quotes, no escapes | SATISFIED | `args.ts:65-91`; tested in `tests/edge/args.test.ts` |
| AP-2 | 06-02 | `--scope` validation: invalid value throws clear error | SATISFIED | `args.ts:41-50` (clear error messages); tested |
| AP-3 | 06-02 | Router emits Usage on empty/unknown subcommand | SATISFIED | `router.ts:88-91, 105-106` via `notifyUsageError`; tested |
| AP-4 | 06-02 | `--scope` accepted at any position | SATISFIED | `args.ts:34` while-loop traversal; tested |
| TC-1 | 06-03 | First positional -> top-level keywords | SATISFIED | `provider.ts:84-89` |
| TC-2 | 06-03 | After `marketplace` -> nested keywords (`rm` NOT surfaced) | SATISFIED | `provider.ts:128-133`; router accepts `rm` alias (`router.ts:126-127`) |
| TC-3 | 06-03 | `-`/`--` prefix -> flags | SATISFIED | `provider.ts:103-122` |
| TC-4 | 06-03 | After `--scope` -> `user`/`project` | SATISFIED | `provider.ts:93-99` |
| TC-5 | 06-03/05 | `list <here>` / `marketplace <verb> <here>` -> marketplace names | SATISFIED | `provider.ts:160-171` via `getMarketplaceNamesAcrossScopes` |
| TC-6 | 06-03/05 | `install/uninstall/update <here>` -> status-aware `<plugin>@<marketplace>` | SATISFIED | `provider.ts:139-155` -- mode-specific filter; `update` allows bare `@<marketplace>` |
| TC-7 | 06-02/05 | Fish-style whitespace normalization scoped to `/claude:plugin` | SATISFIED | `normalize.ts:26-44` + `register.ts:101-117` |
| TC-8 | 06-03/05 | Manifest soft-fail per-marketplace -> empty list, no throw | SATISFIED | `edge-deps.ts:113-185` wraps as `ManifestSoftFailError`; cache treats as poison row |
| TC-9 | 06-03/05 | state.json error propagates | SATISFIED | `edge-deps.ts:87-91` -- `loadState` unwrapped |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `edge/args.ts` | 36-39 | `if (token === undefined)` -- unreachable defensive branch | Info | None; code-review IN-01; correctness unaffected |
| `edge/completions/data.ts` | 141-153 | `getScopeCompletions` exported but never called by provider; description UX silently lost | Warning | code-review WR-03; V1 description for `--scope user` UX is partially lost (TC-4 path uses inline variant without descriptions). Not a goal blocker -- the TC-4 acceptance criterion only requires `user`/`project` values, which IS satisfied. |
| `edge/register.ts` | 89-94 | Comment claims `process.cwd()` captured at registration time, but code re-evaluates per-keystroke | Warning | code-review WR-02; documentation drift, not a behavioral defect |
| `orchestrators/marketplace/autoupdate.ts` | 57-71 | No cache-invalidation call, breaking the precedent set by 5 sibling orchestrators | Warning | code-review WR-01; autoupdate flag is not in cache schema today so completion correctness is preserved; risk is future drift |
| `orchestrators/edge-deps.ts` | 107-187 | Per-marketplace `loadState` re-read on each manifest probe (O(N) state.json reads per cold-cache scope) | Warning | code-review WR-04; performance concern, not correctness; bounded to one keystroke |

None of these is a goal blocker. WR-01..WR-04 are documented in `06-REVIEW.md` (status `issues_found`, 0 critical, 4 warning, 5 info). All are deferrable per the review.

### Human Verification Required

None automated-verifiable items are blocking. The validation plan (`06-VALIDATION.md` "Manual-Only Verifications") lists two end-to-end UX flows that require a live Pi session:

1. **Live `/claude:plugin` typing in real Pi session** -- autocomplete keystroke loop, fish-style whitespace collapse, Usage emission rendering. Cannot be exercised by in-process mock `pi`. **Listed as Phase 7-bound** in 06-VALIDATION.md and the Phase 6 plan; Phase 6's wiring is what enables it. Phase 7 owns the verification.
2. **Real LLM-agent invocation of `pi_claude_marketplace_list` / `pi_claude_marketplace_plugin_list`** -- agent call-shape (param marshaling, chat rendering) is end-to-end. Same Phase 7-bound classification.

Both items are explicitly scheduled in 06-VALIDATION.md as Phase 7 manual verifications -- they do NOT block Phase 6 acceptance. Phase 6's contract is the in-process wiring + unit/integration test coverage, which `npm test` validates at 799/799.

### Gaps Summary

No gaps. All 5 ROADMAP Phase 6 Success Criteria are observably satisfied in the codebase on `features/initial-gsd`. The full `npm test` suite reports 799 pass / 0 fail / 0 skip / 4228 ms. ESLint, TypeScript, and Prettier checks were reported green by Plan 06-05 SUMMARY (`npm run check` exit 0).

The 4 warning-level findings in 06-REVIEW.md (WR-01 through WR-04) are documentation drift, dead exports, and performance / precedent concerns -- none break the user-facing contract or block goal achievement. They are appropriate to track as follow-up items for a future cleanup pass.

The 13 Phase 6 requirements (AP-1..AP-4, TC-1..TC-9) are all satisfied as evidenced by per-requirement source-file mappings and the unit/integration test suite that exercises each branch end-to-end.

---

*Verified: 2026-05-11T12:37:00-04:00*
*Verifier: Claude (gsd-verifier)*
