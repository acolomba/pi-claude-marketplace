---
phase: 22-install-failure-reasons
plan: 01
subsystem: install failure messaging
tags: [install, cascade, reconcile, git, reasons]
requires: [INR-01, INR-02, INR-03, INR-04]
key-files:
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - features/plugin/git-source.feature
    - features/plugin/install-dependencies.feature
    - features/step_definitions/plugin/git-source.steps.ts
decisions: [D-03, D-04, D-05, D-07, D-08, D-09, D-10]
requirements-completed: [INR-01, INR-02, INR-03, INR-04]
---

# Plan 22-01 Summary: Install failure reasons

Every install failure the phase targets now renders its reason.

## What changed

- **INR-01:** the cascade member arm (`install-cascade.messaging.ts::memberReasons`)
  classifies the member's ledger error with `classifyGitHostFailure`; a
  rollback partial still wins. `classifyOrchestratorThrow` consults the same
  ladder before `narrowProbeError`, so `/reload` of a declared git plugin whose
  clone the host refuses reads `{source missing}` / `{network unreachable}` /
  `{network error}` / `{authentication required}` instead of `{unreadable}`. A
  declared plugin whose dependency was refused keeps `{dependency failed}` on
  `/reload` (D-05).
- **INR-02:** `appendLeakToError` returns a typed `CleanupLeakError` (same
  message and cause). `classifyGitHostFailure` and
  `classifyGitSourceAccessFailure` classify the error behind any leak
  wrappers (`withoutCleanupLeaks`). The standalone auth row keeps its cause when
  a leak wrapped it, so the manual-cleanup hint is not lost (D-08).
- **INR-03:** `materializePluginClone` turns a fresh clone's
  `CommitNotFetchedError` (with or without the ref-hint refetch) into
  `PinnedCommitMissingError`, which `classifyGitHostFailure` maps to
  `source missing`.
- **INR-04:** `checkInstalledMember` reports the member's declared ranges
  (`"^2.0.0"`) instead of the normalized intersection, matching the
  contradictory-declarations arm and Claude Code.

## Tests

- Cucumber (`git-source.feature`): a 3-row Outline for a dependency refusal
  (404 / dropped / 503), a declared plugin's refusal on a new session, a
  declared plugin's dependency refusal on a new session, a pin the repository
  lacks. New step: "the marketplace ... pins the plugin ... to a commit its
  repository lacks". `install-dependencies.feature`'s installed-unsatisfied
  cause now reads `"^2.0.0"`.
- Unit: `errors.test.ts` (CleanupLeakError name, `withoutCleanupLeaks`,
  `PinnedCommitMissingError`), `git-failure-classifiers.test.ts` (missing pin,
  leak-wrapped host answer, leak-wrapped missing pin, leak-wrapped
  NotFoundError for source access), `clone-cache.test.ts` (both unreachable-pin
  paths now assert the typed error), `install-cascade.test.ts` (declared ranges),
  `install-cascade.messaging.test.ts` (member git reason),
  `install.messaging.test.ts` (auth + leak keeps cause),
  `apply-outcomes.test.ts` (host 404 → source missing).

## Deviations

- `test/orchestrators/marketplace/add.test.ts`: two MA-14 cases compared the
  leak wrapper with `new Error(...)`; they now expect `CleanupLeakError`.
- Review fixes (22-REVIEW-FIX.md): the transport ladder and `hostHttpStatus`
  also read through leak wrappers; a dependency's failed marketplace add reads
  its own reason on the cascade row and on `/reload`; the missing-pin message
  reads "A fresh clone from the git host does not hold the commit <sha>".
- After verification: `classifyOrchestratorThrow` probes the error behind a
  cleanup leak, so non-git reasons survive a leak on `/reload` too.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
