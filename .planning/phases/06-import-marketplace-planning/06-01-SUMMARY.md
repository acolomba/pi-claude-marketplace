---
phase: 06-import-marketplace-planning
plan: 01
subsystem: cucumber harness
status: complete
tags: [cucumber, rollback, run-tokens, MIM-03]
requires: []
provides:
  - "Given: the published plugin {string} of the marketplace {string} has a read-only skill directory"
  - "error token {read-only skill directory removal error}"
  - "run-token projection over JSON cells (rollback partial)"
  - "path-cut variant projection for every error token"
affects: [06-04, 06-05]
tech-stack:
  added: []
  patterns:
    - "A Given registers its write-permission restore release before anything becomes read-only"
key-files:
  created: []
  modified:
    - features/lib/published-marketplace.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - features/lib/field-rows.ts
    - features/lib/run-tokens.ts
    - features/plugin/install-rollback.feature
    - .agents/skills/cucumber/rules/features.md
decisions:
  - "A skills undo that cannot finish leaves the skill staged; the install scenario pins that leftover instead of claiming an empty scope"
  - "cutQuotedPaths lives in run-tokens.ts and the fixture reproductions reuse it"
metrics:
  duration: "20m"
  completed: 2026-10-26
estimate:
  tokens: 55000
  tasks: 2
actuals:
  tokens: 4500
  tasks: 2
  commits: 3
plan_head_before: 26d795a9b3cb91259d1e360a6f71933e53ba405c
plan_head_after: 635c03606585d12dc136d6d02d3b2c02a1fece03
---

# Phase 06 Plan 01: Read-only skill fixture and rollback-row projection Summary

A read-only skill subdirectory makes the real skills undo fail with EACCES on unlink. Run tokens now project over JSON cells and over the path-cut form of each error message. A new install scenario pins install's per-phase `(failed) {rollback partial}` row.

## What was built

- `features/lib/published-marketplace.ts`
  - `publishReadOnlySkillDirectory` creates `plugins/<plugin>/skills/<plugin>-skill/read-only/data.txt` and sets the directory to `0o555`. It refuses url and github publications.
  - `readOnlySkillRemovalError` copies the skill with the skills bridge's `cp` options, removes the copy with `rm({recursive, force})`, and returns the error with each quoted path cut.
  - `restoreDirectoryWrites` adds owner write to every directory under the given roots. It does not follow symlinks.
  - The shared `copySkill` helper also backs `unreadableSkillCopyError`. Without it, fallow dupes failed on the commit hook.
- `features/step_definitions/plugin/publishing.steps.ts`: new Given `the published plugin {string} of the marketplace {string} has a read-only skill directory`. It records the token **`{read-only skill directory removal error}`**, which has the value `EACCES: permission denied, unlink 'data.txt'`.
- `features/lib/field-rows.ts`: `cell` projects a non-string value through `projectTokens(key, JSON.stringify(value), tokens)`.
- `features/lib/run-tokens.ts`: `projectTokens` replaces each recorded error message, then its `cutQuotedPaths` form, with the token. No second token is recorded. The exported `cutQuotedPaths` is the one cut helper used by both modules.
- `features/plugin/install-rollback.feature`: new scenario "An install whose skills rollback cannot finish names the skills phase". The description no longer says the feature runs as root.
- `.agents/skills/cucumber/rules/features.md`: the error-token bullet now describes the path-cut form.

## Release order the Given uses

Releases run most recent first. The Given registers:

1. The scratch-directory removal (`mkdtemp` under `{home}`).
2. `restoreDirectoryWrites([home, agentDir, projectDir])`. This happens before anything becomes read-only.

At teardown, the restore runs first. Then the scratch removal runs, then the marketplace removal from the earlier publish step, then the rest. A second run of the scenario passed, and so did the full feature in random order. The next Before hook therefore empties the sandbox without EACCES.

## RED run (before the field-rows change)

`npx cucumber-js --name 'skills rollback cannot finish'` failed on the `rollback partial` cell. The cell held the raw sandbox path:

```
- "[{\"phase\":\"skills\",\"cause\":{\"causeChain\":[\"EACCES: permission denied, unlink '/tmp/pi-cm-features-itI0p1/project/.pi/pi-claude-marketplace/resources/skills/demo-skill/read-only/data.txt'\"],\"truncated\":false}}]"
+ "[{\"phase\":\"skills\",\"cause\":{\"causeChain\":[\"EACCES: permission denied, unlink '{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-skill/read-only/data.txt'\"],\"truncated\":false}}]"
```

After the change, the scenario passed. The Task 2 node check also failed at HEAD with an `AssertionError` and passed after the change.

## Verification

- `npx cucumber-js features/plugin/install-rollback.feature features/plugin/update-rollback.feature`: 9 scenarios passed.
- `npx cucumber-js --name 'second dependency move fails lists the move that landed'`: 1 scenario passed.
- All features that use an error token passed: install-dependencies, import, install-rollback, update-rollback, marketplace/update, and apply.
- Both node checks from the plan passed. `npm run check:features` was clean.
- The commit hook ran `npm run check:commit` (typecheck, lint, fallow, format, check:features) and it passed on both commits. mdformat and markdownlint passed on the features.md commit.
- Run on Node v26.12.1, uid 1000.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's closing step does not hold for this scenario**

- **Found during:** Task 1
- **Issue:** The plan ends the scenario with "Then the project scope has no installed plugins". The skills undo is the step that fails, so `demo-skill` stays staged under `resources/skills`. That step therefore fails on `skills: ["demo-skill"]`.
- **Fix:** The scenario now ends with existing steps. The installation record of the project scope holds no plugins, and the project scope stages exactly `| skill | demo-skill |`. This pins the real leftover.
- **Files modified:** features/plugin/install-rollback.feature
- **Commit:** e72392ff

**2. [Rule 3 - Blocking] fallow dupes failed on the first commit attempt**

- **Found during:** Task 1 commit
- **Issue:** The new reproduction repeated the `cp` options and the path-cut block of `unreadableSkillCopyError`.
- **Fix:** Extracted `copySkill`. In Task 2, the path cut moved to the exported `cutQuotedPaths` in run-tokens.ts, and both reproductions reuse it.
- **Files modified:** features/lib/published-marketplace.ts, features/lib/run-tokens.ts
- **Commits:** e72392ff, 635c0360

## Observations for later plans

- The failed row shows `reasons: rollback partial` and an empty `leaks` cell, even though `demo-skill` stays staged. Plans 06-04 and 06-05 should expect the same cells for import and apply.
- Measured `commits: 3` counts sibling commit e1dbd1e0 (`fix(install): carry a failed dependency's rollback partials`, plan 06-02), which landed between this plan's base and head. This plan made 2 commits.

## Commits

- e72392ff: test(features): add a read-only skill directory fixture
- 635c0360: test(features): project path-free error tokens

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All 6 modified files exist and are committed.
- e72392ff and 635c0360 are ancestors of HEAD.
- Acceptance greps: `read-only skill directory removal error` 1, `0o555` 1, `projectTokens(key, JSON.stringify` 1.
