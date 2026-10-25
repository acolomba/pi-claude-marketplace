---
phase: 02-plugin-enable-and-disable
plan: 02
subsystem: features
tags: [cucumber, enable, disable]
requirements-completed: [ENA-01, ENA-02, ENA-03, ENA-04, ENA-05, ENA-06]
key-files:
  modified:
    - features/plugin/enable.feature
    - features/plugin/disable.feature
commits: [dc8b812a]
---

# 02-02 Summary: enable and disable scenarios

Twelve new scenarios, six per file, beside the five existing layer and ENA-01
scenarios. Every scenario compares the whole result, the installation records,
the base configs, and, where the title claims it, the skills a new session
offers.

| Requirement | Scenario |
| --- | --- |
| ENA-01 | Enabling a disabled plugin offers its skills again and keeps one installation record (existing) |
| ENA-02 | Disabling an enabled plugin offers none of its skills and keeps it installed (`list` shows it disabled) |
| ENA-03 | Enabling an enabled plugin is skipped as already enabled; Disabling a disabled plugin is skipped as already disabled |
| ENA-04 | Enabling / Disabling in the user scope leaves the project scope unchanged; Enabling / Disabling in the project scope leaves the user scope unchanged |
| ENA-05 | Enabling a plugin enables its disabled dependency too; Enabling a plugin whose dependency is not installed fails as dependency unsatisfied; Disabling a plugin that an enabled plugin depends on fails as dependents remain |
| ENA-06 | Enabling / Disabling a plugin that is not installed fails as not installed |

The scope scenarios tell the scopes apart through a session in another
project, which loads only the user scope. No phase-local step module was
needed (D-08).

## Deviations

- The absent-dependency enable fails instead of installing the dependency
  (D-02): Claude Code refuses it, and the ROADMAP wording predates the
  research. Recorded in CONTEXT.

## Verification

- `npx cucumber-js features/plugin/enable.feature features/plugin/disable.feature`:
  17 scenarios, 258 steps, all passed.
- `npm run check:features`: passed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
