---
phase: 01-duplicate-integration-files
plan: "02"
subsystem: testing
tags: [cucumber, pi-subagents, hooks, child-identity, integration-rescope]

requires: []
provides:
  - "@mcp scenario: a real pi-subagents child of an ordinary agent with an empty body runs in the background and hooks Bash and the failing Read with its own identity"
  - "parseRealChildAgents reads an optional body column"
  - "red proofs E6 to E11 against the five real-child scenarios"
  - "deletion of test/integration/pi-subagents-child-identity.test.ts, docs citing scenarios"
affects: [integration-rescope, subagent-child.feature, mcp-compatibility, hooks-compatibility]

actuals:
  tokens: 9600
  tasks: 3
  commits: 2
plan_head_before: f67fe6c95f8990300637126823536c5d85619baf
plan_head_after: 850d727e06d9418155468f6a30fcdaef05f1e86f

tech-stack:
  added: []
  patterns:
    - "Optional table column read by header detection, with tableRecords kept strict"

key-files:
  created: []
  modified:
    - features/lib/real-subagent-child.ts
    - features/plugin/subagent-child.feature
    - docs/mcp-compatibility.md
    - docs/hooks-compatibility.md
  deleted:
    - test/integration/pi-subagents-child-identity.test.ts

key-decisions:
  - "RealChildAgent and ConcurrentChildLaunch stay exported: exported signatures name them, and private-type-leaks is an error"
  - "Break detections are judged on cucumber's summary-format failure list (`N) <title> # <path>:<line>`), because that formatter prints no `Scenario: ` line"
  - "The fallow audit weakened-tests warning on the deleted file is left for the milestone; .fallowrc.json is unchanged"

patterns-established:
  - "Break helper: roots itself with git rev-parse --show-toplevel, refuses a dirty extensions/, restores with git checkout in an EXIT trap, and logs root=, the diff, exit=, and restored="

requirements-completed: ["ITDUP-02"]

coverage:
  - id: D1
    description: "New @mcp scenario of a real empty-body ordinary child, green under adapter and builtin"
    requirement: "ITDUP-02"
    verification:
      - kind: e2e
        ref: "features/plugin/subagent-child.feature:569 (adapter: 60 scenarios passed with frontmatter.feature; builtin: 17 passed; builtin alone: 1 scenario (1 passed))"
        status: pass
    human_judgment: false
  - id: D2
    description: "Identity breaks E7, E8, E9 fail the new scenario (E7 under both profiles); E6, E10, E11 fail their required scenarios"
    requirement: "ITDUP-02"
    verification:
      - kind: e2e
        ref: "break logs E6-adapter, E7-adapter, E7-builtin, E8-adapter, E9-adapter, E10-adapter, E11-adapter in the plan scratch folder; t2-verify.sh failed-list rc=0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Integration file deleted; docs cite scenarios; check:static and fallow audit (only weakened-tests) pass"
    requirement: "ITDUP-02"
    verification:
      - kind: other
        ref: "npm run check:static exit 0; fallow audit verdict=warn with only weakened-tests on the deleted file; t3-verify.sh rc=0"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-11-21
status: complete
---

# Phase 1 Plan 02: Real empty-body child scenario and deletion of the child-identity integration file Summary

**A real pi-subagents child of an ordinary agent with an empty body now runs as an `@mcp` cucumber scenario under both profiles, six deliberate breaks proved the real-child scenarios guard the child's hook identity, and `test/integration/pi-subagents-child-identity.test.ts` is deleted with the docs citing scenarios instead.**

## Performance

- **Duration:** about 23 min
- **Started:** 2026-11-21T14:28:25Z
- **Completed:** 2026-11-21T14:51Z
- **Tasks:** 3
- **Files modified:** 4 changed, 1 deleted

## Accomplishments

- `parseRealChildAgents` reads either `name, background, tools, tool calls` (default body "Run the tools the task names.") or `name, background, tools, body, tool calls` (body from the cell, empty included). Any other header throws through the strict `tableRecords`.
- New scenario at `features/plugin/subagent-child.feature:569`, "A real child of an ordinary agent with an empty body runs in the background and hooks its tools with its own identity", 23 added lines, no other line of the file changed.
- Red proofs E6 to E11 recorded below. Every break was restored.
- The docs cite the scenarios, and the integration file is gone.

## Task Commits

1. **Task 1: run a real empty-body child through the new scenario under both profiles** - `faf0aa8` (test)
2. **Task 2: record the identity breaks E6 to E11** - no commit (changes no tracked file)
3. **Task 3: point the docs at the scenarios and delete the duplicate integration file** - `850d727` (test)

## Red proofs

Green runs of Task 1 (on the tree that became `faf0aa8`; the pre-commit fixers changed nothing):

- Adapter, `features/plugin/subagent-child.feature features/agent/frontmatter.feature`, `--parallel 2`: exit 0, `60 scenarios (60 passed)`, `837 steps (837 passed)`.
- Builtin, same two files: exit 0, `17 scenarios (17 passed)`, `204 steps (204 passed)`.
- Builtin, `features/plugin/subagent-child.feature:569` alone: exit 0, `1 scenario (1 passed)`.

Detector set for every break: `subagent-child.feature:542`, `:569` (new), `:591` (concurrent, no tag), `agent/frontmatter.feature:410`, `:423`. Each break ran through `$D/break.sh <id> <profile> <file> <old> <new> <detectors>`, which ran `npm run --silent test:cucumber:profile -- --profile <profile> --parallel 2 <detectors>` with the non-DAC prefix. Every log starts with `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-af3e6cfb9254abecf`, holds the exact `git diff`, and ends with `exit=1` and `restored=clean`. No log holds a cucumber step timeout, so no run was repeated. Every failure is an `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal` from a whole-table compare. Each break was restored with `git checkout -- <file>`, and `git status --porcelain -- extensions/` printed nothing after each one.

- **E6, adapter**, `bridges/hooks/runtime.ts:55`: `...\/>\n\n/;` became `...\/>\n\n(?=[\s\S])/;`. Failed: `:591` "Concurrent companion children keep separate hook identities", at "the real children's hooks record these runs in any order, and no main-session run names a child:" (the `demo:alpha` rows are missing). Passed: `:542`, `:569`, `frontmatter.feature:410`, `:423` (5 scenarios, 4 passed, 1 failed). The new scenario passed under E6.
- **E7, adapter**, `bridges/hooks/payloads/post-tool-use-failure.ts:78-80`: the three lines of the `ctx.childIdentity === undefined ? {} : { agent_type, agent_id }` spread were deleted. Failed: `:569`, `frontmatter.feature:423`, `:542`, each at the real-children hooks Then (the `PostToolUseFailure | Read` identity rows are missing). Passed: `:591`, `frontmatter.feature:410` (no failing call).
- **E7, builtin**, same change. Failed: `:542`, `:569`, `frontmatter.feature:423`, at the same Then. Passed: `frontmatter.feature:410`. 4 scenarios selected (the `@mcp` ones); `:591` has no tag.
- **E8, adapter**, `bridges/hooks/translation-context.ts:141`: `sessionId: kept?.root?.sessionId ?? ownSessionId,` became `sessionId: ownSessionId,`. Failed: `:542`, `frontmatter.feature:423`, `:410`, `:569`, at the real-children hooks Then (the `session` cell reads the child's own session `first`, not `main`). Passed: `:591`.
- **E9, adapter**, `translation-context.ts:82`: `if (identity.kind !== "known") {` became `if (identity.kind === "known" || identity.kind !== "known") {`. Failed: all five, at the real-children hooks Then.
- **E10, adapter**, `bridges/agents/convert.ts:1092`: `...((backgroundForMcp || isTrueBackground(raw.background)) && { async: true }),` became `async: backgroundForMcp || isTrueBackground(raw.background),`. Failed: `:569` and `frontmatter.feature:410`, at "pi-subagents ran the real children like this:" (mode `foreground`, no runner process, no session). Passed: `:542`, `:591`, `frontmatter.feature:423`.
- **E11, adapter**, same line: became `async: true,`. Failed: `frontmatter.feature:423` at "pi-subagents ran the real children like this:", whose diff shows the `demo:plain` row as `background` where `foreground` is expected. Passed: the other four.

E6 finding: the identity reader has no body-specific path. In a real background launch, pi-subagents 0.88.1 appends its intercom section after an empty body, so the new scenario's tag has text after it and passes under E6. Only the concurrent scenario's empty-body `demo:alpha` session (append mode) reaches the bare tag, and E6 fails only that scenario.

## Case map

| Integration case | Scenario | Profiles | Breaks that failed it |
| --- | --- | --- | --- |
| detached background and MCP children (adapter, builtin) | `subagent-child.feature:542` "A real background child runs its plugin tool hooks and completes" | both | E7 (adapter and builtin), E8, E9 |
| ordinary empty-body child under pi-subagents' default (adapter, builtin) | `subagent-child.feature:569`, the new scenario | both | E7 (adapter and builtin), E8, E9, E10 |
| ordinary agent under a foreground default (adapter) | `agent/frontmatter.feature:423` "Explicit background and MCP grants keep a child in the background", row `demo:plain` | both | E7 (adapter and builtin), E8, E9, E11 |
| concurrent children of one runner process (adapter) | `subagent-child.feature:591` "Concurrent companion children keep separate hook identities" | adapter | E6, E9 |

`frontmatter.feature:423` also failed under E7 and E8, beyond the research table, because its granted and background children call tools whose identity those breaks remove.

## Checks

Node `v24.22.3` (CONTEXT said v22.23.5; this container reports v24.22.3). `<N>` = 569, `<C>` = 591.

| Check | Tree | Exit |
| --- | --- | --- |
| Task 1 verify 1: adapter, both feature files | working tree of `faf0aa8` | 0 |
| Task 1 verify 2: builtin, both feature files | working tree of `faf0aa8` | 0 |
| Task 1 verify 3: builtin, `subagent-child.feature:569`, `1 scenario (1 passed)` | working tree of `faf0aa8` | 0 |
| Task 1 verify 4: `npm run check:static` (after a lone `npm run lint`) | working tree of `faf0aa8` | 0 |
| Task 1 commit hook, `npm run check:commit` | `faf0aa8` | Passed |
| Task 2 verify as written (`Scenario: ` pattern) | `faf0aa8` | 1 (format mismatch, see Deviations) |
| Task 2 verify on the failure list (`$D/t2-verify.sh failed-list`) | `faf0aa8` | 0 |
| Task 3 verify 1: doc citations | `850d727` | 0 |
| Task 3 verify 2: `pre-commit run --files` the two docs (mdformat and markdownlint-cli2 ran and passed) | `850d727` | 0 |
| Task 3 verify 3: `npm run check:static` (after a lone `npm run lint`) | staged tree of `850d727` | 0 |
| Task 3 verify 4: `fallow audit --base f67fe6c` | staged tree and again on `850d727` | 0 |
| Task 3 verify 5: deletion committed, no reference outside `.planning/`, no `extensions/` change | `850d727` | 0 |

Audit line: `verdict=warn {"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0} risks=weakened-tests:test/integration/pi-subagents-child-identity.test.ts`.

`git diff f67fe6c HEAD -- extensions/` and `git status --porcelain -- extensions/` both print nothing.

## Helpers

The deleted file imported `FIXTURE_TIMEOUT_MS`, `runRealSubagentChild`, and `runConcurrentRealSubagentChildren`, which `features/step_definitions/plugin/subagent-hooks.steps.ts` still imports, and the types `HookRun` and `McpProfile`, which several step modules and support files import. `RealChildAgent` and `ConcurrentChildLaunch` lose their last outside importer, but `parseRealChildAgents`, `parseConcurrentLaunches`, `RealChildOptions.agents`, and `ConcurrentChildrenOptions.generations` name them in exported signatures. Removing `export` would leak private types, which `.fallowrc.json` treats as an error, so both stay exported. Fallow, `check:features`, and the typecheck passed without the file, and the audit found no dead code.

## Issues for the milestone

- `fallow audit` gives a `warn` verdict whose only finding is `weakened-tests` (`removed-tests`, "test cases: 4 -> 0") on `test/integration/pi-subagents-child-identity.test.ts`. The CI job `fallow-audit` in `.github/workflows/lint.yml` fails on a `warn` verdict. Fallow names the remedy: set `weakened-tests` to `off` for that path in an `overrides` entry of `.fallowrc.json`. This plan changed no configuration; the milestone decides.
- The Markdown hooks did not report "(no files to check)": mdformat and markdownlint-cli2 ran on both docs and passed, so no extra main-checkout pre-commit run is needed for them.

## Decisions Made

- Kept `RealChildAgent` and `ConcurrentChildLaunch` exported (see Helpers).
- Applied the proposed doc texts. The `simple-english` pass split the hooks paragraph's proposed semicolon into two sentences ("... `CLAUDE_CODE_SESSION_ID`. In the second, ..."). All titles and paths are exact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 verify pattern does not match the cucumber formatter**
- **Found during:** Task 2
- **Issue:** The verify's `ok()` greps `Scenario: .*(<path>:<line>)`. The `summary` formatter of `cucumber.json` prints failures as `  1) <title> # <path>:<line>` and no `Scenario: ` line, so the literal verify fails on every log although each log shows the required failure.
- **Fix:** `$D/t2-verify.sh failed-list` runs the same checks (root, `exit=[1-9]`, `restored=clean`, no `function timed out`, clean `extensions/`) with the pattern `^  [0-9]+\) .* # features/.*(<path>:<line>)`, which matches the failed-scenario list only. It exits 0. The literal form exits 1 at `E6-adapter`.
- **Files modified:** none in the repository (scratch script only)
- **Committed in:** none

**2. [Rule 3 - Blocking] Plan commit ledger kept in the scratch folder**
- **Found during:** Task 1 commit
- **Issue:** The worktree sandbox refused a write under the worktree's git directory, so the `gsd-plan-head-before-01-02` ledger file could not be created there.
- **Fix:** `$D/plan-base` (written before Task 1) is the ledger. `git rev-list --count f67fe6c..HEAD` is 2.
- **Committed in:** none

Tracer gate: the Task 1 verify ran once, after the edits and before the commit, on bytes the commit left unchanged. It was not run a second time before the breaks.

No break gave a result that contradicts `<context>`. `frontmatter.feature:423` failing under E7 and E8 is extra detection.

**Total deviations:** 2 auto-fixed (both Rule 3, verification plumbing only). **Impact:** none on product or test code.

## Issues Encountered

None beyond the deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The post-merge `npm run check` of the wave, with the non-DAC prefix, is the full verdict. The `fallow-audit` CI decision is open for the milestone.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/lib/real-subagent-child.ts, features/plugin/subagent-child.feature, docs/mcp-compatibility.md, docs/hooks-compatibility.md
- ABSENT as intended: test/integration/pi-subagents-child-identity.test.ts
- FOUND commits: faf0aa8, 850d727

---
*Phase: 01-duplicate-integration-files*
*Completed: 2026-11-21*
