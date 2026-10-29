---
phase: 07-git-errors-and-lock-discipline
plan: 06
subsystem: plugin-update-failure-classification
tags: [update, autoupdate, cascade, git, classifier, cucumber]

requires:
  - phase: 07-01
    provides: "classifyGitFailure(error, rule, remoteUrl?) with the per-operation 404 rule"
  - phase: 07-02
    provides: "collectPluginClonesLocked bindings in update-flow.ts (kept as they are)"
provides:
  - "One update failure ladder (classifyUpdateFailure) shared by the direct path and the autoupdate and converge cascades (GLK-02, D-PL7-04)"
  - "Cascade rows carry the error as their cause on the git, errno, and fallback arms (D-PL7-12)"
  - "A plugin update's github/url marketplace refresh frames a host HTTP status as MarketplaceUpdateError(`<status> on <wire url>`) and reads `network error`, 404 included (GLK-01, D-PL7-02/03/14)"
affects: [07-07, 07-08, 07-10, apply converge row, docs/output-catalog.md update-host-failure]

actuals:
  tokens: 9903
  tasks: 2
  commits: 2
plan_head_before: 113dec9eb91ce506401dac5bcd52cb05ccb0f37d
plan_head_after: cb6627464c4df197858bd16048227820c814f21c

tech-stack:
  added: []
  patterns:
    - "One classifier returns { reason, typed } so the cascade can attach the cause only to untyped arms"
    - "A refresh wrapper rethrows a classified HTTP failure as a framed MarketplaceUpdateError and every other failure unchanged"

key-files:
  created:
    - features/plugin/url-marketplace-update.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - features/plugin/update-rollback.feature
    - features/marketplace/update.feature
    - features/step_definitions/marketplace/update.steps.ts
    - features/lib/published-marketplace.ts

key-decisions:
  - "Cascade causes stay raw (the thrown error), not path-redacted, so the autoupdate twin shows exactly the direct row's `{mcp-adapter.json read error}` on Node 24 and Node 26"
  - "The installed-order autoupdate scenario fails its plugin on an unreadable command file, because the unreadable skill file's copy error names a random staging directory"
  - "MarketplaceUpdateError joins the shared typed arm and reads its cause under the marketplace-refresh rule"

patterns-established:
  - "Error token `{unreadable command file read error}`: the step reads the file with the call the commands bridge makes and records the message"

requirements-completed: [GLK-01, GLK-02]

coverage:
  - id: D1
    description: "Direct and cascade update failures share one ladder; the cascade attaches the cause on untyped arms"
    requirement: GLK-02
    verification:
      - kind: unit
        ref: "node --test --test-name-pattern 'GLK-02|D-PL7-12|MCP collision|D-26 / PUP-9' test/orchestrators/plugin/update-flow.test.ts"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/update-rollback.feature --name 'An autoupdate that fails in its mcp phase reports the cause the direct update reports'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin update's marketplace refresh reports a host 5xx or 404 as network error with the marketplace update frame"
    requirement: GLK-01
    verification:
      - kind: unit
        ref: "node --test --test-name-pattern 'GLK-01|syncClone' test/orchestrators/plugin/update-flow.test.ts"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/url-marketplace-update.feature"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-10-27
status: complete
---

# Phase 7 Plan 06: Shared update failure ladder and framed marketplace refresh Summary

**`update` now classifies a failure the same way on the direct path and in the autoupdate and converge cascades. A cascade row carries the cause on its git, errno, and fallback arms. A plugin update's github or url marketplace refresh reports a host HTTP status as `{network error}` with the `<status> on <url>` frame, the same as `marketplace update`.**

## Performance

- **Duration:** about 95 min (each commit hook took about 10 min)
- **Started:** 2026-10-27T~09:00Z
- **Completed:** 2026-10-27
- **Tasks:** 2
- **Files modified:** 7 (1 created)

## Accomplishments

- `update-flow.ts` has one ladder, `classifyUpdateFailure(err) -> { reason, typed }`. It narrows a `CleanupContextError` to its primary, then tries the typed arm `typedUpdateFailReason`, which is the old direct set plus `MarketplaceUpdateError`. Then it tries the untyped arm `untypedUpdateFailReason`: `classifyGitFailure` with `{ notFound: "source missing" }`, then the errno through `failureErrno` (which unwraps `BridgeStagingError`), then `unreadable manifest`. `notifyDirectFailure`, `notifyBareFormEnumerateFailure`, and `cascadeFailureOutcome` all call it. `reasonsFromTypedError`, `narrowDirectFailReason`, `narrowErrnoFailReason`, `cascadeErrno`, and the `classifyGitTransportFailure` import are gone.
- `cascadeFailureOutcome` attaches `cause: err` when the reason came from an untyped arm and `err` is an Error (D-PL7-12). It keeps the cleanup-failure, `StateLockHeldError`, and `DependencyDeclarationsUnreadableError` attachments. The cleanup spread comes after the new one, so a cleanup leak keeps its raw `err`.
- `makeSyncCloneOnce` runs the github and url refreshes through `refreshFramed(source, refresh)`. When `classifyGitFailure(err, { notFound: "network error" }, networkCloneUrl(source))` gives a frame, it throws `new MarketplaceUpdateError(frame, { cause: err })`. Otherwise it rethrows `err` unchanged, so a 401, a dropped connection, GHB-03, and errno failures keep their bytes.

**Intended direct-path effects of sharing the ladder** (the plan names both):
1. On the direct path, a `BridgeStagingError` now reads its cause's errno reason (D-13), for example `permission denied` (unit case "GLK-02 / D-13: a direct update whose staging error wraps EACCES reads permission denied").
2. On the direct path, a `PinnedCommitMissingError` now reads `source missing`, through `classifyGitFailure`. A direct host 5xx outside the marketplace refresh now reads `network error`, and a 404 reads `source missing`.

Also, a cascade row now maps the typed errors it used to send to `not in manifest`: `MarketplaceNotFoundError` -> `not found`, `PluginUpdatePhase3Error` -> `rollback partial`, `InvalidMarketplaceManifestError` -> `invalid manifest`, and the two layer-only errors -> their tokens.

## Task Commits

1. **Task 1: one ladder for the direct and cascade paths, proved by the autoupdate twin of the mcp-phase failure** - `5da5768c` (fix)
2. **Task 2: the plugin update's marketplace refresh classifies and frames a host HTTP answer** - `cb662746` (fix)

**Plan metadata:** this SUMMARY commit (docs).

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` - the shared ladder, cascade cause attachment, `MARKETPLACE_REFRESH_RULE`, `refreshFramed`, and the `MarketplaceUpdateError` typed arm
- `test/orchestrators/plugin/update-flow.test.ts` - the MCP-collision pin moved to `unreadable manifest` with its cause; the D-26 converge throw now expects `cause`; new cases for cascade EISDIR -> `unreadable` + cause, cascade `MarketplaceNotFoundError` -> `not found`, direct `BridgeStagingError(EACCES)` -> `permission denied`, and GLK-01 github 503, github 404, and url 502 framed rows
- `features/plugin/update-rollback.feature` - new scenario "An autoupdate that fails in its mcp phase reports the cause the direct update reports"
- `features/plugin/url-marketplace-update.feature` - new "Feature: Plugin url marketplace update", an outline over 500, 502, 503, and 404
- `features/marketplace/update.feature`, `features/step_definitions/marketplace/update.steps.ts`, `features/lib/published-marketplace.ts` - see Out-of-line edits

## Verification

| Command | Exit / result | Tree |
|---|---|---|
| `node --test --test-name-pattern 'GLK-02\|D-PL7-12\|MCP collision\|D-26 / PUP-9' test/orchestrators/plugin/update-flow.test.ts` | 0, 5/5 pass | Task 1 |
| `node --test test/orchestrators/plugin/update-flow.test.ts` | 0, 250/250 | Task 1 |
| `node --test` over `test/architecture/cross-op-convergence`, `edge/handlers/{marketplace,plugin}/update`, `edge/register`, `orchestrators/marketplace/update`, `orchestrators/plugin/{enable-disable,update-preflight}`, `orchestrators/reconcile/*` | 0 | Task 1 |
| `npx cucumber-js features/plugin/update-rollback.feature features/marketplace/update.feature features/plugin/apply.feature features/plugin/update.feature features/plugin/update-dependencies.feature` | 0, 172 scenarios | Task 1 |
| `npm run check:features` | 0 | Task 1 |
| commit hook `npm run check:commit` | Passed | 5da5768c |
| `node --test --test-name-pattern 'GLK-01\|syncClone' test/orchestrators/plugin/update-flow.test.ts` | 0, 8/8 (the 401 cases unchanged) | Task 2 |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` | 0 (100%) | Task 2 |
| `npx cucumber-js features/plugin/url-marketplace-update.feature features/plugin/update.feature features/marketplace/url-source-update.feature features/plugin/update-rollback.feature features/marketplace/update.feature` | 0, 127 scenarios | Task 2 |
| `node --test test/orchestrators/plugin/update-flow.test.ts test/edge/handlers/plugin/update.test.ts test/orchestrators/marketplace/update.test.ts` | 0, 395/395 | Task 2 |
| `npm run check:static` | 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | Task 2 |
| commit hook `npm run check:commit` | Passed | cb662746 |
| `npm run fallow` (unpiped, final tree) | **0** | cb662746 |
| `npm run typecheck` (unpiped, final tree) | **0** | cb662746 |

Node v26.12.1. I did not run the full `npm run check`; the orchestrator runs it at the wave gate.

Acceptance greps: `reasonsFromTypedError|narrowDirectFailReason|narrowErrnoFailReason` 0, `classifyGitTransportFailure` 0, `"not in manifest"` 0 in update-flow.ts; `outcome.reasons, ["unreadable manifest"]` 1 in the test; `new MarketplaceUpdateError(` 1; `notFound: "network error"` 1; the new feature's first line is `Feature: Plugin url marketplace update`.

### Scenarios fail without the change

- **Autoupdate twin (GLK-02):** I ran it before I changed any source, at `113dec9e`. It failed: the demo row read `not in manifest` with no `cause chain` / `cause truncated` columns, where `unreadable` and `{mcp-adapter.json read error}` were expected.
- **Url marketplace outline (GLK-01):** I ran it at the Task 1 commit `5da5768c`, before the Task 2 source change. All four rows failed. The 503 row read `network error`, but the cause was only `HTTP Error: 503 Service Unavailable` with no frame. The 404 row also read the plugin-clone `source missing`. At `113dec9e` the rows read `unreadable manifest`, the bare-transport reading that the plan describes.

## Deviations

**1. [Rule 3 - Blocking] The installed-order autoupdate scenario could not pin its new cause line.**
- **Found during:** Task 1 verification (`features/marketplace/update.feature`, "Autoupdate continues in installed order after a plugin fails", four rows).
- **Issue:** D-PL7-12 gives that `permission denied` row a cause line. Its cause is the skills bridge's raw `cp` error. On Node 26 that error names `{agent dir}/pi-claude-marketplace/skills-staging/<random uuid>/zeta-skill/notes.md`, and no run token can stand for a random directory (D-03: exact-substring tokens).
- **Tried and rejected:** I rebuilt the cascade cause with `redactCauseChain`, as import and the dependency cascades do. That pins the skill row as `{unreadable skill file copy error}`. But the autoupdate twin then reads `EISDIR: ..., read 'mcp-adapter.json'` on Node 26 and the bare `..., read` on Node 24. That differs from the direct row's raw `{mcp-adapter.json read error}`, and no feature text can pin it on both Node majors. So redaction breaks a must-have truth, and I reverted it.
- **Fix:** Causes stay raw, as the plan specifies. The scenario now fails `zeta` on an unreadable command file. The commands bridge wraps that failure in `BridgeStagingError`, and its source path is deterministic. The row reads `permission denied` with the cause `command "zeta:notes" of plugin "zeta" could not be staged, {unreadable command file read error}`. This also proves the D-13 unwrap in the cascade. Because zeta 1.10.0 gains a command, the scenario's later pending rows gain the reason `components now supported`, which Pi reports there.
- **Files:** `features/marketplace/update.feature`, `features/step_definitions/marketplace/update.steps.ts` (new step "the published plugin {string} of the marketplace {string} has an unreadable command file", which records `{unreadable command file read error}`), `features/lib/published-marketplace.ts` (`publishUnreadableCommandFile`).
- **Commit:** `5da5768c`.
- The skill-copy defect itself (a raw staging path in update causes) is out of scope. It is recorded in `deferred-items.md` under "From 07-06".

**2. Unit-case assertion shapes.** The plan asks for the MCP-collision cause to be "the thrown collision error". The case asserts `outcome.cause instanceof McpServerCollisionError` plus its `serverName` and `owningPath`. The EISDIR and D-26 cases assert `cause` by identity (`strictEqual`).

## Out-of-line edits

- `features/marketplace/update.feature`, `features/step_definitions/marketplace/update.steps.ts`, `features/lib/published-marketplace.ts`: the plan's Task 1 verify runs `features/marketplace/update.feature`, which failed because of the intended D-PL7-12 cause line (Deviation 1). No later plan of this phase lists these files.
- `.planning/phases/07-git-errors-and-lock-discipline/deferred-items.md`: one "From 07-06" entry.

## Notes for the orchestrator

- **07-01's `transportReason` row:** no scenario was added. `marketplace/update.ts::cascadeAutoupdates` only classifies a raw throw from `pluginUpdate`, and `beginPluginUpdateRun` is cascade-safe: `runCascadeTarget` catches everything except GHB-03, which is rethrown before classification. So no production path reaches the new HTTP or `PinnedCommitMissingError` mapping there. An autoupdate twin cannot cover that row without a fake `pluginUpdate`.
- Apply's converge row (`reconcile/notify.ts`) still drops the cause. This is deferred in CONTEXT. `apply.feature` passes unchanged.
- `docs/output-catalog.md` (`update-host-failure`) is not in this plan. 07-10 owns it and should describe the plugin-update refresh frame.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The frame is `gitHubWireUrl(networkCloneUrl(source))`, the URL the fetch already sent (T-07-11). The new cascade causes travel only as Error messages through `serializeCauseChain`, which redacts credentials. The cascade cause can now show the absolute local paths that the direct row already showed (Deviation 1). These are the user's own scope paths, not credentials.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
- FOUND: features/plugin/url-marketplace-update.feature
- FOUND: 5da5768c (ancestor of HEAD)
- FOUND: cb662746 (ancestor of HEAD)
