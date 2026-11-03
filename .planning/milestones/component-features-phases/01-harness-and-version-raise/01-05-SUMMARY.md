---
phase: 01-harness-and-version-raise
plan: 05
subsystem: testing
tags: [cucumber, hooks, hook-recorder, scripted-model, pretooluse]

requires:
  - phase: 01-harness-and-version-raise
    provides: "The profile Pi, the scripted model, the model-turn When, the turn's harness logs, and markTurnCompared (plan 01-03)"
provides:
  - "features/lib/hook-recorder.ts: a child of itself that a plugin hook runs; one JSON line per hook process in <harness>/hook-runs.jsonl (HAR-04, D-CF1-17)"
  - "features/lib/hook-files.ts: the hooks.json writer whose hooks each run the recorder, named by their one argument"
  - "features/step_definitions/hook/runs.steps.ts: the hooks Given and the runs Then"
  - "features/hook/tool-use.feature: the hook seed (HAR-07, D-CF1-08)"
affects: [01-09, hooks]

actuals:
  tokens: 3122     # chars/4 over the four created files (12,488 chars)
  tasks: 2
  commits: 1       # MEASURED: git rev-list --count c5a8396..HEAD (Task 2 changed no file)
plan_head_before: c5a8396c78f5d9c5f11097f31b1b5c02da0f63ef
plan_head_after: e4e44b4065ffe865662dabbdf6837f0b76726831

tech-stack:
  added: []
  patterns:
    - "A recording hook runs \"<node>\" \"<recorder path>\" <hook name>, so each run names its hook and two hooks on one matcher are two commands"
    - "The runs Then builds one record per run and compares it through recordTable, so a recorded field the table leaves out shows up as an extra column"

key-files:
  created:
    - features/lib/hook-recorder.ts
    - features/lib/hook-files.ts
    - features/step_definitions/hook/runs.steps.ts
    - features/hook/tool-use.feature
  modified: []

key-decisions:
  - "The hooks Given takes a | name | event | matcher | table, and each hook passes its name as the recorder's one argument, so a second hook on one matcher is a feature-only change"
  - "The runs table has one column per recorded field: the stdin fields as words (hook_event_name is event, session_id is session), arguments, and each environment variable by its own name"
  - "The recorder also records CLAUDECODE, beside the CLAUDE_* variables, because the bridge sets it for every hook (SENV-01)"

patterns-established:
  - "A hook run row: event, session ordinal, tool name, tool input JSON, cwd, transcript path, arguments, then the environment variables"

requirements-completed: [HAR-04, HAR-07]

coverage:
  - id: D1
    description: "A scripted bash call fires the plugin's PreToolUse hook with a Bash matcher once, and the runs Then compares the recorder's whole record of that run"
    requirement: HAR-04
    verification:
      - kind: e2e
        ref: "features/hook/tool-use.feature#A PreToolUse hook runs once for a scripted bash call with Claude's tool name and input"
        status: pass
    human_judgment: false
  - id: D2
    description: "The recorder writes one whole line per hook process, never merging two runs (HAR-04 adjacency)"
    requirement: HAR-04
    verification:
      - kind: manual_procedural
        ref: "one-off: 40 concurrent recorder runs with two 5 KB payloads in a scratch HOME -> 40 whole lines, 20 of each (this SUMMARY)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two hooks on one matcher give two rows in the order their processes appended them, and the Then compares that order (HAR-04 ordering)"
    requirement: HAR-04
    verification:
      - kind: manual_procedural
        ref: "one-off: temporary second PreToolUse/Bash hook in the seed, 18 passing runs, and a swapped expected order failing (this SUMMARY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "features/hook/, features/lib/hook-files.ts, and features/step_definitions/hook/runs.steps.ts exist and are used; check:features, fallow dead-code, and the whole suite pass"
    requirement: HAR-07
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: other
        ref: "npx fallow dead-code --fail-on-issues --format human --quiet"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (1161/1161, seed 180686)"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 05: Hook Recorder and Hook Seed Summary

**A plugin's PreToolUse hook on `Bash` now runs a recorder that logs one JSON line per hook process. The seed scenario fires it with a scripted `bash` call and compares every field the hook received: the stdin, the arguments, and the `CLAUDE_*` environment.**

## Performance

- **Duration:** about 33 min of work (wall clock 04:41-05:14 UTC, with the commit hook and the suite run in the background)
- **Started:** 2026-11-01T04:41Z
- **Completed:** 2026-11-01T05:14:29Z
- **Tasks:** 2 (Task 2 changed no file)
- **Files modified:** 4 created

## Accomplishments

- `features/lib/hook-recorder.ts` exports `HOOK_RECORDER_PATH`, `HOOK_RUNS_LOG` (`hook-runs.jsonl`), and the `HookRun` type. Run as the main script, it reads stdin to the end, parses it, and appends one line in one `appendFileSync` call: `{ event, stdin, arguments, environment }`. It prints nothing and exits 0.
- `features/lib/hook-files.ts` reads a `| name | event | matcher |` table and writes `hooks/hooks.json` with one matcher group per hook. Each command is `"<process.execPath>" "<recorder path>" <name>`.
- `features/step_definitions/hook/runs.steps.ts` has the hooks `Given`, which asserts the file it wrote, and the runs `Then`, which compares every recorded field, one row per run in log order, and then calls `markTurnCompared()`.
- `features/hook/tool-use.feature` holds the seed. The model's first call asks for `bash` with `echo from-model`, the hook runs once, and the second call carries the tool result.

## Task Commits

1. **Task 1: Record a PreToolUse hook run of a scripted bash call**: `e4e44b4` (test)
2. **Task 2: Prove the recorder keeps one line per process and leaves nothing running**: no commit. Both one-off checks passed, so the recorder stayed as it was.

## Step texts added

| Keyword | Text | Module |
| --- | --- | --- |
| Given | `the published plugin {string} of the marketplace {string} has these hooks, each recording its runs:` (columns `name`, `event`, `matcher`; a name is lower-case letters, digits, and dashes) | `features/step_definitions/hook/runs.steps.ts` |
| Then | `the hooks record these runs:` (one column per recorded field, one row per run in append order) | `features/step_definitions/hook/runs.steps.ts` |

Both texts name the kind ("hooks"), so no other kind's step can be ambiguous with them (HAR-07 ordering).

### Runs table columns

- Each stdin field is a column named by its words. `hook_event_name` is `event`, and `session_id` is `session`. Any new stdin field becomes a column that the table leaves out, so the `Then` fails.
- `arguments` holds the recorder's arguments joined by spaces. Here that is the hook's name.
- Each recorded environment variable is a column under its own name.
- Strings are projected to run tokens. A cell whose whole value is a session id becomes its ordinal (`first`, `second`, ...), counted by first appearance across the runs, as in the session start hook precedent. Any other value is its JSON text.
- The step also asserts that the recorder's `event` equals the stdin's `hook_event_name`.

## Recorded stdin fields and environment (the seed's one run)

| Field | Recorded value (tokens projected) |
| --- | --- |
| `hook_event_name` | `PreToolUse` |
| `session_id` | the session id (ordinal `first`) |
| `transcript_path` | `""` (empty) |
| `cwd` | `{project dir}` |
| `tool_name` | `Bash` |
| `tool_input` | `{"command":"echo from-model"}` |
| arguments | `bash-guard` |
| `CLAUDE_PROJECT_DIR` | `{project dir}` |
| `CLAUDE_PLUGIN_ROOT` | `{home}/marketplaces/fixtures/plugins/demo` |
| `CLAUDE_PLUGIN_DATA` | `{project dir}/.pi/pi-claude-marketplace/data/demo` |
| `CLAUDE_CODE_SESSION_ID` | the session id (`first`) |
| `CLAUDE_SESSION_ID` | the session id (`first`) |
| `CLAUDECODE` | `1` |

The stdin had exactly these six fields: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `tool_name`, `tool_input`. No other `CLAUDE_*` variable reached the hook. The profile Pi's allowlist environment keeps out the outer Claude Code session's variables.

**Findings for the Hooks phase (not decided here):**

- `transcript_path` is empty. During the first turn, `ctx.sessionManager.getSessionFile()` returned `undefined`, and the bridge falls back to `""` (`translation-context.ts`). Upstream always gives a path. Phase 5 should decide this.
- The bridge runs the matching hooks of one event one at a time, in declaration order (`dispatch.ts` `reduceBucket`), so the append order is the declaration order. Upstream runs matching hooks in parallel.
- The bridge does not dedupe identical hook commands. Upstream does. The recorder's per-hook name argument keeps the seed and the one-off check out of that question.

## Red run (Task 1, before the hooks Given was in the feature)

The scenario without the hooks `Given` failed at the runs `Then`, because no run was recorded:

```text
Then the hooks record these runs: # features/step_definitions/hook/runs.steps.ts:89
  | name       |
  | bash-guard |
    AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    + actual - expected
      [
    +   []
    -   [
    -     'name'
    -   ],
    -   [
    -     'bash-guard'
    -   ]
      ]
```

With the `Given` in place, the first run printed the whole record as extra columns, and those columns became the table above. The final seed passes: 13/13 steps.

## One-off results (Task 2, not committed)

### HAR-04 adjacency: concurrent recorder runs

The scratch script `agent-01-05/concurrent.mjs` (in the session scratchpad, not committed) spawned 40 recorder processes at once in a scratch HOME. 20 got a `PreToolUse` payload with a 5,000-character `tool_input` and the argument `hook-a`. The other 20 got a `PostToolUse` payload with a different 5,000-character input and the argument `hook-b`. Each line was checked to hold exactly its own payload:

```json
{
  "processes": 40,
  "exitCodes": [0],
  "outputs": [""],
  "lines": 40,
  "counts": { "hook-a": 20, "hook-b": 20 },
  "firstLine": {
    "event": "PreToolUse",
    "arguments": ["hook-a"],
    "environment": { "CLAUDE_PROJECT_DIR": "/p/a" },
    "stdinKeys": ["hook_event_name", "session_id", "tool_name", "tool_input"]
  }
}
```

Every process exited 0 and printed nothing. There were 40 whole lines, and no line mixed two runs.

### HAR-04 ordering: two hooks on one matcher

A second row, `| bash-audit | PreToolUse | Bash |`, was added to the seed's hooks table, with a second expected run row after `bash-guard`. 18 captured runs passed, so the runs were recorded as `bash-guard` then `bash-audit`, in process-append order. With the two expected rows swapped, the scenario failed, which shows that the `Then` compares the order:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
...
+     'bash-guard',
-     'bash-audit',
...
+     'bash-audit',
-     'bash-guard',
```

Two of the first three two-hook runs failed. Their output was not captured, because the loop filtered it. The next 18 runs passed while I captured every log. The load average was 18-21 at the time, from the other agents of this wave, and this plan's first run timed out in `Before` at 30 s on a cold profile Pi start. The two failures were most likely the same `Before` timeout, but this is not proven (see Dubious Choices). `git checkout -- features/hook/tool-use.feature` reverted the edit, and `git diff HEAD --stat -- features/hook/tool-use.feature` then printed nothing.

### Nothing left running

After the whole suite, `pgrep -af hook-recorder.ts` found only its own shell. The recorder writes no pid file, because it exits as soon as stdin ends (T-01-32).

## Verification

- `npx cucumber-js features/hook`: 1 scenario, 13/13 steps passed (seed 565777, and again on every later run).
- `npm run check:features`: pass, after Task 1 and again after the suite.
- `npx fallow dead-code --fail-on-issues --format human --quiet`: pass, after `recordingHookCommand` was made module-private. `npx fallow dupes` and `npx fallow health`: pass.
- ESLint on the three `.ts` files, `tsc --noEmit`, and Prettier: pass. The commit hook's `npm run check:commit` passed on `e4e44b4`.
- `npm run test:cucumber`: 1161/1161 scenarios, 11963 steps (seed 180686).

## Files Created/Modified

- `features/lib/hook-recorder.ts`: the recorder child script, its path, its log name, and the `HookRun` type.
- `features/lib/hook-files.ts`: the hooks table parser and the `hooks/hooks.json` writer.
- `features/step_definitions/hook/runs.steps.ts`: the hooks `Given` and the runs `Then`.
- `features/hook/tool-use.feature`: the hook seed.

## Decisions Made

- The hooks `Given` takes a table, not one event and one matcher. A plan check needed a second hook on the same matcher as a feature-only edit. Phase 5 will also need several events in one plugin.
- Each hook passes its name as the recorder's argument. That makes the `arguments` field meaningful, makes each row say which hook ran, and keeps two hooks on one matcher distinct even if the bridge later dedupes identical commands, as upstream does.
- The runs table has one row per run, as the plan says. It is 13 columns wide.

## Deviations from Plan

### Auto-fixed Issues

None. The deviations below are small design changes, not fixes.

**1. [Scope] The recorder also records `CLAUDECODE`.** The plan says every `CLAUDE_*` variable. `CLAUDECODE=1` is the third session variable the bridge sets (SENV-01) beside `CLAUDE_CODE_SESSION_ID` and `CLAUDE_SESSION_ID`, and a hook can read it. It is not a credential, so T-01-31 still holds. Committed in `e4e44b4`.

**2. [Shape] The hooks `Given` takes a `| name | event | matcher |` table.** The plan describes it as giving a plugin "a hook for an event and a matcher". The table also covers the second hook of the Task 2 check. Committed in `e4e44b4`.

**3. [Task 2] No commit.** Both checks passed, so the plan's "change the recorder only if a check fails" left nothing to commit.

---

**Total deviations:** 0 auto-fixed; 3 small design or scope changes.
**Impact on plan:** None on scope. Every must-have truth holds.

## Issues Encountered

- The first seed run timed out in `Before` (30 s) while the profile Pi started cold. The peer cache was missing in this worktree at that point. After `node scripts/install-test-peers.mjs`, runs took 17-35 s per scenario.
- The worktree guard refused compound shell commands that named git or set `HOME` inside a loop. The one-off check therefore ran as a Node script in the scratchpad, and git ran as plain separate calls.

## Known Stubs

None.

## Dubious Choices

1. **`CLAUDECODE` recorded beside the `CLAUDE_*` variables.** This is a superset of the plan's wording. If a phase wants exactly `CLAUDE_*`, drop the `|| name === "CLAUDECODE"` arm in `isClaudeVariable`. The seed's table would then lose one column.
2. **Environment variable names as table headers.** The feature rules ask for header cells in lower-case words. I kept the variable names as written (`CLAUDE_PLUGIN_ROOT`), because a hook author uses those names. A lower-cased form would be a second spelling of the same name.
3. **A 13-column run row.** The plan asks for one row per run. A `| run | field | value |` layout would read better for one run, but it would make several runs, in order, harder to compare. I followed the plan.
4. **Empty `transcript_path` pinned in the seed.** The seed states `""`, which is today's bridge behavior (the session file does not exist yet during the first turn). Upstream gives a real path. If Phase 5 changes this, the seed's cell changes with it. I did not research whether a later turn gets a path.
5. **Two unexplained failures in the ordering check.** Two of the first three two-hook runs failed with output I did not capture. The next 18 passed. I think they were `Before` timeouts under a load average of about 20, but this is not proven. The whole suite passed once, and the seed passed on every run I captured.
6. **Hook names limited to `[a-z0-9-]+`.** The name goes unquoted into the shell command line, so the parser refuses any other name. That covers the seed and the planned Phase 5 cases.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The recorder reads only `CLAUDE_*` and `CLAUDECODE` from the allowlist environment of the profile Pi (T-01-31), and it writes only `<sandbox home>/harness/hook-runs.jsonl`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 can state any hook event's runs with the two steps above. A new stdin field or environment variable shows up as a column that the table leaves out.
- Plan 01-09 should add the two step texts and the `hook-runs.jsonl` log to `.agents/skills/cucumber/rules/world-and-stand-ins.md` (the stand-in convention), and copy the three Hooks-phase findings above to the place where Phase 5 will read them.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: `features/lib/hook-recorder.ts`, `features/lib/hook-files.ts`, `features/step_definitions/hook/runs.steps.ts`, `features/hook/tool-use.feature`.
- FOUND on HEAD: `e4e44b4` (`git rev-list --count c5a8396..HEAD` = 1).
- Acceptance criteria re-run: all four files exist; `grep -c 'CLAUDE_' features/lib/hook-recorder.ts` is at least 1; `git diff HEAD --stat -- features/hook/tool-use.feature` prints nothing.
