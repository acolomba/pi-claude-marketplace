---
quick_id: 261117-ghc
description: fall back to gh auth token for github.com before Device Flow (#325)
date: 2026-11-17
phase: quick-261117-ghc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/domain/auth-registry.ts
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - test/platform/git-credential.test.ts
  - test/orchestrators/auth-host.test.ts
  - test/architecture/no-credential-leak.test.ts
  - test/architecture/hermetic-git-environment.test.ts
  - features/lib/pi-launch-environment.ts
  - features/lib/github-cli.ts
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/device-flow.steps.ts
  - features/marketplace/device-flow.feature
  - README.md
  - README.es.md
  - CHANGELOG.md
autonomous: true
requirements: [AUTH-01, AUTH-08, AUTH-09, GHB-02]
---

<objective>
When `git credential fill` returns nothing for `github.com` and `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is unset, try `gh auth token --hostname github.com` (`shell: false`, `GH_PROMPT_DISABLED=1`, 5 s timeout) before starting GitHub OAuth Device Flow. Keep the returned `x-access-token` credential in memory without persisting it via `git credential approve`. Fall through to existing behavior on `ENOENT`, non-zero exit, empty/control-char stdout, or timeout.
</objective>

<threat_model>
- **T-ghc-01 (Credential disclosure via Error / debug log / notify / JSON / tool output):** `readGitHubCliToken` constructs no `Error` and calls no `hookDebugLog`, returning `string | null` only. Enforced statically in `test/architecture/no-credential-leak.test.ts`.
- **T-ghc-02 (Command injection):** `spawn("gh", ["auth", "token", "--hostname", host], { shell: false, stdio: ["ignore", "pipe", "ignore"] })` uses an explicit argv array with `shell: false`, and `fillFromGitHubCli` runs only when `host === GITHUB_HOST`.
- **T-ghc-03 (Token leakage to GitHub base override or third-party hosts):** `fillFromGitHubCli` checks `host === GITHUB_HOST` first and skips whenever `gitHubOverrideHost() !== undefined`.
- **T-ghc-04 (Unintended keychain mutation):** The `gh` token answers `fill` in memory and never calls `git credential approve`.
</threat_model>
