---
milestone: agent-skill-preloads
target_version: 0.10.0
audited: 2026-07-19
status: tech_debt
scores:
  requirements: 5/5
  phases: 3/3
  integration: 1/1
  flows: 2/2
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 83.1-silent-skill-mapping
    items:
      - "VALIDATION.md frontmatter still status: draft / nyquist_compliant: false / wave_0_complete: false — stale flag, not a coverage gap: VERIFICATION.md passed 9/9 with exact-equality test pins and the byte-identity corpus untouched."
  - phase: all
    items:
      - "No SECURITY.md exists for any phase (workflow.security_enforcement default-on). All three phases are pure agent-markdown conversion (no network, auth, or credential surface); /gsd-secure-phase can be run retroactively if a threat-model record is wanted."
nyquist:
  compliant_phases: [82, 83]
  partial_phases: [83.1]
  missing_phases: []
  overall: partial
---

# Milestone Audit: agent-skill-preloads (target npm 0.10.0)

**Audited:** 2026-07-19
**Driver:** GitHub issue #86 — Generated Pi agents drop required Claude skill preloads
**Status:** tech_debt (all requirements satisfied, no blockers, two minor deferred items)

## Definition of Done

A converted Claude plugin agent that declares skill preloads works
self-sufficiently in a fresh Pi subagent session: block-list `skills:` parses,
plugin-qualified names map, the `Skill` tool converts faithfully, and the child
LLM is told which referenced skills are in its context — while agents the fix
does not touch stay byte-identical.

## Requirements Coverage (3-source cross-reference)

| REQ | Phase(s) | VERIFICATION | SUMMARY frontmatter | Traceability | Final |
|-----|----------|--------------|---------------------|--------------|-------|
| AGSK-01 | 82 | passed (14/14) | 82-01, 82-02 | [x] | **satisfied** |
| AGSK-02 | 82 | passed (14/14) | 82-03 | [x] | **satisfied** |
| AGSK-03 | 82 → amended → 83.1 | passed (9/9) | 82-03, 83.1-01 | [x] | **satisfied** |
| AGSK-04 | 82 → amended → 83.1 | passed (9/9) | 82-01, 82-04, 83.1-02 | [x] | **satisfied** |
| AGSK-05 | 83 → amended → 83.1 | passed (9/9) | 83-01, 83-03, 83.1-01 | [x] | **satisfied** |

5/5 satisfied. No unsatisfied, partial, or orphaned requirements.

AGSK-03/04/05 were amended mid-milestone after the phase-83 live UAT surfaced
that Pi's `--no-skills` does not gate extension-contributed skills; Phase 83.1
delivered the amended behavior (silent Skill conversion, unified legend state).
The amended requirement texts are the ones verified above.

## Phase Verifications

| Phase | Status | Score | Notes |
|-------|--------|-------|-------|
| 82 Agent Skill Preload Fidelity | passed | 14/14 | Byte-identity corpus (7 classes) pinned and green |
| 83 Skill Tool Inherit Mapping | passed* | 4/4 | *VERIFICATION frontmatter reads human_needed; the single human item (live pi-subagents round-trip) was executed during this session and its record (83-HUMAN-UAT.md) is status: complete, finding dispositioned to Phase 83.1 |
| 83.1 Silent Skill Mapping | passed | 9/9 | Net −40 lines; both retired strings swept to zero |

## Cross-Phase Integration (live end-to-end)

Verified by running the real extension install path against current HEAD (all
three phases applied) with a fixture spec-tree plugin, then feeding the
generated agents through pi-subagents 0.28.0's own `discoverAgents` +
`buildPiArgs`, then a live child `pi` session:

- Block-list `skills:` → `skills: spec-tree-review-changes` (AGSK-01)
- Qualified `spec-tree:review-changes` maps to the bare Pi name (AGSK-02)
- Skill-declaring agent → `inheritSkills: true`, `droppedTools: (none)`,
  `warnings: (none)` (AGSK-03/05, silent)
- Legend: `(preloaded in your context)` + `(available on demand)` (AGSK-04)
- Non-Skill agent → `inheritSkills: false`, clean provenance
- pi-subagents spawns the Skill agent WITHOUT `--no-skills`, the plain agent
  WITH it; a live child listed the on-demand skill in `<available_skills>` and
  loaded it by its Pi name

The three phases compose into one coherent conversion. No wiring gaps, no
broken flows.

## Nyquist Coverage

| Phase | VALIDATION.md | Compliant | Note |
|-------|---------------|-----------|------|
| 82 | exists | true | — |
| 83 | exists | true | — |
| 83.1 | exists | false (draft) | Frontmatter never flipped post-execution; actual coverage is complete (9/9 VERIFICATION + exact-equality pins). Flip via re-save or `/gsd-validate-phase 83.1`. |

## Tech Debt

1. **83.1 VALIDATION.md draft frontmatter** — documentation-sync only; the
   phase's test coverage is complete and verified.
2. **No SECURITY.md for any phase** — the milestone has no security surface
   (pure markdown conversion, NFR-5 network-free); optional retroactive
   `/gsd-secure-phase` if a record is desired.

## Verdict

All 5 requirements satisfied with live end-to-end evidence. No blockers, no
unsatisfied/orphaned requirements, no broken flows. Two minor non-blocking
items deferred (above). Ready to complete once the tech-debt disposition is
chosen.
