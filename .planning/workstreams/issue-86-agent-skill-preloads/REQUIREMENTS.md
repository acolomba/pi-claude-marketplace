# Requirements: agent-skill-preloads (milestone, target npm 0.10.0)

**Defined:** 2026-07-19
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Driver:** GitHub issue #86 — Generated Pi agents drop required Claude skill preloads.

## v1 Requirements

### Conversion Correctness

- [ ] **AGSK-01**: A source Claude agent using the documented YAML block-list form for `skills:` (and `tools:`) converts with its list values intact — dash items fold into the field's value, no bogus `- <token>` entries land in `droppedFields`, and existing CSV / inline-array forms keep parsing byte-identically.
- [ ] **AGSK-02**: A `skills:` entry qualified with the plugin's own name (`<plugin>:<skill>`) maps to the converted Pi skill name exactly as its bare form does; a cross-plugin qualifier (`other-plugin:skill`) is dropped with a warning naming the token.

### Child-Context Transparency

- [ ] **AGSK-03**: When the `Skill` tool is dropped during tools mapping, the generated provenance warnings state that dynamic skill invocation is unavailable in Pi and only preloaded skills are in the child's context.
- [ ] **AGSK-04**: A generated agent whose body references `<plugin>:<source-skill>` tokens carries a visible converter-authored note mapping each referenced Claude skill name to its Pi skill name — "(preloaded in your context)" when the skill is in the emitted `skills:` list, "(not available in this session)" otherwise; an agent body with no such references produces byte-identical output to today.

### Dynamic Skill Access

- [ ] **AGSK-05**: A source agent declaring the `Skill` tool (and not disallowing it via `disallowedTools`) converts with `inheritSkills: true` in generated frontmatter — Pi's lazy skill catalog (name+description listing, read on demand) is the faithful analog of Claude's environment-dependent Skill tool. Provenance warning for these agents states the mapping and that catalog names differ from Claude names (see body legend); the legend annotates known-but-not-preloaded skills as available on demand under their Pi name. Agents not declaring `Skill` keep `inheritSkills: false` byte-identically.

## v2 Requirements

(None.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting skill tokens inside agent body prose | Advisory-only by design; rewriting free text risks corrupting code blocks and legitimate literals |
| Mapping cross-plugin qualified skill references to installed plugins | Installability of the other plugin is unknown at convert time; warn-and-drop keeps the contract honest |
| Emitting block-list `skills:` in generated frontmatter | Compatibility floor is pi-subagents 0.28.x, which only splits CSV; upstream 0.35.x accepts both |
| General YAML support in `parseFrontmatter` (nested maps, folded scalars, anchors) | Only the dash-list continuation form is needed for the documented Claude agent frontmatter surface |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGSK-01 | Phase 82 | Pending |
| AGSK-02 | Phase 82 | Pending |
| AGSK-03 | Phase 82 | Pending |
| AGSK-04 | Phase 82 | Pending |
| AGSK-05 | Phase 83 | Pending |

**Coverage:**

- v1 requirements: 5 total
- Mapped to phases: 5 (AGSK-01..04 Phase 82; AGSK-05 Phase 83)
- Unmapped: 0

---

*Requirements defined: 2026-07-19*
*Last updated: 2026-07-19 after Phase 82 discussion (AGSK-05 registered for Phase 83; Skill-tool out-of-scope row removed — its rationale did not survive pi-subagents/pi source review)*
