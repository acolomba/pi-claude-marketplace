---
phase: 02-plugin-enable-and-disable
plan: 01
subsystem: orchestrators/plugin
tags: [enable, dependencies, upstream-parity]
requirements-completed: [ENA-05]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/enable-disable.messaging.test.ts
    - docs/plugin-enablement.md
    - CHANGELOG.md
commits: [96464a2b]
---

# 02-01 Summary: enable refuses a missing dependency

Standalone `enable` now refuses, as Claude Code 2.1.308's `dependency_missing`
does, when a member of the plugin's dependency closure is not installed in the
scope. The plugin's row fails with `{dependency unsatisfied}` and the cause
`Install <missing> first, then <target>.`; the refusal is thrown inside the
locked transaction, so no state, config, or staged file changes.

- `resolveEnableCascade` collects members with no record and throws
  `EnableRefusedError`. The `not-installed` disposition, its warning skip row,
  and the optional `record` field are gone; no unreachable branch remains.
- `composeEnableMissingDependencyCause` joins `composeDisableRefusalCause` in
  the messaging module (D-08-01 form, no chained command).
- The reason `dependency unsatisfied` is reused (D-03); its comment names the
  second subject.
- Unit test for the old warning arm replaced by a refusal test that checks the
  rendering and an untouched state file; messaging test for the cause.
- `docs/plugin-enablement.md` and `CHANGELOG.md` describe the refusal.

## Deviations

None.

## Verification

- `node --test` on both enable-disable test files: 207 pass, 0 fail.
- Commit hook `check:commit` passed (typecheck, lint, fallow, format,
  check:features, unpaired tests, direct coverage of the staged pairs).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
