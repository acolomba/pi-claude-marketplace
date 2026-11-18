---
quick_id: 261117-dfo
description: add PI_CLAUDE_MARKETPLACE_DEVICE_FLOW=off opt-out and github.com credential remedy (#325)
date: 2026-11-17
phase: quick-261117-dfo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/shared/device-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - test/shared/device-flow.test.ts
  - test/orchestrators/auth-host.test.ts
  - test/architecture/hermetic-git-environment.test.ts
  - features/step_definitions/git-host.steps.ts
  - features/marketplace/device-flow.feature
  - docs/env-vars.md
  - README.md
  - README.es.md
  - CHANGELOG.md
autonomous: true
requirements: [AUTH-01, AUTH-09, GAUTH-04]
---

<objective>
Add an environment-only `PI_CLAUDE_MARKETPLACE_DEVICE_FLOW` toggle (`0`, `false`, `no`, or `off`) that causes `buildAuthForHost` to return the `stored-credential` bundle for every host, so credential misses cancel without starting OAuth Device Flow and update misses report `NO_STORED_CREDENTIAL_CAUSE` (naming `gh auth login && gh auth setup-git` alongside `git credential approve` for `github.com`).
</objective>

<threat_model>
- **T-dfo-01 (Untrusted project config overriding Device Flow policy):** `PI_CLAUDE_MARKETPLACE_DEVICE_FLOW` is read from `process.env` only. `persistence/config-io.ts` remains strict (`additionalProperties: false`) so `.pi/claude-plugins.json` cannot alter it.
- **T-dfo-02 (Credential disclosure in `NO_STORED_CREDENTIAL_CAUSE`):** The remedy interpolates `host` only (AUTH-09).
- **T-dfo-03 (Operator shell env leaking into behavioral tests):** `PI_CLAUDE_MARKETPLACE_DEVICE_FLOW` is excluded from `rpcChildEnvironment` and pinned in `test/architecture/hermetic-git-environment.test.ts`.
</threat_model>
