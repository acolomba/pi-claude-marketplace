---
quick_id: 261117-ghc
phase: quick-261117-ghc
plan: 01
subsystem: platform/git-credential, orchestrators/auth-host
tags: [auth, github, gh-cli, device-flow]
requirements: [AUTH-01, AUTH-08, AUTH-09, GHB-02]
status: complete
completed: 2026-11-17
key-files:
  created:
    - features/lib/github-cli.ts
  modified:
    - extensions/pi-claude-marketplace/domain/auth-registry.ts
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - test/platform/git-credential.test.ts
    - test/orchestrators/auth-host.test.ts
    - test/architecture/no-credential-leak.test.ts
    - test/architecture/hermetic-git-environment.test.ts
    - features/lib/pi-launch-environment.ts
    - features/step_definitions/git-host.steps.ts
    - features/step_definitions/marketplace/device-flow.steps.ts
    - features/marketplace/device-flow.feature
    - README.md
    - README.es.md
    - CHANGELOG.md
---

# Quick 261117-ghc: fall back to gh auth token for github.com before Device Flow

`DEFAULT_CREDENTIAL_OPS` now queries `gh auth token --hostname github.com` (`shell: false`, `GH_PROMPT_DISABLED=1`, 5 s timeout) when `git credential fill` misses for `github.com` and `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is unset. The token maps via `GITHUB_PROVIDER.credentialFrom` (`x-access-token`) and stays in memory without calling `git credential approve`.

## Red proof

Before modifying `extensions/`, `npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature` failed 3 of 13 scenarios:

1. `Adding a private GitHub marketplace uses the signed-in gh CLI token without Device Flow` emitted `device-flow-prompt` and failed with `{authentication required}`.
2. `Installing a plugin from a private GitHub source uses the signed-in gh CLI token without Device Flow` emitted `device-flow-prompt` and failed with `{authentication required}`.
3. `Adding a private GitHub marketplace falls back to Device Flow when the gh CLI is signed out` recorded zero `gh` calls.

## Green verification

- `npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature`: 13/13 scenarios passed.
- Direct 100% coverage on `platform/git-credential.ts`, `orchestrators/auth-host.ts`, and `domain/auth-registry.ts`.
- Full `npm run check` and `pre-commit` clean.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
