# Phase 3: API Coverage

No external API integration: this phase adds a git-tag-listing operation against
marketplace and plugin source repositories that are already in scope, using the
git library this project already declares as a direct dependency, through the
single existing `platform/git.ts` chokepoint — it is existing, NFR-5-governed git
infrastructure, not a new external API, SDK, or service integration.

The deterministic detector returned `detected: false` on the phase scope at
planning time. This declaration is recorded so the `verify:pre` gate has a
resolution on file regardless of how the detector scores the finished plan
bodies, which name library wrappers and injected seams.

**Capability added:** `listRemoteTags` in
`extensions/pi-claude-marketplace/platform/git.ts`, a wrapper over the already-
imported `isomorphic-git` server-ref listing call with a tag prefix — the same
call `resolveRemoteRef` already makes, with one option different. No new
dependency, no new host, no new credential path, no new protocol.

**Not in scope, and deliberately so:** no HTTP client, no REST or GraphQL
surface, no webhook, no OAuth flow beyond the existing host credential bundle,
and no subprocess. The project's shell-out allow-list is closed at three modules
and `platform/git.ts` is not one of them, which is why the tag query is a library
call rather than a `git ls-remote` subprocess.

*Declared: 2026-09-14*
