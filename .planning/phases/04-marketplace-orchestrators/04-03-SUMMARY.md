---
plan: 04-03
phase: 04-marketplace-orchestrators
status: complete
tasks_completed: 3
tasks_total: 3
---

# Plan 04-03 Summary: Phase 4 Presentation Helpers

## Goal achieved

Landed the three Phase 4 presentation helpers -- `reload-hint`, `soft-dep`, `marketplace-list` -- plus a barrel `index.ts` exposing them and tests for each. All helpers are pure (no IO, no ctx) and respect the D-11 import boundary (presentation may only import from domain/ and shared/).

## Tasks

### Task 1: presentation/reload-hint.ts + tests

Created `extensions/claude-marketplace/presentation/reload-hint.ts`:

- **`ReloadVerb` type** -- `"install" | "uninstall" | "update" | "add" | "remove"`.
- **`reloadHint(verb): string`** -- returns the standardized PRD §6.12 ES-5 byte-stable string `\n\nRun /reload to ${verb} the {plugin|marketplace}.` (Pi extensions can't trigger reload themselves; the user must run /reload).
- **`appendReloadHint(message, verb): string`** -- appends to an existing notification message, ensuring exactly one trailing blank line between the message body and the hint.

Tests cover each verb's exact output and the append-spacing behaviour.

Commit: `feat(04-03): add presentation/reload-hint helpers + tests`

### Task 2: presentation/soft-dep.ts + tests

Created `extensions/claude-marketplace/presentation/soft-dep.ts`:

- **`hasLoadedPiSubagents(ctx)` / `hasLoadedPiMcpAdapter(ctx)`** -- host-side probe predicates that check `ctx.loadedExtensions` for the soft-dep extension presence.
- **`subagentWarningIfNeeded(ctx, opts)` / `mcpAdapterWarningIfNeeded(ctx, opts)`** -- return the user-facing degraded-mode warning when the soft-dep is absent, else `null`. PRD §6.6 IS-2 / IS-3 -- soft-degrade never blocks install.

13 tests cover the probe predicates and the conditional-warning composer.

Commit: `feat(04-03): add presentation/soft-dep probes + tests`

### Task 3: presentation/marketplace-list.ts + barrel + tests

Created `extensions/claude-marketplace/presentation/marketplace-list.ts`:

- **`MarketplaceListEntry` interface** -- minimal structural shape the renderer consumes (`name`, `scope`, `source`, `autoupdate?`). Declared locally to honour D-11 (presentation cannot import from persistence). `MarketplaceRecord` from `state-io.ts` is a structural superset, so call sites pass `MarketplaceRecord[]` without casts.
- **`renderMarketplaceList(records): string`** -- ML-1 group-by-scope (user before project, blank line between groups, empty-scope omitted entirely), ML-2 `<icon> <name> (<source.logical>)[ [autoupdate]]` format using the `sourceLogical()` helper from `domain/source.ts` for the canonical URL / path string, ML-4 byte-stable `"No marketplaces configured."` for the empty case. ML-3 (no manifest reads) holds trivially -- this file does not touch IO at all.

Replaced the Phase 1 placeholder `extensions/claude-marketplace/presentation/index.ts` with a barrel re-exporting all three Phase 4 presentation modules (`appendReloadHint`, `reloadHint`, `ReloadVerb`, `hasLoadedPiMcpAdapter`, `hasLoadedPiSubagents`, `mcpAdapterWarningIfNeeded`, `subagentWarningIfNeeded`, `renderMarketplaceList`).

6 marketplace-list tests cover the ML-1 / ML-2 / ML-4 contract verbatim plus a github-source canonical-URL case and an empty-scope-omitted case.

Commit: `feat(04-03): add presentation/marketplace-list renderer + barrel + tests`

## Deviations from plan

**Rule 1 auto-fix -- `marketplace-list.ts` MarketplaceRecord import.** The verbatim plan reads `import type { ExtensionState } from "../persistence/state-io.ts"; type MarketplaceRecord = ExtensionState["marketplaces"][string]`. This violates the D-11 import boundary configured in `eslint.config.js`: `presentation/` may only import from `domain/` and `shared/`. Replaced with a local `MarketplaceListEntry` interface holding the four fields the renderer actually uses (`name`, `scope`, `source`, `autoupdate`). The persistence-layer `MarketplaceRecord` is a structural superset so this is invisible to callers.

**Rule 1 auto-fix -- github fixture in test.** The plan's verbatim test calls `githubSource("anthropics", "claude-plugins-official", "v1.0")` (a three-argument factory). The actual `githubSource` factory in `domain/source.ts` takes a single `raw` string and delegates to `parsePluginSource`. Adapted to `githubSource("https://github.com/anthropics/claude-plugins-official#v1.0")` -- produces the same `GitHubSource` value with `owner`, `repo`, and `ref` set, so the assertion against `sourceLogical()` output stays byte-stable.

## Key files created/modified

- `extensions/claude-marketplace/presentation/reload-hint.ts` -- created
- `extensions/claude-marketplace/presentation/soft-dep.ts` -- created
- `extensions/claude-marketplace/presentation/marketplace-list.ts` -- created
- `extensions/claude-marketplace/presentation/index.ts` -- replaced (Phase 1 placeholder → real barrel)
- `tests/presentation/reload-hint.test.ts` -- created
- `tests/presentation/soft-dep.test.ts` -- created
- `tests/presentation/marketplace-list.test.ts` -- created

## Verification

- `npm run check` -- typecheck + ESLint + Prettier + 470 tests all pass (445 baseline + 25 new presentation tests)
- `node --test tests/presentation/marketplace-list.test.ts` -- 6/6 pass
- `grep "export function renderMarketplaceList" presentation/marketplace-list.ts` -- present
- `grep "No marketplaces configured\." presentation/marketplace-list.ts` -- present
- `grep "import { sourceLogical }" presentation/marketplace-list.ts` -- present
- `grep "renderMarketplaceList\|reloadHint\|hasLoadedPiSubagents" presentation/index.ts` -- all three present

## What this enables

Wave 3+ orchestrators can import:

- `reloadHint` / `appendReloadHint` -- used by add / remove / update / install / uninstall to compose the user-visible "Run /reload" tail
- `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` -- used by `install` (Phase 5) for IS-2 / IS-3 soft-degrade warnings
- `renderMarketplaceList` -- used by `04-07 list` orchestrator (ML-1..4 entry point)

## Self-Check: PASSED

- [x] All tasks executed (3/3)
- [x] Each task committed individually (3 commits: reload-hint → soft-dep → marketplace-list)
- [x] SUMMARY.md created in plan directory
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes)
- [x] `npm run check` green
