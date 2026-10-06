---
phase: 261004-rpt
plan: 01
subsystem: build-verification
tags: [ci, pre-commit, check-changed, prettier, allowlist]
status: complete
requires: []
provides:
  - "One build-input allowlist shared by the ci.yml push/pull_request paths filters and scripts/check-changed.mjs isBuildInput"
  - "Prettier (format, format:check, pre-commit hook, isFormatted) scoped to the JavaScript, JSON, and TypeScript build inputs"
affects:
  - .github/workflows/ci.yml
  - scripts/check-changed.mjs
  - package.json
  - .pre-commit-config.yaml
tech-stack:
  added: []
  patterns:
    - "Allowlist of build inputs mirrored in two places, each comment naming the other"
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - scripts/check-changed.mjs
    - package.json
    - .pre-commit-config.yaml
    - CHANGELOG.md
    - CONTRIBUTING.md
    - skills/local-verification/SKILL.md
    - docs/unused-type-member-gate.md
decisions:
  - "D-01: CI push/pull_request triggers and the commit-time selector trigger from one allowlist of build inputs; non-build files start no CI run and select no commit-time check"
  - "D-02: Prettier (npm scripts, pre-commit hook, selector isFormatted) covers only the JavaScript, JSON, and TypeScript build inputs"
  - "demos/**/*.ts and .gitattributes are build inputs (Fallow analyzes demos/browse-demo.ts; actions/checkout applies .gitattributes)"
metrics:
  duration: "~10 min"
  completed: 2026-10-04
actuals:
  tokens: 5900
  tasks: 3
  commits: 3
plan_head_before: fc781fedf218262cb8e50f7b2d3bb031b2fb021a
plan_head_after: ac2abb3c
---

# Quick Task 261004-rpt: Build-input allowlist for CI and local checks Summary

CI's push and pull_request triggers and the commit-time selector `scripts/check-changed.mjs` now share one 24-entry allowlist of build inputs (the files an npm build or CI job reads), replacing the `paths-ignore` denylist and the selector's "unknown input -> broad" fallback for non-build files; Prettier is narrowed to the same inputs (866 -> 733 files).

Implements D-01 (one allowlist of build inputs for CI and the commit-time selector) and D-02 (Prettier covers only those inputs), plus C-01 (docs describe the allowlist).

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | a1089e56 | perf(checks): run checks only when a build input changes |
| 2 | 400b8f43 | perf(checks): limit Prettier to build inputs |
| 3 | ac2abb3c | docs: describe the build-input allowlist |

Start commit: fc781fed. `git diff --name-only fc781fed HEAD -- . ':(exclude).planning'` lists exactly the eight `files_modified` paths.

## Pre-commit runs

All on branch `features/faster-precommit`, main checkout, Node v26.10.0, run in the foreground before the commit (the tree then equalled the commit's content).

| Task | Command | Exit | Commit | Scope / commands | durationMs | exitStatus | lockWaitMs |
| ---- | ------- | ---- | ------ | ---------------- | ---------- | ---------- | ---------- |
| 1 | `pre-commit run --verbose --files .github/workflows/ci.yml scripts/check-changed.mjs` | 0 | a1089e56 | broad ("Broad check required by .github/workflows/ci.yml, scripts/check-changed.mjs"): format:check, typecheck, lint, lint:workflows, fallow, test:corresponding | 76376 | 0 | 2 |
| 2 | `pre-commit run --verbose --files package.json .pre-commit-config.yaml scripts/check-changed.mjs` | 0 | 400b8f43 | broad ("Broad check required by package.json, scripts/check-changed.mjs"); `.pre-commit-config.yaml` selected nothing | 26396 | 0 | 1 |
| 3 | `pre-commit run --verbose --files CHANGELOG.md CONTRIBUTING.md skills/local-verification/SKILL.md docs/unused-type-member-gate.md` | 0 | ac2abb3c | focused ("Documentation"): test:architecture | 5754 | 0 | 0 |

All hooks passed on every run (check-yaml, yamllint, yamlfmt, zizmor, prettier, mdformat/markdownlint where applicable, npm changed checks). No hook rewrote a file. Each commit message passed `pre-commit run gitlint --hook-stage commit-msg`.

Fallow audit (`npx fallow audit --format json --quiet --explain --gate-marker agent`) before each commit: Task 1 `pass`, Task 2 `pass`, Task 3 `pass`.

## Harness and scope proofs

- `tmp/rpt/scenarios-task1.log` (commit a1089e56): `all 24 scenarios match; CI ignores 3939 of 4729 tracked files`
- `tmp/rpt/scenarios-task2.log` (commit 400b8f43): `all 24 scenarios match; CI ignores 3939 of 4729 tracked files`
- `tmp/rpt/scenarios-final.log` (commit ac2abb3c): `all 24 scenarios match; CI ignores 3939 of 4729 tracked files`
- `prettier-scope.mjs`: `Prettier scope: 866 -> 733 files; dropped 133 under .pi, .planning, .sonarlint, .vscode, gsd-capabilities`
- `npm run format:check` exited 0 after Task 2.
- Task 3 verify, including `tests/architecture/no-stale-test-citations.test.ts` (1 pass) and `git diff --quiet fc781fed -- .planning/codebase`, exited 0. Changelog #236 bullet: one bullet, 24 words.

The ignored-file count is 3939 rather than the 3937 measured at planning because `.planning/` gained two tracked files since; the dropped groups are unchanged.

Verification scope: focused task verification passed; full phase/PR verification pending (`npm run check` runs at PR handoff, per `skills/local-verification/SKILL.md`).

## Choices made within the decisions

1. `demos/**/*.ts` is a build input, against the coordinator's finding that `demos/` is unread: Fallow analyzes `demos/browse-demo.ts`, so a change there can fail `npm run fallow`. Other `demos/` files (GIFs, tapes, shell) stay out. Orchestrator confirmed.
2. `.gitattributes` is a build input: `actions/checkout` applies its eol and LFS rules to every file the jobs read. Orchestrator confirmed.
3. One list in two places: `isBuildInput` mirrors the ci.yml `paths` list entry for entry; each file's comment names the other.
4. Documentation is anything under `docs/` except `docs/adr/`, `docs/plans/`, `docs/research/`, plus `README.md` and `README.es.md`. `CHANGELOG.md` is no longer documentation and selects nothing.
5. `isFormatted` is `isBuildInput` intersected with the old extension rule.
6. Prettier root files are named explicitly, not `*.{js,json,ts}`.
7. `.prettierignore` unchanged.
8. The changelog line folds into the existing #236 bullet.
9. `docs/unused-type-member-gate.md` line 17 rewritten; line 19 kept.
10. `.pre-commit-config.yaml` is not a build input (the unfiltered `lint.yml` pre-commit job covers it). Orchestrator confirmed.

## Why line 19 of docs/unused-type-member-gate.md still holds

The gate script (`scripts/check-unused-type-members.mjs`) and helpers with a `tests/scripts` test are analyzer scripts and select `test:analyzers`. Other helper modules (`scripts/*.mjs`) and dependency or toolchain configuration (`package.json`, `tsconfig.json`, and so on) are build inputs that no finer rule claims, so they select the broad check. The contract and decision data (`scripts/check-unused-type-members.*.json`) are type-member data and run `lint:type-members` when the selection stays focused, and `broadPlan` clears `typeMembers`, so the broad check never runs the gate. Every file the line names is a build input, so the allowlist changes none of these outcomes (the harness `typeMembers` scenario confirms the contract-data case).

## Deviations from Plan

1. [Orchestrator decision] `skills/local-verification/SKILL.md` line 26: "CI runs it on pull requests." became "CI runs it on pull requests that change a build input." (in commit ac2abb3c). The plan listed this as out of scope; the orchestrator moved it in scope. I checked the other sentences in the four Task 3 files: "CI runs direct coverage for changed pairs on pull requests" (CONTRIBUTING.md line 60, SKILL.md line 20) stays true because changed pairs are build inputs, and gate-doc lines 7 and 19 ("in CI") stay true because every gate input is a build input.
2. [Process] Commit message files were written to the session scratchpad instead of `tmp/rpt/`, per the orchestrator's constraints.
3. [Process] The Task 2 gitlint pre-check was first refused by pre-commit because `.pre-commit-config.yaml` was unstaged at that moment, and a pipe masked the refusal, so the commit went ahead. I re-ran gitlint on both the message file and the committed message afterwards: both passed.

No DOC string needed rewording: every OLD string matched exactly.

## Follow-ups (out of scope, not edited)

- `.planning/codebase/STACK.md` line 40: Prettier scope described as `npm run format` / `format:check` over everything; now limited to build inputs.
- `.planning/codebase/STACK.md` line 92: "paths-ignore for docs/planning" on `ci.yml`; now a `paths` allowlist.
- `.planning/codebase/CONVENTIONS.md` line 33: format scope.
- `.planning/codebase/CONCERNS.md` lines 43-44: the docs `paths-ignore` concern, now resolved.
- `AGENTS.md` line 43: says CI runs `npm run check` on pull requests; it now runs only on pull requests that change a build input (orchestrator: do not edit AGENTS.md here).
- `.agents/skills/babysit-pr/SKILL.md` line 50: waits up to about 15 minutes for SonarCloud, which never runs on a pull request that changes no build input.
- Selector gap that predates this task: an `extensions/**/*.md` edit selects broad, which does not run `test:architecture`, although the stale-citation test polices extension Markdown.
- `.prettierignore` line 12 area: the comment on `.mcp.json` says the file is never committed; it is committed.
- `.pre-commit-config.yaml` line 105: the `npm-check-changed` comment says the full `npm run check` runs "in CI"; still true for build-input changes, but could name the condition.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All eight modified files exist and are in the diff from fc781fed.
- Commits a1089e56, 400b8f43, ac2abb3c exist on `features/faster-precommit` (`git rev-list --count fc781fed..HEAD` = 3).
- `git worktree list` shows no `tmp/rpt-wt` (the four sibling worktrees under `~/src/` predate this task); no `check-changed-full.lock` remains; `git status --short` lists only this task's `.planning/quick/` directory; `tmp/rpt/` removed after this SUMMARY.
