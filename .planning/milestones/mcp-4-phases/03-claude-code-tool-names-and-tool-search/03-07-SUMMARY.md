---
phase: 03-claude-code-tool-names-and-tool-search
plan: 07
subsystem: agents-bridge
tags: [agents, mcp-tool-names, pi-subagents]
status: complete

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-01 generatedMcpServerKey; 03-04 resolved.mcpServers holding only the supported servers; 03-05 key collisions refused"
provides:
  - "StageAgentsInput.mcpServerNames and the matching convertAgent input member"
  - "bridges/agents/convert.ts: a module-private MCP grant table (key plus Claude prefix, longest prefix first) mapping mcp__ names of written servers to pi-subagents mcp: entries"
  - "disallowedTools handling for MCP names on the explicit and omitted tools: paths, and the async: true conversion warning"
  - "README 'Customizing generated agents': the third conversion rule and a plugin-key override example"
affects: [03-09]

actuals:
  tokens: 9331
  tasks: 3
  commits: 1
plan_head_before: bd70c5c41a01341318c359e95e2f061e517b326b
plan_head_after: 8b710fe4e1412510d7eea88076ce83cad5efac57

tech-stack:
  added: []
  patterns:
    - "The agents bridge derives each server's Claude tool-name prefix from generatedMcpServerKey (mcp__ plus the key without its trailing _); no second normalization"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - tests/bridges/agents/convert.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - README.md

key-decisions:
  - "Longest-prefix matching picks the first written server whose Claude prefix the token starts with (grants sorted by prefix length); if that server's tool part is empty or holds '/', the token is dropped and no shorter prefix is tried"
  - "A tool part holding '/' is not mapped: Claude Code never puts '/' in a tool name, and pi-subagents splits mcp: entries on the first '/', so mapping it would grant a different tool"
  - "The cannot-narrow warning fires only when the whole-server grant survives the disallow filter; a whole-server disallow that removes the grant suppresses it"

patterns-established:
  - "A conversion that needs install-wide facts (the written server set) takes them as an optional convertAgent input threaded through StageAgentsInput from every orchestrator call site, derived from the resolver because the agents phase runs before the mcp phase"

requirements-completed: [ANAME-02]

duration: 16min
completed: 2026-10-06
---

# Phase 3 Plan 07: Agent MCP Tool Names Summary

**A plugin agent's `tools:` and `disallowedTools:` entries that name its own plugin's MCP tools in Claude Code form now become pi-subagents `mcp:` grants, narrowed or dropped exactly as written, with an `async: true` launch warning that is never injected into the frontmatter.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-10-06T18:39Z
- **Completed:** 2026-10-06T18:55Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `convert.ts` builds a grant table from the plugin name and the written server names. `mcp__plugin_<p>_<s>__<tool>` becomes `mcp:plugin_<p>_<s>_/<tool>`. `mcp__plugin_<p>_<s>` and `mcp__plugin_<p>_<s>__*` become `mcp:plugin_<p>_<s>_`. Every other `mcp__` name, an empty tool part, and a tool part that holds `/` keep today's drop and the `dropped tools:` warning.
- Explicit `tools:` path: a per-tool disallow removes the same `mcp:` entry. A whole-server disallow removes `mcp:<key>` and every `mcp:<key>/...` entry. A per-tool disallow under a surviving whole-server grant warns that it cannot narrow it.
- Omitted `tools:` path: a per-tool disallow of a written server joins `excludeTools` under its Claude name. Whole-server and unmatched MCP disallows join the existing cannot-narrow warning.
- Any final explicit list that holds an `mcp:` entry gets one warning that pi-subagents runs MCP tools only in background launches, so the agent needs `async: true`. No `async` field is emitted, and `frontmatter.ts` is unchanged.
- Install (`agentsPhase`), update (`update-swap.ts`) and reinstall (`reinstall-replace.ts`) pass `mcpServerNames: Object.keys(<resolved>.mcpServers)`, so a server left out by `{unsupported mcp}` is never granted.
- The README "Customizing generated agents" section now lists three rules and the `async: true` requirement. Its override example uses `mcp:plugin_foo_github_`.

## Task Commits

The plan asked for one commit for all three tasks (AGENTS.md Git rules), so the task work landed together:

1. **Tasks 1-3: grant mapping, disallow and async handling, staging paths, README** - `8b710fe4` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` - grant table, `matchMcpGrant`, disallow sets, MCP warnings, `convertAgent` input `mcpServerNames`
- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - `StageAgentsInput.mcpServerNames`
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` - passes `mcpServerNames` to `convertAgent`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, `update-swap.ts`, `reinstall-replace.ts` - pass the written server names
- `tests/bridges/agents/convert.test.ts` - 11 `ANAME-02` cases (one per behavior row, the slash guard, and two byte-identity rows)
- `tests/bridges/agents/stage.test.ts` - stage pass-through and formatted async warning
- `tests/orchestrators/plugin/install-outcome.test.ts` - end-to-end mapping and the partial-install left-out server
- `README.md` - third conversion rule, override example

## Verification

- Task 1: `npm run typecheck` clean; `node --test` convert + stage passed; `--test-name-pattern="^ANAME-02"` install-outcome run passed (1, then 2 cases after Task 3). The tracer was re-run end to end before expansion.
- Task 2: convert + stage 108 pass / 0 fail; `npm run test:coverage:direct -- convert.ts stage.ts` exit 0 (100%). A temporary mutation check confirmed that removing the prefix sort fails the longest-prefix case and removing the `/` guard fails the slash case. The source was restored before commit.
- Task 3: `TMPDIR=/var/tmp/mcp4-p3-07 npm run test:modules` exit 0; `npm run test:integration` exit 0; `npm run test:coverage:direct -- install-outcome.ts update-swap.ts reinstall-replace.ts` exit 0 (100%).
- `PRECOMMIT_EXIT=0` (last line of `tmp/p3-07-precommit.log`, clean on the first pass).
- `npx fallow audit --base bd70c5c4` exit 0: "No issues in 10 changed files". One inherited clone group (`bridges/agents/stage.ts` vs `bridges/skills/stage.ts`) is excluded by the audit gate and is not introduced here.
- Commit hook: `npm run check:commit` Passed on `8b710fe4` (Node v26.10.0).
- `git diff bd70c5c4 -- extensions tests | rg '^\+' | rg -c 'D-0[3]-[0-9]{2}'` printed nothing.
- Environmental skip: the two pi-subagents peer integration cases (`provenance-invisibility`, `skill-path-resolution`) skip because the global peer is pi-subagents 0.47.1, below the 0.74.0 floor.
- Focused task verification passed; full phase/PR verification is still pending.

## Decisions Made

See `key-decisions` in the frontmatter. The match takes the longest prefix first. A tool part that holds `/` is never mapped. The cannot-narrow warning fires only when the whole-server grant survives the disallow filter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A tool part holding `/` is not mapped**
- **Found during:** Task 1
- **Issue:** pi-subagents splits `mcp:<server>/<tool>` on the first `/`. So `mcp__plugin_acme_db__a/b` would have become `mcp:plugin_acme_db_/a/b` and granted tool `a`, which the author did not name (T-03-15). Claude Code never produces such a tool name.
- **Fix:** `matchMcpGrant` drops a token whose tool part holds `/`. A convert case pins the drop.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts`, `tests/bridges/agents/convert.test.ts`
- **Commit:** `8b710fe4`

**2. [Adaptation] Install-outcome cases use the harness plugin `empty` rather than `acme`**
- **Found during:** Task 1
- **Issue:** `seedPlugin` in `install-outcome.test.ts` fixes the plugin name to `empty`, and changing it would touch every case in the file.
- **Fix:** The two install-outcome cases use `mcp__plugin_empty_db__query` / `mcp:plugin_empty_db_/query`. The convert and stage cases use `acme` as planned. The partial case's `live` server uses `type: "ws"` with a URL.
- **Commit:** `8b710fe4`

**3. [Adaptation] Emitter form of `tools:`**
- The plan's example `read, mcp:plugin_acme_db_/query` is rendered by the emitter as `read,mcp:plugin_..._/query` (comma, no space). The tests assert the emitter's exact form, as the plan asked.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-15 (only written servers are granted) is asserted by the convert drop cases and the partial-install case. T-03-16 (a disallow never weakens without a trace) is asserted by the four disallow cases.

## Next Phase Readiness

- Plan 03-09 documents the residual divergence for raw MCP tool names whose characters Claude Code normalizes (research Pitfall 9). It may also want to cross-reference the README third rule from `docs/mcp-compatibility.md`.
- Mapping a dependency plugin's MCP servers stays deferred (CONTEXT Deferred Ideas).

## Self-Check: PASSED

- FOUND: all 10 modified files listed in key-files
- FOUND: commit `8b710fe4` (ancestor of HEAD)
