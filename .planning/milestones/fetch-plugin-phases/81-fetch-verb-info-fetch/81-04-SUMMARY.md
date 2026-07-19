---
phase: 81-fetch-verb-info-fetch
plan: 04
subsystem: edge
tags: [fetch, edge, router, completion, architecture-gate, tdd, typescript]

# Dependency graph
requires:
  - phase: 81-02
    provides: "orchestrators/plugin/fetch.ts exporting fetchPlugins + FetchTarget union"
  - phase: prior-command-migrations
    provides: "edge/router.ts + register.ts SubcommandHandlers wiring; edge/completions provider/data pluginRef surface; no-orchestrator-network gate"
provides:
  - "/claude:plugin fetch as a routed, tab-completed verb across all three shapes"
  - "edge/handlers/plugin/fetch.ts (thin shim) exporting makeFetchHandler + parseFetchTarget"
  - "fetch PluginRefMode + FETCH_STATUSES fetchable-bucket filter in edge/completions"
  - "orchestrators/plugin/fetch.ts locked in FORBIDDEN_TARGETS (zero-git-surface gate)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin-shim edge handler: parse argv into the orchestrator's discriminated union, reject non-scope flags inline, delegate (mirrors info.ts / update.ts)"
    - "Pure exported parser (parseFetchTarget) so the three-shape FetchTarget mapping is unit-tested directly without mocking the orchestrator"
    - "Manifest-driven completion candidate map (getFetchPluginToMarketplacesMap) with a status filter and NO install-state exclusion"
    - "Mode-parametrized marketplace-only completion (no longer hardcoded to update)"

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
    - tests/edge/handlers/plugin/fetch.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/router.test.ts
    - tests/architecture/no-orchestrator-network.test.ts

key-decisions:
  - "D-81-01: the shim maps three positional shapes to FetchTarget -- bare -> {all}, @<mp> -> {marketplace}, <plugin>@<mp> -> {plugin}"
  - "D-81-03: fetch <tab> offers FETCH_STATUSES = {remote, available, partially-available, unavailable}; pinned-warm is not excludable from the completion cache so option (a) offers warm buckets and pinned-warm no-ops if typed"
  - "T-81-10: only --scope is sanctioned; every other long flag routes to the USAGE error path (closed shape set = injection guard)"
  - "T-81-11: orchestrators/plugin/fetch.ts added to FORBIDDEN_TARGETS; the gitOps-exempt set stays exactly {update.ts}"
  - "parseFetchTarget is exported so the three-shape mapping is asserted directly (the codebase has no mock.module pattern; other shims prove delegation via hermetic orchestrator output only)"

patterns-established:
  - "getMarketplaceOnlyCompletions is now mode-parametrized: update/reinstall keep the installed-inventory set; fetch uses the fetchable set"

requirements-completed: [FTCH-01, FTCH-07]

coverage:
  - id: T1
    description: "parseFetchTarget maps bare/@mp/pl@mp to the correct FetchTarget kind and propagates --scope"
    requirement: "FTCH-01"
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/fetch.test.ts :: parse :: three shapes + --scope"
        status: pass
    human_judgment: false
  - id: T2
    description: "non-scope flags, bad --scope, arity overflow, and malformed refs route through notifyUsageError"
    requirement: "FTCH-01"
    verification:
      - kind: test
        ref: "fetch.test.ts :: parse :: flag / arity / malformed-ref rejection"
        status: pass
    human_judgment: false
  - id: T3
    description: "the shim reaches fetchPlugins (bare form -> `(no marketplaces)` against empty hermetic state)"
    requirement: "FTCH-01"
    verification:
      - kind: test
        ref: "fetch.test.ts :: shim :: bare fetch reaches fetchPlugins"
        status: pass
    human_judgment: false
  - id: T4
    description: "fetch <tab> offers the fetchable buckets and excludes installed-family; fetch @<tab> offers marketplace names; --scope narrows the set"
    requirement: "FTCH-07"
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts :: FTCH-07 fetch completion cases"
        status: pass
    human_judgment: false
  - id: T5
    description: "router dispatches fetch to handlers.fetch"
    requirement: "FTCH-01"
    verification:
      - kind: test
        ref: "tests/edge/router.test.ts :: dispatches fetch to handlers.fetch"
        status: pass
    human_judgment: false
  - id: G1
    description: "no-orchestrator-network gate passes AND fetch.ts is in FORBIDDEN_TARGETS; exempt set stays {update.ts}"
    requirement: "FTCH-01"
    verification:
      - kind: test
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: false
  - id: G2
    description: "completion-cache schemaVersion unchanged (still 6)"
    requirement: "FTCH-07"
    verification:
      - kind: other
        ref: "grep schemaVersion completion-cache.ts -> Type.Literal(6) unchanged"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-14
status: complete
---

# Phase 81 Plan 04: fetch edge wiring Summary

**`/claude:plugin fetch` is now a fully routed, tab-completed verb across all three positional shapes: a thin shim parses argv into the `FetchTarget` union and delegates to `fetchPlugins`, the completion surface offers the fetchable git-source buckets (and marketplace names for the `@<tab>` form), and `orchestrators/plugin/fetch.ts` is permanently locked in the no-orchestrator-network gate's `FORBIDDEN_TARGETS`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (each TDD RED -> GREEN)
- **Files:** 2 created, 7 modified (525 insertions net)

## Accomplishments

- **Task 1 — router + handler + gate:**
  - `edge/router.ts` gains `fetch` at all four update-parallel sites: the `SubcommandHandlers` interface, the `TOP_LEVEL_SUBCOMMANDS` tuple, `TOP_LEVEL_USAGE` (a line byte-parallel to update, plus the header keyword list), and the `routeClaudePlugin` switch.
  - `edge/register.ts` imports `makeFetchHandler` and adds `fetch: makeFetchHandler(pi)` to the handlers record.
  - `edge/handlers/plugin/fetch.ts` is the new thin shim. `parseFetchTarget` (exported, pure) maps the three shapes to `FetchTarget` — bare → `{ kind: "all" }`, `@<mp>` → `{ kind: "marketplace" }`, `<plugin>@<mp>` → `{ kind: "plugin" }` — accepts only `--scope`, and routes every other flag / arity overflow / malformed ref to the USAGE error path. `makeFetchHandler` delegates to `fetchPlugins` with the parsed target + optional scope (production leaves `credentialOps`/`deviceFlowHttp` at their real defaults, exactly as the update handler does).
  - `tests/architecture/no-orchestrator-network.test.ts` adds `orchestrators/plugin/fetch.ts` to `FORBIDDEN_TARGETS`; the gitOps-exempt set stays exactly `{update.ts}`.
- **Task 2 — completion branch + fetchable filter:**
  - `edge/completions/provider.ts` adds `"fetch"` to `PluginRefMode` and a `case "fetch"` returning `allowMarketplaceOnly: true` (mirrors update).
  - `edge/completions/data.ts` adds `FETCH_STATUSES = {remote, available, partially-available, unavailable}` and a manifest-driven `getFetchPluginToMarketplacesMap` (NO install-state exclusion), routed in `getPluginToMarketplacesMap`. `getMarketplaceOnlyCompletions` is now mode-parametrized so `fetch @<tab>` lists marketplaces carrying a fetchable plugin (update/reinstall behavior unchanged — same installed-inventory set).
  - Completion-cache `schemaVersion` stays `6` (no schema bump).

## Task Commits

1. **Task 1 (RED):** `ef96768a` — `test(81-04)` scaffold fetch handler shim tests
2. **Task 1 (GREEN):** `c710f012` — `feat(81-04)` register fetch verb + lock zero-git-surface
3. **Task 2 (RED):** `7b5d79cc` — `test(81-04)` assert fetch completion buckets + router dispatch
4. **Task 2 (GREEN):** `ed6643e9` — `feat(81-04)` wire fetch completion branch + fetchable status filter

## Files Created/Modified

- **Created:** `edge/handlers/plugin/fetch.ts`, `tests/edge/handlers/plugin/fetch.test.ts`
- **Modified:** `edge/router.ts`, `edge/register.ts`, `edge/completions/provider.ts`, `edge/completions/data.ts`, `tests/edge/completions/provider.test.ts`, `tests/edge/router.test.ts`, `tests/architecture/no-orchestrator-network.test.ts`

## Decisions Made

- **`parseFetchTarget` exported for direct assertion.** The plan asked to "stub the orchestrator, assert the FetchTarget kind for each shape." The codebase has no `mock.module` pattern — sibling shims (`info.test.ts`, `update.test.ts`) prove delegation only indirectly via hermetic orchestrator output. Because `fetchPlugins` enumerates from state, an empty hermetic fixture yields `(no marketplaces)` for ALL three shapes (unlike update's per-shape `{not added}`), so observable output cannot distinguish the kinds. Extracting the pure `parseFetchTarget` parser keeps the shim thin and lets the three-shape mapping be asserted exactly, with a hermetic delegation test proving the shim reaches `fetchPlugins`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tests asserting the top-level verb set / SubcommandHandlers shape.**
- **Found during:** Task 2 typecheck + test run.
- **Issue:** Adding `fetch` to `TOP_LEVEL_SUBCOMMANDS` and the `SubcommandHandlers` interface broke two pre-existing tests: the TC-1 completion test asserts the full sorted keyword set, and the router test builds a `SubcommandHandlers` stub (missing `fetch` → TS2741).
- **Fix:** Added `"fetch"` to the TC-1 expected list, added `fetch: mk("fetch")` to the router stub, and added a `dispatches fetch to handlers.fetch` router test. These are directly caused by this plan's router change (in-scope).
- **Files modified:** `tests/edge/completions/provider.test.ts`, `tests/edge/router.test.ts`
- **Commits:** `7b5d79cc`

## Gate Compliance

- **Architecture gate:** `no-orchestrator-network.test.ts` passes; `FORBIDDEN_TARGETS` now includes `orchestrators/plugin/fetch.ts`; the gitOps-exempt set is still exactly `{update.ts}` (fetch.ts is on no exempt list).
- **Schema gate:** `completion-cache.ts` `schemaVersion` unchanged — `Type.Literal(6)`.
- **Comment policy:** new comments carry only requirement/decision IDs (FTCH-01, FTCH-07, D-81-01, D-81-03, T-81-10) — no `Phase N` / `Plan N` / `Wave N` planning tokens.
- **TDD gate sequence:** `test(81-04)` → `feat(81-04)` present for both tasks in git log.
- **Quality:** typecheck + eslint + prettier green for all touched files; 116 touched-suite tests pass (edge suite 329 pass; orchestrator fetch + architecture 7 pass).

## Known Stubs

None. The shim is fully wired to the real `fetchPlugins`; the completion branch is fully wired to the real cache-backed candidate map.

## Issues Encountered

- The worktree has no `node_modules`; typecheck / eslint / prettier / `node --test` ran by symlinking the main checkout's `node_modules` into the worktree, then deleting the symlink before finishing (no symlink is committed or left behind).
- The trufflehog pre-commit hook cannot scan the worktree git layout (`.git` is a file, sandbox limitation); commits used `SKIP=trufflehog` per project policy. The underlying scan is clean (no secrets in source/test files).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts` exists.
- `tests/edge/handlers/plugin/fetch.test.ts` exists.
- Commits `ef96768a`, `c710f012`, `7b5d79cc`, `ed6643e9` present in git history.

---
*Phase: 81-fetch-verb-info-fetch*
*Completed: 2026-07-14*
