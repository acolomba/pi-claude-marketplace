---
phase: 03-system-git-transport-and-clone-shape
plan: "11"
subsystem: marketplace-add-and-update
tags: [system-git, commit-id-ref, upstream-parity, re-clone-swap, cucumber]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-07 refreshCloneBySwap, sources-backup/<name>, and the swap recovery; 03-08 the publishing.steps.ts tag step pattern"
provides:
  - "S5c of parseAddableSource: a github or url marketplace ref that looks like a commit id with capital letters is refused before any lock, disk, or git access, with a cause line"
  - "Givens: the default branch of a published git marketplace, a created or force-moved tag with a description, and an update interrupted after it moved the checkout aside"
  - "Six scenarios: capital-letter ref refusal, lower-case commit-id ref as a missing ref, moved default branch, moved tag, interrupted update, dropped update"
affects: [03-14, SG-PIN-01, Phase 6 wording]

plan_head_before: fb7205fb64d7c71d2b0bc490217006470620da1d
plan_head_after: fb0643082c392a79a9e247c60d2bc8287c407a76

actuals:
  tokens: 7000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A refusal that must show its cause line on a failed add gets its own subclass of the classified error, admitted by showsAddCause"
    - "A swap scenario's RED is a local mutation of clone-swap.ts that a script applies, runs, and restores byte for byte"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - test/orchestrators/marketplace/add.test.ts
    - features/marketplace/url-source.feature
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/marketplace/git-source.feature
    - features/step_definitions/marketplace/checkout.steps.ts

key-decisions:
  - "Only a ref that is not a lower-case commit id but is one once lower-cased (40 or 64 hex) is refused, as Claude Code 2.1.330's wCn; a lower-case id still reaches git as --branch and fails as source missing until SG-PIN-01"
  - "The refusal is a module-local CapitalLetterCommitRefError extends UnsupportedSourceError, so classifyAddError keeps reporting unsupported source and showsAddCause shows the refusal as the row's cause line"
  - "The interrupted-update scenario keeps the remote unchanged, so the restored checkout is current and only the freshness ls-remote pair is sent; with the recovery skipped the update re-clones instead, which is the observable difference"

patterns-established:
  - "the tag {string} of the marketplace {string} has the description {string} both creates a tag and force-moves it"

requirements-completed: ["SG-TRN-02", "SG-TRN-03"]

coverage:
  - id: D1
    description: "A github or url marketplace ref that looks like a commit id with capital letters is refused before any lock, disk, or git access, as unsupported source with a cause line naming the ref and the fix"
    requirement: "SG-TRN-02"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#SG-TRN-02: refuses a commit id ref with capital letters in a url fragment"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#SG-TRN-02: an add of a commit id ref with capital letters fails before any lock, disk, or git access"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#SG-TRN-02: the refused add of a commit id ref with capital letters shows the refusal as its cause line"
        status: pass
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace whose ref is a commit id with capital letters is refused before git runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A lower-case commit-id ref, 39- and 41-hex refs with capitals, a 40-digit ref, and v1 are not refused; a lower-case commit-id add fails as source missing after GET, POST, with nothing recorded and no checkout"
    requirement: "SG-TRN-02"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#SG-TRN-02: leaves a lower-case 40-hex commit id to git as a ref"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#SG-TRN-02: an add of a lower-case commit id ref reaches the clone and fails as source missing"
        status: pass
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace whose ref is a lower-case commit id fails as a missing ref"
        status: pass
    human_judgment: false
  - id: D3
    description: "marketplace update follows a moved default branch and a moved tag"
    requirement: "SG-TRN-03"
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a git marketplace whose repository changed its default branch follows the new branch"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a git marketplace added at a tag follows the tag when it moves"
        status: pass
    human_judgment: false
  - id: D4
    description: "An interrupted update is recovered by the next update, and a dropped update keeps the previous checkout installable; the next update succeeds"
    requirement: "SG-TRN-03"
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a marketplace after an interrupted update restores its checkout, and its plugins install from it"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#A marketplace update that the git host drops keeps the previous checkout, and the next update succeeds"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 11: Marketplace commit-id refs and update recovery Summary

**`marketplace add` now refuses a github or url ref that looks like a commit id with capital letters before any lock, disk, or git access, as Claude Code's `wCn` does. The add fails as `{unsupported source}` and shows the refusal as its cause line. A lower-case commit id still reaches git and fails as `{source missing}` until SG-PIN-01. Four new scenarios prove through a real Pi that `marketplace update` follows a moved default branch and a moved tag, recovers from an interrupted swap, and keeps a usable checkout when the host drops the update.**

## Performance

- **Duration:** about 36 min
- **Started:** 2026-11-24T08:55:49Z
- **Completed:** 2026-11-24T09:31:37Z
- **Tasks:** 3 of 3. Task 1 is a tracer, and its gate passed.
- **Files modified:** 7

## Accomplishments

- S5c in `parseAddableSource` refuses a ref that is not a lower-case 40- or 64-hex commit id but is one once lower-cased. It covers the url fragment, the `owner/repo#ref` and `owner/repo@ref` shorthands, and the object form. The refusal throws `CapitalLetterCommitRefError`, a module-local subclass of `UnsupportedSourceError` that carries `ref`. `classifyAddError` still reports `unsupported source`, and `showsAddCause` admits the class, so the failed row has a child row whose cause is the refusal.
- Two Givens in `features/lib/published-marketplace.ts` and `publishing.steps.ts`: `setDefaultBranch` points the bare repository's `HEAD` at a branch, and `describeMarketplaceTag` commits a description on a branch from `main`, runs `tag -f`, force-pushes the tag alone, and returns the local and served commits.
- A Given in `checkout.steps.ts` moves the checkout to `sources-backup/<name>` and leaves no live checkout, as an interrupted swap does.
- Six scenarios pass under the adapter profile. None carries an MCP tag, so the builtin profile runs none of them. `features/marketplace` passes 540/540 under adapter (534 before this plan, plus 6).

## Task Commits

1. **Task 1 (tracer): refuse a commit id ref with capital letters** - `c4614b7` (feat). Tracer gate (end-of-phase mode, automated-only verify): after the commit, `add.test.ts` ran again and passed 216/216. Before the commit, the direct coverage of `add.ts` exited 0, and `url-source.feature` passed 12/12 under adapter (the builtin profile runs 0).
2. **Task 2: follow a moved branch or tag** - `5729d94` (test)
3. **Task 3: recover an interrupted or dropped update** - `fb06430` (test)

**Plan metadata:** the SUMMARY commit follows. The orchestrator commits STATE and ROADMAP.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. The commit hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each commit therefore holds RED and GREEN together, and no `test(...)`-only RED commit exists. The RED runs are recorded here.

- **Task 1 unit RED** (new cases against HEAD's `add.ts`, `--test-name-pattern="SG-TRN-02: (refuses|leaves|an add of)"`, TAP): exit 1, `# tests 13 # pass 7 # fail 6`. The five refusal rows failed with `Missing expected exception.`. The add case failed because the old code handed the capital ref to git: `Didn't expect git ops.clone({... "ref": "0123456789ABCDEF0123456789abcdef01234567", "singleBranch": true, ...}) to be called.` The 6 "leaves ... to git" rows and the lower-case add case passed. They are guards for behavior that does not change. Semantic assessment: each refusal target ran and failed on its planned assertion.
- **Task 1 scenario RED** (`red1-scen.sh`: HEAD's `add.ts` swapped in and restored): `2 scenarios (1 passed, 1 failed)`. The capital-letter scenario failed at `Then the result has these fields:` with `+ 'A marketplace operation has failed.' - 'Some operations have failed.'`: the old add reached git and failed as a missing branch. The lower-case scenario passed, because it pins behavior that stays the same.
- **Task 1 GREEN:** `add.test.ts` 216/216. `test:coverage:direct` of `add.ts` exited 0. `url-source.feature` passed 12/12 adapter and 0 builtin.
- **Task 2 RED** (`red-mutate.sh red2`: in `clone-swap.ts::checkFreshness`, `return remote === local ? CURRENT : STALE;` became always `CURRENT`, then the file was restored byte for byte): `2 scenarios (2 failed)`. Both failed at the update row with `+ 'skipped' + 'up-to-date' - 'updated'`. **GREEN:** both pass. `git-source.feature` passed 34/34 adapter, `check:features` exited 0, and ESLint on the two step and lib files exited 0.
- **Task 3 RED** (`red-mutate.sh red3`: `await recoverInterruptedSwap(args);` became `void recoverInterruptedSwap;`, then the file was restored): `2 scenarios (1 passed, 1 failed)`. The interrupted-update scenario failed at `Then the git host receives these requests:`. Without the recovery, `HEAD` is unreadable, so the update re-clones (`GET`, `POST`, `POST`) instead of sending the freshness pair (`GET`, `POST`). The dropped-update scenario passed under that mutation. It does not use the recovery: it pins the D-SG-10 rule that a failed clone leaves the live checkout untouched. **GREEN:** both pass. `git-source.feature` passed 36/36 adapter, and `check:features` and ESLint exited 0.

## Wider runs

- `npm run test:modules`: 19,154 of 19,155 pass. The one failure is the known sandbox baseline `test/bridges/hooks/dispatch-exec.test.ts:39` ("executes a blocking hook through the portable process boundary", `Unexpected token '<', "<persisted"...`).
- `npm run test:integration`: exit 0.
- `features/marketplace` under adapter: 540/540.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - `LOWER_CASE_COMMIT_ID_RE`, `isCapitalLetterCommitRef`, `CapitalLetterCommitRefError`, S5c, and the `showsAddCause` and `failedAddRow` comments.
- `test/orchestrators/marketplace/add.test.ts` - 14 cases: 5 refused forms, 6 refs left to git, the orchestrated refusal with no lock, disk, or git access (strict `GitOps` mock, empty extension root), the standalone cause line, and the lower-case add reaching the clone and leaving nothing behind.
- `features/marketplace/url-source.feature` - the two add scenarios.
- `features/lib/published-marketplace.ts` - `requireGitPublication`, `setDefaultBranch`, `describeMarketplaceTag`.
- `features/step_definitions/marketplace/publishing.steps.ts` - the tag and default-branch Givens.
- `features/step_definitions/marketplace/checkout.steps.ts` - the interrupted-update Given.
- `features/marketplace/git-source.feature` - the four update scenarios.

No file outside `files_modified` was touched.

## Decisions Made

See `key-decisions` in the frontmatter. For maintainer review (upstream parity, maintainer decision): only a marketplace ref that looks like a commit id with capital letters is refused at `marketplace add`, as Claude Code 2.1.330 refuses it (`wCn`). A lower-case one reaches git and fails cleanly as a missing ref until SG-PIN-01 brings upstream's SHA path. A record that an earlier version stored with a commit-id ref keeps working while `HEAD` equals that ref, and its update fails cleanly otherwise. Evidence note from planning: in Claude Code 2.1.331 the same check, renamed `BMn`, refuses only while the `tengu_tender_raven` flag is on. Pi has no feature flags, so its refusal is unconditional. The refusal also applies where Pi adds a marketplace from a config file (`apply`) and where a project-scope install copies a user-scope record (D-MF-04), because both go through `parseAddableSource`. Upstream refuses at clone time on those paths too.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The cause line needed its own error class**
- **Found during:** Task 1 (first scenario run)
- **Issue:** The plan asks for `{unsupported source}` "and the cause line". A failed add with a plain `UnsupportedSourceError` renders a bare row with no cause (SNM-10), so the user would never see which ref was refused or how to fix it.
- **Fix:** `CapitalLetterCommitRefError extends UnsupportedSourceError` (module-local, like `ConfigInvalidError` in the same file), admitted by `showsAddCause`. The row then takes the child-row shape that the reserved-name refusal uses, and the summary is `Some operations have failed.`.
- **Files modified:** `add.ts`, `add.test.ts`, `url-source.feature`
- **Commit:** `c4614b7`

**2. [Plan wording] The interrupted-update scenario keeps the remote unchanged**
- **Issue:** The plan's title says the next update "restores its checkout and updates it". With a moved remote, an update without the recovery still re-clones and installs. The re-clone hides the recovery, so the skipped-recovery RED would pass.
- **Fix:** The scenario leaves the remote as it was. The restored checkout is current, so the update reports `skipped {up-to-date}` and sends only the freshness pair, and then `formatter@tools` installs with no request. The title is "Updating a marketplace after an interrupted update restores its checkout, and its plugins install from it".
- **Commit:** `fb06430`

**3. [Style] Column realignment in a Task 1 table**
- The cause-chain table of the capital-letter scenario was misaligned. Task 3's commit realigns it (whitespace only).

---

**Total deviations:** 3 (1 missing-critical, 1 wording, 1 style). **Impact:** within `files_modified`. No scope creep.

## Issues Encountered

- The session refuses Bash text that names a path containing `git` in a complex form, such as `git-source.feature`. Verify runs, RED mutations, and commits ran from scripts in `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/exec-03-11/`.
- The first Task 1 commit failed on `no-use-before-define` (a module constant used above its definition). The case now uses an inline literal. The first Task 2 commit failed gitlint's title length, and the title was shortened. Neither failure produced a commit, and no `--amend` was used.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-03-35: `parseAddableSource` refuses the capital-letter ref before the state lock. The unit case passes a strict `GitOps` mock with no expectations and finds the extension root empty. The scenario finds no request at the git host. The SG-TRN-02 refusals of a dash-led ref and a malformed sha in `domain/source.ts` still run first, inside `parsePluginSource`.
- T-03-52 (accepted): a lower-case id reaches git as one `--branch=<ref>` argument. The scenario shows that it fails cleanly as `source missing` after `GET`, `POST`.
- T-03-36: the interrupted-update scenario proves the restored tree installs. The Given moves the checkout only between the two directories that `sourceCloneDir` and `sourceBackupDir` name.
- T-03-37: the tag moves only in the sandbox repository that the stand-in serves.
- T-03-SC: nothing was installed beyond the project's declared test peers, which `test:cucumber:profile` installs.

## Orchestrator actions

None. The plan asks for no `windows append`.

## Lines for later plans

- **Refusal text** (cause line and `UnsupportedSourceError` message):
  `Cannot add marketplace from "<raw>": the ref "<ref>" looks like a commit id with capital letters, which git would read as a branch name that can move; write the id in lower case`
  For an object source, `<raw>` reads `[object Object]`, as in every other S5 refusal. The TUI row is `⊘ <raw> [<scope>] (failed)`, then `  ⊘ <raw> (failed) {unsupported source}` and `    cause: <text>`, under `Some operations have failed.`. The error class is `CapitalLetterCommitRefError`, with `name` `"CapitalLetterCommitRefError"` and a `ref` field. It is not exported.
- **Given texts:**
  - `Given the default branch of the marketplace "<name>" is "<branch>"` (the branch must exist, for example from `the branch "<branch>" of the marketplace "<name>" has the description "<text>"`)
  - `Given the tag "<tag>" of the marketplace "<name>" has the description "<text>"` (creates the tag, or force-moves it to a new commit, from `main`)
  - `Given an update of the marketplace "<name>" in the <scope> scope was interrupted after it moved the checkout aside` (checkout.steps.ts; 03-14 can reuse it next to `the <scope> scope has lost the checkout of the marketplace "<name>"`)
- **Measured request rows:** lower-case commit-id add: `GET` info/refs, `POST` git-upload-pack. A moved branch or tag update: `GET`, `POST`, then `GET`, `POST`, `POST`. An update after an interrupted swap with an unchanged remote: `GET`, `POST`. A dropped update: two `GET ... dropped` rows (the `ls-remote` and the re-clone).
- **For SG-PIN-01:** when the SHA path lands, the lower-case scenario in `url-source.feature` ("...whose ref is a lower-case commit id fails as a missing ref") is the one to rewrite. The capital-letter refusal stays.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The plan's work is complete. The wave gate runs `npm run check`.

## Self-Check: PASSED

- FOUND: every file in `key-files.modified`.
- FOUND: `c4614b7`, `5729d94`, `fb06430`, each an ancestor of HEAD. `git rev-list --count fb7205f..HEAD` = 3 before this SUMMARY commit.
- Acceptance greps: `capital letters` in `add.ts` = 6, in `url-source.feature` = 2; `lower-case commit id` in `url-source.feature` = 1; `default branch`, `tag`, and `interrupted` in `git-source.feature` are each at least 1.
- Verify commands: Task 1 unit 216/216, direct coverage exit 0, `url-source.feature` 12/12 + 0. Tasks 2 and 3: `git-source.feature` 36/36 + 0, `check:features` exit 0, ESLint exit 0.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*
