---
quick_id: 261019-fvd
slug: marketplace-add-network-error-reason
type: quick
---

# Quick 261019-fvd: marketplace add reports host HTTP errors as network error

`marketplace add` must classify an HTTP answer from the git host the way
`marketplace update` does since 31ee314d (UPD-11). The operator decided
(2026-10-19, option A) that 404/410 stay `{source missing}` on add (ADD-09).
Every other status outside the 401/403 auth challenge renders `{network error}`,
and the first cause frame is `{status} on {url}`. Connection errno codes keep
`{network unreachable}`.

## Tasks

1. **Share the update-side helper.** Move `hostHttpStatus` from
   `orchestrators/marketplace/update.ts` to `shared/git-failure-classifiers.ts`,
   add `hostHttpFailureFrame(err, remoteUrl)` there, and make
   `classifyGitSourceAccessFailure` map 404/410 to `source missing` and any
   other unclassified status to `network error`. `update.ts` uses the shared
   helpers. Verify: `tests/shared/git-failure-classifiers.test.ts`.
2. **Render the add row.** In `orchestrators/marketplace/add.ts`, a
   `network error` failure renders a synthetic failed child row whose cause
   opens with the frame, rebuilt from the typed github or url source. Verify:
   `tests/orchestrators/marketplace/add.test.ts` (hermetic home).
3. **Docs and pins.** Add the `add-host-http-error` catalog state and fixture,
   move the catalog count pins, and update ADD-10 and Phase 9 success criterion
   3. No feature scenario covers add HTTP errors yet (Phase 9 is pending).
   Verify: `npm run check`.
