---
phase: 24-import-reasons
plan: 01
status: complete
requirements: [IMP-08, IMP-09, IMP-10]
requirements-completed: [IMP-08, IMP-09, IMP-10]
---

# Phase 24 Plan 01: Import Reasons Summary

Import's rows now carry the reasons and statuses `install` and reconcile give
the same facts.

## What changed

- **IMP-08** -- `dispatchFailedOutcome` narrows a `not-installable` /
  `no-longer-installable` shape error through install's own
  `narrowResolverReasons` (now exported). `ImportWarningOutcome` is a union
  whose `uninstallable` member requires `reasons`, so the row cannot fall back
  to a generic token. A fresh import of a plugin with an output style reads
  `(unavailable) {unsupported component}`; `{no longer installable}` left
  import.
- **IMP-09** -- an unclassified failure records the reason install reads off
  the same error (an `InstallMarketplaceAddError`'s add reason, or the git
  host's answer from `classifyGitHostFailure`) as `runtimeReason` and renders
  it as the only reason, or no reason at all; the `authentication required` row drops its
  cause line, as install's does. `{not in manifest}` now marks only a plugin
  the marketplace does not list.
- **IMP-10** -- the enable path stores the enable outcome's degradation
  signals (`degradationFromEnable`, moved from `reconcile/apply.ts` to
  `plugin/shared.ts` beside `LedgerDegradationSignals`, with a direct test) as
  `enableSignals`, and the row is reconcile's `enabledRowFromOutcome` (now
  exported from `reconcile/notify.ts`). Import's row set gains
  `partially-installed`.
- **Held dependency** -- a real-disk unit case: a record held down by the
  load-time check stays disabled and reads `(skipped) {already installed}`.
- Two `import.feature` scenarios (unavailable with install's reason; partial
  re-enable reads `(partially-installed)`), updated unit expectations, a new
  git-host case, the catalog prose for import, and one stale comment in
  `reconcile/apply-outcomes.ts`.

## Deviations

- Plan named a `partialable` status split; per D-02 import keeps
  `(unavailable)` because it has no `--partial` flag.
- `degradationFromEnable` is reused rather than re-implemented. `apply.ts`
  pins a one-export surface (`apply.test.ts`), so the function moved to
  `plugin/shared.ts` beside the signals type (`reconcile/apply-outcomes.ts` was
  tried first; fallow flagged duplicate type exports once import reached it).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
