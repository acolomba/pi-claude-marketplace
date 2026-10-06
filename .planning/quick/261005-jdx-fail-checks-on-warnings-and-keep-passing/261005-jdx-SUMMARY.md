---
phase: 261005-jdx
plan: 01
subsystem: build-checks
tags: [eslint, yamllint, fallow, ci, test-reporter, direct-coverage, quiet-output]
requires: []
provides:
  - ESLint fails on any warning (--max-warnings 0)
  - quiet passing output for gates, Prettier, test reporter, direct coverage
  - strict yamllint and a fail-on-warning Fallow audit CI job
  - fallow agent install without the AGENTS.md guide
affects: [package.json, scripts, .pre-commit-config.yaml, .github/workflows/lint.yml, scripts/init.sh, AGENTS.md, docs]
tech-stack:
  added: []
  patterns: [quiet-on-pass, fail-on-warning]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/discover.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - package.json
    - scripts/test-reporter.mjs
    - scripts/test-coverage-direct.mjs
    - scripts/check-workflow-install-scripts.mjs
    - scripts/check-corresponding-tests.mjs
    - .pre-commit-config.yaml
    - .github/workflows/lint.yml
    - scripts/init.sh
    - AGENTS.md
    - CONTRIBUTING.md
    - skills/local-verification/SKILL.md
    - CHANGELOG.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md
    - .planning/codebase/TESTING.md
    - .planning/BACKLOG.md
decisions:
  - "ESLint --max-warnings 0 lives only in the lint script; every gate reaches ESLint through it"
  - "Direct coverage keeps one Merged LCOV line as its only pass output"
  - "A failing changed-pair run names its base on stderr, and a failing escalated staged run names the staged file (supersedes the print-on-pass halves of D-07-13/D-07-14)"
  - "yamllint --strict with comments.min-spaces-from-content 1, to agree with yamlfmt"
  - "Fallow audit CI job installs deps and fails on a warn verdict or a degraded analysis (reopens FLOW-10)"
  - ".fallowrc.json policy-violation NOT switched off: the permission system denied the edit"
metrics:
  duration: ~45m
  completed: 2026-10-05
status: complete
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 9000
  tasks: 3
  commits: 6
plan_head_before: 260d2888e3240b8dd47527a023183a2048d6fbda
plan_head_after: 2169244943d8ec78fa05b2134b0aae92b30765c7
---

# Phase 261005-jdx Plan 01: Fail checks on warnings and keep passing output quiet Summary

ESLint now fails on any warning, and the 19 unused await-in-loop directives are gone. yamllint runs with `--strict`, and the CI Fallow audit installs dependencies and fails on a `warn` verdict or a degraded analysis. Passing checks print only npm's banner, six `check:static` status lines, and one `Merged LCOV` line. `fallow agent install` no longer writes AGENTS.md. One planned item was not done: `.fallowrc.json` `policy-violation: off` (see Deviations).

## Commits

| # | SHA | Title | Hook (`check:commit`) |
| --- | --- | --- | --- |
| 1 | f148f71d | chore(lint): remove unused no-await-in-loop directives | pre-commit 0, commit 0, check:commit Passed |
| 2 | 676c10d7 | build(lint): fail on any ESLint warning | pre-commit 0, commit 0, check:commit Passed (all pairs: package.json staged) |
| 3 | ad108a26 | build(checks): print only a summary from passing checks | pre-commit 0, commit 0, check:commit Passed (all pairs) |
| 4 | beed1186 | ci: fail on yamllint and Fallow audit warnings | pre-commit 0, commit 0, check:commit Passed |
| 5 | 28a7049f | chore(init): stop fallow agent install from writing AGENTS.md | pre-commit 0, commit 0, check:commit Passed |
| 6 | 21692449 | docs: describe warning-free checks and quiet output | pre-commit 0, commit 0, check:commit Skipped (docs only) |

Commit 4 covers only `.pre-commit-config.yaml` and `.github/workflows/lint.yml`. `.fallowrc.json` is not in it (see Deviations).

## Final `npm run check`

Command: `npm run check > tmp/jdx/check-final.log 2>&1`. Exit 0. Commit `2169244943d8ec78fa05b2134b0aae92b30765c7`. `node --version` v26.10.0. Executor worktree `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-abe6c827142376266`.

```text

> pi-claude-marketplace@0.19.2 check
> npm run --silent check:static && npm run --silent test:unpaired && npm run --silent test:integration && npm run --silent test:coverage:direct:all

passed typecheck (9.5 s)
passed lint (4.0 s)
passed lint:workflows (0.4 s)
passed fallow (3.6 s)
passed format:check (6.6 s)
passed test:corresponding (3.2 s)
Merged LCOV: coverage/direct.lcov (258 records)
CHECK_EXIT=0
```

## Warning sweep (confirmed)

| Step or job | Warning-level output that exited 0 | Disposition | Evidence |
| --- | --- | --- | --- |
| `typecheck` | None | Shown none | typecheck-2.log (single exit line) |
| `lint` | 19 unused-directive warnings | Deleted the 19 lines and added `--max-warnings 0` | lint-1/2/3.log silent; plant-lint-1.log and plant-static-1.log exit 1, five `passed` lines |
| `lint:workflows` | None | Quiet on a pass | wf-2.log, wf-3.log; plant-wf-2.log exit 1 |
| `fallow` | None in human output. The JSON diagnostic `rule-packs-not-configured` remains | `policy-violation: off` NOT applied (permission denied) | fallow-2.log silent; fallow-dc-2.json total_issues 0, 1 workspace diagnostic |
| `format:check` | None | `--log-level warn` | fmt-2.log silent; plant-fmt-2.log `[warn] tests/zz-jdx-fmt.ts`, exit 1 |
| `test:corresponding` | None | Quiet on a pass | corr-2.log; plant-corr-2.log exit 1 |
| `test:unpaired`, `test:integration`, `test:coverage:integration` | None | Reporter silent on a pass | unpaired-2, integration-2, covint-2 (single lines); reporter-pass/fail/coverage-2.log |
| Direct coverage | None | Quiet except Merged LCOV. A failure names its base or the staged file | direct-pair-2, direct-staged-2 silent; direct-plant-2 `Changed-pair base: HEAD`; escalate-2 `Staged tsconfig.json affects every pair, so every pair ran.` |
| CI `e2e-tests` | None | Project reporter | e2e-2.log single exit line (network available) |
| CI `sonarcloud`, `package` | None in the job exit status | Left | planning evidence |
| Every CI job | `npm warn deprecated node-domexception` | Left: install-time notice about a transitive dependency | planning evidence |
| Lint `pre-commit` | yamllint `comments` warnings (3) | `--strict` plus `min-spaces-from-content: 1` | yamllint-2.log 0 findings; plant-yaml-2.log exit 1 `missing starting space in comment` |
| Lint `pre-commit` | Node 20 notice from `actions/cache@v4` inside `pre-commit/action` | Left, flagged | planning evidence |
| Lint `pre-commit` | zizmor offline-mode WARN log | Left (tool log) | zizmor-2.log `No findings to report` |
| markdownlint-cli2 | None | Shown none | markdownlint-2.log `Summary: 0 error(s)`. It linted only 1 file under `--all-files`: a pre-existing hook-scope oddity, out of scope |
| Lint `fallow-audit` | degraded inputs, and a `warn` verdict passes | Install deps; a new step fails on warn or degraded | audit-2.json verdict `pass`, no `degrades_analysis`; fallow-action.yml confirms `verdict` and `analysis-degraded` output names |
| Tool noise | Fallow tracing `WARN` on stderr (`Skipped 1 package.json entry point` on audit) | Left | audit-2.err |
| Tool noise | Node ExperimentalWarning | Not printed on Node 26.10.0 | all logs |

## Log last lines

All `tmp/jdx/*.log` end as expected: every pass log ends `*_EXIT=0` (typecheck, wf-2, wf-3, corr, fmt, unpaired, integration, covint, direct-pair, direct-staged, e2e, fallow-warm, fallow, yamllint, zizmor, markdownlint, lint-1/2/3, reporter-pass, agent-dry-3, check-final, precommit-1..6, gitlint-1..6, commit-1..6). Every plant log ends `*_EXIT=1` (plant-lint-1, plant-static-1, plant-wf-2, plant-corr-2, plant-fmt-2, plant-yaml-2, reporter-fail-2, reporter-coverage-2, direct-plant-2, escalate-2).

## Changelog wording (final, #236 sub-bullets)

- Every local and CI check now fails on a warning, and a passing check prints at most one summary line.
- `scripts/init.sh` no longer lets Fallow rewrite `AGENTS.md`, so the Fallow task map there no longer changes on a Fallow upgrade.

## Deviations from Plan

**1. [Blocked - permission] `.fallowrc.json` `policy-violation` stays `error`.** The Claude Code auto-mode permission classifier denied the edit as a "CI Bypass". The denial says not to pursue the same outcome by another route or in a later turn. The orchestrator then asked for the change. An agent message cannot override a permission denial, so it is not applied. Effect: Fallow's dead-code and audit JSON still carry the `rule-packs-not-configured` workspace diagnostic. It has no `degrades_analysis`, so the new CI step does not fire on it, and `npm run fallow` passes. Consequences: commit 4 has 2 files, not 3. The CONVENTIONS "Fallow loads no rule pack" bullet has no `policy-violation` note. The plan's verify checks for these items fail. Variant verifies without those checks print `task 2 ok` and `task 3 ok` (tmp/jdx/verify-2-variant.sh, verify-3-variant.sh). To apply it, the operator changes `"policy-violation": "error"` to `"off"` in `.fallowrc.json` and commits it alone.

**2. [Blocked - isolation] REVIEW.md not edited.** The worktree isolation guard refused edits to `/home/acolomba/pi-claude-marketplace/REVIEW.md`. The orchestrator appends these notes to "Next steps":
- Item 1: "Done in quick task `261005-jdx` (`f148f71d`, `676c10d7`, `ad108a26`, `beed1186`): ESLint runs with `--max-warnings 0`, yamllint with `--strict`, and the Fallow audit job installs dependencies and fails on a `warn` verdict or a degraded analysis, which reopens FLOW-10. A passing `npm run check` prints npm's banner, six status lines, and one `Merged LCOV` line. Left: the Node 20 notice on the Lint pre-commit job. Not done: `.fallowrc.json` keeps `\"policy-violation\": \"error\"`, because a permission check refused that edit."
- Item 2: "Done in quick task `261005-jdx` (`28a7049f`): `init.sh` passes `--without guide`, the gate section is gone from `AGENTS.md`, and the task map stays but no longer refreshes on Fallow upgrades."

**3. [Sandbox] Compound git commands refused.** Staging, pre-commit, commits, and probes ran from scripts under `tmp/jdx/` (stage.sh, commit.sh, ev-*.sh), as the plan allows.

**4. [Wording] CONTRIBUTING sentence split.** The planned 27-word sentence was split into three sentences to meet the 25-word self-check.

**5. [Commit body] Commit 4 body** omits the policy-violation sentence, because that change is not in the commit.

## Flags for the operator

- The Fallow audit job now fails on introduced duplication. This reopens BACKLOG FLOW-10.
- The print-on-pass parts of D-07-13 and D-07-14 are superseded. Their failure halves stay.
- SonarCloud may report the 19 awaits again.
- The Node 20 notice on the Lint pre-commit job is left.
- The new audit step and yamllint `--strict` first run on GitHub on the pull request.
- REVIEW.md S5 (`maxUnitSize`) and the stale `fallow-ignore` count in CONVENTIONS.md (F5) are unchanged.
- `policy-violation: off` is still pending (Deviation 1).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All six commits are ancestors of HEAD (`git log --oneline -7`). The modified files exist. The verify for Task 1 passes as written. Tasks 2 and 3 pass in variants that drop only the denied `.fallowrc.json` and REVIEW.md checks. Nothing is staged, and no plant remains.
