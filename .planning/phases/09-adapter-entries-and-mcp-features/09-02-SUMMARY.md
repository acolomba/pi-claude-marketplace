---
phase: 09-adapter-entries-and-mcp-features
plan: "02"
subsystem: bridges/mcp marker, cucumber harness (MCP)
status: complete
tags: [mcp, pi-mcp-adapter, marker, defaults, cucumber, fixture]
requires: []
provides:
  - the exported `MarkerDefaultValue` type (number | string | boolean) for a recorded default
  - a marker `defaultFields` read that accepts JSON scalars and rejects any other value whole
  - the release 0.23.0 adapter entry writer `writeRelease0230McpAdapterEntry` and its Given
affects: [09-03]
tech-stack:
  added: []
  patterns: [all-or-nothing scalar record read behind Object.hasOwn]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - test/bridges/mcp/marker.test.ts
    - features/lib/mcp-server-files.ts
    - features/step_definitions/mcp-server/lifecycle.steps.ts
    - features/mcp-server/lifecycle.feature
decisions:
  - "The marker's recorded default type is `MarkerDefaultValue = number | string | boolean`; `defaultFields` reads only as an own plain object whose every value is one of those, and any other value drops the whole member, so each entry value reads as the user's (D-PG9-03)."
  - "The earlier-release fixture models release 0.23.0 exactly: no `requestTimeoutMs`, `lifecycle`, or `openUi` on the entry and no `defaultFields` in its marker; the step reads `the mcp-adapter.json file of the {word} scope holds the entry {string} as release 0.23.0 wrote it` (D-PG9-04)."
metrics:
  duration: about 25 minutes
  completed: 2026-11-14
requirements: [PG-MCP-06, PG-SEC-03]
actuals:
  tokens: 3300
  tasks: 2
  commits: 2
plan_head_before: 975cead07aea1b63b177f7264fb4dcd8d3420da9
plan_head_after: 8424da36983d20ef8f079a6bceacb5525ee0b408
---

# Phase 9 Plan 02: Scalar Marker Defaults and the Release 0.23.0 Entry Summary

The MC-5 marker now records a default that is a number, a string, or a boolean
(`MarkerDefaultValue`), still reads a numbers-only record, and drops a member with any other
value whole. A scenario can start from an adapter entry exactly as release 0.23.0 wrote it,
and the D-PG1-12 reinstall scenario uses that fixture with its expected text unchanged. No
product output changes.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | `bd2643fd` | feat(mcp): record string and boolean defaults in the entry marker |
| 2 | `8424da36` | test(mcp): model an adapter entry as release 0.23.0 wrote it |

Both commits passed the pre-commit hook, `npm-check` (`check:commit`) included.

## Names

- Type: `MarkerDefaultValue` in `extensions/pi-claude-marketplace/bridges/mcp/marker.ts`, used by
  `ClaudeMarketplaceMarker.defaultFields`, the `buildMarker` part, `defaultFieldsOf`, and the
  `defaults` parameter of `isRecordedDefault` in `adapter-entry.ts` (inline `type` import).
  The private guards are `isDefaultValue` and `isDefaultRecord`, replacing `isNumberRecord`.
- Fixture writer: `writeRelease0230McpAdapterEntry` (was
  `writeMcpAdapterEntryWithoutRequestTimeout`) in `features/lib/mcp-server-files.ts`.
- Step: `the mcp-adapter.json file of the {word} scope holds the entry {string} as release 0.23.0 wrote it`
  (was `... holds the entry {string} with no request timeout, as an earlier release wrote it`).

## Task 1 red run (TDD RED)

Owner cases added first, string-member case moved from the rejected table to an accepted row,
on the unchanged `marker.ts`:

```
node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/mcp/marker.test.ts
  ✖ D-PG9-03: reads a string default of a well-formed marker
  ✖ D-PG9-03: reads a boolean default of a well-formed marker
  ✖ D-PG9-03: reads number, string, and boolean defaults together of a well-formed marker
  ✖ D-PG9-03: reads a string where a number would be of a well-formed marker
ℹ tests 73  ℹ pass 69  ℹ fail 4   (exit 1)
```

The new `buildMarker` string-and-boolean case passed at run time on the old code (the builder
only spreads its part) and failed the old types only; the four rejected-value rows (null,
object, array, an own `__proto__` key holding an object) passed on both, as the plan expects.

## Verification (green)

| Check | Result |
|-------|--------|
| `node --import .../isolated-pi-home.ts --test test/bridges/mcp/marker.test.ts test/bridges/mcp/adapter-entry.test.ts` | exit 0, 138 tests, 138 pass, 0 fail, 0 cancelled |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/marker.ts` | exit 0 (100%) |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts` | exit 0 (100%) |
| `npx tsc --noEmit -p .` | exit 0 |
| `npx eslint --max-warnings 0` on the six changed files | exit 0 |
| `npx fallow dupes --fail-on-issues`, `npx fallow health --fail-on-issues` | exit 0, exit 0 |
| `npx cucumber-js --profile adapter --name "An entry that an earlier release wrote gets the default timeout at the plugin's next reinstall" features/mcp-server/lifecycle.feature` | exit 0, 1 scenario (1 passed), 12 steps |
| `npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature` | exit 0, 13 scenarios (13 passed), 191 steps |
| `npm run check:features` | exit 0, no "Feature gate failed" |

Acceptance greps: `Record<string, number>` in `marker.ts` 0; `D-PG9-03` in `marker.ts` 4, in
`marker.test.ts` 3; `adapter-entry.ts` numstat `2 1`; `lifecycle.feature` numstat `1 1`; the
old step text 0; `0.23.0` in the steps file 2; the old writer name 0. `npm run check` was not
run here: the orchestrator runs it at the wave gate.

Task 2 is fixture-only and changes no product behavior, so it has no red run: the D-PG1-12
scenario keeps its expected text on the unchanged product because an installed entry holds no
`lifecycle` or `openUi` yet. Plan 09-03 adds the new defaults to that expected text, which is
where the fixture's widened removal becomes load-bearing.

## Deviations from Plan

None - plan executed exactly as written. One addition inside the plan's scope: a rejected row
for an own `__proto__` key holding an object (built with `JSON.parse`), for the prototype
pollution row of T-09-05.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
T-09-05 is mitigated as planned (own plain object of JSON scalars only, whole-member reject,
strict equality in `isRecordedDefault`, `Object.hasOwn` reads, owner rows for null, object,
array, inherited, and `__proto__` members). T-09-06 is mitigated by the writer's doc comment
citing the `[0.23.0]` CHANGELOG section and the step naming the release.

## Parent-owned lines requested

- `.planning/codebase/CONVENTIONS.md` or `ARCHITECTURE.md` need no change.
- `09-VALIDATION.md`: mark the D-PG9-03 marker owner cases and the release 0.23.0 fixture
  (Pitfall 6, Pitfall 8) as done, citing `bd2643fd` and `8424da36`.
- `STATE.md` / `ROADMAP.md`: plan 09-02 complete (2 tasks, 2 commits); decision lines are the
  two `decisions` entries in this frontmatter.
- `REQUIREMENTS.md`: PG-MCP-06 and PG-SEC-03 stay open; this plan only prepares the marker
  for the defaults plan 09-03 writes.

## Self-Check: PASSED

- FOUND: every modified file listed in `key-files`.
- FOUND: `bd2643fd` and `8424da36` are ancestors of HEAD; `git rev-list --count 975cead0..HEAD` is 2.
