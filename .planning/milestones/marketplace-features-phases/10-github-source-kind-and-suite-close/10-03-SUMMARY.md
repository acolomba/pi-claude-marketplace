---
phase: 10-github-source-kind-and-suite-close
plan: "03"
subsystem: testing
tags: [cucumber, github-source, shorthand, refs, SRC-03, D-MF-07, IN-11]
status: complete

requires:
  - phase: 10-github-source-kind-and-suite-close
    provides: "10-01: the github kind through the base override; 10-02: the git host EPIPE fix"
provides:
  - "Every git publication keeps a `stable` branch at the commit of `main` (fast-forward pushes only)"
  - "pushGitBranch and describeMarketplaceBranch, and the step `the branch {string} of the marketplace {string} has the description {string}`"
  - "The info Outline's git rows at `#stable` (IN-11) and the url missing-ref scenario at `#missing`"
  - "The SRC-03 Outline `Adding a github marketplace at a ref clones that ref`, proven by content"
  - "parseShorthandSourceForm's `#` arm: `owner/repo#ref` adds at that ref; an empty `#` ref is no ref (D-MF-07)"
  - "10-03-RED.json with RED_EVIDENCE_OK; the CHANGELOG sub-bullet; the D-MF-07 row in PROJECT.md"
affects: [10-04, 10-05, 10-07]

actuals:
  tokens: 5000
  tasks: 3
  commits: 4
plan_head_before: 329fe8491de4a9b7240305897e038c0ca9b54408
plan_head_after: d9ccdfc588e6c6efbd60baf7951441157ba68d59

tech-stack:
  added: []
  patterns:
    - "A git-only fixture operation dispatches on the publication kind and throws for dir and file"
    - "A branch change starts from `main` (`checkout -B <branch> main`), pushes that branch alone, and returns to `main`"

key-files:
  created:
    - .planning/phases/10-github-source-kind-and-suite-close/10-03-RED.json
  modified:
    - features/lib/git-marketplace.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/marketplace/info.feature
    - features/marketplace/url-source.feature
    - features/marketplace/github-source.feature
    - extensions/pi-claude-marketplace/domain/source.ts
    - tests/domain/source.test.ts
    - CHANGELOG.md
    - .planning/PROJECT.md

key-decisions:
  - "The shorthand splits at the first `#` only when no `@` comes before it, so `acme/tools@v1#x` keeps D-76-04's last-`@` split and the ref `v1#x`"
  - "The `#` arm maps a left side that is not a valid owner/repo to unknown with nonRelativeReason, the same as the `@` arm"
  - "The CHANGELOG top line was reworded so it covers the new sub-bullet: `Adding a git marketplace now takes a #ref on the owner/repo shorthand, and a failed add gives a clearer reason and JSON row.`"

patterns-established:
  - "Refs are proven by content: the `stable` branch carries a description `main` lacks, and `marketplace info` shows both the ref and the description"

requirements-completed: [SRC-03]

duration: 10min
completed: 2026-10-21
---

# Phase 10 Plan 03: GitHub refs and the owner/repo#ref shorthand Summary

**`owner/repo#ref` now adds a github marketplace at that ref, shown red then green through a real Pi and by unit rows. Every git publication serves a `stable` branch beside `main`, so the info Outline's git rows prove a ref that is not the default branch (IN-11), and the new SRC-03 Outline proves the cloned branch by its description.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-21T14:23:15Z
- **Completed:** 2026-10-21T14:33Z
- **Tasks:** 3
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments

- D-03 / D-04 / IN-11: `publishGitRepository` pushes `main:stable` after the first publish. `pushGitRepository` pushes `main` and `main:stable` in one push. No push is forced, so a `stable` that a scenario moved away from `main` makes a later republish fail. The info Outline's `@url` row types `https://{git host}/acme/tools.git#stable` and its `@github` row `acme/tools#stable`. Both expect `source ref` `stable`. The feature description says the host's repositories carry `stable` beside `main` with the same files.
- The url missing-ref scenario keeps its title, its `source missing` failure, and its request log (`GET /acme/tools.git/info/refs?service=git-upload-pack 200`). It now types `#missing`.
- D-02: `pushGitBranch(workTree, home, branch, write)` runs `checkout -q -B <branch> main`, the write, `add -A`, `commit --allow-empty`, `push origin <branch>`, and `checkout -q main`. `describeMarketplaceBranch` throws `a dir publication has no branch` (or `file`) for a local publication and calls `pushGitBranch` for a git one. The step `the branch {string} of the marketplace {string} has the description {string}` calls it.
- SRC-03: the Outline `Adding a github marketplace at a ref clones that ref` runs `acme/tools@stable`, `acme/tools#stable`, and `https://github.com/acme/tools#stable`. In each row `main` says `Tools for formatting` and `stable` says `Stable tools`. Each add reports `tools project added`. `marketplace info` then shows `github / acme / tools`, ref `stable`, and the description `Stable tools`, so an implementation that clones `main` fails.
- SRC-03 / D-12: `parseShorthandSourceForm` splits at the first `#` when no `@` comes before it, through the private helper `parseShorthandHashRef`. The doc comment cites SRC-03, Claude Code 2.1.296, D-MF-07, D-76-04, and SP-5.
- D-12: the CHANGELOG has one sub-bullet for the shorthand `#ref`. `.planning/PROJECT.md` has the D-MF-07 row after D-MF-06, with the outcome `— Pending`.

## Task Commits

| Commit | Type | Content |
|--------|------|---------|
| `3323f1a8` | test | Task 1: the `stable` branch on every git publication, the info rows at `#stable`, and the missing-ref row at `#missing`. **This commit fixes IN-11** (plan 10-07 cites it in the Phase 9 ledger). |
| `9ed41788` | fix | Task 2: the `#` arm of the shorthand parser, the unit rows, the branch helper and step, and the SRC-03 Outline, all in one commit |
| `f24240d3` | docs | Task 3: the CHANGELOG sub-bullet |
| `d9ccdfc5` | docs | Task 3: the D-MF-07 row in `.planning/PROJECT.md` |

**Plan metadata:** the `docs(planning)` commit that follows this SUMMARY, with `10-03-RED.json`.

## RED Evidence (D-12, on the unchanged parser)

Precondition: `git diff --quiet 3bc84b58 -- extensions/pi-claude-marketplace/domain/source.ts` exited 0.

**Cucumber.** Command: `npm run --silent test:cucumber -- features/marketplace/github-source.feature --parallel 1 --name '^Adding a github marketplace at a ref clones that ref$' --format summary --format junit:<scratchpad>/10-03-red.xml`. Exit 1. `3 scenarios (2 passed, 1 failed)`, `30 steps (26 passed, 3 skipped, 1 failed)`.

| junit testcase | Source | Result |
|----------------|--------|--------|
| `- #1.1` | `acme/tools@stable` | pass |
| `- #1.2` | `acme/tools#stable` | **fail** at `Then the result has these fields:`: severity `error`, not `info`, with the summary `Some operations have failed.` |
| `- #1.3` | `https://github.com/acme/tools#stable` | pass |

`node .claude/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence <copy> --raw` on a copy whose `targetTest` was `Adding a github marketplace at a ref clones that ref - #1.2` gave `RED_EVIDENCE_OK` (`target_test_failed`, tests 3, pass 2, fail 1). The copy was deleted. The verdict is recorded in `10-03-RED.json` under `classifierVerdicts`. The failing step does not print the row's reasons. The research measurement for the same input was `source missing` with `GET /acme/tools 404`.

**Unit.** `node --test tests/domain/source.test.ts` on the unchanged parser: exit 1, `ℹ tests 167`, `ℹ pass 164`, `ℹ fail 3`.

| Row | Before the fix | After the fix |
|-----|----------------|---------------|
| parses an owner and repository shorthand with a # reference (`acme/tools#stable`) | **fail** | pass |
| reads an empty # reference on the shorthand as no reference (`acme/tools#`) | **fail** | pass |
| keeps an @ after the first # in the shorthand reference (`acme/tools#x@y`) | **fail** | pass |
| keeps a # after the first @ in the shorthand reference (`acme/tools@v1#x`, D-76-04) | pass | pass |
| rejects a # reference without an owner and repository pair (`acme#x`) | pass | pass |
| rejects an empty @ reference on the shorthand (`acme/tools@`) | pass | pass |

## Verification Evidence

Tools: Node `v26.11.1`, git `2.55.0`.

| Command | When | Exit | Result |
|---------|------|------|--------|
| `npm run test:cucumber -- features/marketplace/info.feature features/marketplace/url-source.feature --parallel 1` | Task 1 | 0 | `21 scenarios (21 passed)` |
| `npm run test:cucumber` | Task 1 | 0 | `379 scenarios (379 passed)`, `3471 steps (3471 passed)` |
| `@github` triage (scratch config, relative path) | Task 1 | 1 (expected) | `39 scenarios (38 passed, 1 failed)`. The failure is only `Info shows the source identity and description # features/marketplace/info.feature:44`, at `Given the user has run "/claude:plugin marketplace add acme/tools#stable --scope project"`. No request log or other row changed because of the second branch. |
| `node --test tests/domain/source.test.ts` | Task 2 | 0 | `ℹ tests 167`, `ℹ fail 0` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts` | Task 2 | 0 | 100% lines, branches, functions (branches 210/210, functions 35/35, lines 808/808) |
| `npm run test:cucumber -- features/marketplace/github-source.feature --parallel 1` | Task 2 | 0 | `9 scenarios (9 passed)` |
| `npm run test:cucumber` | Task 2 | 0 | `382 scenarios (382 passed)`, `3501 steps (3501 passed)` |
| `@github` triage | Task 2 | 0 | `39 scenarios (39 passed)`, `382 steps (382 passed)` |
| `npm run check:features` | Task 2 | 0 | no "Feature gate failed" |
| `SKIP=npm-check pre-commit run --files CHANGELOG.md .planning/PROJECT.md` | Task 3 | 0 | every hook Passed (mdformat, markdownlint-cli2, smartquotes, dashes) |
| Commit hook `npm run check:commit` | Tasks 1 and 2 | 0 | Passed, no `--no-verify` |

The triage command: `cfg="<scratchpad>/10-03-cucumber-github.json"` holding `{"default":{"import":[...],"format":["summary"],"order":"random","tags":"@github","parallel":4}}`, run as `npx cucumber-js -c "$(realpath --relative-to=. "$cfg")"`.

Acceptance greps: `main:stable` in `git-marketplace.ts`: 2. A force-push pattern: none. `acme/tools.git#stable` and `acme/tools#stable` in `info.feature`: 1 each. `acme/tools.git#missing` in `url-source.feature`: 2. `D-MF-07` in `source.ts`: 2. `acme/tools#stable` in `source.test.ts`: 2. The branch step text: 1. The Outline title: 1. `owner/repo#` under `## [Unreleased]`: 1. `Unreleased` top-level bullets: 14. The D-MF-07 row: 1, on the line after D-MF-06. `git status --short -- extensions tests features` was empty after the fix commit.

## Flagged Assumptions (carried from the plan)

- `SRC-03 / unclassified / unresolved`: the probe supplied no edge shape. The ref Outline is the manual-review target, and the description proves which branch was cloned.
- D-03's placement: every git publication keeps `stable` at `main`'s commit, so the info Outline keeps its local and git rows together. The cost is that the url missing-ref scenario types `#missing`.
- The `#` arm splits at the first `#` only when no `@` comes before it. Always splitting at the first `#` would change `acme/tools@v1#x` away from both D-76-04 and Claude Code.
- The ref after `#` is taken as typed (no trailing-slash stripping), as the `@` arm takes it. Only its empty case reads as no ref.

## Deviations from Plan

None in scope or code. Two small notes:

- The Task 2 commit's output was piped through `grep -v Skipped$` to shorten it. The commit ran in the foreground and the hook passed (`npm run check:commit ... Passed`), so the verdict was not hidden. Later commits were not piped.
- The plan's expected triage line was written `39 scenarios (1 failed, 38 passed)`. Cucumber prints the same counts as `(38 passed, 1 failed)`.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 10-04. The `@github` rows now pass 39 of 39 under the scratch config. `cucumber.json` still runs `not @github`.

## Self-Check: PASSED

- FOUND: `features/lib/git-marketplace.ts`, `features/lib/published-marketplace.ts`, `features/step_definitions/marketplace/publishing.steps.ts`, `features/marketplace/github-source.feature`, `extensions/pi-claude-marketplace/domain/source.ts`, `tests/domain/source.test.ts`, `.planning/phases/10-github-source-kind-and-suite-close/10-03-RED.json`
- FOUND commits: `3323f1a8`, `9ed41788`, `f24240d3`, `d9ccdfc5`
