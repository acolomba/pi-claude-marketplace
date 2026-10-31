---
phase: 01-presentation-model
reviewed: 2026-10-01T16:50:13Z
depth: standard
diff_base: 5f5b4e2894ae5ff6ca2ca960e0d8696466787c5d
reviewed_head: 800e94576f8d13437c40005e1d00829f84615616
scope_source: /tmp/json-review-final-files.txt
files_reviewed: 19
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - scripts/check-unused-type-members.contracts.json
  - scripts/notify-corpus.hook.mjs
  - scripts/notify-corpus.mjs
  - scripts/notify-corpus.negative.mjs
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-summary.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-01T16:50:13Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** clean

## Summary

Incremental adversarial review of the six fixes following
`5f5b4e2894ae5ff6ca2ca960e0d8696466787c5d`, on `features/json`.
The exact source scope is the 19-file list above. Planning files are excluded.
This report supersedes the six open findings in the previous report; it does
not claim a new review of every file changed by the whole milestone.

No new BLOCKER or WARNING was confirmed in this fix scope. The selected
minimum fixes for WR-01 and IN-01 satisfy the alternatives explicitly offered
by the previous review. Their documented limitations remain part of the
current contract.

## Structural Findings (fallow)

Evidence: `/tmp/json-review-final-fallow.json`, Fallow 3.27.0,
schema version 11, head `800e9457`.

| Evidence | Reported value | Review disposition |
| --- | --- | --- |
| Audit verdict | `fail`, with `--max-crap 30` | Preserve as a structural audit result; it is not a proven behavioral defect. |
| Comparison base | `3723699a13eea53f0186c77f9c0d6ebfb44853ed`, merge-base with origin/main | Covers 237 changed files, not this review's 19-file fix scope. |
| Dead code | 0 issues, no errors | No dead-code finding. |
| Complexity | 390 findings; attribution: 12 introduced, 299 inherited | “Introduced” is relative to the broader audit base. All 12 introduced entries use estimated coverage with `coverage_tier: none`. |
| Duplication | 17 groups; attribution: 8 introduced, 9 inherited | Locations checked against the fix diff; no new defect confirmed. |

The introduced complexity entries name `resolveRow`, `resolveTally`,
`resolveTallySuccess`, `resolveEnvelope`, `tallySentence`, corpus
`load`, `surplus`, `reportDiff`, `main`, `parseCaptureArgs`,
the context-label callback, and a notification-resolve test callback.
Only `parseCaptureArgs` and the context-label callback change behavior in
this fix range. Their added branches reject malformed arguments and distinguish
unexported declarations, respectively. Both have focused regression controls.
An estimated zero-coverage CRAP score does not establish missing tests.

The eight introduced duplicate groups consist of three overlapping script
entrypoint groups, two pairs of edge handlers, and three render-map groups.
The script entrypoint and edge-handler blocks predate the fix base. The
render-map changes remove the redundant reasons argument while preserving
the existing per-command maps. The resulting short common calls do not
establish an incorrect or inconsistent implementation.

A fresh scoped `fallow review --base 5f5b4e28... --brief` attempt could not
create its temporary base worktree in the sandbox and exited 2. No worktree
was created. The provided prepass and the actual git diff were used for
structural attribution. The pre-commit audit results recorded by the fixer
remain distinct evidence; this review does not relabel the broader audit as
a passing audit.

## Narrative Findings (AI reviewer)

No new findings.

### Disposition of the six prior findings

| Prior ID | Evidence checked in current source | Disposition |
| --- | --- | --- |
| WR-01 | `shared/notification-summary.ts:420` owns redaction and indentation; `orchestrators/marketplace/add.ts:509` delegates the cleanup leak to it. The direct test asserts the entire redacted advisory line. | Closed using the explicitly offered presentation-composer option. |
| IN-01 | `scripts/notify-corpus.hook.mjs:15-23` states the exact-string refusal boundary and the raw-text/string-literal limitations. Control 6 describes that same boundary. | Closed using the explicitly offered documentation option. |
| IN-02 | `scripts/notify-corpus.mjs:314-338` rejects unknown flags and explicitly empty `--files` lists before capture. Control 7 checks exact errors and unchanged capture contents; Control 5 checks reordered valid flags. | Closed. |
| IN-03 | `tests/architecture/soft-dep-marker-policy.test.ts:268-287` uses the nearest top-level const's name and export status. The planted unexported context follows an exported render map, and its complete discovered label list is asserted. The trailing-comment limitation is documented. | Closed. |
| IN-04 | Marketplace-list comments describe `notifyWithContext` and the cascade sentinel; `update-swap.ts:1392` names all three staged dependency kinds. | Closed. |
| IN-05 | `shared/notification-grammar.ts:610-630` reads `p.reasons`; all seven production callers pass the same guarded row through the five-argument signature. The byte assertion and type-level producer-row refusal remain. | Closed. |

The parser and labeling controls distinguish the original faulty behavior
from the fix. The fix report's “requires human verification” labels do not
identify an unresolved human-only dependency.

The three adjusted type-member contract locations were checked against their
actual declarations: `DISABLE_RENDER:96`,
`isManualRecoveryOutcome:211`, and `isInfoKind:43`.
The reasons member replaces the former parameter with no change to marker
order, version formatting, severity, or row scope.

### Verification and limits

- Read the prior review, fix report, phase context, roadmap goal, project
  instructions, and configured TypeScript comment/style/test review skills.
  Used CodeGraph to orient caller tracing.
- Reviewed the fix diff and current source, including the advisory's redactor,
  resolved-row construction, and notification caller boundaries.
- `node --test tests/architecture/soft-dep-marker-policy.test.ts
  tests/shared/notification-grammar.test.ts
  tests/shared/notification-summary.test.ts` exited 0.
- `node scripts/notify-corpus.negative.mjs` passed outside the sandbox.
  The first sandbox run failed because a spawned diff process returned empty
  stderr; the identical control passed with normal process permissions.
- `git diff --check 5f5b4e28..HEAD` passed. None of the 19 source files is
  ignored by git.
- The parent verifier owns the fresh full `npm run check`, direct coverage
  gates, and corpus re-diff. This report does not substitute its focused
  checks for those phase-completion gates.

No source files were modified or committed by this review. The existing
`01-REVIEW-DISPOSITION.md` edit was left untouched.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
