---
phase: 01-staging-warning-channels
reviewed: 2026-10-28T14:09:03Z
depth: standard
source_commit: 67a589aa043092978351de71ce641e138539fead
review_head: 41d8718fd00524061a338710ee8b0b02079a21d9
files_reviewed: 47
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/agents-index-io.ts
  - extensions/pi-claude-marketplace/shared/staging-warnings.ts
  - features/plugin/staging-warnings.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/bridges/agents/stage.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/staging-diagnostics.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/shared/staging-warnings.test.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-28T14:09:03Z
**Depth:** standard
**Files reviewed:** 47
**Status:** issues_found

## Summary

Fresh review of WRN-01 through WRN-07 on the integrated Phase 11 source, following
the Phase 1 plans, summaries, original review and fix report. The scope is the
warning producers, typed carriers, failure paths, renderers and current callers
listed above, including the install modules extracted during Phase 11. In large
shared modules, the review follows those Phase 1 responsibilities and their
current integrations; unrelated later-phase behavior is outside this review.

The five selected fixes in the original fix report remain closed. Two observable
defects remain: the original IN-04 notice-loss path still exists, and later install
member-diagnostic support breaks Phase 1's row-order rule. Both were reproduced
through the real install entry point using hermetic fixtures. No implementation
or test files were changed.

## Narrative Findings (AI reviewer)

### CR-01: Install drops MCP notices from dependency steps that already changed the file

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts:248-262`
**Provenance:** Original Phase 1 IN-04; not selected for the original fix pass.

**Issue:** `runDependencySteps` returns the MCP notices from dependency slices
and moves. `installAfterMoves` reads only `landed` and `cause`: its failed
branch calls `projectFailedMoves` without the notices, and its successful branch
calls `installAgain` without them. The later root install cannot reconstruct
notices for file changes that already happened.

Current production chain:
`saveInstallDependencyPlanClosure` returns notices
(`install-flow-dependency-ledger.ts:584`), `runDependencySteps` accumulates
them (`dependency-settle.ts:227`), and the install planning boundary discards
them. The update settlement path does preserve them, so WRN-06's update case
does not cover this sibling install path.

**Reproduced:** Seed installed `aaa@1.0.0`; publish
`app@1.0.0 -> aaa@^2.0.0`, `aaa@2.0.0 -> zzz`, and `zzz@1.0.0`
with an MCP server. Seed project `mcp-adapter.json` with
`// user comment\n{"mcpServers":{}}\n`. Install `app` through
`createInstallPlugin` using the existing `withHermeticHome`,
`seedCatalogScope`, `publishCatalog` and `makeCtx` fixtures.

Observed: status `installed`; `zzz`'s MCP entry exists and the comment is gone;
only the cascade notification is emitted. The required
`comments-dropped` notice is absent. Source tracing also establishes the loss
on the `!ran.ok` branch after an earlier slice has committed.

**Fix:** Carry `ran.mcpConfigNotices` through both branches. Add the prior-step
notices to `InstallAfterPlan` and the failed-moves projection input; combine
them with the final install's notices before the existing mode-selected notice
emission. Preserve ordering and avoid duplicate standalone notifications.
Add an install scenario with a moved dependency whose newly installed dependency
rewrites commented MCP configuration, plus a case where a later move fails.
The assertion must include the exact notice, not just the successful install rows.

### CR-02: Install member diagnostics no longer follow their row order

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:1260-1275`
**Related file:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts:809-824`

**Issue:** The current install path emits the root's diagnostic first and then
emits member diagnostics in materialization order. Its row composer
`composeCascadeMemberRows` sorts all rows by their rendered name
(`install-cascade.messaging.ts:202-205,309`). These are different orders.

D-PL1-07 requires one placement rule for every verb and cascade: diagnostics
follow the rows in row order. D-PL10-16 added dependency-member diagnostics
without replacing that rule. The original WR-01 fix still orders update/apply
blocks correctly, but does not cover this later install integration.

**Reproduced:** Publish `zroot@1.0.0` depending on `aaa@1.0.0`, with colliding
`tool` and `<plugin>-tool` skills in both plugins. Install `zroot` through
the real entry point with hermetic project fixtures.

Observed notification sequence:

1. Cascade rows: `aaa@mp`, then `zroot`.
2. Diagnostic: `Plugin "zroot" [project] installed; ...`.
3. Diagnostic: `Plugin "aaa" [project] installed; ...`.

The two diagnostics must instead be `aaa`, then `zroot`. Multiple dependency
members can similarly follow dependency traversal rather than alphabetical row
order.

**Fix:** Compose the root and member diagnostics together, associate each with
the exact row identity used by the cascade composer, order them using the same
row ordering, and emit them once after the cascade and before MCP notices.
Preserve the root's display name and each member's plugin name in diagnostic
headers. Add a behavioral scenario whose root sorts after a dependency and
whose two plugins both produce notes; assert the complete notification order.

## Previous Finding Disposition

These are historical dispositions, not additional open findings.

| Original ID | Current disposition | Current evidence |
|---|---|---|
| WR-01 | Selected fix remains closed for the update/apply paths originally reported. CR-02 is a different, later install integration. | `update-flow.ts:553-559` and `apply-outcomes.ts:914-923` stable-sort by marketplace/scope, matching their row composers. Exact ordering assertions remain in `update-flow.test.ts:11584` and `apply-outcomes.test.ts:1407`. |
| WR-02 | Closed. | `marketplace/update.messaging.ts` imports `plugin/staging-diagnostics.ts`; the leaf imports shared notification/redaction/tagging helpers rather than `plugin/shared.ts`. |
| IN-01 | Selected comments fixed. | Install capture documentation, update prepare reporting, reinstall outcome documentation and maintenance description match the selected fixes. |
| IN-02 | Previously unselected self-rendering arm remains diagnostic-free; no new production impact established. | The public reinstall flow uses `render: "none"` and renders carried diagnostics after its cascade. The internal default arm at `reinstall-flow.ts:298-306,499-501` still omits them. |
| IN-03 | Previously unselected defensive concern remains; no current repeated-failure execution established. | `install-outcome.ts:1013-1020` sets a nonempty capture without clearing it. Current captures are per operation and the failure stops the ledger/cascade; this review does not promote a hypothetical second failure to a defect. |
| IN-04 | Still open; reproduced and recorded as CR-01 under the current mandatory classification. | `install-flow-planning.ts:248-262`. |
| IN-05 | Closed and strengthened by later integration. | `bridges/agents/stage.ts:318-329` matches both generated name and target path and preserves unmatched rows. The differing-target test at `test/bridges/agents/stage.test.ts:1681` checks the file and both index rows. |
| IN-06 | Carrier names remain; their expanded responsibilities are explicitly documented. No separate behavior defect. | `enable-disable.ts:237-247` and `materialize-latest.ts:33-45`. |
| IN-07 | Closed. | `materialize-latest.ts:162-167` checks rows, notices and warnings; `materialize-latest.test.ts:670` asserts notices survive without a dependencyRows key. |

## Review Evidence and Limits

- Read the Phase 1 plans, summaries, review/fix records, validation/security
  records, requirements, current project instructions and applicable review skills.
  The configured reviewer skill query returned no additional skills.
- Used CodeGraph before locating current implementation symbols; cross-checked
  their current on-disk call sites. Reviewed the tagged bridge contracts, standalone
  discovery filtering, cascade two-channel rendering, warning capture before
  rollback, enable root-only reporting, forced agent-row preservation, settlement
  notice forwarding and reinstall resource/cache contracts.
- Inspected exact diagnostic redaction/type-barrier assertions in
  `staging-diagnostics.test.ts`, warning partition tests, agent preservation tests,
  ordering cases, settlement notice cases and reinstall outcome cases. The existing
  16-scenario feature exercises the Phase 1 command surfaces; the two reproduced
  combinations above are not covered by those assertions.
- Reused the owner's same-session `npm run check`, exit 0, at source commit
  `67a589aa043092978351de71ce641e138539fead`, Node `v26.12.1`:
  1120 scenarios, 11411 steps and 309 direct LCOV records. Verified the current
  Node version and an empty
  `git diff 67a589aa043092978351de71ce641e138539fead -- . ':(exclude,glob).planning/**/*.md'`,
  with no untracked build inputs before report persistence. A passing existing
  suite does not negate the reproduced missing cases.
- Ran `fallow review --base d98660a7 --brief` for orientation. The first attempt
  could not create its temporary comparison worktree in the sandbox; the
  escalated retry succeeded. It reported zero dead-code, complexity and
  duplication metrics. Its 682-file integrated diff spans later phases and was
  not treated as this report's review scope or as proof of correctness.
- Ran two inline hermetic reproduction probes on Node `v26.12.1`, both exit 0,
  observing the incorrect outputs described above. The probes used existing
  production entry points and fixture helpers, wrote only disposable temporary
  scope data, and cleaned their temporary project directories in `finally`.
  No new test file or production seam was introduced.
- No external reviewer evidence or structural-finding payload was supplied.
  No source was changed and no commit was created.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
