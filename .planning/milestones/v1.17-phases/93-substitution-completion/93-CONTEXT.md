# Phase 93: Substitution completion - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The static `${...}` substitution set that the model reads in materialized
skill/command/agent content is completed: `${CLAUDE_SKILL_DIR}` resolves to a
skill's installed directory, and `${CLAUDE_PROJECT_DIR}` resolves for
project-scope installs (user-scope occurrences pass through untouched,
documented). Extends `shared/vars.ts::substituteClaudeVars` (today only
`${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}`) and its four call sites:
skills stage ×2 (description augmentation `bridges/skills/stage.ts:168` and
whole-file `:298`), commands stage (`bridges/commands/stage.ts:240`), agents
convert (`bridges/agents/convert.ts:530`). Previously-substituted variables
stay unchanged; disk mutations atomic (NFR-1); containment holds (NFR-10).

Requirements: SUB-01, SUB-02.

</domain>

<decisions>
## Implementation Decisions

### Locked by ROADMAP/REQUIREMENTS + established precedent (no open gray areas — discussion produced a no-gray-area assessment)
- **SUB-01:** `${CLAUDE_SKILL_DIR}` substitutes ONLY in skill content (both skill call sites), value = the skill's installed directory `path.join(locations.skillsTargetDir, skill.generatedName)` (the same value staged at `bridges/skills/stage.ts:244`). Commands/agents never receive a `skillDir` value — occurrences there pass through untouched (the variable is skill-scoped by upstream definition).
- **SUB-02:** `${CLAUDE_PROJECT_DIR}` substitutes in project-scope skills/commands/agents to the PROJECT ROOT = the install `cwd` (matching the hook lane's `CLAUDE_PROJECT_DIR: transCtx.cwd` and Phase 92's D-92 arm — NOT `scopeRoot`, which is `<cwd>/.pi`). User-scope occurrences pass through untouched — documented divergence (Claude Code substitutes at invoke time even for user-scope artifacts; Pi materializes once at install; no env var rescues it since Claude Code's own bash children carry no `CLAUDE_PROJECT_DIR`; DOC-06 states the gap).
- Previously-substituted variables (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`) behave byte-identically; the T-03-01 no-re-expansion property must be preserved for the extended set (each variable resolved once, output never re-scanned).
- Unknown `${...}` tokens keep passing through untouched.

### Claude's Discretion
- `ClaudePluginVars` shape: optional `skillDir?` / `projectDir?` fields vs a second context type — pick the smallest change that keeps all four call sites type-safe and makes absent-variable = pass-through structural (an absent field must NOT substitute an empty string).
- Whether to mirror Phase 92's single-pass alternation approach in `substituteClaudeVars` or keep sequential `replaceAll` calls extended — preserve the no-re-expansion property either way; keep Sonar's literal-pattern `replaceAll` preference in mind (house memory: string args for literal patterns).
- Test structure (extend `tests/shared/vars.test.ts` + the per-bridge stage/convert tests for the scope arms).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and ground truth
- `.planning/REQUIREMENTS.md` — SUB-01, SUB-02
- `.planning/ROADMAP.md` — Phase 93 entry (goal, success criteria)
- `.planning/PROJECT.md` — "Current Milestone: v1.17 env-parity" section (substitution-completion feature notes + out-of-scope list: `${CLAUDE_SESSION_ID}`/`${CLAUDE_EFFORT}` content substitution stays OUT — runtime values can't be baked at install)

No phase-specific external spec docs exist.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/vars.ts::substituteClaudeVars` + `ClaudePluginVars` — the single shared primitive to extend.
- The four call sites (verified this session): `bridges/skills/stage.ts:168` (description augmentation) and `:298` (whole-file), `bridges/commands/stage.ts:240`, `bridges/agents/convert.ts:530`.
- Skill installed dir: computed at `bridges/skills/stage.ts:244` (`path.join(locations.skillsTargetDir, skill.generatedName)`) with `assertPathInside` on the next line — the same value feeds `${CLAUDE_SKILL_DIR}`.
- Scope + cwd are available at all call sites (locations/scope threading already exists for the Phase 92 work in the same orchestrator paths).

### Established Patterns
- Pass-through semantics for unknown/absent variables (Phase 92's D-92-01 arm: user-scope key simply absent from the map → token untouched).
- Comment policy: `.claude/rules/typescript-comments.md` (IDs allowed, no phase/plan refs).

### Integration Points
- `shared/vars.ts` (the helper), the four call sites, and their existing test files. No new files expected beyond tests (planner may add a vars test section).

</code_context>

<specifics>
## Specific Ideas

- Acceptance shape: a project-scope skill containing all four variables materializes with all four substituted; the same skill user-scope materializes with `${CLAUDE_PROJECT_DIR}` still literal; a command containing `${CLAUDE_SKILL_DIR}` keeps it literal in both scopes.
- No live-Pi item inherent — materialized file content is fully assertable in unit tests.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Coverage sweep: test rare failure arms in update/reinstall/install" — carried forward as reviewed-not-folded (decision from Phase 90).

</deferred>

---

*Phase: 93-substitution-completion*
*Context gathered: 2026-08-03*
