---
quick_id: 261011-jgu
slug: url-source-marketplace-refresh-on-plugin
mode: quick
---

# Refresh url-source marketplaces on plugin update

`/claude:plugin update` refreshes each marketplace once per run before it
reads the manifest (PUP-2, `makeSyncCloneOnce` in
`extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`). Only
the `github` arm fetches. A `url` marketplace falls through to the path-source
noop, so the update reads the manifest of a stale clone and never sees a new
plugin version.

## Analysis

`marketplace add` accepts three source kinds: `github`, `url`, and `path`.
Every other kind is refused, so no other record can reach the sync.

- `github`: fetched through `refreshGitHubClone` with the run's auth bundle.
- `path`: `manifestPath` and `marketplaceRoot` point into the user's own
  directory. `loadMarketplaceManifest` re-stats the file on every read, so an
  edit is seen on the next update. No refresh is needed (NFR-5).
- `url`: not refreshed. This is the gap.

`marketplace update` already refreshes a `url` record with `refreshUrlClone`
in `orchestrators/marketplace/update.ts`: a host-keyed auth bundle and one
extra cause line on an auth failure for a stored-credential host (GAUTH-04).
A plugin ledger cannot import `marketplace/update.ts` (BLOCK C), so the helper
moves to `orchestrators/marketplace/shared.ts`, the module that plugin ledgers
may import.

## Tasks

### Task 1: Share the url refresh

- files: `orchestrators/marketplace/shared.ts`,
  `orchestrators/marketplace/update.ts`
- action: move `refreshUrlClone` to `shared.ts` and export it. It takes the
  clone directory, the `UrlSource`, `gitOps`, the auth inputs (`ctx`,
  `credentialOps`, `deviceFlowHttp?`, `authMemo?`), and an optional
  `onFetchSucceeded`. `refreshRecord` calls the shared copy.
- done: one `refreshUrlClone` in the tree. The existing `marketplace update`
  url tests pass unchanged.

### Task 2: Refresh url marketplaces in the plugin update sync

- files: `orchestrators/plugin/update-flow.ts`
- action: add a `url` arm to `makeSyncCloneOnce` that calls the shared
  `refreshUrlClone` with the run's `ctx`, `credentialOps`, `deviceFlowHttp`,
  and `authMemo`.
- done: a `url` marketplace is fetched once per run, with an auth bundle for
  its own host.

### Task 3: Tests

- files: `tests/orchestrators/plugin/update-flow.test.ts`
- action: next to the PUP-2 tests, add:
  1. Two plugins in one `url` marketplace: the sync fetches the clone once,
     and the fetch carries an auth bundle for the url host.
  2. A `url` marketplace whose remote advanced: the update reads the new
     manifest and moves the plugin to the new version.
  3. A `path` marketplace whose manifest changed on disk after the add: the
     update reads the new manifest with no git call.
- verify: tests 1 and 2 fail on the unfixed code.

## Verification

`npm run check` passes in the worktree.
