---
phase: 05-hook-tool-names
plan: "03"
subsystem: hooks
tags: [hooks, mcp, builtin-mcp, cucumber, docs]

requires:
  - phase: 05-hook-tool-names
    provides: "05-01: the built-in tool identity in dispatch and if-field, features/hook/mcp-tool-names.feature with the shared @mcp scenario, and the profile-aware call step"
provides:
  - "features/lib/hook-mcp-tool-server.ts: HOOK_MCP_TOOL_SERVER, a stdio MCP server whose one tool is named by its argument"
  - "the step `pi's mcp.json configures the server {string} with the hooks' stub mcp tool {string}` in features/step_definitions/hook/tool-use.steps.ts"
  - "the D-P5-09 @builtin-only fold scenario and the D-P5-03 @mcp notice scenario in features/hook/mcp-tool-names.feature"
  - "docs/hooks-compatibility.md: built-in MCP tool names, the tool-segment fold, the cut-name gap, and the proxy rule's scope (D-P5-14)"
affects: [05-04]

actuals:
  tokens: 10300
  tasks: 2
  commits: 3
plan_head_before: a9b62be48a21f720b12aab108504d66bcce16c19
plan_head_after: 429a239196cacd7d5600fc5f87fb1ffa617e001e

tech-stack:
  added: []
  patterns:
    - "A Pi mcp.json stand-in: a handler-table stdio server with its own chunk splitter, no log and no pid file, started through `direct` exposure so Pi waits for it before the first prompt"

key-files:
  created:
    - features/lib/hook-mcp-tool-server.ts
  modified:
    - features/step_definitions/hook/tool-use.steps.ts
    - features/hook/mcp-tool-names.feature
    - docs/hooks-compatibility.md

key-decisions:
  - "The fold scenario calls Pi's direct tool name at once; Pi declared the direct server's tool before the first prompt, so the tool_search fallback of research A3 was not needed"
  - "The mcp.json step refuses a started profile Pi and removes its file on release, in addition to the `wx` flag and the sandbox reset"

patterns-established:
  - "A user-configured built-in MCP server in a scenario: write `{agent dir}/mcp.json` after the install and before `pi runs with the scripted model and the mcp implementation`"

requirements-completed: [MHK-01, MHK-02]

coverage:
  - id: D1
    description: "Under Pi's built-in MCP, hooks on mcp__echo-server__echo-text and mcp__echo-server__echo_text both run on the mcp.json tool echo-text of echo-server, and see mcp__echo-server__echo_text"
    requirement: MHK-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature (seed 656563)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A PreToolUse hook's system message on a plugin MCP tool shows PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: <text> under both implementations"
    requirement: MHK-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature (seed 407119)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature (seed 844005)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/hooks-compatibility.md states the built-in names, the fold, the cut-name gap, and the proxy rule's scope, citing the scenario files"
    requirement: MHK-02
    verification:
      - kind: other
        ref: "pre-commit run --files docs/hooks-compatibility.md (mdformat, markdownlint) and the plan's grep criteria"
        status: pass
    human_judgment: true
    rationale: "Whether the prose is accurate and readable for plugin authors is a reading judgment; no test asserts documentation wording"

duration: 55min
completed: 2026-11-04
status: complete
---

# Phase 5 Plan 03: Built-in MCP tool names in hooks, pinned and documented Summary

**A Pi `mcp.json` stub server with a dashed tool pins the one naming divergence under Pi's built-in MCP (hooks see `mcp__echo-server__echo_text`: server as registered, tool segment folded, Pi gap D-MB-08), an `@mcp` scenario pins the `PreToolUse:<Claude name> says:` notice under both implementations, and `docs/hooks-compatibility.md` states the built-in names, the fold, the cut-name gap, and the proxy rule's scope.**

## Performance

- **Duration:** about 55 min
- **Started:** 2026-11-04 (worktree base a9b62be)
- **Completed:** 2026-11-04
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `features/lib/hook-mcp-tool-server.ts`: a stdio JSON-RPC server with a method-to-handler `Map`, its own splitter of `data` chunks into lines, no request log, and no pid file. It lists one tool named by its argument (input `{ text: string }`), answers `tools/call` with `<tool>:<text>`, answers other requests with `{}`, ignores notifications, and exits when stdin ends. It imports only `node:url`. `fallow dupes` finds no clone group with the frozen `mcp-stub-server.ts`.
- The `mcp.json` step writes `{agent dir}/mcp.json` with the one server (`process.execPath`, `[HOOK_MCP_TOOL_SERVER, <tool>]`, `exposure: "direct"`) using the `wx` flag, refuses a started profile Pi, removes the file on release, and reads it back.
- `@builtin-only` scenario "A hook on a built-in tool matches the server as Pi registered it and sees the tool segment folded (MHK-01, D-MB-08)": both `claude-name` and `folded-tool` run once, each seeing `mcp__echo-server__echo_text`.
- `@mcp` scenario "A hook's notice on a plugin MCP tool names the tool as Claude Code does": one info notice, `PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: checked the stub`, under both profiles.
- `docs/hooks-compatibility.md`: the MCP literal and server-prefix rows, the prose after the unmapped list, a new built-in paragraph (names, fold, cut and hash, the whole-name gap), the proxy rule's scope (MHK-02, `*` hooks also run on `tool_search`), and the two `if` rows. It cites `features/hook/mcp-tool-names.feature` and `features/hook/tool-use.feature`.

## Task Commits

1. **Task 1: A hook on a built-in tool sees the server segment with "-" and the tool segment folded** - `9309479` (test)
2. **Task 2: The notice scenario** - `7af72dd` (test); **the compatibility doc** - `429a239` (docs)

**Plan metadata:** the commit that adds this SUMMARY (docs).

## Files Created/Modified

- `features/lib/hook-mcp-tool-server.ts` - the `mcp.json` stub server whose one tool is named by its argument
- `features/step_definitions/hook/tool-use.steps.ts` - the `mcp.json` step (existing steps byte for byte; `@fileoverview` and imports extended)
- `features/hook/mcp-tool-names.feature` - the fold and notice scenarios; description now says "stub MCP servers"
- `docs/hooks-compatibility.md` - the built-in MCP statements (D-P5-14)

## Red proofs

Procedure per commit: `git status --porcelain` empty; `git restore --source=640419724c48a60c7bb469acf0fde6f3a6ea7852 --worktree -- extensions/pi-claude-marketplace/bridges/hooks extensions/pi-claude-marketplace/domain/components/hooks`; `rm -rf /tmp/jiti`; run; `git restore --source=HEAD --worktree -- <same paths>`; `git status --porcelain` empty (checked both times). No commit between the restores.

| After     | Profile | Scenario                                                                                                              | Result | Seed   | First failing step and diff                                                                                                                                          |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9309479` | builtin | A hook on a built-in tool matches the server as Pi registered it and sees the tool segment folded (MHK-01, D-MB-08)   | FAIL   | 953400 | `Then the hooks record these runs in any order:`; actual `[]` (no run), expected the `claude-name` and `folded-tool` PreToolUse rows with `mcp__echo-server__echo_text` |
| `7af72dd` | builtin | A hook's notice on a plugin MCP tool names the tool as Claude Code does                                               | FAIL   | 740521 | `Then the hooks show the user these messages:`; actual `[]`, expected one info notice `PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: checked the stub`     |
| `7af72dd` | adapter | same                                                                                                                  | PASS   | 832666 | - (parity guard)                                                                                                                                                     |

The fold scenario is `@builtin-only`, so the adapter profile does not run it.

## Verification

- Task 1: builtin `features/hook/mcp-tool-names.feature`, 2 scenarios passed (seed 412216); tracer gate re-run after the red proof, 2 passed (seed 656563).
- Task 2: builtin 3 scenarios passed (seed 407119); adapter 2 scenarios passed (seed 844005).
- `npm run check:static` (typecheck, lint, lint:workflows, fallow with dead code, cycles, health, dupes, boundaries, and the rule pack, format:check, test:corresponding, check:features) passed on the Task 1 tree and on HEAD; `check:features` passed on the Task 2 scenario commit.
- `pre-commit run --files` passed for every commit's files (mdformat realigned the doc tables once; markdownlint-cli2 0 issues).
- Acceptance greps all PASS: stub file exists; `HOOK_MCP_TOOL_SERVER` 2 in the step module; `mcp__echo-server__echo_text` 3 in the feature; `readline|appendFile|\.pid` 0 in non-comment stub lines (frozen stub: 6); the 05-02 step text 1; `says: checked the stub` 1; `@mcp` 2 and `@builtin-only` 1; `MHK-02` 1, `D-MB-08` 1, `mcp-tool-names.feature` 1, `Pi's built-in MCP` 7 in the doc; no diff to `CHANGELOG.md`, `README.md`, `README.es.md`, `docs/mcp-compatibility.md`; no harness import of `bridges/hooks/**` or `domain/components/hooks/**`; the `@mcp` scenario does not name pi-mcp-adapter.
- The plan-level gate (`npm run check` with both profiles on the merged wave) belongs to the orchestrator.

## Decisions Made

- The direct call worked: Pi declared the `direct` server's tool before the first prompt (research A3 held), so the scenario has no `tool_search` row.
- `fieldsOf` copies an object through `Object.fromEntries(Object.entries(...))`, so the stub has no type guard shaped like the frozen stub's `isRecord`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree sandbox refused compound shell commands that name `git`; each git step ran as its own command.
- The coordinator warned that a builtin scenario that starts a new Pi session with a registered server leaks one stdio connection. Neither new scenario starts a new session; each starts the profile Pi once.

## User Setup Required

None - no external service configuration required.

## Parent lines (for 05-04)

None. No frozen file needed a change. The CHANGELOG and README lines for built-in hook tool names stay with the parent (Phase 6, MDOC-02).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-09 is mitigated as planned: the step writes only `{agent dir}/mcp.json` of the sandbox with `wx` and removes it on release, and the stub speaks stdio only and exits when Pi closes its stdin.

## Dubious Choices

- **P5-03-DC-01 (Low).** The doc cites `features/hook/tool-use.feature` for the proxy rule "under each MCP implementation", but on this branch that file still holds only the adapter half. The built-in half arrives with 05-02, which runs in parallel in this wave. Alternatives: cite only `mcp-tool-names.feature`, or leave the citation for 05-04. Dubious because the citation is true only after the wave merges; the plan asks for it.
- **P5-03-DC-02 (Low).** The `mcp.json` step does more than the plan lists: it asserts that no profile Pi has started, and it removes the file on release. The plan relies on `wx` and the next scenario's sandbox reset. Alternatives: `wx` and the reset only. Dubious only as extra surface: it mirrors the frozen stand-in step and fails a misplaced step in its own `Given`.
- **P5-03-DC-03 (Low).** The notice scenario compares only the notices, not the hook runs (the messages step marks the turn compared). Alternatives: also state the runs table. Dubious because a plausible wrong label still fails the notice row, but a wrong stdin name would not; the shared `@mcp` scenario of 05-01 already pins the stdin name under both profiles.
- **P5-03-DC-04 (Low).** The doc gives the example `echo-text` of `echo-server` -> `mcp__echo-server__echo_text`, taken from the scenario, and words the cut as "longer than 64 characters, Pi cuts it and ends it with a hash" without the 55-character detail. Alternatives: state Pi's exact cut rule. Dubious because it is less exact than the code; the exact rule is Pi's own, not this project's contract.

## Next Phase Readiness

- 05-04 can run the phase gate on the merged tree; the fold scenario needs no other phase's work.
- After the wave merges, `features/hook/tool-use.feature` holds the D-P5-11 pair that the doc cites.

## Self-Check: PASSED

- `features/lib/hook-mcp-tool-server.ts` exists; commits `9309479`, `7af72dd`, and `429a239` are ancestors of HEAD; `git rev-list --count a9b62be..HEAD` is 3 before this SUMMARY's commit.

---
*Phase: 05-hook-tool-names*
*Completed: 2026-11-04*
