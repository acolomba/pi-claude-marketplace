---
phase: 93-substitution-completion
plan: 02
subsystem: api
tags: [substitution, claude-vars, commands-bridge, agents-bridge, orchestrator, project-dir]

# Dependency graph
requires:
  - phase: 93-substitution-completion (plan 01)
    provides: extended substituteClaudeVars four-variable contract (pluginRoot, pluginData, skillDir, projectDir) and the skills-bridge projectDir wiring
provides:
  - Commands bridge feeds scope-gated projectDir into substituteClaudeVars (no skillDir)
  - Agents bridge threads scope-gated projectDir through convertAgent (no skillDir)
  - StageCommandsInput.cwd and StageAgentsInput.cwd optional fields
  - install/reinstall/update orchestrators thread cwd into all nine skills/commands/agents stage inputs
  - End-to-end proof that a project-scope install delivers ${CLAUDE_PROJECT_DIR} into materialized skill/command/agent files
affects: [substitution, commands, agents, install, reinstall, update]

# Actuals (#2632)
actuals:
  tokens: 5900
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scope-gated projectDir: `locations.scope === 'project' ? cwd : undefined` at every non-skill substitute call site"
    - "Single scope+cwd meeting point per bridge (agents/stage.ts) computes projectDir once before convertAgent runs"
    - "Optional-cwd silent-miss closed by an orchestrator-level e2e test the compiler cannot enforce"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/bridges/commands/stage.test.ts
    - tests/bridges/agents/convert.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "Commands and agents receive NO skillDir; ${CLAUDE_SKILL_DIR} stays literal there because it is skill-scoped upstream"
  - "projectDir for commands/agents is the install cwd, scope-gated to project scope only (user-scope and absent-cwd pass through untouched, never an empty string)"
  - "cwd sourced per orchestrator: install.ts c.cwd, reinstall.ts input.cwd, update.ts args.cwd — mirroring the existing MCP threading in the same functions"

patterns-established:
  - "Scope-gated projectDir helper argument at every substitution call site"
  - "Orchestrator-level e2e test guards optional threading fields no compiler can enforce"

requirements-completed: [SUB-02]

coverage:
  - id: D1
    description: "Project-scope command substitutes ${CLAUDE_PROJECT_DIR} to cwd; user-scope keeps it literal; ${CLAUDE_SKILL_DIR} stays literal in both scopes"
    requirement: "SUB-02"
    verification:
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#SUB-02 project-scope command substitutes ${CLAUDE_PROJECT_DIR} to cwd; keeps ${CLAUDE_SKILL_DIR} literal"
        status: pass
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#SUB-02 user-scope command keeps ${CLAUDE_PROJECT_DIR} literal; other two substitute"
        status: pass
    human_judgment: false
  - id: D2
    description: "convertAgent substitutes ${CLAUDE_PROJECT_DIR} when projectDir set (project scope); leaves it literal when omitted (user scope); ${CLAUDE_SKILL_DIR} stays literal"
    requirement: "SUB-02"
    verification:
      - kind: unit
        ref: "tests/bridges/agents/convert.test.ts (SUB-02 projectDir present/absent + ${CLAUDE_SKILL_DIR} literal arms)"
        status: pass
    human_judgment: false
  - id: D3
    description: "End-to-end: a project-scope install materializes skill/command/agent files with ${CLAUDE_PROJECT_DIR} replaced by the install cwd; user-scope leaves it literal"
    requirement: "SUB-02"
    verification:
      - kind: e2e
        ref: "tests/orchestrators/plugin/install.test.ts#SUB-02: project-scope install substitutes ${CLAUDE_PROJECT_DIR} to the install cwd in skill, command, and agent files; keeps ${CLAUDE_SKILL_DIR} literal in command and agent"
        status: pass
      - kind: e2e
        ref: "tests/orchestrators/plugin/install.test.ts#SUB-02: user-scope install keeps ${CLAUDE_PROJECT_DIR} literal in skill, command, and agent files"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-08-03
status: complete
---

# Phase 93 Plan 02: Substitution Completion (commands, agents, orchestrator threading) Summary

**Project-scope ${CLAUDE_PROJECT_DIR} now resolves to the install cwd across commands, agents, and skills end-to-end by threading cwd from all three orchestrators into every stage input, with ${CLAUDE_SKILL_DIR} kept literal in commands/agents.**

## Performance

- **Duration:** ~18 min (continuation session)
- **Completed:** 2026-08-03
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Commands bridge substitute call feeds `{ pluginRoot, pluginData, projectDir: scope === "project" ? cwd : undefined }` (never skillDir), with `StageCommandsInput.cwd` added.
- Agents bridge threads a scope-gated projectDir through `convertAgent` — `agents/stage.ts` computes it once at the sole point where scope and cwd meet; `StageAgentsInput.cwd` and `convertAgent`'s `projectDir?` added.
- All nine skills/commands/agents stage-input constructions across install.ts (`c.cwd`), reinstall.ts (`input.cwd`), and update.ts (`args.cwd`) now thread `cwd`, mirroring the existing MCP threading.
- Orchestrator-level e2e test proves a project-scope install delivers `${CLAUDE_PROJECT_DIR}` = install cwd into materialized skill, command, and agent files, and that a user-scope install keeps it literal — closing the optional-cwd silent-miss gap a compiler cannot catch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Commands bridge — scope-gated projectDir** - `baa3f9bd` (feat)
2. **Task 2: Agents bridge — scope-gated projectDir through convertAgent** - `a1500568` (feat)
3. **Task 3: Thread cwd from all three orchestrators; prove end-to-end delivery** - `ea23bdcc` (feat)

_Tasks 1 and 2 were completed by a prior executor session; Task 3 was resumed and completed in this continuation._

## Files Created/Modified
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - feeds scope-gated projectDir at the substitute call
- `extensions/pi-claude-marketplace/bridges/commands/types.ts` - `StageCommandsInput.cwd`
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` - `convertAgent` gains `projectDir?`, consumed at the body substitute call
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` - computes scope-gated projectDir once, threads it into each convertAgent call
- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - `StageAgentsInput.cwd`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - `cwd: c.cwd` on skills/commands/agents stage inputs
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - `cwd: input.cwd` on the same three
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - `cwd: args.cwd` on the same three
- `tests/bridges/commands/stage.test.ts` - SUB-02 command scope-arm tests
- `tests/bridges/agents/convert.test.ts` - SUB-02 agent projectDir present/absent + skill-dir-literal tests
- `tests/orchestrators/plugin/install.test.ts` - SUB-02 end-to-end project-scope + user-scope delivery tests

## Decisions Made
- Commands/agents receive no skillDir, so `${CLAUDE_SKILL_DIR}` stays literal there (skill-scoped upstream). Consistent with the plan's flagged edge classification for SUB-02.
- projectDir is scope-gated to project scope; user-scope and absent-cwd paths pass through the helper unchanged (no empty-string substitution).

## Deviations from Plan

None - plan executed exactly as written. The uncommitted Task 3 threading inherited from the prior session matched the plan's `<action>` at all nine sites and typechecked; only the e2e test, verification, and commit remained.

## Issues Encountered
- `npm run check` exits 1 due to two pi-subagents integration tests (`provenance-invisibility`, `skill-path-resolution`) failing on a stale global peer (`pi-subagents@0.24.3`) resolved via `npm root -g`. This is the known environmental issue: both tests reference none of this plan's files and are unrelated to projectDir substitution. Every test in files this plan touches passes (193/193 across the three plan test files; 98/98 in the install orchestrator suite). Typecheck, lint, and format are green.

## Next Phase Readiness
- SUB-02 is fully delivered: project-scope skills, commands, and agents substitute `${CLAUDE_PROJECT_DIR}` to the install cwd; user-scope stays literal; `${CLAUDE_SKILL_DIR}` stays literal in commands/agents.
- No blockers introduced.

---
*Phase: 93-substitution-completion*
*Completed: 2026-08-03*
