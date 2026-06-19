---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 05
subsystem: ui
tags: [typescript, info-surface, hook-events, narrow-probe-error]

# Dependency graph
requires:
  - phase: 63-01
    provides: HookSummaryEntry discriminated union + components.hooks? carrier + multi-line hooks renderer arm in shared/notify.ts
  - phase: 57
    provides: ResolvedPlugin.hooksConfigPath marker (Phase 57 D-57-03 / D-57-04) + parseHooksConfig discriminated parser
provides:
  - composeResolvedComponents hooks branch in orchestrators/plugin/info.ts (re-parses <pluginRoot>/hooks/hooks.json + projects to HookSummaryEntry[])
  - projectHookSummaryEntries projection helper (per-group granularity; tool events carry matcher, non-tool events do not)
  - readHookSummaryEntries disk-read seam (mirrors resolver's parseHooksConfig call site)
  - composeResolvedComponents accepts hooksConfigPath?: string on its resolved-arg type
  - 5 new integration fixtures in tests/orchestrators/plugin/info.test.ts pinning the integration loop end-to-end
affects: [63-06, 63-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "two-phase disk read for info-render: resolver records the marker (hooksConfigPath), info.ts re-opens + re-parses at message-construction time (Pitfall 6 -- resolver discards parsed value)"
    - "ONE projection at message-construction time -- no string re-derivation at render time (Pitfall 5); renderer reads entry.event / entry.matcher directly"
    - "I/O failure pass-through: read errors propagate to the row-builder catch where the existing narrowProbeError ladder classifies them (Open Question 3 -- no new REASON, no new code path)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "[Phase 63] info.ts re-parses <pluginRoot>/hooks/hooks.json at info-render time rather than threading the parsed value through ResolvedPlugin -- preserves the resolver's read-once / discard-payload contract; the duplicate read is bounded (one file per info call)."
  - "[Phase 63] HookSummaryEntry projection granularity is per-(event, group), not per-handler -- the renderer surfaces event(matcher) once per group regardless of how many handlers the group declares (matches the test fixture's byte-form expectation)."
  - "[Phase 63] Group matcher defaults to the empty string when absent (MATCH-01 match-all sentinel) on tool-event projection -- the discriminated arm requires the field; the empty string preserves the renderer's existing rendering rules (no special-case at the projector layer)."

patterns-established:
  - "Two-phase disk read for info-render surfaces consuming domain-parser output: domain-side resolver records the marker (path / flag), info-side orchestrator re-opens + re-parses; both call sites share the same parseHooksConfig contract."

requirements-completed: [SURF-01]

# Metrics
duration: ~25min
completed: 2026-06-16
---

# Phase 63 Plan 05: info surface hooks: block wiring Summary

**Wire `info <plugin>` to surface a multi-line `hooks:` block by extending `composeResolvedComponents` to re-parse `<pluginRoot>/hooks/hooks.json` and project entries to the `HookSummaryEntry[]` carrier defined in Plan 63-01. Closes SURF-01.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 2 (info.ts + info.test.ts)
- **Tests added:** 5 integration fixtures

## Accomplishments

- `composeResolvedComponents` (`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:269-313`) extended with a hooks branch: when `resolved.hooksConfigPath !== undefined`, it reads + re-parses the file via `parseHooksConfig` and projects to `HookSummaryEntry[]` on the `components.hooks?` carrier; the renderer (Plan 63-01) iterates `COMPONENT_KINDS` to slot the multi-line block alphabetically between `commands:` and `mcp:`.
- `projectHookSummaryEntries` (`info.ts:210-230`) projection helper: per-(event, group) granularity (NOT per-handler), declaration order preserved end-to-end from the parsed file. Tool events (`PreToolUse` / `PostToolUse` / `PostToolUseFailure`) carry `matcher: string` (defaulting to the empty string for the MATCH-01 match-all sentinel); non-tool events carry no matcher (the discriminated arm forbids it).
- `readHookSummaryEntries` (`info.ts:247-268`) disk-read seam: mirrors the resolver's `readStandaloneHooks` call site (`homedir()` + `process.cwd()` ifCtx, `skipIfMap: true`, no-op `compileIf`). I/O failures propagate so the row-builder's outer catch can classify via the existing `narrowProbeError` ladder unchanged.
- `composeResolvedComponents`'s resolved-arg type grew `readonly hooksConfigPath?: string;` so the orchestrator can thread the marker from `ResolvedPlugin` (Phase 57 D-57-03).
- 5 new integration fixtures in `tests/orchestrators/plugin/info.test.ts:1304-1571` pinning: (1) installed-with-hooks byte form including alphabetical slot between `commands:` and `mcp:`; (2) unavailable-with-malformed-hooks renders `components: not resolved` and NO `hooks:` line; (3) installable-with-no-hooks renders the legacy 4-kind output unchanged; (4) available (not-installed) plugin with hooks also renders the block; (5) chmod-000 hooks.json surfaces `{permission denied}` through the existing narrowProbeError ladder.

## Task Commits

Each TDD gate was committed atomically:

1. **RED gate -- failing fixtures for hooks: block on info surface** -- `57535a6` (test)
2. **GREEN gate -- composeResolvedComponents hooks branch + projector + read seam** -- `2facdb5` (feat)

REFACTOR gate not needed -- the GREEN implementation matched the plan's structure directly (extracted helpers `projectHookSummaryEntries` + `readHookSummaryEntries` keep `composeResolvedComponents` body small).

## Exact line locations (post-Task-1 file state)

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:15-17` -- imports: `readFile` from `node:fs/promises`, `homedir` from `node:os`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:19-20` -- imports: `TOOL_EVENTS, ToolEvent` from hook-events; `parseHooksConfig, HooksConfig` from hooks
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:30` -- import: `HookSummaryEntry` from shared/notify
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:42-45` -- `TOOL_EVENT_SET` module-scope Set
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:210-230` -- `projectHookSummaryEntries` helper
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:247-268` -- `readHookSummaryEntries` disk-read seam
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:269-313` -- `composeResolvedComponents` with hooks branch + updated return type
- `tests/orchestrators/plugin/info.test.ts:1304-1571` -- 5 new fixtures

## Test count added

5 new integration fixtures in `tests/orchestrators/plugin/info.test.ts`:

1. `SURF-01 / D-63-04: installed plugin with hooks/hooks.json renders multi-line hooks: block between commands: and mcp:` -- byte-form fixture (2 PreToolUse groups + 1 PostToolUse group + 1 SessionStart group, with `commands:` and `mcp:` also present to verify the alphabetical slot end-to-end).
2. `SURF-01 / D-63-04: unavailable plugin (malformed hooks/hooks.json) renders components: not resolved and NO hooks: line` -- unavailable-plugin contract preserved (no hooks line under `components: not resolved`).
3. `SURF-01 / D-63-04: installable plugin with NO hooks/hooks.json renders NO hooks: line (legacy 4-kind output unchanged)` -- byte-stability of the legacy output (no `hooksConfigPath` -> no hooks line).
4. `SURF-01 / D-63-04: available plugin (not-installed) with hooks/hooks.json also renders the hooks: block` -- the available arm also surfaces the block (non-tool event UserPromptSubmit -> bare event, no parens).
5. `SURF-01 / Open Question 3: hooks/hooks.json deleted between resolve and info-render surfaces probe-classifier reason via narrowProbeError (POSIX)` -- chmod-000 fault injection routes through the existing `narrowProbeError` ladder.

## Verification

- `npm test -- tests/orchestrators/plugin/info.test.ts` -- 0 fail (added 5 tests)
- `npm run check` -- green (typecheck + lint + format:check + unit + integration; exit code 0)
- `grep -n "parseHooksConfig\|HookSummaryEntry\|projectHookSummaryEntries" extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- 15+ refs (helper + import + return-type field + projector + call-site)
- `grep -c "asyncRewake\|rewakeMessage\|rewakeSummary\|timeout:" extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- 0 (D-63-05: no inline handler-field rendering)
- `grep -c "narrowProbeError" extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- 15 (existing ladder reused unchanged)

## Decisions Made

- **Projection granularity is per-(event, group), not per-handler.** The renderer's expected byte form (per D-63-04: `event(matcher)` one line per matched scope) matches the parsed file's group cardinality, not the handler-list cardinality inside each group. A group declaring 3 handlers on `PreToolUse("Bash")` surfaces ONE `PreToolUse(Bash)` row, not three. The projector iterates `Object.entries(parsed)` -> `groups` and emits one entry per group.
- **Empty-string default for absent group matchers on tool events.** MATCH-01 treats absent / `""` / `"*"` as match-all; the discriminated `HookSummaryEntry` arm REQUIRES the field on tool events (compile-time). Defaulting to `""` at the projector keeps the discriminated arm valid without special-casing the renderer (which prints `event()` for the empty-string matcher -- the user-visible byte form for match-all is implicit at the renderer layer; D-63-04 did not specify a special token for empty matchers, and the test fixtures do not exercise this case directly).
- **Disk-read sigature mirrors the resolver's `readStandaloneHooks` call site.** Same `ifCtx` construction (`homedir()` + `process.cwd()` projectRoot fallback), same `skipIfMap: true` opt-out, same no-op `compileIf` sentinel. The resolver's pattern is the contract; the info-surface re-read inherits it verbatim to avoid drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan references `tests/commands/plugin/info.test.ts` but actual location is `tests/orchestrators/plugin/info.test.ts`**

- **Found during:** Task 2 (file location)
- **Issue:** Plan frontmatter `files_modified` and `<files>` block name `tests/commands/plugin/info.test.ts`. That path does not exist in the repository; the orchestrator-level info-test file lives at `tests/orchestrators/plugin/info.test.ts`.
- **Fix:** Added the new fixtures to `tests/orchestrators/plugin/info.test.ts`.
- **Files modified:** tests/orchestrators/plugin/info.test.ts
- **Verification:** `npm test -- tests/orchestrators/plugin/info.test.ts` lists all 5 new fixtures as passing.
- **Committed in:** 57535a6 (RED) + 2facdb5 (GREEN)

**2. [Rule 3 - Blocking] Plan's import-order assumption rejected by eslint import-x/order**

- **Found during:** GREEN-phase `pre-commit run` lint stage
- **Issue:** The plan instructs adding `parseHooksConfig from "../../domain/components/hooks.ts"` then `TOOL_EVENTS from "../../domain/components/hook-events.ts"`. `import-x/order` requires `hook-events.ts` to precede `hooks.ts` lexicographically.
- **Fix:** Reordered the two imports (hook-events first, then hooks).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- **Verification:** `pre-commit run --files extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- lint passes.
- **Committed in:** 2facdb5 (folded into GREEN commit)

**3. [Rule 3 - Blocking] Prettier reformatting of test file after initial Write**

- **Found during:** RED-phase `pre-commit run` format:check stage
- **Issue:** Multi-line `JSON.stringify` constructions in the new fixtures were reflowed to single-line by prettier.
- **Fix:** Re-ran `pre-commit run` which applied the prettier autofix.
- **Files modified:** tests/orchestrators/plugin/info.test.ts
- **Verification:** `pre-commit run --files tests/orchestrators/plugin/info.test.ts` -- format:check passes.
- **Committed in:** 57535a6 (RED commit; the reformat was applied before staging).

---

**Total deviations:** 3 auto-fixed (2 blocking path/lint, 1 follow-on formatting)
**Impact on plan:** No structural deviation -- the implementation matches the plan's described behavior byte-for-byte. The two blocking issues were path-resolution (test file location) and import-ordering (alphabetical eslint rule), neither of which affect the projected user-visible surface.

## Threat Flags

None -- no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond those covered by the plan's `<threat_model>` block.

## Known Stubs

None -- the implementation is complete. `info <plugin>` for an installable plugin with `hooks/hooks.json` now surfaces the multi-line `hooks:` block end-to-end.

## Issues Encountered

- None beyond the deviations above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Wave 3 user-visible surface complete. Plans 63-06 (docs/hooks.md plain-English documentation) and 63-07 (catalog-UAT byte-fixture refresh) consume this plan's outputs:

- 63-06 references the `info <plugin>` block as the canonical user-visible surface for hooks discoverability ("run `/claude:plugin info <plugin>` to see which events a plugin hooks into").
- 63-07's catalog-UAT row corpus picks up the new `hooks:` block bytes from the renderer's existing arm (no further renderer changes); the integration with the catalog gate is verified by the 5 fixtures added in this plan.

SURF-01 closes the v1.13 user-visible surface for hooks: install cascade (Plan 63-04) + info render (this plan) are the only two surfaces that emit the typed `HookSummary` model end-to-end.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- FOUND (modified)
- `tests/orchestrators/plugin/info.test.ts` -- FOUND (modified)
- Commit `57535a6` -- FOUND in git log
- Commit `2facdb5` -- FOUND in git log

---
*Phase: 63-lifecycle-cascade-user-facing-surface-docs*
*Completed: 2026-06-16*
