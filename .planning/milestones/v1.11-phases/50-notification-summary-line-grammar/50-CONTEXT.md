# Phase 50: Notification Summary-Line Grammar - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every error/warning-severity notification carries a non-empty summary message on
the host `Error:`/`Warning:` label line, with the cascade/detail rendered as its
own separate block below -- emitted through a single shared summary-emission path
so the standalone-vs-cascade divergence that caused the v1.10 defect cannot recur.

**Requirements:** GRAM-01, GRAM-02, GRAM-03, GRAM-04, GRAM-05

**Success Criteria** (what must be TRUE):

1. Running `/claude:plugin install x@y` against a missing marketplace renders a
   summary line on the host label line (`Error: 1 marketplace operation failed.`)
   followed by the `⊘ y [user] (failed) {not added}` detail row as its own
   separate block below -- never the glued single-line
   `Error: ⊘ y [user] (failed) {not added}`.
2. The same corrected two-block shape (non-empty summary line + separate detail
   block) renders across every standalone `marketplace-not-added` emission --
   install, uninstall, reinstall, update, marketplace update, marketplace remove,
   autoupdate/noautoupdate -- and across the failed `plugin-info` surface (e.g.
   `plugin info` against an unreadable manifest).
3. The summary subject follows the failed-row subject, not the invoking command:
   a marketplace-subject failure reads `N marketplace operation(s) failed.` and a
   plugin-subject failure reads `N plugin operation(s) failed.` (the v1.10 ATTR-08
   subject-attribution principle: `{not added}` on the marketplace vs
   `{not in manifest}` on the plugin).
4. Standalone and cascade notifications emit their summary through one shared code
   path in `shared/notify.ts`: `dispatchInfoMessage` no longer bypasses
   `buildSummaryLine`, and `buildSummaryLine` returns the failed-subject summary
   for the standalone error/warning kinds -- no standalone-kind path can drift
   back to a summary-less emission.
5. A new cross-cutting grammar-invariant test asserts that every error/warning
   notification's emitted message has a non-empty summary first line distinct from
   the cascade block, across all catalog fixtures; `docs/output-catalog.md` (the
   ~6 sections that encoded "NO summary line. Severity error" --
   install/uninstall/reinstall/update/marketplace-update + remove/autoupdate) and
   the `catalog-uat` fixtures are corrected to the new byte forms in lockstep;
   `npm run check` exits 0.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped
per user setting. Use ROADMAP phase goal, success criteria, and codebase
conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- discuss phase skipped. Refer to ROADMAP phase
description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
