---
quick_id: 261001-mlt
status: complete
description: Schedule focused task gates and full phase or PR verification
---

# Schedule verification at the correct boundary

Return to `features/ci-check-efficiency` and leave the disposable trial branch
intact. The trial measured the same focused checks twice, once directly and once
through pre-commit. Avoid that repetition in normal work.

## Task

Update the project verification skill, AGENTS.md, contributing guidance, and
TypeScript writing/review skill instructions. Owner tests serve the edit loop.
Ordinary quick tasks and individual plan tasks may complete with task-wide
focused evidence, normally supplied by required pre-commit hooks. Keep explicit
bases across commits and require revalidation if later work invalidates earlier
results. Record focused scope and pending full verification honestly.

Keep the full gate for combined GSD merge/phase verification and final PR/release
handoff, with exact-input reuse for repeated requests. Shared inputs and uncertain
selection retain the existing full fallback. Preserve CI, executable scripts,
GSD test_command, and installed GSD. Resolve conflicting project skill wording
instead of introducing another runner or success cache.

## Verification

Validate edited skills, check command selection for the real documentation diff,
and review the policy against ordinary quick work, multi-commit work, shared
tooling, combined verification, and stale results. Run applicable document hooks
and Fallow audit before commits. No runtime behavior changes, so no full build
is required for this task. Commit policy and GSD completion records separately.

## Threat model

A focused pass must never be represented as full-project verification. Full
fallbacks, global Fallow, mandatory pre-commit checks, and combined-tree gates
remain in place. Never accept failed, timed-out, empty, or stale checks as
evidence for executable changes. Changing scheduling must not weaken CI or
authorize skipping required commit hooks.
