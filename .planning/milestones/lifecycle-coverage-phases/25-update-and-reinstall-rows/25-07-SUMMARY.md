---
phase: 25-update-and-reinstall-rows
plan: 07
subsystem: update-preflight
tags: [update, reinstall, autoupdate, backfill, source-missing, git-host, failed-row, SRC-01, UPR-03]

requires:
  - phase: 25-update-and-reinstall-rows
    provides: plan 06's record-first triage and plan 04's revisionVersionSlot
provides:
  - resolveUpdateCandidate's failed verdicts for a missing source, a refused host, and an unclassified throw (through the file-private candidateFailure / failedCandidate)
  - PreflightFailedOutcome and DirectRenderableFailedOutcome that admit fromVersion and cause, with toVersion, the commits, and phaseFailures still never
  - failed update rows on the manual cascade that show the installed version and the cause line
  - the autoupdate failed arm rendering an outcome's own reasons, an empty list included
  - reinstall's failed outcome carrying the run's cause, and its row keeping {unreadable} only when there is no reason and no cause
  - the update-source-missing, update-host-failure, and update-unclassified-failure catalog states
affects: [25-08 (no shared code), backfill (behavior only)]

actuals:
  tokens: 23300
  tasks: 3
  commits: 3
plan_head_before: 33bb3e1a661d81810a4c0055d8ea27f544f863f8
plan_head_after: 2128d0d98bf5a14c0bf7e747970126107fb5e0ef

tech-stack:
  added: []
  patterns:
    - "The catch keeps only the two rethrows (GHB-03, then GIT-03); one file-private helper, candidateFailure, returns every verdict, so resolveUpdateCandidate stays under both complexity caps"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts (comment only)
    - features/plugin/update.feature
    - features/plugin/reinstall.feature
    - features/plugin/git-source-update.feature
    - docs/output-catalog.md
    - docs/prd/pi-claude-marketplace-prd.md
    - test/architecture/catalog-uat/fixtures/plugin-update.ts
    - test/architecture/catalog-uat/fixtures/plugin-reinstall.ts
    - test/architecture/catalog-uat/fixtures/marketplace-update.ts

key-decisions:
  - "The candidate classification moved into one file-private helper, candidateFailure, called from the catch after the GHB-03 and GIT-03 rethrows (ESLint's cognitive-complexity cap tripped at 16 with the new arm inline)"
  - "The host ladder runs first in candidateFailure, as the transport ladder did; the partialable and resolver-shape arms follow; the unclassified arm is last"
  - "The cleanup-leak exception to the bare auth row is mirrored in the helper (`error instanceof CleanupLeakError`), not imported from install.messaging.ts"

requirements-completed: [SRC-01, UPR-03]

duration: 95min
completed: 2026-10-24
status: complete
---

# Phase 25 Plan 07: Missing and refused sources fail with their reason Summary

**`update` and `reinstall` now fail a plugin whose source directory is missing as `⊘ demo v1.0.0 (failed) {source missing}`. A clone or fetch that the git host refuses now fails with install's reason for the same answer and the error as its cause line. A throw that no ladder classifies now renders `⊘ hello v1.0.0 (failed)` with its cause line. Before, all of these rendered `(skipped) {no longer installable}` or a transport skip. Only a resolver refusal still skips.**

## Accomplishments

- `update-preflight.ts`: the catch of `resolveUpdateCandidate` still rethrows GHB-03 first and `StateLockHeldError` second (GIT-03). Then it returns `candidateFailure(error, options)`. That file-private helper returns these verdicts:
  - `classifyGitHostFailure` reason → a failed verdict with that reason, the installed version, and the thrown error as `cause`. The `authentication required` verdict has no cause, unless the error is a `CleanupLeakError`.
  - Partialable shape → the `partially-upgradable` skip, as before.
  - A `no-longer-installable` shape whose notes narrow to `source missing` → a failed verdict with `source missing` and the installed version, and no cause (the note embeds the absolute path).
  - Any other `no-longer-installable` shape → `skipped {no longer installable}`, as before.
  - Anything else → a failed verdict with `reasons: []`, the installed version, and the error as `cause` (a non-Error is wrapped in an `Error`). The debug log is gone.
- `failedCandidate` sits beside `skippedCandidate`. `classifyGitTransportFailure` is no longer imported (count 0). `narrowResolverNotes` and `classifyGitHostFailure` are imported on the existing `shared/` lines.
- `PreflightFailedOutcome` and `update-swap.ts::DirectRenderableFailedOutcome` admit `fromVersion` and `cause`. `toVersion`, `fromCommit`, `toCommit`, and `phaseFailures` stay `never`. The NFR-7 note in `materialize-latest.ts` names the slots that are still closed.
- `update-cascade.ts`: the failed arm spreads `revisionVersionSlot(outcome)` and the outcome's `cause`.
- `marketplace/update.messaging.ts`: the failed arm renders `outcome.reasons` as given, including an empty list. It uses the notes fallback only when the outcome has no reasons.
- `reinstall-record.ts`: the failed arm of `reinstallOutcomeFromRun` takes `cause` from the run. A phase-3 failure's error still wins.
- `reinstall.messaging.ts`: the failed row uses `{unreadable}` only when it has no reason AND no cause.
- Backfill needed no change. Its failed arm already emits a `plugin-install-failed` row for any failure other than `not installed`, and keeps its version gate open.

## Task Commits

1. Task 1: a missing path source fails update and reinstall as source missing. Commit `d35a6bc3`.
2. Task 2: a refused or failed clone names its reason and cause, on every caller. Commit `c834a497`.
3. Task 3: the catalog and the PRD describe the new failed rows. Commit `2128d0d9`.

## Answers the plan asked for

- **Cause chains the update outline in `git-source-update.feature` pins** (all at `version 1.0.0`, with one refused `GET /acme/ghp.git/info/refs?service=git-upload-pack`):
  - `answers 404` / `source missing`: `HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git`
  - `drops the connection` / `network unreachable`: `socket hang up, fetched https://{git host}/acme/ghp.git`
  - `answers 503` / `network error`: `HTTP Error: 503 Service Unavailable, fetched https://{git host}/acme/ghp.git`

  These are the same chains as install's outline in `git-source.feature`.
- **`marketplace update fixtures` in the source-missing scenarios:** kept. In both scenarios it reports only info results.
- **Catalog state count:** 306 after this plan (303 before). `EXPECTED_UTF8_BYTES` moved from 49_016 to 49_665. The wire test's `PRESENTED.length` moved from 313 to 316, and its emitted-key count from 303 to 306.

## Changed test expectations

| File | Case | Now |
| --- | --- | --- |
| `update-preflight.test.ts` | the transport case | five host cases (dropped, 404, 503, auth, auth behind a cleanup leak), each a whole failed verdict |
| `update-preflight.test.ts` | the unexpected EACCES case | failed, `reasons: []`, `fromVersion 1.0.0`, an EACCES cause |
| `update-preflight.test.ts` | new | source missing; a non-Error rejection on the pinned arm |
| `update-flow.test.ts` | CR-01 later marketplace removed | `aaa`'s `hello` (the fixture has no plugin directory) is now `⊘ hello v1.0.0 (failed) {source missing}` |
| `update-flow.test.ts` | swapState-version-advanced | see deviation 2 |
| `update-flow.test.ts` | MIRR-01 vanished repo, NFR-3 UserCanceledError | regex checks became the exact rows (`{network unreachable}` with its cause; the bare `{authentication required}`) |
| `reinstall-flow.test.ts` | PRL-13, PRL-15 (the `bad` plugin whose root was deleted) | `⊘ bad v1.0.0 (failed) {source missing}`, `1 failure` tally, `error` |
| `reinstall-flow.test.ts` | non-Error clone rejection, mirror clone failure | failed outcomes with `reasons: []`, the installed version, and the cause, retitled |
| `reinstall-flow.test.ts` | new | the source-missing reinstall; the cold-cache 404 reinstall (`⊘ gp v9.9.9 (failed) {source missing}` with `cause: HTTP Error: 404 Not Found`) |
| `edge/handlers/plugin/reinstall.test.ts` | cold git source | `⊘ far v1.0.0 (failed)` and `cause: reinstall must not open a network connection` at `error`. The double's throw is unclassified, so the row has no reason |
| `update-cascade.test.ts` | new | a preflight failure at its version; a failed outcome's cause line |
| `marketplace/update.messaging.test.ts` | empty notes-only case | it now leaves `reasons` out, because an empty list is rendered as given |
| `marketplace/update.messaging.test.ts`, `reinstall-record.test.ts`, `reinstall.messaging.test.ts` | new | an empty reason set with a cause; a preflight failure's cause |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The classification moved into a helper in Task 1, not Task 2**
- Found during: the Task 1 commit hook (`sonarjs/cognitive-complexity` 16 > 15 on `resolveUpdateCandidate`)
- Fix: `candidateFailure` holds every verdict arm. The catch keeps the GHB-03 rethrow and then the GIT-03 rethrow, in that order. `error instanceof StateLockHeldError` still appears once. The fence diff over `makeUpdateCloneProbe`..`deriveUpdateToVersion` printed nothing at every commit.
- Commit: `d35a6bc3`

**2. [Rule 1 - Vacuous test] swapState-version-advanced asserted only "no error"**
- Found during: Task 1. The `valid-marketplace` fixture has no `plugins/hello` directory. The update had always skipped as `no longer installable`, and the test passed only because a skip is a warning.
- Fix: the test creates the plugin directory, so the update really runs against the advanced `fromVersion`. It asserts the whole notification `● hello v0.0.10 → v1.0.0 (updated)`, which proves what its title claims.
- Commit: `d35a6bc3`

**3. [Rule 1 - Stale comment] `shared/git-failure-classifiers.ts`**
- The transport ladder's doc named update's `no longer installable` as a caller fallthrough. That fallthrough no longer exists, so the example now names only info's ladder. This is a comment-only change. The file's exports are unchanged (D-23).
- Commit: `c834a497`

**4. [Rule 3 - Duplication] One shared catalog fixture block**
- Found during: the Task 3 commit hook (`fallow dupes`). After the cause line was added, update's `single-mp-mixed` and `bare-multi-mp` fixtures had identical `official` blocks.
- Fix: both fixtures use one `OFFICIAL_MIXED_BLOCK` const in `fixtures/plugin-update.ts`.
- Commit: `2128d0d9`

**5. [Rule 2 - Clarity] Catalog prose for the reinstall rows**
- `single-mp-mixed-outcomes`, `single-mp-all-failed`, and reinstall's `bare-multi-mp` show `v1.0.0` on their `{source missing}` row. The first two now say why. The `{invalid manifest}` row stays version-less, as the plan asked.

No file owned by Phase 26 was staged. `probeUnpinned`, `makeUpdateCloneProbe`, `clone-cache.ts`, `fetch.ts`, `info.ts`, and `install-clone-probe.ts` were not edited.

## Behavior notes

- The autoupdate failed arm now renders every reason of an outcome, not just the first one. No preflight producer stamps more than one reason on a failed update outcome.
- Under backfill (D-17), a promotion whose source cannot be fetched now emits a `plugin-install-failed` row and keeps the gate open, so an offline load retries (T-25-15, accepted).

## Verification

- `npm run test:coverage:direct` on every task 1 and task 2 source, including `update-flow.ts`, `reinstall-flow.ts`, `edge/handlers/plugin/reinstall.ts`, `reconcile/backfill.ts`, and `shared/git-failure-classifiers.ts`: exit 0.
- `npm run test:architecture`: exit 0.
- Cucumber: `update.feature` and `reinstall.feature` (37 scenarios), and `git-source-update.feature`, `git-source.feature`, and `fetch.feature` (38 scenarios): all passed.
- `grep -c classifyGitHostFailure update-preflight.ts`: 2. `grep -c classifyGitTransportFailure update-preflight.ts`: 0. `grep -c narrowResolverNotes update-preflight.ts`: 2. `grep -c "fails as <reason> when the git host <refusal>" git-source-update.feature`: 1.
- `npm run check` at `2128d0d9`: exit 0, 757 of 757 scenarios.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-13 is mitigated: the cause of a host-failure row goes through `serializeCauseChain`, as install's runtime row does, and the bare auth row has no cause. T-25-14 is mitigated: the source-missing verdict has no cause, so the absolute path in the resolver's note never reaches a row. T-25-16 is mitigated: the GHB-03 rethrow is still first in the catch, and the existing GHB-03 preflight case passes unedited. T-25-15 is accepted as planned.

## Self-Check: PASSED

- Commits `d35a6bc3`, `c834a497`, and `2128d0d9` are ancestors of HEAD.
- `catalog-state: update-source-missing`, `catalog-state: update-host-failure`, and `catalog-state: update-unclassified-failure` each appear once in `docs/output-catalog.md`.
- `error instanceof StateLockHeldError` appears once in `update-preflight.ts`.
