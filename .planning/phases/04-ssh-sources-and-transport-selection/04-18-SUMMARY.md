---
phase: 04-ssh-sources-and-transport-selection
plan: 18
subsystem: records
tags: [system-git, ssh, records, docs]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-01 to 04-17: the git address validator, the clone note, the identity fold, the marketplace and plugin transport plans, the SSH tag reads, the per-command transport contexts, and the clone notes of every verb"
provides:
  - "NFR-5 amended by D-SG-18 and D-SG-20 in PROJECT.md Constraints and in AGENTS.md (same text)"
  - "the outcome of each of D-SG-17 to D-SG-24, with D-SG-22's open no-note rows"
  - "codebase maps that describe the transport modules, the ssh launches, the GitHubSshOps port, and DEFAULT_GITHUB_SSH_OPS in BLOCK F"
  - "user docs for CLAUDE_CODE_PLUGIN_PREFER_HTTPS, CLAUDE_CODE_REMOTE, the clone transport lines, and the scp marketplace address"
affects: [milestone-audit, phase-verification]

actuals:
  tokens: 8800
  tasks: 2
  commits: 2
plan_head_before: 1d004a8310a6a5f8854068cc0c9420295568e3e9
plan_head_after: 36ca1a64b36e6f7e7e8d1414dc986f07b2300bc5

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - AGENTS.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STACK.md
    - docs/env-vars.md
    - docs/output-catalog.md
    - README.md
    - README.es.md

key-decisions:
  - "NFR-5's new passage says `info` without `--fetch` runs none of the SSH steps, not bare `info`, because `info --fetch` clones over the install's transport rules since 04-12"
  - "D-SG-22's outcome says partly landed and names every open no-note row (WINDOWS.md entries 127 and 130 to 138, plus the fetch remote row), to be closed after phase verification"
  - "The marketplace order (04-04, 04-05, 04-09) is recorded under D-SG-18's outcome, with 04-09's legacy .json url record deviation, because no D-SG row names the marketplace order on its own"
  - "CONVENTIONS.md is unchanged: its BLOCK F text lists no seam names, so the plan's condition for adding DEFAULT_GITHUB_SSH_OPS there does not hold"
  - "The output catalog gains a Conventions subsection whose two fences sit outside every command section, so the catalog contract's state count and example bytes stay the same"

patterns-established: []

requirements-completed: [SG-SSH-01, SG-SSH-02, SG-SSH-03, SG-SSH-04, SG-SSH-05, SG-SSH-06]

coverage:
  - id: D1
    description: "NFR-5 in PROJECT.md and AGENTS.md names the ssh -T probe (TCP 22, 3 seconds), the retry over the other transport, the local ssh -G and ls-remote --get-url reads, the SSH tag reads, and the HTTPS retry of a github-source dependency's failed SSH tag listing, and says list, info without --fetch, and a load without autoapply run none of them"
    requirement: SG-SSH-02
    verification:
      - kind: other
        ref: "grep -c 'D-SG-18 and D-SG-20' AGENTS.md .planning/PROJECT.md (1, 1); grep -c 'TCP 22' AGENTS.md (1); grep -c 'tag listing is retried once over HTTPS' AGENTS.md .planning/PROJECT.md (1, 2); diff of AGENTS.md:60 and PROJECT.md:1955 (identical)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each of D-SG-17 to D-SG-24 has its outcome in place of 'Pending (Phase 4)'"
    requirement: SG-SSH-01
    verification:
      - kind: other
        ref: "grep -c 'Pending (Phase 4)' .planning/PROJECT.md (0)"
        status: pass
    human_judgment: true
    rationale: "Whether each outcome matches the shipped code is a reviewer's judgment; the grep proves only that every row was filled"
  - id: D3
    description: "Codebase maps describe the transport modules, the ssh launches and the -G tail, the GitHubSshOps port, DEFAULT_GITHUB_SSH_OPS in BLOCK F, and the new variables; NETWORK_SEAMS still lists 19 files"
    requirement: SG-SSH-03
    verification:
      - kind: other
        ref: "node count of NETWORK_SEAMS entries in eslint.config.js (19); grep -c CLAUDE_CODE_PLUGIN_PREFER_HTTPS .planning/codebase/STACK.md (1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/env-vars.md documents CLAUDE_CODE_PLUGIN_PREFER_HTTPS and says why CLAUDE_CODE_REMOTE is not read; the output catalog lists the clone transport lines; the READMEs show the scp marketplace address"
    requirement: SG-SSH-03
    verification:
      - kind: other
        ref: "grep -c CLAUDE_CODE_PLUGIN_PREFER_HTTPS docs/env-vars.md (1); node --test test/architecture/catalog-uat/catalog-contract.test.ts test/architecture/catalog-uat/catalog-parser.test.ts (20/20); the Task 2 commit hook's npm run check:commit (passed)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 18: SSH Transport Records Summary

**NFR-5 in PROJECT.md and AGENTS.md now names the network steps this phase added. These are the `ssh -T` probe of github.com (TCP 22, 3 seconds at most), the retry over the other transport, the local `ssh -G` and `ls-remote --get-url` reads, the SSH tag reads, and the HTTPS retry of a failed SSH tag listing for a github-source dependency. Each of D-SG-17 to D-SG-24 names the plans that landed it. The codebase maps describe the transport modules and the ssh launches. The user docs cover `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_REMOTE`, the clone transport lines, and the scp marketplace address.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-26T04:30:18Z
- **Completed:** 2026-11-26T04:42:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- NFR-5's amendment list now ends "by D-SG-09, and by D-SG-18 and D-SG-20". A new passage states these rules:
  - The probe, the retries, the ssh reads, and the tag reads run only inside commands that NFR-5 already lets reach GitHub.
  - The checks that skip the probe are local.
  - `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and the base override skip the probe and every SSH attempt.
  - `list`, `info` without `--fetch`, and a load without `autoapply` run none of them.

  AGENTS.md line 60 and PROJECT.md line 1955 are identical.
- D-SG-17 to D-SG-24 carry their outcomes:
  - D-SG-17: 04-01 (`domain/git-url.ts`).
  - D-SG-18: 04-06, 04-10, and 04-17 for plugins. 04-04, 04-05, and 04-09 for the marketplace order, with 04-09's deviation: a legacy url record whose URL ends in `.json` keeps its checkout's recorded origin.
  - D-SG-19: 04-11, plus the 2026-11-25 extension (04-12, 04-17). `enable` follows the install's probe and fallback with one context per command, made at its command root and shared by its cascade. Apply's and import's enables share the run's context. No clone path keeps an SSH-only no-context arm.
  - D-SG-20: 04-06 and 04-07, with the 2026-11-25 amendment: a `github`-source dependency's failed SSH tag listing is retried once over HTTPS and pins its tag. A path-source dependency keeps the TAGS-02 current copy.
  - D-SG-21: 04-03, 04-04, 04-06, and 04-08.
  - D-SG-22: 04-02, 04-08, and 04-13 to 04-17. The outcome says partly landed and lists the open no-note rows.
  - D-SG-23: 04-03. The `Ort` fold lives in `shared/github-base-url.ts`, not in `domain/clone-key.ts`, because of the fallow boundaries and the `github.com` literal rule.
  - D-SG-24: the reader is `shared/upstream-flag.ts`. 04-04, 04-06, and 04-07 use it, and 04-05 pins both variables.
- ARCHITECTURE.md gains these entries:
  - the domain transport family: `git-url.ts`, `github-transport.ts`, and `github-plugin-transport.ts`
  - `orchestrators/github-transport.ts`
  - the ssh reads of `platform/git.ts`
  - the two fixed ssh launches of `platform/git-process.ts` (`github-probe` and `github-config`) and its `print-config` tail (` -G >&2`)
  - `shared/github-base-url.ts` and `shared/upstream-flag.ts`
  - the `GitHubSshOps` and `GitHubPluginSshOps` port
  - `DEFAULT_GITHUB_SSH_OPS` among BLOCK F's `NETWORK_SEAM_NAMES`
- STACK.md names the ssh launches. It adds `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, states that `CLAUDE_CODE_REMOTE` is not read, and extends the base override bullet to the SSH spellings. Both maps carry the analysis date 2026-11-26.
- `docs/env-vars.md` gains the section "Variables that choose the GitHub transport". It holds the `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` row, the default order, and the reason that `CLAUDE_CODE_REMOTE` is not read. The `CLAUDE_CODE_REMOTE` absence line points to it.
- `docs/output-catalog.md` gains the Conventions subsection "Clone transport lines". It lists the three first lines and the retry line, where they sit, and their JSON fields.
- README.md and README.es.md now show `marketplace add git@github.com:<owner>/<repo>.git`. They say that the command line does not accept `ssh://` URLs, and how an `owner/repo` shorthand picks its transport.

## Task Commits

1. **Task 1: NFR-5 names the probe and the retry in PROJECT.md and AGENTS.md** - `5ba8ca2` (docs)
2. **Task 2: The decision outcomes, the codebase maps, and the user docs say what shipped** - `36ca1a6` (docs)

**Plan metadata:** the commit that adds this SUMMARY (docs)

## Files Created/Modified

- `.planning/PROJECT.md`: Task 1 makes the NFR-5 amendment in Constraints, one hunk. Task 2 fills the D-SG-17 to D-SG-24 outcome cells.
- `AGENTS.md`: the same NFR-5 text.
- `.planning/codebase/ARCHITECTURE.md`: the transport modules, the ssh launches and tail, the port, the seam name, and the date.
- `.planning/codebase/STACK.md`: the ssh launches, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_REMOTE`, the base override's SSH pairs, and the date.
- `docs/env-vars.md`: the GitHub transport section and the `CLAUDE_CODE_REMOTE` line.
- `docs/output-catalog.md`: the clone transport lines subsection.
- `README.md` and `README.es.md`: the scp marketplace address and the transport choice.

## Decisions Made

The `key-decisions` list in the front matter holds all five, with reasons. The one that changes the plan's wording: NFR-5 names `info` without `--fetch`, because `info --fetch` clones (04-12).

## Deviations from Plan

### Recorded adjustments

**1. [Accuracy] `info` without `--fetch` in the NFR-5 passage**
- **Found during:** Task 1
- **Issue:** The plan's passage says that `info` runs none of the SSH steps. Since 04-12, `info --fetch` clones a GitHub plugin over the install's transport rules, probe included.
- **Fix:** The passage says "`list`, `info` without `--fetch`, and a load without `autoapply` run none of them". The older NFR-5 sentence ("`list`, `info`, `uninstall`, ... MUST NOT touch the network") is left as it was, because the plan adds a passage and does not rewrite the existing text.
- **Files modified:** AGENTS.md, .planning/PROJECT.md
- **Committed in:** 5ba8ca2

**2. [Scope] CONVENTIONS.md unchanged**
- **Found during:** Task 2
- **Issue:** The plan adds `DEFAULT_GITHUB_SSH_OPS` to CONVENTIONS.md's BLOCK F text only if that text lists the names. It does not list them.
- **Fix:** No edit. CONVENTIONS.md keeps its analysis date of 2026-10-25.

**3. [Verification] This executor did not run `npm run check`**
- **Found during:** Task 2, step 4
- **Issue:** The orchestrator's prompt for this wave says not to run the full `npm run check`, because the orchestrator runs it at the wave gate.
- **Fix:** I ran the plan's grep and seam-count gates, the catalog contract and parser tests (20/20), and the commit hook. `docs/output-catalog.md` is a build input, so the hook ran `npm run check:commit` on the Task 2 commit, and it passed. The hook's mdformat step reformatted the new env-vars table once, and the retry passed. The gate counts are under Verification.

---

**Total deviations:** 3 recorded adjustments, with no auto-fix rule applied. **Impact:** none on the code. This plan changes records and docs only.

## Verification

- **Task 1:**
  - `grep -c "D-SG-18 and D-SG-20"` gives 1 in AGENTS.md and 1 in PROJECT.md.
  - `grep -c "ssh -T" AGENTS.md` gives 1, and `grep -c "TCP 22" AGENTS.md` gives 1.
  - `grep -c "tag listing is retried once over HTTPS"` gives 1 in AGENTS.md and 2 in PROJECT.md.
  - `git show --stat 5ba8ca2` lists only those two files. `git show -U0 5ba8ca2 -- .planning/PROJECT.md` has one hunk, at line 1955 in Constraints.
  - The tracer gate re-ran this verify before Task 2 started. It passed.
- **Task 2:**
  - `grep -c "Pending (Phase 4)" .planning/PROJECT.md` gives 0.
  - `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` appears once in docs/env-vars.md and once in STACK.md.
  - `once the SSH probe lands` appears 0 times in `platform/git-process.ts`. 04-04 rewrote that header.
  - `NETWORK_SEAMS` holds 19 entries, the same as at HEAD.
- **Catalog contract:** the test still counts 329 states and 55,943 example bytes, because the new fences sit outside every command section. `node --test test/architecture/catalog-uat/catalog-contract.test.ts test/architecture/catalog-uat/catalog-parser.test.ts` passes 20 of 20.
- **`npm run check`:** the wave 10 gate on base 1d004a8 passed static, unpaired, integration, and direct coverage. Cucumber passed 2383 of 2388 scenarios. The only failures were the 5 known Glob baselines in `features/hook/tool-use.feature`, which fail because the sandbox has no `fd`. This plan changes no code. The orchestrator re-runs the gate on the merged tree.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase complete, ready for next step: every one of the 18 Phase 4 plans has a SUMMARY, so the phase can go to verification.
- D-SG-22 remains open for the no-note rows that `.planning/WINDOWS.md` records (entries 127 and 130 to 138) and for the fetch remote row. They are to be closed after phase verification.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-04-51: the NFR-5 amendment names every network step this phase added, and AGENTS.md mirrors it exactly. The seam count (19) and the header gate pin the boundary.
- T-04-SC: no package was added.

## Orchestrator actions

None. The plan asks for no `windows append`.

## Self-Check: PASSED

- All 8 modified files exist, and the plan's grep gates pass on the final tree.
- Commits `5ba8ca2` and `36ca1a6` are ancestors of HEAD.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
