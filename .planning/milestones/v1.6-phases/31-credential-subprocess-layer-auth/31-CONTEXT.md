# Phase 31: Credential Subprocess Layer (AUTH-06, AUTH-08, AUTH-09) - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`platform/git-credential.ts` wraps `git credential fill/approve/reject` as injectable `CredentialOps` interface so tests never touch the developer's OS keychain.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- discuss phase skipped. Refer to ROADMAP phase description and success criteria:
1. `git credential fill` returns a `GitAuth`-shaped credential on a hit and `null` on a miss (non-zero exit / empty stdout); no hang on missing blank-line terminator + `stdin.end()`.
2. `git credential approve` persists a credential to the OS keychain; `git credential reject` evicts it -- both confirmed by the `CredentialOps` interface contract and unit tests with a mock implementation.
3. The access token never appears in any error message or `ctx.ui.notify` output; architecture-level tests assert no credential field leaks through state write paths.
4. `npm run check` GREEN; `CredentialOps` interface defined with a `makeMockCredentialOps` test helper following the `GitOps`/`makeMockGitOps` pattern.

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
