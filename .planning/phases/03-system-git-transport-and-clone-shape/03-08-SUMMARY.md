---
phase: 03-system-git-transport-and-clone-shape
plan: "08"
subsystem: orchestrators-plugin
tags: [system-git, release-tags, ls-remote, for-each-ref, depth-1, tag-copy, d-sg-09, cucumber]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-06 the depth-1 system-git clone, the pin ladder's fetchCommit, test/platform/system-git-ops.ts; 03-05 runRemote, listRemoteTags on system git, the insteadOf pair"
provides:
  - "platform/git.ts listLocalTags: one local for-each-ref of refs/tags, a tag of a tag peeled through rev-parse; listTags and resolveTagOid removed"
  - "marketplace-tag-probe.ts reads a github or url marketplace's tags with ls-remote --tags of its wire URL and the host's bundle, a directory marketplace's with listLocalTags, and gives a hosted catalog tag-listing-failed; memo keyed by URL or root"
  - "install-cascade and the update constraint gate hand the probe the marketplace record's source and the command's auth context"
  - "materializeMarketplaceTagClone fetches the tag's commit into the staging copy for a git marketplace (resolveAuth builds the host bundle on a cold key only)"
  - "test/architecture/marketplace-tag-probe-remote.test.ts and MARKETPLACE_TAG_PROBE_TARGETS (the inverted import proof)"
  - "the step `the marketplace {string} has a revision only the tag {string} reaches, offering these plugins:` and two D-SG-09 scenarios"
affects: [03-09, 03-12, 03-13, 03-17, transport swap, docs]

plan_head_before: 91ecbeaa9ee08bb4ec2e517b0a839b016b8fbb15
plan_head_after: 11f052925aba305b178ddcb51685caa886c2b7be

actuals:
  tokens: 19498
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A marketplace's tags are read where its repository lives: the remote for a git marketplace (depth-1 clone), the checkout for a directory marketplace"
    - "A clone-cache verb that may reach the network takes a lazy resolveAuth builder, so a warm key or a local arm builds no bundle"

key-files:
  created:
    - test/architecture/marketplace-tag-probe-remote.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/domain/release-tag.ts
    - test/architecture/gate-targets.ts
    - test/platform/git.test.ts
    - test/orchestrators/plugin/marketplace-tag-probe.test.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - test/orchestrators/plugin/update-constraint-gate.test.ts
    - test/orchestrators/plugin/clone-cache.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - features/plugin/install-dependencies.feature
    - features/step_definitions/marketplace/publishing.steps.ts

key-decisions:
  - "The probe parses the marketplace record's stored source: github and url list the remote at networkCloneUrl with buildCloneAuth(canonicalCloneUrl) built inside the listing, path lists the checkout, anything else (hosted, unknown) is tag-listing-failed with no call"
  - "The listing memo key is the wire URL for a git marketplace and the root for a directory marketplace; a failed listing writes no entry; an InvalidGitHubBaseUrlError in the cause chain rethrows (GHB-03)"
  - "listLocalTags returns RemoteTag[] in for-each-ref's refname order; only a line whose peeled type is tag runs a second command (rev-parse --verify --quiet refs/tags/<n>^{commit})"
  - "The tag copy takes resolveAuth (cloneUrl, kind) => bundle instead of a built bundle, as materializePluginClone takes resolveAuth, so a warm key and a directory marketplace build none"
  - "The update preflight's UpdateCloneProbe exposes its cloneAuth, so an autoupdate tag copy gets the stored-credential bundle as its clone does"
  - "The new step records the tag revision as one of the marketplace repository's own revisions in the world, so {tools revision 1} names the version recorded at the tag"

patterns-established:
  - "Probe callers thread the marketplace record's source beside its root; the probe decides local or remote"

requirements-completed: ["SG-TRN-04"]

coverage:
  - id: D1
    description: "listLocalTags lists every commit-backed local tag with its commit (lightweight, annotated, tag of a tag) and drops tree and blob tags, with one for-each-ref and one rev-parse for the tag of a tag"
    requirement: "SG-TRN-04"
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#listLocalTags"
        status: pass
    human_judgment: false
  - id: D2
    description: "The marketplace tag probe lists a git marketplace's remote with its host bundle, a directory's checkout, fails a hosted catalog with no call, memoizes per URL or root, rethrows an invalid GitHub base, and picks the highest satisfying tag whatever the order"
    requirement: "SG-TRN-04"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/marketplace-tag-probe.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/marketplace-tag-probe-remote.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Install and update hand the probe the marketplace source and the command's auth context"
    requirement: "SG-TRN-04"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#D-09-05: a root range on a path-source root reaches the marketplace tag probe"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-constraint-gate.test.ts#D-SG-09: a path entry source hands the probe the marketplace source and the caller's auth context"
        status: pass
    human_judgment: false
  - id: D4
    description: "The tag copy of a git marketplace fetches the tag's commit into the copy with the host bundle before the checkout; a directory marketplace fetches nothing; a failed fetch cleans staging; real git gives a depth-1 clone's tag copy the older tagged tree"
    requirement: "SG-TRN-04"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-09"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#TAGS-01/03 (D-07-06/07) / GV-01: a pinned path-source install records the tag's commit, its semver and its oid"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#UPDT-01: a path-source pin materializes through the marketplace's own tag clone"
        status: pass
    human_judgment: false
  - id: D5
    description: "/claude:plugin install of a plugin whose constrained path dependency comes from a url marketplace installs the dependency at the marketplace release tag, held before or pushed after the add, with the ls-remote --tags pair and the tag fetch on the git host"
    requirement: "SG-TRN-04"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter|builtin features/plugin/install-dependencies.feature"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false
  - id: D6
    description: "Directory marketplaces read their tags with a local for-each-ref where upstream runs ls-remote of the directory's file:// href (03-RESEARCH A2)"
    verification: []
    human_judgment: true
    rationale: "Flagged for the maintainer by the plan: the tags are the same and the install stays off the network lane, but the parity choice is the maintainer's"

duration: 46min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 08: Marketplace release tags from the remote Summary

**A constrained path-source dependency from a github or url marketplace now reads its release tags with `ls-remote --tags` of the marketplace's wire URL, through the host's auth bundle, and its tag copy fetches the tag's commit with `fetch --depth 1 origin <oid>` before the checkout. A directory marketplace reads its own repository with one local `for-each-ref` and fetches nothing. The isomorphic-git tag readers `listTags` and `resolveTagOid` are gone, and the offline import proof is inverted to `marketplace-tag-probe-remote.test.ts`.**

## Performance

- **Duration:** about 46 min
- **Started:** 2026-11-24T06:42:55Z
- **Completed:** 2026-11-24T07:28:56Z
- **Tasks:** 3. Task 1 is a tracer, and its gate passed.
- **Files modified:** 19 (1 renamed)

## Accomplishments

- `listLocalTags({ dir })` in `platform/git.ts` runs `for-each-ref --format=%(refname:strip=2) %(objecttype) %(objectname) %(*objecttype) %(*objectname) --end-of-options refs/tags` on the local lane. A lightweight commit tag and an annotated commit tag answer from that one listing. A tag of a tag runs `rev-parse --verify --quiet --end-of-options refs/tags/<n>^{commit}`. A tree or blob tag is dropped.
- `probeMarketplaceTags` takes `marketplaceSource` and an optional `auth` context. For a `github` or `url` source it lists `networkCloneUrl(source)` with `buildCloneAuth(canonicalCloneUrl(source), kind, auth)`. For a `path` source it lists the root locally. For any other source it returns `tag-listing-failed` and calls nothing.
- `install-cascade.ts` (`resolveMemberTagSource` and the new `probeAuth`) and `update-constraint-gate.ts` (`probePathStageOne` and the new `probeAuth`) thread the marketplace record's source and the command's auth context. `update-preflight.ts` passes `marketplace.source` into the gate options.
- `materializeMarketplaceTagClone` copies `.git` (`copyGitDir`, split out of `checkoutGitDirCopy`). For a git marketplace it then runs `fetchCommit` of the tag's commit in the staging copy, and then the copy checkout. A failed fetch cleans staging and rethrows. `install-outcome.ts` passes `resolveAuth: (url, kind) => buildCloneAuth(url, kind, auth)`, and `update-preflight.ts` passes its clone probe's `cloneAuth`.
- Two scenarios prove the D-SG-09 behavior on a url marketplace. Each asserts the result rows, the installation record, and the five git host rows. No clone happens.

## Task Commits

1. **Task 1 (tracer): read marketplace release tags from the remote** - `a25290d` (feat). Tracer gate (end-of-phase mode, automated-only verify): the verify test command ran again after the commit and passed, 160/160. Typecheck, lint, and fallow passed on the committed tree before the commit, and the hook's `check:commit` passed.
2. **Task 2: fetch a marketplace tag's commit for its copy** - `2b15316` (feat)
3. **Task 3: install a dependency at a marketplace release tag** - `11f0529` (test)

**Plan metadata:** the SUMMARY commit follows. The orchestrator commits STATE and ROADMAP.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. The hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each TDD task's commit therefore holds RED and GREEN together, and no `test(03-08)` commit exists. Each RED below ran from a script that swapped the old production sources in, ran the new cases, and restored the sources.

- **Task 1 RED** (`red1.sh`: HEAD's `platform/git.ts`, `marketplace-tag-probe.ts`, `install-cascade.ts`, `update-constraint-gate.ts`, `update-preflight.ts`):
  - `marketplace-tag-probe.test.ts`: exit 1, `# tests 17 # pass 1 # fail 16`. For example, the url-marketplace case got `{ result: { kind: 'tag-listing-failed', cause: TypeError: seam.listTags is not a function }, localCalls: [], remoteCalls: [] }` against `remoteCalls: [{ url, auth }]`, and the memo case got `{ calls: 0, keys: [] }` against `{ calls: 1, keys: ['/marketplace/checkout'] }`. The one pass was the real-repository case, which guards behavior that did not change.
  - `marketplace-tag-probe-remote.test.ts`: exit 1, 1 of 2 failed. The import set was `["listTags", "resolveTagOid"]`. The D-07-05 companion passed.
  - `update-constraint-gate.test.ts`: exit 1, `# tests 28 # pass 24 # fail 4`. The new D-SG-09 threading case and the three cases on the new seam shape failed.
  - `git.test.ts` and `install-cascade.test.ts`: `SyntaxError: ... does not provide an export named 'listLocalTags'`. This is a load failure, not an assertion failure. `listLocalTags` did not exist before this plan, so no assertion can fail on the old module first.
  - Semantic assessment: the probe, architecture, and gate targets ran and failed on their planned assertions. The two load failures are recorded as such.
  - **GREEN:** 410/410 across `git.test.ts`, the probe test, the architecture test, `install-cascade`, `update-constraint-gate`, and `update-preflight`. Direct coverage of the five touched sources passed (exit 0).
- **Task 2 RED** (`red2.sh`: HEAD's `clone-cache.ts`, `install-outcome.ts`, `update-preflight.ts`):
  - `clone-cache.test.ts --test-name-pattern=D-SG-09`: `# tests 5 # pass 1 # fail 4`. The github case recorded only `checkout`, with no `fetchCommit`. The url case got `[['checkout', undefined]]`. The failed-fetch case got `Missing expected rejection.` The real-git case got `GitCommandError: git checkout -f failed: commit-missing, exit code 128`, because the old copy checks out a commit that the depth-1 clone lacks. The directory case passed, which guards behavior that did not change.
  - `install-outcome` path-pin case: `[[undefined, undefined]]` against `[['stored-credential', 'example.com']]`.
  - `update-preflight` path-pin case: failed on the `resolveAuth` bundle.
  - **GREEN:** 464/464 across the five Task 2 verify files. `test:coverage:direct` of the probe, `clone-cache`, `install-cascade`, `update-constraint-gate`, `install-outcome`, and `update-preflight` passed (exit 0).
- **Task 3 RED** (`red3.sh`: all seven production sources at PLAN_BASE `91ecbea`, where the probe reads the marketplace checkout locally): both new scenarios failed in `the result lists these plugins:`. `lib@tools` installed with `reasons: dependency current copy` and `version: 1.0.0`, where `2.0.0-{tools revision 1}` was expected (`2 scenarios (2 failed)`, 18 passed, 2 failed, 4 skipped steps). **GREEN:** both pass.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - `listLocalTags` and `ListLocalTagsOptions`. `listTags`, `resolveTagOid`, their option types, and `MAX_TAG_PEEL_HOPS` are deleted.
- `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts` - the remote, local, and hosted listings, the memo key, the GHB-03 rethrow, and a new module header (D-SG-09).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - the path arm of `MemberTagSource` carries `marketplaceSource`. `probeAuth` is shared by both probe arms.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` - `UpdateConstraintOptions.marketplaceSource`. `probeAuth` is shared by both stage-one arms.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - `marketplaceSource` goes into the gate options. `UpdateCloneProbe.cloneAuth` is the tag copy's `resolveAuth`, and `resolveUpdateCandidate` takes the probe object.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` - one auth context, shared by the clone probe and the tag copy's `resolveAuth`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` - `copyGitDir`, `gitMarketplaceSource`, the tag-commit fetch, and `resolveAuth`.
- `extensions/pi-claude-marketplace/domain/release-tag.ts` - comment only. The header named the deleted `listTags` and `resolveTagOid`.
- `test/architecture/marketplace-tag-probe-offline.test.ts` was renamed with `git mv` to `marketplace-tag-probe-remote.test.ts` and inverted. `gate-targets.ts` now has `MARKETPLACE_TAG_PROBE_TARGETS`.
- `test/platform/git.test.ts` - the `listLocalTags` cases. `taggedHistory` is now shared with `taggedRemote`. The no-git in-process case no longer reads tags.
- `test/orchestrators/plugin/{marketplace-tag-probe,install-cascade,update-constraint-gate,clone-cache,install-outcome,update-preflight}.test.ts` - the behavior rows above. The `clone-cache` tag cases that test the copy itself now use a directory source, so they never fetch.
- `features/plugin/install-dependencies.feature`, `features/step_definitions/marketplace/publishing.steps.ts` - the two scenarios and the tag-only marketplace revision step.

**Files outside the plan's `files_modified`, for the merge check:** `extensions/pi-claude-marketplace/domain/release-tag.ts` (comment only), `test/orchestrators/plugin/install-outcome.test.ts`, and `test/orchestrators/plugin/update-preflight.test.ts`. No shared test helper was touched (`test/platform/system-git-ops.ts` is unchanged).

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The caller threading moved into Task 1**
- **Found during:** Task 1
- **Issue:** The commit hook typechecks the whole tree, and `install-cascade.test.ts` and `update-constraint-gate.test.ts` built the old `{ listTags, resolveTagOid }` seam. So the probe change could not be committed without its callers and their tests. Direct coverage of the staged pairs also needed the new threading branches tested.
- **Fix:** Task 1 threads `marketplaceSource` and the auth context through `install-cascade.ts`, `update-constraint-gate.ts`, and `update-preflight.ts`, with their test rows. Task 2 keeps the tag copy fetch and the auth for the tag copy.
- **Commit:** `a25290d`

**2. [Plan wording] `resolveAuth` instead of an `auth` argument**
- **Issue:** The plan names "an optional `auth` argument" for `materializeMarketplaceTagClone`.
- **Fix:** The copy takes `resolveAuth?: (cloneUrl, kind) => GitAuthBundle`, as `materializePluginClone` takes `resolveAuth`. The bundle is built only on a cold key of a git marketplace, so a warm copy or a directory marketplace reads no GitHub base variable and builds nothing.
- **Commit:** `2b15316`

**3. [Rule 2 - Security] Existing tag-copy unit cases would have fetched from github.com**
- **Found during:** Task 2
- **Issue:** Eight `clone-cache.test.ts` cases call the real tag copy with `marketplaceSource: "https://github.com/owner/repo"`. With the new fetch, they would run `fetch origin` against the real host.
- **Fix:** Those cases now pass the checkout root as a directory source. The clone key is unchanged, because the key reads the same origin. New cases cover the git arm with a recording `GitOps`, and with real git against a `file://` upstream.
- **Verification:** A logging `git`, first on PATH, ran `test/orchestrators/**`, `test/edge/**`, and `test/index.test.ts` (8,266 tests, all passed). The only github.com rows were the known Orchestrated-PI-4 clone, which carries the `insteadOf` pair to `https://127.0.0.1:9`. Every fetch went to a `file://` origin.
- **Commit:** `2b15316`

**4. [Scope] The step reuses the git-repository step's pattern but not its helper**
- **Issue:** `pushTagOnlyRevision` (`features/lib/git-plugin.ts`) writes a plugin-repository layout. A marketplace needs `writeMarketplace`'s layout.
- **Fix:** `pushTagOnlyMarketplaceRevision` is a local function in `publishing.steps.ts`. It runs the same git sequence: branch from `main`, commit, tag, push the tag alone, delete the branch. It writes through `writeMarketplace`. It records the revision in the world's git repositories under the marketplace name (`plugins: []`), so `{tools revision 1}` names the version recorded at the tag. No foundation file (`features/lib/**`, `features/support/**`) changed.
- **Commit:** `11f0529`

---

**Total deviations:** 4 (1 blocking, 1 security, 2 wording or scope). **Impact:** no scope creep. The security fix kept the unit suite off the network.

## Issues Encountered

- The session refuses Bash text that names git paths in complex forms. Edits, RED runs, audits, and commits ran from scripts in `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/exec-03-08/`.
- The new worktree had no optional test peers. `node scripts/install-test-peers.mjs`, which the plan's own `npm run test:cucumber:profile` runs, installed the declared versions: pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, and pi-dynamic-workflows 3.15.0.
- Wider feature check, beyond the plan's verify: `features/plugin` and `features/marketplace` passed 1,311/1,311 under adapter and 39/39 under builtin. `features/mcp-server/verdict-markers.feature`, which mixes url marketplaces with constrained dependencies, passed 13/13 under adapter and 12/12 under builtin. No existing request table changed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-03-25: only the constrained path-source arm of install and update calls the remote listing (`probeMarketplaceTags` from `install-cascade` and `update-constraint-gate`) or the tag fetch (`materializeMarketplaceTagClone`). `list`, `info`, and the load reach neither. The module suites and the BLOCK F lint stay green.
- T-03-26: tags pass the existing `<name>--v<semver>` parse and range selection. The copy fetches and checks out only the chosen commit.
- T-03-SC: nothing was installed beyond the project's own declared test peers.

## Orchestrator actions

None. The plan asks for no `windows append`.

## Lines for later plans

- **`NETWORK_SEAMS` reason for 03-12** (`eslint.config.js`, line 89 still reads "TAGS-01: reads the marketplace clone's local tags with listTags and resolveTagOid."):
  `// D-SG-09: lists a git marketplace's release tags from its remote with ls-remote --tags (listRemoteTags); a directory marketplace's are read locally.`
- **NFR-5 sentence for 03-17** to check against AGENTS.md and PROJECT.md. The current text covers the tag read only:
  > Resolving a path-source dependency that carries a version constraint, on install or update, may read the tag list of the marketplace's own remote repository over the network with `git ls-remote --tags`, as Claude Code does, because a shallow marketplace clone holds no tags. If that read fails, the install uses the marketplace's current copy (D-SG-09).

  The tag copy now also fetches the chosen tag's commit from that remote, so the sentence should add: "When a tag is chosen, its copy fetches that one commit from the same remote with `git fetch --depth 1` (D-SG-09)." A directory marketplace reads its tags locally (`for-each-ref`) and fetches nothing.
- **Command shapes and rows:**
  - Remote listing: `ls-remote --tags --end-of-options <wire url>`, operation `ls-remote --tags`, rows GET, POST.
  - Tag fetch: `config --local` (the origin read), then `fetch --depth 1 --end-of-options origin <oid>`, rows GET, POST, POST. A failed first rung in the shallow copy falls to `fetch --unshallow origin` (`fetchCommit`'s ladder).
  - The copy checkout: three `config --local --unset-all` key drops, then `checkout -f`.
  - Local listing: `for-each-ref --format=... --end-of-options refs/tags`, then `rev-parse --verify --quiet` only for a tag of a tag.
- **Stale comment, not in this plan's files:** `test/orchestrators/plugin/update-flow.test.ts:9525` still says "a local `listTags` call count". The `materializeMarketplaceTagClone` header in `clone-cache.ts` still cites the isomorphic-git index behavior from D-07-04. That rationale is historical.
- **Flagged for the maintainer (03-RESEARCH A2):** a directory marketplace reads its tags with a local `for-each-ref`, where upstream runs `ls-remote` of the directory's `file://` href. The tags are the same, and the install stays off the network lane.
- **Helpers:** the step `the marketplace {string} has a revision only the tag {string} reaches, offering these plugins:` (url or github publications only) records its revisions as `{<marketplace> revision <n>}` and `{<marketplace> commit <n>}`. `features.md` describes revision tokens for git plugin repositories, so a foundation edit may want to name marketplace repositories there too.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 03-09 and 03-12 can delete the D-14 wrappers. Nothing in this plan uses the in-process transport.
- 03-12 rewrites the `NETWORK_SEAMS` reason for the probe (text above).

## Self-Check: PASSED

- FOUND: test/architecture/marketplace-tag-probe-remote.test.ts, orchestrators/plugin/marketplace-tag-probe.ts, platform/git.ts, this SUMMARY
- FOUND: a25290d, 2b15316, 11f0529 (each an ancestor of HEAD; `git rev-list --count 91ecbea..HEAD` = 3 before this SUMMARY commit)
- Acceptance greps: the remote test exists and the offline test is gone. `listTags\|resolveTagOid` in `platform/git.ts` = 0. `MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS` = 0. `fetchCommit` in `clone-cache.ts` = 3. `pushed after` in the feature = 1.
- Verify commands:
  - Task 1: unit tests 160/160; `typecheck`, `lint`, and `fallow` exit 0.
  - Task 2: unit tests 464/464; `test:coverage:direct` of the four named sources and of `install-outcome.ts` and `update-preflight.ts` exit 0.
  - Task 3: `install-dependencies.feature` passed 61/61 under adapter and 1/1 under builtin; `check:features` exit 0.
- Every commit passed its hook (`npm run check:commit` included).

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*
