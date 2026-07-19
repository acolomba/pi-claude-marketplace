# Phase 83: Skill Tool Inherit Mapping - Context

**Gathered:** 2026-07-19 (captured during the Phase 82 discussion that originated this phase)
**Status:** Ready for planning (plan after Phase 82 completes — extends its wording and legend code)

<domain>
## Phase Boundary

Map a source agent's `Skill` tool declaration to `inheritSkills: true` in
generated frontmatter (AGSK-05), so the child Pi session can dynamically
discover and load installed Pi skills — the faithful analog of Claude
Code's Skill tool, whose catalog is environment-dependent there too.
Agents that do not declare `Skill` (or disallow it) keep `inheritSkills:
false` and their Phase 82 output byte-identically.

</domain>

<decisions>
## Implementation Decisions

### Mapping rule
- **D-83-01:** `Skill` present in source `tools:` AND not present in
  `disallowedTools` → emit `inheritSkills: true`. Otherwise emit
  `inheritSkills: false` (today's value). No other trigger flips the flag.
- **D-83-02:** `Skill` remains recorded in `droppedTools` either way — it
  is still not a Pi tool; what changes is the capability story told in the
  warning.
- **D-83-03:** User rationale (accepted): name mapping is already decided
  and discovery-by-description is what we get; catalog scope is equivalent
  between Claude Code (session skills) and Pi (agent-dir + project
  skills); an agent that declared dynamic skill access must get the Pi
  analog.

### Provenance warning (branches Phase 82's D-82-09)
- **D-83-04:** For `Skill`-declaring agents the warning states: the Skill
  tool maps to Pi skill discovery (`inheritSkills: true`); installed Pi
  skills are discoverable and loadable on demand; catalog names differ
  from Claude names — see the body legend. Exact string is Claude's
  discretion; pin with tests. Non-Skill agents keep the Phase 82 wording
  (which remains accurate for them).

### Legend third state (extends Phase 82's D-82-05/06)
- **D-83-05:** For `Skill`-declaring agents, known-but-not-preloaded
  skills are annotated "available on demand as `<pi-name>`" instead of
  "not available in this session". Preloaded annotation unchanged.
  Non-Skill agents keep the two Phase 82 states.

### Byte-identical contract
- **D-83-06:** The no-change guarantee is relative to Phase 82 output and
  carves out `Skill`-declaring agents (their `inheritSkills` line and
  warning text change by design). Pin both directions: a Skill-declaring
  fixture changes exactly as specified; a non-Skill fixture is
  byte-identical to its Phase 82 snapshot.

### Accepted duplication edge
- **D-83-07:** A skill in the emitted `skills:` list is ALSO discoverable
  in the inherited catalog under its Pi name (eager injection + lazy
  listing). Accepted behavior; document with a pinning test, no dedup
  logic.

### Claude's Discretion
- Exact warning string and legend "available on demand" phrasing.
- Whether the emitted `inheritSkills:` line placement stays in the
  hardcoded trio (it should — deterministic field order per AG-8).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/workstreams/issue-86-agent-skill-preloads/REQUIREMENTS.md` — AGSK-05 (this phase), AGSK-03 (wording this phase branches)
- `.planning/workstreams/issue-86-agent-skill-preloads/ROADMAP.md` — Phase 83 success criteria
- `.planning/workstreams/issue-86-agent-skill-preloads/phases/82-agent-skill-preload-fidelity/82-CONTEXT.md` — D-82-05..09 (legend + warning decisions this phase extends)

### Implementation surface
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` — `emitGeneratedAgentFile` (the hardcoded `inheritSkills: false` line becomes conditional; AG-8 deterministic field order)
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` — `mapTools` (Skill detection + disallowedTools interaction), warning site

### External behavior evidence (verified 2026-07-19)
- `~/.pi/agent/npm/node_modules/pi-subagents/src/runs/shared/pi-args.ts:132-134` — `inheritSkills` false → `--no-skills`; true → child loads normal skill catalog (0.28.0 already supports the field: compatibility floor holds)
- `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` (`formatSkillsForPrompt`) — inherited catalog is lazy (name+description+path; read on demand); with a custom system prompt the catalog section is appended only when the read tool is available
- `~/.pi/agent/npm/node_modules/pi-subagents/src/agents/skills.ts:579-585` — declared `skills:` remain FULL-CONTENT injected regardless of inheritSkills

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 82's legend builder (annotation states live in one place — add the third state there).
- Phase 82's Skill-warning branch in `mapTools`/`convertAgent` — this phase adds the condition and second wording.
- `emitGeneratedAgentFile` trio line: split `inheritSkills` out of the hardcoded string into a parameter with default false.

### Established Patterns
- Byte-identical pinning via full-file fixture tests (Phase 82 establishes them; reuse for the phase-82-snapshot comparison).
- User-contract exact-equality tests for wording strings.

### Integration Points
- `convertAgent` must thread "Skill declared and allowed" (computed in `mapTools`) to both the emitter (inheritSkills flag) and the legend builder (annotation state).

</code_context>

<specifics>
## Specific Ideas

- The issue #86 canonical agent (declares `Skill`) becomes the positive
  fixture: after this phase it emits `inheritSkills: true` with the
  discovery-wording warning and on-demand legend states.

</specifics>

<deferred>
## Deferred Ideas

- Install-time opt-out flag (e.g. `--no-inherit-skills`, analogous to
  `--map-model` opt-in) if users report contamination concerns — only if
  demand appears.

</deferred>

---

*Phase: 83-Skill Tool Inherit Mapping*
*Context gathered: 2026-07-19*
