---
phase: 08-workflow-agents-and-run-paths
plan: "07"
subsystem: workflows
tags: [workflows, agents, notes, output-catalog]
status: complete
requires: ["08-02"]
provides:
  - "The output-catalog state installed-with-workflow-missing-agent-note, with its catalog-uat fixture"
affects: []
tech-stack:
  added: []
  patterns: ["catalog bytes copied from the renderer's output of the fixture"]
key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/plugin-info.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
decisions:
  - "D-PG8-06 as refined: the missing-agent note gets one `info` catalog state; the PG-SEC-01 note gets none."
metrics:
  duration: "about 15 minutes"
  completed: 2026-11-14
estimate:
  tokens: 26000
  tasks: 1
actuals:
  tokens: 1900
  tasks: 1
  commits: 1
plan_head_before: feeee98c0be256f218935ed155d000b47c8d8bcb
plan_head_after: 1eb23974
---

# Phase 8 Plan 07: Catalog state of the workflow missing-agent note Summary

docs/output-catalog.md now documents, byte for byte, the `info` row for a workflow script that runs an agent type its plugin does not install, and a catalog-uat fixture renders those bytes.

## Commit

- `1eb23974` docs(workflows): catalog the info note for a missing agent type (5 files, +53 -7). The commit hook ran without `--no-verify`; `SKIP=npm-check pre-commit run --files <5 paths>` passed before it.

## The new state

Section `/claude:plugin info <plugin>@<marketplace>`, directly after `installed-with-workflow-gate-note`, heading `### Success -- a workflow script that runs an agent type the plugin does not install (PG-WF-02)`. The paragraph says: one `note:` line per pair of a script and an agent type the plugin does not install; the line is the text the install diagnostic shows (install, update and `info` print the same words); the folder shows as its name alone; at most five such lines per script and then one count line; severity `info`. It does not call the wording future tense.

Documented row (copied from the renderer's output, via a PLACEHOLDER run of the contract test):

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    skills: commit-summary
    workflows: commit-commands:changelog
    requires: pi-dynamic-workflows
    note: workflow script "changelog.js" in "workflows" runs agent type "commit-commands:reviewer", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run
```

The fixture is a copy of `installed-with-workflow-preview-note` with only `notes` changed, and a comment citing PG-WF-02 and D-PG8-05 (no tense).

## Pinned counts, before and after

| Pin | Before | After |
| --- | --- | --- |
| catalog-contract `EXPECTED_STATE_COUNT` and test title | 324 | 325 |
| catalog-contract `EXPECTED_UTF8_BYTES` | 54_553 | 55_017 (+464, the UTF-8 length of the new example) |
| catalog-contract `EXPECTED_MODULE_COUNT` / `EXPECTED_SECTION_COUNT` | 22 / 22 | 22 / 22 |
| catalog-parser title and `examples.length` | 324 | 325 |
| catalog-wire `PRESENTED.length` | 337 | 338 |
| catalog-wire emitted key set size | 324 | 325 |

## Verification

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/architecture/catalog-uat/*.test.ts"`: 78 tests, 78 pass, 0 fail.
- The seven other catalog readers (partial-vocabulary-guard, compat-01-no-expansion, background-update-notice, hooks-notice-notify, hooks-cap-notify, mcp-config-notices, mcp-migration-notice): 112 tests, 112 pass.
- Drift check: the text after the agent type in the documented note line occurs in features/workflow/agent-types.feature (pass).
- `git diff --quiet HEAD -- extensions features`: clean. The catalog and fixture diffs removed no lines.
- `npm run check` not run (orchestrator's wave gate).

## Red run

Mutation in the working tree only: in docs/output-catalog.md, `"commit-commands:reviewer"` became `"commit-commands:reviewes"` in the new row. `node --import ... --test test/architecture/catalog-uat/catalog-contract.test.ts` failed: `catalog contract matches all 22 fixture modules to 325 exact documented states` with `AssertionError [ERR_ASSERTION]: byte-mismatch: /claude:plugin info <plugin>@<marketplace>::installed-with-workflow-missing-agent-note`. Restoration: copied the saved catalog back; the catalog-uat run returned to 78/78 pass. No mutation was committed.

## Landed text vs the plan's interfaces block

No difference. The note text, the count line wording, and the limit of five notes per script that 08-02 landed (`MISSING_AGENT_NOTE_LIMIT = 5`, commit `b8ac6d91`) match the interfaces block.

## Flagged assumptions (carried from the plan)

- The catalog state has a plan of its own (a reading of D-PG8-16, pending the maintainer's review).
- One task, because the fixture, the state, and the counts must change in one commit.
- Only an `info` state; the PG-SEC-01 note still has no catalog state (not added).
- The note text and the limits are 08-02's planner proposal, pending review; if they change, the fixture, the row, the paragraph, and the byte total change with them.
- The fixture's script `changelog.js` and agent type `commit-commands:reviewer` are the planner's choice.

## Deviations from Plan

None - plan executed exactly as written.

## Parent lines

- BACKLOG: the PG-SEC-01 note has no output-catalog state (D-PG8-06 as refined).
- For the maintainer's review with the other D-PG8 decisions: the reading of D-PG8-16 that put the catalog state in a plan of its own, after plan 08-02, instead of a third task of 08-02.
- No CHANGELOG line: 08-02 carries the note's line, and this plan changes nothing a user sees.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-24: the row is the renderer's output and the contract test compares it on every run; the drift check matched the feature file. T-08-25: each count moved by one and the bytes by 464; module and section counts stay 22. T-08-26: the fixture names the folder `workflows` alone. T-08-SC: no package installed or changed. Every test ran under `test/platform/isolated-pi-home.ts`.

## Self-Check: PASSED

- FOUND: commit 1eb23974 (ancestor of HEAD)
- FOUND: `catalog-state: installed-with-workflow-missing-agent-note` in docs/output-catalog.md
- FOUND: `installed-with-workflow-missing-agent-note` and `commit-commands:reviewer` in fixtures/plugin-info.ts
