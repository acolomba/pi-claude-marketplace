---
phase: 03-dependency-cascade-rows-and-status
reviewed: 2026-10-28T22:38:04Z
reviewed_commit: 1459ceb43620b317e07cb46e1f502744fbc2ac37
depth: standard
review_scope_complete: true
files_reviewed: 24
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - features/plugin/install-dependencies.feature
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - docs/dependency-resolution.md
  - test/orchestrators/plugin/install-cascade.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-28T22:38:04Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

The full current Phase 3 scope was reviewed at standard depth. Every listed file was read completely, including the large ledger and cascade test modules. The scope includes the previous report's 23 files and every source/test file changed by fix commit `0ee37cf01ac4e3e8830b502f8b003ed3d27a68e6`; the latter adds `install-cascade.test.ts` to the canonical list.

CR-01 is closed: freshly materialized partial members retain their unsupported kinds, render `partially-installed` with narrowed reasons, and leave the requesting plugin's own status independent. A separate, reproduced projection defect remains: malformed-frontmatter degradation is discarded from materialized dependency rows.

## Narrative Findings (AI reviewer)

### CR-02: Materialized dependency rows discard malformed-frontmatter degradation

**Classification:** BLOCKER — incorrect user-visible behavior.

**Primary file:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1245-1271`

**Related files:**

- `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:226-266`
- `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:327-328`
- `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:376-385`

**Issue:** A dependency's install ledger can complete with `frontmatterDegradations` after malformed skill or command YAML is recovered. `recordMaterializedMember` copies component declarations, discovery warnings, and now unsupported kinds, but drops those degradation facts. `composeCascadeMemberRow` consequently has no malformed-kind reasons to render and derives severity solely from companion availability. With no missing companion, the dependency reports an ordinary installed row at info severity despite its artifact having been degraded.

The root install composer already renders `malformedReasonsForKinds(...)` and raises this condition to warning independently of companions. The cascade row bypasses that behavior, violating WARN-01 for the dependency's own result. Keeping the requesting plugin installed is correct; concealing the dependency's malformed content is not.

**Verified reproduction:** In an isolated process, use `withHermeticHome`, `seedCatalogScope`, and `makeCtx` from `test/orchestrators/plugin/install-flow-fixture.ts`. Seed `app@mp` with dependency `lib` and give both version `1.0.0`. Replace `plugins/lib/skills/tool/SKILL.md` with `---\nname: [unterminated\n---\nBody.\n`. Invoke the real `installPlugin` for `app@mp` in project scope. The install succeeds and the notification has no warning severity and prints:

```text
● mp [project]
  ● app v1.0.0 (installed)
  ● lib@mp v1.0.0 (installed)

/reload to pick up changes
```

The dependency row must retain its malformed-skill reason and warning severity; the root row must remain installed. Existing root malformed-frontmatter tests confirm that malformed content is a reported degradation, not a clean success. The reproduction used unique temporary fixture directories and removed them afterward.

**Required fix:** Carry the dependency's degraded component kinds from its ledger summary through `CascadeMemberOutcome` and `CascadeInstalledRow` (the existing `ledgerDegradationSignals` projection can supply `degradedKinds`). Append `malformedReasonsForKinds` to the member's reasons and choose warning severity when those kinds are present; otherwise preserve companion severity. Keep partial status, unsupported reasons, current-copy/re-enable reasons, and the root's independent result intact. Add row-composer and real-install regressions for malformed skill/command dependencies, including a partial member combined with malformed content, and a Cucumber scenario for the visible warning.

## Closed finding and combination checks

- **CR-01 closed:** The fix preserves a fresh dependency's own unsupported kinds, uses the installed/partially-installed union, and narrows unsupported kinds through the shared reason mapper. The new whole-result Cucumber case checks an installed root beside a partially-installed dependency.
- Source and whole-row test review confirm partial members preserve `dependency current copy`, and re-enabled partial members preserve `already installed` plus `dependency enabled`.
- Unsupported reasons alone do not change severity. Companion availability still selects info/warning; the partial-member tests include an unloaded companion. Narrowing coalesces generic unsupported kinds while retaining specific `lsp` reasons.
- Closure failure ordering, truncation/escaping, range declarers, dependency moves, rollback rows, promotion/re-enable paths, installed-state classification, and MCP notices were reviewed in their full current source context. No additional actionable defect was established.

## Verification and limits

- Reviewer-run `node --test test/orchestrators/plugin/install-cascade.messaging.test.ts`: passed, exit 0, Node v26.12.1.
- Reviewer-run hermetic real-install reproduction above: exit 0, confirms CR-02.
- `git diff --check`: passed before report generation.
- Independently supplied by the orchestrator: fresh combined-tree `npm run check` at reviewed commit `1459ceb43620b317e07cb46e1f502744fbc2ac37`, Node v26.12.1, exit 0; all static checks passed, Cucumber 1122/1122 scenarios and 11433/11433 steps passed, direct coverage merged 309 records. No duplicate full gate was started. That passing gate does not cover the reproduced member-degradation case.
- CodeGraph was attempted first but failed to open its database. Complete source reads and `rg` call-site inspection supplied the review evidence. No fresh structural pre-pass was supplied, so historical Fallow measurements are not presented as this review's findings.
- No source/test files were modified, and no commit was made. Network and interactive external-runtime checks were outside this standard-depth review. The remaining release risk is the reproduced incorrect dependency notification in CR-02.

---

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-10-28T22:38:04Z_
_Depth: standard; complete 24-file scope_
