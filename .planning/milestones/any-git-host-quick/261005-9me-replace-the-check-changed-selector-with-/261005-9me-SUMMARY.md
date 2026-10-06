---
phase: 261005-9me
plan: 01
subsystem: build-verification
tags: [pre-commit, npm-check, ci, docs]
status: complete
requires: []
provides:
  - npm-check pre-commit hook gated by the build-input pattern
  - one-gate verification contract in AGENTS.md, CONTRIBUTING.md, and the skills
affects:
  - .pre-commit-config.yaml
  - .github/workflows/lint.yml
  - package.json
  - skills/local-verification/SKILL.md
tech-stack:
  added: []
  patterns:
    - commit hook runs the whole gate when a staged file is a build input
key-files:
  created: []
  modified:
    - package.json
    - .pre-commit-config.yaml
    - .github/workflows/lint.yml
    - AGENTS.md
    - CONTRIBUTING.md
    - skills/local-verification/SKILL.md
    - skills/typescript-unit-testing/SKILL.md
    - skills/typescript-unit-testing-review/SKILL.md
    - CHANGELOG.md
  deleted:
    - scripts/check-changed.mjs
decisions:
  - The npm-check hook runs npm run check with no always_run, gated by a files pattern equal to both ci.yml paths lists.
  - The CI Lint job skips prettier,npm-check because it installs no node_modules.
metrics:
  duration: ~25 min
  completed: 2026-10-05
actuals:
  tokens: 12472
  tasks: 3
  commits: 3
plan_head_before: 744ab4fac39f9f7fd9134bab7b28a373c6e3939b
plan_head_after: ce686548e24ccfcd8c28d9e41e1b7d835b4b89d5
---

# Quick Task 261005-9me: Replace the check-changed selector with an npm run check pre-commit hook Summary

The commit-time selector (`scripts/check-changed.mjs`, its lock, run log, and `check:changed` script) is gone. A new `npm-check` pre-commit hook runs `npm run check` whenever a staged file is a build input, and its `files` pattern equals both `paths` lists in ci.yml over all 4,757 tracked paths and probes.

## Commits

| Task | Commit     | Title                                                     | Files                                                                                  |
| ---- | ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1    | `480cc59a` | chore(checks): run npm run check in the pre-commit hook    | D scripts/check-changed.mjs, M package.json, .pre-commit-config.yaml, .github/workflows/lint.yml |
| 2    | `42142810` | docs: describe the npm run check commit gate               | AGENTS.md, CONTRIBUTING.md, skills/local-verification/SKILL.md                          |
| 3    | `ce686548` | docs: update the testing skills and changelog for the gate | CHANGELOG.md, skills/typescript-unit-testing/SKILL.md, skills/typescript-unit-testing-review/SKILL.md |

Full SHAs: `480cc59a4c339f0de2a5df55e1d0a6ffa3804ff6`, `42142810a011bf6bdb38f24de3adeef1ff29b37d`, `ce686548e24ccfcd8c28d9e41e1b7d835b4b89d5`.

## Evidence

Last line of every `tmp/9me/*.log`:

| Log               | Last line            |
| ----------------- | -------------------- |
| skip-1.log        | `SKIP_PROBE_EXIT=0`  |
| precommit-1.log   | `PRECOMMIT_EXIT=0`   |
| commit-1.log      | `COMMIT_EXIT=0`      |
| precommit-2.log   | `PRECOMMIT_EXIT=0`   |
| commit-2.log      | `COMMIT_EXIT=0`      |
| sweep-3.log       | `SWEEP_EXIT=1` (no match) |
| precommit-3.log   | `PRECOMMIT_EXIT=0`   |
| commit-3.log      | `COMMIT_EXIT=0`      |

`npm check` line of each commit log (pre-commit stage):

- commit-1.log: `npm check....Passed`
- commit-2.log: `npm check....(no files to check)Skipped`
- commit-3.log: `npm check....(no files to check)Skipped`

Each commit log also shows a second `npm check ... (no files to check)Skipped` line. That is the commit-msg stage: hooks without `stages` are listed there too and match only the message file, so they skip. The old `always_run` hook would have run the selector a second time at that stage.

Fallow audit verdicts: Task 1 `pass`, Task 2 `pass`, Task 3 `pass`.

All three plan verify commands exit 0, and Tasks 1 and 2's verifies still pass after Task 3.

`node --version`: `v26.10.0`

Full verification passed: `npm run check` ran in the pre-commit hook of the Task 1 commit; Tasks 2 and 3 changed no build input.

### Final npm-check hook

```yaml
      - id: npm-check
        name: npm check
        entry: npm run check
        language: system
        pass_filenames: false
        files: '^(\.editorconfig|\.fallowrc\.json|\.gitattributes|\.gitignore|\.prettierignore|\.prettierrc\.json|eslint\.config\.js|package-lock\.json|package\.json|sonar-project\.properties|tsconfig\.json|(extensions|tests|\.github/workflows)/.*|scripts/.*\.mjs|demos/.*\.ts|docs/output-catalog\.md)$'
```

### Final #236 changelog entry (top line and new sub-bullet)

```markdown
- Internal: commits that add or edit a build input run `npm run check`, CI runs only on build-input changes, and ESLint alone bans stdio calls. (#236)

  - The `check:changed` script no longer exists.
```

## Deviations from Plan

None. The plan executed exactly as written, with the W1-W6 wording unchanged. mdformat and markdownlint passed with no rewrite.

## Flags for the operator

- The #234 changelog entry ("Internal: local checks now select changed modules and their consumers. GSD uses focused checks ...") still describes the selector. The plan scoped the changelog edit to #236.
- The untracked uqn plan (`.planning/quick/261004-uqn-quiet-the-build-and-lint-output-to-warni/`) lists `scripts/check-changed.mjs`, `package.json`, `ci.yml`, CONTRIBUTING.md, the local-verification skill, and CHANGELOG.md in `files_modified`. This task deleted or changed those files, so that plan needs a revision before it runs.
- `.planning/codebase/STACK.md` line 48 describes per-tool local hooks (`npm-lint`, `npm-format-check`, `npm-typecheck`, `npm-fallow`) that no longer exist. It does not name the selector, so it stayed.
- `check-changed.log` is still in the git common directory (`.git/check-changed.log`). It is untracked operator data and was left in place.
- The AGENTS.md Git section still tells agents to run `pre-commit run --files` before `git commit`. With this hook, a build-input commit now runs `npm run check` twice (once manually, once in the commit hook). That rule is the separate pending decision F4 and was left unchanged.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `scripts/check-changed.mjs` absent from HEAD; all nine modified files present.
- Commits `480cc59a`, `42142810`, `ce686548` exist on `features/faster-precommit`.
- `REVIEW.md` and the uqn plan remain untracked; no `.planning/` file is in any commit.
