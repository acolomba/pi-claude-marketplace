---
quick_id: 261019-fvd
slug: marketplace-add-network-error-reason
status: complete
commit: d430aca1
---

# Quick 261019-fvd Summary

`marketplace add` now reports an HTTP answer from the git host the way
`marketplace update` does (UPD-11). A status other than 401/403 (auth) and
404/410 (`source missing`, ADD-09, kept by operator decision A) fails as
`{network error}`. A failed child row carries the reason, and its cause line
opens with `{status} on {url}`. Connection errno codes keep
`{network unreachable}`.

## Changes

- `shared/git-failure-classifiers.ts`: `hostHttpStatus` moved here from
  `update.ts`; new `hostHttpFailureFrame`; `classifyGitSourceAccessFailure`
  maps 404/410 to `source missing` and any other unclassified status to
  `network error` (418 and 600 were unclassified before).
- `orchestrators/marketplace/update.ts`: uses the shared helpers; behavior
  unchanged.
- `orchestrators/marketplace/add.ts`: a standalone `network error` row takes the
  synthetic child with the frame. Orchestrated callers (reconcile, import) get
  the `network error` reason with their existing bare row.
- `docs/output-catalog.md` + fixture: new `add-host-http-error` state; catalog
  count pins moved to 290 states.
- ADD-10 and Phase 9 success criterion 3 now say `network error` with the
  status and URL. UPD-11 had no add clause. No feature scenario covers add HTTP
  errors yet (Phase 9 is pending).

## Verification

`npm run check` passed (static, unpaired, integration, 208 cucumber scenarios,
direct coverage) before the commit.

## Deviations

Planned and executed inline by the orchestrator instead of spawning
gsd-planner and gsd-executor, because the context was already gathered.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
