---
status: resolved
trigger: "Wave gate on features/system-git (HEAD 226c005) after the marketplace re-clone/swap and the release-tag ls-remote work merged: test/edge/handlers/marketplace/update.test.ts fails 7 cases (createGitOpsFake blocked unplanned remote https://gitlab.example.com/team/alpha); test/integration/project-install-adds-user-marketplace.test.ts:211 LAYER-07 expected a fetch into <project>/.pi/pi-claude-marketplace/sources/mp and got []; direct coverage stopped at the first failing pair."
created: 2026-11-24T08:30:00Z
updated: 2026-11-24T09:45:00Z
---

## Current Focus

hypothesis: both failures are stale test expectations of the in-place fetch model (D-14) that the ls-remote freshness check plus re-clone/swap (D-SG-10) replaced; no production regression
test: edited both tests to the freshness recorder; ran owner files, test:modules, test:integration
expecting: owner files green; suites green except the dispatch-exec sandbox baseline
next_action: caller reviews the report; archive to resolved/ after confirmation

reasoning_checkpoint:
  hypothesis: "The 7 edge cases fail because the fake refuses the unplanned ls-remote URL that D-SG-10's freshness check now sends (fetch was never URL-gated), and LAYER-07 fails because a current checkout is no longer fetched in place; both are test expectations of D-14."
  confirming_evidence:
    - "clone-swap.ts makes only listRemotes/resolveRef/resolveRemoteRef on a current checkout and clone only when stale; git-ops-fake requireRemote guards resolveRemoteRef and clone but not fetch"
    - "With the remotes planned and HEAD == advertised commit, all 22 edge cases pass; LAYER-07 passes every later assertion (marker, origin, record paths, user tree unchanged)"
    - "A scratch run with a stale project checkout re-cloned into the project scope, swapped, kept marker and origin, left staging/backup empty and the user tree unchanged"
  falsification_test: "A project checkout missing, moved, or without its marker/origin after a (current or stale) update, or a user-scope tree change, would prove a production regression"
  fix_rationale: "The production behavior from the swap plan is intended (upstream parity: Claude Code checks freshness with ls-remote and re-clones). The tests must plan the remotes the new check contacts and assert the calls the new model makes."
  blind_spots: "Cucumber suites not run here (the gate's cucumber leg is separate); direct coverage of all pairs not yet run"
  candidate_causes:
    - "code: swap/backup or tag copy moving a project checkout (eliminated by the stale scratch run)"
    - "data/test: test doubles planned for D-14 in-place fetch (confirmed)"
  and_gate: "no -- each failure has one cause; the fake's URL gate and the fetch recorder are the same stale assumption"

## Symptoms

expected: full unit, integration and direct-coverage suites pass after the merge
actual: edge marketplace update handler test fails 7 cases; LAYER-07 integration case fails at line 278; direct coverage halts at the first failing pair
errors: "createGitOpsFake blocked unplanned remote https://gitlab.example.com/team/alpha"; LAYER-07 "+ [] - ['<project>/.pi/pi-claude-marketplace/sources/mp']"
reproduction: npm run test:integration; node --test test/edge/handlers/marketplace/update.test.ts
started: after merging the marketplace re-clone/swap and the release-tag ls-remote work (226c005)

## Eliminated

## Evidence

- timestamp: 2026-11-24T08:40:00Z
  checked: test/platform/git-ops-fake.ts, orchestrators/marketplace/clone-swap.ts, update.ts refreshGitSource
  found: the fake's `fetch` never calls requireRemote (it fetches by remote name), but `resolveRemoteRef` and `clone` do. The swap's only git calls are listRemotes(liveDir), resolveRef(liveDir, HEAD), resolveRemoteRef(url, ref, auth), and clone only when stale. A current checkout makes no fetch and no clone.
  implication: any test that seeded url/github marketplaces with an unplanned fake and asserted the fetch recorder is stale. The fake blocking the ls-remote URL is its designed guard, not a fake bug.
- timestamp: 2026-11-24T08:42:00Z
  checked: edge update.test.ts (7 failing cases)
  found: createGitOpsFake({ boundary: "memory" }) with no allowedRemoteUrls; seeded url sources https://gitlab.example.com/team/{alpha,beta}#main; the cases assert `git.state.calls.fetch` dirs as the delegation recorder; the seeded HEAD is the fake's initialOid while the remote advertises updatedOid, so even a planned URL would be stale and clone with no fixture
  implication: the cases need the remotes planned and HEAD == advertised commit (current, no clone), and the delegation recorder must move to the freshness calls (resolveRef dir + resolveRemoteRef url/ref/auth host). The rejection cases' `fetch: []` became vacuous and should assert no git call at all.
- timestamp: 2026-11-24T08:44:00Z
  checked: LAYER-07 integration case
  found: notifications (line 270, passed) include `● mp [project] (skipped) {up-to-date}`; the double's HEAD after the project clone is REMOTE_HEAD, equal to the remote it advertises, so the swap reports current; the fetch recorder is empty by design. Assertions after line 278 (project clone marker, origin, record paths, user tree unchanged) never ran.
  implication: the line-278 expectation is the in-place fetch model; must rerun with the freshness recorder to check the later assertions before ruling out a production regression.
- timestamp: 2026-11-24T08:55:00Z
  checked: LAYER-07 with the freshness recorder (resolveRef slice == [{dir: projectClone, ref: HEAD}], ls-remote slice == [REPO_URL])
  found: 6/6 in the file pass, including the marker, origin, record path, and unchanged user tree assertions
  implication: the current-checkout path leaves the project checkout intact
- timestamp: 2026-11-24T08:58:00Z
  checked: scratch copy of LAYER-07 with double.state.head moved off the advertised commit before the update (stale -> full swap)
  found: a third clone into the project scope; project sources/mp has the manifest, plugin tree, ownership marker, origin https://example.com/acme/mp; sources-staging and sources-backup empty; user tree unchanged; skills intact; row "(skipped) {up-to-date}" by the UXG-05 content compare
  implication: the swap and backup do not delete or move a project checkout; no production regression
- timestamp: 2026-11-24T09:05:00Z
  checked: edge update.test.ts with createCurrentGitOps (allowedRemoteUrls alpha/beta, initialOid == remoteHead) and the freshness recorder
  found: 22/22 pass
  implication: fix for failure 1 holds
- timestamp: 2026-11-24T09:12:00Z
  checked: npm run test:modules; npm run test:integration
  found: modules 19141 tests, 19140 pass, 1 fail (dispatch-exec.test.ts:39, known sandbox baseline); integration rc=0
  implication: no further unit or integration failures from the merge

## Resolution

root_cause: "Test expectations, not production. The marketplace update of github/url sources now checks freshness with ls-remote (resolveRemoteRef) and re-clones only a stale checkout (D-SG-10). (1) The edge handler cases built createGitOpsFake with no planned remote; its URL guard covers resolveRemoteRef and clone but never covered fetch, so the first ls-remote was refused, and the cases still asserted the D-14 in-place fetch recorder. (2) LAYER-07 asserted one fetch into the project clone; a current checkout is no longer fetched. The swap, backup, and the release-tag copy do not move or delete a project checkout (current and stale runs both keep it with marker and origin)."
fix: "Edge test: createCurrentGitOps plans the alpha/beta remotes and sets HEAD == advertised commit (current, no clone); the delegation recorder is now the HEAD reads plus the ls-remote calls (url, ref, bound host); the rejection cases assert no freshness check ran. LAYER-07: assert the update read the project checkout's HEAD and asked REPO_URL once."
verification:
  target_test: { result: pass, detail: "edge update.test.ts 22/22; LAYER-07 file 6/6" }
  mutation_check: { result: pass, mutant: "clone-swap.ts readLocalHead reads backupDir instead of liveDir", mutant_killed: true, detail: "8 of 28 cases fail (7 edge delegating cases + LAYER-07); file restored" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detail: "fetch assertions replaced by the freshness calls the new model makes; rejection cases strengthened from fetch==[] to no HEAD read and no ls-remote" }
  adjacent_tests: { result: pass, detail: "test:modules 19141/19141 and test:integration 426/426 in the gate's trimmed env; direct coverage of all pairs rc=0 (383 LCOV records)" }
  revert_and_reconfirm: { result: pass, detail: "at 226c005 (before the fix) the edge file failed 7/22 and LAYER-07 failed at line 278 (gate log + local run)" }
  guardrail_verdict: accepted
files_changed:
  - test/edge/handlers/marketplace/update.test.ts
  - test/integration/project-install-adds-user-marketplace.test.ts
commits: [af49319, e62b033]
