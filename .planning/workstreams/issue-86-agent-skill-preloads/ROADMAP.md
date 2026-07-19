# Roadmap: agent-skill-preloads (milestone, target npm 0.10.0)

**Workstream:** issue-86-agent-skill-preloads
**Driver:** GitHub issue #86 — Generated Pi agents drop required Claude skill preloads
**Created:** 2026-07-19

## Overview

A converted Claude plugin agent that declares skill preloads must work self-sufficiently in a fresh Pi subagent session. Today the agents bridge loses the preload three ways: the frontmatter line parser degrades the documented YAML block-list `skills:` form into bogus `- <token>` dropped fields, `mapSkills` cannot resolve the plugin-qualified `<plugin>:<skill>` namespace, and the child LLM is told nothing about the `Skill` tool it can no longer call or the skill tokens referenced in its body prose. One phase fixes the whole pipeline in `extensions/pi-claude-marketplace/bridges/agents/` — parser (frontmatter.ts), mapping (convert.ts `mapSkills`/`mapTools`), and emitter/provenance output — anchored to issue #86's exact source agent as the canonical fixture, with a hard byte-identical no-regression bar for agents the fix does not apply to.

## Phases

**Phase Numbering:**

- Integer phases: planned milestone work
- Decimal phases (82.1, 82.2): urgent insertions (marked INSERTED)

Phase numbering continues from the fetch-plugin milestone (last used: 81).

- [ ] **Phase 82: Agent Skill Preload Fidelity** - Block-list frontmatter parsing, plugin-qualified skill mapping, `Skill`-drop provenance warning, and body advisory note — issue #86 end to end
- [ ] **Phase 83: Skill Tool Inherit Mapping** - Source `Skill` tool declaration maps to `inheritSkills: true` with accurate provenance and legend wording

## Phase Details

### Phase 82: Agent Skill Preload Fidelity

**Goal**: A Claude plugin agent declaring skill preloads (documented block-list `skills:` form, plugin-qualified names) converts to a Pi agent whose generated frontmatter carries the preloads, whose provenance explains the dropped `Skill` tool, and whose body tells the child LLM which referenced Claude skills are (or are not) in its context — while every agent the fix does not apply to stays byte-identical.
**Depends on**: Nothing (first phase of milestone; builds on the shipped agents bridge)
**Requirements**: AGSK-01, AGSK-02, AGSK-03, AGSK-04
**Success Criteria** (what must be TRUE):

  1. The issue #86 canonical source agent (`tools: Bash, Read, Skill` plus block-list `skills:` with item `spec-tree:review-changes`, from plugin `spec-tree`) converts to generated frontmatter containing `tools: bash,read` and `skills: spec-tree-review-changes` — the dash item folds into the `skills:` value and no bogus `- spec-tree:review-changes` key lands in `droppedFields`.
  2. That same conversion's provenance records `droppedTools: Skill` with a warning stating that generated agents run with skills discovery disabled (`inheritSkills: false`) and only the skills listed in `skills:` are preloaded into the child's context.
  3. A `skills:` entry qualified with a different plugin's name (`other-plugin:some-skill`) is dropped with a warning naming the token, while bare skill names keep mapping exactly as they do today.
  4. A generated agent whose body literally contains `spec-tree:review-changes` carries a visible converter-authored note mapping it to `spec-tree-review-changes` — "(preloaded in your context)" when the skill is in the emitted `skills:` list, "(not available in this session)" otherwise.
  5. Agents without block lists, plugin-qualified references, or body skill tokens produce byte-identical generated output to today — existing CSV and inline-array frontmatter forms parse unchanged, and generated frontmatter keeps emitting CSV `skills:` (pi-subagents 0.28.x compatibility floor).

**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 82-01-PLAN.md — Byte-identity regression corpus pinned against pre-fix HEAD (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 82-02-PLAN.md — Dash-list frontmatter folding in parseFrontmatter (AGSK-01; Wave 2)
- [ ] 82-03-PLAN.md — Plugin-qualified skill mapping + Skill-drop provenance warning (AGSK-02/03; Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 82-04-PLAN.md — Body skill legend + issue #86 canonical end-to-end (AGSK-04; Wave 3)

### Phase 83: Skill Tool Inherit Mapping

**Goal**: A Claude plugin agent that declared the `Skill` tool converts to a Pi agent whose child can dynamically discover and load installed Pi skills (`inheritSkills: true`), with provenance and legend wording that accurately describe that capability — while agents that do not declare `Skill` keep their Phase 82 output byte-identically.
**Depends on**: Phase 82 (extends its warning wording and legend states)
**Requirements**: AGSK-05
**Success Criteria** (what must be TRUE):

  1. A source agent declaring `Skill` in `tools:` (the issue #86 canonical agent included) converts with `inheritSkills: true` in generated frontmatter; `Skill` still appears in `droppedTools`, and the provenance warning for these agents states the Skill tool maps to Pi skill discovery and that catalog names differ from Claude names (pointing at the body legend).
  2. A source agent with `Skill` in `disallowedTools`, or not declaring `Skill` at all, keeps `inheritSkills: false` and produces byte-identical output to its Phase 82 output.
  3. For `Skill`-declaring agents, the body legend annotates known-but-not-preloaded skills as available on demand under their Pi name instead of "not available in this session".
  4. A skill appearing both in the emitted `skills:` list and the inherited catalog is documented by a pinning test as accepted duplication (eager injection + lazy catalog listing).

**Plans**: TBD

## Progress

**Execution Order:**
Phase 82, then Phase 83.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 82. Agent Skill Preload Fidelity | 0/4 | Not started | - |
| 83. Skill Tool Inherit Mapping | 0/TBD | Not started | - |

## Coverage

| Requirement | Phase |
|-------------|-------|
| AGSK-01 | Phase 82 |
| AGSK-02 | Phase 82 |
| AGSK-03 | Phase 82 |
| AGSK-04 | Phase 82 |
| AGSK-05 | Phase 83 |

All 5 v1 requirements mapped. No orphans.
