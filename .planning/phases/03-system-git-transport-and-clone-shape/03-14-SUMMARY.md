---
phase: 03-system-git-transport-and-clone-shape
plan: "14"
subsystem: testing
tags: [cucumber, system-git, isomorphic-git, symlinks, migration, keep-marketplace]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-04 key drop in checkoutGitDirCopy; 03-09 mirror swap and PUP-2 sync by swap; 03-10 keep-variable Given; 03-11 freshness check and update scenarios"
provides:
  - "Earlier-version git settings Givens for a marketplace checkout and a plugin mirror, and a kept-settings Then"
  - "Linked-skill-file Givens for a published plugin and for a git repository plugin"
  - "A Then that lists a staged skill's supporting files, a link shown as `-> target`"
  - "Seven scenarios: two old marketplace clones, two copies of old clones, the outside link of a git marketplace, and the kept marketplace in plugin update"
affects: [03-17 docs and D-SG-11 outcome, SG-MIG-01, SG-TRN-06]

actuals:
  tokens: 9867
  tasks: 3
  commits: 3
plan_head_before: 82c2691358d2f428192aa67d012c1965d81d8cfe
plan_head_after: aaea7ffd1ed2b1cd25a8c51aba4a38e06c9d4ef2

tech-stack:
  added: []
  patterns:
    - "A clone's local git settings are written and read through features/lib/git-clones.ts with --git-dir and the hermetic HOME"
    - "A linked file in a fixture skill is a relative link inside the skill (linked.txt -> notes.txt), so it stays valid in every copy"

key-files:
  created: []
  modified:
    - features/lib/git-clones.ts
    - features/lib/path-marketplace.ts
    - features/lib/published-marketplace.ts
    - features/lib/git-plugin.ts
    - features/step_definitions/marketplace/checkout.steps.ts
    - features/step_definitions/plugin/git-source.steps.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - features/step_definitions/plugin/installation.steps.ts
    - features/marketplace/git-source.feature
    - features/plugin/git-source.feature
    - features/plugin/install-dependencies.feature
    - features/plugin/install.feature
    - features/plugin/url-marketplace-update.feature

key-decisions:
  - "ROADMAP success criterion 5 reads as met by D-SG-11's 're-clone when stale, drop the core.* keys on every copy': an old clone whose remote moved is re-cloned on its next update; one whose remote has not moved reports up to date and keeps serving its plugins with the files the earlier version wrote; nothing checks out into a live clone; no fingerprint rule marks old clones."
  - "The linked file is a supporting file of the skill, not SKILL.md: skill discovery refuses a SKILL.md that is a link (bridges/skills/discover.ts)."
  - "The mirror-copy scenario installs an unpinned plugin: a pinned install always clones (install-clone-probe.ts probePinned), so only an unpinned source copies from the mirror, after the freshness check."

requirements-completed: ["SG-MIG-01", "SG-TRN-06", "SG-TRN-01"]

coverage:
  - id: D1
    description: "An old marketplace clone whose remote moved: the load changes nothing, the update re-clones it, and its plugin's linked skill file installs as a link"
    requirement: SG-MIG-01
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a marketplace whose clone an earlier version made re-clones it, and its plugin's linked skill works"
        status: pass
    human_judgment: false
  - id: D2
    description: "An old marketplace clone whose remote has not moved reports up to date after the freshness check alone and still serves its plugins"
    requirement: SG-MIG-01
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a marketplace whose clone an earlier version made and whose remote has not moved reports it up to date and still serves its plugins"
        status: pass
    human_judgment: false
  - id: D3
    description: "A copy of an old plugin mirror and a release-tag copy of an old marketplace clone write a linked skill file as a link"
    requirement: SG-MIG-01
    verification:
      - kind: e2e
        ref: "features/plugin/git-source.feature#A plugin whose commit a mirror an earlier version made already holds installs from a copy of the mirror with its linked skill as a link"
        status: pass
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#A dependency installed at a release tag of a marketplace whose clone an earlier version made installs its linked skill as a link"
        status: pass
    human_judgment: false
  - id: D4
    description: "A git marketplace plugin whose manifest links outside the marketplace is refused as unavailable {unreadable manifest}, installs nothing, and the outside file is unchanged"
    requirement: SG-TRN-01
    verification:
      - kind: e2e
        ref: "features/plugin/install.feature#Installing a plugin from a git marketplace whose manifest links outside the marketplace refuses it and installs nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "plugin update keeps an unreachable url marketplace when CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE is set, twice in a row"
    requirement: SG-TRN-06
    verification:
      - kind: e2e
        ref: "features/plugin/url-marketplace-update.feature#Updating a plugin keeps its marketplace when the marketplace's git host is unreachable and CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE is set"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 14: Old clones, outside links, and the kept marketplace Summary

**Seven cucumber scenarios pin what an upgraded user sees. A marketplace clone or plugin mirror with isomorphic-git's `core.symlinks=false` settings loads unchanged. It is re-cloned when stale and left alone when current. Every copy of it writes a committed link as a link. A link out of a git marketplace is still refused. `plugin update` keeps an unreachable marketplace when `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` is set.**

## Performance

- **Duration:** about 43 min
- **Started:** 2026-11-24T10:48:39Z
- **Completed:** 2026-11-24T11:31:44Z
- **Tasks:** 3 of 3. Task 1 is a tracer, and its gate passed.
- **Files modified:** 13 (0 created)

## Accomplishments

- `features/lib/git-clones.ts` holds `EARLIER_VERSION_GIT_SETTINGS` (`core.symlinks=false`, `core.ignorecase=true`, `core.filemode=false`, `remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*`), `giveEarlierVersionGitSettings`, `readEarlierVersionGitSettings`, and `pluginMirrorOf`. Each runs the suite's hermetic system git with `--git-dir` on the scope's own clone.
- `writeLinkedSkillFile` (in `path-marketplace.ts`) writes `notes.txt` (`The notes of <plugin>.`) and a relative link `linked.txt -> notes.txt` in the plugin's skill. `linkPublishedSkillFile` and `pushLinkedSkillFile` commit and push the link for a marketplace and for a plugin repository. The Givens check the pushed tree mode `120000`.
- `Then the staged skill {string} of the {word} scope holds these supporting files:` lists every file of one staged skill except `SKILL.md`. `SKILL.md` is left out because it records the plugin root, which for a git plugin holds a clone key that hashes the git host's random port.
- The seven scenarios pass under the adapter profile. None is an MCP scenario, so the builtin profile runs none of them.

## Task Commits

1. **Task 1 (tracer): old marketplace clone, stale and current** - `31eff29` (test). Tracer gate: after the commit, the verify commands ran again on the committed tree, and they passed: adapter 2/2, builtin 0, `check:features` and ESLint exit 0.
2. **Task 2: copies of an old mirror and an old marketplace clone** - `8950a38` (test)
3. **Task 3: outside link of a git marketplace, kept marketplace in plugin update** - `aaea7ff` (test)

The commit hook ran `npm run check:commit` on each commit, and it passed. Task 1's first attempt failed the hook (see deviation 6), and no commit was made.

## RED runs (local mutations, not committed, each file restored byte for byte)

- **Task 1, scenario "...re-clones it, and its plugin's linked skill works".** Mutation: in `clone-swap.ts::refreshCloneBySwap`, a stale checkout with a live clone ran `resolveRemoteRef`, `fetchCommit` into the live clone, and `checkout` there, then returned `replaced`. The scenario failed at `Then the git host receives these requests:`: the fetch sent `GET`, `POST` instead of the re-clone's `GET`, `POST`, `POST`. 24 steps: 16 passed, 1 failed, 7 skipped. A second run used a scratch copy of the scenario without that request table. It failed at `Then the staged skill "formatter-skill" ... holds these supporting files:` with `+ 'notes.txt' - '-> notes.txt'`. The in-place checkout into a clone with `core.symlinks=false` wrote the link as a 9-byte text file. 23 steps: 20 passed, 1 failed.
- **Task 1, scenario "...whose remote has not moved...".** Mutation: `checkFreshness` returned `STALE` when remote equalled local. The scenario failed at `Then the git host receives these requests:`. The re-clone's `GET`, `POST`, `POST` followed the freshness pair. The status row still read `skipped {up-to-date}`, because the catalog bytes did not change. 23 steps: 15 passed, 1 failed, 7 skipped.
- **Task 2, both scenarios.** Mutation: in `platform/git.ts::checkout`, the `fromCopiedGitDir` loop ran over `COPIED_CLONE_KEYS.slice(0, 0)`, so the copy kept the copied keys. Both scenarios failed at the supporting-files table with `+ 'notes.txt' - '-> notes.txt'` (`subq-skill` from the mirror copy, `lib-skill` from the tag copy). 2 scenarios (2 failed), 32 steps: 30 passed, 2 failed.
- **Task 3, outside link.** Mutation: in `manifest-containment.ts::locateLinkedCandidate`, `answers.includes(true)` became `answers.length >= 0`, which skips the `realpath` boundary. The plugin installed. The scenario failed at `Then the result has these fields:` with `+ 'info' - 'error'` and `needs reload` `true`. 15 steps: 11 passed, 1 failed, 3 skipped.
- **Task 3, kept marketplace.** Mutation: in `update-flow.ts`, `keepOnUnreachable` became `keepMarketplaceOnFailure(...) && false`. The first update failed with `+ 'error' - 'info'` and the summary `A plugin operation has failed.`. 17 steps: 10 passed, 1 failed, 6 skipped.

## Verification

- Task 1: `test:cucumber:profile --name "earlier version made" features/marketplace/git-source.feature`: adapter 2/2, builtin 0. `check:features` exit 0. ESLint on the step and lib files exit 0.
- Task 2: the same filter on `features/plugin/git-source.feature` and `features/plugin/install-dependencies.feature`: adapter 2/2, builtin 0. `check:features`, ESLint, and `npm run fallow` exit 0.
- Task 3: `features/plugin/install.feature` and `features/plugin/url-marketplace-update.feature`: adapter 35/35, builtin 0. `check:features` and ESLint exit 0.
- Wider runs after the last commit:
  - `npm run test:modules`: the one failure is the known sandbox baseline `test/bridges/hooks/dispatch-exec.test.ts:39` ("executes a blocking hook through the portable process boundary").
  - `npm run test:integration`: exit 0.
  - `features/marketplace` and `features/plugin` under adapter: 1330/1330 scenarios.
  - `features/plugin` under builtin: 39/39.
- No new scenario reaches a host other than the loopback git host. Every repository is a `dir` marketplace's git-subdir source or a url marketplace on the stand-in.

## Files Created/Modified

- `features/lib/git-clones.ts` - earlier-version settings constant, writer, reader, and `pluginMirrorOf`.
- `features/lib/path-marketplace.ts` - `writeLinkedSkillFile`, `LINKED_SKILL_TARGET`.
- `features/lib/published-marketplace.ts` - `linkPublishedSkillFile`.
- `features/lib/git-plugin.ts` - `pushLinkedSkillFile`, header line.
- `features/step_definitions/marketplace/checkout.steps.ts` - the checkout settings Given and the kept Then.
- `features/step_definitions/plugin/git-source.steps.ts` - the mirror settings Given.
- `features/step_definitions/plugin/publishing.steps.ts` - both linked-file Givens, the outside-file Then, and `assertPushedLink`, which the manifest-link revision now shares.
- `features/step_definitions/plugin/installation.steps.ts` - the supporting-files Then.
- Feature files: the 2 + 1 + 1 + 1 + 1 scenarios listed under "Lines for later plans".

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plan premise] The linked file is a supporting file of the skill, not `SKILL.md`**
- **Found during:** Task 1 (design)
- **Issue:** `bridges/skills/discover.ts::hasRegularSkillFile` refuses a `SKILL.md` that is a link, so a linked skill file would never be offered.
- **Fix:** The skill keeps a regular `SKILL.md`, and its `linked.txt` links to `notes.txt` in the same skill. The supporting-files Then shows a link as `-> notes.txt` and the target's text. The session-offers step shows the skill.
- **Commit:** `31eff29`

**2. [Plan wording] A linked-file revision alone reports `skipped {up-to-date}`**
- **Issue:** `marketplace update` reports `updated` only when the catalog bytes change. It still re-clones. The first run of the stale scenario read `skipped {up-to-date}`.
- **Fix:** The stale scenario also sets a new description (`Given the marketplace "tools" has the description "Tools with a linked skill"`), so the update reports `updated`, as the plan states.
- **Commit:** `31eff29`

**3. [Rule 1 - plan premise] A pinned install never copies from the mirror**
- **Issue:** `install-clone-probe.ts` clones a pinned source through `materializePluginClone`. Only an unpinned source copies from the mirror (`materializeUnpinnedSource` -> `materializePluginCommitCopy` -> `copyMirrorAtCommit`), after the mirror's freshness check. The first run sent two clones. A copy with no request exists only in `reinstall` and `apply` (`refreshSource: false`).
- **Fix:** The scenario installs `subq` unpinned from the `mono` mirror. That mirror was fetched to revision 2 (which holds the link) and then given the earlier version's settings. The request table is the freshness pair (`GET`, `POST`), and `subq` runs revision 2. The per-commit key does not include the subdir path, so the fetch is what keeps a revision-2 copy from existing already. Title: "A plugin whose commit a mirror an earlier version made already holds installs from a copy of the mirror with its linked skill as a link".
- **Commit:** `8950a38`

**4. [Scope] No session step in the two Task 2 scenarios**
- **Issue:** Their next load reports a pending change that this plan does not own: `lib@tools` `skipped {dependents constrain}` in the tag scenario, and `subp@gits` `will update` after the fetch. A session step would need a full report table for that behavior.
- **Fix:** Both end at the supporting-files table, and the mirror scenario also checks the revision.

**5. [Scope] Files outside `files_modified`**
- `features/lib/git-clones.ts`, `features/lib/path-marketplace.ts`, and `features/step_definitions/plugin/installation.steps.ts`. The skill's layout rule moves a helper that two step modules share into `features/lib/`. The staged-skill Then belongs with the other staged-skill steps.
- Both linked-file Givens live in `plugin/publishing.steps.ts`, beside the existing "published plugin" and "links the manifest" Givens. `features/step_definitions/marketplace/publishing.steps.ts` is unchanged.
- The 03-12 and 03-13 plans touch no `features/` file.

**6. [Rule 3 - Blocking] fallow unused export**
- The first Task 1 commit failed the hook: `LINKED_SKILL_FILE` was an export with no consumer. It became module-local. No `--amend` was used.

**7. [Plan accuracy] The outside-link Given already committed the link**
- `linkPublishedManifest` goes through `changePublication`, so a url publication commits and pushes the link. No change was needed. A Then was added that checks the outside file still holds `{"name":"app","version":"1.0.0"}`.

**8. [Environment]** The new worktree had no optional-peer cache, so `node scripts/install-test-peers.mjs` filled it. Nothing tracked changed.

---

**Total deviations:** 8 (2 plan premise, 2 wording or accuracy, 2 scope, 1 blocking, 1 environment). **Impact:** harness and scenario files only. No production code changed.

## Issues Encountered

- The session refuses Bash text that names `git` in a complex form. Edits, runs, RED mutations, and commits ran from scripts in the scratch directory.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-03-42: the outside-link scenario proves the refusal and the unchanged outside file, and its RED shows that the `realpath` boundary is what refuses.
- T-03-43: two scenarios prove a copy writes a link as a link, and the copied-keys RED fails both.
- T-03-54: the current-clone scenario proves a current old clone keeps serving its plugins with its settings left as they were.
- T-03-SC: nothing was installed beyond the project's own optional test peers.

## Orchestrator actions

None. The plan asks for no `windows append`.

## Lines for later plans

**Given texts:**
- `Given the checkout of the marketplace "<name>" in the <scope> scope has the git settings an earlier version made`
- `Given the plugin mirror of the git repository "<name>" in the <scope> scope has the git settings an earlier version made` (exactly one mirror must record that repository's origin)
- `Given the published plugin "<plugin>" of the marketplace "<name>" links a file of its skill to another file of the skill`
- `Given the plugin "<plugin>" of the git repository "<name>" links a file of its skill to another file of the skill` (records a new revision)

**Then texts:**
- `Then the checkout of the marketplace "<name>" in the <scope> scope keeps the git settings an earlier version made`
- `Then the staged skill "<skill>" of the <scope> scope holds these supporting files:` (`| file | text |`; a link reads `-> <target>`)
- `Then the file outside the marketplace that the published plugin "<plugin>" of the marketplace "<name>" links its manifest to holds this text:`

**Scenario titles (for the SG-MIG-01 outcome):**
- `features/marketplace/git-source.feature`: "Updating a marketplace whose clone an earlier version made re-clones it, and its plugin's linked skill works"
- `features/marketplace/git-source.feature`: "Updating a marketplace whose clone an earlier version made and whose remote has not moved reports it up to date and still serves its plugins"
- `features/plugin/git-source.feature`: "A plugin whose commit a mirror an earlier version made already holds installs from a copy of the mirror with its linked skill as a link"
- `features/plugin/install-dependencies.feature`: "A dependency installed at a release tag of a marketplace whose clone an earlier version made installs its linked skill as a link"
- `features/plugin/install.feature`: "Installing a plugin from a git marketplace whose manifest links outside the marketplace refuses it and installs nothing"
- `features/plugin/url-marketplace-update.feature`: "Updating a plugin keeps its marketplace when the marketplace's git host is unreachable and CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE is set"

**Reading of ROADMAP success criterion 5 (for the D-SG-11 outcome 03-17 writes):** criterion 5 is met by "re-clone when stale, drop the `core.*` keys on every copy" (D-SG-11).
- An old clone whose remote moved is re-cloned on its next update.
- One whose remote has not moved reports up to date and keeps serving its plugins with the files the earlier version wrote (links as links, 03-EVIDENCE Q5).
- Nothing checks out into a live clone. The load leaves the old settings in place (APL-D1), and the scenarios assert it.
- No fingerprint rule marks old clones.

**Measured rows:**
- An old-clone update with a moved remote sends `GET`, `POST`, then `GET`, `POST`, `POST`.
- With an unmoved remote, it sends `GET`, `POST`.
- An unpinned install that copies from a current mirror sends `GET`, `POST`.
- A kept `plugin update` sends one dropped `GET`, and the plugin row reads `skipped {up-to-date}` at info severity.

**Flagged for the verifier:** SG-MIG-01's edge probe stays unclassified, as the plan says. A copy of an old mirror with no request at all, through `reinstall` or `apply` with `refreshSource: false`, has no scenario.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

The plan's work is complete. The wave gate runs `npm run check`.

## Self-Check: PASSED

- FOUND: every file in `key-files.modified`. No file was created.
- FOUND: `31eff29`, `8950a38`, and `aaea7ff` are ancestors of HEAD, and `git rev-list --count 82c2691..HEAD` = 3 before this SUMMARY commit.
- Acceptance greps:
  - `core.symlinks` occurs once each in `checkout.steps.ts` and `git-source.steps.ts`.
  - `earlier version made` appears in 2 scenario titles in `features/marketplace/git-source.feature`, and in 1 title each in `features/plugin/git-source.feature` and `install-dependencies.feature`.
  - `has not moved` occurs once.
  - `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` occurs in `url-marketplace-update.feature`.
  - `git marketplace whose manifest links outside` occurs in `install.feature`.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*
