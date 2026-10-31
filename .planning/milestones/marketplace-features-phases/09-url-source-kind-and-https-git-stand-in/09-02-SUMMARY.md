---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "02"
subsystem: testing
tags: [cucumber, node-test, git-http-backend, hermetic-git, cucumber-rules]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: plan 09-01's cgi.ts (parseCgiResponse, cgiEnvironment), hermetic-git.ts (hermeticGitEnvironment), and tests/e2e/_rpc.ts (rpcChildEnvironment, RpcGitEnvironment)
provides:
  - Whole-object unit cases of parseCgiResponse and cgiEnvironment (tests/architecture/https-git-host-cgi.test.ts)
  - Whole-object unit cases of hermeticGitEnvironment and rpcChildEnvironment with five inherited GIT_* variables planted (tests/architecture/hermetic-git-environment.test.ts)
  - Cucumber rules for a stand-in that shares the slow process's run state, for request-log steps, and for the {git host} token
affects: [09-03, 09-04, 09-08, phase-10-github-source]

actuals:
  tokens: 3000
  tasks: 2
  commits: 2

plan_head_before: 4daba3b82b28ae2015b99c76a465cda70abc0e9d
plan_head_after: 3cfaa1268cba64d1057e9f413ecc72df1fd7d537

tech-stack:
  added: []
  patterns:
    - "Planting process.env in a unit case: save each key (existed + value), register restoration with t.after() before acting, and restore by delete or assign"
    - "Expected CGI environments built from one literal base helper plus per-case keys, so the three cases share no cloned block"

key-files:
  created:
    - tests/architecture/https-git-host-cgi.test.ts
    - tests/architecture/hermetic-git-environment.test.ts
  modified:
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/steps.md
    - .agents/skills/cucumber/rules/features.md

key-decisions:
  - "The header-value-with-colon parser case uses `Expires: Fri, 01 Jan 1980 00:00:00 GMT`, a header git http-backend really emits, because the plan's example `Content-Type: application/x-git-upload-pack-advertisement` holds no colon in its value and so could not tell a first-colon split from a last-colon split"
  - "The two modules plant the same five GIT_* keys with different code shapes (a per-key loop with t.after in the CGI case, a save-all helper in the environment module), so fallow dupes reports no new clone group"

patterns-established:
  - "Unit tests of features/lib and tests/e2e helpers live under tests/architecture/, unpaired, and run in npm test, test:unpaired, and the commit hook"

requirements-completed: [HOST-01, HOST-02, DRV-03]

coverage:
  - id: D1
    description: "parseCgiResponse reads a missing Status as 200, reads Status 404 without forwarding it, accepts LF-only headers, returns a binary body holding CRLFCRLF and LFLF byte for byte, keeps everything after the first colon, and throws on output with no blank line"
    requirement: HOST-01
    verification:
      - kind: unit
        ref: "tests/architecture/https-git-host-cgi.test.ts#parseCgiResponse"
        status: pass
    human_judgment: false
  - id: D2
    description: "cgiEnvironment returns exactly the hermetic base plus the CGI keys: CONTENT_LENGTH from the buffered body, GIT_PROTOCOL only with a Git-Protocol header, HTTP_CONTENT_ENCODING with a Content-Encoding header, and no planted GIT_* variable"
    requirement: HOST-01
    verification:
      - kind: unit
        ref: "tests/architecture/https-git-host-cgi.test.ts#cgiEnvironment"
        status: pass
    human_judgment: false
  - id: D3
    description: "hermeticGitEnvironment and rpcChildEnvironment (with and without the git environment) return exactly their built-from-scratch objects while GIT_DIR, GIT_INDEX_FILE, GIT_CONFIG_SYSTEM, GIT_CONFIG_GLOBAL, and GIT_ASKPASS are planted in process.env and restored with t.after()"
    requirement: DRV-03
    verification:
      - kind: unit
        ref: "tests/architecture/hermetic-git-environment.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The cucumber rules allow a stand-in whose address or trust the slow process fixes at start to share its run state, point layout.md at world-and-stand-ins.md, state the request-log step rules, and define {git host}"
    requirement: HOST-02
    verification:
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files <four rule files>; npm run check:features"
        status: pass
    human_judgment: true
    rationale: "No gate reads the rule prose; whether the rules match the code and read clearly is a reviewer's judgment"

duration: 6min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 02: Pin the git host's CGI bridge and git environments Summary

**Twelve `node:test` cases pin the CGI response parser, the CGI environment, and both hermetic git environment builders as whole objects, with five inherited `GIT_*` variables planted and restored, and the cucumber rules now allow the git host's run-long lifetime, define its request-log steps, and define `{git host}`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-21T03:17:39Z
- **Completed:** 2026-10-21T03:23:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `tests/architecture/https-git-host-cgi.test.ts`: five parser rows (one `test()` each) plus the throwing case, and three `cgiEnvironment` cases (GET with planted variables, POST with `git-protocol: version=2` and a 146-byte body, POST with `content-encoding: gzip`), all compared with `assert.deepStrictEqual` against literals.
- `tests/architecture/hermetic-git-environment.test.ts`: `hermeticGitEnvironment("/scratch/home")`, `rpcChildEnvironment(sandbox, git)`, and `rpcChildEnvironment(sandbox)`, each with `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_GLOBAL`, and `GIT_ASKPASS` planted. This is the unit half of D-11; plan 09-04 runs the by-hand control.
- `world-and-stand-ins.md`: a new bullet after the slow-process exception lets a stand-in whose address or trust the process fixes at start share its run state (started before it, reset and asserted empty with it, stopped after it, same environment for a replaced process).
- `layout.md`: the run-state sentence now names `world-and-stand-ins.md` and says a stand-in whose address the process fixes at start joins that state.
- `steps.md`: a request-log step compares only the last `When`'s requests, the log has no compared-marker, and log steps appear only in the git source kinds' feature files.
- `features.md`: `{git host}` is a token bullet beside `{home}`; the forward-looking url sentence is gone.

## Task Commits

1. **Task 1: Pin the CGI parser and the hermetic environment builders with unit cases** - `86476f2d` (test)
2. **Task 2: Amend the cucumber rules for the git host's lifetime, its log steps, and the {git host} token** - `3cfaa126` (docs)

**Plan metadata:** the `docs(planning)` commit that adds this SUMMARY.

## Files Created/Modified

- `tests/architecture/https-git-host-cgi.test.ts` - unit cases of `parseCgiResponse` and `cgiEnvironment`
- `tests/architecture/hermetic-git-environment.test.ts` - unit cases of `hermeticGitEnvironment` and `rpcChildEnvironment`
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - the shared-run-state rule for a stand-in
- `.agents/skills/cucumber/rules/layout.md` - pointer to `world-and-stand-ins.md`
- `.agents/skills/cucumber/rules/steps.md` - the request-log step rule
- `.agents/skills/cucumber/rules/features.md` - the `{git host}` token

## Verification evidence

Environment: Node v26.11.1, git version 2.55.0.

| Command | Exit | Result |
| --- | --- | --- |
| `node --test tests/architecture/https-git-host-cgi.test.ts tests/architecture/hermetic-git-environment.test.ts` | 0 | `ℹ tests 12`, `ℹ pass 12`, `ℹ fail 0` |
| `npx eslint --max-warnings 0` on both modules | 0 | no output |
| `npm run typecheck` | 0 | no `error TS` line |
| `npm run fallow` | 0 | clean; `npx fallow dupes` names neither new module |
| `SKIP=npm-check pre-commit run --files` (both modules) | 0 | all hooks passed |
| Task 1 commit hook (`npm run check:commit`) | 0 | `Passed` |
| `SKIP=npm-check pre-commit run --files` (four rule files) | 0 | all hooks passed (mdformat, markdownlint, texthooks) |
| `npm run check:features` | 0 | no "Feature gate failed" |
| Task 2 commit hook | 0 | npm-check skipped (no build input) |

Acceptance greps: `rg -c '^\s*test\('` = 5 + 3 = 8 (at least 6). `GIT_DIR|GIT_INDEX_FILE|GIT_ASKPASS` matches 3 lines in the environment module. `t.after(` appears once in each module. `git host` in `world-and-stand-ins.md` = 1, `world-and-stand-ins.md` in `layout.md` = 1, `request` in `steps.md` = 1, `127.0.0.1` in `features.md` = 1. `git status --short` on each task's paths printed nothing after each commit.

The combined-tree `npm run check` is the orchestrator's post-wave gate (and plan 09-08's phase gate); this executor ran the hook's `check:commit`, not the full gate.

## Decisions Made

- The colon case uses `Expires: Fri, 01 Jan 1980 00:00:00 GMT` (see deviation 1).
- The two modules plant the same keys with different code shapes, so no clone group arises.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's colon-in-value example held no colon in its value**
- **Found during:** Task 1
- **Issue:** `<behavior>` names `Content-Type: application/x-git-upload-pack-advertisement` as "a header value holding a colon", but its value has no colon. A parser that split at the last colon would still pass that case.
- **Fix:** The row uses `Expires: Fri, 01 Jan 1980 00:00:00 GMT`, whose value holds three colons. git http-backend sends that header on its no-cache responses.
- **Files modified:** tests/architecture/https-git-host-cgi.test.ts
- **Verification:** the row passes against the first-colon split in `headerLine`.
- **Committed in:** 86476f2d

---

**Total deviations:** 1 auto-fixed (1 bug in the plan's test data)
**Impact on plan:** The case now discriminates the behavior its title names. No scope change.

## TDD note

Task 1 carries `tdd="true"`, but it pins code that plan 09-01 already shipped, so the cases passed on their first run. No RED phase was possible or claimed. `workflow.tdd_mode` is `false` and the plan is `type: execute`, so no RED/GREEN gate applies.

## Issues Encountered

- `gsd-tools check evaluation-scope --plan 09-02 --commits-only` cannot match these commits, because the repository's commit policy keeps plan IDs out of commit subjects. The commits are `86476f2d` and `3cfaa126` on `features/cucumber-behavioral-tests`.

## Flagged assumptions (carried from the plan)

- The rules land one plan after the code they describe. No gate reads these rule files, so no commit between the two plans is red.
- The world-and-stand-ins bullet lists "the arming" among what `Before()` resets, as the plan says. Arming arrives in plan 09-03; the 09-01 snapshot holds repositories, requests, connections, and children.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 09-03 (arming and the other url arms). The rules now say how request-log steps compare, so later log steps follow them.
- The orchestrator's post-wave `npm run check` on the combined tree is still owed (AGENTS.md, Build verification).

## Self-Check: PASSED

- FOUND: tests/architecture/https-git-host-cgi.test.ts, tests/architecture/hermetic-git-environment.test.ts
- FOUND: 86476f2d and 3cfaa126 are ancestors of HEAD
- All `<acceptance_criteria>` and the `<verify>` commands re-ran green on the committed tree

---
*Phase: 09-url-source-kind-and-https-git-stand-in*
*Completed: 2026-10-21*
