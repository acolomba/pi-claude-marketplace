---
phase: 10-github-source-kind-and-suite-close
plan: "05"
subsystem: testing
tags: [cucumber, github-source, suite-close, LAYER-07, ADD-11, UPD-12, SRC-02, SRC-03]
status: complete

requires:
  - phase: 10-github-source-kind-and-suite-close
    provides: "10-01..10-04: the github kind through the base override, the git host fix, refs and the shorthand, the 401 rows; 46 @github rows passing under a scratch config"
provides:
  - "cucumber.json with no tags key: every @github row runs in the default profile (429 scenarios)"
  - "The cucumber rules (features.md, SKILL.md) describe the closed state and name PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL"
  - "10-05-RED.json: the three LAYER-07 user-scope remove Outlines' @github rows red on a reused user-scope record, RED_EVIDENCE_OK for each"
affects: [10-06, 10-07]

actuals:
  tokens: 5240
  tasks: 2
  commits: 1
plan_head_before: dbc59f576b50c2725737033a833d7af5af25dc76
plan_head_after: 26fe07d21278cc5079f5a6c05f6df0cb70199aae

tech-stack:
  added: []
  patterns:
    - "Closing a source kind's exclusion is the one-line removal of the cucumber.json tag expression; no source-walk check replaces it (D-07)"

key-files:
  created:
    - .planning/phases/10-github-source-kind-and-suite-close/10-05-RED.json
  modified:
    - cucumber.json
    - .agents/skills/cucumber/rules/features.md
    - .agents/skills/cucumber/SKILL.md

key-decisions:
  - "The SKILL.md review paragraph keeps the check:features requirement and now justifies it by the layout and feature-file rules the usage report does not check, and by its dry run holding if a future profile excludes a tag again"
  - "features.md keeps the Examples-only tag rule and restates its reason: a feature or scenario tag would tag the local rows too, so excluding that tag would drop them"

patterns-established:
  - "A future source kind without a stand-in excludes its tag in cucumber.json, and the work that adds the stand-in removes the exclusion"

requirements-completed: [ADD-11, UPD-12, SRC-02, SRC-03]

duration: 5min
completed: 2026-10-21
---

# Phase 10 Plan 05: Suite close Summary

**`cucumber.json` no longer excludes `@github`, so all 429 scenarios run and pass in the default profile, 46 of them github rows. The usage report finds no unused step. The three LAYER-07 user-scope remove Outlines' github rows fail when a project install reuses a copy of the user-scope record, and they pass on the current code.**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-10-21T15:00Z
- **Completed:** 2026-10-21T15:05Z
- **Tasks:** 2
- **Files modified:** 3 (plus the RED record)

## Accomplishments

- SC1 / D-07: the `tags` key is gone from `cucumber.json`. The other keys are unchanged and no source-walk check was added (`git diff --quiet 3bc84b58 -- scripts` exits 0).
- SC1: `npm run test:cucumber` reports `429 scenarios (429 passed)`, and `npm run test:cucumber -- --tags @github` reports `46 scenarios (46 passed)`. The CLI `--tags` now selects the github rows alone, because no profile expression is ANDed with it.
- SC4: `npx cucumber-js --dry-run --format usage` exits 0, and its output contains no `UNUSED`, `undefined`, or `ambiguous`. `npm run check:features` passes.
- The rule texts describe the closed state. `features.md` says no tag is excluded and the github kind reaches the run's git host through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`. `SKILL.md` no longer says the usage report honors an exclusion.
- SC5: the red run and the green run are recorded in `10-05-RED.json` (see below).

## Task Commits

1. **Task 1: Remove the tag exclusion and run every github row in the default profile:** `26fe07d2` (test)
2. **Task 2: SC5 red proof:** no code commit. The local edit was never staged, and the RED record is committed with this SUMMARY.

## SC5 Evidence

- **Precondition:** `grep -c '"tags"' cucumber.json` printed 0. `git diff --quiet 63d05924 -- extensions/pi-claude-marketplace/orchestrators/plugin/` exited 0, before the edit and again after the restore. So the record in `09-08-RED.json` that the `f78907bf` plant crashes in its `Given` install still applies, and the plant was not retried.
- **Local edit:** `git apply` of the `diff` field of `09-08-RED.json`. It changes only `resolveTargetScopeMarketplace` in `install-outcome.ts`: the final `return addTargetScopeMarketplace(...)` becomes a copy of `source.sourceRecord` with `scope: opts.scope` and `plugins: {}`, stored with `setOwn` and returned.
- **RED command:** `npm run --silent test:cucumber -- features/marketplace/remove.feature features/plugin/cross-scope-install.feature --parallel 1 --tags @github --format summary --format junit:<scratchpad>/10-05-red.xml`. Exit 1, `6 scenarios (3 passed, 3 failed)`, `59 steps (54 passed, 2 skipped, 3 failed)`.
- **Failing (each at `Then the result has these fields:`, after every Given and When passed):**
  - `remove.feature:690` `Removing a marketplace from the user scope keeps the plugins the project installed from it - #3.1`: severity `error` instead of `info`, summary `A marketplace operation has failed.` instead of a tally success count of 1.
  - `remove.feature:730` `... keeps the info of a plugin the project installed from it - #3.1`: severity `error`, summary `A plugin operation has failed.` instead of the plugin's components.
  - `remove.feature:762` `... keeps the marketplace updatable in the project scope - #3.1`: severity `error`, summary `Some operations have failed.`
- **Passing:** the two `@github` rows of `Removing an empty marketplace needs no reload` (#3.1, #3.2) and the `@github` row of the cross-scope install Outline (#3.1).
- **No** Pi start error, internal error, load fault, or undefined step.
- **Classifier:** `node .claude/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence` on one temporary copy per failing testcase name gave `RED_EVIDENCE_OK` (`target_test_failed`) for all three. The copies were deleted, and the committed record also classifies `RED_EVIDENCE_OK`.
- **Restore:** `git checkout -- extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, then `git diff --quiet -- extensions` exited 0.
- **GREEN:** the same command without the junit format: exit 0, `6 scenarios (6 passed)`, `59 steps (59 passed)`.

## Verification Evidence

`node --version`: v26.11.1. Commit under test: `26fe07d2`.

| Command | Task | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:cucumber` | 1 | 0 | `429 scenarios (429 passed)`, `3952 steps (3952 passed)` |
| `npm run test:cucumber -- --tags @github` | 1 | 0 | `46 scenarios (46 passed)`, `442 steps (442 passed)` |
| `npx cucumber-js --dry-run --format usage` | 1 | 0 | no `UNUSED`, `undefined`, or `ambiguous` |
| `npm run check:features` | 1 | 0 | passed |
| `SKIP=npm-check pre-commit run --files cucumber.json .agents/skills/cucumber/rules/features.md .agents/skills/cucumber/SKILL.md` | 1 | 0 | every hook passed or skipped |
| commit hook (`npm run check:commit`) | 1 | 0 | passed |
| SC5 RED run (local edit) | 2 | 1 | `6 scenarios (3 passed, 3 failed)` |
| SC5 GREEN run (restored) | 2 | 0 | `6 scenarios (6 passed)` |
| `git diff --quiet -- extensions` | 2 | 0 | clean |

Acceptance greps: `"tags"` in `cucumber.json` 0; `"parallel": 8` 1; `not @github` in `cucumber.json` and `features.md` 0 and 0; `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` in `features.md` 1; `honors the exclusion` in `SKILL.md` 0. `git status --short -- cucumber.json .agents` was empty after the commit.

The combined-tree `npm run check` runs after this wave (orchestrator).

## Flagged Assumptions (carried from the plan)

- 09-RESEARCH.md A1 and A4 (OpenSSL 3.0.13 and `git http-backend` on `ubuntu-latest`) are proven only when the branch is pushed and the PR's behavioral job runs (D-08: nothing is pushed in this phase).
- ROADMAP SC4 still names a source-walk check that D-07 dropped. The verifier reads SC4 with D-07.

## Deviations from Plan

None - plan executed exactly as written. The scenario counts after the 10-04 gap commits matched the plan (429 and 46).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Every row now runs in every check. Plans 10-06 and 10-07 can read the default profile as the whole suite.

## Self-Check: PASSED

- FOUND: cucumber.json, .agents/skills/cucumber/rules/features.md, .agents/skills/cucumber/SKILL.md, .planning/phases/10-github-source-kind-and-suite-close/10-05-RED.json
- FOUND: 26fe07d2 (ancestor of HEAD)
- No temporary RED copy in the phase directory; `git diff --quiet -- extensions` exits 0.
