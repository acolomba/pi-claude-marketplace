---
phase: 05-credential-surface
plan: 13
subsystem: credentials
tags: [system-git, credentials, device-flow, records, docs]

requires:
  - phase: 05-credential-surface
    provides: "05-01 to 05-12 removed the Device Flow, its threading, modules, gates, scenarios, and harness names, and left the records and user docs for this plan"
provides:
  - "PROJECT.md rows D-SG-27, D-SG-28, D-SG-29 with the answers to research OQ1 to OQ5"
  - "Dated D-SG-27 amendments on 19 decision rows, NFR-5, and the current-milestone text"
  - "A codebase map with no credential module, 16 network seams, one fetch caller, and 53 measured fallow-ignore markers"
  - "README.md `### Git authentication` and README.es.md `### Autenticación de Git`, and the CHANGELOG `[Unreleased]` entry"
affects: [system-git milestone audit, PR description, changelog PR number]

actuals:
  tokens: 57000
  tasks: 3
  commits: 4
plan_head_before: 4c6c70e0a825758f98d7fee266355541de4ecf8a
plan_head_after: e177c75e4e70812be6d350d267febce43b8dfeaa

tech-stack:
  added: []
  patterns:
    - "An amendment to a padded PROJECT.md table row goes into the Decision cell and takes its length from that cell's trailing padding, so the row keeps its width"

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - .planning/codebase/STACK.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/TESTING.md
    - .planning/codebase/CONCERNS.md
    - README.md
    - README.es.md
    - CHANGELOG.md
    - docs/competitive-analysis/pi-plugins.md
    - eslint.config.js

key-decisions:
  - "D-SG-27 records OQ1 accepted, OQ2 taken, OQ3 as applied in 05-10 (auth-host left NETWORK_SEAMS), OQ4 as the maintainer's call outside the repository, and OQ5 (schemaVersion stays 1)"
  - "D-SG-05 also gets a D-SG-27 pointer, because its outcome named `git credential` as a command the extension runs"
  - "The CHANGELOG entry has no PR number: no [Unreleased] entry exists for this branch's pull request yet"
  - "The README removal commands name protocol, host, and the old sign-in's username (`x-access-token`, `oauth2`), so a helper drops only that entry"

patterns-established:
  - "Lines that state removed behavior as current get a short `(removed by D-SG-27, 2026-11-27)` pointer; shipped-release lists stay as history"

requirements-completed: [SG-AUTH-01, SG-AUTH-02, SG-AUTH-03]

coverage:
  - id: D1
    description: "PROJECT.md has D-SG-27, D-SG-28, D-SG-29 after D-SG-26, and every row the phase changed carries a dated D-SG-27 pointer; NFR-5 names D-SG-27"
    requirement: SG-AUTH-02
    verification:
      - kind: other
        ref: "Task 1 automated verify (both loops: 0 missing) and acceptance greps (NFR-5 count 1, 'Device Flow is decided' count 0), re-run on the committed tree"
        status: pass
    human_judgment: false
  - id: D2
    description: "The codebase map names only modules, seams, and doubles that exist, with measured counts"
    verification:
      - kind: other
        ref: "Task 2 automated verify: 0 files with the removed names; stated 53 markers == measured 53; 'the 19 files in' 0; 'git credential. included' 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md and README.es.md explain git authentication, the old token, its manual removal, and the GitLab expiry in the same words; CHANGELOG has the Unreleased entry"
    requirement: SG-AUTH-03
    verification:
      - kind: other
        ref: "Task 3 acceptance greps (all 13 pass); pre-commit run --files on the four files (mdformat, markdownlint passed, no fixer change); no version file changed since PLAN_BASE"
        status: pass
    human_judgment: true
    rationale: "Plain-English quality and the fidelity of the Spanish translation are reading judgments that no test checks"
  - id: D4
    description: "The GHB-02 ESLint message no longer names a sign-in endpoint"
    verification:
      - kind: other
        ref: "commit hook npm run check:commit passed on e177c75"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 13: Records, codebase map, and user docs for the Device Flow removal Summary

**PROJECT.md records D-SG-27 (Device Flow removed, with the OQ1 to OQ5 answers), D-SG-28 (no runtime notice, old tokens keep working), and D-SG-29 (GitLab expiry documented only), with dated pointers on every changed rule. The codebase map matches the tree. Both READMEs gain a Git authentication section with manual removal commands, and CHANGELOG gains the Unreleased entry.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-11-27T23:00:55Z
- **Completed:** 2026-11-27T23:16:50Z
- **Tasks:** 3 (4 commits: one per task, plus the orchestrator's extra ESLint item)
- **Files modified:** 13

PLAN_BASE: `4c6c70e0a825758f98d7fee266355541de4ecf8a` (the worktree base). No task used TASK_BASE.

## Accomplishments

- Task 1 (`c3a9327`): rows D-SG-27, D-SG-28, and D-SG-29 follow D-SG-26 in the D-SG format. D-SG-27 lists what Phase 5 deleted and records the answers. OQ1: accepted, so github.com and gitlab.com without the override get the stored-credential failure and the D-1-02 hint. OQ2: taken, so the `credential` subcommand and `GitRequest.input` are gone. OQ3: auth-host keeps the host binding and the hint and left `NETWORK_SEAMS` (05-10). OQ4: the OAuth App and the GitLab application stay registered, and retiring them is the maintainer's call. OQ5: `schemaVersion` stays 1 without `device-flow-prompt`. The row also says it supersedes D-SG-14, retires D-79-04 and D-79-05 (their archives are not edited), and keeps the redirect and the CONNECT proxy under `features/lib/github-redirect/`.
- Task 1 amendments, each ending "Amended 2026-11-27 by D-SG-27: ...". In the padded table, the amendment goes into the Decision cell and uses up that cell's padding, so each row keeps its width of 7723 characters: D-PL8-12, AAP-D1, D-PL5-07, D-PL9-11, D-1-01, D-UTR-05, D-MF-01, and D-79-03 amended. In the unpadded tables, the amendment is appended to the Decision cell for D-BG-01, D-BG-02, D-BG-03, and D-BG-1101 to D-BG-1106, and to the outcome cell for D-SG-14 (superseded) and D-SG-05. The D-BG-1104, 1105, and 1106 texts follow the 05-01 and 05-06 SUMMARYs. The cache-miss scenario and the first seed went with `device-flow.feature`. The cache-hit scenario moved to `features/plugin/credentials.feature`. Both background scenarios and the terminal routing seed moved to `features/marketplace/credentials.feature`.
- Task 1 NFR-5: the background-pass clause now reads "and git runs non-interactively with what the machine holds (D-PL8-01, D-PL8-12, D-SG-27)", and the "amended by" list ends "by D-SG-18 and D-SG-20, and by D-SG-27". In the current milestone, the "decided in discuss" sentence and the two open-question items now state the answers. The pointer `(removed by D-SG-27, 2026-11-27)` went on the any-git-host target feature, AUTH-D02, the GAUTH validated item (worded "the registry and the Device Flow it gated were removed by D-SG-27, 2026-11-27"), the url-source "Auth side (Phase 79)" clause, the v1.6 on-demand Device Flow item, and the out-of-scope note on per-host descriptors. The shipped-release lists (lines near 237, 538, 1059, 1300, 1713) stay as history.
- Task 2 (`a229f87`), measured counts: 16 `NETWORK_SEAMS` (eslint.config.js), one `fetch` exemption (`platform/hosted-manifest-fetch.ts`), one `GIT_PROCESS_IMPORTERS` entry (`platform/git.ts`), five `child-process-chokepoint` sites, and 53 `fallow-ignore` markers. The markers break down as 6 unused-file, 16 unused-export, 5 private-type-leak, 1 unused-type, and 25 code-duplication. The credential contract case is gone, and the harness default export is `features/lib/github-redirect/extension`. ARCHITECTURE.md's Platform row, domain purpose and contents, platform contents and users, autoapply load step, network boundary, rule-pack bullet, and Authentication paragraph now describe the tree. The Authentication paragraph covers `authBundleFor`, the user's own helpers in the neutral directory with D-SG-05's environment, GAUTH-04's `StoredCredentialRejectedError`, and `authentication required` with the D-1-02 hint. CONVENTIONS.md's naming examples use existing names (`resolveStrict`, `createGitOps`, `createHostedManifestFetch`, `createGitOpsFake`, `createRemovalOpsFake`, `GitAuthBundle`, `GitOps`, `RemovalOpsFake`, `GITHUB_HOST`). INTEGRATIONS.md describes user-owned authentication and the remaining outbound HTTP. STRUCTURE.md and TESTING.md drop the deleted modules and fake rows, and TESTING.md's code sample is now the abridged git ops fake. The CONCERNS.md entry about the domain's `fetch` is deleted.
- Task 3 (`c5fa112`): README.md adds `### Git authentication` (with `#### Tokens from an earlier release`) at the end of Prerequisites. README.es.md adds the same section in Spanish, `### Autenticación de Git` (with `#### Tokens de una versión anterior`). Its links use the GitHub anchor `#autenticaci%C3%B3n-de-git`, the same percent-encoded style as the existing `#aplicaci%C3%B3n-autom%C3%A1tica` link. The code blocks are identical in both files. The Autoapply sentence and the NOTE under `marketplace add upstash/context7` point to the new section. `docs/competitive-analysis/pi-plugins.md` describes the current credential model. Nothing tells the user to put a token in an environment variable, a URL, or a file.
- Extra item (`e177c75`): the GHB-02 `no-github-literal` message in `eslint.config.js` no longer lists "a Device Flow endpoint". No source carries such a disable: the eight disables name parser host comparisons, reason text, and display strings.

### CHANGELOG entry (text as committed)

```markdown
- Private repositories now authenticate only through your machine's own git setup, as in Claude Code, and the GitHub and GitLab sign-in prompt is gone.

  - To set up HTTPS authentication, run `gh auth login`, then `gh auth setup-git`, or install Git Credential Manager. For GitLab, run `glab auth setup-git`.
  - A token that the old sign-in stored keeps working, and the extension never deletes it. To remove it, run `printf 'protocol=https\nhost=github.com\nusername=x-access-token\n\n' | git credential reject`.
  - A GitLab token from the old sign-in expires after about two hours. Set up `glab auth setup-git`, Git Credential Manager, or an ssh key before then.
  - JSON and RPC output no longer has the `device-flow-prompt` kind, and `schemaVersion` stays 1.
```

PR-number follow-up: `[Unreleased]` had no entry for this branch's pull request, so the top line has no `(#N)`. The PR step adds the number to the top line, and it merges the milestone's other changes (system git, SSH transport, failure messages) into the same entry as sub-bullets.

## Task Commits

1. **Task 1: The decision record states the Phase 5 outcome and every rule it changed** - `c3a9327` (docs)
2. **Task 2: The codebase map describes the code without the credential surface** - `a229f87` (docs)
3. **Task 3: Users learn how to authenticate git now and what happens to an old sign-in token** - `c5fa112` (docs)
4. **Extra (orchestrator): GHB-02 message drops the sign-in endpoint** - `e177c75` (chore)

Tracer gate (Task 1): the run is interactive with `end-of-phase` and the verify is automated-only, so the verify re-ran on the committed tree, passed (TRACER-VERIFY-PASS), and Task 2 followed. No task is a TDD task.

## Files Created/Modified

- `.planning/PROJECT.md`: three new rows, 19 amended rows (the plan's 18 plus D-SG-05), NFR-5, current milestone, six pointer lines
- `.planning/codebase/{STACK,ARCHITECTURE,CONVENTIONS,INTEGRATIONS,STRUCTURE,TESTING,CONCERNS}.md`: as above
- `README.md`, `README.es.md`: the Git authentication section, the Autoapply sentence, the private-repository NOTE
- `CHANGELOG.md`: the Unreleased entry
- `docs/competitive-analysis/pi-plugins.md`: the credential sentence of the security-surface paragraph
- `eslint.config.js`: one message string

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing record] D-SG-05 also carried stale credential text**
- **Found during:** Task 1
- **Issue:** D-SG-05's outcome says a command without a working directory, "`git credential` included", runs in the neutral directory. That command no longer exists (OQ2).
- **Fix:** Appended "Amended 2026-11-27 by D-SG-27: the `git credential` command is gone (OQ2), so no git command the extension starts reads stdin."
- **Committed in:** `c3a9327`

**2. [Rule 1 - Stale wording] Map lines that the plan's grep did not name**
- **Found during:** Task 2
- **Issue:** CONVENTIONS.md named `findProviderForHost`, `GitAuthProvider`, `MockCredentialState`, and `GITHUB_PROVIDER`, which no longer exist. TESTING.md named `credentialOps` and `credential-process-fake.ts`. INTEGRATIONS.md said `git credential` runs on its own.
- **Fix:** Replaced each with a name that exists, or deleted it, in the Task 2 commit.
- **Committed in:** `a229f87`

**3. [Orchestrator item] GHB-02 ESLint message**
- **Found during:** assigned in the dispatch prompt (from the 05-12 SUMMARY deferred list)
- **Fix:** Dropped the ", or a Device Flow endpoint" clause in its own commit. The hook's `npm run check:commit` passed.
- **Committed in:** `e177c75`

---

**Total deviations:** 2 auto-fixed (1 missing record, 1 stale wording), plus 1 orchestrator-assigned item
**Impact on plan:** Records and docs only, apart from one lint message string. No behavior change and no version change.

## Issues Encountered

- The harness refuses inline commands that name paths or patterns containing `git`, or that chain several commands. Edits, verifies, and commits ran from scripts in `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/exec-05-13/`. Commits ran with hooks under a scrubbed environment (`setpriv ... git commit -F`). None used `--no-verify`.
- The optional-peer cache was not needed: this plan runs no cucumber scenario, and `check:commit` passed without it.

## Not changed (outside this plan)

- `docs/competitive-analysis/pi-plugins.md:612` still calls `isomorphic-git` "our choice". That line was stale since D-SG-01, before this phase, and no plan in this phase owns it.
- The `[Unreleased]` line of an earlier PR ("behavioral tests now cover ... Device Flow sign-in") is history of that PR, so it stays.
- AGENTS.md is unchanged, by the plan's rule: its NFR-5 copy names no Device Flow. Its "with stored credentials only" clause now differs in wording from PROJECT.md's restated NFR-5. If the maintainer wants the two texts identical, that is a separate edit for them.

## Verification

- Task 1: both automated verifies exit 0, NFR-5 count 1, "Device Flow is decided" count 0.
- Task 2: 0 map files with the removed names, stated 53 == measured 53 markers, "the 19 files in" 0, "git credential. included" 0.
- Task 3: all 13 acceptance greps pass. `pre-commit run --files` on the four files passed with no fixer change. `git diff --name-only PLAN_BASE -- package.json package-lock.json sonar-project.properties` is empty.
- Plan: `git diff --stat PLAN_BASE..HEAD` lists the twelve plan files plus `eslint.config.js` (the orchestrator's item). Nothing under `.planning/milestones/` changed. `npm run check` is the phase gate's, run by the orchestrator.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-23 (mitigate): both READMEs' removal commands name `protocol=https`, the host, and the old sign-in's username (`x-access-token` for github.com, `oauth2` for gitlab.com), and the docs say the extension never runs them. T-05-24 (mitigate): no example holds a token value, and no passage tells the user to put a token in an environment variable, a URL, or a file. The README says the extension reads no token variable. T-05-SC (mitigate): no package changed, and no version field changed. No test ran in this plan apart from the commit hook's `check:commit`, which reaches no remote host and runs no real ssh.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify. STATE.md, ROADMAP.md, REQUIREMENTS.md, and `.planning/WINDOWS.md` were not touched. `requirements-completed` lists SG-AUTH-01, SG-AUTH-02, and SG-AUTH-03 for the orchestrator's requirement update. The PR step adds the PR number to the CHANGELOG entry.

## Next Phase Readiness

- Phase 5's plans are complete. The phase gate runs `npm run check` on the merged tree.

## Self-Check: PASSED

- All 13 modified files exist, and `05-13-SUMMARY.md` is this file.
- `c3a9327`, `a229f87`, `c5fa112`, and `e177c75` are ancestors of HEAD. `git rev-list --count 4c6c70e..HEAD` is 4 before this SUMMARY commit.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*
