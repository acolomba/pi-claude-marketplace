---
quick_id: 261117-dfo
phase: quick-261117-dfo
plan: 01
subsystem: shared/device-flow, orchestrators/auth-host
tags: [auth, device-flow, env-vars, github]
requirements: [AUTH-01, AUTH-09, GAUTH-04]
status: complete
completed: 2026-11-17
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/device-flow.ts
    - test/shared/device-flow.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - test/orchestrators/auth-host.test.ts
    - test/architecture/hermetic-git-environment.test.ts
    - features/step_definitions/git-host.steps.ts
    - features/marketplace/device-flow.feature
    - docs/env-vars.md
    - README.md
    - README.es.md
    - CHANGELOG.md
---

# Quick 261117-dfo: add PI_CLAUDE_MARKETPLACE_DEVICE_FLOW=off opt-out

`isDeviceFlowDisabled()` (`shared/device-flow.ts`) reads `PI_CLAUDE_MARKETPLACE_DEVICE_FLOW` (`0`, `false`, `no`, or `off`) from `process.env`. When enabled, `buildAuthForHost` returns `buildStoredCredentialAuth(host, credentialOps)` for every host, and `NO_STORED_CREDENTIAL_CAUSE("github.com")` names `gh auth login && gh auth setup-git` alongside `git credential approve`.

## Red proof

Before modifying `extensions/`, `npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature` failed 2 of 12 scenarios:

1. `Adding a private GitHub marketplace with PI_CLAUDE_MARKETPLACE_DEVICE_FLOW set to off fails without Device Flow` emitted `device-flow-prompt` and added the marketplace.
2. `Updating a private GitHub marketplace with PI_CLAUDE_MARKETPLACE_DEVICE_FLOW set to off reports the gh login and credential remedy` emitted `device-flow-prompt` and skipped as up-to-date.

## Green verification

- `npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature`: 12/12 scenarios passed.
- Direct 100% coverage on `shared/device-flow.ts` and `orchestrators/auth-host.ts`.
- Static checks, unpaired architecture tests, integration tests, cucumber profiles, and all-pairs direct coverage clean.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
