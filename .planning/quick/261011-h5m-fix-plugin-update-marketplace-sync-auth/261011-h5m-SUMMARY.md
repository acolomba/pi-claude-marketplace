---
quick_id: 261011-h5m
slug: fix-plugin-update-marketplace-sync-auth
status: complete
issue: https://github.com/acolomba/pi-claude-marketplace/issues/249
---

# Summary: fix plugin update marketplace sync auth

`/claude:plugin update` now authenticates its once-per-run refresh of a
GitHub-source marketplace clone. Before, a private marketplace always failed
with `{authentication required}`.

## Changes

- `orchestrators/plugin/update-flow.ts`: `makeSyncCloneOnce` takes the update
  options and builds one GitHub auth bundle with `buildAuthForHost`
  (`GITHUB_HOST`, `opts.ctx`, `opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS`,
  `opts.deviceFlowHttp`, `opts.authMemo`). It passes the bundle to
  `refreshGitHubClone`, which forwards it to `gitOps.fetch`.
- `tests/orchestrators/plugin/update-flow.test.ts`: two tests.
  - The sync fetch carries a `device-flow` bundle for `github.com` with the
    caller's `credentialOps` and the run's `authMemo`. It fails on the
    unfixed code (`auth` is `undefined`).
  - An HTTP 401 on the sync fetch renders
    `official (failed) {authentication required}`.
- `CHANGELOG.md`: Unreleased entry.

## Analysis

- `update-flow.ts` held the only `refreshGitHubClone` call without auth.
- Reinstall is not affected. It never refreshes the marketplace clone, and
  `probeReinstallClone` builds its bundle with `buildCloneAuth`.
- The autoupdate cascade (`updateSinglePluginWith`) never calls
  `syncCloneOnce`, so it needs no stored-credential fallback.
- Not fixed: `makeSyncCloneOnce` does not refresh `url`-source marketplaces,
  so `/claude:plugin update` reads their cached manifest.

## Verification

`npm run check` passed in the worktree.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
