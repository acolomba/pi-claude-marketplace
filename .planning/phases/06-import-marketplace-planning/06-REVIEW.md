---
phase: 06-import-marketplace-planning
reviewed: 2026-10-28T23:45:06Z
reviewed_commit: bd310b53dba3085115f68c77f028a05762a43608
depth: standard
review_scope_complete: true
files_reviewed: 38
files_reviewed_list:
  - .agents/skills/cucumber/rules/features.md
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/import/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - features/lib/field-rows.ts
  - features/lib/published-marketplace.ts
  - features/lib/run-tokens.ts
  - features/plugin/apply.feature
  - features/plugin/import.feature
  - features/plugin/install-rollback.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/import/marketplaces.test.ts
  - test/orchestrators/import/types.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/plan.test.ts
  - test/shared/redact-absolute-paths.test.ts
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-28T23:45:06Z

**Commit:** `bd310b53dba3085115f68c77f028a05762a43608`

**Depth:** standard

**Files reviewed:** 38, complete

**Status:** issues_found

## Summary

The current implementation has three actionable defects: import can silently omit a failed plugin when two settings entries encounter the same newly added source; apply drops recovery details after an enable leaves a partial rollback; and the shared redactor exposes absolute paths containing spaces or ordinary UNC prefixes.

This is a fresh review of current file contents. The minimum scope is the union of the previous report's actual 23 paths and the stale verification's source coverage, yielding 26 files. The review follows the extracted install-flow implementation into five modules and their five paired tests, and follows the extracted redaction functions into their owner and paired test, yielding 38 files. Every listed file was read completely. The original 14 paired orchestrator suites total 57,561 lines; their full reads were divided into non-overlapping slices with a test-only reviewer. The additional redactor suite was also read completely. CodeGraph was used first to locate implementation and call paths, followed by current file reads and targeted caller tracing. No listed file is git-ignored.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: An unchanged marketplace add can make an import failure disappear

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1404-1405`

**Related flow:** `execute.ts:761-797` (`marketplaceBlocks`), `execute.ts:1630` (`recordReusedMarketplace`), and `ensurePlannedMarketplaces`.

**Issue:** The unchanged add arm returns without recording a marketplace outcome, checking the returned canonical name, or blocking the requested name. The ensure loop continues using its original state snapshot. If an earlier entry in the same import just added that source, the later add returns `unchanged` with the earlier canonical name, although that name was absent from the read-pass snapshot.

Its plugin is then attempted under the later settings name and fails because that marketplace is not recorded. That failure is classified `unexpected-failure`. The notification builder creates missing headers only for `marketplace-not-added`, so the failed row has no header and is discarded. The displayed severity and tally report only successes.

**Confirmed reproduction:** Start with empty project state. Publish one local marketplace whose manifest name is `alpha` and which offers `p`. Put both `alpha` and `beta` in the settings, pointing to that same directory in that order, and enable `p@alpha` and `p@beta`. Run the real import, marketplace add, and install operations; only settings loading is supplied as a test seam. The returned result contains an unexpected failure for `p@beta`, while the complete notification contains only:

```text
● alpha [project] (added)
  ● p v#… (installed)

Import: 2 successes

/reload to pick up changes
```

There is no beta row or failure count. This is a same-command case and requires no concurrent process.

**Fix:** Settle the `unchanged` result using its returned canonical name. When it differs from the planned name, use the existing reuse disposition: block installation under the missing name and record each plugin as `marketplace-not-added`. When it matches, preserve a suitable marketplace header for any plugin outcomes. Refreshing the relevant state between ensures is another option, but every reachable plugin outcome must have a rendered header. Add a regression beginning with empty state and two settings names for one source, asserting the failure row, severity, tally, and declarations.

### CR-02: Apply hides rollback phases and leaked artifacts after a failed enable

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1067-1078`

**Related files:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:318-322`; `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:1239-1260`.

**Issue:** The enable operation already returns its error and `rollbackPartials` at `enable-disable.ts:2993-3009`. The apply toggle loop retains only `reason` and MCP notices. Its `PluginEnableFailedOutcome` has no fields for the error or partials, and the row projection accepts recovery details only for install failures. Therefore apply reports `{rollback partial}` without the failed phase, cause, or leaked-resource names. The user cannot determine what needs repair from the result, contrary to MIM-03.

**Confirmed reproduction:** Install and disable a local plugin with a skill, change its config to enabled, add a read-only subdirectory containing a file to its source skill, and place a directory at the project `mcp-adapter.json` path. Run the real apply operation as a non-root user. Skills staging succeeds; the MCP phase fails; the skills undo cannot remove the copied file. The complete notification is:

```text
A plugin operation has failed.

● fixtures [project]
  ⊘ demo (failed) {rollback partial}

Reconcile: 1 failure
```

A direct read confirms `resources/skills/demo-skill/read-only/data.txt` remains on disk while the saved record remains disabled. Import's equivalent scenario already expects the skills phase, cause chain, and `demo-skill` leak.

**Fix:** Carry redacted error/cause and rollback partials through the failed-enable outcome and its row projection, preserving manual-recovery leak information as the install path does. Apply the same projection to other apply paths that consume failed enables. Add an apply-enable scenario with this real failure sequence and assert the complete recovery detail and retained disabled state.

### CR-03: Path redaction misses whitespace-containing paths and standard UNC paths

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:22-28`

**Consumers:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/import/execute.ts:2244-2257`; `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:501-506` and `installFailedOutcomes`.

**Issue:** The matcher permits only word characters and a small punctuation set inside paths, and recognizes extended UNC prefixes but not ordinary UNC prefixes. Valid filesystem paths containing spaces can be left fully absolute or only partially shortened. Ordinary UNC paths remain unchanged. These strings enter the user-visible error and rollback chains through the Phase 6 consumers, defeating D-PL6-12's basename-only redaction and the T-06-10/T-06-11 mitigation.

**Confirmed reproduction:** Direct calls to the real redactor and cause-chain formatter produce:

| Input path | Redacted result |
|---|---|
| `/private dir/secret.json` | `/private dir/secret.json` |
| `/Users/Jane Doe/private/plugin/secret.json` | `Jane Doe/private/plugin/secret.json` |
| `\\server\private\secret.json` | `\\server\private\secret.json` |

For the first input, `causeChainTrailer(redactCauseChain(new Error("unlink '/private dir/secret.json'")))` returns `cause: unlink '/private dir/secret.json'`. The cause formatter therefore exposes the full absolute path.

**Fix:** Recognize complete quoted filesystem paths, including spaces, Unicode characters, and ordinary UNC prefixes, before replacing them with their basename; retain the existing URL and JSON-pointer exclusions. Where the producer knows the path, prefer structured path replacement over guessing from arbitrary prose. Add helper and composed import/apply regressions using paths with spaces and standard UNC text, checking every cause link and leaked-resource entry.

## Previous review disposition

The IDs in this table refer to the superseded 2026-10-27 report, not the new findings above.

| Previous ID | Current disposition |
|---|---|
| CR-01 | The config-name preservation fix remains effective for imports naming the recorded marketplace: `configNamesByRecorded` uses the planner's claims and the post-pass keeps the config's existing name. Current unit and feature cases cover a config alias and its recorded name. The original settings-alias behavior was subsequently replaced by D-PL6-17. |
| WR-01 | Deliberately superseded by D-PL6-18: declaring the recorded name elsewhere in settings no longer prevents silent source reuse. The old `settingsMarketplaces` exclusion was removed from the implementation and types. Reinstating it would contradict the current decision. |
| WR-02 | The old import claim-conflict prose path is superseded by D-PL6-17/18's reuse behavior and D-PL6-19's source replacement. The obsolete mismatch sentence is not a current finding. Planner ambiguity still prevents unsafe config claims. |
| IN-02 | Dedupe remains wired in import and apply. Apply suppresses a repeated dependency row only when a prior failure already carries rollback phases, so a prior bare failure cannot suppress the first detailed row. Current unit tests and scenarios cover shared failing dependencies. |
| IN-05 | Runtime error tokens remain in the rollback scenarios. D-PL6-16 restricts arbitrary-directory matching to the read-only skill removal token; other tokens retain exact or basename matching. The installed rollback scenario also checks that output contains no absolute sandbox path. |
| IN-01 (previously skipped) | The old synthetic unreferenced source-mismatch arm is superseded by D-PL6-19's actual re-add path. Current add failures use the existing marketplace failure grammar. No actionable instance of the old issue remains. |
| IN-03 (previously skipped) | Subsequently resolved by D-PL6-15: the requested/dependency failure pair is sorted by name, with exact current scenario assertions. |
| IN-04 (previously skipped) | The narrow enable-degradation projection still repeats three optional fields, but staged-kind facts are carried once through required `declares*` members and reconstructed at the row boundary. No current incorrect mapping was found; a speculative future-maintenance preference is not reported as a warning. |

## Verification evidence and limitations

- Reused the supplied passing combined-tree `npm run check` gate at code commit `4e3e7d1fb97804723a128f8cc142ccb8fdd44321`, Node v26.12.1: static checks passed, 1,123/1,123 Cucumber scenarios, 11,442/11,442 steps, 309 direct-coverage records, exit 0.
- Verified that the diff from that code commit to the reviewed HEAD contains only five planning/report files. No build inputs changed, so the repository's gate-reuse rule applies. The full gate was not rerun.
- Ran narrow reproductions for the same-import duplicate source, actual failed-enable rollback, and path redaction. Temporary fixture trees were removed after each composed reproduction. No source or test file was edited.
- The passing existing gate does not exercise the two composed failure cases above or the missing path forms. No additional actionable test-reliability finding was established after reading the full paired suites.
- This standard-depth review includes targeted caller/data-flow tracing. It is not an exhaustive concurrency or platform audit. The UNC defect is demonstrated through the platform-independent string/cause formatter, not a Windows filesystem run.
- The earlier security report is historical evidence, not a current clearance of CR-03. This review modifies only this report and does not update that separately owned artifact.

---

_Reviewer: gsd-code-reviewer_

_Depth: standard_
