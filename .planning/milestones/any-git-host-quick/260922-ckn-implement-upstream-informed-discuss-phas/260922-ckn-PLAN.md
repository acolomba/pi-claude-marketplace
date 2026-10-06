---
phase: 260922-ckn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/config.json
  - skills/claude-code-compat-research/SKILL.md
  - gsd-capabilities/discuss-agent-skills/capability.json
  - gsd-capabilities/discuss-agent-skills/fragments/load-discuss-agent-skills.md
  - scripts/init.sh
  - tests/scripts/gsd-discuss-integration.test.ts
autonomous: true
requirements: [DISCUSS-UPSTREAM]

must_haves:
  truths:
    - "The gsd-discuss-phase agent-skills query resolves the canonical project skill under skills/."
    - "Ordinary discuss dispatch loads the mapped skill before analyze_phase generates gray areas."
    - "Every relevant choice identifies Claude Code behavior, the matching option, compatibility impact, Pi constraints, and a recommendation."
    - "CONTEXT.md preserves upstream evidence and the reason for any deliberate divergence."
    - "Claude Code probes use temporary configuration, marketplace, plugin, cache, and project directories."
  artifacts:
    - path: "skills/claude-code-compat-research/SKILL.md"
      provides: "The canonical upstream research and discuss-output contract"
    - path: "gsd-capabilities/discuss-agent-skills/capability.json"
      provides: "A project-owned discuss:pre consumer"
    - path: "tests/scripts/gsd-discuss-integration.test.ts"
      provides: "Regression coverage for mapping, ordering, setup, and required skill behavior"
---

<objective>
Load a canonical Claude Code compatibility research skill before GSD discuss-phase analysis.

Use GSD's supported capability extension point instead of patching installed workflow files. Keep
the hook contribution limited to resolving and reading the configured agent skill. Put all research,
recommendation, and CONTEXT.md requirements in the root project skill.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Add the canonical compatibility research skill</name>
  <files>skills/claude-code-compat-research/SKILL.md, .planning/config.json</files>
  <action>Define the official-source evidence hierarchy, isolated Claude Code probe rules, evidence record, option presentation, recommendation rule, and CONTEXT.md preservation contract. Map the skill to gsd-discuss-phase through the existing agent_skills configuration.</action>
  <verify>Run the skill validator and query agent-skills against the project configuration.</verify>
</task>

<task type="auto">
  <name>Task 2: Add the supported pre-analysis consumer</name>
  <files>gsd-capabilities/discuss-agent-skills/capability.json, gsd-capabilities/discuss-agent-skills/fragments/load-discuss-agent-skills.md, scripts/init.sh</files>
  <action>Declare a discuss:pre orchestrator contribution that queries gsd-discuss-phase skills and reads every returned SKILL.md before analyze_phase. Install the tracked local capability after GSD setup. Do not copy the skill body into the contribution or installed workflow.</action>
  <verify>Install the capability in a temporary project and render discuss:pre hooks with a temporary GSD home.</verify>
</task>

<task type="auto">
  <name>Task 3: Lock the integration contract</name>
  <files>tests/scripts/gsd-discuss-integration.test.ts</files>
  <action>Add hermetic tests for the mapping, discuss:pre contribution, query-read-analyze ordering, setup installation, evidence fields, option context, and CONTEXT.md requirements.</action>
  <verify>Run the focused test, TypeScript and lint gates, skill validation, isolated live GSD verification, pre-commit, and npm run check.</verify>
</task>

</tasks>
