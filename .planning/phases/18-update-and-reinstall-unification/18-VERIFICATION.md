---
phase: 18-update-and-reinstall-unification
verified: 2026-10-23T23:18:41Z
status: passed
score: 4/4 roadmap success criteria verified (plus 9/9 derived must-haves)
covered_files:
  - ".planning/phases/18-update-and-reinstall-unification/18-01-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-01-SUMMARY.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-02-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-02-SUMMARY.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-03-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-03-SUMMARY.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-04-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-04-SUMMARY.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-05-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-05-SUMMARY.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-06-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-06-SUMMARY.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-07-PLAN.md"
  - ".planning/phases/18-update-and-reinstall-unification/18-07-SUMMARY.md"
  - "docs/competitive-analysis/asermax-pi-cc-plugins.md"
  - "docs/competitive-analysis/pi-plugins.md"
  - "docs/dependency-resolution.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "docs/prd/pi-claude-marketplace-prd.md"
  - "extensions/pi-claude-marketplace/bridges/agents/index.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/agents/types.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/index.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/types.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/index.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/skills/index.ts"
  - "extensions/pi-claude-marketplace/bridges/skills/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/skills/types.ts"
  - "extensions/pi-claude-marketplace/bridges/workflows/stage.ts"
  - "extensions/pi-claude-marketplace/domain/plugin-resolver.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts"
  - "extensions/pi-claude-marketplace/orchestrators/types.ts"
  - "extensions/pi-claude-marketplace/persistence/state-io.ts"
  - "extensions/pi-claude-marketplace/shared/errors.ts"
  - "extensions/pi-claude-marketplace/shared/fs-utils.ts"
  - "extensions/pi-claude-marketplace/shared/markers.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/reinstall.feature"
  - "rule-packs/architecture.json"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/architecture/catalog-uat/catalog-parser.test.ts"
  - "test/architecture/catalog-uat/catalog-wire.test.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-reinstall.ts"
  - "test/architecture/gate-targets.ts"
  - "test/architecture/hooks-lifecycle.test.ts"
  - "test/architecture/manifest-lookup-drift.test.ts"
  - "test/architecture/no-test-only-production-surface.test.ts"
  - "test/architecture/partial-vocabulary-guard.test.ts"
  - "test/bridges/agents/index.test.ts"
  - "test/bridges/agents/stage.test.ts"
  - "test/bridges/agents/types.test.ts"
  - "test/bridges/commands/index.test.ts"
  - "test/bridges/commands/stage.test.ts"
  - "test/bridges/commands/types.test.ts"
  - "test/bridges/mcp/index.test.ts"
  - "test/bridges/mcp/stage.test.ts"
  - "test/bridges/skills/index.test.ts"
  - "test/bridges/skills/stage.test.ts"
  - "test/bridges/skills/types.test.ts"
  - "test/edge/handlers/plugin/reinstall.test.ts"
  - "test/edge/handlers/plugin/update.test.ts"
  - "test/integration/plugin-layer-verbs.test.ts"
  - "test/orchestrators/marketplace/update.messaging.test.ts"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/enable-disable.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/materialize-latest.test.ts"
  - "test/orchestrators/plugin/operations.test.ts"
  - "test/orchestrators/plugin/reinstall-flow.test.ts"
  - "test/orchestrators/plugin/reinstall-record.test.ts"
  - "test/orchestrators/plugin/reinstall.messaging.test.ts"
  - "test/orchestrators/plugin/update-cascade.test.ts"
  - "test/orchestrators/plugin/update-constraint-gate.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
  - "test/orchestrators/plugin/update-swap.test.ts"
  - "test/orchestrators/reconcile/backfill.test.ts"
  - "test/orchestrators/types.test.ts"
  - "test/persistence/state-io.test.ts"
  - "test/shared/fs-utils.test.ts"
  - "test/shared/markers.test.ts"
covered_digest: "v3:sha256:e1d1aedc502dafc124504765ea81462ec8201f8a6c03b48d159480aab0a853e3"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A cold-cache clone failure or a rejected clone seam reads `{source missing}`, not `{no longer installable}` (review IN-05)"
    addressed_in: "Phase 25"
    evidence: "Phase 25 goal: 'Update and reinstall rows always say which version and commit moved, and refusals match `uninstall`'; the `{source missing}` token is phase 20/25 work and the shared preflight is the one site"
  - truth: "A range-held reinstall row carries the constraint-disclosure cause line (review WR-07 remainder)"
    addressed_in: "Phase 25"
    evidence: "Phase 25 success criteria 2: 'partially-installed and failed update rows show the version and from/to where known' (row content of update and reinstall)"
  - truth: "`RemovalOps.rename` has no production caller after the replace path was deleted (review IN-06)"
    addressed_in: "Phase 26"
    evidence: "Phase 26 success criteria 2: 'Per-commit copies and tag clones use one copy-and-checkout helper' (the removal/copy port is reshaped there)"
  - truth: "The no-refresh mirror read is covered by the fetch lock, and one copy helper serves update, install, and reinstall"
    addressed_in: "Phase 26"
    evidence: "Phase 26 success criteria 1 and 2: 'fetch and info --fetch refresh the mirror under the state lock' / 'one copy-and-checkout helper'"
---

# Phase 18: Update and Reinstall Unification Verification Report

**Phase Goal:** After a marketplace update, `update` and `reinstall` behave as one operation that installs the latest known version and reports it truthfully.
**Verified:** 2026-10-23T23:18:41Z
**Tree:** branch `claude/lc-p18-update-reinstall-742f3f`, HEAD `dc9fe665` (milestone branch merged at `47da4fdc`; the 15 review-fix commits `a00fac45..d8fb1eab` sit on top of the merge)
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC-1 / REI-04: when the marketplace offers a newer version, `reinstall` installs it, and its row, the record, `list`, `info`, and the next session all show the new version | VERIFIED | `features/plugin/reinstall.feature:234` (row `reinstalled` 1.1.0 and record 1.1.0), `:251` (`list` 1.1.0), `:270` (`info` `plugin version` 1.1.0), `:293` (new session offers `A skill of demo 1.1.0.`). Code: `reinstallOutcomeFromRun` (`reinstall-record.ts:67`) maps `run.toVersion` onto the `reinstalled` row; the swap writes the record. All 744 scenarios passed in this run. |
| 2 | SC-2 / REI-01, REI-02: `reinstall` of an up-to-date plugin still restores deleted artifacts at the same version | VERIFIED | `reinstall.feature:142` (deleted skills restored, new session offers them at 1.0.0), `:157` (same version, record 1.0.0), `:170`, `:189`; REI-03 `:209`. Mechanism: `REINSTALL_MATERIALIZATION.skipSameRevision: false` (`reinstall-flow.ts:209-219`) bypasses the `unchanged` short-circuit at `update-preflight.ts:1007-1029`; unit test `materialize-latest.test.ts:176` "REI-01: a policy that does not skip the recorded revision restores its deleted skill". |
| 3 | SC-3 / UPR-01: `update` and `reinstall` share one materialization path; their remaining differences are target selection and messaging | VERIFIED | `materialize-latest.ts` (41 lines) runs `preparePluginUpdate` then `swapPluginUpdate`. Its only two production callers are `update-flow.ts:1183` (`runPluginUpdate`, after the layer refusal) and `reinstall-flow.ts:399`. `reinstall-flow.ts` imports no bridge and no swap or preflight function. Its remaining code is target selection, the `not installed` and `already disabled` skips, the layer refusal, post-success maintenance, and messaging, as D-05 allows. The per-verb behavior inside the runner is the three-knob `MaterializationPolicy` (`update-preflight.ts:127-146`), and the policy is now required (IN-02, `d4be53ab`). `reinstall-replace.ts`, `reinstall-clone-probe.ts`, and their tests are deleted, with no remaining reference in `extensions`, `test`, `features`, `rule-packs`, `eslint.config.js`, `.fallowrc.json`, or `sonar-project.properties`. |
| 4 | SC-4: `npm run check` stays green | VERIFIED | Run by the verifier on HEAD `dc9fe665` in a temp HOME: **exit 0**. Static checks (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) passed; unpaired and integration tests passed; cucumber 744/744 scenarios and 7033/7033 steps passed; direct coverage merged 279 records. |
| 5 | Phase 16 IN-01 / D-11: a record on the mutable mirror moves onto its per-commit copy | VERIFIED | `isRecordedCandidate` (`update-preflight.ts:377-389`) also requires `candidate.pluginRoot === record.resolvedSource`. Tests: `update-flow.test.ts:9174` (update reports `updated` with equal versions), `reinstall-flow.test.ts:4763` (reinstall), `update-preflight.test.ts:1247`. |
| 6 | D-14: a git-source reinstall after `fetch` installs revision 2 with no request | VERIFIED | `features/plugin/git-source-update.feature:102` asserts `the git host receives no request`, revision 2 installed, and the mirror plus the revision-2 copy. `clone-cache.ts:438-447` reads the source's own tracking ref offline (CR-02 fix). |
| 7 | D-13 equivalence: reinstall and update after the same marketplace update record the same version | VERIFIED | `reinstall.feature:304` now runs `reinstall` (project scope) and `update` (user scope) and checks that both records hold 1.1.0 (IN-04 fix `fc8a05b4`). |
| 8 | D-15 / RINST-01: reinstall overwrites the plugin's own edited agent files; update does not | VERIFIED | `overwrite` reaches only `commitPreparedAgents({ force })` (`update-swap.ts:1136`) and `assertAgentCommitTargets` (`:1344`). RINST-01 tests `reinstall-flow.test.ts:1073`, `:1112`, `:2421` pass. |
| 9 | Review fixes landed | VERIFIED | CR-01: `assertPathInside(..., "previous agent file")` at `bridges/agents/stage.ts:353`. CR-02: `resolveFetchedRefOffline` (`clone-cache.ts:466`). WR-01: `RECOVERY_PLUGIN_REINSTALL_PREFIX` (`shared/markers.ts:15`) and the hint at `update-swap.ts:1237`. WR-02: `assertAgentCommitTargets` before `markUpdateInProgress` (`update-swap.ts:1340-1349`). WR-03: failed-arm `mcpConfigNotices` (`reinstall-record.ts:107-109`, `reinstall-flow.ts:425-426`). WR-04: ST-9 compares `updatedAt` (`update-swap.ts:600`) and the mark restamps it (`:608`). WR-05: backfill keeps the gate open on `dependents constrain` (`backfill.ts:434-445`). WR-07: `partialDegrade`/`constraint` carried (`reinstall-record.ts:85-86`). WR-08: four catalog states. IN-01: comments rewritten, and no `D-68-02` remains in `extensions` or `docs`. IN-02: policy required. IN-03: `finishDisabledPreflight` (`update-preflight.ts:1054`). IN-07: docs. WR-06, IN-05, and IN-06 were skipped on purpose (see below). |

**Score:** 4/4 roadmap success criteria verified; 9/9 truths verified (0 present-but-behavior-unverified). Each behavior-dependent truth (2, 5, 6, 8, and the WR-02/WR-04 ordering fixes) has a named test or scenario, and all of them passed in the verifier's own `npm run check` run.

### Plan must-haves superseded by review fixes

- 18-05 truth "AGENT-01 ... now as a phase-3 `rollback partial`" was superseded by WR-02 (`fccea929`). The occupied agent target now refuses before the intent mark and changes nothing (`reinstall-flow.test.ts:728`). That is the stronger NFR-3 behavior, so this is not a gap. The 18-05 SUMMARY still describes the older behavior.
- 18-01 truth "the phase-3 aggregate message names no verb" holds. Its recovery hint now names `reinstall` for both verbs (WR-01).

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | IN-05: clone transport failure reads `{no longer installable}` | Phase 25 | Row and reason work on the unified update/reinstall messaging |
| 2 | WR-07 remainder: constraint-disclosure cause line on a reinstall row (`PluginReinstalledMessage` has no `cause` slot) | Phase 25 | Phase 25 SC-2 (row content) |
| 3 | IN-06: `RemovalOps.rename` (`shared/fs-utils.ts:60, 75`) has no production caller | Phase 26 | Phase 26 SC-2 (shared copy helper) |
| 4 | Fetch lock over the no-refresh mirror read; shared copy helper | Phase 26 | Phase 26 SC-1, SC-2 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `orchestrators/plugin/materialize-latest.ts` | Shared runner, not a ledger, not a network seam | VERIFIED | Listed in `test/architecture/gate-targets.ts:202`. Absent from `PLUGIN_LEDGERS` and `NETWORK_SEAMS` (`eslint.config.js`). Imports only update-preflight and update-swap. |
| `orchestrators/plugin/reinstall-flow.ts` | Target selection, skips, maintenance, messaging | VERIFIED | 732 lines. Its only materialization call is `materializeLatestVersion`. |
| `orchestrators/plugin/reinstall-record.ts` | Outcome projection from the runner | VERIFIED | `reinstallOutcomeFromRun`. The old `recordReinstalledOutcome` record writer is gone. |
| `orchestrators/plugin/update-flow.ts` | Layer refusal, then the shared runner | VERIFIED | `runPluginUpdate` (`:1181-1184`) |
| `reinstall-replace.ts`, `reinstall-clone-probe.ts` (+ tests) | Deleted | VERIFIED | `git ls-files` finds none; a whole-tree reference grep is clean |
| `features/plugin/reinstall.feature` | REI-04 and D-13 scenarios | VERIFIED | 5 new scenarios (`:234`, `:251`, `:270`, `:293`, `:304`) |
| `features/plugin/git-source-update.feature` | D-14 scenario | VERIFIED | `:102` |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `reinstall-flow.ts::runReinstall` | `materialize-latest.ts` | `materializeLatestVersion(args, REINSTALL_MATERIALIZATION)` | WIRED |
| `update-flow.ts::runPluginUpdate` | `materialize-latest.ts` | `materializeLatestVersion(args, UPDATE_MATERIALIZATION)` | WIRED |
| `materialize-latest.ts` | `update-preflight.ts` / `update-swap.ts` | `preparePluginUpdate({...args, policy})`, then `swapPluginUpdate(args, preflight, policy)` | WIRED |
| `update-preflight.ts` | `clone-cache.ts` | `refresh: policy.refreshSource` (`:269`), then `resolveFetchedRefOffline` | WIRED |
| `update-swap.ts` | `bridges/agents` | `assertAgentCommitTargets` / `commitPreparedAgents({ force: policy.overwrite })` | WIRED |
| `reconcile/backfill.ts` | reinstall operation | `createReinstallOperation(...)` (`:253`), `render: "none"` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole gate, including every scenario above | `npm run check` (temp HOME, `PI_CODING_AGENT_DIR` in the scratch dir) | exit 0; 744/744 scenarios; 279 coverage records | PASS |

The verifier ran the full suite once and ran no per-truth filters.

### Probe Execution

No probe applies: the plans declare none, and `scripts/*/tests/probe-*.sh` does not exist.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REI-04 | 18-02, 18-03, 18-05, 18-07 | `reinstall` installs whatever version the marketplace currently offers and records and reports it | SATISFIED | Truths 1, 6, 7 |
| UPR-01 | 18-01..18-07 | `update` and `reinstall` materialize the latest known version through one shared path, with no per-plugin version pinning | SATISFIED | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps only REI-04 and UPR-01 to Phase 18. Both still read `Pending` there. The orchestrator marks them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (all phase-modified `extensions/` files) | — | TBD/FIXME/XXX/TODO/HACK | none found | — |
| `shared/fs-utils.ts` | 60, 75 | orphan port member `rename` | Info | Deferred to phase 26 (IN-06) |
| `orchestrators/plugin/update-preflight.ts` | 127 | `MaterializationPolicy` lives in preflight, not in the shared leaf | Info | Kept on purpose to avoid an import cycle (REVIEW-FIX IN-02) |

### Human Verification Required

None that blocks the verdict. The REVIEW-FIX marked CR-02, WR-04, and WR-05 as "requires human verification". Each one has a passing test, and the open questions they raise are product decisions. They are listed below under "For the user", not as UAT items.

### Gaps Summary

No gaps. All four roadmap success criteria hold in the code and in the verifier's own `npm run check` run (exit 0). The binding 2026-10-23 decision holds: there is no per-plugin pin, reinstall takes the offered version, and both verbs go through `orchestrators/plugin/materialize-latest.ts`. REI-01/02/03 and the UPD scenarios stay green, and phase 16's IN-01 is done.

## For the user

- **WR-06 (decide):** one plugin that its marketplace delisted makes every `update` and `reinstall` in its scope fail `{unreadable}` (D-17), and backfill emits a `(failed)` row on every load. Decide whether "not declared by its marketplace" means no constraint or corrupt data (`update-constraint-gate.ts:458-466`).
- **WR-05 (confirm):** a range-held backfill (`dependents constrain`) now retries silently on every load with no message. Confirm that silence is right, or ask for a warning row.
- **CR-02 (known limit):** a declared tag ref has no `refs/remotes/origin/<tag>`, so a reinstall falls back to a network refresh. Offline tag resolution needs a peel helper on `GitOps`.
- **Record as decisions:** WR-09: `update --partial` now records `installable: false`, so enable, install, and backfill treat it as a consented partial install. WR-02: an occupied agent target now fails cleanly before the intent mark instead of `rollback partial`, for both verbs. The phase-3 recovery hint now reads `Run /claude:plugin reinstall <plugin>@<marketplace> to repair it.` for both verbs, and the aggregate text no longer says "update".
- **RINST-01 scope:** the reinstall overwrite applies to agents only. Workflows (an occupied target) and MCP (colliding keys) still refuse a name collision on reinstall.
- **Reinstall failure semantics are now update's:** there is no physical rollback, and a commit or finalize failure leaves the update-in-progress marker until a retry. Reinstall no longer holds one lock across the operation. WR-04 has a residual risk: two intent marks in the same millisecond write the same `updatedAt` stamp.
- **Network behavior changes:** GHB-03 now fails a warm-cache GitHub reinstall on an invalid base (D-16). Reinstall clones a cold mirror. Backfill may reach the network (constraint gate, cold mirror) and records the new version.
- **Outcome shape:** the reinstall outcome lost its `resourcesChanged` field. The completion cache is dropped twice per reinstall (the swap's refresh, then reinstall's own maintenance: `save:state, save:state, drop:cache, drop:cache, remove:data`).
- **CR-01 partial:** the forced agents commit now checks containment, but the reviewer's second suggestion was not applied. A row whose basename is not a generated name is not kept, and inside `agentsDir` it can still be removed by a forced reinstall.
- **Deferred:** IN-05 `{no longer installable}` for a failed clone, and the constraint-disclosure cause line on reinstall rows, go to phase 25. IN-06 `RemovalOps.rename` with no callers, plus the fetch lock and the shared copy helper, go to phase 26.
- **Stale codebase map:** `.planning/codebase/*` is stale. ARCHITECTURE.md and STRUCTURE.md still list `reinstall-clone-probe.ts` and `reinstall-replace.ts` and omit `materialize-latest.ts`. The write-file-atomic exemption list still names `bridges/agents/stage.ts`, which `rule-packs/architecture.json` no longer exempts. CONVENTIONS.md says 46 `fallow-ignore` markers and names the deleted `reinstall-replace.ts` `private-type-leak`, but the tree now has 41. Run `/gsd-map-codebase` to refresh the map.
- **Stale summary:** 18-05-SUMMARY still describes AGENT-01 as a phase-3 `rollback partial`. WR-02 superseded that.
- **No re-review:** nobody re-reviewed the 15 fix commits. REVIEW.md still reads `issues_found` and REVIEW-FIX reads `partial`. Run a second `/gsd-code-review` before shipping if you want the fixes reviewed.
- **Orchestrator:** mark REI-04 and UPR-01 complete in REQUIREMENTS.md.

## Seams for phases 25 and 26

- **Phase 25, row versions:** `reinstallOutcomeFromRun` (`orchestrators/plugin/reinstall-record.ts:67-111`) drops `run.fromVersion`. Carry it there, then render it in `reinstalledRowFromOutcome` (`reinstall.messaging.ts`). The same seam would carry the constraint cause line once `PluginReinstalledMessage` gains a `cause` slot.
- **Phase 25, `failed {not installed}`:** two sites must change together. Reinstall's pre-runner skip is in `reinstall-flow.ts:371-375`, with the error-severity flip at `reinstall.messaging.ts:332`. Update's is in `triageUpdateMembership` (`update-preflight.ts:598-620`).
- **Phase 25, `{source missing}`:** this belongs in the shared preflight's candidate resolution (`update-preflight.ts:504`, `:519`, where `no longer installable` is stamped). One change fixes both verbs.
- **Phase 25/27, range form:** ranges are joined with `, ` in `update-constraint-gate.ts:210` (`holders.map(nameHolder).join(", ")`) and in `describeConstraint` (`:530`). INR-05 (phase 27) also names the `, ` join.
- **Phase 26, fetch lock:** the lock must cover the no-refresh mirror read in `clone-cache.ts:438-447` (`resolveFetchedRefOffline`), not only the refresh. A concurrent `fetch` or `update` can move the tracking ref between that read and the copy.
- **Phase 26, shared copy helper:** the mirror plus per-commit copy composition now exists in exactly two places: `update-preflight.ts:260` (`probeUnpinned`) and `install-clone-probe.ts:55-90` (`probeInstallClone`). Unify them, and fold CR-02's offline tag resolution and the `RemovalOps.rename` reshaping (IN-06) into the same helper.

---

_Verified: 2026-10-23T23:18:41Z_
_Verifier: Claude (gsd-verifier)_
