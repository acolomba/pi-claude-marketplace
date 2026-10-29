---
phase: 06-import-marketplace-planning
reviewed: 2026-10-29T00:56:32Z
reviewed_commit: 7739eeb8759cf62cdbecb926e5dade64cb1bd0dd
source_commit: 250acaadf15622a66ee80b5e3443ad96be908016
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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-29T00:56:32Z

**Commit:** `7739eeb8759cf62cdbecb926e5dade64cb1bd0dd`

**Depth:** standard

**Files reviewed:** 38 (79,853 lines), complete

**Status:** clean

## Summary

Fresh review of the complete current scope found no actionable correctness, security, or test-reliability defect. The three blockers in the preceding review are closed. The previously skipped and superseded findings were reassessed against D-PL6-15 through D-PL6-20; none remains actionable.

Every file in `files_reviewed_list` was read completely. The primary reviewer read all 15 production files, the three feature files, four feature support/step files, and the Cucumber rules file. A test-only reviewer read the non-overlapping 15 test files in full (58,386 lines). This was a complete current-file review, not only a recheck of previous findings.

The scope includes every file changed by `6680b940`, `a769f58f`, `a04c4756`, and `250acaad`. No scoped file is git-ignored. CodeGraph was consulted first for symbols and call paths; it reported stale indexed source for changed modules, so current direct reads and caller/type searches supplied the review evidence.

## Narrative Findings (AI reviewer)

No current BLOCKER or WARNING findings. No informational findings.

## Closure of the preceding review

These IDs refer to the 2026-10-28 review at `bd310b53`.

| Finding | Current evidence and disposition |
|---|---|
| CR-01 — unchanged add loses an import failure | Closed by `6680b940`. The unchanged branch in `orchestrators/import/execute.ts:1404` compares the returned canonical name. A different name enters `recordReusedMarketplace` (`execute.ts:1638`), blocks the requested marketplace, and records each plugin as marketplace-not-added. The failed requested-name header survives grouping and contributes to the error tally. Same-name plugin imports retain their skipped marketplace header; unreferenced reuse stays silent. Complete unit and feature assertions cover two names for one newly added source, exact failure/header/tally output, canonical-only config declarations, and absence of a wrong-name installation. |
| CR-02 — apply drops failed-enable recovery details | Closed by `a769f58f`. `orchestrators/reconcile/apply.ts:1073` carries rebuilt causes and rollback phases into the failed-enable outcome. `apply-outcomes.ts:325` and `notify.ts:1281` preserve these fields through the shared failed-row projection. Failed moves use that same projection at `apply.ts:1778`, retaining version/commit metadata while carrying redacted recovery details. The enable ledger returns failure without persisting enabled state; exact TUI/JSON regressions check cause, rollback phase, leaked resource, and the unchanged disabled record for failed enable and failed move. |
| CR-03 — quoted and UNC paths disclose directories | Closed by `a04c4756` and the `250acaad` follow-up. `shared/redact-absolute-paths.ts:23` handles complete quoted paths and Node errno fields before generic prose matching. `redactCauseChain` (`:112`) rebuilds nested causes and structured ManualRecoveryError leaks; `redactedRollbackPartials` (`:145`) removes raw ledger messages. Import (`execute.ts:2252`) and apply (`apply.ts:637`, `:1074`) use these boundaries before rendering. Current tests cover spaces, Unicode, ordinary/extended UNC and Windows paths, O'Brien, O' Brien, actual one- and two-path Node syscalls, and literal `' -> '` inside an open path. Exact import/apply TUI and JSON assertions cover nested causes, rollback causes, and basename-only leak projections. |
| SEC-06-01 — apostrophe-space terminates an errno path | Closed by `250acaad`. Node errno paths retain internal apostrophes before basename extraction. Two-path splitting applies only to rename, copyfile, link, and symlink; open retains its entire single path. The independently owned final security report records 131 passing diagnostic/projection assertions and 14/14 closed threats. |

## Earlier finding dispositions under current decisions

These IDs refer to the superseded 2026-10-27 review.

| Previous finding | Current assessment |
|---|---|
| CR-01 — config naming | Closed. `configNamesByRecorded` uses the planner's one-to-one source claims; the post-pass preserves an existing config alias and its layer for a recorded marketplace. D-PL6-17 separately forbids installing or declaring a plugin under an absent settings name. Current scenarios assert both behaviors. |
| WR-01 — settings also declares the recorded name | Superseded by D-PL6-18. The old settings-name exclusion is absent from implementation/types; source reuse remains silent even when settings also declares the recorded name. Plugins naming an absent marketplace still fail under D-PL6-17. |
| WR-02 — claim-conflict prose | Superseded by D-PL6-17/18 source reuse and D-PL6-19 source replacement. The former prose path is not a current defect; ambiguous claims still cannot rewrite config identity. |
| IN-01 — previously skipped unreferenced mismatch reporting | Superseded by D-PL6-19. Eligible same-name source changes take the actual re-add path and shared failure bookkeeping. A missing local source or a source already recorded under another name preserves the record; official fallback mismatch retains its specified behavior. A replacement manifest with a different name fails closed. |
| IN-02 — shared dependency detail deduplication | Closed. Import and apply retain one detailed failure per scoped dependency. Apply suppresses a repeated dependency row only after a prior row carries rollback phases, so a bare failure cannot suppress the first detailed row. Full scenarios assert shared-dependency outcomes. |
| IN-03 — previously skipped ordering | Closed by D-PL6-15. The requested/dependency failure pair uses `compareByNameThenScope`, with exact scenario assertions. |
| IN-04 — previously skipped enable projection | No actionable defect. Optional degradation fields are copied consistently; staged component facts travel through required `declares*` members and are reconstructed at the row boundary. Repetition alone is not a robustness finding. |
| IN-05 — error-token matching | Closed under D-PL6-16. Arbitrary-directory matching is restricted to the read-only skill removal token. Other error tokens require the exact or path-cut form. Exact unit assertions independently enforce redaction. |
| D-PL6-20 — leaked skill identity | Current import/apply projections retain the skill directory basename in structured leaks while rebuilding nested recovery causes. Their checks cover both text and JSON output. |

## Verification evidence

- Reused the passing session `npm run check` at source commit `250acaadf15622a66ee80b5e3443ad96be908016`, Node v26.12.1, exit 0: all static checks, 1,125/1,125 Cucumber scenarios, 11,467/11,467 steps, and 309 direct-coverage records.
- Reviewed HEAD is `7739eeb8759cf62cdbecb926e5dade64cb1bd0dd`. Its only difference from that source commit is `06-SECURITY.md`. `git diff --exit-code 250acaad -- . ':(exclude,glob).planning/**/*.md'` was empty and exited 0; there were no untracked inputs. Node remains v26.12.1. The local-verification gate-reuse rule therefore applies.
- The independently owned final `06-SECURITY.md` reports SECURED at the same source: 14/14 threats closed (11 mitigated, 3 accepted risks), including 131 read-only audit assertions.
- Read all four fix-commit file sets and verified they are contained in the 38-file scope. Reviewed current AGENTS, applicable review/TypeScript/unit/Cucumber rules, REVIEW-FIX, SECURITY, VALIDATION, and D-PL6-15 through D-PL6-20.
- The optional `fallow review --base d98660a7 --brief` orientation attempt could not create its temporary base worktree in the sandbox (exit 2). No structural pre-pass findings were supplied. The passing full gate already includes the required fallow checks; this review does not claim a successful fresh structural comparison.
- No source or test file was modified and no full suite was rerun. Report frontmatter/scope consistency and `git diff --check` were checked before handoff.

## Limits

This is standard-depth review with targeted caller, type, state, and output tracing, not an exhaustive concurrency or platform audit. UNC cases use diagnostic strings and structured leak values; no Windows filesystem run was performed. Full apostrophe/space handling follows Node errno grammar; arbitrary free-form prose retains conservative boundaries. The special Cucumber error token can match either full or basename paths, so its scenario alone is not proof of redaction; the exact unit projections provide that check.

---

_Reviewer: gsd-code-reviewer_

_Depth: standard_
