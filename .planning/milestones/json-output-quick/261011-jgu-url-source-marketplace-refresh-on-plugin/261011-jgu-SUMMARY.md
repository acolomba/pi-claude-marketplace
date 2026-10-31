---
quick_id: 261011-jgu
slug: url-source-marketplace-refresh-on-plugin
status: complete
---

# Summary: refresh url-source marketplaces on plugin update

`/claude:plugin update` now fetches a `url`-source marketplace once per run
before it reads the manifest, the same way it fetches a `github` one. Before,
it read the clone from the last `marketplace add` or `marketplace update`.

## Source kinds

`marketplace add` accepts `github`, `url`, and `path`, and refuses every
other kind. After this change, each kind reaches its marketplace on update:

- `github`: fetched, with the GitHub auth bundle.
- `url`: fetched, with an auth bundle for the url host. A Device Flow host
  (gitlab.com) shares the run's `authMemo`.
- `path`: read in place from the user's directory. The manifest cache
  re-stats the file on every read, so an edit is seen without a git call.

## Changes

- `orchestrators/marketplace/shared.ts`: `refreshUrlClone` moved here from
  `marketplace/update.ts` and is exported. It takes an args object and
  accepts `authMemo`. Plugin ledgers may import this module (BLOCK C).
- `orchestrators/marketplace/update.ts`: `refreshRecord` calls the shared
  copy. Behavior is unchanged.
- `orchestrators/plugin/update-flow.ts`: `makeSyncCloneOnce` has a `url` arm
  that calls `refreshUrlClone` with the run's auth inputs.
- `tests/orchestrators/plugin/update-flow.test.ts`: four tests.
  - Two plugins in one `url` marketplace: one fetch, with a stored-credential
    bundle for `example.com`.
  - A `url` marketplace on gitlab.com: the bundle is a Device Flow bundle
    that returns the run's memoized result.
  - A `url` remote that advanced: the plugin moves to the new version.
  - A `path` manifest edited on disk: the second update reads the edit, with
    no git call.
  - The first three fail on the unfixed code.
- `tests/orchestrators/marketplace/shared.test.ts`: direct tests for
  `refreshUrlClone`, including each arm of the stored-credential cause line.
- `CHANGELOG.md`: Unreleased entry.

## Notes

- A `url` source on github.com cannot exist in state: `loadState` migrates
  it to `github` (D-76-02). The GAUTH-05 test in
  `tests/orchestrators/marketplace/update.test.ts` says its `GitHub.com` url
  stays a `url` source, but `parsePluginSource` returns `github` for it. The
  test still passes, because the github arm builds the same bundle. Not
  changed here.

## Verification

`npm run check` and `fallow audit --base origin/main` pass in the worktree.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
