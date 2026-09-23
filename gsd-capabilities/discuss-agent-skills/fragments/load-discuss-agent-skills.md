# Project discuss-phase skills

Load the project-configured discuss-phase skills now, before `analyze_phase` generates gray areas or detailed choices:

1. Run `gsd_run query agent-skills gsd-discuss-phase`.
2. Read every `@<path>/SKILL.md` listed in the returned `<agent_skills>` block. If the block is empty, malformed, or a listed skill cannot be read, stop and report the configuration error.
3. Apply the loaded skills to `analyze_phase`, `present_gray_areas`, `discuss_areas`, and `write_context`. Their research must inform question generation, and their output requirements must remain visible in the final `CONTEXT.md`.

The project skill is the canonical instruction source. Do not summarize it into this contribution or continue from memory without reading it.
