# Quick Task 260515-wpe: Clarify marketplace/plugin scope rules - Summary

**Date:** 2026-05-15
**Status:** Complete

## What changed

Updated the specifications to make marketplace scope and plugin install target scope explicit.

### Specification updates

- `docs/prd/pi-claude-marketplace-prd.md`
  - Clarified glossary terms for scoped marketplaces, scoped plugin install records, target scope, installed, and available.
  - Added PI-16 and PI-17 for install source-vs-target scope and dual-scope installs.
  - Added new PRD §6.2.1 with CMP-1..CMP-8:
    - marketplaces can exist in user scope, project scope, or both;
    - project-target installs can use project marketplaces first, then user marketplaces as fallback;
    - user-target installs only use user marketplaces;
    - the same plugin may be installed in both scopes;
    - project scope takes precedence for unqualified single-target operations;
    - completion follows the same rules;
    - install completion is available-only for the current target scope.
  - Updated TC-6 details and acceptance-test summary for scope-aware install completion.

- `.planning/REQUIREMENTS.md`
  - Mirrored PI-16, PI-17, and CMP-1..CMP-8.
  - Marked Behavioral Gap 4 resolved by D-26 / CMP-1..8.
  - Updated traceability counts and phase mappings.

- `.planning/ROADMAP.md`
  - Updated Phase 5 to include scope-aware marketplace sourcing and dual-scope plugin installs.
  - Updated Phase 6 to include scope-aware, available-only install completion.

- `.planning/PROJECT.md`
  - Added D-26 decision record with the full scope rule set.
  - Updated active scope/completion summaries and context/constraints.

- `README.md`
  - Added a user-facing "Scope rules for marketplaces and plugins" section.

## Verification

- Documentation-only change; no code paths were modified.
- Spot-checked that PRD, REQUIREMENTS, ROADMAP, PROJECT, and README all mention the new scope rules consistently.
