---
phase: 260922-ckn
plan: 01
subsystem: gsd-discuss
tags: [gsd, agent-skills, claude-code, compatibility]

requires: []
provides:
  - The discuss phase resolves and reads the canonical Claude Code compatibility skill before phase analysis.
  - Upstream-relevant options identify Claude Code behavior, compatibility impact, Pi constraints, and the recommended choice.
  - Final CONTEXT.md records evidence, uncertainty, and the rationale for deliberate divergence.
affects: [discuss-phase, phase-context, project-setup]

tech-stack:
  added: []
  patterns:
    - A tracked project capability contributes a thin discuss:pre loader through GSD's supported extension point.
    - The root skills directory remains the only source of compatibility research instructions.

key-files:
  created:
    - skills/claude-code-compat-research/SKILL.md
    - gsd-capabilities/discuss-agent-skills/capability.json
    - gsd-capabilities/discuss-agent-skills/fragments/load-discuss-agent-skills.md
    - tests/scripts/gsd-discuss-integration.test.ts
  modified:
    - .planning/config.json
    - scripts/init.sh

key-decisions:
  - "Use a tracked local capability installed by project setup instead of modifying generated or installed GSD workflow files."
  - "Keep the discuss:pre contribution limited to querying and reading agent_skills; keep research policy in the canonical root skill."
  - "Prefer verified Claude Code behavior unless a recorded Pi or pi-claude-marketplace constraint justifies divergence."

requirements-completed: [DISCUSS-UPSTREAM]
completed: 2026-09-22
status: complete
---

# Quick Task 260922-ckn: Upstream-Informed Discuss Phase Summary

The GSD discuss phase now loads project-configured compatibility research before it analyzes a phase or generates choices.

## Accomplishments

- Added the canonical Claude Code compatibility research skill and mapped it to `gsd-discuss-phase` through `agent_skills`.
- Added a project-owned `discuss:pre` capability contribution that reads the mapped skill before `analyze_phase` without copying the skill body.
- Installed the tracked capability during project setup and added regression coverage for mapping, ordering, setup, evidence, option, and context contracts.

## Verification

- The skill validator accepted `skills/claude-code-compat-research/SKILL.md`.
- `query agent-skills gsd-discuss-phase` resolved the canonical project skill.
- An isolated GSD installation rendered the loader at `discuss:pre`, before the installed workflow's `analyze_phase` step.
- The focused regression test and the existing partial-vocabulary guard passed.
- The full unit suite passed with 100% line, branch, and function coverage outside the filesystem sandbox required by its FIFO and Unix-socket cases.
- All 32 integration tests passed.
- TypeScript, ESLint, Prettier, workflow, fallow, corresponding-test, direct-coverage negative, and both unused-type-member gates passed.

## Deviations from Plan

None.
