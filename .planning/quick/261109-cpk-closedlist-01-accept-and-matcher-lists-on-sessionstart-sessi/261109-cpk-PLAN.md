---
quick_id: 261109-cpk
description: "CLOSEDLIST-01: accept | and , matcher lists on SessionStart, SessionEnd, PreCompact, and PostCompact hooks"
date: 2026-11-09
mode: quick-batch
phase: quick-261109-cpk
plan: 01
type: execute
wave: 2
depends_on: ["261109-cpn"]
files_modified:
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - test/domain/components/hook-events.test.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
  - test/domain/components/hooks/partition.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - test/bridges/hooks/dispatch.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - features/hook/session.feature
  - features/hook/stop-failure.feature
  - docs/hooks-compatibility.md
autonomous: true
requirements: [CLOSEDLIST-01]

must_haves:
  truths:
    - "A plugin whose SessionStart, SessionEnd, PreCompact, or PostCompact hook matcher is a `|` or `,` list with at least one value of the event's set (`reload, clear`, `quit|clear`, `auto, manual`, `overflow|manual`) installs with no `--partial`"
    - "Such a hook runs when the event's Claude value (the mapped `source`, `reason`, or `trigger`) equals one of its listed values after trimming, exactly and case-sensitively; a kept list that names only other values does not run"
    - "A list on those events with no value of the event's set (`reload|quit`, `Clear, Resume`, `threshold, overflow`, `Manual|Auto`) still shows the plugin `partially-available` with `unsupported hooks` (D-58-06), and a regex-shaped matcher still drops (MATCH-V2-01)"
    - "StopFailure keeps Claude Code's narrow `|` grammar (D-BG-302): `rate_limit, overloaded` still drops, and the existing StopFailure `|`-list scenario still runs its hook"
    - "One reader, `closedSetMatcherValues` in `domain/components/hook-events.ts`, serves the five closed-set events at parse time (`nonToolMatcherCondition`) and at dispatch time (`matcherFiresOnClosedSetValue`, which `runStopFailure` uses as is)"
    - "The docs matcher-syntax table, the Unreleased CHANGELOG entry, BACKLOG CLOSEDLIST-01 (closed), and the D-BG-302 row of PROJECT.md state the rule"
  artifacts:
    - path: extensions/pi-claude-marketplace/domain/components/hook-events.ts
      provides: "closedSetMatcherValues, the one list reader: the narrow StopFailure shape and the wide shape of the other events"
      contains: "export function closedSetMatcherValues("
    - path: extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
      provides: "one closed-set admission path for the five closed-set events"
      contains: "closedSetMatcherValues("
    - path: extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
      provides: "matcherFiresOnClosedSetValue fires on a listed value"
      contains: "closedSetMatcherValues("
    - path: features/hook/session.feature
      provides: "the two list scenarios and the drop Outline over the four events"
      contains: "A list matcher selects the SessionStart and SessionEnd runs of a new session"
    - path: features/hook/stop-failure.feature
      provides: "the narrow-grammar row of the StopFailure drop Outline"
      contains: "rate_limit, overloaded"
    - path: docs/hooks-compatibility.md
      provides: "the matcher-syntax row for the lists of the four events"
      contains: "CLOSEDLIST-01"
    - path: .planning/BACKLOG.md
      provides: "CLOSEDLIST-01 in the closed form"
      contains: "## ~~CLOSEDLIST-01:"
  key_links:
    - from: "nonToolMatcherCondition (domain/components/hooks/partition.ts)"
      to: "closedSetMatcherValues (domain/components/hook-events.ts)"
      via: "parse-time admission: a group is kept when one listed value is in NON_TOOL_EVENT_CLOSED_SETS for its event"
      pattern: "closedSetMatcherValues\\("
    - from: "matcherFiresOnClosedSetValue (bridges/hooks/dispatch.ts)"
      to: "closedSetMatcherValues"
      via: "entry.claudeEvent picks the shape and entry.rawMatcher is the matcher"
      pattern: "closedSetMatcherValues\\(entry\\.claudeEvent"
    - from: "entryFires (bridges/hooks/dispatch.ts)"
      to: "matcherFiresOnClosedSetValue"
      via: "the SessionStart, SessionEnd, PreCompact, and PostCompact composite dispatch"
      pattern: "matcherFiresOnClosedSetValue\\(entry, value\\)"
    - from: "runStopFailure (bridges/hooks/settle.ts)"
      to: "matcherFiresOnClosedSetValue"
      via: "the StopFailure filter is the shared predicate alone"
      pattern: "matcherFiresOnClosedSetValue\\(entry, classifiedError\\)"
---

<objective>
CLOSEDLIST-01: Claude Code reads a `SessionStart`, `SessionEnd`, `PreCompact`, or `PostCompact` matcher made only of letters, digits, `_`, `-`, spaces, `,`, and `|` as a list of exact values separated by `|` or `,`, each value trimmed. The bridge compares the whole matcher string with the event's closed set, so `startup|resume` or `auto, manual` drops as `closed-set`, and the plugin installs only with `--partial`. StopFailure already reads its own narrow `|` list (D-BG-302) through a StopFailure-only reader. The user asked on 2026-11-09 (DUBIOUS-CHOICES P3-DC-02) for the four events to read lists as StopFailure does: a list is admitted when at least one value is in the event's vocabulary, and the change lives in the shared `nonToolMatcherCondition` / `matcherFiresOnClosedSetValue` path.

The fix generalizes the StopFailure reader into one reader for all five closed-set events. The event picks Claude Code's shape: the narrow `|` shape for StopFailure and the wide `|`/`,` shape for the other four. The parse-time partition and the dispatch-time predicate both call it, and settle's StopFailure filter becomes the shared predicate alone.

Purpose: a plugin written for Claude Code with a list matcher on these events installs fully and its hooks run on the listed values, as in Claude Code.

Output:
- Task 1 (tracer): the shared reader, the single closed-set path in the partition, the list-aware dispatch predicate, settle's simplified filter, their unit rows, and the new-session list scenario, red before the fix and green after.
- Task 2: the compaction list scenario, the drop Outline over the four events, one narrow-grammar row in the StopFailure drop Outline, and the red proofs by temporary breaks.
- Task 3: the docs row, the CHANGELOG sub-bullet, CLOSEDLIST-01 closed in BACKLOG, and the D-BG-302 row of PROJECT.md extended.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@extensions/pi-claude-marketplace/domain/components/hook-events.ts
@extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
@extensions/pi-claude-marketplace/bridges/hooks/settle.ts
@features/hook/session.feature
@features/hook/stop-failure.feature
@.planning/milestones/behavioral-gaps-phases/03-stopfailure-hooks/03-02-SUMMARY.md

## Upstream evidence (claude-code-compat-research)

- Question: how does Claude Code read a `SessionStart`, `SessionEnd`, `PreCompact`, or `PostCompact` matcher that holds `|`, `,`, spaces, empty alternatives, or a mix of known and unknown values?
- Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` (`claude --version`: `2.1.319 (Claude Code)`), grepped by the planner on 2026-11-09 (main bundle, byte offset about 295,650,700).
  - `Plt(e, n)`: when the event is in the set `gae`, which holds SessionStart, SessionEnd, PreCompact, PostCompact, the tool events, and others, but not StopFailure, FileChanged, UserPromptSubmit, or Stop, a matcher that matches `/^[a-zA-Z0-9_|, -]+$/` is split on `/[|,]/`. Otherwise a matcher that matches `/^[a-zA-Z0-9_|]+$/` is split on `|`. Each part is trimmed and empty parts are dropped (`.map((y)=>y.trim()).filter(Boolean)`). Any other matcher gives `undefined`.
  - `T6(value, matcher, wide, ...)`: `""` or `"*"` always fires. A list fires when it includes the value (exact, case-sensitive). Any other matcher is a JavaScript `RegExp` tested against the value, unanchored, and an invalid pattern logs `Invalid regex pattern in hook matcher` and never fires.
  - `Xl` only renames legacy tool names (`Task` to `Agent`, and so on), so it leaves these events' values unchanged. `$8t` reads `source` for SessionStart, `reason` for SessionEnd, and `trigger` for PreCompact and PostCompact.
- Docs: https://code.claude.com/docs/en/hooks, "Matcher patterns" (read 2026-11-09). `"*"`, `""`, or omitted matches all. "Only letters, digits, `_`, `-`, spaces, `,`, and `|`" is "Exact string, or list of exact strings separated by `|` or `,` with optional surrounding whitespace". Any other character makes an unanchored JavaScript regular expression. "`FileChanged` and `StopFailure` use a narrower exact-match set of letters, digits, `_`, and `|` only. ... Every other event with matcher support in the table that follows accepts `|` or `,`."
- Confidence: high. The binary and the docs agree.
- Pi constraints: none. The bridge already maps Pi's values to Claude's values (D-CF5-01, D-CF5-02, D-CF5-04).
- Divergences kept, each licensed by a recorded decision: regex-path matchers stay unsupported (MATCH-V2-01). A list whose values are all outside the event's closed set drops the group as `closed-set` (D-58-06), where Claude Code admits it and never fires it.

## Planner's probe at BASE

BASE is `9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c` (Node v26.13.0). The planner ran a scratch feature outside the repository under the adapter profile. The executor does not need it.

- Nine `info` rows passed with the expectations Task 2 uses: SessionStart `reload|quit`, SessionEnd `Clear, Resume`, PreCompact `threshold, overflow`, PostCompact `Manual|Auto`, StopFailure `rate_limit, overloaded`, and the four lists that hold a known value, SessionStart `reload, clear`, SessionEnd `quit|clear`, PreCompact `auto, manual`, and PostCompact `overflow|manual`. Each shows `plugin status` `partially-available`, `plugin reasons` `unsupported hooks`, and `plugin components hooks` `[{"kind":"lenient","event":"<event>","supported":true}]`. The last four rows show the gap: after the fix they show `available`.
- A scenario with Task 1's four hooks failed at `Given the user has run "/claude:plugin install demo@fixtures --scope project"`. The result had `severity` `error` and the row `demo@fixtures` `partially-available`, reasons `unsupported hooks`, hint `partial-install`.
- `npm run check:features` and the four owner unit modules (hook-events, partition, dispatch, settle) pass at BASE.

## Interfaces at BASE

- `domain/components/hook-events.ts`: `const STOP_FAILURE_LIST_MATCHER = /^[\w|]+$/;` (line 234) and `export function stopFailureMatcherTypes(rawMatcher: string): readonly string[]` (lines 236-250). It returns `[]` for a matcher outside the shape, else `rawMatcher.split("|")` without empty parts. Importers: `domain/components/hooks/partition.ts`, `bridges/hooks/settle.ts`, `test/domain/components/hook-events.test.ts`. `NON_TOOL_EVENT_CLOSED_SETS` (line 324) is keyed by SessionStart, SessionEnd, PreCompact, PostCompact, and StopFailure. `BucketAEvent` is the admitted event union.
- `domain/components/hooks/partition.ts`: `function stopFailureMatcherCondition(rawMatcher: string): MatcherCondition | null` (lines 48-54), and `function nonToolMatcherCondition(event: Exclude<BucketAEvent, ToolEvent>, rawMatcher: string): MatcherCondition | null` (lines 56-70). Its StopFailure branch comes first, then the `NON_TOOL_EVENT_FIELDS[event] === null` check (`no-matcher-support`), then a whole-string `NON_TOOL_EVENT_CLOSED_SETS[event].has(rawMatcher)`. `matcherCondition` (line 72) handles `""` and `*` before it.
- `bridges/hooks/dispatch.ts`: `export function matcherFiresOnClosedSetValue(entry: RoutingEntry, value: string): boolean` (lines 168-180), today `raw === "" || raw === "*" || raw === value`. Callers: `entryFires` (about line 1083, the composite path for SessionStart, SessionEnd, PreCompact, and PostCompact, fed by `matchValue`) and `runStopFailure` in `settle.ts`. `test/bridges/hooks/dispatch.test.ts` imports it (`describe("matcherFiresOnClosedSetValue")`, about line 505, rows built with `createRoutingEntry({ pluginId, claudeEvent, rawMatcher, declarationIndex })`).
- `bridges/hooks/settle.ts`: `runStopFailure`'s filter (the `collectBucketOutcomes` call at lines 421-431) is `matcherFiresOnClosedSetValue(entry, classifiedError) || stopFailureMatcherTypes(entry.rawMatcher).includes(classifiedError)`. It imports `{ collectBucketOutcomes, matcherFiresOnClosedSetValue }` from `./dispatch.ts` and is that export's only production importer.
- `bridges/hooks/routing-state.ts`: `RoutingEntry.claudeEvent: BucketAEvent` and `RoutingEntry.rawMatcher: string` (the matcher as declared). Install stages the partition's supported subset of `hooks.json` (`install-outcome.ts`, hooks phase), and dispatch reads `rawMatcher` at each event.
- `test/bridges/hooks/settle.test.ts`: `failureEntry(pluginId, rawMatcher)` builds entries with `claudeEvent: "StopFailure"`. Its D-BG-302 case "an error ending reaches the failure observers whose matcher lists its type" keeps passing through the shared predicate.

## Design (decided by the planner)

1. **One reader.** `closedSetMatcherValues(event: BucketAEvent, rawMatcher: string): readonly string[]` in `domain/components/hook-events.ts` replaces the StopFailure-only reader. StopFailure takes the narrow shape `/^[\w|]+$/` (D-BG-302), and every other event takes the wide shape `/^[\w|, -]+$/` (CLOSEDLIST-01). A matcher outside its shape lists nothing. Otherwise the reader splits on `/[|,]/`, trims each value, and drops empty values. Because the narrow shape admits no `,` and no space, one split-and-trim serves both shapes, so the event changes only the shape test. The parameter is `BucketAEvent` because that is what `RoutingEntry.claudeEvent` carries, so neither caller needs a cast. The callers keep handling `""` and `*` as match-all.
2. **Parse time.** `nonToolMatcherCondition` has one closed-set path for the five events. After the no-matcher-support check, it keeps the group when one value from `closedSetMatcherValues(event, rawMatcher)` is in `NON_TOOL_EVENT_CLOSED_SETS` for that event, and returns `"closed-set"` otherwise. The StopFailure-only condition function and the StopFailure branch go. StopFailure's field is `error`, not `null`, so moving it behind the null check changes nothing.
3. **Dispatch time.** `matcherFiresOnClosedSetValue(entry, value)` keeps its signature. It fires on `""`, on `*`, or when the reader's values for `entry.claudeEvent` and `entry.rawMatcher` include `value`. Every vocabulary value matches both shapes, so a single-value matcher behaves as before.
4. **Settle.** `runStopFailure`'s filter is the shared predicate alone. Settle keeps importing `matcherFiresOnClosedSetValue`, because it is that export's only production importer and fallow's production dead-code run fails without it (P3-DC-06).
5. **No new `RoutingEntry` field.** Dispatch splits the raw matcher at each event, as settle has done for StopFailure since D-BG-302. The router, `RoutingEntry`, and the test fixtures that list its fields do not change.
6. **Scenarios.** In `features/hook/session.feature`: "A list matcher selects the SessionStart and SessionEnd runs of a new session" (Task 1), "A list matcher selects the PreCompact and PostCompact runs of a compaction" (Task 2), and the Outline "Info on a plugin whose <event> matcher <matcher> lists no value Claude Code sends shows it partially available" (Task 2). In `features/hook/stop-failure.feature`: one Examples row, `rate_limit, overloaded`, in the existing Outline "Info on a plugin whose StopFailure matcher <matcher> matches no type Claude Code sends shows it partially available" (Task 2). None has an MCP surface, so none carries an implementation tag, and each runs once, under the adapter profile. No positive `info` Outline is added: the install `Given` of each list scenario already fails without the fix, and install without `--partial` succeeds only for an available plugin.
7. **Red proofs.** R0, Task 1 before the fix: the new-session scenario fails at its install `Given`. R1, Task 2, temporary breaks of the dispatch predicate and the partition: both list scenarios fail at their runs `Then`, and all four drop rows fail. R2, Task 2, a temporary break that gives StopFailure the wide shape: only the `rate_limit, overloaded` row fails. No break is ever committed.
8. **Records.** One new docs row, with the reinstall note, because install staged the supported subset, so a plugin installed with `--partial` keeps its dropped groups until a reinstall. The same note is in the D-CF5-08 docs paragraph. Also one CHANGELOG sub-bullet, BACKLOG CLOSEDLIST-01 in the closed form, and the D-BG-302 row of PROJECT.md extended to the four events with the `✓ Good` outcome.
9. **Not changed, on purpose:** `NON_TOOL_EVENT_CLOSED_SETS` and its vocabularies; the tool-event matcher parser (`parseMatcher`, #217); the `no-matcher-support` drops of UserPromptSubmit and Stop (D-58-06); regex matchers (MATCH-V2-01); `test/bridges/hooks/settle.test.ts`; `.planning/DUBIOUS-CHOICES.md`, which gets a parent line; the existing StopFailure CHANGELOG line, whose missing reinstall note becomes a parent question.

## Grep gate baselines at BASE (9a398226)

| Gate | Value at BASE | Deliverable |
|------|---------------|-------------|
| `stopFailureMatcherTypes` in `extensions/` and `test/` | 4 files | absent |
| `stopFailureMatcherCondition` in `extensions/` and `test/` | 1 file | absent |
| `closedSetMatcherValues` anywhere | 0 | present in hook-events.ts (export), partition.ts, dispatch.ts |
| `CLOSEDLIST-01` in hook-events.ts, docs/hooks-compatibility.md | 0, 0 | at least 1 each |
| the three new scenario titles, the `rate_limit, overloaded` row | 0 | 1 each |
| `## ~~CLOSEDLIST-01:` in BACKLOG.md, open heading of the same id | 0, 1 | 1, 0 |
| Unreleased CHANGELOG sub-bullet naming `SessionStart` and `PreCompact` | 0 | 1 |
| D-BG-302 row: `closedSetMatcherValues`, old reader name, revisit outcome | 0, 1, 1 | 1, 0, 0 |

The negative gates on the removed helper names count comments on purpose: the comments rule forbids narrating removed code, so no comment may name them.

## Project skills that bind this plan

- `.agents/skills/committing/SKILL.md`.
- `.agents/skills/local-verification/SKILL.md`, with `rules/commands.md` and `rules/gates.md`.
- `.agents/skills/cucumber/SKILL.md`, with `rules/features.md` and `rules/layout.md`. The plan names each scenario's title, its hooks, and what it proves; the step text is the writer's, from the existing steps only. Escape `|` in a table cell as `\|`.
- `.agents/skills/typescript-unit-tests/SKILL.md`, with `rules/cases.md`: one `for` loop over typed rows per entrypoint, one `test()` per row, no conditional inside `test()`.
- `.agents/skills/typescript-style/SKILL.md`, with `rules/comments.md`. Comments cite CLOSEDLIST-01, D-BG-302, D-58-06, and MATCH-V2-01, never a phase, plan, or quick id. Load the `simple-english` skill (Plain mode) and the `humanizer` skill for every comment, test title, and doc line you write.
- `.agents/skills/changelog/SKILL.md`, with `rules/entries.md` (Task 3).
- `.agents/skills/claude-code-compat-research/SKILL.md`. The evidence record above is the record.

## Executor rules for this run

- Read each file before you edit it. Trace the callers of each function you change: the callers are listed under Interfaces.
- Tests run in a hermetic home: the npm scripts and the cucumber world do this. Never read or write the real `~/.pi/agent`.
- One commit per task. Before each commit, run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <changed files>` and restage the fixer edits. Then run `git commit` in the foreground with the longest tool timeout. The hook runs `npm run check:commit`. Never use `--no-verify`, `--amend`, `git add -A`, or a bare `git stash`. Never push, never rebase. Titles follow Conventional Commits (5 to 72 characters) and name no quick id, phase, or plan. End each message with the attribution lines your session gives.
- A red run is observed locally and never committed. Keep each red log outside the repository, in your scratchpad, and record its command, exit status, and failing step.
- Run cucumber one profile at a time, and give paths only to `npm run test:cucumber:profile`.
- Do not edit `.planning/STATE.md`, `.planning/ROADMAP.md`, or `.planning/DUBIOUS-CHOICES.md`. The quick workflow records the task.
- Sibling 261109-cpn (`depends_on`) also edits `bridges/hooks/settle.ts` (its Stop path and `stop_hook_active`), `docs/hooks-compatibility.md`, `.planning/PROJECT.md`, and `CHANGELOG.md`, and it lands first. The line numbers in this plan are from BASE, so find each edit site by name: `runStopFailure` and its SFAIL-03 comment in settle.ts, the Matcher syntax table in the docs, the D-BG-302 row in PROJECT.md, and the `StopFailure` matcher line of the Unreleased CHANGELOG entry. Leave cpn's lines as they are.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): one closed-set list reader, from a plugin's hooks.json to the SessionStart and SessionEnd runs of a new session</name>
  <files>features/hook/session.feature, extensions/pi-claude-marketplace/domain/components/hook-events.ts, test/domain/components/hook-events.test.ts, extensions/pi-claude-marketplace/domain/components/hooks/partition.ts, test/domain/components/hooks/partition.test.ts, extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts, test/bridges/hooks/dispatch.test.ts, extensions/pi-claude-marketplace/bridges/hooks/settle.ts</files>
  <precondition>The checkout has its dependencies: `node_modules/.bin/cucumber-js` and `node_modules/.cache/optional-peers` exist.</precondition>
  <read_first>
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts (lines 146-345: the tables, the StopFailure-only reader, and their doc comments)
    - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts (whole file)
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts (lines 140-180 and 995-1085: `matcherFiresOnClosedSetValue`, `matchValue`, `entryFires`)
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts (lines 1-40 and 395-440)
    - test/domain/components/hook-events.test.ts (lines 1-20 and 120-180), test/domain/components/hooks/partition.test.ts (lines 175-236), test/bridges/hooks/dispatch.test.ts (lines 155-190 and 505-530)
    - features/hook/session.feature (the first three scenarios), .planning/milestones/behavioral-gaps-phases/03-stopfailure-hooks/03-02-SUMMARY.md
  </read_first>
  <behavior>
    - The reader's rows, as `{ event, matcher, expected values }`: the ten existing StopFailure rows keep their values and gain `event: "StopFailure"`, for example `rate_limit|overloaded` gives `rate_limit`, `overloaded`, while `rate_limit,overloaded` and `rate limit` give nothing (D-BG-302). New rows: SessionStart `startup|clear` gives `startup`, `clear`; SessionStart `reload, clear` gives `reload`, `clear`; SessionEnd ` clear , resume |other ` gives `clear`, `resume`, `other`; SessionEnd `clear||,resume` gives `clear`, `resume`; PreCompact `manual-auto` gives `manual-auto`; PreCompact `, |` gives nothing; PostCompact `manual.*` gives nothing; PostCompact with a tab between `manual` and `auto` gives nothing; SessionStart `""` and `*` give nothing. The planner checked each expected list against the Design item 1 rule.
    - partitionHooks: one loop with an `event` column replaces the StopFailure-only loop and keeps its eight rows. Kept rows: SessionStart `reload, clear`, SessionEnd `quit|clear`, PreCompact `auto, manual`, PostCompact ` manual `. Rows dropped as `closed-set`: SessionStart `reload|quit`, SessionEnd `Clear, Resume`, PreCompact `threshold, overflow`, PostCompact `manual.*`, PostCompact `, |`. The case "keeps a closed-set value and drops values outside the set" stays as it is.
    - matcherFiresOnClosedSetValue: each row names its `claudeEvent`, and the four existing rows keep SessionStart. New rows: SessionStart `reload, clear` with `clear` fires; SessionStart `resume|fork` with `clear` does not; SessionEnd `quit|clear` with `clear` fires; SessionEnd `Clear, Resume` with `clear` does not; PreCompact `auto, manual` with `manual` fires; PostCompact ` manual ` with `manual` fires; PostCompact `manual.*` with `manual` does not; StopFailure `rate_limit|overloaded` with `overloaded` fires; StopFailure `rate_limit, overloaded` with `overloaded` does not.
    - Each row is its own `test()` whose title names the event and the matcher. A durable ID (D-BG-302, CLOSEDLIST-01) may appear in a title, and a row field may carry it, but no conditional sits inside `test()`. Each module keeps one loop per entrypoint, so fallow finds no new clone group.
  </behavior>
  <action>Implements CLOSEDLIST-01 on the shared path, as D-BG-302 does for StopFailure (Design items 1 to 5).

Step 1, red scenario. In `features/hook/session.feature`, after "A SessionEnd matcher selects the run for its reason", add the scenario "A list matcher selects the SessionStart and SessionEnd runs of a new session". It follows the file's first scenario ("A new session runs SessionEnd with reason clear and SessionStart with source clear") step for step, with four recording hooks: `start-listed` on SessionStart with matcher `reload, clear`, `start-other` on SessionStart with `resume|fork`, `end-listed` on SessionEnd with `quit|clear`, and `end-other` on SessionEnd with `resume, logout`. Its `the hooks record these runs:` table has exactly two rows, in this order: SessionEnd, session `first`, reason `clear`, arguments `end-listed`; then SessionStart, session `second`, source `clear`, arguments `start-listed`. Every other column is as in that first scenario. The matchers are chosen so that a wrong reader fails. They hold a `,` list, a space before the value that fires, an unknown value (Pi's own `reload` and `quit`) before the value that fires, and kept lists that must not fire. Run the scenario alone under the adapter profile (`npm run test:cucumber:profile -- --profile adapter --name 'A list matcher selects the SessionStart and SessionEnd runs' features/hook/session.feature`) and keep the log. It must fail at the install `Given` with `demo@fixtures` `partially-available`, `unsupported hooks`, hint `partial-install` (R0). The planner's probe saw exactly this at BASE.

Step 2, red units. Write the `<behavior>` rows in the three test modules first, and run each module to see the new rows fail or fail to load.

Step 3, the reader. In `domain/components/hook-events.ts`, replace the StopFailure-only reader (the regex constant at line 234 and the exported function under it, lines 236-250) with two module-private shape constants, the narrow one equal to today's and the wide `/^[\w|, -]+$/`, and the exported `closedSetMatcherValues(event: BucketAEvent, rawMatcher: string): readonly string[]` of Design item 1. Its doc comment states Claude Code's two shapes, the trim, the regular-expression path that the bridge does not support (MATCH-V2-01), and that callers handle `""` and `*`. It cites D-BG-302 and CLOSEDLIST-01. Update the comments that name the old reader or say that membership is whole-value: the StopFailure paragraph of the `NON_TOOL_EVENT_FIELDS` doc (lines 181-185) and the opening paragraph of the `NON_TOOL_EVENT_CLOSED_SETS` doc (lines 278-282), which says that a matcher listing no value of the set trips TOOL-02 (D-58-06). The vocabularies and both tables do not change.

Step 4, parse time. In `domain/components/hooks/partition.ts`, remove the StopFailure-only condition function (lines 48-54) and the StopFailure branch at the top of `nonToolMatcherCondition`. After the existing `no-matcher-support` check, the function keeps the group (`null`) when one value from `closedSetMatcherValues(event, rawMatcher)` is in `NON_TOOL_EVENT_CLOSED_SETS` for the event, and returns `"closed-set"` otherwise (Design item 2). One short comment cites D-BG-302 and CLOSEDLIST-01. Fix the import list. Keep the members in case-insensitive alphabetical order, as today.

Step 5, dispatch time. In `bridges/hooks/dispatch.ts`, `matcherFiresOnClosedSetValue(entry, value)` keeps its signature and fires on `""`, on `*`, or when `closedSetMatcherValues(entry.claudeEvent, entry.rawMatcher)` includes `value` (Design item 3). Import the reader as a value import from `../../domain/components/hook-events.ts`. The existing type-only import of that module stays in the type group. Rewrite its doc comment (lines 168-176): the parser keeps match-all and lists with a member of the event's closed set (D-BG-302, CLOSEDLIST-01), so a hook fires when the event's mapped value is one of its listed values, exactly and case-sensitively.

Step 6, settle. In `bridges/hooks/settle.ts`, the `runStopFailure` filter becomes `(entry) => matcherFiresOnClosedSetValue(entry, classifiedError)`. Remove the value import of the old reader from `hook-events.ts`. The type-only `StopFailureErrorType` import stays. Keep the `matcherFiresOnClosedSetValue` import (Design item 4, P3-DC-06). Rewrite the last sentence of the SFAIL-03 comment above the call (lines 417-420) so it says that the shared predicate reads the `|` list.

Step 7, checks and commit. Run the `<verify>` commands. Scenario A passes, every scenario of `features/hook/session.feature` and `features/hook/stop-failure.feature` still passes (the D-BG-302 list scenario included), and the four pairs keep 100% direct coverage. No comment names a removed helper or describes the old shape. Then run the pre-commit fixers and commit. Suggested title: `feat(hooks): read session and compaction matchers as value lists`.</action>
  <verify>
    <automated>npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts extensions/pi-claude-marketplace/domain/components/hooks/partition.ts extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts extensions/pi-claude-marketplace/bridges/hooks/settle.ts && npm run typecheck && npm run check:features && npm run test:integration</automated>
    <automated>! grep -rqF 'stopFailureMatcherTypes' extensions test && ! grep -rqF 'stopFailureMatcherCondition' extensions test && test "$(grep -cF 'export function closedSetMatcherValues(' extensions/pi-claude-marketplace/domain/components/hook-events.ts)" -eq 1 && test "$(grep -cF 'closedSetMatcherValues(' extensions/pi-claude-marketplace/domain/components/hooks/partition.ts)" -ge 1 && test "$(grep -cF 'closedSetMatcherValues(' extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts)" -ge 1 && test "$(grep -cF 'CLOSEDLIST-01' extensions/pi-claude-marketplace/domain/components/hook-events.ts)" -ge 1 && test "$(grep -cF 'Scenario: A list matcher selects the SessionStart and SessionEnd runs of a new session' features/hook/session.feature)" -eq 1</automated>
    <automated>npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/hook/stop-failure.feature</automated>
  </verify>
  <done>R0 is recorded (the new-session list scenario fails at the install `Given` before the fix). After the commit, a SessionStart, SessionEnd, PreCompact, or PostCompact list with one known value is kept and fires on a listed value, a list with no known value drops as `closed-set`, and StopFailure keeps its narrow grammar. One reader serves all five events, the removed helpers are gone from `extensions/` and `test/`, the four pairs keep 100% direct coverage, the commit hook passed, and both feature files pass under the adapter profile.</done>
</task>

<task type="auto">
  <name>Task 2: the compaction list scenario, the drop Outline over the four events, the StopFailure narrow-grammar row, and the red proofs</name>
  <files>features/hook/session.feature, features/hook/stop-failure.feature</files>
  <read_first>
    - features/hook/session.feature (as Task 1 left it, especially "A compaction trigger matcher selects the PreCompact and PostCompact runs")
    - features/hook/stop-failure.feature (the Outline "Info on a plugin whose StopFailure matcher <matcher> matches no type Claude Code sends shows it partially available", about lines 223-253)
    - .agents/skills/cucumber/rules/features.md
  </read_first>
  <action>Extends CLOSEDLIST-01's coverage to the compaction pair and to the drop rule, and pins D-BG-302's narrow grammar under the shared reader (Design items 6 and 7). Task 1's product code is committed, and this task changes only feature files.

Step 1. In `features/hook/session.feature`, after "A compaction trigger matcher selects the PreCompact and PostCompact runs", add "A list matcher selects the PreCompact and PostCompact runs of a compaction". It follows that scenario step for step, with four recording hooks: `pre-listed` on PreCompact with `auto, manual`, `pre-other` on PreCompact with `threshold|auto`, `post-listed` on PostCompact with `overflow|manual`, and `post-other` on PostCompact with `threshold, auto`. Its runs table has exactly two rows, in this order: PreCompact, trigger `manual`, arguments `pre-listed`; then PostCompact, trigger `manual`, arguments `post-listed`, with the same compact summary and other columns as that scenario.

Step 2. In the same file, add the Scenario Outline "Info on a plugin whose <event> matcher <matcher> lists no value Claude Code sends shows it partially available". It takes the shape of the StopFailure drop Outline: one recording hook on `<event>` with `<matcher>`, no install, `the user runs "/claude:plugin info demo@fixtures"`, and the whole field table with `plugin components hooks` `[{"kind":"lenient","event":"<event>","supported":true}]`, `plugin reasons` `unsupported hooks`, and `plugin status` `partially-available`. Examples, one per event: SessionStart `reload|quit`, SessionEnd `Clear, Resume`, PreCompact `threshold, overflow`, PostCompact `Manual|Auto`. The planner's probe saw these four rows pass at BASE with this exact table. They stay green after the fix and guard the rule that a list needs one value of its event's set (D-58-06).

Step 3. In `features/hook/stop-failure.feature`, add the row `rate_limit, overloaded` to the Examples of that StopFailure drop Outline, and keep its column aligned. It pins that StopFailure keeps Claude Code's narrow `|` grammar under the shared reader (D-BG-302).

Step 4, red proofs, never committed. Each break edits only committed product files. Undo it with `git checkout -- <the broken files>` before the next step, then confirm that `git status --short -- extensions` prints nothing.
- R1: in `bridges/hooks/dispatch.ts`, make `matcherFiresOnClosedSetValue` compare the raw matcher with the value as one whole string again. In `domain/components/hooks/partition.ts`, keep a group whenever `closedSetMatcherValues` returns at least one value, whatever the closed set holds. Then run `npm run test:cucumber:profile -- --profile adapter --name 'A list matcher selects' --name 'lists no value Claude Code sends' features/hook/session.feature`. Both list scenarios must fail at their runs `Then` (no listed hook runs), and all four drop rows must fail (the plugin shows `available`).
- R2: in `domain/components/hook-events.ts`, give StopFailure the wide shape too. Run `npm run test:cucumber:profile -- --profile adapter --name 'matches no type Claude Code sends' features/hook/stop-failure.feature`. Only the `rate_limit, overloaded` row fails, and the other three rows pass.

Step 5. Run the `<verify>` commands: `npm run check:features`, and the whole `features/hook` directory under the adapter profile. Every hook scenario passes. If an unrelated scenario fails, rerun it alone, and record both runs in the SUMMARY. Then run the pre-commit fixers and commit. Suggested title: `test(hooks): pin list matchers on compaction and the closed-set drops`.</action>
  <verify>
    <automated>npm run check:features && test "$(grep -cF 'Scenario: A list matcher selects the PreCompact and PostCompact runs of a compaction' features/hook/session.feature)" -eq 1 && test "$(grep -cF 'Scenario Outline: Info on a plugin whose <event> matcher <matcher> lists no value Claude Code sends shows it partially available' features/hook/session.feature)" -eq 1 && test "$(grep -cE '\| rate_limit, overloaded +\|' features/hook/stop-failure.feature)" -eq 1</automated>
    <automated>npm run test:cucumber:profile -- --profile adapter features/hook</automated>
  </verify>
  <done>R1 and R2 are recorded with their failing steps, every break is undone (`git status --short -- extensions` is empty), the compaction list scenario and the four-row drop Outline pass, the StopFailure drop Outline has four rows and passes, and every scenario under `features/hook` passes under the adapter profile. The commit hook passed.</done>
</task>

<task type="auto">
  <name>Task 3: the docs row, the CHANGELOG sub-bullet, CLOSEDLIST-01 closed, and the D-BG-302 row extended</name>
  <files>docs/hooks-compatibility.md, CHANGELOG.md, .planning/BACKLOG.md, .planning/PROJECT.md</files>
  <read_first>
    - docs/hooks-compatibility.md (the Matcher syntax table, lines 115-131, and the D-CF5-08 reinstall paragraph under the session events table, line 58)
    - CHANGELOG.md (the `## [Unreleased]` section)
    - .planning/BACKLOG.md (the closed entries near line 4995 for the form, and the CLOSEDLIST-01 entry near line 5095)
    - .planning/PROJECT.md (the D-BG-301 and D-BG-302 rows of Key Decisions, lines 2228-2229)
    - .agents/skills/changelog/rules/entries.md
  </read_first>
  <action>Records CLOSEDLIST-01 and the extension of D-BG-302 (Design item 8). Load the `simple-english` skill (Plain mode) and the `humanizer` skill for every line.

1. `docs/hooks-compatibility.md`, Matcher syntax table: add one row right after the `PreCompact` / `PostCompact` row, before the `Stop` row. Feature: `\|` and `,` lists in `SessionStart`, `SessionEnd`, `PreCompact`, and `PostCompact` matchers. Claude Code ✓, Pi ✓. Notes: a matcher made only of letters, digits, `_`, `-`, spaces, `,`, and `\|` is a list of exact, case-sensitive values separated by `\|` or `,`, with the spaces around each value trimmed, as upstream. The group is kept when at least one listed value is in the event's set, and it runs on any listed value (CLOSEDLIST-01). Any other matcher drops the group as `closed-set` (MATCH-V2-01). A plugin that you installed with `--partial` before this change dropped those groups at install, so run `/claude:plugin reinstall <plugin>` to restore them. No other docs row changes, because the StopFailure row already states its narrow grammar.

2. `CHANGELOG.md`, under `## [Unreleased]`: one sub-bullet right after the line on `StopFailure` hook matchers. Suggested: `SessionStart`, `SessionEnd`, `PreCompact`, and `PostCompact` hook matchers now accept `|` and `,` lists. To run such a hook in a plugin that you installed with `--partial`, reinstall the plugin. Keep it to 40 words or fewer and follow `rules/entries.md`. No other line changes.

3. `.planning/BACKLOG.md`: give the CLOSEDLIST-01 heading the closed form of the entries above it, with the same title, struck through and followed by `-- CLOSED`. Under the heading, before the existing paragraph that starts "Noted 2026-11-08", add a paragraph that starts `**CLOSED <today's date>** by quick task 261109-cpk (fixed).` It says what a matcher of these four events now means, that one reader serves them and StopFailure, whose narrow `|` grammar stays as D-BG-302 states, and which scenarios pin it. Keep the Noted paragraph as it is.

4. `.planning/PROJECT.md`, the D-BG-302 row of Key Decisions (one line):
   - In the bold heading, replace "the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md" with "extended to SessionStart, SessionEnd, PreCompact, and PostCompact by CLOSEDLIST-01 at the user's request on 2026-11-09, see DUBIOUS-CHOICES.md P3-DC-02". Make the bold title "a closed-set matcher is a list of exact values, as Claude Code reads it".
   - Decision text: the narrow StopFailure grammar as today. The wide grammar of the four events: letters, digits, `_`, `-`, spaces, `,`, and `\|`, split on `\|` or `,`, with each value trimmed. Empty values are dropped. The group is admitted with one value in the closed set, and it fires on an exact, case-sensitive match. Other matchers keep the `closed-set` drop (MATCH-V2-01), and `""` and `*` match all.
   - Replace the sentence about StopFailure's own code path with the shared path: `closedSetMatcherValues` in `hook-events.ts`, which `nonToolMatcherCondition` (`hooks/partition.ts`) and `matcherFiresOnClosedSetValue` (`dispatch.ts`) call, and which `runStopFailure` reaches through the shared predicate (P3-DC-06).
   - Rationale: Claude Code 2.1.319's matcher parser and its docs (the narrow set for StopFailure and FileChanged, `\|` or `,` for every other matcher event). Remove the sentence that says the four events keep the gap.
   - Set the Outcome cell to `✓ Good`.
   - Escape each `|` inside a cell as `\|`. Touch no other row.

Run the `<verify>` command, which includes the pre-commit fixers. Then commit. Suggested title: `docs(hooks): record list matchers on the closed-set events`.</action>
  <verify>
    <automated>test "$(grep -cF 'CLOSEDLIST-01' docs/hooks-compatibility.md)" -ge 1 && test "$(awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | grep -F 'SessionStart' | grep -F 'PreCompact' | grep -c '^  - ')" -eq 1 && test "$(grep -cE '^## CLOSEDLIST-01:' .planning/BACKLOG.md)" -eq 0 && test "$(grep -cF '## ~~CLOSEDLIST-01:' .planning/BACKLOG.md)" -eq 1 && test "$(grep -cF 'by quick task 261109-cpk' .planning/BACKLOG.md)" -ge 1 && test "$(grep -F '**D-BG-302' .planning/PROJECT.md | grep -cF 'closedSetMatcherValues')" -eq 1 && test "$(grep -F '**D-BG-302' .planning/PROJECT.md | grep -cF 'stopFailureMatcherTypes')" -eq 0 && test "$(grep -F '**D-BG-302' .planning/PROJECT.md | grep -cF -- '-- Revisit')" -eq 0 && SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/hooks-compatibility.md CHANGELOG.md .planning/BACKLOG.md .planning/PROJECT.md</automated>
  </verify>
  <done>The docs table has the list row with the reinstall note. The Unreleased CHANGELOG entry has exactly one new sub-bullet for the four events. BACKLOG shows CLOSEDLIST-01 closed by 261109-cpk with its Noted paragraph kept. The D-BG-302 row names the shared reader, covers the four events, and reads `✓ Good`. The pre-commit fixers pass, the commit is made, and `git status` is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin `hooks.json` matcher -> parse-time partition | Author-controlled text from a marketplace decides whether a hook group is kept and whether the plugin reads `available` or `partially-available`. |
| plugin matcher -> dispatch-time predicate | Author-controlled text decides whether the plugin's hook command runs on a session or compaction event. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cpk-01 | Tampering | `matcherFiresOnClosedSetValue` (a hook runs on an event value it did not list) | medium | mitigate | Exact, case-sensitive comparison of trimmed listed values with the mapped Claude value. The dispatch rows (`resume\|fork` with `clear`, `Clear, Resume` with `clear`, `manual.*` with `manual`) and the `*-other` hooks of both list scenarios prove that a list fires only on a listed value. |
| T-cpk-02 | Denial of service | the list-shape test on author text | low | mitigate | Each shape is one anchored character class with one `+`, so the test runs in linear time. No regular expression is built from plugin text, and regex-path matchers stay dropped (MATCH-V2-01). |
| T-cpk-03 | Tampering | `nonToolMatcherCondition` (a group that can never fire hides a degraded plugin) | low | mitigate | A list is kept only when one value is in the event's closed set (D-58-06). The partition rows and the four-row drop Outline pin the drop, and R1 proves the Outline fails when the partition admits any list. |
| T-cpk-04 | Tampering | reader shape selection (StopFailure accepts the wider grammar) | low | mitigate | StopFailure keeps the narrow shape. The reader rows and the `rate_limit, overloaded` row pin it, and R2 proves the row fails under the wide shape. |
| T-cpk-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package and changes no dependency file. |
</threat_model>

<verification>
- Each task's `<verify>` commands pass, and each commit's hook passes. The SUMMARY records R0, R1, and R2 (command, exit status, and failing step) and each green run.
- The final tree keeps the regression scenarios green: "A clear matcher selects the SessionStart run of a new session", "A SessionEnd matcher selects the run for its reason", "A compaction trigger matcher selects the PreCompact and PostCompact runs", the StopFailure `|`-list scenario "A StopFailure matcher that lists error types runs its hook on a listed type", and the StopFailure available Outline.
- AGENTS.md "Build verification": this task commits build inputs, so `npm run check` must pass on the combined tree after the merge, before the batch finishes. An executor in an isolated worktree states that the quick-batch coordinator runs it after the merge. An executor that committed in the main checkout runs it in the foreground with the longest timeout, or in the background with a completion notification, and records the command, exit status, commit, and Node version.
- `git status` is clean after Task 3. STATE.md, ROADMAP.md, and DUBIOUS-CHOICES.md are untouched.
</verification>

<success_criteria>
- A `|` or `,` list with one known value on SessionStart, SessionEnd, PreCompact, or PostCompact installs with no `--partial`, and its hook runs only on a listed value.
- A list with no known value on those events still shows the plugin `partially-available` with `unsupported hooks`, and StopFailure still reads only `|` lists.
- One reader serves the five closed-set events at parse time and at dispatch time. The StopFailure-only reader and condition are gone.
- Three new scenarios and one new Outline row are added. The new-session scenario fails without the fix (R0), and R1 and R2 prove that the other three fail under a break.
- The hook-events, partition, dispatch, and settle pairs keep 100% direct coverage. `npm run check` passes on the merged tree.
- The docs row, the CHANGELOG sub-bullet, the closed BACKLOG entry, and the extended D-BG-302 row are in place.
</success_criteria>

<output>
Create `.planning/quick/261109-cpk-closedlist-01-accept-and-matcher-lists-on-sessionstart-sessi/261109-cpk-SUMMARY.md` with `status: complete` in its frontmatter. Include:
- BASE, the three commits, and every red and green run: R0, R1, and R2 with command, exit status, failing step, and log path; the green runs; and either the `npm run check` result or the statement that the coordinator runs it after the merge.
- `## Upstream evidence`: the record from this plan's context, unchanged.
- `## Questionable choices`, each with the choice, the alternative, why the alternative was not taken, and a severity. At least these, plus any you made:
  - (1) One reader for five events, with the shape picked by the event. Alternative: two readers. Not taken, because the batch asked for one shared reader and fallow flags a clone.
  - (2) The reader takes `BucketAEvent`, so neither caller casts, and every event but StopFailure gets the wide shape. That matches Claude Code for every event that reaches it.
  - (3) Dispatch splits the raw matcher at each event instead of storing the list on `RoutingEntry`. A stored list would change the router and every fixture that lists the entry's fields.
  - (4) A list with no known value still drops as `closed-set` (D-58-06), where Claude Code installs the plugin and never runs the hook.
  - (5) Spaces around a single value (` clear `) are now accepted, as Claude Code trims them. Only unit rows pin this, because cucumber trims table cells.
  - (6) No positive `info` Outline for the four events: the install `Given` of each list scenario already fails without the fix.
  - (7) Task 1 touches eight files, over the five-file guideline, because each source edit commits with its paired test, and the tracer needs the scenario and both readers of the list.
  - (8) The StopFailure drop Outline gains one row to pin the narrow grammar under the shared reader.
  - (9) The new CHANGELOG line asks for a reinstall. The existing StopFailure list line has no such note, although the same staging applies to it.
- `## Threat Flags` (AGENTS.md), even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
- `## Parent lines`:
  - `.planning/DUBIOUS-CHOICES.md`: P3-DC-02 is fixed by 261109-cpk, so its bullet under "Decisions waiting on you" can go and its Phase 3 entry can say so.
  - A question for the user: should the StopFailure list line of the Unreleased CHANGELOG entry get the same reinstall note?
  - No STATE.md or ROADMAP.md lines. The quick workflow records the task.
</output>

## Coordinator amendments (2026-11-09, binding; they override the tasks above)

**Shared records are written by the coordinator, not by this executor.** Do NOT
edit `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, or
`.planning/DUBIOUS-CHOICES.md`. Every task step that writes one of them is
replaced by this: put the exact text you would have written (new decision
rows, superseded/reversed markers, BACKLOG closures or new entries, the
CHANGELOG sub-bullet) in the SUMMARY under a `## Parent lines` heading, one
sub-heading per file, ready to paste. The six batch items would otherwise all
queue on the same three files. The rest of each task (code, tests, scenarios,
other docs) runs as planned.

**User answers (2026-11-09):** the CHANGELOG text (in `## Parent lines`)
folds the existing StopFailure list line and the four new events into ONE
sub-bullet with a single reinstall note for plugins installed with
`--partial`; say which existing line it replaces.
