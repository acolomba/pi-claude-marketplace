---
phase: 03-install-dependencies-partial-and-user-scope
plan: 01
subsystem: features
tags: [cucumber, install, dependencies, partial, scope]
requires: [01-suite-foundation]
provides: [INS-01, INS-02, INS-03, INS-04 scenarios]
key-files:
  modified:
    - features/plugin/install-dependencies.feature
    - features/plugin/partial-install.feature
    - features/plugin/install.feature
key-decisions:
  - "No product bug found; both Phase 1 bug candidates are documented design (CONTEXT D-13, D-14)"
  - "INS-02's unsatisfiable constraint maps to {version conflict}; a path-source constraint no tag meets installs the current copy (TAGS-02)"
  - "No phase step module was needed; every step is a Phase 1 step"
requirements-completed: [INS-01, INS-02, INS-03, INS-04]
---

# Phase 3 Plan 01: Install dependencies, partial, and user scope Summary

**Eighteen new cucumber scenarios cover the dependency closure, closures that cannot resolve, `--partial`, and user-scope installs, using only Phase 1 steps.**

## Accomplishments

- `install-dependencies.feature` (11 scenarios, 1 seed): a three-level chain installs every member, records them, declares only the root, and a new session offers all three skills. A missing transitive dependency fails `{not in manifest}`; two non-overlapping constraints fail `{version conflict}`; an installed dependency outside the constraint fails `{already installed, version conflict}` and stays the only plugin. Each failure is shown to install nothing through the record, the staged skills, the config, `list`, and a new session.
- `partial-install.feature` (4 scenarios, 1 seed): `--partial` installs `partially-installed {unsupported component}`, stages only the skill, a new session offers it, and `info` reports the left-out component.
- `install.feature` (17 scenarios): installs with no `--scope` and with `--scope user` land in the user scope only (record and config), `list --scope project` shows nothing installed, and a session in another project offers the skill.

## Deviations from Plan

- **Review fixes:** the code review added config, staged-skill, `list`, and new-session checks (03-REVIEW-FIX.md). Three more scenarios than planned.
- **Recovery:** a commit hook killed mid-run left two feature edits in a pre-commit patch file; they were restored with `git apply` and committed together.

## Product bugs

None fixed. Bug candidates checked:
1. Dependency row `name` is the qualified key (`lib@tools`): by design, RESV-06 / WIRE-04 (`rowId` in `shared/notification-json.ts`).
2. The `partially-available` refusal row has no scope or version: by design, `wireScope` omits scope for catalog statuses, and every pre-ledger refusal lacks a version.

## Verification

- `npx cucumber-js` on the three files: 32 scenarios, 325 steps passed.
- `npm run check:features`: exit 0. `npm run check`: see 03-VERIFICATION.md.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
