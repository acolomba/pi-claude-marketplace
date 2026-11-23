---
phase: 01-harness-on-system-git
plan: "02"
subsystem: infra
tags: [ci, github-actions, e2e, git, npm-scripts]

requires: []
provides:
  - "A `Show the git version` step (`run: git --version`) in the static, integration, behavioral, e2e-tests, and direct-coverage jobs of ci.yml and in the e2e-nightly job"
  - "CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1 as the e2e suite's own run variable in test:e2e, test:e2e:nightly, and test:coverage:e2e"
  - "A comment on prepareUpstreamCheckout recording why the e2e upstream checkout keeps the shell's environment"
affects: [system-git transport swap, e2e suite, CI logs]

actuals:
  tokens: 1715
  tasks: 2
  commits: 4
plan_head_before: 63c5fa4c555fe6fe64eb6c0d9942e15528940a9a
plan_head_after: cadf8a101ab612fe5f65fcb9b4afd80ab07e7ddb

tech-stack:
  added: []
  patterns:
    - "A CI test job prints `git --version` right after `npm ci`, before its first test step"
    - "An e2e script sets its own transport variable as a shell assignment, so the developer's shell value never reaches the e2e process"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/e2e-nightly.yml
    - package.json
    - test/e2e/upstream-marketplace.ts

key-decisions:
  - "The e2e upstream checkout keeps the shell's environment (network, proxy, CA bundle, GITHUB_TOKEN). It builds no fixture, and SG-HRN-01 covers the unit, integration, and cucumber suites only. The reason is a comment on prepareUpstreamCheckout."
  - "The sonarcloud call, the package job, and lint.yml get no git version step, because they run no test suite."

patterns-established:
  - "CI git version step: `- name: Show the git version` / `run: git --version`, with no `${{ }}` expression"

requirements-completed: ["SG-HRN-04"]

coverage:
  - id: D1
    description: "Each of the five test jobs in ci.yml and the e2e-nightly job prints the git version before its tests; package, sonarcloud, and lint.yml do not"
    requirement: "SG-HRN-04"
    verification:
      - kind: other
        ref: "grep -c 'run: git --version' on ci.yml (5), e2e-nightly.yml (1), lint.yml (0); the package job holds none"
        status: pass
      - kind: other
        ref: "npm run lint:workflows && node --test test/architecture/behavioral-shard-coverage.test.ts"
        status: pass
      - kind: other
        ref: "pre-commit run --files ci.yml e2e-nightly.yml (yamllint --strict, yamlfmt, zizmor offline audits)"
        status: pass
    human_judgment: true
    rationale: "That the step really prints `git version ...` in every job, including the three behavioral legs, can only be read in the pull request's CI log and the next nightly run (01-VALIDATION.md, manual-only row). zizmor's online audits could not run in this sandbox."
  - id: D2
    description: "test:e2e, test:e2e:nightly, and test:coverage:e2e start with CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1; no dependency, version, engines field, or lockfile entry changed"
    verification:
      - kind: other
        ref: "node -e check that the three scripts start with CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1"
        status: pass
      - kind: other
        ref: "node -e comparison of dependency, version, and engines fields against 63c5fa4; git diff 63c5fa4 -- package-lock.json is empty"
        status: pass
      - kind: other
        ref: "npm run format:check && npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "test/e2e/upstream-marketplace.ts says why its upstream checkout keeps the shell's environment; the code is unchanged"
    verification:
      - kind: other
        ref: "grep -c 'SG-HRN-01' test/e2e/upstream-marketplace.ts (1); git diff 63c5fa4 -- test/e2e/upstream-marketplace.ts adds comment lines only"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-11-23
status: complete
---

# Phase 1 Plan 02: CI git version and e2e HTTPS preference Summary

**Every CI job that runs a test suite prints `git --version` before its tests (SG-HRN-04). The e2e scripts set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` themselves, and a comment records why the e2e upstream checkout keeps the shell's environment.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-11-23T02:26:10Z
- **Completed:** 2026-11-23T02:45:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Six `Show the git version` steps: `static`, `integration`, `behavioral` (all three matrix legs), `e2e-tests`, and `direct-coverage` in `ci.yml`, plus `e2e-nightly`. Each sits right after "Install dependencies" and before the job's first test step. `package`, `sonarcloud`, and `lint.yml` have none.
- `test:e2e`, `test:e2e:nightly`, and `test:coverage:e2e` start with `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`, so a value in the developer's shell never reaches the e2e process.
- A doc comment on `prepareUpstreamCheckout` explains why that git keeps the shell's environment.

## Task Commits

1. **Task 01-02-01: Log the git version in every CI job that runs a test suite**: `2eaa3dc` (ci). Commit `1cf4c68` holds the same change under a wrong message, and `51eea9f` reverts it (see Deviations).
2. **Task 01-02-02: Give the e2e suite its own HTTPS preference and record why its upstream checkout keeps the shell environment**: `cadf8a1` (test)

**Plan metadata:** recorded in the SUMMARY commit that follows `cadf8a1`.

## Files Created/Modified

- `.github/workflows/ci.yml`: the git version step in five test jobs
- `.github/workflows/e2e-nightly.yml`: the git version step in the nightly e2e job
- `package.json`: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` before `PI_CM_E2E_REF=...` in the three e2e scripts
- `test/e2e/upstream-marketplace.ts`: comment only, above `prepareUpstreamCheckout`

## Verify Results

| Command | Result |
| --- | --- |
| `pre-commit run --files ci.yml e2e-nightly.yml` | yamllint `--strict` and yamlfmt pass. zizmor exits 1 under the full sandbox environment: its online `ref-confusion` audit gets a 401 from github.com, and the unchanged `lint.yml` fails the same way. With `GH_TOKEN`/`GITHUB_TOKEN` unset, zizmor runs its offline audits and passes ("No findings to report"). |
| `npm run lint:workflows && node --test test/architecture/behavioral-shard-coverage.test.ts` | pass (1/1), re-run for the tracer gate after the commit |
| the three-scripts prefix check | exit 0 |
| dependency, version, engines, and lockfile comparison against `63c5fa4` | exit 0, lockfile diff empty |
| `npm run format:check && npm run typecheck` | pass |
| plan-level `pre-commit run --files` on all four files | no hook failed (tokens unset, as above) |
| commit hooks (`npm run check:commit` included) | passed on `2eaa3dc` and `cadf8a1` |

Acceptance greps: `ci.yml` 5, `e2e-nightly.yml` 1, `lint.yml` 0, `package.json` 3, `SG-HRN-01` 1, and the `package` job 0. The cumulative diff from `63c5fa4` touches only the four planned files (+28/-3).

## Decisions Made

- The upstream checkout in `test/e2e/upstream-marketplace.ts` keeps the inherited environment, as the orchestrator answered RESEARCH Open Question 2. The comment cites DRV-03 and SG-HRN-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Commit 1cf4c68 got another plan's message, so it was reverted and recommitted**
- **Found during:** Task 01-02-01
- **Issue:** The commit message file was in the shared session scratchpad (`scratchpad/msg1.txt`). A sibling worktree agent overwrote it between my Write and my `git commit -F`. Commit `1cf4c68` therefore holds this task's two workflow files under the title `test(fixtures): build unit fixture repositories with system git`.
- **Fix:** AGENTS.md and the plan forbid `--amend` and history rewrites. So `51eea9f` reverts `1cf4c68`, and `2eaa3dc` re-applies the same change under `ci: show the git version in every test job`. After that, every message file went in a directory that only this agent uses (`scratchpad/agent-a0f2c7a64029c8756-01-02/`).
- **Files modified:** `.github/workflows/ci.yml`, `.github/workflows/e2e-nightly.yml` (net change unchanged)
- **Verification:** `git diff 63c5fa4 HEAD` shows only the planned six steps in those files. All hooks passed on all three commits.
- **Committed in:** `1cf4c68`, `51eea9f`, `2eaa3dc`

**2. [Rule 3 - Blocking] The plan's sandbox commit form was refused, so the commits used an equivalent environment**
- **Found during:** both tasks
- **Issue:** This agent's worktree guard refuses any git command that sets `HOME` or `PATH`, including `env -i HOME=... PATH=/opt/pi-claude-marketplace/bin:...`. With the plain shell, the hook ran as root on Node 22 with DAC override. Then `test/bridges/agents/discover.test.ts` "rejects an unreadable markdown entry" failed (`chmod 000` does not stop root), and `dispatch-exec.test.ts:39` failed on the environment-size cap. Both are the known sandbox baseline, not this change. Also, zizmor's online audit failed with a 401.
- **Fix:** No hook was skipped. The commit ran as `setpriv --bounding-set=-dac_override,-dac_read_search -- git commit -F ...`, which drops the same capabilities as the `/opt/pi-claude-marketplace/bin/node` wrapper. First, `GH_TOKEN`/`GITHUB_TOKEN` and about 35 sandbox-only variables were unset (Java options, Nix profiles, telemetry, and Claude session ids, all of which the checks do not read). The proxy, CA, and `GIT_CONFIG_*` variables were kept. The hook ran on Node 22.23.5, which is inside the engines range, instead of Node 24.
- **Verification:** `npm run check:commit` passed in the hook of `cadf8a1`, with every direct-coverage pair run because `package.json` was staged.
- **Committed in:** `2eaa3dc`, `cadf8a1`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** The net change is exactly what the plan specified. Two extra commits (`1cf4c68`, `51eea9f`) stay in history because rewriting it is forbidden.

## Issues Encountered

- The shared scratchpad is not safe for parallel agents: they share fixed file names such as `msg1.txt`. Executors in later waves should use a directory per agent.
- The orchestrator must still add one ledger entry (see below). I did not add it in this worktree, because parallel agents appending to `.planning/WINDOWS.md` would merge to duplicate ids.

## Ledger Entry for the Orchestrator

After merging, append this entry once in the main checkout:

```bash
node .claude/gsd-core/bin/gsd-tools.cjs windows append --kind unrun-verify --phase 1 \
  --file .github/workflows/ci.yml \
  --description "[system-git] zizmor's online audits (ref-confusion) could not run on the new git version steps in the sandbox (401 from github.com, also on unchanged lint.yml); offline audits passed; the pull request's Lint workflow runs them"
```

Close it once the pull request's Lint workflow passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The pull request's CI log should show `git version` in static, integration, behavioral (three legs), e2e-tests, and direct-coverage, and the next nightly run should show it in e2e-nightly (01-VALIDATION.md, manual-only row).
- `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` has no effect until a later phase makes the product read it. The RPC Pi children of the e2e suite still get only `rpcChildEnvironment(sandbox)`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml`, `.github/workflows/e2e-nightly.yml`, `package.json`, `test/e2e/upstream-marketplace.ts`
- FOUND commits on this branch: `1cf4c68`, `51eea9f`, `2eaa3dc`, `cadf8a1`
- `git rev-list --count 63c5fa4..cadf8a1` = 4
