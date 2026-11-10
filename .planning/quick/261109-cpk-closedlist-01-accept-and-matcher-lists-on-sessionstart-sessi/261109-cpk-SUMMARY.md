---
quick_id: 261109-cpk
phase: quick-261109-cpk
plan: 01
subsystem: hooks
tags: [hooks, matchers, closed-set, CLOSEDLIST-01, D-BG-302]
status: complete
requirements: [CLOSEDLIST-01]
requires: ["261109-cpn"]
provides:
  - closedSetMatcherValues, the one closed-set matcher reader for SessionStart, SessionEnd, PreCompact, PostCompact, and StopFailure
affects:
  - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
key-files:
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/domain/components/hook-events.test.ts
    - test/domain/components/hooks/partition.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - features/hook/session.feature
    - features/hook/stop-failure.feature
    - docs/hooks-compatibility.md
decisions:
  - "CLOSEDLIST-01: SessionStart, SessionEnd, PreCompact, and PostCompact matchers are read as Claude Code reads them: a matcher of letters, digits, `_`, `-`, spaces, `,`, and `|` is a list split on `|` or `,`, each value trimmed, kept when one value is in the event's closed set; StopFailure keeps the narrow `|` shape (D-BG-302)"
metrics:
  completed: 2026-11-09
  node: v26.13.0
actuals:
  tokens: 8300
  tasks: 3
  commits: 3
plan_head_before: b88d99109d49b33d32f06ba22c341200e41d886b
plan_head_after: ae298e7b99d09cfee4b1453722e1754e45b66297
---

# Quick 261109-cpk: CLOSEDLIST-01 list matchers on the session and compaction events -- Summary

One reader, `closedSetMatcherValues(event, rawMatcher)` in `domain/components/hook-events.ts`, now reads every closed-set matcher as Claude Code 2.1.319 does. StopFailure gets the narrow `|` shape (D-BG-302). SessionStart, SessionEnd, PreCompact, and PostCompact get the wide `|`/`,` shape with trimmed values (CLOSEDLIST-01). The parse-time partition and the dispatch-time predicate both call it, and settle's StopFailure filter is now the shared predicate alone.

Note on `plan_head_before`: the base is `b88d9910`, confirmed with `git log -1` at start and resolved with `git rev-parse b88d9910`. The worktree's isolation guard refused the on-disk ledger write, so the commit count comes from `git rev-list --count b88d9910..ae298e7b` (3).

## Worktree

- Path: `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-ad8fed734cfe7fa96`
- Branch: `worktree-agent-ad8fed734cfe7fa96`
- Base: `b88d9910` (contains the merged 261109-cpn change)
- Precondition: `node_modules/.cache/optional-peers` was missing at start. `node scripts/install-test-peers.mjs` installed it (exit 0). `node_modules` is a real install, not a symlink.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | `674f0692` | feat(hooks): read session and compaction matchers as value lists |
| 2 | `ff34b96f` | test(hooks): pin list matchers on compaction and the closed-set drops |
| 3 | `ae298e7b` | docs(hooks): record list matchers on the closed-set events |

Every commit went through the hooks (`npm-check` ran `check:commit` on commits 1 and 2). No `--no-verify`, no amend, no `git add -A`.

## What changed

- `hook-events.ts`: the StopFailure-only reader and its regex constant are replaced by two private shapes (`/^[\w|]+$/` and `/^[\w|, -]+$/`) and the exported `closedSetMatcherValues`. It splits on `/[|,]/`, trims, and drops empty values. The `NON_TOOL_EVENT_FIELDS` StopFailure paragraph and the opening of the `NON_TOOL_EVENT_CLOSED_SETS` doc now describe lists. The vocabularies and tables are unchanged.
- `hooks/partition.ts`: the StopFailure-only condition and branch are gone. After the `no-matcher-support` check, one path keeps a group when one listed value is in `NON_TOOL_EVENT_CLOSED_SETS[event]`, and returns `closed-set` otherwise.
- `bridges/hooks/dispatch.ts`: `matcherFiresOnClosedSetValue(entry, value)` fires on `""`, `*`, or when `closedSetMatcherValues(entry.claudeEvent, raw)` includes `value`. Its signature is unchanged.
- `bridges/hooks/settle.ts`: the `runStopFailure` filter is `(entry) => matcherFiresOnClosedSetValue(entry, classifiedError)`. The old reader import is gone. The SFAIL-03 comment says the shared predicate reads the `|` list. cpn's lines are untouched.
- Unit rows: 20 reader rows (the ten StopFailure rows gained `event`, plus ten new ones), 17 partition rows in one loop with an `event` column, and 13 dispatch rows with `claudeEvent`.
- Scenarios: "A list matcher selects the SessionStart and SessionEnd runs of a new session", "A list matcher selects the PreCompact and PostCompact runs of a compaction", the Outline "Info on a plugin whose <event> matcher <matcher> lists no value Claude Code sends shows it partially available" (four rows), and the row `rate_limit, overloaded` in the StopFailure drop Outline.
- `docs/hooks-compatibility.md`: one Matcher syntax row after `PreCompact` / `PostCompact`, with the reinstall note. The D-CF5-08 paragraph already carries the same reinstall note, so it was not changed.

## Red proofs (observed locally, never committed)

Logs are in `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-behavioral-gaps/9d7180bb-0c10-4789-9fa7-2c2c30d0c974/scratchpad/cpk/`.

- **R0** (Task 1, before the fix): `npm run test:cucumber:profile -- --profile adapter --name 'A list matcher selects the SessionStart and SessionEnd runs' features/hook/session.feature`. Exit 1. 1 scenario failed, 12 steps (8 passed, 3 skipped, 1 failed). It failed at `Given the user has run "/claude:plugin install demo@fixtures --scope project"` with `status: 'partially-available'`, reasons `unsupported hooks`, hint `partial-install`. Log: `R0.log`.
- **Red units** (Task 1, before the fix): `node --test` on each module. `hook-events.test.ts` failed to load (`does not provide an export named 'closedSetMatcherValues'`). `partition.test.ts` failed exactly the four kept list rows (SessionStart `reload, clear`, SessionEnd `quit|clear`, PreCompact `auto, manual`, PostCompact ` manual `). `dispatch.test.ts` failed exactly the five rows that should fire on a list (`reload, clear`, `quit|clear`, `auto, manual`, ` manual `, StopFailure `rate_limit|overloaded`).
- **R1** (Task 2, temporary break: `matcherFiresOnClosedSetValue` compared the whole raw matcher with the value again, and the partition kept any matcher with a non-empty list): `npm run test:cucumber:profile -- --profile adapter --name 'A list matcher selects' --name 'lists no value Claude Code sends' features/hook/session.feature`. Exit 1. 6 scenarios (6 failed), 63 steps (57 passed, 6 failed). The four drop rows failed at `Then the result has these fields:` (`plugin status` was `available`). Both list scenarios failed at `Then the hooks record these runs:`. Log: `R1.log`. Undone with `git checkout --` on both files. `git status --short -- extensions` was empty afterwards.
- **R2** (Task 2, temporary break: StopFailure got the wide shape): `npm run test:cucumber:profile -- --profile adapter --name 'matches no type Claude Code sends' features/hook/stop-failure.feature`. Exit 1. 4 scenarios (3 passed, 1 failed). Only the `rate_limit, overloaded` row failed, at `Then the result has these fields:`. Log: `R2.log`. Undone with `git checkout --`. `git status --short -- extensions` was empty afterwards.

## Green runs

- Task 1: `npm run test:coverage:direct -- <the four sources>` exit 0 (100% direct coverage for the four pairs). `npm run typecheck` exit 0. `npm run check:features` exit 0. `npm run test:integration` exit 0. `npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/hook/stop-failure.feature` exit 0, with 44 scenarios passing, the D-BG-302 StopFailure list scenario included. The Task 1 grep gates all passed.
- Task 2: the new scenarios alone exit 0 (6 scenarios passed). The Task 2 grep gates and `npm run check:features` passed. `npm run test:cucumber:profile -- --profile adapter features/hook` exit 0, 167 scenarios passed, with no flake.
- Task 3: `SKIP=npm-check pre-commit run --files docs/hooks-compatibility.md` passed on the second pass (mdformat realigned the new row on the first pass). `grep -cF CLOSEDLIST-01 docs/hooks-compatibility.md` = 1.
- Final tree (`ae298e7b`, Node v26.13.0): `npm run check` **exit 0**. Adapter cucumber run: 1791 scenarios passed. Builtin run: 153 scenarios passed. Merged `coverage/direct.lcov` has 352 records. Log: `npm-check.log`. After the run, `git status --short` was clean.

## Deviations from Plan

- **Coordinator amendments (binding):** Task 3 changed only `docs/hooks-compatibility.md`. The `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, and `.planning/DUBIOUS-CHOICES.md` text is in `## Parent lines` below. The CHANGELOG text puts the existing StopFailure line and the four events into one sub-bullet, as the user answered.
- **SUMMARY location:** the SUMMARY is written to the scratchpad and not committed, as the coordinator directed, instead of to `.planning/quick/...`.
- **[Rule 3 - Blocking] Optional peers missing:** `node_modules/.cache/optional-peers` did not exist. `node scripts/install-test-peers.mjs` installed it. The cucumber and integration scripts run this script themselves.
- No product deviation. The design was followed item by item.

## Upstream evidence

- Question: how does Claude Code read a `SessionStart`, `SessionEnd`, `PreCompact`, or `PostCompact` matcher that holds `|`, `,`, spaces, empty alternatives, or a mix of known and unknown values?
- Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` (`claude --version`: `2.1.319 (Claude Code)`), grepped by the planner on 2026-11-09 (main bundle, byte offset about 295,650,700).
  - `Plt(e, n)`: when the event is in the set `gae`, which holds SessionStart, SessionEnd, PreCompact, PostCompact, the tool events, and others, but not StopFailure, FileChanged, UserPromptSubmit, or Stop, a matcher that matches `/^[a-zA-Z0-9_|, -]+$/` is split on `/[|,]/`. Otherwise a matcher that matches `/^[a-zA-Z0-9_|]+$/` is split on `|`. Each part is trimmed and empty parts are dropped (`.map((y)=>y.trim()).filter(Boolean)`). Any other matcher gives `undefined`.
  - `T6(value, matcher, wide, ...)`: `""` or `"*"` always fires. A list fires when it includes the value (exact, case-sensitive). Any other matcher is a JavaScript `RegExp` tested against the value, unanchored, and an invalid pattern logs `Invalid regex pattern in hook matcher` and never fires.
  - `Xl` only renames legacy tool names (`Task` to `Agent`, and so on), so it leaves these events' values unchanged. `$8t` reads `source` for SessionStart, `reason` for SessionEnd, and `trigger` for PreCompact and PostCompact.
- Docs: https://code.claude.com/docs/en/hooks, "Matcher patterns" (read 2026-11-09). `"*"`, `""`, or omitted matches all. "Only letters, digits, `_`, `-`, spaces, `,`, and `|`" is "Exact string, or list of exact strings separated by `|` or `,` with optional surrounding whitespace". Any other character makes an unanchored JavaScript regular expression. "`FileChanged` and `StopFailure` use a narrower exact-match set of letters, digits, `_`, and `|` only. ... Every other event with matcher support in the table that follows accepts `|` or `,`."
- Confidence: high. The binary and the docs agree.
- Pi constraints: none. The bridge already maps Pi's values to Claude's values (D-CF5-01, D-CF5-02, D-CF5-04).
- Divergences kept, each licensed by a recorded decision: regex-path matchers stay unsupported (MATCH-V2-01). A list whose values are all outside the event's closed set drops the group as `closed-set` (D-58-06), where Claude Code admits it and never fires it.

## Questionable choices

1. **One reader for five events, with the shape picked by the event.** Alternative: two readers. Not taken, because the batch asked for one shared reader, and two near-identical split-and-trim readers would form a fallow clone group. Severity: low.
2. **The reader takes `BucketAEvent`.** Neither caller casts, and every event except StopFailure gets the wide shape. This matches Claude Code for every event that reaches the reader. Tool events never reach it, because they go through `parseMatcher`. Severity: low.
3. **Dispatch splits the raw matcher at each event** instead of storing the list on `RoutingEntry`. A stored list would change the router and every fixture that lists the entry's fields. The split is linear on a short string. Severity: low.
4. **A list with no known value still drops as `closed-set` (D-58-06).** Claude Code installs the plugin and never runs the hook. Severity: low (recorded divergence).
5. **Spaces around a single value (` clear `) are now accepted**, because Claude Code trims them. Only unit rows pin this (partition ` manual `, dispatch ` manual `), because cucumber trims table cells. Severity: low.
6. **No positive `info` Outline for the four events.** The install `Given` of each list scenario already fails without the fix (R0), and install without `--partial` succeeds only for an available plugin. Severity: low.
7. **Task 1 touches eight files**, more than the five-file guideline. Each source edit commits with its paired test, and the tracer needs the scenario and both readers of the list. Severity: low.
8. **The StopFailure drop Outline gains one row** (`rate_limit, overloaded`) to pin the narrow grammar under the shared reader (R2 proves it). Severity: low.
9. **Reinstall note on the CHANGELOG line.** The plan asked whether the StopFailure list line should get the same note. The user answered: fold both into one sub-bullet with one reinstall note. The text is in `## Parent lines`. Severity: resolved.
10. **The partition keeps the existing `as keyof typeof NON_TOOL_EVENT_CLOSED_SETS` cast.** After the `null` check, TypeScript does not narrow `event` away from UserPromptSubmit and Stop. The cast was already there before this change. A typed lookup would need a new helper. Severity: low.
11. **The wide shape uses `\w`** (ASCII letters, digits, `_`, with no `u` flag), the same as upstream's `[a-zA-Z0-9_]`. Severity: none.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-cpk-01 is mitigated by exact, case-sensitive comparison of trimmed values. The dispatch rows and the `*-other` hooks pin it. T-cpk-02: each shape is one anchored character class with one `+`, and no regex is built from plugin text. T-cpk-03: the drop Outline is pinned, and R1 proves it. T-cpk-04: StopFailure's narrow shape is pinned, and R2 proves it.

## Parent lines

### CHANGELOG.md

Under `## [Unreleased]`, replace the existing sub-bullet

```
  - `StopFailure` hook matchers now accept Claude Code's newer error types and `|` lists of error types.
```

with this one sub-bullet (38 words):

```
  - `StopFailure` hook matchers now accept Claude Code's newer error types and `|` lists of error types, and `SessionStart`, `SessionEnd`, `PreCompact`, and `PostCompact` matchers now accept `|` and `,` lists. Reinstall a plugin installed with `--partial` to run these hooks.
```

The plan's gate holds: exactly one Unreleased `  - ` line names both `SessionStart` and `PreCompact`. Check the line against the 25-words-per-sentence rule in `.agents/skills/changelog/rules/entries.md`. The first sentence is 31 words. If the rule must hold strictly, use this split instead:

```
  - `StopFailure` hook matchers now accept Claude Code's newer error types and `|` lists, and `SessionStart`, `SessionEnd`, `PreCompact`, and `PostCompact` matchers accept `|` and `,` lists. Reinstall a plugin installed with `--partial` to run these hooks.
```

(first sentence 25 words).

### .planning/BACKLOG.md

Replace the heading

```
## CLOSEDLIST-01: `|` and `,` lists in the SessionStart, SessionEnd, PreCompact, and PostCompact matchers
```

with

```
## ~~CLOSEDLIST-01: `|` and `,` lists in the SessionStart, SessionEnd, PreCompact, and PostCompact matchers~~ -- CLOSED
```

and insert this paragraph, followed by a blank line, right under it, before the existing "Noted 2026-11-08" paragraph (keep that paragraph as it is):

```
**CLOSED 2026-11-09** by quick task 261109-cpk (fixed). A SessionStart, SessionEnd, PreCompact, or PostCompact matcher made only of letters, digits, `_`, `-`, spaces, `,`, and `|` is now a list of exact values separated by `|` or `,`, each value trimmed, as in Claude Code. The group is kept when one value is in the event's set, and it runs on any listed value. One reader, `closedSetMatcherValues` in `hook-events.ts`, serves these four events and StopFailure, whose narrow `|` grammar stays as D-BG-302 states. The scenarios "A list matcher selects the SessionStart and SessionEnd runs of a new session" and "A list matcher selects the PreCompact and PostCompact runs of a compaction", the Outline "Info on a plugin whose <event> matcher <matcher> lists no value Claude Code sends shows it partially available", and the `rate_limit, overloaded` row of the StopFailure drop Outline pin it.
```

### .planning/PROJECT.md

Replace the whole D-BG-302 row of Key Decisions (the line that starts `| **D-BG-302 (behavioral-gaps, Phase 3`) with:

```
| **D-BG-302 (behavioral-gaps, Phase 3, settled with the recommended answer, extended to SessionStart, SessionEnd, PreCompact, and PostCompact by CLOSEDLIST-01 at the user's request on 2026-11-09, see DUBIOUS-CHOICES.md P3-DC-02): a closed-set matcher is a list of exact values, as Claude Code reads it**. A StopFailure matcher made only of letters, digits, `_`, and `\|` is split on `\|`. A SessionStart, SessionEnd, PreCompact, or PostCompact matcher made only of letters, digits, `_`, `-`, spaces, `,`, and `\|` is split on `\|` or `,`, and each value is trimmed. Empty values are dropped. The group is admitted when at least one value is in the event's closed set, and it fires when the event's Claude value equals any listed value, exactly and case-sensitively. Any other non-empty matcher keeps the `closed-set` drop (MATCH-V2-01), and `""` and `*` stay match-all. One shared path serves all five events: `closedSetMatcherValues` in `hook-events.ts`, which `nonToolMatcherCondition` (`hooks/partition.ts`) and `matcherFiresOnClosedSetValue` (`dispatch.ts`) call, and which `runStopFailure` (`settle.ts`) reaches through the shared predicate (P3-DC-06). | Claude Code 2.1.319's matcher parser and its docs read the narrow `\|` set for `StopFailure` and `FileChanged`, and `\|` or `,` lists for every other matcher event; no decision ID licensed a whole-string comparison. | ✓ Good |
```

Gates: the row names `closedSetMatcherValues` (1), names no `stopFailureMatcherTypes` (0), and has no `-- Revisit` (0).

### .planning/DUBIOUS-CHOICES.md

- Under "Decisions waiting on you", remove the bullet:

  ```
  - P3-DC-02: `|` and `,` lists on the SessionStart, SessionEnd, PreCompact,
    and PostCompact matchers, as for StopFailure (CLOSEDLIST-01).
  ```

- In the Phase 3 entry, change the P3-DC-02 heading `(High, fix before the PR: the user asked for `|` and `,` lists on the four other closed-set events (CLOSEDLIST-01))` so it says that P3-DC-02 is fixed. For example: `**P3-DC-02 (High, fixed by quick task 261109-cpk: `|` and `,` lists on the four other closed-set events, CLOSEDLIST-01).**` Keep the rest of the entry.

### STATE.md / ROADMAP.md

None. The quick workflow records the task.

## Self-Check: PASSED

- Commits present: `674f0692`, `ff34b96f`, `ae298e7b` (`git log --oneline -4`).
- Files exist and gates hold: `export function closedSetMatcherValues(` in hook-events.ts (1). `closedSetMatcherValues(` appears in partition.ts and dispatch.ts. No `stopFailureMatcherTypes` or `stopFailureMatcherCondition` in `extensions/` or `test/`. Three new scenario titles and the `rate_limit, overloaded` row are present. `CLOSEDLIST-01` appears in the docs.
- `git status --short` is clean. No `node_modules` symlink is left.
