---
phase: 103-workflow-artifact-materialization
verified: 2026-08-15T00:00:00Z
status: passed
score: 7/7 roadmap success criteria verified (10/10 requirement IDs accounted for, 0 failures)
behavior_unverified: 0
overrides_applied: 0
re_verification: null
---

# Phase 103: Workflow artifact materialization Verification Report

**Phase Goal:** Installing a plugin that ships workflows writes engine-discoverable envelopes at
the engine's canonical paths for both scopes, inside an amended containment root, atomically and
reversibly.
**Verified:** 2026-08-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `install` writes one `{name, description, script}` envelope per admitted script, carrying the Claude source verbatim, discoverable by the engine's own scan with no engine API call and no index mutated | ✓ VERIFIED | `bridges/workflows/stage.ts::buildEnvelope` builds from one variable (`generatedName`) for both file stem and `name` field; `tests/bridges/workflows/stage.test.ts` (10 cases, all green) pins key order, byte-identical `script`, CRLF/non-ASCII round-trip, and `WBRG-04` predicate/scan-visibility cases. Live driver (`tests/live-uat/workflow-storage-canary.mjs`) was run once by hand against a real `@quintinshaw/pi-dynamic-workflows@3.5.1` and passed 10/10 assertions per 103-04-SUMMARY.md (list, load-byte-for-byte, staging invisibility, both scopes). |
| 2 | Both scopes land at the engine's canonical paths; deprecated `<cwd>/.pi/workflows/saved/` never written; project key matches the engine byte-for-byte across 14 measured edge cases held as hard-coded literals | ✓ VERIFIED | `tests/domain/workflow-project-key.test.ts`: 13 cases with hard-coded SHA-256-derived literals (independently recomputed `sha256("/home/acolomba/some-project").hex.slice(0,12)` = `e4c31526a114`, matching the test — confirms non-tautological, measured values, not re-derivations) plus 1 split case (shape regex + `workflowProjectKey(rel) === workflowProjectKey(resolve(rel))` equivalence, not a hard-coded key, correctly reasoned as non-tautological in 103-02-SUMMARY.md). `tests/bridges/workflows/paths.test.ts` asserts the project's own `.pi/workflows` directory does not exist after a project-scope commit (existence-based, not string comparison). All green. |
| 3 | NFR-10 admits three new paths under one new root; writes elsewhere (inside or outside the root) are still refused at the containment chokepoint | ✓ VERIFIED | `locations.ts::workflowArtifactPath` runs `assertSafeName` then `assertPathInside` against `workflowsSavedDir`; `stage.ts` anchors the staging root against `workflowsHomeDir`. No other path composer exists in the bridge (containment by construction — grep confirms `workflowsSavedDir` appears in `stage.ts` only at the lazy `mkdir` call, never as a join target). `tests/persistence/locations.test.ts` pins the 6-way refusal set, the boundary-vs-extended-sibling distinction (not a string-prefix test), and the disjointness of the three admitted paths. `CLAUDE.md`'s containment clause (line 62) names the root and the three admitted paths verbatim, matching the code. |
| 4 | Staging sits adjacent to its target so the commit `rename()` succeeds for a project-scope install on a different filesystem from `$HOME` | ✓ VERIFIED | `stage.ts` header states staging is under `workflowsHomeDir`, never `extensionRoot`; `tests/persistence/locations.test.ts` asserts `workflowsHomeDir`/`workflowsStagingDir` are scope-independent while `workflowsSavedDir` differs, and that neither derives from `extensionRoot`. The EXDEV-avoidance property is structural (both live under one root); the cross-device case itself is a documented backstop (two real filesystems needed, not portable in CI), consistent with `verification: backstop` in the plan frontmatter. |
| 5 | Discovery is flat, non-recursive, symlink-refusing (D-14), first-wins deduped; unreadable/unstageable scripts are reported via `warnings[]` without failing the install | ✓ VERIFIED | `tests/bridges/workflows/discover.test.ts` (10 cases) and `tests/orchestrators/plugin/install-workflows.test.ts` cover read-failure, skipped, and refused arms all producing named warnings without failing the install; `WNAM-05` collision regression (two same-name scripts fail the whole install, saved dir left empty) is present and green. `lstat` failures also route through the soft-fail channel (WR-02, beyond the CR-only scope, fixed in commit `40dc5239`). |
| 6 | Workflows materialize as the 6th ledger phase; a failure in any later phase unstages them, leaving nothing behind | ✓ VERIFIED (regression-tested) | `install.ts`: `stagedWorkflowNames` is now assigned **before** `commitPreparedWorkflows` (CR-01 fix, commit `16392934`), matching the skills/commands phase discipline. Two independent non-vacuous tests confirm this: (a) `"WLIF-01 a state-phase throw unstages the committed envelopes"` + its non-vacuity control (`"...WITHOUT the induced throw leaves the envelope on disk"`) — both green, reasoning documented and cross-checked against the observed RED run in 103-01-SUMMARY.md; (b) the new `"WLIF-01 a workflows-commit throw runs the undo against the names the prepare produced"` test directly exercises a commit-time throw (pre-occupied target) and asserts a non-empty `rollbackPartials` entry for the `"workflows"` phase — this is precisely the scenario CR-01 found broken (undo iterating an empty list). All pass. Phase order confirmed via `install.ts`'s literal `phases` array: `skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, workflowsPhase, statePhase`. |
| 7 | `info`'s `workflows:` line shows each script's admitted `meta.name`, not its file stem, on both resolver arms, never throwing on a malformed script | ✓ VERIFIED | `composeResolvedComponents` (single implementation, both arms) takes a `pluginName` parameter and calls `discoverWorkflowNames` → `discoverPluginWorkflows` for both the manifest-backed arm and the `unavailable` arm (`entry.name` passed identically). `tests/orchestrators/plugin/info.test.ts::"the arm that renders an unresolvable plugin produces the same workflows names as the manifest-backed arm"` passes. Never-throw: `assertSafeName` is pre-checked before the (unguarded) discovery call, so a rejected plugin name degrades to directory-entry enumeration rather than throwing; a genuine IO failure (chmod 0) still propagates and is caught at the row-builder's existing degrade path, rendering `{permission denied}` rather than crashing — both cases tested and green. CR-04 fix (containment on the `unavailable` arm's lenient paths) verified independently: `isContainableComponentPath` rejects absolute and climbing paths, `discover.ts` additionally re-asserts `assertPathInside` (defense in depth beyond the review's minimum fix). Four `NFR-10` escape tests (absolute/relative × workflows/skills) plant a real secret literal and assert it never appears in the rendered message — all green. |

**Score:** 7/7 roadmap success criteria verified.

### Requirements Coverage

| Requirement | Description (abridged) | Status | Evidence |
|---|---|---|---|
| WBRG-01 | Envelope wrap, verbatim script | ✓ SATISFIED | `stage.ts::buildEnvelope`; `stage.test.ts` |
| WBRG-02 | Flat, non-recursive, symlink-refusing, first-wins discovery | ✓ SATISFIED | `discover.ts`; `discover.test.ts` |
| WBRG-03 | Soft-fail `warnings[]` channel | ✓ SATISFIED | `discover.ts` warning builders; `discover.test.ts` |
| WBRG-04 | Engine's own scan discovers the envelope | ✓ SATISFIED | `stage.test.ts` predicate/visibility cases + live driver run (103-04-SUMMARY.md transcript) |
| WPTH-01 | Canonical user/project paths | ✓ SATISFIED | `locations.test.ts`, `paths.test.ts` |
| WPTH-02 | Deprecated legacy path never written | ✓ SATISFIED | `paths.test.ts` existence assertion |
| WPTH-03 | Project key byte parity, 14 hard-coded cases | ✓ SATISFIED | `workflow-project-key.test.ts` (independently spot-checked hash) |
| WPTH-04 | New writable root, refusal set | ✓ SATISFIED | `locations.test.ts` refusal + adjacency cases |
| WPTH-05 | Staging adjacency, no EXDEV | ✓ SATISFIED | `locations.test.ts` scope-independence cases; backstop noted for real cross-device case |
| WLIF-01 | 6th ledger phase, reversible | ✓ SATISFIED | `install.ts` phase array + rollback regression tests (see truth 6 above) |

All 10 requirement IDs declared in the phase's ROADMAP entry and in the four plans' frontmatter are accounted for. No orphaned requirements found in `REQUIREMENTS.md` for Phase 103 (cross-referenced against the "Requirement -> Phase" table at the end of the file).

### Code Review Disposition (103-REVIEW.md)

The review found 5 critical and 11 warning findings. Per the task's disposition note, this
verification independently confirmed each in-scope fix rather than trusting the review-fixed claim:

| Finding | Disposition | Verified |
|---|---|---|
| CR-01 (undo removes nothing on commit throw) | Fixed | ✓ `stagedWorkflowNames` assignment moved before commit; new regression test exercises a commit-time throw and asserts a non-empty rollback partial |
| CR-04 (info lenient-arm containment escape, file-content leak) | Fixed | ✓ `isContainableComponentPath` filter added, plus independent `assertPathInside` in `discover.ts`; 4 escape tests (absolute/relative × workflows/skills) plant and check for a real secret literal |
| CR-05 (commit deletes previous targets with no restore) | Fixed | ✓ `displacePreviousTargets`/restore-on-rollback added; two new rollback tests |
| CR-02 (no removal on uninstall/disable/marketplace remove) | Deferred to Phase 104 (WLIF-03/05) | ✓ Confirmed still absent (`grep -c workflow orchestrators/marketplace/shared.ts` = 0); deferral recorded in `REQUIREMENTS.md` lines 69-76 |
| CR-03 (update never re-stages) | Deferred to Phase 104 (WLIF-02) | ✓ Confirmed `update.ts` untouched by this phase (not in `files_modified` of any of the 4 plans); deferral recorded in `REQUIREMENTS.md` lines 77-82 |
| WR-01 (previousWorkflowNames dead parameter) | Deferred to Phase 104 (WLIF-02/05) | ✓ Confirmed only 1 production call site (the *unstage* input, not stage); deferral recorded, lines 83-89 |
| WR-02 (lstat throws instead of soft-fail) | Fixed (bonus, beyond CR scope) | ✓ `lstat` now routes through the same warning channel |
| WR-04 (tautological staging-root containment check) | Fixed (bonus) | ✓ Check reordered before `mkdir`, anchored on `workflowsHomeDir`; new symlinked-staging-dir test |
| WR-05 (non-UTF-8 script corruption) | Not independently re-verified this pass | — not part of the 5-blocker scope note; not blocking |
| WR-06 (workflow names absent from PI-6 conflict guard) | Deferred to Phase 104 (WLIF-02/05) | ✓ Deferral recorded, lines 90-97 |
| WR-08 (no rollback/cleanup tests) | Fixed (bonus) | ✓ Two new mid-sequence-failure tests added to `stage.test.ts` |
| WR-09 (live-uat `URL.pathname` vs `fileURLToPath`) | Fixed | ✓ Confirmed via commit `41dc9230` diff |
| WR-10 (live canary blind to uninstall orphans) | Deferred to Phase 104 (WLIF-03) | ✓ Deferral recorded, lines 98-104 |
| WR-11 (fixture drift, over-broad eslint ignore, dedup case-sensitivity) | Partially fixed | ✓ eslint ignore scoped down (commit `5e7d04a4`); other two items not independently re-checked this pass, non-blocking |
| WR-03, WR-07 | Not explicitly claimed fixed by SUMMARY | Not re-verified as blockers; WR-03's underlying concern (bare catch swallowing IO errors) appears superseded by the `discoverWorkflowNames` redesign (pre-check + unguarded call), observed directly in `info.ts` |

The deferred findings (CR-02, CR-03, WR-01, WR-06, WR-10) are all lifecycle-scope items correctly
excluded from this phase's goal per the phase boundary in `103-CONTEXT.md` ("Out of scope,
deliberately: update / uninstall / reinstall / enable-disable — Phase 104"), and each is recorded
with a specific remediation plan in `REQUIREMENTS.md`, not silently dropped.

### Test Suite

- `npm run typecheck`: clean.
- `node --test "tests/bridges/workflows/*.test.ts" tests/orchestrators/plugin/install-workflows.test.ts tests/orchestrators/plugin/info.test.ts tests/persistence/locations.test.ts tests/persistence/migrate.test.ts tests/domain/workflow-project-key.test.ts tests/platform/workflow-home.test.ts`: 222/222 pass.
- `tests/architecture/compat-01-no-expansion.test.ts` + `tests/architecture/catalog-uat.test.ts`: 20/20 pass (closed reason set and output catalog untouched).
- `npm run check` (full suite, run once in background): exit 0.
- No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any phase-touched source file.
- No GSD planning-artifact references (`Phase N`, `Plan N`, `Wave N`, `Pitfall N`) in phase-touched source or test files.
- `git status`: only `.planning/workstreams/workflows/STATE.md` uncommitted (expected — orchestrator territory); all 18 phase commits present in `git log`, matching all four SUMMARY files' commit-hash claims.

### Anti-Patterns Found

None. No stub patterns, no hollow props, no hardcoded-empty data flowing to rendered output.

### Human Verification Required

None. All roadmap success criteria resolved to VERIFIED with direct codebase and test evidence,
including independent recomputation of one hash literal and direct reading of the fix commits
(not merely trusting SUMMARY narration).

### Gaps Summary

No gaps. All 7 roadmap success criteria and all 10 requirement IDs are satisfied by code that is
committed, tested, and green. The 5 code-review blockers are all fixed and independently confirmed,
each with a genuine non-vacuous regression test (not merely a claim). The 5 findings correctly
deferred to Phase 104 are recorded with specific remediation guidance in `REQUIREMENTS.md`, not
lost. Several review warnings beyond the 5-blocker scope note (WR-02, WR-04, WR-08, WR-09, part of
WR-11) were also fixed as a bonus and independently confirmed.

---

_Verified: 2026-08-15_
_Verifier: Claude (gsd-verifier)_
