# Research Summary: pi-claude-marketplace v1.6 GitHub Private Marketplace Authentication

**Project:** pi-claude-marketplace v1.6
**Domain:** GitHub Device Flow OAuth + OS keychain credential management in a Node.js Pi extension
**Researched:** 2026-06-01
**Confidence:** HIGH

## Executive Summary

v1.6 adds private GitHub marketplace support by wiring GitHub Device Flow OAuth into
the existing `marketplace add` and `marketplace update` git operations. The approach:
try `git credential fill` first (silent reuse from OS keychain); trigger Device Flow
only on a cache miss or 401; store the resulting token via `git credential approve`;
evict via `git credential reject` on `onAuthFailure`.

No new npm runtime dependencies needed. Two new files
(`platform/git-credential.ts`, `domain/github-auth.ts`) plus targeted changes to
`platform/git.ts`, `orchestrators/marketplace/shared.ts`, `add.ts`, and `update.ts`.

The codebase's existing `GitOps` injection seam is the correct extension point. Auth
callbacks thread as an optional `onAuthRequired` field through the interface.
All keychain side-effects live in `platform/git.ts`; all OAuth protocol logic lives
in `domain/github-auth.ts`, consistent with the existing zone model.

## Stack Additions

No new npm runtime dependencies.

**New modules (hand-rolled, ~50 lines each):**
- `platform/git-credential.ts` -- `git credential fill/approve/reject` subprocess wrapper using `pi.exec`; graceful ENOENT degradation when `git` is not on PATH
- `domain/github-auth.ts` -- Device Flow state machine using global `fetch`; injectable `DeviceFlowHttp` + `CredentialOps` seams for tests

**Prerequisite (must land first):**
- Fix duplicate `GitCredentials` type declaration in `platform/git.ts`

**isomorphic-git async callback support confirmed:**
- `onAuth` and `onAuthFailure` return `Promise<GitAuth | void>` -- isomorphic-git awaits them; a full Device Flow polling loop is valid inside either
- No internal auth-callback timeout; loop contract: "keep retrying while credentials returned; return `{ cancel: true }` or `void` to stop"

**OAuth App token lifetime:** OAuth App tokens do not expire -- no refresh handling needed for v1.6.

## Feature Table Stakes

| Feature | Notes |
|---------|-------|
| `git credential fill` check before Device Flow | Silent reuse; Device Flow only on miss |
| Display `user_code` + `verification_uri` + expiry hint | Via `ctx.ui.notify` only |
| Non-blocking poll loop respecting server `interval` | Async; `slow_down` adds 5 s cumulatively |
| Handle `expired_token` and `access_denied` | Exit loop; actionable error message |
| `git credential approve` on success | OS keychain persistence |
| `git credential reject` on `onAuthFailure` | Evict stale token before re-auth |
| Both `clone` (add) and `fetch` (update) paths wired | `add.ts` and `update.ts` call sites |
| No env-var dependency | Current env-var path removed |
| Fix duplicate `GitCredentials` type | `npm run check` must stay green |

## Feature Differentiators (deferred from v1.6)

| Feature | Deferral Reason |
|---------|-----------------|
| `marketplace auth logout` subcommand | Useful but adds surface area |
| Clipboard copy of `user_code` | OS-detection complexity |
| Automatic browser open | URL already visible in notification |

**Anti-features to avoid:** PAT fallback prompt, token in URLs, token in `state.json`,
token in `ctx.ui.notify` output, OAuth web flow (requires redirect server), silent
re-auth on every command.

## Architecture Overview

**New components:**
1. `platform/git-credential.ts` -- subprocess wrapper; depends only on `pi.exec`
2. `domain/github-auth.ts` -- Device Flow state machine; accepts injectable `DeviceFlowHttp` + `CredentialOps`; `notifyFn: (msg: string) => void` callback keeps domain ignorant of full `ctx` type and avoids Block A ESLint zone widening

**Modified components:**
- `platform/git.ts` -- add optional auth callbacks to `CloneOptions`/`FetchOptions`; add `buildAuthCallbacks` helper; delete duplicate type
- `orchestrators/marketplace/shared.ts` -- add optional `onAuthRequired` to `GitOps.clone`/`fetch`; thread through `DEFAULT_GIT_OPS` and `refreshGitHubClone`
- `orchestrators/marketplace/add.ts` -- construct and pass auth closure in `addGithubInGuard`
- `orchestrators/marketplace/update.ts` -- pass auth closure in `refreshRecord`

**Output catalog impact:** one new `ctx.ui.notify` message pattern for the Device
Flow prompt must be registered in `docs/output-catalog.md` and the catalog UAT fixture.

**Build order:**
A (type fix) → B (git-credential) → C (github-auth) → D (git.ts wiring) → E (GitOps threading) → F (orchestrators + catalog) → G (green gate)

## Critical Pitfalls

1. **`slow_down` interval is cumulative (CP-1)** -- Each `slow_down` adds 5 s to `currentInterval` permanently. Use `let currentInterval = initial` and `currentInterval += 5` per slow-down. Test: two consecutive slow-downs produce `initial + 10` on third poll.

2. **`onAuthFailure` infinite loop (CP-9)** -- isomorphic-git retries as long as the callback returns credentials. Guard with a `boolean authAttempted` flag in the closure: first failure triggers Device Flow; second failure returns `{ cancel: true }` after `git credential reject`.

3. **`git credential` stdin hang (CP-5)** -- Write blank-line terminator AND call `child.stdin.end()` explicitly. Missing either hangs the subprocess indefinitely.

4. **`CredentialOps` test injection required (TI-1)** -- Tests without a mock call the developer's live OS keychain. Define `CredentialOps` interface before the first test. Follow the `GitOps`/`makeMockGitOps` pattern.

5. **Token security (SEC-1, SEC-3)** -- Token must never appear in `state.json`, error messages, or `ctx.ui.notify`. Only `user_code` and `verification_uri` go through notify. Architecture test: no credential field in state write functions.

**Additional:**
- CP-6: `git credential fill` exits non-zero with empty stdout when no credential stored -- return `null`, not empty `GitAuth`
- CP-10: exceptions from `onAuth`/`onAuthFailure` propagate raw -- wrap in `try/catch`; return `{ cancel: true }` on unexpected errors
- SEC-2: isomorphic-git error messages include repo URL -- strip URL from errors forwarded to `ctx.ui.notify`
- SEC-4: always call `git credential reject` before re-triggering Device Flow; skipping leaves a broken credential permanently

## Open Questions

1. **OAuth App `client_id`:** A GitHub OAuth App must be registered before v1.6 ships. The constant in `domain/github-auth.ts` will be a placeholder until then. Operational gap.

2. **Block A ESLint zone:** Pre-bound `notifyFn` callback (recommended) vs. widening the Block A exemption list for `domain/github-auth.ts`. Resolve in Phase F planning.

3. **CP-8 macOS keychain duplicate entries:** Defensive mitigation already specified (`reject` before `approve` on rotation). Validate during manual integration testing on macOS.

## Sources

- [GitHub Device Flow -- OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [git credential wire format](https://git-scm.com/docs/git-credential)
- [isomorphic-git authentication](https://isomorphic-git.org/docs/en/authentication)
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- `extensions/pi-claude-marketplace/platform/git.ts` (codebase)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (codebase)

---
*Research completed: 2026-06-01*
*Ready for roadmap: yes*
