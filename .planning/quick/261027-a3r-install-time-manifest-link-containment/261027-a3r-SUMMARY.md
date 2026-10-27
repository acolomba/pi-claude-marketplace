---
quick_id: 261027-a3r
phase: quick-261027-a3r
plan: 01
subsystem: plugin manifest reads
tags: [manifest, containment, symlink, NFR-10, D-PL2-12, D-PL2-17, D-PL2-24, D-PL2-25]
status: complete
requirements: [RCN-08, RCN-05]
requires:
  - the realpath containment of the installed-copy read (7d348d8d)
  - the D-05-07 fixed-detail refusal (OWN_MANIFEST_REFUSAL)
  - the REC-05 plugin-declarer-unreadable row
provides:
  - domain/manifest-containment.ts (ManifestBoundary, copyManifestBoundary, inPlaceManifestBoundary, sourceManifestBoundary, isAbsenceError, locateManifestCandidate)
  - install-time refusal of a manifest that links outside Claude Code's boundary
  - fail-closed convergence on an installed copy that cannot be used
affects:
  - install, update, reinstall, enable and apply (resolver, version, declaration reads)
  - list and info (resolver note, version display)
tech-stack:
  added: []
  patterns:
    - one helper locates every manifest candidate; each reader keeps its own I/O and error contract
key-files:
  created:
    - extensions/pi-claude-marketplace/domain/manifest-containment.ts
    - test/domain/manifest-containment.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/manifest-path.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - features/plugin/git-source.feature
    - features/plugin/install.feature
    - features/plugin/enable.feature
    - features/lib/published-marketplace.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md
decisions:
  - "D-PL2-24 (user decision 2026-10-27): every install-time plugin manifest read locates its candidates through domain/manifest-containment.ts"
  - "D-PL2-17 amended (user decision 2026-10-27): the boundary is Claude Code's -- plugin directory for a copy, plugin and marketplace directories for a path plugin read in place"
  - "D-PL2-12 amended (user decision 2026-10-27): a recorded copy root outside its owning root answers unusable, not absent"
  - "D-PL2-25 (user decision 2026-10-27): convergence fails closed on an installed copy that cannot be used, and apply reports it once"
  - "Orchestrator decision 2: the resolver's escape note is reported as {unreadable manifest}, reusing the existing reason token"
metrics:
  completed: 2026-10-27
  tasks: 3
  files: 42
actuals:
  tokens: 54000
  tasks: 3
  commits: 3
plan_head_before: 0eaaca97f740b6398a9eeca267f18a47e8509f6b
plan_head_after: 57a07ac54e27cc7d46e27fe5d191b796ff504655
---

# Quick 261027-a3r: Install-time manifest link containment Summary

Every plugin manifest read on the install, update and reinstall paths now goes through one helper, `domain/manifest-containment.ts`. A manifest link is followed only when its realpath stays inside Claude Code's boundary. Install refuses a git or path plugin whose manifest escapes, and installs nothing. Convergence no longer treats an unusable installed copy as "no copy declarations": it fails the scope closed, and `apply` reports the declarer once.

BASE (HEAD before any edit): `0eaaca97f740b6398a9eeca267f18a47e8509f6b`.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | `95e1b6aa` | fix(plugin): contain install-time manifest links |
| 2 | `f4fb6b32` | fix(plugin): fail closed on an installed copy that cannot be used |
| 3 | `57a07ac5` | docs(plugin): record the install-time manifest link decisions |

All three went through the commit hook. For tasks 1 and 2, `npm run check:commit` ran and passed. The first attempt of each failed in the hook (task 1: two `import-x/order` errors and a `sonarjs/no-selector-parameter` on a boolean `pinned` parameter; task 2: a fallow `private-type-leak`). I fixed the cause and committed again. I never used `--amend`.

## Reader inventory as implemented

The boundary comes from `copyManifestBoundary` (roots `[pluginRoot]`, label "plugin directory") or `inPlaceManifestBoundary` (roots `[pluginRoot, marketplaceRoot]`, label "plugin directory and its marketplace directory"). `sourceManifestBoundary(source, pluginRoot, marketplaceRoot, pin)` holds the one rule: an unpinned `path` source is in place, and every other tree is a copy.

| Reader | Boundary | Escapes | Unresolvable (loop) | Dangling | Pinned by |
| --- | --- | --- | --- | --- | --- |
| P1 resolver `readManifest` | from `deriveSourcePluginRoot`: unpinned path in place, pinned path and git a copy | `unavailable`, note `plugin manifest resolves outside the <label>`, reported `{unreadable manifest}` | rethrows the errno (ELOOP) | next candidate | `plugin-resolver.test.ts` (7 D-PL2-24/17 cases), the agreement gate |
| P2 `readDeclaredPluginVersion` (and the GV-01 directory pin) | `sourceManifestBoundary` with no pin (`resolvePluginVersion`); a copy (`resolveTagPinnedPluginVersion`, the list/info warm git tree); in place (list/info path tree); the pin check uses `sourcePinOverride` | `undefined` plus `hookDebugLog` | `undefined` | next candidate | `shared.test.ts` `readDeclaredPluginVersion`, `resolvePluginVersion boundaries` |
| P3 `readDependencyDeclaration` | path in place, warm git clone a copy | `unusable`: the entry answers (D-01-07), or `OWN_MANIFEST_REFUSAL` under `refuseUnusableOwnManifest` (D-05-07) | same | next candidate | `dependency-declaration-read.test.ts` catalog link-shape cases, the agreement gate |
| P4 `readCandidateDeclaration` | `sourceManifestBoundary` with the candidate's marketplace record and `prepared.resolvedVersion`; no record is a copy | `unusable`: the entry answers | same | next candidate | `dependency-declaration-read.test.ts` candidate link-shape cases |
| P5 `readInstalledCopyDeclaration` | `installedCopyReadOptions`: `resolvedSha` is a copy, else in place with the marketplace clone; the owning root stays the copy-root check | `OWN_MANIFEST_REFUSAL` | same | next candidate | `dependency-declaration-read.test.ts` git-record and path-record link-shape loops |
| P6 `info` own dependency walk | unchanged | follow-up T-a3r-07 | | | |
| M1 `marketplace.json` | unchanged (Claude Code reads it with no containment check) | | | | |

## RED evidence

**Task 1.** I ran the new and changed tests against BASE's source in a scratch copy of the tree (`git archive 0eaaca97`, the new test and feature files copied in):

- `test/domain/manifest-containment.test.ts` and `shared.test.ts` fail to load: `ERR_MODULE_NOT_FOUND` for `domain/manifest-containment.ts`.
- Unit run over the resolver, declaration, agreement, classifier, parity and info suites: `pass 616, fail 14`. The failures are the behaviour changes: the three resolver escape cases (path outside the marketplace, git outside its plugin directory, pinned path into the marketplace), the four catalog-read escape cases, the two agreement escape rows and the device row, both classifier cases, the parity row, and the info device row.
- Both scenarios fail because install succeeds:

  ```text
  Then the result has these fields:
      'severity',
  +     'info'
  -     'error'
  +     'true'
  -     'false'
  -   [ 'summary', 'A plugin operation has failed.' ]
  2 scenarios (2 failed)
  ```

The cases for inside links, loops and dangling links pin behaviour BASE already had, so they pass on BASE. They are regression pins, not RED cases.

**Task 2.** I ran the new and changed tests against Task 1's tree (`git archive 95e1b6aa`):

- `dependency-declaration-read.test.ts` and `delisted-plugins.test.ts` fail to load: no export `installedCopyReadOptions` and no export `reportDeclarerFailure`.
- `dependency-index`, `convergence`, `dependency-verdict` and `apply` suites: `pass 320, fail 15`. The failures are both D-PL2-12 delisted cases (`not in manifest` where `unreadable manifest` is now expected), the new installed-first cross-root case, the two convergence D-PL2-25 cases, the reader-signature cases, the verdict D-PL2-25 cases, and both apply D-PL2-25 cases. Example: the steady apply case reported no row on Task 1's tree.

## Proof scope

Install now refuses every copy that the installed-copy read would refuse. Both reads use the same boundary, and a per-commit copy cannot change after install. The copy-root refusal needs a hand-edited `state.json`. So the published-repository harness cannot reach these behaviors, and unit cases prove them (the 02-04 / TST-01 unit-only precedent):

- **The narrowed installed-copy boundary.** A git record's link into another part of `plugin-clones/` needs a copy that install would have refused. Pinned by the git-record link-shape loop and the "git record's copy refuses a manifest link outside its plugin directory but inside the plugin clones" case.
- **D-PL2-12 to `unusable`.** It needs a record whose `resolvedSource` sits outside its owning root, which only a hand edit or an older version's state produces. Pinned by `dependency-index.test.ts` and `dependency-declaration-read.test.ts`.
- **The D-PL2-25 row.** It needs an enabled record whose installed copy is refused, which install prevents. Pinned by `apply.test.ts` (two cases) and `convergence.test.ts`.
- **`readCandidateDeclaration`.** The update's resolver refuses an escaping candidate tree before this read, so the read is defence in depth. Pinned by the candidate link-shape cases.

## Final check

- Command: `npm run check > "${TMPDIR:-/var/tmp}/261027-a3r-check.log" 2>&1; echo "exit=$?"`, run from the checkout root with no pipe.
- Exit status: `exit=0`
- HEAD: `57a07ac54e27cc7d46e27fe5d191b796ff504655`
- `node --version`: v26.12.1
- Log tail: `passed typecheck`, `lint`, `lint:workflows`, `fallow`, `format:check`, `test:corresponding`, `check:features`; cucumber `916 scenarios (916 passed)`, `9233 steps (9233 passed)`; `Merged LCOV: coverage/direct.lcov (292 records)`, so direct coverage passed for every pair.

## Deviations from Plan

### Auto-fixed issues

1. **[Orchestrator decision 2] The refused row names the real cause.** `shared/probe-classifiers.ts` exports `MANIFEST_ESCAPE_NOTE`, and both `narrowResolverNotes` and install's `classifyResolverReason` map it to the existing `unreadable manifest` token. `ResolverNoteReason` gains that member. Tests: `probe-classifiers.test.ts`, `install.messaging.test.ts`, and a `cross-surface-reason-parity.test.ts` row. These files were not in the plan's list. Both scenarios assert `(unavailable) {unreadable manifest}`.
2. **[Rule 1] A walk fault over a resolved target refuses as an escape.** The plan said "unresolvable". The target was just resolved through every directory above it, so the fault is a race that no unit test can reach without chmod. Both answers refuse the plugin. `containsTarget` returns `false` on any throw.
3. **[Rule 2] One home for the source boundary rule.** `sourceManifestBoundary` lives in `domain/manifest-containment.ts`, which therefore also imports `domain/source.ts` (same zone). `shared.ts`, `install-outcome.ts` and `dependency-declaration-read.ts` use it. Putting it in `shared.ts` would have made `dependency-declaration-read.ts` import `shared.ts`, which imports `dependency-index.ts`, which imports `dependency-declaration-read.ts`: a cycle. The parameter is `pin: string | undefined`, not a boolean, because lint rejects a selector parameter.
4. **[Rule 3] `PreparedPluginUpdate` is not widened.** `candidateLookup(prepared, subject)` passes `ownValue(prepared.state.marketplaces, subject.marketplace)` and `prepared.resolvedVersion` to `readCandidateDeclaration`. That reader treats a missing record as a copy, which is the narrowest boundary, and unit tests cover that branch. A trial that widened the type broke 11 whole-object assertions in `update-preflight.test.ts`.
5. **[Rule 3] `InstalledDeclarationsReader` gains a `plugin` parameter.** The failure arm names the declarer (`unusableDeclaration(key, …)`, now exported), and the reader had no name.
6. **[Rule 3] Test fixtures moved to states that D-PL2-12 as amended admits.** Each of these fixtures recorded a commit with a copy outside `plugin-clones/`, or a path record whose copy sat outside its marketplace. The old rule read those as absent. Changes:
   - `dependency-index.test.ts`: records default to a copy under their marketplace.
   - `uninstall.test.ts` (`seedDeclaringScope`): the copy is a gone path under the marketplace.
   - `shared.test.ts` (`saveToolsScope`): copies under the marketplace.
   - `enable-disable.test.ts` GIT-01 (two cases): a gone copy under the user plugin clones.
   - `update-swap.test.ts` (three cases): a gone copy under the plugin clones.
   - `convergence.test.ts` D-10: a real per-commit copy.
   - `update-preflight.test.ts`: eight refresh-focused cases (WR-01, WR-02, WR-05, the two disabled clone-cleanup cases, and the three D-16-09 cases) inject an admitting constraint gate, `ADMITTING_GATE`. This is their only way past the holder walk without changing the state they test.
7. **`info.test.ts`'s device row** now expects `⊘ host (unavailable) {unreadable manifest}`. A link to `/dev/null` leaves the boundary.
8. **The agreement gate's moved device row** expects `info` to show `{invalid manifest}`. `info`'s own walk (P6, unchanged) passes the device to the bare sibling's invalid `[42]` list. This is T-a3r-07 made visible.
9. `installedCopyOwnerRoot` is replaced by `installedCopyReadOptions`, the one helper all three installed-copy callers use. `CandidateMove.installed` is now required. A copy with no declarations is `[]`.

## New uncertain choices

1. **Records that carry a stale `resolvedSha` now fail closed in their whole scope.** Older versions could leave a stale sha on a `path` record whose files are the marketplace tree (the state WR-01, WR-02 and WR-05 repair). Under D-PL2-12 as amended, that record's copy root lies outside `plugin-clones/`. So every update in its scope, and an enable whose closure reaches it, fails `{unreadable}` through the holder walk. Before this change, an update repaired such a record. The user may want a narrower rule for this one state, or a repair path. The eight `update-preflight` cases above keep testing the repair with an admitting gate.
2. **A refused git install leaves its per-commit clone.** Scenario C1 asserts the clone `{app revision 2}` under the project's plugin clones, as the run left it. The clone garbage collection reclaims it later.
3. **`apply` reports only installed-copy failures.** It captures them through the reader it passes to `judgeFinalScope`, plus the cascade's `installedCopyFailure`. A catalog failure in the final judgement stays the read pass's own REC-05 row, as before.
4. **The pin parameter of `readCandidateDeclaration` is `prepared.resolvedVersion`** (the tag's semver). Only whether it is set matters.

## Notes

- Files left as historical records: `02-VALIDATION.md`, `02-PATTERNS.md`, `02-04-PLAN.md`, the STATE.md decision list, item 2 of the 02-04 `## Uncertain choices` (it names the removed enable scenario), and the 261027-92s PLAN and SUMMARY.
- Open points for the user, as the orchestrator resolved them for this run:
  - `marketplace.json` containment: left uncontained, matching Claude Code (recorded as upstream parity in D-PL2-24).
  - The refused install row's reason: `{unreadable manifest}` (deviation 1).
  - Path plugins of git-hosted marketplaces: kept in place, with the plugin and marketplace directories as the boundary. The upstream cache difference is noted in D-PL2-17.
  - The D-PL2-25 row in `pending` and the load: out of this task. Quick 261027-9oo adds it.
  - `info`'s own dependency walk: left unchanged, follow-up T-a3r-07.
- Scenario counts: `enable.feature` 12, `git-source.feature` 17, `install.feature` 20 (`grep -c Scenario`).

## Threat Flags

None. No security-relevant surface outside the plan's `<threat_model>` was introduced. T-a3r-01..05 are mitigated as planned: the helper, the resolved-target open, the bounded loop handling, the path-free notes, and D-PL2-25. T-a3r-06 (`marketplace.json`) and T-a3r-07 (`info`'s own walk) are accepted.

## Self-Check: PASSED

The two created files exist. Commits `95e1b6aa`, `f4fb6b32` and `57a07ac5` are ancestors of HEAD, `git rev-list --count 0eaaca97..HEAD` = 3, and no commit deletes a file.
