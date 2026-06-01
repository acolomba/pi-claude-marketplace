# Requirements: pi-claude-marketplace v1.6

**Defined:** 2026-06-01
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and,
after `/reload`, have every supported Claude plugin component appear as a working
Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation
that never blocks the install.

## v1.6 Requirements

### Authentication

- [x] **AUTH-01**: User can run `marketplace add <private-github-url>` with no
      pre-configuration; Device Flow triggers automatically on first access
- [x] **AUTH-02**: User can run `marketplace update <name>` against a private GitHub
      marketplace without re-authenticating when a valid token is already stored
- [x] **AUTH-03**: During Device Flow, user is shown a one-time code and a verification
      URL via ctx.ui.notify so they can authorize from any browser
- [x] **AUTH-04**: Device Flow polling respects the server-specified interval;
      slow_down responses increase the poll interval cumulatively
- [x] **AUTH-05**: Device Flow timeout or access_denied produces a clear, actionable
      error message (not a raw HTTP error)
- [x] **AUTH-06**: Successful Device Flow stores the token in the OS keychain
      (macOS Keychain / Windows Credential Manager / Linux gnome-keyring) via
      `git credential approve`
- [x] **AUTH-07**: A rejected stored token is evicted from the OS keychain via
      `git credential reject` and Device Flow is re-triggered automatically
- [x] **AUTH-08**: Subsequent add/update against the same host reuse the stored
      token via `git credential fill` without triggering Device Flow again
- [x] **AUTH-09**: The access token never appears in state.json, error messages,
      or any ctx.ui.notify output
- [x] **AUTH-10**: `npm run check` stays green; duplicate GitCredentials type
      in platform/git.ts removed as a prerequisite

## Deferred Requirements

### Authentication

- **AUTH-D01**: `marketplace auth logout` subcommand evicts stored credentials for a host
- **AUTH-D02**: Non-GitHub HTTPS hosts (GitLab, Bitbucket, generic) authenticate
      via PAT prompt using ctx.ui.input
- **AUTH-D03**: Automatic browser open to verification URL (OS-specific)

## Out of Scope

| Feature | Reason |
|---------|--------|
| env-var credential path | Removed; on-demand Device Flow replaces it |
| OAuth web flow (redirect URI) | Requires a local HTTP server; Device Flow is the correct CLI pattern |
| GitHub App tokens | OAuth App tokens simpler (no expiry); GitHub App support deferred |
| Token refresh / rotation | OAuth App tokens do not expire by default |
| Non-GitHub hosts | Scoped to GitHub for v1.6; other hosts deferred (AUTH-D02) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-10 | Phase 30 | Satisfied |
| AUTH-06 | Phase 31 | Satisfied |
| AUTH-08 | Phase 31 | Satisfied |
| AUTH-09 | Phase 31 | Satisfied |
| AUTH-01 | Phase 32 | Satisfied |
| AUTH-02 | Phase 32 | Satisfied |
| AUTH-03 | Phase 32 | Satisfied |
| AUTH-04 | Phase 32 | Satisfied |
| AUTH-05 | Phase 32 | Satisfied |
| AUTH-07 | Phase 32 | Satisfied |
| AUTH-01..AUTH-10 (integration gate) | Phase 36 | Satisfied |

**Coverage:**
- v1.6 requirements: 10 total
- Mapped to phases: 10 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-06-01*
*Last updated: 2026-06-01 -- traceability finalized by gsd-roadmapper (Phases 30-36)*
