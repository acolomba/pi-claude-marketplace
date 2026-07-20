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

- [x] **Phase 82: Agent Skill Preload Fidelity** - Block-list frontmatter parsing, plugin-qualified skill mapping, `Skill`-drop provenance warning, and body advisory note — issue #86 end to end (completed 2026-07-19)
- [x] **Phase 83: Skill Tool Inherit Mapping** - Source `Skill` tool declaration maps to `inheritSkills: true` with accurate provenance and legend wording (completed 2026-07-19)
- [x] **Phase 83.1: Silent Skill Mapping (INSERTED)** - Skill converts silently in every branch (no warning, no `droppedTools` entry); legend non-preloaded state unified to "(available on demand)" — post-UAT correction (completed 2026-07-19)

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

- [x] 82-01-PLAN.md — Byte-identity regression corpus pinned against pre-fix HEAD (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 82-02-PLAN.md — Dash-list frontmatter folding in parseFrontmatter (AGSK-01; Wave 2)
- [x] 82-03-PLAN.md — Plugin-qualified skill mapping + Skill-drop provenance warning (AGSK-02/03; Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 82-04-PLAN.md — Body skill legend + issue #86 canonical end-to-end (AGSK-04; Wave 3)

### Phase 83: Skill Tool Inherit Mapping

**Goal**: A Claude plugin agent that declared the `Skill` tool converts to a Pi agent whose child can dynamically discover and load installed Pi skills (`inheritSkills: true`), with provenance and legend wording that accurately describe that capability — while agents that do not declare `Skill` keep their Phase 82 output byte-identically.
**Depends on**: Phase 82 (extends its warning wording and legend states)
**Requirements**: AGSK-05
**Success Criteria** (what must be TRUE):

  1. A source agent declaring `Skill` in `tools:` (the issue #86 canonical agent included) converts with `inheritSkills: true` in generated frontmatter; `Skill` still appears in `droppedTools`, and the provenance warning for these agents states the Skill tool maps to Pi skill discovery and that catalog names differ from Claude names (pointing at the body legend).
  2. A source agent with `Skill` in `disallowedTools`, or not declaring `Skill` at all, keeps `inheritSkills: false` and produces byte-identical output to its Phase 82 output.
  3. For `Skill`-declaring agents, the body legend annotates known-but-not-preloaded skills as available on demand under their Pi name instead of "not available in this session".
  4. A skill appearing both in the emitted `skills:` list and the inherited catalog is documented by a pinning test as accepted duplication (eager injection + lazy catalog listing).

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 83-01-PLAN.md — Disallowed-direction whole-file pin captured at HEAD before any converter change (D-83-06; Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 83-02-PLAN.md — Emitter inheritSkills field + legend "available on demand" render state (D-83-01/05; Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 83-03-PLAN.md — mapTools inherit flag, warning wording branch, threading, and end-to-end pins (D-83-01..07; Wave 3)

## Progress

**Execution Order:**
Phase 82, then Phase 83.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 82. Agent Skill Preload Fidelity | 4/4 | Complete    | 2026-07-19 |
| 83. Skill Tool Inherit Mapping | 3/3 | Complete    | 2026-07-19 |
| 83.1. Silent Skill Mapping | 2/2 | Complete    | 2026-07-19 |

## Coverage

| Requirement | Phase |
|-------------|-------|
| AGSK-01 | Phase 82 |
| AGSK-02 | Phase 82 |
| AGSK-03 | Phase 82 |
| AGSK-04 | Phase 82 |
| AGSK-05 | Phase 83 |

All 5 v1 requirements mapped. No orphans.

### Phase 83.1: Silent Skill Mapping (INSERTED)

**Goal**: The `Skill` tool converts silently in every branch — declared-and-allowed maps to `inheritSkills: true`, declared-and-disallowed suppresses it exactly as Claude Code does (disallowed wins) — with no provenance warning, no `droppedTools` entry, and a legend whose non-preloaded state says "(available on demand)" everywhere, because extension-contributed skills survive `--no-skills` in real child sessions (UAT finding).
**Depends on**: Phase 83 (rewrites its warning/provenance behavior and Phase 82's legend state)
**Requirements**: AGSK-03, AGSK-05 (as amended after the phase 83 UAT)
**Success Criteria** (what must be TRUE):

  1. A `Skill`-declaring agent converts with `warnings: (none)` and `droppedTools: (none)` in provenance (given no other dropped tools) while still emitting `inheritSkills: true`.
  2. An agent with `Skill` both declared and disallowed converts with `inheritSkills: false`, no Skill-related warning, and no `Skill` entry in `droppedTools` — matching Claude Code's disallowed-wins semantics silently.
  3. The legend's non-preloaded annotation reads "(available on demand)" for all agents regardless of `inheritSkills`; "(not available in this session)" no longer appears anywhere in generated output.
  4. Genuinely unmapped tools (e.g. `WebFetch`) keep appearing in `droppedTools` exactly as before, and agents with no `Skill` declaration and no body skill tokens stay byte-identical to their Phase 83 output.

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 83.1-01-PLAN.md — Silent Skill conversion: Seam A droppedTools exclusion, warning removal, provenance re-pins (AGSK-03/05; Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 83.1-02-PLAN.md — Unified legend state "(available on demand)" + phase-gate sweep (AGSK-04; Wave 2)

### Phase 84: Agent skillPath resolution (end-to-end skill availability)

**Goal**: Emit an agent-local `skillPath` field on every generated agent that references skills, pointing at the marketplace's own skills dir relative to the agent file (`skillPath: ../pi-claude-marketplace/resources/skills`), so pi-subagents resolves the agent's `skills:` names for the spawned subagent. Phases 82/83/83.1 made the conversion correct, but the emitted `skills:` references never resolved for the subagent -- the skill installs under `<scope>/pi-claude-marketplace/resources/skills/`, off pi-subagents' filesystem scan roots -- so issue #86 is not fixed end-to-end without this. Also raise the `pi-subagents` peer-dependency floor to `>=0.35.0`, where agent-local `skillPath` shipped (PR #470). Design, three-way evidence, and caveats are captured in `84-NOTES.md`.
**Depends on**: Phase 83.1 (builds on the finalized conversion output)
**Requirements**: AGSK-06 (new -- agent-local skillPath resolution; add to REQUIREMENTS.md during planning)
**Success Criteria** (what must be TRUE):

  1. A generated agent with a non-empty `skills:` list emits `skillPath: ../pi-claude-marketplace/resources/skills`; an agent with no skills emits no `skillPath` and stays byte-identical to its Phase 83.1 output.
  2. Given that emitted `skillPath`, pi-subagents `resolveSkillsWithFallback` resolves the bridged skill by its generated name (no longer reported `missing`), and the skill does not enter the parent/global catalog.
  3. `package.json` raises the subagents-extension peer floor to `>=0.35.0`, and `npm run check` stays green.
  4. A live spawn of a skill-referencing bridged agent loads and uses the skill on demand (0.35.x lazy delivery), reproducing the verified A/B: with `skillPath` the subagent uses the skill; without it, it does not.

**Plans:** 4 plans

Plans:

**Wave 1**

- [ ] 84-01-PLAN.md — Emit skillPath + collapse legend to single state + unit-fixture corpus (SC-1, D-84-01/02/04/05; Wave 1)
- [ ] 84-02-PLAN.md — pi-subagents optional peer floor >=0.35.0 + AGSK-06/AGSK-04 docs (SC-3, D-84-03; Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 84-03-PLAN.md — SC-2 resolver-contract integration test (graceful-skip; Wave 2)
- [ ] 84-04-PLAN.md — SC-4 live foreground A/B spawn manual UAT checkpoint (Wave 2)
