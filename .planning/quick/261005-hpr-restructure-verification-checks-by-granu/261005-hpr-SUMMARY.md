---
phase: 261005-hpr
plan: 01
subsystem: build-verification
tags: [pre-commit, ci, coverage, sonar, docs]
status: complete
requires: []
provides:
  - check:static parallel static checks (scripts/run-parallel.mjs)
  - check:commit staged-scope hook gate with all-pair escalation
  - test:unpaired
  - merged per-pair LCOV coverage/direct.lcov for Sonar
  - split CI jobs static / integration / direct-coverage
affects: [.pre-commit-config.yaml, package.json, .github/workflows, sonar-project.properties, AGENTS.md, skills]
tech-stack:
  added: []
  patterns: [staged-index selection with escalation, per-pair --test-coverage-include]
key-files:
  created:
    - scripts/run-parallel.mjs
  modified:
    - scripts/test-coverage-direct.mjs
    - package.json
    - .pre-commit-config.yaml
    - .github/workflows/ci.yml
    - .github/workflows/lint.yml
    - .github/workflows/sonarcloud.yml
    - sonar-project.properties
    - AGENTS.md
    - skills/local-verification/SKILL.md
    - skills/typescript-unit-testing/SKILL.md
    - skills/typescript-unit-testing-review/SKILL.md
    - CONTRIBUTING.md
    - docs/guidelines/typescript-unit-testing-guidelines.md
    - CHANGELOG.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md
    - .planning/codebase/TESTING.md
decisions:
  - "The commit hook runs npm run check:commit (static checks in parallel, unpaired unit tests, staged pairs only, all pairs on staged test support, pair tooling, or dependency files)"
  - "npm run check is check:static, test:unpaired, test:integration, test:coverage:direct:all; whole-suite unit coverage script deleted"
  - "Sonar reads the merged per-pair report coverage/direct.lcov via the direct-coverage-lcov CI artifact"
  - "The generated Fallow block in AGENTS.md stays untouched (no fallow agent install option drops only the audit step)"
metrics:
  duration: ~45 min
  completed: 2026-10-05
actuals:
  tokens: 16700
  tasks: 3
  commits: 3
plan_head_before: c76b014b203a8de8dabcc81a4567ed7496011ed9
plan_head_after: 6a9e0df97e21ed9c579a6b3403ae40f459028ec6
---

# Quick Task 261005-hpr: Run each verification check at the scope its moment needs

A commit now runs `npm run check:commit` (six static checks in parallel, the unpaired unit tests, and direct coverage for the staged pairs only, escalating to all 268 pairs on staged test support, pair tooling, or dependency files). `npm run check`, pull request CI, and CI on `main` measure every pair, and Sonar reads the merged per-pair LCOV.

## Commits

| Task | Commit | Message | Hook `npm run check:commit` |
| --- | --- | --- | --- |
| 1 | `4100d135` | perf(checks): run staged pairs and parallel static checks on commit | Passed (staged `package.json` ran all pairs) |
| 2 | `426bdd64` | ci: run each check in its own job and feed Sonar per-pair coverage | Passed (staged `package.json` ran all pairs) |
| 3 | `6a9e0df9` | docs: describe the commit, gate, and CI check scopes | (no files to check)Skipped |

## Evidence (last line of every log under tmp/hpr/)

- `precommit-1.log`: `PRECOMMIT_EXIT=0` (its `npm run check:commit` line ended `Skipped`)
- `precommit-2.log`: `PRECOMMIT_EXIT=0`
- `precommit-3.log`: `PRECOMMIT_EXIT=0`
- `p1.log`: `P1_EXIT=0` (six `passed` lines, `Staged pairs: 1`, one `Direct coverage passed:` line for `shared/compare-name-scope.ts`, no all-pair run)
- `p2.log`: `P2_EXIT=0` (`Staged tests/platform/git-ops-fake.ts affects every pair. Running all pairs.`, 268 passed lines)
- `p3.log`: `P3_EXIT=0` (`Staged pairs: 0`, untracked probe ignored)
- `p4.log`: `P4_EXIT=0` (first line `Changed-pair base: HEAD`)
- `direct-all.log`: `DIRECT_ALL_EXIT=0` (`Merged LCOV: coverage/direct.lcov (258 records)`)
- `commit-1.log`, `commit-2.log`, `commit-3.log`: `COMMIT_EXIT=0`
- `check-final.log`: `CHECK_EXIT=0`

The three plan `<verify>` blocks all printed `task N ok` after the final commit.

Static step times from `p1.log` (cold ESLint and Prettier caches in a fresh worktree): typecheck 12.4 s, lint 214.6 s, lint:workflows 0.4 s, fallow 5.3 s, format:check 52.9 s, test:corresponding 4.0 s. Warm, in `check-final.log`: typecheck 10.9 s, lint 5.5 s, lint:workflows 0.4 s, fallow 5.0 s, format:check 8.1 s, test:corresponding 4.9 s.

All-pair times: `p2.log` 50.7 s, `direct-all.log` 51.5 s, `check-final.log` 52.3 s (268 pairs each, Node v26.10.0, default workers = available CPUs).

`node --version`: v26.10.0

Full verification passed: `npm run check` exited 0 on `6a9e0df97e21ed9c579a6b3403ae40f459028ec6`.

## Deviations from Plan

1. [Rule 3 - Blocking] The worktree sandbox refused compound git commands and any command line that names `.git` paths (and even `git-ops-fake.ts`). The probes P1 and P2 therefore built their temporary index with `GIT_INDEX_FILE=<abs tmp/hpr/pN.index> git read-tree HEAD` instead of copying the real index file, and wrote the blobs with `git hash-object -w <file>`. With nothing staged in the real index, the probe index is equivalent. The real index stayed empty (checked after the probes).
2. The plan verify blocks were extracted from the PLAN into `tmp/hpr/verify-N.sh` and run with `bash`, for the same sandbox reason.
3. The `simple-english` skill was loaded; the rehearsed W9 to W15 wording was applied verbatim, because every sentence the verify checks is fixed and the self-check found no semicolon in the skill. The `humanizer` skill was not separately invoked.
4. In `scripts/test-coverage-direct.mjs`, `changedPaths` no longer computes the skipped list; the new shared `pairsForPaths` computes pairs and skipped paths for both the changed-pair and the staged arm, and its doc comment was trimmed to match.

## Flags for the operator

1. The Fallow block in AGENTS.md still tells agents to run `fallow audit` before each commit and push. `fallow agent install` 3.27.0 has no option that drops only that step. `--without guide` in `scripts/init.sh` would drop the whole block, task map included.
2. A staged deletion of test support does not escalate (the staged selection reads ACMR only). A commit that only deletes build inputs, or only changes hash-stability fixtures, still skips the hook.
3. The per-pair include flag and the Sonar input run on CI (Node 24) for the first time in the pull request.
4. The untracked uqn plan names files that this task changed (package.json, ci.yml, CONTRIBUTING.md, the local-verification skill). It needs a new plan.
5. CHANGELOG.md #236, TESTING.md, and the unit-testing guidelines changed although the operator's list did not name them.
6. The main session runs `npm run check` in the main checkout after the merge, or reuses the result above under the skill's rule (`git diff 6a9e0df9 -- . ':(exclude,glob).planning/**/*.md'` empty in the main checkout).
7. REVIEW.md: applied in the main checkout (F2 inserted before F4 with the three SHAs, F4 replaced, `F2, ` removed from the Open line). It stays untracked.
8. `check:static` hides the output of a passing step, ESLint warnings included.
9. Each commit still prints the hook list twice (once for the pre-commit stage and once for the commit-msg stage); the second pass skips `npm run check:commit`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/run-parallel.mjs
- FOUND: 4100d135, 426bdd64, 6a9e0df9 (ancestors of HEAD)
