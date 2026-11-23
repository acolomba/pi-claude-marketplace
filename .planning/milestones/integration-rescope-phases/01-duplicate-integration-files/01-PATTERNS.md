# Phase 1: Duplicate Integration Files - Pattern Map

**Mapped:** 2026-11-21
**Files analyzed:** 7 (2 modified test harness/feature, 2 docs, 2 deleted, plus SUMMARY.md convention)
**Analogs found:** 6 / 6 (the step-definitions file needs no change)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `features/lib/real-subagent-child.ts` (modify `parseRealChildAgents`) | test utility (table parser) | transform | `parseConcurrentLaunches`, same file, lines 1075-1095 | exact |
| `features/plugin/subagent-child.feature` (add `@mcp` scenario) | behavioral test | event-driven (real child hooks) | "A real background child runs its plugin tool hooks and completes", same file, lines 541-566 | exact |
| `features/step_definitions/plugin/subagent-hooks.steps.ts` | step defs | - | NO CHANGE: When step passes `table.raw()` straight to `parseRealChildAgents` (lines 431-445, verified by research) | n/a |
| `docs/hooks-compatibility.md` line 77 | docs | - | same paragraph's scenario-title citation style | exact |
| `docs/mcp-compatibility.md` lines 495, 527, 770 | docs | - | `features/agent/frontmatter.feature` citations on line 495 | exact |
| `test/integration/hooks-spawn-end-to-end.test.ts` | deleted | - | declare in `files_deleted` frontmatter | n/a |
| `test/integration/pi-subagents-child-identity.test.ts` | deleted | - | declare in `files_deleted` frontmatter | n/a |
| plan `SUMMARY.md` "Red proofs" section | GSD record | - | `.planning/milestones/behavioral-gaps-phases/04-posttoolusefailure-hooks/04-02-SUMMARY.md` lines 45-54 | exact |

All named paths verified git-tracked (`git ls-files`).

## Pattern Assignments

### `features/lib/real-subagent-child.ts` (utility, transform)

**Current code to replace** (lines 1057-1073):
```ts
/**
 * Reads an agents table with the columns `name`, `background`, `tools`, and
 * `tool calls`: an empty `background` or `tools` cell leaves that line out of
 * the agent's frontmatter, and `tool calls` names the calls its child makes,
 * from `bash`, `failing read`, and `stub mcp tool`, separated by commas.
 */
export function parseRealChildAgents(rows: readonly (readonly string[])[]): RealChildAgent[] {
  return tableRecords(rows, ["name", "background", "tools", "tool calls"]).map((row) => ({
    name: row.name ?? "",
    frontmatter: (["background", "tools"] as const).flatMap((key) => {
      const value = row[key] ?? "";
      return value === "" ? [] : [[key, value] as const];
    }),
    body: "Run the tools the task names.",
    calls: namedCalls(row["tool calls"] ?? ""),
  }));
}
```

**Analog: `parseConcurrentLaunches`** (lines 1075-1095) - already has a `body` column placed before `tool calls`, and reads it as `row.body ?? ""`:
```ts
/**
 * Reads a child sessions table with the columns `agent`, `mode` (`append` or
 * `replace`), `body`, and `tool calls`, named as `parseRealChildAgents`
 * names them.
 */
export function parseConcurrentLaunches(
  rows: readonly (readonly string[])[],
): ConcurrentChildLaunch[] {
  return tableRecords(rows, ["agent", "mode", "body", "tool calls"]).map((row) => {
    ...
    return {
      agent: row.agent ?? "",
      mode,
      body: row.body ?? "",
      calls: namedCalls(row["tool calls"] ?? ""),
    };
  });
```

**Target shape** (verified green by research, Pattern 2): choose header by `rows[0]?.includes("body") === true`; columns `["name","background","tools","body","tool calls"]` vs the four-column list; `body: withBody ? (row.body ?? "") : "Run the tools the task names."`. `tableRecords` stays strict (exact header, in order). Update the doc comment to name the optional `body` column (before `tool calls`, as in `parseConcurrentLaunches`) and the default body. Keep `RealChildAgent` / `ConcurrentChildLaunch` exported (fallow passes as-is). Cognitive complexity stays trivial (one ternary pair; no nested conditional, which `sonarjs/no-nested-conditional` forbids).

---

### `features/plugin/subagent-child.feature` (behavioral, event-driven)

**Analog** (lines 541-566), copy structure verbatim, then change the When setting to `unset`, the agent table to one `plain` row with a `body` column, and drop the `granted` rows:
```gherkin
  @mcp
  Scenario: A real background child runs its plugin tool hooks and completes
    When pi-subagents, with its async-by-default setting false, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:
      | name    | background | tools                       | tool calls         |
      | runner  | true       |                             | bash, failing read |
      ...
    Then pi-subagents ran the real children like this:
      | agent        | mode       | state    | runner process | session |
      | demo:runner  | background | complete | recorded       | first   |
    Then the real children's hooks record these runs in any order, and no main-session run names a child:
      | session | event              | tool name | agent type  | agent id | transcript path      | CLAUDE_CODE_SESSION_ID |
      | main    | PreToolUse         | Bash      | demo:runner | first    | session file of main | main                   |
      ... (PostToolUse Bash, PreToolUse Read, PostToolUseFailure Read)
    Then the main session's hooks record these runs for its control prompt:
      | event            | tool name | child identity |
      | SessionStart     |           | none           |
      | UserPromptSubmit |           | none           |
      | PreToolUse       | Bash      | none           |
      | PostToolUse      | Bash      | none           |
      | Stop             |           | none           |
      | Stop             |           | none           |
```
Full new scenario text: RESEARCH.md Pattern 3 (lines 205-228). Insert after line 566, before "Concurrent companion children keep separate hook identities" (line 568). Empty-body precedent for readers: that scenario's `demo:alpha` row (line 571) states an empty body as an empty `body` cell. Must carry exactly one `@mcp` tag and never name `pi-mcp-adapter` (`check:features`). Inserting ~23 lines shifts later line numbers (568 -> ~591); breaks E6 to E11 must cite the post-insert lines.

---

### `docs/hooks-compatibility.md` line 77 and `docs/mcp-compatibility.md` lines 495, 527, 770

**Style to copy** (hooks-compatibility.md:77, existing): scenario titles in double quotes after a link to the feature file:
```
Real children of the installed pi-subagents 0.88.1 run in "A real background child runs its plugin tool hooks and completes" and "Concurrent companion children keep separate hook identities", and in the [real-child tests](../test/integration/pi-subagents-child-identity.test.ts). The first scenario shows ... The second shows ...
... Those tests launch an explicit background agent, an agent granted a plugin MCP tool, an ordinary agent with an empty body under pi-subagents' default launch mode, and two child sessions at once in one runner process.
```
Edits: drop the `[real-child tests]` link, add the new title to the list while keeping "The first"/"The second" ordinals correct (or rephrase them), and rewrite "Those tests launch ..." with the scenarios as subject.

mcp-compatibility.md:
- 495: replace `the [real-child tests](../test/integration/pi-subagents-child-identity.test.ts) for an ordinary agent with an empty body` with the new scenario title in `features/plugin/subagent-child.feature`.
- 527: `The cucumber suite and the integration tests now launch` -> `The cucumber suite now launches`; drop the third path from the parenthesised list.
- 770: replace `(test/integration/pi-subagents-child-identity.test.ts)` with the two granted-agent scenarios ("A real background child runs its plugin tool hooks and completes" in `features/plugin/subagent-child.feature`, "Explicit background and MCP grants keep a child in the background" in `features/agent/frontmatter.feature`). Check wording: those scenarios show granted agents launching under the current `openUi` default, not the failure.

Verify: `! grep -rn "pi-subagents-child-identity\|hooks-spawn-end-to-end" docs`.

---

### Deleted files

`git rm test/integration/hooks-spawn-end-to-end.test.ts` (Plan A) and `git rm test/integration/pi-subagents-child-identity.test.ts` (Plan B); each plan lists its file in `files_deleted` frontmatter. Research measured: no helper becomes dead; fallow, typecheck, `check:features`, `test:corresponding` pass with both gone.

## Shared Patterns

### Deliberate-break record in SUMMARY.md
**Source:** `.planning/milestones/behavioral-gaps-phases/04-posttoolusefailure-hooks/04-02-SUMMARY.md` lines 45-54
**Apply to:** both plans' SUMMARY.md (one bullet per break E1-E5 / E6-E11, each with site, change, command, scenarios that failed)
```markdown
## Red proofs

All under the adapter profile; every break was reverted from a backup, and `git status --porcelain -- extensions/` printed nothing afterwards.

- Break (a), the split line swapped: R2 failed (the `after` PostToolUse hook ran) and R3 failed (assertion on the runs table). A first run of this break failed both scenarios on Pi startup timeouts under load (`function timed out ... 90000 milliseconds`), so it was rerun; the rerun failed both on assertions.
- Break (b), the matcher callback always true: R2 failed with the `other` (`Write`) hook in the runs.
- R4, `sendToolContext` removed from the tool-result closure: R4 failed (the context row missing).
```
Followed by a `## Checks` section listing each command and its exit/count (same file, lines 56-61). Note the contrasting wording in `.planning/milestones/test-backlog-phases/03-reachable-agent-collision-contract/03-04-SUMMARY.md:53` ("No deliberately broken production implementation was introduced") - used when no break was run; not this phase's case. Also required: `## Threat Flags` (AGENTS.md). Builtin runs of untagged features record "0 scenarios selected (DUAL-02)".

### Break mechanics
**Source:** RESEARCH.md Pattern 1 and break maps: one exact replacement, run focused `npm run test:cucumber:profile -- --profile <p> <file:line...>` under the non-DAC env, restore with `git checkout -- <file>` in an EXIT trap, confirm `git status --porcelain` clean. Never commit a break.

## No Analog Found

None.

## Metadata

**Analog search scope:** `features/lib/`, `features/plugin/`, `docs/`, `.planning/milestones/*-phases/**/*-SUMMARY.md`
**Files scanned:** ~10
**Pattern extraction date:** 2026-11-21
