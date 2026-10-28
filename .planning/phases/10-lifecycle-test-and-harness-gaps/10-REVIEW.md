---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T04:04:16Z
depth: standard
files_reviewed: 89
files_reviewed_list:
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - features/lib/git-clones.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-tui-pty.py
  - features/lib/pi-tui.ts
  - features/lib/plugin-completions.ts
  - features/lib/run-tokens.ts
  - features/marketplace/add.feature
  - features/marketplace/background-update.feature
  - features/marketplace/failed-add.feature
  - features/marketplace/market-alias.feature
  - features/marketplace/update.feature
  - features/marketplace/usage-errors.feature
  - features/plugin/apply.feature
  - features/plugin/enable.feature
  - features/plugin/fetch.feature
  - features/plugin/git-source-update.feature
  - features/plugin/git-source.feature
  - features/plugin/import.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/install-rollback.feature
  - features/plugin/install.feature
  - features/plugin/list-filters.feature
  - features/plugin/list.feature
  - features/plugin/package-dependencies.feature
  - features/plugin/prune.feature
  - features/plugin/reinstall.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/completion.steps.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/marketplace/checkout.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/update.steps.ts
  - features/support/world.ts
  - scripts/check-features.mjs
  - scripts/check-phase10-coverage.mjs
  - test/architecture/https-git-host-server.test.ts
  - test/bridges/agents/stage.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/fetch.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/marketplace-seed.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/shared/git-failure-classifiers.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T04:04:16Z
**Depth:** standard
**Files Reviewed:** 89 (original review scope retained; seven changed files re-reviewed)
**Status:** clean
**Re-review commits:** `5dd94d67`, `2150ca02`
**Observed HEAD:** `727d32f5`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The original review/audit against `4ce415254e89c39c0257c78977f1c047838c0d8c` reported no dead-code, complexity, or duplication findings under the repository configuration.

Re-review ran `fallow audit --base 5dd94d67^ --max-crap 30 --format json --quiet`: exit 0, verdict pass. No introduced or worsened complexity findings, dead-code issues, or duplicate groups were reported. Three inherited complexity findings were reported with estimated coverage; these are retained as structural orientation, not new behavior or test-reliability findings. The earlier audit had not explicitly applied the max-CRAP-30 override.

## Narrative Findings (AI reviewer)

### Summary

No unresolved findings remain. The two prior blockers are fixed, and review of both complete fix diffs found no new issues. The original 89-file scope includes the phase task-commit union, all six requested outside-union files, and security fixes `d6c98433` and `689b4499`. This re-review inspected all seven source/test files changed by the two fixes, their surrounding contracts, and targeted runtime evidence; it did not repeat the original full-scope review.

CodeGraph was consulted for the reconcile call paths; current source was read where its index had drifted. Source repair now expands once at each initial-plan or replan boundary. Completion assertions compare the full ordered result, including labels, insertion values with trailing spaces, and descriptions, against explicit nonempty tables.

### Prior-findings disposition

| Prior finding | Prior severity | Disposition | Fix |
| --- | --- | --- | --- |
| CR-01: duplicate marketplace source replacements | BLOCKER | Resolved | `5dd94d67` removes the second source-repair expansion from `planFrom`. Initial and replanned paths each retain one expansion. |
| CR-02: empty completion provider passes both scenarios | BLOCKER | Resolved | `2150ca02` adds exact nonempty suggestion tables, validates insertion values and descriptions, and adds an eligible control plugin to the installed-version scenario. |

**CR-01 verification:** Independently ran the full `test/orchestrators/reconcile/read-pass.test.ts` owner suite: 36 tests passed, including the exact one-replacement normal-path assertion and the dependency-move replan case. An additional in-memory loader inserted a trace at the real `input.replan` invocation in `convergence.ts`; the dependency-move case emitted `REVIEW-REPLAN-EXECUTED` and passed its exact one-operation plan assertion. This confirms that the replan test actually reaches the callback.

Independently ran the named apply test `a source repair clones its replacement once and reports one added marketplace`: one test passed. Its exact assertions require one clone URL and one added-marketplace outcome. The public behavioral scenario `Apply downloads a replacement marketplace once` also passed, requiring exactly one hosted-manifest GET and one successful marketplace row.

**CR-02 verification:** Independently ran `Market exposes marketplace completions` and `Completion uses the installed git version` with the real provider. Both passed. The alias case requires all ten expected suggestions for each spelling, including the corresponding insertion prefixes and trailing spaces. The version case requires exactly `alpha@extras` and excludes `ghp@tools`; its insertion string and empty description are checked. The step uses deep equality of the full table, so extra or missing rows fail.

Repeated the original empty-provider mutation with a Node `registerHooks` loader that substitutes only the acceptance adapter with `export async function pluginCompletions(){return [];}`. Both scenarios failed at their expected completion-table assertions: exit 1, two failed scenarios, two failed steps (seed 750649). Repository source and tests were not edited.

### Verification record

- `node --test --test-reporter=spec test/orchestrators/reconcile/read-pass.test.ts`: exit 0; 36/36 tests.
- `node --test --test-reporter=spec --test-name-pattern 'a source repair clones its replacement once' test/orchestrators/reconcile/apply.test.ts`: exit 0; 1/1 test.
- Replan trace run using an in-memory loader and `--test-name-pattern 'APPLY1-01: a dependent held down'`: exit 0; callback observed; 1/1 test.
- Cucumber selection of both completion scenarios and the replacement-download scenario: exit 0; 3/3 scenarios, 36/36 steps (seed 215663).
- Empty-provider mutation against both completion scenarios: expected exit 1; 2/2 scenarios rejected.
- The parent supplied the combined gate result after both fixes: `npm run check` exit 0, static checks green, 1120/1120 scenarios, 11411/11411 steps, 304 direct LCOV; coverage ledger 56/56. This re-review did not rerun that full gate. `git diff 2150ca02 -- . ':(exclude,glob).planning/**/*.md'` was empty, and the worktree was clean before updating this report.

Only this report was changed. No implementation/test edits or commits were made.

---

_Reviewed: 2026-10-28T04:04:16Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
