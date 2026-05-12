---
phase: 04-marketplace-orchestrators
verified: 2026-05-10T23:44:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred:
  - truth: "Test rigor improvements WR-07 (cascade tautological assertion), WR-08 (MU-8 fixture cardinality), WR-09 (MA-9 permissive regex)"
    addressed_in: "Phase 5 / future hardening"
    evidence: "04-REVIEW.md classifies WR-07/08/09 as warnings; phase summary explicitly defers them as test-rigor improvements that do not block Phase 4 goal achievement"
human_verification: []
---

# Phase 4: Marketplace Orchestrators Verification Report

**Phase Goal:** A user can manage marketplace records (`marketplace add / remove / rm / list / update / autoupdate / noautoupdate`) atomically with clone-then-rename staging, cascade-drop with aggregated failures, manifest pointer refresh, and reload-hint emission only when generated resources actually change.

**Verified:** 2026-05-10T23:44:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                             | Status     | Evidence                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Public surface complete (barrel exports five entry points + types)                                                                | VERIFIED   | `orchestrators/marketplace/index.ts:20-30` exports `addMarketplace`, `removeMarketplace`, `listMarketplaces`, `updateMarketplace`, `updateAllMarketplaces`, `setMarketplaceAutoupdate` + all five `*Options` types + shared helpers/types |
| 2   | D-14 follow-upstream-blindly implemented via fetch + forceUpdateRef + checkout; no pull in GitOps; REQUIREMENTS.md MU-2/MU-3 superseded | VERIFIED   | `update.ts:393-467` implements 3-step D-14 sequence; `shared.ts:75-77` docstring "No `pull`"; REQUIREMENTS.md MU-2 / MU-3 marked `~~strikethrough~~` with "superseded by Phase 4 D-14"; PROJECT.md D-23 Key Decisions row present       |
| 3   | D-12/D-13 GitOps interface and DEFAULT_GIT_OPS delegate to platform/git.ts (no inline isomorphic-git import)                       | VERIFIED   | `shared.ts:79-114` GitOps has 6 primitives (5 base + `currentBranch` for CR-01 fix; legitimate expansion documented in shared.ts:64-77 and CR-01); `DEFAULT_GIT_OPS` delegates entirely to `defaultGit.*` (= `platform/git.ts`); `forceUpdateRef` lives in `platform/git.ts:158-166` (no `await import` in shared.ts) |
| 4   | NFR-5 network policy: list/remove/autoupdate touch zero git surface; add/update gate gitOps to github branch only                  | VERIFIED   | `list.ts` and `autoupdate.ts` import nothing from `platform/git.ts` or `DEFAULT_GIT_OPS` (grep returned empty); `remove.ts` imports no git surface; `add.ts:131-136` only calls `gitOps.clone` inside `addGithubInGuard` (path branch in `addPathInGuard` has zero git calls); `update.ts:213-227` only calls `gitOps.*` when `source.kind === "github"` |
| 5   | NFR-7 discriminated union: `installable: true \| false`                                                                            | VERIFIED   | `domain/resolver.ts:168` `installable: false` and `:184` `installable: true` boolean-literal discriminants in ResolvedPlugin union (carry-forward from Phase 2; Phase 4 consumes this contract via state-io ParsedSource discriminant `kind`) |
| 6   | NFR-10 path containment via assertPathInside with tilde expansion in add.ts                                                       | VERIFIED   | `persistence/locations.ts:134/140/146/153` `assertPathInside` chokepoint on every dynamic-name path; `add.ts:222-229` expands `~` and `~/...` against `os.homedir()` BEFORE `stat(onDiskPath)` at line 230 (CR-02 fix). `assertPathInside` runs via `sourcesStagingDir`/`sourceCloneDir`/`pluginDataDir` calls which all post-expansion |
| 7   | Cascade discipline (PU-1 order skills → commands → agents → MCP; fail-fast; AG-5 structured failed[] preserved per CR-06)         | VERIFIED   | `shared.ts:151-229` cascadeUnstagePlugin runs skills (line 165) → commands (171) → agents (177) → MCP (201) in PU-1 order; CR-06 fix at lines 184-199 throws `AgentsUnstageFailureError` (defined at lines 55-62) preserving `failedAgents: readonly UnstageAgentFailure[]` structured field; per-plugin try/catch at lines 164-228 returns `{ ok: false, cause }` on first throw (D-03 fail-fast) |
| 8   | State guard discipline (ST-7..ST-9): all write-bearing orchestrators use withStateGuard; WR-02 post-state cleanup leak now warning, not error | VERIFIED   | `add.ts:91-108` `withStateGuard` wraps add flow; `remove.ts:96-148` `withStateGuard` wraps remove; `update.ts:202-260` `withStateGuard` wraps refresh; `autoupdate.ts:57-61` `withStateGuard` wraps flip; `list.ts` correctly has no guard (read-only); `remove.ts:195-205` WR-02 fix uses `notifyWarning` (not throw) for post-state cleanup leaks |
| 9   | IL-2 output channel: all messages via notify wrappers; sanctioned IL-3 console.warn isolated to legacy migration                  | VERIFIED   | `grep -rE "process\.(stdout\|stderr)\.write" extensions/pi-claude-marketplace/` returns empty; single `console.warn` site at `persistence/migrate.ts:162` matches IL-3 (legacy marketplace records migration). All orchestrators import `notifySuccess`/`notifyWarning`/`notifyError` exclusively |
| 10  | ES-4 error cause chain preserved via formatErrorWithCauses (CR-03 fix)                                                            | VERIFIED   | `shared.ts:339-361` `formatErrorWithCauses(err, maxDepth=5)` walks `Error.cause`; used in `update.ts:266-268` (MarketplaceUpdateError surfacing), `update.ts:296` (MU-7 failed-partition notes per CR-03), `remove.ts:203` (post-state cleanup) and `remove.ts:215` (failed-plugin lines). `errorMessage()` (no cause walk) is NOT used in cause-bearing paths |
| 11  | Tests pass: `npm run check` returns exit 0 with 525 tests passing                                                                 | VERIFIED   | `npm run check` output: `pass 525; fail 0; cancelled 0; skipped 0; todo 0; duration_ms 2165`. All 78 tests across 9 Phase 4 test files (cascade/add/remove/list/update/autoupdate + reload-hint/soft-dep/marketplace-list) pass |
| 12  | Code review status: blockers CR-01..CR-06 fixed; warnings WR-01..WR-06 fixed; WR-07/08/09 deferred test rigor                     | VERIFIED   | CR-01 fix verified in `shared.ts:79-114` (currentBranch primitive) + `update.ts:410-441` (default-branch path uses currentBranch). CR-02 fix in `add.ts:222-229` (tilde expansion). CR-03 fix in `update.ts:296` (formatErrorWithCauses). CR-04 fix in `platform/git.ts:158-166` + `shared.ts:105-114` (no dynamic import). CR-05 fix in `update.ts:223-225` (onFetchSucceeded callback). CR-06 fix in `shared.ts:55-62, 184-199` (AgentsUnstageFailureError preserves failed[]). WR-01..WR-06 fixes documented inline. WR-07/08/09 deferred per Phase summary -- test rigor, not goal-blocking |

**Score:** 12/12 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Test-rigor hardening: WR-07 cascade-test tautological branch (`cascade.test.ts:86-127`), WR-08 MU-8 fixture cardinality (`update.test.ts:236-280`), WR-09 MA-9 permissive regex (`add.test.ts:191-201`) | Future hardening / Phase 5 | 04-REVIEW.md classifies these as WARNINGS (not BLOCKERS); phase context explicitly defers them. None affect goal-level observable behavior |

### Required Artifacts

| Artifact                                              | Expected                                                                  | Status     | Details                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orchestrators/marketplace/index.ts`                  | Barrel re-exports five subcommands + shared helpers + option types        | VERIFIED   | 31 lines; exports `DEFAULT_GIT_OPS`, `applyAutoupdateFlipInPlace`, `cascadeUnstagePlugin`, `formatErrorWithCauses`, `resolveScopeFromState`, `addMarketplace`, `removeMarketplace`, `listMarketplaces`, `updateMarketplace`, `updateAllMarketplaces`, `setMarketplaceAutoupdate` + matching type re-exports |
| `orchestrators/marketplace/shared.ts`                 | GitOps interface; DEFAULT_GIT_OPS; cascade; helpers                       | VERIFIED   | 362 lines (within ~300 LOC soft cap per D-01 escalation note; AgentsUnstageFailureError adds ~10 lines for CR-06); all six listed exports present                                                                                       |
| `orchestrators/marketplace/add.ts`                    | MA-1..6, MA-8..11; github + path branches; clone-then-rename              | VERIFIED   | 273 lines; addGithubInGuard does clone → validate → rename, with MA-9 cleanup + MA-6 stale-clone check + MA-8 duplicate-name check; addPathInGuard has tilde expansion (CR-02)                                                          |
| `orchestrators/marketplace/remove.ts`                 | MR-1..8; cascade aggregation; post-state cleanup; one warning             | VERIFIED   | 250 lines; cascade loop at 117-142 (fail-soft per WR-01 inlined), post-state cleanup 152-185, MR-4 one aggregated warning 208-222, success notify with reload hint 226-248                                                              |
| `orchestrators/marketplace/list.ts`                   | ML-1..4; read-only; no manifest reads; no git surface                     | VERIFIED   | 64 lines; zero git imports; uses `loadState` + `renderMarketplaceList`; SC-6 bare-form enumerates both scopes; ML-4 empty state handled by renderer                                                                                     |
| `orchestrators/marketplace/update.ts`                 | MU-1, MU-4..9; D-14 sequence; outer-guard / cascade-outside              | VERIFIED   | 501 lines; D-14 sequence at 393-467; cascade-outside-guard at 274-302; MU-5 retry hint via onFetchSucceeded callback (CR-05); MU-7 partition rendering at 360-380                                                                       |
| `orchestrators/marketplace/autoupdate.ts`             | MAU-1..4; idempotent flip; SC-6 dual-scope; no git                        | VERIFIED   | 116 lines; uses applyAutoupdateFlipInPlace inside withStateGuard; aggregates changed/unchanged across scopes; bare-form empty-state matches MU-1 silent-succeed                                                                          |
| `orchestrators/types.ts`                              | PluginUpdateFn + PluginUpdateOutcome (D-06)                               | VERIFIED   | 55 lines; PluginUpdateOutcome discriminated by `partition: PluginUpdatePartition`; optional stagedAgents/stagedMcpServers fields for WR-04 fix                                                                                          |
| `platform/git.ts` extension                           | forceUpdateRef + currentBranch wrappers                                   | VERIFIED   | Lines 158-187 add `forceUpdateRef` (wraps `git.writeRef({force: true})`) and `currentBranch` (wraps `git.currentBranch`) per CR-01/CR-04 fixes                                                                                          |
| `presentation/reload-hint.ts`                         | reloadHint(verb, names) + appendReloadHint composition                    | VERIFIED   | Uses RELOAD_HINT_PREFIX from `shared/markers.ts` (line 13); produces `Run /reload to <verb> it.` (1 name) / `Run /reload to <verb> "n1", "n2".` (N names)                                                                                |
| `presentation/soft-dep.ts`                            | subagentWarningIfNeeded + mcpAdapterWarningIfNeeded via pi.getAllTools()  | VERIFIED   | RH-3 subagent matcher at line 35 (`tool.name === "subagent"`); RH-4 mcp matcher at lines 55-61 (name OR sourceInfo.source substring); ES-5 prefixes from `shared/markers.ts`                                                            |
| `presentation/marketplace-list.ts`                    | renderMarketplaceList (ML-1..4)                                           | VERIFIED   | Reviewed in 04-REVIEW.md files_reviewed_list; tests pass (6 tests in marketplace-list.test.ts)                                                                                                                                          |
| `tests/helpers/git-mock.ts`                           | Mock GitOps with stored-ref bookkeeping; forceUpdateRef + currentBranch support | VERIFIED   | Listed in REVIEW; used by update.test.ts; supports `forceUpdateRefCalls`, `currentBranchCalls`, `currentBranchOverride`                                                                                                                |
| `tests/orchestrators/marketplace/_fixtures/*`         | Valid, invalid, empty marketplace fixtures                                | VERIFIED   | Three fixtures present (valid-marketplace, invalid-manifest, empty-marketplace) per 04-REVIEW.md files_reviewed_list                                                                                                                    |

### Key Link Verification

| From                                    | To                                | Via                                  | Status   | Details                                                                                                                                                                                |
| --------------------------------------- | --------------------------------- | ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| update.ts                               | platform/git.ts (via GitOps)      | DEFAULT_GIT_OPS in shared.ts         | WIRED    | shared.ts:105-114 delegates all 6 primitives to `defaultGit.*` (= `platform/git.ts` via `import * as defaultGit from "../../platform/git.ts"` line 40); update.ts:127 uses fallback   |
| update.ts                               | orchestrators/types.ts (PluginUpdateFn) | Import declaration                  | WIRED    | update.ts:92 imports `PluginUpdateFn, PluginUpdateOutcome` from `../types.ts`; orchestrators/types.ts:50-54 defines `PluginUpdateFn` signature exactly                                |
| remove.ts                               | shared.ts (cascadeUnstagePlugin)  | Import + dependency injection seam   | WIRED    | remove.ts:45 imports; remove.ts:66-67 declares optional cascade injection; remove.ts:118 invokes injected/default cascade                                                              |
| cascadeUnstagePlugin                    | bridges/{skills,commands,agents,mcp}/index.ts unstage* | Per-bridge import        | WIRED    | shared.ts:35-38 imports unstagePluginSkills, unstagePluginCommands, unstagePluginAgents, unstageMcpServers; invoked at shared.ts:165, 171, 177, 201 in PU-1 order                       |
| add.ts addPathInGuard                   | os.homedir() / path.join          | Inline tilde expansion (CR-02 fix)   | WIRED    | add.ts:42-45 imports os, path; lines 224-229 build onDiskPath; line 230 stat(onDiskPath)                                                                                              |
| update.ts MU-5 cloneAdvanced            | refreshGitHubClone onFetchSucceeded | Callback                            | WIRED    | update.ts:223-225 callback flips cloneAdvanced; refreshGitHubClone:408 fires callback after `gitOps.fetch` returns                                                                     |
| All orchestrators                       | shared/notify.ts (notify* wrappers) | Import declaration                  | WIRED    | All five orchestrators import from `../../shared/notify.ts` (notifySuccess / notifyWarning / notifyError); zero `process.stdout/stderr` writes anywhere in codebase                  |
| update.ts MU-7 failed partition         | formatErrorWithCauses             | Direct call (CR-03 fix)              | WIRED    | update.ts:296 `notes: [formatErrorWithCauses(err)]` (previously errorMessage(err) which truncated Error.cause)                                                                         |
| AgentsUnstageFailureError               | UnstageAgentFailure[]             | Class field (CR-06 fix)              | WIRED    | shared.ts:55-62 class definition with `readonly failedAgents: readonly UnstageAgentFailure[]`; thrown at shared.ts:194-198 with structured array attached                              |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable                       | Source                                                                | Produces Real Data | Status   |
| --------------------------------- | ----------------------------------- | --------------------------------------------------------------------- | ------------------ | -------- |
| listMarketplaces                  | allRecords                          | `loadState(locations.extensionRoot)` for each scope (state.marketplaces) | Yes (real state)   | FLOWING  |
| addMarketplace (github)           | state.marketplaces[derivedName]     | Manifest validated from cloned repo; written via withStateGuard       | Yes                | FLOWING  |
| removeMarketplace                 | cleanedPluginNames, removedPlugins, failedPlugins | Cascade per-plugin outcomes from `unstagePlugin*` bridges  | Yes                | FLOWING  |
| updateMarketplace                 | snapshot.plugins / partitions        | snapshot captured inside guard from `Object.keys(record.plugins)`; partition fed by injected PluginUpdateFn (Phase 5 wire) | Yes (state-driven per D-07; pluginUpdate injection is intentional seam) | FLOWING |
| setMarketplaceAutoupdate          | overallChanged / overallUnchanged    | applyAutoupdateFlipInPlace returns based on state.marketplaces[name].autoupdate | Yes                | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                            | Command                                | Result                                                  | Status |
| --------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- | ------ |
| Full test suite passes                              | `npm run check`                        | `pass 525; fail 0`                                      | PASS   |
| No `pull` in marketplace orchestrators              | `grep -nE "pull" orchestrators/marketplace/*.ts` | Only docstring mentions ("No `pull` -- D-14...") | PASS   |
| No `process.stdout/stderr.write` in extension      | `grep -rE "process\.(stdout\|stderr)\.write" extensions/` | empty                              | PASS   |
| Sanctioned console.warn isolated                    | `grep -rn "console\." extensions/`     | Single match: `persistence/migrate.ts:162`              | PASS   |
| Barrel exports five marketplace entry points        | `grep -nE "^export.*Marketplace\\|^export.*setMarketplace" orchestrators/marketplace/index.ts` | All five present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                   | Status     | Evidence                                                                                |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| MA-1..6, 8..11 | 04-05    | marketplace add github + path; staging + atomic rename; MA-6 stale-clone; MA-9 cleanup                        | SATISFIED  | add.ts implements all branches; tests verify each in add.test.ts                        |
| MR-1..8     | 04-06       | marketplace remove cascade + aggregation + post-state cleanup + reload hint                                   | SATISFIED  | remove.ts implements; remove.test.ts + cascade.test.ts cover                            |
| ML-1..4     | 04-07       | marketplace list read-only with empty-state                                                                   | SATISFIED  | list.ts read-only (no guard, no manifest reads, no git); list.test.ts covers           |
| MU-1, MU-4..9 (~~MU-2, MU-3~~) | 04-08 | marketplace update D-14 sequence + manifest refresh + cascade gating                                          | SATISFIED  | update.ts implements; MU-2/MU-3 superseded in REQUIREMENTS.md per Plan 04-10            |
| MAU-1..4    | 04-09       | autoupdate/noautoupdate idempotent flip; bare form across scopes                                              | SATISFIED  | autoupdate.ts uses applyAutoupdateFlipInPlace; autoupdate.test.ts covers                |
| SC-5, SC-6  | 04-05/07/08 | scope defaulting + bare-form enumeration                                                                      | SATISFIED  | All orchestrators iterate `["user", "project"]` when scope omitted                      |
| RH-1..5     | 04-03       | reload hint composition + soft-dep warnings via pi.getAllTools()                                              | SATISFIED  | presentation/reload-hint.ts + soft-dep.ts; tests cover RH-3/RH-4/RH-5                   |
| NFR-5       | 04-07/09    | network policy: list/remove/autoupdate touch no network; add/update github branches only                      | SATISFIED  | grep confirms list.ts and autoupdate.ts import nothing from platform/git or DEFAULT_GIT_OPS |

### Anti-Patterns Found

| File                                            | Line       | Pattern                                                              | Severity | Impact                                                                                                                                                                          |
| ----------------------------------------------- | ---------- | -------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/orchestrators/marketplace/cascade.test.ts` | 86-127     | Tautological assertion (if-else accepts both branches)               | Info     | WR-07; test passes regardless of behavior. Goal-level cascade behavior covered by add/remove/update tests. Deferred test-rigor improvement                                       |
| `tests/orchestrators/marketplace/update.test.ts`  | 236-280    | MU-8 fixture cardinality doesn't distinguish state vs manifest source | Info     | WR-08; test passes against both implementations. State-driven enumeration is enforced by code-level D-07 (state.plugins keys, not manifest entries). Deferred                    |
| `tests/orchestrators/marketplace/add.test.ts`     | 191-201    | MA-9 cleanup assertion uses permissive regex                         | Info     | WR-09; regex matches "additionally" / "leak" / "staging" loosely. Append-leak-to-error semantics tested directly in errors.test.ts. Deferred                                     |

No blocker anti-patterns. All info-level findings are intentionally deferred test-rigor improvements.

### Human Verification Required

None. All must-haves verifiable from code/grep/test runs. The phase produces orchestrator-layer code that is exercised end-to-end by 78 Phase 4 tests within the 525-test suite. UX of the soft-dep warnings, error message wording, and reload-hint format will be validated against live Pi processes in Phase 7's e2e tests.

### Gaps Summary

No goal-blocking gaps. The phase delivers a complete, atomically-correct, network-disciplined marketplace orchestrator layer that:

1. **Exposes five working subcommands** with consistent option types and the GitOps / PluginUpdateFn injection seams Phase 5/7 will wire.
2. **Implements D-14 follow-upstream-blindly** with the symbolic-HEAD vs detached-HEAD branch correctly distinguished via `currentBranch` (CR-01 fix), recorded in REQUIREMENTS.md and PROJECT.md as the user-contract supersession of MU-2/MU-3.
3. **Preserves NFR-5 by construction:** list / remove / autoupdate orchestrators do not even import the git surface.
4. **Honors IL-2/IL-3 output discipline:** zero `process.stdout`/`stderr` writes, single sanctioned `console.warn` at `migrate.ts:162`.
5. **Threads ES-4 cause chains end-to-end** via `formatErrorWithCauses` (CR-03 fix in update.ts:296; consumed in remove.ts:203, 215) and the new `AgentsUnstageFailureError` (CR-06).
6. **Passes 525/525 tests** including 78 Phase 4 tests in 9 test files.

Three deferred test-rigor warnings (WR-07/08/09) cover assertion permissiveness in cascade / update / add tests. None affect goal-level correctness; the underlying behaviors they probe are also exercised by Phase 4's broader test suite and by code-level invariants (e.g., D-07 state-driven enumeration is enforced in update.ts:284 regardless of what update.test.ts asserts).

______________________________________________________________________

*Verified: 2026-05-10T23:44:00Z*
*Verifier: Claude (gsd-verifier)*
