# Phase 2: Row Policies - Discussion Log

This is an audit trail. Downstream agents use `02-CONTEXT.md`.

**Date:** 2026-10-01
**Phase:** 02-row-policies
**Entry point:** `gsd-autonomous --from 2 --interactive`

## Areas Offered

| Area | Alternatives offered |
|------|----------------------|
| Policy readability | Fully explicit entries or shared presets for repeated rules |
| Unexpected rows | Preserve today's defensive error output in resolved data after deleting the callback fallback |
| Pending advisories | Keep retained-workflow details narrow before phase 3 handles other raw output |

**User response:** "none, apply your best judgement, stay consistent with the rest of the codebase"

## Agent's Discretion

All three areas are delegated. The context carries the roadmap constraints,
phase 1 decisions, and the scope limits. Concrete policy field names, module
boundaries, and migration order remain subject to research and plan review.
No additional question or separate approval is needed for these routine choices.

## Research Acceptance Conflict

Research found 25 synthetic callback emissions in the frozen corpus. Deleting
those callbacks changes their test output while production output can remain
unchanged. The exact occurrences are recorded in `02-RESEARCH.md`.

The agent asked for a decision under the plan-phase conflict rule: update only
those 25 test entries with an exact before/after record (recommended), or keep
the baseline immutable and maintain exact substitutions. The production catalog
and all unrelated corpus occurrences must stay unchanged in either case.
**User decision:** "yes, narrow update is fine". D-07 now authorizes the
25-entry patch with an exact before/after record. No other corpus change is
authorized. The baseline has not yet changed.

Research, pattern mapping, and draft validation are complete. This resolves
the acceptance conflict; the autonomous run resumes phase 2 planning.

The assumption-delta scan found the word `fallback` in the deletion requirement.
Disposition: no change. The primary noun remains command row policy; removing
the old fallback does not introduce another provider or a new selectable mode.

## Additional Corpus Census Omission

The complete execution capture found three more callback-only emissions in
`tests/shared/notification-summary.test.ts`, omitted from the research census.
At immutable baseline lines 2633 and 2634, `  alpha (failed)` becomes
`  ⊘ alpha (failed) {not found}`. At line 2640,
`  alpha (partially-upgradable)` becomes
`  ● alpha (partially-upgradable) {lsp}`. Severity remains error/error/null;
argument counts remain 2/2/1. All other output matches after the approved
25 replacements; the production catalog remains unchanged.

The agent asked for explicit approval to extend the exception from 25 to 28.
**User decision:** "yes". This authorizes exactly the three additional
occurrences above: 28 replacements, 2,633 unchanged, 2,661 total. Severity,
argument counts, metadata, and the complete production catalog stay fixed.
The execution checkpoint is resolved; finish the narrow patch and verification.

Execution evidence: `npm run check` passed completely with 7,572 unit tests,
100% line/branch/function coverage, 36 integration tests, the type-member
gate, and seven negative controls. The subsequent complete corpus run had
7,607 passing tests, zero failures, one environment skip, and only the three
missing/extra pairs above. Logs: `/tmp/row-policy-check4.log` and
`/tmp/row-policy-corpus3.log`.

## Deferred Ideas

None.

## Review Fix CR-01 Corpus Occurrence

Code review finding CR-01 showed that the migrated `emitMarketplaceNotAddedSignal`
owner case no longer observed its produced reasons. The fix enables content
reasons in that case's policy, so its one corpus occurrence changes. At
immutable baseline line 1907, `  ⊘ hello (skipped)` becomes
`  ⊘ hello (skipped) {not installed, marketplace in user scope}`. Severity
stays error and the argument count stays 2.

The agent asked for approval of this one replacement.
**User decision:** "Yes, approve this one replacement". This authorizes
exactly that occurrence: 29 replacements, 2,632 unchanged, 2,661 total in the
immutable original blob. The merge from main re-baselined the corpus to 3,133
entries before the fix landed (`e514ea67`). The occurrence sits at line 2,284 of
that baseline, and it is the only change from it.
